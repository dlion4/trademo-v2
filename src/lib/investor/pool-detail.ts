import { z } from "zod";

/**
 * I-3 · Pool Detail — structured single-pool workspace.
 *
 * The detail page reads one `PoolDetailWorkspace` per pool. Every figure is a
 * source snapshot (`asOf`); commands are validated, applied to a structured
 * clone and audited. Nothing here books capacity, charges a card, sends a
 * message or releases a payout — a backend can replace each command with an
 * authenticated endpoint without touching the view layer.
 */

export const POOL_DETAIL_AS_OF = "2026-10-23T10:00:00Z";

export type DetailLifecycle = "trading" | "open" | "upcoming" | "completed";
export type GuardianStatus = "active" | "watch" | "standby";
export type PayoutMethod = "bank" | "usdt";

/* ── Overview ── */

export interface PoolGuardianSummary {
  status: GuardianStatus;
  consecutiveLosses: number;
  maxConsecutiveLosses: number;
  drawdownPct: number;
  drawdownLimitPct: number;
  lastCheckedAt: string;
  note: string;
}

export interface PoolOverview {
  id: string;
  code: string;
  name: string;
  lifecycle: DetailLifecycle;
  strategy: string;
  thesis: string;
  markets: string[];
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  manager: string;
  launchedAt: string;
  bookingOpensAt: string;
  bookingClosesAt: string;
  tradingStartsAt: string;
  tradingEndsAt: string;
  profitShareAt: string | null;
  goal: number;
  raised: number;
  slotPrice: number;
  slotsTotal: number;
  slotsFilled: number;
  investors: number;
  profitSharePct: number;
  settlementBatch: string;
  currency: string;
  guardian: PoolGuardianSummary;
}

/* ── Your investment ── */

export interface EarningsDay {
  date: string;
  gross: number;
  net: number;
}

export interface PoolInvestment {
  slots: number;
  investment: number;
  sharePct: number;
  tokens: number;
  tokenSymbol: string;
  pnl: number;
  grossEarnings: number;
  platformCutPct: number;
  platformCut: number;
  netEarnings: number;
  roiPct: number;
  paidOut: number;
  pendingPayout: number;
  lastUpdatedAt: string;
  refreshSeconds: number;
  daily: EarningsDay[];
}

export interface PoolBooking {
  slots: number;
  amount: number;
  payment: "verified" | "pending" | "partial";
  reference: string | null;
  bookedAt: string;
  available: number;
  note: string;
}

export interface PoolInterest {
  slots: number;
  amount: number;
  channel: "email" | "in_app";
  registeredAt: string;
  note: string;
}

export interface PoolProjection {
  basis: "expected" | "realized";
  roiPct: number;
  onAmount: number;
  projectedProfit: number;
  days: number;
  note: string;
}

/* ── Performance ── */

export interface PoolTrade {
  id: string;
  symbol: string;
  contract: string;
  stake: number;
  poolPnl: number | null;
  investorShare: number;
  result: "won" | "lost" | "open";
  openedAt: string;
  closedAt: string | null;
  durationSec: number | null;
}

export interface CurvePoint {
  at: string;
  value: number;
}

export interface TradeExtreme {
  id: string;
  symbol: string;
  pnl: number;
  share: number;
  at: string;
}

export interface PoolPerformance {
  totalPnl: number;
  wins: number;
  losses: number;
  trades: number;
  openTrades: number;
  winRatePct: number;
  maxDrawdownPct: number;
  maxDrawdownAt: string;
  guardianTriggers: number;
  recoveredInLabel: string;
  avgTradeDurationSec: number;
  best: TradeExtreme;
  worst: TradeExtreme;
  curve: CurvePoint[];
  benchmarks: { label: string; value: string; hint: string }[];
}

/* ── Guardian ── */

export interface GuardianEvent {
  id: string;
  at: string;
  kind: "trigger" | "check" | "config" | "resume";
  title: string;
  detail: string;
  outcome: string;
  durationMin: number | null;
}

export interface PoolGuardianDetail extends PoolGuardianSummary {
  rotation: boolean;
  triggersTotal: number;
  recoveredLabel: string;
  events: GuardianEvent[];
}

/* ── Participants ── */

export interface ParticipantRow {
  id: string;
  rank: number;
  alias: string;
  slots: number;
  investment: number;
  sharePct: number;
  isYou: boolean;
}

export interface ParticipantBand {
  label: string;
  count: number;
  investment: number;
  sharePct: number;
}

