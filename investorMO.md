# DerivX InvestorMO — Investor Dashboard Outline

> Companion file to `tradeMO.md`. This file is the **investor-facing** outline, scoped to the 12 investor dashboard pages. It carries a **full 1-to-1 page-to-stylesheet file mapping** — every investor route resolves to exactly one CSS file under `src/styles/pages/`.
>
> **Revision 2 — TanStack Start + Bootstrap 5.3.x + page-scoped CSS + motion system.** The Global Styling System (Section 2 below) is shared verbatim with `tradeMO.md`. Any change to design tokens, motion tokens, or the page-scoped CSS lifecycle must be applied to both files in lockstep.

---
bb
## TABLE OF CONTENTS

```
1.  PURPOSE OF THIS FILE
2.  GLOBAL STYLING SYSTEM  (shared with tradeMO.md — verbatim)
3.  TECH STACK SUMMARY  (TanStack-first)
4.  PAGE-TO-STYLESHEET 1-TO-1 FILE MAPPING  (12 investor pages)
5.  INVESTOR DASHBOARD PAGES (12)
    I-1   Investor Overview
    I-2   Crowdfunding Pools
    I-3   Pool Detail
    I-4   Pool Booking & Payment
    I-5   Live Trade Tracker
    I-6   My Investments
    I-7   Wallet & Finances
    I-8   Investment Calculator
    I-9   Notifications & Activity
    I-10  Referrals & Rewards
    I-11  Earnings & Reports
    I-12  Investor Settings
6.  SHARED COMPONENTS (investor-relevant subset)
7.  STATE MANAGEMENT (investor-scoped)
8.  SOCKET EVENTS (investor-side)
9.  CROSS-FILE REFERENCES
```

---

## 1. PURPOSE OF THIS FILE

```
WHY TWO FILES?
  tradeMO.md     — operator-facing outline (Home + Auth + 15 operator dashboard pages)
  investorMO.md  — investor-facing outline (12 investor dashboard pages, this file)

SHARED CONTRACT:
  Both files share Section 2 (Global Styling System) verbatim.
  Both files reference the same app-shell stylesheet at src/styles/app-shell.css.
  Both files use the same design tokens, motion tokens, and reduced-motion contract.

INVESTOR-FACING SCOPE:
  - 12 dedicated routes under /investor/*
  - Each route has a 1-to-1 CSS file under src/styles/pages/investor-*.css
  - Investor pages NEVER inherit operator dashboard styles (scoped isolation)
  - Shared components (StatCard, CountdownTimer, etc.) are styled at the app root,
    so they render identically on both operator and investor pages

DO NOT:
  - Duplicate the operator dashboard specs here. Reference /tradeMO.md for those.
  - Define new design tokens here. Use Section 2 verbatim.
  - Create investor-specific component CSS. Use shared components only.
```

---

## 2. GLOBAL STYLING SYSTEM  (shared with tradeMO.md — verbatim)

> ⚠️ This section MUST stay byte-identical with Section 2 of `tradeMO.md`. If you change a token here, change it there too.

### 2.1 Design Tokens

```
COLOR TOKENS (CSS custom properties on :root + [data-bs-theme="dark"]):

  /* Brand */
  --brand-primary:        #5b2bdb;   /* DerivX violet */
  --brand-primary-rgb:   91, 43, 219;
  --brand-accent:        #00d4b8;   /* profit teal */
  --brand-warning:       #ffb020;   /* pending amber */
  --brand-danger:        #ff4d6d;   /* loss red */
  --brand-success:       #2dd4bf;   /* win green */
  --brand-info:          #4d9eff;   /* info blue */

  /* Semantic surface tokens (auto-flip in dark mode) */
  --surface-0:           #ffffff;   /* page bg (light) → #0e0f1a (dark) */
  --surface-1:           #f7f8fc;   /* card bg  (light) → #16182a (dark) */
  --surface-2:           #eef0f7;   /* nested bg (light) → #1d2037 (dark) */
  --surface-3:           #e2e5f0;   /* hover/active bg */
  --border-subtle:       rgba(15, 18, 40, 0.08);
  --border-strong:       rgba(15, 18, 40, 0.16);

  /* Text */
  --text-primary:        #0e0f1a;
  --text-secondary:      #565a72;
  --text-tertiary:       #8b90a8;
  --text-on-brand:       #ffffff;

  /* Data viz palette (charts) */
  --viz-1: #5b2bdb;  --viz-2: #00d4b8;  --viz-3: #ffb020;
  --viz-4: #ff4d6d;  --viz-5: #4d9eff;  --viz-6: #a855f7;

SPACING / RADIUS / SHADOW TOKENS:

  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
  --space-5: 24px;  --space-6: 32px;  --space-7: 48px;  --space-8: 64px;

  --radius-sm: 8px;   --radius-md: 12px;   --radius-lg: 18px;
  --radius-pill: 999px;

  --shadow-1: 0 1px 2px rgba(15,18,40,0.06), 0 1px 3px rgba(15,18,40,0.04);
  --shadow-2: 0 4px 12px rgba(15,18,40,0.08);
  --shadow-3: 0 12px 32px rgba(15,18,40,0.12);
  --shadow-lift: 0 18px 48px rgba(91,43,219,0.18);

TYPOGRAPHY TOKENS:

  --font-sans:    "Inter", "Noto Sans", system-ui, -apple-system, sans-serif;
  --font-mono:    "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  --font-numeric: "Inter", tabular-nums, "SF Pro Display";
  --font-display: "Sora", "Inter", sans-serif;  /* hero/headings */

  --fs-kpi-xl:    2.5rem;  --fs-kpi:    1.75rem;  --fs-kpi-sm: 1.25rem;
  --fs-body:      0.9375rem;  --fs-sm: 0.8125rem;
  --fs-label:     0.6875rem; (uppercase, letter-spacing 0.06em)

  --lh-tight: 1.15;  --lh-normal: 1.5;  --lh-relaxed: 1.7;

MOTION TOKENS:

  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);

  --dur-instant:  80ms;   --dur-fast: 160ms;    --dur-base: 240ms;
  --dur-slow:    400ms;   --dur-slower: 600ms;  --dur-cinematic: 1200ms;

  --stagger-step: 60ms;   /* between staggered items, capped at 12 items */

Z-INDEX LAYERS:

  --z-base:       1;
  --z-sticky:     1020;   /* top bar */
  --z-sidebar:    1030;
  --z-dropdown:   1040;
  --z-modal-bg:   1050;
  --z-modal:      1060;
  --z-toast:      1080;
  --z-tooltip:    1090;
```

### 2.2 Page-Scoped CSS Injection Lifecycle

