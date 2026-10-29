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
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (id) =>
    id.startsWith("@/")
      ? load("src/" + id.slice(2) + (id.endsWith(".tsx") ? "" : ".ts"))
      : id.startsWith("./")
        ? load(path.join(path.dirname(file), id) + ".ts")
        : require(id);
  new Function("exports", "require", "module", output)(mod.exports, req, mod);
  cache.set(file, mod.exports);
  return mod.exports;
}

const lib = load("src/lib/investor/earnings.ts");
const service = load("src/server/services/investor-earnings-service.ts");
const { getInvestmentsWorkspace } = load("src/server/services/investor-investments-service.ts");
const { getWalletWorkspace } = load("src/server/services/investor-wallet-service.ts");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const workspace = service.getEarningsWorkspace();
const investments = getInvestmentsWorkspace();
const wallet = getWalletWorkspace();
const component = read("src/components/investor/investor-earnings-page.tsx");
const css = read("src/styles/pages/investor-earnings.css");
const page = read("src/app/investor/earnings/page.tsx");
const api = read("src/app/api/investor/earnings/route.ts");
const csvRoute = read("src/app/api/earnings/export-csv/route.ts");
const pdfRoute = read("src/app/api/earnings/export-pdf/route.ts");
const taxRoute = read("src/app/api/earnings/tax-report/route.ts");
const hook = read("src/lib/investor/use-earnings.ts");

const totals = lib.poolTotals(workspace.pools);

/* ── Snapshot ── */

test("I-11 is pinned to the I-6 position book clock", () => {
  assert.equal(lib.EARNINGS_AS_OF, "2026-10-23T10:00:00Z");
  assert.equal(workspace.asOf, lib.EARNINGS_AS_OF);
  assert.equal(workspace.asOf, investments.asOf);
  assert.equal(workspace.mode, "demo");
  assert.equal(workspace.revision, 0);
});

test("the six KPIs are labelled exactly as the brief asks", () => {
  assert.equal(workspace.overview.length, 6);
  assert.deepEqual(
    workspace.overview.map((row) => row.label),
    [
      "Total earned lifetime",
      "This month earnings",
      "Average per pool",
      "Best pool",
      "Lowest pool",
      "Average ROI",
    ],
  );
  for (const row of workspace.overview) {
    assert.equal(typeof row.value, "number");
    assert.ok(row.hint.length > 0);
    assert.ok(row.detail.length > 0);
  }
});

/* ── Money identities ── */

test("every position satisfies gross − cut = net", () => {
  assert.equal(workspace.pools.length, 5);
  for (const pool of workspace.pools) {
    assert.equal(lib.round2(pool.gross - pool.cut), pool.net, `${pool.code} identity`);
    assert.equal(lib.round2(pool.gross * 0.2), pool.cut, `${pool.code} is cut at 20%`);
  }
});

test("the totals roll up to the I-6 position book", () => {
  assert.equal(totals.net, investments.summary.totalEarned);
  assert.equal(totals.net, 5029.2);
  assert.equal(totals.live, 2610);
  assert.equal(totals.completed, 2419.2);
  assert.equal(totals.gross, 6286.5);
  assert.equal(totals.cut, 1257.3);
  assert.equal(lib.round2(totals.net - totals.gross + totals.cut), 0);
});

test("the live and settled splits agree with the wallet", () => {
  assert.equal(totals.live, wallet.balance.accruedInPools);
  assert.equal(totals.completed, wallet.lifetime.earnedCredited);
  assert.equal(totals.completed, wallet.lifetime.withdrawn);
  assert.equal(lib.round2(totals.live + totals.completed), totals.net);
});

test("best and lowest pools are derived, not authored", () => {
  assert.equal(totals.best.code, "PKG-03");
  assert.equal(totals.best.net, 1350);
  assert.equal(totals.worst.code, "PKG-02");
  assert.equal(totals.worst.net, 388.8);
  assert.equal(totals.avgNet, 1005.84);
  assert.equal(totals.avgRoi, 10.93);
});

