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

const wallet = load("src/lib/investor/wallet.ts");
const { getWalletWorkspace } = load(
  "src/server/services/investor-wallet-service.ts",
);
const { getInvestmentsWorkspace } = load(
  "src/server/services/investor-investments-service.ts",
);

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const workspace = getWalletWorkspace();
const investments = getInvestmentsWorkspace();
const NOW = "2026-10-23T10:05:00Z";

/* ── Fixture ── */

test("the wallet ships a complete demo workspace", () => {
  assert.equal(workspace.mode, "demo");
  assert.equal(workspace.asOf, "2026-10-23T10:00:00Z");
  assert.equal(workspace.revision, 0);
  assert.equal(workspace.profile.displayName, "Jane Investor");
  assert.equal(workspace.profile.kycLevel, "L2");
  assert.equal(workspace.transactions.length, 19);
  assert.equal(workspace.depositRails.length, 5);
  assert.equal(workspace.payoutRails.length, 3);
  assert.equal(workspace.methods.length, 4);
  assert.equal(workspace.payouts.length, 5);
  assert.ok(workspace.limits.length >= 4);
  assert.deepEqual(workspace.exports, []);
  assert.deepEqual(workspace.audit, []);
  assert.deepEqual(workspace.filters, {
    types: [],
    methods: [],
    from: "",
    to: "",
    query: "",
  });
  assert.equal(workspace.preferences.emailReceipts, true);
});

test("the ledger ends on the canonical $2,892 available balance", () => {
  const { balance } = workspace;
  assert.equal(balance.available, 2892);
  assert.equal(balance.totalAccountValue, 27892);
  assert.equal(balance.currency, "USD");
  assert.equal(balance.openingBalance, 0);
  assert.equal(balance.statementFrom, "2026-09-12T10:00:00Z");
  assert.equal(balance.statementTo, "2026-10-23T10:00:00Z");
  assert.equal(
    wallet.withRunningBalance(workspace.transactions, 0).at(-1).balanceAfter,
    2892,
  );
  const sum = workspace.transactions.reduce((total, row) => total + row.amount, 0);
  assert.equal(wallet.round2(sum), balance.available);
});

test("locked capital, accrual and the pending payout come from the I-6 book", () => {
  assert.equal(workspace.balance.lockedInPools, investments.summary.activeCapital);
  assert.equal(workspace.balance.bookedInPools, investments.summary.bookedCapital);
  assert.equal(
    workspace.balance.interestRegistered,
    investments.summary.interestCapital,
  );
  assert.equal(workspace.balance.lockedInPools, 25000);
  assert.equal(workspace.balance.bookedInPools, 12500);
  assert.equal(workspace.balance.interestRegistered, 6000);
  assert.equal(workspace.balance.accruedInPools, 2610);
  assert.equal(workspace.balance.pendingPayoutCount, 1);
  assert.equal(workspace.balance.pendingPayoutGross, 120);
  assert.equal(workspace.balance.pendingPayoutNet, 118.5);
});

test("lifetime flows are counted from the ledger, not stored", () => {
  const { lifetime } = workspace;
  assert.equal(lifetime.deposited, 38024);
  assert.equal(lifetime.depositCount, 6);
  assert.equal(lifetime.earnedCredited, 2419.2);
  assert.equal(lifetime.earningCount, 3);
  assert.equal(lifetime.withdrawn, 2419.2);
  assert.equal(lifetime.payoutCount, 3);
  assert.equal(lifetime.feesPaid, 12);
  assert.equal(lifetime.investedFromWallet, 35000);
  assert.equal(lifetime.refunded, 500);
  assert.deepEqual(wallet.flowTotals(workspace.transactions), {
    inflow: 40943.2,
    outflow: 38051.2,
    net: 2892,
    count: 19,
  });
});

test("the fixture matches the spec's cash story", () => {
  const payouts = workspace.payouts;
  const processing = payouts.find((row) => row.status === "processing");
  assert.equal(processing.gross, 120);
  assert.equal(processing.rail, "bank_transfer");
  assert.equal(processing.providerRef, "pay_8f2a");
  assert.equal(processing.requestedAt.slice(0, 10), "2026-10-17");

  const paid = payouts.find((row) => row.providerRef === "pay_b3c1");
  assert.equal(paid.gross, 1180.8);
  assert.equal(paid.status, "completed");

  const failed = payouts.find((row) => row.status === "failed");
  assert.ok(failed && failed.gross === 500);

  const methods = workspace.methods;
  assert.equal(methods.filter((row) => row.isDefault).length, 1);
  assert.equal(wallet.defaultMethod(workspace).id, "pm_bank_8842");
  assert.ok(methods.some((row) => !row.payoutEnabled && row.kind === "card"));
});

