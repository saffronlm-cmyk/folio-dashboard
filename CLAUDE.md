# CLAUDE.md — Emma Dashboard

Guidance for Claude Code working in **this repo** (the Emma Dashboard web app). For full status, architecture, decisions, and the build roadmap, read **HANDOFF.md** first.

## What this is
A single-file personal finance web app (`index.html`) that reads transactions live from Saffron's Emma Google Sheet and adds budgeting, savings/net-worth tracking, and a UK income + holiday-pay estimator. Personal project; goal is to grow it into a hosted app she can use from any device.

## Stack & constraints
- **One file, no build step**: everything lives in `index.html` (HTML + CSS + JS).
- Vanilla JS only. **Chart.js 4.4 from CDN**; Google Identity Services + **Sheets API v4 (read-only)**.
- Keep it framework-free and dependency-light — don't introduce a bundler/npm unless explicitly asked.

## Run & verify
- Serve on **port 9000** (OAuth origin): `./start.command` or `python3 -m http.server 9000`, open `http://localhost:9000/index.html`.
- Use the preview/browser tools to verify: reload, check the console (ignore browser-extension "message channel closed" noise), screenshot the changed tab. The app shows **mock data** when not signed in — use that to verify UI without needing Google auth.
- Don't ask Saffron to manually test; verify in the browser and show proof.

## Conventions (match these)
- **Persist everything through `Store`** (`Store.get/set/remove`, namespaced `emmaDash:`). Never call `localStorage` directly in feature code — the whole point is to swap the adapter for Supabase later.
- **View-builder pattern:** data → `aggregate()` → `buildLiveView()/buildMockView()` → `VIEW` → renderers. Add new derived data to the view builders, not ad-hoc in renderers.
- **Keep the mock fallback working** for every feature (it's the offline/demo state and how the UI is verified).
- **Reuse `makeDonut()`** for any new donut; **periods** always go through `rangeFor()`/`payPeriod()` (anchored on the 20th).
- **Design tokens:** CSS variables at the top — bg `#FAF7F5`, sidebar `#3D3229`, accent `#D4A69A`, positive `#7BA68A`, negative `#C47A6E`, font Inter. Reuse them; don't hardcode new colours.
- Charts are module-level instances; **destroy before recreating** to avoid leaks.

## Guardrails
- **Never commit personal financial data.** `.gitignore` blocks `*.xlsx/*.csv/*.pdf`, `Bank_Statements/`, `Payslips/`. Don't add real balances/transactions to the repo.
- `index.html` holds the Emma sheet ID + OAuth client ID (low-risk / public by design) — fine to keep, but don't add new secrets/tokens to client-side code.

## Roadmap (next builds — see HANDOFF.md §8 for full designs)
1. Hosting (GitHub Pages/Netlify) + add the hosted origin to the OAuth client; Supabase backend later.
2. Budget estimator tab (median-of-past-periods auto-budget + overrides + forecast).
3. Investments portfolio tab (holdings model; live prices via Yahoo/Trading 212 — pattern exists in `../folio/Folio_Dashboard.html`).
