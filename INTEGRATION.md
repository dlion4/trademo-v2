# tradeMO — Frontend Data Layer & Backend Integration Guide

Implemented Pages:

- **Page H-1: Landing (`/`)** — Multi-asset crowdfunding trade pools overview, live ticker, live execution console, performance stats, 4-step process, early-access waitlist capture.
- **Page H-2: Features (`/features`)** — Deep dive into 5 core modules (Quant Execution Engine, Algorithmic Strategy Sandbox, Crowdfunding Pools, AI Guardian Protection, Multi-Asset Coverage) with interactive widgets and operator vs investor capability matrix.
- **Page H-3: Pricing & Investor Fee Tiers (`/pricing`)** — Capital management tiers (<$10k, $10k-$100k, >$100k), interactive multi-factor investment return calculator, fee matrix, High-Water Mark guarantee, and comprehensive investor FAQ.

## Stack & Architecture

| Concern        | Choice                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| UI Framework   | Next.js 16 App Router (React 19)                                                                                       |
| Theme & Style  | **Light Mode Default** (`data-bs-theme="light"`), **Bootstrap 5.3.8** + design tokens + **page-scoped leak-proof CSS** |
| Data Layer     | **TanStack Query v5** (`QueryClientProvider` in `src/app/providers.tsx`)                                               |
| Database & ORM | PostgreSQL + Drizzle ORM (schema in `src/db/schema.ts`, lazy seed + bundled fallback)                                  |

## CSS Architecture (Page-Scoped & Leak-Proof)

```
src/app/globals.css            ← Global imports (tokens, base, app-shell, page stylesheets)
src/styles/theme/tokens.css    ← Design tokens, semantic colors (--win, --loss), light/dark bridge
src/styles/base.css            ← Typography, hairlines, buttons, badges, keyframes (chart-draw, icon-draw)
src/styles/app-shell.css       ← Sticky navigation, brand mark, mobile drawer, footer
src/styles/pages/landing.css   ← Scoped strictly under .page-landing
src/styles/pages/features.css  ← Scoped strictly under .page-features
src/styles/pages/pricing.css   ← Scoped strictly under .page-pricing
```

## Data Contracts & API Endpoints

### 1. Landing Page (H-1)

- `GET /api/landing` -> `LandingContentDTO` (hero, stats, features, steps, trustBadges, ticker)
- `GET /api/market/ticker` -> `TickerFeedDTO` (live multi-asset prices & sparklines)
- `POST /api/waitlist` -> `WaitlistSignupResponseDTO` (captures leads with role selection)

### 2. Features Page (H-2)

- `GET /api/features` -> `FeaturesContentDTO` (hero, 5 modules with discriminated union `demo`, matrix)
- Module Demo kinds: `botEngine`, `scriptEngine`, `pools`, `guardian`, `markets`

### 3. Pricing Page (H-3)

- `GET /api/pricing` -> `PricingContentDTO` (hero, tiers, assetClasses, feeComparison, faqs, cta)
- **Capital Tiers**:
  - **Starter Backer (< $10,000 USD)**: 20% Performance Fee, 1.5% Annual Management Fee, Bi-weekly settlement.
  - **Prime Growth ($10,000 – $100,000 USD)**: 15% Performance Fee (25% discount), 1.0% Annual Management Fee, Weekly settlement.
  - **Institutional (> $100,000 USD)**: 10% Performance Fee (50% discount), 0.5% Annual Management Fee, Daily settlement & on-demand payout.
- **Interactive Investment Return Calculator**:
  - Calculates gross profit, prorated management fees, performance fee platform cut, net investor return ($ and %), total maturity balance, and annualized run-rate across 6 asset classes and durations (15 to 180 days).

## Database Tables (`src/db/schema.ts`)

- `landing_sections`, `landing_stats`, `ticker_instruments`, `platform_features`, `how_it_works_steps`, `trust_badges`, `waitlist_signups`
- `features_sections`, `feature_modules`, `feature_matrix_rows`
- `pricing_sections`, `pricing_tiers`, `pool_asset_classes`, `pricing_faqs`

All tables are seeded automatically and lazily on first access, with graceful fallback to bundled static data if the database is resetting.

---

## Auth Pages (A-1 → A-8)

| Page                    | Route                                                           | Component                                           | Stylesheet (root class)                 |
| ----------------------- | --------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------- |
| A-1 Sign Up             | `/auth/signup?role=&ref=`                                       | `components/auth/signup/signup-page.tsx`            | `auth-signup.css` (`.page-auth-signup`) |
| A-2 Sign In             | `/auth/signin?reset=success\|verified=1\|session=expired&next=` | `components/auth/signin/signin-page.tsx`            | `auth-signin.css` (`.page-auth-signin`) |
| A-3 Investor Onboarding | `/auth/onboarding/investor?step=1..4`                           | `components/auth/onboarding/onboarding-page.tsx`    | `auth-onboarding-investor.css`          |
| A-4 Forgot Password     | `/auth/forgot-password?email=`                                  | `components/auth/password/forgot-password-page.tsx` | `auth-forgot-password.css`              |
| A-5 Reset Password      | `/auth/reset-password?token=`                                   | `components/auth/password/reset-password-page.tsx`  | `auth-reset-password.css`               |
| A-6 Verify Email        | `/auth/verify-email?token=` or `?sent=true&email=`              | `components/auth/verify/verify-email-page.tsx`      | `auth-verify-email.css`                 |
| A-7 Two-Factor          | `/auth/2fa?challengeId=`                                        | `components/auth/two-factor/two-factor-page.tsx`    | `auth-2fa.css`                          |
| A-8 Deriv Callback      | `/auth/deriv/callback?code=&acct1=&state=` (or `?error=`)       | `components/auth/deriv/deriv-callback-page.tsx`     | `auth-deriv-callback.css`               |

Shared auth primitives live in `src/components/auth/*` and `src/styles/components/auth.css`.

### Integration layers (swap order)

1. **Contracts** — `src/lib/auth/types.ts` (request/response DTOs, 1:1 with tradeMO.md §5).
2. **Validation** — `src/lib/auth/schemas.ts` (Zod; reused by TanStack Form on the client and route handlers on the server).
3. **Transport** — `src/lib/api/auth.ts` (`authEndpoints` map + `authApi`). Set `NEXT_PUBLIC_API_BASE_URL` to the Express gateway to bypass the mocks. Errors surface as `AuthApiError { status, code, details }` using the spec's error codes (`INVALID_CREDENTIALS`, `2FA_LOCKED`, `STATE_MISMATCH`, …).
4. **Server state** — `src/lib/queries/use-auth.ts` (TanStack Query mutations/queries).
5. **Mock backend** — `src/app/api/auth/*`, `src/app/api/kyc/*` → `src/server/services/auth-mock-service.ts` (in-memory). Delete when the real API is live.

### Endpoints (mocked, spec-shaped)

`POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/forgot-password` · `GET|POST /api/auth/reset-password` · `GET /api/auth/verify-email` · `POST /api/auth/verify-email/resend` · `POST /api/auth/2fa/verify` · `POST /api/auth/2fa/resend` · `GET /api/auth/deriv/authorize` · `POST /api/auth/deriv/connect` · `GET /api/auth/onboarding/investor` · `POST /api/kyc/upload` · `POST /api/kyc/submit`

### Demo affordances (mock only)

- Sign in with password `Demo1234!`: `operator@trademo.io` → `/dashboard`, `investor@trademo.io` → `/investor`, `both@trademo.io` → workspace picker, `2fa@trademo.io` → `/auth/2fa`. 5 failed attempts → lockout.
- 2FA: TOTP `482917`, backup code `K7M9P2X4`.
- Sign-up: `taken@…` emails return `EMAIL_TAKEN`.
- Reset / verify tokens: under 20 chars → invalid, containing `expired` → expired.
- Deriv callback: `state=mismatch`, `code=expired`, `acct1=CR000000` (already linked), `error=access_denied`.

---

## Operator Console Shell & Page D-1 (`/dashboard`)

### Implemented Shell & Page Scope

- **Operator Shell (`src/components/dashboard/shell/operator-shell.tsx` + `src/styles/components/operator-shell.css`)**:
  - Collapsible 252px → 72px desktop left rail + mobile offcanvas navigation across all 15 Operator routes (`D-1` → `D-15`).
  - Sticky top desk header with `⌘K` Command Palette trigger, Deriv live ticker chips, active Deriv WebSocket session switcher (`CR123456` Real / `VRTC904412` Demo), Risk Drawdown pill, Notifications drawer badge, Right-Side Inspector Drawer toggle, Light/Dark theme switch (Light default), and Operator session menu.
  - **Right-Side Slide-Over Drawer (`right-drawer.tsx`)**: Contextual inspector for any clicked Trade, Schedule, Pool Package, or Investor row + 4 live tabs (`Live Stream`, `Bots`, `Queue`, `Alerts`).
  - **Bottom Onscreen Quick-Action Bar (`bottom-quick-dock.tsx`)**: Collapsible viewport footer with live session P&L, next schedule countdown, and 7 quick triggers opening modals, multi-step wizards, the right drawer, and routes.
- **Page D-1 — Command Center Overview (`/dashboard`, `src/styles/pages/dashboard-command-center.css` scoped under `.page-dashboard-command-center`)**:
  1. **Operator KPI Strip**: 6 animated `useCountUp` cards (`Total Capital $156,000`, `Active Investors 38`, `Total Profit +$18,240`, `Scheduled Today 8`, `Trades Today 47`, `Pending Payouts 4 · $720`).
  2. **14-Day Syndicate Equity Curve & Active Crowdfunding Pools (`PKG-01..PKG-04`)**: Interactive SVG NAV & daily P&L curve (`7D / 14D` toggle, hover crosshair) + active syndicate pool cards.
  3. **Last Settled Trades Blotter (`@tanstack/react-table` v9)**: Sortable, filterable blotter (`Last 5` / `Show 10`, `All / Wins / Losses`), row flash on execution, mobile card collapse (`< md`), click-to-inspect in Right Drawer, and settlement receipt modal.
  4. **Upcoming Scheduled Trades Queue**: Live ticking `Next in: 23m 14s` countdown, inline `Run Now` & `Pause/Resume` actions, and schedule wizard launcher.
  5. **Funds Flow & Investor Watch**: 2-column institutional layout with pool margin allocation bar, inline pending deposit verification, and a second `@tanstack/react-table` v9 Investor Roster with KYC status & dossier inspection.
  6. **Profit Distribution Waterfall**: High-Water Mark 80/20 split progress bar (`80% distributed`), per-pool breakdown ledger, one-click batch settlement, and 3-Step Waterfall Wizard.
  7. **Desk Quick Actions Matrix**: 8 instant workflow launchers.

### 18 Interactive Modals & Multi-Step Wizards (`src/components/dashboard/modals/*`)

1. `new-package-wizard` (4-Step Crowdfunding Pool Builder → `POST /api/packages`)
2. `schedule-wizard` (3-Step Trade Sequence Scheduler → `POST /api/schedules`)
3. `distribute-wizard` (3-Step Profit Waterfall Settlement → `POST /api/packages/distribute-pending`)
4. `payout-batch-wizard` (3-Step Investor Withdrawal Release → `POST /api/payouts`)
5. `bot-deploy-wizard` (3-Step Bot Runner Pre-Flight & Launch → `POST /api/bots`)
6. `quick-trade` (Instant Deriv Contract Order Ticket → `POST /api/trades/buy`)
7. `deriv-connection` (Deriv WS Account Switcher & OAuth Link → `POST /api/connections`)
8. `announce-broadcast` (Multi-channel Investor Update Composer → `POST /api/comms/announcements`)
9. `kyc-review` (Investor Identity & AML Queue → `POST /api/investors`)
10. `deposit-verify` (Incoming Wire / USDT / M-Pesa Verification → `POST /api/deposits`)
11. `capital-rebalance` (Active Margin vs Reserve Allocation → `POST /api/dashboard/rebalance`)
12. `risk-guardrails` (Daily Loss, Drawdown & Streak Circuit Breakers → `POST /api/dashboard/risk`)
13. `emergency-halt` (Desk Kill-Switch / Resume Switch → `POST /api/bots`)
14. `trade-detail` (Deriv Contract Receipt, JSON Copy & Repeat Order)
15. `investor-ledger` (Individual Backer Slot & Earnings Dossier)
16. `export-reports` (Real Browser Download of `.csv` / `.json` Statements)
17. `command-palette` (`⌘K` Keyboard-First Global Desk Search)
18. `operator-session` (Operator Security, API Key Copy & Role Switcher)

---

## Page D-2 · Trade Scheduler (`/dashboard/schedules`)

### Architecture & Page-Scoped Stylesheet Contract

- **Route**: `src/app/dashboard/schedules/page.tsx` → `SchedulesPage` wrapped in `<OperatorShell rootClass="page-dashboard-schedules">`.
- **Stylesheet**: `src/styles/pages/dashboard-schedules.css` — 100% strictly scoped under `.page-dashboard-schedules` (Light Mode default, zero decorative gradients, full `[data-bs-theme="dark"]` token parity, responsive `< md` card-collapsed tables, and `prefers-reduced-motion` support).
- **TanStack Integration**:
  - **TanStack Query v5** (`src/lib/queries/use-schedules.ts`): `useSchedulerBundle(year, month)` + 8 mutations invalidating `["schedules"]` and `["dashboard"]` in lockstep.
  - **TanStack Table v9** (`useDeskTable` / `createDeskColumnHelper`): Powers Section 3 (`ScheduledTradesTableSection` with multi-row selection, column sorting, search, 4 filter dimensions, bulk toolbar, CSV export, and pagination), Section 5 (`PackageTradeMappingSection`), and Section 6 (`SchedulePerformanceHistorySection`).
  - **TanStack Form v1 + Zod v4** (`src/lib/schedules/schemas.ts`): Powers Section 4 (`InlineNewScheduleComposer`) with auto-suggested naming, live Deriv quote preview, quick stake pills, package `%` allocation splits, cron presets, and inline pre-flight overlap detection.

### Implemented Sections (7 Spec Sections + KPI Strip + Launcher Grid)

1. **Top 6 Animated KPI Strip**: `Scheduled Today`, `Active Sequences`, `Committed Stake`, `30-Day Net P&L`, `Pool Capital Mapped`, and `Pre-Flight Checks`.
2. **Section 7 — Live Pre-Flight Conflicts & Guardrail Checks**: Real-time overlap, weekend FX market closure, and reserve multiple scanner with one-click auto-remediation (`Shift +Xm`, `Switch to Weekdays`, `Trim Stake`) and operator override.
3. **Section 1 — Interactive 7×6 Month Calendar + Selected Day Agenda Panel**: Month switcher (`Prev / Today / Next`), pool filter (`All / PKG-01 / PKG-02 / PKG-03`), weekday vs 24/7 synthetic weekend badges, and live day agenda panel.
4. **Section 2 — Intraday Horizontal UTC Timeline (`06:00 → 22:00 UTC`)**: Multi-lane pool track (`PKG-01..PKG-03` or `Unified Track`), pulsing `14:24 UTC` desk time needle, and clickable execution blocks with live fill progress (`4/6`).
5. **Section 3 — Scheduled Trade List (`TanStack Table`)**: Sortable, multi-filterable sequence table with row actions (`Run Now`, `Edit`, `Skip`, `Duplicate`, `Delete`), bulk operations bar, and Right-Drawer inspection.
6. **Section 4 — Inline New Schedule Composer (`TanStack Form`)**: Single/range dates, UTC times, searchable Deriv symbols with live quotes, 7 strategy engines, `$0.35–$70` quick stakes, package `%` split sliders, cron presets, risk caps, `[Save Schedule]`, and `[Save & Run Now]`.
7. **Section 5 — Package-to-Schedule Capital Mapping (`TanStack Table`)**: Pro-rata capital share bar + pool schedule attribution table + `[Rebalance Allocations]`.
8. **Section 6 — 30-Day Schedule Performance History (`TanStack Table`)**: Completed run blotter with win rates, 80/20 waterfall math, contract breakdown modal, and `/dashboard/trades?schedule=...` drill-down.

### 16 Dedicated Scheduler Modals & Multi-Step Wizards (`src/components/dashboard/schedules/*`)

_(On top of the 18 shared Operator Console modals/wizards = **34 interactive overlays** across `/dashboard/schedules`, Right-Side Inspector Drawer, and Persistent Bottom Quick-Action Dock)_

1. `SCH-WIZ-01` · `MasterScheduleWizard` (4-Step Sequence Builder)
2. `SCH-WIZ-02` · `CronRecurrenceWizard` (3-Step UTC Cron & Next-5-Runs Studio)
3. `SCH-WIZ-03` · `BacktestStressWizard` (3-Step 30-Day Tick Replay & Drawdown Simulator)
4. `SCH-WIZ-04` · `BatchCloneDayWizard` (3-Step Multi-Day Lineup Cloner)
5. `SCH-WIZ-05` · `ConflictResolverWizard` (3-Step Pre-Flight Overlap & FX Weekend Resolver)
6. `SCH-WIZ-06` · `PoolProrataWizard` (3-Step Pro-Rata Pool Split Rebalancer)
7. `SCH-MOD-07` · `TimelineBlockDetailModal` (Live Fill Progress & Window Execution Controls)
8. `SCH-MOD-08` · `EditScheduleModal` (Full Sequence Parameter Editor)
9. `SCH-MOD-09` · `DuplicateScheduleModal` (Time-Shifted Sequence Cloner)
10. `SCH-MOD-10` · `SkipBlackoutGuardModal` (Single Window Skip + Macro NFP/CPI/FOMC Blackout Manager)
11. `SCH-MOD-11` · `BulkScheduleOpsModal` (Batch Run / Pause / Skip / Shift +30m / Pool Assign)
12. `SCH-MOD-12` · `StrategyLibraryModal` (7-Strategy Progression Curve Reference & Preset Loader)
13. `SCH-MOD-13` · `HistoryRunDrilldownModal` (Settled Deriv Contract IDs & 80/20 Waterfall Receipt)
14. `SCH-MOD-14` · `GuardrailCooldownPolicyModal` (Stop-Loss, Take-Profit & Streak Cooldown Policy)
15. `SCH-MOD-15` · `ApiPayloadInspectorModal` (Copyable `POST /api/schedules` DTO JSON & Endpoints)
16. `SCH-MOD-16` · `DeleteScheduleConfirmModal` (Guarded Sequence Unschedule Confirmation)

### Backend Handoff Contracts & Database Tables

- **DTOs & Schemas**: `src/lib/schedules/types.ts`, `src/lib/schedules/schemas.ts`
- **API Transport**: `src/lib/api/schedules.ts` (`GET|POST|PATCH|DELETE /api/schedules`, `POST /api/schedules/conflicts`, `POST /api/schedules/rebalance`, `POST /api/schedules/blackouts`, `POST /api/schedules/clone-day`)
- **Drizzle PostgreSQL Schema (`src/db/schema.ts`)**: `trading_schedules`, `schedule_runs`, `schedule_blackouts`

---

## Page D-3 · Live Trading (`/dashboard/live`)

- Reuses the existing `OperatorShell`, 18 shared operator overlays/wizards, right-side inspector and persistent bottom quick-action dock. D-1 and D-2 routes are unchanged.
- Page styles: `src/styles/pages/dashboard-live-trading.css`, scoped to `.page-dashboard-live-trading`. Flat surfaces, light default, shared theme tokens, responsive layouts and reduced-motion support. No charts.
- Seven sections: running totals; virtualized newest-first trade feed; six-symbol tick watch; active bot runners; pool P&L/target progress; session statistics; Guardian event history.
- Trade feed uses the existing TanStack Table v9 engine for search/sort, plus result and pool filters. A fixed-height window renders at most seven rows from the retained fifty. Hold Feed freezes only the visible snapshot; Suspend Simulation stops the demo clock and event generation.
- Dedicated overlays: execution receipt (copy JSON / repeat in shared ticket), three-step bot configuration (parameters / risk review / confirmation), and guarded bulk pause/stop/restart. Local dialogs trap focus, restore the trigger, lock body scrolling and support Escape.
- Bot actions change Query-cached runner state immediately; only running runners produce new results. Shared shell emergency halt also suspends D-3 simulation. Configuration validates the $0.35–$500 demo base stake range. Session JSON export downloads the actual current cache snapshot.

### Data boundaries and backend handoff

| Layer                        | File / contract                                                         |
| ---------------------------- | ----------------------------------------------------------------------- |
| Initial read                 | `GET /api/live` → `LiveBundle`                                          |
| Deterministic fixture        | `src/server/services/live-mock-service.ts`                              |
| Typed DTOs and event reducer | `src/lib/live/types.ts`                                                 |
| TanStack Query adapter       | `src/lib/live/use-live.ts`, key `["live", "session"]`                   |
| Animated totals              | `src/lib/live/use-live-count-up.ts`, previous value → next value, 600ms |

`LiveEvent` is a discriminated union matching the four specified socket event names: `operator:trade_result`, `operator:tick_update`, `operator:bot_status`, `operator:ai_guardian`. Feed replay is deduplicated by trade ID within the retained window. A production adapter must provide durable deduplication beyond that window. Trade settlement updates totals, relevant runner and assigned pool atomically in the shared pure reducer.

**Frontend-only scope:** the page clearly labels the simulation. Tick prices and new settlements are generated in-browser; bot commands are local cache updates, not authenticated REST writes. Reload restores the seeded session. Shared shell workflows continue using their existing mock API services; D-3 does not claim to execute broker orders or broker risk checks. The initial aggregate statistics are a historical demo snapshot, not a reconciliation of the retained receipt window. Existing Guardian history is a snapshot, not a real risk monitoring service.

To integrate a backend:

1. Replace `GET /api/live` with an authenticated session snapshot.
2. Replace the timer with a socket subscription dispatching `LiveEvent` through `applyLiveEvent`.
3. Replace `command(BotCommand)` with authorized, validated server commands; dispatch acknowledged runner state and show rejected commands as errors.
4. Supply authoritative server timestamps, retention/pagination, account-level halt, risk events, currency and reconciliation. Never rely on frontend stake validation for financial authorization.

Tests: `node --test tests/live-session.test.cjs` exercises snapshot attribution, settlement accounting, replay deduplication, feed retention, streak updates and independent socket events.

Validation: new D-3 files pass ESLint and TypeScript. Production build passes when `DATABASE_URL` is supplied (the pre-existing DB module requires it at import time; a local unused connection string suffices for D-3). Full-repository ESLint still reports existing auth/shell/motion-hook errors outside D-3.

---

## Page D-4 · Trade Log & Records (`/dashboard/trades`)

