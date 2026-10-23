import { NextResponse } from "next/server";
import { getInvestorManagerBundle } from "@/server/services/investor-manager-service";
export const dynamic="force-dynamic";
export function GET(){return NextResponse.json(getInvestorManagerBundle());}
