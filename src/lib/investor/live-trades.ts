import { z } from "zod";

/**
 * I-5 · Live Trade Tracker — streaming numbers, no charts.
 *
 * One `LiveTradeWorkspace` holds the running totals, the trade feed window, the
 * symbol tickers, today's session statistics, the bots trading inside the
 * investor's pools and the Guardian alerts attached to them.
 *
 * The page is a front-end preview: no socket is opened and no order is sent.
 * `applyStreamEvent` is the exact reducer a socket handler would call
 * (`investor:trade_result`, `investor:tick_update`, `investor:ai_guardian`,
 * `investor:earnings_update`), and `nextSyntheticTrade` / `nextTicks` produce
 * deterministic pushes so the stream can be exercised without a backend.
 */

export const LIVE_AS_OF = "2026-10-18T14:23:47Z";
export const FEED_LIMIT = 200;
export const TICK_SECONDS = 1;

export type LivePoolStatus = "trading" | "paused" | "cooldown";
export type BotStatus = "running" | "paused" | "cooldown";
export type GuardianLevel = "ok" | "watch" | "alert";
export type TradeResult = "win" | "loss";
export type LiveStreamKind =
  "trade_result" | "tick_update" | "ai_guardian" | "earnings_update";

/* ── Trade feed ── */

export interface LiveTrade {
  tradeId: string;
  poolId: string;
  poolCode: string;
  poolName: string;
  symbol: string;
  contractType: "CALL" | "PUT" | "EVEN" | "ODD" | "OVER" | "UNDER";
  contractLabel: string;
  stake: number;
  payout: number;
  profit: number;
  isWin: boolean;
  entrySpot: number;
  exitSpot: number;
  boughtAt: string;
  soldAt: string;
  durationSeconds: number;
  botId: string;
  botName: string;
  yourSharePct: number;
  yourShareGross: number;
  platformCut: number;
  yourShareNet: number;
}

/* ── Pools ── */

export interface LivePool {
  poolId: string;
  code: string;
  name: string;
  status: LivePoolStatus;
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  strategy: string;
  yourInvestment: number;
  yourSlots: number;
  yourSharePct: number;
  poolPnl: number;
  yourSharePnl: number;
  poolTrades: number;
  poolWinRatePct: number;
  poolCapital: number;
  endsAt: string;
  guardianLevel: GuardianLevel;
  guardianNote: string;
  pausedUntil: string | null;
}

/* ── Tickers ── */

export interface SymbolTick {
  symbol: string;
  price: number;
  previous: number;
  changePct: number;
  direction: "up" | "down" | "flat";
  decimals: number;
  tickSeconds: number;
  pools: string[];
  sessionHigh: number;
  sessionLow: number;
  lastTickAt: string;
  ticksObserved: number;
}

/* ── Bots ── */

export interface LiveBot {
  id: string;
  name: string;
  poolId: string;
  poolCode: string;
  symbol: string;
  status: BotStatus;
  trades: number;
  wins: number;
  lossStreak: number;
  winRatePct: number;
  stake: number;
  pnl: number;
  cooldownSeconds: number;
  guardianLevel: GuardianLevel;
  lastActionAt: string;
  note: string;
}

/* ── Guardian alerts ── */

export interface GuardianAlert {
  id: string;
  at: string;
  poolId: string;
  poolCode: string;
  botId: string | null;
  level: GuardianLevel;
  title: string;
  detail: string;
  action: string;
  acknowledged: boolean;
}

/* ── Session statistics ── */

export interface LiveStatBucket {
  label: string;
  trades: number;
  pnl: number;
  yourShare: number;
}

export interface LiveSessionStats {
  trades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  pnl: number;
  yourShare: number;
  volume: number;
  best: { amount: number; tradeId: string; note: string } | null;
  worst: { amount: number; tradeId: string; note: string } | null;
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: { kind: "win" | "loss" | "none"; count: number };
  avgDurationSeconds: number;
  byPool: LiveStatBucket[];
  bySymbol: LiveStatBucket[];
  byHour: LiveStatBucket[];
}

