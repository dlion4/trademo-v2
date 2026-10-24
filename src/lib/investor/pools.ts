import { z } from "zod";

/**
 * I-2 · Crowdfunding Pools — structured investor pool browser.
 *
 * Every value here is a source snapshot (`asOf`). Nothing in this module
 * performs a network call, charges a slot, moves money or books capacity; the
 * commands produce an immutable, audited local workspace that a backend can
 * later replace one-for-one with authenticated endpoints.
 */

export const POOLS_AS_OF = "2026-10-23T10:00:00Z";

export type PoolLifecycle = "trading" | "open" | "upcoming" | "completed";
export type PaymentState = "verified" | "pending" | "partial";
export type PayoutState = "completed" | "processing" | "scheduled";
export type RoadmapState = "confirmed" | "planned" | "token";

export interface GuardianSnapshot {
  status: "active" | "watch";
  consecutiveLosses: number;
  maxConsecutiveLosses: number;
  drawdownPct: number;
  drawdownLimitPct: number;
  lastCheckedAt: string;
  note: string;
}

export interface PoolTrade {
  id: string;
  poolId: string;
  symbol: string;
  contract: string;
  stake: number;
  poolPnl: number | null;
  investorShare: number;
  result: "won" | "lost" | "open";
  openedAt: string;
  closedAt: string | null;
}

export interface TradingPool {
  id: string;
  code: string;
  name: string;
  lifecycle: "trading";
  strategy: string;
  markets: string[];
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  goal: number;
  raised: number;
  slotPrice: number;
  slotsFilled: number;
  slotsTotal: number;
  userSlots: number;
  investment: number;
  profitSharePct: number;
  startedAt: string;
  endsAt: string;
  pnl: number;
  sharePnl: number;
  roiPct: number;
  trades: number;
  winRatePct: number;
  guardian: GuardianSnapshot;
  settlementBatch: string;
}

export interface OpenPool {
  id: string;
  code: string;
  name: string;
  lifecycle: "open";
  strategy: string;
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  opensAt: string;
  closesAt: string;
  tradingEndsAt: string;
  minSlot: number;
  maxSlotsPerUser: number;
  durationDays: number;
  expectedRoiPct: number;
  goal: number;
  raised: number;
  bookedSlots: number;
  investment: number;
  payment: PaymentState;
  paymentRef: string | null;
  investors: number;
}

export interface UpcomingPool {
  id: string;
  code: string;
  name: string;
  lifecycle: "upcoming";
  strategy: string;
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  opensAt: string;
  closesAt: string;
  minSlot: number;
  maxSlotsPerUser: number;
  durationDays: number;
  expectedRoiPct: number;
  goal: number;
  expressed: number;
  note: string;
}

export interface CompletedPool {
  id: string;
  code: string;
  name: string;
  lifecycle: "completed";
  strategy: string;
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  startedAt: string;
  completedAt: string;
  userSlots: number;
  investment: number;
  finalRoiPct: number;
  grossEarnings: number;
  platformCutPct: number;
  netEarnings: number;
  payout: PayoutState;
  paidAt: string | null;
  payoutRef: string | null;
  settlement: "closed" | "reconciled";
}

export interface RoadmapMilestone {
  id: string;
  code: string;
  name: string;
  date: string;
  targetCapital: number;
  expectedRoiPct: number;
  state: RoadmapState;
  note: string;
}

export interface PoolReminder {
  poolId: string;
  leadDays: 1 | 2 | 3 | 7;
  channel: "email" | "in_app";
  createdAt: string;
}

export interface PoolBooking {
  id: string;
  poolId: string;
  slots: number;
  amount: number;
  status: "preview_hold";
  createdAt: string;
}

export interface PoolInterest {
  id: string;
  poolId: string;
  slots: number;
  status: "interest_registered";
  createdAt: string;
}

export interface ScenarioRecord {
  id: string;
  principal: number;
  roiPct: number;
  days: number;
  projectedProfit: number;
  createdAt: string;
}

export interface SupportRecord {
  id: string;
  topic: string;
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface PoolAuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface PoolsWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: {
    id: string;
    firstName: string;
    displayName: string;
    investorSince: string;
    tier: string;
    country: string;
    currency: string;
  };
  summary: {
    committed: number;
    activePools: number;
    openPools: number;
    upcomingPools: number;
    completedPools: number;
    lifetimeNet: number;
    wallet: number;
    unread: number;
    monthRoiPct: number;
  };
  trading: TradingPool[];
  open: OpenPool[];
  upcoming: UpcomingPool[];
  completed: CompletedPool[];
  roadmap: RoadmapMilestone[];
  trades: PoolTrade[];
  guardianLog: {
    id: string;
    poolId: string;
    at: string;
    event: string;
    action: string;
    result: string;
  }[];
  reminders: PoolReminder[];
  bookings: PoolBooking[];
  interests: PoolInterest[];
  scenarios: ScenarioRecord[];
  support: SupportRecord[];
  preferences: {
    autoRefresh: boolean;
    alertChannels: { email: boolean; in_app: boolean };
    endingSoonHours: number;
  };
  audit: PoolAuditEntry[];
}

