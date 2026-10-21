import type {
  FeeComparisonRowDTO,
  PoolAssetClassDTO,
  PricingContentDTO,
  PricingFaqDTO,
  PricingTierDTO,
} from "@/lib/api/types";
import { CTA_SECTION } from "@/lib/content/landing-content";

/**
 * Canonical content for Page H-3 (Pricing & Investor Fee Tiers).
 * Structured data for investment tiers (<$10k, $10k-$100k, >$100k),
 * crowdfunding pool asset classes, interactive calculator parameters,
 * fee matrix, and fund management FAQs.
 */

export const PRICING_HERO = {
  key: "pricing-hero",
  eyebrow: "Transparent Investor Economics",
  title: "Performance-aligned pricing. No hidden fees.",
  subtitle:
    "We only profit when your capital grows. Structured management and performance fee tiers designed for retail backers, high-net-worth investors, and institutional capital pools.",
  payload: {
    headlineHighlight: "No hidden fees.",
    chips: [
      "High-Water Mark Protection",
      "Proportional P&L Split",
      "Automated Bi-Weekly & Weekly Settlements",
      "Tiered Volume Discounts",
      "Direct Wallet Crediting",
    ],
    kpis: [
      { key: "perf-cut", value: "10%–20%", label: "Performance fee (tiered)" },
      { key: "mgmt-fee", value: "0.5%–1.5%", label: "Annual management fee" },
      { key: "min-entry", value: "$250", label: "Minimum pool allocation" },
      { key: "settlement", value: "100%", label: "Auditable ledger payouts" },
    ],
    primaryCta: { label: "Explore Investment Tiers", href: "#tiers" },
    secondaryCta: { label: "Launch Return Calculator", href: "#calculator" },
  },
};

export const PRICING_TIERS: PricingTierDTO[] = [
  {
    id: "tier-starter",
    slug: "starter",
    name: "Starter Backer",
    headline: "Under $10,000 USD",
    minCapital: 250,
    maxCapital: 9999,
    managementFeePercent: 1.5, // 1.5% annual
    performanceFeePercent: 20.0, // 20% profit share
    accessFeePercent: 0.0,
    payoutFrequency: "Bi-weekly or on pool maturity",
    badge: "Accessible",
    isPopular: false,
    description:
      "Ideal for individual backers seeking passive algorithmic yields across curated multi-asset crowdfunding trade pools.",
    perks: [
      "Entry from $250 across standard pools",
      "20% performance fee (high-water mark protected)",
      "1.5% annualized capital management fee",
      "Bi-weekly automated profit distributions",
      "Real-time live trade tracker telemetry",
      "Standard email & in-app performance digests",
      "Multi-rail withdrawals: Bank, Mobile Money, Crypto",
    ],
  },
  {
    id: "tier-growth",
    slug: "growth",
    name: "Prime Growth",
    headline: "$10,000 – $100,000 USD",
    minCapital: 10000,
    maxCapital: 99999,
    managementFeePercent: 1.0, // 1.0% annual
    performanceFeePercent: 15.0, // 15% profit share
    accessFeePercent: 0.0,
    payoutFrequency: "Weekly automated distributions",
    badge: "Most Popular",
    isPopular: true,
    description:
      "Reduced fee thresholds for serious investors looking to maximize compound returns across high-capacity institutional trade pools.",
    perks: [
      "Priority allocation in high-capacity trade pools",
      "15% performance fee (saving 25% vs standard)",
      "1.0% annualized capital management fee",
      "Weekly automated profit distribution to wallet",
      "Advanced risk allocation across 5+ asset classes",
      "Telegram bot execution & drawdown alerts",
      "Direct priority support & quarterly tax reporting",
    ],
  },
  {
    id: "tier-institutional",
    slug: "institutional",
    name: "Institutional & VIP",
    headline: "Above $100,000 USD",
    minCapital: 100000,
    maxCapital: null,
    managementFeePercent: 0.5, // 0.5% annual
    performanceFeePercent: 10.0, // 10% profit share
    accessFeePercent: 0.0,
    payoutFrequency: "Daily settlement & on-demand payout",
    badge: "Lowest Fees",
    isPopular: false,
    description:
      "Ultra-low fee structure for family offices, syndicates, and high-capital backers with tailored trade mandates and private segregated pools.",
    perks: [
      "Ultra-low 10% performance fee (industry leading)",
      "0.5% annualized institutional management fee",
      "Daily profit settlement & on-demand withdrawals",
      "Exclusive access to private syndicate trading pools",
      "Custom drawdown limits & bespoke risk envelopes",
      "Dedicated quantitative portfolio manager",
      "Institutional audited proof-of-reserve reporting",
    ],
  },
];

