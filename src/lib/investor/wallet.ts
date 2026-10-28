import { z } from "zod";

import {
  atStamp,
  clockOf,
  dateOf,
  money,
  round2,
  shortDateOf,
  signedMoney,
} from "./investments";

/**
 * I-7 · Wallet & Finances — the investor's cash account.
 *
 * The wallet is a *cash ledger*: deposits in, pool funding out, settlement
 * earnings in, payouts out. Every balance on the page is derived from the rows
 * in `transactions` (see `withRunningBalance` / `deriveLifetime`), never typed
 * twice, so the summary, the statement and the payout form cannot disagree.
 *
 * Positions themselves live on I-6 (`/investor/investments`). This page only
 * borrows the locked capital, the accrued pool earnings and the pending payout
 * from that book so both pages quote the same figures.
 *
 * `applyWalletCommand` is the reducer a backend replaces: it validates a
 * discriminated union, returns an immutable audited clone and never calls a
 * payment provider, a bank or a card network.
 */

export const WALLET_AS_OF = "2026-10-23T10:00:00Z";
export const MIN_DEPOSIT = 50;
export const MAX_DEPOSIT = 50_000;
export const MIN_PAYOUT = 50;
export const MAX_PAYOUT = 10_000;
export const DAILY_DEPOSIT_LIMIT = 25_000;
export const MONTHLY_DEPOSIT_LIMIT = 60_000;
export const TRANSACTIONS_PER_PAGE = 8;

/* ── Types ── */

export type WalletTxnType =
  "deposit" | "investment" | "earning" | "payout" | "fee" | "refund";

export type WalletTxnStatus =
  "completed" | "processing" | "pending" | "failed" | "refunded";

export type DepositRailKey =
  "bank_transfer" | "mobile_money" | "card" | "crypto" | "stablecoin";

export type PayoutRailKey = "bank_transfer" | "mobile_money" | "crypto";

export type WalletMethodKind = "bank" | "mobile" | "card" | "crypto";

export type WalletPayoutStatus =
  "processing" | "completed" | "failed" | "refunded";

export interface WalletProfile {
  id: string;
  displayName: string;
  email: string;
  investorSince: string;
  kycLevel: "L1" | "L2" | "L3";
  kycVerifiedAt: string;
  country: string;
  currency: string;
  tier: string;
  unread: number;
  /** Mirrors the I-6 profile so the shell header quotes one figure. */
  monthRoiPct: number;
}

export interface WalletBalance {
  available: number;
  lockedInPools: number;
  bookedInPools: number;
  interestRegistered: number;
  accruedInPools: number;
  pendingPayoutGross: number;
  pendingPayoutNet: number;
  pendingPayoutCount: number;
  totalAccountValue: number;
  currency: string;
  openingBalance: number;
  statementFrom: string;
  statementTo: string;
}

export interface WalletLifetime {
  deposited: number;
  depositCount: number;
  earnedCredited: number;
  earningCount: number;
  accruedInPools: number;
  withdrawn: number;
  payoutCount: number;
  feesPaid: number;
  investedFromWallet: number;
  refunded: number;
}

export interface WalletTransaction {
  id: string;
  at: string;
  type: WalletTxnType;
  /** Signed cash movement on the wallet: negative for outflows. */
  amount: number;
  /** Fee charged inside this movement (payouts), 0 when the rail charges it. */
  fee: number;
  method: string;
  methodLabel: string;
  status: WalletTxnStatus;
  reference: string;
  providerRef: string | null;
  description: string;
  poolCode: string | null;
  /** Running wallet balance after this row. Recomputed, never authored. */
  balanceAfter: number;
  linkedId: string | null;
}

export interface DepositField {
  name: string;
  label: string;
  kind: "text" | "tel" | "email" | "number" | "select" | "textarea";
  placeholder: string;
  hint?: string;
  required: boolean;
  options?: string[];
  maxLength?: number;
}

export interface DepositRail {
  key: DepositRailKey;
  label: string;
  tagline: string;
  icon: "vault" | "smartphone" | "wallet" | "globe" | "layers";
  feePct: number;
  feeFlat: number;
  feeNote: string;
  eta: string;
  minAmount: number;
  maxAmount: number;
  detail: string;
  fields: DepositField[];
}

