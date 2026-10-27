import {
  LIVE_AS_OF,
  deriveTotals,
  recomputeStats,
  round2,
  shareOf,
  type GuardianAlert,
  type LiveBot,
  type LivePool,
  type LivePoolStatus,
  type LiveTrade,
  type LiveTradeWorkspace,
  type SymbolTick,
} from "@/lib/investor/live-trades";

import { getPoolsWorkspace } from "./investor-pools-service";

/**
 * I-5 fixture source.
 *
 * Pool capital, investor share and cumulative P&L come from the shared pool
 * book (I-2 / I-3 / I-4), so the live tracker can never report a figure the
 * rest of the workspace disagrees with. Today's 47-trade session is authored
 * here as an explicit recipe and every other number on the page is derived
 * from it: 29 wins / 18 losses, +$133 net, +$39.90 in your share (30% on
 * PKG-01, 0% weighted on the flat PKG-03 book), best +$8.40, worst −$10.50,
 * a five-win streak and an 18-second average hold.
 */

const SNAPSHOT = LIVE_AS_OF;

/* ── Pools ── */

function livePools(): LivePool[] {
  const book = getPoolsWorkspace();
  return book.trading.map((pool) => ({
    poolId: pool.id,
    code: pool.code,
    name: pool.name,
    status: "trading" as LivePoolStatus,
    riskBand: pool.riskBand,
    strategy: pool.strategy,
    yourInvestment: pool.investment,
    yourSlots: pool.userSlots,
    yourSharePct: pool.id === "pkg_01" ? 30 : 10,
    poolPnl: pool.pnl,
    yourSharePnl: pool.sharePnl,
    poolTrades: pool.trades,
    poolWinRatePct: pool.winRatePct,
    poolCapital: pool.raised,
    endsAt: pool.endsAt,
    guardianLevel: pool.guardian.drawdownPct > 2 ? "watch" : "ok",
    guardianNote: pool.guardian.note,
    pausedUntil: null,
  }));
}

/* ── Today's trade recipe ── */

type RecipeRow = {
  pool: "P1" | "P3";
  win: boolean;
  stake: 35 | 70;
  bot: "alpha" | "bravo" | "charlie" | "delta";
};

/**
 * Newest first. The mix reconciles exactly:
 *   PKG-01 · 25 trades, 16 wins / 9 losses, 16×$28 − 9×$35 = +$133
 *   PKG-03 · 22 trades, 13 wins / 9 losses = $0 (11×$28 + 2×$56 − 6×$35 − 3×$70)
 *   session · 47 trades, 29 wins / 18 losses, +$133 · your share +$39.90
 * Bots are attributed per row, so the bot cards and the KPI row agree with the
 * feed without any hard-coded totals.
 */
const RECIPE: RecipeRow[] = [
  { pool: "P1", win: true, stake: 35, bot: "alpha" },
  { pool: "P3", win: false, stake: 35, bot: "charlie" },
  { pool: "P1", win: true, stake: 35, bot: "alpha" },
  { pool: "P3", win: true, stake: 35, bot: "bravo" },
  { pool: "P1", win: false, stake: 35, bot: "alpha" },
  { pool: "P3", win: false, stake: 35, bot: "charlie" },
  { pool: "P1", win: true, stake: 35, bot: "alpha" },
  { pool: "P3", win: true, stake: 70, bot: "bravo" },
  { pool: "P1", win: true, stake: 35, bot: "alpha" },
  { pool: "P3", win: false, stake: 35, bot: "charlie" },
  { pool: "P1", win: false, stake: 35, bot: "alpha" },
  { pool: "P3", win: false, stake: 35, bot: "charlie" },
  { pool: "P1", win: true, stake: 35, bot: "alpha" },
  { pool: "P1", win: true, stake: 35, bot: "alpha" },
  { pool: "P3", win: true, stake: 35, bot: "bravo" },
  { pool: "P1", win: true, stake: 35, bot: "alpha" },
  { pool: "P3", win: true, stake: 70, bot: "bravo" },
  { pool: "P1", win: false, stake: 35, bot: "alpha" },
  { pool: "P3", win: false, stake: 70, bot: "bravo" },
  { pool: "P1", win: true, stake: 35, bot: "alpha" },
  { pool: "P3", win: true, stake: 35, bot: "charlie" },
  { pool: "P1", win: false, stake: 35, bot: "alpha" },
  { pool: "P1", win: true, stake: 35, bot: "delta" },
  { pool: "P3", win: true, stake: 35, bot: "charlie" },
  { pool: "P1", win: true, stake: 35, bot: "delta" },
  { pool: "P3", win: true, stake: 35, bot: "charlie" },
  { pool: "P1", win: false, stake: 35, bot: "delta" },
  { pool: "P3", win: false, stake: 35, bot: "bravo" },
  { pool: "P1", win: true, stake: 35, bot: "delta" },
  { pool: "P3", win: true, stake: 35, bot: "charlie" },
  { pool: "P1", win: true, stake: 35, bot: "delta" },
  { pool: "P3", win: false, stake: 70, bot: "bravo" },
  { pool: "P1", win: false, stake: 35, bot: "delta" },
  { pool: "P3", win: true, stake: 35, bot: "charlie" },
  { pool: "P1", win: true, stake: 35, bot: "delta" },
  { pool: "P3", win: false, stake: 70, bot: "bravo" },
  { pool: "P1", win: true, stake: 35, bot: "delta" },
  { pool: "P3", win: true, stake: 35, bot: "bravo" },
  { pool: "P1", win: false, stake: 35, bot: "delta" },
  { pool: "P3", win: false, stake: 35, bot: "bravo" },
  { pool: "P1", win: true, stake: 35, bot: "delta" },
  { pool: "P3", win: true, stake: 35, bot: "bravo" },
  { pool: "P1", win: false, stake: 35, bot: "delta" },
  { pool: "P3", win: true, stake: 35, bot: "bravo" },
  { pool: "P1", win: true, stake: 35, bot: "delta" },
  { pool: "P3", win: true, stake: 35, bot: "bravo" },
  { pool: "P1", win: false, stake: 35, bot: "delta" },
];

