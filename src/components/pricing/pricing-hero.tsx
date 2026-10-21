import Link from "next/link";

import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import type { PricingHeroPayloadDTO } from "@/lib/api/types";

interface PricingHeroProps {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  payload: PricingHeroPayloadDTO;
}

export function PricingHero({ eyebrow, title, subtitle, payload }: PricingHeroProps) {
  const highlight = payload.headlineHighlight;
  const base = highlight && title.endsWith(highlight) ? title.slice(0, -highlight.length) : title;

  return (
    <section className="pr-hero">
      <div className="container-xl">
        <Reveal>
          <span className="eyebrow-label">
            <Icon name="wallet" size={14} />
            {eyebrow}
          </span>
          <h1 className="pr-hero__title">
            {base}
            <span className="text-accent">{highlight}</span>
          </h1>
          <p className="pr-hero__sub">{subtitle}</p>
        </Reveal>

        <Reveal delay={80}>
          <div className="pr-hero__chips">
            {payload.chips.map((chip) => (
              <span className="pill" key={chip}>
                <Icon name="check" size={12} />
                {chip}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="d-flex flex-wrap gap-3 mt-4">
            <Link href={payload.primaryCta.href} className="btn-brand">
              {payload.primaryCta.label}
              <Icon name="arrowRight" size={16} />
            </Link>
            <Link href={payload.secondaryCta.href} className="btn-ghost">
              {payload.secondaryCta.label}
            </Link>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className="pr-hero__kpis">
            {payload.kpis.map((kpi) => (
              <div className="pr-kpi" key={kpi.key}>
                <div className="pr-kpi__value tnum">{kpi.value}</div>
                <div className="pr-kpi__label">{kpi.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
