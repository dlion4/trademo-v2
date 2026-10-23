export const categories = [
  "trade",
  "deposit",
  "payout",
  "system",
  "auth",
  "comm",
  "audit",
] as const;
export type Category = (typeof categories)[number];
export const severities = ["info", "warning", "critical"] as const;
export type Severity = (typeof severities)[number];
export type SystemKind =
  | "guardian"
  | "reconciliation"
  | "backup_daily"
  | "backup_weekly"
  | "cron"
  | "webhook_failure";
export interface AuditEvent {
  id: string;
  createdAt: string;
  category: Category;
  severity: Severity;
  actorId: string;
  actorName: string;
  actorType: "investor" | "operator" | "bot" | "service";
  investorId: string | null;
  action: string;
  target: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  correlationId: string;
  source: "seeded" | "local_demo";
  metadata: Record<string, string | number | boolean | null>;
  systemKind: SystemKind | null;
}
export interface Filters {
  search: string;
  category: "all" | Category;
  severity: "all" | Severity;
  actor: string;
  from: string;
  to: string;
}
export interface ApiAccess {
  id: string;
  createdAt: string;
  method: "GET" | "POST";
  path: string;
  status: number;
  latencyMs: number;
  actor: string;
  direction: "internal" | "webhook";
  eventId: string;
}
export interface Review {
  eventId: string;
  status: "acknowledged" | "escalated" | "resolved";
  notes: { text: string; time: string; actor: string }[];
}
export interface Session {
  id: string;
  investorId: string;
  actorName: string;
  createdAt: string;
  lastSeen: string;
  ipAddress: string;
  state: "active" | "revoked_demo";
}
export interface Retry {
  id: string;
  eventId: string;
  attempt: number;
  state: "queued_demo" | "failed_demo" | "succeeded_demo";
  createdAt: string;
  reason: string;
}
export interface Archive {
  id: string;
  createdAt: string;
  eventIds: string[];
  from: string;
  to: string;
  reason: string;
  state: "manifest_only";
}
export interface Retention {
  financialYears: number;
  authYears: number;
  systemDays: number;
  auditYears: number;
  commYears: number;
}
export interface LogsBundle {
  mode: "demo";
  asOf: string;
  revision: number;
  events: AuditEvent[];
  investors: { id: string; name: string }[];
  api: ApiAccess[];
  sessions: Session[];
  reviews: Review[];
  retries: Retry[];
  archives: Archive[];
  holds: {
    id: string;
    category: "all" | Category;
    reason: string;
    createdAt: string;
    active: boolean;
  }[];
  retention: Retention;
  views: { id: string; name: string; filters: Filters }[];
  financialReceipts: {
    id: string;
    executedAt: string;
    profit: number;
    stake: number;
    packageCode: string;
  }[];
}
export const logKeys = {
  workspace: ["logs", "workspace"] as const,
  stream: ["logs", "stream"] as const,
};
