import { z } from "zod";
import { methods, statuses, type Deposit, type DepositBundle } from "./types";
export const rulesSchema = z
  .object({
    crypto: z.boolean(),
    card: z.boolean(),
    mobile: z.boolean(),
    bank: z.boolean(),
    crossCheck: z.boolean(),
    flagMismatch: z.boolean(),
    rejectExpired: z.boolean(),
    confirmations: z.number().int().min(6).max(100),
    threshold: z.number().min(0).max(1),
  })
  .refine((r) => !r.bank, "Bank transfers always require manual verification.")
  .refine(
    (r) => r.crossCheck && r.flagMismatch,
    "Amount reconciliation and mismatch flags cannot be disabled.",
  );
const note = z.string().trim().min(10).max(1200);
export const commandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("verify"),
    ids: z.array(z.string()).min(1).max(50),
    notes: note,
  }),
  z.object({
    kind: z.enum(["reject", "proof", "retry", "refund", "note"]),
    id: z.string(),
    notes: note,
  }),
  z.object({
    kind: z.literal("evidence"),
    id: z.string(),
    outcome: z.enum(["settled", "unknown", "failed"]),
    amount: z.number().positive().max(1000000).multipleOf(0.01),
    confirmations: z.number().int().min(0).max(100),
    notes: note,
  }),
  z.object({ kind: z.literal("rules"), rules: rulesSchema, notes: note }),
  z.object({ kind: z.literal("automation"), notes: note }),
  z.object({
    kind: z.literal("record"),
    investorId: z.string(),
    amount: z.number().min(10).max(100000).multipleOf(0.01),
    method: z.enum(methods),
    pool: z.string(),
    reference: z
      .string()
      .trim()
      .min(6)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
    notes: note,
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export const filterSchema = z
  .object({
    search: z.string().max(120).default(""),
    status: z.enum(["all", ...statuses]).default("all"),
    method: z.enum(["all", ...methods]).default("all"),
    pool: z.string().max(30).default("all"),
    investor: z.string().max(100).default("all"),
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .strict()
  .refine((f) => f.from <= f.to, "Start date must not exceed end date.");
export type Filters = z.infer<typeof filterSchema>;
export function filterDeposits(s: DepositBundle, f: Filters) {
  const parsed = filterSchema.parse(f);
  return s.deposits.filter(
    (d) =>
      (parsed.status === "all" || d.status === parsed.status) &&
      (parsed.method === "all" || d.method === parsed.method) &&
      (parsed.pool === "all" || d.pool === parsed.pool) &&
      (parsed.investor === "all" || d.investorId === parsed.investor) &&
      d.submittedAt.slice(0, 10) >= parsed.from &&
      d.submittedAt.slice(0, 10) <= parsed.to &&
      `${d.id} ${d.investorName} ${d.reference}`
        .toLowerCase()
        .includes(parsed.search.toLowerCase()),
  );
}
export const reviewable = (d: Deposit) =>
  ["submitted", "pending", "information_requested"].includes(d.status);
export function blockers(d: Deposit, r: DepositBundle["rules"]) {
  return [
    !reviewable(d) ? "Deposit is not awaiting verification" : null,
    !d.kycVerified ? "Investor KYC is not verified" : null,
    d.provider.outcome !== "settled"
      ? "No simulated provider settlement evidence"
      : null,
    Math.abs(d.amount - d.provider.amount) > 0.005
      ? "Claimed and provider amounts do not match"
      : null,
    !d.proof ? "Payment proof is missing" : null,
    d.method === "crypto_usdt" && d.provider.confirmations < r.confirmations
      ? `Requires ${r.confirmations} confirmations`
      : null,
    d.method !== "bank_transfer" && !d.provider.webhookVerified
      ? "No simulated authenticated webhook evidence"
      : null,
    d.credited ? "Already credited" : null,
  ].filter((v): v is string => !!v);
}
export function summary(rows: Deposit[], day: string) {
  const total = (list: Deposit[]) => list.reduce((n, d) => n + d.amount, 0);
  const verified = rows.filter((d) => d.status === "verified"),
    pending = rows.filter(reviewable),
    times = rows
      .filter((d) => d.verifiedAt)
      .map(
        (d) => (Date.parse(d.verifiedAt!) - Date.parse(d.submittedAt)) / 60000,
      );
  return {
    received: total(
      rows.filter((d) => ["verified", "refunded"].includes(d.status)),
    ),
    verified: total(verified),
    pending: total(pending),
    failed: total(rows.filter((d) => d.status === "failed")),
    refunded: total(rows.filter((d) => d.status === "refunded")),
    today: total(rows.filter((d) => d.submittedAt.startsWith(day))),
    avgMinutes: times.length
      ? times.reduce((a, b) => a + b, 0) / times.length
      : null,
  };
}
export function methodBreakdown(rows: Deposit[]) {
  return methods.map((method) => {
    const list = rows.filter((d) => d.method === method),
      v = list.filter((d) => d.verifiedAt);
    return {
      method,
      count: list.length,
      total: list.reduce((n, d) => n + d.amount, 0),
      verifiedRate: list.length
        ? (list.filter((d) => d.status === "verified").length / list.length) *
          100
        : null,
      minutes: v.length
        ? v.reduce(
            (n, d) =>
              n +
              (Date.parse(d.verifiedAt!) - Date.parse(d.submittedAt)) / 60000,
            0,
          ) / v.length
        : null,
      fees:
        method === "card"
          ? "2.9% + $0.30"
          : method === "mobile_money"
            ? "1.5%"
            : method === "crypto_usdt"
              ? "Network fee (variable)"
              : "0%",
    };
  });
}
export function timeline(rows: Deposit[], date: string) {
  return Array.from({ length: 6 }, (_, i) => {
    const list = rows.filter(
      (d) =>
        d.submittedAt.startsWith(date) &&
        Math.floor(Number(d.submittedAt.slice(11, 13)) / 4) === i,
    );
    return {
      hour: i * 4,
      label: `${String(i * 4).padStart(2, "0")}–${String(i * 4 + 4).padStart(2, "0")} UTC`,
      count: list.length,
      total: list.reduce((n, d) => n + d.amount, 0),
    };
  });
}
export function assertDeposits(s: DepositBundle) {
  if (
    new Set(s.deposits.map((d) => d.id)).size !== s.deposits.length ||
    new Set(s.deposits.map((d) => d.reference.toLowerCase())).size !==
      s.deposits.length
  )
    throw Error("Duplicate deposit identity or reference.");
  for (const d of s.deposits) {
    if (d.credited && d.status !== "verified")
      throw Error("Only verified deposits can hold local credit.");
    if (!Number.isFinite(Date.parse(d.submittedAt)))
      throw Error("Invalid deposit date.");
    if (!(d.amount > 0) || !Number.isFinite(d.amount))
      throw Error("Invalid amount.");
    if (
      d.status === "verified" &&
      (!d.credited || !d.verifiedAt || !d.verifiedBy)
    )
      throw Error("Missing verification ledger evidence.");
    if (d.status === "refunded" && (d.credited || !d.refundReference))
      throw Error("Invalid refund ledger evidence.");
  }
  const credit = s.deposits
    .filter((d) => d.credited)
    .reduce((n, d) => n + d.amount, 0);
  if (Math.abs(credit - s.openingCredit - s.localCredit) > 0.005)
    throw Error("Local credit conservation failed.");
}
export function applyDepositCommand(
  current: DepositBundle,
  input: Command,
  now = new Date().toISOString(),
) {
  const c = commandSchema.parse(input),
    s = structuredClone(current);
  assertDeposits(s);
  let ref = "workspace";
  const get = (id: string) => {
    const d = s.deposits.find((d) => d.id === id);
    if (!d) throw Error("Deposit not found.");
    return d;
  };
  const verify = (d: Deposit) => {
    const reasons = blockers(d, s.rules);
    if (reasons.length) throw Error(`${d.id}: ${reasons.join("; ")}`);
    d.status = "verified";
    d.verifiedBy = "local_operator";
    d.verifiedAt = now;
    d.credited = true;
    s.localCredit += d.amount;
    d.notes.push(c.notes);
  };
  if (c.kind === "verify") {
    const ids = [...new Set(c.ids)];
    ids.forEach((id) => verify(get(id)));
    ref = ids.join(", ");
  } else if (c.kind === "rules") s.rules = c.rules;
  else if (c.kind === "automation") {
    for (const d of s.deposits.filter(reviewable)) {
      const enabled =
        d.method === "crypto_usdt"
          ? s.rules.crypto
          : d.method === "card"
            ? s.rules.card
            : d.method === "mobile_money"
              ? s.rules.mobile
              : false;
      if (enabled && !blockers(d, s.rules).length) verify(d);
      else if (
        s.rules.rejectExpired &&
        !d.proof &&
        d.provider.outcome !== "settled" &&
        Date.parse(now) - Date.parse(d.submittedAt) > 86400000
      ) {
        d.status = "rejected";
        d.notes.push(
          "Local expiry simulation; no external settlement evidence.",
        );
      }
    }
  } else if (c.kind === "record") {
    const investor = s.investors.find((i) => i.id === c.investorId);
    if (!investor || !s.pools.some((p) => p.code === c.pool))
      throw Error("Unknown investor or package.");
    if (
      s.deposits.some(
        (d) => d.reference.toLowerCase() === c.reference.toLowerCase(),
      )
    )
      throw Error("Payment reference already exists.");
    ref = `dep_local_${s.revision + 1}`;
    s.deposits.unshift({
      id: ref,
      investorId: investor.id,
      investorName: investor.name,
      amount: c.amount,
      currency: "USD",
      method: c.method,
      methodDetails: {
        provider: "Not connected",
        maskedAccount: "Not supplied",
        network: null,
      },
      investmentId: null,
      pool: c.pool,
      reference: c.reference,
      submittedAt: now,
      status: "submitted",
      verifiedAt: null,
      verifiedBy: null,
      kycVerified: investor.kycVerified,
      provider: {
        outcome: "unknown",
        amount: c.amount,
        reference: "not_received",
        confirmations: 0,
        webhookVerified: false,
      },
      proof: null,
      notes: [c.notes],
      attempts: 1,
      failure: null,
      refundReference: null,
      credited: false,
    });
  } else {
    const d = get(c.id);
    ref = d.id;
    if (c.kind === "note") d.notes.push(c.notes);
    else if (c.kind === "evidence") {
      if (!reviewable(d) && d.status !== "failed")
        throw Error("Evidence cannot rewrite finalized records.");
      d.provider = {
        ...d.provider,
        outcome: c.outcome,
        amount: c.amount,
        confirmations: c.confirmations,
        reference: `demo_evidence_${s.revision + 1}`,
        webhookVerified: c.outcome === "settled",
      };
      d.proof = {
        id: `demo_receipt_${s.revision + 1}`,
        kind: d.method === "crypto_usdt" ? "transaction" : "receipt",
        receivedAt: now,
      };
      d.notes.push(`SYNTHETIC EVIDENCE: ${c.notes}`);
    } else if (c.kind === "reject") {
      if (!reviewable(d) || d.provider.outcome === "settled")
        throw Error(
          "Only unresolved, unsettled deposits can be rejected; settled funds require reconciliation.",
        );
      d.status = "rejected";
      d.notes.push(c.notes);
    } else if (c.kind === "proof") {
      if (!reviewable(d))
        throw Error("Deposit is not in the verification queue.");
      d.status = "information_requested";
      d.notes.push(`Local proof request draft (not sent): ${c.notes}`);
    } else if (c.kind === "retry") {
      if (d.status !== "failed" || d.provider.outcome === "settled")
        throw Error("Only a failed, unsettled attempt can be retried.");
      d.status = "pending";
      d.attempts++;
      d.failure = null;
      d.provider.outcome = "unknown";
      d.provider.webhookVerified = false;
      d.notes.push(c.notes);
    } else if (c.kind === "refund") {
      if (d.status !== "verified" || !d.credited)
        throw Error(
          "Only verified, credited deposits can be refunded in this simulation.",
        );
      d.status = "refunded";
      d.credited = false;
      d.refundReference = `demo_refund_${s.revision + 1}`;
      s.localCredit -= d.amount;
      d.notes.push(`Simulated refund only: ${c.notes}`);
    }
  }
  s.revision++;
  s.audit.unshift({
    id: `dep_audit_${s.revision}`,
    time: now,
    action: c.kind,
    reference: ref,
    notes: c.notes,
  });
  assertDeposits(s);
  return s;
}
export function depositCSV(rows: Deposit[]) {
  const q = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    [
      "id",
      "submitted_utc",
      "investor",
      "amount_usd",
      "method",
      "package",
      "status",
      "reference",
      "verified_by",
    ],
    ...rows.map((d) => [
      d.id,
      d.submittedAt,
      d.investorName,
      d.amount,
      d.method,
      d.pool,
      d.status,
      d.reference,
      d.verifiedBy,
    ]),
  ]
    .map((r) => r.map(q).join(","))
    .join("\r\n");
}
