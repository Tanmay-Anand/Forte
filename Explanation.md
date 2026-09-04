# Forte — Explanation

> **Status: built, running, and verified on device.** Unlike a blueprint, every claim here can be
> checked against `D:\Tanm\Projects\Forte`. The app runs on an Android emulator and in Expo Go;
> typecheck is clean, 19 tests pass, `expo-doctor` reports 18/18.
>
> Claims are tagged so you can tell what kind of statement each one is:
> **[VERIFIED]** — I ran it and watched the result (on device, or as a passing test).
> **[REC]** — a judgement call, with the reasoning given.
> **[EST]** — an estimate, not a measurement.
>
> **Where the interesting content is:** §5 (the rest timer, from first principles) and §11 (weak
> points). The rest is context. If you read one section, read §5 — it is the only genuinely
> non-obvious idea in the project, and it is the reason the app can do something most workout
> trackers get subtly wrong.

---

## 1. The One-Liner

Forte is an offline workout tracker whose defining trick is that it never counts time — it reads
the clock — which is why its rest stopwatch stays correct through backgrounding, a sleeping
screen, and the app being killed outright.

---

## 2. The Problem

### The thing being built

A personal training log. You plan which muscle groups you train on which days, and in the gym you
record what you actually lifted: weight and reps, set by set. Later you want to know whether the
numbers are going up.

That is a solved problem in the sense that dozens of apps do it. It is not solved in the sense
that most of them are unpleasant to use at the moment that matters — standing between sets,
sweaty, holding a phone in one hand, with about four seconds of attention available.

### Why the obvious implementation is subtly wrong

The obvious rest timer is a countdown or a stopwatch driven by `setInterval`:

```js
let seconds = 0;
setInterval(() => { seconds += 1; render(seconds); }, 1000);
```

This is wrong in a way that does not show up in testing and does show up in a gym.

**[FACT]** Mobile operating systems throttle or suspend JavaScript timers when an app is
backgrounded or the screen locks. On Android, a backgrounded React Native app's JS thread is
paused; on iOS it is suspended within seconds. The interval does not fire. `seconds` stops
increasing. When you come back, the timer reads however far it got before the OS stopped it.

So: you finish a set, the phone screen times out, you rest ninety seconds, you wake the phone —
and the timer says nineteen seconds. Not an error message, not a crash. Just a plausible, wrong
number, written into your training log forever.

**[REC]** This matters more than it sounds. The whole justification for tracking rest
automatically is that a manually-typed rest time is a guess. If the automatic one is also a guess,
you have added a feature that produces confident, precise-looking fiction.

### The second problem: everything is a distraction

**[REC]** Fitness apps drift toward being social products. Feeds, streaks, badges, friends,
challenges, calorie rings, "you're on fire!" — each is individually defensible and collectively
they mean that logging a set involves navigating a product that wants something from you.

A training log wants nothing from you. It is a notebook.

### The third problem: your data outlives the app

**[REC]** A workout log is a multi-year artifact. The app that holds it is not. Any design that
puts five years of training history somewhere you cannot get it out of — a proprietary cloud, an
account you might lose, a company that might fold — is making a promise it cannot keep.

---

## 3. How It Works — Plain English

### The analogy

Two ways to know how long you have been resting.

**The counting way:** start a metronome and count the ticks. Simple, works fine — as long as
nothing stops the metronome. If someone pauses it while you are not looking, your count is short
and you have no way to know by how much.

**The reading way:** look at the clock on the wall, note the time, and when you want to know how
long it has been, look again and subtract. The wall clock does not care whether you were watching.
You can leave the room, fall asleep, be unconscious for an hour — the subtraction is still right.

Forte reads the clock. **[VERIFIED]** When you tap COMPLETE SET, it writes the current timestamp
into the database. Whenever it needs to display the rest time, it subtracts that stored timestamp
from *now*. The number ticking on screen every second is a rendering detail — a repaint, not a
count. If every one of those repaints failed to happen, the stored value would still be correct.

### The consequence nobody expects

Once the timer reads the clock, **the screen does not need to be on.**

