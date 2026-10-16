// Room codes: 6 characters from an alphabet without 0/O/1/I (same shape the server issues).
export const CODE_LENGTH = 6;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALLOWED = new Set(ALPHABET);

/** Reduce typed or pasted text (even a whole invite link) to at most 6 valid code characters, uppercase. */
export function normalizeCode(raw) {
  let s = String(raw ?? '').trim();
  if (/^https?:\/\//i.test(s) || s.includes('/')) {
    s = s.split(/[?#]/)[0].replace(/\/+$/, '');
    s = s.slice(s.lastIndexOf('/') + 1);
  }
  let out = '';
  for (const ch of s.toUpperCase()) {
    if (ALLOWED.has(ch)) out += ch;
    if (out.length >= CODE_LENGTH) break;
  }
  return out;
}

export const isCode = (code) => typeof code === 'string' && code.length === CODE_LENGTH && [...code].every((c) => ALLOWED.has(c));
