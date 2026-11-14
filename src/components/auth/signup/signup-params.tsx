"use client";

import { useSearchParams } from "next/navigation";

import { SignupPage } from "@/components/auth/signup/signup-page";
import { AUTH_PANEL_CONTENT } from "@/lib/content/auth-content";

/** Reads ?role / ?ref client-side so /auth/signup stays static. */
export function SignupParams() {
  const p = useSearchParams();
  const roleParam = p.get("role");
  const role = roleParam === "operator" || roleParam === "investor" ? roleParam : null;
  return <SignupPage panel={AUTH_PANEL_CONTENT} initialRole={role} initialReferral={p.get("ref") ?? ""} />;
}
