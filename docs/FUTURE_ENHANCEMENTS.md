# Forte — Future Enhancements

Everything that could come after v1, with the research behind it: what it costs, what it breaks,
and whether it is worth doing.

Companion documents: [`DESIGN.md`](DESIGN.md) · [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) · [`SETUP_GUIDE.md`](SETUP_GUIDE.md)

Researched against the ecosystem as of **September 2026** (Expo SDK 57, React Native 0.86,
Android 16, Health Connect 1.1).

---

## 0. The two gates

Nothing in this document ships unless it clears both.

**Gate 1 — the product gate.** `IMPLEMENTATION_PLAN.md` §8 states the contract: anything new must
make *logging faster* or *progression clearer*. A feature that is merely interesting is scope creep
wearing a nice shirt.

**Gate 2 — the architecture gate.** Three invariants are not negotiable, and every proposal below
is written to preserve them:

| Invariant | Where it lives | What it forbids |
|---|---|---|
| Rest time is derived from stored timestamps, never accumulated | `src/features/workout/rest-timer.ts` | A watch, notification or widget that runs its *own* clock. They render the derived value; they never own it. |
| No network in the critical path | Everywhere | Sync, Drive, Health Connect and BLE are all post-hoc or opt-in. A dead network must never delay a set write. |
| Every set is written the moment it is logged | `queries/session.ts` | Batching writes to make some upload cheaper. |

**Gate 3, informally: distribution cost.** Forte is sideloaded and updated with `npm run update`.
That only pushes JavaScript. Anything requiring a new native module means a fresh APK, the EAS
build queue, and the same signing keystore (§5 of the setup guide) — a materially higher cost per
change. Tiers below reflect that:

| Tier | Meaning | Cost |
|---|---|---|
| **T1** | Pure JS/TS. Ships over the air. | Minutes |
| **T2** | New native dependency or config plugin. New APK. | Hours + build queue |
| **T3** | A second codebase in another language. | Weeks, forever |

---

## 1. Data durability and Google Drive

The single real risk to this app is a lost phone. Manual monthly export (setup guide §7) is the
current mitigation and it depends on you remembering. Four ways to fix that, in ascending cost.

### 1.1 Android Auto Backup — already half-working, worth confirming · T2 (config only)

Expo's `android.allowBackup` **defaults to true**, and Android's Auto Backup uploads app data to
the user's Google Drive automatically for apps targeting API 23+, restoring it when the app is
reinstalled or moved to a new device. So a Drive backup of `forte.db` may already exist and you
have never tested it.

- Docs: <https://developer.android.com/identity/data/autobackup> · Expo key: <https://docs.expo.dev/versions/latest/config/app/>
- The Drive quota for Auto Backup is orders of magnitude larger than Forte's footprint (~0.8 MB/year).
- Add explicit `dataExtractionRules` XML (`<cloud-backup>` and `<device-transfer>` sections) so the
  SQLite directory is included deliberately rather than by default, and so WAL/SHM sidecar files
  are handled sanely. Checkpoint (`PRAGMA wal_checkpoint(FULL)`) on background so the backed-up
  `.db` is self-contained.
- Note the OEM quirk: on some manufacturers `allowBackup="false"` disables cloud backup but *not*
  device-to-device transfer. Do not treat the flag as a privacy guarantee either way.
- **Test it, or it does not exist:**
  ```bash
  adb shell bmgr backupnow <your.package.name>
  adb shell bmgr list transports
  adb shell bmgr restore <token> <your.package.name>
  ```

**Verdict: do this first.** It is the cheapest possible protection against phone loss, it costs no
runtime battery, and the work is mostly verification. It is *not* a sync mechanism — restore only
happens at install time — so it does not replace §1.2.

### 1.2 Scheduled export to a folder you already sync · T1/T2

The pragmatic version of "Drive backup" with no OAuth at all: write the JSON export into a
directory that Google Drive, Syncthing or your file manager already syncs.

- Ask once via `FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()`, persist the
  returned tree URI in `settings`, and write every subsequent backup there with no picker.
- Trigger on **workout completion** (you are already in the app, the data just changed, and the
  write is ~4 KB) rather than on a timer. Optionally also on cold start if the newest backup is
  older than N days.
