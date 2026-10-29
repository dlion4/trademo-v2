"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api/http";
import {
  applyReferralCommand,
  referralKey,
  referralSection,
  type LeaderPeriod,
  type ReferralCommand,
  type ReferralSectionMap,
  type ReferralWorkspace,
  type ShareChannel,
} from "./referrals";

/**
 * I-10 query keys, exactly as specified in `tradeMO.md`:
 *   ["referrals","code-and-stats"]                    → code, link, ladder, stats
 *   ["referrals","streak"]                            → streak desk, 60 s refresh
 *   ["referrals","available-rewards"]                 → claimable cards + credit queue
 *   ["referrals","leaderboard",{ period: "month" }]   → monthly board
 *   ["referrals","history",{ page }]                  → reward statement page
 *
 * The page hydrates one workspace snapshot per request, so today the five keys
 * are slices of that snapshot. A backend can serve them independently without
 * touching the view layer — the shapes are already separate.
 */
export const referralsWorkspaceKey = () => ["referrals", "workspace"] as const;

/** The streak card re-reads every 60 s so "today" cannot go stale mid-session. */
export const REFERRALS_STREAK_REFETCH_MS = 60_000;

const endpoint = (
  section: string,
  params?: { page?: number; period?: LeaderPeriod },
) => {
  const search = new URLSearchParams({ section });
  if (params?.page) search.set("page", String(params.page));
  if (params?.period) search.set("period", params.period);
  return `/api/investor/referrals?${search.toString()}`;
};

type ShareInput = { channel: ShareChannel; target?: string };

