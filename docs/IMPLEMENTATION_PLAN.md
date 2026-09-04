# Forte — Implementation Plan

**Personal Offline Workout Tracker**
Version 1.0 · Tech stack evaluation and build sequence

> Companion document: `DESIGN.md` (UI, interaction, states). This document covers stack selection, architecture, data model, and delivery phases.

---

## 1. Constraints that drive every decision

| # | Constraint | Consequence |
|---|---|---|
| 1 | **Single user, no accounts** | No auth, no user table, no multi-tenancy, no server. |
| 2 | **Fully offline** | Local database is the source of truth, not a cache. No network in the critical path — ever. |
| 3 | **Used mid-workout on a phone** | Cold start < 1 s. Set logging must feel instantaneous (< 16 ms UI response, writes async). |
| 4 | **Timers must survive backgrounding** | All durations derived from stored timestamps. No `setInterval` accumulation. |
| 5 | **Crash must not lose a session** | Every set is persisted the moment it is logged, not on workout completion. |
| 6 | **Relational, query-heavy reads** | Progress charts need "heaviest set per session per exercise, ordered by date." SQL is a much better fit than a document store. |
| 7 | **Data must be the user's** | Local file, exportable to JSON/CSV, no vendor lock-in. |

Constraint 6 is the one people get wrong. Workout data looks like a document tree (`workout → exercises → sets`) but is *read* relationally and analytically. Choose SQLite.

---

## 2. Tech stack options

Four realistic options, evaluated against the constraints.

### Option A — React Native + Expo (recommended)

```
UI            React Native + Expo SDK 52+ (Expo Router)
Language      TypeScript (strict)
Database      SQLite via expo-sqlite
ORM/Query     Drizzle ORM (typed schema + migrations)
State         Zustand (ephemeral session/timer state) + TanStack Query or
              Drizzle live queries (DB-backed state)
Charts        victory-native XL (Skia-backed) or react-native-svg + d3-scale
Animation     react-native-reanimated 3
Keep-awake    expo-keep-alive / expo-keep-awake
Storage/export expo-file-system + expo-sharing
Build         EAS Build (free tier is sufficient for a personal app)
```

**Strengths**
- True native feel and native gesture handling — the Active Workout screen depends on both. (Haptics are deliberately not used; see `DESIGN.md` §3.5.)
- `expo-sqlite` is a real SQLite file on-device; Drizzle gives typed queries and versioned migrations.
- Reanimated runs the timer and set-completion animations on the UI thread — they never stutter while the DB writes.
- One codebase covers Android and iOS; Expo's dev-client makes iteration fast.
- Sideloadable to your own phone without an App Store listing (Android APK directly; iOS via a free developer profile with a 7-day refresh, or a $99/yr account for a permanent build).

**Weaknesses**
- Native build toolchain, EAS account, ~15 min build cycles for release builds.
- Larger app size (~30–50 MB) than a PWA.
- Charting on RN is less mature than the web ecosystem.

**Best when:** you want this on your phone as a real app, permanently, and you are comfortable in TypeScript/React.

---

### Option B — Installable PWA (React + Vite)

```
UI            React 19 + Vite + TypeScript
Routing       React Router (or TanStack Router)
Database      IndexedDB via Dexie.js  — or  SQLite WASM (wa-sqlite) + OPFS
Styling       Tailwind CSS + CSS variables for the token system
Charts        visx, or Recharts, or hand-rolled SVG (the charts here are simple)
Offline       Vite PWA plugin (Workbox) — precache the whole app shell
Animation     Framer Motion (or CSS transitions)
Keep-awake    Screen Wake Lock API
Install       Add-to-home-screen; runs standalone, no browser chrome
```

**Strengths**
- Fastest possible development loop; no build toolchain, no store, no signing.
- Deploy by opening a URL once; updates are instant.
- Works on phone, tablet and desktop from one build with zero extra effort.
- Smallest possible footprint.

**Weaknesses**
- **iOS is the problem.** Wake Lock is supported in recent Safari but historically flaky. PWA storage can be evicted by iOS after ~7 days of non-use unless the PWA is installed to the home screen — for a workout log, data loss is unacceptable, so this must be mitigated with mandatory install + periodic export.
- Feels marginally less native — scroll physics, keyboard behaviour, safe-area handling all need manual work.
- IndexedDB is not relational; progression queries are hand-written iteration rather than SQL. (SQLite WASM + OPFS fixes this at the cost of ~1 MB WASM and more setup complexity.)

