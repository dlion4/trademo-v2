import type { Metadata } from "next";
import { BotsPage } from "@/components/dashboard/bots/bots-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getBotsWorkspace } from "@/server/services/bots-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bot & Automation Config (D-14) · tradeMO",
  description:
    "Operator bot configuration, Guardian policies, automation and script workspace.",
};
export default function Page() {
  return (
    <BotsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getBotsWorkspace()}
    />
  );
}
