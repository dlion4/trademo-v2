"use client";

import Link from "next/link";

import { Icon } from "@/components/icons";
import { BotEngineDemo } from "@/components/features/bot-engine-demo";
import { ComparisonMatrix } from "@/components/features/comparison-matrix";
import { FeaturesHero } from "@/components/features/features-hero";
import { GuardianDemo } from "@/components/features/guardian-demo";
import { MarketsDemo } from "@/components/features/markets-demo";
import { ModuleShell } from "@/components/features/module-shell";
import { PoolsDemo } from "@/components/features/pools-demo";
import { ScriptEngineDemo } from "@/components/features/script-engine-demo";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { useFeaturesContent } from "@/lib/queries/use-landing-queries";
import type { FeatureDemoDTO, FeaturesContentDTO } from "@/lib/api/types";

/** Renders the module-specific demo widget from the discriminated union. */
function ModuleDemo({ demo }: { demo: FeatureDemoDTO }) {
  switch (demo.kind) {
    case "botEngine":
      return <BotEngineDemo demo={demo} />;
    case "scriptEngine":
      return <ScriptEngineDemo demo={demo} />;
    case "pools":
      return <PoolsDemo demo={demo} />;
    case "guardian":
      return <GuardianDemo demo={demo} />;
    case "markets":
      return <MarketsDemo demo={demo} />;
    default:
      return null;
  }
}

interface FeaturesPageProps {
  initialContent: FeaturesContentDTO;
}

/**
 * Page H-2 · Features (`/features`).
 * Root class `.page-features` scopes src/styles/pages/features.css.
 */
export function FeaturesPage({ initialContent }: FeaturesPageProps) {
  const { data } = useFeaturesContent(initialContent);
  const content = data ?? initialContent;

  return (
    <MarketingShell rootClass="page-features" contentSource={content.meta.source}>
      <FeaturesHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        subtitle={content.hero.subtitle}
        payload={content.hero.payload}
      />

      <nav className="fp-subnav" aria-label="Feature sections">
        <div className="container-xl">
          <div className="fp-subnav__inner">
            {content.modules.map((module) => (
              <a className="fp-subnav__link" href={`#${module.slug}`} key={module.slug}>
                <span className="fp-subnav__num">{module.number}</span>
                {module.title}
              </a>
            ))}
            <a className="fp-subnav__link" href="#matrix">
              <span className="fp-subnav__num">06</span>
              Feature matrix
            </a>
          </div>
        </div>
      </nav>

      {content.modules.map((module) => (
        <ModuleShell key={module.id} module={module}>
          <ModuleDemo demo={module.demo} />
        </ModuleShell>
      ))}

      <ComparisonMatrix rows={content.matrix} />

      <div className="container-xl">
        <section className="fp-cta">
          <span className="eyebrow-label" style={{ color: "#94a3b8" }}>
            {content.cta.eyebrow}
          </span>
          <h2>{content.cta.payload.title}</h2>
          <p>{content.cta.payload.description}</p>

          <div className="fp-cta__actions">
            <Link href={content.cta.payload.primaryCta.href} className="btn-brand">
              {content.cta.payload.primaryCta.label}
              <Icon name="arrowRight" size={16} />
            </Link>
            <Link href={content.cta.payload.secondaryCta.href} className="btn-ghost">
              {content.cta.payload.secondaryCta.label}
            </Link>
          </div>

          <div className="fp-cta__meta">
            {content.cta.payload.trustPoints.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
