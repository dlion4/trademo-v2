import { NextResponse } from "next/server";

import { FEATURES_FALLBACK } from "@/lib/content/features-content";
import type { ApiEnvelope, FeaturesContentDTO } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/features
 * Structured payload for page H-2. Mirrors the landing endpoint contract so
 * the frontend swap to a remote backend is transport-only.
 */
export async function GET() {
  const body: ApiEnvelope<FeaturesContentDTO> = {
    data: FEATURES_FALLBACK,
    meta: {
      ...FEATURES_FALLBACK.meta,
      requestId: `features_${Date.now().toString(36)}`,
    },
  };

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
