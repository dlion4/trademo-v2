import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuditLogsBundle } from "@/server/services/logs-service";
import {
  defaultLogFilters,
  filterLogs,
  filtersSchema,
  logSummary,
  streamPage,
  taxSummary,
} from "@/lib/logs/model";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const data = getAuditLogsBundle(),
    raw = Object.fromEntries(new URL(request.url).searchParams);
  const {
    section,
    page,
    pageSize,
    id,
    year,
    kind,
    direction,
    outcome,
    action,
    ...rest
  } = raw;
  const q = z
    .object({
      section: z
        .enum([
          "workspace",
          "stream",
          "categorized",
          "investor",
          "system",
          "security",
          "api",
          "retention",
          "archives",
          "summary",
          "tax",
          "detail",
        ])
        .default("stream"),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(100),
      id: z.string().max(100).optional(),
      kind: z
        .enum([
          "guardian",
          "reconciliation",
          "backup_daily",
          "backup_weekly",
          "cron",
          "webhook_failure",
        ])
        .optional(),
      direction: z.enum(["internal", "webhook"]).optional(),
      outcome: z.enum(["all", "success", "errors"]).default("all"),
      action: z
        .enum([
          "login_success",
          "login_failed",
          "two_factor_passed",
          "password_reset_requested",
        ])
        .optional(),
      year: z.coerce
        .number()
        .int()
        .min(2000)
        .max(Number(data.asOf.slice(0, 4)))
        .default(2026),
    })
    .safeParse({
      section,
      page,
      pageSize,
      id,
      year,
      kind,
      direction,
      outcome,
      action,
    });
  const f = filtersSchema.safeParse({
    ...defaultLogFilters(data.asOf),
    ...rest,
  });
  const json = (v: unknown, status = 200) =>
    NextResponse.json(v, { status, headers: { "Cache-Control": "no-store" } });
  if (!q.success || !f.success)
    return json(
      {
        error: !q.success
          ? q.error.issues[0].message
          : !f.success
            ? f.error.issues[0].message
            : "Invalid query",
      },
      400,
    );
  const p = q.data;
  if (p.section === "stream" && p.pageSize !== 100)
    return json({ error: "The stream uses fixed 100-event pages." }, 400);
  if (
    f.data.actor !== "all" &&
    !data.events.some((e) => e.actorId === f.data.actor)
  )
    return json({ error: "Unknown actor" }, 400);
  if (p.section === "workspace") return json(data);
  if (p.section === "retention") return json(data.retention);
  if (p.section === "archives") return json(data.archives);
  if (p.section === "tax") return json(taxSummary(data, p.year));
  if (p.section === "detail") {
    const e = data.events.find((e) => e.id === p.id);
    return e ? json(e) : json({ error: "Event not found" }, 404);
  }
  const rows = filterLogs(data, f.data);
  if (p.section === "summary") return json(logSummary(rows));
  if (p.section === "stream") {
    const page = streamPage(data, f.data, p.page - 1);
    return json({
      ...page,
      next: page.next === undefined ? undefined : page.next + 1,
      mode: data.mode,
      asOf: data.asOf,
      page: p.page,
      pageSize: 100,
      totalMatching: rows.length,
    });
  }
  const list =
    p.section === "investor"
      ? rows.filter((e) => e.investorId === p.id)
      : p.section === "system"
        ? rows.filter(
            (e) => e.systemKind && (!p.kind || e.systemKind === p.kind),
          )
        : p.section === "security"
          ? rows.filter(
              (e) =>
                e.category === "auth" && (!p.action || e.action === p.action),
            )
          : p.section === "api"
            ? data.api.filter(
                (a) =>
                  a.createdAt.slice(0, 10) >= f.data.from &&
                  a.createdAt.slice(0, 10) <= f.data.to &&
                  (!p.direction || a.direction === p.direction) &&
                  (p.outcome === "all" ||
                    (p.outcome === "errors" && a.status >= 400) ||
                    (p.outcome === "success" && a.status < 400)) &&
                  `${a.path} ${a.actor}`
                    .toLowerCase()
                    .includes(f.data.search.toLowerCase()),
              )
            : rows;
  if (p.section === "investor" && !data.investors.some((i) => i.id === p.id))
    return json({ error: "Investor not found" }, 404);
  return json({
    mode: data.mode,
    asOf: data.asOf,
    total: list.length,
    items: list.slice((p.page - 1) * p.pageSize, p.page * p.pageSize),
    page: p.page,
    pageSize: p.pageSize,
  });
}