- `expo-background-task` (WorkManager under the hood) exists for the timer version, but read its
  constraints first: tasks are deferred by the OS, stop when the user force-quits the app, and
  **only run when the battery is sufficient and the network is available** — an odd dependency for
  an offline app writing to local storage. <https://docs.expo.dev/versions/latest/sdk/background-task/>
- Keep a rolling window (say the last 12 files, `forte-YYYY-MM-DD.json`) so a corrupted export
  cannot overwrite the only good one.

**Verdict: highest value per hour of work in this entire document.** Combined with §1.1 it makes
data loss a non-event, and it adds zero dependencies to the critical path.

### 1.3 Real Google Drive integration (`appDataFolder`) · T2

Only worth it if you want the backup to be restorable on a device where the SAF folder is not
already synced.

Shape:

1. `@react-native-google-signin/google-signin` or `expo-auth-session` for the OAuth code+PKCE flow.
2. Scope `https://www.googleapis.com/auth/drive.appdata` — a private, per-app folder that is
   invisible in the user's Drive UI and inaccessible to other apps.
3. Multipart upload to `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` with
   `parents: ['appDataFolder']` on create, `PATCH` on update (re-sending `parents` on update
   errors). Worked example: <https://cmichel.io/google-drive-in-react-native>

The gotchas are all in Google's console, not in your code:

| Gotcha | Detail |
|---|---|
| **7-day token death** | While the OAuth consent screen is in **Testing**, test-user authorisations — and any refresh token — expire seven days after consent. You will be re-signing in every week forever. <https://support.google.com/cloud/answer/15549945> |
| The fix | Publish the consent screen to **In production**. Refresh tokens then persist. |
| Verification | Personal-use apps under 100 users are exempt from OAuth verification; you accept an "unverified app" interstitial at sign-in. Sensitive-scope verification takes 3–5 business days if you ever want it gone. <https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification> |
| Critical path | Sign-in, token refresh and upload all happen **after** `status = 'completed'` is written. A Drive failure is a toast, never a blocked workout. |

**Verdict: do it only after §1.1 and §1.2 are in place, and only if you actually want it.** It adds
an account, a network dependency and a Google Cloud project to an app whose selling point is having
none of those.

### 1.4 True multi-device sync · T2, high risk

`IMPLEMENTATION_PLAN.md` §2 is blunt: *do not build this with a backend, a sync layer, or a cloud
database.* That judgement still holds for a single-user training log. Recorded here so the option
is evaluated rather than rediscovered:

| Option | Fit | Cost |
|---|---|---|
| **Turso Offline Sync** (libSQL) | Closest fit — SQLite-to-SQLite bidirectional sync with conflict detection, integrates directly with `expo-sqlite` | A hosted database, an account, a schema contract |
| **PowerSync** | Mature RN SDK, has a Drizzle integration; syncs SQLite ↔ Postgres/MongoDB/MySQL | A server-side service, managed or self-hosted; pricing scales with usage |
| **WatermelonDB / RxDB** | Would mean replacing the data layer wholesale | Rewrite |
| **Hand-rolled** | Last-write-wins over a append-only change log; every row already has a `TEXT` UUID primary key and an epoch-ms timestamp, which is 80% of what sync needs | Weeks, and it is now a distributed system |

Prior art worth reading before starting: a developer of another RN workout tracker (Skulpt)
rejected all four libraries and wrote plain TypeScript LWW sync on top of SQLite —
<https://dev.to/superoskin/i-didnt-need-powersync-so-i-built-sync-on-top-of-sqlite-in-react-native-p95>

**Verdict: no, unless a second device becomes a real requirement.** Two phones is not a reason;
a phone plus a tablet you actually train with might be.

---

## 2. Wearables

### 2.1 Health Connect — write completed sessions out · T2

The highest-leverage wearable integration, and it needs no watch at all. Health Connect is now the
platform API for fitness data on Android; the Google Fit APIs are supported only until the **end of
2026**. <https://developer.android.com/health-and-fitness/health-connect/experiences/workouts>

What Forte can write, mapping cleanly onto the existing schema:

