import { asc, sql } from "drizzle-orm";

import { db } from "@/db";
import { featureMatrixRows, featureModules, featuresSections } from "@/db/schema";
import {
  FEATURE_MATRIX,
  FEATURE_MODULES,
  FEATURES_FALLBACK,
  FEATURES_HERO,
} from "@/lib/content/features-content";
import { CTA_SECTION } from "@/lib/content/landing-content";
import type {
  CtaSectionPayloadDTO,
  ContentMetaDTO,
  FeatureDemoDTO,
  FeatureModuleDTO,
  FeaturesContentDTO,
  FeaturesHeroPayloadDTO,
  MatrixRowDTO,
  SupportLevel,
} from "@/lib/api/types";

const CONTENT_VERSION = 1;

function meta(source: ContentMetaDTO["source"]): ContentMetaDTO {
  return { source, generatedAt: new Date().toISOString(), version: CONTENT_VERSION };
}

/* ───────────────────────────── seeding ───────────────────────────── */

let seedPromise: Promise<boolean> | null = null;

async function seedOnce(): Promise<boolean> {
  const existing = await db.select({ id: featureModules.id }).from(featureModules).limit(1);
  if (existing.length > 0) return true;

  await db
    .insert(featuresSections)
    .values([
      {
        key: FEATURES_HERO.key,
        eyebrow: FEATURES_HERO.eyebrow,
        title: FEATURES_HERO.title,
        subtitle: FEATURES_HERO.subtitle,
        payload: FEATURES_HERO.payload as unknown as Record<string, unknown>,
        sortOrder: 1,
      },
      {
        key: "features-cta",
        eyebrow: CTA_SECTION.eyebrow,
        title: CTA_SECTION.title,
        subtitle: CTA_SECTION.subtitle,
        payload: CTA_SECTION.payload as unknown as Record<string, unknown>,
        sortOrder: 2,
      },
    ])
    .onConflictDoNothing();

  await db.insert(featureModules).values(
    FEATURE_MODULES.map((module, index) => ({
      slug: module.slug,
      number: module.number,
      icon: module.icon,
      eyebrow: module.eyebrow,
      title: module.title,
      summary: module.summary,
      bullets: module.bullets,
      specs: module.specs,
      demo: module.demo as unknown as Record<string, unknown>,
      sortOrder: index,
    })),
  );

  await db.insert(featureMatrixRows).values(
    FEATURE_MATRIX.map((row, index) => ({
      groupName: row.group,
      capability: row.capability,
      operatorLevel: row.operator,
      investorLevel: row.investor,
      note: row.note,
      sortOrder: index,
    })),
  );

  return true;
}

export async function ensureFeaturesSeed(): Promise<boolean> {
  if (!seedPromise) {
    seedPromise = seedOnce().catch((error) => {
      console.warn("[features] seed skipped:", error instanceof Error ? error.message : error);
      seedPromise = null;
      return false;
    });
  }
  return seedPromise;
}

/* ─────────────────────────── read model ─────────────────────────── */

const SUPPORT_LEVELS: SupportLevel[] = ["full", "partial", "none"];

function toSupportLevel(value: string): SupportLevel {
  return (SUPPORT_LEVELS as string[]).includes(value) ? (value as SupportLevel) : "none";
}

export async function getFeaturesContent(): Promise<{
  content: FeaturesContentDTO;
  usedFallback: boolean;
}> {
  try {
    await ensureFeaturesSeed();

    const [sectionRows, moduleRows, matrixRows] = await Promise.all([
      db.select().from(featuresSections).where(sql`${featuresSections.isActive} = true`),
      db
        .select()
        .from(featureModules)
        .where(sql`${featureModules.isActive} = true`)
        .orderBy(asc(featureModules.sortOrder)),
      db
        .select()
        .from(featureMatrixRows)
        .where(sql`${featureMatrixRows.isActive} = true`)
        .orderBy(asc(featureMatrixRows.sortOrder)),
    ]);

    const heroRow = sectionRows.find((row) => row.key === FEATURES_HERO.key);
    const ctaRow = sectionRows.find((row) => row.key === "features-cta");

    const modules: FeatureModuleDTO[] = moduleRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      number: row.number,
      icon: row.icon,
      eyebrow: row.eyebrow,
      title: row.title,
      summary: row.summary,
      bullets: row.bullets ?? [],
      specs: row.specs ?? [],
      demo: (row.demo as unknown as FeatureDemoDTO) ?? {
        kind: "markets",
        markets: [],
        contractTypes: [],
        durations: [],
      },
    }));

    const matrix: MatrixRowDTO[] = matrixRows.map((row) => ({
      id: row.id,
      group: row.groupName,
      capability: row.capability,
      operator: toSupportLevel(row.operatorLevel),
      investor: toSupportLevel(row.investorLevel),
      note: row.note,
    }));

    if (modules.length === 0) {
      return { content: { ...FEATURES_FALLBACK, meta: meta("fallback") }, usedFallback: true };
    }

    const content: FeaturesContentDTO = {
      hero: {
        key: heroRow?.key ?? FEATURES_FALLBACK.hero.key,
        eyebrow: heroRow?.eyebrow ?? FEATURES_FALLBACK.hero.eyebrow,
        title: heroRow?.title ?? FEATURES_FALLBACK.hero.title,
        subtitle: heroRow?.subtitle ?? FEATURES_FALLBACK.hero.subtitle,
        payload: (heroRow?.payload as unknown as FeaturesHeroPayloadDTO) ?? FEATURES_FALLBACK.hero.payload,
      },
      modules,
      matrix: matrix.length > 0 ? matrix : FEATURES_FALLBACK.matrix,
      cta: {
        key: ctaRow?.key ?? FEATURES_FALLBACK.cta.key,
        eyebrow: ctaRow?.eyebrow ?? FEATURES_FALLBACK.cta.eyebrow,
        title: ctaRow?.title ?? FEATURES_FALLBACK.cta.title,
        subtitle: ctaRow?.subtitle ?? FEATURES_FALLBACK.cta.subtitle,
        payload: (ctaRow?.payload as unknown as CtaSectionPayloadDTO) ?? FEATURES_FALLBACK.cta.payload,
      },
      meta: meta("database"),
    };

    return { content, usedFallback: false };
  } catch (error) {
    console.warn("[features] falling back to bundled content:", error instanceof Error ? error.message : error);
    return { content: { ...FEATURES_FALLBACK, meta: meta("fallback") }, usedFallback: true };
  }
}
