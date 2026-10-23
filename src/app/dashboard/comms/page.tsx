import type { Metadata } from "next";
import { CommsPage } from "@/components/dashboard/comms/comms-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getCommsBundle } from "@/server/services/comms-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Communications (D-10) · tradeMO",
  description:
    "Investor inbox, personalized announcements, templates, delivery controls and communication analytics.",
};
export default function Page() {
  return (
    <CommsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getCommsBundle()}
    />
  );
}
