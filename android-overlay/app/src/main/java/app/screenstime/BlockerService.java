package app.screenstime;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;

/**
 * Watches which app is in front (it sees window changes, not what you type) and, when the person's rules say so:
 *   - blocks the app (time limit, locked hours, detox challenge) with a full-screen message,
 *   - shows a short countdown before an app that has a limit,
 *   - leaves a Shorts / Reels feed, a blocked website, or a page with a blocked word,
 *   - adds up the time spent on websites,
 *   - records page/content titles for timeline breakdown (what was open).
 */
public class BlockerService extends AccessibilityService {
    private String lastPkg = "", lastHost = "";
    private long lastScan = 0, lastAction = 0, lastSiteTs = 0;
    private final Map<String, Long> allowedUntil = new HashMap<>();   // app -> pause bypass expiry
    private Set<String> browsers = new HashSet<>();
    private long browsersAt = 0;

    private String lastRecordedPkg = "", lastRecordedTitle = "";
    private long lastPageScan = 0, lastRecordTime = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent ev) {
        try {
            if (ev == null || ev.getPackageName() == null) return;
            String pkg = ev.getPackageName().toString();
            if (pkg.equals(getPackageName())) { return; }
            int type = ev.getEventType();
            if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                onWindow(pkg);
                inspectPage(pkg, ev);
            } else if (type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
                onContent(pkg);
                inspectPage(pkg, null);
            }
        } catch (Throwable ignored) { /* never crash */ }
    }

    @Override public void onInterrupt() { OverlayView.dismiss(this); }

    private boolean isBrowser(String pkg) {
        long now = System.currentTimeMillis();
        if (browsers.isEmpty() || now - browsersAt > 10 * 60000L) { browsers = AppCatalog.browsers(getPackageManager()); browsersAt = now; }
        return browsers.contains(pkg);
    }

    private void onWindow(String pkg) {
        if (BlockPolicy.essential(this, pkg)) { lastPkg = pkg; return; }
        boolean changed = !pkg.equals(lastPkg);
        lastPkg = pkg;
        String reason = BlockPolicy.reason(this, pkg);
        if (reason != null) { blockApp(pkg, reason); return; }
        if (changed && BlockPolicy.needsPause(this, pkg)) {
            Long until = allowedUntil.get(pkg);
            if (until == null || until < System.currentTimeMillis()) pauseApp(pkg);
        }
    }

    private void blockApp(String pkg, String reason) {
        if (OverlayView.showing()) return;
        String name = AppCatalog.label(this, pkg);
        String title = name + " was blocked";
        String line = reason.equals("limit") ? "Your time for today is up."
                : reason.equals("schedule") ? "It is locked at this time of day."
                : "A detox challenge is running. Apps are locked until it ends.";
        goHome();
        OverlayView.blocked(this, title, line, Config.blockStyle(this));
    }

    private void pauseApp(final String pkg) {
        if (OverlayView.showing()) return;
        OverlayView.pause(this, AppCatalog.label(this, pkg), Config.pauseSeconds(this),
                () -> { Store.get(this).addPauseDeclined(System.currentTimeMillis()); goHome(); },
                () -> allowedUntil.put(pkg, System.currentTimeMillis() + 10 * 60000L));
    }

    private void goHome() {
        long now = System.currentTimeMillis();
        if (now - lastAction < 700) return;
        lastAction = now;
        performGlobalAction(GLOBAL_ACTION_HOME);
    }

    private void goBack() {
        long now = System.currentTimeMillis();
        if (now - lastAction < 1200) return;
        lastAction = now;
        performGlobalAction(GLOBAL_ACTION_BACK);
    }

    private void onContent(String pkg) {
        long now = System.currentTimeMillis();
        if (now - lastScan < 900 || OverlayView.showing() || BlockPolicy.essential(this, pkg)) return;
        boolean browser = isBrowser(pkg);
        boolean feedApp = false;
        for (String[] f : PageDetector.FEEDS) if (f[1].equals(pkg) && Config.flag(this, f[0])) feedApp = true;
        JSONArray words = Config.array(this, "keywords");
        boolean wantWords = words.length() > 0 && (browser || feedApp);
        boolean wantSites = browser;
        if (!feedApp && !wantWords && !wantSites) return;
        lastScan = now;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        try {
            if (wantSites) {
                String host = PageDetector.host(root, pkg);
                trackSite(pkg, host, now);
                String rule = BlockPolicy.blockedSite(this, host);
                if (rule != null) { goHome(); OverlayView.blocked(this, rule + " was blocked", "This website is blocked right now.", Config.blockStyle(this)); return; }
            }
            if (feedApp && PageDetector.feedOnScreen(root, pkg, this) != null) { goBack(); return; }
            if (wantWords) {
                List<String> list = new ArrayList<>();
                for (int i = 0; i < words.length(); i++) list.add(words.optString(i).toLowerCase());
                String w = PageDetector.blockedWord(root, list);
                if (w != null) { goBack(); OverlayView.blocked(this, "Blocked word", "A word you blocked is on this page.", Config.blockStyle(this)); }
            }
        } finally {
            root.recycle();
        }
    }

    /** Adds the seconds since the last look to the site that is open (never more than 10 s at a time, so idle time is not counted). */
    private void trackSite(String pkg, String host, long now) {
        if (host != null && host.equals(lastHost) && pkg.equals(lastPkg)) {
            long sec = (now - lastSiteTs) / 1000;
            if (sec > 0 && sec <= 10) Store.get(this).addSiteSeconds(UsageMath.todayKey(), BlockPolicy.siteKey(this, host), (int) sec);
        }
        lastHost = host;
        lastSiteTs = now;
    }

    /** Inspects and records page/content titles for timeline breakdown */
    private void inspectPage(String pkg, AccessibilityEvent ev) {
        long now = System.currentTimeMillis();
        if (now - lastPageScan < 700) return;
        lastPageScan = now;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        try {
            boolean browser = isBrowser(pkg);
            String title = PageDetector.detect(root, pkg, browser, ev);
            if (title != null && !title.trim().isEmpty()) {
                title = title.trim();
                if (title.length() > 70) title = title.substring(0, 70);
                if (!pkg.equals(lastRecordedPkg) || !title.equals(lastRecordedTitle) || now - lastRecordTime > 180000L) {
                    lastRecordedPkg = pkg;
                    lastRecordedTitle = title;
                    lastRecordTime = now;
                    Store.get(this).addPage(now, pkg, title);
                }
            }
        } catch (Throwable ignored) {
        } finally {
            root.recycle();
        }
    }
}
