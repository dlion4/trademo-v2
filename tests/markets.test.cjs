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
const { getMarketsBundle } = load("src/server/services/markets-service.ts");
const {
  applyMarketCommand: apply,
  marketSession,
  performance,
  tickStats,
  budgetFor,
  scheduleIssues,
} = load("src/lib/markets/model.ts");
const now = "2026-10-23T10:00:00.000Z",
  bundle = () => getMarketsBundle();
const input = (b, patch = {}) => ({
  symbol: "R_10",
  strategy: "Fixed stake",
  stake: 35,
  maxTrades: 8,
  duration: 5,
  unit: "ticks",
  contract: "CALL",
  pools: [b.pools[0].code],
  mode: "now",
  time: "",
  ...patch,
});
test("markets: structured reference snapshot and receipt provenance", () => {
  const b = bundle();
  assert.equal(b.symbols.length, 28);
  assert.equal(b.receipts.length, 1247);
  assert.equal(b.pools.length, 3);
  assert.equal(new Set(b.symbols.map((s) => s.code)).size, 28);
  for (const s of b.symbols) {
    assert.equal(s.ticks.length, 100);
    assert.equal(
      tickStats(s).histogram.reduce((a, b) => a + b, 0),
      100,
    );
    assert.equal(tickStats(s).digits.length, 50);
    assert.equal(tickStats(s).even + tickStats(s).odd, 100);
  }
  assert.equal(b.audit.length, 0);
});
test("markets: full progression exposure not single stake", () => {
  const b = bundle();
  for (const [strategy, expected] of [
    ["Fixed stake", 280],
    ["DCA", 280],
    ["Even/Odd", 280],
    ["Martingale", 8925],
    ["Fibonacci", 1890],
  ])
    assert.equal(budgetFor(input(b, { strategy })), expected);
});
test("markets: forex continuous UTC week and exact weekend boundary", () => {
  const s = bundle().symbols.find((s) => s.group === "Forex");
  assert.equal(marketSession(s, "2026-10-22T23:30:00Z").open, true);
  assert.equal(marketSession(s, "2026-10-23T21:59:59Z").open, true);
  const c = marketSession(s, "2026-10-23T22:00:00Z");
  assert.equal(c.open, false);
  assert.equal(c.next, "2026-10-26T00:00:00.000Z");
  assert.equal(marketSession(s, "2026-10-26T00:00:00Z").open, true);
});
test("markets: commodity weekly endpoints and continuous groups", () => {
  const b = bundle(),
    s = b.symbols.find((s) => s.group === "Commodities");
  assert.equal(marketSession(s, "2026-10-26T00:59:59Z").open, false);
  assert.equal(marketSession(s, "2026-10-26T01:00:00Z").open, true);
  assert.equal(marketSession(s, "2026-10-27T00:00:00Z").open, true);
  assert.equal(marketSession(s, "2026-10-23T23:30:00Z").open, false);
  for (const group of ["Synthetics", "Crypto"])
    assert.equal(
      marketSession(
        b.symbols.find((s) => s.group === group),
        "2026-10-25T12:00:00Z",
      ).open,
      true,
    );
});
test("markets: NY session DST and weekend next open", () => {
  const s = bundle().symbols.find((s) => s.group === "Stock Indices");
  assert.equal(marketSession(s, "2026-10-23T13:29:00Z").open, false);
  assert.equal(marketSession(s, "2026-10-23T13:30:00Z").open, true);
  assert.equal(marketSession(s, "2026-10-23T20:00:00Z").open, false);
  assert.equal(
    marketSession(s, "2026-10-30T21:00:00Z").next,
    "2026-11-02T14:30:00.000Z",
  );
  assert.equal(marketSession(s, "2026-11-02T14:29:00Z").open, false);
  assert.equal(marketSession(s, "2026-11-02T14:30:00Z").open, true);
});
test("markets: schedule contract semantics and duration gates", () => {
  const b = bundle();
  assert.deepEqual(scheduleIssues(b, input(b), now), []);
  for (const patch of [
    { strategy: "Even/Odd" },
    { duration: 11 },
    { unit: "seconds", duration: 5 },
    { stake: 0.1 },
    { maxTrades: 21 },
    { symbol: "unknown" },
    { pools: [] },
    { pools: [b.pools[0].code, b.pools[0].code] },
  ])
    assert.ok(scheduleIssues(b, input(b, patch), now).length);
  assert.deepEqual(
    scheduleIssues(
      b,
      input(b, { strategy: "Even/Odd", contract: "DIGITEVEN" }),
      now,
    ),
    [],
  );
});
test("markets: future time, closed market and sequence close guards", () => {
  const b = bundle();
  for (const time of [
    "invalid",
    "2026-10-22T12:00:00Z",
    "2026-12-01T12:00:00Z",
  ])
    assert.ok(scheduleIssues(b, input(b, { mode: "later", time }), now).length);
  assert.deepEqual(
    scheduleIssues(
      b,
      input(b, { mode: "later", time: "2026-10-24T12:00:00Z" }),
      now,
    ),
    [],
  );
  b.pools[0].symbols.push("frxEURUSD");
  assert.match(
    scheduleIssues(
      b,
      input(b, {
        symbol: "frxEURUSD",
        unit: "seconds",
        duration: 60,
        mode: "later",
        time: "2026-10-23T21:59:00Z",
      }),
      now,
    ).join(),
    /crosses/,
  );
  assert.match(
    scheduleIssues(
      b,
      input(b, {
        symbol: "frxEURUSD",
        unit: "seconds",
        duration: 60,
        mode: "later",
        time: "2026-10-24T12:00:00Z",
      }),
      now,
    ).join(),
    /closed/,
  );
});
test("markets: assignment and risk guards", () => {
  const b = bundle();
  assert.ok(scheduleIssues(b, input(b, { pools: ["unknown"] }), now).length);
  b.pools[0].guardian = false;
  assert.match(scheduleIssues(b, input(b), now).join(), /risk guard/);
  b.pools[0].guardian = true;
  b.pools[0].symbols = [];
  assert.match(scheduleIssues(b, input(b), now).join(), /not assigned/);
  assert.throws(() =>
    apply(
      bundle(),
      { kind: "risk", pool: b.pools[0].code, guardian: false, drawdown: 5 },
      now,
    ),
  );
  assert.throws(() =>
    apply(
      bundle(),
      { kind: "risk", pool: b.pools[0].code, guardian: true, drawdown: 6 },
      now,
    ),
  );
});
test("markets: reservations are atomic, cancellation releases once", () => {
  const b = bundle();
  b.pools[0].available = 300;
  const q = apply(b, { kind: "schedule", input: input(b) }, now);
  assert.equal(q.schedules[0].budget, 280);
  assert.equal(b.schedules.length, 0);
  assert.throws(
    () => apply(q, { kind: "schedule", input: input(b) }, now),
    /capital/,
  );
  assert.throws(
    () =>
      apply(
        q,
        { kind: "assign", pool: b.pools[0].code, symbols: ["R_75"] },
        now,
      ),
    /Cancel/,
  );
  const c = apply(q, { kind: "cancel", id: q.schedules[0].id }, now);
  assert.equal(c.schedules[0].state, "cancelled");
  assert.throws(() => apply(c, { kind: "cancel", id: q.schedules[0].id }, now));
  assert.equal(
    apply(c, { kind: "schedule", input: input(b) }, now).schedules[0].state,
    "queued_demo",
  );
  assert.equal(b.pools[0].available, c.pools[0].available);
});
test("markets: split reservations count all selected packages", () => {
  const b = bundle();
  b.pools[0].available = 150;
  b.pools[1].available = 150;
  const v = input(b, { pools: b.pools.slice(0, 2).map((p) => p.code) });
  assert.deepEqual(scheduleIssues(b, v, now), []);
  const q = apply(b, { kind: "schedule", input: v }, now);
  assert.match(scheduleIssues(q, v, now).join(), /capital/);
});
test("markets: immutable favorites and assignment validation", () => {
  const b = bundle(),
    json = JSON.stringify(b);
  const n = apply(b, { kind: "favorite", symbol: "R_10" }, now);
  assert.ok(!n.favorites.includes("R_10"));
  assert.equal(JSON.stringify(b), json);
  assert.throws(() => apply(b, { kind: "favorites", symbols: ["bad"] }, now));
  assert.deepEqual(
    apply(b, { kind: "favorites", symbols: ["R_10", "R_10"] }, now).favorites,
    ["R_10"],
  );
  assert.throws(() =>
    apply(b, { kind: "assign", pool: b.pools[0].code, symbols: [] }, now),
  );
  assert.throws(() =>
    apply(b, { kind: "assign", pool: b.pools[0].code, symbols: ["bad"] }, now),
  );
});
test("markets: generated ticks retain100 and strictly advance clock", () => {
  let b = bundle();
  const old = structuredClone(b.symbols[0]);
  for (let n = 0; n < 3; n++)
    b = apply(b, { kind: "ticks", symbol: old.code }, now);
  const s = b.symbols[0];
  assert.equal(s.ticks.length, 100);
  for (let n = 1; n < s.ticks.length; n++)
    assert.ok(Date.parse(s.ticks[n].time) > Date.parse(s.ticks[n - 1].time));
  assert.ok(
    Date.parse(s.ticks.at(-1).time) > Date.parse(old.ticks.at(-1).time),
  );
  assert.equal(b.audit.length, 3);
});
test("markets: observed performance totals reconcile to receipts", () => {
  const b = bundle(),
    rows = performance(b);
  const end = Date.parse(b.asOf.slice(0, 10)) + 86400000;
  const rs = b.receipts.filter(
    (r) =>
      Date.parse(r.executedAt) >= end - 30 * 86400000 &&
      Date.parse(r.executedAt) < end,
  );
  assert.equal(
    rows.reduce((n, r) => n + r.count, 0),
    rs.length,
  );
  assert.ok(
    Math.abs(
      rows.reduce((n, r) => n + r.net, 0) -
        rs.reduce((n, r) => n + r.profit, 0),
    ) < 1e-6,
  );
  assert.ok(rows.every((r) => b.symbols.some((s) => s.code === r.symbol)));
});
test("markets: runtime command validation rejects unknown and malformed commands", () => {
  const b = bundle();
  for (const c of [
    { kind: "unknown" },
    { kind: "favorite", symbol: "bad" },
    { kind: "ticks", symbol: "bad" },
    { kind: "risk", pool: b.pools[0].code, guardian: "true", drawdown: 3 },
    { kind: "schedule", input: {} },
    { kind: "cancel", id: "bad" },
  ])
    assert.throws(() => apply(b, c, now));
  assert.equal(b.revision, 0);
});

test("markets: package strategy mandate is a required gate", () => {
  const b = bundle();
  b.pools[0].strategies = ["Fibonacci"];
  assert.match(scheduleIssues(b, input(b), now).join(), /does not permit/);
});
