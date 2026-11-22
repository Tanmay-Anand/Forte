/**
 * Wi-Fi sync: the phone sends its backup straight to this PC.
 *
 * A second, separate listener on the LAN that answers one path only. The
 * companion's own page stays on 127.0.0.1; nothing that reads or shows data
 * is reachable from the network.
 *
 * Every request must be sealed with AES-256-GCM under the key from pairing
 * (src/features/sync/link.ts has the shared rules). The key is the only
 * credential: an envelope that doesn't open is refused before anything is
 * parsed or written. Replies are sealed too, so nothing else on the Wi-Fi can
 * tell the phone "received".
 *
 * Received backups go to companion/received/ (git-ignored), named by the
 * backup's own export time, so a resend overwrites itself and an older
 * backup can never pass for the newest.
 */
import http from 'node:http';
import os from 'node:os';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  aadFor,
  buildPairLink,
  isPrivateIPv4,
  KEY_BYTES,
  NONCE_BYTES,
  SYNC_PATH,
  SYNC_PORT,
  SYNC_VERSION,
} from '../src/features/sync/link.ts';

const require = createRequire(import.meta.url);
const QRCode = require('../vendor/qrcode/index.js');
const QRErrorCorrectLevel = require('../vendor/qrcode/QRErrorCorrectLevel.js');

const MAX_SYNC_BODY = 64 * 1024 * 1024;
const KEEP = 12;
export const RECEIVED_PREFIX = 'forte-backup-sync-';

// ------------------------------------------------------------------ crypto

/** Same envelope as the phone's seal() in src/features/sync/seal.ts. */
export function sealNode(keyB64, pairId, direction, plaintext) {
  const key = Buffer.from(keyB64, 'base64url');
  const nonce = randomBytes(NONCE_BYTES);
  const c = createCipheriv('aes-256-gcm', key, nonce);
  c.setAAD(Buffer.from(aadFor(pairId, direction), 'utf8'));
  const body = Buffer.concat([c.update(plaintext, 'utf8'), c.final(), c.getAuthTag()]);
  return { v: SYNC_VERSION, id: pairId, n: nonce.toString('base64'), c: body.toString('base64') };
}

/** Throws unless the envelope was sealed with this key, for this pairing and direction. */
export function openNode(keyB64, pairId, direction, env) {
  if (!env || env.v !== SYNC_VERSION || env.id !== pairId) throw new Error('Not from this pairing.');
  if (typeof env.n !== 'string' || typeof env.c !== 'string') throw new Error('Malformed.');
  const key = Buffer.from(keyB64, 'base64url');
  const nonce = Buffer.from(env.n, 'base64');
  const body = Buffer.from(env.c, 'base64');
  if (nonce.length !== NONCE_BYTES || body.length < 16) throw new Error('Malformed.');
  const d = createDecipheriv('aes-256-gcm', key, nonce);
  d.setAAD(Buffer.from(aadFor(pairId, direction), 'utf8'));
  d.setAuthTag(body.subarray(body.length - 16));
  return Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()]).toString('utf8');
}

// ------------------------------------------------------------------ pairing

/** pairing.json (git-ignored): the one phone this PC accepts. Made on first use. */
export function loadPairing(file, { fresh = false } = {}) {
  if (!fresh && existsSync(file)) {
    const p = JSON.parse(readFileSync(file, 'utf8'));
    if (p.id && Buffer.from(p.key ?? '', 'base64url').length === KEY_BYTES) return p;
  }
  const p = {
    id: randomBytes(9).toString('base64url').replace(/[_]/g, 'a'),
    key: randomBytes(KEY_BYTES).toString('base64url'),
    createdAt: Date.now(),
    lastReceived: null,
  };
  savePairing(file, p);
  return p;
}

