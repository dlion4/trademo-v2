import { asc, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  howItWorksSteps,
  landingSections,
  landingStats,
  platformFeatures,
  tickerInstruments,
  trustBadges,
} from "@/db/schema";
import {
  CTA_SECTION,
  HERO_SECTION,
  HOW_IT_WORKS_SECTION,
  HOW_IT_WORKS_STEPS,
  LANDING_FALLBACK,
  LANDING_STATS,
  PLATFORM_FEATURES,
  TICKER_INSTRUMENTS,
  TRUST_BADGES,
} from "@/lib/content/landing-content";
import type {
  CtaSectionPayloadDTO,
  ContentMetaDTO,
  FeatureDTO,
  HeroPayloadDTO,
  HowItWorksPayloadDTO,
  LandingContentDTO,
  StatDTO,
  StepDTO,
  TickerQuoteDTO,
  TrustBadgeDTO,
} from "@/lib/api/types";

const CONTENT_VERSION = 1;

function meta(source: ContentMetaDTO["source"]): ContentMetaDTO {
  return { source, generatedAt: new Date().toISOString(), version: CONTENT_VERSION };
}

/* ────────────────────────────── seeding ────────────────────────────── */

let seedPromise: Promise<boolean> | null = null;

async function seedOnce(): Promise<boolean> {
  const existing = await db.select({ id: landingSections.id }).from(landingSections).limit(1);
  if (existing.length > 0) return true;

  await db
    .insert(landingSections)
    .values([
      { key: HERO_SECTION.key, eyebrow: HERO_SECTION.eyebrow, title: HERO_SECTION.title, subtitle: HERO_SECTION.subtitle, payload: HERO_SECTION.payload as unknown as Record<string, unknown>, sortOrder: 1 },
      { key: HOW_IT_WORKS_SECTION.key, eyebrow: HOW_IT_WORKS_SECTION.eyebrow, title: HOW_IT_WORKS_SECTION.title, subtitle: HOW_IT_WORKS_SECTION.subtitle, payload: HOW_IT_WORKS_SECTION.payload as unknown as Record<string, unknown>, sortOrder: 2 },
      { key: CTA_SECTION.key, eyebrow: CTA_SECTION.eyebrow, title: CTA_SECTION.title, subtitle: CTA_SECTION.subtitle, payload: CTA_SECTION.payload as unknown as Record<string, unknown>, sortOrder: 3 },
    ])
    .onConflictDoNothing();

  await db.insert(landingStats).values(
    LANDING_STATS.map((stat, index) => ({
      key: stat.key,
      label: stat.label,
      value: stat.value,
      prefix: stat.prefix,
      suffix: stat.suffix,
      decimals: stat.decimals,
      caption: stat.caption,
      icon: stat.icon,
      sortOrder: index,
    })),
  );

  await db.insert(tickerInstruments).values(
    TICKER_INSTRUMENTS.map((quote, index) => ({
      symbol: quote.symbol,
      displayName: quote.displayName,
      market: quote.market,
      price: quote.price,
      changePercent: quote.changePercent,
      dayHigh: quote.dayHigh,
      dayLow: quote.dayLow,
      sparkline: quote.sparkline,
      decimals: quote.decimals,
      sortOrder: index,
    })),
  );

  await db.insert(platformFeatures).values(
    PLATFORM_FEATURES.map((feature, index) => ({
      slug: feature.slug,
      icon: feature.icon,
      eyebrow: feature.eyebrow,
      title: feature.title,
      description: feature.description,
      bullets: feature.bullets,
      metricLabel: feature.metricLabel,
      metricValue: feature.metricValue,
      badge: feature.badge,
      accent: feature.accent,
      href: feature.href,
      sortOrder: index,
    })),
  );

  await db.insert(howItWorksSteps).values(
    HOW_IT_WORKS_STEPS.map((step) => ({
      stepNumber: step.stepNumber,
      icon: step.icon,
      title: step.title,
      description: step.description,
      highlights: step.highlights,
    })),
  );

  await db.insert(trustBadges).values(
    TRUST_BADGES.map((badge, index) => ({
      icon: badge.icon,
      label: badge.label,
      detail: badge.detail,
      sortOrder: index,
    })),
  );

  return true;
}

/** Idempotent, lazily-invoked content seed. Never throws. */
export async function ensureLandingSeed(): Promise<boolean> {
  if (!seedPromise) {
    seedPromise = seedOnce().catch((error) => {
      console.warn("[landing] seed skipped:", error instanceof Error ? error.message : error);
      seedPromise = null;
      return false;
    });
  }
  return seedPromise;
}

