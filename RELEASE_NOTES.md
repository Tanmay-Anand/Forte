# Forte — Release Notes

A personal, offline workout tracker for Android.
**Plan your week → log every set → see yourself getting stronger.**

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
