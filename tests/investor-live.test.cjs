const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (id) =>
    id.startsWith("@/")
      ? load("src/" + id.slice(2) + ".ts")
      : id.startsWith("./")
        ? load(path.join(path.dirname(file), id) + ".ts")
        : require(id);
  new Function("exports", "require", "module", output)(mod.exports, req, mod);
  cache.set(file, mod.exports);
  return mod.exports;
}

const { getLiveTradeWorkspace } = load(
  "src/server/services/investor-live-service.ts",
);
const live = load("src/lib/investor/live-trades.ts");
const {
  FEED_LIMIT,
  applyLiveCommand,
  applyStreamEvent,
  clockOf,
  deriveTotals,
  filterFeed,
  guardianLabel,
  money,
  nextSyntheticTrade,
  nextTicks,
  poolByCode,
  recomputeStats,
  round2,
  shareOf,
  signedMoney,
  signedPct,
} = live;

const read = (file) =>
  fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const workspace = getLiveTradeWorkspace();
const now = "2026-10-18T14:24:00Z";

/* ── Fixture and reconciliation ── */

test("live workspace ships a 47-trade session with the specified totals", () => {
  assert.equal(workspace.mode, "demo");
  assert.equal(workspace.feed.length, 47);
  assert.equal(workspace.stats.trades, 47);
  assert.equal(workspace.totals.runningCapital, 25000);
  assert.equal(workspace.totals.yourSharePnl, 2610);
  assert.equal(workspace.totals.poolRoiPct, 10.44);
});

test("session statistics match the specification figures", () => {
  assert.equal(workspace.stats.wins, 29);
  assert.equal(workspace.stats.losses, 18);
  assert.equal(workspace.stats.winRatePct, 61.7);
  assert.equal(workspace.stats.pnl, 133);
  assert.equal(workspace.stats.yourShare, 39.9);
  assert.equal(workspace.stats.best?.amount, 8.4);
  assert.equal(workspace.stats.worst?.amount, -10.5);
  assert.equal(workspace.stats.longestWinStreak, 5);
  assert.equal(workspace.stats.avgDurationSeconds, 18);
});

test("the feed sums to the session P&L and never drifts from the pools", () => {
  const feedPnl = round2(
    workspace.feed.reduce((sum, trade) => sum + trade.profit, 0),
  );
  const poolPnl = round2(
    workspace.pools.reduce((sum, pool) => sum + pool.poolPnl, 0),
  );
  assert.equal(feedPnl, 133);
  assert.equal(poolPnl, workspace.totals.currentPnl);
  const shareSum = round2(
    workspace.feed.reduce((sum, trade) => sum + trade.yourShareNet, 0),
  );
  assert.equal(shareSum, workspace.stats.yourShare);
});

test("bot cards reconcile with the feed and their pools", () => {
  const byBot = workspace.bots.reduce((sum, bot) => sum + bot.pnl, 0);
  assert.equal(round2(byBot), workspace.stats.pnl);
  for (const pool of workspace.stats.byPool) {
    const bots = workspace.bots.filter((bot) => bot.poolCode === pool.label);
    assert.equal(
      round2(bots.reduce((sum, bot) => sum + bot.pnl, 0)),
      round2(pool.pnl),
      `${pool.label} bots add up to the pool session P&L`,
    );
  }
  const alpha = workspace.bots.find((bot) => bot.id === "bot_alpha");
  assert.equal(alpha.trades, 12);
  assert.equal(alpha.pnl, 84);
  const charlie = workspace.bots.find((bot) => bot.id === "bot_charlie");
  assert.equal(charlie.status, "cooldown");
  assert.ok(charlie.lossStreak >= 2, "a cooldown follows consecutive losses");
  assert.ok(charlie.cooldownSeconds > 0, "cooldown carries a countdown");
});

