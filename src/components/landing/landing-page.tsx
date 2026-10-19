"use client";

import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNavbar } from "@/components/landing/site-navbar";
import { StatsBand } from "@/components/landing/stats-band";
import { TrustBar } from "@/components/landing/trust-bar";
import { useLandingContent } from "@/lib/queries/use-landing-queries";
import type { LandingContentDTO } from "@/lib/api/types";

interface LandingPageProps {
  /** Server-rendered payload — becomes TanStack Query's initialData. */
  initialContent: LandingContentDTO;
}

/**
 * Page H-1 · Landing (`/`).
 * Root class `.page-landing` scopes every rule in src/styles/pages/landing.css.
 * All copy/stats/quotes arrive through the typed content contract, so the
 * backend integration is a transport swap in `src/lib/api`.
 */
export function LandingPage({ initialContent }: LandingPageProps) {
  const { data } = useLandingContent(initialContent);
  const content = data ?? initialContent;

  return (
    <div className="page-landing app-shell">
      <SiteNavbar />

      <main className="app-shell__main">
        <HeroSection
          eyebrow={content.hero.eyebrow}
          title={content.hero.title}
          subtitle={content.hero.subtitle}
          payload={content.hero.payload}
          tickerQuotes={content.ticker}
        />

        <TrustBar badges={content.trustBadges} />

        <StatsBand stats={content.stats} />

        <FeaturesSection features={content.features} />

        <HowItWorks
          eyebrow={content.howItWorks.eyebrow}
          title={content.howItWorks.title}
          subtitle={content.howItWorks.subtitle}
          payload={content.howItWorks.payload}
          steps={content.steps}
        />

        <CtaSection eyebrow={content.cta.eyebrow} payload={content.cta.payload} />
      </main>

      <SiteFooter contentSource={content.meta.source} />
    </div>
  );
}
