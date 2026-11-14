import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRouteFallback } from "@/components/auth/auth-route-fallback";
import { ResetPasswordParams } from "@/components/auth/password/reset-password-params";

export const metadata: Metadata = { title: "Reset password · tradeMO" };

/** Page A-5 — Reset Password (/auth/reset-password?token={jwt}) */
export default function Page() {
  return (
    <Suspense fallback={<AuthRouteFallback />}>
      <ResetPasswordParams />
    </Suspense>
  );
}