export interface LiveTotals {
  runningCapital: number;
  currentPnl: number;
  poolRoiPct: number;
  yourSharePnl: number;
  tradesExecuted: number;
  lastTradeAt: string | null;
  poolCount: number;
  botsRunning: number;
  botsPaused: number;
  openAlerts: number;
}

/* ── Preferences, exports, support ── */

export interface LiveFeedFilters {
  pools: string[];
  results: TradeResult[];
  symbols: string[];
  minStake: number;
  query: string;
}

export interface LivePreferences {
  autoScroll: boolean;
  rowFlash: boolean;
  streamPaused: boolean;
  density: "comfortable" | "compact";
  soundCue: boolean;
}

export interface LiveAlertRule {
  id: string;
  threshold: number;
  channel: "email" | "in_app";
  matches: "your-pools" | "all-pools";
  note: string;
  createdAt: string;
}

export interface LiveExport {
  id: string;
  scope: "trade-feed" | "session-stats" | "bot-report" | "guardian-log";
  format: "csv" | "json" | "pdf";
  count: number;
  createdAt: string;
}

export interface LiveSupport {
  id: string;
  topic: "trade" | "bot" | "payout" | "guardian" | "other";
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface LiveAuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
}

/* ── Workspace ── */

export interface LiveTradeWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  stream: {
    id: string;
    region: string;
    latencyMs: number;
    reconnects: number;
    connectedAt: string;
    eventsPerMinute: number;
    droppedEvents: number;
  };
  profile: {
    id: string;
    displayName: string;
    investorSince: string;
    tier: string;
    wallet: number;
    unread: number;
    monthRoiPct: number;
    committed: number;
  };
  totals: LiveTotals;
  pools: LivePool[];
  feed: LiveTrade[];
  ticks: SymbolTick[];
  stats: LiveSessionStats;
  bots: LiveBot[];
  alerts: GuardianAlert[];
  guardrails: { id: string; label: string; detail: string; limit: string }[];
  watchlist: string[];
  filters: LiveFeedFilters;
  preferences: LivePreferences;
  rules: LiveAlertRule[];
  exports: LiveExport[];
  support: LiveSupport[];
  audit: LiveAuditEntry[];
}

/* ── Formatting helpers ── */

export const round2 = (value: number) => {
  const rounded = Number(value.toFixed(2));
  return rounded === 0 ? 0 : rounded;
};

export const money = (value: number, decimals = 0) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const signedMoney = (value: number, decimals = 0) =>
  value === 0
    ? money(0, decimals)
    : `${value > 0 ? "+" : "−"}${money(Math.abs(value), decimals)}`;

