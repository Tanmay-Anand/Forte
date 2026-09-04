# Forte — Design Document

**Personal Offline Workout Tracker**
Version 1.0 · Design specification (UI, interaction, information hierarchy, states)

> **Scope of this document:** UI and interaction design only. No backend, no API design, no data-sync design. See `IMPLEMENTATION_PLAN.md` for tech stack and build sequence.

---

## 1. Product statement

Forte is a personal training notebook upgraded with a stopwatch and progress visualization.

Three sentences the whole product must communicate:

> **Plan your week → Log every set → See yourself getting stronger.**

It is used by exactly one person, offline, standing in a gym, often mid-set, often with one hand, often sweaty, often distracted.

### Non-goals (hard constraints)

No accounts, social feed, friends, followers, likes, challenges, calories, nutrition, supplements, body measurements, wearables, AI coaching, workout recommendations, public profiles, payments, or subscriptions. If a feature request cannot be justified by "it makes logging a set faster" or "it makes progression clearer," it does not ship.

---

## 2. Design principles

| Principle | What it means in practice |
|---|---|
| **Fast logging** | A set is logged in ≤2 taps from resting state. Values pre-fill from the previous set. |
| **Workout-first** | During an active workout, chrome disappears. One exercise on screen. One primary button. |
| **Clear progression** | Last session's numbers sit directly above today's inputs. No navigation required to compare. |
| **Large targets** | Minimum 48×48 dp touch target; primary action ≥64 dp tall, full-bleed width. |
| **Minimal cognitive load** | Never show a number the user did not ask for and cannot act on. |
| **Personal and private** | Typographic, quiet, single-user voice. "Your log," not "the community." |

### Design tension resolutions

- **Fast vs. accurate** → Fast wins. Every logged value is editable afterward with a single tap; nothing is confirmation-gated.
- **Informative vs. focused** → Focused wins on Active Workout, informative wins on Progress.
- **Beautiful vs. legible** → Legible wins on Active Workout. Everywhere else they are the same thing.

---

## 3. Visual language

### 3.1 Aesthetic direction

Editorial and instrumental — closer to a precision measuring device than to a fitness brand. Strong type, generous negative space, **near-monochrome**, soft geometry. The brightest thing on any screen is the one action you are meant to take.

Colour is a scarce resource. There is no brand hue, no saturated hero card, no coloured fills behind content. The primary action is a light capsule with dark ink; two restrained accents (one teal, one blue) exist only to mark live data and the running rest timer.

**Avoid:** neon, aggressive gradients, flame/lightning icons, muscle photography, social-card layouts, badges and streak flames, heavily rounded pill-cards, dense multi-widget dashboards.

**Prefer:** high contrast, large numerals, tabular alignment, hairline dividers instead of card borders, flat surfaces separated by tone rather than by shadow.

**No emoji, and no glyph characters used as icons.** Every icon is a stroked vector (Feather, via `src/ui/Icon.tsx`). A `✓` typed into a Text is at the mercy of font substitution: it shifts baseline, changes weight between devices, and on some Android builds renders as a colour emoji in the middle of a monochrome UI. Multiplication signs in `62.5 × 8` are typography, not iconography, and stay as text.

### 3.2 Colour

Dark is the default theme (gym lighting, evening training, lower glare). Light is a full first-class alternative, not an afterthought.

```
DARK (default)
  bg/base          #0A0A0B   app background
  bg/raised        #141517   cards, rows
  bg/sunken        #101113   input wells, segmented tracks
  bg/elevated      #1B1D20   floating pill nav, action sheets
  line/hairline    #1F2124   1px dividers
  line/strong      #2C3034   input borders
  text/primary     #F3F4F6   numbers, exercise names
  text/secondary   #9AA0A6   labels, metadata
  text/tertiary    #62676E   previous-session values, hints
  accent           #F3F4F6   primary action fill (light capsule)
  accent/ink       #0A0A0B   text on accent
  focus            #5FD3BC   live data, "now" markers — used sparingly
  positive         #72CBA4   progression up
  negative         #DD8B80   regression, destructive text
  rest             #8FB4E8   rest timer state only

LIGHT
  bg/base          #FAFAFA      bg/raised    #FFFFFF
  bg/sunken        #F2F3F5      bg/elevated  #FFFFFF
  line/hairline    #E7E8EB      line/strong  #D2D5D9
  text/primary     #111214      text/secondary #5B6068   text/tertiary #8B9199
  accent           #16181B   (inverts: near-black capsule on light)
  accent/ink       #FFFFFF
  focus #0F9E8A    positive #1C7A55    negative #B4463A    rest #2A63BE
```

**Colour rules**

1. **Accent is a light fill, not a hue.** It marks exactly one thing per screen: the primary action, and the selected tab in the pill nav. Never decoration.
2. **No saturated fills.** Cards separate by tone, not by colour. There is no coloured hero card anywhere in the app.
3. Positive/negative appear only next to a delta the user can act on. Never used to praise or scold — a regression is stated, not flagged red-alert.
4. Rest blue exists only while a rest timer is running. Its appearance *is* the notification.
5. Dark is the default outright, not a mirror of the OS. "System" is an opt-in in Settings.

### 3.3 Typography

**Urbanist** throughout — a geometric sans with open counters and a tall x-height, which stays legible at a glance and at distance. Numeric styles request tabular figures so digits do not jitter as the timer counts. The platform font is the fallback for the first frame before Urbanist loads.

