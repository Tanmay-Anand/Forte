# Forte — Setup Guide

Everything needed to run Forte on your machine and install it on your Android phone.

**Target:** Android only · Expo (managed) · React Native · SQLite
Companion documents: [`DESIGN.md`](DESIGN.md) · [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)

> **Verification status.** §1, §2 and the `prebuild` step of §4 were run end to end on this
> machine (Windows 11, Node 24.12.0, AVD `Medium_Phone_API_36.1`). The EAS cloud build (§3) and
> the Gradle release build (§4d) need your own account and toolchain, and are written from the
> documented flow rather than from a run here. Flagged inline where it matters.

---

## 0. What you need

| For | Requirement | Present here |
|---|---|---|
| Everything | Node.js 20+ · npm 10+ | Node 24.12.0, npm 11.6.2 |
| Running on your phone | An Android phone on **Android 7.0+** | — |
| Emulator preview (§2b) | Android Studio + an AVD | Yes |
| Cloud APK build (§3) | A free [expo.dev](https://expo.dev) account | — |
| Local APK build (§4) | Android SDK + JDK 17/21 | SDK + JDK 21 |

You never need a Google Play Developer account, the $25 Play fee, or any paid Expo plan.

---

## 1. Install and verify

```bash
npm install
```

Three checks, all of which should pass before you go further:

```bash
npx expo-doctor
```

```bash
npm run typecheck
```

```bash
npm test
```

Expected: no TypeScript output and `pass 26` across three suites. `expo-doctor` passes 17/18: it flags `@notifee/react-native` as unmaintained (see `RELEASE_NOTES.md`, v1.1.0).

The rest-timer suite is the one to care about — backgrounding, pause/resume cycling,
reset-while-paused, process death, a clock that moves backwards. The format suite guards a bug
that actually shipped once: `10` reps rendering as `"1"`. If either goes red, stop and fix it
first; a wrong rest time or rep count is a silently corrupted log.

---

## 2. Running it without building anything

Two ways to have Forte on screen in minutes. Both use **Expo Go**, so neither shows the app's own
icon or launch screen, and both keep data in Expo Go's sandbox — separate from an installed APK.

### 2a. On your phone, over Wi-Fi

1. Install **Expo Go** from the Play Store.
2. Put the phone and the PC on the same Wi-Fi.
3. `npm start`
4. Scan the QR code with Expo Go.

If the phone cannot reach the PC — corporate Wi-Fi, AP isolation, a VPN:

```bash
npx expo start --tunnel
```

### 2b. On the laptop, in the emulator

**One-time: put the SDK on your PATH.** This is the thing that will bite you. Expo shells out to
`adb`, and without it you get a bare `Error: The system cannot find the path specified.` that
never mentions Android.

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
```

```powershell
[Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path','User'));$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator", 'User')
```

Open a new terminal, confirm with `adb version`, then each session:

```bash
emulator -avd Medium_Phone_API_36.1
```

```bash
npm run android
```

| Action | How |
|---|---|
| Dev menu | `Ctrl + M` |
| Reload | `r` in the terminal |
| Force a clean reload | `adb shell am force-stop host.exp.exponent`, then reopen the `exp://` URL |
| Toggle dark/light | `adb shell cmd uimode night yes` / `no` |
| Screenshot | `adb exec-out screencap -p > shot.png` |

**A Fast Refresh caveat.** Edits to leaf components occasionally fail to apply silently — the app
keeps running old code with no error. If a change seems not to land, force a clean reload before
assuming the change is wrong.

**If the emulator crashes on boot** (a corrupt saved snapshot did this here, exit 127):

```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot-load
```

---

## 3. Building the APK in the cloud — the recommended route

This is how Forte gets onto your phone properly: its own icon, its own launch screen, its own
database, installed permanently. No Android SDK needed on your machine.

### 3a. One-time EAS setup

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas init
```

`eas init` links the project to your Expo account and writes a project ID into `app.json`.

`eas.json` already defines three profiles:

| Profile | Output | Use |
|---|---|---|
| `development` | APK + dev client | Debugging with custom native modules |
| `sideload` | **APK** | The one you want — installs directly |
| `production` | AAB | Play Store format; **cannot be installed directly** |

The `sideload` profile exists because EAS's default `production` profile emits an **AAB**, which
Android cannot install. It is the single most common thing people get stuck on.

### 3b. Build

```bash
npm run build:apk
```

Runs on Expo's servers, typically 10–20 minutes; the free tier queues at busy times. You get a
URL when it finishes.

> `npm run build:apk:unix` runs the same build on your own machine — but **EAS local builds are
> supported on macOS and Linux only.** On Windows they need WSL2. For a Windows-native local
> build use §4.

### 3c. Install it on the phone

Easiest: open the build URL in Chrome **on the phone** and download directly.

1. Tap the downloaded APK.
2. Android asks to allow **"Install unknown apps"** for Chrome — allow it (once, per source).
3. Play Protect warns **"unsafe app blocked"**, because the APK is not from the Play Store. Tap
   **More details → Install anyway.** Normal for any sideloaded app.
4. Install. It stays installed permanently — no expiry, no weekly re-signing.

Over a cable instead, with USB debugging enabled:

```bash
adb install -r forte.apk
```

### 3d. ⚠️ Back up the signing keystore — do this immediately

EAS generates an Android signing key on your first build and keeps it in your Expo account.

**Every future version must be signed with the same key.** If it is not, Android refuses to
update and forces an uninstall first — **which deletes your entire workout database.**

```bash
eas credentials
```

Android → your profile → **Download credentials**, and store the keystore somewhere durable.
This is the one operational mistake that can cost you your training history.

---

## 4. Building the APK locally on Windows — no Expo account

Slower to set up, but everything stays on your machine and you own the signing key outright.
`prebuild` is verified here; the Gradle steps are the standard flow and were not run on this
machine.

### 4a. Generate a signing key, once

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore forte-release.keystore -alias forte -keyalg RSA -keysize 2048 -validity 10000
```

Keep `forte-release.keystore` outside the repo and back it up. `.gitignore` excludes
`*.keystore`, but do not rely on that alone.

### 4b. Generate the native project

```bash
npm run prebuild
```

This creates `android/`. **Keep it from here on** — the signing config you are about to add lives
inside it, and `prebuild --clean` wipes it. (`android/` is gitignored; if you want the config to
survive a fresh clone, either commit the directory or re-apply §4c after each prebuild.)

### 4c. Point Gradle at your key

Add to `android/gradle.properties`:

```properties
FORTE_STORE_FILE=C:/path/to/forte-release.keystore
FORTE_KEY_ALIAS=forte
FORTE_STORE_PASSWORD=your-store-password
FORTE_KEY_PASSWORD=your-key-password
```

In `android/app/build.gradle`, add a release signing config and point the release build type at
it:

```gradle
signingConfigs {
    release {
        storeFile file(FORTE_STORE_FILE)
        storePassword FORTE_STORE_PASSWORD
        keyAlias FORTE_KEY_ALIAS
        keyPassword FORTE_KEY_PASSWORD
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release   // template default is signingConfigs.debug
    }
}
```

**Why this step is not optional.** Expo's Android template signs *release* builds with the
**debug** keystore out of the box. Such an APK installs and runs fine — but the debug key is
shared, regenerable and not yours, and the moment it changes, updating the app means
uninstalling it and losing your data.

### 4d. Build and install

```bash
cd android && gradlew.bat assembleRelease
```

The APK lands at `android/app/build/outputs/apk/release/app-release.apk`.

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

The first Gradle run downloads a large toolchain and takes a while; later builds are much faster.

### 4e. Quicker local option, for testing only

```bash
npx expo run:android
```

Prebuilds, compiles a **debug** APK and installs it to a connected device or running emulator.
Larger and slower at runtime than a release build, and debug-signed — fine for trying things on
real hardware, not what you want to live in day to day.

---

## 5. Choosing between them

| | Expo Go (§2) | EAS cloud (§3) | Local Gradle (§4) |
|---|---|---|---|
| Setup effort | None | Account + CLI | SDK + keystore + Gradle |
| Time to first install | ~2 min | 10–20 min | 20–40 min first time |
| Your icon & launch screen | No | Yes | Yes |
| Own database, survives reboots | Sandboxed | Yes | Yes |
| Who holds the signing key | n/a | Expo (exportable) | You |
| Works offline | Needs the dev server | Needs internet to build | Fully offline after setup |
| OTA updates (`npm run update`) | n/a | Yes | No |
| **Best for** | Building the app | **Daily use** | No-account / full control |

Recommended: **§2b while developing, §3 for the phone you actually train with.**

---

## 6. Updating later

For JS-only changes — nearly all of them — no rebuild, no reinstall:

```bash
npm run update
```

The app pulls the new bundle on next launch. This works only for APKs built by EAS (§3), which
embed the update channel.

A **fresh APK** is needed only when native code changes: a new native dependency, or an edit to
`app.json` touching the icon, launch screen, permissions or package name.

Bump `expo.version` and `expo.android.versionCode` in `app.json` before each new APK, or Android
may refuse to install it over the old one.

---

## 7. Backups — treat this as mandatory

Forte has no server, no account and no cloud sync. That is deliberate, and the cost is that
**a lost phone is a lost training log unless you export.**

In the app: **Today → ⚙ Settings → Your data**

| Action | Produces |
|---|---|
| Export backup (JSON) | Complete, restorable snapshot |
| Export sets (CSV) | Flat table of every set; opens in any spreadsheet |
| Import backup | Replaces all local data from a JSON file |
| Compact database | Annual `VACUUM`; reclaims space after deletions |

Export monthly. The JSON restores exactly — it is also how you move data from Expo Go into your
installed APK, or between phones. The CSV is insurance against this app itself going away.

**Storage growth:** roughly **4 KB per workout**, about **0.8 MB per year** at four sessions a
week; ten years is around 8 MB. The installed app is ~35–40 MB and fixed.

---

## 8. Project layout

```
app/                       Expo Router routes (file-based)
  (tabs)/
    index.tsx              Today
    week.tsx               Weekly routine
    progress.tsx           Progression charts + rest analysis
    history.tsx            Completed sessions
  workout/
    active.tsx             ★ Active Workout — the core screen
    summary.tsx            Finish Workout
  day/[day].tsx            Customize Day
  session/[id].tsx         Session detail
  settings.tsx             Units, theme, battery, data

src/
  db/
    schema.ts              Drizzle schema
    migrations.ts          Forward-only DDL ladder (PRAGMA user_version)
    client.ts              DB singleton, pragmas, WAL checkpoint, vacuum
    seed.ts                Idempotent exercise + routine seeding
    queries/               routine · session · progress · history
  features/
    workout/
      rest-timer.ts        ★ Pure timestamp maths — test this first
      RestPanel.tsx        Isolated 1s tick component
      NumberWell.tsx       Steppers + scrub + keypad trigger
      NumericKeypad.tsx    Purpose-built numeric pad
      SetTable.tsx         Logged sets, skip state, completion flash
      ResumeBar.tsx        Minimised-workout pill
    routine/
      ExercisePicker.tsx   Library sheet: search, filters, multi-add, create
  ui/                      tokens · theme · Text · Button · primitives
                           PillNav · ActionSheet · UndoStrip · LineChart
  lib/                     time · format · id · export · db-hooks
  data/exercises.seed.ts   145 seeded exercises

assets/                    icon · adaptive-icon · splash-dark · splash-light
Resources/                 original brand artwork (source for assets/)
tests/                     rest-timer (13) + format (6), plain Node
```

---

## 9. Architecture notes you will want when editing

**The rest timer is derived, never accumulated.** `src/features/workout/rest-timer.ts` computes
elapsed time from timestamps stored on the session row. The 1-second interval is a *rendering*
concern only. This is what makes the timer survive backgrounding, screen sleep and process
death — and why "keep screen awake" can be switched off without corrupting rest times. If you
change one thing in this codebase, do not change this.

**Every set is written the moment it is logged.** No debouncing, no save-on-finish. Live workout
state — current exercise, rest timestamps, pending rest — lives on the `sessions` row, so a crash
mid-workout resumes exactly where it stopped with no "restore?" prompt.

**Reactivity is a revision counter, not a subscription layer.** SQLite reads are sub-millisecond
here, so `src/lib/db-hooks.ts` recomputes queries whenever a mutation calls `bumpRevision()`. Add
a write path and forget that call, and the UI silently will not update.

**Migrations are raw DDL keyed on `PRAGMA user_version`**, not drizzle-kit codegen — this keeps
the codegen step and the Metro `.sql` transformer out of the build. To change the schema, append
a new array to `MIGRATIONS` in `src/db/migrations.ts` and mirror it in `schema.ts`. **Never edit
a shipped migration.** Currently v2 (v1 initial, v2 `sets.skipped`).

**Weight is always stored in kilograms.** Pounds is a display conversion in `src/lib/format.ts`.
Mixed-unit storage is a permanent source of bad charts.

**Only one component re-renders per second during rest** (`RestClock`). Keeping the tick isolated
from the set table is what holds the app to its battery budget.

**Skipped sets are rows, not absences.** Every aggregate filters `skipped = 0` — volume,
progression, top set, and the next set's pre-fill. Miss that filter and one skipped set drags a
chart toward zero.

---

## 10. Known deviations from the design document

1. **Reorder uses up/down chevrons, not drag-and-drop.** `DESIGN.md` §5.3 specifies a drag
   handle. Drag would add `react-native-draggable-flatlist` plus gesture-handler/reanimated
   version coupling — the most common source of Expo setup breakage. The chevrons are functional
   and zero-risk. Worth upgrading once the app is stable on your device.

2. ~~`⋯` row menus are native `Alert` action sheets.~~ **Fixed.** They are a themed bottom sheet
   (`src/ui/ActionSheet.tsx`). The native `Alert` had to go for correctness, not just looks:
   Android's `AlertDialog` renders at most three buttons, so the five-item workout menu silently
   dropped *End workout* and *Discard workout*, leaving them unreachable.

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: The system cannot find the path specified.` on `npm run android` | `ANDROID_HOME` is not set — see §2b |
| `expo-doctor` reports version mismatches | `npx expo install --fix` |
| Metro cache weirdness after dependency changes | `npx expo start --clear` |
| Port 8081 in use after a killed Metro | Kill the orphaned `node` process holding it, then restart |
| Expo prompts to upgrade Expo Go and exits in a non-interactive shell | Run `npx expo start` without `--android`, then open the `exp://` URL manually |
| Phone cannot reach the dev server | `npx expo start --tunnel` |
| A code change does not appear | Fast Refresh missed it — force a clean reload (§2b) |
| App icon / launch screen still Expo Go's | Expected. Both appear only in a real build (§3, §4) |
| Play Protect blocks the install | More details → Install anyway |
| "App not installed" | An existing build signed with a different key. Uninstall first — **export your data first** |
| EAS build queued a long time | Free tier. Use §4 for a local build |
| `eas build --local` fails on Windows | Not supported; macOS/Linux/WSL2 only. Use §4 |
| Emulator crashes on boot (exit 127) | Corrupt snapshot: add `-no-snapshot-load` |

---

## 12. First run

1. Open the app. Today shows **"No routine yet"**.
2. **Plan My Week** → tap a day → name it → **+ Add Exercise** (the sheet stays open for
   multi-add).
3. Long-press a day in Week to duplicate it onto another — the fastest way to build a split.
4. Back on Today, tap **Start Workout**.
5. Log a set: steppers, or tap the big number for the keypad, then **Complete Set**. The rest
   stopwatch starts on its own.
6. Rest, then tap **Start Set 2** — the rest duration is stored automatically. You will never
   type a rest time.
7. Mid-workout, `⋯` offers **Replace exercise** (today only) and **Skip exercise**; **Skip set**
   sits beside the number wells.
8. **Progress** draws a trend chart once an exercise has three logged sessions; before that it
   shows how many more are needed.
