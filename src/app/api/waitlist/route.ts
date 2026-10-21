import { NextResponse } from "next/server";

import { WaitlistValidationError, joinWaitlist } from "@/server/services/waitlist-service";
import type { ApiEnvelope, WaitlistSignupRequestDTO, WaitlistSignupResponseDTO } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/** POST /api/waitlist — captures landing CTA leads. */
export async function POST(request: Request) {
  let payload: WaitlistSignupRequestDTO;

  try {
    payload = (await request.json()) as WaitlistSignupRequestDTO;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await joinWaitlist(payload);
    const body: ApiEnvelope<WaitlistSignupResponseDTO> = {
      data: result,
      meta: {
        source: "database",
        generatedAt: new Date().toISOString(),
        version: 1,
        requestId: `waitlist_${Date.now().toString(36)}`,
      },
    };
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof WaitlistValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[waitlist] failed:", error);
    return NextResponse.json({ error: "Could not save your email right now." }, { status: 500 });
  }
}
