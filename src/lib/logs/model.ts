import { z } from "zod";
import {
  categories,
  severities,
  type AuditEvent,
  type Filters,
  type LogsBundle,
} from "./types";
export const filtersSchema = z
  .object({
    search: z.string().trim().max(120).default(""),
    category: z.enum(["all", ...categories]).default("all"),
    severity: z.enum(["all", ...severities]).default("all"),
    actor: z.string().max(100).default("all"),
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .strict()
  .refine((f) => f.from <= f.to, "Start date must not exceed end date.");
export const retentionSchema = z.object({
  financialYears: z.number().int().min(7).max(20),
  authYears: z.number().int().min(1).max(10),
  systemDays: z.number().int().min(90).max(3650),
  auditYears: z.number().int().min(7).max(20),
  commYears: z.number().int().min(1).max(20),
});
const reason = z.string().trim().min(10).max(1200);
export const logCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("review"),
    id: z.string(),
    action: z.enum(["acknowledged", "escalated", "resolved", "note"]),
    reason,
  }),
  z.object({ kind: z.literal("retry"), id: z.string(), reason }),
  z.object({
    kind: z.literal("retryOutcome"),
    id: z.string(),
    state: z.enum(["failed_demo", "succeeded_demo"]),
    reason,
  }),
  z.object({ kind: z.literal("session"), id: z.string(), reason }),
  z.object({ kind: z.literal("retention"), policy: retentionSchema, reason }),
  z.object({
    kind: z.literal("hold"),
    category: z.enum(["all", ...categories]),
    reason,
  }),
  z.object({ kind: z.literal("releaseHold"), id: z.string(), reason }),
  z.object({ kind: z.literal("archive"), filters: filtersSchema, reason }),
  z.object({
    kind: z.literal("view"),
    name: z.string().trim().min(3).max(50),
    filters: filtersSchema,
    reason,
  }),
  z.object({
    kind: z.literal("simulate"),
    category: z.enum(categories),
    reason,
  }),
  z.object({ kind: z.literal("job"), id: z.string(), reason }),
  z.object({
    kind: z.literal("report"),
    reportType: z.enum(["csv", "json", "compliance", "tax"]),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    recordCount: z.number().int().min(0).max(10000),
    reason,
  }),
]);
export type LogCommand = z.infer<typeof logCommandSchema>;
export function defaultLogFilters(asOf: string): Filters {
  return {
    search: "",
    category: "all",
    severity: "all",
    actor: "all",
    from: new Date(Date.parse(asOf.slice(0, 10)) - 29 * 86400000)
      .toISOString()
      .slice(0, 10),
    to: asOf.slice(0, 10),
  };
}
export function filterLogs(data: LogsBundle, filters: Filters) {
  const f = filtersSchema.parse(filters);
  return data.events
    .filter(
      (e) =>
        e.createdAt.slice(0, 10) >= f.from &&
        e.createdAt.slice(0, 10) <= f.to &&
        (f.category === "all" || e.category === f.category) &&
        (f.severity === "all" || e.severity === f.severity) &&
        (f.actor === "all" || e.actorId === f.actor) &&
        `${e.id} ${e.action} ${e.actorName} ${e.target} ${e.details} ${e.correlationId}`
          .toLowerCase()
          .includes(f.search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
}
export function streamPage(data: LogsBundle, filters: Filters, page: number) {
  const rows = filterLogs(data, filters).slice(0, 1000);
  return {
    items: rows.slice(page * 100, (page + 1) * 100),
    total: rows.length,
    next: (page + 1) * 100 < rows.length ? page + 1 : undefined,
  };
}
export function exportRows(data: LogsBundle, filters: Filters) {
  filtersSchema.parse(filters);
  if (Date.parse(filters.to) - Date.parse(filters.from) > 29 * 86400000)
    throw Error("Export scope must be at most 30 inclusive UTC days.");
  const rows = filterLogs(data, filters);
  if (rows.length > 10000)
    throw Error(
      "Export exceeds the 10,000-row safety limit. Narrow the filters.",
    );
  return rows;
}
export function logSummary(rows: AuditEvent[]) {
  return {
    total: rows.length,
    critical: rows.filter((e) => e.severity === "critical").length,
    actors: new Set(rows.map((e) => e.actorId)).size,
    byCategory: categories.map((category) => ({
      category,
      count: rows.filter((e) => e.category === category).length,
    })),
  };
}
export function taxSummary(data: LogsBundle, year: number) {
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > Number(data.asOf.slice(0, 4))
  )
    throw Error("Choose an available report year (2000–snapshot year).");
  const rows = data.financialReceipts.filter((r) =>
    r.executedAt.startsWith(String(year)),
  );
  return {
    year,
    count: rows.length,
    gains: rows.filter((r) => r.profit > 0).reduce((n, r) => n + r.profit, 0),
    losses: rows.filter((r) => r.profit < 0).reduce((n, r) => n + r.profit, 0),
    net: rows.reduce((n, r) => n + r.profit, 0),
    fees: null,
    taxDue: null,
    months: Array.from({ length: 12 }, (_, i) => {
      const prefix = `${year}-${String(i + 1).padStart(2, "0")}`,
        list = rows.filter((r) => r.executedAt.startsWith(prefix));
      return {
        month: prefix,
        count: list.length,
        net: list.reduce((n, r) => n + r.profit, 0),
      };
    }),
  };
}
export function eventsCSV(rows: AuditEvent[], redactActors = false) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    [
      "event_id",
      "time_utc",
      "category",
      "severity",
      "actor",
      "action",
      "target",
      "correlation_id",
      "ip_masked",
      "details",
      "source",
    ],
    ...rows.map((e) => [
      e.id,
      e.createdAt,
      e.category,
      e.severity,
      redactActors ? e.actorType : e.actorName,
      e.action,
      e.target,
      e.correlationId,
      e.ipAddress,
      redactActors ? "Omitted in minimized export" : e.details,
      e.source,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
export function assertLogs(s: LogsBundle) {
  if (new Set(s.events.map((e) => e.id)).size !== s.events.length)
    throw Error("Duplicate event ID.");
  for (const e of s.events)
    if (
      !Number.isFinite(Date.parse(e.createdAt)) ||
      !e.correlationId ||
      !e.actorId
    )
      throw Error("Invalid event attribution.");
  for (const r of s.reviews)
    if (!s.events.some((e) => e.id === r.eventId) || !r.notes.length)
      throw Error("Review evidence missing.");
  for (const r of s.retries)
    if (
      !s.events.some(
        (e) => e.id === r.eventId && e.systemKind === "webhook_failure",
      ) ||
      r.attempt < 1 ||
      r.attempt > 3
    )
      throw Error("Invalid retry attribution.");
  for (const a of s.archives)
    if (a.eventIds.some((id) => !s.events.some((e) => e.id === id)))
      throw Error("Archive references unknown events.");
}
export function applyLogCommand(
  current: LogsBundle,
  input: LogCommand,
  now = new Date().toISOString(),
) {
  const c = logCommandSchema.parse(input),
    s = structuredClone(current);
  assertLogs(s);
  let target = "workspace",
    action: string = c.kind;
  const find = (id: string) => {
    const e = s.events.find((e) => e.id === id);
    if (!e) throw Error("Event not found.");
    return e;
  };
  if (c.kind === "review") {
    find(c.id);
    target = c.id;
    let r = s.reviews.find((r) => r.eventId === c.id);
    if (c.action === "resolved" && r?.status !== "escalated")
      throw Error("Escalate this event before resolving it.");
    if (c.action === "acknowledged" && r)
      throw Error("This event has already entered review.");
    if (c.action === "escalated" && r?.status === "resolved")
      throw Error("Resolved reviews cannot be silently reopened.");
    if (!r) {
      r = {
        eventId: c.id,
        status: c.action === "note" ? "acknowledged" : c.action,
        notes: [],
      };
      s.reviews.push(r);
    } else if (c.action !== "note") r.status = c.action;
    r.notes.push({ text: c.reason, time: now, actor: "Local operator" });
    action = `review_${c.action}`;
  }
  if (c.kind === "retry") {
    const e = find(c.id);
    if (e.systemKind !== "webhook_failure")
      throw Error("Only failed webhook events can enter this workflow.");
    const list = s.retries.filter((r) => r.eventId === e.id);
    if (
      list.some((r) => r.state === "queued_demo") ||
      list.some((r) => r.state === "succeeded_demo")
    )
      throw Error("An active or successful demo retry already exists.");
    if (list.length >= 3)
      throw Error("Retry limit reached; escalate for investigation.");
    target = e.id;
    s.retries.push({
      id: `retry_local_${s.revision + 1}`,
      eventId: e.id,
      attempt: list.length + 1,
      state: "queued_demo",
      createdAt: now,
      reason: c.reason,
    });
  }
  if (c.kind === "retryOutcome") {
    const r = s.retries.find((r) => r.id === c.id);
    if (!r || r.state !== "queued_demo")
      throw Error("Choose a queued demo retry.");
    r.state = c.state;
    target = r.eventId;
  }
  if (c.kind === "session") {
    const session = s.sessions.find((x) => x.id === c.id);
    if (!session || session.state !== "active")
      throw Error("Session is already revoked or missing.");
    session.state = "revoked_demo";
    target = session.id;
  }
  if (c.kind === "retention") s.retention = c.policy;
  if (c.kind === "hold") {
    if (s.holds.some((h) => h.active && h.category === c.category))
      throw Error("An active hold already covers this category.");
    target = `hold_local_${s.revision + 1}`;
    s.holds.push({
      id: target,
      category: c.category,
      reason: c.reason,
      createdAt: now,
      active: true,
    });
  }
  if (c.kind === "releaseHold") {
    const h = s.holds.find((h) => h.id === c.id && h.active);
    if (!h) throw Error("Active hold not found.");
    h.active = false;
    target = h.id;
  }
  if (c.kind === "archive") {
    const rows = exportRows(s, c.filters);
    if (!rows.length)
      throw Error("No events match the proposed archive scope.");
    target = `archive_local_${s.revision + 1}`;
    s.archives.unshift({
      id: target,
      createdAt: now,
      eventIds: rows.map((e) => e.id),
      from: c.filters.from,
      to: c.filters.to,
      reason: c.reason,
      state: "manifest_only",
    });
  }
  if (c.kind === "view") {
    if (s.views.some((v) => v.name.toLowerCase() === c.name.toLowerCase()))
      throw Error("Saved view name already exists.");
    target = `view_local_${s.revision + 1}`;
    s.views.push({ id: target, name: c.name, filters: c.filters });
  }
  if (c.kind === "job") {
    const e = find(c.id);
    if (e.systemKind !== "cron")
      throw Error("Choose a recorded cron execution.");
    if (s.events.some((e) => e.action === "job_dry_run" && e.target === c.id))
      throw Error("A dry-run request already exists for this execution.");
    action = "job_dry_run";
    target = e.id;
  }
  if (c.kind === "simulate") {
    action = "synthetic_observation";
    target = "demo_feed";
  }
  if (c.kind === "report") {
    action = "report_artifact_prepared";
    target = `report_local_${s.revision + 1}`;
  }
  const category = c.kind === "simulate" ? c.category : "audit";
  const related =
    s.events.find((e) => e.id === target) ??
    (c.kind === "session"
      ? s.events.find((e) => e.category === "auth" && e.target === target)
      : undefined);
  s.events.unshift({
    id: `log_local_${s.revision + 1}`,
    createdAt: now,
    category,
    severity: "info",
    actorId: "operator_local",
    actorName: "Local operator",
    actorType: "operator",
    investorId: related?.investorId ?? null,
    action,
    target,
    details: c.reason,
    ipAddress: "Local demo · no network evidence",
    userAgent: "Browser-session simulator",
    correlationId: related?.correlationId ?? `corr_local_${s.revision + 1}`,
    source: "local_demo",
    metadata: {
      mode: "local_demo",
      externalRequest: false,
      relatedEventId: related?.id ?? null,
      ...(c.kind === "report"
        ? {
            digest: c.digest,
            recordCount: c.recordCount,
            reportType: c.reportType,
            hashScope: "canonical JSON report payload",
          }
        : {}),
    },
    systemKind: null,
  });
  s.revision++;
  assertLogs(s);
  return s;
}
