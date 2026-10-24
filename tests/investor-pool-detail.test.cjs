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

const { getPoolDetailWorkspace, listPoolDetailIds } = load(
  "src/server/services/investor-pool-detail-service.ts",
);
const detail = load("src/lib/investor/pool-detail.ts");
const {
  applyPoolDetailCommand: apply,
  capitalSharePct,
  countdownFrom,
  detailFillPct,
  drawdownHeadroom,
  durationLabel,
  hoursUntil,
  poolDetailCommandSchema,
  relativeTo,
  roiOn,
  sumDaily,
  tradingElapsedPct,
  withdrawableNet,
} = detail;

const AS_OF = "2026-10-23T10:00:00Z";
const NOW = "2026-10-23T10:05:00Z";
const fresh = (id = "pkg_01") => getPoolDetailWorkspace(id);

/* ── Fixture contract ── */

test("pool detail resolves every id in the I-2 pool book", () => {
  const ids = listPoolDetailIds();
  assert.deepEqual(ids, [
    "pkg_01",
    "pkg_03",
    "pkg_02",
    "pkg_09",
    "pkg_04",
    "pkg_05",
    "pkg_00",
    "pkg_02c",
    "pkg_06c",
  ]);
  ids.forEach((id) => assert.ok(getPoolDetailWorkspace(id), id));
});

test("pool detail resolves codes case-insensitively and rejects unknown ids", () => {
  assert.equal(getPoolDetailWorkspace("PKG-01")?.poolId, "pkg_01");
  assert.equal(getPoolDetailWorkspace("pkg-02")?.poolId, "pkg_02");
  assert.equal(getPoolDetailWorkspace(" nope "), null);
});

test("trading pool fixture matches the I-2 headline figures", () => {
  const w = fresh();
  assert.equal(w.mode, "demo");
  assert.equal(w.asOf, AS_OF);
  assert.equal(w.overview.code, "PKG-01");
  assert.equal(w.overview.lifecycle, "trading");
  assert.equal(w.overview.goal, 50000);
  assert.equal(w.overview.raised, 36000);
  assert.equal(w.overview.slotPrice, 3000);
  assert.equal(w.overview.slotsFilled, 12);
  assert.equal(w.overview.slotsTotal, 25);
  assert.equal(w.overview.investors, 6);
  assert.equal(w.overview.profitSharePct, 30);
  assert.equal(detailFillPct(w.overview.raised, w.overview.goal), 72);
});

test("trading pool investment block reconciles to the profit share", () => {
  const w = fresh();
  const inv = w.investment;
  assert.ok(inv);
  assert.equal(inv.slots, 5);
  assert.equal(inv.investment, 15000);
  assert.equal(inv.sharePct, 41.7);
  assert.equal(inv.tokens, 150000);
  assert.equal(inv.pnl, 1260);
  assert.equal(inv.grossEarnings, 1260);
  assert.equal(inv.platformCutPct, 20);
  assert.equal(inv.platformCut, 252);
  assert.equal(inv.netEarnings, 1008);
  assert.equal(inv.roiPct, 6.72);
  assert.equal(sumDaily(inv.daily), 1260);
  assert.equal(inv.daily.length, 14);
  assert.equal(roiOn(inv.investment, inv.netEarnings), 6.72);
  assert.equal(withdrawableNet(inv), 1008);
});

test("pool performance block is internally consistent", () => {
  const w = fresh();
  const perf = w.performance;
  assert.ok(perf);
  assert.equal(perf.trades, 148);
  assert.equal(perf.wins, 101);
  assert.equal(perf.losses, 47);
  assert.equal(perf.wins + perf.losses, perf.trades);
  assert.equal(perf.openTrades, 1);
  assert.equal(perf.winRatePct, 68.2);
  assert.equal(perf.maxDrawdownPct, 2.8);
  assert.equal(perf.guardianTriggers, 2);
  assert.equal(perf.recoveredInLabel, "4h 18m");
  assert.equal(perf.avgTradeDurationSec, 18);
  assert.equal(perf.curve.length, 15);
  assert.equal(perf.curve[perf.curve.length - 1].value, perf.totalPnl);
  assert.ok(perf.best.pnl > 0);
  assert.ok(perf.worst.pnl < 0);
});

