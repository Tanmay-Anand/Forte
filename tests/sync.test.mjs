// Wi-Fi sync: the phone's sealing (noble, src/features/sync/seal.ts) against
// the PC's (Node crypto, companion/sync.mjs), the pairing-link rules, and one
// real send through the companion's listener.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildPairLink,
  fromBase64,
  isPrivateIPv4,
  paramsFromLink,
  parsePairing,
  SYNC_PATH,
  toBase64,
  utf8Decode,
  utf8Encode,
} from '../src/features/sync/link.ts';
import { open, seal } from '../src/features/sync/seal.ts';
import { loadPairing, openNode, qrSvg, sealNode, startSyncServer } from '../companion/sync.mjs';

const key = randomBytes(32).toString('base64url');
const id = 'pairTest01';
const nonce = () => new Uint8Array(randomBytes(12));

test('text survives UTF-8 and base64 both ways, including Hindi and emoji', () => {
  const text = 'Bench 40×5 → drop 25×8 · घुटने में दर्द 💪 "quoted"';
  assert.equal(utf8Decode(utf8Encode(text)), text);
  assert.deepEqual([...utf8Encode(text)], [...Buffer.from(text, 'utf8')]);
  for (const n of [0, 1, 2, 3, 31, 32, 1000]) {
    const bytes = new Uint8Array(randomBytes(n));
    assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'));
    assert.deepEqual([...fromBase64(toBase64(bytes))], [...bytes]);
  }
  assert.deepEqual([...fromBase64(key)], [...Buffer.from(key, 'base64url')]);
});

test('what the phone seals, the PC opens, and the reverse', () => {
  const msg = JSON.stringify({ type: 'ping', sentAt: 1, note: 'घुटने 💪' });
  assert.equal(openNode(key, id, 'req', seal(key, id, 'req', msg, nonce())), msg);
  assert.equal(open(key, id, 'res', sealNode(key, id, 'res', msg)), msg);
});

test('a seal opens only with the same key, pairing and direction, untouched', () => {
  const env = seal(key, id, 'req', 'hello', nonce());
  assert.throws(() => openNode(randomBytes(32).toString('base64url'), id, 'req', env));
  assert.throws(() => openNode(key, 'otherPair1', 'req', { ...env, id: 'otherPair1' }));
  // A request can't be bounced back to the phone as the PC's reply.
  assert.throws(() => open(key, id, 'res', env));
  const bytes = Buffer.from(env.c, 'base64');
  bytes[0] ^= 1;
  assert.throws(() => openNode(key, id, 'req', { ...env, c: bytes.toString('base64') }));
});

test('pairing links: built, read back, and refused when unsafe', () => {
  const p = { id, key, hosts: ['192.168.1.20', '10.0.2.2'], port: 4175, name: 'Desk PC' };
  const parsed = parsePairing(paramsFromLink(buildPairLink(p)));
  assert.deepEqual(parsed, p);

  const bad = (over) => parsePairing(paramsFromLink(buildPairLink({ ...p, ...over })));
  assert.ok('error' in bad({ hosts: ['8.8.8.8'] }), 'a public address is refused');
  assert.ok('error' in bad({ hosts: ['192.168.1.20', 'evil.example.com'] }), 'a name is refused');
  assert.ok('error' in bad({ key: key.slice(0, 20) }), 'a short key is refused');
  assert.ok('error' in bad({ port: 80 }), 'a system port is refused');
  assert.ok('error' in parsePairing({ ...paramsFromLink(buildPairLink(p)), v: '2' }), 'another version is refused');

  assert.ok(isPrivateIPv4('172.16.0.1') && isPrivateIPv4('172.31.255.255'));
  assert.ok(!isPrivateIPv4('172.32.0.1') && !isPrivateIPv4('127.0.0.1') && !isPrivateIPv4('192.168.1.300'));
});

test('the QR code is an SVG the page can show', () => {
  const svg = qrSvg(buildPairLink({ id, key, hosts: ['192.168.1.20'], port: 4175, name: 'PC' }));
  assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ \d+"/);
  assert.ok(svg.includes('<path d="M'));
});

test('end to end: the listener stores a sealed backup and confirms it, and refuses strangers', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'forte-sync-'));
  const pairingFile = path.join(dir, 'pairing.json');
  const receivedDir = path.join(dir, 'received');
  const pairing = loadPairing(pairingFile);
  const server = startSyncServer({ pairingFile, receivedDir, host: '127.0.0.1', port: 0, log: () => {} });
  await new Promise((r) => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}${SYNC_PATH}`;
  const post = (body) => fetch(url, { method: 'POST', body: JSON.stringify(body) });

  try {
    const backup = { format: 'forte-export', schemaVersion: 3, exportedAt: 1_790_000_000_000, sessions: [{ status: 'completed' }, { status: 'active' }] };
    const res = await post(seal(pairing.key, pairing.id, 'req', JSON.stringify({ type: 'backup', sentAt: 1, backup }), nonce()));
    assert.equal(res.status, 200);
    const reply = JSON.parse(open(pairing.key, pairing.id, 'res', await res.json()));
    assert.equal(reply.ok, true);
    assert.equal(reply.exportedAt, backup.exportedAt);

    const files = readdirSync(receivedDir);
    assert.deepEqual(files, [`forte-backup-sync-${backup.exportedAt}.json`]);
    assert.deepEqual(JSON.parse(readFileSync(path.join(receivedDir, files[0]), 'utf8')), backup);
    const saved = JSON.parse(readFileSync(pairingFile, 'utf8'));
    assert.equal(saved.lastReceived.sessions, 1);
    assert.equal(saved.lastReceived.to, '127.0.0.1');

    // Sending the same backup again overwrites itself rather than piling up.
    await post(seal(pairing.key, pairing.id, 'req', JSON.stringify({ type: 'backup', sentAt: 2, backup }), nonce()));
    assert.equal(readdirSync(receivedDir).length, 1);

    // Wrong key: refused, nothing written.
    const stranger = randomBytes(32).toString('base64url');
    const r2 = await post(seal(stranger, pairing.id, 'req', JSON.stringify({ type: 'backup', sentAt: 3, backup: { ...backup, exportedAt: 1 } }), nonce()));
    assert.equal(r2.status, 401);
    assert.equal(readdirSync(receivedDir).length, 1);

    // A new key on the PC locks out the old one at once.
    loadPairing(pairingFile, { fresh: true });
    const r3 = await post(seal(pairing.key, pairing.id, 'req', JSON.stringify({ type: 'ping', sentAt: 4 }), nonce()));
    assert.equal(r3.status, 401);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
