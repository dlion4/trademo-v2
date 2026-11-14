"use client";

import { useSearchParams } from "next/navigation";

import { SigninPage } from "@/components/auth/signin/signin-page";

/** Reads ?reset / ?verified / ?session / ?next client-side so /auth/signin stays static. */
export function SigninParams() {
  const p = useSearchParams();
  const notice =
    p.get("reset") === "success"
      ? "reset"
      : p.get("verified") === "1"
        ? "verified"
        : p.get("session") === "expired"
          ? "expired"
          : null;
  const nextParam = p.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : null;
  return <SigninPage notice={notice} next={next} />;
}
