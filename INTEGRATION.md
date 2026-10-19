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
