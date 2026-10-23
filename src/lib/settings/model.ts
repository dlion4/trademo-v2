import { z } from "zod";
export const settingsTabs = [
  "profile",
  "connections",
  "platform",
  "security",
  "notifications",
  "integrations",
  "billing",
] as const;
export type SettingsTab = (typeof settingsTabs)[number];
export const timezones = [
  "UTC",
  "Africa/Nairobi",
  "Africa/Lagos",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;
export const profileSchema = z.object({
  fullName: z.string().trim().min(3).max(80),
  timezone: z.enum(timezones),
  phone: z
    .string()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      "Use an international phone number, including country code",
    ),
  bio: z.string().max(500),
});
export const platformSchema = z.object({
  operatorSplit: z.number().int().min(0).max(40),
  minInvestment: z.number().min(100).max(50000).multipleOf(0.01),
  autoVerify: z.boolean(),
  autoApprove: z.number().min(0).max(1000).multipleOf(0.01),
  batchTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  earningsMinutes: z.union([
    z.literal(1),
    z.literal(3),
    z.literal(5),
    z.literal(10),
  ]),
  maxInvestors: z.number().int().min(1).max(500),
  guardianLosses: z.number().int().min(3).max(15),
  drawdown: z.number().min(1).max(15),
});
export function normalizeIp(ip: string) {
  const v = ip.trim();
  if (z.ipv4().safeParse(v).success) return v;
  if (z.ipv6().safeParse(v).success) {
    try {
      return new URL(`http://[${v}]/`).hostname.slice(1, -1);
    } catch {}
  }
  throw Error(
    "Enter an individual valid IPv4 or IPv6 address (not a CIDR range)",
  );
}
export const securitySchema = z.object({
  timeout: z.enum(["15", "30", "60", "240", "never"]),
  whitelistEnabled: z.boolean(),
  ips: z
    .array(
      z.object({
        address: z.string(),
        label: z.string().trim().min(2).max(40),
      }),
    )
    .max(20),
});
export const channelNames = ["email", "telegram", "push", "webhook"] as const;
export type Channel = (typeof channelNames)[number];
export const events = [
  { id: "guardian", label: "Guardian trigger" },
  { id: "deposit", label: "Large deposit ≥ $5,000" },
  { id: "payout", label: "Payout request" },
  { id: "drawdown", label: "Drawdown > 5%" },
  { id: "investor", label: "New investor" },
  { id: "kyc", label: "KYC submitted" },
  { id: "streak", label: "Trade streak · 10+ wins" },
  { id: "completed", label: "Package completed" },
  { id: "webhook_failure", label: "Webhook failure" },
  { id: "reconciliation", label: "Reconciliation discrepancy" },
] as const;
const routesSchema = z.object({
  email: z.boolean(),
  telegram: z.boolean(),
  push: z.boolean(),
  webhook: z.boolean(),
});
export const notificationSchema = z.object({
  enabled: routesSchema,
  routes: z.object({
    guardian: routesSchema,
    deposit: routesSchema,
    payout: routesSchema,
    drawdown: routesSchema,
    investor: routesSchema,
    kyc: routesSchema,
    streak: routesSchema,
    completed: routesSchema,
    webhook_failure: routesSchema,
    reconciliation: routesSchema,
  }),
  telegramHandle: z.string().max(40),
  webhookUrl: z.string().max(500),
});
export const publicHttps = (value: string) => {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      u.hostname.includes(".") &&
      !u.hostname.endsWith(".local") &&
      !u.hostname.endsWith(".localhost") &&
      !u.hostname.endsWith(".internal") &&
      !u.hostname.includes(":") &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)
    );
  } catch {
    return false;
  }
};
export interface SettingsWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: z.infer<typeof profileSchema> & {
    id: string;
    email: string;
    username: string;
    role: "operator" | "both";
    avatar: string | null;
    emailVerified: boolean;
  };
  connections: {
    id: string;
    loginId: string;
    accountType: "Real" | "Demo";
    currency: "USD";
    balance: number | null;
    status: "source_connected" | "disconnected" | "oauth_prepared";
    primary: boolean;
    permissions: string[];
    lastActivity: string | null;
  }[];
  platform: z.infer<typeof platformSchema>;
  security: z.infer<typeof securitySchema> & {
    twoFactor: "source_enabled" | "disable_requested" | "reconfigure_requested";
    passwordPreviewAt: string | null;
    backupPreviewAt: string | null;
    fixtureIp: string;
    sessions: {
      id: string;
      ip: string;
      device: string;
      startedAt: string;
      current: boolean;
      state: "source_active" | "revoke_requested";
    }[];
  };
  notifications: z.infer<typeof notificationSchema>;
  apiKeys: {
    id: string;
    name: string;
    prefix: string;
    scopes: ("read" | "trade")[];
    createdAt: string;
    lastUsed: string | null;
    state: "source_active" | "demo_generated" | "revoke_requested";
  }[];
  integrations: {
    id: string;
    name: string;
    type: "webhook" | "workflow";
    endpoint: string;
    reference: string;
    status: "source_configured" | "not_configured" | "draft_prepared";
  }[];
  billing: {
    plan: "Pro" | "Team";
    price: number;
    renewsAt: string;
    payment: { brand: string; last4: string };
    request: "none" | "upgrade_team" | "cancel_at_renewal";
    paymentDraft: { brand: string; last4: string } | null;
    usage: { label: string; used: number; limit: number | null }[];
    invoices: {
      id: string;
      date: string;
      amount: number;
      status: "paid";
      description: string;
    }[];
  };
  checks: {
    id: string;
    time: string;
    target: string;
    kind: "connection" | "channel" | "integration";
    result: "configuration_only";
  }[];
  audit: { time: string; action: string; detail: string }[];
}
export type ProfileInput = z.infer<typeof profileSchema>;
export type PlatformInput = z.infer<typeof platformSchema>;
export type SecurityInput = z.infer<typeof securitySchema>;
export type NotificationsInput = z.infer<typeof notificationSchema>;
export function securityIssues(s: SettingsWorkspace, value: SecurityInput) {
  const r = securitySchema.safeParse(value);
  if (!r.success) return r.error.issues.map((i) => i.message);
  const issues: string[] = [],
    addresses: string[] = [];
  for (const ip of value.ips) {
    try {
      addresses.push(normalizeIp(ip.address));
    } catch (e) {
      issues.push((e as Error).message);
    }
  }
  if (new Set(addresses).size !== addresses.length)
    issues.push("IP addresses must be unique");
  if (
    value.whitelistEnabled &&
    !addresses.includes(normalizeIp(s.security.fixtureIp))
  )
    issues.push(
      "Keep the current fixture session IP in the whitelist to avoid modeled lockout",
    );
  return issues;
}
export function notificationIssues(v: NotificationsInput) {
  const r = notificationSchema.safeParse(v);
  if (!r.success) return r.error.issues.map((i) => i.message);
  const issues: string[] = [];
  if (
    v.enabled.telegram &&
    !/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v.telegramHandle)
  )
    issues.push("Enter a Telegram handle beginning with @ (5–32 characters)");
  if (v.enabled.webhook && !publicHttps(v.webhookUrl))
    issues.push(
      "Use a public HTTPS webhook URL without credentials, fragments or IP literals",
    );
  for (const e of events)
    for (const c of channelNames)
      if (v.routes[e.id][c] && !v.enabled[c])
        issues.push(`${e.label}: enable ${c} before routing events to it`);
  if (!channelNames.some((c) => v.enabled[c] && v.routes.guardian[c]))
    issues.push("Retain at least one enabled Guardian alert route");
  return issues;
}
export const commandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("profile"), value: profileSchema }),
  z.object({
    kind: z.literal("avatar"),
    dataUrl: z
      .string()
      .max(300000)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
  }),
  z.object({ kind: z.literal("role") }),
  z.object({ kind: z.literal("emailRequest"), email: z.email() }),
  z.object({ kind: z.literal("platform"), value: platformSchema }),
  z.object({ kind: z.literal("security"), value: securitySchema }),
  z.object({
    kind: z.literal("securityEvent"),
    event: z.enum([
      "password_preview",
      "backup_preview",
      "disable_2fa",
      "reconfigure_2fa",
    ]),
  }),
  z.object({ kind: z.literal("revokeSession"), id: z.string().nullable() }),
  z.object({ kind: z.literal("notifications"), value: notificationSchema }),
  z.object({
    kind: z.literal("addConnection"),
    loginId: z.string().regex(/^(CR|VRTC)[0-9]{4,12}$/),
    accountType: z.enum(["Real", "Demo"]),
  }),
  z.object({
    kind: z.literal("connection"),
    id: z.string(),
    action: z.enum(["refresh", "reconnect", "disconnect", "primary"]),
  }),
  z.object({
    kind: z.literal("check"),
    target: z.string(),
    targetType: z.enum(["connection", "channel", "integration"]),
  }),
  z.object({
    kind: z.literal("generateKey"),
    name: z.string().trim().min(3).max(50),
    prefix: z.string().regex(/^demo_trademo_[a-f0-9]{8}$/),
    scopes: z
      .array(z.enum(["read", "trade"]))
      .min(1)
      .max(2),
  }),
  z.object({ kind: z.literal("revokeKey"), id: z.string() }),
  z.object({
    kind: z.literal("integration"),
    id: z.string(),
    endpoint: z.string().max(500),
    reference: z.string().trim().max(80),
  }),
  z.object({
    kind: z.literal("billing"),
    action: z.enum(["upgrade_team", "cancel_at_renewal", "clear_request"]),
  }),
  z.object({
    kind: z.literal("payment"),
    brand: z.enum(["Visa", "Mastercard"]),
    last4: z.string().regex(/^\d{4}$/),
  }),
]);
export type SettingsCommand = z.infer<typeof commandSchema>;
export function applySettingsCommand(
  current: SettingsWorkspace,
  input: SettingsCommand,
  now = new Date().toISOString(),
) {
  const c = commandSchema.parse(input),
    s = structuredClone(current);
  let detail = "Local preview only; no backend operation";
  if (c.kind === "profile") Object.assign(s.profile, c.value);
  if (c.kind === "avatar") s.profile.avatar = c.dataUrl;
  if (c.kind === "role") {
    if (s.profile.role === "both")
      throw Error("Investor preview role is already enabled");
    s.profile.role = "both";
  }
  if (c.kind === "emailRequest")
    detail =
      "Email change preview recorded; current email unchanged, no verification sent";
  if (c.kind === "platform") s.platform = c.value;
  if (c.kind === "security") {
    const issues = securityIssues(s, c.value);
    if (issues.length) throw Error(issues.join("; "));
    Object.assign(s.security, {
      ...c.value,
      ips: c.value.ips.map((ip) => ({
        ...ip,
        address: normalizeIp(ip.address),
      })),
    });
  }
  if (c.kind === "securityEvent") {
    if (c.event === "password_preview") s.security.passwordPreviewAt = now;
    if (c.event === "backup_preview") s.security.backupPreviewAt = now;
    if (c.event === "disable_2fa") s.security.twoFactor = "disable_requested";
    if (c.event === "reconfigure_2fa")
      s.security.twoFactor = "reconfigure_requested";
    detail = `${c.event}: preview only; authentication unchanged`;
  }
  if (c.kind === "revokeSession") {
    if (c.id && !s.security.sessions.some((x) => x.id === c.id))
      throw Error("Session not found");
    s.security.sessions.forEach((x) => {
      if (!c.id || x.id === c.id) x.state = "revoke_requested";
    });
    detail =
      "Session revocation requested locally; browser and server sessions remain active";
  }
  if (c.kind === "notifications") {
    const issues = notificationIssues(c.value);
    if (issues.length) throw Error(issues.join("; "));
    s.notifications = c.value;
  }
  if (c.kind === "addConnection") {
    const cap = s.billing.plan === "Team" ? 5 : 2;
    if (s.connections.length >= cap)
      throw Error(`Current plan supports ${cap} connection slots`);
    if (s.connections.some((x) => x.loginId === c.loginId))
      throw Error("This login ID already exists");
    if (c.loginId.startsWith("VRTC") !== (c.accountType === "Demo"))
      throw Error("Use VRTC for Demo and CR for Real account metadata");
    s.connections.push({
      id: `connection_${s.revision + 1}`,
      loginId: c.loginId,
      accountType: c.accountType,
      currency: "USD",
      balance: null,
      status: "oauth_prepared",
      primary: false,
      permissions: ["Read", "Trade"],
      lastActivity: null,
    });
    detail =
      "OAuth preparation only; no authorization or account connection created";
  }
  if (c.kind === "connection") {
    const x = s.connections.find((x) => x.id === c.id);
    if (!x) throw Error("Connection not found");
    if (c.action === "primary") {
      if (x.status !== "source_connected")
        throw Error(
          "Only a source-connected account can be the primary preview",
        );
      s.connections.forEach((a) => (a.primary = a.id === x.id));
    } else {
      if (c.action === "disconnect" && x.status === "disconnected")
        throw Error("Already disconnected locally");
      x.status = c.action === "disconnect" ? "disconnected" : "oauth_prepared";
      x.primary = false;
    }
    detail = `${c.action}: local connection metadata only; no token or provider call`;
  }
  if (c.kind === "check") {
    if (c.targetType === "connection") {
      const x = s.connections.find((x) => x.id === c.target);
      if (!x || x.status === "disconnected")
        throw Error("Select an available connection preparation/source record");
    }
    if (c.targetType === "channel") {
      if (
        !channelNames.includes(c.target as Channel) ||
        !s.notifications.enabled[c.target as Channel]
      )
        throw Error("Enable and configure this channel first");
      const issues = notificationIssues(s.notifications);
      if (issues.length) throw Error(issues.join("; "));
    }
    if (c.targetType === "integration") {
      const x = s.integrations.find((x) => x.id === c.target);
      if (!x || x.status === "not_configured")
        throw Error("Prepare this integration before checking it");
    }
    s.checks.unshift({
      id: `check_${s.revision + 1}`,
      time: now,
      target: c.target,
      kind: c.targetType,
      result: "configuration_only",
    });
    detail = "Configuration-only check; no ping, push, message or webhook sent";
  }
  if (c.kind === "generateKey") {
    if (s.apiKeys.filter((k) => k.state !== "revoke_requested").length >= 5)
      throw Error("Keep at most five local active key records");
    if (new Set(c.scopes).size !== c.scopes.length)
      throw Error("Choose unique scopes");
    if (s.apiKeys.some((k) => k.prefix === c.prefix))
      throw Error("Key prefix collision; generate again");
    s.apiKeys.unshift({
      id: `key_${s.revision + 1}`,
      name: c.name,
      prefix: c.prefix,
      scopes: c.scopes,
      createdAt: now,
      lastUsed: null,
      state: "demo_generated",
    });
    detail = "Nonfunctional demo key metadata only; raw value is not stored";
  }
  if (c.kind === "revokeKey") {
    const k = s.apiKeys.find((k) => k.id === c.id);
    if (!k || k.state === "revoke_requested")
      throw Error("Select an active key record");
    k.state = "revoke_requested";
    detail = "Local revocation request; no server key invalidated";
  }
  if (c.kind === "integration") {
    const i = s.integrations.find((i) => i.id === c.id);
    if (!i) throw Error("Integration not found");
    if (i.type === "webhook" && !publicHttps(c.endpoint))
      throw Error(
        "Use a public HTTPS endpoint without credentials or IP literals",
      );
    if (
      i.type === "webhook" &&
      !/^vault:\/\/[A-Za-z0-9_/-]{3,70}$/.test(c.reference)
    )
      throw Error(
        "Use a vault:// secret-manager reference, never a signing secret",
      );
    Object.assign(i, {
      endpoint: i.type === "webhook" ? c.endpoint : "",
      reference: c.reference,
      status: "draft_prepared",
    });
    detail =
      "Integration draft only; no OAuth, webhook registration or signing secret stored";
  }
  if (c.kind === "billing") {
    if (c.action === "upgrade_team" && s.billing.plan === "Team")
      throw Error("Already on Team source plan");
    if (c.action === "upgrade_team" && s.billing.request === "upgrade_team")
      throw Error("Team upgrade request is already prepared");
    s.billing.request = c.action === "clear_request" ? "none" : c.action;
    detail =
      "Billing request preview only; subscription, renewal and charges unchanged";
  }
  if (c.kind === "payment") {
    s.billing.paymentDraft = { brand: c.brand, last4: c.last4 };
    detail = "Demo payment reference only; no payment method changed";
  }
  s.revision++;
  s.audit.unshift({ time: now, action: c.kind, detail });
  return s;
}
export function renewalDays(s: SettingsWorkspace) {
  return Math.max(
    0,
    Math.ceil((Date.parse(s.billing.renewsAt) - Date.parse(s.asOf)) / 86400000),
  );
}
export function passwordIssues(current: string, next: string, confirm: string) {
  const issues: string[] = [];
  if (current !== "demo-current")
    issues.push(
      "Use demo-current for this demonstration, never your real password",
    );
  if (
    next.length < 12 ||
    next.length > 128 ||
    !/[a-z]/.test(next) ||
    !/[A-Z]/.test(next) ||
    !/[0-9]/.test(next) ||
    !/[^A-Za-z0-9]/.test(next)
  )
    issues.push(
      "Demo new password needs 12–128 characters with upper/lowercase, number and symbol",
    );
  if (next === current) issues.push("Choose a different demo password");
  if (next !== confirm) issues.push("Demo password confirmation must match");
  return issues;
}
