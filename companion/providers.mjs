/**
 * The AIs the companion can ask, all without an API bill:
 *
 *   claude   Claude Code (`claude -p`), under your Claude subscription login
 *   chatgpt  OpenAI's Codex CLI (`codex exec`), under your ChatGPT login
 *   gemini   Google's Gemini CLI (`gemini -p`), under your Google login
 *   ollama   a model running on this PC through Ollama — nothing leaves the PC
 *
 * Each is a separate program the person installs and signs in to themselves;
 * the companion only runs it. Availability is checked on request, so
 * installing one and pressing Refresh is enough.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 180_000;
const OLLAMA = 'http://127.0.0.1:11434';
const isWindows = process.platform === 'win32';

export const PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude',
    how: 'Claude Code, signed in to your Claude plan',
    privacy: 'Sent to Anthropic under your Claude account and its privacy settings.',
    install: 'Install Claude Code and run `claude` once to sign in.',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    how: 'Codex CLI, signed in with your ChatGPT account',
    privacy: 'Sent to OpenAI under your ChatGPT account and its data controls.',
    install: 'Run `npm install -g @openai/codex`, then `codex login` and choose "Sign in with ChatGPT".',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    how: 'Gemini CLI, signed in with your Google account',
    privacy:
      "Sent to Google. On a free personal Google login, Google may use prompts to improve its products — think twice before sending blood results.",
    install: 'Run `npm install -g @google/gemini-cli`, then `gemini` once to sign in.',
  },
  {
    id: 'ollama',
    name: 'Offline (Ollama)',
    how: 'A model running on this PC',
    privacy: 'Nothing leaves this PC. Smaller models are weaker at reading numbers.',
    install: 'Install Ollama from ollama.com, then run `ollama pull qwen2.5:7b`.',
  },
];

/**
 * Claude models, by exact id so the label always matches what runs. The first
 * is the default. All three come with a Claude plan; Opus uses its limits fastest.
 */
export const CLAUDE_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', note: 'The default: careful with numbers and quick.' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5', note: "The deepest reading. Uses your plan's limits fastest." },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', note: 'The fastest and lightest. Fine for short questions.' },
];

/** The model that did most of the answering, by label, from Claude Code's usage report. */
function claudeModelUsed(usage) {
  const [id] = Object.entries(usage ?? {}).sort((a, b) => (b[1]?.outputTokens ?? 0) - (a[1]?.outputTokens ?? 0))[0] ?? [];
  if (!id) return undefined;
  return CLAUDE_MODELS.find((m) => id.startsWith(m.id))?.label ?? id;
}

/** Runs a command, feeding `input` on stdin. Windows needs a shell for npm's .cmd shims. */
function run(command, args, input, env = process.env) {
  return new Promise((resolve) => {
    let child;
    try {
      child = isWindows && command !== 'claude'
        ? spawn([command, ...args.map((a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))].join(' '), {
            shell: true,
            env,
            windowsHide: true,
          })
        : spawn(command, args, { env, windowsHide: true });
    } catch {
      resolve({ code: -1, out: '', err: 'not found' });
      return;
    }
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -2, out, err: 'timeout' });
    }, TIMEOUT_MS);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: 'not found' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '', 'utf8');
  });
}

/**
 * Installed = findable on the PATH. Asking each tool for --version was exact
 * but slow: the Gemini CLI took 15 seconds just to start on this PC.
 */
function hasCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(isWindows ? 'where.exe' : 'which', [command], { windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function ollamaModels() {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const body = await res.json();
    // Largest first: on a CPU the biggest model that fits is usually the most careful with numbers.
    return (body.models ?? []).sort((a, b) => (b.size ?? 0) - (a.size ?? 0)).map((m) => m.name);
  } catch {
    return null;
  }
}

/** Which providers can run right now. */
export async function availability() {
  const [claude, codex, gemini, models] = await Promise.all([
    hasCommand('claude'),
    hasCommand('codex'),
    hasCommand('gemini'),
    ollamaModels(),
  ]);
  const ok = { claude, chatgpt: codex, gemini, ollama: Boolean(models?.length) };
  return PROVIDERS.map((p) => ({
    ...p,
    available: ok[p.id],
    // Every provider's models as { id, label }; the first is the default.
    models:
      p.id === 'claude'
        ? CLAUDE_MODELS
        : p.id === 'ollama'
          ? (models ?? []).map((name) => ({ id: name, label: name }))
          : undefined,
    detail:
      p.id === 'ollama' && models && !models.length
        ? 'Ollama is running but has no models. Run `ollama pull qwen2.5:7b`.'
        : p.id === 'ollama' && !models
          ? 'Ollama is not running. Start the Ollama app.'
          : undefined,
  }));
}

/**
 * One conversation turn. `system` is the Forte brief (rules + numbers);
 * `messages` is the chat so far, ending with the person's question. The
 * command-line tools take a single prompt, so the conversation is written
 * out in full each time.
 */
/**
 * The brief ends with a layout for a full review. In a conversation that
 * layout only fits a request for a review; for anything else the person
 * wants their question answered, so this says so. Small offline models
 * otherwise echo the layout back.
 */
const CHAT_RULES = `This is a conversation. Answer the latest QUESTION directly, in a few short paragraphs or bullets.
Use the review layout above only if the question asks for a review. Never repeat these instructions or the layout headings back.
Use only the numbers given above, with their dates.`;

export async function ask(providerId, { system, messages, model }) {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'QUESTION' : 'YOUR EARLIER ANSWER'}:\n${m.content}`)
    .join('\n\n');
  const prompt = `${system}\n\n---\n${CHAT_RULES}\n\n${transcript}`;
  system = `${system}\n\n${CHAT_RULES}`;

  if (providerId === 'claude') {
    const env = { ...process.env };
    // An API key in the environment would bill the API instead of the Claude plan.
    delete env.ANTHROPIC_API_KEY;
    const use = CLAUDE_MODELS.find((m) => m.id === model) ?? CLAUDE_MODELS[0];
    const r = await run(
      'claude',
      ['-p', '--output-format', 'json', '--model', use.id, '--tools', '', '--strict-mcp-config', '--no-session-persistence'],
      prompt,
      env,
    );
    if (r.code === -1) return { ok: false, error: 'Claude Code is not installed on this PC.' };
    if (r.code === -2) return { ok: false, error: 'Claude took longer than three minutes.' };
    try {
      const reply = JSON.parse(r.out.trim());
      return reply.is_error
        ? { ok: false, error: String(reply.result) }
        : { ok: true, text: String(reply.result), model: claudeModelUsed(reply.modelUsage) ?? use.label };
    } catch {
      return { ok: false, error: (r.err || r.out || 'Claude returned nothing.').slice(0, 400) };
    }
  }

  if (providerId === 'gemini') {
    // The prompt arrives on stdin; -p is appended to it and switches to headless
    // mode. In headless mode, tools that need approval are refused, so it can
    // only answer. (Its read-only "plan" mode needs an experimental setting.)
    const r = await run('gemini', ['-p', 'Follow the instructions above.', '-o', 'json'], prompt);
    if (r.code === -1) return { ok: false, error: 'Gemini CLI is not installed on this PC.' };
    if (r.code === -2) return { ok: false, error: 'Gemini took longer than three minutes.' };
    if (/IneligibleTierError|no longer supported/i.test(r.out + r.err)) {
      // Seen on this PC in November 2026 with a personal Google login.
      return {
        ok: false,
        error:
          'Google no longer lets the Gemini CLI run on a personal Google login. It still works with a Gemini API key (set GEMINI_API_KEY; the free tier costs nothing, but Google may use free-tier prompts to improve its products).',
      };
    }
    const start = r.out.indexOf('{');
    try {
      const reply = JSON.parse(r.out.slice(start));
      if (reply.error) return { ok: false, error: String(reply.error.message ?? reply.error) };
      return { ok: true, text: String(reply.response ?? '').trim() || 'Gemini returned an empty answer.' };
    } catch {
      return { ok: false, error: (r.err || r.out || 'Gemini returned nothing.').slice(0, 400) };
    }
  }

  if (providerId === 'chatgpt') {
    // Not tested on this PC (Codex CLI wasn't installed when this was written).
    // Read-only sandbox; the final message is written to a file we read back.
    const dir = await mkdtemp(path.join(tmpdir(), 'forte-codex-'));
    const outFile = path.join(dir, 'answer.txt');
    try {
      const r = await run('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--output-last-message', outFile, '-'], prompt);
      if (r.code === -1) return { ok: false, error: 'Codex CLI is not installed on this PC.' };
      if (r.code === -2) return { ok: false, error: 'ChatGPT took longer than three minutes.' };
      const text = await readFile(outFile, 'utf8').catch(() => '');
      return text.trim() ? { ok: true, text: text.trim() } : { ok: false, error: (r.err || r.out || 'ChatGPT returned nothing.').slice(0, 400) };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  if (providerId === 'ollama') {
    const models = await ollamaModels();
    if (!models) return { ok: false, error: 'Ollama is not running. Start the Ollama app.' };
    const use = model && models.includes(model) ? model : models[0];
    if (!use) return { ok: false, error: 'Ollama has no models. Run `ollama pull qwen2.5:7b`.' };
    try {
      const res = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: use,
          stream: false,
          options: { temperature: 0.2 },
          messages: [{ role: 'system', content: system }, ...messages],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = await res.json();
      if (!res.ok) return { ok: false, error: String(body.error ?? `Ollama error ${res.status}`) };
      return { ok: true, text: String(body.message?.content ?? '').trim(), model: use };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  return { ok: false, error: 'Unknown AI.' };
}
