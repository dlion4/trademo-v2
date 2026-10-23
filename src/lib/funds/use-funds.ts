"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { applyFundsCommand, type FundsCommand } from "./model";
import { fundsQueryKeys, type FundsBundle } from "./types";
export function useFunds(initial: FundsBundle) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: fundsQueryKeys.workspace,
    queryFn: () => apiFetch<FundsBundle>("/api/funds"),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: FundsCommand) => {
      const current =
        client.getQueryData<FundsBundle>(fundsQueryKeys.workspace) ?? initial;
      const next = applyFundsCommand(current, command);
      client.setQueryData(fundsQueryKeys.workspace, next);
      return next;
    },
  });
  return {
    data: query.data ?? initial,
    mutation,
    reset: () =>
      client.setQueryData(fundsQueryKeys.workspace, structuredClone(initial)),
  };
}
