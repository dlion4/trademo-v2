import type { Metadata } from "next";

import { ForgotPasswordPage } from "@/components/auth/password/forgot-password-page";

export const metadata: Metadata = { title: "Forgot password · tradeMO" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Page A-4 — Forgot Password (/auth/forgot-password?email=) */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  return <ForgotPasswordPage initialEmail={typeof p.email === "string" ? p.email : ""} />;
}
