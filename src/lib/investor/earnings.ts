/**
 * I-11 · Earnings & Reports — the demo snapshot's arithmetic.
 *
 * Nothing in this file invents money. It is the pure layer that turns the I-6
 * position book and the I-5 trade feed into the six overview figures, the
 * per-pool breakdown, a daily accrual timeline, the tax picture and the
 * profit-sharing formula. The service hands it real positions; this file only
 * adds up, rounds and explains.
 *
 * Two identities are enforced here and asserted in the tests:
 *   1. gross − platform cut = net, per position and in total.
 *   2. the daily accrual timeline sums back to the lifetime earned figure, so
 *      the running total on the last row always equals the first KPI.
 */

import { z } from "zod";

import { money, round2, shortDateOf } from "./investments";

export { money, round2, shortDateOf };

export const EARNINGS_AS_OF = "2026-10-23T10:00:00Z";

/** The platform takes 20 % of gross pool earnings before allocating shares. */
export const PLATFORM_CUT_PCT = 20;

/** `["earnings","by-pool"]` re-reads every three minutes, per the brief. */
export const EARNINGS_REFRESH_SECONDS = 180;

export const FISCAL_YEAR = 2026;
export const HISTORY_LIMIT = 24;
export const MAX_EXPORTS = 12;
export const MAX_SUPPORT_DRAFTS = 10;
export const TIMELINE_ROW_LIMIT = 400;

/* ── Enums ── */

export type EarningsPeriod = "7d" | "14d" | "30d" | "mtd" | "all";

export const EARNINGS_PERIODS: EarningsPeriod[] = ["7d", "14d", "30d", "mtd", "all"];
export type PoolState = "live" | "completed";
export type ExportFormat = "csv" | "json" | "pdf";
export type ReportKind =
  | "monthly"
  | "cycle"
  | "annual"
  | "tax"
  | "accrual"
  | "payout";
export type ReportStatus = "ready" | "generating" | "stale";
export type JurisdictionCode = "US" | "UK" | "KE" | "ZA";
export type SupportTopic =
  | "earnings"
  | "tax"
  | "payout"
  | "report"
  | "other";
export type TimelineKind = "settlement" | "accrual" | "mixed";
export type ExportScope =
  | "overview"
  | "by-pool"
  | "timeline"
  | "tax"
  | "fees"
  | "payouts";

/* ── Rows ── */

export interface EarningsKpi {
  key: string;
  label: string;
  value: number;
  prefix: string;
  decimals: number;
  suffix?: string;
  hint: string;
  tone: "is-pos" | "is-accent" | "is-cut" | "";
  detail: string;
}

export interface PoolEarnings {
  id: string;
  poolId: string;
  code: string;
  name: string;
  status: PoolState;
  strategy: string;
  riskBand: string;
  investment: number;
  sharePct: number;
  poolCapital: number;
  poolPnl: number;
  gross: number;
  cut: number;
  cutPct: number;
  net: number;
  roiPct: number;
  startedAt: string;
  endedAt: string | null;
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
  dailyAvg: number;
  currentValue: number;
  unsettled: number;
  reconciledAt: string | null;
  guardianLevel: string | null;
  poolHref: string;
  liveHref: string | null;
  note: string;
}

export interface TimelinePoolLine {
  code: string;
  amount: number;
}

export interface TimelineDay {
  id: string;
  date: string;
  label: string;
  kind: TimelineKind;
  settled: number;
  accrued: number;
  amount: number;
  running: number;
  rows: number;
  pools: TimelinePoolLine[];
  detail: string;
}

export interface Jurisdiction {
  code: JurisdictionCode;
  label: string;
  form: string;
  status: "ready" | "partial";
  note: string;
  current: boolean;
}

export interface TaxDocument {
  id: string;
  name: string;
  kind: string;
  format: ExportFormat;
  sizeKb: number;
  generatedAt: string | null;
  reference: string;
  note: string;
}

export interface TaxNote {
  label: string;
  value: number;
  tone: "is-pos" | "is-cut" | "";
  hint: string;
}

export interface FormulaStep {
  key: string;
  label: string;
  expression: string;
  value: number;
  unit: "usd" | "pct";
  note: string;
}

export interface FormulaSample {
  poolCode: string;
  poolName: string;
  poolPnl: number;
  investment: number;
  poolCapital: number;
  sharePct: number;
  gross: number;
  cut: number;
  cutPct: number;
  net: number;
  roiPct: number;
  steps: FormulaStep[];
}

export interface PayoutRow {
  id: string;
  reference: string;
  poolCode: string;
  poolName: string;
  amount: number;
  fee: number;
  net: number;
  status: "paid" | "processing";
  requestedAt: string;
  paidAt: string | null;
  destination: string;
}

