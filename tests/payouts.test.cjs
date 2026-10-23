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
const { getPayoutBundle } = load("src/server/services/payouts-service.ts");
const {
  applyPayoutCommand,
  getPayoutSummary,
  assertPayoutInvariants,
  payoutHistory,
  autoEligible,
  feeFor,
  payoutDateRangeSchema,
} = load("src/lib/payouts/model.ts");
const seed = getPayoutBundle();
const notes = "Reviewed the synthetic provider and wallet control evidence.";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} != ${b}`);
const apply = (s, c) => applyPayoutCommand(s, { ...c, notes });
test("D-9 baseline reconciles four pending / two processing / 184 completed with eight today", () => {
  const o = getPayoutSummary(seed);
  assert.equal(o.pendingCount, 4);
  assert.equal(o.pending, 720);
  assert.equal(o.processingCount, 2);
  assert.equal(o.processing, 1400);
  assert.equal(o.todayCount, 8);
  assert.equal(o.today, 2800);
  assert.equal(o.completedCount, 184);
  assert.equal(o.completed, 48920);
  assert.equal(o.averageMinutes, 18);
  assert.equal(o.available, 3150);
  assert.doesNotThrow(() => assertPayoutInvariants(seed));
});
test("gross fee and net are cent-exact under each rail and locked historical quotes", () => {
  assert.equal(feeFor(100, "bank_transfer", seed.settings), 0);
  assert.equal(feeFor(100, "mobile_money", seed.settings), 1.5);
  assert.equal(feeFor(100, "card", seed.settings), 3.2);
  assert.equal(feeFor(100, "crypto_usdt", seed.settings), 1.5);
  for (const r of seed.requests) near(r.fee + r.net, r.amount);
  const next = apply(seed, {
    kind: "settings",
    settings: { ...seed.settings, mobilePercent: 10 },
  });
  assert.equal(
    next.requests.find(
      (r) => r.status === "completed" && r.method === "mobile_money",
    ).fee,
    seed.requests.find(
      (r) => r.status === "completed" && r.method === "mobile_money",
    ).fee,
  );
});
test("approval schedules a commitment without double-reserving or debiting cash", () => {
  const r = seed.requests[0],
    next = apply(seed, { kind: "approve", ids: [r.id], processNow: false });
  assert.equal(seed.requests[0].status, "pending");
  assert.equal(next.requests[0].status, "approved");
  assert.equal(next.treasury.cash, 8750);
  assert.deepEqual(next.investors[0].wallet, seed.investors[0].wallet);
  assert.equal(getPayoutSummary(next).available, 3030);
  assert.throws(
    () => apply(next, { kind: "approve", ids: [r.id], processNow: true }),
    /duplicate/,
  );
});
test("bulk review is atomic and blocked routes or duplicate selections make no partial changes", () => {
  const command = {
    kind: "approve",
    ids: [seed.requests[0].id, seed.requests[3].id],
    processNow: true,
  };
  assert.throws(() => apply(seed, command), /Beneficiary/);
  assert.equal(seed.requests[0].status, "pending");
  assert.throws(() =>
    apply(seed, {
      ...command,
      ids: [seed.requests[0].id, seed.requests[0].id],
    }),
  );
});
test("scheduled batch binds a new attempt and blocks replay", () => {
  const r = seed.requests[0],
    scheduled = apply(seed, {
      kind: "approve",
      ids: [r.id],
      processNow: false,
    });
  const next = apply(scheduled, { kind: "batch", ids: [r.id] });
  assert.equal(next.requests[0].status, "processing");
  assert.equal(next.requests[0].attempts, 1);
  assert.equal(next.requests[0].providerOutcome, "unknown");
  assert.equal(next.investors[0].wallet.held, seed.investors[0].wallet.held);
  assert.throws(() => apply(next, { kind: "batch", ids: [r.id] }));
});
test("settled completion consumes held gross once and records recipient net plus fee in cash ledger", () => {
  const r = seed.requests.find((r) => r.id === "pay_processing_01"),
    i = seed.investors.find((i) => i.id === r.investorId);
  const next = apply(seed, { kind: "complete", id: r.id });
  assert.equal(next.treasury.cash, 8250);
  assert.equal(next.cashLedger.length, 1);
  assert.equal(
    next.investors.find((x) => x.id === i.id).wallet.held,
    i.wallet.held - 500,
  );
  assert.equal(next.investors.find((x) => x.id === i.id).wallet.paid, 500);
  assert.equal(getPayoutSummary(next).completedCount, 185);
  assert.throws(() => apply(next, { kind: "complete", id: r.id }), /duplicate/);
  assert.doesNotThrow(() => assertPayoutInvariants(next));
});
test("unknown evidence cannot complete, fail, retry or release a reservation", () => {
  const started = apply(seed, {
    kind: "approve",
    ids: [seed.requests[0].id],
    processNow: true,
  });
  for (const kind of ["complete", "fail", "refund", "retry"])
    assert.throws(() => apply(started, { kind, id: seed.requests[0].id }));
});
test("callback is attempt-bound, cannot erase settled evidence and preserves before/after snapshots", () => {
  const r = seed.requests[0],
    started = apply(seed, { kind: "approve", ids: [r.id], processNow: true });
  const current = started.requests[0];
  assert.throws(
    () =>
      apply(started, {
        kind: "callback",
        id: r.id,
        attempt: 99,
        reference: current.providerReference,
        outcome: "settled",
      }),
    /Stale/,
  );
  const next = apply(started, {
    kind: "callback",
    id: r.id,
    attempt: 1,
    reference: current.providerReference,
    outcome: "settled",
  });
  assert.equal(next.audit[0].before[0].outcome, "unknown");
  assert.equal(next.audit[0].after[0].outcome, "settled");
  assert.throws(
    () =>
      apply(next, {
        kind: "callback",
        id: r.id,
        attempt: 1,
        reference: current.providerReference,
        outcome: "failed",
      }),
    /cannot be overwritten/,
  );
});
test("failed transfer retains wallet hold, retry uses new reference and cannot reserve twice", () => {
  const r = seed.requests.find((r) => r.id === "pay_failed_01");
  const next = apply(seed, { kind: "retry", id: r.id });
  const retry = next.requests.find((x) => x.id === r.id);
  assert.equal(retry.attempts, 2);
  assert.notEqual(retry.providerReference, r.providerReference);
  assert.equal(retry.status, "processing");
  assert.deepEqual(
    next.investors.map((i) => i.wallet),
    seed.investors.map((i) => i.wallet),
  );
  assert.equal(next.audit[0].before[0].reference, r.providerReference);
  assert.throws(() => apply(next, { kind: "refund", id: r.id }));
  assert.throws(() => apply(next, { kind: "retry", id: r.id }));
});
test("confirmed failure and wallet release are mutually exclusive with retry and preserve treasury cash", () => {
  const id = "pay_processing_02";
  const failed = apply(seed, { kind: "fail", id });
  const r = failed.requests.find((r) => r.id === id),
    i = failed.investors.find((i) => i.id === r.investorId);
  const next = apply(failed, { kind: "refund", id });
  const after = next.investors.find((x) => x.id === i.id);
  assert.equal(after.wallet.held, i.wallet.held - 900);
  assert.equal(after.wallet.available, i.wallet.available + 900);
  assert.equal(next.treasury.cash, 8750);
  assert.throws(() => apply(next, { kind: "refund", id }));
  assert.throws(() => apply(next, { kind: "retry", id }));
});
test("rejection releases local holds, information/contact never move cash and final states are immutable", () => {
  const id = seed.requests[0].id;
  const info = apply(seed, { kind: "info", id });
  assert.equal(info.requests[0].status, "information_requested");
  const contact = apply(info, {
    kind: "contact",
    id,
    subject: "Settlement review",
  });
  assert.equal(contact.treasury.cash, 8750);
  const rejected = apply(contact, { kind: "reject", ids: [id] });
  assert.equal(rejected.requests[0].status, "rejected");
  assert.throws(() => apply(rejected, { kind: "reject", ids: [id] }));
});
test("beneficiary change is local and request-scoped; in-flight routes cannot be edited", () => {
  const id = seed.requests[3].id;
  const next = apply(seed, {
    kind: "beneficiary",
    id,
    masked: "Demo bank account ending 2048",
    token: "demo_verified_route_123",
  });
  assert.equal(next.requests[3].beneficiary.verified, true);
  assert.equal(seed.requests[3].beneficiary.verified, false);
  assert.throws(() =>
    apply(seed, {
      kind: "beneficiary",
      id: "pay_processing_01",
      masked: "Demo destination 2048",
      token: "demo_token_123",
    }),
  );
});
test("new operator request reserves existing wallet funds but cannot invent verified bank ownership", () => {
  const i = seed.investors.find((i) => i.pools.length);
  const command = {
    kind: "request",
    request: {
      investorId: i.id,
      pool: i.pools[0],
      amount: 100,
      method: "mobile_money",
      reason: "partial_payout",
    },
  };
  const next = apply(seed, command);
  assert.equal(next.requests[0].status, "pending");
  assert.equal(next.requests[0].beneficiary.verified, false);
  assert.equal(
    next.investors.find((x) => x.id === i.id).wallet.available,
    i.wallet.available - 100,
  );
  assert.equal(next.treasury.cash, 8750);
  for (const amount of [0, 49, 100.001, 9999])
    assert.throws(() =>
      apply(seed, { ...command, request: { ...command.request, amount } }),
    );
  assert.throws(() =>
    apply(seed, {
      ...command,
      request: { ...command.request, pool: "UNKNOWN" },
    }),
  );
});
test("history uses completed record totals, fills empty days, and averages the preceding six calendar days", () => {
  const points = payoutHistory(seed);
  assert.equal(points.length, 30);
  const last = points.at(-1);
  assert.equal(last.gross, 2800);
  assert.equal(last.count, 8);
  const total = seed.requests
    .filter(
      (r) =>
        r.status === "completed" &&
        r.completedAt.slice(0, 10) >= points.at(-7).day &&
        r.completedAt.slice(0, 10) <= last.day,
    )
    .reduce((n, r) => n + r.amount, 0);
  near(last.average7, Math.round((total / 7) * 100) / 100);
  const all = payoutHistory(seed, 90);
  near(
    all.reduce((n, d) => n + d.gross, 0),
    48920,
  );
  assert.ok(all.some((d) => d.count === 0 && d.gross === 0));
});
test("auto-rule only previews L2 eligible verified destinations and never processes a transfer", () => {
  for (const r of autoEligible(seed)) {
    assert.ok(r.amount <= 200);
    assert.equal(seed.investors.find((i) => i.id === r.investorId).kycLevel, 2);
    assert.equal(r.beneficiary.verified, true);
  }
  const off = apply(seed, {
    kind: "settings",
    settings: { ...seed.settings, autoEnabled: false },
  });
  assert.equal(autoEligible(off).length, 0);
  assert.equal(off.treasury.cash, 8750);
});
test("settings, note lengths and date ranges are validated while liquidity overcommit is rejected atomically", () => {
  assert.throws(() =>
    apply(seed, {
      kind: "settings",
      settings: { ...seed.settings, minimum: 10001 },
    }),
  );
  assert.throws(() =>
    apply(seed, {
      kind: "settings",
      settings: { ...seed.settings, batchTime: "25:00" },
    }),
  );
  assert.throws(() =>
    applyPayoutCommand(seed, {
      kind: "reject",
      ids: [seed.requests[0].id],
      notes: "short",
    }),
  );
  assert.equal(
    payoutDateRangeSchema.safeParse({ from: "2026-02-30", to: "2026-03-01" })
      .success,
    false,
  );
  const low = structuredClone(seed);
  low.treasury.openingCash = low.treasury.cash = 5650;
  assert.equal(getPayoutSummary(low).available, 50);
  assert.throws(
    () =>
      apply(low, {
        kind: "approve",
        ids: [seed.requests[0].id],
        processNow: true,
      }),
    /liquidity/,
  );
});
test("final failed evidence cannot become settled or unknown on the same attempt", () => {
  const r = seed.requests.find((r) => r.id === "pay_processing_02");
  for (const outcome of ["unknown", "settled"])
    assert.throws(
      () =>
        apply(seed, {
          kind: "callback",
          id: r.id,
          attempt: r.attempts,
          reference: r.providerReference,
          outcome,
        }),
      /cannot be overwritten/,
    );
});
