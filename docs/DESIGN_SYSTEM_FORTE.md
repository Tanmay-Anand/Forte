# Forte — Design System

The working reference for building Forte's UI: every token, every component, and the rules that
connect them. It describes **what the code does today** (v1.1.0), checked against `src/ui/` and the
feature components.

Companion documents: [`DESIGN.md`](DESIGN.md) explains *why* (product intent, screens,
interaction). This file explains *how* (the system you build with). Where they disagree,
§9 lists the differences.

**Sources of truth, in order:**

1. `src/ui/tokens.ts`: every colour, type size, space, radius and size constant
2. `src/ui/theme.tsx`, `src/ui/Text.tsx`, `src/ui/Icon.tsx`: the only way tokens reach the screen
3. This document: usage rules and the component catalogue
4. `DESIGN.md`: intent and rationale

---

## 1. What the system is for

Forte is used standing at a bench, between sets, with about four seconds of attention and one
free hand. Every rule below follows from that.

| Principle | System consequence |
|---|---|
| **The brightest thing is the thing to do** | One light-filled `accent` capsule per screen: the primary action, or the selected tab |
| **Colour means state, never decoration** | `rest` blue appears only while a rest timer runs. `focus` teal marks live or "now" data. `positive`/`negative` appear only next to a delta |
| **Numbers are the content** | Large tabular numerals, a dedicated `num` style, no jitter while counting |
| **Depth by tone, not shadow** | Four background tones plus two line tones. No drop shadows anywhere |
| **Every target is thumb-sized** | 48 dp minimum, a 60 dp primary action, a 68 dp in-workout action |
| **Feedback is visual only** | No haptics. The set-completion flash *is* the confirmation, so it is never subtle |
| **Quiet voice** | Typographic, no emoji, no illustrations, no celebration beyond one flash |

---

## 2. Foundations

### 2.1 Colour

Sixteen tokens, two themes. **Dark is the default outright.** It does not follow the OS. *System*
and *Light* are opt-ins in Settings.

| Token | Dark | Light | Role |
|---|---|---|---|
| `bgBase` | `#0A0A0B` | `#FAFAFA` | App background |
| `bgRaised` | `#141517` | `#FFFFFF` | Cards, rows, chips, secondary buttons |
| `bgSunken` | `#101113` | `#F2F3F5` | Number wells, segmented tracks, muted cards, pressed states |
| `bgElevated` | `#1B1D20` | `#FFFFFF` | Floating surfaces: pill nav, sheets, resume/update bars |
| `hairline` | `#1F2124` | `#E7E8EB` | 1 px dividers, quiet borders |
| `lineStrong` | `#2C3034` | `#D2D5D9` | Input borders, dashed cards, accent-tone chip borders |
| `textPrimary` | `#F3F4F6` | `#111214` | Numbers, exercise names, titles |
| `textSecondary` | `#9AA0A6` | `#5B6068` | Labels, metadata, logged set values |
| `textTertiary` | `#62676E` | `#8B9199` | Previous-session values, hints, table headers |
| `accent` | `#F3F4F6` | `#16181B` | Primary-action fill, selected tab, active chip/segment, set flash |
| `accentInk` | `#0A0A0B` | `#FFFFFF` | Anything drawn **on** `accent` |
| `focus` | `#5FD3BC` | `#0F9E8A` | Live data, chart's selected point, progress bar fill |
| `positive` | `#72CBA4` | `#1C7A55` | Progression up, logged-set tick, update-ready dot |
| `negative` | `#DD8B80` | `#B4463A` | Regression, destructive menu items |
| `rest` | `#8FB4E8` | `#2A63BE` | Rest timer state **only** |
| `restInk` | `#0A0A0B` | `#FFFFFF` | Anything drawn on `rest` |

**Rules**

1. **Never hard-code a colour.** Read `c` from `useTheme()`. The two exceptions in the codebase are
   the modal scrim `#000000B8` (ActionSheet, NumericKeypad) and the app-icon backgrounds in
   `app.json`.
2. **`accent` is a light fill, not a hue.** On dark it's near-white; on light it inverts to
   near-black. At most one accent-filled *action* per screen (selected tab and active chips are
   state, not actions).
