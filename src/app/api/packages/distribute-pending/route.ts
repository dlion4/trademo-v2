import { NextResponse } from "next/server";
import * as desk from "@/server/services/dashboard-mock-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(desk.distributePendingProfits(body.packageCodes));
}