```
display/xl    64 / 60   -3%   tabular   timer, workout summary hero
display/l     44 / 44   -2%   tabular   weight & rep inputs, big stats
title/l       24 / 30   -1%             exercise name in active workout
title/m       19 / 24   -1%             screen titles, day names
body          16 / 22    0%             general text, list rows
label         13 / 16   +4%   uppercase section labels, table headers
mono/num      15 / 20    0%   tabular   set tables, history values
caption       12 / 16    0%             previous-session lines, hints
```

Weights: 400 body, 500 labels and numerals, 600 titles, 700 display. Nothing heavier — bold-everything reads as shouting. Display sizes carry negative tracking; nothing is set in uppercase except small labels.

### 3.35 Identity

The mark is a bordered dark square with an off-centre white disc and the **Forte.** wordmark set low-left — the same geometry the app itself uses: a quiet frame, one bright element, type doing the work.

| Use | Asset | Notes |
|---|---|---|
| App icon | `assets/icon.png` | The mark, full bleed |
| Android adaptive icon | `assets/adaptive-icon.png` | The mark inset to 62% on a transparent canvas, on `#1C1C1C`. Android crops ~⅓ of an adaptive foreground for its mask; at full bleed that slices straight through the wordmark, so the artwork is padded into the safe zone instead |
| Launch screen | `assets/splash-dark.png` | The white **Forte.** wordmark on `bg/base`, 200 pt wide |

The launch screen is **dark in both OS appearance modes**, matching the app's dark-by-default rule rather than the system setting — a light flash before a dark app is worse than a consistent one. It is held on screen until the database has migrated and Urbanist has loaded, so the first painted frame is the finished UI rather than a flash of fallback type.

### 3.4 Spacing, shape, elevation

- 4 pt base grid. Standard rhythm: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Screen gutter: 20 pt mobile, 32 pt tablet, 40 pt desktop.
- Radii are soft and generous: 14 input wells, 20 cards and sheets, fully rounded (pill) for every button, chip, segmented thumb and the nav. Sharp corners appear nowhere.
- No drop shadows. Depth comes from tone (`bg/raised` on `bg/base`) and hairlines. One exception: the sticky bottom action bar gets a 24 pt upward scrim so scrolling content fades under it.

### 3.5 Motion

Fast and physical. Nothing decorative.

| Event | Motion |
|---|---|
| Set completed | Row flips to logged state, 120 ms; accent flash on the row, fading over ~500 ms. **The row's own text inverts to `accent/ink` for the duration** — grey-on-accent is illegible, and a confirmation you cannot read is not a confirmation |
| Rest timer starts | Timer bar rises from bottom, 180 ms ease-out; digits begin at 00:00 |
| Rest timer pause/resume | Digits dim to 60% / return, 100 ms |
| Exercise completed | Card collapses to summary, 200 ms |
| Next exercise | Horizontal slide, 220 ms; the direction encodes forward/back |
| Tab change | The nav disc springs to the new slot (~250 ms); icons crossfade in step with it |
| Exercise progressed | The header progress bar grows to its new proportion |
| Workout completed | Summary numbers count up once over 400 ms, then hold. Nothing else. |
| Screen transitions | 200 ms; reduced-motion setting replaces all of the above with opacity-only fades |

**No haptics or vibration.** Every state change is carried visually. Because there is no second channel, the set-completion flash is not decoration — it is the confirmation that the set was committed, and it must stay clearly visible rather than subtle.

---

## 4. Navigation architecture

A **floating pill** of four circular buttons, detached from the screen edge, rather than a full-width tab bar:

```
                 ┌──────────────────────────┐
                 │  ⬤    ▢     ↗     ◷      │   ← 64dp capsule, bg/elevated
                 └──────────────────────────┘
                    ▲
                    active: filled light disc, dark icon
```

Four tabs in a fixed order — **Today · Week · Progress · History** — as 52dp circles inside a 64dp capsule. The selected tab is a filled `accent` disc with `accent/ink` iconography; the rest are bare icons in `text/secondary`.

**The disc travels.** Switching tabs slides the active disc to its new position on a near-critically-damped spring (~220 stiffness, 18 damping) rather than cutting. The movement is the only thing on screen that expresses the spatial relationship between tabs, so it earns its place; the damping is deliberately just shy of a bounce, which would read as playful rather than precise.

Each button holds two stacked copies of its icon — one `text/secondary`, one `accent/ink` — crossfaded by the disc's proximity. Both the slide and the crossfade are driven from a single animated value, so they cannot drift apart, and both run on the native driver. This also avoids the obvious failure of the naive version: flipping the icon to dark ink on tap leaves it dark-on-dark for the ~250 ms before the disc arrives. Under the reduced-motion setting the disc jumps instantly and the crossfade is skipped.

**On icon-only navigation.** Dropping labels costs a beat of recognition, and this app is used distracted. Three things pay that back: the set is fixed at four, the order never changes, and position becomes the affordance within a session or two. Every button carries an accessibility label, so screen-reader users lose nothing. Content scrolls *under* the capsule, and every tab screen reserves `NAV.clearance` at the bottom so nothing is ever trapped beneath it.

**Progress is a labelled bar, not a row of dots.** The Active Workout header reads
`3 of 4 exercises` above a 3 pt bar filled to that proportion. Dots have to be counted before they
mean anything; a filled proportion is read at a glance, which is the whole point of a progress
indicator you are looking at mid-set.

**During an active workout the nav is gone entirely.** Active Workout is a full-screen modal route above the tab stack. Leaving it requires the explicit minimise control in its header, never a tab tap. This remains the single most important navigational decision in the app.

When a workout is active but minimised, a **resume pill** docks directly above the nav on every screen:

