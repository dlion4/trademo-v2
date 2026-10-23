export interface AnalyticsFilters {
  from: string;
  to: string;
  pool: string;
}
export interface AnalyticsTrade {
  id: string;
  day: string;
  pool: string;
  symbol: string;
  strategy: string;
  stake: number;
  profit: number;
  durationSeconds: number;
  isWin: boolean;
}
export interface AnalyticsInvestor {
  id: string;
  name: string;
  lastActive: string;
  holdings: { pool: string; capital: number }[];
}
export interface AnalyticsPool {
  code: string;
  name: string;
  capital: number;
  startsAt: string;
  endsAt: string;
  days: number;
  markets: string[];
  strategies: string[];
  operatorPercent: number;
}
export interface GuardianMarker {
  id: string;
  pool: string;
  day: string;
  trigger: string;
  action: string;
}
export interface AnalyticsSource {
  mode: "demo";
  asOf: string;
  trades: AnalyticsTrade[];
  pools: AnalyticsPool[];
  investors: AnalyticsInvestor[];
  guardian: GuardianMarker[];
}
export interface AnalyticsSummary {
  profit: number;
  capital: number;
  roi: number;
  trades: number;
  wins: number;
  profitFactor: number | null;
  sharpe: number | null;
  maxDrawdown: number;
  averageDuration: number;
  grossWins: number;
  grossLosses: number;
}
export interface AnalyticsGroup {
  key: string;
  trades: number;
  wins: number;
  profit: number;
  winRate: number;
  averageStake: number;
  averageDuration: number;
}
export interface EquityPoint {
  day: string;
  profit: number;
  equity: number;
  drawdown: number;
  dailyReturn: number;
  peak: number;
}
export interface PoolAnalytics extends AnalyticsPool {
  profit: number;
  roi: number;
  trades: number;
  wins: number;
  investors: number;
  operator: number;
  investor: number;
  distributed: number;
  pending: number;
  points: EquityPoint[];
  maxDrawdown: number;
  recoveryDays: number | null;
  underwaterDays: number;
  drawdownToProfit: number | null;
}
export interface InvestorRanking {
  id: string;
  name: string;
  capital: number;
  earned: number;
  roi: number;
  pools: number;
  lastActive: string;
  allocation: { pool: string; capital: number; earned: number }[];
}
export interface AnalyticsBundle {
  mode: "demo";
  asOf: string;
  filters: AnalyticsFilters;
  summary: AnalyticsSummary;
  pools: PoolAnalytics[];
  investors: InvestorRanking[];
  markets: AnalyticsGroup[];
  strategies: AnalyticsGroup[];
  equity: EquityPoint[];
  guardian: GuardianMarker[];
  comparison: { day: number; values: Record<string, number | null> }[];
}
export const initialAnalyticsFilters: AnalyticsFilters = {
  from: "2026-09-22",
  to: "2026-10-21",
  pool: "all",
};
export const analyticsColors = ["#0f766e", "#64748b", "#b54708"];
