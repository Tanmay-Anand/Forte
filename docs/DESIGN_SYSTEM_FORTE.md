# Forte — Design System

The working reference for building Forte's UI: every token, every component, and the rules that
connect them. It describes **what the code does today** (v1.2.0: the post-v1.1.0 design-system pass, plus drop
sets, the body figure and Wi-Fi sync to the PC companion), checked against `src/ui/` and the
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
| **The brightest thing is the thing to do** | The `accent` fill appears on exactly four things: the primary `Button`, the pill nav's selected disc, the keypad's **Done** (the sheet's own primary action), and the half-second set flash. Selection elsewhere uses a border, not accent |
| **Colour means state, never decoration** | `rest` blue appears only while a rest timer runs. `focus` teal marks live or "now" data, and how much each muscle was trained on the body figure (one hue, five strengths). `positive`/`negative` appear only next to a delta |
| **Numbers are the content** | Large numerals and a dedicated `num` style. Anything that ticks uses fixed-width digits (`TabularDigits`), so clocks never shuffle sideways |
| **Depth by tone and line, not shadow** | Four background tones plus three line tones. No drop shadows anywhere |
| **Every target is thumb-sized** | 48 dp minimum, a 60 dp primary action, a 68 dp in-workout action |
| **Feedback is visual only** | No haptics. The set-completion flash *is* the confirmation, so it is never subtle |
| **Quiet voice** | Typographic, no emoji, no illustrations, no celebration beyond one flash. The body figure is data drawn on anatomy, not decoration |

---

## 2. Foundations

### 2.1 Colour

Eighteen tokens, two themes. **Dark is the default outright.** It does not follow the OS. *System*
and *Light* are opt-ins in Settings.

| Token | Dark | Light | Role |
|---|---|---|---|
| `bgBase` | `#0A0A0B` | `#FAFAFA` | App background |
| `bgRaised` | `#141517` | `#FFFFFF` | Cards, rows, chips, secondary buttons |
| `bgSunken` | `#101113` | `#F2F3F5` | Number wells, segmented tracks, muted cards, pressed states |
| `bgElevated` | `#1B1D20` | `#FFFFFF` | Floating surfaces: pill nav, sheets, resume/update bars |
| `hairline` | `#1F2124` | `#E7E8EB` | 1 px dividers, quiet borders |
| `lineStrong` | `#2C3034` | `#D2D5D9` | Input borders, dashed cards, accent-tone chip borders |
| `lineFloating` | `#1F2124` | `#D2D5D9` | Border of floating surfaces: pill nav, resume/update bars. Hairline in dark; `lineStrong` in light, where it is the only thing separating white-on-white |
| `textPrimary` | `#F3F4F6` | `#111214` | Numbers, exercise names, titles, the chart's selected value |
| `textSecondary` | `#9AA0A6` | `#5B6068` | Labels, metadata, logged set values |
| `textTertiary` | `#80868E` | `#686E76` | Hints, table headers, axis labels. Recessive, but ≥ 4.5:1 everywhere |
| `accent` | `#F3F4F6` | `#16181B` | Primary-action fill, selected tab, active chip/segment, set flash |
| `accentInk` | `#0A0A0B` | `#FFFFFF` | Anything drawn **on** `accent` |
| `focus` | `#5FD3BC` | `#0B7F6F` | Live data: chart's selected point, progress bar fill, history dots. A graphic colour; not used for text |
| `positive` | `#72CBA4` | `#1C7A55` | Progression up, logged-set tick, update-ready dot |
| `negative` | `#DD8B80` | `#B4463A` | Regression, destructive menu items |
| `rest` | `#8FB4E8` | `#2A63BE` | Rest timer state **only** |
| `restInk` | `#0A0A0B` | `#FFFFFF` | Anything drawn on `rest` |
| `scrim` | `#000000B8` | `#000000B8` | Behind modal sheets (ActionSheet, NumericKeypad) |

**Rules**

1. **Never hard-code a colour.** Read `c` from `useTheme()`. The only literal colours left are the
   app-icon and splash backgrounds in `app.json`.
2. **`accent` is a light fill, not a hue.** On dark it's near-white; on light it inverts to
   near-black. At most one accent-filled *action* per screen (selected tab and active chips are
   state, not actions).
3. **Pair fills with their ink.** `accent` → `accentInk`, `rest` → `restInk`. Grey text on an
   accent fill is illegible, which is why the set flash inverts its row's text to `accentInk`.
4. **`rest` is reserved.** If it's on screen, a rest timer is running. It is the notification.
5. **No saturated fields.** Status colours colour text, dots, strokes and thin borders, never a
   large surface.

**Measured contrast** (WCAG ratio, against the background each pair actually sits on). Text needs
4.5:1; graphics such as dots and bars need 3:1.

| Pair | Dark | Light | Floor |
|---|---|---|---|
| `textPrimary` / `bgBase` | 18.0 | 18.0 | 4.5 |
| `textSecondary` / `bgBase` | 7.5 | 6.1 | 4.5 |
| `textSecondary` / `bgSunken` | 7.2 | 5.7 | 4.5 |
| `textSecondary` / `bgElevated` | 6.4 | 6.3 | 4.5 |
| `textTertiary` / `bgBase` | 5.4 | 4.9 | 4.5 |
| `textTertiary` / `bgRaised` | 5.0 | 5.1 | 4.5 |
| `textTertiary` / `bgSunken` | 5.1 | 4.6 | 4.5 |
| `textTertiary` / `bgElevated` | 4.6 | 5.1 | 4.5 |
| `accentInk` / `accent` | 18.0 | 17.8 | 4.5 |
| `restInk` / `rest` | 9.3 | 5.8 | 4.5 |
| `rest` / `bgRaised` (RestPanel label) | 8.6 | 5.8 | 4.5 |
| `rest` / `bgElevated` (ResumeBar label) | 7.9 | 5.8 | 4.5 |
| `positive` / `bgBase` | 10.2 | 5.1 | 4.5 |
| `positive` / `bgRaised` | 9.4 | 5.3 | 4.5 |
| `negative` / `bgBase` | 7.6 | 5.2 | 4.5 |
| `negative` / `bgElevated` | 6.5 | 5.4 | 4.5 |
| `focus` / `bgBase` (graphic) | 10.9 | 4.7 | 3 |
| `focus` / `lineStrong` (progress bar on its track) | 7.3 | 3.3 | 3 |
| `lineFloating` / `bgRaised` (floating border) | 1.1 | 1.5 | 1.4, light only |

**This table is enforced.** `tests/contrast.test.mjs` reads `tokens.ts` directly and fails `npm
test` if any of these pairs (and every text token on all four backgrounds) drops below its floor.
It also fails if the two palettes stop defining the same tokens. A failing test means fix the
token, not the floor.

### 2.2 Typography

**Urbanist** throughout, in four weights. Until the font loads, `Text` falls back to the platform
font at the mapped weight, so the first frame is never blank. The native splash screen stays up
until fonts and the database are ready, so in practice users never see the fallback.

| Variant | Size / line | Tracking | Weight | Used for |
|---|---|---|---|---|
| `displayL` | 44 / 48 | −1.2 | 700 | Today's workout name, number wells, keypad display, summary and progress heroes |
| `displayM` | 30 / 36 | −0.7 | 700 | Rest clock, `StatGrid` values, the day name (and its rename input) |
| `titleL` | 23 / 29 | −0.4 | 600 | Exercise name in Active Workout, keypad keys |
| `titleM` | 18 / 24 | −0.2 | 600 | Screen titles, large-button labels (≥ 60 dp) |
| `body` | 16 / 22 | −0.1 | 400 | Running text, list rows, sheet items, search and note inputs |
| `bodyStrong` | 16 / 22 | −0.1 | 600 | Text actions (Done, Undo, + Create), small-button labels, sheet cancel |
| `label` | 12 / 16 | +0.7 | 500 | **Always uppercase.** Section labels, table headers |
| `num` | 15 / 20 | −0.1 | 500 | Set tables, history values, clocks in bars |
| `caption` | 13 / 18 | −0.1 | 400 | Hints, chips, metadata, previous-session lines |

**Urbanist has no tabular figures.** The font has no `tnum` feature, so `fontVariant:
['tabular-nums']` (which `Text` still requests for `displayL` and `num`) does nothing: at
`displayL` a "1" is 14.5 dp wide and a "0" 26.6 dp. Two consequences:

- **Clocks use `TabularDigits`** (§4), which puts each digit in a fixed-width cell as wide as a
  rendered "0" — Urbanist's widest digit in every weight — measured on screen. Measuring matters:
  Android 14+ scales large text non-linearly, so a computed width spread the digits apart at 200%
  text. `TABULAR_DIGIT_EM` (the widest digit per weight, from the font files) only sizes the first
  frame. `RestClock`, `WorkoutClock` and therefore `ResumeBar` all use it.
- **Static numbers stay proportional.** Number wells and set tables only change on a tap, so a
  small width change is acceptable there, and fixed cells would make "102.5" about 12 dp wider —
  past the number well's width budget at 360 dp.

**Rules**

- **`Text` is the only text component.** Choose a `variant` and a `color` token. Don't set
  `fontSize`, `fontFamily` or `fontWeight` in a style.
- **Inputs use `useTextStyle(variant)`** from `Text.tsx`, which returns the variant's size,
  tracking and line height, and the weight-specific Urbanist family with **no** `fontWeight` (on
  Android, adding a weight to a custom family can fall back to the system font). Drop
  `lineHeight` on single-line `TextInput`s; Android clips them with one.
- **Anything that ticks uses `TabularDigits`.**
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
| `radius.input` | 14 | Number wells, text inputs, undo strip, keypad buttons, sheet rows |
| `radius.card` | 20 | Cards, rest panel. Sheets use `card + 8` = 28 at the top |
| `radius.pill` | 999 | **Every button**, chips, segmented control, pill nav, resume/update bars — and every dot and thin bar (status dots, progress bar, sheet handle), since a pill radius on a small square is a circle |
| `radius.none` | 0 | Reserved |

Sharp corners appear nowhere. A sheet's top edge is always rounded, because a square edge reads as
a clipped control.

### 2.5 Elevation

There are no shadows. Depth comes from **tone** and **lines**:

```
bgBase  →  bgRaised (cards, rows)  →  bgElevated (floating: nav, sheets, bars)
               ↘ bgSunken (recessed: wells, tracks, pressed)
```

- **Floating bars and the pill nav:** `bgElevated` + 1 px `lineFloating` border +
  `radius.pill`. In dark, the tone step from `bgRaised` (`#141517`) to `bgElevated`
  (`#1B1D20`) does the lifting, and the border is a hairline. In light, both are white, so the
  `lineStrong`-weight border is what separates them. A grey tint was rejected: it measured 1.01:1
  against `bgSunken`, which would make floating and recessed surfaces the same colour.
- **Sheets:** `bgElevated` with a 28 pt top radius over `scrim`. The scrim does the separating, so
  sheets need no border.
- **Pressed states** stay `bgSunken` everywhere, including inside sheets.

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
| Nav overlay height | measured | `useNavOverlay` (`src/ui/nav-overlay.ts`): PillNav's `onLayout` height, covering UpdateBar, ResumeBar, the pill and the bottom inset |
| `NAV.clearance` | 98 | Fallback for the above, used only before PillNav's first layout |

Rules:
- Tab screens pass `navClearance` to `Screen`, which pads scroll content by the **measured** overlay
  height + `space.xl`. When ResumeBar or UpdateBar appears the padding grows with it, so the last
  row is never hidden.
- Active Workout is a full-screen modal above the tabs. It has no tab bar, and its primary action
  is pinned to the bottom of the screen.
- Larger screens gain *space*, never *steps*: the only responsive adaptation today is the gutter
  and max width.

### 2.7 Motion

Physical and brief. This is everything that moves:

| Element | Motion | Tokens | Reduced motion |
|---|---|---|---|
| Set-completion flash | Accent fill behind the row; the row's normal ink crossfades to an `accentInk` copy, then everything fades back. Reanimated, UI thread, opacity only | `duration.instant` delay, `duration.flash` (520 ms) fade | Inverts instantly, holds `duration.flashHold` (400 ms), clears with no fade |
| Pill nav disc | Spring between slots; icons crossfade in step (RN Animated, native driver) | `spring.nav` (damping 18, stiffness 220, mass 0.9) | Jumps instantly |
| Screen transitions | Stack default `fade`; Active Workout `slide_from_bottom`; detail screens `slide_from_right` | Platform-timed (Android's native stack ignores durations) | All become `fade` |
| Sheets | ActionSheet `fade`; NumericKeypad, ExercisePicker and the Progress exercise picker `slide` | Platform-timed | `slide` becomes `fade` |

**Rules:** time every animation with a `duration.*` token, or a `spring.*` token for physics.
Animate opacity and transforms, not colours or layout, so it can run on the UI thread. Check
`reducedMotion` from `useTheme()`, and under it keep the state change but drop the movement.
`duration.fast`, `base` and `slow` are defined for new work but nothing reads them yet.

**Live values tick without re-rendering the screen.** `RestClock` and `WorkoutClock` are the only
components that re-render each second. They compute from stored timestamps, and the interval only
triggers a redraw. Follow this pattern for anything that counts.

### 2.8 Iconography

**Feather**, stroked, via `Icon` (or `Feather` directly inside `src/ui/`). Default 18 pt in
`textSecondary`. Common sizes: 14 (inside chips), 16–17 (bar and timer controls), 20 (number-well
steppers, add buttons), 21 (nav), 22 (header).

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
- `StatusBar` and the splash follow the theme (splash ground `#FCFCFB` light, `#111213` dark); the Android navigation bar is hidden during use.

---

## 4. Components: core (`src/ui/`)

| Component | Purpose | Key spec | Rules |
|---|---|---|---|
| **`Text`** | All text | `variant`, `color`, `tabular`, `uppercase`, `align` | The only text component |
| **`useTextStyle(variant)`** | Type ramp for non-`Text` components (`TextInput`) | Returns size, line height, tracking, and the weight-specific Urbanist family with no `fontWeight` (system font at the mapped weight before load) | `Text` uses it too, so the two cannot drift. Drop `lineHeight` on single-line inputs |
| **`TabularDigits`** | Anything that ticks | Each digit in a fixed cell the width of a rendered "0", measured by a hidden copy (`TABULAR_DIGIT_EM` estimates the first frame); separators natural width. One accessible element with a spoken `accessibilityLabel`; glyphs hidden from screen readers | Clocks only. Not for number wells or tables (§2.2) |
| **`Button`** | Full-width actions | Pill. Height 60 (68 in workout). Label `titleM` if height ≥ 60, else `bodyStrong`. Pressed opacity 0.82, disabled 0.35 | Variants: `primary` (accent), `secondary` (bgRaised), `ghost`, `rest`. `shout` for headline actions. One `primary` per screen |
| **`ControlChip`** | Secondary controls beside a primary action, and the Restart in UpdateBar | Pill, min height 40, 1 px border (`hairline`, or `lineStrong` for `tone="accent"`), `caption` text, optional 14 pt icon left/right, optional `accessibilityLabel` | Must look like a button. Bare tinted text gets missed mid-workout. `tone="accent"` is a stronger outline, **not** an accent fill |
| **`Chip`** | Filters | Pill, height 38, `caption`. Active: `bgElevated` fill, 1 px `textSecondary` border, `textPrimary` text. Inactive: `bgRaised`, transparent 1 px border, `textSecondary` | Selection is state, not an action, so no accent. The border is the colour-independent cue. Same weight in both states, so selecting never widens a chip or reflows a wrapping row |
| **`Segmented`** | Exclusive switch (Progress metric, units, theme) | `bgSunken` pill track, `space.xs` padding, 40 pt thumbs. Active thumb: `bgElevated` + 1 px `textSecondary` border + `textPrimary`; inactive transparent | `accessibilityRole="tab"`, `selected` state. Same treatment as Chip |
| **`IconButton`** | Icon-only actions | 48 × 48 minimum, hitSlop 8, pressed opacity 0.6 | Requires `label` |
| **`Icon`** | Feather glyph with a token colour | Default 18, `textSecondary` | No emoji or glyph characters |
| **`Screen`** | Page scaffold | SafeArea top, responsive gutter, max width 1100, optional scroll | `navClearance` on tab screens pads by the measured nav overlay (§2.6) |
| **`Card`** | Grouped content | `bgRaised`, radius 20, padding 16. `muted` → `bgSunken`. `dashed` → transparent with a dashed `lineStrong` border (empty or unconfigured states) | Pressable cards dim to 0.75 |
| **`Divider`** | Separation | 1 px `hairline`, optional left inset | Prefer over borders and cards |
| **`Spacer`** | Vertical gap | Default `space.l` | Use grid values |
| **`SectionLabel`** | Section heading | `label` in `textSecondary`, optional right-hand value in `textTertiary`. Wraps instead of colliding: when both don't fit, the value drops to its own line, still right-aligned | Uppercase via variant. Label–value rows (`MetaRow` on Today) follow the same wrap rule |
| **`StatGrid`** | Big-number summaries | 2 columns; `label` over a `displayM` value; `tone` positive/negative | Tone only on deltas |
| **`EmptyState`** | No-data states | `titleM` + `body` (max 380 wide) + one action | One sentence of context, one of guidance, one action. No illustrations |
| **`SystemModal`** | Every modal | Drop-in for React Native's `Modal`. Shows the Android navigation bar, waits `BAR_SETTLE_MS` (150 ms), then opens; hides the bar again when the last modal closes (`src/ui/system-bars.ts`) | **The only way to open a modal**: lint rejects a raw `Modal` import. A modal opened while the bar is hidden renders blank and blocks every tap |
| **`ActionSheet`** | Menus | `bgElevated` sheet, top radius 28, 36 × 4 handle, 56 pt rows, optional hint, `negative` for destructive | Replaces `Alert` menus. Android's AlertDialog drops buttons past three |
| **`UndoStrip`** + `useUndo` | Reversible removal | `bgRaised`, radius 14, 48 high, 5 s window, **Undo** in `bodyStrong` `textPrimary` | The default answer to "are you sure?" |
| **`PillNav`** | Tab bar | Floating `bgElevated` capsule, 1 px `lineFloating` border, 64 high, five 52 pt circular buttons (Profile appended last), sliding `accent` disc (`spring.nav`). Hosts `UpdateBar` and `ResumeBar` above it, and reports the whole overlay's height to `useNavOverlay` | Icon-only, fixed order, labelled |
| **`LineChart`** | Single-series trend | SVG; 2 px `textPrimary` line, `hairline` gridlines on rounded steps, points r4 (r6 in `focus` when selected), labelled y-axis that need not start at zero. The selected value is written below in `textPrimary` | No area fill, no legend, no second axis. Shown only at ≥ 3 points (`MIN_POINTS_FOR_TREND`) for training; body and lab charts draw from 2. `focus` marks the point, never text. Optional `band` shades a reference range in `bgRaised` behind the line (blood markers), with either edge open |
| **`NavRow`** | A list row that opens something | Label (`body`), optional `caption` line, `num` value in `textSecondary`, chevron, hairline below; `tone="negative"` drops the chevron for destructive rows | Profile, Blood reports, Settings-style lists. No cards around lists |
| **Settings `Switch`** | On/off settings | On: `bgRaised` thumb on a `textSecondary` track. Off: `textTertiary` thumb on a `lineStrong` track. Both ≥ 3:1, tested | Neutral, not accent: the thumb position is the state. The off thumb used to be `bgRaised` too, which measured ~1.3:1 on its track in dark, so it was invisible |

## 5. Components: workout and feature

| Component | File | Spec | Why it looks like this |
|---|---|---|---|
| **`NumberWell`** | `features/workout/NumberWell.tsx` | 106 high (two 48 dp steppers + 8 dp gap + border), `bgSunken`, radius 14, `lineStrong` border. `displayL` value on the left (auto-shrink kept as a backstop); a 49 dp column on the right, behind a hairline, holds Feather `plus` over `minus`; `label` unit below. Sized by the caller (`style`) | Two inputs: steppers (hold to repeat, accelerating) and tap-for-keypad. The column costs 48 dp where flanking steppers cost 112, so "102.5" (95.5 dp) renders at full size in the ~103 dp value area at 360 dp. Wells sit side by side, and stack when OS font scale ≥ 1.5. Drag-to-scrub was removed: the scroll view stole it once the screen could scroll |
| **`NumericKeypad`** | `features/workout/NumericKeypad.tsx` | Bottom sheet over `scrim`, top radius 28; `displayL` read-out; 3 × 4 grid of 64 pt keys in `titleL`; Cancel / **Done** 56 pt, radius 14. Done is accent-filled | Digits where the thumb is. The first key press replaces the value. The sheet is its own context, so Done is its one accent action |
| **`SetTable`** / `LoggedRow` | `features/workout/SetTable.tsx` | `num` rows, `label` headers in `textTertiary`, a `positive` tick per logged set, optional inline `rest mm:ss`. The set and reps columns (44 and 72 dp) scale with the OS font size, capped at 1.5×. Flash per §2.7: accent fill plus a crossfaded `accentInk` copy, mounted only on the flashing row and hidden from screen readers | Recessive by design: logged rows stay quiet so the eye stays on the active row. The flash is the commit confirmation, and it's legible (inverted ink) even on a skipped row |
| **Drop row** | same | A `LoggedRow` directly under its set. The set-number cell holds Feather `corner-down-right` at 16 in `textTertiary` (`accentInk` while flashing) instead of a number; no rest cell. Tap edits, hold removes. Spoken as "Drop 1 of set 2, 25 kilograms, 8 reps" | Reads as part of the set above, not a new set. An icon, not a "↳" glyph: the glyph rendered tiny and off-baseline in Urbanist |
| **`PreviousLine`** | same | `label` + `caption`, both `textSecondary`. Drops join their set with " ↘ ": `40 × 5 ↘ 25 × 8` | The number you're trying to beat, read at arm's length, so it must be plainly legible. Still a step below today's primary-tone values |
| **Drop-set controls** | `app/workout/active.tsx` | After a completed set: a **Drop set** `ControlChip` (Feather `corner-right-down`), **Another drop** once one exists. In drop mode the wells pre-fill about 25% lighter (rounded to the exercise's weight step, same reps), the label reads "Drop *k* · set *n*", a **Cancel drop** chip appears, the rest panel hides, and the primary button reads **COMPLETE DROP** | One extra tap per drop and no new screen. Drops have no rest of their own: completing one restarts the rest clock from the last drop |
| **`RestPanel`** | `features/workout/RestPanel.tsx` | `bgRaised` bar, radius 20, **3 px `rest` left edge**, `REST` / `REST · PAUSED` label, `displayM` `TabularDigits` clock at 60% opacity when paused, three 44 pt round controls on `bgSunken` | A compact bar, not a takeover. While resting it sits **above** the next set's inputs (rest, then set *n*), so it stays on screen at 360 dp and at large text sizes. Counts up, because there's no target to count down to |
| **`RestClock`** / **`WorkoutClock`** | same | `TabularDigits`; isolated 1 s re-render, derived from timestamps; spoken labels ("Rest 1 minute 42 seconds, paused") with live region off | The battery and correctness pattern for live values |
| **`ResumeBar`** | `features/workout/ResumeBar.tsx` | 46 high pill, `bgElevated` + `lineFloating`, 7 pt status dot (`rest` while resting, else `focus`), name (truncates, with `space.s` before the clocks) + both clocks | The minimised workout is never lost |
| **`UpdateBar`** | `features/updates/UpdateBar.tsx` | Same geometry as ResumeBar; `positive` dot, *Update ready*, an outlined **Restart** `ControlChip`, Feather `x` to dismiss | Hidden during a workout. Outlined because the screen's real primary action is elsewhere |
| **`EffortPicker`** | `features/summary/EffortPicker.tsx` | Five labelled steps (Easy → Maximal) on a `bgSunken` track, Segmented's selected treatment; tapping the selected step clears it. `radiogroup` semantics | Asked once, after Finish, never during the workout. Words, not RPE numbers: quicker to answer, and five fit a 360 dp row |
| **`RecordsList`** / **`ComparisonRows`** | `features/summary/SessionReview.tsx` | Records: `body` line + `caption` detail. Comparison: name, `num` change in `textSecondary`, arrow + signed delta in `positive`/`negative`, Feather `minus` in `textTertiary` when unchanged; reps and rest in a `caption` below | Shared by the summary and session detail. Unchanged is a neutral dash, never red |
| **Insight card** | `features/insights/InsightsView.tsx` | `Card`: `label` kind + `caption` span, `bodyStrong` exercise, `body` text in `textSecondary`. Tap opens the lift | At most five. Every card names its numbers and period. No icons, no colour coding |
| **`FlagChip`** | `features/labs/FlagChip.tsx` | Outlined pill, 1 px `textSecondary`, `caption` "Above range" / "Below range" | Neutral, not red: it states where a value sits against the lab's range. The words carry the meaning |
| **`AddResultSheet`** | `features/labs/AddResultSheet.tsx` | Full-screen `SystemModal`: marker search (or create), then value, unit and the lab's range | Ranges are optional and open-ended, as printed |
| **AI reply** | `app/session/[id].tsx` | `Card` headed "From AI, pasted by you" in `label`, text `selectable` | Kept visually apart from recorded numbers, and always labelled as the AI's |
| **`BodyFigures`** | `features/body/BodyFigures.tsx` | Front and back side by side, from MuscleMap photos (MIT). Per figure: a grey base image, then at most five copies of a teal-glow image (one per theme), each clipped to the outlines of the muscles at that level and drawn at opacity .16 / .32 / .5 / .7 / .92. Levels come from `shadeLevels` (1–5 by share of the busiest muscle; 0 untrained). With `onSelect`, near-invisible tap paths sit on top and the selected muscle gets a 5-unit `textPrimary` outline. One `accessibilityLabel` lists the muscles in words | Static and memoised: drawn once when the screen opens, no animation, so it costs no battery afterwards. Images are baked offline (`tools/bake-body.mjs`); the phone only stacks them. Shading is one hue at five strengths, so it reads in both themes and never relies on a colour scale |
| **`MusclesWorked`** | `features/summary/MusclesWorked.tsx` | `SectionLabel` "Muscles worked" / "Sets", `BodyFigures`, a `caption` line "Chest 1 · Front delts 0.5 …" in `textSecondary`, and "Helper muscles count half a set." in `textTertiary` | The numbers under the picture make it exact; the picture makes it quick |
| **Muscles map** | `features/insights/InsightsView.tsx` | `BodyFigures` over four weeks with tap to select; "Most:" and "Least:" captions (least sorts never-trained first); the selection shows sets a week, last trained, and the top three exercises | Answers "what have I been skipping" without a chart |
| **Pair with PC** | `app/pair.tsx` | Pushed screen. A `Card` naming the PC (`label` "PC", `titleM` name, `num` addresses), a `body` sentence saying exactly what will be sent, a `caption` caution, then **Pair** (primary) and Cancel (ghost). Opened without a link, it explains the QR and offers a paste field. After pairing: "Paired" or "Paired, not sent yet" with the reason and what to check | A link that decides where your data goes is never applied silently (§6). Same screen for a camera scan, a paste, or a link from anywhere else |
| **PC companion rows** | `app/settings.tsx` | Unpaired: a `caption` explaining it + a **Pair with PC** row. Paired: the PC name in `body` with one status `caption` below ("Up to date · sent 22 Nov, 14:53", "Waiting to send…", or "Not sent: …" in `negative`), then Send now, Pair again or change PC, Unpair (confirmed) | One line of status, always visible, instead of toasts. Errors say what to check |
| **Sync status line** | `app/workout/summary.tsx` | Under Done, centred `caption` in `textTertiary`: "Sending to MSI…", "Sent to MSI", or "Not sent to MSI yet. Forte tries again…" | Confirms the hands-off flow worked without asking for attention. Never `negative` here: a pending send isn't a failure at this point |
| **`ExercisePicker`** | `features/routine/ExercisePicker.tsx` | Sheet with a `body` search input, muscle-group chips, recents, multi-add; rows end in a Feather `plus`. Text actions (Done · n added, + Create) in `bodyStrong` `textPrimary` | Stays open for adding several exercises |

### 5.1 Surfaces outside the app UI

| Surface | Spec |
|---|---|
| **Lock-screen notification** (`workout-notification.ts`) | Silent ongoing notification. Android's own chronometer draws the time from the derived rest start. Titles: `Resting · Bench Press`, `Rest paused · 01:23`, `Bench Press · Set 4`. At most two actions: `Pause`/`Resume` + `Start set n`, or `Log 80 kg × 8`. Copy follows the in-app button labels exactly |
| **Splash** | Mountain-range mark and **Forte** wordmark; `#FCFCFB` in light, `#111213` in dark; held until fonts and database are ready |
| **App icon** | Mountain-range shield on pale lake `#E9F5F8`; adaptive foreground fits a 62% circle; monochrome layer with ridge cut-outs for Android 13 themed icons; notification small icon `ic_stat_forte`. All drawn by `tools/bake-brand.mjs` |
| **Android nav bar** | Hidden; `overlay-swipe` reveals it over the app without moving the layout |
| **Forte Companion** (`companion/web/`) | A local PC page in the same palette (CSS variables copied from `tokens.ts`, dark by default, light on a toggle) and Tabler icons. Not linted by the app's design rules. **Setup → Phone** card: last backup received (`focus` dot), a `warn` line in `--neg` when the PC's address changed, and the pairing QR |
| **Pairing QR** | Black on white in both themes, 188 px, inside a radius-12 white tile. A deliberate exception to theming: phone cameras read dark-on-light most reliably. Steps beside it, the raw link and addresses folded under a `details`. Shown open until the first backup arrives, then behind **Pair again** |
| **Pairing link** | `forte://pair?v=1&id=…&k=…&h=…&p=…&n=…` (`src/features/sync/link.ts`). Only home-network IPv4 addresses are accepted |

---

## 6. Patterns

**Primary action.** One full-width pill at the bottom of the screen, `accent` fill, `shout` for the
headline verbs (START WORKOUT, COMPLETE SET, START SET *n*). The label names exactly what happens:
on the last exercise, "Next exercise" becomes "Finish workout".

**Accent discipline.** `accent` is a fill and only a fill, on the four things listed in §1. Text
actions such as Done, Undo and + Create are `bodyStrong` in `textPrimary`. Selected states (chips,
segments, a list's selected row) use a border or a weight, never accent. "Today" markers use
`focus`. Search the code for `'accent'` and `c.accent` in review: every hit should be one of the
four.

**Secondary actions.** `ControlChip`s in a wrapping row above the primary action. Rarely-used or
destructive actions go in the `⋯` `ActionSheet`.

**Confirmation.** Undo, not dialogs. Only two actions are truly unrecoverable and get a dialog:
discarding a workout and deleting a session. Everything else removes immediately and offers a 5 s
`UndoStrip`.

**Modals.** Always `SystemModal`, never React Native's `Modal` (lint enforces it). Native `Alert`
dialogs are unaffected by the hidden navigation bar and stay as they are.

**Feedback.**
- Logging a set: the row flash, plus the rest panel appearing.
- Pausing: the label text and 60% digits, never colour alone.
- Navigating, scrolling and filtering: silent.

**Links that move data.** A deep link or pasted code that would send data somewhere (pairing a
PC) always lands on a confirmation screen that names the destination and says what will be sent.
Nothing is applied from the link alone.

**Background work.** Work the person didn't start by hand (sending to the PC, automatic backup)
reports through one status line where they'd look for it: under Done on the summary, and under
the feature's name in Settings. `textTertiary` when fine or pending, `negative` only for a
failure that needs them, and the text says what to check. No toasts, no modals, no badges.

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
- Progress uses `accessibilityRole="progressbar"` with a value.
- Clocks are one element each with a spoken label ("Workout time 32 minutes 10 seconds"). The live region is off, so screen readers are not interrupted every second.
- Meaning never relies on colour alone: rest state changes label text, deltas carry signs, and selected chips and segments carry a border.
- Text contrast is ≥ 4.5:1 on every surface and enforced by `tests/contrast.test.mjs` (§2.1).
- Dynamic type is honoured by default (RN `allowFontScaling`). `TabularDigits` cells scale with it. At font scale ≥ 1.5 the number wells stack vertically.

---

## 8. Adding to the system

Before merging UI work. Rules 1, 2, 3 and 5 are partly enforced: `npm run lint` rejects hex
colours, literal type styles, literal radii, `color="accent"` and raw `Modal` imports, and
`npm test` rejects contrast below the floors. The release workflow runs both.

1. Every colour comes from `c.*`, and every new token exists in both palettes. `npm test` passes,
   including the contrast suite. Add a pair to `tests/contrast.test.mjs` for any new
   foreground/background combination.
2. Every text node is `Text` with a `variant`; inputs use `useTextStyle`. There are no raw
   `fontSize`/`fontFamily`/`fontWeight` values.
3. Spacing, radii and sizes come from tokens. Dots and thin bars use `radius.pill`.
4. Touch targets are ≥ 48 dp. Icon-only controls are labelled.
5. `accent` is only on the four things in §1.
6. Anything animated checks `reducedMotion` and uses `duration.*` or `spring.*`.
7. Anything that ticks is isolated, derived from timestamps, and drawn with `TabularDigits`.
8. The change has been checked in both themes on a device. Fast Refresh has silently skipped edits
   before, so reload fully when in doubt.
9. A new reusable piece goes in `src/ui/` if it's generic, or in `src/features/<area>/` if it's
   domain-specific, and gets a row in §4 or §5 of this file.

---

## 9. Drift and debt

Where the specification and the implementation still disagree, or where something is implemented
but not yet verified. Each item is either a bug to fix or a spec line to update. Decide which, then
delete the row.

Resolved in the design-system pass and removed from this table:
- contrast, and `focus` used as text
- the type ramp, and raw text styles on inputs
- motion and reduced motion
- unused tokens (`displayXl`, `radius.chip`)
- the responsive spec, now marked future work in `DESIGN.md` §8
- the hard-coded scrim

| # | Area | Expected | Today | Next step |
|---|---|---|---|---|
| 1 | Light-mode depth | Floating surfaces read as floating over white cards | Only the `lineFloating` border (1.5:1 on white) separates them. Not yet checked on a device | If it looks flat, add one shadow token, used in light mode only, for floating surfaces |
| 2 | Large text | `DESIGN.md` §9: usable at 200% font scale | Checked on an Android 16 emulator at 200%: Today, Active Workout (wells stacked, rest timer on screen), Progress, History and the resume bar all fit without overlaps; long labels wrap. Not yet checked on a real phone | Spot-check on your phone at its largest font size |
| 3 | Narrow screens | "102.5" at full `displayL` in a 360 dp well | Checked on the emulator at 360 dp: wells, rest timer and controls all fit above the primary action. "247.5" (104 dp) relies on auto-shrink | On a real phone, watch for mis-taps between the weight well's `+` and the reps value |
| 8 | Modal workaround | Modals just work | `SystemModal` shows the nav bar before opening because a dialog over a hidden bar rendered blank (Android 16 emulator, RN 0.76, Expo Go). The root cause sits in RN or Android, not in Forte | After each Expo SDK or RN upgrade, try a raw `Modal` with the bar hidden; if it renders, the workaround can go |
| 4 | Announcements | Timer state changes announced politely | The clock's live region is off, which is correct, but pause, resume and skip aren't announced at all | Announce rest state changes only, with `AccessibilityInfo.announceForAccessibility` |
| 5 | Figures | "Numbers don't jitter" | True for clocks (`TabularDigits`). Number wells, set tables and history use Urbanist's proportional figures, by decision (§2.2) | Nothing unless a static column visibly misaligns. If one does, a tabular typeface for numerals is the real fix |
| 6 | Motion tokens | Every token has a reader | Nothing reads `duration.fast`, `base` or `slow` | Use them in the next animation, or remove them |
| 7 | Transition timing | Transitions on `duration.*` | Android's native stack ignores durations, so screen transitions stay platform-timed | Accepted |
| 9 | Glyph in text | §2.8: no Unicode glyphs as icons | `PreviousLine` joins drops with " ↘ " inside a `caption` string. It's a separator in prose, not a control, and looked right on the Android 16 emulator, but Urbanist may not carry it on every phone | If it renders as a box or emoji on a real phone, write "then drop" instead |
| 10 | Companion colours | Every colour from tokens | The companion's CSS copies the palette by hand, and the QR tile is literal black and white (deliberately, §5.1). Nothing checks the copy against `tokens.ts` | Generate the companion's CSS variables from `tokens.ts` the next time the palette changes |
