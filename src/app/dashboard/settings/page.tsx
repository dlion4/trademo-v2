import type { Metadata } from "next";
import { SettingsPage } from "@/components/dashboard/settings/settings-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getSettingsWorkspace } from "@/server/services/settings-service";
import { settingsTabs, type SettingsTab } from "@/lib/settings/model";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Settings (D-15) · tradeMO",
  description:
    "Operator identity, connection, platform, security, notification and billing configuration.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <SettingsPage
      operatorBundle={getCommandCenterBundle()}
      initial={getSettingsWorkspace()}
      initialTab={
        settingsTabs.includes(tab as SettingsTab)
          ? (tab as SettingsTab)
          : "profile"
      }
    />
  );
}