test("the split bar covers the whole account", () => {
  const split = wallet.balanceSplit(workspace.balance);
  assert.deepEqual(
    split.map((bucket) => bucket.key),
    ["available", "locked", "pending"],
  );
  assert.equal(split[0].pct, 10.32);
  assert.equal(split[1].pct, 89.25);
  assert.equal(split[2].pct, 0.43);
});

/* ── Money maths ── */

test("deposit fees are quoted on top, per rail", () => {
  const card = workspace.depositRails.find((row) => row.key === "card");
  const bank = workspace.depositRails.find((row) => row.key === "bank_transfer");
  const mobile = workspace.depositRails.find(
    (row) => row.key === "mobile_money",
  );
  assert.equal(wallet.depositFee(card, 5000), 145.3);
  assert.equal(wallet.depositTotal(card, 5000), 5145.3);
  assert.equal(wallet.depositFee(bank, 5000), 0);
  assert.equal(wallet.depositTotal(bank, 5000), 5000);
  assert.equal(wallet.depositFee(mobile, 1000), 15);
});

test("payout fees follow destination kind", () => {
  assert.equal(wallet.payoutFee(120, "bank"), 1.5);
  assert.equal(wallet.payoutFee(1140, "bank"), 6.84);
  assert.equal(wallet.payoutFee(5000, "bank"), 12);
  assert.equal(wallet.payoutFee(1000, "mobile"), 15);
  assert.equal(wallet.payoutFee(500, "crypto"), 2.2);
  assert.equal(wallet.payoutFee(500, "card"), 0);
  assert.equal(wallet.payoutNet(120, "bank"), 118.5);
  assert.equal(wallet.suggestedPayout(2892), 2890);
  assert.equal(wallet.suggestedPayout(40), 40);
});

test("draft validators block unreachable or unsafe submissions", () => {
  const bank = workspace.depositRails.find((row) => row.key === "bank_transfer");
  const fieldless = { ...bank, fields: [] };
  assert.match(
    wallet.depositDraftError({
      amount: 0,
      rail: bank,
      fields: {},
      terms: true,
      dailyUsed: 0,
    }),
    /Enter a deposit amount/,
  );
  assert.match(
    wallet.depositDraftError({
      amount: 30_000,
      rail: bank,
      fields: { accountName: "a", bankName: "b", iban: "c", reference: "d" },
      terms: true,
      dailyUsed: 0,
    }),
    /Maximum on this rail is \$25,000/,
  );
  assert.match(
    wallet.depositDraftError({
      amount: 20_000,
      rail: fieldless,
      fields: {},
      terms: true,
      dailyUsed: 10_000,
    }),
    /daily deposit limit/,
  );
  assert.match(
    wallet.depositDraftError({
      amount: 500,
      rail: bank,
      fields: {},
      terms: true,
      dailyUsed: 0,
    }),
    /Account holder is required/,
  );
  assert.match(
    wallet.depositDraftError({
      amount: 500,
      rail: fieldless,
      fields: {},
      terms: false,
      dailyUsed: 0,
    }),
    /Confirm the fee and settlement terms/,
  );

  const card = workspace.methods.find((row) => row.kind === "card");
  const bankMethod = workspace.methods.find((row) => row.isDefault);
  assert.match(
    wallet.payoutDraftError({
      amount: 100,
      available: 2892,
      method: null,
      terms: true,
    }),
    /Choose a destination/,
  );
  assert.match(
    wallet.payoutDraftError({
      amount: 100,
      available: 2892,
      method: card,
      terms: true,
    }),
    /deposit-only method/,
  );
  assert.match(
    wallet.payoutDraftError({
      amount: 40,
      available: 2892,
      method: bankMethod,
      terms: true,
    }),
    /Payouts start at \$50/,
  );
  assert.match(
    wallet.payoutDraftError({
      amount: 20_000,
      available: 40_000,
      method: bankMethod,
      terms: true,
    }),
    /capped at \$10,000/,
  );
  assert.match(
    wallet.payoutDraftError({
      amount: 5_000,
      available: 2892,
      method: bankMethod,
      terms: true,
    }),
    /available to withdraw/,
  );
  assert.equal(
    wallet.payoutDraftError({
      amount: 500,
      available: 2892,
      method: bankMethod,
      terms: false,
    }),
    "Acknowledge the payout terms to continue",
  );
  assert.equal(
    wallet.depositDraftError({
      amount: 500,
      rail: fieldless,
      fields: {},
      terms: true,
      dailyUsed: 0,
    }),
    "",
  );
});

