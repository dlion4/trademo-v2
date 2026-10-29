/**
 * I-10 · Referrals & Rewards — the demo contract.
 *
 * Everything the page renders is described here: the programme (code, link,
 * the four-step reward ladder), the eight invited referees and their milestone
 * timelines, the daily streak, the claimable reward queue, the monthly
 * leaderboard, the credit ledger that moves claimed money into the wallet, and
 * the preference/goal layer the investor controls.
 *
 * The service in `src/server/services/investor-referrals-service.ts` fills
 * these shapes; a backend can serve the same object from persisted tables
 * without the page changing. Writes are a validated, audited local preview.
 */

import { z } from "zod";

import { money, round2, shortDateOf } from "./investments";

export const REFERRALS_AS_OF = "2026-10-25T09:20:00Z";
export const MAX_INVITES_PER_SEND = 10;
export const MAX_SENT_INVITES = 20;
export const MAX_EXPORTS = 10;
export const MAX_SUPPORT_DRAFTS = 12;
export const HISTORY_PAGE_SIZE = 6;

/* ── Programme constants (also read by I-1's invite dialogue) ── */

export const REFERRAL_PROGRAM = {
  code: "JANE-X9F2",
  link: "https://app.derivx.com/r/JANE-X9F2",
  maxPerReferral: 90,
  cookieDays: 30,
  currency: "USD",
  settlementWindow: "09:00 UTC daily batch",
  terms:
    "Your wallet is credited $5 when a referee signs up, $10 on their first deposit, $25 on their first investment and $50 once they stay 30+ days — capped at $90 per referee. Credits post in the next 09:00 UTC batch.",
} as const;

/* ── Enums ── */

export type ReferralStage =
  | "signed_up"
  | "deposited"
  | "invested"
  | "retained"
  | "lapsed";

export type ReferralStatus = "qualified" | "pending" | "lapsed";

export type ShareChannel = "copy" | "whatsapp" | "telegram" | "twitter" | "email";

export type RewardKind =
  | "referral_milestone"
  | "streak_tier"
  | "early_bird"
  | "birthday"
  | "settlement"
  | "welcome"
  | "campaign";

export type RewardStatus = "available" | "claimed" | "locked";

export type StreakDayState = "done" | "today" | "missed" | "upcoming";

export type TierStatus = "reached" | "next" | "locked";

export type CreditStatus = "queued" | "posted";

export type LeaderPeriod = "month" | "quarter" | "all";

export type ExportScope =
  | "invites"
  | "rewards"
  | "leaderboard"
  | "history"
  | "credits";

export type ExportFormat = "csv" | "json" | "pdf";

export type SupportTopic = "referral" | "reward" | "streak" | "payout" | "other";

export type PayoutDestination = "wallet" | "bonus_credit";

/* ── Rows ── */

export interface RewardLevel {
  key: "signup" | "deposit" | "investment" | "retention";
  label: string;
  amount: number;
  detail: string;
  /** When the credit lands, in plain words. */
  payAt: string;
}

export interface InviteMilestone {
  key: RewardLevel["key"];
  label: string;
  amount: number;
  /** null until the referee completes the step. */
  at: string | null;
}

export interface ReferralInvite {
  id: string;
  /** Masked handle shown in the ledger — never the referee's real identity. */
  alias: string;
  emailMasked: string;
  country: string;
  joinedAt: string;
  lastActivityAt: string;
  stage: ReferralStage;
  status: ReferralStatus;
  earned: number;
  poolCode: string | null;
  milestones: InviteMilestone[];
  note: string;
}

export interface SentInvite {
  id: string;
  email: string;
  sentAt: string;
  note: string;
  status: "sent" | "joined";
}

export interface StreakDay {
  key: string;
  label: string;
  date: string;
  state: StreakDayState;
  bonus: number;
}

export interface StreakTier {
  days: number;
  amount: number;
  status: TierStatus;
  reachedAt: string | null;
}

export interface StreakState {
  current: number;
  best: number;
  daysLogged: number;
  lastActiveAt: string;
  /** Bonus per logged day once the 7-day floor is cleared. */
  bonusPerDay: number;
  bonusActive: boolean;
  todayClaimed: boolean;
  dailyClaimedAt: string | null;
  freezes: number;
  frozenUntil: string | null;
  days: StreakDay[];
  tiers: StreakTier[];
  /** Where today sits in the current run. */
  runStartedAt: string;
  claimWindowEndsAt: string;
}

export interface RewardCard {
  id: string;
  kind: RewardKind;
  title: string;
  detail: string;
  amount: number;
  status: RewardStatus;
  /** What has to be true before it can be claimed. */
  requires: string;
  progress: number;
  target: number;
  availableFrom: string | null;
  expiresAt: string | null;
  claimedAt: string | null;
  creditTo: PayoutDestination;
  hint: string;
}

export interface Campaign {
  id: string;
  name: string;
  detail: string;
  bonus: number;
  multiplier: number;
  endsAt: string;
  status: "active" | "upcoming" | "ended";
  requires: string;
  progress: number;
  target: number;
  joined: boolean;
}

