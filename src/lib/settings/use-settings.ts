"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import {
  applySettingsCommand,
  type SettingsCommand,
  type SettingsWorkspace,
} from "./model";
export const settingsKey = ["settings", "workspace"] as const;
export function useSettings(initial: SettingsWorkspace) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: settingsKey,
    initialData: initial,
    queryFn: () => apiFetch<SettingsWorkspace>("/api/settings/workspace"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: SettingsCommand) => {
      const current =
        client.getQueryData<SettingsWorkspace>(settingsKey) ?? initial;
      const next = applySettingsCommand(current, command);
      client.setQueryData(settingsKey, next);
      return next;
    },
  });
  return { data: query.data, mutation };
}
