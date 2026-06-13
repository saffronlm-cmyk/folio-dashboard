# Emma Dashboard — Handoff

_Last updated: 2026-06-13. Read this first when picking the project back up._

---

## 1. TL;DR + status

A working, single-file personal finance dashboard (`index.html`) that reads transactions live from the **Emma** Google Sheet and adds budgeting, savings/net-worth tracking, and a UK income + holiday-pay estimator.

**Done and verified:** Overview, Categories (spend + income), **Wealth** (merged Savings + Investments, 3-level drill-down), **live investment prices** (Yahoo via a Cloudflare Worker), Income estimator, Google Sheets connection, period filtering, mobile layout, mock fallback, localStorage persistence.

**Hosted:** live at `https://saffronlm-cmyk.github.io/folio-dashboard/`.

**Outstanding manual actions (Saffron, on the live site):**
- **OAuth origin** — add `https://saffronlm-cmyk.github.io` to the OAuth client's Authorized JavaScript origins (Google Cloud Console) or Google sign-in fails on the hosted site. (Details in §9.)
- **Verify Yahoo symbols resolve** — on Wealth → Investments, use the holding modal's **Test symbol** button; the least-certain one is `WLDS.L`. Report any ✗.
- **Enter real units + avg cost (GBP)** per holding (seed ships placeholder units).

**Next builds (designs in §8):** (1) Budget estimator tab (§8b), (2) Supabase backend (§8a) — cross-device sync + real T212/Binance positions via API.

> Canonical file: **`index.html`** at the repo root (single file, no build step).

---

## 2. Run locally

```bash
./start.command          # http://localhost:9000/index.html
```

Click **Connect Google Sheets** → sign in (saffronlm@gmail.com). Without sign-in it shows mock data. **Must be port 9000** (OAuth origin).

---

## 3. Architecture

Single HTML file, no build step. Vanilla JS + **Chart.js 4.4** (CDN) + **Google Identity Services** + **Sheets API v4** (read-only scope).

**Data flow:**
```
Connect Google → SheetsAPI.fetchData()
   → SheetsAPI.parse(rows)         // builds RAW_TX = [{date, amount, category, merchant}]
   → computeAndRender()
        → VIEW = CONNECTED ? buildLiveView() : buildMockView()
             → aggregate(start,end)   // groups RAW_TX into catList / incomeList + totals
        → renderOverview() / renderCatRows() / renderRecurring() / renderExcluded()
```

