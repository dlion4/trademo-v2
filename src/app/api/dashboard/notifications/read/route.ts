import { NextResponse } from "next/server";
import * as desk from "@/server/services/dashboard-mock-service";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(desk.markAllNotificationsRead());
}
