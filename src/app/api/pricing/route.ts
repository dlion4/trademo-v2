import { NextResponse } from "next/server";

import { PRICING_FALLBACK } from "@/lib/content/pricing-content";
import type { ApiEnvelope, PricingContentDTO } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/pricing
 * Structured payload for Page H-3 (Pricing & Investment Tiers).
 */
export async function GET() {
  const body: ApiEnvelope<PricingContentDTO> = {
    data: PRICING_FALLBACK,
    meta: {
      ...PRICING_FALLBACK.meta,
      requestId: `pricing_${Date.now().toString(36)}`,
    },
  };

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
