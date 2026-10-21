import {
  INITIAL_BLACKOUT_WINDOWS,
  INITIAL_SCHEDULE_HISTORY,
  INITIAL_SCHEDULER_SEQUENCES,
  STRATEGY_PRESET_PROFILES,
} from "@/lib/content/schedules-content";
import type { DerivSymbol, ScheduledTradeDTO } from "@/lib/dashboard/types";
import { minutesToTime, timeToMinutes } from "@/lib/schedules/schemas";
import type {
  BlackoutWindowDTO,
  BulkSchedulePayloadDTO,
  CalendarDaySummaryDTO,
  CreateSchedulePayloadDTO,
  PackageScheduleMappingDTO,
  PatchSchedulePayloadDTO,
  ScheduleConflictDTO,
  ScheduleHistoryRunDTO,
  ScheduleSequenceDTO,
  TradeSchedulerBundleDTO,
} from "@/lib/schedules/types";
import * as desk from "@/server/services/dashboard-mock-service";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * tradeMO · Stateful Trade Scheduler Backend Service (Page D-2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Maintains structured server-side schedule state across requests and mirrors
 * changes directly into `dashboard-mock-service` so KPIs, right drawers, and
 * Command Center (D-1) stay 100% consistent with Trade Scheduler (D-2).
 */

const ANCHOR_TODAY = "2026-10-19"; // Monday — matches D-1 desk snapshot
const DESK_UTC_TIME = "14:24";

const SYMBOL_META: Record<
  DerivSymbol,
  {
    label: string;
    market: ScheduleSequenceDTO["market"];
    defaultContract: ScheduleSequenceDTO["contractType"];
    contractLabel: string;
  }
> = {
  R_10: { label: "Volatility 10 Index", market: "Synthetics", defaultContract: "CALL", contractLabel: "Rise · 5t" },
  R_25: { label: "Volatility 25 Index", market: "Synthetics", defaultContract: "PUT", contractLabel: "Fall · 5t" },
  R_50: { label: "Volatility 50 Index", market: "Synthetics", defaultContract: "CALL", contractLabel: "Rise · 5t" },
  R_75: { label: "Volatility 75 Index", market: "Synthetics", defaultContract: "DIGITEVEN", contractLabel: "Even · 1t" },
  R_100: { label: "Volatility 100 Index", market: "Synthetics", defaultContract: "DIGITODD", contractLabel: "Odd · 1t" },
  "1HZ10V": { label: "Volatility 10 (1s)", market: "Synthetics", defaultContract: "DIGITOVER", contractLabel: "Over 3 · 1t" },
  frxEURUSD: { label: "EUR / USD", market: "Forex", defaultContract: "CALL", contractLabel: "Higher · 3m" },
  frxXAUUSD: { label: "Gold / USD", market: "Commodities", defaultContract: "CALL", contractLabel: "Higher · 5m" },
  cryBTCUSD: { label: "BTC / USD", market: "Crypto", defaultContract: "CALL", contractLabel: "Higher · 5m" },
};

interface SchedulerStore {
  sequences: ScheduleSequenceDTO[];
  historyRuns: ScheduleHistoryRunDTO[];
  blackouts: BlackoutWindowDTO[];
  acknowledgedConflictIds: string[];
  seqCounter: number;
}

const g = globalThis as unknown as { __trademoScheduler?: SchedulerStore };

function getStore(): SchedulerStore {
  if (!g.__trademoScheduler) {
    g.__trademoScheduler = {
      sequences: structuredClone(INITIAL_SCHEDULER_SEQUENCES),
      historyRuns: structuredClone(INITIAL_SCHEDULE_HISTORY),
      blackouts: structuredClone(INITIAL_BLACKOUT_WINDOWS),
      acknowledgedConflictIds: [],
      seqCounter: 113,
    };
  }
  return g.__trademoScheduler;
}

function isWeekendDate(yyyyMmDd: string): boolean {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`);
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

/** Does `seq` run on calendar day `dateStr`? */
export function appliesToDate(seq: ScheduleSequenceDTO, dateStr: string): boolean {
  if (seq.endDate && dateStr > seq.endDate) return false;
  if (seq.recurrence === "one_time") return seq.date === dateStr;
  if (dateStr < "2026-10-01") return false;
  const weekend = isWeekendDate(dateStr);
  if (seq.recurrence === "daily") return true;
  if (seq.recurrence === "weekdays") return !weekend;
  if (seq.recurrence === "weekends_synthetics") return weekend;
  // custom_cron
  const cron = seq.cronExpression ?? "";
  if (cron.includes("1-5")) return !weekend;
  if (cron.includes("0,6")) return weekend;
  return true;
}

/** Compute live pre-flight conflicts (Section 7 of tradeMO.md Page D-2). */
export function computeScheduleConflicts(): ScheduleConflictDTO[] {
  const store = getStore();
  const funds = desk.getFundsFlow();
  const workspace = desk.getWorkspace();
  const conflicts: ScheduleConflictDTO[] = [];

  const activeSeqs = store.sequences.filter((s) => s.status !== "skipped");

  // 1. Time window overlaps within the same crowdfunding pool on anchor day
  const todaySeqs = activeSeqs.filter((s) => appliesToDate(s, ANCHOR_TODAY));
  for (let i = 0; i < todaySeqs.length; i += 1) {
    for (let j = i + 1; j < todaySeqs.length; j += 1) {
      const a = todaySeqs[i];
      const b = todaySeqs[j];
      const sharedPools = a.packageCodes.filter((p) => b.packageCodes.includes(p));
      if (sharedPools.length === 0) continue;
      const aStart = timeToMinutes(a.startTime);
      const aEnd = timeToMinutes(a.endTime);
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      if (aStart < bEnd && bStart < aEnd) {
        const id = `cnf_overlap_${a.id}_${b.id}`;
        const shiftMin = Math.max(15, aEnd - bStart + 5);
        conflicts.push({
          id,
          severity: "critical",
          category: "window_overlap",
          scheduleId: b.id,
          scheduleCode: b.code,
          scheduleName: b.name,
          packageCode: sharedPools[0],
          windowLabel: `${b.startTime}–${b.endTime} UTC`,
          headline: `Window overlap on ${sharedPools.join(", ")}: ${b.name} (${b.startTime}–${b.endTime}) overlaps ${a.name} (${a.startTime}–${a.endTime})`,
          detail: `Concurrent execution stacks contract margin on ${sharedPools.join(", ")} inside the same UTC window.`,
          recommendedFixLabel: `Shift +${shiftMin}m to clear window`,
          recommendedAction: { kind: "shift_time", minutes: shiftMin },
          acknowledged: store.acknowledgedConflictIds.includes(id),
        });
      }
    }
  }

  // 2. Forex / Commodity symbols scheduled across weekend recurrences
  for (const seq of activeSeqs) {
    const isFxOrMetal = seq.market === "Forex" || seq.market === "Commodities";
    const runsOnWeekend =
      seq.recurrence === "daily" ||
      seq.recurrence === "weekends_synthetics" ||
      (seq.recurrence === "one_time" && isWeekendDate(seq.date));
    if (isFxOrMetal && runsOnWeekend) {
      const id = `cnf_wknd_${seq.id}`;
      conflicts.push({
        id,
        severity: "warning",
        category: "weekend_forex",
        scheduleId: seq.id,
        scheduleCode: seq.code,
        scheduleName: seq.name,
        packageCode: seq.packageCodes[0] ?? "PKG-01",
        windowLabel: `Sat/Sun · ${seq.startTime} UTC`,
        headline: `Weekend market closure: ${seq.symbol} (${seq.market}) uses '${seq.recurrence}' cadence`,
        detail: `Deriv ${seq.market} quotes close Friday 21:00 UTC → Sunday 22:00 UTC. Only 24/7 Volatility Synthetics execute on weekends.`,
        recommendedFixLabel: "Switch to Weekdays (Mon–Fri)",
        recommendedAction: { kind: "switch_weekdays" },
        acknowledged: store.acknowledgedConflictIds.includes(id),
      });
    }
  }

  // 3. Reserve liquidity / stake multiple check (< 5× max progression step or high stake)
  for (const seq of activeSeqs) {
    const worstStep =
      seq.strategy === "Martingale" ? seq.initialStake * 8 : seq.initialStake * 3;
    if (seq.initialStake >= 95 || worstStep * 5 > funds.availableCapital) {
      const id = `cnf_margin_${seq.id}`;
      const saferStake = Math.max(25, Math.round(seq.initialStake * 0.65));
      conflicts.push({
        id,
        severity: "advisory",
        category: "low_reserve_multiple",
        scheduleId: seq.id,
        scheduleCode: seq.code,
        scheduleName: seq.name,
        packageCode: seq.packageCodes[0] ?? "PKG-01",
        windowLabel: `${seq.startTime}–${seq.endTime} UTC`,
        headline: `Elevated single-contract sizing ($${seq.initialStake}) on ${seq.name}`,
        detail: `Unallocated cash reserve stands at $${funds.availableCapital.toLocaleString()} (desk daily loss cap $${workspace.risk.maxDailyLoss.toLocaleString()}). Scaling base stake improves 5× buffer headroom.`,
        recommendedFixLabel: `Trim Stake to $${saferStake}`,
        recommendedAction: { kind: "reduce_stake", stake: saferStake },
        acknowledged: store.acknowledgedConflictIds.includes(id),
      });
    }
  }

  return conflicts;
}

/** Build 7×6 (42-day) month grid for `year` and 0-based `monthIndex`. */
export function buildCalendarMonth(year = 2026, monthIndex = 9): {
  monthLabel: string;
  days: CalendarDaySummaryDTO[];
} {
  const store = getStore();
  const conflicts = computeScheduleConflicts().filter((c) => !c.acknowledged);
  const conflictScheduleIds = new Set(conflicts.map((c) => c.scheduleId));

  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const monthLabel = firstOfMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // Monday-first grid: UTC getUTCDay() is 0=Sun..6=Sat → offset = (dow + 6) % 7
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - startOffset));
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

  const days: CalendarDaySummaryDTO[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const inCurrentMonth = d.getUTCMonth() === monthIndex;
    const weekdayShort = weekdays[(d.getUTCDay() + 6) % 7];
    const isWeekend = weekdayShort === "Sat" || weekdayShort === "Sun";
    const isToday = dateStr === ANCHOR_TODAY;

    const matching = store.sequences.filter((seq) => appliesToDate(seq, dateStr));
    const isPastDay = dateStr < ANCHOR_TODAY;

    const completedRuns = isPastDay
      ? matching.filter((m) => m.status !== "paused" && m.status !== "skipped").length
      : isToday
        ? matching.filter((m) => m.status === "completed").length
        : 0;
    const runningRuns = isToday ? matching.filter((m) => m.status === "running").length : 0;
    const pausedRuns = matching.filter((m) => m.status === "paused").length;
    const queuedRuns = Math.max(0, matching.length - completedRuns - runningRuns - pausedRuns);

    const committedStakeUsd = matching.reduce(
      (sum, seq) => sum + seq.initialStake * seq.maxTrades,
      0,
    );

    const dayHistoryPnL = store.historyRuns
      .filter((r) => r.runDateLabel.startsWith(dateStr))
      .reduce((sum, r) => sum + r.netPnL, 0);

    const deterministicPastPnL =
      isPastDay && dayHistoryPnL === 0 && completedRuns > 0
        ? ((d.getUTCDate() * 37) % 190) + 45
        : dayHistoryPnL;

    days.push({
      date: dateStr,
      dayOfMonth: d.getUTCDate(),
      weekdayShort,
      inCurrentMonth,
      isToday,
      isWeekend,
      regimeLabel: isWeekend
        ? "24/7 Synthetics Only"
        : matching.length >= 6
          ? "Full Multi-Asset Desk"
          : "Light Session",
      totalRuns: matching.length,
      completedRuns,
      runningRuns,
      queuedRuns,
      pausedRuns,
      conflictCount: matching.filter((m) => conflictScheduleIds.has(m.id)).length,
      committedStakeUsd,
      realizedPnL: deterministicPastPnL,
      scheduleIds: matching.map((m) => m.id),
    });
  }

  return { monthLabel, days };
}

/** Build Section 5 Package-Trade Capital Mapping rows dynamically from live state. */
export function buildPackageScheduleMappings(): PackageScheduleMappingDTO[] {
  const store = getStore();
  const funds = desk.getFundsFlow();
  const dist = desk.getProfitDistribution();

  return funds.packages.map((pkg) => {
    const assigned = store.sequences.filter((s) => s.packageCodes.includes(pkg.code));
    const avgStake =
      assigned.length > 0
        ? Math.round(assigned.reduce((sum, s) => sum + s.initialStake, 0) / assigned.length)
        : 0;
    const dailyCommittedExposure = assigned.reduce((sum, s) => {
      const sharePct = (s.packageAllocation[pkg.code] ?? 0) / 100;
      return sum + Math.round(s.initialStake * s.maxTrades * sharePct);
    }, 0);
    const distRow = dist.breakdown.find((b) => b.packageCode === pkg.code);
    const historyPnL = store.historyRuns
      .filter((r) => r.packageCodes.includes(pkg.code))
      .reduce((sum, r) => sum + r.netPnL / r.packageCodes.length, 0);

    const uniqueSymbols = Array.from(new Set(assigned.map((s) => s.symbol)));

    return {
      packageId: pkg.id,
      packageCode: pkg.code,
      packageName: pkg.name,
      lifecycleStatus: pkg.status,
      investorsCount: distRow?.investorsCount ?? pkg.filledSlots,
      filledSlots: pkg.filledSlots,
      totalSlots: pkg.totalSlots,
      schedulesCount: assigned.length,
      totalCapital: pkg.totalCapital,
      capitalSharePercent: pkg.capitalSharePercent,
      avgStake,
      dailyCommittedExposure,
      maxDrawdownCap: pkg.maxDrawdown,
      currentDrawdownHit: pkg.maxDrawdownHit,
      scheduleRealizedPnL: Math.round(historyPnL * 100) / 100,
      assignedSymbols: uniqueSymbols.length > 0 ? uniqueSymbols : pkg.markets,
    };
  });
}

/** Assemble complete structured Page D-2 bundle (`GET /api/schedules?view=bundle`). */
export function getTradeSchedulerBundle(year = 2026, monthIndex = 9): TradeSchedulerBundleDTO {
  const store = getStore();
  const funds = desk.getFundsFlow();
  const { monthLabel, days } = buildCalendarMonth(year, monthIndex);
  const conflicts = computeScheduleConflicts();
  const packageMappings = buildPackageScheduleMappings();

  const todaySeqs = store.sequences.filter((s) => appliesToDate(s, ANCHOR_TODAY));
  const completedToday = todaySeqs.filter((s) => s.status === "completed").length;
  const runningNow = todaySeqs.filter((s) => s.status === "running").length;
  const activeSequencesTotal = store.sequences.filter(
    (s) => s.status === "queued" || s.status === "running",
  ).length;
  const pausedSequencesTotal = store.sequences.filter((s) => s.status === "paused").length;

  const dailyCommittedStake = todaySeqs.reduce(
    (sum, s) => sum + s.initialStake * s.maxTrades,
    0,
  );
  const dailyMaxTrades = todaySeqs.reduce((sum, s) => sum + s.maxTrades, 0);

  const thirtyDayNetPnL = store.historyRuns.reduce((sum, r) => sum + r.netPnL, 0);
  const totalHistWins = store.historyRuns.reduce((sum, r) => sum + r.winsCount, 0);
  const totalHistTrades = store.historyRuns.reduce((sum, r) => sum + r.tradesCount, 0);
  const thirtyDayWinRate =
    totalHistTrades > 0 ? Number(((totalHistWins / totalHistTrades) * 100).toFixed(1)) : 68.0;

  const unacknowledged = conflicts.filter((c) => !c.acknowledged);

  const sortedSequences = [...store.sequences].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );

  return {
    kpis: {
      scheduledToday: todaySeqs.length,
      completedToday,
      runningNow,
      activeSequencesTotal,
      pausedSequencesTotal,
      dailyCommittedStake,
      dailyMaxTrades,
      thirtyDayNetPnL: Math.round(thirtyDayNetPnL * 100) / 100,
      thirtyDayWinRate,
      thirtyDayRunsCount: store.historyRuns.length,
      pooledCapitalCovered: funds.totalCapital,
      activePoolsCount: funds.packages.filter((p) => p.status === "trading").length,
      openConflictsCount: unacknowledged.length,
      criticalConflictsCount: unacknowledged.filter((c) => c.severity === "critical").length,
      currentUtcTime: DESK_UTC_TIME,
      anchorDate: ANCHOR_TODAY,
    },
    calendarMonthLabel: monthLabel,
    calendarYear: year,
    calendarMonthIndex: monthIndex,
    calendarDays: days,
    sequences: sortedSequences,
    packageMappings,
    historyRuns: store.historyRuns,
    conflicts,
    blackouts: store.blackouts,
    strategyProfiles: STRATEGY_PRESET_PROFILES,
  };
}

/** Create a new scheduled trade sequence (`POST /api/schedules`). */
export function createScheduleSequence(input: CreateSchedulePayloadDTO): ScheduleSequenceDTO {
  const store = getStore();
  const meta = SYMBOL_META[input.symbol] ?? SYMBOL_META.R_10;
  const code = `SCH-${store.seqCounter++}`;

  // Also mirror into D-1 upcoming schedules state
  const d1Created: ScheduledTradeDTO = desk.createSchedule({
    name: input.name,
    executeAt: input.startTime,
    windowEnd: input.endTime,
    symbol: input.symbol,
    strategy: input.strategy,
    stake: input.initialStake,
    maxTrades: input.maxTrades,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    recurrence:
      input.recurrence === "daily" ||
      input.recurrence === "weekdays" ||
      input.recurrence === "one_time"
        ? input.recurrence
        : "weekdays",
    packageCodes: input.packageCodes,
    allocationSplit: input.packageAllocation,
  });

  const created: ScheduleSequenceDTO = {
    id: d1Created.id,
    code,
    name: input.name,
    date: input.date || ANCHOR_TODAY,
    endDate: input.endDate ?? null,
    startTime: input.startTime,
    endTime: input.endTime,
    symbol: input.symbol,
    symbolLabel: meta.label,
    market: meta.market,
    contractType: input.contractType ?? meta.defaultContract,
    contractLabel: meta.contractLabel,
    strategy: input.strategy,
    scriptRef: input.scriptRef ?? null,
    initialStake: Number(input.initialStake),
    maxTrades: Number(input.maxTrades),
    completedTrades: input.runImmediately ? Math.min(2, Number(input.maxTrades)) : 0,
    livePnL: input.runImmediately ? Number(input.initialStake) : 0,
    packageCodes: input.packageCodes,
    packageAllocation: input.packageAllocation,
    recurrence: input.recurrence,
    cronExpression: input.cronExpression ?? null,
    stopLoss: Number(input.stopLoss),
    takeProfit: Number(input.takeProfit),
    maxDrawdown: Number(input.maxDrawdown),
    cooldownLosses: Number(input.cooldownLosses),
    cooldownDurationSec: Number(input.cooldownDurationSec),
    status: input.runImmediately ? "running" : "queued",
    assignedBotCode: input.assignedBotCode ?? "BOT-01",
    nextRunAtIso: `${input.date || ANCHOR_TODAY}T${input.startTime}:00Z`,
    acknowledgedConflict: false,
    notes: input.notes ?? "",
  };

  store.sequences.unshift(created);

  if (input.runImmediately) {
    desk.toggleScheduleStatus(d1Created.id, "run_now");
  }

  return created;
}

/** Execute a run record + trade settlement on a schedule sequence. */
function executeSequenceNow(target: ScheduleSequenceDTO): ScheduleSequenceDTO {
  const store = getStore();
  target.status = "completed";
  target.completedTrades = target.maxTrades;
  const wins = Math.max(1, Math.round(target.maxTrades * 0.72));
  const losses = Math.max(0, target.maxTrades - wins);
  const realized = Number(((wins - losses) * target.initialStake * 0.92).toFixed(2));
  target.livePnL = realized;

  // Trigger trade settlement in shared Operator Desk service
  const settledTrade = desk.executeQuickTrade({
    symbol: target.symbol,
    contractType: target.contractType,
    strategy: target.strategy,
    stake: target.initialStake,
    duration: 5,
    durationUnit: "t",
    packageCode: target.packageCodes[0] ?? "PKG-01",
  });

  // Prepend to Section 6 History Runs
  const opCut = realized > 0 ? Number((realized * 0.2).toFixed(2)) : 0;
  store.historyRuns.unshift({
    id: `run_${Date.now().toString(36)}`,
    scheduleId: target.id,
    scheduleCode: target.code,
    scheduleName: target.name,
    lastRunIso: new Date().toISOString(),
    runDateLabel: `${ANCHOR_TODAY} · ${DESK_UTC_TIME} UTC`,
    symbol: target.symbol,
    strategy: target.strategy,
    packageCodes: [...target.packageCodes],
    tradesCount: target.maxTrades,
    maxTrades: target.maxTrades,
    winsCount: wins,
    lossesCount: losses,
    winRatePercent: Number(((wins / target.maxTrades) * 100).toFixed(1)),
    grossStake: target.initialStake * target.maxTrades,
    netPnL: realized,
    operatorFeeUsd: opCut,
    investorNetUsd: Number((realized - opCut).toFixed(2)),
    roiPercent: Number(((realized / Math.max(1, target.initialStake * target.maxTrades)) * 100).toFixed(1)),
    durationMinutes: Math.max(12, timeToMinutes(target.endTime) - timeToMinutes(target.startTime)),
    exitReason: "window_complete",
    contracts: [
      {
        contractId: settledTrade.derivContractId,
        seq: 1,
        executedAt: `${settledTrade.executedAt}:12`,
        symbol: settledTrade.symbol,
        contractLabel: settledTrade.contractLabel,
        stake: settledTrade.stake,
        entrySpot: settledTrade.entrySpot,
        exitSpot: settledTrade.exitSpot,
        profit: settledTrade.profit,
        isWin: settledTrade.isWin,
      },
    ],
  });

  return target;
}

/** Patch a schedule (`run_now`, `toggle`, `skip`, `duplicate`, `shift_window`, `update_fields`). */
export function patchScheduleSequence(payload: PatchSchedulePayloadDTO): ScheduleSequenceDTO {
  const store = getStore();
  const target = store.sequences.find((s) => s.id === payload.id);

  if (!target) {
    // Fallback if triggered from D-1 legacy ID
    desk.toggleScheduleStatus(payload.id, payload.action === "run_now" ? "run_now" : "toggle");
    return store.sequences[0];
  }

  switch (payload.action) {
    case "run_now": {
      desk.toggleScheduleStatus(target.id, "run_now");
      return executeSequenceNow(target);
    }
    case "toggle": {
      target.status = target.status === "paused" ? "queued" : "paused";
      desk.toggleScheduleStatus(target.id, "toggle");
      return target;
    }
    case "skip": {
      target.status = "skipped";
      target.notes = payload.skipReason
        ? `Skipped: ${payload.skipReason}`
        : "Window skipped by operator.";
      return target;
    }
    case "shift_window": {
      const delta = payload.shiftMinutes ?? 30;
      target.startTime = minutesToTime(timeToMinutes(target.startTime) + delta);
      target.endTime = minutesToTime(timeToMinutes(target.endTime) + delta);
      target.nextRunAtIso = `${target.date}T${target.startTime}:00Z`;
      return target;
    }
    case "duplicate": {
      const mult = payload.stakeMultiplier ?? 1;
      const newStart =
        payload.duplicateStartTime ?? minutesToTime(timeToMinutes(target.startTime) + 60);
      const dur = Math.max(30, timeToMinutes(target.endTime) - timeToMinutes(target.startTime));
      const newEnd = minutesToTime(timeToMinutes(newStart) + dur);
      return createScheduleSequence({
        name: `${target.name}-Copy`,
        date: payload.duplicateDate ?? target.date,
        endDate: target.endDate,
        startTime: newStart,
        endTime: newEnd,
        symbol: target.symbol,
        contractType: target.contractType,
        strategy: target.strategy,
        scriptRef: target.scriptRef,
        initialStake: Math.max(1, Math.round(target.initialStake * mult)),
        maxTrades: target.maxTrades,
        packageCodes: [...target.packageCodes],
        packageAllocation: { ...target.packageAllocation },
        recurrence: target.recurrence,
        cronExpression: target.cronExpression,
        stopLoss: target.stopLoss,
        takeProfit: target.takeProfit,
        maxDrawdown: target.maxDrawdown,
        cooldownLosses: target.cooldownLosses,
        cooldownDurationSec: target.cooldownDurationSec,
        assignedBotCode: target.assignedBotCode,
        notes: `Cloned from ${target.code}`,
      });
    }
    case "update_fields": {
      const p = payload.patch ?? {};
      if (p.name !== undefined) target.name = p.name;
      if (p.date !== undefined) target.date = p.date;
      if (p.endDate !== undefined) target.endDate = p.endDate;
      if (p.startTime !== undefined) target.startTime = p.startTime;
      if (p.endTime !== undefined) target.endTime = p.endTime;
      if (p.symbol !== undefined) {
        target.symbol = p.symbol;
        const meta = SYMBOL_META[p.symbol];
        if (meta) {
          target.symbolLabel = meta.label;
          target.market = meta.market;
          target.contractLabel = meta.contractLabel;
        }
      }
      if (p.contractType !== undefined) target.contractType = p.contractType;
      if (p.strategy !== undefined) target.strategy = p.strategy;
      if (p.scriptRef !== undefined) target.scriptRef = p.scriptRef;
      if (p.initialStake !== undefined) target.initialStake = Number(p.initialStake);
      if (p.maxTrades !== undefined) target.maxTrades = Number(p.maxTrades);
      if (p.packageCodes !== undefined) target.packageCodes = p.packageCodes;
      if (p.packageAllocation !== undefined) target.packageAllocation = p.packageAllocation;
      if (p.recurrence !== undefined) target.recurrence = p.recurrence;
      if (p.cronExpression !== undefined) target.cronExpression = p.cronExpression;
      if (p.stopLoss !== undefined) target.stopLoss = Number(p.stopLoss);
      if (p.takeProfit !== undefined) target.takeProfit = Number(p.takeProfit);
      if (p.maxDrawdown !== undefined) target.maxDrawdown = Number(p.maxDrawdown);
      if (p.cooldownLosses !== undefined) target.cooldownLosses = Number(p.cooldownLosses);
      if (p.cooldownDurationSec !== undefined)
        target.cooldownDurationSec = Number(p.cooldownDurationSec);
      if (p.status !== undefined) target.status = p.status;
      if (p.notes !== undefined) target.notes = p.notes;
      target.nextRunAtIso = `${target.date}T${target.startTime}:00Z`;
      return target;
    }
  }
}

/** Bulk operations on selected schedule rows (Section 3 Bulk Actions). */
export function bulkUpdateSchedules(payload: BulkSchedulePayloadDTO): {
  updatedCount: number;
  sequences: ScheduleSequenceDTO[];
} {
  const store = getStore();
  let updatedCount = 0;

  for (const id of payload.ids) {
    const seq = store.sequences.find((s) => s.id === id);
    if (!seq) continue;
    updatedCount += 1;
    if (payload.action === "run_now") {
      executeSequenceNow(seq);
    } else if (payload.action === "pause") {
      seq.status = "paused";
    } else if (payload.action === "resume") {
      seq.status = "queued";
    } else if (payload.action === "skip") {
      seq.status = "skipped";
    } else if (payload.action === "shift_30m") {
      seq.startTime = minutesToTime(timeToMinutes(seq.startTime) + 30);
      seq.endTime = minutesToTime(timeToMinutes(seq.endTime) + 30);
    } else if (payload.action === "assign_pool" && payload.poolCode) {
      if (!seq.packageCodes.includes(payload.poolCode)) {
        seq.packageCodes.push(payload.poolCode);
      }
      const even = Math.round(100 / seq.packageCodes.length);
      const nextAlloc: Record<string, number> = {};
      seq.packageCodes.forEach((code, idx) => {
        nextAlloc[code] =
          idx === seq.packageCodes.length - 1
            ? 100 - even * (seq.packageCodes.length - 1)
            : even;
      });
      seq.packageAllocation = nextAlloc;
    }
  }

  return { updatedCount, sequences: store.sequences };
}

/** Delete a scheduled sequence (`DELETE /api/schedules?id=...`). */
export function deleteScheduleSequence(id: string): { deletedId: string } {
  const store = getStore();
  store.sequences = store.sequences.filter((s) => s.id !== id);
  return { deletedId: id };
}

/** Apply auto-fix or acknowledge a Section 7 Pre-Flight Conflict. */
export function resolveConflict(input: {
  conflictId: string;
  mode: "auto_fix" | "acknowledge";
}): { resolvedId: string; conflictsRemaining: number } {
  const store = getStore();
  const current = computeScheduleConflicts();
  const match = current.find((c) => c.id === input.conflictId);

  if (match && input.mode === "auto_fix") {
    const act = match.recommendedAction;
    if (act.kind === "shift_time") {
      patchScheduleSequence({
        id: match.scheduleId,
        action: "shift_window",
        shiftMinutes: act.minutes,
      });
    } else if (act.kind === "switch_weekdays") {
      patchScheduleSequence({
        id: match.scheduleId,
        action: "update_fields",
        patch: { recurrence: "weekdays", cronExpression: "0 19 * * 1-5" },
      });
    } else if (act.kind === "swap_synthetic") {
      patchScheduleSequence({
        id: match.scheduleId,
        action: "update_fields",
        patch: { symbol: act.symbol },
      });
    } else if (act.kind === "reduce_stake") {
      patchScheduleSequence({
        id: match.scheduleId,
        action: "update_fields",
        patch: { initialStake: act.stake },
      });
    }
  } else if (!store.acknowledgedConflictIds.includes(input.conflictId)) {
    store.acknowledgedConflictIds.push(input.conflictId);
  }

  const after = computeScheduleConflicts().filter((c) => !c.acknowledged);
  return { resolvedId: input.conflictId, conflictsRemaining: after.length };
}

/** Rebalance package capital splits across all multi-pool schedules + treasury. */
export function rebalanceScheduleAllocations(input: {
  split: Record<string, number>;
  capitalInTrades?: number;
}): PackageScheduleMappingDTO[] {
  const store = getStore();
  const funds = desk.getFundsFlow();
  desk.rebalanceCapital({
    capitalInTrades: input.capitalInTrades ?? funds.capitalInTrades,
    split: input.split,
  });

  for (const seq of store.sequences) {
    const activeCodes = seq.packageCodes.filter((c) => (input.split[c] ?? 0) > 0);
    if (activeCodes.length === 0) continue;
    const rawSum = activeCodes.reduce((sum, c) => sum + (input.split[c] ?? 0), 0);
    if (rawSum <= 0) continue;
    const nextAlloc: Record<string, number> = {};
    let running = 0;
    activeCodes.forEach((code, idx) => {
      if (idx === activeCodes.length - 1) {
        nextAlloc[code] = Math.max(0, 100 - running);
      } else {
        const share = Math.round(((input.split[code] ?? 0) / rawSum) * 100);
        nextAlloc[code] = share;
        running += share;
      }
    });
    seq.packageAllocation = nextAlloc;
  }

  return buildPackageScheduleMappings();
}

/** Add or toggle a macro blackout window. */
export function mutateBlackoutWindow(input: {
  action: "add" | "toggle" | "delete";
  id?: string;
  blackout?: Omit<BlackoutWindowDTO, "id">;
}): BlackoutWindowDTO[] {
  const store = getStore();
  if (input.action === "add" && input.blackout) {
    store.blackouts.unshift({
      ...input.blackout,
      id: `blk_${Date.now().toString(36)}`,
    });
  } else if (input.action === "toggle" && input.id) {
    const item = store.blackouts.find((b) => b.id === input.id);
    if (item) item.active = !item.active;
  } else if (input.action === "delete" && input.id) {
    store.blackouts = store.blackouts.filter((b) => b.id !== input.id);
  }
  return store.blackouts;
}

/** Clone a source day's sequences onto one or more target dates (Batch Cloner Wizard). */
export function cloneDayLineup(input: {
  sourceDate: string;
  targetDates: string[];
  syntheticsOnlyOnWeekend: boolean;
  stakeMultiplier: number;
}): { createdCount: number } {
  const store = getStore();
  const sourceSeqs = store.sequences.filter((s) => appliesToDate(s, input.sourceDate)).slice(0, 5);
  let createdCount = 0;

  for (const targetDate of input.targetDates) {
    const wknd = isWeekendDate(targetDate);
    for (const src of sourceSeqs) {
      if (wknd && input.syntheticsOnlyOnWeekend && src.market !== "Synthetics") {
        continue;
      }
      createScheduleSequence({
        name: `${src.name}-${targetDate.slice(5)}`,
        date: targetDate,
        endDate: null,
        startTime: src.startTime,
        endTime: src.endTime,
        symbol: src.symbol,
        contractType: src.contractType,
        strategy: src.strategy,
        scriptRef: src.scriptRef,
        initialStake: Math.max(1, Math.round(src.initialStake * input.stakeMultiplier)),
        maxTrades: src.maxTrades,
        packageCodes: [...src.packageCodes],
        packageAllocation: { ...src.packageAllocation },
        recurrence: "one_time",
        cronExpression: null,
        stopLoss: src.stopLoss,
        takeProfit: src.takeProfit,
        maxDrawdown: src.maxDrawdown,
        cooldownLosses: src.cooldownLosses,
        cooldownDurationSec: src.cooldownDurationSec,
        assignedBotCode: src.assignedBotCode,
        notes: `Batch cloned from ${input.sourceDate}`,
      });
      createdCount += 1;
    }
  }

  return { createdCount };
}
