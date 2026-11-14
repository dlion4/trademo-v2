"use client";

import { useSearchParams } from "next/navigation";

import { TwoFactorPage } from "@/components/auth/two-factor/two-factor-page";

/** Reads ?challengeId client-side so /auth/2fa stays static. */
export function TwoFactorParams() {
  return <TwoFactorPage challengeId={useSearchParams().get("challengeId") ?? ""} />;
}
