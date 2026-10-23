import type { Metadata } from "next";
import { FundsPage } from "@/components/dashboard/funds/funds-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getFundsBundle } from "@/server/services/funds-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Funds & Capital (D-8) · tradeMO",
  description:
    "Operator treasury, deposit verification, allocation and reserve controls.",
};
export default function Page() {
  return (
    <FundsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getFundsBundle()}
    />
  );
}
