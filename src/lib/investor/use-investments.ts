"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { apiFetch } from "@/lib/api/http";
import {
  applyInvestmentsCommand,
  type InvestmentsCommand,
  type InvestmentsWorkspace,
} from "./investments";

/**
 * I-6 query keys, exactly as specified:
 *   ["investor","investments-summary"]                → six headline figures
 *   ["investor","active-investments"]                 → refetch every 60s
 *   ["investor","completed-investments",{ page }]     → paginated settled cycles
 *   ["investor","booked-slots"]                       → bookings + registered interest
 *   ["investor","investment-timeline",{ limit: 50 }]  → chronological history
 *
 * The page hydrates one workspace object today and derives those five slices
 * from it, so a backend can split the reads without touching the view layer.
 */
export const investmentsWorkspaceKey = () =>
  ["investor", "investments-workspace"] as const;
export const investmentsSummaryKey = () =>
  ["investor", "investments-summary"] as const;
export const activeInvestmentsKey = () =>
  ["investor", "active-investments"] as const;
export const completedInvestmentsKey = (page: number) =>
  ["investor", "completed-investments", { page }] as const;
export const bookedSlotsKey = () => ["investor", "booked-slots"] as const;
export const investmentTimelineKey = (limit = 50) =>
  ["investor", "investment-timeline", { limit }] as const;

/** Active positions re-read every minute once a backend serves the route. */
export const ACTIVE_INVESTMENTS_REFETCH_MS = 60_000;

export function useInvestments(initial: InvestmentsWorkspace) {
  const client = useQueryClient();
  const key = useMemo(() => investmentsWorkspaceKey(), []);

  const query = useQuery({
    queryKey: key,
    initialData: initial,
    queryFn: () =>
      apiFetch<InvestmentsWorkspace>("/api/investor/investments"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const command = useMutation({
    mutationFn: async (input: InvestmentsCommand) => {
      const current =
        client.getQueryData<InvestmentsWorkspace>(key) ?? initial;
      const next = applyInvestmentsCommand(current, input);
      client.setQueryData(key, next);
      return next;
    },
  });

  const reset = useCallback(
    (next: InvestmentsWorkspace) => client.setQueryData(key, next),
    [client, key],
  );

  return { data: query.data, isFetching: query.isFetching, command, reset };
}
