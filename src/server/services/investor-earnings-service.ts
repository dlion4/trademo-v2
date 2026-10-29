import {
  EARNINGS_AS_OF,
  EARNINGS_REFRESH_SECONDS,
  FISCAL_YEAR,
  PLATFORM_CUT_PCT,
  applyEarningsCommand,
  buildTimeline,
  capitalOf,
  defaultPreferences,
  monthProgress,
  pnlOf,
  poolTotals,
  round2,
  dayKey,
  type EarningsCommand,
  type EarningsKpi,
  type EarningsWorkspace,
  type FormulaSample,
  type FormulaStep,
  type Jurisdiction,
  type PayoutRow,
  type PoolEarnings,
  type ReportRow,
  type TaxDocument,
  type TaxNote,
  type TimelineDay,
} from "@/lib/investor/earnings";
import type { InvestmentsWorkspace } from "@/lib/investor/investments";
import { getInvestmentsWorkspace } from "@/server/services/investor-investments-service";
import { getPoolsWorkspace } from "./investor-pools-service";
import { getWalletWorkspace } from "./investor-wallet-service";

/**
 * I-11 fixture source.
 *
 * Every dollar on `/investor/earnings` is arithmetic over the I-6 position book,
 * never a typed-in number:
 *   gross − 20 % platform cut = net        (per position and in total)
 *   Σ net                     = $5,029.20  (= I-6 `summary.totalEarned`)
 *   completed net             = $2,419.20  (= I-7 `withdrawn`)
 *   live net                  = $2,610.00  (= I-7 `accruedInPools`)
 *   Σ daily timeline          = $5,029.20  (= lifetime KPI, running total)
 *
 * Accruals for live cycles are spread across the UTC days each cycle has run
 * (PKG-01 from 11 Oct, PKG-03 from 14 Oct) with the last day absorbing rounding,
 * so a 14-day window always sums to the money that actually moved in it.
 */

const STRATEGY_BY_RISK: Record<string, string> = {
  Low: "Capital preservation",
  Balanced: "Index carry",
  Growth: "Momentum swing",
  Aggressive: "High-volatility momentum",
};

const DAY_MS = 86_400_000;

const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS));

const elapsedDays = (from: string, asOf: string) =>
  Math.max(1, Math.floor((new Date(asOf).getTime() - new Date(from).getTime()) / DAY_MS) + 1);

/** Pool capital is read from the I-2 book so the share maths can be checked. */
function poolCapitalBook(): Map<string, number> {
  const book = getPoolsWorkspace();
  const rows = [
    ...book.trading,
    ...book.completed,
    ...book.open,
    ...book.upcoming,
  ] as { id: string; goal?: number; raised?: number }[];
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = row.goal ?? row.raised;
    if (typeof value === "number" && value > 0) map.set(row.id, value);
  }
  return map;
}

