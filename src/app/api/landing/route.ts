import { NextResponse } from "next/server";

import { getLandingContent } from "@/server/services/landing-service";
import type { ApiEnvelope, LandingContentDTO } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/landing
 * Structured payload for page H-1. Replaces the direct service call when the
 * frontend is switched to a remote backend.
 */
export async function GET() {
  const { content, usedFallback } = await getLandingContent();

  const body: ApiEnvelope<LandingContentDTO> = {
    data: content,
    meta: {
      ...content.meta,
      source: usedFallback ? "fallback" : "database",
      requestId: `landing_${Date.now().toString(36)}`,
    },
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
