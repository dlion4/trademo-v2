"use client";

import { useForm, useStore } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import {
  AuthAlert,
  Checkbox,
  FieldShell,
  PasswordInput,
  SubmitButton,
  TextInput,
} from "@/components/auth/form-controls";
import { StatusMark } from "@/components/auth/status-mark";
import { Icon } from "@/components/icons";
import { AuthApiError } from "@/lib/api/auth";
import { cn } from "@/lib/cn";
import { errorText, signinSchema, type SigninFormValues } from "@/lib/auth/schemas";
import { isTwoFactorChallenge, type AuthSessionDTO, type PrimaryRole } from "@/lib/auth/types";
import { dashboardFor, persistSession } from "@/lib/auth/utils";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/content/auth-content";
import { useDerivAuthorizeUrl, useLogin } from "@/lib/queries/use-auth";

type Notice = "reset" | "verified" | "expired" | null;

const NOTICES: Record<Exclude<Notice, null>, { tone: "success" | "info" | "warning"; title: string; body: string }> = {
  reset: { tone: "success", title: "Password updated", body: "All other sessions were signed out. Sign in with your new password." },
  verified: { tone: "success", title: "Email verified", body: "Your account is active. Sign in to continue." },
  expired: { tone: "warning", title: "Session expired", body: "For your security, please sign in again." },
};

