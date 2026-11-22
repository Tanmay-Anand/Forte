/**
 * Forte Companion page. Six sections behind a hash router:
 * Home, Training, Body, Health, Ask AI, Setup. Every number is
 * calculated by the helper with the app's own analysis code; this file only
 * draws it. Everything from the backup is escaped before it reaches the page.
 */
import { figure } from './body-map.js';

const NAV = [
  ['home', 'Home', 'home'],
  ['training', 'Training', 'barbell'],
  ['body', 'Body', 'user'],
  ['health', 'Health', 'droplet'],
  ['ai', 'Ask AI', 'message-chatbot'],
  ['setup', 'Setup', 'settings'],
];

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const $ = (sel) => document.querySelector(sel);
const one = (n) => (Math.round(n * 10) / 10).toString();

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`forte.${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`forte.${key}`, JSON.stringify(value));
    } catch {
      /* private window: preferences just don't persist */
    }
  },
};

let data = null; // /api/analysis
let dataError = null;
let providers = null; // /api/providers
// The conversation lives for the life of the page, across sections.
const chat = { messages: [], busy: false, brief: null, healthIds: new Set(), healthOk: false };

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ------------------------------------------------------------------ loading

async function loadData() {
  $('#source').textContent = 'Loading…';
  try {
    const res = await fetch('/api/analysis');
    const body = await res.json();
    if (!res.ok) {
      data = null;
      dataError = body.error ?? 'Could not read the backup.';
      $('#source').textContent = 'No backup';
    } else {
      data = body;
      dataError = null;
      $('#source').textContent = `${body.file} · ${new Date(body.exportedAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
  } catch {
    data = null;
    dataError = 'The companion helper is not running. Start it with run.bat.';
    $('#source').textContent = 'Offline';
  }
}

async function loadProviders() {
  try {
    providers = (await (await fetch('/api/providers')).json()).providers;
  } catch {
    providers = [];
  }
}

/** The AI in use: the saved choice if it's ready, else the first that is. */
/** The chosen model of a provider that offers a choice (Claude, offline), as { id, label }. */
function modelOf(p) {
  if (!p?.models?.length) return null;
  // Offline models were saved under 'model' before Claude had a choice too.
  const saved = store.get(`model.${p.id}`, null) ?? (p.id === 'ollama' ? store.get('model', null) : null);
  return p.models.find((m) => m.id === saved) ?? p.models[0];
}

function currentProvider() {
  const list = providers ?? [];
  const saved = list.find((p) => p.id === store.get('provider', null) && p.available);
  return saved ?? list.find((p) => p.available) ?? null;
}

// ------------------------------------------------------------------ pieces

function empty(title, body) {
  return `<div class="card"><h2>${esc(title)}</h2><p class="muted" style="margin-top:6px">${esc(body)}</p>
    <a class="btn" href="#/setup" style="margin-top:14px">Open setup</a></div>`;
}

function insightCard(f) {
  return `<div class="insight"><div class="k"><span class="label" style="margin:0">${esc(f.title)}</span><span class="faint" style="font-size:13px">${esc(f.span)}</span></div>
    ${f.exercise ? `<b>${esc(f.exercise)}</b>` : ''}<p>${esc(f.text)}</p></div>`;
}

function spark(values, cls = 'spark') {
  if (!values || values.length < 2) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i) => 2 + (i / (values.length - 1)) * 86;
  const y = (v) => 23 - ((v - lo) / (hi - lo || 1)) * 20;
  return `<svg class="${cls}" viewBox="0 0 90 26" aria-hidden="true"><path d="${values
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ')}"/></svg>`;
}

