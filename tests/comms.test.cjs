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
const { getCommsBundle } = load("src/server/services/comms-service.ts");
const {
  applyCommsCommand: apply,
  audiencePlan,
  analytics,
  campaignStats,
  assertCommsInvariant,
  personalize,
  safeHref,
  contentIssues,
} = load("src/lib/comms/model.ts");
const seed = getCommsBundle(),
  now = "2026-10-23T10:00:00Z";
const content = (patch = {}) => ({
  subject: "Account review for {name}",
  body: "Hi {name}, recorded capital {investment}; earnings {earnings}; wallet {wallet}; ROI {roi}; package {package}; start {packageStartDate}.",
  audience: { type: "all", ids: [], packages: [] },
  channels: ["in_app", "email"],
  templateId: "tpl_1",
  saveTemplate: false,
  templateName: "",
  ...patch,
});
const compose = (patch = {}, mode = "queue", extras = {}) => ({
  kind: "compose",
  content: content(patch),
  mode,
  campaignType: "message",
  scheduledFor: null,
  draftId: null,
  ...extras,
});
const run = (s, c) => apply(s, c, now);
test("D10 seed has full typed roster, eight editable templates and internally valid evidence", () => {
  assert.equal(seed.contacts.length, 38);
  assert.equal(seed.templates.length, 8);
  assert.equal(seed.threads.length, 16);
  assertCommsInvariant(seed);
  assert.equal(analytics(seed).attempts, 456);
  assert.equal(
    seed.deliveries.filter(
      (d) => d.channel === "telegram" || d.channel === "sms",
    ).length,
    0,
  );
});
test("queue eligibility deduplicates multi-package recipients and channel overlap", () => {
  const p = audiencePlan(
    seed,
    content({
      audience: { type: "packages", ids: [], packages: ["PKG-01", "PKG-02"] },
      channels: ["in_app", "in_app", "email"],
    }),
  );
  assert.equal(
    new Set(p.rows.map((r) => r.contactId + ":" + r.channel)).size,
    p.rows.length,
  );
  assert.ok(
    p.rows.every(
      (r) =>
        !["suspended", "inactive"].includes(
          seed.contacts.find((c) => c.id === r.contactId).status,
        ),
    ),
  );
  assert.ok(
    p.rows
      .filter((r) => r.channel === "email")
      .every(
        (r) => seed.contacts.find((c) => c.id === r.contactId).consent.email,
      ),
  );
  assert.ok(p.excluded.length);
});
test("draft is unsent, editing preserves identity, cancellation retains evidence", () => {
  let s = run(seed, compose({}, "draft"));
  const id = s.campaigns[0].id;
  assert.equal(s.deliveries.length, seed.deliveries.length);
  s = run(
    s,
    compose({ subject: "Revised saved draft" }, "draft", { draftId: id }),
  );
  assert.equal(s.campaigns.filter((c) => c.id === id).length, 1);
  assert.equal(s.campaigns[0].subject, "Revised saved draft");
  s = run(s, { kind: "cancel", id });
  assert.equal(s.campaigns[0].status, "cancelled");
  assert.equal(s.audit[0].action, "cancel");
  assert.throws(
    () => run(s, compose({}, "draft", { draftId: id })),
    /Only a draft/,
  );
});
test("queued messages have no fake delivery or engagement; snapshot version is recorded", () => {
  const s = run(seed, compose());
  const c = s.campaigns[0],
    rows = s.deliveries.filter((d) => d.campaignId === c.id);
  assert.equal(c.templateVersion, 1);
  assert.ok(rows.length > 0);
  assert.ok(
    rows.every(
      (d) => d.status === "queued_demo" && !d.openedAt && !d.deliveredAt,
    ),
  );
  assert.equal(analytics(s).delivered, analytics(seed).delivered);
  assert.equal(analytics(s).queued, rows.length);
  assert.deepEqual(seed, getCommsBundle());
});
test("save-template plus queue is atomic, and name collision rolls everything back", () => {
  const original = JSON.stringify(seed);
  assert.throws(
    () =>
      run(
        seed,
        compose({ saveTemplate: true, templateName: seed.templates[0].name }),
      ),
    /already exists/,
  );
  assert.equal(JSON.stringify(seed), original);
  const s = run(
    seed,
    compose({ saveTemplate: true, templateName: "Atomic custom update" }),
  );
  assert.equal(s.templates.length, 9);
  assert.equal(s.campaigns[0].templateId, s.templates.at(-1).id);
});
test("reject unknown template, investor, package, tokens, unsafe links and long rendered subjects", () => {
  for (const p of [
    { templateId: "missing" },
    { audience: { type: "individual", ids: ["missing"], packages: [] } },
    { audience: { type: "packages", ids: [], packages: ["PKG-99"] } },
    { subject: "Hello {nickname}" },
    { body: "Open [my account](javascript:alert)" },
    { subject: "x".repeat(115) + "{name}" },
  ])
    assert.throws(() => run(seed, compose(p)));
  assert.ok(contentIssues("{broken", "Message content").length);
  assert.ok(contentIssues("{unknown}", "Message content").length);
  assert.equal(safeHref("javascript:alert(1)"), false);
  assert.equal(safeHref("//evil.test"), false);
  assert.equal(safeHref("/dashboard/not-a-page"), false);
  assert.equal(safeHref("https://user:password@example.test"), false);
  assert.equal(safeHref("/dashboard/investors?tab=all"), true);
  assert.equal(safeHref("https://example.test/account"), true);
});
test("no-investment contacts render explicit zero financial context and N/A ROI", () => {
  const c = seed.contacts.find((c) => !c.investment);
  assert.ok(c);
  const result = personalize("Review {name}", content().body, c);
  assert.match(result.body, /ROI N\/A/);
  assert.match(result.body, /No active package/);
  assert.match(result.body, /Not scheduled/);
  assert.match(result.body, /\$0\.00/);
});
test("package start variable resolves the selected holding, not a different primary package", () => {
  const c = structuredClone(seed.contacts[0]);
  c.packages = ["PKG-01", "PKG-02"];
  c.packageStartDates = { "PKG-01": "2026-09-01", "PKG-02": "2026-10-01" };
  const result = personalize(
    "Review {package}",
    "Starts {packageStartDate}",
    c,
    { type: "packages", ids: [], packages: ["PKG-02"] },
  );
  assert.equal(result.subject, "Review PKG-02");
  assert.equal(result.body, "Starts 2026-10-01");
});
test("template edits do not rewrite queued campaign snapshots", () => {
  let s = run(seed, compose());
  const old = s.campaigns[0].body;
  s = run(s, {
    kind: "template",
    id: "tpl_1",
    name: seed.templates[0].name,
    subject: "Changed welcome subject",
    body: "Changed template content for {name}.",
    category: "Onboarding",
  });
  assert.equal(s.templates[0].version, 2);
  assert.equal(s.campaigns[0].body, old);
  assert.equal(s.campaigns[0].templateVersion, 1);
});
test("template duplicate is independent and test artifacts never count as deliveries", () => {
  let s = run(seed, {
    kind: "duplicate",
    id: "tpl_1",
    name: "Independent welcome",
  });
  assert.equal(s.templates.at(-1).version, 1);
  s = run(s, {
    kind: "test",
    templateId: "tpl_1",
    contactId: seed.contacts[0].id,
    target: "operator@example.test",
  });
  assert.equal(s.tests[0].state, "rendered_only");
  assert.equal(s.deliveries.length, seed.deliveries.length);
  assert.deepEqual(analytics(s).byChannel, analytics(seed).byChannel);
  assert.equal(analytics(s).attempts, analytics(seed).attempts);
  assert.throws(() =>
    run(s, {
      kind: "test",
      templateId: "tpl_1",
      contactId: seed.contacts[0].id,
      target: "not-an-email",
    }),
  );
});
test("reply marks operator state and queues in-app rows without fabricating investor engagement", () => {
  const t = seed.threads.find((t) => t.status !== "archived");
  const s = run(seed, {
    kind: "reply",
    id: t.id,
    body: "We will review the current settlement ledger and contact you.",
  });
  assert.equal(s.threads.find((x) => x.id === t.id).status, "replied");
  assert.equal(
    s.threads.find((x) => x.id === t.id).posts.at(-1).state,
    "queued_demo",
  );
  assert.equal(analytics(s).replies, analytics(seed).replies);
  assert.equal(s.campaigns[0].channels[0], "in_app");
  assert.throws(
    () =>
      run(seed, {
        kind: "reply",
        id: seed.threads.find((t) => t.status === "archived").id,
        body: "Please review the full settlement context.",
      }),
    /Restore/,
  );
});
test("archive/read/unread/restore are explicit flags retaining immutable message content", () => {
  const t = seed.threads[0];
  let s = run(seed, { kind: "threadState", id: t.id, action: "archive" });
  const posts = JSON.stringify(s.threads[0].posts);
  s = run(s, { kind: "threadState", id: t.id, action: "read" });
  assert.equal(s.threads[0].status, "archived");
  s = run(s, { kind: "threadState", id: t.id, action: "restore" });
  assert.equal(s.threads[0].status, "read");
  s = run(s, { kind: "threadState", id: t.id, action: "unread" });
  assert.equal(s.threads[0].status, "unread");
  assert.equal(JSON.stringify(s.threads[0].posts), posts);
});
test("schedule requires a future bounded time; due dispatch rechecks actual consent", () => {
  assert.throws(
    () =>
      run(
        seed,
        compose({}, "schedule", { scheduledFor: "2026-10-23T09:00:00Z" }),
      ),
    /future UTC/,
  );
  assert.throws(
    () =>
      run(
        seed,
        compose({}, "schedule", { scheduledFor: "2028-10-23T09:00:00Z" }),
      ),
    /future UTC/,
  );
  let s = run(
    seed,
    compose({}, "schedule", { scheduledFor: "2026-10-24T09:00:00Z" }),
  );
  assert.equal(s.campaigns[0].status, "scheduled");
  assert.equal(s.deliveries.length, seed.deliveries.length);
  assert.throws(
    () => run(s, { kind: "dispatch", id: s.campaigns[0].id }),
    /due scheduled/,
  );
  const due = s.campaigns.find(
    (c) => c.status === "scheduled" && c.scheduledFor < now,
  );
  s = run(s, { kind: "dispatch", id: due.id });
  assert.equal(s.campaigns.find((c) => c.id === due.id).status, "queued");
  assert.throws(
    () => run(s, { kind: "dispatch", id: due.id }),
    /due scheduled/,
  );
});
test("simulator revalidates consent at delivery and failed-only retries increment same row", () => {
  let s = run(seed, compose());
  const id = s.campaigns[0].id;
  const row = s.deliveries.find(
      (d) => d.campaignId === id && d.channel === "email",
    ),
    c = s.contacts.find((c) => c.id === row.contactId);
  s = run(s, {
    kind: "preferences",
    id: c.id,
    consent: { ...c.consent, email: false },
  });
  s = run(s, { kind: "simulate", id, outcome: "deliver" });
  assert.equal(
    s.deliveries.find((d) => d.id === row.id).failure,
    "eligibility_changed",
  );
  const before = JSON.stringify(s);
  assert.throws(() => run(s, { kind: "retry", id }), /blocked/);
  assert.equal(JSON.stringify(s), before);
  s = run(s, {
    kind: "preferences",
    id: c.id,
    consent: { ...c.consent, email: true },
  });
  const count = s.deliveries.length;
  s = run(s, { kind: "retry", id });
  assert.equal(s.deliveries.length, count);
  assert.equal(s.deliveries.find((d) => d.id === row.id).attempts, 2);
  assert.equal(s.deliveries.find((d) => d.id === row.id).status, "queued_demo");
});
test("simulated engagement requires delivered rows, clicks require opens, operator replies are excluded", () => {
  let s = run(seed, compose());
  const id = s.campaigns[0].id;
  assert.throws(
    () => run(s, { kind: "simulate", id, outcome: "engage" }),
    /Deliver/,
  );
  s = run(s, { kind: "simulate", id, outcome: "deliver" });
  s = run(s, { kind: "simulate", id, outcome: "engage" });
  assertCommsInvariant(s);
  assert.ok(
    s.deliveries
      .filter((d) => d.campaignId === id && d.clickedAt)
      .every((d) => d.openedAt && d.deliveredAt),
  );
});
test("unread follow-up excludes cross-channel openers, deduplicates and blocks repeated resend", () => {
  const parent = seed.campaigns.find(
    (c) =>
      c.type === "announcement" && campaignStats(seed, c.id).unreadIds.length,
  );
  const unread = campaignStats(seed, parent.id).unreadIds;
  const s = run(seed, { kind: "resend", id: parent.id });
  const follow = s.campaigns[0];
  assert.equal(follow.parentId, parent.id);
  assert.ok(follow.contactIds.every((id) => unread.includes(id)));
  assert.equal(new Set(follow.contactIds).size, follow.contactIds.length);
  assert.throws(
    () => run(s, { kind: "resend", id: parent.id }),
    /already exists/,
  );
});
test("analytics windows and denominators derive from rows and N/A is not zero", () => {
  const m = analytics(seed),
    delivered = seed.deliveries.filter((d) => d.status === "delivered");
  assert.equal(
    m.openRate,
    (delivered.filter((d) => d.openedAt).length / delivered.length) * 100,
  );
  assert.ok(analytics(seed, 7).attempts < analytics(seed, 30).attempts);
  assert.equal(analytics(seed, 90).attempts, m.attempts);
  assert.equal(m.byChannel.find((c) => c.channel === "sms").openRate, null);
  const blank = structuredClone(seed);
  blank.deliveries = [];
  assert.equal(analytics(blank).openRate, null);
});
test("adapter controls cannot bypass account eligibility or consent", () => {
  let s = run(seed, {
    kind: "channels",
    enabled: { in_app: false, email: false, telegram: true, sms: true },
  });
  const p = audiencePlan(s, content({ channels: ["telegram", "sms"] }));
  assert.ok(p.rows.length > 0);
  assert.ok(
    p.rows.every(
      (r) => s.contacts.find((c) => c.id === r.contactId).consent[r.channel],
    ),
  );
  assert.throws(() => run(s, compose()), /No eligible/);
  assert.equal(s.channelConfig.email.enabled, false);
});
test("unknown command and duplicate delivery tampering are rejected without mutating source", () => {
  assert.throws(() => run(seed, { kind: "deleteEverything" }));
  const bad = structuredClone(seed);
  bad.deliveries.push({ ...bad.deliveries[0] });
  assert.throws(() => assertCommsInvariant(bad), /Duplicate/);
  assert.equal(seed.revision, 0);
});
