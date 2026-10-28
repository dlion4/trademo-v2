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
      ? load("src/" + id.slice(2) + (id.endsWith(".tsx") ? "" : ".ts"))
      : id.startsWith("./")
        ? load(path.join(path.dirname(file), id) + ".ts")
        : require(id);
  new Function("exports", "require", "module", output)(mod.exports, req, mod);
  cache.set(file, mod.exports);
  return mod.exports;
}

const lib = load("src/lib/investor/notifications.ts");
const { getNotificationsWorkspace } = load(
  "src/server/services/investor-notifications-service.ts",
);
const { getLiveTradeWorkspace } = load("src/server/services/investor-live-service.ts");
const { getWalletWorkspace } = load("src/server/services/investor-wallet-service.ts");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const workspace = getNotificationsWorkspace();
const component = read("src/components/investor/investor-notifications-page.tsx");
const css = read("src/styles/pages/investor-notifications.css");
const page = read("src/app/investor/notifications/page.tsx");
const api = read("src/app/api/investor/notifications/route.ts");
const hook = read("src/lib/investor/use-notifications.ts");

/* ── Snapshot ── */

test("the notifications desk ships a complete demo workspace", () => {
  assert.equal(workspace.mode, "demo");
  assert.equal(workspace.asOf, "2026-10-23T10:00:00Z");
  assert.equal(workspace.revision, 0);
  assert.equal(workspace.profile.displayName, "Jane Investor");
  assert.equal(workspace.profile.kycLevel, "L2");
  assert.equal(workspace.profile.country, "Kenya");
  assert.ok(workspace.notifications.length >= 20);
  assert.ok(workspace.tradeActivity.length >= 40);
  assert.ok(workspace.poolUpdates.length >= 12);
  assert.ok(workspace.paymentAlerts.length >= 10);
  assert.ok(workspace.securityEvents.length >= 10);
  assert.equal(workspace.sessions.length, 3);
  assert.equal(workspace.rules.length, 5);
  assert.equal(workspace.deliveries.length, 4);
  assert.deepEqual(workspace.exports, []);
  assert.deepEqual(workspace.support, []);
  assert.deepEqual(workspace.audit, []);
});

test("every inbox row resolves to a real surface and a real category", () => {
  const categories = new Set(["trade", "pool", "payment", "security"]);
  const levels = new Set(["info", "success", "warning", "critical"]);
  for (const row of workspace.notifications) {
    assert.ok(categories.has(row.category), `${row.id} category`);
    assert.ok(levels.has(row.level), `${row.id} level`);
    assert.ok(row.href.startsWith("/investor"), `${row.id} href`);
    assert.ok(row.openLabel.length > 0, `${row.id} label`);
    assert.ok(row.title.length > 0 && row.detail.length > 0, `${row.id} copy`);
    assert.ok(row.delivered.includes("inApp"), `${row.id} delivers in-app`);
    assert.ok(row.source.length > 0, `${row.id} source`);
    if (row.href.startsWith("/investor/pools/")) {
      assert.ok(row.poolId, `${row.id} pool link needs a pool id`);
    }
  }
});

test("the unread queue matches the spec samples", () => {
  const unread = workspace.notifications.filter((row) => !row.read);
  assert.equal(unread.length, 6);
  const titles = unread.map((row) => row.title);
  assert.ok(titles.some((title) => title.startsWith("Trade won +$8.40")));
  assert.ok(titles.some((title) => title.startsWith("Daily summary")));
  assert.ok(titles.some((title) => title.startsWith("Payout processing")));
  assert.ok(titles.some((title) => title.startsWith("Sign-in from")));
  assert.ok(titles.some((title) => title.startsWith("PKG-02 Premium Yield closes")));
});

