import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GIS_CSP_REQUIREMENTS, apiSecurityHeaders } from './security.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Parse public/_headers into [{ pattern, headers: {name: value} }]. */
function parseHeadersFile(text) {
  const rules = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      cur = { pattern: raw.trim(), headers: {} };
      rules.push(cur);
    } else if (cur) {
      const i = raw.indexOf(':');
      cur.headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
    }
  }
  return rules;
}

function parseCsp(csp) {
  const out = {};
  for (const part of csp.split(';')) {
    const [name, ...vals] = part.trim().split(/\s+/);
    if (name) out[name] = vals;
  }
  return out;
}

describe('public/_headers', () => {
  const rules = parseHeadersFile(readFileSync(resolve(root, 'public/_headers'), 'utf8'));
  const all = rules.find((r) => r.pattern === '/*');
  const csp = parseCsp(all.headers['Content-Security-Policy']);

  it('sets the baseline security headers on every path', () => {
    expect(all.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(all.headers['Referrer-Policy']).toBeTruthy();
    expect(all.headers['Permissions-Policy']).toContain('camera=()');
    expect(all.headers['Strict-Transport-Security']).toContain('max-age=');
  });

  it('CSP lets Google Identity Services work (script, frame, connect, style, img)', () => {
    for (const [directive, needed] of Object.entries(GIS_CSP_REQUIREMENTS)) {
      for (const origin of needed) {
        expect(csp[directive], `${directive} must allow ${origin}`).toContain(origin);
      }
    }
    // The task-specified baseline.
    expect(csp['connect-src']).toEqual(expect.arrayContaining(["'self'", 'https://accounts.google.com', 'wss:']));
    expect(csp['style-src']).toEqual(expect.arrayContaining(["'self'", "'unsafe-inline'"]));
    expect(csp['img-src']).toEqual(expect.arrayContaining(["'self'", 'data:']));
  });

  it('CSP is otherwise tight: no unsafe-eval, no wildcard scripts, no framing, no plugins', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['script-src']).not.toContain("'unsafe-eval'");
    expect(csp['script-src'].some((s) => s === '*' || s === 'https:')).toBe(false);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
  });

  it('hashed assets are immutable, the HTML shell is never cached stale', () => {
    expect(rules.find((r) => r.pattern === '/assets/*').headers['Cache-Control']).toContain('immutable');
    expect(rules.find((r) => r.pattern === '/index.html').headers['Cache-Control']).toBe('no-cache');
    expect(rules.find((r) => r.pattern === '/').headers['Cache-Control']).toBe('no-cache');
  });

  it('the production index.html needs no inline script (CSP script-src has no unsafe-inline)', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
    expect(inline).toHaveLength(0);
  });
});

describe('API security headers', () => {
  it('are strict and only add HSTS over https', () => {
    const https = apiSecurityHeaders(true);
    const http = apiSecurityHeaders(false);
    for (const h of [https, http]) {
      expect(h['X-Content-Type-Options']).toBe('nosniff');
      expect(h['Cache-Control']).toBe('no-store');
      expect(h['Content-Security-Policy']).toContain("default-src 'none'");
      expect(h['Referrer-Policy']).toBeTruthy();
    }
    expect(https['Strict-Transport-Security']).toBeTruthy();
    expect(http['Strict-Transport-Security']).toBeUndefined();
  });
});
