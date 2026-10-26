import { z } from "zod";

import { countdownFrom } from "./pool-detail";

/**
 * I-4 · Pool Booking & Payment — structured booking context.
 *
 * One `PoolBookingWorkspace` describes a single pool's funding window: what is
 * still bookable, the payment rails the desk supports, the escrow account, the
 * terms that must be accepted and every reservation made in this session.
 *
 * Nothing here captures a card, moves money, holds capacity with a provider or
 * confirms a slot: commands validate a structured draft, append an audited
 * record and let a backend replace each case with an authenticated endpoint
 * (`POST /api/investments`, `DELETE /api/investments/:id`).
 */

export const POOL_BOOKING_AS_OF = "2026-10-23T10:00:00Z";
export const RESERVATION_WINDOW_HOURS = 72;
export const EARLY_EXIT_PENALTY_PCT = 10;
export const RECEIPT_PREFIX = "RCPT";
export const BOOKING_HANDLE = "user_8f2a";

export type BookingLifecycle = "open" | "upcoming" | "trading" | "completed";
export type PaymentMethodKey =
  "wallet" | "bank_transfer" | "mobile_money" | "card" | "crypto";
export type BookingStatus =
  "awaiting_payment" | "received" | "verified" | "confirmed" | "cancelled";
export type BookingStageKey =
  "created" | "instructions" | "received" | "verified" | "confirmed";
export type PaymentMethodIcon =
  "wallet" | "vault" | "smartphone" | "layers" | "bolt";

/* ── Pool ── */

export interface BookingPool {
  id: string;
  code: string;
  name: string;
  lifecycle: BookingLifecycle;
  strategy: string;
  riskBand: "Low" | "Balanced" | "Growth" | "Aggressive";
  manager: string;
  opensAt: string;
  closesAt: string;
  tradingEndsAt: string;
  durationDays: number;
  expectedRoiPct: number;
  slotPrice: number;
  minSlot: number;
  maxSlotsPerUser: number;
  slotsTotal: number;
  slotsFilled: number;
  goal: number;
  raised: number;
  investors: number;
  profitSharePct: number;
  settlementBatch: string;
  tokenSymbol: string;
  tokensPerSlot: number;
  guardianNote: string;
  riskNote: string;
}

export interface BookingExisting {
  slots: number;
  amount: number;
  payment: "verified" | "pending" | "partial";
  reference: string | null;
  bookedAt: string;
  methodLabel: string;
  note: string;
}

/* ── Payment rails ── */

export interface PaymentFieldSpec {
  name: string;
  label: string;
  kind: "text" | "tel" | "select" | "check";
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  maxLength?: number;
  options?: { value: string; label: string }[];
}

export interface PaymentMethodDef {
  key: PaymentMethodKey;
  label: string;
  icon: PaymentMethodIcon;
  tagline: string;
  speed: string;
  feePct: number;
  feeFlat: number;
  feeLabel: string;
  limits: string;
  note: string;
  fields: PaymentFieldSpec[];
  instructions: string[];
}

export interface EscrowAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swift: string;
  windowHours: number;
  verifyLabel: string;
  note: string;
}

export interface BookingTerm {
  id: "terms" | "lockup" | "funds";
  label: string;
  detail: string;
}

export interface BookingTermsState {
  terms: boolean;
  lockup: boolean;
  funds: boolean;
}

/* ── Records ── */

export interface BookingRecord {
  id: string;
  poolId: string;
  slots: number;
  amount: number;
  tokens: number;
  fee: number;
  total: number;
  method: PaymentMethodKey;
  methodLabel: string;
  details: Record<string, string>;
  reference: string;
  receiptNo: string;
  status: BookingStatus;
  stage: BookingStageKey;
  createdAt: string;
  updatedAt: string;
  reservationExpiresAt: string;
  cancelReason: string | null;
  operatorNote: string;
  instructions: string[];
}

export interface BookingStageRow {
  key: BookingStageKey;
  label: string;
  at: string | null;
  note: string;
  state: "done" | "current" | "pending" | "blocked";
}

export interface BookingHistoryRow {
  id: string;
  code: string;
  name: string;
  slots: number;
  amount: number;
  methodLabel: string;
  status: string;
  createdAt: string;
  reference: string;
}

