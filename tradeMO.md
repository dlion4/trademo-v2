# DerivX — Advanced Application Outline

## Trading Platform Connected to Deriv API Endpoints

> A third-party trading platform with Deriv OAuth, bot automation, scriptable strategies, social monitoring, and full market access — modeled after app.bmxbot.com integration patterns.
>
> **Revision 2 — Stack reset to TanStack Start + Bootstrap 5.3.x with page-scoped CSS, motion system, and responsive card grids. Each of the 39 pages ships its own stylesheet; investorMO mirrors this file with a full 1-to-1 page-to-stylesheet mapping.**

---

## TABLE OF CONTENTS

```
1.  PROJECT OVERVIEW & ARCHITECTURE
2.  GLOBAL STYLING SYSTEM  (NEW)
3.  DERIV API INTEGRATION MAP
4.  HOME PAGES (3)
5.  AUTH PAGES (8) — EXPANDED
6.  OPERATOR DASHBOARD PAGES (15) — 5+ SECTIONS EACH, NO PLACEHOLDERS
7.  INVESTOR DASHBOARD PAGES (12) — MIRRORED IN investorMO.md
8.  SHARED COMPONENTS
9.  STATE MANAGEMENT
10. DATABASE SCHEMA
11. AUTOMATION & BOT ENGINE
12. SCRIPT ENGINE
13. CROWDFUNDING POOL DATA MODEL
14. LIVE TRADE TRACKER ENGINE
15. WALLET & FINANCE ENGINE
16. PROFIT CALCULATION ENGINE
17. DEPLOYMENT & ENVIRONMENT
18. COMPLETE PAGE INDEX
19. IMPLEMENTATION PHASES
```

---

## 1. PROJECT OVERVIEW & ARCHITECTURE

### 1.1 Tech Stack

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
  Custom CSS:      Page-scoped stylesheets — one per route, 1-to-1 file mapping
  Forms:           React Hook Form + Zod  (schema reuse across client + server)
  Code Editor:     Monaco Editor  (strategy script editing, syntax highlighting)
  Charts:          Lightweight Charts (TradingView) + Recharts (KPI/mini charts)
  Realtime:        WebSocket (Deriv API) + Socket.IO (internal broadcast)
  Animation:       Framer Motion + CSS keyframes + Bootstrap collapse/tab transitions
  Build:           Vite (TanStack Start default)

BACKEND (Node + Express, unchanged):
  Runtime:         Node.js 20 LTS + Express 4
  Database:        PostgreSQL 16 (Prisma ORM)
  Cache:           Redis 7 (sessions, rate limits, pub/sub, tick buffers)
  Auth:            Lucia/Auth.js (credentials) + Deriv OAuth2 + JWT refresh
  Queue:           BullMQ (bot jobs, trade execution, payout batches)
  WebSocket:       ws 8.x (Deriv WebSocket API multiplexer)
  Scripts:         isolated-vm  (sandboxed strategy scripts)
  File Storage:    S3-compatible (KYC docs, terms PDFs, exports)
  Mailer:          React Email + Resend  (transactional + templated emails)

INFRASTRUCTURE:
  Hosting:         VPS or AWS ECS (Fargate) behind Cloudflare
  Container:       Docker + docker-compose  (dev) / ECS task def (prod)
  CI/CD:           GitHub Actions  (type-check → test → build → deploy)
  Monitoring:      Prometheus + Grafana + Sentry
  Logging:         Winston → Loki → Grafana
  CDN:             Cloudflare  (static assets, cache, WAF)
```

### 1.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│              CLIENT (TanStack Start + Vite)              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐  │
│  │ Home │  │ Auth │  │Oper  │  │Invst │  │ Scripts  │  │
│  │route │  │route │  │route │  │route │  │ route    │  │
│  │.css  │  │.css  │  │.css  │  │.css  │  │ + editor │  │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WSS  (TanStack Router loaders)
┌──────────────────────▼──────────────────────────────────┐
│                  API GATEWAY (Express)                   │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │ Auth Routes│  │ Trade Routes│  │ Pool/Pkg Routes  │ │
│  └────────────┘  └─────────────┘  └──────────────────┘ │
└────┬───────────────┬────────────────┬──────────────────┘
     │               │                │
┌────▼────┐  ┌───────▼───────┐  ┌────▼─────────────────┐
│PostgreSQL│  │Deriv WebSocket│  │  BullMQ + Bot Engine │
│(Users,  │  │API (trades,   │  │  (strategy runner,   │
│ Pools,  │  │ ticks, auth)  │  │   trade executor)    │
│ Pkgs)   │  │               │  │                      │
└─────────┘  └───────┬───────┘  └──────────┬───────────┘
                     │                      │
              ┌──────▼──────────────────────▼──┐
              │     DERIV API (api.deriv.com)   │
              │  WebSocket: wss://ws.derivws... │
              │  OAuth: https://oauth.deriv.com │
              └─────────────────────────────────┘
```

### 1.3 Key Architecture Principle

```
OPERATOR MODEL:
  I (operator) → connect MY Deriv account → run MY bots
  Investors → join packages → their funds pooled into my capital
  I trade the pooled capital → profits distributed per package plan

  OPERATOR DASH = my command center (solo trading + managing investors)
  INVESTOR DASH  = what investors see (their packages, earnings, wallet)

  The operator dashboard IS the trading dashboard.
  There is no per-user trading on the operator side. I trade for everyone.
  Investors don't need Deriv accounts. They invest through me.
```

### 1.4 UI Framework & Styling System (Expanded)

```
BOOTSTRAP 5.3.x RESPONSIVE BASE:
  Grid:             container / row / col-* with sm-md-lg-xl-xxl breakpoints
  Components:       card, table, modal, offcanvas, accordion, toast,
                    dropdown, nav-tabs, progress, badge, navbar,
                    collapse, scrollspy, tab, popover, tooltip
  Utilities:        spacing (m-*, p-*, gap-*), flex (d-flex, gap-*),
                    display (d-none, d-md-block), rounded-4, shadow-*,
                    text-bg-*, opacity-*, ratio
  Breakpoints:      sm 576px / md 768px / lg 992px / xl 1200px / xxl 1400px
  Dark mode:        data-bs-theme="dark"  (native 5.3 toggle, persists in localStorage)
  Form controls:    form-control, form-select, input-group, form-check,
                    floating labels, validation states (is-valid/is-invalid)
  Offcanvas:        mobile sidebar via offcanvas-start, backdrop dismissal
  No jQuery — Bootstrap JS bundle imported per route (only when component needs it)

PAGE-SCOPED CUSTOM CSS (1-to-1 FILE MAPPING):
  Convention:       one stylesheet per page/route — 39 pages → 39 stylesheets
  File location:    src/styles/pages/<route-slug>.css
                    e.g. /dashboard/schedules → src/styles/pages/dashboard-schedules.css
                    e.g. /investor/pools/:id  → src/styles/pages/investor-pool-detail.css
  Namespacing:      every selector scoped under .page-<slug>  root class
                    .page-command-center { … }
                    .page-package-manager { … }
  Layer order:      1) Bootstrap 5.3 (CDN/compiled)
                    2) Global design tokens (src/styles/tokens.css)
                    3) Shared component CSS (src/styles/components/*.css)
                    4) Page-scoped stylesheet (mounted at route enter)
  Injection lifecycle:
                    TanStack Router createFileRoute() loader →
                    inject <link rel="stylesheet"> into <head> →
                    on route leave: remove the <link> + clear cached styles
                    Guarantees no style leaks across pages.
  Hot-reload:       Vite HMR wires the page stylesheet to its route component;
                    edits reflect instantly without manual refresh.

ANIMATION SYSTEM:
  Page entrance:    fade + slide-up stagger (50-80ms per item, capped at 12 items)
  Micro-interact:   hover-lift + shadow on cards; spin/pulse on live icons;
                    draw-in stroke animation on SVG/CSS charts
  Data motion:      number count-up on KPI cards (1.2s ease-out, requestAnimationFrame);
                    row flash green/red 800ms on new entries;
                    chart draw-in 600ms on data load
  Real-time:        pulse dot for "live" indicators; spin on sync icons;
                    ripple on tap for mobile buttons
  A11y:             prefers-reduced-motion → disable count-up (snap to final),
                    disable draw-ins, disable flash, keep static transitions only

RESPONSIVE CARD & SECTION SYSTEM:
  KPI rows:          row-cols-1 row-cols-md-2 row-cols-xl-4  → 1/2/4 column flow
  Card grids:        row-cols-1 row-cols-sm-2 row-cols-lg-3  → 1/2/3 flow
  Tables-to-cards:   on < md breakpoint, tables collapse to stacked card layout
                     using data-label attributes (CSS ::before content)
  Sidebar:           fixed on lg+; offcanvas on md/sm with backdrop
  Top bar:           sticky with collapse-on-scroll; mobile hamburger triggers offcanvas
  Form layout:       vertical stack on sm, horizontal label on md+
  Drawer panels:     slide-in from right on lg+, full-screen modal on sm
```

---

## 2. GLOBAL STYLING SYSTEM  (NEW SECTION)

> This section is shared identically across `tradeMO.md` and `investorMO.md`. Any change here MUST be applied to both files in lockstep.

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

  // src/routes/dashboard.schedules.tsx
  import { createFileRoute } from "@tanstack/router";
  import schedulesStyles from "@/styles/pages/dashboard-schedules.css";

  export const Route = createFileRoute("/dashboard/schedules")({
    // 1. Inject page stylesheet on enter
    loader: async ({ context }) => {
      context.styles.mount("dashboard-schedules", schedulesStyles);
      return await context.queryClient.ensureQueryData(...);
    },
    // 2. Remove on leave
    onLeave: ({ context }) => {
      context.styles.unmount("dashboard-schedules");
    },
    // 3. Component scoped under .page-dashboard-schedules root class
    component: SchedulesPage,
  });

BEHAVIOR:
  ✓ Stylesheet is mounted exactly once when the route becomes active.
  ✓ Multiple instances of the same route (e.g. dev HMR) deduplicate via loader context.
  ✓ On route transition (leave), the <link> element is removed from <head> and
    all .page-<slug> scoped rules stop applying.
  ✓ Page components render a <div className="page-dashboard-schedules"> wrapper;
    all selectors in the page stylesheet are scoped under this root class.
  ✓ Cross-page style leakage is structurally impossible.

MIGRATION SAFETY:
  - Bootstrap utility classes still apply globally (intended).
  - Shared component CSS files (src/styles/components/*.css) are loaded at app root,
    so components like StatCard render identically on every page.
  - Page stylesheets only override layout/visual specifics for that page.
```

### 2.3 Animation Patterns (Reusable Across All 39 Pages)

```
ENTRANCE PATTERNS:

  .page-<slug> > * { opacity: 0; transform: translateY(8px); }
  .page-<slug>.is-entered > * {
    animation: fadeSlideUp var(--dur-base) var(--ease-out) forwards;
    animation-delay: calc(var(--idx) * var(--stagger-step));
  }
  /* var(--idx) set per child via :nth-child or inline style */

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

HOVER-LIFT CARDS:

  .page-<slug> .card.hover-lift {
    transition: transform var(--dur-fast) var(--ease-out),
                box-shadow var(--dur-fast) var(--ease-out);
  }
  .page-<slug> .card.hover-lift:hover {
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
    /* count-up snaps to final value; chart draw-ins skipped;
       row flash skipped; icon spin/pulse disabled */
  }
```

### 2.4 Responsive Card & Section Patterns

```
KPI ROW (1/2/4 column flow):

  <div className="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 page-<slug>">
    <div className="col"><StatCard .../></div>
    <div className="col"><StatCard .../></div>
    <div className="col"><StatCard .../></div>
    <div className="col"><StatCard .../></div>
  </div>

CARD GRID (1/2/3 flow with hover-lift):

  <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
    {items.map(p => <div className="col"><PackageCard .../></div>)}
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
      <Offcanvas.Title>DerivX Operator</Offcanvas.Title>
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

### 2.5 Page-Scoped Stylesheet Index (1-to-1 Mapping)

```
The platform has 39 pages. Each ships its own stylesheet under
src/styles/pages/<route-slug>.css. investorMO.md mirrors this
mapping for the 12 investor pages.

HOME PAGES (3 stylesheets):
  H-1  src/styles/pages/landing.css
  H-2  src/styles/pages/features.css
  H-3  src/styles/pages/pricing.css

AUTH PAGES (8 stylesheets):
  A-1  src/styles/pages/auth-signup.css
  A-2  src/styles/pages/auth-signin.css
  A-3  src/styles/pages/auth-onboarding-investor.css
  A-4  src/styles/pages/auth-forgot-password.css
  A-5  src/styles/pages/auth-reset-password.css
  A-6  src/styles/pages/auth-verify-email.css
  A-7  src/styles/pages/auth-2fa.css
  A-8  src/styles/pages/auth-deriv-callback.css

OPERATOR DASHBOARD (15 stylesheets):
  D-1   src/styles/pages/dashboard-command-center.css
  D-2   src/styles/pages/dashboard-schedules.css
  D-3   src/styles/pages/dashboard-live-trading.css
  D-4   src/styles/pages/dashboard-trade-log.css
  D-5   src/styles/pages/dashboard-packages.css
  D-6   src/styles/pages/dashboard-investors.css
  D-7   src/styles/pages/dashboard-analytics.css
  D-8   src/styles/pages/dashboard-funds.css
  D-9   src/styles/pages/dashboard-withdrawals.css
  D-10  src/styles/pages/dashboard-comms.css
  D-11  src/styles/pages/dashboard-deposits.css
  D-12  src/styles/pages/dashboard-logs.css
  D-13  src/styles/pages/dashboard-markets.css
  D-14  src/styles/pages/dashboard-bots.css
  D-15  src/styles/pages/dashboard-settings.css

INVESTOR DASHBOARD (12 stylesheets — mirrored in investorMO.md):
  I-1   src/styles/pages/investor-overview.css
  I-2   src/styles/pages/investor-pools.css
  I-3   src/styles/pages/investor-pool-detail.css
  I-4   src/styles/pages/investor-pool-booking.css
  I-5   src/styles/pages/investor-live.css
  I-6   src/styles/pages/investor-investments.css
  I-7   src/styles/pages/investor-wallet.css
  I-8   src/styles/pages/investor-calculator.css
  I-9   src/styles/pages/investor-notifications.css
  I-10  src/styles/pages/investor-referrals.css
  I-11  src/styles/pages/investor-earnings.css
  I-12  src/styles/pages/investor-settings.css

SHARED LAYOUT STYLESHEET (always mounted):
  src/styles/app-shell.css
  (sidebar, top bar, mobile nav, dark-mode toggle, page wrapper)

TOTAL: 38 page stylesheets + 1 app-shell = 39 stylesheets
```

### 2.6 Page Style Block Template (attached to every page-spec intro below)

```
Every page in sections 4-7 below carries this STYLE block at its intro:

STYLE RULES:
  Page stylesheet:   src/styles/pages/<route-slug>.css
  Root class:        .page-<slug>  (scoped under this root only)
  Mount lifecycle:   TanStack Router loader → mount <link>; onLeave → unmount
  Motion hooks:      fadeSlideUp stagger (60ms/item, max 12 items)
                     hover-lift on .card.hover-lift
                     count-up on KPI numbers (1.2s ease-out-quart)
                     icon-pulse on live status indicators
                     row-flash-win / row-flash-loss on live trade rows
                     chart-draw on data charts (600ms ease-out)
  Responsive:         KPIs 1/2/4 cols (sm/md/xl)
                     card grids 1/2/3 cols (sm/lg)
                     tables collapse to stacked cards < md
                     sidebar offcanvas < lg, static lg+
                     forms vertical < md, horizontal md+
  Reduced motion:    count-up snaps to final; draw-ins skipped;
                     pulse/spin disabled; row-flash disabled
```

---

## 3. DERIV API INTEGRATION MAP

### 3.1 Deriv WebSocket API Endpoints

```
CONNECTION:
  URL: wss://ws.derivws.com/websockets/v3?app_id={APP_ID}
  App Registration: https://api.deriv.com/app-manager
  Connection Pool:   single multiplexed WS per DerivConnection,
                     req_id tracking for parallel requests,
                     auto-reconnect with exponential backoff (1s → 2s → 5s → 15s)

AUTHENTICATION:
  oauth2.authorize     → Deriv OAuth flow (redirect-based)
  authorize             → Token-based auth after OAuth
  logout                → Disconnect session, revoke WS subscriptions

MARKET DATA:
  active_symbols        → List all available trading symbols + markets
  trading_times         → Market open/close schedules per day
  tick                  → Subscribe to real-time price ticks
  ticks_history         → Historical OHLC + tick data
  proposal              → Get price proposal for a contract
  proposal_array         → Multiple proposals at once (batch)
  proposal_open_contract  → Subscribe to live open-contract state

TRADING:
  buy                   → Purchase a contract (proposal → buy)
  sell                  → Sell an open contract
  cancel                → Cancel a pending purchase (within 3s window)

PORTFOLIO:
  balance               → Account balance (live subscription)
  statement             → Account statement/transactions (paginated)
  profit_table          → Profit/loss history (paginated)
  transaction           → Subscribe to all account transactions

ACCOUNT:
  account_settings      → Get/set account settings
  get_account_limits    → Withdrawal limits, trading limits
  reality_check         → Reality check reminder config
  self_exclusion         → Self-exclusion settings

UTILITY:
  time                  → Server time (sync clock)
  ping                  → Keep-alive every 30s
  website_status        → Platform status, features, currencies
```

### 3.2 OAuth2 Flow Implementation

```
STEP 1: REGISTER APP
  → https://api.deriv.com/app-manager
  → Set redirect_uri (https://app.derivx.com/auth/deriv/callback)
  → Set scopes: Read, Trade, Payments, admin
  → Set app_name: "DerivX Operator Console"
  → Receive app_id

STEP 2: REDIRECT USER TO DERIV
  → GET https://oauth.deriv.com/en/authorize?
      app_id={APP_ID}&
      l={language}&
      redirect_uri={CALLBACK_URL}&
      state={CSRF_TOKEN}

STEP 3: USER AUTHORIZES ON DERIV
  → Deriv shows authorization screen (scopes requested)
  → User approves or denies
  → Step 3 must complete within 5 minutes (state TTL)

STEP 4: DERIV REDIRECTS BACK
  → GET {CALLBACK_URL}?code={AUTH_CODE}&acct1={LOGINID}&state={CSRF_TOKEN}
  → Validate state matches CSRF token (else abort)

STEP 5: EXCHANGE CODE FOR TOKEN
  → Open WebSocket to wss://ws.derivws.com/websockets/v3?app_id={APP_ID}
  → Send: { "authorize": "{AUTH_CODE}", "req_id": 1 }
  → Response: { "authorize": { "loginid": "...", "account_list": [...],
                               "balance": 1234.56, "currency": "USD",
                               "email": "...", "fullname": "..." } }

STEP 6: STORE TOKEN (encrypted)
  → Encrypt authorize token with AES-256-GCM (TOKEN_ENCRYPTION_KEY)
  → Persist to deriv_connections table
  → Link to current user record
  → Emit operator:deriv_connected socket event

STEP 7: RE-AUTHENTICATE (subsequent sessions)
  → On operator login → load encrypted token → decrypt
  → Open WebSocket → Send: { "authorize": "{STORED_TOKEN}" }
  → On success: session established, subscribe to balance
  → On failure (token expired): prompt re-connect

REVOKE / DISCONNECT:
  → WebSocket: { "logout": 1 }
  → Delete deriv_connections row (or mark status="revoked")
  → Kill BullMQ jobs for any bots tied to this connection
```

### 3.3 Supported Deriv Markets & Contract Types

```
MARKETS:
  ├── Forex          (frxEURUSD, frxGBPUSD, frxUSDJPY, ... 40+ pairs)
  ├── Synthetics    (R_10, R_25, R_50, R_75, R_100, 1HZ10V, 1HZ20V, ...)
  ├── Commodities   (frxXAUUSD Gold, frxXAGUSD Silver)
  ├── Crypto        (cryBTCUSD, cryETHUSD, cryLTCUSD, ...)
  ├── Indices       (frxUSDKRW, frxUSDMXN, ...)
  └── Stock Indices (DJI, SPX, NDX, DAX, FTSE, NIKKEI, HSI)

CONTRACT TYPES:
  ├── Rise/Fall              (CALL / PUT)
  ├── Higher/Lower           (barrier-based)
  ├── Touch/No Touch         (single barrier)
  ├── Ends Between/Outside   (two barriers)
  ├── Stays Between/Goes Outside (range)
  ├── Even/Odd               (synthetics — last digit)
  ├── Over/Under             (synthetics — last digit)
  ├── Lookback               (High/Low/Close over period)
  ├── Digit Match/Differ/Over/Under/Even/Odd
  └── Accumulator            (synthetics — multistep)

DURATIONS:
  ├── Ticks        (1-10 ticks — synthetics only)
  ├── Seconds      (15-3600s)
  ├── Minutes      (1-60m)
  ├── Hours        (1-24h)
  └── Days         (1-365d)

DEFAULT TRADING INSTRUMENTS (operator bots):
  Synthetics (Volatility Indices):  R_10, R_25, R_50, R_75, R_100
                                    1HZ10V, 1HZ20V, 1HZ30V, 1HZ50V
  Each bot is configured with one symbol + one contract type at a time.
  Bot engine rotates symbols per AI Guardian rule for randomization.
```

---

## 4. HOME PAGES (3 PAGES)

---

### PAGE H-1: Landing Page (`/`)

```
PURPOSE:
  First impression. Convince traders and investors to sign up.
  Show platform value proposition for both audiences.

STYLE RULES:
  Page stylesheet:   src/styles/pages/landing.css
  Root class:        .page-landing
  Motion hooks:      hero fadeSlideUp stagger (4 items, 80ms each)
                     hover-lift on feature cards
                     count-up on "10,000+ traders" stat
                     icon-draw on hero illustration
                     live-ticker scroll animation (continuous marquee)
  Responsive:         hero 2-col on lg, stacked on md
                     feature cards 3-col on lg, 1-col on sm
                     trust bar wraps on sm

LAYOUT:
┌─────────────────────────────────────────────────────────┐
│  NAVBAR                                                  │
│  [Logo: DerivX]  [Features] [Pricing] [Login] [Sign Up] │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  HERO SECTION                                            │
│                                                          │
│  "Trade Smarter on Deriv"                               │
│  "Automate strategies. Pool capital. Distribute profits."│
│                                                          │
│  [🤖 Start Trading →]  [💎 Invest in Pools →]          │
│                                                          │
│  Live Ticker Strip: EUR/USD 1.0842 ▲ | R_10 4532.11 ▲  │
│  (marquee scroll, pauses on hover, prefers-reduced-motion: static)│
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  TRUST BAR                                               │
│  "Powered by Deriv API" | "256-bit Encryption"          │
│  | "10,000+ traders" | "24/7 Automation"                │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  FEATURE CARDS (3)                                       │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ 🤖 Bot Engine   │  │ 💎 Crowdfunding │              │
│  │ Schedule & run  │  │ Pool capital,   │              │
│  │ automated trades│  │ earn from bots  │              │
│  └─────────────────┘  └─────────────────┘              │
│  ┌─────────────────┐                                   │
│  │ 📜 Script Engine│                                   │
│  │ Write custom JS │                                   │
│  │ strategies      │                                   │
│  └─────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  HOW IT WORKS                                            │
│  1. Connect Deriv  →  2. Set Packages  →               │
│  3. Schedule Trades  →  4. Distribute Profits           │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  CTA + FOOTER                                           │
└─────────────────────────────────────────────────────────┘
```

---

### PAGE H-2: Features Page (`/features`)

```
PURPOSE:
  Deep dive into every feature for both operators and investors.

STYLE RULES:
  Page stylesheet:   src/styles/pages/features.css
  Root class:        .page-features
  Motion hooks:      section fadeSlideUp stagger (5 sections, 60ms each)
                     hover-lift on each feature demo card
                     chart-draw on mini chart examples
                     icon-draw on feature glyphs

LAYOUT:
┌─────────────────────────────────────────────────────────┐
│  PAGE HERO                                               │
│  Feature sections with screenshots/animation             │
│                                                          │
│  1. Bot Engine & Scheduling                             │
│     - Visual schedule calendar                          │
│     - Live trade feed preview                           │
│     - Bot config screen mockup                          │
│                                                          │
│  2. Script Engine                                       │
│     - Monaco editor with sample strategy                │
│     - onTick / onResult API surface                     │
│     - Sandboxed VM safety explainer                     │
│                                                          │
│  3. Crowdfunding Pools & Packages                       │
│     - Pool lifecycle visual (5 stages)                  │
│     - Investor share calculation example                │
│     - Payout timeline                                   │
│                                                          │
│  4. AI Guardian Capital Protection                       │
│     - Trigger rules visualization                       │
│     - Real trigger event log snippet                    │
│     - Auto-pause + cooldown flow                        │
│                                                          │
│  5. Market Coverage (100+ instruments)                   │
│     - Markets tabs with sample symbols                  │
│     - Contract types breakdown                          │
│     - Duration picker demo                              │
│                                                          │
│  COMPARISON TABLE (Operator vs Investor feature matrix) │
│  CTA + FOOTER                                           │
└─────────────────────────────────────────────────────────┘
```

---

### PAGE H-3: Pricing Page (`/pricing`)

```
PURPOSE:
  Tiered pricing for operators. Free tier to start.
  Pro tier for serious operators. Team for groups.

STYLE RULES:
  Page stylesheet:   src/styles/pages/pricing.css
  Root class:        .page-pricing
  Motion hooks:      pricing cards hover-lift with elevated shadow
                     feature matrix rows fadeSlideUp stagger
                     count-up on "savings vs competitors" stat
                     pulse on "Most Popular" badge

LAYOUT:
┌─────────────────────────────────────────────────────────┐
│  PRICING CARDS (3)                                       │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐           │
│  │ FREE     │ │ PRO ★ Popular │ │ TEAM     │           │
│  │ $0       │ │ $29/mo       │ │ $79/mo   │           │
│  │ 1 bot    │ │ 10 bots      │ │ 50 bots  │           │
│  │ 1 conn   │ │ 2 conns      │ │ 5 conns  │           │
│  │ 5 schdl  │ │ 50 schdl     │ │ ∞ schdl  │           │
│  │ 1 pool   │ │ 5 pools      │ │ ∞ pools  │           │
│  │ comm     │ │ comm + tlgrm │ │ + webhook│           │
│  └──────────┘ └──────────────┘ └──────────┘           │
│                                                          │
│  FEATURE MATRIX                                         │
│  (TanStack Table — sortable, filterable)                 │
│                                                          │
│  FAQ SECTION                                            │
│  (Bootstrap accordion)                                  │
│                                                          │
│  CTA + FOOTER                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 5. AUTH PAGES (8 PAGES) — EXPANDED

> Auth flows cover: signup with role selection, signin with role routing, investor onboarding (4 steps), password reset (request + reset), email verification, 2FA, and Deriv OAuth callback. Every page now ships its own stylesheet, motion hooks, and a detailed schema/sample payload.

---

### PAGE A-1: Sign Up (`/auth/signup`)

```
PURPOSE:
  Create DerivX account WITH role selection.
  User chooses: "Trade Myself (Operator)" or "Invest in Crowdfunding"

STYLE RULES:
  Page stylesheet:   src/styles/pages/auth-signup.css
  Root class:        .page-auth-signup
  Motion hooks:      form fields fadeSlideUp stagger (4 fields, 80ms each)
                     role cards flip-on-select with elevation lift
                     success checkmark icon-draw (SVG stroke)
                     password strength meter live-fill animation
  Responsive:         2-col split on lg, single-col stacked on md
                     role cards 2-col on sm, 1-col on xs
                     floating-label form-control on sm

LAYOUT:
┌─────────────────────────────────────────────────────────┐
│  LEFT PANEL (branding)       │ RIGHT PANEL (form)       │
│                               │                          │
│  DerivX Logo                  │  "Create your account"   │
│  Illustration                 │                          │
│                               │  ┌────────────────────┐  │
│                               │  │ Full Name          │  │
│                               │  ├────────────────────┤  │
│                               │  │ Email              │  │
│                               │  ├────────────────────┤  │
│                               │  │ Password           │  │
│                               │  ├────────────────────┤  │
│                               │  │ Confirm Password   │  │
│                               │  └────────────────────┘  │
│                               │                          │
│                               │  ── Choose Your Path ──  │
│                               │                          │
│                               │  ┌──────────────────┐   │
│                               │  │  🤖 TRADE MYSELF │   │
│                               │  │  Connect to      │   │
│                               │  │  Deriv API. Run  │   │
│                               │  │  bots. Manage    │   │
│                               │  │  investors.      │   │
│                               │  │  → Operator Dash │   │
│                               │  └──────────────────┘   │
│                               │                          │
│                               │  ┌──────────────────┐   │
│                               │  │  💎 BECOME AN     │   │
│                               │  │  INVESTOR        │   │
│                               │  │  Join crowdfunding│   │
│                               │  │  pools. Earn from│   │
│                               │  │  pooled trading. │   │
│                               │  │  → Investor Dash │   │
│                               │  └──────────────────┘   │
│                               │                          │
│                               │  ☐ I agree to T&C       │
│                               │  [Create Account]        │
│                               │                          │
│                               │  Already have account?   │
│                               │  [Sign In →]             │
└───────────────────────────────┴──────────────────────────┘
```

#### Sign Up Schema (Zod)

```ts
const signupSchema = z.object({
  fullName:        z.string().min(2, "Name must be at least 2 characters")
                            .max(100, "Name too long"),
  email:           z.string().email("Invalid email"),
  password:        z.string()
                   .min(8, "Min 8 characters")
                   .regex(/[A-Z]/, "Need 1 uppercase")
                   .regex(/[0-9]/, "Need 1 number")
                   .regex(/[^a-zA-Z0-9]/, "Need 1 symbol"),
  confirmPassword: z.string(),
  role:            z.enum(["operator", "investor"]),
  termsAccepted:   z.literal(true, {
                     errorMap: () => ({ message: "You must accept T&C" })
                   }),
  referralCode:    z.string().optional().refine(
                     v => !v || /^[a-z0-9]{8,12}$/i.test(v),
                     "Invalid referral code format"
                   ),
  newsletterOptIn: z.boolean().default(true),
})
.refine(d => d.password === d.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"],
});
```

#### Sample Payload & Server Response

```
REQUEST (POST /api/auth/register):
{
  "fullName": "Jane Operator",
  "email": "jane@derivx.io",
  "password": "Sup3rSecur3!",
  "confirmPassword": "Sup3rSecur3!",
  "role": "operator",
  "termsAccepted": true,
  "referralCode": "A1B2C3D4",
  "newsletterOptIn": true
}

