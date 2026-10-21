import type {
  ContractTypeCode,
  DerivSymbol,
  StrategyName,
} from "@/lib/dashboard/types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * tradeMO · Page D-2 Trade Scheduler Data Contracts (`/dashboard/schedules`)
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps 1-to-1 to tradeMO.md §6 Page D-2 (Sections 1–7), §10, and §17.2.
 * All UI sections, 16 dedicated modals/wizards, and Right Drawer inspectors
 * consume strictly typed DTOs from `/api/schedules/*` so swapping to a live
 * Express + BullMQ + PostgreSQL backend requires zero component edits.
 */

export type ScheduleRecurrence =
  | "one_time"
  | "daily"
  | "weekdays"
  | "weekends_synthetics"
  | "custom_cron";

export type ScheduleLifecycleStatus =
  | "running"
  | "queued"
  | "paused"
  | "completed"
  | "skipped";

export type ConflictSeverity = "critical" | "warning" | "advisory";

export type ConflictCategory =
  | "window_overlap"
  | "weekend_forex"
  | "insufficient_pool_capital"
  | "low_reserve_multiple"
  | "cooldown_guardrail"
  | "macro_blackout";

/** Full Scheduled Sequence entity powering Calendar, Timeline, and TanStack Table. */
export interface ScheduleSequenceDTO {
  id: string;
  code: string; // e.g. SCH-101
  name: string; // e.g. "Martingale-R10-Morning"
  date: string; // YYYY-MM-DD primary anchor
  endDate: string | null; // optional end date for range schedules
  startTime: string; // HH:MM UTC ("09:00")
  endTime: string; // HH:MM UTC ("10:00")
  symbol: DerivSymbol;
  symbolLabel: string;
  market: "Synthetics" | "Forex" | "Commodities" | "Crypto";
  contractType: ContractTypeCode;
  contractLabel: string;
  strategy: StrategyName;
  scriptRef: string | null;
  initialStake: number;
  maxTrades: number;
  completedTrades: number;
  livePnL: number;
  packageCodes: string[]; // ["PKG-01", "PKG-02"]
  packageAllocation: Record<string, number>; // { "PKG-01": 40, "PKG-02": 35, "PKG-03": 25 }
  recurrence: ScheduleRecurrence;
  cronExpression: string | null;
  stopLoss: number;
  takeProfit: number;
  maxDrawdown: number;
  cooldownLosses: number;
  cooldownDurationSec: number;
  status: ScheduleLifecycleStatus;
  assignedBotCode: string;
  nextRunAtIso: string;
  acknowledgedConflict: boolean;
  notes?: string;
}

/** POST /api/schedules canonical request payload (matches tradeMO.md §6 D-2). */
export interface CreateSchedulePayloadDTO {
  name: string;
  date: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  symbol: DerivSymbol;
  contractType?: ContractTypeCode;
  strategy: StrategyName;
  scriptRef?: string | null;
  initialStake: number;
  maxTrades: number;
  packageCodes: string[];
  packageAllocation: Record<string, number>;
  recurrence: ScheduleRecurrence;
  cronExpression?: string | null;
  stopLoss: number;
  takeProfit: number;
  maxDrawdown: number;
  cooldownLosses: number;
  cooldownDurationSec: number;
  assignedBotCode?: string;
  runImmediately?: boolean;
  notes?: string;
}

export type SchedulePatchAction =
  | "run_now"
  | "toggle"
  | "skip"
  | "duplicate"
  | "shift_window"
  | "update_fields";

export interface PatchSchedulePayloadDTO {
  id: string;
  action: SchedulePatchAction;
  shiftMinutes?: number;
  skipReason?: string;
  duplicateDate?: string;
  duplicateStartTime?: string;
  stakeMultiplier?: number;
  patch?: Partial<CreateSchedulePayloadDTO> & { status?: ScheduleLifecycleStatus };
}

export interface BulkSchedulePayloadDTO {
  ids: string[];
  action: "run_now" | "pause" | "resume" | "skip" | "shift_30m" | "assign_pool";
  poolCode?: string;
}

/** Section 1: Calendar Day Summary (7×6 month view). */
export interface CalendarDaySummaryDTO {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  weekdayShort: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  inCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  regimeLabel: "Full Multi-Asset Desk" | "24/7 Synthetics Only" | "Light Session";
  totalRuns: number;
  completedRuns: number;
  runningRuns: number;
  queuedRuns: number;
  pausedRuns: number;
  conflictCount: number;
  committedStakeUsd: number;
  realizedPnL: number;
  scheduleIds: string[];
}

/** Section 5: Package-Trade Capital Mapping Row. */
export interface PackageScheduleMappingDTO {
  packageId: string;
  packageCode: string;
  packageName: string;
  lifecycleStatus: string;
  investorsCount: number;
  filledSlots: number;
  totalSlots: number;
  schedulesCount: number;
  totalCapital: number;
  capitalSharePercent: number;
  avgStake: number;
  dailyCommittedExposure: number;
  maxDrawdownCap: number;
  currentDrawdownHit: number;
  scheduleRealizedPnL: number;
  assignedSymbols: DerivSymbol[];
}

/** Individual contract inside a historical schedule run (drill-down ledger). */
export interface ScheduleRunContractDTO {
  contractId: string;
  seq: number;
  executedAt: string;
  symbol: DerivSymbol;
  contractLabel: string;
  stake: number;
  entrySpot: number;
  exitSpot: number;
  profit: number;
  isWin: boolean;
}

