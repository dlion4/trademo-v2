import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getPoolsWorkspace } from "@/server/services/investor-pools-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pool detail · Investor · tradeMO" };

/**
 * Permalink bridge for pool detail (`/investor/pools/pkg_02`, `/investor/pools/PKG-02`).
 * I-2 renders the detail dialog from a `?pool=` query so the register stays a
 * single server component; ids that are not in the investor book fall back to
 * the plain register rather than a 404.
 */
export default async function InvestorPoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = getPoolsWorkspace();
  const known = [
    ...workspace.trading,
    ...workspace.open,
    ...workspace.upcoming,
    ...workspace.completed,
  ].some((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());

  redirect(
    known
      ? `/investor/pools?pool=${encodeURIComponent(id)}`
      : "/investor/pools",
  );
}
