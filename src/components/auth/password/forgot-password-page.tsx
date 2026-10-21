"use client";

import { useForm, useStore } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert, FieldShell, SubmitButton, TextInput } from "@/components/auth/form-controls";
import { StatusMark } from "@/components/auth/status-mark";
import { Icon } from "@/components/icons";
import { errorText, forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/auth/schemas";
import { formatClock, maskEmail } from "@/lib/auth/utils";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { useForgotPassword } from "@/lib/queries/use-auth";

export function ForgotPasswordPage({ initialEmail }: { initialEmail: string }) {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useCountdown(0, false);

  const send = async (email: string) => {
    setError(null);
    try {
      const res = await forgot.mutateAsync({ email });
      setSentTo(email);
      timer.restart(res.retryAfterSeconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the reset link.");
    }
  };

  const form = useForm({
    defaultValues: { email: initialEmail } as ForgotPasswordFormValues,
    validators: { onChange: forgotPasswordSchema },
    onSubmit: async ({ value }) => send(value.email.trim()),
  });

  const attempts = useStore(form.store, (s) => s.submissionAttempts);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

  return (
    <AuthShell rootClass="page-auth-forgot-password" aside={{ prompt: "Remembered it?", label: "Sign in", href: "/auth/signin" }}>
      <div className="auth-card fp-card">
        {sentTo ? (
          <div className="fp-sent auth-enter">
            <StatusMark kind="envelope" size={60} />
            <AuthHeading
              title="Check your inbox"
              subtitle={
                <>
                  If an account exists for <strong className="mono">{maskEmail(sentTo)}</strong>, we&apos;ve sent a link to reset
                  your password. It expires in 1 hour and can be used once.
                </>
              }
            />
            <ol className="fp-steps">
              <li>Open the email from <span className="mono">noreply@trademo.io</span></li>
              <li>Click <strong>Reset password</strong></li>
              <li>Choose a new password and sign in</li>
            </ol>
            <div className="fp-resend">
              {timer.done ? (
                <button type="button" className="auth-link-btn" onClick={() => send(sentTo)} disabled={forgot.isPending}>
                  {forgot.isPending ? "Sending…" : "Resend email"}
                </button>
              ) : (
                <span>
                  Resend in <span className="mono">{formatClock(timer.remaining)}</span>
                </span>
              )}
              <span className="fp-resend__sep" aria-hidden="true">·</span>
              <button type="button" className="auth-link-btn" onClick={() => setSentTo(null)}>
                Use a different email
              </button>
            </div>
            {error ? <AuthAlert title={error} className="mt-3" /> : null}
            <div className="auth-card__foot">
              Didn&apos;t get it? Check spam, or <a href="mailto:support@trademo.io">contact support</a>.
            </div>
          </div>
        ) : (
          <>
            <AuthHeading
              mark={<StatusMark kind="lock" size={48} className="mb-2" />}
              title="Forgot your password?"
              subtitle="Enter the email you signed up with and we'll send you a secure reset link."
            />
            <form
              noValidate
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
            >
              <form.Field name="email">
                {(field) => {
                  const err = field.state.meta.isBlurred || attempts > 0 ? errorText(field.state.meta.errors) : null;
                  return (
                    <FieldShell id="email" label="Email" error={err}>
                      <TextInput
                        id="email"
                        type="email"
                        icon="mail"
                        autoComplete="email"
                        autoFocus
                        placeholder="you@company.com"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onValueChange={field.handleChange}
                        invalid={Boolean(err)}
                      />
                    </FieldShell>
                  );
                }}
              </form.Field>
              {error ? <AuthAlert title={error} /> : null}
              <SubmitButton loading={isSubmitting} loadingLabel="Sending link…">
                Send reset link
              </SubmitButton>
            </form>
            <div className="auth-card__foot">
              <Link href="/auth/signin" className="d-inline-flex align-items-center gap-1">
                <Icon name="arrowLeft" size={14} /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
