"use client";

import { useForm, useStore } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  AuthAlert,
  Checkbox,
  FieldShell,
  PasswordInput,
  PasswordStrengthMeter,
  SubmitButton,
  TextInput,
} from "@/components/auth/form-controls";
import { StatusMark } from "@/components/auth/status-mark";
import { Icon, type IconName } from "@/components/icons";
import { AuthApiError } from "@/lib/api/auth";
import { cn } from "@/lib/cn";
import { errorText, signupSchema, type SignupFormValues } from "@/lib/auth/schemas";
import type { PrimaryRole } from "@/lib/auth/types";
import { rememberPendingEmail } from "@/lib/auth/utils";
import type { AuthPanelContentDTO } from "@/lib/content/auth-content";
import { useRegister } from "@/lib/queries/use-auth";

interface RoleOption {
  value: PrimaryRole;
  icon: IconName;
  title: string;
  tag: string;
  description: string;
  bullets: string[];
  destination: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "operator",
    icon: "terminal",
    title: "Trade myself",
    tag: "Operator",
    description: "Connect your Deriv account, run bots and manage investor packages.",
    bullets: ["Deriv API + bot engine", "Create & schedule packages", "Distribute profits"],
    destination: "Operator console",
  },
  {
    value: "investor",
    icon: "pool",
    title: "Become an investor",
    tag: "Investor",
    description: "Book slots in crowdfunding pools and earn from pooled trading.",
    bullets: ["No Deriv account needed", "Start from one slot", "Net earnings to wallet"],
    destination: "Investor dashboard",
  },
];

interface SignupPageProps {
  panel: AuthPanelContentDTO;
  initialRole: PrimaryRole | null;
  initialReferral: string;
}

