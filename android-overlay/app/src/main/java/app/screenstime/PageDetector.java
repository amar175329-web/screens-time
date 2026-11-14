package app.screenstime;

import android.view.accessibility.AccessibilityNodeInfo;
import java.util.List;
import java.util.Locale;

/**
 * Reads only what is needed from the screen: the address bar of a browser, whether a Shorts / Reels feed is open,
 * and (when the person added blocked words) whether such a word is on screen. Nothing is stored except a site name.
 *
 * Feed detection uses the view ids the apps use today. An app update can rename them; see docs/ANDROID.md "Feed rules".
 */
final class PageDetector {
    private PageDetector() {}

    /** flag name in the settings -> { app package, view ids that exist only while that feed is on screen } */
    static final String[][] FEEDS = {
            {"shorts", "com.google.android.youtube", "com.google.android.youtube:id/reel_recycler", "com.google.android.youtube:id/reel_player_page_container"},
            {"igreels", "com.instagram.android", "com.instagram.android:id/clips_viewer_view_pager", "com.instagram.android:id/clips_swipe_refresh_container"}
    };

    static boolean hasId(AccessibilityNodeInfo root, String id) {
        try {
            List<AccessibilityNodeInfo> l = root.findAccessibilityNodeInfosByViewId(id);
            return l != null && !l.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    /** The settings flag of the feed that is on screen, or null. */
    static String feedOnScreen(AccessibilityNodeInfo root, String pkg, android.content.Context ctx) {
        for (String[] f : FEEDS) {
            if (!f[1].equals(pkg) || !Config.flag(ctx, f[0])) continue;
            for (int i = 2; i < f.length; i++) if (hasId(root, f[i])) return f[0];
        }
        return null;
    }

    static String host(AccessibilityNodeInfo root, String pkg) {
        String[] ids = {pkg + ":id/url_bar", pkg + ":id/mozac_browser_toolbar_url_view", pkg + ":id/url_field", pkg + ":id/location_bar_edit_text", pkg + ":id/search_box_text"};
        for (String id : ids) {
            try {
                List<AccessibilityNodeInfo> l = root.findAccessibilityNodeInfosByViewId(id);
                if (l == null) continue;
                for (AccessibilityNodeInfo n : l) {
                    CharSequence t = n.getText();
                    String h = t == null ? null : hostOf(t.toString());
                    if (h != null) return h;
                }
            } catch (Exception ignored) { }
        }
        return null;
    }

    static String hostOf(String s) {
        s = s.trim().toLowerCase(Locale.US);
        if (s.isEmpty() || s.contains(" ")) return null;
        s = s.replaceFirst("^[a-z]+://", "");
        int cut = s.length();
        for (char c : new char[]{'/', '?', '#'}) { int k = s.indexOf(c); if (k >= 0 && k < cut) cut = k; }
        s = s.substring(0, cut);
        if (s.startsWith("www.")) s = s.substring(4);
        if (s.startsWith("m.")) s = s.substring(2);
        return s.contains(".") ? s : null;
    }

    /** Looks through the visible text for one of the blocked words (at most ~400 views, so it stays fast). */
    static String blockedWord(AccessibilityNodeInfo root, List<String> words) {
        int[] budget = {400};
        return scan(root, words, budget);
    }

    private static String scan(AccessibilityNodeInfo n, List<String> words, int[] budget) {
        if (n == null || budget[0]-- <= 0) return null;
        CharSequence t = n.getText(), d = n.getContentDescription();
        String s = ((t == null ? "" : t.toString()) + " " + (d == null ? "" : d.toString())).toLowerCase(Locale.US);
        if (s.length() > 1) for (String w : words) if (!w.isEmpty() && s.contains(w)) return w;
        for (int i = 0; i < n.getChildCount(); i++) {
            AccessibilityNodeInfo c = n.getChild(i);
            String r = scan(c, words, budget);
            if (c != null) c.recycle();
            if (r != null) return r;
        }
        return null;
    }
}