test("each position carries a pool capital that matches its share", () => {
  for (const pool of workspace.pools) {
    assert.ok(pool.poolCapital >= pool.investment);
    const implied = lib.round2((pool.investment / pool.poolCapital) * 100);
    assert.ok(Math.abs(implied - pool.sharePct) < 0.6, `${pool.code} share vs capital`);
  }
});

/* ── Timeline ── */

test("the daily timeline sums back to the lifetime figure", () => {
  const total = lib.round2(workspace.timeline.reduce((sum, row) => sum + row.amount, 0));
  assert.equal(total, totals.net);
  const last = workspace.timeline[workspace.timeline.length - 1];
  assert.equal(last.running, totals.net);
});

test("the running total is monotonic and never gaps", () => {
  let running = 0;
  for (const row of workspace.timeline) {
    running = lib.round2(running + row.amount);
    assert.equal(row.running, running, `${row.date} running total`);
    assert.equal(lib.round2(row.settled + row.accrued), row.amount);
  }
});

test("accruals split a live position's net exactly across its days", () => {
  for (const pool of workspace.pools.filter((row) => row.status === "live")) {
    const rows = lib.accrualRows(pool, workspace.asOf);
    assert.ok(rows.length > 1);
    const sum = lib.round2(rows.reduce((total, row) => total + row.amount, 0));
    assert.equal(sum, pool.net, `${pool.code} accrual split`);
    assert.equal(rows[rows.length - 1].partial, true);
  }
});

test("the 14-day window drops the September settlement", () => {
  const view = lib.timelineView(workspace.timeline, "14d", workspace.asOf);
  assert.equal(view.days, 14);
  assert.equal(view.net, 4640.4);
  assert.equal(lib.round2(totals.net - view.net), 388.8);
  assert.equal(view.rows[view.rows.length - 1].running, totals.net);
});

test("period windows narrow monotonically", () => {
  const all = lib.timelineView(workspace.timeline, "all", workspace.asOf);
  const month = lib.timelineView(workspace.timeline, "mtd", workspace.asOf);
  const month30 = lib.timelineView(workspace.timeline, "30d", workspace.asOf);
  const week = lib.timelineView(workspace.timeline, "7d", workspace.asOf);
  assert.equal(all.net, totals.net);
  assert.equal(month.net, 4640.4);
  // 30 days back from 23 Oct reaches 24 Sep, so the PKG-02 settlement is inside.
  assert.equal(month30.net, totals.net);
  assert.ok(week.net < month.net);
  assert.equal(week.days, 7);
});

test("month progress explains October", () => {
  const month = lib.monthProgress(workspace);
  assert.equal(month.label, "October 2026");
  assert.equal(month.net, 4640.4);
  assert.equal(month.lifetime, totals.net);
  assert.equal(month.daysElapsed, 23);
  assert.equal(month.daysInMonth, 31);
  assert.equal(lib.round2(month.settled + month.accrued), month.net);
});

/* ── Tax ── */

test("the tax picture carries nine reconciling lines", () => {
  assert.equal(workspace.tax.notes.length, 9);
  const byLabel = Object.fromEntries(workspace.tax.notes.map((row) => [row.label, row.value]));
  assert.equal(byLabel["Gross earnings (your share, 5 cycles)"], totals.gross);
  assert.equal(byLabel["Platform fee (20% cut)"], -totals.cut);
  assert.equal(byLabel["Net earnings"], totals.net);
  assert.equal(byLabel["Bank return fee"], -wallet.lifetime.feesPaid);
  assert.equal(byLabel["Withdrawn to bank (3 payouts)"], -totals.completed);
  assert.equal(byLabel["Locked in live cycles"], totals.live);
  assert.equal(byLabel["Pending payout"], investments.summary.pendingPayoutAmount);
  assert.equal(byLabel["Uninvested wallet balance"], wallet.balance.available);
});