| Forte | Health Connect |
|---|---|
| `sessions` row | `ExerciseSessionRecord`, `exerciseType = EXERCISE_TYPE_STRENGTH_TRAINING`, `title = sessions.name` |
| `session_exercises` | one `ExerciseSegment` per exercise, `startTime`/`endTime` from the first and last set |
| `sets` | `ExerciseSegment.repetitions` and `setIndex` — the API models sets and reps natively |

What Forte can *read*, which is more interesting:

- `WeightRecord` → bodyweight progression with zero manual entry (see §4.5), populated by any smart
  scale you own.
- `HeartRateRecord` → post-hoc heart rate overlay on a session, recorded by a watch that Forte
  never talks to and never drains battery for.

Implementation notes:

- `react-native-health-connect` v4+ **bundles its own Expo config plugin** — the separate
  `expo-health-connect` package is gone, and leaving it installed breaks the Android build with a
  duplicate-class error. <https://github.com/matinzd/react-native-health-connect>
- Requires `minSdkVersion 26`, `compileSdkVersion`/`targetSdkVersion 36` via `expo-build-properties`.
- Not available in Expo Go. Development build or APK only.
- The Play Console health-data declaration (the standalone Google Form was retired 3 September 2026)
  applies to **Play Store distribution**. Forte is sideloaded, so this does not apply — worth
  knowing if that ever changes.

**Verdict: the best wearable feature in this document.** Write-on-finish is ~150 lines, entirely
outside the critical path, and it makes Forte a good citizen of the phone's health ecosystem
without adopting a single one of its dependencies.

### 2.2 A Wear OS companion app · T3

The honest assessment, and it is not close: **React Native does not target Wear OS.** A real watch
app means a second codebase in Kotlin + Jetpack Compose for Wear, communicating over the Google
Play Services Wearable Data Layer. This is exactly why almost no RN-based strength app has one —
see the write-up at <https://arvo.guru/blog/wear-os-strength-training-gap>.

**The free 80%, available today with zero watch code:** if the watch is paired, Wear OS
automatically bridges the phone's notifications — including action buttons — to the wrist. Ship the
ongoing rest-timer notification in §3.1 and you get a glanceable rest timer and a
`START SET n` button on your watch for free. Do this before considering anything below.

If you ever build the real thing, the design constraints follow from Gate 2:

- **The phone stays the source of truth.** The watch is a remote control and a display, never a
  second database. No SQLite on the watch.
- **The watch derives rest time from the same timestamps.** The phone sends
  `{ restStartedAt, restPausedAt, restAccumulatedS }`; the watch computes `restElapsedSeconds()`
  with the identical formula from `rest-timer.ts`. A watch that runs its own `Timer` is the exact
  bug the entire architecture exists to prevent.
- **A shared JSON message protocol**, versioned, over `MessageClient`/`DataClient`. Four messages
  cover the product: `session.state`, `set.complete`, `rest.control`, `session.finish`.
