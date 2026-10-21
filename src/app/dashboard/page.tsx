import type { Metadata } from "next";

import { CommandCenterPage } from "@/components/dashboard/command-center/command-center-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command Center (D-1) · Operator Console · tradeMO",
  description:
    "Operator trading desk overview: live Deriv execution blotter, scheduled runs, pooled capital, investor KYC watch, and High-Water Mark profit distributions.",
};

/** Page D-1 — Operator Command Center Overview (/dashboard) */
export default function DashboardPage() {
  const bundle = getCommandCenterBundle();
  return <CommandCenterPage bundle={bundle} />;
}
