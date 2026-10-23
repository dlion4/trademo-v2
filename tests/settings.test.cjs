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
const { getSettingsWorkspace } = load(
  "src/server/services/settings-service.ts",
);
const {
  applySettingsCommand: apply,
  securityIssues,
  notificationIssues,
  passwordIssues,
  publicHttps,
  events,
  renewalDays,
} = load("src/lib/settings/model.ts");
const base = () => getSettingsWorkspace();
const run = (s, command) => apply(s, command, "2026-10-23T11:00:00Z");
const throws = (fn, pattern) => assert.throws(fn, pattern);
const allOff = (s) => ({
  ...s.notifications,
  enabled: { email: false, telegram: false, push: false, webhook: false },
});

test("workspace is fully structured, isolated and reports seven sections", () => {
  const s = base();
  assert.equal(s.revision, 0);
  assert.equal(s.asOf, "2026-10-23T10:00:00Z");
  for (const key of [
    "profile",
    "connections",
    "platform",
    "security",
    "notifications",
    "apiKeys",
    "integrations",
    "billing",
    "checks",
    "audit",
  ])
    assert.ok(key in s, key);
  assert.equal(s.connections.length, 1);
  assert.equal(s.billing.invoices.length, 3);
  assert.equal(Object.keys(s.notifications.routes).length, events.length);
  const next = run(s, {
    kind: "profile",
    value: {
      ...s.profile,
      fullName: "Reviewed Operator",
      timezone: s.profile.timezone,
      phone: s.profile.phone,
      bio: s.profile.bio,
    },
  });
  assert.equal(next.profile.fullName, "Reviewed Operator");
  assert.equal(s.profile.fullName, "Jane Operator");
  assert.equal(next.revision, 1);
  assert.equal(next.audit[0].time, "2026-10-23T11:00:00Z");
});

test("profile commands validate length, timezone, phone and bio boundaries", () => {
  const s = base();
  throws(() =>
    run(s, { kind: "profile", value: { ...s.profile, fullName: "Jo" } }),
  );
  throws(() =>
    run(s, {
      kind: "profile",
      value: { ...s.profile, timezone: "Mars/Olympus" },
    }),
  );
  throws(() =>
    run(s, { kind: "profile", value: { ...s.profile, phone: "0700 000 000" } }),
  );
  throws(() =>
    run(s, { kind: "profile", value: { ...s.profile, bio: "x".repeat(501) } }),
  );
  assert.equal(s.profile.bio.length < 501, true);
});

test("avatar accepts only small jpeg data URLs and role preview is one-way", () => {
  const s = base();
  const png = "data:image/png;base64,iVBORw0KGgo=";
  throws(() => run(s, { kind: "avatar", dataUrl: png }));
  throws(() =>
    run(s, {
      kind: "avatar",
      dataUrl: "data:image/jpeg;base64," + "a".repeat(300001),
    }),
  );
  const next = run(s, {
    kind: "avatar",
    dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
  });
  assert.match(next.profile.avatar, /^data:image\/jpeg;base64,/);
  const both = run(s, { kind: "role" });
  assert.equal(both.profile.role, "both");
  throws(() => run(both, { kind: "role" }), /already enabled/);
  const mail = run(s, { kind: "emailRequest", email: "new@example.com" });
  assert.equal(mail.profile.email, s.profile.email);
  assert.match(mail.audit[0].detail, /current email unchanged/);
});

test("platform defaults enforce slider, precision and Guardian ranges", () => {
  const s = base();
  throws(() =>
    run(s, { kind: "platform", value: { ...s.platform, operatorSplit: 41 } }),
  );
  throws(() =>
    run(s, {
      kind: "platform",
      value: { ...s.platform, minInvestment: 1000.123 },
    }),
  );
  throws(() =>
    run(s, { kind: "platform", value: { ...s.platform, earningsMinutes: 2 } }),
  );
  throws(() =>
    run(s, { kind: "platform", value: { ...s.platform, batchTime: "24:00" } }),
  );
  throws(() =>
    run(s, { kind: "platform", value: { ...s.platform, maxInvestors: 501 } }),
  );
  throws(() =>
    run(s, { kind: "platform", value: { ...s.platform, guardianLosses: 16 } }),
  );
  throws(() =>
    run(s, { kind: "platform", value: { ...s.platform, drawdown: 0.5 } }),
  );
  const next = run(s, {
    kind: "platform",
    value: {
      ...s.platform,
      operatorSplit: 25,
      guardianLosses: 10,
      drawdown: 7,
    },
  });
  assert.equal(next.platform.operatorSplit, 25);
  assert.equal(next.billing.usage[0].used, s.billing.usage[0].used);
});

