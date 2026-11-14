import type { Metadata } from "next";

import { InvestorSettingsPage } from "@/components/investor/investor-settings-page";

export const metadata: Metadata = {
  title: "Investor Settings (I-12) · tradeMO",
  description:
    "Investor profile, security posture, 2FA, active sessions, notification preferences, payout rails, and KYC verification.",
};

/** Page I-12 — Investor Settings (/investor/settings) */
export default function InvestorSettingsRoute() {
  return <InvestorSettingsPage />;
}