That unlocks something no counting-based timer can offer: a setting to let the phone sleep between
sets. **[EST]** A 60-minute session with the screen awake costs roughly 8–15% of a phone battery;
with the screen only on while you are actually logging, it drops to about 2–4%. Roughly fourfold,
for free, because of a decision made about arithmetic.

### Tracing one user action

You finish a set of bench press and tap **Complete Set**.

1. The tapped values (67.5 kg, 8 reps) are written to the `sets` table immediately — one `INSERT`,
   not queued, not debounced.
2. In the same transaction, the session row gets `rest_started_at = now`.
3. A global revision counter increments. Every screen showing workout data recomputes.
4. The rest bar appears. Its digits component — and *only* that component — starts a 1-second
   repaint.
5. You rest. The phone may sleep. The app may be killed. Nothing in the database changes.
6. You tap **Start Set 2**. The app computes `now − rest_started_at`, gets 92 seconds, parks it in
   `pending_rest_s`, and clears the timer fields.
7. You lift, then tap **Complete Set** again. The new set row is inserted with
   `rest_before_s = 92` — the rest that *preceded* it — and the stopwatch restarts.

**[VERIFIED]** Steps 5–7 survive a `force-stop` of the app mid-rest. I killed it on the emulator
during a rest period, relaunched, and the resume bar showed the correct elapsed value.

---

## 4. How It Works — Technical

### 4.1 System shape

```
Expo Router (file-based routes)
  app/(tabs)/          Today · Week · Progress · History
  app/workout/active   ← full-screen modal ABOVE the tab stack
      ↓ reads/writes
src/db/queries/*       plain functions, synchronous
      ↓
Drizzle ORM  →  expo-sqlite  →  forte.db on device
      ↑
src/lib/db-hooks.ts    revision counter; every mutation bumps it
```

No server, no network layer, no sync engine, no cache invalidation strategy. The database is the
source of truth and it is local.

### 4.2 The data model, and the two decisions inside it

```sql
CREATE TABLE sets (
  id                  TEXT PRIMARY KEY,
  session_exercise_id TEXT NOT NULL,
  set_number          INTEGER NOT NULL,
  weight_kg           REAL NOT NULL,
  reps                INTEGER NOT NULL,
  completed_at        INTEGER NOT NULL,
  rest_before_s       INTEGER,          -- rest PRECEDING this set; NULL on set 1
  skipped             INTEGER NOT NULL DEFAULT 0
);
```

**Rest lives on the set it precedes, not in its own table.** A rest period is the gap before a
set, so attaching it to that set makes both the history rendering ("show rest between sets") and
the analytics ("average rest for this exercise") single-table reads. A separate `rests` table
would need a join and an ordering convention to answer the same questions.

**A skipped set is a row, not an absence.** "I did not do set 3" is information. Deleting it
throws that away; a session with a skipped third set becomes indistinguishable from a session with
two sets. The cost is that *every* aggregate must filter `skipped = 0` — volume, progression, top
set, and the pre-fill for the next set. **[VERIFIED]** Missing that filter in the pre-fill was a
real bug: after skipping a set, the next set's inputs pre-filled with the skipped row's zeros.

```sql
CREATE TABLE sessions (
  ...
  current_index      INTEGER NOT NULL DEFAULT 0,
  rest_started_at    INTEGER,   -- NULL = not resting
  rest_paused_at     INTEGER,   -- NULL = running
  rest_accumulated_s INTEGER NOT NULL DEFAULT 0,  -- banked across pauses
  pending_rest_s     INTEGER    -- measured, awaiting the next set
);
```

Live workout state lives on the session row rather than in memory. This is what makes crash
recovery a non-feature: there is no "restore session?" prompt because there is nothing to restore.
The app reads the row and continues.

### 4.3 The timer module

`src/features/workout/rest-timer.ts` is pure. No database, no React, no side effects — which is
why it can be tested with plain Node.

```ts
export type RestState = {
  startedAt: number | null;    // null = not resting
  pausedAt: number | null;     // null = running
  accumulatedS: number;        // banked across previous pause cycles
};

export function restElapsedSeconds(s: RestState, now: number): number {
  if (s.startedAt == null) return 0;
  const end = s.pausedAt ?? now;
  const live = Math.floor((end - s.startedAt) / 1000);
  return s.accumulatedS + Math.max(0, live);
}
```

