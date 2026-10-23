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

const { getInvestorOverview } = load(
  "src/server/services/investor-service.ts",
);
const model = load("src/lib/investor/model.ts");
const {
  applyInvestorCommand: apply,
  countdownLabel,
  daysSince,
  investorCommandSchema,
  monthEarned,
  monthRoi,
  payoutIssue,
  poolProgress,
  relativeLabel,
  unrealizedTotal,
} = model;

const AS_OF = "2026-10-23T10:00:00Z";
const fresh = () => getInvestorOverview();

/* ── Fixture contract ── */

test("overview fixture matches the I-1 specification headline figures", () => {
  const w = fresh();
  assert.equal(w.profile.displayName, "Jane Investor");
  assert.equal(w.profile.investorSince.slice(0, 10), "2026-09-12");
  assert.equal(w.summary.totalInvested, 25000);
  assert.equal(w.summary.activePools, 2);
  assert.equal(w.wallet.available, 2892);
  assert.equal(unrealizedTotal(w), 2610);
  assert.equal(monthEarned(w), 3672);
  assert.equal(monthRoi(w), 14.69);
});

test("active pools carry the spec allocation, progress and Guardian state", () => {
  const w = fresh();
  const [basic, aggressive] = w.activePools;
  assert.equal(basic.code, "PKG-01");
  assert.equal(basic.name, "Basic Growth");
  assert.equal(basic.raised, 35000);
  assert.equal(basic.goal, 50000);
  assert.equal(basic.investment, 15000);
  assert.equal(basic.userSlots, 5);
  assert.equal(basic.profitSharePct, 30);
  assert.equal(basic.sharePnl, 1260);
  assert.equal(aggressive.code, "PKG-03");
  assert.equal(aggressive.raised, 90000);
  assert.equal(aggressive.investment, 10000);
  assert.equal(aggressive.profitSharePct, 10);
  assert.equal(aggressive.sharePnl, 1350);
  assert.equal(basic.guardian.status, "active");
  assert.equal(aggressive.guardian.status, "active");
  assert.ok(basic.guardian.consecutiveLosses <= basic.guardian.maxConsecutiveLosses);
  assert.ok(aggressive.guardian.drawdownPct <= aggressive.guardian.drawdownLimitPct);
});

test("upcoming windows expose booking invariants", () => {
  const w = fresh();
  assert.ok(w.upcoming.length >= 2);
  for (const pool of w.upcoming) {
    assert.ok(pool.minInvestment > 0);
    assert.ok(pool.expectedRoiPct > 0);
    assert.ok(pool.capacity > 0);
    assert.ok(pool.riskBand.length > 0);
    assert.ok(Date.parse(pool.opensAt) > Date.parse(AS_OF));
  }
  assert.equal(w.upcoming[0].code, "PKG-04");
  assert.equal(w.upcoming[0].minInvestment, 2000);
  assert.equal(w.upcoming[0].durationDays, 7);
  assert.equal(w.upcoming[0].expectedRoiPct, 10);
});

test("activity ledger, notifications and receipts are coherent", () => {
  const w = fresh();
  assert.equal(w.activity.length, 11);
  assert.equal(w.notifications.length, 5);
  assert.equal(w.notifications.filter((n) => !n.read).length, 3);
  for (const item of w.activity) {
    assert.ok(item.id.length > 0);
    assert.ok(item.title.length > 0);
    assert.ok(Date.parse(item.at) <= Date.parse(AS_OF));
  }
  for (const receipt of w.receipts) {
    assert.ok(receipt.netAmount > 0);
    assert.equal(receipt.status, "settled");
    assert.ok(Date.parse(receipt.paidAt) <= Date.parse(AS_OF));
  }
});

/* ── Selectors ── */

test("poolProgress clamps and survives a zero goal", () => {
  assert.equal(poolProgress(35000, 50000), 70);
  assert.equal(poolProgress(0, 50000), 0);
  assert.equal(poolProgress(60000, 50000), 100);
  assert.equal(poolProgress(10, 0), 100);
  assert.equal(poolProgress(-5, 100), 0);
});

test("countdown labels stay human and never go negative", () => {
  assert.equal(countdownLabel("2026-10-29T14:32:00Z", AS_OF), "6d 4h 32m");
  assert.equal(countdownLabel("2026-10-23T13:05:00Z", AS_OF), "3h 5m");
  assert.equal(countdownLabel("2026-10-01T00:00:00Z", AS_OF), "0h 0m");
});

