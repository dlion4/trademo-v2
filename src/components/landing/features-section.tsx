import Link from "next/link";

import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import { featureGlyph } from "@/components/icons";
import type { FeatureDTO } from "@/lib/api/types";

export function FeaturesSection({ features }: { features: FeatureDTO[] }) {
  if (features.length === 0) return null;

  return (
    <section className="section-shell" id="features">
      <div className="container-xl">
        <Reveal>
          <div className="section-head section-head--center">
            <span className="eyebrow-label">Multi-Asset Crowdfunding</span>
            <h2 className="section-head__title">Algorithmic execution. Real yield for investors.</h2>
            <p className="section-head__subtitle">
              Our quantitative models execute trades on pooled capital, and the profit engine splits every
              settled trade proportionally with high-water mark protection.
            </p>
          </div>
        </Reveal>

        <div className="features__grid">
          {features.map((feature, index) => (
            <Reveal key={feature.id} delay={index * 90} className="h-100">
              <article className={`surface-card hover-lift feature-card feature-card--${feature.accent} h-100`}>
                <div className="feature-card__top">
                  <span className="feature-card__glyph" aria-hidden="true">
                    {featureGlyph(feature.icon)}
                  </span>
                  {feature.badge ? <span className="pill">{feature.badge}</span> : null}
                </div>

                <div>
                  {feature.eyebrow ? <span className="eyebrow-label">{feature.eyebrow}</span> : null}
                  <h3 className="feature-card__title">{feature.title}</h3>
                  <p className="feature-card__desc">{feature.description}</p>
                </div>

                <ul className="feature-card__list">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet}>
                      <Icon name="check" size={14} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="feature-card__foot">
                  <div>
                    <div className="feature-card__metric-label">{feature.metricLabel}</div>
                    <div className="feature-card__metric-value">{feature.metricValue}</div>
                  </div>
                  <Link href={feature.href} className="feature-card__link">
                    Explore
                    <Icon name="arrowRight" size={15} />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