function lineChart(points, unit) {
  if (points.length < 2) return '<p class="muted">The chart appears after two weigh-ins.</p>';
  const W = 640;
  const H = 200;
  const pad = { l: 46, r: 14, t: 14, b: 30 };
  const vals = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...vals) - 0.5);
  const hi = Math.ceil(Math.max(...vals) + 0.5);
  const x = (i) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bodyweight over time">
    ${ticks.map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${t.toFixed(1)}</text>`).join('')}
    <path class="line" d="${points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.value)}`).join(' ')}"/>
    ${points.map((p, i) => `<circle class="pt ${i === points.length - 1 ? 'last' : ''}" cx="${x(i)}" cy="${y(p.value)}" r="${i === points.length - 1 ? 5 : 3.5}"><title>${esc(p.date)}: ${p.value.toFixed(1)} ${esc(unit)}</title></circle>`).join('')}
    <text x="${pad.l}" y="${H - 8}">${esc(points[0].date)}</text>
    <text x="${W - pad.r}" y="${H - 8}" text-anchor="end">${esc(points[points.length - 1].date)}</text>
  </svg>`;
}

// ------------------------------------------------------------------ home

function home(host) {
  if (!data) return (host.innerHTML = empty('No backup yet', dataError ?? '')), 'Home';
  const l = data.last;
  host.innerHTML = `<div class="grid2">
    <div>
      <div class="card">
        <h1>Welcome back</h1>
        ${l ? `<div class="lastrow"><span class="dot"></span>
          <div style="flex:1;min-width:200px"><b>${esc(l.name)} · ${esc(l.date)}</b>
            <div class="faint" style="font-size:13px">${esc(l.duration)} · ${l.sets} sets · ${esc(l.volume)}${l.effort ? ` · ${esc(l.effort)}` : ''}</div>
            ${l.usual ? `<div class="muted" style="font-size:13px">Volume ${esc(l.usual)}</div>` : ''}</div>
          <a class="btn" href="#/ai?ctx=session">Ask AI about it</a></div>` : ''}
      </div>
      <div class="stats">${data.stats.map((s) => `<div class="card stat"><b><i class="ti ti-${esc(s.icon)}"></i>${esc(s.value)}</b><span>${esc(s.label)} · ${esc(s.sub)}</span></div>`).join('')}</div>
      <h2 style="margin-bottom:12px">Noticed</h2>
      <div class="list">${data.insights.length ? data.insights.map(insightCard).join('') : '<div class="row">Nothing stands out yet.</div>'}</div>
    </div>
    <div class="stack">
      <div class="card"><h2>Ask AI</h2>
        <div class="list" style="margin-top:12px">
          <a class="row" href="#/ai?ctx=session"><span class="ic"><i class="ti ti-barbell"></i></span><b style="flex:1">Last session</b><i class="ti ti-chevron-right faint"></i></a>
          <a class="row" href="#/ai?ctx=period"><span class="ic"><i class="ti ti-calendar-stats"></i></span><b style="flex:1">Last 8 weeks</b><i class="ti ti-chevron-right faint"></i></a>
          ${data.labs.length ? `<a class="row" href="#/ai?ctx=health"><span class="ic"><i class="ti ti-droplet"></i></span><b style="flex:1">Blood results</b><i class="ti ti-chevron-right faint"></i></a>` : ''}
        </div></div>
      ${data.records.length ? `<div class="card"><h2>Records</h2><div class="list" style="margin-top:12px">${data.records.map((r) => `<div class="row"><div><b>${esc(r.name)} · ${esc(r.value)}</b><small>${esc(r.detail)}</small></div></div>`).join('')}</div></div>` : ''}
      <a class="card linkcard" href="#/body"><h2>Body</h2>${miniMap()}</a>
    </div>
  </div>`;
  return 'Home';
}

// ------------------------------------------------------------------ training

function training(host) {
  if (!data) return (host.innerHTML = empty('No backup yet', dataError ?? '')), 'Training';
  host.innerHTML = `<div class="stack">
    <div class="card"><h2 style="margin-bottom:12px">Lifts · 8 weeks</h2>
      <div class="table-wrap"><table><thead><tr><th>Exercise</th><th>Then</th><th>Latest</th><th>Trend</th><th>Next target</th><th>Avg rest</th><th>Sessions</th></tr></thead><tbody>
      ${data.lifts.map((x) => `<tr><td>${esc(x.name)}</td><td class="num mut">${esc(x.then)}</td><td class="num ${x.up ? 'up' : ''}">${esc(x.latest)}</td><td>${spark(x.trend)}</td>
        <td class="num" title="${esc(x.targetWhy ?? '')}">${esc(x.target ?? '—')}</td><td class="num mut">${esc(x.rest)}</td><td class="num mut">${x.sessions}</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="card"><h2 style="margin-bottom:12px">Recent sessions</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Workout</th><th>Duration</th><th>Sets</th><th>Volume</th><th>Effort</th></tr></thead><tbody>
      ${data.sessions.map((s) => `<tr title="${esc(s.note ?? '')}"><td class="mut">${esc(s.date)}</td><td>${esc(s.name)}${s.note ? ' <i class="ti ti-note faint"></i>' : ''}</td><td class="num mut">${esc(s.duration)}</td><td class="num mut">${s.sets}</td><td class="num">${esc(s.volume)}</td><td class="mut">${esc(s.effort ?? '—')}</td></tr>`).join('')}
    </tbody></table></div></div></div>`;
  return 'Training';
}

// ------------------------------------------------------------------ body

const PERIODS = [4, 8, 12];
let selectedMuscle = null;

/** Totals over the chosen period, ranked, with a 0–5 shade level each. */
function muscleStats(weeks) {
  const m = data.muscles;
  const n = Math.min(weeks, m.weeks.length);
  const rows = m.rows.map((r) => {
    const span = r.weekly.slice(-n);
    const total = span.reduce((a, b) => a + b, 0);
    return { ...r, span, total, perWeek: total / n };
  });
  const max = Math.max(...rows.map((r) => r.total), 0);
  for (const r of rows) r.level = r.total <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((r.total / max) * 5));
  return { rows: rows.sort((a, b) => b.total - a.total), max, weeks: m.weeks.slice(-n), n };
}

