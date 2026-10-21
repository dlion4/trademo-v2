import type { Metadata } from "next";

import { SchedulesPage } from "@/components/dashboard/schedules/schedules-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getTradeSchedulerBundle } from "@/server/services/schedules-mock-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trade Scheduler (D-2) · Operator Console · tradeMO",
  description:
    "Schedule automated Deriv contract sequences by date, UTC window, symbol, progression strategy, crowdfunding package split, and pre-flight conflict guardrails.",
};

/** Page D-2 — Operator Trade Scheduler (`/dashboard/schedules`) */
export default function DashboardSchedulesRoutePage() {
  const operatorBundle = getCommandCenterBundle();
  const initialScheduler = getTradeSchedulerBundle(2026, 9);

  return (
    <SchedulesPage
      operatorBundle={operatorBundle}
      initialScheduler={initialScheduler}
    />
  );
}
