import type { Metadata } from "next";

import { InvestorReferralsPage } from "@/components/investor/investor-referrals-page";
import { getReferralWorkspace } from "@/server/services/investor-referrals-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referrals & rewards (I-10) · Investor · tradeMO",
  description:
    "Investor referral programme: code and four-rung ladder, daily streak with tiers and freezes, claimable rewards, the monthly leaderboard and the full reward statement — all from one Sunday morning snapshot.",
};

/**
 * Page I-10 — Referrals & Rewards (/investor/referrals).
 *
 * One server snapshot carries the programme, the eight referees, the streak, the
 * reward cards, the campaigns, the leaderboard and the statement. Every derived
 * figure is computed by the pure helpers in `src/lib/investor/referrals.ts`.
 * `?action=` deep links open any of the 29 dialogs.
 */
export default async function InvestorReferralsPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const workspace = getReferralWorkspace();

  return <InvestorReferralsPage initial={workspace} initialAction={action} />;
}
