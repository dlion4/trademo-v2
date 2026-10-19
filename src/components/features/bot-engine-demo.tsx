"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { DemoLabel, DemoPanel } from "@/components/features/module-shell";
import { formatCurrency, formatPrice } from "@/lib/format";
import type {
  ConfigFieldDTO,
  EquityPointDTO,
  RiskCheckDTO,
  ScheduleWindowDTO,
  TradeFeedRowDTO,
} from "@/lib/api/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

/** 1 · Visual schedule calendar — week grid with positioned session blocks. */
function ScheduleCalendar({ windows }: { windows: ScheduleWindowDTO[] }) {
  const [selected, setSelected] = useState<string | null>(windows[0]?.id ?? null);

  return (
    <>
      <DemoLabel>Weekly schedule · 24h grid</DemoLabel>
      <div className="sched">
        <div className="sched__head">
          <span />
          {DAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="sched__body">
          {HOURS.map((hour) => (
            <div className="sched__row" key={hour}>
              <span className="sched__hour">{String(hour).padStart(2, "0")}:00</span>
              {DAYS.map((_, dayIndex) => {
                const block = windows.find(
                  (item) => item.day === dayIndex && item.startHour <= hour && hour < item.endHour,
                );
                return (
                  <div className="sched__cell" key={`${hour}-${dayIndex}`}>
                    {block ? (
                      <button
                        type="button"
                        className={`sched__block${block.state === "paused" ? " is-paused" : ""}${
                          selected === block.id ? " is-active" : ""
                        }`}
                        style={
                          selected === block.id
                            ? { background: "var(--accent)", color: "#fff", borderLeftColor: "#fff" }
                            : undefined
                        }
                        onClick={() => setSelected(block.id)}
                        title={`${block.botName} · ${String(block.startHour).padStart(2, "0")}:00–${String(
                          block.endHour,
                        ).padStart(2, "0")}:00`}
                      >
                        {block.botName}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="sched__legend">
        <span>
          <i style={{ background: "var(--accent)" }} />
          Running window
        </span>
        <span>
          <i style={{ background: "var(--border-strong)" }} />
          Paused
        </span>
        <span className="ms-auto mono">{windows.length} scheduled sessions</span>
      </div>
    </>
  );
}

/** 2 · Live trade feed — rows flash win/loss as the demo ticks. */
function LiveTradeFeed({ rows }: { rows: TradeFeedRowDTO[] }) {
  const [feed, setFeed] = useState<TradeFeedRowDTO[]>(rows);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFeed((current) => {
        const last = current[0];
        const symbols = ["R_75", "R_10", "frxEURUSD", "1HZ50V", "frxXAUUSD", "R_100"];
        const contracts = ["CALL", "PUT"] as const;
        const stakes = [2, 4, 6, 10, 12];
        const next: TradeFeedRowDTO = {
          id: `live-${Date.now()}`,
          time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          symbol: symbols[Math.floor(Math.random() * symbols.length)],
          contract: contracts[Math.floor(Math.random() * contracts.length)],
          stake: stakes[Math.floor(Math.random() * stakes.length)],
          pnl: null,
          state: "open",
        };
        const settled = last && last.state === "open" ? { ...last, pnl: Math.random() > 0.45 ? 4.2 : -last.stake, state: Math.random() > 0.45 ? ("won" as const) : ("lost" as const) } : null;
        const merged = settled ? [next, settled, ...current.slice(1)] : [next, ...current];
        return merged.slice(0, 6);
      });
    }, 2600);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <DemoLabel>Live trade feed · streaming</DemoLabel>
      <div className="feed">
        {feed.map((row) => (
          <div
            key={row.id}
            className={`feed__row ${row.state === "won" ? "row-flash-win" : row.state === "lost" ? "row-flash-loss" : ""}`}
          >
            <span className="feed__sym">{row.symbol}</span>
            <span className="feed__hide-lg">{row.contract}</span>
            <span>{formatCurrency(row.stake, "USD", 0)}</span>
            <span className="feed__hide">{row.time}</span>
            <span
              className={
                row.state === "open"
                  ? "feed__pnl--open"
                  : (row.pnl ?? 0) >= 0
                    ? "feed__pnl--up"
                    : "feed__pnl--down"
              }
            >
              {row.state === "open" ? "open" : formatCurrency(row.pnl ?? 0, "USD", 2)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** 3 · Bot config screen mockup + the eight pre-trade risk checks. */
function BotConfig({ fields, checks }: { fields: ConfigFieldDTO[]; checks: RiskCheckDTO[] }) {
  return (
    <>
      <DemoLabel>Bot configuration</DemoLabel>
      <div className="cfg mb-4">
        {fields.map((field) => (
          <div className="cfg__field" key={field.key}>
            <div className="cfg__key">{field.label}</div>
            <div className="cfg__val">{field.value}</div>
          </div>
        ))}
      </div>

      <DemoLabel>Risk checks · evaluated before every contract</DemoLabel>
      <ul className="cfg__checks">
        {checks.map((check) => (
          <li key={check.id}>
            <Icon name="check" size={13} />
            <span>
              {check.label} <span className="text-muted">— {check.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** 4 · Session equity mini chart with chart-draw reveal. */
function EquityChart({ points, label }: { points: EquityPointDTO[]; label: string }) {
  if (points.length < 2) return null;

  const width = 640;
  const height = 150;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (points.length - 1);

  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - ((point.value - min) / span) * (height - 18) - 9;
    return { x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const first = values[0];
  const last = values[values.length - 1];
  const delta = ((last - first) / first) * 100;

  return (
    <>
      <DemoLabel>{label}</DemoLabel>
      <div className="eq">
        <div className="eq__top">
          <span className="eq__value">{formatCurrency(last, "USD", 2)}</span>
          <span className="eq__delta">
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(2)}% session
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={label}>
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={width}
              y1={height * ratio}
              y2={height * ratio}
              stroke="var(--border-subtle)"
              strokeWidth="1"
            />
          ))}
          <g className="chart-draw">
            <path d={area} fill="url(#eqFill)" />
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" />
            {coords.map((c, index) => (
              <circle key={index} cx={c.x} cy={c.y} r="2.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
            ))}
          </g>
        </svg>
        <div className="eq__axis">
          {points.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      </div>
    </>
  );
}

export function BotEngineDemo({
  demo,
}: {
  demo: Extract<import("@/lib/api/types").FeatureDemoDTO, { kind: "botEngine" }>;
}) {
  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <DemoPanel title="bot-engine · scheduler" badge="live">
          <ScheduleCalendar windows={demo.schedule} />
          <div className="demo__section">
            <LiveTradeFeed rows={demo.feed} />
          </div>
        </DemoPanel>
      </div>

      <div className="col-lg-5">
        <DemoPanel title="bot-4f2 · config">
          <BotConfig fields={demo.config} checks={demo.riskChecks} />
          <div className="demo__section">
            <EquityChart points={demo.equity} label={demo.equityLabel} />
          </div>
        </DemoPanel>
      </div>
    </div>
  );
}


