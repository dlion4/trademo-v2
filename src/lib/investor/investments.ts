import { z } from "zod";

/**
 * I-6 · My Investments — every position the investor holds, across every pool.
 *
 * The workspace is derived from the shared pool book (I-2 / I-3 / I-4 / I-5):
 * active positions carry the pool's slot price, investor share and net P&L;
 * completed positions carry the settled cycle; booked slots carry the pending
 * bookings and registered interest. This module adds what only a holdings page
 * needs — payout requests, statements, documents, notes and one chronological
 * timeline — and never invents a figure the pool pages disagree with.
 *
 * `applyInvestmentsCommand` is the reducer a backend would replace: it validates
 * a discriminated union and returns an immutable, audited clone. Nothing here
 * calls a payout provider, charges a card or transfers money.
 */

export const INVESTMENTS_AS_OF = "2026-10-23T10:00:00Z";
export const PLATFORM_CUT_PCT = 20;
export const PAYOUT_LOCK_DAYS = 10;
export const MIN_PAYOUT = 50;
export const TIMELINE_LIMIT = 50;

export type InvestmentStage = "active" | "completed" | "booked" | "interest";
export type PaymentStatus = "verified" | "pending" | "partial" | "not_required";
export type PayoutStatus = "paid" | "processing" | "scheduled" | "cancelled";
export type PayoutMethod = "bank" | "wallet";
export type TimelineKind =
  | "trade"
  | "payout"
  | "pool"
  | "booking"
  | "interest"
  | "kyc"
  | "account"
  | "milestone";

export interface InvestmentsProfile {
  id: string;
  displayName: string;
  investorSince: string;
  kycLevel: "L1" | "L2" | "L3";
  kycVerifiedAt: string;
  country: string;
  currency: string;
  tier: string;
  wallet: number;
  unread: number;
  monthRoiPct: number;
  committed: number;
  bankAccount: string;
}

export interface InvestmentSummary {
  totalInvested: number;
  positionCount: number;
  activeCapital: number;
  activePools: number;
  totalEarned: number;
  completedCapital: number;
  completedCount: number;
  completedNet: number;
  bookedCapital: number;
  bookedCount: number;
  interestCapital: number;
  interestCount: number;
  pendingPayoutAmount: number;
  pendingPayoutCount: number;
  paidPayoutAmount: number;
  deployedCapital: number;
  overallRoiPct: number;
}

export interface ActiveInvestment {
  id: string;
  poolId: string;
  code: string;
  name: string;
  stage: "active";
  lifecycle: "trading";
  strategy: string;
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  slots: number;
  slotPrice: number;
  investment: number;
  sharePct: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paymentRef: string;
  paidAt: string;
  currentValue: number;
  netEarned: number;
  grossEarned: number;
  platformCut: number;
  roiPct: number;
  poolPnl: number;
  poolRoiPct: number;
  poolTrades: number;
  poolWinRatePct: number;
  startedAt: string;
  endsAt: string;
  settlementBatch: string;
  guardianLevel: "ok" | "watch" | "alert";
  guardianNote: string;
  requestedPayout: number;
  availablePayout: number;
  payoutEligibleAt: string;
  payoutEligible: boolean;
  poolHref: string;
  liveHref: string;
  bookHref: string;
}

export interface CompletedInvestment {
  id: string;
  poolId: string;
  code: string;
  name: string;
  stage: "completed";
  slots: number;
  investment: number;
  sharePct: number;
  startedAt: string;
  completedAt: string;
  daysHeld: number;
  grossEarnings: number;
  platformCut: number;
  netEarnings: number;
  userRoiPct: number;
  payoutStatus: PayoutStatus;
  paidAt: string | null;
  payoutRef: string;
  settlement: "closed" | "reconciled";
  statementRef: string;
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
}

export interface BookedSlot {
  id: string;
  poolId: string;
  code: string;
  name: string;
  stage: "booked" | "interest";
  lifecycle: "open" | "upcoming";
  slots: number;
  slotPrice: number;
  amount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paymentRef: string | null;
  bookedAt: string;
  closesAt: string;
  tradingStartsAt: string;
  slotsRemaining: number;
  reminder: { leadDays: 1 | 2 | 3 | 7; channel: "email" | "in_app" } | null;
  note: string;
}

