"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/http";
import {
  applyPoolsCommand,
  type PoolsCommand,
  type PoolsWorkspace,
} from "./pools";

export const poolsKey = ["investor", "pools-overview"] as const;

/**
 * One structured pool query, hydrated by the server DTO. Section-shaped cache
 * keys from the specification (`["pools", { status }]`) map onto the same DTO,
 * so switching to per-status queries later needs no component changes.
 */
export function usePools(initial: PoolsWorkspace) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: poolsKey,
    initialData: initial,
    queryFn: () => apiFetch<PoolsWorkspace>("/api/investor/pools"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: PoolsCommand) => {
      const current = client.getQueryData<PoolsWorkspace>(poolsKey) ?? initial;
      const next = applyPoolsCommand(current, command);
      client.setQueryData(poolsKey, next);
      return next;
    },
  });
  return { data: query.data, mutation };
}
