import {
  POOL_DETAIL_AS_OF,
  type DetailDocument,
  type DetailEvent,
  type DetailLifecycle,
  type EarningsDay,
  type GuardianEvent,
  type ParticipantBand,
  type ParticipantRow,
  type PoolDetailWorkspace,
  type PoolGuardianDetail,
  type PoolPerformance,
  type PoolTrade,
  type RelatedPool,
  type ScheduleStep,
} from "@/lib/investor/pool-detail";

import { getPoolsWorkspace } from "./investor-pools-service";

/**
 * I-3 fixture source. Every figure is deterministic and derived from the I-2
 * pool book so both pages agree; detail-only data (daily attribution, trade
 * ledger, Guardian triggers, anonymised participants) is authored per pool.
 */

const ALIASES = [
  "User_A",
  "User_B",
  "User_C",
  "User_D",
  "User_E",
  "User_F",
  "User_G",
  "User_H",
  "User_I",
  "User_J",
  "User_K",
  "User_L",
  "User_M",
  "User_N",
];

const round2 = (value: number) => Number(value.toFixed(2));

/** Turn a gross-per-day array into dated gross/net rows ending 2026-10-22. */
function buildDaily(gross: number[], cutPct = 20): EarningsDay[] {
  const end = Date.parse("2026-10-22T23:59:00Z");
  return gross.map((value, index) => {
    const offset = gross.length - 1 - index;
    const date = new Date(end - offset * 86_400_000).toISOString().slice(0, 10);
    return {
      date,
      gross: round2(value),
      net: round2(value * (1 - cutPct / 100)),
    };
  });
}

function buildCurve(values: number[], endIso: string) {
  const end = Date.parse(endIso);
  return values.map((value, index) => {
    const offset = values.length - 1 - index;
    return {
      at: new Date(end - offset * 86_400_000).toISOString(),
      value: round2(value),
    };
  });
}

/** Deterministic anonymised allocation ledger: slots always reconcile. */
function buildParticipants(spec: {
  youSlots: number;
  youInvestment: number;
  investors: number;
  totalSlots: number;
  slotPrice: number;
}): { rows: ParticipantRow[]; tail: ParticipantRow[] } {
  const others = Math.max(0, spec.investors - 1);
  let remaining = Math.max(0, spec.totalSlots - spec.youSlots);
  const slotsByAlias: number[] = [];
  for (let index = 0; index < others; index += 1) {
    const take = Math.ceil(remaining / (others - index));
    slotsByAlias.push(Math.max(0, Math.min(take, remaining)));
    remaining -= take;
  }
  const rows: ParticipantRow[] = [
    {
      id: "you",
      rank: 1,
      alias: "You",
      slots: spec.youSlots,
      investment: spec.youInvestment,
      sharePct: 0,
      isYou: true,
    },
    ...slotsByAlias.map((slots, index) => ({
      id: `alias_${index + 1}`,
      rank: index + 2,
      alias: ALIASES[index] ?? `User_${index + 1}`,
      slots,
      investment: slots * spec.slotPrice,
      sharePct: 0,
      isYou: false,
    })),
  ].filter((row) => row.slots > 0 || row.isYou);
  rows.sort((a, b) => b.slots - a.slots || (a.isYou ? -1 : 1));
  const committed = rows.reduce((sum, row) => sum + row.investment, 0);
  rows.forEach((row, index) => {
    row.rank = index + 1;
    row.sharePct = committed
      ? Number(((row.investment / committed) * 100).toFixed(1))
      : 0;
  });
  return { rows: rows.slice(0, 6), tail: rows.slice(6) };
}

function bandsFromRows(rows: ParticipantRow[]): ParticipantBand[] {
  const bucket = (label: string, test: (slots: number) => boolean) => {
    const hit = rows.filter((row) => test(row.slots));
    return {
      label,
      count: hit.length,
      investment: round2(hit.reduce((sum, row) => sum + row.investment, 0)),
      sharePct: 0,
    };
  };
  const bands = [
    bucket("5+ slots", (slots) => slots >= 5),
    bucket("2–4 slots", (slots) => slots >= 2 && slots <= 4),
    bucket("1 slot", (slots) => slots === 1),
  ].filter((band) => band.count > 0);
  const total = bands.reduce((sum, band) => sum + band.investment, 0);
  bands.forEach((band) => {
    band.sharePct = total
      ? Number(((band.investment / total) * 100).toFixed(1))
      : 0;
  });
  return bands;
}

/* ── Per-pool detail seeds ── */

interface Seed {
  thesis: string;
  tokens: number;
  daily: number[];
  performance:
    | (Omit<PoolPerformance, "winRatePct" | "curve" | "best" | "worst"> & {
        best: {
          id: string;
          symbol: string;
          pnl: number;
          share: number;
          at: string;
        };
        worst: {
          id: string;
          symbol: string;
          pnl: number;
          share: number;
          at: string;
        };
        curveValues: number[];
      })
    | null;
  trades: PoolTrade[];
  guardian: {
    rotation: boolean;
    triggersTotal: number;
    recoveredLabel: string;
    events: GuardianEvent[];
  };
  participants:
    | {
        mode: "rows";
        youSlots: number;
        youInvestment: number;
        investors: number;
        totalSlots: number;
        slotPrice: number;
        note: string;
      }
    | {
        mode: "bands";
        investors: number;
        totalSlots: number;
        committed: number;
        bands: ParticipantBand[];
        note: string;
      };
  documents: DetailDocument[];
}

const doc = (
  id: string,
  name: string,
  kind: DetailDocument["kind"],
  format: DetailDocument["format"],
  sizeLabel: string,
  updatedAt: string,
  scope: DetailDocument["scope"] = "pool",
): DetailDocument => ({ id, name, kind, format, sizeLabel, updatedAt, scope });

const baseDocs = (code: string, updatedAt: string): DetailDocument[] => [
  doc(
    `${code}_factsheet`,
    `${code} pool factsheet`,
    "factsheet",
    "pdf",
    "184 KB",
    updatedAt,
  ),
  doc(
    `${code}_policy`,
    "Settlement & profit-share policy",
    "policy",
    "pdf",
    "96 KB",
    "2026-09-01T09:00:00Z",
  ),
  doc(
    `${code}_risk`,
    "Guardian risk disclosure",
    "policy",
    "pdf",
    "72 KB",
    "2026-09-01T09:00:00Z",
  ),
];