export interface ReportRow {
  id: string;
  title: string;
  kind: ReportKind;
  period: string;
  format: ExportFormat;
  sizeKb: number;
  generatedAt: string;
  status: ReportStatus;
  reference: string;
  scope: string;
}

export interface ExportRow {
  id: string;
  scope: ExportScope;
  format: ExportFormat;
  rows: number;
  createdAt: string;
  bytes: number;
  reference: string;
}

export interface StatementPreferences {
  defaultPeriod: EarningsPeriod;
  fiscalYear: number;
  jurisdiction: JurisdictionCode;
  includeLosses: boolean;
  includeAccrual: boolean;
  rounding: "cent" | "dollar";
  currency: "USD";
  deliveryEmail: string;
  autoMonthly: boolean;
}

export interface SupportDraft {
  id: string;
  topic: SupportTopic;
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface AuditRow {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface ForecastPoint {
  day: number;
  date: string;
  live: number;
  settled: number;
  conservative: number;
}

export interface EarningsWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: {
    id: string;
    displayName: string;
    email: string;
    country: string;
    joinedAt: string;
    kycLevel: string;
    currency: "USD";
    wallet: number;
    committed: number;
    monthRoiPct: number;
    unread: number;
    fiscalYear: number;
    jurisdiction: JurisdictionCode;
    bankAccount: string;
  };
  overview: EarningsKpi[];
  pools: PoolEarnings[];
  timeline: TimelineDay[];
  timelinePeriod: EarningsPeriod;
  tax: {
    year: number;
    notes: TaxNote[];
    jurisdictions: Jurisdiction[];
    documents: TaxDocument[];
    disclaimer: string;
    filingWindow: string;
    reference: string;
  };
  formula: {
    cutPct: number;
    refreshSeconds: number;
    steps: FormulaStep[];
    samples: FormulaSample[];
    notes: string[];
  };
  reports: ReportRow[];
  payouts: PayoutRow[];
  exports: ExportRow[];
  preferences: StatementPreferences;
  forecast: ForecastPoint[];
  support: SupportDraft[];
  audit: AuditRow[];
}

/* ── Formatting ── */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const dayKey = (iso: string) => iso.slice(0, 10);

export const dayLabel = (date: string) =>
  `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

export const monthLabel = (date: string) =>
  `${FULL_MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

export const clockShort = (iso: string) => iso.slice(11, 16);

export const signed = (value: number, decimals = 2) =>
  `${value < 0 ? "−" : "+"}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const pct = (value: number, decimals = 1) => `${value.toFixed(decimals)}%`;

export const periodLabel = (period: EarningsPeriod) =>
  period === "7d"
    ? "Last 7 days"
    : period === "14d"
      ? "Last 14 days"
      : period === "30d"
        ? "Last 30 days"
        : period === "mtd"
          ? "Month to date"
          : "All time";

export const formatLabel = (format: ExportFormat) =>
  format === "csv" ? "CSV" : format === "json" ? "JSON" : "PDF";

export const reportKindLabel = (kind: ReportKind) =>
  kind === "monthly"
    ? "Monthly statement"
    : kind === "cycle"
      ? "Cycle settlement"
      : kind === "annual"
        ? "Annual summary"
        : kind === "tax"
          ? "Tax pack"
          : kind === "accrual"
            ? "Accrual register"
            : "Payout ledger";

export const reportStatusTone = (status: ReportStatus) =>
  status === "ready" ? "is-ok" : status === "generating" ? "is-wait" : "is-plain";

export const scopeLabel = (scope: ExportScope) =>
  scope === "overview"
    ? "Overview figures"
    : scope === "by-pool"
      ? "Per-pool breakdown"
      : scope === "timeline"
        ? "Daily timeline"
        : scope === "tax"
          ? "Tax workbook"
          : scope === "fees"
            ? "Platform fee ledger"
            : "Payout ledger";

export const topicLabel = (topic: SupportTopic) =>
  topic === "earnings"
    ? "An earnings figure"
    : topic === "tax"
      ? "A tax question"
      : topic === "payout"
        ? "A payout"
        : topic === "report"
          ? "A report or export"
          : "Something else";

export const jurisdictionLabel = (code: JurisdictionCode) =>
  code === "US" ? "United States" : code === "UK" ? "United Kingdom" : code === "KE" ? "Kenya" : "South Africa";

export const timelineTone = (kind: TimelineKind) =>
  kind === "settlement" ? "is-settled" : kind === "accrual" ? "is-accrual" : "is-mixed";

/* ── Arithmetic ── */

export const grossOf = (net: number, cutPct = PLATFORM_CUT_PCT) =>
  round2(net / (1 - cutPct / 100));

export const cutOf = (gross: number, cutPct = PLATFORM_CUT_PCT) =>
  round2(gross * (cutPct / 100));

/** Pool capital behind a position, derived from the share it holds. */
export const capitalOf = (investment: number, sharePct: number) =>
  sharePct > 0 ? Math.round(investment / (sharePct / 100)) : investment;

/** The pool's own P&L behind a position's net share. */
export const pnlOf = (net: number, sharePct: number) =>
  sharePct > 0 ? round2(net / (sharePct / 100)) : net;

export interface PoolTotalsView {
  live: number;
  completed: number;
  gross: number;
  cut: number;
  net: number;
  investment: number;
  positions: number;
  livePositions: number;
  completedPositions: number;
  avgNet: number;
  avgRoi: number;
  best: PoolEarnings | null;
  worst: PoolEarnings | null;
  bestLive: PoolEarnings | null;
  worstLive: PoolEarnings | null;
  cutPct: number;
}

export function poolTotals(rows: readonly PoolEarnings[]): PoolTotalsView {
  const sum = (list: readonly PoolEarnings[], key: "gross" | "cut" | "net" | "investment") =>
    round2(list.reduce((total, row) => total + row[key], 0));
  const earning = rows.filter((row) => row.net > 0 || row.investment > 0);
  const live = rows.filter((row) => row.status === "live");
  const completed = rows.filter((row) => row.status === "completed");
  const net = sum(earning, "net");
  const investment = sum(earning, "investment");
  const byNet = earning.slice().sort((a, b) => b.net - a.net);
  const liveByNet = live.slice().sort((a, b) => b.net - a.net);
  return {
    live: sum(live, "net"),
    completed: sum(completed, "net"),
    gross: sum(earning, "gross"),
    cut: sum(earning, "cut"),
    net,
    investment,
    positions: rows.length,
    livePositions: live.length,
    completedPositions: completed.length,
    avgNet: earning.length ? round2(net / earning.length) : 0,
    avgRoi: investment > 0 ? round2((net / investment) * 100) : 0,
    best: byNet[0] ?? null,
    worst: byNet[byNet.length - 1] ?? null,
    bestLive: liveByNet[0] ?? null,
    worstLive: liveByNet[liveByNet.length - 1] ?? null,
    cutPct: PLATFORM_CUT_PCT,
  };
}

/**
 * Daily accrual for a live position: its net is spread across every UTC date it
 * has been running, and the final row absorbs the rounding so the sum is exact.
 */
export function accrualRows(
  pool: PoolEarnings,
  asOf: string,
): { date: string; amount: number; partial: boolean }[] {
  if (pool.status !== "live" || pool.net <= 0) return [];
  const start = dayKey(pool.startedAt);
  const end = dayKey(asOf);
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last && dates.length < 120) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!dates.length) return [];
  const per = pool.net / dates.length;
  let allocated = 0;
  return dates.map((date, index) => {
    const isLast = index === dates.length - 1;
    const amount = isLast ? round2(pool.net - allocated) : round2(per);
    allocated = round2(allocated + amount);
    return { date, amount, partial: isLast };
  });
}

export function buildTimeline(
  pools: readonly PoolEarnings[],
  asOf: string,
): TimelineDay[] {
  type Bucket = {
    settled: number;
    accrued: number;
    rows: number;
    pools: Map<string, number>;
  };
  const buckets = new Map<string, Bucket>();
  const touch = (date: string): Bucket => {
    const existing = buckets.get(date);
    if (existing) return existing;
    const fresh: Bucket = { settled: 0, accrued: 0, rows: 0, pools: new Map() };
    buckets.set(date, fresh);
    return fresh;
  };

  for (const pool of pools) {
    if (pool.status === "completed" && pool.endedAt) {
      const bucket = touch(dayKey(pool.endedAt));
      bucket.settled = round2(bucket.settled + pool.net);
      bucket.rows += 1;
      bucket.pools.set(pool.code, round2((bucket.pools.get(pool.code) ?? 0) + pool.net));
      continue;
    }
    for (const row of accrualRows(pool, asOf)) {
      const bucket = touch(row.date);
      bucket.accrued = round2(bucket.accrued + row.amount);
      bucket.rows += 1;
      bucket.pools.set(pool.code, round2((bucket.pools.get(pool.code) ?? 0) + row.amount));
    }
  }

  let running = 0;
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, bucket]) => {
      const amount = round2(bucket.settled + bucket.accrued);
      running = round2(running + amount);
      const codes = [...bucket.pools.keys()].sort();
      const kind: TimelineKind =
        bucket.settled > 0 && bucket.accrued > 0
          ? "mixed"
          : bucket.settled > 0
            ? "settlement"
            : "accrual";
      return {
        id: `tl_${date}`,
        date,
        label: dayLabel(date),
        kind,
        settled: bucket.settled,
        accrued: bucket.accrued,
        amount,
        running,
        rows: bucket.rows,
        pools: codes.map((code) => ({ code, amount: bucket.pools.get(code) ?? 0 })),
        detail:
          kind === "settlement"
            ? `${codes.join(" + ")} settled on completion`
            : kind === "mixed"
              ? `${codes.join(" + ")} accrued · a cycle settled the same day`
              : `${codes.join(" + ")} accrual, unsettled until the cycle closes`,
      };
    });
}

export function filterTimeline(
  rows: readonly TimelineDay[],
  period: EarningsPeriod,
  asOf: string,
): TimelineDay[] {
  if (period === "all") return rows.slice();
  const days = period === "7d" ? 7 : period === "14d" ? 14 : period === "30d" ? 30 : 0;
  const floor =
    period === "mtd"
      ? `${asOf.slice(0, 7)}-01`
      : new Date(new Date(asOf).getTime() - (days - 1) * 86_400_000)
          .toISOString()
          .slice(0, 10);
  return rows.filter((row) => row.date >= floor);
}

export interface TimelineView {
  rows: TimelineDay[];
  period: EarningsPeriod;
  net: number;
  settled: number;
  accrued: number;
  days: number;
  best: TimelineDay | null;
  average: number;
  running: number;
}

export function timelineView(
  rows: readonly TimelineDay[],
  period: EarningsPeriod,
  asOf: string,
): TimelineView {
  const window = filterTimeline(rows, period, asOf);
  const net = round2(window.reduce((sum, row) => sum + row.amount, 0));
  const settled = round2(window.reduce((sum, row) => sum + row.settled, 0));
  const accrued = round2(window.reduce((sum, row) => sum + row.accrued, 0));
  const best = window.slice().sort((a, b) => b.amount - a.amount)[0] ?? null;
  return {
    rows: window,
    period,
    net,
    settled,
    accrued,
    days: window.length,
    best,
    average: window.length ? round2(net / window.length) : 0,
    running: window.length ? window[window.length - 1].running : 0,
  };
}

/* ── Export matrices ── */

export type ExportCell = string | number;
export interface ExportMatrix {
  title: string;
  header: string[];
  rows: ExportCell[][];
}

export function exportMatrix(
  workspace: EarningsWorkspace,
  scope: ExportScope,
  period: EarningsPeriod = workspace.timelinePeriod,
): ExportMatrix {
  if (scope === "overview") {
    return {
      title: "Earnings overview",
      header: ["Metric", "Value", "Detail"],
      rows: workspace.overview.map((row) => [
        row.label,
        `${row.prefix}${row.value.toFixed(row.decimals)}${row.suffix ?? ""}`,
        row.detail,
      ]),
    };
  }
  if (scope === "by-pool") {
    return {
      title: "Earnings by pool",
      header: [
        "Code",
        "Pool",
        "Status",
        "Invested",
        "Share %",
        "Gross",
        "Platform cut",
        "Net",
        "ROI %",
        "Days",
      ],
      rows: workspace.pools.map((row) => [
        row.code,
        row.name,
        row.status,
        row.investment,
        row.sharePct,
        row.gross,
        row.cut,
        row.net,
        row.roiPct,
        `${row.daysElapsed} of ${row.daysTotal}`,
      ]),
    };
  }
  if (scope === "timeline") {
    const view = timelineView(workspace.timeline, period, workspace.asOf);
    return {
      title: `Earnings timeline · ${periodLabel(period)}`,
      header: ["Date", "Kind", "Settled", "Accrued", "Amount", "Running total", "Detail"],
      rows: view.rows.map((row) => [
        row.date,
        row.kind,
        row.settled,
        row.accrued,
        row.amount,
        row.running,
        row.detail,
      ]),
    };
  }
  if (scope === "tax") {
    return {
      title: `Tax workbook ${workspace.tax.year}`,
      header: ["Line", "Amount", "Note"],
      rows: workspace.tax.notes.map((row) => [row.label, row.value, row.hint]),
    };
  }
  if (scope === "fees") {
    return {
      title: "Platform fee ledger",
      header: ["Pool", "Gross earnings", "Platform cut", "Rate %", "Net to you"],
      rows: workspace.pools.map((row) => [
        `${row.code} ${row.name}`,
        row.gross,
        row.cut,
        row.cutPct,
        row.net,
      ]),
    };
  }
  return {
    title: "Payout ledger",
    header: ["Reference", "Pool", "Requested", "Fee", "Net", "Status", "Paid at", "Destination"],
    rows: workspace.payouts.map((row) => [
      row.reference,
      `${row.poolCode} ${row.poolName}`,
      row.amount,
      row.fee,
      row.net,
      row.status,
      row.paidAt ?? "—",
      row.destination,
    ]),
  };
}

export const csvOf = (matrix: ExportMatrix) =>
  [matrix.header, ...matrix.rows]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\n");

export const exportFileStem = (workspace: EarningsWorkspace, scope: ExportScope) =>
  `trademo-${scope}-${workspace.asOf.slice(0, 10)}`;

export const exportBytes = (matrix: ExportMatrix) =>
  Buffer.byteLength(csvOf(matrix), "utf8");

/* ── Commands ── */

const periodEnum = z.enum(["7d", "14d", "30d", "mtd", "all"]);
const formatEnum = z.enum(["csv", "json", "pdf"]);
const scopeEnum = z.enum(["overview", "by-pool", "timeline", "tax", "fees", "payouts"]);
const reportKindEnum = z.enum(["monthly", "cycle", "annual", "tax", "accrual", "payout"]);
const jurisdictionEnum = z.enum(["US", "UK", "KE", "ZA"]);

export const earningsCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("exportReport"),
    scope: scopeEnum,
    format: formatEnum,
    period: periodEnum.default("14d"),
  }),
  z.object({
    kind: z.literal("generateReport"),
    reportKind: reportKindEnum,
    period: periodEnum.default("mtd"),
    format: formatEnum.default("pdf"),
  }),
  z.object({ kind: z.literal("downloadReport"), id: z.string().min(3).max(60) }),
  z.object({
    kind: z.literal("downloadTax"),
    format: z.enum(["csv", "pdf"]),
    year: z.number().int().min(2024).max(FISCAL_YEAR),
  }),
  z.object({ kind: z.literal("refresh") }),
  z.object({
    kind: z.literal("setPeriod"),
    period: periodEnum,
  }),
  z.object({
    kind: z.literal("savePreferences"),
    defaultPeriod: periodEnum,
    jurisdiction: jurisdictionEnum,
    includeLosses: z.boolean(),
    includeAccrual: z.boolean(),
    rounding: z.enum(["cent", "dollar"]),
    deliveryEmail: z.string().trim().email().max(160),
    autoMonthly: z.boolean(),
  }),
  z.object({
    kind: z.literal("emailStatement"),
    year: z.number().int().min(2024).max(FISCAL_YEAR),
    email: z.string().trim().email().max(160),
  }),
  z.object({
    kind: z.literal("pinJurisdiction"),
    code: jurisdictionEnum,
  }),
  z.object({
    kind: z.literal("acknowledge"),
    scope: z.enum(["tax", "disclosure", "formula"]),
  }),
  z.object({
    kind: z.literal("reconcilePool"),
    poolId: z.string().min(3).max(60),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["earnings", "tax", "payout", "report", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
  z.object({ kind: z.literal("deleteDraft"), id: z.string().min(3).max(60) }),
  z.object({ kind: z.literal("clearExports") }),
]);

export type EarningsCommand = z.infer<typeof earningsCommandSchema>;

const clone = (workspace: EarningsWorkspace): EarningsWorkspace =>
  JSON.parse(JSON.stringify(workspace)) as EarningsWorkspace;

const audit = (workspace: EarningsWorkspace, action: string, detail: string) => {
  workspace.audit = [
    {
      id: `ea_audit_${workspace.revision + 1}_${workspace.audit.length + 1}`,
      at: workspace.asOf,
      action,
      detail,
    },
    ...workspace.audit,
  ].slice(0, 24);
};

const bump = (workspace: EarningsWorkspace) => {
  workspace.revision += 1;
  return workspace;
};

const serialOf = (workspace: EarningsWorkspace, prefix: string, length: number) =>
  `${prefix}-${workspace.asOf.slice(0, 10).replace(/-/g, "")}-${String(length + 1).padStart(
    4,
    "0",
  )}`;

export function applyEarningsCommand(
  workspace: EarningsWorkspace,
  command: EarningsCommand,
): EarningsWorkspace {
  const parsed = earningsCommandSchema.parse(command);
  const next = clone(workspace);

  switch (parsed.kind) {
    case "exportReport": {
      const matrix = exportMatrix(next, parsed.scope, parsed.period);
      const bytes = exportBytes(matrix);
      next.exports = [
        {
          id: `ea_exp_${next.revision + 1}_${next.exports.length + 1}`,
          scope: parsed.scope,
          format: parsed.format,
          rows: matrix.rows.length,
          createdAt: next.asOf,
          bytes,
          reference: serialOf(next, "EX", next.exports.length),
        },
        ...next.exports,
      ].slice(0, MAX_EXPORTS);
      audit(
        next,
        "export_generated",
        `${scopeLabel(parsed.scope)} · ${formatLabel(parsed.format)} · ${matrix.rows.length} rows`,
      );
      return bump(next);
    }
    case "generateReport": {
      if (next.reports.filter((row) => row.status === "generating").length >= 2)
        throw new Error("Two reports are already rendering — wait for one to land");
      next.reports = [
        {
          id: `ea_rep_${next.revision + 1}_${next.reports.length + 1}`,
          title: `${reportKindLabel(parsed.reportKind)} · ${periodLabel(parsed.period)}`,
          kind: parsed.reportKind,
          period: parsed.period,
          format: parsed.format,
          sizeKb: 148 + next.pools.length * 12,
          generatedAt: next.asOf,
          status: "ready" as ReportStatus,
          reference: serialOf(next, "RP", next.reports.length),
          scope: scopeLabel(parsed.reportKind === "tax" ? "tax" : "by-pool"),
        },
        ...next.reports,
      ].slice(0, 18);
      audit(
        next,
        "report_generated",
        `${reportKindLabel(parsed.reportKind)} · ${formatLabel(parsed.format)}`,
      );
      return bump(next);
    }
    case "downloadReport": {
      const report = next.reports.find((row) => row.id === parsed.id);
      if (!report) throw new Error("That report is no longer in the library — generate it again");
      report.status = "ready";
      report.generatedAt = next.asOf;
      audit(next, "report_downloaded", `${report.title} · ${formatLabel(report.format)}`);
      return bump(next);
    }
    case "downloadTax": {
      const document: TaxDocument = {
        id: `ea_doc_${next.revision + 1}_${next.tax.documents.length + 1}`,
        name: `Tax pack ${parsed.year} · ${next.profile.jurisdiction}`,
        kind: parsed.format === "pdf" ? "Filing summary" : "Workbook data",
        format: parsed.format,
        sizeKb: parsed.format === "pdf" ? 214 : 96,
        generatedAt: next.asOf,
        reference: serialOf(next, "TX", next.tax.documents.length),
        note:
          parsed.format === "pdf"
            ? "Filing-ready summary with the profit-sharing maths and fee ledger attached."
            : "Line-by-line CSV for your accountant — every figure traces to a pool cycle.",
      };
      next.tax.documents = [document, ...next.tax.documents].slice(0, 8);
      next.exports = [
        {
          id: `ea_exp_${next.revision + 1}_${next.exports.length + 1}`,
          scope: "tax" as ExportScope,
          format: parsed.format,
          rows: next.tax.notes.length,
          createdAt: next.asOf,
          bytes: parsed.format === "pdf" ? document.sizeKb * 1024 : exportBytes(exportMatrix(next, "tax")),
          reference: document.reference,
        },
        ...next.exports,
      ].slice(0, MAX_EXPORTS);
      audit(next, "tax_exported", `${parsed.format.toUpperCase()} · fiscal year ${parsed.year}`);
      return bump(next);
    }
    case "refresh": {
      audit(
        next,
        "workspace_refreshed",
        `Accruals recomputed at ${next.asOf.slice(11, 16)} UTC · 3-minute cadence`,
      );
      return bump(next);
    }
    case "setPeriod": {
      next.timelinePeriod = parsed.period;
      next.preferences = { ...next.preferences, defaultPeriod: parsed.period };
      audit(next, "period_changed", periodLabel(parsed.period));
      return bump(next);
    }
    case "savePreferences": {
      next.preferences = {
        ...next.preferences,
        defaultPeriod: parsed.defaultPeriod,
        jurisdiction: parsed.jurisdiction,
        includeLosses: parsed.includeLosses,
        includeAccrual: parsed.includeAccrual,
        rounding: parsed.rounding,
        deliveryEmail: parsed.deliveryEmail,
        autoMonthly: parsed.autoMonthly,
      };
      next.timelinePeriod = parsed.defaultPeriod;
      next.profile = { ...next.profile, jurisdiction: parsed.jurisdiction };
      next.tax.jurisdictions = next.tax.jurisdictions.map((row) => ({
        ...row,
        current: row.code === parsed.jurisdiction,
      }));
      audit(
        next,
        "preferences_saved",
        `${periodLabel(parsed.defaultPeriod)} · ${jurisdictionLabel(parsed.jurisdiction)} · ${
          parsed.autoMonthly ? "auto monthly" : "manual"
        }`,
      );
      return bump(next);
    }
    case "emailStatement": {
      next.preferences = { ...next.preferences, deliveryEmail: parsed.email };
      audit(next, "statement_emailed", `Fiscal year ${parsed.year} → ${parsed.email}`);
      return bump(next);
    }
    case "pinJurisdiction": {
      const jurisdiction = next.tax.jurisdictions.find((row) => row.code === parsed.code);
      if (!jurisdiction) throw new Error("That jurisdiction is not in this tax pack");
      next.profile = { ...next.profile, jurisdiction: parsed.code };
      next.preferences = { ...next.preferences, jurisdiction: parsed.code };
      next.tax.jurisdictions = next.tax.jurisdictions.map((row) => ({
        ...row,
        current: row.code === parsed.code,
      }));
      audit(next, "jurisdiction_pinned", jurisdiction.form);
      return bump(next);
    }
    case "acknowledge": {
      audit(
        next,
        "acknowledged",
        parsed.scope === "tax"
          ? "Tax disclaimer acknowledged"
          : parsed.scope === "disclosure"
            ? "Investor disclosure acknowledged"
            : "Profit-sharing formula acknowledged",
      );
      return bump(next);
    }
    case "reconcilePool": {
      const pool = next.pools.find((row) => row.id === parsed.poolId);
      if (!pool) throw new Error("That position is no longer in the book");
      pool.reconciledAt = next.asOf;
      pool.note = `Reconciled against the pool ledger on ${dayLabel(next.asOf.slice(0, 10))}.`;
      audit(next, "position_reconciled", `${pool.code} · ${money(pool.net, 2)} net`);
      return bump(next);
    }
    case "support": {
      if (next.support.length >= MAX_SUPPORT_DRAFTS)
        throw new Error("That is a lot of drafts — the desk replies to the newest first");
      next.support = [
        {
          id: `ea_sup_${next.revision + 1}_${next.support.length + 1}`,
          topic: parsed.topic,
          message: parsed.message,
          status: "local_draft" as const,
          createdAt: next.asOf,
        },
        ...next.support,
      ].slice(0, MAX_SUPPORT_DRAFTS);
      audit(next, "support_drafted", `${topicLabel(parsed.topic)} · ${parsed.message.slice(0, 60)}`);
      return bump(next);
    }
    case "deleteDraft": {
      const before = next.support.length;
      next.support = next.support.filter((row) => row.id !== parsed.id);
      if (next.support.length === before) throw new Error("That draft is already gone");
      audit(next, "support_draft_deleted", parsed.id);
      return bump(next);
    }
    case "clearExports": {
      if (!next.exports.length) throw new Error("The export shelf is already empty");
      const count = next.exports.length;
      next.exports = [];
      audit(next, "exports_cleared", `${count} local export${count === 1 ? "" : "s"} removed`);
      return bump(next);
    }
    default:
      return next;
  }
}

export function defaultPreferences(): StatementPreferences {
  return {
    defaultPeriod: "14d",
    fiscalYear: FISCAL_YEAR,
    jurisdiction: "KE",
    includeLosses: true,
    includeAccrual: true,
    rounding: "cent",
    currency: "USD",
    deliveryEmail: "jane.muthoni@example.com",
    autoMonthly: true,
  };
}

/* ── Section slices ── */

export interface MonthProgress {
  label: string;
  net: number;
  lifetime: number;
  sharePct: number;
  daysElapsed: number;
  daysInMonth: number;
  settled: number;
  accrued: number;
  bestDay: TimelineDay | null;
}

export function monthProgress(workspace: EarningsWorkspace): MonthProgress {
  const prefix = workspace.asOf.slice(0, 7);
  const rows = workspace.timeline.filter((row) => row.date.startsWith(prefix));
  const net = round2(rows.reduce((sum, row) => sum + row.amount, 0));
  const lifetime = round2(workspace.timeline.reduce((sum, row) => sum + row.amount, 0));
  const daysInMonth = new Date(
    Date.UTC(Number(prefix.slice(0, 4)), Number(prefix.slice(5, 7)), 0),
  ).getUTCDate();
  return {
    label: monthLabel(`${prefix}-01`),
    net,
    lifetime,
    sharePct: lifetime > 0 ? round2((net / lifetime) * 100) : 0,
    daysElapsed: Number(workspace.asOf.slice(8, 10)),
    daysInMonth,
    settled: round2(rows.reduce((sum, row) => sum + row.settled, 0)),
    accrued: round2(rows.reduce((sum, row) => sum + row.accrued, 0)),
    bestDay: rows.slice().sort((a, b) => b.amount - a.amount)[0] ?? null,
  };
}

export interface EarningsSectionMap {
  workspace: EarningsWorkspace;
  overview: {
    asOf: string;
    revision: number;
    kpis: EarningsKpi[];
    totals: PoolTotalsView;
    month: MonthProgress;
    lifetime: number;
    liveNet: number;
    settledNet: number;
    feeTotal: number;
    positions: number;
  };
  "by-pool": {
    asOf: string;
    pools: PoolEarnings[];
    totals: PoolTotalsView;
    cutPct: number;
    refreshSeconds: number;
    live: PoolEarnings[];
    settled: PoolEarnings[];
  };
  timeline: TimelineView & {
    asOf: string;
    period: EarningsPeriod;
    lifetime: number;
    pools: { code: string; net: number; status: PoolState }[];
  };
  "tax-report": EarningsWorkspace["tax"] & {
    totals: { gross: number; cut: number; net: number; withdrawn: number; locked: number };
    year: number;
    asOf: string;
  };
  formula: EarningsWorkspace["formula"] & {
    asOf: string;
    worked: FormulaSample | null;
  };
  library: {
    asOf: string;
    reports: ReportRow[];
    exports: ExportRow[];
    payouts: PayoutRow[];
    payoutTotals: { paid: number; processing: number; fees: number };
    reportsByStatus: { ready: number; generating: number; stale: number };
  };
}

export type EarningsSectionKey = keyof EarningsSectionMap;

export const EARNINGS_SECTIONS: EarningsSectionKey[] = [
  "workspace",
  "overview",
  "by-pool",
  "timeline",
  "tax-report",
  "formula",
  "library",
];

export function earningsSection<K extends EarningsSectionKey>(
  workspace: EarningsWorkspace,
  section: K,
  params: { period?: EarningsPeriod; year?: number } = {},
): EarningsSectionMap[K] {
  const result = (() => {
    switch (section) {
      case "overview": {
        const totals = poolTotals(workspace.pools);
        return {
          asOf: workspace.asOf,
          revision: workspace.revision,
          kpis: workspace.overview,
          totals,
          month: monthProgress(workspace),
          lifetime: totals.net,
          liveNet: totals.live,
          settledNet: totals.completed,
          feeTotal: totals.cut,
          positions: workspace.pools.length,
        };
      }
      case "by-pool": {
        const totals = poolTotals(workspace.pools);
        return {
          asOf: workspace.asOf,
          pools: workspace.pools,
          totals,
          cutPct: PLATFORM_CUT_PCT,
          refreshSeconds: EARNINGS_REFRESH_SECONDS,
          live: workspace.pools.filter((row) => row.status === "live"),
          settled: workspace.pools.filter((row) => row.status === "completed"),
        };
      }
      case "timeline": {
        const period = params.period ?? workspace.timelinePeriod;
        const view = timelineView(workspace.timeline, period, workspace.asOf);
        return {
          ...view,
          period,
          asOf: workspace.asOf,
          lifetime: round2(workspace.timeline.reduce((sum, row) => sum + row.amount, 0)),
          pools: workspace.pools.map((row) => ({
            code: row.code,
            net: row.net,
            status: row.status,
          })),
        };
      }
      case "tax-report": {
        const totals = poolTotals(workspace.pools);
        return {
          ...workspace.tax,
          year: params.year ?? workspace.tax.year,
          asOf: workspace.asOf,
          totals: {
            gross: totals.gross,
            cut: totals.cut,
            net: totals.net,
            withdrawn: totals.completed,
            locked: totals.live,
          },
        };
      }
      case "formula": {
        const worked =
          workspace.formula.samples.find((row) => row.poolCode === "PKG-01") ??
          workspace.formula.samples[0] ??
          null;
        return { ...workspace.formula, asOf: workspace.asOf, worked };
      }
      case "library": {
        const paid = workspace.payouts.filter((row) => row.status === "paid");
        const processing = workspace.payouts.filter((row) => row.status === "processing");
        return {
          asOf: workspace.asOf,
          reports: workspace.reports,
          exports: workspace.exports,
          payouts: workspace.payouts,
          payoutTotals: {
            paid: round2(paid.reduce((sum, row) => sum + row.net, 0)),
            processing: round2(processing.reduce((sum, row) => sum + row.net, 0)),
            fees: round2(workspace.payouts.reduce((sum, row) => sum + row.fee, 0)),
          },
          reportsByStatus: {
            ready: workspace.reports.filter((row) => row.status === "ready").length,
            generating: workspace.reports.filter((row) => row.status === "generating").length,
            stale: workspace.reports.filter((row) => row.status === "stale").length,
          },
        };
      }
      default:
        return workspace;
    }
  })();
  return result as EarningsSectionMap[K];
}

export const earningsKey = (
  section: Exclude<EarningsSectionKey, "workspace">,
  params?: { period?: EarningsPeriod; year?: number },
) => {
  if (section === "timeline")
    return ["earnings", "timeline", { period: params?.period ?? "14d" }] as const;
  if (section === "tax-report")
    return ["earnings", "tax-report", { year: params?.year ?? FISCAL_YEAR }] as const;
  return ["earnings", section] as const;
};