```
TanStack Router integration:

  // src/routes/investor/pools.tsx
  import { createFileRoute } from "@tanstack/router";
  import poolsStyles from "@/styles/pages/investor-pools.css";

  export const Route = createFileRoute("/investor/pools")({
    // 1. Inject page stylesheet on enter
    loader: async ({ context }) => {
      context.styles.mount("investor-pools", poolsStyles);
      return await context.queryClient.ensureQueryData(...);
    },
    // 2. Remove on leave
    onLeave: ({ context }) => {
      context.styles.unmount("investor-pools");
    },
    // 3. Component scoped under .page-investor-pools root class
    component: InvestorPoolsPage,
  });

BEHAVIOR:
  ✓ Stylesheet is mounted exactly once when the route becomes active.
  ✓ Multiple instances of the same route (e.g. dev HMR) deduplicate via loader context.
  ✓ On route transition (leave), the <link> element is removed from <head> and
    all .page-investor-* scoped rules stop applying.
  ✓ Page components render a <div className="page-investor-<slug>"> wrapper;
    all selectors in the page stylesheet are scoped under this root class.
  ✓ Cross-page style leakage is structurally impossible.

MIGRATION SAFETY:
  - Bootstrap utility classes still apply globally (intended).
  - Shared component CSS files (src/styles/components/*.css) are loaded at app root,
    so components like StatCard render identically on every page (operator + investor).
  - Page stylesheets only override layout/visual specifics for that page.
```

### 2.3 Animation Patterns (Reusable Across All 12 Investor Pages)

```
ENTRANCE PATTERNS:

  .page-investor-<slug> > * { opacity: 0; transform: translateY(8px); }
  .page-investor-<slug>.is-entered > * {
    animation: fadeSlideUp var(--dur-base) var(--ease-out) forwards;
    animation-delay: calc(var(--idx) * var(--stagger-step));
  }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

HOVER-LIFT CARDS:

  .page-investor-<slug> .card.hover-lift {
    transition: transform var(--dur-fast) var(--ease-out),
                box-shadow var(--dur-fast) var(--ease-out);
  }
  .page-investor-<slug> .card.hover-lift:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-lift);
  }

COUNT-UP KPIs:

  <StatCard value={18320} duration={1200} />
  → requestAnimationFrame animates from 0 to value over 1.2s
  → easing: easeOutQuart  (1 - Math.pow(1 - t, 4))
  → on tab visibility lost: pause animation, resume on focus
  → prefers-reduced-motion: snap to final value immediately

ANIMATED ICONS:

  .icon-pulse   { animation: pulse 1.4s var(--ease-in-out) infinite; }
  .icon-spin    { animation: spin 1.2s linear infinite; }
  .icon-draw    { stroke-dasharray: 1; stroke-dashoffset: 1;
                  animation: draw 800ms var(--ease-out) forwards; }

  @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; }
                     50%     { transform: scale(1.12); opacity: 0.7; } }
  @keyframes spin  { to { transform: rotate(360deg); } }
  @keyframes draw  { to { stroke-dashoffset: 0; } }

ROW FLASH ON LIVE UPDATES:

  .row-flash-win  { animation: flashWin 800ms var(--ease-out); }
  .row-flash-loss { animation: flashLoss 800ms var(--ease-out); }

  @keyframes flashWin  { 0% { background: rgba(45,212,191,0.28); }
                          100% { background: transparent; } }
  @keyframes flashLoss { 0% { background: rgba(255,77,109,0.28); }
                          100% { background: transparent; } }

CHART DRAW-IN:

  .chart-draw { animation: chartDraw var(--dur-slower) var(--ease-out) forwards; }
  @keyframes chartDraw {
    from { clip-path: inset(0 100% 0 0); opacity: 0; }
    to   { clip-path: inset(0 0 0 0);   opacity: 1; }
  }

REDUCED MOTION:

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    /* count-up snaps to final value; draw-ins skipped;
       row flash skipped; icon spin/pulse disabled */
  }
```

### 2.4 Responsive Card & Section Patterns

```
KPI ROW (1/2/4 column flow):

  <div className="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 page-investor-<slug>">
    <div className="col"><StatCard .../></div>
    <div className="col"><StatCard .../></div>
    <div className="col"><StatCard .../></div>
    <div className="col"><StatCard .../></div>
  </div>

CARD GRID (1/2/3 flow with hover-lift):

  <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
    {items.map(p => <div className="col"><PoolCard .../></div>)}
  </div>

TABLES-TO-CARDS (mobile auto-collapse):

  /* desktop: standard Bootstrap table */
  /* < md: each row becomes a stacked card */
  @media (max-width: 767.98px) {
    .responsive-table thead { display: none; }
    .responsive-table tr {
      display: block; padding: var(--space-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md); margin-bottom: var(--space-2);
    }
    .responsive-table td {
      display: flex; justify-content: space-between;
      padding: var(--space-1) 0;
    }
    .responsive-table td::before {
      content: attr(data-label);
      font-weight: 600; color: var(--text-secondary);
      margin-right: var(--space-3);
    }
  }

OFFCANVAS MOBILE SIDEBAR:

  <Offcanvas show={sidebarOpen} placement="start" responsive="lg">
    <Offcanvas.Header closeButton>
      <Offcanvas.Title>DerivX Investor</Offcanvas.Title>
    </Offcanvas.Header>
    <Offcanvas.Body>
      <SidebarNav />
    </Offcanvas.Body>
  </Offcanvas>

  /* on lg+: sidebar becomes static d-lg-block */
  /* on md/sm: opens as offcanvas with backdrop dismissal */

SECTION DIVIDERS:

  .section-divider {
    display: flex; align-items: center; gap: var(--space-3);
    margin: var(--space-6) 0 var(--space-4);
  }
  .section-divider::before,
  .section-divider::after {
    content: ""; flex: 1; height: 1px;
    background: var(--border-subtle);
  }
```

### 2.5 Investor Page Style Block Template

```
Every investor page in Section 5 below carries this STYLE block at its intro:

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-<slug>.css
  Root class:        .page-investor-<slug>  (scoped under this root only)
  Mount lifecycle:   TanStack Router loader → mount <link>; onLeave → unmount
  Motion hooks:      fadeSlideUp stagger (60ms/item, max 12 items)
                     hover-lift on .card.hover-lift
                     count-up on KPI numbers (1.2s ease-out-quart)
                     icon-pulse on live status indicators
                     row-flash-win / row-flash-loss on live trade rows
                     chart-draw on data charts (600ms ease-out)
  Responsive:         KPIs 1/2/4 cols (sm/md/lg)
                     card grids 1/2/3 cols (sm/lg)
                     tables collapse to stacked cards < md
                     sidebar offcanvas < lg, static lg+
                     forms vertical < md, horizontal md+
  Reduced motion:    count-up snaps to final; draw-ins skipped;
                     pulse/spin disabled; row-flash disabled
```

---

## 3. TECH STACK SUMMARY  (TanStack-first)

