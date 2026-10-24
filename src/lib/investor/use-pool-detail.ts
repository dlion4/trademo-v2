"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/http";
import {
  applyPoolDetailCommand,
  type PoolDetailCommand,
  type PoolDetailWorkspace,
} from "./pool-detail";

/**
 * Key shape mirrors the I-3 specification: `["pools", poolId, section]`.
 * One hydrated workspace covers overview / investment / performance / guardian
 * / participants today, so splitting into per-section queries later is a
 * change of cache keys only.
 */
export const poolDetailKey = (poolId: string) =>
  ["pools", poolId, "workspace"] as const;

export function usePoolDetail(initial: PoolDetailWorkspace) {
  const client = useQueryClient();
  const key = poolDetailKey(initial.poolId);
  const query = useQuery({
    queryKey: key,
    initialData: initial,
    queryFn: () =>
      apiFetch<PoolDetailWorkspace>(`/api/investor/pools/${initial.poolId}`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: PoolDetailCommand) => {
      const current = client.getQueryData<PoolDetailWorkspace>(key) ?? initial;
      const next = applyPoolDetailCommand(current, command);
      client.setQueryData(key, next);
      return next;
    },
  });
  return { data: query.data, mutation };
}