```
   ┌────────────────────────────────────────────┐
   │ ● Chest + Triceps        24:18  REST 1:12  │  ← tap to resume
   └────────────────────────────────────────────┘
        ┌──────────────────────────┐
        │  ⬤    ▢     ↗     ◷      │
        └──────────────────────────┘
```

It shows elapsed workout time and, while resting, the live rest count — so the timer is never lost by wandering into Progress mid-set. Its dot is `rest` blue while resting, `focus` teal otherwise.

---

## 5. Screens

Wireframes below are mobile portrait (390 pt reference width) unless noted.

---

### 5.1 Today

The entry point. Its job is to answer "what am I doing right now" and start it.

```
┌─────────────────────────────────────────┐
│                                         │
│  MONDAY · 3 SEP                         │  label, text/secondary
│                                         │
│  Chest + Triceps                        │  display/l, text/primary
│                                         │
│  ───────────────────────────────────    │
│                                         │
│  TODAY'S WORKOUT              5 EXERCISES│ label row
│                                         │
│  Bench Press                            │
│  Incline Dumbbell Press                 │  body, 44 dp rows
│  Cable Fly                              │  hairline between
│  Tricep Pushdown                        │
│  Overhead Tricep Extension              │
│                                         │
│  ───────────────────────────────────    │
│                                         │
│  Last Chest + Triceps    27 Aug · 7d ago│  caption
│  Volume                  6,500 kg  ↑2.1%│  caption + positive
│                                         │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│         S T A R T   W O R K O U T       │  accent, 64 dp, sticky
│                                         │
├─────────────────────────────────────────┤
│  Today    Week    Progress    History   │
└─────────────────────────────────────────┘
```

**Hierarchy rationale.** The workout name is the largest element because it is the answer to the user's question. The exercise list is a plain list, not cards — it is a preview, not a set of choices. Context (last session, volume delta) sits below the fold of attention in caption size: available if glanced at, ignorable otherwise.

**Not on this screen:** weekly volume charts, streaks, muscle-group heatmaps, PR banners. Today is not a dashboard.

**Interactions**
- Tap an exercise row → non-blocking peek sheet with that exercise's last 3 sessions. Dismissible by swipe.
- Long-press the workout title → "Edit today's workout" (routes to Customize Day for today only).
- START WORKOUT → Active Workout, immediately on exercise 1, set 1. No intermediate confirm.

**States**

*Rest day (day is configured as rest):*
```
  MONDAY · 3 SEP

  Rest Day

  ───────────────────────────────
  Next: Tuesday · Back + Biceps

           + Add Workout            ← secondary, outlined
```

*No routine configured at all (first run):*
```
  MONDAY · 3 SEP

  No routine yet

  Set up which muscle groups you
  train on which days. You can
  change it any time.

        P L A N   M Y   W E E K     ← accent primary → Week
```

*Workout already completed today:*
```
  MONDAY · 3 SEP

  Chest + Triceps          ✓ Completed

  58 min · 18 sets · 6,850 kg

      View Summary        Train Again    ← both secondary
```
"Train again" is available without friction — the app does not police the user's training.

---

### 5.2 Week — Weekly Routine

A schedule, not a calendar. Seven fixed rows, no month grid, no dates — this is the recurring template, not a diary.

```
┌─────────────────────────────────────────┐
│  Week                                   │  title/m
│  Your training split                    │  caption
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ MON                       ● TODAY│   │  accent dot
│  │ Chest + Triceps                  │   │  title/m
│  │ 5 exercises                    › │   │  caption
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ TUE                              │   │
│  │ Back + Biceps                    │   │
│  │ 6 exercises                    › │   │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ WED                              │   │  muted surface
│  │ Rest                             │   │  text/secondary
│  │                                › │   │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ THU                              │   │
│  │ Legs                             │   │
│  │ 5 exercises                    › │   │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ FRI                              │   │
│  │ Shoulders + Arms                 │   │
│  │ 4 exercises                    › │   │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ SAT                              │   │
│  │ Rest                           › │   │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ SUN                              │   │  dashed hairline
│  │ Not configured                   │   │  text/tertiary
│  │ + Add workout                  › │   │
│  └─────────────────────────────────┘    │
│                                         │
│  4 training days · 20 exercises / week  │  caption, single summary line
├─────────────────────────────────────────┤
│  Today    Week    Progress    History   │
└─────────────────────────────────────────┘
```

**Three visually distinct day states**

| State | Surface | Type | Signal |
|---|---|---|---|
| Workout | `bg/raised`, solid hairline | title/m primary + exercise count | Full contrast |
| Rest | `bg/base`, solid hairline | title/m secondary, no count | Deliberately quieter — rest is a choice, not a gap |
| Not configured | `bg/base`, **dashed** hairline | tertiary + inline `+ Add workout` | Visibly incomplete |

Today's row carries an accent dot and label. It is not otherwise enlarged — the week must read as a flat, comparable set of seven.

**Interactions**
- Tap any row → Customize Day.
- Long-press → context menu: *Duplicate to…*, *Set as rest*, *Clear day*. Duplicating is the fastest path to building a split (build Push once, copy to Thursday, rename).
- Editing a day never touches the other six.

**Empty state (nothing configured):** all seven rows render in the dashed "not configured" style with a single header line: *"Tap a day to add exercises. Leave a day empty to make it a rest day."* No illustration.

---

### 5.3 Customize Day

Editing one day's exercise list. Deliberately shallow.

