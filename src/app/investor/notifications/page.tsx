import type { Metadata } from "next";

import { InvestorNotificationsPage } from "@/components/investor/investor-notifications-page";
import { getNotificationsWorkspace } from "@/server/services/investor-notifications-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications & activity (I-9) · Investor · tradeMO",
  description:
    "Investor signal desk: unread notifications, closed-trade activity, Guardian and pool lifecycle updates, deposit and payout alerts, and the account security record — all from one snapshot.",
};

/**
 * Page I-9 — Notifications & Activity (/investor/notifications).
 *
 * One server snapshot carries the inbox, the four ledgers (trades, pools,
 * payments, security), the delivery log and the account posture. Every derived
 * figure on the page is computed from that snapshot by the pure helpers in
 * `src/lib/investor/notifications.ts`. `?action=` deep links open any dialog.
 */
export default async function InvestorNotificationsPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const workspace = getNotificationsWorkspace();

  return <InvestorNotificationsPage initial={workspace} initialAction={action} />;
}
