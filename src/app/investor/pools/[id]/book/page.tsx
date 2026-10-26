import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvestorPoolBookingPage } from "@/components/investor/investor-pool-booking-page";
import { getPoolBookingWorkspace } from "@/server/services/investor-pool-booking-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pool booking & payment (I-4) · Investor · tradeMO",
  description:
    "Investor slot booking and payment workspace: funding window facts, slot picker with live allocation maths, five payment rails with method-specific forms, order review with escrow instructions, and a five-stage payment status tracker.",
};

/**
 * Page I-4 — Pool Booking & Payment (/investor/pools/:id/book).
 * Accepts the pool id (`pkg_02`) or the public code (`PKG-02`). Pools that are
 * not in an open funding window still render the page with the window facts and
 * a blocked-state hand-off instead of a 404.
 */
export default async function PoolBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    step?: string;
    slots?: string;
    method?: string;
    action?: string;
  }>;
}) {
  const { id } = await params;
  const { step, slots, method, action } = await searchParams;
  const workspace = getPoolBookingWorkspace(id);
  if (!workspace) notFound();

  return (
    <InvestorPoolBookingPage
      initial={workspace}
      initialStep={step}
      initialSlots={slots}
      initialMethod={method}
      initialAction={action}
    />
  );
}
