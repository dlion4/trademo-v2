import { NextResponse } from "next/server";
import { z } from "zod";

import {
  filterTimeline,
  type InvestmentsWorkspace,
} from "@/lib/investor/investments";
import { getInvestmentsWorkspace } from "@/server/services/investor-investments-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "summary",
  "active",
  "completed",
  "booked",
  "payouts",
  "timeline",
  "documents",
  "notes",
  "allocations",
  "milestones",
  "kyc",
  "payoutPolicy",
  "profile",
] as const;

const schema = z
  .object({
    section: z.enum(sections).default("workspace"),
    kind: z
      .enum([
        "trade",
        "payout",
        "pool",
        "booking",
        "interest",
        "kyc",
        "account",
        "milestone",
      ])
      .optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    page: z.coerce.number().int().min(1).max(50).optional(),
    pageSize: z.coerce.number().int().min(1).max(25).optional(),
  })
  .strict();

/**
 * Read-only projection for the I-6 holdings page. There is deliberately no
 * write handler: requesting or cancelling a payout, cancelling a registered
 * interest and saving preferences are local previews, so mutations are rejected
 * with 405. The eventual writes are `POST /api/wallet/payout`,
 * `DELETE /api/pools/:id/interest` and `POST /api/investor/statements`.
 */
export function GET(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });

  const query = new URL(request.url).searchParams;
  const keys = Array.from(query.keys());
  if (new Set(keys).size !== keys.length)
    return json({ error: "Duplicate query parameters are not accepted" }, 400);

  const parsed = schema.safeParse(Object.fromEntries(query));
  if (!parsed.success)
    return json({ error: parsed.error.issues[0].message }, 400);

  const workspace: InvestmentsWorkspace = getInvestmentsWorkspace();
  const { section, kind, limit, page, pageSize } = parsed.data;

  if (section === "workspace") return json(workspace);

  if (section === "timeline") {
    const events = filterTimeline(
      workspace.timeline,
      { kinds: kind ? [kind] : [], query: "" },
    );
    return json(events.slice(0, limit ?? 50));
  }

  if (section === "completed") {
    const size = pageSize ?? 2;
    const current = page ?? 1;
    const start = (current - 1) * size;
    return json({
      page: current,
      pageSize: size,
      total: workspace.completed.length,
      hasMore: start + size < workspace.completed.length,
      rows: workspace.completed.slice(start, start + size),
    });
  }

  if (section === "payouts")
    return json({
      pending: workspace.payouts.filter(
        (row) => row.status === "processing" || row.status === "scheduled",
      ),
      settled: workspace.payouts.filter((row) => row.status === "paid"),
      cancelled: workspace.payouts.filter((row) => row.status === "cancelled"),
    });

  return json(workspace[section]);
}
