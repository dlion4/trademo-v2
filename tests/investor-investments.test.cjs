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

const { getInvestmentsWorkspace } = load(
  "src/server/services/investor-investments-service.ts",
);
const inv = load("src/lib/investor/investments.ts");

const read = (file) =>
  fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const workspace = getInvestmentsWorkspace();
const asOf = inv.INVESTMENTS_AS_OF;

/* ── Fixture and reconciliation ── */

test("the investments workspace ships a full book in demo mode", () => {
  assert.equal(workspace.mode, "demo");
  assert.equal(workspace.asOf, "2026-10-23T10:00:00Z");
  assert.equal(workspace.active.length, 2);
  assert.equal(workspace.completed.length, 3);
  assert.equal(workspace.booked.length, 3);
  assert.ok(workspace.payouts.length >= 4);
  assert.equal(workspace.timeline.length, 22);
  assert.equal(workspace.documents.length, 8);
  assert.ok(workspace.allocations.length >= 6);
  assert.equal(workspace.payoutPolicy.length, 4);
  assert.ok(workspace.milestones.length >= 4);
  assert.equal(workspace.profile.kycLevel, "L2");
});

test("active positions reconcile with the pool book exactly", () => {
  const [basic, aggressive] = workspace.active;
  assert.equal(basic.code, "PKG-01");
  assert.equal(basic.name, "Basic Growth");
  assert.equal(basic.slots, 5);
  assert.equal(basic.slotPrice, 3000);
  assert.equal(basic.investment, 15000);
  assert.equal(basic.sharePct, 30);
  assert.equal(basic.netEarned, 1260);
  assert.equal(basic.grossEarned, 1575);
  assert.equal(basic.platformCut, 315);
  assert.equal(basic.currentValue, 16260);
  assert.equal(basic.roiPct, 8.4);

  assert.equal(aggressive.code, "PKG-03");
  assert.equal(aggressive.slots, 1);
  assert.equal(aggressive.investment, 10000);
  assert.equal(aggressive.sharePct, 10);
  assert.equal(aggressive.netEarned, 1350);
  assert.equal(aggressive.platformCut, 337.5);
  assert.equal(aggressive.currentValue, 11350);
  assert.equal(aggressive.roiPct, 13.5);
});

test("the platform cut is always 20% of gross on every position", () => {
  for (const row of workspace.active) {
    assert.equal(
      row.platformCut,
      inv.round2(row.grossEarned * (inv.PLATFORM_CUT_PCT / 100)),
      `${row.code} cut`,
    );
    assert.equal(
      row.netEarned,
      inv.round2(row.grossEarned - row.platformCut),
      `${row.code} net`,
    );
  }
  for (const row of workspace.completed) {
    assert.equal(
      row.platformCut,
      inv.round2(row.grossEarnings * (inv.PLATFORM_CUT_PCT / 100)),
      `${row.code} cut`,
    );
    assert.equal(
      row.netEarnings,
      inv.round2(row.grossEarnings - row.platformCut),
      `${row.code} net`,
    );
  }
});

test("completed cycles keep their payout reference and final ROI", () => {
  const genesis = workspace.completed.find((row) => row.code === "PKG-00");
  assert.equal(genesis.investment, 9000);
  assert.equal(genesis.grossEarnings, 1476);
  assert.equal(genesis.platformCut, 295.2);
  assert.equal(genesis.netEarnings, 1180.8);
  assert.equal(genesis.userRoiPct, 13.12);
  assert.equal(genesis.payoutStatus, "paid");
  assert.equal(genesis.payoutRef, "PO-2026-10-11-0031");
  for (const row of workspace.completed) {
    assert.equal(row.stage, "completed");
    assert.ok(row.payoutRef.startsWith("PO-2026-"));
    assert.ok(row.paidAt);
  }
});

test("booked slots separate confirmed, pending and interest", () => {
  const confirmed = workspace.booked.find((row) => row.code === "PKG-02");
  const pending = workspace.booked.find((row) => row.code === "PKG-09");
  const interest = workspace.booked.find((row) => row.code === "PKG-04");
  assert.equal(confirmed.stage, "booked");
  assert.equal(confirmed.paymentStatus, "verified");
  assert.equal(confirmed.amount, 10000);
  assert.equal(pending.paymentStatus, "pending");
  assert.equal(interest.stage, "interest");
  assert.equal(interest.paymentStatus, "not_required");
  assert.equal(interest.amount, 6000);
});

/* ── Summary maths ── */