```
┌─────────────────────────────────────────┐
│  ‹ Week                          Done   │
│                                         │
│  MONDAY                                 │
│  Chest + Triceps                    ✎   │  tap title to rename
│                                         │
│  EXERCISES                          4   │
│  ┌─────────────────────────────────┐    │
│  │ ⣿  Bench Press               ⋯  │    │  ⣿ = drag handle
│  │    Barbell · Chest              │    │  caption
│  ├─────────────────────────────────┤    │
│  │ ⣿  Incline Dumbbell Press    ⋯  │    │
│  │    Dumbbell · Chest             │    │
│  ├─────────────────────────────────┤    │
│  │ ⣿  Cable Fly                 ⋯  │    │
│  │    Cable · Chest                │    │
│  ├─────────────────────────────────┤    │
│  │ ⣿  Tricep Pushdown           ⋯  │    │
│  │    Cable · Triceps              │    │
│  └─────────────────────────────────┘    │
│                                         │
│         + Add Exercise                  │  secondary, full width
│                                         │
│  ───────────────────────────────────    │
│  Make this a rest day                   │  destructive-lite, text only
└─────────────────────────────────────────┘
```

**Per-row affordances**
- **Reorder** — drag handle on the left; long-press-anywhere also lifts the row. The lifted row raises to `bg/raised` so the drag state is unmistakable.
- **Replace** — tap the exercise name to swap it. This changes the routine for **every future week**; to swap a single day's session, use *Replace exercise* during the workout instead.
- **Remove** — the `✕` at the end of the row.
- Removal is immediate with a 5-second inline **Undo** in place of the row. No confirmation dialog.

**What is intentionally absent.** No target sets, target reps, RPE, RIR, tempo, rest targets, supersets, or notes-per-exercise. A routine is *an ordered list of exercises*. Everything numeric is decided in the gym and recorded during the workout. This is the single strongest simplification in the product and it must be defended.

**Add Exercise — library sheet**

```
┌─────────────────────────────────────────┐
│  Add Exercise                       ✕   │
│  ┌─────────────────────────────────┐    │
│  │ 🔍  Search exercises            │    │  autofocused
│  └─────────────────────────────────┘    │
│  [ All ][ Chest ][ Back ][ Legs ][ … ]  │  scrollable filter chips
│                                         │
│  RECENT                                 │
│  Bench Press              Barbell    +  │
│  Cable Fly                Cable      +  │
│                                         │
│  CHEST                                  │
│  Incline Barbell Press    Barbell    +  │
│  Incline Dumbbell Press   Dumbbell   +  │
│  Machine Chest Press      Machine    +  │
│  Push-up                  Bodyweight +  │
│                                         │
│  ───────────────────────────────────    │
│  + Create "incline sm…"                 │  appears when search has no exact hit
└─────────────────────────────────────────┘
```

Tapping `+` adds and keeps the sheet open (multi-add is the common case); a counter appears on the close button: `Done · 3 added`. Recently used exercises rank above alphabetical results because the user's own history is the best predictor.

Creating a custom exercise asks for two things only: name and equipment type. Nothing else.

---

### 5.4 Active Workout — the primary screen

Everything else in the app exists to feed this screen. It is optimised for one-handed use, a 30-cm viewing distance, and a user whose attention is on a barbell.

#### 5.4.1 Layout — logging state

```
┌─────────────────────────────────────────┐
│  ⌄  Chest + Triceps          24:18      │  minimise · title · elapsed
│     ●●●○○  3 / 5 exercises              │  progress dots
├─────────────────────────────────────────┤
│                                         │
│  Bench Press                            │  title/l
│  Barbell · Chest                        │  caption, tertiary
│                                         │
│  LAST TIME · 27 AUG                     │  label, tertiary
│  60 × 8    60 × 8    62.5 × 7           │  caption, tertiary, one line
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│   SET   WEIGHT        REPS              │  label row
│   ────────────────────────────────────  │
│    1    60 kg          8            ✓   │  logged: mono/num, secondary
│    2    62.5 kg        8            ✓   │
│    3    62.5 kg        7            ✓   │
│   ────────────────────────────────────  │
│                                         │
│    4    ┌─────────┐   ┌─────────┐       │  ACTIVE ROW
│         │  62.5   │   │    8    │       │  display/l, 88 dp tall wells
│         │ −     + │   │ −     + │       │  steppers inside the well
│         └─────────┘   └─────────┘       │
│              kg          reps           │
│                                         │
│         + Add set     ⋯ Set options     │  caption controls
│                                         │
├─────────────────────────────────────────┤
│                                         │
│        C O M P L E T E   S E T          │  accent, 72 dp, full-bleed
│                                         │
└─────────────────────────────────────────┘
```

**Why this arrangement.** The user's eye travels top-to-bottom in the order they need information: *which exercise → what did I do last time → what have I done today → what am I entering now → the button*. The active row is the visual centre of gravity; logged sets recede to secondary tone so the eye is never drawn backwards.

**The number wells.** Each is 88 dp tall with the value at display/l (44 pt). Three ways to change a value, all supported simultaneously:
1. Tap `−` / `+` steppers — weight steps by a configurable increment (default 2.5 kg, 1.25 kg for dumbbells and cables); reps step by 1. Hold to repeat-accelerate.
2. Tap the number itself → a full-width custom numeric keypad slides up (not the OS keyboard — a purpose-built pad with big keys, `.`, and a `Done` that is the same accent as COMPLETE SET).
3. Vertical drag on the well scrubs the value — for jumping 20 kg without twelve taps.

Values pre-fill from the previous set of this exercise in this session; on set 1, from the last session's set 1. The most common gym action — repeating the same weight and reps — therefore costs exactly one tap: COMPLETE SET.

**Previous-session line.** Always visible, always tertiary, always one line. If it wraps beyond one line (more than 4 sets), it truncates with `…` and expands on tap. It must never compete with today's numbers.

#### 5.4.2 Layout — resting state

