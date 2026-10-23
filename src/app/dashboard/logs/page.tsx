import type { Metadata } from "next";
import { LogsPage } from "@/components/dashboard/logs/logs-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getAuditLogsBundle } from "@/server/services/logs-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Activity & Audit Logs (D-12) · tradeMO",
  description:
    "Searchable event evidence, operational reviews, security activity and compliance workpapers.",
};
export default function Page() {
  return (
    <LogsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getAuditLogsBundle()}
    />
  );
}
