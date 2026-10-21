import type {
  CtaSectionPayloadDTO,
  FeatureDTO,
  HeroPayloadDTO,
  HowItWorksPayloadDTO,
  LandingContentDTO,
  StatDTO,
  StepDTO,
  TickerQuoteDTO,
  TrustBadgeDTO,
} from "@/lib/api/types";

/**
 * Canonical landing content (H-1).
 * Completely free of broker brand dependencies and SaaS bot selling.
 * Focused purely on Crowdfunded Trade Pools for investors & algorithmic execution.
 */

export const HERO_SECTION = {
  key: "hero",
  eyebrow: "Algorithmic Crowdfunding · Multi-Asset Pools · Automated Profit Splits",
  title: "Trade smarter with crowdfunded capital pools.",
  subtitle:
    "Back high-performance quantitative trading strategies across global equities, forex, index futures, and commodities. Pool capital with fellow investors and receive transparent, proportional profit payouts.",
  payload: {
    headlineHighlight: "crowdfunded capital pools.",
    highlights: [
      "Tier-1 Multi-Asset Execution",
      "Proportional P&L Profit Split",
      "Auditable Ledger Settlements",
    ],
    primaryCta: { label: "Start Backing Pools", href: "/auth/signup?role=investor" },
    secondaryCta: { label: "Explore Fee Tiers", href: "/pricing" },
    console: {
      accountLabel: "tradeMO · Multi-Asset Alpha Pool",
      status: "live" as const,
      strategy: "Volatility Mean Reversion · FX & Futures",
      market: "Global Multi-Asset Syndicate",
      capitalPooled: 284500,
      activeBots: 14,
      operatorSharePercent: 15,
      trades: [
        { id: "t-1", symbol: "NQ_FUT", side: "BUY" as const, stake: 250, payout: 482.5, result: "won" as const, secondsAgo: 3 },
        { id: "t-2", symbol: "EUR/USD", side: "SELL" as const, stake: 120, payout: 230.4, result: "won" as const, secondsAgo: 9 },
        { id: "t-3", symbol: "XAU/USD", side: "BUY" as const, stake: 180, payout: 0, result: "live" as const, secondsAgo: 0 },
        { id: "t-4", symbol: "BTC/USDT", side: "SELL" as const, stake: 310, payout: 0, result: "lost" as const, secondsAgo: 21 },
      ],
    },
  } satisfies HeroPayloadDTO,
};

export const HOW_IT_WORKS_SECTION = {
  key: "how-it-works",
  eyebrow: "How It Works",
  title: "From pool funding to profit distribution in four transparent steps.",
  subtitle:
    "Select an active trading pool, commit capital for your preferred duration, let quantitative algorithms execute trades, and collect your proportional profit share upon settlement.",
  payload: {
    footnote:
      "Profit splits are calculated strictly proportional to capital contributed. Platform performance fees are tiered from 20% down to 10% based on active capital tiers, recalculated every distribution cycle.",
  } satisfies HowItWorksPayloadDTO,
};

export const CTA_SECTION = {
  key: "cta",
  eyebrow: "Start Backing Today",
  title: "Join high-capacity crowdfunding trade pools today.",
  subtitle:
    "No monthly subscriptions or software setups required. Start with as little as $250 across multi-asset trading pools with automated risk protection.",
  payload: {
    title: "Join high-capacity crowdfunding trade pools today.",
    description:
      "No monthly subscriptions or software setups required. Start with as little as $250 across multi-asset trading pools with automated risk protection.",
    primaryCta: { label: "Create Backer Account", href: "/auth/signup" },
    secondaryCta: { label: "Explore Fee Tiers", href: "/pricing" },
    formHeading: "Get pool capacity alerts",
    formNote: "Receive early notifications when high-capacity pools open for backing. No spam, unsubscribe anytime.",
    trustPoints: [
      "No recurring SaaS subscription fees",
      "High-Water Mark protection on every pool",
      "Withdraw capital and profits across 4 payment rails",
    ],
  } satisfies CtaSectionPayloadDTO,
};

export const LANDING_STATS: StatDTO[] = [
  {
    id: "stat-investors",
    key: "investors",
    label: "Active backers",
    value: 12480,
    prefix: "",
    suffix: "+",
    decimals: 0,
    caption: "Investors participating in trade pools",
    icon: "users",
  },
  {
    id: "stat-capital",
    key: "capital",
    label: "Capital pooled",
    value: 48.6,
    prefix: "$",
    suffix: "M",
    decimals: 1,
    caption: "Across crowdfunded multi-asset trade pools",
    icon: "vault",
  },
  {
    id: "stat-payouts",
    key: "payouts",
    label: "Distributed profits",
    value: 21.2,
    prefix: "$",
    suffix: "M",
    decimals: 1,
    caption: "Paid out directly to investor wallets",
    icon: "chart",
  },
  {
    id: "stat-uptime",
    key: "uptime",
    label: "Execution uptime",
    value: 99.98,
    prefix: "",
    suffix: "%",
    decimals: 2,
    caption: "Rolling 90-day trade engine reliability",
    icon: "shield",
  },
];

