import type { Metadata } from "next";

import { InvestorWalletPage } from "@/components/investor/investor-wallet-page";
import { getWalletWorkspace } from "@/server/services/investor-wallet-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wallet & finances (I-7) · Investor · tradeMO",
  description:
    "Investor wallet: available balance, capital locked in pools, pending payout, deposits across five rails, payout requests, a reconciling transaction ledger, saved payment methods and statements.",
};

/**
 * Page I-7 — Wallet & Finances (/investor/wallet).
 *
 * The cash side of the investor workspace. Every figure comes from the ledger
 * in `getWalletWorkspace()`, and the locked capital, accrued earnings and
 * pending payout come from the same book I-6 reads, so the two pages agree.
 * `?action=` deep links open any dialog directly.
 */
export default async function InvestorWalletPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const workspace = getWalletWorkspace();

  return <InvestorWalletPage initial={workspace} initialAction={action} />;
}
