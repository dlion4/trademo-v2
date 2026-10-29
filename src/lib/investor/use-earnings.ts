"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api/http";
import {
  EARNINGS_REFRESH_SECONDS,
  FISCAL_YEAR,
  earningsCommandSchema,
  earningsKey,
  earningsSection,
  type EarningsCommand,
  type EarningsPeriod,
  type EarningsSectionMap,
  type EarningsWorkspace,
  type ExportScope,
  type StatementPreferences,
} from "./earnings";

/**
 * I-11 query keys, exactly as specified in `tradeMO.md`:
 *   ["earnings","overview"]                → six count-up KPIs
 *   ["earnings","by-pool"]                 → per-pool breakdown, refetch 180 s
 *   ["earnings","timeline",{period}]       → daily accrual + running total
 *   ["earnings","tax-report",{year}]       → gross / losses / net / fees / locked
 *
 * Mutations map onto the three documented endpoints:
 *   useExportCSV()          → POST /api/earnings/export-csv
 *   useExportPDF()          → POST /api/earnings/export-pdf
 *   useDownloadTaxReport()  → POST /api/earnings/tax-report
 *
 * The page hydrates one workspace snapshot, so each key starts from the server
 * render and then re-reads its own slice — a backend can serve the four slices
 * independently without the view layer changing.
 */

export const EARNINGS_BY_POOL_REFETCH_MS = EARNINGS_REFRESH_SECONDS * 1000;

export const earningsWorkspaceKey = () => ["earnings", "workspace"] as const;

const endpoint = (
  section: string,
  params?: { period?: EarningsPeriod; year?: number },
) => {
  const search = new URLSearchParams({ section });
  if (params?.period) search.set("period", params.period);
  if (params?.year) search.set("year", String(params.year));
  return `/api/investor/earnings?${search.toString()}`;
};

interface CommandEnvelope {
  ok: boolean;
  workspace: EarningsWorkspace;
  message?: string;
}

interface ExportEnvelope extends CommandEnvelope {
  format: string;
  filename: string;
  matrix: { title: string; header: string[]; rows: (string | number)[][] };
  csv?: string | null;
  rows: number;
  pages?: number;
  reference?: string;
  generatedAt?: string;
}