test("feed is newest first and each row carries the socket payload fields", () => {
  const times = workspace.feed.map((trade) => Date.parse(trade.soldAt));
  assert.deepEqual(
    times,
    [...times].sort((a, b) => b - a),
  );
  const row = workspace.feed[0];
  for (const field of [
    "tradeId",
    "poolId",
    "symbol",
    "contractType",
    "stake",
    "payout",
    "profit",
    "isWin",
    "entrySpot",
    "exitSpot",
    "boughtAt",
    "soldAt",
    "botName",
    "yourShareGross",
    "platformCut",
    "yourShareNet",
  ])
    assert.ok(field in row, `trade row exposes ${field}`);
  assert.equal(row.stake, 35);
  assert.equal(row.payout, 63);
  assert.equal(row.profit, 28);
  assert.equal(row.yourShareNet, 8.4);
});

test("the platform cut is 20% of the gross share, net stays on spec", () => {
  assert.deepEqual(shareOf(28, 30), { gross: 10.5, cut: 2.1, net: 8.4 });
  assert.deepEqual(shareOf(-35, 30), { gross: -13.13, cut: -2.63, net: -10.5 });
  assert.deepEqual(shareOf(28, 10), { gross: 3.5, cut: 0.7, net: 2.8 });
  assert.deepEqual(shareOf(0, 30), { gross: 0, cut: 0, net: 0 });
});

test("five tickers stream one tick per second with pools attached", () => {
  assert.equal(workspace.ticks.length, 5);
  assert.deepEqual(
    workspace.ticks.map((tick) => tick.symbol),
    ["R_10", "R_50", "R_100", "R_75", "1HZ10V"],
  );
  for (const tick of workspace.ticks) {
    assert.equal(tick.tickSeconds, 1);
    assert.ok(tick.pools.length >= 1, `${tick.symbol} names its pool`);
    assert.ok(tick.sessionHigh >= tick.price);
    assert.ok(tick.sessionLow <= tick.price);
  }
  assert.deepEqual(poolByCode(workspace.pools, "PKG-03").code, "PKG-03");
});

/* ── Streaming reducer ── */

test("a pushed trade lands on top and moves every derived surface", () => {
  const trade = nextSyntheticTrade(workspace, 4, "2026-10-18T14:24:05Z");
  const next = applyStreamEvent(workspace, { kind: "trade_result", trade });
  assert.equal(next.feed[0].tradeId, trade.tradeId);
  assert.equal(next.feed.length, workspace.feed.length + 1);
  assert.equal(next.totals.tradesExecuted, 48);
  assert.equal(next.stats.trades, 48);
  assert.equal(
    round2(next.totals.currentPnl),
    round2(workspace.totals.currentPnl + trade.profit),
  );
  assert.equal(next.revision, 1);
  assert.equal(
    workspace.feed[0].tradeId,
    "trd_8f2a1c00",
    "the source is not mutated",
  );
});

test("the feed window is capped and drops the oldest trade", () => {
  let state = workspace;
  for (let index = 0; index < 210; index += 1)
    state = applyStreamEvent(state, {
      kind: "trade_result",
      trade: nextSyntheticTrade(state, index, "2026-10-18T15:00:00Z"),
    });
  assert.equal(state.feed.length, FEED_LIMIT);
  assert.ok(state.feed.length <= 200);
});

test("tick pushes keep direction and percentage in agreement", () => {
  let state = workspace;
  for (let index = 0; index < 40; index += 1)
    state = applyStreamEvent(state, {
      kind: "tick_update",
      ticks: nextTicks(state.ticks, index + 1),
    });
  for (const tick of state.ticks) {
    if (tick.direction === "up")
      assert.ok(tick.changePct >= 0, `${tick.symbol} up`);
    if (tick.direction === "down")
      assert.ok(tick.changePct <= 0, `${tick.symbol} down`);
    assert.ok(Math.abs(tick.changePct) < 1, "ticks stay inside a sane band");
  }
});

test("a guardian push updates alerts and bot state together", () => {
  const alert = {
    id: "alr_new",
    at: now,
    poolId: "pkg_01",
    poolCode: "PKG-01",
    botId: "bot_alpha",
    level: "alert",
    title: "Guardian paused Bot-Alpha",
    detail: "Drawdown threshold reached inside the batch window.",
    action: "Paused for review",
    acknowledged: false,
  };
  const bots = workspace.bots.map((bot) =>
    bot.id === "bot_alpha"
      ? { ...bot, status: "paused", guardianLevel: "alert" }
      : bot,
  );
  const next = applyStreamEvent(workspace, {
    kind: "ai_guardian",
    alert,
    bots,
  });
  assert.equal(next.alerts[0].id, "alr_new");
  assert.equal(next.totals.openAlerts, 3);
  assert.equal(
    next.bots.find((bot) => bot.id === "bot_alpha").status,
    "paused",
  );
});

