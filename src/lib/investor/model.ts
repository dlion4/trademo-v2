import { z } from "zod";

/** Investor Overview (I-1) — structured service contract, local commands only. */
export const INVESTOR_AS_OF = "2026-10-23T10:00:00Z";

export type PoolStatus = "trading" | "completed";
export interface GuardianState {
  status: "active" | "watch";
  consecutiveLosses: number;
  maxConsecutiveLosses: number;
  drawdownPct: number;
  drawdownLimitPct: number;
  lastCheckedAt: string;
  note: string;
}
export interface ActivePool {
  id: string;
  code: string;
  name: string;
  status: PoolStatus;
  goal: number;
  raised: number;
  slotPrice: number;
  userSlots: number;
  investment: number;
  profitSharePct: number;
  startedAt: string;
  endsAt: string;
  pnl: number;
  sharePnl: number;
  roiPct: number;
  winRatePct: number;
  trades: number;
  strategy: string;
  markets: string[];
  guardian: GuardianState;
}
export interface UpcomingPool {
  id: string;
  code: string;
  name: string;
  opensAt: string;
  minInvestment: number;
  durationDays: number;
  expectedRoiPct: number;
  capacity: number;
  focus: string;
  riskBand: "Low" | "Balanced" | "Growth";
}
export interface ActivityItem {
  id: string;
  kind:
    | "trade"
    | "deposit"
    | "guardian"
    | "payout"
    | "announcement"
    | "distribution"
    | "kyc"
    | "reminder";
  at: string;
  title: string;
  detail: string;
  amount: number | null;
  share: number | null;
  poolId: string | null;
  status: "settled" | "processing" | "informational" | "attention";
  read: boolean;
}
export interface TradeRow {
  id: string;
  poolId: string;
  poolCode: string;
  symbol: string;
  contract: string;
  stake: number;
  profit: number;
  share: number;
  result: "win" | "loss";
  closedAt: string;
}
export interface Investment {
  id: string;
  poolId: string;
  code: string;
  name: string;
  status: "active" | "completed";
  invested: number;
  currentValue: number;
  profit: number;
  roiPct: number;
  startedAt: string;
  endedAt: string | null;
  sharePct: number;
}
export interface InvestorNotification {
  id: string;
  kind: "earnings" | "risk" | "payout" | "pool" | "account";
  title: string;
  detail: string;
  at: string;
  read: boolean;
  hrefAction: "earnings" | "live-trades" | "payout" | "pool" | "notifications";
}
export interface Reminder {
  poolId: string;
  leadDays: 1 | 2 | 3 | 7;
  channel: "email" | "in_app";
  createdAt: string;
}
export interface Booking {
  id: string;
  poolId: string;
  slots: number;
  amount: number;
  status: "preview_hold";
  createdAt: string;
}
export interface PayoutRequest {
  id: string;
  amount: number;
  methodId: string;
  status: "source_processing" | "preview_waiting_source";
  createdAt: string;
}
export interface CalculatorScenario {
  id: string;
  principal: number;
  roiPct: number;
  days: number;
  projectedProfit: number;
  createdAt: string;
}
export interface PayoutMethod {
  id: string;
  label: string;
  detail: string;
  fee: number;
  minAmount: number;
  active: boolean;
}
export interface Preferences {
  channels: { email: boolean; push: boolean; sms: boolean };
  digest: "instant" | "daily" | "weekly";
  quietStart: string;
  quietEnd: string;
  autoRefresh: boolean;
}
export interface InvestorProfile {
  id: string;
  firstName: string;
  displayName: string;
  email: string;
  investorSince: string;
  kycLevel: "L1" | "L2" | "L3";
  kycVerifiedAt: string;
  country: string;
  currency: "USD";
  tier: string;
}
export interface EarningsTicker {
  updatedAt: string;
  nextRefreshIn: number;
  realizedThisMonth: number;
  rows: {
    poolId: string;
    code: string;
    profit: number;
    roiPct: number;
    updatedAt: string;
  }[];
}
export interface WalletSummary {
  available: number;
  pendingPayout: number;
  lifetimeEarnings: number;
  pendingDistribution: number;
  currency: "USD";
  methods: PayoutMethod[];
  transactions: {
    id: string;
    at: string;
    label: string;
    amount: number;
    type: "credit" | "debit";
  }[];
}
export interface ReferralProgram {
  code: string;
  invited: number;
  active: number;
  earned: number;
  rewardPct: number;
  terms: string;
}
export interface SupportTicket {
  id: string;
  topic: string;
  message: string;
  status: "local_draft";
  createdAt: string;
}
export interface AuditEntry {
  at: string;
  action: string;
  detail: string;
}
export interface InvestorWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: InvestorProfile;
  summary: {
    totalInvested: number;
    activePools: number;
    monthRoiPct: number;
    walletBalance: number;
    lifetimeEarnings: number;
  };
  activePools: ActivePool[];
  earnings: EarningsTicker;
  upcoming: UpcomingPool[];
  activity: ActivityItem[];
  trades: TradeRow[];
  portfolio: Investment[];
  notifications: InvestorNotification[];
  wallet: WalletSummary;
  preferences: Preferences;
  reminders: Reminder[];
  bookings: Booking[];
  payoutRequests: PayoutRequest[];
  calculatorScenarios: CalculatorScenario[];
  supportTickets: SupportTicket[];
  referral: ReferralProgram;
  guardianLog: {
    id: string;
    poolId: string;
    at: string;
    event: string;
    action: string;
    result: "paused" | "cleared" | "monitored";
  }[];
  receipts: {
    id: string;
    poolId: string;
    code: string;
    paidAt: string;
    netAmount: number;
    status: "settled";
  }[];
  audit: AuditEntry[];
}