**Best when:** you are on Android, want it working this weekend, and value iteration speed over native polish.

---

### Option C — Flutter

```
UI            Flutter 3.x + Material 3 (heavily themed)
Language      Dart
Database      SQLite via Drift (typed, reactive queries, migrations)
State         Riverpod
Charts        fl_chart
```

**Strengths**
- Excellent, consistent rendering across platforms; the custom numeric keypad and number wells are pleasant to build.
- Drift is the strongest offline ORM story of any option here — reactive SQL streams out of the box.
- Single binary, great performance, mature charting.

**Weaknesses**
- Dart, if you do not already write it, is a real ramp.
- Larger download; a custom-designed app fights Material defaults more than you would expect.

**Best when:** you already know Flutter, or you want the most robust offline data layer with the least plumbing.

---

### Option D — Native Android (Kotlin + Compose)

```
UI            Jetpack Compose + Material 3
Database      Room (SQLite) + Kotlin Flow
DI            Hilt (or none — the app is small)
Charts        Vico
```

**Strengths** — best possible performance and platform integration (wake lock, widgets, Quick Settings tile, notification-based rest timer that survives everything). Room + Flow is an excellent fit.

**Weaknesses** — Android only; slowest to build of the four; overkill unless you specifically want it.

**Best when:** Android-only, and you want a rest timer that lives in the notification shade.

---

### Comparison

| | A · Expo | B · PWA | C · Flutter | D · Kotlin |
|---|---|---|---|---|
| Offline data integrity | ●●●●● | ●●●○○ | ●●●●● | ●●●●● |
| Relational queries (Progress) | ●●●●● | ●●○○○ | ●●●●● | ●●●●● |
| Native feel / gestures | ●●●●○ | ●●○○○ | ●●●●○ | ●●●●● |
| Background-safe timer | ●●●●○ | ●●●○○ | ●●●●○ | ●●●●● |
| Time to first usable build | ●●●○○ | ●●●●● | ●●●○○ | ●●○○○ |
| Cross-platform reach | ●●●●○ | ●●●●● | ●●●●● | ●○○○○ |
| Ongoing maintenance cost | ●●●○○ | ●●●●● | ●●●●○ | ●●●○○ |
| Charting maturity | ●●●○○ | ●●●●● | ●●●●○ | ●●●○○ |

### Recommendation

**Option A — Expo + SQLite + Drizzle**, with **Option B as the pragmatic fallback.**

Reasoning: the two features that make or break this product — a rest timer that is always correct, and set logging that never drops data — are exactly where a PWA is weakest and a native-backed SQLite app is strongest. The Progress screen's queries are naturally SQL. And an app you sideload to your own phone is the right shape for a private training log.

Take Option B instead if either is true: you are Android-only and want it running within a day, or you specifically want desktop and phone from one deployment with no build step. If you do, use **SQLite WASM + OPFS rather than Dexie**, so the data model and queries in §4 transfer unchanged — and make weekly export non-optional.

**Do not** build this with a backend, a sync layer, or a cloud database. Every one of them adds failure modes to an app whose defining requirement is that it works in a basement gym with no signal.

---

## 3. Architecture (Option A)

```
src/
  app/                     Expo Router routes
    (tabs)/
      index.tsx            Today
      week.tsx             Week
      progress.tsx         Progress
      history.tsx          History
    workout/
      active.tsx           Active Workout (full-screen modal, outside tabs)
      summary.tsx          Finish Workout summary
    day/[dayOfWeek].tsx    Customize Day
    session/[id].tsx       History detail
  db/
    schema.ts              Drizzle schema
    migrations/            Generated SQL migrations
    client.ts              DB singleton + migration runner
    queries/
      routine.ts
      session.ts           Session lifecycle, set logging
      progress.ts          Progression + rest aggregation queries
  features/
    workout/
      useActiveSession.ts  Session orchestration
      useRestTimer.ts      Timestamp-derived stopwatch
      SetRow.tsx  NumberWell.tsx  RestPanel.tsx  NumericKeypad.tsx
    routine/  progress/  history/
  ui/
    tokens.ts              Colour / type / spacing tokens from DESIGN.md §3
    Button.tsx  Text.tsx  Sheet.tsx  Chart.tsx  UndoStrip.tsx
  lib/
    time.ts  volume.ts  format.ts  export.ts
  data/
    exercises.seed.json    ~180 seeded exercises
```

