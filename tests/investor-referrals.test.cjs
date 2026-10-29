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

const lib = load("src/lib/investor/referrals.ts");
const service = load("src/server/services/investor-referrals-service.ts");
const { getWalletWorkspace } = load("src/server/services/investor-wallet-service.ts");
const { getInvestmentsWorkspace } = load("src/server/services/investor-investments-service.ts");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const workspace = service.getReferralWorkspace();
const component = read("src/components/investor/investor-referrals-page.tsx");
const css = read("src/styles/pages/investor-referrals.css");
const page = read("src/app/investor/referrals/page.tsx");
const api = read("src/app/api/investor/referrals/route.ts");
const claimRoute = read("src/app/api/rewards/[id]/claim/route.ts");
const dailyRoute = read("src/app/api/referrals/claim-daily/route.ts");
const hook = read("src/lib/investor/use-referrals.ts");
const shell = read("src/components/investor/investor-shell.tsx");

/* ── Snapshot ── */

test("I-10 pins the snapshot to a Sunday morning", () => {
  assert.equal(lib.REFERRALS_AS_OF, "2026-10-25T09:20:00Z");
  assert.equal(workspace.asOf, lib.REFERRALS_AS_OF);
  assert.equal(new Date(workspace.asOf).getUTCDay(), 0);
  assert.equal(workspace.mode, "demo");
  assert.equal(workspace.revision, 0);
});

test("the programme carries the spec code, link and cap", () => {
  assert.equal(workspace.program.code, "JANE-X9F2");
  assert.equal(workspace.program.link, "https://app.derivx.com/r/JANE-X9F2");
  assert.equal(workspace.program.maxPerReferral, 90);
  assert.equal(workspace.program.cookieDays, 30);
  assert.deepEqual(
    workspace.program.levels.map((row) => [row.key, row.amount]),
    [
      ["signup", 5],
      ["deposit", 10],
      ["investment", 25],
      ["retention", 50],
    ],
  );
  assert.equal(
    workspace.program.levels.reduce((sum, row) => sum + row.amount, 0),
    workspace.program.maxPerReferral,
  );
});

test("the referee roster matches the spec counts and earned total", () => {
  assert.equal(workspace.stats.total, 8);
  assert.equal(workspace.stats.qualified, 5);
  assert.equal(workspace.stats.pending, 2);
  assert.equal(workspace.stats.lapsed, 1);
  assert.equal(workspace.stats.earned, 215);
  assert.equal(workspace.invites.length, 8);
  assert.equal(
    workspace.invites.reduce((sum, row) => sum + row.earned, 0),
    workspace.stats.earned,
  );
  // No referee can beat the cap, and no pending referee holds a credit.
  for (const row of workspace.invites) {
    assert.ok(row.earned <= 90, `${row.alias} exceeds the cap`);
    if (row.status === "pending") assert.equal(row.earned, 0);
  }
});

test("referee aliases are masked, never full addresses", () => {
  for (const row of workspace.invites) {
    assert.match(row.emailMasked, /•/, `${row.alias} is not masked`);
    assert.ok(!row.emailMasked.includes("@") || row.emailMasked.includes("•"));
  }
});

test("the streak holds the spec counters and a full Mon–Sun week", () => {
  assert.equal(workspace.streak.current, 12);
  assert.equal(workspace.streak.best, 18);
  assert.equal(workspace.streak.bonusPerDay, 2);
  assert.equal(workspace.streak.bonusActive, true);
  assert.equal(workspace.streak.todayClaimed, false);
  assert.equal(workspace.streak.days.length, 7);
  assert.deepEqual(
    workspace.streak.days.map((row) => row.label),
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  );
  assert.equal(workspace.streak.days[6].state, "today");
  assert.ok(workspace.streak.days.slice(0, 6).every((row) => row.state === "done"));
  assert.deepEqual(
    workspace.streak.tiers.map((row) => [row.days, row.amount]),
    [
      [7, 10],
      [14, 25],
      [30, 100],
    ],
  );
  assert.equal(new Date(workspace.streak.runStartedAt).getUTCDay(), 3);
});