export interface PayoutRecord {
  id: string;
  poolId: string;
  poolCode: string;
  amount: number;
  fee: number;
  net: number;
  method: PayoutMethod;
  destination: string;
  status: PayoutStatus;
  requestedAt: string;
  expectedAt: string;
  processedAt: string | null;
  reference: string;
  note: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  detail: string;
  amount: number | null;
  poolCode: string | null;
  status: "settled" | "processing" | "scheduled" | "informational";
  investmentId: string | null;
}

export interface InvestmentDocument {
  id: string;
  title: string;
  kind: "statement" | "receipt" | "payout" | "kyc";
  poolCode: string;
  period: string;
  sizeKb: number;
  createdAt: string;
}

export interface InvestmentNote {
  id: string;
  investmentId: string;
  poolCode: string;
  body: string;
  createdAt: string;
}

export interface InvestmentsExport {
  id: string;
  scope: "statement" | "portfolio" | "timeline" | "payouts";
  format: "pdf" | "csv" | "json";
  count: number;
  investmentId: string | null;
  createdAt: string;
}

export interface InvestmentsSupport {
  id: string;
  topic: "payout" | "statement" | "booking" | "kyc" | "other";
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface InvestmentsAuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface InvestmentsFilters {
  kinds: TimelineKind[];
  query: string;
}

export interface InvestmentsPreferences {
  emailStatements: boolean;
  autoReinvest: boolean;
  payoutLeadDays: 1 | 2 | 3 | 7;
  reminderChannel: "email" | "in_app";
  hideCompleted: boolean;
}

export interface InvestmentAllocation {
  poolCode: string;
  name: string;
  stage: InvestmentStage;
  amount: number;
  sharePct: number;
}

export interface InvestmentsWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: InvestmentsProfile;
  summary: InvestmentSummary;
  active: ActiveInvestment[];
  completed: CompletedInvestment[];
  booked: BookedSlot[];
  payouts: PayoutRecord[];
  timeline: TimelineEvent[];
  documents: InvestmentDocument[];
  notes: InvestmentNote[];
  allocations: InvestmentAllocation[];
  kyc: {
    level: "L1" | "L2" | "L3";
    verifiedAt: string;
    nextLevel: string;
    nextLevelRequirement: string;
    limits: { label: string; value: string }[];
  };
  payoutPolicy: { id: string; label: string; detail: string }[];
  milestones: {
    id: string;
    code: string;
    name: string;
    date: string;
    expectedRoiPct: number;
    state: "confirmed" | "planned";
  }[];
  filters: InvestmentsFilters;
  preferences: InvestmentsPreferences;
  exports: InvestmentsExport[];
  support: InvestmentsSupport[];
  audit: InvestmentsAuditEntry[];
}

/* ── Formatting ── */

export const round2 = (value: number) => {
  const rounded = Number(value.toFixed(2));
  return rounded === 0 ? 0 : rounded;
};

export const money = (value: number, decimals = 0) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const signedMoney = (value: number, decimals = 0) =>
  value === 0
    ? money(0, decimals)
    : `${value > 0 ? "+" : "−"}${money(Math.abs(value), decimals)}`;

