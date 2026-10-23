import { z } from "zod";
import type {
  PayoutBundle,
  PayoutDay,
  PayoutMethod,
  PayoutRequest,
  PayoutSettings,
} from "./types";
export const money = (n: number) => Math.round(n * 100) / 100;
const amount = z
  .number()
  .finite()
  .positive()
  .max(1000000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
    "Use cent precision.",
  );
const note = z
  .string()
  .trim()
  .min(10, "Provide at least 10 characters of review context.")
  .max(1000);
const ids = z
  .array(z.string().min(1))
  .min(1)
  .max(50)
  .refine((a) => new Set(a).size === a.length, "Duplicate request selection.");
export const settingsSchema = z
  .object({
    minimum: amount,
    maximum: amount,
    autoEnabled: z.boolean(),
    autoThreshold: z.number().finite().min(0).max(1000000),
    batchTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm UTC."),
    mobilePercent: z.number().finite().min(0).max(20),
    cardPercent: z.number().finite().min(0).max(20),
    cardFixed: z.number().finite().min(0).max(100),
    cryptoFee: z.number().finite().min(0).max(100),
  })
  .refine(
    (s) => s.maximum >= s.minimum,
    "Maximum must be at least the minimum.",
  )
  .refine(
    (s) => s.autoThreshold <= s.maximum,
    "Auto-approval threshold cannot exceed the maximum.",
  );
export const payoutDateRangeSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((v) => v.from <= v.to, "Start must not follow end.")
  .refine(
    (v) => (Date.parse(v.to) - Date.parse(v.from)) / 86400000 < 366,
    "Maximum 366 calendar days.",
  );