test("exactly $125 is claimable — the birthday credit opens later today", () => {
  const claimable = lib.claimableRewards(workspace.rewards, workspace.asOf);
  assert.equal(claimable.length, 3);
  assert.equal(
    claimable.reduce((sum, row) => sum + row.amount, 0),
    125,
  );
  const birthday = workspace.rewards.find((row) => row.kind === "birthday");
  assert.equal(birthday.amount, 20);
  assert.ok(birthday.availableFrom > workspace.asOf);
  assert.equal(lib.rewardTotals(workspace.rewards).available, 145);
});

test("every reward card explains how it is earned", () => {
  assert.equal(workspace.rewards.length, 4);
  for (const row of workspace.rewards) {
    assert.ok(row.requires.length > 8, `${row.id} has no requirement`);
    assert.ok(row.hint.length > 10, `${row.id} has no hint`);
    assert.ok(row.target >= row.progress);
    assert.ok(row.detail.length > 20);
  }
});

test("the leaderboard is the spec board with you at rank 12", () => {
  assert.deepEqual(
    workspace.leaderboard.slice(0, 3).map((row) => [row.alias, row.referrals, row.earned]),
    [
      ["user_8f2a", 18, 1620],
      ["user_b3c1", 12, 1080],
      ["user_d4e2", 10, 900],
    ],
  );
  const you = workspace.leaderboard.find((row) => row.you);
  assert.equal(you.rank, 12);
  assert.equal(you.referrals, 5);
  assert.equal(you.earned, 215);
  const view = lib.leaderboardView(workspace.leaderboard);
  assert.equal(view.inTopTen, false);
  assert.equal(view.you.rank, 12);
  assert.equal(view.rows.length, 12);
  // Ranks run 1..12 without holes.
  assert.deepEqual(
    view.rows.map((row) => row.rank),
    Array.from({ length: 12 }, (_, index) => index + 1),
  );
  // Ranks 4+ are masked.
  for (const row of view.rows.filter((item) => item.rank > 3 && !item.you)) {
    assert.match(row.alias, /•/);
  }
});

test("the reward history is the four spec lines, newest first", () => {
  assert.deepEqual(
    workspace.history.map((row) => [row.at.slice(0, 10), row.amount]),
    [
      ["2026-10-10", 25],
      ["2026-09-25", 25],
      ["2026-09-15", 100],
      ["2026-09-12", 5],
    ],
  );
  assert.ok(workspace.history.every((row) => row.claimed));
  assert.equal(lib.historyTotals(workspace.history).claimed, 155);
});

test("cross-page anchors are the real ones", () => {
  const wallet = getWalletWorkspace();
  const investments = getInvestmentsWorkspace();
  assert.equal(workspace.profile.wallet, wallet.balance.available);
  assert.equal(workspace.profile.committed, investments.profile.committed);
  assert.equal(workspace.profile.displayName, investments.profile.displayName);
  assert.equal(workspace.profile.country, investments.profile.country);
  assert.ok(workspace.credits.some((row) => row.reference === "PO-2026-10-17-0052"));
  const payout = workspace.credits.find((row) => row.reference === "PO-2026-10-17-0052");
  assert.equal(payout.amount, wallet.balance.pendingPayoutNet);
});

/* ── Derived views ── */

test("the funnel, goal and streak progress are internally consistent", () => {
  const funnel = lib.inviteFunnel(workspace.invites);
  assert.equal(funnel[0].count, 8);
  assert.ok(funnel[funnel.length - 1].count <= funnel[0].count);
  const goal = lib.goalProgress(workspace.goal, workspace.stats);
  assert.equal(goal.current, 5);
  assert.equal(goal.target, 10);
  assert.equal(goal.met, false);
  assert.equal(goal.remaining, 5);
  const progress = lib.streakProgress(workspace.streak);
  assert.equal(progress.nextTier.days, 14);
  assert.equal(progress.daysToNext, 2);
  assert.equal(progress.weeklyDone, 6);
  assert.equal(progress.claimable, 2);
});

