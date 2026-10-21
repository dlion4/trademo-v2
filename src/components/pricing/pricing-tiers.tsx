import Link from "next/link";

import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { PricingTierDTO } from "@/lib/api/types";

interface PricingTiersProps {
  tiers: PricingTierDTO[];
}

export function PricingTiers({ tiers }: PricingTiersProps) {
  return (
    <section className="section-shell" id="tiers">
      <div className="container-xl">
        <Reveal>
          <div className="section-head section-head--center">
            <span className="eyebrow-label">Capital Management Tiers</span>
            <h2 className="section-head__title">Lower fees as your capital scales</h2>
            <p className="section-head__subtitle">
              Performance fees are automatically tiered based on your active pool allocation.
              Zero entry fees, no monthly SaaS subscriptions, and high-water mark protection on 100% of pools.
            </p>
          </div>
        </Reveal>

        <div className="tiers-grid">
          {tiers.map((tier, index) => (
            <Reveal key={tier.id} delay={index * 90} className="h-100">
              <article
                className={`tier-card h-100${tier.isPopular ? " tier-card--popular" : ""}`}
              >
                {tier.badge ? (
                  <span className={`pill ${tier.isPopular ? "pill-live" : ""} tier-card__badge`}>
                    {tier.isPopular && <span className="live-dot" />}
                    {tier.badge}
                  </span>
                ) : null}

                <div className="tier-card__head">
                  <h3 className="tier-card__name">{tier.name}</h3>
                  <div className="tier-card__range">{tier.headline}</div>
                  <p className="tier-card__desc">{tier.description}</p>

                  <div className="tier-card__rates">
                    <div className="tier-rate">
                      <span className="tier-rate__label">Performance Fee</span>
                      <span className="tier-rate__val">{formatNumber(tier.performanceFeePercent)}%</span>
                      <span className="tier-rate__sub">of net profit</span>
                    </div>
                    <div className="tier-rate">
                      <span className="tier-rate__label">Mgmt Fee</span>
                      <span className="tier-rate__val">{tier.managementFeePercent}%</span>
                      <span className="tier-rate__sub">annualized</span>
                    </div>
                  </div>
                </div>

                <ul className="tier-card__perks">
                  {tier.perks.map((perk) => (
                    <li key={perk}>
                      <Icon name="check" size={15} />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>

                <div className="tier-card__foot">
                  <Link
                    href={`/auth/signup?role=investor&tier=${tier.slug}`}
                    className={tier.isPopular ? "btn-brand w-100" : "btn-ghost w-100"}
                  >
                    Start with {tier.name}
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
