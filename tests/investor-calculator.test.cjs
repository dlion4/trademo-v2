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

const calculator = load("src/lib/investor/calculator.ts");
const { getCalculatorWorkspace } = load(
  "src/server/services/investor-calculator-service.ts",
);

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const near = (actual, expected, tolerance = 0.01) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );

const workspace = getCalculatorWorkspace();
const component = read("src/components/investor/investor-calculator-page.tsx");
const css = read("src/styles/pages/investor-calculator.css");
const route = read("src/app/investor/calculator/page.tsx");
const api = read("src/app/api/investor/calculator/route.ts");
const hook = read("src/lib/investor/use-calculator.ts");

/* ── Fixture ── */

test("the calculator ships a complete demo workspace", () => {
  assert.equal(workspace.mode, "demo");
  assert.equal(workspace.asOf, "2026-10-23T10:00:00Z");
  assert.equal(workspace.revision, 0);
  assert.equal(workspace.profile.displayName, "Jane Investor");
  assert.equal(workspace.profile.walletAvailable, 2892);
  assert.equal(workspace.platformCutPct, 20);
  assert.equal(workspace.slotPrice, 3000);
  assert.equal(workspace.defaultPoolId, "pkg_05");
  assert.deepEqual(workspace.defaults, {
    amount: 3000,
    roiPct: 15,
    durationDays: 14,
  });
  assert.deepEqual(workspace.bands, {
    conservative: 8,
    expected: 15,
    optimistic: 25,
  });
  assert.deepEqual(workspace.scenarioSlots, [1, 2, 3]);
  assert.equal(workspace.pools.length, 6);
  assert.equal(workspace.depositRails.length, 5);
  assert.equal(workspace.payoutMethods.length, 4);
  assert.equal(workspace.historical.length, 10);
  assert.equal(workspace.presets.length, 3);
  assert.deepEqual(workspace.savedScenarios, []);
  assert.deepEqual(workspace.exports, []);
  assert.deepEqual(workspace.support, []);
  assert.deepEqual(workspace.audit, []);
  assert.deepEqual(workspace.preferences, {
    reinvest: true,
    compoundPools: 6,
    showGross: true,
    includeFees: true,
    payoutFeeWaived: true,
  });
});

