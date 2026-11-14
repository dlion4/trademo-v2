import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRouteFallback } from "@/components/auth/auth-route-fallback";
import { VerifyEmailParams } from "@/components/auth/verify/verify-email-params";

export const metadata: Metadata = { title: "Verify email · tradeMO" };

/** Page A-6 — Email Verification (/auth/verify-email?token= | ?sent=true&email=) */
export default function Page() {
  return (
    <Suspense fallback={<AuthRouteFallback />}>
      <VerifyEmailParams />
    </Suspense>
  );
}
