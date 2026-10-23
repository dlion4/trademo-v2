import { defaultRequest, ledgerContracts, ledgerMarkets, ledgerPools, ledgerStrategies, type LedgerBundle, type LedgerGroup, type LedgerRequest, type LedgerSummary, type LedgerTrade } from "@/lib/trade-log/types";
const round = (n: number) => Math.round(n * 100) / 100;
/** One deterministic source of truth: all aggregates reconcile to filtered receipts. */
export const ledgerTrades: LedgerTrade[] = Array.from({ length: 1247 }, (_, i) => {
  const market = i % 5; const pool = i % 3; const isWin = (i * 37 % 1247) < 789;
  const stake = market === 4 ? 70 : 35;
  const profit = isWin ? (i % 59 === 0 ? 280 : stake * (i % 4 === 0 ? 1.25 : .8)) : -stake;
  return { id: `ledger_${1247 - i}`, tradeNumber: 1247 - i, executedAt: new Date(Date.UTC(2026, 9, 21, 14, 23, 47) - Math.floor(i / 43) * 86400000 - (i % 43) * 55000).toISOString(),
    symbol: ledgerMarkets[market], symbolLabel: `Volatility ${ledgerMarkets[market].slice(2)} Index`, contractType: ledgerContracts[market], contractLabel: ["Rise 5t", "Fall 1m", "Even 1m", "Odd 1m", "Accumulator"][market],
    stake, payout: round(stake + profit), profit: round(profit), packageCode: ledgerPools[pool], botName: ["Bot-Alpha", "Bot-Bravo", "Bot-Charlie"][pool], botId: `bot_${pool + 1}`,
    strategy: ledgerStrategies[i % 5], isWin, duration: market === 0 ? 5 : 60, durationUnit: market === 0 ? "ticks" : "seconds", entrySpot: round(4531.92 + market * 271 + i * .03), exitSpot: round(4532.18 + market * 271 + i * .03),
    scheduleId: `SCH-00${pool + 1}`, scheduleName: ["Martingale-R10-Evening", "Even-Odd-Session", "Alpha-Momentum"][pool], derivContractId: String(1234567890 + i), packageCapital: [14000, 12250, 8750][pool], capitalShare: [40, 35, 25][pool] };
});
export function summarize(rows: LedgerTrade[]): LedgerSummary {
  const wins = rows.filter(t => t.isWin); const losses = rows.filter(t => !t.isWin);
  return { trades: rows.length, wins: wins.length, losses: losses.length, profit: round(rows.reduce((n,t) => n + t.profit, 0)), winRate: rows.length ? wins.length / rows.length * 100 : 0,
    avgWin: wins.length ? round(wins.reduce((n,t) => n + t.profit, 0) / wins.length) : 0, avgLoss: losses.length ? round(losses.reduce((n,t) => n + t.profit, 0) / losses.length) : 0,
    bestTrade: rows.length ? Math.max(...rows.map(t => t.profit)) : 0, stake: round(rows.reduce((n,t) => n + t.stake, 0)) };
}
export function filterTrades(request: LedgerRequest) {
  const f = request.filters;
  return ledgerTrades.filter(t => t.executedAt.slice(0,10) >= f.from && t.executedAt.slice(0,10) <= f.to && (f.symbol === "all" || t.symbol === f.symbol) && (f.pool === "all" || t.packageCode === f.pool) && (f.contract === "all" || t.contractType === f.contract) && (f.strategy === "all" || t.strategy === f.strategy) && (f.result === "all" || t.isWin === (f.result === "win")) && (!f.schedule || t.scheduleId === f.schedule) && (!f.search || `${t.id} ${t.tradeNumber} ${t.derivContractId} ${t.symbol} ${t.botName} ${t.strategy} ${t.scheduleName}`.toLowerCase().includes(f.search.toLowerCase())));
}
function group(rows: LedgerTrade[], key: (t: LedgerTrade) => string): LedgerGroup[] {
  const groups = new Map<string, LedgerTrade[]>();
  rows.forEach(t => { const k = key(t); groups.set(k, [...(groups.get(k) ?? []), t]); });
  return Array.from(groups, ([key, entries]) => { const summary = summarize(entries); const capital = entries[0].packageCapital;
    return { ...summary, key, capital, roi: summary.profit / capital * 100, avgStake: summary.stake / entries.length, avgDuration: entries.reduce((n,t) => n + (t.durationUnit === "ticks" ? t.duration * 2 : t.duration), 0) / entries.length };
  });
}
export function getLedgerBundle(request: LedgerRequest = defaultRequest, exportAll = false): LedgerBundle {
  const filtered = filterTrades(request); const sort = request.sort as keyof LedgerTrade;
  const sorted = [...filtered].sort((a,b) => { const x = a[sort]; const y = b[sort]; const order = x < y ? -1 : x > y ? 1 : 0; return request.desc ? -order : order; });
  const pages = Math.max(1, Math.ceil(sorted.length / request.pageSize)); const page = Math.min(request.page, pages);
  let running = 133766;
  const daily = group(filtered, t => t.executedAt.slice(0,10)).sort((a,b) => a.key.localeCompare(b.key)).map(d => { running = round(running + d.profit); return { ...d, runningCapital: running }; }).reverse();
  return { mode: "demo", asOf: "2026-10-21T14:47:00Z", rows: exportAll ? sorted : sorted.slice((page - 1) * request.pageSize, page * request.pageSize), total: sorted.length, page, pageSize: request.pageSize,
    summary: summarize(filtered), daily, pools: group(filtered, t => t.packageCode), markets: group(filtered, t => t.symbol), strategies: group(filtered, t => t.strategy) };
}
