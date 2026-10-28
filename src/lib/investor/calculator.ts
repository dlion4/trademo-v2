/**
 * I-8 · Investment calculator — pure maths, DTOs and the local command reducer.
 *
 * Every figure on `/investor/calculator` comes out of this module: the ROI
 * projection, the compound schedule, the fee breakdown, the scenario grid and
 * the historical statistics. Nothing is pre-computed into a string, so a
 * backend can serve `CalculatorWorkspace` and this file keeps working.
 *
 * Two rules the maths follows, because the brief's own examples follow them:
 *   1. The platform cut is taken off **gross** earnings, so net = gross × (1 − cut).
 *   2. Compounding rolls the **net** figure forward — the cut is charged on every
 *      cycle, not once at the end.
 *
 * Fees are shared with I-7: deposit rails and payout rails are the wallet's own
 * definitions, so the calculator can never quote a fee the wallet does not charge.
 */

import {
  money,
  payoutFee as walletPayoutFee,
  round2,
  shortDateOf,
  type WalletMethodKind,
} from "./wallet";

export type { WalletMethodKind };

export const CALCULATOR_AS_OF = "2026-10-23T10:00:00Z";
export const PLATFORM_CUT_PCT = 20;
export const MIN_AMOUNT = 500;
export const MAX_AMOUNT = 50_000;
export const AMOUNT_STEP = 100;
export const MIN_ROI_PCT = 5;
export const MAX_ROI_PCT = 30;
export const ROI_STEP = 0.5;
export const MIN_DAYS = 7;
export const MAX_DAYS = 30;
export const MIN_POOLS = 1;
export const MAX_POOLS = 12;
export const DEFAULT_POOLS = 6;
export const SCENARIO_BANDS = {
  conservative: 8,
  expected: 15,
  optimistic: 25,
} as const;
export const DEFAULT_PREFERENCES = {
  reinvest: true,
  compoundPools: 6,
  showGross: true,
  includeFees: true,
  payoutFeeWaived: true,
} as const;

export const SCENARIO_SLOTS = [1, 2, 3] as const;
export const HISTORY_SIZE = 10;

/* ── Types ── */

export type ScenarioBand = keyof typeof SCENARIO_BANDS;
export type ExportScope =
  | "projection"
  | "compound"
  | "fees"
  | "scenarios"
  | "historical";
export type ExportFormat = "pdf" | "csv" | "json";
export type AckScope = "risk" | "methodology" | "fees";
export type SupportTopic = "roi" | "compound" | "fees" | "scenario" | "other";
export type ShareChannel = "copy" | "link" | "email" | "whatsapp";

export interface CalculatorProfile {
  id: string;
  displayName: string;
  investorSince: string;
  tier: string;
  country: string;
  currency: string;
  kycLevel: "L1" | "L2" | "L3";
  walletAvailable: number;
  unread: number;
  monthRoiPct: number;
  lifetimeNet: number;
}

export interface CalculatorInputs {
  amount: number;
  roiPct: number;
  durationDays: number;
}

export interface CalculatorBounds {
  amount: { min: number; max: number; step: number };
  roiPct: { min: number; max: number; step: number };
  durationDays: { min: number; max: number; step: number };
  slots: { min: number; max: number };
}

/** A pool the calculator can project against and hand off to I-4. */
export interface CalculatorPool {
  id: string;
  code: string;
  name: string;
  lifecycle: "trading" | "open" | "upcoming";
  strategy: string;
  markets: string[];
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  slotPrice: number;
  durationDays: number;
  expectedRoiPct: number;
  minSlot: number;
  maxSlotsPerUser: number;
  profitSharePct: number;
  closesAt: string;
  bookable: boolean;
  bookingHref: string;
  detailHref: string;
}

export interface CalculatorRail {
  key: string;
  label: string;
  feePct: number;
  feeFlat: number;
  feeNote: string;
  eta: string;
}

export interface CalculatorPayoutMethod {
  id: string;
  label: string;
  kind: WalletMethodKind;
  detail: string;
  feeNote: string;
  verified: boolean;
  payoutEnabled: boolean;
}

