export const channels = ["in_app", "email", "telegram", "sms"] as const;
export type Channel = (typeof channels)[number];
export type Audience = {
  type: "all" | "individual" | "packages";
  ids: string[];
  packages: string[];
};
export interface CommsContact {
  id: string;
  name: string;
  email: string;
  status: string;
  packages: string[];
  primaryPackage: string;
  packageStartDate: string;
  packageStartDates: Record<string, string>;
  investment: number;
  earnings: number;
  wallet: number;
  consent: Record<Channel, boolean>;
}
export interface MessageContent {
  subject: string;
  body: string;
  audience: Audience;
  channels: Channel[];
  templateId: string | null;
  saveTemplate: boolean;
  templateName: string;
}
export interface CommsTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  version: number;
  updatedAt: string;
  category: string;
}
export interface ThreadPost {
  id: string;
  time: string;
  direction: "incoming" | "outgoing";
  body: string;
  state: "received" | "queued_demo";
}
export interface CommsThread {
  id: string;
  contactId: string;
  subject: string;
  pool: string;
  status: "unread" | "read" | "replied" | "archived";
  updatedAt: string;
  posts: ThreadPost[];
}
export interface Campaign extends MessageContent {
  id: string;
  type: "announcement" | "message" | "report" | "trade_result" | "guardian";
  status: "draft" | "scheduled" | "queued" | "simulated" | "cancelled";
  createdAt: string;
  scheduledFor: string | null;
  contactIds: string[];
  parentId: string | null;
  templateVersion?: number | null;
}
export interface Delivery {
  id: string;
  campaignId: string;
  contactId: string;
  channel: Channel;
  status: "queued_demo" | "delivered" | "failed";
  attempts: number;
  createdAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  failure: string | null;
}
export interface CommsTest {
  id: string;
  templateId: string;
  contactId: string;
  target: string;
  subject: string;
  body: string;
  time: string;
  state: "rendered_only";
}
export interface CommsAudit {
  id: string;
  time: string;
  action: string;
  reference: string;
  detail: string;
  revision: number;
}
export interface CommsBundle {
  mode: "demo";
  asOf: string;
  revision: number;
  contacts: CommsContact[];
  pools: { code: string; name: string }[];
  templates: CommsTemplate[];
  threads: CommsThread[];
  campaigns: Campaign[];
  deliveries: Delivery[];
  tests: CommsTest[];
  channelConfig: Record<Channel, { enabled: boolean; label: string }>;
  audit: CommsAudit[];
}
export interface AudiencePlan {
  candidates: string[];
  rows: { contactId: string; channel: Channel }[];
  excluded: { contactId: string; channel: Channel; reason: string }[];
}
export const commsQueryKeys = {
  workspace: ["comms", "workspace"] as const,
  inbox: (page: number, filters: Record<string, string>) =>
    ["comms", "inbox", { page, filters }] as const,
  announcements: (page: number) =>
    ["comms", "announcements", { page }] as const,
  templates: ["comms", "templates"] as const,
  log: (page: number, filters: Record<string, string>) =>
    ["comms", "log", { page, filters }] as const,
  analytics: (period: number) => ["comms", "analytics", { period }] as const,
  thread: (investorId: string) => ["comms", "thread", investorId] as const,
};
