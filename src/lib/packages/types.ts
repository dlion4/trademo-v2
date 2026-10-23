export type PoolStatus = "draft" | "scheduled" | "open" | "closed" | "trading" | "profit_sharing" | "completed" | "archived";
export interface PackageTerms {
  name: string; description: string; tokenName: string; slotPrice: number; maxSlotsPerUser: number; targetCapital: number; maxCapital: number | null;
  bookingOpensAt: string; bookingClosesAt: string; tradingStartsAt: string; tradingEndsAt: string; profitShareDate: string;
  conservativeROI: number; expectedROI: number; optimisticROI: number; operatorSharePercent: number;
  markets: string[]; strategies: string[]; guardianEnabled: boolean; maxConsecLosses: number; maxDrawdown: number;
  termsUrl: string; autoReinvestOption: boolean; earlyExitPenalty: number;
}
export interface PoolInvestor { id: string; name: string; slots: number; capital: number; joinedAt: string; kyc: "verified"; paidProfit: number }
export interface ManagedPackage extends PackageTerms {
  id: string; code: string; status: PoolStatus; paused: boolean; raisedCapital: number; profit: number;
  investors: PoolInvestor[]; createdAt: string; distributedAt: string | null; updatedAt: string;
}
export interface PackageHistory { id: string; name: string; minSlot: number; duration: number; markets: string[]; roi: number; completedAt: string }
export interface PackageBundle { mode: "demo"; asOf: string; packages: ManagedPackage[]; history: PackageHistory[] }
export type PackageAction = "publish" | "pause" | "resume" | "close" | "start" | "distribute" | "archive";
export interface PackageCommand { id: string; action: PackageAction }
export const packageMarkets = ["R_10", "R_25", "R_50", "R_75", "R_100"];
export const packageStrategies = ["Martingale", "Even/Odd", "DCA", "Oscar's Grind", "Fibonacci", "Fixed Stake"];
export const packageSteps = ["Basics", "Investment", "Timeline", "Returns", "Profit split", "Trading", "Terms"];
export const initialTerms: PackageTerms = {
  name: "", description: "", tokenName: "bmX", slotPrice: 3000, maxSlotsPerUser: 20, targetCapital: 50000, maxCapital: 75000,
  bookingOpensAt: "2026-10-25T09:00", bookingClosesAt: "2026-10-28T23:59", tradingStartsAt: "2026-10-29T09:00", tradingEndsAt: "2026-11-12T17:00", profitShareDate: "2026-11-13T12:00",
  conservativeROI: 8, expectedROI: 15, optimisticROI: 25, operatorSharePercent: 20,
  markets: ["R_10", "R_75"], strategies: ["Martingale", "Even/Odd"], guardianEnabled: true, maxConsecLosses: 8, maxDrawdown: 5,
  termsUrl: "", autoReinvestOption: false, earlyExitPenalty: 10,
};
export const durationDays = (p: PackageTerms) => Math.ceil((Date.parse(p.tradingEndsAt) - Date.parse(p.tradingStartsAt)) / 86400000);
export const investorShare = (p: PackageTerms) => 100 - p.operatorSharePercent;
/** Token economics are explicit: 10 bmX allocation units per invested USD; not a market price. */
export const tokensPerSlot = (p: PackageTerms) => p.slotPrice * 10;