export interface RoiProjection {
  amount: number;
  slots: number;
  slotPrice: number;
  roiPct: number;
  durationDays: number;
  grossEarnings: number;
  platformCutPct: number;
  platformCut: number;
  netEarnings: number;
  totalReturn: number;
  dailyNet: number;
  netRoiPct: number;
  effectiveApy: number;
}

export interface CompoundRow {
  index: number;
  start: number;
  roiPct: number;
  gross: number;
  cut: number;
  net: number;
  end: number;
  cumulativeNet: number;
}

export interface CompoundPlan {
  principal: number;
  roiPct: number;
  pools: number;
  reinvest: boolean;
  platformCutPct: number;
  rows: CompoundRow[];
  finalBalance: number;
  totalNet: number;
  totalGross: number;
  totalCut: number;
  growthPct: number;
}

export interface FeeInput {
  amount: number;
  roiPct: number;
  platformCutPct: number;
  depositFeePct: number;
  depositFeeFlat: number;
  payoutKind: WalletMethodKind;
  payoutFeeWaived: boolean;
}

export interface FeeBreakdown {
  amount: number;
  grossEarnings: number;
  depositFee: number;
  platformSharePct: number;
  platformShare: number;
  payoutFee: number;
  payoutFeeWaived: boolean;
  totalFees: number;
  netEarnings: number;
  totalReturn: number;
  costPct: number;
}

export interface ScenarioRow {
  slots: number;
  investment: number;
  conservativeRoiPct: number;
  conservativeNet: number;
  expectedRoiPct: number;
  expectedNet: number;
  optimisticRoiPct: number;
  optimisticNet: number;
  grossExpected: number;
}

export interface HistoricalPool {
  id: string;
  code: string;
  name: string;
  strategy: string;
  markets: string[];
  slotPrice: number;
  durationDays: number;
  capital: number;
  investors: number;
  roiPct: number;
  winRatePct: number;
  trades: number;
  startedAt: string;
  completedAt: string;
  note: string;
}

export interface HistoricalStats {
  count: number;
  average: number;
  median: number;
  best: HistoricalPool | null;
  worst: HistoricalPool | null;
  winRateMin: number;
  winRateMax: number;
  totalTrades: number;
  totalCapital: number;
  positive: number;
}

export interface CalculatorPreset {
  id: string;
  name: string;
  amount: number;
  roiPct: number;
  durationDays: number;
  pinned: boolean;
  note: string;
  createdAt: string;
}

export interface SavedScenario {
  id: string;
  poolId: string;
  poolCode: string;
  slots: number;
  amount: number;
  roiPct: number;
  durationDays: number;
  band: ScenarioBand;
  status: "saved" | "queued";
  note: string;
  createdAt: string;
}

export interface CalculatorPreferences {
  reinvest: boolean;
  compoundPools: number;
  showGross: boolean;
  includeFees: boolean;
  payoutFeeWaived: boolean;
}

export interface CalculatorExport {
  id: string;
  scope: ExportScope;
  format: ExportFormat;
  count: number;
  createdAt: string;
}

export interface CalculatorAck {
  scope: AckScope;
  at: string;
}

