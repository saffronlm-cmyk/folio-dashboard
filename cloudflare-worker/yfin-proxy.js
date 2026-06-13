/**
 * yfin-proxy — Cloudflare Worker
 * ------------------------------------------------------------------
 * Tiny CORS proxy for Yahoo Finance, used by the Emma Dashboard to pull
 * live prices. Browsers can't call Yahoo directly (no CORS headers), so
 * this fetches server-side, sets a User-Agent Yahoo accepts, and returns
 * the JSON with CORS headers your app can read.
 *
 * It ONLY proxies Yahoo's chart endpoint — it can't be used as a general
 * open proxy.
 *
 * ── Deploy (~5 min, free) ─────────────────────────────────────────
 *   1. cloudflare.com → sign in → Workers & Pages → Create → Worker.
 *   2. Name it (e.g. "yfin") → Deploy → Edit code.
 *   3. Replace the default code with THIS FILE → Save and deploy.
 *   4. Copy the URL it gives you, e.g. https://yfin.<you>.workers.dev
 *      → send that to me; it goes into CONFIG.PRICE_PROXY in index.html.
 *
 * ── Use ───────────────────────────────────────────────────────────
 *   GET https://yfin.<you>.workers.dev/?s=VUAG.L
 *   GET https://yfin.<you>.workers.dev/?s=GBPUSD=X   (FX)
 *   GET https://yfin.<you>.workers.dev/?s=BTC-GBP    (crypto)
 *   → returns Yahoo's v8 chart JSON (meta has regularMarketPrice,
 *     previousClose, currency, etc.)
 *
 * ── Optional hardening ────────────────────────────────────────────
 *   Lock CORS to your site: set ALLOW_ORIGIN below to
 *   'https://saffronlm-cmyk.github.io' instead of '*'.
 */

const ALLOW_ORIGIN = '*'; // or 'https://saffronlm-cmyk.github.io'
const YAHOO_HOST = 'query1.finance.yahoo.com';

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') {
      return json({ error: 'method not allowed' }, 405, cors);
    }

    const url = new URL(request.url);
    const symbol = (url.searchParams.get('s') || '').trim();
    if (!symbol) return json({ error: 'missing ?s=SYMBOL' }, 400, cors);

    // Basic symbol sanity: letters, digits, . - = ^ only (covers VUAG.L, BTC-GBP, GBPUSD=X, ^FTSE)
    if (!/^[A-Za-z0-9.\-=^]{1,20}$/.test(symbol)) {
      return json({ error: 'invalid symbol' }, 400, cors);
    }

    const target = `https://${YAHOO_HOST}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

    try {
      const r = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      const body = await r.text();
      return new Response(body, {
        status: r.status,
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      });
    } catch (err) {
      return json({ error: 'upstream fetch failed', detail: String(err) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