/* ── Reducer ── */

test("a deposit writes one row, moves the balance and audits itself", () => {
  const next = wallet.applyWalletCommand(
    workspace,
    {
      kind: "deposit",
      amount: 1000,
      rail: "bank_transfer",
      methodLabel: "Equity Bank ·•••• 8842",
      providerRef: "",
      note: "",
    },
    NOW,
  );
  assert.equal(next.revision, 1);
  assert.equal(next.transactions.length, 20);
  assert.equal(next.balance.available, 3892);
  assert.equal(next.lifetime.deposited, 39024);
  assert.equal(next.lifetime.depositCount, 7);
  assert.equal(next.audit.length, 1);
  assert.match(next.audit[0].action, /deposit/);
  // the shipped fixture is never mutated
  assert.equal(workspace.balance.available, 2892);
  assert.equal(workspace.transactions.length, 19);
});

test("a payout reserves cash and a cancellation returns it", () => {
  const requested = wallet.applyWalletCommand(
    workspace,
    {
      kind: "requestPayout",
      amount: 500,
      methodId: "pm_bank_8842",
      note: "",
    },
    NOW,
  );
  assert.equal(requested.balance.available, 2392);
  assert.equal(requested.balance.pendingPayoutGross, 620);
  assert.equal(requested.balance.pendingPayoutCount, 2);
  assert.equal(requested.payouts.length, 6);
  assert.equal(requested.payouts[0].status, "processing");
  assert.equal(requested.payouts[0].fee, 3);
  assert.equal(requested.payouts[0].net, 497);

  const cancelled = wallet.applyWalletCommand(
    requested,
    {
      kind: "cancelPayout",
      payoutId: requested.payouts[0].id,
      reason: "changed_plan",
    },
    NOW,
  );
  assert.equal(cancelled.balance.available, 2892);
  assert.equal(cancelled.balance.pendingPayoutGross, 120);
  assert.equal(
    cancelled.payouts.find((row) => row.id === requested.payouts[0].id).status,
    "refunded",
  );
});

test("saved methods can be added, verified, defaulted and removed", () => {
  const added = wallet.applyWalletCommand(
    workspace,
    {
      kind: "addMethod",
      methodKind: "bank",
      label: "Side account",
      provider: "KCB Bank",
      detail: "•••• 5511",
      reference: "Jane Investor",
      note: "",
    },
    NOW,
  );
  assert.equal(added.methods.length, 5);
  const created = added.methods.at(-1);
  assert.equal(created.verified, false);
  assert.equal(created.isDefault, false);
  assert.equal(created.payoutEnabled, true);

  const verified = wallet.applyWalletCommand(
    added,
    { kind: "verifyMethod", methodId: created.id, code: "123456" },
    NOW,
  );
  assert.equal(verified.methods.at(-1).verified, true);

  const defaulted = wallet.applyWalletCommand(
    verified,
    { kind: "setDefaultMethod", methodId: created.id },
    NOW,
  );
  assert.equal(defaulted.methods.filter((row) => row.isDefault).length, 1);
  assert.equal(wallet.defaultMethod(defaulted).id, created.id);

  const removed = wallet.applyWalletCommand(
    defaulted,
    { kind: "removeMethod", methodId: created.id },
    NOW,
  );
  assert.equal(removed.methods.length, 4);
  assert.equal(removed.methods.filter((row) => row.isDefault).length, 1);
  assert.ok(wallet.defaultMethod(removed));
});

