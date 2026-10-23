import type { Metadata } from "next";
import { LiveTradingPage } from "@/components/dashboard/live/live-trading-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getLiveBundle } from "@/server/services/live-mock-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live Trading (D-3) · tradeMO", description: "Operator live execution desk, bot runners, pool attribution and guardian events." };
export default function Page() { return <LiveTradingPage operatorBundle={getCommandCenterBundle()} initial={getLiveBundle()} />; }