test("section slices line up with the spec query keys", () => {
  const code = lib.referralSection(workspace, "code-and-stats");
  assert.equal(code.program.code, "JANE-X9F2");
  assert.equal(code.stats.total, 8);
  assert.equal(code.invites.length, 8);

  const streak = lib.referralSection(workspace, "streak");
  assert.equal(streak.streak.current, 12);

  const rewards = lib.referralSection(workspace, "available-rewards");
  assert.equal(rewards.claimableTotal, 125);

  const board = lib.referralSection(workspace, "leaderboard", { period: "month" });
  assert.equal(board.period, "month");
  assert.equal(board.you.rank, 12);

  const history = lib.referralSection(workspace, "history", { page: 1 });
  assert.equal(history.rows.length, 4);
  assert.equal(history.pages, 1);
});

test("query keys are the spec keys", () => {
  assert.deepEqual(lib.referralKey("code-and-stats"), ["referrals", "code-and-stats"]);
  assert.deepEqual(lib.referralKey("streak"), ["referrals", "streak"]);
  assert.deepEqual(lib.referralKey("available-rewards"), ["referrals", "available-rewards"]);
  assert.deepEqual(lib.referralKey("leaderboard", { period: "month" }), [
    "referrals",
    "leaderboard",
    { period: "month" },
  ]);
  assert.deepEqual(lib.referralKey("history", { page: 2 }), [
    "referrals",
    "history",
    { page: 2 },
  ]);
  assert.match(hook, /REFERRALS_STREAK_REFETCH_MS = 60_000/);
});

test("draft validators reject the obvious mistakes", () => {
  assert.match(lib.claimDraftError(null, workspace.asOf), /Pick a reward/);
  const birthday = workspace.rewards.find((row) => row.kind === "birthday");
  assert.match(lib.claimDraftError(birthday, workspace.asOf), /unlocks on 25 Oct/);
  const claimed = { ...workspace.rewards[0], status: "claimed" };
  assert.match(lib.claimDraftError(claimed, workspace.asOf), /already been claimed/);

  assert.equal(lib.streakClaimError(workspace.streak, workspace.asOf), "");
  assert.match(
    lib.streakClaimError({ ...workspace.streak, todayClaimed: true }, workspace.asOf),
    /already claimed/,
  );
  assert.match(
    lib.streakClaimError({ ...workspace.streak, bonusActive: false }, workspace.asOf),
    /seven consecutive days/,
  );

  assert.match(
    lib.inviteDraftError({ emails: [], note: "", ownEmail: "a@b.co" }),
    /at least one email/,
  );
  assert.match(
    lib.inviteDraftError({ emails: ["nope"], note: "", ownEmail: "a@b.co" }),
    /not a valid email/,
  );
  assert.match(
    lib.inviteDraftError({ emails: ["a@b.co"], note: "", ownEmail: "a@b.co" }),
    /your own account/,
  );
  assert.equal(
    lib.inviteDraftError({ emails: ["x@y.co"], note: "hi", ownEmail: "a@b.co" }),
    "",
  );

  assert.match(lib.goalDraftError({ target: 0, deadline: "2026-12-31" }), /at least 1/);
  assert.match(lib.goalDraftError({ target: 99, deadline: "2026-12-31" }), /above 50/);
  assert.match(lib.goalDraftError({ target: 4, deadline: "" }), /Pick a deadline/);

  assert.match(
    lib.preferencesDraftError({
      preferences: { ...workspace.preferences, milestoneAlerts: false, weeklySummary: false },
      asOf: workspace.asOf,
    }),
    /at least one alert/,
  );
  assert.match(
    lib.preferencesDraftError({
      preferences: {
        ...workspace.preferences,
        payoutDestination: "bonus_credit",
        autoClaim: true,
      },
      asOf: workspace.asOf,
    }),
    /Auto-claim needs the wallet/,
  );
});

/* ── Commands ── */

const fresh = () => service.resetReferralWorkspace();

test("claiming a reward writes a credit and a statement row", () => {
  const start = fresh();
  const next = lib.applyReferralCommand(start, { kind: "claimReward", id: "rw_ref_090" });
  const reward = next.rewards.find((row) => row.id === "rw_ref_090");
  assert.equal(reward.status, "claimed");
  assert.equal(next.credits[0].amount, 90);
  assert.equal(next.credits[0].status, "queued");
  assert.equal(next.history[0].amount, 90);
  assert.equal(next.history.length, start.history.length + 1);
  assert.equal(next.revision, 1);
  assert.ok(next.audit.some((row) => row.action === "reward_claimed"));
  // And it is no longer claimable.
  assert.ok(!lib.claimableRewards(next.rewards, next.asOf).some((row) => row.id === reward.id));
});

