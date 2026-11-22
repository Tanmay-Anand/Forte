/**
 * Builds every brand image from one source: the mountain-range mark in
 * Resources/logo-mountain-range.png. Run it again only when that file or the
 * brand colours below change; its output is committed.
 *
 *   node tools/bake-brand.mjs
 *
 * Node can't draw, so, like tools/bake-body.mjs, this serves a page on
 * 127.0.0.1:4191 that draws the images with the browser's canvas and sends
 * them back. Open it once; the script exits when every file is written.
 *
 *   assets/icon.png                       1024², mark on the pale lake ground
 *   assets/adaptive-icon.png              1024² foreground, mark inside the 62% safe circle
 *   assets/adaptive-icon-monochrome.png   the same, one colour, ridges cut out (Android 13 themed icon)
 *   assets/splash-light.png, splash-dark.png   mark and wordmark, on transparent
 *   assets/notification/ic_stat_forte-<density>.png   white status-bar icon, 24 dp
 *   companion/web/favicon.png, companion/web/mark.png   the PC companion's tab icon and header mark
 */
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand, palette } from '../src/ui/tokens.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'Resources/logo-mountain-range.png');
const PORT = 4191;

/** Ink for the wordmark on each splash; the grounds come from app.json. */
const INK = { light: palette.light.textPrimary, dark: palette.dark.textPrimary };
/** The launcher icon's ground: the logo's palest tone, a little lighter. */
const ICON_GROUND = brand.iconGround;
/** Android status-bar icon sizes: 24 dp at each density. */
const DENSITIES = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };

const OUTPUTS = new Set([
  'assets/icon.png',
  'assets/adaptive-icon.png',
  'assets/adaptive-icon-monochrome.png',
  'assets/splash-light.png',
  'assets/splash-dark.png',
  ...Object.keys(DENSITIES).map((d) => `assets/notification/ic_stat_forte-${d}.png`),
  'companion/web/favicon.png',
  'companion/web/mark.png',
]);

