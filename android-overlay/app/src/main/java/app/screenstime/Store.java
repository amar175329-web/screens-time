package app.screenstime;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Everything Android does not keep for us. UsageStats only remembers about a week of events, so each finished day is stored here
 * as a small record (the web app's engine computes it and hands it back through saveRollups).
 */
final class Store extends SQLiteOpenHelper {
    private static Store inst;
    private static final long DAY = 86400000L;

    static synchronized Store get(Context c) {
        if (inst == null) inst = new Store(c.getApplicationContext());
        return inst;
    }

    private Store(Context c) { super(c, "screenstime.db", null, 1); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE rollups(date TEXT PRIMARY KEY, total INTEGER, unlocks INTEGER, apps TEXT)");
        db.execSQL("CREATE TABLE known(id TEXT PRIMARY KEY, name TEXT, category TEXT)");
        db.execSQL("CREATE TABLE pages(t INTEGER, app TEXT, title TEXT)");
        db.execSQL("CREATE TABLE notifs(t INTEGER, app TEXT)");
        db.execSQL("CREATE TABLE sites(day TEXT, site TEXT, sec INTEGER, PRIMARY KEY(day, site))");
        db.execSQL("CREATE TABLE pause(t INTEGER, declined INTEGER)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int o, int n) { /* version 1 only */ }

    /* ---- finished days ---- */
    synchronized void saveRollups(JSONArray days) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            for (int i = 0; i < days.length(); i++) {
                JSONObject d = days.getJSONObject(i);
                ContentValues v = new ContentValues();
                v.put("date", d.getString("date"));
                v.put("total", d.optInt("total"));
                v.put("unlocks", d.optInt("unlocks"));
                v.put("apps", String.valueOf(d.optJSONObject("apps")));
                db.insertWithOnConflict("rollups", null, v, SQLiteDatabase.CONFLICT_REPLACE);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    synchronized JSONArray history() throws Exception {
        JSONArray out = new JSONArray();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT date,total,unlocks,apps FROM rollups ORDER BY date", null)) {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("date", c.getString(0)).put("total", c.getInt(1)).put("unlocks", c.getInt(2));
                String a = c.getString(3);
                o.put("apps", a == null || a.equals("null") ? new JSONObject() : new JSONObject(a));
                out.put(o);
            }
        }
        return out;
    }

    /* ---- every app ever seen, so an uninstalled app keeps its name ---- */
    synchronized void upsertKnown(JSONArray apps) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            for (int i = 0; i < apps.length(); i++) {
                JSONObject a = apps.getJSONObject(i);
                ContentValues v = new ContentValues();
                v.put("id", a.getString("id"));
                v.put("name", a.optString("name"));
                v.put("category", a.optString("category"));
                db.insertWithOnConflict("known", null, v, SQLiteDatabase.CONFLICT_REPLACE);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    synchronized JSONArray known() throws Exception {
        JSONArray out = new JSONArray();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT id,name,category FROM known", null)) {
            while (c.moveToNext()) out.put(new JSONObject().put("id", c.getString(0)).put("name", c.getString(1)).put("category", c.getString(2)));
        }
        return out;
    }

    /* ---- page names (what was open inside an app) ---- */
    synchronized void addPage(long t, String app, String title) {
        ContentValues v = new ContentValues();
        v.put("t", t); v.put("app", app); v.put("title", title);
        getWritableDatabase().insert("pages", null, v);
    }

    synchronized JSONArray pagesSince(long since) throws Exception {
        JSONArray out = new JSONArray();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT t,app,title FROM pages WHERE t>=? ORDER BY t", new String[]{String.valueOf(since)})) {
            while (c.moveToNext()) out.put(new JSONObject().put("t", c.getLong(0)).put("app", c.getString(1)).put("title", c.getString(2)));
        }
        return out;
    }

    /* ---- notifications ---- */
    synchronized void addNotif(long t, String app) {
        ContentValues v = new ContentValues();
        v.put("t", t); v.put("app", app);
        getWritableDatabase().insert("notifs", null, v);
    }

    synchronized JSONArray notifsSince(long since) throws Exception {
        JSONArray out = new JSONArray();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT t,app FROM notifs WHERE t>=? ORDER BY t", new String[]{String.valueOf(since)})) {
            while (c.moveToNext()) out.put(new JSONObject().put("t", c.getLong(0)).put("app", c.getString(1)));
        }
        return out;
    }

    /* ---- website time (browsers only, needs the accessibility permission) ---- */
    synchronized void addSiteSeconds(String day, String site, int sec) {
        SQLiteDatabase db = getWritableDatabase();
        db.execSQL("INSERT OR IGNORE INTO sites(day,site,sec) VALUES(?,?,0)", new Object[]{day, site});
        db.execSQL("UPDATE sites SET sec=sec+? WHERE day=? AND site=?", new Object[]{sec, day, site});
    }

    synchronized JSONObject siteMinutes(String day) throws Exception {
        JSONObject out = new JSONObject();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT site,sec FROM sites WHERE day=?", new String[]{day})) {
            while (c.moveToNext()) out.put(c.getString(0), c.getInt(1) / 60.0);
        }
        return out;
    }

    synchronized double siteMinutesOf(String day, String site) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT sec FROM sites WHERE day=? AND site=?", new String[]{day, site})) {
            return c.moveToFirst() ? c.getInt(0) / 60.0 : 0;
        }
    }

    /* ---- "I did not open it" counter for the pause screen ---- */
    synchronized void addPauseDeclined(long t) {
        ContentValues v = new ContentValues();
        v.put("t", t); v.put("declined", 1);
        getWritableDatabase().insert("pause", null, v);
    }

    synchronized int pauseDeclinedSince(long since) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM pause WHERE t>=?", new String[]{String.valueOf(since)})) {
            return c.moveToFirst() ? c.getInt(0) : 0;
        }
    }

    /* keep the small tables small */
    synchronized void prune(long now) {
        SQLiteDatabase db = getWritableDatabase();
        String old = String.valueOf(now - 35 * DAY);
        db.execSQL("DELETE FROM pages WHERE t<?", new Object[]{old});
        db.execSQL("DELETE FROM notifs WHERE t<?", new Object[]{old});
        db.execSQL("DELETE FROM pause WHERE t<?", new Object[]{old});
    }
}