test("a claimed reward cannot be claimed twice", () => {
  const start = fresh();
  const once = lib.applyReferralCommand(start, { kind: "claimReward", id: "rw_streak_14" });
  assert.throws(
    () => lib.applyReferralCommand(once, { kind: "claimReward", id: "rw_streak_14" }),
    /already been claimed/,
  );
  // The locked birthday card is rejected with a real date.
  assert.throws(
    () => lib.applyReferralCommand(once, { kind: "claimReward", id: "rw_bday_025" }),
    /unlocks on 25 Oct/,
  );
});

test("claim all clears the queue but leaves the birthday card", () => {
  const next = lib.applyReferralCommand(fresh(), { kind: "claimAll" });
  assert.equal(lib.claimableRewards(next.rewards, next.asOf).length, 0);
  const birthday = next.rewards.find((row) => row.kind === "birthday");
  assert.equal(birthday.status, "available");
  assert.equal(
    next.credits.filter((row) => row.at === next.asOf).reduce((sum, row) => sum + row.amount, 0),
    125,
  );
  assert.throws(
    () => lib.applyReferralCommand(next, { kind: "claimAll" }),
    /Nothing is claimable/,
  );
});

test("the daily bonus pays once a day", () => {
  const next = lib.applyReferralCommand(fresh(), { kind: "claimDaily" });
  assert.equal(next.streak.todayClaimed, true);
  assert.equal(next.streak.dailyClaimedAt, next.asOf);
  assert.equal(next.credits[0].amount, 2);
  assert.equal(next.streak.bonusPerDay, 2);
  assert.throws(() => lib.applyReferralCommand(next, { kind: "claimDaily" }), /already claimed/);
});

test("freezes are spendable exactly once", () => {
  const next = lib.applyReferralCommand(fresh(), { kind: "useFreeze" });
  assert.equal(next.streak.freezes, 0);
  assert.ok(next.streak.frozenUntil > next.asOf);
  assert.throws(() => lib.applyReferralCommand(next, { kind: "useFreeze" }), /No streak freezes/);
});

test("shares, invites and revokes behave", () => {
  const shared = lib.applyReferralCommand(fresh(), {
    kind: "share",
    channel: "whatsapp",
    target: "L. Achieng",
  });
  assert.equal(shared.shares[0].channel, "whatsapp");
  assert.equal(shared.shares[0].target, "L. Achieng");

  const invited = lib.applyReferralCommand(shared, {
    kind: "sendInvites",
    emails: ["new@example.com"],
    note: "hi",
  });
  assert.equal(invited.sent.length, shared.sent.length + 1);
  assert.equal(invited.sent[0].email, "new@example.com");
  assert.throws(
    () =>
      lib.applyReferralCommand(invited, {
        kind: "sendInvites",
        emails: ["new@example.com"],
        note: "",
      }),
    /already have an open invite/,
  );

  const revoked = lib.applyReferralCommand(invited, {
    kind: "revokeInvite",
    id: invited.sent[0].id,
  });
  assert.equal(revoked.sent.length, invited.sent.length - 1);
  assert.throws(
    () => lib.applyReferralCommand(revoked, { kind: "revokeInvite", id: invited.sent[0].id }),
    /already gone/,
  );
});

test("preferences are validated before they are saved", () => {
  const next = lib.applyReferralCommand(fresh(), {
    kind: "savePreferences",
    milestoneAlerts: true,
    weeklySummary: false,
    autoClaim: true,
    marketing: false,
    leaderboardVisible: false,
    freezeAutoUse: false,
    payoutDestination: "wallet",
    shareDefault: "telegram",
  });
  assert.equal(next.preferences.autoClaim, true);
  assert.equal(next.preferences.shareDefault, "telegram");
  assert.throws(
    () =>
      lib.applyReferralCommand(next, {
        kind: "savePreferences",
        milestoneAlerts: false,
        weeklySummary: false,
        autoClaim: false,
        marketing: false,
        leaderboardVisible: true,
        freezeAutoUse: true,
        payoutDestination: "wallet",
        shareDefault: "copy",
      }),
    /at least one alert/,
  );
});

