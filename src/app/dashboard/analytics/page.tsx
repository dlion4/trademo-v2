import type { Metadata } from "next";
import { AnalyticsPage } from "@/components/dashboard/analytics/analytics-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getAnalyticsBundle } from "@/server/services/analytics-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Performance Analytics (D-7) · tradeMO",
  description:
    "Operator portfolio attribution, investor ranking, risk-adjusted returns and distribution analytics.",
};
export default function Page() {
  return (
    <AnalyticsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getAnalyticsBundle()}
    />
  );
}
