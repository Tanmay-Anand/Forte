/**
 * Forte Companion — a local helper on this PC.
 *
 * Serves the page in web/, reads the newest Forte backup from a folder (the
 * Google Drive folder the phone saves into), and asks the AI the person picks:
 * Claude, ChatGPT, Gemini through their own command-line tools and logins, or
 * an offline model through Ollama (providers.mjs).
 *
 * Every number and every brief comes from the app's own analysis code in
 * src/features/analysis, loaded directly by Node, so the PC and the phone
 * never disagree. The phone's sharing settings (notes, body data) travel in
 * the backup and are respected here.
 *
 * Node built-ins only. The page listens on 127.0.0.1 and answers only itself.
 * Wi-Fi sync (sync.mjs) is a separate listener that only accepts sealed
 * backups from the paired phone.
 */
import http from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bodyContextFrom,
  buildHistory,
  effortLabel,
  formatTarget,
  healthBrief,
  insights,
  labFlag,
  muscleBalance,
  muscleWeeks,
  nextTarget,
  periodBrief,
  sessionBaseline,
  sessionBrief,
  sessionRecords,
  weeklyVolume,
} from '../src/features/analysis/index.ts';
import { formatVolume, formatWeight, trimNumber } from '../src/lib/format.ts';
import { formatDuration, formatMinutes, formatShortDate } from '../src/lib/time.ts';
import { ask, availability } from './providers.mjs';
import { lanAddresses, loadPairing, pairLink, qrSvg, RECEIVED_PREFIX, startSyncServer } from './sync.mjs';
import { isPrivateIPv4, SYNC_PORT } from '../src/features/sync/link.ts';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4174;
const ORIGINS = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
const MAX_BODY = 256 * 1024;
const WINDOW_MS = 56 * 86_400_000;
const PAIRING_FILE = path.join(ROOT, 'pairing.json');
const RECEIVED_DIR = path.join(ROOT, 'received');
const SYNC_HOST = process.env.FORTE_SYNC_HOST ?? '0.0.0.0';
const SYNC_LISTEN_PORT = Number(process.env.FORTE_SYNC_PORT) || SYNC_PORT;