test("guardian policy and trigger history agree with the overview summary", () => {
  const w = fresh();
  assert.equal(w.guardian.drawdownLimitPct, 5);
  assert.equal(w.guardian.maxConsecutiveLosses, 8);
  assert.equal(w.guardian.rotation, true);
  assert.equal(w.guardian.triggersTotal, 2);
  assert.equal(w.guardian.events.length, 4);
  assert.ok(
    w.guardian.events.filter((event) => event.kind === "trigger").length ===
      w.guardian.triggersTotal,
  );
  assert.equal(drawdownHeadroom(1.8, 5), 3.2);
});

test("participants reconcile with committed capital for every pool", () => {
  listPoolDetailIds().forEach((id) => {
    const w = getPoolDetailWorkspace(id);
    assert.ok(w, id);
    const { participants, overview } = w;
    assert.equal(
      participants.slotsFilled,
      overview.slotsFilled,
      `${id} slots filled`,
    );
    assert.equal(
      participants.slotsTotal,
      overview.slotsTotal,
      `${id} slots total`,
    );
    if (participants.showRows) {
      const rowSum =
        participants.rows.reduce((sum, row) => sum + row.investment, 0) +
        (participants.tail?.investment ?? 0);
      assert.equal(
        Number(rowSum.toFixed(2)),
        participants.committed,
        `${id} rows reconcile`,
      );
      assert.equal(
        Number(
          participants.rows
            .reduce((sum, row) => sum + row.sharePct, 0)
            .toFixed(1),
        ) > 0,
        true,
      );
    } else {
      assert.equal(participants.rows.length, 0);
      assert.ok(participants.bands.length >= 1);
      const bandTotal = Number(
        participants.bands
          .reduce((sum, band) => sum + band.sharePct, 0)
          .toFixed(1),
      );
      assert.ok(
        bandTotal >= 99.5 && bandTotal <= 100.5,
        `${id} bands total ~100% (${bandTotal})`,
      );
    }
  });
});

test("open pool exposes a booking and expected projection", () => {
  const w = fresh("pkg_02");
  assert.equal(w.overview.lifecycle, "open");
  assert.equal(w.booking?.slots, 2);
  assert.equal(w.booking?.amount, 10000);
  assert.equal(w.booking?.payment, "verified");
  assert.equal(w.booking?.available, 8);
  assert.equal(w.projection?.roiPct, 18);
  assert.equal(w.projection?.projectedProfit, 1800);
  assert.equal(w.investment, null);
  assert.equal(w.performance, null);
});

test("upcoming pool has no booking, interest or performance", () => {
  const w = fresh("pkg_04");
  assert.equal(w.overview.lifecycle, "upcoming");
  assert.equal(w.booking, null);
  assert.equal(w.interest, null);
  assert.equal(w.performance, null);
  assert.equal(w.projection?.days, 7);
  assert.equal(w.participants.showRows, false);
});

test("completed pool keeps a settled position and payout-ready net", () => {
  const w = fresh("pkg_00");
  assert.equal(w.overview.lifecycle, "completed");
  assert.equal(w.overview.raised, w.overview.goal);
  assert.ok(w.investment);
  assert.ok(w.investment.netEarnings > 0);
  assert.equal(w.projection, null);
  assert.equal(w.performance?.trades, 212);
  assert.ok(w.documents.length >= 5);
});

test("every pool ships documents, schedule, related pools and events", () => {
  listPoolDetailIds().forEach((id) => {
    const w = getPoolDetailWorkspace(id);
    assert.ok(w.documents.length >= 3, `${id} documents`);
    assert.ok(w.schedule.length >= 5, `${id} schedule`);
    assert.ok(w.related.length >= 3, `${id} related`);
    assert.ok(w.events.length >= 2, `${id} events`);
    assert.ok(w.profile.displayName.length > 0);
    assert.equal(w.revision, 0);
    assert.deepEqual(w.audit, []);
  });
});

/* ── Selectors ── */

test("fill, share and elapsed selectors clamp to sane ranges", () => {
  assert.equal(detailFillPct(36000, 50000), 72);
  assert.equal(detailFillPct(-10, 50000), 0);
  assert.equal(detailFillPct(90000, 50000), 100);
  assert.equal(detailFillPct(10, 0), 100);
  assert.equal(capitalSharePct(15000, 36000), 41.7);
  assert.equal(
    tradingElapsedPct("2026-10-11T10:00:00Z", "2026-10-21T10:00:00Z", AS_OF),
    100,
  );
  assert.equal(
    tradingElapsedPct("2026-10-24T10:00:00Z", "2026-10-21T10:00:00Z", AS_OF),
    100,
  );
  assert.equal(
    tradingElapsedPct("2026-10-13T10:00:00Z", "2026-10-23T10:00:00Z", AS_OF),
    100,
  );
});

