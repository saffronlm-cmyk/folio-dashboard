# Emma Dashboard — Handoff

_Last updated: 2026-06-12. Read this first when picking the project back up._

---

## 1. TL;DR + status

A working, single-file personal finance dashboard (`index.html`) that reads transactions live from the **Emma** Google Sheet and adds budgeting, savings/net-worth tracking, and a UK income + holiday-pay estimator.

**Done and verified:** Overview, Categories (spend + income), Savings, Income estimator, Google Sheets connection, period filtering, mock fallback, localStorage persistence.

**Next builds (designs in §8):** (1) hosting + Supabase, (2) Budget estimator tab, (3) Investments portfolio tab.

> The canonical file is now `emma-dashboard/index.html`. The previous working copy at `../folio/Emma_Dashboard.html` is **legacy** — don't edit it.

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

**Savings** — manual accounts (add/edit/delete, Store-persisted), type badges incl. **SmartPension** & **Binance/crypto**, net-worth total + MoM change, and a **net-worth breakdown donut** coloured by type.

**Income estimator** — FOH (**hours/month** × rate), DA (**shifts × editable day rate**), pooled PAYE tax, **pension net-pay model**, grand total (net + cash), **monthly "save as target"**, and the **Holiday Pay estimator** (quick calc + editable payslip log, 13 payslips pre-loaded).

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

### 8c. Investments portfolio tab
- **Model:** `account → holdings[] {ticker, name, units, avgCost, lastPrice, currency}` (Store-persisted). Account value = Σ(units × price) → feeds the net-worth donut.
- **Phase 1 (manual):** add holdings per investment account; show units, price, value, gain/loss vs avg cost; allocation donut.
- **Phase 2 (live prices):**
  - ETFs/stocks (ISA, GIA) → **Yahoo Finance** via CORS proxy. **The exact pattern (incl. GBX→GBP + 5-min cache) already exists in `../folio/Folio_Dashboard.html`** — lift it from there.
  - **Trading 212** → official API with an API key; can pull actual positions, not just prices.
  - **Binance** → API or manual.
  - **Smart Pension** → no public API; stays manual.

---

## 9. Resume steps (next session)

1. `git init` in this folder, commit, push to the new GitHub repo.
2. Enable Pages (or Netlify) → get the live URL.
3. Add the live URL to the OAuth client's authorized origins.
4. Open the hosted site, Connect Google Sheets, verify live Emma data loads.
5. Start **8b (Budget tab)** — it's the highest-value next feature and reuses existing aggregation.

---

## 10. Related (not in this repo)
- `../folio/emma_to_folio_sync.gs` — Apps Script syncing Emma → the old Folio spreadsheet (separate system).
- `../folio/Folio_Dashboard.html` — the older Folio-spreadsheet dashboard; source of the live-price code for §8c.
- Full design history: `~/.claude/plans/how-far-am-i-deep-goblet.md`.
