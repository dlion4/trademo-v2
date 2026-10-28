import type { Metadata } from "next";

import { InvestorCalculatorPage } from "@/components/investor/investor-calculator-page";
import { getCalculatorWorkspace } from "@/server/services/investor-calculator-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investment calculator (I-8) · Investor · tradeMO",
  description:
    "Investor return calculator: live ROI projection, compound growth schedule, fee breakdown, one/two/three-slot scenario comparison and a ten-cycle track record, all derived from the pool book and wallet rails.",
};

/**
 * Page I-8 — Investment Calculator (/investor/calculator).
 *
 * One server snapshot carries the reference pools, the platform cut, the wallet
 * rails and the ten-cycle archive; every projection on the page is computed from
 * that snapshot by the pure helpers in `src/lib/investor/calculator.ts`.
 * `?action=` deep links open any dialog directly.
 */
export default async function InvestorCalculatorPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const workspace = getCalculatorWorkspace();

  return <InvestorCalculatorPage initial={workspace} initialAction={action} />;
}
