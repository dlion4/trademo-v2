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

const { getPoolsWorkspace, reachedRoiTotal } = load(
  "src/server/services/investor-pools-service.ts",
);
const pools = load("src/lib/investor/pools.ts");
const {
  applyPoolsCommand: apply,
  bookableSlots,
  committedTotal,
  countdown,
  daysBetween,
  endingSoon,
  fillPct,
  hoursUntil,
  lifetimeNet,
  netOfCut,
  nextMilestone,
  poolsCommandSchema,
  relativeFrom,
  upcomingByDate,
} = pools;

const AS_OF = "2026-10-23T10:00:00Z";
const fresh = () => getPoolsWorkspace();

/* ── Fixture contract ── */

test("pool workspace matches the I-2 specification headline figures", () => {
  const w = fresh();
  assert.equal(w.mode, "demo");
  assert.equal(w.asOf, AS_OF);
  assert.equal(w.profile.displayName, "Jane Investor");
  assert.equal(w.summary.committed, 25000);
  assert.equal(w.summary.lifetimeNet, 2419.2);
  assert.equal(w.summary.wallet, 2892);
  assert.equal(w.summary.monthRoiPct, 14.69);
  assert.equal(committedTotal(w), 25000);
  assert.equal(lifetimeNet(w), 2419.2);
  assert.equal(w.trading.length, 2);
  assert.equal(w.open.length, 2);
  assert.equal(w.upcoming.length, 2);
  assert.equal(w.completed.length, 3);
  assert.equal(w.roadmap.length, 7);
});

test("trading pools expose allocation, share and Guardian limits", () => {
  const w = fresh();
  const [basic, aggressive] = w.trading;
  assert.equal(basic.code, "PKG-01");
  assert.equal(basic.goal, 50000);
  assert.equal(basic.raised, 35000);
  assert.equal(basic.slotsFilled, 12);
  assert.equal(basic.slotsTotal, 25);
  assert.equal(basic.userSlots, 5);
  assert.equal(basic.investment, 15000);
  assert.equal(basic.profitSharePct, 30);
  assert.equal(basic.sharePnl, 1260);
  assert.equal(basic.endsAt, "2026-10-29T14:32:00Z");
  assert.equal(aggressive.code, "PKG-03");
  assert.equal(aggressive.sharePnl, 1350);
  assert.equal(aggressive.roiPct, 13.5);
  for (const pool of w.trading) {
    assert.equal(pool.lifecycle, "trading");
    assert.ok(pool.userSlots * pool.slotPrice <= pool.goal);
    assert.ok(pool.guardian.drawdownPct < pool.guardian.drawdownLimitPct);
    assert.ok(
      pool.guardian.consecutiveLosses <= pool.guardian.maxConsecutiveLosses,
    );
    assert.equal(
      pool.sharePnl,
      Number(((pool.pnl * pool.profitSharePct) / 100).toFixed(2)),
    );
  }
});

test("open pools keep booking invariants inside the funding window", () => {
  const w = fresh();
  for (const pool of w.open) {
    assert.ok(pool.minSlot > 0);
    assert.ok(pool.bookedSlots <= pool.maxSlotsPerUser);
    assert.ok(pool.raised <= pool.goal);
    assert.ok(Date.parse(pool.closesAt) > Date.parse(w.asOf));
    assert.ok(Date.parse(pool.tradingEndsAt) > Date.parse(pool.closesAt));
    assert.ok(
      pool.investment <= pool.bookedSlots * pool.maxSlotsPerUser * pool.minSlot,
    );
  }
  const premium = w.open.find((p) => p.id === "pkg_02");
  assert.equal(premium.payment, "verified");
  assert.equal(premium.paymentRef, "PAY-2026-10-19-8842");
  const silver = w.open.find((p) => p.id === "pkg_09");
  assert.equal(silver.payment, "pending");
});

test("upcoming pools open in chronological order and carry interest", () => {
  const w = fresh();
  const sorted = upcomingByDate(w);
  assert.deepEqual(
    sorted.map((p) => p.code),
    ["PKG-04", "PKG-05"],
  );
  const quick = sorted[0];
  assert.equal(quick.minSlot, 2000);
  assert.equal(quick.maxSlotsPerUser, 25);
  assert.equal(quick.goal, 40000);
  assert.equal(quick.expressed, 12000);
  for (const pool of w.upcoming) {
    assert.ok(Date.parse(pool.opensAt) > Date.parse(w.asOf));
    assert.ok(Date.parse(pool.closesAt) > Date.parse(pool.opensAt));
  }
});

