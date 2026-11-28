/*
 * Public-folder asset URLs that work at any deploy location: the dev server ('/'), a root domain
 * ('/'), GitHub Pages under a sub-path ('/One-Warm-Spot/') or a relative build (base './').
 */

/** Vite's base for this build; '/' outside Vite (e.g. Playwright helpers importing scene data) */
const BUILD_BASE: string = import.meta.env?.BASE_URL ?? '/';

/** Already-complete URLs pass through untouched */
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * Resolve a `public/` path such as `/source/props/prop-firepit.webp` against the deploy base:
 * `'/'` → `/source/…`, `'./'` → `./source/…`, `'/One-Warm-Spot/'` → `/One-Warm-Spot/source/…`.
 * `http(s):`, `data:`, `blob:` and protocol-relative URLs are returned as-is.
 */
export function assetUrl(path: string, base: string = BUILD_BASE): string {
  if (ABSOLUTE_URL.test(path)) return path;
  const prefix = !base ? '/' : base.endsWith('/') ? base : `${base}/`;
  return prefix + path.replace(/^\.?\/+/, '');
}
