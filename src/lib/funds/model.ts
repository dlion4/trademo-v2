import { z } from "zod";
import type {
  FundsBundle,
  FundsOverview,
  ReconciliationCheck,
  ReconciliationRun,
} from "./types";
const amount = z
  .number()
  .finite()
  .positive()
  .max(1000000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
    "Use at most two decimal places.",
  );
const notes = z
  .string()
  .trim()
  .min(10, "Add at least 10 characters of review context.")
  .max(1000);
export const intakeSchema = z.object({
  investorId: z.string().min(1),
  pool: z.enum(["PKG-01", "PKG-02", "PKG-03"]),
  amount,
  method: z.enum(["mobile_money", "bank_transfer", "crypto_usdt", "card"]),
  reference: z
    .string()
    .trim()
    .min(6, "Reference needs at least 6 characters.")
    .max(100),
});
export const fundsCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("verify"), id: z.string(), notes }),
  z.object({ kind: z.literal("reject"), id: z.string(), notes }),
  z.object({ kind: z.literal("requestInfo"), id: z.string(), notes }),
  z.object({ kind: z.literal("register"), deposit: intakeSchema, notes }),
  z.object({
    kind: z.literal("rebalance"),
    allocations: z
      .array(
        z.object({
          code: z.string(),
          deployed: z.number().finite().min(0).max(1000000),
        }),
      )
      .length(3),
    notes,
  }),
  z.object({
    kind: z.literal("reservePolicy"),
    percent: z.number().finite().min(1).max(20),
    notes,
  }),
  z.object({
    kind: z.literal("reserveTopUp"),
    source: z.enum(["cash", "positions"]),
    notes,
  }),
  z.object({ kind: z.literal("reconcile"), notes }),
  z.object({ kind: z.literal("note"), reference: z.string().min(1), notes }),
]);
export type FundsCommand = z.infer<typeof fundsCommandSchema>;
export type DepositIntake = z.infer<typeof intakeSchema>;
export const cents = (n: number) => Math.round(n * 100);
export const money = (n: number) => Math.round(n * 100) / 100;
export function getFundsOverview(s: FundsBundle): FundsOverview {
  const capital = money(s.ledgerCapital),
    deployed = money(s.allocations.reduce((n, p) => n + p.deployed, 0));
  const pending = s.deposits.filter(
    (d) => !["verified", "rejected"].includes(d.status),
  );
  const reserveTarget = money((capital * s.reserve.targetPercent) / 100);
  return {
    capital,
    deployed,
    available: money(s.custody.brokerCash + s.custody.escrow),
    pending: money(pending.reduce((n, d) => n + d.amount, 0)),
    pendingCount: pending.length,
    brokerCash: s.custody.brokerCash,
    escrow: s.custody.escrow,
    reserve: s.reserve.balance,
    spendable: money(s.custody.brokerCash - s.reserve.balance),
    utilization: capital ? (deployed / capital) * 100 : 0,
    reserveTarget,
    reserveGap: Math.max(0, money(reserveTarget - s.reserve.balance)),
  };
}
export function reconciliationChecks(s: FundsBundle): ReconciliationCheck[] {
  return [
    {
      key: "custody",
      label: "Net capital ledger ↔ broker positions + cash + escrow",
      expected: s.ledgerCapital,
      actual: money(
        s.custody.positions + s.custody.brokerCash + s.custody.escrow,
      ),
    },
    {
      key: "funding",
      label: "Net capital ledger ↔ package funded principal",
      expected: s.ledgerCapital,
      actual: money(s.allocations.reduce((n, p) => n + p.capital, 0)),
    },
    {
      key: "deployment",
      label: "Package deployment ↔ broker position control",
      expected: money(s.allocations.reduce((n, p) => n + p.deployed, 0)),
      actual: s.custody.positions,
    },
  ].map((c) => ({ ...c, difference: money(c.actual - c.expected) }));
}
export function assertFundsInvariant(s: FundsBundle) {
  const finite = [
    s.ledgerCapital,
    s.custody.brokerCash,
    s.custody.positions,
    s.custody.escrow,
    s.reserve.balance,
    ...s.allocations.flatMap((p) => [p.capital, p.deployed]),
  ];
  if (finite.some((n) => !Number.isFinite(n) || n < 0))
    throw Error("Balances must be finite and non-negative.");
  if (s.reserve.balance > s.custody.brokerCash + 0.001)
    throw Error(
      "Reserve must be backed by broker cash, not escrow or open positions.",
    );
  if (s.allocations.some((p) => p.deployed > p.capital + 0.001))
    throw Error("Deployment cannot exceed a package’s funded capital.");
  if (reconciliationChecks(s).some((c) => Math.abs(c.difference) > 0.001))
    throw Error(
      "Capital conservation failed; review the reconciliation before making changes.",
    );
}
export function applyFundsCommand(
  current: FundsBundle,
  input: FundsCommand,
  now = new Date().toISOString(),
): FundsBundle {
  const command = fundsCommandSchema.parse(input);
  const s = structuredClone(current);
  const id = `fund_${s.revision + 1}_${Date.parse(now)}`;
  let reference = "treasury";
  if (command.kind !== "reconcile" && command.kind !== "note")
    assertFundsInvariant(s);
  const flow = (
    kind: FundsBundle["movements"][number]["kind"],
    value: number,
    from: string,
    to: string,
    ref: string,
    note: string,
  ) =>
    s.movements.unshift({
      id: `${id}_flow`,
      time: now,
      kind,
      amount: value,
      from,
      to,
      reference: ref,
      status: "posted",
      note,
    });
  if (
    command.kind === "verify" ||
    command.kind === "reject" ||
    command.kind === "requestInfo"
  ) {
    const d = s.deposits.find((d) => d.id === command.id);
    if (!d) throw Error("Deposit was not found.");
    if (["verified", "rejected"].includes(d.status))
      throw Error(
        "This deposit is already final. Duplicate financial actions are blocked.",
      );
    reference = d.id;
    d.notes.push(command.notes);
    if (command.kind === "verify") {
      if (!d.kycVerified)
        throw Error("KYC must be verified before crediting this deposit.");
      if (!d.providerSettled)
        throw Error(
          "Provider settlement evidence is still outstanding. Request information instead.",
        );
      const p = s.allocations.find((p) => p.code === d.pool);
      if (!p) throw Error("Package was not found.");
      d.status = "verified";
      d.verifiedBy = "jane_op (local demo)";
      s.ledgerCapital = money(s.ledgerCapital + d.amount);
      s.custody.brokerCash = money(s.custody.brokerCash + d.amount);
      p.capital = money(p.capital + d.amount);
      flow(
        "deposit_in",
        d.amount,
        d.investorName,
        "Broker cash",
        d.id,
        "Local settlement simulation; no real wallet credit.",
      );
    } else
      d.status =
        command.kind === "reject" ? "rejected" : "information_requested";
  }
  if (command.kind === "register") {
    const d = command.deposit;
    const i = s.investors.find((i) => i.id === d.investorId);
    if (!i) throw Error("Choose a known investor.");
    if (
      s.deposits.some(
        (x) => x.reference.toLowerCase() === d.reference.toLowerCase(),
      )
    )
      throw Error("A deposit with this reference already exists.");
    if (!s.allocations.some((p) => p.code === d.pool))
      throw Error("Package was not found.");
    reference = `dep_local_${s.revision + 1}`;
    s.deposits.unshift({
      id: reference,
      date: now,
      investorId: i.id,
      investorName: i.name,
      amount: d.amount,
      currency: "USD",
      method: d.method,
      pool: d.pool,
      status: "submitted",
      verifiedBy: null,
      reference: d.reference,
      providerSettled: false,
      kycVerified: i.kycVerified,
      notes: [command.notes],
    });
    s.movements.unshift({
      id: `${id}_flow`,
      time: now,
      kind: "deposit_in",
      amount: d.amount,
      from: i.name,
      to: "External settlement pending",
      reference,
      status: "pending",
      note: "Intake recorded only; not included in owned capital or escrow.",
    });
  }
  if (command.kind === "rebalance") {
    if (
      new Set(command.allocations.map((p) => p.code)).size !==
      s.allocations.length
    )
      throw Error("Each package must appear once.");
    command.allocations.forEach((a) => {
      const p = s.allocations.find((p) => p.code === a.code);
      if (!p) throw Error("Unknown package.");
      if (Math.abs(a.deployed * 100 - cents(a.deployed)) > 1e-6)
        throw Error("Deployment requires cent precision.");
      if (a.deployed > p.capital)
        throw Error(`${p.code} exceeds its funded capital.`);
      p.deployed = a.deployed;
    });
    const total = money(s.allocations.reduce((n, p) => n + p.deployed, 0));
    const cash = money(s.ledgerCapital - s.custody.escrow - total);
    if (cash < s.reserve.balance)
      throw Error(
        "This allocation would consume the protected reserve or escrow.",
      );
    const delta = money(total - s.custody.positions);
    s.custody.positions = total;
    s.custody.brokerCash = cash;
    flow(
      "allocation",
      delta,
      delta >= 0 ? "Broker cash" : "Positions",
      delta >= 0 ? "Positions" : "Broker cash",
      "allocation_plan",
      "Simulated settled position rebalance; no broker order.",
    );
  }
  if (command.kind === "reservePolicy")
    s.reserve.targetPercent = command.percent;
  if (command.kind === "reserveTopUp") {
    const overview = getFundsOverview(s);
    const gap = overview.reserveGap;
    if (!gap) throw Error("The reserve target is already met.");
    if (command.source === "cash") {
      if (gap > overview.spendable)
        throw Error(
          "Insufficient unreserved broker cash; choose position-release simulation.",
        );
    } else {
      if (gap > s.custody.positions)
        throw Error("Insufficient deployed principal to release.");
      const totalCents = cents(s.custody.positions);
      const reductions = s.allocations.map((p) => {
        const raw = (cents(gap) * cents(p.deployed)) / totalCents;
        return {
          code: p.code,
          value: Math.floor(raw),
          fraction: raw - Math.floor(raw),
        };
      });
      let remainder = cents(gap) - reductions.reduce((n, r) => n + r.value, 0);
      [...reductions]
        .sort((a, b) => b.fraction - a.fraction)
        .forEach((r) => {
          if (remainder > 0) {
            r.value++;
            remainder--;
          }
        });
      reductions.forEach((r) => {
        const p = s.allocations.find((p) => p.code === r.code)!;
        p.deployed = money(p.deployed - r.value / 100);
      });
      s.custody.positions = money(s.custody.positions - gap);
      s.custody.brokerCash = money(s.custody.brokerCash + gap);
    }
    s.reserve.balance = money(s.reserve.balance + gap);
    flow(
      "reserve",
      gap,
      command.source === "cash"
        ? "Unreserved broker cash"
        : "Released principal",
      "Protected reserve",
      "reserve_top_up",
      "Earmark within broker cash; not an external transfer.",
    );
  }
  if (command.kind === "reconcile") {
    const checks = reconciliationChecks(s);
    const difference = Math.max(...checks.map((c) => Math.abs(c.difference)));
    const run: ReconciliationRun = {
      sourceRevision: s.revision,
      id: `rec_${s.revision + 1}`,
      time: now,
      status: difference > 1 ? "alert" : difference > 0 ? "review" : "balanced",
      difference,
      checks,
      note: command.notes,
    };
    s.runs.unshift(run);
    s.runs = s.runs.slice(0, 5);
    reference = run.id;
  } else if (command.kind !== "note") assertFundsInvariant(s);
  if (command.kind === "note") reference = command.reference;
  s.audit.unshift({
    id,
    time: now,
    action: command.kind,
    reference,
    notes: command.notes,
  });
  s.revision++;
  return s;
}