export const requestSchema = z.object({
  investorId: z.string().min(1),
  amount,
  method: z.enum(["bank_transfer", "mobile_money", "card", "crypto_usdt"]),
  pool: z.string().min(1),
  reason: z.enum(["partial_payout", "full_payout"]),
});
export type RequestDraft = z.infer<typeof requestSchema>;
export const payoutCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("request"), request: requestSchema, notes: note }),
  z.object({
    kind: z.literal("approve"),
    ids,
    processNow: z.boolean(),
    notes: note,
  }),
  z.object({ kind: z.literal("reject"), ids, notes: note }),
  z.object({ kind: z.literal("info"), id: z.string(), notes: note }),
  z.object({ kind: z.literal("batch"), ids, notes: note }),
  z.object({ kind: z.literal("complete"), id: z.string(), notes: note }),
  z.object({ kind: z.literal("fail"), id: z.string(), notes: note }),
  z.object({ kind: z.literal("retry"), id: z.string(), notes: note }),
  z.object({ kind: z.literal("refund"), id: z.string(), notes: note }),
  z.object({
    kind: z.literal("callback"),
    id: z.string(),
    attempt: z.number().int().positive(),
    reference: z.string().min(1),
    outcome: z.enum(["unknown", "settled", "failed"]),
    notes: note,
  }),
  z.object({
    kind: z.literal("beneficiary"),
    id: z.string(),
    masked: z.string().trim().min(6).max(60),
    token: z.string().trim().min(8).max(100),
    notes: note,
  }),
  z.object({
    kind: z.literal("contact"),
    id: z.string(),
    subject: z.string().trim().min(5).max(120),
    notes: note,
  }),
  z.object({
    kind: z.literal("settings"),
    settings: settingsSchema,
    notes: note,
  }),
]);
export type PayoutCommand = z.infer<typeof payoutCommandSchema>;
export const queueStatuses = ["pending", "information_requested", "approved"];
export const heldStatuses = [...queueStatuses, "processing", "failed"];
export function feeFor(
  amount: number,
  method: PayoutMethod,
  s: PayoutSettings,
) {
  return money(
    method === "bank_transfer"
      ? 0
      : method === "mobile_money"
        ? (amount * s.mobilePercent) / 100
        : method === "card"
          ? (amount * s.cardPercent) / 100 + s.cardFixed
          : s.cryptoFee,
  );
}
export function getPayoutSummary(s: PayoutBundle) {
  const sum = (list: PayoutRequest[]) =>
    money(list.reduce((n, r) => n + r.amount, 0));
  const pending = s.requests.filter((r) => queueStatuses.includes(r.status)),
    processing = s.requests.filter((r) => r.status === "processing"),
    completed = s.requests.filter((r) => r.status === "completed"),
    today = completed.filter(
      (r) => r.completedAt?.slice(0, 10) === s.asOf.slice(0, 10),
    );
  const durations = completed
    .filter((r) => r.startedAt && r.completedAt)
    .map(
      (r) => (Date.parse(r.completedAt!) - Date.parse(r.startedAt!)) / 60000,
    );
  const committed = s.requests.filter((r) =>
    ["approved", "processing"].includes(r.status),
  );
  return {
    pendingCount: pending.length,
    pending: sum(pending),
    processingCount: processing.length,
    processing: sum(processing),
    todayCount: today.length,
    today: sum(today),
    completedCount: completed.length,
    completed: sum(completed),
    averageMinutes: durations.length
      ? durations.reduce((n, m) => n + m, 0) / durations.length
      : null,
    fees: money(completed.reduce((n, r) => n + r.fee, 0)),
    committed: sum(committed),
    available: money(s.treasury.cash - s.treasury.reserve - sum(committed)),
    failed: s.requests.filter((r) => r.status === "failed").length,
  };
}
export function approvalBlockers(s: PayoutBundle, r: PayoutRequest) {
  const i = s.investors.find((i) => i.id === r.investorId);
  const reasons: string[] = [];
  if (!i || !i.kycVerified || i.kycLevel < 1)
    reasons.push("Investor KYC clearance is required.");
  if (!r.beneficiary.verified)
    reasons.push("Beneficiary verification is outstanding.");
  if (r.amount < s.settings.minimum || r.amount > s.settings.maximum)
    reasons.push("Amount is outside the current payout limits.");
  if (feeFor(r.amount, r.method, s.settings) >= r.amount)
    reasons.push("Fee would consume the payout amount.");
  return reasons;
}
export function autoEligible(s: PayoutBundle) {
  return s.requests.filter(
    (r) =>
      ["pending", "information_requested"].includes(r.status) &&
      s.settings.autoEnabled &&
      r.amount <= s.settings.autoThreshold &&
      s.investors.find((i) => i.id === r.investorId)?.kycLevel === 2 &&
      !approvalBlockers(s, r).length,
  );
}
export function payoutHistory(s: PayoutBundle, days = 30): PayoutDay[] {
  const end = Date.parse(s.asOf.slice(0, 10) + "T00:00:00Z");
  const completed = s.requests.filter((r) => r.status === "completed");
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const totals = new Map<
    string,
    { gross: number; fee: number; count: number }
  >();
  completed.forEach((r) => {
    const key = r.completedAt!.slice(0, 10),
      v = totals.get(key) ?? { gross: 0, fee: 0, count: 0 };
    v.gross += r.amount;
    v.fee += r.fee;
    v.count++;
    totals.set(key, v);
  });
  return Array.from({ length: days }, (_, i) => {
    const t = end - (days - 1 - i) * 86400000,
      k = day(t),
      v = totals.get(k) ?? { gross: 0, fee: 0, count: 0 };
    const avg =
      Array.from(
        { length: 7 },
        (_, j) => totals.get(day(t - j * 86400000))?.gross ?? 0,
      ).reduce((n, a) => n + a, 0) / 7;
    return {
      day: k,
      gross: money(v.gross),
      fee: money(v.fee),
      net: money(v.gross - v.fee),
      count: v.count,
      average7: money(avg),
    };
  });
}
export function assertPayoutInvariants(s: PayoutBundle) {
  if (!Number.isFinite(s.treasury.cash) || s.treasury.cash < s.treasury.reserve)
    throw Error("Cash cannot consume the protected reserve.");
  const paid = money(s.cashLedger.reduce((n, e) => n + e.gross, 0));
  if (Math.abs(money(s.treasury.openingCash - paid) - s.treasury.cash) > 0.001)
    throw Error("Treasury cash ledger does not reconcile.");
  if (getPayoutSummary(s).available < -0.001)
    throw Error("Insufficient uncommitted treasury liquidity.");
  for (const i of s.investors) {
    const held = money(
      s.requests
        .filter((r) => r.investorId === i.id && heldStatuses.includes(r.status))
        .reduce((n, r) => n + r.amount, 0),
    );
    if (
      [i.wallet.available, i.wallet.held, i.wallet.paid].some(
        (n) => !Number.isFinite(n) || n < 0,
      ) ||
      Math.abs(held - i.wallet.held) > 0.001 ||
      Math.abs(
        money(i.wallet.available + i.wallet.held + i.wallet.paid) -
          i.wallet.openingBalance,
      ) > 0.001
    )
      throw Error("Investor wallet reservation invariant failed.");
  }
  for (const r of s.requests) {
    if (
      [r.amount, r.fee, r.net].some((n) => !Number.isFinite(n)) ||
      r.amount <= 0 ||
      r.fee < 0 ||
      r.net <= 0 ||
      Math.abs(money(r.net + r.fee) - r.amount) > 0.001
    )
      throw Error("Gross payout must equal net plus fee.");
  }
}
export function applyPayoutCommand(
  current: PayoutBundle,
  input: PayoutCommand,
  now = new Date().toISOString(),
): PayoutBundle {
  const c = payoutCommandSchema.parse(input),
    s = structuredClone(current);
  assertPayoutInvariants(s);
  const requestIds: string[] = [];
  const get = (id: string) => {
    const r = s.requests.find((r) => r.id === id);
    if (!r) throw Error("Payout request was not found.");
    requestIds.push(id);
    return r;
  };
  const owner = (r: PayoutRequest) =>
    s.investors.find((i) => i.id === r.investorId)!;
  const requireState = (r: PayoutRequest, statuses: string[]) => {
    if (!statuses.includes(r.status))
      throw Error(
        `Action not allowed for ${r.status}; duplicate transitions are blocked.`,
      );
  };
  const start = (r: PayoutRequest) => {
    const available = getPayoutSummary(s).available;
    if (r.status !== "approved" && r.amount > available)
      throw Error("Insufficient uncommitted treasury liquidity.");
    r.status = "processing";
    r.startedAt = now;
    r.attempts++;
    r.providerReference = `demo_transfer_${r.id}_a${r.attempts}`;
    r.providerOutcome = "unknown";
    r.failureCode = null;
  };
  if (c.kind === "request") {
    const i = s.investors.find((i) => i.id === c.request.investorId);
    if (!i) throw Error("Investor was not found.");
    if (!i.pools.includes(c.request.pool))
      throw Error("Investor does not hold this package.");
    if (
      c.request.amount < s.settings.minimum ||
      c.request.amount > s.settings.maximum
    )
      throw Error("Amount is outside payout limits.");
    if (i.wallet.available < c.request.amount)
      throw Error("Insufficient available investor wallet balance.");
    const fee = feeFor(c.request.amount, c.request.method, s.settings);
    if (fee >= c.request.amount) throw Error("Fee would consume the payout.");
    const id = `pay_local_${s.revision + 1}`;
    requestIds.push(id);
    s.requests.unshift({
      id,
      investorId: i.id,
      investorName: i.name,
      amount: c.request.amount,
      fee,
      net: money(c.request.amount - fee),
      currency: "USD",
      method: c.request.method,
      pool: c.request.pool,
      reason: c.request.reason,
      status: "pending",
      requestedAt: now,
      startedAt: null,
      completedAt: null,
      beneficiary: {
        masked: "Demo destination •••• 2048",
        token: `demo_beneficiary_${i.id}`,
        verified: false,
      },
      providerReference: null,
      providerOutcome: "not_sent",
      failureCode: null,
      attempts: 0,
      notes: [c.notes],
    });
    i.wallet.available = money(i.wallet.available - c.request.amount);
    i.wallet.held = money(i.wallet.held + c.request.amount);
  }
  if (c.kind === "approve") {
    const rows = c.ids.map(get);
    for (const r of rows) {
      requireState(r, ["pending", "information_requested"]);
      const blocks = approvalBlockers(s, r);
      if (blocks.length) throw Error(`${r.id}: ${blocks.join(" ")}`);
      const fee = feeFor(r.amount, r.method, s.settings);
      r.fee = fee;
      r.net = money(r.amount - fee);
      if (c.processNow) start(r);
      else {
        if (r.amount > getPayoutSummary(s).available)
          throw Error("Insufficient liquidity for scheduled commitments.");
        r.status = "approved";
      }
    }
  }
  if (c.kind === "reject") {
    for (const r of c.ids.map(get)) {
      requireState(r, queueStatuses);
      r.status = "rejected";
      const i = owner(r);
      i.wallet.held = money(i.wallet.held - r.amount);
      i.wallet.available = money(i.wallet.available + r.amount);
    }
  }
  if (c.kind === "info") {
    const r = get(c.id);
    requireState(r, ["pending", "information_requested"]);
    r.status = "information_requested";
  }
  if (c.kind === "batch") {
    for (const r of c.ids.map(get)) {
      requireState(r, ["approved"]);
      const blocks = approvalBlockers(s, r);
      if (blocks.length) throw Error(blocks.join(" "));
      start(r);
    }
  }
  if (c.kind === "callback") {
    const r = get(c.id);
    requireState(r, ["processing"]);
    if (r.attempts !== c.attempt || r.providerReference !== c.reference)
      throw Error("Stale provider attempt or mismatched reference.");
    if (
      ["settled", "failed"].includes(r.providerOutcome) &&
      c.outcome !== r.providerOutcome
    )
      throw Error("A final evidence record cannot be overwritten.");
    r.providerOutcome = c.outcome;
    r.failureCode = c.outcome === "failed" ? "provider_timeout" : null;
  }
  if (c.kind === "complete") {
    const r = get(c.id);
    requireState(r, ["processing"]);
    if (r.providerOutcome !== "settled")
      throw Error("Final settled provider evidence is required.");
    r.status = "completed";
    r.completedAt = now;
    const i = owner(r);
    i.wallet.held = money(i.wallet.held - r.amount);
    i.wallet.paid = money(i.wallet.paid + r.amount);
    s.treasury.cash = money(s.treasury.cash - r.amount);
    s.cashLedger.push({
      id: `cash_${s.revision + 1}`,
      requestId: r.id,
      gross: r.amount,
      fee: r.fee,
      net: r.net,
      time: now,
    });
  }
  if (c.kind === "fail") {
    const r = get(c.id);
    requireState(r, ["processing"]);
    if (r.providerOutcome !== "failed")
      throw Error(
        "Confirmed failed/not-paid evidence is required; an unknown outcome cannot be retried or refunded.",
      );
    r.status = "failed";
  }
  if (c.kind === "retry") {
    const r = get(c.id);
    requireState(r, ["failed"]);
    if (r.providerOutcome !== "failed")
      throw Error("The previous attempt must be confirmed not paid.");
    const blocks = approvalBlockers(s, r);
    if (blocks.length) throw Error(blocks.join(" "));
    start(r);
  }
  if (c.kind === "refund") {
    const r = get(c.id);
    requireState(r, ["failed"]);
    if (r.providerOutcome !== "failed")
      throw Error(
        "Unknown or settled transfers cannot be released to a wallet.",
      );
    r.status = "refunded";
    const i = owner(r);
    i.wallet.held = money(i.wallet.held - r.amount);
    i.wallet.available = money(i.wallet.available + r.amount);
  }
  if (c.kind === "beneficiary") {
    const r = get(c.id);
    requireState(r, ["pending", "information_requested", "failed"]);
    r.beneficiary = { masked: c.masked, token: c.token, verified: true };
  }
  if (c.kind === "contact") {
    get(c.id);
  }
  if (c.kind === "settings") s.settings = c.settings;
  for (const id of new Set(requestIds)) {
    const r = s.requests.find((r) => r.id === id)!;
    if (c.kind !== "request")
      r.notes.push(c.kind === "contact" ? `${c.subject}: ${c.notes}` : c.notes);
  }
  const evidence = (r: PayoutRequest) => ({
    id: r.id,
    status: r.status,
    attempt: r.attempts,
    reference: r.providerReference,
    outcome: r.providerOutcome,
    gross: r.amount,
    fee: r.fee,
    net: r.net,
  });
  s.audit.unshift({
    before: current.requests
      .filter((r) => requestIds.includes(r.id))
      .map(evidence),
    after: s.requests.filter((r) => requestIds.includes(r.id)).map(evidence),
    ...(c.kind === "settings"
      ? {
          policyBefore: structuredClone(current.settings),
          policyAfter: structuredClone(s.settings),
        }
      : {}),
    id: `payout_audit_${s.revision + 1}`,
    time: now,
    action: c.kind,
    requestIds,
    notes: c.kind === "contact" ? `${c.subject}: ${c.notes}` : c.notes,
    revision: s.revision + 1,
  });
  s.revision++;
  assertPayoutInvariants(s);
  return s;
}