test("computeSummary adds every section of the book", () => {
  const summary = inv.computeSummary(workspace);
  assert.equal(summary.totalInvested, 58500);
  assert.equal(summary.activeCapital, 25000);
  assert.equal(summary.activePools, 2);
  assert.equal(summary.completedCapital, 21000);
  assert.equal(summary.completedCount, 3);
  assert.equal(summary.completedNet, 2419.2);
  assert.equal(summary.bookedCapital, 12500);
  assert.equal(summary.bookedCount, 2);
  assert.equal(summary.interestCapital, 6000);
  assert.equal(summary.interestCount, 1);
  assert.equal(summary.positionCount, 8);
  assert.equal(summary.totalEarned, 5029.2);
  assert.equal(summary.pendingPayoutAmount, 118.5);
  assert.equal(summary.pendingPayoutCount, 1);
  assert.equal(summary.paidPayoutAmount, 2419.2);
  assert.equal(summary.deployedCapital, 46000);
  assert.equal(summary.overallRoiPct, 10.93);
});

test("total invested equals active + settled + booked capital", () => {
  const summary = inv.computeSummary(workspace);
  assert.equal(
    summary.totalInvested,
    inv.round2(
      summary.activeCapital + summary.completedCapital + summary.bookedCapital,
    ),
  );
  assert.equal(summary.deployedCapital, summary.activeCapital + 21000);
});

test("total earned splits cleanly into paid and accrued", () => {
  const summary = inv.computeSummary(workspace);
  const accrued = inv.round2(summary.totalEarned - summary.completedNet);
  assert.equal(accrued, 2610);
  assert.equal(
    accrued,
    workspace.active[0].netEarned + workspace.active[1].netEarned,
  );
});

test("a settled position counts toward total invested but not active capital", () => {
  const summary = inv.computeSummary(workspace);
  assert.ok(summary.totalInvested > summary.activeCapital);
  assert.equal(summary.totalInvested - summary.activeCapital, 33500);
  assert.equal(summary.interestCapital, 6000);
});

test("overall ROI is earnings over deployed capital", () => {
  const summary = inv.computeSummary(workspace);
  assert.equal(
    summary.overallRoiPct,
    Number(((summary.totalEarned / summary.deployedCapital) * 100).toFixed(2)),
  );
});

/* ── Payout lock, eligibility, fee ── */

test("PKG-01 has unlocked its payout lock and is eligible", () => {
  const row = workspace.active[0];
  const lock = inv.payoutEligibility(row, asOf);
  assert.equal(lock.unlockAt, "2026-10-21T14:32:00.000Z");
  assert.equal(lock.available, 1140);
  assert.equal(lock.eligible, true);
});

test("PKG-03 is still inside its ten day lock", () => {
  const row = workspace.active[1];
  const lock = inv.payoutEligibility(row, asOf);
  assert.equal(lock.eligible, false);
  assert.equal(lock.daysUntilUnlock, 2);
  assert.equal(lock.available, 1350);
});

test("available payout is net earnings minus what was already requested", () => {
  const row = { ...workspace.active[0], requestedPayout: 500 };
  assert.equal(inv.payoutEligibility(row, asOf).available, 760);
  const locked = inv.payoutEligibility({ ...row, requestedPayout: 5000 }, asOf);
  assert.equal(locked.available, 0);
});

test("payoutDraftError walks the rules in order", () => {
  const base = {
    amount: 200,
    available: 1140,
    unlocked: true,
    method: "bank",
    bankAccount: "Bank transfer **** 8842",
    terms: true,
  };
  assert.equal(
    inv.payoutDraftError({ ...base, unlocked: false }),
    "This position is still inside its payout lock window",
  );
  assert.equal(
    inv.payoutDraftError({ ...base, amount: 0 }),
    "Enter a payout amount",
  );
  assert.equal(
    inv.payoutDraftError({ ...base, amount: 20 }),
    "Payouts start at $50",
  );
  assert.equal(
    inv.payoutDraftError({ ...base, amount: 5000 }),
    "Only $1,140.00 is available on this position",
  );
  assert.equal(
    inv.payoutDraftError({ ...base, bankAccount: "   " }),
    "Add a bank account before requesting a bank payout",
  );
  assert.equal(
    inv.payoutDraftError({ ...base, terms: false }),
    "Acknowledge the payout terms to continue",
  );
  assert.equal(inv.payoutDraftError(base), "");
});