test("inbox money claims agree with the trade and wallet ledgers", () => {
  const live = getLiveTradeWorkspace();
  const wallet = getWalletWorkspace();
  const tradeWin = workspace.notifications.find((row) => row.id === "ntf_trade_win");
  assert.equal(tradeWin.amount, live.feed[0].yourShareNet);
  assert.match(tradeWin.title, /\+\$8\.40/);

  const deposit = workspace.notifications.find((row) => row.id === "ntf_deposit_oct");
  const statement = wallet.transactions.filter((row) => row.type === "deposit");
  assert.equal(deposit.amount, statement[statement.length - 1].amount);

  const payout = workspace.notifications.find(
    (row) => row.id === "ntf_payout_processing",
  );
  const processing = wallet.payouts.find((row) => row.status === "processing");
  assert.equal(payout.amount, processing.gross);
  assert.match(payout.detail, new RegExp(processing.reference));
});

/* ── Ledgers ── */

test("the trade ledger mirrors I-5 and its net is the session total", () => {
  const live = getLiveTradeWorkspace();
  const stats = lib.tradeStats(workspace.tradeActivity);
  assert.equal(stats.trades, live.stats.trades);
  assert.equal(stats.wins, live.stats.wins);
  assert.equal(stats.losses, live.stats.losses);
  assert.equal(stats.winRatePct, live.stats.winRatePct);
  assert.equal(stats.net, 39.9);
  assert.equal(stats.volume, 1820);
  assert.equal(stats.best.yourShareNet, 8.4);
  assert.equal(stats.worst.yourShareNet, -10.5);
  assert.deepEqual(
    stats.pools.map((row) => row.code),
    ["PKG-01", "PKG-03"],
  );
  assert.equal(
    workspace.tradeActivity.filter((row) => row.result === "win").length,
    stats.wins,
  );
});

