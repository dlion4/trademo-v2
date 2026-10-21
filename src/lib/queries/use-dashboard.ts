"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardApi } from "@/lib/api/dashboard";
import type {
  FundsFlowDTO,
  InvestorWatchDTO,
  LastTradesFeedDTO,
  OperatorKpiSummaryDTO,
  OperatorWorkspaceDTO,
  ProfitDistributionDTO,
  UpcomingSchedulesDTO,
} from "@/lib/dashboard/types";

/**
 * Canonical TanStack Query keys from tradeMO.md §6 Page D-1 & §9.2.
 */
export const dashboardKeys = {
  all: ["dashboard"] as const,
  kpiSummary: ["dashboard", "kpi-summary"] as const,
  lastTrades: (limit = 12) => ["dashboard", "last-trades", limit] as const,
  upcomingSchedules: ["dashboard", "upcoming-schedules"] as const,
  fundsFlow: ["dashboard", "funds-flow"] as const,
  investorWatch: ["dashboard", "investor-watch"] as const,
  profitDistribution: ["dashboard", "profit-distribution"] as const,
  workspace: ["dashboard", "workspace"] as const,
};

export function useOperatorKpis(initialData?: OperatorKpiSummaryDTO) {
  return useQuery({
    queryKey: dashboardKeys.kpiSummary,
    queryFn: dashboardApi.kpiSummary,
    initialData,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useLastTrades(limit = 12, initialData?: LastTradesFeedDTO) {
  return useQuery({
    queryKey: dashboardKeys.lastTrades(limit),
    queryFn: () => dashboardApi.lastTrades(limit),
    initialData,
    refetchInterval: 15_000,
    staleTime: 8_000,
  });
}

export function useUpcomingSchedules(initialData?: UpcomingSchedulesDTO) {
  return useQuery({
    queryKey: dashboardKeys.upcomingSchedules,
    queryFn: dashboardApi.upcomingSchedules,
    initialData,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useFundsFlow(initialData?: FundsFlowDTO) {
  return useQuery({
    queryKey: dashboardKeys.fundsFlow,
    queryFn: dashboardApi.fundsFlow,
    initialData,
    staleTime: 15_000,
  });
}

export function useInvestorWatch(initialData?: InvestorWatchDTO) {
  return useQuery({
    queryKey: dashboardKeys.investorWatch,
    queryFn: dashboardApi.investorWatch,
    initialData,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useProfitDistribution(initialData?: ProfitDistributionDTO) {
  return useQuery({
    queryKey: dashboardKeys.profitDistribution,
    queryFn: dashboardApi.profitDistribution,
    initialData,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useOperatorWorkspace(initialData?: OperatorWorkspaceDTO) {
  return useQuery({
    queryKey: dashboardKeys.workspace,
    queryFn: dashboardApi.workspace,
    initialData,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

function useInvalidateDesk() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: dashboardKeys.all });
}

/* ── Canonical Mutations (tradeMO.md §6 & §9.2) ── */

export function useExecuteQuickTrade() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.executeQuickTrade, onSuccess: refresh });
}

export function useCreateSchedule() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.createSchedule, onSuccess: refresh });
}

export function useUpdateSchedule() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.updateSchedule, onSuccess: refresh });
}

export function useCreatePackage() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.createPackage, onSuccess: refresh });
}

export function useDistributePending() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.distributePending, onSuccess: refresh });
}

export function useProcessPayouts() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.processPayouts, onSuccess: refresh });
}

export function useReviewDeposit() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.reviewDeposit, onSuccess: refresh });
}

export function useReviewKyc() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.reviewKyc, onSuccess: refresh });
}

export function useAnnounce() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.sendAnnouncement, onSuccess: refresh });
}

export function useUpdateBot() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.updateBot, onSuccess: refresh });
}

export function useSwitchDerivAccount() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.switchDerivAccount, onSuccess: refresh });
}

export function useUpdateRiskGuardrails() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.updateRisk, onSuccess: refresh });
}

export function useRebalanceCapital() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.rebalanceCapital, onSuccess: refresh });
}

export function useMarkNotificationsRead() {
  const refresh = useInvalidateDesk();
  return useMutation({ mutationFn: dashboardApi.markAllNotificationsRead, onSuccess: refresh });
}