test("relative and days-since labels are stable for the fixture snapshot", () => {
  assert.equal(relativeLabel("2026-10-23T09:59:00Z", AS_OF), "1m ago");
  assert.equal(relativeLabel("2026-10-23T07:00:00Z", AS_OF), "3h ago");
  assert.equal(relativeLabel("2026-10-21T10:00:00Z", AS_OF), "2d ago");
  assert.equal(daysSince("2026-09-12T10:00:00Z", AS_OF), 41);
});

/* ── Command validation ── */

test("command schema rejects malformed payloads", () => {
  assert.equal(investorCommandSchema.safeParse({ kind: "markAllRead" }).success, true);
  assert.equal(
    investorCommandSchema.safeParse({ kind: "markRead", id: "" }).success,
    false,
  );
  assert.equal(
    investorCommandSchema.safeParse({
      kind: "setReminder",
      poolId: "pkg-04",
      leadDays: 5,
      channel: "email",
    }).success,
    false,
  );
  assert.equal(
    investorCommandSchema.safeParse({
      kind: "bookSlot",
      poolId: "pkg-04",
      slots: 11,
      amount: 2000,
    }).success,
    false,
  );
  assert.equal(
    investorCommandSchema.safeParse({
      kind: "requestPayout",
      amount: 500,
      methodId: "bank_usd",
    }).success,
    true,
  );
  assert.equal(
    investorCommandSchema.safeParse({
      kind: "unknownCommand",
    }).success,
    false,
  );
});

test("payoutIssue blocks invalid withdrawals", () => {
  const w = fresh();
  const method = w.wallet.methods.find((m) => m.active);
  assert.ok(method);
  assert.equal(payoutIssue(w, 500, method.id), null);
  assert.equal(payoutIssue(w, 500, "missing_method"), "Choose an active payout method");
  assert.equal(payoutIssue(w, 0, method.id), "Enter a payout amount");
  assert.equal(
    payoutIssue(w, method.minAmount - 1, method.id),
    `Minimum payout for ${method.label} is $${method.minAmount.toLocaleString()}`,
  );
  assert.equal(
    payoutIssue(w, w.wallet.available + 1, method.id),
    "Payout cannot exceed the withdrawable balance",
  );
  assert.equal(
    payoutIssue(w, 60.005, method.id),
    "Use at most two decimal places",
  );
});

/* ── Commands are local, immutable and audited ── */

test("commands never mutate the previous workspace object", () => {
  const before = fresh();
  const snapshot = JSON.parse(JSON.stringify(before));
  const after = apply(before, { kind: "markAllRead" }, "2026-10-23T10:05:00Z");
  assert.deepEqual(before, snapshot);
  assert.notEqual(after, before);
  assert.notEqual(after.activity, before.activity);
  assert.equal(after.activity.filter((a) => !a.read).length, 0);
  assert.equal(before.activity.filter((a) => !a.read).length, 3);
});

test("mark-update commands append an audit trail and bump revision", () => {
  const before = fresh();
  const after = apply(before, { kind: "markAllRead" }, "2026-10-23T10:05:00Z");
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.audit[0].at, "2026-10-23T10:05:00Z");
  assert.ok(after.audit.length > before.audit.length);
});

test("booking a slot reserves intent without moving money", () => {
  const w = fresh();
  const pool = w.upcoming[0];
  const after = apply(w, {
    kind: "bookSlot",
    poolId: pool.id,
    slots: 1,
    amount: pool.minInvestment,
  });
  const booking = after.bookings[0];
  assert.equal(booking.poolId, pool.id);
  assert.equal(booking.status, "preview_hold");
  assert.equal(after.wallet.available, w.wallet.available);
  assert.equal(after.summary.totalInvested, w.summary.totalInvested);
});

test("booking rejects unknown pools, over-allocation and wrong amounts", () => {
  const w = fresh();
  const pool = w.upcoming[0];
  assert.throws(
    () =>
      apply(w, {
        kind: "bookSlot",
        poolId: "nope",
        slots: 1,
        amount: pool.minInvestment,
      }),
    /not open for booking/i,
  );
  assert.throws(
    () =>
      apply(w, {
        kind: "bookSlot",
        poolId: pool.id,
        slots: 2,
        amount: pool.minInvestment,
      }),
    /Allocation must equal 2 ×/i,
  );
  assert.throws(
    () =>
      apply(w, {
        kind: "bookSlot",
        poolId: pool.id,
        slots: 1,
        amount: 0,
      }),
    /Allocation must equal/i,
  );
});

