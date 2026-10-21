"use client";

import Link from "next/link";
import { useState } from "react";

import {
  ScheduleCalendarSection,
  TodayTimelineSection,
} from "@/components/dashboard/schedules/calendar-and-timeline";
import {
  InlineNewScheduleComposer,
  PackageTradeMappingSection,
  ScheduleConflictsPanel,
  SchedulePerformanceHistorySection,
  ScheduledTradesTableSection,
} from "@/components/dashboard/schedules/composer-and-tables";
import { SchedulerModalHost } from "@/components/dashboard/schedules/scheduler-modals";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import {
  OperatorShell,
  formatDurationSeconds,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { DerivSymbol, StrategyName } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";
import { useCountUp } from "@/lib/hooks/use-motion";
import { useSchedulerBundle } from "@/lib/queries/use-schedules";
import type { TradeSchedulerBundleDTO } from "@/lib/schedules/types";

function SchedulerKpiCard({
  label,
  rawValue,
  format,
  prefix = "",
  suffix = "",
  delta,
  deltaPositive = true,
  subMeta,
  icon,
  onClick,
}: {
  label: string;
  rawValue: number;
  format: "currency" | "integer";
  prefix?: string;
  suffix?: string;
  delta: string;
  deltaPositive?: boolean;
  subMeta: string;
  icon: IconName;
  onClick: () => void;
}) {
  const animated = useCountUp(rawValue, { duration: 1100 });
  const formatted =
    format === "currency"
      ? `${prefix}${formatCurrency(Math.round(animated), "USD", 0)}${suffix}`
      : `${prefix}${Math.round(animated).toLocaleString("en-US")}${suffix}`;

  return (
    <button type="button" className="sch-kpi hover-lift" onClick={onClick}>
      <div className="sch-kpi__top">
        <span className="sch-kpi__label">{label}</span>
        <span className="sch-kpi__icon">
          <Icon name={icon} size={15} />
        </span>
      </div>
      <div className="sch-kpi__value mono">{formatted}</div>
      <div className="sch-kpi__foot">
        <span className={cn("mono fw-semibold", deltaPositive ? "text-win" : "text-warning-ink")}>
          {delta}
        </span>
        <span className="sch-kpi__meta">{subMeta}</span>
      </div>
    </button>
  );
}

function SchedulesBody({
  live,
  initialScheduler,
}: {
  live: OperatorBundleProps & { nextCountdownSeconds: number };
  initialScheduler: TradeSchedulerBundleDTO;
}) {
  const {
    openOverlay,
    schedulerModal,
    openSchedulerModal,
    closeSchedulerModal,
    openDrawerTab,
  } = useOperatorUI();

  const [calYear, setCalYear] = useState(initialScheduler.calendarYear);
  const [calMonth, setCalMonth] = useState(initialScheduler.calendarMonthIndex);
  const [selectedDate, setSelectedDate] = useState(initialScheduler.kpis.anchorDate);
  const [presetOverride, setPresetOverride] = useState<{
    strategy: StrategyName;
    symbol: DerivSymbol;
    nonce: number;
  } | null>(null);

  const isDefaultMonth =
    calYear === initialScheduler.calendarYear && calMonth === initialScheduler.calendarMonthIndex;
  const bundleQ = useSchedulerBundle(
    calYear,
    calMonth,
    isDefaultMonth ? initialScheduler : undefined,
  );
  const bundle = bundleQ.data ?? initialScheduler;

  const countdownLabel = formatDurationSeconds(live.nextCountdownSeconds);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    setCalYear(2026);
    setCalMonth(9);
    setSelectedDate(initialScheduler.kpis.anchorDate);
  };

  const workflowLaunchers: Array<{
    code: string;
    title: string;
    desc: string;
    icon: IconName;
    trigger: () => void;
  }> = [
    {
      code: "WIZ-01",
      title: "4-Step Sequence Builder",
      desc: "Guided UTC window, live Deriv quote, ladder & pool split wizard",
      icon: "calendar",
      trigger: () => openSchedulerModal({ type: "master-schedule-wizard" }),
    },
    {
      code: "WIZ-02",
      title: "3-Step Cron Studio",
      desc: "Build 5-field UTC cron expressions with next-5-runs preview",
      icon: "clock",
      trigger: () => openSchedulerModal({ type: "cron-recurrence-wizard" }),
    },
    {
      code: "WIZ-03",
      title: "30-Day Stress Simulator",
      desc: "Test stake progression against adverse tick streaks & pool HWM",
      icon: "gauge",
      trigger: () => openSchedulerModal({ type: "backtest-stress-wizard" }),
    },
    {
      code: "WIZ-04",
      title: "Multi-Day Lineup Cloner",
      desc: "Replicate daily schedule lineups with weekend FX filtering",
      icon: "copy",
      trigger: () =>
        openSchedulerModal({ type: "batch-clone-day-wizard", sourceDate: selectedDate }),
    },
    {
      code: "WIZ-05",
      title: "Conflict Resolver Wizard",
      desc: "Auto-stagger window overlaps & fix weekend FX schedule rules",
      icon: "alert",
      trigger: () => openSchedulerModal({ type: "conflict-resolver-wizard" }),
    },
    {
      code: "WIZ-06",
      title: "Pool Pro-Rata Split Wizard",
      desc: "Sync PKG-01..PKG-04 stake weights to verified investor deposits",
      icon: "split",
      trigger: () => openSchedulerModal({ type: "pool-prorata-wizard" }),
    },
    {
      code: "MOD-07",
      title: "Live Window Telemetry",
      desc: "Inspect active contract fill bar (4/6) & immediate run controls",
      icon: "activity",
      trigger: () =>
        openSchedulerModal({
          type: "timeline-block-detail",
          scheduleId: bundle.sequences[3]?.id ?? bundle.sequences[0].id,
        }),
    },
    {
      code: "MOD-10",
      title: "Macro Blackout Guard",
      desc: "Configure NFP, CPI, FOMC & interbank rollover skip rules",
      icon: "shield",
      trigger: () => openSchedulerModal({ type: "skip-blackout-guard" }),
    },
    {
      code: "MOD-12",
      title: "7-Strategy Preset Library",
      desc: "Compare Martingale, DCA, Oscar's Grind & Fibonacci ladders",
      icon: "script",
      trigger: () => openSchedulerModal({ type: "strategy-library" }),
    },
    {
      code: "MOD-14",
      title: "Cooldown & SL/TP Policy",
      desc: "Configure consecutive-loss lockout timers & hard daily halts",
      icon: "sliders",
      trigger: () => openSchedulerModal({ type: "guardrail-cooldown-policy" }),
    },
    {
      code: "MOD-15",
      title: "REST Payload Inspector",
      desc: "Copy structured POST /api/schedules DTO JSON for Express/BullMQ",
      icon: "code",
      trigger: () => openSchedulerModal({ type: "api-payload-inspector" }),
    },
    {
      code: "DESK-01",
      title: "Instant Order Ticket",
      desc: "Place immediate CALL/PUT or Digit contract outside schedule queue",
      icon: "bolt",
      trigger: () => openOverlay({ type: "quick-trade" }),
    },
  ];

  return (
    <div className="container-fluid px-0 sch-canvas">
      {/* ── Desk Header Strip ── */}
      <div className="sch-header">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="desk-code-tag mono">D-2</span>
            <span className="eyebrow-label">
              Operator Execution Desk · Next Sequence in {countdownLabel}
            </span>
          </div>
          <h1 className="sch-title">Trade Scheduler &amp; Pool Execution Windows</h1>
          <p className="sch-subtitle mb-0">
            Schedule automated Deriv contract sequences across crowdfunding packages with calendar
            cadence, UTC timelines, pro-rata pool splits, and pre-flight conflict checks.
          </p>
        </div>

        <div className="sch-header__actions">
          <Link href="/dashboard" className="btn-ghost btn-ghost--sm">
            ← Command Center (D-1)
          </Link>
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => openDrawerTab("feed")}
          >
            <Icon name="panelRight" size={15} /> Right Drawer
          </button>
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => openSchedulerModal({ type: "cron-recurrence-wizard" })}
          >
            <Icon name="clock" size={15} /> Cron Studio
          </button>
          <button
            type="button"
            className="btn-brand"
            onClick={() => openSchedulerModal({ type: "master-schedule-wizard" })}
          >
            <Icon name="plus" size={15} /> New Schedule Wizard
          </button>
        </div>
      </div>

      {/* ── 6 Count-Up Scheduler KPI Cards ── */}
      <section
        className="row g-3 row-cols-1 row-cols-sm-2 row-cols-xl-3 row-cols-xxl-6 sch-section"
        aria-label="Trade scheduler KPIs"
      >
        <div className="col">
          <SchedulerKpiCard
            label="Scheduled Today"
            rawValue={bundle.kpis.scheduledToday}
            format="integer"
            delta={`Next ${countdownLabel}`}
            subMeta={`${bundle.kpis.completedToday} done · ${bundle.kpis.runningNow} live →`}
            icon="calendar"
            onClick={() => openSchedulerModal({ type: "master-schedule-wizard" })}
          />
        </div>
        <div className="col">
          <SchedulerKpiCard
            label="Active Sequences"
            rawValue={bundle.kpis.activeSequencesTotal}
            format="integer"
            delta={`${bundle.kpis.pausedSequencesTotal} paused`}
            subMeta="Cron Studio →"
            icon="clock"
            onClick={() => openSchedulerModal({ type: "cron-recurrence-wizard" })}
          />
        </div>
        <div className="col">
          <SchedulerKpiCard
            label="Committed Stake"
            rawValue={bundle.kpis.dailyCommittedStake}
            format="currency"
            delta={`${bundle.kpis.dailyMaxTrades} max contracts`}
            subMeta="Batch Ops →"
            icon="layers"
            onClick={() => openSchedulerModal({ type: "bulk-schedule-ops", selectedIds: [] })}
          />
        </div>
        <div className="col">
          <SchedulerKpiCard
            label="30-Day Net P&L"
            rawValue={bundle.kpis.thirtyDayNetPnL}
            format="currency"
            prefix="+"
            delta={`▲ ${bundle.kpis.thirtyDayWinRate}% win`}
            subMeta="Stress Sim →"
            icon="trendUp"
            onClick={() => openSchedulerModal({ type: "backtest-stress-wizard" })}
          />
        </div>
        <div className="col">
          <SchedulerKpiCard
            label="Pool Capital Mapped"
            rawValue={bundle.kpis.pooledCapitalCovered}
            format="currency"
            delta={`${bundle.kpis.activePoolsCount} active pools`}
            subMeta="Split Wizard →"
            icon="vault"
            onClick={() => openSchedulerModal({ type: "pool-prorata-wizard" })}
          />
        </div>
        <div className="col">
          <SchedulerKpiCard
            label="Pre-Flight Checks"
            rawValue={bundle.kpis.openConflictsCount}
            format="integer"
            suffix={bundle.kpis.openConflictsCount === 1 ? " alert" : " alerts"}
            delta={bundle.kpis.openConflictsCount === 0 ? "All clear" : "Review windows"}
            deltaPositive={bundle.kpis.openConflictsCount === 0}
            subMeta="Resolve →"
            icon="shield"
            onClick={() => openSchedulerModal({ type: "conflict-resolver-wizard" })}
          />
        </div>
      </section>

      {/* ── Section 7: Pre-Flight Conflicts & Warnings (Actionable Banner) ── */}
      <ScheduleConflictsPanel bundle={bundle} />

      {/* ── Section 1: 7×6 Month Calendar + Selected Day Agenda Side Panel ── */}
      <ScheduleCalendarSection
        bundle={bundle}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onJumpToday={handleJumpToday}
      />

      {/* ── Section 2: Today's Horizontal UTC Timeline (06:00 → 22:00) ── */}
      <TodayTimelineSection bundle={bundle} />

      {/* ── Section 3: Scheduled Trade List (TanStack Table + Bulk Ops) ── */}
      <ScheduledTradesTableSection bundle={bundle} selectedCalendarDate={selectedDate} />

      {/* ── Section 4: Inline New Schedule Composer (TanStack Form + Zod) ── */}
      <InlineNewScheduleComposer
        bundle={bundle}
        funds={live.funds}
        workspace={live.workspace}
        presetOverride={presetOverride}
      />

      {/* ── Section 5: Package-Trade Capital Mapping (TanStack Table) ── */}
      <PackageTradeMappingSection bundle={bundle} />

      {/* ── Section 6: 30-Day Schedule Performance History (TanStack Table) ── */}
      <SchedulePerformanceHistorySection bundle={bundle} />

      {/* ── Interactive Scheduler Workflows, Modals & Multi-Step Wizards Directory ── */}
      <section className="sch-section mb-4" aria-label="Scheduler modals and multi-step wizards">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <span className="eyebrow-label">
            Scheduler Interactive Wizards, Pre-Flight Tools &amp; Cross-Desk Links
          </span>
          <div className="d-flex flex-wrap gap-2">
            <Link href="/dashboard/live" className="small fw-semibold">
              Live Trading (D-3) →
            </Link>
            <span className="text-muted">·</span>
            <Link href="/dashboard/trades" className="small fw-semibold">
              Trade Log (D-4) →
            </Link>
            <span className="text-muted">·</span>
            <Link href="/dashboard/packages" className="small fw-semibold">
              Packages (D-5) →
            </Link>
            <span className="text-muted">·</span>
            <Link href="/dashboard/bots" className="small fw-semibold">
              Bot Runners (D-14) →
            </Link>
          </div>
        </div>

        <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4">
          {workflowLaunchers.map((item) => (
            <div className="col" key={item.code}>
              <button
                type="button"
                className="sch-action-tile hover-lift"
                onClick={item.trigger}
              >
                <div className="d-flex align-items-center justify-content-between w-100">
                  <span className="sch-action-tile__icon">
                    <Icon name={item.icon} size={16} />
                  </span>
                  <span className="desk-code-tag mono">{item.code}</span>
                </div>
                <strong className="sch-action-tile__title">{item.title}</strong>
                <span className="sch-action-tile__desc">{item.desc}</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Dedicated 16-Modal / Multi-Step Wizard Host for Page D-2 */}
      <SchedulerModalHost
        modal={schedulerModal}
        bundle={bundle}
        funds={live.funds}
        workspace={live.workspace}
        onSelectPreset={(strategy, symbol) =>
          setPresetOverride({ strategy, symbol, nonce: Date.now() })
        }
        onClose={closeSchedulerModal}
      />
    </div>
  );
}

export function SchedulesPage({
  operatorBundle,
  initialScheduler,
}: {
  operatorBundle: OperatorBundleProps;
  initialScheduler: TradeSchedulerBundleDTO;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-schedules" bundle={operatorBundle}>
      {(live) => <SchedulesBody live={live} initialScheduler={initialScheduler} />}
    </OperatorShell>
  );
}
