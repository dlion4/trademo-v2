import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * tradeMO Database Schema
 * Structured models for Landing (H-1), Features (H-2), and Pricing & Fee Tiers (H-3).
 */

/* ══════════════════ PAGE H-1 · LANDING ══════════════════ */

export const landingSections = pgTable(
  "landing_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    eyebrow: text("eyebrow"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("landing_sections_key_idx").on(table.key)],
);

export const landingStats = pgTable("landing_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  value: doublePrecision("value").default(0).notNull(),
  prefix: text("prefix").default("").notNull(),
  suffix: text("suffix").default("").notNull(),
  decimals: integer("decimals").default(0).notNull(),
  caption: text("caption"),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const tickerInstruments = pgTable("ticker_instruments", {
  id: uuid("id").primaryKey().defaultRandom(),
  symbol: text("symbol").notNull(),
  displayName: text("display_name").notNull(),
  market: text("market").notNull(),
  price: doublePrecision("price").default(0).notNull(),
  changePercent: doublePrecision("change_percent").default(0).notNull(),
  dayHigh: doublePrecision("day_high").default(0).notNull(),
  dayLow: doublePrecision("day_low").default(0).notNull(),
  sparkline: jsonb("sparkline").$type<number[]>().default([]).notNull(),
  decimals: integer("decimals").default(2).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const platformFeatures = pgTable("platform_features", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  icon: text("icon").notNull(),
  eyebrow: text("eyebrow"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  bullets: jsonb("bullets").$type<string[]>().default([]).notNull(),
  metricLabel: text("metric_label"),
  metricValue: text("metric_value"),
  badge: text("badge"),
  accent: text("accent").default("teal").notNull(),
  href: text("href").default("#").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const howItWorksSteps = pgTable("how_it_works_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  stepNumber: integer("step_number").notNull(),
  icon: text("icon").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  highlights: jsonb("highlights").$type<string[]>().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const trustBadges = pgTable("trust_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  icon: text("icon").notNull(),
  label: text("label").notNull(),
  detail: text("detail"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: text("role").default("investor").notNull(),
    source: text("source").default("landing-cta").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("waitlist_signups_email_idx").on(table.email)],
);

/* ══════════════════ PAGE H-2 · FEATURES ══════════════════ */

export const featuresSections = pgTable(
  "features_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    eyebrow: text("eyebrow"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("features_sections_key_idx").on(table.key)],
);

export const featureModules = pgTable("feature_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  number: text("number").notNull(),
  icon: text("icon").notNull(),
  eyebrow: text("eyebrow").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  bullets: jsonb("bullets").$type<string[]>().default([]).notNull(),
  specs: jsonb("specs").$type<{ label: string; value: string }[]>().default([]).notNull(),
  demo: jsonb("demo").$type<Record<string, unknown>>().default({}).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const featureMatrixRows = pgTable("feature_matrix_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupName: text("group_name").notNull(),
  capability: text("capability").notNull(),
  operatorLevel: text("operator_level").notNull(),
  investorLevel: text("investor_level").notNull(),
  note: text("note").default("").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

/* ══════════════════ PAGE H-3 · PRICING & FEE TIERS ══════════════════ */

export const pricingSections = pgTable(
  "pricing_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    eyebrow: text("eyebrow"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("pricing_sections_key_idx").on(table.key)],
);

/** Investor Capital Tiers (<$10k, $10k-$100k, >$100k). */
export const pricingTiers = pgTable("pricing_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  headline: text("headline").notNull(),
  minCapital: doublePrecision("min_capital").notNull(),
  maxCapital: doublePrecision("max_capital"), // null = unlimited
  managementFeePercent: doublePrecision("management_fee_percent").notNull(), // annual %
  performanceFeePercent: doublePrecision("performance_fee_percent").notNull(), // profit split %
  accessFeePercent: doublePrecision("access_fee_percent").default(0).notNull(), // one-off/entry %
  payoutFrequency: text("payout_frequency").notNull(),
  badge: text("badge"),
  isPopular: boolean("is_popular").default(false).notNull(),
  description: text("description").notNull(),
  perks: jsonb("perks").$type<string[]>().default([]).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

/** Supported Crowdfunding Pool Asset Classes for the return calculator. */
export const poolAssetClasses = pgTable("pool_asset_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  avgMonthlyReturnPercent: doublePrecision("avg_monthly_return_percent").notNull(),
  historicalSharpe: doublePrecision("historical_sharpe").notNull(),
  riskScore: integer("risk_score").notNull(), // 1 to 5
  minLockDays: integer("min_lock_days").notNull(),
  availableCapacityUsd: doublePrecision("available_capacity_usd").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

/** Frequently Asked Questions on Pricing & Fund Management. */
export const pricingFaqs = pgTable("pricing_faqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").default("general").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export type LandingSectionRow = typeof landingSections.$inferSelect;
export type LandingStatRow = typeof landingStats.$inferSelect;
export type TickerInstrumentRow = typeof tickerInstruments.$inferSelect;
export type PlatformFeatureRow = typeof platformFeatures.$inferSelect;
export type HowItWorksStepRow = typeof howItWorksSteps.$inferSelect;
export type TrustBadgeRow = typeof trustBadges.$inferSelect;
export type WaitlistSignupRow = typeof waitlistSignups.$inferSelect;
export type FeaturesSectionRow = typeof featuresSections.$inferSelect;
export type FeatureModuleRow = typeof featureModules.$inferSelect;
export type FeatureMatrixRowRow = typeof featureMatrixRows.$inferSelect;
export type PricingSectionRow = typeof pricingSections.$inferSelect;
/** Operator Scheduled Trade Sequences — Page D-2 (/dashboard/schedules). */
export const tradingSchedules = pgTable("trading_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD anchor date
  endDate: text("end_date"), // optional range end YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM UTC
  endTime: text("end_time").notNull(), // HH:MM UTC
  symbol: text("symbol").notNull(),
  contractType: text("contract_type").default("CALL").notNull(),
  strategy: text("strategy").notNull(),
  initialStake: doublePrecision("initial_stake").notNull(),
  maxTrades: integer("max_trades").notNull(),
  completedTrades: integer("completed_trades").default(0).notNull(),
  packageIds: jsonb("package_ids").$type<string[]>().default([]).notNull(),
  packageAllocation: jsonb("package_allocation")
    .$type<Record<string, number>>()
    .default({})
    .notNull(),
  recurrence: text("recurrence").default("weekdays").notNull(),
  cronExpression: text("cron_expression"),
  stopLoss: doublePrecision("stop_loss").default(500).notNull(),
  takeProfit: doublePrecision("take_profit").default(1000).notNull(),
  maxDrawdown: doublePrecision("max_drawdown").default(5).notNull(),
  cooldownLosses: integer("cooldown_losses").default(3).notNull(),
  cooldownDuration: integer("cooldown_duration").default(300).notNull(),
  status: text("status").default("queued").notNull(),
  botCode: text("bot_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Historical Completed Schedule Runs — Section 6 of Page D-2. */
export const scheduleRuns = pgTable("schedule_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduleCode: text("schedule_code").notNull(),
  scheduleName: text("schedule_name").notNull(),
  executedDate: text("executed_date").notNull(),
  windowLabel: text("window_label").notNull(),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull(),
  packageCodes: jsonb("package_codes").$type<string[]>().default([]).notNull(),
  tradesExecuted: integer("trades_executed").notNull(),
  maxTrades: integer("max_trades").notNull(),
  winsCount: integer("wins_count").notNull(),
  winRatePercent: doublePrecision("win_rate_percent").notNull(),
  grossStake: doublePrecision("gross_stake").notNull(),
  netPnL: doublePrecision("net_pnl").notNull(),
  roiPercent: doublePrecision("roi_percent").notNull(),
  exitReason: text("exit_reason").default("window_complete").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Macro News / Session Blackout Windows for the Trade Scheduler. */
export const scheduleBlackouts = pgTable("schedule_blackouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  affectedMarkets: jsonb("affected_markets").$type<string[]>().default([]).notNull(),
  action: text("action").default("skip_fx").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export type PricingTierRow = typeof pricingTiers.$inferSelect;
export type PoolAssetClassRow = typeof poolAssetClasses.$inferSelect;
export type PricingFaqRow = typeof pricingFaqs.$inferSelect;
export type TradingScheduleRow = typeof tradingSchedules.$inferSelect;
export type ScheduleRunRow = typeof scheduleRuns.$inferSelect;
export type ScheduleBlackoutRow = typeof scheduleBlackouts.$inferSelect;