SERVER RESPONSE (201 Created):
{
  "userId": "user_8f2a1c",
  "email": "jane@derivx.io",
  "role": "operator",
  "emailVerified": false,
  "redirectTo": "/auth/verify-email?sent=true"
}

PASSWORD STRENGTH SCORE (live UI feedback):
  Score 0-1:  weak (red bar, ~20% width)
  Score 2:    fair (amber bar, ~40% width)
  Score 3:    good (yellow bar, ~70% width)
  Score 4:    strong (green bar, ~100% width)
  Algorithm: zxcvbn with custom wordlist (DerivX, deriv, trading, etc.)

EMAIL VERIFICATION:
  - On successful signup, send verification email with signed token
  - Token URL: /auth/verify-email?token={base64(jwt, 24h TTL)}
  - User lands on verify-email page with "Check your inbox" state
  - On click: token verified → user.emailVerified = true → redirect to signin
```

#### Role Routing (post-verification)

```
role === "operator"  → onboarding → /dashboard (operator command center)
role === "investor"  → onboarding → /investor (investor overview)

DUAL ACCESS:
  - Users CAN switch later in settings → user.role becomes "both"
  - Primary role determines default landing page (stored as user.primaryRole)
  - Role stored in users table: "operator" | "investor" | "both"

SAMPLE USER RECORD:
{
  "id": "user_8f2a1c",
  "email": "jane@derivx.io",
  "fullName": "Jane Operator",
  "username": "jane_operator",
  "role": "operator",
  "primaryRole": "operator",
  "emailVerified": true,
  "twoFactorEnabled": false,
  "timezone": "UTC",
  "createdAt": "2026-10-18T10:30:00Z",
  "lastLoginAt": null
}
```

---

### PAGE A-2: Sign In (`/auth/signin`)

```
PURPOSE:
  Sign in with awareness of user's role.
  Redirect to correct dashboard.

STYLE RULES:
  Page stylesheet:   src/styles/pages/auth-signin.css
  Root class:        .page-auth-signin
  Motion hooks:      form card fadeSlideUp (1 item, 240ms)
                     password show/hide toggle icon-spin 160ms
                     SSO buttons hover-lift with brand-color glow
                     loading spinner on submit (icon-spin)
  Responsive:         centered card max-width 460px, full-bleed on sm

LAYOUT:
┌─────────────────────────────────────────────────────────┐
│  CENTERED CARD                                          │
│                                                          │
│  DerivX Logo                                            │
│  "Welcome back"                                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Email                                            │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ Password                            [Show 👁]    │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ ☐ Remember me          Forgot password?          │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ [Sign In]                                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ── or sign in with ──                                  │
│  [G] Google   [D] Deriv OAuth                            │
│                                                          │
│  AFTER SIGN IN — ROLE ROUTER:                           │
│  If user.role === "operator"   → /dashboard              │
│  If user.role === "investor"   → /investor               │
│  If user.role === "both"       → show dashboard picker   │
└─────────────────────────────────────────────────────────┘
```

#### Sign In Schema + Sample

```ts
const signinSchema = z.object({
  email:        z.string().email(),
  password:     z.string().min(1),
  remember:     z.boolean().default(false),
  twoFactorCode: z.string().regex(/^\d{6}$/).optional(),
});
```

```
REQUEST (POST /api/auth/login):
{
  "email": "jane@derivx.io",
  "password": "Sup3rSecur3!",
  "remember": true
}

RESPONSE 200 (no 2FA):
{
  "accessToken":  "eyJhbGciOiJIUzI1NiI...",
  "refreshToken": "ref_8f2a1c9d4e7b...",
  "user": {
    "id": "user_8f2a1c",
    "email": "jane@derivx.io",
    "role": "operator",
    "primaryRole": "operator",
    "twoFactorEnabled": false
  },
  "redirectTo": "/dashboard"
}

RESPONSE 200 (2FA required → 2fa-challenge):
{
  "challengeId": "ch_8f2a1c",
  "channels":    ["authenticator"],
  "backupAvailable": true,
  "redirectTo":  "/auth/2fa?challengeId=ch_8f2a1c"
}

RESPONSE 401 (invalid credentials):
{
  "error": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect",
  "attemptsRemaining": 4,
  "lockoutAt": null
}

RATE LIMIT:
  5 failed attempts → 15min lockout (IP + email)
  10 failed attempts → 1h lockout + alert email
```

#### Role Router Logic (client-side)

```ts
// src/routes/auth/signin.tsx
const onSubmit = async (values) => {
  const res = await loginMutation.mutateAsync(values);
  if (res.redirectTo) return navigate({ to: res.redirectTo });

  // role picker for "both" users
  if (res.user.role === "both") {
    return navigate({ to: "/auth/role-picker" });
  }
  return navigate({ to: res.user.primaryRole === "operator"
                    ? "/dashboard" : "/investor" });
};
```

---

### PAGE A-3: Investor Onboarding (`/auth/onboarding/investor`)

```
PURPOSE:
  First-time investor setup. How pools work, KYC, wallet setup.

STYLE RULES:
  Page stylesheet:   src/styles/pages/auth-onboarding-investor.css
  Root class:        .page-auth-onboarding-investor
  Motion hooks:      stepper progress fill animation per step
                     step content fadeSlideUp (200ms delay per transition)
                     success icon-draw on final step
                     document upload progress bar fill
  Responsive:         stepper horizontal on md+, vertical on sm
                     upload dropzone full-width on sm

STEPPER (4 STEPS):

  STEP 1: WELCOME — explain crowdfunding pools
    - Hero video/illustration: "How DerivX pools work"
    - 3 stat highlights: avg ROI 14.2%, total disbursed $1.4M, 7,200 investors
    - "Pools vs Solo Trading" comparison card
    - [Continue →]

  STEP 2: HOW POOLS WORK — Pool → Trading → Profit Sharing → Payout
    - Animated 4-stage flow diagram (CSS-animated SVG)
    - Sample earnings calculation:
        Investment: $3,000 (1 slot) in PKG-01
        Pool ROI: +12% over 14 days
        Gross earnings: $360
        Platform cut (20%): -$72
        Net earnings: $288  (ROI 9.6%)
    - [Continue →]

  STEP 3: KYC / IDENTITY VERIFICATION — ID upload, selfie, proof of address
    - Document type selector (passport/national ID/driver license)
    - Front image uploader (dropzone + camera capture)
    - Back image uploader (if applicable)
    - Selfie with liveness check (camera + audio prompt)
    - Proof of address (utility bill/bank statement ≤3 months old)
    - Source-of-funds declaration (employment/business/investment/savings)
    - [Submit for Review]  → status pending_review
    - Estimated review time: 24-48 hours

  STEP 4: DONE — show available pools, link to investor dashboard
    - Onboarding completion checklist (4 items: profile, KYC, wallet, first deposit)
    - "Recommended for you" — 3 pools matching budget
    - [Go to Investor Dashboard →]  → /investor

SAMPLE KYC PAYLOAD (POST /api/kyc/submit):
{
  "idDocType": "passport",
  "idDocFrontUrl": "s3://derivx-kyc/user_8f2a/passport-front.jpg",
  "idDocBackUrl": null,
  "selfieUrl": "s3://derivx-kyc/user_8f2a/selfie.mp4",
  "proofOfAddressUrl": "s3://derivx-kyc/user_8f2a/utility-bill.pdf",
  "sourceOfFundsDeclaration": "employment",
  "enhancedDueDiligence": null
}

SAMPLE KYC STATUS RESPONSE:
{
  "kycId": "kyc_8f2a1c",
  "userId": "user_8f2a1c",
  "level": 1,
  "reviewStatus": "pending",
  "depositLimitPerTx": 1000,
  "depositLimitDaily": 5000,
  "depositLimitMonthly": 50000,
  "submittedAt": "2026-10-18T10:35:00Z"
}
```

---

### PAGE A-4: Forgot Password (`/auth/forgot-password`)

```
PURPOSE: Request password reset email.

STYLE RULES:
  Page stylesheet:   src/styles/pages/auth-forgot-password.css
  Root class:        .page-auth-forgot-password
  Motion hooks:      form fadeSlideUp (1 item)
                     success envelope icon-draw
                     loading icon-spin on submit
  Responsive:         centered card 460px max-width

FLOW:
  Step 1: EMAIL INPUT
    - Email field with live validation (Zod)
    - [Send Reset Link] button
    - "Back to Sign In" link

  Step 2: SUCCESS MESSAGE
    - "Check your inbox"
    - Shows email masked: j••••@derivx.io
    - "Resend in 60s" countdown timer
    - "Need help?" support link

SAMPLE REQUEST (POST /api/auth/forgot-password):
{
  "email": "jane@derivx.io"
}

SAMPLE RESPONSE 200:
{
  "message": "If the email exists, a reset link has been sent.",
  "retryAfterSeconds": 60
}

RESET TOKEN:
  - JWT signed with NEXTAUTH_SECRET
  - TTL: 1 hour
  - URL: /auth/reset-password?token={jwt}
  - Single-use (revoked on consumption)
  - IP binding optional (per user setting)
```

---

### PAGE A-5: Reset Password (`/auth/reset-password`)

```
PURPOSE: Set new password using token from email.

STYLE RULES:
  Page stylesheet:   src/styles/pages/auth-reset-password.css
  Root class:        .page-auth-reset-password
  Motion hooks:      form fields fadeSlideUp stagger
                     password strength meter live fill
                     success checkmark icon-draw
                     invalid-token error card shake 200ms
  Responsive:         centered card 460px max-width

LAYOUT:
  IF TOKEN VALID:
    - New Password field (with strength meter)
    - Confirm Password field
    - [Reset Password] → on success → redirect to signin

  IF TOKEN INVALID/EXPIRED:
    - Error card: "This reset link is invalid or has expired."
    - [Request New Link] → /auth/forgot-password

SAMPLE SCHEMA:
const resetPasswordSchema = z.object({
  token:           z.string().min(20),
  password:        z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^a-zA-Z0-9]/),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"],
});

SAMPLE REQUEST (POST /api/auth/reset-password):
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "password": "N3wSup3rS3cur3!",
  "confirmPassword": "N3wSup3rS3cur3!"
}

RESPONSE 200:
{ "message": "Password reset successful", "redirectTo": "/auth/signin" }

RESPONSE 400 (invalid token):
{ "error": "INVALID_TOKEN", "message": "Token invalid or expired" }

POST-RESET ACTIONS:
  - Revoke all existing sessions for user
  - Send security alert email
  - Force re-login
```

---

### PAGE A-6: Email Verification (`/auth/verify-email`)

```
PURPOSE: Verify user's email address after signup.

STYLE RULES:
  Page stylesheet:   src/styles/pages/auth-verify-email.css
  Root class:        .page-auth-verify-email
  Motion hooks:      envelope icon-draw (loading state)
                     success checkmark icon-draw
                     resend countdown progress ring (SVG circle stroke-dashoffset)
  Responsive:         centered card 460px max-width

STATES:
  PENDING  → "We sent a verification link to j••••@derivx.io"
             - [Resend Email] (disabled for 60s countdown)
             - [Change Email] (re-enter)
             - "Need help?" support link

  VERIFYING → "Verifying..." (icon-spin)
             - Brief loader while server checks token
             - 500ms max display

  VERIFIED → "Email verified!" (icon-draw success)
             - [Continue to Sign In →]
             - Auto-redirect after 3s

  EXPIRED  → "Verification link expired."
             - [Resend Verification Email]

  INVALID  → "Invalid verification link."
             - "Check your inbox or request a new link"

SAMPLE VERIFICATION URL:
  /auth/verify-email?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

SAMPLE SERVER RESPONSE (GET /api/auth/verify-email?token=...):
{
  "status": "verified",   // pending | verifying | verified | expired | invalid
  "userId": "user_8f2a1c",
  "email": "jane@derivx.io",
  "verifiedAt": "2026-10-18T10:42:00Z"
}

TOKEN STRUCTURE (JWT):
{
  "sub": "user_8f2a1c",
  "email": "jane@derivx.io",
  "purpose": "email_verification",
  "iat": 1729245300,
  "exp": 1729331700  // 24h TTL
}
```

---

### PAGE A-7: Two-Factor Authentication (`/auth/2fa`)

```
PURPOSE: 2FA verification step during sign-in (if enabled).

STYLE RULES:
  Page stylesheet:   src/styles/pages/auth-2fa.css
  Root class:        .page-auth-2fa
  Motion hooks:      6-digit input boxes staggered focus-in (60ms each)
                     success icon-draw on completion
                     error shake on invalid code
                     backup-code reveal toggle fade
  Responsive:         full-width input row on sm

LAYOUT:
┌─────────────────────────────────────────────────────────┐
│  TWO-FACTOR AUTHENTICATION                              │
│  "Enter the 6-digit code from your authenticator app"  │
│                                                          │
│  ┌─┐ ┌─┐ ┌─┐  ┌─┐ ┌─┐ ┌─┐                              │
│  │4│ │8│ │2│  │9│ │1│ │7│                              │
│  └─┘ └─┘ └─┘  └─┘ └─┘ └─┘                              │
│   (auto-focus next box on key; paste fills all 6)      │
│                                                          │
│  [Verify]    [Use Backup Code]   [Try Another Method]   │
│                                                          │
│  Auto-submits when all 6 digits entered                 │
│                                                          │
│  COUNTDOWN: "Code expires in 0:28"                       │
│  [Resend Code] (disabled until countdown hits 0)       │
└─────────────────────────────────────────────────────────┘

INPUT BEHAVIOR:
  - 6 separate <input maxlength=1> boxes
  - Auto-advance focus on keydown
  - Backspace jumps back to previous box
  - Paste of "482917" or "482 917" fills all 6 boxes
  - Final box auto-triggers verify

SAMPLE REQUEST (POST /api/auth/2fa/verify):
{
  "challengeId": "ch_8f2a1c",
  "code": "482917"
}

RESPONSE 200 (success):
{
  "accessToken":  "eyJ...",
  "refreshToken": "ref_...",
  "user": { ... },
  "redirectTo": "/dashboard"
}

RESPONSE 400 (invalid code):
{
  "error": "INVALID_2FA_CODE",
  "attemptsRemaining": 2,
  "lockoutAt": null
}

RESPONSE 429 (locked after 5 failures):
{
  "error": "2FA_LOCKED",
  "lockoutEndsAt": "2026-10-18T11:30:00Z"
}

BACKUP CODE FLOW:
  - 10 single-use backup codes generated at 2FA setup
  - Each code: 8-char base32 (e.g., "K7M9P2X4")
  - Hashed (bcrypt) before storage; only displayed once at setup
  - On use: invalidate + alert email + prompt regenerate
```

---

### PAGE A-8: Deriv OAuth Callback (`/auth/deriv/callback`)

```
PURPOSE:
  Handle redirect from Deriv after user authorizes.
  Exchange code for token. Link Deriv account.

STYLE RULES:
  Page stylesheet:   src/styles/pages/auth-deriv-callback.css
  Root class:        .page-auth-deriv-callback
  Motion hooks:      progress stepper with each step icon-spin during execution
                     step checkmark icon-draw on completion
                     error card shake + icon-pulse
  Responsive:         centered card 540px max-width

STATES:

  LOADING (multi-step progress):
    ┌─────────────────────────────────────────────────────┐
    │  ✓ Redirected from Deriv                            │
    │  ✓ Validating state token                          │
    │  ⟳ Exchanging code for Deriv token... (spin)        │
    │  ◯ Storing encrypted connection                    │
    │  ◯ Linking to your DerivX account                  │
    │  ◯ Redirecting to dashboard                        │
    └─────────────────────────────────────────────────────┘

  SUCCESS:
    ┌─────────────────────────────────────────────────────┐
    │  ✓ Deriv account connected!                        │
    │                                                     │
    │  Deriv Login ID:    CR123456                       │
    │  Account Type:      Real                           │
    │  Currency:          USD                            │
    │  Balance:           $1,234.56                      │
    │  Permissions:       Read, Trade, Payments, Admin   │
    │                                                     │
    │  [Continue to Dashboard →]                          │
    └─────────────────────────────────────────────────────┘

  ERROR:
    ┌─────────────────────────────────────────────────────┐
    │  ❌ Connection Failed                               │
    │                                                     │
    │  Reason: State token mismatch (CSRF protection)    │
    │                                                     │
    │  [Try Again]  [Contact Support]                    │
    └─────────────────────────────────────────────────────┘

FLOW (server-side):
  1. Extract code & state from URL params (?code=...&state=...)
  2. Validate state matches CSRF token stored in session (5min TTL)
  3. Open WebSocket to wss://ws.derivws.com/websockets/v3?app_id={APP_ID}
  4. Send: { "authorize": "{code}", "req_id": 1 }
  5. Receive: { "authorize": { "loginid": "CR123456", "token": "...",
                              "balance": 1234.56, "currency": "USD", ... } }
  6. Encrypt token with AES-256-GCM (TOKEN_ENCRYPTION_KEY)
  7. Persist to deriv_connections table (UPSERT on [userId, derivLoginId])
  8. Emit operator:deriv_connected socket event
  9. Redirect to /dashboard

SAMPLE deriv_connections RECORD (after success):
{
  "id": "dc_8f2a1c9d",
  "userId": "user_8f2a1c",
  "derivLoginId": "CR123456",
  "derivAppId": "43211",
  "encryptedToken": "aes256-gcm:7f8e2d1c...:iv:tag",
  "currency": "USD",
  "balance": 1234.56,
  "status": "active",
  "permissions": "[\"read\",\"trade\",\"payments\",\"admin\"]",
  "connectedAt": "2026-10-18T10:50:00Z",
  "lastActivityAt": "2026-10-18T10:50:00Z"
}

ERROR CODES:
  STATE_MISMATCH      → CSRF token mismatch (restart flow)
  CODE_EXPIRED        → Deriv code expired (>5min)
  ALREADY_LINKED      → Deriv account linked to another DerivX user
  PERMISSION_DENIED  → User denied authorization on Deriv screen
  NETWORK_ERROR       → WebSocket connection failed
  UNKNOWN             → Catch-all (log + support ticket)
```

---

## 6. OPERATOR DASHBOARD PAGES (15 PAGES) — 5+ SECTIONS EACH, NO PLACEHOLDERS

> Every operator dashboard page now carries: (a) page-scoped stylesheet spec at intro, (b) 5–7 fully-described sections with sample data, (c) TanStack Query keys + mutation names, (d) TanStack Table column defs where applicable. No "lorem-ipsum" or "TBD" — all numbers below are realistic samples reflecting live trading volume on a Deriv R_10/R_75/R_100 bot pool.

---

### PAGE D-1: Command Center Overview (`/dashboard`)

```
PURPOSE:
  My primary hub. What I traded last, what's scheduled next,
  how many investors are active, total funds under management,
  profits earned and distributed.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-command-center.css
  Root class:        .page-dashboard-command-center
  Motion hooks:      KPI strip count-up (6 cards, 1.2s ease-out-quart)
                     last-5-trades rows fadeSlideUp stagger (60ms)
                     upcoming schedule items icon-pulse on "next in" countdown
                     profit distribution progress bar chart-draw (600ms)
                     quick action buttons hover-lift
                     row-flash-win / row-flash-loss on live trade entries
  Responsive:         KPI strip 1/2/3 cols (sm/md/lg)
                     last-trades table → stacked cards < md
                     funds/investors panels 2-col lg, stacked sm
                     quick actions wrap row

LAYOUT:
┌─────────────────────────────────────────────────────────┐
│  SIDEBAR             │  TOP BAR                          │
│  ┌───────────────┐  │  [Deriv: 🟢 Connected] [🔔] [Me▼]│
│  │ ⚡ Command     │  ├──────────────────────────────────┤
│  │ 📅 Schedules  │  │                                   │
│  │ 🔄 Live Trades│  │  SECTION 1: OPERATOR KPI STRIP    │
│  │ 📊 Trade Log  │  │  ───────────────────────────────  │
│  │ 📦 Packages   │  │                                   │
│  │ 👥 Investors  │  │  ┌─────────┐┌─────────┐┌────────┐│
│  │ 💰 Funds     │  │  │Total    ││Active   ││Total   ││
│  │ 📤 Withdrawals│  │  │Capital  ││Investors││Profit  ││
│  │ 💬 Comms     │  │  │$156,000 ││38       ││+$18,240││
│  │ 📥 Deposits  │  │  │▲+$12k   ││▲ +3     ││+11.7%  ││
│  │ 📋 Logs      │  │  └─────────┘└─────────┘└────────┘│
│  │ 🎯 Markets   │  │                                   │
│  │ 🤖 Bots      │  │  ┌─────────┐┌─────────┐┌────────┐│
│  │ ⚙️ Settings  │  │  │Scheduled││Trades   ││Pending ││
│  └───────────────┘  │  │Today    ││Today    ││Payouts ││
│                      │  │8        ││47       ││4 ($720)││
│                      │  └─────────┘└─────────┘└────────┘│
│                      │                                   │
│                      │  SECTION 2: LAST 5 TRADES         │
│                      │  ───────────────────────────────  │
│                      │  ┌───────────────────────────────┐│
│                      │  │ #    Symbol  Type    P&L  Time ││
│                      │  │ 247  R_10   Rise5t +$35 14:23 ││
│                      │  │ 246  R_75   Even   +$28 14:21 ││
│                      │  │ 245  R_10   Rise5t -$35 14:18 ││
│                      │  │ 244  R_100  Odd    +$70 14:15 ││
│                      │  │ 243  R_10   Rise5t +$35 14:12 ││
│                      │  │ Session: +$133  |  Win: 4/5   ││
│                      │  └───────────────────────────────┘│
│                      │                                   │
│                      │  SECTION 3: UPCOMING SCHEDULED    │
│                      │  ───────────────────────────────  │
│                      │  📅 Next Scheduled Trades          │
│                      │  15:00  R_10  Martingale  $35    ││
│                      │  15:30  R_75  Even/Odd   $35    ││
│                      │  16:00  R_100 DCA        $70    ││
│                      │  Next in: 23m 14s                  │
│                      │  [View Full Schedule]              │
│                      │                                   │
│                      │  SECTION 4: FUNDS & INVESTORS     │
│                      │  ───────────────────────────────  │
│                      │  ┌──────────────┬────────────────┐│
│                      │  │ FUNDS FLOW   │ INVESTOR WATCH  ││
│                      │  │ Capital:     │ Total: 38      ││
│                      │  │ $156,000     │ Active: 32     ││
│                      │  │ In trades:   │ New today: 3   ││
│                      │  │ $142,000     │ Top: User_8f2a ││
│                      │  │ Available:   │ $15,000 (5sl)  ││
│                      │  │ $14,000      │ Pending KYC: 2 ││
│                      │  └──────────────┴────────────────┘│
│                      │                                   │
│                      │  SECTION 5: PROFIT DISTRIBUTION    │
│                      │  ───────────────────────────────  │
│                      │  Pool P&L:    +$18,240            │
│                      │  My share:    +$3,648 (20%)       │
│                      │  Distributed: $11,675             │
│                      │  Pending:     $2,917              │
│                      │  ████████████░░░░ 80% distributed │
│                      │  [Distribute Pending]              │
│                      │                                   │
│                      │  SECTION 6: QUICK ACTIONS          │
│                      │  ───────────────────────────────  │
│                      │  [⚡ Execute Trade]  [📅 Schedule]│
│                      │  [📦 New Package]   [💬 Announce]│
│                      │  [📤 Process Payouts]             │
└──────────────────────┴───────────────────────────────────┘
```

#### Components Breakdown

```
CommandCenterPage/
  ├── SECTION 1: OperatorKPIStrip
  │     ├── totalCapital, activeInvestors, totalProfit, profitPercent
  │     ├── scheduledToday, tradesToday
  │     └── pendingPayouts: { count, totalAmount }
  │
  ├── SECTION 2: Last5Trades
  │     ├── trades: TradeRecord[] (tradeNumber, symbol, contractType, profit, timestamp, packageId)
  │     └── sessionSummary: { pnl, winCount, totalCount }
  │
  ├── SECTION 3: UpcomingScheduled
  │     ├── schedules: ScheduledTrade[] (executeAt, symbol, strategy, stake, packageIds)
  │     ├── nextIn: { minutes, seconds }
  │     └── onViewFullSchedule: () → /dashboard/schedules
  │
  ├── SECTION 4: FundsAndInvestors
  │     ├── FundsFlow: totalCapital, capitalInTrades, availableCapital, todayDeposits
  │     └── InvestorWatch: totalInvestors, activeInvestors, newToday, topInvestor, pendingKYC
  │
  ├── SECTION 5: ProfitDistribution
  │     ├── poolPnL, operatorShare, distributed, pending, distributionPercent
  │     └── onDistribute: () → batch distribute pending
  │
  └── SECTION 6: QuickActions
        ├── onExecuteTrade, onSchedule, onNewPackage, onAnnounce, onProcessPayouts
```

#### TanStack Query + Mutation Hooks

```
QUERY KEYS (this page):
  ["dashboard", "kpi-summary"]               → useQuery, refetchInterval 30s
  ["dashboard", "last-trades", 5]            → useQuery, refetchInterval 15s
  ["dashboard", "upcoming-schedules"]       → useQuery, refetchInterval 30s
  ["dashboard", "funds-flow"]               → useQuery
  ["dashboard", "investor-watch"]           → useQuery, refetchInterval 60s
  ["dashboard", "profit-distribution"]      → useQuery, refetchInterval 60s

MUTATIONS:
  useDistributePending() → POST /api/packages/distribute-pending
  useExecuteQuickTrade() → POST /api/trades/buy
  useAnnounce()          → POST /api/comms/announcements

SOCKET EVENTS (live push, partial invalidation):
  operator:trade_result  → invalidate ["dashboard","last-trades",5]
                           invalidate ["dashboard","kpi-summary"]
  operator:balance_update → invalidate ["dashboard","funds-flow"]
  operator:deposit        → invalidate ["dashboard","investor-watch"]
  operator:payout_request → invalidate ["dashboard","kpi-summary"]

SAMPLE KPI PAYLOAD:
{
  "totalCapital": 156000.00,
  "capitalInTrades": 142000.00,
  "availableCapital": 14000.00,
  "activeInvestors": 38,
  "newInvestorsToday": 3,
  "pendingKYC": 2,
  "totalProfit": 18240.00,
  "profitPercent": 11.7,
  "scheduledToday": 8,
  "tradesToday": 47,
  "winsToday": 31,
  "lossesToday": 16,
  "pendingPayouts": { "count": 4, "totalAmount": 720.00 },
  "operatorShare": 3648.00,
  "distributed": 11675.00,
  "pendingDistribution": 2917.00,
  "distributionPercent": 80
}
```

---

### PAGE D-2: Trade Scheduler (`/dashboard/schedules`)

```
PURPOSE:
  Schedule trades by date, time, market, strategy, amount.
  Trades serve specific packages. Calendar + list + timeline view.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-schedules.css
  Root class:        .page-dashboard-schedules
  Motion hooks:      calendar grid fadeSlideUp stagger (60ms per cell, max 12)
                     timeline blocks fadeSlideUp + width-fill animation
                     schedule rows row-flash on creation/update
                     "next in" countdown icon-pulse
                     new-schedule form fields staggered entrance
  Responsive:         calendar grid 7-col md, 4-col sm, 1-col xs
                     timeline horizontal lg, vertical stacked md
                     schedule list table → stacked cards < md
                     new-schedule form 2-col md, 1-col sm

