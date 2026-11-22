import { gcm } from '@noble/ciphers/aes';
import {
  aadFor,
  fromBase64,
  KEY_BYTES,
  NONCE_BYTES,
  SYNC_VERSION,
  toBase64,
  utf8Decode,
  utf8Encode,
  type Envelope,
} from './link.ts';

/**
 * AES-256-GCM in pure JavaScript (@noble/ciphers, audited), so the phone needs
 * no native crypto beyond a source of random bytes. The PC opens the same
 * envelopes with Node's built-in crypto (companion/sync.mjs); the tests check
 * the two against each other.
 *
 * `nonce` must be 12 fresh random bytes for every seal: GCM is only safe while
 * a nonce is never reused under the same key.
 */
export function seal(
  keyB64: string,
  pairId: string,
  direction: 'req' | 'res',
  plaintext: string,
  nonce: Uint8Array,
): Envelope {
  const key = fromBase64(keyB64);
  if (key.length !== KEY_BYTES || nonce.length !== NONCE_BYTES) throw new Error('Bad key or nonce.');
  const sealed = gcm(key, nonce, utf8Encode(aadFor(pairId, direction))).encrypt(utf8Encode(plaintext));
  return { v: SYNC_VERSION, id: pairId, n: toBase64(nonce), c: toBase64(sealed) };
}

/** Throws when the envelope was not sealed with this key, for this pairing and direction. */
export function open(keyB64: string, pairId: string, direction: 'req' | 'res', env: Envelope): string {
  if (env?.v !== SYNC_VERSION || env.id !== pairId) throw new Error('Not from this pairing.');
  const key = fromBase64(keyB64);
  const nonce = fromBase64(env.n);
  if (nonce.length !== NONCE_BYTES) throw new Error('Bad nonce.');
  const plain = gcm(key, nonce, utf8Encode(aadFor(pairId, direction))).decrypt(fromBase64(env.c));
  return utf8Decode(plain);
}
