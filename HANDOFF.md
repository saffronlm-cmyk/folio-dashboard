# Emma Dashboard — Handoff

_Last updated: 2026-06-13. Read this first when picking the project back up._

---

## 1. TL;DR + status

A working, single-file personal finance dashboard (`index.html`) that reads transactions live from the **Emma** Google Sheet and adds budgeting, savings/net-worth tracking, and a UK income + holiday-pay estimator.

**Done and verified:** Overview, Categories (spend + income), **Wealth** (merged Savings + Investments, 3-level drill-down), **live investment prices** (Yahoo via a Cloudflare Worker), Income estimator, Google Sheets connection, period filtering, mobile layout, mock fallback, localStorage persistence.

**Hosted:** live at `https://saffronlm-cmyk.github.io/folio-dashboard/`.

**Status of earlier manual actions (as of 2026-06-14):**
- **OAuth origin** — ✅ **confirmed working** (Connect on the hosted site loads Emma data). The hosted origin is registered on the OAuth client.
- **Cross-device holdings** — ✅ **now synced** via Supabase (below). Real units/avg-cost no longer stranded on one device.

**✅ DONE & VERIFIED: Supabase backend / cross-device sync (§8a)** — merged (PR #6) + **end-to-end verified 2026-06-14**: signed in on two devices, real holdings (722.9 total units across T212 + Binance) pulled from `public.user_data` on the second device. KV-mirror of `Store` → `public.user_data`; single Google login via Supabase OAuth provides both identity and the Sheets read token. Manual setup done: Google provider enabled in Supabase, callback redirect URI added to OAuth client `185610168060-…`.
- **Gotcha hit during setup (resolved):** the Supabase callback redirect URI must live on the OAuth client *in the project whose number matches the client-ID prefix* (`185610168060`); it was first added in the wrong project → `redirect_uri_mismatch`.
- **Second gotcha:** signing in without granting the Sheets permission yields a 403 "insufficient scopes" on the live read. Hardened (PR follow-up `claude/sheets-scope-reauth-ic4476`): a scope/401 error now clears the token and re-prompts consent instead of silently retrying.

**Next build (design in §8b):** **Budget estimator tab** — see §9 for the lined-up plan.

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
3. **Supabase** (in progress, branch `claude/oauth-connect-handoff-ic4476`): **chosen design = KV-mirror**, not the normalized tables originally sketched here. One table `public.user_data (user_id, key, value jsonb)` mirrors the existing `Store` keys 1:1 → least code, trivial RLS, fastest to working sync; the app was already architected around a KV `Store`. Normalized `accounts`/`holdings` tables can come later when server-side T212/Binance **position** writes need them. Auth = single Google login via Supabase OAuth (see §9). Optional later: manifest + service worker → installable PWA.

### 8b. Budget estimator tab — canonical design (planned 2026-06-14)

**Tab placement & period model.** New `Budget` tab between Categories and Wealth (`switchTab('budget')` → `renderBudget()`, page `#tab-budget`). The budget is a **per-pay-period** figure (monthly cadence, anchored on the 20th), so the tab **ignores the global period bar** (Weekly/Monthly/Quarterly/Yearly don't map onto a monthly budget) and carries its **own `‹ this period ›` stepper** over pay-period offsets — same way Wealth/Income already ignore the bar. Default = current in-progress period; step back to review past periods' outcomes.

**Auto-estimate (core).** Per spend category, budget = **median of that category's total spend across the last 6 completed pay periods** (skip the current in-progress one). Reuses the `aggregate(payPeriod(i))` loop already in `catDetail()` (`i = 1..6`).
- **Count £0 for absent categories** — a category present in 3 of 6 periods gives `[0,0,0,x,y,z]`, not `[x,y,z]`. Omitting zeros inflates every budget; including them makes the budget reflect a *typical* month. (Most important correctness choice.)
- **Median not mean** — resists one-off spikes; for near-constant fixed categories median ≈ the recurring amount anyway.
- Thin history → use as many completed periods as exist (min 1); under 2 → "set targets manually" empty state. Round to nearest **£5**.
- **Category set shown** = *(categories with any history)* ∪ *(this period's categories)* so occasional/quarterly bills still appear with their budget.
- Computed once per data load in a `computeBudgets()` helper → `{name → {auto, target}}` where `target = override ?? auto` (independent of which period is being viewed).

**Overrides.** Per-category typed target → `Store('budgetTargets')[name]`; ghost hint shows `auto £x`; **↺ reset** removes the key (→ back to auto). Stored key present (incl. explicit £0) = override in use; cleared = auto. **Add `'budgetTargets'` to `Store.SYNC_KEYS`** (KV table already holds arbitrary keys — no schema change).

**Surfaced view.**
- **Safe-to-spend headline:** `(Est. income − Σ fixed commitments − Σ variable budget remaining) / days_left` → "£X/day safe to spend · N days left". Variable remaining = Σ `max(budget − spent, 0)`; fixed commitments use `max(spent, budget)` so unpaid bills still reserve cash. Clamp ≥£0 (over-committed → "£0/day — over by £Z" in `--negative`). Past period → show that period's actual outcome, not a forward £/day.
- **KPI strip:** Total budgeted · Spent so far · Projected end-of-period · Left to budget vs **Est. income** (`LAST_INCOME.grandTotal`) → light zero-based feel.
- **Total progress bar** with a **pace marker** (vertical tick at `elapsed_fraction × budget` = "where you should be today") + days left.
- **Fixed & Variable grouped sections** (reuse `classOf()`, mirrors the Categories donuts): per-row icon · `£spent / £budget` · progress bar (under `--positive`, ≥85% `--accent`, over `--negative`, capped fill + overflow shown) · pace tick · override input · subtotal per section.
- **Unbudgeted callout:** category with spend this period but no history/budget → "new — set a budget?".

**Run-rate forecast (subtle).** Naïve `spent/elapsed` breaks on fixed (rent on day 1 → projects rent×15). So: **variable** → `spent / elapsed_fraction` (clamped; suppressed while `elapsed < ~10%`); **fixed** → `max(spent, budget)`. Total projected = Σ per-category projections. `elapsed_fraction = clamp((now−start)/(end−start),0,1)`.

**Cross-tab flags (§8b ask).** `buildLiveView()/buildMockView()` attach `budget` + `overUnder` per cat (from `computeBudgets()`); `renderCatGrid()/renderCatRows()` show a `£20 under` / `£35 over` badge — **only when the global bar is on Pay Period (or Monthly)** (monthly budget vs a week's spend would mislead).

**Mock parity.** `buildMockView` computes medians from `HIST_MOCK` (already 6 months/category) → fully working offline; this is how the tab is verified in-browser.

**New functions:** `computeBudgets()`, `budgetPeriodState(offset)`, `renderBudget()`, `saveBudgetTarget()/resetBudgetTarget()`; budget data attached in the view builders; flags in the two cat renderers.

**Edge cases:** thin/no history · new categories · disappeared categories (0% bar, budget kept) · transfers excluded (via `aggregate`) · income categories ignored · elapsed→0 suppression · explicit £0 vs blank · mobile numeric inputs.

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

**OAuth origin:** ✅ confirmed working on the hosted site — no action needed.
**Supabase cross-device sync (§8a):** ✅ **done & verified 2026-06-14** — merged (PR #6) + a 403-scope re-auth hardening follow-up. No outstanding setup. (Architecture recap lives in §8a + §1.)

### ✅ Done — Budget estimator tab (§8b)

Merged (PRs #8–#10, 2026-06-14). Full canonical design lives in **§8b**. **Shipped:** Core + **Safe-to-spend headline** — own pay-period stepper, median auto-budgets (zeros counted, last 6 periods), overrides (`budgetTargets` → `SYNC_KEYS`), Fixed/Variable rows with progress bars + pace marker, run-rate forecast (variable-only extrapolation), total-vs-income KPI strip, over/under flags on the Categories cards, full mock parity via `HIST_MOCK`. Follow-ups: re-render Budget tab when live data loads (#9); `canonCat()` category-alias layer merging e.g. Public Transport → Transport (#10).

### Roadmap after Budget (agreed order)
1. **Insights strip** — rules engine over `VIEW` + budgets (templated plain-English: over/under, on-track-to-save, spike-vs-median). Cheap once budgets exist.
2. **Savings goals** — named goal + target + date, progress from a chosen account; on-brand with the holiday-pay theme.
3. **Net worth over time** — auto-snapshot `netWorthTotal()` once per pay period into a synced Store key → trend line + monthly delta on Wealth. The one structural add (gives the snapshot-only app history).
4. **Upcoming bills calendar** — project next ~30 days from `detectRecurring()`'s day-of-month; pairs with safe-to-spend.

---

## 10. Related
- `cloudflare-worker/yfin-proxy.js` — **in this repo.** The deployed Yahoo price proxy (`https://yfin.saffronlm.workers.dev`); redeploy from here if the Worker is ever lost. Referenced by `CONFIG.PRICE_PROXY`.
- `../folio/emma_to_folio_sync.gs` — Apps Script syncing Emma → the old Folio spreadsheet (separate system, not in this repo).
- `../folio/Folio_Dashboard.html` — the older Folio dashboard (not in this repo). Was meant to be the live-price source for §8c but never got added, so Phase 2 was written fresh.
- Full design history: `~/.claude/plans/how-far-am-i-deep-goblet.md`.