```
FRONTEND (TanStack-first):
  Framework:       TanStack Start  (server functions + file-based routing)
  Router:          TanStack Router  (type-safe routes, loaders, search params,
                                     code-split route components + assets)
  Server State:    TanStack Query  (query keys, mutations, invalidation,
                                     background refetch, optimistic updates)
  Tables:          TanStack Table v8  (sorting, filtering, pagination,
                                     column resizing, row selection, expandable rows)
  UI Library:      Bootstrap 5.3.x (latest stable) + Bootstrap Icons
  Custom CSS:      Page-scoped stylesheets — one per investor route (1-to-1 mapping)
  Forms:           React Hook Form + Zod  (schema reuse across client + server)
  Charts:          Recharts (KPI/mini charts)
  Realtime:        WebSocket (Deriv API, indirect via operator) + Socket.IO (internal)
  Animation:       Framer Motion + CSS keyframes + Bootstrap collapse/tab transitions
  Build:           Vite (TanStack Start default)

BACKEND (shared with operator app):
  Runtime:         Node.js 20 LTS + Express 4
  Database:        PostgreSQL 16 (Prisma ORM)
  Cache:           Redis 7 (sessions, rate limits, pub/sub, tick buffers)
  Auth:            Lucia/AuthJS (credentials) + Deriv OAuth2 + JWT refresh
  WebSocket:       ws 8.x (Deriv WebSocket API multiplexer)
  File Storage:    S3-compatible (KYC docs, terms PDFs, exports)
  Mailer:          React Email + Resend  (transactional + templated emails)
```

---

## 4. PAGE-TO-STYLESHEET 1-TO-1 FILE MAPPING  (12 investor pages)

> This is the definitive mapping. Every investor route resolves to exactly one CSS file. No shared investor page stylesheets — every page owns its own.

```
| Route                            | Page Code | Stylesheet Path                                          | Root Class                    |
|---------------------------------|----------|----------------------------------------------------------|-------------------------------|
| /investor                        | I-1      | src/styles/pages/investor-overview.css                   | .page-investor-overview       |
| /investor/pools                  | I-2      | src/styles/pages/investor-pools.css                      | .page-investor-pools          |
| /investor/pools/:id              | I-3      | src/styles/pages/investor-pool-detail.css               | .page-investor-pool-detail    |
| /investor/pools/:id/book         | I-4      | src/styles/pages/investor-pool-booking.css              | .page-investor-pool-booking   |
| /investor/live                   | I-5      | src/styles/pages/investor-live.css                       | .page-investor-live           |
| /investor/investments            | I-6      | src/styles/pages/investor-investments.css                | .page-investor-investments    |
| /investor/wallet                 | I-7      | src/styles/pages/investor-wallet.css                     | .page-investor-wallet         |
| /investor/calculator             | I-8      | src/styles/pages/investor-calculator.css                 | .page-investor-calculator     |
| /investor/notifications          | I-9      | src/styles/pages/investor-notifications.css             | .page-investor-notifications  |
| /investor/referrals              | I-10     | src/styles/pages/investor-referrals.css                  | .page-investor-referrals      |
| /investor/earnings               | I-11     | src/styles/pages/investor-earnings.css                   | .page-investor-earnings       |
| /investor/settings               | I-12     | src/styles/pages/investor-settings.css                   | .page-investor-settings       |

ALWAYS-MOUNTED APP SHELL (shared with operator app, NOT page-scoped):
  src/styles/app-shell.css  — sidebar, top bar, mobile nav, theme, page wrapper

SHARED COMPONENT CSS (loaded at app root, NOT page-scoped):
  src/styles/components/*.css — StatCard, DataTable, ChartWrapper, LivePrice,
                                  PnLBadge, StatusIndicator, CountdownTimer,
                                  ProgressFillBar, TimeAgo, PackageCard, etc.

TOTAL INVESTOR FILE COUNT: 12 page stylesheets + 1 app-shell + N shared components
                            = strict 1-to-1 page-to-stylesheet mapping for investor routes
```

### File Creation Discipline

```
WHEN ADDING A NEW INVESTOR PAGE:
  1. Pick a route slug, e.g. /investor/reports
  2. Create route component:        src/routes/investor/reports.tsx
  3. Create page stylesheet:         src/styles/pages/investor-reports.css
  4. Wrap component root in:        <div className="page-investor-reports">
  5. Wire loader + onLeave in createFileRoute (see Section 2.2)
  6. Update the table above with the new row
  7. Update tradeMO.md Section 18 (Complete Page Index) to reflect the new count

FORBIDDEN:
  - Inline <style> tags in investor route components
  - Styled-components / emotion scoped styles (we use plain CSS files)
  - Importing operator dashboard stylesheets into investor routes
  - Inline styles for layout/visual (only for dynamic values that come from server)
```

---

## 5. INVESTOR DASHBOARD PAGES (12)

> Every investor page below is **mirrored verbatim from Section 7 of `tradeMO.md`**. If you change a section here, change it there too. The full content (sections, sample payloads, TanStack Query keys, mutations, socket events) lives in `tradeMO.md` Section 7 — this file lists the canonical entry per page so engineers can navigate directly to the right spec.

---

### PAGE I-1: Investor Overview (`/investor`)

```
PURPOSE:
  Main hub for investors. Pool status, investment summary,
  active trades overview, earnings ticker, quick actions.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-overview.css
  Root class:        .page-investor-overview
  Motion hooks:      earnings ticker count-up (3s refresh, 1.2s ease-out-quart)
                     active pool cards fadeSlideUp stagger (60ms)
                     progress bars chart-draw (1.2s)
                     countdown timer icon-pulse on "ending soon"
                     quick action buttons hover-lift
                     AI Guardian status icon icon-pulse on alert
  Responsive:         earnings summary 1/2/4 cols (sm/md/lg)
                     active pool cards 1-col sm, 2-col md
                     upcoming pools 1-col sm, 3-col lg
                     recent activity list vertical on sm

SECTIONS (6 — see tradeMO.md §7 I-1 for full content + sample data):
  SECTION 1: WELCOME & EARNINGS SUMMARY
            KPI cards: total invested $25,000, active pools 2, earned this month $3,672, wallet balance $2,892
  SECTION 2: ACTIVE POOL STATUS
            Per-pool card with goal/raised progress bar, share %, countdown, P&L, AI Guardian status
  SECTION 3: EARNINGS TICKER
            Per-pool profit + ROI with 3-min auto-refresh + [Refresh Now]
  SECTION 4: UPCOMING POOLS
            Pools opening soon with [Book Slot] [Set Reminder]
  SECTION 5: RECENT ACTIVITY
            Last 10 actions: trade wins/losses, deposits, payouts, announcements
  SECTION 6: QUICK ACTIONS
            [Book Slot] [View Earnings] [Request Payout] [Calculator]

TANSTACK QUERY KEYS:
  ["investor", "overview"]                       → useQuery, refetchInterval 60s
  ["investor", "active-pools"]                   → useQuery, refetchInterval 30s
  ["investor", "earnings-ticker"]                → useQuery, refetchInterval 180s
  ["investor", "upcoming-pools"]                 → useQuery
  ["investor", "recent-activity", { limit: 10 }] → useQuery

SOCKET EVENTS: see tradeMO.md §7 I-1
SAMPLE PAYLOAD: see tradeMO.md §7 I-1
```