const BOT_OF: Record<RecipeRow["bot"], { id: string; name: string }> = {
  alpha: { id: "bot_alpha", name: "Bot-Alpha" },
  bravo: { id: "bot_bravo", name: "Bot-Bravo" },
  charlie: { id: "bot_charlie", name: "Bot-Charlie" },
  delta: { id: "bot_delta", name: "Bot-Delta" },
};

const CONTRACTS = [
  { type: "CALL", label: "Rise · 5 ticks" },
  { type: "PUT", label: "Fall · 3 ticks" },
  { type: "EVEN", label: "Even · 1 tick" },
  { type: "ODD", label: "Odd · 1 tick" },
] as const;

const SPOT: Record<string, number> = {
  R_10: 4532.11,
  R_50: 189.42,
  R_100: 5621.83,
  R_75: 2451.18,
  "1HZ10V": 9032.44,
};

function buildFeed(pools: LivePool[]): LiveTrade[] {
  const end = Date.parse(SNAPSHOT);
  const seen: Record<string, number> = {};
  return RECIPE.map((row, index) => {
    const pool = pools.find(
      (entry) => entry.poolId === (row.pool === "P1" ? "pkg_01" : "pkg_03"),
    )!;
    const slot = seen[pool.code] ?? 0;
    seen[pool.code] = slot + 1;
    const symbol =
      row.pool === "P1"
        ? ["R_10", "R_100", "R_50"][slot % 3]
        : ["R_75", "1HZ10V"][slot % 2];
    const contract = CONTRACTS[(index * 3) % CONTRACTS.length];
    const durationSeconds = 12 + (index % 13);
    const soldAt = new Date(end - index * 15_500).toISOString();
    const profit = row.win ? round2(row.stake * 0.8) : -row.stake;
    const share = shareOf(profit, pool.yourSharePct);
    const base = SPOT[symbol] ?? 1000;
    const rising = contract.type === "CALL" || contract.type === "ODD";
    const moved =
      contract.type === "EVEN" || contract.type === "ODD"
        ? 0
        : ((index % 17) - 8) / 4000;
    return {
      tradeId: `trd_${(0x8f2a1c00 + index * 37).toString(16)}`,
      poolId: pool.poolId,
      poolCode: pool.code,
      poolName: pool.name,
      symbol,
      contractType: contract.type,
      contractLabel: contract.label,
      stake: row.stake,
      payout: row.win ? round2(row.stake * 1.8) : 0,
      profit,
      isWin: row.win,
      entrySpot: Number(base.toFixed(2)),
      exitSpot: Number(
        (base * (1 + (row.win === rising ? moved : -moved))).toFixed(2),
      ),
      boughtAt: new Date(
        Date.parse(soldAt) - durationSeconds * 1000,
      ).toISOString(),
      soldAt,
      durationSeconds,
      botId: BOT_OF[row.bot].id,
      botName: BOT_OF[row.bot].name,
      yourSharePct: pool.yourSharePct,
      yourShareGross: share.gross,
      platformCut: share.cut,
      yourShareNet: share.net,
    } satisfies LiveTrade;
  });
}