The instant COMPLETE SET is tapped, the screen changes character. The set row flips to logged, and the rest timer takes over the bottom third.

```
┌─────────────────────────────────────────┐
│  ⌄  Chest + Triceps          24:31      │
│     ●●●○○  3 / 5 exercises              │
├─────────────────────────────────────────┤
│  Bench Press                            │
│                                         │
│   SET   WEIGHT        REPS              │
│    1    60 kg          8            ✓   │
│    2    62.5 kg        8            ✓   │
│    3    62.5 kg        7            ✓   │
│    4    62.5 kg        8            ✓   │  ← just logged, briefly accent
│                                         │
│    5    62.5 kg        8      (queued)  │  next set, values pre-filled,
│                                         │    tappable to pre-edit
├─────────────────────────────────────────┤
│                                         │
│   R E S T                               │  label, rest colour
│                                         │
│      0 1 : 2 7                          │  display/xl, 64 pt, tabular
│                                         │
│    ⏸ Pause      ↺ Reset      ⏭ Skip     │  three 48 dp controls
│                                         │
├─────────────────────────────────────────┤
│                                         │
│        S T A R T   S E T   5            │  accent, 72 dp
│                                         │
└─────────────────────────────────────────┘
```

**The rest panel is a compact bar, not a hero.** The timer's job is to inform, not to take over:
at full display size it pushed the set table and the primary action off screen, so the thing you
were resting *from* disappeared while you rested. It is now a single row — `REST` label and the
elapsed value on the left, three circular icon controls on the right, a blue rule down the leading
edge. The digits stay large enough to read at arm's length; everything else shrinks.

**Rest timer rules**

- **Counts upward from 00:00.** There is no target rest time, therefore no countdown, no goal ring, no "rest complete" alarm. The number is information, not instruction.
- Starts **automatically** on set completion. The user never starts it.
- Stops **automatically** when the user taps START SET *n*. That elapsed value is written as the rest preceding set *n*. The user never types a rest time.
- The timer panel uses `rest` blue and is the only blue in the app — peripheral vision alone tells the user they are resting.
- Digits are tabular so the layout does not shift each second.
- **Pause** freezes the count (bathroom, a set stolen by someone else); digits dim; the panel label becomes `REST · PAUSED`. **Resume** continues from the frozen value.
- **Reset** returns to 00:00 and keeps running. No confirmation.
- **Skip** stops the timer, records the rest as-is, and returns immediately to the logging state without starting the next set — for supersetting or moving straight on.
- The timer is **wall-clock based**, not tick-based: it is derived from a stored start timestamp, so it stays correct if the screen sleeps, the app is backgrounded, or the phone is locked. (Implementation note carried into the plan document.)
- If the user minimises the workout, the live rest value appears in the resume bar above the tab bar.

**The core loop, expressed as taps**

```
  set finished in real life
        ↓
  tap COMPLETE SET          ← 1 tap    → rest timer starts automatically
        ↓
  (rest; optionally adjust next set's weight/reps)
        ↓
  tap START SET 5           ← 1 tap    → rest 1:42 stored automatically
        ↓
  perform the set
        ↓
  tap COMPLETE SET          ← 1 tap    → rest timer starts again
```

Two taps per set in the steady state. No dialogs, no confirmations, no navigation.

#### 5.4.3 Editing and set management

- **Edit a logged set** — tap the row; it re-opens in place as an active-style row with the keypad available. Saving re-writes the value. No modal, no "are you sure."
- **Add set** — `+ Add set` appends an empty row. Also available from the queued row.
- **Remove set** — swipe-left on a logged row, or `⋯ → Remove`. Inline 5-second Undo.
**Secondary controls are bordered chips, not tinted text.** `‹ Previous`, `Skip set`,
`+ Add exercise` and the forward control sit in a wrapping row under the number wells, each with
a visible border and a real pressed state. Bare tinted captions read as labels and were being
missed outright mid-workout; a control the user cannot see is a control that does not exist.

**The forward control says what it will actually do.** On the last exercise it reads
**Finish workout ›**, not "Next exercise" — labelling the end of a session as "next" is a trap,
and the user only discovers it afterwards. For the same reason, the completion state does not
auto-advance off the last exercise: ending a session on a four-second timer is a decision made
*for* the user rather than by them. There, both ways out are offered — add another exercise, or
finish.

**`+ Add exercise` is surfaced in that row, not only in the `⋯` menu.** Deciding to add calf
raises happens while standing at the last set of the last exercise, which is exactly where the
control now is.

- **Skip a set** — a `Skip set` control sits beside the number wells. It records a set that was *not performed* and starts the rest timer exactly as completing one would. Skipped sets are stored rather than silently omitted: a session where set 3 was skipped is a different session from one with three sets, and that difference matters reading the log back weeks later. They carry no load, render as `3  Skipped  –`, and are excluded from every volume and progression aggregate — including the pre-fill for the next set, which must never inherit a skipped set's zeros.
- **Skip an exercise** — from the header `⋯` menu; the exercise is marked skipped, not deleted, and appears greyed in the session history.
- **Replace an exercise, today only** — header `⋯ → Replace exercise`. The lat pulldown machine is occupied, so today it is pull-ups. The picker opens titled *Replace Bench Press*, and choosing a substitute swaps it **for this session alone — the weekly routine is untouched.**

  Refused once *performed* sets exist on that exercise: those sets belong to the old movement, and silently reattributing them would corrupt both exercises' histories. The user is told how many, and offered the honest alternative — remove them, or add the substitute as a second exercise so both are recorded. Skipped placeholders do not block the swap; they carry no data and are cleared with it.

  To change an exercise for *every* week instead, tap its name in Customize Day. The two scopes are deliberately in different places, because confusing them silently rewrites a routine.
