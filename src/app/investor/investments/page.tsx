import type { Metadata } from "next";

import { InvestorInvestmentsPage } from "@/components/investor/investor-investments-page";
import { getInvestmentsWorkspace } from "@/server/services/investor-investments-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My investments (I-6) · Investor · tradeMO",
  description:
    "Investor portfolio of crowdfunding pools: capital summary, active positions with current value and net earnings, settled cycles with statements, booked slots awaiting trading, payout requests and one chronological investment timeline.",
};

/**
 * Page I-6 — My Investments (/investor/investments).
 * A holdings ledger, not a marketing page: every figure comes from the shared
 * pool book, so slots, shares and net P&L match the pool pages and the live
 * tracker. `?action=` deep links open any dialog directly.
 */
export default async function InvestorInvestmentsPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const workspace = getInvestmentsWorkspace();

  return (
    <InvestorInvestmentsPage initial={workspace} initialAction={action} />
  );
}