7 SECTIONS:

  SECTION 1: CALENDAR VIEW
    - Month grid (7×6) with day cells
    - ● markers on days with scheduled trades (count badge)
    - Click day → expand to show trades for that day in side panel
    - Navigate prev/next month, "Today" jump button
    - Sample data:
        Mon 13  ● 4 trades
        Tue 14  ● 7 trades
        Wed 15  ● 8 trades  (today, highlighted)
        Thu 16  ● 5 trades
        Fri 17  ● 6 trades
        Sat 18  (weekend — synthetics only)
        Sun 19  (no trades)

  SECTION 2: TODAY'S SCHEDULE TIMELINE
    - Horizontal timeline (06:00 → 22:00) with trade blocks
    - Each block: time, strategy, symbol, stake, trade count
    - Current time indicator (vertical red line, icon-pulse)
    - Click block → expand details modal
    - Sample blocks:
        09:00–10:00  R_10  Martingale     $35   8 trades  ✓ done
        11:00–12:00  R_75  Even/Odd       $35   8 trades  ✓ done
        13:30–14:30  R_10  Rise/Fall      $35   6 trades  ⟳ running (4/6)
        15:00–16:00  R_100 DCA            $70   8 trades  ◯ upcoming
        17:00–18:00  R_10  Oscar's Grind  $35   8 trades  ◯ upcoming

  SECTION 3: SCHEDULED TRADE LIST (TanStack Table)
    - Columns: Time, Symbol, Strategy, Package, Stake, Count, Status, Actions
    - Sortable by time/symbol/stake/count
    - Filter by date, package, status, strategy
    - Row actions: [Edit] [Skip] [Run Now] [Duplicate]
    - Bulk actions: [Skip Selected] [Run Selected Now]
    - Pagination: 25/page, server-side
    - Sample row:
        15:00  R_10  Martingale   PKG-01  $35  8 trades  active  [⋯]
        15:30  R_75  Even/Odd     PKG-02  $35  8 trades  active  [⋯]
        16:00  R_100 DCA         PKG-03  $70  8 trades  active  [⋯]

  SECTION 4: NEW SCHEDULE FORM (Modal or inline)
    - Schedule Name (auto-suggested: "Martingale-R10-Evening")
    - Date picker (single date or range)
    - Start/End Time pickers
    - Symbol selector (searchable with live tick preview)
    - Strategy selector (Martingale, Oscar's Grind, DCA, Fixed, Anti-Martingale, Fibonacci, Custom Script)
    - Initial Stake input with quick buttons ($0.35, $1, $5, $35)
    - Max Trades (1-500)
    - Assign to Packages (checkboxes with % allocation per package)
        ☑ PKG-01  40%  $14,000
        ☑ PKG-02  35%  $12,250
        ☐ PKG-03  25%  $8,750
    - Recurrence: One-time | Daily | Weekdays | Custom cron
        Cron examples: "0 9 * * 1-5"  (9am weekdays)
                      "*/30 9-17 * * 1-5" (every 30min during 9-17 weekdays)
    - Risk Limits:
        Stop Loss: $500 (auto-halt day)
        Take Profit: $1000 (auto-stop day)
        Max Drawdown: 5%
        Cooldown after losses: 3 (cooldown 5min)
    - [Save Schedule]  [Save & Run Now]

  SECTION 5: PACKAGE-TRADE MAPPING
    - Table: Package, Schedules Count, Capital, % Share, Avg Stake
    - Auto-calculated from investor deposits per package
    - Sample:
        PKG-01  4 schedules  $14,000  40%  $35
        PKG-02  3 schedules  $12,250  35%  $35
        PKG-03  2 schedules  $8,750   25%  $70
    - [Rebalance Allocations] button → opens modal to manually adjust splits

  SECTION 6: SCHEDULE PERFORMANCE HISTORY
    - Past 30 days of completed schedules
    - Table: Schedule Name, Last Run, Trades, Win Rate, P&L, ROI
    - Sample row:
        Martingale-R10-Morning  2026-10-15 09:00  8 trades  75%  +$70  +12.5%
        Even-Odd-R75-Noon       2026-10-15 12:00  8 trades  62%  +$28  +5%
    - Sortable; clickable → drill-down to trade log filtered by that schedule

  SECTION 7: SCHEDULE CONFLICTS & WARNINGS
    - Pre-flight check before save
    - Warn on: time overlap with another schedule for same package,
              insufficient capital for package assignment,
              weekend schedule on forex symbols,
              low balance (< 5× max trade stake),
              AI Guardian cooldown active for assigned package
    - Sample warning banner:
        ⚠ Conflict: PKG-01 already has a schedule 13:00–14:00 (Martingale-R10-Afternoon)
        Stacks trades within same window. Continue anyway? [Yes] [Adjust Time]

SAMPLE SCHEDULE PAYLOAD (POST /api/schedules):
{
  "name": "Martingale-R10-Evening",
  "date": "2026-10-18",
  "startTime": "15:00",
  "endTime": "16:00",
  "symbol": "R_10",
  "strategy": "martingale",
  "initialStake": 35.00,
  "maxTrades": 8,
  "packageIds": ["pkg_01", "pkg_02", "pkg_03"],
  "packageAllocation": { "pkg_01": 40, "pkg_02": 35, "pkg_03": 25 },
  "recurrence": "weekdays",
  "cronExpression": null,
  "stopLoss": 500.00,
  "takeProfit": 1000.00,
  "maxDrawdown": 5.0,
  "cooldownLosses": 3,
  "cooldownDuration": 300,
  "status": "active"
}

SAMPLE RESPONSE (201 Created):
{
  "scheduleId": "sch_8f2a1c9d",
  "name": "Martingale-R10-Evening",
  "nextRunAt": "2026-10-18T15:00:00Z",
  "status": "active"
}
```

---

### PAGE D-3: Live Trading (`/dashboard/live`)

```
PURPOSE:
  Active trades running NOW. Real-time feed, no charts.
  Numbers streaming, adding to profits/losses live.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-live-trading.css
  Root class:        .page-dashboard-live-trading
  Motion hooks:      running totals count-up on every update (600ms ease-out-quart)
                     live trade feed entries slide-in-from-top + row-flash
                     tick prices shimmer effect on change
                     bot status icons icon-pulse when running, icon-spin when syncing
                     per-package P&L progress bars chart-draw
  Responsive:         running totals 1/2/3/6 cols (sm/md/lg/xl)
                     live feed full-width with virtualized list (50 items)
                     tick prices grid 2-col sm, 4-col md, 6-col xl
                     bots grid 1-col sm, 2-col md, 3-col lg
                     per-package P&L 1-col sm, 2-col lg

7 SECTIONS:

  SECTION 1: RUNNING TOTALS
    - 6 KPI cards, all count-up on update:
      Capital in Market:    $142,000  (icon-pulse dot)
      Session P&L:          +$3,247   (green row-flash)
      Trades Executed:      47
      Win / Loss:           31 / 16   (62% win rate)
      Current Streak:       3 wins    (icon-pulse)
      AI Guardian Status:   🟢 All Clear

  SECTION 2: LIVE TRADE FEED (newest first, streaming, virtualized)
    - Each entry: result icon (✅/❌), symbol, contract type, stake, payout, P&L
    - Entry/exit spot, timestamp, package assignment
    - New entries: slide-in-from-top + row-flash-win/row-flash-loss (800ms)
    - Max 50 items visible; older scroll off bottom
    - Sample entries (newest at top):
        ✅ WIN   R_10   Rise 5t   $35 → $63   +$28   14:23:47  PKG-01
        ✅ WIN   R_75   Even      $35 → $63   +$28   14:23:31  PKG-02
        ❌ LOSS  R_10   Rise 5t   $35 → $0   -$35   14:23:15  PKG-01
        ✅ WIN   R_100  Odd       $70 → $126  +$56   14:22:58  PKG-03
        ✅ WIN   R_10   Rise 5t   $35 → $63   +$28   14:22:42  PKG-01

  SECTION 3: LIVE TICK PRICES
    - All subscribed symbols in a grid
    - Each tile: symbol, current price, direction arrow (▲/▼), % change, tick timing
    - Shimmer effect on price change
    - Sample tiles:
        R_10    4532.11  ▲ +0.04%  1 tick/s
        R_25    3217.55  ▼ -0.02%  1 tick/s
        R_50    1898.42  ▲ +0.07%  1 tick/s
        R_75    2451.18  ▼ -0.03%  1 tick/s
        R_100   5621.83  ▲ +0.11%  1 tick/s
        1HZ10V  1240.92  ▲ +0.01%  2 ticks/s

  SECTION 4: ACTIVE BOTS
    - Per bot card: status, symbol, strategy, trade count, win rate, P&L
    - Status indicators: 🟢 running  🟡 paused  🔴 stopped
    - Action buttons: [Pause] [Stop] [Config] per bot
    - Bulk actions: [Pause All] [Stop All] [Restart All]
    - Sample bots:
        Bot-Alpha      🟢 running  R_10   Martingale    12 trades  75% +$84
        Bot-Bravo      🟢 running  R_75   Even/Odd     8 trades  62% +$28
        Bot-Charlie    🟡 paused   R_100  DCA           6 trades  50% +$0   (cooldown)
        Bot-Delta      🔴 stopped  R_10   Oscar's Grind 0 trades  --  $0

  SECTION 5: PER-PACKAGE LIVE P&L
    - Each package: capital, current P&L, ROI, # trades
    - P&L split proportional to each package's capital share
    - Progress bar shows performance vs take-profit target
    - Sample:
        PKG-01  $14,000  +$1,298   +9.3%   23 trades  ███████░░░░░  70% to TP
        PKG-02  $12,250  +$1,138   +9.3%   15 trades  ██████░░░░░░  65% to TP
        PKG-03  $8,750   +$811     +9.3%    9 trades  █████████░░░  85% to TP

  SECTION 6: SESSION STATISTICS (rolling 24h)
    - Total trades: 47  |  Wins: 31 (62%)  |  Losses: 16 (38%)
    - Net P&L: +$3,247
    - Best trade: +$70 (R_100 Odd)
    - Worst trade: -$35 (R_10 Rise 5t)
    - Longest streak: 5 wins
    - Avg trade duration: 18s
    - Session started: 14:00:00  (47 min runtime)

  SECTION 7: AI GUARDIAN LIVE LOG
    - Recent triggers (last 24h)
    - Each entry: timestamp, package, trigger type, action taken, resumed at
    - Sample entries:
        13:42  PKG-02  8 consecutive losses  → bots paused 5min  → resumed 13:47
        12:15  PKG-03  5% drawdown hit      → bots paused 10min → resumed 12:25
        11:08  PKG-01  random rotation      → symbol switched R_10→R_25
    - "View Full History" → /dashboard/logs?type=ai_guardian

SOCKET EVENTS (pushed, partial updates):
  operator:trade_result   → push to live feed + update running totals + per-package P&L
  operator:tick_update    → update tick prices tile
  operator:bot_status     → update bot card status icon
  operator:ai_guardian    → push to AI Guardian log + highlight affected package

SAMPLE LIVE TRADE PAYLOAD (via socket):
{
  "type": "operator:trade_result",
  "trade": {
    "tradeId": "trd_8f2a1c9d",
    "packageId": "pkg_01",
    "symbol": "R_10",
    "contractType": "CALL",
    "stake": 35.00,
    "payout": 63.00,
    "profit": 28.00,
    "isWin": true,
    "entrySpot": 4531.92,
    "exitSpot": 4532.18,
    "boughtAt": "2026-10-18T14:23:42Z",
    "soldAt":   "2026-10-18T14:23:47Z",
    "botName": "Bot-Alpha",
    "scheduleId": "sch_8f2a1c9d"
  }
}
```

---

### PAGE D-4: Trade Log & Records (`/dashboard/trades`)

```
PURPOSE:
  Complete history of all trades I've executed.
  Filterable by date, package, market, result. Exportable.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-trade-log.css
  Root class:        .page-dashboard-trade-log
  Motion hooks:      summary cards count-up on filter change
                     table rows fadeSlideUp stagger (max 12, 30ms each)
                     expanded row content slide-down 240ms
                     export buttons hover-lift
                     filter chips fadeSlideUp on apply
  Responsive:         summary cards 1/2/4 cols (sm/md/lg)
                     trade table → stacked cards < md (with data-label)
                     per-package breakdown table → stacked cards < md

7 SECTIONS:

  SECTION 1: SUMMARY CARDS
    - Total Trades, Wins, Losses, Net P&L, Win Rate, Avg Win, Avg Loss, Best Trade
    - Filterable by selected date range, package, market
    - Sample values (last 30 days):
        Total Trades: 1,247
        Wins:          789  (63.3%)
        Losses:        458  (36.7%)
        Net P&L:       +$8,234
        Avg Win:       +$32
        Avg Loss:      -$35
        Best Trade:    +$280 (R_100 Accumulator)

  SECTION 2: TRADE TABLE (TanStack Table)
    - Columns: #, Date, Symbol, Type, Stake, Payout, P&L, Package, Bot, Status
    - Server-side pagination (50/page)
    - Sortable by date/stake/pnl
    - Filterable: date range, symbol, package, contract type, result
    - Column resizing, column visibility toggle
    - Row click expands to show full execution details
    - Export: [CSV] [PDF] [Excel]
    - Sample row:
        247  2026-10-18 14:23  R_10  Rise 5t  $35  $63  +$28  PKG-01  Bot-Alpha  ✓win

  SECTION 3: DAILY AGGREGATION
    - Table: Date, Trades, Wins, Losses, Win %, P&L, Running Capital
    - Sortable, paginated
    - Sample rows (last 7 days):
        2026-10-18  47   31  16  66%  +$133   $142,000
        2026-10-17  52   34  18  65%  +$308   $141,867
        2026-10-16  48   30  18  63%  +$245   $141,559
        2026-10-15  55   37  18  67%  +$371   $141,314

  SECTION 4: PER-PACKAGE BREAKDOWN
    - Table: Package, Trades, Wins, Win %, Net P&L, ROI, Avg Stake
    - Sample rows:
        PKG-01  423 trades  268 wins  63%  +$2,892  +20.7%  $35
        PKG-02  378 trades  239 wins  63%  +$2,408  +19.7%  $35
        PKG-03  446 trades  282 wins  63%  +$2,934  +33.5%  $70

  SECTION 5: PER-MARKET BREAKDOWN
    - Table: Symbol, Trades, Wins, Win %, Net P&L, Avg Duration
    - Sample rows:
        R_10    612 trades  391 wins  64%  +$4,020  5 ticks
        R_75    248 trades  156 wins  63%  +$1,512  1m
        R_100   187 trades  118 wins  63%  +$2,094  1m
        R_25    100 trades   63 wins  63%  +$608    1m
        R_50    100 trades   61 wins  61%  -$280   1m

  SECTION 6: PER-STRATEGY BREAKDOWN
    - Table: Strategy, Trades, Wins, Win %, Net P&L, Avg Stake
    - Sample rows:
        Martingale      540 trades  63%  +$4,860  $35
        Even/Odd        248 trades  63%  +$1,512  $35
        DCA             187 trades  63%  +$2,094  $70
        Oscar's Grind   150 trades  65%  +$1,200  $35
        Fibonacci       122 trades  61%  -$1,432  $35

  SECTION 7: TRADE EXECUTION DETAILS (expanded row content)
    - Shown when a trade row is expanded
    - Fields: Trade #, Symbol, Contract Type, Duration, Entry/Exit Spot,
              Buy Price, Sell Price, Profit, Bot Name, Schedule Name,
              Package Assignment, Deriv Contract ID, Executed At, Status
    - Sample expansion:
        Trade #247
          Symbol:           R_10 (Volatility 10 Index)
          Contract:         CALL (Rise) — 5 ticks
          Entry Spot:       4531.92
          Exit Spot:        4532.18
          Buy Price:        $35.00
          Sell Price:       $63.00
          Profit:           +$28.00
          Bot:              Bot-Alpha (id: bot_8f2a)
          Schedule:         Martingale-R10-Evening (id: sch_8f2a)
          Package:          PKG-01 ($14,000 / 40% share)
          Deriv Contract ID: 1234567890
          Executed At:      2026-10-18 14:23:47 UTC
          Status:           ✓ Won

TANSTACK TABLE COLUMN DEFS:
  columns = [
    { id: "tradeNumber", header: "#",           cell: row => row.original.tradeNumber },
    { id: "executedAt",  header: "Date",        cell: row => formatDate(row.original.executedAt),
      sortingFn: "datetime" },
    { id: "symbol",      header: "Symbol" },
    { id: "contractType",header: "Type" },
    { id: "stake",       header: "Stake",       cell: row => formatMoney(row.original.stake) },
    { id: "payout",      header: "Payout",      cell: row => formatMoney(row.original.payout) },
    { id: "profit",      header: "P&L",         cell: row => <PnLBadge value={row.original.profit} /> },
    { id: "packageCode", header: "Package" },
    { id: "botName",     header: "Bot" },
    { id: "isWin",       header: "Result",      cell: row => row.original.isWin ? "✓" : "✗" },
    { id: "actions",     header: "",            cell: ExpandRowToggle },
  ];

QUERY KEYS:
  ["trades", { page, pageSize, sort, filters }]    → useInfiniteQuery or useQuery
  ["trades", "summary", { filters }]               → useQuery
  ["trades", "daily-aggregation", { filters }]     → useQuery
  ["trades", "per-package",    { filters }]        → useQuery
  ["trades", "per-market",     { filters }]        → useQuery
  ["trades", "per-strategy",   { filters }]        → useQuery
```

---

### PAGE D-5: Package Manager (`/dashboard/packages`)

```
PURPOSE:
  Define and manage crowdfunding packages. Each package has
  different investment tiers, durations, expected returns,
  deadlines, and terms. This is where I set what investors buy.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-packages.css
  Root class:        .page-dashboard-packages
  Motion hooks:      active package cards fadeSlideUp stagger (60ms)
                     fill progress bar chart-draw (1.2s)
                     countdown timer icon-pulse on "ending soon"
                     new package form multi-step stepper progress fill
                     completed package cards dimmed + checkmark icon-draw
                     comparison table rows hover-lift
  Responsive:         active cards 1/2/3 cols (sm/lg)
                     comparison table → stacked cards < md
                     new package form 2-col md, 1-col sm

6 SECTIONS:

  SECTION 1: ACTIVE PACKAGES
    - Card per package showing:
      Name, Code, Status badge (SCHEDULED/OPEN/CLOSED/TRADING/PROFIT_SHARING)
      Min Investment, Max Slots/User, Duration, Expected ROI
      Target Capital, Filled % (progress bar with chart-draw animation)
      Investor count
      Trading period with countdown timer
      Current P&L (live, count-up)
      AI Guardian status icon
      Action buttons: [View Details] [Edit] [View Investors] [Pause Trading]
    - Sample packages:
        PKG-01 "Basic Growth"     TRADING  $3,000 / 20 slots / 14d / 15% ROI
          Target: $50,000  Filled: 70% ($35,000)  12 investors
          Trading ends: 6d 4h 32m  P&L: +$4,200 (+12.0%)
          AI Guardian: 🟢 Active
        PKG-02 "Premium Yield"    OPEN     $5,000 / 10 slots / 21d / 18% ROI
          Target: $80,000  Filled: 35% ($28,000)  6 investors
          Booking closes: 2d 14h 18m
        PKG-03 "Aggressive Max"   TRADING  $10,000 / 5 slots / 30d / 25% ROI
          Target: $100,000 Filled: 90% ($90,000)  9 investors
          Trading ends: 12d 8h 14m  P&L: +$13,500 (+15.0%)
        PKG-04 "Quick Flip"      SCHEDULED $2,000 / 25 slots / 7d / 10% ROI
          Target: $40,000  Filled: 0%  0 investors
          Booking opens: 2026-10-25 09:00

  SECTION 2: COMPLETED PACKAGES
    - List of past packages with final ROI, profit, distribution status
    - Sample:
        PKG-00 "Genesis"    Completed  $50,000 target → $58,200 raised
          Final ROI: +16.4%  Duration: 14d  Investors: 18
          Profit: +$9,545  Operator: $1,909  Investors: $7,636
          Distribution: ✓ Completed 2026-10-10

  SECTION 3: NEW PACKAGE FORM (advanced, multi-step)
    - Step 1: BASICS
        Package Name (max 80 chars), Code (auto-generated: PKG-05),
        Description (rich text, max 2000 chars),
        Token Name (default: bmX)
    - Step 2: INVESTMENT TERMS
        Min per Slot:     $3,000  (slider $100–$50,000)
        Max Slots/User:   20     (slider 1–100)
        Target Capital:   $50,000
        Max Capital:      $75,000  (oversubscribe limit; nullable)
        Tokens per Slot:  30,000  (auto-calc based on target)
    - Step 3: TIMELINE
        Booking Opens:   2026-10-25 09:00
        Booking Closes:  2026-10-28 23:59
        Trading Starts:  2026-10-29 09:00
        Trading Ends:    2026-11-12 17:00
        Profit Share Date: 2026-11-13 12:00
    - Step 4: EXPECTED RETURNS
        Conservative ROI: 8%   (baseline guarantee minimum)
        Expected ROI:      15%  (planning target)
        Optimistic ROI:    25%  (best-case)
    - Step 5: PROFIT SPLIT
        Operator Share: 20%  (default, slider 0–40)
        Investor Share: 80%  (auto-calc, 100 - operator)
    - Step 6: TRADING CONFIG
        Markets (checkboxes): ☑ R_10  ☑ R_75  ☐ R_100  ☐ R_25  ☐ R_50
        Strategies (checkboxes): ☑ Martingale  ☑ Even/Odd  ☐ DCA  ☐ Oscar's Grind
        AI Guardian Enabled: ☑ (max consec losses: 8, max drawdown: 5%)
        Max Drawdown: 5% (slider 1–15)
    - Step 7: TERMS & CONDITIONS
        Upload Terms PDF (max 10MB, must be URL)
        Auto-reinvest option: ☐
        Early exit penalty: 10% (slider 0–50)
    - [Save Draft]  [Publish Package]
    - On publish → status: SCHEDULED → on Booking Opens → status: OPEN

  SECTION 4: PACKAGE COMPARISON TABLE
    - Side-by-side comparison of all packages (active + completed)
    - Columns: Code, Name, Min Slot, Duration, Exp ROI, Markets, Capital, Investors, Status
    - Sortable; click row to open detail
    - Sample:
        PKG-01 Basic Growth    $3,000  14d  15%  R_10,R_75       $50k   12   TRADING
        PKG-02 Premium Yield   $5,000  21d  18%  R_10,R_100      $80k   6    OPEN
        PKG-03 Aggressive Max  $10,000 30d  25%  R_10,R_75,R_100  $100k  9    TRADING
        PKG-04 Quick Flip      $2,000  7d   10%  R_10            $40k   0    SCHEDULED

  SECTION 5: PACKAGE PERFORMANCE HISTORY
    - Historical results for similar package configs
    - Average/Best/Worst ROI across past packages
    - Filterable by min slot range, duration, markets
    - Sample:
        Config (similar to PKG-01): Basic Growth $3,000 14d
        Past packages: 8
        Average ROI:   14.2%
        Best ROI:      21.8% (PKG-GenesisPlus)
        Worst ROI:     8.5%  (PKG-Starter2)
        Median ROI:    13.7%

  SECTION 6: PACKAGE INVESTORS QUICK VIEW
    - For each selected package, show top 5 investors
    - Sample (PKG-01):
        User_8f2a   5 slots  $15,000  30% share
        User_b3c1   3 slots  $9,000   18% share
        User_d4e2   2 slots  $6,000   12% share
        User_f5g3   2 slots  $6,000   12% share
        User_h6i4   1 slot   $3,000   6%  share
        + 7 more investors → [View All Investors]

SAMPLE PACKAGE PAYLOAD (POST /api/packages):
{
  "code": "PKG-05",
  "name": "Basic Growth v2",
  "description": "14-day growth package targeting R_10 and R_75 even/odd strategies.",
  "status": "draft",
  "slotPrice": 3000,
  "maxSlotsPerUser": 20,
  "targetCapital": 50000,
  "maxCapital": 75000,
  "bookingOpensAt":  "2026-10-25T09:00:00Z",
  "bookingClosesAt": "2026-10-28T23:59:00Z",
  "tradingStartsAt": "2026-10-29T09:00:00Z",
  "tradingEndsAt":   "2026-11-12T17:00:00Z",
  "profitShareDate": "2026-11-13T12:00:00Z",
  "conservativeROI": 8.0,
  "expectedROI":     15.0,
  "optimisticROI":   25.0,
  "operatorSharePercent": 20,
  "investorSharePercent": 80,
  "markets":  ["R_10", "R_75"],
  "strategies": ["martingale", "even_odd"],
  "aiGuardianEnabled": true,
  "aiGuardianConfig": "{\"maxConsecLosses\":8,\"maxDrawdown\":5}",
  "maxDrawdown": 5.0,
  "tokensPerSlot": 30000,
  "tokenName": "bmX",
  "termsUrl": "s3://derivx-terms/PKG-05-terms.pdf",
  "autoReinvestOption": false,
  "earlyExitPenalty": 10.0
}

SAMPLE RESPONSE (201 Created):
{
  "packageId": "pkg_5g6h7i",
  "code": "PKG-05",
  "status": "draft",
  "createdAt": "2026-10-18T11:00:00Z"
}

TANSTACK QUERY KEYS:
  ["packages", { status: "active" }]    → useQuery, refetchInterval 30s
  ["packages", { status: "completed" }] → useQuery
  ["packages", "comparison"]            → useQuery
  ["packages", "performance-history"]  → useQuery
  ["packages", id, "investors"]         → useQuery
  ["packages", id, "performance"]       → useQuery

MUTATIONS:
  useCreatePackage()  → POST /api/packages
  useUpdatePackage()  → PATCH /api/packages/:id
  usePublishPackage() → POST /api/packages/:id/publish
  usePausePackage()   → POST /api/packages/:id/pause
  useDistributeProfits() → POST /api/packages/:id/distribute
```

---

### PAGE D-6: Investors Management (`/dashboard/investors`)

```
PURPOSE:
  All investors who joined packages. Their investments,
  packages, KYC status, earnings, communications.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-investors.css
  Root class:        .page-dashboard-investors
  Motion hooks:      summary cards count-up
                     investor table rows fadeSlideUp stagger
                     side panel slide-in-from-right 240ms
                     KYC doc viewer image load fade
                     approve/reject action button hover-lift + pulse
  Responsive:         summary cards 1/2/4 cols (sm/md/lg)
                     investor table → stacked cards < md
                     detail panel slide-in drawer on lg, full-screen modal sm
                     KYC doc grid 2-col sm, 4-col md

7 SECTIONS:

  SECTION 1: INVESTOR SUMMARY
    - 7 KPI cards (count-up):
      Total Investors:        38
      Active:                 32
      Total Invested:         $156,000
      Pending KYC:            2
      New Today:              3
      Avg Investment:         $4,105
      Top Investor:           User_8f2a  ($15,000)

  SECTION 2: INVESTOR TABLE (TanStack Table)
    - Columns: ID, Name, Email, Joined, Packages, Invested, P&L, ROI, KYC, Status, Actions
    - Sortable, filterable, paginated (25/page)
    - Actions per row: [View Profile] [Message] [View Trades] [Process Payout] [Suspend]
    - Row click opens side panel with full investor detail
    - Sample rows:
        user_8f2a  Jane Investor  jane@inv.io   2026-09-12  PKG-01,PKG-03  $25,000  +$3,672  +14.7%  L2  active
        user_b3c1  Mark Pooler    mark@inv.io   2026-09-18  PKG-01          $9,000   +$1,206  +13.4%  L2  active
        user_d4e2  Sara Trader    sara@inv.io   2026-10-01  PKG-02          $10,000  +$1,428  +14.3%  L1  active
        user_f5g3  Tom Newbie     tom@inv.io    2026-10-15  PKG-02          $5,000   +$210    +4.2%   L0  pending_kyc

  SECTION 3: INVESTOR DETAIL (side panel / modal)
    - Header: Name, Email, Phone, Joined date, KYC level badge, Status
    - Tabs: Overview | Investments | Trades | Wallet | Comms | Activity
    - Overview tab: total invested, total earnings, wallet balance, packages count
    - Investments tab: per-package table with slots, investment, share %, P&L, ROI
    - Trades tab: paginated list of this investor's trades (from PackageTrade join)
    - Wallet tab: balance, locked, recent transactions
    - Comms tab: messages sent to/from this investor
    - Activity tab: audit log filtered to this investor
    - Action buttons: [Message] [View Full Trades] [Force Payout] [Adjust Balance] [Suspend]

  SECTION 4: INVESTORS BY PACKAGE
    - Per active package: investor count, fill progress bar, top 3 investors
    - Sample:
        PKG-01  12 investors  ███████░░░  70% filled  Top: user_8f2a  $15,000
        PKG-02  6 investors   ████░░░░░░  35% filled  Top: user_d4e2  $10,000
        PKG-03  9 investors   █████████░  90% filled  Top: user_8f2a  $10,000

  SECTION 5: KYC VERIFICATION QUEUE
    - Pending verifications with document viewer
    - View ID front/back, selfie (with liveness check playback), proof of address
    - Approve / Reject (with reason dropdown)
    - Bulk approve/reject with checkboxes
    - Sample queue:
        user_f5g3  Tom Newbie    passport    submitted 2026-10-15 14:20  [Approve] [Reject]
        user_h6i4  Lee Newinvest national_id  submitted 2026-10-16 09:15  [Approve] [Reject]
    - Approve action → POST /api/investors/:id/kyc-approve
        { reviewerNotes: "Documents verified", level: 2 }
    - Reject action → POST /api/investors/:id/kyc-reject
        { reason: "Selfie unclear", reviewerNotes: "Please retake selfie" }

  SECTION 6: INVESTOR COMMUNICATION HISTORY
    - Recent messages with this investor (last 10)
    - Sent vs received; read receipts
    - [Open Full Thread] → /dashboard/comms?investor=:id

  SECTION 7: INVESTOR ENGAGEMENT METRICS
    - Per investor: last login, last action, sessions count, avg session duration
    - "At-risk" investors (no login in 14+ days) flag for outreach
    - Sample:
        user_8f2a   last login 2h ago      18 sessions  avg 4m  🟢 active
        user_b3c1   last login 1d ago      12 sessions  avg 3m  🟢 active
        user_k7l8   last login 18d ago     3 sessions   avg 1m  🟡 at-risk → [Send nudge]

TANSTACK QUERY KEYS:
  ["investors", { page, pageSize, sort, filters }]  → useQuery
  ["investors", "summary"]                           → useQuery
  ["investors", "by-package"]                         → useQuery
  ["investors", "kyc-queue"]                          → useQuery, refetchInterval 30s
  ["investors", id, "detail"]                        → useQuery (enabled when panel open)
  ["investors", id, "investments"]                   → useQuery
  ["investors", id, "trades", { page }]              → useQuery
  ["investors", id, "wallet"]                         → useQuery
  ["investors", id, "comms"]                          → useQuery
  ["investors", id, "activity"]                       → useQuery
  ["investors", id, "engagement"]                    → useQuery

MUTATIONS:
  useApproveKYC()      → POST /api/investors/:id/kyc-approve
  useRejectKYC()       → POST /api/investors/:id/kyc-reject
  useSuspendInvestor() → POST /api/investors/:id/suspend
  useForcePayout()      → POST /api/investors/:id/force-payout
  useAdjustBalance()   → POST /api/investors/:id/adjust-balance

SAMPLE KYC QUEUE ITEM:
{
  "userId": "user_f5g3",
  "fullName": "Tom Newbie",
  "email": "tom@inv.io",
  "kyc": {
    "level": 1,
    "reviewStatus": "pending",
    "idDocType": "passport",
    "idDocFrontUrl": "s3://derivx-kyc/user_f5g3/passport-front.jpg",
    "idDocBackUrl": null,
    "selfieUrl": "s3://derivx-kyc/user_f5g3/selfie.mp4",
    "proofOfAddressUrl": "s3://derivx-kyc/user_f5g3/utility-bill.pdf",
    "sourceOfFundsDeclaration": "employment",
    "submittedAt": "2026-10-15T14:20:00Z"
  }
}
```

---

### PAGE D-7: Analytics (`/dashboard/analytics`)

```
PURPOSE:
  Performance analytics factoring in investors, packages,
  different trade periods per package, and profit allocation.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-analytics.css
  Root class:        .page-dashboard-analytics
  Motion hooks:      overview metric cards count-up
                     per-package analytics cards fadeSlideUp stagger
                     investor ranking table rows fadeSlideUp
                     market/strategy breakdown bar charts chart-draw (600ms)
                     revenue distribution donut chart draw-in
                     date-range picker fade in/out
  Responsive:         overview cards 1/2/3/6 cols (sm/md/lg/xl)
                     per-package cards 1/2/3 cols (sm/lg)
                     tables → stacked cards < md
                     charts full-width on sm

7 SECTIONS:

  SECTION 1: OVERVIEW METRICS
    - 6 KPI cards:
      Total P&L:           +$8,234
      Overall ROI:          +5.3%  (on $156,000 capital)
      Profit Factor:        1.41   (gross profit / gross loss)
      Sharpe Ratio:         1.82   (risk-adjusted return)
      Max Drawdown:         3.2%   (peak-to-trough)
      Avg Trade Duration:  18s

  SECTION 2: PER-PACKAGE ANALYTICS
    - Each package card showing:
      Period with countdown, Capital, P&L, Trades, Win Rate
      Markets and strategies used (chips)
      Time elapsed progress bar
      Investor impact: count, avg investment, per-investor avg P&L
      Distributed so far
    - Sample (PKG-01):
        PKG-01 "Basic Growth"  TRADING (8d 4h remaining of 14d)
        Capital: $14,000  |  P&L: +$1,680  (+12.0%)
        Trades: 423  |  Win Rate: 63%
        Markets: R_10, R_75  |  Strategies: Martingale, Even/Odd
        Time elapsed: 57%  ████████████░░░░░░░░░
        Investors: 12  |  Avg investment: $1,167  |  Per-investor P&L: +$140
        Distributed so far: $0  (distributed at profit-sharing date)

  SECTION 3: INVESTOR PERFORMANCE RANKING
    - TanStack Table: Rank, Investor, Invested, Earned, ROI, Packages, Last Active
    - Sortable by invested/earned/ROI
    - Sample rows:
        1  user_8f2a  $25,000  +$3,672  +14.7%  2 packages  2h ago
        2  user_m8n9  $15,000  +$2,100  +14.0%  3 packages  5h ago
        3  user_b3c1  $9,000   +$1,206  +13.4%  1 package   1d ago
        4  user_d4e2  $10,000  +$1,428  +14.3%  1 package   3h ago

  SECTION 4: MARKET & STRATEGY BREAKDOWN
    - By Market: bar chart + table
      Symbol | Trades | Wins | Win % | Net P&L | Avg Duration
      R_10   | 612   | 391 | 64%  | +$4,020 | 5 ticks
      R_75   | 248   | 156 | 63%  | +$1,512 | 1m
      R_100  | 187   | 118 | 63%  | +$2,094 | 1m
    - By Strategy: bar chart + table
      Strategy      | Trades | Wins | Win % | Net P&L | Avg Stake
      Martingale     | 540   | 340 | 63%  | +$4,860 | $35
      Even/Odd      | 248   | 156 | 63%  | +$1,512 | $35
      DCA           | 187   | 118 | 63%  | +$2,094 | $70

  SECTION 5: REVENUE & DISTRIBUTION
    - Total Pool P&L:       +$8,234
    - Operator Share:       20% → $1,647
    - Investor Share:       80% → $6,587
    - Distributed:          $4,820  (73% of investor share)
    - Pending Distribution: $1,767
    - Per-package breakdown table:
        Package  | P&L      | Operator | Investor  | Distributed | Pending
        PKG-01   | +$1,680 | $336    | $1,344   | $950       | $394
        PKG-02   | +$1,512 | $302    | $1,210   | $0         | $1,210
        PKG-03   | +$5,042 | $1,008 | $4,034   | $3,870     | $164

  SECTION 6: DRAWDOWN ANALYSIS
    - Per-package drawdown over time (line chart)
    - Max drawdown, recovery time, drawdown-to-peak ratio
    - AI Guardian triggers correlated with drawdown dips (annotation markers)
    - Sample (PKG-01):
        Max drawdown: -2.8% (occurred 2026-10-12)
        Recovery time: 4h 18m
        AI Guardian triggered: 1 time during drawdown
        Drawdown-to-peak ratio: 0.18

  SECTION 7: TIME-PERIOD COMPARISON
    - Compare performance across packages with different trading periods
    - Daily P&L chart per package, normalized by capital
    - Sample:
        Day  PKG-01 (14d)  PKG-02 (21d)  PKG-03 (30d)
        1    +0.8%         +0.5%         +0.3%
        2    +1.2%         +0.8%         +0.6%
        3    -0.3%         -0.1%         +0.2%
        4    +1.5%         +1.0%         +0.8%
        5    +0.9%         +0.6%         +0.4%

TANSTACK QUERY KEYS:
  ["analytics", "overview", { period }]            → useQuery
  ["analytics", "by-package", { period }]          → useQuery
  ["analytics", "investor-ranking", { period }]     → useQuery
  ["analytics", "by-market", { period }]            → useQuery
  ["analytics", "by-strategy", { period }]          → useQuery
  ["analytics", "revenue-distribution", { period }] → useQuery
  ["analytics", "drawdown", { packageId, period }] → useQuery
  ["analytics", "period-comparison", { period }]    → useQuery

SAMPLE OVERVIEW PAYLOAD:
{
  "totalPnL": 8234.00,
  "overallROI": 5.3,
  "profitFactor": 1.41,
  "sharpeRatio": 1.82,
  "maxDrawdown": 3.2,
  "avgTradeDurationSeconds": 18,
  "period": "30d",
  "asOf": "2026-10-18T14:30:00Z"
}
```

---

### PAGE D-8: Funds & Capital (`/dashboard/funds`)

```
PURPOSE:
  All money flowing through the platform. Deposits received,
  capital deployed, available balance, fund allocation.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-funds.css
  Root class:        .page-dashboard-funds
  Motion hooks:      capital overview cards count-up
                     deposit table rows fadeSlideUp stagger
                     allocation chart (donut) chart-draw
                     fund flow timeline items slide-in-from-left
                     reconciliation status badge icon-pulse on "running"
  Responsive:         overview cards 1/2/4 cols (sm/md/lg)
                     deposit table → stacked cards < md
                     allocation chart full-width sm, side-by-side lg
                     timeline vertical on sm, horizontal on md+

7 SECTIONS:

  SECTION 1: CAPITAL OVERVIEW
    - 6 KPI cards:
      Total Capital Under Management: $156,000
      Deployed In Trades:              $142,000
      Available:                       $14,000
      Pending Deposits:                $3,500 (4 deposits)
      Deriv Account Balance:           $1,234.56
      Escrow Account (in-transit):     $5,250

  SECTION 2: DEPOSIT RECORDS (TanStack Table)
    - Columns: ID, Date, Investor, Amount, Method, Package, Status, Verified By, Actions
    - Sortable by date/amount, filterable by status/method/package
    - Row actions: [Verify] [Reject] [Request More Info] [View Proof]
    - Sample rows:
        dep_8f2a  2026-10-18 14:20  user_f5g3   $3,000  mobile_money  PKG-01  pending     [⋯]
        dep_b3c1  2026-10-18 13:15  user_h6i4   $5,000  bank_transfer PKG-02  verified    jane_op  [⋯]
        dep_d4e2  2026-10-18 11:08  user_k7l8   $2,500  crypto_usdt  PKG-03  submitted   [⋯]
        dep_f5g3  2026-10-18 09:42  user_m8n9   $3,000  card         PKG-01  verified    jane_op  [⋯]

  SECTION 3: CAPITAL ALLOCATION BY PACKAGE
    - Table + donut chart
    - Columns: Package, Capital, % of Total, Trades, Avg Stake, Status
    - Sample:
        PKG-01  $14,000  40%  423  $35   trading
        PKG-02  $12,250  35%  378  $35   trading
        PKG-03  $8,750   25%  446  $70   trading
        (Available: $14,000 unallocated)
    - [Rebalance Allocations] button → modal to adjust % splits per package

  SECTION 4: FUND FLOW TIMELINE
    - Chronological log of all money movements (deposits in, trades out, payouts out, fees)
    - Each entry: timestamp, type, amount, from→to, reference, status
    - Sample:
        14:23  trade_out   -$35    Deriv → Bot-Alpha  contract #1234567  ✓
        14:23  trade_in    +$63    Bot-Alpha → Deriv  contract #1234567  ✓
        14:20  deposit_in  +$3,000 user_f5g3 → escrow  dep_8f2a         pending
        14:15  payout_out  -$720   4 investors → bank   batch_b4tch    ✓
        13:50  fee_out     -$3.50  Deriv → Stripe     fee_8f2a         ✓

  SECTION 5: RECONCILIATION & AUDIT
    - 3-way reconciliation:
        Total Deposits (DB)         = $156,000
        Deriv Account Balance (API) = $1,234.56 + ($154,765.44 in trades)
        Escrow (Bank API)           = $5,250
        ─────────────────────────────────────────
        Expected vs Actual diff:    $0.00 ✓ balanced
    - Discrepancy detection with auto-alert on > $1 diff
    - [Run Full Reconciliation]  [Export Audit Report PDF]
    - Last 5 reconciliation runs:
        2026-10-18 14:00  ✓ balanced   diff $0.00
        2026-10-18 13:00  ✓ balanced   diff $0.00
        2026-10-18 12:00  ⚠ diff $1.20  (mobile money rounding — auto-resolved)

  SECTION 6: PAYMENT PROVIDER STATUS
    - Live status of connected providers:
        Deriv API:        🟢 Connected (latency 142ms)
        Stripe:           🟢 Healthy
        Mobile Money:     🟢 Healthy (MTN, Vodafone, Airtel)
        Bank (ACH):       🟡 Slow (last batch 4h delay)
        Crypto (USDT/USDC): 🟢 Healthy

  SECTION 7: FUND RESERVE & SAFETY MARGIN
    - Reserve balance: $4,200 (3% of total capital)
    - Safety margin: 5% of total capital = $7,800
    - Reserve target hit? ⚠ Below target
    - Auto-suggested action: Move $3,600 from trading capital to reserve
    - [Adjust Reserve %] [Trigger Auto-Rebalance]

TANSTACK QUERY KEYS:
  ["funds", "overview"]                       → useQuery, refetchInterval 30s
  ["funds", "deposits", { page, filters }]   → useQuery
  ["funds", "allocation"]                      → useQuery, refetchInterval 30s
  ["funds", "flow-timeline", { page }]        → useQuery
  ["funds", "reconciliation", "last-5"]        → useQuery
  ["funds", "provider-status"]                → useQuery, refetchInterval 60s
  ["funds", "reserve"]                         → useQuery

MUTATIONS:
  useVerifyDeposit()         → POST /api/deposits/:id/verify
  useRejectDeposit()         → POST /api/deposits/:id/reject
  useRequestMoreInfo()       → POST /api/deposits/:id/request-info
  useRebalanceAllocations()  → POST /api/funds/rebalance
  useRunReconciliation()     → POST /api/funds/reconcile
  useAdjustReserve()         → POST /api/funds/reserve

SAMPLE DEPOSIT PAYLOAD (POST /api/deposits/:id/verify):
{
  "depositId": "dep_8f2a",
  "reviewerNotes": "MTN MoMo receipt verified, ref matches",
  "verifiedBy": "user_jane_op"
}

SAMPLE RESPONSE:
{
  "depositId": "dep_8f2a",
  "status": "verified",
  "verifiedAt": "2026-10-18T14:25:00Z",
  "creditedToWallet": true,
  "investmentConfirmed": true
}
```

---

### PAGE D-9: Withdrawal Requests (`/dashboard/withdrawals`)

```
PURPOSE:
  Investor payout requests. Approve, reject, process, track.
  Queue management for batch processing.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-withdrawals.css
  Root class:        .page-dashboard-withdrawals
  Motion hooks:      queue summary cards count-up
                     pending requests table rows fadeSlideUp
                     action buttons hover-lift + pulse on "pending review"
                     processing rows icon-spin on "in-flight"
                     completed row checkmark icon-draw
  Responsive:         queue cards 1/2/4 cols (sm/md/lg)
                     pending table → stacked cards < md
                     processing/completed tables → stacked cards < md
                     settings form 2-col md

7 SECTIONS:

  SECTION 1: PAYOUT QUEUE SUMMARY
    - 5 KPI cards:
      Pending:    4 requests, $720 total
      Processing: 2 requests, $1,400 total
      Completed (today):     8 requests, $2,800 total
      Completed (lifetime):  184 requests, $48,920 total
      Avg Processing Time:   18m

  SECTION 2: PENDING REQUESTS (actionable)
    - TanStack Table: Date, Investor, Amount, Method, Reason, Package, Actions
    - Per-row actions: [✅ Approve] [❌ Reject] [Request Info]
    - Bulk actions: [Approve Selected] [Reject Selected] with checkboxes
    - Sample rows:
        2026-10-18 14:01  user_8f2a  $120   bank_transfer  partial_payout  PKG-01  [⋯]
        2026-10-18 13:42  user_b3c1  $200   mobile_money   full_payout     PKG-01  [⋯]
        2026-10-18 12:18  user_d4e2  $300   crypto_usdt    partial_payout  PKG-02  [⋯]
        2026-10-18 11:55  user_m8n9  $100   bank_transfer  full_payout     PKG-03  [⋯]

  SECTION 3: PROCESSING (in-flight payouts)
    - Transfers sent to provider, awaiting confirmation
    - Sample:
        2026-10-18 10:20  user_k7l8  $500  bank_transfer  provider:stripe_pi_8f2a  ⟳ awaiting  [⋯]
        2026-10-18 09:15  user_p1q2  $900  crypto_usdt    provider:tx:0xabc...     ⟳ awaiting  [⋯]
    - Row actions: [Mark Complete] [Mark Failed] [Contact Investor] [Retry]

  SECTION 4: COMPLETED PAYOUTS
    - TanStack Table: Date, Investor, Amount, Method, Fee, Reference, Completed At
    - Filterable by date range, method
    - Export [CSV]
    - Sample rows:
        2026-10-18 10:30  user_q3r4  $50    mobile_money   $0.75   ref:mtn_8f2a  ✓
        2026-10-18 09:45  user_s5t6  $750   bank_transfer  $0      ref:ach_b3c1  ✓
        2026-10-18 08:30  user_u7v8  $320   crypto_usdt    $1.50   ref:0xdef...   ✓

  SECTION 5: PAYOUT SETTINGS & RULES
    - Min payout amount:     $50
    - Max payout amount:     $10,000 per request
    - Auto-approve threshold: $200  (auto-approve if request ≤ $200 AND investor KYC L2+)
    - Batch processing:       daily at 17:00 UTC (BullMQ cron)
    - Fee structure:
        Bank Transfer:   $0 (free, 1-3 business days)
        Mobile Money:    1.5% (instant-30min)
        Card:            2.9% + $0.30 (instant)
        Crypto:          network fee only (15-60min)
    - Default method per investor: set in investor profile
    - [Save Settings]

  SECTION 6: FAILED & RETRY QUEUE
    - Failed payouts with reason and retry button
    - Sample:
        2026-10-17 17:00  user_w9x0  $250  bank_transfer  provider_timeout  [Retry] [Refund to wallet]
        2026-10-17 12:30  user_y1z2  $80   mobile_money   invalid_number    [Contact Investor]

  SECTION 7: PAYOUT HISTORY CHART
    - Bar chart of payout volume over last 30 days
    - Daily totals + 7-day moving average line
    - Sample (last 7 days):
        2026-10-18  $720
        2026-10-17  $1,820
        2026-10-16  $950
        2026-10-15  $2,340
        2026-10-14  $1,200
        2026-10-13  $540
        2026-10-12  $1,580
        7-day avg:  $1,307

TANSTACK QUERY KEYS:
  ["payouts", "queue-summary"]             → useQuery, refetchInterval 30s
  ["payouts", { status: "pending", page }] → useQuery, refetchInterval 30s
  ["payouts", { status: "processing" }]    → useQuery, refetchInterval 30s
  ["payouts", { status: "completed", page, filters }] → useQuery
  ["payouts", "settings"]                   → useQuery
  ["payouts", "failed-queue"]                → useQuery
  ["payouts", "history-chart", { days: 30 }] → useQuery

MUTATIONS:
  useApprovePayout()    → POST /api/payouts/:id/approve
  useRejectPayout()     → POST /api/payouts/:id/reject
  useBulkApprove()      → POST /api/payouts/batch-approve
  useBulkReject()       → POST /api/payouts/batch-reject
  useMarkComplete()     → POST /api/payouts/:id/complete
  useMarkFailed()       → POST /api/payouts/:id/fail
  useRetryPayout()      → POST /api/payouts/:id/retry
  useRefundToWallet()   → POST /api/payouts/:id/refund
  useUpdatePayoutSettings() → PATCH /api/payouts/settings

SAMPLE APPROVE PAYLOAD:
{
  "payoutId": "pay_8f2a1c",
  "reviewerNotes": "Verified bank details",
  "processNow": true  // bypass daily batch
}

SAMPLE RESPONSE:
{
  "payoutId": "pay_8f2a1c",
  "status": "processing",
  "providerReference": "stripe_pi_8f2a1c9d",
  "processedAt": "2026-10-18T14:35:00Z"
}
```

---

### PAGE D-10: Communications (`/dashboard/comms`)

```
PURPOSE:
  Messages to/from investors. Announcements, bulk notifications,
  individual messages, email templates.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-comms.css
  Root class:        .page-dashboard-comms
  Motion hooks:      inbox items fadeSlideUp stagger
                     unread badge icon-pulse
                     compose form fields staggered entrance
                     rich text editor toolbar fade on focus
                     announcement read-progress bar chart-draw
                     template card hover-lift
  Responsive:         inbox + detail 2-pane lg, stacked sm
                     inbox list 1-col, detail modal sm
                     compose form 2-col md, 1-col sm
                     template grid 1/2/3 cols (sm/lg)

7 SECTIONS:

  SECTION 1: RECENT MESSAGES (Inbox)
    - TanStack Table or virtualized list: From, Subject, Preview, Date, Status
    - Status: unread / read / replied / archived
    - Filter by status, package, date range
    - Click row → opens detail panel with full thread + reply box
    - Sample rows:
        user_8f2a  "Question about PKG-03 payout"   "Hi, when will the..."  2m ago   unread
        user_b3c1  "Need to update bank details"     "I moved banks..."     1h ago   read
        user_d4e2  "Thanks for the earnings!"        "Just got the payout..." 3h ago  replied

  SECTION 2: ANNOUNCEMENTS
    - Sent announcements with read count + read %
    - Sample:
        "PKG-01 Trading Started"          sent 2026-10-15 09:00  read 11/12 (92%)  [Resend to unread]
        "AI Guardian Triggered - Pause"   sent 2026-10-12 13:42  read 38/38 (100%)
        "Monthly Earnings Update"          sent 2026-10-01 09:00  read 35/38 (92%)  [Resend to unread]
    - [New Announcement] button

  SECTION 3: COMPOSE MESSAGE (modal or inline)
    - To: Individual / All / By Package (multi-select with search)
    - Subject (max 120 chars)
    - Rich text editor (React Email / TipTap) with variables:
        {name}        → investor's full name
        {package}     → investor's primary package code
        {investment}  → investor's total invested amount
        {earnings}    → investor's total earned
        {wallet}      → investor's wallet balance
        {roi}         → investor's overall ROI %
    - Sample subject: "Hi {name}, your {package} earnings update"
    - Sample body: "Hi {name},\n\nYour {package} investment has earned {earnings} so far ({roi} ROI)..."
    - Via channels (checkboxes):
        ☑ In-app notification
        ☑ Email
        ☐ Telegram
        ☐ SMS
    - Schedule for later (datetime picker, optional)
    - Save as Template (checkbox + name)
    - [Send Now]  [Schedule]  [Save Draft]  [Save as Template]

  SECTION 4: EMAIL TEMPLATES
    - Pre-built templates (editable):
        1. Welcome to DerivX
        2. Package Booking Confirmation
        3. Trading Started
        4. Weekly Earnings Update
        5. Payout Processed
        6. AI Guardian Alert
        7. Package Completed
        8. KYC Approved / Rejected
    - Per template: [Edit] [Preview] [Send Test] [Duplicate]
    - Variables auto-substituted in preview
    - Sample (Welcome template):
        Subject: Welcome to DerivX, {name}!
        Body: Hi {name}, thanks for joining DerivX.
              You've booked {investment} in {package}.
              Trading starts on {packageStartDate}.

  SECTION 5: NOTIFICATION LOG
    - TanStack Table: Date, Type, Subject, Sent To, Count, Channel, Status
    - Filterable by type, channel, date range
    - Export [CSV]
    - Sample rows:
        2026-10-18 14:23  trade_result    "Trade #247 won +$28"      PKG-01 investors (12)  in-app  ✓ delivered
        2026-10-18 13:42  ai_guardian      "Bots paused (PKG-02)"    PKG-02 investors (6)   in-app+email  ✓ delivered
        2026-10-18 09:00  announcement    "Daily summary"            All investors (38)     in-app+email  ✓ 35/38 delivered

  SECTION 6: BULK ACTIONS
    - [Send to All Investors] (compose pre-filled with "All" recipients)
    - [Send to Package Investors] (dropdown → choose package)
    - [Resend to Unread] (for past announcements)
    - [Send Daily Summary Now] (manual trigger of automated summary)
    - [Send Weekly Report Now]

  SECTION 7: COMMUNICATIONS ANALYTICS
    - Open rate, click rate, response rate per template
    - Channel performance comparison (in-app vs email vs telegram)
    - Sample (last 30 days):
        Total messages sent:    1,847
        Open rate (email):       73%
        Click rate (email):      18%
        Response rate (in-app):  34%
        Best channel: in-app (88% open, 34% response)

TANSTACK QUERY KEYS:
  ["comms", "inbox", { page, filters }]              → useQuery
  ["comms", "announcements", { page }]               → useQuery
  ["comms", "templates"]                               → useQuery
  ["comms", "log", { page, filters }]                 → useQuery
  ["comms", "analytics", { period }]                  → useQuery
  ["comms", "thread", investorId]                     → useQuery (enabled when thread open)

MUTATIONS:
  useSendMessage()        → POST /api/comms/messages
  useSendAnnouncement()   → POST /api/comms/announcements
  useSaveTemplate()       → POST /api/comms/templates
  useUpdateTemplate()     → PATCH /api/comms/templates/:id
  useSendTestEmail()      → POST /api/comms/templates/:id/test
  useResendAnnouncement() → POST /api/comms/announcements/:id/resend
  useMarkRead()           → PATCH /api/comms/messages/:id/read

SAMPLE ANNOUNCEMENT PAYLOAD:
{
  "subject": "PKG-01 Trading Started",
  "body": "Hi {name},\n\nPKG-01 trading has officially started at 09:00 UTC.\nYour investment of {investment} is now actively traded by our bot pool.\n\nExpected ROI: 15% over 14 days.\nWe'll send weekly updates on your earnings.\n\n— DerivX Team",
  "recipients": { "type": "package", "packageId": "pkg_01" },
  "channels": ["in_app", "email"],
  "scheduledFor": null,
  "saveAsTemplate": false
}

SAMPLE RESPONSE (201 Created):
{
  "announcementId": "ann_8f2a1c",
  "sentTo": 12,
  "delivered": 12,
  "sentAt": "2026-10-15T09:00:00Z"
}
```

---

### PAGE D-11: Deposit Logs (`/dashboard/deposits`)

```
PURPOSE:
  Comprehensive deposit tracking. Every payment received,
  verification status, method details, reconciliation.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-deposits.css
  Root class:        .page-dashboard-deposits
  Motion hooks:      summary cards count-up
                     deposit table rows fadeSlideUp stagger
                     verification queue items icon-pulse on "pending"
                     method breakdown bar chart chart-draw
                     failed/refunded cards shake on entry
  Responsive:         summary cards 1/2/4 cols (sm/md/lg)
                     deposit table → stacked cards < md
                     verification queue 1-col sm, 2-col md
                     method breakdown chart full-width sm

7 SECTIONS:

  SECTION 1: DEPOSIT SUMMARY
    - 7 KPI cards:
      Total Received:           $156,000
      Verified:                  $148,500 (95.2%)
      Pending:                   $3,500 (4 deposits)
      Failed:                    $1,200 (3 deposits)
      Refunded:                  $800 (2 deposits)
      Today:                     $8,500 (4 deposits)
      Avg Verification Time:     1h 24m

  SECTION 2: DEPOSIT TABLE (TanStack Table)
    - Columns: ID, Date, Investor, Amount, Method, Package, Status, Reference, Verified By, Actions
    - Server-side pagination (50/page)
    - Sortable by date/amount
    - Filterable: date range, status, method, package, investor
    - Export [CSV] [PDF]
    - Expandable rows with full payment details, reference, verification notes
    - Sample rows:
        dep_8f2a  2026-10-18 14:20  user_f5g3  $3,000  mobile_money  PKG-01  pending    mtn_ref_8f2a  -
        dep_b3c1  2026-10-18 13:15  user_h6i4  $5,000  bank_transfer PKG-02  verified   ach_b3c1     jane_op
        dep_d4e2  2026-10-18 11:08  user_k7l8  $2,500  crypto_usdt   PKG-03  submitted  0xabc...     -
        dep_f5g3  2026-10-18 09:42  user_m8n9  $3,000  card          PKG-01  verified   stripe_pi_x  jane_op

  SECTION 3: VERIFICATION QUEUE
    - Pending deposits with [Verify] [Reject] [Request Proof]
    - Each card: investor, amount, method, claimed date, proof attached indicator
    - Click to view payment proof (image/PDF)
    - Sample queue items:
        user_f5g3  $3,000  mobile_money (MTN)    submitted 2h ago  proof: screenshot attached  [Verify] [Reject]
        user_k7l8  $2,500  crypto_usdt           submitted 3h ago  proof: tx hash 0xabc...     [Verify] [Reject]

  SECTION 4: METHOD BREAKDOWN
    - Bar chart + table by method
    - Columns: Method, Count, Total, Verified %, Avg Verification Time, Fee %
    - Sample:
        Bank Transfer   42 deposits  $58,000  98%  2h 30m  0%
        Mobile Money    28 deposits  $24,500  95%  18m    1.5%
        Card            18 deposits  $42,000  100% 5m     2.9%+$0.30
        Crypto          14 deposits  $31,500  92%  25m    network fee

  SECTION 5: FAILED & REFUNDED
    - Failed deposits with reason and retry option
    - Refunded deposits with confirmation
    - Sample failed:
        dep_x1y2  2026-10-15  user_z3a4  $2,000  card  insufficient_funds  [Retry] [Contact Investor]
        dep_b5c6  2026-10-14  user_d7e8  $1,500  mobile_money  timeout      [Retry] [Contact Investor]
    - Sample refunded:
        dep_f9g0  2026-10-12  user_h1i2  $1,000  bank_transfer  investor_request  ✓ refunded
        dep_j3k4  2026-10-10  user_l5m6  $800    card            duplicate_payment ✓ refunded

  SECTION 6: DEPOSIT TIMELINE (24h)
    - Timeline visualization of today's deposits by hour
    - Highlight peak hours for staffing/scheduling
    - Sample:
        00-04: 1 deposit  $3,000
        04-08: 0 deposits
        08-12: 2 deposits $8,000 (peak)
        12-16: 2 deposits $5,500
        16-20: 1 deposit  $3,000
        20-24: 0 deposits (so far)

  SECTION 7: DEPOSIT AUTOMATION RULES
    - Auto-verify rules:
        ☑ Auto-verify crypto deposits after 6 confirmations
        ☑ Auto-verify card payments from Stripe webhook
        ☑ Auto-verify mobile money from provider webhook
        ☐ Auto-verify bank transfers (manual required)
    - Reconciliation rules:
        ☑ Cross-check deposit amount vs provider webhook amount
        ☑ Flag mismatches > $1 for manual review
        ☑ Auto-reject deposits with no proof within 24h
    - [Save Rules]

TANSTACK QUERY KEYS:
  ["deposits", "summary"]                           → useQuery
  ["deposits", { page, pageSize, sort, filters }]  → useQuery
  ["deposits", "verification-queue"]                → useQuery, refetchInterval 30s
  ["deposits", "method-breakdown", { period }]      → useQuery
  ["deposits", "failed-refunded", { page }]         → useQuery
  ["deposits", "timeline", { date }]                → useQuery
  ["deposits", "automation-rules"]                  → useQuery

MUTATIONS:
  useVerifyDeposit()        → POST /api/deposits/:id/verify
  useRejectDeposit()        → POST /api/deposits/:id/reject
  useRequestProof()         → POST /api/deposits/:id/request-proof
  useRetryDeposit()         → POST /api/deposits/:id/retry
  useRefundDeposit()       → POST /api/deposits/:id/refund
  useUpdateAutomationRules() → PATCH /api/deposits/automation-rules

SAMPLE DEPOSIT RECORD:
{
  "depositId": "dep_8f2a",
  "userId": "user_f5g3",
  "amount": 3000.00,
  "method": "mobile_money",
  "methodDetails": { "provider": "mtn", "phone": "+256•••••42", "reference": "mtn_ref_8f2a" },
  "packageId": "pkg_01",
  "investmentId": "inv_8f2a",
  "status": "pending",
  "proofUrl": "s3://derivx-deposit-proof/dep_8f2a/screenshot.jpg",
  "submittedAt": "2026-10-18T14:20:00Z",
  "verifiedAt": null,
  "verifiedBy": null,
  "reviewerNotes": null
}
```

---

### PAGE D-12: Activity & Audit Logs (`/dashboard/logs`)

```
PURPOSE:
  Complete audit trail. Every action on the platform logged.
  Who did what, when, from where. Searchable, filterable.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-logs.css
  Root class:        .page-dashboard-logs
  Motion hooks:      log stream entries slide-in-from-top + fadeSlideUp
                     category tabs fade in/out on switch
                     system events icon-pulse on critical
                     export buttons hover-lift
  Responsive:         log table full-width, horizontal scroll for many columns
                     categorized tabs horizontal scroll on sm
                     investor activity timeline vertical on sm
                     export controls wrap row

7 SECTIONS:

  SECTION 1: LOG STREAM (newest first, real-time)
    - Virtualized list (up to 1000 items, server-side pagination 100/page)
    - Each entry: timestamp, category icon, actor, action, target, IP, details
    - Color-coded by category:
        🟢 TRADE   🟡 DEPOSIT  🔵 PAYOUT  🟣 SYSTEM  🟠 AUTH  🟤 COMM
    - Filter bar: text search, category filter, date range
    - Live indicator: icon-pulse dot, "Live" label
    - Sample entries:
        14:23:47  TRADE    Bot-Alpha  bought R_10 Rise5t $35  PKG-01   from 196.•••.••  contract #1234567
        14:23:31  TRADE    Bot-Bravo  won R_75 Even $28      PKG-02   from 196.•••.••  contract #1234568
        14:20:00  DEPOSIT  user_f5g3  submitted $3,000       PKG-01   from 41.•••.••   ref mtn_ref_8f2a
        14:15:00  PAYOUT   jane_op    approved 4 payouts      batch    from 196.•••.••  $720 total
        14:10:32  SYSTEM   AI Guardian triggered PKG-02      cooldown from server                8 consec losses
        14:05:11  AUTH     user_8f2a  login successful         -        from 41.•••.••   2FA passed

  SECTION 2: CATEGORIZED LOGS (tabbed)
    - Tab: Trade Logs (all trade events)
        buy/sell/result, contract IDs, profit/loss, bot+schedule attribution
    - Tab: Deposit Logs (deposit lifecycle)
        submitted → verified/rejected → credited to wallet → investment confirmed
    - Tab: Payout Logs (payout lifecycle)
        requested → approved/rejected → processing → completed/failed → retry
    - Tab: System Logs (platform events)
        AI Guardian triggers, reconciliation runs, backups, cron jobs, webhook failures
    - Each tab: filterable table with category-specific columns

  SECTION 3: INVESTOR ACTIVITY
    - Per-investor timeline (selected investor)
    - All actions: logins, deposits, bookings, payouts, message reads, KYC steps
    - Sample (user_8f2a last 24h):
        14:20  read announcement "PKG-01 Trading Started"
        13:55  login successful (from 41.•••.••, 2FA passed)
        11:30  viewed pool detail (PKG-01)
        09:00  received announcement "Daily summary"
        2026-10-17 23:55  viewed earnings
        2026-10-17 22:00  requested payout $120

  SECTION 4: SYSTEM EVENTS
    - AI Guardian triggers (last 10)
    - Reconciliation runs (last 5)
    - Backups (last 7 daily + last 4 weekly)
    - Cron jobs (last 50 executions)
    - Webhook failures (last 10) with retry status
    - Sample:
        14:10  ai_guardian     PKG-02 8 consec losses → paused 5min
        14:00  reconciliation   balanced diff $0.00
        13:30  backup_daily    completed 2.4GB s3://derivx-backup/2026-10-18.tar.gz
        13:00  cron            distribute_pending_payouts (1 payout, $120)
        12:42  webhook_failure stripe webhook timeout (retry 1 of 3)

  SECTION 5: SECURITY & ACCESS LOGS
    - Login attempts (successful + failed)
    - 2FA challenges
    - Password reset requests
    - Session creation/revocation
    - IP whitelist events
    - Sample:
        14:05  user_8f2a  login successful  from 41.•••.••  2FA:authenticator
        13:42  user_b3c1  login failed      from 193.•••.••  invalid_password (4/5 remaining)
        13:30  user_c3d1  2fa_challenge     from 41.•••.••  passed
        13:15  user_d4e2  password_reset    requested        email sent

  SECTION 6: API ACCESS LOGS
    - Internal API calls (last 100) with latency + status
    - External webhook deliveries (last 50) with status + retry
    - Sample:
        14:23  POST /api/trades/buy         201  82ms   bot_alpha
        14:23  POST /api/comms/broadcast     200  145ms  internal
        14:20  POST /webhooks/stripe        200  12ms   external
        14:15  POST /webhooks/deriv         200  4ms    external

  SECTION 7: EXPORT & COMPLIANCE
    - [Export All Logs CSV] (filtered by date range, max 30 days, 10k rows)
    - [Generate Compliance Report PDF] (executive summary + key events)
    - [Generate Tax Report] (yearly profit/loss summary for accountant)
    - Retention policy:
        Trade logs:        7 years (regulatory requirement)
        Deposit logs:      7 years
        Payout logs:       7 years
        Auth logs:         1 year
        System logs:       90 days
        Audit logs:        7 years
    - Last archive date: 2026-10-01 (monthly archive to S3 cold storage)
    - [Trigger Archive Now]  [View Archive List]

TANSTACK QUERY KEYS:
  ["logs", "stream", { filters, page }]               → useInfiniteQuery
  ["logs", "categorized", { category, filters, page }] → useQuery
  ["logs", "investor-activity", investorId, { page }] → useQuery
  ["logs", "system-events", { type, page }]            → useQuery
  ["logs", "security", { page }]                       → useQuery
  ["logs", "api-access", { page }]                     → useQuery
  ["logs", "retention-policy"]                          → useQuery

MUTATIONS:
  useExportLogs()          → POST /api/logs/export
  useGenerateCompliance()  → POST /api/logs/compliance-report
  useGenerateTaxReport()   → POST /api/logs/tax-report
  useTriggerArchive()      → POST /api/logs/archive

SAMPLE LOG ENTRY (server-side, audit_logs table):
{
  "id": "log_8f2a1c9d4e7b",
  "userId": "user_jane_op",
  "category": "payout",
  "action": "approve_payout",
  "details": "Approved payout pay_8f2a1c for user_8f2a, amount $120, method bank_transfer",
  "ipAddress": "196.250.•••.••",
  "userAgent": "Mozilla/5.0 (TanStack Start client)",
  "metadata": {
    "payoutId": "pay_8f2a1c",
    "amount": 120.00,
    "method": "bank_transfer"
  },
  "createdAt": "2026-10-18T14:15:00Z"
}
```

---

### PAGE D-13: Markets & Symbols (`/dashboard/markets`)

```
PURPOSE:
  Browse available Deriv markets for scheduling trades.
  Symbol selection, market schedules, tick previews.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-markets.css
  Root class:        .page-dashboard-markets
  Motion hooks:      market tab switch fade in/out
                     symbol grid cards fadeSlideUp stagger (max 12, 60ms)
                     live tick price shimmer on change
                     market schedule countdown icon-pulse
                     quick schedule form fields staggered entrance
  Responsive:         market tabs horizontal scroll on sm
                     symbol grid 2-col sm, 3-col md, 4-col lg, 6-col xl
                     package market assignment table → stacked cards < md
                     quick schedule form 2-col md

7 SECTIONS:

  SECTION 1: MARKET TABS & FILTER
    - Tabs: Forex | Synthetics | Commodities | Crypto | Indices | Stock Indices | Favorites
    - Search bar (filters symbols by code or name)
    - "Show only favorites" toggle (persisted per operator)
    - "Show only assigned to packages" toggle

  SECTION 2: SYMBOL GRID
    - Cards per symbol with:
      Symbol code + display name (R_10 — Volatility 10 Index)
      Live price (count-up on change, shimmer)
      Direction arrow ▲/▼ + % change
      Tick timing (e.g., 1 tick/s)
      Market status (open/closed)
      "Assigned to" badge showing packages using this symbol
      [Schedule] button → opens inline quick-schedule form
      [Star] toggle favorite
    - Sample cards:
        R_10    Volatility 10 Index       4532.11  ▲ +0.04%  1 tick/s   🟢 open   PKG-01,PKG-03
        R_75    Volatility 75 Index       2451.18  ▼ -0.03%  1 tick/s   🟢 open   PKG-02
        R_100   Volatility 100 Index      5621.83  ▲ +0.11%  1 tick/s   🟢 open   PKG-03
        frxEURUSD  Euro / US Dollar       1.0842   ▲ +0.02%  1 tick/s   🟢 open
        frxXAUUSD  Gold / USD             2,341.50 ▲ +0.31%  1 tick/s   🟢 open
        cryBTCUSD Bitcoin / USD           67,432   ▲ +1.4%   1 tick/s   🟢 open

  SECTION 3: MARKET SCHEDULE
    - Open/close times per market with countdown
    - "Next close" countdown timer (icon-pulse when ≤ 1h to close)
    - "Next open" countdown timer
    - Sample:
        Synthetics (R_*):  24/7 — always open
        Forex:            Mon 00:00 UTC → Fri 22:00 UTC  (closes in 3d 8h)
        Commodities:      Mon 01:00 → Fri 23:30  (closes in 3d 9h)
        Crypto:            24/7 — always open
        Stock Indices:    Mon-Fri 09:30-16:00 ET per market

  SECTION 4: PACKAGE MARKET ASSIGNMENT
    - Table: Package, Markets Assigned, Strategies, AI Guardian, Max Drawdown
    - [Edit Assignments] → modal to add/remove markets per package
    - Sample:
        PKG-01  R_10, R_75            Martingale, Even/Odd   ☑ Enabled  5%
        PKG-02  R_10, R_100           Even/Odd, DCA          ☑ Enabled  5%
        PKG-03  R_10, R_75, R_100     Martingale, Even/Odd, DCA ☑ Enabled  5%

  SECTION 5: QUICK SCHEDULE FROM MARKET
    - Inline form when [Schedule] clicked on a symbol card
    - Pre-filled: symbol = clicked symbol
    - Fields: Strategy, Stake, Duration, Max Trades, Assign to Packages, Time
    - Live preview of estimated capital needed
    - [Schedule Trade] button → POST /api/schedules
    - Sample:
        Symbol: R_10 (pre-filled)
        Strategy: Martingale
        Stake: $35
        Duration: 5 ticks
        Max Trades: 8
        Assign to: ☑ PKG-01  ☑ PKG-02  ☐ PKG-03
        Time: Today 17:00 UTC (or "Run Now")
        Estimated capital: $280 (8 × $35)

  SECTION 6: TICK PREVIEW (selected symbol)
    - Live tick stream visualization for selected symbol
    - Last 50 ticks displayed as a horizontal list of last-digit values
    - Statistics: even/odd distribution, digit frequency, last-100 volatility
    - Sample:
        Last 10 ticks:  ...2 7 4 9 1 5 8 3 6 2  (last 10 last-digits)
        Even/Odd (last 50): 52% even / 48% odd
        Digit frequency (last 100):
            0: 8  1: 11  2: 9  3: 12  4: 10
            5: 11 6: 9  7: 8  8: 12  9: 10
        Volatility (last 100): 0.042

  SECTION 7: MARKET RECOMMENDATIONS
    - AI suggestions based on recent performance:
        "R_10 is performing well in current session (+$28 net last 10 trades)
         Recommended: schedule Martingale 5-tick CALL on R_10"
    - Strategy-symbol performance matrix (last 30 days):
        Best combo: Martingale × R_10 → +$4,020 net (64% win)
        Worst combo: Fibonacci × R_50 → -$1,432 net (61% win, high variance)
    - [Schedule Recommended] button → pre-fills quick schedule

TANSTACK QUERY KEYS:
  ["markets", "active-symbols"]                       → useQuery (Deriv active_symbols)
  ["markets", "schedule"]                              → useQuery
  ["markets", "favorites"]                              → useQuery (persisted per user)
  ["markets", "package-assignments"]                   → useQuery
  ["markets", "ticks", symbol]                         → useSubscription via WebSocket
  ["markets", "tick-history", symbol, { count: 100 }] → useQuery
  ["markets", "recommendations"]                       → useQuery, refetchInterval 5m

MUTATIONS:
  useToggleFavorite()         → POST /api/markets/favorites
  useAssignPackageMarkets()   → POST /api/packages/:id/markets
  useQuickScheduleTrade()     → POST /api/schedules

SAMPLE TICK SUBSCRIPTION (WebSocket):
{
  "ticks": "R_10",
  "subscribe": 1
}

SAMPLE TICK RESPONSE:
{
  "tick": {
    "symbol": "R_10",
    "quote": 4532.11,
    "epoch": 1729252223,
    "pip_size": 2
  },
  "subscription": { "id": "abc123" }
}
```

---

### PAGE D-14: Bot & Automation Config (`/dashboard/bots`)

```
PURPOSE:
  Configure the bots that execute my scheduled trades.
  These are MY operator bots that trade the pooled capital on Deriv.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-bots.css
  Root class:        .page-dashboard-bots
  Motion hooks:      bot cards fadeSlideUp stagger (60ms)
                     bot status icons icon-pulse on running, icon-spin on syncing
                     config panel slide-down 240ms on expand
                     AI Guardian status indicator icon-pulse on alert
                     automation rules list slide-in-from-left
                     notification badge count-up
  Responsive:         bot cards 1/2/3 cols (sm/md/lg)
                     config panel full-width sm
                     AI Guardian status card 1-col sm
                     automation rules list 1-col sm, 2-col md

7 SECTIONS:

  SECTION 1: BOT CARDS
    - Per bot card: status, symbol, strategy, packages served, runtime, trades, win rate, P&L
    - Status indicators: 🟢 running  🟡 paused  🔴 stopped  ⚫ idle
    - Action buttons: [Pause] [Stop] [Restart] [Config] [View Trades]
    - Sample bots:
        Bot-Alpha      🟢 running  R_10   Martingale     PKG-01,02,03  2h 14m  12 trades  75%  +$84
        Bot-Bravo      🟢 running  R_75   Even/Odd       PKG-02         2h 14m  8 trades  62%  +$28
        Bot-Charlie    🟡 paused   R_100  DCA             PKG-03         1h 42m  6 trades  50%  +$0   (cooldown 4m left)
        Bot-Delta      🔴 stopped  R_10   Oscar's Grind  -              0       0 trades  --   $0    (manual stop)
        Bot-Echo       ⚫ idle     R_25   Fibonacci      -              0       0 trades  --   $0    (no schedule)

  SECTION 2: BOT CONFIG (expandable per bot)
    - Symbol selector (searchable)
    - Contract type dropdown (CALL/PUT, Even/Odd, Over/Under, etc.)
    - Stake settings: initial, current, max
    - Strategy params (JSON editor for custom strategies):
        Martingale: { "multiplier": 2.1, "maxSteps": 5, "resetOnWin": true }
        Even/Odd:   { "defaultSide": "even", "switchOnLoss": true }
        DCA:        { "stakeSchedule": [35, 35, 70, 105] }
    - Package Capital Allocation (which packages, what %):
        ☑ PKG-01  40%  $5,600 (Bot-Alpha share)
        ☑ PKG-02  35%  $4,900
        ☑ PKG-03  25%  $3,500
    - Risk Limits:
        Take Profit: $500/day
        Stop Loss: $300/day
        Max Daily Loss: $200
        Max Daily Trades: 100
        Cooldown Losses: 3 (cooldown 5min)
        Max Concurrent: 1 trade at a time
    - AI Guardian settings (per bot):
        ☑ Pause on consec losses (threshold: 8)
        ☑ Pause on drawdown (threshold: 5%)
        ☑ Random market rotation (every 30 min)
    - [Save Config] [Test Run 1 Trade]

  SECTION 3: AI GUARDIAN STATUS
    - Global status: 🟢 Active (all packages clear)  or  🟡 Alert (PKG-02 in cooldown)
    - Rules summary:
        Max consec losses (odd/even): 8
        Max consec losses (digits):   10
        Max bulk runs:                1-2
        Random market rotation:      ON
        Per-package drawdown limit:   5%
    - Recent triggers (last 24h, with resume timestamps)
    - Sample:
        14:10  PKG-02  8 consec losses     → paused 5min  → resumed 14:15
        12:42  PKG-03  5% drawdown hit     → paused 10min → resumed 12:52
        11:08  PKG-01  random rotation    → switched R_10 → R_25
    - [Edit Guardian Rules] → modal to adjust thresholds
    - [View Full Trigger History] → /dashboard/logs?category=system&type=ai_guardian

  SECTION 4: AUTOMATION RULES
    - Conditional rules: if X happens, do Y
    - Each rule: name, condition, action, last triggered, trigger count, enabled toggle
    - [+ New Rule] button
    - Sample rules:
        "Halt on 3 consec losses"      IF consec_losses >= 3 THEN pause bot 5min  (last: 14:10, count: 5)
        "Notify on large deposit"      IF deposit >= $5000 THEN send telegram   (last: 13:15, count: 2)
        "Auto-distribute on completion" IF package.completed THEN distribute     (last: 2026-10-10, count: 1)
        "Auto-pause at 17:00"          IF time = 17:00 AND weekday THEN pause all (last: yesterday, count: daily)
        "Recovery alert"               IF drawdown > 8% THEN notify operator      (last: never, count: 0)

  SECTION 5: BOT PERFORMANCE COMPARISON
    - Side-by-side stats per bot (sortable):
        Bot         Trades  Win %  P&L      Avg Stake  Best  Worst  Runtime
        Bot-Alpha   12      75%   +$84     $35        +$28  -$35   2h 14m
        Bot-Bravo   8       62%   +$28     $35        +$28  -$35   2h 14m
        Bot-Charlie 6       50%   +$0      $70        +$56  -$70   1h 42m
    - Sortable by P&L, win rate, runtime, etc.
    - Click bot name → bot detail with full trade log filtered to that bot

  SECTION 6: OPERATOR NOTIFICATIONS (real-time)
    - Real-time alerts feed for the operator (push + in-app)
    - Categories: trade results, AI Guardian, deposits, payouts, KYC, large events
    - Sample notifications (last 10):
        🔔 14:23  Trade #247 won +$28 on R_10 (PKG-01)         unread
        🔔 14:20  New deposit $3,000 from user_f5g3 (PKG-01)   unread
        🔔 14:15  4 payouts approved (batch total $720)         read
        🔔 14:10  ⚠ AI Guardian paused PKG-02 (8 consec losses) unread → ACTION REQUIRED
        🔔 13:42  2FA challenge passed for user_c3d1           read
    - [Mark All Read]  [Notification Settings]
    - Notification Settings (modal):
        ☑ Trade results (in-app + sound)
        ☑ AI Guardian alerts (in-app + telegram)
        ☑ Large deposits (>= $5000 → telegram)
        ☐ KYC submissions (in-app only)
        ☑ Payout requests (in-app)

  SECTION 7: SCRIPT LIBRARY (custom strategies)
    - List of saved custom strategy scripts
    - Per script: name, language (JS), last edited, total runs, win rate
    - [New Script] → opens Monaco editor
    - Sample scripts:
        Martingale-V2.js    3 runs   67%  last edited 2026-10-15
        Even-Odd-Anti.js    8 runs   63%  last edited 2026-10-12
        Custom-Accum.js     2 runs   50%  last edited 2026-10-10
    - [Edit] [Duplicate] [Delete] [Attach to Bot] per script
    - Click to attach to a bot → bot.strategyType = "script" + bot.scriptId

TANSTACK QUERY KEYS:
  ["bots", { status: "active" }]                → useQuery, refetchInterval 30s
  ["bots", id, "config"]                         → useQuery (enabled when expanded)
  ["bots", id, "trades", { page }]              → useQuery
  ["bots", "performance-comparison"]             → useQuery
  ["ai-guardian", "status"]                       → useQuery, refetchInterval 15s
  ["ai-guardian", "triggers", { period: "24h" }] → useQuery
  ["automation", "rules"]                         → useQuery
  ["operator", "notifications", { limit: 10 }]    → useQuery, refetchInterval 30s
  ["scripts", { ownerId }]                         → useQuery

MUTATIONS:
  useStartBot()         → POST /api/bots/:id/start
  usePauseBot()         → POST /api/bots/:id/pause
  useStopBot()          → POST /api/bots/:id/stop
  useRestartBot()       → POST /api/bots/:id/restart
  useUpdateBotConfig()  → PATCH /api/bots/:id
  useCreateBot()         → POST /api/bots
  useDeleteBot()         → DELETE /api/bots/:id
  useUpdateGuardianRules() → PATCH /api/ai-guardian/rules
  useCreateAutomationRule() → POST /api/automation/rules
  useUpdateAutomationRule() → PATCH /api/automation/rules/:id
  useDeleteAutomationRule() → DELETE /api/automation/rules/:id
  useSaveScript()        → POST /api/scripts
  useUpdateScript()      → PATCH /api/scripts/:id
  useAttachScriptToBot() → POST /api/bots/:id/attach-script
  useMarkNotificationRead() → PATCH /api/notifications/:id/read

SAMPLE BOT PAYLOAD (POST /api/bots):
{
  "name": "Bot-Foxtrot",
  "connectionId": "dc_8f2a1c9d",
  "symbol": "R_10",
  "strategyType": "martingale",
  "scriptId": null,
  "contractType": "CALL",
  "initialStake": 35.00,
  "currentStake": 35.00,
  "maxStake": 100,
  "duration": 5,
  "durationUnit": "t",
  "strategyParams": { "multiplier": 2.1, "maxSteps": 5, "resetOnWin": true },
  "takeProfit": 500,
  "stopLoss": 300,
  "maxDailyLoss": 200,
  "maxDailyTrades": 100,
  "cooldownLosses": 3,
  "cooldownDuration": 300,
  "maxConcurrent": 1,
  "packageIds": ["pkg_01", "pkg_02"],
  "packageAllocation": { "pkg_01": 60, "pkg_02": 40 },
  "aiGuardianEnabled": true
}

SAMPLE RESPONSE (201 Created):
{
  "botId": "bot_f0x7r0t",
  "status": "idle",
  "createdAt": "2026-10-18T15:00:00Z"
}
```

---

### PAGE D-15: Settings (`/dashboard/settings`)

```
PURPOSE:
  Operator profile, Deriv connection, platform configuration,
  payout rules, notification preferences, security.

STYLE RULES:
  Page stylesheet:   src/styles/pages/dashboard-settings.css
  Root class:        .page-dashboard-settings
  Motion hooks:      tab switch fade in/out 200ms
                     form fields staggered entrance per tab
                     security badges icon-pulse on weak
                     Deriv connection card status indicator icon-pulse
                     save button hover-lift + checkmark icon-draw on success
  Responsive:         tab nav horizontal scroll on sm
                     forms 1-col sm, 2-col md, full-width inputs
                     channel toggles row wraps

7 SECTIONS:

  SECTION 1: OPERATOR PROFILE
    - Avatar upload (with crop + preview)
    - Full Name (text)
    - Email (read-only — change requires verification)
    - Username (read-only — set at signup)
    - Role: operator (badge; can switch to "both" via "Become Investor" button)
    - Timezone (dropdown, default UTC)
    - Phone (with country code picker, used for 2FA SMS)
    - Bio (max 500 chars, shown publicly)
    - [Save Profile]  → PATCH /api/user/profile

  SECTION 2: DERIV CONNECTION
    - List of connected Deriv accounts (max 5 on Team tier)
    - Per connection card:
        Deriv Login ID: CR123456
        Account Type:   Real  (or Demo)
        Currency:       USD
        Balance:        $1,234.56 (count-up, icon-pulse)
        Status:         🟢 Connected
        Last Activity:  14:23 UTC
        Permissions:    Read, Trade, Payments, Admin
        Actions: [Refresh Token] [Reconnect] [Disconnect] [Test Connection]
    - [+ Add Second Account] → starts OAuth flow
    - Sample:
        Connection 1: CR123456 (primary)  Real  USD  $1,234.56  🟢  Active  14:23  [⋯]
        Connection 2: (none)                                                                       [+ Add]
    - "Test Connection" → opens WebSocket, sends ping, reports latency
    - If disconnected: prompts re-OAuth flow

  SECTION 3: PLATFORM CONFIGURATION
    - Default package split: Operator 20% / Investor 80% (sliders, 0-40 range)
    - Default min investment: $1,000 (slider $100-$50,000)
    - Auto-verify deposits: ☑ (toggle)
    - Auto-approve payouts threshold: $200 (slider $0-$1000)
    - Batch payout time: 17:00 UTC daily (time picker + cron preview)
    - Earnings calc frequency: every 3 minutes (dropdown: 1m, 3m, 5m, 10m)
    - Max investors per package: 50 (slider 1-500)
    - Default AI Guardian settings:
        Max consec losses: 8 (slider 3-15)
        Per-package drawdown limit: 5% (slider 1-15%)
    - [Save Configuration]  → PATCH /api/settings/platform

  SECTION 4: SECURITY
    - Change Password (3 fields: current, new, confirm)
    - Two-Factor Authentication:
        Status: ✓ Enabled (authenticator app)
        [View Backup Codes]  [Disable 2FA]  [Reconfigure]
    - Session timeout: 30 minutes (dropdown: 15m, 30m, 1h, 4h, never)
    - IP whitelist:
        ☐ Enable IP whitelist (toggle)
        If enabled, only listed IPs can access operator dashboard
        Add IP: 196.250.•••.••  [+ Add]
        List:
          196.250.•••.••   home        [Remove]
          41.•••.•••       mobile       [Remove]
    - Active sessions (with revoke button):
        Session 1: 196.•••.•••  Chrome  •  started 2h ago  [Revoke]
        Session 2: 41.•••.•••  Safari  •  started 4h ago  [Revoke]
        Session 3: 41.•••.•••  Mobile  •  started 1d ago  [Revoke]
    - [Revoke All Sessions] (logout everywhere)
    - [Save Security Settings]

  SECTION 5: NOTIFICATION CHANNELS
    - Email: ☑ enabled, jane@derivx.io (verified)
    - Telegram: ☑ enabled, @jane_op_bot (connected)
    - Push: ☑ enabled (PWA + VAPID keys)
    - Webhook: ☐ disabled, [+ Add Webhook URL]
    - Per-channel test button: [Send Test]
    - Alert toggles per channel:
        Event                       Email  Telegram  Push  Webhook
        AI Guardian trigger          ☑      ☑        ☑     ☐
        Large deposit (>= $5000)    ☑      ☑        ☑     ☐
        Payout request              ☑      ☐        ☑     ☐
        Drawdown > 5%               ☑      ☑        ☑     ☐
        New investor                ☑      ☐        ☐     ☐
        KYC submitted               ☑      ☐        ☐     ☐
        Trade streak 10+ wins       ☐      ☑        ☑     ☐
        Package completed            ☑      ☑        ☑     ☐
        Webhook failure              ☑      ☐        ☑     ☐
        Reconciliation discrepancy   ☑      ☑        ☑     ☐
    - [Save Notification Settings]  → PATCH /api/settings/notifications

  SECTION 6: API ACCESS & INTEGRATIONS
    - Personal API keys (for programmatic access):
        Key 1: derivx_pk_8f2a1c••••••••  created 2026-09-15  last used 14:23  [Revoke]
        Key 2: derivx_pk_b3c1d4••••••••  created 2026-10-01  last used never  [Revoke]
        [+ Generate New Key]
    - Webhook integrations:
        Stripe:        configured, webhook secret ••••  [Test] [Edit]
        Deriv:         configured, webhook secret ••••  [Test] [Edit]
        Slack (alerts): not configured  [+ Connect]
    - Third-party integrations:
        Google Calendar: ☐ Sync schedules to calendar
        Zapier:           ☐ Connect for custom workflows
        Make.com:         ☐ Connect for custom workflows

  SECTION 7: BILLING & SUBSCRIPTION
    - Current plan: Pro ($29/mo)
    - Renews: 2026-11-15 (28 days remaining)
    - Payment method: •••• 4242 (Visa via Stripe)
    - Usage this cycle:
        Bots active:     4 / 10
        Connections:     1 / 2
        Schedules:       15 / 50
        Packages:        3 / 5
        Communications: 47 sent (no limit on Pro)
    - [Upgrade to Team ($79/mo)]  [Cancel Subscription]
    - Invoice history:
        2026-10-15  $29   Pro plan  ✓ paid  [Download PDF]
        2026-09-15  $29   Pro plan  ✓ paid  [Download PDF]
        2026-08-15  $29   Pro plan  ✓ paid  [Download PDF]

TANSTACK QUERY KEYS:
  ["user", "profile"]                    → useQuery
  ["deriv-connections"]                   → useQuery, refetchInterval 30s
  ["settings", "platform"]                → useQuery
  ["settings", "security"]                → useQuery
  ["settings", "notifications"]            → useQuery
  ["settings", "api-access"]              → useQuery
  ["settings", "billing"]                  → useQuery
  ["sessions", "active"]                    → useQuery, refetchInterval 60s
  ["integrations"]                          → useQuery

MUTATIONS:
  useUpdateProfile()           → PATCH /api/user/profile
  useChangePassword()          → POST /api/user/change-password
  useEnable2FA()              → POST /api/user/2fa/enable
  useDisable2FA()             → DELETE /api/user/2fa
  useReconfigure2FA()         → POST /api/user/2fa/reconfigure
  useRevokeSession()          → DELETE /api/sessions/:id
  useRevokeAllSessions()      → POST /api/sessions/revoke-all
  useUpdatePlatformConfig()   → PATCH /api/settings/platform
  useUpdateNotificationSettings() → PATCH /api/settings/notifications
  useAddDerivConnection()     → POST /api/connections  (triggers OAuth)
  useDisconnectDeriv()         → DELETE /api/connections/:id
  useRefreshDerivToken()      → POST /api/connections/:id/refresh
  useTestDerivConnection()    → POST /api/connections/:id/test
  useGenerateAPIKey()          → POST /api/user/api-keys
  useRevokeAPIKey()           → DELETE /api/user/api-keys/:id
  useUpgradePlan()            → POST /api/billing/upgrade
  useCancelSubscription()     → POST /api/billing/cancel

SAMPLE PROFILE UPDATE PAYLOAD:
{
  "fullName": "Jane Operator",
  "timezone": "Africa/Nairobi",
  "phone": "+254712345678",
  "bio": "Full-time Deriv bot operator since 2024. Specializing in synthetic volatility indices."
}

SAMPLE RESPONSE:
{
  "userId": "user_8f2a1c",
  "updatedAt": "2026-10-18T15:30:00Z"
}
```

---

## 7. INVESTOR DASHBOARD PAGES (12 PAGES) — MIRRORED IN investorMO.md

> The investor dashboard section is duplicated in a companion file `investorMO.md` with a full 1-to-1 page-to-stylesheet mapping. Both files share Section 2 (Global Styling System) verbatim. Every investor page below carries style rules, 5+ sections, sample data, TanStack Query keys, and mutation hooks.

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

6 SECTIONS:

  SECTION 1: WELCOME & EARNINGS SUMMARY
    - Personalized greeting: "Welcome back, Jane"
    - Investor since: 2026-09-12 (37 days)
    - 4 KPI cards (count-up):
      Total Invested:        $25,000 (2 packages)
      Active Pools:           2  (PKG-01, PKG-03)
      Earned This Month:      +$3,672  (+14.7% ROI)
      Wallet Balance:          $2,892 (available for withdrawal)

  SECTION 2: ACTIVE POOL STATUS
    - Per active pool card showing:
      Package name + code + status (TRADING)
      Goal/raised progress bar (with chart-draw animation)
      User's slots/investment + share %
      Trading time with countdown timer
      Current P&L (live, count-up)
      User's share of P&L + ROI
      AI Guardian status icon
      [View Details] [Live Trades]
    - Sample:
        PKG-01 "Basic Growth"  TRADING
        Goal: $50,000  Raised: $35,000  ███████░░░ 70%
        Your slots: 5 / Investment: $15,000 / Share: 30%
        Trading ends: 6d 4h 32m
        Current P&L: +$4,200  |  Your share: +$1,260 (+8.4%)
        AI Guardian: 🟢 Active
        [View Details] [Live Trades]
        ---
        PKG-03 "Aggressive Max"  TRADING
        Goal: $100,000  Raised: $90,000  █████████░ 90%
        Your slots: 1 / Investment: $10,000 / Share: 10%
        Trading ends: 12d 8h 14m
        Current P&L: +$13,500  |  Your share: +$1,350 (+13.5%)
        AI Guardian: 🟢 Active
        [View Details] [Live Trades]

  SECTION 3: EARNINGS TICKER
    - Per pool: profit, ROI, last updated
    - Auto-refresh every 3 minutes with countdown ring (icon-pulse)
    - [🔄 Refresh Now] button (force immediate refresh)
    - Sample:
        PKG-01  +$1,260  +8.4%  updated 1m ago
        PKG-03  +$1,350  +13.5% updated 1m ago
        Total:  +$2,610  +10.4% across 2 pools
        Next auto-refresh in: 1m 47s

  SECTION 4: UPCOMING POOLS
    - Pools opening soon with dates, min per slot
    - [Book Slot] [Set Reminder] per pool
    - Sample:
        PKG-04 "Quick Flip"  Opens 2026-10-25 09:00  Min $2,000  7-day duration  Exp ROI 10%
        PKG-05 "Basic Growth v2"  Opens 2026-10-28  Min $3,000  14-day  Exp ROI 15%
        [Book Slot] [Set Reminder]

  SECTION 5: RECENT ACTIVITY
    - Recent actions (last 10): trade wins/losses affecting your share, deposits, payouts, pool status changes
    - Each entry: timestamp, type icon, description, amount (if any)
    - Sample:
        14:23  ✓ Trade won on PKG-01  +$28  (your share: +$8.40)
        14:20  💎 Deposit confirmed  $3,000 (PKG-01)
        13:42  ⚠ AI Guardian triggered on PKG-02 (paused 5min)
        12:15  ✓ Trade won on PKG-03  +$56  (your share: +$5.60)
        09:00  📢 Announcement received: "Daily summary"
        2026-10-17 22:00  💸 Payout requested  $120  (status: processing)

  SECTION 6: QUICK ACTIONS
    - 4 action cards:
      [Book Slot]   → /investor/pools
      [View Earnings] → /investor/earnings
      [Request Payout] → /investor/wallet?action=payout
      [Calculator]    → /investor/calculator

TANSTACK QUERY KEYS:
  ["investor", "overview"]                       → useQuery, refetchInterval 60s
  ["investor", "active-pools"]                   → useQuery, refetchInterval 30s
  ["investor", "earnings-ticker"]                → useQuery, refetchInterval 180s (3 min)
  ["investor", "upcoming-pools"]                 → useQuery
  ["investor", "recent-activity", { limit: 10 }] → useQuery

SOCKET EVENTS (pushed):
  investor:earnings_update  → invalidate ["investor","earnings-ticker"] + update active pools P&L
  investor:trade_result     → push to recent activity + update earnings
  investor:pool_status       → update active pool status
  investor:payout_status     → push to recent activity

SAMPLE OVERVIEW PAYLOAD:
{
  "userName": "Jane Investor",
  "investorSince": "2026-09-12T00:00:00Z",
  "totalInvested": 25000.00,
  "activePools": 2,
  "earnedThisMonth": 3672.00,
  "earnedThisMonthROI": 14.7,
  "walletBalance": 2892.00,
  "nextEarningsRefreshIn": 107  // seconds
}
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

5 SECTIONS:

  SECTION 1: ACTIVE/TRADING POOLS
    - Pool card per active pool with:
      Goal/raised progress bar with chart-draw
      Your investment/share
      Trading countdown timer
      Current P&L, your earnings, ROI
      AI Guardian status icon
    - Sample:
        PKG-01 "Basic Growth"  TRADING
        Goal: $50,000  Raised: $35,000  ███████░░░ 70%
        Your slots: 5 / Investment: $15,000 / Share: 30%
        Trading ends: 6d 4h 32m
        Current P&L: +$4,200  |  Your share: +$1,260 (+8.4%)
        AI Guardian: 🟢 Active
        [View Details] [Live Trades]

  SECTION 2: OPEN POOLS (accepting bookings)
    - Pool card with:
      Opens/closes dates + countdown to close
      Your booked slots, payment status
      Min per slot, max slots per user
      Target capital, current raised, fill %
      [+ Book More Slots]
    - Sample:
        PKG-02 "Premium Yield"  OPEN  Closes in 2d 14h 18m
        Min slot: $5,000  Max slots/user: 10  Duration: 21d  Exp ROI: 18%
        Goal: $80,000  Raised: $28,000  ████░░░░░░ 35%
        Your booked slots: 2  Investment: $10,000  Payment: ✓ Verified
        [+ Book More Slots] [View Details]

  SECTION 3: UPCOMING POOLS
    - Future pools with dates, min per slot, expected ROI
    - [Set Reminder] [Pre-book Interest]
    - Sample:
        PKG-04 "Quick Flip"  Opens 2026-10-25 09:00
        Min slot: $2,000  Max slots/user: 25  Duration: 7d  Exp ROI: 10%
        [Set Reminder] [Pre-book Interest]
        ---
        PKG-05 "Basic Growth v2"  Opens 2026-10-28
        Min slot: $3,000  Duration: 14d  Exp ROI: 15%
        [Set Reminder] [Pre-book Interest]

  SECTION 4: COMPLETED POOLS
    - Past pools with final P&L, your earnings, payout status
    - Sample:
        PKG-00 "Genesis"  Completed 2026-10-10  (4d 8h ago)
        Your slots: 3  Investment: $9,000  Final ROI: +16.4%
        Gross earnings: +$1,476  Net (after 20% platform cut): +$1,181
        Payout: ✓ Completed (2026-10-11)
        [View Payout Details] [Download Statement PDF]

  SECTION 5: POOL ROADMAP
    - Visual timeline of all planned pools for next 90 days
    - Each milestone: pool name, target open date, target capital, exp ROI
    - Sample:
        2026-10-25  PKG-04 Quick Flip      Target: $40,000  Exp ROI: 10%
        2026-10-28  PKG-05 Basic Growth v2 Target: $50,000  Exp ROI: 15%
        2026-11-05  PKG-06 Premium+       Target: $100,000 Exp ROI: 18%
        2026-11-15  PKG-07 Holiday Boost  Target: $75,000  Exp ROI: 12%
        2026-11-30  PKG-08 Year-End Max   Target: $200,000 Exp ROI: 20%
        Token launch: 2026-12-15 (after PKG-08 completion)

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

5 SECTIONS:

  SECTION 1: POOL OVERVIEW
    - Pool name, code, status badge
    - Goal, raised, slots filled, dates with countdown timer
    - Trading period with elapsed progress bar
    - Sample:
        PKG-01 "Basic Growth"  TRADING
        Goal: $50,000  Raised: $35,000  Slots: 12/25 (filled 48%)
        Booking: 2026-09-29 → 2026-10-02 (closed)
        Trading: 2026-10-03 → 2026-10-17 (ends in 6d 4h 32m)
        Profit Share Date: 2026-10-18 12:00 UTC
        Trading elapsed: 57% ████████████░░░░░░░░░
        AI Guardian: 🟢 Active (max consec losses: 8, max drawdown: 5%)

  SECTION 2: YOUR INVESTMENT IN THIS POOL
    - Slots, investment, share %, token allocation
    - Live earnings with 3-min auto-refresh countdown
    - Daily earnings breakdown (last 14 days)
    - Sample:
        Slots: 5  Investment: $15,000  Share: 30%  Tokens: 150,000 bmX
        Current P&L: +$4,200  Your gross earnings: +$1,260
        Platform cut (20%): -$252
        Net earnings: +$1,008  ROI: +6.72%
        Last updated: 1m ago  Next refresh: 1m 47s
        [View Full Earnings] [Request Payout]
        Daily breakdown (last 14 days):
        2026-10-18: +$8.40 (your share)
        2026-10-17: +$7.20
        2026-10-16: +$5.40
        2026-10-15: +$9.60
        ...

  SECTION 3: POOL PERFORMANCE (numbers only)
    - 6 KPI cards (count-up):
      Total P&L:        +$4,200
      Win Rate:          63%  (265 wins / 423 trades)
      Total Trades:     423
      Max Drawdown:     -2.8% (occurred 2026-10-12)
      AI Guardian Triggers: 1 (recovered in 4h 18m)
      Avg Trade Duration: 18s

  SECTION 4: AI GUARDIAN STATUS
    - Status: 🟢 Active (all clear)
    - Settings:
        Max consec losses (odd/even): 8
        Per-package drawdown limit: 5%
        Random market rotation: ON
    - Recent triggers (last 7 days):
        2026-10-12 13:42  8 consec losses  → paused 5min  → resumed 13:47
        2026-10-10 11:15  3.2% drawdown    → continued (under limit)
    - Triggered history: 1 event in pool lifetime
    - [View Full Trigger History] → /investor/live

  SECTION 5: POOL PARTICIPANTS (anonymized)
    - Total participants: 12
    - Slots filled: 25 / 50 (50%)
    - Average investment: $2,917
    - Top participants by slots (anonymized, names like "User_A", "User_B"):
        Rank  Anon Name   Slots  Investment  Share
        1     User_A       5     $15,000     30%
        2     User_B       3     $9,000      18%
        3     User_C       2     $6,000      12%
        4     User_D       2     $6,000      12%
        5     User_E       2     $6,000      12%
        6-12  Other 7      11    $33,000     ... (avg $4,714)
    - Bar chart visualization of investment distribution (chart-draw)

TANSTACK QUERY KEYS:
  ["pools", poolId, "overview"]                      → useQuery, refetchInterval 30s
  ["pools", poolId, "my-investment"]                 → useQuery, refetchInterval 180s
  ["pools", poolId, "performance"]                   → useQuery, refetchInterval 60s
  ["pools", poolId, "ai-guardian"]                   → useQuery
  ["pools", poolId, "participants"]                 → useQuery

SOCKET EVENTS:
  investor:earnings_update → updates your investment + earnings
  investor:pool_status      → updates pool overview status
  investor:ai_guardian      → updates AI Guardian status card
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

5 SECTIONS:

  SECTION 1: POOL DETAILS
    - Pool name, code, status
    - Closes countdown timer (icon-pulse on <24h)
    - Min/max per slot, available slots
    - Your current bookings in this pool (if any)
    - Sample:
        PKG-02 "Premium Yield"  OPEN
        Closes in: 2d 14h 18m
        Min per slot: $5,000  Max slots/user: 10  Available: 17 slots
        Your current bookings: 2 slots ($10,000, verified)
        Target capital: $80,000  Raised: $28,000 (35%)
        Expected ROI: 18%  Duration: 21 days

  SECTION 2: SELECT SLOTS
    - Number picker with +/- buttons
    - Live calculated totals:
        Slots × $5,000 = $X investment
        Token allocation: X × 5,000 = Y bmX tokens
        Your share %: X × $5,000 / ($28,000 + X × $5,000) × 100
    - Current bookings + after this booking summary
    - Sample:
        Number of slots: [-] 3 [+]   (max 10 per user, 17 available)
        Investment: 3 × $5,000 = $15,000
        Token allocation: 3 × 5,000 = 15,000 bmX tokens
        Your share: $15,000 / $43,000 = 34.88%
        Current bookings: 2 slots  $10,000  (existing)
        After this booking: 5 slots  $25,000  (combined)

  SECTION 3: PAYMENT METHOD
    - Cards for each method (radio-style selection):
        💰 Wallet Balance         $2,892  (insufficient — needs $15,000)
        🏦 Bank Transfer          ACH, SEPA, SWIFT, Wire (1-3 days, $0 fee)
        📱 Mobile Money           MTN, Vodafone, M-Pesa, Airtel (instant-30min, 1.5% fee)
        💳 Card                   Visa, Mastercard via Stripe (instant, 2.9%+$0.30)
        ₿ Crypto                  BTC, ETH, USDT, USDC (15-60min, network fee)
    - Method-specific form (appears on selection):
        Bank Transfer form: Bank name, Account #, Routing, Account holder
        Mobile Money form:  Provider dropdown, Phone number, Confirm via SMS
        Card form:          Card #, Expiry, CVC, Name on card, ZIP
        Crypto form:        Currency dropdown, Wallet address, Network (ERC20/TRC20)

  SECTION 4: PAYMENT DETAILS & CONFIRM
    - Order summary:
        Slots: 3
        Investment: $15,000
        Token allocation: 15,000 bmX
        Payment method: Bank Transfer (ACH)
        Fee: $0 (free)
        Total due: $15,000
    - Bank transfer instructions (if applicable):
        Bank: DerivX Escrow Account
        Account #: 1234567890
        Routing: 021000021
        Reference: BOOK-PKG02-user_8f2a-1701  (MUST include this)
    - Terms checkboxes:
        ☐ I have read and agree to the [Pool Terms PDF]
        ☐ I understand investment is locked for 21 days (early exit penalty: 10%)
        ☐ I confirm funds source declared in KYC matches
    - [Confirm Booking] → POST /api/investments (creates pending payment)

  SECTION 5: PAYMENT STATUS TRACKER
    - Step progress: Created → Instructions → Received → Verified → Confirmed
    - Each step: status icon (✓/⟳/◯), timestamp, notes
    - Sample:
        ✓ Created             14:20  Booking created (booking ID: inv_8f2a)
        ✓ Instructions Sent    14:20  Bank transfer instructions displayed
        ⟳ Received (pending)  -      Awaiting your bank transfer (ref: BOOK-PKG02-...)
        ◯ Verified            -      Operator will verify receipt (avg 2h 30m)
        ◯ Confirmed           -      Investment locked, slots reserved
    - 72-hour reservation window notice:
        "Your slots are reserved for 72 hours. If payment not received
         by 2026-10-21 14:20 UTC, booking will be auto-cancelled."
    - If payment received (verified by operator):
        ✓ Created             14:20
        ✓ Instructions Sent    14:20
        ✓ Received            16:48  Operator confirmed receipt
        ✓ Verified            16:50  Booking verified
        ✓ Confirmed           16:50  Investment locked, slots reserved
        [View Investment] [Back to Pools]

TANSTACK QUERY KEYS:
  ["pools", poolId, "booking-context"]        → useQuery
  ["investments", "my-bookings", poolId]      → useQuery
  ["investments", bookingId, "status"]         → useQuery, refetchInterval 30s (if pending)

MUTATIONS:
  useCreateBooking() → POST /api/investments
  useCancelBooking() → DELETE /api/investments/:id  (allowed only before verified)

SAMPLE BOOKING PAYLOAD (POST /api/investments):
{
  "poolId": "pkg_02",
  "slots": 3,
  "paymentMethod": "bank_transfer",
  "paymentDetails": {
    "bankName": "Bank of Africa",
    "accountNumber": "0011223344",
    "routingNumber": "021000021",
    "accountHolder": "Jane Investor"
  },
  "termsAccepted": true
}

SAMPLE RESPONSE (201 Created):
{
  "investmentId": "inv_8f2a",
  "poolId": "pkg_02",
  "slots": 3,
  "amount": 15000.00,
  "paymentStatus": "pending",
  "paymentInstructions": {
    "method": "bank_transfer",
    "bankName": "DerivX Escrow Account",
    "accountNumber": "1234567890",
    "routingNumber": "021000021",
    "reference": "BOOK-PKG02-user_8f2a-1701"
  },
  "reservationExpiresAt": "2026-10-21T14:20:00Z"
}
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

5 SECTIONS:

  SECTION 1: LIVE RUNNING TOTALS
    - 6 KPI cards (all count-up on update):
        Running Capital:    $25,000  (your active investment)
        Current P&L:        +$2,610  (across 2 pools)
        Pool ROI:            +10.4%
        Your Share of P&L:  +$2,610  (after platform cut)
        Trades Executed:    47  (since you started watching)
        Last trade time:    14:23:47 (icon-pulse)

  SECTION 2: LIVE TRADE FEED (scrolling, newest first, virtualized)
    - Each entry: result icon (✅/❌), symbol, contract type, stake, payout, P&L
    - Entry/exit spots, timestamp
    - Your share impact highlighted
    - New entries: slide-in-from-top + row-flash-win/row-flash-loss (800ms)
    - Sample:
        ✅ WIN   R_10   Rise 5t   $35 → $63   +$28   your share: +$8.40   14:23:47
        ✅ WIN   R_75   Even      $35 → $63   +$28   your share: +$2.80   14:23:31
        ❌ LOSS  R_10   Rise 5t   $35 → $0   -$35   your share: -$10.50  14:23:15
        ✅ WIN   R_100  Odd       $70 → $126  +$56   your share: +$5.60   14:22:58

  SECTION 3: LIVE NUMBER TICKERS
    - All symbols in your pools with streaming prices and direction arrows
    - Tick timing shown
    - Sample:
        R_10    4532.11  ▲ +0.04%  1 tick/s   (in PKG-01, PKG-03)
        R_75    2451.18  ▼ -0.03%  1 tick/s   (in PKG-03)
        R_100   5621.83  ▲ +0.11%  1 tick/s   (in PKG-03)

  SECTION 4: SESSION STATISTICS
    - Today's: trades/wins/losses, P&L, best/worst trade, streaks
    - Sample:
        Today's trades:    47
        Wins / Losses:     31 / 16 (62% win)
        P&L today:         +$133
        Your share P&L:    +$39.90
        Best trade:        +$8.40 (your share of R_100 Odd win)
        Worst trade:       -$10.50 (your share of R_10 Rise 5t loss)
        Longest streak:    5 wins
        Avg trade duration: 18s

  SECTION 5: ACTIVE BOTS IN POOL
    - Each bot: name, symbol, trades, win rate, current stake, P&L
    - AI Guardian pause indicator
    - Sample:
        Bot-Alpha      🟢 running  R_10   12 trades  75%  $35  +$84  (in your pool PKG-01)
        Bot-Charlie    🟡 paused   R_100  6 trades   50%  $70  +$0  (cooldown 4m left)
        Bot-Bravo      🟢 running  R_75   8 trades   62%  $35  +$28 (in your pool PKG-03)

TANSTACK QUERY KEYS:
  ["investor", "live-totals"]         → useQuery, refetchInterval 5s
  ["investor", "session-stats"]        → useQuery, refetchInterval 30s
  ["investor", "active-bots"]         → useQuery, refetchInterval 30s

SOCKET EVENTS (pushed, partial updates):
  investor:trade_result   → push to live feed + update running totals + session stats
  investor:tick_update    → update tick prices tile
  investor:ai_guardian    → update bot status + push alert
  investor:earnings_update → update your share of P&L

SAMPLE LIVE TRADE PAYLOAD (via socket):
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

5 SECTIONS:

  SECTION 1: INVESTMENT SUMMARY
    - 6 KPI cards (count-up):
      Total Invested:          $25,000
      Active Investments:      $25,000 (2 pools)
      Total Earned:            +$3,672
      Completed Investments:   1 (PKG-00 Genesis, +$1,181 net)
      Pending Payouts:         $120 (1 pending)
      Overall ROI:              +14.7%

  SECTION 2: ACTIVE INVESTMENTS
    - Per pool card:
      Slots, investment, share %, payment status/method
      Current value (investment + current P&L share)
      Earnings (gross, platform cut, net), ROI
      Status, time remaining
      [View Pool] [Live Trades] [Request Payout] (if eligible)
    - Sample:
        PKG-01 "Basic Growth"  TRADING
        Slots: 5 / Investment: $15,000 / Share: 30%
        Payment: ✓ Verified (Bank Transfer, 2026-10-02)
        Current value: $16,260  (your share +$1,260 net)
        Gross earnings: +$1,260  Platform cut: -$252  Net: +$1,008
        ROI: +6.72%  Time remaining: 6d 4h 32m
        [View Pool] [Live Trades]
        ---
        PKG-03 "Aggressive Max"  TRADING
        Slots: 1 / Investment: $10,000 / Share: 10%
        Payment: ✓ Verified (Crypto USDT, 2026-10-05)
        Current value: $11,350  (your share +$1,350 net)
        Gross: +$1,350  Cut: -$270  Net: +$1,080
        ROI: +13.5%  Time remaining: 12d 8h 14m
        [View Pool] [Live Trades]

  SECTION 3: COMPLETED INVESTMENTS
    - Past pools with final P&L, earnings, payout status
    - Sample:
        PKG-00 "Genesis"  Completed 2026-10-10
        Slots: 3 / Investment: $9,000 / Share: 15.5%
        Final P&L: +$9,545  Your gross: +$1,476  Net: +$1,181
        Final ROI: +13.12% (over 14 days)
        Payout: ✓ Completed 2026-10-11 ($1,181 to bank)
        [Download Statement PDF] [View Payout Details]

  SECTION 4: BOOKED SLOTS (upcoming pools)
    - Booked but not yet trading (payment pending/confirmed)
    - Sample:
        PKG-02 "Premium Yield"  OPEN (closes 2d 14h)
        Booked: 2 slots  $10,000  Payment: ✓ Verified
        Trading starts: 2026-10-29 09:00 UTC
        [Add More Slots] [View Booking]
        ---
        PKG-04 "Quick Flip"  SCHEDULED (opens 2026-10-25)
        Pre-booked interest: 3 slots  $6,000 (placeholder, no payment yet)
        Booking opens: 2026-10-25 09:00  → you'll be notified
        [Cancel Interest] [Set Reminder]

  SECTION 5: INVESTMENT TIMELINE
    - Chronological history of all investment actions (deposits, bookings, trades, payouts)
    - Sample (last 10):
        2026-10-18 14:23  Trade won +$8.40 (your share, PKG-01)
        2026-10-17 22:00  Payout requested $120 (PKG-00 earnings, processing)
        2026-10-15 09:00  Pool PKG-01 trading started
        2026-10-05 11:08  Booking confirmed PKG-03 (1 slot, $10,000 USDT)
        2026-10-02 14:20  Booking confirmed PKG-01 (5 slots, $15,000 bank)
        2026-10-01 09:00  Pre-booked interest PKG-04
        2026-09-29 09:00  Pool PKG-01 opened for booking
        2026-09-12 10:30  Account created, role: investor
        2026-09-12 10:35  KYC submitted
        2026-09-12 14:00  KYC approved (level 2)

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

5 SECTIONS:

  SECTION 1: WALLET OVERVIEW
    - 4 KPI cards (count-up):
      Available Balance:        $2,892
      Locked In Pools:         $25,000 (2 active investments)
      Pending Payout:          $120 (1 request processing)
      Total Account Value:    $27,892 (locked + available)
    - Lifetime summary:
      Total Deposited:         $25,120 (over 6 deposits)
      Total Earned:           $3,672 (from 1 completed + 2 active)
      Total Withdrawn:        $1,181 (1 completed payout)
    - [Deposit Funds] [Request Payout] quick action buttons

  SECTION 2: DEPOSIT FUNDS
    - Amount input with quick buttons ($1k, $3k, $5k, $10k, Custom)
    - Payment method selection (radio cards):
      🏦 Bank Transfer        (ACH/SEPA, 1-3 days, $0 fee)
      📱 Mobile Money         (MTN/Vodafone/M-Pesa/Airtel, instant-30min, 1.5% fee)
      💳 Card                 (Visa/Mastercard via Stripe, instant, 2.9%+$0.30)
      ₿ Crypto                (BTC/ETH/USDT/USDC, 15-60min, network fee)
      💵 Stablecoins          (USDT/USDC on ERC20/TRC20, 15-30min, network fee)
    - Method-specific form (dynamic based on selection)
    - Fee preview: e.g. "$5,000 via Card → fee $145.30, total $5,145.30"
    - [Confirm Deposit] → POST /api/wallet/deposit

  SECTION 3: REQUEST PAYOUT
    - Available for withdrawal: $2,892
    - Minimum payout: $50  Maximum per request: $10,000
    - Processing time: 1-3 business days (bank), instant-30min (mobile), 15-60min (crypto)
    - Amount input
    - Method selection (default = saved default method)
    - Fee display
    - [Request Payout] → POST /api/wallet/payout
    - Recent payouts (last 5):
        2026-10-17 22:00  $120  bank_transfer  processing  ref:pay_8f2a
        2026-10-11 14:30  $1,181 bank_transfer  completed  ref:pay_b3c1
        2026-09-25 10:15  $50   mobile_money   completed  ref:pay_d4e2

  SECTION 4: TRANSACTION HISTORY (TanStack Table)
    - Columns: Date, Type, Amount, Method, Status, Reference, Balance After
    - Filterable by type (deposit/payout/earning/fee/refund), method, date range
    - Export [CSV] [PDF]
    - Sample rows:
        2026-10-17 22:00  payout     -$120   bank_transfer  processing  pay_8f2a     $2,772
        2026-10-11 14:30  payout     -$1,181 bank_transfer  completed   pay_b3c1     $2,892
        2026-10-10 12:00  earning   +$1,181 internal        completed   inv_pkg00    $4,073
        2026-10-05 11:08  deposit    +$10,000 crypto_usdt    verified   dep_d4e2     $2,892
        2026-10-02 14:20  deposit    +$15,000 bank_transfer  verified   dep_8f2a     $2,892

  SECTION 5: SAVED PAYMENT METHODS
    - List of saved methods with default indicator
    - Per method: type, label, masked details, verified status, default star
    - [Remove] [+ Add Payment Method] [Set Default]
    - Sample:
        ⭐ Bank Account — BofA ••••1234 (verified) [Default]  [Remove]
        Mobile Money — MTN +256•••42 (verified)  [Remove]
        Crypto Wallet — USDT TRC20 0xabc... (verified)  [Remove]
        [+ Add Payment Method]

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

SAMPLE DEPOSIT PAYLOAD (POST /api/wallet/deposit):
{
  "amount": 5000.00,
  "method": "card",
  "methodDetails": {
    "cardNumber": "4242••••••••4242",
    "expiry": "12/27",
    "cvc": "•••",
    "nameOnCard": "Jane Investor",
    "zip": "00100"
  }
}

SAMPLE RESPONSE (201 Created):
{
  "depositId": "dep_x9y0",
  "amount": 5000.00,
  "fee": 145.30,
  "totalDue": 5145.30,
  "method": "card",
  "status": "processing",
  "providerReference": "stripe_pi_x9y0z1",
  "estimatedCompletion": "2026-10-18T14:35:00Z"
}
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

5 SECTIONS:

  SECTION 1: ROI CALCULATOR
    - Inputs:
        Investment amount: $3,000 (slider $500-$50,000)
        Number of slots:   1 (auto-calc from investment / slot price)
        Expected ROI:      15% (slider 5%-30%)
        Duration:          14 days (slider 7-30 days)
    - Results (live count-up):
        Projected gross earnings:  $450.00  ($3,000 × 15%)
        Platform cut (20%):       -$90.00
        Projected net earnings:   $360.00
        Total return:             $3,360.00  (investment + net)
        Daily average net:        $25.71
        Effective APY:            ≈ 313% (annualized)

  SECTION 2: COMPOUND GROWTH CALCULATOR
    - Inputs:
        Initial investment: $3,000
        Per-pool ROI:        15% (slider)
        Number of pools:     6 (slider 1-12)
        Reinvest policy:     ☑ Reinvest net earnings after each pool
    - Compound growth table:
        Pool #  Start Balance  ROI   Net Earnings  End Balance
        1       $3,000         15%   $360          $3,360
        2       $3,360         15%   $403.20       $3,763.20
        3       $3,763.20      15%   $451.58       $4,214.78
        4       $4,214.78      15%   $505.77       $4,720.55
        5       $4,720.55      15%   $560.47       $5,281.02
        6       $5,281.02      15%   $633.72       $5,914.74
        Total: $5,914.74 (+97.2%)
    - Line chart visualization of growth (chart-draw on input change)

  SECTION 3: FEE CALCULATOR
    - Inputs:
        Investment amount: $3,000
        Payment method (deposit): Bank Transfer ($0 fee)
        Platform profit share: 20% (default for PKG-01)
        Payout method: Bank Transfer ($0 fee)
    - Results:
        Deposit fee:        $0
        Platform share:    $90 (if ROI 15% → $450 gross × 20%)
        Payout fee:         $0
        Total fees:         $90
        Net earnings after all fees: $360 (=$450-$90)

  SECTION 4: SCENARIO COMPARISON
    - Table comparing 1/2/3 slots at conservative/expected/optimistic ROI
    - Columns: Slots, Investment, Conservative ROI, Expected ROI, Optimistic ROI
    - Sample (PKG-01, 14 days, 8/15/25 ROI, 20% platform cut):
        1 slot  $3,000  Cons: $192  Exp: $360  Opt: $600
        2 slots $6,000  Cons: $384  Exp: $720  Opt: $1,200
        3 slots $9,000  Cons: $576  Exp: $1,080 Opt: $1,800
    - Click a scenario → opens booking flow with pre-filled slots

  SECTION 5: HISTORICAL POOL PERFORMANCE
    - Past pool results for reference (last 10 completed pools)
    - Average/Best/Worst ROI with disclaimer
    - Sample:
        Past 10 PKG-01-style pools (Basic Growth, 14-day, R_10/R_75):
        Average ROI: 14.2%
        Best ROI:    21.8% (PKG-GenesisPlus, 2026-09-01)
        Worst ROI:    8.5% (PKG-Starter2, 2026-08-15)
        Median:      13.7%
        Win rate range: 58-67% across pools
    - Bar chart of past pool ROIs (chart-draw)
    - Disclaimer:
        "Past performance is not indicative of future results.
         Trading involves risk. Only invest what you can afford to lose."

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

5 SECTIONS:

  SECTION 1: UNREAD NOTIFICATIONS
    - Top of page, badge count
    - Sample (last 5 unread):
        🔔 14:23  Trade won +$8.40 on PKG-01  [Mark Read] [View Pool]
        🔔 14:20  Deposit confirmed $3,000 on PKG-01  [Mark Read]
        🔔 13:42  ⚠ AI Guardian paused PKG-02 (5 min)  [Mark Read] [View Details]
        🔔 09:00  📢 Daily summary: Your investments earned +$39.90 today  [Mark Read]
        🔔 2026-10-17 22:00  Payout processing: $120 (bank_transfer)  [Mark Read]
    - [Mark All Read]

  SECTION 2: TRADE ACTIVITY
    - All trade-related events affecting your share (wins/losses, payouts)
    - TanStack Table: Date, Pool, Symbol, Result, Your Share Impact, Time
    - Filter by date range, pool, result
    - Sample rows:
        2026-10-18 14:23  PKG-01  R_10   ✅ WIN   +$8.40
        2026-10-18 14:21  PKG-03  R_75   ✅ WIN   +$2.80
        2026-10-18 14:18  PKG-01  R_10   ❌ LOSS  -$10.50
        2026-10-18 14:15  PKG-03  R_100  ✅ WIN   +$5.60

  SECTION 3: POOL UPDATES
    - Pool status changes, AI Guardian events, completion notices
    - Sample:
        2026-10-17 13:42  ⚠ AI Guardian triggered on PKG-02 (paused 5min, resumed)
        2026-10-15 09:00  📢 PKG-01 trading started
        2026-10-10 12:00  ✓ PKG-00 completed, earnings $1,181 credited
        2026-10-05 11:08  ✓ PKG-03 booking confirmed

  SECTION 4: PAYMENT & PAYOUT ALERTS
    - Deposit verifications, payout status changes, fee deductions
    - Sample:
        2026-10-17 22:00  💸 Payout requested: $120 (bank_transfer)
        2026-10-11 14:30  ✓ Payout completed: $1,181 (bank_transfer)
        2026-10-05 11:08  ✓ Deposit verified: $10,000 (crypto_usdt)
        2026-10-02 14:20  ✓ Deposit verified: $15,000 (bank_transfer)

  SECTION 5: SYSTEM & SECURITY
    - Login alerts, 2FA challenges, password changes, account updates
    - Sample:
        2026-10-18 13:55  ✓ Login successful from 41.•••.•• (Chrome, 2FA passed)
        2026-10-17 22:00  ✓ Payout request submitted
        2026-10-12 10:30  ✓ Profile updated (phone number changed)
        2026-09-12 14:00  ✓ KYC approved (Level 2)

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

5 SECTIONS:

  SECTION 1: REFERRAL PROGRAM
    - Referral code (display + copy button): JANE-X9F2
    - Referral link: https://app.derivx.com/r/JANE-X9F2
    - Share buttons: [Copy Link] [WhatsApp] [Telegram] [Twitter] [Email]
    - Reward structure (display):
        Referee signs up:        $5 bonus credit (your wallet)
        Referee first deposit:    $10 bonus credit (your wallet)
        Referee first investment: $25 bonus credit (your wallet)
        Referee stays 30+ days:   $50 bonus credit (your wallet)
        Maximum per referral:     $90
    - Stats:
        Total referrals:           8
        Qualified (invested):       5
        Pending (signed up, not invested): 2
        Lapsed (no activity 30+ days): 1
        Total earned from referrals: $215

  SECTION 2: DAILY STREAKS
    - Current streak: 12 days (count-up)
    - Best streak:    18 days
    - Weekly calendar (7 cells, filled/empty):
        Mon ✓  Tue ✓  Wed ✓  Thu ✓  Fri ✓  Sat ✓  Sun ✓ (today)
        Streak bonus unlocked: +$2/day after 7 days
    - Tier rewards:
        7-day streak:   +$10 bonus
        14-day streak:  +$25 bonus
        30-day streak:  +$100 bonus
    - How to maintain: log in daily, view dashboard at least once
    - [Claim Today's Bonus] (if eligible)

  SECTION 3: AVAILABLE REWARDS
    - Claimable rewards with [Claim] buttons
    - Sample:
        Referral bonus (5 referrals completed)  $90    [Claim]
        14-day streak bonus                      $25    [Claim]
        Early-bird bonus (PKG-04 pre-book)      $10    [Claim]
        Birthday bonus (Oct 25)                  $20    [Claim on Oct 25]
    - Total claimable: $125

  SECTION 4: REFERRAL LEADERBOARD
    - Top 10 referrers this month (anonymized for non-top 3)
    - Sample:
        Rank 1  user_8f2a  18 referrals  $1,620 earned
        Rank 2  user_b3c1  12 referrals  $1,080 earned
        Rank 3  user_d4e2  10 referrals  $900 earned
        Rank 4  User_E    8 referrals   $720 earned
        Rank 5  User_F    7 referrals   $630 earned
        ...
        Rank 12 You       5 referrals   $215 earned  ⭐ You are here
    - Resets monthly; top 3 get bonus at month end

  SECTION 5: REWARD HISTORY
    - Past claimed rewards with timestamps
    - Sample:
        2026-10-10  PKG-00 completion bonus  $25   claimed
        2026-09-25  Referral bonus (user_x9y0 invested)  $25   claimed
        2026-09-15  30-day streak bonus  $100   claimed
        2026-09-12  Welcome bonus  $5   claimed

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

5 SECTIONS:

  SECTION 1: EARNINGS OVERVIEW
    - 6 KPI cards (count-up):
      Total earned (lifetime):     $3,672
      This month:                   $2,610 (71% of lifetime)
      Avg per pool:                 $1,836 (across 2 pools)
      Best pool:                    PKG-03 (+$1,350 net)
      Worst pool:                   PKG-01 (+$1,260 net)
      Avg ROI:                      +14.7% (across all investments)

  SECTION 2: EARNINGS BY POOL
    - Per-pool breakdown with period detail
    - Sample:
        PKG-01 "Basic Growth" (in progress, 8d 4h remaining)
          Investment: $15,000  Gross: +$1,260  Cut: -$252  Net: +$1,008
          ROI: +6.72%  Days elapsed: 8 of 14
          Daily avg net: +$126/day
        ---
        PKG-03 "Aggressive Max" (in progress, 12d 8h remaining)
          Investment: $10,000  Gross: +$1,350  Cut: -$270  Net: +$1,080
          ROI: +13.5%  Days elapsed: 17 of 30
          Daily avg net: +$63.5/day
        ---
        PKG-00 "Genesis" (completed 2026-10-10)
          Investment: $9,000  Gross: +$1,476  Cut: -$295  Net: +$1,181
          Final ROI: +13.12% over 14 days

  SECTION 3: EARNINGS TIMELINE
    - Chronological with running total
    - Sample (last 14 days, daily aggregates):
        2026-10-18  +$16.80  running: $3,672
        2026-10-17  +$22.40  running: $3,655.20
        2026-10-16  +$18.20  running: $3,632.80
        2026-10-15  +$25.50  running: $3,614.60
        2026-10-14  +$28.00  running: $3,589.10
        ...
    - [Export CSV] [Export PDF]

  SECTION 4: TAX REPORT INFORMATION
    - Year-to-date:
        Gross earnings:   $4,820 (across all pools)
        Gross losses:     -$1,148 (lost trade shares)
        Net profit:        $3,672
        Platform fees paid: $817 (20% cut)
        Withdrawn:         $1,181
        Currently locked:  $2,610 (in active pools)
    - Tax form compatibility (per jurisdiction):
        US Form 1099-MISC / 1099-K ready
        UK Self Assessment ready
        KE KRA IT1 ready (Kenya)
        ZA ITR12 ready (South Africa)
    - [Download PDF Tax Report] → generates PDF with all transactions
    - [Download CSV Tax Data] → CSV for accountant import
    - Disclaimer: "DerivX does not provide tax advice. Consult a tax professional."

  SECTION 5: PROFIT SHARING BREAKDOWN
    - How earnings are calculated (formula explanation)
    - Visual flow:
        Pool P&L (Deriv API)
            ↓ × (Your Investment / Pool Capital)
        Your gross share
            ↓ × (1 - Platform Cut %)
        Your net earnings
    - Sample calculation (PKG-01):
        Pool P&L:                     +$4,200
        Your investment:               $15,000 / Pool capital $50,000 = 30%
        Your gross earnings:           $4,200 × 0.30 = $1,260
        Platform cut (20%):            $1,260 × 0.20 = $252
        Your net earnings:             $1,260 - $252 = $1,008
        Your ROI:                       $1,008 / $15,000 × 100 = +6.72%
    - Auto-calc frequency: every 3 minutes (or manual refresh)

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

5 SECTIONS:

  SECTION 1: PROFILE (with role switch option)
    - Avatar upload (with crop + preview)
    - Full Name: Jane Investor
    - Email (read-only): jane@inv.io
    - Username (read-only): jane_investor
    - Role: investor (badge)
    - [Become Operator Too] button → switches user.role to "both" (after onboarding)
    - Timezone: Africa/Nairobi (dropdown)
    - Phone: +254 712 345 678 (with country picker)
    - Bio (max 500 chars)
    - Risk tolerance: Conservative | Moderate | Aggressive (radio)
    - Investment preferences (multi-select):
        ☑ R_10 Synthetics  ☑ R_75 Synthetics  ☐ Forex  ☐ Crypto
    - [Save Profile]

  SECTION 2: SECURITY (password, 2FA, sessions)
    - Change Password (current, new, confirm)
    - Two-Factor Authentication:
        Status: ✓ Enabled (authenticator app)
        [View Backup Codes]  [Disable 2FA]  [Reconfigure]
    - Session timeout: 30 minutes (dropdown)
    - Active sessions (with revoke):
        Session 1: 41.•••.•••  Chrome  2h ago  [Revoke]
        Session 2: 41.•••.•••  Mobile 1d ago  [Revoke]
    - [Revoke All Sessions]

  SECTION 3: NOTIFICATION PREFERENCES
    - Channels (per investor, simpler than operator):
        Email: ☑ jane@inv.io
        Push:  ☑ enabled (PWA)
        SMS:   ☐ +254 712 345 678 (disabled, premium feature)
    - Event toggles:
        Event                   Email  Push  SMS
        Trade wins (your share)  ☑      ☑    ☐
        Trade losses (your share) ☑      ☐    ☐
        Pool status changes       ☑      ☑    ☐
        AI Guardian alerts        ☑      ☑    ☐
        Deposit verified          ☑      ☐    ☐
        Payout completed          ☑      ☑    ☐
        Weekly earnings summary   ☑      ☐    ☐
        Referral bonuses          ☑      ☐    ☐
        Daily streak reminder     ☐      ☑    ☐
        Marketing/newsletter      ☐      ☐    ☐
    - [Save Notification Settings]

  SECTION 4: PAYOUT PREFERENCES
    - Default payout method: Bank Transfer (radio cards)
        ⭐ Bank Account — BofA ••••1234 (default)  [Set Default]
        Mobile Money — MTN +256•••42  [Set Default]
        Crypto Wallet — USDT 0xabc...  [Set Default]
    - Auto-payout rules:
        ☐ Auto-payout when wallet balance >= $1,000
        Threshold: $1,000 (slider $500-$10,000) — only enabled if auto-payout toggled
        ☐ Auto-payout on pool completion (when earnings credited)
    - Auto-reinvest option:
        ☐ Auto-reinvest net earnings into next available pool
        Reinvest %: 100% (slider 0-100%)
    - [Save Payout Preferences]

  SECTION 5: KYC / VERIFICATION STATUS
    - Current level: 2 (verified)
    - Level badges:
        ✓ Level 1: Email + phone verified
        ✓ Level 2: ID document + selfie + proof of address verified
        ☐ Level 3: Source of funds + enhanced due diligence (required for $50k+ deposits)
    - Deposit limits per level:
        Level 1: $1,000 / tx, $5,000 / day, $50,000 / month
        Level 2: $5,000 / tx, $25,000 / day, $250,000 / month  (current)
        Level 3: $50,000 / tx, $250,000 / day, $2,500,000 / month
    - Submitted documents (read-only, re-upload allowed):
        ID Front:  passport-front.jpg  uploaded 2026-09-12  ✓ verified
        Selfie:     selfie.mp4          uploaded 2026-09-12  ✓ verified
        Proof of Address: utility-bill.pdf uploaded 2026-09-12 ✓ verified
    - [Upgrade to Level 3] → opens form for source of funds declaration + enhanced due diligence
    - [View KYC History] → modal with all submissions + review status changes

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

SAMPLE PROFILE UPDATE PAYLOAD:
{
  "fullName": "Jane Investor",
  "timezone": "Africa/Nairobi",
  "phone": "+254712345678",
  "bio": "Long-term investor focused on synthetic volatility pools.",
  "riskTolerance": "moderate",
  "investmentPreferences": ["R_10", "R_75"]
}

SAMPLE RESPONSE:
{
  "userId": "user_8f2a1c",
  "updatedAt": "2026-10-18T15:45:00Z"
}
```

---

## 8. SHARED COMPONENTS

```
LAYOUT (always-mounted, app-shell.css):
  ├── Sidebar          — navigation, Deriv status, user info (offcanvas on mobile)
  ├── TopBar           — search, notifications, user menu (sticky, collapse-on-scroll)
  ├── PageWrapper      — consistent padding, max-width, breadcrumb
  └── MobileNav        — bottom navigation for mobile (5 main destinations)

DATA DISPLAY (shared/components CSS, loaded at app root):
  ├── StatCard         — value + label + trend indicator + count-up
  ├── DataTable        — TanStack Table wrapper (sort/filter/page)
  ├── ChartWrapper     — Recharts/LightweightCharts wrapper (chart-draw on mount)
  ├── LivePrice       — real-time price with direction arrow + shimmer
  ├── PnLBadge        — green/red P&L display with sign
  ├── StatusIndicator — 🟢🟡🔴 status dot + text + icon-pulse
  ├── CountdownTimer  — live countdown (days, hours, minutes, seconds)
  ├── ProgressFillBar — percentage fill with label + chart-draw animation
  └── TimeAgo         — relative time display

TRADE-SPECIFIC:
  ├── SymbolSelector   — market/symbol dropdown with search + tick preview
  ├── ContractTypeSelect — contract type dropdown
  ├── StakeInput       — stake with quick buttons + balance check
  ├── DurationInput    — ticks/seconds/minutes input
  └── TradeResult      — win/loss display with animation

PACKAGE-SPECIFIC:
  ├── PackageCard      — package summary for lists + hover-lift
  ├── PackageStatusBadge — open/trading/completed with chart-draw fill
  ├── InvestmentCard   — investor's investment in a package
  └── EarningsDisplay  — live earnings with auto-refresh + count-up

INVESTOR-SPECIFIC:
  ├── InvestorCard     — user profile card with stats
  ├── KYCStatusBadge  — verification level indicator (L1/L2/L3)
  ├── DepositStatusBadge — pending/verified/failed
  └── PayoutStatusBadge — pending/processing/completed

MODALS:
  ├── ConfirmModal     — "Are you sure?" with custom message
  ├── TradeModal       — quick trade placement
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
  ├── ResponsiveTable  — auto-collapses to stacked cards on mobile
  ├── OffcanvasSidebar — mobile sidebar with backdrop dismissal
  └── StickyFooter     — sticky action bar at bottom of long forms
```

---

## 9. STATE MANAGEMENT

### 9.1 Zustand Stores (Client State)

```
useAuthStore:
  ├── user: User | null
  ├── isAuthenticated: boolean
  ├── role: "operator" | "investor" | "both"
  ├── login, logout, refreshToken, updateUser

useDerivStore:
  ├── connections: DerivConnection[]
  ├── activeConnectionId: string | null
  ├── websockets: Map<connectionId, WebSocket>
  ├── balance, isConnected
  ├── connect, disconnect, subscribe, unsubscribe, send

useMarketStore:
  ├── symbols: Symbol[]
  ├── favorites: string[]
  ├── tickSubscriptions: Map<symbol, tickData>
  ├── activeSymbols, toggleFavorite, getSymbol

useBotStore:
  ├── bots: Bot[]
  ├── activeBots: Bot[]
  ├── fetchBots, startBot, pauseBot, stopBot, deleteBot

useTradeStore:
  ├── openContracts: Contract[]
  ├── recentTrades: Trade[]
  ├── proposals: Map<key, Proposal>
  ├── buy, sell, subscribeOpenContracts

usePackageStore:
  ├── packages: Package[]
  ├── activePackages: Package[]
  ├── fetchPackages, createPackage, updatePackage
  ├── getPackageInvestors, getPackagePerformance

useInvestorStore:
  ├── investors: Investor[]
  ├── fetchInvestors, getInvestorDetail
  ├── approveKYC, rejectKYC

useScheduleStore:
  ├── schedules: ScheduledTrade[]
  ├── todaySchedule: ScheduledTrade[]
  ├── fetchSchedules, createSchedule, updateSchedule, deleteSchedule

useFundsStore:
  ├── totalCapital, deployedCapital, availableCapital
  ├── deposits: Deposit[]
  ├── payouts: PayoutRequest[]
  ├── fetchDeposits, verifyDeposit, rejectDeposit
  ├── fetchPayouts, approvePayout, rejectPayout

useUIStore:
  ├── sidebarOpen, theme, notifications, activeModal
  ├── mountedStylesheets: Set<string>  // tracks page-scoped CSS lifecycle
  ├── mountStyle(key, href), unmountStyle(key)
```

### 9.2 TanStack Query Keys

```
QUERY KEYS (canonical, used by every page section above):
  ["user"]                          → current user
  ["packages"]                       → all packages
  ["packages", id]                   → single package
  ["packages", id, "investors"]      → package investors
  ["packages", id, "performance"]    → package analytics
  ["investors"]                       → all investors
  ["investors", id]                   → single investor
  ["schedules"]                       → trade schedules
  ["trades", { page, filters }]       → trade log
  ["trades", "summary", { filters }]  → trade summary
  ["deposits", { page, filters }]     → deposit records
  ["payouts", { status, page }]        → payout requests
  ["funds", "overview"]                → funds overview
  ["analytics", { period, view }]     → analytics data
  ["logs", { category, page, filters }] → audit logs
  ["wallet", "overview"]                → wallet balance
  ["wallet", "transactions", { page }]  → wallet transactions
  ["notifications", "unread"]           → unread notifications

MUTATIONS:
  useCreatePackage()          → POST /api/packages
  useUpdatePackage()          → PATCH /api/packages/:id
  useCreateSchedule()         → POST /api/schedules
  usePlaceTrade()             → Deriv buy via WebSocket
  useVerifyDeposit()          → POST /api/deposits/:id/verify
  useApprovePayout()          → POST /api/payouts/:id/approve
  useDistributeProfits()      → POST /api/packages/:id/distribute
```

### 9.3 Server-Sent Updates (Socket.IO)

```
INVESTOR-SIDE EVENTS (broadcast to investor room:userId):
  investor:earnings_update  → { packageId, pnl, roi, lastUpdated, yourShare }
  investor:pool_status       → { packageId, status, timeLeft }
  investor:trade_result      → { packageId, trade, yourShareImpact }
  investor:payout_status      → { payoutId, status, amount }
  investor:ai_guardian       → { packageId, triggerType, action }
  investor:announcement       → { announcementId, subject, body }

OPERATOR-SIDE EVENTS (broadcast to operator room):
  operator:trade_result      → { trade, packageId }
  operator:balance_update    → { balance }
  operator:bot_status         → { botId, status }
  operator:ai_guardian        → { packageId, triggerType }
  operator:deposit            → { deposit }
  operator:payout_request     → { payout }
  operator:deriv_connected   → { connection }

THROTTLING:
  - Trade results: batch per 10 seconds for investors
  - Running totals: update every 5 seconds
  - Earnings: every 3 minutes (or manual refresh)
  - AI Guardian: immediate
  - Pool status changes: immediate

CLIENT-SIDE RECONNECT:
  - Exponential backoff (1s → 2s → 5s → 15s)
  - On reconnect: re-fetch invalidated query keys
  - Show "Reconnecting..." toast on disconnect > 2s
  - Auto-clear toast on reconnect
```

---

## 10. DATABASE SCHEMA

### 10.1 Core Tables (Prisma)

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  emailVerified   Boolean   @default(false)
  passwordHash    String
  fullName        String
  username        String    @unique
  avatar          String?
  timezone        String    @default("UTC")
  role            String    @default("operator") // operator, investor, both
  primaryRole     String    @default("operator") // operator, investor

  // Security
  twoFactorEnabled Boolean  @default(false)
  twoFactorSecret  String?
  backupCodes      String?

  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastLoginAt     DateTime?

  // Relations
  derivConnections  DerivConnection[]
  investments       Investment[]
  wallet            Wallet?
  kyc               KYCVerification?
  referralCode      String    @unique @default(cuid())
  referrals         Referral[]  @relation("Referrer")
  referredBy        Referral?   @relation("Referred")
  dailyStreak       DailyStreak?
  rewards           Reward[]
  paymentMethods    PaymentMethod[]
}