test("bank payouts are charged 0.6% clamped to $1.50–$12, wallet is free", () => {
  assert.equal(inv.payoutFee(100, "bank"), 1.5);
  assert.equal(inv.payoutFee(1140, "bank"), 6.84);
  assert.equal(inv.payoutFee(5000, "bank"), 12);
  assert.equal(inv.payoutFee(1140, "wallet"), 0);
});

test("suggestedPayout rounds to whole dollars and respects the minimum", () => {
  assert.equal(inv.suggestedPayout(1140), 1140);
  assert.equal(inv.suggestedPayout(407.4), 400);
  assert.equal(inv.suggestedPayout(12), 10);
  assert.equal(inv.suggestedPayout(0), 0);
});

/* ── Timeline ── */

test("the timeline is newest first and grouped by calendar day", () => {
  const groups = inv.groupTimeline(workspace.timeline);
  const flat = groups.flatMap((group) => group.events);
  assert.ok(flat.length >= 20);
  for (let i = 1; i < flat.length; i += 1) {
    assert.ok(flat[i - 1].at >= flat[i].at, "descending order");
  }
  assert.ok(groups.every((group) => group.events.length >= 1));
  assert.equal(groups[0].day, workspace.timeline[0].at.slice(0, 10));
});

test("timeline filters match kind chips and free text", () => {
  const payouts = inv.filterTimeline(workspace.timeline, {
    kinds: ["payout"],
    query: "",
  });
  assert.ok(payouts.length >= 2);
  assert.ok(payouts.every((row) => row.kind === "payout"));
  const search = inv.filterTimeline(workspace.timeline, {
    kinds: [],
    query: "pkg-01",
  });
  assert.ok(search.length >= 3);
  assert.ok(
    search.every((row) =>
      `${row.title} ${row.detail} ${row.poolCode ?? ""}`
        .toLowerCase()
        .includes("pkg-01"),
    ),
  );
  assert.equal(
    inv.filterTimeline(workspace.timeline, { kinds: [], query: "" }).length,
    workspace.timeline.length,
  );
});

test("countdown renders days, hours and minutes with a readable label", () => {
  const remaining = inv.countdown("2026-10-29T14:32:00Z", asOf);
  assert.equal(remaining.total > 0, true);
  assert.match(remaining.label, /\d+d \d+h \d+m/);
  assert.match(remaining.clock, /^\d{2}:\d{2}:\d{2}$/);
  const done = inv.countdown("2026-10-01T00:00:00Z", asOf);
  assert.equal(done.total, 0);
});

/* ── Commands ── */

const run = (command) => inv.applyInvestmentsCommand(workspace, command);

test("requestPayout queues a processing payout and reduces availability", () => {
  const next = run({
    kind: "requestPayout",
    investmentId: workspace.active[0].id,
    amount: 497,
    method: "bank",
    note: "",
  });
  assert.equal(
    next.payouts.filter((row) => row.status === "processing").length,
    2,
  );
  assert.equal(next.revision, workspace.revision + 1);
  assert.match(next.timeline[0].title, /Payout requested/);
  assert.match(next.timeline[0].title, /\$497/);
  const summary = inv.computeSummary(next);
  assert.ok(summary.pendingPayoutAmount > 118.5);
  assert.equal(next.summary.pendingPayoutAmount, summary.pendingPayoutAmount);
});

test("requestPayout rejects an amount below the minimum", () => {
  assert.throws(() =>
    run({
      kind: "requestPayout",
      investmentId: workspace.active[0].id,
      amount: 10,
      method: "wallet",
      note: "",
    }),
  );
});