function maps(stats, selected) {
  const levels = Object.fromEntries(stats.rows.map((r) => [r.id, r.level]));
  const labels = Object.fromEntries(stats.rows.map((r) => [r.id, `${r.label}: ${one(r.perWeek)} sets a week`]));
  const sex = data.body?.sex;
  return `${figure('front', levels, labels, selected, sex)}${figure('back', levels, labels, selected, sex)}`;
}

function miniMap() {
  if (!data?.muscles) return '';
  return `<div class="figures mini">${maps(muscleStats(4), null)}</div>`;
}

function body(host) {
  if (!data) return (host.innerHTML = empty('No backup yet', dataError ?? '')), 'Body';
  const weeks = store.get('bodyWeeks', 4);
  const stats = muscleStats(weeks);
  const trained = stats.rows.filter((r) => r.total > 0);
  if (!selectedMuscle || !stats.rows.find((r) => r.id === selectedMuscle)) selectedMuscle = trained[0]?.id ?? stats.rows[0].id;
  const sel = stats.rows.find((r) => r.id === selectedMuscle);
  const least = [...stats.rows].reverse().slice(0, 5);
  const maxCell = Math.max(...stats.rows.flatMap((r) => r.span), 0);
  const cellLevel = (v) => (v <= 0 || maxCell <= 0 ? 0 : Math.max(1, Math.ceil((v / maxCell) * 5)));
  const b = data.body;

  host.innerHTML = `<div class="stack">
    <div class="headrow"><span></span>
      <div class="seg" style="min-width:260px">${PERIODS.map((p) => `<button data-weeks="${p}" class="${p === weeks ? 'on' : ''}">${p} weeks</button>`).join('')}</div></div>

    <div class="bodygrid">
      <div class="card">
        <div class="figures">${maps(stats, selectedMuscle)}</div>
        <div class="legend"><span>Less</span>${[1, 2, 3, 4, 5].map((l) => `<i class="sw l${l}"></i>`).join('')}<span>More</span><i class="sw l0" style="margin-left:14px"></i><span>None</span></div>
      </div>

      <div class="stack">
        <div class="card detail">
          <div class="headrow" style="margin-bottom:4px"><h2>${esc(sel.label)}</h2><span class="tag ${sel.total ? '' : 'bad'}">${sel.total ? `#${stats.rows.indexOf(sel) + 1} of ${stats.rows.length}` : 'Not trained'}</span></div>
          <div class="kpis">
            <div><b>${one(sel.perWeek)}</b><span>sets a week</span></div>
            <div><b>${one(sel.total)}</b><span>sets in ${stats.n} weeks</span></div>
            <div><b>${sel.daysSince == null ? '—' : sel.daysSince === 0 ? 'Today' : `${sel.daysSince}d`}</b><span>since trained</span></div>
          </div>
          ${spark(sel.span, 'spark wide')}
          <div class="list" style="margin-top:12px">${sel.exercises.length ? sel.exercises.map((e) => `<div class="row"><div style="flex:1">${esc(e.name)}</div><span class="faint">${e.sets} sets${e.primary ? '' : ' · helper'}</span></div>`).join('') : '<div class="row faint">No exercises for it in the last 12 weeks.</div>'}</div>
        </div>
        <div class="card"><h2 style="margin-bottom:10px">Most trained</h2>
          <div class="bars">${trained.slice(0, 5).map((r) => `<button class="barrow" data-muscle="${r.id}"><span>${esc(r.label)}</span><div class="bar"><i style="width:${Math.max(3, (r.total / stats.max) * 100)}%"></i></div><b>${one(r.perWeek)}</b></button>`).join('') || '<p class="muted">Nothing yet.</p>'}</div></div>
        <div class="card"><h2 style="margin-bottom:10px">Least attention</h2>
          <div class="bars">${least.map((r) => `<button class="barrow" data-muscle="${r.id}"><span>${esc(r.label)}</span><div class="bar"><i style="width:${r.total ? Math.max(3, (r.total / stats.max) * 100) : 0}%"></i></div><b class="${r.total ? '' : 'neg'}">${r.total ? one(r.perWeek) : r.daysSince == null ? 'never' : `${r.daysSince}d`}</b></button>`).join('')}</div></div>
      </div>
    </div>

    <div class="card"><h2 style="margin-bottom:12px">Sets per week</h2>
      <div class="table-wrap"><table class="heat"><thead><tr><th></th>${stats.weeks.map((w) => `<th>${esc(w)}</th>`).join('')}<th>Avg</th></tr></thead><tbody>
      ${stats.rows.map((r) => `<tr><td><button class="link" data-muscle="${r.id}">${esc(r.label)}</button></td>${r.span.map((v, i) => `<td><span class="cell l${cellLevel(v)}" title="${esc(r.label)} · week of ${esc(stats.weeks[i])}: ${one(v)} sets">${v ? one(v) : ''}</span></td>`).join('')}<td class="num">${one(r.perWeek)}</td></tr>`).join('')}
      </tbody></table></div></div>

    ${b.weights.length || b.height || b.tape.length ? `<div class="grid2">
      <div class="card"><div class="headrow"><h2>Weight</h2><span class="faint" style="font-size:13px">${esc(b.change ?? '')}</span></div>
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px"><h1>${esc(b.latest ?? '—')}</h1><span class="faint">${b.target ? `target ${esc(b.target)}` : ''}</span></div>
        ${lineChart(b.weights, data.unit)}</div>
      <div class="card"><h2>Measurements</h2><div class="list" style="margin-top:12px">
        ${b.height ? `<div class="row"><div style="flex:1">Height</div><b>${esc(b.height)}</b></div>` : ''}
        ${b.age != null ? `<div class="row"><div style="flex:1">Age</div><b>${esc(b.age)}</b></div>` : ''}
        ${b.tape.map((m) => `<div class="row"><div style="flex:1;text-transform:capitalize">${esc(m.kind)}</div><b>${esc(m.value)}</b></div>`).join('')}</div></div>
    </div>` : ''}
  </div>`;

  host.querySelectorAll('[data-weeks]').forEach((el) =>
    el.addEventListener('click', () => {
      store.set('bodyWeeks', Number(el.dataset.weeks));
      render();
    }),
  );
  host.querySelectorAll('[data-muscle]').forEach((el) =>
    el.addEventListener('click', () => {
      selectedMuscle = el.dataset.muscle;
      render();
    }),
  );
  return 'Body';
}

// ------------------------------------------------------------------ health

function health(host) {
  if (!data) return (host.innerHTML = empty('No backup yet', dataError ?? '')), 'Health';
  if (!data.labs.length) {
    host.innerHTML = `<div class="card"><h2>No blood results yet</h2><p class="muted" style="margin-top:6px">Add reports in the app under Profile → Blood reports, then export a new backup.</p></div>`;
    return 'Health';
  }
  host.innerHTML = `<div class="card"><div class="headrow"><h2>Blood results</h2><a class="btn sm" href="#/ai?ctx=health">Ask AI</a></div>
    <div class="table-wrap"><table><thead><tr><th>Marker</th><th>Latest</th><th>Date</th><th></th><th>History</th></tr></thead><tbody>
    ${data.labs.map((x) => `<tr><td>${esc(x.marker)}<div class="faint" style="font-size:12px">${esc(x.category)}</div></td><td class="num">${esc(x.value)}</td><td class="mut">${esc(x.date)}</td><td>${x.flag ? `<span class="tag flag">${esc(x.flag)}</span>` : ''}</td><td class="wrap">${esc(x.history)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  return 'Health';
}

// ------------------------------------------------------------------ ask ai

const CONTEXTS = [
  ['session', 'Last session'],
  ['period', 'Last 8 weeks'],
  ['health', 'Blood results'],
];
const STARTERS = {
  session: ['Review this session.', 'What should I change next time?', 'Was my rest reasonable?'],
  period: ['Review the last 8 weeks.', 'Where am I stalling?', 'Is my split balanced?'],
  health: ['Review these results.', 'Which of these could training affect?', 'What should I ask my doctor?'],
};

function ai(host, params) {
  if (params.get('ctx') && CONTEXTS.some(([k]) => k === params.get('ctx')) && params.get('ctx') !== store.get('ctx', 'session')) {
    store.set('ctx', params.get('ctx'));
    chat.messages = [];
    chat.brief = null;
  }
  const ctx = store.get('ctx', 'session');
  const current = currentProvider();
  const model = modelOf(current);

  host.innerHTML = `<div class="ai">
    <div class="card">
      <div class="seg">${CONTEXTS.map(([k, label]) => `<button data-ctx="${k}" class="${k === ctx ? 'on' : ''}" ${k === 'health' && !data?.labs.length ? 'disabled' : ''}>${label}</button>`).join('')}</div>
      ${ctx === 'health' && data?.labs.length ? `<div class="markers">${data.labs.map((x) => `<label><input type="checkbox" data-marker="${esc(x.id)}" ${chat.healthIds.has(x.id) ? 'checked' : ''}>${esc(x.marker)}<small>${esc(x.value)}</small></label>`).join('')}</div>` : ''}
      <button class="btn ghost sm" id="showBrief" style="margin-top:14px"><i class="ti ti-eye"></i>${chat.brief ? 'Hide' : 'Show'} what's shared</button>
      ${chat.brief ? `<pre class="brief">${esc(chat.brief)}</pre>` : ''}
    </div>
    <div class="card">
      <div class="headrow">
        <a class="pill" href="#/setup" title="Change in Setup"><i class="ti ti-${current?.id === 'ollama' ? 'cpu' : 'message-chatbot'}"></i>${esc(current ? `${current.name}${model ? ` · ${model.label}` : ''}` : providers ? 'No AI set up' : 'Checking…')}</a>
        <span style="display:flex;gap:8px"><button class="btn ghost sm" id="copyAll" title="Copy the numbers and this chat, to paste into any AI website"><i class="ti ti-copy"></i>Copy</button>
        ${chat.messages.length ? '<button class="btn ghost sm" id="clearChat"><i class="ti ti-plus"></i>New chat</button>' : ''}</span></div>
      <div class="thread" id="thread">${chat.messages.map(msg).join('')}
        ${chat.busy ? `<div class="msg ai"><span class="spin"></span>${esc(current?.name ?? 'AI')} is thinking…</div>` : ''}</div>
      <div class="chips">${STARTERS[ctx].map((s) => `<button class="chip" data-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <form class="composer" id="composer"><textarea id="question" placeholder="Ask a question…" ${chat.busy ? 'disabled' : ''}></textarea>
        <button class="btn" type="submit" ${chat.busy || !current ? 'disabled' : ''}><i class="ti ti-send"></i>Send</button></form>
    </div>
  </div>`;

  host.querySelectorAll('[data-ctx]').forEach((b) =>
    b.addEventListener('click', () => {
      store.set('ctx', b.dataset.ctx);
      chat.messages = [];
      chat.brief = null;
      history.replaceState(null, '', '#/ai');
      render();
    }),
  );
  host.querySelectorAll('[data-marker]').forEach((c) =>
    c.addEventListener('change', () => {
      if (c.checked) chat.healthIds.add(c.dataset.marker);
      else chat.healthIds.delete(c.dataset.marker);
      chat.brief = null;
    }),
  );
  $('#showBrief').addEventListener('click', async () => {
    chat.brief = chat.brief ? null : await briefText(ctx);
    render();
  });
  $('#clearChat')?.addEventListener('click', () => {
    chat.messages = [];
    render();
  });
  $('#copyAll').addEventListener('click', async () => {
    const brief = await briefText(ctx);
    const convo = chat.messages.map((m) => `${m.role === 'user' ? 'Me' : 'AI'}: ${m.content}`).join('\n\n');
    await navigator.clipboard.writeText(`${brief}${convo ? `\n\n---\n${convo}` : ''}`);
    toast('Copied. Paste it into any AI chat.');
  });
  host.querySelectorAll('[data-starter]').forEach((b) => b.addEventListener('click', () => send(b.dataset.starter)));
  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    send($('#question').value);
  });
  $('#question').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e.target.value);
  });
  $('#thread').lastElementChild?.scrollIntoView({ block: 'nearest' });
  return 'Ask AI';
}

