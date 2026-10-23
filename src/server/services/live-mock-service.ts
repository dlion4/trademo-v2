import type { LiveBundle, LiveTrade } from "@/lib/live/types";

/** Deterministic demo snapshot; never submits orders or connects to a broker. */
export function getLiveBundle(): LiveBundle {
  const asOf = "2026-10-21T14:47:00.000Z";
  const trades: LiveTrade[] = Array.from({ length: 47 }, (_, i) => {
    const isWin = i < 3 || (i > 3 && i % 3 !== 0 && i !== 46);
    const symbol = i % 3 === 0 ? "R_10" : i % 3 === 1 ? "R_75" : "R_100";
    const stake = symbol === "R_100" ? 70 : 35;
    const soldAt = new Date(Date.parse(asOf) - i * 16000).toISOString();
    return { tradeId: `trd_live_${4700 - i}`, packageId: `PKG-0${i % 3 + 1}`, symbol,
      contractType: symbol === "R_10" ? "Rise · 5 ticks" : symbol === "R_75" ? "Even · 5 ticks" : "Odd · 5 ticks",
      stake, payout: isWin ? stake * 1.8 : 0, profit: isWin ? stake * .8 : -stake, isWin,
      entrySpot: 4531.92 + i * .13, exitSpot: 4532.18 + i * .11,
      boughtAt: new Date(Date.parse(soldAt) - 18000).toISOString(), soldAt,
      botName: ["Bot-Alpha", "Bot-Bravo", "Bot-Charlie"][i % 3], scheduleId: `SCH-00${i % 3 + 1}` };
  });
  return { mode: "simulation", asOf, startedAt: "2026-10-21T14:00:00.000Z", capitalInMarket: 142000,
    sessionProfit: 3247, totalTrades: 47, wins: 31, streak: 3, bestTrade: 70, worstTrade: -35, longestStreak: 5, averageDuration: 18,
    trades,
    ticks: [
      { symbol: "R_10", name: "Volatility 10", price: 4532.11, change: .04 },
      { symbol: "R_25", name: "Volatility 25", price: 3217.55, change: -.02 },
      { symbol: "R_50", name: "Volatility 50", price: 1898.42, change: .07 },
      { symbol: "R_75", name: "Volatility 75", price: 2451.18, change: -.03 },
      { symbol: "R_100", name: "Volatility 100", price: 5621.83, change: .11 },
      { symbol: "1HZ10V", name: "Volatility 10 (1s)", price: 1240.92, change: .01 },
    ].map(t => ({ ...t, symbol: t.symbol as LiveBundle["ticks"][number]["symbol"], cadence: t.symbol === "1HZ10V" ? "2 ticks/s" : "1 tick/s", updatedAt: asOf })),
    bots: [
      { id: "live-alpha", name: "Bot-Alpha", symbol: "R_10", strategy: "Martingale", status: "running", trades: 12, wins: 9, profit: 84, stake: 35, packageId: "PKG-01" },
      { id: "live-bravo", name: "Bot-Bravo", symbol: "R_75", strategy: "Even / Odd", status: "running", trades: 8, wins: 5, profit: 28, stake: 35, packageId: "PKG-02" },
      { id: "live-charlie", name: "Bot-Charlie", symbol: "R_100", strategy: "DCA", status: "paused", trades: 6, wins: 3, profit: 0, stake: 70, packageId: "PKG-03" },
      { id: "live-delta", name: "Bot-Delta", symbol: "R_10", strategy: "Oscar’s Grind", status: "stopped", trades: 0, wins: 0, profit: 0, stake: 35, packageId: "PKG-01" },
    ],
    pools: [
      { id: "PKG-01", name: "Steady Growth", capital: 14000, profit: 1298, trades: 23, target: 1854, investors: 16 },
      { id: "PKG-02", name: "Balanced Returns", capital: 12250, profit: 1138, trades: 15, target: 1751, investors: 13 },
      { id: "PKG-03", name: "Alpha Momentum", capital: 8750, profit: 811, trades: 9, target: 954, investors: 9 },
    ],
    guardian: [
      { id: "g1", time: "13:42", packageId: "PKG-02", trigger: "8 consecutive losses", action: "Bots paused · 5 min cooldown", resumedAt: "13:47" },
      { id: "g2", time: "12:15", packageId: "PKG-03", trigger: "5% drawdown threshold", action: "Bots paused · 10 min cooldown", resumedAt: "12:25" },
      { id: "g3", time: "11:08", packageId: "PKG-01", trigger: "Scheduled symbol rotation", action: "Switched R_10 → R_25", resumedAt: "11:08" },
    ],
  };
}
