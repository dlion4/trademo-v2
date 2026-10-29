/**
 * I-10 · Referrals & Rewards — the demo snapshot.
 *
 * The programme itself is the only thing this desk invents. Everything that
 * can be cited is cited: the wallet balance is the I-7 balance, the lifetime
 * deposit total is the I-7 statement, the referee lanes point at pools that
 * really open on the pool board (PKG-02 closes 25 Oct, PKG-09 on 27 Oct), and
 * the settled payout reference `PO-2026-10-17-0052` is the same transaction
 * sitting in the wallet ledger.
 *
 * The snapshot clock is pinned to `REFERRALS_AS_OF` = 2026-10-25T09:20:00Z, a
 * Sunday. That anchor is deliberate: it puts the whole Mon 19 → Sun 25 week in
 * the streak calendar with Sunday as today, and it leaves the birthday bonus
 * opening at 10:00 UTC later the same day. The page therefore shows $125
 * claimable (the $90 referral bonus, the $25 unclaimed 14-day tier and the $10
 * early-bird) and treats the $20 birthday credit as "later today".
 */

import { getInvestmentsWorkspace } from "./investor-investments-service";
import { getPoolsWorkspace } from "./investor-pools-service";
import { getWalletWorkspace } from "./investor-wallet-service";
import {
  REFERRALS_AS_OF,
  REFERRAL_PROGRAM,
  applyReferralCommand,
  emptyPreferences,
  round2,
  type Campaign,
  type CreditRow,
  type InviteMilestone,
  type LeaderRow,
  type ReferralAudit,
  type ReferralInvite,
  type ReferralStage,
  type ReferralWorkspace,
  type RewardCard,
  type RewardHistoryRow,
  type RewardLevel,
  type SentInvite,
  type StreakDay,
  type StreakTier,
  type ReferralCommand,
  referralStats,
} from "@/lib/investor/referrals";

const asOf = REFERRALS_AS_OF;

const shortDate = (iso: string) =>
  `${iso.slice(8, 10)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(iso.slice(5, 7)) - 1]}`;

const LEVELS: RewardLevel[] = [
  {
    key: "signup",
    label: "Signs up",
    amount: 5,
    detail: "They open an account with your code — the credit lands whether or not they invest.",
    payAt: "Next 09:00 UTC batch",
  },
  {
    key: "deposit",
    label: "First deposit",
    amount: 10,
    detail: "First settled deposit of $50 or more from their own bank or mobile money.",
    payAt: "Within 24 h of settlement",
  },
  {
    key: "investment",
    label: "First investment",
    amount: 25,
    detail: "Their first pool booking clears — PKG-02 and PKG-09 both count.",
    payAt: "At pool close",
  },
  {
    key: "retention",
    label: "Stays 30 days",
    amount: 50,
    detail: "Still funded and still holding a slot 30 days after their first deposit.",
    payAt: "Day 30, automatically",
  },
];

const milestoneSet = (dates: {
  signup: string;
  deposit?: string | null;
  investment?: string | null;
  retention?: string | null;
}): InviteMilestone[] =>
  LEVELS.map((level) => ({
    key: level.key,
    label: level.label,
    amount: level.amount,
    at: dates[level.key] ?? null,
  }));

interface InviteSeed {
  id: string;
  alias: string;
  emailMasked: string;
  country: string;
  joinedAt: string;
  lastActivityAt: string;
  stage: ReferralStage;
  status: ReferralInvite["status"];
  poolCode: string | null;
  note: string;
  dates: Parameters<typeof milestoneSet>[0];
}