test("completed pools settle at the net-of-platform-cut amount", () => {
  const w = fresh();
  const genesis = w.completed.find((p) => p.id === "pkg_00");
  assert.equal(genesis.finalRoiPct, 16.4);
  assert.equal(genesis.grossEarnings, 1476);
  assert.equal(genesis.platformCutPct, 20);
  assert.equal(genesis.netEarnings, 1180.8);
  assert.equal(genesis.payout, "completed");
  assert.equal(genesis.payoutRef, "PO-2026-10-11-0031");
  assert.equal(genesis.settlement, "reconciled");
  for (const pool of w.completed) {
    assert.equal(
      pool.netEarnings,
      netOfCut(pool.grossEarnings, pool.platformCutPct),
    );
    assert.ok(pool.netEarnings < pool.grossEarnings);
    assert.ok(pool.paidAt);
    assert.ok(pool.payoutRef);
  }
  assert.equal(lifetimeNet(w), 2419.2);
  assert.equal(reachedRoiTotal(w.completed), 11.52);
});

test("roadmap is date-ordered once the token milestone is excluded", () => {
  const w = fresh();
  const dates = w.roadmap
    .filter((m) => m.state !== "token")
    .map((m) => Date.parse(m.date));
  assert.deepEqual(
    dates,
    [...dates].sort((a, b) => a - b),
  );
  const token = w.roadmap.find((m) => m.state === "token");
  assert.equal(token.code, "TOKEN");
  assert.equal(token.expectedRoiPct, 0);
  const next = nextMilestone(w);
  assert.equal(next.code, "PKG-04");
  assert.notEqual(next.state, "token");
});

/* ── Selectors ── */

test("fillPct clamps at both ends and survives a zero goal", () => {
  assert.equal(fillPct(35000, 50000), 70);
  assert.equal(fillPct(0, 0), 0);
  assert.equal(fillPct(90000, 100000), 90);
  assert.equal(fillPct(120000, 100000), 100);
  assert.equal(fillPct(-50, 100), 0);
});

test("netOfCut rounds to cents instead of drifting floats", () => {
  assert.equal(netOfCut(1476, 20), 1180.8);
  assert.equal(netOfCut(486, 20), 388.8);
  assert.equal(netOfCut(1062, 20), 849.6);
  assert.equal(netOfCut(1000, 0), 1000);
});

test("countdown labels stay human and never go negative", () => {
  const soon = countdown("2026-10-25T00:18:00Z");
  assert.deepEqual([soon.days, soon.hours, soon.minutes], [1, 14, 18]);
  assert.equal(soon.label, "1d 14h 18m");
  const past = countdown("2026-10-01T00:00:00Z");
  assert.equal(past.total, 0);
  assert.equal(past.label, "0d 0h 0m");
});

test("relative labels describe the fixture snapshot", () => {
  assert.equal(relativeFrom("2026-10-23T09:55:00Z"), "5m ago");
  assert.equal(relativeFrom("2026-10-23T06:00:00Z"), "4h ago");
  assert.equal(relativeFrom("2026-10-22T10:00:00Z"), "yesterday");
  assert.equal(relativeFrom("2026-10-20T10:00:00Z"), "3d ago");
});

test("endingSoon only flags pools inside the 72 hour window", () => {
  assert.equal(endingSoon("2026-10-25T00:18:00Z"), true);
  assert.equal(endingSoon("2026-10-29T14:32:00Z"), false);
  assert.equal(endingSoon("2026-10-01T00:00:00Z"), false);
  assert.equal(endingSoon("2026-10-25T00:18:00Z", AS_OF, 120), true);
  assert.equal(hoursUntil("2026-10-25T00:18:00Z"), 38.3);
  assert.equal(daysBetween("2026-10-23T10:00:00Z", "2026-10-29T14:32:00Z"), 6);
});