export function SigninPage({ notice, next }: { notice: Notice; next: string | null }) {
  const router = useRouter();
  const login = useLogin();
  const deriv = useDerivAuthorizeUrl();
  const [error, setError] = useState<{ title: string; body?: string; locked?: boolean } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [picker, setPicker] = useState<AuthSessionDTO | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [ssoNote, setSsoNote] = useState<string | null>(null);

  const go = (to: string) => {
    setRedirecting(to);
    window.setTimeout(() => router.push(to), 700);
  };

  const form = useForm({
    defaultValues: { email: "", password: "", remember: true } as SigninFormValues,
    validators: { onChange: signinSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const res = await login.mutateAsync(value);
        if (isTwoFactorChallenge(res)) {
          sessionStorage.setItem("trademo.remember", value.remember ? "1" : "0");
          return go(res.redirectTo);
        }
        persistSession(res, value.remember);
        if (res.user.role === "both") return setPicker(res);
        go(next ?? res.redirectTo ?? dashboardFor(res.user.primaryRole));
      } catch (err) {
        setShakeKey((k) => k + 1);
        if (err instanceof AuthApiError) {
          const { attemptsRemaining, lockoutAt } = err.details;
          if (err.code === "ACCOUNT_LOCKED") {
            setError({
              title: "Account temporarily locked",
              body: `Too many failed attempts. Try again ${
                lockoutAt ? `after ${new Date(lockoutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "later"
              } or reset your password.`,
              locked: true,
            });
          } else {
            setError({
              title: err.message,
              body:
                typeof attemptsRemaining === "number"
                  ? `${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before a 15-minute lockout.`
                  : undefined,
            });
          }
        } else setError({ title: "Could not sign in. Please try again." });
      }
    },
  });

  const attempts = useStore(form.store, (s) => s.submissionAttempts);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const show = (meta: { isBlurred: boolean; errors: ReadonlyArray<unknown> }) =>
    meta.isBlurred || attempts > 0 ? errorText(meta.errors) : null;

  const startDeriv = async () => {
    setSsoNote(null);
    try {
      const { url } = await deriv.mutateAsync();
      window.location.href = url;
    } catch {
      setSsoNote("Deriv sign-in is unavailable right now.");
    }
  };

  const fillDemo = (email: string) => {
    form.setFieldValue("email", email);
    form.setFieldValue("password", DEMO_PASSWORD);
    setError(null);
  };

  /* ── Role picker (role === "both") ── */
  if (picker) {
    const options: Array<{ role: PrimaryRole; title: string; desc: string; icon: "terminal" | "pool" }> = [
      { role: "operator", title: "Operator console", desc: "Bots, schedules, packages and investor payouts.", icon: "terminal" },
      { role: "investor", title: "Investor dashboard", desc: "Your pools, live earnings and wallet.", icon: "pool" },
    ];
    return (
      <AuthShell rootClass="page-auth-signin" width="sm">
        <div className="auth-card auth-enter">
          <AuthHeading
            eyebrow={`Signed in as ${picker.user.email}`}
            title="Choose a workspace"
            subtitle="Your account has both roles. You can switch any time from the top bar."
          />
          <div className="signin-picker">
            {options.map((o) => (
              <button
                key={o.role}
                type="button"
                className={cn("signin-picker__option", picker.user.primaryRole === o.role && "is-primary")}
                onClick={() => go(dashboardFor(o.role))}
                disabled={Boolean(redirecting)}
              >
                <span className="signin-picker__icon">
                  <Icon name={o.icon} size={18} />
                </span>
                <span className="signin-picker__text">
                  <strong>
                    {o.title}
                    {picker.user.primaryRole === o.role ? <span className="pill ms-2">Default</span> : null}
                  </strong>
                  <span>{o.desc}</span>
                </span>
                {redirecting === dashboardFor(o.role) ? (
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                ) : (
                  <Icon name="arrowRight" size={16} />
                )}
              </button>
            ))}
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell rootClass="page-auth-signin" aside={{ prompt: "New to tradeMO?", label: "Create account", href: "/auth/signup" }}>
      <div key={shakeKey} className={cn("auth-card signin-card", shakeKey > 0 && "shake")}>
        {redirecting ? (
          <div className="signin-redirect auth-enter">
            <StatusMark kind="success" size={56} />
            <h1 className="auth-heading__title">Signed in</h1>
            <p className="mb-0">
              Redirecting to <span className="mono">{redirecting.split("?")[0]}</span>…
            </p>
          </div>
        ) : (
          <>
            <AuthHeading
              mark={<span className="brand-mark__glyph signin-glyph">tM</span>}
              title="Welcome back"
              subtitle="Sign in to your operator console or investor dashboard."
            />

            {notice ? (
              <AuthAlert tone={NOTICES[notice].tone} title={NOTICES[notice].title} className="mb-4">
                {NOTICES[notice].body}
              </AuthAlert>
            ) : null}

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
              className="auth-form"
            >
              <form.Field name="email">
                {(field) => (
                  <FieldShell id="email" label="Email" error={show(field.state.meta)}>
                    <TextInput
                      id="email"
                      type="email"
                      icon="mail"
                      autoComplete="username"
                      placeholder="you@company.com"
                      autoFocus
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      invalid={Boolean(show(field.state.meta))}
                    />
                  </FieldShell>
                )}
              </form.Field>

              <form.Field name="password">
                {(field) => (
                  <FieldShell
                    id="password"
                    label="Password"
                    error={show(field.state.meta)}
                    labelAside={<Link href="/auth/forgot-password">Forgot password?</Link>}
                  >
                    <PasswordInput
                      id="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      invalid={Boolean(show(field.state.meta))}
                    />
                  </FieldShell>
                )}
              </form.Field>

              <form.Field name="remember">
                {(field) => (
                  <Checkbox id="remember" checked={field.state.value} onChange={(v) => field.handleChange(v)}>
                    Keep me signed in on this device
                  </Checkbox>
                )}
              </form.Field>

              {error ? (
                <AuthAlert title={error.title}>
                  {error.body}
                  {error.locked ? (
                    <>
                      {" "}
                      <Link href="/auth/forgot-password">Reset password →</Link>
                    </>
                  ) : null}
                </AuthAlert>
              ) : null}

              <SubmitButton loading={isSubmitting} loadingLabel="Signing in…">
                Sign in
              </SubmitButton>
            </form>

            <div className="section-divider">
              <span className="eyebrow-label">or sign in with</span>
            </div>

            <div className="signin-sso">
              <button type="button" className="signin-sso__btn" onClick={() => setSsoNote("Google SSO will be enabled once the identity provider is configured.")}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
                  <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
                </svg>
                Google
              </button>
              <button type="button" className="signin-sso__btn signin-sso__btn--deriv" onClick={startDeriv} disabled={deriv.isPending}>
                {deriv.isPending ? (
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                ) : (
                  <span className="signin-sso__deriv" aria-hidden="true">d</span>
                )}
                Deriv OAuth
              </button>
            </div>
            {ssoNote ? <p className="signin-sso__note">{ssoNote}</p> : null}

            <details className="signin-demo">
              <summary>
                <Icon name="key" size={14} /> Demo accounts <span className="mono">· pw {DEMO_PASSWORD}</span>
              </summary>
              <div className="signin-demo__list">
                {DEMO_ACCOUNTS.map((a) => (
                  <button key={a.email} type="button" onClick={() => fillDemo(a.email)}>
                    <span>
                      <strong>{a.label}</strong>
                      <span className="mono">{a.email}</span>
                    </span>
                    <span className="signin-demo__note">{a.note}</span>
                  </button>
                ))}
              </div>
            </details>

            <div className="auth-card__foot">
              No account yet? <Link href="/auth/signup">Create one — it&apos;s free</Link>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
