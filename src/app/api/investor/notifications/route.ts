import { NextResponse } from "next/server";
import { z } from "zod";

import {
  categoryCounts,
  filterInbox,
  groupByDay,
  inboxSummary,
  paginate,
  paymentTotals,
  securityPosture,
  tradeStats,
  type NotificationFilters,
  type NotificationWorkspace,
} from "@/lib/investor/notifications";
import { getNotificationsWorkspace } from "@/server/services/investor-notifications-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "unread",
  "inbox",
  "trade-activity",
  "pool-updates",
  "payment-alerts",
  "system-security",
  "sessions",
  "preferences",
  "rules",
  "deliveries",
  "summary",
  "exports",
  "audit",
  "profile",
] as const;

const schema = z
  .object({
    section: z.enum(sections).default("workspace"),
    page: z.coerce.number().int().min(1).max(50).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    category: z.enum(["all", "trade", "pool", "payment", "security"]).optional(),
    unread: z.enum(["true", "false"]).optional(),
    pinned: z.enum(["true", "false"]).optional(),
    range: z.enum(["today", "7d", "30d", "all"]).optional(),
    sort: z.enum(["newest", "oldest", "unread"]).optional(),
    q: z.string().max(60).optional(),
  })
  .strict();

/**
 * Read-only projection for the I-9 notifications desk.
 *
 * The inbox, the four ledgers and every derived figure live in
 * `src/lib/investor/notifications.ts`, so this route is a thin adapter: a
 * backend can serve the same shapes from persisted rows while the page keeps
 * its optimistic preview.
 *
 * There is deliberately no write handler. Marking read, pinning, snoozing and
 * saving preferences are validated by the shared command union and applied as
 * an audited local preview, so mutations answer 405. The eventual writes are
 * `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`,
 * `POST /api/notifications/:id/snooze`,
 * `PATCH /api/settings/notifications` and
 * `DELETE /api/notifications/:id`.
 */
export function GET(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });

  const url = new URL(request.url);
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key))
      return json({ error: `Duplicate query parameter: ${key}` }, 400);
    seen.add(key);
  }

  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return json({ error: "Invalid query", issues: parsed.error.issues }, 400);

  const query = parsed.data;
  const workspace: NotificationWorkspace = getNotificationsWorkspace();
  const summary = inboxSummary(workspace);

  switch (query.section) {
    case "unread":
      return json({
        count: summary.unread,
        byCategory: {
          trade: summary.counts.trade.unread,
          pool: summary.counts.pool.unread,
          payment: summary.counts.payment.unread,
          security: summary.counts.security.unread,
        },
        generatedAt: workspace.asOf,
        rows: workspace.notifications
          .filter((row) => !row.read)
          .slice(0, 5),
      });
    case "inbox": {
      const filters: NotificationFilters = {
        category: query.category ?? workspace.filters.category,
        unreadOnly: query.unread === "true",
        pinnedOnly: query.pinned === "true",
        range: query.range ?? workspace.filters.range,
        query: query.q ?? "",
        sort: query.sort ?? workspace.filters.sort,
      };
      const rows = filterInbox(workspace.notifications, filters, workspace.asOf);
      const page = paginate(rows, query.page ?? 1, query.pageSize ?? 8);
      return json({
        filters,
        counts: categoryCounts(rows),
        groups: groupByDay(page.rows, workspace.asOf),
        ...page,
      });
    }
    case "trade-activity": {
      const page = paginate(
        workspace.tradeActivity,
        query.page ?? 1,
        query.pageSize ?? 8,
      );
      return json({ stats: tradeStats(workspace.tradeActivity), ...page });
    }
    case "pool-updates":
      return json(
        paginate(workspace.poolUpdates, query.page ?? 1, query.pageSize ?? 8),
      );
    case "payment-alerts":
      return json({
        totals: paymentTotals(workspace.paymentAlerts),
        ...paginate(workspace.paymentAlerts, query.page ?? 1, query.pageSize ?? 8),
      });
    case "system-security":
      return json({
        posture: securityPosture(
          workspace.securityEvents,
          workspace.sessions,
          workspace.profile,
        ),
        ...paginate(workspace.securityEvents, query.page ?? 1, query.pageSize ?? 8),
      });
    case "sessions":
      return json(workspace.sessions);
    case "preferences":
      return json(workspace.preferences);
    case "rules":
      return json(workspace.rules);
    case "deliveries":
      return json(workspace.deliveries);
    case "summary":
      return json(summary);
    case "exports":
      return json(workspace.exports);
    case "audit":
      return json(workspace.audit);
    case "profile":
      return json(workspace.profile);
    default:
      return json(workspace);
  }
}

const methodNotAllowed = () =>
  NextResponse.json(
    {
      error: "Read-only projection",
      detail:
        "Marking read, pinning, snoozing and preferences are an audited local preview on this demo build.",
    },
    { status: 405, headers: { "Cache-Control": "no-store", Allow: "GET" } },
  );

export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
