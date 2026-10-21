import type { Metadata } from "next";

import { SignupPage } from "@/components/auth/signup/signup-page";
import { AUTH_PANEL_CONTENT } from "@/lib/content/auth-content";

export const metadata: Metadata = { title: "Create account · tradeMO" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Page A-1 — Sign Up (/auth/signup?role=investor&ref=A1B2C3D4) */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const role = params.role === "operator" || params.role === "investor" ? params.role : null;
  const ref = typeof params.ref === "string" ? params.ref : "";
  return <SignupPage panel={AUTH_PANEL_CONTENT} initialRole={role} initialReferral={ref} />;
}
