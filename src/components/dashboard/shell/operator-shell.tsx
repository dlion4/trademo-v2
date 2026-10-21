"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { OperatorModalHost } from "@/components/dashboard/modals/modals-suite-b";
import { BottomQuickDock } from "@/components/dashboard/shell/bottom-quick-dock";
import { OperatorUIProvider, useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { OperatorRightDrawer } from "@/components/dashboard/shell/right-drawer";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, OPERATOR_NAV } from "@/lib/dashboard/nav";
import type {
  FundsFlowDTO,
  InvestorWatchDTO,
  LastTradesFeedDTO,
  OperatorKpiSummaryDTO,
  OperatorWorkspaceDTO,
  ProfitDistributionDTO,
  UpcomingSchedulesDTO,
} from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";
import {
  useFundsFlow,
  useInvestorWatch,
  useLastTrades,
  useOperatorKpis,
  useOperatorWorkspace,
  useProfitDistribution,
  useUpcomingSchedules,
} from "@/lib/queries/use-dashboard";

export interface OperatorBundleProps {
  kpis: OperatorKpiSummaryDTO;
  lastTrades: LastTradesFeedDTO;
  schedules: UpcomingSchedulesDTO;
  funds: FundsFlowDTO;
  investors: InvestorWatchDTO;
  distribution: ProfitDistributionDTO;
  workspace: OperatorWorkspaceDTO;
}