export interface PayoutRail {
  key: PayoutRailKey;
  label: string;
  eta: string;
  feeNote: string;
  min: number;
  max: number;
  destination: string;
  detail: string;
}

export interface PaymentMethod {
  id: string;
  kind: WalletMethodKind;
  label: string;
  provider: string;
  detail: string;
  verified: boolean;
  isDefault: boolean;
  payoutEnabled: boolean;
  addedAt: string;
  reference: string;
  feeNote: string;
  limits: { min: number; max: number; daily: number };
  note: string;
}

export interface WalletPayout {
  id: string;
  reference: string;
  providerRef: string;
  gross: number;
  fee: number;
  net: number;
  rail: PayoutRailKey;
  methodId: string;
  destination: string;
  status: WalletPayoutStatus;
  requestedAt: string;
  expectedAt: string;
  processedAt: string | null;
  poolCode: string | null;
  note: string;
}

export interface WalletLimit {
  id: string;
  label: string;
  value: string;
  detail: string;
  state: "ok" | "near" | "blocked";
}

export interface WalletFilters {
  types: WalletTxnType[];
  methods: string[];
  from: string;
  to: string;
  query: string;
}

export interface WalletPreferences {
  emailReceipts: boolean;
  autoPayout: boolean;
  payoutThreshold: number;
  lowBalanceAlert: boolean;
}

export interface WalletExport {
  id: string;
  scope: "statement" | "transactions" | "payouts" | "methods";
  format: "pdf" | "csv" | "json";
  count: number;
  createdAt: string;
}

export interface WalletAcknowledgement {
  scope: "risk" | "fees" | "limits";
  at: string;
}

export interface WalletSupport {
  id: string;
  topic: "deposit" | "payout" | "method" | "fees" | "other";
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface WalletAuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface WalletWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: WalletProfile;
  balance: WalletBalance;
  lifetime: WalletLifetime;
  depositRails: DepositRail[];
  payoutRails: PayoutRail[];
  methods: PaymentMethod[];
  payouts: WalletPayout[];
  transactions: WalletTransaction[];
  limits: WalletLimit[];
  filters: WalletFilters;
  preferences: WalletPreferences;
  exports: WalletExport[];
  acknowledgements: WalletAcknowledgement[];
  support: WalletSupport[];
  audit: WalletAuditEntry[];
}

/* ── Labels ── */

export const txnTypeLabel = (type: WalletTxnType) =>
  type === "deposit"
    ? "Deposit"
    : type === "investment"
      ? "Pool funding"
      : type === "earning"
        ? "Earning"
        : type === "payout"
          ? "Payout"
          : type === "fee"
            ? "Fee"
            : "Refund";

export const txnStatusLabel = (status: WalletTxnStatus) =>
  status === "completed"
    ? "Completed"
    : status === "processing"
      ? "Processing"
      : status === "pending"
        ? "Pending"
        : status === "failed"
          ? "Failed"
          : "Refunded";

export const payoutStatusLabel = (status: WalletPayoutStatus) =>
  status === "completed"
    ? "Paid"
    : status === "processing"
      ? "Processing"
      : status === "failed"
        ? "Failed"
        : "Refunded";

export const methodKindLabel = (kind: WalletMethodKind) =>
  kind === "bank"
    ? "Bank account"
    : kind === "mobile"
      ? "Mobile money"
      : kind === "card"
        ? "Card"
        : "Crypto wallet";

export const railLabel = (rail: PayoutRailKey) =>
  rail === "bank_transfer"
    ? "Bank transfer"
    : rail === "mobile_money"
      ? "Mobile money"
      : "Crypto";

export const txnTypes: WalletTxnType[] = [
  "deposit",
  "investment",
  "earning",
  "payout",
  "fee",
  "refund",
];

/* ── Fees ── */

/** Deposit fee for a rail: percentage plus any flat component. */
export const depositFee = (rail: DepositRail, amount: number) =>
  round2(Math.max(0, amount) * (rail.feePct / 100) + rail.feeFlat);