export interface CalculatorSupport {
  id: string;
  topic: SupportTopic;
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface CalculatorAudit {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface CalculatorWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: CalculatorProfile;
  defaults: CalculatorInputs;
  bounds: CalculatorBounds;
  platformCutPct: number;
  slotPrice: number;
  defaultPoolId: string;
  pools: CalculatorPool[];
  depositRails: CalculatorRail[];
  payoutMethods: CalculatorPayoutMethod[];
  bands: typeof SCENARIO_BANDS;
  scenarioSlots: number[];
  historical: HistoricalPool[];
  presets: CalculatorPreset[];
  savedScenarios: SavedScenario[];
  preferences: CalculatorPreferences;
  exports: CalculatorExport[];
  acknowledgements: CalculatorAck[];
  support: CalculatorSupport[];
  audit: CalculatorAudit[];
}

/* ── Formatting ── */

export { money, round2, shortDateOf };

/** Percent without a currency sign, e.g. `15.0%`. */
export const pct = (value: number, decimals = 1) =>
  `${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;

export const signedPct = (value: number, decimals = 1) =>
  `${value >= 0 ? "+" : "−"}${pct(Math.abs(value), decimals)}`;

export const signedMoney = (value: number, decimals = 2) =>
  `${value >= 0 ? "+" : "−"}${money(Math.abs(value), decimals)}`;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/* ── ROI projection ── */

export const slotCount = (amount: number, slotPrice: number) =>
  Math.max(1, Math.round(Math.max(0, amount) / Math.max(1, slotPrice)));

export function roiProjection(input: {
  amount: number;
  roiPct: number;
  durationDays: number;
  platformCutPct: number;
  slotPrice: number;
}): RoiProjection {
  const amount = round2(Math.max(0, input.amount));
  const grossEarnings = round2((amount * Math.max(0, input.roiPct)) / 100);
  const platformCut = round2((grossEarnings * input.platformCutPct) / 100);
  const netEarnings = round2(grossEarnings - platformCut);
  const days = Math.max(1, input.durationDays);
  const netRoiPct = amount > 0 ? round2((netEarnings / amount) * 100) : 0;
  return {
    amount,
    slots: slotCount(amount, input.slotPrice),
    slotPrice: input.slotPrice,
    roiPct: input.roiPct,
    durationDays: days,
    grossEarnings,
    platformCutPct: input.platformCutPct,
    platformCut,
    netEarnings,
    totalReturn: round2(amount + netEarnings),
    dailyNet: round2(netEarnings / days),
    netRoiPct,
    effectiveApy: round2((netRoiPct * 365) / days),
  };
}

/* ── Compound schedule ── */

export function compoundPlan(input: {
  principal: number;
  roiPct: number;
  pools: number;
  platformCutPct: number;
  reinvest: boolean;
}): CompoundPlan {
  const principal = round2(Math.max(0, input.principal));
  const pools = clamp(Math.round(input.pools), MIN_POOLS, MAX_POOLS);
  const netRate = (Math.max(0, input.roiPct) * (1 - input.platformCutPct / 100)) / 100;
  let start = principal;
  let cumulativeNet = 0;
  let totalGross = 0;
  let totalCut = 0;
  const rows: CompoundRow[] = [];

  for (let index = 1; index <= pools; index += 1) {
    const base = input.reinvest ? start : principal;
    const gross = round2(base * (Math.max(0, input.roiPct) / 100));
    const cut = round2((gross * input.platformCutPct) / 100);
    const net = round2(base * netRate);
    const end = round2(base + net);
    cumulativeNet = round2(cumulativeNet + net);
    totalGross = round2(totalGross + gross);
    totalCut = round2(totalCut + cut);
    rows.push({
      index,
      start: base,
      roiPct: input.roiPct,
      gross,
      cut,
      net,
      end,
      cumulativeNet,
    });
    start = end;
  }

  const finalBalance = rows.length ? rows[rows.length - 1].end : principal;
  return {
    principal,
    roiPct: input.roiPct,
    pools,
    reinvest: input.reinvest,
    platformCutPct: input.platformCutPct,
    rows,
    finalBalance,
    totalNet: cumulativeNet,
    totalGross,
    totalCut,
    growthPct: principal > 0 ? round2(((finalBalance - principal) / principal) * 100) : 0,
  };
}

/* ── Fees ── */

export function feeBreakdown(input: FeeInput): FeeBreakdown {
  const amount = round2(Math.max(0, input.amount));
  const grossEarnings = round2((amount * Math.max(0, input.roiPct)) / 100);
  const depositFee = round2(
    (amount * Math.max(0, input.depositFeePct)) / 100 + Math.max(0, input.depositFeeFlat),
  );
  const platformShare = round2((grossEarnings * input.platformCutPct) / 100);
  const grossAfterShare = round2(grossEarnings - platformShare);
  const payoutFee = input.payoutFeeWaived
    ? 0
    : walletPayoutFee(Math.max(0, grossAfterShare), input.payoutKind);
  const totalFees = round2(depositFee + platformShare + payoutFee);
  const netEarnings = round2(grossEarnings - platformShare - payoutFee);
  return {
    amount,
    grossEarnings,
    depositFee,
    platformSharePct: input.platformCutPct,
    platformShare,
    payoutFee,
    payoutFeeWaived: input.payoutFeeWaived,
    totalFees,
    netEarnings,
    totalReturn: round2(amount + netEarnings),
    costPct: amount > 0 ? round2((totalFees / amount) * 100) : 0,
  };
}

/* ── Scenario grid ── */

export function scenarioMatrix(input: {
  slotPrice: number;
  platformCutPct: number;
  slots?: readonly number[];
  bands?: { conservative: number; expected: number; optimistic: number };
}): ScenarioRow[] {
  const slots = input.slots ?? SCENARIO_SLOTS;
  const bands = input.bands ?? SCENARIO_BANDS;
  const netOf = (investment: number, roiPct: number) =>
    round2(investment * (roiPct / 100) * (1 - input.platformCutPct / 100));

  return slots.map((count) => {
    const investment = round2(count * input.slotPrice);
    return {
      slots: count,
      investment,
      conservativeRoiPct: bands.conservative,
      conservativeNet: netOf(investment, bands.conservative),
      expectedRoiPct: bands.expected,
      expectedNet: netOf(investment, bands.expected),
      optimisticRoiPct: bands.optimistic,
      optimisticNet: netOf(investment, bands.optimistic),
      grossExpected: round2((investment * bands.expected) / 100),
    };
  });
}

/* ── Historical statistics ── */

export function historicalStats(pools: HistoricalPool[]): HistoricalStats {
  if (!pools.length) {
    return {
      count: 0,
      average: 0,
      median: 0,
      best: null,
      worst: null,
      winRateMin: 0,
      winRateMax: 0,
      totalTrades: 0,
      totalCapital: 0,
      positive: 0,
    };
  }
  const sorted = [...pools].sort((a, b) => a.roiPct - b.roiPct);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? round2((sorted[middle - 1].roiPct + sorted[middle].roiPct) / 2)
      : sorted[middle].roiPct;
  return {
    count: pools.length,
    average: round2(
      pools.reduce((sum, pool) => sum + pool.roiPct, 0) / pools.length,
    ),
    median,
    best: sorted[sorted.length - 1],
    worst: sorted[0],
    winRateMin: Math.min(...pools.map((pool) => pool.winRatePct)),
    winRateMax: Math.max(...pools.map((pool) => pool.winRatePct)),
    totalTrades: pools.reduce((sum, pool) => sum + pool.trades, 0),
    totalCapital: round2(pools.reduce((sum, pool) => sum + pool.capital, 0)),
    positive: pools.filter((pool) => pool.roiPct > 0).length,
  };
}

/** Y-axis ticks for the compound / history charts, always including zero. */
export function chartTicks(values: number[], count = 4) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  return Array.from({ length: count + 1 }, (_, index) =>
    round2(min + (span * index) / count),
  );
}

/** Chart geometry: map a series to 0–100 viewport coordinates. */
export function sparkline(values: number[], width = 100, height = 34) {
  if (!values.length) return { points: "", area: "", min: 0, max: 0 };
  const min = Math.min(...values, 0);
  const max = Math.max(...values, min + 1);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => {
    const x = round2(index * step);
    const y = round2(height - ((value - min) / span) * height);
    return `${x},${y}`;
  });
  return {
    points: points.join(" "),
    area: `0,${height} ${points.join(" ")} ${round2((values.length - 1) * step)},${height}`,
    min,
    max,
  };
}

/* ── Validation ── */

export function calculatorDraftError(input: {
  amount: number;
  roiPct: number;
  durationDays: number;
  slotPrice: number;
  terms: boolean;
}): string {
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return "Enter an investment amount";
  if (input.amount < MIN_AMOUNT) return `Minimum is ${money(MIN_AMOUNT)}`;
  if (input.amount > MAX_AMOUNT) return `Maximum is ${money(MAX_AMOUNT)}`;
  if (input.amount % input.slotPrice !== 0)
    return `Amounts must be a multiple of the ${money(input.slotPrice)} slot price`;
  if (input.roiPct < MIN_ROI_PCT || input.roiPct > MAX_ROI_PCT)
    return `ROI has to sit between ${MIN_ROI_PCT}% and ${MAX_ROI_PCT}%`;
  if (input.durationDays < MIN_DAYS || input.durationDays > MAX_DAYS)
    return `Duration has to sit between ${MIN_DAYS} and ${MAX_DAYS} days`;
  if (!input.terms) return "Acknowledge the projection terms to continue";
  return "";
}

/** Hand-off guard for the booking wizard: pool limits plus wallet funding. */
/**
 * Validates the calculator → booking hand-off. Funding is a warning, not a
 * gate: the calculator projects, and the I-4 booking flow owns the top-up. Pass
 * `requireFunds: false` on the final confirm so a short wallet cannot dead-end
 * the projection.
 */
export function bookingDraftError(input: {
  amount: number;
  slots: number;
  maxSlots: number;
  available: number;
  terms: boolean;
  requireFunds?: boolean;
}): string {
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return "Pick how many slots you want";
  if (input.slots < 1) return "Pick at least one slot";
  if (input.slots > input.maxSlots)
    return `This pool allows ${input.maxSlots} slot${input.maxSlots === 1 ? "" : "s"} per investor`;
  if (input.requireFunds !== false && input.amount > input.available)
    return `Only ${money(input.available, 2)} is available — the booking flow will ask you to top up first`;
  if (!input.terms) return "Acknowledge the booking terms to continue";
  return "";
}

/* ── Commands ── */

import { z } from "zod";

const bandEnum = z.enum(["conservative", "expected", "optimistic"]);
const poolRef = z.string().min(2).max(40);

export const calculatorCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("saveScenario"),
    poolId: poolRef,
    poolCode: z.string().min(2).max(20),
    slots: z.number().int().min(1).max(50),
    amount: z.number().min(MIN_AMOUNT).max(MAX_AMOUNT),
    roiPct: z.number().min(MIN_ROI_PCT).max(MAX_ROI_PCT),
    durationDays: z.number().int().min(MIN_DAYS).max(MAX_DAYS),
    band: bandEnum,
    note: z.string().max(160).default(""),
  }),
  z.object({
    kind: z.literal("deleteScenario"),
    scenarioId: z.string().min(2).max(60),
  }),
  z.object({
    kind: z.literal("queueBooking"),
    poolId: poolRef,
    poolCode: z.string().min(2).max(20),
    slots: z.number().int().min(1).max(50),
    amount: z.number().min(MIN_AMOUNT).max(MAX_AMOUNT),
    roiPct: z.number().min(MIN_ROI_PCT).max(MAX_ROI_PCT),
    durationDays: z.number().int().min(MIN_DAYS).max(MAX_DAYS),
    note: z.string().max(160).default(""),
  }),
  z.object({
    kind: z.literal("savePreset"),
    name: z.string().trim().min(3).max(40),
    amount: z.number().min(MIN_AMOUNT).max(MAX_AMOUNT),
    roiPct: z.number().min(MIN_ROI_PCT).max(MAX_ROI_PCT),
    durationDays: z.number().int().min(MIN_DAYS).max(MAX_DAYS),
    note: z.string().max(160).default(""),
  }),
  z.object({
    kind: z.literal("deletePreset"),
    presetId: z.string().min(2).max(60),
  }),
  z.object({
    kind: z.literal("togglePinPreset"),
    presetId: z.string().min(2).max(60),
  }),
  z.object({
    kind: z.literal("savePreferences"),
    reinvest: z.boolean(),
    compoundPools: z.number().int().min(MIN_POOLS).max(MAX_POOLS),
    showGross: z.boolean(),
    includeFees: z.boolean(),
    payoutFeeWaived: z.boolean(),
  }),
  z.object({
    kind: z.literal("exportReport"),
    scope: z.enum(["projection", "compound", "fees", "scenarios", "historical"]),
    format: z.enum(["pdf", "csv", "json"]),
    count: z.number().int().min(0).max(500),
  }),
  z.object({
    kind: z.literal("acknowledge"),
    scope: z.enum(["risk", "methodology", "fees"]),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["roi", "compound", "fees", "scenario", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
  z.object({
    kind: z.literal("resetCalculator"),
    note: z.string().max(160).default(""),
  }),
  z.object({
    kind: z.literal("shareProjection"),
    amount: z.number().min(MIN_AMOUNT).max(MAX_AMOUNT),
    roiPct: z.number().min(MIN_ROI_PCT).max(MAX_ROI_PCT),
    durationDays: z.number().int().min(MIN_DAYS).max(MAX_DAYS),
    channel: z.enum(["copy", "link", "email", "whatsapp"]),
  }),
]);

export type CalculatorCommand = z.infer<typeof calculatorCommandSchema>;

const channelLabel: Record<ShareChannel, string> = {
  copy: "copied",
  link: "link",
  email: "email",
  whatsapp: "WhatsApp",
};

export function applyCalculatorCommand(
  current: CalculatorWorkspace,
  input: CalculatorCommand,
  now = "2026-10-23T10:05:00Z",
): CalculatorWorkspace {
  const parsed = calculatorCommandSchema.parse(input);
  const workspace = structuredClone(current);
  const audit = (action: string, detail: string) => {
    workspace.audit = [
      {
        id: `calc_audit_${workspace.revision + 1}_${workspace.audit.length + 1}`,
        at: now,
        action,
        detail,
      },
      ...workspace.audit,
    ].slice(0, 40);
  };

  switch (parsed.kind) {
    case "saveScenario": {
      const pool = workspace.pools.find((row) => row.id === parsed.poolId);
      if (!pool) throw new Error("That pool is not on the calculator");
      if (parsed.slots > pool.maxSlotsPerUser)
        throw new Error(
          `${pool.code} allows ${pool.maxSlotsPerUser} slots per investor`,
        );
      const scenario: SavedScenario = {
        id: `sc_${workspace.revision + 1}_${workspace.savedScenarios.length + 1}`,
        poolId: pool.id,
        poolCode: pool.code,
        slots: parsed.slots,
        amount: round2(parsed.amount),
        roiPct: parsed.roiPct,
        durationDays: parsed.durationDays,
        band: parsed.band,
        status: "saved",
        note: parsed.note,
        createdAt: now,
      };
      workspace.savedScenarios = [scenario, ...workspace.savedScenarios].slice(0, 20);
      audit(
        "scenario_saved",
        `${pool.code} · ${parsed.slots} slot${parsed.slots === 1 ? "" : "s"} at ${money(parsed.amount)} · ${pct(parsed.roiPct)} over ${parsed.durationDays} days`,
      );
      return bump(workspace);
    }
    case "deleteScenario": {
      const before = workspace.savedScenarios.length;
      workspace.savedScenarios = workspace.savedScenarios.filter(
        (row) => row.id !== parsed.scenarioId,
      );
      if (workspace.savedScenarios.length === before)
        throw new Error("That scenario is not saved");
      audit("scenario_deleted", parsed.scenarioId);
      return bump(workspace);
    }
    case "queueBooking": {
      const pool = workspace.pools.find((row) => row.id === parsed.poolId);
      if (!pool) throw new Error("That pool is not on the calculator");
      if (parsed.slots > pool.maxSlotsPerUser)
        throw new Error(
          `${pool.code} allows ${pool.maxSlotsPerUser} slots per investor`,
        );
      // A queued hand-off reserves nothing — the I-4 booking flow owns funding,
      // so a short wallet must not dead-end the calculator.
      const scenario: SavedScenario = {
        id: `sc_${workspace.revision + 1}_${workspace.savedScenarios.length + 1}`,
        poolId: pool.id,
        poolCode: pool.code,
        slots: parsed.slots,
        amount: round2(parsed.amount),
        roiPct: parsed.roiPct,
        durationDays: parsed.durationDays,
        band: "expected",
        status: "queued",
        note: parsed.note,
        createdAt: now,
      };
      workspace.savedScenarios = [scenario, ...workspace.savedScenarios].slice(0, 20);
      audit(
        "booking_queued",
        `${parsed.slots} slot${parsed.slots === 1 ? "" : "s"} of ${pool.code} · ${money(parsed.amount)}. Handed to the booking flow — nothing reserved locally.`,
      );
      return bump(workspace);
    }
    case "savePreset": {
      if (workspace.presets.length >= 8)
        throw new Error("Eight presets is the limit — delete one first");
      const preset: CalculatorPreset = {
        id: `pre_${workspace.revision + 1}_${workspace.presets.length + 1}`,
        name: parsed.name,
        amount: round2(parsed.amount),
        roiPct: parsed.roiPct,
        durationDays: parsed.durationDays,
        pinned: false,
        note: parsed.note,
        createdAt: now,
      };
      workspace.presets = [...workspace.presets, preset];
      audit(
        "preset_saved",
        `${preset.name} · ${money(preset.amount)} at ${pct(preset.roiPct)} over ${preset.durationDays} days`,
      );
      return bump(workspace);
    }
    case "deletePreset": {
      const before = workspace.presets.length;
      workspace.presets = workspace.presets.filter(
        (row) => row.id !== parsed.presetId,
      );
      if (workspace.presets.length === before)
        throw new Error("That preset does not exist");
      audit("preset_deleted", parsed.presetId);
      return bump(workspace);
    }
    case "togglePinPreset": {
      const preset = workspace.presets.find((row) => row.id === parsed.presetId);
      if (!preset) throw new Error("That preset does not exist");
      workspace.presets = workspace.presets.map((row) =>
        row.id === preset.id ? { ...row, pinned: !row.pinned } : row,
      );
      audit(
        preset.pinned ? "preset_unpinned" : "preset_pinned",
        `${preset.name} · ${preset.pinned ? "unpinned" : "pinned"} on the calculator`,
      );
      return bump(workspace);
    }
    case "savePreferences": {
      workspace.preferences = {
        reinvest: parsed.reinvest,
        compoundPools: parsed.compoundPools,
        showGross: parsed.showGross,
        includeFees: parsed.includeFees,
        payoutFeeWaived: parsed.payoutFeeWaived,
      };
      audit(
        "preferences_saved",
        `Compound ${parsed.reinvest ? "on" : "off"} · ${parsed.compoundPools} pools · gross ${parsed.showGross ? "shown" : "hidden"}`,
      );
      return bump(workspace);
    }
    case "exportReport": {
      workspace.exports = [
        {
          id: `exp_${workspace.revision + 1}_${workspace.exports.length + 1}`,
          scope: parsed.scope,
          format: parsed.format,
          count: parsed.count,
          createdAt: now,
        },
        ...workspace.exports,
      ].slice(0, 20);
      audit(
        "report_exported",
        `${parsed.scope} as ${parsed.format.toUpperCase()} · ${parsed.count} row${parsed.count === 1 ? "" : "s"}. Built in the browser — no file stored on a server.`,
      );
      return bump(workspace);
    }
    case "acknowledge": {
      workspace.acknowledgements = [
        ...workspace.acknowledgements.filter((row) => row.scope !== parsed.scope),
        { scope: parsed.scope, at: now },
      ];
      audit("acknowledged", `${parsed.scope} disclosure acknowledged`);
      return bump(workspace);
    }
    case "support": {
      workspace.support = [
        {
          id: `sup_${workspace.revision + 1}_${workspace.support.length + 1}`,
          topic: parsed.topic,
          message: parsed.message,
          status: "local_draft" as const,
          createdAt: now,
        },
        ...workspace.support,
      ].slice(0, 20);
      audit("support_drafted", `${parsed.topic} question queued for the desk`);
      return bump(workspace);
    }
    case "resetCalculator": {
      // Inputs live in the page; the workspace only owns the saved defaults.
      workspace.preferences = { ...DEFAULT_PREFERENCES };
      audit(
        "inputs_reset",
        parsed.note || "Calculator returned to the brief's defaults",
      );
      return bump(workspace);
    }
    case "shareProjection": {
      audit(
        "projection_shared",
        `${money(parsed.amount)} at ${pct(parsed.roiPct)} over ${parsed.durationDays} days ${channelLabel[parsed.channel]}`,
      );
      return bump(workspace);
    }
    default:
      return workspace;
  }
}

function bump(workspace: CalculatorWorkspace): CalculatorWorkspace {
  workspace.revision += 1;
  return workspace;
}
