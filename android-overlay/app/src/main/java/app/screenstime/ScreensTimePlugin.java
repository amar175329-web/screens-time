package app.screenstime;

import android.Manifest;
import android.app.AppOpsManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The bridge between the web app and Android. The web app calls these by name (see www/js/data.js and docs/DATA_CONTRACT.md).
 *   status()            which permissions are on
 *   getData({since})    apps, events, notifications, history ... everything the engine needs
 *   saveRollups({days}) keep finished days for ever
 *   getIcons({ids})     the apps' own icons
 *   getConfig() / setConfig({json})   the person's settings, shared with the blocker
 *   openSettings({which})             jump to the right Android settings page
 */
@CapacitorPlugin(name = "ScreensTime")
public class ScreensTimePlugin extends Plugin {
    private static final long DAY = 86400000L;

    private boolean usageGranted() {
        Context ctx = getContext();
        AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= 29
                ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName())
                : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        if (mode == AppOpsManager.MODE_DEFAULT)
            return ctx.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED;
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private boolean listed(String settingKey, String needle) {
        try {
            String s = Settings.Secure.getString(getContext().getContentResolver(), settingKey);
            return s != null && s.contains(getContext().getPackageName()) && s.contains(needle);
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject o = new JSObject();
        o.put("usage", usageGranted());
        o.put("notif", listed("enabled_notification_listeners", "NotificationService"));
        o.put("a11y", listed(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, "BlockerService"));
        o.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(o);
    }

    @PluginMethod
    public void getData(final PluginCall call) {
        final Context ctx = getContext();
        final long sinceArg = call.getData().optLong("since", 0);
        new Thread(() -> {
            try {
                long now = System.currentTimeMillis();
                boolean full = sinceArg <= 0;
                long since = full ? now - 10 * DAY : sinceArg;
                Store store = Store.get(ctx);
                JSONArray apps = AppCatalog.list(ctx);
                if (full) { store.upsertKnown(apps); store.prune(now); }
                JSONObject usage = UsageReader.read(ctx, since, now);
                JSONObject out = new JSONObject();
                out.put("now", now);
                out.put("apps", apps);
                out.put("known", store.known());
                out.put("events", usage.getJSONArray("events"));
                out.put("background", usage.getJSONArray("background"));
                out.put("pages", store.pagesSince(since));
                out.put("notifications", store.notifsSince(UsageMath.startOfToday()));
                out.put("history", store.history());
                out.put("siteMinutes", store.siteMinutes(UsageMath.todayKey()));
                out.put("pause", new JSONObject().put("tries", store.pauseDeclinedSince(now - DAY)).put("savedMin", 0));
                call.resolve(new JSObject(out.toString()));
            } catch (SecurityException se) {
                call.reject("Usage access is off");
            } catch (Exception e) {
                call.reject("Could not read usage: " + e);
            }
        }, "st-getData").start();
    }

    @PluginMethod
    public void saveRollups(PluginCall call) {
        try {
            JSONArray days = call.getData().optJSONArray("days");
            if (days != null) Store.get(getContext()).saveRollups(days);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not save days: " + e);
        }
    }

    @PluginMethod
    public void getIcons(final PluginCall call) {
        final JSONArray ids = call.getData().optJSONArray("ids");
        new Thread(() -> {
            try {
                JSONObject icons = new JSONObject();
                if (ids != null) for (int i = 0; i < ids.length(); i++) {
                    String id = ids.getString(i), uri = AppCatalog.icon(getContext(), id);
                    if (uri != null) icons.put(id, uri);
                }
                call.resolve(new JSObject(new JSONObject().put("icons", icons).toString()));
            } catch (Exception e) {
                call.reject("Could not read icons: " + e);
            }
        }, "st-icons").start();
    }

    @PluginMethod
    public void getConfig(PluginCall call) {
        JSObject o = new JSObject();
        o.put("json", Config.raw(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void setConfig(PluginCall call) {
        String json = call.getString("json", "");
        Config.save(getContext(), json == null ? "" : json);
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String which = call.getString("which", "usage");
        String pkg = getContext().getPackageName();
        Intent i;
        switch (which == null ? "" : which) {
            case "notif": i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS); break;
            case "a11y": i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS); break;
            case "appinfo": i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)); break;
            case "battery": i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS); break;
            default: i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:" + pkg)); break;
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (ActivityNotFoundException e) {
            try {
                Intent plain = new Intent(which.equals("usage") ? Settings.ACTION_USAGE_ACCESS_SETTINGS : Settings.ACTION_SETTINGS);
                plain.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(plain);
            } catch (Exception e2) {
                call.reject("Could not open settings");
                return;
            }
        }
        call.resolve();
    }
}
