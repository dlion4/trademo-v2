import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST /api/waitlist — explicitly unavailable while backend integration is disabled. */
export function POST() {
  return NextResponse.json(
    { error: "Waitlist signups are unavailable while backend integration is disabled." },
    { status: 503 },
  );
}
