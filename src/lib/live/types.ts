import type { DerivSymbol } from "@/lib/dashboard/types";

export interface LiveTrade {
  tradeId: string; packageId: string; symbol: DerivSymbol; contractType: string;
  stake: number; payout: number; profit: number; isWin: boolean;
  entrySpot: number; exitSpot: number; boughtAt: string; soldAt: string;
  botName: string; scheduleId: string;
}
export interface LiveBot {
  id: string; name: string; symbol: DerivSymbol; strategy: string;
  status: "running" | "paused" | "stopped"; trades: number; wins: number;
  profit: number; stake: number; packageId: string;
}
export interface LiveTick { symbol: DerivSymbol; name: string; price: number; change: number; cadence: string; updatedAt: string }
export interface LivePool { id: string; name: string; capital: number; profit: number; trades: number; target: number; investors: number }
export interface GuardianEvent { id: string; time: string; packageId: string; trigger: string; action: string; resumedAt: string }
export interface LiveBundle {
  mode: "simulation"; asOf: string; startedAt: string; capitalInMarket: number;
  sessionProfit: number; totalTrades: number; wins: number; streak: number;
  bestTrade: number; worstTrade: number; longestStreak: number; averageDuration: number;
  trades: LiveTrade[]; ticks: LiveTick[]; bots: LiveBot[]; pools: LivePool[]; guardian: GuardianEvent[];
}
export type LiveEvent =
  | { type: "operator:trade_result"; trade: LiveTrade }
  | { type: "operator:tick_update"; tick: LiveTick }
  | { type: "operator:bot_status"; bot: LiveBot }
  | { type: "operator:ai_guardian"; event: GuardianEvent };
export interface BotCommand { botIds: string[]; action: "running" | "paused" | "stopped"; stake?: number; strategy?: string }

/** Shared socket/demo reducer. A backend socket adapter can dispatch these exact events. */
export function applyLiveEvent(state: LiveBundle, event: LiveEvent): LiveBundle {
  switch (event.type) {
    case "operator:tick_update": return { ...state, asOf: event.tick.updatedAt, ticks: state.ticks.map(t => t.symbol === event.tick.symbol ? event.tick : t) };
    case "operator:bot_status": return { ...state, bots: state.bots.map(b => b.id === event.bot.id ? event.bot : b) };
    case "operator:ai_guardian": return { ...state, guardian: [event.event, ...state.guardian].slice(0, 50) };
    case "operator:trade_result": {
      const t = event.trade;
      if (state.trades.some(row => row.tradeId === t.tradeId)) return state;
      const streak = t.isWin ? Math.max(0, state.streak) + 1 : Math.min(0, state.streak) - 1;
      return { ...state, asOf: t.soldAt, trades: [t, ...state.trades].slice(0, 50), totalTrades: state.totalTrades + 1,
        wins: state.wins + Number(t.isWin), sessionProfit: state.sessionProfit + t.profit, streak,
        bestTrade: Math.max(state.bestTrade, t.profit), worstTrade: Math.min(state.worstTrade, t.profit), longestStreak: Math.max(state.longestStreak, streak),
        pools: state.pools.map(p => p.id === t.packageId ? { ...p, profit: p.profit + t.profit, trades: p.trades + 1 } : p),
        bots: state.bots.map(b => b.name === t.botName ? { ...b, profit: b.profit + t.profit, trades: b.trades + 1, wins: b.wins + Number(t.isWin) } : b),
      };
    }
  }
}
