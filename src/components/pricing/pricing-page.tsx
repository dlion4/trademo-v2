"use client";

import Link from "next/link";

import { Icon } from "@/components/icons";
import { FeeMatrix } from "@/components/pricing/fee-matrix";
import { InvestmentCalculator } from "@/components/pricing/investment-calculator";
import { PricingFaq } from "@/components/pricing/pricing-faq";
import { PricingHero } from "@/components/pricing/pricing-hero";
import { PricingTiers } from "@/components/pricing/pricing-tiers";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { usePricingContent } from "@/lib/queries/use-landing-queries";
import type { PricingContentDTO } from "@/lib/api/types";

interface PricingPageProps {
  initialContent: PricingContentDTO;
}

/**
 * Page H-3 · Pricing & Investor Economics (`/pricing`).
 * Scoped under .page-pricing
 */
export function PricingPage({ initialContent }: PricingPageProps) {
  const { data } = usePricingContent(initialContent);
  const content = data ?? initialContent;

  return (
    <MarketingShell rootClass="page-pricing" contentSource={content.meta.source}>
      <PricingHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        subtitle={content.hero.subtitle}
        payload={content.hero.payload}
      />

      <PricingTiers tiers={content.tiers} />

      <InvestmentCalculator
        tiers={content.tiers}
        assetClasses={content.assetClasses}
      />

      <FeeMatrix comparisonRows={content.feeComparison} />

      <PricingFaq faqs={content.faqs} />

      {/* CTA Box */}
      <div className="container-xl pb-5">
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
              <span key={point}>
                <Icon name="check" size={14} className="me-1 text-success" />
                {point}
              </span>
            ))}
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