export interface PoolParticipants {
  totalParticipants: number;
  slotsFilled: number;
  slotsTotal: number;
  avgInvestment: number;
  committed: number;
  showRows: boolean;
  rows: ParticipantRow[];
  tail: { count: number; slots: number; investment: number } | null;
  bands: ParticipantBand[];
  note: string;
}

/* ── Supporting records ── */

export interface DetailEvent {
  id: string;
  at: string;
  kind: "guardian" | "settlement" | "booking" | "payout" | "pool" | "local";
  title: string;
  detail: string;
}

export interface DetailDocument {
  id: string;
  name: string;
  kind: "factsheet" | "policy" | "statement" | "ledger";
  format: "pdf" | "csv" | "json";
  sizeLabel: string;
  updatedAt: string;
  scope: "pool" | "investor";
}

export interface ScheduleStep {
  id: string;
  label: string;
  at: string;
  state: "done" | "current" | "next";
  note: string;
}

export interface RelatedPool {
  id: string;
  code: string;
  name: string;
  lifecycle: DetailLifecycle;
  goal: number;
  expectedRoiPct: number;
  relation: string;
}

export interface PayoutDraft {
  id: string;
  amount: number;
  method: PayoutMethod;
  status: "draft";
  createdAt: string;
}

export interface ProjectionRecord {
  id: string;
  principal: number;
  roiPct: number;
  days: number;
  projectedProfit: number;
  createdAt: string;
}

export interface ReminderRecord {
  leadDays: 1 | 2 | 3 | 7;
  channel: "email" | "in_app";
  createdAt: string;
}

export interface SupportRecord {
  id: string;
  topic: "pool" | "payment" | "payout" | "kyc" | "other";
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface DetailAuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface PoolDetailWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  poolId: string;
  profile: {
    id: string;
    displayName: string;
    investorSince: string;
    tier: string;
    country: string;
    currency: string;
    wallet: number;
    unread: number;
    monthRoiPct: number;
    committed: number;
  };
  overview: PoolOverview;
  investment: PoolInvestment | null;
  booking: PoolBooking | null;
  interest: PoolInterest | null;
  projection: PoolProjection | null;
  performance: PoolPerformance | null;
  guardian: PoolGuardianDetail;
  participants: PoolParticipants;
  trades: PoolTrade[];
  events: DetailEvent[];
  documents: DetailDocument[];
  schedule: ScheduleStep[];
  related: RelatedPool[];
  watching: boolean;
  preferences: {
    email: boolean;
    in_app: boolean;
    endingSoonHours: 24 | 48 | 72;
    autoRefresh: boolean;
  };
  reminders: ReminderRecord[];
  payouts: PayoutDraft[];
  projections: ProjectionRecord[];
  support: SupportRecord[];
  audit: DetailAuditEntry[];
}

/* ── Selectors ── */

export const detailFillPct = (raised: number, goal: number) =>
  Math.max(0, Math.min(100, (raised / Math.max(goal, 1)) * 100));

/** Share of the pool's booked capital held by the investor. */
export const capitalSharePct = (investment: number, raised: number) =>
  Number(((investment / Math.max(raised, 1)) * 100).toFixed(1));

/** Elapsed portion of the trading window at the snapshot time. */
export const tradingElapsedPct = (
  startsAt: string,
  endsAt: string,
  asOf = POOL_DETAIL_AS_OF,
) => {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (end <= start) return 100;
  const pct = ((Date.parse(asOf) - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, Number(pct.toFixed(1))));
};

export const hoursUntil = (target: string, asOf = POOL_DETAIL_AS_OF) =>
  (Date.parse(target) - Date.parse(asOf)) / 3_600_000;

export const countdownFrom = (target: string, from = POOL_DETAIL_AS_OF) => {
  const total = Math.max(
    0,
    Math.floor((Date.parse(target) - Date.parse(from)) / 1000),
  );
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return {
    total,
    days,
    hours,
    minutes,
    seconds,
    label: `${days}d ${hours}h ${minutes}m`,
    clock: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
};

export const relativeTo = (iso: string, asOf = POOL_DETAIL_AS_OF) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(asOf) - Date.parse(iso)) / 60000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
};

export const sumDaily = (days: EarningsDay[]) =>
  Number(days.reduce((sum, day) => sum + day.gross, 0).toFixed(2));

export const roiOn = (amount: number, gain: number) =>
  Number(((gain / Math.max(amount, 1)) * 100).toFixed(2));

export const drawdownHeadroom = (current: number, limit: number) =>
  Number((limit - current).toFixed(2));

export const durationLabel = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

