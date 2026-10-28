"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { apiFetch } from "@/lib/api/http";
import {
  applyCalculatorCommand,
  compoundPlan,
  feeBreakdown,
  historicalStats,
  roiProjection,
  scenarioMatrix,
  type CalculatorCommand,
  type CalculatorPool,
  type CalculatorRail,
  type CalculatorPayoutMethod,
  type CalculatorWorkspace,
  type ScenarioRow,
} from "./calculator";

/**
 * I-8 query keys, exactly as specified:
 *   ["calculator","roi",{amount,roi,duration}]        → live projection
 *   ["calculator","compound",{principal,roi,pools}]   → compound schedule
 *   ["calculator","fees",{amount,method,share}]       → fee breakdown
 *   ["calculator","scenarios",{poolId}]               → 1/2/3-slot grid
 *   ["pools","historical-performance",{type:"similar"}] → archive + stats
 *
 * The maths is synchronous and pure, so today each key is served from the
 * hydrated workspace by `select`. When a backend owns the assumptions the same
 * keys switch to real fetches without touching the page.
 */
export const calculatorWorkspaceKey = () => ["calculator", "workspace"] as const;
export const calculatorRoiKey = (amount: number, roi: number, duration: number) =>
  ["calculator", "roi", { amount, roi, duration }] as const;
export const calculatorCompoundKey = (
  principal: number,
  roi: number,
  pools: number,
) => ["calculator", "compound", { principal, roi, pools }] as const;
export const calculatorFeesKey = (amount: number, method: string, share: number) =>
  ["calculator", "fees", { amount, method, share }] as const;
export const calculatorScenariosKey = (poolId: string) =>
  ["calculator", "scenarios", { poolId }] as const;
export const calculatorHistoricalKey = () =>
  ["pools", "historical-performance", { type: "similar" }] as const;

/** The projection re-reads from the desk every minute once it is server-served. */
export const CALCULATOR_REFETCH_MS = 60_000;

export function useCalculator(initial: CalculatorWorkspace) {
  const client = useQueryClient();
  const key = useMemo(() => calculatorWorkspaceKey(), []);

  const query = useQuery({
    queryKey: key,
    initialData: initial,
    queryFn: () => apiFetch<CalculatorWorkspace>("/api/investor/calculator"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: CALCULATOR_REFETCH_MS,
  });

  const command = useMutation({
    mutationFn: async (input: CalculatorCommand) => {
      const current = client.getQueryData<CalculatorWorkspace>(key) ?? initial;
      const next = applyCalculatorCommand(current, input);
      client.setQueryData(key, next);
      return next;
    },
  });

  const reset = useCallback(
    (next: CalculatorWorkspace) => client.setQueryData(key, next),
    [client, key],
  );

  return { data: query.data, isFetching: query.isFetching, command, reset };
}

/* ── Derived selectors shared by the page and the drawer ── */

export const projectRoi = (
  workspace: CalculatorWorkspace,
  amount: number,
  roiPct: number,
  durationDays: number,
) =>
  roiProjection({
    amount,
    roiPct,
    durationDays,
    platformCutPct: workspace.platformCutPct,
    slotPrice: workspace.slotPrice,
  });

export const projectCompound = (
  workspace: CalculatorWorkspace,
  principal: number,
  roiPct: number,
  pools: number,
  reinvest: boolean,
) =>
  compoundPlan({
    principal,
    roiPct,
    pools,
    platformCutPct: workspace.platformCutPct,
    reinvest,
  });

export const projectFees = (
  amount: number,
  roiPct: number,
  platformCutPct: number,
  rail: CalculatorRail,
  method: CalculatorPayoutMethod,
  payoutFeeWaived: boolean,
) =>
  feeBreakdown({
    amount,
    roiPct,
    platformCutPct,
    depositFeePct: rail.feePct,
    depositFeeFlat: rail.feeFlat,
    payoutKind: method.kind,
    payoutFeeWaived,
  });

export const projectScenarios = (
  workspace: CalculatorWorkspace,
  pool: CalculatorPool,
): ScenarioRow[] =>
  scenarioMatrix({
    slotPrice: pool.slotPrice,
    platformCutPct: workspace.platformCutPct,
    bands: workspace.bands,
    slots: workspace.scenarioSlots,
  });

export const projectHistory = (workspace: CalculatorWorkspace) =>
  historicalStats(workspace.historical);
