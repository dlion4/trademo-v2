"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { apiFetch } from "@/lib/api/http";
import {
  applyLiveCommand,
  applyStreamEvent,
  type LiveCommand,
  type LiveStreamEvent,
  type LiveTradeWorkspace,
} from "./live-trades";

/**
 * I-5 query keys, as specified:
 *   ["investor","live-totals"]   → running capital, P&L, ROI, trade count (5s)
 *   ["investor","session-stats"] → today's win rate, streaks, best/worst (30s)
 *   ["investor","active-bots"]   → bot execution state inside your pools (30s)
 *
 * The page hydrates one workspace object today and derives those three slices
 * from it, so a backend can split the reads without touching the view layer.
 */
export const liveWorkspaceKey = () => ["investor", "live-workspace"] as const;
export const liveTotalsKey = () => ["investor", "live-totals"] as const;
export const sessionStatsKey = () => ["investor", "session-stats"] as const;
export const activeBotsKey = () => ["investor", "active-bots"] as const;
export const tradeFeedKey = (limit = 50) =>
  ["investor", "trade-feed", limit] as const;

export const LIVE_TOTALS_REFETCH_MS = 5_000;
export const LIVE_STATS_REFETCH_MS = 30_000;

export function useLiveTrades(initial: LiveTradeWorkspace) {
  const client = useQueryClient();
  const key = useMemo(() => liveWorkspaceKey(), []);

  const query = useQuery({
    queryKey: key,
    initialData: initial,
    queryFn: () => apiFetch<LiveTradeWorkspace>("/api/investor/live"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const command = useMutation({
    mutationFn: async (input: LiveCommand) => {
      const current = client.getQueryData<LiveTradeWorkspace>(key) ?? initial;
      const next = applyLiveCommand(current, input);
      client.setQueryData(key, next);
      return next;
    },
  });

  /**
   * The socket stand-in. A real stream calls `push` from its message handler;
   * here the page hands it to a timer so the feed, tickers and totals move the
   * same way they would live.
   */
  const push = useCallback(
    (event: LiveStreamEvent) => {
      const current = client.getQueryData<LiveTradeWorkspace>(key);
      if (!current || current.preferences.streamPaused) return;
      client.setQueryData(key, applyStreamEvent(current, event));
    },
    [client, key],
  );

  const reset = useCallback(
    (next: LiveTradeWorkspace) => client.setQueryData(key, next),
    [client, key],
  );

  return {
    data: query.data,
    isFetching: query.isFetching,
    command,
    push,
    reset,
  };
}