test("every trade row carries the six table columns", () => {
  for (const row of workspace.tradeActivity) {
    assert.match(row.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.ok(row.poolCode.startsWith("PKG-"));
    assert.ok(row.symbol.length >= 2);
    assert.ok(row.result === "win" || row.result === "loss");
    assert.equal(typeof row.yourShareNet, "number");
    assert.equal(lib.clockShort(row.at).length, 5);
  }
});

test("the pool timeline keeps Guardian, lifecycle and closing events", () => {
  const kinds = new Set(workspace.poolUpdates.map((row) => row.kind));
  assert.ok(kinds.has("guardian_paused") || kinds.has("guardian_watch"));
  assert.ok(kinds.has("trading_started"));
  assert.ok(kinds.has("booking_confirmed"));
  assert.ok(kinds.has("closing_soon"));
  const sorted = workspace.poolUpdates.map((row) => row.at);
  assert.deepEqual(sorted, [...sorted].sort().reverse());
  for (const row of workspace.poolUpdates) {
    assert.ok(row.href.startsWith("/investor"));
    assert.ok(row.status.length > 0);
  }
});

test("the payment ledger is the wallet statement, fees and all", () => {
  const wallet = getWalletWorkspace();
  const totals = lib.paymentTotals(workspace.paymentAlerts);
  const deposits = wallet.transactions.filter((row) => row.type === "deposit");
  assert.equal(totals.count, workspace.paymentAlerts.length);
  assert.equal(totals.deposits, lib.round2(deposits.reduce((s, r) => s + r.amount, 0)));
  assert.equal(totals.inFlight, 118.5);
  assert.ok(totals.payouts > 0);
  const failed = workspace.paymentAlerts.find((row) => row.kind === "payout_failed");
  assert.equal(failed.status, "failed");
  assert.equal(failed.gross, 500);
  for (const row of workspace.paymentAlerts) {
    assert.equal(row.net, lib.round2(row.gross - row.fee));
  }
});

test("the security ledger scores the posture honestly", () => {
  const posture = lib.securityPosture(
    workspace.securityEvents,
    workspace.sessions,
    workspace.profile,
  );
  assert.equal(posture.devices, 3);
  assert.equal(posture.trusted, 2);
  assert.equal(posture.failed, 1);
  assert.equal(posture.twoFactorPct, 100);
  assert.equal(posture.kycLevel, "L2");
  assert.equal(posture.kycVerifiedAt, "2026-10-19T09:00:00Z");
  assert.equal(posture.checks.length, 5);
  assert.equal(posture.score, 60);
  assert.ok(workspace.sessions.some((row) => row.current));
});

/* ── Derived views ── */

test("inbox summary and category counts agree", () => {
  const summary = lib.inboxSummary(workspace);
  assert.equal(summary.total, workspace.notifications.length);
  assert.equal(summary.unread, 6);
  assert.equal(summary.today, 1);
  assert.equal(summary.pinned, 1);
  assert.equal(summary.critical, 2);
  const counted = Object.values(summary.counts).reduce(
    (sum, row) => sum + row.total,
    0,
  );
  assert.equal(counted, summary.total);
});

test("filters narrow the inbox without emptying it", () => {
  const base = { ...lib.DEFAULT_FILTERS };
  assert.equal(lib.filterInbox(workspace.notifications, base, workspace.asOf).length, 24);
  assert.equal(
    lib.filterInbox(
      workspace.notifications,
      { ...base, category: "payment" },
      workspace.asOf,
    ).length,
    7,
  );
  assert.equal(
    lib.filterInbox(
      workspace.notifications,
      { ...base, unreadOnly: true },
      workspace.asOf,
    ).length,
    6,
  );
  assert.equal(
    lib.filterInbox(
      workspace.notifications,
      { ...base, pinnedOnly: true },
      workspace.asOf,
    ).length,
    1,
  );
  assert.equal(
    lib.filterInbox(
      workspace.notifications,
      { ...base, range: "today" },
      workspace.asOf,
    ).length,
    1,
  );
  assert.ok(
    lib.filterInbox(
      workspace.notifications,
      { ...base, query: "guardian" },
      workspace.asOf,
    ).length > 0,
  );
  assert.equal(
    lib.filterInbox(
      workspace.notifications,
      { ...base, query: "zzzzz" },
      workspace.asOf,
    ).length,
    0,
  );
  assert.equal(
    lib.filterInbox(
      workspace.notifications,
      { ...base, query: "PKG-02" },
      workspace.asOf,
    ).length > 0,
    true,
  );
});

test("pinned rows float above the newest row whatever the sort", () => {
  const rows = lib.filterInbox(
    workspace.notifications,
    { ...lib.DEFAULT_FILTERS, sort: "oldest" },
    workspace.asOf,
  );
  assert.equal(rows[0].pinned, true);
});

test("day groups label today and yesterday relative to the snapshot", () => {
  assert.equal(lib.dayLabel("2026-10-23T08:00:00Z", workspace.asOf), "Today");
  assert.equal(lib.dayLabel("2026-10-22T09:12:00Z", workspace.asOf), "Yesterday");
  const groups = lib.groupByDay(workspace.notifications, workspace.asOf);
  assert.equal(groups[0].label, "Today");
  assert.equal(
    groups.reduce((sum, group) => sum + group.items.length, 0),
    workspace.notifications.length,
  );
});

test("pagination never returns an empty page inside the range", () => {
  const total = workspace.tradeActivity.length;
  const first = lib.paginate(workspace.tradeActivity, 1, 8);
  assert.equal(first.page, 1);
  assert.equal(first.rows.length, 8);
  assert.equal(first.pages, Math.ceil(total / 8));
  assert.equal(first.total, total);

  const last = lib.paginate(workspace.tradeActivity, 999, 8);
  assert.equal(last.page, last.pages);
  assert.ok(last.rows.length > 0);
  assert.equal(lib.paginate([], 3, 8).page, 1);
});

test("relative times read off the snapshot clock", () => {
  assert.equal(lib.relativeTo("2026-10-23T09:48:00Z", workspace.asOf), "12 min ago");
  assert.equal(lib.relativeTo("2026-10-23T07:00:00Z", workspace.asOf), "3 h ago");
  assert.equal(lib.relativeTo("2026-10-21T10:00:00Z", workspace.asOf), "2 d ago");
  assert.equal(lib.relativeTo("2026-10-23T10:00:01Z", workspace.asOf), "just now");
});

/* ── Commands ── */

test("marking read moves the badge and can be undone", () => {
  const read = lib.applyNotificationCommand(workspace, {
    kind: "markRead",
    id: "ntf_trade_win",
  });
  assert.equal(lib.inboxSummary(read).unread, 5);
  assert.equal(read.revision, 1);
  assert.equal(read.audit[0].action, "notification_read");
  assert.equal(
    lib.applyNotificationCommand(read, { kind: "markUnread", id: "ntf_trade_win" })
      .notifications.find((row) => row.id === "ntf_trade_win").read,
    false,
  );
  assert.throws(
    () => lib.applyNotificationCommand(read, { kind: "markRead", id: "ntf_trade_win" }),
    /already read/,
  );
  assert.throws(
    () => lib.applyNotificationCommand(read, { kind: "markRead", id: "ntf_nope" }),
    /no longer in the inbox/,
  );
});

test("mark all read honours the category scope", () => {
  const scoped = lib.applyNotificationCommand(workspace, {
    kind: "markAllRead",
    category: "payment",
  });
  assert.equal(lib.inboxSummary(scoped).counts.payment.unread, 0);
  assert.equal(lib.inboxSummary(scoped).counts.trade.unread, 2);
  const cleared = lib.applyNotificationCommand(workspace, {
    kind: "markAllRead",
    category: "all",
  });
  assert.equal(lib.inboxSummary(cleared).unread, 0);
  assert.throws(
    () => lib.applyNotificationCommand(cleared, { kind: "markAllRead", category: "all" }),
    /already clear/,
  );
});

test("pins, snoozes and wakes behave", () => {
  const pinned = lib.applyNotificationCommand(workspace, {
    kind: "togglePin",
    id: "ntf_login",
  });
  assert.equal(lib.inboxSummary(pinned).pinned, 2);

  const snoozed = lib.applyNotificationCommand(workspace, {
    kind: "snooze",
    id: "ntf_daily",
    duration: "8h",
  });
  const row = snoozed.notifications.find((item) => item.id === "ntf_daily");
  assert.equal(new Date(row.snoozedUntil).toISOString(), "2026-10-23T18:00:00.000Z");
  assert.equal(lib.inboxSummary(snoozed).snoozed, 1);
  assert.equal(
    lib.applyNotificationCommand(snoozed, { kind: "unsnooze", id: "ntf_daily" })
      .notifications.find((item) => item.id === "ntf_daily").snoozedUntil,
    null,
  );
  assert.throws(
    () =>
      lib.applyNotificationCommand(workspace, {
        kind: "snooze",
        id: "ntf_login",
        duration: "1h",
      }),
    /cannot be snoozed/,
  );
});

test("preferences validate the three invariants", () => {
  const prefs = lib.emptyPreferences();
  assert.equal(prefs.channels.security.inApp, true);
  assert.equal(
    lib.preferencesDraftError({ preferences: prefs, silentCategories: [] }),
    "",
  );

  const noSecurity = {
    ...prefs,
    channels: { ...prefs.channels, security: { ...prefs.channels.security, inApp: false } },
  };
  assert.match(
    lib.preferencesDraftError({ preferences: noSecurity, silentCategories: [] }),
    /Security alerts must stay on in-app/,
  );

  const allOff = {
    ...prefs,
    channels: {
      trade: { inApp: false, email: false, push: false, sms: false },
      pool: { inApp: false, email: false, push: false, sms: false },
      payment: { inApp: false, email: false, push: false, sms: false },
      security: { inApp: false, email: false, push: false, sms: false },
    },
  };
  assert.match(
    lib.preferencesDraftError({ preferences: allOff, silentCategories: [] }),
    /at least one category/,
  );
  assert.match(
    lib.preferencesDraftError({
      preferences: prefs,
      silentCategories: ["trade", "pool", "payment", "security"],
    }),
    /Every category is muted/,
  );

  const badQuiet = {
    ...prefs,
    quietHours: { enabled: true, from: "22:00", to: "22:00" },
  };
  assert.match(
    lib.preferencesDraftError({ preferences: badQuiet, silentCategories: [] }),
    /same time/,
  );

  const highFloor = { ...prefs, minTradeAmount: 501 };
  assert.match(
    lib.preferencesDraftError({ preferences: highFloor, silentCategories: [] }),
    /above \$500/,
  );

  const saved = lib.applyNotificationCommand(workspace, {
    kind: "savePreferences",
    channels: prefs.channels,
    digest: "weekly",
    digestHour: 7,
    quietHours: { enabled: false, from: "22:00", to: "07:00" },
    minTradeAmount: 12,
    guardianAlerts: true,
    poolStatusAlerts: false,
    sound: true,
    desktopPush: false,
    weeklySummary: true,
  });
  assert.equal(saved.preferences.digest, "weekly");
  assert.equal(saved.preferences.minTradeAmount, 12);
  assert.equal(saved.audit[0].action, "preferences_saved");
});

test("rules, exports, support and sessions are capped and audited", () => {
  const withRule = lib.applyNotificationCommand(workspace, {
    kind: "addRule",
    label: "Quiet PKG-03 only",
    category: "pool",
    action: "digest",
  });
  assert.equal(withRule.rules.length, 6);
  assert.equal(withRule.audit[0].action, "rule_added");

  const toggled = lib.applyNotificationCommand(withRule, {
    kind: "toggleRule",
    ruleId: "rule_guardian",
  });
  assert.equal(toggled.rules.find((row) => row.id === "rule_guardian").enabled, false);
  assert.equal(
    lib.applyNotificationCommand(toggled, {
      kind: "deleteRule",
      ruleId: "rule_guardian",
    }).rules.length,
    5,
  );

  const exported = lib.applyNotificationCommand(workspace, {
    kind: "exportReport",
    scope: "trade",
    format: "csv",
    count: 47,
  });
  assert.equal(exported.exports.length, 1);
  assert.equal(exported.exports[0].count, 47);

  const revoked = lib.applyNotificationCommand(workspace, {
    kind: "revokeSession",
    sessionId: "ses_old",
  });
  assert.equal(revoked.sessions.length, 2);
  assert.throws(
    () =>
      lib.applyNotificationCommand(workspace, {
        kind: "revokeSession",
        sessionId: "ses_current",
      }),
    /session you are using/,
  );

  const drafted = lib.applyNotificationCommand(workspace, {
    kind: "support",
    topic: "delivery",
    message: "The 22:00 payout alert never reached my phone.",
  });
  assert.equal(drafted.support.length, 1);
  assert.equal(drafted.support[0].status, "local_draft");
  assert.throws(
    () =>
      lib.applyNotificationCommand(workspace, {
        kind: "support",
        topic: "delivery",
        message: "too short",
      }),
    /too_small|at least 12 characters|Invalid/,
  );
});

test("the command schema rejects unknown kinds and bad ids", () => {
  assert.equal(
    lib.notificationCommandSchema.safeParse({ kind: "explode" }).success,
    false,
  );
  assert.equal(
    lib.notificationCommandSchema.safeParse({ kind: "markRead", id: "x" }).success,
    false,
  );
  assert.equal(
    lib.notificationCommandSchema.safeParse({ kind: "markAllRead" }).success,
    true,
  );
  assert.equal(
    lib.notificationCommandSchema.safeParse({
      kind: "snooze",
      id: "ntf_x",
      duration: "5m",
    }).success,
    false,
  );
});

test("reset restores every row and keeps the record", () => {
  const read = lib.applyNotificationCommand(workspace, {
    kind: "markAllRead",
    category: "all",
  });
  const reset = lib.applyNotificationCommand(read, { kind: "resetInbox" });
  assert.equal(lib.inboxSummary(reset).unread, workspace.notifications.length);
  assert.equal(lib.inboxSummary(reset).pinned, 0);
  assert.equal(reset.notifications.length, workspace.notifications.length);
  assert.equal(reset.audit[0].action, "inbox_reset");
});

/* ── Exports ── */

test("every export scope yields a matrix and CSV", () => {
  for (const scope of ["inbox", "trade", "pool", "payment", "security", "digest"]) {
    const matrix = lib.exportMatrix(workspace, scope);
    assert.ok(matrix.header.length > 0, scope);
    assert.ok(matrix.rows.length > 0, scope);
    const csv = lib.csvOf(matrix);
    assert.equal(csv.split("\n").length, matrix.rows.length + 1);
  }
  const inboxCsv = lib.csvOf(lib.exportMatrix(workspace, "inbox"));
  assert.match(inboxCsv, /^At,Category,Level,Title,Read,Pool/);
});

/* ── Source contracts ── */

test("the page route renders the desk instead of redirecting", () => {
  assert.ok(page.includes("getNotificationsWorkspace"));
  assert.ok(page.includes("InvestorNotificationsPage"));
  assert.ok(!/redirect\(/.test(page));
  assert.ok(page.includes("searchParams"));
});

test("the API route is a read-only sectioned projection", () => {
  assert.ok(api.includes("const sections"));
  assert.ok(api.includes("z.enum(sections)"));
  assert.ok(api.includes('"no-store"'));
  assert.ok(api.includes("export function GET"));
  assert.ok(api.includes("export const POST = methodNotAllowed"));
  assert.ok(!/export (async )?function POST/.test(api));
  for (const section of [
    "workspace",
    "unread",
    "inbox",
    "trade-activity",
    "pool-updates",
    "payment-alerts",
    "system-security",
    "sessions",
    "preferences",
    "rules",
    "deliveries",
    "summary",
    "exports",
    "audit",
    "profile",
  ]) {
    assert.ok(api.includes(`"${section}"`), section);
  }
});

test("the hook exposes the five specified query keys", () => {
  assert.ok(hook.includes('["notifications", "unread"]'));
  assert.ok(hook.includes('["notifications", section, { page }]'));
  for (const section of [
    "trade-activity",
    "pool-updates",
    "payment-alerts",
    "system-security",
  ]) {
    assert.ok(hook.includes(`"${section}"`), section);
  }
  assert.ok(hook.includes("NOTIFICATIONS_UNREAD_REFETCH_MS = 30_000"));
  assert.ok(hook.includes("markRead"));
  assert.ok(hook.includes("markAllRead"));
  assert.ok(hook.includes("updatePreferences"));
  assert.ok(hook.includes("refetchInterval"));
});

test("the component keeps the dialog, wizard, drawer and dock contracts", () => {
  for (const surface of [
    "markReadWizard",
    "markAllWizard",
    "preferencesWizard",
    "ruleWizard",
    "exportWizard",
    "supportWizard",
    "snoozeWizard",
  ]) {
    assert.ok(component.includes(`wizardSteps`) && component.includes(`"${surface}"`), surface);
  }
  const kinds = component.match(/^  \| "[a-zA-Z]+"/gm) ?? [];
  assert.ok(kinds.length >= 24, `expected 24+ dialog kinds, found ${kinds.length}`);
  assert.ok(component.includes("DeskModalShell"));
  assert.ok(component.includes("quickActions"));
  assert.ok(component.includes('setDrawer("signal")'));
  assert.ok(component.includes("actionMap"));
  assert.ok(component.includes("useDeskTable"));
  assert.ok(component.includes("useLiveCountUp"));
  assert.ok(component.includes('rootClass="page-investor-notifications"'));
  for (const id of ["wa-inbox", "wa-trades", "wa-pools", "wa-payments", "wa-security"]) {
    assert.ok(component.includes(id), id);
  }
});

test("the stylesheet is scoped, gradient-free and responsive", () => {
  assert.ok(css.includes(".page-investor-notifications"));
  assert.ok(!/linear-gradient|radial-gradient"/.test(css.split("\n").filter((line) => line.includes("background:")).join("\n")));
  assert.equal(/gradient\(/.test(css), false);
  assert.ok(css.includes('@media (max-width: 768px)'));
  assert.ok(css.includes('@media (max-width: 420px)'));
  assert.ok(css.includes('[data-bs-theme="dark"] .page-investor-notifications'));
  assert.ok(css.includes("@keyframes nt-badge-pulse"));
  assert.ok(css.includes("@keyframes nt-fade-slide"));
  assert.ok(css.includes("prefers-reduced-motion"));
});

test("the shell links the notifications page", () => {
  const shell = read("src/components/investor/investor-shell.tsx");
  assert.ok(shell.includes('href: "/investor/notifications"'));
  assert.ok(shell.includes('code: "I-9"'));
  const globals = read("src/app/globals.css");
  assert.ok(globals.includes("investor-notifications.css"));
});
