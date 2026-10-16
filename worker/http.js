// Small HTTP helpers shared by the route modules.
import { HttpError } from './db.js';

export const MAX_BODY_BYTES = 16 * 1024;

/**
 * Read a request body as text, refusing anything over `limit` bytes. Works for chunked
 * uploads too (no Content-Length): the stream is cancelled as soon as the cap is crossed,
 * so an oversized body is never buffered in full.
 */
export async function readBodyText(request, limit = MAX_BODY_BYTES) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > limit) throw new HttpError(413, 'Request body too large.');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        throw new HttpError(413, 'Request body too large.');
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'Could not read request body.');
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Parse a JSON object body (<= 16 KB). Empty body -> {}. Throws HttpError(400/413). */
export async function readJson(c) {
  const text = await readBodyText(c.req.raw);
  if (!text.trim()) return {};
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Body must be a JSON object.');
  return data;
}