test("every pool in the book is routed to a real page", () => {
  const codes = workspace.pools.map((row) => row.code);
  assert.deepEqual(codes, [
    "PKG-01",
    "PKG-03",
    "PKG-02",
    "PKG-09",
    "PKG-04",
    "PKG-05",
  ]);
  for (const pool of workspace.pools) {
    assert.ok(pool.slotPrice >= 500, pool.code);
    assert.ok(pool.durationDays >= 7 && pool.durationDays <= 30, pool.code);
    assert.ok(pool.expectedRoiPct > 0, pool.code);
    assert.match(pool.detailHref, /^\/investor\/pools\//);
    assert.match(pool.bookingHref, /^\/investor\/pools\//);
    assert.ok(Array.isArray(pool.markets) && pool.markets.length > 0, pool.code);
    if (pool.bookable) assert.match(pool.bookingHref, /\/book$/);
    else assert.equal(pool.bookingHref, pool.detailHref);
  }
  assert.equal(workspace.pools.filter((row) => row.bookable).length, 2);
});

test("the ten-cycle archive is ordered oldest to newest", () => {
  const stamps = workspace.historical.map((row) => row.completedAt);
  const sorted = stamps.slice().sort();
  assert.deepEqual(stamps, sorted);
  for (const row of workspace.historical) {
    assert.equal(row.durationDays, 14);
    assert.equal(row.slotPrice, 3000);
    assert.ok(row.winRatePct >= 55 && row.winRatePct <= 70, row.code);
    assert.ok(row.trades > 0, row.code);
    assert.ok(row.note.length > 10, row.code);
  }
});

/* ── ROI projection ── */

test("the ROI projection reproduces the brief's worked example", () => {
  const result = calculator.roiProjection({
    amount: 3000,
    roiPct: 15,
    durationDays: 14,
    platformCutPct: workspace.platformCutPct,
    slotPrice: 3000,
  });
  assert.equal(result.slots, 1);
  assert.equal(result.grossEarnings, 450);
  assert.equal(result.platformCut, 90);
  assert.equal(result.netEarnings, 360);
  assert.equal(result.totalReturn, 3360);
  near(result.dailyNet, 25.71);
  assert.equal(result.netRoiPct, 12);
  near(result.effectiveApy, 312.86);
});

test("slots derive from the amount and the pool's slot price", () => {
  assert.equal(calculator.slotCount(3000, 3000), 1);
  assert.equal(calculator.slotCount(5000, 3000), 2);
  assert.equal(calculator.slotCount(6000, 3000), 2);
  assert.equal(calculator.slotCount(500, 3000), 1);
  assert.equal(calculator.slotCount(50000, 2000), 25);

  const wide = calculator.roiProjection({
    amount: 50000,
    roiPct: 30,
    durationDays: 7,
    platformCutPct: 20,
    slotPrice: 2000,
  });
  assert.equal(wide.slots, 25);
  assert.equal(wide.grossEarnings, 15000);
  assert.equal(wide.netEarnings, 12000);
  near(wide.effectiveApy, 1251.43, 0.02);
});

test("a zero-ROI projection still returns capital intact", () => {
  const flat = calculator.roiProjection({
    amount: 2500,
    roiPct: 0,
    durationDays: 10,
    platformCutPct: 20,
    slotPrice: 2500,
  });
  assert.equal(flat.grossEarnings, 0);
  assert.equal(flat.platformCut, 0);
  assert.equal(flat.netEarnings, 0);
  assert.equal(flat.totalReturn, 2500);
  assert.equal(flat.effectiveApy, 0);
});

/* ── Compound growth ── */

test("compounding rolls the net forward across the cycle count", () => {
  const plan = calculator.compoundPlan({
    principal: 3000,
    roiPct: 15,
    pools: 6,
    platformCutPct: 20,
    reinvest: true,
  });
  assert.equal(plan.rows.length, 6);
  assert.deepEqual(
    plan.rows.map((row) => row.end),
    [3360, 3763.2, 4214.78, 4720.55, 5287.02, 5921.46],
  );
  assert.equal(plan.finalBalance, 5921.46);
  assert.equal(plan.totalNet, 2921.46);
  near(plan.growthPct, 97.38);
  assert.equal(plan.rows[0].start, 3000);
  near(plan.rows[0].net, 360);
  near(plan.rows[0].cut, 90);
});

test("a flat stake repeats the same cycle without compounding", () => {
  const flat = calculator.compoundPlan({
    principal: 3000,
    roiPct: 15,
    pools: 3,
    platformCutPct: 20,
    reinvest: false,
  });
  assert.deepEqual(
    flat.rows.map((row) => row.start),
    [3000, 3000, 3000],
  );
  assert.deepEqual(
    flat.rows.map((row) => row.end),
    [3360, 3360, 3360],
  );
  assert.equal(flat.finalBalance, 3360);
  near(flat.growthPct, 12);
});

/* ── Fee calculator ── */

test("the fee calculator splits the desk cut from the payment rails", () => {
  const bank = calculator.feeBreakdown({
    amount: 3000,
    roiPct: 15,
    platformCutPct: 20,
    depositFeePct: 0,
    depositFeeFlat: 0,
    payoutKind: "bank",
    payoutFeeWaived: true,
  });
  assert.equal(bank.depositFee, 0);
  assert.equal(bank.platformShare, 90);
  assert.equal(bank.payoutFee, 0);
  assert.equal(bank.totalFees, 90);
  assert.equal(bank.netEarnings, 360);
  assert.equal(bank.totalReturn, 3360);
  assert.equal(bank.costPct, 3);
});

test("rail fees stack on top when the payout is not a settlement", () => {
  const card = calculator.feeBreakdown({
    amount: 3000,
    roiPct: 15,
    platformCutPct: 20,
    depositFeePct: 2.9,
    depositFeeFlat: 0.3,
    payoutKind: "bank",
    payoutFeeWaived: false,
  });
  near(card.depositFee, 87.3);
  near(card.payoutFee, 2.16);
  near(card.totalFees, 179.46);
  near(card.netEarnings, 357.84);
  near(card.costPct, 5.98);
});

/* ── Scenario grid ── */

test("the scenario grid prices one, two and three slots on three bands", () => {
  const rows = calculator.scenarioMatrix({
    slotPrice: 3000,
    platformCutPct: 20,
    slots: [1, 2, 3],
    bands: { conservative: 8, expected: 15, optimistic: 25 },
  });
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.investment),
    [3000, 6000, 9000],
  );
  assert.deepEqual(
    rows.map((row) => row.conservativeNet),
    [192, 384, 576],
  );
  assert.deepEqual(
    rows.map((row) => row.expectedNet),
    [360, 720, 1080],
  );
  assert.deepEqual(
    rows.map((row) => row.optimisticNet),
    [600, 1200, 1800],
  );
  assert.deepEqual(
    rows.map((row) => row.grossExpected),
    [450, 900, 1350],
  );
});

