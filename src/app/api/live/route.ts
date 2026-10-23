import { NextResponse } from "next/server";
import { getLiveBundle } from "@/server/services/live-mock-service";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(getLiveBundle()); }
