import { NextResponse } from "next/server";
import { z } from "zod";
import { getCommsBundle } from "@/server/services/comms-service";
import { analytics } from "@/lib/comms/model";
import { channels } from "@/lib/comms/types";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    section: z
      .enum([
        "inbox",
        "announcements",
        "templates",
        "log",
        "analytics",
        "thread",
      ])
      .optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
    days: z.coerce
      .number()
      .refine((n) => [7, 30, 90].includes(n))
      .default(30),
    id: z.string().max(100).optional(),
    search: z.string().trim().max(120).optional(),
    status: z
      .enum([
        "unread",
        "read",
        "replied",
        "archived",
        "draft",
        "scheduled",
        "queued",
        "simulated",
        "cancelled",
      ])
      .optional(),
    type: z
      .enum(["announcement", "message", "report", "trade_result", "guardian"])
      .optional(),
    channel: z.enum(channels).optional(),
    package: z.string().max(30).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict()
  .refine(
    (q) => !q.from || !q.to || q.from <= q.to,
    "From date must not exceed to date.",
  );
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export function GET(request: Request) {
  const p = schema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!p.success) return json({ error: p.error.issues[0].message }, 400);
  const q = p.data,
    s = getCommsBundle();
  if (q.package && !s.pools.some((p) => p.code === q.package))
    return json({ error: "Unknown package filter." }, 400);
  if (!q.section) return json(s);
  if (q.section === "analytics")
    return json({
      mode: s.mode,
      asOf: s.asOf,
      days: q.days,
      ...analytics(s, q.days),
    });
  if (q.section === "templates")
    return json(
      s.templates.filter(
        (t) =>
          !q.search ||
          `${t.name} ${t.category}`
            .toLowerCase()
            .includes(q.search.toLowerCase()),
      ),
    );
  if (q.section === "thread") {
    const thread = s.threads.find((t) => t.id === q.id || t.contactId === q.id);
    return thread ? json(thread) : json({ error: "Thread not found." }, 404);
  }
  const search = q.search?.toLowerCase();
  const within = (date: string) =>
    (!q.from || date.slice(0, 10) >= q.from) &&
    (!q.to || date.slice(0, 10) <= q.to);
  const rows =
    q.section === "inbox"
      ? s.threads.filter(
          (t) =>
            (!q.status || t.status === q.status) &&
            (!q.package || t.pool === q.package) &&
            within(t.updatedAt) &&
            (!search ||
              `${t.subject} ${t.id} ${s.contacts.find((c) => c.id === t.contactId)?.name}`
                .toLowerCase()
                .includes(search)),
        )
      : s.campaigns.filter(
          (c) =>
            (q.section !== "announcements" || c.type === "announcement") &&
            (!q.status || c.status === q.status) &&
            (!q.type || c.type === q.type) &&
            (!q.channel || c.channels.includes(q.channel)) &&
            (!q.package ||
              c.contactIds.some((id) =>
                s.contacts
                  .find((p) => p.id === id)
                  ?.packages.includes(q.package!),
              )) &&
            within(c.createdAt) &&
            (!search || `${c.subject} ${c.id}`.toLowerCase().includes(search)),
        );
  return json({
    mode: s.mode,
    asOf: s.asOf,
    revision: s.revision,
    items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    total: rows.length,
    page: q.page,
    pageSize: q.pageSize,
  });
}