test("tax lines add up the way a filing pack needs", () => {
  const net = 5029.2;
  assert.equal(lib.round2(totals.gross - totals.cut), net);
  assert.equal(lib.round2(totals.completed + totals.live), net);
  const taxable = workspace.tax.notes.find((row) => row.label === "Net taxable profit");
  assert.equal(taxable.value, lib.round2(net - wallet.lifetime.feesPaid));
});

test("the four jurisdictions are described and one is current", () => {
  assert.equal(workspace.tax.jurisdictions.length, 4);
  assert.deepEqual(
    workspace.tax.jurisdictions.map((row) => row.code),
    ["US", "UK", "KE", "ZA"],
  );
  assert.equal(workspace.tax.jurisdictions.filter((row) => row.current).length, 1);
  assert.equal(workspace.tax.jurisdictions.find((row) => row.current).code, "KE");
  for (const row of workspace.tax.jurisdictions) {
    assert.ok(row.form.length > 3);
    assert.ok(row.note.length > 20);
  }
  assert.match(workspace.tax.disclaimer, /does not provide tax advice/i);
});

/* ── Formula ── */

test("the formula runs over every position with five steps", () => {
  assert.equal(workspace.formula.cutPct, 20);
  assert.equal(workspace.formula.refreshSeconds, 180);
  assert.equal(workspace.formula.samples.length, 5);
  for (const sample of workspace.formula.samples) {
    assert.equal(sample.steps.length, 5);
    assert.equal(lib.round2(sample.gross * (sample.cutPct / 100)), sample.cut);
    assert.equal(lib.round2(sample.gross - sample.cut), sample.net);
    assert.equal(sample.steps[3].value, sample.net);
  }
});

test("the worked example starts from the pool P&L pre-cut", () => {
  const sample = workspace.formula.samples.find((row) => row.poolCode === "PKG-01");
  const preCut = lib.round2(sample.poolPnl / 0.8);
  assert.equal(sample.steps[0].value, preCut);
  assert.equal(preCut, 5250);
  assert.equal(sample.steps[1].value, sample.gross);
  assert.equal(sample.steps[2].value, -sample.cut);
  assert.equal(sample.roiPct, 8.4);
});

/* ── Exports ── */

test("every export scope builds a real matrix", () => {
  for (const scope of ["overview", "by-pool", "timeline", "tax", "fees", "payouts"]) {
    const matrix = lib.exportMatrix(workspace, scope, "14d");
    assert.ok(matrix.header.length >= 3, `${scope} header`);
    assert.ok(matrix.rows.length > 0, `${scope} rows`);
    for (const row of matrix.rows) {
      assert.equal(row.length, matrix.header.length, `${scope} row width`);
    }
  }
});

test("the CSV writer quotes when it has to", () => {
  const csv = lib.csvOf({
    title: "t",
    header: ["A", "B"],
    rows: [["one", 'two, "quoted"']],
  });
  assert.equal(csv.split("\n")[0], "A,B");
  assert.match(csv, /"two, ""quoted"""/);
});

test("the export command records the file and audits it", () => {
  service.resetEarningsWorkspace();
  const before = service.getEarningsWorkspace().exports.length;
  const next = service.applyEarningsMutation({
    kind: "exportReport",
    scope: "by-pool",
    format: "csv",
    period: "14d",
  });
  assert.equal(next.exports.length, before + 1);
  assert.equal(next.exports[0].scope, "by-pool");
  assert.ok(next.exports[0].bytes > 0);
  assert.match(next.exports[0].reference, /^EX-\d{8}-\d{4}$/);
  assert.equal(next.revision, 1);
  assert.equal(next.audit[0].action, "export_generated");
  service.resetEarningsWorkspace();
});

