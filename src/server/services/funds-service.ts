import { getInvestorManagerBundle } from "./investor-manager-service";
import { getAnalyticsSource } from "./analytics-service";
import { reconciliationChecks } from "@/lib/funds/model";
import type { FundsBundle, Deposit, PaymentMethod } from "@/lib/funds/types";
export function getFundsBundle(): FundsBundle {
  const roster = getInvestorManagerBundle();
  const source = getAnalyticsSource();
  const investors = roster.investors.map((i) => ({
    id: i.id,
    name: i.name,
    kycVerified: i.kyc.review === "verified",
  }));
  const undeployed = [5000, 4000, 5000];
  const allocations = source.pools.map((p, i) => {
    const trades = source.trades.filter((t) => t.pool === p.code);
    return {
      code: p.code,
      name: p.name,
      capital: p.capital,
      deployed: p.capital - undeployed[i],
      trades: trades.length,
      averageStake:
        trades.reduce((n, t) => n + t.stake, 0) / Math.max(1, trades.length),
      status: "trading" as const,
    };
  });
  const methods: PaymentMethod[] = [
    "mobile_money",
    "bank_transfer",
    "crypto_usdt",
    "card",
  ];
  const deposits: Deposit[] = Array.from({ length: 18 }, (_, index) => {
    const investor = investors[index % investors.length];
    const amounts = [3000, 250, 150, 100];
    return {
      id:
        index === 0 ? "dep_8f2a" : `dep_${(45000 + index * 113).toString(16)}`,
      date: new Date(
        Date.parse("2026-10-21T14:20:00Z") - index * 70 * 60000,
      ).toISOString(),
      investorId: investor.id,
      investorName: investor.name,
      amount:
        index < 4
          ? amounts[index]
          : [5000, 3000, 2500, 1500, 750, 500][index % 6],
      currency: "USD",
      method: methods[index % 4],
      pool: allocations[index % 3].code,
      status:
        index === 0
          ? "pending"
          : index === 1
            ? "submitted"
            : index === 2
              ? "information_requested"
              : index === 3
                ? "pending"
                : index === 17
                  ? "rejected"
                  : "verified",
      verifiedBy: index >= 4 && index !== 17 ? "jane_op" : null,
      reference: `DEMO-${methods[index % 4].toUpperCase()}-${100861 + index}`,
      providerSettled: index !== 1 && index !== 2,
      kycVerified: index === 1 ? false : investor.kycVerified,
      notes:
        index === 2 ? ["Provider settlement transaction hash requested."] : [],
    };
  });
  const s: FundsBundle = {
    mode: "demo",
    asOf: roster.asOf,
    revision: 0,
    ledgerCapital: allocations.reduce((n, p) => n + p.capital, 0),
    custody: {
      positions: allocations.reduce((n, p) => n + p.deployed, 0),
      brokerCash: 8750,
      escrow: 5250,
    },
    reserve: { balance: 4200, targetPercent: 5 },
    allocations,
    investors,
    deposits,
    movements: [
      {
        id: "flow_1",
        time: "2026-10-21T14:23:04Z",
        kind: "trade_in",
        amount: 63,
        from: "Bot Alpha",
        to: "Broker cash",
        reference: "contract_1234567",
        status: "posted",
        note: "Historical gross contract return; already reflected in the control snapshot.",
      },
      {
        id: "flow_2",
        time: "2026-10-21T14:23:00Z",
        kind: "trade_out",
        amount: -35,
        from: "Broker cash",
        to: "Bot Alpha",
        reference: "contract_1234567",
        status: "posted",
        note: "Historical stake; activity feed is not a complete accounting journal.",
      },
      {
        id: "flow_3",
        time: "2026-10-21T14:20:00Z",
        kind: "deposit_in",
        amount: 3000,
        from: investors[0].name,
        to: "External settlement review",
        reference: "dep_8f2a",
        status: "pending",
        note: "External pending principal is not yet part of managed capital.",
      },
      {
        id: "flow_4",
        time: "2026-10-21T14:15:00Z",
        kind: "payout_out",
        amount: -720,
        from: "Treasury",
        to: "Four investors",
        reference: "batch_b4tch",
        status: "posted",
        note: "Historical demo payout; already reflected in the control snapshot.",
      },
      {
        id: "flow_5",
        time: "2026-10-21T13:50:00Z",
        kind: "fee_out",
        amount: -3.5,
        from: "Broker cash",
        to: "Payment provider",
        reference: "fee_8f2a",
        status: "posted",
        note: "Historical provider fee; already reflected in the control snapshot.",
      },
    ],
    providers: [
      {
        id: "deriv",
        name: "Deriv API",
        state: "healthy",
        latency: 142,
        lastChecked: roster.asOf,
        detail: "Demo authenticated account stream; no live broker connection.",
        channel: "Broker / USD",
      },
      {
        id: "stripe",
        name: "Stripe",
        state: "healthy",
        latency: 218,
        lastChecked: roster.asOf,
        detail: "Synthetic card-processing status; webhooks not configured.",
        channel: "Cards",
      },
      {
        id: "mobile",
        name: "Mobile Money",
        state: "healthy",
        latency: 346,
        lastChecked: roster.asOf,
        detail:
          "MTN, Vodafone and Airtel example rails; USD is a reporting equivalent.",
        channel: "MTN · Vodafone · Airtel",
      },
      {
        id: "bank",
        name: "Bank / ACH",
        state: "delayed",
        latency: 432,
        lastChecked: roster.asOf,
        detail:
          "Illustrative settlement batch is 4 hours behind schedule. No real outage monitoring.",
        channel: "ACH / bank transfer",
      },
      {
        id: "crypto",
        name: "Stablecoin rail",
        state: "healthy",
        latency: 192,
        lastChecked: roster.asOf,
        detail:
          "USDT / USDC example rail. No live on-chain confirmation polling.",
        channel: "USDT · USDC",
      },
    ],
    runs: [],
    audit: [
      {
        id: "seed_audit",
        time: roster.asOf,
        action: "snapshot",
        reference: "opening_control",
        notes:
          "Synthetic control balances joined to the D-6 funded-principal snapshot.",
      },
    ],
  };
  const checks = reconciliationChecks(s);
  s.runs = Array.from({ length: 5 }, (_, i) => ({
    id: `rec_seed_${i}`,
    sourceRevision: 0,
    time: new Date(Date.parse(roster.asOf) - (i + 1) * 3600000).toISOString(),
    status: i === 2 ? "alert" : "balanced",
    difference: i === 2 ? 1.2 : 0,
    checks:
      i === 2
        ? checks.map((c, j) =>
            j === 0 ? { ...c, actual: c.actual + 1.2, difference: 1.2 } : c,
          )
        : checks,
    note:
      i === 2
        ? "Historical mobile-money rounding discrepancy. Resolved in the next control snapshot; retained as evidence."
        : "Synthetic snapshot control check; not independent provider verification.",
  }));
  return s;
}
