// The migration runs against the production database: db/schema.sql must stay additive and
// idempotent, and the runner must refuse anything else.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { splitStatements, isAdditiveStatement, cleanConnectionString } from '../scripts/migrate.js';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = splitStatements(schema);

describe('db/schema.sql', () => {
  it('every statement passes the additive-only safety net', () => {
    expect(statements.length).toBeGreaterThan(20);
    for (const s of statements) expect(isAdditiveStatement(s), s.slice(0, 80)).toBe(true);
  });

  it('never drops, truncates, renames or deletes', () => {
    // (foreign keys legitimately say ON DELETE CASCADE / SET NULL)
    const sql = statements.join(';\n').replace(/ON DELETE (CASCADE|SET NULL)/gi, '');
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE|RENAME)\b/i);
    expect(sql).not.toMatch(/\bALTER\s+COLUMN\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
  });

  it('has the marketplace tables, columns and indexes', () => {
    const has = (re) => expect(statements.some((s) => re.test(s)), String(re)).toBe(true);
    has(/^ALTER TABLE matches ADD COLUMN IF NOT EXISTS game_id text NOT NULL DEFAULT 'hyderabad-tycoon'/);
    has(/^CREATE INDEX IF NOT EXISTS matches_game_idx\s+ON matches \(game_id, ended_at DESC\)/);
    has(/^CREATE TABLE IF NOT EXISTS user_game_stats \([\s\S]*PRIMARY KEY \(user_id, game_id\)/);
    has(/user_id\s+uuid NOT NULL REFERENCES users \(id\) ON DELETE CASCADE/);
    has(/^CREATE TABLE IF NOT EXISTS rooms \([\s\S]*code\s+text PRIMARY KEY/);
    has(/^CREATE INDEX IF NOT EXISTS rooms_listing_idx\s+ON rooms \(visibility, status, game_id, updated_at DESC\)/);
    // the backfill never overwrites an existing row
    has(/^INSERT INTO user_game_stats[\s\S]*ON CONFLICT \(user_id, game_id\) DO NOTHING$/);
  });

  it('statements are separated by semicolons the runner can split on (no procedural blocks)', () => {
    expect(schema).not.toMatch(/\$\$/);
    for (const s of statements) expect(s).not.toMatch(/;/);
  });
});

describe('isAdditiveStatement', () => {
  it('accepts the idempotent forms', () => {
    for (const ok of [
      'CREATE TABLE IF NOT EXISTS t (id int)',
      'create unique index if not exists i on t (id)',
      'ALTER TABLE t ADD COLUMN IF NOT EXISTS c int NOT NULL DEFAULT 0',
      'INSERT INTO user_game_stats (user_id, game_id) SELECT id, $$x$$ FROM users ON CONFLICT (user_id, game_id) DO NOTHING',
    ]) {
      expect(isAdditiveStatement(ok), ok).toBe(true);
    }
  });

  it('refuses everything that could change or lose data', () => {
    for (const bad of [
      'DROP TABLE users',
      'TRUNCATE matches',
      'DELETE FROM users',
      'UPDATE users SET xp = 0',
      'ALTER TABLE users DROP COLUMN email',
      'ALTER TABLE users RENAME TO people',
      'ALTER TABLE users ALTER COLUMN xp TYPE bigint',
      'CREATE TABLE users (id int)',
      'CREATE INDEX i ON t (id)',
      'INSERT INTO users (name) VALUES (\'x\')',
      'INSERT INTO user_game_stats (user_id) SELECT id FROM users',
      'INSERT INTO user_game_stats (user_id) SELECT id FROM users ON CONFLICT (user_id, game_id) DO UPDATE SET games = 0',
      'INSERT INTO matches (id) SELECT id FROM matches ON CONFLICT (id) DO NOTHING',
    ]) {
      expect(isAdditiveStatement(bad), bad).toBe(false);
    }
  });

  it('cleanConnectionString drops libpq-only params', () => {
    expect(cleanConnectionString('postgresql://u:p@h/db?sslmode=require&channel_binding=require')).toBe('postgresql://u:p@h/db?sslmode=require');
  });
});
