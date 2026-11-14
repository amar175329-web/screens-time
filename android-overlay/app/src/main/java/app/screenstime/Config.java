package app.screenstime;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The person's settings (limits, schedules, blocked words ...). The web app owns them and writes the whole JSON here,
 * so the background services can read the same numbers while the app is closed. See docs/DATA_CONTRACT.md.
 */
final class Config {
    private static final String PREFS = "screenstime", KEY = "cfg";
    private static volatile JSONObject cache;

    private Config() {}

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static String raw(Context c) { return prefs(c).getString(KEY, ""); }

    static void save(Context c, String json) {
        prefs(c).edit().putString(KEY, json).apply();
        cache = null;
    }

    static JSONObject get(Context c) {
        JSONObject j = cache;
        if (j != null) return j;
        try {
            String s = raw(c);
            j = s.isEmpty() ? new JSONObject() : new JSONObject(s);
        } catch (Exception e) {
            j = new JSONObject();
        }
        cache = j;
        return j;
    }

    static JSONArray array(Context c, String key) {
        JSONArray a = get(c).optJSONArray(key);
        return a == null ? new JSONArray() : a;
    }

    static boolean flag(Context c, String key) {
        JSONObject f = get(c).optJSONObject("flags");
        return f != null && f.optBoolean(key, false);
    }

    static boolean muted(Context c, String pkg) {
        JSONObject m = get(c).optJSONObject("muted");
        return m != null && m.optBoolean(pkg, false);
    }

    static int pauseSeconds(Context c) { return Math.max(3, Math.min(30, get(c).optInt("pauseSec", 5))); }

    static String blockStyle(Context c) { return get(c).optString("bstyle", "minimal"); }
}