test("countdown and relative labels match the snapshot clock", () => {
  const countdown = countdownFrom("2026-10-29T14:32:00Z", AS_OF);
  assert.equal(countdown.total, 534720);
  assert.equal(countdown.days, 6);
  assert.equal(countdown.label, "6d 4h 32m");
  assert.equal(countdownFrom("2026-10-01T00:00:00Z", AS_OF).label, "0d 0h 0m");
  assert.equal(relativeTo("2026-10-23T09:55:00Z", AS_OF), "5m ago");
  assert.equal(relativeTo("2026-10-23T09:00:00Z", AS_OF), "1h ago");
  assert.equal(relativeTo("2026-10-22T09:00:00Z", AS_OF), "yesterday");
  assert.equal(relativeTo("2026-10-20T09:00:00Z", AS_OF), "3d ago");
});

test("money helpers stay exact", () => {
  assert.equal(sumDaily([]), 0);
  assert.equal(roiOn(15000, 1008), 6.72);
  assert.equal(roiOn(100, 50), 50);
  assert.equal(drawdownHeadroom(1.8, 5), 3.2);
  assert.equal(drawdownHeadroom(5, 5), 0);
  assert.equal(durationLabel(18), "18s");
  assert.equal(durationLabel(258 * 60), "258m 0s");
  assert.equal(hoursUntil("2026-10-24T10:00:00Z", AS_OF), 24);
});

test("withdrawable net subtracts paid and drafted amounts", () => {
  const inv = { ...fresh().investment };
  assert.equal(withdrawableNet(inv), 1008);
  assert.equal(withdrawableNet({ ...inv, paidOut: 500 }), 508);
  assert.equal(withdrawableNet({ ...inv, pendingPayout: 400 }), 608);
  assert.equal(
    withdrawableNet({ ...inv, paidOut: 800, pendingPayout: 400 }),
    0,
  );
  assert.equal(withdrawableNet(null), 0);
});

/* ── Commands ── */

test("manual refresh bumps the revision and writes an audit entry", () => {
  const next = apply(fresh(), { kind: "refreshDetail", source: "manual" }, NOW);
  assert.equal(next.revision, 1);
  assert.equal(next.audit.length, 1);
  assert.equal(next.audit[0].action, "pool_detail_refresh");
  assert.equal(next.audit[0].at, NOW);
});

test("auto refresh never throws while auto-refresh is enabled", () => {
  const next = apply(fresh(), { kind: "refreshDetail", source: "auto" }, NOW);
  assert.equal(next.revision, 1);
  assert.equal(next.audit.length, 0);
});

test("book slots on an open pool raises committed capital and holds capacity", () => {
  const before = fresh("pkg_02");
  const next = apply(before, { kind: "bookSlots", slots: 2 }, NOW);
  assert.equal(next.overview.raised, before.overview.raised + 2 * 5000);
  assert.equal(next.overview.slotsFilled, before.overview.slotsFilled + 2);
  assert.equal(next.booking?.slots, 4);
  assert.equal(next.booking?.amount, 20000);
  assert.equal(next.booking?.available, 6);
  assert.equal(next.booking?.payment, "pending");
  assert.equal(next.booking?.bookedAt, NOW);
  assert.equal(next.audit[0].action, "book_slots_preview");
  assert.equal(next.revision, 1);
});

test("book slots rejects closed cycles and over-allocation", () => {
  assert.throws(
    () => apply(fresh(), { kind: "bookSlots", slots: 1 }, NOW),
    /already trading/,
  );
  assert.throws(
    () => apply(fresh("pkg_04"), { kind: "bookSlots", slots: 1 }, NOW),
    /Booking opens/,
  );
  assert.throws(
    () => apply(fresh("pkg_00"), { kind: "bookSlots", slots: 1 }, NOW),
    /closed/,
  );
  assert.throws(
    () => apply(fresh("pkg_02"), { kind: "bookSlots", slots: 9 }, NOW),
    /Only 8 slot/,
  );
  assert.throws(
    () => poolDetailCommandSchema.parse({ kind: "bookSlots", slots: 0 }),
    /too_small/,
  );
});

