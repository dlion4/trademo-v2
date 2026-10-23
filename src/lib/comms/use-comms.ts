"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { applyCommsCommand, type CommsCommand } from "./model";
import { commsQueryKeys, type CommsBundle } from "./types";
export function useComms(initial: CommsBundle) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: commsQueryKeys.workspace,
    queryFn: () => apiFetch<CommsBundle>("/api/comms"),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: CommsCommand) => {
      const state =
        client.getQueryData<CommsBundle>(commsQueryKeys.workspace) ?? initial;
      const next = applyCommsCommand(state, command);
      client.setQueryData(commsQueryKeys.workspace, next);
      return next;
    },
  });
  return {
    data: query.data ?? initial,
    mutation,
    reset: () =>
      client.setQueryData(commsQueryKeys.workspace, structuredClone(initial)),
  };
}