test("the export shelf is capped and can be cleared", () => {
  service.resetEarningsWorkspace();
  let current = service.getEarningsWorkspace();
  for (let i = 0; i < lib.MAX_EXPORTS + 3; i += 1) {
    current = service.applyEarningsMutation({
      kind: "exportReport",
      scope: "overview",
      format: "csv",
      period: "14d",
    });
  }
  assert.equal(current.exports.length, lib.MAX_EXPORTS);
  const cleared = service.applyEarningsMutation({ kind: "clearExports" });
  assert.equal(cleared.exports.length, 0);
  assert.throws(() => service.applyEarningsMutation({ kind: "clearExports" }));
  service.resetEarningsWorkspace();
});

/* ── Reports & tax documents ── */

test("a generated report lands in the library with a reference", () => {
  service.resetEarningsWorkspace();
  const next = service.applyEarningsMutation({
    kind: "generateReport",
    reportKind: "cycle",
    period: "all",
    format: "pdf",
  });
  assert.equal(next.reports[0].kind, "cycle");
  assert.equal(next.reports[0].status, "ready");
  assert.match(next.reports[0].reference, /^RP-\d{8}-\d{4}$/);
  assert.equal(next.audit[0].action, "report_generated");
  service.resetEarningsWorkspace();
});

test("downloading a tax pack files a document and an export", () => {
  service.resetEarningsWorkspace();
  const next = service.applyEarningsMutation({ kind: "downloadTax", format: "pdf", year: 2026 });
  assert.equal(next.tax.documents.length, 4);
  assert.equal(next.tax.documents[0].format, "pdf");
  assert.equal(next.exports[0].scope, "tax");
  assert.match(next.tax.documents[0].reference, /^TX-\d{8}-\d{4}$/);
  service.resetEarningsWorkspace();
});

test("refreshing a report re-stamps it, an unknown id is rejected", () => {
  service.resetEarningsWorkspace();
  const current = service.getEarningsWorkspace();
  const next = service.applyEarningsMutation({
    kind: "downloadReport",
    id: current.reports[0].id,
  });
  assert.equal(next.reports[0].status, "ready");
  assert.equal(next.audit[0].action, "report_downloaded");
  assert.throws(() => service.applyEarningsMutation({ kind: "downloadReport", id: "nope" }));
  service.resetEarningsWorkspace();
});

/* ── Preferences, period, reconciliation ── */

test("statement preferences persist and re-pin the jurisdiction", () => {
  service.resetEarningsWorkspace();
  const next = service.applyEarningsMutation({
    kind: "savePreferences",
    defaultPeriod: "30d",
    jurisdiction: "UK",
    includeLosses: false,
    includeAccrual: true,
    rounding: "dollar",
    deliveryEmail: "accountant@example.com",
    autoMonthly: false,
  });
  assert.equal(next.preferences.defaultPeriod, "30d");
  assert.equal(next.timelinePeriod, "30d");
  assert.equal(next.preferences.jurisdiction, "UK");
  assert.equal(next.profile.jurisdiction, "UK");
  assert.equal(next.tax.jurisdictions.find((row) => row.current).code, "UK");
  assert.equal(next.audit[0].action, "preferences_saved");
  service.resetEarningsWorkspace();
});

test("an invalid delivery address is rejected by the command union", () => {
  service.resetEarningsWorkspace();
  assert.throws(() =>
    service.applyEarningsMutation({
      kind: "savePreferences",
      defaultPeriod: "14d",
      jurisdiction: "KE",
      includeLosses: true,
      includeAccrual: true,
      rounding: "cent",
      deliveryEmail: "not-an-email",
      autoMonthly: true,
    }),
  );
  service.resetEarningsWorkspace();
});

test("changing the period also updates the default", () => {
  service.resetEarningsWorkspace();
  const next = service.applyEarningsMutation({ kind: "setPeriod", period: "7d" });
  assert.equal(next.timelinePeriod, "7d");
  assert.equal(next.preferences.defaultPeriod, "7d");
  assert.equal(next.audit[0].action, "period_changed");
  service.resetEarningsWorkspace();
});

