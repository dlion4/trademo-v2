"use client";

import { useSearchParams } from "next/navigation";

import { ResetPasswordPage } from "@/components/auth/password/reset-password-page";

/** Reads ?token client-side so /auth/reset-password stays static. */
export function ResetPasswordParams() {
  return <ResetPasswordPage token={useSearchParams().get("token") ?? ""} />;
}
