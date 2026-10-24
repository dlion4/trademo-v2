import type { Metadata } from "next";

import { InvestorPoolsPage } from "@/components/investor/investor-pools-page";
import { getPoolsWorkspace } from "@/server/services/investor-pools-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crowdfunding Pools (I-2) · tradeMO",
  description:
    "Investor crowdfunding pool register: live trading pools, open funding windows, upcoming launches, completed settlements, launch roadmap, comparison, projections and slot booking.",
};

/** Page I-2 — Crowdfunding Pools (/investor/pools) */
export default async function PoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string; action?: string }>;
}) {
  const { pool, action } = await searchParams;
  return (
    <InvestorPoolsPage
      initial={getPoolsWorkspace()}
      initialPool={pool}
      initialAction={action}
    />
  );
}