/** What the payer is charged in total for a deposit. */
export const depositTotal = (rail: DepositRail, amount: number) =>
  round2(Math.max(0, amount) + depositFee(rail, amount));

/**
 * Payout fee by destination kind:
 * bank 0.6% clamped to $1.50–$12, mobile money 1.5%, crypto a flat network fee.
 */
export function payoutFee(amount: number, kind: WalletMethodKind) {
  if (kind === "bank")
    return round2(Math.min(12, Math.max(1.5, amount * 0.006)));
  if (kind === "mobile")
    return round2(Math.min(25, Math.max(0.5, amount * 0.015)));
  if (kind === "crypto") return 2.2;
  return 0;
}

export const payoutNet = (amount: number, kind: WalletMethodKind) =>
  round2(Math.max(0, amount - payoutFee(amount, kind)));

/** Whole-dollar payout suggestion that respects the minimum. */
export const suggestedPayout = (available: number) => {
  const floored = Math.floor(available / 10) * 10;
  if (available <= MIN_PAYOUT) return round2(available);
  return Math.max(MIN_PAYOUT, Math.min(available, floored));
};

/* ── Validation ── */

export function payoutDraftError(input: {
  amount: number;
  available: number;
  method: PaymentMethod | null;
  terms: boolean;
}) {
  if (!input.method) return "Choose a destination for this payout";
  if (!input.method.verified)
    return `${input.method.label} is not verified yet — verify it first`;
  if (!input.method.payoutEnabled)
    return `${input.method.label} is a deposit-only method — pick a payout destination`;
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return "Enter a payout amount";
  if (input.amount < MIN_PAYOUT) return `Payouts start at ${money(MIN_PAYOUT)}`;
  if (input.amount > MAX_PAYOUT)
    return `A single request is capped at ${money(MAX_PAYOUT)}`;
  if (input.amount > input.available)
    return `Only ${money(input.available, 2)} is available to withdraw`;
  if (!input.terms) return "Acknowledge the payout terms to continue";
  return "";
}

export function depositDraftError(input: {
  amount: number;
  rail: DepositRail | null;
  fields: Record<string, string>;
  terms: boolean;
  dailyUsed: number;
}) {
  if (!input.rail) return "Choose how you want to fund the wallet";
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return "Enter a deposit amount";
  if (input.amount < Math.max(MIN_DEPOSIT, input.rail.minAmount))
    return `Minimum deposit on this rail is ${money(Math.max(MIN_DEPOSIT, input.rail.minAmount))}`;
  if (input.amount > input.rail.maxAmount)
    return `Maximum on this rail is ${money(input.rail.maxAmount)} per deposit`;
  if (input.dailyUsed + input.amount > DAILY_DEPOSIT_LIMIT)
    return `That would pass the ${money(DAILY_DEPOSIT_LIMIT)} daily deposit limit`;
  const missing = input.rail.fields.find(
    (field) => field.required && !(input.fields[field.name] ?? "").trim(),
  );
  if (missing) return `${missing.label} is required`;
  if (!input.terms) return "Confirm the fee and settlement terms to continue";
  return "";
}

/* ── Ledger maths ── */

/** Recompute the running balance of a ledger from its opening balance. */
export function withRunningBalance(
  rows: Omit<WalletTransaction, "balanceAfter">[],
  opening: number,
): WalletTransaction[] {
  let running = opening;
  return [...rows]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((row) => {
      running = round2(running + row.amount);
      return { ...row, balanceAfter: running } as WalletTransaction;
    });
}

export function deriveLifetime(rows: WalletTransaction[]) {
  const deposits = rows.filter((row) => row.type === "deposit");
  const earnings = rows.filter((row) => row.type === "earning");
  const payouts = rows.filter(
    (row) => row.type === "payout" && row.status === "completed",
  );
  const fees = rows.filter((row) => row.type === "fee");
  const investments = rows.filter((row) => row.type === "investment");
  const refunds = rows.filter((row) => row.type === "refund");
  return {
    deposited: round2(deposits.reduce((sum, row) => sum + row.amount, 0)),
    depositCount: deposits.length,
    earnedCredited: round2(earnings.reduce((sum, row) => sum + row.amount, 0)),
    earningCount: earnings.length,
    withdrawn: round2(
      Math.abs(payouts.reduce((sum, row) => sum + row.amount, 0)),
    ),
    payoutCount: payouts.length,
    feesPaid: round2(Math.abs(fees.reduce((sum, row) => sum + row.amount, 0))),
    investedFromWallet: round2(
      Math.abs(investments.reduce((sum, row) => sum + row.amount, 0)),
    ),
    refunded: round2(refunds.reduce((sum, row) => sum + row.amount, 0)),
  };
}