/* ── Tickers ── */

const tickers = (): SymbolTick[] => [
  {
    symbol: "R_10",
    price: 4532.11,
    previous: 4530.27,
    changePct: 0.04,
    direction: "up",
    decimals: 2,
    tickSeconds: 1,
    pools: ["PKG-01"],
    sessionHigh: 4541.02,
    sessionLow: 4518.44,
    lastTickAt: SNAPSHOT,
    ticksObserved: 30_142,
  },
  {
    symbol: "R_50",
    price: 189.42,
    previous: 189.36,
    changePct: 0.03,
    direction: "up",
    decimals: 2,
    tickSeconds: 1,
    pools: ["PKG-01"],
    sessionHigh: 190.18,
    sessionLow: 188.02,
    lastTickAt: SNAPSHOT,
    ticksObserved: 30_142,
  },
  {
    symbol: "R_100",
    price: 5621.83,
    previous: 5616.66,
    changePct: 0.11,
    direction: "up",
    decimals: 2,
    tickSeconds: 1,
    pools: ["PKG-01"],
    sessionHigh: 5640.5,
    sessionLow: 5598.11,
    lastTickAt: SNAPSHOT,
    ticksObserved: 30_142,
  },
  {
    symbol: "R_75",
    price: 2451.18,
    previous: 2451.92,
    changePct: -0.03,
    direction: "down",
    decimals: 2,
    tickSeconds: 1,
    pools: ["PKG-03"],
    sessionHigh: 2463.7,
    sessionLow: 2438.19,
    lastTickAt: SNAPSHOT,
    ticksObserved: 21_880,
  },
  {
    symbol: "1HZ10V",
    price: 9032.44,
    previous: 9034.1,
    changePct: -0.02,
    direction: "down",
    decimals: 2,
    tickSeconds: 1,
    pools: ["PKG-03"],
    sessionHigh: 9061.33,
    sessionLow: 9007.62,
    lastTickAt: SNAPSHOT,
    ticksObserved: 21_880,
  },
];

/* ── Bots ── */

const BOT_SEED: Omit<
  LiveBot,
  | "trades"
  | "wins"
  | "winRatePct"
  | "pnl"
  | "lossStreak"
  | "lastActionAt"
  | "stake"
>[] = [
  {
    id: "bot_alpha",
    name: "Bot-Alpha",
    poolId: "pkg_01",
    poolCode: "PKG-01",
    symbol: "R_10",
    status: "running",
    cooldownSeconds: 0,
    guardianLevel: "ok",
    note: "Sizing at $35 on R_10; Guardian band untouched for six hours.",
  },
  {
    id: "bot_delta",
    name: "Bot-Delta",
    poolId: "pkg_01",
    poolCode: "PKG-01",
    symbol: "R_50",
    status: "running",
    cooldownSeconds: 0,
    guardianLevel: "ok",
    note: "Rotates R_100 / R_50 with a 70-second hold; no Guardian action today.",
  },
  {
    id: "bot_bravo",
    name: "Bot-Bravo",
    poolId: "pkg_03",
    poolCode: "PKG-03",
    symbol: "R_75",
    status: "running",
    cooldownSeconds: 0,
    guardianLevel: "watch",
    note: "Volatility on R_75 is elevated; stake held at $35 until the band narrows.",
  },
  {
    id: "bot_charlie",
    name: "Bot-Charlie",
    poolId: "pkg_03",
    poolCode: "PKG-03",
    symbol: "1HZ10V",
    status: "cooldown",
    cooldownSeconds: 240,
    guardianLevel: "watch",
    note: "Four losses in a row on 1HZ10V; Guardian holds execution for 4 more minutes.",
  },
];

/**
 * Bot cards are computed from the feed so trades, wins, P&L and last action
 * always add up to the pool totals on the same screen.
 */
function deriveBots(feed: LiveTrade[]): LiveBot[] {
  return BOT_SEED.map((seed) => {
    const rows = feed.filter((trade) => trade.botId === seed.id);
    const wins = rows.filter((trade) => trade.isWin).length;
    let lossStreak = 0;
    for (const row of rows) {
      if (row.isWin) break;
      lossStreak += 1;
    }
    return {
      ...seed,
      trades: rows.length,
      wins,
      winRatePct: rows.length
        ? Number(((wins / rows.length) * 100).toFixed(1))
        : 0,
      pnl: round2(rows.reduce((sum, row) => sum + row.profit, 0)),
      lossStreak,
      lastActionAt: rows[0]?.soldAt ?? SNAPSHOT,
      stake: rows[0]?.stake ?? 35,
    };
  });
}