Five lines. Everything else in the timer is a transition that produces a new `RestState`:

| Action | Effect |
|---|---|
| Set completed | `startedAt = now`, `pausedAt = null`, `accumulatedS = 0` |
| Pause | `pausedAt = now` |
| Resume | bank `(pausedAt − startedAt)` into `accumulatedS`; `startedAt = now`; `pausedAt = null` |
| Reset | `startedAt = now`, `accumulatedS = 0` |
| Stop | compute elapsed, write to the next set's `rest_before_s`, clear all three |

The `Math.max(0, live)` guards a backwards clock — a manual time change or an NTP correction
should produce zero, not a negative rest.

**[VERIFIED]** 13 tests cover this, including a simulated 10-minute background gap, five
pause/resume cycles with no drift, reset-while-paused, and rehydration from stored fields after
process death.

### 4.4 Reactivity without a subscription layer

```ts
export function useQuery<T>(run: () => T, deps: readonly unknown[] = []): T {
  const rev = useRevision((s) => s.rev);
  return useMemo(run, [rev, ...deps]);
}
```

Every mutation calls `bumpRevision()`. Every dependent query recomputes.

This looks lazy and is deliberate. **[REC]** SQLite reads at this data scale are sub-millisecond;
a subscription/observable layer would add a dependency, a mental model, and a class of
stale-cache bugs to save work that costs nothing. The trade is real though: forget the
`bumpRevision()` call in a new write path and the UI silently does not update — no error, no warning.

### 4.5 Migrations

Forward-only DDL keyed on `PRAGMA user_version`, not drizzle-kit codegen. **[REC]** This removes a
codegen step and the Metro `.sql` transformer from the build; for a single-user app with no
rollback story, the ceremony was not buying anything. **[VERIFIED]** v2 (adding `sets.skipped`)
applied cleanly to a database that already had eight sessions of real data in it.

### 4.6 The one-component-per-tick rule

During rest, exactly one component re-renders each second: `RestClock`. The set table, the header
and the exercise name are outside it.

**[REC]** This is the difference between 3,600 repaints of a tiny text node over an hour and 3,600
re-renders of a whole screen. The naive version — putting the elapsed seconds in the screen's
state — is what most implementations do and is why some trackers are noticeably warm in the hand.

---

## 5. The Core Concept: Derived Time, From First Principles

### 5.1 The two models

Any elapsed-time display is one of these:

**Accumulated.** Maintain a counter. Add to it on a schedule. The counter *is* the truth.
**Derived.** Store a start instant. Compute `now − start` on demand. The clock is the truth; your
stored instant is just a bookmark.

They produce identical output when nothing goes wrong. They diverge completely when something does.

### 5.2 Why accumulation is a lie about the world

An accumulated counter encodes an assumption: *my process runs continuously and my scheduler is
reliable.* On a phone this is false by design. The OS suspends apps to save battery — that is not
a failure mode, it is the operating system working correctly.

So the counter is not measuring elapsed time. It is measuring *how much time my process was
awake and my timer fired.* Those are different quantities, and the app is displaying one while
labelling it the other.

The failure is silent, which is the worst property a measurement bug can have. There is no
exception, no gap in the data — just a number that is too small, in a log you will read months
later and believe.

### 5.3 Why derivation is immune

`now − startedAt` makes no claim about what happened in between. The process could have been
suspended, killed, migrated, or debugged for an hour. The subtraction does not care. The only
thing it depends on is the system clock, which the OS maintains regardless of your app.

The ticking interval still exists — you need repaints to animate digits — but it has been demoted.
It renders; it does not measure. **You can drop every single tick and the value stays correct.**

### 5.4 Pause is where it gets interesting

A pausable derived timer needs more than one number, because "now minus start" no longer
describes a paused period. Hence three fields:

- `startedAt` — when the *current running segment* began
- `pausedAt` — when it stopped, or null
- `accumulatedS` — the sum of all *previous* running segments

Resume does not resume. It banks the finished segment into `accumulatedS` and starts a new one
from `now`. The elapsed value is `accumulatedS + (currentSegmentEnd − startedAt)`.

