import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRouteFallback } from "@/components/auth/auth-route-fallback";
import { OnboardingParams } from "@/components/auth/onboarding/onboarding-params";

export const metadata: Metadata = { title: "Investor onboarding · tradeMO" };

/** Page A-3 — Investor Onboarding (/auth/onboarding/investor?step=1..4) */
export default function Page() {
  return (
    <Suspense fallback={<AuthRouteFallback />}>
      <OnboardingParams />
    </Suspense>
  );
}
