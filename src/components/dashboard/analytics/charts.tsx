"use client";
import { useState } from "react";
import { analyticsColors, type AnalyticsGroup } from "@/lib/analytics/types";
export interface ChartSeries {
  name: string;
  color: string;
  values: (number | null)[];
}
export function AnalyticsLineChart({
  labels,
  series,
  label,
  format,
  onPoint,
  markers = [],
  includeZero = true,
}: {
  labels: string[];
  series: ChartSeries[];
  label: string;
  format: (n: number) => string;
  onPoint?: (index: number) => void;
  markers?: { index: number; text: string }[];
  includeZero?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const candidates = series.filter((s) => !hidden.includes(s.name));
  const visible = candidates.length ? candidates : series;
  const numbers = visible.flatMap((s) =>
    s.values.filter((n): n is number => n !== null),
  );
  const low = numbers.length
    ? Math.min(...numbers, ...(includeZero ? [0] : []))
    : 0;
  const high = numbers.length
    ? Math.max(...numbers, ...(includeZero ? [0] : []))
    : 0;
  const spread = high - low || 1;
  const min = low - spread * 0.1;
  const max = high + spread * 0.1;
  const W = 760,
    H = 240,
    L = 66,
    R = 18,
    T = 22,
    B = 32;
  const x = (i: number) =>
    L + (i / Math.max(1, labels.length - 1)) * (W - L - R);
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - B);
  function path(values: (number | null)[]) {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
      pen = true;
    });
    return d;
  }
  const focused = hover === null ? labels.length - 1 : hover;
  return (
    <div className="an-chart">
      <div className="an-chart-legend">
        {series.map((s) => (
          <button
            key={s.name}
            className={visible.some((v) => v.name === s.name) ? "" : "is-muted"}
            onClick={() =>
              setHidden(
                hidden.includes(s.name)
                  ? hidden.filter((n) => n !== s.name)
                  : visible.length > 1
                    ? [...hidden, s.name]
                    : hidden,
              )
            }
            aria-pressed={visible.some((v) => v.name === s.name)}
          >
            <span style={{ background: s.color }} />
            {s.name}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <title>{label}</title>
        <desc>
          Interactive daily data. Use the day selector below for keyboard
          access; click a plot point to inspect it.
        </desc>
        {Array.from({ length: 5 }, (_, i) => {
          const value = min + ((max - min) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={L}
                x2={W - R}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <text
                x={L - 10}
                y={y(value) + 3}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="9"
              >
                {format(value)}
              </text>
            </g>
          );
        })}
        {labels.map(
          (d, i) =>
            (i === 0 ||
              i === labels.length - 1 ||
              i % Math.max(1, Math.ceil(labels.length / 6)) === 0) && (
              <text
                x={x(i)}
                y={H - 10}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="9"
                key={d}
              >
                {d.length === 10 ? d.slice(5) : d}
              </text>
            ),
        )}
        {visible.map((s) => (
          <path
            key={s.name}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {markers
          .filter((m) => m.index >= 0 && m.index < labels.length)
          .map((m, i) => (
            <g key={i}>
              <line
                x1={x(m.index)}
                x2={x(m.index)}
                y1={T}
                y2={H - B}
                stroke="var(--warning)"
                strokeDasharray="2 4"
                opacity=".6"
              />
              <circle cx={x(m.index)} cy={T + 4} r="4" fill="var(--warning)">
                <title>{m.text}</title>
              </circle>
            </g>
          ))}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={T}
            y2={H - B}
            stroke="var(--text-muted)"
          />
        )}
        {labels.map((d, i) => (
          <rect
            key={d}
            x={x(i) - (W - L - R) / Math.max(1, labels.length - 1) / 2}
            y={T}
            width={(W - L - R) / Math.max(1, labels.length - 1)}
            height={H - T - B}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onPoint?.(i)}
            style={{ cursor: onPoint ? "pointer" : "crosshair" }}
          />
        ))}
      </svg>
      <div className="an-chart-readout">
        <label>
          Inspect day{" "}
          <select
            aria-label={`${label} day selector`}
            value={focused}
            onChange={(e) => setHover(Number(e.target.value))}
          >
            {labels.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div>
          {visible.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}:{" "}
              <b className="mono">
                {s.values[focused] === null || s.values[focused] === undefined
                  ? "No observation"
                  : format(s.values[focused]!)}
              </b>
            </span>
          ))}
        </div>
        {onPoint && (
          <button onClick={() => onPoint(focused)}>Details ↗</button>
        )}
      </div>
    </div>
  );
}
export function ContributionBars({
  rows,
  onSelect,
}: {
  rows: AnalyticsGroup[];
  onSelect: (key: string) => void;
}) {
  const scale = Math.max(1, ...rows.map((r) => Math.abs(r.profit)));
  return (
    <div
      className="an-bar-chart"
      role="group"
      aria-label="Net profit contribution by category"
    >
      {rows.map((r, i) => (
        <button key={r.key} onClick={() => onSelect(r.key)}>
          <span>{r.key}</span>
          <span className="an-bar-track">
            <span
              style={{
                width: `${(Math.abs(r.profit) / scale) * 100}%`,
                background:
                  r.profit < 0
                    ? "var(--loss)"
                    : analyticsColors[i % analyticsColors.length],
              }}
            />
          </span>
          <strong
            className={`mono ${r.profit >= 0 ? "text-win" : "text-loss"}`}
          >
            {r.profit >= 0 ? "+" : "−"}$
            {Math.abs(r.profit).toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </strong>
        </button>
      ))}
    </div>
  );
}
export function DistributionDonut({
  paid,
  pending,
  operator,
}: {
  paid: number;
  pending: number;
  operator: number;
}) {
  const total = paid + pending + operator;
  const values = [
    { label: "Distributed (modeled)", value: paid, color: "var(--accent)" },
    { label: "Pending investor", value: pending, color: "#a8c9c5" },
    { label: "Operator", value: operator, color: "#64748b" },
  ];
  let offset = 0;
  return (
    <div className="an-donut">
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-label={`Positive profit allocation: ${paid.toFixed(2)} distributed, ${pending.toFixed(2)} pending, ${operator.toFixed(2)} operator`}
      >
        <title>Modeled positive-profit allocation</title>
        <circle
          cx="90"
          cy="90"
          r="67"
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth="18"
        />
        {values.map((v) => {
          const length = total ? (v.value / total) * 100 : 0;
          const start = offset;
          offset += length;
          return (
            <circle
              key={v.label}
              cx="90"
              cy="90"
              r="67"
              fill="none"
              stroke={v.color}
              strokeWidth="18"
              pathLength="100"
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
              transform="rotate(-90 90 90)"
            />
          );
        })}
        <text
          x="90"
          y="84"
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="10"
        >
          INVESTOR PAID
        </text>
        <text
          x="90"
          y="108"
          textAnchor="middle"
          fill="var(--text-primary)"
          fontSize="23"
          fontFamily="monospace"
        >
          {paid + pending ? Math.round((paid / (paid + pending)) * 100) : 0}%
        </text>
      </svg>
      <div>
        {values.map((v) => (
          <span key={v.label}>
            <i style={{ background: v.color }} />
            {v.label}
            <b className="mono">
              $
              {v.value.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}
