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
const {
  buildAnalytics,
  equityPoints,
  summarizeAnalytics,
  analyticsFilterSchema,
} = load("src/lib/analytics/model.ts");
const { initialAnalyticsFilters } = load("src/lib/analytics/types.ts");
const { getAnalyticsSource } = load("src/server/services/analytics-service.ts");
const source = getAnalyticsSource();
const bundle = buildAnalytics(source, initialAnalyticsFilters);
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.011, `${a} != ${b}`);
test("D-7 joins receipts to funded holdings with a $156k denominator", () => {
  assert.equal(bundle.summary.capital, 156000);
  source.pools.forEach((p) => {
    near(
      source.investors.reduce(
        (n, i) =>
          n +
          i.holdings
            .filter((h) => h.pool === p.code)
            .reduce((sum, h) => sum + h.capital, 0),
        0,
      ),
      p.capital,
    );
    source.trades
      .filter((t) => t.pool === p.code)
      .forEach((t) => assert.ok(t.day >= p.startsAt.slice(0, 10)));
  });
  assert.ok(bundle.summary.trades > 0);
});
test("all group and revenue totals reconcile for 30d, 7d and a selected pool", () => {
  for (const filters of [
    initialAnalyticsFilters,
    { ...initialAnalyticsFilters, from: "2026-10-15" },
    { ...initialAnalyticsFilters, pool: "PKG-02" },
  ]) {
    const b = buildAnalytics(source, filters);
    near(
      b.pools.reduce((n, p) => n + p.profit, 0),
      b.summary.profit,
    );
    near(
      b.markets.reduce((n, p) => n + p.profit, 0),
      b.summary.profit,
    );
    near(
      b.strategies.reduce((n, p) => n + p.profit, 0),
      b.summary.profit,
    );
    near(
      b.pools.reduce((n, p) => n + p.operator + p.investor, 0),
      b.summary.profit,
    );
    near(
      b.investors.reduce((n, i) => n + i.earned, 0),
      b.pools.reduce((n, p) => n + p.investor, 0),
    );
    near(b.summary.roi, (b.summary.profit / b.summary.capital) * 100);
  }
});
test("pending and modeled paid sum to positive investor profit, never a fee on loss", () => {
  bundle.pools.forEach((p) => {
    near(p.distributed + p.pending, Math.max(0, p.investor));
    assert.ok(p.distributed >= 0 && p.pending >= 0);
    if (p.profit <= 0) assert.equal(p.operator, 0);
  });
});
test("daily equity, running peaks and drawdown use an explicit window baseline", () => {
  const trades = [
    { day: "2026-10-01", profit: 10 },
    { day: "2026-10-02", profit: -20 },
    { day: "2026-10-03", profit: 15 },
  ];
  const points = equityPoints(trades, 100, [
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
  ]);
  assert.deepEqual(
    points.map((p) => p.equity),
    [110, 90, 105],
  );
  assert.deepEqual(
    points.map((p) => p.peak),
    [110, 110, 110],
  );
  near(points[1].drawdown, (-20 / 110) * 100);
  assert.deepEqual(
    points.map((p) => p.dailyReturn),
    [10, -20, 15],
  );
});
test("risk ratios handle undefined loss denominators, insufficient data and sample volatility", () => {
  const trades = [
    { day: "2026-10-01", profit: 10, isWin: true, durationSeconds: 10 },
  ];
  const one = equityPoints(trades, 100, ["2026-10-01"]);
  const summary = summarizeAnalytics(trades, 100, one);
  assert.equal(summary.profitFactor, null);
  assert.equal(summary.sharpe, null);
  const points = equityPoints(
    [
      { day: "2026-10-01", profit: 10 },
      { day: "2026-10-02", profit: -10 },
    ],
    100,
    ["2026-10-01", "2026-10-02"],
  );
  assert.equal(summarizeAnalytics([], 100, points).sharpe, 0);
});
test("empty historical range returns zero-safe metrics and no fabricated returns", () => {
  const b = buildAnalytics(source, {
    from: "2020-01-01",
    to: "2020-01-02",
    pool: "all",
  });
  assert.equal(b.summary.trades, 0);
  assert.equal(b.summary.profit, 0);
  assert.equal(b.summary.sharpe, null);
  assert.equal(b.summary.maxDrawdown, 0);
  assert.ok(
    b.comparison.every((r) => Object.values(r.values).every((v) => v === null)),
  );
});
test("normalized comparison respects mandate lengths and does not pad future days with zeros", () => {
  bundle.pools.forEach((p) => {
    bundle.comparison.forEach((r) => {
      const date = new Date(Date.parse(p.startsAt) + (r.day - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
      if (r.day > p.days || date > source.asOf.slice(0, 10))
        assert.equal(r.values[p.code], null);
      else {
        const observed = p.points.find((pt) => pt.day === date);
        if (observed) near(r.values[p.code], observed.dailyReturn);
      }
    });
  });
});
test("invalid ranges, package IDs and ranges beyond the snapshot reject", () => {
  assert.equal(
    analyticsFilterSchema.safeParse({
      from: "2026-11-01",
      to: "2026-10-01",
      pool: "all",
    }).success,
    false,
  );
  assert.equal(
    analyticsFilterSchema.safeParse({
      ...initialAnalyticsFilters,
      pool: "UNKNOWN",
    }).success,
    false,
  );
  assert.throws(() =>
    buildAnalytics(source, { ...initialAnalyticsFilters, to: "2026-10-22" }),
  );
  assert.throws(() =>
    buildAnalytics(source, {
      from: "2020-01-01",
      to: "2026-10-21",
      pool: "all",
    }),
  );
});
test("negative investor allocations and largest remainder cents reconcile exactly", () => {
  const modified = {
    ...source,
    trades: source.trades.map((t) => ({
      ...t,
      profit: -Math.abs(t.profit),
      isWin: false,
    })),
  };
  const b = buildAnalytics(modified, initialAnalyticsFilters);
  assert.ok(b.summary.profit < 0);
  assert.equal(
    b.pools.reduce((n, p) => n + p.operator, 0),
    0,
  );
  near(
    b.investors.reduce((n, i) => n + i.earned, 0),
    b.summary.profit,
  );
});
test("unrecovered troughs remain null and full recovery is measured in daily observations", () => {
  const pool = {
    ...source.pools[0],
    capital: 100,
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2026-10-05T00:00:00Z",
    days: 4,
  };
  const create = (day, profit) => ({
    id: day,
    day,
    pool: "PKG-01",
    symbol: "R_10",
    strategy: "Fixed Stake",
    stake: 35,
    profit,
    durationSeconds: 10,
    isWin: profit > 0,
  });
  const fixture = {
    mode: "demo",
    asOf: "2026-10-04T14:00:00Z",
    pools: [pool],
    investors: [
      {
        id: "i",
        name: "Demo",
        lastActive: "2026-10-04T12:00:00Z",
        holdings: [{ pool: "PKG-01", capital: 100 }],
      },
    ],
    guardian: [],
    trades: [
      create("2026-10-01", 10),
      create("2026-10-02", -20),
      create("2026-10-03", 5),
    ],
  };
  const f = { from: "2026-10-01", to: "2026-10-04", pool: "all" };
  assert.equal(buildAnalytics(fixture, f).pools[0].recoveryDays, null);
  assert.equal(
    buildAnalytics(
      { ...fixture, trades: [...fixture.trades, create("2026-10-04", 20)] },
      f,
    ).pools[0].recoveryDays,
    2,
  );
});