test("campaigns, goals, exports, support and reset all write audit rows", () => {
  const joined = lib.applyReferralCommand(fresh(), {
    kind: "joinCampaign",
    id: "cmp_oct_double",
  });
  assert.equal(joined.campaigns.find((row) => row.id === "cmp_oct_double").joined, true);
  assert.throws(
    () => lib.applyReferralCommand(joined, { kind: "joinCampaign", id: "cmp_oct_double" }),
    /already joined/,
  );
  assert.throws(
    () => lib.applyReferralCommand(joined, { kind: "joinCampaign", id: "cmp_sep_sprint" }),
    /has ended/,
  );

  const goal = lib.applyReferralCommand(joined, {
    kind: "setGoal",
    target: 20,
    deadline: "2027-03-31",
  });
  assert.equal(goal.goal.target, 20);
  assert.equal(goal.goal.deadline, "2027-03-31");

  const exported = lib.applyReferralCommand(goal, {
    kind: "exportReport",
    scope: "history",
    format: "csv",
    count: 4,
  });
  assert.equal(exported.exports[0].scope, "history");
  assert.equal(exported.exports[0].format, "csv");

  const supported = lib.applyReferralCommand(exported, {
    kind: "support",
    topic: "reward",
    message: "The 14-day tier never appeared in the queue.",
  });
  assert.equal(supported.support[0].topic, "reward");
  assert.equal(supported.support[0].status, "local_draft");

  assert.ok(supported.audit.some((row) => row.action === "campaign_joined"));
  assert.ok(supported.audit.some((row) => row.action === "goal_updated"));
  assert.ok(supported.audit.some((row) => row.action === "export_generated"));
  assert.ok(supported.audit.some((row) => row.action === "support_drafted"));
});

test("reset returns the desk to the seeded snapshot", () => {
  const messy = lib.applyReferralCommand(fresh(), { kind: "claimAll" });
  const reset = lib.applyReferralCommand(messy, { kind: "resetRewards" });
  assert.equal(reset.revision, 0);
  assert.ok(reset.rewards.every((row) => row.status === "available"));
  assert.equal(reset.audit.length, 0);
  assert.equal(reset.sent.length, 0);
  assert.equal(lib.claimableRewards(reset.rewards, reset.asOf).length, 3);
});

test("unknown commands are rejected by the schema", () => {
  assert.throws(() => lib.referralCommandSchema.parse({ kind: "explode" }));
  assert.throws(() =>
    lib.referralCommandSchema.parse({ kind: "claimReward", id: "" }),
  );
});

/* ── Exports ── */

test("each export scope produces a titled matrix with the right header", () => {
  const invites = lib.exportMatrix(workspace, "invites");
  assert.equal(invites.rows.length, 8);
  assert.equal(invites.header[0], "Joined");
  assert.equal(lib.exportMatrix(workspace, "rewards").rows.length, 4);
  assert.equal(lib.exportMatrix(workspace, "leaderboard").rows.length, 12);
  assert.equal(lib.exportMatrix(workspace, "history").rows.length, 4);
  assert.equal(lib.exportMatrix(workspace, "credits").rows.length, 3);
  const csv = lib.csvOf(invites);
  assert.equal(csv.split("\n").length, 9);
  assert.ok(csv.startsWith("Joined,Referee,Stage,Status,Earned,Pool"));
});

test("the credits statement ties back to the wallet payout", () => {
  const totals = lib.creditTotals(workspace.credits);
  assert.equal(totals.count, 3);
  assert.ok(totals.posted > 0);
  assert.equal(totals.queued, 0);
});

/* ── Routes, hook and page wiring ── */

