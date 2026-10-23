"use client";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { applyInvestorCommand } from "./model";
import type { InvestorBundle,InvestorCommand } from "./types";
export const investorManagerKey=["investors","manager"] as const;
export function useInvestorManager(initial:InvestorBundle){const client=useQueryClient();const query=useQuery({queryKey:investorManagerKey,queryFn:()=>apiFetch<InvestorBundle>("/api/investor-manager"),initialData:initial,staleTime:Infinity});const mutation=useMutation({mutationFn:async(command:InvestorCommand)=>{const state=client.getQueryData<InvestorBundle>(investorManagerKey)??initial;const next=applyInvestorCommand(state,command);client.setQueryData(investorManagerKey,next);return next;}});return{data:query.data,mutation};}