### UI scope

- Preserves D-2/D-3 light-mode operator shell, 16px-separated cards, subtle shadows, tokens and responsive Bootstrap layout. New styles are isolated under `.page-dashboard-trade-log` in `src/styles/pages/dashboard-trade-log.css`.
- Eight animated summary metrics, UTC/date/pool/market/contract/strategy/result filters, trade/contract/bot/schedule search, filter chips and quick range presets.
- TanStack Table v9 ledger: server-filtered/sorted/paginated at 50 records by default (25/50/100 selectable), column visibility, per-column width sliders, keyboard-accessible expandable execution receipts and mobile stacked records. A sort menu remains available when mobile cards hide table headers.
- Daily aggregation (sortable, seven days/page), package attribution, market and strategy breakdowns. Selecting a group drills into the main ledger and updates all derived summaries.
- Expanded receipt includes trade number, symbol, contract, duration, entry/exit spots, buy/sell/profit, runner and schedule IDs, package capital/share, Deriv contract ID, execution timestamp and result. Copy JSON, repeat ticket, pool inspector and scheduler links work.
- Five page-specific overlays: column/width settings, three-step export wizard, standalone execution receipt, browser saved views and reconciliation check. Together with the 18 existing shared shell modals/wizards, D-4 has 23 overlay workflows. The existing right drawer and persistent quick-action dock remain mounted, with eight additional in-page workflow launchers.
- Local dialogs support Escape, focus containment/restoration and body scroll locking. Empty/error/retry states are provided. Saved views require an explicit browser-load action and store filters only, not financial data.

### Structured backend boundary

| Concern             | Contract                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DTOs                | `src/lib/trade-log/types.ts`: `LedgerTrade`, `LedgerRequest`, `LedgerFilters`, `LedgerBundle`, `LedgerSummary`, `LedgerGroup`                                              |
| Read transport      | `src/lib/trade-log/transport.ts`: `fetchLedger(request, exportAll?)`                                                                                                       |
| API                 | `GET /api/trade-log?page=1&pageSize=50&sort=executedAt&desc=true&from=2026-09-22&to=2026-10-21&symbol=all&pool=all&contract=all&strategy=all&result=all&schedule=&search=` |
| Query               | TanStack Query key `["trades", request]`, previous-page preservation, refetch/retry, initial server snapshot                                                               |
| Fixture/service     | `src/server/services/trade-log-service.ts`, 1,247 deterministic settled trades, 789 wins                                                                                   |
| Export all matching | Same validated query plus `export=true` (does not silently export just the visible page)                                                                                   |
| Schedule drilldown  | `/dashboard/trades?schedule=SCH-001`                                                                                                                                       |

Zod validates dates, filter enums, sorting, pagination and maximum search length at the read endpoint. Invalid queries return HTTP 400. The fixture is the single source for the ledger, all summaries and grouped performance. Its reconciled P&L deliberately differs from illustrative spec figures rather than presenting inconsistent financial arithmetic. ROI = filtered pool profit / package capital. Daily running capital is explicitly labeled as $133,766 opening balance plus **filtered** cumulative profit; it is not represented as an authoritative account statement.

### File exports

- CSV: real UTF-8 file, escaped fields, spreadsheet-formula protection for strings, numeric negative results preserved.
- Excel: real `.xlsx` via lazy-loaded ExcelJS, currency-formatted numeric cells, frozen header and auto filter.
- PDF: real paginated landscape report via lazy-loaded jsPDF (compact settlement columns).
- Export wizard selects format, current-page vs all-filtered scope, and final review. Browser-generated downloads use the actual current filtered receipts. Errors produce actionable notifications.

### Backend integration notes

This remains frontend-first: no broker execution, authentication, persistent financial mutation or official statement generation is implemented by D-4. Replace the deterministic service with authenticated database queries and return the same bundle DTO. Apply the same filter predicates to page data and aggregate SQL queries. Use account-scoped authorization, durable contract IDs, decimal accounting, timezone policy and immutable audit history. For production-sized exports, replace `export=true` with an authorized asynchronous export job and signed download URL. The bundled dataset is small enough for browser exports; do not load an unbounded real ledger into browser memory.

Checks: scoped ESLint and TypeScript pass; production build passes with the repository-required `DATABASE_URL`. `node --test tests/*.test.cjs` tests receipt accounting, count/profit reconciliation across filters, pagination boundaries, intersecting filters, schedule and ID search, numeric sort, full-export scope, empty ranges and CSV negative values, plus existing D-3 reducer tests. Existing repository-wide lint errors outside these new files remain unchanged.

---

## Page D-5 · Package Manager (`/dashboard/packages`)

### Implemented page and design

- `src/app/dashboard/packages/page.tsx` → `PackagesPage` in the existing OperatorShell. D-1 through D-4 and their legacy endpoints are unchanged.
- Styles: `src/styles/pages/dashboard-packages.css`, entirely scoped to `.page-dashboard-packages`. Uses D-2’s light-default tokens, flat surfaces, 16px-separated cards, subtle shadows and rounded borders; no decorative gradients. Active cards respond 1/2/3 columns; tables become mobile labeled records; builder fields respond 1/2 columns. Reduced-motion support covers progress/entry/drawer animations.
- All six spec sections: active package cards; completed-package distribution receipts; inline seven-step package builder; TanStack comparison table with sorting; filtered configuration performance history; selected-package top-five investor allocations. Empty filtered results have reset actions.
- Card data includes investment terms, funded/target progress, investor/slot counts, UTC booking/trading countdown, realized P&L, actual funded-capital ROI and configured Guardian limits. Financial figures deliberately reconcile to integer slot holdings instead of copying inconsistent sample figures.
- Six initial mandates: four primary sample packages, a `Balanced Reserve` profit-sharing pool for exercising settlement, and completed `Genesis`. Next code is allocated from the actual maximum (`PKG-06` initially).
- Package-aware right drawer has Overview / Investors / Protection tabs. It reads D-5’s actual selected package rather than showing unrelated legacy shell fixtures. Existing shell inspector and bottom quick-action dock remain available. Eight package-aware workflow launchers complement the shell tools.

### 20 page-specific overlay workflows

1. Package dossier
2. Full investor allocation ledger (JSON export)
3. New package wizard (7 steps)
4. Edit package wizard (7 steps)
5. Clone configuration wizard (7 steps; new code, cleared terms, reset future dates)
6. Guarded pause
7. Guarded resume
8. Publication pre-flight
9. Close booking confirmation
10. Start demo trading confirmation
11. Archive unfunded draft confirmation
12. Terms/disclosure viewer (real text download, configured PDF link only when supplied)
13. Package risk policy inspector (JSON download)
14. Profit split scenario calculator
15. Capital cycle timeline (real `.ics` download)
16. Editable investor update composer (copy/download, no false claim of sending)
17. CSV/JSON export wizard (format / scope / download)
18. Typed backend payload inspector (copy/download)
19. Historical cycle records
20. Three-step distribution review / completed receipt

These are additional to the existing 18 shared shell overlays. Local dialogs and drawer lock body scrolling, contain focus, restore their trigger and support Escape.

### Typed data / integration seam

| Layer                             | Location                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| DTOs                              | `src/lib/packages/types.ts`: `PackageTerms`, `ManagedPackage`, `PoolInvestor`, `PackageBundle`, `PackageHistory`, `PackageCommand` |
| Validation                        | `src/lib/packages/schema.ts` (Zod v4)                                                                                              |
| Pure lifecycle / exact allocation | `src/lib/packages/model.ts`                                                                                                        |
| Query / local mutation adapter    | `src/lib/packages/use-packages.ts`                                                                                                 |
| TanStack Form builder             | `src/components/dashboard/packages/package-builder.tsx`                                                                            |
| Seeded read endpoint              | `GET /api/package-manager` → `PackageBundle`                                                                                       |
| Deterministic fixture             | `src/server/services/package-manager-service.ts`                                                                                   |
| Query key                         | `["packages", "manager"]`                                                                                                          |

D-5 uses its own read endpoint to avoid breaking the D-1 shell’s existing `GET/POST /api/packages` contract. The current save/command mutations update **TanStack Query cache only**, survive client-side page revisits while cached, and reset on a full reload. There is no real broker, booking, capital transfer, document-hosting service or durable financial backend. No polling overwrites locally edited demo packages.

Future integration: replace the two `mutationFn` implementations with authenticated `POST /api/packages`, `PATCH /api/packages/:id` and package-specific lifecycle endpoints; retain the typed DTOs. Return an authoritative snapshot and invalidate package/shell/account queries together after acknowledgment. Add database transactions, account authorization, idempotency keys, concurrency/version checks and an immutable audit trail.

### Validation / accounting decisions

- Names/descriptions bounded at 80/2000 chars, investment $100–$50,000, 1–100 slots/user, target/max-capital checks, ordered UTC timeline, ordered return scenarios, allowed markets/strategies, drawdown 1–15%, operator fee 0–40%, penalty 0–50%.
- Wizard validates current-step field paths; save/publish validates the entire configuration. Publication additionally requires a public HTTPS `.pdf` URL and a booking window that has not closed.
- Terms PDFs must be hosted by the integrating document service; the demo does not pretend to upload files. The 10 MB limit, content type, document safety and investor acceptance must be enforced by that future service. Seeded disclosures are clearly labeled demo text, not official legal terms.
- Return targets are **not guarantees**, including the conservative scenario. The UI never markets a guaranteed minimum investment return.
- Allocation tokens explicitly use 10 bookkeeping units/USD (30,000 units for a $3,000 slot); not a market quote or token-sale price.
- Funded packages cannot change slot price or fee split, reduce capital limits below funded capital, or lower per-investor slot limits below existing holdings. Financial edits lock after booking closes.
- State transitions are guarded: open → closed → trading; trading pause/resume; draft → scheduled/open or archive; profit_sharing → completed. Timeline clocks do not silently execute financial transitions. A production service must enforce trading start/end windows, risk checks and automatic lifecycle changes.
- Settlement uses pro-rata integer cents with largest-remainder residual allocation, so investor credits exactly equal the investor waterfall amount. Completed distributions cannot repeat. This is a demo positive-profit split, not a full HWM/fee/tax/eligibility engine.

### Validation performed

- TypeScript, scoped ESLint, production build (with repository-required `DATABASE_URL`), and 19 Node tests covering D-3/D-4/D-5.
- D-5 tests cover fixture capital/slot reconciliation, schema/publication rules, pause/resume, close/start, invalid transitions, cent-exact distribution, duplicate settlement prevention and draft archival.
- Browser smoke checks on desktop and 390px mobile: pause/resume; all seven builder steps and publication; profit distribution moving a pool to completed; inspector tabs; CSV download. No browser runtime errors or mobile document overflow observed.
- Browser tooling was used temporarily without adding Playwright/Chromium as application dependencies. The same environment also successfully rechecked D-4 expansion, columns, pagination, CSV download, reconciliation and mobile overflow.

---

## Page D-6 · Investors Management (`/dashboard/investors`)

### Page / design scope

- `src/app/dashboard/investors/page.tsx` renders `InvestorsPage` in the existing OperatorShell. Existing D-1–D-5 pages, shell tools, bottom quick-action dock and legacy `/api/investors` behavior are unchanged.
- Stylesheet: `src/styles/pages/dashboard-investors.css`, isolated under `.page-dashboard-investors`. Matches D-2–D-5's light-default flat surfaces, 16px gaps, rounded hairline cards and subtle shadows. KPI grid is 1/2/4 columns, KYC document grid 2/4 columns, tables become mobile labeled records. Motion supports reduced-motion preferences.
- All seven spec sections: seven investor KPIs (+ outreach quick action); TanStack Table roster; six-tab investor detail drawer; investors by package; KYC verification queue; selected-investor communication history; paginated engagement metrics/outreach.
- Roster supports name/email/ID/label search, status/KYC/package/engagement filters, sorting by name/joined/invested/earned/ROI/KYC/status, 25/page default (10/25/50), cross-page row selection, page selection, filter reset and explicit empty states. Summary and package cards are labeled workspace-wide; filters scope the roster and filtered exports.
- Package cards derive funded totals, member counts, fill and top-three backers from actual holdings. Summary reconciles to **38 profiles / 32 active / $156,000 invested / 2 pending KYC / 3 new today**, average $4,105.26. Top profile is Jane at $25,000; figures are derived rather than copying conflicting spec examples.
- Drawer tabs: Overview / Investments / Trades / Wallet / Comms / Activity. Includes contact/joined/KYC/status, per-package share/ROI, paginated attributed receipts, available vs locked capital, wallet ledger, message history, relationship notes/labels and audit entries. Row and drawer actions all open working workflows. On small screens the drawer fills the viewport.

### 22 dedicated modal / wizard flows

1. Three-step message composer (TanStack Form: compose / audience-channel / review)
2. Three-step guarded payout
3. Three-step signed wallet correction
4. Suspend access confirmation
5. Reactivate access confirmation
6. Individual KYC approval
7. Individual KYC rejection with reason
8. Atomic bulk KYC approval
9. Atomic bulk KYC rejection
10. KYC document workspace
11. Individual document / simulated liveness viewer
12. Full communication thread and reply
13. Three-step invitation-request wizard (real JSON download, not a fake invite link)
14. Three-step CSV/JSON roster export
15. Internal review note
16. Relationship labels
17. Per-investor allocation detail
18. Attributed trade receipt with JSON copy/download
19. Wallet ledger
20. Audit activity with JSON download
21. Engagement detail / outreach
22. Backend DTO inspector with JSON copy/download

These supplement the 18 existing shared shell overlays. Eight additional in-page quick workflow links use the investor selected in communication history. D-6 local modal/drawer layers support Escape, focus containment/restoration and body scroll locking.

### Structured data and backend seam

| Concern                         | File / contract                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DTOs                            | `src/lib/investors/types.ts`: `InvestorBundle`, `ManagedInvestor`, `InvestorHolding`, `InvestorTrade`, `InvestorMessage`, `WalletEntry`, `InvestorActivity`, `InvestorCommand`, `InvestorFilters` |
| Zod validation / pure mutations | `src/lib/investors/model.ts`: `investorCommandSchema`, `applyInvestorCommand`, `filterInvestors`                                                                                                  |
| Query / mutation adapter        | `src/lib/investors/use-investors.ts`, key `["investors", "manager"]`                                                                                                                              |
| Seeded read endpoint            | `GET /api/investor-manager` → `InvestorBundle`                                                                                                                                                    |
| Fixture                         | `src/server/services/investor-manager-service.ts`                                                                                                                                                 |
| Detail / workflows              | `components/dashboard/investors/investor-detail.tsx`, `investor-workflows.tsx`                                                                                                                    |
| Synthetic assets                | `public/demo-kyc/*.svg` (4 locally bundled watermarked illustrations)                                                                                                                             |

The demo uses a single bounded 38-profile Query snapshot; filtering/sorting/pagination are client-side. Commands update Query cache only, including audit/message/wallet entries. A full reload restores the deterministic fixture. A cached client-side revisit preserves local changes while Query retains them. There are no real transfers, identities, verification decisions, invitations, outbound emails or auth restrictions.

The read endpoint is separate from legacy shell fixtures to avoid breaking earlier pages. On integration, replace the read/mutation adapters with account-authorized services, split large roster/summary/detail queries as needed and use server pagination. Suggested production commands: `POST /api/investors/:id/kyc-approve`, `/kyc-reject`, `/suspend`, `/reactivate`, `/force-payout`, `/adjust-balance`, `/messages`, `/notes`, `/tags`. The current code does **not** pretend these production commands have been implemented. Use server acknowledgments, transaction/idempotency keys, RBAC, version checks and audit logs; refresh account/shell/roster/detail queries together.

### KYC and financial boundaries

- All identities use `.test` email addresses and masked phone numbers. KYC images contain no real identity data and are stamped DEMO / NOT VALID. Liveness playback is an explicitly labeled animated illustration sequence, not a recording, biometric decision or live verification result. The production provider must return authorized expiring URLs and independent verification evidence.
- KYC decisions require a pending submission, 10+ character reviewer notes and explicit evidence-review confirmation. Rejection additionally records a reason. Bulk actions validate every selected ID/state before any investor changes; duplicates or unknown IDs reject the entire batch. A suspended investor remains suspended when approved.
- Payout requires active status, verified L2 KYC and enough **available** funds. Locked capital is never debited. Positive amounts, decimal precision and reason are validated. Balance corrections are limited to ±$10,000, require a reason, cannot be zero and cannot create a negative available balance. Both append local wallet and audit entries.
- These checks are frontend demonstrations, not a security boundary or payment authorization. Production payout must include beneficiary/AML checks, server roles, authenticated balances, database transactions, approval policy and replay prevention.
- Reactivation does not bypass KYC. Communication records are explicitly marked `delivery: "demo"`; invitation wizard exports an integration request rather than inventing a secure link. Full thread opens locally instead of navigating to an unimplemented investor-thread URL.
- Holdings use a $500 demo accounting slot in this D-6 snapshot; production joins must use authoritative package slot pricing. Investor-attributed receipt totals reconcile to earned profit, and wallet entries reconcile to available + locked balances. D-6 fixture is a self-contained roster snapshot, not a cross-page reconciliation with other independently seeded demo modules.
- CSV exports escape quotes and protect string cells against spreadsheet formulas. JSON exports explicitly warn about identifiers/messages/notes; real exports need privacy permissions and an audit trail.

### Validation

- TypeScript, scoped D-6 ESLint, production build with the repository-required `DATABASE_URL`, and **29 Node tests** across D-3–D-6 pass.
- D-6 tests cover seeded summary/accounting, attributed receipts, immutable audited KYC decisions, atomic bulk preflight/replay rejection, payout eligibility/overdraft/precision, corrections, suspension/reactivation, messaging/notes/labels and intersecting roster/outreach filters.
- Browser smoke checks passed at desktop and 390px mobile: all six drawer tabs, roster pagination, guarded payout, wallet correction, three-step message recording, document viewer/simulated playback, KYC approve/reject, bulk review, clear queue, suspension/payout block, invitation JSON, CSV export and empty/reset search. Mobile document overflow was false and detail drawer width was 390px. No application runtime errors observed; the pre-existing external Google Fonts request is blocked by the sandbox network, with local font fallbacks in use.

---

## Page D-7 · Performance Analytics (`/dashboard/analytics`)

### Implemented scope / design

- Route: `src/app/dashboard/analytics/page.tsx` → `AnalyticsPage`, reusing OperatorShell, light-default theme, sidebar, shared right inspector, 18 shared overlays and persistent quick-action dock. Earlier page routes and APIs are untouched.
- Page-scoped styles: `src/styles/pages/dashboard-analytics.css` under `.page-dashboard-analytics`. D-2–D-6 spacing, 16px-separated cards, hairline borders, subtle shadows, flat colors, tabular figures, responsive tables/cards and reduced-motion support. No decorative gradients or unrelated themes.
- Seven spec sections: six KPI metrics; per-package capital/profit/cycle/investor impact; TanStack investor ranking; market + strategy contribution bars and tables; revenue/distribution donut and ledger; daily-close drawdown/recovery/event annotations; mandate-day-normalized comparison. An additional interactive portfolio equity chart provides period context.
- Linked 7D / 14D / 30D / custom UTC date filters and package scope update all metrics and breakdowns together. The API validates ranges (366 days maximum), package enum, ordering and snapshot cutoff. Empty windows have explicit reset actions. Query displays update/error/retry states and identifies the previous snapshot while retaining it during a refetch.
- Ranking uses TanStack Table v9 with sorting (capital, investor P&L, ROI, name, pool count, activity), search and five-row pagination. Ranking is period-specific after positive-profit operator allocation, not copied lifetime earnings.
- Charts use responsive accessible SVG, keyboard day selectors, chart-point/Details drill-downs, legends with series visibility, explicit missing observations and exact-value detail reports. Equity chart uses an extent-based axis; drawdown/comparison axes include zero. Pool inspector has Performance / Allocation / Risk tabs; mobile fills the available viewport.

### 20 analytics overlays / workbench workflows

1. Metric methodology and assumptions
2. Custom UTC date range
3. Package performance dossier
4. Package investor impact
5. Investor period-attribution report
6. Market contribution detail
7. Strategy contribution detail
8. Revenue attribution ledger
9. Three-step settlement-review request (JSON artifact; no transfer)
10. Drawdown/recovery observation ledger
11. Guardian event correlation
12. Three-step comparison studio (pools / normalized vs USD / table review)
13. Three-step CSV/JSON/PDF report export
14. Three-step recurring-report request (email / frequency / review)
15. Browser saved views (save/load/apply/delete)
16. Session chart annotation
17. Static profit sensitivity scenario lab
18. Arithmetic data-integrity checks
19. API payload inspector (copy/download)
20. Daily portfolio observation detail

These are additional to the existing shared shell workflows. Eight workbench launchers supplement the bottom quick-action dock. Local modal/drawer layers support focus containment, Escape, scroll locking and trigger restoration.

### Data contracts and integration

| Concern                  | File / contract                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DTOs                     | `src/lib/analytics/types.ts`: `AnalyticsSource`, `AnalyticsBundle`, `AnalyticsFilters`, `AnalyticsTrade`, `AnalyticsPool`, `PoolAnalytics`, `InvestorRanking`, `AnalyticsGroup`, `EquityPoint`, `GuardianMarker` |
| Validation / calculation | `src/lib/analytics/model.ts`: `analyticsFilterSchema`, `calendarDays`, `equityPoints`, `summarizeAnalytics`, `buildAnalytics`                                                                                    |
| Seed adapter             | `src/server/services/analytics-service.ts`                                                                                                                                                                       |
| API                      | `GET /api/analytics?from=2026-09-22&to=2026-10-21&pool=all` → `AnalyticsBundle`                                                                                                                                  |
| Query adapter            | `src/lib/analytics/use-analytics.ts`, key `["analytics", "bundle", filters]`, `keepPreviousData`, 30s stale time                                                                                                 |
| Chart primitives         | `src/components/dashboard/analytics/charts.tsx`                                                                                                                                                                  |

The analytics seed joins D-4's deterministic settled receipts to D-6's deterministic funded holdings, restricts contracts to each current mandate window, and calculates every output from that set. Default snapshot: **759 trades / 484 wins / $9,331 realized P&L / $156,000 capital / 5.9814% ROI**. These differ from the illustrative spec figures intentionally: all visible groups and revenue shares reconcile instead of mixing unrelated hardcoded metrics. D-6 local cache-only edits do not alter these server-seeded analytics; backend integration must provide a shared authoritative account snapshot/version.