**State ownership**

| State | Owner | Persistence |
|---|---|---|
| Routine, sessions, sets, exercises | SQLite | Durable |
| Active session id, current exercise index | SQLite (`sessions.state`) | Durable — survives kill |
| Rest timer start/pause timestamps | SQLite row on the session | Durable |
| Ticking display value | Zustand + `requestAnimationFrame` | Derived, never stored |
| Keypad open, sheet open, drag state | Local component state | Ephemeral |

The rule: **anything the user would be upset to lose is written to SQLite at the moment it happens.** No debouncing on set writes.

---

## 4. Data model

Portable to any of the four stacks. All timestamps stored as UTC epoch milliseconds; all durations in seconds.

```sql
-- Exercise library: seeded catalogue + user-created
CREATE TABLE exercises (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  equipment     TEXT NOT NULL,          -- barbell|dumbbell|cable|machine|bodyweight|other
  muscle_group  TEXT NOT NULL,          -- chest|back|legs|shoulders|arms|core|full
  is_custom     INTEGER NOT NULL DEFAULT 0,
  weight_step   REAL NOT NULL DEFAULT 2.5,   -- stepper increment (DESIGN.md §5.4.1)
  archived_at   INTEGER
);
CREATE UNIQUE INDEX idx_exercises_name ON exercises(name COLLATE NOCASE);

-- The weekly template: exactly 7 rows, day_of_week 1=Mon … 7=Sun
CREATE TABLE routine_days (
  day_of_week   INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 1 AND 7),
  name          TEXT,                   -- 'Chest + Triceps'; NULL = not configured
  is_rest       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL
);

-- Ordered exercise list for a routine day
CREATE TABLE routine_exercises (
  id            TEXT PRIMARY KEY,
  day_of_week   INTEGER NOT NULL REFERENCES routine_days(day_of_week) ON DELETE CASCADE,
  exercise_id   TEXT NOT NULL REFERENCES exercises(id),
  position      INTEGER NOT NULL
);
CREATE INDEX idx_rex_day ON routine_exercises(day_of_week, position);

-- A performed workout
CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY,
  day_of_week         INTEGER,
  name                TEXT NOT NULL,
  started_at          INTEGER NOT NULL,
  ended_at            INTEGER,          -- NULL while in progress
  status              TEXT NOT NULL,    -- active|completed|discarded
  note                TEXT,
  -- live workout state, so a crash resumes exactly where it stopped
  current_index       INTEGER NOT NULL DEFAULT 0,
  rest_started_at     INTEGER,          -- NULL = not resting
  rest_paused_at      INTEGER,          -- NULL = running
  rest_accumulated_s  INTEGER NOT NULL DEFAULT 0   -- seconds banked across pauses
);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);

-- Exercise instance within a session (snapshotted, so routine edits never rewrite history)
CREATE TABLE session_exercises (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id   TEXT NOT NULL REFERENCES exercises(id),
  position      INTEGER NOT NULL,
  skipped       INTEGER NOT NULL DEFAULT 0,
  ad_hoc        INTEGER NOT NULL DEFAULT 0   -- added mid-workout
);
CREATE INDEX idx_sex_session ON session_exercises(session_id, position);

-- The atomic unit of the product
CREATE TABLE sets (
  id                    TEXT PRIMARY KEY,
  session_exercise_id   TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_number            INTEGER NOT NULL,
  weight_kg             REAL NOT NULL,
  reps                  INTEGER NOT NULL,
  completed_at          INTEGER NOT NULL,
  rest_before_s         INTEGER,           -- rest preceding THIS set; NULL on set 1
  skipped               INTEGER NOT NULL DEFAULT 0   -- logged but not performed (v2)
);
CREATE INDEX idx_sets_sex ON sets(session_exercise_id, set_number);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL          -- unit (kg|lb), theme, reduced_motion, default_step
);
```

**Modelling decisions worth stating**

