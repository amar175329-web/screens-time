package app.screenstime;

import android.content.Context;
import android.os.Build;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.List;
import java.util.Locale;

/**
 * Reads what is open on screen:
 * - Browser: website host name (e.g. wikipedia.org, github.com)
 * - YouTube: "Shorts" or the video title being watched
 * - Instagram: "Reels", "Profile", "Messages", "Stories", "Home Feed"
 * - WhatsApp: contact/group name
 * - Other apps: active window or screen title
 */
final class PageDetector {
    private PageDetector() {}

    /** flag name in the settings -> { app package, view ids that exist only while that feed is on screen } */
    static final String[][] FEEDS = {
            {"shorts", "com.google.android.youtube", "com.google.android.youtube:id/reel_recycler", "com.google.android.youtube:id/reel_player_page_container"},
            {"igreels", "com.instagram.android", "com.instagram.android:id/clips_viewer_view_pager", "com.instagram.android:id/clips_swipe_refresh_container"}
    };

    static boolean hasId(AccessibilityNodeInfo root, String id) {
        if (root == null) return false;
        try {
            List<AccessibilityNodeInfo> l = root.findAccessibilityNodeInfosByViewId(id);
            return l != null && !l.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    /** The settings flag of the feed that is on screen, or null. */
    static String feedOnScreen(AccessibilityNodeInfo root, String pkg, Context ctx) {
        for (String[] f : FEEDS) {
            if (!f[1].equals(pkg) || !Config.flag(ctx, f[0])) continue;
            for (int i = 2; i < f.length; i++) if (hasId(root, f[i])) return f[0];
        }
        return null;
    }

    static String host(AccessibilityNodeInfo root, String pkg) {
        if (root == null) return null;
        String[] ids = {
                pkg + ":id/url_bar", pkg + ":id/mozac_browser_toolbar_url_view",
                pkg + ":id/url_field", pkg + ":id/location_bar_edit_text",
                pkg + ":id/search_box_text", "org.chromium.chrome:id/url_bar"
        };
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
        if (s == null) return null;
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

    /** Looks through the visible text for one of the blocked words. */
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

    /* ---- Detect current page title / action inside an app ---- */

    static String detectYouTube(AccessibilityNodeInfo root) {
        if (root == null) return null;
        if (hasId(root, "com.google.android.youtube:id/reel_recycler") ||
                hasId(root, "com.google.android.youtube:id/reel_player_page_container") ||
                hasId(root, "com.google.android.youtube:id/shorts_container")) {
            return "Shorts";
        }
        String[] titleIds = {
                "com.google.android.youtube:id/video_title",
                "com.google.android.youtube:id/title",
                "com.google.android.youtube:id/player_video_title_view"
        };
        for (String id : titleIds) {
            try {
                List<AccessibilityNodeInfo> l = root.findAccessibilityNodeInfosByViewId(id);
                if (l != null && !l.isEmpty()) {
                    for (AccessibilityNodeInfo n : l) {
                        CharSequence t = n.getText();
                        if (t != null && t.length() > 2) {
                            String title = t.toString().trim();
                            if (!title.equalsIgnoreCase("YouTube") && !title.equalsIgnoreCase("Shorts")) return title;
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    static String detectInstagram(AccessibilityNodeInfo root) {
        if (root == null) return null;
        if (hasId(root, "com.instagram.android:id/clips_viewer_view_pager") ||
                hasId(root, "com.instagram.android:id/clips_swipe_refresh_container") ||
                hasId(root, "com.instagram.android:id/reel_viewer_image_view")) {
            return "Reels";
        }
        if (hasId(root, "com.instagram.android:id/row_profile_header") ||
                hasId(root, "com.instagram.android:id/profile_header_bio_text")) {
            return "Profile";
        }
        if (hasId(root, "com.instagram.android:id/direct_thread_layout") ||
                hasId(root, "com.instagram.android:id/row_thread_title")) {
            return "Direct Messages";
        }
        if (hasId(root, "com.instagram.android:id/reel_viewer_root")) {
            return "Stories";
        }
        return "Home Feed";
    }

    static String detect(AccessibilityNodeInfo root, String pkg, boolean browser, AccessibilityEvent ev) {
        if (pkg == null) return null;
        if (browser && root != null) {
            String h = host(root, pkg);
            if (h != null) return h;
        }
        if ("com.google.android.youtube".equals(pkg) && root != null) {
            String yt = detectYouTube(root);
            if (yt != null) return yt;
        }
        if ("com.instagram.android".equals(pkg) && root != null) {
            String ig = detectInstagram(root);
            if (ig != null) return ig;
        }
        if (ev != null) {
            List<CharSequence> texts = ev.getText();
            if (texts != null) {
                for (CharSequence cs : texts) {
                    if (cs != null && cs.length() > 1 && cs.length() <= 50) {
                        String s = cs.toString().trim();
                        if (!s.isEmpty() && !s.equalsIgnoreCase(pkg)) return s;
                    }
                }
            }
        }
        if (root != null) {
            if (Build.VERSION.SDK_INT >= 28) {
                CharSequence winTitle = root.getTitle();
                if (winTitle != null && winTitle.length() > 1 && winTitle.length() <= 50) {
                    String s = winTitle.toString().trim();
                    if (!s.isEmpty() && !s.equalsIgnoreCase(pkg)) return s;
                }
            }
            String[] commonHeaderIds = {
                    pkg + ":id/action_bar_title",
                    pkg + ":id/toolbar_title",
                    pkg + ":id/title",
                    pkg + ":id/conversation_contact_name",
                    "android:id/action_bar_title",
                    "android:id/title"
            };
            for (String hid : commonHeaderIds) {
                try {
                    List<AccessibilityNodeInfo> l = root.findAccessibilityNodeInfosByViewId(hid);
                    if (l != null && !l.isEmpty()) {
                        for (AccessibilityNodeInfo n : l) {
                            CharSequence t = n.getText();
                            if (t != null && t.length() > 1 && t.length() <= 50) {
                                String s = t.toString().trim();
                                if (!s.isEmpty() && !s.equalsIgnoreCase(pkg)) return s;
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }
        }
        return null;
    }
}
