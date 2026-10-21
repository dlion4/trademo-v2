import { NextResponse } from "next/server";

import * as scheduler from "@/server/services/schedules-mock-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(scheduler.rebalanceScheduleAllocations(body));
}
