# Forte — Release Notes

A personal, offline workout tracker for Android.
**Plan your week → log every set → see yourself getting stronger.**

---

## v1.1.0

**This is a new APK, not an over-the-air update.** It adds two native modules, so `npm run update`
cannot deliver it to a v1.0.0 install. Install it over v1.0.0. It must be signed with the same key
(see Versioning in `RELEASE_NOTES.md`). There are no database changes, so your log carries over
untouched.

### One-tap updates from now on

- **New APKs:** install [Obtainium](https://github.com/ImranR98/Obtainium) once and point it at
  this repo (`docs/RELEASING.md` §3). From then on it notifies you of each release, and you tap
  **Update**.
- **Code-only updates:** these still arrive over the air. When one has downloaded, an **Update
  ready · Restart** bar appears above the tab bar. One tap applies it. It never appears
  mid-workout.
- Forte now checks Expo's update server when it starts and when you return to it after 30 minutes
  or more. Offline, the check fails silently and nothing else changes.

### Lock-screen workout controls

During a workout, an ongoing notification shows on the lock screen and in the notification shade:

- **While resting:** a live rest stopwatch, with **Pause / Resume** and **Start set *n*** buttons.
- **Between rests:** the exercise and the next set, with a **Log 80 kg × 8** button that logs
  exactly the pre-filled values it names.

The ticking digits are Android's own chronometer, drawn from the saved rest start time, so they
cost no battery and stay correct with the app closed or killed. The buttons write through the
same code path as the Active Workout screen. You can turn it off in Settings → **Lock-screen
controls**. Android 13+ asks for notification permission the first time a workout opens.

Android phones have no true lock-screen widgets, so this is a notification. On HyperOS/MIUI,
check **Settings → Notifications → Lock screen** if it doesn't appear there.

### Weight pre-fill from the last same workout

Set *n* now pre-fills with the weight and reps from set *n* of the same exercise the last time you
did **the same workout** (matched by workout name, like Today's "Last Chest + Triceps"). A pyramid
or a back-off set now pre-fills correctly instead of repeating today's previous set. The
"last time" line above the inputs uses the same session.

Fallbacks, in order:
1. If you do more sets than last time, it repeats today's last set.
2. If that set was skipped last time, it uses last time's first performed set.
3. If the exercise was never done in this workout, it uses the most recent session that had it.

### Full-screen

Android's navigation bar (the gesture pill or the 3-button bar) is hidden while Forte is open.
Swipe up from the bottom edge to bring it back temporarily.

### Under the hood

`@notifee/react-native` 9.1.8 provides the notification. `expo-doctor` flags it as unmaintained:
its last release was December 2024. It was chosen because it is the only Expo-compatible library
that exposes Android's notification chronometer, which is what keeps the timer rule intact. If a
future Expo SDK upgrade breaks it, replace it with a small local Expo module. The rest of the app
doesn't depend on it.

---

## v1.0.0

First public release.

### Installing it

Forte is not on the Play Store. Download the APK from the
[**Releases**](../../releases) page and install it directly.

**Requirements:** Android 7.0 or newer. About 40 MB of space. No account, no internet.

1. On your phone, open the Releases page and download `forte-v1.0.0.apk`.
2. Tap the downloaded file.
3. Android asks whether to allow **"Install unknown apps"** for your browser. Allow it — this is
   the standard prompt for any app not installed from the Play Store.
4. Play Protect will warn **"unsafe app blocked"**. Tap **More details → Install anyway.** This
   warning appears for every sideloaded app; it means "not scanned by Google", not "malicious".
5. Install. That's it — there is no sign-up, and nothing to configure before you start.

Prefer a cable? With USB debugging enabled:

```bash
adb install -r forte-v1.0.0.apk
```

Want to build it yourself instead? See [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) — there are
three routes, including one that never touches an Expo account.

### What it does

**Plan a week.** Seven days, each one a named workout or a rest day. A routine is just an ordered
list of exercises — no target sets, no rep schemes, no RPE. What you actually lift is decided in
the gym.

**Log a set in two taps.** Weight and reps pre-fill from your last set, so repeating one costs a
single tap on **Complete Set**. Change a number with steppers, a purpose-built numeric keypad, or
by dragging on the value.

**Rest times record themselves.** Finishing a set starts a stopwatch; starting the next one stops
it and stores the duration. You never type a rest time. The timer counts *up*, because there is no
target rest — it reports, it does not instruct.

**Last session sits above today's inputs**, so progressive overload is the obvious thing to
attempt rather than something you have to go looking for.

**Adapt mid-workout.** Skip a set, skip an exercise, or replace an exercise for today only — the
lat pulldown machine is busy, so today it's pull-ups — without touching your weekly routine.

**See whether you're actually getting stronger.** Per-exercise trend charts for weight, reps,
volume and rest, plus a chronological table. The chart appears once an exercise has three logged
sessions; below that it tells you how many more are needed rather than drawing a line two points
can't support.

**Full history.** Every completed session, with per-set rest times shown between the sets they
separate.

### What it deliberately does not do

No accounts. No social feed, friends, followers, likes or challenges. No calories, nutrition or
supplements. No body measurements, wearables or heart rate. No AI coaching or workout
recommendations. No streaks, badges or gamification. No ads, no subscription, no payments.

It is a training notebook with a stopwatch and a chart. That is the whole product.

### Privacy

Everything lives in a SQLite database on your phone. There is no server, no account and no
analytics. **The app makes no network requests at all.** It works in a basement gym with no
signal, in airplane mode, forever.

The flip side: **a lost phone is a lost training log unless you export.** Settings → Your data
gives you a full JSON backup (restores exactly) and a CSV of every set (opens in any
spreadsheet). Export monthly. Roughly 0.8 MB per year at four sessions a week — ten years of
training is about 8 MB.

### Known limitations

- **Android only.** The codebase is React Native and would run on iOS, but nothing has been
  built or tested there.
- **Exercise reorder uses up/down arrows**, not drag-and-drop.
- **No supersets or circuits.** Exercises are logged one at a time, in order.
- **No plate calculator** and no estimated 1RM — both were considered and left out.
- **Bodyweight exercises** log reps with weight as optional added load; they are not excluded
  from volume totals, so a high-rep bodyweight day inflates session volume.
- **No automatic backups.** Exporting is a manual action, by design — but it does mean you have
  to remember.

### Notes for anyone reading the source

The interesting decisions are written down rather than left implicit:

- [`docs/DESIGN.md`](docs/DESIGN.md) — the UI specification: colour and type tokens, every screen
  and state, the interaction model, accessibility.
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — stack evaluation, the data model,
  the rest-timer specification, and a battery analysis with measurable budgets.
- [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) — building and installing it yourself.

The one rule the app depends on: **rest time is derived from stored timestamps, never accumulated
by a ticking interval** (`src/features/workout/rest-timer.ts`, 13 tests). That is what makes the
timer survive backgrounding, screen sleep and process death — and what lets you lock the phone
between sets without corrupting the log.

---

## Versioning

`MAJOR.MINOR.PATCH`.

- **PATCH** — bug fixes only, no schema change.
- **MINOR** — new features; may add a forward-only migration. Your data is preserved.
- **MAJOR** — reserved for a change that alters how existing data is interpreted.

Database migrations are forward-only and run automatically on launch. Downgrading to an older
APK after a migration has run is not supported — export first if you plan to.

**Updating:** install the new APK over the old one. It must be signed with the same key as your
current install, or Android will refuse and require an uninstall, which deletes the database.
If you built it yourself, that means keeping your keystore. Export before any update you are
unsure about.

---

## Changelog

### v1.1.0

- Lock-screen / notification-shade workout controls: live rest stopwatch, Pause/Resume, Start set,
  Log set. Settings toggle, on by default
- Pre-fill uses the same set number from the last session of the same workout
- "Last time" line prefers the last session of the same workout
- Android navigation bar hidden while the app is open (swipe up to reveal)
- "Update ready · Restart" bar for over-the-air updates; also checks on return to the foreground
- Releases publish automatically to GitHub on a version tag, for one-tap updates in Obtainium
- 7 new pre-fill tests (26 total)

### v1.0.0

Initial release.

- Weekly routine planner with workout / rest / unconfigured day states
- Active Workout: one exercise at a time, large numeric inputs, previous-session reference
- Automatic rest stopwatch — timestamp-derived, survives backgrounding and process death
- Skip a set, skip an exercise, replace an exercise for a single session
- Session summary with progression comparison against the previous session of the same workout
- Progress: weight / reps / volume / rest trends per exercise, gated on three sessions
- History with per-set rest times
- 145-exercise seeded library, searchable and filterable, plus custom exercises
- JSON and CSV export, JSON import
- Dark by default, light theme available, kg/lb display toggle
- Keep-screen-awake setting — off cuts session battery use roughly fourfold with no loss of
  timing accuracy