**[REC]** The subtlety worth naming: `accumulatedS` looks like the accumulation model sneaking
back in, but it is not. It is a sum of *derived* measurements, each computed by subtraction at the
moment a segment ended. No value in it was ever produced by a tick. **[VERIFIED]** The test that
proves this runs five pause/resume cycles with 120-second pauses and asserts the total is exactly
50 seconds — no drift.

### 5.5 Where the idea generalises

Anything measuring a duration across a boundary your process does not control: a fasting timer, a
parking meter, a game's offline progression, a rate limiter across a restart, a session timeout.
The rule is the same — **store instants, derive durations, never accumulate ticks.**

### 5.6 The honest cost

Derived time is only as good as the clock. If the user changes the system time mid-rest, the
computed value is wrong — and unlike the accumulated version, it can be wrong by a large amount
in either direction. `Math.max(0, live)` prevents negatives; nothing prevents "I set my clock
forward two hours and now my rest was two hours."

**[REC]** I decided this is acceptable and did not defend against it. The mitigations
(`Date.now()` cross-checked against a monotonic source such as `performance.now()`, or rejecting
implausible jumps) add real complexity to guard against a user actively sabotaging their own
training log. Worth revisiting only if it happens.

---

## 6. Key Decisions & Tradeoffs

**Expo (managed) over bare React Native or native Kotlin.** *Alternative:* Kotlin + Room, which
would be marginally faster and better integrated. *Why:* everything the app needs is in the Expo
SDK, and `expo prebuild` is a non-destructive escape hatch if that stops being true. *Cost:* a
larger binary and a build service in the loop; **[VERIFIED]** and one real limitation — EAS local
builds do not run on Windows, which is the author's machine.

**SQLite over a document store.** *Alternative:* AsyncStorage or a JSON file, which the data
*looks* like — a tree of workout → exercises → sets. *Why:* it is not read like a tree. "Heaviest
set per session per exercise, ordered by date" is a `GROUP BY`, and expressing that over parsed
JSON means hand-rolling joins. *Cost:* migrations, and a schema you must think about before
changing.

**No accounts, no server, no sync.** *Why:* the app has no need for a network, and adding one adds
failure modes to a product whose defining requirement is working in a basement with no signal.
*Cost:* backups are manual. A lost phone is a lost log unless the user exported. This is the
single largest trade in the project and it is not obviously right — see §11.

**Dark by default, not system-following.** *Alternative:* mirror the OS. *Why:* gym lighting,
evening training, and a launch screen that does not flash white. *Cost:* users who prefer light
must find a setting. "System" is offered but is not the default.

**A revision counter instead of live queries.** Covered in §4.4. *Cost:* a missed
`bumpRevision()` fails silently.

**Storing weight in kilograms always.** *Alternative:* store what the user typed with a unit tag.
*Why:* mixed-unit storage means every aggregate needs conversion, and one missed conversion
produces a chart that is wrong in a way nobody notices. *Cost:* pounds users see rounded values.

**Icons as vectors, never glyphs or emoji.** **[VERIFIED]** A "✓" typed into a Text renders at the
mercy of font substitution — different weight per device, and on some Android builds a colour
emoji in the middle of a monochrome UI. Feather strokes are consistent. *Cost:* an import and a
component where a character would have done.

**Three sessions before a progress chart appears.** *Alternative:* draw from the second session.
*Why:* two points are a segment, not a direction; drawing one implies a trend the data cannot
support. *Cost:* **[REC]** three is a judgement, not a derivation. Four would also be defensible.

---

## 7. Rubber Duck Walkthrough

*Reading the code and arguing with it.*

"Start with `logSet`. It inserts the set and starts the rest timer in one `withTransactionSync`.
Good — those two facts are one event, and a crash between them would produce a logged set with no
rest timer running, which the UI has no state for.

`rest_before_s` comes from `session.pending_rest_s`, which was written when the user tapped START
SET. So the rest is measured at the *end* of the rest period and attached at the *start* of the
next set. There is a window between those where the measurement lives on the session row rather
than on a set. If the app dies in that window — user tapped START SET, then the phone dies before
they finished the set — the pending rest is lost. That is correct behaviour, actually: the set was
never performed, so there is no set for the rest to precede. Fine.