test("security rejects malformed addresses, duplicates and lockout drafts", () => {
  const s = base(),
    address = { address: "10.0.0.1", label: "Office" };
  const value = (ips) => ({ timeout: "30", whitelistEnabled: true, ips });
  throws(
    () =>
      run(s, {
        kind: "security",
        value: value([
          ...s.security.ips,
          { address: "10.0.0.0/8", label: "Range" },
        ]),
      }),
    /CIDR/,
  );
  throws(() =>
    run(s, {
      kind: "security",
      value: value([...s.security.ips, { address: "not-ip", label: "Bad" }]),
    }),
  );
  throws(
    () =>
      run(s, {
        kind: "security",
        value: value([
          ...s.security.ips,
          address,
          { ...address, label: "Dup" },
        ]),
      }),
    /unique/,
  );
  throws(
    () => run(s, { kind: "security", value: value([address]) }),
    /lockout/,
  );
  throws(() =>
    run(s, {
      kind: "security",
      value: value([...s.security.ips, { address: "10.0.0.1 ", label: "" }]),
    }),
  );
  const normalized = run(s, {
    kind: "security",
    value: value([
      ...s.security.ips,
      { address: " 10.0.0.1 ", label: "Office" },
      { address: "::1", label: "Loopback" },
    ]),
  });
  assert.ok(normalized.security.ips.some((i) => i.address === "10.0.0.1"));
  assert.ok(normalized.security.ips.some((i) => i.address === "::1"));
  assert.equal(securityIssues(s, value([address])).length, 1);
});

test("security events only record local requests", () => {
  const s = base();
  const pass = run(s, { kind: "securityEvent", event: "password_preview" });
  assert.equal(pass.security.passwordPreviewAt, "2026-10-23T11:00:00Z");
  assert.equal(pass.security.twoFactor, "source_enabled");
  const backup = run(s, { kind: "securityEvent", event: "backup_preview" });
  assert.ok(!("backupCodes" in backup.security));
  const disabled = run(s, { kind: "securityEvent", event: "disable_2fa" });
  assert.equal(disabled.security.twoFactor, "disable_requested");
  assert.match(disabled.audit[0].detail, /authentication unchanged/);
});

test("session revocation is scoped, repeatable and never claims invalidation", () => {
  const s = base();
  const one = run(s, { kind: "revokeSession", id: "session_safari" });
  assert.equal(
    one.security.sessions.find((x) => x.id === "session_safari").state,
    "revoke_requested",
  );
  assert.equal(
    one.security.sessions.find((x) => x.id === "session_current").state,
    "source_active",
  );
  assert.match(one.audit[0].detail, /remain active/);
  const all = run(one, { kind: "revokeSession", id: null });
  assert.ok(all.security.sessions.every((x) => x.state === "revoke_requested"));
  throws(
    () => run(s, { kind: "revokeSession", id: "session_missing" }),
    /not found/,
  );
});

