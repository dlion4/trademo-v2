import { ledgerTrades } from "@/server/services/trade-log-service";
import { getInvestorManagerBundle } from "@/server/services/investor-manager-service";
import { buildAnalytics } from "@/lib/analytics/model";
import {
  initialAnalyticsFilters,
  type AnalyticsFilters,
  type AnalyticsSource,
} from "@/lib/analytics/types";
export function getAnalyticsSource(): AnalyticsSource {
  const roster = getInvestorManagerBundle();
  const dates = [
    "2026-10-08T00:00:00Z",
    "2026-10-06T00:00:00Z",
    "2026-09-29T00:00:00Z",
  ];
  const lengths = [14, 21, 30];
  const pools: AnalyticsSource["pools"] = roster.pools.map((p, index) => ({
    code: p.code,
    name: p.name,
    capital: roster.investors.reduce(
      (n, i) =>
        n +
        i.holdings
          .filter((h) => h.packageCode === p.code)
          .reduce((sum, h) => sum + h.capital, 0),
      0,
    ),
    startsAt: dates[index],
    endsAt: new Date(
      Date.parse(dates[index]) + lengths[index] * 86400000,
    ).toISOString(),
    days: lengths[index],
    markets: [],
    strategies: [],
    operatorPercent: 20,
  }));
  const trades = ledgerTrades
    .filter(
      (t) =>
        t.executedAt >= pools.find((p) => p.code === t.packageCode)!.startsAt,
    )
    .map((t) => ({
      id: t.id,
      day: t.executedAt.slice(0, 10),
      pool: t.packageCode,
      symbol: t.symbol,
      strategy: t.strategy,
      stake: t.stake,
      profit: t.profit,
      // Seed contracts use ticks or seconds only; tick time is an explicit 2s approximation.
      durationSeconds: t.durationUnit === "ticks" ? t.duration * 2 : t.duration,
      isWin: t.isWin,
    }));
  pools.forEach((p) => {
    p.markets = [
      ...new Set(trades.filter((t) => t.pool === p.code).map((t) => t.symbol)),
    ];
    p.strategies = [
      ...new Set(
        trades.filter((t) => t.pool === p.code).map((t) => t.strategy),
      ),
    ];
  });
  // Chart annotations are illustrative event records, not proof of causation.
  const guardian = [
    {
      id: "guard_1",
      pool: "PKG-01",
      day: "2026-10-12",
      trigger: "Loss-streak cooldown",
      action: "Demo runner paused for 5 minutes",
    },
    {
      id: "guard_2",
      pool: "PKG-02",
      day: "2026-10-16",
      trigger: "Drawdown threshold review",
      action: "Operator review requested",
    },
    {
      id: "guard_3",
      pool: "PKG-03",
      day: "2026-10-09",
      trigger: "Symbol rotation",
      action: "R_10 → R_75 rotation logged",
    },
  ];
  return {
    mode: "demo",
    asOf: roster.asOf,
    pools,
    trades,
    investors: roster.investors.map((i) => ({
      id: i.id,
      name: i.name,
      lastActive: i.engagement.lastLogin,
      holdings: i.holdings.map((h) => ({
        pool: h.packageCode,
        capital: h.capital,
      })),
    })),
    guardian,
  };
}
export function getAnalyticsBundle(
  filters: AnalyticsFilters = initialAnalyticsFilters,
) {
  return buildAnalytics(getAnalyticsSource(), filters);
}
