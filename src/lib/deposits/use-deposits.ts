"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { applyDepositCommand, type Command } from "./model";
import { depositKeys, type DepositBundle } from "./types";
export function useDeposits(initial: DepositBundle) {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: depositKeys.workspace,
    queryFn: () => apiFetch<DepositBundle>("/api/deposits?section=workspace"),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (c: Command) => {
      const next = applyDepositCommand(
        client.getQueryData<DepositBundle>(depositKeys.workspace) ?? initial,
        c,
      );
      client.setQueryData(depositKeys.workspace, next);
      return next;
    },
  });
  return {
    data: q.data,
    mutation,
    reset: () =>
      client.setQueryData(depositKeys.workspace, structuredClone(initial)),
  };
}
