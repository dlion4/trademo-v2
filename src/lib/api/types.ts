/**
 * ─────────────────────────────────────────────────────────────────────────────
 * tradeMO · Frontend data contracts & DTOs
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all Home pages (H-1 Landing, H-2 Features, H-3 Pricing).
 */

export type MarketDirection = "up" | "down" | "flat";
export type ContentSource = "database" | "fallback";

export interface CtaLinkDTO {
  label: string;
  href: string;
}

export interface ContentMetaDTO {
  source: ContentSource;
  generatedAt: string;
  version: number;
}

export interface SectionDTO<TPayload> {
  key: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  payload: TPayload;
}

/* ════════════════════════════════════════════════════════════════════════
 * PAGE H-1 — Landing (/)
 * ════════════════════════════════════════════════════════════════════════ */

export interface HeroConsoleTradeDTO {
  id: string;
  symbol: string;
  side: "BUY" | "SELL" | "CALL" | "PUT";
  stake: number;
  payout: number;
  result: "won" | "lost" | "live";
  secondsAgo: number;
}

export interface HeroConsoleDTO {
  accountLabel: string;
  status: "live" | "paused" | "idle";
  strategy: string;
  market: string;
  capitalPooled: number;
  activeBots: number;
  operatorSharePercent: number;
  trades: HeroConsoleTradeDTO[];
}

export interface HeroPayloadDTO {
  headlineHighlight: string;
  highlights: string[];
  primaryCta: CtaLinkDTO;
  secondaryCta: CtaLinkDTO;
  console: HeroConsoleDTO;
}

export interface CtaSectionPayloadDTO {
  title: string;
  description: string;
  primaryCta: CtaLinkDTO;
  secondaryCta: CtaLinkDTO;
  formHeading: string;
  formNote: string;
  trustPoints: string[];
}

export interface HowItWorksPayloadDTO {
  footnote: string;
}

export interface StatDTO {
  id: string;
  key: string;
  label: string;
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
  caption: string | null;
  icon: string | null;
}

export interface FeatureDTO {
  id: string;
  slug: string;
  icon: string;
  eyebrow: string | null;
  title: string;
  description: string;
  bullets: string[];
  metricLabel: string | null;
  metricValue: string | null;
  badge: string | null;
  accent: "teal" | "violet" | "amber";
  href: string;
}

export interface StepDTO {
  id: string;
  stepNumber: number;
  icon: string;
  title: string;
  description: string;
  highlights: string[];
}

export interface TrustBadgeDTO {
  id: string;
  icon: string;
  label: string;
  detail: string | null;
}

export interface TickerQuoteDTO {
  symbol: string;
  displayName: string;
  market: string;
  price: number;
  changePercent: number;
  direction: MarketDirection;
  dayHigh: number;
  dayLow: number;
  sparkline: number[];
  decimals: number;
  updatedAt: string;
}

export interface LandingContentDTO {
  hero: SectionDTO<HeroPayloadDTO>;
  howItWorks: SectionDTO<HowItWorksPayloadDTO>;
  cta: SectionDTO<CtaSectionPayloadDTO>;
  stats: StatDTO[];
  features: FeatureDTO[];
  steps: StepDTO[];
  trustBadges: TrustBadgeDTO[];
  ticker: TickerQuoteDTO[];
  meta: ContentMetaDTO;
}

export interface TickerFeedDTO {
  quotes: TickerQuoteDTO[];
  meta: ContentMetaDTO;
}

export interface WaitlistSignupRequestDTO {
  email: string;
  role?: "operator" | "investor";
  source?: string;
  note?: string;
}

export interface WaitlistSignupResponseDTO {
  id: string;
  email: string;
  role: string;
  position: number;
  message: string;
}

/* ════════════════════════════════════════════════════════════════════════
 * PAGE H-2 — Features (/features)
 * ════════════════════════════════════════════════════════════════════════ */

export interface FeaturesHeroPayloadDTO {
  headlineHighlight: string;
  chips: string[];
  kpis: { key: string; value: string; label: string }[];
  primaryCta: CtaLinkDTO;
  secondaryCta: CtaLinkDTO;
}

export interface ScheduleWindowDTO {
  id: string;
  day: number;
  startHour: number;
  endHour: number;
  botName: string;
  state: "active" | "paused";
}

export interface TradeFeedRowDTO {
  id: string;
  time: string;
  symbol: string;
  contract: string;
  stake: number;
  pnl: number | null;
  state: "won" | "lost" | "open";
}

export interface ConfigFieldDTO {
  key: string;
  label: string;
  value: string;
}

export interface RiskCheckDTO {
  id: string;
  label: string;
  detail: string;
}

export interface EquityPointDTO {
  label: string;
  value: number;
}

export interface SandboxApiDTO {
  signature: string;
  description: string;
}

export interface SandboxLimitDTO {
  key: string;
  value: string;
  label: string;
}

