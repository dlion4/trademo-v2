"use client";
import { useState } from "react";
import type { PayoutDay } from "@/lib/payouts/types";
export function PayoutHistoryChart({
  points,
  onDay,
}: {
  points: PayoutDay[];
  onDay: (day: string) => void;
}) {
  const [selected, setSelected] = useState(points.length - 1);
  const [showBars, setShowBars] = useState(true);
  const [showLine, setShowLine] = useState(true);
  const index = Math.min(selected, points.length - 1);
  const current = points[index];
  const W = 980,
    H = 265,
    L = 64,
    R = 20,
    T = 16,
    B = 36,
    high =
      Math.max(100, ...points.map((p) => Math.max(p.gross, p.average7))) * 1.15,
    step = (W - L - R) / Math.max(1, points.length),
    x = (i: number) => L + step * (i + 0.5),
    y = (n: number) => H - B - (n / high) * (H - B - T);
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.average7)}`)
    .join(" ");
  return (
    <div className="wd-history-chart">
      <div className="wd-chart-legend">
        <button
          aria-pressed={showBars}
          className={showBars ? "" : "muted"}
          onClick={() => {
            if (showLine || !showBars) setShowBars(!showBars);
          }}
        >
          <i />
          Daily gross payouts
        </button>
        <button
          aria-pressed={showLine}
          className={showLine ? "" : "muted"}
          onClick={() => {
            if (showBars || !showLine) setShowLine(!showLine);
          }}
        >
          <i className="line" />
          Trailing 7-day average
        </button>
        <span>USD · completed only · fees included in gross</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Completed payout daily volume and seven-day moving average"
      >
        <title>Daily settled payout volume</title>
        <desc>
          Use the day selector or select a bar to inspect the underlying
          settlement records. Missing activity dates are zero.
        </desc>
        {Array.from({ length: 5 }, (_, i) => {
          const n = (high * i) / 4;
          return (
            <g key={i}>
              <line
                x1={L}
                x2={W - R}
                y1={y(n)}
                y2={y(n)}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <text
                x={L - 10}
                y={y(n) + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted)"
              >
                ${Math.round(n).toLocaleString()}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => (
          <g key={p.day}>
            {showBars && (
              <rect
                className="wd-chart-bar"
                x={x(i) - step * 0.28}
                y={y(p.gross)}
                width={step * 0.56}
                height={Math.max(0, H - B - y(p.gross))}
                rx="2"
                fill={i === index ? "var(--accent)" : "#b1d3cf"}
              />
            )}
            {(i === 0 ||
              i === points.length - 1 ||
              i % Math.ceil(points.length / 6) === 0) && (
              <text
                x={x(i)}
                y={H - 12}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {p.day.slice(5)}
              </text>
            )}
            <rect
              x={L + step * i}
              y={T}
              width={step}
              height={H - B - T}
              fill="transparent"
              onMouseEnter={() => setSelected(i)}
              onClick={() => onDay(p.day)}
              style={{ cursor: "pointer" }}
            />
          </g>
        ))}
        {showLine && (
          <path
            d={path}
            fill="none"
            stroke="#667a90"
            strokeWidth="2.4"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}
      </svg>
      <div className="wd-chart-readout">
        <label>
          Inspect day{" "}
          <select
            aria-label="Payout history day selector"
            value={index}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {points.map((p, i) => (
              <option key={p.day} value={i}>
                {p.day}
              </option>
            ))}
          </select>
        </label>
        <span>
          Gross <b className="mono">${current.gross.toFixed(2)}</b>
        </span>
        <span>{current.count} settlements</span>
        <span>
          7-day average <b className="mono">${current.average7.toFixed(2)}</b>
        </span>
        <button className="wd-link" onClick={() => onDay(current.day)}>
          Inspect settlements ↗
        </button>
      </div>
    </div>
  );
}