---

### PAGE I-2: Crowdfunding Pools (`/investor/pools`)

```
PURPOSE:
  Browse all pools — past, current, and upcoming.
  Book slots, view pool details, track history.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-pools.css
  Root class:        .page-investor-pools
  Motion hooks:      pool cards fadeSlideUp stagger (max 12, 60ms)
                     fill progress bar chart-draw (1.2s)
                     countdown timer icon-pulse on "ending soon"
                     completed pool cards checkmark icon-draw
                     roadmap timeline items slide-in-from-left
                     hover-lift on all cards
  Responsive:         active/trading pool cards 1-col sm, 2-col md, 3-col lg
                     open pools cards same grid
                     upcoming pools 1-col sm, 2-col md
                     completed pools list → stacked cards < md
                     roadmap timeline vertical on sm

SECTIONS (5 — see tradeMO.md §7 I-2 for full content + sample data):
  SECTION 1: ACTIVE/TRADING POOLS
  SECTION 2: OPEN POOLS (accepting bookings)
  SECTION 3: UPCOMING POOLS
  SECTION 4: COMPLETED POOLS
  SECTION 5: POOL ROADMAP

TANSTACK QUERY KEYS:
  ["pools", { status: "trading", investorId }]   → useQuery, refetchInterval 30s
  ["pools", { status: "open", investorId }]      → useQuery
  ["pools", { status: "upcoming" }]              → useQuery
  ["pools", { status: "completed", investorId }] → useQuery
  ["pools", "roadmap"]                            → useQuery

MUTATIONS:
  useBookMoreSlots()   → POST /api/investments
  useSetReminder()     → POST /api/pools/:id/remind
  usePrebookInterest() → POST /api/pools/:id/interest

SAMPLE PAYLOAD: see tradeMO.md §7 I-2
```

---

### PAGE I-3: Pool Detail (`/investor/pools/:id`)

```
PURPOSE:
  Deep dive into a single pool from investor perspective.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-pool-detail.css
  Root class:        .page-investor-pool-detail
  Motion hooks:      overview card fadeSlideUp (1 item, 240ms)
                     your investment card count-up
                     live earnings count-up on refresh
                     performance metrics cards fadeSlideUp stagger
                     AI Guardian status icon-pulse
                     anonymized participants bars chart-draw
  Responsive:         overview 2-col lg, stacked sm
                     your investment + earnings side-by-side md
                     performance metrics 1/2/4 cols (sm/md/lg)
                     AI Guardian status 1-col
                     participants bar chart full-width sm

SECTIONS (5 — see tradeMO.md §7 I-3 for full content + sample data):
  SECTION 1: POOL OVERVIEW
  SECTION 2: YOUR INVESTMENT IN THIS POOL
  SECTION 3: POOL PERFORMANCE (numbers only)
  SECTION 4: AI GUARDIAN STATUS
  SECTION 5: POOL PARTICIPANTS (anonymized)

TANSTACK QUERY KEYS:
  ["pools", poolId, "overview"]                      → useQuery, refetchInterval 30s
  ["pools", poolId, "my-investment"]                 → useQuery, refetchInterval 180s
  ["pools", poolId, "performance"]                   → useQuery, refetchInterval 60s
  ["pools", poolId, "ai-guardian"]                   → useQuery
  ["pools", poolId, "participants"]                 → useQuery

SOCKET EVENTS: see tradeMO.md §7 I-3
```

---

### PAGE I-4: Pool Booking & Payment (`/investor/pools/:id/book`)

```
PURPOSE:
  Book slots in a pool, make payment, confirm booking.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-pool-booking.css
  Root class:        .page-investor-pool-booking
  Motion hooks:      stepper progress fill animation per step
                     slot number picker +/- with hover-lift buttons
                     payment method cards fadeSlideUp stagger + selected-lift
                     payment status tracker icon-spin on "processing" + checkmark icon-draw on "verified"
                     reservation countdown icon-pulse
  Responsive:         stepper horizontal on md+, vertical on sm
                     slot picker + totals side-by-side md, stacked sm
                     payment method grid 1-col sm, 2-col md, 3-col lg
                     confirm form 1-col sm, 2-col md

SECTIONS (5 — see tradeMO.md §7 I-4 for full content + sample data):
  SECTION 1: POOL DETAILS
  SECTION 2: SELECT SLOTS
  SECTION 3: PAYMENT METHOD
  SECTION 4: PAYMENT DETAILS & CONFIRM
  SECTION 5: PAYMENT STATUS TRACKER

TANSTACK QUERY KEYS:
  ["pools", poolId, "booking-context"]        → useQuery
  ["investments", "my-bookings", poolId]      → useQuery
  ["investments", bookingId, "status"]         → useQuery, refetchInterval 30s (if pending)

MUTATIONS:
  useCreateBooking() → POST /api/investments
  useCancelBooking() → DELETE /api/investments/:id  (allowed only before verified)

SAMPLE PAYLOAD: see tradeMO.md §7 I-4 (booking POST, sample response)
```

---

### PAGE I-5: Live Trade Tracker (`/investor/live`)

```
PURPOSE:
  Real-time live trading feed. NO CHARTS.
  Just raw numbers, values, and trade results flowing in.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-live.css
  Root class:        .page-investor-live
  Motion hooks:      running totals count-up on every update (600ms ease-out-quart)
                     live trade feed entries slide-in-from-top + row-flash
                     tick prices shimmer on change
                     session stats count-up
                     bot status icons icon-pulse when running
                     AI Guardian pause icon-pulse on alert
  Responsive:         running totals 1/2/4 cols (sm/md/lg)
                     live feed full-width virtualized list (50 items)
                     tick prices 2-col sm, 4-col md
                     session stats 1/2/4 cols (sm/md/lg)
                     active bots 1-col sm, 2-col md

SECTIONS (5 — see tradeMO.md §7 I-5 for full content + sample data):
  SECTION 1: LIVE RUNNING TOTALS
  SECTION 2: LIVE TRADE FEED (scrolling, newest first, virtualized)
  SECTION 3: LIVE NUMBER TICKERS
  SECTION 4: SESSION STATISTICS
  SECTION 5: ACTIVE BOTS IN POOL

TANSTACK QUERY KEYS:
  ["investor", "live-totals"]         → useQuery, refetchInterval 5s
  ["investor", "session-stats"]        → useQuery, refetchInterval 30s
  ["investor", "active-bots"]         → useQuery, refetchInterval 30s

SOCKET EVENTS (pushed): see tradeMO.md §7 I-5
SAMPLE LIVE TRADE PAYLOAD: see tradeMO.md §7 I-5
```

---

### PAGE I-6: My Investments (`/investor/investments`)