test("an earnings push overrides the pool roll-up for that tick", () => {
  const next = applyStreamEvent(workspace, {
    kind: "earnings_update",
    yourSharePnl: 2710,
  });
  assert.equal(next.totals.yourSharePnl, 2710);
  assert.equal(
    deriveTotals(next.pools, next.feed, next.bots, next.alerts).yourSharePnl,
    2610,
  );
});

/* ── Commands ── */

test("pausing a bot records a cooldown and writes an audit line", () => {
  const next = applyLiveCommand(
    workspace,
    { kind: "pauseBot", botId: "bot_alpha", minutes: 15, reason: "review" },
    now,
  );
  const bot = next.bots.find((row) => row.id === "bot_alpha");
  assert.equal(bot.status, "paused");
  assert.equal(bot.cooldownSeconds, 900);
  assert.equal(next.totals.botsRunning, 2);
  assert.equal(next.audit[0].action, "bot_pause");
  assert.equal(next.audit[0].at, now);
});

test("a bot already running cannot be resumed twice", () => {
  assert.throws(
    () =>
      applyLiveCommand(workspace, { kind: "resumeBot", botId: "bot_alpha" }),
    /already running/,
  );
  assert.throws(
    () =>
      applyLiveCommand(workspace, {
        kind: "pauseBot",
        botId: "bot_charlie",
        minutes: 5,
        reason: "other",
      }),
    /already cooldown/,
  );
});

test("the guardian alert level blocks a resume until it is acknowledged", () => {
  const held = applyStreamEvent(workspace, {
    kind: "ai_guardian",
    alert: {
      id: "alr_hold",
      at: now,
      poolId: "pkg_01",
      poolCode: "PKG-01",
      botId: "bot_alpha",
      level: "alert",
      title: "Hold",
      detail: "Held by the guardian.",
      action: "Paused",
      acknowledged: false,
    },
    bots: workspace.bots.map((bot) =>
      bot.id === "bot_alpha"
        ? { ...bot, status: "paused", guardianLevel: "alert" }
        : bot,
    ),
  });
  assert.throws(
    () => applyLiveCommand(held, { kind: "resumeBot", botId: "bot_alpha" }),
    /AI Guardian is holding/,
  );
});

test("pausing a pool pauses its bots and sets a review window", () => {
  const next = applyLiveCommand(
    workspace,
    { kind: "pausePool", poolId: "pkg_01", reason: "review" },
    now,
  );
  const pool = next.pools.find((row) => row.poolId === "pkg_01");
  assert.equal(pool.status, "paused");
  assert.ok(pool.pausedUntil);
  assert.equal(
    next.bots.filter(
      (bot) => bot.poolId === "pkg_01" && bot.status === "paused",
    ).length,
    2,
  );
  const resumed = applyLiveCommand(
    next,
    { kind: "resumePool", poolId: "pkg_01" },
    now,
  );
  assert.equal(
    resumed.pools.find((row) => row.poolId === "pkg_01").status,
    "trading",
  );
});

test("acknowledging an alert clears it from the open count once", () => {
  const next = applyLiveCommand(
    workspace,
    { kind: "acknowledgeAlert", alertId: "alr_1" },
    now,
  );
  assert.equal(next.totals.openAlerts, workspace.totals.openAlerts - 1);
  assert.throws(
    () =>
      applyLiveCommand(next, { kind: "acknowledgeAlert", alertId: "alr_1" }),
    /already acknowledged/,
  );
});