Now `prefillFor`. It filters `!s.skipped`, and I know why — that was a bug. But look at the
fallback chain: last non-skipped set today → first non-skipped set from the previous session →
`{ weightKg: 20, reps: 8 }`. That 20 is a magic number. For a barbell it is the empty bar, which
is a reasonable guess. For a cable machine it is meaningless, and for a bodyweight exercise the
code correctly returns 0 instead. `UNCLEAR:` nothing in the exercise library records a sensible
starting weight per equipment type, so first-time logging on a leg press starts you at 20 kg.

The revision counter. `useQuery` recomputes on every bump, so logging a set re-runs *every* query
on the active screen — the session, the exercise list, the sets, the previous performance. At
current data scale that is maybe five sub-millisecond reads. At 2,000 sessions the progress
aggregates would be doing real work, but those are on a different screen. `UNCLEAR:` there is no
measurement of what the query cost looks like at ten years of data. §11.

`getProgressSeries` does an N+1: one aggregate query, then one `getFirstSync` per row to find the
reps at the top weight. For 50 sessions that is 51 queries. They are indexed and tiny, but it is
the kind of thing that is fine until it is not, and a single windowed query would do it.

The `ExerciseComplete` auto-advance. It fires after four seconds via a timeout, and I made it not
fire on the last exercise because ending a session on a timer is a decision made for the user. But
on a *non*-last exercise it still advances automatically. Is that right? The user might be reading
the summary. They can tap 'Back to <exercise>' — but only for four seconds. `UNCLEAR:` no way to
cancel the auto-advance by interacting with the screen, which is the obvious affordance.

Finally the note field. It writes on every keystroke — one `UPDATE` per character — and bumps the
revision each time, re-running the summary's three queries per keystroke. That is wasteful.
It is also the fix for a bug where notes were silently discarded, so the waste is buying
correctness. A debounce would be better and is not there."

---

## 8. Prerequisite Concepts

**Epoch milliseconds.** A timestamp is an integer count of milliseconds since 1970-01-01 UTC.
Subtracting two gives a duration with no timezone or calendar involvement. All of §5 depends on
this being cheap and exact.

**The React Native app lifecycle.** An app is *foreground*, *background*, or *killed*. JS timers
are throttled or stopped in background and gone when killed. Anything that must survive those
transitions has to be on disk, not in memory.

**SQLite `PRAGMA user_version`.** A single integer stored in the database file, meaning nothing to
SQLite and available for your own schema versioning. The migration ladder reads it, applies each
missing step, and writes it back.

**WAL (write-ahead logging).** SQLite writes changes to a sidecar file and folds them into the
main database at checkpoints. Faster writes; a `-wal` file that grows until checkpointed — hence
the checkpoint on app background.

**Android adaptive icons.** A launcher icon is a foreground layer over a background layer, and the
launcher applies its own mask — circle, squircle, rounded square. It crops roughly a third.
Artwork at full bleed loses its edges, which is why Forte's adaptive foreground is inset to 62%.

**Tabular figures.** A font feature where every digit has the same advance width. Without it, a
timer's digits change width as they change value and the text jitters every second.

---

## 9. Explain It To Others

### 30 seconds — a non-technical friend

"It's a workout notebook for my phone. You write down what you lifted, and it times your rest
between sets automatically so you don't have to. It shows you whether your numbers are going up
over the weeks. That's it — no accounts, no social feed, no adverts. It works with no internet
because everything is stored on the phone, and the whole thing is basically a notebook with a
stopwatch attached."

### 2 minutes — a developer

"Forte is an offline Android workout tracker — Expo, React Native, SQLite via `expo-sqlite` with
Drizzle on top. No server, no accounts, no network calls at all.

The interesting bit is the rest timer. The obvious implementation is `setInterval` incrementing a
counter, and it's silently broken on mobile: the OS suspends your JS thread when the app is
backgrounded or the screen locks, the interval stops firing, and your timer under-reports. You
don't get an error — you get a plausible wrong number written into a training log you'll trust
for years.

