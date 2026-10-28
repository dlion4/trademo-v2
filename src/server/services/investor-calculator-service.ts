import {
  AMOUNT_STEP,
  CALCULATOR_AS_OF,
  DEFAULT_POOLS,
  HISTORY_SIZE,
  MAX_AMOUNT,
  MAX_DAYS,
  MAX_ROI_PCT,
  MIN_AMOUNT,
  MIN_DAYS,
  MIN_ROI_PCT,
  PLATFORM_CUT_PCT,
  ROI_STEP,
  SCENARIO_BANDS,
  SCENARIO_SLOTS,
  type CalculatorPayoutMethod,
  type CalculatorPool,
  type CalculatorPreset,
  type CalculatorRail,
  type CalculatorWorkspace,
  type HistoricalPool,
} from "@/lib/investor/calculator";

import { getPoolsWorkspace } from "./investor-pools-service";
import { getWalletWorkspace } from "./investor-wallet-service";

/**
 * I-8 fixture source — the calculation reference set.
 *
 * Nothing on the calculator is a literal on the page. This service resolves the
 * pools you can project against from the pool book (I-2/I-3), the funding and
 * payout rails from the wallet (I-7), and the historical archive below. A backend
 * replaces this file with three queries and the page keeps working.
 */

const DAY_MS = 86_400_000;

/** Platform cut on gross earnings — the same 20% I-6 books on every settled pool. */
export const PLATFORM_CUT_PCT_DEMO = PLATFORM_CUT_PCT;

/**
 * Historical archive — the last ten "Basic Growth · 14-day" cycles, oldest first.
 * The aggregate is the brief's own: average 14.2%, median 13.7%, best 21.8%
 * (PKG-GenesisPlus), worst 8.5% (PKG-Starter2), win rate 58–67%.
 */
