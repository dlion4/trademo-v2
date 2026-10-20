import { NextResponse } from "next/server";

import { LANDING_FALLBACK } from "@/lib/content/landing-content";
import type { ApiEnvelope, LandingContentDTO } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/landing
 * Structured payload for page H-1. Replaces the direct service call when the
 * frontend is switched to a remote backend.
 */
export async function GET() {
  const body: ApiEnvelope<LandingContentDTO> = {
    data: LANDING_FALLBACK,
    meta: {
      ...LANDING_FALLBACK.meta,
      requestId: `landing_${Date.now().toString(36)}`,
    },
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