export function SignupPage({ panel, initialRole, initialReferral }: SignupPageProps) {
  const router = useRouter();
  const register = useRegister();
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showReferral, setShowReferral] = useState(Boolean(initialReferral));
  const [done, setDone] = useState(false);

  const form = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: initialRole ?? "",
      termsAccepted: false,
      referralCode: initialReferral,
      newsletterOptIn: true,
    } as SignupFormValues,
    validators: { onChange: signupSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const res = await register.mutateAsync({
          ...value,
          role: value.role as PrimaryRole,
          termsAccepted: true,
          referralCode: value.referralCode || undefined,
        });
        rememberPendingEmail(res.email);
        setDone(true);
        window.setTimeout(() => router.push(res.redirectTo), 1100);
      } catch (error) {
        if (error instanceof AuthApiError) {
          if (error.details.fieldErrors) setServerErrors(error.details.fieldErrors);
          setFormError(error.message);
        } else setFormError("Could not create your account. Please try again.");
      }
    },
  });

  const attempts = useStore(form.store, (s) => s.submissionAttempts);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

  const fieldError = (name: string, meta: { isBlurred: boolean; errors: ReadonlyArray<unknown> }) =>
    serverErrors[name] ?? (meta.isBlurred || attempts > 0 ? errorText(meta.errors) : null);

  const clearServer = (name: string) =>
    setServerErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

  return (
    <AuthShell
      rootClass="page-auth-signup"
      width="none"
      aside={{ prompt: "Already have an account?", label: "Sign in", href: "/auth/signin" }}
    >
      <div className="container-xl signup-grid">
        {/* ── LEFT: desk panel ── */}
        <aside className="signup-desk" aria-label="Platform snapshot">
          <span className="eyebrow-label">Crowdfunded trading desk</span>
          <h2 className="signup-desk__title">{panel.headline}</h2>
          <p className="signup-desk__sub">{panel.subline}</p>

          <div className="signup-desk__metrics">
            {panel.metrics.map((m) => (
              <div key={m.label} className="signup-metric">
                <span className="signup-metric__label">{m.label}</span>
                <span className="signup-metric__value mono">{m.value}</span>
                {m.delta ? (
                  <span className={cn("signup-metric__delta mono", m.direction === "down" ? "is-loss" : "is-win")}>
                    <Icon name={m.direction === "down" ? "trendDown" : "trendUp"} size={12} />
                    {m.delta}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="signup-board">
            <div className="signup-board__head">
              <span className="d-inline-flex align-items-center gap-2">
                <span className="live-dot" /> Pool board
              </span>
              <span className="mono">Fill · P/L</span>
            </div>
            <table className="signup-board__table">
              <tbody>
                {panel.pools.map((p) => (
                  <tr key={p.code}>
                    <td>
                      <span className="mono signup-board__code">{p.code}</span>
                      <span className="signup-board__market">{p.market}</span>
                    </td>
                    <td>
                      <span className={cn("signup-status", `is-${p.status}`)}>{p.status}</span>
                    </td>
                    <td className="signup-board__fill">
                      <span className="signup-board__bar">
                        <span style={{ width: `${p.filledPercent}%` }} />
                      </span>
                      <span className="mono">{p.filledPercent}%</span>
                    </td>
                    <td
                      className={cn(
                        "mono text-end signup-board__pnl",
                        p.pnlPercent > 0 && "is-win",
                        p.pnlPercent < 0 && "is-loss",
                      )}
                    >
                      {p.pnlPercent === 0 ? "—" : `${p.pnlPercent > 0 ? "+" : ""}${p.pnlPercent.toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="signup-desk__points">
            {panel.points.map((pt) => (
              <li key={pt}>
                <Icon name="check" size={14} />
                {pt}
              </li>
            ))}
          </ul>
        </aside>

        {/* ── RIGHT: form ── */}
        <section className="signup-form-col">
          <div className="auth-card signup-card">
            {done ? (
              <div className="signup-done auth-enter">
                <StatusMark kind="success" size={64} />
                <h1 className="auth-heading__title">Account created</h1>
                <p>We&apos;ve sent a verification link to your inbox. Redirecting…</p>
                <span className="spinner-border spinner-border-sm text-secondary" aria-hidden="true" />
              </div>
            ) : (
              <>
                <div className="auth-heading">
                  <span className="eyebrow-label">Step 1 of 2 · Account</span>
                  <h1 className="auth-heading__title">Create your account</h1>
                  <p className="auth-heading__subtitle">Free to join. Choose your path below — you can add the other role later.</p>
                </div>

                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void form.handleSubmit();
                  }}
                >
                  <div className="auth-form auth-stagger">
                    <form.Field name="fullName">
                      {(field) => (
                        <FieldShell id="fullName" label="Full name" error={fieldError("fullName", field.state.meta)}>
                          <TextInput
                            id="fullName"
                            icon="user"
                            autoComplete="name"
                            placeholder="Jane Operator"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onValueChange={field.handleChange}
                            invalid={Boolean(fieldError("fullName", field.state.meta))}
                          />
                        </FieldShell>
                      )}
                    </form.Field>

                    <form.Field name="email">
                      {(field) => (
                        <FieldShell id="email" label="Work email" error={fieldError("email", field.state.meta)}>
                          <TextInput
                            id="email"
                            type="email"
                            icon="mail"
                            autoComplete="email"
                            placeholder="you@company.com"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onValueChange={(v) => {
                              clearServer("email");
                              field.handleChange(v);
                            }}
                            invalid={Boolean(fieldError("email", field.state.meta))}
                          />
                        </FieldShell>
                      )}
                    </form.Field>

                    <form.Field name="password">
                      {(field) => (
                        <FieldShell id="password" label="Password" error={fieldError("password", field.state.meta)}>
                          <PasswordInput
                            id="password"
                            autoComplete="new-password"
                            placeholder="Min. 8 characters"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onValueChange={field.handleChange}
                            invalid={Boolean(fieldError("password", field.state.meta))}
                          />
                          <PasswordStrengthMeter password={field.state.value} />
                        </FieldShell>
                      )}
                    </form.Field>

                    <form.Field name="confirmPassword">
                      {(field) => (
                        <FieldShell
                          id="confirmPassword"
                          label="Confirm password"
                          error={fieldError("confirmPassword", field.state.meta)}
                        >
                          <PasswordInput
                            id="confirmPassword"
                            autoComplete="new-password"
                            placeholder="Re-enter password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onValueChange={field.handleChange}
                            invalid={Boolean(fieldError("confirmPassword", field.state.meta))}
                          />
                        </FieldShell>
                      )}
                    </form.Field>
                  </div>

                  <div className="section-divider signup-divider">
                    <span className="eyebrow-label">Choose your path</span>
                  </div>

                  <form.Field name="role">
                    {(field) => {
                      const err = fieldError("role", field.state.meta);
                      return (
                        <fieldset className="signup-roles">
                          <legend className="visually-hidden">Account role</legend>
                          <div className="row g-3 row-cols-1 row-cols-sm-2">
                            {ROLE_OPTIONS.map((opt) => {
                              const selected = field.state.value === opt.value;
                              return (
                                <div className="col" key={opt.value}>
                                  <label className={cn("role-card", selected && "is-selected", err && "is-invalid")}>
                                    <input
                                      type="radio"
                                      name="role"
                                      value={opt.value}
                                      checked={selected}
                                      onChange={() => field.handleChange(opt.value)}
                                      onBlur={field.handleBlur}
                                      className="visually-hidden"
                                    />
                                    <span className="role-card__top">
                                      <span className="role-card__icon">
                                        <Icon name={opt.icon} size={18} />
                                      </span>
                                      <span className="role-card__tag">{opt.tag}</span>
                                      <span className="role-card__radio" aria-hidden="true">
                                        {selected ? <Icon name="check" size={12} /> : null}
                                      </span>
                                    </span>
                                    <span className="role-card__title">{opt.title}</span>
                                    <span className="role-card__desc">{opt.description}</span>
                                    <ul className="role-card__list">
                                      {opt.bullets.map((b) => (
                                        <li key={b}>{b}</li>
                                      ))}
                                    </ul>
                                    <span className="role-card__dest">
                                      <Icon name="arrowRight" size={13} /> {opt.destination}
                                    </span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                          {err ? (
                            <div className="auth-field__error mt-2" role="alert">
                              <Icon name="alert" size={13} />
                              {err}
                            </div>
                          ) : null}
                        </fieldset>
                      );
                    }}
                  </form.Field>

                  <div className="auth-form mt-4">
                    {showReferral ? (
                      <form.Field name="referralCode">
                        {(field) => (
                          <FieldShell
                            id="referralCode"
                            label="Referral code"
                            error={fieldError("referralCode", field.state.meta)}
                            hint="8–12 letters or numbers"
                          >
                            <TextInput
                              id="referralCode"
                              icon="link"
                              className="mono text-uppercase"
                              placeholder="A1B2C3D4"
                              value={field.state.value ?? ""}
                              onBlur={field.handleBlur}
                              onValueChange={field.handleChange}
                              invalid={Boolean(fieldError("referralCode", field.state.meta))}
                            />
                          </FieldShell>
                        )}
                      </form.Field>
                    ) : (
                      <button type="button" className="auth-link-btn text-start small" onClick={() => setShowReferral(true)}>
                        + Have a referral code?
                      </button>
                    )}

                    <form.Field name="termsAccepted">
                      {(field) => {
                        const err = fieldError("termsAccepted", field.state.meta);
                        return (
                          <div>
                            <Checkbox
                              id="termsAccepted"
                              checked={field.state.value}
                              onChange={(v) => field.handleChange(v)}
                              invalid={Boolean(err)}
                            >
                              I agree to the <Link href="/legal/terms">Terms of Service</Link> and{" "}
                              <Link href="/legal/risk">Risk Disclosure</Link>. Trading involves risk of loss.
                            </Checkbox>
                            {err ? (
                              <div className="auth-field__error" role="alert">
                                <Icon name="alert" size={13} />
                                {err}
                              </div>
                            ) : null}
                          </div>
                        );
                      }}
                    </form.Field>

                    <form.Field name="newsletterOptIn">
                      {(field) => (
                        <Checkbox id="newsletterOptIn" checked={field.state.value} onChange={(v) => field.handleChange(v)}>
                          Send me package launches and monthly performance reports.
                        </Checkbox>
                      )}
                    </form.Field>

                    {formError ? <AuthAlert title={formError} /> : null}

                    <SubmitButton loading={isSubmitting} loadingLabel="Creating account…">
                      Create account
                      <Icon name="arrowRight" size={16} />
                    </SubmitButton>
                  </div>
                </form>

                <div className="auth-card__foot">
                  Already have an account? <Link href="/auth/signin">Sign in →</Link>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </AuthShell>
  );
}
