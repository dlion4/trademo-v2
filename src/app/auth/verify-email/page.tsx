import type { Metadata } from "next";

import { VerifyEmailPage } from "@/components/auth/verify/verify-email-page";

export const metadata: Metadata = { title: "Verify email · tradeMO" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Page A-6 — Email Verification (/auth/verify-email?token= | ?sent=true&email=) */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  return (
    <VerifyEmailPage
      token={typeof p.token === "string" ? p.token : ""}
      initialEmail={typeof p.email === "string" ? p.email : ""}
      justSent={p.sent === "true"}
    />
  );
}
