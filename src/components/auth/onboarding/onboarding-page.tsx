"use client";

import { useForm, useStore } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert, Checkbox, SubmitButton } from "@/components/auth/form-controls";
import { KycDropzone } from "@/components/auth/onboarding/kyc-dropzone";
import { StatusMark } from "@/components/auth/status-mark";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { errorText, kycSchema, type KycFormValues } from "@/lib/auth/schemas";
import type {
  InvestorOnboardingContentDTO,
  KycIdDocType,
  KycStatusDTO,
  OnboardingStatDTO,
  SourceOfFunds,
} from "@/lib/auth/types";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import { useCountUp } from "@/lib/hooks/use-motion";
import { useInvestorOnboarding, useKycSubmit } from "@/lib/queries/use-auth";

const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "how", label: "How pools work" },
  { key: "kyc", label: "Verify identity" },
  { key: "done", label: "Done" },
] as const;

const STAGE_ICONS: Record<string, IconName> = { pool: "pool", trading: "activity", profit_sharing: "split", payout: "wallet" };

export function OnboardingPage({ initialContent, initialStep }: { initialContent: InvestorOnboardingContentDTO; initialStep: number }) {
  const { data } = useInvestorOnboarding(initialContent);
  const content = data ?? initialContent;
  const [step, setStep] = useState(initialStep);
  const [kycStatus, setKycStatus] = useState<KycStatusDTO | null>(null);

  const goto = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AuthShell rootClass="page-auth-onboarding-investor" width="lg">
      <div className="onb-head">
        <span className="eyebrow-label">Investor setup · ~4 minutes</span>
        <h1 className="onb-head__title">Get ready to invest</h1>
      </div>

      {/* ── Stepper ── */}
      <ol className="onb-stepper" aria-label="Onboarding progress">
        <span className="onb-stepper__track" aria-hidden="true">
          <span
            className="onb-stepper__fill"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%`, ["--fill" as string]: `${(step / (STEPS.length - 1)) * 100}%` }}
          />
        </span>
        {STEPS.map((s, i) => (
          <li key={s.key} className={cn("onb-step", i < step && "is-done", i === step && "is-current")} aria-current={i === step ? "step" : undefined}>
            <span className="onb-step__dot">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>
            <span className="onb-step__label">{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="auth-card onb-card">
        <div key={step} className="onb-panel">
          {step === 0 ? <WelcomeStep content={content} onNext={() => goto(1)} /> : null}
          {step === 1 ? <HowStep content={content} onBack={() => goto(0)} onNext={() => goto(2)} /> : null}
          {step === 2 ? (
            <KycStep
              content={content}
              onBack={() => goto(1)}
              onSkip={() => goto(3)}
              onSubmitted={(s) => {
                setKycStatus(s);
                goto(3);
              }}
            />
          ) : null}
          {step === 3 ? <DoneStep content={content} kyc={kycStatus} /> : null}
        </div>
      </div>
    </AuthShell>
  );
}

/* ═════════════════ STEP 1 · WELCOME ═════════════════ */

function StatTile({ stat }: { stat: OnboardingStatDTO }) {
  const v = useCountUp(stat.value);
  const text =
    stat.format === "percent" ? `${v.toFixed(1)}%` : stat.format === "currency" ? `$${formatCompact(v)}` : formatNumber(Math.round(v));
  return (
    <div className="onb-stat">
      <span className="onb-stat__label">{stat.label}</span>
      <span className="onb-stat__value mono">{text}</span>
      <span className="onb-stat__hint">{stat.hint}</span>
    </div>
  );
}

function WelcomeStep({ content, onNext }: { content: InvestorOnboardingContentDTO; onNext: () => void }) {
  return (
    <>
      <div className="onb-section-head">
        <h2>How tradeMO pools work</h2>
        <p>
          You fund slots in a package. A professional operator trades the pooled capital on Deriv. When the trading window
          closes, net profit is split pro-rata and credited to your wallet.
        </p>
      </div>

      <div className="onb-stats">
        {content.stats.map((s) => (
          <StatTile key={s.key} stat={s} />
        ))}
      </div>

      <h3 className="onb-subhead">Pools vs. solo trading</h3>
      <div className="table-responsive onb-compare">
        <table className="table mb-0">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">
                <span className="onb-compare__pool">tradeMO pool</span>
              </th>
              <th scope="col">Solo trading</th>
            </tr>
          </thead>
          <tbody>
            {content.comparison.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td className="fw-semibold">{row.pool}</td>
                <td className="text-secondary">{row.solo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="onb-actions">
        <span className="onb-actions__note">Returns are not guaranteed. Past performance does not indicate future results.</span>
        <button type="button" className="btn-brand" onClick={onNext}>
          Continue <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </>
  );
}

/* ═════════════════ STEP 2 · HOW POOLS WORK ═════════════════ */

function HowStep({ content, onBack, onNext }: { content: InvestorOnboardingContentDTO; onBack: () => void; onNext: () => void }) {
  const s = content.sampleEarnings;
  const gross = (s.investment * s.poolRoiPercent) / 100;
  const cut = (gross * s.platformCutPercent) / 100;
  const net = gross - cut;
  const netRoi = (net / s.investment) * 100;

  return (
    <>
      <div className="onb-section-head">
        <h2>Pool → Trading → Profit sharing → Payout</h2>
        <p>Every package moves through the same four stages. You can track each one live from your dashboard.</p>
      </div>

      <div className="onb-flow">
        {content.lifecycle.map((stage, i) => (
          <div key={stage.key} className="onb-flow__stage" style={{ animationDelay: `${i * 140}ms` }}>
            <span className="onb-flow__icon">
              <Icon name={STAGE_ICONS[stage.key] ?? "check"} size={18} />
            </span>
            <span className="onb-flow__idx mono">0{i + 1}</span>
            <strong>{stage.title}</strong>
            <p>{stage.description}</p>
            <span className="onb-flow__dur mono">{stage.duration}</span>
            {i < content.lifecycle.length - 1 ? (
              <span className="onb-flow__link" aria-hidden="true">
                <span style={{ animationDelay: `${300 + i * 260}ms` }} />
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <h3 className="onb-subhead">Sample earnings calculation</h3>
      <div className="onb-calc">
        <dl className="onb-calc__table">
          <div>
            <dt>Investment</dt>
            <dd className="mono">
              {formatCurrency(s.investment, "USD", 0)} <span>({s.slots} slot · {s.packageCode})</span>
            </dd>
          </div>
          <div>
            <dt>Pool ROI</dt>
            <dd className="mono is-win">
              +{s.poolRoiPercent}% <span>over {s.tradingDays} days</span>
            </dd>
          </div>
          <div>
            <dt>Gross earnings</dt>
            <dd className="mono">{formatCurrency(gross)}</dd>
          </div>
          <div>
            <dt>Platform cut ({s.platformCutPercent}%)</dt>
            <dd className="mono is-loss">−{formatCurrency(cut)}</dd>
          </div>
          <div className="is-total">
            <dt>Net earnings</dt>
            <dd className="mono">
              {formatCurrency(net)} <span className="is-win">ROI {netRoi.toFixed(1)}%</span>
            </dd>
          </div>
        </dl>
        <p className="onb-calc__note">
          <Icon name="info" size={14} /> The platform cut applies to profits only. If a package closes at a loss, no fee is
          charged and the loss is shared pro-rata.
        </p>
      </div>

      <div className="onb-actions">
        <button type="button" className="btn-ghost" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Back
        </button>
        <button type="button" className="btn-brand" onClick={onNext}>
          Continue <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </>
  );
}

/* ═════════════════ STEP 3 · KYC ═════════════════ */

function KycStep({
  content,
  onBack,
  onSkip,
  onSubmitted,
}: {
  content: InvestorOnboardingContentDTO;
  onBack: () => void;
  onSkip: () => void;
  onSubmitted: (s: KycStatusDTO) => void;
}) {
  const submit = useKycSubmit();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      idDocType: "passport",
      idDocFrontUrl: "",
      idDocBackUrl: "",
      selfieUrl: "",
      proofOfAddressUrl: "",
      sourceOfFundsDeclaration: "",
      attest: false,
    } as KycFormValues,
    validators: {
      onSubmit: kycSchema,
    },
    onSubmit: async ({ value }) => {
      const docMeta = content.idDocTypes.find((d) => d.value === value.idDocType);
      if (docMeta?.requiresBack && !value.idDocBackUrl) {
        setFormError("Upload the back of your document.");
        return;
      }
      setFormError(null);
      try {
        const res = await submit.mutateAsync({
          idDocType: value.idDocType as KycIdDocType,
          idDocFrontUrl: value.idDocFrontUrl,
          idDocBackUrl: docMeta?.requiresBack ? value.idDocBackUrl : null,
          selfieUrl: value.selfieUrl,
          proofOfAddressUrl: value.proofOfAddressUrl,
          sourceOfFundsDeclaration: value.sourceOfFundsDeclaration as SourceOfFunds,
          enhancedDueDiligence: null,
        });
        onSubmitted(res);
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Could not submit documents.");
      }
    },
  });

  const attempts = useStore(form.store, (s) => s.submissionAttempts);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const docType = useStore(form.store, (s) => s.values.idDocType);
  const requiresBack = content.idDocTypes.find((d) => d.value === docType)?.requiresBack ?? false;
  const err = (errors: ReadonlyArray<unknown>) => (attempts > 0 ? errorText(errors) : null);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="onb-section-head">
        <h2>Verify your identity</h2>
        <p>
          Required before your first deposit (AML/KYC). Documents are encrypted and reviewed by our compliance team within{" "}
          <strong>{content.reviewEstimate}</strong>.
        </p>
      </div>

      <div className="onb-kyc">
        <div className="onb-kyc__group">
          <span className="onb-kyc__label">1 · Document type</span>
          <form.Field name="idDocType">
            {(field) => (
              <div className="onb-seg" role="radiogroup" aria-label="Document type">
                {content.idDocTypes.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    role="radio"
                    aria-checked={field.state.value === d.value}
                    className={cn("onb-seg__opt", field.state.value === d.value && "is-active")}
                    onClick={() => field.handleChange(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div className="onb-kyc__group">
          <span className="onb-kyc__label">2 · Upload document</span>
          <div className="row g-3 row-cols-1 row-cols-md-2">
            <div className="col">
              <form.Field name="idDocFrontUrl">
                {(field) => (
                  <>
                    <KycDropzone
                      slot="id-front"
                      label="Front side"
                      hint="JPG, PNG or PDF · max 10 MB"
                      icon="file"
                      value={field.state.value}
                      invalid={Boolean(err(field.state.meta.errors))}
                      onUploaded={field.handleChange}
                    />
                    <FieldErr text={err(field.state.meta.errors)} />
                  </>
                )}
              </form.Field>
            </div>
            {requiresBack ? (
              <div className="col">
                <form.Field name="idDocBackUrl">
                  {(field) => (
                    <KycDropzone slot="id-back" label="Back side" hint="Required for this document" icon="file" value={field.state.value} onUploaded={field.handleChange} />
                  )}
                </form.Field>
              </div>
            ) : null}
          </div>
        </div>

        <div className="onb-kyc__group">
          <span className="onb-kyc__label">3 · Selfie & address</span>
          <div className="row g-3 row-cols-1 row-cols-md-2">
            <div className="col">
              <form.Field name="selfieUrl">
                {(field) => (
                  <>
                    <KycDropzone
                      slot="selfie"
                      label="Selfie liveness check"
                      hint="Face centred, good light, no glasses"
                      icon="camera"
                      accept="image/*,video/*"
                      capture="user"
                      value={field.state.value}
                      invalid={Boolean(err(field.state.meta.errors))}
                      onUploaded={field.handleChange}
                    />
                    <FieldErr text={err(field.state.meta.errors)} />
                  </>
                )}
              </form.Field>
            </div>
            <div className="col">
              <form.Field name="proofOfAddressUrl">
                {(field) => (
                  <>
                    <KycDropzone
                      slot="proof-of-address"
                      label="Proof of address"
                      hint="Utility bill or bank statement ≤ 3 months"
                      icon="file"
                      value={field.state.value}
                      invalid={Boolean(err(field.state.meta.errors))}
                      onUploaded={field.handleChange}
                    />
                    <FieldErr text={err(field.state.meta.errors)} />
                  </>
                )}
              </form.Field>
            </div>
          </div>
        </div>

        <div className="onb-kyc__group">
          <span className="onb-kyc__label">4 · Source of funds</span>
          <form.Field name="sourceOfFundsDeclaration">
            {(field) => (
              <>
                <select
                  className={cn("form-select onb-select", err(field.state.meta.errors) && "is-invalid")}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as KycFormValues["sourceOfFundsDeclaration"])}
                  aria-label="Source of funds"
                >
                  <option value="">Select where your investment funds come from…</option>
                  {content.sourceOfFundsOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <FieldErr text={err(field.state.meta.errors)} />
              </>
            )}
          </form.Field>
        </div>

        <form.Field name="attest">
          {(field) => (
            <div>
              <Checkbox id="attest" checked={field.state.value} onChange={(v) => field.handleChange(v)} invalid={Boolean(err(field.state.meta.errors))}>
                I confirm the documents are genuine, belong to me, and the funds I invest are from the declared source.
              </Checkbox>
              <FieldErr text={err(field.state.meta.errors)} />
            </div>
          )}
        </form.Field>

        {formError ? <AuthAlert title={formError} /> : null}
      </div>

      <div className="onb-actions">
        <button type="button" className="btn-ghost" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Back
        </button>
        <div className="d-flex align-items-center gap-3 flex-wrap justify-content-end">
          <button type="button" className="auth-link-btn small" onClick={onSkip}>
            Skip for now
          </button>
          <SubmitButton loading={isSubmitting} loadingLabel="Submitting…" className="onb-submit">
            Submit for review <Icon name="arrowRight" size={16} />
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function FieldErr({ text }: { text: string | null }) {
  return text ? (
    <div className="auth-field__error" role="alert">
      <Icon name="alert" size={13} />
      {text}
    </div>
  ) : null;
}

/* ═════════════════ STEP 4 · DONE ═════════════════ */

function DoneStep({ content, kyc }: { content: InvestorOnboardingContentDTO; kyc: KycStatusDTO | null }) {
  const checklist = content.checklist.map((c) =>
    c.key === "kyc" ? { ...c, status: kyc ? ("pending" as const) : ("todo" as const), description: kyc ? c.description : "Not submitted yet" } : c,
  );
  return (
    <>
      <div className="onb-done-head">
        <StatusMark kind="success" size={60} />
        <div>
          <h2>You&apos;re all set</h2>
          <p>
            {kyc ? (
              <>
                Documents received — reference <span className="mono">{kyc.kycId}</span>. Level {kyc.level} limits apply while
                in review: <span className="mono">{formatCurrency(kyc.depositLimitPerTx, "USD", 0)}</span> per deposit,{" "}
                <span className="mono">{formatCurrency(kyc.depositLimitDaily, "USD", 0)}</span> daily.
              </>
            ) : (
              "You can browse pools now. Complete identity verification before your first deposit."
            )}
          </p>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-5">
          <h3 className="onb-subhead mt-0">Setup checklist</h3>
          <ul className="onb-checklist">
            {checklist.map((c) => (
              <li key={c.key} className={`is-${c.status}`}>
                <span className="onb-checklist__mark">{c.status === "done" ? <Icon name="check" size={12} /> : c.status === "pending" ? <Icon name="clock" size={12} /> : null}</span>
                <span>
                  <strong>{c.label}</strong>
                  <span>{c.description}</span>
                </span>
                <span className="onb-checklist__status">{c.status === "done" ? "Done" : c.status === "pending" ? "In review" : "To do"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-lg-7">
          <h3 className="onb-subhead mt-0">Recommended for you</h3>
          <div className="onb-pools">
            {content.recommendedPools.map((p) => {
              const fill = Math.round((p.slotsFilled / p.slotsTotal) * 100);
              return (
                <Link key={p.id} href={`/investor/pools/${p.id}`} className="onb-pool">
                  <div className="onb-pool__top">
                    <span className="mono onb-pool__code">{p.code}</span>
                    <span className={cn("onb-pool__status", `is-${p.status}`)}>{p.status}</span>
                    <span className={cn("onb-pool__risk", `is-${p.riskLevel}`)}>{p.riskLevel} risk</span>
                  </div>
                  <strong className="onb-pool__name">{p.name}</strong>
                  <div className="onb-pool__meta">
                    <span>
                      <em>Target</em>
                      <b className="mono is-win">+{p.targetRoiPercent}%</b>
                    </span>
                    <span>
                      <em>Slot</em>
                      <b className="mono">{formatCurrency(p.slotPrice, "USD", 0)}</b>
                    </span>
                    <span>
                      <em>Term</em>
                      <b className="mono">{p.durationDays}d</b>
                    </span>
                  </div>
                  <div className="onb-pool__fill">
                    <span className="onb-pool__bar">
                      <span style={{ width: `${fill}%` }} />
                    </span>
                    <span className="mono">
                      {p.slotsFilled}/{p.slotsTotal}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="onb-actions">
        <span className="onb-actions__note">We&apos;ll email you when your verification is complete.</span>
        <Link href="/investor" className="btn-brand">
          Go to investor dashboard <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </>
  );
}