test("payout drafts respect available net and the platform minimum", () => {
  const next = apply(
    fresh(),
    { kind: "draftPayout", amount: 400, method: "usdt" },
    NOW,
  );
  assert.equal(next.payouts.length, 1);
  assert.equal(next.payouts[0].amount, 400);
  assert.equal(next.payouts[0].method, "usdt");
  assert.equal(next.payouts[0].status, "draft");
  assert.equal(next.investment.pendingPayout, 400);
  assert.equal(withdrawableNet(next.investment), 608);
  assert.equal(next.audit[0].action, "payout_draft");

  assert.throws(
    () =>
      apply(
        fresh(),
        { kind: "draftPayout", amount: 5000, method: "bank" },
        NOW,
      ),
    /Only \$1008\.00 is available/,
  );
  assert.throws(
    () =>
      apply(fresh(), { kind: "draftPayout", amount: 50, method: "bank" }, NOW),
    /too_small/,
  );
  assert.throws(
    () =>
      apply(
        fresh("pkg_02"),
        { kind: "draftPayout", amount: 500, method: "bank" },
        NOW,
      ),
    /no settled net earnings/,
  );
});

test("reminders validate the window and reject duplicates", () => {
  const withReminder = apply(
    fresh("pkg_02"),
    { kind: "setReminder", leadDays: 1, channel: "email" },
    NOW,
  );
  assert.equal(withReminder.reminders.length, 1);
  assert.equal(withReminder.reminders[0].leadDays, 1);
  assert.equal(withReminder.reminders[0].channel, "email");
  assert.equal(withReminder.audit[0].action, "set_reminder");

  assert.throws(
    () =>
      apply(
        withReminder,
        { kind: "setReminder", leadDays: 1, channel: "in_app" },
        NOW,
      ),
    /already exists/,
  );
  assert.throws(
    () =>
      apply(
        fresh("pkg_00"),
        { kind: "setReminder", leadDays: 2, channel: "email" },
        NOW,
      ),
    /cycle is closed/,
  );
});

test("projections are stored newest-first and capped at ten", () => {
  let w = fresh("pkg_02");
  for (let i = 0; i < 12; i += 1) {
    w = apply(
      w,
      { kind: "saveProjection", principal: 5000, roiPct: 18, days: 21 },
      NOW,
    );
  }
  assert.equal(w.projections.length, 10);
  assert.equal(w.projections[0].projectedProfit, 900);
  assert.equal(w.projections[0].createdAt, NOW);
  assert.equal(w.revision, 12);
  assert.throws(
    () =>
      apply(
        fresh("pkg_02"),
        { kind: "saveProjection", principal: 100, roiPct: 18, days: 21 },
        NOW,
      ),
    /too_small/,
  );
});

test("alert preferences require at least one channel", () => {
  const next = apply(
    fresh(),
    { kind: "savePreferences", email: false, inApp: true, endingSoonHours: 24 },
    NOW,
  );
  assert.equal(next.preferences.email, false);
  assert.equal(next.preferences.in_app, true);
  assert.equal(next.preferences.endingSoonHours, 24);
  assert.equal(next.audit[0].action, "save_preferences");
  assert.throws(
    () =>
      apply(
        fresh(),
        {
          kind: "savePreferences",
          email: false,
          inApp: false,
          endingSoonHours: 24,
        },
        NOW,
      ),
    /at least one delivery channel/,
  );
});

test("interest registration is limited to upcoming pools and once per pool", () => {
  const next = apply(
    fresh("pkg_04"),
    { kind: "prebookInterest", slots: 2 },
    NOW,
  );
  assert.equal(next.interest?.slots, 2);
  assert.equal(next.interest?.amount, 4000);
  assert.equal(next.overview.raised, 16000);
  assert.equal(next.overview.slotsFilled, 8);
  assert.equal(next.audit[0].action, "prebook_interest");
  assert.throws(
    () => apply(next, { kind: "prebookInterest", slots: 1 }, NOW),
    /already registered/,
  );
  assert.throws(
    () => apply(fresh("pkg_02"), { kind: "prebookInterest", slots: 1 }, NOW),
    /open for bookings/,
  );
  assert.throws(
    () => apply(fresh("pkg_04"), { kind: "prebookInterest", slots: 9 }, NOW),
    /Maximum 5 slot/,
  );
  assert.throws(
    () => apply(fresh("pkg_04"), { kind: "prebookInterest", slots: 0 }, NOW),
    /too_small/,
  );
});