function savePairing(file, p) {
  // Write then rename, so a crash never leaves half a key behind.
  writeFileSync(`${file}.tmp`, JSON.stringify(p, null, 2), { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}

const VIRTUAL = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|Loopback|docker|vboxnet|Bluetooth/i;
const PREFERRED = /Wi-?Fi|WLAN|Wireless|Ethernet|^en|^eth|^wl/i;

/** This PC's home-network IPv4 addresses, Wi-Fi and Ethernet first, virtual adapters left out. */
export function lanAddresses() {
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal || !isPrivateIPv4(a.address)) continue;
      found.push({ name, address: a.address, rank: PREFERRED.test(name) ? 0 : 1 });
    }
  }
  return found.sort((a, b) => a.rank - b.rank).map((a) => a.address).slice(0, 4);
}

export function pairLink(pairing, hosts, port) {
  return buildPairLink({
    id: pairing.id,
    key: pairing.key,
    hosts,
    port,
    name: os.hostname().slice(0, 40),
  });
}

/** The link as an SVG QR code, drawn as one path. */
export function qrSvg(text) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  }
  const size = n + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Pairing QR code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ------------------------------------------------------------------ server

/**
 * Starts the LAN listener. `getPairing` is read per request, so making a new
 * key on the page takes effect at once and the old phone is refused.
 */
export function startSyncServer({ pairingFile, receivedDir, host = '0.0.0.0', port = SYNC_PORT, log = console.log }) {
  mkdirSync(receivedDir, { recursive: true });
  let strikes = [];

  const reply = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method !== 'POST' || url.pathname !== SYNC_PATH) return reply(res, 404, { error: 'Not found' });

    // Slow down guessing: after 20 envelopes that don't open in a minute, refuse for a minute.
    const now = Date.now();
    strikes = strikes.filter((t) => t > now - 60_000);
    if (strikes.length >= 20) return reply(res, 429, { error: 'Too many attempts' });

    let size = 0;
    const chunks = [];
    let refused = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_SYNC_BODY) {
        refused = true;
        reply(res, 413, { error: 'Too large' });
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (refused) return;
      const pairing = loadPairing(pairingFile);
      let msg;
      try {
        const env = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        msg = JSON.parse(openNode(pairing.key, pairing.id, 'req', env));
      } catch {
        strikes.push(now);
        return reply(res, 401, { error: 'Not paired' });
      }

      const receivedAt = Date.now();
      try {
        if (msg.type === 'ping') {
          return reply(res, 200, sealNode(pairing.key, pairing.id, 'res', JSON.stringify({ ok: true, type: 'ping', receivedAt })));
        }
        if (msg.type === 'backup' && msg.backup?.format === 'forte-export' && Number.isFinite(msg.backup.exportedAt)) {
          const exportedAt = msg.backup.exportedAt;
          const name = `${RECEIVED_PREFIX}${exportedAt}.json`;
          writeFileSync(path.join(receivedDir, `${name}.tmp`), JSON.stringify(msg.backup));
          renameSync(path.join(receivedDir, `${name}.tmp`), path.join(receivedDir, name));
          prune(receivedDir);
          const sessions = Array.isArray(msg.backup.sessions)
            ? msg.backup.sessions.filter((s) => s.status === 'completed').length
            : null;
          savePairing(pairingFile, { ...pairing, lastReceived: { at: receivedAt, exportedAt, sessions, to: (req.socket.localAddress ?? '').replace(/^::ffff:/, '') } });
          log(`Backup received from the phone (${(size / 1024).toFixed(0)} KB).`);
          return reply(res, 200, sealNode(pairing.key, pairing.id, 'res', JSON.stringify({ ok: true, type: 'backup', exportedAt, receivedAt })));
        }
        return reply(res, 400, { error: 'Unknown message' });
      } catch (error) {
        return reply(res, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    });
  });

  server.listen(port, host, () => log(`Wi-Fi sync listening on ${host}:${port}`));
  server.on('error', (e) => log(`Wi-Fi sync is off: ${e.message}`));
  return server;
}

/** Keeps the newest KEEP received backups; names sort by export time. */
function prune(dir) {
  const files = readdirSync(dir)
    .filter((n) => n.startsWith(RECEIVED_PREFIX) && n.endsWith('.json'))
    .sort((a, b) => Number(b.slice(RECEIVED_PREFIX.length, -5)) - Number(a.slice(RECEIVED_PREFIX.length, -5)));
  for (const old of files.slice(KEEP)) unlinkSync(path.join(dir, old));
}