test("the grid re-prices against a different pool", () => {
  const rows = calculator.scenarioMatrix({
    slotPrice: 5000,
    platformCutPct: 20,
    slots: [1],
    bands: { conservative: 8, expected: 18, optimistic: 25 },
  });
  assert.equal(rows[0].investment, 5000);
  assert.equal(rows[0].conservativeNet, 320);
  assert.equal(rows[0].expectedNet, 720);
  assert.equal(rows[0].optimisticNet, 1000);
});

/* ── Track record ── */

test("historical statistics match the ten-cycle archive", () => {
  const stats = calculator.historicalStats(workspace.historical);
  assert.equal(stats.count, 10);
  near(stats.average, 14.2);
  near(stats.median, 13.7);
  assert.equal(stats.best.code, "PKG-GenesisPlus");
  near(stats.best.roiPct, 21.8);
  assert.equal(stats.worst.code, "PKG-Starter2");
  near(stats.worst.roiPct, 8.5);
  near(stats.winRateMin, 58.2);
  near(stats.winRateMax, 67);
  assert.equal(stats.totalTrades, 2820);
  assert.equal(stats.totalCapital, 395000);
  assert.equal(stats.positive, 10);
});

/* ── Draft validation ── */

test("the projection draft rejects out-of-range inputs", () => {
  const ok = calculator.calculatorDraftError({
    amount: 3000,
    roiPct: 15,
    durationDays: 14,
    slotPrice: 3000,
    terms: true,
  });
  assert.equal(ok, "");
  assert.match(
    calculator.calculatorDraftError({
      amount: 100,
      roiPct: 15,
      durationDays: 14,
      slotPrice: 3000,
      terms: true,
    }),
    /\$500/,
  );
  assert.match(
    calculator.calculatorDraftError({
      amount: 90000,
      roiPct: 15,
      durationDays: 14,
      slotPrice: 3000,
      terms: true,
    }),
    /\$50,000/,
  );
  assert.match(
    calculator.calculatorDraftError({
      amount: 3000,
      roiPct: 40,
      durationDays: 14,
      slotPrice: 3000,
      terms: true,
    }),
    /ROI/,
  );
  assert.match(
    calculator.calculatorDraftError({
      amount: 3000,
      roiPct: 15,
      durationDays: 40,
      slotPrice: 3000,
      terms: true,
    }),
    /duration|days/i,
  );
  assert.match(
    calculator.calculatorDraftError({
      amount: 3000,
      roiPct: 15,
      durationDays: 14,
      slotPrice: 3000,
      terms: false,
    }),
    /acknowledge|terms/i,
  );
});

test("the booking draft blocks excess slots and unacknowledged terms", () => {
  const base = {
    amount: 3000,
    slots: 1,
    maxSlots: 10,
    available: 2892,
    terms: true,
  };
  assert.match(calculator.bookingDraftError(base), /top up/);
  assert.equal(
    calculator.bookingDraftError({ ...base, requireFunds: false }),
    "",
  );
  assert.match(
    calculator.bookingDraftError({ ...base, slots: 11, requireFunds: false }),
    /10 slot/,
  );
  assert.match(
    calculator.bookingDraftError({ ...base, terms: false, requireFunds: false }),
    /terms/i,
  );
});