test("watch, support and export commands record local state only", () => {
  const watched = apply(fresh(), { kind: "setWatch", watching: true }, NOW);
  assert.equal(watched.watching, true);
  assert.equal(watched.audit[0].action, "watch_pool");
  const unwatched = apply(watched, { kind: "setWatch", watching: false }, NOW);
  assert.equal(unwatched.watching, false);
  assert.equal(unwatched.audit[0].action, "unwatch_pool");

  const support = apply(
    fresh(),
    {
      kind: "support",
      topic: "payment",
      message: "Please confirm the payment reference for my slot.",
    },
    NOW,
  );
  assert.equal(support.support.length, 1);
  assert.equal(support.support[0].status, "local_draft");
  assert.equal(support.audit[0].action, "support_draft");
  assert.throws(
    () =>
      apply(
        fresh(),
        { kind: "support", topic: "pool", message: "too short" },
        NOW,
      ),
    /too_small/,
  );

  const exported = apply(
    fresh(),
    { kind: "recordExport", scope: "trade-ledger", format: "csv", count: 148 },
    NOW,
  );
  assert.equal(exported.audit[0].action, "export_prepared");
  assert.match(exported.audit[0].detail, /CSV \(148 record/);
  assert.throws(
    () =>
      poolDetailCommandSchema.parse({
        kind: "recordExport",
        scope: "everything",
        format: "csv",
        count: 1,
      }),
    /Invalid option/,
  );
});

test("commands never mutate the incoming workspace", () => {
  const before = fresh();
  const snapshot = JSON.stringify(before);
  apply(before, { kind: "setWatch", watching: true }, NOW);
  apply(before, { kind: "draftPayout", amount: 250, method: "bank" }, NOW);
  assert.equal(JSON.stringify(before), snapshot);
});

test("audit log is capped and newest-first", () => {
  let w = fresh();
  for (let i = 0; i < 45; i += 1) {
    w = apply(w, { kind: "setWatch", watching: i % 2 === 0 }, NOW);
  }
  assert.equal(w.audit.length, 40);
  assert.equal(w.revision, 45);
  assert.ok(Date.parse(w.audit[0].at) <= Date.parse(w.audit[1].at));
});

test("command schema rejects unknown kinds and empty payloads", () => {
  assert.throws(
    () => poolDetailCommandSchema.parse({ kind: "teleport" }),
    /Invalid/,
  );
  assert.throws(() => poolDetailCommandSchema.parse({}), /Invalid/);
  assert.throws(
    () => poolDetailCommandSchema.parse({ kind: "bookSlots", slots: 11 }),
    /too_big/,
  );
});

/* ── Route & UI wiring ── */

test("detail API route is read-only and validates the section filter", () => {
  const source = fs.readFileSync(
    "src/app/api/investor/pools/[id]/route.ts",
    "utf8",
  );
  assert.match(source, /export function GET/);
  assert.doesNotMatch(
    source,
    /export (async )?function (POST|PUT|PATCH|DELETE)/,
  );
  assert.match(source, /Cache-Control": "no-store"/);
  assert.match(source, /"workspace"/);
  [
    "overview",
    "investment",
    "performance",
    "guardian",
    "participants",
    "trades",
    "schedule",
    "documents",
    "events",
  ].forEach((section) => assert.match(source, new RegExp(`"${section}"`)));
  assert.match(source, /getPoolDetailWorkspace/);
});

test("page route wires the workspace and 404s unknown pools", () => {
  const source = fs.readFileSync(
    "src/app/investor/pools/[id]/page.tsx",
    "utf8",
  );
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /getPoolDetailWorkspace/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /InvestorPoolDetailPage/);
  assert.doesNotMatch(source, /redirect\(/);
});

test("page component mounts the shell, drawer and 25 modal surfaces", () => {
  const source = fs.readFileSync(
    "src/components/investor/investor-pool-detail-page.tsx",
    "utf8",
  );
  assert.match(source, /<InvestorShell/);
  assert.match(source, /<DeskModalShell/);
  assert.match(source, /op-drawer-backdrop/);
  assert.match(source, /useDeskTable/);
  assert.match(source, /usePoolDetail/);
  assert.ok(
    (source.match(/modal\.kind === "/g) ?? []).length >= 24,
    "one body per modal kind",
  );
  assert.equal((source.match(/className="pd-quick-card"/g) ?? []).length, 4);
  assert.match(source, /pd-quick-links/);
});

test("page stylesheet is light, scoped and gradient-free", () => {
  const css = fs.readFileSync(
    "src/styles/pages/investor-pool-detail.css",
    "utf8",
  );
  assert.match(css, /\.page-investor-pool-detail \.pd-page/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(css, /@media \(max-width: 575\.98px\)/);
  assert.match(css, /prefers-reduced-motion/);
  const globals = fs.readFileSync("src/app/globals.css", "utf8");
  assert.match(globals, /investor-pool-detail\.css/);
});
