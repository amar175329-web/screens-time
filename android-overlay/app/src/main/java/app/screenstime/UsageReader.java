package app.screenstime;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Android's own event log -> the plain list of events the web engine understands.
 * fg = an app screen came to the front, bg = it left, screenOn / screenOff / unlock / shutdown as named.
 * Music apps that keep a foreground service running are reported separately as "background".
 */
final class UsageReader {
    private UsageReader() {}

    static JSONObject read(Context ctx, long since, long now) throws Exception {
        UsageStatsManager um = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents ue = um.queryEvents(since, now);
        Set<String> audio = AppCatalog.audioApps(ctx);
        JSONArray events = new JSONArray(), background = new JSONArray();
        Map<String, Long> service = new HashMap<>();
        UsageEvents.Event e = new UsageEvents.Event();
        while (ue.hasNextEvent()) {
            ue.getNextEvent(e);
            int type = e.getEventType();
            long ts = e.getTimeStamp();
            String pkg = e.getPackageName();
            String kind = null;
            switch (type) {
                case 1: kind = "fg"; break;            // ACTIVITY_RESUMED / MOVE_TO_FOREGROUND
                case 2: kind = "bg"; break;            // ACTIVITY_PAUSED / MOVE_TO_BACKGROUND
                case 15: kind = "screenOn"; break;     // SCREEN_INTERACTIVE
                case 16: kind = "screenOff"; break;    // SCREEN_NON_INTERACTIVE
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
        return new JSONObject().put("events", events).put("background", background);
    }
}
