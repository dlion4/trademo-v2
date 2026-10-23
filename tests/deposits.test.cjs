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
const { getDepositLogsBundle } = load(
  "src/server/services/deposits-service.ts",
);
const {
  applyDepositCommand: apply,
  assertDeposits,
  blockers,
  summary,
  filterDeposits,
  methodBreakdown,
  timeline,
  depositCSV,
} = load("src/lib/deposits/model.ts");
const seed = getDepositLogsBundle(),
  now = "2026-10-23T12:00:00Z",
  notes = "Reviewed the synthetic provider and payment reference evidence.";
const run = (s, c) => apply(s, { notes, ...c }, now);
const eligible = seed.deposits.filter((d) => !blockers(d, seed.rules).length);
const total = (s) =>
  s.deposits.filter((d) => d.credited).reduce((n, d) => n + d.amount, 0);
test("D11 deterministic fixture has 104 complete records and conserved opening credits", () => {
  assert.equal(seed.deposits.length, 104);
  assert.equal(seed.investors.length, 38);
  assert.deepEqual(seed, getDepositLogsBundle());
  assertDeposits(seed);
  assert.equal(total(seed), seed.openingCredit);
  assert.ok(eligible.length > 0);
  assert.equal(new Set(seed.deposits.map((d) => d.reference)).size, 104);
});
test("verification credits an eligible claim exactly once and appends reviewer evidence", () => {
  const d = eligible[0],
    s = run(seed, { kind: "verify", ids: [d.id] });
  const updated = s.deposits.find((x) => x.id === d.id);
  assert.equal(updated.status, "verified");
  assert.equal(updated.verifiedBy, "local_operator");
  assert.equal(s.localCredit, d.amount);
  assert.equal(total(s), total(seed) + d.amount);
  assert.throws(
    () => run(s, { kind: "verify", ids: [d.id] }),
    /not awaiting|Already credited/,
  );
  assert.equal(seed.revision, 0);
});
test("batch validation is atomic, deduplicates selected IDs and rejects blocked rows", () => {
  const good = eligible[0],
    bad = seed.deposits.find(
      (d) =>
        ["pending", "submitted"].includes(d.status) &&
        blockers(d, seed.rules).length,
    );
  const before = JSON.stringify(seed);
  assert.throws(() => run(seed, { kind: "verify", ids: [good.id, bad.id] }));
  assert.equal(JSON.stringify(seed), before);
  const s = run(seed, { kind: "verify", ids: [good.id, good.id] });
  assert.equal(s.localCredit, good.amount);
});
test("all verification gates independently block approval", () => {
  const d = eligible[0];
  for (const patch of [
    { kycVerified: false },
    { proof: null },
    { credited: true },
    { provider: { ...d.provider, outcome: "unknown" } },
    { provider: { ...d.provider, amount: d.amount - 0.01 } },
    { method: "crypto_usdt", provider: { ...d.provider, confirmations: 5 } },
    { method: "card", provider: { ...d.provider, webhookVerified: false } },
  ])
    assert.ok(blockers({ ...d, ...patch }, seed.rules).length);
});
test("known settlement cannot be rejected, unresolved unsettled claim can", () => {
  assert.throws(
    () => run(seed, { kind: "reject", id: eligible[0].id }),
    /settled/,
  );
  const d = seed.deposits.find(
    (d) =>
      ["submitted", "pending", "information_requested"].includes(d.status) &&
      d.provider.outcome !== "settled",
  );
  const s = run(seed, { kind: "reject", id: d.id });
  assert.equal(s.deposits.find((x) => x.id === d.id).status, "rejected");
  assert.equal(s.localCredit, 0);
});
test("proof requests are local drafts with no payment state or wallet effect", () => {
  const d = seed.deposits[0],
    s = run(seed, { kind: "proof", id: d.id });
  assert.equal(s.deposits[0].status, "information_requested");
  assert.match(s.deposits[0].notes.at(-1), /not sent/);
  assert.equal(s.localCredit, 0);
  assert.deepEqual(s.deposits[0].provider, d.provider);
});
test("retry retains identity/reference, increments attempts, and requires unresolved failed payment", () => {
  const d = seed.deposits.find((d) => d.status === "failed"),
    s = run(seed, { kind: "retry", id: d.id }),
    u = s.deposits.find((x) => x.id === d.id);
  assert.equal(u.status, "pending");
  assert.equal(u.reference, d.reference);
  assert.equal(u.attempts, 2);
  assert.equal(u.provider.outcome, "unknown");
  assert.equal(s.localCredit, 0);
  assert.throws(() => run(s, { kind: "retry", id: d.id }), /Only a failed/);
});
test("refund reverses exactly the recorded credit and cannot execute twice", () => {
  const d = seed.deposits.find((d) => d.status === "verified"),
    s = run(seed, { kind: "refund", id: d.id }),
    u = s.deposits.find((x) => x.id === d.id);
  assert.equal(u.status, "refunded");
  assert.ok(u.refundReference.startsWith("demo_refund_"));
  assert.equal(s.localCredit, -d.amount);
  assert.equal(total(s), total(seed) - d.amount);
  assert.throws(() => run(s, { kind: "refund", id: d.id }), /Only verified/);
  assertDeposits(s);
});
test("verification followed by refund conserves original ledger and history", () => {
  const id = eligible[0].id;
  let s = run(seed, { kind: "verify", ids: [id] });
  s = run(s, { kind: "refund", id });
  assert.equal(s.localCredit, 0);
  assert.equal(total(s), total(seed));
  assert.equal(s.audit.length, 3);
  assert.ok(s.deposits.find((d) => d.id === id).verifiedAt);
});
test("evidence simulation is labeled and never itself verifies or credits", () => {
  const d = seed.deposits.find((d) => d.status === "pending");
  const s = run(seed, {
      kind: "evidence",
      id: d.id,
      outcome: "settled",
      amount: d.amount,
      confirmations: 8,
    }),
    u = s.deposits.find((x) => x.id === d.id);
  assert.equal(u.status, "pending");
  assert.equal(s.localCredit, 0);
  assert.match(u.notes.at(-1), /SYNTHETIC EVIDENCE/);
  assert.ok(u.proof.id.startsWith("demo_receipt_"));
  const v = seed.deposits.find((d) => d.status === "verified");
  assert.throws(
    () =>
      run(seed, {
        kind: "evidence",
        id: v.id,
        outcome: "unknown",
        amount: v.amount,
        confirmations: 0,
      }),
    /finalized/,
  );
});
test("new claims are unverified/uncredited with unique validated references and real roster IDs", () => {
  const cmd = {
    kind: "record",
    investorId: seed.investors[0].id,
    amount: 1000,
    method: "bank_transfer",
    pool: seed.pools[0].code,
    reference: "demo_new_1000",
  };
  const s = run(seed, cmd);
  assert.equal(s.deposits.length, 105);
  assert.equal(s.deposits[0].status, "submitted");
  assert.equal(s.deposits[0].provider.outcome, "unknown");
  assert.equal(s.deposits[0].proof, null);
  assert.equal(s.localCredit, 0);
  assert.throws(() => run(s, cmd), /already exists/);
  assert.throws(() => run(seed, { ...cmd, investorId: "missing" }), /Unknown/);
  assert.throws(() => run(seed, { ...cmd, pool: "missing" }), /Unknown/);
  assert.throws(() => run(seed, { ...cmd, amount: 1000.001 }));
  assert.throws(() => run(seed, { ...cmd, reference: "=bad formula" }));
});
test("rule editing cannot disable reconciliation or enable automatic bank transfer credits", () => {
  for (const patch of [
    { bank: true },
    { crossCheck: false },
    { flagMismatch: false },
    { confirmations: 5 },
    { threshold: 2 },
  ])
    assert.throws(() =>
      run(seed, { kind: "rules", rules: { ...seed.rules, ...patch } }),
    );
  const s = run(seed, {
    kind: "rules",
    rules: { ...seed.rules, crypto: false, confirmations: 8 },
  });
  assert.equal(s.rules.crypto, false);
  assert.equal(s.localCredit, 0);
});
test("automation verifies only enabled eligible nonbank methods and preserves manual bank review", () => {
  const s = run(seed, { kind: "automation" });
  for (const d of seed.deposits) {
    const u = s.deposits.find((x) => x.id === d.id);
    if (d.method === "bank_transfer") assert.equal(u.status, d.status);
    if (u.status !== d.status) assert.equal(blockers(d, seed.rules).length, 0);
  }
  assertDeposits(s);
  const again = run(s, { kind: "automation" });
  assert.equal(again.localCredit, s.localCredit);
});
test("expiry never rejects settled proofless receipts and respects opt-in", () => {
  const custom = structuredClone(seed);
  custom.rules.rejectExpired = true;
  const a = custom.deposits[1],
    b = custom.deposits[2];
  Object.assign(a, {
    proof: null,
    submittedAt: "2026-10-20T00:00:00Z",
    provider: { ...a.provider, outcome: "unknown" },
  });
  Object.assign(b, {
    proof: null,
    submittedAt: "2026-10-20T00:00:00Z",
    provider: { ...b.provider, outcome: "settled" },
  });
  const s = run(custom, { kind: "automation" });
  assert.equal(s.deposits[1].status, "rejected");
  assert.equal(s.deposits[2].status, b.status);
});
test("note append changes neither payment evidence nor ledger credit", () => {
  const d = seed.deposits[20],
    s = run(seed, { kind: "note", id: d.id });
  assert.equal(s.deposits[20].notes.length, d.notes.length + 1);
  assert.deepEqual(s.deposits[20].provider, d.provider);
  assert.equal(s.deposits[20].status, d.status);
  assert.equal(s.localCredit, 0);
});
test("summary separates claims, verified/current credits, received and refunded", () => {
  const m = summary(seed.deposits, seed.asOf.slice(0, 10));
  assert.equal(m.verified, total(seed));
  assert.equal(m.received, m.verified + m.refunded);
  assert.ok(m.pending > 0);
  assert.ok(m.failed > 0);
  assert.ok(m.avgMinutes > 0);
  const empty = summary([], seed.asOf.slice(0, 10));
  assert.equal(empty.avgMinutes, null);
  assert.equal(empty.received, 0);
});
test("filtered dates, investor, method and text are consistent and reject invalid ranges", () => {
  const base = {
    search: "",
    status: "all",
    method: "all",
    pool: "all",
    investor: "all",
    from: "2026-09-24",
    to: "2026-10-23",
  };
  assert.equal(filterDeposits(seed, base).length, 104);
  assert.ok(
    filterDeposits(seed, { ...base, method: "card" }).every(
      (d) => d.method === "card",
    ),
  );
  assert.equal(
    filterDeposits(seed, { ...base, search: seed.deposits[0].reference })
      .length,
    1,
  );
  assert.throws(() => filterDeposits(seed, { ...base, from: "2026-11-01" }));
  assert.throws(() => filterDeposits(seed, { ...base, to: "invalid" }));
});
test("method and timeline aggregations conserve row totals and use UTC bins", () => {
  const methods = methodBreakdown(seed.deposits),
    all = seed.deposits.reduce((n, d) => n + d.amount, 0);
  assert.equal(
    methods.reduce((n, m) => n + m.total, 0),
    all,
  );
  assert.equal(
    methods.reduce((n, m) => n + m.count, 0),
    104,
  );
  const day = seed.asOf.slice(0, 10),
    t = timeline(seed.deposits, day);
  assert.equal(t.length, 6);
  assert.equal(
    t.reduce((n, b) => n + b.count, 0),
    seed.deposits.filter((d) => d.submittedAt.startsWith(day)).length,
  );
  assert.equal(methodBreakdown([])[0].verifiedRate, null);
});
test("CSV exports all rows, escapes quotes and guards formula/whitespace prefixes", () => {
  const rows = structuredClone(seed.deposits);
  rows[0].investorName = ' \t=HYPERLINK("danger")';
  const csv = depositCSV(rows);
  assert.equal(csv.split("\r\n").length, 105);
  assert.match(csv, /' \t=HYPERLINK/);
  assert.match(csv, /""danger""/);
});
test("unknown command, short notes, invalid credit and duplicate IDs fail atomically", () => {
  assert.throws(() => run(seed, { kind: "delete" }));
  assert.throws(() =>
    apply(seed, { kind: "note", id: seed.deposits[0].id, notes: "short" }, now),
  );
  const bad = structuredClone(seed);
  bad.localCredit = 10;
  assert.throws(() => assertDeposits(bad), /conservation/);
  const duplicate = structuredClone(seed);
  duplicate.deposits.push({ ...duplicate.deposits[0] });
  assert.throws(() => assertDeposits(duplicate), /Duplicate/);
  assert.equal(seed.revision, 0);
});