function buildPools(
  investments: InvestmentsWorkspace,
  asOf: string,
): PoolEarnings[] {
  const capital = poolCapitalBook();
  const live: PoolEarnings[] = investments.active.map((row) => {
    const daysTotal = Math.max(1, daysBetween(row.startedAt, row.endsAt));
    const daysElapsed = Math.min(daysTotal, elapsedDays(row.startedAt, asOf));
    return {
      id: `ep_${row.poolId}`,
      poolId: row.poolId,
      code: row.code,
      name: row.name,
      status: "live",
      strategy: row.strategy,
      riskBand: row.riskBand,
      investment: row.investment,
      sharePct: row.sharePct,
      poolCapital: capital.get(row.poolId) ?? capitalOf(row.investment, row.sharePct),
      poolPnl: row.poolPnl,
      gross: row.grossEarned,
      cut: row.platformCut,
      cutPct: PLATFORM_CUT_PCT,
      net: row.netEarned,
      roiPct: row.roiPct,
      startedAt: row.startedAt,
      endedAt: null,
      daysElapsed,
      daysTotal,
      daysRemaining: Math.max(0, daysTotal - daysElapsed),
      dailyAvg: round2(row.netEarned / daysElapsed),
      currentValue: row.currentValue,
      unsettled: row.netEarned,
      reconciledAt: null,
      guardianLevel: row.guardianLevel,
      poolHref: row.poolHref,
      liveHref: row.liveHref,
      note: `Accrues daily · settles in the ${row.settlementBatch}`,
    };
  });

  const settled: PoolEarnings[] = investments.completed.map((row) => ({
    id: `ep_${row.poolId}`,
    poolId: row.poolId,
    code: row.code,
    name: row.name,
    status: "completed",
    strategy: STRATEGY_BY_RISK[row.riskBand] ?? "Pooled strategy",
    riskBand: row.riskBand,
    investment: row.investment,
    sharePct: row.sharePct,
    poolCapital: capital.get(row.poolId) ?? capitalOf(row.investment, row.sharePct),
    poolPnl: pnlOf(row.grossEarnings, row.sharePct),
    gross: row.grossEarnings,
    cut: row.platformCut,
    cutPct: PLATFORM_CUT_PCT,
    net: row.netEarnings,
    roiPct: row.userRoiPct,
    startedAt: row.startedAt,
    endedAt: row.completedAt,
    daysElapsed: row.daysHeld,
    daysTotal: row.daysHeld,
    daysRemaining: 0,
    dailyAvg: round2(row.netEarnings / Math.max(1, row.daysHeld)),
    currentValue: round2(row.investment + row.netEarnings),
    unsettled: 0,
    reconciledAt: row.settlement === "reconciled" ? row.completedAt : null,
    guardianLevel: null,
    poolHref: `/investor/pools/${row.poolId}`,
    liveHref: null,
    note:
      row.payoutStatus === "paid"
        ? `Settled and paid out under ${row.payoutRef}`
        : `Settled · payout ${row.payoutRef} is ${row.payoutStatus}`,
  }));

  return [...live, ...settled];
}

function buildKpis(
  pools: PoolEarnings[],
  investments: InvestmentsWorkspace,
  month: ReturnType<typeof monthProgress>,
  asOf: string,
): EarningsKpi[] {
  const totals = poolTotals(pools);
  const deployed = investments.summary.deployedCapital;
  const best = totals.best;
  const worst = totals.worst;
  return [
    {
      key: "lifetime",
      label: "Total earned lifetime",
      value: totals.net,
      prefix: "$",
      decimals: 2,
      hint: `${totals.positions} positions · ${totals.livePositions} live, ${totals.completedPositions} settled`,
      tone: "is-pos",
      detail: `Gross $${totals.gross.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} less the ${PLATFORM_CUT_PCT}% platform cut of $${totals.cut.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })}.`,
    },
    {
      key: "month",
      label: "This month earnings",
      value: month.net,
      prefix: "$",
      decimals: 2,
      hint: `${month.sharePct.toFixed(1)}% of lifetime · ${month.daysElapsed} of ${month.daysInMonth} days`,
      tone: "is-accent",
      detail: `${month.label}: ${month.settled > 0 ? "two cycles settled" : "one cycle settled"} and the live cycles accrued $${month.accrued.toFixed(2)}.`,
    },
    {
      key: "average",
      label: "Average per pool",
      value: round2(totals.net / Math.max(1, totals.positions)),
      prefix: "$",
      decimals: 2,
      hint: `${totals.positions} pools share the lifetime total`,
      tone: "",
      detail: `Median position is $${(
        pools
          .map((row) => row.net)
          .sort((a, b) => a - b)[Math.floor(pools.length / 2)] ?? 0
      ).toFixed(2)}; the mean is pulled up by PKG-03.`,
    },
    {
      key: "best",
      label: "Best pool",
      value: best?.net ?? 0,
      prefix: "+$",
      decimals: 2,
      hint: best ? `${best.code} ${best.name} · ${best.roiPct.toFixed(2)}% ROI` : "No positions yet",
      tone: "is-pos",
      detail: best
        ? `${best.sharePct}% of $${best.poolPnl.toLocaleString("en-US")} pool P&L across ${best.daysTotal} days.`
        : "",
    },
    {
      key: "worst",
      label: "Lowest pool",
      value: worst?.net ?? 0,
      prefix: "+$",
      decimals: 2,
      hint: worst ? `${worst.code} ${worst.name} · ${worst.roiPct.toFixed(2)}% ROI` : "No positions yet",
      tone: "",
      detail: worst
        ? `Smallest net of the book — still positive, so no cycle has lost capital by ${dayKey(asOf)}.`
        : "",
    },
    {
      key: "roi",
      label: "Average ROI",
      value: deployed > 0 ? round2((totals.net / deployed) * 100) : 0,
      prefix: "+",
      decimals: 2,
      suffix: "%",
      hint: `On $${deployed.toLocaleString("en-US")} deployed capital`,
      tone: "is-accent",
      detail: `Deployed capital excludes the $${investments.summary.bookedCapital.toLocaleString(
        "en-US",
      )} still booked into pools that have not opened.`,
    },
  ];
}