export function formatDurationSeconds(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

function OperatorShellInner({
  rootClass,
  bundle,
  children,
}: {
  rootClass: string;
  bundle: OperatorBundleProps;
  children: (live: OperatorBundleProps & { nextCountdownSeconds: number }) => ReactNode;
}) {
  const pathname = usePathname();
  const {
    overlay,
    openOverlay,
    closeOverlay,
    drawer,
    openDrawerTab,
    toasts,
    dismissToast,
    theme,
    toggleTheme,
  } = useOperatorUI();

  const kpiQ = useOperatorKpis(bundle.kpis);
  const tradesQ = useLastTrades(12, bundle.lastTrades);
  const schedulesQ = useUpcomingSchedules(bundle.schedules);
  const fundsQ = useFundsFlow(bundle.funds);
  const investorsQ = useInvestorWatch(bundle.investors);
  const distQ = useProfitDistribution(bundle.distribution);
  const workspaceQ = useOperatorWorkspace(bundle.workspace);

  const live: OperatorBundleProps = {
    kpis: kpiQ.data ?? bundle.kpis,
    lastTrades: tradesQ.data ?? bundle.lastTrades,
    schedules: schedulesQ.data ?? bundle.schedules,
    funds: fundsQ.data ?? bundle.funds,
    investors: investorsQ.data ?? bundle.investors,
    distribution: distQ.data ?? bundle.distribution,
    workspace: workspaceQ.data ?? bundle.workspace,
  };

  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [countdown, setCountdown] = useState(live.schedules.nextInSeconds);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 23 * 60 + 14 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeConn =
    live.workspace.connections.find((c) => c.id === live.workspace.activeConnectionId) ??
    live.workspace.connections[0];
  const unreadCount = live.workspace.notifications.filter((n) => n.unread).length;
  const runningBotsCount = live.workspace.bots.filter((b) => b.status === "running").length;

  const badgeFor = (key: string): string | null => {
    switch (key) {
      case "schedules":
        return String(live.kpis.scheduledToday);
      case "live":
        return live.workspace.risk.emergencyHalted ? "HALT" : "LIVE";
      case "trades":
        return String(live.kpis.tradesToday);
      case "bots":
        return `${runningBotsCount} ON`;
      case "packages":
        return String(live.funds.packages.length);
      case "investors":
        return String(live.kpis.activeInvestors);
      case "deposits":
        return live.kpis.pendingDeposits.count > 0 ? String(live.kpis.pendingDeposits.count) : null;
      case "withdrawals":
        return live.kpis.pendingPayouts.count > 0 ? String(live.kpis.pendingPayouts.count) : null;
      default:
        return null;
    }
  };

  return (
    <div className={cn(rootClass, "op-shell", railCollapsed && "is-rail")}>
      {/* ── Mobile Sidebar Backdrop ── */}
      {mobileMenuOpen ? (
        <div
          className="op-mobile-backdrop d-lg-none"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* ── Left Operator Sidebar (Static lg+, Offcanvas < lg) ── */}
      <aside className={cn("op-sidebar", mobileMenuOpen && "is-open")} aria-label="Operator navigation">
        <div className="op-sidebar__brand">
          <Link href="/dashboard" className="brand-mark" onClick={() => setMobileMenuOpen(false)}>
            <span className="brand-mark__glyph">tM</span>
            <span className="op-sidebar__brand-text">
              tradeMO
              <span className="brand-mark__sub">Operator Console</span>
            </span>
          </Link>
          <button
            type="button"
            className="desk-icon-btn d-none d-lg-inline-grid"
            onClick={() => setRailCollapsed((v) => !v)}
            aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="menu" size={16} />
          </button>
          <button
            type="button"
            className="desk-icon-btn d-lg-none"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <nav className="op-sidebar__nav">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.key} className="op-nav-group">
              <span className="op-nav-group__label">{grp.label}</span>
              {OPERATOR_NAV.filter((item) => item.group === grp.key).map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = badgeFor(item.key);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn("op-nav-link", active && "is-active")}
                    title={`${item.code} · ${item.label}`}
                  >
                    <Icon name={item.icon} size={17} />
                    <span className="op-nav-link__text">{item.label}</span>
                    {badge ? (
                      <span
                        className={cn(
                          "op-nav-badge mono",
                          badge === "LIVE" && "is-live",
                          badge === "HALT" && "is-halt",
                        )}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="op-sidebar__foot">
          <button
            type="button"
            className="op-deriv-card"
            onClick={() => openOverlay({ type: "deriv-connection" })}
          >
            <span className={cn("live-dot", live.workspace.risk.emergencyHalted && "bg-danger")} />
            <span className="op-deriv-card__meta">
              <strong className="mono">{activeConn.derivLoginId}</strong>
              <span className="mono">
                {activeConn.accountType.toUpperCase()} · {activeConn.latencyMs}ms
              </span>
            </span>
          </button>
          <div className="op-sidebar__foot-links">
            <Link href="/investor" className="op-foot-link">
              <Icon name="pool" size={14} /> <span>Investor View</span>
            </Link>
            <Link href="/" className="op-foot-link">
              <Icon name="globe" size={14} /> <span>Public Site</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Main Desk Column ── */}
      <div className="op-workspace">
        {/* Sticky Top Bar */}
        <header className="op-topbar">
          <div className="op-topbar__left">
            <button
              type="button"
              className="desk-icon-btn d-lg-none"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open operator navigation"
            >
              <Icon name="menu" size={18} />
            </button>

            <button
              type="button"
              className="op-cmd-search"
              onClick={() => openOverlay({ type: "command-palette" })}
            >
              <Icon name="search" size={15} />
              <span>Search symbols, pools, trades, wizards…</span>
              <kbd className="mono">⌘K</kbd>
            </button>

            <div className="op-ticker-inline d-none d-xxl-flex">
              {live.workspace.markets.slice(0, 3).map((m) => (
                <button
                  key={m.symbol}
                  type="button"
                  className="op-ticker-chip mono"
                  onClick={() => openOverlay({ type: "quick-trade", defaultSymbol: m.symbol })}
                >
                  <span>{m.symbol}</span>
                  <strong>{m.spot}</strong>
                  <span className={m.changePercent >= 0 ? "text-win" : "text-loss"}>
                    {m.changePercent >= 0 ? "▲" : "▼"}
                    {Math.abs(m.changePercent)}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="op-topbar__right">
            <button
              type="button"
              className={cn(
                "op-status-pill",
                live.workspace.risk.emergencyHalted && "is-halted",
              )}
              onClick={() => openOverlay({ type: "deriv-connection" })}
            >
              <span className="live-dot" />
              <span className="mono d-none d-sm-inline">Deriv:</span>
              <strong className="mono">{activeConn.derivLoginId}</strong>
              <span className="mono text-secondary d-none d-md-inline">
                · {formatCurrency(activeConn.balance, "USD", 0)}
              </span>
            </button>

            <button
              type="button"
              className={cn(
                "op-status-pill d-none d-md-inline-flex",
                live.workspace.risk.emergencyHalted && "is-halted",
              )}
              onClick={() => openOverlay({ type: "risk-guardrails" })}
              title="Configure Risk Circuit Breakers"
            >
              <Icon name="shield" size={14} />
              <span className="mono">
                {live.workspace.risk.emergencyHalted
                  ? "HALTED"
                  : `DD Cap ${live.workspace.risk.packageDrawdownLimitPercent}%`}
              </span>
            </button>

            <button
              type="button"
              className="desk-icon-btn position-relative"
              onClick={() => openDrawerTab("alerts")}
              aria-label="Open notifications drawer"
              title="Notifications & Live Feed"
            >
              <Icon name="bell" size={17} />
              {unreadCount > 0 ? <span className="op-count-dot mono">{unreadCount}</span> : null}
            </button>

            <button
              type="button"
              className="desk-icon-btn"
              onClick={() => openDrawerTab("feed")}
              aria-label="Open right inspector drawer"
              title="Open Right Inspector Drawer"
            >
              <Icon name="panelRight" size={17} />
            </button>

            <button
              type="button"
              className="desk-icon-btn"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
              title={`Theme: ${theme}`}
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={16} />
            </button>

            <button
              type="button"
              className="op-profile-btn"
              onClick={() => openOverlay({ type: "operator-session" })}
            >
              <span className="op-avatar mono">JO</span>
              <span className="d-none d-xl-inline">{live.workspace.operator.fullName}</span>
              <Icon name="chevronDown" size={14} />
            </button>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="op-main">
          {children({ ...live, nextCountdownSeconds: countdown })}
        </main>

        {/* Bottom Onscreen Quick-Action Bar */}
        <BottomQuickDock
          kpis={live.kpis}
          countdownLabel={formatDurationSeconds(countdown)}
        />
      </div>

      {/* Right-Side Slide-In Drawer */}
      <OperatorRightDrawer
        drawer={drawer}
        tradesFeed={live.lastTrades}
        schedules={live.schedules}
        funds={live.funds}
        investorWatch={live.investors}
        workspace={live.workspace}
      />

      {/* All 18 Modals & Multi-Step Wizards */}
      <OperatorModalHost
        overlay={overlay}
        onClose={closeOverlay}
        funds={live.funds}
        investorWatch={live.investors}
        distribution={live.distribution}
        tradesFeed={live.lastTrades}
        workspace={live.workspace}
      />

      {/* Non-Blocking Toast Stack */}
      {toasts.length > 0 ? (
        <div className="op-toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={cn("op-toast", `is-${t.tone}`)}>
              <div className="flex-grow-1">
                <strong>{t.title}</strong>
                {t.detail ? <span>{t.detail}</span> : null}
              </div>
              <button
                type="button"
                className="desk-icon-btn"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OperatorShell({
  rootClass,
  bundle,
  children,
}: {
  rootClass: string;
  bundle: OperatorBundleProps;
  children: (live: OperatorBundleProps & { nextCountdownSeconds: number }) => ReactNode;
}) {
  return (
    <OperatorUIProvider>
      <OperatorShellInner rootClass={rootClass} bundle={bundle}>
        {children}
      </OperatorShellInner>
    </OperatorUIProvider>
  );
}