3. **Pair fills with their ink.** `accent` → `accentInk`, `rest` → `restInk`. Grey text on an
   accent fill is illegible, which is why the set flash inverts its row's text to `accentInk`.
4. **`rest` is reserved.** If it's on screen, a rest timer is running. It is the notification.
5. **No saturated fields.** Status colours colour text, dots, strokes and thin borders, never a
   large surface.

**Measured contrast** (WCAG ratio, against the background each pair actually sits on):

| Pair | Dark | Light | Verdict |
|---|---|---|---|
| `textPrimary` / `bgBase` | 18.0 | 18.0 | Pass |
| `textSecondary` / `bgBase` | 7.5 | 6.1 | Pass |
| `textSecondary` / `bgSunken` | 7.2 | 5.7 | Pass |
| `accentInk` / `accent` | 18.0 | 17.8 | Pass |
| `positive` / `bgBase` | 10.2 | 5.1 | Pass |
| `negative` / `bgBase` | 7.6 | 5.2 | Pass |
| `rest` / `bgRaised` | 8.6 | 5.8 | Pass |
| `focus` / `bgBase` | 10.9 | **3.2** | Light fails for text |
| `textTertiary` / `bgBase` | **3.5** | **3.0** | Fails 4.5:1 in both themes |
| `textTertiary` / `bgRaised` | **3.2** | **3.2** | Fails 4.5:1 in both themes |

`textTertiary` is deliberately recessive, but `DESIGN.md` §9 promises ≥ 4.5:1 for all text. See
§9.

### 2.2 Typography

**Urbanist** throughout, in four weights. Until the font loads, `Text` falls back to the platform
font at the mapped weight, so the first frame is never blank. The native splash screen stays up
until fonts and the database are ready, so in practice users never see the fallback.

| Variant | Size / line | Tracking | Weight | Tabular | Used for |
|---|---|---|---|---|---|
| `displayXl` | 68 / 72 | −2.5 | 700 | yes | Reserved, unused today |
| `displayL` | 44 / 48 | −1.2 | 700 | yes | Today's workout name, number wells, keypad display, summary and progress heroes |
| `displayM` | 30 / 36 | −0.7 | 700 | — | Rest clock, `StatGrid` values |
| `titleL` | 23 / 29 | −0.4 | 600 | — | Exercise name in Active Workout, keypad keys, stepper glyphs |
| `titleM` | 18 / 24 | −0.2 | 600 | — | Screen titles, large-button labels (≥ 60 dp) |
| `body` | 16 / 22 | −0.1 | 400 | — | Running text, list rows, sheet items |
| `bodyStrong` | 16 / 22 | −0.1 | 600 | — | Small-button labels, Undo, sheet cancel |
| `label` | 12 / 16 | +0.7 | 500 | — | **Always uppercase.** Section labels, table headers |
| `num` | 15 / 20 | −0.1 | 500 | yes | Set tables, history values, clocks in bars |
| `caption` | 13 / 18 | −0.1 | 400 | — | Hints, chips, metadata, previous-session lines |

**Rules**

- **`Text` is the only text component.** Choose a `variant` and a `color` token. Don't set
  `fontSize`, `fontFamily` or `fontWeight` in a style.
- **Anything that counts uses a tabular variant** (`displayXl`, `displayL`, `num`) or
  `tabular={true}`, so digits don't shift as a timer ticks.
- `label` uppercases itself; `uppercase` is available for other variants, but nothing else in the
  app uses it. Uppercase is for small labels only.
- Display sizes carry negative tracking; `label` carries positive tracking. Leave tracking alone,
  except for `shout` on headline buttons (+0.4).
- `×` in `62.5 × 8` is typography and stays as text.

### 2.3 Spacing

A 4 pt grid. Use the named step, never a raw number.

| `xs` | `s` | `m` | `l` | `xl` | `xxl` | `xxxl` |
|---|---|---|---|---|---|---|
| 4 | 8 | 12 | 16 | 24 | 32 | 48 |