test("bookableSlots is bounded by the per-user limit and pool capacity", () => {
  const w = fresh();
  const premium = w.open.find((p) => p.id === "pkg_02");
  /* per-user headroom (10 - 2 booked) is tighter than remaining capital */
  assert.equal(premium && bookableSlots(premium), 8);
  const roomy = { ...premium, bookedSlots: 0 };
  assert.equal(bookableSlots(roomy), 10);
  const nearlyFull = { ...premium, raised: 79000 };
  assert.equal(bookableSlots(nearlyFull), 0);
  const full = { ...premium, raised: 80000 };
  assert.equal(bookableSlots(full), 0);
  const capped = { ...premium, bookedSlots: 9 };
  assert.equal(bookableSlots(capped), 1);
});

/* ── Commands ── */

test("command schema rejects malformed payloads", () => {
  const bad = [
    { kind: "bookSlots", poolId: "pkg_02", slots: 0 },
    { kind: "bookSlots", poolId: "", slots: 1 },
    { kind: "bookSlots", poolId: "pkg_02", slots: 2.5 },
    { kind: "bookSlots", poolId: "pkg_02", slots: 11 },
    { kind: "setReminder", poolId: "pkg_04", leadDays: 4, channel: "email" },
    { kind: "setReminder", poolId: "pkg_04", leadDays: 2, channel: "sms" },
    { kind: "prebookInterest", poolId: "pkg_04", slots: 0 },
    { kind: "prebookInterest", poolId: "pkg_04", slots: 26 },
    { kind: "saveScenario", principal: 100, roiPct: 10, days: 30 },
    { kind: "saveScenario", principal: 5000, roiPct: 0, days: 30 },
    { kind: "saveScenario", principal: 5000, roiPct: 10, days: 0 },
    { kind: "support", topic: "pool", message: "too short" },
    {
      kind: "support",
      topic: "billing",
      message: "A long enough message body",
    },
    { kind: "recordExport", scope: "all", format: "csv", count: 3 },
    { kind: "recordExport", scope: "roadmap", format: "xlsx", count: 3 },
    { kind: "refreshPools", source: "cron" },
  ];
  for (const payload of bad)
    assert.throws(() => poolsCommandSchema.parse(payload), payload.kind);
  assert.equal(
    poolsCommandSchema.parse({ kind: "refreshPools", source: "manual" }).kind,
    "refreshPools",
  );
});

test("commands never mutate the previous workspace object", () => {
  const before = fresh();
  const snapshot = JSON.stringify(before);
  apply(before, { kind: "bookSlots", poolId: "pkg_02", slots: 1 });
  apply(before, {
    kind: "saveScenario",
    principal: 5000,
    roiPct: 18,
    days: 21,
  });
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(fresh().revision, 0);
});

test("booking a slot holds allocation locally without confirming payment", () => {
  const w = fresh();
  const next = apply(w, { kind: "bookSlots", poolId: "pkg_02", slots: 2 });
  const pool = next.open.find((p) => p.id === "pkg_02");
  assert.equal(pool.bookedSlots, 4);
  assert.equal(pool.investment, 20000);
  assert.equal(pool.raised, 38000);
  assert.equal(pool.payment, "pending");
  assert.equal(next.bookings.length, 1);
  assert.equal(next.bookings[0].status, "preview_hold");
  assert.equal(next.bookings[0].amount, 10000);
  assert.equal(w.bookings.length, 0);
  assert.equal(w.open.find((p) => p.id === "pkg_02").raised, 28000);
  assert.equal(next.audit[0].action, "book_slots_preview");
  assert.match(next.audit[0].detail, /Payment verification is required/);
});

test("booking rejects unknown pools, closed windows and over-allocation", () => {
  const w = fresh();
  assert.throws(
    () => apply(w, { kind: "bookSlots", poolId: "pkg_04", slots: 1 }),
    /not accepting bookings/,
  );
  assert.throws(
    () => apply(w, { kind: "bookSlots", poolId: "pkg_02", slots: 10 }),
    /remain for your allocation/,
  );
  const closed = {
    ...w,
    open: w.open.map((p) =>
      p.id === "pkg_02" ? { ...p, closesAt: "2026-10-22T00:00:00Z" } : p,
    ),
  };
  assert.throws(
    () => apply(closed, { kind: "bookSlots", poolId: "pkg_02", slots: 1 }),
    /window has closed/,
  );
  const maxed = {
    ...w,
    open: w.open.map((p) =>
      p.id === "pkg_02" ? { ...p, bookedSlots: 10 } : p,
    ),
  };
  assert.throws(
    () => apply(maxed, { kind: "bookSlots", poolId: "pkg_02", slots: 1 }),
    /per-investor limit/,
  );
});

