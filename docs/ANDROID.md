# Android: build, install, permissions

## 1. Build

Push to GitHub. The workflow `.github/workflows/android.yml` builds a debug-signed APK and publishes it at
**Releases -> latest -> screens-time.apk** (also available as a workflow artifact).
Locally: `npm install && npm run android:apk` (JDK 21 and the Android SDK are needed). The APK ends up in
`android/app/build/outputs/apk/debug/app-debug.apk`.

## 2. Install

1. Download `screens-time.apk` on the phone and open it. Allow "Install unknown apps" for the browser when asked.
2. Open **Screens Time**.

## 3. Permissions (in this order)

| Permission | What it gives | Where |
|---|---|---|
| **Usage access** (needed) | Which app was open and for how long. Without it the app shows an explanation screen. | Opens from the app: Settings -> Special access -> Usage access -> Screens Time |
| **Accessibility** | Blocks apps when time is up, countdown before an app, hides Shorts / Reels, blocked words and sites, time on websites. | Settings -> Accessibility -> Screens Time |
| **Notification access** (optional) | Counts notifications and mutes the ones you choose. | Settings -> Notifications -> Device and app notifications |

### "Restricted setting" (Android 13 and newer)
An app installed from an APK file cannot be given Accessibility or Notification access until you allow it:
**Settings -> Apps -> Screens Time -> three dots (top right) -> Allow restricted settings.**
The app has a button (Settings -> Permissions -> Open App info) that goes straight to that screen.

### Keep it running
Some phones stop background services to save battery (Xiaomi, Oppo, Vivo, Samsung "sleeping apps").
Set **Battery -> Unrestricted** for Screens Time, and on Xiaomi / Oppo also allow auto-start.

## 4. What is real and what is best effort

- **Usage totals, unlocks, hourly chart, per-app history**: Android UsageStats events through the same engine as the demo. Android keeps events for only about 7-10 days, so finished days are summed up and stored in the app's own SQLite database.
- **Blocking (limits, schedules, challenge)**: the accessibility service sees the app that comes to the front and draws a full-screen message.
- **Hide Shorts / Reels**: detected through the apps' view ids (`reel_recycler`, `clips_viewer_view_pager`, ...). These follow how YouTube and Instagram are built today; an app update can rename them. Update `PageDetector.FEEDS` when that happens. Other feeds are shown as "Soon" in the app.
- **Websites**: the address bar text of common browsers (Chrome, Firefox, Samsung Internet, Edge, Brave, Opera ...). Only the site name is kept.
- **Not done yet**: the app is debug-signed, there is no Play Store listing, and no widget.

## 5. If something does not work

| Problem | Fix |
|---|---|
| Numbers stay empty | Usage access not given, or the phone has just been set up (Android has no data yet). |
| "Restricted setting" greys out the switch | See above. |
| Block screen never shows | Accessibility is off, or the battery saver killed the service. |
| Icons are grey | They load once after the first refresh (Settings -> Refresh now). |
