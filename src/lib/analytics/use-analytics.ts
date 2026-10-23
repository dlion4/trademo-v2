"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import {
  initialAnalyticsFilters,
  type AnalyticsBundle,
  type AnalyticsFilters,
} from "./types";
export function useAnalytics(
  filters: AnalyticsFilters,
  initial: AnalyticsBundle,
) {
  return useQuery({
    queryKey: ["analytics", "bundle", filters],
    queryFn: () =>
      apiFetch<AnalyticsBundle>(
        `/api/analytics?${new URLSearchParams({ ...filters })}`,
      ),
    initialData:
      JSON.stringify(filters) === JSON.stringify(initialAnalyticsFilters)
        ? initial
        : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });
}
