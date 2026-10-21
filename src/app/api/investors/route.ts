import { NextResponse } from "next/server";
import * as desk from "@/server/services/dashboard-mock-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(desk.getInvestorWatch());
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(desk.reviewInvestorKyc(body.investorId, body.decision));
}