test("reconciling a position stamps the check and audits it", () => {
  service.resetEarningsWorkspace();
  const pool = service.getEarningsWorkspace().pools[0];
  const next = service.applyEarningsMutation({ kind: "reconcilePool", poolId: pool.id });
  assert.equal(next.pools[0].reconciledAt, next.asOf);
  assert.match(next.pools[0].note, /Reconciled/);
  assert.equal(next.audit[0].action, "position_reconciled");
  assert.throws(() => service.applyEarningsMutation({ kind: "reconcilePool", poolId: "nope" }));
  service.resetEarningsWorkspace();
});

/* ── Support & audit ── */

test("support drafts need a real message and are capped", () => {
  service.resetEarningsWorkspace();
  assert.throws(() =>
    service.applyEarningsMutation({ kind: "support", topic: "tax", message: "too short" }),
  );
  let current = service.getEarningsWorkspace();
  const needed = lib.MAX_SUPPORT_DRAFTS - current.support.length;
  for (let i = 0; i < needed; i += 1) {
    current = service.applyEarningsMutation({
      kind: "support",
      topic: "tax",
      message: `Question ${i} about the fee line on the KRA return`,
    });
  }
  assert.equal(current.support.length, lib.MAX_SUPPORT_DRAFTS);
  assert.throws(() =>
    service.applyEarningsMutation({
      kind: "support",
      topic: "tax",
      message: "One more question about the KRA return",
    }),
  );
  const removed = service.applyEarningsMutation({ kind: "deleteDraft", id: current.support[0].id });
  assert.equal(removed.support.length, lib.MAX_SUPPORT_DRAFTS - 1);
  service.resetEarningsWorkspace();
});

test("refresh recomputes and bumps the revision without moving money", () => {
  service.resetEarningsWorkspace();
  const before = service.getEarningsWorkspace();
  const next = service.applyEarningsMutation({ kind: "refresh" });
  assert.equal(next.revision, before.revision + 1);
  assert.equal(lib.poolTotals(next.pools).net, lib.poolTotals(before.pools).net);
  assert.equal(next.audit[0].action, "workspace_refreshed");
  service.resetEarningsWorkspace();
});

test("the command union covers fourteen writes", () => {
  const kinds = lib.earningsCommandSchema.options.map((option) => option.shape.kind.value);
  assert.equal(kinds.length, 14);
  assert.deepEqual(
    kinds.slice().sort(),
    [
      "acknowledge",
      "clearExports",
      "deleteDraft",
      "downloadReport",
      "downloadTax",
      "emailStatement",
      "exportReport",
      "generateReport",
      "pinJurisdiction",
      "reconcilePool",
      "refresh",
      "savePreferences",
      "setPeriod",
      "support",
    ].sort(),
  );
});

/* ── Sections & keys ── */

test("the section map exposes the four documented keys", () => {
  assert.deepEqual(lib.EARNINGS_SECTIONS, [
    "workspace",
    "overview",
    "by-pool",
    "timeline",
    "tax-report",
    "formula",
    "library",
  ]);
  assert.deepEqual(lib.earningsKey("overview"), ["earnings", "overview"]);
  assert.deepEqual(lib.earningsKey("by-pool"), ["earnings", "by-pool"]);
  assert.deepEqual(lib.earningsKey("timeline", { period: "14d" }), [
    "earnings",
    "timeline",
    { period: "14d" },
  ]);
  assert.deepEqual(lib.earningsKey("tax-report", { year: 2026 }), [
    "earnings",
    "tax-report",
    { year: 2026 },
  ]);
});