Typical rhythm:
- `xs` between a label and its value
- `s` between related controls
- `l` inside cards, and the default `Spacer`
- `xl` between sections
- `xxxl` at the bottom of scroll content

### 2.4 Shape

| Token | Value | Used for |
|---|---|---|
| `radius.chip` | 10 | Reserved, unused today |
| `radius.input` | 14 | Number wells, undo strip, keypad buttons |
| `radius.card` | 20 | Cards, rest panel. Sheets use `card + 8` = 28 at the top |
| `radius.pill` | 999 | **Every button**, chips, segmented control, pill nav, resume/update bars |
| `radius.none` | 0 | Reserved |

Sharp corners appear nowhere. A sheet's top edge is always rounded, because a square edge reads as
a clipped control.

### 2.5 Elevation

There are no shadows. Depth comes from **tone** and **hairlines**:

```
bgBase  →  bgRaised (cards, rows)  →  bgElevated (floating: nav, sheets, bars)
               ↘ bgSunken (recessed: wells, tracks, pressed)
```

A floating surface is `bgElevated` + 1 px `hairline` border + `radius.pill` or a 28 pt sheet
radius. Scrims are `#000000B8`.

### 2.6 Layout and sizing

| Constant | Value | Meaning |
|---|---|---|
| `gutter.mobile` / `tablet` / `desktop` | 20 / 32 / 40 | Horizontal screen padding, from `useGutter()` |
| Breakpoints | < 600 / 600–1023 / ≥ 1024 | `useBreakpoint()` → `mobile` / `tablet` / `desktop` |
| Content max width | 1100 | `Screen` centres content beyond this |
| `HIT` | 48 | Minimum touch target, used as `minHeight`/`minWidth` |
| `PRIMARY_ACTION_HEIGHT` | 60 | Default `Button` height |
| `WORKOUT_ACTION_HEIGHT` | 68 | Complete Set / Start Set / Next Exercise |
| `NAV.height` / `button` / `inset` | 64 / 52 / 18 | Floating pill nav |
| `NAV.clearance` | 98 | Bottom space a tab screen leaves so content clears the nav |

Rules:
- Tab screens pass `navClearance` to `Screen`.
- Active Workout is a full-screen modal above the tabs. It has no tab bar, and its primary action
  is pinned to the bottom of the screen.
- Larger screens gain *space*, never *steps*: the only responsive adaptation today is the gutter
  and max width.

### 2.7 Motion

Physical and brief. Only two things animate today:

| Element | Motion | Respects reduced motion |
|---|---|---|
| Pill nav disc | Spring (damping 18, stiffness 220, mass 0.9) between slots; icons crossfade in step | Yes, jumps instantly |
| Set-completion flash | Row fills with `accent`, text inverts to `accentInk`, fades over 520 ms | No (see §9) |
| Screen transitions | Stack default `fade`; Active Workout `slide_from_bottom`; detail screens `slide_from_right` | No |

`duration` tokens (`instant 100`, `fast 120`, `base 200`, `slow 220`) exist but nothing reads them
yet. New animation should use them. Reanimated is installed and configured but unused.

**Live values tick without re-rendering the screen.** `RestClock` and `WorkoutClock` are the only
components that re-render each second. They compute from stored timestamps, and the interval only
triggers a redraw. Follow this pattern for anything that counts.

### 2.8 Iconography

**Feather**, stroked, via `Icon` (or `Feather` directly inside `src/ui/`). Default 18 pt in
`textSecondary`. Common sizes: 14 (inside chips), 16–17 (bar and timer controls), 21 (nav),
22 (header).

- No emoji, and no Unicode glyphs used as icons. Font substitution moves their baseline and can
  render them as colour emoji.
- Every icon-only control has an `accessibilityLabel`.

---

## 3. Theming

```tsx
const { c, name, reducedMotion, fontsReady } = useTheme(); // or useColors() for c only
```

- `ThemeProvider` resolves the setting: `dark` | `light` win outright, and `system` follows the OS
  (anything but `light` resolves to dark).
- `c` is a flat token map. Pick by role (`c.bgRaised`), never by hex.
- Light is a full theme, not an inversion. When adding a token, add it to **both** palettes.
  `Colors` is derived from the dark palette's keys, so a token missing from light is a type error.