**Key building blocks (search these names in `index.html`):**
- `Store` — storage abstraction (`Store.get/set/remove`) over localStorage, namespaced `emmaDash:`. **All persisted data goes through this** so the backend can be swapped (→ Supabase) without touching feature code.
- `RAW_TX` — parsed transactions. Positive amount = income, negative = spend.
- `excluded(cat)` — `/exclud|transfer/i`; drops transfers/excluded from all totals.
- `aggregate(start,end)` — returns `{catList, incomeList, totalSpend, totalIncome, excludedTotal, excludedCount}`.
- `buildLiveView()` / `buildMockView()` — produce the unified `VIEW` object the renderers consume. **Mock fallback must always keep working** (it's the offline/demo state).
- Period model: `payPeriod(offset)` (anchored on the **20th**), `rangeFor(sel)`, `prevRangeFor(sel)`. `CUR = {mode, offset}` holds the current selection.
- `CAT_MODE` (`'spend'|'income'`) — Categories tab toggle. `activeCats()/activeTotal()/activeNoun()` pick the right list.
- `classOf(name)` + `CATEGORY_CLASS` — fixed vs variable classification (Store-persisted, keyword fallback).
- `makeDonut(canvas, center, legend, cats, total, noun)` — generic donut+legend builder (reused for category, fixed, variable, and net-worth donuts).
- `recalc()` — income estimator math; writes `LAST_INCOME`, persists inputs via `saveIncomeInputs()`.
- Chart instances are module-level (`CHART_LINE/DONUT/HIST/NW/FIXED/VAR`); each renderer destroys before recreating.

---

## 4. Features built

**Overview** — 3 hero KPIs (Income · Spending · **Est. income next period** with a ↑/↓ vs-last-period flag); spend-over-time line (this vs last period); period comparison block; category breakdown cards (with last-period value + MoM%).

**Categories** — **Spending/Income** toggle. Spending mode shows **two donuts (Fixed + Variable)**; income mode shows one. Category/Merchant sub-toggle, drill-down (6-period history + average line + transactions), recurring-payment detection, and an "Excluded this period" line.

**Income estimator** — FOH (**hours/month** × rate), DA (**shifts × editable day rate**), pooled PAYE tax, **pension net-pay model**, grand total (net + cash), **monthly "save as target"**, and the **Holiday Pay estimator** (quick calc + editable payslip log, 13 payslips pre-loaded).

**Wealth** (merged Savings + Investments) — single tab, **3-level drill-down** driven by `WEALTH_VIEW = {level, group, account}`:
- **Level 0 (landing):** total net worth + **three donuts** — whole net worth by *type* (`renderTypeDonut`), Savings accounts, Investment accounts (`renderGroupDonut`, coloured by `PALETTE`) — then two clickable **type cards** (Savings / Investments).
- **Level 1 (type → accounts):** that group's accounts with add/edit/delete + group KPIs. Investment (holdings) cards drill in; savings/pension cards edit/delete inline.
- **Level 2 (investment account → holdings):** scoped KPIs + **Trading-212-style treemap** (`chartjs-chart-treemap`, tiles by £ value, ticker + %, green/red P/L) + holdings table; Edit/Delete-account buttons in the header.

**Grouping** (`GROUP`): Savings = Cash ISA + Savings/HYSA · Investments = S&S ISA + GIA + Crypto + Pension. **Holdings-type** accounts (`HOLDINGS_TYPES` = investment/gia/crypto) get their value from holdings (`accountValue()` = Σ units×price, balance fields hidden in the modal); Pension stays a manual balance. Holdings persist in `HOLDINGS` (Store key `holdings`, keyed by account name; seeded defaults double as demo state). Donuts/treemap render lazily on tab switch (need a sized container).

---

## 5. Data sources & secrets

- **Emma sheet:** ID `1qfrUT7DuC7nMeHT6ZZANR83CfJrVLpFNVbEYzBLbF98`, tab `Primary`. Columns: `Date, Amount, Account, Category, Merchant, Counterparty, Additional details`. `Amount` is signed (− = spend, + = income).
- **OAuth client ID:** `185610168060-4bc8vffjh14krk2hg7gq0m8r0gl4mgd4.apps.googleusercontent.com` (reused from the old Folio dashboard; registered for `http://localhost:9000`).
- Client IDs are public by design. The sheet ID is low-risk (reading still needs Saffron's Google login). For hosting, prefer a private repo or accept the app code being public (no financial data is in it).

---

## 6. Decisions log

- **DA pay:** `shifts × day rate`. Day rate is an **editable input pre-filled at £266.60** (derived from "5 shifts = £1,333"). **Verify against the next payslip** — it's higher than the £200 originally guessed.
- **Pension:** net-pay arrangement. Income tax on `gross − pension`; **NI on full gross**; pension = **5% of qualifying earnings** (`gross − £6,240/yr`). Editable %.
- **FOH:** entered as **hours/month** (from the rota planner), not per week.
- **Savings withdrawals** (e.g. funding a holiday): re-tag as **`Transfer` in Emma** → auto-excluded from income; the purchase still counts as spend.
- **Fixed categories:** Bills, Groceries, Transport, Subscriptions. Everything else = Variable.
- **Storage:** local-only for now; chosen direction = **host now, Supabase later** (skip Google Sheets write-back).

---

## 7. Known gotchas

- **localStorage is per-origin _including port_** (`localhost:9000` ≠ `localhost:9001`) and **per-device/browser**. This is why edits don't follow you across machines — solved only by the hosting + Supabase step.
- Console **"A listener indicated an asynchronous response… message channel closed"** errors are from a **browser extension**, not this app. Ignore them.
- Chart.js donuts need a **visible container on first paint**; they render fine after a tab switch (the container gains size). Not a bug.
- Income estimator inputs are now persisted via `Store` (`incomeInputs`) — they survive reloads. Accounts (`accounts`), targets (`incomeTargets`), and category classes (`categoryClass`) are likewise persisted.

---

## 8. Roadmap — full designs for the next builds

### 8a. Storage / hosting (do first)
1. **Host the static file** — GitHub Pages (root) or Netlify drag-drop. Gives a URL → works on phone.
2. **Add the hosted origin** to the OAuth client's Authorized JavaScript origins (Google Cloud Console) or sign-in fails.
3. **Supabase later** (already available): tables `accounts`, `holdings`, `budget_targets`, `income_inputs`, `monthly_targets`; add auth; **swap only the `Store` adapter** (`Store.get/set` → Supabase calls). Optional: manifest + service worker → installable PWA.

### 8b. Budget estimator tab
- **Auto-estimate** per category = **median of the last 3–6 pay periods** (median resists one-off spikes). Needs Emma connected.
- **Override** per category (typed target), persisted via `Store` (`budgetTargets`); no override → use auto-estimate.
- **Surface it:** progress bars (spent vs budget) per category, total budget vs total spend, and a **run-rate forecast** (projected end-of-period spend at current pace). Add over/under-budget flags to the category cards.

### 8c. Investments — now part of the Wealth tab (§4)
- **Model:** `HOLDINGS[account] = [{ticker, name, symbol, priceMode, units, avgCost, lastPrice, currency}]`. `lastPrice` is always **GBP**; `accountValue()` = Σ(units × lastPrice) → net worth.
- **Phase 1 (manual): ✅ DONE.** Holdings-type accounts = `investment`/`gia`/`crypto`. Treemap via `chartjs-chart-treemap@3.1.0` (CDN).
- **Phase 2 (live prices): ✅ DONE.** Written fresh (the Folio reference file was never added).
  - **Proxy:** `cloudflare-worker/yfin-proxy.js` deployed at `https://yfin.saffronlm.workers.dev/?s=` (in `CONFIG.PRICE_PROXY`). Browsers can't call Yahoo directly (CORS); the Worker fetches server-side with a UA and returns JSON+CORS. Yahoo-only allowlist.
  - **`Prices` module:** fetches `v8/finance/chart` per symbol, parses `meta.regularMarketPrice`/`chartPreviousClose`/`currency`. **GBp→/100**, **USD/EUR→GBP** via `GBPUSD=X`/`GBPEUR=X`. Writes GBP price + `dayPct` onto each live holding. **5-min cache** in `Store('priceCache')`. Refreshes on Wealth-tab open (if stale) + manual ⟳ button.
  - **UI:** holding modal has **Yahoo symbol + Live/Manual + Test** button; price bar shows portfolio Today% + "as of HH:MM" + Refresh; per-holding day-change and live/stale/manual dot.
  - **Seed:** Trading 212 (VUAG.L/SEMI.L/VHVE.L/WLDS.L/EIMI.L) + Binance (BTC/SOL/ADA/ETH(BETH)/XRP/DOGE `-GBP`), placeholder units — Saffron enters real units/avg-cost (GBP) in-app (never committed).
  - **Still manual:** Trading 212 / Binance **positions** (need API keys → Supabase backend later); crypto **prices** track via Yahoo `-GBP`. Smart Pension fully manual.

---

## 9. Resume steps (next session)

**First, the outstanding manual actions (see §1):**
1. **OAuth (console, do once):** Google Cloud Console → APIs & Services → Credentials → OAuth client `185610168060-…` → **Authorized JavaScript origins** → add `https://saffronlm-cmyk.github.io` (keep `http://localhost:9000`). If "Access blocked", add `saffronlm@gmail.com` under OAuth consent screen → Test users. Then Connect Google Sheets on the hosted site and confirm live Emma data loads.
2. **Verify live prices** on the hosted site: Wealth → Investments → Trading 212 should populate prices; use **Test symbol** to confirm each (esp. `WLDS.L`). Enter real units + avg cost (GBP). Note: hosted origin has its own localStorage — if it shows old demo holdings instead of the Trading 212 + Binance seed, edit them or clear that origin's storage to reseed (a one-time migration could be added instead).

**Then the next build — pick one:**
3. **Budget estimator tab (§8b)** — highest-value remaining feature; reuses `aggregate()` over the last 3–6 pay periods (median) + `Store('budgetTargets')` overrides + run-rate forecast. Slots into the existing tab/period model; keep the mock fallback working.
4. **Supabase backend (§8a)** — swap the `Store` adapter for cross-device sync; also unlocks real Trading 212 / Binance **positions** via API (keys live server-side in an edge function — never in `index.html`).

---

## 10. Related
- `cloudflare-worker/yfin-proxy.js` — **in this repo.** The deployed Yahoo price proxy (`https://yfin.saffronlm.workers.dev`); redeploy from here if the Worker is ever lost. Referenced by `CONFIG.PRICE_PROXY`.
- `../folio/emma_to_folio_sync.gs` — Apps Script syncing Emma → the old Folio spreadsheet (separate system, not in this repo).
- `../folio/Folio_Dashboard.html` — the older Folio dashboard (not in this repo). Was meant to be the live-price source for §8c but never got added, so Phase 2 was written fresh.
- Full design history: `~/.claude/plans/how-far-am-i-deep-goblet.md`.
