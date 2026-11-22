# Forte — AI Trainer and Profile: Implementation Plan

**Status: plan only. Nothing here is built.** No code, schema, dependency or UI has been changed.

Written against the repo at commit `470496d` (app version 1.1.0, Expo SDK 52, React Native 0.76.9).
Companion documents: [`DESIGN.md`](DESIGN.md) · [`DESIGN_SYSTEM_FORTE.md`](DESIGN_SYSTEM_FORTE.md) ·
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) · [`FUTURE_ENHANCEMENTS.md`](FUTURE_ENHANCEMENTS.md)

The principle the whole plan follows: **keep the workout traditional, make the analysis
intelligent.** Nothing in this plan adds a control, a request or a notification to the Active
Workout screen. Everything new happens after `Finish`, or on a screen you open on purpose.

---

## 0. The short version

| Question | Answer |
|---|---|
| How does Claude connect? | **Revised:** through the Claude app you already pay for. Forte builds the analysis brief and hands it to Claude with Android's share sheet (§2.6). An API key is an optional later add-on, not the default |
| Does a Claude Pro/Max subscription cover API calls? | No. The API is billed separately through the Anthropic Console, per token, and Anthropic doesn't permit using a subscription login inside another app |
| What does it cost? | Nothing beyond Claude Pro on the default route. The optional API route is estimated at $0.05 to $1.50 a month (§2.4) |
| What does the AI do? | Explains numbers the app has already calculated. It never calculates them |
| What works with AI off? | Everything, including the new summary numbers, PRs, insights and Profile. AI adds interpretation only |
| Where does it appear? | Finish Workout summary, session detail, and a new Insights view inside Progress. Never during a workout |
| Where does Profile go? | A fifth tab, appended after History so the four existing positions don't move. Settings moves into it |
| Blood reports? | In scope, as part of Forte becoming a personal health app. Stored on the device only, manual entry first |
| New native modules? | **Revised:** none on the default route, so every phase ships over the air. `expo-secure-store` and a new APK are needed only if the optional API route is built |

**Two earlier decisions are reversed, by your decision on 14 November 2026** (§0.1):

- `DESIGN.md` §1 lists "body measurements" and "AI coaching, workout recommendations" as hard
  non-goals.
- `FUTURE_ENHANCEMENTS.md` §6 lists "An AI coach or auto-programming" and "body measurements beyond
  weight" under *Deliberately not building*.

What stays: no auto-programming, no AI in the workout, no network in the logging path.

---

## 0.1 Revision 2 — 14 November 2026

Two decisions from you change the plan. Where an older section disagrees with this one, this one
wins.

### A. Forte is now a personal health app, not only a workout tracker

- D1 is decided: the two non-goals above are withdrawn.
- D12 is decided: blood reports and body data are in scope. They're still built after the training
  analysis, because that order is the cheapest to build and test, not because they're optional.
- The Active Workout screen keeps every rule it has. Becoming a health app changes what surrounds
  the workout, not the workout.
- **A new gate replaces "faster logging or clearer progression" for health features.** That gate
  still governs the workout screens. A health feature must be: stored on the device; outside the
  Active Workout screen; and clear about what is a recorded fact and what is interpretation.

### B. Wording to remove or replace

This is a Phase 0 task. Nothing below has been edited yet. Suggested replacements are drafts for
you to change.

**Positioning — says "workout tracker only"**

| File | Line | Current | Suggested |
|---|---|---|---|
| `README.md` | 3 | "A personal, offline workout tracker for Android." | "A personal, offline-first health and training app for Android." |
| `README.md` | 4 | "Plan your week → log every set → see yourself getting stronger." | Keep, as the training half. Add: "Keep your body and health records beside it." |
| `RELEASE_NOTES.md` | 3 | Same line as `README.md` 3 | Same replacement |
| `docs/DESIGN.md` | 3, 12 | "Personal Offline Workout Tracker"; "a personal training notebook upgraded with a stopwatch and progress visualization" | "Personal health and training app"; a new product statement covering training, body and health records |
| `docs/IMPLEMENTATION_PLAN.md` | 3 | "Personal Offline Workout Tracker" | Same replacement |
| `app/settings.tsx` | 150 | "Forte · personal training log" | "Forte · personal health and training" |

**Non-goals — forbids what is now being built**

| File | Line | Current | Action |
|---|---|---|---|
| `docs/DESIGN.md` | 22 | Non-goals list includes "body measurements", "AI coaching, workout recommendations" | Remove those three items. Add the new gate from A. Keep the rest (accounts, social, payments, nutrition) |
| `docs/FUTURE_ENHANCEMENTS.md` | 385, 389 | "An AI coach or auto-programming"; "Nutrition, cardio, body measurements beyond weight — A different product" | Replace the first with "Auto-programming, and AI during a workout". Narrow the second to "Nutrition, cardio" |
| `RELEASE_NOTES.md` | 168–174 | "What it deliberately does not do … No body measurements … No AI coaching … It is a training notebook with a stopwatch and a chart. That is the whole product." | This is the v1.0.0 entry, so it's history. Leave it, and state the new scope in the entry for the release that adds Profile |
| `docs/IMPLEMENTATION_PLAN.md` | 494 | Risk row: scope creep is held back by the non-goals list | Point it at the revised list |

**Privacy — must stay accurate**

| File | Line | Current | Action |
|---|---|---|---|
| `README.md` | 6 | "No accounts, no server, no network requests. Your training log is a SQLite file on your phone." | "No accounts, no server. Your data is a SQLite file on your phone, and it leaves only when you share it yourself." The "no network requests" claim is already inexact: the app checks Expo for updates since v1.1.0 |
| `app/settings.tsx` | 130 | "Everything lives on this device only. Nothing is uploaded anywhere." | "Everything lives on this device only. Nothing leaves it unless you export or share it." |
| `RELEASE_NOTES.md` | 179 | "The app makes no network requests at all." | History (v1.0.0). Leave it; the new release notes carry the current statement |

`Explanation.md` describes the app as it was at v1.0. Add one dated line at its top saying so
instead of rewriting it.

### F. Additions — 22 November 2026

Asked for after the first pass, and built:

| Item | Where |
|---|---|
| Muscle-group balance (sets per group, four weeks; uneven chest/back, no legs) | `src/features/analysis/balance.ts`, Insights, period brief, companion |
| Usual session volume on the summary | `usualVolumeLine` in `src/features/summary/SessionReview.tsx` |
| Choosing which blood markers to share (none ticked to start) | `src/features/labs/MarkerShareSheet.tsx` |
| Reading report values with an AI, no API: request → attach in the AI app → paste reply → tick each row | `src/features/analysis/lab-reply.ts`, `app/labs/read/[id].tsx` |
| Automatic backup to a chosen folder after every workout, newest 12 kept | `src/lib/auto-backup.ts`, Settings, summary |
| Next-set targets (double progression) on Today, beside "Last time" in the workout, and on the summary; never a pre-fill | `src/features/analysis/targets.ts` |
| "Claude" → "AI" in the app's labels; the share menu takes any AI app | app-wide |
| Companion: sidebar layout in Forte's dark theme; pick Claude, ChatGPT (Codex CLI), Gemini (CLI) or offline (Ollama); a real conversation | `companion/` |

Declined by you: the paid API route (Phases 9–10) and the three security changes from §6
(app lock, Auto Backup exclusion, encrypted backup file).

Verified on this PC: Claude and offline qwen2.5:7b through the companion. Not verified: ChatGPT (Codex
CLI not installed), Gemini (Google refused the personal login on this PC; a free API key should
work), the folder picker for automatic backup on a real phone, and whether Android's picker offers
Google Drive itself (usually it doesn't, hence the sync-app step).

### E. Implementation status — 18 November 2026

Built on the default route, in one pass, uncommitted. Recommended defaults were taken for every open
decision that wasn't already decided: D5 (one session rating), D6 (five steps), D7 (fifth tab,
appended), D8 (Insights inside Progress), D10 (tests load the TypeScript directly), D13 (notes on,
body off, blood results never automatic), D15 (lengths follow the weight unit), D17 (paste-back),
D19 (companion moved into the repo, sharing the engine).

