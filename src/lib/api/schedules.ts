import { apiFetch, postJson } from "@/lib/api/http";
import type {
  BlackoutWindowDTO,
  BulkSchedulePayloadDTO,
  CreateSchedulePayloadDTO,
  PackageScheduleMappingDTO,
  PatchSchedulePayloadDTO,
  ScheduleSequenceDTO,
  TradeSchedulerBundleDTO,
} from "@/lib/schedules/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * Canonical Trade Scheduler API transport (`tradeMO.md` §6 D-2 & §17.2).
 * Swap `NEXT_PUBLIC_API_BASE_URL` to point at the Express + BullMQ service.
 */
export const schedulesEndpoints = {
  root: "/api/schedules",
  conflicts: "/api/schedules/conflicts",
  rebalance: "/api/schedules/rebalance",
  blackouts: "/api/schedules/blackouts",
  cloneDay: "/api/schedules/clone-day",
} as const;

export const schedulesApi = {
  bundle: (year = 2026, month = 9) =>
    apiFetch<TradeSchedulerBundleDTO>(
      `${BASE}${schedulesEndpoints.root}?view=bundle&year=${year}&month=${month}`,
    ),

  create: (payload: CreateSchedulePayloadDTO) =>
    postJson<ScheduleSequenceDTO>(`${BASE}${schedulesEndpoints.root}`, payload),

  patch: (payload: PatchSchedulePayloadDTO) =>
    apiFetch<ScheduleSequenceDTO>(`${BASE}${schedulesEndpoints.root}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  bulk: (payload: BulkSchedulePayloadDTO) =>
    apiFetch<{ updatedCount: number; sequences: ScheduleSequenceDTO[] }>(
      `${BASE}${schedulesEndpoints.root}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),

  remove: (id: string) =>
    apiFetch<{ deletedId: string }>(
      `${BASE}${schedulesEndpoints.root}?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  resolveConflict: (body: { conflictId: string; mode: "auto_fix" | "acknowledge" }) =>
    postJson<{ resolvedId: string; conflictsRemaining: number }>(
      `${BASE}${schedulesEndpoints.conflicts}`,
      body,
    ),

  rebalanceAllocations: (body: { split: Record<string, number>; capitalInTrades?: number }) =>
    postJson<PackageScheduleMappingDTO[]>(`${BASE}${schedulesEndpoints.rebalance}`, body),

  mutateBlackout: (body: {
    action: "add" | "toggle" | "delete";
    id?: string;
    blackout?: Omit<BlackoutWindowDTO, "id">;
  }) => postJson<BlackoutWindowDTO[]>(`${BASE}${schedulesEndpoints.blackouts}`, body),

  cloneDay: (body: {
    sourceDate: string;
    targetDates: string[];
    syntheticsOnlyOnWeekend: boolean;
    stakeMultiplier: number;
  }) => postJson<{ createdCount: number }>(`${BASE}${schedulesEndpoints.cloneDay}`, body),
};
