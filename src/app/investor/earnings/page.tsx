import type { Metadata } from "next";

import { InvestorEarningsPage } from "@/components/investor/investor-earnings-page";
import { getEarningsWorkspace } from "@/server/services/investor-earnings-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Earnings & reports (I-11) · Investor · tradeMO",
  description:
    "Investor earnings desk: six derived KPIs, a per-pool breakdown of gross share, 20% platform cut and net, a daily accrual timeline with a running total, a nine-line tax picture with jurisdiction readiness, and the profit-sharing formula behind every dollar.",
};

/**
 * Page I-11 — Earnings & Reports (/investor/earnings).
 *
 * One server snapshot carries the position-level earnings book, the daily
 * accrual timeline, the tax picture, the report library and the statement
 * preferences. Every figure is computed by the pure helpers in
 * `src/lib/investor/earnings.ts` from the I-6 position book, so the page can
 * never disagree with `/investor/investments`.
 *
 * `?action=` deep links open any of the 31 dialogs.
 */
export default async function InvestorEarningsPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const workspace = getEarningsWorkspace();

  return <InvestorEarningsPage initial={workspace} initialAction={action} />;
}
