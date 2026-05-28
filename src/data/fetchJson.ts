/**
 * Shared JSON fetch utility — verifies the response is actually JSON
 * before parsing.
 *
 * Vite's dev server (and many SPA-mode static hosts) serves `index.html`
 * with HTTP 200 OK for unknown paths, including missing `/data/*.json`.
 * Without a content-type check, `r.json()` blows up on the HTML body
 * with `SyntaxError: Unexpected token '<'`. See bug_hunt_2026-05-22.md (B1).
 */

export function isJsonResponse(r: Response): boolean {
  if (!r.ok) return false;
  const ct = r.headers.get('content-type') ?? '';
  return ct.includes('application/json');
}

/** Throws on non-OK or non-JSON responses. */
export async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new Error(`Expected JSON for ${url} but got ${ct || '(no content-type)'} — likely SPA fallback for missing file`);
  }
  return (await r.json()) as T;
}

/** Returns null on any failure (HTTP error, non-JSON body, parse error, network error). */
export async function fetchJsonOrNull<T>(url: string): Promise<T | null> {
  try {
    return await fetchJson<T>(url);
  } catch {
    return null;
  }
}
