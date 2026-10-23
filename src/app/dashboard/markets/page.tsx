import type { Metadata } from "next";
import { MarketsPage } from "@/components/dashboard/markets/markets-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getMarketsBundle } from "@/server/services/markets-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Markets & Symbols (D-13) · tradeMO",
  description:
    "Market discovery, package mandates, tick evidence and local schedule review.",
};
export default function Page() {
  return (
    <MarketsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getMarketsBundle()}
    />
  );
}
