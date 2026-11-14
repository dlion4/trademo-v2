import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRouteFallback } from "@/components/auth/auth-route-fallback";
import { ForgotPasswordParams } from "@/components/auth/password/forgot-password-params";

export const metadata: Metadata = { title: "Forgot password · tradeMO" };

/** Page A-4 — Forgot Password (/auth/forgot-password?email=) */
export default function Page() {
  return (
    <Suspense fallback={<AuthRouteFallback />}>
      <ForgotPasswordParams />
    </Suspense>
  );
}
