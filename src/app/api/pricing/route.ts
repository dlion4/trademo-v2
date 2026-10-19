import { NextResponse } from "next/server";

import { getPricingContent } from "@/server/services/pricing-service";
import type { ApiEnvelope, PricingContentDTO } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/pricing
 * Structured payload for Page H-3 (Pricing & Investment Tiers).
 */
export async function GET() {
  const { content, usedFallback } = await getPricingContent();

  const body: ApiEnvelope<PricingContentDTO> = {
    data: content,
    meta: {
      ...content.meta,
      source: usedFallback ? "fallback" : "database",
      requestId: `pricing_${Date.now().toString(36)}`,
    },
  };

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
