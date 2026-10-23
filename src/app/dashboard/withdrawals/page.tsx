import type { Metadata } from "next";
import { WithdrawalsPage } from "@/components/dashboard/withdrawals/withdrawals-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getPayoutBundle } from "@/server/services/payouts-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Withdrawal Requests (D-9) · tradeMO",
  description:
    "Operator payout review, batch scheduling, settlement evidence and recovery controls.",
};
export default function Page() {
  return (
    <WithdrawalsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getPayoutBundle()}
    />
  );
}
