import { FEATURES_FALLBACK } from "@/lib/content/features-content";
import type { ContentMetaDTO, FeaturesContentDTO } from "@/lib/api/types";

const CONTENT_VERSION = 1;

export async function getFeaturesContent(): Promise<{ content: FeaturesContentDTO; usedFallback: false }> {
  const meta: ContentMetaDTO = {
    source: "mock",
    generatedAt: new Date().toISOString(),
    version: CONTENT_VERSION,
  };

  return { content: { ...FEATURES_FALLBACK, meta }, usedFallback: false };
}