- `StatusBar` follows the theme; the splash and Android navigation-bar colour stay dark in both.

---

## 4. Components: core (`src/ui/`)

| Component | Purpose | Key spec | Rules |
|---|---|---|---|
| **`Text`** | All text | `variant`, `color`, `tabular`, `uppercase`, `align` | The only text component |
| **`Button`** | Full-width actions | Pill. Height 60 (68 in workout). Label `titleM` if height ≥ 60, else `bodyStrong`. Pressed opacity 0.82, disabled 0.35 | Variants: `primary` (accent), `secondary` (bgRaised), `ghost`, `rest`. `shout` for headline actions. One `primary` per screen |
| **`ControlChip`** | Secondary controls beside a primary action | Pill, min height 40, 1 px border (`hairline`, or `lineStrong` for `tone="accent"`), `caption` text, optional 14 pt icon left/right | Must look like a button. Bare tinted text gets missed mid-workout |
| **`Chip`** | Filters | Pill, height 38. Active is `accent` fill + `accentInk` text, inactive `bgRaised` | Selection state only, never actions |
| **`Segmented`** | Exclusive metric switch | `bgSunken` pill track, 4 pt padding, 40 pt thumbs, active thumb `accent` | `accessibilityRole="tab"` |
| **`IconButton`** | Icon-only actions | 48 × 48 minimum, hitSlop 8, pressed opacity 0.6 | Requires `label` |
| **`Icon`** | Feather glyph with a token colour | Default 18, `textSecondary` | No emoji or glyph characters |
| **`Screen`** | Page scaffold | SafeArea top, responsive gutter, max width 1100, optional scroll | `navClearance` on tab screens |
| **`Card`** | Grouped content | `bgRaised`, radius 20, padding 16. `muted` → `bgSunken`. `dashed` → transparent with a dashed `lineStrong` border (empty or unconfigured states) | Pressable cards dim to 0.75 |
| **`Divider`** | Separation | 1 px `hairline`, optional left inset | Prefer over borders and cards |
| **`Spacer`** | Vertical gap | Default `space.l` | Use grid values |
| **`SectionLabel`** | Section heading | `label` in `textSecondary`, optional right-hand value in `textTertiary` | Uppercase via variant |
| **`StatGrid`** | Big-number summaries | 2 columns; `label` over a `displayM` value; `tone` positive/negative | Tone only on deltas |
| **`EmptyState`** | No-data states | `titleM` + `body` (max 380 wide) + one action | One sentence of context, one of guidance, one action. No illustrations |
| **`ActionSheet`** | Menus | `bgElevated` sheet, top radius 28, 36 × 4 handle, 56 pt rows, optional hint, `negative` for destructive | Replaces `Alert` menus. Android's AlertDialog drops buttons past three |
| **`UndoStrip`** + `useUndo` | Reversible removal | `bgRaised`, radius 14, 48 high, 5 s window, `Undo` in `accent` | The default answer to "are you sure?" |
| **`PillNav`** | Tab bar | Floating `bgElevated` capsule, 64 high, four 52 pt circular buttons, sliding `accent` disc. Hosts `UpdateBar` and `ResumeBar` above it | Icon-only, fixed order, labelled |
| **`LineChart`** | Single-series trend | SVG; 2 px `textPrimary` line, `hairline` gridlines on rounded steps, points r4 (`r6 focus` when selected), labelled y-axis that need not start at zero | No area fill, no legend, no second axis. Shown only at ≥ 3 points (`MIN_POINTS_FOR_TREND`) |

## 5. Components: workout and feature