/* ── Derived selectors ── */

export const fillPct = (raised: number, goal: number) =>
  Math.max(0, Math.min(100, (raised / Math.max(goal, 1)) * 100));

export const netOfCut = (gross: number, cutPct: number) =>
  Number((gross * (1 - cutPct / 100)).toFixed(2));

export const hoursUntil = (target: string, asOf = POOLS_AS_OF) =>
  (Date.parse(target) - Date.parse(asOf)) / 3_600_000;

export const endingSoon = (
  endsAt: string,
  asOf = POOLS_AS_OF,
  windowHours = 72,
) => {
  const hours = hoursUntil(endsAt, asOf);
  return hours > 0 && hours <= windowHours;
};

export const bookableSlots = (pool: OpenPool) => {
  const byUser = Math.max(0, pool.maxSlotsPerUser - pool.bookedSlots);
  const byCapacity = Math.floor(
    Math.max(0, pool.goal - pool.raised) / Math.max(pool.minSlot, 1),
  );
  return Math.max(0, Math.min(byUser, byCapacity));
};

export const committedTotal = (w: PoolsWorkspace) =>
  Number(w.trading.reduce((sum, pool) => sum + pool.investment, 0).toFixed(2));

export const lifetimeNet = (w: PoolsWorkspace) =>
  Number(
    w.completed.reduce((sum, pool) => sum + pool.netEarnings, 0).toFixed(2),
  );

export const upcomingByDate = (w: PoolsWorkspace) =>
  [...w.upcoming].sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt));

export const nextMilestone = (w: PoolsWorkspace) =>
  [...w.roadmap]
    .filter((m) => m.state !== "token")
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0] ?? null;

export const reachedRoi = (net: number, invested: number) =>
  Number(((net / Math.max(invested, 1)) * 100).toFixed(2));

export const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));

export const countdown = (target: string, from = POOLS_AS_OF) => {
  const total = Math.max(
    0,
    Math.floor((Date.parse(target) - Date.parse(from)) / 1000),
  );
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return {
    total,
    days,
    hours,
    minutes,
    label: `${days}d ${hours}h ${minutes}m`,
  };
};

export const relativeFrom = (iso: string, asOf = POOLS_AS_OF) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(asOf) - Date.parse(iso)) / 60000),
  );
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
};

/* ── Commands ── */

const reminderLead = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(7),
]);

