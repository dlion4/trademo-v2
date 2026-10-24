"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/http";
import {
  applyInvestorCommand,
  type InvestorCommand,
  type InvestorWorkspace,
} from "./model";

export const investorKey = ["investor", "overview"] as const;

/** One structured overview query; local commands act as the future mutation adapter. */
export function useInvestor(initial: InvestorWorkspace) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: investorKey,
    initialData: initial,
    queryFn: () => apiFetch<InvestorWorkspace>("/api/investor/overview"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: async (command: InvestorCommand) => {
      const current =
        client.getQueryData<InvestorWorkspace>(investorKey) ?? initial;
      const next = applyInvestorCommand(current, command);
      client.setQueryData(investorKey, next);
      return next;
    },
  });
  return { data: query.data, mutation };
}