const INVITE_SEEDS: InviteSeed[] = [
  {
    id: "ref_inv_01",
    alias: "R. Mwangi",
    emailMasked: "r••••a@gmail.com",
    country: "Kenya",
    joinedAt: "2026-09-14T11:20:00Z",
    lastActivityAt: "2026-10-24T18:40:00Z",
    stage: "retained",
    status: "qualified",
    poolCode: "PKG-01",
    note: "Full ladder cleared — the only referee past day 30.",
    dates: {
      signup: "2026-09-14T11:20:00Z",
      deposit: "2026-09-16T08:45:00Z",
      investment: "2026-09-18T14:10:00Z",
      retention: "2026-10-16T09:00:00Z",
    },
  },
  {
    id: "ref_inv_02",
    alias: "A. Otieno",
    emailMasked: "a••••o@outlook.com",
    country: "Kenya",
    joinedAt: "2026-09-27T07:05:00Z",
    lastActivityAt: "2026-10-24T21:15:00Z",
    stage: "invested",
    status: "qualified",
    poolCode: "PKG-02",
    note: "Booked PKG-02 — day-30 clock runs to 8 Nov.",
    dates: {
      signup: "2026-09-27T07:05:00Z",
      deposit: "2026-09-29T10:30:00Z",
      investment: "2026-10-10T09:00:00Z",
      retention: null,
    },
  },
  {
    id: "ref_inv_03",
    alias: "S. Kariuki",
    emailMasked: "s••••i@gmail.com",
    country: "Kenya",
    joinedAt: "2026-09-21T16:40:00Z",
    lastActivityAt: "2026-10-22T12:05:00Z",
    stage: "invested",
    status: "qualified",
    poolCode: "PKG-09",
    note: "Holding PKG-09 — retention credit on 25 Oct.",
    dates: {
      signup: "2026-09-21T16:40:00Z",
      deposit: "2026-09-22T09:15:00Z",
      investment: "2026-09-25T09:00:00Z",
      retention: null,
    },
  },
  {
    id: "ref_inv_04",
    alias: "J. Wanjiku",
    emailMasked: "j••••u@yahoo.com",
    country: "Kenya",
    joinedAt: "2026-10-06T13:30:00Z",
    lastActivityAt: "2026-10-19T08:20:00Z",
    stage: "deposited",
    status: "qualified",
    poolCode: null,
    note: "Funded but has not booked a slot yet — $50 still on the ladder.",
    dates: {
      signup: "2026-10-06T13:30:00Z",
      deposit: "2026-10-09T11:00:00Z",
      investment: null,
      retention: null,
    },
  },
  {
    id: "ref_inv_05",
    alias: "P. Njoroge",
    emailMasked: "p••••e@gmail.com",
    country: "Kenya",
    joinedAt: "2026-10-11T09:55:00Z",
    lastActivityAt: "2026-10-23T19:45:00Z",
    stage: "deposited",
    status: "qualified",
    poolCode: null,
    note: "Watching PKG-04 — the early-bird card is theirs if they book before 26 Oct.",
    dates: {
      signup: "2026-10-11T09:55:00Z",
      deposit: "2026-10-14T10:10:00Z",
      investment: null,
      retention: null,
    },
  },
  {
    id: "ref_inv_06",
    alias: "M. Ali",
    emailMasked: "m••••i@gmail.com",
    country: "Tanzania",
    joinedAt: "2026-10-23T15:25:00Z",
    lastActivityAt: "2026-10-23T15:31:00Z",
    stage: "signed_up",
    status: "pending",
    poolCode: null,
    note: "Signup credit ($5) queued for the next 09:00 UTC batch.",
    dates: {
      signup: "2026-10-23T15:25:00Z",
      deposit: null,
      investment: null,
      retention: null,
    },
  },
  {
    id: "ref_inv_07",
    alias: "L. Achieng",
    emailMasked: "l••••g@gmail.com",
    country: "Uganda",
    joinedAt: "2026-10-24T06:15:00Z",
    lastActivityAt: "2026-10-24T06:22:00Z",
    stage: "signed_up",
    status: "pending",
    poolCode: null,
    note: "Arrived from the Telegram share — reminder scheduled for 27 Oct.",
    dates: {
      signup: "2026-10-24T06:15:00Z",
      deposit: null,
      investment: null,
      retention: null,
    },
  },
  {
    id: "ref_inv_08",
    alias: "D. Kimani",
    emailMasked: "d••••i@outlook.com",
    country: "Kenya",
    joinedAt: "2026-09-18T12:00:00Z",
    lastActivityAt: "2026-09-30T09:10:00Z",
    stage: "lapsed",
    status: "lapsed",
    poolCode: null,
    note: "30 days without a login — the $50 retention rung expired on 20 Oct.",
    dates: {
      signup: "2026-09-18T12:00:00Z",
      deposit: "2026-09-20T08:30:00Z",
      investment: null,
      retention: null,
    },
  },
];