export const signedPct = (value: number, decimals = 2) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(decimals)}%`;

export const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });

export const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const atStamp = (iso: string) => `${dateOf(iso)} · ${clockOf(iso)} UTC`;

export const isoDay = (iso: string) => iso.slice(0, 10);

export const durationLabel = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export const botStatusLabel = (status: BotStatus) =>
  status === "running"
    ? "Running"
    : status === "paused"
      ? "Paused"
      : "Cooldown";

export const guardianLabel = (level: GuardianLevel) =>
  level === "ok" ? "Clear" : level === "watch" ? "Watch" : "Alert";

export const poolLabel = (status: LivePoolStatus) =>
  status === "trading"
    ? "Trading"
    : status === "paused"
      ? "Paused"
      : "Cooldown";

/* ── Selectors ── */

/**
 * Splits one trade's profit. `sharePct` is the investor's *net* share of the
 * pool, and the platform cut is 20% of the gross share — so a $28 trade in a
 * 30% pool pays $10.50 gross, $2.10 cut and $8.40 net, exactly as specified.
 */
export const PLATFORM_CUT_PCT = 20;

export const shareOf = (profit: number, sharePct: number) => {
  const net = round2((profit * sharePct) / 100);
  const gross = round2(net / (1 - PLATFORM_CUT_PCT / 100));
  return { gross, cut: round2(gross - net), net };
};

export const poolByCode = (pools: LivePool[], code: string) =>
  pools.find((pool) => pool.code === code || pool.poolId === code) ?? null;

/** Totals derive from the pools so the KPI row can never drift from them. */
export function deriveTotals(
  pools: LivePool[],
  feed: LiveTrade[],
  bots: LiveBot[],
  alerts: GuardianAlert[],
): LiveTotals {
  const runningCapital = round2(
    pools.reduce((sum, pool) => sum + pool.yourInvestment, 0),
  );
  const currentPnl = round2(pools.reduce((sum, pool) => sum + pool.poolPnl, 0));
  const yourSharePnl = round2(
    pools.reduce((sum, pool) => sum + pool.yourSharePnl, 0),
  );
  return {
    runningCapital,
    currentPnl,
    yourSharePnl,
    poolRoiPct: runningCapital
      ? Number(((yourSharePnl / runningCapital) * 100).toFixed(2))
      : 0,
    tradesExecuted: feed.length,
    lastTradeAt: feed[0]?.soldAt ?? null,
    poolCount: pools.length,
    botsRunning: bots.filter((bot) => bot.status === "running").length,
    botsPaused: bots.filter((bot) => bot.status !== "running").length,
    openAlerts: alerts.filter((alert) => !alert.acknowledged).length,
  };
}

/** Session statistics are always recomputed from the feed window. */
export function recomputeStats(
  feed: LiveTrade[],
  pools: LivePool[],
): LiveSessionStats {
  const wins = feed.filter((trade) => trade.isWin);
  const losses = feed.filter((trade) => !trade.isWin);
  const pnl = round2(feed.reduce((sum, trade) => sum + trade.profit, 0));
  const yourShare = round2(
    feed.reduce((sum, trade) => sum + trade.yourShareNet, 0),
  );
  const volume = round2(feed.reduce((sum, trade) => sum + trade.stake, 0));

  const sorted = [...feed].sort((a, b) => a.soldAt.localeCompare(b.soldAt));
  let winStreak = 0;
  let lossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let current: { kind: "win" | "loss" | "none"; count: number } = {
    kind: "none",
    count: 0,
  };
  for (const trade of sorted) {
    if (trade.isWin) {
      winStreak += 1;
      lossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, winStreak);
      current =
        current.kind === "win"
          ? { kind: "win", count: current.count + 1 }
          : { kind: "win", count: 1 };
    } else {
      lossStreak += 1;
      winStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, lossStreak);
      current =
        current.kind === "loss"
          ? { kind: "loss", count: current.count + 1 }
          : { kind: "loss", count: 1 };
    }
  }

  const best = feed.reduce<LiveTrade | null>(
    (top, trade) =>
      !top || trade.yourShareNet > top.yourShareNet ? trade : top,
    null,
  );
  const worst = feed.reduce<LiveTrade | null>(
    (low, trade) =>
      !low || trade.yourShareNet < low.yourShareNet ? trade : low,
    null,
  );

  const bucket = (label: string, rows: LiveTrade[]): LiveStatBucket => ({
    label,
    trades: rows.length,
    pnl: round2(rows.reduce((sum, trade) => sum + trade.profit, 0)),
    yourShare: round2(rows.reduce((sum, trade) => sum + trade.yourShareNet, 0)),
  });

  const byPool = pools.map((pool) =>
    bucket(
      pool.code,
      feed.filter((trade) => trade.poolId === pool.poolId),
    ),
  );
  const symbols = Array.from(new Set(feed.map((trade) => trade.symbol)));
  const bySymbol = symbols
    .map((symbol) =>
      bucket(
        symbol,
        feed.filter((trade) => trade.symbol === symbol),
      ),
    )
    .sort((a, b) => b.trades - a.trades);
  const hours = Array.from(
    new Set(sorted.map((trade) => trade.soldAt.slice(11, 13))),
  ).sort();
  const byHour = hours.map((hour) =>
    bucket(
      `${hour}:00`,
      feed.filter((trade) => trade.soldAt.slice(11, 13) === hour),
    ),
  );

  return {
    trades: feed.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: feed.length
      ? Number(((wins.length / feed.length) * 100).toFixed(1))
      : 0,
    pnl,
    yourShare,
    volume,
    best: best
      ? {
          amount: best.yourShareNet,
          tradeId: best.tradeId,
          note: `${best.symbol} ${best.contractLabel} · ${best.poolCode}`,
        }
      : null,
    worst: worst
      ? {
          amount: worst.yourShareNet,
          tradeId: worst.tradeId,
          note: `${worst.symbol} ${worst.contractLabel} · ${worst.poolCode}`,
        }
      : null,
    longestWinStreak,
    longestLossStreak,
    currentStreak: current,
    avgDurationSeconds: feed.length
      ? Math.round(
          feed.reduce((sum, trade) => sum + trade.durationSeconds, 0) /
            feed.length,
        )
      : 0,
    byPool,
    bySymbol,
    byHour,
  };
}

export function filterFeed(feed: LiveTrade[], filters: LiveFeedFilters) {
  const query = filters.query.trim().toLowerCase();
  return feed.filter((trade) => {
    if (filters.pools.length && !filters.pools.includes(trade.poolCode))
      return false;
    if (filters.results.length) {
      const result: TradeResult = trade.isWin ? "win" : "loss";
      if (!filters.results.includes(result)) return false;
    }
    if (filters.symbols.length && !filters.symbols.includes(trade.symbol))
      return false;
    if (trade.stake < filters.minStake) return false;
    if (!query) return true;
    return `${trade.symbol} ${trade.contractLabel} ${trade.botName} ${trade.poolCode} ${trade.tradeId}`
      .toLowerCase()
      .includes(query);
  });
}

/* ── Streaming reducer ── */

type TickEvent = { kind: "tick_update"; ticks: SymbolTick[] };

export type LiveStreamEvent =
  | { kind: "trade_result"; trade: LiveTrade }
  | TickEvent
  | { kind: "ai_guardian"; alert: GuardianAlert; bots: LiveBot[] }
  | { kind: "earnings_update"; yourSharePnl: number };

/**
 * Applies one pushed event and returns a new workspace. This is the single
 * function a socket handler needs: feed, totals, stats, ticks and bots all
 * move through here, so every surface on the page stays consistent.
 */
export function applyStreamEvent(
  current: LiveTradeWorkspace,
  event: LiveStreamEvent,
): LiveTradeWorkspace {
  const w = structuredClone(current);
  w.revision += 1;
  w.stream.eventsPerMinute += 1;

  if (event.kind === "trade_result") {
    const trade = event.trade;
    w.feed = [trade, ...w.feed].slice(0, FEED_LIMIT);
    w.pools = w.pools.map((pool) =>
      pool.poolId === trade.poolId
        ? {
            ...pool,
            poolPnl: round2(pool.poolPnl + trade.profit),
            yourSharePnl: round2(pool.yourSharePnl + trade.yourShareNet),
            poolTrades: pool.poolTrades + 1,
            poolWinRatePct: Number(
              (
                (((pool.poolWinRatePct / 100) * pool.poolTrades +
                  (trade.isWin ? 1 : 0)) /
                  (pool.poolTrades + 1)) *
                100
              ).toFixed(1),
            ),
          }
        : pool,
    );
    w.bots = w.bots.map((bot) =>
      bot.id === trade.botId
        ? {
            ...bot,
            trades: bot.trades + 1,
            wins: bot.wins + (trade.isWin ? 1 : 0),
            winRatePct: Number(
              (
                ((bot.wins + (trade.isWin ? 1 : 0)) / (bot.trades + 1)) *
                100
              ).toFixed(1),
            ),
            pnl: round2(bot.pnl + trade.profit),
            lossStreak: trade.isWin ? 0 : bot.lossStreak + 1,
            lastActionAt: trade.soldAt,
          }
        : bot,
    );
  }

  if (event.kind === "tick_update") {
    w.ticks = event.ticks;
  }

  if (event.kind === "ai_guardian") {
    w.alerts = [event.alert, ...w.alerts].slice(0, 40);
    w.bots = event.bots;
  }

  if (event.kind === "earnings_update") {
    w.totals.yourSharePnl = round2(event.yourSharePnl);
  }

  w.totals = {
    ...deriveTotals(w.pools, w.feed, w.bots, w.alerts),
    // an explicit earnings push wins over the pool roll-up for this tick
    yourSharePnl:
      event.kind === "earnings_update"
        ? round2(event.yourSharePnl)
        : deriveTotals(w.pools, w.feed, w.bots, w.alerts).yourSharePnl,
  };
  w.stats = recomputeStats(w.feed, w.pools);
  return w;
}

/* ── Deterministic stream generator (stands in for the socket) ── */

/** Small LCG so the simulated stream is reproducible in tests. */
const nextSeed = (seed: number) => (seed * 1103515245 + 12345) % 2147483648;
const pick = <T>(rows: T[], seed: number) => rows[seed % rows.length];

const BOT_FOR_POOL: Record<string, { id: string; name: string }> = {
  pkg_01: { id: "bot_alpha", name: "Bot-Alpha" },
  pkg_03: { id: "bot_bravo", name: "Bot-Bravo" },
};

export function nextSyntheticTrade(
  workspace: LiveTradeWorkspace,
  sequence: number,
  at = LIVE_AS_OF,
): LiveTrade {
  const pools = workspace.pools.filter((pool) => pool.status !== "paused");
  const seed = nextSeed(sequence + 7);
  const pool = pick(pools.length ? pools : workspace.pools, seed);
  const poolTickers = workspace.ticks.filter((tick) =>
    tick.pools.includes(pool.code),
  );
  const ticker = pick(
    poolTickers.length ? poolTickers : workspace.ticks,
    Math.floor(seed / 3),
  );
  const isWin = seed % 100 < 62;
  const stake = pick([35, 35, 35, 70], Math.floor(seed / 11));
  const contractType = pick(
    ["CALL", "PUT", "EVEN", "ODD"] as const,
    Math.floor(seed / 5),
  );
  const contractLabel =
    contractType === "CALL"
      ? "Rise · 5 ticks"
      : contractType === "PUT"
        ? "Fall · 5 ticks"
        : contractType === "EVEN"
          ? "Even · 1 tick"
          : "Odd · 1 tick";
  const profit = isWin ? round2(stake * 0.8) : -stake;
  const share = shareOf(profit, pool.yourSharePct);
  const drift = ((seed % 1000) - 500) / 100000;
  const entrySpot = Number((ticker?.price ?? 1000).toFixed(2));
  const exitSpot = Number(
    (entrySpot * (1 + (isWin ? drift : -drift))).toFixed(2),
  );
  const soldAt = new Date(at).toISOString();
  const tradeNumber = 9000 + (sequence % 999);
  return {
    tradeId: `trd_${tradeNumber.toString(16)}${(seed % 97).toString(16)}`,
    poolId: pool.poolId,
    poolCode: pool.code,
    poolName: pool.name,
    symbol: ticker?.symbol ?? "R_10",
    contractType,
    contractLabel,
    stake,
    payout: isWin ? round2(stake * 1.8) : 0,
    profit,
    isWin,
    entrySpot,
    exitSpot,
    boughtAt: new Date(Date.parse(soldAt) - 5000).toISOString(),
    soldAt,
    durationSeconds: 4 + (seed % 12),
    botId: BOT_FOR_POOL[pool.poolId]?.id ?? "bot_alpha",
    botName: BOT_FOR_POOL[pool.poolId]?.name ?? "Bot-Alpha",
    yourSharePct: pool.yourSharePct,
    yourShareGross: share.gross,
    platformCut: share.cut,
    yourShareNet: share.net,
  };
}

export function nextTicks(
  ticks: SymbolTick[],
  sequence: number,
  at = LIVE_AS_OF,
): SymbolTick[] {
  return ticks.map((tick, index) => {
    const seed = nextSeed(sequence * 31 + index * 7 + 3);
    const delta = ((seed % 2001) - 1000) / 1_000_000;
    const price = Number((tick.price * (1 + delta)).toFixed(tick.decimals));
    // the tick-over-tick move, so direction and percentage can never disagree
    const changePct = Number(
      (((price - tick.price) / Math.max(tick.price, 1)) * 100).toFixed(2),
    );
    return {
      ...tick,
      previous: tick.price,
      price,
      changePct,
      direction:
        price > tick.price ? "up" : price < tick.price ? "down" : "flat",
      sessionHigh: Math.max(tick.sessionHigh, price),
      sessionLow: Math.min(tick.sessionLow, price),
      lastTickAt: at,
      ticksObserved: tick.ticksObserved + 1,
    };
  });
}

/* ── Commands ── */

export const liveCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("refreshStream"),
    source: z.enum(["manual", "auto"]),
  }),
  z.object({
    kind: z.literal("pauseBot"),
    botId: z.string().min(2).max(40),
    minutes: z.union([
      z.literal(5),
      z.literal(15),
      z.literal(60),
      z.literal(240),
    ]),
    reason: z.enum(["travel", "review", "volatility", "other"]),
  }),
  z.object({
    kind: z.literal("resumeBot"),
    botId: z.string().min(2).max(40),
  }),
  z.object({
    kind: z.literal("pausePool"),
    poolId: z.string().min(2).max(40),
    reason: z.enum(["guardian", "review", "market", "other"]),
  }),
  z.object({
    kind: z.literal("resumePool"),
    poolId: z.string().min(2).max(40),
  }),
  z.object({
    kind: z.literal("acknowledgeAlert"),
    alertId: z.string().min(2).max(40),
  }),
  z.object({
    kind: z.literal("saveFilters"),
    pools: z.array(z.string()).max(8),
    results: z.array(z.enum(["win", "loss"])).max(2),
    symbols: z.array(z.string()).max(12),
    minStake: z.number().min(0).max(100000),
    query: z.string().max(60),
  }),
  z.object({
    kind: z.literal("setStreamPaused"),
    paused: z.boolean(),
  }),
  z.object({
    kind: z.literal("savePreferences"),
    autoScroll: z.boolean(),
    rowFlash: z.boolean(),
    density: z.enum(["comfortable", "compact"]),
    soundCue: z.boolean(),
  }),
  z.object({
    kind: z.literal("toggleWatch"),
    symbol: z.string().min(2).max(16),
  }),
  z.object({
    kind: z.literal("saveAlertRule"),
    threshold: z.number().min(1).max(100000),
    channel: z.enum(["email", "in_app"]),
    matches: z.enum(["your-pools", "all-pools"]),
  }),
  z.object({
    kind: z.literal("exportFeed"),
    scope: z.enum([
      "trade-feed",
      "session-stats",
      "bot-report",
      "guardian-log",
    ]),
    format: z.enum(["csv", "json", "pdf"]),
    count: z.number().int().min(0).max(500),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["trade", "bot", "payout", "guardian", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
]);

export type LiveCommand = z.infer<typeof liveCommandSchema>;

const pauseReasons: Record<string, string> = {
  travel: "travel",
  review: "manual review",
  volatility: "volatility",
  guardian: "Guardian directive",
  market: "market conditions",
  other: "other",
};

export function applyLiveCommand(
  current: LiveTradeWorkspace,
  input: LiveCommand,
  now = "2026-10-18T14:24:00Z",
): LiveTradeWorkspace {
  const parsed = liveCommandSchema.parse(input);
  const w = structuredClone(current);
  const audit = (action: string, detail: string) => {
    w.revision += 1;
    w.audit = [
      {
        id: `live_audit_${w.revision}_${w.audit.length + 1}`,
        at: now,
        action,
        detail,
      },
      ...w.audit,
    ].slice(0, 40);
  };

  switch (parsed.kind) {
    case "refreshStream": {
      if (parsed.source === "manual") {
        w.stream.reconnects = current.stream.reconnects;
        audit(
          "stream_refresh",
          `Feed re-read at ${clockOf(now)} UTC; ${w.feed.length} trades in the window.`,
        );
      } else {
        w.revision += 1;
      }
      return w;
    }
    case "pauseBot": {
      const bot = w.bots.find((row) => row.id === parsed.botId);
      if (!bot) throw new Error("That bot is not trading in your pools");
      if (bot.status !== "running")
        throw new Error(
          `${bot.name} is already ${botStatusLabel(bot.status).toLowerCase()}`,
        );
      bot.status = "paused";
      bot.cooldownSeconds = parsed.minutes * 60;
      bot.note = `Paused locally for ${parsed.minutes} min · ${pauseReasons[parsed.reason]}. Live execution is unaffected.`;
      bot.lastActionAt = now;
      w.totals = deriveTotals(w.pools, w.feed, w.bots, w.alerts);
      audit(
        "bot_pause",
        `${bot.name} (${bot.poolCode}) paused ${parsed.minutes} min · ${pauseReasons[parsed.reason]}. Stored in this session only.`,
      );
      return w;
    }
    case "resumeBot": {
      const bot = w.bots.find((row) => row.id === parsed.botId);
      if (!bot) throw new Error("That bot is not trading in your pools");
      if (bot.status === "running")
        throw new Error(`${bot.name} is already running`);
      if (bot.guardianLevel === "alert")
        throw new Error(
          "AI Guardian is holding this bot until the alert is acknowledged",
        );
      bot.status = "running";
      bot.cooldownSeconds = 0;
      bot.note =
        "Resumed locally; the desk resumes live execution with the next settlement batch.";
      bot.lastActionAt = now;
      w.totals = deriveTotals(w.pools, w.feed, w.bots, w.alerts);
      audit(
        "bot_resume",
        `${bot.name} (${bot.poolCode}) resumed in this session.`,
      );
      return w;
    }
    case "pausePool": {
      const pool = w.pools.find((row) => row.poolId === parsed.poolId);
      if (!pool) throw new Error("Pool not found in your live book");
      if (pool.status === "paused")
        throw new Error(`${pool.code} is already paused`);
      pool.status = "paused";
      pool.pausedUntil = new Date(Date.parse(now) + 15 * 60_000).toISOString();
      pool.guardianNote = `Paused locally (${pauseReasons[parsed.reason]}). Bot execution continues on the desk side.`;
      w.bots = w.bots.map((bot) =>
        bot.poolId === pool.poolId && bot.status === "running"
          ? {
              ...bot,
              status: "paused",
              note: `Pool ${pool.code} paused in this session.`,
            }
          : bot,
      );
      w.totals = deriveTotals(w.pools, w.feed, w.bots, w.alerts);
      audit(
        "pool_pause",
        `${pool.code} paused locally · ${pauseReasons[parsed.reason]}. 15 min review window.`,
      );
      return w;
    }
    case "resumePool": {
      const pool = w.pools.find((row) => row.poolId === parsed.poolId);
      if (!pool) throw new Error("Pool not found in your live book");
      if (pool.status === "trading")
        throw new Error(`${pool.code} is already trading`);
      pool.status = "trading";
      pool.pausedUntil = null;
      pool.guardianNote =
        "Running. Guardian checks continue with every settlement batch.";
      audit("pool_resume", `${pool.code} resumed in this session.`);
      return w;
    }
    case "acknowledgeAlert": {
      const alert = w.alerts.find((row) => row.id === parsed.alertId);
      if (!alert) throw new Error("Alert not found");
      if (alert.acknowledged)
        throw new Error("That alert is already acknowledged");
      alert.acknowledged = true;
      w.totals = deriveTotals(w.pools, w.feed, w.bots, w.alerts);
      audit(
        "alert_acknowledged",
        `${alert.title} (${alert.poolCode}) acknowledged locally.`,
      );
      return w;
    }
    case "saveFilters": {
      w.filters = {
        pools: parsed.pools,
        results: parsed.results,
        symbols: parsed.symbols,
        minStake: parsed.minStake,
        query: parsed.query,
      };
      audit(
        "feed_filters",
        `Feed filtered to ${parsed.pools.join(" + ") || "all pools"} · ${
          parsed.results.length ? parsed.results.join(" + ") : "wins and losses"
        }${parsed.query ? ` · “${parsed.query}”` : ""} · min stake $${parsed.minStake}.`,
      );
      return w;
    }
    case "setStreamPaused": {
      w.preferences.streamPaused = parsed.paused;
      audit(
        parsed.paused ? "stream_paused" : "stream_resumed",
        parsed.paused
          ? "Updates held in this browser. The desk keeps trading; queued events are dropped, not replayed."
          : "Feed resumed in this browser. Live values continue from the desk snapshot.",
      );
      return w;
    }
    case "savePreferences": {
      w.preferences = {
        ...w.preferences,
        autoScroll: parsed.autoScroll,
        rowFlash: parsed.rowFlash,
        density: parsed.density,
        soundCue: parsed.soundCue,
      };
      audit(
        "stream_preferences",
        `Stream preferences stored locally: ${parsed.density} rows, flash ${parsed.rowFlash ? "on" : "off"}, auto-scroll ${parsed.autoScroll ? "on" : "off"}.`,
      );
      return w;
    }
    case "toggleWatch": {
      const watching = w.watchlist.includes(parsed.symbol);
      w.watchlist = watching
        ? w.watchlist.filter((symbol) => symbol !== parsed.symbol)
        : [...w.watchlist, parsed.symbol];
      audit(
        watching ? "unwatch_symbol" : "watch_symbol",
        `${parsed.symbol} ${watching ? "removed from" : "added to"} the local watchlist.`,
      );
      return w;
    }
    case "saveAlertRule": {
      if (w.rules.some((rule) => rule.threshold === parsed.threshold))
        throw new Error("A rule already exists at that threshold");
      w.rules.unshift({
        id: `rule_${w.revision + 1}`,
        threshold: parsed.threshold,
        channel: parsed.channel,
        matches: parsed.matches,
        note: `${parsed.channel === "email" ? "Email" : "In-app"} alert when a single trade moves more than $${parsed.threshold} in your share.`,
        createdAt: now,
      });
      w.rules = w.rules.slice(0, 8);
      audit(
        "alert_rule_saved",
        `Rule stored locally: $${parsed.threshold} threshold on ${parsed.matches === "your-pools" ? "your pools" : "all pools"} via ${parsed.channel}. No message is sent.`,
      );
      return w;
    }
    case "exportFeed": {
      w.exports.unshift({
        id: `export_${w.revision + 1}`,
        scope: parsed.scope,
        format: parsed.format,
        count: parsed.count,
        createdAt: now,
      });
      w.exports = w.exports.slice(0, 10);
      audit(
        "export_prepared",
        `${parsed.scope} exported as ${parsed.format.toUpperCase()} (${parsed.count} row(s)). Generated in-browser only.`,
      );
      return w;
    }
    case "support": {
      w.support.unshift({
        id: `support_${w.revision + 1}`,
        topic: parsed.topic,
        message: parsed.message,
        status: "local_draft",
        createdAt: now,
      });
      w.support = w.support.slice(0, 10);
      audit(
        "support_draft",
        `${parsed.topic} question saved locally; nothing was transmitted.`,
      );
      return w;
    }
  }
}