```
PURPOSE:
  Track all investments across all pools.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-investments.css
  Root class:        .page-investor-investments
  Motion hooks:      summary cards count-up
                     active investment cards fadeSlideUp stagger
                     completed cards checkmark icon-draw
                     timeline items slide-in-from-left
                     ROI badges hover-lift
  Responsive:         summary 1/2/4 cols (sm/md/lg)
                     active investments 1-col sm, 2-col md
                     completed investments list → stacked cards < md
                     booked slots 1-col sm, 2-col md
                     timeline vertical on sm

SECTIONS (5 — see tradeMO.md §7 I-6 for full content + sample data):
  SECTION 1: INVESTMENT SUMMARY
  SECTION 2: ACTIVE INVESTMENTS
  SECTION 3: COMPLETED INVESTMENTS
  SECTION 4: BOOKED SLOTS (upcoming pools)
  SECTION 5: INVESTMENT TIMELINE

TANSTACK QUERY KEYS:
  ["investor", "investments-summary"]                → useQuery
  ["investor", "active-investments"]                  → useQuery, refetchInterval 60s
  ["investor", "completed-investments", { page }]    → useQuery
  ["investor", "booked-slots"]                         → useQuery
  ["investor", "investment-timeline", { limit: 50 }] → useQuery

MUTATIONS:
  useRequestPayout()  → POST /api/wallet/payout
  useAddMoreSlots()   → navigate /investor/pools/:id/book
  useCancelInterest() → DELETE /api/pools/:id/interest
```

---

### PAGE I-7: Wallet & Finances (`/investor/wallet`)

```
PURPOSE:
  Central wallet. Balance, deposit, request payout,
  transaction history, payment methods.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-wallet.css
  Root class:        .page-investor-wallet
  Motion hooks:      wallet balance count-up
                     deposit quick buttons hover-lift
                     payment method cards fadeSlideUp stagger + selected-lift
                     payout form fields staggered entrance
                     transaction table rows fadeSlideUp stagger
                     saved methods default star icon-pulse
  Responsive:         wallet overview 1/2/2 cols (sm/md/lg)
                     deposit + payout side-by-side md, stacked sm
                     transactions table → stacked cards < md
                     saved methods 1-col sm, 2-col md

SECTIONS (5 — see tradeMO.md §7 I-7 for full content + sample data):
  SECTION 1: WALLET OVERVIEW
  SECTION 2: DEPOSIT FUNDS
  SECTION 3: REQUEST PAYOUT
  SECTION 4: TRANSACTION HISTORY (TanStack Table)
  SECTION 5: SAVED PAYMENT METHODS

TANSTACK QUERY KEYS:
  ["wallet", "overview"]                          → useQuery, refetchInterval 30s
  ["wallet", "transactions", { page, filters }]  → useQuery
  ["wallet", "recent-payouts", { limit: 5 }]       → useQuery
  ["wallet", "payment-methods"]                    → useQuery

MUTATIONS:
  useDeposit()         → POST /api/wallet/deposit
  useRequestPayout()   → POST /api/wallet/payout
  useAddPaymentMethod() → POST /api/wallet/payment-methods
  useRemovePaymentMethod() → DELETE /api/wallet/payment-methods/:id
  useSetDefaultMethod() → POST /api/wallet/payment-methods/:id/default

SAMPLE PAYLOAD: see tradeMO.md §7 I-7
```

---

### PAGE I-8: Investment Calculator (`/investor/calculator`)

```
PURPOSE:
  Calculate potential returns, ROI projections, fee calculator.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-calculator.css
  Root class:        .page-investor-calculator
  Motion hooks:      calculator inputs live-update results (count-up on change)
                     compound growth chart chart-draw on input change
                     scenario comparison table rows fadeSlideUp
                     historical performance bar chart chart-draw
                     ROI disclaimer icon-pulse on attention
  Responsive:         calculator inputs 1-col sm, 2-col md
                     results side-by-side md, stacked sm
                     compound growth chart full-width
                     scenario comparison table → stacked cards < md
                     historical performance chart full-width

SECTIONS (5 — see tradeMO.md §7 I-8 for full content + sample data):
  SECTION 1: ROI CALCULATOR
  SECTION 2: COMPOUND GROWTH CALCULATOR
  SECTION 3: FEE CALCULATOR
  SECTION 4: SCENARIO COMPARISON
  SECTION 5: HISTORICAL POOL PERFORMANCE

TANSTACK QUERY KEYS:
  ["calculator", "roi", { amount, roi, duration }]      → useQuery (client-side calc)
  ["calculator", "compound", { principal, roi, pools }] → useQuery (client-side)
  ["calculator", "fees", { amount, method, share }]     → useQuery (client-side)
  ["calculator", "scenarios", { poolId }]               → useQuery
  ["pools", "historical-performance", { type: "similar" }] → useQuery
```

---

### PAGE I-9: Notifications & Activity (`/investor/notifications`)

```
PURPOSE:
  All investor notifications and activity log.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-notifications.css
  Root class:        .page-investor-notifications
  Motion hooks:      unread badge icon-pulse
                     notification list items fadeSlideUp stagger
                     category tabs fade in/out on switch
                     mark-read action icon-draw checkmark
                     empty state illustration fade
  Responsive:         notification list 1-col sm, 2-col md
                     category tabs horizontal scroll on sm
                     activity timeline vertical on sm

SECTIONS (5 — see tradeMO.md §7 I-9 for full content + sample data):
  SECTION 1: UNREAD NOTIFICATIONS
  SECTION 2: TRADE ACTIVITY
  SECTION 3: POOL UPDATES
  SECTION 4: PAYMENT & PAYOUT ALERTS
  SECTION 5: SYSTEM & SECURITY

TANSTACK QUERY KEYS:
  ["notifications", "unread"]                      → useQuery, refetchInterval 30s
  ["notifications", "trade-activity", { page }]    → useQuery
  ["notifications", "pool-updates", { page }]      → useQuery
  ["notifications", "payment-alerts", { page }]    → useQuery
  ["notifications", "system-security", { page }]   → useQuery

MUTATIONS:
  useMarkRead()      → PATCH /api/notifications/:id/read
  useMarkAllRead()   → POST /api/notifications/mark-all-read
  useUpdatePreferences() → PATCH /api/settings/notifications
```

---

### PAGE I-10: Referrals & Rewards (`/investor/referrals`)

```
PURPOSE:
  Referral program, daily streaks, rewards, bonus tracking.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-referrals.css
  Root class:        .page-investor-referrals
  Motion hooks:      referral code copy button hover-lift + checkmark icon-draw
                     streak counter count-up
                     weekly calendar day cells fadeSlideUp stagger (60ms)
                     available rewards cards hover-lift + claim icon-pulse
                     leaderboard rank change animation
  Responsive:         referral + share buttons 2-col md, stacked sm
                     streak calendar 7-col md, 4-col sm, 2-col xs
                     available rewards 1-col sm, 2-col md
                     leaderboard table → stacked cards < md

SECTIONS (5 — see tradeMO.md §7 I-10 for full content + sample data):
  SECTION 1: REFERRAL PROGRAM
  SECTION 2: DAILY STREAKS
  SECTION 3: AVAILABLE REWARDS
  SECTION 4: REFERRAL LEADERBOARD
  SECTION 5: REWARD HISTORY

TANSTACK QUERY KEYS:
  ["referrals", "code-and-stats"]   → useQuery
  ["referrals", "streak"]            → useQuery, refetchInterval 60s
  ["referrals", "available-rewards"] → useQuery
  ["referrals", "leaderboard", { period: "month" }] → useQuery
  ["referrals", "history", { page }] → useQuery

MUTATIONS:
  useClaimReward() → POST /api/rewards/:id/claim
  useClaimDailyBonus() → POST /api/referrals/claim-daily
```

