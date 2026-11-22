/**
 * Wi-Fi sync to Forte Companion: the parts both ends share.
 *
 * Pure TypeScript with no imports, so the phone, the PC companion
 * (companion/sync.mjs) and the tests all read the same rules.
 *
 * Pairing: the companion shows a QR code holding a `forte://pair?...` link
 * with its LAN addresses, a port, a pairing id and a 256-bit key. Every
 * message after that is sealed with AES-256-GCM under that key, so the
 * key itself is the authentication: anything not sealed with it is refused,
 * and nobody else on the Wi-Fi can read the backup.
 */

export const SYNC_VERSION = 1;
export const SYNC_PORT = 4175;
export const SYNC_PATH = '/forte-sync/v1';
export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;

/** Bound into every seal, so a request can never be replayed as a reply, or across pairings. */
export function aadFor(pairId: string, direction: 'req' | 'res'): string {
  return `forte-sync-v${SYNC_VERSION}:${pairId}:${direction}`;
}

export type Pairing = {
  /** Random id the PC chose; changes when the PC makes a new key. */
  id: string;
  /** base64url, KEY_BYTES long. */
  key: string;
  /** LAN IPv4 addresses, most likely first. */
  hosts: string[];
  port: number;
  /** The PC's name, for display only. */
  name: string;
};

/** Plaintext of a request: a ping to check the line, or a full backup. */
export type SyncRequest =
  | { type: 'ping'; sentAt: number }
  | { type: 'backup'; sentAt: number; backup: { format: 'forte-export'; exportedAt: number } & Record<string, unknown> };

/** Plaintext of the PC's reply. Sealed too, so a stranger can't fake "received". */
export type SyncReply = { ok: true; type: 'ping' | 'backup'; exportedAt?: number; receivedAt: number };

/** On the wire, both ways. */
export type Envelope = { v: number; id: string; n: string; c: string };

/** 10/8, 172.16/12 and 192.168/16: the phone only ever sends to the home network. */
export function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a = 0, b = 0, c = 0, d = 0] = m.slice(1).map(Number);
  if ([a, b, c, d].some((x) => x > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

const B64URL = /^[A-Za-z0-9_-]+$/;

export function buildPairLink(p: Pairing): string {
  const q = [
    `v=${SYNC_VERSION}`,
    `id=${encodeURIComponent(p.id)}`,
    `k=${p.key}`,
    `h=${p.hosts.join(',')}`,
    `p=${p.port}`,
    `n=${encodeURIComponent(p.name)}`,
  ].join('&');
  return `forte://pair?${q}`;
}

/** The query values of a pairing link, from a pasted link or the router's params. */
export function paramsFromLink(text: string): Record<string, string> {
  const at = text.indexOf('?');
  if (at < 0) return {};
  const out: Record<string, string> = {};
  for (const part of text.slice(at + 1).trim().split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    try {
      out[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
    } catch {
      // A broken escape leaves that value out; validation then refuses the link.
    }
  }
  return out;
}

/** Checks a link's values. Returns the pairing, or why it was refused. */
export function parsePairing(q: Record<string, string | string[] | undefined>): Pairing | { error: string } {
  const one = (k: string) => {
    const v = q[k];
    return Array.isArray(v) ? v[0] : v;
  };
  if (one('v') !== String(SYNC_VERSION)) return { error: 'This pairing code is from a different version of Forte Companion.' };
  const id = one('id') ?? '';
  const key = one('k') ?? '';
  const port = Number(one('p'));
  const hosts = (one('h') ?? '').split(',').filter(Boolean);
  const name = (one('n') ?? 'PC').slice(0, 40);
  if (!/^[A-Za-z0-9-]{6,40}$/.test(id)) return { error: 'The pairing code is incomplete.' };
  if (!B64URL.test(key) || base64UrlLength(key) !== KEY_BYTES) return { error: 'The pairing code is incomplete.' };
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return { error: 'The pairing code has no valid port.' };
  if (!hosts.length || hosts.length > 4 || !hosts.every(isPrivateIPv4)) {
    return { error: 'The PC address must be on your home network.' };
  }
  return { id, key, hosts, port, name };
}

function base64UrlLength(s: string): number {
  return Math.floor((s.length * 3) / 4);
}

// ------------------------------------------------------------------ bytes

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 (with padding) — what the envelope carries. */
export function toBase64(bytes: Uint8Array): string {
  const at = (i: number): number => bytes[i] ?? 0;
  const ch = (n: number): string => ALPHABET[n & 63] ?? '';
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (at(i) << 16) | (at(i + 1) << 8) | at(i + 2);
    out += ch(n >> 18) + ch(n >> 12) + ch(n >> 6) + ch(n);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = at(i) << 16;
    out += ch(n >> 18) + ch(n >> 12) + '==';
  } else if (rest === 2) {
    const n = (at(i) << 16) | (at(i + 1) << 8);
    out += ch(n >> 18) + ch(n >> 12) + ch(n >> 6) + '=';
  }
  return out;
}

/** Accepts standard and URL-safe base64, padded or not. */
export function fromBase64(text: string): Uint8Array {
  const s = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(s)) throw new Error('Not base64.');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n =
      (ALPHABET.indexOf(s[i] ?? 'A') << 18) |
      (ALPHABET.indexOf(s[i + 1] ?? 'A') << 12) |
      (ALPHABET.indexOf(s[i + 2] ?? 'A') << 6) |
      ALPHABET.indexOf(s[i + 3] ?? 'A');
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** UTF-8 without TextEncoder/TextDecoder, which Hermes does not fully provide. */
export function utf8Encode(s: string): Uint8Array {
  // At most 3 bytes per UTF-16 unit (a surrogate pair is 2 units for 4 bytes).
  const buf = new Uint8Array(s.length * 3);
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) {
      buf[n++] = c;
    } else if (c < 0x800) {
      buf[n++] = 0xc0 | (c >> 6);
      buf[n++] = 0x80 | (c & 63);
    } else if (c < 0x10000) {
      buf[n++] = 0xe0 | (c >> 12);
      buf[n++] = 0x80 | ((c >> 6) & 63);
      buf[n++] = 0x80 | (c & 63);
    } else {
      buf[n++] = 0xf0 | (c >> 18);
      buf[n++] = 0x80 | ((c >> 12) & 63);
      buf[n++] = 0x80 | ((c >> 6) & 63);
      buf[n++] = 0x80 | (c & 63);
    }
  }
  return buf.slice(0, n);
}

export function utf8Decode(bytes: Uint8Array): string {
  const b = (i: number) => (bytes[i] ?? 0) & 63;
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const x = bytes[i++] ?? 0;
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | b(i++);
    else if (x < 0xf0) c = ((x & 15) << 12) | (b(i++) << 6) | b(i++);
    else c = ((x & 7) << 18) | (b(i++) << 12) | (b(i++) << 6) | b(i++);
    out += String.fromCodePoint(c);
  }
  return out;
}
