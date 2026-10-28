"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { apiFetch } from "@/lib/api/http";
import {
  applyWalletCommand,
  type WalletCommand,
  type WalletWorkspace,
} from "./wallet";

/**
 * I-7 query keys, exactly as specified:
 *   ["wallet","overview"]                         → balances + lifetime, 30 s
 *   ["wallet","transactions",{ page, filters }]   → paginated statement
 *   ["wallet","recent-payouts",{ limit: 5 }]      → last five payouts
 *   ["wallet","payment-methods"]                  → saved destinations
 *
 * The page hydrates one workspace object today and derives those four slices
 * from it, so a backend can split the reads without touching the view layer.
 */
export const walletWorkspaceKey = () => ["wallet", "workspace"] as const;
export const walletOverviewKey = () => ["wallet", "overview"] as const;
export const walletTransactionsKey = (page: number, filters: string) =>
  ["wallet", "transactions", { page, filters }] as const;
export const walletRecentPayoutsKey = (limit = 5) =>
  ["wallet", "recent-payouts", { limit }] as const;
export const walletPaymentMethodsKey = () =>
  ["wallet", "payment-methods"] as const;

/** The overview re-reads every 30 s once a backend serves the route. */
export const WALLET_OVERVIEW_REFETCH_MS = 30_000;

export function useWallet(initial: WalletWorkspace) {
  const client = useQueryClient();
  const key = useMemo(() => walletWorkspaceKey(), []);

  const query = useQuery({
    queryKey: key,
    initialData: initial,
    queryFn: () => apiFetch<WalletWorkspace>("/api/investor/wallet"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: WALLET_OVERVIEW_REFETCH_MS,
  });

  const command = useMutation({
    mutationFn: async (input: WalletCommand) => {
      const current =
        client.getQueryData<WalletWorkspace>(key) ?? initial;
      const next = applyWalletCommand(current, input);
      client.setQueryData(key, next);
      return next;
    },
  });

  const reset = useCallback(
    (next: WalletWorkspace) => client.setQueryData(key, next),
    [client, key],
  );

  return { data: query.data, isFetching: query.isFetching, command, reset };
}
