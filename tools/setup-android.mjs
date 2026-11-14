// Prepares the Android project: creates it with Capacitor if needed, copies the Screens Time
// native code on top, and adds the permissions and services to the manifest.
// Safe to run again and again (it never adds anything twice).
//
//   node tools/setup-android.mjs
import { existsSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

// 1. the Android project (Capacitor generates it the first time)
if (!existsSync(join(root, 'android', 'app'))) {
  console.log('> creating the Android project');
  run('npx cap add android');
}

// 2. our code and icons on top of it
console.log('> copying Screens Time native code');
cpSync(join(root, 'android-overlay'), join(root, 'android'), { recursive: true, force: true });
// the round-adaptive icon of the template would hide our logo: use our full-size icons everywhere
rmSync(join(root, 'android/app/src/main/res/mipmap-anydpi-v26'), { recursive: true, force: true });

// 3. the manifest
const mf = join(root, 'android/app/src/main/AndroidManifest.xml');
let x = readFileSync(mf, 'utf8');
x = x.replace(/\s*<!-- screenstime:begin[\s\S]*?screenstime:end[^>]*-->/g, '');       // remove an older patch

if (!/xmlns:tools=/.test(x)) x = x.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');

const top = `
    <!-- screenstime:begin top -->
    <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" tools:ignore="ProtectedPermissions" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" tools:ignore="QueryAllPackagesPermission" />
    <queries>
        <intent><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent>
        <intent><action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.BROWSABLE" /><data android:scheme="https" /></intent>
    </queries>
    <!-- screenstime:end top -->`;
const services = `
        <!-- screenstime:begin services -->
        <service
            android:name="app.screenstime.NotificationService"
            android:exported="true"
            android:label="Screens Time"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter><action android:name="android.service.notification.NotificationListenerService" /></intent-filter>
        </service>
        <service
            android:name="app.screenstime.BlockerService"
            android:exported="true"
            android:label="Screens Time"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter><action android:name="android.accessibilityservice.AccessibilityService" /></intent-filter>
            <meta-data android:name="android.accessibilityservice" android:resource="@xml/accessibility_config" />
        </service>
        <!-- screenstime:end services -->`;
if (!x.includes('</application>')) throw new Error('Unexpected manifest: no </application>');
x = x.replace('</application>', services + '\n    </application>');
x = x.replace('</manifest>', top + '\n</manifest>');
writeFileSync(mf, x);
console.log('> manifest patched');

// 4. the Java files must sit in the folder of the app id
const pkgDir = join(root, 'android/app/src/main/java/app/screenstime');
console.log('> native files:', existsSync(pkgDir) ? readdirSync(pkgDir).filter((f) => statSync(join(pkgDir, f)).isFile()).length : 0);
console.log('Done. Next: npx cap sync android && cd android && ./gradlew assembleDebug');