- **Add an exercise mid-workout** — header `⋯ → Add exercise`; opens the library sheet. It is appended to today's session only, and the app asks once, afterwards, in the completion summary: *"Add Cable Crossover to Monday's routine? Yes / Just today."*

#### 5.4.4 Exercise completion

There is no "finish exercise" button — the user simply taps NEXT EXERCISE when they are done. Tapping it produces a brief, non-blocking completion state rather than a screen the user must dismiss:

```
┌─────────────────────────────────────────┐
│                                         │
│   ✓  Bench Press completed              │  positive tick
│                                         │
│   4 sets · 8, 8, 7, 8 reps              │  mono/num
│   Top set 62.5 kg × 8                   │
│   Average rest 1:38                     │
│                                         │
├─────────────────────────────────────────┤
│        N E X T   E X E R C I S E        │  accent
│                                         │
│              Back to Bench Press        │  text link, small
└─────────────────────────────────────────┘
```

This state auto-advances after 4 seconds if untouched — the summary is a confirmation glance, not a checkpoint. "Back to Bench Press" exists because a user often realises they want one more set.

#### 5.4.5 Exit and recovery

The header `⌄` **minimises** (workout continues, resume bar appears). The header `⋯ → End workout` finishes early and goes to the summary. There is no way to accidentally destroy a session: the only destructive action is `⋯ → Discard workout`, which is the one place in the app that uses a confirmation, because it is genuinely unrecoverable.

If the app is killed mid-workout, the next launch opens directly into the in-progress workout with all logged sets intact and the rest timer recomputed from its stored timestamp. No "restore?" prompt — just continue.

#### 5.4.6 Gym-environment considerations

- Screen stays awake for the duration of the workout.
- Minimum body text 16 pt; all logged values ≥15 pt tabular; active values 44 pt.
- Contrast ratio ≥ 7:1 for all numerals against their surface (readable through glare and sweat-smeared glass).
- All primary controls sit in the bottom 40% of the screen — thumb reach, one-handed.
- No horizontal swipe gestures on the logging area (an accidental swipe with a chalky thumb must not change exercise); exercise navigation is by button only.

---

### 5.5 Finish Workout summary

Shown once, on completing the session. Calm, factual, comparative.

```
┌─────────────────────────────────────────┐
│                                         │
│  Workout Complete                       │  title/m, secondary
│  Chest + Triceps                        │  display/l
│  Monday 3 September · 18:42             │  caption
│                                         │
│  ───────────────────────────────────    │
│                                         │
│   DURATION        EXERCISES             │
│   58 min          5                     │  display/l, 2×2 grid
│                                         │
│   SETS            TOTAL VOLUME          │
│   18              6,850 kg              │
│                                         │
│  ───────────────────────────────────    │
│                                         │
│  COMPARED WITH 27 AUG                   │  label
│                                         │
│  Volume              6,500 → 6,850  ↑5.4%│  positive
│  Bench Press          60 → 62.5 kg  ↑2.5 │
│  Tricep Pushdown      25 → 25 kg      —  │  em dash, neutral, not red
│                                         │
│  ───────────────────────────────────    │
│                                         │
│              D O N E                    │  accent
│                                         │
│         Add a note to this session      │  text link
└─────────────────────────────────────────┘
```

Only lifts that changed appear in the comparison, plus any that regressed — capped at five rows with "…and 2 more" expanding inline. Unchanged lifts show `—`, never a red down-arrow: maintaining is not failing.

If there is no previous session for this workout, the comparison block is replaced by a single line: *"First time logging Chest + Triceps. Next time you'll see your progress here."*

---

### 5.6 Progress

Answers exactly one question: **am I getting stronger?** Structured per-exercise, because that is the only level at which progressive overload is actionable.

```
┌─────────────────────────────────────────┐
│  Progress                               │
│  ┌─────────────────────────────────┐    │
│  │  Bench Press                 ⌄  │    │  exercise selector
│  └─────────────────────────────────┘    │
│                                         │
│  [ Weight ][  Reps  ][ Volume ][ Rest ] │  segmented control
│                                         │
│  67.5 kg                        ↑ 7.5   │  display/l + delta since first
│  Latest · 12 Sep                        │  caption
│                                         │
│   70 ┤                            ●     │
│      │                      ●──── │     │  line chart, 2px accent
│   65 ┤                ●─────      │     │  hairline grid, no fill,
│      │          ●─────            │     │  no legend, no axis clutter
│   60 ┤   ●──────                  │     │
│      └────┬─────┬─────┬─────┬─────┬     │
│         Sep1  Sep4  Sep8  Sep12 Sep15   │
│                                         │
│  ───────────────────────────────────    │
│   LATEST            BEST WEIGHT         │
│   67.5 kg × 8       70 kg               │
│   BEST REPS         TOTAL VOLUME        │
│   10                42,500 kg           │
│  ───────────────────────────────────    │
│                                         │
│  HISTORY                                │
│   DATE     WEIGHT   REPS    VOLUME      │
│   Sep 12   65 kg      8      520 kg     │
│   Sep 8    62.5 kg    9    562.5 kg  ↑  │  ↑ marks a session that beat
│   Sep 4    62.5 kg    8      500 kg  ↑  │    the previous on this metric
│   Sep 1    60 kg      8      480 kg     │
│                                         │
│   + 5 kg since first recorded session   │  positive, single summary line
│                                         │
├─────────────────────────────────────────┤
│  Today    Week    Progress    History   │
└─────────────────────────────────────────┘
```