model DerivConnection {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  derivLoginId    String
  derivAppId      String
  encryptedToken  String
  currency        String
  balance         Float     @default(0)
  status          String    @default("active")
  permissions     String    @default("[]")
  lastActivityAt  DateTime?
  connectedAt     DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  bots            Bot[]
  @@unique([userId, derivLoginId])
}

// ──── PACKAGES ────

model Package {
  id                String    @id @default(cuid())
  code              String    @unique
  name              String
  description       String?
  status            String    @default("draft")
  // draft → open → closed → trading → profit_sharing → completed

  slotPrice         Float     @default(3000)
  maxSlotsPerUser   Int       @default(20)
  targetCapital     Float
  maxCapital        Float?

  bookingOpensAt    DateTime
  bookingClosesAt   DateTime
  tradingStartsAt   DateTime
  tradingEndsAt     DateTime
  profitShareDate   DateTime

  conservativeROI  Float     @default(8)
  expectedROI      Float     @default(15)
  optimisticROI    Float     @default(25)

  operatorSharePercent Float  @default(20)
  investorSharePercent Float @default(80)

  markets           String    @default("[]")
  strategies        String    @default("[]")
  aiGuardianEnabled Boolean   @default(true)
  aiGuardianConfig  String    @default("{}")
  maxDrawdown       Float     @default(5)

  tokensPerSlot     Float     @default(30000)
  tokenName         String    @default("bmX")

  termsUrl          String?
  autoReinvestOption Boolean  @default(false)
  earlyExitPenalty  Float     @default(0)

  filledSlots       Int       @default(0)
  totalCapital      Float     @default(0)
  totalTrades       Int       @default(0)
  totalWins         Int       @default(0)
  totalLosses       Int       @default(0)
  currentPnL        Float     @default(0)
  maxDrawdownHit    Float     @default(0)
  peakCapital       Float     @default(0)
  aiGuardianTriggers Int      @default(0)
  distributedPnL    Float     @default(0)

  scheduleIds       String    @default("[]")

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  investments       Investment[]
  packageTrades     PackageTrade[]
  earningsLogs      PackageEarningsLog[]
  aiGuardianLogs    AIGuardianLog[]
}

