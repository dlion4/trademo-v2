import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayoutBundle } from "@/server/services/payouts-service";
import { getPayoutSummary, payoutHistory } from "@/lib/payouts/model";
export const dynamic = "force-dynamic";
const querySchema = z.object({
  section: z.enum(["summary", "history", "settings"]).optional(),
  status: z
    .enum([
      "pending",
      "information_requested",
      "approved",
      "processing",
      "completed",
      "failed",
      "rejected",
      "refunded",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(8),
  days: z.coerce
    .number()
    .refine(
      (n) => [7, 14, 30].includes(n),
      "History window must be 7, 14 or 30 days.",
    )
    .default(30),
});
export function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const q = parsed.data,
    s = getPayoutBundle();
  if (q.section === "summary") return NextResponse.json(getPayoutSummary(s));
  if (q.section === "history")
    return NextResponse.json(payoutHistory(s, q.days));
  if (q.section === "settings") return NextResponse.json(s.settings);
  if (q.status) {
    const rows = s.requests.filter((r) => r.status === q.status);
    return NextResponse.json({
      mode: s.mode,
      asOf: s.asOf,
      revision: s.revision,
      items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
      page: q.page,
      pageSize: q.pageSize,
      total: rows.length,
    });
  }
  return NextResponse.json(s);
}