test("notification routing validates handles, endpoints and enabled channels", () => {
  const s = base();
  assert.equal(notificationIssues(s.notifications).length, 0);
  throws(
    () =>
      run(s, {
        kind: "notifications",
        value: { ...s.notifications, telegramHandle: "jane" },
      }),
    /Telegram handle/,
  );
  throws(
    () =>
      run(s, {
        kind: "notifications",
        value: {
          ...s.notifications,
          enabled: { ...s.notifications.enabled, webhook: true },
          webhookUrl: "http://alerts.example.com",
        },
      }),
    /HTTPS/,
  );
  const off = allOff(s);
  throws(
    () => run(s, { kind: "notifications", value: off }),
    /Guardian alert route/,
  );
  const missing = {
    ...s.notifications,
    enabled: { ...s.notifications.enabled, webhook: true },
    webhookUrl: "",
  };
  throws(() => run(s, { kind: "notifications", value: missing }), /webhook/i);
  const routed = {
    ...s.notifications,
    enabled: { ...s.notifications.enabled, webhook: true },
    webhookUrl: "https://hooks.example.com/trademo",
  };
  assert.equal(
    run(s, { kind: "notifications", value: routed }).notifications.enabled
      .webhook,
    true,
  );
  assert.equal(publicHttps("https://user:pass@example.com/hook"), false);
  assert.equal(publicHttps("https://127.0.0.1/hook"), false);
  assert.equal(publicHttps("https://hooks.example.com/hook?x=1"), true);
});

test("connections respect plan caps, prefixes and prepared status", () => {
  const s = base();
  const demo = run(s, {
    kind: "addConnection",
    loginId: "VRTC200001",
    accountType: "Demo",
  });
  assert.equal(demo.connections.length, 2);
  const prepared = demo.connections.at(-1);
  assert.equal(prepared.status, "oauth_prepared");
  assert.equal(prepared.balance, null);
  assert.equal(prepared.primary, false);
  throws(
    () =>
      run(demo, {
        kind: "addConnection",
        loginId: "CR999999",
        accountType: "Real",
      }),
    /2 connection slots/,
  );
  throws(
    () =>
      run(s, {
        kind: "addConnection",
        loginId: "CR123456",
        accountType: "Real",
      }),
    /already exists/,
  );
  throws(
    () =>
      run(s, {
        kind: "addConnection",
        loginId: "VRTC200002",
        accountType: "Real",
      }),
    /VRTC/,
  );
  throws(
    () =>
      run(s, {
        kind: "addConnection",
        loginId: "CR200002",
        accountType: "Demo",
      }),
    /VRTC/,
  );
  throws(() =>
    run(s, { kind: "addConnection", loginId: "ABC123", accountType: "Real" }),
  );
});

test("connection actions mutate metadata only and reject invalid transitions", () => {
  const s = base();
  const disconnected = run(s, {
    kind: "connection",
    id: "deriv_primary",
    action: "disconnect",
  });
  assert.equal(disconnected.connections[0].status, "disconnected");
  assert.equal(disconnected.connections[0].primary, false);
  throws(
    () =>
      run(disconnected, {
        kind: "connection",
        id: "deriv_primary",
        action: "disconnect",
      }),
    /Already disconnected/,
  );
  throws(
    () =>
      run(disconnected, {
        kind: "connection",
        id: "deriv_primary",
        action: "primary",
      }),
    /source-connected/,
  );
  const reconnected = run(s, {
    kind: "connection",
    id: "deriv_primary",
    action: "reconnect",
  });
  assert.equal(reconnected.connections[0].status, "oauth_prepared");
  throws(
    () => run(s, { kind: "connection", id: "missing", action: "refresh" }),
    /not found/,
  );
});

test("checks are configuration-only records with strict preconditions", () => {
  const s = base();
  const check = run(s, {
    kind: "check",
    target: "deriv_primary",
    targetType: "connection",
  });
  assert.equal(check.checks[0].result, "configuration_only");
  assert.match(check.audit[0].detail, /no ping/i);
  const channel = run(s, {
    kind: "check",
    target: "email",
    targetType: "channel",
  });
  assert.equal(channel.checks[0].kind, "channel");
  throws(
    () => run(s, { kind: "check", target: "webhook", targetType: "channel" }),
    /Enable/,
  );
  throws(
    () => run(s, { kind: "check", target: "slack", targetType: "integration" }),
    /Prepare/,
  );
  throws(() =>
    run(s, { kind: "check", target: "stripe", targetType: "database" }),
  );
  const slack = run(s, {
    kind: "integration",
    id: "slack",
    endpoint: "",
    reference: "oauth-preference",
  });
  assert.equal(
    run(slack, { kind: "check", target: "slack", targetType: "integration" })
      .checks.length,
    1,
  );
});