export const signedPct = (value: number, decimals = 2) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(decimals)}%`;

export const grossOfNet = (net: number, cutPct = PLATFORM_CUT_PCT) =>
  round2(net / (1 - cutPct / 100));

export const netOfGross = (gross: number, cutPct = PLATFORM_CUT_PCT) =>
  round2(gross * (1 - cutPct / 100));

export const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const shortDateOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

export const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });

export const atStamp = (iso: string) => `${dateOf(iso)} · ${clockOf(iso)} UTC`;
export const dayStamp = (iso: string) => `${dateOf(iso)}`;

export const stageLabel = (stage: InvestmentStage) =>
  stage === "active"
    ? "Trading"
    : stage === "completed"
      ? "Completed"
      : stage === "booked"
        ? "Booked"
        : "Interest";

export const paymentLabel = (status: PaymentStatus) =>
  status === "verified"
    ? "Verified"
    : status === "pending"
      ? "Pending"
      : status === "partial"
        ? "Part paid"
        : "Not required";

export const payoutLabel = (status: PayoutStatus) =>
  status === "paid"
    ? "Paid"
    : status === "processing"
      ? "Processing"
      : status === "scheduled"
        ? "Scheduled"
        : "Cancelled";

export const timelineLabel = (kind: TimelineKind) =>
  kind === "trade"
    ? "Trade"
    : kind === "payout"
      ? "Payout"
      : kind === "pool"
        ? "Pool"
        : kind === "booking"
          ? "Booking"
          : kind === "interest"
            ? "Interest"
            : kind === "kyc"
              ? "KYC"
              : kind === "account"
                ? "Account"
                : "Milestone";

export const timelineKinds: TimelineKind[] = [
  "trade",
  "payout",
  "pool",
  "booking",
  "interest",
  "kyc",
  "account",
  "milestone",
];

/* ── Time helpers ── */

export const secondsUntil = (target: string, from = INVESTMENTS_AS_OF) =>
  Math.max(0, Math.floor((Date.parse(target) - Date.parse(from)) / 1000));

export const countdown = (target: string, from = INVESTMENTS_AS_OF) => {
  const total = secondsUntil(target, from);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return {
    total,
    label: days ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`,
    clock: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    urgent: total > 0 && total < 86_400,
    days,
  };
};

export const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));

/* ── Selectors ── */

export function computeSummary(
  workspace: Pick<
    InvestmentsWorkspace,
    "active" | "completed" | "booked" | "payouts"
  >,
  asOf = INVESTMENTS_AS_OF,
): InvestmentSummary {
  const activeCapital = round2(
    workspace.active.reduce((sum, row) => sum + row.investment, 0),
  );
  const completedCapital = round2(
    workspace.completed.reduce((sum, row) => sum + row.investment, 0),
  );
  const booked = workspace.booked.filter((row) => row.stage === "booked");
  const interest = workspace.booked.filter((row) => row.stage === "interest");
  const bookedCapital = round2(
    booked.reduce((sum, row) => sum + row.amount, 0),
  );
  const interestCapital = round2(
    interest.reduce((sum, row) => sum + row.amount, 0),
  );
  const completedNet = round2(
    workspace.completed.reduce((sum, row) => sum + row.netEarnings, 0),
  );
  const activeNet = round2(
    workspace.active.reduce((sum, row) => sum + row.netEarned, 0),
  );
  const pending = workspace.payouts.filter(
    (row) => row.status === "processing" || row.status === "scheduled",
  );
  const paid = workspace.payouts.filter((row) => row.status === "paid");
  const deployedCapital = round2(activeCapital + completedCapital);
  const totalEarned = round2(completedNet + activeNet);
  void asOf;

  return {
    totalInvested: round2(activeCapital + completedCapital + bookedCapital),
    positionCount:
      workspace.active.length +
      workspace.completed.length +
      booked.length +
      interest.length,
    activeCapital,
    activePools: workspace.active.length,
    totalEarned,
    completedCapital,
    completedCount: workspace.completed.length,
    completedNet,
    bookedCapital,
    bookedCount: booked.length,
    interestCapital,
    interestCount: interest.length,
    pendingPayoutAmount: round2(pending.reduce((sum, row) => sum + row.net, 0)),
    pendingPayoutCount: pending.length,
    paidPayoutAmount: round2(paid.reduce((sum, row) => sum + row.net, 0)),
    deployedCapital,
    overallRoiPct: deployedCapital
      ? Number(((totalEarned / deployedCapital) * 100).toFixed(2))
      : 0,
  };
}

export const activeByHref = (workspace: InvestmentsWorkspace, id: string) =>
  workspace.active.find((row) => row.id === id || row.poolId === id) ?? null;

export const completedById = (workspace: InvestmentsWorkspace, id: string) =>
  workspace.completed.find((row) => row.id === id || row.poolId === id) ?? null;