export const PLATFORM_FEATURES: FeatureDTO[] = [
  {
    id: "feature-bot-engine",
    slug: "bot-engine",
    icon: "bot",
    eyebrow: "Algorithmic Execution",
    title: "Quantitative execution engine",
    description:
      "Proprietary trading algorithms execute high-probability orders across 100+ global assets with automated risk envelopes, dynamic stop-losses, and drawdown guards.",
    bullets: [
      "Precision execution across Forex, Equities, Futures & Crypto",
      "Automated risk checks evaluated before every single trade",
      "Auto-pause and cooldown guards on drawdown triggers",
    ],
    metricLabel: "Active market strategies",
    metricValue: "24 models",
    badge: "Core Execution",
    accent: "teal",
    href: "/features#bot-engine",
  },
  {
    id: "feature-crowdfunding",
    slug: "crowdfunding",
    icon: "pool",
    eyebrow: "Crowdfunding",
    title: "Multi-asset capital pools",
    description:
      "Choose from curated trade pools spanning different asset classes and durations (15 to 180 days). Capital is pooled and profits are shared proportionally.",
    bullets: [
      "6-stage pool lifecycle with real-time countdown timers",
      "Proportional P&L ledger mathematically audited per investor",
      "Direct automated wallet crediting upon cycle settlement",
    ],
    metricLabel: "Average pool net ROI per cycle",
    metricValue: "12.4%",
    badge: "For Investors",
    accent: "violet",
    href: "/features#crowdfunding",
  },
  {
    id: "feature-script-engine",
    slug: "script-engine",
    icon: "script",
    eyebrow: "Risk Management",
    title: "Capital protection & AI Guardian",
    description:
      "Automated safety layers monitor market volatility and enforce strict drawdown floors, preventing catastrophic slippage or sequential loss clusters.",
    bullets: [
      "Strict high-water mark protection across all pools",
      "Market volatility rotation to prevent adverse conditions",
      "Real-time transparent trade logs and settlement audits",
    ],
    metricLabel: "Max allowable drawdown floor",
    metricValue: "5.0%",
    badge: "Safety Architecture",
    accent: "amber",
    href: "/features#ai-guardian",
  },
];

export const HOW_IT_WORKS_STEPS: StepDTO[] = [
  {
    id: "step-1",
    stepNumber: 1,
    icon: "plug",
    title: "Browse Trade Pools",
    description:
      "Explore open crowdfunding trade pools across Equities, FX, Index Futures, and Commodities categorized by duration and risk profile.",
    highlights: ["15 to 180-day lockups", "Curated asset classes", "Clear target yields"],
  },
  {
    id: "step-2",
    stepNumber: 2,
    icon: "package",
    title: "Fund Your Allocation",
    description:
      "Reserve slots starting from $250 using Bank Wire, Mobile Money, or Crypto. Your funds are secured and confirmed before pool execution starts.",
    highlights: ["Zero entry fees", "Instant payment verification", "Slot confirmation"],
  },
  {
    id: "step-3",
    stepNumber: 3,
    icon: "clock",
    title: "Track Live Execution",
    description:
      "Watch quantitative algorithms execute trades in real time with live telemetry, trade feeds, and running pool equity updates.",
    highlights: ["Live trade stream", "Drawdown guards active", "Transparent P&L"],
  },
  {
    id: "step-4",
    stepNumber: 4,
    icon: "split",
    title: "Receive Profit Distributions",
    description:
      "At settlement, the engine calculates each backer's share of net trading profits and credits your wallet automatically for immediate withdrawal.",
    highlights: ["Proportional payout", "Tiered fee discounts", "Instant withdrawal"],
  },
];

export const TRUST_BADGES: TrustBadgeDTO[] = [
  { id: "trust-exec", icon: "shield", label: "Tier-1 Liquidity Execution", detail: "Institutional DMA Feeds" },
  { id: "trust-encryption", icon: "lock", label: "256-bit Bank Grade Security", detail: "Encrypted capital vault" },
  { id: "trust-traders", icon: "users", label: "12,000+ Active Backers", detail: "Retail & institutional" },
  { id: "trust-automation", icon: "clock", label: "24/7 Algorithmic Trading", detail: "Automated profit distribution" },
];