- Bridging library if the phone side needs to be RN-driven: `react-native-wear-connectivity`
  (<https://github.com/fabOnReact/react-native-wear-connectivity>). The watch UI is still Kotlin.

**Verdict: not worth it for a personal app.** Take the notification bridge instead. Revisit only if
you find yourself pulling the phone out of a pocket between every set — and note that gym reality
usually has the phone on the bench next to you anyway.

### 2.3 Bluetooth heart-rate strap · T2

`react-native-ble-plx` ships its own Expo config plugin (3.1.1+), so this is mechanically easy:
`plugins: ["react-native-ble-plx"]`, prebuild, done. Standard GATT Heart Rate Service (0x180D),
notify on characteristic 0x2A37.

But look at the battery table in `IMPLEMENTATION_PLAN.md` §6.1. Two rows read **0%**: "Network,
GPS, Bluetooth, push" and "Background activity". A live BLE connection for 60 minutes deletes one
of the two rows that made that analysis so clean, in exchange for a metric that does not make
logging faster or progression clearer for barbell training.

**Verdict: no.** If you want heart rate, read it from Health Connect after the session (§2.1) —
your watch already recorded it, and Forte pays nothing.

---

## 3. Glanceable surfaces on the phone

### 3.1 Ongoing rest-timer notification / Android 16 Live Updates · T2

Already anticipated in `IMPLEMENTATION_PLAN.md` §5 as an optional Phase 4 addition. Android 16 made
it substantially better: `Notification.ProgressStyle` gives progress-centric notifications with
segments and points, top ranking in the shade, and — with the `POST_PROMOTED_NOTIFICATIONS`
permission — promotion to a **status-bar chip and lock-screen presence**.
<https://developer.android.com/about/versions/16/features/progress-centric-notifications>

Fit for Forte is unusually good: rest is a bounded, user-initiated, start-to-end journey. Segments
map to the sets in the current exercise; the point is the target rest time.

- `expo-notifications` does not expose `ProgressStyle` or the promoted-notification permission.
  Either a small config plugin + native module, or `Voltra` (Callstack), which renders ongoing
  notifications and Android widgets from JSX via Jetpack Compose Glance —
  <https://github.com/callstackincubator/voltra>.
- **The notification must never own the clock.** Re-post it from the same derived value on the same
  1 s tick, or on lifecycle events only. If the process dies and comes back, the notification
  recomputes from `sessions.rest_started_at` like everything else.
- Keep it opt-in, as §5 already specifies: a persistent notification is a small but real cost.

**Verdict: yes, and it is the highest-value native addition** — because it also delivers the watch
experience of §2.2 for free.

### 3.2 Home screen widget · T2

"Today: Push Day · 5 exercises · START" on the home screen. Two viable routes on Android:

- `react-native-android-widget` — mature, Expo config plugin, task-handler model
  (`WIDGET_ADDED`/`WIDGET_UPDATE`/`WIDGET_CLICK`). <https://saleksovski.github.io/react-native-android-widget/>
- `Voltra` — JSX → Glance, same library as §3.1 if you adopt it there.

Note that Expo's own `expo-widgets` (stable as of SDK 56) is **iOS-only**. It does not help here.

Design constraint: widgets are rendered by the system, potentially while the app is not running, so
the widget must not query SQLite. Write a tiny `today.json` snapshot on every routine mutation
(alongside `bumpRevision()`) and have the widget read that.

**Verdict: nice, not necessary.** It saves one tap. Do it after §3.1 if the widget habit appeals.

### 3.3 App shortcut / Quick Settings tile · T2, small

Long-press the launcher icon → "Start today's workout". Static shortcuts are a manifest entry; a
Quick Settings tile is a small native service. Both are cheap, both save exactly one tap.

**Verdict: bundle with §3.2 if you touch native code at all. Not worth a build on its own.**

---

## 4. Product features that pass the product gate

Ordered by value against "faster logging or clearer progression". All are **T1** — pure JS/TS,
shippable with `npm run update` — except where a migration is noted, and migrations are still JS
(`MIGRATIONS` in `src/db/migrations.ts`, forward-only, never edit a shipped one).

### 4.1 Next-set target from last session — *clearer progression*

The best feature in this list. The Active Workout screen already shows the previous session's line;
one step further is a suggested target: last session's top set + one `weight_step` if all reps were
completed, unchanged if not. It turns a log into a plan without adding a programming engine.

Query already exists (`IMPLEMENTATION_PLAN.md` §4, "last session's sets"). No schema change.

### 4.2 Plate calculator — *faster logging*

Given `weight_kg` and a bar weight, render the plates per side. Removes the one piece of mental
arithmetic that happens at the rack. Settings: bar weight (20/15/10 kg), available plate inventory.
Store both in `settings`. Show it inline under the number well, not on a separate screen.

Schema: none. ~120 lines.

### 4.3 Warm-up set generator — *faster logging*

From the working weight, generate the standard ramp (e.g. 40/60/80% × descending reps) as
pre-filled, skippable rows flagged so they are excluded from volume charts.

Schema: `ALTER TABLE sets ADD COLUMN is_warmup INTEGER NOT NULL DEFAULT 0;` — and every progression
query then needs `AND s.is_warmup = 0`. Cheap column, but audit `queries/progress.ts` carefully.

### 4.4 RPE / RIR — *clearer progression*

One optional field per set. Makes "am I stronger" answerable when the weight has not moved.

Schema: `ALTER TABLE sets ADD COLUMN rpe REAL;`. Add as a fifth Progress segment. Keep the input
out of the primary tap path — a long-press on the logged row, not a third number well.

### 4.5 Bodyweight tracking — *clearer progression*

A `bodyweight (recorded_at INTEGER PRIMARY KEY, weight_kg REAL NOT NULL)` table, one chart, and
relative-strength lines for bodyweight exercises. Optionally back-filled from Health Connect
`WeightRecord` (§2.1) so you never type it.

### 4.6 Estimated 1RM — *clearer progression*

Epley `w × (1 + r/30)` or Brzycki `w × 36/(37 − r)`, as an additional Progress segment.

**Computed, never stored** — the same rule as volume (`IMPLEMENTATION_PLAN.md` §4, decision 4). A
stored estimate drifts the moment a set is edited.

### 4.7 PR detection — *clearer progression*

"Heaviest ever" and "best estimated 1RM" per exercise, surfaced on the Finish Workout summary. Pure
query work over data already there. Resist streaks, badges and confetti; the flash on set
completion is the app's only celebration and that is a design position, not an oversight.

### 4.8 Supersets and rest-pause — *faster logging*

The current model assumes one exercise at a time. A superset needs a grouping key:
`ALTER TABLE session_exercises ADD COLUMN group_id TEXT;` plus routine-side equivalent, and the
Active Workout screen must cycle within a group before advancing.

This is the largest UI change in this section and it touches the screen the plan explicitly says
must stay fast. **Only build it if you actually train supersets.**

### 4.9 Exercise library expansion — licensing matters

| Source | Size | Licence | Note |
|---|---|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 800+ | **Unlicense (public domain)** | JSON + images, no attribution required. The safe default. |
| [wger](https://github.com/wger-project/wger) | 845+ | AGPL-3.0 project; exercise content CC/AGPL, carries `license` and `license_author` per record | Attribution obligations travel with the data |
| [exercemus/exercises](https://github.com/exercemus/exercises) | curated | MIT code, per-exercise licences | Single minified JSON, convenient |
| RepDB free tier | 250 of 518+ | Free with **required visible attribution**, no dataset redistribution | Consistent original illustrations |

Bundling images pushes the APK well past the ~15–20 MB target in `IMPLEMENTATION_PLAN.md` §6.4.
If you want illustrations, prefer a small curated subset over the whole set.

### 4.10 Import from other trackers — *one-time, high value if migrating*

Strong and Hevy both export flat CSV. A one-shot importer that maps their columns onto
`sessions` → `session_exercises` → `sets` gives you years of history to chart on day one. Fuzzy
exercise-name matching against the seeded library is the only hard part; make unmatched names
create custom exercises rather than failing the import.

---

## 5. Paying down the known deviations

From `SETUP_GUIDE.md` §10, both worth closing once the app is stable on your device:

1. **Drag-and-drop reorder** in Customize Day, replacing the up/down chevrons. Needs
   `react-native-draggable-flatlist` + gesture-handler/reanimated version alignment. **T2.** Note
   that Expo SDK 57 bumped the animation and gesture libraries, and SDK 56 shipped a Hermes V1
   memory regression affecting `react-native-worklets`/`reanimated` that is fixed in 57 — do this
   work on 57 or later, not before.
2. **Custom `⋯` popovers** replacing native `Alert` action sheets. Pure UI, **T1**. Expo UI's
   Jetpack Compose primitives (stable since SDK 56) are now a credible way to build these with
   native feel.

---

## 6. Deliberately not building

Restating the non-goals so they stay decided rather than relitigated:

| Not building | Why |
|---|---|
| Accounts, social feeds, sharing | Constraint 1. The product is a private log. |
| Ads, analytics, crash telemetry | The 0% network row in the battery analysis is a feature. |
| An AI coach or auto-programming | Neither faster logging nor clearer progression; adds a network dependency to a basement-gym app. |
| Live in-workout HR polling | §2.3. |
| Skia-backed charts | Explicitly rejected: `IMPLEMENTATION_PLAN.md` §6.3. `react-native-svg` + `d3-scale` is sufficient. |
| Streaks, badges, gamification | Optimises for opening the app, not for training. |
| Nutrition, cardio, body measurements beyond weight | A different product. |

---

## 7. Schema changes: the standing rules

Every feature above that touches the database obeys the same procedure — restated because it is the
one place where a mistake destroys history rather than annoying you:

1. Export a backup **before** any schema change. Non-negotiable.
2. Append a new array to `MIGRATIONS` in `src/db/migrations.ts`. **Never edit a shipped migration.**
3. Mirror the change in `src/db/schema.ts`.
4. Prefer additive, nullable columns with defaults. Every migration in this document is an
   `ALTER TABLE ... ADD COLUMN`, which is what makes them safe.
5. Any new write path calls `bumpRevision()`, or the UI silently will not update.
6. Weight stays in kilograms. Always.

Consolidated view of the columns proposed here:

```sql
ALTER TABLE sets              ADD COLUMN is_warmup INTEGER NOT NULL DEFAULT 0;  -- 4.3
ALTER TABLE sets              ADD COLUMN rpe REAL;                              -- 4.4
ALTER TABLE session_exercises ADD COLUMN group_id TEXT;                         -- 4.8
CREATE TABLE bodyweight (                                                       -- 4.5
  recorded_at INTEGER PRIMARY KEY,
  weight_kg   REAL NOT NULL
);
```

---

## 8. Suggested order

| # | Item | Tier | Effort | Why here |
|---|---|---|---|---|
| 1 | Verify Android Auto Backup (§1.1) | T2 | 2 h | Protects everything else |
| 2 | Backup-on-finish to a synced folder (§1.2) | T1 | 4 h | Ends the "did I export?" problem |
| 3 | Next-set target (§4.1) | T1 | 4 h | Best progression feature, no new deps |
| 4 | Plate calculator (§4.2) | T1 | 3 h | Best logging-speed feature |
| 5 | PR detection (§4.7) | T1 | 3 h | Pure query work over existing data |
| 6 | Ongoing rest notification (§3.1) | T2 | 1–2 d | Also delivers the watch experience free |
| 7 | Health Connect write + weight read (§2.1) | T2 | 1–2 d | Ecosystem citizenship, zero runtime cost |
| 8 | RPE (§4.4) / warm-up sets (§4.3) | T1 | 1 d | First migrations; do them together |
| 9 | Drag reorder + custom popovers (§5) | T2/T1 | 1 d | Close the design-doc gaps |
| 10 | Widget (§3.2) | T2 | 1 d | Convenience |
| — | Drive OAuth (§1.3), Wear OS (§2.2), sync (§1.4) | T2/T3 | — | Only on a real need |

---

## 9. Compatibility watch-list

Things that will age, with what was true in September 2026:

| Item | State | Implication |
|---|---|---|
| Expo SDK | **57** (30 Jun 2026), React Native 0.86, React 19.2 | SDK 57 is a small, low-risk upgrade over 56 |
| SDK 56 | React Native 0.85; known **Hermes V1 memory regression** with `reanimated`/`worklets`, fixed in 57 | Upgrade to 57 before adding animation-heavy deps |
| SDK 54 | Supported until roughly Sept–Oct 2026 | If Forte is still on 54, upgrade incrementally, one SDK at a time |
| `expo prebuild` | Clears and regenerates `android/` and `ios/` by default in SDK 57 (`--no-clean` to opt out) | Do not hand-edit native directories |
| Expo UI | Jetpack Compose + SwiftUI APIs stable since SDK 56 | Viable for native-feel UI work (§5) |
| `expo-widgets` | Stable — **iOS only** | Android widgets need a community library (§3.2) |
| Google Fit APIs | Supported until **end of 2026** | Health Connect is the only correct target (§2.1) |
| Health Connect declaration | Moved to Play Console; standalone form retired 3 Sept 2026 | Irrelevant while sideloading |
| Android 16 Live Updates | `ProgressStyle` + `POST_PROMOTED_NOTIFICATIONS` | Basis for §3.1 |

---

## 10. The one thing that must survive all of this

Every feature above renders, mirrors, uploads or annotates the rest timer. **None of them owns it.**
`src/features/workout/rest-timer.ts` computes elapsed time from the timestamps on the session row,
and it stays that way whether the value is being drawn on a phone, a watch face, a notification
chip or a home screen widget.

If a future enhancement requires changing that, the enhancement is wrong.
