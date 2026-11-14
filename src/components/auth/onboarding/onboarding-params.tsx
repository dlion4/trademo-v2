"use client";

import { useSearchParams } from "next/navigation";

import { OnboardingPage } from "@/components/auth/onboarding/onboarding-page";
import { INVESTOR_ONBOARDING_CONTENT } from "@/lib/content/auth-content";

/** Reads ?step client-side so /auth/onboarding/investor stays static. */
export function OnboardingParams() {
  const raw = Number(useSearchParams().get("step") ?? "1");
  const step = Number.isFinite(raw) ? Math.min(4, Math.max(1, Math.floor(raw))) - 1 : 0;
  return <OnboardingPage initialContent={INVESTOR_ONBOARDING_CONTENT} initialStep={step} />;
}