export interface PoolStageDTO {
  key: string;
  name: string;
  title: string;
  description: string;
  meta: string[];
}

export interface ShareExampleDTO {
  invested: number;
  poolCapital: number;
  poolPnl: number;
  operatorSharePercent: number;
  note: string;
}

export interface PayoutMilestoneDTO {
  id: string;
  when: string;
  what: string;
  note: string;
  done: boolean;
}

export interface GuardianRuleDTO {
  id: string;
  name: string;
  metric: string;
  threshold: string;
  current: number;
  hot: boolean;
  action: string;
}

export interface GuardianEventDTO {
  id: string;
  time: string;
  severity: "info" | "warn" | "halt";
  message: string;
  scope: string;
}

export interface GuardianFlowDTO {
  id: string;
  title: string;
  description: string;
}

export interface MarketSymbolDTO {
  symbol: string;
  name: string;
  price: number;
  decimals: number;
  changePercent: number;
  contracts: string;
  open: string;
}

export interface MarketGroupDTO {
  key: string;
  name: string;
  symbols: MarketSymbolDTO[];
}

export interface ContractTypeGroupDTO {
  name: string;
  count: number;
  examples: string;
}

export interface DurationOptionDTO {
  unit: "ticks" | "seconds" | "minutes" | "hours" | "days";
  min: number;
  max: number;
  step: number;
  default: number;
  note: string;
}

export type FeatureDemoDTO =
  | {
      kind: "botEngine";
      schedule: ScheduleWindowDTO[];
      feed: TradeFeedRowDTO[];
      config: ConfigFieldDTO[];
      riskChecks: RiskCheckDTO[];
      equity: EquityPointDTO[];
      equityLabel: string;
    }
  | {
      kind: "scriptEngine";
      fileName: string;
      code: string;
      api: SandboxApiDTO[];
      limits: SandboxLimitDTO[];
    }
  | {
      kind: "pools";
      lifecycle: PoolStageDTO[];
      share: ShareExampleDTO;
      timeline: PayoutMilestoneDTO[];
    }
  | {
      kind: "guardian";
      rules: GuardianRuleDTO[];
      events: GuardianEventDTO[];
      flow: GuardianFlowDTO[];
    }
  | {
      kind: "markets";
      markets: MarketGroupDTO[];
      contractTypes: ContractTypeGroupDTO[];
      durations: DurationOptionDTO[];
    };

export interface FeatureModuleDTO {
  id: string;
  slug: string;
  number: string;
  icon: string;
  eyebrow: string;
  title: string;
  summary: string;
  bullets: string[];
  specs: { label: string; value: string }[];
  demo: FeatureDemoDTO;
}

export type SupportLevel = "full" | "partial" | "none";

export interface MatrixRowDTO {
  id: string;
  group: string;
  capability: string;
  operator: SupportLevel;
  investor: SupportLevel;
  note: string;
}

export interface FeaturesContentDTO {
  hero: SectionDTO<FeaturesHeroPayloadDTO>;
  modules: FeatureModuleDTO[];
  matrix: MatrixRowDTO[];
  cta: SectionDTO<CtaSectionPayloadDTO>;
  meta: ContentMetaDTO;
}

/* ════════════════════════════════════════════════════════════════════════
 * PAGE H-3 — Pricing & Investor Fee Tiers (/pricing)
 * ════════════════════════════════════════════════════════════════════════ */

export interface PricingHeroPayloadDTO {
  headlineHighlight: string;
  chips: string[];
  kpis: { key: string; value: string; label: string }[];
  primaryCta: CtaLinkDTO;
  secondaryCta: CtaLinkDTO;
}

export interface PricingTierDTO {
  id: string;
  slug: string;
  name: string;
  headline: string;
  minCapital: number;
  maxCapital: number | null;
  managementFeePercent: number; // annual %
  performanceFeePercent: number; // profit split %
  accessFeePercent: number; // entry %
  payoutFrequency: string;
  badge: string | null;
  isPopular: boolean;
  description: string;
  perks: string[];
}

export interface PoolAssetClassDTO {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  avgMonthlyReturnPercent: number;
  historicalSharpe: number;
  riskScore: number; // 1-5
  minLockDays: number;
  availableCapacityUsd: number;
}

export interface PricingFaqDTO {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface FeeComparisonRowDTO {
  feature: string;
  tierStarter: string;
  tierGrowth: string;
  tierInstitutional: string;
}

export interface PricingContentDTO {
  hero: SectionDTO<PricingHeroPayloadDTO>;
  tiers: PricingTierDTO[];
  assetClasses: PoolAssetClassDTO[];
  feeComparison: FeeComparisonRowDTO[];
  faqs: PricingFaqDTO[];
  cta: SectionDTO<CtaSectionPayloadDTO>;
  meta: ContentMetaDTO;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ContentMetaDTO & { requestId: string };
}