/* ─────────────────────────── ticker simulation ─────────────────────────── */

function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 100000;
  }
  return hash / 1000;
}

const VOLATILITY_BY_MARKET: Record<string, number> = {
  forex: 0.0016,
  synthetic: 0.006,
  crypto: 0.009,
  commodity: 0.003,
  index: 0.004,
};

/**
 * Stateless tick generator. Produces smooth, deterministic-per-second price
 * motion so every client/render agrees, and is trivially replaceable with a
 * live exchange websocket tick subscription in the backend integration phase.
 */
function simulateQuote(row: {
  symbol: string;
  displayName: string;
  market: string;
  price: number;
  decimals: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  sparkline: number[];
}, now: number): TickerQuoteDTO {
  const phase = hashSeed(row.symbol);
  const volatility = VOLATILITY_BY_MARKET[row.market] ?? 0.004;
  const seconds = now / 1000;

  const wave = (t: number) =>
    Math.sin(t / 47 + phase) * 0.6 + Math.sin(t / 13 + phase * 1.7) * 0.3 + Math.sin(t / 181 + phase) * 0.9;

  const drift = wave(seconds) * volatility;
  const price = Math.max(row.price * 0.9, row.price * (1 + drift));
  const reference = row.price * (1 + wave(seconds - 900) * volatility);
  const changePercent = row.price > 0 ? ((price - reference) / reference) * 100 : 0;

  const sparkline = Array.from({ length: 28 }, (_, index) => {
    const offset = (27 - index) * 30;
    return Number((row.price * (1 + wave(seconds - offset) * volatility)).toFixed(row.decimals));
  });

  return {
    symbol: row.symbol,
    displayName: row.displayName,
    market: row.market,
    price: Number(price.toFixed(row.decimals)),
    changePercent: Number(changePercent.toFixed(2)),
    direction: changePercent > 0.001 ? "up" : changePercent < -0.001 ? "down" : "flat",
    dayHigh: Number(Math.max(row.dayHigh, price).toFixed(row.decimals)),
    dayLow: Number(Math.min(row.dayLow, price).toFixed(row.decimals)),
    sparkline,
    decimals: row.decimals,
    updatedAt: new Date(now).toISOString(),
  };
}

/* ────────────────────────────── public API ────────────────────────────── */

export interface LandingQueryResult {
  content: LandingContentDTO;
  usedFallback: boolean;
}

