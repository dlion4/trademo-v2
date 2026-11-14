import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRouteFallback } from "@/components/auth/auth-route-fallback";
import { DerivCallbackParams } from "@/components/auth/deriv/deriv-callback-params";

export const metadata: Metadata = { title: "Connecting Deriv · tradeMO" };

/** Page A-8 — Deriv OAuth Callback (/auth/deriv/callback?code=&acct1=&state= | ?error=access_denied) */
export default function Page() {
  return (
    <Suspense fallback={<AuthRouteFallback />}>
      <DerivCallbackParams />
    </Suspense>
  );
}