---

### PAGE I-11: Earnings & Reports (`/investor/earnings`)

```
PURPOSE:
  Detailed earnings breakdown, tax reporting, export.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-earnings.css
  Root class:        .page-investor-earnings
  Motion hooks:      earnings overview cards count-up
                     per-pool breakdown cards fadeSlideUp stagger
                     earnings timeline items slide-in-from-left
                     tax report icon-draw success
                     profit sharing breakdown formula fade in
  Responsive:         overview 1/2/4 cols (sm/md/lg)
                     per-pool breakdown 1-col sm, 2-col md
                     timeline vertical on sm
                     tax report download buttons full-width sm
                     profit sharing formula 1-col sm

SECTIONS (5 — see tradeMO.md §7 I-11 for full content + sample data):
  SECTION 1: EARNINGS OVERVIEW
  SECTION 2: EARNINGS BY POOL
  SECTION 3: EARNINGS TIMELINE
  SECTION 4: TAX REPORT INFORMATION
  SECTION 5: PROFIT SHARING BREAKDOWN

TANSTACK QUERY KEYS:
  ["earnings", "overview"]                  → useQuery
  ["earnings", "by-pool"]                   → useQuery, refetchInterval 180s
  ["earnings", "timeline", { period }]      → useQuery
  ["earnings", "tax-report", { year }]      → useQuery

MUTATIONS:
  useExportCSV()       → POST /api/earnings/export-csv
  useExportPDF()       → POST /api/earnings/export-pdf
  useDownloadTaxReport() → POST /api/earnings/tax-report
```

---

### PAGE I-12: Investor Settings (`/investor/settings`)

```
PURPOSE:
  Profile, security, notification preferences, payout preferences, KYC.

STYLE RULES:
  Page stylesheet:   src/styles/pages/investor-settings.css
  Root class:        .page-investor-settings
  Motion hooks:      tab switch fade in/out 200ms
                     form fields staggered entrance per tab
                     security badges icon-pulse on weak
                     KYC level badges icon-draw on success
                     payout preferences radio cards hover-lift + selected-lift
                     save button checkmark icon-draw on success
  Responsive:         tab nav horizontal scroll on sm
                     forms 1-col sm, 2-col md
                     KYC documents grid 2-col sm, 4-col md

SECTIONS (5 — see tradeMO.md §7 I-12 for full content + sample data):
  SECTION 1: PROFILE (with role switch option)
  SECTION 2: SECURITY (password, 2FA, sessions)
  SECTION 3: NOTIFICATION PREFERENCES
  SECTION 4: PAYOUT PREFERENCES
  SECTION 5: KYC / VERIFICATION STATUS

TANSTACK QUERY KEYS:
  ["user", "profile"]                          → useQuery
  ["settings", "security"]                     → useQuery
  ["settings", "notifications"]                 → useQuery
  ["settings", "payout-preferences"]           → useQuery
  ["kyc", "status"]                            → useQuery
  ["kyc", "documents"]                         → useQuery
  ["kyc", "history"]                           → useQuery
  ["sessions", "active"]                        → useQuery, refetchInterval 60s

MUTATIONS:
  useUpdateProfile()         → PATCH /api/user/profile
  useChangePassword()        → POST /api/user/change-password
  useEnable2FA()             → POST /api/user/2fa/enable
  useDisable2FA()            → DELETE /api/user/2fa
  useRevokeSession()         → DELETE /api/sessions/:id
  useRevokeAllSessions()     → POST /api/sessions/revoke-all
  useUpdateNotifications()   → PATCH /api/settings/notifications
  useUpdatePayoutPreferences() → PATCH /api/settings/payout-preferences
  useSetDefaultPayoutMethod() → POST /api/wallet/payment-methods/:id/default
  useRequestKYCUpgrade()     → POST /api/kyc/upgrade-level
  useReuploadDocument()      → POST /api/kyc/reupload

SAMPLE PAYLOAD: see tradeMO.md §7 I-12
```

---

## 6. SHARED COMPONENTS  (investor-relevant subset)

```
LAYOUT (always-mounted, app-shell.css — shared with operator app):
  ├── Sidebar          — investor navigation (Overview, Pools, Live, Investments,
                         Wallet, Calculator, Notifications, Referrals, Earnings, Settings)
                         offcanvas on mobile via Bootstrap 5.3 Offcanvas component
  ├── TopBar           — search, notifications bell, user menu (sticky)
  ├── PageWrapper      — consistent padding, max-width 1200px, breadcrumb
  └── MobileNav        — bottom navigation for mobile (5 main destinations)

DATA DISPLAY (shared/components CSS, loaded at app root):
  ├── StatCard         — value + label + trend indicator + count-up
  ├── DataTable        — TanStack Table wrapper (sort/filter/page)
  ├── ChartWrapper     — Recharts wrapper (chart-draw on mount)
  ├── LivePrice       — real-time price with direction arrow + shimmer
  ├── PnLBadge        — green/red P&L display with sign
  ├── StatusIndicator — 🟢🟡🔴 status dot + text + icon-pulse
  ├── CountdownTimer  — live countdown (days, hours, minutes, seconds)
  ├── ProgressFillBar — percentage fill with label + chart-draw animation
  └── TimeAgo         — relative time display

INVESTOR-SPECIFIC COMPONENTS:
  ├── InvestorCard     — investor's profile card with stats
  ├── KYCStatusBadge  — verification level indicator (L1/L2/L3)
  ├── DepositStatusBadge — pending/verified/failed
  ├── PayoutStatusBadge — pending/processing/completed
  ├── PackageCard      — pool summary for investor lists (with hover-lift)
  ├── PackageStatusBadge — open/trading/completed (with chart-draw fill)
  ├── InvestmentCard   — investor's investment in a pool
  └── EarningsDisplay  — live earnings with auto-refresh + count-up

MODALS (shared):
  ├── ConfirmModal     — "Are you sure?" with custom message
  ├── PackageBookingModal — slot booking flow
  ├── PayoutModal      — payout request form
  └── NotificationPopup — toast/notification system

FEEDBACK:
  ├── Toast            — success/error/warning/info (icon-spin on loading)
  ├── LoadingSpinner   — loading indicator
  ├── SkeletonCard     — content placeholder while loading
  └── EmptyState       — "No data yet" with CTA

LAYOUT UTILITIES (Bootstrap extensions):
  ├── SectionDivider   — flex divider with title in middle
  ├── ResponsiveTable  — auto-collapses to stacked cards on mobile (< md)
  ├── OffcanvasSidebar — mobile sidebar with backdrop dismissal
  └── StickyFooter     — sticky action bar at bottom of long forms (booking, payout)
```