export const TICKER_INSTRUMENTS: TickerQuoteDTO[] = [
  {
    symbol: "EUR/USD",
    displayName: "EUR/USD",
    market: "forex",
    price: 1.0842,
    changePercent: 0.18,
    direction: "up",
    dayHigh: 1.0871,
    dayLow: 1.0804,
    sparkline: [1.0804, 1.0812, 1.0809, 1.0821, 1.0833, 1.0828, 1.0842],
    decimals: 4,
    updatedAt: new Date(0).toISOString(),
  },
  {
    symbol: "SPX500",
    displayName: "S&P 500",
    market: "index",
    price: 5244.6,
    changePercent: 0.58,
    direction: "up",
    dayHigh: 5262.1,
    dayLow: 5218.4,
    sparkline: [5218, 5224, 5231, 5228, 5239, 5241, 5244],
    decimals: 1,
    updatedAt: new Date(0).toISOString(),
  },
  {
    symbol: "NQ100",
    displayName: "NASDAQ 100",
    market: "index",
    price: 18412.5,
    changePercent: 0.92,
    direction: "up",
    dayHigh: 18490.2,
    dayLow: 18280.1,
    sparkline: [18280, 18310, 18340, 18370, 18390, 18405, 18412],
    decimals: 1,
    updatedAt: new Date(0).toISOString(),
  },
  {
    symbol: "BTC/USDT",
    displayName: "Bitcoin",
    market: "crypto",
    price: 68421.9,
    changePercent: 1.42,
    direction: "up",
    dayHigh: 68940,
    dayLow: 67310,
    sparkline: [67310, 67520, 67780, 67990, 68110, 68290, 68421],
    decimals: 1,
    updatedAt: new Date(0).toISOString(),
  },
  {
    symbol: "XAU/USD",
    displayName: "Spot Gold",
    market: "commodity",
    price: 2384.35,
    changePercent: -0.12,
    direction: "down",
    dayHigh: 2396.8,
    dayLow: 2378.1,
    sparkline: [2396, 2392, 2390, 2388, 2386, 2385, 2384],
    decimals: 2,
    updatedAt: new Date(0).toISOString(),
  },
  {
    symbol: "WTI_OIL",
    displayName: "Crude Oil",
    market: "commodity",
    price: 82.44,
    changePercent: 0.88,
    direction: "up",
    dayHigh: 83.2,
    dayLow: 81.6,
    sparkline: [81.6, 81.8, 82.1, 82.0, 82.3, 82.4, 82.44],
    decimals: 2,
    updatedAt: new Date(0).toISOString(),
  },
  {
    symbol: "GBP/USD",
    displayName: "GBP/USD",
    market: "forex",
    price: 1.2718,
    changePercent: 0.07,
    direction: "up",
    dayHigh: 1.2744,
    dayLow: 1.2691,
    sparkline: [1.2691, 1.2698, 1.2704, 1.27, 1.271, 1.2715, 1.2718],
    decimals: 4,
    updatedAt: new Date(0).toISOString(),
  },
  {
    symbol: "ETH/USDT",
    displayName: "Ethereum",
    market: "crypto",
    price: 3542.8,
    changePercent: 1.15,
    direction: "up",
    dayHigh: 3580.4,
    dayLow: 3490.2,
    sparkline: [3490, 3505, 3518, 3522, 3535, 3540, 3542],
    decimals: 1,
    updatedAt: new Date(0).toISOString(),
  },
];

export const LANDING_FALLBACK: LandingContentDTO = {
  hero: {
    key: HERO_SECTION.key,
    eyebrow: HERO_SECTION.eyebrow,
    title: HERO_SECTION.title,
    subtitle: HERO_SECTION.subtitle,
    payload: HERO_SECTION.payload,
  },
  howItWorks: {
    key: HOW_IT_WORKS_SECTION.key,
    eyebrow: HOW_IT_WORKS_SECTION.eyebrow,
    title: HOW_IT_WORKS_SECTION.title,
    subtitle: HOW_IT_WORKS_SECTION.subtitle,
    payload: HOW_IT_WORKS_SECTION.payload,
  },
  cta: {
    key: CTA_SECTION.key,
    eyebrow: CTA_SECTION.eyebrow,
    title: CTA_SECTION.title,
    subtitle: CTA_SECTION.subtitle,
    payload: CTA_SECTION.payload,
  },
  stats: LANDING_STATS,
  features: PLATFORM_FEATURES,
  steps: HOW_IT_WORKS_STEPS,
  trustBadges: TRUST_BADGES,
  ticker: TICKER_INSTRUMENTS,
  meta: {
    source: "fallback",
    generatedAt: new Date(0).toISOString(),
    version: 1,
  },
};
