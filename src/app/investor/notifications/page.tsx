import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications · Investor · tradeMO",
};

/** The activity ledger is the notification surface on I-1. */
export default function InvestorNotificationsPage() {
  redirect("/investor?focus=activity");
}