---

## 7. STATE MANAGEMENT  (investor-scoped)

### 7.1 Zustand Stores (Client State)

```
useAuthStore (shared with operator app):
  ├── user: User | null
  ├── isAuthenticated: boolean
  ├── role: "operator" | "investor" | "both"  (on investor pages, role is "investor" or "both")
  ├── primaryRole: "investor"  (for default landing)
  ├── login, logout, refreshToken, updateUser

useDerivStore (read-only for investors — investors don't connect Deriv directly):
  ├── connections: []  (always empty for pure-investor users)
  ├── ticks: Map<symbol, tickData>  (subscribed via operator-owned bots)
  ├── subscribe(symbol), unsubscribe(symbol)
  ├── (no buy/sell for investors — operator handles trades)

usePackageStore:
  ├── packages: Package[]
  ├── activePackages: Package[]  (filter: status=trading, includes my investments)
  ├── openPackages: Package[]     (filter: status=open, accepting bookings)
  ├── upcomingPackages: Package[]
  ├── completedPackages: Package[]
  ├── fetchPackages, fetchMyInvestments

useInvestmentStore:
  ├── myInvestments: Investment[]
  ├── activeInvestments: Investment[]
  ├── completedInvestments: Investment[]
  ├── bookedSlots: Investment[]  (upcoming pools, payment pending/confirmed)
  ├── fetchMyInvestments, createBooking, cancelBooking

useWalletStore:
  ├── balance, lockedBalance, totalEarned
  ├── transactions: WalletTransaction[]
  ├── paymentMethods: PaymentMethod[]
  ├── deposit, requestPayout, addPaymentMethod, setDefaultMethod

useEarningsStore:
  ├── lifetimeTotal, thisMonth, byPoolBreakdown
  ├── timeline: DailyEarningAgg[]
  ├── fetchEarnings, exportCSV, exportPDF, downloadTaxReport

useNotificationsStore:
  ├── unread: Notification[]
  ├── tradeActivity: Notification[]
  ├── poolUpdates: Notification[]
  ├── paymentAlerts: Notification[]
  ├── systemSecurity: Notification[]
  ├── fetchUnread, markRead, markAllRead

useReferralsStore:
  ├── referralCode, referralStats
  ├── streak: { current, best, lastClaimDate }
  ├── availableRewards: Reward[]
  ├── leaderboard: InvestorReferralRank[]
  ├── history: Reward[]
  ├── claimReward, claimDailyBonus

useUIStore (shared with operator app):
  ├── sidebarOpen, theme, notifications, activeModal
  ├── mountedStylesheets: Set<string>  // tracks page-scoped CSS lifecycle
  ├── mountStyle(key, href), unmountStyle(key)
```

### 7.2 TanStack Query Keys (investor-scoped)

```
QUERY KEYS (canonical, used by all investor pages):
  ["user"]                                              → current user
  ["investor", "overview"]                              → investor overview (KPI summary)
  ["investor", "active-pools"]                          → pools with my active investments
  ["investor", "earnings-ticker"]                        → live earnings ticker (3-min refresh)
  ["investor", "upcoming-pools"]                         → upcoming pools for booking
  ["investor", "recent-activity", { limit }]             → recent activity feed
  ["investor", "live-totals"]                            → live trade tracker totals
  ["investor", "session-stats"]                          → live trade session statistics
  ["investor", "active-bots"]                            → bots currently trading my pools
  ["investor", "investments-summary"]                   → investments summary KPIs
  ["investor", "active-investments"]                     → active investments detail
  ["investor", "completed-investments", { page }]        → completed investments
  ["investor", "booked-slots"]                           → upcoming booked slots
  ["investor", "investment-timeline", { limit }]         → investment action timeline
  ["pools", { status: "trading", investorId }]           → all trading pools with my investments
  ["pools", { status: "open", investorId }]              → pools accepting bookings
  ["pools", { status: "upcoming" }]                      → upcoming pools
  ["pools", { status: "completed", investorId }]         → completed pools
  ["pools", "roadmap"]                                    → 90-day pool roadmap
  ["pools", poolId, "overview"]                          → single pool overview
  ["pools", poolId, "my-investment"]                     → my investment in this pool
  ["pools", poolId, "performance"]                        → pool performance metrics
  ["pools", poolId, "ai-guardian"]                        → AI Guardian status for this pool
  ["pools", poolId, "participants"]                      → anonymized participants
  ["pools", poolId, "booking-context"]                   → booking form context
  ["investments", "my-bookings", poolId]                 → my existing bookings in this pool
  ["investments", bookingId, "status"]                   → booking payment status tracker
  ["wallet", "overview"]                                  → wallet balance + locked
  ["wallet", "transactions", { page }]                    → wallet transaction history
  ["wallet", "recent-payouts", { limit: 5 }]              → recent payout list
  ["wallet", "payment-methods"]                           → saved payment methods
  ["calculator", "roi", { amount, roi, duration }]        → ROI calc (client-side)
  ["calculator", "compound", { principal, roi, pools }]  → compound growth (client-side)
  ["calculator", "fees", { amount, method, share }]        → fee calc (client-side)
  ["calculator", "scenarios", { poolId }]                  → scenario comparison
  ["pools", "historical-performance", { type }]            → past pool performance
  ["notifications", "unread"]                              → unread notifications
  ["notifications", "trade-activity", { page }]            → trade activity feed
  ["notifications", "pool-updates", { page }]              → pool update notifications
  ["notifications", "payment-alerts", { page }]            → payment/payout alerts
  ["notifications", "system-security", { page }]           → system/security notifications
  ["referrals", "code-and-stats"]                          → referral code + summary stats
  ["referrals", "streak"]                                   → daily streak data
  ["referrals", "available-rewards"]                       → claimable rewards
  ["referrals", "leaderboard", { period }]                  → referral leaderboard
  ["referrals", "history", { page }]                        → claimed reward history
  ["earnings", "overview"]                                  → earnings summary KPIs
  ["earnings", "by-pool"]                                   → earnings per pool
  ["earnings", "timeline", { period }]                      → earnings timeline
  ["earnings", "tax-report", { year }]                      → tax report data
  ["user", "profile"]                                       → investor profile
  ["settings", "security"]                                  → security settings
  ["settings", "notifications"]                            → notification preferences
  ["settings", "payout-preferences"]                       → payout preferences
  ["kyc", "status"]                                        → KYC verification status
  ["kyc", "documents"]                                     → submitted KYC documents
  ["kyc", "history"]                                       → KYC submission history
  ["sessions", "active"]                                    → active sessions

MUTATIONS:
  useCreateBooking()         → POST /api/investments
  useCancelBooking()         → DELETE /api/investments/:id
  useBookMoreSlots()         → POST /api/investments (for additional slots)
  useDeposit()               → POST /api/wallet/deposit
  useRequestPayout()         → POST /api/wallet/payout
  useAddPaymentMethod()      → POST /api/wallet/payment-methods
  useRemovePaymentMethod()   → DELETE /api/wallet/payment-methods/:id
  useSetDefaultMethod()      → POST /api/wallet/payment-methods/:id/default
  useExportCSV()              → POST /api/earnings/export-csv
  useExportPDF()              → POST /api/earnings/export-pdf
  useDownloadTaxReport()      → POST /api/earnings/tax-report
  useMarkRead()              → PATCH /api/notifications/:id/read
  useMarkAllRead()           → POST /api/notifications/mark-all-read
  useUpdatePreferences()     → PATCH /api/settings/notifications
  useClaimReward()           → POST /api/rewards/:id/claim
  useClaimDailyBonus()       → POST /api/referrals/claim-daily
  useSetReminder()           → POST /api/pools/:id/remind
  usePrebookInterest()       → POST /api/pools/:id/interest
  useUpdateProfile()         → PATCH /api/user/profile
  useChangePassword()        → POST /api/user/change-password
  useEnable2FA()             → POST /api/user/2fa/enable
  useDisable2FA()            → DELETE /api/user/2fa
  useRevokeSession()         → DELETE /api/sessions/:id
  useRevokeAllSessions()     → POST /api/sessions/revoke-all
  useUpdatePayoutPreferences() → PATCH /api/settings/payout-preferences
  useRequestKYCUpgrade()     → POST /api/kyc/upgrade-level
  useReuploadDocument()      → POST /api/kyc/reupload
```