export interface SavedMethod {
  id: string;
  kind: "bank" | "card";
  label: string;
  detail: string;
  holder: string;
  primary: boolean;
}

export interface TopUpDraft {
  id: string;
  amount: number;
  method: "bank_transfer" | "card";
  status: "draft";
  createdAt: string;
}

export interface ProjectionRecord {
  id: string;
  slots: number;
  principal: number;
  roiPct: number;
  days: number;
  projectedProfit: number;
  createdAt: string;
}

export interface SupportRecord {
  id: string;
  topic: "payment" | "escrow" | "booking" | "kyc" | "other";
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface ReferralRecord {
  id: string;
  email: string;
  channel: "email" | "link";
  createdAt: string;
}

export interface BookingAuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
}

/* ── Workspace ── */

export interface PoolBookingWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  poolId: string;
  bookable: boolean;
  blockedReason: string | null;
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
    kycLevel: string;
    fundsSource: string;
    fundsDeclaredAt: string;
    bookingHandle: string;
  };
  pool: BookingPool;
  existing: BookingExisting | null;
  methods: PaymentMethodDef[];
  escrow: EscrowAccount;
  terms: BookingTerm[];
  records: BookingRecord[];
  history: BookingHistoryRow[];
  savedMethods: SavedMethod[];
  topUps: TopUpDraft[];
  projections: ProjectionRecord[];
  support: SupportRecord[];
  referrals: ReferralRecord[];
  audit: BookingAuditEntry[];
}

/* ── Selectors ── */

export const round2 = (value: number) => Number(value.toFixed(2));

export const slotLabel = (slots: number) =>
  `${slots} slot${slots === 1 ? "" : "s"}`;

export const stageOrder: BookingStageKey[] = [
  "created",
  "instructions",
  "received",
  "verified",
  "confirmed",
];

export const stageLabels: Record<BookingStageKey, string> = {
  created: "Created",
  instructions: "Instructions sent",
  received: "Received",
  verified: "Verified",
  confirmed: "Confirmed",
};

