import { NextResponse } from "next/server";
import { z } from "zod";
import * as desk from "@/server/services/dashboard-mock-service";
import { getDepositLogsBundle } from "@/server/services/deposits-service";
import {
  filterDeposits,
  filterSchema,
  summary,
  methodBreakdown,
  timeline,
  reviewable,
} from "@/lib/deposits/model";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const s = getDepositLogsBundle(),
    raw = Object.fromEntries(new URL(request.url).searchParams);
  const { section, id, page, pageSize, sort, ...filters } = raw;
  const query = z
    .object({
      section: z
        .enum([
          "workspace",
          "ledger",
          "summary",
          "queue",
          "methods",
          "timeline",
          "rules",
          "detail",
        ])
        .optional(),
      id: z.string().optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(50),
      sort: z
        .enum(["date_desc", "date_asc", "amount_desc", "amount_asc"])
        .default("date_desc"),
    })
    .safeParse({ section, id, page, pageSize, sort });
  const f = filterSchema.safeParse({
    from: "2026-09-24",
    to: s.asOf.slice(0, 10),
    ...filters,
  });
  const json = (v: unknown, status = 200) =>
    NextResponse.json(v, { status, headers: { "Cache-Control": "no-store" } });
  if (!query.success || !f.success)
    return json(
      {
        error: !query.success
          ? query.error.issues[0].message
          : !f.success
            ? f.error.issues[0].message
            : "Invalid query",
      },
      400,
    );
  const q = query.data;
  if (
    (f.data.pool !== "all" && !s.pools.some((p) => p.code === f.data.pool)) ||
    (f.data.investor !== "all" &&
      !s.investors.some((i) => i.id === f.data.investor))
  )
    return json({ error: "Unknown package or investor" }, 400);
  // Preserve the inherited command-center contract for unscoped requests.
  if (!q.section) return json(desk.getFundsFlow().pendingDeposits);
  if (q.section === "workspace") return json(s);
  let rows = filterDeposits(s, f.data);
  rows = rows.sort((a, b) =>
    q.sort.startsWith("amount")
      ? (a.amount - b.amount) * (q.sort.endsWith("desc") ? -1 : 1)
      : a.submittedAt.localeCompare(b.submittedAt) *
        (q.sort.endsWith("desc") ? -1 : 1),
  );
  if (q.section === "summary") return json(summary(rows, s.asOf.slice(0, 10)));
  if (q.section === "methods") return json(methodBreakdown(rows));
  if (q.section === "timeline") return json(timeline(rows, f.data.to));
  if (q.section === "rules") return json(s.rules);
  if (q.section === "detail")
    return s.deposits.some((d) => d.id === q.id)
      ? json(s.deposits.find((d) => d.id === q.id))
      : json({ error: "Deposit not found" }, 404);
  if (q.section === "queue") rows = rows.filter(reviewable);
  return json({
    mode: s.mode,
    asOf: s.asOf,
    items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    total: rows.length,
    page: q.page,
    pageSize: q.pageSize,
  });
}

// Inherited legacy command-center mutation; D-11 never calls this endpoint.
export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(desk.reviewDeposit(body.id, body.action));
}