const buildInvites = (): ReferralInvite[] =>
  INVITE_SEEDS.map((seed) => {
    const milestones = milestoneSet(seed.dates);
    const settled = milestones.filter((row) => Boolean(row.at));
    // A lapsed referee keeps every credit already settled; retention never lands.
    const earned = round2(settled.reduce((sum, row) => sum + row.amount, 0));
    return {
      id: seed.id,
      alias: seed.alias,
      emailMasked: seed.emailMasked,
      country: seed.country,
      joinedAt: seed.joinedAt,
      lastActivityAt: seed.lastActivityAt,
      stage: seed.stage,
      status: seed.status,
      earned: seed.status === "pending" ? 0 : earned,
      poolCode: seed.poolCode,
      milestones,
      note: seed.note,
    };
  });

const buildStreakDays = (): StreakDay[] => {
  const week = [
    { key: "mon", label: "Mon", date: "2026-10-19" },
    { key: "tue", label: "Tue", date: "2026-10-20" },
    { key: "wed", label: "Wed", date: "2026-10-21" },
    { key: "thu", label: "Thu", date: "2026-10-22" },
    { key: "fri", label: "Fri", date: "2026-10-23" },
    { key: "sat", label: "Sat", date: "2026-10-24" },
    { key: "sun", label: "Sun", date: "2026-10-25" },
  ] as const;
  return week.map((day, index) => ({
    key: day.key,
    label: day.label,
    date: day.date,
    state: day.key === "sun" ? "today" : "done",
    bonus: 2,
  }));
};

const buildTiers = (): StreakTier[] => [
  { days: 7, amount: 10, status: "reached", reachedAt: "2026-10-20T08:30:00Z" },
  { days: 14, amount: 25, status: "next", reachedAt: null },
  { days: 30, amount: 100, status: "locked", reachedAt: "2026-09-15T09:00:00Z" },
];

const buildRewards = (): RewardCard[] => [
  {
    id: "rw_ref_090",
    kind: "referral_milestone",
    title: "Referral bonus · 3 rungs cleared",
    detail:
      "Five referees qualified: one full ladder at $90, two at $40 and two at $15. This is the unpaid balance.",
    amount: 90,
    status: "available",
    requires: "5 qualified referees",
    progress: 5,
    target: 5,
    availableFrom: "2026-10-24T09:00:00Z",
    expiresAt: null,
    claimedAt: null,
    creditTo: "wallet",
    hint: "Settles in the next 09:00 UTC batch — about $88.50 after the payout fee.",
  },
  {
    id: "rw_streak_14",
    kind: "streak_tier",
    title: "14-day streak tier",
    detail:
      "Earned in your 18-day run that ended 8 October. It was never claimed because auto-claim is off.",
    amount: 25,
    status: "available",
    requires: "14 consecutive daily logins",
    progress: 14,
    target: 14,
    availableFrom: "2026-10-08T09:00:00Z",
    expiresAt: null,
    claimedAt: null,
    creditTo: "wallet",
    hint: "Unclaimed streak tiers do not expire — claim whenever you like.",
  },
  {
    id: "rw_early_004",
    kind: "early_bird",
    title: "Early-bird · PKG-04 Quick Flip",
    detail:
      "You pre-booked PKG-04 before its 26 Oct open. The $10 early-bird credit unlocks with the booking.",
    amount: 10,
    status: "available",
    requires: "Pre-book PKG-04 before 26 Oct 09:00",
    progress: 1,
    target: 1,
    availableFrom: "2026-10-23T09:00:00Z",
    expiresAt: "2026-10-26T09:00:00Z",
    claimedAt: null,
    creditTo: "wallet",
    hint: "Claim before PKG-04 opens — the card expires with the booking window.",
  },
  {
    id: "rw_bday_025",
    kind: "birthday",
    title: "Birthday bonus",
    detail:
      "Happy birthday, Jane. The $20 credit is a gift from the desk — no deposit or referral needed.",
    amount: 20,
    status: "available",
    requires: "Birthday on file · 25 Oct",
    progress: 1,
    target: 1,
    availableFrom: "2026-10-25T10:00:00Z",
    expiresAt: "2026-10-26T00:00:00Z",
    claimedAt: null,
    creditTo: "bonus_credit",
    hint: "Opens at 10:00 UTC today and closes at midnight UTC.",
  },
];

