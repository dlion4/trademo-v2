"use client";

import { useState } from "react";

import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type {
  ContractTypeCode,
  DerivSymbol,
  FundsFlowDTO,
  OperatorWorkspaceDTO,
  ProfitDistributionDTO,
  StrategyName,
} from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";
import {
  useCreatePackage,
  useCreateSchedule,
  useDistributePending,
  useProcessPayouts,
  useUpdateBot,
} from "@/lib/queries/use-dashboard";

const ALL_SYMBOLS: DerivSymbol[] = [
  "R_10",
  "R_25",
  "R_50",
  "R_75",
  "R_100",
  "1HZ10V",
  "frxEURUSD",
  "frxXAUUSD",
  "cryBTCUSD",
];

const ALL_STRATEGIES: StrategyName[] = [
  "Martingale",
  "Even/Odd",
  "DCA",
  "Oscar's Grind",
  "Fixed Stake",
  "Anti-Martingale",
  "Fibonacci",
];

void ({} as ContractTypeCode);

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 1 · 4-STEP NEW CROWDFUNDING PACKAGE WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function NewPackageWizard({
  existingCount,
  onClose,
}: {
  existingCount: number;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const createPkg = useCreatePackage();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState(`PKG-0${existingCount + 1}`);
  const [name, setName] = useState("Q4 Institutional Vol-Parity Pool");
  const [slotPrice, setSlotPrice] = useState(2000);
  const [totalSlots, setTotalSlots] = useState(30);
  const [markets, setMarkets] = useState<DerivSymbol[]>(["R_10", "R_75", "frxEURUSD"]);
  const [strategies, setStrategies] = useState<StrategyName[]>(["Martingale", "DCA"]);
  const [tradingDays, setTradingDays] = useState(14);
  const [bookingDays, setBookingDays] = useState(4);
  const [expectedROI, setExpectedROI] = useState(14);
  const [operatorSharePercent, setOperatorSharePercent] = useState(20);
  const [maxDrawdown, setMaxDrawdown] = useState(5.0);
  const [err, setErr] = useState<string | null>(null);

  const targetCapital = slotPrice * totalSlots;
  const estGross = (targetCapital * expectedROI) / 100;
  const estOpFee = (estGross * operatorSharePercent) / 100;
  const estInvNet = estGross - estOpFee;

  const toggleArr = <T,>(arr: T[], item: T, set: (v: T[]) => void) => {
    set(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const next = () => {
    setErr(null);
    if (step === 0) {
      if (!code.trim() || !name.trim()) return setErr("Package code and name are required.");
      if (markets.length === 0) return setErr("Select at least one trading symbol.");
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const publish = async () => {
    try {
      const created = await createPkg.mutateAsync({
        code,
        name,
        slotPrice,
        totalSlots,
        expectedROI,
        operatorSharePercent,
        maxDrawdown,
        tradingDays,
        markets,
        strategies: strategies.length ? strategies : ["Fixed Stake"],
      });
      pushToast({
        tone: "success",
        title: `Pool ${created.code} published`,
        detail: `${created.totalSlots} slots at ${formatCurrency(created.slotPrice, "USD", 0)} now open for investor booking.`,
      });
      onClose();
    } catch {
      setErr("Failed to publish package.");
    }
  };

  return (
    <DeskModalShell
      code="WIZ-PKG"
      eyebrow="Crowdfunding Syndicate Builder"
      title="Launch New Investor Pool Package"
      subtitle="Configure slot economics, execution markets, booking dates, and High-Water Mark guardrails."
      size="lg"
      steps={["Pool Identity", "Window & Term", "Fee & Drawdown", "Economics Review"]}
      currentStep={step}
      onClose={onClose}
      footer={
        <div className="d-flex align-items-center justify-content-between w-100 gap-2">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Cancel" : "← Previous"}
          </button>
          <div className="d-flex align-items-center gap-2">
            {step < 3 ? (
              <button type="button" className="btn-brand" onClick={next}>
                Continue <Icon name="arrowRight" size={15} />
              </button>
            ) : (
              <button
                type="button"
                className="btn-brand"
                disabled={createPkg.isPending}
                onClick={publish}
              >
                {createPkg.isPending ? "Publishing…" : `Publish ${code} (${formatCurrency(targetCapital, "USD", 0)})`}
              </button>
            )}
          </div>
        </div>
      }
    >
      {err ? <div className="desk-inline-alert is-error mb-3">{err}</div> : null}

      {step === 0 ? (
        <div className="row g-3">
          <div className="col-sm-4">
            <label className="desk-label">Package Code</label>
            <input
              className="form-control mono"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="col-sm-8">
            <label className="desk-label">Pool Title</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="col-sm-6">
            <label className="desk-label">Slot Price (USD)</label>
            <input
              type="number"
              min={250}
              step={250}
              className="form-control mono"
              value={slotPrice}
              onChange={(e) => setSlotPrice(Math.max(100, Number(e.target.value)))}
            />
          </div>
          <div className="col-sm-6">
            <label className="desk-label">Total Available Slots</label>
            <input
              type="number"
              min={5}
              max={500}
              className="form-control mono"
              value={totalSlots}
              onChange={(e) => setTotalSlots(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="col-12">
            <label className="desk-label">Permitted Deriv Instruments</label>
            <div className="desk-chip-grid">
              {ALL_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  className={cn("desk-chip mono", markets.includes(sym) && "is-selected")}
                  onClick={() => toggleArr(markets, sym, setMarkets)}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="row g-3">
          <div className="col-sm-6">
            <label className="desk-label">Investor Booking Window (Days)</label>
            <input
              type="number"
              min={1}
              max={14}
              className="form-control mono"
              value={bookingDays}
              onChange={(e) => setBookingDays(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="col-sm-6">
            <label className="desk-label">Active Trading Duration (Days)</label>
            <input
              type="number"
              min={5}
              max={90}
              className="form-control mono"
              value={tradingDays}
              onChange={(e) => setTradingDays(Math.max(3, Number(e.target.value)))}
            />
          </div>
          <div className="col-12">
            <label className="desk-label">Approved Execution Strategies</label>
            <div className="desk-chip-grid">
              {ALL_STRATEGIES.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={cn("desk-chip", strategies.includes(st) && "is-selected")}
                  onClick={() => toggleArr(strategies, st, setStrategies)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <div className="col-12">
            <div className="desk-kv-box">
              <div>
                <span>Target Pool Capital</span>
                <strong className="mono">{formatCurrency(targetCapital, "USD", 0)}</strong>
              </div>
              <div>
                <span>Settlement Cadence</span>
                <strong>T+0 Wallet Credit at Cycle Close</strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="row g-3">
          <div className="col-sm-4">
            <label className="desk-label">Target Cycle Gross ROI (%)</label>
            <input
              type="number"
              min={2}
              max={60}
              step={0.5}
              className="form-control mono"
              value={expectedROI}
              onChange={(e) => setExpectedROI(Number(e.target.value))}
            />
          </div>
          <div className="col-sm-4">
            <label className="desk-label">Operator Performance Cut (%)</label>
            <input
              type="number"
              min={5}
              max={40}
              className="form-control mono"
              value={operatorSharePercent}
              onChange={(e) => setOperatorSharePercent(Math.min(40, Math.max(5, Number(e.target.value))))}
            />
          </div>
          <div className="col-sm-4">
            <label className="desk-label">Hard Drawdown Halt (%)</label>
            <input
              type="number"
              min={1}
              max={15}
              step={0.5}
              className="form-control mono"
              value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(Number(e.target.value))}
            />
          </div>
          <div className="col-12">
            <div className="desk-note-strip">
              <Icon name="shield" size={16} />
              <span>
                High-Water Mark protection active: performance fee ({operatorSharePercent}%) is charged strictly on
                realized net gains. Investor share is {100 - operatorSharePercent}%.
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="desk-summary-grid">
          <dl className="auth-kv">
            <dt>Package Code & Name</dt>
            <dd>
              <span className="mono">{code}</span> · {name}
            </dd>
            <dt>Slot Structure</dt>
            <dd className="mono">
              {totalSlots} slots × {formatCurrency(slotPrice, "USD", 0)} = {formatCurrency(targetCapital, "USD", 0)}
            </dd>
            <dt>Schedule Window</dt>
            <dd className="mono">
              {bookingDays}d booking → {tradingDays}d live trading
            </dd>
            <dt>Projected Gross Profit (+{expectedROI}%)</dt>
            <dd className="mono text-win">+{formatCurrency(estGross)}</dd>
            <dt>Operator Share ({operatorSharePercent}%)</dt>
            <dd className="mono">{formatCurrency(estOpFee)}</dd>
            <dt>Net to Pool Investors ({100 - operatorSharePercent}%)</dt>
            <dd className="mono text-win">+{formatCurrency(estInvNet)}</dd>
          </dl>
        </div>
      ) : null}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 2 · 3-STEP TRADE SCHEDULE WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function ScheduleTradeWizard({
  defaultSymbol = "R_10",
  onClose,
}: {
  defaultSymbol?: DerivSymbol;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const createSch = useCreateSchedule();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Overlap Momentum Sequence");
  const [executeAt, setExecuteAt] = useState("16:30");
  const [windowEnd, setWindowEnd] = useState("17:10");
  const [recurrence, setRecurrence] = useState<"one_time" | "daily" | "weekdays" | "session_overlap">("daily");
  const [symbol, setSymbol] = useState<DerivSymbol>(defaultSymbol);
  const [strategy, setStrategy] = useState<StrategyName>("Martingale");
  const [stake, setStake] = useState(50);
  const [maxTrades, setMaxTrades] = useState(20);
  const [stopLoss, setStopLoss] = useState(300);
  const [takeProfit, setTakeProfit] = useState(500);
  const [split, setSplit] = useState<Record<string, number>>({ "PKG-01": 40, "PKG-02": 35, "PKG-03": 25 });

  const totalPct = Object.values(split).reduce((a, b) => a + b, 0);

  const submit = async () => {
    await createSch.mutateAsync({
      name,
      executeAt,
      windowEnd,
      symbol,
      strategy,
      stake,
      maxTrades,
      stopLoss,
      takeProfit,
      recurrence,
      packageCodes: Object.keys(split).filter((k) => split[k] > 0),
      allocationSplit: split,
    });
    pushToast({
      tone: "success",
      title: `Scheduled ${executeAt} UTC · ${symbol}`,
      detail: `${name} queued across ${Object.keys(split).join(", ")}.`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="WIZ-SCH"
      eyebrow="Automated Execution Scheduler"
      title="Schedule Pool Trade Sequence"
      subtitle="Queue timed Deriv executions routed proportionally across active investor packages."
      size="lg"
      steps={["Timing & Symbol", "Strategy & Stops", "Pool Split"]}
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
              Next Step <Icon name="arrowRight" size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-brand"
              disabled={totalPct !== 100 || createSch.isPending}
              onClick={submit}
            >
              {createSch.isPending ? "Scheduling…" : "Activate Schedule"}
            </button>
          )}
        </div>
      }
    >
      {step === 0 ? (
        <div className="row g-3">
          <div className="col-12">
            <label className="desk-label">Schedule Label</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="col-sm-4">
            <label className="desk-label">Start Time (UTC)</label>
            <input type="time" className="form-control mono" value={executeAt} onChange={(e) => setExecuteAt(e.target.value)} />
          </div>
          <div className="col-sm-4">
            <label className="desk-label">End Window (UTC)</label>
            <input type="time" className="form-control mono" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
          </div>
          <div className="col-sm-4">
            <label className="desk-label">Recurrence</label>
            <select
              className="form-select"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Mon–Fri FX Session</option>
              <option value="one_time">One-Time Run</option>
              <option value="session_overlap">London / NY Overlap</option>
            </select>
          </div>
          <div className="col-12">
            <label className="desk-label">Target Instrument</label>
            <div className="desk-chip-grid">
              {ALL_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  className={cn("desk-chip mono", symbol === sym && "is-selected")}
                  onClick={() => setSymbol(sym)}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="row g-3">
          <div className="col-sm-6">
            <label className="desk-label">Execution Strategy</label>
            <select
              className="form-select"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyName)}
            >
              {ALL_STRATEGIES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-6">
            <label className="desk-label">Base Stake per Contract (USD)</label>
            <input
              type="number"
              min={5}
              className="form-control mono"
              value={stake}
              onChange={(e) => setStake(Math.max(5, Number(e.target.value)))}
            />
          </div>
          <div className="col-sm-4">
            <label className="desk-label">Max Contracts</label>
            <input
              type="number"
              min={1}
              className="form-control mono"
              value={maxTrades}
              onChange={(e) => setMaxTrades(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="col-sm-4">
            <label className="desk-label">Session Stop Loss ($)</label>
            <input
              type="number"
              min={25}
              className="form-control mono"
              value={stopLoss}
              onChange={(e) => setStopLoss(Math.max(25, Number(e.target.value)))}
            />
          </div>
          <div className="col-sm-4">
            <label className="desk-label">Session Take Profit ($)</label>
            <input
              type="number"
              min={25}
              className="form-control mono"
              value={takeProfit}
              onChange={(e) => setTakeProfit(Math.max(25, Number(e.target.value)))}
            />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="d-flex flex-column gap-3">
          <p className="small mb-0">
            Allocate P&amp;L and margin weight across active trading pools (must equal <strong className="mono">100%</strong>).
          </p>
          {(["PKG-01", "PKG-02", "PKG-03"] as const).map((code) => (
            <div key={code} className="desk-slider-row">
              <span className="mono fw-semibold">{code}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="form-range"
                value={split[code]}
                onChange={(e) => setSplit((prev) => ({ ...prev, [code]: Number(e.target.value) }))}
              />
              <span className="mono">{split[code]}%</span>
            </div>
          ))}
          <div className={cn("desk-inline-alert", totalPct === 100 ? "is-ok" : "is-error")}>
            Total allocation: <strong className="mono">{totalPct}%</strong>{" "}
            {totalPct !== 100 ? "(adjust sliders to equal 100%)" : "— balanced and ready."}
          </div>
        </div>
      ) : null}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 3 · 3-STEP PROFIT DISTRIBUTION WATERFALL WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function DistributeProfitsWizard({
  distribution,
  onClose,
}: {
  distribution: ProfitDistributionDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const distribute = useDistributePending();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(
    distribution.breakdown.filter((r) => r.pending > 0).map((r) => r.packageCode),
  );
  const [notifyInvestors, setNotifyInvestors] = useState(true);

  const chosenRows = distribution.breakdown.filter((r) => selected.includes(r.packageCode));
  const totalRelease = chosenRows.reduce((s, r) => s + r.pending, 0);

  const toggle = (code: string) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));

  const confirm = async () => {
    const res = await distribute.mutateAsync(selected);
    pushToast({
      tone: "success",
      title: `Distributed ${formatCurrency(res.releasedAmount)} to investor wallets`,
      detail: notifyInvestors
        ? "Pro-rata wallet balances credited and investor settlement notices dispatched."
        : "Pro-rata wallet balances credited silently.",
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="WIZ-DIST"
      eyebrow="Profit Waterfall Settlement"
      title="Distribute Pending Pool Profits"
      subtitle="Verify High-Water Mark status, inspect the 80/20 waterfall split, and credit investor wallets."
      size="lg"
      steps={["Select Pools", "Waterfall Audit", "Credit Wallets"]}
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
            <button
              type="button"
              className="btn-brand"
              disabled={totalRelease <= 0}
              onClick={() => setStep((s) => s + 1)}
            >
              Review Waterfall <Icon name="arrowRight" size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-brand"
              disabled={totalRelease <= 0 || distribute.isPending}
              onClick={confirm}
            >
              {distribute.isPending ? "Crediting Wallets…" : `Release ${formatCurrency(totalRelease)} Now`}
            </button>
          )}
        </div>
      }
    >
      {step === 0 ? (
        <div className="d-flex flex-column gap-2">
          {distribution.breakdown.map((row) => (
            <label key={row.packageCode} className="desk-select-row">
              <input
                type="checkbox"
                className="form-check-input m-0"
                checked={selected.includes(row.packageCode)}
                disabled={row.pending <= 0}
                onChange={() => toggle(row.packageCode)}
              />
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2">
                  <strong className="mono">{row.packageCode}</strong>
                  <span>{row.packageName}</span>
                  <span className="pill pill-live ms-auto">HWM Cleared</span>
                </div>
                <div className="small text-secondary mt-1">
                  {row.investorsCount} investors · Capital weight {row.capitalSharePercent}% · Already distributed{" "}
                  <span className="mono">{formatCurrency(row.distributed)}</span>
                </div>
              </div>
              <div className="text-end">
                <span className="d-block mono fw-semibold text-win">+{formatCurrency(row.pending)}</span>
                <span className="small text-muted">pending</span>
              </div>
            </label>
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="table-responsive">
          <table className="table desk-table mb-0">
            <thead>
              <tr>
                <th>Pool</th>
                <th className="text-end">Gross P&amp;L</th>
                <th className="text-end">Operator (20%)</th>
                <th className="text-end">Settled Prior</th>
                <th className="text-end">Releasing Now</th>
              </tr>
            </thead>
            <tbody>
              {chosenRows.map((r) => (
                <tr key={r.packageCode}>
                  <td className="mono fw-semibold">{r.packageCode}</td>
                  <td className="text-end mono">{formatCurrency(r.grossPnL)}</td>
                  <td className="text-end mono">{formatCurrency(r.operatorCut)}</td>
                  <td className="text-end mono">{formatCurrency(r.distributed)}</td>
                  <td className="text-end mono fw-semibold text-win">+{formatCurrency(r.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="d-flex flex-column gap-3">
          <dl className="auth-kv">
            <dt>Pools Included</dt>
            <dd className="mono">{selected.join(", ")}</dd>
            <dt>Total Credited to Investor Wallets</dt>
            <dd className="mono text-win">+{formatCurrency(totalRelease)}</dd>
            <dt>Post-Run Distribution Ratio</dt>
            <dd className="mono">100% Settled</dd>
          </dl>
          <label className="desk-select-row">
            <input
              type="checkbox"
              className="form-check-input m-0"
              checked={notifyInvestors}
              onChange={(e) => setNotifyInvestors(e.target.checked)}
            />
            <span>Send automated earnings statement to all credited pool investors</span>
          </label>
        </div>
      ) : null}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 4 · 3-STEP BATCH WITHDRAWAL PAYOUT WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function PayoutBatchWizard({
  workspace,
  availableCapital,
  onClose,
}: {
  workspace: OperatorWorkspaceDTO;
  availableCapital: number;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const process = useProcessPayouts();
  const pendingRows = workspace.payoutQueue.filter((p) => p.status === "pending");
  const [step, setStep] = useState(0);
  const [ids, setIds] = useState<string[]>(pendingRows.map((p) => p.id));

  const selectedRows = pendingRows.filter((p) => ids.includes(p.id));
  const totalAmount = selectedRows.reduce((s, r) => s + r.amount, 0);

  const release = async () => {
    const res = await process.mutateAsync({ ids, action: "approve" });
    pushToast({
      tone: "success",
      title: `Released ${res.count} payout(s) · ${formatCurrency(res.processedAmount)}`,
      detail: "Settlement instructions dispatched to ACH, SEPA, USDT & Mobile Money rails.",
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="WIZ-PAY"
      eyebrow="Treasury Disbursements"
      title="Process Investor Withdrawal Queue"
      subtitle="Verify liquidity headroom and KYC clearance before releasing outbound payouts."
      size="lg"
      steps={["Select Requests", "Liquidity & KYC Check", "Release Batch"]}
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
              disabled={selectedRows.length === 0}
              onClick={() => setStep((s) => s + 1)}
            >
              Verify Clearance <Icon name="arrowRight" size={15} />
            </button>
          ) : (
            <button type="button" className="btn-brand" disabled={process.isPending} onClick={release}>
              {process.isPending ? "Releasing…" : `Approve & Send ${formatCurrency(totalAmount)}`}
            </button>
          )}
        </div>
      }
    >
      {pendingRows.length === 0 ? (
        <div className="desk-inline-alert is-ok">
          All investor withdrawal requests have been settled. Zero pending payouts in queue.
        </div>
      ) : step === 0 ? (
        <div className="d-flex flex-column gap-2">
          {pendingRows.map((row) => (
            <label key={row.id} className="desk-select-row">
              <input
                type="checkbox"
                className="form-check-input m-0"
                checked={ids.includes(row.id)}
                onChange={() =>
                  setIds((prev) => (prev.includes(row.id) ? prev.filter((x) => x !== row.id) : [...prev, row.id]))
                }
              />
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2">
                  <strong className="mono">{row.reference}</strong>
                  <span>{row.investorName}</span>
                  <span className="mono small text-muted">({row.investorHandle})</span>
                </div>
                <div className="small text-secondary">
                  {row.method} → <span className="mono">{row.destinationMasked}</span> · Requested {row.requestedAt}
                </div>
              </div>
              <span className="mono fw-semibold">{formatCurrency(row.amount)}</span>
            </label>
          ))}
        </div>
      ) : step === 1 ? (
        <dl className="auth-kv">
          <dt>Available Treasury Liquidity</dt>
          <dd className="mono">{formatCurrency(availableCapital)}</dd>
          <dt>Selected Batch Outflow ({selectedRows.length} payouts)</dt>
          <dd className="mono">−{formatCurrency(totalAmount)}</dd>
          <dt>Post-Payout Available Reserve</dt>
          <dd className="mono text-win">{formatCurrency(availableCapital - totalAmount)}</dd>
          <dt>AML &amp; Level 2+ KYC Status</dt>
          <dd className="text-win">All {selectedRows.length} recipients verified</dd>
        </dl>
      ) : (
        <div className="desk-note-strip">
          <Icon name="lock" size={16} />
          <span>
            Confirming will lock wallet balances, transmit payment batch instructions for{" "}
            <strong className="mono">{formatCurrency(totalAmount)}</strong>, and email receipts to each investor.
          </span>
        </div>
      )}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD 5 · 3-STEP AUTOMATED BOT DEPLOYMENT WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
export function BotDeployWizard({
  defaultSymbol = "R_75",
  funds,
  workspace,
  onClose,
}: {
  defaultSymbol?: DerivSymbol;
  funds: FundsFlowDTO;
  workspace: OperatorWorkspaceDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const updateBot = useUpdateBot();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Vol75 Institutional Scalper");
  const [symbol, setSymbol] = useState<DerivSymbol>(defaultSymbol);
  const [strategy, setStrategy] = useState<StrategyName>("Even/Odd");
  const [stake, setStake] = useState(35);
  const [packageCode, setPackageCode] = useState("PKG-01");

  const activeConn = workspace.connections.find((c) => c.id === workspace.activeConnectionId) ?? workspace.connections[0];

  const deploy = async () => {
    await updateBot.mutateAsync({
      action: "create",
      name,
      symbol,
      strategy,
      stake,
      packageCode,
    });
    pushToast({
      tone: "success",
      title: `Bot runner deployed on ${symbol}`,
      detail: `${name} connected to ${activeConn.derivLoginId} (${packageCode}).`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="WIZ-BOT"
      eyebrow="Automated Strategy Runner"
      title="Deploy Deriv Bot Instance"
      subtitle="Attach a sandboxed strategy runner to an active Deriv WebSocket session and pool."
      size="lg"
      steps={["Market & Pool", "Sizing & Cadence", "8-Point Pre-Flight"]}
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
              Next <Icon name="arrowRight" size={15} />
            </button>
          ) : (
            <button type="button" className="btn-brand" disabled={updateBot.isPending} onClick={deploy}>
              {updateBot.isPending ? "Starting Worker…" : "Start Live Bot"}
            </button>
          )}
        </div>
      }
    >
      {step === 0 ? (
        <div className="row g-3">
          <div className="col-sm-7">
            <label className="desk-label">Bot Instance Label</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="col-sm-5">
            <label className="desk-label">Assigned Pool Package</label>
            <select className="form-select mono" value={packageCode} onChange={(e) => setPackageCode(e.target.value)}>
              {funds.packages.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="desk-label">Deriv Symbol</label>
            <div className="desk-chip-grid">
              {ALL_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  className={cn("desk-chip mono", symbol === sym && "is-selected")}
                  onClick={() => setSymbol(sym)}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : step === 1 ? (
        <div className="row g-3">
          <div className="col-sm-6">
            <label className="desk-label">Preset Strategy</label>
            <select
              className="form-select"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyName)}
            >
              {ALL_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-6">
            <label className="desk-label">Base Stake (USD)</label>
            <input
              type="number"
              min={5}
              className="form-control mono"
              value={stake}
              onChange={(e) => setStake(Math.max(5, Number(e.target.value)))}
            />
          </div>
        </div>
      ) : (
        <div className="row g-2">
          {[
            `Deriv WS ${activeConn.derivLoginId} connected (${activeConn.latencyMs}ms)`,
            `Available margin (${formatCurrency(funds.availableCapital)}) >= stake ($${stake})`,
            `Daily loss ($${workspace.risk.currentDailyLoss}) < limit ($${workspace.risk.maxDailyLoss})`,
            `Package drawdown cap armed at ${workspace.risk.packageDrawdownLimitPercent}%`,
            `Cooldown window ${workspace.risk.cooldownSeconds}s configured`,
            "Isolated VM memory limit 128MB · tick timeout 100ms",
          ].map((rule) => (
            <div key={rule} className="col-sm-6">
              <div className="desk-check-tile">
                <Icon name="check" size={14} />
                <span>{rule}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DeskModalShell>
  );
}
