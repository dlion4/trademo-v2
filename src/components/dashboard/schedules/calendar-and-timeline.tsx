"use client";

import { useState } from "react";

import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { usePatchScheduleSequence } from "@/lib/queries/use-schedules";
import { timeToMinutes } from "@/lib/schedules/schemas";
import type {
  ScheduleSequenceDTO,
  TradeSchedulerBundleDTO,
} from "@/lib/schedules/types";

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1 · MONTH CALENDAR VIEW (7×6) + SELECTED DAY SIDE AGENDA PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
export function ScheduleCalendarSection({
  bundle,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onJumpToday,
}: {
  bundle: TradeSchedulerBundleDTO;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToday: () => void;
}) {
  const { openSchedulerModal, inspectEntity, markFlashedSchedule, pushToast } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();
  const [poolScope, setPoolScope] = useState<"ALL" | "PKG-01" | "PKG-02" | "PKG-03">("ALL");

  const activeDay =
    bundle.calendarDays.find((d) => d.date === selectedDate) ??
    bundle.calendarDays.find((d) => d.isToday) ??
    bundle.calendarDays[0];

  const daySequences: ScheduleSequenceDTO[] = bundle.sequences.filter((seq) => {
    if (!activeDay?.scheduleIds.includes(seq.id)) return false;
    if (poolScope !== "ALL" && !seq.packageCodes.includes(poolScope)) return false;
    return true;
  });

  return (
    <section className="row g-3 sch-section" aria-label="Schedule calendar and daily agenda">
      {/* Left 8 cols: 7×6 Month Grid */}
      <div className="col-12 col-xl-8">
        <div className="sch-panel h-100 d-flex flex-column">
          <div className="sch-panel__head">
            <div>
              <span className="eyebrow-label">Section 1 · Interactive 7×6 Execution Calendar</span>
              <h2 className="sch-panel__title">{bundle.calendarMonthLabel}</h2>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="sch-seg">
                {(["ALL", "PKG-01", "PKG-02", "PKG-03"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={cn("sch-seg__btn mono", poolScope === code && "is-active")}
                    onClick={() => setPoolScope(code)}
                  >
                    {code === "ALL" ? "All Pools" : code}
                  </button>
                ))}
              </div>

              <div className="d-flex align-items-center gap-1">
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm"
                  onClick={onPrevMonth}
                  aria-label="Previous month"
                >
                  <Icon name="arrowLeft" size={14} /> Prev
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm mono"
                  onClick={onJumpToday}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm"
                  onClick={onNextMonth}
                  aria-label="Next month"
                >
                  Next <Icon name="arrowRight" size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="sch-cal-weekdays">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat · 24/7 Syn", "Sun · 24/7 Syn"].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="sch-cal-grid flex-grow-1">
            {bundle.calendarDays.map((day, idx) => {
              const filteredCount =
                poolScope === "ALL"
                  ? day.totalRuns
                  : day.scheduleIds.filter((id) => {
                      const s = bundle.sequences.find((item) => item.id === id);
                      return s?.packageCodes.includes(poolScope);
                    }).length;

              return (
                <button
                  key={day.date}
                  type="button"
                  style={{ animationDelay: `${Math.min(idx, 11) * 40}ms` }}
                  className={cn(
                    "sch-cal-cell",
                    !day.inCurrentMonth && "is-outside",
                    day.isWeekend && "is-weekend",
                    day.isToday && "is-today",
                    day.date === activeDay?.date && "is-selected",
                  )}
                  onClick={() => onSelectDate(day.date)}
                  onDoubleClick={() =>
                    openSchedulerModal({
                      type: "master-schedule-wizard",
                      defaultDate: day.date,
                    })
                  }
                >
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <span className="sch-cal-daynum mono">{day.dayOfMonth}</span>
                    {day.isToday ? (
                      <span className="mono" style={{ fontSize: "0.64rem", fontWeight: 700 }}>
                        TODAY
                      </span>
                    ) : day.isWeekend ? (
                      <span className="mono text-muted" style={{ fontSize: "0.62rem" }}>
                        SYN
                      </span>
                    ) : null}
                  </div>

                  {filteredCount > 0 ? (
                    <div className="sch-cal-count mono">
                      <span
                        className={cn("sch-cal-dot", day.conflictCount > 0 && "is-conflict")}
                      />
                      <span>{filteredCount} runs</span>
                    </div>
                  ) : (
                    <span className="mono text-muted" style={{ fontSize: "0.68rem" }}>
                      No runs
                    </span>
                  )}

                  <div className="sch-cal-sub mono">
                    <span>
                      {day.committedStakeUsd > 0
                        ? formatCurrency(day.committedStakeUsd, "USD", 0)
                        : "—"}
                    </span>
                    {day.realizedPnL !== 0 ? (
                      <span className={day.realizedPnL > 0 ? "text-win" : "text-loss"}>
                        {day.realizedPnL > 0 ? "+" : ""}${day.realizedPnL}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="sch-panel__foot">
            <span className="small text-secondary">
              Click any date to inspect runs on the right · Double-click date to schedule on that day
            </span>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() =>
                openSchedulerModal({
                  type: "batch-clone-day-wizard",
                  sourceDate: activeDay?.date,
                })
              }
            >
              <Icon name="copy" size={14} /> Clone Selected Day Lineup
            </button>
          </div>
        </div>
      </div>

      {/* Right 4 cols: Selected Day Expanded Side Panel */}
      <div className="col-12 col-xl-4">
        <div className="sch-panel sch-day-panel">
          <div className="sch-panel__head">
            <div>
              <span className="eyebrow-label">
                Selected Day Agenda · {activeDay?.weekdayShort} {activeDay?.date}
              </span>
              <h2 className="sch-panel__title">
                {daySequences.length} Scheduled Windows ({activeDay?.regimeLabel})
              </h2>
            </div>
            <div className="d-flex gap-1">
              <button
                type="button"
                className="btn-ghost btn-ghost--sm"
                title="Open in Right Drawer"
                onClick={() =>
                  activeDay && inspectEntity({ kind: "calendar-day", date: activeDay.date })
                }
              >
                <Icon name="panelRight" size={14} />
              </button>
              <button
                type="button"
                className="btn-brand py-1 px-2 small"
                onClick={() =>
                  openSchedulerModal({
                    type: "master-schedule-wizard",
                    defaultDate: activeDay?.date,
                  })
                }
              >
                <Icon name="plus" size={14} /> Add Slot
              </button>
            </div>
          </div>

          <div className="flex-grow-1" style={{ maxHeight: 440, overflowY: "auto" }}>
            {daySequences.length === 0 ? (
              <div className="p-4 text-center text-secondary small">
                No scheduled sequences assigned for this filter on {activeDay?.date}.
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn-brand"
                    onClick={() =>
                      openSchedulerModal({
                        type: "master-schedule-wizard",
                        defaultDate: activeDay?.date,
                      })
                    }
                  >
                    + Schedule Trade Window
                  </button>
                </div>
              </div>
            ) : (
              daySequences.map((seq) => (
                <div
                  key={seq.id}
                  className="sch-day-slot"
                  onClick={() => inspectEntity({ kind: "schedule-sequence", id: seq.id })}
                >
                  <div className="min-w-0">
                    <div className="d-flex align-items-center gap-2">
                      <strong className="mono small">
                        {seq.startTime}–{seq.endTime}
                      </strong>
                      <span className="desk-code-tag mono">{seq.symbol}</span>
                      <span
                        className={cn(
                          "sch-status-pill",
                          seq.status === "running" && "is-running",
                          seq.status === "completed" && "is-completed",
                          seq.status === "paused" && "is-paused",
                        )}
                      >
                        {seq.status}
                      </span>
                    </div>
                    <div className="small fw-semibold text-truncate mt-1">{seq.name}</div>
                    <div className="mono small text-muted">
                      {seq.strategy} · ${seq.initialStake} × {seq.maxTrades} ·{" "}
                      {seq.packageCodes.join(", ")}
                    </div>
                  </div>

                  <div
                    className="d-flex flex-column gap-1 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="sch-row-btn"
                      disabled={patchSeq.isPending}
                      onClick={async () => {
                        await patchSeq.mutateAsync({ id: seq.id, action: "run_now" });
                        markFlashedSchedule(seq.id);
                        pushToast({
                          tone: "success",
                          title: `Triggered ${seq.name}`,
                        });
                      }}
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      className="sch-row-btn"
                      onClick={() =>
                        openSchedulerModal({ type: "edit-schedule", scheduleId: seq.id })
                      }
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sch-panel__foot mono small">
            <span>
              Daily Notional:{" "}
              <strong>{formatCurrency(activeDay?.committedStakeUsd ?? 0, "USD", 0)}</strong>
            </span>
            <span>
              Conflicts:{" "}
              <strong className={(activeDay?.conflictCount ?? 0) > 0 ? "text-loss" : "text-win"}>
                {activeDay?.conflictCount ?? 0}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2 · TODAY'S HORIZONTAL SCHEDULE TIMELINE (06:00 → 22:00 UTC)
   ═══════════════════════════════════════════════════════════════════════════ */
const TIMELINE_START_MIN = 6 * 60; // 06:00 UTC
const TIMELINE_SPAN_MIN = 16 * 60; // 16 hours -> 22:00 UTC
const HOURS = Array.from({ length: 16 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`);

export function TodayTimelineSection({ bundle }: { bundle: TradeSchedulerBundleDTO }) {
  const { openSchedulerModal, inspectEntity } = useOperatorUI();
  const [laneMode, setLaneMode] = useState<"pools" | "unified">("pools");

  const nowMinutes = timeToMinutes(bundle.kpis.currentUtcTime);
  const nowPct = Math.max(
    0,
    Math.min(100, ((nowMinutes - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100),
  );

  const todayBlocks = bundle.sequences.filter((seq) => {
    const s = timeToMinutes(seq.startTime);
    return s >= TIMELINE_START_MIN && s < TIMELINE_START_MIN + TIMELINE_SPAN_MIN;
  });

  const lanes =
    laneMode === "pools"
      ? [
          {
            key: "PKG-01",
            label: "PKG-01 (40%)",
            items: todayBlocks.filter((b) => b.packageCodes.includes("PKG-01")),
          },
          {
            key: "PKG-02",
            label: "PKG-02 (35%)",
            items: todayBlocks.filter((b) => b.packageCodes.includes("PKG-02")),
          },
          {
            key: "PKG-03",
            label: "PKG-03 (25%)",
            items: todayBlocks.filter((b) => b.packageCodes.includes("PKG-03")),
          },
        ]
      : [{ key: "ALL", label: "All Active Pools", items: todayBlocks }];

  return (
    <section className="sch-section" aria-label="Today's execution timeline">
      <div className="sch-panel">
        <div className="sch-panel__head">
          <div>
            <span className="eyebrow-label">
              Section 2 · Intraday UTC Execution Track (06:00 → 22:00 UTC)
            </span>
            <h2 className="sch-panel__title">Today&apos;s Scheduled Execution Timeline</h2>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="pill mono">
              <span className="live-dot me-1" /> Desk Clock {bundle.kpis.currentUtcTime} UTC
            </span>
            <div className="sch-seg">
              <button
                type="button"
                className={cn("sch-seg__btn", laneMode === "pools" && "is-active")}
                onClick={() => setLaneMode("pools")}
              >
                By Pool Lane
              </button>
              <button
                type="button"
                className={cn("sch-seg__btn", laneMode === "unified" && "is-active")}
                onClick={() => setLaneMode("unified")}
              >
                Unified Track
              </button>
            </div>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "skip-blackout-guard" })}
            >
              Blackout Guards ({bundle.blackouts.filter((b) => b.active).length})
            </button>
          </div>
        </div>

        {/* Desktop lg+ Horizontal Track */}
        <div className="d-none d-lg-block">
          <div style={{ paddingLeft: 108, paddingRight: 12 }} className="bg-light border-bottom">
            <div className="sch-timeline-ruler bg-transparent border-0">
              {HOURS.map((h) => (
                <span key={h} className="sch-timeline-hour mono">
                  {h}
                </span>
              ))}
            </div>
          </div>

          <div className="px-3 py-3">
            {lanes.map((lane) => (
              <div key={lane.key} className="sch-lane-row">
                <div className="sch-lane-label mono">{lane.label}</div>
                <div className="sch-lane-track sch-timeline-canvas">
                  <div className="sch-now-marker" style={{ left: `${nowPct}%` }} />
                  {lane.key === lanes[0].key ? (
                    <span className="sch-now-tag mono" style={{ left: `${nowPct}%` }}>
                      ● {bundle.kpis.currentUtcTime} UTC
                    </span>
                  ) : null}

                  {lane.items.map((block, idx) => {
                    const start = timeToMinutes(block.startTime);
                    const end = timeToMinutes(block.endTime);
                    const leftPct = Math.max(
                      0,
                      Math.min(92, ((start - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100),
                    );
                    const widthPct = Math.max(
                      8.5,
                      Math.min(100 - leftPct, ((end - start) / TIMELINE_SPAN_MIN) * 100),
                    );
                    const fillPct = Math.round(
                      (block.completedTrades / Math.max(1, block.maxTrades)) * 100,
                    );

                    return (
                      <button
                        key={`${lane.key}_${block.id}`}
                        type="button"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          animationDelay: `${idx * 45}ms`,
                        }}
                        className={cn(
                          "sch-tl-block",
                          block.status === "completed" && "is-completed",
                          block.status === "running" && "is-running",
                          block.status === "paused" && "is-paused",
                        )}
                        onClick={() =>
                          openSchedulerModal({
                            type: "timeline-block-detail",
                            scheduleId: block.id,
                          })
                        }
                        title={`${block.name} · Click to inspect telemetry`}
                      >
                        <div className="d-flex justify-content-between align-items-center gap-1 w-100">
                          <strong className="mono" style={{ fontSize: "0.7rem" }}>
                            {block.symbol} · ${block.initialStake}
                          </strong>
                          <span className="mono text-secondary" style={{ fontSize: "0.64rem" }}>
                            {block.status === "completed"
                              ? "✓ done"
                              : block.status === "running"
                                ? `${block.completedTrades}/${block.maxTrades}`
                                : block.startTime}
                          </span>
                        </div>
                        <div
                          className="text-truncate text-secondary"
                          style={{ fontSize: "0.66rem" }}
                        >
                          {block.strategy} ({block.maxTrades}t)
                        </div>
                        {block.status === "running" || block.status === "completed" ? (
                          <div className="sch-tl-progress">
                            <span style={{ width: `${fillPct}%` }} />
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tablet/Mobile < lg Chronological Stack */}
        <div className="d-lg-none p-3 d-flex flex-column gap-2">
          {todayBlocks.map((block) => (
            <div
              key={block.id}
              className="p-2 px-3 rounded border d-flex justify-content-between align-items-center"
              onClick={() =>
                openSchedulerModal({ type: "timeline-block-detail", scheduleId: block.id })
              }
            >
              <div>
                <div className="mono small fw-semibold">
                  {block.startTime}–{block.endTime} UTC · {block.symbol} ({block.strategy})
                </div>
                <div className="small text-secondary">
                  ${block.initialStake} × {block.maxTrades} trades · {block.packageCodes.join(", ")}
                </div>
              </div>
              <button
                type="button"
                className="sch-row-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  inspectEntity({ kind: "schedule-sequence", id: block.id });
                }}
              >
                {block.status}
              </button>
            </div>
          ))}
        </div>

        <div className="sch-panel__foot mono small">
          <span>
            Click any block on the track to open live contract fill telemetry, TP/SL progress, or
            trigger immediate execution.
          </span>
          <span>
            {bundle.kpis.completedToday} completed · {bundle.kpis.runningNow} running ·{" "}
            {Math.max(0, bundle.kpis.scheduledToday - bundle.kpis.completedToday - bundle.kpis.runningNow)}{" "}
            upcoming
          </span>
        </div>
      </div>
    </section>
  );
}