1. **`rest_before_s` on the set, not a separate table.** Rest is a property of the gap preceding a set. Storing it on the set makes the History rendering (§5.7) and the rest analytics (§5.6.1) trivial one-table queries.
2. **`session_exercises` snapshots the routine.** Reordering Monday next week must not retroactively reorder last month's log.
3. **Weight always stored in kg.** Pounds is a display conversion only. Mixed-unit storage is a permanent source of bad charts.
4. **Volume is computed, never stored.** `SUM(weight_kg * reps)`. It is cheap and it can never drift out of sync with an edited set.
5. **Timer state lives on the session row.** This is what makes "kill the app mid-rest and lose nothing" a two-line implementation instead of a subsystem.
6. **A skipped set is a row, not an absence.** `sets.skipped = 1` records that a set was deliberately not performed. Every aggregate — session volume, progression series, top-set queries, the next set's pre-fill — filters `skipped = 0`. Storing it costs one column and preserves information that deleting would throw away.

**Session-scoped exercise substitution**

`replaceSessionExercise()` updates `session_exercises.exercise_id` for one session only, leaving `routine_exercises` alone. Because `session_exercises` already snapshots the routine (decision 2), the two scopes are naturally separate — swapping an exercise for today cannot leak into next week, and editing the routine cannot rewrite today. The swap is refused when performed sets exist, since those sets are evidence about a different movement.

**The three queries that matter**

```sql
-- Last session's sets for an exercise (shown above today's inputs)
SELECT s.set_number, s.weight_kg, s.reps
FROM sets s
JOIN session_exercises se ON se.id = s.session_exercise_id
JOIN sessions sn ON sn.id = se.session_id
WHERE se.exercise_id = ?1 AND sn.status = 'completed' AND sn.id != ?2
ORDER BY sn.started_at DESC, s.set_number
LIMIT 8;   -- caller takes the most recent session's rows

-- Progression series: top set + volume + avg rest per session
SELECT sn.started_at,
       MAX(s.weight_kg)                       AS top_weight,
       SUM(s.weight_kg * s.reps)              AS volume,
       AVG(s.rest_before_s)                   AS avg_rest
FROM sets s
JOIN session_exercises se ON se.id = s.session_exercise_id
JOIN sessions sn ON sn.id = se.session_id
WHERE se.exercise_id = ?1 AND sn.status = 'completed'
GROUP BY sn.id
ORDER BY sn.started_at;

-- Session totals for History rows
SELECT sn.id, sn.name, sn.started_at, (sn.ended_at - sn.started_at)/60000 AS minutes,
       COUNT(s.id) AS set_count, SUM(s.weight_kg * s.reps) AS volume
FROM sessions sn
LEFT JOIN session_exercises se ON se.session_id = sn.id
LEFT JOIN sets s ON s.session_exercise_id = se.id
WHERE sn.status = 'completed'
GROUP BY sn.id ORDER BY sn.started_at DESC;
```

---

## 5. The rest timer — the piece to get right first

The single most failure-prone component. Specification:

```ts
// Derived, never accumulated. Correct after backgrounding, sleep, or crash.
function restElapsedSeconds(s: Session, now: number): number {
  if (s.rest_started_at == null) return 0;
  const end = s.rest_paused_at ?? now;
  return s.rest_accumulated_s + Math.floor((end - s.rest_started_at) / 1000);
}
```

| Action | Write |
|---|---|
| Set completed | `rest_started_at = now`, `rest_paused_at = null`, `rest_accumulated_s = 0` |
| Pause | `rest_paused_at = now` |
| Resume | `rest_accumulated_s += (now − rest_paused_at)/1000`; `rest_started_at = now`; `rest_paused_at = null` |
| Reset | `rest_started_at = now`, `rest_accumulated_s = 0`, `rest_paused_at = null` |
| Start next set / Skip | compute elapsed → write to the new set's `rest_before_s` → clear all three fields |

Rules:
- The display ticks on a **1 s interval, not `requestAnimationFrame`** — rAF runs 60 fps to advance a value that changes once a second, which is 60× the work for no visible benefit. The interval is purely a *rendering* concern, recreated freely on foreground, and never feeds the stored value.
- The ticking digits live in their own isolated component with nothing else subscribed, so the set table and header do not re-render each second. Preferably driven by a Reanimated shared value so the digits update on the UI thread and the React tree does not re-render at all (see §6).
- On app foreground, recompute from the timestamps rather than resuming a JS interval.
- Keep the screen awake for the session (`expo-keep-awake`), behind a user setting — see §6.
- Optional Phase 4 addition: mirror the running timer into an ongoing Android notification / iOS Live Activity. Note this adds a small persistent cost; make it opt-in.