export const bookedById = (workspace: InvestmentsWorkspace, id: string) =>
  workspace.booked.find((row) => row.id === id || row.poolId === id) ?? null;

/** Interim payouts unlock once a pool has traded for the lock period. */
export function payoutEligibility(
  row: Pick<ActiveInvestment, "startedAt" | "netEarned" | "requestedPayout">,
  asOf = INVESTMENTS_AS_OF,
) {
  const unlockAt = new Date(
    Date.parse(row.startedAt) + PAYOUT_LOCK_DAYS * 86_400_000,
  ).toISOString();
  const available = round2(Math.max(0, row.netEarned - row.requestedPayout));
  const unlocked = Date.parse(asOf) >= Date.parse(unlockAt);
  return {
    unlockAt,
    available,
    unlocked,
    eligible: unlocked && available >= MIN_PAYOUT,
    daysUntilUnlock: Math.max(
      0,
      Math.ceil((Date.parse(unlockAt) - Date.parse(asOf)) / 86_400_000),
    ),
  };
}

export function payoutDraftError(input: {
  amount: number;
  available: number;
  unlocked: boolean;
  method: PayoutMethod;
  bankAccount: string;
  terms: boolean;
}) {
  if (!input.unlocked)
    return "This position is still inside its payout lock window";
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return "Enter a payout amount";
  if (input.amount < MIN_PAYOUT) return `Payouts start at ${money(MIN_PAYOUT)}`;
  if (input.amount > input.available)
    return `Only ${money(input.available, 2)} is available on this position`;
  if (input.method === "bank" && input.bankAccount.trim().length < 4)
    return "Add a bank account before requesting a bank payout";
  if (!input.terms) return "Acknowledge the payout terms to continue";
  return "";
}

export const payoutFee = (amount: number, method: PayoutMethod) =>
  method === "wallet" ? 0 : round2(Math.min(12, Math.max(1.5, amount * 0.006)));

export function filterTimeline(
  events: TimelineEvent[],
  filters: InvestmentsFilters,
) {
  const query = filters.query.trim().toLowerCase();
  return events.filter((event) => {
    if (filters.kinds.length && !filters.kinds.includes(event.kind))
      return false;
    if (!query) return true;
    return `${event.title} ${event.detail} ${event.poolCode ?? ""} ${event.kind}`
      .toLowerCase()
      .includes(query);
  });
}

/** Timeline grouped by calendar day, newest first, for the vertical rail. */
export function groupTimeline(events: TimelineEvent[]) {
  const groups: { day: string; label: string; events: TimelineEvent[] }[] = [];
  for (const event of [...events].sort((a, b) => b.at.localeCompare(a.at))) {
    const day = event.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.events.push(event);
    else
      groups.push({
        day,
        label: new Date(event.at).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        events: [event],
      });
  }
  return groups;
}

/* ── Commands ── */

