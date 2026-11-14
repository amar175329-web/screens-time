package app.screenstime;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import java.util.Calendar;

/** Quick "how long has this app been open today" for the blocker. Same rule as the engine: resumed -> paused. */
final class UsageMath {
    private UsageMath() {}

    static long startOfToday() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    static String todayKey() {
        Calendar c = Calendar.getInstance();
        return String.format(java.util.Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static String cachePkg = ""; private static long cacheAt = 0, cacheVal = 0;

    static synchronized long todayMs(Context ctx, String pkg) {
        long now = System.currentTimeMillis();
        if (pkg.equals(cachePkg) && now - cacheAt < 4000) return cacheVal + (now - cacheAt);
        long total = 0, openSince = -1;
        try {
            UsageStatsManager um = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
            UsageEvents ue = um.queryEvents(startOfToday() - 4 * 3600000L, now);
            UsageEvents.Event e = new UsageEvents.Event();
            long start = startOfToday();
            while (ue.hasNextEvent()) {
                ue.getNextEvent(e);
                if (!pkg.equals(e.getPackageName())) continue;
                int t = e.getEventType();
                if (t == 1) { if (openSince < 0) openSince = Math.max(e.getTimeStamp(), start); }
                else if (t == 2 && openSince >= 0) { total += Math.max(0, e.getTimeStamp() - openSince); openSince = -1; }
            }
            if (openSince >= 0) total += Math.min(now - openSince, 4 * 3600000L);
        } catch (Exception ignored) { }
        cachePkg = pkg; cacheAt = now; cacheVal = total;
        return total;
    }
}