/** Capital still withdrawable after paid and drafted amounts. */
export const withdrawableNet = (investment: PoolInvestment | null) =>
  investment
    ? Number(
        Math.max(
          0,
          investment.netEarnings -
            investment.paidOut -
            investment.pendingPayout,
        ).toFixed(2),
      )
    : 0;

/* ── Commands ── */

const reminderLead = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(7),
]);

export const poolDetailCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("refreshDetail"),
    source: z.enum(["manual", "auto"]),
  }),
  z.object({
    kind: z.literal("bookSlots"),
    slots: z.number().int().min(1).max(10),
  }),
  z.object({
    kind: z.literal("draftPayout"),
    amount: z.number().min(100).max(100000),
    method: z.enum(["bank", "usdt"]),
  }),
  z.object({
    kind: z.literal("setReminder"),
    leadDays: reminderLead,
    channel: z.enum(["email", "in_app"]),
  }),
  z.object({
    kind: z.literal("saveProjection"),
    principal: z.number().min(500).max(100000),
    roiPct: z.number().min(1).max(50),
    days: z.number().int().min(1).max(365),
  }),
  z.object({
    kind: z.literal("savePreferences"),
    email: z.boolean(),
    inApp: z.boolean(),
    endingSoonHours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
  }),
  z.object({
    kind: z.literal("prebookInterest"),
    slots: z.number().int().min(1).max(25),
  }),
  z.object({ kind: z.literal("setWatch"), watching: z.boolean() }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["pool", "payment", "payout", "kyc", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
  z.object({
    kind: z.literal("recordExport"),
    scope: z.enum([
      "pool-statement",
      "daily-earnings",
      "trade-ledger",
      "participants",
    ]),
    format: z.enum(["json", "csv", "pdf"]),
    count: z.number().int().min(0).max(500),
  }),
]);

export type PoolDetailCommand = z.infer<typeof poolDetailCommandSchema>;