/* ── Guardian alerts ── */

const alerts = (): GuardianAlert[] => [
  {
    id: "alr_1",
    at: "2026-10-18T14:19:52Z",
    poolId: "pkg_03",
    poolCode: "PKG-03",
    botId: "bot_charlie",
    level: "watch",
    title: "Bot-Charlie in cooldown after four losses",
    detail:
      "Four consecutive losses on 1HZ10V took the bot outside its 60% rolling win band. Guardian paused execution while stake sizing resets.",
    action: "Cooldown 4m · stake held at $35",
    acknowledged: false,
  },
  {
    id: "alr_2",
    at: "2026-10-18T12:41:10Z",
    poolId: "pkg_03",
    poolCode: "PKG-03",
    botId: "bot_bravo",
    level: "watch",
    title: "Volatility band widened on R_75",
    detail:
      "Realised volatility on R_75 crossed the 1.4× band. Stake size stays at the pool minimum and the pool keeps trading inside the 5% drawdown limit.",
    action: "Stake capped · drawdown 2.4% of 5.0%",
    acknowledged: false,
  },
  {
    id: "alr_3",
    at: "2026-10-18T09:12:00Z",
    poolId: "pkg_01",
    poolCode: "PKG-01",
    botId: "bot_alpha",
    level: "ok",
    title: "Loss streak cleared on Bot-Alpha",
    detail:
      "A three-loss streak on R_10 cleared after the 10:12 settlement batch. Drawdown back to 1.8% against the 5.0% limit.",
    action: "Resumed automatically",
    acknowledged: true,
  },
];

/* ── Workspace ── */

export function getLiveTradeWorkspace(): LiveTradeWorkspace {
  const book = getPoolsWorkspace();
  const pools = livePools();
  const feed = buildFeed(pools);
  const bots = deriveBots(feed);
  const alertRows = alerts();
  const totals = deriveTotals(pools, feed, bots, alertRows);

  return structuredClone({
    mode: "demo",
    asOf: SNAPSHOT,
    revision: 0,
    stream: {
      id: "stream_inv_01",
      region: "eu-west-1",
      latencyMs: 38,
      reconnects: 1,
      connectedAt: "2026-10-18T08:00:12Z",
      eventsPerMinute: 14,
      droppedEvents: 0,
    },
    profile: {
      id: book.profile.id,
      displayName: book.profile.displayName,
      investorSince: book.profile.investorSince,
      tier: book.profile.tier,
      wallet: book.summary.wallet,
      unread: book.summary.unread,
      monthRoiPct: book.summary.monthRoiPct,
      committed: book.summary.committed,
    },
    totals,
    pools,
    feed,
    ticks: tickers(),
    stats: recomputeStats(feed, pools),
    bots,
    alerts: alertRows,
    guardrails: [
      {
        id: "gr_streak",
        label: "Consecutive-loss pause",
        detail:
          "A bot pauses after three losses in a row; stake sizing resets before execution resumes.",
        limit: "3 losses",
      },
      {
        id: "gr_drawdown",
        label: "Drawdown band",
        detail:
          "Pool execution stops at 5% drawdown from peak equity. Guardian checks run with every settlement batch.",
        limit: "5.0%",
      },
      {
        id: "gr_volatility",
        label: "Volatility filter",
        detail:
          "When realised volatility passes 1.4× the 30-minute band, stake size is capped at the pool minimum.",
        limit: "1.4×",
      },
      {
        id: "gr_share",
        label: "Share of P&L",
        detail:
          "Your share is applied per trade, then the 20% platform cut is subtracted before earnings reach the pool ledger.",
        limit: "per trade",
      },
    ],
    watchlist: ["R_10", "R_75"],
    filters: { pools: [], results: [], symbols: [], minStake: 0, query: "" },
    preferences: {
      autoScroll: true,
      rowFlash: true,
      streamPaused: false,
      density: "comfortable",
      soundCue: false,
    },
    rules: [
      {
        id: "rule_1",
        threshold: 25,
        channel: "in_app",
        matches: "your-pools",
        note: "In-app alert when a single trade moves more than $25 in your share.",
        createdAt: "2026-10-04T09:12:00Z",
      },
    ],
    exports: [],
    support: [],
    audit: [],
  });
}
