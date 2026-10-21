"use client";

import { useState } from "react";

import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon } from "@/components/icons";
import { authApi } from "@/lib/api/auth";
import { cn } from "@/lib/cn";
import type {
  ContractTypeCode,
  DerivSymbol,
  FundsFlowDTO,
  InvestorWatchDTO,
  OperatorWorkspaceDTO,
  SendAnnouncementInput,
  StrategyName,
} from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";
import {
  useAnnounce,
  useExecuteQuickTrade,
  useRebalanceCapital,
  useReviewDeposit,
  useReviewKyc,
  useSwitchDerivAccount,
  useUpdateRiskGuardrails,
} from "@/lib/queries/use-dashboard";

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 6 · INSTANT DERIV TRADE EXECUTION TICKET
   ═══════════════════════════════════════════════════════════════════════════ */
export function QuickTradeModal({
  defaultSymbol = "R_10",
  defaultPackage = "PKG-01",
  defaultStake = 35,
  workspace,
  funds,
  onClose,
}: {
  defaultSymbol?: DerivSymbol;
  defaultPackage?: string;
  defaultStake?: number;
  workspace: OperatorWorkspaceDTO;
  funds: FundsFlowDTO;
  onClose: () => void;
}) {
  const { markFlashedTrade, pushToast } = useOperatorUI();
  const buy = useExecuteQuickTrade();
  const [symbol, setSymbol] = useState<DerivSymbol>(defaultSymbol);
  const [contractType, setContractType] = useState<ContractTypeCode>("CALL");
  const [strategy, setStrategy] = useState<StrategyName>("Martingale");
  const [stake, setStake] = useState<number>(defaultStake);
  const [duration, setDuration] = useState<number>(5);
  const [durationUnit, setDurationUnit] = useState<"t" | "s" | "m">("t");
  const [packageCode, setPackageCode] = useState<string>(defaultPackage);

  const quote = workspace.markets.find((m) => m.symbol === symbol) ?? workspace.markets[0];
  const estPayout = Number((stake * (1 + quote.payoutPercent / 100)).toFixed(2));
  const estProfit = Number((estPayout - stake).toFixed(2));

  const placeOrder = async () => {
    const settled = await buy.mutateAsync({
      symbol,
      contractType,
      strategy,
      stake,
      duration,
      durationUnit,
      packageCode,
    });
    markFlashedTrade(settled.id);
    pushToast({
      tone: settled.isWin ? "success" : "warning",
      title: `Trade #${settled.tradeNumber} ${settled.isWin ? `WON +${formatCurrency(settled.profit)}` : `LOST ${formatCurrency(settled.profit)}`}`,
      detail: `${settled.symbol} ${settled.contractLabel} · Contract #${settled.derivContractId} (${settled.packageCode})`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="ORD-TICKET"
      eyebrow="Deriv WS Instant Execution"
      title="Execute Desk Contract"
      subtitle="Submit a live contract order directly through the active Deriv session and allocate P&L to a syndicate pool."
      size="lg"
      onClose={onClose}
      footer={
        <div className="d-flex align-items-center justify-content-between w-100 flex-wrap gap-2">
          <div className="small text-secondary mono">
            Est. Payout: <strong>{formatCurrency(estPayout)}</strong> (+{formatCurrency(estProfit)} · {quote.payoutPercent}%)
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-brand"
              disabled={buy.isPending || workspace.risk.emergencyHalted}
              onClick={placeOrder}
            >
              {buy.isPending ? "Executing Order…" : `Place ${contractType} · ${formatCurrency(stake)}`}
            </button>
          </div>
        </div>
      }
    >
      {workspace.risk.emergencyHalted ? (
        <div className="desk-inline-alert is-error mb-3">
          Desk Emergency Halt is currently active. Resume execution before submitting manual contracts.
        </div>
      ) : null}

      <div className="desk-quote-banner mb-3">
        <div>
          <span className="mono fw-semibold">{quote.symbol}</span>
          <span className="text-secondary ms-2 small">{quote.label}</span>
        </div>
        <div className="d-flex align-items-center gap-3 mono">
          <span>Spot: <strong>{quote.spot}</strong></span>
          <span className={quote.changePercent >= 0 ? "text-win" : "text-loss"}>
            {quote.changePercent >= 0 ? "+" : ""}
            {quote.changePercent}%
          </span>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-sm-6">
          <label className="desk-label">Instrument</label>
          <select
            className="form-select mono"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as DerivSymbol)}
          >
            {workspace.markets.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                {m.symbol} — {m.label} ({m.spot})
              </option>
            ))}
          </select>
        </div>

        <div className="col-sm-6">
          <label className="desk-label">Target Pool Allocation</label>
          <select
            className="form-select mono"
            value={packageCode}
            onChange={(e) => setPackageCode(e.target.value)}
          >
            {funds.packages.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} · {p.name} ({formatCurrency(p.totalCapital, "USD", 0)})
              </option>
            ))}
          </select>
        </div>

        <div className="col-12">
          <label className="desk-label">Contract Direction</label>
          <div className="desk-chip-grid">
            {(
              [
                ["CALL", "Rise / Higher ▲"],
                ["PUT", "Fall / Lower ▼"],
                ["DIGITEVEN", "Digit Even"],
                ["DIGITODD", "Digit Odd"],
                ["DIGITOVER", "Digit Over 3"],
                ["DIGITUNDER", "Digit Under 6"],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                type="button"
                className={cn("desk-chip", contractType === code && "is-selected")}
                onClick={() => setContractType(code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="col-sm-6">
          <label className="desk-label">Stake Amount (USD)</label>
          <input
            type="number"
            min={5}
            max={5000}
            className="form-control mono"
            value={stake}
            onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
          />
          <div className="d-flex flex-wrap gap-1 mt-2">
            {[15, 25, 35, 50, 70, 100, 250].map((preset) => (
              <button
                key={preset}
                type="button"
                className={cn("desk-mini-chip mono", stake === preset && "is-selected")}
                onClick={() => setStake(preset)}
              >
                ${preset}
              </button>
            ))}
          </div>
        </div>

        <div className="col-sm-3">
          <label className="desk-label">Duration</label>
          <input
            type="number"
            min={1}
            max={60}
            className="form-control mono"
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
          />
        </div>

        <div className="col-sm-3">
          <label className="desk-label">Unit</label>
          <select
            className="form-select mono"
            value={durationUnit}
            onChange={(e) => setDurationUnit(e.target.value as "t" | "s" | "m")}
          >
            <option value="t">Ticks (t)</option>
            <option value="s">Seconds (s)</option>
            <option value="m">Minutes (m)</option>
          </select>
        </div>

        <div className="col-12">
          <label className="desk-label">Attribution Strategy Tag</label>
          <select
            className="form-select"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as StrategyName)}
          >
            {(["Martingale", "Even/Odd", "DCA", "Oscar's Grind", "Fixed Stake", "Fibonacci"] as StrategyName[]).map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 7 · DERIV WEBSOCKET MULTIPLEXER & ACCOUNT SWITCHER
   ═══════════════════════════════════════════════════════════════════════════ */
export function DerivConnectionModal({
  workspace,
  onClose,
}: {
  workspace: OperatorWorkspaceDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const switchConn = useSwitchDerivAccount();
  const [reconnecting, setReconnecting] = useState(false);

  const handleSwitch = async (id: string, loginId: string) => {
    await switchConn.mutateAsync(id);
    pushToast({
      tone: "info",
      title: `Switched active Deriv account to ${loginId}`,
      detail: "WebSocket session re-authorized and balance stream subscribed.",
    });
  };

  const launchOAuth = async () => {
    setReconnecting(true);
    try {
      const { url } = await authApi.derivAuthorizeUrl();
      window.location.href = url;
    } catch {
      setReconnecting(false);
    }
  };

  return (
    <DeskModalShell
      code="DERIV-WS"
      eyebrow="Broker Connectivity · wss://ws.derivws.com/websockets/v3"
      title="Deriv API Connections & Scopes"
      subtitle="Manage multiplexed WebSocket accounts, verify latency, or authorize an additional Deriv login."
      size="lg"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            disabled={reconnecting}
            onClick={launchOAuth}
          >
            <Icon name="plug" size={15} /> {reconnecting ? "Redirecting…" : "Link Another Account via Deriv OAuth"}
          </button>
          <button type="button" className="btn-brand" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      <div className="d-flex flex-column gap-3">
        {workspace.connections.map((conn) => {
          const isActive = conn.status === "active";
          return (
            <div key={conn.id} className={cn("desk-conn-card", isActive && "is-active")}>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2">
                  <span className={cn("live-dot", !isActive && "opacity-25")} />
                  <strong className="mono">{conn.derivLoginId}</strong>
                  <span className={cn("pill", conn.accountType === "real" ? "pill-live" : "pill-amber")}>
                    {conn.accountType.toUpperCase()}
                  </span>
                  <span className="mono small text-secondary">{conn.latencyMs}ms ping</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="mono fw-semibold">{formatCurrency(conn.balance)}</span>
                  <button
                    type="button"
                    className={isActive ? "btn-ghost btn-ghost--sm" : "btn-brand"}
                    disabled={switchConn.isPending}
                    onClick={() => handleSwitch(conn.id, conn.derivLoginId)}
                  >
                    {isActive ? "Ping WS" : "Set Active"}
                  </button>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-1 mt-2">
                {conn.permissions.map((perm) => (
                  <span key={perm} className="pill mono">
                    scope:{perm}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 8 · INVESTOR BROADCAST & ANNOUNCEMENT COMPOSER
   ═══════════════════════════════════════════════════════════════════════════ */
const TEMPLATES = [
  {
    label: "Session Profit Note",
    subject: "Desk Session Update — +$133 Net Across Last 5 Contracts",
    body: "Pool trading remains on schedule across R_10, R_75, and R_100 with cumulative pool returns at +11.7%. Next automated sequence runs at 15:00 UTC.",
  },
  {
    label: "Distribution Notice",
    subject: "Profit Distribution Window Scheduled — $2,917 Staged",
    body: "Pro-rata investor earnings for PKG-01, PKG-02, and PKG-03 have passed High-Water Mark verification and are queued for wallet credit.",
  },
  {
    label: "New Pool Opening",
    subject: "PKG-04 November Series A — Slot Booking Open",
    body: "18 slots remain available in PKG-04 ($2,000/slot). Lock your allocation before the trading window begins.",
  },
];

export function AnnounceBroadcastModal({
  defaultAudience = "all",
  onClose,
}: {
  defaultAudience?: SendAnnouncementInput["audience"];
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const announce = useAnnounce();
  const [audience, setAudience] = useState<SendAnnouncementInput["audience"]>(defaultAudience);
  const [channels, setChannels] = useState<Array<"in_app" | "email" | "telegram">>([
    "in_app",
    "email",
    "telegram",
  ]);
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [body, setBody] = useState(TEMPLATES[0].body);

  const toggleCh = (c: "in_app" | "email" | "telegram") =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const send = async () => {
    if (!subject.trim() || !body.trim() || channels.length === 0) return;
    await announce.mutateAsync({ audience, channels, subject, body });
    pushToast({
      tone: "success",
      title: "Investor announcement dispatched",
      detail: `Sent "${subject}" via ${channels.join(", ").toUpperCase()}.`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="COMMS-TX"
      eyebrow="Investor Relations Desk"
      title="Broadcast Pool Update"
      subtitle="Send synchronized updates across In-App feed, transactional email, and Telegram channels."
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
            disabled={announce.isPending || channels.length === 0 || !subject.trim()}
            onClick={send}
          >
            <Icon name="send" size={14} /> {announce.isPending ? "Dispatching…" : "Send Broadcast"}
          </button>
        </div>
      }
    >
      <div className="d-flex flex-wrap gap-1 mb-3">
        <span className="small text-secondary me-1 align-self-center">Quick template:</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            className="desk-mini-chip"
            onClick={() => {
              setSubject(t.subject);
              setBody(t.body);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-sm-6">
          <label className="desk-label">Target Audience</label>
          <select
            className="form-select"
            value={audience}
            onChange={(e) => setAudience(e.target.value as SendAnnouncementInput["audience"])}
          >
            <option value="all">All Active Investors (38)</option>
            <option value="PKG-01">PKG-01 Backers Only (14)</option>
            <option value="PKG-02">PKG-02 Backers Only (15)</option>
            <option value="PKG-03">PKG-03 Backers Only (9)</option>
            <option value="pending_kyc">Pending KYC Cohort (2)</option>
          </select>
        </div>
        <div className="col-sm-6">
          <label className="desk-label">Delivery Channels</label>
          <div className="desk-chip-grid">
            {(
              [
                ["in_app", "In-App"],
                ["email", "Email"],
                ["telegram", "Telegram"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={cn("desk-chip", channels.includes(val) && "is-selected")}
                onClick={() => toggleCh(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="col-12">
          <label className="desk-label">Subject Line</label>
          <input className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="col-12">
          <label className="desk-label">Message Body</label>
          <textarea
            rows={4}
            className="form-control"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 9 · INVESTOR KYC COMPLIANCE REVIEW
   ═══════════════════════════════════════════════════════════════════════════ */
export function KycReviewModal({
  investorWatch,
  focusId,
  onClose,
}: {
  investorWatch: InvestorWatchDTO;
  focusId?: string;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const review = useReviewKyc();
  const candidates = investorWatch.investors.filter(
    (i) => i.kycStatus !== "approved" || i.id === focusId,
  );

  const act = async (investorId: string, handle: string, decision: "approved" | "reupload_requested") => {
    await review.mutateAsync({ investorId, decision });
    pushToast({
      tone: decision === "approved" ? "success" : "info",
      title:
        decision === "approved"
          ? `${handle} upgraded to KYC Level 2`
          : `Re-upload notice sent to ${handle}`,
      detail: "Compliance audit log updated.",
    });
  };

  return (
    <DeskModalShell
      code="KYC-DESK"
      eyebrow="AML & Identity Verification"
      title={`Compliance Review Queue (${investorWatch.pendingKYC} Pending)`}
      subtitle="Verify government ID, selfie liveness, proof of address, and source of funds."
      size="lg"
      onClose={onClose}
      footer={
        <button type="button" className="btn-brand ms-auto" onClick={onClose}>
          Close Queue
        </button>
      }
    >
      {candidates.length === 0 ? (
        <div className="desk-inline-alert is-ok">
          All 38 pool investors are KYC-cleared. No pending identity submissions.
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {candidates.map((inv) => (
            <div key={inv.id} className="desk-conn-card">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <strong className="mono">{inv.handle}</strong> · <strong>{inv.fullName}</strong>{" "}
                  <span className="pill ms-1">{inv.country}</span>
                  <div className="small text-secondary mt-1">
                    Doc: <strong>{inv.docType}</strong> · Source: <strong>{inv.sourceOfFunds}</strong> · Committed:{" "}
                    <span className="mono">{formatCurrency(inv.totalInvested, "USD", 0)}</span> ({inv.totalSlots} slots)
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost btn-ghost--sm"
                    disabled={review.isPending}
                    onClick={() => act(inv.id, inv.handle, "reupload_requested")}
                  >
                    Request Re-upload
                  </button>
                  <button
                    type="button"
                    className="btn-brand"
                    disabled={review.isPending || inv.kycStatus === "approved"}
                    onClick={() => act(inv.id, inv.handle, "approved")}
                  >
                    {inv.kycStatus === "approved" ? "Approved" : "Approve Level 2"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 10 · PENDING DEPOSIT VERIFICATION QUEUE
   ═══════════════════════════════════════════════════════════════════════════ */
export function DepositVerifyModal({
  funds,
  onClose,
}: {
  funds: FundsFlowDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const review = useReviewDeposit();

  const decide = async (id: string, ref: string, amount: number, action: "verify" | "request_proof") => {
    await review.mutateAsync({ id, action });
    pushToast({
      tone: action === "verify" ? "success" : "info",
      title:
        action === "verify"
          ? `Deposit ${ref} verified (+${formatCurrency(amount, "USD", 0)})`
          : `Proof receipt requested for ${ref}`,
      detail:
        action === "verify"
          ? "Capital credited to pool balance and investor slots confirmed."
          : "Investor notified to upload transfer receipt.",
    });
  };

  return (
    <DeskModalShell
      code="DEP-VERIFY"
      eyebrow="Incoming Capital Settlement"
      title="Verify Pending Pool Deposits"
      subtitle="Confirm wire references, on-chain hashes, and mobile money settlements to credit pool capital."
      size="lg"
      onClose={onClose}
      footer={
        <button type="button" className="btn-brand ms-auto" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="d-flex flex-column gap-2">
        {funds.pendingDeposits.map((dep) => (
          <div key={dep.id} className="desk-conn-card">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <span className="mono fw-semibold">{dep.reference}</span> · <strong>{dep.investorName}</strong>{" "}
                <span className="mono small text-muted">({dep.investorHandle})</span>
                <div className="small text-secondary mt-1">
                  <span className="mono">{dep.packageCode}</span> · {dep.slots} slot(s) · {dep.method} · {dep.submittedAt}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <strong className="mono me-2">{formatCurrency(dep.amount, "USD", 0)}</strong>
                {dep.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost btn-ghost--sm"
                      disabled={review.isPending}
                      onClick={() => decide(dep.id, dep.reference, dep.amount, "request_proof")}
                    >
                      Ask Proof
                    </button>
                    <button
                      type="button"
                      className="btn-brand"
                      disabled={review.isPending}
                      onClick={() => decide(dep.id, dep.reference, dep.amount, "verify")}
                    >
                      Verify &amp; Credit
                    </button>
                  </>
                ) : (
                  <span className={cn("pill", dep.status === "verified" ? "pill-live" : "pill-amber")}>
                    {dep.status === "verified" ? "Verified" : "Proof Requested"}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 11 · POOL CAPITAL & TREASURY REBALANCE
   ═══════════════════════════════════════════════════════════════════════════ */
export function CapitalRebalanceModal({
  funds,
  onClose,
}: {
  funds: FundsFlowDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const rebalance = useRebalanceCapital();
  const [inTrades, setInTrades] = useState(funds.capitalInTrades);
  const [split, setSplit] = useState<Record<string, number>>({
    "PKG-01": funds.packages[0]?.capitalSharePercent ?? 40,
    "PKG-02": funds.packages[1]?.capitalSharePercent ?? 35,
    "PKG-03": funds.packages[2]?.capitalSharePercent ?? 25,
  });

  const reserve = funds.totalCapital - inTrades;
  const sum = Object.values(split).reduce((a, b) => a + b, 0);

  const save = async () => {
    await rebalance.mutateAsync({ capitalInTrades: inTrades, split });
    pushToast({
      tone: "success",
      title: "Treasury allocation updated",
      detail: `Deployed ${formatCurrency(inTrades, "USD", 0)} · Reserve ${formatCurrency(reserve, "USD", 0)}.`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="TREAS-BAL"
      eyebrow="Capital Deployment & Liquidity Reserve"
      title="Rebalance Pool Capital"
      subtitle="Adjust active trading margin versus liquid withdrawal reserve and per-pool capital weights."
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
            disabled={sum !== 100 || rebalance.isPending}
            onClick={save}
          >
            {rebalance.isPending ? "Applying…" : "Apply Allocation"}
          </button>
        </div>
      }
    >
      <div className="d-flex flex-column gap-3">
        <div>
          <label className="desk-label">
            Active Margin in Trades:{" "}
            <strong className="mono">{formatCurrency(inTrades, "USD", 0)}</strong> (Reserve:{" "}
            <span className="mono">{formatCurrency(reserve, "USD", 0)}</span>)
          </label>
          <input
            type="range"
            min={50000}
            max={funds.totalCapital}
            step={1000}
            className="form-range"
            value={inTrades}
            onChange={(e) => setInTrades(Number(e.target.value))}
          />
        </div>
        <hr className="my-1" />
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
              onChange={(e) => setSplit((p) => ({ ...p, [code]: Number(e.target.value) }))}
            />
            <span className="mono">{split[code]}%</span>
          </div>
        ))}
        <div className={cn("desk-inline-alert", sum === 100 ? "is-ok" : "is-error")}>
          Pool weight sum: <strong className="mono">{sum}%</strong>
        </div>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 12 · RISK DESK CIRCUIT BREAKER GUARDRAILS
   ═══════════════════════════════════════════════════════════════════════════ */
export function RiskGuardrailsModal({
  workspace,
  onClose,
}: {
  workspace: OperatorWorkspaceDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const update = useUpdateRiskGuardrails();
  const [maxDailyLoss, setMaxDailyLoss] = useState(workspace.risk.maxDailyLoss);
  const [maxDailyTrades, setMaxDailyTrades] = useState(workspace.risk.maxDailyTrades);
  const [ddCap, setDdCap] = useState(workspace.risk.packageDrawdownLimitPercent);
  const [maxOddEven, setMaxOddEven] = useState(workspace.risk.maxConsecutiveLossesOddEven);
  const [rotation, setRotation] = useState(workspace.risk.randomSymbolRotation);

  const save = async () => {
    await update.mutateAsync({
      maxDailyLoss,
      maxDailyTrades,
      packageDrawdownLimitPercent: ddCap,
      maxConsecutiveLossesOddEven: maxOddEven,
      randomSymbolRotation: rotation,
    });
    pushToast({
      tone: "success",
      title: "Risk guardrails updated",
      detail: `Daily loss cap $${maxDailyLoss} · Pool drawdown circuit ${ddCap}%.`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="RISK-GUARD"
      eyebrow="Automated Circuit Breakers"
      title="Risk Desk Guardrail Parameters"
      subtitle="Pre-trade and intraday thresholds enforced automatically across all bots and manual tickets."
      size="md"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-brand" disabled={update.isPending} onClick={save}>
            Save Guardrails
          </button>
        </div>
      }
    >
      <div className="row g-3">
        <div className="col-sm-6">
          <label className="desk-label">Max Daily Loss Cap ($)</label>
          <input
            type="number"
            className="form-control mono"
            value={maxDailyLoss}
            onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
          />
        </div>
        <div className="col-sm-6">
          <label className="desk-label">Max Daily Contracts</label>
          <input
            type="number"
            className="form-control mono"
            value={maxDailyTrades}
            onChange={(e) => setMaxDailyTrades(Number(e.target.value))}
          />
        </div>
        <div className="col-sm-6">
          <label className="desk-label">Per-Package Drawdown Halt (%)</label>
          <input
            type="number"
            step={0.5}
            className="form-control mono"
            value={ddCap}
            onChange={(e) => setDdCap(Number(e.target.value))}
          />
        </div>
        <div className="col-sm-6">
          <label className="desk-label">Max Consecutive Losses</label>
          <input
            type="number"
            className="form-control mono"
            value={maxOddEven}
            onChange={(e) => setMaxOddEven(Number(e.target.value))}
          />
        </div>
        <div className="col-12">
          <label className="desk-select-row">
            <input
              type="checkbox"
              className="form-check-input m-0"
              checked={rotation}
              onChange={(e) => setRotation(e.target.checked)}
            />
            <span>Rotate Volatility index symbols across runs to minimize streak correlation</span>
          </label>
        </div>
      </div>
    </DeskModalShell>
  );
}
