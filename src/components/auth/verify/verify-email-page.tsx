"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CountdownRing } from "@/components/auth/countdown-ring";
import { AuthAlert, FieldShell, SubmitButton, TextInput } from "@/components/auth/form-controls";
import { StatusMark } from "@/components/auth/status-mark";
import { Icon } from "@/components/icons";
import { changeEmailSchema } from "@/lib/auth/schemas";
import type { EmailVerificationStatus } from "@/lib/auth/types";
import { maskEmail, readPendingEmail, rememberPendingEmail } from "@/lib/auth/utils";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { useResendVerification, useVerifyEmailToken } from "@/lib/queries/use-auth";

export function VerifyEmailPage({ token, initialEmail, justSent }: { token: string; initialEmail: string; justSent: boolean }) {
  const router = useRouter();
  const verify = useVerifyEmailToken(token);
  const resend = useResendVerification();
  const [email, setEmail] = useState(initialEmail);
  const [changing, setChanging] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cooldown = useCountdown(60, justSent);
  const redirect = useCountdown(0, false);

  useEffect(() => {
    if (!initialEmail) {
      const pending = readPendingEmail();
      if (pending) setEmail(pending);
    }
  }, [initialEmail]);

  const status: EmailVerificationStatus = !token
    ? "pending"
    : verify.isLoading
      ? "verifying"
      : verify.isError
        ? "invalid"
        : (verify.data?.status ?? "verifying");

  useEffect(() => {
    if (status === "verified" && redirect.total === 0) redirect.restart(3);
  }, [status, redirect]);

  useEffect(() => {
    if (status === "verified" && redirect.total > 0 && redirect.done) router.push("/auth/signin?verified=1");
  }, [status, redirect.done, redirect.total, router]);

  const doResend = async (target: string) => {
    setNotice(null);
    try {
      const res = await resend.mutateAsync({ email: target });
      rememberPendingEmail(target);
      setEmail(target);
      cooldown.restart(res.retryAfterSeconds);
      setNotice(`A new link is on its way to ${res.emailMasked}.`);
      setChanging(false);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not resend the email.");
    }
  };

  const submitDraft = () => {
    const parsed = changeEmailSchema.safeParse({ email: draft });
    if (!parsed.success) return setDraftError(parsed.error.issues[0]?.message ?? "Invalid email");
    setDraftError(null);
    void doResend(parsed.data.email);
  };

  const emailForm = (cta: string) => (
    <form
      className="auth-form ve-change auth-enter"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submitDraft();
      }}
    >
      <FieldShell id="new-email" label="Email address" error={draftError}>
        <TextInput
          id="new-email"
          type="email"
          icon="mail"
          autoFocus
          placeholder="you@company.com"
          value={draft}
          onValueChange={(v) => {
            setDraft(v);
            setDraftError(null);
          }}
          invalid={Boolean(draftError)}
        />
      </FieldShell>
      <SubmitButton loading={resend.isPending} loadingLabel="Sending…">
        {cta}
      </SubmitButton>
    </form>
  );

  return (
    <AuthShell rootClass="page-auth-verify-email">
      <div className="auth-card ve-card">
        {status === "verifying" ? (
          <div className="ve-center">
            <span className="ve-spinner">
              <Icon name="refresh" size={26} className="icon-spin" />
            </span>
            <AuthHeading title="Verifying…" subtitle="Hang tight while we confirm your email address." />
          </div>
        ) : null}

        {status === "verified" ? (
          <div className="ve-center auth-enter">
            <StatusMark kind="success" size={64} />
            <AuthHeading
              title="Email verified!"
              subtitle={
                verify.data?.email ? (
                  <>
                    <span className="mono">{maskEmail(verify.data.email)}</span> is confirmed. Your account is ready.
                  </>
                ) : (
                  "Your account is ready."
                )
              }
            />
            <Link href="/auth/signin?verified=1" className="btn-brand w-100">
              Continue to sign in <Icon name="arrowRight" size={16} />
            </Link>
            <p className="ve-muted">
              Redirecting automatically in <span className="mono">{redirect.remaining}s</span>
            </p>
          </div>
        ) : null}

        {status === "expired" || status === "invalid" ? (
          <div className="ve-center shake">
            <StatusMark kind={status === "expired" ? "warning" : "error"} size={60} />
            <AuthHeading
              title={status === "expired" ? "Verification link expired" : "Invalid verification link"}
              subtitle={
                status === "expired"
                  ? "Links are valid for 24 hours. Request a fresh one below."
                  : "This link is malformed or was already used. Check your inbox for the latest email, or request a new link."
              }
            />
            {email ? (
              <SubmitButton type="button" loading={resend.isPending} loadingLabel="Sending…" onClick={() => void doResend(email)}>
                Resend verification email
              </SubmitButton>
            ) : (
              <div className="w-100 text-start">{emailForm("Resend verification email")}</div>
            )}
            {notice ? <AuthAlert tone="success" title={notice} className="w-100 text-start" /> : null}
          </div>
        ) : null}

        {status === "pending" ? (
          <>
            <div className="ve-center">
              <StatusMark kind="envelope" size={64} />
              <AuthHeading
                title="Verify your email"
                subtitle={
                  email ? (
                    <>
                      We sent a verification link to <strong className="mono">{maskEmail(email)}</strong>. Click it to activate
                      your account.
                    </>
                  ) : (
                    "We sent a verification link to your inbox. Click it to activate your account."
                  )
                }
              />
            </div>

            {changing ? (
              emailForm("Send to this email")
            ) : (
              <div className="ve-resend">
                <CountdownRing remaining={cooldown.remaining} total={cooldown.total} />
                <div className="ve-resend__text">
                  <strong>{cooldown.done ? "Didn't get it?" : "Email on its way"}</strong>
                  <span>{cooldown.done ? "You can request another link now." : "You can resend once the timer ends."}</span>
                </div>
                <SubmitButton
                  type="button"
                  variant="ghost"
                  className="ve-resend__btn"
                  disabled={!cooldown.done || !email}
                  loading={resend.isPending}
                  loadingLabel="Sending"
                  onClick={() => void doResend(email)}
                >
                  Resend
                </SubmitButton>
              </div>
            )}

            {notice ? <AuthAlert tone="success" title={notice} className="mt-3" /> : null}

            <div className="ve-links">
              <button type="button" className="auth-link-btn" onClick={() => setChanging((v) => !v)}>
                {changing ? "Cancel" : "Change email"}
              </button>
              <span aria-hidden="true">·</span>
              <a href="mailto:support@trademo.io">Need help?</a>
            </div>
          </>
        ) : null}

        <div className="auth-card__foot">
          Already verified? <Link href="/auth/signin">Sign in</Link>
        </div>
      </div>
    </AuthShell>
  );
}
