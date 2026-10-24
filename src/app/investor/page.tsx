import type { Metadata } from "next";

import { InvestorOverviewPage } from "@/components/investor/investor-overview-page";
import { getInvestorOverview } from "@/server/services/investor-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Overview (I-1) · tradeMO",
  description:
    "Investor portfolio overview: pooled capital, live earnings ticker, Guardian risk status, upcoming pool opens, recent settlement activity and self-service payout, booking and projection tools.",
};

/** Page I-1 — Investor Overview (/investor) */
export default async function InvestorPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; focus?: string; pool?: string }>;
}) {
  const { action, focus, pool } = await searchParams;
  return (
    <InvestorOverviewPage
      initial={getInvestorOverview()}
      initialAction={action}
      initialFocus={focus}
      initialPool={pool}
    />
  );
}
