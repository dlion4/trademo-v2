"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { applyPayoutCommand, type PayoutCommand } from "./model";
import { payoutQueryKeys, type PayoutBundle } from "./types";
export function usePayouts(initial: PayoutBundle) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: payoutQueryKeys.workspace,
    queryFn: () => apiFetch<PayoutBundle>("/api/payouts"),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: PayoutCommand) => {
      const current =
        client.getQueryData<PayoutBundle>(payoutQueryKeys.workspace) ?? initial;
      const next = applyPayoutCommand(current, command);
      client.setQueryData(payoutQueryKeys.workspace, next);
      return next;
    },
  });
  return {
    data: query.data ?? initial,
    mutation,
    reset: () =>
      client.setQueryData(payoutQueryKeys.workspace, structuredClone(initial)),
  };
}
