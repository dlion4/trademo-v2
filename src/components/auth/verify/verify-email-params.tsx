"use client";

import { useSearchParams } from "next/navigation";

import { VerifyEmailPage } from "@/components/auth/verify/verify-email-page";

/** Reads ?token / ?email / ?sent client-side so /auth/verify-email stays static. */
export function VerifyEmailParams() {
  const p = useSearchParams();
  return (
    <VerifyEmailPage
      token={p.get("token") ?? ""}
      initialEmail={p.get("email") ?? ""}
      justSent={p.get("sent") === "true"}
    />
  );
}