const STATIC = {
  '/': ['web/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['web/app.js', 'text/javascript; charset=utf-8'],
  '/app.css': ['web/app.css', 'text/css; charset=utf-8'],
  '/body-map.js': ['web/body-map.js', 'text/javascript; charset=utf-8'],
};
STATIC['/body-data.js'] = ['web/body-data.js', 'text/javascript; charset=utf-8'];
// The grey body photos made by tools/bake-body.mjs, shared with the phone app.
for (const body of ['male-front', 'male-back', 'female-front', 'female-back']) {
  STATIC[`/body/${body}.webp`] = [`../assets/body/${body}-base.webp`, 'image/webp'];
}

// ------------------------------------------------------------------ backup

/** config.json, or FORTE_BACKUP_DIR, names an extra folder (Google Drive); null when neither is set. */
function backupFolder() {
  if (process.env.FORTE_BACKUP_DIR) return process.env.FORTE_BACKUP_DIR;
  const file = path.join(ROOT, 'config.json');
  if (existsSync(file)) {
    const folder = JSON.parse(readFileSync(file, 'utf8')).backupFolder;
    if (folder) return folder;
  }
  return null;
}

/** forte-backup*.json files in a folder, each with the time its data is from. Null if the folder is missing. */
async function backupsIn(folder) {
  let names;
  try {
    names = await readdir(folder);
  } catch {
    return null;
  }
  const out = [];
  for (const name of names.filter((n) => /^forte-backup.*\.json$/i.test(n))) {
    // Wi-Fi backups are named by the phone's export time; others go by modified time.
    const exported = name.startsWith(RECEIVED_PREFIX) ? Number(name.slice(RECEIVED_PREFIX.length, -5)) : NaN;
    const at = Number.isFinite(exported) ? exported : (await stat(path.join(folder, name))).mtimeMs;
    out.push({ folder, name, at });
  }
  return out;
}

/**
 * The newest backup across Wi-Fi sync's folder and the configured one, by the
 * time its data is from. The bundled sample only when neither has a file.
 */
async function newestBackup() {
  const extra = backupFolder();
  const received = (await backupsIn(RECEIVED_DIR)) ?? [];
  const configured = extra ? await backupsIn(extra) : [];
  const all = [...received, ...(configured ?? [])].sort((x, y) => y.at - x.at);
  if (all.length) return { folder: all[0].folder, file: all[0].name };
  if (extra && configured === null) {
    return { folder: extra, file: null, error: 'Folder not found. Check backupFolder in companion/config.json.' };
  }
  const sample = path.join(ROOT, 'sample');
  const samples = (await backupsIn(sample)) ?? [];
  if (samples.length) return { folder: sample, file: samples[0].name, sample: true };
  return { folder: RECEIVED_DIR, file: null, error: 'No backup yet. Pair your phone on the Setup page.' };
}

async function loadBundle() {
  const found = await newestBackup();
  if (!found.file) return { found, bundle: null };
  const bundle = JSON.parse(await readFile(path.join(found.folder, found.file), 'utf8'));
  if (bundle.format !== 'forte-export') throw new Error('Not a Forte backup file.');
  return { found, bundle };
}

/** The phone's settings, as stored: key → JSON value. */
function settingsOf(bundle) {
  const out = {};
  for (const row of bundle.settings ?? []) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
}

function context(bundle) {
  const settings = settingsOf(bundle);
  const unit = settings.unit === 'lb' ? 'lb' : 'kg';
  const history = buildHistory(bundle);
  const body = bodyContextFrom(bundle.profile?.[0] ?? null, bundle.bodyMeasurements ?? []);
  const options = {
    unit,
    includeNotes: settings.claudeIncludeNotes ?? true,
    body: settings.claudeIncludeBody ? body : null,
  };
  // "Now" is when the backup was made: the data was current then.
  const now = bundle.exportedAt ?? Date.now();
  return { unit, history, body, options, now };
}

/** Blood results per marker, oldest first, from the backup's tables. */
function labSeries(bundle) {
  const markers = new Map((bundle.labMarkers ?? []).map((m) => [m.id, m]));
  const reports = new Map((bundle.labReports ?? []).map((r) => [r.id, r]));
  const byMarker = new Map();
  for (const x of bundle.labResults ?? []) {
    const marker = markers.get(x.marker_id);
    const report = reports.get(x.report_id);
    if (!marker || !report) continue;
    if (!byMarker.has(marker.id)) byMarker.set(marker.id, { id: marker.id, marker: marker.name, category: marker.category, values: [] });
    byMarker.get(marker.id).values.push({
      at: report.taken_at,
      value: x.value,
      valueText: x.value_text,
      unit: x.unit,
      refLow: x.ref_low,
      refHigh: x.ref_high,
    });
  }
  const series = [...byMarker.values()];
  for (const s of series) s.values.sort((a, b) => a.at - b.at);
  return series.sort((a, b) => a.category.localeCompare(b.category) || a.marker.localeCompare(b.marker));
}

/** The brief for a context. Health briefs only carry the markers asked for. */
function briefFor(kind, bundle, markerIds) {
  const { history, options, now } = context(bundle);
  if (kind === 'health') {
    const all = labSeries(bundle);
    const chosen = markerIds?.length ? all.filter((s) => markerIds.includes(s.id)) : all;
    return healthBrief(chosen, history, now, options);
  }
  if (kind === 'period') return periodBrief(history, now, options);
  const last = history.sessions[history.sessions.length - 1];
  return last ? sessionBrief(history, last.id, options) : '';
}

/** Everything the pages show, already formatted. */
function analysis(found, bundle) {
  const { unit, history, body, options, now } = context(bundle);
  const recent = history.sessions.filter((s) => s.startedAt > now - WINDOW_MS);
  const last = history.sessions[history.sessions.length - 1];
  const weekly = weeklyVolume(history, now);
  const baseline = last ? sessionBaseline(history, last.id) : null;

  const lifts = Object.values(history.exercises)
    .map((eh) => ({ ...eh, window: eh.points.filter((p) => p.at > now - WINDOW_MS) }))
    .filter((eh) => eh.window.length)
    .sort((a, b) => b.window[b.window.length - 1].at - a.window[a.window.length - 1].at)
    .map((eh) => {
      const first = eh.window[0];
      const latest = eh.window[eh.window.length - 1];
      const rests = eh.window.map((p) => p.avgRest).filter((r) => r != null);
      const top = (p) => (p.top > 0 ? `${formatWeight(p.top, unit)} × ${p.repsAtTop}` : `${p.repsAtTop} reps`);
      const target = nextTarget(latest.sets, latest.weightStep, unit);
      return {
        name: eh.name,
        then: top(first),
        latest: top(latest),
        up: latest.top > first.top,
        rest: rests.length ? formatDuration(rests.reduce((a, b) => a + b, 0) / rests.length) : '—',
        sessions: eh.window.length,
        target: target ? formatTarget(target, unit) : null,
        targetWhy: target?.reason ?? null,
        trend: eh.window.map((p) => p.e1rm || p.repsAtTop),
      };
    });

  const weights = (bundle.bodyMeasurements ?? [])
    .filter((m) => m.kind === 'weight')
    .sort((a, b) => a.measured_at - b.measured_at);
  const tape = new Map();
  for (const m of bundle.bodyMeasurements ?? []) {
    if (m.kind === 'weight' || m.kind === 'height' || m.kind === 'body_fat') continue;
    const prev = tape.get(m.kind);
    if (!prev || m.measured_at > prev.measured_at) tape.set(m.kind, m);
  }
  const lab = labSeries(bundle);
  const mw = muscleWeeks(history, now, 12);

  return {
    file: found.file,
    folder: found.folder,
    sample: Boolean(found.sample),
    exportedAt: bundle.exportedAt,
    unit,
    sharing: { notes: options.includeNotes, body: Boolean(options.body) },
    stats: [
      { label: 'Sessions', value: String(recent.length), sub: 'last 8 weeks', icon: 'barbell' },
      {
        label: 'Last 7 days',
        value: formatVolume(weekly.thisWeek.volume, unit),
        sub: weekly.average != null ? `4-week average ${formatVolume(weekly.average, unit)}` : 'an average needs three weeks',
        icon: 'chart-bar',
      },
      {
        label: 'Average session',
        value: recent.length ? formatMinutes(recent.reduce((a, s) => a + s.durationMs, 0) / recent.length) : '—',
        sub: 'last 8 weeks',
        icon: 'clock',
      },
    ],
    last: last
      ? {
          name: last.name,
          date: formatShortDate(last.startedAt),
          duration: formatMinutes(last.durationMs),
          sets: last.setCount,
          volume: formatVolume(last.volume, unit),
          effort: effortLabel(last.effort),
          usual: baseline
            ? `${Math.abs(Math.round(baseline.volumeChange * 100))}% ${baseline.volumeChange >= 0 ? 'above' : 'below'} your usual ${formatVolume(baseline.volume, unit)}${baseline.volumeUnusual ? ' — outside your normal spread' : ''}`
            : null,
        }
      : null,
    insights: insights(history, now, unit).map((f) => ({ title: f.title, exercise: f.exerciseName ?? null, text: f.text, span: f.span, kind: f.kind })),
    records: last ? sessionRecords(history, last.id, unit).map((r) => ({ name: r.name, value: r.value, detail: r.detail })) : [],
    balance: muscleBalance(history, now).groups,
    lifts,
    sessions: [...history.sessions].reverse().slice(0, 12).map((s) => ({
      date: formatShortDate(s.startedAt),
      name: s.name,
      duration: formatMinutes(s.durationMs),
      sets: s.setCount,
      volume: formatVolume(s.volume, unit),
      effort: effortLabel(s.effort),
      note: options.includeNotes ? s.note : null,
    })),
    body: {
      weights: weights.map((m) => ({ date: formatShortDate(m.measured_at), value: unit === 'kg' ? m.value : m.value * 2.2046226218 })),
      latest: body.weightKg != null ? formatWeight(body.weightKg, unit) : null,
      latestDate: body.weightAt ? formatShortDate(body.weightAt) : null,
      change: body.weightChange4wKg != null ? `${body.weightChange4wKg >= 0 ? '+' : '−'}${formatWeight(Math.abs(body.weightChange4wKg), unit)} over four weeks` : null,
      target: body.targetKg != null ? formatWeight(body.targetKg, unit) : null,
      height: body.heightCm != null ? `${trimNumber(body.heightCm, 1)} cm` : null,
      age: body.ageYears,
      // Picks the figure on the Body page; the AI never sees it.
      sex: bundle.profile?.[0]?.sex === 'female' ? 'female' : 'male',
      tape: [...tape.values()].map((m) => ({ kind: m.kind.replace('_', ' '), value: `${trimNumber(m.value, 1)} cm`, date: formatShortDate(m.measured_at) })),
    },
    // Per muscle, per week, for the Body page's map and grid. The page sums
    // the last 4, 8 or 12 weeks itself.
    muscles: {
      weeks: mw.weeks.map((w) => formatShortDate(w.start)),
      rows: mw.muscles.map((m) => ({
        id: m.id,
        label: m.label,
        weekly: m.weekly,
        daysSince: m.lastAt == null ? null : Math.max(0, Math.round((now - m.lastAt) / 86_400_000)),
        last: m.lastAt == null ? null : formatShortDate(m.lastAt),
        exercises: m.exercises.slice(0, 4),
      })),
    },
    labs: lab.map((s) => {
      const v = s.values[s.values.length - 1];
      return {
        id: s.id,
        marker: s.marker,
        category: s.category,
        value: v.value != null ? `${trimNumber(v.value, 2)}${v.unit ? ` ${v.unit}` : ''}` : (v.valueText ?? '—'),
        date: formatShortDate(v.at),
        flag: labFlag(v),
        history: s.values.map((x) => `${formatShortDate(x.at)}: ${x.value != null ? trimNumber(x.value, 2) : (x.valueText ?? '—')}`).join(' · '),
      };
    }),
  };
}

// ------------------------------------------------------------------ http

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const json = (res, status, value) => send(res, status, 'application/json', JSON.stringify(value));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) reject(new Error('too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const KINDS = new Set(['session', 'period', 'health']);
const PROVIDER_IDS = new Set(['claude', 'chatgpt', 'gemini', 'ollama']);

const server = http.createServer(async (req, res) => {
  // Refuse anything addressed by another name (DNS rebinding) or sent from another page.
  if (!ORIGINS.has(`http://${req.headers.host}`)) return send(res, 403, 'text/plain', 'Forbidden');
  if (req.method !== 'GET' && !ORIGINS.has(req.headers.origin ?? '')) {
    return send(res, 403, 'text/plain', 'Forbidden');
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && STATIC[url.pathname]) {
      const [file, type] = STATIC[url.pathname];
      return send(res, 200, type, await readFile(path.join(ROOT, file)));
    }
    if (req.method === 'GET' && url.pathname === '/api/analysis') {
      const { found, bundle } = await loadBundle();
      if (!bundle) return json(res, 404, found);
      return json(res, 200, analysis(found, bundle));
    }
    if (req.method === 'GET' && url.pathname === '/api/sync') {
      return json(res, 200, syncStatus());
    }
    if (req.method === 'POST' && url.pathname === '/api/sync/new-key') {
      loadPairing(PAIRING_FILE, { fresh: true });
      return json(res, 200, syncStatus());
    }
    if (req.method === 'GET' && url.pathname === '/api/providers') {
      return json(res, 200, { providers: await availability() });
    }
    if (req.method === 'GET' && url.pathname === '/api/brief') {
      const kind = url.searchParams.get('kind');
      if (!KINDS.has(kind)) return json(res, 400, { error: 'Unknown kind.' });
      const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
      const { found, bundle } = await loadBundle();
      if (!bundle) return json(res, 404, found);
      return json(res, 200, { text: briefFor(kind, bundle, ids) });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const { provider, model, context: kind, ids, messages } = JSON.parse(await readBody(req));
      if (!PROVIDER_IDS.has(provider)) return json(res, 400, { error: 'Unknown AI.' });
      if (!KINDS.has(kind)) return json(res, 400, { error: 'Unknown kind.' });
      const clean = (Array.isArray(messages) ? messages : [])
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
      if (!clean.length || clean[clean.length - 1].role !== 'user') return json(res, 400, { error: 'No question.' });
      const { found, bundle } = await loadBundle();
      if (!bundle) return json(res, 404, found);
      const system = briefFor(kind, bundle, Array.isArray(ids) ? ids : []);
      if (!system) return json(res, 200, { ok: false, error: 'Nothing to review in this backup yet.' });
      const started = Date.now();
      const reply = await ask(provider, { system, messages: clean, model });
      return json(res, 200, { ...reply, ms: Date.now() - started });
    }
    send(res, 404, 'text/plain', 'Not found');
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * What the Setup page shows: the pairing QR, the last backup received, and
 * whether the phone can still reach this PC at the address it was given.
 */
function syncStatus() {
  const pairing = loadPairing(PAIRING_FILE);
  // FORTE_SYNC_ADVERTISE overrides the addresses in the QR (an emulator reaches the PC at 10.0.2.2).
  const hosts = process.env.FORTE_SYNC_ADVERTISE
    ? process.env.FORTE_SYNC_ADVERTISE.split(',')
    : SYNC_HOST === '0.0.0.0'
      ? lanAddresses()
      : [SYNC_HOST];
  const link = hosts.length ? pairLink(pairing, hosts, SYNC_LISTEN_PORT) : null;
  const last = pairing.lastReceived;
  return {
    name: os.hostname(),
    hosts,
    port: SYNC_LISTEN_PORT,
    link,
    qr: link ? qrSvg(link) : null,
    lastReceived: last ? { at: last.at, exportedAt: last.exportedAt, sessions: last.sessions } : null,
    // The phone only knows the addresses in the QR it scanned. If the one it
    // last reached is no longer this PC's, it needs to scan again.
    // Only home-network addresses count: a loopback or tunnel address says nothing about the Wi-Fi.
    addressChanged: Boolean(last?.to && isPrivateIPv4(last.to) && !hosts.includes(last.to)),
  };
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Forte Companion on http://127.0.0.1:${PORT}`);
  const extra = backupFolder();
  if (extra) console.log(`Also reading backups from ${extra}`);
});

startSyncServer({ pairingFile: PAIRING_FILE, receivedDir: RECEIVED_DIR, host: SYNC_HOST, port: SYNC_LISTEN_PORT });
