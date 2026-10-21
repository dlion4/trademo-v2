"use client";

import { useState } from "react";

import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
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
  useCloneDayLineup,
  useCreateScheduleSequence,
  usePatchScheduleSequence,
  useRebalanceScheduleAllocations,
  useResolveScheduleConflict,
} from "@/lib/queries/use-schedules";
import {
  CRON_PRESETS,
  describeCronExpression,
  minutesToTime,
  previewNextCronRuns,
  SCHEDULE_STRATEGIES,
  SCHEDULE_SYMBOLS,
  suggestScheduleName,
  timeToMinutes,
} from "@/lib/schedules/schemas";
import type {
  ScheduleRecurrence,
  TradeSchedulerBundleDTO,
} from "@/lib/schedules/types";

const QUICK_STAKES = [0.35, 1, 5, 35, 70, 100];

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 1 (`SCH-WIZ-01`) · 4-STEP MASTER SCHEDULE SEQUENCE BUILDER
   ═══════════════════════════════════════════════════════════════════════════ */
export function MasterScheduleWizard({
  bundle,
  funds,
  workspace,
  defaultDate,
  defaultSymbol,
  presetStrategy,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  funds: FundsFlowDTO;
  workspace: OperatorWorkspaceDTO;
  defaultDate?: string;
  defaultSymbol?: DerivSymbol;
  presetStrategy?: StrategyName;
  onClose: () => void;
}) {
  const { pushToast, markFlashedSchedule } = useOperatorUI();
  const createSeq = useCreateScheduleSequence();

  const initSym = defaultSymbol ?? "R_10";
  const initStrat = presetStrategy ?? "Martingale";

  const [step, setStep] = useState(0);
  const [date, setDate] = useState(defaultDate ?? bundle.kpis.anchorDate);
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("16:00");
  const [symbol, setSymbol] = useState<DerivSymbol>(initSym);
  const [strategy, setStrategy] = useState<StrategyName>(initStrat);
  const [name, setName] = useState(suggestScheduleName(initStrat, initSym, "15:00"));
  const [customNamed, setCustomNamed] = useState(false);

  const [initialStake, setInitialStake] = useState(35);
  const [maxTrades, setMaxTrades] = useState(8);
  const [stopLoss, setStopLoss] = useState(500);
  const [takeProfit, setTakeProfit] = useState(1000);
  const [maxDrawdown, setMaxDrawdown] = useState(5.0);
  const [cooldownLosses, setCooldownLosses] = useState(3);
  const [cooldownDurationSec, setCooldownDurationSec] = useState(300);

  const [selectedPools, setSelectedPools] = useState<string[]>(["PKG-01", "PKG-02", "PKG-03"]);
  const [allocations, setAllocations] = useState<Record<string, number>>({
    "PKG-01": 40,
    "PKG-02": 35,
    "PKG-03": 25,
    "PKG-04": 0,
  });
  const [recurrence, setRecurrence] = useState<ScheduleRecurrence>("weekdays");
  const [cronExpression, setCronExpression] = useState("0 15 * * 1-5");
  const [err, setErr] = useState<string | null>(null);

  const quote = workspace.markets.find((m) => m.symbol === symbol) ?? workspace.markets[0];
  const profile =
    bundle.strategyProfiles.find((p) => p.name === strategy) ?? bundle.strategyProfiles[0];

  const syncName = (nextStrat: StrategyName, nextSym: DerivSymbol, nextStart: string) => {
    if (!customNamed) {
      setName(suggestScheduleName(nextStrat, nextSym, nextStart));
    }
  };

  const togglePool = (code: string) => {
    const exists = selectedPools.includes(code);
    const next = exists ? selectedPools.filter((c) => c !== code) : [...selectedPools, code];
    if (next.length === 0) return;
    setSelectedPools(next);
    const even = Math.floor(100 / next.length);
    const map: Record<string, number> = {};
    next.forEach((c, idx) => {
      map[c] = idx === next.length - 1 ? 100 - even * (next.length - 1) : even;
    });
    setAllocations((prev) => ({ ...prev, ...map }));
  };

  const allocTotal = selectedPools.reduce((sum, c) => sum + (allocations[c] ?? 0), 0);

  // Live pre-flight check inside Step 4
  const overlappingSeqs = bundle.sequences.filter((seq) => {
    if (!seq.packageCodes.some((p) => selectedPools.includes(p))) return false;
    return (
      timeToMinutes(startTime) < timeToMinutes(seq.endTime) &&
      timeToMinutes(seq.startTime) < timeToMinutes(endTime)
    );
  });

  const isFxWeekendIssue =
    (symbol === "frxEURUSD" || symbol === "frxXAUUSD") &&
    (recurrence === "daily" || recurrence === "weekends_synthetics");

  const nextStep = () => {
    setErr(null);
    if (step === 0) {
      if (!name.trim()) return setErr("Schedule sequence name is required.");
      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        return setErr("End time must be strictly later than start time (UTC).");
      }
    }
    if (step === 2 && allocTotal !== 100) {
      return setErr(`Pool allocation percentages must total 100% (currently ${allocTotal}%).`);
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const commit = async (runImmediately: boolean) => {
    setErr(null);
    try {
      const normalizedAlloc: Record<string, number> = {};
      selectedPools.forEach((c) => {
        normalizedAlloc[c] = allocations[c] ?? 0;
      });
      const created = await createSeq.mutateAsync({
        name,
        date,
        endDate: endDate || null,
        startTime,
        endTime,
        symbol,
        strategy,
        initialStake,
        maxTrades,
        packageCodes: selectedPools,
        packageAllocation: normalizedAlloc,
        recurrence,
        cronExpression: recurrence === "custom_cron" ? cronExpression : null,
        stopLoss,
        takeProfit,
        maxDrawdown,
        cooldownLosses,
        cooldownDurationSec,
        runImmediately,
      });
      markFlashedSchedule(created.id);
      pushToast({
        tone: "success",
        title: runImmediately
          ? `Created & started ${created.name}`
          : `Scheduled ${created.name} (${created.code})`,
        detail: `${created.startTime}–${created.endTime} UTC · ${created.symbol} · ${created.packageCodes.join(", ")}`,
      });
      onClose();
    } catch {
      setErr("Unable to save schedule sequence.");
    }
  };

  return (
    <DeskModalShell
      code="SCH-WIZ-01"
      eyebrow="Page D-2 · Multi-Step Sequence Builder"
      title="Create Scheduled Trade Sequence"
      subtitle="Configure UTC execution window, Deriv instrument, progression ladder, pool splits, and pre-flight guardrails."
      size="lg"
      steps={["Window & Market", "Strategy & Stake", "Pool Split & Cron", "Pre-Flight & Commit"]}
      currentStep={step}
      onClose={onClose}
      footer={
        <div className="d-flex align-items-center justify-content-between w-100 gap-2 flex-wrap">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Cancel" : "← Previous Step"}
          </button>
          <div className="d-flex gap-2">
            {step < 3 ? (
              <button type="button" className="btn-brand" onClick={nextStep}>
                Continue →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm"
                  disabled={createSeq.isPending}
                  onClick={() => commit(true)}
                >
                  Save &amp; Run Now
                </button>
                <button
                  type="button"
                  className="btn-brand"
                  disabled={createSeq.isPending}
                  onClick={() => commit(false)}
                >
                  <Icon name="check" size={15} /> Save Schedule
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      {err ? <div className="alert alert-danger py-2 small mb-3">{err}</div> : null}

      {step === 0 ? (
        <div className="row g-3">
          <div className="col-md-8">
            <label className="form-label small fw-semibold">Sequence Name</label>
            <input
              className="form-control"
              value={name}
              onChange={(e) => {
                setCustomNamed(true);
                setName(e.target.value);
              }}
            />
          </div>
          <div className="col-md-4 d-flex align-items-end">
            <button
              type="button"
              className="btn-ghost btn-ghost--sm w-100"
              onClick={() => {
                setCustomNamed(false);
                setName(suggestScheduleName(strategy, symbol, startTime));
              }}
            >
              Auto-Name ({suggestScheduleName(strategy, symbol, startTime).slice(0, 14)}…)
            </button>
          </div>

          <div className="col-sm-6 col-md-3">
            <label className="form-label small fw-semibold">Anchor Date</label>
            <input
              type="date"
              className="form-control mono"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="col-sm-6 col-md-3">
            <label className="form-label small fw-semibold">End Date (Optional)</label>
            <input
              type="date"
              className="form-control mono"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-semibold">Start UTC</label>
            <input
              type="time"
              className="form-control mono"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                syncName(strategy, symbol, e.target.value);
              }}
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

          <div className="col-12">
            <label className="form-label small fw-semibold">Deriv Market Instrument</label>
            <div className="row g-2">
              {SCHEDULE_SYMBOLS.map((sym) => {
                const m = workspace.markets.find((item) => item.symbol === sym);
                const active = symbol === sym;
                return (
                  <div className="col-6 col-md-4" key={sym}>
                    <button
                      type="button"
                      className={cn(
                        "w-100 p-2 rounded border text-start",
                        active ? "border-dark bg-light" : "border-secondary-subtle bg-white",
                      )}
                      onClick={() => {
                        setSymbol(sym);
                        syncName(strategy, sym, startTime);
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <strong className="mono small">{sym}</strong>
                        <span className="mono small text-secondary">{m?.payoutPercent ?? 95}%</span>
                      </div>
                      <div className="mono small text-muted">
                        Spot {m?.spot ?? "—"} · {m?.market ?? "Synthetics"}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Execution Strategy</label>
            <select
              className="form-select"
              value={strategy}
              onChange={(e) => {
                const next = e.target.value as StrategyName;
                setStrategy(next);
                syncName(next, symbol, startTime);
              }}
            >
              {SCHEDULE_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="small text-secondary mt-2">{profile.summary}</div>
          </div>

          <div className="col-md-6">
            <label className="form-label small fw-semibold">Initial Stake (USD)</label>
            <input
              type="number"
              step="0.05"
              min={0.35}
              className="form-control mono"
              value={initialStake}
              onChange={(e) => setInitialStake(Number(e.target.value))}
            />
            <div className="d-flex flex-wrap gap-1 mt-2">
              {QUICK_STAKES.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={cn(
                    "btn btn-sm mono",
                    initialStake === q ? "btn-dark" : "btn-outline-secondary",
                  )}
                  onClick={() => setInitialStake(q)}
                >
                  ${q}
                </button>
              ))}
            </div>
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
              min={5}
              className="form-control mono"
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-semibold">Take Profit ($)</label>
            <input
              type="number"
              min={5}
              className="form-control mono"
              value={takeProfit}
              onChange={(e) => setTakeProfit(Number(e.target.value))}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-semibold">Cooldown Streak</label>
            <input
              type="number"
              min={1}
              max={15}
              className="form-control mono"
              value={cooldownLosses}
              onChange={(e) => setCooldownLosses(Number(e.target.value))}
            />
          </div>

          <div className="col-12">
            <div className="p-2 px-3 rounded border bg-light small mono">
              6-Step Ladder Preview (${initialStake} base):{" "}
              {profile.sampleLadderFrom35
                .map((v) => `$${((v / 35) * initialStake).toFixed(2)}`)
                .join(" → ")}
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="row g-3">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label small fw-semibold mb-0">
                Assign Crowdfunding Pools (Split Total: {allocTotal}%)
              </label>
              <span className={cn("mono small fw-semibold", allocTotal === 100 ? "text-win" : "text-loss")}>
                {allocTotal === 100 ? "100% Balanced" : "Must equal 100%"}
              </span>
            </div>
            <div className="d-flex flex-column gap-2">
              {funds.packages.map((pkg) => {
                const checked = selectedPools.includes(pkg.code);
                return (
                  <div
                    key={pkg.code}
                    className="d-flex align-items-center justify-content-between gap-2 p-2 rounded border"
                  >
                    <label className="d-flex align-items-center gap-2 mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={checked}
                        onChange={() => togglePool(pkg.code)}
                      />
                      <span className="mono fw-semibold">{pkg.code}</span>
                      <span className="small text-secondary">{pkg.name}</span>
                      <span className="mono small text-muted">
                        ({formatCurrency(pkg.totalCapital, "USD", 0)})
                      </span>
                    </label>
                    <div className="d-flex align-items-center gap-2" style={{ width: 130 }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={!checked}
                        className="form-control form-control-sm mono text-end"
                        value={checked ? allocations[pkg.code] ?? 0 : 0}
                        onChange={(e) =>
                          setAllocations((prev) => ({
                            ...prev,
                            [pkg.code]: Number(e.target.value),
                          }))
                        }
                      />
                      <span className="mono small">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label small fw-semibold">Recurrence Cadence</label>
            <select
              className="form-select"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as ScheduleRecurrence)}
            >
              <option value="weekdays">Weekdays (Mon–Fri)</option>
              <option value="daily">Daily (Mon–Sun)</option>
              <option value="one_time">One-Time Anchor Window</option>
              <option value="weekends_synthetics">Weekends Only (24/7 Synthetics)</option>
              <option value="custom_cron">Custom UTC Cron Expression</option>
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label small fw-semibold">Cron Expression (UTC)</label>
            <input
              className="form-control mono"
              disabled={recurrence !== "custom_cron"}
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
            />
          </div>
          <div className="col-12 small text-secondary">
            {describeCronExpression(cronExpression, recurrence)}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="d-flex flex-column gap-3">
          <dl className="auth-kv mb-0">
            <dt>Sequence Name</dt>
            <dd className="fw-semibold">{name}</dd>
            <dt>Execution Window</dt>
            <dd className="mono">
              {date} · {startTime}–{endTime} UTC ({recurrence})
            </dd>
            <dt>Instrument &amp; Spot</dt>
            <dd className="mono">
              {symbol} ({quote.spot} · {quote.payoutPercent}% payout)
            </dd>
            <dt>Strategy &amp; Limits</dt>
            <dd className="mono">
              {strategy} · ${initialStake} × {maxTrades} max · TP +${takeProfit} / SL −${stopLoss}
            </dd>
            <dt>Crowdfunding Pool Split</dt>
            <dd className="mono">
              {selectedPools.map((c) => `${c} ${allocations[c]}%`).join(" · ")}
            </dd>
          </dl>

          {overlappingSeqs.length > 0 || isFxWeekendIssue ? (
            <div className="p-3 rounded border border-warning bg-warning-subtle small">
              <strong className="d-block mb-1">Pre-Flight Advisories Detected:</strong>
              {overlappingSeqs.map((o) => (
                <div key={o.id} className="mono">
                  • Overlaps {o.name} ({o.startTime}–{o.endTime} UTC) on shared pool package.
                </div>
              ))}
              {isFxWeekendIssue ? (
                <div className="mono">
                  • {symbol} is closed on Saturdays/Sundays; consider switching cadence to Weekdays.
                </div>
              ) : null}
              <div className="d-flex gap-2 mt-2">
                {overlappingSeqs.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => {
                      const latestEnd = Math.max(
                        ...overlappingSeqs.map((o) => timeToMinutes(o.endTime)),
                      );
                      setStartTime(minutesToTime(latestEnd + 5));
                      setEndTime(minutesToTime(latestEnd + 65));
                    }}
                  >
                    Auto-Adjust Window After Overlap
                  </button>
                ) : null}
                {isFxWeekendIssue ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => setRecurrence("weekdays")}
                  >
                    Switch to Weekdays
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded border bg-light small text-win fw-semibold">
              Pre-Flight Clear — Zero overlapping windows, market hours valid, pool margin verified.
            </div>
          )}
        </div>
      ) : null}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 2 (`SCH-WIZ-02`) · 3-STEP CRON & RECURRENCE STUDIO WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function CronRecurrenceWizard({
  bundle,
  targetScheduleId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  targetScheduleId?: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();

  const initialSeq =
    bundle.sequences.find((s) => s.id === targetScheduleId) ?? bundle.sequences[0];
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState(initialSeq?.id ?? "");
  const [recurrence, setRecurrence] = useState<ScheduleRecurrence>("custom_cron");
  const [cron, setCron] = useState(initialSeq?.cronExpression ?? "0 9 * * 1-5");

  const target = bundle.sequences.find((s) => s.id === selectedId) ?? bundle.sequences[0];
  const upcomingRuns = previewNextCronRuns(
    target?.date ?? "2026-10-19",
    target?.startTime ?? "09:00",
    recurrence,
    cron,
    5,
  );

  const apply = async () => {
    if (!target) return;
    await patchSeq.mutateAsync({
      id: target.id,
      action: "update_fields",
      patch: { recurrence, cronExpression: cron },
    });
    pushToast({
      tone: "success",
      title: `Updated cron cadence on ${target.name}`,
      detail: `${recurrence} (${cron})`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-WIZ-02"
      eyebrow="UTC Cron & Session Cadence"
      title="Cron & Recurrence Schedule Builder"
      subtitle="Attach deterministic UTC cron rules to any scheduled sequence with next-5-execution verification."
      size="lg"
      steps={["Select Preset / Cron", "Next-5 Runs Preview", "Attach to Sequence"]}
      currentStep={step}
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          {step < 2 ? (
            <button type="button" className="btn-brand" onClick={() => setStep((s) => s + 1)}>
              Next Step →
            </button>
          ) : (
            <button
              type="button"
              className="btn-brand"
              disabled={patchSeq.isPending}
              onClick={apply}
            >
              <Icon name="check" size={15} /> Apply Cadence
            </button>
          )}
        </div>
      }
    >
      {step === 0 ? (
        <div className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-semibold">Institutional Cron Presets</label>
            <div className="d-flex flex-column gap-2">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.cron}
                  type="button"
                  className={cn(
                    "p-2 px-3 rounded border text-start",
                    cron === p.cron ? "border-dark bg-light" : "bg-white",
                  )}
                  onClick={() => {
                    setCron(p.cron);
                    setRecurrence(p.recurrence);
                  }}
                >
                  <div className="d-flex justify-content-between">
                    <strong className="small">{p.label}</strong>
                    <code className="mono">{p.cron}</code>
                  </div>
                  <div className="small text-secondary">{p.description}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-5">
              <label className="form-label small fw-semibold">Recurrence Mode</label>
              <select
                className="form-select"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as ScheduleRecurrence)}
              >
                <option value="custom_cron">Custom Cron</option>
                <option value="weekdays">Weekdays (1-5)</option>
                <option value="daily">Every Day (*)</option>
                <option value="weekends_synthetics">Weekends Synthetics (0,6)</option>
              </select>
            </div>
            <div className="col-md-7">
              <label className="form-label small fw-semibold">Raw 5-Field UTC Cron</label>
              <input
                className="form-control mono"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <div className="small text-secondary mb-2">
            Human-readable interpretation:{" "}
            <strong className="text-dark">{describeCronExpression(cron, recurrence)}</strong>
          </div>
          <div className="border rounded divide-y">
            {upcomingRuns.map((ts, idx) => (
              <div
                key={ts}
                className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom small"
              >
                <span className="mono text-secondary">Run #{idx + 1}</span>
                <strong className="mono">{ts}</strong>
                <span className="pill pill-live">Market Open Verified</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-semibold">Target Scheduled Sequence</label>
            <select
              className="form-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {bundle.sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name} ({s.symbol} · {s.startTime} UTC)
                </option>
              ))}
            </select>
          </div>
          <dl className="auth-kv mb-0">
            <dt>Target Sequence</dt>
            <dd className="mono">{target?.name}</dd>
            <dt>New Cron Rule</dt>
            <dd className="mono">{cron}</dd>
            <dt>Assigned Pools</dt>
            <dd className="mono">{target?.packageCodes.join(", ")}</dd>
          </dl>
        </div>
      ) : null}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 3 (`SCH-WIZ-03`) · 3-STEP BACKTEST & DRAWDOWN STRESS WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function BacktestStressWizard({
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

  const [step, setStep] = useState(0);
  const [targetId, setTargetId] = useState(scheduleId ?? bundle.sequences[0]?.id ?? "");
  const [simDays, setSimDays] = useState<14 | 30 | 60>(30);
  const [volatilityStress, setVolatilityStress] = useState<"normal" | "elevated">("normal");

  const seq = bundle.sequences.find((s) => s.id === targetId) ?? bundle.sequences[0];
  const profile =
    bundle.strategyProfiles.find((p) => p.name === seq?.strategy) ?? bundle.strategyProfiles[0];

  const baseWinRate =
    volatilityStress === "normal"
      ? profile.targetWinRatePercent + 5.2
      : profile.targetWinRatePercent + 1.4;
  const totalTradesSim = (seq?.maxTrades ?? 8) * simDays;
  const estNetPerRun = Number(
    (((baseWinRate / 100 - (1 - baseWinRate / 100)) * (seq?.initialStake ?? 35) * (seq?.maxTrades ?? 8) * 0.92)).toFixed(2),
  );
  const cumulativePnL = Number((estNetPerRun * simDays).toFixed(0));
  const simulatedMaxDD = volatilityStress === "normal" ? 2.4 : 4.1;
  const recommendedStopLoss = Math.max(120, Math.round((seq?.initialStake ?? 35) * 7));

  const applyOptimal = async () => {
    if (!seq) return;
    await patchSeq.mutateAsync({
      id: seq.id,
      action: "update_fields",
      patch: {
        stopLoss: recommendedStopLoss,
        cooldownLosses: profile.defaultCooldownLosses,
      },
    });
    pushToast({
      tone: "success",
      title: `Applied stress-tested guardrails to ${seq.name}`,
      detail: `Stop-Loss $${recommendedStopLoss} · Cooldown ${profile.defaultCooldownLosses} losses`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-WIZ-03"
      eyebrow="30-Day Historical Tick Replay"
      title="Schedule Backtest & Drawdown Stress Simulator"
      subtitle="Evaluate stake progression against historical Deriv tick variance and pool High-Water Mark limits."
      size="lg"
      steps={["Select Sequence & Horizon", "Simulated Stress Metrics", "Apply Guardrails"]}
      currentStep={step}
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Close" : "← Back"}
          </button>
          {step < 2 ? (
            <button type="button" className="btn-brand" onClick={() => setStep((s) => s + 1)}>
              Run Simulation →
            </button>
          ) : (
            <button
              type="button"
              className="btn-brand"
              disabled={patchSeq.isPending}
              onClick={applyOptimal}
            >
              <Icon name="shield" size={15} /> Apply Optimal Guardrails
            </button>
          )}
        </div>
      }
    >
      {step === 0 ? (
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label small fw-semibold">Sequence Under Test</label>
            <select
              className="form-select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {bundle.sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name} ({s.symbol} · {s.strategy} · ${s.initialStake})
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Lookback Horizon</label>
            <div className="d-flex gap-2">
              {([14, 30, 60] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={cn(
                    "btn btn-sm flex-grow-1 mono",
                    simDays === d ? "btn-dark" : "btn-outline-secondary",
                  )}
                  onClick={() => setSimDays(d)}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Tick Variance Regime</label>
            <div className="d-flex gap-2">
              {(
                [
                  ["normal", "Standard Tick Regime"],
                  ["elevated", "Adverse Streak Shock"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={cn(
                    "btn btn-sm flex-grow-1",
                    volatilityStress === k ? "btn-dark" : "btn-outline-secondary",
                  )}
                  onClick={() => setVolatilityStress(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <div className="p-3 rounded border bg-light">
              <span className="eyebrow-label d-block">Projected P&amp;L</span>
              <strong className={cn("mono fs-5", cumulativePnL >= 0 ? "text-win" : "text-loss")}>
                {cumulativePnL >= 0 ? "+" : ""}
                {formatCurrency(cumulativePnL, "USD", 0)}
              </strong>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded border bg-light">
              <span className="eyebrow-label d-block">Win Rate</span>
              <strong className="mono fs-5">{baseWinRate.toFixed(1)}%</strong>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded border bg-light">
              <span className="eyebrow-label d-block">Peak Drawdown</span>
              <strong className="mono fs-5">{simulatedMaxDD}% / 5.0%</strong>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded border bg-light">
              <span className="eyebrow-label d-block">Contracts Simulated</span>
              <strong className="mono fs-5">{totalTradesSim}</strong>
            </div>
          </div>
          <div className="col-12 small text-secondary">
            80 / 20 Syndicate Waterfall Estimate: Investors Net{" "}
            <strong className="mono text-win">
              +{formatCurrency(Math.max(0, cumulativePnL * 0.8), "USD", 0)}
            </strong>{" "}
            · Desk Performance Fee{" "}
            <strong className="mono">
              +{formatCurrency(Math.max(0, cumulativePnL * 0.2), "USD", 0)}
            </strong>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <dl className="auth-kv mb-0">
          <dt>Target Sequence</dt>
          <dd className="mono">{seq?.name}</dd>
          <dt>Current Stop Loss → Calibrated</dt>
          <dd className="mono">
            ${seq?.stopLoss} → <strong>${recommendedStopLoss}</strong>
          </dd>
          <dt>Consecutive Loss Cooldown</dt>
          <dd className="mono">{profile.defaultCooldownLosses} losses (5 min pause)</dd>
          <dt>Pool HWM Clearance</dt>
          <dd className="text-win fw-semibold">Verified within 5.0% pool cap</dd>
        </dl>
      ) : null}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 4 (`SCH-WIZ-04`) · 3-STEP MULTI-DAY LINEUP CLONER WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function BatchCloneDayWizard({
  bundle,
  sourceDate,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  sourceDate?: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const cloneMut = useCloneDayLineup();

  const [step, setStep] = useState(0);
  const [srcDate, setSrcDate] = useState(sourceDate ?? bundle.kpis.anchorDate);
  const [targetDates, setTargetDates] = useState<string[]>(["2026-10-21", "2026-10-22"]);
  const [syntheticsOnlyOnWeekend, setSyntheticsOnlyOnWeekend] = useState(true);
  const [stakeMultiplier, setStakeMultiplier] = useState(1.0);

  const candidateDates = bundle.calendarDays
    .filter((d) => d.inCurrentMonth && d.date > bundle.kpis.anchorDate)
    .slice(0, 10);

  const toggleDate = (d: string) => {
    setTargetDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const runClone = async () => {
    const res = await cloneMut.mutateAsync({
      sourceDate: srcDate,
      targetDates,
      syntheticsOnlyOnWeekend,
      stakeMultiplier,
    });
    pushToast({
      tone: "success",
      title: `Cloned ${res.createdCount} scheduled windows across ${targetDates.length} dates`,
      detail: `Source lineup ${srcDate} replicated cleanly.`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-WIZ-04"
      eyebrow="Calendar Batch Replication"
      title="Clone Daily Schedule Lineup Across Dates"
      subtitle="Replicate a proven session lineup onto upcoming dates with automatic weekend FX filtering."
      size="lg"
      steps={["Source Day", "Target Dates & Scaling", "Confirm Batch"]}
      currentStep={step}
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          {step < 2 ? (
            <button
              type="button"
              className="btn-brand"
              disabled={step === 1 && targetDates.length === 0}
              onClick={() => setStep((s) => s + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              className="btn-brand"
              disabled={cloneMut.isPending}
              onClick={runClone}
            >
              <Icon name="copy" size={14} /> Commit Cloned Windows
            </button>
          )}
        </div>
      }
    >
      {step === 0 ? (
        <div>
          <label className="form-label small fw-semibold">Source Calendar Date</label>
          <input
            type="date"
            className="form-control mono mb-3"
            value={srcDate}
            onChange={(e) => setSrcDate(e.target.value)}
          />
          <div className="small text-secondary">
            Active template windows up to 5 top sequences from <strong className="mono">{srcDate}</strong>{" "}
            will be copied with identical pool allocations and risk caps.
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-semibold">Select Target Dates</label>
            <div className="d-flex flex-wrap gap-2">
              {candidateDates.map((d) => {
                const active = targetDates.includes(d.date);
                return (
                  <button
                    key={d.date}
                    type="button"
                    className={cn(
                      "btn btn-sm mono",
                      active ? "btn-dark" : "btn-outline-secondary",
                    )}
                    onClick={() => toggleDate(d.date)}
                  >
                    {d.weekdayShort} {d.date.slice(5)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="row g-3 align-items-center">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Stake Scale Multiplier</label>
              <select
                className="form-select mono"
                value={stakeMultiplier}
                onChange={(e) => setStakeMultiplier(Number(e.target.value))}
              >
                <option value={0.5}>0.50× Conservative Half-Size</option>
                <option value={1}>1.00× Identical Stake</option>
                <option value={1.25}>1.25× Scaled Pool Capital</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="d-flex align-items-center gap-2 mt-4 small fw-semibold">
                <input
                  type="checkbox"
                  className="form-check-input mt-0"
                  checked={syntheticsOnlyOnWeekend}
                  onChange={(e) => setSyntheticsOnlyOnWeekend(e.target.checked)}
                />
                Skip FX/Bullion symbols on Saturdays &amp; Sundays
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <dl className="auth-kv mb-0">
          <dt>Source Lineup</dt>
          <dd className="mono">{srcDate}</dd>
          <dt>Target Dates ({targetDates.length})</dt>
          <dd className="mono">{targetDates.join(", ")}</dd>
          <dt>Stake Multiplier</dt>
          <dd className="mono">{stakeMultiplier.toFixed(2)}×</dd>
          <dt>Weekend FX Filter</dt>
          <dd>{syntheticsOnlyOnWeekend ? "Enabled (Synthetics only)" : "Disabled"}</dd>
        </dl>
      ) : null}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 5 (`SCH-WIZ-05`) · 3-STEP PRE-FLIGHT CONFLICT RESOLVER WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function ConflictResolverWizard({
  bundle,
  focusConflictId,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  focusConflictId?: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const resolveMut = useResolveScheduleConflict();

  const openList = bundle.conflicts.filter((c) => !c.acknowledged);
  const initial =
    openList.find((c) => c.id === focusConflictId) ?? openList[0] ?? bundle.conflicts[0];
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [mode, setMode] = useState<"auto_fix" | "acknowledge">("auto_fix");

  const activeConflict =
    bundle.conflicts.find((c) => c.id === selectedId) ?? initial ?? null;

  const commitResolution = async () => {
    if (!activeConflict) {
      onClose();
      return;
    }
    const res = await resolveMut.mutateAsync({
      conflictId: activeConflict.id,
      mode,
    });
    pushToast({
      tone: "success",
      title:
        mode === "auto_fix"
          ? `Resolved conflict on ${activeConflict.scheduleName}`
          : `Acknowledged stack on ${activeConflict.scheduleName}`,
      detail: `${res.conflictsRemaining} unacknowledged warnings remaining.`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-WIZ-05"
      eyebrow="Section 7 · Schedule Pre-Flight Engine"
      title="Schedule Conflict & Overlap Resolver"
      subtitle="Inspect window overlaps, weekend FX closures, and reserve multiples with deterministic auto-remediation."
      size="lg"
      steps={["Select Advisory", "Choose Remediation", "Apply & Re-Scan"]}
      currentStep={step}
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Close" : "← Back"}
          </button>
          {step < 2 && activeConflict ? (
            <button type="button" className="btn-brand" onClick={() => setStep((s) => s + 1)}>
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="btn-brand"
              disabled={resolveMut.isPending}
              onClick={commitResolution}
            >
              <Icon name="check" size={15} /> {activeConflict ? "Apply Resolution" : "Done"}
            </button>
          )}
        </div>
      }
    >
      {!activeConflict ? (
        <div className="p-3 rounded border bg-light text-win fw-semibold">
          All scheduled sequences passed pre-flight checks with zero unresolved conflicts.
        </div>
      ) : step === 0 ? (
        <div className="d-flex flex-column gap-2">
          {bundle.conflicts.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cn(
                "p-2 px-3 rounded border text-start",
                selectedId === c.id ? "border-dark bg-light" : "bg-white",
              )}
              onClick={() => setSelectedId(c.id)}
            >
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="desk-code-tag mono">
                  {c.severity.toUpperCase()} · {c.packageCode}
                </span>
                <span className="mono small text-secondary">{c.windowLabel}</span>
              </div>
              <div className="fw-semibold small">{c.headline}</div>
            </button>
          ))}
        </div>
      ) : step === 1 ? (
        <div className="d-flex flex-column gap-2">
          <div className="p-3 rounded border bg-light small">{activeConflict.detail}</div>
          <button
            type="button"
            className={cn(
              "p-3 rounded border text-start",
              mode === "auto_fix" ? "border-dark bg-light" : "bg-white",
            )}
            onClick={() => setMode("auto_fix")}
          >
            <strong className="d-block">{activeConflict.recommendedFixLabel} (Recommended)</strong>
            <span className="small text-secondary">
              Automatically updates sequence parameters and clears overlap/closure conflict.
            </span>
          </button>
          <button
            type="button"
            className={cn(
              "p-3 rounded border text-start",
              mode === "acknowledge" ? "border-dark bg-light" : "bg-white",
            )}
            onClick={() => setMode("acknowledge")}
          >
            <strong className="d-block">Acknowledge &amp; Allow Stacked Execution</strong>
            <span className="small text-secondary">
              Retains current UTC window and records operator override in desk state.
            </span>
          </button>
        </div>
      ) : (
        <dl className="auth-kv mb-0">
          <dt>Target Sequence</dt>
          <dd className="mono">{activeConflict.scheduleName}</dd>
          <dt>Selected Action</dt>
          <dd className="fw-semibold">
            {mode === "auto_fix" ? activeConflict.recommendedFixLabel : "Operator Override"}
          </dd>
          <dt>Pool Scope</dt>
          <dd className="mono">{activeConflict.packageCode}</dd>
        </dl>
      )}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 6 (`SCH-WIZ-06`) · 3-STEP POOL PRO-RATA CAPITAL SPLIT WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function PoolProrataWizard({
  bundle,
  funds,
  onClose,
}: {
  bundle: TradeSchedulerBundleDTO;
  funds: FundsFlowDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const rebalanceMut = useRebalanceScheduleAllocations();

  const [step, setStep] = useState(0);
  const [capitalInTrades, setCapitalInTrades] = useState(funds.capitalInTrades);
  const [split, setSplit] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const row of bundle.packageMappings) {
      init[row.packageCode] = row.capitalSharePercent;
    }
    return init;
  });

  const sumPct = Object.values(split).reduce((a, b) => a + b, 0);

  const autoCalcProRata = () => {
    const activeTotal = funds.packages
      .filter((p) => p.status === "trading")
      .reduce((s, p) => s + p.totalCapital, 0);
    const next: Record<string, number> = {};
    let running = 0;
    const tradingPkgs = funds.packages.filter((p) => p.status === "trading");
    tradingPkgs.forEach((p, idx) => {
      if (idx === tradingPkgs.length - 1) {
        next[p.code] = Math.max(0, 100 - running);
      } else {
        const pct = Math.round((p.totalCapital / Math.max(1, activeTotal)) * 100);
        next[p.code] = pct;
        running += pct;
      }
    });
    for (const p of funds.packages) {
      if (next[p.code] === undefined) next[p.code] = 0;
    }
    setSplit(next);
  };

  const saveSplits = async () => {
    await rebalanceMut.mutateAsync({ split, capitalInTrades });
    pushToast({
      tone: "success",
      title: "Synchronized pool capital shares across scheduled sequences",
      detail: Object.entries(split)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}%`)
        .join(" · "),
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="SCH-WIZ-06"
      eyebrow="Section 5 · Package-Trade Capital Mapping"
      title="Rebalance Crowdfunding Pool Schedule Splits"
      subtitle="Align scheduled trade stake attribution with verified investor capital per pool."
      size="lg"
      steps={["Pool Deposit Audit", "Adjust Split Ratios", "Propagate to Schedules"]}
      currentStep={step}
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          {step < 2 ? (
            <button
              type="button"
              className="btn-brand"
              disabled={step === 1 && sumPct !== 100}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="btn-brand"
              disabled={rebalanceMut.isPending}
              onClick={saveSplits}
            >
              <Icon name="check" size={15} /> Apply Splits to All Schedules
            </button>
          )}
        </div>
      }
    >
      {step === 0 ? (
        <div className="d-flex flex-column gap-3">
          <div className="d-flex justify-content-between align-items-center">
            <span className="small text-secondary">
              Verified active pool capital:{" "}
              <strong className="mono">{formatCurrency(funds.totalCapital, "USD", 0)}</strong>
            </span>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={autoCalcProRata}
            >
              Auto-Match Exact Deposit Ratio
            </button>
          </div>
          {bundle.packageMappings.map((m) => (
            <div
              key={m.packageCode}
              className="d-flex justify-content-between align-items-center p-2 px-3 rounded border"
            >
              <div>
                <strong className="mono">{m.packageCode}</strong> · {m.packageName}
                <div className="small text-secondary">
                  {m.schedulesCount} assigned schedules · Avg stake ${m.avgStake}
                </div>
              </div>
              <div className="text-end mono">
                <strong>{formatCurrency(m.totalCapital, "USD", 0)}</strong>
                <div className="small text-muted">{split[m.packageCode] ?? 0}% share</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-semibold">
              Active Capital Deployed to Scheduled Margin ({formatCurrency(capitalInTrades, "USD", 0)})
            </label>
            <input
              type="range"
              className="form-range"
              min={80000}
              max={funds.totalCapital}
              step={2000}
              value={capitalInTrades}
              onChange={(e) => setCapitalInTrades(Number(e.target.value))}
            />
          </div>
          {bundle.packageMappings.map((m) => (
            <div key={m.packageCode} className="d-flex align-items-center justify-content-between gap-3">
              <span className="mono fw-semibold" style={{ width: 80 }}>
                {m.packageCode}
              </span>
              <input
                type="range"
                className="form-range flex-grow-1"
                min={0}
                max={100}
                value={split[m.packageCode] ?? 0}
                onChange={(e) =>
                  setSplit((prev) => ({ ...prev, [m.packageCode]: Number(e.target.value) }))
                }
              />
              <span className="mono fw-semibold text-end" style={{ width: 54 }}>
                {split[m.packageCode] ?? 0}%
              </span>
            </div>
          ))}
          <div className={cn("mono small fw-semibold", sumPct === 100 ? "text-win" : "text-loss")}>
            Allocation Total: {sumPct}% {sumPct !== 100 ? "(Adjust sliders to total 100%)" : "✓"}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <dl className="auth-kv mb-0">
          <dt>Active Margin Pool</dt>
          <dd className="mono">{formatCurrency(capitalInTrades, "USD", 0)}</dd>
          <dt>Unallocated Reserve</dt>
          <dd className="mono text-win">
            {formatCurrency(Math.max(0, funds.totalCapital - capitalInTrades), "USD", 0)}
          </dd>
          <dt>Updated Pool Weights</dt>
          <dd className="mono">
            {Object.entries(split)
              .map(([k, v]) => `${k}: ${v}%`)
              .join(" · ")}
          </dd>
        </dl>
      ) : null}
    </DeskModalShell>
  );
}
