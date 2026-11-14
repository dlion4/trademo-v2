"use client";

import { useSearchParams } from "next/navigation";

import { ForgotPasswordPage } from "@/components/auth/password/forgot-password-page";

/** Reads ?email client-side so /auth/forgot-password stays static. */
export function ForgotPasswordParams() {
  return <ForgotPasswordPage initialEmail={useSearchParams().get("email") ?? ""} />;
}