function buildFormula(pools: PoolEarnings[]): EarningsWorkspace["formula"] {
  const samples = pools.map(buildSample);
  return {
    cutPct: PLATFORM_CUT_PCT,
    refreshSeconds: EARNINGS_REFRESH_SECONDS,
    steps: samples[0]?.steps ?? [],
    samples,
    notes: [
      `The pool books P&L after the ${PLATFORM_CUT_PCT}% platform cut, so gross is recovered by dividing by 0.8 before the cut is shown.`,
      "Your share is fixed at booking time and is applied to realised pool P&L, not to the slot price.",
      "Accruals are estimates until the settlement batch runs; only settled lines move the wallet.",
      `Every figure recomputes on the ${EARNINGS_REFRESH_SECONDS / 60}-minute cadence or when you press refresh.`,
    ],
  };
}

function buildSample(pool: PoolEarnings): FormulaSample {
  const preCut = round2(pool.poolPnl / (1 - pool.cutPct / 100));
  const steps: FormulaStep[] = [
    {
      key: "pnl",
      label: "Pool P&L, pre-cut",
      expression: `$${pool.poolPnl.toFixed(2)} ÷ ${(1 - pool.cutPct / 100).toFixed(2)}`,
      value: preCut,
      unit: "usd",
      note: "The cut the pool already booked is reversed to get the trading result.",
    },
    {
      key: "share",
      label: "Your share",
      expression: `× ${pool.sharePct.toFixed(2)}%`,
      value: pool.gross,
      unit: "usd",
      note: `$${pool.investment.toLocaleString("en-US")} of $${pool.poolCapital.toLocaleString(
        "en-US",
      )} pool capital.`,
    },
    {
      key: "cut",
      label: "Platform cut",
      expression: `− ${pool.cutPct.toFixed(2)}%`,
      value: -pool.cut,
      unit: "usd",
      note: "Ops, custody and settlement, taken from the gross share.",
    },
    {
      key: "net",
      label: "Net to your wallet",
      expression: "gross − cut",
      value: pool.net,
      unit: "usd",
      note:
        pool.status === "live"
          ? "Accrued, released in the next settlement batch."
          : "Settled and paid out.",
    },
    {
      key: "roi",
      label: "Return on investment",
      expression: "net ÷ invested",
      value: pool.roiPct,
      unit: "pct",
      note: `${pool.daysTotal} days in cycle.`,
    },
  ];
  return {
    poolCode: pool.code,
    poolName: pool.name,
    poolPnl: pool.poolPnl,
    investment: pool.investment,
    poolCapital: pool.poolCapital,
    sharePct: pool.sharePct,
    gross: pool.gross,
    cut: pool.cut,
    cutPct: pool.cutPct,
    net: pool.net,
    roiPct: pool.roiPct,
    steps,
  };
}