/* ── Derived selectors ── */
export const poolProgress = (raised: number, goal: number) =>
  Math.max(0, Math.min(100, (raised / Math.max(goal, 1)) * 100));
export const daysSince = (iso: string, asOf: string) =>
  Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(iso)) / 86_400_000));
export const unrealizedTotal = (w: InvestorWorkspace) =>
  Number(w.activePools.reduce((sum, p) => sum + p.sharePnl, 0).toFixed(2));
export const monthEarned = (w: InvestorWorkspace) =>
  Number((w.earnings.realizedThisMonth + unrealizedTotal(w)).toFixed(2));
export const monthRoi = (w: InvestorWorkspace) =>
  Number(
    ((monthEarned(w) / Math.max(w.summary.totalInvested, 1)) * 100).toFixed(2),
  );
export const activeInvestment = (w: InvestorWorkspace) =>
  Number(w.activePools.reduce((sum, p) => sum + p.investment, 0).toFixed(2));
export function countdownParts(target: string, from = INVESTOR_AS_OF) {
  const total = Math.max(
    0,
    Math.floor((Date.parse(target) - Date.parse(from)) / 1000),
  );
  return {
    total,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
export const countdownLabel = (target: string, from = INVESTOR_AS_OF) => {
  const c = countdownParts(target, from);
  return c.days > 0
    ? `${c.days}d ${c.hours}h ${c.minutes}m`
    : `${c.hours}h ${c.minutes}m`;
};
export const relativeLabel = (iso: string, asOf = INVESTOR_AS_OF) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(asOf) - Date.parse(iso)) / 60000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
export const statusLabel = (s: string) => s.replaceAll("_", " ");

/* ── Commands (validated, immutable, local-only) ── */
const channelsSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean(),
});
export const preferencesSchema = z.object({
  channels: channelsSchema,
  digest: z.enum(["instant", "daily", "weekly"]),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  autoRefresh: z.boolean(),
});
export const investorCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("refreshEarnings"),
    source: z.enum(["manual", "auto"]),
  }),
  z.object({ kind: z.literal("markRead"), id: z.string().min(1) }),
  z.object({ kind: z.literal("markAllRead") }),
  z.object({
    kind: z.literal("setReminder"),
    poolId: z.string().min(1),
    leadDays: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(7)]),
    channel: z.enum(["email", "in_app"]),
  }),
  z.object({ kind: z.literal("removeReminder"), poolId: z.string().min(1) }),
  z.object({
    kind: z.literal("bookSlot"),
    poolId: z.string().min(1),
    slots: z.number().int().min(1).max(10),
    amount: z.number().min(0).multipleOf(0.01),
  }),
  z.object({
    kind: z.literal("requestPayout"),
    amount: z.number().min(0).multipleOf(0.01),
    methodId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("saveCalculator"),
    principal: z.number().min(500).max(100000).multipleOf(0.01),
    roiPct: z.number().min(1).max(50),
    days: z.number().int().min(1).max(365),
  }),
  z.object({ kind: z.literal("savePreferences"), value: preferencesSchema }),
  z.object({
    kind: z.literal("updateProfile"),
    displayName: z.string().trim().min(2).max(60),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["payout", "pool", "kyc", "account", "other"]),
    message: z.string().trim().min(20).max(1000),
  }),
]);
export type InvestorCommand = z.infer<typeof investorCommandSchema>;

