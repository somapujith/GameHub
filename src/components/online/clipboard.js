import { useCallback, useEffect, useRef, useState } from 'react';

/** Copy text. Uses the async clipboard API, falls back to a hidden textarea. Resolves true on success. */
export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* permission denied / insecure context: fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}

export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Native share sheet when available, otherwise copy `text` (+ url) to the clipboard.
 * Resolves 'shared' | 'copied' | 'cancelled' | 'failed'.
 */
export async function shareOrCopy({ title, text, url }) {
  if (canShare()) {
    try {
      await navigator.share(url ? { title, text, url } : { title, text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      /* share failed for another reason: fall back to copying */
    }
  }
  const ok = await copyText(url ? `${text}\n${url}` : text);
  return ok ? 'copied' : 'failed';
}

/** `const [copied, copy] = useCopied(); await copy(text)` — `copied` is true for ~1.8 s afterwards. */
export function useCopied(ms = 1800) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(
    async (text) => {
      const ok = await copyText(text);
      if (ok) {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), ms);
      }
      return ok;
    },
    [ms],
  );
  return [copied, copy];
}
