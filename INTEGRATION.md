# tradeMO — Frontend Data Layer & Backend Integration Guide

Implemented Pages:
- **Page H-1: Landing (`/`)** — Multi-asset crowdfunding trade pools overview, live ticker, live execution console, performance stats, 4-step process, early-access waitlist capture.
- **Page H-2: Features (`/features`)** — Deep dive into 5 core modules (Quant Execution Engine, Algorithmic Strategy Sandbox, Crowdfunding Pools, AI Guardian Protection, Multi-Asset Coverage) with interactive widgets and operator vs investor capability matrix.
- **Page H-3: Pricing & Investor Fee Tiers (`/pricing`)** — Capital management tiers (<$10k, $10k-$100k, >$100k), interactive multi-factor investment return calculator, fee matrix, High-Water Mark guarantee, and comprehensive investor FAQ.

## Stack & Architecture

| Concern | Choice |
| --- | --- |
| UI Framework | Next.js 16 App Router (React 19) |
| Theme & Style | **Light Mode Default** (`data-bs-theme="light"`), **Bootstrap 5.3.8** + design tokens + **page-scoped leak-proof CSS** |
| Data Layer | **TanStack Query v5** (`QueryClientProvider` in `src/app/providers.tsx`) |
| Database & ORM | PostgreSQL + Drizzle ORM (schema in `src/db/schema.ts`, lazy seed + bundled fallback) |

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
  * **Starter Backer (< $10,000 USD)**: 20% Performance Fee, 1.5% Annual Management Fee, Bi-weekly settlement.
  * **Prime Growth ($10,000 – $100,000 USD)**: 15% Performance Fee (25% discount), 1.0% Annual Management Fee, Weekly settlement.
  * **Institutional (> $100,000 USD)**: 10% Performance Fee (50% discount), 0.5% Annual Management Fee, Daily settlement & on-demand payout.
- **Interactive Investment Return Calculator**:
  * Calculates gross profit, prorated management fees, performance fee platform cut, net investor return ($ and %), total maturity balance, and annualized run-rate across 6 asset classes and durations (15 to 180 days).

## Database Tables (`src/db/schema.ts`)

- `landing_sections`, `landing_stats`, `ticker_instruments`, `platform_features`, `how_it_works_steps`, `trust_badges`, `waitlist_signups`
- `features_sections`, `feature_modules`, `feature_matrix_rows`
- `pricing_sections`, `pricing_tiers`, `pool_asset_classes`, `pricing_faqs`

All tables are seeded automatically and lazily on first access, with graceful fallback to bundled static data if the database is resetting.

---

## Auth Pages (A-1 → A-8)

| Page | Route | Component | Stylesheet (root class) |
| --- | --- | --- | --- |
| A-1 Sign Up | `/auth/signup?role=&ref=` | `components/auth/signup/signup-page.tsx` | `auth-signup.css` (`.page-auth-signup`) |
| A-2 Sign In | `/auth/signin?reset=success\|verified=1\|session=expired&next=` | `components/auth/signin/signin-page.tsx` | `auth-signin.css` (`.page-auth-signin`) |
| A-3 Investor Onboarding | `/auth/onboarding/investor?step=1..4` | `components/auth/onboarding/onboarding-page.tsx` | `auth-onboarding-investor.css` |
| A-4 Forgot Password | `/auth/forgot-password?email=` | `components/auth/password/forgot-password-page.tsx` | `auth-forgot-password.css` |
| A-5 Reset Password | `/auth/reset-password?token=` | `components/auth/password/reset-password-page.tsx` | `auth-reset-password.css` |
| A-6 Verify Email | `/auth/verify-email?token=` or `?sent=true&email=` | `components/auth/verify/verify-email-page.tsx` | `auth-verify-email.css` |
| A-7 Two-Factor | `/auth/2fa?challengeId=` | `components/auth/two-factor/two-factor-page.tsx` | `auth-2fa.css` |
| A-8 Deriv Callback | `/auth/deriv/callback?code=&acct1=&state=` (or `?error=`) | `components/auth/deriv/deriv-callback-page.tsx` | `auth-deriv-callback.css` |

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
*(On top of the 18 shared Operator Console modals/wizards = **34 interactive overlays** across `/dashboard/schedules`, Right-Side Inspector Drawer, and Persistent Bottom Quick-Action Dock)*
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

