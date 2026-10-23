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
const { getFundsBundle } = load("src/server/services/funds-service.ts");
const {
  applyFundsCommand,
  getFundsOverview,
  reconciliationChecks,
  assertFundsInvariant,
} = load("src/lib/funds/model.ts");
const seed = getFundsBundle();
const notes = "Reviewed synthetic evidence and local control balances.";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} != ${b}`);
test("D-8 opening funds reconcile with D-6 capital and exact liquidity components", () => {
  assert.doesNotThrow(() => assertFundsInvariant(seed));
  const o = getFundsOverview(seed);
  assert.equal(o.capital, 156000);
  assert.equal(o.deployed, 142000);
  assert.equal(o.available, 14000);
  assert.equal(o.brokerCash, 8750);
  assert.equal(o.escrow, 5250);
  assert.equal(o.pending, 3500);
  assert.equal(o.pendingCount, 4);
  assert.equal(o.spendable, 4550);
  assert.equal(o.reserveGap, 3600);
  assert.ok(reconciliationChecks(seed).every((c) => c.difference === 0));
});
test("settled deposit verification is cent-exact, immutable, adds cash not deployment, and cannot be replayed", () => {
  const d = seed.deposits[0];
  assert.equal(d.kycVerified, true);
  const next = applyFundsCommand(seed, { kind: "verify", id: d.id, notes });
  assert.equal(seed.deposits[0].status, "pending");
  assert.equal(next.deposits[0].status, "verified");
  assert.equal(next.ledgerCapital, 159000);
  assert.equal(next.custody.brokerCash, 11750);
  assert.equal(next.custody.positions, 142000);
  assert.equal(next.revision, 1);
  assert.equal(next.audit[0].action, "verify");
  assert.throws(
    () => applyFundsCommand(next, { kind: "verify", id: d.id, notes }),
    /already final/,
  );
  assert.doesNotThrow(() => assertFundsInvariant(next));
});
test("KYC, unsettled provider, missing deposit and final statuses block credit", () => {
  for (const id of [
    seed.deposits[1].id,
    seed.deposits[2].id,
    seed.deposits[4].id,
    "missing",
  ])
    assert.throws(() => applyFundsCommand(seed, { kind: "verify", id, notes }));
});
test("rejection and information requests never credit, refund or mutate capital", () => {
  for (const kind of ["reject", "requestInfo"]) {
    const next = applyFundsCommand(seed, {
      kind,
      id: seed.deposits[0].id,
      notes,
    });
    assert.equal(next.ledgerCapital, seed.ledgerCapital);
    assert.equal(next.custody.brokerCash, seed.custody.brokerCash);
    assert.equal(next.movements.length, seed.movements.length);
    assert.equal(next.deposits[0].notes.at(-1), notes);
  }
});
test("manual deposit intake is uncredited, validates references and cannot manufacture settlement", () => {
  const input = {
    kind: "register",
    deposit: {
      investorId: seed.investors[0].id,
      pool: "PKG-01",
      amount: 19.99,
      method: "bank_transfer",
      reference: "TEST-REFERENCE-999",
    },
    notes,
  };
  const next = applyFundsCommand(seed, input);
  assert.equal(next.ledgerCapital, 156000);
  assert.equal(next.deposits[0].status, "submitted");
  assert.equal(next.deposits[0].providerSettled, false);
  near(getFundsOverview(next).pending, 3519.99);
  assert.throws(() => applyFundsCommand(next, input), /reference already/);
  assert.throws(() =>
    applyFundsCommand(seed, {
      ...input,
      deposit: { ...input.deposit, amount: 1.001 },
    }),
  );
  assert.throws(() =>
    applyFundsCommand(seed, {
      ...input,
      deposit: { ...input.deposit, investorId: "unknown" },
    }),
  );
});
test("rebalance protects capital, reserve, package entitlements and monetary precision", () => {
  const allocations = seed.allocations.map((p, i) => ({
    code: p.code,
    deployed: p.deployed + (i === 0 ? 1000 : i === 1 ? -1000 : 0),
  }));
  const next = applyFundsCommand(seed, {
    kind: "rebalance",
    allocations,
    notes,
  });
  assert.doesNotThrow(() => assertFundsInvariant(next));
  assert.equal(next.custody.brokerCash, 8750);
  assert.equal(next.allocations[0].deployed, 57000);
  for (const invalid of [
    allocations.map((p) => ({ ...p, code: "PKG-01" })),
    allocations.map((p) => ({ ...p, deployed: 100000 })),
    allocations.map((p) => ({ ...p, deployed: p.deployed + 0.001 })),
    allocations.map((p) => ({ ...p, deployed: -1 })),
  ])
    assert.throws(() =>
      applyFundsCommand(seed, {
        kind: "rebalance",
        allocations: invalid,
        notes,
      }),
    );
  const allFunded = seed.allocations.map((p) => ({
    code: p.code,
    deployed: p.capital,
  }));
  assert.throws(
    () =>
      applyFundsCommand(seed, {
        kind: "rebalance",
        allocations: allFunded,
        notes,
      }),
    /reserve or escrow/,
  );
});
test("cash reserve top-up earmarks existing cash, does not double-count reserve or release positions", () => {
  const next = applyFundsCommand(seed, {
    kind: "reserveTopUp",
    source: "cash",
    notes,
  });
  assert.equal(next.reserve.balance, 7800);
  assert.equal(next.custody.brokerCash, 8750);
  assert.equal(next.custody.positions, 142000);
  assert.equal(getFundsOverview(next).spendable, 950);
  assert.equal(getFundsOverview(next).reserveGap, 0);
  assert.throws(
    () =>
      applyFundsCommand(next, { kind: "reserveTopUp", source: "cash", notes }),
    /already met/,
  );
  assert.doesNotThrow(() => assertFundsInvariant(next));
});
test("position-release reserve top-up allocates reduction to exact cents and conserves custody", () => {
  const policy = applyFundsCommand(seed, {
    kind: "reservePolicy",
    percent: 10.01,
    notes,
  });
  assert.throws(
    () =>
      applyFundsCommand(policy, {
        kind: "reserveTopUp",
        source: "cash",
        notes,
      }),
    /Insufficient/,
  );
  const next = applyFundsCommand(policy, {
    kind: "reserveTopUp",
    source: "positions",
    notes,
  });
  assert.equal(next.reserve.balance, 15615.6);
  near(next.custody.positions, 130584.4);
  near(
    next.allocations.reduce((n, p) => n + p.deployed, 0),
    next.custody.positions,
  );
  assert.equal(next.ledgerCapital, 156000);
  assert.doesNotThrow(() => assertFundsInvariant(next));
});
test("reserve policy changes only the target; finite values and note lengths are mandatory", () => {
  const next = applyFundsCommand(seed, {
    kind: "reservePolicy",
    percent: 10,
    notes,
  });
  assert.equal(next.reserve.balance, 4200);
  assert.equal(next.custody.brokerCash, 8750);
  for (const percent of [0, 21, Infinity, NaN])
    assert.throws(() =>
      applyFundsCommand(seed, { kind: "reservePolicy", percent, notes }),
    );
  assert.throws(() =>
    applyFundsCommand(seed, {
      kind: "reservePolicy",
      percent: 5,
      notes: "short",
    }),
  );
});
test("three-way discrepancy detection alerts above $1, retains latest five evidence rows and blocks money changes", () => {
  const broken = structuredClone(seed);
  broken.custody.brokerCash += 1.2;
  const next = applyFundsCommand(broken, { kind: "reconcile", notes });
  assert.equal(next.runs.length, 5);
  assert.equal(next.runs[0].status, "alert");
  near(next.runs[0].difference, 1.2);
  assert.equal(next.runs[0].checks.length, 3);
  assert.throws(
    () =>
      applyFundsCommand(broken, {
        kind: "reserveTopUp",
        source: "cash",
        notes,
      }),
    /conservation/,
  );
  const note = applyFundsCommand(next, {
    kind: "note",
    reference: next.runs[0].id,
    notes,
  });
  assert.equal(note.runs[0].status, "alert");
  assert.equal(note.custody.brokerCash, broken.custody.brokerCash);
});
test("sub-dollar variances remain review cases, not false balanced results", () => {
  const broken = structuredClone(seed);
  broken.custody.escrow += 0.5;
  assert.equal(
    applyFundsCommand(broken, { kind: "reconcile", notes }).runs[0].status,
    "review",
  );
});
