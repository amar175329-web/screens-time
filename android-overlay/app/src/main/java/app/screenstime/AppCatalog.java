package app.screenstime;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Installed apps: name, category and the app's own icon, straight from Android. Nothing here is drawn or guessed by us. */
final class AppCatalog {
    private AppCatalog() {}

    private static final Map<String, String> KNOWN = new HashMap<>();
    static {
        for (String p : new String[]{"com.whatsapp", "org.telegram.messenger", "com.instagram.android", "com.facebook.katana", "com.facebook.orca",
                "com.snapchat.android", "com.twitter.android", "com.reddit.frontpage", "com.linkedin.android", "com.pinterest", "com.discord"}) KNOWN.put(p, "Social");
        for (String p : new String[]{"com.google.android.youtube", "com.netflix.mediaclient", "in.startv.hotstar", "com.amazon.avod.thirdpartyclient", "tv.twitch.android.app"}) KNOWN.put(p, "Video");
        for (String p : new String[]{"com.spotify.music", "com.google.android.apps.youtube.music", "com.jio.media.jiobeats", "com.gaana"}) KNOWN.put(p, "Music");
        for (String p : new String[]{"com.google.android.gm", "com.microsoft.office.outlook", "com.google.android.apps.docs", "com.slack", "com.notion.id", "com.anthropic.claude"}) KNOWN.put(p, "Productivity");
    }

    static Set<String> browsers(PackageManager pm) {
        Set<String> out = new HashSet<>();
        Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com")).addCategory(Intent.CATEGORY_BROWSABLE);
        List<ResolveInfo> ris = pm.queryIntentActivities(view, PackageManager.MATCH_ALL);
        for (ResolveInfo ri : ris) out.add(ri.activityInfo.packageName);
        return out;
    }

    private static String category(ApplicationInfo a, boolean browser) {
        if (browser) return "Browser";
        String k = KNOWN.get(a.packageName);
        if (k != null) return k;
        boolean system = (a.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
        if (Build.VERSION.SDK_INT >= 26) {
            switch (a.category) {
                case ApplicationInfo.CATEGORY_GAME: return "Games";
                case ApplicationInfo.CATEGORY_AUDIO: return "Music";
                case ApplicationInfo.CATEGORY_VIDEO: return "Video";
                case ApplicationInfo.CATEGORY_IMAGE: return "Photos";
                case ApplicationInfo.CATEGORY_SOCIAL: return "Social";
                case ApplicationInfo.CATEGORY_NEWS: return "News";
                case ApplicationInfo.CATEGORY_MAPS: return "Maps";
                case ApplicationInfo.CATEGORY_PRODUCTIVITY: return "Productivity";
                default: break;
            }
        }
        return system ? "System" : "Other";
    }

    /** Every app that has a launcher icon. */
    static JSONArray list(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        Map<String, JSONObject> out = new LinkedHashMap<>();
        try {
            Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            Set<String> browsers = browsers(pm);
            for (ResolveInfo ri : pm.queryIntentActivities(main, 0)) {
                ActivityInfo ai = ri.activityInfo;
                String pkg = ai.packageName;
                if (pkg.equals(ctx.getPackageName()) || out.containsKey(pkg)) continue;
                ApplicationInfo a = ai.applicationInfo;
                boolean system = (a.flags & ApplicationInfo.FLAG_SYSTEM) != 0 && (a.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0;
                JSONObject o = new JSONObject();
                o.put("id", pkg);
                o.put("name", String.valueOf(ri.loadLabel(pm)));
                o.put("category", category(a, browsers.contains(pkg)));
                o.put("system", system);
                out.put(pkg, o);
            }
        } catch (Exception ignored) { /* an empty list is shown, the rest of the app still works */ }
        JSONArray arr = new JSONArray();
        for (JSONObject o : out.values()) arr.put(o);
        return arr;
    }

    /** Apps that are music players: their foreground services count as "playing with the screen off". */
    static Set<String> audioApps(Context ctx) {
        Set<String> out = new HashSet<>();
        PackageManager pm = ctx.getPackageManager();
        try {
            JSONArray l = list(ctx);
            for (int i = 0; i < l.length(); i++) if ("Music".equals(l.getJSONObject(i).optString("category"))) out.add(l.getJSONObject(i).getString("id"));
        } catch (Exception ignored) { }
        return out;
    }

    /** The app's own icon as a small PNG (data URI). */
    static String icon(Context ctx, String pkg) {
        try {
            Drawable d = ctx.getPackageManager().getApplicationIcon(pkg);
            int size = 96;
            Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(b);
            d.setBounds(0, 0, size, size);
            d.draw(c);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.PNG, 100, bos);
            b.recycle();
            return "data:image/png;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    static String label(Context ctx, String pkg) {
        try {
            PackageManager pm = ctx.getPackageManager();
            return String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)));
        } catch (Exception e) {
            return pkg;
        }
    }
}