| Layer | File / contract |
| --- | --- |
| Initial read | `GET /api/live` → `LiveBundle` |
| Deterministic fixture | `src/server/services/live-mock-service.ts` |
| Typed DTOs and event reducer | `src/lib/live/types.ts` |
| TanStack Query adapter | `src/lib/live/use-live.ts`, key `["live", "session"]` |
| Animated totals | `src/lib/live/use-live-count-up.ts`, previous value → next value, 600ms |

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

| Concern | Contract |
| --- | --- |
| DTOs | `src/lib/trade-log/types.ts`: `LedgerTrade`, `LedgerRequest`, `LedgerFilters`, `LedgerBundle`, `LedgerSummary`, `LedgerGroup` |
| Read transport | `src/lib/trade-log/transport.ts`: `fetchLedger(request, exportAll?)` |
| API | `GET /api/trade-log?page=1&pageSize=50&sort=executedAt&desc=true&from=2026-09-22&to=2026-10-21&symbol=all&pool=all&contract=all&strategy=all&result=all&schedule=&search=` |
| Query | TanStack Query key `["trades", request]`, previous-page preservation, refetch/retry, initial server snapshot |
| Fixture/service | `src/server/services/trade-log-service.ts`, 1,247 deterministic settled trades, 789 wins |
| Export all matching | Same validated query plus `export=true` (does not silently export just the visible page) |
| Schedule drilldown | `/dashboard/trades?schedule=SCH-001` |

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

| Layer | Location |
| --- | --- |
| DTOs | `src/lib/packages/types.ts`: `PackageTerms`, `ManagedPackage`, `PoolInvestor`, `PackageBundle`, `PackageHistory`, `PackageCommand` |
| Validation | `src/lib/packages/schema.ts` (Zod v4) |
| Pure lifecycle / exact allocation | `src/lib/packages/model.ts` |
| Query / local mutation adapter | `src/lib/packages/use-packages.ts` |
| TanStack Form builder | `src/components/dashboard/packages/package-builder.tsx` |
| Seeded read endpoint | `GET /api/package-manager` → `PackageBundle` |
| Deterministic fixture | `src/server/services/package-manager-service.ts` |
| Query key | `["packages", "manager"]` |

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

| Concern | File / contract |
| --- | --- |
| DTOs | `src/lib/investors/types.ts`: `InvestorBundle`, `ManagedInvestor`, `InvestorHolding`, `InvestorTrade`, `InvestorMessage`, `WalletEntry`, `InvestorActivity`, `InvestorCommand`, `InvestorFilters` |
| Zod validation / pure mutations | `src/lib/investors/model.ts`: `investorCommandSchema`, `applyInvestorCommand`, `filterInvestors` |
| Query / mutation adapter | `src/lib/investors/use-investors.ts`, key `["investors", "manager"]` |
| Seeded read endpoint | `GET /api/investor-manager` → `InvestorBundle` |
| Fixture | `src/server/services/investor-manager-service.ts` |
| Detail / workflows | `components/dashboard/investors/investor-detail.tsx`, `investor-workflows.tsx` |
| Synthetic assets | `public/demo-kyc/*.svg` (4 locally bundled watermarked illustrations) |

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

| Concern | File / contract |
| --- | --- |
| DTOs | `src/lib/analytics/types.ts`: `AnalyticsSource`, `AnalyticsBundle`, `AnalyticsFilters`, `AnalyticsTrade`, `AnalyticsPool`, `PoolAnalytics`, `InvestorRanking`, `AnalyticsGroup`, `EquityPoint`, `GuardianMarker` |
| Validation / calculation | `src/lib/analytics/model.ts`: `analyticsFilterSchema`, `calendarDays`, `equityPoints`, `summarizeAnalytics`, `buildAnalytics` |
| Seed adapter | `src/server/services/analytics-service.ts` |
| API | `GET /api/analytics?from=2026-09-22&to=2026-10-21&pool=all` → `AnalyticsBundle` |
| Query adapter | `src/lib/analytics/use-analytics.ts`, key `["analytics", "bundle", filters]`, `keepPreviousData`, 30s stale time |
| Chart primitives | `src/components/dashboard/analytics/charts.tsx` |

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

