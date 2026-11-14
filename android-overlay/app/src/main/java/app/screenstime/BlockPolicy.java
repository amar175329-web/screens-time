package app.screenstime;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.telecom.TelecomManager;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** "Should this app be blocked right now, and why?" Reads the person's settings; knows nothing about screens. */
final class BlockPolicy {
    private BlockPolicy() {}

    /** Never blocked: so the person can always call, change settings or get home. */
    private static final Set<String> ALWAYS_OK = new HashSet<>(Arrays.asList(
            "com.android.systemui", "com.android.settings", "com.android.phone", "com.android.dialer", "com.google.android.dialer",
            "com.android.incallui", "com.samsung.android.incallui", "com.android.emergency", "com.google.android.packageinstaller",
            "com.android.packageinstaller", "com.android.permissioncontroller", "com.google.android.permissioncontroller"));
    private static String home = null, dialer = null;
    private static long homeAt = 0;

    static boolean essential(Context ctx, String pkg) {
        if (pkg == null || pkg.equals(ctx.getPackageName()) || ALWAYS_OK.contains(pkg)) return true;
        long now = System.currentTimeMillis();
        if (home == null || now - homeAt > 120000) {
            homeAt = now;
            try {
                PackageManager pm = ctx.getPackageManager();
                ResolveInfo ri = pm.resolveActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), PackageManager.MATCH_DEFAULT_ONLY);
                home = ri != null && ri.activityInfo != null ? ri.activityInfo.packageName : "";
                TelecomManager tm = (TelecomManager) ctx.getSystemService(Context.TELECOM_SERVICE);
                dialer = tm != null && tm.getDefaultDialerPackage() != null ? tm.getDefaultDialerPackage() : "";
            } catch (Exception e) {
                home = ""; dialer = "";
            }
        }
        return pkg.equals(home) || pkg.equals(dialer);
    }

    /** "challenge", "schedule", "limit" or null. */
    static String reason(Context ctx, String pkg) {
        if (essential(ctx, pkg)) return null;
        if (challengeActive(ctx)) return "challenge";
        if (inSchedule(ctx, pkg)) return "schedule";
        if (overLimit(ctx, pkg)) return "limit";
        return null;
    }

    static boolean challengeActive(Context ctx) {
        JSONArray ch = Config.array(ctx, "ch");
        long now = System.currentTimeMillis();
        for (int i = 0; i < ch.length(); i++) {
            JSONObject o = ch.optJSONObject(i);
            if (o != null && "run".equals(o.optString("st")) && o.optLong("end") > now) return true;
        }
        return false;
    }

    private static int toMin(String t) {
        try {
            String[] p = t.split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (Exception e) {
            return 0;
        }
    }

    private static boolean has(JSONArray a, String s) {
        for (int i = 0; i < a.length(); i++) if (s.equals(a.optString(i))) return true;
        return false;
    }

    static boolean inSchedule(Context ctx, String pkg) {
        JSONArray sc = Config.array(ctx, "sched");
        Calendar c = Calendar.getInstance();
        int dow = c.get(Calendar.DAY_OF_WEEK) - 1;               // 0 = Sunday, the same order the app uses
        int min = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
        for (int i = 0; i < sc.length(); i++) {
            JSONObject o = sc.optJSONObject(i);
            if (o == null || !o.optBoolean("on") || !has(o.optJSONArray("apps") == null ? new JSONArray() : o.optJSONArray("apps"), pkg)) continue;
            JSONArray days = o.optJSONArray("days");
            if (days == null) continue;
            if (o.optBoolean("all")) { if (days.optInt(dow, 0) == 1) return true; continue; }
            int a = toMin(o.optString("start", "00:00")), b = toMin(o.optString("end", "00:00"));
            if (a == b) continue;
            if (a < b) { if (days.optInt(dow, 0) == 1 && min >= a && min < b) return true; }
            else if (min >= a) { if (days.optInt(dow, 0) == 1) return true; }          // evening part of an overnight lock
            else if (min < b) { if (days.optInt((dow + 6) % 7, 0) == 1) return true; } // after midnight: belongs to the day before
        }
        return false;
    }

    static JSONObject limitFor(Context ctx, String pkg) {
        JSONArray l = Config.array(ctx, "limits");
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.optJSONObject(i);
            if (o != null && o.optBoolean("on") && "app".equals(o.optString("kind")) && pkg.equals(o.optString("app"))) return o;
        }
        return null;
    }

    static boolean overLimit(Context ctx, String pkg) {
        JSONObject l = limitFor(ctx, pkg);
        return l != null && UsageMath.todayMs(ctx, pkg) >= l.optLong("min") * 60000L;
    }

    static boolean needsPause(Context ctx, String pkg) {
        return Config.flag(ctx, "pause") && limitFor(ctx, pkg) != null && !essential(ctx, pkg);
    }

    /** Time on a site is stored under the name of its limit (youtube.com), or under the plain host when there is no limit. */
    static String siteKey(Context ctx, String host) {
        JSONArray l = Config.array(ctx, "limits");
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.optJSONObject(i);
            if (o == null || !"site".equals(o.optString("kind"))) continue;
            String s = o.optString("site");
            if (!s.isEmpty() && (host.equals(s) || host.endsWith("." + s))) return s;
        }
        return host;
    }

    /** A website that is blocked outright, or whose daily limit is used up. Returns the rule's site name or null. */
    static String blockedSite(Context ctx, String host) {
        if (host == null) return null;
        JSONArray sites = Config.array(ctx, "sites");
        for (int i = 0; i < sites.length(); i++) {
            String s = sites.optString(i);
            if (!s.isEmpty() && (host.equals(s) || host.endsWith("." + s))) return s;
        }
        JSONArray l = Config.array(ctx, "limits");
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.optJSONObject(i);
            if (o == null || !o.optBoolean("on") || !"site".equals(o.optString("kind"))) continue;
            String s = o.optString("site");
            if (!s.isEmpty() && (host.equals(s) || host.endsWith("." + s))
                    && Store.get(ctx).siteMinutesOf(UsageMath.todayKey(), s) >= o.optLong("min")) return s;
        }
        return null;
    }
}
