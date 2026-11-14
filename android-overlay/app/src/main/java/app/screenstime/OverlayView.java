package app.screenstime;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** The two full-screen messages: "time is up" and "wait a moment". Plain Android views, drawn over the app by the accessibility service. */
final class OverlayView {
    private OverlayView() {}

    interface Action { void run(); }

    private static View current;
    private static final Handler UI = new Handler(Looper.getMainLooper());
    private static final int NAVY = Color.parseColor("#10162B"), CREAM = Color.parseColor("#FFF6EE"), SOFT = Color.parseColor("#C9CFE3"), CORAL = Color.parseColor("#FFB38A");

    static boolean showing() { return current != null; }

    static void dismiss(Context ctx) {
        View v = current;
        current = null;
        if (v == null) return;
        try { ((WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE)).removeView(v); } catch (Exception ignored) { }
    }

    private static int dp(Context c, int v) { return Math.round(v * c.getResources().getDisplayMetrics().density); }

    private static TextView text(Context c, String s, int sp, int color, boolean bold) {
        TextView t = new TextView(c);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color); t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, dp(c, 6), 0, dp(c, 6));
        return t;
    }

    private static Button button(Context c, String s, boolean primary) {
        Button b = new Button(c);
        b.setText(s); b.setAllCaps(false); b.setTextSize(16); b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(primary ? NAVY : CREAM);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(c, 28)); g.setColor(primary ? CREAM : Color.parseColor("#2C3862"));
        b.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(c, 52));
        lp.topMargin = dp(c, 12);
        b.setLayoutParams(lp);
        return b;
    }

    private static LinearLayout frame(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setGravity(Gravity.CENTER);
        l.setBackgroundColor(NAVY);
        l.setPadding(dp(c, 32), dp(c, 32), dp(c, 32), dp(c, 32));
        l.setClickable(true);                       // swallow touches so the app underneath cannot be used
        return l;
    }

    private static void add(Context ctx, View v) {
        dismiss(ctx);
        WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.OPAQUE);
        try {
            wm.addView(v, p);
            current = v;
        } catch (Exception ignored) { current = null; }
    }

    /** style = the person's choice in the app: minimal | gif (hourglass) | quote */
    static void blocked(final Context ctx, String title, String line, String style) {
        LinearLayout l = frame(ctx);
        l.addView(text(ctx, "Screens Time", 13, CORAL, true));
        if ("gif".equals(style)) l.addView(text(ctx, "⌛", 64, CREAM, false));
        l.addView(text(ctx, title, 26, CREAM, true));
        if ("quote".equals(style)) l.addView(text(ctx, "Small breaks, taken on purpose, give you the afternoon back.", 17, SOFT, false));
        l.addView(text(ctx, line, 15, SOFT, false));
        Button ok = button(ctx, "OK", true);
        ok.setOnClickListener(v -> dismiss(ctx));
        l.addView(ok);
        add(ctx, l);
        UI.postDelayed(() -> { if (current == l) dismiss(ctx); }, 8000);
    }

    /** A countdown before an app with a limit opens. "Continue" unlocks when it reaches zero. */
    static void pause(final Context ctx, String appName, final int seconds, final Action decline, final Action proceed) {
        final LinearLayout l = frame(ctx);
        l.addView(text(ctx, "Screens Time", 13, CORAL, true));
        final TextView count = text(ctx, String.valueOf(seconds), 64, CREAM, true);
        l.addView(count);
        l.addView(text(ctx, "Pause before you open " + appName, 22, CREAM, true));
        l.addView(text(ctx, "Take a breath. Do you still want it?", 15, SOFT, false));
        Button no = button(ctx, "I don't want to open it", true);
        final Button go = button(ctx, "Continue", false);
        go.setEnabled(false); go.setAlpha(0.45f);
        no.setOnClickListener(v -> { dismiss(ctx); decline.run(); });
        go.setOnClickListener(v -> { dismiss(ctx); proceed.run(); });
        l.addView(no); l.addView(go);
        add(ctx, l);
        final int[] left = {seconds};
        Runnable tick = new Runnable() {
            @Override public void run() {
                if (current != l) return;
                left[0]--;
                if (left[0] <= 0) { count.setText("ok"); go.setEnabled(true); go.setAlpha(1f); }
                else { count.setText(String.valueOf(left[0])); UI.postDelayed(this, 1000); }
            }
        };
        UI.postDelayed(tick, 1000);
    }
}
