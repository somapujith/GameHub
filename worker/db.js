// Neon HTTP driver wrapper. Parameterised queries only: never build SQL from user input.
import { neon } from '@neondatabase/serverless';

const clients = new Map();

/** The HTTP driver does not use libpq-only params; drop them defensively. */
function cleanUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch {
    return url;
  }
}

export function getSql(env) {
  const url = env && env.DATABASE_URL;
  if (!url) throw new HttpError(500, 'Server is not configured (database).');
  let sql = clients.get(url);
  if (!sql) {
    sql = neon(cleanUrl(url));
    clients.set(url, sql);
  }
  return sql;
}

/** Run one parameterised query; resolves to an array of row objects. */
export function query(env, text, params = []) {
  return getSql(env).query(text, params);
}

/**
 * Run several parameterised queries as one non-interactive transaction.
 * `statements` is an array of `[text, params]`. Resolves to an array of row arrays.
 */
export function transaction(env, statements) {
  const sql = getSql(env);
  return sql.transaction((txn) => statements.map(([text, params = []]) => txn.query(text, params)));
}

/** Postgres unique_violation (SQLSTATE 23505), optionally for a given constraint/column. */
export function isUniqueViolation(err, hint) {
  if (!err || err.code !== '23505') return false;
  if (!hint) return true;
  return String(err.constraint || err.detail || err.message || '').includes(hint);
}

/** An error that maps to an HTTP status in the Hono error handler. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
