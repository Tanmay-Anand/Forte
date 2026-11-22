# Forte

A personal, offline-first health and training app for Android.
**Plan your week → log every set → see yourself getting stronger.** Keep your body and health
records beside it.

No accounts, no server. Your data is a SQLite file on your phone, and it leaves only when you export
it or share it yourself.

## Get it

Download the APK from [Releases](../../releases) — see
[`RELEASE_NOTES.md`](RELEASE_NOTES.md) for install steps and what's in each version.

Requires Android 7.0+. Play Protect will warn about a sideloaded app; that is expected.

**One-tap updates:** add Forte to [Obtainium](https://github.com/ImranR98/Obtainium) with
`https://github.com/Tanmay-Anand/Forte`, and every new release becomes a notification and an
**Update** button. See [`docs/RELEASING.md`](docs/RELEASING.md).

## Run it from source

```bash
npm install
```

```bash
npm start
```

Scan the QR code with Expo Go, or see [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) for the three
ways to get a real installable APK.

## Analysis with AI, without an API key

The app calculates everything itself: records, comparisons with last time and with your usual,
plateaus, rest changes, weekly volume, muscle-group balance, next-set targets. An AI only explains
those numbers, and only when you ask. Two routes, neither with an API bill:

- **On the phone:** *Analyse with AI* on the workout summary, or *Ask AI* in Insights, session
  detail and Blood reports, opens the share menu with a text summary. Pick Claude, ChatGPT or
  Gemini. Forte itself sends nothing.
- **On the PC:** [`companion/`](companion/README.md) reads your newest backup from Google Drive and
  lets you chat with Claude, ChatGPT, Gemini or an offline model, each through its own login.

What a summary contains is set in Settings → AI analysis, and *Show what's shared* displays the
exact text. Blood results are shared only from Blood reports, only the markers you tick, after a
confirmation.

## Documentation

| Document | Contents |
|---|---|
| [`RELEASE_NOTES.md`](RELEASE_NOTES.md) | What it does, install steps, privacy, limitations, changelog |
| [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) | Build and install — Expo Go, emulator, EAS cloud, local Gradle |
| [`docs/RELEASING.md`](docs/RELEASING.md) | Shipping updates — over-the-air vs new APK, the release workflow, Obtainium |
| [`docs/DESIGN.md`](docs/DESIGN.md) | UI specification: tokens, screens, states, interaction, accessibility |
| [`docs/DESIGN_SYSTEM_FORTE.md`](docs/DESIGN_SYSTEM_FORTE.md) | Design system as built: tokens, components, patterns, contrast audit, spec drift |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Stack evaluation, data model, rest-timer spec, battery analysis |
| [`docs/AI_TRAINER_PLAN.md`](docs/AI_TRAINER_PLAN.md) | Analysis, Profile and blood reports: options considered, decisions, architecture, status |
| [`companion/README.md`](companion/README.md) | The PC companion: setup, Google Drive, choosing an AI |

## Scripts

| Command | Does |
|---|---|
| `npm start` | Dev server for Expo Go |
| `npm run android` | Dev server, opening on a connected device or emulator |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint: Expo defaults plus the design-system rules (no hex colours, raw type styles, raw radii or accent text) |
| `npm test` | 118 tests, plain Node — no test framework. Includes the contrast suite, which reads `tokens.ts`, and the analysis engine, loaded as TypeScript directly (Node 22.18+) |
| `npm run build:apk` | Installable Android APK via EAS cloud build |
| `npm run build:apk:unix` | Same build locally — **macOS/Linux/WSL2 only** |
| `npm run prebuild` | Generate `android/` for a local Gradle build |
| `npm run update` | Push a JS-only update over the air |

## Stack

Expo SDK 52 · React Native · TypeScript (strict) · Expo Router · SQLite via `expo-sqlite` ·
Drizzle ORM · Zustand · `react-native-svg` for charts · Urbanist.

## The one rule

Rest time is **derived from stored timestamps, never accumulated by a ticking interval**
(`src/features/workout/rest-timer.ts`). That is what makes the timer survive backgrounding,
screen sleep and process death — and what lets you lock the phone between sets without
corrupting the log. Do not change it.