test("filters are stored in the workspace and applied by the selector", () => {
  const next = applyLiveCommand(
    workspace,
    {
      kind: "saveFilters",
      pools: ["PKG-03"],
      results: ["win"],
      symbols: [],
      minStake: 0,
      query: "",
    },
    now,
  );
  const filtered = filterFeed(next.feed, next.filters);
  assert.ok(filtered.length > 0);
  assert.ok(
    filtered.every((trade) => trade.poolCode === "PKG-03" && trade.isWin),
  );
  assert.ok(filtered.length < next.feed.length);
  assert.match(next.audit[0].detail, /PKG-03/);
});

test("stream preferences and the paused flag survive a command", () => {
  const next = applyLiveCommand(
    workspace,
    {
      kind: "savePreferences",
      autoScroll: false,
      rowFlash: false,
      density: "compact",
      soundCue: true,
    },
    now,
  );
  assert.equal(next.preferences.density, "compact");
  assert.equal(next.preferences.rowFlash, false);
  const paused = applyLiveCommand(
    next,
    { kind: "setStreamPaused", paused: true },
    now,
  );
  assert.equal(paused.preferences.streamPaused, true);
  assert.equal(paused.audit[0].action, "stream_paused");
});

test("the watchlist toggles both ways", () => {
  const removed = applyLiveCommand(
    workspace,
    { kind: "toggleWatch", symbol: "R_10" },
    now,
  );
  assert.equal(removed.watchlist.includes("R_10"), false);
  const added = applyLiveCommand(
    removed,
    { kind: "toggleWatch", symbol: "R_10" },
    now,
  );
  assert.ok(added.watchlist.includes("R_10"));
});

test("alert rules reject duplicates and cap the list", () => {
  assert.throws(
    () =>
      applyLiveCommand(
        workspace,
        {
          kind: "saveAlertRule",
          threshold: 25,
          channel: "email",
          matches: "all-pools",
        },
        now,
      ),
    /already exists/,
  );
  const next = applyLiveCommand(
    workspace,
    {
      kind: "saveAlertRule",
      threshold: 50,
      channel: "email",
      matches: "all-pools",
    },
    now,
  );
  assert.equal(next.rules[0].threshold, 50);
  assert.equal(next.rules[0].channel, "email");
});

test("exports and support drafts stay local and are listed", () => {
  const exported = applyLiveCommand(
    workspace,
    { kind: "exportFeed", scope: "trade-feed", format: "csv", count: 47 },
    now,
  );
  assert.equal(exported.exports[0].format, "csv");
  assert.equal(exported.exports[0].count, 47);
  const drafted = applyLiveCommand(
    workspace,
    {
      kind: "support",
      topic: "guardian",
      message: "Why did Bot-Charlie pause after four losses?",
    },
    now,
  );
  assert.equal(drafted.support[0].status, "local_draft");
  assert.throws(() =>
    applyLiveCommand(workspace, {
      kind: "support",
      topic: "trade",
      message: "short",
    }),
  );
});

test("commands are validated by the zod schema", () => {
  assert.throws(() =>
    applyLiveCommand(workspace, {
      kind: "pauseBot",
      botId: "x",
      minutes: 5,
      reason: "review",
    }),
  );
  assert.throws(() =>
    applyLiveCommand(workspace, {
      kind: "exportFeed",
      scope: "everything",
      format: "csv",
      count: 1,
    }),
  );
});

/* ── Formatting and selectors ── */

test("money, signed money and percentages read like the specification", () => {
  assert.equal(money(25000), "$25,000");
  assert.equal(money(8.4, 2), "$8.40");
  assert.equal(signedMoney(2610), "+$2,610");
  assert.equal(signedMoney(-10.5, 2), "−$10.50");
  assert.equal(signedMoney(0), "$0");
  assert.equal(signedPct(0.04), "+0.04%");
  assert.equal(signedPct(-0.03), "−0.03%");
  assert.equal(round2(-0.001), 0);
  assert.equal(guardianLabel("watch"), "Watch");
  assert.equal(clockOf("2026-10-18T14:23:47Z"), "14:23:47");
});