function msg(m) {
  const who = m.role === 'user' ? 'You' : m.error ? 'Error' : (m.by ?? 'AI');
  return `<div class="msg ${m.role === 'user' ? 'user' : m.error ? 'err' : 'ai'}"><span class="who">${esc(who)}</span>${esc(m.content)}</div>`;
}

async function briefText(ctx) {
  const ids = ctx === 'health' ? [...chat.healthIds].join(',') : '';
  const res = await fetch(`/api/brief?kind=${ctx}&ids=${encodeURIComponent(ids)}`);
  const body = await res.json();
  return body.text ?? body.error ?? '';
}

async function send(text) {
  const question = String(text ?? '').trim();
  if (!question || chat.busy) return;
  const ctx = store.get('ctx', 'session');
  const p = currentProvider();
  if (!p) return toast('Set up an AI in Setup first.');
  if (ctx === 'health') {
    if (!chat.healthIds.size) return toast('Tick at least one marker first.');
    if (!chat.healthOk) {
      const ok = window.confirm(
        `Send ${chat.healthIds.size} blood ${chat.healthIds.size === 1 ? 'marker' : 'markers'}, with dates, values and ranges, to ${p.name}?\n\n${p.privacy}\n\nThe reply is not medical advice.`,
      );
      if (!ok) return;
      chat.healthOk = true;
    }
  }
  chat.messages.push({ role: 'user', content: question });
  chat.busy = true;
  render();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: p.id,
        model: modelOf(p)?.id,
        context: ctx,
        ids: [...chat.healthIds],
        messages: chat.messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
      }),
    });
    const body = await res.json();
    if (body.ok) chat.messages.push({ role: 'assistant', content: body.text, by: `${p.name}${body.model ? ` · ${body.model}` : ''} · ${Math.round(body.ms / 1000)} s` });
    else chat.messages.push({ role: 'assistant', content: body.error ?? 'Something went wrong.', error: true });
  } catch {
    chat.messages.push({ role: 'assistant', content: 'The companion helper stopped. Start it again with run.bat.', error: true });
  } finally {
    chat.busy = false;
    render();
  }
}