Write this module with unit tests before any UI. Test: pause→resume→pause, background for 10 minutes, reset while paused, app kill and relaunch mid-rest.

---

## 6. Performance, battery, and app size

Forte is used for an hour at a time with the screen on. That single fact determines its energy profile.

### 6.1 Where the power goes

Estimates for a 60-minute session on a ~5000 mAh phone:

| Source | Per session | Notes |
|---|---|---|
| Screen on, kept awake | **8–15%** | Dominant cost. Brightness-dependent. |
| JS/UI thread (timer tick, animations) | < 0.5% | Only if the tick is isolated — §6.3 |
| SQLite writes | Negligible | ~20 writes/session, a few hundred bytes each |
| Network, GPS, Bluetooth, push | **0%** | The app has none |
| Background activity | **0%** | The app does nothing when backgrounded |

The two zero rows are the analysis. What drains battery in typical fitness apps is network polling, analytics beacons, location, ad SDKs, push sockets and background sync — all excluded by the product's non-goals. The app is competing against the screen and losing by roughly 20×, so optimising app code beyond §6.3 is measuring dust.

Dark theme as the default (`DESIGN.md` §3.2) is a further real saving on OLED, where dark pixels draw close to zero.

### 6.2 Screen-awake is a setting, not a given

Because rest time is derived from a stored timestamp (§5), **the screen being off costs nothing in correctness.** Lock the phone mid-rest, unlock 90 seconds later, and the timer reads the right value having consumed no power.

This makes a genuinely useful setting possible, and it should ship in Phase 2 rather than being deferred:

> **Keep screen awake during workout** — default on; off for battery-conscious sessions.

With it off and the screen live only while actually logging (~10 of the 60 minutes), session drain falls to roughly **2–4%** — about a 4× improvement, available purely as a consequence of the timer architecture.

### 6.3 The three things that would make it heavy

1. **Ticking the whole screen.** The naive implementation re-renders the Active Workout tree once a second for an hour — 3,600 renders of a screen containing a set table. This is the only real battery risk in the app. Fix per §5: isolated tick component, ideally a Reanimated shared value updating on the UI thread.
2. **Skia-backed charts.** `victory-native` XL pulls in `@shopify/react-native-skia` — ~5–8 MB of binary and a second rendering engine in-process. For four single-series line charts, `react-native-svg` is sufficient. **Decision: no Skia.** Hand-roll the charts on `react-native-svg` + `d3-scale`.
3. **Unmemoised progress aggregation.** The series query in §4 scans all sets for an exercise. Memoise per exercise; invalidate on workout completion, not on render.

### 6.4 App size and startup

| Build configuration | APK size |
|---|---|
| Default managed, universal APK | ~35–45 MB |
| R8 + resource shrinking + arm64-only ABI split, no Skia | **~15–20 MB** |

Hermes (the Expo default) is the correct engine — faster cold start and lower memory than JSC. Target **cold start under 1 second**, which matters more than binary size for an app opened while standing at a bench.

### 6.5 Performance budgets

Treat these as acceptance criteria, measured on the oldest device you intend to use:

| Metric | Budget |
|---|---|
| Cold start to Today rendered | < 1000 ms |
| Tap COMPLETE SET → row shows logged | < 100 ms |
| Set write committed to SQLite | < 50 ms, off the interaction path |
| Re-renders per second while resting | ≤ 1 component |
| Battery, 60-min session, screen awake | < 15% |
| Battery, 60-min session, screen-awake off | < 5% |

### 6.6 Stack comparison on energy

Native Kotlin would save perhaps 1–2% of a session's drain — real, but not worth the Android-only lock-in. A PWA would be measurably *worse*: browser engine overhead plus a less reliable wake lock. Expo is not a liability here.

---

## 7. Delivery phases

Each phase ends with something installed on your phone and usable.

### Phase 0 — Foundations (0.5 week)
- Expo + TypeScript strict + Expo Router skeleton; the four tab routes.
- Drizzle schema, migration runner, DB singleton.
- Seed ~180 exercises (`data/exercises.seed.json`), idempotent on first launch.
- Design tokens from `DESIGN.md` §3 as typed constants; `Text`, `Button`, `Screen` primitives with dark + light themes.
- Dev build on the phone via EAS.

**Done when:** the app installs, opens to four empty tabs, and the DB survives a relaunch.

