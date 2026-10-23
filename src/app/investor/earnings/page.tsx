import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Earnings · Investor · tradeMO" };

/** Deep link from the "View earnings" quick action and footer links. */
export default function InvestorEarningsPage() {
  redirect("/investor?focus=earnings");
}