test("API keys are generated metadata with unique prefixes and scoped revocation", () => {
  const s = base(),
    value = {
      name: "Reporting preview",
      prefix: "demo_trademo_abcdef12",
      scopes: ["read"],
    };
  const next = run(s, { kind: "generateKey", ...value });
  assert.equal(next.apiKeys[0].state, "demo_generated");
  assert.equal(next.apiKeys[0].prefix, "demo_trademo_abcdef12");
  assert.equal(next.apiKeys[0].lastUsed, null);
  assert.ok(!("secret" in next.apiKeys[0]));
  throws(() => run(next, { kind: "generateKey", ...value }), /collision/);
  throws(
    () => run(s, { kind: "generateKey", ...value, scopes: ["read", "read"] }),
    /unique scopes/,
  );
  throws(() => run(s, { kind: "generateKey", ...value, name: "AB" }));
  throws(() =>
    run(s, { kind: "generateKey", ...value, prefix: "demo_trademo_ABC" }),
  );
  const revoked = run(next, { kind: "revokeKey", id: next.apiKeys[0].id });
  assert.equal(revoked.apiKeys[0].state, "revoke_requested");
  assert.match(revoked.audit[0].detail, /no server key invalidated/);
  throws(
    () => run(revoked, { kind: "revokeKey", id: revoked.apiKeys[0].id }),
    /active/,
  );
});

test("integrations require HTTPS endpoints and vault references without storing secrets", () => {
  const s = base();
  throws(
    () =>
      run(s, {
        kind: "integration",
        id: "stripe",
        endpoint: "http://hooks.example.com/x",
        reference: "vault://demo/stripe",
      }),
    /HTTPS/,
  );
  throws(
    () =>
      run(s, {
        kind: "integration",
        id: "stripe",
        endpoint: "https://user:pass@hooks.example.com/x",
        reference: "vault://demo/stripe",
      }),
    /HTTPS/,
  );
  throws(
    () =>
      run(s, {
        kind: "integration",
        id: "stripe",
        endpoint: "https://hooks.example.com/x",
        reference: "whsec_123456789",
      }),
    /vault/,
  );
  const next = run(s, {
    kind: "integration",
    id: "stripe",
    endpoint: "https://hooks.example.com/stripe-v2",
    reference: "vault://demo/stripe-v2",
  });
  assert.equal(
    next.integrations.find((i) => i.id === "stripe").status,
    "draft_prepared",
  );
  assert.equal(
    next.integrations.find((i) => i.id === "stripe").endpoint,
    "https://hooks.example.com/stripe-v2",
  );
  const workflow = run(s, {
    kind: "integration",
    id: "zapier",
    endpoint: "",
    reference: "consent-required",
  });
  assert.equal(
    workflow.integrations.find((i) => i.id === "zapier").status,
    "draft_prepared",
  );
});

test("billing requests never alter plan, entitlements, renewal or invoices", () => {
  const s = base();
  const upgrade = run(s, { kind: "billing", action: "upgrade_team" });
  assert.equal(upgrade.billing.request, "upgrade_team");
  assert.equal(upgrade.billing.plan, "Pro");
  assert.equal(upgrade.billing.price, 29);
  assert.equal(upgrade.billing.usage[1].limit, 2);
  assert.equal(upgrade.connections.length, 1);
  throws(
    () => run(upgrade, { kind: "billing", action: "upgrade_team" }),
    /already prepared/,
  );
  const cancel = run(upgrade, { kind: "billing", action: "cancel_at_renewal" });
  assert.equal(cancel.billing.request, "cancel_at_renewal");
  assert.equal(cancel.billing.renewsAt, s.billing.renewsAt);
  const cleared = run(cancel, { kind: "billing", action: "clear_request" });
  assert.equal(cleared.billing.request, "none");
  assert.equal(renewalDays(s), 23);
  const paid = run(s, { kind: "payment", brand: "Mastercard", last4: "1234" });
  assert.deepEqual(paid.billing.paymentDraft, {
    brand: "Mastercard",
    last4: "1234",
  });
  assert.deepEqual(paid.billing.payment, s.billing.payment);
  throws(() =>
    run(s, { kind: "payment", brand: "Visa", last4: "1234567890123456" }),
  );
});

