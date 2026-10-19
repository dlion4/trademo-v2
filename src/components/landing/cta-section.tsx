"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import { submitWaitlistSignup } from "@/lib/api/landing";
import { ApiError } from "@/lib/api/http";
import type { CtaSectionPayloadDTO } from "@/lib/api/types";

interface CtaSectionProps {
  eyebrow: string | null;
  payload: CtaSectionPayloadDTO;
}

export function CtaSection({ eyebrow, payload }: CtaSectionProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"operator" | "investor">("investor");

  const mutation = useMutation({
    mutationFn: submitWaitlistSignup,
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({ email, role, source: "landing-cta" });
  };

  const feedback = mutation.isError
    ? { tone: "err", text: mutation.error instanceof ApiError ? mutation.error.message : "Something went wrong." }
    : mutation.isSuccess
      ? { tone: "ok", text: mutation.data.message }
      : null;

  return (
    <section className="section-shell" id="get-started">
      <div className="container-xl">
        <Reveal>
          <div className="cta">
            <div className="cta__grid">
              <div>
                <span className="eyebrow-label">{eyebrow}</span>
                <h2 className="cta__title">{payload.title}</h2>
                <p className="cta__desc">{payload.description}</p>

                <ul className="cta__points">
                  {payload.trustPoints.map((point) => (
                    <li key={point}>
                      <Icon name="check" size={15} />
                      {point}
                    </li>
                  ))}
                </ul>

                <div className="cta__actions">
                  <Link href={payload.primaryCta.href} className="btn-brand">
                    {payload.primaryCta.label}
                    <Icon name="arrowRight" size={16} />
                  </Link>
                  <Link href={payload.secondaryCta.href} className="btn-ghost">
                    {payload.secondaryCta.label}
                  </Link>
                </div>
              </div>

              <div className="cta__panel">
                <p className="cta__panel-heading">{payload.formHeading}</p>

                <form className="cta__form" onSubmit={onSubmit} noValidate>
                  <div className="cta__segmented" role="group" aria-label="I am joining as">
                    <button
                      type="button"
                      className={role === "investor" ? "is-active" : undefined}
                      onClick={() => setRole("investor")}
                    >
                      💎 Investor
                    </button>
                    <button
                      type="button"
                      className={role === "operator" ? "is-active" : undefined}
                      onClick={() => setRole("operator")}
                    >
                      🤖 Operator
                    </button>
                  </div>

                  <div className="cta__field">
                    <input
                      type="email"
                      name="email"
                      required
                      autoComplete="email"
                      placeholder="you@fund.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-label="Email address"
                    />
                    <button type="submit" className="btn-brand" disabled={mutation.isPending}>
                      {mutation.isPending ? "Sending…" : "Get access"}
                    </button>
                  </div>

                  {feedback ? (
                    <p className={`cta__feedback cta__feedback--${feedback.tone}`} role="status">
                      {feedback.text}
                    </p>
                  ) : null}

                  <p className="cta__note">{payload.formNote}</p>
                </form>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
