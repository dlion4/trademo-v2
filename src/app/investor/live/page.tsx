import type { Metadata } from "next";

import { InvestorLiveTradePage } from "@/components/investor/investor-live-trade-page";
import { getLiveTradeWorkspace } from "@/server/services/investor-live-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live trade tracker (I-5) · Investor · tradeMO",
  description:
    "Investor live trade tracker: running capital, pool P&L and investor share totals, a windowed real-time trade feed with win/loss flash, one-second symbol tickers, session statistics with streaks and extremes, and the bots trading inside your crowdfunding pools.",
};

/**
 * Page I-5 — Live Trade Tracker (/investor/live).
 * A numbers-only live surface: no charts, no candles and no order entry. The
 * server hands over one snapshot DTO; the client reducer applies simulated
 * socket events to the same shape a backend would push.
 */
export default async function InvestorLivePage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const workspace = getLiveTradeWorkspace();

  return <InvestorLiveTradePage initial={workspace} initialAction={action} />;
}
