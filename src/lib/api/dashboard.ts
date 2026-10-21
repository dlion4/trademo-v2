import { apiFetch, postJson } from "@/lib/api/http";
import type {
  BotRunnerDTO,
  CreatePackageInput,
  CreateScheduleInput,
  DepositRecordDTO,
  DerivAccountConnDTO,
  ExecuteQuickTradeInput,
  FundsFlowDTO,
  InvestorRecordDTO,
  InvestorWatchDTO,
  LastTradesFeedDTO,
  OperatorKpiSummaryDTO,
  OperatorNotificationDTO,
  OperatorWorkspaceDTO,
  PackageSummaryDTO,
  ProfitDistributionDTO,
  RiskGuardrailConfigDTO,
  ScheduledTradeDTO,
  SendAnnouncementInput,
  TradeRecordDTO,
  UpcomingSchedulesDTO,
} from "@/lib/dashboard/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * Canonical Operator Dashboard API map — matches tradeMO.md §6 & §17.2.
 * Point NEXT_PUBLIC_API_BASE_URL at the Express API gateway when integrating
 * the live backend; zero component changes required.
 */
export const dashboardEndpoints = {
  kpiSummary: "/api/dashboard/kpi-summary",
  lastTrades: "/api/dashboard/last-trades",
  upcomingSchedules: "/api/dashboard/upcoming-schedules",
  fundsFlow: "/api/dashboard/funds-flow",
  investorWatch: "/api/dashboard/investor-watch",
  profitDistribution: "/api/dashboard/profit-distribution",
  workspace: "/api/dashboard/workspace",
  tradeBuy: "/api/trades/buy",
  schedules: "/api/schedules",
  packages: "/api/packages",
  distributePending: "/api/packages/distribute-pending",
  payouts: "/api/payouts",
  deposits: "/api/deposits",
  investors: "/api/investors",
  announcements: "/api/comms/announcements",
  bots: "/api/bots",
  connections: "/api/connections",
  risk: "/api/dashboard/risk",
  rebalance: "/api/dashboard/rebalance",
  notificationsRead: "/api/dashboard/notifications/read",
} as const;

export const dashboardApi = {
  kpiSummary: () => apiFetch<OperatorKpiSummaryDTO>(`${BASE}${dashboardEndpoints.kpiSummary}`),
  lastTrades: (limit = 12) =>
    apiFetch<LastTradesFeedDTO>(`${BASE}${dashboardEndpoints.lastTrades}?limit=${limit}`),
  upcomingSchedules: () =>
    apiFetch<UpcomingSchedulesDTO>(`${BASE}${dashboardEndpoints.upcomingSchedules}`),
  fundsFlow: () => apiFetch<FundsFlowDTO>(`${BASE}${dashboardEndpoints.fundsFlow}`),
  investorWatch: () => apiFetch<InvestorWatchDTO>(`${BASE}${dashboardEndpoints.investorWatch}`),
  profitDistribution: () =>
    apiFetch<ProfitDistributionDTO>(`${BASE}${dashboardEndpoints.profitDistribution}`),
  workspace: () => apiFetch<OperatorWorkspaceDTO>(`${BASE}${dashboardEndpoints.workspace}`),

  /* Mutations matching tradeMO.md §6 & §9.2 */
  executeQuickTrade: (body: ExecuteQuickTradeInput) =>
    postJson<TradeRecordDTO>(`${BASE}${dashboardEndpoints.tradeBuy}`, body),
  createSchedule: (body: CreateScheduleInput) =>
    postJson<ScheduledTradeDTO>(`${BASE}${dashboardEndpoints.schedules}`, body),
  updateSchedule: (body: { id: string; action: "toggle" | "run_now" }) =>
    apiFetch<ScheduledTradeDTO>(`${BASE}${dashboardEndpoints.schedules}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  createPackage: (body: CreatePackageInput) =>
    postJson<PackageSummaryDTO>(`${BASE}${dashboardEndpoints.packages}`, body),
  distributePending: (packageCodes?: string[]) =>
    postJson<{ releasedAmount: number; distributedTotal: number; pendingRemaining: number }>(
      `${BASE}${dashboardEndpoints.distributePending}`,
      { packageCodes },
    ),
  processPayouts: (body: { ids: string[]; action: "approve" | "hold" }) =>
    postJson<{ count: number; processedAmount: number }>(`${BASE}${dashboardEndpoints.payouts}`, body),
  reviewDeposit: (body: { id: string; action: "verify" | "request_proof" }) =>
    postJson<DepositRecordDTO>(`${BASE}${dashboardEndpoints.deposits}`, body),
  reviewKyc: (body: { investorId: string; decision: "approved" | "reupload_requested" }) =>
    postJson<InvestorRecordDTO>(`${BASE}${dashboardEndpoints.investors}`, body),
  sendAnnouncement: (body: SendAnnouncementInput) =>
    postJson<{ id: string; subject: string }>(`${BASE}${dashboardEndpoints.announcements}`, body),
  updateBot: (body: {
    action: "toggle" | "create" | "halt_all" | "resume_all";
    botId?: string;
    name?: string;
    symbol?: ExecuteQuickTradeInput["symbol"];
    strategy?: ExecuteQuickTradeInput["strategy"];
    stake?: number;
    packageCode?: string;
  }) => postJson<BotRunnerDTO[]>(`${BASE}${dashboardEndpoints.bots}`, body),
  switchDerivAccount: (connectionId: string) =>
    postJson<DerivAccountConnDTO[]>(`${BASE}${dashboardEndpoints.connections}`, { connectionId }),
  updateRisk: (patch: Partial<RiskGuardrailConfigDTO>) =>
    postJson<RiskGuardrailConfigDTO>(`${BASE}${dashboardEndpoints.risk}`, patch),
  rebalanceCapital: (body: { capitalInTrades: number; split: Record<string, number> }) =>
    postJson<FundsFlowDTO>(`${BASE}${dashboardEndpoints.rebalance}`, body),
  markAllNotificationsRead: () =>
    postJson<OperatorNotificationDTO[]>(`${BASE}${dashboardEndpoints.notificationsRead}`, {}),
};
