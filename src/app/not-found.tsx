import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { StatusMark } from "@/components/auth/status-mark";

/** Global 404 — also catches dashboard routes that ship in later phases. */
export default function NotFound() {
  return (
    <AuthShell rootClass="page-not-found" width="sm">
      <div className="auth-card text-center">
        <div className="d-flex justify-content-center mb-3">
          <StatusMark kind="warning" size={56} />
        </div>
        <span className="eyebrow-label">404</span>
        <h1 className="auth-heading__title mt-2">This page isn&apos;t live yet</h1>
        <p className="mt-2 mb-4">
          The route you followed doesn&apos;t exist or is part of an upcoming build phase (operator console &amp; investor dashboard).
        </p>
        <div className="d-grid gap-2">
          <Link href="/" className="btn-brand">
            Back to home
          </Link>
          <Link href="/auth/signin" className="btn-ghost">
            Sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