// ------------------------------------------------------------------ setup

function setup(host) {
  const list = providers ?? [];
  const current = currentProvider();
  const models = current?.models ?? [];
  const model = modelOf(current);

  host.innerHTML = `<div class="grid2">
    <div class="card"><div class="headrow"><h2>Which AI</h2><button class="btn ghost sm" id="refreshAi"><i class="ti ti-refresh"></i>Check again</button></div>
      <div class="pick">${list.map((p) => `<button class="choice ${p.id === current?.id ? 'on' : ''}" data-provider="${esc(p.id)}" aria-disabled="${!p.available}" aria-pressed="${p.id === current?.id}">
        <span class="radio"></span><span style="flex:1"><b>${esc(p.name)}</b>${p.available ? '' : ' <span class="tag">not set up</span>'}<small>${esc(p.available ? p.how : (p.detail ?? p.install))}</small></span></button>`).join('') || '<p class="muted">Checking…</p>'}</div>
      ${models.length ? `<div style="margin-top:12px"><div class="label">Model</div><select id="model">${models.map((m) => `<option value="${esc(m.id)}" ${m.id === model?.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>${model?.note ? `<p class="note" style="margin-top:8px">${esc(model.note)}</p>` : ''}</div>` : ''}
      ${current ? `<p class="note">${esc(current.privacy)}</p>` : ''}
    </div>
    <div class="stack">
      <div class="card"><h2>Backups</h2>
        <p class="muted" style="margin-top:6px">${data ? `<b>${esc(data.file)}</b> in <code>${esc(data.folder)}</code>` : esc(dataError ?? '')}</p>
        <ol class="steps" style="margin-top:12px">
          <li>Phone: Analyse with AI → Send backup → Drive → <code>Forte</code>, or Settings → Automatic backup with a sync app.</li>
          <li>PC: Google Drive for desktop shows it as <code>G:\\My Drive\\Forte</code>.</li>
          <li>Set <code>backupFolder</code> in <code>companion\\config.json</code>.</li>
        </ol></div>
      <div class="card"><h2>Privacy</h2><p class="muted" style="margin-top:6px">This page runs only on this PC. The backup file isn't encrypted.</p></div>
    </div>
  </div>`;

  host.querySelectorAll('[data-provider]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = list.find((x) => x.id === b.dataset.provider);
      if (!p?.available) return toast(`${p?.name} isn't set up yet.`);
      store.set('provider', p.id);
      render();
    }),
  );
  $('#model')?.addEventListener('change', (e) => {
    store.set(`model.${current.id}`, e.target.value);
    render();
  });
  $('#refreshAi').addEventListener('click', async () => {
    await loadProviders();
    render();
  });
  return 'Setup';
}