| Component | File | Spec | Why it looks like this |
|---|---|---|---|
| **`NumberWell`** | `features/workout/NumberWell.tsx` | 88 high, `bgSunken`, radius 14, `lineStrong` border; `displayL` value (auto-shrinks), 56 pt steppers at each side, `label` unit below | Three input modes: steppers (hold to repeat), tap for the keypad, vertical drag at 12 px per step |
| **`NumericKeypad`** | `features/workout/NumericKeypad.tsx` | Bottom sheet, top radius 28; `displayL` read-out; 3 × 4 grid of 64 pt keys in `titleL`; Cancel / Done 56 pt, radius 14 | Digits where the thumb is. The first key press replaces the value |
| **`SetTable`** / `LoggedRow` | `features/workout/SetTable.tsx` | `num` rows, `label` headers in `textTertiary`, a `positive` tick per logged set, optional inline `rest mm:ss` | Recessive by design: logged rows stay quiet so the eye stays on the active row. The flash is the commit confirmation |
| **`PreviousLine`** | same | `label` + `caption`, both `textTertiary` | Last time's numbers sit directly above today's inputs |
| **`RestPanel`** | `features/workout/RestPanel.tsx` | `bgRaised` bar, radius 20, **3 px `rest` left edge**, `REST` / `REST · PAUSED` label, `displayM` clock at 60% opacity when paused, three 44 pt round controls on `bgSunken` | A compact bar, not a takeover. The thing you're resting *from* stays visible. Counts up, because there's no target to count down to |
| **`RestClock`** / **`WorkoutClock`** | same | Isolated 1 s re-render, derived from timestamps | The battery and correctness pattern for live values |
| **`ResumeBar`** | `features/workout/ResumeBar.tsx` | 46 high pill, `bgElevated` + hairline, 7 pt status dot (`rest` while resting, else `focus`), name + clocks | The minimised workout is never lost |
| **`UpdateBar`** | `features/updates/UpdateBar.tsx` | Same geometry as ResumeBar; `positive` dot, *Update ready*, accent **Restart** pill, Feather `x` to dismiss | Hidden during a workout. A restart is never offered between sets |
| **`ExercisePicker`** | `features/routine/ExercisePicker.tsx` | Sheet with search, muscle-group chips, recents, multi-add | Stays open for adding several exercises |

### 5.1 Surfaces outside the app UI

| Surface | Spec |
|---|---|
| **Lock-screen notification** (`workout-notification.ts`) | Silent ongoing notification. Android's own chronometer draws the time from the derived rest start. Titles: `Resting · Bench Press`, `Rest paused · 01:23`, `Bench Press · Set 4`. At most two actions: `Pause`/`Resume` + `Start set n`, or `Log 80 kg × 8`. Copy follows the in-app button labels exactly |
| **Splash** | White **Forte.** wordmark on `#0A0A0B`, dark in both OS modes, held until fonts and database are ready |
| **App icon** | Bordered dark square, off-centre white disc, wordmark low-left; adaptive foreground inset to 62% on `#1C1C1C` |
| **Android nav bar** | Hidden; `overlay-swipe` reveals it over the app without moving the layout |

---

## 6. Patterns

**Primary action.** One full-width pill at the bottom of the screen, `accent` fill, `shout` for the
headline verbs (START WORKOUT, COMPLETE SET, START SET *n*). The label names exactly what happens:
on the last exercise, "Next exercise" becomes "Finish workout".

**Secondary actions.** `ControlChip`s in a wrapping row above the primary action. Rarely-used or
destructive actions go in the `⋯` `ActionSheet`.

**Confirmation.** Undo, not dialogs. Only two actions are truly unrecoverable and get a dialog:
discarding a workout and deleting a session. Everything else removes immediately and offers a 5 s
`UndoStrip`.

**Feedback.**
- Logging a set: the row flash, plus the rest panel appearing.
- Pausing: the label text and 60% digits, never colour alone.
- Navigating, scrolling and filtering: silent.

**Empty states.** Context, guidance, one action. Never an illustration. The progress chart says
how many more sessions it needs rather than drawing a line through two points.

**Numbers.**
- Weight is stored in kg and converted only for display (`formatWeight`, `toDisplayWeight`).
- `trimNumber` drops trailing zeroes but never real ones (`10` stays `10`).
- Durations are `mm:ss`, or `h:mm:ss` from an hour.
- Volume is `6,850 kg`.

**Live values.** Derive from stored timestamps. Render in an isolated component that owns its own
1 s interval. Never store a ticking value.

