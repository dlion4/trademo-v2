import { NextResponse } from "next/server";
import * as desk from "@/server/services/dashboard-mock-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  void request;
  return NextResponse.json(desk.getFundsFlow());
}