For integration, replace the source adapter with authorized execution, holding, lifecycle, event and payout-ledger reads. Keep the typed response and client query adapter, or split roster/summary/group endpoints as data volume grows. The service is read-only; requests to prepare settlement/report jobs generate real local JSON artifacts but do not call nonexistent production write endpoints. Production jobs need authorization, idempotency, job status, signed download URLs, audit trails and secure delivery. Report requests include UTC cron and the exact requested date filter; a production scheduler must define rolling-date behavior separately.

### Financial calculation basis (also visible in the UI)

- ROI = selected gross settled P&L / selected funded pool capital. Constant capital, no annualization, cash-flow timing or time-weighted-return adjustment.
- Profit factor = gross positive trade profit / absolute gross negative trade profit. Undefined without losses → `null` / N/A, not an arbitrary infinity or fabricated ratio.
- Sharpe = mean calendar-day return / sample daily standard deviation, risk-free rate 0, **not annualized**. Zero-execution dates remain zero observations. Zero variance or fewer than two observations → N/A.
- Equity = funded starting capital + selected-window cumulative profit. Running peak resets at window start. Drawdown is daily-close, not intraday mark-to-market. Recovery is daily observation count from the deepest trough to the first subsequent prior-peak recovery; unrecovered → `null`, never a made-up duration.
- Drawdown-to-peak-gain ratio = largest dollar drop from a running daily peak / maximum equity gain above opening capital; undefined without a positive peak gain.
- Operator allocation = 20% of each pool's **positive** profit; no operator fee on loss. Investor allocation retains losses. Largest-remainder integer-cent allocation makes all investor rows sum exactly to their pool's investor share, including loss cases.
- Modeled paid fraction = 60% of positive investor profit for PKG-01/03 and 0% for PKG-02; pending is the remainder. Clearly labeled throughout as an illustrative model, **not confirmed payouts or a real distribution ledger**. Donut represents positive allocations; net investor totals separately retain losses. Production must substitute authoritative payout records and full HWM, management-fee, eligibility and tax accounting.
- Average duration uses execution seconds, with an explicit fixture-only approximation of 2 seconds per tick. Production should use actual contract start/settlement timestamps.
- Normalized comparison aligns each package by mandate day, not calendar date. Daily return = daily profit / package capital. Days outside the selected period, beyond mandate length or after snapshot are `null` gaps, not zero padding. USD mode explicitly removes capital normalization.
- Guardian annotations are seeded temporal event records; no claim of causal protection or live enforcement. Session annotations are not durable audit entries.
- Sensitivity lab applies a static haircut to observed winning profit with losses unchanged. It does not change the dataset and is not a forecast, backtest or slippage model.

### Exports / storage

- CSV downloads package capital, execution counts, ROI-related results and revenue shares; JSON downloads the full filtered DTO; PDF is a real printable summary via existing lazy-loaded jsPDF.
- Investor/package/category/risk/day reports and quality checks have JSON copy/download paths. Browser saved views store only named filter preferences. Annotations are session-only. No financial mutation or external report delivery is claimed.
- Settlement requests and recurring-report requests explicitly state they are handoff artifacts, not approvals, live transfers, queued backend jobs or sent emails.

### Validation

- Scoped D-7 ESLint, TypeScript and production build with repository-required `DATABASE_URL` pass.
- **39 Node tests** across D-3–D-7, including D-7 grouped/revenue/investor cent reconciliation, source-capital joins, ROI basis, daily equity/peaks, undefined ratios, empty windows, future/malformed ranges, normalized missing observations, full-loss allocations and recovered/unrecovered troughs.
- Browser smoke checks: five matching integrity checks; 7D/package filters; all inspector tabs; chart day detail/annotation; CSV and settlement-review downloads; comparison wizard; invalid custom-range guard; 390px mobile document overflow false; no application runtime errors.

Additional browser verification covered all 20 analytics overlay types, saved-view persistence after reload, all three real report formats (including PDF signature validation), recurring-report request download and empty-period reset. No application runtime errors were observed.

---

## Page D-8 · Funds & Capital (`/dashboard/funds`)

### Implemented frontend

- Reuses OperatorShell, the existing light-default design tokens, navigation, shared right drawer and persistent 4+ action bottom dock. Existing D-1–D-7 routes and state models are unchanged.
- Dedicated `.page-dashboard-funds` / `src/styles/pages/dashboard-funds.css`: 16px-separated panels, flat white/slate surfaces, crisp typography, count-up principal metrics, staggered deposit rows, allocation-ring entry motion, movement entry motion and reduced-motion overrides. Responsive metric columns, stacked deposit/allocation rows below md, vertical mobile timeline and full-width mobile inspector.
- All seven requested sections: six capital KPIs; TanStack deposit register; capital allocation donut and table; filtered/paginated movement timeline; three-way reconciliation and last five control runs; five provider snapshots; cash-backed reserve/safety-margin controls. Liquidity composition and workbench tools supplement these sections without replacing the shared shell.
- Deposit register has ID/date/investor/amount/method/package/status/reviewer/actions, sorting, status/method/package filters, reference/name/ID search, pagination and rows-per-page controls. “Pending deposits” KPI scopes the register to all open reviews, including submitted and information-requested states. Portfolio KPIs remain portfolio-wide when the register is filtered.
- Every row has dossier/proof/investor/package drilldowns and an inspector. Final reviews are locked; unsettled or KYC-incomplete submissions cannot be credited. Empty search/flow states have working reset actions.
- TanStack Query manages the canonical workspace cache. TanStack Table v9 manages deposit sorting. TanStack Form + Zod validates the manual intake form. Existing Bootstrap 5.3.8 and shared modal frames are preserved.

### 22 overlay types / six multistep flows

1. Treasury basis and controls
2. Three-step manual deposit intake (details / reference review / record uncredited intake)
3. Deposit review dossier
4. Three-step settled-deposit verification (evidence / notes / consent)
5. Deposit rejection
6. Settlement-information request
7. Synthetic proof viewer and SVG download
8. Investor funding context
9. Package capital detail
10. Three-step allocation rebalance (plan / liquidity impact / consent)
11. Fund movement detail and JSON download
12. Three-step reconciliation (source controls / results / record run)
13. Reconciliation evidence and JSON download
14. Discrepancy review / append-only session investigation note
15. Payment provider detail
16. Provider DTO diagnostics (explicitly no external network probe)
17. Reserve target policy
18. Three-step reserve top-up (cash vs simulated position release / impact / consent)
19. Three-step CSV/JSON/PDF export (format / scope / download)
20. Session treasury audit trail
21. Cash runway sensitivity lab
22. Explicit workspace reset

The local right inspector supports deposit, package and provider contexts, each with Summary / Evidence / Activity tabs. Focus trapping, Escape, opener restoration, body scroll locking, backdrop close and busy-close guards support the overlays. Eight workbench launchers and four footer links/actions complement the existing bottom quick-action dock.

### Financial identities / deliberate corrections to sample figures

The sample spec mixes incompatible broker, escrow, package and reserve amounts. D-8 instead preserves the **$156,000** D-6 funded-principal baseline with a reconciling synthetic custody model:

| Opening control                  | Amount / definition                                                              |
| -------------------------------- | -------------------------------------------------------------------------------- |
| Managed principal                | $156,000                                                                         |
| Funded packages                  | PKG-01 $61,000; PKG-02 $50,000; PKG-03 $45,000                                   |
| Deployed principal               | PKG-01 $56,000; PKG-02 $46,000; PKG-03 $40,000 = $142,000                        |
| Broker cash                      | $8,750; includes $4,200 earmarked reserve                                        |
| Owned escrow in transit          | $5,250; already part of managed principal                                        |
| Available                        | $14,000 = broker cash + owned escrow                                             |
| Immediately deployable           | $4,550 = broker cash minus current reserve                                       |
| External, uncredited submissions | Four open reviews totaling $3,500; excluded from managed assets and owned escrow |
| Reserve target                   | 5% / $7,800; $3,600 gap                                                          |

**Managed principal = deployed + broker cash + owned escrow.** Reserve is a subset of broker cash, not an additional asset. Package funded ownership is distinct from deployed principal. Undeployed package entitlement is not an additional cash wallet. The desk suggests earmarking existing free cash for the initial reserve gap rather than unnecessarily releasing trades.

All amounts are USD reporting equivalents, not live FX rates. Net principal controls and provider values are illustrative, not authenticated bank, broker or chain evidence. D-7 realized analytics are a separate seed snapshot and are not automatically settled into this principal-only control model. The register/movement feed are samples, not lifetime funding history or a complete accounting journal; historic posted events are already reflected in the opening control snapshot.

### DTOs, API and adapters

| Concern              | Location / contract                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types                | `src/lib/funds/types.ts`: `FundsBundle`, `FundsOverview`, `Deposit`, `FundAllocation`, `FundMovement`, `FundProvider`, `ReconciliationRun`, `ReconciliationCheck`, `FundsAudit`, `FundsInvestor` |
| Validation / reducer | `src/lib/funds/model.ts`: `intakeSchema`, `fundsCommandSchema`, `FundsCommand`, `getFundsOverview`, `reconciliationChecks`, `assertFundsInvariant`, `applyFundsCommand`                          |
| Seed adapter         | `src/server/services/funds-service.ts`; joins D-6 funded holdings and D-7 execution statistics                                                                                                   |
| Read API             | `GET /api/funds` → complete `FundsBundle`                                                                                                                                                        |
| Section reads        | `/api/funds?section=overview`, `deposits`, `allocation`, `flow-timeline`, `reconciliation`, `provider-status`, `reserve` (unknown sections → 400)                                                |
| Client state         | `src/lib/funds/use-funds.ts` → `useFunds`, canonical `["funds", "workspace"]` cache and validated local mutation reducer                                                                         |
| UI / intake          | `src/components/dashboard/funds/funds-page.tsx`, `intake-form.tsx`                                                                                                                               |

`fundsQueryKeys` also defines the spec’s overview/deposit/page/filter/allocation/flow/reconciliation/provider/reserve keys for split production endpoints. The demo intentionally uses **one canonical cache without interval refresh** so a 30/60-second seed GET cannot erase local reviews and allocations. When integrating, replace the local mutation adapter with authorized HTTP commands and versioned responses, then wire the spec’s polling/invalidation policy. Do not run independent stale section updates over money-changing local state.

Suggested command mappings, **not implemented production endpoints**:

- `verify` → `POST /api/deposits/:id/verify`
- `reject` → `POST /api/deposits/:id/reject`
- `requestInfo` → `POST /api/deposits/:id/request-info`
- `register` → deposit intake endpoint with private proof references
- `rebalance` → `POST /api/funds/rebalance`
- `reconcile` → `POST /api/funds/reconcile`
- `reservePolicy` / `reserveTopUp` → policy/earmark workflows under `/api/funds/reserve`

Backend commands must include authenticated reviewer identity, expected source revision, idempotency key, journal references and authorization. Never accept the client’s `providerSettled` or `kycVerified` flags as evidence in production. Independently confirm exact currency/amount/reference/finality, investor eligibility and custody availability. Real trade release must be asynchronous, account for market P&L and enforce broker eligibility; the demo assumes settled principal release without trading losses.

### Local mutation guarantees / boundaries

- Every money-changing command validates Zod input, enforces finite nonnegative balances, prevents deployment beyond package funding, protects escrow/reserve and checks all three accounting identities before/after changes. Money allocations use cent precision.
- Verification requires non-final status, KYC clearance and provider-settled seed flags. It adds amount once to ledger principal, broker cash and the selected package’s funded capital; deployment does not change. A replay/final-deposit mutation is rejected.
- Reject/request-info update review state and notes only. No refund, email, SMS or provider message is sent. Manual intake creates an uncredited submitted row with settlement false, never a fabricated settled receipt. Duplicate provider references are rejected case-insensitively.
- Allocation plans change package deployment and broker cash with capital conservation; global reserve/escrow protection remains enforced.
- Reserve policy changes target only. Cash top-up earmarks existing broker cash; position-release simulation reduces all package deployments pro rata using largest-remainder cents, adds settled cash, then earmarks reserve. It does not create capital or execute a broker order. Internal movements are labeled neutral rather than investment profit.
- Reconciliation compares custody aggregate, funded allocations and deployment controls. Any nonzero discrepancy is retained as a review; >$1 is an alert. A run records exact source revision and all check rows; latest five are retained. Recording a note cannot change source balances or erase a historic exception. A discrepant state blocks financial mutations but allows investigation/reconciliation.
- All changes and audit notes are Query-cache/session only and reset on reload or explicit reset. Other independent demo pages are not mutated. Production needs durable journals, dual control, immutable audits and server concurrency control.
- Proofs are actual locally rendered/downloadable SVG illustrations labeled **SYNTHETIC / NO PAYMENT EVIDENCE**, not fake claims of uploaded financial documents. Replace with private signed proof access and independent authenticity/settlement controls.
- CSV is a real scoped deposit-register download with formula-cell escaping; JSON includes all portfolio controls and selected register scope; PDF is generated via lazy-loaded jsPDF with automatic pagination. Export scopes are explicit. None is an audited financial statement.
- Cash runway is a static spendable-cash ÷ assumed-daily-need sensitivity, also showing coverage after the reserve target. No forecast, income, credit line or payout guarantee is implied.

### Validation performed

- **50 passing Node tests** across D-3–D-8. D-8 tests cover opening control identities, correct D-6 funding join, cash/escrow/reserve composition, immutable single-credit verification, KYC/provider/finality gates, uncredited intakes, reference uniqueness, cent precision, overdeployment/reserve guards, cash vs position-release reserve funding, policy validation, three-way discrepancy detection and immutable historical exceptions.
- Scoped D-8 ESLint, TypeScript and production build pass with the repository-required `DATABASE_URL` environment value. Full-repository lint has unrelated pre-existing hook-rule issues; it is not claimed clean.
- Actual Chromium checks cover all 22 overlay types; deposit verify/reject/request-info; TanStack Form intake; duplicate credit/settlement guards; allocation and reserve-policy/top-up wizards; balanced reconciliation; historical exception notes; CSV/JSON/PDF/SVG downloads (PDF signature validated); all context inspector tabs; search/sort/pagination; invalid allocation previews; empty-flow recovery; local reset; mobile intake and Escape.
- Desktop and 390px mobile layouts checked. Mobile document width equals viewport width; no application runtime errors observed. New GET APIs are read-only fixtures and do not use a real database, provider credential or broker session.

---

## Page D-9 · Withdrawal Requests (`/dashboard/withdrawals`)

### Frontend scope / design

- Reuses the existing light-default OperatorShell, shared modals/drawer and persistent bottom quick-action dock. No earlier page/state model was replaced.
- Dedicated `.page-dashboard-withdrawals` and `src/styles/pages/dashboard-withdrawals.css`: the same 16px gaps, flat white/slate surfaces, hairline borders, restrained teal, tabular figures, responsive table-to-card behavior and reduced-motion support as preceding operator pages. Count-up KPIs, staggered queue rows, in-flight activity pulse and SVG bar entrance motion are page-scoped; no decorative gradients.
- All seven sections: five queue KPIs; actionable pending/scheduled register; processing attempts; completed settlement register; payout settings/rules; failed/retry queue; daily payout volume plus trailing seven-calendar-day moving average.
- TanStack Table v9 powers both registers (sorting and manual pagination); TanStack Query owns one consistent workspace snapshot; TanStack Form + Zod validates operator request intake and settings. Bootstrap remains the existing 5.3.8 platform dependency.
- Pending register supports investor/package/ID search, rail/status filters, page selection, individual checkboxes, selected-count context and atomic bulk review. Filter changes clear selection; pagination preserves it. Mobile sort dropdowns remain available when table headers are hidden.
- Completed register supports ordered UTC date ranges, rail/search filters, sorting, pagination, empty-scope recovery and CSV export. KPIs/chart days can scope the register. Portfolio KPIs remain full-snapshot controls, not sums of a filtered page.

### 24 overlay types / 12 three-step flows

1. **New local payout request** — details / wallet reservation / consent
2. **Single approval** — eligibility / schedule-vs-process-now / consent
3. **Bulk approval** — selected rows / execution choice / consent
4. Single rejection and wallet-hold release
5. **Bulk rejection** — selected rows / reason / consent
6. Request additional payout information (local note, not delivered)
7. Request dossier and JSON download
8. Investor wallet context
9. **Synthetic beneficiary review** — masked route / evidence rationale / consent
10. **Scheduled batch** — approved requests / liquidity controls / consent
11. Provider evidence record and JSON download
12. **Synthetic callback injection** — outcome scenario / reference+attempt binding / consent
13. **Settled completion** — final evidence / cash+wallet impact / consent
14. Confirmed failed-attempt review
15. **Retry** — previous not-paid evidence / new attempt / consent
16. **Release failed hold** — failure evidence / wallet release / consent
17. Contact-investor draft (no message sent)
18. Payout policy review and rationale
19. **CSV/JSON/PDF export** — format / record scope / consent
20. Chart-day settlements and register drilldown
21. Payment-rail fee/timing guide
22. Session audit trail, before/after evidence and JSON download
23. **Auto-rule preview** — eligible L2 records / scheduled approvals / consent
24. Explicit local workspace reset

Bold flows above are three-step wizards. A dedicated right-hand inspector has Summary / Evidence / Timeline / Wallet tabs. Overlays support keyboard focus containment, opener restoration, Escape, scroll locking, backdrop close and busy-close guards. Six payout workbench launchers, four footer links/actions and the inherited persistent dock provide working bottom-page shortcuts.

### Seed snapshot and calculations

The baseline is **2026-10-22 14:30 UTC**, with a base revision plus local session revisions:

- Four review requests totaling **$720**; two processing attempts totaling **$1,400**.
- Eight snapshot-day completions totaling **$2,800**; **184** lifetime completions totaling **$48,920**. The register contains the actual 184 generated settlement records, not an unrelated hardcoded lifetime counter.
- Initial completed duration is **18 minutes** per seeded settlement; later local completions recalculate the observed average. No observations → N/A.
- Two failed attempts ($250 and $80) retain wallet holds. The invalid-mobile-route example blocks retry until the synthetic beneficiary review passes.
- Gross is the wallet reservation, with **gross = recipient net + fee**. Bank transfers have no demo fee; mobile defaults to 1.5%; card to 2.9% + $0.30; crypto to a $1.50 illustrative network estimate. Fees are deducted from gross, not charged a second time. Settled historical quotes are never repriced when policy changes.
- Opening treasury cash **$8,750** and reserve **$4,200** come from the D-8 opening control seed; existing processing commitments are $1,400, leaving **$3,150** uncommitted payout capacity.
- Payout wallets are explicit synthetic opening controls (available + held + paid-since-opening = opening balance), not live broker balances or D-6 wallet mutations. Investor identity/KYC/package context is seeded from D-6. Earlier payouts are already reflected in opening cash/wallet controls; lifetime history must not be subtracted again.
- Daily volume is aggregated from completed records only. The 30/14/7-day chart includes zero-activity dates, and its moving average reads the preceding six calendar days even before the displayed window. Day drilldowns reconcile to actual completed rows.
- USD amounts are reporting examples, not live FX/network quotes or guaranteed delivery times. “Full payout” is a request reason, not a position-liquidation instruction.

### State machine / financial safeguards

- Request creation checks policy limits, known investor/package ownership and available wallet balance, then moves gross from available → held. New routes start **unverified**, even when KYC is verified; KYC never proves beneficiary ownership.
- Approval checks KYC L1+, verified beneficiary, current limits, non-consuming fee and uncommitted treasury cash. It either sets `approved` (scheduled) or creates a local `processing` attempt. It never holds funds twice or debits treasury at approval.
- Batch processing operates only on approved rows. Bulk approve/reject is clone-and-validate atomic: any invalid row leaves the original workspace unchanged. No provider calls occur before/after a partial client mutation.
- Attempt references include the request and incremented attempt number. Synthetic callbacks must match **both** attempt number and current reference. Final `settled` or `failed` evidence cannot be overwritten by a contradictory outcome. Before/after audit snapshots retain old attempt references and evidence when retry creates a new attempt.
- Completion is allowed only for processing requests with final settled evidence. It consumes held gross, increases paid-since-opening, debits treasury gross once and appends a cash-ledger row containing gross/fee/net. Duplicate/final transitions are blocked.
- Recording failure requires confirmed failed/not-paid evidence. It releases the treasury commitment but retains the wallet hold until a separate safe retry or wallet-release decision.
- Retry requires failed status, definitive not-paid evidence, eligible beneficiary/KYC and capacity. It retains the existing wallet hold and starts a new unknown-outcome attempt; it never creates a second reservation.
- Wallet release is allowed only for confirmed-not-paid failed requests. It moves held → available with **no treasury cash increase** and marks the request refunded locally. Retry and release are mutually exclusive; unknown outcomes block both.
- Rejection releases only unsent pending/info/approved holds. Processing and completed transfers cannot be rejected as a way to manufacture wallet credit.
- Beneficiary edits are request-scoped and forbidden once processing starts. The local workflow uses masked labels/synthetic tokens and explicitly does **not** establish real bank ownership.
- Contact/info actions append local review notes only. Auto-approval is a preview plus explicit approval, never an unattended worker. Saving the batch time stores policy only; no BullMQ/cron job is created.
- Every command validates Zod input, cash/reserve conservation, outstanding wallet-hold sums, opening wallet conservation and gross/net/fee identities before and after changes. Disallowed commands never partially modify the original cache.

### DTOs / adapters / API

| Concern              | Contract                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types                | `src/lib/payouts/types.ts`: `PayoutBundle`, `PayoutRequest`, `PayoutInvestor`, `PayoutSettings`, `PayoutEvidenceSnapshot`, `PayoutAudit`, `PayoutCashEntry`, `PayoutDay`                                                               |
| Model                | `src/lib/payouts/model.ts`: `payoutCommandSchema`, `requestSchema`, `settingsSchema`, `payoutDateRangeSchema`, `applyPayoutCommand`, `assertPayoutInvariants`, `getPayoutSummary`, `approvalBlockers`, `autoEligible`, `payoutHistory` |
| Seed service         | `src/server/services/payouts-service.ts`                                                                                                                                                                                               |
| Read API             | `GET /api/payouts` → complete `PayoutBundle`                                                                                                                                                                                           |
| Section reads        | `/api/payouts?section=summary`, `section=settings`, `section=history&days=7                                                                                                                                                            | 14  | 30` |
| Paged queues         | `/api/payouts?status=pending&page=1&pageSize=8` → mode/asOf/revision/items/total/page/pageSize envelope; all eight defined statuses supported                                                                                          |
| Client adapter       | `src/lib/payouts/use-payouts.ts`, canonical `["payouts", "workspace"]`                                                                                                                                                                 |
| Main / forms / chart | `src/components/dashboard/withdrawals/{withdrawals-page,forms,history-chart}.tsx`                                                                                                                                                      |

