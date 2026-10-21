import type { Metadata } from "next";

import { TwoFactorPage } from "@/components/auth/two-factor/two-factor-page";

export const metadata: Metadata = { title: "Two-factor authentication · tradeMO" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Page A-7 — Two-Factor Auth (/auth/2fa?challengeId=ch_xxx) */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  return <TwoFactorPage challengeId={typeof p.challengeId === "string" ? p.challengeId : ""} />;
}