test("only a processing payout can be cancelled", () => {
  assert.throws(
    () =>
      wallet.applyWalletCommand(workspace, {
        kind: "cancelPayout",
        payoutId: "po_paid_1",
        reason: "other",
      }),
    /Only a processing payout can be cancelled/,
  );
  assert.throws(
    () =>
      wallet.applyWalletCommand(workspace, {
        kind: "requestPayout",
        amount: 9000,
        methodId: "pm_bank_8842",
        note: "",
      }),
    /available to withdraw/,
  );
  assert.throws(
    () =>
      wallet.applyWalletCommand(workspace, {
        kind: "requestPayout",
        amount: 100,
        methodId: "pm_card_4242",
        note: "",
      }),
    /deposit-only method/,
  );
  assert.throws(
    () =>
      wallet.applyWalletCommand(workspace, {
        kind: "deposit",
        amount: 20_000,
        rail: "card",
        methodLabel: "Visa ·•••• 4242",
        providerRef: "",
        note: "",
      }),
    /Maximum deposit on Card/,
  );
});

test("preferences, filters, exports, acknowledgements and support persist", () => {
  const saved = wallet.applyWalletCommand(
    workspace,
    {
      kind: "savePreferences",
      emailReceipts: false,
      autoPayout: true,
      payoutThreshold: 750,
      lowBalanceAlert: false,
    },
    NOW,
  );
  assert.deepEqual(saved.preferences, {
    emailReceipts: false,
    autoPayout: true,
    payoutThreshold: 750,
    lowBalanceAlert: false,
  });

  const filtered = wallet.applyWalletCommand(
    saved,
    {
      kind: "saveFilters",
      types: ["payout", "fee"],
      methods: ["bank_transfer"],
      from: "2026-10-01",
      to: "2026-10-23",
      query: "PO-",
    },
    NOW,
  );
  assert.deepEqual(filtered.filters.types, ["payout", "fee"]);
  assert.equal(filtered.filters.from, "2026-10-01");

  const exported = wallet.applyWalletCommand(
    filtered,
    {
      kind: "exportReport",
      scope: "statement",
      format: "csv",
      count: 19,
    },
    NOW,
  );
  assert.equal(exported.exports.length, 1);
  assert.equal(exported.exports[0].format, "csv");

  const acknowledged = wallet.applyWalletCommand(
    exported,
    { kind: "acknowledge", scope: "risk" },
    NOW,
  );
  assert.equal(acknowledged.acknowledgements.at(-1).scope, "risk");

  const supported = wallet.applyWalletCommand(
    acknowledged,
    {
      kind: "support",
      topic: "payout",
      message: "Please raise my payout ceiling for the November cycle.",
    },
    NOW,
  );
  assert.equal(supported.support.length, 1);
  assert.equal(supported.support[0].status, "local_draft");
});

/* ── Filters ── */

test("statement filters narrow the ledger by type, method, date and query", () => {
  const payouts = wallet.filterTransactions(workspace.transactions, {
    types: ["payout"],
    methods: [],
    from: "",
    to: "",
    query: "",
  });
  assert.equal(payouts.length, 5);

  const bank = wallet.filterTransactions(workspace.transactions, {
    types: [],
    methods: ["bank_transfer"],
    from: "",
    to: "",
    query: "",
  });
  assert.ok(bank.length >= 5, `bank rows: ${bank.length}`);
  assert.ok(bank.every((row) => row.method === "bank_transfer"));

  const window = wallet.filterTransactions(workspace.transactions, {
    types: [],
    methods: [],
    from: "2026-10-01",
    to: "2026-10-11",
    query: "",
  });
  assert.ok(window.every((row) => row.at.slice(0, 10) <= "2026-10-11"));
  assert.ok(window.every((row) => row.at.slice(0, 10) >= "2026-10-01"));

  const searched = wallet.filterTransactions(workspace.transactions, {
    types: [],
    methods: [],
    from: "",
    to: "",
    query: "PKG-01",
  });
  assert.ok(searched.length >= 2);
  assert.ok(searched.some((row) => row.poolCode === "PKG-01"));
  assert.ok(
    searched.every((row) =>
      `${row.description} ${row.poolCode ?? ""}`.includes("PKG-01"),
    ),
  );

  const newest = wallet.newestFirst(workspace.transactions);
  assert.equal(newest[0].at.slice(0, 10), "2026-10-22");
  assert.equal(wallet.depositedToday(workspace.transactions, workspace.asOf), 0);
});

