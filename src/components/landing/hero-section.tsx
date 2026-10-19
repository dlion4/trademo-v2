"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import { LiveTickerStrip } from "@/components/landing/live-ticker-strip";
import { useCountUp } from "@/lib/hooks/use-motion";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { HeroPayloadDTO, TickerQuoteDTO } from "@/lib/api/types";

interface HeroSectionProps {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  payload: HeroPayloadDTO;
  /** Server-rendered quotes so the marquee paints on first paint. */
  tickerQuotes: TickerQuoteDTO[];
}

function ConsoleMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="console__metric">
      <span className="console__metric-label">{label}</span>
      <div className="console__metric-value tnum">{value}</div>
    </div>
  );
}

/** Animated pooled-capital readout inside the hero console. */
function PooledCapital({ value }: { value: number }) {
  const animated = useCountUp(value, { duration: 1400 });
  return <>{formatCurrency(animated, "USD", 0)}</>;
}

export function HeroSection({ eyebrow, title, subtitle, payload, tickerQuotes }: HeroSectionProps) {
  const [clock, setClock] = useState<string>("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const highlight = payload.headlineHighlight;
  const baseTitle = highlight && title.endsWith(highlight) ? title.slice(0, -highlight.length) : title;
  const { console: consoleData } = payload;

  return (
    <section className="hero" id="top">
      <div className="container-xl">
        <div className="hero__grid">
          <div>
            <Reveal delay={0}>
              <span className="eyebrow-label">
                <Icon name="bolt" size={14} />
                {eyebrow}
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="hero__title">
                {baseTitle}
                <span className="text-accent">{highlight}</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="hero__subtitle">{subtitle}</p>
            </Reveal>

            <Reveal delay={240}>
              <div className="hero__cta">
                <Link href={payload.primaryCta.href} className="btn-brand">
                  <span aria-hidden="true">🤖</span>
                  {payload.primaryCta.label}
                  <Icon name="arrowRight" size={16} />
                </Link>
                <Link href={payload.secondaryCta.href} className="btn-ghost">
                  <span aria-hidden="true">💎</span>
                  {payload.secondaryCta.label}
                </Link>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <ul className="hero__highlights">
                {payload.highlights.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={14} />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={140}>
            <aside className="console" aria-label="Live automation preview">
              <div className="console__glow" />

              <div className="console__head">
                <div>
                  <div className="console__label">{consoleData.accountLabel}</div>
                  <div className="mono text-body-2" style={{ fontSize: "0.78rem" }}>
                    {consoleData.market}
                  </div>
                </div>
                <span className="console__status">
                  <span className="live-dot" /> {consoleData.status}
                </span>
              </div>

              <div className="console__metrics">
                <ConsoleMetric label="Capital pooled" value={<PooledCapital value={consoleData.capitalPooled} />} />
                <ConsoleMetric label="Active bots" value={formatNumber(consoleData.activeBots)} />
                <ConsoleMetric
                  label="Operator share"
                  value={`${formatNumber(consoleData.operatorSharePercent)}%`}
                />
              </div>

              <div className="console__strategy">
                <Icon name="bot" size={18} />
                <div>
                  <div className="console__metric-label">Running strategy</div>
                  <div className="console__strategy-name">{consoleData.strategy}</div>
                </div>
              </div>

              <div className="console__feed">
                {consoleData.trades.map((trade) => (
                  <div
                    key={trade.id}
                    className={`console__row${trade.result === "live" ? " console__row--live" : ""}`}
                  >
                    <span className="console__symbol">{trade.symbol}</span>
                    <span className={`console__side console__side--${trade.side.toLowerCase()}`}>
                      {trade.side}
                    </span>
                    <span className="text-body-2 mono">${formatNumber(trade.stake, 2)} stake</span>
                    <span className={`console__payout console__payout--${trade.result}`}>
                      {trade.result === "live"
                        ? "running…"
                        : `${trade.result === "won" ? "+" : "−"}$${formatNumber(trade.payout, 2)}`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="console__foot">
                <span className="mono">{clock || "--:--:--"} UTC · tick stream</span>
                <span className="d-inline-flex align-items-center gap-2">
                  <Icon name="shield" size={14} /> AI Guardian armed
                </span>
              </div>
            </aside>
          </Reveal>
        </div>

        <LiveTickerStrip initialQuotes={tickerQuotes} />
      </div>
    </section>
  );
}
