# Forte

A personal, offline workout tracker for Android.
**Plan your week → log every set → see yourself getting stronger.**

No accounts, no server, no network requests. Your training log is a SQLite file on your phone.

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

## Documentation

| Document | Contents |
|---|---|
| [`RELEASE_NOTES.md`](RELEASE_NOTES.md) | What it does, install steps, privacy, limitations, changelog |
| [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) | Build and install — Expo Go, emulator, EAS cloud, local Gradle |
| [`docs/RELEASING.md`](docs/RELEASING.md) | Shipping updates — over-the-air vs new APK, the release workflow, Obtainium |
| [`docs/DESIGN.md`](docs/DESIGN.md) | UI specification: tokens, screens, states, interaction, accessibility |
| [`docs/DESIGN_SYSTEM_FORTE.md`](docs/DESIGN_SYSTEM_FORTE.md) | Design system as built: tokens, components, patterns, contrast audit, spec drift |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Stack evaluation, data model, rest-timer spec, battery analysis |

## Scripts

| Command | Does |
|---|---|
| `npm start` | Dev server for Expo Go |
| `npm run android` | Dev server, opening on a connected device or emulator |
| `npm run typecheck` | TypeScript, strict |
| `npm test` | 26 tests, plain Node — no test framework |
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
