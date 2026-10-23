import { NextResponse } from "next/server";
import { getFundsBundle } from "@/server/services/funds-service";
import { getFundsOverview } from "@/lib/funds/model";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const section = new URL(request.url).searchParams.get("section");
  const s = getFundsBundle();
  switch (section) {
    case null:
      return NextResponse.json(s);
    case "overview":
      return NextResponse.json(getFundsOverview(s));
    case "deposits":
      return NextResponse.json({ items: s.deposits, total: s.deposits.length });
    case "allocation":
      return NextResponse.json(s.allocations);
    case "flow-timeline":
      return NextResponse.json({
        items: s.movements,
        total: s.movements.length,
      });
    case "reconciliation":
      return NextResponse.json(s.runs);
    case "provider-status":
      return NextResponse.json(s.providers);
    case "reserve":
      return NextResponse.json({
        ...s.reserve,
        target: getFundsOverview(s).reserveTarget,
      });
    default:
      return NextResponse.json(
        { error: "Unknown funds section." },
        { status: 400 },
      );
  }
}