export const POOL_ASSET_CLASSES: PoolAssetClassDTO[] = [
  {
    id: "pool-equities",
    slug: "global-equities",
    name: "Global Equities & Tech",
    category: "Stocks & Equities",
    description:
      "Automated momentum and earnings mean-reversion trades across US and European blue-chip equities.",
    avgMonthlyReturnPercent: 8.4,
    historicalSharpe: 2.14,
    riskScore: 2,
    minLockDays: 30,
    availableCapacityUsd: 1250000,
  },
  {
    id: "pool-futures",
    slug: "index-futures",
    name: "Index Futures & Volatility",
    category: "Futures & Derivatives",
    description:
      "High-frequency breakout and grid execution on S&P 500, NASDAQ, DAX, and synthetic volatility indices.",
    avgMonthlyReturnPercent: 12.8,
    historicalSharpe: 2.48,
    riskScore: 3,
    minLockDays: 15,
    availableCapacityUsd: 850000,
  },
  {
    id: "pool-currencies",
    slug: "fx-majors",
    name: "Global Currencies & FX",
    category: "Forex & FX Majors",
    description:
      "Algorithmic macroeconomic carry and session-overlap liquidity capture on G10 currency pairs.",
    avgMonthlyReturnPercent: 6.8,
    historicalSharpe: 2.62,
    riskScore: 1,
    minLockDays: 15,
    availableCapacityUsd: 2100000,
  },
  {
    id: "pool-commodities",
    slug: "metals-energy",
    name: "Metals & Energy Commodities",
    category: "Commodities",
    description:
      "Trend following and spread-arbitrage models on Spot Gold (XAU), Silver (XAG), Crude Oil, and Natural Gas.",
    avgMonthlyReturnPercent: 9.6,
    historicalSharpe: 1.95,
    riskScore: 3,
    minLockDays: 30,
    availableCapacityUsd: 640000,
  },
  {
    id: "pool-crypto",
    slug: "digital-assets",
    name: "Digital Assets & Crypto",
    category: "Cryptocurrencies",
    description:
      "Delta-neutral market making, funding rate arbitrage, and momentum models on BTC, ETH, and high-liquidity altcoins.",
    avgMonthlyReturnPercent: 16.5,
    historicalSharpe: 1.82,
    riskScore: 4,
    minLockDays: 15,
    availableCapacityUsd: 920000,
  },
  {
    id: "pool-multi-quant",
    slug: "multi-asset-quant",
    name: "Multi-Asset Quantitative Alpha",
    category: "Flagship Quant Syndicate",
    description:
      "Flagship diversified pool combining cross-asset correlation models, automated stop-losses, and dynamic AI Guardian risk controls.",
    avgMonthlyReturnPercent: 14.2,
    historicalSharpe: 2.86,
    riskScore: 2,
    minLockDays: 45,
    availableCapacityUsd: 3400000,
  },
];

export const FEE_COMPARISON_MATRIX: FeeComparisonRowDTO[] = [
  {
    feature: "Capital Range",
    tierStarter: "$250 – $9,999",
    tierGrowth: "$10,000 – $99,999",
    tierInstitutional: "$100,000+",
  },
  {
    feature: "Performance Fee (Platform Cut)",
    tierStarter: "20% of net profits",
    tierGrowth: "15% of net profits (25% discount)",
    tierInstitutional: "10% of net profits (50% discount)",
  },
  {
    feature: "Annual Management Fee",
    tierStarter: "1.5% / annum (0.125%/mo)",
    tierGrowth: "1.0% / annum (0.083%/mo)",
    tierInstitutional: "0.5% / annum (0.041%/mo)",
  },
  {
    feature: "Entry / Access Fee",
    tierStarter: "$0 (Free)",
    tierGrowth: "$0 (Free)",
    tierInstitutional: "$0 (Free)",
  },
  {
    feature: "High-Water Mark Protection",
    tierStarter: "Standard (No fee on recovery)",
    tierGrowth: "Standard (No fee on recovery)",
    tierInstitutional: "Audited Ledger Verification",
  },
  {
    feature: "Profit Distribution Cadence",
    tierStarter: "Bi-weekly / at pool close",
    tierGrowth: "Weekly automated crediting",
    tierInstitutional: "Daily settlement on-demand",
  },
  {
    feature: "Capital Lock Durations",
    tierStarter: "15, 30, 45, 60 days",
    tierGrowth: "15, 30, 45, 60, 90 days",
    tierInstitutional: "Custom negotiable duration",
  },
  {
    feature: "Drawdown Risk Floor",
    tierStarter: "AI Guardian 5% trigger",
    tierGrowth: "AI Guardian + Custom TP/SL",
    tierInstitutional: "Segregated Risk Envelopes",
  },
  {
    feature: "Reporting & Statements",
    tierStarter: "In-app dashboard + CSV export",
    tierGrowth: "Full telemetry + Telegram alerts",
    tierInstitutional: "Institutional tax & audit reports",
  },
  {
    feature: "Withdrawal Channels",
    tierStarter: "Bank Wire, Mobile Money, Crypto",
    tierGrowth: "Priority multi-rail processing",
    tierInstitutional: "Instant wire & dedicated OTC desk",
  },
];

