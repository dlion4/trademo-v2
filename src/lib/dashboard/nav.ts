import type { IconName } from "@/components/icons";
import type { OverlayKind } from "@/lib/dashboard/types";

export interface OperatorNavItem {
  code: string;
  key: string;
  label: string;
  shortLabel: string;
  href: string;
  icon: IconName;
  group: "execution" | "syndicates" | "operations";
  summary: string;
  primaryActionLabel: string;
  primaryOverlay: OverlayKind;
}

/**
 * Complete 15-page Operator Console navigation map (tradeMO.md §6 & §18).
 * Zero empty hrefs — every item resolves to a live route inside OperatorShell.
 */
export const OPERATOR_NAV: OperatorNavItem[] = [
  // Group 1: Execution & Markets
  {
    code: "D-1",
    key: "overview",
    label: "Command Center",
    shortLabel: "Command",
    href: "/dashboard",
    icon: "bolt",
    group: "execution",
    summary: "Desk overview, live KPIs, recent blotter, upcoming runs, liquidity & distributions.",
    primaryActionLabel: "Execute Trade",
    primaryOverlay: { type: "quick-trade" },
  },
  {
    code: "D-2",
    key: "schedules",
    label: "Trade Scheduler",
    shortLabel: "Schedules",
    href: "/dashboard/schedules",
    icon: "calendar",
    group: "execution",
    summary: "Timed execution windows, recurrence rules, and multi-package stake allocation.",
    primaryActionLabel: "New Schedule Wizard",
    primaryOverlay: { type: "schedule-wizard" },
  },
  {
    code: "D-3",
    key: "live",
    label: "Live Trading",
    shortLabel: "Live Desk",
    href: "/dashboard/live",
    icon: "activity",
    group: "execution",
    summary: "Real-time Deriv WebSocket contract execution, active positions, and instant blotter.",
    primaryActionLabel: "Open Trade Ticket",
    primaryOverlay: { type: "quick-trade" },
  },
  {
    code: "D-4",
    key: "trades",
    label: "Trade Log",
    shortLabel: "Trade Log",
    href: "/dashboard/trades",
    icon: "terminal",
    group: "execution",
    summary: "Full settled contract blotter, spot entry/exit audit, and CSV/JSON ledger export.",
    primaryActionLabel: "Export Trade Ledger",
    primaryOverlay: { type: "export-reports", defaultScope: "trades" },
  },
  {
    code: "D-13",
    key: "markets",
    label: "Markets & Symbols",
    shortLabel: "Markets",
    href: "/dashboard/markets",
    icon: "globe",
    group: "execution",
    summary: "Active Deriv Synthetics, Forex, Commodities & Crypto spot quotes and payout ratios.",
    primaryActionLabel: "Trade Selected Market",
    primaryOverlay: { type: "quick-trade", defaultSymbol: "R_75" },
  },
  {
    code: "D-14",
    key: "bots",
    label: "Bot Runners",
    shortLabel: "Bots",
    href: "/dashboard/bots",
    icon: "bot",
    group: "execution",
    summary: "Automated strategy runners, tick cadence, circuit breakers, and risk limits.",
    primaryActionLabel: "Deploy Bot Wizard",
    primaryOverlay: { type: "bot-deploy-wizard" },
  },

  // Group 2: Syndicates & Capital
  {
    code: "D-5",
    key: "packages",
    label: "Packages & Pools",
    shortLabel: "Packages",
    href: "/dashboard/packages",
    icon: "package",
    group: "syndicates",
    summary: "Crowdfunded pool packages, slot pricing, capital share ratios, and HWM status.",
    primaryActionLabel: "New Package Wizard",
    primaryOverlay: { type: "new-package-wizard" },
  },
  {
    code: "D-6",
    key: "investors",
    label: "Investors Roster",
    shortLabel: "Investors",
    href: "/dashboard/investors",
    icon: "users",
    group: "syndicates",
    summary: "Pool backers, slot holdings, KYC compliance queue, and individual earnings ledgers.",
    primaryActionLabel: "Review Pending KYC",
    primaryOverlay: { type: "kyc-review" },
  },
  {
    code: "D-8",
    key: "funds",
    label: "Funds & Treasury",
    shortLabel: "Funds",
    href: "/dashboard/funds",
    icon: "vault",
    group: "syndicates",
    summary: "Total pooled capital, active margin deployment, liquidity reserve, and rebalancing.",
    primaryActionLabel: "Rebalance Capital",
    primaryOverlay: { type: "capital-rebalance" },
  },
  {
    code: "D-11",
    key: "deposits",
    label: "Deposit Queue",
    shortLabel: "Deposits",
    href: "/dashboard/deposits",
    icon: "wallet",
    group: "syndicates",
    summary: "Incoming Bank Wire, USDT, Card, and Mobile Money slot funding verifications.",
    primaryActionLabel: "Verify Deposits",
    primaryOverlay: { type: "deposit-verify" },
  },
  {
    code: "D-9",
    key: "withdrawals",
    label: "Withdrawals",
    shortLabel: "Payouts",
    href: "/dashboard/withdrawals",
    icon: "split",
    group: "syndicates",
    summary: "Investor payout queue, AML clearance checks, and batch settlement releases.",
    primaryActionLabel: "Batch Payout Wizard",
    primaryOverlay: { type: "payout-batch-wizard" },
  },

  // Group 3: Operations, Analytics & Governance
  {
    code: "D-7",
    key: "analytics",
    label: "Performance Analytics",
    shortLabel: "Analytics",
    href: "/dashboard/analytics",
    icon: "chart",
    group: "operations",
    summary: "Equity curves, win-rate attribution by symbol/strategy, drawdown & fee yield.",
    primaryActionLabel: "Distribute Pool Profits",
    primaryOverlay: { type: "distribute-wizard" },
  },
  {
    code: "D-10",
    key: "comms",
    label: "Communications",
    shortLabel: "Comms",
    href: "/dashboard/comms",
    icon: "mail",
    group: "operations",
    summary: "Investor cycle updates, pool launch dispatches across In-App, Email & Telegram.",
    primaryActionLabel: "Broadcast Update",
    primaryOverlay: { type: "announce-broadcast" },
  },
  {
    code: "D-12",
    key: "logs",
    label: "Audit & Event Logs",
    shortLabel: "Audit Logs",
    href: "/dashboard/logs",
    icon: "file",
    group: "operations",
    summary: "Immutable ledger of operator actions, contract settlements, and compliance events.",
    primaryActionLabel: "Export Audit Report",
    primaryOverlay: { type: "export-reports", defaultScope: "audit" },
  },
  {
    code: "D-15",
    key: "settings",
    label: "Desk Settings",
    shortLabel: "Settings",
    href: "/dashboard/settings",
    icon: "sliders",
    group: "operations",
    summary: "Deriv API tokens, circuit breaker thresholds, operator credentials, and sessions.",
    primaryActionLabel: "Configure Guardrails",
    primaryOverlay: { type: "risk-guardrails" },
  },
];

export const NAV_GROUPS: Array<{ key: OperatorNavItem["group"]; label: string }> = [
  { key: "execution", label: "Execution Desk" },
  { key: "syndicates", label: "Pools & Capital" },
  { key: "operations", label: "Governance & Ops" },
];
