# Task for Antigravity: publish "Screens Time" (GitHub -> Vercel -> APK)

You are given a folder (the unzipped `screens-time` project). Goal, in this order:

1. put it on **GitHub** as a new repository,
2. deploy the web app on **Vercel** and give me the live URL,
3. get GitHub Actions to build the **Android APK** and give me a **download link** for it,
4. tell me exactly how to install it on my phone and what to tap.

Work step by step, run every command yourself, and show me the real output of each important command.
Do not invent results. If something fails, say so, fix it, and run it again.

## What the project is (so you do not have to guess)

- `www/` is a static web app (no build step). `www/js/engine.js` holds all the maths; `tests/engine.test.js` tests it.
- `android-overlay/` is Java code + icons. `tools/setup-android.mjs` creates the Android project with Capacitor (`npx cap add android`), copies the overlay on top and patches the manifest. `android/` is **generated** and git-ignored: never edit it, edit `android-overlay/` instead.
- `.github/workflows/android.yml` builds a debug-signed APK and publishes it as GitHub Release `latest` (`screens-time.apk`).
- `vercel.json` already says: static site, output directory `www`, no build.
- IMPORTANT: the Java code was written without an Android SDK, so it has **never been compiled**. Compile errors in the first CI run are likely. Fixing them is part of the job (step 3).

## Step 0: check the machine

Run and report versions: `git --version`, `node -v` (need 20+), `npm -v`, `gh --version`, `vercel --version` (install with `npm i -g vercel` if missing).

Check logins: `gh auth status` and `vercel whoami`.
- If one is not logged in, run `gh auth login` (GitHub.com, HTTPS, web browser) / `vercel login`, and **stop and ask me** to finish the browser step. Never ask me to paste a token into chat, and never write tokens into any file.

## Step 1: test before anything leaves the machine

```bash
cd screens-time
node --test tests/engine.test.js     # must say: pass 14, fail 0
```
If a test fails, stop and tell me; do not change the tests to make them pass.

## Step 2: GitHub

```bash
git init -b main
git add -A
git status --short | head -50        # sanity check: no node_modules, no android/, no .apk, no tokens
git commit -m "Screens Time: first version"
gh repo create screens-time --public --source=. --remote=origin --push
```
- Use `--public` (a public repo gives a plain download link for the APK). If I told you to keep it private, use `--private` and say that the APK link then needs a GitHub login.
- If the name `screens-time` is taken, use `screens-time-app` and tell me.
- Print the repo URL.

## Step 3: APK through GitHub Actions

Pushing to `main` already started the workflow "Build Android APK".

```bash
gh run list --workflow android.yml --limit 3
gh run watch            # pick the latest run; wait until it finishes
```

**If it fails** (likely the first time):
1. `gh run view <run-id> --log-failed` and read the real error.
2. Fix the cause in the source: Java compile errors -> `android-overlay/app/src/main/java/app/screenstime/*.java`; manifest problems -> `tools/setup-android.mjs`; workflow problems -> `.github/workflows/android.yml`.
3. Keep the fix **small and honest**: do not delete a feature or a permission just to get green. If a Java API differs by Android version, add a version check instead.
4. `node --test tests/engine.test.js`, then `git commit -am "fix: <what>"`, `git push`, watch again.
5. Repeat until it is green (stop after 8 tries and report the last error and what you tried).
6. Tell me, in one line each, what you changed.

**When it is green**:
```bash
gh release view latest --json assets,url --jq '.url, (.assets[] | .name + "  " + .url)'
gh release download latest -p screens-time.apk -D ./out     # keep a local copy too
```
Give me the direct download link to `screens-time.apk` and the local file path. If the Release step failed but the build passed, download the artifact with `gh run download <run-id> -n screens-time-apk -D ./out` and tell me.

## Step 4: Vercel (web app)

```bash
node tools/fetch-fonts.mjs || true     # optional: stores the font with the app. Commit www/fonts if it worked.
vercel link --yes                      # create/link a project named screens-time
vercel --prod --yes
```
Then verify, and show me the outputs:
```bash
curl -sI https://<the-url>/ | head -5                 # expect HTTP 200
curl -s https://<the-url>/ | grep -o "<title>[^<]*"   # expect: Screens Time
curl -s -o /dev/null -w "%{http_code}\n" https://<the-url>/js/engine.js    # expect 200
```
Optionally connect the project to the GitHub repo (`vercel git connect`) so every push redeploys. Print the production URL. The demo page shows sample data; add `?data=stress` or `?data=empty` to try other cases.

## Step 5: how I install it on my phone (write this out for me, in simple words)

1. Open the APK link on the phone, download, tap to install ("allow from this source" if asked).
2. Open Screens Time. The first screen asks for **Usage access**: tap Allow, switch on Screens Time, press back.
3. For blocking and hiding Reels/Shorts: **Accessibility** -> Screens Time -> on. If Android says "Restricted setting": Settings -> Apps -> Screens Time -> three dots (top right) -> Allow restricted settings, then try again (the app has an "Open App info" button for this).
4. Optional: **Notification access** to count notifications.
5. Phone's battery setting for Screens Time: Unrestricted (Xiaomi/Oppo/Vivo: also allow auto-start).
6. In the app: Settings -> Refresh now. It should say **Live**, not **Demo**.

## Step 6: check list I can do on the phone (put this in your final message)

- [ ] Today shows my real total and the apps I really used (real icons, not grey).
- [ ] Tap an hour bar: the apps for that hour appear.
- [ ] Set a 1-minute limit on one app, use it, it gets blocked with a full-screen message.
- [ ] Turn on "Hide Shorts" (YouTube) and open Shorts: it goes back.
- [ ] Settings says Live.

## Final message format

Send me exactly these, short:
1. GitHub repo URL
2. Vercel URL
3. APK download link (+ local path of the downloaded file)
4. Anything that failed or that you could not test, in plain words
5. The Step 5 install steps

Rules: no secrets in files or chat, no force-pushes, no deleting my project folder, do not add features. Answer me in simple Hinglish or English, short sentences.