---

## 8. SOCKET EVENTS  (investor-side)

```
INVESTOR-SIDE EVENTS (broadcast to investor room:userId):
  investor:earnings_update  → { packageId, pnl, roi, lastUpdated, yourShare }
    - Invalidates: ["investor","earnings-ticker"]
    - Updates: active pool card P&L on I-1, I-3

  investor:pool_status      → { packageId, status, timeLeft }
    - Invalidates: ["investor","active-pools"], ["pools", poolId, "overview"]
    - Updates: pool status badge on I-1, I-2, I-3

  investor:trade_result     → { packageId, trade, yourShareImpact }
    - Pushes: new entry to I-1 recent activity + I-5 live feed
    - Updates: I-5 running totals + session stats
    - Invalidates: ["investor","earnings-ticker"]

  investor:payout_status    → { payoutId, status, amount }
    - Invalidates: ["wallet","overview"], ["wallet","recent-payouts"]
    - Pushes: to I-1 recent activity + I-9 payment alerts

  investor:ai_guardian      → { packageId, triggerType, action }
    - Invalidates: ["pools", poolId, "ai-guardian"]
    - Pushes: to I-1 recent activity + I-9 pool updates
    - Updates: AI Guardian status card on I-3, I-5

  investor:announcement     → { announcementId, subject, body }
    - Invalidates: ["notifications","unread"]
    - Pushes: to I-9 notifications list

THROTTLING (server-side):
  - Trade results: batch per 10 seconds for investors
  - Running totals: update every 5 seconds
  - Earnings: every 3 minutes (or manual refresh)
  - AI Guardian: immediate
  - Pool status changes: immediate
  - Announcements: immediate

CLIENT-SIDE RECONNECT:
  - Exponential backoff (1s → 2s → 5s → 15s)
  - On reconnect: re-fetch invalidated query keys (TanStack Query invalidation)
  - Show "Reconnecting..." toast on disconnect > 2s
  - Auto-clear toast on reconnect

SAMPLE LIVE TRADE PAYLOAD (pushed to investor):
{
  "type": "investor:trade_result",
  "trade": {
    "tradeId": "trd_8f2a1c9d",
    "poolId": "pkg_01",
    "symbol": "R_10",
    "contractType": "CALL",
    "stake": 35.00,
    "payout": 63.00,
    "profit": 28.00,
    "isWin": true,
    "entrySpot": 4531.92,
    "exitSpot": 4532.18,
    "boughtAt": "2026-10-18T14:23:42Z",
    "soldAt": "2026-10-18T14:23:47Z",
    "botName": "Bot-Alpha",
    "yourShareImpact": 8.40,
    "yourShareGross": 10.50,
    "platformCut": 2.10,
    "yourShareNet": 8.40
  }
}
```

---

## 9. CROSS-FILE REFERENCES

```
WHEN TO USE EACH FILE:
  tradeMO.md     — operator-facing outline (Home + Auth + 15 operator dashboard pages + all shared sections)
  investorMO.md  — investor-facing outline (12 investor dashboard pages, this file)

WHAT'S SHARED VERBATIM:
  ✓ Section 2 — Global Styling System (design tokens, motion, page-scoped CSS lifecycle)
  ✓ app-shell.css — always-mounted layout (sidebar, top bar, mobile nav)
  ✓ src/styles/components/*.css — shared components CSS (StatCard, DataTable, etc.)
  ✓ TanStack Start + Router + Query + Table framework
  ✓ Bootstrap 5.3.x UI library
  ✓ Prisma database schema (operator and investor share the same DB)
  ✓ Socket.IO event names (investor:* and operator:* are defined together)
  ✓ Auth flow (signup, signin, onboarding — investor routes via role router)
  ✓ Wallet & finance engine (deposit, payout, transaction flows)
  ✓ KYC verification flow
  ✓ Referral & rewards system

WHAT'S UNIQUE TO EACH FILE:
  Operator (tradeMO.md):
    - 15 operator dashboard pages (D-1 to D-15) with 5-7 sections each
    - Deriv API connection management (operator-only)
    - Bot & automation config (operator-only)
    - Trade scheduling (operator-only)
    - Investor management (KYC approval, force payout)
    - Funds & capital dashboard (operator-only)
    - Withdrawal/deposit queue approval
    - Communications & email templates

  Investor (this file):
    - 12 investor dashboard pages (I-1 to I-12) with 5-6 sections each
    - 1-to-1 page-to-stylesheet file mapping (12 routes, 12 CSS files)
    - Pool booking & payment flow (investor-side)
    - Live trade tracker (investor view, your share of P&L)
    - Investment calculator & compound growth
    - Referrals & daily streaks
    - Earnings & tax reports (investor-side)
    - KYC upgrade flow (investor-side)
    - Personal wallet & payment methods
    - Personal notification preferences

SYNC RULES:
  - When updating Section 2 (Global Styling System), update BOTH files in lockstep.
  - When adding a new investor page, add a row to Section 4 table above AND add a row to tradeMO.md Section 18 (Complete Page Index).
  - When changing a TanStack Query key for an investor page, update BOTH the page spec here (Section 5) and in tradeMO.md Section 7.
  - When renaming an investor route, update BOTH the Section 4 table here and Section 18 of tradeMO.md.
  - The app-shell.css file is always-mounted; never scope it under a .page-* class.
```

---