**The chart only appears once there is enough history.** Below three sessions there is no line — two points are a segment, not a direction, and drawing one would imply a trend the data cannot support. Until then the slot holds a short pre-trend state: filled dots showing how many sessions are recorded out of the three needed, and one sentence saying how many more to go. The summary numbers and history table stay visible throughout, because a single session is still worth reading; it just is not yet a trend.

**Chart rules.** One series. No area fill, no gradient, no dual axis, no markers except the data points themselves.

- **The axis rounds to numbers a person would choose** — 60 and 70, not 58.13 and 69.38. Steps come from the 1 / 2 / 2.5 / 5 family, so barbell increments and rep counts both land on sensible marks. A derived padding value on the axis label is a tell that the chart was drawn by arithmetic rather than designed.
- Y-axis floors near the data, not at zero: a bench going 60 → 67.5 kg must read as a climb, not a flat line. The floor is always labelled, so it cannot mislead.
- **The most recent session is the filled point**, in `focus` teal. It is the number the user is trying to beat next time, and it should be findable without counting along the line.
- Up to four date ticks, always including the first and last session.
- Tapping a point shows a small inline readout of that session's value; it does not navigate away.

**Metric definitions** (kept deliberately few and plain)
- **Weight** — the heaviest working set of that session.
- **Reps** — reps achieved on the heaviest set.
- **Volume** — Σ(weight × reps) for that exercise in that session.
- **Rest** — mean rest between sets of that exercise in that session.

No estimated 1RM, no Wilks, no intensity scores, no fatigue index, no readiness. If a future need for e1RM appears, it goes behind a setting and is labelled as an estimate.

#### 5.6.1 Rest analysis

Rest is a first-class metric here because it is automatically captured and it silently explains performance changes.

```
  [ Weight ][ Reps ][ Volume ][ Rest ]

  1:32                                    display/l
  Average rest · Bench Press

  2:00 ┤
       │        ●     ●
  1:30 ┤  ●──●──┘─────┘──●               small line chart
       │
  1:00 ┤
       └──┬────┬────┬────┬────┬
         1:28 1:31 1:35 1:30 1:32        last 5 workouts

  Per-set rest is shown inside each
  workout in History.
```

That is the entire feature. No recovery scores, no "optimal rest" recommendations, no warnings for resting too long. It reports; it does not advise.

#### 5.6.2 Progress empty states

- **No data at all:** *"Progress appears after your first logged workout."* + `Start today's workout`.
- **Fewer than three sessions:** the summary values and history table render as normal; the chart area holds the pre-trend state described above — three dots, filled to show progress toward a readable trend, and one sentence naming how many sessions remain.
- **Exercise not trained in 30+ days:** a quiet caption under the chart, *"Last trained 46 days ago"* — factual, no nagging.

---

### 5.7 History

A chronological log of what actually happened. Read-mostly.

```
┌─────────────────────────────────────────┐
│  History                            🔍  │
│  [ All ][ Chest+Tri ][ Back+Bi ][ Legs ]│  filter chips
│                                         │
│  SEPTEMBER                              │  sticky section header
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Tue 3                            │   │
│  │ Chest + Triceps                  │   │  title/m
│  │ 58 min · 18 sets · 6,850 kg   ↑  │   │  mono/num + delta arrow
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ Sun 1                            │   │
│  │ Back + Biceps                    │   │
│  │ 64 min · 20 sets · 7,240 kg      │   │
│  └─────────────────────────────────┘    │
│                                         │
│  AUGUST                                 │
│  ┌─────────────────────────────────┐    │
│  │ Fri 30                           │   │
│  │ Legs                             │   │
│  │ 71 min · 22 sets · 11,400 kg  ↑  │   │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│  Today    Week    Progress    History   │
└─────────────────────────────────────────┘
```

A session **note appears to the right of the card**, separated by a left rule, capped at three
lines and given a fixed 44% of the width so a long note can never push the numbers around. The
log is still the point; the note is a margin annotation on it.

**Session detail** — expandable per exercise, rest times shown inline because they were captured for free and are otherwise invisible.

```
┌─────────────────────────────────────────┐
│  ‹ History                          ⋯   │
│                                         │
│  Chest + Triceps                        │  display/l
│  Tuesday 3 September · 18:42 – 19:40    │  caption
│                                         │
│  58 min · 5 exercises · 18 sets         │  mono/num summary strip
│  6,850 kg total volume                  │
│  ───────────────────────────────────    │
│                                         │
│  ▾ Bench Press                   4 sets │  expanded
│    ┌──────────────────────────────┐     │
│    │  1   60 kg × 8               │     │
│    │             rest 1:32        │     │  rest between, tertiary,
│    │  2   60 kg × 8               │     │  indented — reads as the
│    │             rest 1:41        │     │  gap it represents
│    │  3   62.5 kg × 8             │     │
│    │             rest 1:38        │     │
│    │  4   62.5 kg × 7             │     │
│    └──────────────────────────────┘     │
│    Volume 1,972 kg · Avg rest 1:37      │
│                                         │
│  ▸ Incline Dumbbell Press        4 sets │  collapsed
│  ▸ Cable Fly                     3 sets │
│  ▸ Tricep Pushdown               4 sets │
│  ▸ Overhead Tricep Extension     3 sets │
│                                         │
│  ───────────────────────────────────    │
│  Note                                   │
│  Shoulder felt fine today.              │
└─────────────────────────────────────────┘
```

The first exercise is expanded by default; the rest are collapsed. Rest values are rendered *between* the sets they separate rather than as a column — the vertical gap is the information.