test("recomputeStats derives streaks, extremes and buckets from any feed", () => {
  const slice = workspace.feed.slice(0, 12);
  const stats = recomputeStats(slice, workspace.pools);
  assert.equal(stats.trades, 12);
  assert.equal(stats.wins + stats.losses, 12);
  assert.ok(stats.byPool.length === 2);
  assert.ok(stats.bySymbol.length >= 2);
  assert.ok(stats.best.amount >= stats.worst.amount);
  const empty = recomputeStats([], workspace.pools);
  assert.equal(empty.trades, 0);
  assert.equal(empty.winRatePct, 0);
  assert.equal(empty.best, null);
});

test("filterFeed honours pools, results, stake floor and free text", () => {
  const base = { pools: [], results: [], symbols: [], minStake: 0, query: "" };
  assert.equal(filterFeed(workspace.feed, base).length, 47);
  assert.ok(
    filterFeed(workspace.feed, { ...base, results: ["loss"] }).every(
      (trade) => !trade.isWin,
    ),
  );
  assert.ok(
    filterFeed(workspace.feed, { ...base, minStake: 50 }).every(
      (trade) => trade.stake >= 50,
    ),
  );
  assert.ok(
    filterFeed(workspace.feed, { ...base, query: "bot-alpha" }).every((trade) =>
      trade.botName.toLowerCase().includes("bot-alpha"),
    ),
  );
  assert.equal(
    filterFeed(workspace.feed, { ...base, query: "no-such-trade" }).length,
    0,
  );
});

/* ── Source wiring ── */

test("the API route is read-only and sectioned", () => {
  const route = read("src/app/api/investor/live/route.ts");
  assert.match(route, /export function GET/);
  assert.ok(!/export function POST/.test(route), "no write handler is exposed");
  for (const section of ["totals", "feed", "ticks", "stats", "bots", "alerts"])
    assert.ok(route.includes(`"${section}"`), `route exposes ${section}`);
  assert.match(route, /Cache-Control/);
});

test("the page is dynamic and the shell links the live tracker", () => {
  const page = read("src/app/investor/live/page.tsx");
  assert.match(page, /force-dynamic/);
  assert.match(page, /getLiveTradeWorkspace/);
  const shell = read("src/components/investor/investor-shell.tsx");
  assert.match(shell, /\| "live"/);
  assert.match(shell, /href: "\/investor\/live"/);
  assert.match(shell, /code: "I-5"/);
});

test("the page stylesheet is scoped, gradient-free and imported once", () => {
  const css = read("src/styles/pages/investor-live.css");
  const globals = read("src/app/globals.css");
  assert.match(globals, /styles\/pages\/investor-live\.css/);
  assert.equal(globals.split("investor-live.css").length - 1, 1);
  assert.ok(css.includes(".page-investor-live .lt-page"));
  assert.ok(!/linear-gradient|radial-gradient/i.test(css), "no gradients");
  for (const key of [
    "ltFlashWin",
    "ltFlashLoss",
    "ltSlideIn",
    "ltPulse",
    "ltBlink",
  ])
    assert.ok(css.includes(`@keyframes ${key}`), `animation ${key} exists`);
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"));
  assert.ok(css.includes("@media (max-width: 575px)"));
});

test("the page component keeps its dialogs, wizards, drawer and dock", () => {
  const component = read(
    "src/components/investor/investor-live-trade-page.tsx",
  );
  const kinds = component.match(/\| "[a-zA-Z]+"/g) ?? [];
  assert.ok(
    kinds.length >= 15,
    `at least 15 dialog kinds, found ${kinds.length}`,
  );
  const wizards = component.match(
    /wizardSteps: Partial<Record<Kind, readonly string\[\]>> = \{([\s\S]*?)\n\};/,
  );
  assert.ok(wizards, "wizard registry exists");
  assert.ok(
    (wizards[1].match(/\[/g) ?? []).length >= 6,
    "six multi-step wizards",
  );
  assert.ok(component.includes("DeskModalShell"));
  assert.ok(component.includes("op-drawer"));
  assert.match(component, /quickActions: InvestorQuickAction\[\]/);
  assert.ok((component.match(/key: "[a-z]+",/g) ?? []).length >= 4);
  assert.ok(component.includes("lt-feed__row"));
  assert.ok(component.includes("rowFlash"));
});
