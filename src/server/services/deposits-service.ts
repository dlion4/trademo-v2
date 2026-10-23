import { getFundsBundle } from "./funds-service";
import { assertDeposits } from "@/lib/deposits/model";
import {
  methods,
  type DepositBundle,
  type Deposit,
} from "@/lib/deposits/types";
export function getDepositLogsBundle(): DepositBundle {
  const source = getFundsBundle();
  const asOf = "2026-10-23T10:00:00Z";
  const deposits: Deposit[] = Array.from({ length: 104 }, (_, i) => {
    const investor = source.investors[i % source.investors.length],
      method = methods[i % 4];
    const status: Deposit["status"] =
      i < 8
        ? i % 3 === 0
          ? "submitted"
          : i % 3 === 1
            ? "pending"
            : "information_requested"
        : i < 13
          ? "failed"
          : i < 16
            ? "refunded"
            : i === 16
              ? "rejected"
              : "verified";
    const submittedAt = new Date(
      Date.parse(asOf) - (i < 8 ? i * 60 + 30 : (i % 28) * 1440 + 180) * 60000,
    ).toISOString();
    const amount = [3000, 5000, 2500, 1500, 4000, 2000, 750, 1250][i % 8];
    const credited = status === "verified";
    const settled =
      status !== "failed" && (credited || status === "refunded" || i % 3 === 0);
    return {
      id: `dep_${String(i + 1).padStart(4, "0")}`,
      investorId: investor.id,
      investorName: investor.name,
      amount,
      currency: "USD",
      method,
      methodDetails: {
        provider:
          method === "bank_transfer"
            ? "Demo bank clearing"
            : method === "mobile_money"
              ? "MTN demo adapter"
              : method === "card"
                ? "Stripe demo adapter"
                : "USDT demo observer",
        maskedAccount:
          method === "bank_transfer"
            ? "Bank account ••••1042"
            : method === "mobile_money"
              ? "+256 ••••••42"
              : method === "card"
                ? "Card ••••4242"
                : "Wallet 0xdemo…1042",
        network: method === "crypto_usdt" ? "Ethereum / synthetic" : null,
      },
      investmentId: null,
      pool: source.allocations[i % source.allocations.length].code,
      reference: `${method}_demo_${String(i + 1).padStart(6, "0")}`,
      submittedAt,
      status,
      verifiedAt:
        credited || status === "refunded"
          ? new Date(
              Date.parse(submittedAt) +
                (method === "bank_transfer"
                  ? 150
                  : method === "card"
                    ? 5
                    : 25) *
                  60000,
            ).toISOString()
          : null,
      verifiedBy: credited || status === "refunded" ? "seed_operator" : null,
      kycVerified: investor.kycVerified,
      provider: {
        outcome: settled
          ? "settled"
          : status === "failed"
            ? "failed"
            : "unknown",
        amount: i === 3 ? amount - 25 : amount,
        reference: `provider_demo_${i + 1}`,
        confirmations: method === "crypto_usdt" ? (i === 7 ? 2 : 8) : 0,
        webhookVerified: settled,
      },
      proof:
        i === 2 || i === 5
          ? null
          : {
              id: `receipt_demo_${i + 1}`,
              kind: method === "crypto_usdt" ? "transaction" : "receipt",
              receivedAt: submittedAt,
            },
      notes: [
        "Synthetic opening deposit record. No real payment provider connected.",
      ],
      attempts: 1,
      failure:
        status === "failed"
          ? method === "card"
            ? "insufficient_funds"
            : "provider_timeout"
          : null,
      refundReference:
        status === "refunded" ? `seed_demo_refund_${i + 1}` : null,
      credited,
    };
  });
  const s: DepositBundle = {
    mode: "demo",
    asOf,
    revision: 0,
    deposits,
    pools: source.allocations.map((p) => ({ code: p.code, name: p.name })),
    investors: source.investors,
    rules: {
      crypto: true,
      card: true,
      mobile: true,
      bank: false,
      crossCheck: true,
      flagMismatch: true,
      rejectExpired: false,
      confirmations: 6,
      threshold: 1,
    },
    audit: [
      {
        id: "dep_opening",
        time: asOf,
        action: "snapshot",
        reference: "opening",
        notes:
          "Independent D-11 synthetic ledger; does not mutate D-8 treasury or investor wallets.",
      },
    ],
    openingCredit: deposits
      .filter((d) => d.credited)
      .reduce((n, d) => n + d.amount, 0),
    localCredit: 0,
  };
  assertDeposits(s);
  return s;
}
