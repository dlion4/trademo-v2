"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { apiFetch } from "@/lib/api/http";
import {
  applyNotificationCommand,
  type NotificationCommand,
  type NotificationFilters,
  type NotificationWorkspace,
} from "./notifications";

/**
 * I-9 query keys, exactly as specified:
 *   ["notifications","unread"]                          → badge + unread list, 30 s
 *   ["notifications","trade-activity",{ page }]         → trade ledger page
 *   ["notifications","pool-updates",{ page }]           → pool timeline page
 *   ["notifications","payment-alerts",{ page }]         → cash alerts page
 *   ["notifications","system-security",{ page }]        → security log page
 *
 * The page hydrates one workspace snapshot today and derives those five slices
 * from it, so a backend can split the reads without touching the view layer.
 */
export const notificationsWorkspaceKey = () =>
  ["notifications", "workspace"] as const;
export const notificationsUnreadKey = () => ["notifications", "unread"] as const;
export const notificationsSectionKey = (
  section: "trade-activity" | "pool-updates" | "payment-alerts" | "system-security",
  page: number,
) => ["notifications", section, { page }] as const;
export const notificationsInboxKey = (filters: NotificationFilters) =>
  ["notifications", "inbox", filters] as const;

/** The unread badge re-reads every 30 s once a backend serves the route. */
export const NOTIFICATIONS_UNREAD_REFETCH_MS = 30_000;

export function useNotifications(initial: NotificationWorkspace) {
  const client = useQueryClient();
  const key = useMemo(() => notificationsWorkspaceKey(), []);

  const query = useQuery({
    queryKey: key,
    initialData: initial,
    queryFn: () => apiFetch<NotificationWorkspace>("/api/investor/notifications"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: NOTIFICATIONS_UNREAD_REFETCH_MS,
  });

  const data = query.data ?? initial;

  /**
   * Every write goes through the shared command union, so the API contract and
   * the preview cannot drift: the same schema that validates a future
   * `PATCH /api/notifications/:id/read` validates the local preview.
   */
  const run = useCallback(
    (command: NotificationCommand) => {
      const current = client.getQueryData<NotificationWorkspace>(key) ?? initial;
      const next = applyNotificationCommand(current, command);
      client.setQueryData(key, next);
      return next;
    },
    [client, initial, key],
  );

  const markRead = useMutation({
    mutationFn: async (id: string) =>
      run({ kind: "markRead", id }),
  });

  const markAllRead = useMutation({
    mutationFn: async (category: "all" | "trade" | "pool" | "payment" | "security" = "all") =>
      run({ kind: "markAllRead", category }),
  });

  const updatePreferences = useMutation({
    mutationFn: async (
      input: Omit<Extract<NotificationCommand, { kind: "savePreferences" }>, "kind">,
    ) => run({ kind: "savePreferences", ...input }),
  });

  const command = useMutation({
    mutationFn: async (input: NotificationCommand) => run(input),
  });

  const reset = useCallback(
    (next: NotificationWorkspace) => client.setQueryData(key, next),
    [client, key],
  );

  return {
    data,
    isFetching: query.isFetching,
    markRead,
    markAllRead,
    updatePreferences,
    command,
    reset,
  };
}