// ------------------------------------------------------------------ router

const ROUTES = { home, training, body, health, ai, setup };

function render() {
  const [pathPart, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const name = ROUTES[pathPart] ? pathPart : 'home';
  $('#side').innerHTML = NAV.map(
    ([id, label, icon]) => `<a class="nav ${id === name ? 'on' : ''}" href="#/${id}" ${id === name ? 'aria-current="page"' : ''}><i class="ti ti-${icon}"></i><span>${label}</span></a>`,
  ).join('');
  const main = document.querySelector('main');
  const scroll = main.scrollTop;
  const title = ROUTES[name]($('#view'), new URLSearchParams(query));
  $('#crumb').textContent = title;
  // Re-rendering the same section (a tab, a selection) keeps your place; a new section starts at the top.
  main.scrollTop = render.last === name ? scroll : 0;
  render.last = name;
}

function applyTheme() {
  const theme = store.get('theme', 'dark');
  document.documentElement.dataset.theme = theme;
  $('#themeBtn i').className = `ti ti-${theme === 'dark' ? 'sun' : 'moon'}`;
}

applyTheme();
$('#themeBtn').addEventListener('click', () => {
  store.set('theme', store.get('theme', 'dark') === 'dark' ? 'light' : 'dark');
  applyTheme();
});
$('#reload').addEventListener('click', async () => {
  await loadData();
  render();
  toast(data ? 'Newest backup loaded.' : 'No backup found.');
});
window.addEventListener('hashchange', render);
// Draw as soon as the numbers are in; checking which AI tools are installed
// takes a moment, so it fills in afterwards.
await loadData();
render();
loadProviders().then(render);