function buildTax(
  pools: PoolEarnings[],
  investments: InvestmentsWorkspace,
  wallet: ReturnType<typeof getWalletWorkspace>,
): EarningsWorkspace["tax"] {
  const totals = poolTotals(pools);
  const notes: TaxNote[] = [
    {
      label: "Gross earnings (your share, 5 cycles)",
      value: totals.gross,
      tone: "is-pos",
      hint: "Pre-cut share of pool P&L across PKG-00, PKG-01, PKG-02, PKG-03 and PKG-06.",
    },
    {
      label: `Platform fee (${PLATFORM_CUT_PCT}% cut)`,
      value: -totals.cut,
      tone: "is-cut",
      hint: "Deductible service fee — every line traces to a pool settlement note.",
    },
    {
      label: "Net earnings",
      value: totals.net,
      tone: "is-pos",
      hint: "Gross less the platform fee; equals the lifetime KPI on this page.",
    },
    {
      label: "Bank return fee",
      value: -wallet.lifetime.feesPaid,
      tone: "is-cut",
      hint: "Charged 16 Sep when a $500 payout was returned by the receiving bank.",
    },
    {
      label: "Net taxable profit",
      value: round2(totals.net - wallet.lifetime.feesPaid),
      tone: "is-pos",
      hint: "The line a filing pack carries as other income for the year.",
    },
    {
      label: "Withdrawn to bank (3 payouts)",
      value: -totals.completed,
      tone: "",
      hint: "Settled cycles already paid out; the money has left the platform.",
    },
    {
      label: "Locked in live cycles",
      value: totals.live,
      tone: "",
      hint: "PKG-01 and PKG-03 accruals, released when each cycle settles.",
    },
    {
      label: "Pending payout",
      value: investments.summary.pendingPayoutAmount,
      tone: "",
      hint: "PO-2026-10-17-0052 is processing; it clears before the filing window.",
    },
    {
      label: "Uninvested wallet balance",
      value: wallet.balance.available,
      tone: "",
      hint: "Cash in the wallet, not earnings — declared separately if withdrawn.",
    },
  ];

  const jurisdictions: Jurisdiction[] = [
    {
      code: "US",
      label: "United States",
      form: "1099-MISC / 1099-K",
      status: "ready",
      note: "Pooled-trade income above $600 is reported; the form pulls the gross and fee lines.",
      current: false,
    },
    {
      code: "UK",
      label: "United Kingdom",
      form: "Self Assessment SA100",
      status: "ready",
      note: "Declare as other income; the pack maps each settlement to the tax year ending 5 Apr.",
      current: false,
    },
    {
      code: "KE",
      label: "Kenya",
      form: "KRA IT1 return",
      status: "ready",
      note: "Resident individual return; pool income is capital gains on a pooled instrument.",
      current: true,
    },
    {
      code: "ZA",
      label: "South Africa",
      form: "ITR12",
      status: "partial",
      note: "Needs a SARS tax number on the profile before the return can be pre-filled.",
      current: false,
    },
  ];

  const documents: TaxDocument[] = [
    {
      id: "ea_doc_seed_1",
      name: `Tax pack ${FISCAL_YEAR} · Kenya`,
      kind: "Filing summary",
      format: "pdf",
      sizeKb: 214,
      generatedAt: "2026-10-19T06:12:00Z",
      reference: "TX-2026-10-19-0001",
      note: "Filing-ready summary with the profit-sharing maths and fee ledger attached.",
    },
    {
      id: "ea_doc_seed_2",
      name: `Workbook ${FISCAL_YEAR} · line-by-line`,
      kind: "Workbook data",
      format: "csv",
      sizeKb: 96,
      generatedAt: "2026-10-19T06:12:00Z",
      reference: "TX-2026-10-19-0002",
      note: "One row per settlement and per accrual day, for an accountant to re-key.",
    },
    {
      id: "ea_doc_seed_3",
      name: "Tax pack 2025 · prior year",
      kind: "Filing summary",
      format: "pdf",
      sizeKb: 188,
      generatedAt: "2026-01-14T09:40:00Z",
      reference: "TX-2026-01-14-0003",
      note: "Kept for the five-year record; the account opened in September 2026.",
    },
  ];

  return {
    year: FISCAL_YEAR,
    notes,
    jurisdictions,
    documents,
    disclaimer:
      "DerivX does not provide tax advice. Consult a tax professional before filing — pool income is reported by you, not withheld by us.",
    filingWindow: "1 Jan – 30 Jun 2027",
    reference: "TX-2026-KE-0041",
  };
}

