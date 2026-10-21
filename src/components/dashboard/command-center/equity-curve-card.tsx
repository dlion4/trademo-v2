"use client";

import { useState } from "react";

import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { EquityPointDTO, PackageSummaryDTO } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";

export function EquityAndPoolsSection({
  curve,
  packages,
}: {
  curve: EquityPointDTO[];
  packages: PackageSummaryDTO[];
}) {
  const { openOverlay, inspectEntity } = useOperatorUI();
  const [range, setRange] = useState<"7d" | "14d">("14d");
  const slice = range === "7d" ? curve.slice(-7) : curve;
  const [hoverIdx, setHoverIdx] = useState<number>(slice.length - 1);

  const activePoint = slice[Math.min(hoverIdx, slice.length - 1)] ?? slice[slice.length - 1];
  const minVal = Math.min(...slice.map((p) => p.equity)) - 1200;
  const maxVal = Math.max(...slice.map((p) => p.equity)) + 1200;
  const w = 620;
  const h = 190;
  const padX = 14;
  const padY = 18;

  const coords = slice.map((p, idx) => {
    const x = padX + (idx / Math.max(1, slice.length - 1)) * (w - padX * 2);
    const y = h - padY - ((p.equity - minVal) / Math.max(1, maxVal - minVal)) * (h - padY * 2);
    return { x, y, p };
  });

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const activeCoord = coords[Math.min(hoverIdx, coords.length - 1)] ?? coords[coords.length - 1];

  return (
    <section className="row g-3 cc-section" aria-label="Equity curve and active syndicate packages">
      {/* Left: Crisp SVG Institutional Equity Curve */}
      <div className="col-12 col-xl-7">
        <div className="cc-panel h-100">
          <div className="cc-panel__head">
            <div>
              <span className="eyebrow-label">Pooled Capital Curve</span>
              <h2 className="cc-panel__title">14-Day Syndicate NAV &amp; Session Attribution</h2>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="cc-seg">
                {(["7d", "14d"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={cn("cc-seg__btn mono", range === r && "is-active")}
                    onClick={() => {
                      setRange(r);
                      setHoverIdx(r === "7d" ? 6 : curve.length - 1);
                    }}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn-ghost btn-ghost--sm"
                onClick={() => openOverlay({ type: "export-reports", defaultScope: "trades" })}
              >
                <Icon name="download" size={14} /> CSV
              </button>
            </div>
          </div>

          <div className="cc-chart-readout">
            <div>
              <span className="cc-meta-label">{activePoint.date} NAV</span>
              <strong className="mono cc-readout-val">{formatCurrency(activePoint.equity, "USD", 0)}</strong>
            </div>
            <div>
              <span className="cc-meta-label">Daily Net P&amp;L</span>
              <strong
                className={cn(
                  "mono cc-readout-val",
                  activePoint.dailyPnL >= 0 ? "text-win" : "text-loss",
                )}
              >
                {activePoint.dailyPnL >= 0 ? "+" : ""}
                {formatCurrency(activePoint.dailyPnL, "USD", 0)}
              </strong>
            </div>
            <div>
              <span className="cc-meta-label">Win Rate</span>
              <strong className="mono cc-readout-val">{activePoint.winRate}%</strong>
            </div>
            <div>
              <span className="cc-meta-label">Contracts</span>
              <strong className="mono cc-readout-val">{activePoint.trades}</strong>
            </div>
          </div>

          <div className="cc-svg-wrap">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="cc-equity-svg chart-draw"
              role="img"
              aria-label="14-day pooled equity chart"
            >
              {[0.25, 0.5, 0.75].map((ratio) => (
                <line
                  key={ratio}
                  x1={padX}
                  x2={w - padX}
                  y1={padY + ratio * (h - padY * 2)}
                  y2={padY + ratio * (h - padY * 2)}
                  className="cc-grid-line"
                />
              ))}
              {activeCoord ? (
                <line
                  x1={activeCoord.x}
                  x2={activeCoord.x}
                  y1={padY}
                  y2={h - padY}
                  className="cc-crosshair"
                />
              ) : null}
              <polyline points={polyline} fill="none" className="cc-equity-line" />
              {coords.map((c, idx) => (
                <g
                  key={c.p.date}
                  onMouseEnter={() => setHoverIdx(idx)}
                  onFocus={() => setHoverIdx(idx)}
                  className="cc-hit-point"
                >
                  <rect x={c.x - 18} y={0} width={36} height={h} fill="transparent" />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={idx === hoverIdx ? 5 : 3}
                    className={cn("cc-point", idx === hoverIdx && "is-active")}
                  />
                </g>
              ))}
            </svg>
            <div className="cc-x-axis mono">
              <span>{slice[0]?.date}</span>
              <span>{slice[Math.floor(slice.length / 2)]?.date}</span>
              <span>{slice[slice.length - 1]?.date}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Active Crowdfunding Packages Strip */}
      <div className="col-12 col-xl-5">
        <div className="cc-panel h-100">
          <div className="cc-panel__head">
            <div>
              <span className="eyebrow-label">Syndicate Books ({packages.length})</span>
              <h2 className="cc-panel__title">Active Crowdfunding Pools</h2>
            </div>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openOverlay({ type: "new-package-wizard" })}
            >
              <Icon name="plus" size={14} /> New Pool
            </button>
          </div>

          <div className="cc-pkg-stack">
            {packages.map((pkg) => {
              const fillPct = Math.round((pkg.filledSlots / Math.max(1, pkg.totalSlots)) * 100);
              return (
                <button
                  key={pkg.id}
                  type="button"
                  className="cc-pkg-row hover-lift"
                  onClick={() => inspectEntity({ kind: "package", code: pkg.code })}
                >
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <div className="d-flex align-items-center gap-2">
                      <span className="mono fw-semibold text-dark">{pkg.code}</span>
                      <span className="small text-secondary text-truncate">{pkg.name}</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className={cn(
                          "pill",
                          pkg.status === "trading" ? "pill-live" : "pill-violet",
                        )}
                      >
                        {pkg.status}
                      </span>
                      <span className="mono fw-semibold text-win">
                        {pkg.currentPnL > 0 ? `+${formatCurrency(pkg.currentPnL, "USD", 0)}` : "Open Book"}
                      </span>
                    </div>
                  </div>
                  <div className="cc-pkg-bar">
                    <span style={{ width: `${fillPct}%` }} />
                  </div>
                  <div className="d-flex justify-content-between w-100 mono small text-muted">
                    <span>
                      {pkg.filledSlots}/{pkg.totalSlots} slots ({formatCurrency(pkg.totalCapital, "USD", 0)})
                    </span>
                    <span>
                      Weight {pkg.capitalSharePercent}% · DD {pkg.maxDrawdownHit}%/{pkg.maxDrawdown}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
