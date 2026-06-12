# Emma Dashboard

A personal finance dashboard that reads transactions directly from my **Emma** Google Sheet and layers on budgeting, savings/net-worth tracking, and a UK income + holiday-pay estimator. Single self-contained `index.html` — no build step, no framework. Chart.js from CDN, Google Sheets API v4 (read-only).

---

## Run locally

OAuth blocks the `file://` protocol, so it must be served over HTTP:

```bash
./start.command          # serves on http://localhost:9000/index.html and opens the browser
# or:
python3 -m http.server 9000
```

Then click **Connect Google Sheets** and sign in. Without sign-in it runs on built-in mock data so the UI is always populated.

> **Port matters.** The Google OAuth client is registered for `http://localhost:9000`. Use port **9000** locally or sign-in will fail.

---

## Deploy (so it works on your phone / any device)

The dashboard is a static file, so any static host works. Two easy options:

**GitHub Pages**
1. Push this folder to a GitHub repo.
2. Repo → **Settings → Pages** → Source: `main` branch, `/ (root)` → Save.
3. Your site appears at `https://<username>.github.io/<repo>/`.

**Netlify** — drag this folder onto <https://app.netlify.com/drop> (lets you keep the source private while the site is public).

### ⚠️ Required after hosting: add the OAuth origin
Once hosted, sign-in will fail until you whitelist the new URL:
- Google Cloud Console → **APIs & Services → Credentials** → the OAuth 2.0 Client ID
- **Authorized JavaScript origins** → add your hosted origin, e.g. `https://<username>.github.io`
- Save (can take a few minutes to propagate).

---

## Privacy

- **No financial data lives in this repo** — transactions are read live from Google Sheets at runtime; balances/targets are stored in your browser (localStorage).
- `index.html` does contain the Emma **spreadsheet ID** and the **OAuth client ID**. Client IDs are public by design; the spreadsheet ID is low-risk (reading it still requires *your* Google login). If you'd rather it stay private, use a **private repo** (Netlify keeps source private even on the free tier).
- `.gitignore` blocks `*.xlsx`, `*.csv`, `*.pdf`, `Bank_Statements/`, `Payslips/` as a safety net.

---

## What's inside

- `index.html` — the whole app.
- `start.command` — local launcher (port 9000).
- `HANDOFF.md` — full status, architecture, decisions, and the roadmap for the next builds. **Start here when picking the project back up.**
- `CLAUDE.md` — guidance for Claude Code when working in this repo.
- `docs/` — reference material (original holiday-pay estimator).

## Tech
Vanilla HTML/CSS/JS · Chart.js 4.4 (CDN) · Google Identity Services + Sheets API v4 (read-only) · localStorage (migrating to Supabase later).
