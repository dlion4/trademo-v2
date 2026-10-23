import { z } from "zod";
import type {
  AnalyticsBundle,
  AnalyticsFilters,
  AnalyticsGroup,
  AnalyticsSource,
  AnalyticsSummary,
  AnalyticsTrade,
  EquityPoint,
  InvestorRanking,
  PoolAnalytics,
} from "./types";
export const analyticsFilterSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    pool: z.enum(["all", "PKG-01", "PKG-02", "PKG-03"]),
  })
  .refine((f) => f.from <= f.to, "Start date must not follow end date.")
  .refine(
    (f) => (Date.parse(f.to) - Date.parse(f.from)) / 86400000 <= 365,
    "Choose a range of 366 calendar days or fewer.",
  );
const round = (n: number) => Math.round(n * 100) / 100;
export function calendarDays(from: string, to: string) {
  const days: string[] = [];
  for (
    let date = Date.parse(from + "T00:00:00Z");
    date <= Date.parse(to + "T00:00:00Z");
    date += 86400000
  )
    days.push(new Date(date).toISOString().slice(0, 10));
  return days;
}
export function equityPoints(
  trades: AnalyticsTrade[],
  capital: number,
  days: string[],
): EquityPoint[] {
  let equity = capital;
  let peak = capital;
  return days.map((day) => {
    const profit = round(
      trades.filter((t) => t.day === day).reduce((n, t) => n + t.profit, 0),
    );
    equity = round(equity + profit);
    peak = Math.max(peak, equity);
    return {
      day,
      profit,
      equity,
      peak,
      drawdown: peak ? ((equity - peak) / peak) * 100 : 0,
      dailyReturn: capital ? (profit / capital) * 100 : 0,
    };
  });
}
function group(
  trades: AnalyticsTrade[],
  key: (t: AnalyticsTrade) => string,
): AnalyticsGroup[] {
  return [...new Set(trades.map(key))]
    .map((k) => {
      const rows = trades.filter((t) => key(t) === k);
      return {
        key: k,
        trades: rows.length,
        wins: rows.filter((t) => t.isWin).length,
        profit: round(rows.reduce((n, t) => n + t.profit, 0)),
        winRate: (rows.filter((t) => t.isWin).length / rows.length) * 100,
        averageStake: rows.reduce((n, t) => n + t.stake, 0) / rows.length,
        averageDuration:
          rows.reduce((n, t) => n + t.durationSeconds, 0) / rows.length,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}
export function summarizeAnalytics(
  trades: AnalyticsTrade[],
  capital: number,
  points: EquityPoint[],
): AnalyticsSummary {
  const profit = round(trades.reduce((n, t) => n + t.profit, 0));
  const grossWins = round(
    trades.filter((t) => t.profit > 0).reduce((n, t) => n + t.profit, 0),
  );
  const grossLosses = round(
    -trades.filter((t) => t.profit < 0).reduce((n, t) => n + t.profit, 0),
  );
  const returns = points.map((p) => p.dailyReturn / 100);
  const mean = returns.length
    ? returns.reduce((n, r) => n + r, 0) / returns.length
    : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((n, r) => n + (r - mean) ** 2, 0) / (returns.length - 1)
      : 0;
  return {
    profit,
    capital,
    roi: capital ? (profit / capital) * 100 : 0,
    trades: trades.length,
    wins: trades.filter((t) => t.isWin).length,
    profitFactor: grossLosses ? grossWins / grossLosses : null,
    sharpe: variance > 0 ? mean / Math.sqrt(variance) : null,
    maxDrawdown: Math.abs(Math.min(0, ...points.map((p) => p.drawdown))),
    averageDuration: trades.length
      ? trades.reduce((n, t) => n + t.durationSeconds, 0) / trades.length
      : 0,
    grossWins,
    grossLosses,
  };
}
export function buildAnalytics(
  source: AnalyticsSource,
  filters: AnalyticsFilters,
): AnalyticsBundle {
  const validated = analyticsFilterSchema.safeParse(filters);
  if (!validated.success) throw new Error(validated.error.issues[0].message);
  if (filters.to > source.asOf.slice(0, 10))
    throw new Error("Range cannot extend beyond the demo snapshot date.");
  const pools = source.pools.filter(
    (p) => filters.pool === "all" || p.code === filters.pool,
  );
  const codes = pools.map((p) => p.code);
  const trades = source.trades.filter(
    (t) =>
      codes.includes(t.pool) && t.day >= filters.from && t.day <= filters.to,
  );
  const days = calendarDays(filters.from, filters.to);
  const capital = pools.reduce((n, p) => n + p.capital, 0);
  const equity = equityPoints(trades, capital, days);
  const poolStats: PoolAnalytics[] = pools.map((p) => {
    const rows = trades.filter((t) => t.pool === p.code);
    const points = equityPoints(rows, p.capital, days);
    const profit = round(rows.reduce((n, t) => n + t.profit, 0));
    const operator = round((Math.max(0, profit) * p.operatorPercent) / 100);
    const investor = round(profit - operator);
    // Illustrative attribution of a paid portion, not a payment-ledger assertion.
    const distributed = round(
      Math.max(0, investor) *
        (["PKG-01", "PKG-02", "PKG-03"].indexOf(p.code) === 1 ? 0 : 0.6),
    );
    const trough = points.reduce(
      (worst, row, index) =>
        row.drawdown < (points[worst]?.drawdown ?? 0) ? index : worst,
      0,
    );
    const recovered = points.findIndex(
      (row, index) => index > trough && row.equity >= points[trough]?.peak,
    );
    const maxDrawdown = Math.abs(Math.min(0, ...points.map((p) => p.drawdown)));
    const peak = Math.max(p.capital, ...points.map((p) => p.equity));
    const maxDrop = points.reduce((n, r) => Math.max(n, r.peak - r.equity), 0);
    return {
      ...p,
      profit,
      roi: p.capital ? (profit / p.capital) * 100 : 0,
      trades: rows.length,
      wins: rows.filter((t) => t.isWin).length,
      investors: source.investors.filter((i) =>
        i.holdings.some((h) => h.pool === p.code),
      ).length,
      operator,
      investor,
      distributed,
      pending: round(Math.max(0, investor) - distributed),
      points,
      maxDrawdown,
      recoveryDays:
        maxDrawdown === 0 ? 0 : recovered < 0 ? null : recovered - trough,
      underwaterDays: points.filter((r) => r.drawdown < 0).length,
      drawdownToProfit: peak > p.capital ? maxDrop / (peak - p.capital) : null,
    };
  });
  // Allocate investor-share cents by largest remainder, including negative investor P&L.
  const shares = new Map<string, Map<string, number>>();
  for (const pool of poolStats) {
    const holders = source.investors.filter((i) =>
      i.holdings.some((h) => h.pool === pool.code),
    );
    const cents = Math.round(pool.investor * 100);
    const sign = Math.sign(cents);
    const weights = holders.map((i) => {
      const h = i.holdings.find((h) => h.pool === pool.code)!;
      const raw = (Math.abs(cents) * h.capital) / pool.capital;
      return {
        id: i.id,
        cents: Math.floor(raw),
        fraction: raw - Math.floor(raw),
      };
    });
    let remainder = Math.abs(cents) - weights.reduce((n, r) => n + r.cents, 0);
    const ordered = [...weights].sort(
      (a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id),
    );
    for (let n = 0; remainder > 0 && ordered.length; n++, remainder--)
      ordered[n % ordered.length].cents++;
    shares.set(
      pool.code,
      new Map(weights.map((r) => [r.id, (r.cents * sign) / 100])),
    );
  }
  const investors: InvestorRanking[] = source.investors
    .map((i) => {
      const allocation = i.holdings
        .filter((h) => codes.includes(h.pool))
        .map((h) => ({ ...h, earned: shares.get(h.pool)?.get(i.id) ?? 0 }));
      const funded = allocation.reduce((n, h) => n + h.capital, 0);
      const earned = round(allocation.reduce((n, h) => n + h.earned, 0));
      return {
        id: i.id,
        name: i.name,
        capital: funded,
        earned,
        roi: funded ? (earned / funded) * 100 : 0,
        pools: allocation.length,
        lastActive: i.lastActive,
        allocation,
      };
    })
    .filter((i) => i.capital > 0)
    .sort((a, b) => b.earned - a.earned);
  const longest = Math.max(...poolStats.map((p) => p.days), 0);
  const comparison = Array.from({ length: longest }, (_, day) => ({
    day: day + 1,
    values: Object.fromEntries(
      poolStats.map((p) => {
        const d = new Date(Date.parse(p.startsAt) + day * 86400000)
          .toISOString()
          .slice(0, 10);
        const point = p.points.find((point) => point.day === d);
        return [
          p.code,
          day < p.days &&
          d <= source.asOf.slice(0, 10) &&
          d >= filters.from &&
          d <= filters.to
            ? (point?.dailyReturn ?? 0)
            : null,
        ];
      }),
    ),
  }));
  return {
    mode: "demo",
    asOf: source.asOf,
    filters,
    summary: summarizeAnalytics(trades, capital, equity),
    pools: poolStats,
    investors,
    markets: group(trades, (t) => t.symbol),
    strategies: group(trades, (t) => t.strategy),
    equity,
    guardian: source.guardian.filter(
      (g) =>
        codes.includes(g.pool) && g.day >= filters.from && g.day <= filters.to,
    ),
    comparison,
  };
}