/* ── Commands ── */

const run = (workspaceState, command) =>
  calculator.applyCalculatorCommand(workspaceState, command);

test("saving a scenario audits the change and bumps the revision", () => {
  const next = run(workspace, {
    kind: "saveScenario",
    poolId: "pkg_05",
    poolCode: "PKG-05",
    slots: 2,
    amount: 6000,
    roiPct: 15,
    durationDays: 14,
    band: "expected",
    note: "Two slots if the window opens under 15%",
  });
  assert.equal(next.revision, 1);
  assert.equal(next.savedScenarios.length, 1);
  assert.equal(next.savedScenarios[0].status, "saved");
  assert.equal(next.savedScenarios[0].slots, 2);
  assert.equal(next.audit.length, 1);
  assert.equal(next.audit[0].action, "scenario_saved");
  assert.equal(workspace.savedScenarios.length, 0, "input stays immutable");
});

test("queueing a booking records the hand-off without reserving a slot", () => {
  const next = run(workspace, {
    kind: "queueBooking",
    poolId: "pkg_02",
    poolCode: "PKG-02",
    slots: 1,
    amount: 5000,
    roiPct: 18,
    durationDays: 21,
    note: "From the calculator",
  });
  const queued = next.savedScenarios.filter((row) => row.status === "queued");
  assert.equal(queued.length, 1);
  assert.equal(queued[0].amount, 5000);
  assert.match(next.audit[0].detail, /nothing reserved/i);
});

test("queueing more slots than the pool allows throws", () => {
  assert.throws(
    () =>
      run(workspace, {
        kind: "queueBooking",
        poolId: "pkg_05",
        poolCode: "PKG-05",
        slots: 16,
        amount: 48000,
        roiPct: 15,
        durationDays: 14,
        note: "",
      }),
    /slots per investor/,
  );
});

test("presets save, pin, unpin and delete", () => {
  const saved = run(workspace, {
    kind: "savePreset",
    name: "Conservative 14-day",
    amount: 3000,
    roiPct: 8,
    durationDays: 14,
    note: "Saved from the ROI calculator",
  });
  assert.equal(saved.presets.length, 4);
  const created = saved.presets[saved.presets.length - 1];
  assert.equal(created.name, "Conservative 14-day");

  const pinned = run(saved, {
    kind: "togglePinPreset",
    presetId: created.id,
  });
  assert.equal(
    pinned.presets.find((row) => row.id === created.id).pinned,
    true,
  );

  const removed = run(pinned, {
    kind: "deletePreset",
    presetId: created.id,
  });
  assert.equal(removed.presets.length, 3);
  assert.equal(
    removed.presets.some((row) => row.id === created.id),
    false,
  );
});

test("a scenario can be deleted but not twice", () => {
  const saved = run(workspace, {
    kind: "saveScenario",
    poolId: "pkg_02",
    poolCode: "PKG-02",
    slots: 1,
    amount: 5000,
    roiPct: 18,
    durationDays: 21,
    band: "expected",
    note: "Open window",
  });
  const id = saved.savedScenarios[0].id;
  const removed = run(saved, { kind: "deleteScenario", scenarioId: id });
  assert.equal(removed.savedScenarios.length, 0);
  assert.throws(
    () => run(removed, { kind: "deleteScenario", scenarioId: id }),
    /not saved/,
  );
});

