import { z } from "zod";

import type { DerivSymbol, StrategyName } from "@/lib/dashboard/types";
import type { ScheduleRecurrence } from "@/lib/schedules/types";

export const SCHEDULE_SYMBOLS: DerivSymbol[] = [
  "R_10",
  "R_25",
  "R_50",
  "R_75",
  "R_100",
  "1HZ10V",
  "frxEURUSD",
  "frxXAUUSD",
  "cryBTCUSD",
];

export const SCHEDULE_STRATEGIES: StrategyName[] = [
  "Martingale",
  "Even/Odd",
  "DCA",
  "Oscar's Grind",
  "Fixed Stake",
  "Anti-Martingale",
  "Fibonacci",
];

export const schedulePayloadSchema = z
  .object({
    name: z.string().trim().min(3, "Schedule name must be at least 3 characters.").max(80),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid YYYY-MM-DD date."),
    endDate: z.string().nullable().optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter valid HH:MM UTC start time."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter valid HH:MM UTC end time."),
    symbol: z.enum([
      "R_10",
      "R_25",
      "R_50",
      "R_75",
      "R_100",
      "1HZ10V",
      "frxEURUSD",
      "frxXAUUSD",
      "cryBTCUSD",
    ]),
    contractType: z
      .enum(["CALL", "PUT", "DIGITEVEN", "DIGITODD", "DIGITOVER", "DIGITUNDER"])
      .optional(),
    strategy: z.enum([
      "Martingale",
      "Even/Odd",
      "DCA",
      "Oscar's Grind",
      "Fixed Stake",
      "Anti-Martingale",
      "Fibonacci",
    ]),
    scriptRef: z.string().nullable().optional(),
    initialStake: z.number().min(0.35, "Minimum Deriv stake is $0.35.").max(5000),
    maxTrades: z.number().int().min(1, "At least 1 trade.").max(500, "Max 500 trades per window."),
    packageCodes: z.array(z.string()).min(1, "Assign at least one crowdfunding pool package."),
    packageAllocation: z.record(z.string(), z.number().min(0).max(100)),
    recurrence: z.enum([
      "one_time",
      "daily",
      "weekdays",
      "weekends_synthetics",
      "custom_cron",
    ]),
    cronExpression: z.string().nullable().optional(),
    stopLoss: z.number().min(5).max(50000),
    takeProfit: z.number().min(5).max(100000),
    maxDrawdown: z.number().min(0.5).max(25),
    cooldownLosses: z.number().int().min(1).max(20),
    cooldownDurationSec: z.number().int().min(30).max(7200),
    assignedBotCode: z.string().optional(),
    runImmediately: z.boolean().optional(),
    notes: z.string().max(240).optional(),
  })
  .refine((val) => timeToMinutes(val.endTime) > timeToMinutes(val.startTime), {
    message: "End time must be after start time within the UTC trading day.",
    path: ["endTime"],
  });

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((part) => Number(part) || 0);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Auto-suggest canonical schedule name (e.g. "Martingale-R10-Evening"). */
export function suggestScheduleName(
  strategy: StrategyName,
  symbol: DerivSymbol,
  startTime: string,
): string {
  const stratSlug = strategy.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const symSlug = symbol.replace("_", "").replace(/^frx/, "").replace(/^cry/, "");
  const hour = Number(startTime.split(":")[0] ?? 15);
  const session =
    hour < 11
      ? "Morning"
      : hour < 14
        ? "Midday"
        : hour < 17
          ? "Afternoon"
          : hour < 20
            ? "Evening"
            : "LateSession";
  return `${stratSlug}-${symSlug}-${session}`;
}

export const CRON_PRESETS: Array<{
  label: string;
  cron: string;
  description: string;
  recurrence: ScheduleRecurrence;
}> = [
  {
    label: "London Open Weekdays",
    cron: "0 9 * * 1-5",
    description: "Every Monday–Friday at 09:00 UTC across active FX & Synthetic pools.",
    recurrence: "custom_cron",
  },
  {
    label: "Intraday Half-Hour Pulse",
    cron: "*/30 9-17 * * 1-5",
    description: "Every 30 minutes between 09:00 and 17:00 UTC on weekdays.",
    recurrence: "custom_cron",
  },
  {
    label: "NY Overlap Window",
    cron: "0 13,15 * * 1-5",
    description: "Dual session bursts at 13:00 UTC and 15:00 UTC Monday–Friday.",
    recurrence: "custom_cron",
  },
  {
    label: "24/7 Synthetic 4-Hour Cycle",
    cron: "0 */4 * * *",
    description: "Every 4 hours continuously on Deriv Volatility Synthetics.",
    recurrence: "custom_cron",
  },
  {
    label: "Weekend Synthetic Desk",
    cron: "0 10,14,18 * * 0,6",
    description: "Saturday & Sunday at 10:00, 14:00, and 18:00 UTC (Synthetics only).",
    recurrence: "weekends_synthetics",
  },
];

export function describeCronExpression(cron: string | null | undefined, recurrence: ScheduleRecurrence): string {
  if (recurrence === "one_time") return "Single execution on selected anchor date";
  if (recurrence === "daily") return "Every calendar day (Mon–Sun) at scheduled UTC window";
  if (recurrence === "weekdays") return "Monday–Friday (`1-5`) · skips weekend FX closure";
  if (recurrence === "weekends_synthetics") return "Saturday & Sunday (`0,6`) · 24/7 Synthetics feed";
  const trimmed = (cron ?? "").trim();
  const preset = CRON_PRESETS.find((p) => p.cron === trimmed);
  if (preset) return `${preset.label} — ${preset.description}`;
  if (!trimmed) return "Custom UTC cron cadence";
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return `Custom Cron (${trimmed}) — expect 5 fields: min hour dom mon dow`;
  const [min, hr, dom, , dow] = parts;
  return `UTC Cron [min=${min}, hour=${hr}, day=${dom}, dow=${dow}]`;
}

export function previewNextCronRuns(
  anchorDate: string,
  startTime: string,
  recurrence: ScheduleRecurrence,
  cron: string | null | undefined,
  count = 5,
): string[] {
  const base = new Date(`${anchorDate}T${startTime}:00Z`);
  if (Number.isNaN(base.getTime())) return [];
  const results: string[] = [];
  const cursor = new Date(base);

  if (cron?.trim() === "*/30 9-17 * * 1-5") {
    for (let i = 0; i < count; i += 1) {
      results.push(cursor.toISOString().replace(".000Z", " UTC").replace("T", " · "));
      cursor.setUTCMinutes(cursor.getUTCMinutes() + 30);
    }
    return results;
  }

  let guard = 0;
  while (results.length < count && guard < 45) {
    guard += 1;
    const dow = cursor.getUTCDay(); // 0 Sun .. 6 Sat
    const match =
      recurrence === "one_time"
        ? guard === 1
        : recurrence === "daily"
          ? true
          : recurrence === "weekdays"
            ? dow >= 1 && dow <= 5
            : recurrence === "weekends_synthetics"
              ? dow === 0 || dow === 6
              : dow >= 1 && dow <= 5 || (cron ?? "").includes("*") && !(cron ?? "").includes("1-5");

    if (match) {
      results.push(cursor.toISOString().replace(".000Z", " UTC").replace("T", " · "));
      if (recurrence === "one_time") break;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return results;
}