test("reminders reject duplicates and leads beyond the open window", () => {
  const w = fresh();
  const next = apply(w, {
    kind: "setReminder",
    poolId: "pkg_05",
    leadDays: 2,
    channel: "email",
  });
  assert.equal(next.reminders.length, 1);
  assert.equal(next.reminders[0].leadDays, 2);
  assert.equal(next.audit[0].action, "set_reminder");
  assert.throws(
    () =>
      apply(next, {
        kind: "setReminder",
        poolId: "pkg_05",
        leadDays: 1,
        channel: "email",
      }),
    /already exists/,
  );
  assert.throws(
    () =>
      apply(w, {
        kind: "setReminder",
        poolId: "pkg_04",
        leadDays: 7,
        channel: "in_app",
      }),
    /cannot lead by 7 days/,
  );
  assert.throws(
    () =>
      apply(w, {
        kind: "setReminder",
        poolId: "pkg_02",
        leadDays: 1,
        channel: "in_app",
      }),
    /Upcoming pool not found/,
  );
  const cleared = apply(next, { kind: "removeReminder", poolId: "pkg_05" });
  assert.equal(cleared.reminders.length, 0);
  assert.equal(cleared.audit[0].action, "remove_reminder");
  assert.throws(
    () => apply(cleared, { kind: "removeReminder", poolId: "pkg_05" }),
    /not found/,
  );
});

test("interest registration respects the per-investor slot maximum", () => {
  const w = fresh();
  const next = apply(w, {
    kind: "prebookInterest",
    poolId: "pkg_04",
    slots: 3,
  });
  assert.equal(next.interests.length, 1);
  assert.equal(next.interests[0].status, "interest_registered");
  assert.equal(next.upcoming.find((p) => p.id === "pkg_04").expressed, 18000);
  assert.equal(w.upcoming.find((p) => p.id === "pkg_04").expressed, 12000);
  assert.throws(
    () => apply(next, { kind: "prebookInterest", poolId: "pkg_04", slots: 1 }),
    /already registered/,
  );
  assert.throws(
    () => apply(w, { kind: "prebookInterest", poolId: "pkg_05", slots: 16 }),
    /Maximum 15 slots/,
  );
});

test("projections are stored newest-first and capped at ten", () => {
  let w = fresh();
  for (let i = 0; i < 12; i += 1)
    w = apply(w, {
      kind: "saveScenario",
      principal: 5000 + i,
      roiPct: 18,
      days: 21,
    });
  assert.equal(w.scenarios.length, 10);
  assert.equal(w.scenarios[0].principal, 5011);
  assert.equal(w.scenarios[0].projectedProfit, 901.98);
  assert.equal(w.audit[0].action, "save_projection");
});

test("support drafts, exports and refreshes stay inside the local workspace", () => {
  const w = fresh();
  const support = apply(w, {
    kind: "support",
    topic: "payment",
    message: "Payment reference does not match my booking record.",
  });
  assert.equal(support.support.length, 1);
  assert.equal(support.support[0].status, "local_draft");
  assert.equal(support.audit[0].action, "support_draft");

  const exported = apply(support, {
    kind: "recordExport",
    scope: "completed-history",
    format: "csv",
    count: 3,
  });
  assert.match(
    exported.audit[0].detail,
    /completed-history exported as CSV \(3 record/,
  );

  const manual = apply(exported, { kind: "refreshPools", source: "manual" });
  assert.equal(manual.revision, 1);
  assert.equal(manual.audit[0].action, "pools_refresh");
  assert.equal(manual.asOf, w.asOf);

  assert.throws(
    () =>
      apply(
        { ...w, preferences: { ...w.preferences, autoRefresh: false } },
        { kind: "refreshPools", source: "auto" },
      ),
    /Automatic refresh is disabled/,
  );
});

test("the audit trail is capped at forty entries", () => {
  let w = fresh();
  for (let i = 0; i < 45; i += 1)
    w = apply(w, {
      kind: "saveScenario",
      principal: 5000,
      roiPct: 10,
      days: 10,
    });
  assert.equal(w.audit.length, 40);
  assert.equal(w.scenarios.length, 10);
});
