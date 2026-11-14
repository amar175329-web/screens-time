# Screens Time

A screen-time tracker that answers one question first: **"How was my day on the phone?"**
Then three clear blocks: *Where did your time go*, *When did you use it*, *Limits*.

- **Web app** (`www/`): plain HTML, CSS and JavaScript. No build step. Open `www/index.html` or deploy the folder.
- **Android app**: the same web app inside a Capacitor shell, plus native code (`android-overlay/`) that reads real usage from Android, counts notifications and blocks apps.
- **Demo mode**: in a browser the app shows a made-up day (original stand-in icons, no brand artwork). On a phone it shows the phone's own data and the real app icons.

```
www/                 the app (index.html, css/, js/, assets/)
  js/engine.js       all the maths: events in -> every number on every screen out (no DOM, unit tested)
  js/sample.js       demo data, produced as raw events and sent through the same engine
  js/data.js         picks the source: Android plugin on the phone, sample in a browser
  js/core.js         helpers, icon colours, settings store
  js/view-*.js       screens (Today / Timeline, Limits / Focus / Insights)
  js/app.js          sheets, settings, intro, start-up
android-overlay/     Java code + icons copied into the generated Android project
tools/               setup-android.mjs, fetch-fonts.mjs, build_single.py
tests/               engine unit tests, browser smoke test
docs/                DATA_CONTRACT.md, ANDROID.md
prompts/             ANTIGRAVITY_PROMPT.md (hand this to the coding agent)
```

## Run it in a browser

```bash
npx serve www           # or: python3 -m http.server -d www 8080
```

Test modes: `?data=sample` (default), `?data=stress` (70 apps, long names), `?data=empty` (new user).

## Tests

```bash
npm test                # 14 engine tests: totals add up, day rollups, unlocks, deleted apps ...
```

## Deploy the web app (Vercel)

`vercel.json` already points to `www/` with no build step: `vercel --prod`, or import the GitHub repo in Vercel.

## Build the APK

GitHub Actions does it for you: every push to `main` runs `.github/workflows/android.yml`
and publishes **Releases -> latest -> screens-time.apk**. Locally (needs JDK 21 + Android SDK):

```bash
npm install
npm run android:apk     # creates android/, copies the native code, builds the debug APK
```

Then follow `docs/ANDROID.md` to install it and give the permissions.

## Privacy

Everything stays on the phone. There is no server, no account and no analytics. The accessibility
permission is used only to see which app / page is open so it can block it; nothing is recorded except
site names and time.