So the timer never counts. It stores a start timestamp on the session row and computes
`now − startedAt` whenever it needs to display. The one-second interval is a repaint, not a
measurement — drop every tick and the value is still right. Pause needs three fields rather than
one, because a paused period isn't `now − start` any more: current segment start, pause instant,
and seconds banked from previous segments.

That has a nice second-order effect. Because correctness doesn't depend on the screen being on,
the app can offer a 'let the screen sleep' setting that roughly quarters battery use per session,
which a counting timer simply cannot do.

The rest is conventional: live workout state lives on the session row so a crash mid-workout
resumes with no prompt; every set is written the instant it's logged; reactivity is a global
revision counter rather than a subscription layer, because SQLite reads here are sub-millisecond."

### 5 minutes — an interviewer who will push back

Everything above, then the parts they will actually probe:

**"Why not just use `AppState` to correct the counter on foreground?"** You can, and it partly
works — on foreground, compare wall clock to your counter and add the difference. But now you
have two sources of truth that must be reconciled at every lifecycle transition, and you have to
get every transition right. Deriving from a timestamp has one source of truth and no
reconciliation. The corrected-counter approach is strictly more code to achieve strictly less
reliability. It also does nothing for the process-death case, where your counter no longer exists.

**"Isn't a global revision counter just cache invalidation with extra steps?"** It is cache
invalidation with *fewer* steps — one global generation number instead of per-query dependency
tracking. That's a real trade: I recompute queries that didn't need recomputing. At this data
scale that costs microseconds, and it buys the elimination of an entire bug class where a
mutation doesn't invalidate the right key. If reads got expensive I'd need something finer.

**"No cloud backup is a product bug, not a feature."** That's the strongest objection and I half
agree — see §11. What I'd defend is the ordering: an app that works perfectly offline and exports
JSON can gain sync later. An app built around sync cannot easily become trustworthy offline.

**"How do you know the timer actually works?"** Thirteen tests on the pure module, including a
simulated ten-minute background gap and rehydration from stored fields after process death. And I
force-stopped the app mid-rest on a device and watched it come back with the right number. The
module is pure specifically so those tests need no emulator.

---

## 10. Questions You'd Be Asked

**Why SQLite and not AsyncStorage?** The read patterns are relational. "Top set per session per
exercise ordered by date" is a `GROUP BY`; over serialised JSON it's a hand-rolled join.

**Why does rest live on the set instead of its own table?** A rest period is the gap before a set,
so it's a property of that set. It makes both the history rendering and the analytics
single-table reads.

**What happens if I edit a set after the fact?** Weight and reps update in place. Rest is not
editable — it's a measurement, not an entry, and letting it be typed would reintroduce exactly
the guesswork the automatic timer exists to remove.

**Why store skipped sets at all?** Because "I skipped set 3" is information, and deleting it makes
that session indistinguishable from a two-set session. The cost is that every aggregate must
filter them out.

**Why is the progress chart hidden until three sessions?** Two points make a segment, not a trend.
Drawing a line through two points implies a direction the data doesn't support.

**Why can't I reorder exercises by dragging?** Because drag-and-drop needs
`react-native-draggable-flatlist` plus gesture-handler/reanimated version coupling, which is the
most common source of Expo build breakage. Chevrons are functional and zero-risk. It's a
documented deviation from the design spec, not an oversight.

**What's the actual battery cost?** **[EST]** 8–15% for a 60-minute session with the screen awake,
2–4% with it sleeping between sets. The app's own CPU work is well under 0.5%; the screen is
essentially the entire cost, and the app makes no network requests at all.

**How big does the database get?** **[EST]** About 4 KB per workout — roughly 0.8 MB a year at
four sessions a week, 8 MB over a decade. The installed app is ~35–40 MB and fixed.

**Why Urbanist?** A geometric sans with open counters and a tall x-height, legible at a glance and
at arm's length. **[REC]** Aesthetic preference with a functional justification, not a measurement.

---

## 11. Weak Points

### Gaps in the design

- **Manual backup is the single biggest risk to the user's data.** Export is a button someone has
  to remember to press. Everything else in this project is engineered so a crash, a kill, or a
  dead battery loses nothing — and then the whole log depends on a habit. **[REC]** The
  proportionate fix isn't cloud sync; it's a scheduled local export to the device's Documents
  folder plus a nag after N sessions without one. Neither exists.

