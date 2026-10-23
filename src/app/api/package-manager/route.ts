import { NextResponse } from "next/server";
import { getPackageManagerBundle } from "@/server/services/package-manager-service";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(getPackageManagerBundle()); }
