import { NextResponse } from "next/server";
import { analyticsFilterSchema } from "@/lib/analytics/model";
import { initialAnalyticsFilters } from "@/lib/analytics/types";
import { getAnalyticsBundle } from "@/server/services/analytics-service";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = analyticsFilterSchema.safeParse({
    from: params.get("from") ?? initialAnalyticsFilters.from,
    to: params.get("to") ?? initialAnalyticsFilters.to,
    pool: params.get("pool") ?? "all",
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  try {
    return NextResponse.json(getAnalyticsBundle(parsed.data));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to load analytics." },
      { status: 400 },
    );
  }
}
