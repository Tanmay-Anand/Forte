/**
 * Sortable, collision-resistant ids without a dependency.
 * Time prefix keeps rows roughly insertion-ordered in the b-tree.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomPart(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function newId(prefix = ''): string {
  const t = Date.now().toString(36);
  return `${prefix}${t}${randomPart(8)}`;
}