Invalid sections/statuses, negative/non-integer pages, oversized page sizes and unsupported chart windows return 400. Read APIs are deterministic, synthetic and do not expose or use real payment credentials.

`payoutQueryKeys` includes the spec’s summary/status/page/completed/settings/failed/history keys for a split production API. This frontend intentionally uses one canonical Query cache with no periodic seed refresh, preventing 30-second polling from erasing local financial-review state. Local changes reset on reload or explicit reset and do not mutate D-6, D-8 or shared independent demo caches.

Replace the local mutation adapter with authorized, server-versioned endpoints matching the spec (`approve`, `reject`, `batch-approve`, `batch-reject`, `complete`, `fail`, `retry`, `refund`, `settings`). Server integration must enforce roles/dual control, investor eligibility, beneficiary ownership, sufficient settled funds, authoritative FX/fees, idempotency, optimistic concurrency and immutable journals. Authenticate and deduplicate provider callbacks; never accept frontend evidence/status flags as payment proof. Run scheduled jobs server-side, bind each job to its intended attempt, retain unknown outcomes for investigation and reconcile real provider settlement before posting wallets.

### Exports / honest demo boundaries

- CSV exports completed-filter scope, full request scope or selected queue records and escapes formula-leading cells. JSON includes typed records, policy, portfolio controls, cash-ledger entries and before/after audit evidence. PDF is a real, automatically paginated jsPDF operations report.
- Individual records, chart series, synthetic provider evidence and session audit data have working JSON downloads. These are operational demo artifacts, **not bank receipts, authenticated callbacks, real transfer confirmations or audited statements**.
- No real email, SMS, wallet update, broker order, bank transfer, blockchain transaction, scheduled worker or refund is executed. The callback simulator is explicitly labeled as a local scenario, not “refresh live evidence.”

### Validation

- **67 passing Node tests** across D-3–D-9, including 17 D-9 tests covering baseline totals, exact gross/net/fee splits, atomic bulk guards, reservation conservation, treasury commitments, attempt binding, immutable final evidence, duplicate transitions, safe completion/retry/release, beneficiary scope, policy validation, cash overcommit prevention, auto-rule eligibility and chart/settlement reconciliation.
- TypeScript, scoped D-9 ESLint, production build and `git diff --check` pass. Full-repository lint is not claimed clean because earlier unrelated hook-rule issues remain.
- Chromium desktop and 390px mobile checks cover all 24 overlay types, single/bulk approvals, batch start, callback→completion, failure→wallet release, distinct retry attempts, beneficiary gates, TanStack request/settings forms, info/rejection/contact drafts, atomic bulk rejection, reset, filters/sort/pagination, chart/day drilldowns, all four inspector tabs, CSV/JSON/PDF downloads (PDF signature checked), evidence JSON export, Escape and empty-filter recovery. No application runtime errors or horizontal document overflow were observed.

## D-10 — Communications (`/dashboard/comms`)

### Frontend surface

Continues the existing light operator shell, its sidebar/header/dock, spacing,
neutral hairlines and restrained teal accent. Styling is isolated in
`src/styles/pages/dashboard-comms.css` under `.page-dashboard-comms`.

- Inbox: investor/subject/ID search; read/unread/replied/archived, package and UTC
  date filters; TanStack Table sorting/pagination; desktop thread preview,
  mobile thread dialog, consent-gated in-app replies, archive/restore and explicit
  read/unread flags. The initial latest-thread preview does not silently mark it read.
- Announcements: deduplicated contact/read counts, any-channel read evidence,
  unread follow-up review and duplicate-follow-up protection.
- TanStack Form composer: individual multi-select, all-investor or multi-package
  union; channels; 120-character subject; a safe Markdown subset for bold,
  italic, numbered/bulleted lists and HTTPS/known-dashboard links; seven variable
  insertion controls; personalized preview; draft, queue, template and UTC
  scheduling workflows. Raw HTML is never injected.
- Eight editable/versioned templates with preview, duplicate, local test-render
  wizard, rendered-artifact download and template-level evidence. Prior campaign
  subject/body snapshots do not change when a template is edited.
- TanStack notification/outbox table: search, type/channel/state/UTC date filters,
  sorting, pagination, D/Q/F evidence and failed-only retry. Export operates on
  **all matching rows**, not the visible page. CSV protects formula-prefixed text;
  JSON includes underlying evidence and session audit; PDF is a readable summary.
- Six bulk workbench actions (all investors, package investors, unread review,
  daily summary, weekly report, channel controls), footer launchers and inherited
  bottom dock. Right inspector has conversation, investor context and evidence tabs.
- Analytics: 7/30/90 UTC-calendar-day windows, channel/template observations and
  explicit denominator/methodology dialog. Empty observation sets display N/A.
- 27 distinct dialog flows, including eight three-step review wizards: message,
  announcement, schedule, local test, unread resend, failed retry, delivery
  simulation and export (message/announcement are separate entry workflows).
  Other dialogs cover previews, template edit/duplicate/stats, announcement/detail,
  reply/thread/archive, contact/preferences, channels, drafts/schedules/cancellation,
  metrics/audit and reset. All overlays have Escape dismissal, focus wrapping,
  return-focus handling, scroll locking and mobile-sized scrollable content.

### DTOs, query cache and read API

`src/lib/comms/types.ts` defines contacts, channel consent/configuration, audience,
message content, template, thread/post, campaign, delivery, test and audit DTOs.
`model.ts` contains Zod validation and an immutable, atomic command reducer.
`src/server/services/comms-service.ts` supplies a deterministic demo snapshot:
38 D-6 investor contacts, D-7 package start dates, eight templates, 16 threads,
12 historical simulated campaigns, 456 delivery rows, one draft and two schedules.
All names/addresses/consent/tracking evidence are synthetic. The source snapshot
is **2026-10-23 08:45 UTC**. The initial unread count is four.

`useComms` owns one canonical TanStack Query key, `['comms','workspace']`.
Commands synchronously read/update that cache, append an audit record and increment
revision; failures leave the prior state untouched. Infinite stale time prevents
background refetch from silently erasing session edits. Reload/reset restores the
seed. Other dashboard modules are independent snapshots, not synchronized ledgers.
Split inbox/templates/log/analytics/thread query keys are reserved for integration;
the current UI deliberately derives everything from the canonical workspace.

`GET /api/comms` returns the base workspace, never this browser's local changes.
Read projections support:

- `section=inbox|announcements|templates|log|analytics|thread`
- `page=1..10000`, `pageSize=1..50`; page metadata and total for list projections
- `days=7|30|90` for analytics; `id=<threadId or investorId>` for thread lookup
- `search`, `status`, `type`, `channel`, `package`, ISO `from` / `to` for applicable
  lists; inbox dates use thread update time and log dates use campaign creation time
- Invalid/unknown parameters, unknown packages and reversed dates return 400;
  missing threads return 404. Responses explicitly use `Cache-Control: no-store`.

There is **no write API** and no production messaging provider connected.
Example: `/api/comms?section=log&type=report&channel=in_app&pageSize=10`.

### State and evidence semantics

- Audience unions and contact/channel pairs are deduplicated. Inactive/suspended
  accounts are excluded. Pending-KYC contacts can receive operational communications
  under this demo policy, but cannot bypass per-channel consent. Disabled adapters
  and missing consent produce explicit exclusions. Telegram/SMS start disabled.
- `{name}`, `{package}`, `{investment}`, `{earnings}`, `{wallet}`, `{roi}` and
  `{packageStartDate}` are supported. Financial figures are **whole-investor totals**
  even for a package-scoped audience; package and start-date variables resolve a
  matching selected holding. Earned profit is not settled wallet cash. No-investment
  contacts use N/A ROI and explicit no-package/not-scheduled values.
- Queueing creates `queued_demo` rows, not delivered observations. Snapshot content
  and available template version are recorded. A local test creates `rendered_only`
  JSON evidence, not a delivery row. Outbound operator replies do not increase
  investor response metrics.
- The explicit simulator produces delivery/failure/engagement evidence. Delivery
  rechecks current account eligibility, channel consent and adapter flags. Retry
  rechecks **every failed row atomically**, retains its ID, increments attempts and
  cannot requeue delivered rows. A changed-consent failure requires reviewing the
  synthetic controls; operator changes are never real investor consent evidence.
- Open/click/response rates divide uniquely flagged delivered contact/channel rows
  by delivered rows. Clicks require opens; response evidence uses in-app investor
  replies, not operator replies. Retry counters do not duplicate analytic rows.
- Announcement read rate deduplicates contacts across channels. “Unread” means no
  observed open, including undelivered targets—not proof a person did not read it.
  At most one active follow-up can be created per original announcement.
- Schedules must be future UTC requests within 365 days. They create no background
  job. Only a due schedule can be explicitly dispatched into the local queue, after
  current consent checks. Only drafts/schedules can be cancelled; delivered/queued
  messages cannot be recalled.
- Analytics use delivery-row creation date and the selected inclusive calendar-day
  window ending on the source snapshot date, not the operator's browser timezone.

### Backend handoff / production gates

Replace the mock service with authenticated, role-scoped paginated reads and
idempotent command endpoints. Preserve campaign content/template-version snapshots,
recipient/channel uniqueness, current consent checks, account policy and atomic
transactions. Add server-side authorization, audit/retention policies, CSRF controls,
rate limits and bulk-send approvals. Never accept browser-controlled consent as
investor authorization, or browser simulation flags as provider evidence.

Implement a durable scheduler/outbox with cancellation/race handling and idempotent
workers. Add verified email/push/Telegram/SMS adapters and signed, deduplicated
provider webhooks for delivery/opens/clicks/replies; enforce unsubscribe/suppression
and account eligibility at dispatch/retry time. Use secrets management, never
browser API-key fields. Distinguish recipient-level consent from adapter availability.
Use provider-specific sanitization/escaping of personalized text, approved destination
URLs and role-appropriate investor-portal links; seeded `/dashboard/*` links are
operator-demo references, not production investor email destinations.

The demo read API, JSON downloads, contact-context UI and local audit are not an
access-control model. Require appropriate authorization/redaction for real personal
and financial data, consistent reporting windows/timezones, audit persistence,
observability and provider reconciliation before enabling real sends or exports.

### Validation

- `node --test tests/*.test.cjs`: 86/86 tests (19 communications model tests plus
  inherited 67). Covers fixture invariants, consent/adapter/account gating,
  multi-package deduplication, financial/start-date personalization, safe links,
  rendered subject length, atomic queue/template save, draft edits, snapshot
  immutability, local tests, reply semantics, archive states, scheduling/dispatch,
  failed-only retry, engagement denominators, unread follow-up and invalid commands.
- TypeScript, scoped feature ESLint, production build and `git diff --check`.
- Desktop/mobile Chromium exercises: replies, archive/restore, right-inspector tabs,
  current-content previews, drafts, queue/simulate/fail/retry, template edit/duplicate/
  test download, announcements/follow-up, schedules/dispatch/cancel, channel controls,
  CSV/JSON/PDF downloads, date/empty filters, reset, focus wrapping/return and Escape.
  390px viewport checked for horizontal overflow; no page runtime errors observed.
- Read API checks: workspace/list/template/analytics/thread success, missing thread
  404, invalid pagination/window/date/package/channel/unknown query parameters 400.

## D-11 — Deposit Logs (`/dashboard/deposits`)

### Delivered frontend

Uses the existing operator shell, light theme, restrained teal accent, shared
Bootstrap 5.3.8 foundation, inherited bottom dock, and independently scoped
`src/styles/pages/dashboard-deposits.css` (`.page-dashboard-deposits`). No gradients
or changes to prior dashboard pages are required.

Seven sections cover summary, ledger, verification queue, method breakdown,
failed/refunded records, UTC timeline and automation rules. The bottom workbench
has six operational launchers, and the right inspector has context/evidence/history
views. There are **21 distinct dialog flows**, including **10 three-step wizards**:
verify, batch verify, reject, request proof, retry, refund, evidence simulation,
record claim, automation simulation and export. Additional dialogs cover detail,
proof, contact brief, rules, reconciliation/mismatch, method analysis, timeline,
audit, notes and reset. Overlays support focus wrapping/return, Escape, scroll lock
and small-screen scrolling; motion honors reduced-motion preferences.

- TanStack Table v9 ledger: date/amount and other column sorts, text/status/method/
  package/investor/UTC date filters, 50-row default pagination (10/25/50 selectable),
  row selection, expandable payment references/notes and mobile stacked rows.
  UI sorting/pagination currently derives from one canonical local workspace;
  the read API already exposes server-pagination parameters for integration.
- Summary derives from current ledger filters. Received = verified plus refunded
  historical receipts; unverified/failed/rejected claims are not received funds.
  Today counts claims of every status on the UTC source day. Verification latency
  includes records that reached verification, including subsequent refunds.
- Verification queue and failed/refunded panels use the full workspace, independent
  of ledger filters. Batch review uses explicit selected IDs or currently eligible
  claims (max 50). It is atomic: any blocked selected record fails the whole batch.
- Proof viewer renders a real structured **synthetic** receipt/transaction artifact,
  with actual JSON and generated PDF downloads. No external proof-image URL,
  private S3 URL, fabricated bank document or unimplemented upload control is used.
  Production must replace the proof adapter with authenticated, signed image/PDF
  access and authorized upload/scan/retention controls.
- TanStack Form records new claims with known investor/package IDs, cent-precision
  amount, unique reference and meaningful context. They start submitted, with
  unknown provider outcome, no proof and no credit.
- Method charts and table derive counts/totals/rates/latency from filtered rows;
  fee terms are illustrative, not fees charged to these receipts. Timeline bins
  all claims into six four-hour UTC intervals and identifies peak claim volume.
- CSV/PDF/JSON exports include all matching rows (not merely the current page).
  CSV guards formula/whitespace-prefixed cells; JSON includes underlying evidence
  and session audit. Contact brief download and links to actual Communications,
  Investors and Treasury pages provide working cross-page routes without messages
  being silently sent.

### DTOs, local model and compatibility

`src/lib/deposits/types.ts` defines deposit/method/proof/provider/rule/workspace
DTOs. `model.ts` contains Zod commands/filters, summary/breakdown/timeline/report
functions, verification blockers, pure atomic transitions and credit invariants.
`src/server/services/deposits-service.ts` provides 104 deterministic synthetic
records, 38 D-8 roster contacts and three package references. Snapshot:
**2026-10-23 10:00 UTC**. This is an independent ledger, not D-8's financial seed:
prior treasury balances, package totals, investor wallets and payouts are untouched.

Canonical TanStack Query cache: `['deposit-logs','workspace']`. Mutations read and
update this cache synchronously; stale-time Infinity avoids background refetch
silently discarding local decisions. Split summary/queue/rules keys are reserved
for integration. No polling pretends to show real-time payment receipts. Reload or
explicit reset restores the source; other modules are not cross-page synchronized.

**Existing API compatibility is preserved.** Unscoped `GET /api/deposits` and the
inherited `POST /api/deposits` keep their legacy command-center contracts. D-11
never calls that POST. Feature projections use `GET /api/deposits?section=...`:

- `workspace` returns the typed D-11 bundle; `ledger`, `queue`, `summary`, `methods`,
  `timeline`, `rules`, `detail` return projections. Detail requires `id` (404 if absent).
- List pagination: `page=1..10000`, `pageSize=1..50` (default 50).
- Sort: `date_desc|date_asc|amount_desc|amount_asc`.
- Filters: `search`, `status`, `method`, `pool`, `investor`, ISO `from` / `to`.
  Unknown filters, invalid date/status/method/pagination and unknown roster/package
  IDs return 400. Lists include total and page metadata; responses use no-store.
- API reads return the base snapshot, not a particular browser's local changes.
  Example: `/api/deposits?section=ledger&method=card&page=2&pageSize=10&sort=amount_desc`.

### Transition and accounting gates

Verification requires reviewable status, KYC, proof, simulated settled provider
outcome, exact amount equality, required crypto confirmations (minimum six), an
explicit simulated authenticated webhook for nonbank methods and no prior credit.
Amounts/identities are validated, duplicate references are rejected case-insensitively,
and credit can be added exactly once. Refunding is full-amount, verified-only and
reverses exactly that local credit, retaining reviewer history and a demo reference.
The invariant is `openingCredit + localCredit = sum(current credited deposits)`.
Currency inputs use USD cent precision; production should use integer minor units
or a decimal ledger, not JavaScript floating-point accounting.

Rejection is limited to unresolved claims without known settlement. Retry applies
only to failed, unsettled attempts, retains identity/reference and increments
attempts while returning to pending/unknown; it never proves receipt. Proof requests
are local request drafts, not delivered notifications. Notes append without
rewriting evidence. Explicit evidence simulation cannot rewrite finalized records,
cannot bypass KYC, and never itself verifies/credits a deposit.

Automation never verifies bank transfers. Cross-check/mismatch flags cannot be
disabled. All credit requires exact matching; the ≤$1 configurable threshold only
classifies escalation severity. Optional missing-proof expiry rejects only unsettled,
proofless claims older than 24h; known settlements are never auto-rejected. Rules
are inert until the operator explicitly reviews and runs a local simulation.

### Production handoff

D-11 adds no payment write endpoint, provider connection or real wallet mutation.
Replace local commands with authenticated, authorized, idempotent write APIs for
verify/reject/request-proof/retry/refund/rules; validate KYC/current ownership and
provider evidence server-side in one transaction. Preserve batch atomicity,
reference uniqueness, credit/refund conservation and append-only reviewer evidence.
Do not treat browser-supplied settlement/webhook flags or generated artifacts as
proof of funds. Restrict simulator code to nonproduction environments.

Integrate signed/deduplicated provider webhooks, immutable receipts, confirmation/
reorg handling, durable reconciliation jobs, optimistic concurrency and refund
idempotency/provider reconciliation. Retain unknown outcomes for investigation
rather than issuing duplicate payments. Add reviewer roles/dual controls, masked
beneficiary handling, secure proof storage, malware scanning, audit retention,
rate limits, CSRF protection, PII authorization/redaction for exports and investor-
authorized notification delivery. Legacy unscoped deposit APIs remain a separate
mock contract and must also be secured before production.

### Validation

- `node --test tests/*.test.cjs`: 106 tests, including 20 D-11 tests for fixture
  consistency, atomic batch verification, exact credit/refund conservation,
  duplicate protection, all verification gates, proof drafts, retry, receipt
  simulation, claim validation, protected rules, automation/expiry, notes,
  aggregation/filtering, UTC bins, CSV safety and tampering rejection.
- TypeScript, scoped D-11 ESLint, production build and diff whitespace checks.
- Chromium desktop and 390px workflows: sorting/pagination, expansion, right
  inspector tabs, verification/refund, proof requests, claim form, note/evidence,
  retry, rules/automation, CSV/PDF/JSON downloads, empty/invalid-range filters,
  reset and mobile dialogs. No runtime page errors or horizontal mobile overflow.
- Read projections checked for successful pagination/filtering, 404 detail and 400
  invalid pagination/date/status/package/investor/unknown parameters. Legacy API
  contract remains available alongside D-11's explicit workspace projection.

## D-12 — Activity & Audit Logs (`/dashboard/logs`)

### Frontend and presentation

Continues the established light operator shell, Bootstrap 5.3.8, spacing, neutral
hairlines, restrained teal controls, inherited dock and right-inspector patterns.
`src/styles/pages/dashboard-logs.css` is isolated under `.page-dashboard-logs`.
Category colors are semantic labels, not decorative gradients. Reduced-motion
preferences disable entry/pulse/chart transitions.

Seven sections provide:

1. **Activity stream** — TanStack Virtual viewport with 100px rows/overscan, at
   most 1,000 matching events and TanStack Query infinite pages of 100. Newest-first
   ordering uses timestamp plus stable event-ID tie-break. Search covers ID,
   actor/action/target/details/correlation; category, severity, actor and inclusive
   UTC dates are explicit. The “Demo feed active” indicator does not imply a real
   websocket. Pause freezes the stream revision; local observations buffer until
   resume, while other panels remain current. A separate explicit wizard appends
   labeled synthetic observations; no timer fabricates provider activity.
2. **Categorized logs** — TanStack Table v9 sorting, 10/25/100-row pagination and
   category-specific fields for contracts/bots/schedules/P&L, payment lifecycle
   observations, provider outcomes and system execution metadata. Tabs override
   stream category only; other explorer filters apply. The table export action
   explicitly uses the selected tab category, not a hidden global category.
3. **Investor activity** — explicitly attributed events in the selected UTC range,
   investor selector and complete timeline dialog. No activity is inferred from
   missing evidence or from another investor's ledger.
4. **System events** — ten guard triggers, five reconciliation observations,
   seven daily/four weekly backup observations, 50 cron executions and ten webhook
   failures; type selector and full history. Backup/reconciliation dialogs download
   actual observation manifests, not nonexistent cloud objects. Cron review records
   an inert dry-run request. Webhook retry/outcome simulation is explicit.
5. **Security/access** — login success/failure, authenticator and password-reset
   fixtures, masked origins, security review and synthetic session register. Local
   “revocation” cannot invalidate real credentials or the operator's own session.
6. **API/webhook access** — 100 internal and 50 external observations with
   method/path, status, latency, attribution, direction/status filters and paging.
   Paths are inert recorded labels, not buttons that execute payment endpoints.
7. **Export/compliance** — filtered CSV/full JSON, compliance PDF workpapers,
   accountant P/L worksheets, proposed retention, archive manifest register and
   preservation holds. Six bottom workbench launchers expose the major workflows.

There are **36 distinct dialog flows**, including **16 three-step wizards** for
acknowledgement/escalation/resolution, session flags, webhook retry/outcome,
cron dry-run, retention, hold/release, archive, export, compliance, accountant
worksheet, synthetic observation and reset. Other dialogs cover raw JSON,
correlations, actors/investors, security, backup/reconciliation, system history,
archives, named views, API requests and review registers. The right inspector has
context, metadata and reviewer-evidence tabs. All overlays trap/wrap keyboard
focus, restore prior focus, support Escape and lock background scrolling. A
TanStack Form handles validated named scopes and reports duplicate names cleanly.

### Structured source and local state

- `src/lib/logs/types.ts`: typed event/attribution/metadata, API request, review,
  session, retry, archive, retention, hold, saved-view and financial-receipt DTOs.