| Opening control | Amount / definition |
| --- | --- |
| Managed principal | $156,000 |
| Funded packages | PKG-01 $61,000; PKG-02 $50,000; PKG-03 $45,000 |
| Deployed principal | PKG-01 $56,000; PKG-02 $46,000; PKG-03 $40,000 = $142,000 |
| Broker cash | $8,750; includes $4,200 earmarked reserve |
| Owned escrow in transit | $5,250; already part of managed principal |
| Available | $14,000 = broker cash + owned escrow |
| Immediately deployable | $4,550 = broker cash minus current reserve |
| External, uncredited submissions | Four open reviews totaling $3,500; excluded from managed assets and owned escrow |
| Reserve target | 5% / $7,800; $3,600 gap |

**Managed principal = deployed + broker cash + owned escrow.** Reserve is a subset of broker cash, not an additional asset. Package funded ownership is distinct from deployed principal. Undeployed package entitlement is not an additional cash wallet. The desk suggests earmarking existing free cash for the initial reserve gap rather than unnecessarily releasing trades.

All amounts are USD reporting equivalents, not live FX rates. Net principal controls and provider values are illustrative, not authenticated bank, broker or chain evidence. D-7 realized analytics are a separate seed snapshot and are not automatically settled into this principal-only control model. The register/movement feed are samples, not lifetime funding history or a complete accounting journal; historic posted events are already reflected in the opening control snapshot.

### DTOs, API and adapters

| Concern | Location / contract |
| --- | --- |
| Types | `src/lib/funds/types.ts`: `FundsBundle`, `FundsOverview`, `Deposit`, `FundAllocation`, `FundMovement`, `FundProvider`, `ReconciliationRun`, `ReconciliationCheck`, `FundsAudit`, `FundsInvestor` |
| Validation / reducer | `src/lib/funds/model.ts`: `intakeSchema`, `fundsCommandSchema`, `FundsCommand`, `getFundsOverview`, `reconciliationChecks`, `assertFundsInvariant`, `applyFundsCommand` |
| Seed adapter | `src/server/services/funds-service.ts`; joins D-6 funded holdings and D-7 execution statistics |
| Read API | `GET /api/funds` → complete `FundsBundle` |
| Section reads | `/api/funds?section=overview`, `deposits`, `allocation`, `flow-timeline`, `reconciliation`, `provider-status`, `reserve` (unknown sections → 400) |
| Client state | `src/lib/funds/use-funds.ts` → `useFunds`, canonical `["funds", "workspace"]` cache and validated local mutation reducer |
| UI / intake | `src/components/dashboard/funds/funds-page.tsx`, `intake-form.tsx` |

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

| Concern | Contract |
| --- | --- |
| Types | `src/lib/payouts/types.ts`: `PayoutBundle`, `PayoutRequest`, `PayoutInvestor`, `PayoutSettings`, `PayoutEvidenceSnapshot`, `PayoutAudit`, `PayoutCashEntry`, `PayoutDay` |
| Model | `src/lib/payouts/model.ts`: `payoutCommandSchema`, `requestSchema`, `settingsSchema`, `payoutDateRangeSchema`, `applyPayoutCommand`, `assertPayoutInvariants`, `getPayoutSummary`, `approvalBlockers`, `autoEligible`, `payoutHistory` |
| Seed service | `src/server/services/payouts-service.ts` |
| Read API | `GET /api/payouts` → complete `PayoutBundle` |
| Section reads | `/api/payouts?section=summary`, `section=settings`, `section=history&days=7|14|30` |
| Paged queues | `/api/payouts?status=pending&page=1&pageSize=8` → mode/asOf/revision/items/total/page/pageSize envelope; all eight defined statuses supported |
| Client adapter | `src/lib/payouts/use-payouts.ts`, canonical `["payouts", "workspace"]` |
| Main / forms / chart | `src/components/dashboard/withdrawals/{withdrawals-page,forms,history-chart}.tsx` |

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