export const PRICING_FAQS: PricingFaqDTO[] = [
  {
    id: "faq-how-fees-work",
    category: "fees",
    question: "How are the management and performance fees calculated and charged?",
    answer:
      "Management fees are annualized and prorated strictly to the exact number of days your capital is active in a pool. The performance fee is only deducted from actual net trading profits at each distribution cycle. If a trading cycle does not yield a positive profit, zero performance fee is charged.",
  },
  {
    id: "faq-high-water-mark",
    category: "protection",
    question: "What is High-Water Mark protection and how does it protect my capital?",
    answer:
      "High-Water Mark protection ensures that if a pool experiences any drawdown, our platform cannot take any performance fee until all previously lost capital is fully recovered and your account reaches a new all-time net equity high.",
  },
  {
    id: "faq-different-tiers",
    category: "tiers",
    question: "How does my account qualify for lower fee tiers?",
    answer:
      "Tier discounts apply automatically based on your total active capital across all pools. For example, once your active pooled investments cross $10,000 USD, all subsequent distributions transition to the Prime Growth rate (15% performance fee, 1.0% management fee). Above $100,000 USD, your account unlocks the Institutional tier (10% performance fee, 0.5% management fee).",
  },
  {
    id: "faq-asset-classes",
    category: "investing",
    question: "Can I split my funds across multiple asset classes and pool durations?",
    answer:
      "Yes. You can allocate capital across different crowdfunding pools simultaneously (e.g. $3,000 in Currencies 15-day pool, $5,000 in Index Futures 30-day pool, and $10,000 in Multi-Asset Quant 60-day pool). Each pool functions with its own target duration, risk envelope, and automated trade execution.",
  },
  {
    id: "faq-withdrawals",
    category: "wallet",
    question: "When and how can I withdraw my capital and profits?",
    answer:
      "Profits credited to your tradeMO wallet can be withdrawn anytime with zero lockup. Capital committed to an active crowdfunding pool is released back to your available wallet balance upon the pool's scheduled maturity date. We support Bank Wire (ACH/SEPA/SWIFT), Mobile Money (MTN/Vodafone/M-Pesa), and Crypto (USDT/USDC/BTC/ETH).",
  },
  {
    id: "faq-who-trades",
    category: "execution",
    question: "Who executes the trades and how are orders managed?",
    answer:
      "All trades are executed algorithmically by our proprietary quantitative engines and lead traders across institutional Tier-1 liquidity feeds. Backers and investors do not need to configure trading bots or monitor charts—you simply fund pool slots, track telemetry in real time, and receive automated proportional profit splits.",
  },
];

export const PRICING_FALLBACK: PricingContentDTO = {
  hero: {
    key: PRICING_HERO.key,
    eyebrow: PRICING_HERO.eyebrow,
    title: PRICING_HERO.title,
    subtitle: PRICING_HERO.subtitle,
    payload: PRICING_HERO.payload,
  },
  tiers: PRICING_TIERS,
  assetClasses: POOL_ASSET_CLASSES,
  feeComparison: FEE_COMPARISON_MATRIX,
  faqs: PRICING_FAQS,
  cta: {
    key: "pricing-cta",
    eyebrow: "Start Backing Trades",
    title: "Join thousands of backers earning transparent quantitative yields.",
    subtitle:
      "Open your free investor wallet in under 2 minutes. No subscription fees, no bot maintenance, and low minimums starting from $250.",
    payload: {
      title: "Join thousands of backers earning transparent quantitative yields.",
      description:
        "Open your free investor wallet in under 2 minutes. No subscription fees, no bot maintenance, and low minimums starting from $250.",
      primaryCta: { label: "Create Backer Account", href: "/auth/signup?role=investor" },
      secondaryCta: { label: "Explore Active Pools", href: "/investor/pools" },
      formHeading: "Get pool capacity alerts",
      formNote: "Receive early notice when new high-capacity crowdfunding trade pools open. Unsubscribe anytime.",
      trustPoints: [
        "Zero subscription fees — pure performance alignment",
        "High-Water Mark protection on every pool",
        "Multi-rail instant withdrawals across 4 payment methods",
      ],
    },
  },
  meta: { source: "fallback", generatedAt: new Date(0).toISOString(), version: 1 },
};
