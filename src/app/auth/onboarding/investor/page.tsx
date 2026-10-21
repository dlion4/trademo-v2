import type { Metadata } from "next";

import { OnboardingPage } from "@/components/auth/onboarding/onboarding-page";
import { INVESTOR_ONBOARDING_CONTENT } from "@/lib/content/auth-content";

export const metadata: Metadata = { title: "Investor onboarding · tradeMO" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Page A-3 — Investor Onboarding (/auth/onboarding/investor?step=1..4) */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  const raw = Number(typeof p.step === "string" ? p.step : 1);
  const step = Number.isFinite(raw) ? Math.min(4, Math.max(1, Math.floor(raw))) - 1 : 0;
  return <OnboardingPage initialContent={INVESTOR_ONBOARDING_CONTENT} initialStep={step} />;
}
