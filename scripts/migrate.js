// Applies db/schema.sql to the Neon database. Additive + idempotent only: CREATE ... IF NOT EXISTS,
// ADD COLUMN IF NOT EXISTS, and the one-time `INSERT INTO user_game_stats ... ON CONFLICT DO NOTHING`
// backfill. Anything else is refused (this script may run against the production database).
//
//   node scripts/migrate.js
//
// DATABASE_URL is read from process.env, falling back to the git-ignored `.dev.vars`
// file. The connection string is never printed; only table names and row counts are.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Parse a dotenv-style file into an object (no interpolation, quotes stripped). */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = resolve(root, '.dev.vars');
  if (existsSync(file)) {
    const vars = parseEnvFile(readFileSync(file, 'utf8'));
    if (vars.DATABASE_URL) return vars.DATABASE_URL;
  }
  return null;
}

/** The HTTP driver only needs host/user/password/db; drop libpq-only params that could confuse it. */
export function cleanConnectionString(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch {
    return url;
  }
}

/** Split a SQL file into statements (strips `--` comments; no dollar-quoting support needed). */
export function splitStatements(sqlText) {
  const noComments = sqlText
    .split(/\r?\n/)
    .map((l) => {
      const i = l.indexOf('--');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
  return noComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

const TABLES = ['users', 'friendships', 'matches', 'match_players', 'user_game_stats', 'rooms'];

/**
 * The safety net: true only for statements that can be repeated without changing or losing data.
 * The single data statement allowed is the user_game_stats backfill, which never overwrites a row.
 */
export function isAdditiveStatement(stmt) {
  return (
    /^CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\b/i.test(stmt) ||
    /^ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/i.test(stmt) ||
    /^INSERT\s+INTO\s+user_game_stats\b[\s\S]*\bON\s+CONFLICT\s*\([^)]*\)\s*DO\s+NOTHING$/i.test(stmt)
  );
}

async function main() {
  const url = loadDatabaseUrl();
  if (!url) {
    console.error('DATABASE_URL not found (set it in the environment or in .dev.vars).');
    process.exit(1);
  }
  const sql = neon(cleanConnectionString(url));
  const statements = splitStatements(readFileSync(resolve(root, 'db/schema.sql'), 'utf8'));

  let n = 0;
  for (const stmt of statements) {
    // Safety net: this script must only ever run additive, idempotent statements.
    if (!isAdditiveStatement(stmt)) {
      throw new Error(`Refusing to run non-idempotent statement #${n + 1}: ${stmt.slice(0, 40)}...`);
    }
    await sql.query(stmt);
    n += 1;
  }
  console.log(`Applied ${n} statements from db/schema.sql.`);

  const existing = await sql.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1) ORDER BY table_name`,
    [TABLES],
  );
  const found = new Set(existing.map((r) => r.table_name));
  for (const t of TABLES) {
    if (!found.has(t)) {
      console.log(`  ${t}: MISSING`);
      process.exitCode = 1;
      continue;
    }
    // Table names come from the constant list above (not user input).
    const [{ count }] = await sql.query(`SELECT count(*)::int AS count FROM ${t}`);
    console.log(`  ${t}: ${count} rows`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // Never echo connection details: print only the message class.
    const msg = err && err.code ? `${err.code} ${err.message}` : err?.message || String(err);
    console.error('Migration failed:', msg.replace(/postgres(ql)?:\/\/\S+/gi, '<redacted>'));
    process.exit(1);
  });
}
