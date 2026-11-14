"use client";

import { useSearchParams } from "next/navigation";

import { DerivCallbackPage } from "@/components/auth/deriv/deriv-callback-page";

const str = (v: string | null) => v ?? "";

/** Reads ?code / ?state / ?acct1 / ?error client-side so the callback route stays static. */
export function DerivCallbackParams() {
  const p = useSearchParams();
  return (
    <DerivCallbackPage
      code={str(p.get("code"))}
      state={str(p.get("state"))}
      acct1={p.get("acct1") || null}
      derivError={p.get("error") || null}
    />
  );
}
