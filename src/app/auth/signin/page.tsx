import type { Metadata } from "next";

import { SigninPage } from "@/components/auth/signin/signin-page";

export const metadata: Metadata = { title: "Sign in · tradeMO" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Page A-2 — Sign In (/auth/signin?reset=success | ?verified=1 | ?session=expired&next=/path) */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  const notice =
    p.reset === "success" ? "reset" : p.verified === "1" ? "verified" : p.session === "expired" ? "expired" : null;
  const next = typeof p.next === "string" && p.next.startsWith("/") ? p.next : null;
  return <SigninPage notice={notice} next={next} />;
}