/** Section 6: 30-Day Completed Schedule Run Record. */
export interface ScheduleHistoryRunDTO {
  id: string;
  scheduleId: string;
  scheduleCode: string;
  scheduleName: string;
  lastRunIso: string;
  runDateLabel: string; // "2026-10-19 09:00"
  symbol: DerivSymbol;
  strategy: StrategyName;
  packageCodes: string[];
  tradesCount: number;
  maxTrades: number;
  winsCount: number;
  lossesCount: number;
  winRatePercent: number;
  grossStake: number;
  netPnL: number;
  operatorFeeUsd: number;
  investorNetUsd: number;
  roiPercent: number;
  durationMinutes: number;
  exitReason: "window_complete" | "take_profit_hit" | "stop_loss_guard" | "manual_close";
  contracts: ScheduleRunContractDTO[];
}

/** Section 7: Pre-Flight Schedule Conflict & Guardrail Advisory. */
export interface ScheduleConflictDTO {
  id: string;
  severity: ConflictSeverity;
  category: ConflictCategory;
  scheduleId: string;
  scheduleCode: string;
  scheduleName: string;
  packageCode: string;
  windowLabel: string;
  headline: string;
  detail: string;
  recommendedFixLabel: string;
  recommendedAction:
    | { kind: "shift_time"; minutes: number }
    | { kind: "switch_weekdays" }
    | { kind: "swap_synthetic"; symbol: DerivSymbol }
    | { kind: "reduce_stake"; stake: number }
    | { kind: "acknowledge" };
  acknowledged: boolean;
}

/** Macro Event / Maintenance Blackout Window. */
export interface BlackoutWindowDTO {
  id: string;
  label: string;
  category: "Macro Release" | "Exchange Rollover" | "Liquidity Guard";
  date: string;
  startTime: string;
  endTime: string;
  affectedMarkets: Array<"Forex" | "Commodities" | "Crypto" | "Synthetics">;
  policy: "skip_window" | "delay_30m" | "synthetics_fallback";
  active: boolean;
}

/** Preset Strategy Profile for the Strategy Library & Backtest Wizard. */
export interface StrategyPresetProfileDTO {
  name: StrategyName;
  slug: string;
  code: string;
  riskTier: "Conservative" | "Balanced" | "Aggressive";
  progressionFormula: string;
  recommendedSymbols: DerivSymbol[];
  sampleLadderFrom35: number[];
  targetWinRatePercent: number;
  defaultCooldownLosses: number;
  summary: string;
}

/** Top 6 KPI Strip Summary for Page D-2. */
export interface SchedulerKpiStripDTO {
  scheduledToday: number;
  completedToday: number;
  runningNow: number;
  activeSequencesTotal: number;
  pausedSequencesTotal: number;
  dailyCommittedStake: number;
  dailyMaxTrades: number;
  thirtyDayNetPnL: number;
  thirtyDayWinRate: number;
  thirtyDayRunsCount: number;
  pooledCapitalCovered: number;
  activePoolsCount: number;
  openConflictsCount: number;
  criticalConflictsCount: number;
  currentUtcTime: string; // e.g. "14:24"
  anchorDate: string; // e.g. "2026-10-19"
}

/** Complete Structured Bundle for Page D-2 (`GET /api/schedules?view=bundle`). */
export interface TradeSchedulerBundleDTO {
  kpis: SchedulerKpiStripDTO;
  calendarMonthLabel: string; // "October 2026"
  calendarYear: number;
  calendarMonthIndex: number; // 9 (0-based October)
  calendarDays: CalendarDaySummaryDTO[];
  sequences: ScheduleSequenceDTO[];
  packageMappings: PackageScheduleMappingDTO[];
  historyRuns: ScheduleHistoryRunDTO[];
  conflicts: ScheduleConflictDTO[];
  blackouts: BlackoutWindowDTO[];
  strategyProfiles: StrategyPresetProfileDTO[];
}

/**
 * 16 Dedicated Scheduler Modals & Multi-Step Wizards on Page D-2
 * (on top of the 18 shared Operator Console modals/wizards = 34 total overlays!).
 */
export type SchedulerModalKind =
  | { type: "master-schedule-wizard"; defaultDate?: string; defaultSymbol?: DerivSymbol; presetStrategy?: StrategyName }
  | { type: "cron-recurrence-wizard"; targetScheduleId?: string }
  | { type: "backtest-stress-wizard"; scheduleId?: string }
  | { type: "batch-clone-day-wizard"; sourceDate?: string }
  | { type: "conflict-resolver-wizard"; focusConflictId?: string }
  | { type: "pool-prorata-wizard"; focusPackageCode?: string }
  | { type: "timeline-block-detail"; scheduleId: string }
  | { type: "edit-schedule"; scheduleId: string }
  | { type: "duplicate-schedule"; scheduleId: string }
  | { type: "skip-blackout-guard"; scheduleId?: string }
  | { type: "bulk-schedule-ops"; selectedIds: string[] }
  | { type: "strategy-library" }
  | { type: "history-run-drilldown"; runId: string }
  | { type: "guardrail-cooldown-policy"; scheduleId?: string }
  | { type: "api-payload-inspector"; sampleScheduleId?: string }
  | { type: "delete-schedule-confirm"; scheduleId: string };
