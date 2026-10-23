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
const { getAuditLogsBundle } = load("src/server/services/logs-service.ts");
const {
  applyLogCommand: apply,
  assertLogs,
  defaultLogFilters,
  filterLogs,
  streamPage,
  exportRows,
  logSummary,
  taxSummary,
  eventsCSV,
} = load("src/lib/logs/model.ts");
const seed = getAuditLogsBundle(),
  now = "2026-10-23T12:00:00Z",
  reason =
    "Reviewed the synthetic operational evidence and explicit workflow scope.";
const run = (s, c) => apply(s, { reason, ...c }, now);
const filter = defaultLogFilters(seed.asOf),
  auth = seed.events.find((e) => e.category === "auth"),
  webhook = seed.events.find((e) => e.systemKind === "webhook_failure");
test("D12 fixture is deterministic, valid and joins source modules without financial mutation", () => {
  assert.deepEqual(seed, getAuditLogsBundle());
  assertLogs(seed);
  assert.equal(seed.financialReceipts.length, 1247);
  assert.equal(seed.investors.length, 38);
  assert.equal(seed.api.length, 150);
  assert.ok(seed.events.length > 1000);
  assert.equal(seed.events.filter((e) => e.category === "trade").length, 1247);
  assert.ok(seed.events.every((e) => e.source === "seeded"));
});
test("stream uses stable descending timestamp/ID order and real 100-event pages, capped at 1000", () => {
  const first = streamPage(seed, filter, 0),
    second = streamPage(seed, filter, 1);
  assert.equal(first.items.length, 100);
  assert.equal(first.total, 1000);
  assert.equal(first.next, 1);
  assert.equal(
    new Set([...first.items, ...second.items].map((e) => e.id)).size,
    200,
  );
  assert.equal(streamPage(seed, filter, 9).next, undefined);
  assert.equal(streamPage(seed, filter, 10).items.length, 0);
  const order = filterLogs(seed, filter);
  assert.ok(order.every((e, i) => !i || order[i - 1].createdAt >= e.createdAt));
});
test("search/category/severity/actor/inclusive UTC range filters select exact evidence", () => {
  const rows = filterLogs(seed, {
    ...filter,
    category: "auth",
    severity: "critical",
  });
  assert.ok(rows.length > 0);
  assert.ok(
    rows.every((e) => e.category === "auth" && e.severity === "critical"),
  );
  const e = seed.events[0];
  assert.equal(
    filterLogs(seed, { ...filter, search: e.id }).some((x) => x.id === e.id),
    true,
  );
  assert.ok(
    filterLogs(seed, { ...filter, actor: auth.actorId }).every(
      (e) => e.actorId === auth.actorId,
    ),
  );
  assert.throws(() => filterLogs(seed, { ...filter, from: "2026-11-01" }));
  assert.throws(() => filterLogs(seed, { ...filter, to: "invalid" }));
});
test("export scopes cover all matching rows, limit 30 inclusive days and reject >10k records", () => {
  assert.equal(
    exportRows(seed, filter).length,
    filterLogs(seed, filter).length,
  );
  assert.ok(exportRows(seed, filter).length > 1000);
  assert.throws(
    () => exportRows(seed, { ...filter, from: "2026-09-23" }),
    /30 inclusive/,
  );
  const many = structuredClone(seed);
  many.events = Array.from({ length: 10001 }, (_, i) => ({
    ...seed.events[0],
    id: "extra_" + i,
  }));
  assert.throws(() => exportRows(many, filter), /10,000/);
});
test("acknowledgement appends a separate decision and immutable local audit event", () => {
  const before = JSON.stringify(seed.events);
  const s = run(seed, { kind: "review", id: auth.id, action: "acknowledged" });
  assert.equal(s.reviews[0].status, "acknowledged");
  assert.equal(s.events.length, seed.events.length + 1);
  assert.equal(s.events[0].source, "local_demo");
  assert.equal(s.events[0].category, "audit");
  assert.deepEqual(s.events.slice(1), seed.events);
  assert.equal(JSON.stringify(seed.events), before);
  assert.equal(s.events[0].investorId, auth.investorId);
  assert.equal(s.events[0].correlationId, auth.correlationId);
  assert.throws(
    () => run(s, { kind: "review", id: auth.id, action: "acknowledged" }),
    /already/,
  );
});
test("review escalation/resolution requires explicit sequence and retains all reviewer notes", () => {
  assert.throws(
    () => run(seed, { kind: "review", id: auth.id, action: "resolved" }),
    /Escalate/,
  );
  let s = run(seed, { kind: "review", id: auth.id, action: "escalated" });
  s = run(s, { kind: "review", id: auth.id, action: "note" });
  s = run(s, { kind: "review", id: auth.id, action: "resolved" });
  assert.equal(s.reviews[0].status, "resolved");
  assert.equal(s.reviews[0].notes.length, 3);
  assert.throws(
    () => run(s, { kind: "review", id: auth.id, action: "escalated" }),
    /reopened/,
  );
});
test("initial reviewer note opens an acknowledged review without modifying source", () => {
  const s = run(seed, { kind: "review", id: auth.id, action: "note" });
  assert.equal(s.reviews[0].status, "acknowledged");
  assert.deepEqual(
    s.events.find((e) => e.id === auth.id),
    auth,
  );
});
test("retry enforces webhook attribution, single queued attempt, three-attempt ceiling", () => {
  assert.throws(
    () => run(seed, { kind: "retry", id: auth.id }),
    /Only failed webhook/,
  );
  let s = seed;
  for (let i = 1; i <= 3; i++) {
    s = run(s, { kind: "retry", id: webhook.id });
    const r = s.retries.at(-1);
    assert.equal(r.attempt, i);
    assert.throws(
      () => run(s, { kind: "retry", id: webhook.id }),
      /active or successful/,
    );
    s = run(s, { kind: "retryOutcome", id: r.id, state: "failed_demo" });
  }
  assert.throws(() => run(s, { kind: "retry", id: webhook.id }), /limit/);
  assert.deepEqual(
    s.events.find((e) => e.id === webhook.id),
    webhook,
  );
});
test("successful synthetic retry cannot be replayed or assigned a second outcome", () => {
  let s = run(seed, { kind: "retry", id: webhook.id });
  const r = s.retries[0];
  s = run(s, { kind: "retryOutcome", id: r.id, state: "succeeded_demo" });
  assert.throws(
    () => run(s, { kind: "retry", id: webhook.id }),
    /active or successful/,
  );
  assert.throws(
    () => run(s, { kind: "retryOutcome", id: r.id, state: "failed_demo" }),
    /queued/,
  );
  assert.equal(s.events[0].metadata.externalRequest, false);
});
test("session revocation only marks local inventory, preserves original auth observations", () => {
  const session = seed.sessions[0],
    s = run(seed, { kind: "session", id: session.id });
  assert.equal(s.sessions[0].state, "revoked_demo");
  assert.equal(seed.sessions[0].state, "active");
  assert.deepEqual(
    s.events.filter((e) => e.category === "auth"),
    seed.events.filter((e) => e.category === "auth"),
  );
  assert.throws(
    () => run(s, { kind: "session", id: session.id }),
    /already revoked/,
  );
});
test("retention floors and preserved source observations prevent silent shortening/purging", () => {
  for (const p of [
    { financialYears: 6 },
    { authYears: 0 },
    { systemDays: 89 },
    { auditYears: 6 },
  ])
    assert.throws(() =>
      run(seed, { kind: "retention", policy: { ...seed.retention, ...p } }),
    );
  const s = run(seed, {
    kind: "retention",
    policy: { ...seed.retention, systemDays: 365 },
  });
  assert.equal(s.retention.systemDays, 365);
  assert.deepEqual(s.events.slice(1), seed.events);
});
test("preservation holds block duplicates and require an active hold for release", () => {
  let s = run(seed, { kind: "hold", category: "trade" });
  const h = s.holds[0];
  assert.equal(h.active, true);
  assert.throws(() => run(s, { kind: "hold", category: "trade" }), /already/);
  s = run(s, { kind: "releaseHold", id: h.id });
  assert.equal(s.holds[0].active, false);
  assert.throws(() => run(s, { kind: "releaseHold", id: h.id }), /Active hold/);
  assert.equal(s.events.length, seed.events.length + 2);
});
test("archive is an exact manifest copy, never deletion or a legal hold release", () => {
  let s = run(seed, { kind: "hold", category: "all" });
  const expected = exportRows(s, filter).map((e) => e.id);
  const original = s.events;
  s = run(s, { kind: "archive", filters: filter });
  assert.deepEqual(s.archives[0].eventIds, expected);
  assert.equal(s.archives[0].state, "manifest_only");
  assert.equal(s.events.length, original.length + 1);
  assert.equal(s.holds[0].active, true);
  assert.throws(
    () =>
      run(s, {
        kind: "archive",
        filters: { ...filter, search: "not-present-anywhere" },
      }),
    /No events/,
  );
});
test("saved views validate names/filter scope and are independent of later caller edits", () => {
  const scoped = { ...filter, category: "auth" };
  let s = run(seed, { kind: "view", name: "Security review", filters: scoped });
  scoped.category = "system";
  assert.equal(s.views[0].filters.category, "auth");
  assert.throws(
    () => run(s, { kind: "view", name: "SECURITY REVIEW", filters: filter }),
    /already/,
  );
  assert.throws(() => run(s, { kind: "view", name: "x", filters: filter }));
});
test("cron dry run is explicit, one request per execution, and never a real job", () => {
  const cron = seed.events.find((e) => e.systemKind === "cron");
  const s = run(seed, { kind: "job", id: cron.id });
  assert.equal(s.events[0].action, "job_dry_run");
  assert.equal(s.events[0].metadata.externalRequest, false);
  assert.throws(() => run(s, { kind: "job", id: cron.id }), /already/);
  assert.throws(() => run(seed, { kind: "job", id: auth.id }), /cron/);
});
test("synthetic feed observation cannot mutate financial receipts or source session state", () => {
  const s = run(seed, { kind: "simulate", category: "trade" });
  assert.equal(s.events[0].source, "local_demo");
  assert.equal(s.events[0].action, "synthetic_observation");
  assert.deepEqual(s.financialReceipts, seed.financialReceipts);
  assert.deepEqual(s.sessions, seed.sessions);
  assert.deepEqual(taxSummary(s, 2026), taxSummary(seed, 2026));
});
test("report-preparation event stores declared canonical payload digest and record count", () => {
  const s = run(seed, {
    kind: "report",
    reportType: "json",
    recordCount: 25,
    digest: "a".repeat(64),
  });
  assert.equal(s.events[0].action, "report_artifact_prepared");
  assert.equal(s.events[0].metadata.digest, "a".repeat(64));
  assert.equal(s.events[0].metadata.recordCount, 25);
  assert.throws(() =>
    run(seed, {
      kind: "report",
      reportType: "json",
      recordCount: 1,
      digest: "not-a-hash",
    }),
  );
});
test("accountant worksheet reconciles actual trade profits and does not invent fees or tax due", () => {
  const tax = taxSummary(seed, 2026);
  assert.equal(tax.count, 1247);
  assert.ok(Math.abs(tax.gains + tax.losses - tax.net) < 0.001);
  assert.ok(
    Math.abs(tax.months.reduce((n, m) => n + m.net, 0) - tax.net) < 0.001,
  );
  assert.equal(tax.fees, null);
  assert.equal(tax.taxDue, null);
  assert.equal(taxSummary(seed, 2025).count, 0);
  assert.throws(() => taxSummary(seed, 2027));
  assert.throws(() => taxSummary(seed, 2026.5));
});
test("category summaries reconcile counts; empty scopes have true zero observations", () => {
  const rows = filterLogs(seed, filter),
    m = logSummary(rows);
  assert.equal(m.total, rows.length);
  assert.equal(
    m.byCategory.reduce((n, c) => n + c.count, 0),
    m.total,
  );
  assert.equal(logSummary([]).critical, 0);
  assert.equal(logSummary([]).actors, 0);
});
test("CSV formula protection and minimized presentation omit actor names and details", () => {
  const e = structuredClone(auth);
  e.actorName = ' \t=HYPERLINK("x")';
  e.details = "Sensitive synthetic review text";
  const full = eventsCSV([e]);
  assert.match(full, /' \t=HYPERLINK/);
  assert.match(full, /""x""/);
  const minimized = eventsCSV([e], true);
  assert.ok(!minimized.includes("HYPERLINK"));
  assert.ok(!minimized.includes(e.details));
  assert.match(minimized, /Omitted in minimized export/);
});
test("unknown commands, invalid IDs/reasons and forged duplicate identities fail atomically", () => {
  const before = JSON.stringify(seed);
  assert.throws(() => run(seed, { kind: "delete" }));
  assert.throws(() =>
    run(seed, { kind: "review", id: "missing", action: "acknowledged" }),
  );
  assert.throws(() =>
    apply(seed, { kind: "hold", category: "all", reason: "short" }, now),
  );
  const bad = structuredClone(seed);
  bad.events.push({ ...bad.events[0] });
  assert.throws(() => assertLogs(bad), /Duplicate/);
  assert.equal(JSON.stringify(seed), before);
});