const buildCampaigns = (): Campaign[] => [
  {
    id: "cmp_oct_double",
    name: "October double-up",
    detail: "Every rung you clear this month pays twice, capped at $90 per referee.",
    bonus: 50,
    multiplier: 2,
    endsAt: "2026-10-31T23:59:00Z",
    status: "active",
    requires: "3 qualified referees in October",
    progress: 2,
    target: 3,
    joined: false,
  },
  {
    id: "cmp_community",
    name: "Community challenge",
    detail: "One signup from your Telegram share clears it — already banked.",
    bonus: 25,
    multiplier: 1,
    endsAt: "2026-10-27T23:59:00Z",
    status: "active",
    requires: "1 referral signup from a share link",
    progress: 1,
    target: 1,
    joined: true,
  },
  {
    id: "cmp_nov_head",
    name: "November head-start",
    detail: "Join before 1 Nov and your first two referees pay an extra $15 each.",
    bonus: 30,
    multiplier: 1.5,
    endsAt: "2026-11-30T23:59:00Z",
    status: "upcoming",
    requires: "Join before 1 Nov",
    progress: 0,
    target: 1,
    joined: false,
  },
  {
    id: "cmp_sep_sprint",
    name: "September sprint",
    detail: "Closed 30 September. You finished 2 of 3 referees short.",
    bonus: 40,
    multiplier: 1,
    endsAt: "2026-09-30T23:59:00Z",
    status: "ended",
    requires: "3 qualified referees in September",
    progress: 2,
    target: 3,
    joined: true,
  },
];

const buildLeaderboard = (): LeaderRow[] => [
  { rank: 1, previousRank: 1, alias: "user_8f2a", referrals: 18, earned: 1620, country: "Kenya", you: false },
  { rank: 2, previousRank: 3, alias: "user_b3c1", referrals: 12, earned: 1080, country: "Nigeria", you: false },
  { rank: 3, previousRank: 2, alias: "user_d4e2", referrals: 10, earned: 900, country: "South Africa", you: false },
  { rank: 4, previousRank: 5, alias: "user_••••7c19", referrals: 9, earned: 810, country: "Ghana", you: false },
  { rank: 5, previousRank: 4, alias: "user_••••2a44", referrals: 8, earned: 720, country: "Kenya", you: false },
  { rank: 6, previousRank: 6, alias: "user_••••e5b7", referrals: 7, earned: 630, country: "Tanzania", you: false },
  { rank: 7, previousRank: 8, alias: "user_••••9d13", referrals: 7, earned: 615, country: "Uganda", you: false },
  { rank: 8, previousRank: 7, alias: "user_••••6f88", referrals: 6, earned: 540, country: "Rwanda", you: false },
  { rank: 9, previousRank: 9, alias: "user_••••1b02", referrals: 6, earned: 528, country: "Egypt", you: false },
  { rank: 10, previousRank: 11, alias: "user_••••c4a7", referrals: 6, earned: 516, country: "Morocco", you: false },
  { rank: 11, previousRank: 10, alias: "user_••••5e30", referrals: 5, earned: 430, country: "Kenya", you: false },
  { rank: 12, previousRank: 14, alias: "Jane Investor", referrals: 5, earned: 215, country: "Kenya", you: true },
];