// ──── INVESTMENTS ────

model Investment {
  id                String    @id @default(cuid())
  packageId         String
  package           Package   @relation(fields: [packageId], references: [id])
  userId            String
  user              User      @relation(fields: [userId], references: [id])

  slots             Int
  amount            Float
  tokenAllocation   Float
  sharePercent      Float

  paymentMethod     String
  paymentDetails    String?
  paymentStatus     String    @default("pending")
  // pending → submitted → received → verified → failed → refunded
  paymentReference  String?
  paidAt            DateTime?
  verifiedAt        DateTime?

  status            String    @default("booked")
  // booked → confirmed → active → completed → cancelled

  grossEarnings     Float     @default(0)
  netEarnings       Float     @default(0)
  currentPnL        Float     @default(0)
  currentROI        Float     @default(0)

  payoutStatus      String    @default("pending")
  payoutAmount      Float?
  payoutMethod      String?
  payoutRequestedAt DateTime?
  payoutCompletedAt DateTime?

  autoReinvest      Boolean   @default(false)
  reinvestPercent   Float     @default(0)

  bookedAt          DateTime  @default(now())
  confirmedAt       DateTime?
  completedAt       DateTime?
  cancelledAt       DateTime?
  cancelReason      String?

  @@unique([packageId, userId])
}