test("preferences, exports, acknowledgements and support all persist", () => {
  const prefs = run(workspace, {
    kind: "savePreferences",
    reinvest: false,
    compoundPools: 9,
    showGross: false,
    includeFees: true,
    payoutFeeWaived: false,
  });
  assert.equal(prefs.preferences.compoundPools, 9);
  assert.equal(prefs.preferences.reinvest, false);

  const exported = run(prefs, {
    kind: "exportReport",
    scope: "scenarios",
    format: "csv",
    count: 3,
  });
  assert.equal(exported.exports.length, 1);
  assert.equal(exported.exports[0].scope, "scenarios");
  assert.equal(exported.exports[0].format, "csv");

  const acked = run(exported, { kind: "acknowledge", scope: "risk" });
  assert.equal(acked.acknowledgements.length, 1);
  assert.equal(acked.acknowledgements[0].scope, "risk");

  const messaged = run(acked, {
    kind: "support",
    topic: "fees",
    message: "How is the 20% cut applied on a losing cycle?",
  });
  assert.equal(messaged.support.length, 1);
  assert.equal(messaged.support[0].status, "local_draft");

  const reset = run(messaged, { kind: "resetCalculator", note: "reset" });
  assert.equal(reset.revision, 5);
  assert.equal(reset.preferences.compoundPools, 6);
});

test("the command schema rejects unknown kinds and out-of-range values", () => {
  assert.equal(
    calculator.calculatorCommandSchema.safeParse({ kind: "selfDestruct" })
      .success,
    false,
  );
  assert.equal(
    calculator.calculatorCommandSchema.safeParse({
      kind: "saveScenario",
      poolId: "pkg_05",
      poolCode: "PKG-05",
      slots: 2,
      amount: 6000,
      roiPct: 15,
      durationDays: 14,
      band: "expected",
      note: "ok",
    }).success,
    true,
  );
  assert.equal(
    calculator.calculatorCommandSchema.safeParse({
      kind: "support",
      topic: "fees",
      message: "short",
    }).success,
    false,
  );
  assert.equal(
    calculator.calculatorCommandSchema.safeParse({
      kind: "exportReport",
      scope: "everything",
      format: "csv",
      count: 1,
    }).success,
    false,
  );
});

test("commands never mutate the workspace they receive", () => {
  const before = JSON.stringify(workspace);
  run(workspace, {
    kind: "saveScenario",
    poolId: "pkg_05",
    poolCode: "PKG-05",
    slots: 1,
    amount: 3000,
    roiPct: 15,
    durationDays: 14,
    band: "expected",
    note: "immutability",
  });
  assert.equal(JSON.stringify(workspace), before);
});

/* ── API + page wiring ── */

test("the page server-renders the workspace and honours the action deep link", () => {
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /getCalculatorWorkspace\(\)/);
  assert.match(route, /searchParams/);
  assert.match(route, /<InvestorCalculatorPage initial=\{workspace\}/);
  assert.match(route, /title: "Investment calculator \(I-8\)/);
});