| Phase | State | Where |
|---|---|---|
| 0 Groundwork | Done: skipped sets restore correctly; backup format 2; wording changes from §0.1 B | `src/lib/export.ts`, README, docs, Settings copy |
| 1 Metrics and summary | Done: effort rating, records, fuller comparison; also on session detail | `src/features/analysis/`, `src/features/summary/`, `app/workout/summary.tsx`, `app/session/[id].tsx` |
| 2 Insights | Done | `src/features/insights/InsightsView.tsx`, `app/(tabs)/progress.tsx` |
| 3 Profile and body | Done: fifth tab, weight, height, body fat, nine tape sites, about you, delete all health data | `app/(tabs)/profile.tsx`, `app/body/`, `src/db/queries/profile.ts` |
| 4 Ask Claude | Done: share sheet, consent once, *Show what's shared*, paste-back, settings | `src/features/claude/share.ts`, `app/claude/brief.tsx`, `src/db/queries/ai.ts` |
| 4 Companion v1 | Done: in `companion/`, uses the app's engine, respects the phone's sharing settings, reviews sessions, 8 weeks and blood results | `companion/` |
| 5 Weekly and body context | Done through Ask Claude and the companion | `src/features/analysis/brief.ts` |
| 6 Blood reports, manual | Done | `app/labs/`, `src/features/labs/`, `src/db/queries/labs.ts` |
| 7 Health review via Ask Claude | Done, with one change: it shares every marker that has a result, after a confirmation, rather than a ticked selection | `app/labs/index.tsx` |
| 9–10 API route | Not built (optional) | — |

Migrations v3, v4 and v5 are in `src/db/migrations.ts`. No new native module was added, so all of
this can ship over the air.

**Added while testing on the emulator**

- Body readings outside generous bounds (for example 7,840 kg from a missed decimal point) are
  refused with a message instead of saved.
- Rests over 20 minutes are left out of averages and described as a break in briefs. A workout left
  open overnight had produced a 511-hour "rest".
- `SystemModal` no longer waits forever for the navigation-bar call. Once on the emulator every
  modal stopped opening after a trip to the Android share sheet; it didn't happen again and the
  cause isn't proven, so this is a safeguard: a modal now opens after at most 400 ms.

**Not done**

- D11 (b): excluding `reports/` from Android Auto Backup needs a config plugin and a new APK.
- Muscle-group balance from §5.4 and the session baseline on the summary screen (it is in the brief).
- Reading values out of a report file with Claude. For now: share the PDF to Claude yourself and
  type the values in.