const buildHistory = (): RewardHistoryRow[] => [
  {
    id: "rf_h_04",
    at: "2026-10-10T09:00:00Z",
    title: "First investment · A. Otieno",
    kind: "referral_milestone",
    amount: 25,
    reference: "RW-20261010-0042",
    detail: "PKG-02 booking cleared · day-30 retention still open",
    claimed: true,
  },
  {
    id: "rf_h_03",
    at: "2026-09-25T09:00:00Z",
    title: "First investment · S. Kariuki",
    kind: "referral_milestone",
    amount: 25,
    reference: "RW-20260925-0031",
    detail: "PKG-09 booking cleared · retention due 25 Oct",
    claimed: true,
  },
  {
    id: "rf_h_02",
    at: "2026-09-15T09:00:00Z",
    title: "30-day streak tier",
    kind: "streak_tier",
    amount: 100,
    reference: "RW-20260915-0018",
    detail: "Logged in 30 days straight · 12 Aug → 10 Sep",
    claimed: true,
  },
  {
    id: "rf_h_01",
    at: "2026-09-12T10:05:00Z",
    title: "Welcome bonus",
    kind: "welcome",
    amount: 5,
    reference: "RW-20260912-0001",
    detail: "Account opened · KYC L2 cleared 19 Oct",
    claimed: true,
  },
];

const buildCredits = (): CreditRow[] => [
  {
    id: "rf_cr_03",
    at: "2026-10-18T09:00:00Z",
    amount: 118.5,
    status: "posted",
    reference: "PO-2026-10-17-0052",
    source: "Referral payout · 17 Oct batch (net of $1.50)",
  },
  {
    id: "rf_cr_02",
    at: "2026-10-12T09:00:00Z",
    amount: 25,
    status: "posted",
    reference: "RW-20261010-0042",
    source: "First investment milestone · A. Otieno",
  },
  {
    id: "rf_cr_01",
    at: "2026-09-26T09:00:00Z",
    amount: 25,
    status: "posted",
    reference: "RW-20260925-0031",
    source: "First investment milestone · S. Kariuki",
  },
];

const buildSent = (): SentInvite[] => [
  {
    id: "rf_sent_01",
    email: "brian.otieno@gmail.com",
    sentAt: "2026-10-20T18:30:00Z",
    note: "Sent the PKG-02 deck — worth a look before it closes.",
    status: "sent",
  },
  {
    id: "rf_sent_02",
    email: "grace.mumo@outlook.com",
    sentAt: "2026-10-22T07:45:00Z",
    note: "Repeat invite · she asked about the minimum slot.",
    status: "sent",
  },
  {
    id: "rf_sent_03",
    email: "sales@fintech.co.ke",
    sentAt: "2026-10-24T11:10:00Z",
    note: "Team inbox — partnership angle, not a personal referral.",
    status: "sent",
  },
];

const buildAudit = (): ReferralAudit[] => [
  {
    id: "rf_audit_seed_3",
    at: "2026-10-24T09:00:00Z",
    action: "batch_settled",
    detail: "2 signup credits ($10) queued for 25 Oct 09:00 UTC",
  },
  {
    id: "rf_audit_seed_2",
    at: "2026-10-23T09:00:00Z",
    action: "reward_moved",
    detail: "Referral bonus moved from $65 to $90 after the 5th qualification",
  },
  {
    id: "rf_audit_seed_1",
    at: "2026-10-20T08:30:00Z",
    action: "streak_tier",
    detail: "7-day tier reached · $10 credited, run continues",
  },
];