/* ── Route ── */

const route = read("src/app/api/investor/wallet/route.ts");
const page = read("src/app/investor/wallet/page.tsx");
const component = read("src/components/investor/investor-wallet-page.tsx");
const hook = read("src/lib/investor/use-wallet.ts");
const css = read("src/styles/pages/investor-wallet.css");

test("the wallet API is a read-only projection with a strict query contract", () => {
  assert.match(route, /export function GET\(request: Request\)/);
  assert.doesNotMatch(route, /export (async )?function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /\.strict\(\)/);
  assert.match(route, /Duplicate query parameter/);
  assert.match(route, /, 400\)/);
  for (const section of [
    "workspace",
    "balance",
    "lifetime",
    "transactions",
    "payouts",
    "recent-payouts",
    "methods",
    "depositRails",
    "payoutRails",
    "limits",
    "preferences",
    "exports",
    "profile",
    "audit",
  ]) {
    assert.ok(route.includes(`"${section}"`), section);
  }
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(route, /getWalletWorkspace/);
});

test("the route hydrates one workspace and forwards ?action=", () => {
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /title: "Wallet & finances \(I-7\)/);
  assert.match(page, /searchParams/);
  assert.match(page, /<InvestorWalletPage initial=\{workspace\} initialAction=\{action\} \/>/);
  assert.match(component, /initialAction\?: string/);
  assert.match(component, /const kind = initialAction \? actionMap\[initialAction\] : undefined/);
});

test("the client hook owns the specified query keys and 30s overview poll", () => {
  assert.match(hook, /\["wallet", "workspace"\]/);
  assert.match(hook, /\["wallet", "overview"\]/);
  assert.match(hook, /\["wallet", "transactions", \{ page, filters \}\]/);
  assert.match(hook, /\["wallet", "recent-payouts", \{ limit \}\]/);
  assert.match(hook, /\["wallet", "payment-methods"\]/);
  assert.match(hook, /WALLET_OVERVIEW_REFETCH_MS = 30_000/);
  assert.match(hook, /refetchInterval: WALLET_OVERVIEW_REFETCH_MS/);
  assert.match(hook, /useMutation/);
  assert.match(hook, /applyWalletCommand/);
});

test("the page is built from the shared shell with five anchored sections", () => {
  assert.match(component, /<InvestorShell/);
  assert.match(component, /rootClass="page-investor-wallet"/);
  for (const id of [
    "wa-overview",
    "wa-deposit",
    "wa-payout",
    "wa-history",
    "wa-methods",
  ]) {
    assert.ok(component.includes(`id="${id}"`), id);
  }
  assert.equal(component.match(/className="wa-section"/g).length, 5);
  assert.match(component, /title="What the account is worth today"/);
  assert.match(component, /title="Add funds to the wallet"/);
  assert.match(component, /title="Request a payout"/);
  assert.match(component, /title="Transaction history"/);
  assert.match(component, /title="Payment methods"/);
});

test("the page keeps the required 15+ dialogs, wizards and a drawer", () => {
  const kinds = new Set(
    [...component.matchAll(/^  ([a-zA-Z]+):\s*"[\s\S]*?",$/gm)].map((m) => m[1]),
  );
  const titleBlock = component.slice(
    component.indexOf("const titles: Record<Kind, string> = {"),
    component.indexOf("const wizardSteps"),
  );
  const titleKeys = [...titleBlock.matchAll(/^\s{2}([a-zA-Z]+):/gm)].map(
    (m) => m[1],
  );
  assert.ok(titleKeys.length >= 20, `kinds: ${titleKeys.length}`);
  const wizardBlock = component.slice(
    component.indexOf("const wizardSteps"),
    component.indexOf("const modalSize"),
  );
  const wizardKeys = [...wizardBlock.matchAll(/^\s{2}([a-zA-Z]+):/gm)].map(
    (m) => m[1],
  );
  assert.ok(wizardKeys.length >= 5, `wizards: ${wizardKeys.join(",")}`);
  for (const kind of wizardKeys) assert.ok(titleKeys.includes(kind), kind);
  assert.match(component, /<DeskModalShell/);
  assert.match(component, /currentStep=\{wizardStep\}/);
  assert.match(component, /steps=\{wizard\}/);
  assert.match(component, /wa-drawer-layer/);
  assert.match(component, /role="dialog"/);
  assert.ok(kinds.size >= 0);
});