test("invalid commands are atomic and structured-clone isolated", () => {
  const s = base(),
    before = JSON.stringify(s);
  for (const bad of [
    { kind: "unknown" },
    { kind: "profile" },
    { kind: "connection" },
    { kind: "revokeSession" },
    null,
  ])
    throws(() => run(s, bad));
  assert.equal(JSON.stringify(s), before);
  const next = run(s, { kind: "securityEvent", event: "password_preview" });
  assert.notEqual(JSON.stringify(next), before);
  next.security.sessions[0].state = "revoke_requested";
  assert.equal(s.security.sessions[0].state, "source_active");
});

test("password preview validation is demo-bound and strict", () => {
  assert.equal(
    passwordIssues("demo-current", "NewDemoPass!234", "NewDemoPass!234").length,
    0,
  );
  assert.match(
    passwordIssues("real-secret", "NewDemoPass!234", "NewDemoPass!234")[0],
    /demo-current/,
  );
  assert.match(passwordIssues("demo-current", "short", "short")[0], /12/);
  assert.match(
    passwordIssues("demo-current", "alllowercase123!", "alllowercase123!")[0],
    /upper/,
  );
  assert.match(
    passwordIssues("demo-current", "NewDemoPass!234", "Mismatch!23456")[0],
    /confirmation/,
  );
  assert.match(
    passwordIssues("demo-current", "demo-current", "demo-current")[0],
    /12|upper|symbol/,
  );
});

test("read API is strict read-only and preserves legacy routes", () => {
  const route = fs.readFileSync(
    "src/app/api/settings/workspace/route.ts",
    "utf8",
  );
  assert.match(route, /export function GET/);
  assert.doesNotMatch(
    route,
    /export (async )?(function|const) (POST|PUT|PATCH|DELETE)/,
  );
  assert.match(route, /no-store/);
  assert.match(route, /\.strict\(\)/);
  assert.match(route, /201|page|section/ === "x" ? /x/ : /section/);
  assert.ok(fs.existsSync("src/app/dashboard/settings/page.tsx"));
  assert.ok(fs.existsSync("src/styles/pages/dashboard-settings.css"));
  const css = fs.readFileSync(
    "src/styles/pages/dashboard-settings.css",
    "utf8",
  );
  assert.match(css, /\.page-dashboard-settings .st-profile-layout/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max-width:\s*767px/);
  assert.doesNotMatch(css, /--brand\b/);
  assert.match(
    fs.readFileSync("src/app/globals.css", "utf8"),
    /dashboard-settings\.css/,
  );
});

test("page wires fourteen-plus dialogs and three-stage wizards", () => {
  const src = fs.readFileSync(
    "src/components/dashboard/settings/settings-page.tsx",
    "utf8",
  );
  const kinds = [...src.matchAll(/^  \| "([a-zA-Z]+)"$/gm)].map((m) => m[1]);
  assert.ok(
    kinds.length >= 24,
    `expected 24+ dialog kinds, got ${kinds.length}`,
  );
  const wizardList = src.match(/const wizards: Kind\[\] = \[([\s\S]*?)\];/)[1];
  const wizards = [...wizardList.matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);
  assert.ok(wizards.length >= 12);
  for (const stage of ['"Prepare", "Review impact", "Acknowledge"'])
    assert.match(src, new RegExp(stage.replace(/"/g, '"')));
  for (const section of [
    "01 / OPERATOR PROFILE",
    "02 / DERIV CONNECTIONS",
    "03 / PLATFORM CONFIGURATION",
    "04 / SECURITY & ACCESS",
    "05 / NOTIFICATION CHANNELS",
    "06 / PERSONAL API ACCESS",
    "07 / BILLING & SUBSCRIPTION",
  ])
    assert.match(src, new RegExp(section.replace(/[&/]/g, ".")));
  assert.match(src, /never enter a full card number/i);
  assert.match(src, /no WebSocket ping/i);
});