export const payoutIssue = (
  w: InvestorWorkspace,
  amount: number,
  methodId: string,
): string | null => {
  const method = w.wallet.methods.find((m) => m.id === methodId && m.active);
  if (!method) return "Choose an active payout method";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter a payout amount";
  if (amount < method.minAmount)
    return `Minimum payout for ${method.label} is $${method.minAmount.toLocaleString()}`;
  if (amount > w.wallet.available)
    return "Payout cannot exceed the withdrawable balance";
  if (Math.round(amount * 100) !== amount * 100)
    return "Use at most two decimal places";
  return null;
};

export function applyInvestorCommand(
  current: InvestorWorkspace,
  input: InvestorCommand,
  now = "2026-10-23T10:05:00Z",
): InvestorWorkspace {
  const c = investorCommandSchema.parse(input);
  const w = structuredClone(current);
  const push = (action: string, detail: string) => {
    w.audit.unshift({ at: now, action, detail });
    w.audit = w.audit.slice(0, 60);
    w.revision += 1;
  };
  switch (c.kind) {
    case "refreshEarnings": {
      if (!w.preferences.autoRefresh && c.source === "auto")
        throw Error("Automatic refresh is disabled in preferences");
      w.earnings.updatedAt = now;
      w.earnings.nextRefreshIn = 180;
      w.earnings.rows = w.earnings.rows.map((row) => ({
        ...row,
        updatedAt: now,
      }));
      if (c.source === "manual")
        push(
          "refresh_earnings",
          "Manual source refresh requested; provider data unchanged.",
        );
      else w.revision += 1;
      break;
    }
    case "markRead": {
      const notification = w.notifications.find((n) => n.id === c.id);
      const activity = w.activity.find((a) => a.id === c.id);
      if (!notification && !activity) throw Error("Observation not found");
      if (notification) notification.read = true;
      if (activity) activity.read = true;
      push("mark_observation_read", `${c.id} marked read locally.`);
      break;
    }
    case "markAllRead": {
      w.notifications.forEach((n) => (n.read = true));
      w.activity.forEach((a) => (a.read = true));
      push("mark_all_read", "All investor observations marked read locally.");
      break;
    }
    case "setReminder": {
      const pool = w.upcoming.find((p) => p.id === c.poolId);
      if (!pool) throw Error("Upcoming pool not found");
      if (w.reminders.some((r) => r.poolId === c.poolId))
        throw Error("A reminder already exists for this pool");
      const days = Math.ceil(
        (Date.parse(pool.opensAt) - Date.parse(w.asOf)) / 86_400_000,
      );
      if (c.leadDays > days)
        throw Error(
          `Reminder cannot lead by ${c.leadDays} days; the pool opens in ${days} days`,
        );
      w.reminders.push({
        poolId: c.poolId,
        leadDays: c.leadDays,
        channel: c.channel,
        createdAt: now,
      });
      push(
        "set_reminder",
        `${pool.code} reminder prepared locally (${c.leadDays}d, ${c.channel}). No message sent.`,
      );
      break;
    }
    case "removeReminder": {
      if (!w.reminders.some((r) => r.poolId === c.poolId))
        throw Error("Reminder not found");
      w.reminders = w.reminders.filter((r) => r.poolId !== c.poolId);
      push("remove_reminder", "Reminder removed from the local workspace.");
      break;
    }
    case "bookSlot": {
      const pool = w.upcoming.find((p) => p.id === c.poolId);
      if (!pool) throw Error("This pool is not open for booking");
      if (w.bookings.some((b) => b.poolId === c.poolId))
        throw Error("A local booking already exists for this pool");
      const expected = Number((pool.minInvestment * c.slots).toFixed(2));
      if (c.amount !== expected)
        throw Error(
          `Allocation must equal ${c.slots} × $${pool.minInvestment.toLocaleString()}`,
        );
      if (c.amount > pool.capacity)
        throw Error("Requested allocation exceeds remaining capacity");
      w.bookings.push({
        id: `booking_${w.revision + 1}`,
        poolId: c.poolId,
        slots: c.slots,
        amount: c.amount,
        status: "preview_hold",
        createdAt: now,
      });
      push(
        "book_slot_preview",
        `${pool.code}: ${c.slots} slot(s), $${c.amount.toLocaleString()} local hold. No payment captured.`,
      );
      break;
    }
    case "requestPayout": {
      const issue = payoutIssue(w, c.amount, c.methodId);
      if (issue) throw Error(issue);
      w.payoutRequests.push({
        id: `payout_preview_${w.revision + 1}`,
        amount: c.amount,
        methodId: c.methodId,
        status: "preview_waiting_source",
        createdAt: now,
      });
      push(
        "payout_preview",
        `$${c.amount.toFixed(2)} payout draft recorded. Withdrawable balance unchanged; no transfer requested.`,
      );
      break;
    }
    case "saveCalculator": {
      const projectedProfit = Number(
        ((c.principal * c.roiPct) / 100).toFixed(2),
      );
      w.calculatorScenarios.unshift({
        id: `scenario_${w.revision + 1}`,
        principal: c.principal,
        roiPct: c.roiPct,
        days: c.days,
        projectedProfit,
        createdAt: now,
      });
      w.calculatorScenarios = w.calculatorScenarios.slice(0, 10);
      push(
        "save_scenario",
        `Projection saved: $${c.principal.toLocaleString()} at ${c.roiPct}% over ${c.days} days.`,
      );
      break;
    }
    case "savePreferences": {
      const p = preferencesSchema.parse(c.value);
      if (!p.channels.email && !p.channels.push && !p.channels.sms)
        throw Error("Keep at least one notification channel enabled");
      if (p.quietStart === p.quietEnd)
        throw Error("Quiet hours must have different start and end times");
      if (w.payoutRequests.length > 0 && !p.channels.email)
        throw Error("Email is required while a payout draft is pending");
      w.preferences = p;
      push(
        "save_preferences",
        "Notification preferences updated locally; no delivery configuration changed.",
      );
      break;
    }
    case "updateProfile": {
      w.profile.displayName = c.displayName;
      push(
        "update_profile",
        "Display name updated in the local investor workspace; account identity unchanged.",
      );
      break;
    }
    case "support": {
      w.supportTickets.unshift({
        id: `support_${w.revision + 1}`,
        topic: c.topic,
        message: c.message,
        status: "local_draft",
        createdAt: now,
      });
      push(
        "support_draft",
        "Support draft saved locally; no message sent to the operations desk.",
      );
      break;
    }
  }
  return w;
}
