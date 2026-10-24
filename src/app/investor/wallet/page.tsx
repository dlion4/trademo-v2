import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wallet & payouts · Investor · tradeMO",
};

/** Wallet routes land on the overview and open the payout workflow. */
export default function InvestorWalletPage() {
  redirect("/investor?action=payout");
}