export function useReferrals(initial: ReferralWorkspace) {
  const client = useQueryClient();
  const workspaceKey = useMemo(() => referralsWorkspaceKey(), []);

  const [historyPage, setHistoryPage] = useState(1);
  const [period, setPeriod] = useState<LeaderPeriod>("month");

  const workspaceQuery = useQuery<ReferralWorkspace>({
    queryKey: workspaceKey,
    queryFn: () => apiFetch<ReferralWorkspace>(endpoint("workspace")),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const workspace = workspaceQuery.data ?? initial;

  const codeAndStats = useQuery<ReferralSectionMap["code-and-stats"]>({
    queryKey: referralKey("code-and-stats"),
    queryFn: () => apiFetch(endpoint("code-and-stats")),
    initialData: () => referralSection(workspace, "code-and-stats"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const streak = useQuery<ReferralSectionMap["streak"]>({
    queryKey: referralKey("streak"),
    queryFn: () => apiFetch(endpoint("streak")),
    initialData: () => referralSection(workspace, "streak"),
    staleTime: REFERRALS_STREAK_REFETCH_MS,
    refetchInterval: REFERRALS_STREAK_REFETCH_MS,
    refetchOnWindowFocus: false,
  });

  const rewards = useQuery<ReferralSectionMap["available-rewards"]>({
    queryKey: referralKey("available-rewards"),
    queryFn: () => apiFetch(endpoint("available-rewards")),
    initialData: () => referralSection(workspace, "available-rewards"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const leaderboard = useQuery<ReferralSectionMap["leaderboard"]>({
    queryKey: referralKey("leaderboard", { period }),
    queryFn: () => apiFetch(endpoint("leaderboard", { period })),
    initialData: () => referralSection(workspace, "leaderboard", { period }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const history = useQuery<ReferralSectionMap["history"]>({
    queryKey: referralKey("history", { page: historyPage }),
    queryFn: () => apiFetch(endpoint("history", { page: historyPage })),
    initialData: () => referralSection(workspace, "history", { page: historyPage }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const syncSections = useCallback(
    (next: ReferralWorkspace) => {
      client.setQueryData(referralKey("code-and-stats"), referralSection(next, "code-and-stats"));
      client.setQueryData(referralKey("streak"), referralSection(next, "streak"));
      client.setQueryData(
        referralKey("available-rewards"),
        referralSection(next, "available-rewards"),
      );
      for (const periodKey of ["month", "quarter", "all"] as LeaderPeriod[]) {
        client.setQueryData(
          referralKey("leaderboard", { period: periodKey }),
          referralSection(next, "leaderboard", { period: periodKey }),
        );
      }
      for (let page = 1; page <= 4; page += 1) {
        client.setQueryData(
          referralKey("history", { page }),
          referralSection(next, "history", { page }),
        );
      }
    },
    [client],
  );

  /**
   * Every write funnels through the shared command union, so the local preview
   * and the future API contract cannot drift. The five read slices are
   * re-derived from the new snapshot in the same tick, which keeps the streak
   * counter, the reward desk and the statement in step.
   */
  const run = useCallback(
    async (command: ReferralCommand): Promise<ReferralWorkspace> => {
      const current = client.getQueryData<ReferralWorkspace>(workspaceKey) ?? workspace;
      let next: ReferralWorkspace;
      try {
        next = applyReferralCommand(current, command);
      } catch (error) {
        // A rejected command still asks the route, so a backend can answer with
        // its own rule message instead of the preview's.
        const body = await apiFetch<{ workspace?: ReferralWorkspace }>(
          "/api/investor/referrals",
          { method: "POST", body: JSON.stringify(command) },
        ).catch(() => null);
        if (body?.workspace) {
          client.setQueryData(workspaceKey, body.workspace);
          syncSections(body.workspace);
        }
        throw error;
      }
      client.setQueryData(workspaceKey, next);
      syncSections(next);
      return next;
    },
    [client, syncSections, workspace, workspaceKey],
  );

  /** `useClaimReward()` → POST /api/rewards/:id/claim */
  const claimReward = useMutation({
    mutationFn: async (id: string) => run({ kind: "claimReward", id }),
  });

  /** `useClaimDailyBonus()` → POST /api/referrals/claim-daily */
  const claimDailyBonus = useMutation({
    mutationFn: async () => run({ kind: "claimDaily" }),
  });

  const claimAll = useMutation({
    mutationFn: async () => run({ kind: "claimAll" }),
  });

  const useFreeze = useMutation({
    mutationFn: async () => run({ kind: "useFreeze" }),
  });

  const share = useMutation({
    mutationFn: async (input: ShareInput) =>
      run({ kind: "share", channel: input.channel, target: input.target }),
  });

  const sendInvites = useMutation({
    mutationFn: async (input: { emails: string[]; note: string }) =>
      run({ kind: "sendInvites", emails: input.emails, note: input.note }),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => run({ kind: "revokeInvite", id }),
  });

  const savePreferences = useMutation({
    mutationFn: async (
      input: Omit<Extract<ReferralCommand, { kind: "savePreferences" }>, "kind">,
    ) => run({ kind: "savePreferences", ...input }),
  });

  const joinCampaign = useMutation({
    mutationFn: async (id: string) => run({ kind: "joinCampaign", id }),
  });

  const setGoal = useMutation({
    mutationFn: async (input: { target: number; deadline: string }) =>
      run({ kind: "setGoal", ...input }),
  });

  const exportReport = useMutation({
    mutationFn: async (input: Extract<ReferralCommand, { kind: "exportReport" }>) => run(input),
  });

  const support = useMutation({
    mutationFn: async (input: Omit<Extract<ReferralCommand, { kind: "support" }>, "kind">) =>
      run({ kind: "support", ...input }),
  });

  const acknowledge = useMutation({
    mutationFn: async (scope: "terms" | "leaderboard" | "credits") =>
      run({ kind: "acknowledge", scope }),
  });

  const reset = useMutation({
    mutationFn: async () => run({ kind: "resetRewards" }),
  });

  return {
    initial,
    workspace,
    workspaceQuery,
    codeAndStats,
    streak,
    rewards,
    leaderboard,
    history,
    historyPage,
    setHistoryPage,
    period,
    setPeriod,
    claimReward,
    claimDailyBonus,
    claimAll,
    useFreeze,
    share,
    sendInvites,
    revokeInvite,
    savePreferences,
    joinCampaign,
    setGoal,
    exportReport,
    support,
    acknowledge,
    reset,
    command: useMutation({ mutationFn: async (input: ReferralCommand) => run(input) }),
  };
}

export type ReferralsDesk = ReturnType<typeof useReferrals>;