test("cancelPayout cancels the request and returns the balance", () => {
  const pending = workspace.payouts.find((row) => row.status === "processing");
  const next = run({
    kind: "cancelPayout",
    payoutId: pending.id,
    reason: "faster_route",
  });
  const cancelled = next.payouts.find((row) => row.id === pending.id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(inv.computeSummary(next).pendingPayoutAmount, 0);
  assert.match(next.timeline[0].detail, /faster route requested/);
});

test("retryPayout puts a cancelled payout back into processing", () => {
  const cancelled = run({
    kind: "cancelPayout",
    payoutId: workspace.payouts.find((row) => row.status === "processing").id,
    reason: "other",
  });
  const target = cancelled.payouts.find((row) => row.status === "cancelled");
  const retried = inv.applyInvestmentsCommand(cancelled, {
    kind: "retryPayout",
    payoutId: target.id,
  });
  assert.equal(
    retried.payouts.find((row) => row.id === target.id).status,
    "processing",
  );
  assert.equal(inv.computeSummary(retried).pendingPayoutCount, 1);
});

test("cancelInterest removes a registered interest slot and its capital", () => {
  const interest = workspace.booked.find((row) => row.stage === "interest");
  const next = run({
    kind: "cancelInterest",
    bookedId: interest.id,
    reason: "timing",
  });
  assert.equal(
    next.booked.some((row) => row.id === interest.id),
    false,
  );
  assert.equal(inv.computeSummary(next).interestCount, 0);
  assert.equal(inv.computeSummary(next).interestCapital, 0);
});

test("saveReminder and clearReminder round trip on a booking", () => {
  const booking = workspace.booked.find((row) => row.stage === "booked");
  const saved = run({
    kind: "saveReminder",
    bookedId: booking.id,
    leadDays: 3,
    channel: "in_app",
  });
  assert.equal(
    saved.booked.find((row) => row.id === booking.id).reminder.leadDays,
    3,
  );
  assert.equal(
    saved.booked.find((row) => row.id === booking.id).reminder.channel,
    "in_app",
  );
  const cleared = inv.applyInvestmentsCommand(saved, {
    kind: "clearReminder",
    bookedId: booking.id,
  });
  assert.equal(
    cleared.booked.find((row) => row.id === booking.id).reminder,
    null,
  );
});

test("savePreferences stores every toggle", () => {
  const next = run({
    kind: "savePreferences",
    emailStatements: false,
    autoReinvest: true,
    payoutLeadDays: 7,
    reminderChannel: "in_app",
    hideCompleted: true,
  });
  assert.equal(next.preferences.emailStatements, false);
  assert.equal(next.preferences.autoReinvest, true);
  assert.equal(next.preferences.payoutLeadDays, 7);
  assert.equal(next.preferences.hideCompleted, true);
});

test("saveFilters stores the kind chips and query", () => {
  const next = run({
    kind: "saveFilters",
    kinds: ["trade", "payout"],
    query: "pkg",
  });
  assert.deepEqual(next.filters.kinds, ["trade", "payout"]);
  assert.equal(next.filters.query, "pkg");
  const cleared = inv.applyInvestmentsCommand(next, {
    kind: "saveFilters",
    kinds: [],
    query: "",
  });
  assert.deepEqual(cleared.filters.kinds, []);
});

test("acknowledge records a scoped, audited acknowledgement event", () => {
  const next = run({ kind: "acknowledge", scope: "risk" });
  assert.equal(next.audit[0].action, "acknowledged");
  assert.match(next.audit[0].detail, /Risk disclosure acknowledged locally/);
  assert.doesNotMatch(next.timeline[0].detail, /acknowledged/i);
  const settlement = inv.applyInvestmentsCommand(next, {
    kind: "acknowledge",
    scope: "settlement",
  });
  assert.match(settlement.audit[0].detail, /Settlement terms/);
  assert.equal(settlement.audit.length, next.audit.length + 1);
});

test("exportReport appends an audited export record", () => {
  const next = run({
    kind: "exportReport",
    scope: "statement",
    format: "csv",
    count: workspace.completed.length,
    investmentId: workspace.completed[0].id,
  });
  assert.equal(next.exports.length, workspace.exports.length + 1);
  assert.equal(next.exports[0].format, "csv");
  assert.equal(next.exports[0].scope, "statement");
});

test("addNote stores a journal note and rejects a too short body", () => {
  const next = run({
    kind: "addNote",
    investmentId: workspace.active[1].id,
    body: "Watch the R_75 drawdown before the next batch.",
  });
  assert.equal(next.notes.length, workspace.notes.length + 1);
  assert.equal(next.notes[0].poolCode, "PKG-03");
  assert.throws(() =>
    run({
      kind: "addNote",
      investmentId: workspace.active[1].id,
      body: "short",
    }),
  );
});

test("support and unknown commands are validated by the schema", () => {
  const next = run({
    kind: "support",
    topic: "payout",
    message: "When does the 17:00 UTC batch clear a bank payout?",
  });
  assert.equal(next.support.length, workspace.support.length + 1);
  assert.throws(() => run({ kind: "support", topic: "payout", message: "hi" }));
  assert.throws(() => run({ kind: "notACommand" }));
});

test("every command clones the workspace instead of mutating the input", () => {
  const before = JSON.stringify(workspace);
  run({ kind: "acknowledge", scope: "settlement" });
  run({
    kind: "saveFilters",
    kinds: ["trade"],
    query: "",
  });
  assert.equal(JSON.stringify(workspace), before);
});

/* ── API route ── */

test("the API route is GET only and answers 405 to writes", () => {
  const route = read("src/app/api/investor/investments/route.ts");
  assert.match(route, /export function GET/);
  assert.match(route, /export const dynamic/);
  assert.match(route, /405/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
});

test("the API route exposes every documented section", () => {
  const route = read("src/app/api/investor/investments/route.ts");
  for (const section of [
    "workspace",
    "summary",
    "active",
    "completed",
    "booked",
    "payouts",
    "timeline",
    "documents",
    "notes",
    "allocations",
    "milestones",
    "kyc",
    "payoutPolicy",
    "profile",
  ]) {
    assert.match(route, new RegExp(`"${section}"`), `section ${section}`);
  }
});

/* ── Page, shell and stylesheet wiring ── */

test("the route page replaces the redirect stub and renders the workspace", () => {
  const page = read("src/app/investor/investments/page.tsx");
  assert.doesNotMatch(page, /redirect\(/);
  assert.match(page, /getInvestmentsWorkspace/);
  assert.match(page, /InvestorInvestmentsPage/);
  assert.match(page, /initialAction/);
  assert.match(page, /force-dynamic/);
});

test("the sidebar links to the investments page with its I-6 code", () => {
  const shell = read("src/components/investor/investor-shell.tsx");
  const group = shell.slice(shell.indexOf('group: "Portfolio"'));
  const block = group.slice(0, group.indexOf('group: "Account"'));
  assert.match(block, /href: "\/investor\/investments"/);
  assert.match(block, /code: "I-6"/);
  assert.match(block, /label: "My investments"/);
});

test("the page stylesheet is imported once and scoped to the page root", () => {
  const globals = read("src/app/globals.css");
  assert.equal(
    globals.split('@import "../styles/pages/investor-investments.css";').length,
    2,
  );
  const css = read("src/styles/pages/investor-investments.css");
  assert.match(css, /\.page-investor-investments \.im-page \{/);
  assert.ok(css.split("\n").length > 400, "stylesheet is substantive");
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});

test("the page component keeps its dialog, wizard and drawer surface", () => {
  const page = read("src/components/investor/investor-investments-page.tsx");
  assert.match(page, /DeskModalShell/);
  assert.match(page, /op-drawer-backdrop/);
  assert.ok(page.split("modal.kind ===").length > 20, "dialog branches");
  assert.ok(page.split('kind: "').length > 10, "command payloads");
  assert.match(page, /useInvestments/);
  assert.match(page, /useLiveCountUp/);
  assert.match(page, /InvestorShell/);
});

test("every dialog deep link resolves to a registered dialog kind", () => {
  const page = read("src/components/investor/investor-investments-page.tsx");
  const start = page.indexOf("const actionMap");
  const map = page.slice(start, page.indexOf("};", start));
  const kinds = [...map.matchAll(/^\s{2,6}(\w+): "([\w]+)",$/gm)].map(
    (match) => match[2],
  );
  assert.ok(kinds.length >= 20, `action map has ${kinds.length} links`);
  const declared = new Set([
    "activeDetail",
    "earnings",
    "payoutRequest",
    "payoutPolicy",
    "payoutHistory",
    "payoutDetails",
    "completedDetail",
    "statementExport",
    "bookingDetail",
    "addSlots",
    "cancelInterest",
    "reminder",
    "cancelPayout",
    "retryPayout",
    "preferences",
    "risk",
    "settlement",
    "kyc",
    "documents",
    "notes",
    "support",
    "allocation",
    "milestone",
    "help",
  ]);
  assert.ok(declared.size >= 24);
  for (const kind of kinds) {
    assert.ok(declared.has(kind), `unknown dialog kind ${kind}`);
  }
  assert.match(map, /payout: "payoutRequest"/);
});

test("the quick action dock carries at least four working destinations", () => {
  const page = read("src/components/investor/investor-investments-page.tsx");
  const dock = page.slice(
    page.indexOf("const quickActions"),
    page.indexOf("const sections"),
  );
  const keys = [...dock.matchAll(/key: "(\w+)"/g)].map((match) => match[1]);
  assert.ok(keys.length >= 4, `dock has ${keys.length} actions`);
  assert.match(
    page,
    /key === "pools"[\s\S]{0,80}router\.push\("\/investor\/pools"\)/,
  );
  assert.match(page, /key === "payout"[\s\S]{0,60}open\("payoutRequest"\)/);
  assert.match(
    page,
    /key === "statement"[\s\S]{0,60}open\("statementExport"\)/,
  );
});