export const statusLabels: Record<BookingStatus, string> = {
  awaiting_payment: "Awaiting payment",
  received: "Payment received",
  verified: "Verified",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export const lifecycleLabel = (lifecycle: BookingLifecycle) =>
  lifecycle === "open"
    ? "Open for booking"
    : lifecycle === "trading"
      ? "Trading"
      : lifecycle === "upcoming"
        ? "Upcoming"
        : "Completed";

/** Slots still unsold across the whole pool. */
export const slotsRemainingInPool = (pool: BookingPool) =>
  Math.max(0, pool.slotsTotal - pool.slotsFilled);

/** Slots the remaining target capital can still fund. */
export const slotsRemainingCapital = (pool: BookingPool) =>
  Math.max(
    0,
    Math.floor((pool.goal - pool.raised) / Math.max(pool.slotPrice, 1)),
  );

/** Slots this investor may still add: per-user limit, pool stock, target. */
export const slotsForYou = (
  pool: BookingPool,
  existing: BookingExisting | null,
) =>
  Math.max(
    0,
    Math.min(
      pool.maxSlotsPerUser - (existing?.slots ?? 0),
      slotsRemainingInPool(pool),
      slotsRemainingCapital(pool),
    ),
  );

export const bookingAmount = (pool: BookingPool, slots: number) =>
  round2(slots * pool.slotPrice);

export const tokensFor = (pool: BookingPool, slots: number) =>
  slots * pool.tokensPerSlot;

/** Share of the pool's booked capital this order would represent. */
export const bookingSharePct = (pool: BookingPool, slots: number) => {
  const amount = bookingAmount(pool, slots);
  return Number(
    ((amount / Math.max(pool.raised + amount, 1)) * 100).toFixed(2),
  );
};

export const methodByKey = (
  methods: PaymentMethodDef[],
  key: PaymentMethodKey,
) => methods.find((method) => method.key === key) ?? methods[0];

export const feeFor = (method: PaymentMethodDef, amount: number) =>
  round2((amount * method.feePct) / 100 + method.feeFlat);

export const totalDue = (method: PaymentMethodDef, amount: number) =>
  round2(amount + feeFor(method, amount));

export interface BookingTotals {
  slots: number;
  amount: number;
  tokens: number;
  sharePct: number;
  fee: number;
  total: number;
  combinedSlots: number;
  combinedAmount: number;
}

export const bookingTotals = (
  pool: BookingPool,
  slots: number,
  method: PaymentMethodDef,
  existing: BookingExisting | null,
): BookingTotals => {
  const amount = bookingAmount(pool, slots);
  return {
    slots,
    amount,
    tokens: tokensFor(pool, slots),
    sharePct: bookingSharePct(pool, slots),
    fee: feeFor(method, amount),
    total: totalDue(method, amount),
    combinedSlots: (existing?.slots ?? 0) + slots,
    combinedAmount: round2((existing?.amount ?? 0) + amount),
  };
};

/** Wallet rail only works when the balance covers the whole order. */
export const walletShortfall = (
  method: PaymentMethodDef,
  amount: number,
  wallet: number,
) =>
  method.key === "wallet"
    ? Math.max(0, round2(totalDue(method, amount) - wallet))
    : 0;

export const methodAvailable = (
  method: PaymentMethodDef,
  amount: number,
  wallet: number,
) => walletShortfall(method, amount, wallet) === 0;

/* ── Validation ── */

export function paymentFieldError(
  field: PaymentFieldSpec,
  raw: string,
): string {
  const value = (raw ?? "").trim();
  if (field.kind === "check")
    return value === "yes" ? "" : `${field.label} is required`;
  if (!value) return `${field.label} is required`;
  const digits = value.replace(/[\s-]/g, "");
  switch (field.name) {
    case "bankName":
    case "accountHolder":
    case "cardName":
      return value.length >= 3
        ? ""
        : `${field.label} needs at least 3 characters`;
    case "accountNumber":
      return /^\d{6,18}$/.test(digits) ? "" : "Use 6–18 digits, no letters";
    case "routingNumber":
      // ACH/wire routing numbers are 6–11 digits; SWIFT/BIC codes are 8–11
      // alphanumerics with at least one letter (e.g. EQBLKENA).
      return /^\d{6,11}$/.test(digits) ||
        /^(?=.*[A-Za-z])[A-Za-z0-9]{8,11}$/.test(value)
        ? ""
        : "Use 6–11 routing digits or a SWIFT/BIC code";
    case "phone":
      return /^\+?\d{9,15}$/.test(digits)
        ? ""
        : "Use a full number with country code";
    case "cardNumber":
      return /^\d{15,16}$/.test(digits) ? "" : "Use 15–16 card digits";
    case "expiry":
      return /^(0[1-9]|1[0-2])\/\d{2}$/.test(value) ? "" : "Use MM/YY";
    case "cvc":
      return /^\d{3,4}$/.test(digits) ? "" : "Use 3–4 digits";
    case "zip":
      return /^[A-Za-z0-9 -]{3,10}$/.test(value)
        ? ""
        : "Enter a valid postal code";
    case "walletAddress":
      return /^[A-Za-z0-9]{20,64}$/.test(value)
        ? ""
        : "Use a 20–64 character address";
    default:
      if (field.options && field.kind === "select")
        return field.options.some((option) => option.value === value)
          ? ""
          : `Choose a ${field.label.toLowerCase()}`;
      return "";
  }
}

export interface BookingDraft {
  pool: BookingPool;
  methods: PaymentMethodDef[];
  slots: number;
  method: PaymentMethodKey;
  details: Record<string, string>;
  terms: BookingTermsState;
  wallet: number;
  bookable: boolean;
  blockedReason?: string | null;
  existing?: BookingExisting | null;
}

/**
 * Single source of truth for the booking form. Returns an empty string when
 * the draft may be submitted, otherwise the first actionable message.
 */
export function bookingDraftError(draft: BookingDraft): string {
  if (!draft.bookable)
    return draft.blockedReason ?? "This funding window is not open for booking";
  const available = slotsForYou(draft.pool, draft.existing ?? null);
  if (!Number.isInteger(draft.slots) || draft.slots < 1)
    return "Choose at least one slot";
  if (draft.slots > available)
    return available > 0
      ? `Only ${available} slot(s) remain for your allocation`
      : "No slots remain for your allocation";
  const method =
    draft.methods.find((item) => item.key === draft.method) ?? null;
  if (!method) return "Choose a payment method";
  for (const field of method.fields) {
    const message = paymentFieldError(field, draft.details[field.name] ?? "");
    if (message) return message;
  }
  const amount = bookingAmount(draft.pool, draft.slots);
  const shortfall = walletShortfall(method, amount, draft.wallet);
  if (shortfall > 0)
    return `Wallet balance is $${shortfall.toFixed(2)} short for this order`;
  if (!draft.terms.terms)
    return "Accept the pool terms before confirming the booking";
  if (!draft.terms.lockup)
    return `Accept the ${draft.pool.durationDays}-day lock-up before confirming`;
  if (!draft.terms.funds)
    return "Confirm the KYC funds source declaration before confirming";
  return "";
}

export const termsAccepted = (terms: BookingTermsState) =>
  terms.terms && terms.lockup && terms.funds;

/** Body for `POST /api/investments` — only the active rail's fields travel. */
export function buildBookingPayload(draft: BookingDraft) {
  const method = methodByKey(draft.methods, draft.method);
  const details: Record<string, string> = {};
  for (const field of method.fields) {
    const value = (draft.details[field.name] ?? "").trim();
    if (value) details[field.name] = value;
  }
  return {
    poolId: draft.pool.id,
    slots: draft.slots,
    paymentMethod: draft.method,
    paymentDetails: details,
    termsAccepted: termsAccepted(draft.terms),
    terms: {
      poolTerms: draft.terms.terms,
      lockup: draft.terms.lockup,
      fundsSource: draft.terms.funds,
    },
    amount: bookingAmount(draft.pool, draft.slots),
    fee: feeFor(method, bookingAmount(draft.pool, draft.slots)),
    total: totalDue(method, bookingAmount(draft.pool, draft.slots)),
  };
}

/* ── Status tracker ── */

const cancelReasonLabels = {
  changed_plan: "Plan changed",
  wrong_method: "Wrong payment method",
  duplicate: "Duplicate booking",
  other: "Other",
} as const;

export type CancelReason = keyof typeof cancelReasonLabels;

export const cancelReasonLabel = (reason: CancelReason) =>
  cancelReasonLabels[reason];

export function bookingStageRows(
  record: BookingRecord | null,
  escrow: EscrowAccount,
): BookingStageRow[] {
  if (!record)
    return stageOrder.map((key) => ({
      key,
      label: stageLabels[key],
      at: null,
      note:
        key === "created"
          ? "No booking created for this pool yet."
          : key === "instructions"
            ? `Escrow instructions appear here (${escrow.windowHours}h hold).`
            : key === "received"
              ? "Awaiting your transfer once a booking exists."
              : key === "verified"
                ? `Operator verifies receipt (${escrow.verifyLabel}).`
                : "Investment locks and slots reserve at confirmation.",
      state: "pending" as const,
    }));

  const reached = stageOrder.indexOf(record.stage);
  const cancelled = record.status === "cancelled";

  return stageOrder.map((key, index) => {
    const base = {
      key,
      label: stageLabels[key],
      at: null as string | null,
      note: "",
      state: "pending" as BookingStageRow["state"],
    };
    if (key === "created")
      return {
        ...base,
        at: record.createdAt,
        note: `Booking created (booking ID: ${record.id})`,
        state: "done",
      };
    if (key === "instructions")
      return {
        ...base,
        at: record.createdAt,
        note: `${record.methodLabel} instructions displayed (ref: ${record.reference})`,
        state: "done",
      };
    if (key === "received")
      return index <= reached
        ? {
            ...base,
            at: record.updatedAt,
            note: `Payment receipt noted against ${record.reference}`,
            state: "done",
          }
        : {
            ...base,
            note: cancelled
              ? "Reservation cancelled before payment cleared."
              : `Awaiting your payment (ref: ${record.reference})`,
            state: cancelled ? "blocked" : "current",
          };
    if (key === "verified")
      return index <= reached
        ? {
            ...base,
            at: record.updatedAt,
            note: "Funding desk verified receipt; amount allocated.",
            state: "done",
          }
        : {
            ...base,
            note: cancelled
              ? "Not reached — booking cancelled."
              : `Operator will verify receipt (${escrow.verifyLabel}).`,
            state: cancelled ? "blocked" : "pending",
          };
    if (key === "confirmed")
      return index <= reached
        ? {
            ...base,
            at: record.updatedAt,
            note: "Investment locked, slots reserved into the trading window.",
            state: "done",
          }
        : {
            ...base,
            note: cancelled
              ? "Not reached — booking cancelled."
              : "Slots reserve the moment verification clears.",
            state: cancelled ? "blocked" : "pending",
          };
    return base;
  });
}

export const reservationWindow = (
  record: BookingRecord | null,
  asOf: string,
) =>
  record
    ? countdownFrom(record.reservationExpiresAt, asOf)
    : {
        total: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        label: "—",
        clock: "—",
      };

/* ── Commands ── */

const paymentMethodKeys = [
  "wallet",
  "bank_transfer",
  "mobile_money",
  "card",
  "crypto",
] as const;

export const bookingCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("refreshBooking"),
    source: z.enum(["manual", "auto"]),
  }),
  z.object({
    kind: z.literal("createBooking"),
    slots: z.number().int().min(1).max(25),
    method: z.enum(paymentMethodKeys),
    details: z.record(z.string(), z.string().max(120)).default({}),
    terms: z.object({
      terms: z.boolean(),
      lockup: z.boolean(),
      funds: z.boolean(),
    }),
  }),
  z.object({
    kind: z.literal("advanceBooking"),
    bookingId: z.string().min(3).max(40),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    kind: z.literal("cancelBooking"),
    bookingId: z.string().min(3).max(40),
    reason: z.enum(["changed_plan", "wrong_method", "duplicate", "other"]),
  }),
  z.object({
    kind: z.literal("acknowledge"),
    scope: z.enum(["risk", "terms", "lockup", "escrow"]),
  }),
  z.object({
    kind: z.literal("topUpWallet"),
    amount: z.number().min(100).max(100000),
    method: z.enum(["bank_transfer", "card"]),
  }),
  z.object({
    kind: z.literal("saveProjection"),
    slots: z.number().int().min(1).max(25),
    roiPct: z.number().min(1).max(50),
  }),
  z.object({
    kind: z.literal("saveReferral"),
    email: z.email(),
    channel: z.enum(["email", "link"]),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["payment", "escrow", "booking", "kyc", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
  z.object({
    kind: z.literal("recordExport"),
    scope: z.enum([
      "order-summary",
      "payment-instructions",
      "receipt",
      "history",
    ]),
    format: z.enum(["pdf", "csv", "json"]),
    count: z.number().int().min(0).max(500),
  }),
]);

export type BookingCommand = z.infer<typeof bookingCommandSchema>;

const hex = (value: number) => value.toString(16).padStart(4, "0");

export const bookingReference = (
  code: string,
  handle: string,
  sequence: number,
) => `BOOK-${code.replaceAll("-", "")}-${handle}-${1700 + sequence}`;

export function applyBookingCommand(
  current: PoolBookingWorkspace,
  input: BookingCommand,
  now = "2026-10-23T10:00:00Z",
): PoolBookingWorkspace {
  const parsed = bookingCommandSchema.parse(input);
  const w = structuredClone(current);
  const audit = (action: string, detail: string) => {
    w.revision += 1;
    w.audit = [
      {
        id: `booking_audit_${w.revision}_${w.audit.length + 1}`,
        at: now,
        action,
        detail,
      },
      ...w.audit,
    ].slice(0, 40);
  };
  const expiresAt = (from: string, hours: number) =>
    new Date(Date.parse(from) + hours * 3_600_000).toISOString();

  switch (parsed.kind) {
    case "refreshBooking": {
      if (parsed.source === "auto")
        throw new Error("Automatic refresh is not enabled for this page");
      audit(
        "booking_refresh",
        `${w.pool.code} funding context re-read from the pool book. Provider figures unchanged.`,
      );
      return w;
    }
    case "createBooking": {
      const message = bookingDraftError({
        pool: w.pool,
        methods: w.methods,
        slots: parsed.slots,
        method: parsed.method,
        details: parsed.details,
        terms: parsed.terms,
        wallet: w.profile.wallet,
        bookable: w.bookable,
        blockedReason: w.blockedReason,
        existing: w.existing,
      });
      if (message) throw new Error(message);

      const method = methodByKey(w.methods, parsed.method);
      const amount = bookingAmount(w.pool, parsed.slots);
      const fee = feeFor(method, amount);
      const total = round2(amount + fee);
      // Reference numbers stay unique across the seeded and session records.
      const sequence = w.records.length + 1;
      const record: BookingRecord = {
        id: `inv_${hex(0x8f2a + sequence)}`,
        poolId: w.pool.id,
        slots: parsed.slots,
        amount,
        tokens: tokensFor(w.pool, parsed.slots),
        fee,
        total,
        method: method.key,
        methodLabel: method.label,
        details: Object.fromEntries(
          method.fields.map((field) => [
            field.name,
            (parsed.details[field.name] ?? "").trim(),
          ]),
        ),
        reference: bookingReference(
          w.pool.code,
          w.profile.bookingHandle,
          sequence,
        ),
        receiptNo: `${RECEIPT_PREFIX}-${w.pool.code.replaceAll("-", "")}-${1700 + sequence}`,
        status: "awaiting_payment",
        stage: "instructions",
        createdAt: now,
        updatedAt: now,
        reservationExpiresAt: expiresAt(now, w.escrow.windowHours),
        cancelReason: null,
        operatorNote:
          "Reservation holds capacity on this page only. The funding desk reconciles the transfer before slots confirm.",
        instructions: method.instructions,
      };
      w.records = [record, ...w.records].slice(0, 24);
      w.pool.raised = round2(w.pool.raised + amount);
      w.pool.slotsFilled = Math.min(
        w.pool.slotsTotal,
        w.pool.slotsFilled + parsed.slots,
      );
      w.history = [
        {
          id: record.id,
          code: w.pool.code,
          name: w.pool.name,
          slots: record.slots,
          amount: record.amount,
          methodLabel: record.methodLabel,
          status: statusLabels[record.status],
          createdAt: record.createdAt,
          reference: record.reference,
        },
        ...w.history,
      ].slice(0, 20);
      audit(
        "booking_created",
        `${w.pool.code}: ${slotLabel(parsed.slots)} reserved for $${amount.toLocaleString()} via ${method.label}. Reference ${record.reference}; payment not captured.`,
      );
      return w;
    }
    case "advanceBooking": {
      const record = w.records.find((item) => item.id === parsed.bookingId);
      if (!record) throw new Error("Booking not found in this workspace");
      if (record.status === "cancelled")
        throw new Error("Cancelled bookings cannot move forward");
      if (record.status === "confirmed")
        throw new Error("This booking is already confirmed");
      const next: Record<
        Exclude<BookingStageKey, "created" | "instructions">,
        { stage: BookingStageKey; status: BookingStatus; note: string }
      > = {
        received: {
          stage: "received",
          status: "received",
          note: `Payment received against ${record.reference}; awaiting desk verification.`,
        },
        verified: {
          stage: "verified",
          status: "verified",
          note: "Funding desk verified the receipt and allocated the amount.",
        },
        confirmed: {
          stage: "confirmed",
          status: "confirmed",
          note: "Investment locked and slots reserved into the trading window.",
        },
      };
      const currentStage = (
        ["received", "verified", "confirmed"] as const
      ).find(
        (stage) => stageOrder.indexOf(record.stage) < stageOrder.indexOf(stage),
      );
      if (!currentStage)
        throw new Error("This booking has no further operator steps");
      const step = next[currentStage];
      record.stage = step.stage;
      record.status = step.status;
      record.updatedAt = now;
      record.operatorNote = parsed.note?.trim() || step.note;
      if (step.stage === "confirmed") {
        record.instructions = [
          ...record.instructions,
          "Investment locked; slots reserved into the next trading window.",
        ];
        const previous = w.existing;
        w.existing = {
          slots: (previous?.slots ?? 0) + record.slots,
          amount: round2((previous?.amount ?? 0) + record.amount),
          payment: "verified",
          reference: record.reference,
          bookedAt: now,
          methodLabel: record.methodLabel,
          note: "Verified by the funding desk in this session.",
        };
      }
      w.history = w.history.map((row) =>
        row.id === record.id
          ? { ...row, status: statusLabels[record.status] }
          : row,
      );
      audit(
        `booking_${step.stage}`,
        `${record.id} · ${statusLabels[record.status]} — ${record.operatorNote}`,
      );
      return w;
    }
    case "cancelBooking": {
      const record = w.records.find((item) => item.id === parsed.bookingId);
      if (!record) throw new Error("Booking not found in this workspace");
      if (record.status === "verified" || record.status === "confirmed")
        throw new Error(
          "Verified bookings cannot be cancelled here; contact the funding desk",
        );
      if (record.status === "cancelled")
        throw new Error("This booking is already cancelled");
      record.status = "cancelled";
      record.updatedAt = now;
      record.cancelReason = cancelReasonLabel(parsed.reason);
      record.operatorNote = `Reservation cancelled (${cancelReasonLabel(parsed.reason)}). Capacity returned to the pool.`;
      w.pool.raised = round2(Math.max(0, w.pool.raised - record.amount));
      w.pool.slotsFilled = Math.max(0, w.pool.slotsFilled - record.slots);
      w.history = w.history.map((row) =>
        row.id === record.id ? { ...row, status: "Cancelled" } : row,
      );
      audit(
        "booking_cancelled",
        `${record.id} cancelled · ${cancelReasonLabel(parsed.reason)} · $${record.amount.toLocaleString()} capacity released.`,
      );
      return w;
    }
    case "acknowledge": {
      const copy: Record<typeof parsed.scope, string> = {
        risk: "Risk disclosure reviewed",
        terms: "Pool terms reviewed",
        lockup: "Lock-up and early-exit penalty reviewed",
        escrow: "Escrow instructions reviewed",
      };
      audit(
        "acknowledgement",
        `${copy[parsed.scope]} for ${w.pool.code}. Recorded locally only.`,
      );
      return w;
    }
    case "topUpWallet": {
      w.topUps.unshift({
        id: `topup_${w.revision + 1}`,
        amount: round2(parsed.amount),
        method: parsed.method,
        status: "draft",
        createdAt: now,
      });
      w.topUps = w.topUps.slice(0, 6);
      audit(
        "wallet_topup_draft",
        `$${parsed.amount.toFixed(2)} ${parsed.method === "card" ? "card" : "bank"} top-up drafted locally. Balance not credited.`,
      );
      return w;
    }
    case "saveProjection": {
      const principal = bookingAmount(w.pool, parsed.slots);
      w.projections.unshift({
        id: `projection_${w.revision + 1}`,
        slots: parsed.slots,
        principal,
        roiPct: parsed.roiPct,
        days: w.pool.durationDays,
        projectedProfit: round2((principal * parsed.roiPct) / 100),
        createdAt: now,
      });
      w.projections = w.projections.slice(0, 8);
      audit(
        "projection_saved",
        `$${principal.toLocaleString()} over ${w.pool.durationDays} days at ${parsed.roiPct}% drafted locally.`,
      );
      return w;
    }
    case "saveReferral": {
      const email = parsed.email.trim().toLowerCase();
      if (w.referrals.some((item) => item.email === email))
        throw new Error("A draft invitation already exists for this email");
      w.referrals.unshift({
        id: `referral_${w.revision + 1}`,
        email,
        channel: parsed.channel,
        createdAt: now,
      });
      w.referrals = w.referrals.slice(0, 8);
      audit(
        "referral_draft",
        `Invitation for ${email} drafted locally via ${parsed.channel}. No message sent.`,
      );
      return w;
    }
    case "support": {
      w.support.unshift({
        id: `support_${w.revision + 1}`,
        topic: parsed.topic,
        message: parsed.message,
        status: "local_draft",
        createdAt: now,
      });
      w.support = w.support.slice(0, 10);
      audit(
        "support_draft",
        `${parsed.topic} question saved locally; nothing was transmitted.`,
      );
      return w;
    }
    case "recordExport": {
      audit(
        "export_prepared",
        `${parsed.scope} exported as ${parsed.format.toUpperCase()} (${parsed.count} row(s)). Generated in-browser only.`,
      );
      return w;
    }
  }
}

/* ── Fees table helper (modals, drawer) ── */

export function feeTableRows(
  methods: PaymentMethodDef[],
  amount: number,
  wallet: number,
) {
  return methods.map((method) => ({
    key: method.key,
    label: method.label,
    speed: method.speed,
    feeLabel: method.feeLabel,
    fee: feeFor(method, amount),
    total: totalDue(method, amount),
    limits: method.limits,
    available: methodAvailable(method, amount, wallet),
  }));
}
