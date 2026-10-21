"use client";

import Link from "next/link";
import { useState } from "react";

import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import {
  BacktestStressWizard,
  BatchCloneDayWizard,
  ConflictResolverWizard,
  CronRecurrenceWizard,
  MasterScheduleWizard,
  PoolProrataWizard,
} from "@/components/dashboard/schedules/scheduler-wizards";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type {
  DerivSymbol,
  FundsFlowDTO,
  OperatorWorkspaceDTO,
  StrategyName,
} from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";
import {
  useBulkScheduleUpdate,
  useDeleteScheduleSequence,
  useMutateBlackout,
  usePatchScheduleSequence,
} from "@/lib/queries/use-schedules";
import {
  SCHEDULE_STRATEGIES,
  SCHEDULE_SYMBOLS,
} from "@/lib/schedules/schemas";
import type {
  BulkSchedulePayloadDTO,
  ScheduleRecurrence,
  SchedulerModalKind,
  TradeSchedulerBundleDTO,
} from "@/lib/schedules/types";

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 7 (`SCH-MOD-07`) · TIMELINE BLOCK LIVE EXECUTION & TELEMETRY
   ═══════════════════════════════════════════════════════════════════════════ */
function TimelineBlockDetailModal({
  bundle,
  scheduleId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  scheduleId: string;
  onClose: () => void;
}) {
  const { pushToast, openSchedulerModal, inspectEntity, markFlashedSchedule } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();

  const seq = bundle.sequences.find((s) => s.id === scheduleId) ?? bundle.sequences[0];
  if (!seq) return null;

  const progressPct = Math.round((seq.completedTrades / Math.max(1, seq.maxTrades)) * 100);

  return (
    <DeskModalShell
      code="SCH-MOD-07"
      eyebrow="Section 2 · Timeline Block Telemetry"
      title={seq.name}
      subtitle={`${seq.startTime}–${seq.endTime} UTC · ${seq.symbolLabel} (${seq.contractLabel})`}
      size="md"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between flex-wrap gap-2 w-100">
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => {
                onClose();
                inspectEntity({ kind: "schedule-sequence", id: seq.id });
              }}
            >
              Right Drawer
            </button>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "edit-schedule", scheduleId: seq.id })}
            >
              Edit Window
            </button>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => patchSeq.mutate({ id: seq.id, action: "toggle" })}
            >
              {seq.status === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className="btn-brand"
              disabled={patchSeq.isPending}
              onClick={async () => {
                await patchSeq.mutateAsync({ id: seq.id, action: "run_now" });
                markFlashedSchedule(seq.id);
                pushToast({
                  tone: "success",
                  title: `Executed ${seq.name} immediately`,
                  detail: `Settled ${seq.maxTrades} contracts across ${seq.packageCodes.join(", ")}.`,
                });
                onClose();
              }}
            >
              <Icon name="play" size={14} /> Run Sequence Now
            </button>
          </div>
        </div>
      }
    >
      <div className="p-3 rounded border bg-light mb-3">
        <div className="d-flex justify-content-between align-items-center small mb-1">
          <span className="fw-semibold">
            Contract Fill Progress ({seq.completedTrades} / {seq.maxTrades} trades)
          </span>
          <span className="mono fw-semibold">{progressPct}%</span>
        </div>
        <div className="progress" style={{ height: 7 }}>
          <div className="progress-bar bg-dark" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <dl className="auth-kv mb-0">
        <dt>Sequence Code &amp; Status</dt>
        <dd className="mono">
          {seq.code} · {seq.status.toUpperCase()}
        </dd>
        <dt>Strategy &amp; Runner</dt>
        <dd className="mono">
          {seq.strategy} ({seq.assignedBotCode})
        </dd>
        <dt>Base Stake / Max Exposure</dt>
        <dd className="mono">
          ${seq.initialStake} / ${seq.initialStake * seq.maxTrades} notional
        </dd>
        <dt>Window Realized P&amp;L</dt>
        <dd className={cn("mono fw-semibold", seq.livePnL >= 0 ? "text-win" : "text-loss")}>
          {seq.livePnL >= 0 ? "+" : ""}
          {formatCurrency(seq.livePnL)}
        </dd>
        <dt>Pool Capital Attribution</dt>
        <dd className="mono">
          {seq.packageCodes.map((c) => `${c} (${seq.packageAllocation[c] ?? 0}%)`).join(" · ")}
        </dd>
        <dt>Risk Guardrails</dt>
        <dd className="mono">
          TP +${seq.takeProfit} · SL −${seq.stopLoss} · Cooldown {seq.cooldownLosses}L
        </dd>
      </dl>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 8 (`SCH-MOD-08`) · EDIT SCHEDULE SEQUENCE MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function EditScheduleModal({
  bundle,
  scheduleId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  scheduleId: string;
  onClose: () => void;
}) {
  const { pushToast, markFlashedSchedule } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();

  const seq = bundle.sequences.find((s) => s.id === scheduleId) ?? bundle.sequences[0];
  const [name, setName] = useState(seq?.name ?? "");
  const [date, setDate] = useState(seq?.date ?? "2026-10-19");
  const [startTime, setStartTime] = useState(seq?.startTime ?? "15:00");
  const [endTime, setEndTime] = useState(seq?.endTime ?? "16:00");
  const [symbol, setSymbol] = useState<DerivSymbol>(seq?.symbol ?? "R_10");
  const [strategy, setStrategy] = useState<StrategyName>(seq?.strategy ?? "Martingale");
  const [initialStake, setInitialStake] = useState(seq?.initialStake ?? 35);
  const [maxTrades, setMaxTrades] = useState(seq?.maxTrades ?? 8);
  const [recurrence, setRecurrence] = useState<ScheduleRecurrence>(seq?.recurrence ?? "weekdays");
  const [stopLoss, setStopLoss] = useState(seq?.stopLoss ?? 300);
  const [takeProfit, setTakeProfit] = useState(seq?.takeProfit ?? 600);

  if (!seq) return null;

  const save = async () => {
    await patchSeq.mutateAsync({
      id: seq.id,
      action: "update_fields",
      patch: {
        name,
        date,
        startTime,
        endTime,
        symbol,
        strategy,
        initialStake,
        maxTrades,
        recurrence,
        stopLoss,
        takeProfit,
      },
    });
    markFlashedSchedule(seq.id);
    pushToast({
      tone: "success",
      title: `Updated ${name} (${seq.code})`,
      detail: `${startTime}–${endTime} UTC · ${symbol} · $${initialStake}`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-MOD-08"
      eyebrow={`Edit Sequence · ${seq.code}`}
      title={`Modify ${seq.name}`}
      subtitle="Changes persist immediately to server schedule state and update Calendar & Timeline views."
      size="lg"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-brand"
            disabled={patchSeq.isPending}
            onClick={save}
          >
            <Icon name="check" size={15} /> Save Changes
          </button>
        </div>
      }
    >
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label small fw-semibold">Sequence Name</label>
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold">Anchor Date</label>
          <input
            type="date"
            className="form-control mono"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Start UTC</label>
          <input
            type="time"
            className="form-control mono"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">End UTC</label>
          <input
            type="time"
            className="form-control mono"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Symbol</label>
          <select
            className="form-select mono"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as DerivSymbol)}
          >
            {SCHEDULE_SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Strategy</label>
          <select
            className="form-select"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as StrategyName)}
          >
            {SCHEDULE_STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Base Stake ($)</label>
          <input
            type="number"
            min={0.35}
            step="0.5"
            className="form-control mono"
            value={initialStake}
            onChange={(e) => setInitialStake(Number(e.target.value))}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Max Trades</label>
          <input
            type="number"
            min={1}
            max={500}
            className="form-control mono"
            value={maxTrades}
            onChange={(e) => setMaxTrades(Number(e.target.value))}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Stop Loss ($)</label>
          <input
            type="number"
            className="form-control mono"
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Take Profit ($)</label>
          <input
            type="number"
            className="form-control mono"
            value={takeProfit}
            onChange={(e) => setTakeProfit(Number(e.target.value))}
          />
        </div>
        <div className="col-12">
          <label className="form-label small fw-semibold">Recurrence Rule</label>
          <select
            className="form-select"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as ScheduleRecurrence)}
          >
            <option value="weekdays">Weekdays (Mon–Fri)</option>
            <option value="daily">Daily (Mon–Sun)</option>
            <option value="one_time">One-Time</option>
            <option value="weekends_synthetics">Weekends (Synthetics Only)</option>
            <option value="custom_cron">Custom Cron</option>
          </select>
        </div>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 9 (`SCH-MOD-09`) · DUPLICATE & TIME-SHIFT SEQUENCE MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function DuplicateScheduleModal({
  bundle,
  scheduleId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  scheduleId: string;
  onClose: () => void;
}) {
  const { pushToast, markFlashedSchedule } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();

  const seq = bundle.sequences.find((s) => s.id === scheduleId) ?? bundle.sequences[0];
  const [duplicateDate, setDuplicateDate] = useState(seq?.date ?? "2026-10-20");
  const [duplicateStartTime, setDuplicateStartTime] = useState("18:30");
  const [stakeMultiplier, setStakeMultiplier] = useState(1.0);

  if (!seq) return null;

  const confirmClone = async () => {
    const created = await patchSeq.mutateAsync({
      id: seq.id,
      action: "duplicate",
      duplicateDate,
      duplicateStartTime,
      stakeMultiplier,
    });
    markFlashedSchedule(created.id);
    pushToast({
      tone: "success",
      title: `Cloned ${seq.code} → ${created.code}`,
      detail: `Scheduled at ${duplicateStartTime} UTC (${duplicateDate}).`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-MOD-09"
      eyebrow="Sequence Replication"
      title={`Duplicate ${seq.name}`}
      subtitle="Clone instrument, progression strategy, and pool splits into a shifted UTC slot."
      size="md"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-brand"
            disabled={patchSeq.isPending}
            onClick={confirmClone}
          >
            <Icon name="copy" size={14} /> Create Cloned Sequence
          </button>
        </div>
      }
    >
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label small fw-semibold">Target Date</label>
          <input
            type="date"
            className="form-control mono"
            value={duplicateDate}
            onChange={(e) => setDuplicateDate(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold">New Start Time (UTC)</label>
          <input
            type="time"
            className="form-control mono"
            value={duplicateStartTime}
            onChange={(e) => setDuplicateStartTime(e.target.value)}
          />
        </div>
        <div className="col-12">
          <label className="form-label small fw-semibold">
            Stake Multiplier ({stakeMultiplier}× → $
            {Math.max(1, Math.round(seq.initialStake * stakeMultiplier))})
          </label>
          <input
            type="range"
            className="form-range"
            min={0.5}
            max={2}
            step={0.25}
            value={stakeMultiplier}
            onChange={(e) => setStakeMultiplier(Number(e.target.value))}
          />
        </div>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 10 (`SCH-MOD-10`) · SKIP WINDOW & MACRO NEWS BLACKOUT GUARD
   ═══════════════════════════════════════════════════════════════════════════ */
function SkipBlackoutGuardModal({
  bundle,
  scheduleId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  scheduleId?: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();
  const blackoutMut = useMutateBlackout();

  const targetSeq = bundle.sequences.find((s) => s.id === scheduleId) ?? bundle.sequences[0];
  const [reason, setReason] = useState("High-impact macro spread widening protection");
  const [newLabel, setNewLabel] = useState("FOMC Rate Statement Spread Guard");
  const [newDate, setNewDate] = useState("2026-10-28");
  const [newStart, setNewStart] = useState("17:45");
  const [newEnd, setNewEnd] = useState("18:45");

  const skipSingle = async () => {
    if (!targetSeq) return;
    await patchSeq.mutateAsync({
      id: targetSeq.id,
      action: "skip",
      skipReason: reason,
    });
    pushToast({
      tone: "info",
      title: `Skipped next window for ${targetSeq.name}`,
      detail: reason,
    });
    onClose();
  };

  const addBlackout = async () => {
    await blackoutMut.mutateAsync({
      action: "add",
      blackout: {
        label: newLabel,
        category: "Macro Release",
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
        affectedMarkets: ["Forex", "Commodities"],
        policy: "skip_window",
        active: true,
      },
    });
    pushToast({
      tone: "success",
      title: `Added blackout guard: ${newLabel}`,
      detail: `${newDate} · ${newStart}–${newEnd} UTC`,
    });
  };

  return (
    <DeskModalShell
      code="SCH-MOD-10"
      eyebrow="Execution Skip & Spread Protection"
      title="Skip Window / Macro Blackout Guard"
      subtitle="Skip an individual scheduled run or manage automated NFP / CPI / FOMC blackout windows."
      size="lg"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Close
          </button>
          {targetSeq ? (
            <button
              type="button"
              className="btn-brand"
              disabled={patchSeq.isPending}
              onClick={skipSingle}
            >
              Skip {targetSeq.code} Next Run
            </button>
          ) : null}
        </div>
      }
    >
      {targetSeq ? (
        <div className="p-3 rounded border bg-light mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>
              Skip Single Run: <span className="mono">{targetSeq.name}</span>
            </strong>
            <span className="mono small text-secondary">
              {targetSeq.startTime}–{targetSeq.endTime} UTC
            </span>
          </div>
          <input
            className="form-control form-control-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Audit log note for skipping window…"
          />
        </div>
      ) : null}

      <div className="mb-3">
        <span className="eyebrow-label d-block mb-2">Active Macro &amp; Rollover Blackouts</span>
        <div className="d-flex flex-column gap-2">
          {bundle.blackouts.map((blk) => (
            <div
              key={blk.id}
              className="d-flex justify-content-between align-items-center p-2 px-3 rounded border"
            >
              <div>
                <strong className="small">{blk.label}</strong>
                <div className="mono small text-secondary">
                  {blk.date} · {blk.startTime}–{blk.endTime} UTC · {blk.affectedMarkets.join(", ")}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary mono"
                onClick={() => blackoutMut.mutate({ action: "toggle", id: blk.id })}
              >
                {blk.active ? "Active" : "Muted"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-top pt-3">
        <span className="eyebrow-label d-block mb-2">Add New Blackout Guard</span>
        <div className="row g-2 align-items-end">
          <div className="col-md-5">
            <input
              className="form-control form-control-sm"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <input
              type="date"
              className="form-control form-control-sm mono"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="col-6 col-md-2">
            <input
              type="time"
              className="form-control form-control-sm mono"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </div>
          <div className="col-6 col-md-2">
            <button
              type="button"
              className="btn btn-sm btn-dark w-100"
              disabled={blackoutMut.isPending}
              onClick={addBlackout}
            >
              + Add
            </button>
          </div>
        </div>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 11 (`SCH-MOD-11`) · BULK SCHEDULE OPERATIONS MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function BulkScheduleOpsModal({
  bundle,
  selectedIds,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  selectedIds: string[];
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const bulkMut = useBulkScheduleUpdate();

  const effectiveIds =
    selectedIds.length > 0 ? selectedIds : bundle.sequences.slice(0, 3).map((s) => s.id);
  const [action, setAction] = useState<BulkSchedulePayloadDTO["action"]>("run_now");
  const [poolCode, setPoolCode] = useState("PKG-01");

  const targets = bundle.sequences.filter((s) => effectiveIds.includes(s.id));

  const executeBulk = async () => {
    const res = await bulkMut.mutateAsync({ ids: effectiveIds, action, poolCode });
    pushToast({
      tone: "success",
      title: `Applied '${action}' across ${res.updatedCount} sequences`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-MOD-11"
      eyebrow="Section 3 · Batch Execution Control"
      title={`Bulk Action on ${targets.length} Sequences`}
      subtitle="Apply synchronized state transitions, time shifts, or pool assignments across selected rows."
      size="md"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-brand"
            disabled={bulkMut.isPending}
            onClick={executeBulk}
          >
            Execute Batch Action
          </button>
        </div>
      }
    >
      <div className="mb-3">
        <label className="form-label small fw-semibold">Batch Operation</label>
        <select
          className="form-select"
          value={action}
          onChange={(e) => setAction(e.target.value as BulkSchedulePayloadDTO["action"])}
        >
          <option value="run_now">Run All Selected Sequences Immediately</option>
          <option value="skip">Skip Next Window on Selected</option>
          <option value="pause">Pause Selected Sequences</option>
          <option value="resume">Resume Selected Sequences</option>
          <option value="shift_30m">Shift UTC Window Forward +30 Minutes</option>
          <option value="assign_pool">Attach Crowdfunding Pool Package</option>
        </select>
      </div>

      {action === "assign_pool" ? (
        <div className="mb-3">
          <label className="form-label small fw-semibold">Pool Package to Attach</label>
          <select
            className="form-select mono"
            value={poolCode}
            onChange={(e) => setPoolCode(e.target.value)}
          >
            <option value="PKG-01">PKG-01 · Synthetic Alpha Syndicate</option>
            <option value="PKG-02">PKG-02 · FX &amp; Parity Momentum Pool</option>
            <option value="PKG-03">PKG-03 · Low-Drawdown Reserve Pool</option>
          </select>
        </div>
      ) : null}

      <div className="d-flex flex-column gap-1 small">
        {targets.map((t) => (
          <div key={t.id} className="d-flex justify-content-between p-2 rounded border bg-light mono">
            <span>
              {t.code} · {t.name}
            </span>
            <span>
              {t.startTime} UTC · ${t.initialStake}
            </span>
          </div>
        ))}
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 12 (`SCH-MOD-12`) · INSTITUTIONAL STRATEGY PRESET LIBRARY
   ═══════════════════════════════════════════════════════════════════════════ */
function StrategyLibraryModal({
  bundle,
  onSelectPreset,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  onSelectPreset?: (strategy: StrategyName, symbol: DerivSymbol) => void;
  onClose: () => void;
}) {
  const { openSchedulerModal, pushToast } = useOperatorUI();
  const [previewStake, setPreviewStake] = useState(35);

  return (
    <DeskModalShell
      code="SCH-MOD-12"
      eyebrow="Section 4 · Strategy Progression Engine"
      title="Execution Strategy Preset Library (7 Models)"
      subtitle="Inspect 6-step stake progression curves, risk classifications, and load directly into a schedule."
      size="xl"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="d-flex align-items-center gap-2 small">
            <span>Preview Base Unit ($):</span>
            {[10, 35, 70].map((u) => (
              <button
                key={u}
                type="button"
                className={cn(
                  "btn btn-sm mono",
                  previewStake === u ? "btn-dark" : "btn-outline-secondary",
                )}
                onClick={() => setPreviewStake(u)}
              >
                ${u}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Close Library
          </button>
        </div>
      }
    >
      <div className="row g-3">
        {bundle.strategyProfiles.map((prof) => (
          <div className="col-md-6" key={prof.code}>
            <div className="p-3 rounded border h-100 d-flex flex-column justify-content-between gap-2">
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="desk-code-tag mono">{prof.code}</span>
                  <span className="pill">{prof.riskTier}</span>
                </div>
                <h3 className="h6 fw-bold mb-1">{prof.name}</h3>
                <p className="small text-secondary mb-2">{prof.summary}</p>
                <div className="mono small text-dark mb-1">{prof.progressionFormula}</div>
                <div className="p-2 rounded bg-light mono small">
                  Steps:{" "}
                  {prof.sampleLadderFrom35
                    .map((s) => `$${((s / 35) * previewStake).toFixed(1)}`)
                    .join(" → ")}
                </div>
              </div>
              <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                <span className="mono small text-muted">
                  Best on {prof.recommendedSymbols.join(", ")}
                </span>
                <div className="d-flex gap-1">
                  {onSelectPreset ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-dark"
                      onClick={() => {
                        onSelectPreset(prof.name, prof.recommendedSymbols[0]);
                        pushToast({
                          tone: "info",
                          title: `Loaded ${prof.name} into inline composer`,
                        });
                        onClose();
                      }}
                    >
                      Use Inline
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-sm btn-dark"
                    onClick={() =>
                      openSchedulerModal({
                        type: "master-schedule-wizard",
                        presetStrategy: prof.name,
                        defaultSymbol: prof.recommendedSymbols[0],
                      })
                    }
                  >
                    Launch Wizard →
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 13 (`SCH-MOD-13`) · 30-DAY HISTORICAL RUN CONTRACT DRILL-DOWN
   ═══════════════════════════════════════════════════════════════════════════ */
function HistoryRunDrilldownModal({
  bundle,
  runId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  runId: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();

  const run = bundle.historyRuns.find((r) => r.id === runId) ?? bundle.historyRuns[0];
  if (!run) return null;

  return (
    <DeskModalShell
      code="SCH-MOD-13"
      eyebrow={`Section 6 · Completed Schedule Ledger · ${run.scheduleCode}`}
      title={`${run.scheduleName} (${run.runDateLabel})`}
      subtitle={`Settled ${run.tradesCount} contracts on ${run.symbol} (${run.strategy}) · Exit: ${run.exitReason.replace(/_/g, " ")}`}
      size="lg"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <Link
            href={`/dashboard/trades?schedule=${run.scheduleCode}`}
            className="btn-ghost btn-ghost--sm"
            onClick={onClose}
          >
            Open Full Trade Blotter →
          </Link>
          <button
            type="button"
            className="btn-brand"
            disabled={patchSeq.isPending}
            onClick={async () => {
              await patchSeq.mutateAsync({ id: run.scheduleId, action: "run_now" });
              pushToast({
                tone: "success",
                title: `Re-executed ${run.scheduleName}`,
              });
              onClose();
            }}
          >
            <Icon name="refresh" size={14} /> Re-Run Sequence Now
          </button>
        </div>
      }
    >
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <div className="p-2 px-3 rounded border bg-light">
            <span className="eyebrow-label d-block">Net Run P&amp;L</span>
            <strong className={cn("mono", run.netPnL >= 0 ? "text-win" : "text-loss")}>
              {run.netPnL >= 0 ? "+" : ""}
              {formatCurrency(run.netPnL)}
            </strong>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-2 px-3 rounded border bg-light">
            <span className="eyebrow-label d-block">Win Rate</span>
            <strong className="mono">
              {run.winRatePercent}% ({run.winsCount}W/{run.lossesCount}L)
            </strong>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-2 px-3 rounded border bg-light">
            <span className="eyebrow-label d-block">Investor 80% Net</span>
            <strong className="mono">{formatCurrency(run.investorNetUsd)}</strong>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-2 px-3 rounded border bg-light">
            <span className="eyebrow-label d-block">Desk 20% Fee</span>
            <strong className="mono">{formatCurrency(run.operatorFeeUsd)}</strong>
          </div>
        </div>
      </div>

      <div className="table-responsive border rounded">
        <table className="table desk-table mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Deriv Contract ID</th>
              <th>UTC Time</th>
              <th>Contract</th>
              <th className="text-end">Entry → Exit Spot</th>
              <th className="text-end">Stake</th>
              <th className="text-end">Profit</th>
            </tr>
          </thead>
          <tbody>
            {run.contracts.map((c) => (
              <tr key={c.contractId}>
                <td className="mono">{c.seq}</td>
                <td className="mono fw-semibold">{c.contractId}</td>
                <td className="mono">{c.executedAt}</td>
                <td>{c.contractLabel}</td>
                <td className="text-end mono">
                  {c.entrySpot} → {c.exitSpot}
                </td>
                <td className="text-end mono">${c.stake}</td>
                <td className={cn("text-end mono fw-semibold", c.isWin ? "text-win" : "text-loss")}>
                  {c.isWin ? `+${formatCurrency(c.profit)}` : formatCurrency(c.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 14 (`SCH-MOD-14`) · GUARDRAIL & CONSECUTIVE-LOSS COOLDOWN POLICY
   ═══════════════════════════════════════════════════════════════════════════ */
function GuardrailCooldownModal({
  bundle,
  scheduleId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  scheduleId?: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();

  const initial = bundle.sequences.find((s) => s.id === scheduleId) ?? bundle.sequences[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const current = bundle.sequences.find((s) => s.id === selectedId) ?? initial;

  const [stopLoss, setStopLoss] = useState(current?.stopLoss ?? 500);
  const [takeProfit, setTakeProfit] = useState(current?.takeProfit ?? 1000);
  const [maxDrawdown, setMaxDrawdown] = useState(current?.maxDrawdown ?? 5.0);
  const [cooldownLosses, setCooldownLosses] = useState(current?.cooldownLosses ?? 3);
  const [cooldownMinutes, setCooldownMinutes] = useState(
    Math.round((current?.cooldownDurationSec ?? 300) / 60),
  );

  const saveGuardrails = async () => {
    if (!current) return;
    await patchSeq.mutateAsync({
      id: current.id,
      action: "update_fields",
      patch: {
        stopLoss,
        takeProfit,
        maxDrawdown,
        cooldownLosses,
        cooldownDurationSec: cooldownMinutes * 60,
      },
    });
    pushToast({
      tone: "success",
      title: `Updated risk guardrails for ${current.name}`,
      detail: `SL −$${stopLoss} · TP +$${takeProfit} · ${cooldownLosses}L → ${cooldownMinutes}m pause`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-MOD-14"
      eyebrow="Circuit Breakers & Streak Lockout"
      title="Per-Schedule Risk & Cooldown Policy"
      subtitle="Enforce hard USD stop-loss, session profit lock, drawdown ceiling, and loss-streak pause timers."
      size="md"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-brand"
            disabled={patchSeq.isPending}
            onClick={saveGuardrails}
          >
            <Icon name="shield" size={14} /> Save Policy
          </button>
        </div>
      }
    >
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label small fw-semibold">Sequence</label>
          <select
            className="form-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {bundle.sequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6">
          <label className="form-label small fw-semibold">Stop Loss Auto-Halt ($)</label>
          <input
            type="number"
            className="form-control mono"
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
          />
        </div>
        <div className="col-6">
          <label className="form-label small fw-semibold">Take Profit Lock ($)</label>
          <input
            type="number"
            className="form-control mono"
            value={takeProfit}
            onChange={(e) => setTakeProfit(Number(e.target.value))}
          />
        </div>
        <div className="col-4">
          <label className="form-label small fw-semibold">Max Drawdown (%)</label>
          <input
            type="number"
            step="0.5"
            className="form-control mono"
            value={maxDrawdown}
            onChange={(e) => setMaxDrawdown(Number(e.target.value))}
          />
        </div>
        <div className="col-4">
          <label className="form-label small fw-semibold">Loss Streak Trigger</label>
          <input
            type="number"
            min={1}
            max={12}
            className="form-control mono"
            value={cooldownLosses}
            onChange={(e) => setCooldownLosses(Number(e.target.value))}
          />
        </div>
        <div className="col-4">
          <label className="form-label small fw-semibold">Cooldown (Minutes)</label>
          <input
            type="number"
            min={1}
            max={120}
            className="form-control mono"
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(Number(e.target.value))}
          />
        </div>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 15 (`SCH-MOD-15`) · BACKEND REST PAYLOAD & CONTRACT INSPECTOR
   ═══════════════════════════════════════════════════════════════════════════ */
function ApiPayloadInspectorModal({
  bundle,
  sampleScheduleId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  sampleScheduleId?: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const sample =
    bundle.sequences.find((s) => s.id === sampleScheduleId) ?? bundle.sequences[4] ?? bundle.sequences[0];

  const payloadJson = JSON.stringify(
    {
      name: sample.name,
      date: sample.date,
      startTime: sample.startTime,
      endTime: sample.endTime,
      symbol: sample.symbol,
      strategy: sample.strategy.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      initialStake: sample.initialStake,
      maxTrades: sample.maxTrades,
      packageIds: sample.packageCodes.map((c) => c.toLowerCase().replace("-", "_")),
      packageAllocation: sample.packageAllocation,
      recurrence: sample.recurrence,
      cronExpression: sample.cronExpression,
      stopLoss: sample.stopLoss,
      takeProfit: sample.takeProfit,
      maxDrawdown: sample.maxDrawdown,
      cooldownLosses: sample.cooldownLosses,
      cooldownDuration: sample.cooldownDurationSec,
      status: "active",
    },
    null,
    2,
  );

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payloadJson);
      pushToast({ tone: "success", title: "Copied structured POST /api/schedules DTO JSON" });
    } catch {
      pushToast({ tone: "info", title: "Payload ready in inspector view" });
    }
  };

  return (
    <DeskModalShell
      code="SCH-MOD-15"
      eyebrow="Backend Integration Contract (`src/lib/api/schedules.ts`)"
      title="Structured Schedule REST Payload & Endpoints"
      subtitle="1-to-1 wire format matching tradeMO.md §6 Page D-2 for drop-in Express + BullMQ integration."
      size="lg"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-brand" onClick={copyPayload}>
            <Icon name="copy" size={14} /> Copy JSON DTO
          </button>
        </div>
      }
    >
      <div className="small text-secondary mb-2">
        Active Frontend Transport Endpoints: <code className="mono">GET /api/schedules?view=bundle</code>{" "}
        · <code className="mono">POST /api/schedules</code> ·{" "}
        <code className="mono">PATCH /api/schedules</code> ·{" "}
        <code className="mono">POST /api/schedules/conflicts</code> ·{" "}
        <code className="mono">POST /api/schedules/rebalance</code>
      </div>
      <pre
        className="p-3 rounded border bg-light mono small mb-0"
        style={{ maxHeight: 320, overflowY: "auto" }}
      >
        {payloadJson}
      </pre>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 16 (`SCH-MOD-16`) · DELETE / ARCHIVE SEQUENCE CONFIRMATION MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function DeleteScheduleConfirmModal({
  bundle,
  scheduleId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  scheduleId: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const deleteMut = useDeleteScheduleSequence();

  const seq = bundle.sequences.find((s) => s.id === scheduleId);
  if (!seq) return null;

  return (
    <DeskModalShell
      code="SCH-MOD-16"
      eyebrow="Sequence Removal Confirmation"
      title={`Remove ${seq.name} (${seq.code})?`}
      subtitle="This unschedules future BullMQ / cron executions for assigned crowdfunding packages."
      size="sm"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Keep Sequence
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={deleteMut.isPending}
            onClick={async () => {
              await deleteMut.mutateAsync(seq.id);
              pushToast({
                tone: "info",
                title: `Removed schedule ${seq.code} (${seq.name})`,
              });
              onClose();
            }}
          >
            Remove Schedule
          </button>
        </div>
      }
    >
      <dl className="auth-kv mb-0">
        <dt>UTC Window</dt>
        <dd className="mono">
          {seq.startTime}–{seq.endTime} UTC ({seq.recurrence})
        </dd>
        <dt>Assigned Pools</dt>
        <dd className="mono">{seq.packageCodes.join(", ")}</dd>
        <dt>Daily Notional Freed</dt>
        <dd className="mono">${seq.initialStake * seq.maxTrades}</dd>
      </dl>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MASTER HOST FOR ALL 16 DEDICATED PAGE D-2 MODALS & WIZARDS
   ═══════════════════════════════════════════════════════════════════════════ */
export function SchedulerModalHost({
  modal,
  bundle,
  funds,
  workspace,
  onSelectPreset,
  onClose,
}: {
  modal: SchedulerModalKind | null;
  bundle: TradeSchedulerBundleDTO;
  funds: FundsFlowDTO;
  workspace: OperatorWorkspaceDTO;
  onSelectPreset?: (strategy: StrategyName, symbol: DerivSymbol) => void;
  onClose: () => void;
}) {
  if (!modal) return null;

  switch (modal.type) {
    case "master-schedule-wizard":
      return (
        <MasterScheduleWizard
          bundle={bundle}
          funds={funds}
          workspace={workspace}
          defaultDate={modal.defaultDate}
          defaultSymbol={modal.defaultSymbol}
          presetStrategy={modal.presetStrategy}
          onClose={onClose}
        />
      );
    case "cron-recurrence-wizard":
      return (
        <CronRecurrenceWizard
          bundle={bundle}
          targetScheduleId={modal.targetScheduleId}
          onClose={onClose}
        />
      );
    case "backtest-stress-wizard":
      return (
        <BacktestStressWizard
          bundle={bundle}
          scheduleId={modal.scheduleId}
          onClose={onClose}
        />
      );
    case "batch-clone-day-wizard":
      return (
        <BatchCloneDayWizard
          bundle={bundle}
          sourceDate={modal.sourceDate}
          onClose={onClose}
        />
      );
    case "conflict-resolver-wizard":
      return (
        <ConflictResolverWizard
          bundle={bundle}
          focusConflictId={modal.focusConflictId}
          onClose={onClose}
        />
      );
    case "pool-prorata-wizard":
      return <PoolProrataWizard bundle={bundle} funds={funds} onClose={onClose} />;
    case "timeline-block-detail":
      return (
        <TimelineBlockDetailModal
          bundle={bundle}
          scheduleId={modal.scheduleId}
          onClose={onClose}
        />
      );
    case "edit-schedule":
      return (
        <EditScheduleModal
          bundle={bundle}
          scheduleId={modal.scheduleId}
          onClose={onClose}
        />
      );
    case "duplicate-schedule":
      return (
        <DuplicateScheduleModal
          bundle={bundle}
          scheduleId={modal.scheduleId}
          onClose={onClose}
        />
      );
    case "skip-blackout-guard":
      return (
        <SkipBlackoutGuardModal
          bundle={bundle}
          scheduleId={modal.scheduleId}
          onClose={onClose}
        />
      );
    case "bulk-schedule-ops":
      return (
        <BulkScheduleOpsModal
          bundle={bundle}
          selectedIds={modal.selectedIds}
          onClose={onClose}
        />
      );
    case "strategy-library":
      return (
        <StrategyLibraryModal
          bundle={bundle}
          onSelectPreset={onSelectPreset}
          onClose={onClose}
        />
      );
    case "history-run-drilldown":
      return (
        <HistoryRunDrilldownModal
          bundle={bundle}
          runId={modal.runId}
          onClose={onClose}
        />
      );
    case "guardrail-cooldown-policy":
      return (
        <GuardrailCooldownModal
          bundle={bundle}
          scheduleId={modal.scheduleId}
          onClose={onClose}
        />
      );
    case "api-payload-inspector":
      return (
        <ApiPayloadInspectorModal
          bundle={bundle}
          sampleScheduleId={modal.sampleScheduleId}
          onClose={onClose}
        />
      );
    case "delete-schedule-confirm":
      return (
        <DeleteScheduleConfirmModal
          bundle={bundle}
          scheduleId={modal.scheduleId}
          onClose={onClose}
        />
      );
  }
}
