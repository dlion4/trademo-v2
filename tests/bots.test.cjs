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
const { getBotsWorkspace, defaultBotConfig } = load(
  "src/server/services/bots-service.ts",
);
const {
  applyBotCommand: apply,
  configIssues,
  sequenceExposure,
  botStats,
  evaluateRule,
  paramsDefaults,
} = load("src/lib/bots/model.ts");
const now = "2026-10-23T10:00:00Z",
  after = "2026-10-23T10:05:00Z",
  bundle = () => getBotsWorkspace();
test("bots: structured snapshot reconciles all historical receipts", () => {
  const s = bundle();
  assert.equal(s.bots.length, 5);
  assert.equal(s.receipts.length, 1247);
  assert.equal(
    s.bots.reduce((n, b) => n + botStats(s, b.id).count, 0),
    s.receipts.length,
  );
  assert.ok(
    Math.abs(
      s.bots.reduce((n, b) => n + botStats(s, b.id).net, 0) -
        s.receipts.reduce((n, r) => n + r.profit, 0),
    ) < 1e-6,
  );
  for (const b of s.bots)
    assert.deepEqual(
      configIssues(s, b.id, b.config, ["running", "paused"].includes(b.status)),
      [],
    );
  assert.equal(botStats(s, "bot_5").count, 0);
});
test("bots: lifecycle transitions are validated and immutable", () => {
  const s = bundle(),
    json = JSON.stringify(s),
    p = apply(s, { kind: "control", id: "bot_1", action: "pause" }, now);
  assert.equal(p.bots[0].status, "paused");
  assert.equal(JSON.stringify(s), json);
  assert.throws(() =>
    apply(p, { kind: "control", id: "bot_1", action: "pause" }, now),
  );
  const stop = apply(p, { kind: "control", id: "bot_1", action: "stop" }, now);
  assert.equal(
    apply(stop, { kind: "control", id: "bot_1", action: "restart" }, now)
      .bots[0].status,
    "running",
  );
  assert.equal(stop.receipts.length, s.receipts.length);
});
test("bots: cooldown cannot be bypassed by stop or restart", () => {
  const s = bundle();
  for (const action of ["start", "restart"])
    assert.throws(
      () => apply(s, { kind: "control", id: "bot_3", action }, now),
      /Cooldown/,
    );
  assert.throws(
    () => apply(s, { kind: "dryRun", id: "bot_3" }, now),
    /Cooldown/,
  );
  const stop = apply(s, { kind: "control", id: "bot_3", action: "stop" }, now);
  assert.throws(
    () => apply(stop, { kind: "control", id: "bot_3", action: "restart" }, now),
    /Cooldown/,
  );
  assert.equal(
    apply(s, { kind: "control", id: "bot_3", action: "start" }, after).bots[2]
      .status,
    "running",
  );
});
test("bots: allocation total, uniqueness and unknown pool gates", () => {
  const s = bundle(),
    c = defaultBotConfig();
  for (const allocations of [
    [],
    [{ pool: "PKG-01", percent: 50 }],
    [{ pool: "bad", percent: 100 }],
    [
      { pool: "PKG-01", percent: 50 },
      { pool: "PKG-01", percent: 50 },
    ],
  ])
    assert.ok(configIssues(s, "bot_5", { ...c, allocations }, true).length);
  assert.throws(
    () => apply(s, { kind: "control", id: "bot_5", action: "start" }, now),
    /100%|Assign/,
  );
});
test("bots: active reservations block overcommit and stopping releases them", () => {
  const s = bundle();
  s.pools[0].available = 1000;
  const c = {
    ...defaultBotConfig(),
    capitalBudget: 600,
    allocations: [{ pool: "PKG-01", percent: 100 }],
  };
  assert.match(configIssues(s, "bot_5", c, true).join(), /unreserved/);
  const stopped = apply(
    s,
    { kind: "control", id: "bot_1", action: "stop" },
    now,
  );
  assert.deepEqual(configIssues(stopped, "bot_5", c, true), []);
});
test("bots: config writes require paused/stopped state and revalidate policy", () => {
  const s = bundle(),
    c = defaultBotConfig();
  assert.throws(
    () => apply(s, { kind: "config", id: "bot_1", config: c }, now),
    /Pause/,
  );
  const paused = apply(
    s,
    { kind: "control", id: "bot_1", action: "pause" },
    now,
  );
  assert.equal(
    apply(
      paused,
      { kind: "config", id: "bot_1", config: { ...c, maxDailyTrades: 80 } },
      now,
    ).bots[0].config.maxDailyTrades,
    80,
  );
  for (const patch of [
    { initialStake: 101 },
    { currentStake: 101 },
    { maxDailyLoss: 301 },
    { maxStake: 250 },
    { duration: 11 },
    { unit: "seconds", duration: 5 },
    { guardian: false },
    { drawdown: 6 },
    { lossThreshold: 11 },
    { maxConcurrent: 3 },
    { capitalBudget: 100 },
  ])
    assert.ok(configIssues(s, "bot_1", { ...c, ...patch }).length);
});
test("bots: strategy parameters and digit contracts are semantic gates", () => {
  const s = bundle(),
    c = defaultBotConfig();
  for (const params of [
    { multiplier: 5, maxSteps: 5, resetOnWin: true },
    { multiplier: 2, maxSteps: 100, resetOnWin: true },
    {},
    null,
  ])
    assert.ok(configIssues(s, "bot_1", { ...c, params }).length);
  assert.ok(
    configIssues(s, "bot_1", {
      ...c,
      strategy: "Even/Odd",
      params: paramsDefaults["Even/Odd"],
    }).length,
  );
  assert.ok(
    configIssues(s, "bot_1", {
      ...c,
      strategy: "DCA",
      params: { stakeSchedule: "invalid" },
    }).length,
  );
  assert.ok(
    configIssues(s, "bot_1", {
      ...c,
      strategy: "DCA",
      params: { stakeSchedule: [150] },
    }).length,
  );
});
test("bots: full bounded progression includes concurrency", () => {
  const c = defaultBotConfig();
  assert.equal(sequenceExposure(c), 408.5);
  assert.equal(
    sequenceExposure({ ...c, strategy: "Fibonacci", params: { maxSteps: 5 } }),
    35 + 35 + 70 + 100 + 100,
  );
  assert.equal(
    sequenceExposure({
      ...c,
      strategy: "DCA",
      params: { stakeSchedule: [35, 35, 70, 100] },
    }),
    240,
  );
  assert.ok(
    configIssues(bundle(), "bot_1", {
      ...c,
      capitalBudget: 600,
      maxConcurrent: 2,
    }).some((x) => x.includes("full modeled")),
  );
});
test("bots: global Guardian cannot loosen hard caps or invalidate active bots", () => {
  const s = bundle();
  assert.throws(() =>
    apply(s, { kind: "guardian", value: { ...s.guardian, drawdown: 6 } }, now),
  );
  assert.throws(() =>
    apply(
      s,
      { kind: "guardian", value: { ...s.guardian, enabled: false } },
      now,
    ),
  );
  assert.throws(
    () =>
      apply(
        s,
        { kind: "guardian", value: { ...s.guardian, drawdown: 4 } },
        now,
      ),
    /Align/,
  );
  const halted = apply(s, { kind: "halt" }, now);
  const updated = apply(
    halted,
    { kind: "guardian", value: { ...s.guardian, drawdown: 4 } },
    now,
  );
  assert.equal(updated.guardian.drawdown, 4);
  assert.throws(
    () =>
      apply(updated, { kind: "control", id: "bot_1", action: "restart" }, now),
    /global Guardian/,
  );
});
test("bots: create is idle, unique and policy validated", () => {
  const s = bundle(),
    cmd = { kind: "create", name: "Bot-Foxtrot", config: defaultBotConfig() };
  const n = apply(s, cmd, now);
  assert.equal(n.bots.at(-1).status, "idle");
  assert.equal(n.bots.at(-1).runtimeMinutes, 0);
  assert.throws(() => apply(n, cmd, now), /already/);
  assert.throws(() => apply(s, { ...cmd, name: "x" }, now));
});
test("bots: removal blocks active bots and referencing rules", () => {
  const s = bundle();
  assert.throws(
    () => apply(s, { kind: "deleteBot", id: "bot_1" }, now),
    /Stop/,
  );
  let n = apply(s, { kind: "control", id: "bot_1", action: "stop" }, now);
  assert.throws(
    () => apply(n, { kind: "deleteBot", id: "bot_1" }, now),
    /retarget/,
  );
  n = apply(n, { kind: "deleteRule", id: "rule_losses" }, now);
  n = apply(n, { kind: "deleteBot", id: "bot_1" }, now);
  assert.equal(n.bots.length, 4);
  assert.equal(n.receipts.length, s.receipts.length);
});
test("bots: automation CRUD and human financial review gates", () => {
  const s = bundle(),
    value = { ...s.rules[0], name: "New safeguard" };
  let n = apply(s, { kind: "rule", id: null, value }, now);
  assert.equal(n.rules.length, 6);
  assert.equal(n.rules[0].triggerCount, 0);
  const id = n.rules[0].id;
  n = apply(n, { kind: "toggleRule", id }, now);
  assert.equal(n.rules[0].enabled, false);
  n = apply(n, { kind: "rule", id, value: { ...value, name: "Changed" } }, now);
  assert.equal(n.rules[0].name, "Changed");
  n = apply(n, { kind: "deleteRule", id }, now);
  assert.equal(n.rules.length, 5);
  for (const patch of [
    { metric: "deposit", action: "pause_all" },
    { metric: "package_completed", action: "notify_operator" },
    { metric: "weekday_time", action: "pause_bot" },
    { botId: "bad" },
  ])
    assert.throws(() =>
      apply(s, { kind: "rule", id: null, value: { ...value, ...patch } }, now),
    );
});
test("bots: rule scenarios never execute or mutate counters", () => {
  const s = bundle(),
    json = JSON.stringify(s),
    r = s.rules[0];
  assert.equal(evaluateRule(r, 3, "17:00", true).matches, true);
  assert.equal(evaluateRule(r, 2, "17:00", true).matches, false);
  assert.equal(
    evaluateRule({ ...r, enabled: false }, 4, "17:00", true).matches,
    false,
  );
  assert.equal(evaluateRule(s.rules[3], 0, "17:00", false).matches, false);
  assert.equal(evaluateRule(s.rules[3], 0, "17:00", true).matches, true);
  assert.equal(JSON.stringify(s), json);
});
test("bots: source storage never executes JavaScript", () => {
  const s = bundle();
  const code = "globalThis.__neverExecuted = true; throw Error('never run');";
  delete globalThis.__neverExecuted;
  const n = apply(
    s,
    { kind: "script", id: null, name: "Review-Only.js", code },
    now,
  );
  assert.equal(n.scripts[0].code, code);
  assert.equal(globalThis.__neverExecuted, undefined);
  assert.equal(n.scripts[0].runs, 0);
  assert.throws(() =>
    apply(n, { kind: "script", id: null, name: "Review-Only.js", code }, now),
  );
  assert.throws(() =>
    apply(s, { kind: "script", id: null, name: "bad.txt", code }, now),
  );
});
test("bots: attachment and source update/delete dependency gates", () => {
  const s = bundle();
  assert.throws(
    () => apply(s, { kind: "attach", id: "script_even", botId: "bot_1" }, now),
    /Stop/,
  );
  let n = apply(s, { kind: "attach", id: "script_even", botId: "bot_5" }, now);
  assert.equal(n.bots[4].config.strategy, "Custom script");
  assert.throws(
    () => apply(n, { kind: "deleteScript", id: "script_even" }, now),
    /Detach/,
  );
  const config = {
    ...n.bots[4].config,
    strategy: "Fibonacci",
    params: { maxSteps: 5 },
    scriptId: null,
  };
  n = apply(n, { kind: "config", id: "bot_5", config }, now);
  n = apply(n, { kind: "deleteScript", id: "script_even" }, now);
  assert.equal(n.scripts.length, 2);
});
test("bots: editing source used by an active bot is blocked", () => {
  let s = bundle();
  s = apply(s, { kind: "control", id: "bot_1", action: "stop" }, now);
  s = apply(s, { kind: "attach", id: "script_even", botId: "bot_1" }, now);
  s = apply(s, { kind: "control", id: "bot_1", action: "start" }, now);
  assert.throws(
    () =>
      apply(
        s,
        {
          kind: "script",
          id: "script_even",
          name: "Even-Odd-Anti.js",
          code: s.scripts[1].code,
        },
        now,
      ),
    /Stop/,
  );
});
test("bots: duplicate script resets historical counters and export source stays intact", () => {
  const s = bundle(),
    n = apply(s, { kind: "duplicateScript", id: "script_martingale" }, now);
  assert.equal(n.scripts[0].runs, 0);
  assert.equal(n.scripts[0].wins, 0);
  assert.equal(n.scripts[0].code, s.scripts[0].code);
  assert.notEqual(n.scripts[0].name, s.scripts[0].name);
});
test("bots: dry run records only a plan, not receipts or strategy runs", () => {
  const s = bundle(),
    n = apply(s, { kind: "dryRun", id: "bot_1" }, now);
  assert.equal(n.dryRuns[0].result, "plan_only");
  assert.deepEqual(n.receipts, s.receipts);
  assert.deepEqual(n.scripts, s.scripts);
  assert.deepEqual(n.bots, s.bots);
});
test("bots: notifications and preferences are local, required alerts cannot be disabled", () => {
  const s = bundle();
  assert.equal(
    apply(s, { kind: "read", id: null }, now).notifications.filter(
      (n) => !n.read,
    ).length,
    0,
  );
  assert.equal(
    apply(
      s,
      { kind: "read", id: s.notifications[0].id },
      now,
    ).notifications.filter((n) => !n.read).length,
    2,
  );
  assert.throws(() => apply(s, { kind: "read", id: "bad" }, now));
  assert.throws(() =>
    apply(
      s,
      { kind: "preferences", value: { ...s.preferences, guardian: false } },
      now,
    ),
  );
  assert.equal(
    apply(
      s,
      { kind: "preferences", value: { ...s.preferences, telegram: true } },
      now,
    ).preferences.telegram,
    true,
  );
});
test("bots: emergency halt retains receipts, cooldown and source triggers", () => {
  const s = bundle(),
    n = apply(s, { kind: "halt" }, now);
  assert.equal(
    n.bots.filter((b) => ["running", "paused"].includes(b.status)).length,
    0,
  );
  assert.deepEqual(n.receipts, s.receipts);
  assert.deepEqual(n.triggers, s.triggers);
  assert.equal(n.bots[2].cooldownUntil, s.bots[2].cooldownUntil);
});
test("bots: runtime command validation rejects unknown targets and shapes atomically", () => {
  const s = bundle(),
    json = JSON.stringify(s);
  for (const c of [
    { kind: "unknown" },
    { kind: "control", id: "bad", action: "stop" },
    { kind: "rule", id: "bad", value: s.rules[0] },
    { kind: "script", id: "bad", name: "Example.js", code: s.scripts[0].code },
    { kind: "deleteScript", id: "bad" },
    {
      kind: "config",
      id: "bot_5",
      config: {
        ...defaultBotConfig(),
        strategy: "Custom script",
        scriptId: "bad",
        params: { maxSteps: 1 },
      },
    },
  ])
    assert.throws(() => apply(s, c, now));
  assert.equal(JSON.stringify(s), json);
});