export function applyPoolDetailCommand(
  current: PoolDetailWorkspace,
  input: PoolDetailCommand,
  now = "2026-10-23T10:05:00Z",
): PoolDetailWorkspace {
  const parsed = poolDetailCommandSchema.parse(input);
  const w = structuredClone(current);
  const audit = (action: string, detail: string) => {
    w.revision += 1;
    w.audit = [
      {
        id: `pool_detail_audit_${w.revision}_${w.audit.length + 1}`,
        at: now,
        action,
        detail,
      },
      ...w.audit,
    ].slice(0, 40);
  };

  switch (parsed.kind) {
    case "refreshDetail": {
      if (parsed.source === "auto" && !w.preferences.autoRefresh)
        throw new Error("Automatic refresh is disabled in pool preferences");
      if (parsed.source === "manual")
        audit(
          "pool_detail_refresh",
          `${w.overview.code} snapshot re-read; provider figures unchanged.`,
        );
      else w.revision += 1;
      return w;
    }
    case "bookSlots": {
      if (w.overview.lifecycle !== "open")
        throw new Error(
          w.overview.lifecycle === "trading"
            ? "This pool is already trading; additional slots open with the next cycle"
            : w.overview.lifecycle === "upcoming"
              ? "Booking opens when the funding window starts"
              : "This cycle has closed and cannot accept bookings",
        );
      const available = w.booking?.available ?? 0;
      if (available <= 0)
        throw new Error("No slots remain within your per-investor limit");
      if (parsed.slots > available)
        throw new Error(
          `Only ${available} slot(s) remain for your allocation in this pool`,
        );
      const amount = Number((parsed.slots * w.overview.slotPrice).toFixed(2));
      const nextRaised = Number((w.overview.raised + amount).toFixed(2));
      if (nextRaised > w.overview.goal)
        throw new Error("Requested allocation exceeds the remaining target");
      const slots = (w.booking?.slots ?? 0) + parsed.slots;
      const previous = w.booking?.amount ?? 0;
      w.booking = {
        slots,
        amount: Number((previous + amount).toFixed(2)),
        payment: "pending",
        reference: w.booking?.reference ?? null,
        bookedAt: now,
        available: Math.max(0, available - parsed.slots),
        note: "Held locally for review. Payment verification is required before the funding desk confirms the slot.",
      };
      w.overview.raised = nextRaised;
      w.overview.slotsFilled = w.overview.slotsFilled + parsed.slots;
      audit(
        "book_slots_preview",
        `${w.overview.code}: ${parsed.slots} slot(s) held locally for $${amount.toLocaleString()}. Payment verification pending.`,
      );
      break;
    }
    case "draftPayout": {
      const available = withdrawableNet(w.investment);
      if (!w.investment || available <= 0)
        throw new Error(
          "This pool has no settled net earnings available for a payout",
        );
      if (parsed.amount > available)
        throw new Error(
          `Only $${available.toFixed(2)} is available from this pool`,
        );
      w.payouts.unshift({
        id: `payout_draft_${w.revision + 1}`,
        amount: Number(parsed.amount.toFixed(2)),
        method: parsed.method,
        status: "draft",
        createdAt: now,
      });
      w.investment.pendingPayout = Number(
        (w.investment.pendingPayout + parsed.amount).toFixed(2),
      );
      audit(
        "payout_draft",
        `$${parsed.amount.toFixed(2)} ${parsed.method} payout drafted locally against ${w.overview.code}. No transfer was initiated.`,
      );
      break;
    }
    case "setReminder": {
      if (w.overview.lifecycle === "completed")
        throw new Error(
          "This cycle is closed; reminders apply to open windows",
        );
      if (w.reminders.some((r) => r.leadDays === parsed.leadDays))
        throw new Error("A reminder already exists for this lead time");
      const target =
        w.overview.lifecycle === "upcoming"
          ? w.overview.bookingOpensAt
          : w.overview.bookingClosesAt;
      const days = Math.ceil(hoursUntil(target, w.asOf) / 24);
      if (parsed.leadDays > days)
        throw new Error(
          `A ${parsed.leadDays}-day reminder does not fit the ${days}-day window`,
        );
      w.reminders.push({
        leadDays: parsed.leadDays,
        channel: parsed.channel,
        createdAt: now,
      });
      audit(
        "set_reminder",
        `${parsed.leadDays}-day ${parsed.channel} reminder prepared locally for ${w.overview.code}. No message was sent.`,
      );
      break;
    }
    case "saveProjection": {
      const projectedProfit = Number(
        ((parsed.principal * parsed.roiPct) / 100).toFixed(2),
      );
      w.projections.unshift({
        id: `projection_${w.revision + 1}`,
        principal: parsed.principal,
        roiPct: parsed.roiPct,
        days: parsed.days,
        projectedProfit,
        createdAt: now,
      });
      w.projections = w.projections.slice(0, 10);
      audit(
        "save_projection",
        `Projection saved locally: $${parsed.principal.toLocaleString()} at ${parsed.roiPct}% over ${parsed.days} days.`,
      );
      break;
    }
    case "savePreferences": {
      if (!parsed.email && !parsed.inApp)
        throw new Error("Keep at least one delivery channel enabled");
      w.preferences = {
        ...w.preferences,
        email: parsed.email,
        in_app: parsed.inApp,
        endingSoonHours: parsed.endingSoonHours,
      };
      audit(
        "save_preferences",
        `Pool alerts stored locally: ${[
          parsed.email ? "email" : null,
          parsed.inApp ? "in-app" : null,
        ]
          .filter(Boolean)
          .join(" + ")} · ${parsed.endingSoonHours}h ending-soon window.`,
      );
      break;
    }
    case "prebookInterest": {
      if (w.overview.lifecycle !== "upcoming")
        throw new Error(
          w.overview.lifecycle === "open"
            ? "This pool is open for bookings — reserve slots instead of registering interest"
            : "Interest registration applies to pools that have not opened yet",
        );
      if (w.interest)
        throw new Error("Interest is already registered for this pool");
      const maxSlots = Math.max(
        1,
        Math.floor(w.overview.slotsTotal / Math.max(w.overview.investors, 1)),
      );
      if (parsed.slots > maxSlots)
        throw new Error(
          `Maximum ${maxSlots} slot(s) per investor for this pool`,
        );
      const amount = Number((parsed.slots * w.overview.slotPrice).toFixed(2));
      const next = Number((w.overview.raised + amount).toFixed(2));
      if (next > w.overview.goal)
        throw new Error(
          "Requested interest exceeds the remaining target capital",
        );
      w.interest = {
        slots: parsed.slots,
        amount,
        channel: "email",
        registeredAt: now,
        note: "Non-binding expression of interest. No capital is reserved until the pool opens and payment clears.",
      };
      w.overview.raised = next;
      w.overview.slotsFilled += parsed.slots;
      audit(
        "prebook_interest",
        `${w.overview.code}: interest for ${parsed.slots} slot(s) registered locally. No capital reserved.`,
      );
      break;
    }
    case "setWatch": {
      w.watching = parsed.watching;
      audit(
        parsed.watching ? "watch_pool" : "unwatch_pool",
        parsed.watching
          ? `${w.overview.code} added to the local watchlist.`
          : `${w.overview.code} removed from the local watchlist.`,
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
