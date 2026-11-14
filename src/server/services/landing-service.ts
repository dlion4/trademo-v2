import { LANDING_FALLBACK, TICKER_INSTRUMENTS } from "@/lib/content/landing-content";
import type { ContentMetaDTO, LandingContentDTO, TickerQuoteDTO } from "@/lib/api/types";

const CONTENT_VERSION = 1;

function meta(): ContentMetaDTO {
  return { source: "mock", generatedAt: new Date().toISOString(), version: CONTENT_VERSION };
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 100000;
  }
  return hash / 1000;
}

const VOLATILITY_BY_MARKET: Record<string, number> = {
  forex: 0.0016,
  synthetic: 0.006,
  crypto: 0.009,
  commodity: 0.003,
  index: 0.004,
};

function simulateQuote(row: TickerQuoteDTO, now: number): TickerQuoteDTO {
  const phase = hashSeed(row.symbol);
  const volatility = VOLATILITY_BY_MARKET[row.market] ?? 0.004;
  const seconds = now / 1000;

  const wave = (time: number) =>
    Math.sin(time / 47 + phase) * 0.6 +
    Math.sin(time / 13 + phase * 1.7) * 0.3 +
    Math.sin(time / 181 + phase) * 0.9;

  const drift = wave(seconds) * volatility;
  const price = Math.max(row.price * 0.9, row.price * (1 + drift));
  const reference = row.price * (1 + wave(seconds - 900) * volatility);
  const changePercent = row.price > 0 ? ((price - reference) / reference) * 100 : 0;
  const sparkline = Array.from({ length: 28 }, (_, index) => {
    const offset = (27 - index) * 30;
    return Number((row.price * (1 + wave(seconds - offset) * volatility)).toFixed(row.decimals));
  });

  return {
    symbol: row.symbol,
    displayName: row.displayName,
    market: row.market,
    price: Number(price.toFixed(row.decimals)),
    changePercent: Number(changePercent.toFixed(2)),
    direction: changePercent > 0.001 ? "up" : changePercent < -0.001 ? "down" : "flat",
    dayHigh: Number(Math.max(row.dayHigh, price).toFixed(row.decimals)),
    dayLow: Number(Math.min(row.dayLow, price).toFixed(row.decimals)),
    sparkline,
    decimals: row.decimals,
    updatedAt: new Date(now).toISOString(),
  };
}

export async function getLandingContent(): Promise<{ content: LandingContentDTO; usedFallback: false }> {
  const now = Date.now();
  return {
    content: {
      ...LANDING_FALLBACK,
      ticker: TICKER_INSTRUMENTS.map((instrument) => simulateQuote(instrument, now)),
      meta: meta(),
    },
    usedFallback: false,
  };
}

export async function getTickerFeed(): Promise<{ quotes: TickerQuoteDTO[]; meta: ContentMetaDTO }> {
  const now = Date.now();
  return {
    quotes: TICKER_INSTRUMENTS.map((instrument) => simulateQuote(instrument, now)),
    meta: meta(),
  };
}
