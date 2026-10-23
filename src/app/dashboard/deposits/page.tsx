import type { Metadata } from "next";
import { DepositsPage } from "@/components/dashboard/deposits/deposits-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getDepositLogsBundle } from "@/server/services/deposits-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Deposit Logs (D-11) · tradeMO",
  description:
    "Deposit verification, provider evidence, reconciliation and automation review.",
};
export default function Page() {
  return (
    <DepositsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getDepositLogsBundle()}
    />
  );
}