function buildReports(pools: PoolEarnings[]): ReportRow[] {
  const settled = pools.filter((row) => row.status === "completed");
  return [
    {
      id: "ea_rep_seed_1",
      title: `Monthly statement · ${monthLabelOf(EARNINGS_AS_OF)}`,
      kind: "monthly",
      period: "mtd",
      format: "csv",
      sizeKb: 148,
      generatedAt: "2026-10-23T06:00:00Z",
      status: "ready",
      reference: "RP-2026-10-23-0001",
      scope: "Every settled line and accrual day this month.",
    },
    {
      id: "ea_rep_seed_2",
      title: `Cycle settlement · ${settled[0]?.code ?? "PKG-06"}`,
      kind: "cycle",
      period: "all",
      format: "pdf",
      sizeKb: 216,
      generatedAt: "2026-10-22T08:10:00Z",
      status: "ready",
      reference: "RP-2026-10-22-0002",
      scope: "Final pool P&L, your share, the cut and the payout reference.",
    },
    {
      id: "ea_rep_seed_3",
      title: "Accrual register · last 14 days",
      kind: "accrual",
      period: "14d",
      format: "csv",
      sizeKb: 92,
      generatedAt: "2026-10-23T06:00:00Z",
      status: "ready",
      reference: "RP-2026-10-23-0003",
      scope: "Daily accrual for the two live cycles, unsettled.",
    },
    {
      id: "ea_rep_seed_4",
      title: `Annual summary ${FISCAL_YEAR}`,
      kind: "annual",
      period: "all",
      format: "pdf",
      sizeKb: 264,
      generatedAt: "2026-10-01T09:00:00Z",
      status: "stale",
      reference: "RP-2026-10-01-0004",
      scope: "Year to 1 Oct — regenerate once both live cycles settle.",
    },
    {
      id: "ea_rep_seed_5",
      title: "Payout ledger · Q3 2026",
      kind: "payout",
      period: "all",
      format: "csv",
      sizeKb: 64,
      generatedAt: "2026-10-11T09:25:00Z",
      status: "ready",
      reference: "RP-2026-10-11-0005",
      scope: "Three payouts with fees and bank references.",
    },
  ];
}

