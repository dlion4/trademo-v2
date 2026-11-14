import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRouteFallback } from "@/components/auth/auth-route-fallback";
import { TwoFactorParams } from "@/components/auth/two-factor/two-factor-params";

export const metadata: Metadata = { title: "Two-factor authentication · tradeMO" };

/** Page A-7 — Two-Factor Auth (/auth/2fa?challengeId=ch_xxx) */
export default function Page() {
  return (
    <Suspense fallback={<AuthRouteFallback />}>
      <TwoFactorParams />
    </Suspense>
  );
}