test("payout drafts stay pending and never touch the balance", () => {
  const w = fresh();
  const method = w.wallet.methods.find((m) => m.active);
  const after = apply(w, {
    kind: "requestPayout",
    amount: 500,
    methodId: method.id,
  });
  assert.equal(after.wallet.available, w.wallet.available);
  assert.equal(after.payoutRequests.at(-1).status, "preview_waiting_source");
  assert.equal(after.payoutRequests.at(-1).amount, 500);
  assert.equal(after.payoutRequests.at(-1).methodId, method.id);
  assert.ok(after.payoutRequests.length > w.payoutRequests.length);
  assert.throws(
    () => apply(w, { kind: "requestPayout", amount: 1_000_000, methodId: method.id }),
    /withdrawable/i,
  );
});

test("reminders can be set, replaced and removed", () => {
  const w = fresh();
  const pool = w.upcoming[1];
  const set = apply(w, {
    kind: "setReminder",
    poolId: pool.id,
    leadDays: 1,
    channel: "email",
  });
  const reminder = set.reminders.find((r) => r.poolId === pool.id);
  assert.ok(reminder);
  assert.equal(reminder.leadDays, 1);
  assert.throws(
    () =>
      apply(set, {
        kind: "setReminder",
        poolId: pool.id,
        leadDays: 2,
        channel: "in_app",
      }),
    /already exists/i,
  );
  assert.throws(
    () =>
      apply(w, {
        kind: "setReminder",
        poolId: pool.id,
        leadDays: 7,
        channel: "email",
      }),
    /cannot lead by 7 days/i,
  );
  assert.equal(set.reminders.filter((r) => r.poolId === pool.id).length, 1);
  const removed = apply(set, { kind: "removeReminder", poolId: pool.id });
  assert.equal(removed.reminders.filter((r) => r.poolId === pool.id).length, 0);
  assert.throws(
    () => apply(removed, { kind: "removeReminder", poolId: pool.id }),
    /Reminder not found/,
  );
});

test("notification preferences reject unsafe combinations", () => {
  const w = fresh();
  const base = w.preferences;
  assert.throws(
    () =>
      apply(w, {
        kind: "savePreferences",
        value: { ...base, channels: { email: false, push: false, sms: false } },
      }),
    /at least one notification channel/i,
  );
  assert.throws(
    () =>
      apply(w, {
        kind: "savePreferences",
        value: { ...base, quietStart: "22:00", quietEnd: "22:00" },
      }),
    /quiet hours/i,
  );
  const saved = apply(w, {
    kind: "savePreferences",
    value: { ...base, digest: "weekly", quietStart: "21:00", quietEnd: "06:00" },
  });
  assert.equal(saved.preferences.digest, "weekly");
  assert.equal(w.preferences.digest, base.digest);
});

test("profile, support and calculator commands stay local", () => {
  const w = fresh();
  const renamed = apply(w, {
    kind: "updateProfile",
    displayName: "Jane A. Investor",
  });
  assert.equal(renamed.profile.displayName, "Jane A. Investor");
  assert.equal(renamed.profile.email, w.profile.email);

  const ticket = apply(w, {
    kind: "support",
    topic: "payout",
    message: "Please advise on the pending payout timing.",
  });
  assert.equal(ticket.supportTickets[0].status, "local_draft");
  assert.equal(ticket.supportTickets[0].topic, "payout");

  const scenario = apply(w, {
    kind: "saveCalculator",
    principal: 5000,
    roiPct: 12,
    days: 30,
  });
  assert.equal(scenario.calculatorScenarios[0].projectedProfit, 600);
  assert.equal(scenario.wallet.available, w.wallet.available);
});

test("manual and automatic refreshes only advance the snapshot clock", () => {
  const w = fresh();
  const manual = apply(w, { kind: "refreshEarnings", source: "manual" });
  assert.equal(manual.earnings.nextRefreshIn, 180);
  assert.equal(manual.earnings.updatedAt, "2026-10-23T10:05:00Z");
  assert.equal(manual.wallet.available, w.wallet.available);
  assert.ok(manual.earnings.rows.every((r) => r.updatedAt === "2026-10-23T10:05:00Z"));
  const auto = apply(manual, { kind: "refreshEarnings", source: "auto" });
  assert.equal(auto.earnings.nextRefreshIn, 180);
  assert.ok(auto.audit.length >= w.audit.length);
  const noAuto = apply(w, {
    kind: "savePreferences",
    value: { ...w.preferences, autoRefresh: false },
  });
  assert.throws(
    () => apply(noAuto, { kind: "refreshEarnings", source: "auto" }),
    /disabled in preferences/i,
  );
});

test("the fixture service returns an isolated copy on every call", () => {
  const a = fresh();
  a.wallet.available = 0;
  a.activePools[0].investment = 1;
  const b = fresh();
  assert.equal(b.wallet.available, 2892);
  assert.equal(b.activePools[0].investment, 15000);
});
