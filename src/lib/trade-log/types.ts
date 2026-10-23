export interface LedgerTrade {
  id: string; tradeNumber: number; executedAt: string; symbol: string; symbolLabel: string;
  contractType: string; contractLabel: string; stake: number; payout: number; profit: number;
  packageCode: string; botName: string; botId: string; strategy: string; isWin: boolean;
  duration: number; durationUnit: string; entrySpot: number; exitSpot: number;
  scheduleId: string; scheduleName: string; derivContractId: string; packageCapital: number; capitalShare: number;
}
export interface LedgerFilters { from: string; to: string; symbol: string; pool: string; contract: string; result: string; strategy: string; schedule: string; search: string }
export interface LedgerRequest { page: number; pageSize: number; sort: string; desc: boolean; filters: LedgerFilters }
export interface LedgerSummary { trades: number; wins: number; losses: number; profit: number; winRate: number; avgWin: number; avgLoss: number; bestTrade: number; stake: number }
export interface LedgerGroup extends LedgerSummary { key: string; capital: number; roi: number; avgStake: number; avgDuration: number; runningCapital?: number }
export interface LedgerBundle {
  mode: "demo"; asOf: string; rows: LedgerTrade[]; total: number; page: number; pageSize: number;
  summary: LedgerSummary; daily: LedgerGroup[]; pools: LedgerGroup[]; markets: LedgerGroup[]; strategies: LedgerGroup[];
}
export const defaultFilters: LedgerFilters = { from: "2026-09-22", to: "2026-10-21", symbol: "all", pool: "all", contract: "all", result: "all", strategy: "all", schedule: "", search: "" };
export const defaultRequest: LedgerRequest = { page: 1, pageSize: 50, sort: "executedAt", desc: true, filters: defaultFilters };
export const ledgerMarkets = ["R_10", "R_25", "R_50", "R_75", "R_100"];
export const ledgerStrategies = ["Martingale", "Even/Odd", "DCA", "Oscar's Grind", "Fibonacci"];
export const ledgerPools = ["PKG-01", "PKG-02", "PKG-03"];
export const ledgerContracts = ["CALL", "PUT", "DIGITEVEN", "DIGITODD", "ACCU"];
