import { asc, sql } from "drizzle-orm";

import { db } from "@/db";
import { poolAssetClasses, pricingFaqs, pricingSections, pricingTiers } from "@/db/schema";
import {
  FEE_COMPARISON_MATRIX,
  POOL_ASSET_CLASSES,
  PRICING_FAQS,
  PRICING_FALLBACK,
  PRICING_HERO,
  PRICING_TIERS,
} from "@/lib/content/pricing-content";
import type {
  ContentMetaDTO,
  CtaSectionPayloadDTO,
  FeeComparisonRowDTO,
  PoolAssetClassDTO,
  PricingContentDTO,
  PricingFaqDTO,
  PricingHeroPayloadDTO,
  PricingTierDTO,
} from "@/lib/api/types";

const CONTENT_VERSION = 1;

function meta(source: ContentMetaDTO["source"]): ContentMetaDTO {
  return { source, generatedAt: new Date().toISOString(), version: CONTENT_VERSION };
}

/* ───────────────────────────── seeding ───────────────────────────── */

let seedPromise: Promise<boolean> | null = null;

async function seedOnce(): Promise<boolean> {
  const existing = await db.select({ id: pricingTiers.id }).from(pricingTiers).limit(1);
  if (existing.length > 0) return true;

  await db
    .insert(pricingSections)
    .values([
      {
        key: PRICING_HERO.key,
        eyebrow: PRICING_HERO.eyebrow,
        title: PRICING_HERO.title,
        subtitle: PRICING_HERO.subtitle,
        payload: PRICING_HERO.payload as unknown as Record<string, unknown>,
        sortOrder: 1,
      },
      {
        key: "pricing-cta",
        eyebrow: PRICING_FALLBACK.cta.eyebrow,
        title: PRICING_FALLBACK.cta.title,
        subtitle: PRICING_FALLBACK.cta.subtitle,
        payload: PRICING_FALLBACK.cta.payload as unknown as Record<string, unknown>,
        sortOrder: 2,
      },
    ])
    .onConflictDoNothing();

  await db.insert(pricingTiers).values(
    PRICING_TIERS.map((tier, index) => ({
      slug: tier.slug,
      name: tier.name,
      headline: tier.headline,
      minCapital: tier.minCapital,
      maxCapital: tier.maxCapital,
      managementFeePercent: tier.managementFeePercent,
      performanceFeePercent: tier.performanceFeePercent,
      accessFeePercent: tier.accessFeePercent,
      payoutFrequency: tier.payoutFrequency,
      badge: tier.badge,
      isPopular: tier.isPopular,
      description: tier.description,
      perks: tier.perks,
      sortOrder: index,
    })),
  );

  await db.insert(poolAssetClasses).values(
    POOL_ASSET_CLASSES.map((pool, index) => ({
      slug: pool.slug,
      name: pool.name,
      category: pool.category,
      description: pool.description,
      avgMonthlyReturnPercent: pool.avgMonthlyReturnPercent,
      historicalSharpe: pool.historicalSharpe,
      riskScore: pool.riskScore,
      minLockDays: pool.minLockDays,
      availableCapacityUsd: pool.availableCapacityUsd,
      sortOrder: index,
    })),
  );

  await db.insert(pricingFaqs).values(
    PRICING_FAQS.map((faq, index) => ({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      sortOrder: index,
    })),
  );

  return true;
}

export async function ensurePricingSeed(): Promise<boolean> {
  if (!seedPromise) {
    seedPromise = seedOnce().catch((error) => {
      console.warn("[pricing] seed skipped:", error instanceof Error ? error.message : error);
      seedPromise = null;
      return false;
    });
  }
  return seedPromise;
}

/* ─────────────────────────── read model ─────────────────────────── */

export async function getPricingContent(): Promise<{
  content: PricingContentDTO;
  usedFallback: boolean;
}> {
  try {
    await ensurePricingSeed();

    const [sectionRows, tierRows, assetRows, faqRows] = await Promise.all([
      db.select().from(pricingSections).where(sql`${pricingSections.isActive} = true`),
      db
        .select()
        .from(pricingTiers)
        .where(sql`${pricingTiers.isActive} = true`)
        .orderBy(asc(pricingTiers.sortOrder)),
      db
        .select()
        .from(poolAssetClasses)
        .where(sql`${poolAssetClasses.isActive} = true`)
        .orderBy(asc(poolAssetClasses.sortOrder)),
      db
        .select()
        .from(pricingFaqs)
        .where(sql`${pricingFaqs.isActive} = true`)
        .orderBy(asc(pricingFaqs.sortOrder)),
    ]);

    const heroRow = sectionRows.find((row) => row.key === PRICING_HERO.key);
    const ctaRow = sectionRows.find((row) => row.key === "pricing-cta");

    const tiers: PricingTierDTO[] = tierRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      headline: row.headline,
      minCapital: row.minCapital,
      maxCapital: row.maxCapital,
      managementFeePercent: row.managementFeePercent,
      performanceFeePercent: row.performanceFeePercent,
      accessFeePercent: row.accessFeePercent,
      payoutFrequency: row.payoutFrequency,
      badge: row.badge,
      isPopular: row.isPopular,
      description: row.description,
      perks: row.perks ?? [],
    }));

    const assetClasses: PoolAssetClassDTO[] = assetRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      description: row.description,
      avgMonthlyReturnPercent: row.avgMonthlyReturnPercent,
      historicalSharpe: row.historicalSharpe,
      riskScore: row.riskScore,
      minLockDays: row.minLockDays,
      availableCapacityUsd: row.availableCapacityUsd,
    }));

    const faqs: PricingFaqDTO[] = faqRows.map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category,
    }));

    if (tiers.length === 0) {
      return { content: { ...PRICING_FALLBACK, meta: meta("fallback") }, usedFallback: true };
    }

    const content: PricingContentDTO = {
      hero: {
        key: heroRow?.key ?? PRICING_FALLBACK.hero.key,
        eyebrow: heroRow?.eyebrow ?? PRICING_FALLBACK.hero.eyebrow,
        title: heroRow?.title ?? PRICING_FALLBACK.hero.title,
        subtitle: heroRow?.subtitle ?? PRICING_FALLBACK.hero.subtitle,
        payload: (heroRow?.payload as unknown as PricingHeroPayloadDTO) ?? PRICING_FALLBACK.hero.payload,
      },
      tiers,
      assetClasses: assetClasses.length > 0 ? assetClasses : PRICING_FALLBACK.assetClasses,
      feeComparison: FEE_COMPARISON_MATRIX,
      faqs: faqs.length > 0 ? faqs : PRICING_FALLBACK.faqs,
      cta: {
        key: ctaRow?.key ?? PRICING_FALLBACK.cta.key,
        eyebrow: ctaRow?.eyebrow ?? PRICING_FALLBACK.cta.eyebrow,
        title: ctaRow?.title ?? PRICING_FALLBACK.cta.title,
        subtitle: ctaRow?.subtitle ?? PRICING_FALLBACK.cta.subtitle,
        payload: (ctaRow?.payload as unknown as CtaSectionPayloadDTO) ?? PRICING_FALLBACK.cta.payload,
      },
      meta: meta("database"),
    };

    return { content, usedFallback: false };
  } catch (error) {
    console.warn("[pricing] falling back to bundled content:", error instanceof Error ? error.message : error);
    return { content: { ...PRICING_FALLBACK, meta: meta("fallback") }, usedFallback: true };
  }
}
