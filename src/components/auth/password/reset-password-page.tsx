"use client";

import { useForm, useStore } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert, FieldShell, PasswordInput, PasswordStrengthMeter, SubmitButton } from "@/components/auth/form-controls";
import { StatusMark } from "@/components/auth/status-mark";
import { Icon } from "@/components/icons";
import { AuthApiError } from "@/lib/api/auth";
import { errorText, resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/auth/schemas";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { useResetPassword, useResetTokenStatus } from "@/lib/queries/use-auth";

const REASONS: Record<string, string> = {
  expired: "This reset link has expired. Links are valid for 1 hour.",
  used: "This reset link has already been used.",
  malformed: "This reset link is invalid or incomplete.",
};

export function ResetPasswordPage({ token }: { token: string }) {
  const router = useRouter();
  const status = useResetTokenStatus(token);
  const reset = useResetPassword();
  const [error, setError] = useState<string | null>(null);
  const [invalidated, setInvalidated] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const redirect = useCountdown(0, false);

  useEffect(() => {
    if (done && redirect.done && redirect.total > 0) router.push(done);
  }, [done, redirect.done, redirect.total, router]);

  const form = useForm({
    defaultValues: { token, password: "", confirmPassword: "" } as ResetPasswordFormValues,
    validators: { onChange: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const res = await reset.mutateAsync(value);
        setDone(res.redirectTo);
        redirect.restart(4);
      } catch (e) {
        if (e instanceof AuthApiError && e.code === "INVALID_TOKEN") setInvalidated(true);
        else setError(e instanceof Error ? e.message : "Could not reset your password.");
      }
    },
  });

  const attempts = useStore(form.store, (s) => s.submissionAttempts);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const show = (meta: { isBlurred: boolean; errors: ReadonlyArray<unknown> }) =>
    meta.isBlurred || attempts > 0 ? errorText(meta.errors) : null;

  const invalid = !token || invalidated || (status.data && !status.data.valid) || status.isError;
  const reason = !token ? "malformed" : status.data?.reason ?? "expired";

  return (
    <AuthShell rootClass="page-auth-reset-password">
      {status.isLoading ? (
        <div className="auth-card rp-loading">
          <span className="spinner-border text-secondary" aria-hidden="true" />
          <p className="mb-0">Checking your reset link…</p>
        </div>
      ) : invalid ? (
        <div className="auth-card rp-invalid shake">
          <StatusMark kind="error" size={56} />
          <AuthHeading title="Link invalid or expired" subtitle={REASONS[reason] ?? REASONS.expired} />
          <Link href="/auth/forgot-password" className="btn-brand w-100">
            Request a new link
          </Link>
          <div className="auth-card__foot">
            <Link href="/auth/signin">Back to sign in</Link>
          </div>
        </div>
      ) : done ? (
        <div className="auth-card rp-done auth-enter">
          <StatusMark kind="success" size={60} />
          <AuthHeading
            title="Password updated"
            subtitle="All other sessions have been signed out and a security alert was sent to your email."
          />
          <Link href={done} className="btn-brand w-100">
            Continue to sign in <Icon name="arrowRight" size={16} />
          </Link>
          <p className="rp-done__timer">
            Redirecting in <span className="mono">{redirect.remaining}s</span>
          </p>
        </div>
      ) : (
        <div className="auth-card">
          <AuthHeading
            mark={<StatusMark kind="lock" size={48} className="mb-2" />}
            title="Set a new password"
            subtitle={
              status.data?.emailMasked ? (
                <>
                  For <span className="mono">{status.data.emailMasked}</span>. Use at least 8 characters with a mix of cases,
                  numbers and symbols.
                </>
              ) : (
                "Choose a strong password you haven't used before."
              )
            }
          />
          <form
            noValidate
            className="auth-form auth-stagger"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="password">
              {(field) => (
                <FieldShell id="password" label="New password" error={show(field.state.meta)}>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    autoFocus
                    placeholder="Min. 8 characters"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onValueChange={field.handleChange}
                    invalid={Boolean(show(field.state.meta))}
                  />
                  <PasswordStrengthMeter password={field.state.value} />
                </FieldShell>
              )}
            </form.Field>
            <form.Field name="confirmPassword">
              {(field) => (
                <FieldShell id="confirmPassword" label="Confirm new password" error={show(field.state.meta)}>
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onValueChange={field.handleChange}
                    invalid={Boolean(show(field.state.meta))}
                  />
                </FieldShell>
              )}
            </form.Field>
            {error ? <AuthAlert title={error} /> : null}
            <div className="rp-note">
              <Icon name="shield" size={14} /> Resetting signs you out of every other device.
            </div>
            <SubmitButton loading={isSubmitting} loadingLabel="Updating password…">
              Reset password
            </SubmitButton>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