test("every dialog opened by the page is registered in the title map", () => {
  const titleBlock = component.slice(
    component.indexOf("const titles: Record<Kind, string> = {"),
    component.indexOf("const wizardSteps"),
  );
  const registered = new Set(
    [...titleBlock.matchAll(/^\s{2}([a-zA-Z]+):/gm)].map((m) => m[1]),
  );
  const opened = new Set(
    [...component.matchAll(/open\("([a-zA-Z]+)"\)/g)].map((m) => m[1]),
  );
  assert.ok(opened.size >= 15, `opened: ${opened.size}`);
  for (const kind of opened) assert.ok(registered.has(kind), kind);
  const actionMap = component.slice(
    component.indexOf("const actionMap: Record<string, Kind> = {"),
    component.indexOf("const [modal, setModal]"),
  );
  const mapped = [...actionMap.matchAll(/^\s{4}"?([a-zA-Z-]+)"?: "([a-zA-Z]+)"/gm)];
  assert.ok(mapped.length >= 15);
  for (const [, , kind] of mapped) assert.ok(registered.has(kind), kind);
});

test("the bottom dock exposes at least four working quick actions", () => {
  const block = component.slice(
    component.indexOf("const quickActions: InvestorQuickAction[] = ["),
    component.indexOf("const sections = ["),
  );
  const actions = [...block.matchAll(/key: "([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(actions.length >= 4);
  assert.match(component, /onQuickAction=\{\(key\) => \{/);
  for (const key of actions)
    assert.ok(
      component.includes(`if (key === "${key}")`),
      `quick action ${key}`,
    );
  assert.match(component, /onChromeReady=\{\(chromeApi\) => \{/);
});

test("the statement uses TanStack Table with sortable columns", () => {
  assert.match(component, /createDeskColumnHelper<WalletTransaction>/);
  assert.match(component, /useDeskTable\(\{/);
  assert.match(component, /getToggleSortingHandler\(\)/);
  assert.match(component, /header: "Balance after"/);
  assert.match(component, /TRANSACTIONS_PER_PAGE/);
  assert.match(component, /wa-table--stack/);
});

test("no placeholder copy, empty hrefs or dead buttons in the page", () => {
  const source = component;
  for (const bad of [
    /href=""/,
    /href="#"/,
    /href="javascript/,
    /Coming soon/i,
    /Lorem ipsum/i,
    /TODO/,
    /FIXME/,
    /placeholder page/i,
  ]) {
    assert.doesNotMatch(source, bad);
  }
  const anchors = [...source.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(anchors.length >= 5);
  for (const href of anchors)
    assert.ok(href.startsWith("/investor"), `href ${href}`);
});

test("the wallet stylesheet is scoped, flat and responsive", () => {
  assert.match(css, /\.page-investor-wallet \.wa-page \{/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(css, /--accent: #0f766e|var\(--accent\)/);
  for (const cls of [
    ".wa-hero",
    ".wa-kpi",
    ".wa-rail",
    ".wa-fee-preview",
    ".wa-table",
    ".wa-method-card",
    ".wa-drawer-layer",
    ".wa-modal-layer",
  ]) {
    assert.ok(css.includes(cls), cls);
  }
  assert.match(css, /@media \(max-width: 767\.98px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /keyframes waFadeUp/);

  const globals = read("src/app/globals.css");
  assert.match(globals, /investor-wallet\.css/);
  const index = globals.indexOf("investor-investments.css");
  const walletIndex = globals.indexOf("investor-wallet.css");
  assert.ok(walletIndex > index);
});

test("the shell links the wallet route while keeping in-page entries", () => {
  const shell = read("src/components/investor/investor-shell.tsx");
  const account = shell.slice(shell.indexOf('group: "Account"'));
  const block = account.slice(0, account.indexOf("];"));
  assert.match(block, /key: "wallet"[\s\S]*?href: "\/investor\/wallet"/);
  assert.match(block, /code: "I-7"/);
  assert.match(component, /activeNav=\{activeNav\}/);
  assert.match(component, /router\.push\("\/investor\/investments"\)/);
});
