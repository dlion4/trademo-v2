"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { applyBotCommand, type BotCommand, type BotWorkspace } from "./model";
export const botsKey = ["bots", "workspace"] as const;
export function useBots(initial: BotWorkspace) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: botsKey,
    initialData: initial,
    queryFn: () => apiFetch<BotWorkspace>("/api/bots/workspace"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: BotCommand) => {
      const current = client.getQueryData<BotWorkspace>(botsKey) ?? initial;
      const next = applyBotCommand(current, command);
      client.setQueryData(botsKey, next);
      return next;
    },
  });
  return { data: query.data, mutation };
}
