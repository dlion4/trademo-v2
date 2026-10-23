import type { Metadata } from "next";
import { TradeLogPage } from "@/components/dashboard/trade-log/trade-log-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getLedgerBundle } from "@/server/services/trade-log-service";
import { defaultRequest } from "@/lib/trade-log/types";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trade Log & Records (D-4) · tradeMO" };
export default async function Page({ searchParams }: { searchParams: Promise<{ schedule?: string }> }) {
  const { schedule } = await searchParams;
  const request = { ...defaultRequest, filters: { ...defaultRequest.filters, schedule: schedule ?? "" } };
  return <TradeLogPage operatorBundle={getCommandCenterBundle()} initial={getLedgerBundle(request)} initialRequest={request} />;
}
