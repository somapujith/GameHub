import { describe, it, expect } from 'vitest';
import {
  CODE_ALPHABET,
  newRoomCode,
  newFriendCode,
  randomCode,
  normalizeRoomCode,
  normalizeFriendCode,
} from './codes.js';

describe('code generation', () => {
  it('uses the unambiguous alphabet (no 0, O, 1, I)', () => {
    expect(CODE_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    expect(CODE_ALPHABET).toHaveLength(32);
    for (const bad of ['0', 'O', '1', 'I']) expect(CODE_ALPHABET).not.toContain(bad);
  });

  it('room codes are 6 chars from the alphabet', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(newRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('friend codes look like HYD-XXXX', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(newFriendCode()).toMatch(/^HYD-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });

  it('is not trivially repetitive and covers the whole alphabet', () => {
    const seen = new Set();
    const codes = new Set();
    for (let i = 0; i < 400; i += 1) {
      const c = randomCode(6);
      codes.add(c);
      for (const ch of c) seen.add(ch);
    }
    expect(codes.size).toBeGreaterThan(395);
    expect(seen.size).toBe(32);
  });
});

describe('code normalisation', () => {
  it('uppercases and trims room codes, rejects bad ones', () => {
    expect(normalizeRoomCode(' abcd23 ')).toBe('ABCD23');
    expect(normalizeRoomCode('ABCD2')).toBeNull(); // too short
    expect(normalizeRoomCode('ABCD234')).toBeNull(); // too long
    expect(normalizeRoomCode('ABCD0O')).toBeNull(); // ambiguous chars
    expect(normalizeRoomCode('AB-D23')).toBeNull();
    expect(normalizeRoomCode(null)).toBeNull();
    expect(normalizeRoomCode(123456)).toBeNull();
    expect(normalizeRoomCode({ toString: () => 'ABCD23' })).toBeNull();
  });

  it('accepts friend codes with or without the prefix', () => {
    expect(normalizeFriendCode('HYD-7K2Q')).toBe('HYD-7K2Q');
    expect(normalizeFriendCode('hyd-7k2q')).toBe('HYD-7K2Q');
    expect(normalizeFriendCode(' 7k2q ')).toBe('HYD-7K2Q');
    expect(normalizeFriendCode('hyd7k2q')).toBe('HYD-7K2Q');
    expect(normalizeFriendCode('HYD-7K2')).toBeNull();
    expect(normalizeFriendCode('HYD-7K2QQ')).toBeNull();
    expect(normalizeFriendCode('HYD-7K20')).toBeNull(); // 0 is not in the alphabet
    expect(normalizeFriendCode('')).toBeNull();
    expect(normalizeFriendCode(undefined)).toBeNull();
  });
});