/** Money in and out for the current filter, used by the table footer. */
export function flowTotals(rows: WalletTransaction[]) {
  const inflow = round2(
    rows
      .filter((row) => row.amount > 0)
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const outflow = round2(
    Math.abs(
      rows
        .filter((row) => row.amount < 0)
        .reduce((sum, row) => sum + row.amount, 0),
    ),
  );
  return {
    inflow,
    outflow,
    net: round2(inflow - outflow),
    count: rows.length,
  };
}

export function filterTransactions(
  rows: WalletTransaction[],
  filters: WalletFilters,
) {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.types.length && !filters.types.includes(row.type)) return false;
    if (filters.methods.length && !filters.methods.includes(row.method))
      return false;
    if (filters.from && row.at.slice(0, 10) < filters.from) return false;
    if (filters.to && row.at.slice(0, 10) > filters.to) return false;
    if (!query) return true;
    return `${row.description} ${row.reference} ${row.providerRef ?? ""} ${row.methodLabel} ${row.poolCode ?? ""} ${row.type} ${row.status}`
      .toLowerCase()
      .includes(query);
  });
}

/** Newest first, ready for the statement table. */
export const newestFirst = (rows: WalletTransaction[]) =>
  [...rows].sort((a, b) => b.at.localeCompare(a.at));

/** Share of the account held in each bucket, for the split bar. */
export function balanceSplit(balance: WalletBalance) {
  const buckets = [
    { key: "available", label: "Wallet cash", value: balance.available },
    { key: "locked", label: "Trading in pools", value: balance.lockedInPools },
    {
      key: "pending",
      label: "Payout in flight",
      value: balance.pendingPayoutGross,
    },
  ];
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0) || 1;
  return buckets.map((bucket) => ({
    ...bucket,
    pct: round2((bucket.value / total) * 100),
  }));
}

export const methodById = (workspace: WalletWorkspace, id: string) =>
  workspace.methods.find((row) => row.id === id) ?? null;

export const defaultMethod = (workspace: WalletWorkspace) =>
  workspace.methods.find((row) => row.isDefault && row.payoutEnabled) ??
  workspace.methods.find((row) => row.payoutEnabled) ??
  null;

export const payoutRailFor = (method: PaymentMethod | null): PayoutRailKey =>
  method?.kind === "mobile"
    ? "mobile_money"
    : method?.kind === "crypto"
      ? "crypto"
      : "bank_transfer";

/** Deposits today, from the ledger, so the daily cap is enforced not guessed. */
export const depositedToday = (rows: WalletTransaction[], asOf: string) => {
  const day = asOf.slice(0, 10);
  return round2(
    rows
      .filter((row) => row.type === "deposit" && row.at.slice(0, 10) === day)
      .reduce((sum, row) => sum + row.amount, 0),
  );
};

export { atStamp, clockOf, dateOf, money, round2, shortDateOf, signedMoney };

/* ── Commands ── */