const ARCHIVE: Omit<HistoricalPool, "startedAt">[] = [
  {
    id: "pkg_hist_01",
    code: "PKG-Balanced3",
    name: "Balanced Growth III",
    strategy: "Mean reversion on R_10 / R_75",
    markets: ["R_10", "R_75"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 42_000,
    investors: 22,
    roiPct: 12.9,
    winRatePct: 61.7,
    trades: 286,
    completedAt: "2026-05-11T16:00:00Z",
    note: "Steady book, one flat week mid-cycle.",
  },
  {
    id: "pkg_hist_02",
    code: "PKG-Range9",
    name: "Range Rider IX",
    strategy: "Range fade on R_10 / R_100",
    markets: ["R_10", "R_100"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 36_000,
    investors: 18,
    roiPct: 10.2,
    winRatePct: 59.4,
    trades: 244,
    completedAt: "2026-06-02T16:00:00Z",
    note: "Low-volatility fortnight; position size held down.",
  },
  {
    id: "pkg_hist_03",
    code: "PKG-Trend2",
    name: "Trend Follow II",
    strategy: "Breakout continuation on R_75",
    markets: ["R_75", "R_100"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 48_000,
    investors: 26,
    roiPct: 14.0,
    winRatePct: 63.1,
    trades: 312,
    completedAt: "2026-06-30T16:00:00Z",
    note: "Cleanest trending fortnight of the quarter.",
  },
  {
    id: "pkg_hist_04",
    code: "PKG-Momentum7",
    name: "Momentum VII",
    strategy: "Momentum ladder on R_50 / R_75",
    markets: ["R_50", "R_75"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 39_000,
    investors: 20,
    roiPct: 15.7,
    winRatePct: 65.2,
    trades: 298,
    completedAt: "2026-07-02T16:00:00Z",
    note: "Bot-Delta carried the cycle with a five-win streak.",
  },
  {
    id: "pkg_hist_05",
    code: "PKG-Core14",
    name: "Core Fourteen",
    strategy: "Two-symbol blend, symmetric stakes",
    markets: ["R_10", "R_75"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 33_000,
    investors: 17,
    roiPct: 11.6,
    winRatePct: 60.8,
    trades: 231,
    completedAt: "2026-07-19T16:00:00Z",
    note: "Guardian stepped in twice; both pauses saved capital.",
  },
  {
    id: "pkg_hist_06",
    code: "PKG-Rotation5",
    name: "Rotation V",
    strategy: "Rotation between R_10 and R_100",
    markets: ["R_10", "R_100"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 45_000,
    investors: 24,
    roiPct: 14.8,
    winRatePct: 64.0,
    trades: 330,
    completedAt: "2026-08-04T16:00:00Z",
    note: "Rotation switch caught the mid-cycle volatility spike.",
  },
  {
    id: "pkg_hist_07",
    code: "PKG-Starter2",
    name: "Starter II",
    strategy: "Conservative fade, half-size stakes",
    markets: ["R_10"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 27_000,
    investors: 15,
    roiPct: 8.5,
    winRatePct: 58.2,
    trades: 196,
    completedAt: "2026-08-15T16:00:00Z",
    note: "Worst cycle on record — thin range, no follow-through.",
  },
  {
    id: "pkg_hist_08",
    code: "PKG-GenesisPlus",
    name: "Genesis Plus",
    strategy: "Breakout plus trend filter",
    markets: ["R_10", "R_75"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 51_000,
    investors: 28,
    roiPct: 21.8,
    winRatePct: 67.0,
    trades: 364,
    completedAt: "2026-09-01T16:00:00Z",
    note: "Best cycle on record — a sustained two-week trend.",
  },
  {
    id: "pkg_hist_09",
    code: "PKG-Steady14",
    name: "Steady Fourteen",
    strategy: "Low-drawdown mean reversion",
    markets: ["R_10", "R_50"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 30_000,
    investors: 16,
    roiPct: 13.4,
    winRatePct: 62.3,
    trades: 218,
    completedAt: "2026-09-12T16:00:00Z",
    note: "The cycle this account opened on.",
  },
  {
    id: "pkg_hist_10",
    code: "PKG-Carry14",
    name: "Carry Fourteen",
    strategy: "Carry-style stake ladder",
    markets: ["R_75", "R_100"],
    slotPrice: 3000,
    durationDays: 14,
    capital: 44_000,
    investors: 23,
    roiPct: 19.1,
    winRatePct: 66.1,
    trades: 341,
    completedAt: "2026-10-06T16:00:00Z",
    note: "Strong close; last archive entry before this window.",
  },
];

function archive(): HistoricalPool[] {
  return ARCHIVE.slice(-HISTORY_SIZE).map((row) => ({
    ...row,
    startedAt: new Date(
      Date.parse(row.completedAt) - row.durationDays * DAY_MS,
    ).toISOString(),
  }));
}

/** Pools the calculator can project against, in book order. */
function calculatorPools(): CalculatorPool[] {
  const book = getPoolsWorkspace();
  const rows: CalculatorPool[] = [];

  book.trading.forEach((pool) => {
    rows.push({
      id: pool.id,
      code: pool.code,
      name: pool.name,
      lifecycle: "trading",
      strategy: pool.strategy,
      markets: pool.markets,
      riskBand: pool.riskBand,
      slotPrice: pool.slotPrice,
      durationDays: Math.max(
        1,
        Math.round(
          (Date.parse(pool.endsAt) - Date.parse(pool.startedAt)) / DAY_MS,
        ),
      ),
      expectedRoiPct: pool.roiPct > 0 ? pool.roiPct : 15,
      minSlot: 1,
      maxSlotsPerUser: 10,
      profitSharePct: pool.profitSharePct,
      closesAt: pool.endsAt,
      bookable: false,
      bookingHref: `/investor/pools/${pool.id}`,
      detailHref: `/investor/pools/${pool.id}`,
    });
  });

  book.open.forEach((pool) => {
    rows.push({
      id: pool.id,
      code: pool.code,
      name: pool.name,
      lifecycle: "open",
      strategy: pool.strategy,
      markets: pool.riskBand === "Aggressive" ? ["R_100", "R_75"] : ["R_10", "R_75"],
      riskBand: pool.riskBand,
      slotPrice: pool.minSlot,
      durationDays: pool.durationDays,
      expectedRoiPct: pool.expectedRoiPct,
      minSlot: pool.minSlot,
      maxSlotsPerUser: pool.maxSlotsPerUser,
      profitSharePct: PLATFORM_CUT_PCT,
      closesAt: pool.closesAt,
      bookable: true,
      bookingHref: `/investor/pools/${pool.id}/book`,
      detailHref: `/investor/pools/${pool.id}`,
    });
  });

  book.upcoming.forEach((pool) => {
    rows.push({
      id: pool.id,
      code: pool.code,
      name: pool.name,
      lifecycle: "upcoming",
      strategy: pool.strategy,
      markets: pool.riskBand === "Aggressive" ? ["R_100", "R_75"] : ["R_10", "R_75"],
      riskBand: pool.riskBand,
      slotPrice: pool.minSlot,
      durationDays: pool.durationDays,
      expectedRoiPct: pool.expectedRoiPct,
      minSlot: pool.minSlot,
      maxSlotsPerUser: pool.maxSlotsPerUser,
      profitSharePct: PLATFORM_CUT_PCT,
      closesAt: pool.closesAt,
      bookable: false,
      bookingHref: `/investor/pools/${pool.id}`,
      detailHref: `/investor/pools/${pool.id}`,
    });
  });

  return rows;
}

const PRESETS: CalculatorPreset[] = [
  {
    id: "pre_seed_01",
    name: "Brief baseline",
    amount: 3000,
    roiPct: 15,
    durationDays: 14,
    pinned: true,
    note: "The brief's own worked example — one slot, 15%, 14 days.",
    createdAt: "2026-09-12T10:00:00Z",
  },
  {
    id: "pre_seed_02",
    name: "Two slots, conservative",
    amount: 6000,
    roiPct: 8,
    durationDays: 14,
    pinned: false,
    note: "What the same booking looks like on the worst historical band.",
    createdAt: "2026-10-02T09:30:00Z",
  },
  {
    id: "pre_seed_03",
    name: "Three slots, 21-day window",
    amount: 9000,
    roiPct: 18,
    durationDays: 21,
    pinned: false,
    note: "Modelled on the open PKG-02 funding window.",
    createdAt: "2026-10-19T14:05:00Z",
  },
];

export function getCalculatorWorkspace(): CalculatorWorkspace {
  const wallet = getWalletWorkspace();
  const pools = calculatorPools();
  const defaultPool =
    pools.find((pool) => pool.code === "PKG-05") ??
    pools.find((pool) => pool.bookable) ??
    pools[0];

  const depositRails: CalculatorRail[] = wallet.depositRails.map((rail) => ({
    key: rail.key,
    label: rail.label,
    feePct: rail.feePct,
    feeFlat: rail.feeFlat,
    feeNote: rail.feeNote,
    eta: rail.eta,
  }));

  const payoutMethods: CalculatorPayoutMethod[] = wallet.methods.map((method) => ({
    id: method.id,
    label: method.label,
    kind: method.kind,
    detail: method.detail,
    feeNote: method.feeNote,
    verified: method.verified,
    payoutEnabled: method.payoutEnabled,
  }));

  return structuredClone({
    mode: "demo" as const,
    asOf: CALCULATOR_AS_OF,
    revision: 0,
    profile: {
      id: wallet.profile.id,
      displayName: wallet.profile.displayName,
      investorSince: wallet.profile.investorSince,
      tier: wallet.profile.tier,
      country: wallet.profile.country,
      currency: wallet.profile.currency,
      kycLevel: wallet.profile.kycLevel,
      walletAvailable: wallet.balance.available,
      unread: wallet.profile.unread,
      monthRoiPct: wallet.profile.monthRoiPct,
      lifetimeNet: wallet.lifetime.earnedCredited,
    },
    defaults: { amount: 3000, roiPct: 15, durationDays: 14 },
    bounds: {
      amount: { min: MIN_AMOUNT, max: MAX_AMOUNT, step: AMOUNT_STEP },
      roiPct: { min: MIN_ROI_PCT, max: MAX_ROI_PCT, step: ROI_STEP },
      durationDays: { min: MIN_DAYS, max: MAX_DAYS, step: 1 },
      slots: { min: 1, max: 3 },
    },
    platformCutPct: PLATFORM_CUT_PCT,
    slotPrice: defaultPool?.slotPrice ?? 3000,
    defaultPoolId: defaultPool?.id ?? "pkg_05",
    pools,
    depositRails,
    payoutMethods,
    bands: SCENARIO_BANDS,
    scenarioSlots: [...SCENARIO_SLOTS],
    historical: archive(),
    presets: PRESETS,
    savedScenarios: [],
    preferences: {
      reinvest: true,
      compoundPools: DEFAULT_POOLS,
      showGross: true,
      includeFees: true,
      payoutFeeWaived: true,
    },
    exports: [],
    acknowledgements: [],
    support: [],
    audit: [],
  } satisfies CalculatorWorkspace);
}

/** Small helper the page uses for the funding rail default. */
export function defaultRail(workspace: CalculatorWorkspace): CalculatorRail {
  return (
    workspace.depositRails.find((rail) => rail.key === "bank_transfer") ??
    workspace.depositRails[0]
  );
}

/** Small helper the page uses for the payout default. */
export function defaultPayoutMethod(
  workspace: CalculatorWorkspace,
): CalculatorPayoutMethod {
  return (
    workspace.payoutMethods.find(
      (method) => method.payoutEnabled && method.verified,
    ) ??
    workspace.payoutMethods.find((method) => method.payoutEnabled) ??
    workspace.payoutMethods[0]
  );
}