export interface LeaderRow {
  rank: number;
  previousRank: number;
  alias: string;
  referrals: number;
  earned: number;
  country: string;
  you: boolean;
}

export interface RewardHistoryRow {
  id: string;
  at: string;
  title: string;
  kind: RewardKind;
  amount: number;
  reference: string;
  detail: string;
  claimed: boolean;
}

export interface CreditRow {
  id: string;
  at: string;
  amount: number;
  status: CreditStatus;
  reference: string;
  source: string;
}

export interface ReferralGoal {
  metric: "qualified" | "earned";
  target: number;
  deadline: string;
  label: string;
}

export interface ReferralPreferences {
  milestoneAlerts: boolean;
  weeklySummary: boolean;
  autoClaim: boolean;
  marketing: boolean;
  leaderboardVisible: boolean;
  freezeAutoUse: boolean;
  payoutDestination: PayoutDestination;
  shareDefault: ShareChannel;
}

export interface ReferralExport {
  id: string;
  scope: ExportScope;
  format: ExportFormat;
  count: number;
  createdAt: string;
}

export interface ReferralSupport {
  id: string;
  topic: SupportTopic;
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface ReferralAudit {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface ReferralStats {
  total: number;
  qualified: number;
  pending: number;
  lapsed: number;
  earned: number;
  /** Milestone credit still on the table across live referees. */
  pipeline: number;
  conversionPct: number;
  avgPerReferral: number;
  bestReferral: number;
}

export interface ReferralWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: {
    id: string;
    displayName: string;
    email: string;
    country: string;
    tier: string;
    kycLevel: string;
    joinedAt: string;
    wallet: number;
    committed: number;
    monthRoiPct: number;
    unread: number;
    referralLevel: string;
    code: string;
    link: string;
  };
  program: {
    code: string;
    link: string;
    maxPerReferral: number;
    cookieDays: number;
    settlementWindow: string;
    terms: string;
    levels: RewardLevel[];
  };
  stats: ReferralStats;
  invites: ReferralInvite[];
  sent: SentInvite[];
  streak: StreakState;
  rewards: RewardCard[];
  campaigns: Campaign[];
  leaderboard: LeaderRow[];
  leaderPeriod: LeaderPeriod;
  history: RewardHistoryRow[];
  credits: CreditRow[];
  goal: ReferralGoal;
  preferences: ReferralPreferences;
  shares: { channel: ShareChannel; at: string; target: string | null }[];
  exports: ReferralExport[];
  support: ReferralSupport[];
  audit: ReferralAudit[];
}

/* ── Formatting ── */

export const pct = (value: number, decimals = 0) => `${value.toFixed(decimals)}%`;
export const clockShort = (iso: string) => iso.slice(11, 16);
export const dayKey = (iso: string) => iso.slice(0, 10);
export { money, round2, shortDateOf };

export const signedMoney = (value: number, decimals = 2) =>
  `${value >= 0 ? "+" : "−"}$${Math.abs(value).toFixed(decimals)}`;

export const dayName = (iso: string) =>
  new Date(`${dayKey(iso)}T00:00:00Z`).toUTCString().slice(0, 3);

export const monthLabel = (iso: string) =>
  new Date(`${dayKey(iso)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** "3 h ago" / "2 d ago" — measured against the snapshot clock. */
export const relativeTo = (iso: string, asOf: string) => {
  const delta = new Date(asOf).getTime() - new Date(iso).getTime();
  if (Number.isNaN(delta) || delta < 0) return "just now";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 d ago" : `${days} d ago`;
};

export const stageLabel = (stage: ReferralStage) =>
  stage === "signed_up"
    ? "Signed up"
    : stage === "deposited"
      ? "First deposit"
      : stage === "invested"
        ? "Invested"
        : stage === "retained"
          ? "Retained 30 d"
          : "Lapsed";

export const stageIndex = (stage: ReferralStage) =>
  stage === "signed_up" ? 1 : stage === "deposited" ? 2 : stage === "invested" ? 3 : stage === "retained" ? 4 : 0;

export const statusTone = (status: ReferralStatus) =>
  status === "qualified" ? "is-ok" : status === "pending" ? "is-warn" : "is-muted";

export const statusLabel = (status: ReferralStatus) =>
  status === "qualified" ? "Qualified" : status === "pending" ? "Pending" : "Lapsed";

export const rewardKindLabel = (kind: RewardKind) =>
  kind === "referral_milestone"
    ? "Referral milestone"
    : kind === "streak_tier"
      ? "Streak tier"
      : kind === "early_bird"
        ? "Early bird"
        : kind === "birthday"
          ? "Birthday"
          : kind === "settlement"
            ? "Settlement"
            : kind === "welcome"
              ? "Welcome"
              : "Campaign";

export const rewardStatusTone = (status: RewardStatus) =>
  status === "available" ? "is-ok" : status === "claimed" ? "is-muted" : "is-locked";

export const channelLabel = (channel: ShareChannel) =>
  channel === "copy"
    ? "Copy link"
    : channel === "whatsapp"
      ? "WhatsApp"
      : channel === "telegram"
        ? "Telegram"
        : channel === "twitter"
          ? "X / Twitter"
          : "Email";

export const channelIcon = (channel: ShareChannel) =>
  channel === "copy"
    ? "copy"
    : channel === "email"
      ? "mail"
      : channel === "twitter"
        ? "globe"
        : "send";

export const destinationLabel = (destination: PayoutDestination) =>
  destination === "wallet" ? "Wallet cash" : "Bonus credit";

export const topicLabel = (topic: SupportTopic) =>
  topic === "referral"
    ? "Referral credit"
    : topic === "reward"
      ? "A reward did not claim"
      : topic === "streak"
        ? "Streak or freeze"
        : topic === "payout"
          ? "Credit not in my wallet"
          : "Something else";

/* ── Derived views ── */

export function referralStats(
  invites: readonly ReferralInvite[],
  maxPerReferral = REFERRAL_PROGRAM.maxPerReferral,
): ReferralStats {
  const qualified = invites.filter((row) => row.status === "qualified");
  const pending = invites.filter((row) => row.status === "pending");
  const lapsed = invites.filter((row) => row.status === "lapsed");
  const earned = round2(invites.reduce((sum, row) => sum + row.earned, 0));
  const pipeline = round2(
    invites
      .filter((row) => row.status !== "lapsed")
      .reduce((sum, row) => sum + Math.max(0, maxPerReferral - row.earned), 0),
  );
  return {
    total: invites.length,
    qualified: qualified.length,
    pending: pending.length,
    lapsed: lapsed.length,
    earned,
    pipeline,
    conversionPct: invites.length
      ? round2((qualified.length / invites.length) * 100)
      : 0,
    avgPerReferral: invites.length ? round2(earned / invites.length) : 0,
    bestReferral: invites.reduce((best, row) => Math.max(best, row.earned), 0),
  };
}

export interface RewardTotals {
  available: number;
  claimed: number;
  locked: number;
  availableCount: number;
  claimedCount: number;
  lockedCount: number;
  count: number;
}

export function rewardTotals(rows: readonly RewardCard[]): RewardTotals {
  const sum = (status: RewardStatus) =>
    round2(
      rows
        .filter((row) => row.status === status)
        .reduce((total, row) => total + row.amount, 0),
    );
  return {
    available: sum("available"),
    claimed: sum("claimed"),
    locked: sum("locked"),
    availableCount: rows.filter((row) => row.status === "available").length,
    claimedCount: rows.filter((row) => row.status === "claimed").length,
    lockedCount: rows.filter((row) => row.status === "locked").length,
    count: rows.length,
  };
}

export interface StreakProgress {
  current: number;
  best: number;
  daysLogged: number;
  nextTier: StreakTier | null;
  daysToNext: number;
  pctToNext: number;
  weeklyDone: number;
  weeklyBonus: number;
  bonusActive: boolean;
  claimable: number;
  freezes: number;
}

export function streakProgress(streak: StreakState): StreakProgress {
  const next =
    streak.tiers.find((tier) => tier.status === "next") ??
    streak.tiers.find((tier) => tier.status === "locked") ??
    null;
  const weeklyDone = streak.days.filter((day) => day.state === "done").length;
  return {
    current: streak.current,
    best: streak.best,
    daysLogged: streak.daysLogged,
    nextTier: next,
    daysToNext: next ? Math.max(0, next.days - streak.current) : 0,
    pctToNext: next ? Math.min(100, round2((streak.current / next.days) * 100)) : 100,
    weeklyDone,
    weeklyBonus: round2(
      streak.days
        .filter((day) => day.state === "done" || day.state === "today")
        .reduce((sum, day) => sum + day.bonus, 0),
    ),
    bonusActive: streak.bonusActive,
    claimable: streak.todayClaimed || !streak.bonusActive ? 0 : streak.bonusPerDay,
    freezes: streak.freezes,
  };
}

export interface LeaderboardView {
  rows: LeaderRow[];
  you: LeaderRow | null;
  gapToNext: number;
  nextAlias: string | null;
  topThreeBonus: number;
  inTopTen: boolean;
  movement: { up: number; down: number; flat: number };
}

export function leaderboardView(rows: readonly LeaderRow[]): LeaderboardView {
  const sorted = rows.slice().sort((a, b) => a.rank - b.rank);
  const you = sorted.find((row) => row.you) ?? null;
  const above = you ? sorted.filter((row) => row.rank === you.rank - 1)[0] : undefined;
  return {
    rows: sorted,
    you,
    gapToNext: above && you ? Math.max(0, above.referrals - you.referrals) : 0,
    nextAlias: above?.alias ?? null,
    topThreeBonus: round2(
      sorted
        .filter((row) => row.rank <= 3)
        .reduce((sum, row) => sum + row.earned * 0.1, 0),
    ),
    inTopTen: Boolean(you && you.rank <= 10),
    movement: {
      up: sorted.filter((row) => row.rank < row.previousRank).length,
      down: sorted.filter((row) => row.rank > row.previousRank).length,
      flat: sorted.filter((row) => row.rank === row.previousRank).length,
    },
  };
}

export interface FunnelStep {
  key: ReferralStage | "invited";
  label: string;
  count: number;
  pct: number;
  amount: number;
}

export function inviteFunnel(
  invites: readonly ReferralInvite[],
  sent: readonly SentInvite[] = [],
): FunnelStep[] {
  const steps: { key: ReferralStage | "invited"; label: string }[] = [
    { key: "invited", label: "Invites sent" },
    { key: "signed_up", label: "Signed up" },
    { key: "deposited", label: "First deposit" },
    { key: "invested", label: "First investment" },
    { key: "retained", label: "Retained 30 d" },
  ];
  const atLeast = (stage: ReferralStage) =>
    invites.filter((row) => stageIndex(row.stage) >= stageIndex(stage) && row.status !== "lapsed")
      .length;
  const counts: Record<string, number> = {
    invited: invites.length + sent.length,
    signed_up: atLeast("signed_up"),
    deposited: atLeast("deposited"),
    invested: atLeast("invested"),
    retained: atLeast("retained"),
  };
  const top = Math.max(1, counts.invited);
  return steps.map((step) => ({
    ...step,
    count: counts[step.key],
    pct: round2((counts[step.key] / top) * 100),
    amount:
      step.key === "invited"
        ? 0
        : round2(
            invites.filter((row) => stageIndex(row.stage) >= stageIndex(step.key as ReferralStage))
              .reduce((sum, row) => sum + row.earned, 0),
          ),
  }));
}

export interface HistoryTotals {
  claimed: number;
  queued: number;
  lifetime: number;
  count: number;
}

export function historyTotals(
  history: readonly RewardHistoryRow[],
  credits: readonly CreditRow[] = [],
): HistoryTotals {
  const claimed = round2(
    history.filter((row) => row.claimed).reduce((sum, row) => sum + row.amount, 0),
  );
  const queued = round2(
    credits.filter((row) => row.status === "queued").reduce((sum, row) => sum + row.amount, 0),
  );
  return {
    claimed,
    queued,
    lifetime: round2(claimed + queued),
    count: history.length,
  };
}

export function creditTotals(credits: readonly CreditRow[]) {
  return {
    queued: round2(
      credits.filter((row) => row.status === "queued").reduce((sum, row) => sum + row.amount, 0),
    ),
    posted: round2(
      credits.filter((row) => row.status === "posted").reduce((sum, row) => sum + row.amount, 0),
    ),
    count: credits.length,
  };
}

export function campaignView(campaigns: readonly Campaign[]) {
  return {
    active: campaigns.filter((row) => row.status === "active"),
    upcoming: campaigns.filter((row) => row.status === "upcoming"),
    ended: campaigns.filter((row) => row.status === "ended"),
    potential: round2(
      campaigns
        .filter((row) => row.status !== "ended" && row.joined)
        .reduce((sum, row) => sum + row.bonus, 0),
    ),
  };
}

export function goalProgress(goal: ReferralGoal, stats: ReferralStats) {
  const current = goal.metric === "qualified" ? stats.qualified : stats.earned;
  const target = Math.max(1, goal.target);
  return {
    current,
    target,
    pct: Math.min(100, round2((current / target) * 100)),
    remaining: Math.max(0, round2(target - current)),
    met: current >= target,
  };
}

/** Rewards that are claimable at the snapshot clock. */
export function claimableRewards(
  rows: readonly RewardCard[],
  asOf: string,
): RewardCard[] {
  return rows.filter(
    (row) =>
      row.status === "available" &&
      (!row.availableFrom || row.availableFrom <= asOf) &&
      (!row.expiresAt || row.expiresAt > asOf),
  );
}

export function paginate<T>(rows: readonly T[], page: number, size = HISTORY_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const safe = Math.min(Math.max(1, page), pages);
  return {
    page: safe,
    pages,
    total: rows.length,
    rows: rows.slice((safe - 1) * size, safe * size),
  };
}

/* ── Draft validation ── */

export function claimDraftError(
  reward: RewardCard | null,
  asOf: string,
): string {
  if (!reward) return "Pick a reward to claim";
  if (reward.status === "claimed") return "That reward has already been claimed";
  if (reward.status === "locked") return "That reward is still locked — keep going";
  if (reward.availableFrom && reward.availableFrom > asOf)
    return `That reward unlocks on ${shortDateOf(reward.availableFrom)}`;
  if (reward.expiresAt && reward.expiresAt <= asOf)
    return "That reward has expired — the window closed";
  return "";
}

export function streakClaimError(streak: StreakState, asOf: string): string {
  if (streak.todayClaimed) return "Today's streak bonus is already claimed";
  if (!streak.bonusActive)
    return "The daily bonus unlocks after seven consecutive days";
  if (!streak.lastActiveAt.startsWith(dayKey(asOf)))
    return "Log in and open the dashboard today to keep the streak alive";
  return "";
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function inviteDraftError(input: {
  emails: string[];
  note: string;
  ownEmail: string;
}): string {
  const cleaned = input.emails.map((row) => row.trim()).filter(Boolean);
  if (!cleaned.length) return "Add at least one email address";
  if (cleaned.length > MAX_INVITES_PER_SEND)
    return `Send at most ${MAX_INVITES_PER_SEND} invites at a time`;
  const bad = cleaned.find((email) => !emailPattern.test(email));
  if (bad) return `“${bad}” is not a valid email address`;
  const lowered = cleaned.map((email) => email.toLowerCase());
  if (new Set(lowered).size !== lowered.length)
    return "The same address is in the list twice";
  if (lowered.includes(input.ownEmail.toLowerCase()))
    return "You cannot refer your own account";
  if (input.note.trim().length > 240)
    return "Keep the note under 240 characters";
  return "";
}

export function goalDraftError(input: { target: number; deadline: string }): string {
  if (!Number.isFinite(input.target) || input.target < 1)
    return "Set a target of at least 1";
  if (input.target > 50) return "Targets above 50 referrals per cycle are not tracked";
  if (!input.deadline) return "Pick a deadline";
  return "";
}

export function preferencesDraftError(input: {
  preferences: ReferralPreferences;
  asOf: string;
}): string {
  if (!input.preferences.milestoneAlerts && !input.preferences.weeklySummary)
    return "Keep at least one alert on — otherwise you will not know a referee qualified";
  if (
    input.preferences.payoutDestination === "bonus_credit" &&
    input.preferences.autoClaim
  )
    return "Auto-claim needs the wallet destination; bonus credit must be claimed by hand";
  return "";
}

/* ── Export helpers ── */

export type ExportCell = string | number;

export function exportMatrix(
  workspace: ReferralWorkspace,
  scope: ExportScope,
): { title: string; header: string[]; rows: ExportCell[][] } {
  if (scope === "invites") {
    return {
      title: "Referral ledger",
      header: ["Joined", "Referee", "Stage", "Status", "Earned", "Pool"],
      rows: workspace.invites.map((row) => [
        row.joinedAt,
        row.alias,
        stageLabel(row.stage),
        statusLabel(row.status),
        row.earned,
        row.poolCode ?? "—",
      ]),
    };
  }
  if (scope === "rewards") {
    return {
      title: "Reward queue",
      header: ["Reward", "Kind", "Amount", "Status", "Requires", "Unlocks"],
      rows: workspace.rewards.map((row) => [
        row.title,
        rewardKindLabel(row.kind),
        row.amount,
        row.status,
        row.requires,
        row.availableFrom ?? "—",
      ]),
    };
  }
  if (scope === "leaderboard") {
    return {
      title: "Referral leaderboard",
      header: ["Rank", "Referrer", "Referrals", "Earned", "Movement"],
      rows: workspace.leaderboard.map((row) => [
        row.rank,
        row.alias,
        row.referrals,
        row.earned,
        row.rank < row.previousRank
          ? `up ${row.previousRank - row.rank}`
          : row.rank > row.previousRank
            ? `down ${row.rank - row.previousRank}`
            : "flat",
      ]),
    };
  }
  if (scope === "credits") {
    return {
      title: "Credit queue",
      header: ["Queued at", "Reference", "Source", "Amount", "Status"],
      rows: workspace.credits.map((row) => [
        row.at,
        row.reference,
        row.source,
        row.amount,
        row.status,
      ]),
    };
  }
  return {
    title: "Reward history",
    header: ["At", "Reward", "Kind", "Amount", "Reference", "State"],
    rows: workspace.history.map((row) => [
      row.at,
      row.title,
      rewardKindLabel(row.kind),
      row.amount,
      row.reference,
      row.claimed ? "claimed" : "queued",
    ]),
  };
}

export const csvOf = (matrix: { header: string[]; rows: ExportCell[][] }) =>
  [matrix.header, ...matrix.rows]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\n");

/* ── Commands ── */

const channelEnum = z.enum(["copy", "whatsapp", "telegram", "twitter", "email"]);

export const referralCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("claimReward"), id: z.string().min(3).max(60) }),
  z.object({ kind: z.literal("claimAll") }),
  z.object({ kind: z.literal("claimDaily") }),
  z.object({ kind: z.literal("useFreeze") }),
  z.object({
    kind: z.literal("share"),
    channel: channelEnum,
    target: z.string().max(120).optional(),
  }),
  z.object({
    kind: z.literal("sendInvites"),
    emails: z.array(z.string().max(120)).min(1).max(MAX_INVITES_PER_SEND),
    note: z.string().max(240).default(""),
  }),
  z.object({ kind: z.literal("revokeInvite"), id: z.string().min(3).max(60) }),
  z.object({
    kind: z.literal("savePreferences"),
    milestoneAlerts: z.boolean(),
    weeklySummary: z.boolean(),
    autoClaim: z.boolean(),
    marketing: z.boolean(),
    leaderboardVisible: z.boolean(),
    freezeAutoUse: z.boolean(),
    payoutDestination: z.enum(["wallet", "bonus_credit"]),
    shareDefault: channelEnum,
  }),
  z.object({ kind: z.literal("joinCampaign"), id: z.string().min(3).max(60) }),
  z.object({
    kind: z.literal("setGoal"),
    target: z.number().int().min(1).max(50),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    kind: z.literal("exportReport"),
    scope: z.enum(["invites", "rewards", "leaderboard", "history", "credits"]),
    format: z.enum(["csv", "json", "pdf"]),
    count: z.number().int().min(0).max(500),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["referral", "reward", "streak", "payout", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
  z.object({
    kind: z.literal("acknowledge"),
    scope: z.enum(["terms", "leaderboard", "credits"]),
  }),
  z.object({ kind: z.literal("resetRewards") }),
]);

export type ReferralCommand = z.infer<typeof referralCommandSchema>;

const clone = (workspace: ReferralWorkspace): ReferralWorkspace =>
  JSON.parse(JSON.stringify(workspace)) as ReferralWorkspace;

const audit = (workspace: ReferralWorkspace, action: string, detail: string) => {
  workspace.audit = [
    {
      id: `rf_audit_${workspace.revision + 1}_${workspace.audit.length + 1}`,
      at: workspace.asOf,
      action,
      detail,
    },
    ...workspace.audit,
  ].slice(0, 24);
};

const bump = (workspace: ReferralWorkspace) => {
  workspace.revision += 1;
  return workspace;
};

const credit = (workspace: ReferralWorkspace, amount: number, source: string) => {
  workspace.credits = [
    {
      id: `rf_cr_${workspace.revision + 1}_${workspace.credits.length + 1}`,
      at: workspace.asOf,
      amount: round2(amount),
      status: "queued",
      reference: `RW-${workspace.asOf.slice(0, 10).replace(/-/g, "")}-${String(
        workspace.credits.length + 1,
      ).padStart(4, "0")}`,
      source,
    },
    ...workspace.credits,
  ];
};

const claimOne = (workspace: ReferralWorkspace, reward: RewardCard) => {
  reward.status = "claimed";
  reward.claimedAt = workspace.asOf;
  workspace.history = [
    {
      id: `rf_h_${workspace.revision + 1}_${workspace.history.length + 1}`,
      at: workspace.asOf,
      title: reward.title,
      kind: reward.kind,
      amount: reward.amount,
      reference: `RW-${workspace.asOf.slice(0, 10).replace(/-/g, "")}-${String(
        workspace.history.length + 1,
      ).padStart(4, "0")}`,
      detail: `${reward.requires} · credited to ${destinationLabel(reward.creditTo)}`,
      claimed: true,
    },
    ...workspace.history,
  ];
  credit(workspace, reward.amount, reward.title);
};

export function applyReferralCommand(
  workspace: ReferralWorkspace,
  command: ReferralCommand,
): ReferralWorkspace {
  const parsed = referralCommandSchema.parse(command);
  const next = clone(workspace);

  switch (parsed.kind) {
    case "claimReward": {
      const reward = next.rewards.find((row) => row.id === parsed.id);
      const error = claimDraftError(reward ?? null, next.asOf);
      if (error) throw new Error(error);
      claimOne(next, reward as RewardCard);
      audit(next, "reward_claimed", `${reward?.title} · ${money(reward?.amount ?? 0, 2)}`);
      return bump(next);
    }
    case "claimAll": {
      const open = claimableRewards(next.rewards, next.asOf);
      if (!open.length) throw new Error("Nothing is claimable right now");
      for (const reward of open) claimOne(next, reward);
      audit(
        next,
        "rewards_claimed",
        `${open.length} reward${open.length === 1 ? "" : "s"} · ${money(
          open.reduce((sum, row) => sum + row.amount, 0),
          2,
        )}`,
      );
      return bump(next);
    }
    case "claimDaily": {
      const error = streakClaimError(next.streak, next.asOf);
      if (error) throw new Error(error);
      next.streak.todayClaimed = true;
      next.streak.dailyClaimedAt = next.asOf;
      const day = next.streak.days.find((row) => row.state === "today");
      if (day) day.bonus = next.streak.bonusPerDay;
      credit(next, next.streak.bonusPerDay, "Daily streak bonus");
      audit(next, "daily_claimed", `${money(next.streak.bonusPerDay, 2)} · day ${next.streak.current}`);
      return bump(next);
    }
    case "useFreeze": {
      if (next.streak.freezes <= 0)
        throw new Error("No streak freezes left — the next one lands at day 20");
      next.streak.freezes -= 1;
      next.streak.frozenUntil = new Date(
        new Date(next.asOf).getTime() + 24 * 3600_000,
      ).toISOString();
      audit(next, "freeze_used", `Streak protected until ${shortDateOf(next.streak.frozenUntil)}`);
      return bump(next);
    }
    case "share": {
      next.shares = [
        { channel: parsed.channel, at: next.asOf, target: parsed.target ?? null },
        ...next.shares,
      ].slice(0, 24);
      audit(
        next,
        "referral_shared",
        `${channelLabel(parsed.channel)}${parsed.target ? ` · ${parsed.target}` : ""}`,
      );
      return bump(next);
    }
    case "sendInvites": {
      if (next.sent.length + parsed.emails.length > MAX_SENT_INVITES)
        throw new Error(`You can hold ${MAX_SENT_INVITES} open invites at a time`);
      const fresh = parsed.emails
        .map((email) => email.trim())
        .filter(Boolean)
        .filter(
          (email) =>
            !next.sent.some((row) => row.email.toLowerCase() === email.toLowerCase()),
        );
      if (!fresh.length) throw new Error("Those addresses already have an open invite");
      next.sent = [
        ...fresh.map((email, index) => ({
          id: `rf_sent_${next.revision + 1}_${next.sent.length + index + 1}`,
          email,
          sentAt: next.asOf,
          note: parsed.note,
          status: "sent" as const,
        })),
        ...next.sent,
      ];
      audit(
        next,
        "invites_sent",
        `${fresh.length} invite${fresh.length === 1 ? "" : "s"} queued as local drafts`,
      );
      return bump(next);
    }
    case "revokeInvite": {
      const before = next.sent.length;
      next.sent = next.sent.filter((row) => row.id !== parsed.id);
      if (next.sent.length === before) throw new Error("That invite is already gone");
      audit(next, "invite_revoked", parsed.id);
      return bump(next);
    }
    case "savePreferences": {
      next.preferences = {
        milestoneAlerts: parsed.milestoneAlerts,
        weeklySummary: parsed.weeklySummary,
        autoClaim: parsed.autoClaim,
        marketing: parsed.marketing,
        leaderboardVisible: parsed.leaderboardVisible,
        freezeAutoUse: parsed.freezeAutoUse,
        payoutDestination: parsed.payoutDestination,
        shareDefault: parsed.shareDefault,
      };
      const error = preferencesDraftError({ preferences: next.preferences, asOf: next.asOf });
      if (error) throw new Error(error);
      audit(
        next,
        "preferences_saved",
        `${destinationLabel(parsed.payoutDestination)} · ${parsed.autoClaim ? "auto-claim on" : "manual claims"}`,
      );
      return bump(next);
    }
    case "joinCampaign": {
      const campaign = next.campaigns.find((row) => row.id === parsed.id);
      if (!campaign) throw new Error("That campaign is no longer running");
      if (campaign.status === "ended") throw new Error("That campaign has ended");
      if (campaign.joined) throw new Error("You have already joined that campaign");
      campaign.joined = true;
      audit(next, "campaign_joined", campaign.name);
      return bump(next);
    }
    case "setGoal": {
      next.goal = {
        ...next.goal,
        target: parsed.target,
        deadline: parsed.deadline,
      };
      audit(
        next,
        "goal_updated",
        `${parsed.target} by ${shortDateOf(parsed.deadline)}`,
      );
      return bump(next);
    }
    case "exportReport": {
      next.exports = [
        {
          id: `rf_exp_${next.revision + 1}_${next.exports.length + 1}`,
          scope: parsed.scope,
          format: parsed.format,
          count: parsed.count,
          createdAt: next.asOf,
        },
        ...next.exports,
      ].slice(0, MAX_EXPORTS);
      audit(
        next,
        "export_generated",
        `${parsed.scope} · ${parsed.format.toUpperCase()} · ${parsed.count} rows`,
      );
      return bump(next);
    }
    case "support": {
      if (next.support.length >= MAX_SUPPORT_DRAFTS)
        throw new Error("That is a lot of drafts — the desk replies to the newest first");
      next.support = [
        {
          id: `rf_sup_${next.revision + 1}_${next.support.length + 1}`,
          topic: parsed.topic,
          message: parsed.message,
          status: "local_draft" as const,
          createdAt: next.asOf,
        },
        ...next.support,
      ].slice(0, MAX_SUPPORT_DRAFTS);
      audit(next, "support_drafted", `${parsed.topic} · ${parsed.message.slice(0, 60)}`);
      return bump(next);
    }
    case "acknowledge": {
      audit(next, "acknowledged", `Disclosure acknowledged · ${parsed.scope}`);
      return bump(next);
    }
    case "resetRewards": {
      next.rewards = next.rewards.map((row) =>
        row.claimedAt === next.asOf
          ? { ...row, status: "available" as RewardStatus, claimedAt: null }
          : row,
      );
      next.history = next.history.filter((row) => row.at !== next.asOf);
      next.credits = next.credits.filter((row) => row.at !== next.asOf);
      next.streak.todayClaimed = false;
      next.streak.dailyClaimedAt = null;
      next.sent = [];
      next.shares = [];
      next.exports = [];
      next.support = [];
      next.campaigns = next.campaigns.map((row) => ({ ...row, joined: false }));
      next.audit = [];
      next.revision = 0;
      return next;
    }
    default:
      return next;
  }
}

/* ── Defaults ── */

export function emptyPreferences(): ReferralPreferences {
  return {
    milestoneAlerts: true,
    weeklySummary: true,
    autoClaim: false,
    marketing: false,
    leaderboardVisible: true,
    freezeAutoUse: true,
    payoutDestination: "wallet",
    shareDefault: "copy",
  };
}

/* ── Read slices (what each spec query key returns) ── */

export interface ReferralSectionMap {
  workspace: ReferralWorkspace;
  "code-and-stats": {
    profile: ReferralWorkspace["profile"];
    program: ReferralWorkspace["program"];
    stats: ReferralStats;
    invites: ReferralInvite[];
    sent: SentInvite[];
    shares: ReferralWorkspace["shares"];
    funnel: FunnelStep[];
    campaigns: Campaign[];
    goal: ReferralGoal;
    goalView: ReturnType<typeof goalProgress>;
    preferences: ReferralPreferences;
    nextPoolHint: string;
  };
  streak: {
    streak: StreakState;
    view: StreakProgress;
    weekRange: { from: string; to: string };
    nextTierLabel: string;
  };
  "available-rewards": {
    rewards: RewardCard[];
    claimable: RewardCard[];
    totals: RewardTotals;
    claimableTotal: number;
    credits: CreditRow[];
    creditTotals: ReturnType<typeof creditTotals>;
    nextSettlement: string;
  };
  leaderboard: {
    period: LeaderPeriod;
    rows: LeaderRow[];
    you: LeaderRow | null;
    view: LeaderboardView;
    resetAt: string;
    bonusPool: number;
  };
  history: {
    page: number;
    pages: number;
    total: number;
    rows: RewardHistoryRow[];
    totals: HistoryTotals;
  };
}

export type ReferralSectionKey = keyof ReferralSectionMap;

export const REFERRAL_SECTIONS: ReferralSectionKey[] = [
  "workspace",
  "code-and-stats",
  "streak",
  "available-rewards",
  "leaderboard",
  "history",
];

export function referralSection<K extends ReferralSectionKey>(
  workspace: ReferralWorkspace,
  section: K,
  params: { page?: number; period?: LeaderPeriod } = {},
): ReferralSectionMap[K] {
  const result = (() => {
    switch (section) {
      case "code-and-stats":
        return {
          profile: workspace.profile,
          program: workspace.program,
          stats: workspace.stats,
          invites: workspace.invites,
          sent: workspace.sent,
          shares: workspace.shares,
          funnel: inviteFunnel(workspace.invites),
          campaigns: workspace.campaigns,
          goal: workspace.goal,
          goalView: goalProgress(workspace.goal, workspace.stats),
          preferences: workspace.preferences,
          nextPoolHint: "PKG-02 closes 25 Oct 00:18 UTC — the next referee slot to cite.",
        };
      case "streak": {
        const days = workspace.streak.days;
        return {
          streak: workspace.streak,
          view: streakProgress(workspace.streak),
          weekRange: { from: days[0]?.date ?? "", to: days[days.length - 1]?.date ?? "" },
          nextTierLabel: (() => {
            const next = workspace.streak.tiers.find((tier) => tier.status === "next");
            return next ? `${next.days - workspace.streak.current} days to +${money(next.amount, 0)}` : "Top tier reached";
          })(),
        };
      }
      case "available-rewards": {
        const claimable = claimableRewards(workspace.rewards, workspace.asOf);
        return {
          rewards: workspace.rewards,
          claimable,
          totals: rewardTotals(workspace.rewards),
          claimableTotal: round2(claimable.reduce((sum, row) => sum + row.amount, 0)),
          credits: workspace.credits,
          creditTotals: creditTotals(workspace.credits),
          nextSettlement: workspace.program.settlementWindow,
        };
      }
      case "leaderboard": {
        const period = params.period ?? workspace.leaderPeriod;
        return {
          period,
          rows: workspace.leaderboard,
          you: workspace.leaderboard.find((row) => row.you) ?? null,
          view: leaderboardView(workspace.leaderboard),
          resetAt: "2026-11-01T00:00:00Z",
          bonusPool: round2(
            workspace.leaderboard
              .filter((row) => row.rank <= 3)
              .reduce((sum, row) => sum + row.earned, 0) * 0.1,
          ),
        };
      }
      case "history": {
        const page = paginate(workspace.history, params.page ?? 1);
        return {
          page: page.page,
          pages: page.pages,
          total: page.total,
          rows: page.rows,
          totals: historyTotals(workspace.history, workspace.credits),
        };
      }
      default:
        return workspace;
    }
  })();
  return result as ReferralSectionMap[K];
}

export const referralKey = (
  section: Exclude<ReferralSectionKey, "workspace">,
  params?: { page?: number; period?: LeaderPeriod },
) => {
  if (section === "leaderboard") return ["referrals", "leaderboard", { period: params?.period ?? "month" }] as const;
  if (section === "history") return ["referrals", "history", { page: params?.page ?? 1 }] as const;
  return ["referrals", section] as const;
};