const PAGE = /* html */ `<!doctype html><meta charset="utf-8"><title>Forte brand bake</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@700&display=block">
<body style="font:14px system-ui;padding:24px"><p id="s">Drawing…</p><script type="module">
const INK = ${JSON.stringify(INK)}, GROUND = ${JSON.stringify(ICON_GROUND)}, DENS = ${JSON.stringify(DENSITIES)};
const status = (t) => (document.getElementById('s').textContent = t);
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = '/logo.png'; });
await document.fonts.load('700 120px Geist');

// Trim the transparent margin so every size is measured from the mark itself.
const full = canvas(img.width, img.height); const fx = full.getContext('2d'); fx.drawImage(img, 0, 0);
const a = fx.getImageData(0, 0, img.width, img.height).data;
let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (a[(y * img.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const mark = canvas(x1 - x0 + 1, y1 - y0 + 1); mark.getContext('2d').drawImage(full, -x0, -y0);
const W = mark.width, H = mark.height;

// One-colour version: the shield with the two ridge lines cut out, so the
// three bands still read when Android tints it. A ridge is where brightness
// jumps sharply going down; inside a band it only drifts (the gradients), so
// brightness levels alone can't separate the bands but a sharp step can.
function silhouette(ridges) {
  const src = mark.getContext('2d').getImageData(0, 0, W, H).data;
  const out = new ImageData(W, H);
  const lum = new Float32Array(W * H), alpha = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { lum[i] = 0.2126 * src[i*4] + 0.7152 * src[i*4+1] + 0.0722 * src[i*4+2]; alpha[i] = src[i*4+3]; }
  const step = 3, jump = 28, gap = Math.max(2, Math.round(W * 0.022));
  const edge = new Uint8Array(W * H);
  for (let y = step; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, j = (y - step) * W + x;
    if (alpha[i] > 200 && alpha[j] > 200 && Math.abs(lum[i] - lum[j]) > jump) edge[i] = 1;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (alpha[i] <= 96) continue;
    let cut = false;
    if (ridges) for (let d = 0; d < gap && !cut; d++) if (y - d >= 0 && edge[(y - d) * W + x]) cut = true;
    if (!cut) { out.data[i*4] = out.data[i*4+1] = out.data[i*4+2] = 255; out.data[i*4+3] = alpha[i]; }
  }
  const c = canvas(W, H); c.getContext('2d').putImageData(out, 0, 0); return c;
}
const mono = silhouette(true), plain = silhouette(false);

/** Draws a mark centred in a box, scaled to fit, with high-quality smoothing. */
function place(ctx, m, cx, cy, maxW, maxH) {
  const s = Math.min(maxW / m.width, maxH / m.height), w = m.width * s, h = m.height * s;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(m, cx - w / 2, cy - h / 2, w, h); return { w, h };
}
/** The largest mark that fits inside a circle of diameter d (Android's safe zone). */
const inCircle = (d) => { const r = H / W; const w = d / Math.hypot(1, r); return [w, w * r]; };

const files = {};
{ const c = canvas(1024, 1024), x = c.getContext('2d'); x.fillStyle = GROUND; x.fillRect(0, 0, 1024, 1024); const [w, h] = inCircle(1024 * 0.7); place(x, mark, 512, 512, w, h); files['assets/icon.png'] = c; }
{ const c = canvas(1024, 1024), x = c.getContext('2d'); const [w, h] = inCircle(1024 * 0.62); place(x, mark, 512, 512, w, h); files['assets/adaptive-icon.png'] = c; }
{ const c = canvas(1024, 1024), x = c.getContext('2d'); const [w, h] = inCircle(1024 * 0.62); place(x, mono, 512, 512, w, h); files['assets/adaptive-icon-monochrome.png'] = c; }
for (const theme of ['light', 'dark']) {
  const c = canvas(600, 600), x = c.getContext('2d');
  place(x, mark, 300, 228, 330, 330);
  x.fillStyle = INK[theme]; x.font = '700 92px Geist, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.letterSpacing = '-3px'; x.fillText('Forte', 300, 520);
  files['assets/splash-' + theme + '.png'] = c;
}
for (const [d, px] of Object.entries(DENS)) { const c = canvas(px, px), x = c.getContext('2d'); place(x, plain, px / 2, px / 2, px * 20 / 24, px * 20 / 24); files['assets/notification/ic_stat_forte-' + d + '.png'] = c; }
{ const c = canvas(64, 64), x = c.getContext('2d'); place(x, mark, 32, 32, 58, 58); files['companion/web/favicon.png'] = c; }
{ const c = canvas(Math.round(96 * W / H), 96), x = c.getContext('2d'); place(x, mark, c.width / 2, 48, c.width, 96); files['companion/web/mark.png'] = c; }

for (const [file, c] of Object.entries(files)) {
  status('Saving ' + file);
  const r = await fetch('/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file, data: c.toDataURL('image/png').split(',')[1] }) });
  if (!r.ok) throw new Error(file + ': ' + await r.text());
  const p = document.createElement('p'); p.textContent = file; document.body.append(p, c); c.style.cssText = 'max-width:160px;background:#888;display:block;margin:4px 0 12px';
}
await fetch('/done', { method: 'POST' });
status('Done. ' + Object.keys(files).length + ' files written; you can close this tab.');
</script>`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/logo.png') return send(res, 200, await readFile(SOURCE), 'image/png');
    if (req.method === 'POST' && req.url === '/save') {
      const { file, data } = JSON.parse(await body(req));
      if (!OUTPUTS.has(file)) return send(res, 400, 'not an output: ' + file);
      const out = path.join(ROOT, file);
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, Buffer.from(data, 'base64'));
      console.log('wrote', file);
      return send(res, 200, 'ok');
    }
    if (req.method === 'POST' && req.url === '/done') {
      send(res, 200, 'ok');
      console.log('All brand images written.');
      server.close();
      return;
    }
    send(res, 404, 'not found');
  } catch (err) {
    send(res, 500, String(err));
  }
});

function send(res, status, payload, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type });
  res.end(payload);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Open http://127.0.0.1:${PORT}/ in a browser to draw the brand images.`);
});
