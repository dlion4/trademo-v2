import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRouteFallback } from "@/components/auth/auth-route-fallback";
import { SignupParams } from "@/components/auth/signup/signup-params";

export const metadata: Metadata = { title: "Create account · tradeMO" };

/** Page A-1 — Sign Up (/auth/signup?role=investor&ref=A1B2C3D4) */
export default function Page() {
  return (
    <Suspense fallback={<AuthRouteFallback />}>
      <SignupParams />
    </Suspense>
  );
}