export function useEarnings(initial: EarningsWorkspace) {
  const client = useQueryClient();
  const workspaceKey = useMemo(() => earningsWorkspaceKey(), []);
  const [period, setPeriod] = useState<EarningsPeriod>(initial.timelinePeriod);
  const [year, setYear] = useState(FISCAL_YEAR);

  const workspaceQuery = useQuery<EarningsWorkspace>({
    queryKey: workspaceKey,
    queryFn: () => apiFetch<EarningsWorkspace>(endpoint("workspace")),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const workspace = workspaceQuery.data ?? initial;

  const overview = useQuery<EarningsSectionMap["overview"]>({
    queryKey: earningsKey("overview"),
    queryFn: () => apiFetch(endpoint("overview")),
    initialData: () => earningsSection(workspace, "overview"),
    staleTime: EARNINGS_BY_POOL_REFETCH_MS,
    refetchOnWindowFocus: false,
  });

  const byPool = useQuery<EarningsSectionMap["by-pool"]>({
    queryKey: earningsKey("by-pool"),
    queryFn: () => apiFetch(endpoint("by-pool")),
    initialData: () => earningsSection(workspace, "by-pool"),
    staleTime: EARNINGS_BY_POOL_REFETCH_MS,
    refetchInterval: EARNINGS_BY_POOL_REFETCH_MS,
    refetchOnWindowFocus: false,
  });

  const timeline = useQuery<EarningsSectionMap["timeline"]>({
    queryKey: earningsKey("timeline", { period }),
    queryFn: () => apiFetch(endpoint("timeline", { period })),
    initialData: () => earningsSection(workspace, "timeline", { period }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const taxReport = useQuery<EarningsSectionMap["tax-report"]>({
    queryKey: earningsKey("tax-report", { year }),
    queryFn: () => apiFetch(endpoint("tax-report", { year })),
    initialData: () => earningsSection(workspace, "tax-report", { year }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const formula = useQuery<EarningsSectionMap["formula"]>({
    queryKey: earningsKey("formula"),
    queryFn: () => apiFetch(endpoint("formula")),
    initialData: () => earningsSection(workspace, "formula"),
    staleTime: EARNINGS_BY_POOL_REFETCH_MS,
    refetchOnWindowFocus: false,
  });

  const library = useQuery<EarningsSectionMap["library"]>({
    queryKey: earningsKey("library"),
    queryFn: () => apiFetch(endpoint("library")),
    initialData: () => earningsSection(workspace, "library"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  /** Write the new snapshot and re-derive every slice from it. */
  const sync = useCallback(
    (next: EarningsWorkspace) => {
      client.setQueryData(workspaceKey, next);
      client.setQueryData(earningsKey("overview"), earningsSection(next, "overview"));
      client.setQueryData(earningsKey("by-pool"), earningsSection(next, "by-pool"));
      client.setQueryData(earningsKey("formula"), earningsSection(next, "formula"));
      client.setQueryData(earningsKey("library"), earningsSection(next, "library"));
      client.setQueryData(earningsKey("tax-report", { year }), earningsSection(next, "tax-report", { year }));
      client.setQueryData(
        earningsKey("timeline", { period }),
        earningsSection(next, "timeline", { period }),
      );
      client.setQueryData(earningsKey("timeline", { period: next.timelinePeriod }), earningsSection(next, "timeline", { period: next.timelinePeriod }));
    },
    [client, period, workspaceKey, year],
  );

  const run = useMutation({
    mutationFn: async (command: EarningsCommand) => {
      const parsed = earningsCommandSchema.parse(command);
      const envelope = await apiFetch<CommandEnvelope>("/api/investor/earnings", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      return envelope;
    },
    onSuccess: (envelope) => sync(envelope.workspace),
  });

  const post = useCallback(
    async (path: string, body: unknown) => {
      const envelope = await apiFetch<ExportEnvelope>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      sync(envelope.workspace);
      return envelope;
    },
    [sync],
  );

  /** `useExportCSV()` → POST /api/earnings/export-csv */
  const exportCSV = useMutation({
    mutationFn: (input: { scope: ExportScope; period?: EarningsPeriod }) =>
      post("/api/earnings/export-csv", {
        scope: input.scope,
        period: input.period ?? period,
      }),
  });

  /** `useExportPDF()` → POST /api/earnings/export-pdf */
  const exportPDF = useMutation({
    mutationFn: (input: { scope: ExportScope; period?: EarningsPeriod }) =>
      post("/api/earnings/export-pdf", {
        scope: input.scope,
        period: input.period ?? period,
      }),
  });

  /** `useDownloadTaxReport()` → POST /api/earnings/tax-report */
  const downloadTaxReport = useMutation({
    mutationFn: (input: { format: "pdf" | "csv"; year?: number }) =>
      post("/api/earnings/tax-report", {
        format: input.format,
        year: input.year ?? year,
      }),
  });

  const savePreferences = useMutation({
    mutationFn: async (input: Omit<Extract<EarningsCommand, { kind: "savePreferences" }>, "kind">) =>
      run.mutateAsync({ kind: "savePreferences", ...input }),
  });

  const reconcile = useMutation({
    mutationFn: async (poolId: string) => run.mutateAsync({ kind: "reconcilePool", poolId }),
  });

  return {
    initial,
    workspace,
    workspaceQuery,
    overview,
    byPool,
    timeline,
    taxReport,
    formula,
    library,
    period,
    setPeriod,
    year,
    setYear,
    run,
    exportCSV,
    exportPDF,
    downloadTaxReport,
    savePreferences,
    reconcile,
    refresh: useMutation({ mutationFn: async () => run.mutateAsync({ kind: "refresh" }) }),
    setTimelinePeriod: useMutation({
      mutationFn: async (next: EarningsPeriod) => {
        setPeriod(next);
        return run.mutateAsync({ kind: "setPeriod", period: next });
      },
    }),
    saveStatement: (prefs: StatementPreferences) =>
      savePreferences.mutateAsync({
        defaultPeriod: prefs.defaultPeriod,
        jurisdiction: prefs.jurisdiction,
        includeLosses: prefs.includeLosses,
        includeAccrual: prefs.includeAccrual,
        rounding: prefs.rounding,
        deliveryEmail: prefs.deliveryEmail,
        autoMonthly: prefs.autoMonthly,
      }),
    command: useMutation({ mutationFn: async (input: EarningsCommand) => run.mutateAsync(input) }),
  };
}

export type EarningsDesk = ReturnType<typeof useEarnings>;
