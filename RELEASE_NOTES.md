# Forte — Release Notes

A personal, offline-first health and training app for Android.
**Plan your week → log every set → see yourself getting stronger.**

---

## Unreleased

Rename this heading to the version number when tagging (`docs/RELEASING.md`).

Forte is now a personal health and training app. The workout screen is unchanged: everything new
happens after Finish, or on screens you open on purpose. Plan and decisions:
[`docs/AI_TRAINER_PLAN.md`](docs/AI_TRAINER_PLAN.md).

**New**

- **A fuller workout summary.**
  - **How hard was it?** One optional tap after the workout, five steps from Easy to Maximal.
    Never asked during the workout; you can change it later in History.
  - **Records:** heaviest weight, most reps at a weight, best estimated strength, or most volume,
    at most one per exercise. A first session sets none.
  - **Compared with last time:** each exercise shows what changed (weight, or reps at the same
    weight) and its rest, against the previous session of the same workout.
  - **Against your usual:** session volume against the median of your last 3–6 sessions of that
    workout, saying whether the change is outside your normal spread.
  - **Next time:** a target per exercise. Every set at the top weight reached the same reps → add
    one weight step; some fell short → same weight, match the best set first.
  - **Muscles worked:** a front and back body with the muscles this workout trained shaded teal,
    and the sets per muscle underneath. Helper muscles count half a set.
- **Drop sets.** After completing a set, tap **Drop set** to carry straight on at a lower weight:
  40 kg × 5, then 25 kg × 8, logged as one set. The wells start about a quarter lighter, rounded
  to the exercise's weight step, with the same reps. **Another drop** adds a further one. A drop
  shows as ↳ under its set (tap to edit, hold to remove), and as `40 × 5 ↘ 25 × 8` in "Last time".
  Drops add to volume, but not to the set count, records, targets or muscle sets. They have no
  rest of their own; the rest after them is timed from the end of the last drop.
- **Next-set targets elsewhere too:** beside each exercise on Today, and beside "Last time" during
  a workout, on the same line so the screen doesn't grow. The number wells still pre-fill from what
  you actually did last time.
- **Insights** (Progress → Insights): up to five specific observations from your log, such as a lift
  unchanged for four sessions, more reps at the same weight, rests getting longer, or a week well
  above your four-week average. Each names its numbers and dates. Nothing is said about a trend
  from fewer than three sessions. No motivational messages.
  - **Muscles:** a front and back body shaded by sets per muscle over four weeks, the most and
    least trained muscles, and a tap on any muscle for its sets a week, when it was last trained
    and the exercises that trained it. The female body is used when your profile says female.
    Body photos and outlines from MuscleMap (MIT). It's a still picture: drawn when the screen
    opens, with no animation, so it costs no battery after that.
  - **Muscle groups:** sets per group over four weeks, and a card when chest and back are uneven or
    there's no leg work at all.
- **Profile tab**, fifth in the bar, after History. Weight with a chart and target, height, body
  fat and nine tape measurements. Every reading is kept, so each has a history. Settings has moved
  here (the gear), from Today.
- **Blood reports** (Profile → Blood reports): add a report with its date, type and optional PDF or
  photo, which is kept in Forte's private storage. Record values with the lab's own range; values
  outside it are marked. Each marker has a trend chart with the range shaded, and every point links
  back to its report.
  - **Read values with AI:** send a request to an AI app, attach the report there, paste the reply
    back. Forte turns it into draft rows; nothing is saved until you tick each one, and saved values
    are marked as read by AI.
- **Analysis with AI, no API key.** *Analyse with AI* on the summary, *Ask AI* in Insights, session
  detail and Blood reports. Forte opens the share menu with a text summary and you pick the app —
  Claude, ChatGPT or Gemini; Forte itself sends nothing. You can paste the reply back into the
  session. Settings → AI analysis chooses whether notes and body data are included, and
  *Show what's shared* shows the exact text. Blood results are shared only from Blood reports, only
  the markers you tick, after a confirmation.
- **Automatic backup** (Settings): after every workout, a backup file goes to a folder you choose
  once. The newest 12 are kept. Point a sync app at the folder to get it to Google Drive.
- **Forte Companion** (`companion/`): a local app for your PC that reads your newest backup from
  Google Drive. Home, Training, Body, Health and Ask AI pages, in Forte's dark theme, and a chat with
  Claude, ChatGPT, Gemini or an offline model — each through its own login, no API keys. For
  Claude you choose Sonnet 5.5 (the default), Opus 5.5 or Haiku 5.5 in Setup. The Body page shades
  a realistic front and back body by how much each muscle was trained (body diagrams and photos
  from MuscleMap, MIT licence), using the female body when your profile says female.

**Changed**

- **Backup format 3.** Sets carry a drop index for drop sets. Older versions of Forte refuse a
  format 3 file instead of reading each drop as an extra set; this version still reads formats
  1 and 2. The CSV export gains a `drop` column.
- **Backup format 2.** Backups now include effort ratings, your profile and measurements, saved
  AI replies and blood-report records. Report files are not included. Older backups still
  import, and leave health data untouched.
- Privacy wording: data leaves the phone only when you export it or share it yourself.

**Fixed**

- **Restoring a backup lost skipped sets.** A skipped set came back as a performed set of
  0 kg × 0 reps, which changed set counts. Skipped sets now restore as skipped.

- **The keypad and menus could open as an invisible, frozen layer** (bug introduced in v1.1.0).
  - Tapping a weight to type it, the ⋯ menu, and the exercise pickers each opened a window that
    drew nothing and swallowed every tap until Back was pressed.
  - Cause: v1.1.0 hides Android's navigation bar, and a popup opened while the bar is hidden
    didn't draw.
  - The bar now appears while a sheet is open, which Android does for any popup anyway, and hides
    again afterwards.
- **Large text sizes:** labels no longer run into their values ("TODAY'S WORKOUT5 EXERCISES"), the
  set table's "SET" header no longer wraps, and the clock digits no longer spread apart.
- **The rest timer stays on screen while resting.** It now sits above the next set's inputs
  instead of below the controls, where it fell off a narrow phone's screen.
- **Switches that are off are visible in dark mode.** The off thumb was nearly the same colour as
  its track.

- **Much smaller APK.** It's now built for arm64 phones only, with code shrinking (R8) and
  compressed native libraries: about 15–23 MB instead of 103 MB. Every Android phone from roughly
  2017 onward is arm64. The release APK no longer installs on x86_64 emulators.
- **Number wells fit the number.** The `+` and `−` now stack in one column on the right, so
  "102.5" shows at full size on a narrow phone instead of shrinking to less than half. At large
  system font sizes, weight and reps stack vertically. Drag-to-change was removed: it only worked
  when the screen couldn't scroll.
- **The rest clock no longer jitters.** Its digits sit in fixed-width cells, as do the workout
  clock and the resume bar's clocks.
- **Easier to read.**
  - Hint text is brighter, and every text colour now meets 4.5:1 contrast.
  - The "Last time" line is a step brighter.
  - Text inputs use the app's font.
- **Calmer selection.** Selected filter chips and segments are outlined instead of filled. The
  bright fill now means only "the thing to do". In light mode, the tab bar and the resume and
  update bars have a visible edge.
- **Smoother set confirmation.** The set flash runs on the UI thread. With *Reduce motion* on,
  it shows instantly and clears without fading, and screen transitions become fades.
- **Lists clear the bars.** The last row of a list now scrolls clear of the resume and update
  bars.

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