- **Bodyweight exercises distort volume.** They log reps with weight as optional added load, and
  are not excluded from session volume. A high-rep bodyweight day therefore reads as low volume
  next to a barbell day, and the "total volume" comparison on the summary screen silently compares
  incomparable numbers. `UNCLEAR:` the right answer is probably to exclude bodyweight from volume
  totals or to impute a bodyweight, and neither is decided.

- **`getProgressSeries` is N+1.** One aggregate, then one query per session to find reps at the top
  weight. Fine at 50 sessions, unmeasured at 2,000. A window function would do it in one pass.

- **No query cost has been measured at realistic long-term scale.** Every performance claim in this
  document about reads being "sub-millisecond" is from a database with tens of sessions. **[EST]**
  I expect it to hold — the tables are small and indexed — but I have not tested a decade of data.

- **The note field writes on every keystroke.** One `UPDATE` and one full revision bump per
  character. It fixed a real data-loss bug, but a debounce would fix it without the waste.

- **First-time weight pre-fill is a magic 20 kg** for anything that isn't bodyweight, regardless of
  equipment. Sensible for a barbell, meaningless for a leg press.

- **The exercise-completion screen auto-advances after four seconds** with no way to cancel by
  interacting with it. The "back to this exercise" affordance exists for exactly four seconds.

- **The system clock is trusted absolutely.** §5.6. A user changing their device time mid-rest gets
  a wrong duration with no detection.

- **Nothing is tested above the pure-function layer.** 19 tests, all on `rest-timer.ts` and
  `format.ts`. There are no tests for the query layer, no component tests, no end-to-end tests.
  Everything else was verified by driving the app on an emulator by hand, which does not survive
  refactoring. `UNCLEAR:` the query functions are pure enough to test against an in-memory SQLite
  instance, and that is the obvious next investment.

### Risks in the plan

- **Fast Refresh silently dropped edits twice during development.** **[VERIFIED]** Changes to leaf
  components did not apply, with no error, and the app kept running old code — once producing a
  screenshot I initially read as a broken fix. Anyone working on this needs to know that a change
  that "doesn't work" may not have loaded.

- **Signing-key loss is unrecoverable and deletes the log.** Android refuses to update an APK
  signed with a different key; the only path is uninstall, which drops the database. The keystore
  is therefore as important as the data, and it lives in an Expo account or a file on one machine.

- **Android's `AlertDialog` renders at most three buttons.** **[VERIFIED]** A five-item menu
  silently dropped two of them — including *Discard workout* — leaving them unreachable with no
  error. Fixed with a custom sheet, but it is a good illustration of how platform limits show up:
  not as failures, as absences.

- **iOS is untested.** The codebase is React Native and nothing in it is Android-specific, but
  "should work" is not "works".

### What's genuinely strong

- **The timer is right, and provably so.** It is pure, it is tested against the failure modes that
  actually occur, and the tests need no device. That is the core of the product and it is the
  best-defended part of it.

- **Crash recovery is a non-feature.** Because live state is on the session row, resuming after a
  kill required no restore logic and no prompt. The right data model made a hard feature disappear.

- **The scope discipline held.** No accounts, no social, no gamification, no calories — and every
  screen is legible because of it. **[REC]** The hardest part of a project like this is not
  building the features; it is not building the other ones.

- **Real bugs were caught by looking at real output.** The `10 reps → "1"` formatting bug, the
  unreachable menu items, the silently discarded notes, the grey-on-accent flash — none were found
  by reasoning about the code. All were found by rendering it and looking. **[REC]** That is the
  transferable lesson.

---

## Appendix — If you build one thing

Build the timer module.

`src/features/workout/rest-timer.ts` is about forty lines including comments, has no dependencies,
and can be dropped into any project that measures a duration across a boundary it does not
control. Write the tests first — the ten-minute background gap, the pause/resume cycle, the
rehydration after process death — and you will have a component you can trust in a place where
most implementations are quietly wrong.

Everything else in Forte is a competent CRUD app around it.