test("the API route validates the section and never caches", () => {
  assert.match(api, /export function GET/);
  assert.match(api, /const sections = \[/);
  assert.match(api, /z\.enum\(sections\)/);
  assert.match(api, /Duplicate query parameter/);
  assert.match(api, /"no-store"/);
  assert.match(api, /getCalculatorWorkspace/);
  assert.match(api, /NextResponse\.json/);
});

test("the hook exposes a query plus a command mutation for every section", () => {
  assert.match(hook, /export const calculatorWorkspaceKey = \(\) => \["calculator", "workspace"\]/);
  assert.match(hook, /\["calculator", "roi", \{ amount, roi, duration \}\]/);
  assert.match(hook, /\["calculator", "compound", \{ principal, roi, pools \}\]/);
  assert.match(hook, /\["calculator", "fees", \{ amount, method, share \}\]/);
  assert.match(hook, /\["calculator", "scenarios", \{ poolId \}\]/);
  assert.match(hook, /"historical-performance", \{ type: "similar" \}/);
  assert.match(hook, /queryKey: key/);
  assert.match(hook, /useQuery/);
  assert.match(hook, /useMutation/);
  assert.match(hook, /applyCalculatorCommand/);
  for (const fn of [
    "projectRoi",
    "projectCompound",
    "projectFees",
    "projectScenarios",
    "projectHistory",
  ]) {
    assert.ok(hook.includes(fn), fn);
  }
});

/* ── Component ── */

test("the page keeps its own shell, drawer and quick-action dock", () => {
  assert.match(component, /rootClass="page-investor-calculator"/);
  assert.match(component, /<InvestorShell/);
  assert.match(component, /quickActions=\{quickActions\}/);
  assert.match(component, /ca-drawer-layer/);
  assert.match(component, /role="tablist"/);
  const quick = component.slice(
    component.indexOf("const quickActions"),
    component.indexOf("const sections"),
  );
  const actions = [...quick.matchAll(/key: "([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(actions, [
    "save",
    "book",
    "export",
    "presets",
    "compare",
    "pools",
  ]);
  assert.ok(actions.length >= 4);
});

test("the page keeps more than fifteen dialogs, seven of them wizards", () => {
  const kinds = [
    ...component.matchAll(/^\s*\| "([a-zA-Z]+)"/gm),
  ].map((m) => m[1]);
  assert.ok(kinds.length >= 15, `only ${kinds.length} dialog kinds`);
  for (const kind of [
    "bookWizard",
    "saveScenario",
    "presetWizard",
    "shareWizard",
    "exportWizard",
    "settingsWizard",
    "supportWizard",
  ]) {
    assert.ok(kinds.includes(kind), kind);
  }
  const switches = (component.match(/\bkind === "[A-Za-z]+"/g) || []).length;
  assert.ok(switches >= 20, `only ${switches} rendered dialog branches`);
  assert.match(component, /steps=\{wizard\}/);
  assert.match(component, /currentStep=\{wizardStep\}/);
});

test("no placeholder copy, empty hrefs or dead buttons in the page", () => {
  for (const bad of [
    /href=""/,
    /href="#"/,
    /href="javascript/,
    /Coming soon/i,
    /Lorem ipsum/i,
    /\bTODO\b/,
    /\bFIXME\b/,
    /placeholder page/i,
  ]) {
    assert.doesNotMatch(component, bad);
  }
  const anchors = [...component.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(anchors.length >= 8);
  for (const href of anchors) assert.ok(href.startsWith("/investor"), href);
});

test("the five brief sections are present in order", () => {
  const ids = ["wa-roi", "wa-compound", "wa-fees", "wa-scenarios", "wa-history"];
  const positions = ids.map((id) => component.indexOf(`id="${id}"`));
  for (const [index, position] of positions.entries()) {
    assert.ok(position > 0, ids[index]);
  }
  assert.deepEqual(positions.slice().sort((a, b) => a - b), positions);
});

test("the stylesheet is scoped, flat and responsive", () => {
  assert.match(css, /\.page-investor-calculator \.ca-page \{/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  for (const cls of [
    ".ca-hero",
    ".ca-jump",
    ".ca-section",
    ".ca-split",
    ".ca-panel",
    ".ca-figure-grid",
    ".ca-chart",
    ".ca-bars",
    ".ca-table",
    ".ca-scenario-card",
    ".ca-stat",
    ".ca-drawer-layer",
    ".ca-modal-layer",
    ".ca-disclaimer-dot",
  ]) {
    assert.ok(css.includes(cls), cls);
  }
  assert.match(css, /@media \(max-width: 767\.98px\)/);
  assert.match(css, /@media \(max-width: 575\.98px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /keyframes caFadeSlideUp/);
  assert.match(css, /keyframes caChartDraw/);
  assert.match(css, /keyframes caBarDraw/);
  assert.match(css, /calc\(100vw - 32px\)/);
  assert.match(css, /\.ca-table--stack \{\s*display: none;/);
});

test("the stylesheet is imported after the pages it builds on", () => {
  const globals = read("src/app/globals.css");
  assert.match(globals, /investor-calculator\.css/);
  const wallet = globals.indexOf("investor-wallet.css");
  const calculatorIndex = globals.indexOf("investor-calculator.css");
  assert.ok(calculatorIndex > wallet);
});

test("the shell exposes the calculator route as a page link", () => {
  const shell = read("src/components/investor/investor-shell.tsx");
  const account = shell.slice(shell.indexOf('group: "Account"'));
  const block = account.slice(0, account.indexOf("];"));
  assert.match(block, /key: "calculator"[\s\S]*?href: "\/investor\/calculator"/);
  assert.match(block, /code: "I-8"/);
  assert.match(component, /activeNav=\{activeNav\}/);
});
