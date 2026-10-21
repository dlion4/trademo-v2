"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EquityAndPoolsSection } from "@/components/dashboard/command-center/equity-curve-card";
import { LastTradesTableCard } from "@/components/dashboard/command-center/last-trades-table";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import {
  OperatorShell,
  formatDurationSeconds,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import type { InvestorRecordDTO, OverlayKind } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";
import { useCountUp } from "@/lib/hooks/use-motion";
import {
  useDistributePending,
  useReviewDeposit,
  useUpdateSchedule,
} from "@/lib/queries/use-dashboard";

/* ── Animated KPI Tile ── */
function KpiCard({
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
    <button type="button" className="cc-kpi hover-lift" onClick={onClick}>
      <div className="cc-kpi__top">
        <span className="cc-kpi__label">{label}</span>
        <span className="cc-kpi__icon">
          <Icon name={icon} size={15} />
        </span>
      </div>
      <div className="cc-kpi__value mono">{formatted}</div>
      <div className="cc-kpi__foot">
        <span className={cn("mono fw-semibold", deltaPositive ? "text-win" : "text-warning-ink")}>
          {delta}
        </span>
        <span className="cc-kpi__meta">{subMeta}</span>
      </div>
    </button>
  );
}

const invCol = createDeskColumnHelper<InvestorRecordDTO>();

function InvestorMiniRoster({ investors }: { investors: InvestorRecordDTO[] }) {
  const { openOverlay, inspectEntity } = useOperatorUI();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () =>
      invCol.columns([
        invCol.accessor("handle", {
          header: "Investor",
          cell: (info) => (
            <div>
              <span className="mono fw-semibold d-block">{info.getValue()}</span>
              <span className="cc-cell-sub">{info.row.original.fullName}</span>
            </div>
          ),
        }),
        invCol.accessor("totalInvested", {
          header: "Capital",
          cell: (info) => (
            <span className="mono">
              {formatCurrency(info.getValue(), "USD", 0)} ({info.row.original.totalSlots}sl)
            </span>
          ),
        }),
        invCol.accessor("netEarnings", {
          header: "Net P&L",
          cell: (info) => (
            <span className="mono text-win">+{formatCurrency(info.getValue())}</span>
          ),
        }),
        invCol.accessor("kycStatus", {
          header: "KYC",
          cell: (info) => {
            const st = info.getValue();
            return (
              <span className={cn("pill", st === "approved" ? "pill-live" : "pill-amber")}>
                {st === "approved" ? `L${info.row.original.kycLevel}` : "PENDING"}
              </span>
            );
          },
        }),
      ]),
    [],
  );

  const table = useDeskTable({
    data: investors.slice(0, 5),
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="table-responsive mt-3">
      <table className="table desk-table mb-0">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={cn(header.column.getCanSort() && "is-sortable")}
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="cc-clickable-row"
              onClick={() => inspectEntity({ kind: "investor", id: row.original.id })}
              onDoubleClick={() =>
                openOverlay({ type: "investor-ledger", investorId: row.original.id })
              }
            >
              {row.getAllCells().map((cell) => (
                <td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main D-1 Command Center Content ── */
function CommandCenterBody({
  live,
}: {
  live: OperatorBundleProps & { nextCountdownSeconds: number };
}) {
  const { openOverlay, openDrawerTab, inspectEntity, pushToast } = useOperatorUI();
  const updateSchedule = useUpdateSchedule();
  const reviewDeposit = useReviewDeposit();
  const distributePending = useDistributePending();

  const { kpis, lastTrades, schedules, funds, investors, distribution, workspace } = live;
  const countdownText = formatDurationSeconds(live.nextCountdownSeconds);

  const quickActions: Array<{
    code: string;
    label: string;
    detail: string;
    icon: IconName;
    overlay: OverlayKind;
  }> = [
    {
      code: "ACT-01",
      label: "Execute Trade",
      detail: "Instant CALL/PUT or Digit contract on Deriv WS",
      icon: "bolt",
      overlay: { type: "quick-trade" },
    },
    {
      code: "ACT-02",
      label: "Schedule Sequence",
      detail: "3-step timed run across PKG-01..PKG-03",
      icon: "calendar",
      overlay: { type: "schedule-wizard" },
    },
    {
      code: "ACT-03",
      label: "New Pool Package",
      detail: "4-step crowdfunding syndicate builder",
      icon: "package",
      overlay: { type: "new-package-wizard" },
    },
    {
      code: "ACT-04",
      label: "Investor Broadcast",
      detail: "Send In-App, Email & Telegram pool notice",
      icon: "mail",
      overlay: { type: "announce-broadcast" },
    },
    {
      code: "ACT-05",
      label: "Process Payouts",
      detail: `${kpis.pendingPayouts.count} pending requests (${formatCurrency(kpis.pendingPayouts.totalAmount, "USD", 0)})`,
      icon: "wallet",
      overlay: { type: "payout-batch-wizard" },
    },
    {
      code: "ACT-06",
      label: "Verify Deposits",
      detail: `${kpis.pendingDeposits.count} incoming funding items`,
      icon: "vault",
      overlay: { type: "deposit-verify" },
    },
    {
      code: "ACT-07",
      label: "Deploy Bot Runner",
      detail: "3-step worker launch with 8-point pre-check",
      icon: "bot",
      overlay: { type: "bot-deploy-wizard" },
    },
    {
      code: "ACT-08",
      label: "Export Statements",
      detail: "Download CSV / JSON trade & tax ledgers",
      icon: "download",
      overlay: { type: "export-reports" },
    },
  ];

  const handleBatchDistribute = async () => {
    if (distribution.pending <= 0) {
      openOverlay({ type: "distribute-wizard" });
      return;
    }
    const res = await distributePending.mutateAsync(undefined);
    pushToast({
      tone: "success",
      title: `Distributed ${formatCurrency(res.releasedAmount)} across active pools`,
      detail: "Investor wallets credited pro-rata and High-Water Mark snapshots logged.",
    });
  };

  return (
    <div className="container-fluid px-0 cc-canvas">
      {/* ── Desk Header Strip ── */}
      <div className="cc-header">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="desk-code-tag mono">D-1</span>
            <span className="eyebrow-label">Operator Command Center · Live Session</span>
          </div>
          <h1 className="cc-title">Command Center Overview</h1>
          <p className="cc-subtitle mb-0">
            Real-time execution blotter, scheduled Deriv sequences, pooled capital liquidity, and
            investor profit distributions.
          </p>
        </div>

        <div className="cc-header__actions">
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => openDrawerTab("queue")}
          >
            <Icon name="panelRight" size={15} /> Inspector Drawer
          </button>
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => openOverlay({ type: "emergency-halt" })}
          >
            <Icon name={workspace.risk.emergencyHalted ? "play" : "pause"} size={14} />{" "}
            {workspace.risk.emergencyHalted ? "Resume Bots" : "Halt Bots"}
          </button>
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => openOverlay({ type: "new-package-wizard" })}
          >
            <Icon name="package" size={15} /> New Pool Wizard
          </button>
          <button
            type="button"
            className="btn-brand"
            onClick={() => openOverlay({ type: "quick-trade" })}
          >
            <Icon name="bolt" size={15} /> Execute Trade
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 1 · OPERATOR KPI STRIP (6 COUNT-UP CARDS)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="row g-3 row-cols-1 row-cols-sm-2 row-cols-xl-3 row-cols-xxl-6 cc-section" aria-label="Operator KPIs">
        <div className="col">
          <KpiCard
            label="Total Capital"
            rawValue={kpis.totalCapital}
            format="currency"
            delta={`▲ +${formatCurrency(kpis.capitalDeltaToday, "USD", 0)}`}
            subMeta="Rebalance →"
            icon="vault"
            onClick={() => openOverlay({ type: "capital-rebalance" })}
          />
        </div>
        <div className="col">
          <KpiCard
            label="Active Investors"
            rawValue={kpis.activeInvestors}
            format="integer"
            delta={`▲ +${kpis.newInvestorsToday} today`}
            subMeta={`${kpis.pendingKYC} pending KYC →`}
            icon="users"
            onClick={() => openOverlay({ type: "kyc-review" })}
          />
        </div>
        <div className="col">
          <KpiCard
            label="Total Pool Profit"
            rawValue={kpis.totalProfit}
            format="currency"
            prefix="+"
            delta={`▲ +${kpis.profitPercent}%`}
            subMeta="Waterfall →"
            icon="trendUp"
            onClick={() => openOverlay({ type: "distribute-wizard" })}
          />
        </div>
        <div className="col">
          <KpiCard
            label="Scheduled Today"
            rawValue={kpis.scheduledToday}
            format="integer"
            delta={`Next ${countdownText}`}
            subMeta={`${kpis.schedulesCompletedToday}/${kpis.scheduledToday} run →`}
            icon="calendar"
            onClick={() => openOverlay({ type: "schedule-wizard" })}
          />
        </div>
        <div className="col">
          <KpiCard
            label="Trades Today"
            rawValue={kpis.tradesToday}
            format="integer"
            delta={`${kpis.winsToday}W / ${kpis.lossesToday}L`}
            subMeta="Order Ticket →"
            icon="activity"
            onClick={() => openOverlay({ type: "quick-trade" })}
          />
        </div>
        <div className="col">
          <KpiCard
            label="Pending Payouts"
            rawValue={kpis.pendingPayouts.count}
            format="integer"
            suffix={` ($${Math.round(kpis.pendingPayouts.totalAmount)})`}
            delta={kpis.pendingPayouts.count > 0 ? "Action queued" : "All settled"}
            deltaPositive={kpis.pendingPayouts.count === 0}
            subMeta="Batch Pay →"
            icon="wallet"
            onClick={() => openOverlay({ type: "payout-batch-wizard" })}
          />
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 1B · EQUITY CURVE & ACTIVE POOLS STRIP
          ═════════════════════════════════════════════════════════════════════ */}
      <EquityAndPoolsSection curve={funds.equityCurve} packages={funds.packages} />

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 2 & SECTION 3 · EXECUTION BLOTTER + UPCOMING SCHEDULES
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="row g-3 cc-section" aria-label="Recent trades and scheduled executions">
        <div className="col-12 col-xl-7">
          <LastTradesTableCard feed={lastTrades} />
        </div>

        <div className="col-12 col-xl-5">
          <div className="cc-panel h-100 d-flex flex-column">
            <div className="cc-panel__head">
              <div>
                <span className="eyebrow-label">Section 3 · Upcoming Scheduled Trades</span>
                <h2 className="cc-panel__title">Execution Schedule Queue</h2>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="cc-next-pill mono">
                  <span className="live-dot" /> Next in {countdownText}
                </span>
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm"
                  onClick={() => openOverlay({ type: "schedule-wizard" })}
                >
                  <Icon name="plus" size={14} /> Add
                </button>
              </div>
            </div>

            <div className="cc-schedule-list flex-grow-1">
              {schedules.schedules.map((sch) => (
                <div
                  key={sch.id}
                  className={cn("cc-schedule-row", sch.status === "paused" && "is-paused")}
                  onClick={() => inspectEntity({ kind: "schedule", id: sch.id })}
                >
                  <div className="cc-schedule-time mono">
                    <strong>{sch.executeAt}</strong>
                    <span>UTC</span>
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center gap-2">
                      <strong className="mono">{sch.symbol}</strong>
                      <span className="pill">{sch.strategy}</span>
                      <span className="mono fw-semibold">{formatCurrency(sch.stake, "USD", 0)}</span>
                    </div>
                    <div className="small text-secondary text-truncate mt-1">
                      {sch.name} · Pools: <span className="mono">{sch.packageCodes.join(", ")}</span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="cc-row-btn"
                      disabled={updateSchedule.isPending || sch.status === "completed"}
                      onClick={async () => {
                        await updateSchedule.mutateAsync({ id: sch.id, action: "run_now" });
                        pushToast({
                          tone: "success",
                          title: `Executed ${sch.symbol} (${sch.strategy}) immediately`,
                        });
                      }}
                    >
                      {sch.status === "completed" ? "Done" : "Run"}
                    </button>
                    <button
                      type="button"
                      className="cc-row-btn"
                      onClick={() => updateSchedule.mutate({ id: sch.id, action: "toggle" })}
                    >
                      {sch.status === "paused" ? "Resume" : "Pause"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cc-blotter-foot">
              <span className="mono small text-secondary">
                {schedules.completedToday} of {schedules.totalToday} windows completed today
              </span>
              <Link href="/dashboard/schedules" className="small fw-semibold">
                View Full Schedule →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 4 · FUNDS FLOW & INVESTOR WATCH (2-COLUMN PANELS)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="row g-3 cc-section" aria-label="Funds flow and investor watch">
        {/* Left: Funds Flow */}
        <div className="col-12 col-lg-6">
          <div className="cc-panel h-100 d-flex flex-column">
            <div className="cc-panel__head">
              <div>
                <span className="eyebrow-label">Section 4A · Treasury &amp; Margin</span>
                <h2 className="cc-panel__title">Funds Flow &amp; Pool Liquidity</h2>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm"
                  onClick={() => openOverlay({ type: "deposit-verify" })}
                >
                  Deposits ({kpis.pendingDeposits.count})
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm"
                  onClick={() => openOverlay({ type: "capital-rebalance" })}
                >
                  Rebalance
                </button>
              </div>
            </div>

            <div className="cc-funds-metrics">
              <div>
                <span>Total Capital</span>
                <strong className="mono">{formatCurrency(funds.totalCapital, "USD", 0)}</strong>
              </div>
              <div>
                <span>In Active Trades</span>
                <strong className="mono">{formatCurrency(funds.capitalInTrades, "USD", 0)}</strong>
              </div>
              <div>
                <span>Available Reserve</span>
                <strong className="mono text-win">
                  {formatCurrency(funds.availableCapital, "USD", 0)}
                </strong>
              </div>
              <div>
                <span>Verified Today</span>
                <strong className="mono text-win">
                  +{formatCurrency(funds.todayDeposits, "USD", 0)}
                </strong>
              </div>
            </div>

            {/* Segmented Pool Split Bar */}
            <div className="px-3 py-3 border-bottom">
              <div className="d-flex justify-content-between small text-secondary mb-2">
                <span>Active Margin Split Across Trading Pools</span>
                <span className="mono">
                  Reserve Ratio {funds.reserveRatioPercent}%
                </span>
              </div>
              <div className="cc-segmented-bar chart-draw">
                {funds.packages
                  .filter((p) => p.capitalSharePercent > 0)
                  .map((p, idx) => (
                    <span
                      key={p.code}
                      className={`seg-${idx + 1}`}
                      style={{ width: `${p.capitalSharePercent}%` }}
                      title={`${p.code}: ${p.capitalSharePercent}%`}
                    />
                  ))}
              </div>
              <div className="d-flex flex-wrap gap-3 mt-2 mono small">
                {funds.packages
                  .filter((p) => p.capitalSharePercent > 0)
                  .map((p) => (
                    <span key={p.code}>
                      <strong>{p.code}</strong>: {p.capitalSharePercent}% (
                      {formatCurrency(p.totalCapital, "USD", 0)})
                    </span>
                  ))}
              </div>
            </div>

            {/* Inline Pending Deposits Queue */}
            <div className="p-3 flex-grow-1">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="eyebrow-label">Incoming Slot Deposits Queue</span>
                <Link href="/dashboard/deposits" className="small fw-semibold">
                  All Deposits →
                </Link>
              </div>
              <div className="d-flex flex-column gap-2">
                {funds.pendingDeposits.map((dep) => (
                  <div key={dep.id} className="cc-inline-item">
                    <div>
                      <span className="mono fw-semibold">{dep.reference}</span> ·{" "}
                      <span>{dep.investorName}</span>
                      <span className="d-block small text-secondary">
                        {dep.packageCode} ({dep.slots} slots) · {dep.method}
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <strong className="mono">{formatCurrency(dep.amount, "USD", 0)}</strong>
                      {dep.status === "pending" ? (
                        <button
                          type="button"
                          className="cc-row-btn"
                          disabled={reviewDeposit.isPending}
                          onClick={async () => {
                            await reviewDeposit.mutateAsync({ id: dep.id, action: "verify" });
                            pushToast({
                              tone: "success",
                              title: `Verified ${dep.reference} (+$${dep.amount.toLocaleString()})`,
                            });
                          }}
                        >
                          Verify
                        </button>
                      ) : (
                        <span className="pill pill-live">Verified</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Investor Watch */}
        <div className="col-12 col-lg-6">
          <div className="cc-panel h-100 d-flex flex-column">
            <div className="cc-panel__head">
              <div>
                <span className="eyebrow-label">Section 4B · Backer Roster &amp; KYC</span>
                <h2 className="cc-panel__title">Investor Watch</h2>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm"
                  onClick={() => openOverlay({ type: "kyc-review" })}
                >
                  Pending KYC ({investors.pendingKYC})
                </button>
                <Link href="/dashboard/investors" className="btn-ghost btn-ghost--sm">
                  Full Roster →
                </Link>
              </div>
            </div>

            <div className="cc-funds-metrics">
              <div>
                <span>Total Registered</span>
                <strong className="mono">{investors.totalInvestors}</strong>
              </div>
              <div>
                <span>Active in Pools</span>
                <strong className="mono">{investors.activeInvestors}</strong>
              </div>
              <div>
                <span>New Joined Today</span>
                <strong className="mono text-win">+{investors.newToday}</strong>
              </div>
              <div>
                <span>Top Allocation</span>
                <strong className="mono">
                  {investors.topInvestor.handle} (
                  {formatCurrency(investors.topInvestor.amount, "USD", 0)})
                </strong>
              </div>
            </div>

            <div className="px-3 pb-3 flex-grow-1">
              <InvestorMiniRoster investors={investors.investors} />
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 5 · PROFIT DISTRIBUTION WATERFALL & HWM LEDGER
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="cc-section" aria-label="Profit distribution status">
        <div className="cc-panel">
          <div className="cc-panel__head">
            <div>
              <span className="eyebrow-label">Section 5 · 80 / 20 High-Water Mark Waterfall</span>
              <h2 className="cc-panel__title">Profit Distribution &amp; Settlement Ledger</h2>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost btn-ghost--sm"
                onClick={() => openOverlay({ type: "distribute-wizard" })}
              >
                Open 3-Step Waterfall Wizard
              </button>
              <button
                type="button"
                className="btn-brand"
                disabled={distributePending.isPending || distribution.pending <= 0}
                onClick={handleBatchDistribute}
              >
                <Icon name="split" size={15} />{" "}
                {distribution.pending > 0
                  ? `Distribute Pending (${formatCurrency(distribution.pending)})`
                  : "All Pending Profits Distributed"}
              </button>
            </div>
          </div>

          <div className="cc-funds-metrics">
            <div>
              <span>Cumulative Pool P&amp;L</span>
              <strong className="mono text-win">+{formatCurrency(distribution.poolPnL)}</strong>
            </div>
            <div>
              <span>Operator Share ({distribution.operatorSharePercent}%)</span>
              <strong className="mono">+{formatCurrency(distribution.operatorShare)}</strong>
            </div>
            <div>
              <span>Distributed to Wallets</span>
              <strong className="mono">{formatCurrency(distribution.distributed)}</strong>
            </div>
            <div>
              <span>Pending Distribution</span>
              <strong className="mono text-warning-ink">
                {formatCurrency(distribution.pending)}
              </strong>
            </div>
          </div>

          <div className="p-3 border-bottom">
            <div className="d-flex justify-content-between align-items-center small mb-2">
              <span className="fw-semibold">
                Investor Profit Settlement Progress ({distribution.distributionPercent}% distributed)
              </span>
              <span className="mono text-secondary">
                Last batch: {distribution.lastRunAt} · Next scheduled: {distribution.nextScheduledAt}
              </span>
            </div>
            <div className="cc-dist-progress">
              <span
                className="chart-draw"
                style={{ width: `${distribution.distributionPercent}%` }}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table desk-table mb-0">
              <thead>
                <tr>
                  <th>Pool Code</th>
                  <th>Syndicate Name</th>
                  <th className="text-end">Backers</th>
                  <th className="text-end">Gross P&amp;L</th>
                  <th className="text-end">Operator Cut (20%)</th>
                  <th className="text-end">Distributed</th>
                  <th className="text-end">Pending Credit</th>
                  <th className="text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {distribution.breakdown.map((row) => (
                  <tr
                    key={row.packageCode}
                    className="cc-clickable-row"
                    onClick={() => inspectEntity({ kind: "package", code: row.packageCode })}
                  >
                    <td className="mono fw-semibold">{row.packageCode}</td>
                    <td>{row.packageName}</td>
                    <td className="text-end mono">{row.investorsCount}</td>
                    <td className="text-end mono text-win">+{formatCurrency(row.grossPnL)}</td>
                    <td className="text-end mono">{formatCurrency(row.operatorCut)}</td>
                    <td className="text-end mono">{formatCurrency(row.distributed)}</td>
                    <td className="text-end mono fw-semibold">
                      {formatCurrency(row.pending)}
                    </td>
                    <td className="text-end">
                      <span
                        className={cn(
                          "pill",
                          row.pending === 0 ? "pill-live" : "pill-amber",
                        )}
                      >
                        {row.pending === 0 ? "Settled" : "Ready"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 6 · DESK QUICK ACTIONS MATRIX (8 WORKFLOW TILES)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="cc-section mb-4" aria-label="Operator quick actions">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="eyebrow-label">Section 6 · Instant Desk Workflows &amp; Wizards</span>
          <span className="mono small text-muted">Press ⌘K anywhere for instant search</span>
        </div>
        <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-4">
          {quickActions.map((act) => (
            <div className="col" key={act.code}>
              <button
                type="button"
                className="cc-action-tile hover-lift"
                onClick={() => openOverlay(act.overlay)}
              >
                <div className="d-flex align-items-center justify-content-between w-100">
                  <span className="cc-action-tile__icon">
                    <Icon name={act.icon} size={17} />
                  </span>
                  <span className="desk-code-tag mono">{act.code}</span>
                </div>
                <strong className="cc-action-tile__title">{act.label}</strong>
                <span className="cc-action-tile__desc">{act.detail}</span>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CommandCenterPage({ bundle }: { bundle: OperatorBundleProps }) {
  return (
    <OperatorShell rootClass="page-dashboard-command-center" bundle={bundle}>
      {(live) => <CommandCenterBody live={live} />}
    </OperatorShell>
  );
}
