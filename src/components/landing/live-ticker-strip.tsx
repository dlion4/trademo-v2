"use client";

import { Icon } from "@/components/icons";
import { Sparkline } from "@/components/landing/sparkline";
import { useTickerFeed } from "@/lib/queries/use-landing-queries";
import { formatPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TickerQuoteDTO } from "@/lib/api/types";

interface LiveTickerStripProps {
  initialQuotes?: TickerQuoteDTO[];
}

/**
 * Continuous marquee of bundled instrument quotes.
 */
export function LiveTickerStrip({ initialQuotes }: LiveTickerStripProps) {
  const seed = initialQuotes?.length
    ? {
        quotes: initialQuotes,
        meta: { source: "fallback" as const, generatedAt: new Date(0).toISOString(), version: 1 },
      }
    : undefined;

  const { data } = useTickerFeed(seed);
  const quotes = data?.quotes ?? [];

  if (quotes.length === 0) return null;

  // Duplicate the track so the -50% translate loops seamlessly.
  const track = [...quotes, ...quotes];

  return (
    <div className="ticker" id="markets" role="marquee" aria-label="Live market ticker">
      <div className="ticker__viewport">
        {track.map((quote, index) => {
          const rising = quote.direction !== "down";
          return (
            <span className="ticker__item" key={`${quote.symbol}-${index}`}>
              <span className="ticker__symbol">{quote.displayName}</span>
              <span className={cn("ticker__price", rising ? "is-up" : "is-down")}>
                {formatPrice(quote.price, quote.decimals)}
              </span>
              <span className={cn("ticker__delta", rising ? "ticker__delta--up" : "ticker__delta--down")}>
                <Icon name={rising ? "trendUp" : "trendDown"} size={13} />
                {formatPercent(quote.changePercent)}
              </span>
              <Sparkline
                className="ticker__spark"
                points={quote.sparkline}
                rising={rising}
                width={72}
                height={22}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
