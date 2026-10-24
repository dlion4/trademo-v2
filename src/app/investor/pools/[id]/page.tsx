import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvestorPoolDetailPage } from "@/components/investor/investor-pool-detail-page";
import { getPoolDetailWorkspace } from "@/server/services/investor-pool-detail-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pool detail (I-3) · Investor · tradeMO",
  description:
    "Investor pool detail workspace: funding progress, your position and live earnings attribution, pool performance, AI Guardian policy, participants, documents, activity ledger, statements, payout drafts and projections.",
};

/**
 * Page I-3 — Pool Detail (/investor/pools/:id).
 * Accepts the numeric id (`pkg_02`) or the public code (`PKG-02`). Unknown ids
 * return the standard 404 rather than redirecting to the register.
 */
export default async function PoolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { action, tab } = await searchParams;
  const workspace = getPoolDetailWorkspace(id);
  if (!workspace) notFound();

  return (
    <InvestorPoolDetailPage initial={workspace} initialAction={action ?? tab} />
  );
}