export const poolsCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("refreshPools"),
    source: z.enum(["manual", "auto"]),
  }),
  z.object({
    kind: z.literal("bookSlots"),
    poolId: z.string().min(1),
    slots: z.number().int().min(1).max(10),
  }),
  z.object({
    kind: z.literal("setReminder"),
    poolId: z.string().min(1),
    leadDays: reminderLead,
    channel: z.enum(["email", "in_app"]),
  }),
  z.object({ kind: z.literal("removeReminder"), poolId: z.string().min(1) }),
  z.object({
    kind: z.literal("prebookInterest"),
    poolId: z.string().min(1),
    slots: z.number().int().min(1).max(25),
  }),
  z.object({
    kind: z.literal("saveScenario"),
    principal: z.number().min(500).max(100000),
    roiPct: z.number().min(1).max(50),
    days: z.number().int().min(1).max(365),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["pool", "payment", "payout", "kyc", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
  z.object({
    kind: z.literal("recordExport"),
    scope: z.enum(["pool-summary", "completed-history", "roadmap"]),
    format: z.enum(["json", "csv", "pdf"]),
    count: z.number().int().min(0).max(500),
  }),
]);

export type PoolsCommand = z.infer<typeof poolsCommandSchema>;

export function applyPoolsCommand(
  current: PoolsWorkspace,
  input: PoolsCommand,
  now = "2026-10-23T10:05:00Z",
): PoolsWorkspace {
  const parsed = poolsCommandSchema.parse(input);
  const w = structuredClone(current);
  const audit = (action: string, detail: string) => {
    w.audit = [
      {
        id: `pool_audit_${w.revision + 1}_${w.audit.length + 1}`,
        at: now,
        action,
        detail,
      },
      ...w.audit,
    ].slice(0, 40);
  };

  switch (parsed.kind) {
    case "refreshPools": {
      if (parsed.source === "auto" && !w.preferences.autoRefresh)
        throw new Error("Automatic refresh is disabled in preferences");
      w.revision += 1;
      if (parsed.source === "manual")
        audit(
          "pools_refresh",
          "Manual pool refresh requested; source snapshot unchanged.",
        );
      return w;
    }
    case "bookSlots": {
      const pool = w.open.find((p) => p.id === parsed.poolId);
      if (!pool) throw new Error("This pool is not accepting bookings");
      if (Date.parse(pool.closesAt) <= Date.parse(w.asOf))
        throw new Error("Booking window has closed for this pool");
      const available = bookableSlots(pool);
      if (parsed.slots > available)
        throw new Error(
          available === 0
            ? "No slots remain within your per-investor limit"
            : `Only ${available} slot(s) remain for your allocation`,
        );
      const amount = Number((pool.minSlot * parsed.slots).toFixed(2));
      const nextRaised = Number((pool.raised + amount).toFixed(2));
      if (nextRaised > pool.goal)
        throw new Error(
          "Requested allocation exceeds the remaining target capital",
        );
      pool.bookedSlots += parsed.slots;
      pool.investment = Number((pool.investment + amount).toFixed(2));
      pool.raised = nextRaised;
      pool.payment = "pending";
      w.bookings.unshift({
        id: `booking_${w.revision + 1}`,
        poolId: pool.id,
        slots: parsed.slots,
        amount,
        status: "preview_hold",
        createdAt: now,
      });
      w.summary.openPools = w.open.length;
      audit(
        "book_slots_preview",
        `${pool.code}: ${parsed.slots} slot(s) held locally for $${amount.toLocaleString()}. Payment verification is required before the slot is confirmed.`,
      );
      break;
    }
    case "setReminder": {
      const pool = w.upcoming.find((p) => p.id === parsed.poolId);
      if (!pool) throw new Error("Upcoming pool not found");
      if (w.reminders.some((r) => r.poolId === pool.id))
        throw new Error("A reminder already exists for this pool");
      const days = Math.ceil(hoursUntil(pool.opensAt, w.asOf) / 24);
      if (parsed.leadDays > days)
        throw new Error(
          `Reminder cannot lead by ${parsed.leadDays} days; the pool opens in ${days} days`,
        );
      w.reminders.push({
        poolId: pool.id,
        leadDays: parsed.leadDays,
        channel: parsed.channel,
        createdAt: now,
      });
      audit(
        "set_reminder",
        `${pool.code} reminder prepared locally (${parsed.leadDays}d, ${parsed.channel}). No message sent.`,
      );
      break;
    }
    case "removeReminder": {
      if (!w.reminders.some((r) => r.poolId === parsed.poolId))
        throw new Error("Reminder not found");
      w.reminders = w.reminders.filter((r) => r.poolId !== parsed.poolId);
      audit("remove_reminder", "Reminder removed from the local workspace.");
      break;
    }
    case "prebookInterest": {
      const pool = w.upcoming.find((p) => p.id === parsed.poolId);
      if (!pool) throw new Error("Upcoming pool not found");
      if (w.interests.some((i) => i.poolId === pool.id))
        throw new Error("Interest is already registered for this pool");
      if (parsed.slots > pool.maxSlotsPerUser)
        throw new Error(
          `Maximum ${pool.maxSlotsPerUser} slots per investor for this pool`,
        );
      w.interests.unshift({
        id: `interest_${w.revision + 1}`,
        poolId: pool.id,
        slots: parsed.slots,
        status: "interest_registered",
        createdAt: now,
      });
      pool.expressed = Number(
        (pool.expressed + parsed.slots * pool.minSlot).toFixed(2),
      );
      audit(
        "prebook_interest",
        `${pool.code}: interest for ${parsed.slots} slot(s) registered locally. No capital reserved.`,
      );
      break;
    }
    case "saveScenario": {
      const projectedProfit = Number(
        ((parsed.principal * parsed.roiPct) / 100).toFixed(2),
      );
      w.scenarios.unshift({
        id: `scenario_${w.revision + 1}`,
        principal: parsed.principal,
        roiPct: parsed.roiPct,
        days: parsed.days,
        projectedProfit,
        createdAt: now,
      });
      w.scenarios = w.scenarios.slice(0, 10);
      audit(
        "save_projection",
        `Projection saved locally: $${parsed.principal.toLocaleString()} at ${parsed.roiPct}% over ${parsed.days} days.`,
      );
      break;
    }
    case "support": {
      w.support.unshift({
        id: `support_${w.revision + 1}`,
        topic: parsed.topic,
        message: parsed.message,
        status: "local_draft",
        createdAt: now,
      });
      audit(
        "support_draft",
        "Support draft saved locally; no message was transmitted.",
      );
      break;
    }
    case "recordExport": {
      audit(
        "export_prepared",
        `${parsed.scope} exported as ${parsed.format.toUpperCase()} (${parsed.count} record(s)). Generated in-browser only.`,
      );
      break;
    }
  }

  return w;
}
