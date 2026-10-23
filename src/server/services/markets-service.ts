import { ledgerTrades } from "./trade-log-service";
import { getFundsBundle } from "./funds-service";
import { strategies } from "@/lib/markets/model";
import type { MarketBundle, SymbolDTO } from "@/lib/markets/model";
export function getMarketsBundle(): MarketBundle {
  const asOf = "2026-10-23T10:00:00Z";
  const definitions: [string, string, SymbolDTO["group"], number, number][] = [
    ...[10, 25, 50, 75, 100].map(
      (n) =>
        [`R_${n}`, `Volatility ${n} Index`, "Synthetics", 2, 4000 + n * 15] as [
          string,
          string,
          SymbolDTO["group"],
          number,
          number,
        ],
    ),
    ...[10, 25, 50, 75, 100].map(
      (n) =>
        [
          `1HZ${n}V`,
          `Volatility ${n} (1s) Index`,
          "Synthetics",
          2,
          2000 + n * 11,
        ] as [string, string, SymbolDTO["group"], number, number],
    ),
    ["frxEURUSD", "Euro / US Dollar", "Forex", 5, 1.0842],
    ["frxGBPUSD", "Pound / US Dollar", "Forex", 5, 1.2951],
    ["frxUSDJPY", "US Dollar / Yen", "Forex", 3, 149.52],
    ["frxAUDUSD", "Australian Dollar / USD", "Forex", 5, 0.6654],
    ["frxUSDCHF", "US Dollar / Swiss Franc", "Forex", 5, 0.8852],
    ["frxEURGBP", "Euro / Pound", "Forex", 5, 0.8371],
    ["frxXAUUSD", "Gold / USD", "Commodities", 2, 2341.5],
    ["frxXAGUSD", "Silver / USD", "Commodities", 3, 28.741],
    ["frxXPDUSD", "Palladium / USD", "Commodities", 2, 1042.3],
    ["cryBTCUSD", "Bitcoin / USD", "Crypto", 2, 67432],
    ["cryETHUSD", "Ethereum / USD", "Crypto", 2, 2641.15],
    ["cryLTCUSD", "Litecoin / USD", "Crypto", 2, 72.42],
    ["OTC_SPX", "US broad-market index", "Indices", 2, 5812.5],
    ["OTC_NDX", "US technology index", "Indices", 2, 19842.4],
    ["OTC_DJI", "US industrial index", "Indices", 2, 42341.2],
    ["STOCK_AAPL", "Apple reference", "Stock Indices", 2, 231.2],
    ["STOCK_MSFT", "Microsoft reference", "Stock Indices", 2, 421.5],
    ["STOCK_NVDA", "Nvidia reference", "Stock Indices", 2, 135.4],
  ];
  const symbols = definitions.map(([code, name, group, decimals, base], i) => ({
    code,
    name,
    group,
    decimals,
    previous: base,
    tickSeconds: code.startsWith("1HZ") ? 1 : 2,
    contracts:
      group === "Synthetics"
        ? ["CALL", "PUT", "DIGITEVEN", "DIGITODD"]
        : ["CALL", "PUT"],
    ticks: Array.from({ length: 100 }, (_, j) => ({
      quote: Number(
        (
          base +
          Math.sin(j * 0.23 + i) * 10 ** -decimals * 17 +
          j * 10 ** -decimals * 0.11
        ).toFixed(decimals),
      ),
      time: new Date(
        Date.parse(asOf) - (99 - j) * (code.startsWith("1HZ") ? 1000 : 2000),
      ).toISOString(),
    })),
  }));
  const funds = getFundsBundle();
  return {
    mode: "demo",
    asOf,
    revision: 0,
    symbols,
    favorites: ["R_10", "R_75", "R_100"],
    pools: funds.allocations.map((p, i) => ({
      code: p.code,
      name: p.name,
      available: p.capital - p.deployed,
      strategies: [...strategies],
      symbols:
        i === 0
          ? ["R_10", "R_75"]
          : i === 1
            ? ["R_10", "R_100"]
            : ["R_10", "R_75", "R_100"],
      guardian: true,
      drawdown: 5,
    })),
    schedules: [],
    receipts: ledgerTrades.map((t) => ({
      symbol: t.symbol,
      strategy: t.strategy,
      profit: t.profit,
      isWin: t.isWin,
      executedAt: t.executedAt,
    })),
    audit: [],
  };
}