### Phase 1 — Plan (1 week)
- Week screen: seven rows, three states (workout / rest / unconfigured), today marker.
- Customize Day: rename, exercise list, drag reorder, remove with Undo, set-as-rest.
- Add Exercise sheet: search, muscle-group filter chips, recents, multi-add, create-custom.
- Today screen skeleton reading from the routine: day name, workout name, exercise list, Rest Day and no-routine states.

**Done when:** you can build your real training split and Today shows the correct workout.

### Phase 2 — Log (1.5 weeks) · the core
- Rest timer module + tests (§5) — build this first.
- Active Workout: header with elapsed time and progress dots, one exercise at a time, set table, previous-session line.
- Number wells: steppers, custom numeric keypad, drag-scrub, pre-fill from previous set.
- COMPLETE SET → immediate persistence → rest panel; START SET *n* → rest written.
- Pause / Reset / Skip; edit logged set; add/remove set; skip exercise; add exercise mid-workout.
- Exercise completion state with 4 s auto-advance; minimise + resume bar; crash recovery.
- Visual feedback per `DESIGN.md` §7 — including the set-completion flash, which is the sole confirmation channel now that haptics are out of scope.
- Isolated 1 s tick component and the **keep-screen-awake setting** (§6.2, §6.3) — both belong here, not in polish.

**Done when:** you have logged three real workouts in a real gym without touching anything else.
This phase is the product. Do not start Phase 3 until it feels fast.

### Phase 3 — See (1 week)
- Finish Workout summary with previous-session comparison.
- History list with month grouping, filter chips, and session detail with inline rest values.
- Progress: exercise selector, Weight/Reps/Volume/Rest segments, line chart, summary stats, chronological table, "+5 kg since first session".
- All empty states from `DESIGN.md` §6.

**Done when:** you can answer "am I stronger than last month" in two taps.

### Phase 4 — Polish and durability (1 week)
- Light theme parity; kg/lb setting; reduced motion.
- JSON export + import; CSV export of sets. **Ship this before you rely on the app.**
- Tablet and desktop layouts (`DESIGN.md` §8).
- Accessibility pass: dynamic type to 200%, labels, contrast audit.
- Production build, signed, installed. Automatic weekly export reminder or scheduled backup to device storage.

**Total: ~5 weeks part-time.** Phases 0–2 (~3 weeks) already give a fully usable training log.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Timer drift or reset on background | Timestamp-derived design (§5), tested before UI exists |
| Data loss on crash | Write every set immediately; session state on the row; recovery test in Phase 2 |
| Data loss on device loss | JSON export in Phase 4, and treat it as non-optional; keep the SQLite file in a synced folder if you like |
| Scope creep (1RM, streaks, plate calculator, supersets) | The non-goals list in `DESIGN.md` §1 is the contract. Anything new must pass "faster logging or clearer progression" |
| Logging feels slow | Measure it: tap-to-logged-state must be under 100 ms. Optimistic UI, DB write off the interaction path |
| Migration mistakes corrupt history | Drizzle versioned migrations, forward-only; export before every schema change |
| iOS distribution friction (Option A) | Decide early: free profile with 7-day refresh, or $99/yr. Android has no equivalent friction |

---

## 9. Decisions to confirm before Phase 0

> **Decided:** Stack is **Option A — React Native via Expo (managed)**. Managed over bare CLI because every native capability Forte needs is already in the Expo SDK (`expo-sqlite`, `expo-keep-awake`, `expo-file-system`, Reanimated, Expo Router), and `expo prebuild` remains available later if a custom native module is ever required — so there is no lock-in cost to starting managed.

1. **Target platform** — Android only, iOS only, or both? Affects distribution only, not code: Android sideloads a signed APK with no friction; iOS needs either a free developer profile (rebuild every 7 days) or a $99/yr account for a permanent install.
2. ~~**Stack**~~ — decided above.
3. **Units** — kg only at first, or kg/lb from the start? (Storage is kg regardless.)
4. **Bodyweight exercises** — log reps only, or reps plus added weight? (Recommend: reps only, with an optional `+weight` field, so pull-ups do not distort volume charts.)
5. **Exercise library size** — a curated ~180, or a larger public dataset seeded in?

None of these block starting Phase 0 except #2. Defaults if you say nothing: Option A, both platforms, kg only, bodyweight reps-only with optional added weight, curated 180-exercise library.
