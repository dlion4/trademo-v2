import type { Metadata } from "next";

import { DerivCallbackPage } from "@/components/auth/deriv/deriv-callback-page";

export const metadata: Metadata = { title: "Connecting Deriv · tradeMO" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** Page A-8 — Deriv OAuth Callback (/auth/deriv/callback?code=&acct1=&state= | ?error=access_denied) */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  return (
    <DerivCallbackPage
      code={str(p.code)}
      state={str(p.state)}
      acct1={str(p.acct1) || null}
      derivError={str(p.error) || null}
    />
  );
}
