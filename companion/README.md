# Forte Companion

A local app for your PC that reads your newest Forte backup, shows your training, body and blood
results, and lets you talk to an AI about them: **Claude, ChatGPT, Gemini, or a model running on this
PC**. No API keys and no extra bills: each AI uses its own app's login.

Every number and every summary comes from the app's own analysis code in `src/features/analysis`,
which Node loads directly, so the PC and the phone never disagree.

## Run it

Double-click `companion\run.bat`. A small window opens (leave it open) and your browser opens
http://127.0.0.1:4174. Close the window to stop.

You need Node.js 22.18 or newer. With no setup it reads the invented sample in `sample/`
(`node companion/tools/make-sample.mjs` rebuilds it).

## The sections

| Section | What's there |
|---|---|
| **Home** | Your last workout against your usual, three headline numbers, what Forte noticed, records, muscle-group balance |
| **Training** | Every lift over eight weeks with a trend line and the next-set target; recent sessions with effort and notes |
| **Body** | A realistic front and back body, each muscle shaded by sets over 4, 8 or 12 weeks; the most and least trained muscles, sets per muscle per week, weight and measurements. Muscles come from exercise names (`src/features/analysis/muscles.ts`). The female body is used when your profile says female |
| **Health** | Blood results with each lab's range and history |
| **Ask AI** | Choose what the AI sees, then ask anything, with follow-ups |
| **Setup** | Which AI to use and its model (Claude, offline), and where backups come from |

Dark by default, like the app; the sun button switches to light.

## Getting your data here

1. **Phone → Google Drive.** After a workout: *Analyse with AI* → *Send backup for Forte Companion*
   → Drive → a folder called `Forte`. Or turn on Settings → *Automatic backup* on the phone and let a
   sync app (Autosync for Google Drive, FolderSync) copy that folder to Drive.
2. **Drive → PC.** Install Google Drive for desktop and sign in. The folder appears as
   `G:\My Drive\Forte`.
3. Copy `config.example.json` to `config.json` (ignored by git) and set `backupFolder`.
4. In the companion, the button at the top right always loads the newest `forte-backup…` file.

## The AIs

| AI | Set up once | Where your data goes |
|---|---|---|
| **Claude** | Install Claude Code and sign in (`claude`) | Anthropic, under your Claude plan and its privacy settings |
| **ChatGPT** | `npm install -g @openai/codex`, then `codex login` → Sign in with ChatGPT | OpenAI, under your ChatGPT account |
| **Gemini** | `npm install -g @google/gemini-cli`, then `gemini` once | Google. On this PC (Nov 2026) Google refused personal logins for the CLI; it works with a free `GEMINI_API_KEY`, whose prompts Google may use |
| **Offline** | Install Ollama, then `ollama pull qwen2.5:7b` | Nowhere: it runs on this PC. Slower, and weaker with numbers |

**Claude's model** is chosen in Setup: **Sonnet 5.5** (the default), **Opus 5.5** (the deepest reading,
but it uses your plan's limits fastest) or **Haiku 5.5** (the fastest). The companion passes the exact
model id to Claude Code (`CLAUDE_MODELS` in `providers.mjs`), and each answer is labelled with the
model Claude Code reports it used.

Tested on this PC on 22 November 2026: all three Claude models answer on a Claude subscription; Claude Sonnet 5.5 (7–18 s) and offline qwen2.5:7b (25–45 s) answered full questions.
ChatGPT is not tested (Codex CLI wasn't installed). Gemini failed on the login, as described above.

**What the AI sees** is chosen on the Ask AI page: the last session, the last eight weeks, or the
blood markers you tick. Your phone's Settings → *AI analysis* decides whether session notes and body
data are included. *Show what's shared* displays the exact text; *Copy for any AI* puts it, with the
conversation so far, on the clipboard for any chat website.

An `ANTHROPIC_API_KEY` in your environment is removed for Claude calls, so it can't bill an API
account by accident.

## Credits

The body diagrams and reference photos on the Body page come from
[MuscleMap](https://github.com/Jsplice/MuscleMap) (`@musclemap/assets` 1.1.0, MIT licence), copied
into `vendor/musclemap/` at the top of the repo with its licence. The photos are AI-generated.
`node tools/bake-body.mjs` turns them into the grey photos and muscle outlines that both the
companion and the phone app draw.

## Safety

The helper listens on this PC only (127.0.0.1) and refuses requests from any other page or address.
It reads backup files from the one folder you set and never writes to it. The backup file is not
encrypted: anyone who can open your Google Drive or this PC's files can read it.