export const walletCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("deposit"),
    amount: z.number().min(MIN_DEPOSIT).max(MAX_DEPOSIT),
    rail: z.enum([
      "bank_transfer",
      "mobile_money",
      "card",
      "crypto",
      "stablecoin",
    ]),
    methodLabel: z.string().min(2).max(60),
    providerRef: z.string().max(60).default(""),
    note: z.string().max(160).default(""),
  }),
  z.object({
    kind: z.literal("requestPayout"),
    amount: z.number().min(MIN_PAYOUT).max(MAX_PAYOUT),
    methodId: z.string().min(2).max(40),
    note: z.string().max(160).default(""),
  }),
  z.object({
    kind: z.literal("cancelPayout"),
    payoutId: z.string().min(2).max(40),
    reason: z.enum([
      "changed_plan",
      "wrong_method",
      "slower_than_expected",
      "other",
    ]),
  }),
  z.object({
    kind: z.literal("retryPayout"),
    payoutId: z.string().min(2).max(40),
  }),
  z.object({
    kind: z.literal("addMethod"),
    methodKind: z.enum(["bank", "mobile", "card", "crypto"]),
    label: z.string().trim().min(3).max(40),
    provider: z.string().trim().min(2).max(40),
    detail: z.string().trim().min(4).max(60),
    reference: z.string().trim().min(3).max(60),
    note: z.string().max(160).default(""),
  }),
  z.object({
    kind: z.literal("verifyMethod"),
    methodId: z.string().min(2).max(40),
    code: z.string().regex(/^\d{6}$/),
  }),
  z.object({
    kind: z.literal("setDefaultMethod"),
    methodId: z.string().min(2).max(40),
  }),
  z.object({
    kind: z.literal("removeMethod"),
    methodId: z.string().min(2).max(40),
  }),
  z.object({
    kind: z.literal("saveFilters"),
    types: z
      .array(
        z.enum(["deposit", "investment", "earning", "payout", "fee", "refund"]),
      )
      .max(6),
    methods: z.array(z.string().max(30)).max(10),
    from: z.string().max(10),
    to: z.string().max(10),
    query: z.string().max(60),
  }),
  z.object({
    kind: z.literal("savePreferences"),
    emailReceipts: z.boolean(),
    autoPayout: z.boolean(),
    payoutThreshold: z.number().min(MIN_PAYOUT).max(MAX_PAYOUT),
    lowBalanceAlert: z.boolean(),
  }),
  z.object({
    kind: z.literal("exportReport"),
    scope: z.enum(["statement", "transactions", "payouts", "methods"]),
    format: z.enum(["pdf", "csv", "json"]),
    count: z.number().int().min(0).max(500),
  }),
  z.object({
    kind: z.literal("acknowledge"),
    scope: z.enum(["risk", "fees", "limits"]),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["deposit", "payout", "method", "fees", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
]);

export type WalletCommand = z.infer<typeof walletCommandSchema>;

const cancelReasons: Record<string, string> = {
  changed_plan: "changed plan",
  wrong_method: "wrong destination",
  slower_than_expected: "slower than expected",
  other: "other",
};

/** Recompute every derived figure from the ledger. */
function finish(workspace: WalletWorkspace): WalletWorkspace {
  workspace.transactions = withRunningBalance(
    workspace.transactions,
    workspace.balance.openingBalance,
  );
  const available = workspace.transactions.length
    ? workspace.transactions[workspace.transactions.length - 1].balanceAfter
    : workspace.balance.openingBalance;
  const pending = workspace.payouts.filter(
    (row) => row.status === "processing",
  );
  workspace.balance = {
    ...workspace.balance,
    available,
    pendingPayoutGross: round2(
      pending.reduce((sum, row) => sum + row.gross, 0),
    ),
    pendingPayoutNet: round2(pending.reduce((sum, row) => sum + row.net, 0)),
    pendingPayoutCount: pending.length,
    totalAccountValue: round2(available + workspace.balance.lockedInPools),
    statementTo: workspace.asOf,
  };
  workspace.lifetime = {
    ...workspace.lifetime,
    ...deriveLifetime(workspace.transactions),
  };
  workspace.revision += 1;
  return workspace;
}

export function applyWalletCommand(
  current: WalletWorkspace,
  input: WalletCommand,
  now = "2026-10-23T10:05:00Z",
): WalletWorkspace {
  const parsed = walletCommandSchema.parse(input);
  const workspace = structuredClone(current);

  const audit = (action: string, detail: string) => {
    workspace.audit = [
      {
        id: `wal_audit_${workspace.revision + 1}_${workspace.audit.length + 1}`,
        at: now,
        action,
        detail,
      },
      ...workspace.audit,
    ].slice(0, 40);
  };

  switch (parsed.kind) {
    case "deposit": {
      const rail = workspace.depositRails.find(
        (row) => row.key === parsed.rail,
      );
      if (!rail) throw new Error("That deposit rail is not available");
      if (parsed.amount < rail.minAmount)
        throw new Error(
          `Minimum deposit on ${rail.label} is ${money(rail.minAmount)}`,
        );
      if (parsed.amount > rail.maxAmount)
        throw new Error(
          `Maximum deposit on ${rail.label} is ${money(rail.maxAmount)}`,
        );
      const used = depositedToday(workspace.transactions, workspace.asOf);
      if (used + parsed.amount > DAILY_DEPOSIT_LIMIT)
        throw new Error(
          `That would pass the ${money(DAILY_DEPOSIT_LIMIT)} daily deposit limit`,
        );
      const providerRef =
        parsed.providerRef ||
        `${parsed.rail === "card" ? "stripe_pi" : parsed.rail === "mobile_money" ? "mpesa_rcpt" : "ach_tr"}_${workspace.revision + 11}${workspace.transactions.length}`;
      workspace.transactions = [
        ...workspace.transactions,
        {
          id: `txn_dep_${workspace.revision + 1}`,
          at: now,
          type: "deposit",
          amount: round2(parsed.amount),
          fee: depositFee(rail, parsed.amount),
          method: parsed.rail,
          methodLabel: parsed.methodLabel,
          status: "processing",
          reference: `dep_${workspace.revision + 1}${workspace.transactions.length}`,
          providerRef,
          description:
            parsed.note.trim() ||
            `${rail.label} deposit · clears ${rail.eta.toLowerCase()}`,
          poolCode: null,
          balanceAfter: 0,
          linkedId: null,
        },
      ];
      audit(
        "deposit_requested",
        `${money(parsed.amount, 2)} via ${rail.label}. Recorded locally — no provider was charged.`,
      );
      return finish(workspace);
    }
    case "requestPayout": {
      const method = workspace.methods.find(
        (row) => row.id === parsed.methodId,
      );
      if (!method) throw new Error("That destination is not saved");
      if (!method.verified)
        throw new Error(`${method.label} is not verified yet`);
      if (!method.payoutEnabled)
        throw new Error(`${method.label} is a deposit-only method`);
      if (parsed.amount > workspace.balance.available)
        throw new Error(
          `Only ${money(workspace.balance.available, 2)} is available to withdraw`,
        );
      const fee = payoutFee(parsed.amount, method.kind);
      const net = round2(parsed.amount - fee);
      const id = `wpo_${workspace.revision + 1}_${workspace.payouts.length + 1}`;
      workspace.payouts = [
        {
          id,
          reference: `PO-${now.slice(0, 10)}-${String(60 + workspace.payouts.length)}`,
          providerRef: `pay_${(workspace.revision + 1).toString(16)}${workspace.payouts.length}f`,
          gross: round2(parsed.amount),
          fee,
          net,
          rail: payoutRailFor(method),
          methodId: method.id,
          destination: method.detail,
          status: "processing",
          requestedAt: now,
          expectedAt: new Date(Date.parse(now) + 2 * 86_400_000).toISOString(),
          processedAt: null,
          poolCode: null,
          note:
            parsed.note.trim() ||
            "Bank payouts clear on the next 17:00 UTC batch.",
        },
        ...workspace.payouts,
      ];
      workspace.transactions = [
        ...workspace.transactions,
        {
          id: `txn_po_${workspace.revision + 1}`,
          at: now,
          type: "payout",
          amount: round2(-parsed.amount),
          fee,
          method: payoutRailFor(method),
          methodLabel: method.detail,
          status: "processing",
          reference: `PO-${now.slice(0, 10)}-${String(60 + workspace.payouts.length - 1)}`,
          providerRef: null,
          description: `Payout to ${method.label.toLowerCase()} · net ${money(net, 2)} after ${money(fee, 2)} fee`,
          poolCode: null,
          balanceAfter: 0,
          linkedId: id,
        },
      ];
      audit(
        "payout_requested",
        `${money(parsed.amount, 2)} to ${method.detail}. Queued locally — no provider call is made.`,
      );
      return finish(workspace);
    }
    case "cancelPayout": {
      const payout = workspace.payouts.find(
        (row) => row.id === parsed.payoutId,
      );
      if (!payout) throw new Error("That payout is not in your history");
      if (payout.status !== "processing")
        throw new Error("Only a processing payout can be cancelled");
      workspace.payouts = workspace.payouts.map((row) =>
        row.id === payout.id ? { ...row, status: "refunded" as const } : row,
      );
      workspace.transactions = [
        ...workspace.transactions.map((row) =>
          row.linkedId === payout.id
            ? { ...row, status: "refunded" as const }
            : row,
        ),
        {
          id: `txn_rf_${workspace.revision + 1}`,
          at: now,
          type: "refund",
          amount: round2(payout.gross),
          fee: 0,
          method: payout.rail,
          methodLabel: payout.destination,
          status: "completed",
          reference: `rf_${payout.reference.slice(-4).toLowerCase()}`,
          providerRef: null,
          description: `Cancelled payout returned to the wallet (${cancelReasons[parsed.reason]})`,
          poolCode: payout.poolCode,
          balanceAfter: 0,
          linkedId: payout.id,
        },
      ];
      audit(
        "payout_cancelled",
        `${payout.reference} cancelled — ${cancelReasons[parsed.reason]}. ${money(payout.gross, 2)} returned to the wallet locally.`,
      );
      return finish(workspace);
    }
    case "retryPayout": {
      const payout = workspace.payouts.find(
        (row) => row.id === parsed.payoutId,
      );
      if (!payout) throw new Error("That payout is not in your history");
      if (payout.status === "completed")
        throw new Error("A completed payout cannot be retried");
      if (payout.gross > workspace.balance.available)
        throw new Error(
          `Only ${money(workspace.balance.available, 2)} is available to withdraw`,
        );
      workspace.payouts = workspace.payouts.map((row) =>
        row.id === payout.id
          ? { ...row, status: "processing" as const, requestedAt: now }
          : row,
      );
      workspace.transactions = [
        ...workspace.transactions.map((row) =>
          row.linkedId === payout.id
            ? { ...row, status: "processing" as const, at: now }
            : row,
        ),
        {
          id: `txn_po_${workspace.revision + 1}_retry`,
          at: now,
          type: "payout",
          amount: round2(-payout.gross),
          fee: payout.fee,
          method: payout.rail,
          methodLabel: payout.destination,
          status: "processing",
          reference: payout.reference,
          providerRef: null,
          description: `Retried payout · net ${money(payout.net, 2)} after ${money(payout.fee, 2)} fee`,
          poolCode: payout.poolCode,
          balanceAfter: 0,
          linkedId: payout.id,
        },
      ];
      audit("payout_retried", `${payout.reference} queued again locally.`);
      return finish(workspace);
    }
    case "addMethod": {
      const id = `pm_${workspace.revision + 1}_${workspace.methods.length + 1}`;
      workspace.methods = [
        ...workspace.methods,
        {
          id,
          kind: parsed.methodKind,
          label: parsed.label,
          provider: parsed.provider,
          detail: parsed.detail,
          verified: false,
          isDefault: false,
          payoutEnabled: parsed.methodKind !== "card",
          addedAt: now,
          reference: parsed.reference,
          feeNote:
            parsed.methodKind === "bank"
              ? "0.6% · capped at $12"
              : parsed.methodKind === "mobile"
                ? "1.5% · instant – 30 min"
                : parsed.methodKind === "crypto"
                  ? "Network fee · 15–60 min"
                  : "2.9% + $0.30 on deposits",
          limits:
            parsed.methodKind === "bank"
              ? { min: MIN_PAYOUT, max: MAX_PAYOUT, daily: MAX_PAYOUT }
              : { min: MIN_PAYOUT, max: 5_000, daily: 5_000 },
          note: parsed.note,
        },
      ];
      audit(
        "method_added",
        `${parsed.label} added — a six-digit code verifies it before it can receive a payout.`,
      );
      return finish(workspace);
    }
    case "verifyMethod": {
      const method = workspace.methods.find(
        (row) => row.id === parsed.methodId,
      );
      if (!method) throw new Error("That method is not saved");
      workspace.methods = workspace.methods.map((row) =>
        row.id === method.id ? { ...row, verified: true } : row,
      );
      audit(
        "method_verified",
        `${method.label} verified locally with ${parsed.code}.`,
      );
      return finish(workspace);
    }
    case "setDefaultMethod": {
      const method = workspace.methods.find(
        (row) => row.id === parsed.methodId,
      );
      if (!method) throw new Error("That method is not saved");
      if (!method.verified)
        throw new Error("Verify the method before making it default");
      if (!method.payoutEnabled)
        throw new Error(
          "Deposit-only methods cannot be the default payout route",
        );
      workspace.methods = workspace.methods.map((row) => ({
        ...row,
        isDefault: row.id === method.id,
      }));
      audit(
        "method_default",
        `${method.label} is now the default payout route.`,
      );
      return finish(workspace);
    }
    case "removeMethod": {
      const method = workspace.methods.find(
        (row) => row.id === parsed.methodId,
      );
      if (!method) throw new Error("That method is not saved");
      if (workspace.methods.length <= 1)
        throw new Error("Keep at least one saved method on the account");
      if (
        method.isDefault &&
        !workspace.methods.some(
          (row) => row.id !== method.id && row.payoutEnabled,
        )
      )
        throw new Error(
          "Add another payout destination before removing the default",
        );
      const remaining = workspace.methods.filter((row) => row.id !== method.id);
      const promote = remaining.find((row) => row.payoutEnabled);
      workspace.methods = remaining.map((row) =>
        method.isDefault && promote && row.id === promote.id
          ? { ...row, isDefault: true }
          : row,
      );
      audit("method_removed", `${method.label} removed from the account.`);
      return finish(workspace);
    }
    case "saveFilters": {
      workspace.filters = {
        types: parsed.types,
        methods: parsed.methods,
        from: parsed.from,
        to: parsed.to,
        query: parsed.query,
      };
      audit(
        "filters_saved",
        `Statement filtered to ${parsed.types.length ? parsed.types.join(" + ") : "every type"}${parsed.query ? ` · “${parsed.query}”` : ""}.`,
      );
      return finish(workspace);
    }
    case "savePreferences": {
      workspace.preferences = {
        emailReceipts: parsed.emailReceipts,
        autoPayout: parsed.autoPayout,
        payoutThreshold: parsed.payoutThreshold,
        lowBalanceAlert: parsed.lowBalanceAlert,
      };
      audit(
        "preferences_saved",
        `Wallet preferences stored locally: receipts ${parsed.emailReceipts ? "emailed" : "in-app"}, auto-payout ${parsed.autoPayout ? `on at ${money(parsed.payoutThreshold)}` : "off"}.`,
      );
      return finish(workspace);
    }
    case "exportReport": {
      workspace.exports = [
        {
          id: `wexport_${workspace.revision + 1}`,
          scope: parsed.scope,
          format: parsed.format,
          count: parsed.count,
          createdAt: now,
        },
        ...workspace.exports,
      ].slice(0, 20);
      audit(
        "export_created",
        `${parsed.scope} export generated in the browser · ${parsed.count} row(s) · ${parsed.format.toUpperCase()}.`,
      );
      return finish(workspace);
    }
    case "acknowledge": {
      workspace.acknowledgements = [
        { scope: parsed.scope, at: now },
        ...workspace.acknowledgements.filter(
          (row) => row.scope !== parsed.scope,
        ),
      ].slice(0, 6);
      audit(
        "acknowledged",
        `${
          parsed.scope === "risk"
            ? "Risk disclosure"
            : parsed.scope === "fees"
              ? "Fee schedule"
              : "Wallet limits"
        } acknowledged locally at ${clockOf(now)} UTC. No document was signed.`,
      );
      return finish(workspace);
    }
    case "support": {
      workspace.support = [
        {
          id: `wsup_${workspace.revision + 1}`,
          topic: parsed.topic,
          message: parsed.message,
          status: "local_draft" as const,
          createdAt: now,
        },
        ...workspace.support,
      ].slice(0, 10);
      audit(
        "support_draft",
        `Message to the treasury desk saved locally (${parsed.topic}).`,
      );
      return finish(workspace);
    }
    default: {
      throw new Error("Unknown wallet command");
    }
  }
}
