import { NextResponse } from "next/server";

import { LANDING_FALLBACK } from "@/lib/content/landing-content";
import type { ApiEnvelope, TickerFeedDTO } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/market/ticker
 * Live instrument quotes for the hero marquee. In production this becomes a
 * thin proxy over the institutional market websocket subscription,
 * keeping the same response shape.
 */
export async function GET() {
  const { ticker: quotes, meta } = LANDING_FALLBACK;

  const body: ApiEnvelope<TickerFeedDTO> = {
    data: { quotes, meta },
    meta: { ...meta, requestId: `ticker_${Date.now().toString(36)}` },
  };

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