export const investmentsCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("requestPayout"),
    investmentId: z.string().min(2).max(40),
    amount: z.number().min(MIN_PAYOUT).max(1_000_000),
    method: z.enum(["bank", "wallet"]),
    note: z.string().max(200).default(""),
  }),
  z.object({
    kind: z.literal("cancelPayout"),
    payoutId: z.string().min(2).max(40),
    reason: z.enum(["changed_plan", "wrong_method", "faster_route", "other"]),
  }),
  z.object({
    kind: z.literal("retryPayout"),
    payoutId: z.string().min(2).max(40),
  }),
  z.object({
    kind: z.literal("cancelInterest"),
    bookedId: z.string().min(2).max(40),
    reason: z.enum(["changed_plan", "capacity", "timing", "other"]),
  }),
  z.object({
    kind: z.literal("saveReminder"),
    bookedId: z.string().min(2).max(40),
    leadDays: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(7)]),
    channel: z.enum(["email", "in_app"]),
  }),
  z.object({
    kind: z.literal("clearReminder"),
    bookedId: z.string().min(2).max(40),
  }),
  z.object({
    kind: z.literal("acknowledge"),
    scope: z.enum(["payoutPolicy", "risk", "settlement"]),
  }),
  z.object({
    kind: z.literal("savePreferences"),
    emailStatements: z.boolean(),
    autoReinvest: z.boolean(),
    payoutLeadDays: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(7),
    ]),
    reminderChannel: z.enum(["email", "in_app"]),
    hideCompleted: z.boolean(),
  }),
  z.object({
    kind: z.literal("saveFilters"),
    kinds: z
      .array(
        z.enum([
          "trade",
          "payout",
          "pool",
          "booking",
          "interest",
          "kyc",
          "account",
          "milestone",
        ]),
      )
      .max(8),
    query: z.string().max(60),
  }),
  z.object({
    kind: z.literal("exportReport"),
    scope: z.enum(["statement", "portfolio", "timeline", "payouts"]),
    format: z.enum(["pdf", "csv", "json"]),
    count: z.number().int().min(0).max(500),
    investmentId: z.string().max(40).nullable().default(null),
  }),
  z.object({
    kind: z.literal("addNote"),
    investmentId: z.string().min(2).max(40),
    body: z.string().trim().min(8).max(600),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["payout", "statement", "booking", "kyc", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
]);

export type InvestmentsCommand = z.infer<typeof investmentsCommandSchema>;

const cancelReasons: Record<string, string> = {
  changed_plan: "changed plan",
  wrong_method: "wrong destination",
  faster_route: "faster route requested",
  capacity: "capacity",
  timing: "timing",
  other: "other",
};

export function applyInvestmentsCommand(
  current: InvestmentsWorkspace,
  input: InvestmentsCommand,
  now = "2026-10-23T10:05:00Z",
): InvestmentsWorkspace {
  const parsed = investmentsCommandSchema.parse(input);
  const workspace = structuredClone(current);

  const stamp = (
    kind: TimelineKind,
    title: string,
    detail: string,
    amount: number | null,
    poolCode: string | null,
    status: TimelineEvent["status"],
    investmentId: string | null,
  ) => {
    workspace.timeline = [
      {
        id: `tl_${workspace.revision + 1}_${workspace.timeline.length + 1}`,
        at: now,
        kind,
        title,
        detail,
        amount,
        poolCode,
        status,
        investmentId,
      },
      ...workspace.timeline,
    ].slice(0, TIMELINE_LIMIT);
  };

  const done = () => {
    workspace.summary = computeSummary(workspace);
    return workspace;
  };

  const audit = (action: string, detail: string) => {
    workspace.revision += 1;
    workspace.audit = [
      {
        id: `inv_audit_${workspace.revision}`,
        at: now,
        action,
        detail,
      },
      ...workspace.audit,
    ].slice(0, 40);
  };

  switch (parsed.kind) {
    case "requestPayout": {
      const row = workspace.active.find(
        (entry) => entry.id === parsed.investmentId,
      );
      if (!row) throw new Error("That position is not in your book");
      const eligibility = payoutEligibility(
        { ...row, requestedPayout: row.requestedPayout },
        now,
      );
      if (!eligibility.unlocked)
        throw new Error(
          `Payouts unlock ${dateOf(eligibility.unlockAt)} for ${row.code}`,
        );
      if (parsed.amount > eligibility.available)
        throw new Error(
          `Only ${money(eligibility.available, 2)} is available on ${row.code}`,
        );
      const fee = payoutFee(parsed.amount, parsed.method);
      const record: PayoutRecord = {
        id: `po_${workspace.revision + 1}_${workspace.payouts.length + 1}`,
        poolId: row.poolId,
        poolCode: row.code,
        amount: parsed.amount,
        fee,
        net: round2(parsed.amount - fee),
        method: parsed.method,
        destination:
          parsed.method === "bank"
            ? workspace.profile.bankAccount
            : "Investor wallet",
        status: "processing",
        requestedAt: now,
        expectedAt: new Date(Date.parse(now) + 2 * 86_400_000).toISOString(),
        processedAt: null,
        reference: `PO-${now.slice(0, 10)}-${String(workspace.payouts.length + 52).padStart(4, "0")}`,
        note: parsed.note || "Interim payout against accrued earnings.",
      };
      workspace.payouts = [record, ...workspace.payouts];
      workspace.active = workspace.active.map((entry) =>
        entry.id === row.id
          ? {
              ...entry,
              requestedPayout: round2(entry.requestedPayout + parsed.amount),
              availablePayout: round2(
                Math.max(0, entry.availablePayout - parsed.amount),
              ),
            }
          : entry,
      );
      stamp(
        "payout",
        `Payout requested ${money(record.amount, 2)}`,
        `${row.code} accrued earnings · ${parsed.method === "bank" ? workspace.profile.bankAccount : "wallet"} · fee ${money(record.fee, 2)} · net ${money(record.net, 2)} · reference ${record.reference}`,
        record.net,
        row.code,
        "processing",
        row.id,
      );
      audit(
        "payout_requested",
        `${money(parsed.amount, 2)} from ${row.code} by ${parsed.method}. Queued locally — no provider call is made.`,
      );
      return done();
    }
    case "cancelPayout": {
      const record = workspace.payouts.find(
        (entry) => entry.id === parsed.payoutId,
      );
      if (!record) throw new Error("Payout not found");
      if (record.status !== "processing" && record.status !== "scheduled")
        throw new Error(
          `That payout is already ${payoutLabel(record.status).toLowerCase()}`,
        );
      workspace.payouts = workspace.payouts.map((entry) =>
        entry.id === record.id
          ? {
              ...entry,
              status: "cancelled" as const,
              note: `${entry.note} Cancelled locally · ${cancelReasons[parsed.reason]}.`,
            }
          : entry,
      );
      workspace.active = workspace.active.map((entry) =>
        entry.code === record.poolCode
          ? {
              ...entry,
              requestedPayout: round2(
                Math.max(0, entry.requestedPayout - record.amount),
              ),
              availablePayout: round2(entry.availablePayout + record.amount),
            }
          : entry,
      );
      stamp(
        "payout",
        `Payout cancelled ${money(record.net, 2)}`,
        `${record.poolCode} · ${cancelReasons[parsed.reason]} · funds stay on the pool ledger`,
        -record.net,
        record.poolCode,
        "informational",
        null,
      );
      audit(
        "payout_cancelled",
        `${record.reference} cancelled locally (${cancelReasons[parsed.reason]}). The balance returns to your available payout figure.`,
      );
      return done();
    }
    case "retryPayout": {
      const record = workspace.payouts.find(
        (entry) => entry.id === parsed.payoutId,
      );
      if (!record) throw new Error("Payout not found");
      if (record.status !== "cancelled")
        throw new Error("Only a cancelled payout can be retried");
      workspace.payouts = workspace.payouts.map((entry) =>
        entry.id === record.id
          ? {
              ...entry,
              status: "processing" as const,
              requestedAt: now,
              expectedAt: new Date(
                Date.parse(now) + 2 * 86_400_000,
              ).toISOString(),
            }
          : entry,
      );
      stamp(
        "payout",
        `Payout retried ${money(record.net, 2)}`,
        `${record.poolCode} · ${record.destination} · reference ${record.reference}`,
        record.net,
        record.poolCode,
        "processing",
        null,
      );
      audit("payout_retried", `${record.reference} re-queued locally.`);
      return done();
    }
    case "cancelInterest": {
      const row = workspace.booked.find(
        (entry) => entry.id === parsed.bookedId,
      );
      if (!row) throw new Error("That registration is not in your book");
      if (row.stage !== "interest")
        throw new Error("Only a registered interest can be cancelled here");
      workspace.booked = workspace.booked.filter(
        (entry) => entry.id !== row.id,
      );
      stamp(
        "interest",
        `Interest cancelled on ${row.code}`,
        `${row.slots} slot(s) · ${money(row.amount)} · ${cancelReasons[parsed.reason]}. No payment was ever taken.`,
        null,
        row.code,
        "informational",
        null,
      );
      audit(
        "interest_cancelled",
        `${row.code} interest removed locally (${cancelReasons[parsed.reason]}). Capacity is not reserved either way.`,
      );
      return done();
    }
    case "saveReminder": {
      const row = workspace.booked.find(
        (entry) => entry.id === parsed.bookedId,
      );
      if (!row) throw new Error("That registration is not in your book");
      workspace.booked = workspace.booked.map((entry) =>
        entry.id === row.id
          ? {
              ...entry,
              reminder: {
                leadDays: parsed.leadDays,
                channel: parsed.channel,
              },
            }
          : entry,
      );
      audit(
        "reminder_saved",
        `${row.code} reminder set for ${parsed.leadDays} day(s) before opening via ${parsed.channel}. Stored locally.`,
      );
      return done();
    }
    case "clearReminder": {
      const row = workspace.booked.find(
        (entry) => entry.id === parsed.bookedId,
      );
      if (!row) throw new Error("That registration is not in your book");
      if (!row.reminder) throw new Error("That registration has no reminder");
      workspace.booked = workspace.booked.map((entry) =>
        entry.id === row.id ? { ...entry, reminder: null } : entry,
      );
      audit("reminder_cleared", `${row.code} reminder removed locally.`);
      return done();
    }
    case "acknowledge": {
      const label =
        parsed.scope === "payoutPolicy"
          ? "Payout policy"
          : parsed.scope === "risk"
            ? "Risk disclosure"
            : "Settlement terms";
      audit(
        "acknowledged",
        `${label} acknowledged locally at ${clockOf(now)} UTC. No document was signed.`,
      );
      return done();
    }
    case "savePreferences": {
      workspace.preferences = {
        emailStatements: parsed.emailStatements,
        autoReinvest: parsed.autoReinvest,
        payoutLeadDays: parsed.payoutLeadDays,
        reminderChannel: parsed.reminderChannel,
        hideCompleted: parsed.hideCompleted,
      };
      audit(
        "preferences_saved",
        `Holding preferences stored locally: statements ${parsed.emailStatements ? "emailed" : "in-app"}, reinvest ${parsed.autoReinvest ? "on" : "off"}, reminders ${parsed.payoutLeadDays} day(s) before.`,
      );
      return done();
    }
    case "saveFilters": {
      workspace.filters = { kinds: parsed.kinds, query: parsed.query };
      audit(
        "timeline_filters",
        `Timeline filtered to ${parsed.kinds.length ? parsed.kinds.join(" + ") : "every event"}${parsed.query ? ` · “${parsed.query}”` : ""}.`,
      );
      return done();
    }
    case "exportReport": {
      workspace.exports = [
        {
          id: `export_${workspace.revision + 1}`,
          scope: parsed.scope,
          format: parsed.format,
          count: parsed.count,
          investmentId: parsed.investmentId,
          createdAt: now,
        },
        ...workspace.exports,
      ].slice(0, 10);
      audit(
        "export_prepared",
        `${parsed.scope} prepared as ${parsed.format.toUpperCase()} (${parsed.count} row(s)). Generated in-browser only.`,
      );
      return done();
    }
    case "addNote": {
      const row =
        workspace.active.find((entry) => entry.id === parsed.investmentId) ??
        workspace.completed.find((entry) => entry.id === parsed.investmentId) ??
        workspace.booked.find((entry) => entry.id === parsed.investmentId);
      if (!row) throw new Error("That position is not in your book");
      workspace.notes = [
        {
          id: `note_${workspace.revision + 1}`,
          investmentId: row.id,
          poolCode: row.code,
          body: parsed.body,
          createdAt: now,
        },
        ...workspace.notes,
      ].slice(0, 40);
      audit("note_added", `Journal note added to ${row.code}.`);
      return done();
    }
    case "support": {
      workspace.support = [
        {
          id: `support_${workspace.revision + 1}`,
          topic: parsed.topic,
          message: parsed.message,
          status: "local_draft" as const,
          createdAt: now,
        },
        ...workspace.support,
      ].slice(0, 10);
      audit(
        "support_draft",
        `${parsed.topic} question saved locally; nothing was transmitted.`,
      );
      return done();
    }
  }
}

/** Requested amount default: the whole eligible balance, rounded down to $10. */
export const suggestedPayout = (available: number) =>
  Math.max(0, Math.min(available, Math.floor(available / 10) * 10));