- `src/lib/logs/model.ts`: Zod filters/commands, deterministic filtering/pagination,
  export bounds, aggregation/tax workpaper derivation, invariants and immutable
  atomic local commands.
- `src/server/services/logs-service.ts`: **1,946 deterministic source observations**
  joining the independent D-4 trade ledger, D-9 payouts, D-10 communications and
  D-11 deposits with synthetic security/system/API fixtures. Includes 1,247 actual
  demo trade receipts, 152 auth observations, 86 system-kind observations, 150 API
  observations, 38 roster identities/sessions and one seeded prior-month archive
  manifest. Source snapshot **2026-10-23 10:00 UTC**; default 30-day scope contains
  1,811 events, not the entire source history. These modules are not synchronized
  production ledgers, and this page never mutates their caches or balances.
- Canonical Query key `['logs','workspace']`, stale Infinity, no background polling
  that erases edits. Local commands append `local_demo` audit events, increment
  revision and update separate review/session/retry/hold/policy/view state.
- Stream infinite key `['logs','stream',{filters,revision}]`. Its local query
  adapter reads the canonical snapshot in 100-event pages; a changed revision
  starts a fresh stream query rather than mixing stale cursors. A paused view
  retains its frozen revision. The read API is ready for a future authorized
  remote/cursor adapter. Categorized tables/reports can access matching records
  beyond the stream's 1,000-event cap.

Original events are never rewritten by a command. Reviewer actions retain notes
and add explicit related-event/investor/correlation attribution where available.
Initial notes open an acknowledged review; resolution requires an escalation,
resolved reviews cannot silently reopen and repeated acknowledgement is blocked.
Webhook failures permit one queued demo attempt at a time, max three attempts;
successful simulations block further retry and original failure evidence remains.
Session flags and cron dry-run requests are local only. No purge/delete operation
is exposed. Reset/reload restores the original frontend snapshot, not a real
production audit store.

### Read API

`GET /api/logs?section=workspace` returns the base bundle. Other sections:
`stream`, `categorized`, `investor`, `system`, `security`, `api`, `retention`,
`archives`, `summary`, `tax`, `detail`. These are no-store read projections, not
views of a browser's local changes. There are **no D-12 write endpoints**.

- Common filters: `search`, `category`, `severity`, `actor`, ISO `from` / `to`.
- `page=1..10000`, `pageSize=1..100` (default 100). Stream uses fixed 100-event
  pages, caps at 1,000, exposes `totalMatching`, and returns a **one-based next-page
  number**; its internal local adapter uses zero-based page indices.
- `id` selects an investor or event for its section; unknown IDs return 404.
- `kind=guardian|reconciliation|backup_daily|backup_weekly|cron|webhook_failure`
  selects system history; `action` selects known auth observations.
- `direction=internal|webhook`, `outcome=all|success|errors` select API access.
- `year=2000..snapshotYear` selects an accountant workpaper, with explicit empty
  years. Invalid pagination/filter/date/year/actor/unknown parameters return 400.

Example: `/api/logs?section=system&kind=webhook_failure&page=1&pageSize=10`.

### Reports, preservation and evidence limitations

Event exports/compliance/archive scopes are limited to **30 inclusive UTC days
and 10,000 rows**, always all matching records rather than a visible page. Invalid
explorer dates are carried into report review for correction, never silently
replaced by a default export scope. CSV guards formula/whitespace prefixes. Optional
CSV/PDF minimization omits actor names/free-text presentation, not every possible
identifier; full JSON intentionally retains the synthetic evidence payload.
Production needs explicit authorization and redaction, not a browser toggle alone.

JSON manifests carry SHA-256 of `JSON.stringify(events)` exactly as represented.
PDFs include a digest of their canonical JSON report payload; it is **not the PDF
byte hash**. Preparing a report appends an audit event with type, row count and
payload digest after the browser download is requested; this does not attest file
receipt/storage. A digest does not establish provider authenticity, timestamp
trust, signed custody or tamper-proof storage.

Compliance PDFs include executive/category counts, local hold/review context and
up to 40 warning/critical references; full event evidence is available in JSON.
They are synthetic workpapers, not certifications. Yearly accountant PDFs derive
P/L from actual D-4 demo trade receipts, not deposits/payouts or event counts. The
source coverage dates are disclosed, so they are **not complete annual accounts**.
Fees, residency, cost-basis adjustments and tax due are undetermined. Empty-year
workpapers explicitly report zero source observations, not “no tax liability.”

Retention defaults are proposed operational safeguards: financial/audit seven
calendar years, auth one year, system 90 days, communications seven years.
Jurisdiction-specific requirements require review. UI/model floors prevent
shortening financial/audit below seven years, auth below one or system below 90
days, but no expiry worker runs. Holds are separate preserved records; exact
active duplicates are blocked, release requires an active hold and neither action
deletes evidence. Archive manifests copy exact event IDs with scope/reason and
remain `manifest_only`; they never move bytes to cloud storage or remove source
records. Holds remain active when an archive copy is prepared.

### Backend handoff and security gates

Replace synthetic joins with authenticated, authorized and redacted reads from a
durable audit service. Use append-only events, server timestamps, validated actor/
request/correlation attribution, stable cursor pagination, deduplicated ingestion
and retention-aware indexing. Replace the local stream adapter with SSE/websocket
or authorized polling without presenting fixtures as live monitoring.

Implement durable authorized review/incident actions, server session invalidation,
provider signature checks, idempotent bounded webhook recovery, cron dry-run
isolation and independently acquired backup/reconciliation evidence. Do not trust
browser-provided success flags, payload digests or local session flags. Preserve
original observations and authoritative correlation links when recording decisions.
Add concurrency control, rate limits, CSRF protection and independent source IDs.

Reports need role-based PII controls, jurisdiction-specific retention/tax review,
export authorization/auditing, encryption, custody manifests and signed immutable
storage where required. Archive/restore/purge services must actually enforce holds,
retention and separation of duties. No real provider retry, session revocation,
cloud archive, backup restoration, purge, financial posting or tax filing occurs
in this frontend implementation.

### Validation

- `node --test tests/*.test.cjs`: **127/127**, including 21 new D-12 tests for
  deterministic fixtures, virtual/infinite pagination boundaries, filters, export
  bounds, immutable source/reviewer lifecycle, retries/limits, session flags,
  retention floors, holds/archives, views, cron isolation, report metadata,
  financial workpaper reconciliation, CSV safety and invalid commands.
- TypeScript, scoped D-12 ESLint, production build and diff whitespace checks.
- Chromium desktop and 390px checks: virtual DOM remains bounded while loading/
  scrolling multiple pages; pause buffers/resume reveals observations; review
  lifecycle, inspector tabs, saved scopes, webhook retry/outcome, session flags,
  retention/holds/releases, manifests, CSV/JSON/PDF/accountant downloads, verified
  JSON payload hash, empty/invalid filters, reset, keyboard trapping/return,
  category-table horizontal scrolling and mobile dialogs. No page runtime errors
  or horizontal document overflow observed.
- Secondary browser checks cover actor/investor/correlation/raw evidence, backup/
  reconciliation manifests, cron requests/history, transport correlations,
  report-window/policy guards and empty accountant years. API projections exercised
  for success, validation/404 behavior and fixed stream page contracts.

## D-13 · Markets & Symbols (`/dashboard/markets`)

### Frontend workspace and provenance

- The SSR page loads `getMarketsBundle()` from `src/server/services/markets-service.ts`; `src/lib/markets/model.ts` defines DTOs, schemas, calendar calculations, statistics, historical grouping and immutable local commands. UI resides in `src/components/dashboard/markets/markets-page.tsx`, scoped to `.page-dashboard-markets` and `src/styles/pages/dashboard-markets.css`. Existing light operator shell, Bootstrap, TanStack Query/Form/Table and count-up price behavior are preserved.
- The catalog contains **28 illustrative reference products**, not authenticated broker discovery: 10 synthetics, 6 forex, 3 commodities, 3 crypto, 3 indices and 3 stock-index references. Each has 100 deterministically seeded observations at declared decimal precision; base snapshot is `2026-10-23T10:00:00Z`. Quote changes compare with a demo baseline, not a verified daily close. There is no quote subscription or interval inventing live ticks. Explicit “Generate 5 demo ticks” retains the last 100; timestamps use a strictly increasing logical demo clock, potentially ahead of wall time after rapid clicks.
- Package codes/names/opening undeployed capital project the D-8 funds allocations. Initial market assignments, allowed strategies, enabled guardian and 5% drawdown limits are D-13 illustrative policy, **not broker-verified mandates**. Assignments/risk edits and scheduling do not alter D-5/D-8 or any ledger.
- Historical strategy-symbol totals derive the existing **1,247 D-4 synthetic receipts**, filtered to 30 inclusive UTC source days ending October 23. Counts, net P/L and win percentages reconcile to those observations. Highest/lowest observed net summaries and editable setup reviews are not financial recommendations, forecasts or guaranteed-profit claims. Unsupported historical strategy names fall back to the explicitly visible Fixed stake editor; the operator must separately validate and review a request. Symbols with no observations show an explicit empty state rather than invented performance.

### Read API and cache contract

`GET /api/markets` is `no-store`, read-only; default section is `symbols`:

| Section             | Response                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| `workspace`         | Complete `MarketBundle` snapshot                                         |
| `symbols`           | `{mode, asOf, items}`; optional `group` and case-insensitive `search`    |
| `ticks&symbol=R_10` | `{mode, asOf, symbol, ticks, stats}`                                     |
| `schedule`          | Illustrative calendar projection per symbol, anchored to source snapshot |
| `assignments`       | Initial package mandate/capital DTOs                                     |
| `performance`       | Observed 30-day strategy-symbol totals                                   |

Strict query validation rejects unknown parameters, invalid sections/groups and overlong search with 400; unknown/missing tick symbols return 404. No POST handler or trading/scheduling write is exposed. Public read filters are not authorization; replace fixture services with authenticated operator/provider access before production.

`useMarkets` uses Query key `['markets','workspace']`, seeded from SSR, infinite stale time and no focus refetch so incidental reads cannot overwrite local edits. Local mutations atomically validate against the latest cache and replace it with an immutable clone plus revision/audit record. No real scheduling POST endpoint is called. Future active-symbol, session, assignment, tick-history, recommendation and schedule APIs can split these DTO projections into account-scoped query keys; account switching must isolate/clear caches and provider subscriptions.

Favorites alone persist to browser storage at `trademo:markets:favorites:jane_operator:v1`. Stored codes are validated against the catalog and deduplicated; invalid/unavailable storage raises a visible notice and retains usable session state. This namespace is a **fixed demo identity**, not a substitute for authenticated per-user persistence. Favorites are never written server-side; every other edit, generated tick, draft, outbox reservation and audit entry resets on reload.

### Calendar, statistics and local scheduling boundaries

- Synthetic/crypto calendar: 24/7. Forex: Monday 00:00 through Friday 22:00 UTC. Commodities: Monday 01:00 through Friday 23:30 UTC. Both index groups use illustrative US weekday 09:30–16:00 America/New_York sessions with `Intl` DST offsets, including the next opening across DST weekends. Holidays, maintenance, early closes and venue-specific sessions are **not modeled**. UI countdowns use browser time; API calendars use source time. Neither is an executable exchange-open signal.
- Tick digits are extracted from quote strings at declared precision. Even/odd uses last 50; histogram and population quote standard deviation use last 100. Volatility is descriptive price-unit sigma, not annualized risk or next-digit probabilities. SVG quote trace, 50-digit strip and frequency bars are derived from the same observations; actual evidence JSON is downloadable.
- Schedule schema validates stake $0.35–$1,000 (cent precision), 1–20 trades, tick duration 1–10 for synthetics only, time duration 60–3,600 seconds, supported contracts, Even/Odd digit contracts, enabled guardian, package strategy/symbol mandates, unique packages, available modeled capital and illustrative session at requested UTC start. Modeled sequence cannot cross that session’s closing boundary. Future starts must be within 30 days. Production must independently validate all inputs and risk at execution time, including fees, currency conversion, eligibility and provider capabilities.
- Exposure is the full modeled starting sequence: fixed/DCA/Even-Odd `stake × N`; Martingale `stake × (2^N − 1)`; Fibonacci sums its N-term progression. No win resets, provider fees or profit forecasts are assumed. Equal selected-package shares reserve opening undeployed capital against all `queued_demo` requests. Cancellation retains the record, releases the reservation exactly once and cannot be repeated. Removing an assignment referenced by a queued request is blocked until cancellation. No wallet movement, real guardian monitor, background timer, durable job or provider order exists.
- **21 distinct dialog flows**, including **7 three-step workflows** (schedule, assignment, risk, historical setup, cancellation, export and favorite restore); right-hand context/contracts/assignments inspector; six lower workbench launchers. Modal focus trapping, Escape, body-scroll lock, focus return, horizontal mobile tabs, responsive assignments and reduced motion are implemented. Inline Form validation and empty-state recovery remain functional without backend writes.
- Workspace exports create actual full JSON, symbol CSV and readable jsPDF files, independent of visible filters. Tick evidence, individual requests and local audit JSON are also downloadable. They are synthetic unsigned evidence, not provider-certified reports. JSON includes full local workspace context; treat future real account data as sensitive and authorize/redact exports server-side.

### Validation

Feature tests cover snapshot provenance, full sequence exposure, weekly/DST boundaries, compatibility, time/session bounds, package/risk/strategy gates, atomic reservations, cancellation, immutability, monotonic tick retention, receipt reconciliation and runtime command validation. Production build, scoped lint/TypeScript, regression tests, read API errors/no-write behavior and desktop/390px browser workflows are checked. Browser coverage includes filters/persisted favorites, nested dialogs and focus, assignment/risk edits, drafts, queue/cancellation, drawer, workbench, and actual JSON/CSV/PDF downloads. Repository-wide historical lint issues remain outside this page’s scope.

## D-14 · Bot & Automation Config (`/dashboard/bots`)

### Page, structured state and source boundaries

- SSR: `src/app/dashboard/bots/page.tsx`; fixture adapter: `src/server/services/bots-service.ts`; domain/schema/command reducer: `src/lib/bots/model.ts`; cache/mutations: `src/lib/bots/use-bots.ts`. UI and reusable TanStack configuration form/Monaco editor are in `src/components/dashboard/bots/`. Styles are page-scoped under `.page-dashboard-bots` in `src/styles/pages/dashboard-bots.css`, imported after the existing pages. The shared light operator shell, footer tray, navigation and previous workspaces remain intact.
- Seven sections: runner fleet; expandable configuration station; rule-based AI Guardian policy; conditional automation; sortable historical comparison; operator inbox; JavaScript source library. There are **23 distinct dialog flows**, including **13 three-step review workflows**, a right-hand overview/policy/receipt inspector, and six lower workbench launchers. Keyboard trapping/return, Escape, scroll locking, reduced motion, responsive 1/2/3-column bot layout, 1/2-column rules and mobile horizontal tables are implemented. Wizard transitions explicitly restore focus inside the dialog when the confirmation button becomes disabled.
- Five bots are seeded at `2026-10-23T10:00:00Z`: Alpha/Bravo running, Charlie paused, Delta stopped, Echo idle. Runtime/status/config are independent source observations, **not connected workers**. They do not rewrite the existing shell’s independent live-demo projection. Charlie’s source cooldown ends at 10:04 UTC; expiry does not automatically resume a bot or clear historical alerts.
- All **1,247 existing D-4 receipts** are projected by exact bot ID. The comparison, per-bot counts, win rates, net P/L, mean stakes and best/worst are derived from those receipts across all source dates. Source runtime and current symbol/strategy do not imply those receipts occurred during that runtime or under that configuration. New/unobserved bots show no invented trades or win rates. UI receipt pagination uses 20 rows; the read API uses 25.
- Opening package capacity projects D-8 `capital - deployed`. Initial bot allocations and risk settings are illustrative D-14 mandates, not provider-verified instructions. Running **and paused** bots reserve their full modeled budgets against package percentage shares. Idle/stopped configurations do not reserve funds; starting always rechecks capacity. This reservation ledger is local to D-14 and does not alter D-5, D-8, D-13, wallets or existing schedules.
- Trigger history, notification observations and script run/win metadata are clearly labeled fixtures. Script metadata is separate from the receipt ledger. No control/config/test action manufactures receipt output, increments historical script runs or updates source runtime.

### Read routes and backward compatibility

The existing **`GET/POST /api/bots` contracts are untouched**. D-14 never calls the legacy POST endpoint. Its read-only adapter is `GET /api/bots/workspace`, with strict Zod query parameters:

| `section`                | Projection                                                      |
| ------------------------ | --------------------------------------------------------------- |
| `workspace` (default)    | Complete `BotWorkspace`                                         |
| `bots`                   | Initial bot records and saved configurations                    |
| `config&id=bot_1`        | Saved configuration; bot ID required                            |
| `trades&id=bot_1&page=1` | `{items, page, total, next}`; 25 per page, public 1-based pages |
| `performance`            | Reconciled historical bot aggregates                            |
| `guardian`               | Global policy plus source triggers                              |
| `rules`                  | Initial automation definitions                                  |
| `notifications`          | Seeded in-app observations                                      |
| `scripts`                | Source-only JavaScript records                                  |

Responses are `Cache-Control: no-store`. Invalid section/page/unknown query parameters or missing required IDs return 400; unknown bot IDs return 404. Pages must be integers 1–1000. Missing asset paths return 404. No D-14 write handler exists (POST returns 405). These demo read endpoints expose fixture data only; production must authorize the authenticated operator/account and protect script/receipt data.

Query key is `['bots','workspace']`, seeded by SSR with infinite stale time and focus refetch disabled. All mutations validate against the latest cache, clone the workspace, apply one command atomically and append an audit entry/revision. Failed commands do not change source/cache. **All D-14 changes reset on reload**; there is no localStorage, durable save, background polling or websocket feed that could imply fresh execution or overwrite session edits. Config editors key on the selected bot’s saved config, not unrelated revisions, so reading notifications does not erase unsaved form edits.

When integrating a backend, split the DTO into authenticated account-scoped keys for active bots/config/trades/performance, Guardian status/triggers, automation rules, notifications and owner scripts as outlined in `tradeMO.md`. Enable 15/30-second polling or subscriptions only when there is an actual authoritative execution source, and reconcile acknowledgements/idempotent commands rather than replacing pending local edits blindly.

### Commands, capital and safeguards

- Bot lifecycle supports start/resume, pause, stop, restart, create idle and remove. Controls are explicit local state transitions: pause retains modeled capital; stop releases it but cannot close/cancel a provider position. Future cooldowns block start/restart/test, including after stop. Removing a bot requires it to be stopped/idle and no rule referencing it. Historical receipts are retained. Emergency halt stops locally running/paused bots without changing receipts, cooldowns or triggers; it is **not a production kill switch**.
- Saved configs use searchable symbol input, contract/duration, cent-precision initial/current/max stakes, strategy-specific JSON, package percentages, capital budget, daily controls and per-bot Guardian settings. Running configs cannot be edited until paused/stopped. Five synthetic reference symbols and six strategy types are supported. Tick durations are 1–10; second durations 60–3,600. Even/Odd requires a digit-side contract. JSON parameter schemas reject malformed/unsupported settings; DCA stake arrays require cent precision and cannot exceed max stake. Built-in strategies clear script attachment IDs.
- Selected package shares must be unique, known and total 100%; starting/testing requires an assignment. Modeled full-sequence exposure includes every capped progression step and concurrency: Martingale uses the configured multiplier/steps; Fibonacci its N-term progression; Oscar’s Grind a bounded increment; DCA the supplied schedule; Even/Odd and custom-source plans one initial stake. Exposure must fit the bot budget, and each package share must fit unreserved D-8 capacity. This is not expected profit, a recovery guarantee, margin or a fee/slippage estimate.
- Initial/current stakes fit max stake; maximum stake fits daily loss; daily loss fits stop loss; concurrency fits the daily trade limit. Guardian stays enabled; hard caps are ≤8 odd/even losses, ≤10 other-contract losses, ≤2 concurrency and ≤5% drawdown. Bot limits cannot exceed global policy. Tightening global policy is rejected if it would invalidate an active/paused bot; stop or align bots first. These are configuration gates, **not live drawdown monitoring or execution-time protection**.
- “Test saved config · 1 trade plan” validates saved settings and records `result: 'plan_only'`. It does not run JavaScript, submit orders, simulate a win/loss, reserve additional funds, increment script runs or generate a receipt. Unsaved config changes are explicitly excluded. A custom script’s output cannot be evaluated by this frontend.
- Automation definitions support loss/deposit/completion/weekday-time/drawdown conditions, comparisons, target bots, duration and enabled state. Scenarios compare operator-supplied values without state changes, trigger increments or delivery. Deposit rules notify, weekday UTC rules pause all, and package completion can only request **human distribution review**, never an automatic transfer. Definitions/toggles do not schedule a background engine.
- Notification read state/preferences are local only. Guardian in-app alerts cannot be disabled. Trade, deposit threshold, KYC, payout, sound and Telegram settings describe future preferences; they do not hide source evidence or activate push permissions, audio, Telegram or an external channel. Notification evidence links into working independent source desks.

### Monaco, script safety and exports

- Added `monaco-editor` **0.57.0** as a locked dependency. Its AMD loader/editor/workers/language assets are served same-origin by `/api/bots/editor/[...path]`, confined to `node_modules/monaco-editor/min` with segment/extension validation. No CDN is required. `next.config.ts` includes these installed assets in output tracing for deploy packaging. Static installed assets are publicly cacheable; no filesystem path outside the dependency root is served. Editor initialization failure leaves an accessible functional source textarea instead of a blank editor.
- Script workflows support create/edit/save text, duplicate (new ID and zero historical counters), delete, download and attach. Filename validation requires `.js`; source is bounded to 20–50,000 characters. Attaching requires stopped/idle state and a known script; deleting an attached script is blocked, and editing source used by active/paused bots is blocked. Selecting/saving a built-in strategy detaches the script. Saving source does not certify JavaScript syntax, trust, eligibility or profitability. Monaco diagnostics are editor assistance, not a security review.
- This page contains **no eval, Function constructor or custom-strategy execution path**. Seeded Martingale/side-rotation/capped-accumulation sources are reviewable planning examples, not executable provider integrations. Production requires versioned immutable scripts, authorization, output validation, restricted APIs, resource/time limits and an isolated untrusted-code sandbox; independently enforce all capital/risk constraints.
- Actual downloads: full workspace JSON (including all source text/receipts/local audit/plans), all-bot performance CSV, readable jsPDF summary, per-bot receipt JSON, local audit/plan JSON and `.js` source. Exports cover all records independent of visible filters and are synthetic unsigned evidence, not certified provider records. Authorize/minimize future real exports server-side.