`⋯` offers *Edit session*, *Duplicate as today's workout*, *Delete session* (the only other confirmation dialog in the app).

**Empty state:** *"No workouts logged yet. Your completed sessions will appear here."* + `Start today's workout`.

---

## 6. Empty state catalogue

Rule: one sentence of context, one sentence of guidance, one action. No illustrations, no mascots, no exclamation marks.

| Context | Copy | Action |
|---|---|---|
| No routine configured | "No routine yet. Set up which muscle groups you train on which days — you can change it any time." | `Plan my week` |
| No workout today (rest) | "Rest Day. Next: Tuesday · Back + Biceps" | `+ Add Workout` (secondary) |
| Day not configured | "Nothing planned for Sunday." | `+ Add workout` |
| Day has no exercises | "This day is empty. Add exercises, or leave it as a rest day." | `+ Add Exercise` |
| No history | "No workouts logged yet. Your completed sessions will appear here." | `Start today's workout` |
| No progress data | "Progress appears after your first logged workout." | `Start today's workout` |
| Exercise, under 3 sessions | "2 sessions recorded. Log Bench Press once more and the trend chart appears here." with 3 progress dots | — (summary and history stay visible) |
| Search, no result | "No exercise matches 'zercher'." | `+ Create "zercher"` |

---

## 7. Feedback and system states

| Event | Feedback |
|---|---|
| Set completed | Row flip + accent flash (~500 ms, text inverted to `accent/ink`) + rest panel rises. Two simultaneous visual changes, because this is the confirmation the whole loop depends on |
| Rest timer running | Persistent blue panel; blue dot in resume bar when minimised |
| Rest paused | Digits at 60% opacity, label `REST · PAUSED` |
| Rest skipped | Panel drops away, 150 ms; rest value written silently |
| Exercise completed | Card collapse + tick + 4 s auto-advance |
| Workout completed | Numbers count up once; no confetti |
| Destructive action | Inline 5 s Undo strip in place of the removed element |
| Sheets | Every sheet — action menu and numeric keypad alike — has a rounded top edge. A square edge slices whatever control it lands on cleanly in half, which reads as a clipped element rather than a surface sliding over the screen |
| Menus | A themed bottom action sheet, never a system dialog. Android's `AlertDialog` renders at most three buttons, which silently truncated a five-item menu — and a white system card has no place in a dark, minimal app |
| Value edited | The changed number briefly underlines in accent |
| No feedback at all | Navigation, scrolling, filtering, expanding — these are silent |

The reduced-motion setting disables the animation layer without removing any state information — every animated state also has a static representation. Note that with haptics deliberately absent, motion is the *only* feedback channel, so reduced-motion substitutes an instant state change rather than removing the change.

---

## 8. Responsive behaviour

The interaction model never changes across sizes. Only density and column count do.

### Mobile portrait — 320–480 pt (primary, highest priority)
The specification above. Single column, sticky bottom action bar, bottom tab bar.

### Mobile landscape
Active Workout splits horizontally: set table on the left, number wells and the primary action on the right; the rest timer becomes a full-height right panel. Other screens simply reflow with a wider gutter.

### Tablet — 600–1024 pt
- Tab bar moves to a left rail (icon + label, 88 pt).
- **Today:** single centred column, max 640 pt. Not stretched.
- **Week:** two columns of day cards (Mon–Thu / Fri–Sun) — the whole week visible without scrolling.
- **Customize Day:** master–detail — day list left, exercise editor right.
- **Active Workout:** two columns — current exercise and its set table on the left (60%), a persistent exercise list with completion ticks plus the rest timer on the right (40%). The one-exercise-at-a-time *focus* is preserved; the list is reference, not navigation-bait. The primary action stays full-width under the left column, still bottom-anchored.
- **Progress / History:** chart or session list left, detail right.

### Desktop — 1024 pt+
- Persistent left sidebar (200 pt) with labelled navigation.
- Content max-width 1100 pt, centred. Never full-bleed.
- Active Workout keeps the tablet two-column layout at a larger scale; keyboard support is added — `Space` completes the set, `Tab` between weight and reps, arrow keys step values, `Esc` minimises. Number wells accept direct typing.
- Hover states appear (subtle `bg/raised` lift) but no functionality is hover-only.

**Adaptation rules**
1. Larger screens gain *context*, never *steps*. No screen splits into a wizard.
2. The primary action stays bottom-anchored and full-width within its column at every size.
3. Number sizes do not shrink on large screens; the surrounding space grows.

---

## 9. Accessibility

- All text ≥ 4.5:1 contrast; all numerals in Active Workout ≥ 7:1.
- Full support for OS dynamic type up to 200%; the Active Workout layout is tested at 200% and reflows the number wells to stack vertically rather than truncate.
- Every icon-only control (`⌄`, `⋯`, `⣿`, timer controls) carries an accessible label.
- Timer state changes are announced to screen readers as polite live-region updates, not per-second.
- Colour is never the sole carrier of meaning: rest state also changes the label text; progression deltas also carry `↑ ↓ —` glyphs.
- Minimum 48 dp touch targets throughout; 8 dp minimum spacing between adjacent targets.

---

## 10. Design acceptance criteria

The design succeeds if, without instruction, the user can:

1. Start today's workout in **one tap** from launch.
2. Log a repeat set in **one tap**.
3. Log a changed set in **three taps** or fewer.
4. See, at any moment during a workout and without navigating: current exercise, current set number, today's logged values, last session's values, live rest time.
5. Never manually enter a rest time.
6. Answer "am I lifting more than a month ago?" in **two taps** from launch.
7. Lose nothing if the app is killed mid-workout.
8. Complete an entire session one-handed.
