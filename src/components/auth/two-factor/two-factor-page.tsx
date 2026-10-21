"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert, FieldShell, SubmitButton, TextInput } from "@/components/auth/form-controls";
import { OtpInput } from "@/components/auth/otp-input";
import { StatusMark } from "@/components/auth/status-mark";
import { Icon } from "@/components/icons";
import { AuthApiError } from "@/lib/api/auth";
import { cn } from "@/lib/cn";
import { backupCodeSchema, totpCodeSchema } from "@/lib/auth/schemas";
import { dashboardFor, formatClock, persistSession } from "@/lib/auth/utils";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { useResendTwoFactor, useVerifyTwoFactor } from "@/lib/queries/use-auth";

const EMPTY = ["", "", "", "", "", ""];
type Mode = "authenticator" | "backup_code" | "help";

export function TwoFactorPage({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const verify = useVerifyTwoFactor();
  const resend = useResendTwoFactor();
  const window30 = useCountdown(30);
  const [mode, setMode] = useState<Mode>("authenticator");
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [backup, setBackup] = useState("");
  const [error, setError] = useState<{ title: string; body?: string } | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (code: string, method: "authenticator" | "backup_code") => {
    if (verify.isPending || locked) return;
    setError(null);
    try {
      const session = await verify.mutateAsync({ challengeId, code, method });
      persistSession(session, typeof window !== "undefined" && sessionStorage.getItem("trademo.remember") === "1");
      const to = session.user.role === "both" ? "/auth/signin" : (session.redirectTo ?? dashboardFor(session.user.primaryRole));
      setSuccess(to);
      window.setTimeout(() => router.push(to), 1100);
    } catch (e) {
      setShake((n) => n + 1);
      if (e instanceof AuthApiError && e.code === "2FA_LOCKED") {
        setLocked(e.details.lockoutEndsAt ?? null);
        return;
      }
      const remaining = e instanceof AuthApiError ? e.details.attemptsRemaining : undefined;
      setError({
        title: e instanceof Error ? e.message : "Verification failed.",
        body: typeof remaining === "number" ? `${remaining} attempt${remaining === 1 ? "" : "s"} left before a 15-minute lock.` : undefined,
      });
      if (method === "authenticator") setDigits(EMPTY);
    }
  };

  const onVerifyClick = () => {
    if (mode === "backup_code") {
      const parsed = backupCodeSchema.safeParse(backup);
      if (!parsed.success) return setError({ title: parsed.error.issues[0]?.message ?? "Invalid code" });
      return void submit(parsed.data, "backup_code");
    }
    const code = digits.join("");
    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setShake((n) => n + 1);
      return setError({ title: parsed.error.issues[0]?.message ?? "Enter all 6 digits" });
    }
    void submit(code, "authenticator");
  };

  const onResend = async () => {
    try {
      const res = await resend.mutateAsync(challengeId);
      window30.restart(res.expiresInSeconds);
      setDigits(EMPTY);
      setError(null);
    } catch {
      setError({ title: "Could not refresh the code window." });
    }
  };

  if (!challengeId) {
    return (
      <AuthShell rootClass="page-auth-2fa">
        <div className="auth-card tf-center">
          <StatusMark kind="warning" size={56} />
          <AuthHeading title="Verification session missing" subtitle="Your sign-in session expired or the link is incomplete. Sign in again to get a new code." />
          <Link href="/auth/signin" className="btn-brand w-100">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell rootClass="page-auth-2fa" aside={{ prompt: "Wrong account?", label: "Sign in again", href: "/auth/signin" }}>
      <div key={shake} className={cn("auth-card tf-card", shake > 0 && "shake")}>
        {success ? (
          <div className="tf-center auth-enter">
            <StatusMark kind="success" size={64} />
            <AuthHeading title="Verified" subtitle={<>Signing you in — redirecting to <span className="mono">{success}</span></>} />
            <span className="spinner-border spinner-border-sm text-secondary" aria-hidden="true" />
          </div>
        ) : locked !== null ? (
          <div className="tf-center">
            <StatusMark kind="error" size={60} />
            <AuthHeading
              title="Too many attempts"
              subtitle={
                <>
                  Two-factor verification is locked
                  {locked ? (
                    <>
                      {" "}until <span className="mono">{new Date(locked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </>
                  ) : null}
                  . We&apos;ve emailed you a security alert.
                </>
              }
            />
            <Link href="/auth/signin" className="btn-ghost w-100">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <AuthHeading
              mark={
                <span className="tf-mark">
                  <Icon name={mode === "backup_code" ? "key" : "smartphone"} size={22} />
                </span>
              }
              eyebrow="Two-factor authentication"
              title={mode === "backup_code" ? "Enter a backup code" : mode === "help" ? "Other ways to verify" : "Enter your 6-digit code"}
              subtitle={
                mode === "backup_code"
                  ? "Use one of the 8-character codes you saved when enabling 2FA. Each code works once."
                  : mode === "help"
                    ? "If you can't access your authenticator app, choose an option below."
                    : "Open your authenticator app (Google Authenticator, Authy, 1Password) and enter the current code."
              }
            />

            {mode === "authenticator" ? (
              <div className="tf-body">
                <OtpInput
                  value={digits}
                  onChange={(d) => {
                    setDigits(d);
                    if (error) setError(null);
                  }}
                  onComplete={(code) => void submit(code, "authenticator")}
                  invalid={Boolean(error)}
                  disabled={verify.isPending}
                  autoFocus
                />
                <div className="tf-timer">
                  <span className={cn("tf-timer__bar")}>
                    <span style={{ width: `${window30.progress * 100}%` }} />
                  </span>
                  {window30.done ? (
                    <span>Code window ended</span>
                  ) : (
                    <span>
                      Code expires in <span className="mono">{formatClock(window30.remaining)}</span>
                    </span>
                  )}
                  <button type="button" className="auth-link-btn" disabled={!window30.done || resend.isPending} onClick={onResend}>
                    {resend.isPending ? "Refreshing…" : "Resend code"}
                  </button>
                </div>
              </div>
            ) : null}

            {mode === "backup_code" ? (
              <div className="tf-body tf-backup auth-enter">
                <FieldShell id="backup" label="Backup code" hint="Format: K7M9P2X4">
                  <TextInput
                    id="backup"
                    icon="key"
                    autoFocus
                    autoComplete="one-time-code"
                    className="mono text-uppercase tf-backup__input"
                    maxLength={9}
                    placeholder="XXXXXXXX"
                    value={backup}
                    onValueChange={(v) => {
                      setBackup(v.replace(/\s/g, "").toUpperCase());
                      if (error) setError(null);
                    }}
                    invalid={Boolean(error)}
                  />
                </FieldShell>
              </div>
            ) : null}

            {mode === "help" ? (
              <div className="tf-help auth-enter">
                <button type="button" className="tf-help__opt" onClick={() => setMode("backup_code")}>
                  <Icon name="key" size={18} />
                  <span>
                    <strong>Use a backup code</strong>
                    <span>One of the 10 codes saved at setup</span>
                  </span>
                  <Icon name="arrowRight" size={15} />
                </button>
                <a className="tf-help__opt" href="mailto:security@trademo.io?subject=2FA%20recovery">
                  <Icon name="mail" size={18} />
                  <span>
                    <strong>Contact account recovery</strong>
                    <span>Identity check required · 24–48h</span>
                  </span>
                  <Icon name="external" size={15} />
                </a>
              </div>
            ) : null}

            {error ? (
              <AuthAlert title={error.title} className="mt-3">
                {error.body}
              </AuthAlert>
            ) : null}

            {mode !== "help" ? (
              <SubmitButton type="button" className="mt-4" loading={verify.isPending} loadingLabel="Verifying…" onClick={onVerifyClick}>
                Verify
              </SubmitButton>
            ) : null}

            <div className="tf-switch">
              {mode !== "authenticator" ? (
                <button type="button" className="auth-link-btn" onClick={() => { setMode("authenticator"); setError(null); }}>
                  Use authenticator app
                </button>
              ) : (
                <button type="button" className="auth-link-btn" onClick={() => { setMode("backup_code"); setError(null); }}>
                  Use backup code
                </button>
              )}
              <span aria-hidden="true">·</span>
              <button type="button" className="auth-link-btn" onClick={() => { setMode("help"); setError(null); }} disabled={mode === "help"}>
                Try another method
              </button>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
