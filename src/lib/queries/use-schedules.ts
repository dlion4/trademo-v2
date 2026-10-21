"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { schedulesApi } from "@/lib/api/schedules";
import type { TradeSchedulerBundleDTO } from "@/lib/schedules/types";

export const scheduleKeys = {
  all: ["schedules"] as const,
  bundle: (year: number, month: number) => ["schedules", "bundle", year, month] as const,
};

export function useSchedulerBundle(
  year: number,
  month: number,
  initialData?: TradeSchedulerBundleDTO,
) {
  return useQuery({
    queryKey: scheduleKeys.bundle(year, month),
    queryFn: () => schedulesApi.bundle(year, month),
    initialData,
  });
}

function useInvalidateScheduler() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: scheduleKeys.all });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCreateScheduleSequence() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: schedulesApi.create,
    onSuccess: invalidate,
  });
}

export function usePatchScheduleSequence() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: schedulesApi.patch,
    onSuccess: invalidate,
  });
}

export function useBulkScheduleUpdate() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: schedulesApi.bulk,
    onSuccess: invalidate,
  });
}

export function useDeleteScheduleSequence() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: schedulesApi.remove,
    onSuccess: invalidate,
  });
}

export function useResolveScheduleConflict() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: schedulesApi.resolveConflict,
    onSuccess: invalidate,
  });
}

export function useRebalanceScheduleAllocations() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: schedulesApi.rebalanceAllocations,
    onSuccess: invalidate,
  });
}

export function useMutateBlackout() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: schedulesApi.mutateBlackout,
    onSuccess: invalidate,
  });
}

export function useCloneDayLineup() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: schedulesApi.cloneDay,
    onSuccess: invalidate,
  });
}