### Validation record

- **21 D-14 domain tests / 163 total tests**: fixture/receipt reconciliation, lifecycle/cooldown, allocation capacity and reservations, policy/strategy parameters, bounded exposure, Guardian conflicts, bot CRUD dependencies, automation CRUD/scenario safety, script nonexecution/attachment/deletion/editing/duplication, notifications, plan-only tests, emergency halt and rejected-command immutability.
- Production build, scoped feature lint, TypeScript and diff checks; read API projection/pagination/400/404/405 tests and legacy bot contract checks. Desktop and 390px browser workflows cover full lifecycle/config/test reviews, drawer focus, receipt pagination/download, Guardian, rule CRUD/scenarios, notifications, real local Monaco source editing, attachment/detachment, bot creation/removal, JSON/CSV/PDF downloads, emergency halt, reload reset, mobile dialogs/tables and reduced motion. No D-14 browser API writes or page runtime errors are expected. Existing unrelated repository-wide lint issues are not changed.

## D-15 · Settings (`/dashboard/settings`)

### Page, structured state and source boundaries

Settings is server-rendered and hydrated from one `SettingsWorkspace` DTO produced by `src/server/services/settings-service.ts`, then held by TanStack Query under `["settings", "workspace"]`. The workspace has seven tab sections — profile, Deriv connections, platform defaults, security, notifications, API/integration access and billing — plus local `checks` and `audit` collections. Each panel is a summary/action surface; the right inspector exposes the same state by summary, security and configuration-check views.

All values are labeled source snapshots with `asOf: 2026-10-23T10:00:00Z`, not live provider, authentication or billing observations. Edits are performed by typed local commands and reset on reload; no other workspace (D-10 through D-14) is mutated. The page deliberately separates what a backend must own: authorized identity, provider OAuth, authenticator enrollment, session invalidation, message delivery and subscriptions.

### Read contract

`GET /api/settings/workspace` is strict, read-only and cache-disabled (`no-store`):

- `?section=workspace` (default) returns the complete DTO.
- `?section=profile|connections|platform|security|notifications|integrations|billing` projects the matching section; `api-access` returns `{keys, integrations}`.
- Unknown sections or extra parameters return `400`; no POST/PATCH/DELETE handlers exist, so unsupported methods return `405`.

The future write contract from the specification remains unimplemented: `PATCH /api/user/profile`, `/api/settings/platform`, `/api/settings/notifications`, session revocation, connection OAuth/refresh/test and billing endpoints must be added with authenticated, account-scoped handlers before the local commands are replaced.

### Commands, validation and authority

`src/lib/settings/model.ts` defines a Zod-discriminated command union and applies it to a structured clone with a new revision and audit entry. Validation highlights:

- Profile: trimmed name 3–80, enumerated timezone, international phone, ≤500-character bio. Email is read-only and email changes are preview records only; usernames and roles are not changed server-side.
- Avatars: client-cropped 256 × 256 JPEG data URL only, capped by size and label; the original upload never leaves the browser and no object storage is called.
- Platform defaults: operator share 0–40%, $100–$50,000 minimum in cents, $0–$1,000 auto-approval, UTC batch time, 1/3/5/10-minute cadence, 1–500 investors, Guardian 3–15 losses and 1–15% drawdown. These default preferences do not deploy policies into D-14; the UI warns where defaults exceed D-14's harder execution caps.
- Security: IPv4/IPv6 entries are normalized and unique; CIDR ranges are rejected; whitelist mode requires keeping the current fixture address to prevent a modeled lockout. Password and two-factor flows accept only explicitly labeled demo inputs (`demo-current`, `000000`) and record preview requests without changing authentication. Session revocation marks `revoke_requested` and never claims a cookie or token was invalidated.
- Notifications: enabled channels gate event routes; Telegram handles and public HTTPS webhook URLs are validated; at least one Guardian route must remain enabled. Channel preflights are configuration-only records with no ping or HTTP request.
- Connections: Demo uses `VRTC` and Real uses `CR` identifiers; plan caps (2 Pro, 5 Team) are enforced; new accounts are `oauth_prepared` with no balance and no token. Actions mutate metadata only and invalid transitions are rejected.
- API keys: only masked prefixes and scopes persist. Generated keys are entropy-backed `demo_trademo_…` values, explicitly nonfunctional, revealed once in a modal and never stored in workspace state, API reads, exports or audit records.
- Integrations: HTTPS endpoints without credentials/fragments and `vault://` secret references only; signing secrets are never collected. Drafts do not register webhooks or start OAuth.
- Billing: upgrade, cancellation and payment-reference commands create local requests or a masked demo reference while plan, renewals, entitlement limits and invoices remain unchanged.

Invalid commands throw before mutation, leaving the workspace atomic. Checks and audit entries use `configuration_only` and "Local preview only" language so no delivery, latency or provider acknowledgement is fabricated.

### UI, responsiveness and accessibility

`src/styles/pages/dashboard-settings.css` is scoped under `.page-dashboard-settings` and uses the existing institutional light palette and `--accent` token. The tab strip scrolls horizontally on small screens; forms collapse to one column; connection metrics stack; and notification routing switches from a scrollable matrix to per-event wrapped channel toggles below 768px. Dialogs trap focus, restore it on close, support Escape and lock body scroll; wizard progression refocuses the modal, and the final acknowledgement is required before any command runs.

The page provides 30 dialog kinds and 19 multistep workflows (three stages), a three-view right drawer, and six workbench actions. Exports are real downloads: the JSON workspace, local audit JSON, 256 px cropped avatar and jsPDF invoice/summary documents are generated locally; all exports exclude demo raw keys, password drafts and backup codes. No placeholder links remain: footer and panel links point to existing D-10–D-14 routes or open local dialogs.

### Validation record

- `node --test tests/settings.test.cjs`: 18 feature tests covering DTO structure, atomic commands, profile/avatar, platform bounds, security normalization and lockout, 2FA/password previews, session revocation, notification routing, connection caps, configuration checks, API-key metadata, integrations, billing isolation and page/CSS contracts.
- Full suite: 181 tests passing.
- TypeScript and scoped ESLint are clean; `next build` succeeds.
- Playwright production browser suite passed all seven tabs, profile/email/role updates, image cropping, connection preparation and checks, validation guards, password/2FA/backup codes, IP/whitelist lockout prevention, channel drafts and preflights, key generation/reveal, integration drafts, billing PDF, JSON export, inspector, audit help, 390 px layouts and reduced motion, with no API writes or page errors.
- API suite verified strict section projections, `no-store`, `400`/`405` behavior, absence of write handlers, and continued availability of D-10–D-14 routes.

## I-1 · Investor Overview (`/investor`)

### Page, shell and structured state

The investor workspace is a separate desk from the operator console. `src/components/investor/investor-shell.tsx` renders its own rail (Portfolio / Account groups), sticky topbar with search, notification bell, inspector toggle, light-default theme toggle and profile entry, a persistent six-link quick-action dock, a mobile tab bar and a right inspector host. It is NOT built on `MarketingShell`; the earlier marketing bridge for `/investor` and `/investor/pools/[id]` was replaced by the real page and a redirect.

`/investor` is server-rendered from one `InvestorWorkspace` DTO produced by `src/server/services/investor-service.ts` and hydrated through `src/lib/investor/use-investor.ts` under `["investor", "overview"]`. Section keys reserved for the spec's later pages are `["investor","active-pools"]`, `["investor","earnings-ticker"]`, `["investor","upcoming-pools"]` and `["investor","recent-activity",{limit}]`; the shipped page derives those views from the same DTO so the cache shape is already stable.

Every displayed total is derived, never duplicated: `poolProgress` (raised/goal), `unrealizedTotal` and `monthEarned` (realized distributions + unrealized pool profit), `monthRoi`, `countdownLabel`, `daysSince` and `relativeLabel` live in `src/lib/investor/model.ts`. The fixture snapshot is `asOf: 2026-10-23T10:00:00Z` and the service returns a deep copy per request, so no caller can mutate shared state.

### Read contract

`GET /api/investor/overview` is strict, read-only and `no-store`:

- `?section=workspace` (default) returns the whole DTO.
- `?section=summary|active-pools|earnings|upcoming|activity|portfolio|wallet|notifications|trades` projects one section.
- Unknown sections, duplicate keys or extra parameters return `400`; there are no write handlers (`405`).

Required backend endpoints remain unimplemented and must arrive with authenticated, account-scoped handlers: `POST /api/investor/bookings`, `POST /api/investor/payouts`, `PATCH /api/investor/notifications/read`, `PATCH /api/investor/preferences`, `PATCH /api/user/profile`, `POST /api/investor/support`, `POST /api/investor/reminders`, plus provider feed and settlement reconciliation.

### Commands and local authority

`src/lib/investor/model.ts` defines a Zod-discriminated union applied to a structured clone with a new revision and audit entry. All eleven commands are session-only:

- `refreshEarnings` (manual/auto) resets the three-minute countdown to 180s, restamps the ticker rows and refuses automatic runs when `preferences.autoRefresh` is off.
- `markRead`/`markAllRead` clear unread markers on notifications and the activity ledger (an id may address either collection).
- `bookSlot` accepts 1–10 slots, requires `slots × minInvestment` exactly, rejects duplicate holds and over-capacity requests, and writes a `preview_hold` booking without touching wallet or committed capital.
- `setReminder`/`removeReminder` enforce the pool's actual lead-time window; a second reminder for the same pool is rejected.
- `requestPayout` reuses `payoutIssue` (active method, two-decimal amount, per-method minimum, withdrawable ceiling) and stores a `preview_waiting_source` draft; the withdrawable balance never changes.
- `saveCalculator` stores a scenario with its projected profit; `savePreferences` rejects zero channels, identical quiet hours and disabling email while a payout draft exists; `updateProfile` changes the display name only; `support` writes a `local_draft` ticket.

Invalid commands throw before mutation, leaving the workspace atomic; the UI surfaces the message inline and never partially applies.

### UI surface

`src/styles/pages/investor-overview.css` is scoped under `.page-investor-overview` and extends the existing light institutional palette (one `--accent`, hairline borders, tabular numerics, no gradients). The page ships four KPI cards, two active pool cards with funding progress and Guardian posture, the earnings ticker with countdown ring and Refresh Now, three upcoming windows, the eleven-row activity ledger, the quick-action grid and the footer.

- **26 dialog kinds**, of which **8 are three-step wizards** (book slot, reminder, payout, calculator, export, notification preferences, profile, support) with a required acknowledgement before any command runs.
- A three-view right drawer (portfolio with allocation mix, activity, Guardian policy) and a six-link bottom dock plus four page-level quick cards — all opening pages, dialogs or wizards.
- Real downloads: JSON/CSV workspace exports, jsPDF statement and per-distribution receipt PDFs. Exports contain only structured source data and local session records.
- No dead ends: `/investor/{pools,earnings,wallet,calculator,investments,notifications,activity}` and `/investor/pools/[id]` resolve to the overview with the relevant section or workflow focused (`?focus=`, `?action=`, `?pool=`), and every footer link points at an existing route.

Dialog layers trap focus, restore it, close on Escape/backdrop and lock body scroll; anchors use `scroll-margin-top` so navigation never hides content under the sticky chrome; the dock is parked while a dialog owns the screen. Motion is limited to the 60 ms card stagger, chart-draw progress and the Guardian pulse, all disabled under `prefers-reduced-motion`. Layout is 4/2/1 KPI columns, 2/1 pool cards and 3/2/1 upcoming cards; at 390 px there is no horizontal overflow and wizard steps stay on one line.

### Validation record

- `node --test tests/investor.test.cjs`: 19 tests covering the fixture contract, selectors and clamping, countdown/relative labels, the command schema, `payoutIssue` branches, immutability and audit, booking allocation rules, payout drafts, reminder lifecycle and preferences, profile/support/calculator isolation, refresh semantics and per-request fixture isolation.
- TypeScript and scoped ESLint clean; `next build` succeeds.
- Playwright production run verified every route, all ten API projections plus `400`/`no-store`, deep links (`?pool=`, `?action=`, `?focus=`), all 26 dialogs with their visible controls, all eight wizards through acknowledgement, the three drawer tabs, the ticker countdown, focus trapping, Escape close, light-mode default and 390 px layout with zero console or page errors.

## I-2 · Crowdfunding Pools (`/investor/pools`)

### Page, shell and structured state

`src/app/investor/pools/page.tsx` is a server component that renders `getPoolsWorkspace()` into `InvestorPoolsPage` (`src/components/investor/investor-pools-page.tsx`, client) with the shared `InvestorShell`, so the sidebar, telemetry bar, dock and theme toggle are identical to I-1. It accepts `?pool=<id|code>` and `?action=<book|reminder|prebook|statement|compare|calculator|risk|support|fees|roadmap>`, which open the matching dialog on first paint. `/investor/pools/[id]` now renders the I-3 detail page (see below); the register itself is still reachable from that page's breadcrumb, header and footer links.

`src/lib/investor/pools.ts` is the single source of truth — a deterministic `POOLS_AS_OF = 2026-10-23T10:00:00Z` snapshot typed as `PoolsWorkspace`:

- `trading` (PKG-01, PKG-03) with funding goal/raised, slot price and fill, the investor's slots/allocation/profit share, window dates, pool P&L and share P&L, trade count, win rate, settlement batch and a `GuardianSnapshot` (loss streak against limit, drawdown against policy band, last check, note).
- `open` (PKG-02, PKG-09) with min slot, per-investor slot cap, duration, expected ROI, funding progress, booked slots, the investor's own booked slots/investment, payment state (`verified | pending | partial`) with reference, and investor count.
- `upcoming` (PKG-04, PKG-05) with open/close dates, expected ROI, target, expressed interest and an eligibility note.
- `completed` (PKG-00, PKG-02 cycle 1, PKG-06) with realized ROI, gross, platform cut, net, payout state and reference, and reconciliation state.
- `roadmap` (seven milestones incl. the announced token launch flagged `state: "token"`, which is explicitly not an investor return), `trades`, `guardianLog`, `reminders`, `bookings`, `interests`, `scenarios`, `support`, `preferences`, `audit` and `summary`.

Selectors (`fillPct`, `netOfCut`, `hoursUntil`, `endingSoon`, `bookableSlots`, `committedTotal`, `lifetimeNet`, `upcomingByDate`, `nextMilestone`, `reachedRoi`, `daysBetween`, `countdown`, `relativeFrom`) keep every derived figure out of the components, so swapping the fixture for a backend payload changes nothing in the view layer.

### Read contract

`src/server/services/investor-pools-service.ts` returns a `structuredClone` per call (callers can never mutate shared state) and exports `reachedRoiTotal()` for weighted realized return.

`GET /api/investor/pools?section=<workspace|summary|trading|open|upcoming|completed|roadmap|trades|reminders>` is a strict read-only projection: unknown sections and duplicate query parameters return `400`, every response is `Cache-Control: no-store`, and any non-GET verb returns `405` — booking, reminders, interest and payout are backend integrations, not client authority.

`src/lib/investor/use-pools.ts` holds the client cache under `["investor","pools-overview"]` with the server snapshot as `initialData`, so the page paints from structured props and never blocks on a fetch.

### Commands and local authority

`poolsCommandSchema` is a Zod discriminated union over eight commands, applied to a clone with a new revision and an audit entry (audit capped at 40). Every mutation is session-only and the UI says so:

- `refreshPools` (manual/auto) re-reads the snapshot clock, refuses automatic runs when `preferences.autoRefresh` is off and never changes provider data.
- `bookSlots` (1–10) validates the pool is open, the booking window has not closed, the request fits `bookableSlots` (per-investor headroom ∩ remaining capacity) and the target is not exceeded; it holds capacity locally, marks payment `pending` and writes a `preview_hold` booking.
- `setReminder`/`removeReminder` reject duplicates and lead times longer than the pool's own open window.
- `prebookInterest` rejects duplicate interest and slot counts above the per-investor cap; it raises expressed interest only.
- `saveScenario` stores a projection (newest first, capped at 10) with its computed profit.
- `support` writes a `local_draft` ticket (topic enum, 12-char minimum) and transmits nothing.
- `recordExport` logs the exported scope/format/record count so the ledger reflects real downloads.

Invalid commands throw before mutation, so the workspace stays atomic.

### UI surface

`src/styles/pages/investor-pools.css` is scoped under `.page-investor-pools` and continues the I-1 light palette (one `--accent`, hairline borders, tabular numerics, no decorative gradients). The page renders the header with snapshot metadata, a source banner with Refresh and Integration boundaries, four summary stats (committed capital, next allocation window with live countdown, lifetime net, bookable slots), the status-chip toolbar with search, risk filter, sort and a Cards/Table toggle, then six numbered sections: **01** active pools, **02** open-for-booking, **03** upcoming windows, **04** completed cycles with net-of-cut figures, **05** the launch roadmap (timeline with milestone briefs), **06** quick actions and secondary links.

- **25 dialog kinds**, of which **8 are three-step wizards** (book more slots, reminder, pre-book interest, statement, calculator, risk profile, alert preferences, support) with a required acknowledgement before any command runs.
- Compare, pool/trade/Guardian/open/payment/upcoming/completed/payout/roadmap detail views, filters, fees, ledger, help and reminders round out the set; the table view is a real TanStack table (`useDeskTable` with sortable headers), and compare caps the selection at four pools.
- A three-view right drawer (allocation with per-pool mix, capital, timeline) and six bottom-dock quick actions plus four page-level quick cards — all opening pages, dialogs or wizards.
- Real downloads: JSON/CSV/PDF statements (jsPDF imported on demand), per-completed-pool payout PDFs and a roadmap export; JSZip-free, fully in-browser.
- No dead ends: every button opens a dialog or navigates to an existing route (`/investor`, `/investor/calculator`, `/investor/earnings`, `/investor?action=payout`, `/dashboard`), the trading-pool dialog links straight to the full I-3 workspace, and the ledger merges source rows with local audit entries behind a "local only" toggle.

Dialogs trap focus, restore it, close on Escape/backdrop and lock body scroll; anchors use `scroll-margin-top`; the dock hides while a dialog or drawer owns the screen. Motion is limited to a 60 ms card stagger, progress draw and one check-in animation, all disabled under `prefers-reduced-motion`. Layout is 4/2/1 stats, 3/2/1 pool cards, and at 390 px there is no horizontal overflow, wizard steps stay on one line and the card/table toggle remains reachable.

### Validation record

- `node --test tests/investor-pools.test.cjs`: 21 tests covering the fixture contract (trading/open/upcoming/completed/roadmap), selectors and clamping, countdown/relative labels, the 72-hour ending-soon window, bookable-slot bounds, the command schema, immutability, booking allocation and rejection branches, reminder lifecycle, interest limits, projection capping, local support/export/refresh semantics and the audit cap.
- Full suite: `node --test tests/*.test.cjs` → 221/221 pass.
- TypeScript clean; `next build` succeeds; the whole register renders from server props with no client fetch on first paint.
- Playwright production run verified all routes and API projections, the six sections, all 25 dialogs with their visible controls, all eight wizards through acknowledgement, the three drawer tabs, compare/filters/table views, deep links (`?pool=` across every lifecycle, `?action=`) and the permalink bridge, light-mode default, zero console or page errors, and a 390 px layout with no horizontal overflow.

## I-3 · Pool Detail (`/investor/pools/[id]`)

### Page, shell and structured state

`src/app/investor/pools/[id]/page.tsx` is a server component that resolves the pool through `getPoolDetailWorkspace(id)` and renders `InvestorPoolDetailPage` (`src/components/investor/investor-pool-detail-page.tsx`, client) inside the shared `InvestorShell`, so sidebar, telemetry bar, dock and theme toggle stay identical to I-1/I-2. It accepts `pkg_02` or `PKG-02` (case-insensitive) plus `?action=`/`?tab=` deep links (`book`, `payout`, `statement`, `reminder`, `alerts`, `projection`, `risk`, `support`, `trades`, `guardian`, `participants`, `documents`, `activity`, `schedule`, `compare`, `share`, `interest`, `overview`, `performance`, `fees`, `payoutRecord`, `help`), which open the matching dialog on first paint. Unknown ids return the standard 404 instead of silently redirecting.

`src/lib/investor/pool-detail.ts` is the single source of truth — a deterministic `POOL_DETAIL_AS_OF = 2026-10-23T10:00:00Z` snapshot typed as `PoolDetailWorkspace`:

