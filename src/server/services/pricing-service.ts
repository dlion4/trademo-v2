import { PRICING_FALLBACK } from "@/lib/content/pricing-content";
import type { ContentMetaDTO, PricingContentDTO } from "@/lib/api/types";

const CONTENT_VERSION = 1;

export async function getPricingContent(): Promise<{ content: PricingContentDTO; usedFallback: false }> {
  const meta: ContentMetaDTO = {
    source: "mock",
    generatedAt: new Date().toISOString(),
    version: CONTENT_VERSION,
  };

  return { content: { ...PRICING_FALLBACK, meta }, usedFallback: false };
}
