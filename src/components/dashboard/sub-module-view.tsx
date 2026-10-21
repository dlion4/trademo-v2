"use client";

import Link from "next/link";

import { LastTradesTableCard } from "@/components/dashboard/command-center/last-trades-table";
import { EquityAndPoolsSection } from "@/components/dashboard/command-center/equity-curve-card";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import {
  OperatorShell,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { Icon } from "@/components/icons";
import { OPERATOR_NAV } from "@/lib/dashboard/nav";
import { formatCurrency } from "@/lib/format";
import { useReviewDeposit, useUpdateBot, useUpdateSchedule } from "@/lib/queries/use-dashboard";

function SubModuleBody({
  section,
  live,
  scheduleFilter,
}: {
  section: string;
  live: OperatorBundleProps & { nextCountdownSeconds: number };
  scheduleFilter?: string;
}) {
  const { openOverlay, openDrawerTab, inspectEntity } = useOperatorUI();
  const updateSchedule = useUpdateSchedule();
  const updateBot = useUpdateBot();
  const reviewDeposit = useReviewDeposit();

  const navItem =
    OPERATOR_NAV.find((n) => n.key === section) ?? OPERATOR_NAV[0];

  return (
    <div className="container-fluid px-0 cc-canvas">
      <div className="cc-header">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="desk-code-tag mono">{navItem.code}</span>
            <span className="eyebrow-label">Operator Console Module</span>
          </div>
          <h1 className="cc-title">{navItem.label}</h1>
          <p className="cc-subtitle mb-0">{navItem.summary}</p>
        </div>
        <div className="cc-header__actions">
          <Link href="/dashboard" className="btn-ghost btn-ghost--sm">
            ← Command Center (D-1)
          </Link>
          <Link href="/dashboard/schedules" className="btn-ghost btn-ghost--sm">
            Trade Scheduler (D-2) →
          </Link>
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => openDrawerTab("feed")}
          >
            <Icon name="panelRight" size={15} /> Inspector Drawer
          </button>
          <button
            type="button"
            className="btn-brand"
            onClick={() => openOverlay(navItem.primaryOverlay)}
          >
            <Icon name="plus" size={14} /> {navItem.primaryActionLabel}
          </button>
        </div>
      </div>

      {scheduleFilter ? (
        <div className="cc-panel p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="desk-code-tag mono">SCHEDULE DRILL-DOWN</span>
            <span className="small">
              Showing settled contract blotter attributed to sequence{" "}
              <strong className="mono">{scheduleFilter}</strong>.
            </span>
          </div>
          <div className="d-flex gap-2">
            <Link href="/dashboard/trades" className="btn-ghost btn-ghost--sm">
              Clear Filter
            </Link>
            <Link href="/dashboard/schedules" className="btn-brand py-1 px-3 small">
              ← Back to Scheduler (D-2)
            </Link>
          </div>
        </div>
      ) : null}

      {/* Live contextual ledger for the active module */}
      {(section === "trades" || section === "live") && (
        <LastTradesTableCard feed={live.lastTrades} />
      )}

      {(section === "packages" || section === "analytics" || section === "funds") && (
        <EquityAndPoolsSection curve={live.funds.equityCurve} packages={live.funds.packages} />
      )}

      {section === "schedules" && (
        <div className="cc-panel">
          <div className="cc-panel__head">
            <h2 className="cc-panel__title">Active Scheduled Sequences ({live.schedules.schedules.length})</h2>
            <button
              type="button"
              className="btn-brand"
              onClick={() => openOverlay({ type: "schedule-wizard" })}
            >
              + New Schedule Wizard
            </button>
          </div>
          <div className="table-responsive">
            <table className="table desk-table mb-0">
              <thead>
                <tr>
                  <th>UTC Window</th>
                  <th>Schedule Name</th>
                  <th>Symbol</th>
                  <th>Strategy</th>
                  <th className="text-end">Stake</th>
                  <th>Pools</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {live.schedules.schedules.map((s) => (
                  <tr
                    key={s.id}
                    className="cc-clickable-row"
                    onClick={() => inspectEntity({ kind: "schedule", id: s.id })}
                  >
                    <td className="mono">{s.executeAt}–{s.windowEnd}</td>
                    <td className="fw-semibold">{s.name}</td>
                    <td className="mono">{s.symbol}</td>
                    <td>{s.strategy}</td>
                    <td className="text-end mono">{formatCurrency(s.stake, "USD", 0)}</td>
                    <td className="mono">{s.packageCodes.join(", ")}</td>
                    <td><span className="pill">{s.status}</span></td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="cc-row-btn"
                        onClick={() => updateSchedule.mutate({ id: s.id, action: "toggle" })}
                      >
                        {s.status === "paused" ? "Resume" : "Pause"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "markets" && (
        <div className="cc-panel">
          <div className="cc-panel__head">
            <h2 className="cc-panel__title">Deriv Live Quote Board</h2>
          </div>
          <div className="table-responsive">
            <table className="table desk-table mb-0">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Instrument</th>
                  <th>Asset Class</th>
                  <th className="text-end">Spot</th>
                  <th className="text-end">24h</th>
                  <th className="text-end">Payout</th>
                  <th className="text-end">Order</th>
                </tr>
              </thead>
              <tbody>
                {live.workspace.markets.map((m) => (
                  <tr key={m.symbol}>
                    <td className="mono fw-semibold">{m.symbol}</td>
                    <td>{m.label}</td>
                    <td>{m.market}</td>
                    <td className="text-end mono">{m.spot}</td>
                    <td className={`text-end mono ${m.changePercent >= 0 ? "text-win" : "text-loss"}`}>
                      {m.changePercent >= 0 ? "+" : ""}{m.changePercent}%
                    </td>
                    <td className="text-end mono">{m.payoutPercent}%</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="cc-row-btn"
                        onClick={() => openOverlay({ type: "quick-trade", defaultSymbol: m.symbol })}
                      >
                        Trade →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "bots" && (
        <div className="cc-panel">
          <div className="cc-panel__head">
            <h2 className="cc-panel__title">Automated Strategy Runners ({live.workspace.bots.length})</h2>
            <button
              type="button"
              className="btn-brand"
              onClick={() => openOverlay({ type: "bot-deploy-wizard" })}
            >
              + Deploy Bot Wizard
            </button>
          </div>
          <div className="table-responsive">
            <table className="table desk-table mb-0">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Runner Name</th>
                  <th>Symbol</th>
                  <th>Strategy</th>
                  <th>Pool</th>
                  <th className="text-end">Today P&amp;L</th>
                  <th>Status</th>
                  <th className="text-end">Control</th>
                </tr>
              </thead>
              <tbody>
                {live.workspace.bots.map((b) => (
                  <tr key={b.id}>
                    <td className="mono fw-semibold">{b.code}</td>
                    <td>{b.name}</td>
                    <td className="mono">{b.symbol}</td>
                    <td>{b.strategy}</td>
                    <td className="mono">{b.packageCode}</td>
                    <td className="text-end mono text-win">+{formatCurrency(b.pnlToday)}</td>
                    <td><span className="pill">{b.status}</span></td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="cc-row-btn"
                        onClick={() => updateBot.mutate({ action: "toggle", botId: b.id })}
                      >
                        {b.status === "running" ? "Pause" : "Start"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "investors" && (
        <div className="cc-panel">
          <div className="cc-panel__head">
            <h2 className="cc-panel__title">Pool Investors Roster ({live.investors.totalInvestors})</h2>
            <button
              type="button"
              className="btn-brand"
              onClick={() => openOverlay({ type: "kyc-review" })}
            >
              Review KYC ({live.investors.pendingKYC})
            </button>
          </div>
          <div className="table-responsive">
            <table className="table desk-table mb-0">
              <thead>
                <tr>
                  <th>Handle</th>
                  <th>Full Name</th>
                  <th>Tier</th>
                  <th className="text-end">Committed</th>
                  <th className="text-end">Net Earnings</th>
                  <th>KYC</th>
                  <th className="text-end">Ledger</th>
                </tr>
              </thead>
              <tbody>
                {live.investors.investors.map((i) => (
                  <tr key={i.id}>
                    <td className="mono fw-semibold">{i.handle}</td>
                    <td>{i.fullName}</td>
                    <td>{i.tier}</td>
                    <td className="text-end mono">{formatCurrency(i.totalInvested, "USD", 0)}</td>
                    <td className="text-end mono text-win">+{formatCurrency(i.netEarnings)}</td>
                    <td><span className="pill">{i.kycStatus}</span></td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="cc-row-btn"
                        onClick={() => openOverlay({ type: "investor-ledger", investorId: i.id })}
                      >
                        Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(section === "deposits" || section === "withdrawals") && (
        <div className="row g-3">
          <div className="col-lg-6">
            <div className="cc-panel p-3">
              <h2 className="cc-panel__title mb-3">Incoming Deposits</h2>
              {live.funds.pendingDeposits.map((d) => (
                <div key={d.id} className="cc-inline-item mb-2">
                  <div>
                    <strong className="mono">{d.reference}</strong> · {d.investorName} ({d.method})
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="mono fw-semibold">{formatCurrency(d.amount, "USD", 0)}</span>
                    {d.status === "pending" ? (
                      <button
                        type="button"
                        className="cc-row-btn"
                        onClick={() => reviewDeposit.mutate({ id: d.id, action: "verify" })}
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
          <div className="col-lg-6">
            <div className="cc-panel p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="cc-panel__title mb-0">Withdrawal Requests</h2>
                <button
                  type="button"
                  className="btn-brand py-1 px-2 small"
                  onClick={() => openOverlay({ type: "payout-batch-wizard" })}
                >
                  Batch Release Wizard
                </button>
              </div>
              {live.workspace.payoutQueue.map((p) => (
                <div key={p.id} className="cc-inline-item mb-2">
                  <div>
                    <strong className="mono">{p.reference}</strong> · {p.investorName} ({p.method})
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="mono fw-semibold">{formatCurrency(p.amount)}</span>
                    <span className="pill">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(section === "comms" || section === "logs" || section === "settings") && (
        <div className="cc-panel">
          <div className="cc-panel__head">
            <h2 className="cc-panel__title">Operator Activity &amp; Configuration Ledger</h2>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn-ghost btn-ghost--sm"
                onClick={() => openOverlay({ type: "deriv-connection" })}
              >
                Deriv WS Connections
              </button>
              <button
                type="button"
                className="btn-ghost btn-ghost--sm"
                onClick={() => openOverlay({ type: "risk-guardrails" })}
              >
                Risk Guardrails
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table desk-table mb-0">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {live.workspace.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="mono">{log.timestamp}</td>
                    <td>{log.actor}</td>
                    <td><span className="desk-code-tag mono">{log.category}</span></td>
                    <td className="mono fw-semibold">{log.action}</td>
                    <td>{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function OperatorSubModuleView({
  section,
  bundle,
  scheduleFilter,
}: {
  section: string;
  bundle: OperatorBundleProps;
  scheduleFilter?: string;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-command-center" bundle={bundle}>
      {(live) => (
        <SubModuleBody section={section} live={live} scheduleFilter={scheduleFilter} />
      )}
    </OperatorShell>
  );
}