const seeds: Record<string, Seed> = {
  pkg_01: {
    thesis:
      "A balanced rise/fall programme on three synthetic indices. Stake size scales with the Guardian drawdown band, so exposure shrinks automatically after a losing streak instead of compounding it.",
    tokens: 150000,
    daily: [84, 96, 72, 90, 78, 102, 66, 96, 84, 90, 108, 78, 84, 132],
    performance: {
      totalPnl: 4200,
      wins: 101,
      losses: 47,
      trades: 148,
      openTrades: 1,
      maxDrawdownPct: 2.8,
      maxDrawdownAt: "2026-10-12T13:42:00Z",
      guardianTriggers: 2,
      recoveredInLabel: "4h 18m",
      avgTradeDurationSec: 18,
      best: {
        id: "TRD-1180",
        symbol: "R_10",
        pnl: 231.25,
        share: 69.38,
        at: "2026-10-23T08:12:00Z",
      },
      worst: {
        id: "TRD-1182",
        symbol: "R_50",
        pnl: -150,
        share: -45,
        at: "2026-10-23T08:58:00Z",
      },
      curveValues: [
        0, 320, 610, 540, 880, 1240, 1180, 1660, 2140, 2480, 2960, 3320, 3510,
        3860, 4200,
      ],
      benchmarks: [
        {
          label: "Against plan",
          value: "+0.4pp",
          hint: "8.4% realised vs 8.0% plan",
        },
        {
          label: "Guardian band",
          value: "5.0%",
          hint: "hard drawdown ceiling",
        },
        {
          label: "Win-rate floor",
          value: "60%",
          hint: "below floor pauses the pool",
        },
      ],
    },
    trades: [
      {
        id: "TRD-1184",
        symbol: "R_100",
        contract: "Rise · 5 ticks",
        stake: 200,
        poolPnl: 184.4,
        investorShare: 55.32,
        result: "won",
        openedAt: "2026-10-23T09:41:00Z",
        closedAt: "2026-10-23T09:43:00Z",
        durationSec: 120,
      },
      {
        id: "TRD-1182",
        symbol: "R_50",
        contract: "Rise · 4 ticks",
        stake: 150,
        poolPnl: -150,
        investorShare: -45,
        result: "lost",
        openedAt: "2026-10-23T08:58:00Z",
        closedAt: "2026-10-23T09:00:00Z",
        durationSec: 120,
      },
      {
        id: "TRD-1180",
        symbol: "R_10",
        contract: "Rise · 6 ticks",
        stake: 250,
        poolPnl: 231.25,
        investorShare: 69.38,
        result: "won",
        openedAt: "2026-10-23T08:12:00Z",
        closedAt: "2026-10-23T08:16:00Z",
        durationSec: 240,
      },
      {
        id: "TRD-1176",
        symbol: "R_100",
        contract: "Fall · 4 ticks",
        stake: 200,
        poolPnl: 168.9,
        investorShare: 50.67,
        result: "won",
        openedAt: "2026-10-22T16:40:00Z",
        closedAt: "2026-10-22T16:43:00Z",
        durationSec: 180,
      },
      {
        id: "TRD-1171",
        symbol: "R_50",
        contract: "Rise · 3 ticks",
        stake: 175,
        poolPnl: -175,
        investorShare: -52.5,
        result: "lost",
        openedAt: "2026-10-22T11:05:00Z",
        closedAt: "2026-10-22T11:07:00Z",
        durationSec: 120,
      },
      {
        id: "TRD-1168",
        symbol: "R_10",
        contract: "Fall · 5 ticks",
        stake: 225,
        poolPnl: 197.5,
        investorShare: 59.25,
        result: "won",
        openedAt: "2026-10-21T14:22:00Z",
        closedAt: "2026-10-21T14:26:00Z",
        durationSec: 240,
      },
    ],
    guardian: {
      rotation: true,
      triggersTotal: 2,
      recoveredLabel: "4h 18m",
      events: [
        {
          id: "gl_1",
          at: "2026-10-23T09:12:00Z",
          kind: "trigger",
          title: "Consecutive-loss watch threshold reached",
          detail: "Pool paused for 5 minutes, then cleared",
          outcome: "cleared",
          durationMin: 5,
        },
        {
          id: "gl_2",
          at: "2026-10-23T06:40:00Z",
          kind: "check",
          title: "Drawdown check · 1.8% against 5.0% limit",
          detail: "No action required",
          outcome: "monitored",
          durationMin: null,
        },
        {
          id: "gl_3",
          at: "2026-10-12T13:42:00Z",
          kind: "trigger",
          title: "Drawdown approached the 2.8% mark",
          detail: "Stake size cut by 25% for 40 trades, then restored",
          outcome: "recovered",
          durationMin: 258,
        },
        {
          id: "gl_4",
          at: "2026-10-11T14:35:00Z",
          kind: "config",
          title: "Policy armed for the cycle",
          detail: "8-loss streak · 5% drawdown · rotation on",
          outcome: "armed",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "rows",
      youSlots: 5,
      youInvestment: 15000,
      investors: 6,
      totalSlots: 12,
      slotPrice: 3000,
      note: "Names are anonymised by the funding desk; your own row is highlighted. Slot counts reconcile with the pool's booked capital.",
    },
    documents: baseDocs("PKG-01", "2026-10-23T09:00:00Z"),
  },
  pkg_03: {
    thesis:
      "Even/odd rotation with a volatility filter on R_75 and 1HZ10V. High-variance by design; the Guardian reduces stake size when the realised band widens rather than changing the strategy mid-cycle.",
    tokens: 100000,
    daily: [90, 105, 75, 120, 105, 150, 60, 90, 105, 120, 75, 90, 105, 60],
    performance: {
      totalPnl: 13500,
      wins: 59,
      losses: 37,
      trades: 96,
      openTrades: 1,
      maxDrawdownPct: 3.1,
      maxDrawdownAt: "2026-10-22T18:20:00Z",
      guardianTriggers: 1,
      recoveredInLabel: "2h 05m",
      avgTradeDurationSec: 14,
      best: {
        id: "TRD-1183",
        symbol: "R_75",
        pnl: 472.5,
        share: 47.25,
        at: "2026-10-23T09:22:00Z",
      },
      worst: {
        id: "TRD-1167",
        symbol: "R_75",
        pnl: -520,
        share: -52,
        at: "2026-10-21T14:06:00Z",
      },
      curveValues: [
        0, 900, 1700, 2450, 2100, 3300, 4200, 5100, 6400, 7300, 8100, 9600,
        10600, 12200, 13500,
      ],
      benchmarks: [
        {
          label: "Against plan",
          value: "+0.5pp",
          hint: "13.5% realised vs 13.0% plan",
        },
        {
          label: "Guardian band",
          value: "5.0%",
          hint: "hard drawdown ceiling",
        },
        {
          label: "Volatility filter",
          value: "ON",
          hint: "reduces stake in widened bands",
        },
      ],
    },
    trades: [
      {
        id: "TRD-1183",
        symbol: "R_75",
        contract: "Fall · 3 ticks",
        stake: 500,
        poolPnl: 472.5,
        investorShare: 47.25,
        result: "won",
        openedAt: "2026-10-23T09:22:00Z",
        closedAt: "2026-10-23T09:25:00Z",
        durationSec: 180,
      },
      {
        id: "TRD-1181",
        symbol: "1HZ10V",
        contract: "Even · 1 tick",
        stake: 400,
        poolPnl: 388,
        investorShare: 38.8,
        result: "won",
        openedAt: "2026-10-23T08:31:00Z",
        closedAt: "2026-10-23T08:32:00Z",
        durationSec: 60,
      },
      {
        id: "TRD-1179",
        symbol: "R_75",
        contract: "Rise · 3 ticks",
        stake: 600,
        poolPnl: null,
        investorShare: 0,
        result: "open",
        openedAt: "2026-10-23T09:58:00Z",
        closedAt: null,
        durationSec: null,
      },
      {
        id: "TRD-1167",
        symbol: "R_75",
        contract: "Even · 2 ticks",
        stake: 520,
        poolPnl: -520,
        investorShare: -52,
        result: "lost",
        openedAt: "2026-10-21T14:06:00Z",
        closedAt: "2026-10-21T14:09:00Z",
        durationSec: 180,
      },
      {
        id: "TRD-1163",
        symbol: "1HZ10V",
        contract: "Odd · 1 tick",
        stake: 450,
        poolPnl: 436.5,
        investorShare: 43.65,
        result: "won",
        openedAt: "2026-10-20T10:48:00Z",
        closedAt: "2026-10-20T10:49:00Z",
        durationSec: 60,
      },
    ],
    guardian: {
      rotation: true,
      triggersTotal: 1,
      recoveredLabel: "2h 05m",
      events: [
        {
          id: "g3_1",
          at: "2026-10-22T18:20:00Z",
          kind: "trigger",
          title: "Volatility band widened on R_75",
          detail: "Stake size reduced by 20% for the next 20 trades",
          outcome: "monitored",
          durationMin: 125,
        },
        {
          id: "g3_2",
          at: "2026-10-22T11:05:00Z",
          kind: "check",
          title: "Drawdown check · 2.4% against 5.0% limit",
          detail: "No action required",
          outcome: "monitored",
          durationMin: null,
        },
        {
          id: "g3_3",
          at: "2026-10-14T18:20:00Z",
          kind: "config",
          title: "Policy armed for the cycle",
          detail: "8-loss streak · 5% drawdown · rotation on",
          outcome: "armed",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "rows",
      youSlots: 1,
      youInvestment: 10000,
      investors: 9,
      totalSlots: 9,
      slotPrice: 10000,
      note: "Nine equal allocations. Names are anonymised by the funding desk; your own row is highlighted.",
    },
    documents: baseDocs("PKG-03", "2026-10-23T09:00:00Z"),
  },
  pkg_00: {
    thesis:
      "The opening syndicate cycle: balanced rise/fall with conservative sizing while the desk calibrated its Guardian thresholds. Closed and settled in full.",
    tokens: 90000,
    daily: [96, 120, 84, 108, 132, 90, 114, 126, 102, 138, 96, 108, 84, 78],
    performance: {
      totalPnl: 5904,
      wins: 141,
      losses: 71,
      trades: 212,
      openTrades: 0,
      maxDrawdownPct: 3.4,
      maxDrawdownAt: "2026-09-24T15:10:00Z",
      guardianTriggers: 1,
      recoveredInLabel: "1h 40m",
      avgTradeDurationSec: 22,
      best: {
        id: "TRD-0912",
        symbol: "R_100",
        pnl: 612.4,
        share: 122.48,
        at: "2026-10-02T11:18:00Z",
      },
      worst: {
        id: "TRD-0847",
        symbol: "R_50",
        pnl: -410,
        share: -82,
        at: "2026-09-24T15:10:00Z",
      },
      curveValues: [
        0, 288, 612, 864, 792, 1176, 1488, 1692, 2064, 2496, 2832, 3444, 4104,
        5016, 5904,
      ],
      benchmarks: [
        {
          label: "Against plan",
          value: "+1.4pp",
          hint: "16.4% realised vs 15.0% plan",
        },
        { label: "Guardian band", value: "5.0%", hint: "never breached" },
        { label: "Settlement", value: "Reconciled", hint: "paid 11 Oct 2026" },
      ],
    },
    trades: [
      {
        id: "TRD-0912",
        symbol: "R_100",
        contract: "Rise · 6 ticks",
        stake: 600,
        poolPnl: 612.4,
        investorShare: 122.48,
        result: "won",
        openedAt: "2026-10-02T11:18:00Z",
        closedAt: "2026-10-02T11:24:00Z",
        durationSec: 360,
      },
      {
        id: "TRD-0908",
        symbol: "R_50",
        contract: "Fall · 4 ticks",
        stake: 450,
        poolPnl: 428.5,
        investorShare: 85.7,
        result: "won",
        openedAt: "2026-10-01T15:40:00Z",
        closedAt: "2026-10-01T15:44:00Z",
        durationSec: 240,
      },
      {
        id: "TRD-0847",
        symbol: "R_50",
        contract: "Rise · 5 ticks",
        stake: 410,
        poolPnl: -410,
        investorShare: -82,
        result: "lost",
        openedAt: "2026-09-24T15:10:00Z",
        closedAt: "2026-09-24T15:14:00Z",
        durationSec: 240,
      },
    ],
    guardian: {
      rotation: true,
      triggersTotal: 1,
      recoveredLabel: "1h 40m",
      events: [
        {
          id: "g0_1",
          at: "2026-09-24T15:10:00Z",
          kind: "trigger",
          title: "Six consecutive losses on R_50",
          detail: "Pool paused for 8 minutes, stake cut for 30 trades",
          outcome: "recovered",
          durationMin: 100,
        },
        {
          id: "g0_2",
          at: "2026-10-10T18:00:00Z",
          kind: "check",
          title: "Final drawdown review before settlement",
          detail: "3.4% maximum, inside the 5% policy band",
          outcome: "closed",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "rows",
      youSlots: 3,
      youInvestment: 9000,
      investors: 9,
      totalSlots: 12,
      slotPrice: 3000,
      note: "Closed cycle. Allocation shares are final and reconciled against the settlement record.",
    },
    documents: [
      ...baseDocs("PKG-00", "2026-10-11T09:20:00Z"),
      doc(
        "PKG-00_statement",
        "Cycle settlement statement",
        "statement",
        "pdf",
        "142 KB",
        "2026-10-11T09:20:00Z",
        "investor",
      ),
    ],
  },
  pkg_02c: {
    thesis:
      "First Premium Yield cycle: index carry with guarded compounding. Lower turnover, wider stops and a smaller stake per trade than the growth programme.",
    tokens: 40000,
    daily: [36, 30, 42, 24, 36, 30, 48, 36, 30, 42, 24, 36, 42, 30],
    performance: {
      totalPnl: 4860,
      wins: 79,
      losses: 47,
      trades: 126,
      openTrades: 0,
      maxDrawdownPct: 2.2,
      maxDrawdownAt: "2026-09-19T13:12:00Z",
      guardianTriggers: 1,
      recoveredInLabel: "55m",
      avgTradeDurationSec: 19,
      best: {
        id: "TRD-0664",
        symbol: "R_75",
        pnl: 284.6,
        share: 56.92,
        at: "2026-09-26T10:22:00Z",
      },
      worst: {
        id: "TRD-0601",
        symbol: "R_50",
        pnl: -190,
        share: -38,
        at: "2026-09-19T13:12:00Z",
      },
      curveValues: [
        0, 280, 640, 820, 1040, 1220, 1560, 1880, 2240, 2580, 2960, 3380, 3860,
        4360, 4860,
      ],
      benchmarks: [
        {
          label: "Against plan",
          value: "+1.2pp",
          hint: "12.15% realised vs 11.0% plan",
        },
        { label: "Guardian band", value: "5.0%", hint: "never breached" },
        { label: "Settlement", value: "Reconciled", hint: "paid 30 Sep 2026" },
      ],
    },
    trades: [
      {
        id: "TRD-0664",
        symbol: "R_75",
        contract: "Rise · 4 ticks",
        stake: 280,
        poolPnl: 284.6,
        investorShare: 56.92,
        result: "won",
        openedAt: "2026-09-26T10:22:00Z",
        closedAt: "2026-09-26T10:26:00Z",
        durationSec: 240,
      },
      {
        id: "TRD-0601",
        symbol: "R_50",
        contract: "Fall · 3 ticks",
        stake: 190,
        poolPnl: -190,
        investorShare: -38,
        result: "lost",
        openedAt: "2026-09-19T13:12:00Z",
        closedAt: "2026-09-19T13:15:00Z",
        durationSec: 180,
      },
    ],
    guardian: {
      rotation: true,
      triggersTotal: 1,
      recoveredLabel: "55m",
      events: [
        {
          id: "g02c_1",
          at: "2026-09-19T13:12:00Z",
          kind: "trigger",
          title: "Loss-streak watch on carry positions",
          detail: "Paused for 6 minutes, resumed with reduced stake",
          outcome: "recovered",
          durationMin: 55,
        },
        {
          id: "g02c_2",
          at: "2026-09-30T00:00:00Z",
          kind: "check",
          title: "Cycle closed inside policy",
          detail: "2.2% maximum drawdown against a 5% limit",
          outcome: "closed",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "rows",
      youSlots: 2,
      youInvestment: 4000,
      investors: 14,
      totalSlots: 20,
      slotPrice: 2000,
      note: "Closed cycle. Allocation shares are final and reconciled against the settlement record.",
    },
    documents: [
      ...baseDocs("PKG-02", "2026-09-30T17:00:00Z"),
      doc(
        "PKG-02_statement",
        "Cycle 1 settlement statement",
        "statement",
        "pdf",
        "138 KB",
        "2026-09-30T17:00:00Z",
        "investor",
      ),
    ],
  },
  pkg_06c: {
    thesis:
      "Conservative carry with deliberately low frequency: eight to twelve positions a day, flat exposure overnight and a hard 5% drawdown ceiling.",
    tokens: 80000,
    daily: [72, 84, 66, 90, 78, 60, 84, 72, 90, 66, 84, 78, 72, 66],
    performance: {
      totalPnl: 4248,
      wins: 112,
      losses: 56,
      trades: 168,
      openTrades: 0,
      maxDrawdownPct: 1.9,
      maxDrawdownAt: "2026-10-02T09:40:00Z",
      guardianTriggers: 0,
      recoveredInLabel: "—",
      avgTradeDurationSec: 26,
      best: {
        id: "TRD-1021",
        symbol: "R_10",
        pnl: 318.4,
        share: 63.68,
        at: "2026-10-14T12:08:00Z",
      },
      worst: {
        id: "TRD-0988",
        symbol: "R_50",
        pnl: -164,
        share: -32.8,
        at: "2026-10-02T09:40:00Z",
      },
      curveValues: [
        0, 224, 416, 648, 864, 1136, 1368, 1712, 2048, 2408, 2784, 3168, 3504,
        3912, 4248,
      ],
      benchmarks: [
        {
          label: "Against plan",
          value: "+1.3pp",
          hint: "13.28% realised vs 12.0% plan",
        },
        { label: "Guardian band", value: "5.0%", hint: "never triggered" },
        { label: "Settlement", value: "Reconciled", hint: "paid 22 Oct 2026" },
      ],
    },
    trades: [
      {
        id: "TRD-1021",
        symbol: "R_10",
        contract: "Rise · 5 ticks",
        stake: 320,
        poolPnl: 318.4,
        investorShare: 63.68,
        result: "won",
        openedAt: "2026-10-14T12:08:00Z",
        closedAt: "2026-10-14T12:13:00Z",
        durationSec: 300,
      },
      {
        id: "TRD-0988",
        symbol: "R_50",
        contract: "Fall · 4 ticks",
        stake: 164,
        poolPnl: -164,
        investorShare: -32.8,
        result: "lost",
        openedAt: "2026-10-02T09:40:00Z",
        closedAt: "2026-10-02T09:44:00Z",
        durationSec: 240,
      },
    ],
    guardian: {
      rotation: false,
      triggersTotal: 0,
      recoveredLabel: "—",
      events: [
        {
          id: "g06c_1",
          at: "2026-10-21T17:00:00Z",
          kind: "check",
          title: "Cycle closed with no triggers",
          detail: "1.9% maximum drawdown, no loss-streak pause",
          outcome: "closed",
          durationMin: null,
        },
        {
          id: "g06c_2",
          at: "2026-09-21T09:05:00Z",
          kind: "config",
          title: "Policy armed with rotation disabled",
          detail: "Single-market carry · 5% drawdown ceiling",
          outcome: "armed",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "rows",
      youSlots: 4,
      youInvestment: 8000,
      investors: 11,
      totalSlots: 16,
      slotPrice: 2000,
      note: "Closed cycle. Allocation shares are final and reconciled against the settlement record.",
    },
    documents: [
      ...baseDocs("PKG-06", "2026-10-22T08:05:00Z"),
      doc(
        "PKG-06_statement",
        "Cycle settlement statement",
        "statement",
        "pdf",
        "131 KB",
        "2026-10-22T08:05:00Z",
        "investor",
      ),
    ],
  },
  pkg_02: {
    thesis:
      "Index carry with guarded compounding across R_10 and R_75. The funding desk confirms slots in booking order once payment clears, then arms the Guardian on the first trading day.",
    tokens: 0,
    daily: [],
    performance: null,
    trades: [],
    guardian: {
      rotation: true,
      triggersTotal: 0,
      recoveredLabel: "—",
      events: [
        {
          id: "g02_1",
          at: "2026-10-19T00:18:00Z",
          kind: "config",
          title: "Funding window opened",
          detail: "Booking closes 25 Oct 2026 · trading starts the same day",
          outcome: "open",
          durationMin: null,
        },
        {
          id: "g02_2",
          at: "2026-10-22T09:10:00Z",
          kind: "check",
          title: "Capacity check · $28,000 of $80,000 committed",
          detail: "35% funded · payment verification continues",
          outcome: "monitored",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "bands",
      investors: 37,
      totalSlots: 6,
      committed: 28000,
      bands: [
        {
          label: "2+ slots confirmed",
          count: 2,
          investment: 20000,
          sharePct: 71.4,
        },
        {
          label: "1 slot confirmed",
          count: 1,
          investment: 5000,
          sharePct: 17.9,
        },
        {
          label: "Awaiting verification",
          count: 34,
          investment: 3000,
          sharePct: 10.7,
        },
      ],
      note: "Investor-level detail publishes once the pool enters trading and payments are verified. Figures below are the funding desk's booking ledger.",
    },
    documents: baseDocs("PKG-02", "2026-10-23T08:00:00Z"),
  },
  pkg_09: {
    thesis:
      "Low-frequency carry on gold and silver synthetics with a hard 10-day window. Silent rotation is disabled so the desk can hold positions through the settlement batch.",
    tokens: 0,
    daily: [],
    performance: null,
    trades: [],
    guardian: {
      rotation: false,
      triggersTotal: 0,
      recoveredLabel: "—",
      events: [
        {
          id: "g09_1",
          at: "2026-10-21T09:00:00Z",
          kind: "config",
          title: "Funding window opened",
          detail: "Booking closes 27 Oct 2026 · 10-day trading window",
          outcome: "open",
          durationMin: null,
        },
        {
          id: "g09_2",
          at: "2026-10-23T07:30:00Z",
          kind: "check",
          title: "Payment verification pending on your booking",
          detail: "$2,500 awaiting confirmation from the funding desk",
          outcome: "pending",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "bands",
      investors: 22,
      totalSlots: 13,
      committed: 31500,
      bands: [
        {
          label: "2+ slots confirmed",
          count: 1,
          investment: 5000,
          sharePct: 15.9,
        },
        {
          label: "1 slot confirmed",
          count: 10,
          investment: 25000,
          sharePct: 79.4,
        },
        {
          label: "Awaiting verification",
          count: 11,
          investment: 1500,
          sharePct: 4.8,
        },
      ],
      note: "Investor-level detail publishes once the pool enters trading and payments are verified.",
    },
    documents: baseDocs("PKG-09", "2026-10-23T08:00:00Z"),
  },
  pkg_04: {
    thesis:
      "A short momentum cycle: 24-hour funding window, seven trading days and a flat close. Slots are confirmed in booking order after payment verification.",
    tokens: 0,
    daily: [],
    performance: null,
    trades: [],
    guardian: {
      rotation: true,
      triggersTotal: 0,
      recoveredLabel: "—",
      events: [
        {
          id: "g04_1",
          at: "2026-10-20T12:00:00Z",
          kind: "config",
          title: "Pool published on the roadmap",
          detail: "Booking opens 25 Oct 2026 · 24-hour window",
          outcome: "planned",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "bands",
      investors: 4,
      totalSlots: 6,
      committed: 12000,
      bands: [
        {
          label: "2 slots expressed",
          count: 2,
          investment: 8000,
          sharePct: 66.7,
        },
        {
          label: "1 slot expressed",
          count: 2,
          investment: 4000,
          sharePct: 33.3,
        },
      ],
      note: "Expressions of interest are non-binding and reserve no capital until the window opens.",
    },
    documents: baseDocs("PKG-04", "2026-10-23T07:00:00Z"),
  },
  pkg_05: {
    thesis:
      "Successor to PKG-01 with the same entry rules and a wider Guardian drawdown check. Fourteen trading days, one slot per investor at entry.",
    tokens: 0,
    daily: [],
    performance: null,
    trades: [],
    guardian: {
      rotation: true,
      triggersTotal: 0,
      recoveredLabel: "—",
      events: [
        {
          id: "g05_1",
          at: "2026-10-21T09:00:00Z",
          kind: "config",
          title: "Pool published on the roadmap",
          detail: "Booking opens 28 Oct 2026 · 14-day trading window",
          outcome: "planned",
          durationMin: null,
        },
      ],
    },
    participants: {
      mode: "bands",
      investors: 3,
      totalSlots: 3,
      committed: 9000,
      bands: [
        {
          label: "1 slot expressed",
          count: 3,
          investment: 9000,
          sharePct: 100,
        },
      ],
      note: "Expressions of interest are non-binding and reserve no capital until the window opens.",
    },
    documents: baseDocs("PKG-05", "2026-10-23T07:00:00Z"),
  },
};

/* ── Assembly ── */

const DAY = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * DAY).toISOString();
const atNoon = (iso: string) => {
  const date = new Date(iso);
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
};
const profitShareFor = (tradingEndsAt: string) =>
  atNoon(new Date(Date.parse(tradingEndsAt) + DAY).toISOString());

const standbyGuardian = (note: string): PoolGuardianDetail => ({
  status: "standby",
  consecutiveLosses: 0,
  maxConsecutiveLosses: 8,
  drawdownPct: 0,
  drawdownLimitPct: 5,
  lastCheckedAt: POOL_DETAIL_AS_OF,
  note,
  rotation: true,
  triggersTotal: 0,
  recoveredLabel: "—",
  events: [],
});

function scheduleFor(overview: {
  bookingOpensAt: string;
  bookingClosesAt: string;
  tradingStartsAt: string;
  tradingEndsAt: string;
  profitShareAt: string | null;
}): ScheduleStep[] {
  const steps: { id: string; label: string; at: string; note: string }[] = [
    {
      id: "booking-open",
      label: "Booking opens",
      at: overview.bookingOpensAt,
      note: "Slot reservations open to invited investors.",
    },
    {
      id: "booking-close",
      label: "Booking closes",
      at: overview.bookingClosesAt,
      note: "Unverified reservations are released when the window closes.",
    },
    {
      id: "trading-start",
      label: "Trading starts",
      at: overview.tradingStartsAt,
      note: "Guardian policy arms on the first trading tick.",
    },
    {
      id: "trading-end",
      label: "Trading ends",
      at: overview.tradingEndsAt,
      note: "Open positions close out with the settlement batch.",
    },
  ];
  if (overview.profitShareAt)
    steps.push({
      id: "profit-share",
      label: "Profit share date",
      at: overview.profitShareAt,
      note: "Net earnings are attributed after the platform share.",
    });
  let currentAssigned = false;
  return steps.map((step) => {
    const done = Date.parse(step.at) <= Date.parse(POOL_DETAIL_AS_OF);
    const state: ScheduleStep["state"] = done
      ? "done"
      : currentAssigned
        ? "next"
        : "current";
    if (!done && !currentAssigned) currentAssigned = true;
    return { ...step, state };
  });
}

export function getPoolDetailWorkspace(
  idOrCode: string,
): PoolDetailWorkspace | null {
  const book = getPoolsWorkspace();
  const key = idOrCode.trim();
  const lower = key.toLowerCase();
  const match = <T extends { id: string; code: string }>(rows: T[]) =>
    rows.find((row) => row.id === key || row.code.toLowerCase() === lower) ??
    null;

  const trading = match(book.trading);
  const open = match(book.open);
  const upcoming = match(book.upcoming);
  const completed = match(book.completed);

  const base = trading ?? open ?? upcoming ?? completed;
  if (!base) return null;
  const seed = seeds[base.id];
  if (!seed) return null;

  const lifecycle: DetailLifecycle = trading
    ? "trading"
    : open
      ? "open"
      : upcoming
        ? "upcoming"
        : "completed";

  const guardianSeed = seed.guardian;

  let overview: PoolDetailWorkspace["overview"];
  let investment: PoolDetailWorkspace["investment"] = null;
  let booking: PoolDetailWorkspace["booking"] = null;
  let interest: PoolDetailWorkspace["interest"] = null;
  let projection: PoolDetailWorkspace["projection"] = null;
  let guardian: PoolGuardianDetail;
  let performance: PoolDetailWorkspace["performance"] = null;

  if (trading) {
    const bookingOpensAt = addDays(trading.startedAt, -7);
    const bookingClosesAt = addDays(trading.startedAt, -1);
    const profitShareAt = profitShareFor(trading.endsAt);
    overview = {
      id: trading.id,
      code: trading.code,
      name: trading.name,
      lifecycle,
      strategy: trading.strategy,
      thesis: seed.thesis,
      markets: trading.markets,
      riskBand: trading.riskBand,
      manager: "tradeMO funding desk",
      launchedAt: trading.startedAt,
      bookingOpensAt,
      bookingClosesAt,
      tradingStartsAt: trading.startedAt,
      tradingEndsAt: trading.endsAt,
      profitShareAt,
      goal: trading.goal,
      raised: trading.raised,
      slotPrice: trading.slotPrice,
      slotsTotal: trading.slotsTotal,
      slotsFilled: trading.slotsFilled,
      investors: seed.participants.investors,
      profitSharePct: trading.profitSharePct,
      settlementBatch: trading.settlementBatch,
      currency: "USD",
      guardian: {
        status: trading.guardian.status,
        consecutiveLosses: trading.guardian.consecutiveLosses,
        maxConsecutiveLosses: trading.guardian.maxConsecutiveLosses,
        drawdownPct: trading.guardian.drawdownPct,
        drawdownLimitPct: trading.guardian.drawdownLimitPct,
        lastCheckedAt: trading.guardian.lastCheckedAt,
        note: trading.guardian.note,
      },
    };
    const gross = trading.sharePnl;
    const cutPct = 20;
    const cut = round2((gross * cutPct) / 100);
    const net = round2(gross - cut);
    investment = {
      slots: trading.userSlots,
      investment: trading.investment,
      sharePct: Number(
        ((trading.investment / Math.max(trading.raised, 1)) * 100).toFixed(1),
      ),
      tokens: seed.tokens,
      tokenSymbol: "bmX",
      pnl: trading.sharePnl,
      grossEarnings: gross,
      platformCutPct: cutPct,
      platformCut: cut,
      netEarnings: net,
      roiPct: round2((net / Math.max(trading.investment, 1)) * 100),
      paidOut: 0,
      pendingPayout: 0,
      lastUpdatedAt: trading.guardian.lastCheckedAt,
      refreshSeconds: 180,
      daily: buildDaily(seed.daily, cutPct),
    };
    guardian = {
      ...overview.guardian,
      rotation: guardianSeed.rotation,
      triggersTotal: guardianSeed.triggersTotal,
      recoveredLabel: guardianSeed.recoveredLabel,
      events: guardianSeed.events,
    };
  } else if (open) {
    const tradingStartsAt = open.closesAt;
    const profitShareAt = profitShareFor(open.tradingEndsAt);
    const participantsSeed = seed.participants;
    overview = {
      id: open.id,
      code: open.code,
      name: open.name,
      lifecycle,
      strategy: open.strategy,
      thesis: seed.thesis,
      markets: ["R_10", "R_50", "R_75"],
      riskBand: open.riskBand,
      manager: "tradeMO funding desk",
      launchedAt: open.opensAt,
      bookingOpensAt: open.opensAt,
      bookingClosesAt: open.closesAt,
      tradingStartsAt,
      tradingEndsAt: open.tradingEndsAt,
      profitShareAt,
      goal: open.goal,
      raised: open.raised,
      slotPrice: open.minSlot,
      slotsTotal: Math.floor(open.goal / Math.max(open.minSlot, 1)),
      slotsFilled: participantsSeed.totalSlots,
      investors: participantsSeed.investors,
      profitSharePct: 20,
      settlementBatch: "Daily 17:00 UTC",
      currency: "USD",
      guardian: {
        status: "standby",
        consecutiveLosses: 0,
        maxConsecutiveLosses: 8,
        drawdownPct: 0,
        drawdownLimitPct: 5,
        lastCheckedAt: POOL_DETAIL_AS_OF,
        note: "Guardian arms on the first trading tick; policy bands are fixed at pool creation.",
      },
    };
    const byUser = Math.max(0, open.maxSlotsPerUser - open.bookedSlots);
    const byCapacity = Math.floor(
      Math.max(0, open.goal - open.raised) / Math.max(open.minSlot, 1),
    );
    booking = {
      slots: open.bookedSlots,
      amount: open.investment,
      payment: open.payment,
      reference: open.paymentRef,
      bookedAt: open.opensAt,
      available: Math.max(0, Math.min(byUser, byCapacity)),
      note:
        open.payment === "verified"
          ? "Payment verified. The slot is confirmed and counted in committed capital."
          : "Payment verification is pending. Unverified reservations may be released when the window closes.",
    };
    projection = {
      basis: "expected",
      roiPct: open.expectedRoiPct,
      onAmount: open.investment,
      projectedProfit: round2((open.investment * open.expectedRoiPct) / 100),
      days: open.durationDays,
      note: "Expected return published by the funding desk. Not a forecast and not guaranteed.",
    };
    guardian = {
      ...overview.guardian,
      rotation: guardianSeed.rotation,
      triggersTotal: guardianSeed.triggersTotal,
      recoveredLabel: guardianSeed.recoveredLabel,
      events: guardianSeed.events,
    };
  } else if (upcoming) {
    const tradingStartsAt = upcoming.closesAt;
    const tradingEndsAt = addDays(upcoming.closesAt, upcoming.durationDays);
    const profitShareAt = profitShareFor(tradingEndsAt);
    const participantsSeed = seed.participants;
    overview = {
      id: upcoming.id,
      code: upcoming.code,
      name: upcoming.name,
      lifecycle,
      strategy: upcoming.strategy,
      thesis: seed.thesis,
      markets: ["R_10", "R_50", "R_75"],
      riskBand: upcoming.riskBand,
      manager: "tradeMO funding desk",
      launchedAt: addDays(upcoming.opensAt, -6),
      bookingOpensAt: upcoming.opensAt,
      bookingClosesAt: upcoming.closesAt,
      tradingStartsAt,
      tradingEndsAt,
      profitShareAt,
      goal: upcoming.goal,
      raised: upcoming.expressed,
      slotPrice: upcoming.minSlot,
      slotsTotal: Math.floor(upcoming.goal / Math.max(upcoming.minSlot, 1)),
      slotsFilled: participantsSeed.totalSlots,
      investors: participantsSeed.investors,
      profitSharePct: 20,
      settlementBatch: "Daily 17:00 UTC",
      currency: "USD",
      guardian: {
        status: "standby",
        consecutiveLosses: 0,
        maxConsecutiveLosses: 8,
        drawdownPct: 0,
        drawdownLimitPct: 5,
        lastCheckedAt: POOL_DETAIL_AS_OF,
        note: "Guardian policy is published with the pool and arms when trading starts.",
      },
    };
    projection = {
      basis: "expected",
      roiPct: upcoming.expectedRoiPct,
      onAmount: upcoming.minSlot,
      projectedProfit: round2(
        (upcoming.minSlot * upcoming.expectedRoiPct) / 100,
      ),
      days: upcoming.durationDays,
      note: "Projection uses one minimum slot at the published expected return. Not a forecast.",
    };
    guardian = {
      ...overview.guardian,
      rotation: guardianSeed.rotation,
      triggersTotal: guardianSeed.triggersTotal,
      recoveredLabel: guardianSeed.recoveredLabel,
      events: guardianSeed.events,
    };
  } else if (completed) {
    const participantsSeed = seed.participants;
    const slotPrice =
      participantsSeed.mode === "rows" ? participantsSeed.slotPrice : 0;
    const raised =
      slotPrice > 0
        ? slotPrice *
          (participantsSeed.mode === "rows" ? participantsSeed.totalSlots : 0)
        : completed.investment;
    const poolPnl = seed.performance?.totalPnl ?? 0;
    overview = {
      id: completed.id,
      code: completed.code,
      name: completed.name,
      lifecycle,
      strategy: completed.strategy,
      thesis: seed.thesis,
      markets: ["R_10", "R_50", "R_100"],
      riskBand: completed.riskBand,
      manager: "tradeMO funding desk",
      launchedAt: completed.startedAt,
      bookingOpensAt: addDays(completed.startedAt, -12),
      bookingClosesAt: addDays(completed.startedAt, -5),
      tradingStartsAt: completed.startedAt,
      tradingEndsAt: completed.completedAt,
      profitShareAt: completed.paidAt ?? completed.completedAt,
      goal: raised,
      raised,
      slotPrice: slotPrice || completed.investment,
      slotsTotal:
        participantsSeed.mode === "rows" ? participantsSeed.totalSlots : 0,
      slotsFilled:
        participantsSeed.mode === "rows" ? participantsSeed.totalSlots : 0,
      investors: participantsSeed.investors,
      profitSharePct: poolPnl
        ? Number(((completed.grossEarnings / poolPnl) * 100).toFixed(1))
        : 100,
      settlementBatch: "Daily 17:00 UTC",
      currency: "USD",
      guardian: {
        status: "standby",
        consecutiveLosses: 0,
        maxConsecutiveLosses: 8,
        drawdownPct: seed.performance?.maxDrawdownPct ?? 0,
        drawdownLimitPct: 5,
        lastCheckedAt: completed.completedAt,
        note: "Cycle settled. Guardian policy is archived with the settlement record.",
      },
    };
    investment = {
      slots: completed.userSlots,
      investment: completed.investment,
      sharePct: Number(
        ((completed.investment / Math.max(raised, 1)) * 100).toFixed(1),
      ),
      tokens: seed.tokens,
      tokenSymbol: "bmX",
      pnl: round2(poolPnl * (completed.investment / Math.max(raised, 1))),
      grossEarnings: completed.grossEarnings,
      platformCutPct: completed.platformCutPct,
      platformCut: round2(completed.grossEarnings - completed.netEarnings),
      netEarnings: completed.netEarnings,
      roiPct: completed.finalRoiPct,
      paidOut: completed.payout === "completed" ? completed.netEarnings : 0,
      pendingPayout: 0,
      lastUpdatedAt: completed.paidAt ?? completed.completedAt,
      refreshSeconds: 180,
      daily: buildDaily(seed.daily, completed.platformCutPct),
    };
    guardian = {
      ...overview.guardian,
      rotation: guardianSeed.rotation,
      triggersTotal: guardianSeed.triggersTotal,
      recoveredLabel: guardianSeed.recoveredLabel,
      events: guardianSeed.events,
    };
  } else {
    return null;
  }

  const winRatePct = seed.performance
    ? Number(
        ((seed.performance.wins / seed.performance.trades) * 100).toFixed(1),
      )
    : 0;
  if (seed.performance) {
    const endIso =
      lifecycle === "completed"
        ? (completed?.completedAt ?? POOL_DETAIL_AS_OF)
        : POOL_DETAIL_AS_OF;
    performance = {
      ...seed.performance,
      winRatePct,
      curve: buildCurve(seed.performance.curveValues, endIso),
      best: seed.performance.best,
      worst: seed.performance.worst,
    };
  }

  const participantsSeed = seed.participants;
  let participants: PoolDetailWorkspace["participants"];
  if (participantsSeed.mode === "rows") {
    const { rows, tail } = buildParticipants(participantsSeed);
    const all = [...rows, ...tail];
    const committed = round2(all.reduce((sum, row) => sum + row.investment, 0));
    participants = {
      totalParticipants: participantsSeed.investors,
      slotsFilled: participantsSeed.totalSlots,
      slotsTotal: overview.slotsTotal,
      avgInvestment: round2(
        committed / Math.max(participantsSeed.investors, 1),
      ),
      committed,
      showRows: true,
      rows,
      tail: tail.length
        ? {
            count: tail.length,
            slots: tail.reduce((sum, row) => sum + row.slots, 0),
            investment: round2(
              tail.reduce((sum, row) => sum + row.investment, 0),
            ),
          }
        : null,
      bands: bandsFromRows(all),
      note: participantsSeed.note,
    };
  } else {
    participants = {
      totalParticipants: participantsSeed.investors,
      slotsFilled: participantsSeed.totalSlots,
      slotsTotal: overview.slotsTotal,
      avgInvestment: round2(
        participantsSeed.committed / Math.max(participantsSeed.investors, 1),
      ),
      committed: participantsSeed.committed,
      showRows: false,
      rows: [],
      tail: null,
      bands: participantsSeed.bands,
      note: participantsSeed.note,
    };
  }

  const events: DetailEvent[] = [
    ...seed.guardian.events.map((event) => ({
      id: `evt_${event.id}`,
      at: event.at,
      kind: "guardian" as const,
      title: event.title,
      detail: event.detail,
    })),
    {
      id: "evt_window",
      at: overview.bookingOpensAt,
      kind: "pool" as const,
      title: "Funding window opened",
      detail: `${overview.code} opened bookings at $${overview.slotPrice.toLocaleString()} per slot.`,
    },
  ];
  if (completed?.paidAt)
    events.push({
      id: "evt_payout",
      at: completed.paidAt,
      kind: "payout",
      title: "Payout settled",
      detail: `$${completed.netEarnings.toLocaleString()} paid · ${completed.payoutRef ?? "no reference"}.`,
    });
  if (open?.paymentRef)
    events.push({
      id: "evt_booking",
      at: open.opensAt,
      kind: "booking",
      title: `Booking ${open.payment === "verified" ? "confirmed" : "awaiting verification"}`,
      detail: `${open.bookedSlots} slot(s) · $${open.investment.toLocaleString()} · ${open.paymentRef}`,
    });
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const related: RelatedPool[] = [
    ...book.trading,
    ...book.open,
    ...book.upcoming,
    ...book.completed,
  ]
    .filter((pool) => pool.id !== overview.id)
    .map((pool) => ({
      id: pool.id,
      code: pool.code,
      name: pool.name,
      lifecycle: pool.lifecycle,
      goal:
        pool.lifecycle === "trading" || pool.lifecycle === "open"
          ? pool.goal
          : pool.lifecycle === "upcoming"
            ? pool.goal
            : pool.investment,
      expectedRoiPct:
        pool.lifecycle === "trading"
          ? pool.roiPct
          : pool.lifecycle === "open"
            ? pool.expectedRoiPct
            : pool.lifecycle === "upcoming"
              ? pool.expectedRoiPct
              : pool.finalRoiPct,
      relation:
        pool.riskBand === overview.riskBand
          ? "Same risk band"
          : pool.lifecycle === "trading"
            ? "Trading now"
            : pool.lifecycle === "open"
              ? "Open window"
              : pool.lifecycle === "upcoming"
                ? "Opens soon"
                : "Completed cycle",
    }))
    .sort((a, b) => {
      const rank = (pool: RelatedPool) =>
        pool.relation === "Same risk band" ? 0 : 1;
      return rank(a) - rank(b);
    })
    .slice(0, 3);

  const documents = [...seed.documents];
  if (investment)
    documents.push(
      doc(
        `${overview.code}_investor_statement`,
        `${overview.code} investor statement`,
        "statement",
        "pdf",
        "118 KB",
        investment.lastUpdatedAt,
        "investor",
      ),
      doc(
        `${overview.code}_daily_ledger`,
        "Daily earnings ledger",
        "ledger",
        "csv",
        "24 KB",
        investment.lastUpdatedAt,
        "investor",
      ),
    );

  return structuredClone({
    mode: "demo",
    asOf: POOL_DETAIL_AS_OF,
    revision: 0,
    poolId: overview.id,
    profile: {
      id: book.profile.id,
      displayName: book.profile.displayName,
      investorSince: book.profile.investorSince,
      tier: book.profile.tier,
      country: book.profile.country,
      currency: book.profile.currency,
      wallet: book.summary.wallet,
      unread: book.summary.unread,
      monthRoiPct: book.summary.monthRoiPct,
      committed: book.summary.committed,
    },
    overview,
    investment,
    booking,
    interest,
    projection,
    performance,
    guardian,
    participants,
    trades: seed.trades,
    events,
    documents,
    schedule: scheduleFor(overview),
    related,
    watching: false,
    preferences: {
      email: book.preferences.alertChannels.email,
      in_app: book.preferences.alertChannels.in_app,
      endingSoonHours: 72,
      autoRefresh: book.preferences.autoRefresh,
    },
    reminders: [],
    payouts: [],
    projections: [],
    support: [],
    audit: [],
  });
}

/** Every pool the detail route can render, for permalink validation and tests. */
export function listPoolDetailIds(): string[] {
  const book = getPoolsWorkspace();
  return [
    ...book.trading,
    ...book.open,
    ...book.upcoming,
    ...book.completed,
  ].map((pool) => pool.id);
}