const monthLabelOf = (iso: string) => {
  const months = [
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
  return `${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
};

function buildPayouts(
  investments: InvestmentsWorkspace,
  pools: PoolEarnings[],
): PayoutRow[] {
  return investments.payouts.map((row) => {
    const pool = pools.find((entry) => entry.poolId === row.poolId);
    return {
      id: row.id,
      reference: row.reference,
      poolCode: row.poolCode,
      poolName: pool?.name ?? "Pooled cycle",
      amount: row.amount,
      fee: row.fee,
      net: row.net,
      status: row.status === "paid" ? "paid" : "processing",
      requestedAt: row.requestedAt,
      paidAt: row.processedAt,
      destination: row.destination,
    };
  });
}

function buildForecast(
  pools: PoolEarnings[],
  lifetime: number,
  asOf: string,
): EarningsWorkspace["forecast"] {
  const daily = round2(
    pools
      .filter((row) => row.status === "live")
      .reduce((sum, row) => sum + row.dailyAvg, 0),
  );
  const banked = round2(
    pools.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.net, 0),
  );
  return Array.from({ length: 15 }, (_, day) => {
    const date = new Date(new Date(asOf).getTime() + day * DAY_MS).toISOString();
    return {
      day,
      date,
      live: round2(lifetime + daily * day),
      conservative: round2(lifetime + daily * day * 0.72),
      settled: banked,
    };
  });
}

const PAGE_LABEL = "Earnings & Reports";

export function buildEarningsWorkspace(): EarningsWorkspace {
  const investments = getInvestmentsWorkspace();
  const wallet = getWalletWorkspace();
  const asOf = EARNINGS_AS_OF;
  const pools = buildPools(investments, asOf);
  const timeline = buildTimeline(pools, asOf);
  const lifetime = round2(timeline.reduce((sum, row) => sum + row.amount, 0));

  const workspace: EarningsWorkspace = {
    mode: "demo",
    asOf,
    revision: 0,
    profile: {
      id: "inv_jane_001",
      displayName: "Jane Muthoni",
      email: "jane.muthoni@example.com",
      country: "Kenya",
      joinedAt: "2026-09-12",
      kycLevel: "Verified · Tier 2",
      currency: "USD",
      wallet: wallet.balance.available,
      committed: investments.summary.activeCapital,
      monthRoiPct: round2(
        (monthProgress({
          asOf,
          timeline,
        } as Pick<EarningsWorkspace, "asOf" | "timeline"> as EarningsWorkspace).net /
          Math.max(1, investments.summary.totalInvested)) *
          100,
      ),
      unread: 3,
      fiscalYear: FISCAL_YEAR,
      jurisdiction: "KE",
      bankAccount: "Bank transfer ·•••• 8842",
    },
    overview: [],
    pools,
    timeline,
    timelinePeriod: "14d",
    tax: buildTax(pools, investments, wallet),
    formula: buildFormula(pools),
    reports: buildReports(pools),
    payouts: buildPayouts(investments, pools),
    exports: [
      {
        id: "ea_exp_seed_1",
        scope: "by-pool",
        format: "csv",
        rows: pools.length,
        createdAt: "2026-10-23T07:20:00Z",
        bytes: 1482,
        reference: "EX-2026-10-23-0001",
      },
      {
        id: "ea_exp_seed_2",
        scope: "tax",
        format: "pdf",
        rows: 9,
        createdAt: "2026-10-19T06:12:00Z",
        bytes: 219_136,
        reference: "EX-2026-10-19-0002",
      },
    ],
    preferences: defaultPreferences(),
    forecast: buildForecast(pools, lifetime, asOf),
    support: [
      {
        id: "ea_sup_seed_1",
        topic: "tax",
        message:
          "Does the platform fee line need to be listed separately on the KRA IT1, or is the net figure enough?",
        status: "local_draft",
        createdAt: "2026-10-21T15:04:00Z",
      },
    ],
    audit: [
      {
        id: "ea_audit_seed_1",
        at: "2026-10-23T06:00:00Z",
        action: "accruals_recomputed",
        detail: "PKG-01 · PKG-03 · 3-minute cadence",
      },
      {
        id: "ea_audit_seed_2",
        at: "2026-10-22T08:10:00Z",
        action: "cycle_settled",
        detail: "PKG-06 Steady Income · +$849.60 · PO-2026-10-22-0047",
      },
      {
        id: "ea_audit_seed_3",
        at: "2026-10-19T06:12:00Z",
        action: "tax_pack_generated",
        detail: `Fiscal year ${FISCAL_YEAR} · Kenya · PDF + CSV`,
      },
      {
        id: "ea_audit_seed_4",
        at: "2026-10-11T09:20:00Z",
        action: "payout_paid",
        detail: "PKG-00 Genesis · $1,180.80 · PO-2026-10-11-0031",
      },
    ],
  };

  const month = monthProgress(workspace);
  workspace.overview = buildKpis(pools, investments, month, asOf);
  return workspace;
}

/** Demo store — the last applied command, reset on `resetEarningsWorkspace()`. */
let current: EarningsWorkspace | null = null;

export function getEarningsWorkspace(): EarningsWorkspace {
  if (!current) current = buildEarningsWorkspace();
  return current;
}

export function resetEarningsWorkspace(): EarningsWorkspace {
  current = buildEarningsWorkspace();
  return current;
}

export function applyEarningsMutation(command: EarningsCommand): EarningsWorkspace {
  const next = applyEarningsCommand(getEarningsWorkspace(), command);
  current = next;
  return next;
}

export const EARNINGS_PAGE_LABEL = PAGE_LABEL;

/** Timeline rows for a single pool, used by the drawer's detail tab. */
export function timelineForPool(
  workspace: EarningsWorkspace,
  poolId: string,
): TimelineDay[] {
  const pool = workspace.pools.find((row) => row.id === poolId || row.poolId === poolId);
  if (!pool) return [];
  return workspace.timeline.filter((row) =>
    row.pools.some((line) => line.code === pool.code),
  );
}