export function buildReferralWorkspace(): ReferralWorkspace {
  const investments = getInvestmentsWorkspace();
  const wallet = getWalletWorkspace();
  const pools = getPoolsWorkspace();

  const invites = buildInvites();

  // Cite the pool board instead of hard-coding dates twice: the referee lanes
  // point at pools that are really open, and the early-bird card expires when
  // its booking window does.
  const poolByCode = (code: string) =>
    pools.open.find((pool) => pool.code === code) ??
    pools.upcoming.find((pool) => pool.code === code) ??
    null;
  const earlyBird = poolByCode("PKG-04");
  const earlyBirdOpen: string | null =
    earlyBird && "startsAt" in earlyBird ? String(earlyBird.startsAt) : null;
  const rewards = buildRewards().map((card) =>
    card.kind === "early_bird" && earlyBird && earlyBirdOpen
      ? {
          ...card,
          detail: `You pre-booked ${earlyBird.code} before its ${shortDate(earlyBirdOpen)} open. The $10 early-bird credit unlocks with the booking.`,
          requires: `Pre-book ${earlyBird.code} before ${shortDate(earlyBirdOpen)}`,
          expiresAt: earlyBirdOpen,
          hint: `Claim before ${earlyBird.code} opens — the card expires with the booking window.`,
        }
      : card,
  );
  const stats = referralStats(invites);

  return {
    mode: "demo",
    asOf,
    revision: 0,
    profile: {
      id: investments.profile.id,
      displayName: investments.profile.displayName,
      email: "jane.investor@derivx.com",
      country: investments.profile.country,
      tier: "Gold referrer",
      kycLevel: investments.profile.kycLevel,
      joinedAt: investments.profile.investorSince,
      wallet: wallet.balance.available,
      committed: investments.profile.committed,
      monthRoiPct: investments.profile.monthRoiPct,
      unread: investments.profile.unread,
      referralLevel: "Gold · 5 → 10 qualifications to Platinum",
      code: REFERRAL_PROGRAM.code,
      link: REFERRAL_PROGRAM.link,
    },
    program: {
      code: REFERRAL_PROGRAM.code,
      link: REFERRAL_PROGRAM.link,
      maxPerReferral: REFERRAL_PROGRAM.maxPerReferral,
      cookieDays: REFERRAL_PROGRAM.cookieDays,
      settlementWindow: REFERRAL_PROGRAM.settlementWindow,
      terms: REFERRAL_PROGRAM.terms,
      levels: LEVELS,
    },
    stats,
    invites,
    sent: buildSent(),
    streak: {
      current: 12,
      best: 18,
      daysLogged: 12,
      lastActiveAt: "2026-10-25T08:05:00Z",
      bonusPerDay: 2,
      bonusActive: true,
      todayClaimed: false,
      dailyClaimedAt: null,
      freezes: 1,
      frozenUntil: null,
      days: buildStreakDays(),
      tiers: buildTiers(),
      runStartedAt: "2026-10-14T08:05:00Z",
      claimWindowEndsAt: "2026-10-26T00:00:00Z",
    },
    rewards,
    campaigns: buildCampaigns(),
    leaderboard: buildLeaderboard(),
    leaderPeriod: "month",
    history: buildHistory(),
    credits: buildCredits(),
    goal: {
      metric: "qualified",
      target: 10,
      deadline: "2026-12-31",
      label: "10 qualified referees by 31 Dec",
    },
    preferences: emptyPreferences(),
    shares: [
      { channel: "whatsapp", at: "2026-10-23T19:40:00Z", target: "L. Achieng" },
      { channel: "telegram", at: "2026-10-22T07:50:00Z", target: "Community channel" },
      { channel: "copy", at: "2026-10-20T18:28:00Z", target: null },
      { channel: "email", at: "2026-10-20T18:30:00Z", target: "brian.otieno@gmail.com" },
      { channel: "twitter", at: "2026-10-16T12:15:00Z", target: "@janetheinvestor" },
    ],
    exports: [],
    support: [],
    audit: buildAudit(),
  };
}

/** Demo store — the last applied command, reset on `resetReferralWorkspace()`. */
let current: ReferralWorkspace | null = null;

export function getReferralWorkspace(): ReferralWorkspace {
  if (!current) current = buildReferralWorkspace();
  return current;
}

export function resetReferralWorkspace(): ReferralWorkspace {
  current = buildReferralWorkspace();
  return current;
}

export function applyReferralMutation(command: ReferralCommand): ReferralWorkspace {
  const next = applyReferralCommand(getReferralWorkspace(), command);
  current = next;
  return next;
}