- `overview` (code, lifecycle, strategy, thesis, markets, risk band, manager, booking/trading windows, profit-share date, goal/raised, slot price and fill, investors, profit share %, settlement batch, Guardian summary).
- `investment` (slots, capital, capital share, token allocation, pool P&L, gross, platform cut %, cut, net, ROI, paid, drafted, refresh cadence and 14 dated daily rows) or `null`, plus `booking` (slots, amount, payment state, reference, available headroom) and `interest`.
- `performance` (total P&L, wins/losses/open, win rate, max drawdown with date, Guardian triggers, recovery label, average duration, best/worst trade with the investor's share, 15-point equity curve, benchmarks) or `null` for pools that have not traded.
- `guardian` (status, streak, policy limits, rotation, triggers, recovery, four typed events), `participants` (aggregate + anonymised rows, tail, capital bands, publish gate), `trades`, `events`, `documents`, `schedule`, `related`, `watching`, `preferences`, `reminders`, `payouts`, `projections`, `support`, `audit` and `profile`.
- `projection` publishes the desk's expected return for pools without a settled position.

Selectors (`detailFillPct`, `capitalSharePct`, `tradingElapsedPct`, `hoursUntil`, `countdownFrom`, `relativeTo`, `sumDaily`, `roiOn`, `drawdownHeadroom`, `durationLabel`, `withdrawableNet`) keep every derived figure out of the component, so a backend payload can replace the fixture without touching the view layer. Fixtures reconcile with I-1/I-2: `pkg_01` is 36,000 raised on a 50,000 goal (12 of 25 slots), the investor's 15,000 is a 41.7% share, 1,260 gross becomes 1,008 net after the 20% platform cut (6.72% ROI), and every pool's participant rows plus tail sum to committed capital.

### Read contract

`src/server/services/investor-pool-detail-service.ts` assembles the workspace from the I-2 pool book plus per-pool detail seeds, returns a fresh object per call, and exports `listPoolDetailIds()`.

`GET /api/investor/pools/:id?section=<workspace|overview|investment|performance|guardian|participants|trades|schedule|documents|events>` is a strict read-only projection: an unknown section or duplicate query parameter returns `400`, an unknown pool returns `404`, every response is `Cache-Control: no-store`, and there is no write handler, so mutations return `405`.

`src/lib/investor/use-pool-detail.ts` caches under `["pools", poolId, "workspace"]` with the server snapshot as `initialData`, so the page paints from structured props and never blocks on a fetch.

### Commands and local authority

`poolDetailCommandSchema` is a Zod discriminated union over ten commands, applied to a clone with a new revision and an audit entry (capped at 40). Every mutation is session-only and the UI says so:

- `refreshDetail` (manual/auto) re-reads the snapshot clock, refuses automatic runs when `preferences.autoRefresh` is off and never changes provider data.
- `bookSlots` (1–10) requires an open pool, checks the per-investor headroom and the remaining target, raises raised/slots filled, marks payment `pending` and writes a local booking hold.
- `draftPayout` (min 100) cannot exceed `withdrawableNet`; it appends a draft and raises `pendingPayout` without moving money.
- `setReminder` rejects duplicates, lead times longer than the pool's own window and completed cycles.
- `savePreferences` requires at least one channel; `saveProjection` stores newest-first and caps at ten; `prebookInterest` is limited to upcoming pools, once per pool and to `slotsTotal / investors`.
- `setWatch`, `support` (12-char minimum, `local_draft`) and `recordExport` log local state only.

Invalid commands throw before mutation, so the workspace stays atomic.

### UI surface

`src/styles/pages/investor-pool-detail.css` is scoped under `.page-investor-pool-detail` and continues the I-1/I-2 light palette (one `--accent`, hairline borders, tabular numerics, no gradients anywhere). The page renders a breadcrumb + lifecycle/risk header with lifecycle-aware primary CTA, a source banner with refresh countdown, then eight numbered sections: **01** pool overview (facts, funding progress, booking/trading/profit-share windows, trading elapsed, Guardian card, timeline), **02** your investment (position or booking/expected-at-minimum, 14-day live earnings histogram), **03** performance (six KPIs, equity curve, benchmarks, best/worst), **04** AI Guardian (policy gauge, settings, trigger history), **05** participants (aggregate stats, capital bands, sortable TanStack table with a publish gate), **06** documents (in-browser PDF/CSV/JSON downloads plus queued reminders and payout drafts), **07** activity ledger (source events merged with local commands, local-only filter), **08** related cycles, four quick-action cards and six secondary links.

- **25 dialog kinds**, of which **9 are three-step wizards** (book slots, payout, statement, reminder, alert preferences, projection, risk acknowledgement, support, register interest), each with a required acknowledgement before the command runs.
- Read-only surfaces: overview method, timeline, earnings attribution, performance method, trade ledger with filters, trade settlement drill-down, Guardian history/policy, participants, fees, payout record, document centre, activity log, compare table (sortable TanStack), share permalink with clipboard copy, and workspace boundaries.
- A three-view right drawer (position, trades, Guardian) and a six-action bottom dock (`Open now`/`Book slots`/`Register interest` by lifecycle) plus four page-level quick cards — every one opens a dialog, wizard or existing route.
- Real downloads: statements in PDF/CSV/JSON, factsheet/policy/statement/ledger documents and payout-record PDFs, all generated in-browser from the same snapshot and logged in the ledger.
- No dead ends: completed cycles route the dock to the pool register and the reminder action to the timeline, deep links seed wizard defaults (including the payout amount), and footer links resolve to `/investor/pools`, `/investor/calculator`, `/investor/wallet` and `/dashboard`.

Dialogs trap focus, restore it, close on Escape/backdrop and lock body scroll; anchors use `scroll-margin-top`; the dock hides while a dialog or drawer owns the screen; wizard chrome keeps all three steps on one line at 390 px. Layout is 6/3/2 KPI columns, 2/1 performance, Guardian and participant grids, and a 4/2/1 quick-action grid; the mobile page clears the bottom nav with 84 px of padding and has no horizontal overflow.

### Validation record

- `node --test tests/investor-pool-detail.test.cjs`: 32 tests covering id/code resolution and 404s, the fixture contract for trading/open/upcoming/completed pools, investment/profit-share reconciliation, performance and Guardian consistency, participant reconciliation for all nine pools, selector clamping, countdown/relative labels, the ten-command schema, immutability, booking/payout/reminder/interest/projection/preference/support/export branches, the audit cap, and static wiring of the API route, page route, component and stylesheet.
- Full suite: `node --test tests/*.test.cjs` → 253/253 pass.
- TypeScript clean; `next build` succeeds with `/investor/pools/[id]` dynamic.
- Playwright production run verified every lifecycle deep link, all 25 dialogs, all nine wizards through acknowledgement (booking, interest, statement CSV download, payout draft, support), real document/payout downloads, trade drill-down, the three drawer views, watch toggle, compare sorting, the completed-pool dock, light-mode default, zero page errors and zero horizontal overflow at 390 px.

## Investor shell navigation (I-1 / I-2 / I-3 as real routes)

The three built investor pages are separate routes, each with its own page component, stylesheet and data service, and each keeps its own modals, wizards, drawer and dock local to that page. To move between them, `InvestorShell` (`src/components/investor/investor-shell.tsx`) now renders the first nav group — **Investor pages** — as `next/link` anchors instead of buttons:

| Nav entry          | Route             | Code |
| ------------------ | ----------------- | ---- |
| Investor overview  | `/investor`       | I-1  |
| Crowdfunding pools | `/investor/pools` | I-2  |
| Pool detail        | `detailHref`      | I-3  |

- `detailHref?: string` (default `/investor/pools`) tells the shell which pool the I-3 entry opens. I-1 passes its first active pool, I-2 passes the highlighted/selected pool (falling back through trading, open, upcoming, completed, then `pkg_01`), and I-3 passes its own pool plus `activeNav="detail"`.
- The remaining groups (**Portfolio**, **Account**) stay in-page actions: they open modals, wizards, the right drawer or scroll to a section on the current page, so no route can trigger a dialog owned by another page.
- The command palette, the mobile bottom nav (`Overview` / `Pools` / `Detail` / `Portfolio` / `Wallet` / `More`) and the sidebar all use the same links, so a page change always unmounts the previous page's dialogs (verified: opening a dialog on I-1 or I-2 and then navigating leaves zero `.desk-modal` nodes and zero backdrops).
- Styling is additive in `src/styles/components/investor-shell.css`: `a.op-nav-link` drops underlines, `.op-nav-link--page` keeps button metrics, `.op-nav-code` renders the mono I-1/I-2/I-3 badge (hidden in the collapsed rail), and the mobile nav is a six-column grid with ellipsised labels at 390 px.

Static probes cover the shell props (`tests/investor-shell-nav.test.cjs`); the shell-nav suite adds 11 checks (full suite 264/264), `tsc --noEmit` is clean and `next build` succeeds with all three routes.

## I-4 · Pool Booking & Payment (`/investor/pools/[id]/book`)

Route `src/app/investor/pools/[id]/book/page.tsx` (`force-dynamic`) renders `InvestorPoolBookingPage` and resolves the pool by id or public code (`pkg_02` / `PKG-02`); unknown ids 404 while pools outside an open window still render with a blocked-state hand-off instead of dead-ending.

### Data layer

- `src/lib/investor/pool-booking.ts` — the `PoolBookingWorkspace` DTO: pool window facts, existing booking, five payment rails (`wallet`, `bank_transfer`, `mobile_money`, `card`, `crypto`) with their required field specs, escrow coordinates, three declarations, reservation records, history, saved instruments and local drafts. Selectors (`slotsForYou`, `bookingTotals`, `feeFor`, `totalDue`, `walletShortfall`, `bookingStageRows`, `reservationWindow`) drive every number in the UI.
- `bookingDraftError()` is the single validation source for the review step, and `buildBookingPayload()` emits exactly the `POST /api/investments` body from the spec (pool, slots, method, rail-specific details, three term flags, amount, fee, total).
- `applyBookingCommand()` validates a ten-command discriminated union and returns an immutable, audited clone: `refreshBooking`, `createBooking`, `advanceBooking` (received → verified → confirmed), `cancelBooking`, `acknowledge`, `topUpWallet`, `saveProjection`, `saveReferral`, `support`, `recordExport`. Nothing charges a card, moves escrow or confirms a slot with a provider.
- `src/server/services/investor-pool-booking-service.ts` builds the fixture from the same pool book as I-2/I-3, so slot prices, targets, raised capital, durations and participant counts agree across the three pages.
- `src/lib/investor/use-pool-booking.ts` keeps the specified TanStack Query keys — `["pools", id, "booking-context"]`, `["investments", "my-bookings", id]`, `["investments", bookingId, "status"]` — so a backend can split the read without touching the view.
- `src/app/api/investor/pools/[id]/book/route.ts` is a read-only projection with a `section` filter (`workspace`, `pool`, `profile`, `existing`, `methods`, `escrow`, `terms`, `records`, `history`, `savedMethods`); writes stay explicit backend integrations (mutation attempts return 405).

### UI surface

`src/styles/pages/investor-pool-booking.css` is scoped under `.page-investor-pool-booking` and continues the I-1/I-2/I-3 palette (one accent, hairline borders, tabular numerics, no gradients). A five-step stepper (horizontal at md+, stacked at sm, with a progress fill) fronts the five spec sections: **01** pool details (status, closing countdown with icon-pulse under 24 h, min/max slots, availability, target/raised progress, current bookings, window calendar, Guardian note), **02** select slots (`+`/`−` picker with hover-lift, quick counts incl. max, live investment/token/share/fee/total maths, current vs after-booking vs headroom panels), **03** payment method (staggered selectable rail cards with selected-lift and a wallet-shortfall flag, per-rail forms with inline validation, saved-account prefill), **04** review & confirm (order summary, escrow instructions with copy/download, three term declarations, guard message, confirm), **05** payment status (five-stage tracker with icon-spin on pending and check-draw on done, 72-hour reservation countdown, receipt, simulated operator steps, cancellation), plus a source banner, local-command ledger and six-link footer.

- **21 dialog kinds**, of which **six are three-step wizards** (risk disclosure, support, cancellation, wallet top-up, projection, referral), each with a required acknowledgement before the command runs.
- Read-only surfaces: terms, lock-up/early exit, fees by rail, 72-hour hold policy, rails & limits, escrow coordinates, KYC & funds source, order summary, after-payment timeline, booking history (sortable TanStack table with search and export), receipt, reservation timeline, share link, workspace boundaries.
- A three-view right drawer (summary, tracker, fees) and a six-action bottom dock (`Slots`, `Method`, `Order`, `Receipt`, `Support`, `Pools`) — every one opens a dialog, wizard, section or existing route.
- Real downloads: order summary, payment instructions, receipt and booking history in PDF/CSV/JSON, generated in-browser from the same snapshot and logged as exports.
- No dead ends: blocked windows explain themselves and route to the pool detail page or the register, I-3's book-slot wizard links here, I-2's booking wizard links here, and the shell gains an **I-4 Book & pay** nav entry (`bookHref`).

### Validation record

- `node --test tests/investor-pool-booking.test.cjs`: 31 tests covering id/code resolution, the spec's headline figures, lifecycle gating, cross-page participant reconciliation, rail fees and field specs, wallet coverage rules, slot maths and the specification's 3-slot sample ($15,000 / 15,000 bmX / 34.88% / 5 slots after), per-field validation, every draft guard, the `POST /api/investments` payload, tracker states for pending/confirmed/cancelled records, the reservation window, all ten commands with their failure branches, audit capping, deterministic references, and static wiring of the route, API, component and stylesheet.
- Full suite: `node --test tests/*.test.cjs` → 295/295 pass.
- TypeScript clean; `next build` succeeds with `/investor/pools/[id]/book` dynamic.
- Playwright production run verified all nine pools (id and code), the blocked states for trading/upcoming/completed windows, every section and dialog, all six wizards through acknowledgement, the wallet shortfall and top-up draft, the full booking → received → verified → confirmed path, cancellation, receipt PDF download, mobile nav at 390 px (six columns, no overflow), zero page errors and zero horizontal overflow.

## I-5 · Live Trade Tracker (`/investor/live`)

Route `src/app/investor/live/page.tsx` (`force-dynamic`) renders `InvestorLiveTradePage` from a single server snapshot. `?action=` deep links open any dialog, so the tracker is addressable without clicking through (18 mapped actions, mirroring the I-4 pattern). The page is deliberately numbers-only per the spec: no charts, no candles, no order entry.

### Data layer

- `src/lib/investor/live-trades.ts` — the `LiveTradeWorkspace` DTO (stream health, profile, running totals, two live pools, a 47-trade feed, five tickers, session statistics, four bots, Guardian alerts, guardrails, watchlist, filters, preferences, rules, exports, support drafts, audit). `applyStreamEvent()` is the reducer a socket handler would call: it accepts `investor:trade_result`, `investor:tick_update`, `investor:ai_guardian` and `investor:earnings_update`, caps the feed at 200 trades and recomputes totals, session stats and bot cards from the new feed so no surface can drift. `nextSyntheticTrade()` / `nextTicks()` are a deterministic stand-in for the socket; `filterFeed()`, `deriveTotals()` and `recomputeStats()` are pure selectors.
- The platform cut is modelled exactly: the investor share is the net amount, and the 20% cut is derived from it, so a $28 trade in a 30% pool yields $10.50 gross, $2.10 cut and the spec's **$8.40** net.
- `applyLiveCommand()` validates a twelve-command discriminated union (`refreshStream`, `pauseBot`, `resumeBot`, `pausePool`, `resumePool`, `acknowledgeAlert`, `saveFilters`, `setStreamPaused`, `savePreferences`, `toggleWatch`, `saveAlertRule`, `exportFeed`, `support`) and returns an immutable, audited clone. Guardian `alert` level blocks a resume; a paused pool pauses its bots.
- `src/server/services/investor-live-service.ts` authors today's session as an explicit 47-row recipe and derives everything else from it. The mix reconciles exactly: PKG-01 25 trades 16W/9L = **+$133**, PKG-03 22 trades 13W/9L = $0 → 47 trades, **29 wins / 18 losses (61.7%)**, **+$133**, **your share +$39.90**, best **+$8.40**, worst **−$10.50**, longest win streak **5**, average hold **18 s**. Bot cards are computed from the same rows (Bot-Alpha 12 trades / +$84, Bot-Delta 13 / +$49, Bot-Bravo 13 / $0, Bot-Charlie 9 / $0 with a four-loss cooldown), so bot P&L always adds up to the pool session P&L. Pool capital, share percentages and cumulative P&L come from the shared pool book used by I-2/I-3/I-4.
- `src/lib/investor/use-live-trades.ts` keeps the specified TanStack Query keys — `["investor","live-totals"]` (5 s), `["investor","session-stats"]` and `["investor","active-bots"]` (30 s), plus `["investor","trade-feed",limit]` — over a hydrated workspace key; `push()` applies a stream event through the cache, and a real socket would call it from its message handler.
- `src/app/api/investor/live/route.ts` is a read-only projection: `?section=workspace|totals|feed|ticks|stats|bots|alerts|pools|profile|stream`, with `pool`, `result` and `limit` filters on the feed, `no-store` caching and 405 on writes.

### UI surface

`src/styles/pages/investor-live.css` (~2 900 lines) is scoped under `.page-investor-live` and continues the investor palette (one accent, hairline borders, tabular numerics, no gradients; dark-mode safe because every colour is a token). Five sections with a jump bar:

- **01 Running totals** — six count-up KPIs: running capital **$25,000**, pool P&L **+$17,700**, pool ROI **+10.4%**, your share P&L **+$2,610**, **47** trades, and the last-trade clock with a pulsing activity icon.
- **02 Live trade feed** — newest-first, windowed (16 rows, +12 per “Load more”, 200-trade cap) with a 320 ms slide-in and an 800 ms `row-flash-win`/`row-flash-loss` on arrival. Each row carries ✅/✖ result, symbol, contract, stake → payout, P&L, your share, UTC time and a meta line (bot, pool, entry → exit, hold, share %, trade id). Filter chips, clear-all, empty state and a compact density mode.
- **03 Symbol tickers** — five one-second tickers (R_10, R_50, R_100, R_75, 1HZ10V) at 2-up sm / 3-up md / 4-up lg, each with price, arrow + percentage, session high/low, tick rate, owning pools and a watchlist tile.
- **04 Session statistics** — eight tiles (trades, win rate with a proportion meter, net P&L, your share, best, worst, longest win streak with the current streak, average hold) plus a by-pool / by-symbol / by-hour breakdown table.
- **05 Bots & Guardian** — four bot cards (status dot, pool, trades, win rate, stake, today's P&L, Guardian level, cooldown countdown, pause/resume) over the Guardian alert list (acknowledge inline) and the four desk guardrails.
- **19 dialog kinds**, of which **six are multi-step wizards** (pause a bot, stream preferences, alert threshold, export, support, feed filters), each with a final acknowledgement. Read-only surfaces: trade detail, ticker detail, bot execution, pool in your live book, journal (sortable TanStack table with search and row → trade), stream diagnostics with the four event payloads, session report, guardrails, alerts, shortcuts, workspace boundaries, share link, and the share-payout maths.
- A three-tab right drawer (overview, feed, bots) and a six-action bottom dock (`Pause`, `Filter`, `Export`, `Alerts`, `Journal`, `Pools`) behind the shell's Guardian shortcut; every action opens a dialog, wizard, section or existing route.
- No dead ends: the ticker/pool/bot dialogs link to the I-3 pool page and I-4 booking route, the earnings dialog links to `/investor/earnings`, empty filters explain themselves, and the shell gains an **I-5 Live trade tracker** nav entry visible on every investor page.

### Validation record

- `node --test tests/investor-live.test.cjs`: 30 tests covering the spec's headline figures, feed ↔ pool ↔ bot reconciliation, feed ordering and payload fields, the 20% cut maths, ticker cadence, the streaming reducer (trade insert, 200-trade cap, tick direction/percentage agreement, guardian and earnings pushes), all command success and failure branches, formatting, selectors on arbitrary slices, and static wiring of the route, API, component, stylesheet, shell entry, dialogs, wizards and dock.
- Full suite: `node --test tests/*.test.cjs` → **325/325 pass**. TypeScript clean; `next build` succeeds with `/investor/live` dynamic.
- Playwright production run: all 18 `?action=` dialogs open with the right title (6 wizard bars), trade/ticker/pool detail flows, the pause-bot wizard end to end (steps → review → acknowledgement gate → paused card), resume, alert acknowledgement, filters applied to the feed (11 of 47), load-more (16 → 28 rows), journal search/sort/row-to-trade, stream pause freezing the tickers and resume, drawer tabs, dock actions, cross-page navigation from `/investor`, and the 390 px mobile pass (2-up KPIs, single-column cards, 356 px modal, full-width drawer, zero horizontal overflow, zero page errors).

## I-6 · My Investments (`/investor/investments`)

Route `src/app/investor/investments/page.tsx` (`force-dynamic`) replaces the old redirect stub and renders `InvestorInvestmentsPage` from one server snapshot. `?action=` deep links open any dialog directly (24 mapped actions, same pattern as I-4/I-5). This is a holdings ledger, not a marketing page: the same book backs the pool pages, the live tracker and this page.

### Data layer

- `src/lib/investor/investments.ts` — the `InvestmentsWorkspace` DTO (profile, summary, active positions, settled cycles, booked slots, payouts, 22-event timeline, documents, notes, allocations, KYC block, payout policy, milestones, filters, preferences, exports, support drafts, audit) plus every pure helper the page uses: `money`/`signedMoney`/`signedPct`/`dateOf`/`clockOf`/`atStamp`, `countdown`/`daysBetween`, `computeSummary`, `payoutEligibility`, `payoutDraftError`, `payoutFee`, `suggestedPayout`, `filterTimeline`, `groupTimeline`.
- `computeSummary()` is the single source of every headline number: `totalInvested 58,500`, `activeCapital 25,000` (2 pools), `totalEarned 5,029.20`, `completedCapital 21,000` (3 cycles), `completedNet 2,419.20`, `bookedCapital 12,500` (2 bookings), `interestCapital 6,000`, `pendingPayoutAmount 118.50`, `paidPayoutAmount 2,419.20`, `deployedCapital 46,000`, `overallRoiPct 10.93`.
- `applyInvestmentsCommand()` validates a **twelve-command** discriminated union (`requestPayout`, `cancelPayout`, `retryPayout`, `cancelInterest`, `saveReminder`, `clearReminder`, `acknowledge`, `savePreferences`, `saveFilters`, `exportReport`, `addNote`, `support`) against zod and returns an immutable, audited clone whose `summary` is recomputed, so a payout request changes the KPI row and the timeline together. The payout lock (10 days), the $50 minimum, the available balance and the bank-account gate are all enforced in the reducer, not just the form.
- `src/server/services/investor-investments-service.ts` derives every position from `getPoolsWorkspace()` — the book used by I-2/I-3/I-4/I-5 — so slots, share %, capital, net earnings, platform cut and ROI match those pages exactly: PKG-01 5 slots × $3,000 = $15,000 at 30 %, net **+$1,260** (gross +$1,575, cut −$315), value **$16,260**, ROI **+8.4 %**, ends 29 Oct; PKG-03 1 slot = $10,000 at 10 %, net **+$1,350** (gross +$1,687.50, cut −$337.50), value **$11,350**, ROI **+13.5 %**, ends 4 Nov. Settled cycles keep the spec's numbers — PKG-00 Genesis $9,000, gross +$1,476, cut −$295.20, net **+$1,180.80**, +13.12 %, paid 11 Oct (`PO-2026-10-11-0031`); PKG-02 $4,000 / +$388.80 / +9.72 %; PKG-06 $8,000 / +$849.60 / +10.62 %.
- Booked slots carry the payment state that decides whether they confirm: PKG-02 2 slots $10,000 **verified**, PKG-09 1 slot $2,500 **pending**, PKG-04 3 slots $6,000 **interest only** (no payment taken).
- `src/lib/investor/use-investments.ts` keeps the spec's TanStack Query keys — `["investor","investments-summary"]`, `["investor","active-investments"]` (60 s refetch), `["investor","completed-investments",{page}]`, `["investor","booked-slots"]`, `["investor","investment-timeline",{limit:50}]` — over a hydrated workspace key, and applies commands through the cache.
- `src/app/api/investor/investments/route.ts` is a read-only projection: `?section=workspace|summary|active|completed|booked|payouts|timeline|documents|notes|allocations|milestones|kyc|payoutPolicy|profile`, `page`/`pageSize` on `completed`, duplicate query keys rejected, `no-store`, and **405** on writes (the eventual mutations are `POST /api/wallet/payout`, `DELETE /api/pools/:id/interest`, `POST /api/investor/statements`).

### UI surface

`src/styles/pages/investor-investments.css` (~3 000 lines) is scoped under `.page-investor-investments`, continues the investor palette (one accent, hairline borders, tabular numerics, radii 6/10/14, no gradients) and is fully token-driven, including the dark theme. Five sections behind a jump bar:

- **Hero + 01 Investment summary** — holdings value **$40,110** (capital at work + booked + accrued), six count-up KPIs (total invested **$58,500**, active **$25,000**, total earned **+$5,029.20**, completed **3**, pending payouts **$118.50**, overall ROI **+10.93 %**), each with a second-line breakdown, over a footnote that states how the ledger is counted (including why settled capital is in “total invested” but not in “holdings value”).
- **02 Active investments** — one card per pool with slots × price, investment, share %, payment method/reference/date, current value, net/gross/cut strip, ROI badge (hover lift), live countdown and a footer of `View pool` / `Live trades` / `Request payout` (disabled with “Payout locked” while inside the 10-day lock) / breakdown.
- **03 Completed investments** — a settled row per cycle with capital, gross, cut, net paid, final ROI, payout status + reference and `Statement` / `Details` / `Payout`, collapsing to stacked cards under 768 px.
- **04 Booked slots** — bookings and registered interest side by side with stage, slots, amount, slot price, payment state, trading-start line, ledger note and reminder chip, plus `Add more slots` / `View booking` / `Reminder` / `Cancel interest`.
- **05 Investment timeline** — a day-grouped vertical rail (newest first, kind chips, 8 + 8 windowing, 50-event cap) where every event links back to the position it belongs to.
- **Records row and footer** — payouts and the document library side by side, then a “how this page is wired” footer with the live route links, so the page has no terminal dead end.
- **24 dialog kinds**, of which **eight are multi-step wizards** (payout request, add slots, cancel interest, reminder, cancel payout, statement export, preferences, support), each with a final acknowledgement gate. A three-tab right drawer (overview, payouts, timeline) and a six-action bottom dock (`Payout`, `Statement`, `Timeline`, `Slots`, `Payouts`, `Pools`); exports render real PDF/CSV/JSON files in the browser from the current snapshot.

### Spec reconciliation

The I-6 brief's illustrative KPIs (`+$3,672` earned, `+14.7 %` ROI, `1` completed, `$25,000` total invested) predate the pool book that I-2/I-3/I-4/I-5 already ship. Rather than hard-code numbers that would disagree with the pool pages and the live tracker, the page derives all six KPIs from the live book: **$58,500 / $25,000 / +$5,029.20 / 3 / $118.50 / +10.93 %**. The two active positions, their slots, shares, values, ROIs and countdowns, the settled PKG-00 line and the booked/interest rows all reproduce the brief exactly; only the rolled-up totals differ, and the summary footnote explains the basis. The timeline keeps the brief's events (trade won +$8.40, payout requested $120, pool trading started, bookings confirmed, pre-booked interest, account/KYC) and extends them to a 22-event record.

### Validation record

- `node --test tests/investor-investments.test.cjs`: **40 tests** covering the fixture, pool-book reconciliation, the 20 % cut on every position, settled references and ROIs, booked/interest payment states, all summary maths, the payout lock (PKG-01 unlocked, PKG-03 still locked), availability maths, the `payoutDraftError` rule order, bank/wallet fees and clamps, `suggestedPayout`, timeline ordering/grouping/filtering, countdown formatting, all twelve commands (success and rejection branches), immutability, the API sections and 405, and static wiring of the route, sidebar entry, stylesheet import, dialog kinds, deep links and dock.
- Full suite: `node --test tests/*.test.cjs` → **365/365 pass**. TypeScript clean; `next build` succeeds with `/investor/investments` dynamic and `/api/investor/investments` mounted.
- Playwright production run on `0.0.0.0:3000`: 21 `?action=` dialogs open with the right title and no page errors, the payout wizard runs step → review → acknowledgement → submit and updates the KPI row, drawer and records row in place (toast “Local preview updated”, pending payouts $118.50 → $1,251.66), the allocation modal, document library and payout history table (9 sortable columns, search) render correctly, and the 390 × 844 pass keeps a 356 px modal with a three-step wizard bar and **zero horizontal overflow** at every breakpoint. A dark-theme pass (shell toggle) confirms the page and its dialogs stay legible with no gradients or hard-coded light surfaces.

## I-7 · Wallet & Finances (`/investor/wallet`)

Route `src/app/investor/wallet/page.tsx` (`force-dynamic`) replaces the old redirect stub and renders `InvestorWalletPage` from one server snapshot. `?action=` deep links open any dialog directly (24 mapped actions, same pattern as I-4/I-5/I-6). This is the cash side of the workspace: deposits, payout requests, the statement and saved payment methods — positions themselves stay on I-6.

### Data layer

- `src/lib/investor/wallet.ts` — the `WalletWorkspace` DTO (profile, balance, lifetime, five deposit rails, three payout rails, methods, payouts, ledger, limits, filters, preferences, exports, acknowledgements, support drafts, audit) plus every pure helper the page uses: `money`/`signedMoney`/`atStamp`/`shortDateOf`, `depositFee`/`depositTotal`, `payoutFee`/`payoutNet`/`suggestedPayout`, `depositDraftError`/`payoutDraftError`, `withRunningBalance`/`deriveLifetime`/`flowTotals`/`balanceSplit`, `filterTransactions`/`newestFirst`, `depositedToday`/`defaultMethod`/`payoutRailFor`.
- `src/server/services/investor-wallet-service.ts` — a 19-row ledger (12 Sep → 22 Oct) that opens at $0 and closes on **$2,892 available**, so every figure on the page is derived, never authored: lifetime **$38,024 deposited (6)**, **$2,419.20 earned (3)**, **$2,419.20 withdrawn (3)**, **$12 fees**, **$35,000 deployed into pools**, **$500 refunded**, flow totals **$40,943.20 in / $38,051.20 out**. Locked capital (**$25,000**), booked capital (**$12,500**), registered interest (**$6,000**), accrued pool earnings (**$2,610**) and the in-flight payout (**$120 gross / $118.50 net**, `pay_8f2a`, 17 Oct) are read from `getInvestmentsWorkspace()`, so I-6 and I-7 cannot disagree.
- Five deposit rails: bank transfer (no fee, 1–3 days), mobile money (1.5 %, instant–30 min), card (2.9 % + $0.30, instant), crypto and stablecoins (network fee, 15–60 min), each with its own field schema — the page renders whatever the rail declares. Three payout rails with 0.6 % bank fees clamped to $1.50–$12, 1.5 % mobile and a flat $2.20 crypto network fee. Four saved methods, one default (`pm_bank_8842`), one deposit-only card.
- `applyWalletCommand()` validates a **thirteen-command** discriminated union (`deposit`, `requestPayout`, `cancelPayout`, `retryPayout`, `addMethod`, `verifyMethod`, `setDefaultMethod`, `removeMethod`, `saveFilters`, `savePreferences`, `exportReport`, `acknowledge`, `support`) against zod and returns an immutable, audited clone whose `balance`, `lifetime` and running balances are recomputed by `finish()`. Rail minimums, the $25,000 daily deposit cap, the $10,000 payout cap, destination verification, the card/deposit-only gate and the payout-terms acknowledgement are enforced in the reducer, not just in the form.
- `src/lib/investor/use-wallet.ts` keeps the spec's TanStack Query keys — `["wallet","overview"]` (30 s refetch), `["wallet","transactions",{page,filters}]`, `["wallet","recent-payouts",{limit:5}]`, `["wallet","payment-methods"]` — over a hydrated `["wallet","workspace"]` key, and applies commands through the cache.
- `src/app/api/investor/wallet/route.ts` is a read-only projection: `?section=workspace|balance|lifetime|transactions|payouts|recent-payouts|methods|depositRails|payoutRails|limits|preferences|exports|profile|audit`, with `type`/`method`/`from`/`to`/`q`/`page`/`pageSize`/`limit` filters, duplicate query keys rejected with 400, `no-store`, and no write handler (the eventual mutations are `POST /api/wallet/deposit`, `POST /api/wallet/payout`, `POST|DELETE /api/wallet/payment-methods[/:id]`).

### UI surface

`src/styles/pages/investor-wallet.css` (~1 550 lines) is scoped under `.page-investor-wallet`, continues the investor palette (one accent, hairline borders, tabular numerics, no gradients) and is fully token-driven, including the dark theme. Five sections behind a jump bar:

- **Hero + 01 Overview** — available balance with a live count-up and a three-bucket split bar (wallet cash **$2,892 / 10.32 %**, trading in pools **$25,000 / 89.25 %**, payout in flight **$120 / 0.43 %**), four count-up KPIs (available, locked in pools, pending payout, total account value **$27,892**), lifetime flows with their row counts, a “how the balance is built” reconciliation ($0 opening + 19 movements = $2,892), and the limit strip (daily/monthly deposits, per-request and daily payouts, KYC level).
- **02 Deposit** — amount field with quick chips, five staggered rail cards with their fee/ETA, the rail's own form fields, a fee preview that charges the fee on top ($5,000 by card → fee **$145.30**, total **$5,145.30**), the daily-cap line computed from today's ledger rows, and the three most recent deposits linking to their receipt.
- **03 Payout** — available balance, amount + quick chips (including `Max $2,890`), payout-enabled destinations only, a fee/net preview (bank on $500 → fee **$3.00**, net **$497.00**), the recent payout list (17 Oct $120 processing `pay_8f2a`, 11 Oct $1,180.80 completed `pay_b3c1`, …), the in-flight callout with cancel/detail actions, and routing timing per rail.
- **04 Statement** — a TanStack Table with Date / Type / Amount / Method / Status / Reference / Balance after, sortable headers, type chips, method select, date range + search dialog, 8-row pagination with flow totals (in/out/net), `CSV` and `PDF` exports, and a stacked-card layout under 768 px that keeps its column labels.
- **05 Payment methods** — one card per destination with masked details, verified status, default star (icon-pulse), reference, fee and limits, plus `Set default` / `Details` / `Remove` and an add card; removing the default promotes the next verified destination.
- **24 dialog kinds**, of which **seven are multi-step wizards** (deposit, payout, statement export, add method, cancel payout, preferences, support), each with a final acknowledgement gate where money would move. Read-only surfaces: rails compared, deposit receipt, payout rules, payout history (8-column sortable table), payout detail, retry, transaction detail, filters, method detail, remove, set-default, verification, limits, fee schedule, reconciliation, risk disclosure, support and workspace boundaries. Exports render real PDF/CSV/JSON files in the browser from the current snapshot.
- A three-tab right drawer (balance, statement, methods) and a six-action bottom dock (`Add funds`, `Payout`, `Statement`, `History`, `Methods`, `Pools`); every action opens a dialog, wizard, section or existing route, and the shell gains an **I-7 Wallet & payouts** nav entry visible on every investor page.

### Spec reconciliation

The brief's overview figures are reproduced exactly — available **$2,892**, locked **$25,000**, pending payout **$120**, total account value **$27,892** — and the deposit/payout fee examples match to the cent. The brief's lifetime summary ($25,120 deposited / $3,672 earned / $1,181 withdrawn) predates the ledger that backs I-6, so the shipped panel reports what the ledger actually proves: **$38,024 / $2,419.20 / $2,419.20**. Every number is footnoted with its basis (settled-cycle payouts waive the fee, accrued earnings stay inside the position until settlement, the $12 bank return fee is separate from withdrawals), so the panel never claims cash the statement cannot show.

### Validation record

- `node --test tests/investor-wallet.test.cjs`: **26 tests** covering the fixture, the $2,892 closing balance and its reconciliation with the sum of the ledger, the I-6 book hand-off (locked, booked, interest, accrual, pending payout), lifetime/flow totals, the spec's cash story and payout references, the split-bar shares, deposit and payout fee maths with clamps, every `depositDraftError`/`payoutDraftError` branch, all thirteen commands including the rejection paths (unverified/deposit-only destination, over-available payout, non-processing cancel, rail maximum), immutability of the shipped fixture, filters/pagination helpers, and static wiring of the route, API sections, hook keys, page sections, dialog registry (every `open()` and `actionMap` target resolves to a title), dock actions, TanStack wiring, stylesheet scoping/import, and the sidebar link.
- Full suite: `node --test tests/*.test.cjs` → **391/391 pass**. TypeScript clean; ESLint clean; `next build` succeeds with `/investor/wallet` dynamic and `/api/investor/wallet` mounted.
- Playwright production runs on `0.0.0.0:3000`: deposit wizard end to end (steps → review → acknowledgement gate → submit; available $2,892 → **$5,892**, one new ledger row, audited), payout request ($2,892 → $2,392, pending $620) then cancellation (back to $2,892, payout marked refunded), add method → verify → set default → remove, filters applied and cleared, CSV/PDF statement download, fee/limits/rails/history/detail/preferences/risk/support dialogs, drawer tabs and dock actions, with zero page errors and no console errors. The 390 × 844 pass keeps a **356 px modal**, a full-width drawer, single-column KPIs/method cards, stacked statement cards with human labels, and **zero horizontal overflow**; a dark-theme pass (shell toggle) confirms the page, tables and dialogs stay legible with no gradients or hard-coded light surfaces.

## I-8 · Investment Calculator (`/investor/calculator`)

Route `src/app/investor/calculator/page.tsx` (`force-dynamic`) replaces the old redirect stub and renders `InvestorCalculatorPage` from one server snapshot. `?action=` deep links open any dialog directly (24 mapped actions, same pattern as I-4 → I-7). This is the projection side of the workspace: what a booking would pay, how it compounds, what the rails cost, and what the last ten cycles actually returned.

### Data layer

- `src/lib/investor/calculator.ts` — the `CalculatorWorkspace` DTO (profile, defaults, bounds, six-pool book, five deposit rails, four payout destinations, three scenario bands, the ten-cycle archive, presets, saved scenarios, preferences, exports, acknowledgements, support drafts, audit) plus every pure helper: `roiProjection`, `compoundPlan`, `feeBreakdown`, `scenarioMatrix`, `historicalStats`, `slotCount`, `calculatorDraftError`, `bookingDraftError` and the money/percent formatters.
- The maths is deliberately one-directional: **gross = capital × ROI**, **cut = gross × 20 %**, **net = gross − cut**, **total return = capital + net**, **APY = net ROI × 365 ÷ days**. Compounding rolls the *net* forward and charges the cut again on every new gross, so six 15 % cycles at a 20 % cut end on **$5,921.46 (+97.38 %)** rather than a headline 90 %.
- `src/server/services/investor-calculator-service.ts` builds that snapshot from `getPoolsWorkspace()` and `getWalletWorkspace()`: slot prices, durations and windows come from the pool book (PKG-01 $3,000/18 d, PKG-03 $10,000/21 d, PKG-02 $5,000/21 d **open**, PKG-09 $2,500/10 d **open**, PKG-04 $2,000/7 d, PKG-05 $3,000/14 d), the deposit rails and payout destinations come from the wallet, and the 20 % cut matches I-6. Defaults are the brief's `$3,000 / 15 % / 14 days` on PKG-05.
- The ten-cycle archive is authentic-looking book history, not decoration: Balanced3 12.9 %, Range9 10.2 %, Trend2 14.0 %, Momentum7 15.7 %, Core14 11.6 %, Rotation5 14.8 %, Starter2 8.5 %, GenesisPlus 21.8 %, Steady14 13.4 %, Carry14 19.1 % — mean **14.2 %**, median **13.7 %**, best **21.8 %**, worst **8.5 %**, win-rate band **58.2–67.0 %**, **2,820** trades over **$395,000** deployed.
- `applyCalculatorCommand()` validates a **twelve-command** discriminated union (`saveScenario`, `deleteScenario`, `queueBooking`, `savePreset`, `deletePreset`, `togglePinPreset`, `savePreferences`, `exportReport`, `acknowledge`, `support`, `resetCalculator`, `shareProjection`) with zod and returns an immutable, audited clone whose revision increments. Slot caps, the eight-preset / twenty-scenario limits and the "already deleted" branches are enforced in the reducer.
- `src/lib/investor/use-calculator.ts` keeps the spec's TanStack Query keys — `["calculator","roi",{amount,roi,duration}]`, `["calculator","compound",{principal,roi,pools}]`, `["calculator","fees",{amount,method,share}]`, `["calculator","scenarios",{poolId}]`, `["pools","historical-performance",{type:"similar"}]` — over a hydrated `["calculator","workspace"]` key (60 s refetch) and applies commands through the cache. The maths is synchronous, so a real backend can swap in without touching the page.
- `src/app/api/investor/calculator/route.ts` is a read-only projection: `?section=workspace|roi|compound|fees|scenarios|historical|pools|presets|preferences|exports|profile|audit` with the inputs (`amount`, `roi`, `duration`, `pools`, `reinvest`, `deposit`, `payout`, `waived`, `poolId`), duplicate query keys rejected with 400, `no-store`, and no write handler (the eventual mutations are `POST /api/investor/calculator/scenarios`, `DELETE …/scenarios/:id`, `POST …/presets`, `POST …/exports`).

### UI surface

`src/styles/pages/investor-calculator.css` (~2 430 lines) is scoped under `.page-investor-calculator`, continues the investor palette (one accent, hairline borders, tabular numerics, radii 6/10/14, **no gradients**) and is fully token-driven, including the dark theme. Five sections behind a jump bar:

- **Hero + 01 ROI calculator** — projected net earnings with a live count-up (**$360.00** at $3,000 / 15 % / 14 d), total return, ≈ APY and slot chips, plus a reference-pool card (slot price, duration, expected ROI, risk band, close date). Three sliders ($500–$50,000, 5–30 %, 7–30 d) recompute six count-up figures in place: gross **$450.00**, cut **−$90.00**, net **$360.00**, total return **$3,360.00**, daily average **$25.71**, effective APY **313 %**. Slots are derived (`amount ÷ slot price`), the pool chips snap the inputs to a real pool, and `Slot maths` / `APY basis` / `Reset` sit in the section head.
- **02 Compound growth** — initial $3,000, per-pool ROI, 1–12 pools and a reinvest switch, with a six-row schedule (start, ROI, net, end) and a line chart whose `chart-draw` restarts on every input change. Reinvesting off repeats the same cycle; the table and legend show the final balance, net earned, cut paid and growth.
- **03 Fee calculator** — amount, ROI, deposit rail (bank $0, mobile 1.5 %, card 2.9 % + $0.30, crypto/stablecoin flat network fees) and payout destination (bank 0.6 % clamped $1.50–$12, mobile 1.5 %, crypto $2.20), a waived-on-settlement switch, a three-segment fee bar and six figures (gross, deposit fee, platform share, payout fee, total fees, net). Card funding on $3,000 → fee **$87.30**, total **$179.46**, net **$357.84**.
- **04 Scenario comparison** — a sortable TanStack grid of 1/2/3 slots × the 8 % / 15 % / 25 % bands on the selected pool: **$192 / $360 / $600**, **$384 / $720 / $1,200**, **$576 / $1,080 / $1,800** at a 20 % cut. Every row books straight through to `/investor/pools/:id/book?slots=n` with the slots pre-filled. Under 768 px the table becomes the stacked slot cards (the table is removed, not squeezed).
- **05 Track record** — five stats (average, median, best, worst, win-rate band), a clickable bar chart of the ten cycles with `chart-draw` stagger, and the sortable cycle record (pool, closed, days, ROI, win rate, trades, capital) that opens each cycle's detail.
- **24 dialog kinds**, of which **seven are multi-step wizards** (book this projection, save scenario, new preset, share, export, defaults, support), each with a final acknowledgement gate and a "nothing is reserved, no money moves" note. Read-only surfaces: methodology, assumptions, risk disclosure, fee schedule, pool detail, scenario detail, cycle detail, compounding maths, APY explainer, slot maths, pool comparison (7-column table), saved scenarios, preset list, queued bookings, share link, reset confirm and workspace boundaries. Exports render real PDF/CSV/JSON files in the browser from the current snapshot.
- A three-tab right drawer (projection, compounding, track record) and a six-action bottom dock (`Save`, `Book`, `Export`, `Presets`, `Compare`, `Pools`); every action opens a dialog, wizard, section or existing route, and the shell gains an **I-8 Return calculator** nav entry visible on every investor page.

### Spec reconciliation

The brief's worked example is reproduced to the cent — **$450.00 gross, −$90.00 cut, $360.00 net, $3,360.00 total, $25.71/day, ≈313 % APY** — as are the three scenario rows and the four track-record aggregates. Two places were deliberately kept honest rather than literal: the compounding table reports **$5,921.46** (6 × 12 % net on $3,000) instead of the brief's $5,914.74, which rounds each cycle's net before reinvesting; and the fee panel quotes a **$0.00** payout fee because settlement payouts are fee-waived in I-7, with the standalone bank fee (0.6 %, clamped) shown on the schedule dialog instead of hidden. Both are footnoted in-page.

### Validation record

- `node --test tests/investor-calculator.test.cjs`: **33 tests** covering the fixture and its empty-by-default artefacts, the six-pool book and its routable hrefs, the ordered archive, the brief's ROI figures, slot derivation, the zero-ROI case, the six-cycle compounding schedule and the flat-stake variant, both fee scenarios and their clamps, all three scenario rows and a re-price against PKG-02, every historical statistic, both draft validators, all twelve commands including their rejection branches, immutability, and static wiring of the route, API sections, hook keys, five sections in order, the 24-dialog registry (7 wizards), the six dock actions, the drawer, the stylesheet (scoping, no gradients, breakpoints, reduced motion) and the sidebar entry.
- Full suite: `node --test tests/*.test.cjs` → **424/424 pass**. TypeScript clean; ESLint clean; `next build` succeeds with `/investor/calculator` dynamic and `/api/investor/calculator` mounted.
- Playwright production runs on `0.0.0.0:3000`: all 24 `?action=` dialogs open with the right title, the booking wizard runs step → review → acknowledgement → hand-off and lands on `/investor/pools/pkg_02/book?slots=1`, the export/settings/support wizards step through on both viewports, sliders drive every figure (5,000 / 22 % / 21 d → gross $1,100, cut $220, net $880, total $5,880, daily $41.90, APY 306 %), the drawer tabs and dock actions all resolve, and there are no page or console errors. The 390 × 844 pass keeps a **358 px modal** with a stacked wizard footer, two-column result figures, stacked scenario cards, hidden bar labels and **zero horizontal overflow** (`scrollWidth === 390`); a dark-theme pass confirms the page, charts and tables stay legible with no gradients or hard-coded light surfaces.
