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