- Not tested: a real backup from the phone through Google Drive for desktop; Claude's reply to a
  brief on the phone (the Claude app isn't on the emulator); 360 dp and 200% text on the new screens;
  light theme on the new screens.

### D. Revision 3 — 18 November 2026: Forte Companion on the PC is the default AI route

Supersedes C below as the default. C (Ask Claude through the share sheet) stays as the fallback for
when you're away from the PC.

**How it works**

1. On the phone: Forte → Settings → **Export backup (JSON)** → share to **Drive** → folder `Forte`.
   This button exists today, so this step needs no new code.
2. Google Drive for desktop copies the file to the PC (for example `G:\My Drive\Forte`).
3. **Forte Companion**, a separate local page on the PC, reads the newest
   `forte-backup*.json` in that folder, calculates the numbers, and shows them.
4. *Review my last session* or *Review the last 8 weeks* runs `claude -p` once, under the Claude
   Code login you already have. No API key and no separate bill; each request counts against your
   Claude plan.

**Status: a working test version exists** in `companion/`, with an invented
sample backup. Verified on 18 November 2026: it reads the newest file, finds the plateaus and rest
drift built into the sample, and `claude -p` returned a specific, number-cited review in 15 seconds.
Not yet tested with a real export from the phone or through Google Drive for desktop, which isn't
installed on this PC.

**What it means for the phases**

| Phase | Change |
|---|---|
| 1–3 (metrics, Insights, Profile) | Unchanged. The app's own numbers are still worth having on the phone |
| 4 | Becomes **Companion v1**: harden the test version, add body and blood data once they're exported, and an *Export for analysis* button on the workout summary so the export is one tap after Finish |
| Ask Claude (share sheet) | Kept as the phone-only fallback, built after the companion |
| 9–10 (API) | Unchanged, optional |

**Decisions this adds**

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D19 | Where the companion's code lives | (a) Its own folder or repo, as now. (b) A `companion/` folder in the Forte repo | **(b) once Phase 1 exists**, so the companion can import the same calculation code as the app instead of a second copy. (a) is fine until then |
| D20 | How the backup reaches the PC | Google Drive for desktop · Syncthing · USB | **Google Drive**, as you chose. Note it means Google stores the file, including blood results once they're exported |

**Limits to know**

- PC only. On the phone, use the share-sheet fallback.
- `claude -p` is Claude Code, which Anthropic allows on a subscription login. Some 2026 reporting
  says headless use may draw on a separate monthly allowance; that's unconfirmed. Check your usage
  page after a few runs.
- The prompt goes to Claude under your Claude privacy settings (§2.6).

### C. No paid API: Claude through your Pro subscription

- The default AI route becomes **Ask Claude** (§2.6, §3.7): Forte prepares the brief, you send it
  to the Claude app with the share sheet, Claude answers there.
- The API-key route (old Phases 4 and 5) moves to the end as optional Phases 9 and 10.
- D2, D4 and D9 are updated in Part 8.
- The published mock still shows the API-key route on the summary and AI settings screens. Those
  two screens need redrawing for Ask Claude.

---

## Part 1 — Existing application analysis

Everything in this part was read from the source, not from the README.

### 1.1 What exists today

| Area | How it works now | Files |
|---|---|---|
| Navigation | Four tabs (Today, Week, Progress, History) in a floating pill. Active Workout and Summary are full-screen stack routes above the tabs. Settings is a stack route opened from a gear icon on Today | `app/(tabs)/_layout.tsx`, `src/ui/PillNav.tsx`, `app/_layout.tsx` |
| Data model | Seven tables: `exercises`, `routine_days`, `routine_exercises`, `sessions`, `session_exercises`, `sets`, `settings`. Weight is always kg. Timestamps are epoch ms | `src/db/schema.ts` |
| Migrations | Hand-written DDL ladder keyed on `PRAGMA user_version`, currently at v2. Forward-only. `PRAGMA foreign_keys = ON`, so `ON DELETE CASCADE` works | `src/db/migrations.ts`, `src/db/client.ts` |
| Logging | `logSet` writes the set and starts the rest stopwatch in one transaction. Sets can be edited or deleted only during the active workout. A completed session can only be deleted whole | `src/db/queries/session.ts`, `app/workout/active.tsx` |
| Rest timer | Elapsed rest is derived from `sessions.rest_started_at / rest_paused_at / rest_accumulated_s`. When the next set starts, the measured value is stored on that set as `sets.rest_before_s` | `src/features/workout/rest-timer.ts` |
| Finish Workout | `completeSession` sets `status = 'completed'` and `ended_at`, then routes to `/workout/summary?id=…`. The summary shows duration, exercises, sets, volume, and a top-weight comparison against the previous session of the same name | `app/workout/summary.tsx`, `src/db/queries/history.ts` |
| Progress | Per exercise: top weight, reps at top weight, volume, average rest, per session. A chart appears from three sessions (`MIN_POINTS_FOR_TREND`) | `app/(tabs)/progress.tsx`, `src/db/queries/progress.ts` |
| History | Sessions grouped by month, filter by workout name, session detail with rest shown between sets | `app/(tabs)/history.tsx`, `app/session/[id].tsx` |
| Settings | Key/value `settings` table read into a Zustand store with typed keys | `src/store/settings.ts`, `app/settings.tsx` |
| Reactivity | Every write calls `bumpRevision()`. Screens re-run synchronous SQLite reads through `useQuery` | `src/lib/db-hooks.ts` |
| Export | JSON bundle of every table (including all `settings` rows), CSV of sets, JSON import that replaces everything | `src/lib/export.ts` |
| Tests | `node --test` on plain `.mjs` files. Pure logic is mirrored by hand from TypeScript into `.mjs` (`tests/rest-timer.mjs`, `tests/prefill.mjs`). No test framework, no TypeScript in tests | `tests/` |
| Network | `expo-updates` checks Expo's update server on start and on return after 30 minutes. No user data is sent anywhere | `src/features/updates/UpdateBar.tsx` |

### 1.2 What the AI features can reuse without change

- **Rest duration is already recorded per set** (`sets.rest_before_s`). No new rest table is needed.
- **Workout duration** is `ended_at − started_at`. Per-exercise time is available from
  `sets.completed_at`.
- **Session comparison by workout name** exists (`getPreviousSessionSummary`,
  `getPreviousPerformance`).
- **Muscle group per exercise** exists (`exercises.muscle_group`: chest, back, legs, shoulders,
  arms, core, full), so weekly volume per muscle group needs no new data.
- **A free-text session note** exists (`sessions.note`, placeholder "How did it feel?").
- **`LineChart`, `StatGrid`, `Card`, `Segmented`, `SectionLabel`, `Chip`, `SystemModal`** cover
  almost every new screen.

### 1.3 What does not exist and must be introduced

| Missing | Needed for |
|---|---|
| Any measure of effort or intensity (no RPE, RIR or session rating) | "Was this session unusually demanding?" |
| PR detection, estimated 1RM, plateau detection, weekly aggregates, baselines | Summary and insights |
| Any table for body data, reports or AI output | Profile, AI |
| Secure storage. The only store is the `settings` table, which is plain text and is copied into every JSON export | The API key |
| An HTTP client for user data, and any consent flow | AI |
| A fifth tab. `PillNav` and `DESIGN.md` §4 both state the set is fixed at four | Profile |

### 1.4 Problems found while reading

These exist today and affect this work.

| # | Finding | Consequence |
|---|---|---|
| F1 | `importJson` doesn't restore `sets.skipped`. The `INSERT` omits the column, so a skipped set comes back as a performed set of 0 kg × 0 reps | Wrong set counts and averages after a restore. Fix when the export format is bumped (Phase 0) |
| F2 | The app's own copy says no data leaves the device: Settings → Your data ("Nothing is uploaded anywhere"), `README.md` ("no network requests"), `RELEASE_NOTES.md` v1.0.0 | All three become false the moment AI is switched on. They must be reworded in the same release |
| F3 | `android.allowBackup` is not set, so Expo's default (`true`) applies. Android Auto Backup may already be copying `forte.db` to Google Drive. `FUTURE_ENHANCEMENTS.md` §1.1 flags this as untested | Acceptable for a training log. Not acceptable by accident for blood reports (D11) |
| F4 | The mirrored-`.mjs` test convention doesn't scale to a metrics engine of several hundred lines. Two copies will drift | Decide the test approach before Phase 1 (D10) |
| F5 | Forte is on Expo SDK 52. `FUTURE_ENHANCEMENTS.md` §9 notes SDK 57 as current in September 2026 | Don't combine this work with an SDK upgrade. Pin new packages to their SDK 52 versions |

---

## Part 2 — AI integration alternatives

### 2.1 Subscription versus API

A Claude Pro or Max subscription is for the Claude apps. It doesn't include an API key. Anthropic's
help centre says a paid plan "doesn't include access to the Claude API or Console"; API use is set
up in the Console and billed separately, per token
([source](https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-do-i-have-to-pay-separately-to-use-the-claude-api-and-console)).
One help page mentions monthly API credits on some Max and Team plans; check your own Console
before buying credits.

So "use my Claude subscription inside Forte" isn't available. The only way a subscription helps is
option F below, where you paste data into the Claude app by hand.

### 2.2 Options compared

| | A. Direct API, your key (BYOK) | B. Personal proxy | D. On-device model | F. Share to the Claude app |
|---|---|---|---|---|
| How it works | App stores your key in the Android Keystore and calls `api.anthropic.com` over HTTPS | App calls a small server you run (for example a Cloudflare Worker), which holds the key and forwards the request | A 1–3 GB model file runs on the phone through `llama.rn` or `react-native-executorch` | App builds the analysis brief as text and opens the share sheet; you paste it into Claude |
| Internet | Yes, for analysis only | Yes | No | Yes |
| Credentials | API key in `expo-secure-store` | Proxy token in `expo-secure-store`; real key on the server | None | None |
| You set up | Console account, a key, at least $5 of credit | All of A, plus deploying and maintaining the proxy | A model download; a phone with 6–8 GB RAM | Nothing |
| You pay | Per token (§2.4) | Per token, plus the host (often free tier) | Nothing; battery and storage | Your subscription |
| Privacy | Workout data goes to Anthropic under its API terms | Same, plus it passes through your server | Nothing leaves the phone | Same as using the Claude app |
| Works automatically after a workout | Yes | Yes | Yes | No, manual every time |
| Analysis quality | High | High | Noticeably weaker at numeric reasoning over tables | High |
| Build cost | Low. One native module | Medium. A second codebase and a deployment | High. Native inference module, model management, larger APK, slow first load | Very low |
| Conflict with offline-first | None for logging. Analysis waits for a connection | Same | None | None |

**C. Multiple providers** isn't a separate option. It's how A is built: behind a provider
interface, so a second provider is one new file (§5.3).

Sources for the on-device row:
[react-native-executorch](https://www.npmjs.com/package/react-native-executorch),
[llama.rn guide](https://medium.com/godel-technologies/guide-to-running-ai-models-locally-on-mobile-devices-using-react-native-and-llama-rn-fcd41adbc597),
[Gemma on Android](https://www.infoq.com/news/2026/04/gemma-4-android-ai-inference). The RAM figures in
those sources disagree (6 GB versus 8 GB), so treat them as a range.

### 2.3 Recommendation if you were willing to pay per token: A, direct BYOK

**Superseded as the default by §2.6.** Kept because it describes the optional API route.

- **A proxy solves a problem Forte doesn't have.** A proxy exists to keep a key out of an app
  binary that many people download. Here the key is yours, typed into your own phone, and never in
  the APK. A proxy would add a server to keep alive for no gain.
- **On-device isn't worth it yet.** It costs the most to build, makes the APK and the first load
  heavier, and gives weaker analysis. The provider interface leaves the door open.
- **F is worth adding as a fallback** because it's nearly free once the context builder exists:
  a "Copy analysis brief" action for anyone without a key (Phase 5, optional).
- **A second provider type later:** "OpenAI-compatible endpoint" (base URL + key). That one
  adapter covers OpenAI, OpenRouter, a personal proxy, and Ollama or LM Studio on your home
  network. Not in the first release.

**How A works from your side.** Settings → AI → paste key → Test connection → choose what the AI
may see → done. After that, finishing a workout shows the usual summary immediately, and an
"Analysis" block fills in a few seconds later when you're online.

**How A works inside Forte.**

- Client: the official TypeScript SDK, `@anthropic-ai/sdk`. It's pure JavaScript, so it doesn't
  need a new APK by itself.
- **Risk:** Anthropic doesn't document React Native support, and React Native's built-in `fetch`
  doesn't stream. Forte's requests are short and don't need streaming, which avoids the known
  problem. Phase 0 includes a throwaway spike that makes one request under Hermes on the phone.
  If it fails, the first fallback is passing `fetch` from `expo/fetch` (available from SDK 52) to
  the client, and the second is a 60-line direct call to `POST /v1/messages` (D3).
- Output: structured output (`output_config.format` with a JSON schema), so the reply is always
  parseable and the app never scrapes prose.
- Connection test: `GET /v1/models`. It's free, proves the key works, and fills the model picker.

### 2.4 Model and cost

Prices are Anthropic's list prices per million tokens as cached on 2026-11-03. Check the Console
for current figures.

| Model | Input / output | Est. per session | Est. per month |
|---|---|---|---|
| Claude Opus 5.5 (`claude-opus-5-5`) — default | $4 / $20 | ~$0.06 | ~$1.50 |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | ~$0.03 | ~$0.80 |
| Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10 / $0.50 | ~$0.002 | ~$0.05 |

These are estimates, not measurements. They assume about 5,000 input tokens and 2,000 output
tokens per analysis (reasoning tokens bill as output), 20 sessions and 4 weekly reviews a month.
Phase 5 records real token counts per analysis, so the app can show actual spend.

The default is Opus 5.5 because quality matters more than a dollar a month here; the picker lets
you change it (D4). Effort is set explicitly to `medium`.

### 2.5 What Anthropic does with the data

- Under Anthropic's Commercial Terms, API customer content isn't used to train models.
- Retention is described inconsistently across Anthropic's own pages: one says inputs and outputs
  are deleted within 30 days, another says content isn't retained by default except on certain
  models. Read the current
  [API and data retention page](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
  before enabling. Zero data retention exists but is arranged per organisation with Anthropic.
- The consent screen links to that page instead of paraphrasing it, so it can't go stale.

### 2.6 Routes that cost nothing extra (Revision 2)

**Can Claude Pro pay for API calls from Forte? No.** Two separate reasons:

- Pro has no API key. The API is a different product with its own billing.
- Anthropic's documentation, updated in February 2026, says subscription logins are for Claude's
  own apps and Claude Code, and may not be used in other products
  ([The Register](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access),
  [WinBuzzer](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/)).
  Building that into Forte would break the terms and could get the account restricted. Later
  reporting says some of this was relaxed in May 2026 with a separate credit pool; I couldn't
  confirm that on Anthropic's own pages, so the plan doesn't rely on it.

| Route | How it works | Extra cost | Automatic after a workout | Privacy | Build |
|---|---|---|---|---|---|
| **1. Ask Claude (share sheet)** | Forte builds the brief (instructions plus the calculated findings) and opens Android's share sheet. You pick Claude. The answer appears in the Claude app | None. Uses Pro | No. One tap, then pick Claude | Same as using the Claude app. Forte itself sends nothing | Very low. React Native's built-in `Share`. No new module, no APK |
| **2. Claude Code on your PC** | Export Forte's JSON, and run a saved prompt over it with Claude Code, which Pro covers | None | No. Needs the PC | Same as using Claude Code | None in the app. A prompt file in the repo |
| **3. Free tier of another provider's API** | Same as the API route, with a free key (for example Google's Gemini API) | None | Yes | Poor. Google's terms let it use free-tier content to improve its products, with human review, and advise against sending personal data ([terms](https://ai.google.dev/gemini-api/terms)) | Same as the API route, plus a second provider |
| **4. A model on your own PC** | Ollama or LM Studio at home; Forte calls it over Wi-Fi | None | Only at home, with the PC on | Best. Nothing leaves your network | Same as the API route. Weaker analysis |
| **5. A model on the phone** | See option D in §2.2 | None | Yes | Best | High. Weaker analysis. Needs 6–8 GB RAM |
| **6. No AI** | The app's own records, comparisons and insight cards (Phases 1–2) | None | Yes | Best | Already in the plan |

**Recommendation: route 1 as the default, on top of route 6.**

- It's the only free route that gives Claude-quality analysis.
- Forte never touches a key, a login or the network, so the default build needs no native module
  and no new APK.
- The cost is one deliberate tap. That fits the product: analysis is something you ask for, not
  something that arrives.
- Route 3 is ruled out for health data on its privacy terms. Routes 4 and 5 stay possible later
  through the provider interface.
- The API route stays in the plan as optional. For scale: Anthropic's minimum credit purchase is
  about $5, and at the Haiku 5.5 estimate (~$0.05 a month) that isn't monthly spending. It's
  listed so the choice is informed, not to reopen it.

**Trade-offs of route 1, stated plainly.**

- The analysis isn't automatic and isn't stored in Forte, unless you paste it back (§3.7).
- The reply is free text. The app can't check each sentence against a calculated finding, as the
  API route does. The brief compensates by carrying the findings and the rules, and by telling
  Claude to cite the numbers it was given.
- Your Claude privacy setting applies. Since Anthropic's 2025 consumer-terms change, chats on
  Free, Pro and Max can be used for model training unless you turn that off in Claude's privacy
  settings; with it on, retention is reported as five years, with it off, 30 days
  ([Anthropic](https://www.anthropic.com/news/updates-to-our-consumer-terms)). Check that setting
  before sharing health data. API traffic falls under different terms.
- Pro's usage limits apply, though one brief is a small message.

---

## Part 3 — Proposed user experience

A static mock of five of these screens accompanies this plan:
<https://claude.ai/artifact/UNe5i8uELMuFgTmAVeRJif> (private to the repo owner's Claude account).
The numbers in it are invented sample data.

### 3.1 Where each feature lives

```
Tabs:   Today · Week · Progress · History · Profile        (Profile is new, appended last)

Progress ─┬─ Lifts      (the current screen, unchanged)
          └─ Insights   (new)

Profile ──┬─ Body        latest weight, target, measurements → history + chart per measurement
          ├─ Health      blood reports → report detail → marker trend
          └─ Settings    the current Settings screen, plus "AI trainer"

Finish Workout summary   + effort rating, + PRs, + Analysis block
Session detail (History) + the same Analysis block, read-only
Active Workout           no change at all
```

### 3.2 AI configuration (Profile → Settings → AI trainer)

1. **Off state.** One paragraph on what it does, what it costs, and that data leaves the phone
   only when it's on. One button: *Set up*.
2. **Consent.** Shown once, before the key field. Lists exactly what is sent, to whom, and what
   isn't sent. Links to Anthropic's retention page. *I understand* stores a timestamp and a consent
   version; a later change to what's sent asks again.
3. **Connect.** Provider (Anthropic only at first), API key field (masked, paste-friendly),
   *Test connection*. Result is one line: "Connected · 14 models available" or the plain error
   ("Key rejected", "No connection", "No credit on this account").
4. **Model.** Picker filled from the connection test, with the estimated cost per session beside
   each.
5. **What the AI may see.** Four switches:

   | Category | Default | Contains |
   |---|---|---|
   | Training log | On, required | Exercise names, sets, weights, reps, rest, durations, effort rating |
   | Session notes | On | The text you type under "How did it feel?" |
   | Body | Off | Age, height, bodyweight trend, target weight |
   | Blood results | Off | Only in a review you start yourself (§3.6). Never sent automatically |

6. **Behaviour.** *Analyse after each workout* (on by default). *Weekly review* (on by default).
7. **Transparency.** *Show what's sent* opens the exact JSON for your latest session. *Usage* shows
   analyses run and tokens used this month.
8. **Disconnect.** Deletes the key from the Keystore at once. Asks whether to also delete saved
   analyses.

With AI off, disconnected or failing, no screen changes shape. The Analysis block simply isn't
there.

### 3.3 Finishing a workout

The summary appears instantly, as now, with three additions. All three work with AI off.

- **Effort.** One row under the stat grid: "How hard was it?" with five options (Easy, Moderate,
  Hard, Very hard, Maximal). Optional, one tap, changeable later.
- **Records.** A short list when there are any: "Bench Press · 62.5 kg × 8 · best reps at this
  weight". No animation, no badge.
- **A fuller comparison.** Today's rows compare top weight only. The new rows also show reps at
  that weight, volume and average rest, against the previous session of the same workout.

Below that, when AI is on:

```
ANALYSIS                                              Claude Opus 5.5

Volume is 6% above your four-session average; bench press accounts
for most of it.

· Bench Press: 62.5 kg for 8, 8, 7. Two more reps in total than on
  4 Nov at the same weight.
· Rest before your last two sets averaged 3:10, against a usual 2:20.
· Tricep Pushdown: 25 kg × 12 for the fourth session running.

NEXT SESSION
· Bench Press: 8, 8, 8 at 62.5 kg would clear your usual threshold
  for adding weight.

Based on your last 4 Chest + Triceps sessions (14 Oct – 4 Nov).
```

- While waiting: one line, "Analysing…". **Done is never blocked.** Leave and the request finishes
  in the background of the app; the result appears in session detail.
- Offline: "Will analyse when you're back online." It retries when the app next comes to the
  foreground.
- Each bullet is tied to a calculated finding. A bullet that cites nothing the app calculated is
  dropped before display (§5.5).
- Thin data is said plainly: "Second time logging this workout. Not enough history for trends."
- No notification is sent when an analysis arrives.

### 3.4 Insights (Progress → Insights)

A short list, not a dashboard. Five cards at most, ordered by how much they matter.

```
PLATEAU                                               4 sessions
Tricep Pushdown
25 kg × 12 on each of the last four sessions (14 Oct – 4 Nov).
Volume and rest are also unchanged.

VOLUME UP, WEIGHT FLAT                                4 sessions
Bench Press
Volume +11% since 14 Oct at an unchanged 62.5 kg. The gain is all reps.

REST DRIFT                                            3 weeks
Barbell Row
Average rest 2:05 → 2:50. Weight and reps unchanged.
```

- **These cards are generated by the app with no AI.** Each is a detector over your history with a
  fixed sentence template. Tapping a card opens that exercise in Lifts.
- **With AI on**, a *Weekly review* sits above the cards: one paragraph and up to three points
  that connect the cards ("the rest drift on rows and the plateau on pushdowns both began the week
  volume rose 18%"). It shows its date and a *Refresh* button.
- Refresh cadence: at most once a week automatically, when a session completes and the last review
  is seven or more days old. Never on a timer, never in the background.
- An insight disappears when its condition stops being true. Nothing accumulates.
- Under three sessions for an exercise, it produces no trend cards, matching the chart rule.

### 3.5 Profile

```
Profile                                                          ⚙

BODY
Weight            78.4 kg     ↓ 0.6 in 4 weeks        Log
Target            75.0 kg     3.4 to go
Height            178 cm
Body fat          —                                    Add
Measurements      Waist, chest, arm…                   ›

HEALTH
Blood reports     3 reports · latest 12 Sep            ›

ABOUT YOU
Born 1998 · 28                                         Edit
```

- **Logging a weight** opens the existing numeric keypad. Two taps.
- **Every measurement is a new dated row.** Nothing is overwritten. Tapping any row opens its
  history: a `LineChart` and a table, with delete per entry.
- **Fields:** date of birth, sex (optional; used only for blood reference context), height, weight,
  target weight, body-fat percentage, and a fixed list of tape measurements (neck, shoulders,
  chest, waist, hips, upper arm, forearm, thigh, calf).
- **Settings** opens from the gear in the Profile header. The gear on Today is removed.

### 3.6 Blood reports (Profile → Health)

1. **Add report.** Pick a PDF or image with the system file picker. Enter the sample date, the lab
   (optional) and a category (Full blood count, Lipids, Liver, Kidney, Thyroid, Vitamins, Hormones,
   Metabolic, Other). The file is copied into Forte's private storage.
2. **Report detail.** The file opens in your phone's viewer. Below it, the values you've recorded
   from it: marker, value, unit, the lab's reference range. Out-of-range values are marked from the
   report's own range, by arithmetic.
3. **Add values.** Type them: pick a marker from a built-in list (or add your own), enter value and
   range. This is the default and needs no network.
4. **Marker trend.** Tapping a marker shows it across all reports with the reference band drawn
   behind the line. Each point links back to its report.
5. **Optional, later: read values from the file with AI.** Per report, with its own consent
   ("This sends the whole file, including your name and any ID printed on it, to Anthropic").
   The result is a draft table. Nothing is saved until you check and confirm each row.
6. **Optional, later: health context review.** A button on the Health screen, never automatic.
   Sends the markers you select plus your training summary. The result is labelled *AI observation
   — not medical advice* and is visually separate from recorded values.

### 3.7 Ask Claude — the default AI flow (Revision 2)

§3.2 and the Analysis block in §3.3 describe the optional API route. On the default route:

1. **One-time setup (Profile → Settings → Ask Claude).** The same consent screen and the same
   "what may be shared" switches as §3.2, items 2 and 5. No key, no provider, no model picker.
   *Show the brief* displays exactly what will be shared.
2. **After a workout.** The summary shows the local numbers, records and comparison as in §3.3.
   Below them, one secondary button: **Ask Claude about this session**. It opens Android's share
   sheet with the brief as text. Pick Claude; the brief lands in a new chat and Claude answers.
3. **The brief** is plain text: a short instruction block (the tone and evidence rules from §5.5),
   then the calculated findings and a compact table of the sets. It's built by the same
   `context.ts` as the API route, so both routes share the data rules in §5.7.
4. **Keeping the answer (optional).** Session detail has *Paste Claude's reply*. The pasted text
   is saved with the session and shown under the label *From Claude, pasted by you*.
5. **Weekly review** works the same way from Insights: **Ask Claude about this week**.
6. **Health review** works the same way from the Health screen, with the markers you tick. For
   reading values out of a report file, share the PDF to Claude yourself and type the values into
   Forte. Forte doesn't send files on this route.
7. **Follow-up questions** happen in the Claude app, which is a better place for a conversation
   than a workout tracker.

Tip, outside the app: a Claude Project named "Forte" with your goals in its instructions gives
every shared brief the same background.

---

## Part 4 — Database and data-model changes

All changes are additive. Each block is one appended entry in `MIGRATIONS`, mirrored in
`schema.ts`. Take a JSON export before installing any build that migrates.

### 4.1 Migration v3 — effort, profile, measurements (Phases 1 and 3)

```sql
ALTER TABLE sessions ADD COLUMN effort INTEGER;          -- 1–5, NULL = not rated

CREATE TABLE profile (                                   -- exactly one row
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  date_of_birth    TEXT,                                 -- 'YYYY-MM-DD'; age is derived
  sex              TEXT,                                 -- 'male' | 'female' | NULL
  target_weight_kg REAL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE body_measurements (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,       -- 'weight' | 'height' | 'body_fat' | 'waist' | 'chest' | …
  value       REAL NOT NULL,       -- kg, cm or percent; always metric, like weight_kg
  measured_at INTEGER NOT NULL,
  note        TEXT
);
CREATE INDEX idx_bm_kind ON body_measurements(kind, measured_at);
```

- Height is a measurement, not a profile column, so it follows the same never-overwrite rule.
- "Current weight" is the latest `weight` row. It isn't stored separately.
- This generalises the `bodyweight` table sketched in `FUTURE_ENHANCEMENTS.md` §4.5.

### 4.2 Migration v4 — AI analyses (Phase 5)

```sql
CREATE TABLE ai_analyses (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,        -- 'session' | 'weekly' | 'health'
  session_id     TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  period_start   INTEGER,              -- comparison window the analysis used
  period_end     INTEGER,
  status         TEXT NOT NULL,        -- 'pending' | 'ok' | 'failed' | 'refused'
  provider       TEXT,
  model          TEXT,
  prompt_version INTEGER NOT NULL,
  input_hash     TEXT,                 -- hash of the payload, to detect a stale analysis
  categories     TEXT,                 -- which data categories were sent, e.g. 'training,notes'
  content        TEXT,                 -- the model's structured reply, as JSON
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  error_code     TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_ai_session ON ai_analyses(session_id) WHERE kind = 'session';
CREATE INDEX idx_ai_kind ON ai_analyses(kind, created_at);
```

- One row per session. Regenerating replaces it.
- Deleting a session deletes its analysis through the cascade.
- The row doubles as the retry queue (`status = 'pending'`), so there's no separate queue table.
- **On the Ask Claude route** the same table holds pasted replies: `status = 'ok'`,
  `provider = 'pasted'`, `content` as plain text, token and model columns null. If you never paste
  a reply, the table stays empty and this migration can wait.

### 4.3 Migration v5 — blood reports (Phase 7)

```sql
CREATE TABLE lab_markers (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,          -- 'Haemoglobin'
  category     TEXT NOT NULL,
  default_unit TEXT,
  is_custom    INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_lab_markers_name ON lab_markers(name COLLATE NOCASE);

CREATE TABLE lab_reports (
  id         TEXT PRIMARY KEY,
  taken_at   INTEGER NOT NULL,         -- sample date
  lab_name   TEXT,
  category   TEXT NOT NULL,
  file_name  TEXT,                     -- original name, for display
  file_path  TEXT,                     -- relative to documentDirectory/reports/
  mime_type  TEXT,
  note       TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_lab_reports_taken ON lab_reports(taken_at DESC);

CREATE TABLE lab_results (
  id         TEXT PRIMARY KEY,
  report_id  TEXT NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  marker_id  TEXT NOT NULL REFERENCES lab_markers(id),
  value      REAL,
  value_text TEXT,                     -- for non-numeric results such as 'Negative'
  unit       TEXT,
  ref_low    REAL,
  ref_high   REAL,
  source     TEXT NOT NULL DEFAULT 'manual'   -- 'manual' | 'ai_confirmed'
);
CREATE INDEX idx_lab_results_marker ON lab_results(marker_id, report_id);
```

- Every result points at its report, and the report at its file. That's the link from an extracted
  value back to the original.
- Reference ranges are stored per result because labs differ.
- The marker list is seeded like the exercise library (about 60 common markers, in `src/data/`).
- Unconfirmed AI drafts are never written to `lab_results`. They live in screen state until
  confirmed.

### 4.4 AI configuration

| Item | Where | Why |
|---|---|---|
| API key | `expo-secure-store` only | `settings` is plain text and is dumped into every JSON export |
| `aiEnabled`, `aiProvider`, `aiModel`, `aiAutoAnalyse`, `aiWeeklyReview` | `settings` table via the existing store | Same pattern as every other preference |
| `aiShareNotes`, `aiShareBody`, `aiShareLabs` | `settings` | Same |
| `aiConsentVersion`, `aiConsentAt` | `settings` | Proves consent was given for this version of the data list |

"Connected" means *enabled and a key is present*. A backup restored on a new phone therefore comes
back enabled but not connected, and asks for the key again.

### 4.5 What is deliberately not stored

| Not stored | Because |
|---|---|
| Volume, estimated 1RM, PRs, baselines, plateau flags, insight cards | All derivable from `sets`. The repo's rule is "computed, never stored" (`IMPLEMENTATION_PLAN.md` §4, `FUTURE_ENHANCEMENTS.md` §4.6). A stored aggregate goes wrong the moment a session is deleted |
| Rest durations in a new table | Already in `sets.rest_before_s` |
| A copy of the payload sent to the AI | It's reproducible from the data. Only its hash is kept |
| Per-set RPE or RIR | Not in this plan (D5) |

### 4.6 Export format v2

`SCHEMA_VERSION` goes from 1 to 2. The bundle gains `profile`, `bodyMeasurements`, `labMarkers`
(custom ones), `labReports` (metadata only), `labResults`, `aiAnalyses`, plus `sessions.effort` and
the missing `sets.skipped` (F1). Import keeps accepting v1 files.

Report files are binary and don't fit in a JSON bundle. They're exported one at a time through the
share sheet. The app says so on the export screen.

---

## Part 5 — Technical architecture

### 5.1 Modules

```
src/features/analysis/         pure TypeScript, no React Native imports, tested in Node
  metrics.ts                   per-session and per-exercise numbers from plain rows
  baseline.ts                  rolling baselines and noise thresholds
  findings.ts                  detectors → typed Finding objects
  phrasing.ts                  fixed sentence templates for findings (the AI-off wording)
src/db/queries/analysis.ts     the SQL that loads history windows for the above
src/db/queries/profile.ts      profile and body measurements
src/db/queries/labs.ts         reports, results, markers
src/db/queries/ai.ts           ai_analyses rows

src/features/ai/
  provider.ts                  AiProvider interface
  anthropic.ts                 the Anthropic implementation (official SDK)
  credentials.ts               the only file that touches expo-secure-store
  context.ts                   builds the smallest payload for one analysis kind
  prompts.ts                   system prompts, output schemas, PROMPT_VERSION
  analyse.ts                   run, persist, retry, staleness

src/features/profile/          measurement rows, history screen pieces
src/features/labs/             report list, result editor, marker trend

app/(tabs)/profile.tsx         new tab
app/profile/[kind].tsx         one measurement's history
app/labs/index.tsx, app/labs/[id].tsx, app/labs/marker/[id].tsx
app/settings/ai.tsx            AI trainer settings
```

### 5.2 Local versus AI

| Done by the app, always, offline | Done by the AI, only when enabled |
|---|---|
| Volume, sets, reps, duration, density (volume per minute) | Deciding which three findings matter most today |
| Top set, reps at top weight, estimated 1RM (Epley, for comparison only) | Connecting findings ("rest rose in the same sessions volume rose") |
| Records: heaviest weight, most reps at a weight, best estimated 1RM, best session volume | Wording a next-session focus from the findings |
| Change against the previous same-name session and against a rolling baseline | Reading your session note alongside the numbers |
| Whether a change is larger than normal variation | Saying what a number might mean, with stated uncertainty |
| Plateau, regression, rest drift, weekly volume spike, muscle-group balance | — |
| Out-of-range flags on blood values, from the report's own range | Health context review, on request only |

The AI is never asked to add, average or compare raw sets. It gets the findings, already
calculated, plus a compact table of the sets as evidence.

### 5.3 Provider interface

```ts
type AiProvider = {
  id: 'anthropic';                                   // later: 'openai-compatible'
  testConnection(key: string): Promise<{ ok: true; models: ModelInfo[] } | { ok: false; reason: AiError }>;
  complete(req: { model: string; system: string; payload: unknown; schema: JsonSchema; signal: AbortSignal }):
    Promise<{ ok: true; json: unknown; usage: Usage } | { ok: false; reason: AiError }>;
};
```

Nothing outside `src/features/ai/` imports the SDK. The rest of the app knows only `analyse.ts`.

### 5.4 Findings: how "meaningful" is decided

A finding is a typed record: `{ id, kind, exerciseId?, values, window, strength }`.

| Detector | Fires when (defaults, all tunable in one file) |
|---|---|
| Weight PR / rep PR / e1RM PR / volume PR | Today beats every earlier completed session |
| Progressing | Reps at the same top weight up by ≥ 1, or top weight up by ≥ one `weight_step`, against the previous same-name session |
| Plateau | Top weight and reps at it unchanged for ≥ 4 consecutive sessions of that exercise |
| Regressing | Estimated 1RM below baseline by more than 5% in 2 consecutive sessions |
| Rest drift | Average rest for an exercise > 20% and > 15 s above its baseline |
| Session load high / low | Session volume or effort-weighted load outside baseline ± max(10%, the spread of the last 6 sessions) |
| Weekly volume spike | This week's volume > 25% above the 4-week average |
| Long session | Duration > 15% above baseline at similar volume |

- **Baseline** = median of the last 4–6 completed sessions of the same workout name (same
  exercise, for per-exercise detectors).
- **Not enough data** is itself a finding. Under 3 prior sessions, trend detectors don't run and
  the payload says `history: "insufficient"`, so the AI is told not to infer a trend.
- Skipped sets and skipped exercises are excluded everywhere, as they are in existing queries.
- Bodyweight exercises compare reps and added load, not volume, because 0 kg × reps is 0.

### 5.5 Data flow for a post-workout analysis

```
Finish tapped
  └─ completeSession()                      existing; the workout is saved before anything else
      └─ Summary screen renders             local metrics + findings, synchronous, < 16 ms
          └─ if AI connected and auto-analyse on:
               analyse.ts
                 1. insert ai_analyses row, status 'pending'
                 2. context.ts builds payload  = findings + evidence table + allowed categories
                 3. hash payload; skip if an 'ok' row with the same hash exists
                 4. provider.complete()        30 s timeout, cancellable
                 5. validate reply against schema; drop any bullet whose finding_ids
                    aren't in the payload
                 6. update row to 'ok' (+ tokens) or 'failed' / 'refused'
                 7. bumpRevision()             the Analysis block appears
```

The request runs in a module-level task, not in the screen, so leaving the summary doesn't cancel
it.

**Reply schema (session):**

```ts
{
  headline: string,                                        // one factual sentence
  observations: { text: string; finding_ids: string[]; certainty: 'clear' | 'tentative' }[],  // ≤ 4
  next_session: { text: string; finding_ids: string[] }[],                                    // ≤ 2
  caveats: string[]                                        // e.g. "only two prior sessions"
}
```

**Prompt rules (in `prompts.ts`, versioned):** state numbers with their comparison period; no
praise, encouragement or exclamation marks; no advice that isn't tied to a finding; say when data
is insufficient; no medical statements; plain sentences.

### 5.6 Failure handling

| Situation | What the user sees | What the app does |
|---|---|---|
| AI off or no key | No Analysis block | Nothing |
| No connection, timeout | "Will analyse when you're back online" | Row stays `pending`. Retried on next foreground, up to 5 attempts, then `failed` |
| 401 / 403 | "Key rejected. Check it in Settings" | Marks the connection broken; stops auto-analysis until the key is re-tested |
| 429, 5xx, 529 | Same as offline | The SDK retries twice itself; then as above |
| No credit | "No credit on your Anthropic account" | `failed`, no retry |
| `stop_reason: "refusal"` | "No analysis for this session" | `refused`, no retry |
| Reply cut off or fails the schema | Same as offline, once | One retry, then `failed` |
| Session deleted | — | Analysis row removed by cascade |

Every failure is one quiet line in the place the analysis would be. No alert, no toast, no
notification. A *Retry* link appears on `failed`.

### 5.7 Offline, caching, retries, minimisation

- **Offline:** logging, summary numbers, records, insights cards, Profile and reports all work
  with no connection. Only the AI text waits.
- **Caching:** an analysis is stored once and read from SQLite afterwards. The same payload hash is
  never sent twice. Anthropic's prompt caching isn't used: the system prompt is far below the
  minimum cacheable size, and at about 25 requests a month it wouldn't matter.
- **Retries:** on app foreground only. No background task, no WorkManager, no new permission. The
  "Background activity: 0%" row in `IMPLEMENTATION_PLAN.md` §6.1 stays true.
- **Minimisation:** each analysis kind declares the categories it can use. `context.ts` sends the
  intersection of that list and your switches.

  | Analysis | May include |
  |---|---|
  | Session | Training; notes; from Body only the latest bodyweight and its 4-week change |
  | Weekly review | Training; from Body the weight trend, age, height and target |
  | Health review (manual) | The markers you tick, as latest and previous value with range and dates; training summary |

  Never sent in any analysis: the report files, the lab's name, your date of birth (age in years
  is sent instead), session IDs, or anything from the routine you didn't perform.

### 5.8 State management

No new pattern. Settings stay in the existing Zustand store. Analyses, measurements and reports
are SQLite rows read through `useQuery`. The one in-flight request is tracked in a small store
(`useAiStatus`) so the summary and the session detail show the same "Analysing…" state.

### 5.9 The rest-timer rule

Nothing in this plan reads, writes or renders the live timer. The analysis reads
`sets.rest_before_s`, which was derived from timestamps and written when the next set began. No new
interval, clock or accumulator is introduced anywhere.

---

## Part 6 — Privacy and security

| Subject | Design |
|---|---|
| **Consent** | Nothing is sent before the consent screen is accepted. It's versioned; adding a data category asks again. Blood data has a second, separate consent at the point of use |
| **API key** | Stored with `expo-secure-store` (Android Keystore). Never in SQLite, exports, logs or error messages. Shown masked after entry. Read into memory only for the duration of a request |
| **Key hygiene** | The setup screen recommends a key created for Forte alone, in its own Console workspace with a monthly spend limit, so a lost phone can't run up a bill and the key can be revoked alone |
| **Ask Claude route** | Forte makes no request at all. It hands text to Android's share sheet, and you choose the app. Consent and the category switches still apply to what goes into the brief. Your Claude privacy setting governs training use and retention (§2.6) |
| **Transport (API route only)** | HTTPS to `api.anthropic.com` only. No analytics, no crash reporting, no third host |
| **What leaves the phone** | Only the payload described in §5.7, only when AI is on, only for the categories switched on. *Show what's sent* displays it verbatim |
| **Workout data at rest** | As today: SQLite in the app's private storage, protected by Android's file-based encryption |
| **Profile and blood data at rest** | Same database and a private `reports/` folder. Not readable by other apps. Not separately encrypted (D11 covers the options) |
| **Android Auto Backup** | Decide deliberately (D11). Recommended: exclude `reports/` from cloud backup with a `dataExtractionRules` file, so reports never reach Google Drive unless you export them |
| **Stored AI text** | Kept locally until deleted. *Delete all analyses* in AI settings. Deleting a session deletes its analysis |
| **Disconnect** | Deletes the key immediately. Pending analyses are cancelled. Optionally deletes saved analyses |
| **Delete health data** | One action in Profile removes all measurements, reports, results and the report files |
| **Medical boundary** | Recorded lab values and AI text never share a visual block. AI text about health carries a fixed label, *AI observation — not medical advice*. Out-of-range flags come from arithmetic on the report's range, never from the model. The prompt forbids diagnosis and treatment suggestions |
| **App copy** | "Nothing is uploaded anywhere" (Settings), "no network requests" (README) and the v1.0.0 privacy note are reworded to "nothing leaves this device unless you turn on AI analysis" in the release that adds AI (F2) |
| **Lost phone** | The key is recoverable by revoking it in the Console. Health data on a locked phone is protected by the device lock. An in-app lock is an option (D11) |

---

## Part 7 — Phased roadmap

Tiers follow `FUTURE_ENHANCEMENTS.md`: **T1** ships over the air with `npm run update`; **T2** needs
a new APK. Efforts are rough working days.

Phases 1–3 need no AI, no network and no native module, and each is useful alone.

**Order after Revision 2.** The phase tables below were written for the API route. Read them with
these changes:

| Order | Phase | Change |
|---|---|---|
| 0 | Groundwork | Adds the wording changes in §0.1 B. The spike changes: share a 15 KB brief from Forte to the Claude app on your phone and confirm it arrives whole. The SDK spike moves to Phase 9 |
| 1–3 | Metrics, Insights, Profile | Unchanged |
| **4** | **Ask Claude** (new, below) | Replaces the API connector as the first AI phase. T1 |
| 5 | Weekly and body context | Old Phase 6, through Ask Claude. Depends on new Phase 4, not on the API |
| 6 | Blood reports, manual | Old Phase 7. No longer waiting on a go/no-go |
| 7 | Health review through Ask Claude | Old Phase 8 without file extraction |
| 9 (optional) | API connector | Old Phase 4. T2, new APK |
| 10 (optional) | Automatic analysis, AI reading of report files | Old Phase 5 and the extraction half of old Phase 8 |

### New Phase 4 — Ask Claude · T1 · ~2 days

| | |
|---|---|
| Objective | Claude-quality analysis of a session with no API key and no new native module |
| Work | `context.ts` and `prompts.ts` (shared with the later API route). *Ask Claude about this session* on Summary and Session detail, using React Native's `Share`. Ask Claude settings: consent, category switches, *Show the brief*. *Paste Claude's reply* on Session detail |
| Database | v4 `ai_analyses`, used for pasted replies only |
| Depends on | Phase 1 |
| Tests | Brief builder against fixtures: only allowed categories present, no IDs or date of birth, stable output for the same session. Brief length stays under the size confirmed in the Phase 0 spike. Pasted reply saves, shows and deletes with its session |
| Done when | Finish → Ask Claude → the brief is in a Claude chat in two taps; with consent not given, the button explains instead of sharing; the app makes no network request during the flow; ten real sessions produce replies that are specific and free of praise |

### Phase 0 — Groundwork · T1 · ~1 day

| | |
|---|---|
| Objective | Remove unknowns before building |
| Work | Sign off the decisions in Part 8. Fix F1 (`skipped` on import) and bump the export format with a v1-compatible importer. Spike: one `@anthropic-ai/sdk` request under Hermes on the phone, in a throwaway branch. Settle the test approach (D10). Amend the non-goals in `DESIGN.md` §1 and `FUTURE_ENHANCEMENTS.md` §6 |
| Database | None |
| Depends on | Nothing |
| Tests | Import/export round trip including a skipped set |
| Done when | A v1 backup and a v2 backup both restore correctly; the spike has a recorded yes or no; the docs reflect the new scope |

### Phase 1 — Metrics engine and fuller summary · T1 · ~3 days

| | |
|---|---|
| Objective | Every number the AI will later explain, calculated locally and shown without AI |
| Work | `src/features/analysis/` (metrics, baseline, findings, phrasing). `queries/analysis.ts`. Summary screen: effort row, records list, fuller comparison rows. Session detail shows effort and records |
| Database | v3, first statement only: `sessions.effort` |
| Depends on | Phase 0 |
| Tests | The bulk of the project's new tests. Fixture histories with hand-calculated expected values for every metric and detector, including: first session, two sessions, skipped sets, bodyweight exercises, a replaced exercise, a deleted middle session |
| Done when | Summary numbers match the fixtures; no detector fires on under-three-session history; logging speed on Active Workout is unchanged; all existing tests pass |

### Phase 2 — Insights view · T1 · ~2 days

| | |
|---|---|
| Objective | Rational, specific observations with no AI |
| Work | `Lifts / Insights` switch on Progress. Insight cards from the Phase 1 detectors across all tracked exercises, ranked, capped at five. Weekly and muscle-group aggregates |
| Database | None |
| Depends on | Phase 1 |
| Tests | Ranking and cap; an insight disappears when its condition clears; empty state under three sessions |
| Done when | Each card names its numbers and its period; tapping one opens that exercise; the screen reads correctly at 360 dp and at 200% text in both themes |

### Phase 3 — Profile tab and body measurements · T1 · ~3 days

| | |
|---|---|
| Objective | A place for body data with full history |
| Work | Fifth tab in `(tabs)/_layout.tsx` and `PillNav` (icon and label maps). `profile.tsx`, `profile/[kind].tsx`. Settings moves under Profile; gear removed from Today. Export v2 gains the new tables |
| Database | Rest of v3: `profile`, `body_measurements` |
| Depends on | Phase 0. Independent of Phases 1–2 |
| Tests | Latest-value and trend queries; unit conversion; export/import of the new tables; contrast pairs for any new colour combination |
| Done when | A weight is logged in two taps; no entry is ever overwritten; the pill fits five tabs at 320 dp; `DESIGN.md` §4 and the design-system doc describe five tabs |

### Phase 4 — AI connector · **T2, new APK** · ~3 days

| | |
|---|---|
| Objective | Connect, test and disconnect a provider safely. No analysis yet |
| Work | Add `expo-secure-store` (and anything else chosen in D9, so there's one APK, not two). `src/features/ai/provider.ts`, `anthropic.ts`, `credentials.ts`. `app/settings/ai.tsx`: consent, key, test, model, category switches, disconnect. Reword the privacy copy (F2) |
| Database | None (settings keys only) |
| Depends on | Phase 0 spike |
| Tests | Consent gating; "enabled without key = not connected"; the key never appears in an export (asserted on the bundle); error mapping for 401, 429, 5xx, timeout |
| Done when | A valid key connects and lists models; an invalid one gives a plain message; disconnect removes the key; with AI off the app makes no request to Anthropic (checked with a proxy or `adb` network log) |

### Phase 5 — Post-workout analysis · T1 after Phase 4's APK · ~4 days

| | |
|---|---|
| Objective | The summary explains the session |
| Work | `context.ts`, `prompts.ts`, `analyse.ts`. Analysis block on Summary and Session detail. *Show what's sent*. Usage counter. Optional: *Copy analysis brief* (option F) |
| Database | v4: `ai_analyses` |
| Depends on | Phases 1 and 4 |
| Tests | Payload builder against fixtures: only allowed categories present, no IDs or date of birth. Reply validation: unknown `finding_ids` dropped, malformed JSON rejected. Queue: pending → ok, pending → failed after 5 attempts, no duplicate send for the same hash. A recorded set of real replies checked by hand for tone |
| Done when | Finish → summary is as fast as before; Done works at any moment; airplane mode produces a pending row that completes on reconnect; every displayed bullet maps to a finding; ten real sessions read as specific and free of praise |

### Phase 6 — Weekly review and body context · T1 · ~2 days

| | |
|---|---|
| Objective | The longer view, and Profile data in context |
| Work | Weekly review block on Insights with date and Refresh. Body category wired into `context.ts` |
| Database | None (`ai_analyses.kind = 'weekly'`) |
| Depends on | Phases 2, 3, 5 |
| Tests | Once-a-week rule; Body switch off means no body fields in the payload |
| Done when | The review cites periods and numbers that match the cards below it |

### Phase 7 — Blood reports, manual · T1 · ~4 days

| | |
|---|---|
| Objective | Keep reports and their values on the device, and see markers over time |
| Work | File copy into `documentDirectory/reports/`, report list and detail, result editor, marker seed list, marker trend with reference band. Delete-all-health-data. Viewing through the share sheet (already installed) |
| Database | v5: `lab_markers`, `lab_reports`, `lab_results` |
| Depends on | Phase 3. Go/no-go D12 |
| Tests | File lifecycle: delete a report and its file is gone; out-of-range arithmetic; export/import of results; no network call anywhere in the feature |
| Done when | A report can be added, viewed, annotated and deleted offline; a marker's trend links each point to its report |

### Phase 8 — Optional AI over health data · T1 · ~3 days

| | |
|---|---|
| Objective | Faster entry, and context on request |
| Work | Per-report extraction with its own consent and a mandatory review table. Manual health context review with the fixed label |
| Database | None |
| Depends on | Phases 5 and 7 |
| Tests | Nothing is saved without confirmation; the labs switch off blocks both features; health text never renders inside a recorded-values block |
| Done when | A draft can be rejected row by row; the review can't be triggered automatically by any code path |

**Suggested releases (Revision 2):** every phase on the default route ships over the air. A new
APK is needed only for optional Phase 9.

---

## Part 8 — Open decisions

Each has a recommendation. None has been made for you.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | Reverse the two written non-goals (AI coaching; body measurements) | (a) Yes, amend the docs. (b) No | **Decided 14 Nov 2026: (a).** Forte is a personal health app. Wording changes are listed in §0.1 B |
| **D2** | Integration approach | Ask Claude through the share sheet · direct BYOK · personal proxy · on-device · free-tier API | **Revised: Ask Claude**, because you don't want per-token billing. BYOK stays as optional Phases 9–10 |
| **D3** | HTTP client | Official SDK · direct `fetch` | **Official SDK**, confirmed by the Phase 0 spike. Direct `fetch` only if the spike fails |
| **D4** | Default model (optional API route only; on Ask Claude the model is whatever you pick in the Claude app) | Opus 5.5 (~$1.50/mo) · Sonnet 5.5 (~$0.80) · Haiku 5.5 (~$0.05) | **Opus 5.5**, changeable in the picker. The spend is small at this volume |
| **D5** | How effort is captured | (a) One session rating after the workout. (b) RPE or RIR per set. (c) Nothing; derive it from density, rest and rep drop-off | **(a) plus (c).** One optional tap, after the workout. Per-set RPE adds input to the screen you want left alone; it can be added later as an optional long-press, as `FUTURE_ENHANCEMENTS.md` §4.4 suggests |
| **D6** | Effort scale | 5 labelled steps · 1–10 | **5 steps.** Ten targets don't fit a 360 dp row at 48 dp each, and five labelled words are quicker to answer |
| **D7** | Where Profile lives | (a) Fifth tab, Settings inside it. (b) Keep four tabs; Profile opens from Today's header | **(a)**, as you asked for a tab. Appended last so the four existing positions keep their place. The cost: five icon-only targets, and a rarely used screen in a permanent slot |
| **D8** | Where Insights live | (a) Inside Progress as `Lifts / Insights`. (b) A card on Today. (c) Their own tab | **(a).** It answers the same question as Progress, and Today stays "what am I doing now" |
| **D9** | Extra native modules (only if optional Phase 9 is built; the default route needs none) | `expo-secure-store` (required) · `expo-intent-launcher` (open a PDF directly instead of through the share sheet) · `expo-image-picker` (photograph a paper report) · `expo-local-authentication` (lock Profile) | **Secure store and intent launcher.** Skip the camera: the phone's scanner plus the file picker does the same job. Decide the lock under D11 |
| **D10** | How the metrics engine is tested | (a) Keep hand-mirrored `.mjs` copies. (b) Have tests import the TypeScript directly using Node's type stripping (Node 22.18+ runs `.ts` without a flag) | **(b)** for `src/features/analysis/` only. It needs relative imports in those files and a check that the CI Node version supports it. Existing mirrored tests stay as they are |
| **D11** | Protection of health data at rest | (a) App sandbox only. (b) Also exclude `reports/` from Android cloud backup. (c) Also a biometric lock on Profile. (d) Also encrypt the database (SQLCipher) | **(b).** (c) is cheap to add in the same APK if you want it. (d) changes the build and the existing database for little gain on a single-user phone |
| **D12** | Whether blood reports belong in Forte at all | (a) Build them. (b) Don't | **Decided 14 Nov 2026: (a).** Manual entry first. It's still where a privacy mistake would hurt most, so D11 matters more now |
| **D17** | Whether to save Claude's replies in Forte | (a) Optional paste-back. (b) Leave them in the Claude app | **(a).** It keeps the analysis beside the session it's about, and costs one small table |
| **D18** | Whether to redraw the mock for Ask Claude | (a) Redraw the summary and AI settings screens. (b) Leave the mock as the API route | **(a)**, before Phase 4 starts |
| **D13** | Default sharing | Notes on or off · Body on or off | **Notes on, Body off, Blood results off** and never automatic |
| **D14** | Analysis timing | (a) Automatic after each workout. (b) On tap only | **(a)**, with a switch. It's what you asked for, and it can't delay Done |
| **D15** | Length units for measurements | (a) Centimetres always. (b) Follow the kg/lb setting (cm with kg, inches with lb) | **(b).** Stored in cm either way, like weight in kg |
| **D16** | Expo SDK | Stay on 52 · upgrade first | **Stay on 52** for this work and pin new packages to it. Upgrade as its own task |

---

## Appendix — What changes in existing files

For orientation only. Nothing here has been done.

| File | Change | Phase |
|---|---|---|
| `src/db/migrations.ts`, `src/db/schema.ts` | Append v3, v4, v5 | 1, 3, 5, 7 |
| `src/lib/export.ts` | Format v2, `skipped` fix, new tables | 0, 3, 5, 7 |
| `app/workout/summary.tsx` | Effort row, records, fuller comparison, Analysis block | 1, 5 |
| `app/session/[id].tsx` | Effort, records, Analysis block | 1, 5 |
| `app/(tabs)/progress.tsx` | `Lifts / Insights` switch | 2 |
| `app/(tabs)/_layout.tsx`, `src/ui/PillNav.tsx` | Fifth tab | 3 |
| `app/(tabs)/index.tsx` | Remove the Settings gear | 3 |
| `app/settings.tsx` | Add the AI trainer row; reword the data copy | 4 |
| `app/_layout.tsx` | Register new stack routes; retry pending analyses on foreground | 3, 5 |
| `src/store/settings.ts` | AI keys | 4 |
| `package.json`, `app.json` | `@anthropic-ai/sdk`, `expo-secure-store`, optional `expo-intent-launcher`; version bump | 4 |
| `README.md`, `RELEASE_NOTES.md`, `docs/DESIGN.md`, `docs/DESIGN_SYSTEM_FORTE.md`, `docs/FUTURE_ENHANCEMENTS.md` | Scope, privacy wording, five tabs, new components | 0, 3, 4 |
| `app/workout/active.tsx`, `src/features/workout/*` | **No change in any phase** | — |