// ──── TRADES ────

model PackageTrade {
  id              String    @id @default(cuid())
  packageId       String
  package         Package   @relation(fields: [packageId], references: [id])
  derivContractId String?
  symbol          String
  contractType    String
  stake           Float
  duration        Int
  durationUnit    String
  entrySpot       Float?
  exitSpot        Float?
  buyPrice        Float?
  sellPrice       Float?
  payout          Float?
  profit          Float?
  isWin           Boolean?
  isSold          Boolean   @default(false)
  botId           String?
  botName         String?
  scheduleId      String?
  boughtAt        DateTime?
  soldAt          DateTime?
  createdAt       DateTime  @default(now())
  @@index([packageId, createdAt])
}

// ──── SCHEDULES ────

model TradeSchedule {
  id              String    @id @default(cuid())
  name            String
  date            DateTime
  startTime       String
  endTime         String
  symbol          String
  strategy        String
  initialStake    Float
  maxTrades       Int
  packageIds      String    @default("[]")
  packageAllocation String  @default("{}")
  recurrence      String    @default("one_time")
  cronExpression  String?
  stopLoss        Float?
  takeProfit      Float?
  maxDrawdown     Float?
  cooldownAfter   Int       @default(3)
  cooldownDuration Int      @default(300)
  status          String    @default("active")
  lastRunAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// ──── BOTS ────

model Bot {
  id              String    @id @default(cuid())
  connectionId    String
  connection      DerivConnection @relation(fields: [connectionId], references: [id])
  name            String
  symbol          String
  strategyType    String
  scriptId        String?
  status          String    @default("draft")
  contractType    String    @default("CALL")
  initialStake    Float     @default(0.35)
  currentStake    Float     @default(0.35)
  maxStake        Float     @default(100)
  duration        Int       @default(5)
  durationUnit    String    @default("t")
  strategyParams  String    @default("{}")
  takeProfit      Float?
  stopLoss        Float?
  maxDailyLoss    Float     @default(100)
  maxDailyTrades  Int       @default(500)
  cooldownLosses  Int       @default(3)
  cooldownDuration Int      @default(300)
  maxConcurrent   Int       @default(1)
  packageIds      String    @default("[]")
  packageAllocation String  @default("{}")
  totalTrades     Int       @default(0)
  totalWins       Int       @default(0)
  totalLosses     Int       @default(0)
  totalPnL        Float     @default(0)
  startedAt       DateTime?
  runtimeSeconds  Int       @default(0)
  jobId           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// ──── SCRIPTS ────

model Script {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  name            String
  code            String
  description     String?
  isTemplate      Boolean   @default(false)
  totalRuns       Int       @default(0)
  winRate         Float     @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  bots            Bot[]
}

// ──── EARNINGS LOGS ────

model PackageEarningsLog {
  id                  String    @id @default(cuid())
  packageId           String
  package             Package   @relation(fields: [packageId], references: [id])
  totalCapital        Float
  currentPnL          Float
  poolROI             Float
  investmentSnapshots String
  timestamp           DateTime  @default(now())
  @@index([packageId, timestamp])
}

model AIGuardianLog {
  id              String    @id @default(cuid())
  packageId       String
  package         Package   @relation(fields: [packageId], references: [id])
  triggerType     String
  triggerDetails  String
  action          String
  botsAffected    String    @default("[]")
  resumedAt       DateTime?
  timestamp       DateTime  @default(now())
}

// ──── WALLET ────

model Wallet {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  balance         Float     @default(0)
  lockedBalance   Float     @default(0)
  totalDeposited  Float     @default(0)
  totalWithdrawn  Float     @default(0)
  totalEarned     Float     @default(0)
  updatedAt       DateTime  @updatedAt
}

model WalletTransaction {
  id              String    @id @default(cuid())
  walletId        String
  wallet          Wallet    @relation(fields: [walletId], references: [id])
  userId          String
  type            String
  amount          Float
  balance         Float
  method          String
  methodDetails   String?
  reference       String?
  poolId          String?
  investmentId    String?
  status          String    @default("pending")
  description     String?
  createdAt       DateTime  @default(now())
  completedAt     DateTime?
  @@index([walletId, createdAt])
}

model PaymentMethod {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  type            String
  label           String
  isDefault       Boolean   @default(false)
  encryptedData   String
  isVerified      Boolean   @default(false)
  verifiedAt      DateTime?
  createdAt       DateTime  @default(now())
}

// ──── KYC ────

model KYCVerification {
  id                      String    @id @default(cuid())
  userId                  String    @unique
  user                    User      @relation(fields: [userId], references: [id])
  level                   Int       @default(1)
  emailVerified           Boolean   @default(false)
  phoneVerified           Boolean   @default(false)
  idDocType               String?
  idDocFrontUrl           String?
  idDocBackUrl            String?
  selfieUrl               String?
  proofOfAddressUrl       String?
  idVerifiedAt            DateTime?
  sourceOfFundsDeclaration String?
  enhancedDueDiligence    String?
  level3VerifiedAt        DateTime?
  reviewStatus            String    @default("pending")
  reviewerNotes           String?
  reviewedAt              DateTime?
  depositLimitPerTx       Float     @default(1000)
  depositLimitDaily       Float     @default(5000)
  depositLimitMonthly     Float     @default(50000)
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
}

// ──── REFERRALS & REWARDS ────

model Referral {
  id              String    @id @default(cuid())
  referrerId      String
  referrer        User      @relation("Referrer", fields: [referrerId], references: [id])
  referredId      String
  referred        User      @relation("Referred", fields: [referredId], references: [id])
  referralCode    String
  rewardAmount    Float?
  rewardStatus    String    @default("pending")
  createdAt       DateTime  @default(now())
  @@unique([referredId])
}

model DailyStreak {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  currentStreak   Int       @default(0)
  bestStreak      Int       @default(0)
  lastClaimDate   DateTime?
  claimedDays     String    @default("[]")
}

model Reward {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  type            String
  amount          Float
  description     String
  status          String    @default("available")
  claimedAt       DateTime?
  creditedAt      DateTime?
  expiresAt       DateTime?
  relatedId       String?
  createdAt       DateTime  @default(now())
}

// ──── AUTOMATION ────

model AutomationRule {
  id              String    @id @default(cuid())
  userId          String
  name            String
  description     String?
  isEnabled       Boolean   @default(true)
  conditions      String
  actions         String
  schedule        String?
  lastTriggeredAt DateTime?
  triggerCount    Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// ──── AUDIT LOGS ────

model AuditLog {
  id              String    @id @default(cuid())
  userId          String?
  category        String
  action          String
  details         String?
  ipAddress       String?
  userAgent       String?
  metadata        String?
  createdAt       DateTime  @default(now())
  @@index([category, createdAt])
  @@index([userId, createdAt])
}
```

---

## 11. AUTOMATION & BOT ENGINE

### 11.1 Bot Execution Engine

```
BOT LIFECYCLE:
  1. START:
     - Validate bot config
     - Check Deriv connection
     - Create BullMQ job
     - Worker picks up job → Initialize VM → Subscribe to ticks
     - Update bot status → "running"

  2. TICK:
     - Receive tick from Deriv WebSocket
     - Execute script.onTick(tick) in sandboxed VM
     - If trade decision returned: check risk limits → place trade
     - Update stats

  3. TRADE RESULT:
     - Receive contract settlement from Deriv
     - Call script.onResult(result)
     - Update stats, check TP/SL
     - Log trade, emit real-time event

  4. PAUSE: Stop processing ticks, let current trade complete
  5. STOP: Unsubscribe, terminate VM, remove job
  6. ERROR: Log, auto-pause or stop, notify operator

RISK CHECKS (before every trade):
  1. Balance >= stake
  2. Stake <= maxStake
  3. Daily loss < maxDailyLoss
  4. Daily trades < maxDailyTrades
  5. Cooldown check
  6. Take profit / Stop loss check
  7. Concurrent trades check
  8. Market open check
```

### 11.2 AI Guardian

```
SETTINGS:
  - Max consecutive losses (odd/even): 8
  - Max consecutive losses (digits): 10
  - Max bulk runs: 1-2
  - Random market rotation: ON
  - Per-package drawdown limit: 5%

ON TRIGGER:
  1. Halt all active bot processes for affected package
  2. Send notification to operator (Telegram + in-app)
  3. Log trigger with details
  4. Wait cooldown period
  5. Resume bots (or wait for manual resume)
```

---

## 12. SCRIPT ENGINE

### 12.1 Sandbox API

```
AVAILABLE IN SANDBOX:
  onTick(tick): TradeDecision | null
  onResult(result): void
  onComplete(summary): void

CONTEXT:
  getLastResult(), getHistory(limit), getBalance()
  getOpenContracts(), log(message)

TECHNICAL INDICATORS:
  getTicks(limit), getSMA(period), getEMA(period)
  getRSI(period), getMACD(fast, slow, signal)
  getBollingerBands(period, stdDev), getStochastic(k, d)

TRADE DECISION:
  { contract, stake, duration, durationUnit, barrier?, basis? }

SECURITY:
  - isolated-vm sandbox, no filesystem/network/process access
  - Memory: 128MB, Timeout: 100ms per tick
  - Max 1 trade per tick
```

### 12.2 Preset Strategies

```
1. Martingale    — double stake on loss, reset on win
2. Oscar's Grind — increase only after win recovers loss
3. DCA/Average   — same stake, lower average entry
4. Fixed Stake   — consistent stake every trade
5. Anti-Marting  — increase on win, decrease on loss
6. Fibonacci     — stake follows Fibonacci on losses
```

---

## 13. CROWDFUNDING POOL DATA MODEL

```
POOL LIFECYCLE (per package):
  SCHEDULED → OPEN → CLOSED → TRADING → PROFIT_SHARING → COMPLETED

  SCHEDULED:    Package announced, dates set
  OPEN:          Accepting slot bookings and payments
  CLOSED:        No more bookings, preparing for trading
  TRADING:       Bots actively trading pooled capital
  PROFIT_SHARING: Calculating & distributing profits
  COMPLETED:     All payouts processed, package closed

COUNTDOWN TIMERS:
  - If OPEN:            countdown to close date
  - If TRADING:          countdown to trading end date
  - If PROFIT_SHARING:  countdown to payout date

PROFIT CALCULATION:
  For each investor in a package:
    investorShare = investment.amount / package.totalCapital
    grossEarnings = package.currentPnL × investorShare
    platformCut = grossEarnings × (operatorSharePercent / 100)
    netEarnings = grossEarnings - platformCut
    currentROI = (netEarnings / investment.amount) × 100

  Auto-calculation every 3 minutes (or manual refresh)
```

---

## 14. LIVE TRADE TRACKER ENGINE

```
DATA FLOW:
  Deriv WebSocket → Trade Event → Process & Aggregate
  → Redis Pub/Sub → Socket.IO Broadcast → All investors in pool

INVESTOR SOCKET EVENTS:
  "investor:earnings_update"  → { packageId, pnl, roi, lastUpdated, yourShare }
  "investor:pool_status"      → { packageId, status, timeLeft }
  "investor:trade_result"     → { packageId, trade, yourShareImpact }
  "investor:payout_status"    → { payoutId, status, amount }
  "investor:ai_guardian"      → { packageId, triggerType, action }

OPERATOR SOCKET EVENTS:
  "operator:trade_result"      → { trade, packageId }
  "operator:balance_update"    → { balance }
  "operator:bot_status"       → { botId, status }
  "operator:ai_guardian"      → { packageId, triggerType }
  "operator:deposit"          → { deposit }
  "operator:payout_request"   → { payout }

THROTTLING:
  - Trade results: batch per 10 seconds for investors
  - Running totals: update every 5 seconds
  - Earnings: every 3 minutes (or manual refresh)
  - AI Guardian: immediate
  - Pool status changes: immediate
```

---

## 15. WALLET & FINANCE ENGINE

```
DEPOSIT FLOW:
  1. Investor selects amount + payment method
  2. Create WalletTransaction (pending)
  3. Generate payment reference
  4. Show instructions
  5. Investor completes payment
  6. Webhook/manual verification
  7. Transaction → verified → completed
  8. Credit wallet, confirm investment

PAYOUT FLOW:
  1. Investor requests payout
  2. Check wallet balance >= amount
  3. Create WalletTransaction (payout)
  4. Lock amount from wallet
  5. Process via payment provider
  6. Transaction → completed
  7. Deduct from locked balance
  8. Notify investor

EARNING CREDITING (after profit sharing):
  1. Package status → profit_sharing
  2. Calculate final P&L per investment
  3. Credit wallet.balance for each investor
  4. Notify all investors
  5. Package → completed

PAYMENT METHODS:
  Bank Transfer: ACH, SEPA, SWIFT, Wire (1-3 days, $0 fee)
  Mobile Money: MTN, Vodafone, M-Pesa, Airtel (instant-30min, 1.5% fee)
  Card: Visa, Mastercard via Stripe (instant, 2.9%+$0.30)
  Crypto: BTC, ETH, USDT, USDC (15-60min, network fee only)
```

---

## 16. PROFIT CALCULATION ENGINE

```
REAL-TIME (every 3 minutes):
  For each package:
    1. Read package.currentPnL from bot engine
    2. For each investment in package:
       a. investorShare = investment.amount / package.totalCapital
       b. grossEarnings = package.currentPnL × investorShare
       c. platformCut = grossEarnings × (package.operatorSharePercent / 100)
       d. netEarnings = grossEarnings - platformCut
       e. currentROI = (netEarnings / investment.amount) × 100
       f. Update investment.currentPnL and investment.currentROI
    3. Create PackageEarningsLog snapshot
    4. Broadcast to all investors via Socket.IO

PER-PACKAGE P&L SPLIT:
  Package P&L is split proportional to capital allocation:
  PKG-01 (40% capital): gets 40% of total P&L
  PKG-02 (35% capital): gets 35% of total P&L
  PKG-03 (25% capital): gets 25% of total P&L

DISPLAY:
  - Investor sees NET earnings (after platform cut) by default
  - "View breakdown" link shows gross → platform cut → net
  - Operator sees both operator share AND investor distributions
```

---

## 17. DEPLOYMENT & ENVIRONMENT

### 17.1 Environment Variables

```
NODE_ENV=production
APP_URL=https://app.derivx.com
APP_PORT=3000

DATABASE_URL=postgresql://user:pass@host:5432/derivx
REDIS_URL=redis://host:6379

JWT_ACCESS_SECRET=<random-32-chars>
JWT_REFRESH_SECRET=<random-32-chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

DERIV_APP_ID=<registered-app-id>
DERIV_OAUTH_URL=https://oauth.deriv.com
DERIV_WS_URL=wss://ws.derivws.com/websockets/v3
DERIV_CALLBACK_URL=https://app.derivx.com/api/auth/deriv/callback

TOKEN_ENCRYPTION_KEY=<aes-256-gcm-key>

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
EMAIL_FROM=noreply@derivx.com

VAPID_PUBLIC_KEY=<key>
VAPID_PRIVATE_KEY=<key>

RATE_LIMIT_API_WINDOW=60000
RATE_LIMIT_API_MAX=100

BOT_MAX_CONCURRENT=10
BOT_VM_MEMORY_LIMIT_MB=128
BOT_VM_TIMEOUT_MS=100

EARNINGS_CALC_INTERVAL_MS=180000
DEFAULT_OPERATOR_SHARE_PERCENT=20
DEFAULT_INVESTOR_SHARE_PERCENT=80

SENTRY_DSN=<sentry-dsn>

# Payment providers
STRIPE_SECRET_KEY=<stripe-secret>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>

# Mobile Money providers
MTN_API_KEY=<mtn-key>
VODAFONE_API_KEY=<vodafone-key>
AIRTEL_API_KEY=<airtel-key>

# Crypto (optional, for self-hosted wallet watch)
BTC_RPC_URL=<btc-rpc>
ETH_RPC_URL=<eth-rpc>
USDT_CONTRACT_ADDRESS=<usdt-contract>
```

### 17.2 API Route Map

```
AUTH:
  POST   /api/auth/register
  POST   /api/auth/login
  POST   /api/auth/logout
  POST   /api/auth/refresh
  POST   /api/auth/forgot-password
  POST   /api/auth/reset-password
  GET    /api/auth/verify-email
  POST   /api/auth/2fa/verify
  POST   /api/auth/deriv/connect

DERIV:
  GET    /api/connections
  POST   /api/connections
  DELETE /api/connections/:id
  POST   /api/connections/:id/test
  POST   /api/connections/:id/refresh

PACKAGES:
  GET    /api/packages
  POST   /api/packages
  GET    /api/packages/:id
  PATCH  /api/packages/:id
  DELETE /api/packages/:id
  POST   /api/packages/:id/publish
  POST   /api/packages/:id/pause
  GET    /api/packages/:id/investors
  GET    /api/packages/:id/performance
  POST   /api/packages/:id/distribute
  POST   /api/packages/distribute-pending

INVESTMENTS:
  GET    /api/investments
  POST   /api/investments (book slot)
  GET    /api/investments/:id
  PATCH  /api/investments/:id
  DELETE /api/investments/:id (cancel)

INVESTORS:
  GET    /api/investors
  GET    /api/investors/:id
  PATCH  /api/investors/:id
  POST   /api/investors/:id/kyc-approve
  POST   /api/investors/:id/kyc-reject
  POST   /api/investors/:id/suspend
  POST   /api/investors/:id/force-payout
  POST   /api/investors/:id/adjust-balance

SCHEDULES:
  GET    /api/schedules
  POST   /api/schedules
  PATCH  /api/schedules/:id
  DELETE /api/schedules/:id

TRADES:
  POST   /api/trades/buy
  POST   /api/trades/sell
  GET    /api/trades/history
  GET    /api/trades/summary

BOTS:
  GET    /api/bots
  POST   /api/bots
  GET    /api/bots/:id
  PATCH  /api/bots/:id
  POST   /api/bots/:id/start
  POST   /api/bots/:id/pause
  POST   /api/bots/:id/stop
  POST   /api/bots/:id/restart
  POST   /api/bots/:id/attach-script

SCRIPTS:
  GET    /api/scripts
  POST   /api/scripts
  GET    /api/scripts/:id
  PATCH  /api/scripts/:id
  DELETE /api/scripts/:id
  POST   /api/scripts/:id/validate

MARKETS:
  GET    /api/markets/active
  GET    /api/markets/schedule
  GET    /api/markets/ticks/:symbol
  POST   /api/markets/favorites

WALLET:
  GET    /api/wallet
  POST   /api/wallet/deposit
  POST   /api/wallet/payout
  GET    /api/wallet/transactions
  GET    /api/wallet/payment-methods
  POST   /api/wallet/payment-methods
  DELETE /api/wallet/payment-methods/:id
  POST   /api/wallet/payment-methods/:id/default

DEPOSITS:
  GET    /api/deposits
  POST   /api/deposits/:id/verify
  POST   /api/deposits/:id/reject
  POST   /api/deposits/:id/request-proof
  POST   /api/deposits/:id/retry
  POST   /api/deposits/:id/refund

PAYOUTS:
  GET    /api/payouts
  POST   /api/payouts/:id/approve
  POST   /api/payouts/:id/reject
  POST   /api/payouts/:id/complete
  POST   /api/payouts/:id/fail
  POST   /api/payouts/:id/retry
  POST   /api/payouts/:id/refund
  POST   /api/payouts/batch-approve
  POST   /api/payouts/batch-reject
  PATCH  /api/payouts/settings

ANALYTICS:
  GET    /api/analytics/overview
  GET    /api/analytics/by-package
  GET    /api/analytics/by-investor
  GET    /api/analytics/by-market
  GET    /api/analytics/by-strategy
  GET    /api/analytics/revenue-distribution
  GET    /api/analytics/drawdown
  GET    /api/analytics/period-comparison

COMMUNICATIONS:
  GET    /api/comms/messages
  POST   /api/comms/messages
  GET    /api/comms/announcements
  POST   /api/comms/announcements
  POST   /api/comms/announcements/:id/resend
  GET    /api/comms/templates
  PATCH  /api/comms/templates/:id
  POST   /api/comms/templates/:id/test

LOGS:
  GET    /api/logs
  GET    /api/logs/audit
  GET    /api/logs/categorized
  GET    /api/logs/system-events
  GET    /api/logs/security
  GET    /api/logs/api-access
  POST   /api/logs/export
  POST   /api/logs/compliance-report
  POST   /api/logs/tax-report
  POST   /api/logs/archive

AUTOMATION:
  GET    /api/automation/rules
  POST   /api/automation/rules
  PATCH  /api/automation/rules/:id
  DELETE /api/automation/rules/:id

USER:
  GET    /api/user/profile
  PATCH  /api/user/profile
  POST   /api/user/change-password
  POST   /api/user/2fa/enable
  DELETE /api/user/2fa
  POST   /api/user/2fa/reconfigure
  GET    /api/user/settings
  PATCH  /api/user/settings
  GET    /api/user/api-keys
  POST   /api/user/api-keys
  DELETE /api/user/api-keys/:id

SESSIONS:
  GET    /api/sessions/active
  DELETE /api/sessions/:id
  POST   /api/sessions/revoke-all

KYC:
  POST   /api/kyc/submit
  GET    /api/kyc/status
  GET    /api/kyc/documents
  POST   /api/kyc/reupload
  POST   /api/kyc/upgrade-level
  GET    /api/kyc/history

REFERRALS:
  GET    /api/referrals/code-and-stats
  GET    /api/referrals/streak
  POST   /api/referrals/claim-daily
  GET    /api/referrals/available-rewards
  POST   /api/rewards/:id/claim
  GET    /api/referrals/leaderboard
  GET    /api/referrals/history

EARNINGS:
  GET    /api/earnings/overview
  GET    /api/earnings/by-pool
  GET    /api/earnings/timeline
  GET    /api/earnings/tax-report
  POST   /api/earnings/export-csv
  POST   /api/earnings/export-pdf

SETTINGS:
  GET    /api/settings/platform
  PATCH  /api/settings/platform
  GET    /api/settings/security
  PATCH  /api/settings/notifications
  GET    /api/settings/payout-preferences
  PATCH  /api/settings/payout-preferences
  POST   /api/ai-guardian/rules
  PATCH  /api/ai-guardian/rules

BILLING:
  GET    /api/billing/subscription
  POST   /api/billing/upgrade
  POST   /api/billing/cancel
  GET    /api/billing/invoices
```

---

## 18. COMPLETE PAGE INDEX

```
HOME PAGES (3):
  H-1  /                              Landing
  H-2  /features                      Features
  H-3  /pricing                       Pricing

AUTH PAGES (8):
  A-1  /auth/signup                   Sign Up (role: operator/investor)
  A-2  /auth/signin                   Sign In (role routing)
  A-3  /auth/onboarding/investor       Investor Onboarding (4 steps)
  A-4  /auth/forgot-password          Forgot Password
  A-5  /auth/reset-password           Reset Password
  A-6  /auth/verify-email             Email Verification
  A-7  /auth/2fa                      Two-Factor Auth
  A-8  /auth/deriv/callback           Deriv OAuth Callback

OPERATOR DASHBOARD (15):
  D-1   /dashboard                    Command Center
  D-2   /dashboard/schedules          Trade Scheduler
  D-3   /dashboard/live               Live Trading
  D-4   /dashboard/trades             Trade Log & Records
  D-5   /dashboard/packages           Package Manager
  D-6   /dashboard/investors          Investors Management
  D-7   /dashboard/analytics          Analytics
  D-8   /dashboard/funds              Funds & Capital
  D-9   /dashboard/withdrawals        Withdrawal Requests
  D-10  /dashboard/comms              Communications
  D-11  /dashboard/deposits           Deposit Logs
  D-12  /dashboard/logs               Activity & Audit Logs
  D-13  /dashboard/markets            Markets & Symbols
  D-14  /dashboard/bots               Bot & Automation Config
  D-15  /dashboard/settings          Settings

INVESTOR DASHBOARD (12 — mirrored in investorMO.md):
  I-1   /investor                     Overview
  I-2   /investor/pools                Pools Browser
  I-3   /investor/pools/:id           Pool Detail
  I-4   /investor/pools/:id/book      Book Slots & Payment
  I-5   /investor/live                Live Trade Tracker
  I-6   /investor/investments         My Investments
  I-7   /investor/wallet              Wallet & Finances
  I-8   /investor/calculator          Investment Calculator
  I-9   /investor/notifications      Notifications & Activity
  I-10  /investor/referrals           Referrals & Rewards
  I-11  /investor/earnings            Earnings & Reports
  I-12  /investor/settings            Settings

APP SHELL (always-mounted, 1 stylesheet):
  src/styles/app-shell.css  — sidebar, top bar, mobile nav, theme, page wrapper

TOTAL: 38 page stylesheets + 1 app-shell = 39 stylesheets for 38 pages
       (page count is 38; the +1 is the always-mounted app-shell that wraps all routes)
```

---

## 19. IMPLEMENTATION PHASES

```
PHASE 1 — MVP (Weeks 1-4):
  ✓ Landing page (H-1) — TanStack Start + Bootstrap 5.3
  ✓ Auth with role selection (A-1, A-2, A-8)
  ✓ Investor onboarding (A-3)
  ✓ Command center (D-1) — basic KPIs
  ✓ Package manager (D-5) — create/list packages
  ✓ Markets browser (D-13)
  ✓ Deriv WebSocket connection
  ✓ Basic buy/sell

PHASE 2 — Scheduling & Trading (Weeks 5-8):
  ✓ Trade scheduler (D-2)
  ✓ Live trading (D-3)
  ✓ Bot config (D-14)
  ✓ Bot execution engine (BullMQ + isolated-vm)
  ✓ Preset strategies
  ✓ AI Guardian
  ✓ Trade log (D-4)

PHASE 3 — Investors & Packages (Weeks 9-12):
  ✓ Investor overview (I-1)
  ✓ Pool browser (I-2)
  ✓ Pool detail (I-3)
  ✓ Slot booking (I-4)
  ✓ Investors management (D-6)
  ✓ Live trade tracker (I-5)
  ✓ My investments (I-6)

PHASE 4 — Funds & Payouts (Weeks 13-15):
  ✓ Wallet & finances (I-7)
  ✓ Funds & capital (D-8)
  ✓ Deposit logs (D-11)
  ✓ Withdrawal requests (D-9)
  ✓ Payment method integration
  ✓ KYC flow
  ✓ Earnings auto-calculation engine

PHASE 5 — Analytics & Comms (Weeks 16-18):
  ✓ Analytics (D-7)
  ✓ Investor earnings (I-11)
  ✓ Investment calculator (I-8)
  ✓ Communications (D-10)
  ✓ Notifications (I-9)
  ✓ Referrals (I-10)

PHASE 6 — Polish & Scale (Weeks 19+):
  ✓ Activity & audit logs (D-12)
  ✓ All settings pages (D-15, I-12)
  ✓ Email templates & automation
  ✓ Telegram bot integration
  ✓ Push notifications
  ✓ Tax reports
  ✓ Mobile responsive — page-scoped CSS for all 38 pages
  ✓ Multi-currency support
  ✓ Load testing
  ✓ Public API
  ✓ Page-scoped CSS HMR wiring for all 38 routes
  ✓ Reduced-motion audit across all 38 pages
  ✓ investorMO.md companion file synced with global styling spec
```

---