**Copy.**
- Second person, plain verbs, no exclamation marks.
- State a regression; don't flag it.
- Hints explain consequences ("Swaps it for today only — your weekly routine is unchanged").

---

## 7. Accessibility

- Touch targets are ≥ 48 dp (`HIT`, `IconButton`, `hitSlop` on small controls).
- Icon-only controls carry `accessibilityLabel`. Buttons, tabs and segments declare `accessibilityRole` and `accessibilityState`.
- Progress uses `accessibilityRole="progressbar"` with a value. The rest clock sets `accessibilityLiveRegion="none"`, so screen readers are not interrupted every second.
- Meaning never relies on colour alone: rest state changes label text, and deltas carry signs.
- Numbers use tabular figures.
- Dynamic type is honoured by default (RN `allowFontScaling`). The 200% layout promised in `DESIGN.md` §9 is unverified.

---

## 8. Adding to the system

Before merging UI work:

1. Every colour comes from `c.*`, and every new token exists in both palettes.
2. Every text node is `Text` with a `variant`. There are no raw `fontSize`/`fontFamily` values.
3. Spacing, radii and sizes come from tokens.
4. Touch targets are ≥ 48 dp. Icon-only controls are labelled.
5. There is at most one accent-filled action on the screen.
6. Anything animated checks `reducedMotion` and uses `duration.*`.
7. Anything that ticks is isolated and derived from timestamps.
8. The change has been checked in both themes on a device. Fast Refresh has silently skipped edits
   before, so reload fully when in doubt.
9. A new reusable piece goes in `src/ui/` if it's generic, or in `src/features/<area>/` if it's
   domain-specific, and gets a row in §4 or §5 of this file.

---

## 9. Drift and debt

The specification and the implementation disagree in these places. Each item is either a bug to
fix or a spec line to update. Decide which, then delete the row.

| # | Area | `DESIGN.md` says | Code does | Suggested resolution |
|---|---|---|---|---|
| 1 | Contrast | All text ≥ 4.5:1 (§9) | `textTertiary` is 3.0–3.5:1, and it's used for previous-session values | Lighten dark `textTertiary` toward `#7A8088` and darken light toward `#6E747C`, or keep it for non-essential hints only |
| 2 | Contrast | — | Light `focus` `#0F9E8A` is 3.2:1 as text (chart's selected value) | Darken to about `#0B7F6F` for text, or use `textPrimary` for the value |
| 3 | Type ramp | display/xl 64/60, title/l 24, title/m 19, label 13, caption 12 (§3.3) | 68/72, 23, 18, 12, 13; adds `displayM` and `bodyStrong` | Update §3.3 to the code. The code is what has been tested on device |
| 4 | Raw text styles | "Nothing may hard-code a font size" (`tokens.ts`) | Three `TextInput`s set `fontSize`/`fontWeight` directly, so they render in the **system font**, not Urbanist (day name, session note, exercise search) | Add a `useTextStyle(variant)` helper and apply it to `TextInput` |
| 5 | Motion | Row flip, rest panel rise, exercise collapse, slide, summary count-up (§3.5) | Only the nav disc and set flash animate | Trim §3.5 to what exists, or build them with `duration.*` tokens |
| 6 | Reduced motion | "Replaces all of the above with opacity-only fades" | Honoured by the nav only; the set flash and stack transitions ignore it | Pass `reducedMotion` to SetTable (instant invert, hold, clear) and to the stack's `animation` |
| 7 | Tokens | — | `duration.*` and `radius.chip` are never used; Reanimated is installed but unused | Use them or remove them |
| 8 | Responsive | Tablet left rail, two-column Active Workout, desktop sidebar (§8) | Only gutters and max width change | Mark §8 as future work, or implement it |
| 9 | Accessibility | Dynamic type to 200%, wells stack vertically (§9) | Not verified | Test at 200% on device |
| 10 | Accessibility | Timer state announced as polite live-region updates | The clock is silenced (`none`), but pause/resume aren't announced either | Add a polite announcement on state change only |
| 11 | Scrim | Tokens for every colour | `#000000B8` hard-coded twice | Add a `scrim` token |
| 12 | Haptics | None | None, consistent | — |