test("the API exposes every section and a command handler", () => {
  for (const section of ["workspace", "code-and-stats", "streak", "available-rewards", "leaderboard", "history"]) {
    assert.ok(lib.REFERRAL_SECTIONS.includes(section), `missing section ${section}`);
  }
  assert.match(api, /REFERRAL_SECTIONS as \[/);
  assert.match(api, /section: z\.enum/);
  assert.match(api, /export function GET/);
  assert.match(api, /export async function POST/);
  assert.match(api, /referralCommandSchema\.safeParse/);
  assert.match(api, /Cache-Control/);
  assert.match(claimRoute, /claimDraftError/);
  assert.match(claimRoute, /applyReferralMutation/);
  assert.match(dailyRoute, /streakClaimError/);
});

test("the hook speaks the spec mutations", () => {
  assert.match(hook, /useClaimReward|\/api\/rewards\//);
  assert.match(hook, /claim-daily|claimDailyBonus/);
  assert.match(hook, /referralsWorkspaceKey = \(\) => \["referrals", "workspace"\]/);
  assert.match(hook, /referralKey\("code-and-stats"\)/);
  assert.match(hook, /referralKey\("streak"\)/);
});

test("the page renders five spec sections and the shell", () => {
  for (const id of ["rf-program", "rf-streak", "rf-rewards", "rf-board", "rf-history"]) {
    assert.match(component, new RegExp(`id="${id}"`), `missing section ${id}`);
  }
  assert.match(component, /rootClass="page-investor-referrals"/);
  assert.match(component, /<InvestorShell/);
  assert.match(component, /useReferrals\(initial\)/);
  assert.match(page, /getReferralWorkspace/);
  assert.match(page, /initialAction=\{action\}/);
});

test("the page has 15+ dialogs, 7 wizards, a drawer and a four-action dock", () => {
  const kinds = [...component.matchAll(/^  \| "([a-zA-Z]+)"/gm)].map((m) => m[1]);
  assert.ok(kinds.length >= 24, `only ${kinds.length} dialog kinds`);
  const wizards = [...component.matchAll(/^  (\w+Wizard): \[/gm)].map((m) => m[1]);
  assert.equal(wizards.length, 7, `expected 7 wizards, found ${wizards.length}`);
  for (const wizard of wizards) {
    assert.match(component, new RegExp(`"${wizard}"`), `${wizard} is not reachable`);
  }
  assert.match(component, /rf-drawer-layer/);
  assert.match(component, /rf-drawer__tabs/);
  assert.ok(quickActionsOf(component).length >= 4);
});

function quickActionsOf(source) {
  const block = source.slice(
    source.indexOf("const quickActions"),
    source.indexOf("const sections = ["),
  );
  return [...block.matchAll(/key: "([a-z]+)"/g)].map((m) => m[1]);
}

test("every quick action opens something", () => {
  const actions = quickActionsOf(component);
  assert.ok(actions.length >= 4);
  for (const action of actions) {
    assert.match(
      component,
      new RegExp(`if \\(key === "${action}"\\)`),
      `${action} has no handler`,
    );
  }
});

test("every ?action= key maps to a dialog kind", () => {
  const map = component.slice(component.indexOf("const actionMap"), component.indexOf("const [modal"));
  const entries = [...map.matchAll(/^\s+([a-z]+): "(\w+)",/gm)];
  assert.ok(entries.length >= 20, `only ${entries.length} deep links`);
  const kinds = new Set([...component.matchAll(/^  \| "(\w+)"/gm)].map((m) => m[1]));
  for (const [, key, kind] of entries) {
    assert.ok(kinds.has(kind), `?action=${key} points at unknown kind ${kind}`);
  }
});

test("the stylesheet is scoped and gradient-free", () => {
  assert.match(css, /\.page-investor-referrals \{/);
  assert.ok(!/linear-gradient|radial-gradient/.test(css));
  assert.match(css, /page-investor-referrals \.rf-code:hover/);
  assert.match(css, /@keyframes rf-fade-step/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /data-bs-theme="dark"/);
  for (const width of ["1279px", "991px", "767px", "575px"]) {
    assert.match(css, new RegExp(`max-width: ${width}`), `missing ${width} breakpoint`);
  }
});

test("the investor shell exposes the referrals page as a nav entry", () => {
  assert.match(shell, /href: "\/investor\/referrals"/);
  assert.match(shell, /code: "I-10"/);
  assert.match(shell, /\| "referrals"/);
});
