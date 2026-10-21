import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import { stepGlyph } from "@/components/icons";
import type { HowItWorksPayloadDTO, StepDTO } from "@/lib/api/types";

interface HowItWorksProps {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  payload: HowItWorksPayloadDTO;
  steps: StepDTO[];
}

export function HowItWorks({ eyebrow, title, subtitle, payload, steps }: HowItWorksProps) {
  if (steps.length === 0) return null;

  return (
    <section className="section-shell" id="how-it-works">
      <div className="container-xl">
        <Reveal>
          <div className="section-head section-head--center">
            <span className="eyebrow-label">{eyebrow}</span>
            <h2 className="section-head__title">{title}</h2>
            <p className="section-head__subtitle">{subtitle}</p>
          </div>
        </Reveal>

        <div className="how__grid">
          {steps.map((step, index) => (
            <Reveal key={step.id} delay={index * 80} className="h-100">
              <article className="how-step hover-lift h-100">
                <div className="how-step__badge">
                  <span className="how-step__number">{step.stepNumber}</span>
                  <span className="how-step__icon" aria-hidden="true">
                    {stepGlyph(step.icon)}
                  </span>
                </div>
                <h3 className="how-step__title">{step.title}</h3>
                <p className="how-step__desc">{step.description}</p>
                {step.highlights.length > 0 ? (
                  <ul className="how-step__list">
                    {step.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </Reveal>
          ))}
        </div>

        {payload?.footnote ? (
          <Reveal delay={120}>
            <p className="how__footnote">
              <Icon name="chart" size={15} /> {payload.footnote}
            </p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
