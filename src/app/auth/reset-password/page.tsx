import type { Metadata } from "next";

import { ResetPasswordPage } from "@/components/auth/password/reset-password-page";

export const metadata: Metadata = { title: "Reset password · tradeMO" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Page A-5 — Reset Password (/auth/reset-password?token={jwt}) */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  return <ResetPasswordPage token={typeof p.token === "string" ? p.token : ""} />;
}
