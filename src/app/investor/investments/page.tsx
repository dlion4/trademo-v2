import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My investments · Investor · tradeMO",
};

/** Portfolio history lives on I-1 until the I-5 investments page ships. */
export default function InvestorInvestmentsPage() {
  redirect("/investor?focus=activity");
}
