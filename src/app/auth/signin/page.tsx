import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRouteFallback } from "@/components/auth/auth-route-fallback";
import { SigninParams } from "@/components/auth/signin/signin-params";

export const metadata: Metadata = { title: "Sign in · tradeMO" };

/** Page A-2 — Sign In (/auth/signin?reset=success | ?verified=1 | ?session=expired&next=/path) */
export default function Page() {
  return (
    <Suspense fallback={<AuthRouteFallback />}>
      <SigninParams />
    </Suspense>
  );
}
