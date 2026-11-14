package app.screenstime;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Android's own event log -> the plain list of events the web engine understands.
 * fg = an app screen came to the front, bg = it left, screenOn / screenOff / unlock / shutdown as named.
 * Music apps that keep a foreground service running are reported separately as "background".
 * Also captures notification interruptions and activity classes for timeline page titles.
 */
final class UsageReader {
    private UsageReader() {}

    static String cleanClassName(String pkg, String cls) {
        if (cls == null || cls.isEmpty() || cls.endsWith("SplashActivity") || cls.endsWith("LauncherActivity")) return null;
        int dot = cls.lastIndexOf('.');
        String simple = dot >= 0 ? cls.substring(dot + 1) : cls;
        int dollar = simple.lastIndexOf('$');
        if (dollar >= 0) simple = simple.substring(dollar + 1);
        if (simple.endsWith("Activity")) simple = simple.substring(0, simple.length() - 8);
        if (simple.isEmpty() || simple.equals("Main") || simple.equals("Home") || simple.equals("TransparentModal") || simple.equals("Hidden")) return null;

        if (simple.contains("Wifi")) return "Wi-Fi";
        if (simple.contains("Bluetooth")) return "Bluetooth";
        if (simple.contains("UsageAccess")) return "Usage Access";
        if (simple.contains("InCall")) return "Phone Call";
        if (simple.contains("Lens")) return "Google Lens";
        if (simple.contains("Clips") || simple.contains("Reel")) return "Reels";
        if (simple.contains("Conversation") || simple.contains("Chat")) return "Chat";
        if (simple.contains("Direct")) return "Direct Messages";
        if (simple.contains("Dashboard")) return "Dashboard";
        if (simple.contains("Search")) return "Search";
        if (simple.contains("Watch") || simple.contains("Video")) return "Watch";

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < simple.length(); i++) {
            char c = simple.charAt(i);
            if (i > 0 && Character.isUpperCase(c)) sb.append(' ');
            sb.append(c);
        }
        String res = sb.toString().trim();
        return res.length() > 2 ? res : null;
    }

    static JSONObject read(Context ctx, long since, long now) throws Exception {
        UsageStatsManager um = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents ue = um.queryEvents(since, now);
        Set<String> audio = AppCatalog.audioApps(ctx);
        Set<String> launchers = AppCatalog.launchers(ctx.getPackageManager());
        JSONArray events = new JSONArray(), background = new JSONArray(), notifs = new JSONArray(), pages = new JSONArray();
        Set<String> usedPackages = new HashSet<>();
        Map<String, Long> service = new HashMap<>();
        UsageEvents.Event e = new UsageEvents.Event();

        while (ue.hasNextEvent()) {
            ue.getNextEvent(e);
            int type = e.getEventType();
            long ts = e.getTimeStamp();
            String pkg = e.getPackageName();
            if (pkg == null) continue;

            if (type == 12) { // NOTIFICATION_INTERRUPTION
                if (!launchers.contains(pkg) && !pkg.equals(ctx.getPackageName())) {
                    notifs.put(new JSONObject().put("t", ts).put("app", pkg));
                }
                continue;
            }

            String kind = null;
            switch (type) {
                case 1: // ACTIVITY_RESUMED / MOVE_TO_FOREGROUND
                    kind = "fg";
                    if (!launchers.contains(pkg)) {
                        usedPackages.add(pkg);
                        String cls = e.getClassName();
                        String clean = cleanClassName(pkg, cls);
                        if (clean != null) pages.put(new JSONObject().put("t", ts).put("app", pkg).put("title", clean));
                    }
                    break;
                case 2:                                // ACTIVITY_PAUSED / MOVE_TO_BACKGROUND
                case 23:                               // ACTIVITY_STOPPED
                case 24: kind = "bg"; break;           // ACTIVITY_DESTROYED
                case 15: kind = "screenOn"; break;     // SCREEN_INTERACTIVE
                case 16:                               // SCREEN_NON_INTERACTIVE
                case 17: kind = "screenOff"; break;    // KEYGUARD_SHOWN
                case 18: kind = "unlock"; break;       // KEYGUARD_HIDDEN
                case 26: kind = "shutdown"; break;     // DEVICE_SHUTDOWN
                case 19:                               // FOREGROUND_SERVICE_START
                    if (audio.contains(pkg)) service.put(pkg, ts);
                    break;
                case 20: {                             // FOREGROUND_SERVICE_STOP
                    Long s = service.remove(pkg);
                    if (s != null && ts - s >= 60000) background.put(new JSONObject().put("app", pkg).put("s", (long) s).put("e", ts));
                    break;
                }
                default: break;
            }
            if (kind == null) continue;
            JSONObject o = new JSONObject().put("t", ts).put("k", kind);
            if (kind.equals("fg") || kind.equals("bg")) o.put("app", pkg);
            events.put(o);
        }
        for (Map.Entry<String, Long> en : service.entrySet())
            if (now - en.getValue() >= 60000) background.put(new JSONObject().put("app", en.getKey()).put("s", (long) en.getValue()).put("e", now));

        JSONArray usedArray = new JSONArray();
        for (String p : usedPackages) usedArray.put(p);

        return new JSONObject()
                .put("events", events)
                .put("background", background)
                .put("notifications", notifs)
                .put("pages", pages)
                .put("usedPackages", usedArray);
    }
}