test("each section slice is self-consistent", () => {
  const overview = lib.earningsSection(workspace, "overview");
  assert.equal(overview.kpis.length, 6);
  assert.equal(overview.totals.net, totals.net);
  const byPool = lib.earningsSection(workspace, "by-pool");
  assert.equal(byPool.live.length, 2);
  assert.equal(byPool.settled.length, 3);
  const timeline = lib.earningsSection(workspace, "timeline", { period: "7d" });
  assert.equal(timeline.days, 7);
  const tax = lib.earningsSection(workspace, "tax-report", { year: 2026 });
  assert.equal(tax.notes.length, 9);
  assert.equal(tax.totals.net, totals.net);
  const formula = lib.earningsSection(workspace, "formula");
  assert.equal(formula.worked.poolCode, "PKG-01");
  const librarySlice = lib.earningsSection(workspace, "library");
  assert.equal(librarySlice.reports.length, 5);
  assert.ok(librarySlice.payouts.length >= 3);
});

/* ── Page, API, hook ── */

test("the earnings route renders the page instead of a redirect", () => {
  assert.ok(page.includes("InvestorEarningsPage"));
  assert.ok(page.includes("getEarningsWorkspace"));
  assert.ok(!page.includes("redirect("));
  assert.ok(page.includes("?action="));
  assert.ok(page.includes("force-dynamic"));
});

test("the page carries its own stylesheet and root class", () => {
  assert.match(read("src/app/globals.css"), /investor-earnings\.css/);
  assert.match(css, /\.page-investor-earnings/);
  assert.ok(!/linear-gradient/.test(css), "no gradients");
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(css.includes("@media (max-width: 767px)"));
  assert.ok(css.includes("@media (max-width: 575px)"));
  assert.match(css, /\.page-investor-earnings \.ea-kpis/);
});

test("the component ships the full desk: dialogs, wizards, drawer, dock", () => {
  const kinds = [...component.matchAll(/^  \| "([a-zA-Z]+)"/gm)].map((m) => m[1]);
  assert.ok(kinds.length >= 30, `expected 30+ dialogs, saw ${kinds.length}`);
  const wizardEntries = [...component.matchAll(/^  (exportWizard|reportWizard|taxWizard|preferencesWizard|emailWizard|reconcileWizard|supportWizard): \[/gm)];
  assert.equal(wizardEntries.length, 7);
  assert.ok(component.includes("ea-drawer"));
  assert.ok(component.includes("useLiveCountUp"));
  assert.ok(component.includes("useDeskTable"));
  assert.ok((component.match(/data-action="wizard-next"/g) || []).length === 1);
  assert.ok(component.includes("quickActions"));
});

test("the route answers GET slices and POST commands", () => {
  assert.match(api, /export function GET/);
  assert.match(api, /export async function POST/);
  assert.match(api, /earningsSection/);
  assert.match(api, /earningsCommandSchema/);
  for (const section of ["overview", "by-pool", "timeline", "tax-report", "formula", "library"]) {
    assert.match(api, /section/);
    assert.ok(lib.EARNINGS_SECTIONS.includes(section));
  }
});

test("the three documented export endpoints exist", () => {
  assert.match(csvRoute, /export\/csv|export-csv/);
  assert.match(csvRoute, /format: "csv"/);
  assert.match(pdfRoute, /format: "pdf"/);
  assert.match(taxRoute, /downloadTax/);
  assert.match(taxRoute, /tax-report|exportMatrix\(workspace, "tax"\)/);
});

test("the hook declares the four query keys and the three mutations", () => {
  assert.ok(hook.includes("EARNINGS_BY_POOL_REFETCH_MS = EARNINGS_REFRESH_SECONDS * 1000"));
  assert.ok(hook.includes("earningsKey(\"overview\")"));
  assert.ok(hook.includes("earningsKey(\"by-pool\")"));
  assert.ok(hook.includes("/api/earnings/export-csv"));
  assert.ok(hook.includes("/api/earnings/export-pdf"));
  assert.ok(hook.includes("/api/earnings/tax-report"));
  assert.ok(hook.includes("refetchInterval"));
});

test("the workspace resets cleanly", () => {
  const reset = service.resetEarningsWorkspace();
  assert.equal(reset.revision, 0);
  assert.equal(reset.exports.length, 2);
  assert.equal(service.getEarningsWorkspace().revision, 0);
});
