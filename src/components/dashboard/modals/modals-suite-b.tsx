"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import {
  AnnounceBroadcastModal,
  CapitalRebalanceModal,
  DepositVerifyModal,
  DerivConnectionModal,
  KycReviewModal,
  QuickTradeModal,
  RiskGuardrailsModal,
} from "@/components/dashboard/modals/modals-suite-a";
import {
  BotDeployWizard,
  DistributeProfitsWizard,
  NewPackageWizard,
  PayoutBatchWizard,
  ScheduleTradeWizard,
} from "@/components/dashboard/modals/wizards-suite";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon } from "@/components/icons";
import { OPERATOR_NAV } from "@/lib/dashboard/nav";
import type {
  FundsFlowDTO,
  InvestorWatchDTO,
  LastTradesFeedDTO,
  OperatorWorkspaceDTO,
  OverlayKind,
  ProfitDistributionDTO,
} from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";
import { useExecuteQuickTrade, useUpdateBot } from "@/lib/queries/use-dashboard";

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 13 · EMERGENCY DESK HALT / RESUME KILL-SWITCH
   ═══════════════════════════════════════════════════════════════════════════ */
function EmergencyHaltModal({
  workspace,
  onClose,
}: {
  workspace: OperatorWorkspaceDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const updateBot = useUpdateBot();
  const halted = workspace.risk.emergencyHalted;
  const [confirmWord, setConfirmWord] = useState("");

  const trigger = async () => {
    await updateBot.mutateAsync({ action: halted ? "resume_all" : "halt_all" });
    pushToast({
      tone: halted ? "success" : "warning",
      title: halted ? "Desk execution resumed" : "Emergency Halt activated",
      detail: halted
        ? "All bot workers restored to active Deriv tick subscriptions."
        : "All running bots paused and manual order ticket locked.",
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="DESK-HALT"
      eyebrow="Execution Kill-Switch"
      title={halted ? "Resume Automated Desk Execution" : "Halt All Active Bots & Schedules"}
      subtitle={
        halted
          ? "Restore automated strategy runners and re-enable manual ticket execution."
          : "Immediately pause all active bot runners without force-selling settled positions."
      }
      size="sm"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-brand"
            disabled={(!halted && confirmWord.toUpperCase() !== "HALT") || updateBot.isPending}
            onClick={trigger}
          >
            {halted ? "Resume All Runners" : "Confirm Emergency Halt"}
          </button>
        </div>
      }
    >
      {!halted ? (
        <div>
          <label className="desk-label">
            Type <span className="mono">HALT</span> to confirm pause across {workspace.bots.length} bot runners
          </label>
          <input
            className="form-control mono text-uppercase"
            placeholder="HALT"
            value={confirmWord}
            onChange={(e) => setConfirmWord(e.target.value)}
            autoFocus
          />
        </div>
      ) : (
        <div className="desk-inline-alert is-ok">
          Deriv WS connection is healthy. Ready to resume normal bot execution.
        </div>
      )}
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 14 · CONTRACT SETTLEMENT RECEIPT & REPEAT TRADE
   ═══════════════════════════════════════════════════════════════════════════ */
function TradeDetailModal({
  tradeId,
  tradesFeed,
  onClose,
}: {
  tradeId: string;
  tradesFeed: LastTradesFeedDTO;
  onClose: () => void;
}) {
  const { pushToast, markFlashedTrade } = useOperatorUI();
  const repeat = useExecuteQuickTrade();
  const trade = tradesFeed.trades.find((t) => t.id === tradeId) ?? tradesFeed.trades[0];

  if (!trade) return null;

  const copyJson = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(trade, null, 2));
    pushToast({ tone: "info", title: `Copied Contract #${trade.derivContractId} JSON receipt` });
  };

  const runAgain = async () => {
    const settled = await repeat.mutateAsync({
      symbol: trade.symbol,
      contractType: trade.contractType,
      strategy: trade.strategy,
      stake: trade.stake,
      duration: trade.duration,
      durationUnit: trade.durationUnit,
      packageCode: trade.packageCode,
    });
    markFlashedTrade(settled.id);
    pushToast({
      tone: settled.isWin ? "success" : "warning",
      title: `Repeated #${settled.tradeNumber}: ${settled.isWin ? "+" : ""}${formatCurrency(settled.profit)}`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code={`#${trade.tradeNumber}`}
      eyebrow={`Deriv Contract · ${trade.derivContractId}`}
      title={`${trade.symbol} · ${trade.contractLabel}`}
      subtitle={`Executed via ${trade.botName} and attributed to pool ${trade.packageCode}.`}
      size="md"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={copyJson}>
            <Icon name="copy" size={14} /> Copy JSON Receipt
          </button>
          <button type="button" className="btn-brand" disabled={repeat.isPending} onClick={runAgain}>
            <Icon name="refresh" size={14} /> {repeat.isPending ? "Executing…" : "Repeat Exact Order"}
          </button>
        </div>
      }
    >
      <dl className="auth-kv">
        <dt>Outcome</dt>
        <dd className={trade.isWin ? "text-win mono" : "text-loss mono"}>
          {trade.isWin ? "WON" : "LOST"} ({trade.profit >= 0 ? "+" : ""}
          {formatCurrency(trade.profit)})
        </dd>
        <dt>Stake / Payout</dt>
        <dd className="mono">
          {formatCurrency(trade.stake)} → {formatCurrency(trade.payout)}
        </dd>
        <dt>Entry → Exit Spot</dt>
        <dd className="mono">
          {trade.entrySpot} → {trade.exitSpot}
        </dd>
        <dt>Pool Package</dt>
        <dd className="mono">{trade.packageCode}</dd>
        <dt>Investor Pool Net (80%)</dt>
        <dd className="mono">
          {trade.profit > 0 ? `+${formatCurrency(trade.profit * 0.8)}` : formatCurrency(trade.profit)}
        </dd>
        <dt>Timestamp</dt>
        <dd className="mono">{trade.timestampIso}</dd>
      </dl>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 15 · INVESTOR POSITION & LEDGER DOSSIER
   ═══════════════════════════════════════════════════════════════════════════ */
function InvestorLedgerModal({
  investorId,
  investorWatch,
  onClose,
}: {
  investorId: string;
  investorWatch: InvestorWatchDTO;
  onClose: () => void;
}) {
  const { openOverlay } = useOperatorUI();
  const inv =
    investorWatch.investors.find((i) => i.id === investorId) ?? investorWatch.investors[0];

  return (
    <DeskModalShell
      code={inv.handle}
      eyebrow={`Investor Dossier · ${inv.tier} Tier`}
      title={inv.fullName}
      subtitle={`${inv.emailMasked} · Country ${inv.country} · Joined ${inv.joinedAt}`}
      size="md"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          {inv.kycStatus !== "approved" ? (
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openOverlay({ type: "kyc-review", investorId: inv.id })}
            >
              Open KYC Review
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openOverlay({ type: "announce-broadcast" })}
            >
              Send Update
            </button>
          )}
          <button type="button" className="btn-brand" onClick={onClose}>
            Close Dossier
          </button>
        </div>
      }
    >
      <dl className="auth-kv">
        <dt>Total Capital Committed</dt>
        <dd className="mono">{formatCurrency(inv.totalInvested, "USD", 0)} ({inv.totalSlots} slots)</dd>
        <dt>Active Pool Packages</dt>
        <dd className="mono">{inv.activePackages.join(", ")}</dd>
        <dt>Realized &amp; Accrued Net Earnings</dt>
        <dd className="mono text-win">+{formatCurrency(inv.netEarnings)} (+{inv.currentROI}%)</dd>
        <dt>Available Wallet Balance</dt>
        <dd className="mono">{formatCurrency(inv.walletBalance)}</dd>
        <dt>KYC Compliance Status</dt>
        <dd className="mono">
          Level {inv.kycLevel} · {inv.kycStatus.toUpperCase()}
        </dd>
        <dt>Declared Source of Funds</dt>
        <dd>{inv.sourceOfFunds}</dd>
      </dl>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 16 · STATEMENT & AUDIT LEDGER EXPORTER (REAL CSV/JSON DOWNLOAD)
   ═══════════════════════════════════════════════════════════════════════════ */
function ExportReportsModal({
  defaultScope = "trades",
  tradesFeed,
  distribution,
  funds,
  workspace,
  onClose,
}: {
  defaultScope?: "trades" | "distributions" | "treasury" | "audit";
  tradesFeed: LastTradesFeedDTO;
  distribution: ProfitDistributionDTO;
  funds: FundsFlowDTO;
  workspace: OperatorWorkspaceDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const [scope, setScope] = useState(defaultScope);
  const [format, setFormat] = useState<"csv" | "json">("csv");

  const download = () => {
    const dataset =
      scope === "trades"
        ? tradesFeed.trades
        : scope === "distributions"
          ? distribution.breakdown
          : scope === "treasury"
            ? [...funds.pendingDeposits, ...workspace.payoutQueue]
            : workspace.auditLogs;

    let content = "";
    let mime = "application/json";
    if (format === "json") {
      content = JSON.stringify(dataset, null, 2);
    } else {
      mime = "text/csv;charset=utf-8";
      const rows = dataset as unknown as Array<Record<string, unknown>>;
      const headers = Object.keys(rows[0] ?? {});
      content = [
        headers.join(","),
        ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
      ].join("\n");
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trademo-${scope}-2026-10-19.${format}`;
    a.click();
    URL.revokeObjectURL(url);

    pushToast({
      tone: "success",
      title: `Downloaded trademo-${scope}-2026-10-19.${format}`,
      detail: `${dataset.length} structured records exported.`,
    });
    onClose();
  };

  return (
    <DeskModalShell
      code="EXPORT"
      eyebrow="Reporting & Tax Compliance"
      title="Export Desk Statement"
      subtitle="Generate downloadable CSV or structured JSON ledgers directly from live operator records."
      size="sm"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-brand" onClick={download}>
            <Icon name="download" size={15} /> Download .{format.toUpperCase()}
          </button>
        </div>
      }
    >
      <div className="d-flex flex-column gap-3">
        <div>
          <label className="desk-label">Dataset Scope</label>
          <select
            className="form-select"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option value="trades">Settled Trade Blotter ({tradesFeed.trades.length} rows)</option>
            <option value="distributions">Pool Profit Waterfall ({distribution.breakdown.length} pools)</option>
            <option value="treasury">Deposits &amp; Withdrawals Ledger</option>
            <option value="audit">Immutable Operator Audit Log ({workspace.auditLogs.length} events)</option>
          </select>
        </div>
        <div>
          <label className="desk-label">File Format</label>
          <div className="desk-chip-grid">
            <button
              type="button"
              className={`desk-chip mono ${format === "csv" ? "is-selected" : ""}`}
              onClick={() => setFormat("csv")}
            >
              CSV Spreadsheet
            </button>
            <button
              type="button"
              className={`desk-chip mono ${format === "json" ? "is-selected" : ""}`}
              onClick={() => setFormat("json")}
            >
              JSON Payload
            </button>
          </div>
        </div>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 17 · ⌘K OPERATOR COMMAND PALETTE
   ═══════════════════════════════════════════════════════════════════════════ */
function CommandPaletteModal({
  workspace,
  onClose,
}: {
  workspace: OperatorWorkspaceDTO;
  onClose: () => void;
}) {
  const router = useRouter();
  const { openOverlay } = useOperatorUI();
  const [q, setQ] = useState("");

  const quickCommands: Array<{ label: string; tag: string; run: () => void }> = [
    { label: "Open Trade Scheduler Desk (Page D-2)", tag: "Route · /dashboard/schedules", run: () => { onClose(); router.push("/dashboard/schedules"); } },
    { label: "Execute Instant Deriv Trade", tag: "Modal · ORD-TICKET", run: () => openOverlay({ type: "quick-trade" }) },
    { label: "Launch New Pool Package Wizard (4 Steps)", tag: "Wizard · WIZ-PKG", run: () => openOverlay({ type: "new-package-wizard" }) },
    { label: "Schedule Trade Sequence Wizard (3 Steps)", tag: "Wizard · WIZ-SCH", run: () => openOverlay({ type: "schedule-wizard" }) },
    { label: "Distribute Pending Pool Profits ($2,917)", tag: "Wizard · WIZ-DIST", run: () => openOverlay({ type: "distribute-wizard" }) },
    { label: "Process Batch Investor Payouts", tag: "Wizard · WIZ-PAY", run: () => openOverlay({ type: "payout-batch-wizard" }) },
    { label: "Deploy Automated Bot Runner Wizard", tag: "Wizard · WIZ-BOT", run: () => openOverlay({ type: "bot-deploy-wizard" }) },
    { label: "Verify Pending Deposits", tag: "Modal · DEP-VERIFY", run: () => openOverlay({ type: "deposit-verify" }) },
    { label: "Review Investor KYC Queue", tag: "Modal · KYC-DESK", run: () => openOverlay({ type: "kyc-review" }) },
    { label: "Rebalance Pool Capital & Reserve", tag: "Modal · TREAS-BAL", run: () => openOverlay({ type: "capital-rebalance" }) },
    { label: "Configure Risk Circuit Breakers", tag: "Modal · RISK-GUARD", run: () => openOverlay({ type: "risk-guardrails" }) },
    { label: "Deriv API Connections & Ping", tag: "Modal · DERIV-WS", run: () => openOverlay({ type: "deriv-connection" }) },
    { label: "Broadcast Investor Update", tag: "Modal · COMMS-TX", run: () => openOverlay({ type: "announce-broadcast" }) },
    { label: "Export CSV / JSON Statements", tag: "Modal · EXPORT", run: () => openOverlay({ type: "export-reports" }) },
    ...OPERATOR_NAV.map((n) => ({
      label: `Go to ${n.code} · ${n.label}`,
      tag: n.href,
      run: () => {
        onClose();
        router.push(n.href);
      },
    })),
    ...workspace.markets.map((m) => ({
      label: `Trade ${m.symbol} (${m.label} · ${m.spot})`,
      tag: "Quick Ticket",
      run: () => openOverlay({ type: "quick-trade", defaultSymbol: m.symbol }),
    })),
  ];

  const filtered = quickCommands.filter(
    (item) =>
      !q.trim() ||
      item.label.toLowerCase().includes(q.toLowerCase()) ||
      item.tag.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <DeskModalShell
      code="⌘K"
      eyebrow="Operator Command Search"
      title="Jump to Any Workflow, Symbol, or Route"
      size="md"
      onClose={onClose}
    >
      <input
        className="form-control mb-3"
        placeholder="Search wizards, modals, symbols (R_10, R_75), or pages (D-1..D-15)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="desk-palette-list">
        {filtered.slice(0, 12).map((item) => (
          <button key={item.label} type="button" className="desk-palette-item" onClick={item.run}>
            <span>{item.label}</span>
            <span className="mono small text-muted">{item.tag}</span>
          </button>
        ))}
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL 18 · OPERATOR SESSION, API KEYS & WORKSPACE PROFILE
   ═══════════════════════════════════════════════════════════════════════════ */
function OperatorSessionModal({
  workspace,
  onClose,
}: {
  workspace: OperatorWorkspaceDTO;
  onClose: () => void;
}) {
  const { pushToast } = useOperatorUI();
  const [apiKey] = useState("tmo_live_98f2a1c44b89e71d0c3a");

  const copyKey = async () => {
    await navigator.clipboard?.writeText(apiKey);
    pushToast({ tone: "info", title: "Operator API key copied to clipboard" });
  };

  return (
    <DeskModalShell
      code={workspace.operator.code}
      eyebrow="Operator Identity & Security"
      title={workspace.operator.fullName}
      subtitle={`${workspace.operator.email} · Dual Role (${workspace.operator.role.toUpperCase()})`}
      size="md"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <Link href="/auth/signin" className="btn-ghost btn-ghost--sm" onClick={onClose}>
            Sign Out
          </Link>
          <div className="d-flex gap-2">
            <Link href="/investor" className="btn-ghost btn-ghost--sm" onClick={onClose}>
              Switch to Investor View →
            </Link>
            <button type="button" className="btn-brand" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      }
    >
      <dl className="auth-kv mb-3">
        <dt>Two-Factor Authentication</dt>
        <dd className="text-win">Enabled (TOTP · 6-digit)</dd>
        <dt>Desk Clock Zone</dt>
        <dd className="mono">{workspace.operator.timezone}</dd>
        <dt>Active Deriv Session</dt>
        <dd className="mono">{workspace.connections[0]?.derivLoginId} (AES-256-GCM)</dd>
      </dl>
      <label className="desk-label">Operator Webhook / CLI Key</label>
      <div className="d-flex gap-2">
        <input className="form-control mono" readOnly value={apiKey} />
        <button type="button" className="btn-ghost btn-ghost--sm" onClick={copyKey}>
          <Icon name="copy" size={14} /> Copy
        </button>
      </div>
    </DeskModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MASTER MODAL HOST — RENDERS ANY OF THE 18 MODALS & MULTI-STEP WIZARDS
   ═══════════════════════════════════════════════════════════════════════════ */
export function OperatorModalHost({
  overlay,
  onClose,
  funds,
  investorWatch,
  distribution,
  tradesFeed,
  workspace,
}: {
  overlay: OverlayKind | null;
  onClose: () => void;
  funds: FundsFlowDTO;
  investorWatch: InvestorWatchDTO;
  distribution: ProfitDistributionDTO;
  tradesFeed: LastTradesFeedDTO;
  workspace: OperatorWorkspaceDTO;
}) {
  if (!overlay) return null;

  switch (overlay.type) {
    case "new-package-wizard":
      return <NewPackageWizard existingCount={funds.packages.length} onClose={onClose} />;
    case "schedule-wizard":
      return <ScheduleTradeWizard defaultSymbol={overlay.defaultSymbol} onClose={onClose} />;
    case "distribute-wizard":
      return <DistributeProfitsWizard distribution={distribution} onClose={onClose} />;
    case "payout-batch-wizard":
      return (
        <PayoutBatchWizard
          workspace={workspace}
          availableCapital={funds.availableCapital}
          onClose={onClose}
        />
      );
    case "bot-deploy-wizard":
      return (
        <BotDeployWizard
          defaultSymbol={overlay.defaultSymbol}
          funds={funds}
          workspace={workspace}
          onClose={onClose}
        />
      );
    case "quick-trade":
      return (
        <QuickTradeModal
          defaultSymbol={overlay.defaultSymbol}
          defaultPackage={overlay.defaultPackage}
          defaultStake={overlay.defaultStake}
          workspace={workspace}
          funds={funds}
          onClose={onClose}
        />
      );
    case "deriv-connection":
      return <DerivConnectionModal workspace={workspace} onClose={onClose} />;
    case "announce-broadcast":
      return <AnnounceBroadcastModal defaultAudience={overlay.defaultAudience} onClose={onClose} />;
    case "kyc-review":
      return (
        <KycReviewModal
          investorWatch={investorWatch}
          focusId={overlay.investorId}
          onClose={onClose}
        />
      );
    case "deposit-verify":
      return <DepositVerifyModal funds={funds} onClose={onClose} />;
    case "capital-rebalance":
      return <CapitalRebalanceModal funds={funds} onClose={onClose} />;
    case "risk-guardrails":
      return <RiskGuardrailsModal workspace={workspace} onClose={onClose} />;
    case "emergency-halt":
      return <EmergencyHaltModal workspace={workspace} onClose={onClose} />;
    case "trade-detail":
      return (
        <TradeDetailModal
          tradeId={overlay.tradeId}
          tradesFeed={tradesFeed}
          onClose={onClose}
        />
      );
    case "investor-ledger":
      return (
        <InvestorLedgerModal
          investorId={overlay.investorId}
          investorWatch={investorWatch}
          onClose={onClose}
        />
      );
    case "export-reports":
      return (
        <ExportReportsModal
          defaultScope={overlay.defaultScope}
          tradesFeed={tradesFeed}
          distribution={distribution}
          funds={funds}
          workspace={workspace}
          onClose={onClose}
        />
      );
    case "command-palette":
      return <CommandPaletteModal workspace={workspace} onClose={onClose} />;
    case "operator-session":
      return <OperatorSessionModal workspace={workspace} onClose={onClose} />;
  }
}
