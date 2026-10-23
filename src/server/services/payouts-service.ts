import { getInvestorManagerBundle } from "./investor-manager-service";
import { getFundsBundle } from "./funds-service";
import {
  feeFor,
  money,
  heldStatuses,
  assertPayoutInvariants,
} from "@/lib/payouts/model";
import type {
  PayoutBundle,
  PayoutMethod,
  PayoutRequest,
  PayoutSettings,
} from "@/lib/payouts/types";
export function getPayoutBundle(): PayoutBundle {
  const roster = getInvestorManagerBundle(),
    funds = getFundsBundle();
  const asOf = "2026-10-22T14:30:00Z";
  const methods: PayoutMethod[] = [
    "bank_transfer",
    "mobile_money",
    "crypto_usdt",
    "card",
  ];
  const settings: PayoutSettings = {
    minimum: 50,
    maximum: 10000,
    autoEnabled: true,
    autoThreshold: 200,
    batchTime: "17:00",
    mobilePercent: 1.5,
    cardPercent: 2.9,
    cardFixed: 0.3,
    cryptoFee: 1.5,
  };
  const investors = roster.investors.map((i, index) => ({
    id: i.id,
    name: i.name,
    kycLevel: i.kyc.level,
    kycVerified: i.kyc.review === "verified",
    pools: i.holdings.map((h) => h.packageCode),
    defaultMethod: methods[index % 4],
    wallet: { available: 2000, held: 0, paid: 0, openingBalance: 2000 },
  }));
  const active = investors.filter((i) => i.kycVerified && i.pools.length);
  const requests: PayoutRequest[] = [];
  const make = (
    id: string,
    index: number,
    amount: number,
    method: PayoutMethod,
    status: PayoutRequest["status"],
    requestedAt: string,
    completedAt: string | null = null,
  ): PayoutRequest => {
    const i = active[index % active.length];
    const fee = feeFor(amount, method, settings);
    return {
      id,
      investorId: i.id,
      investorName: i.name,
      amount,
      fee,
      net: money(amount - fee),
      currency: "USD",
      method,
      pool: i.pools[0],
      reason: index % 2 ? "full_payout" : "partial_payout",
      status,
      requestedAt,
      startedAt: completedAt
        ? new Date(Date.parse(completedAt) - 18 * 60000).toISOString()
        : status === "processing" || status === "failed"
          ? requestedAt
          : null,
      completedAt,
      beneficiary: {
        masked:
          method === "bank_transfer"
            ? "Bank account •••• 4821"
            : method === "mobile_money"
              ? "Mobile •••• 6384"
              : method === "crypto_usdt"
                ? "USDT wallet 0xDEMO…8f2a"
                : "Card •••• 4242",
        token: `demo_beneficiary_${id}`,
        verified: true,
      },
      providerReference: ["processing", "failed", "completed"].includes(status)
        ? `demo_transfer_${id}_a1`
        : null,
      providerOutcome:
        status === "completed"
          ? "settled"
          : status === "failed"
            ? "failed"
            : status === "processing"
              ? "unknown"
              : "not_sent",
      failureCode: status === "failed" ? "provider_timeout" : null,
      attempts: ["processing", "failed", "completed"].includes(status) ? 1 : 0,
      notes: [],
    };
  };
  [120, 200, 300, 100].forEach((amount, i) =>
    requests.push(
      make(
        `pay_${["8f2a1c", "b3c102", "d4e203", "m8n904"][i]}`,
        i,
        amount,
        methods[i],
        "pending",
        `2026-10-22T${["14:01", "13:42", "12:18", "11:55"][i]}:00Z`,
      ),
    ),
  );
  requests[3].beneficiary.verified = false;
  const p1 = make(
    "pay_processing_01",
    4,
    500,
    "bank_transfer",
    "processing",
    "2026-10-22T10:20:00Z",
  );
  p1.providerOutcome = "settled";
  const p2 = make(
    "pay_processing_02",
    5,
    900,
    "crypto_usdt",
    "processing",
    "2026-10-22T09:15:00Z",
  );
  p2.providerOutcome = "failed";
  p2.failureCode = "provider_timeout";
  requests.push(p1, p2);
  const f1 = make(
      "pay_failed_01",
      6,
      250,
      "bank_transfer",
      "failed",
      "2026-10-21T17:00:00Z",
    ),
    f2 = make(
      "pay_failed_02",
      7,
      80,
      "mobile_money",
      "failed",
      "2026-10-21T12:30:00Z",
    );
  f2.failureCode = "invalid_number";
  f2.beneficiary.verified = false;
  requests.push(f1, f2);
  [50, 750, 320, 200, 180, 400, 500, 400].forEach((amount, i) => {
    const t = new Date(Date.parse(asOf) - (i + 1) * 30 * 60000).toISOString();
    requests.push(
      make(
        `pay_done_today_${i + 1}`,
        i + 8,
        amount,
        methods[i % 4],
        "completed",
        new Date(Date.parse(t) - 3600000).toISOString(),
        t,
      ),
    );
  });
  // 176 historical settlements sum to $46,120 using exact integer-cent allocation.
  const weights = Array.from({ length: 176 }, (_, i) => 20000 + (i % 7) * 2000),
    total = weights.reduce((n, v) => n + v, 0);
  const cents = weights.map((w) => Math.floor((w / total) * 4612000));
  let rem = 4612000 - cents.reduce((n, v) => n + v, 0);
  for (let i = 0; rem > 0; i++, rem--) cents[i % 176]++;
  cents.forEach((value, i) => {
    const day = 1 + Math.floor(i / 3),
      t = new Date(
        Date.parse("2026-10-22T12:00:00Z") - day * 86400000 - (i % 3) * 7200000,
      ).toISOString();
    requests.push(
      make(
        `pay_history_${String(i + 1).padStart(3, "0")}`,
        i + 16,
        value / 100,
        methods[i % 4],
        "completed",
        new Date(Date.parse(t) - 3600000).toISOString(),
        t,
      ),
    );
  });
  investors.forEach((i) => {
    i.wallet.held = money(
      requests
        .filter((r) => r.investorId === i.id && heldStatuses.includes(r.status))
        .reduce((n, r) => n + r.amount, 0),
    );
    i.wallet.openingBalance = money(i.wallet.available + i.wallet.held);
  });
  const s: PayoutBundle = {
    mode: "demo",
    asOf,
    revision: 0,
    settings,
    investors,
    requests,
    treasury: {
      openingCash: funds.custody.brokerCash,
      cash: funds.custody.brokerCash,
      reserve: funds.reserve.balance,
    },
    cashLedger: [],
    audit: [
      {
        id: "opening_payout_snapshot",
        time: asOf,
        action: "snapshot",
        requestIds: [],
        notes:
          "Synthetic payout evidence and wallet controls. Historical settlements are already reflected in opening treasury cash.",
        revision: 0,
      },
    ],
  };
  assertPayoutInvariants(s);
  return s;
}