export async function getLandingContent(): Promise<LandingQueryResult> {
  try {
    await ensureLandingSeed();

    const [sectionRows, statRows, featureRows, stepRows, badgeRows, tickerRows] = await Promise.all([
      db.select().from(landingSections).where(sql`${landingSections.isActive} = true`),
      db.select().from(landingStats).where(sql`${landingStats.isActive} = true`).orderBy(asc(landingStats.sortOrder)),
      db
        .select()
        .from(platformFeatures)
        .where(sql`${platformFeatures.isActive} = true`)
        .orderBy(asc(platformFeatures.sortOrder)),
      db
        .select()
        .from(howItWorksSteps)
        .where(sql`${howItWorksSteps.isActive} = true`)
        .orderBy(asc(howItWorksSteps.stepNumber)),
      db.select().from(trustBadges).where(sql`${trustBadges.isActive} = true`).orderBy(asc(trustBadges.sortOrder)),
      db
        .select()
        .from(tickerInstruments)
        .where(sql`${tickerInstruments.isActive} = true`)
        .orderBy(asc(tickerInstruments.sortOrder)),
    ]);

    const findSection = (key: string) => sectionRows.find((row) => row.key === key);

    const heroRow = findSection("hero");
    const howRow = findSection("how-it-works");
    const ctaRow = findSection("cta");

    const content: LandingContentDTO = {
      hero: {
        key: heroRow?.key ?? LANDING_FALLBACK.hero.key,
        eyebrow: heroRow?.eyebrow ?? LANDING_FALLBACK.hero.eyebrow,
        title: heroRow?.title ?? LANDING_FALLBACK.hero.title,
        subtitle: heroRow?.subtitle ?? LANDING_FALLBACK.hero.subtitle,
        payload: (heroRow?.payload as unknown as HeroPayloadDTO) ?? LANDING_FALLBACK.hero.payload,
      },
      howItWorks: {
        key: howRow?.key ?? LANDING_FALLBACK.howItWorks.key,
        eyebrow: howRow?.eyebrow ?? LANDING_FALLBACK.howItWorks.eyebrow,
        title: howRow?.title ?? LANDING_FALLBACK.howItWorks.title,
        subtitle: howRow?.subtitle ?? LANDING_FALLBACK.howItWorks.subtitle,
        payload: (howRow?.payload as unknown as HowItWorksPayloadDTO) ?? LANDING_FALLBACK.howItWorks.payload,
      },
      cta: {
        key: ctaRow?.key ?? LANDING_FALLBACK.cta.key,
        eyebrow: ctaRow?.eyebrow ?? LANDING_FALLBACK.cta.eyebrow,
        title: ctaRow?.title ?? LANDING_FALLBACK.cta.title,
        subtitle: ctaRow?.subtitle ?? LANDING_FALLBACK.cta.subtitle,
        payload: (ctaRow?.payload as unknown as CtaSectionPayloadDTO) ?? LANDING_FALLBACK.cta.payload,
      },
      stats:
        statRows.map<StatDTO>((row) => ({
          id: row.id,
          key: row.key,
          label: row.label,
          value: row.value,
          prefix: row.prefix,
          suffix: row.suffix,
          decimals: row.decimals,
          caption: row.caption,
          icon: row.icon,
        })) || LANDING_FALLBACK.stats,
      features:
        featureRows.map<FeatureDTO>((row) => ({
          id: row.id,
          slug: row.slug,
          icon: row.icon,
          eyebrow: row.eyebrow,
          title: row.title,
          description: row.description,
          bullets: row.bullets ?? [],
          metricLabel: row.metricLabel,
          metricValue: row.metricValue,
          badge: row.badge,
          accent: (row.accent as FeatureDTO["accent"]) ?? "teal",
          href: row.href,
        })) || LANDING_FALLBACK.features,
      steps:
        stepRows.map<StepDTO>((row) => ({
          id: row.id,
          stepNumber: row.stepNumber,
          icon: row.icon,
          title: row.title,
          description: row.description,
          highlights: row.highlights ?? [],
        })) || LANDING_FALLBACK.steps,
      trustBadges:
        badgeRows.map<TrustBadgeDTO>((row) => ({
          id: row.id,
          icon: row.icon,
          label: row.label,
          detail: row.detail,
        })) || LANDING_FALLBACK.trustBadges,
      ticker: tickerRows.map((row) =>
        simulateQuote(
          {
            symbol: row.symbol,
            displayName: row.displayName,
            market: row.market,
            price: row.price,
            decimals: row.decimals,
            changePercent: row.changePercent,
            dayHigh: row.dayHigh,
            dayLow: row.dayLow,
            sparkline: row.sparkline ?? [],
          },
          Date.now(),
        ),
      ),
      meta: meta("database"),
    };

    const empty =
      content.stats.length === 0 && content.features.length === 0 && content.steps.length === 0;

    if (empty) {
      return { content: { ...LANDING_FALLBACK, meta: meta("fallback") }, usedFallback: true };
    }

    return { content, usedFallback: false };
  } catch (error) {
    console.warn("[landing] falling back to bundled content:", error instanceof Error ? error.message : error);
    return { content: { ...LANDING_FALLBACK, meta: meta("fallback") }, usedFallback: true };
  }
}

export async function getTickerFeed(): Promise<{ quotes: TickerQuoteDTO[]; meta: ContentMetaDTO }> {
  const now = Date.now();
  try {
    await ensureLandingSeed();
    const rows = await db
      .select()
      .from(tickerInstruments)
      .where(sql`${tickerInstruments.isActive} = true`)
      .orderBy(asc(tickerInstruments.sortOrder));

    if (rows.length === 0) {
      return { quotes: LANDING_FALLBACK.ticker, meta: meta("fallback") };
    }

    return {
      quotes: rows.map((row) =>
        simulateQuote(
          {
            symbol: row.symbol,
            displayName: row.displayName,
            market: row.market,
            price: row.price,
            decimals: row.decimals,
            changePercent: row.changePercent,
            dayHigh: row.dayHigh,
            dayLow: row.dayLow,
            sparkline: row.sparkline ?? [],
          },
          now,
        ),
      ),
      meta: meta("database"),
    };
  } catch {
    return {
      quotes: LANDING_FALLBACK.ticker.map((quote) => simulateQuote(quote, now)),
      meta: meta("fallback"),
    };
  }
}
