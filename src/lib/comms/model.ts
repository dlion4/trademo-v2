import { z } from "zod";
import {
  channels,
  type Audience,
  type AudiencePlan,
  type Campaign,
  type Channel,
  type CommsBundle,
  type CommsContact,
  type Delivery,
  type MessageContent,
} from "./types";
export const variables = [
  "name",
  "package",
  "investment",
  "earnings",
  "wallet",
  "roi",
  "packageStartDate",
] as const;
export function safeHref(s: string) {
  if (/[\\\s\u0000-\u001f]/.test(s)) return false;
  if (s.startsWith("/")) {
    try {
      const u = new URL(s, "https://trademo.invalid");
      return (
        u.origin === "https://trademo.invalid" &&
        [
          "/dashboard",
          "/dashboard/comms",
          "/dashboard/investors",
          "/dashboard/analytics",
          "/dashboard/funds",
          "/dashboard/withdrawals",
          "/dashboard/schedules",
          "/dashboard/live",
          "/dashboard/trades",
          "/dashboard/packages",
        ].includes(u.pathname)
      );
    } catch {
      return false;
    }
  }
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function contentIssues(subject: string, body: string) {
  const found = [...`${subject}\n${body}`.matchAll(/\{([^{}]+)\}/g)].map(
    (m) => m[1],
  );
  const unknown = found.filter(
    (v) => !variables.includes(v as (typeof variables)[number]),
  );
  const residual = `${subject}\n${body}`.replace(/\{[^{}]+\}/g, "");
  const issues: string[] = [];
  if (unknown.length)
    issues.push(`Unknown variables: ${[...new Set(unknown)].join(", ")}.`);
  if (/[{}]/.test(residual))
    issues.push("Unclosed or malformed variable token.");
  for (const m of body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
    if (!safeHref(m[1]))
      issues.push("Links must use HTTPS or a dashboard route.");
  return issues;
}
const audienceSchema = z
  .object({
    type: z.enum(["all", "individual", "packages"]),
    ids: z
      .array(z.string())
      .max(100)
      .transform((a) => [...new Set(a)]),
    packages: z
      .array(z.string())
      .max(3)
      .transform((a) => [...new Set(a)]),
  })
  .refine(
    (a) =>
      a.type === "all" ||
      (a.type === "individual" && a.ids.length > 0) ||
      (a.type === "packages" && a.packages.length > 0),
    "Select at least one investor or package.",
  );
export const messageSchema = z
  .object({
    subject: z.string().trim().min(3).max(120),
    body: z.string().trim().min(10).max(10000),
    audience: audienceSchema,
    channels: z
      .array(z.enum(channels))
      .min(1)
      .max(4)
      .transform((a) => [...new Set(a)]),
    templateId: z.string().nullable(),
    saveTemplate: z.boolean(),
    templateName: z.string().trim().max(60),
  })
  .refine(
    (v) => !v.saveTemplate || v.templateName.length >= 3,
    "Name the template (3–60 characters).",
  )
  .refine(
    (v) => !contentIssues(v.subject, v.body).length,
    "Check variable names and link protocols.",
  );
const text = z.string().trim().min(10).max(10000);
export const commsCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("compose"),
    content: messageSchema,
    mode: z.enum(["queue", "draft", "schedule"]),
    campaignType: z.enum(["message", "announcement", "report"]),
    scheduledFor: z.string().nullable(),
    draftId: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("template"),
    id: z.string().nullable(),
    name: z.string().trim().min(3).max(60),
    subject: z.string().trim().min(3).max(120),
    body: text,
    category: z.string().min(1).max(40),
  }),
  z.object({
    kind: z.literal("duplicate"),
    id: z.string(),
    name: z.string().trim().min(3).max(60),
  }),
  z.object({
    kind: z.literal("test"),
    templateId: z.string(),
    contactId: z.string(),
    target: z.email(),
  }),
  z.object({
    kind: z.literal("threadState"),
    id: z.string(),
    action: z.enum(["read", "unread", "archive", "restore"]),
  }),
  z.object({ kind: z.literal("reply"), id: z.string(), body: text }),
  z.object({ kind: z.literal("resend"), id: z.string() }),
  z.object({ kind: z.literal("cancel"), id: z.string() }),
  z.object({ kind: z.literal("dispatch"), id: z.string() }),
  z.object({
    kind: z.literal("simulate"),
    id: z.string(),
    outcome: z.enum(["deliver", "fail", "engage"]),
  }),
  z.object({ kind: z.literal("retry"), id: z.string() }),
  z.object({
    kind: z.literal("preferences"),
    id: z.string(),
    consent: z.object({
      in_app: z.boolean(),
      email: z.boolean(),
      telegram: z.boolean(),
      sms: z.boolean(),
    }),
  }),
  z.object({
    kind: z.literal("channels"),
    enabled: z.object({
      in_app: z.boolean(),
      email: z.boolean(),
      telegram: z.boolean(),
      sms: z.boolean(),
    }),
  }),
]);
export type CommsCommand = z.infer<typeof commsCommandSchema>;
const cash = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
export function personalize(
  subject: string,
  body: string,
  c: CommsContact,
  audience?: Audience,
) {
  const issues = contentIssues(subject, body);
  if (issues.length) throw Error(issues.join(" "));
  const selected =
    audience?.type === "packages"
      ? c.packages.find((p) => audience.packages.includes(p))
      : undefined;
  const values: Record<string, string> = {
    name: c.name,
    package: selected ?? c.primaryPackage,
    investment: cash(c.investment),
    earnings: cash(c.earnings),
    wallet: cash(c.wallet),
    roi: c.investment
      ? `${((c.earnings / c.investment) * 100).toFixed(2)}%`
      : "N/A",
    packageStartDate: selected
      ? (c.packageStartDates[selected] ?? "Not scheduled")
      : c.packageStartDate,
  };
  const interpolate = (s: string) =>
    s.replace(/\{([^{}]+)\}/g, (_, key) => values[key]);
  const result = { subject: interpolate(subject), body: interpolate(body) };
  if (result.subject.length > 120)
    throw Error(
      "Personalized subject exceeds 120 characters. Shorten the subject.",
    );
  return result;
}
export function audiencePlan(
  s: CommsBundle,
  content: MessageContent,
  onlyIds?: string[],
): AudiencePlan {
  const a = content.audience;
  if (
    a.ids.some((id) => !s.contacts.some((c) => c.id === id)) ||
    a.packages.some((p) => !s.pools.some((pool) => pool.code === p))
  )
    throw Error("Audience contains an unknown investor or package.");
  const candidates = s.contacts.filter(
    (c) =>
      (!onlyIds || onlyIds.includes(c.id)) &&
      (a.type === "all" ||
        (a.type === "individual" && a.ids.includes(c.id)) ||
        (a.type === "packages" &&
          c.packages.some((p) => a.packages.includes(p)))),
  );
  const rows: AudiencePlan["rows"] = [],
    excluded: AudiencePlan["excluded"] = [];
  for (const c of candidates)
    for (const channel of [...new Set(content.channels)]) {
      const reason = ["inactive", "suspended"].includes(c.status)
        ? "Account not eligible"
        : !s.channelConfig[channel].enabled
          ? "Demo adapter disabled"
          : !c.consent[channel]
            ? "Channel consent absent"
            : null;
      if (reason) excluded.push({ contactId: c.id, channel, reason });
      else rows.push({ contactId: c.id, channel });
    }
  return { candidates: candidates.map((c) => c.id), rows, excluded };
}
export function campaignStats(s: CommsBundle, id: string) {
  const rows = s.deliveries.filter((d) => d.campaignId === id),
    contacts = [...new Set(rows.map((d) => d.contactId))];
  const read = [
    ...new Set(rows.filter((d) => d.openedAt).map((d) => d.contactId)),
  ];
  return {
    attempts: rows.length,
    contacts: contacts.length,
    delivered: rows.filter((d) => d.status === "delivered").length,
    queued: rows.filter((d) => d.status === "queued_demo").length,
    failed: rows.filter((d) => d.status === "failed").length,
    read: read.length,
    unreadIds: contacts.filter((id) => !read.includes(id)),
    readPercent: contacts.length ? (read.length / contacts.length) * 100 : 0,
  };
}
export function analytics(s: CommsBundle, days = 30) {
  const end = Date.parse(s.asOf.slice(0, 10)) + 86400000,
    start = end - days * 86400000;
  const rows = s.deliveries.filter(
    (d) => Date.parse(d.createdAt) >= start && Date.parse(d.createdAt) < end,
  );
  const summarize = (list: Delivery[]) => {
    const delivered = list.filter((d) => d.status === "delivered");
    return {
      attempts: list.length,
      delivered: delivered.length,
      queued: list.filter((d) => d.status === "queued_demo").length,
      failed: list.filter((d) => d.status === "failed").length,
      opens: delivered.filter((d) => d.openedAt).length,
      clicks: delivered.filter((d) => d.clickedAt).length,
      replies: delivered.filter((d) => d.repliedAt).length,
      openRate: delivered.length
        ? (delivered.filter((d) => d.openedAt).length / delivered.length) * 100
        : null,
      clickRate: delivered.length
        ? (delivered.filter((d) => d.clickedAt).length / delivered.length) * 100
        : null,
      responseRate: delivered.length
        ? (delivered.filter((d) => d.repliedAt).length / delivered.length) * 100
        : null,
    };
  };
  return {
    ...summarize(rows),
    byChannel: channels.map((channel) => ({
      channel,
      ...summarize(rows.filter((d) => d.channel === channel)),
    })),
    byTemplate: s.templates.map((t) => ({
      id: t.id,
      name: t.name,
      ...summarize(
        rows.filter(
          (d) =>
            s.campaigns.find((c) => c.id === d.campaignId)?.templateId === t.id,
        ),
      ),
    })),
  };
}
export function assertCommsInvariant(s: CommsBundle) {
  if (new Set(s.deliveries.map((d) => d.id)).size !== s.deliveries.length)
    throw Error("Duplicate delivery ID.");
  const unique = new Set<string>();
  for (const d of s.deliveries) {
    const c = s.campaigns.find((c) => c.id === d.campaignId);
    if (!c || !s.contacts.some((c) => c.id === d.contactId))
      throw Error("Orphan delivery.");
    const key = `${d.campaignId}:${d.contactId}:${d.channel}`;
    if (unique.has(key))
      throw Error("Duplicate recipient/channel within a campaign.");
    unique.add(key);
    if (
      (d.status !== "delivered" &&
        (d.openedAt || d.clickedAt || d.repliedAt)) ||
      (d.clickedAt && !d.openedAt) ||
      (d.status === "delivered" && !d.deliveredAt)
    )
      throw Error(
        "Engagement requires delivered evidence; clicks require opens.",
      );
    if (!c.contactIds.includes(d.contactId))
      throw Error("Campaign audience mismatch.");
  }
}
export function applyCommsCommand(
  current: CommsBundle,
  input: CommsCommand,
  now = new Date().toISOString(),
): CommsBundle {
  const c = commsCommandSchema.parse(input),
    s = structuredClone(current);
  assertCommsInvariant(s);
  let reference = "workspace",
    detail = "Local communication state changed; no external delivery.";
  const getCampaign = (id: string) => {
    const result = s.campaigns.find((c) => c.id === id);
    if (!result) throw Error("Campaign not found.");
    return result;
  };
  const queue = (campaign: Campaign, plan: AudiencePlan) => {
    if (!plan.rows.length)
      throw Error(
        "No eligible recipient/channel pairs. Review consent, account status and enabled demo adapters.",
      );
    for (const id of new Set(plan.rows.map((r) => r.contactId)))
      personalize(
        campaign.subject,
        campaign.body,
        s.contacts.find((c) => c.id === id)!,
        campaign.audience,
      );
    campaign.contactIds = [...new Set(plan.rows.map((r) => r.contactId))];
    campaign.status = "queued";
    for (const [i, row] of plan.rows.entries())
      s.deliveries.push({
        id: `${campaign.id}_d_${i + 1}`,
        campaignId: campaign.id,
        contactId: row.contactId,
        channel: row.channel,
        status: "queued_demo",
        attempts: 1,
        createdAt: now,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        repliedAt: null,
        failure: null,
      });
  };
  const addTemplate = (
    name: string,
    subject: string,
    body: string,
    category = "Custom",
  ) => {
    if (contentIssues(subject, body).length)
      throw Error(contentIssues(subject, body).join(" "));
    if (s.templates.some((t) => t.name.toLowerCase() === name.toLowerCase()))
      throw Error("Template name already exists.");
    const t = {
      id: `tpl_local_${s.revision + 1}`,
      name,
      subject,
      body,
      category,
      version: 1,
      updatedAt: now,
    };
    s.templates.push(t);
    return t;
  };
  if (c.kind === "compose") {
    if (
      c.content.templateId &&
      !s.templates.some((t) => t.id === c.content.templateId)
    )
      throw Error("Template not found.");
    const old = c.draftId ? getCampaign(c.draftId) : null;
    if (old && old.status !== "draft")
      throw Error(
        "Only a draft can be edited; queued campaigns are immutable.",
      );
    const plan = audiencePlan(s, c.content);
    if (c.mode !== "draft" && !plan.rows.length)
      throw Error("No eligible recipients.");
    for (const id of new Set(plan.rows.map((r) => r.contactId)))
      personalize(
        c.content.subject,
        c.content.body,
        s.contacts.find((c) => c.id === id)!,
        c.content.audience,
      );
    if (
      c.mode === "schedule" &&
      (!c.scheduledFor ||
        !Number.isFinite(Date.parse(c.scheduledFor)) ||
        Date.parse(c.scheduledFor) <= Date.parse(now) ||
        Date.parse(c.scheduledFor) > Date.parse(now) + 365 * 86400000)
    )
      throw Error("Schedule must be a future UTC time within one year.");
    let templateId = c.content.templateId;
    if (c.content.saveTemplate)
      templateId = addTemplate(
        c.content.templateName,
        c.content.subject,
        c.content.body,
      ).id;
    const campaign: Campaign = {
      ...c.content,
      saveTemplate: false,
      templateId,
      templateVersion:
        s.templates.find((t) => t.id === templateId)?.version ?? null,
      id: old?.id ?? `camp_local_${s.revision + 1}`,
      type: c.campaignType,
      status:
        c.mode === "draft"
          ? "draft"
          : c.mode === "schedule"
            ? "scheduled"
            : "queued",
      createdAt: old?.createdAt ?? now,
      scheduledFor: c.mode === "schedule" ? c.scheduledFor : null,
      contactIds: [],
      parentId: null,
    };
    if (old)
      s.campaigns[s.campaigns.findIndex((x) => x.id === old.id)] = campaign;
    else s.campaigns.unshift(campaign);
    if (c.mode === "queue") queue(campaign, plan);
    reference = campaign.id;
    detail = `${c.mode}: ${plan.rows.length} eligible contact/channel pairs. No real queue job or transfer to a provider.`;
  }
  if (c.kind === "template") {
    if (contentIssues(c.subject, c.body).length)
      throw Error(contentIssues(c.subject, c.body).join(" "));
    if (
      s.templates.some(
        (t) => t.id !== c.id && t.name.toLowerCase() === c.name.toLowerCase(),
      )
    )
      throw Error("Template name already exists.");
    const old = s.templates.find((t) => t.id === c.id);
    if (c.id && !old) throw Error("Template not found.");
    if (old) {
      Object.assign(old, {
        name: c.name,
        subject: c.subject,
        body: c.body,
        category: c.category,
        version: old.version + 1,
        updatedAt: now,
      });
      reference = old.id;
    } else reference = addTemplate(c.name, c.subject, c.body, c.category).id;
  }
  if (c.kind === "duplicate") {
    const t = s.templates.find((t) => t.id === c.id);
    if (!t) throw Error("Template not found.");
    reference = addTemplate(c.name, t.subject, t.body, t.category).id;
  }
  if (c.kind === "test") {
    const t = s.templates.find((t) => t.id === c.templateId),
      contact = s.contacts.find((x) => x.id === c.contactId);
    if (!t || !contact) throw Error("Template or preview contact not found.");
    const rendered = personalize(t.subject, t.body, contact);
    reference = `test_${s.revision + 1}`;
    s.tests.unshift({
      id: reference,
      templateId: t.id,
      contactId: contact.id,
      target: c.target,
      ...rendered,
      time: now,
      state: "rendered_only",
    });
    detail =
      "Test rendered locally; no email sent and no analytics delivery counted.";
  }
  if (c.kind === "threadState" || c.kind === "reply") {
    const t = s.threads.find((t) => t.id === c.id);
    if (!t) throw Error("Thread not found.");
    reference = t.id;
    if (c.kind === "threadState") {
      if (c.action === "archive") t.status = "archived";
      else if (c.action === "restore") t.status = "read";
      else if (t.status !== "archived")
        t.status =
          c.action === "read"
            ? t.status === "unread"
              ? "read"
              : t.status
            : "unread";
    } else {
      if (t.status === "archived")
        throw Error("Restore the thread before replying.");
      const contact = s.contacts.find((x) => x.id === t.contactId)!;
      const content: MessageContent = {
        subject: t.subject,
        body: c.body,
        audience: { type: "individual", ids: [contact.id], packages: [] },
        channels: ["in_app"],
        templateId: null,
        saveTemplate: false,
        templateName: "",
      };
      const campaign: Campaign = {
        ...content,
        id: `reply_${s.revision + 1}`,
        type: "message",
        status: "queued",
        createdAt: now,
        scheduledFor: null,
        contactIds: [],
        parentId: null,
      };
      s.campaigns.unshift(campaign);
      queue(campaign, audiencePlan(s, content));
      t.posts.push({
        id: `post_${s.revision + 1}`,
        time: now,
        direction: "outgoing",
        body: c.body,
        state: "queued_demo",
      });
      t.status = "replied";
      t.updatedAt = now;
    }
  }
  if (c.kind === "resend") {
    const old = getCampaign(c.id);
    if (
      !["simulated", "queued"].includes(old.status) ||
      old.type !== "announcement"
    )
      throw Error("Choose a queued or simulated announcement.");
    if (
      s.campaigns.some((x) => x.parentId === old.id && x.status !== "cancelled")
    )
      throw Error(
        "An unread follow-up already exists. Repeated resend is blocked.",
      );
    const stats = campaignStats(s, old.id);
    if (!stats.unreadIds.length) throw Error("No unread recipients remain.");
    const follow: Campaign = {
      ...old,
      id: `follow_${s.revision + 1}`,
      createdAt: now,
      status: "queued",
      contactIds: [],
      scheduledFor: null,
      parentId: old.id,
    };
    s.campaigns.unshift(follow);
    queue(follow, audiencePlan(s, old, stats.unreadIds));
    reference = follow.id;
  }
  if (c.kind === "cancel") {
    const campaign = getCampaign(c.id);
    if (!["draft", "scheduled"].includes(campaign.status))
      throw Error("Only an unsent draft or scheduled item can be cancelled.");
    campaign.status = "cancelled";
    reference = campaign.id;
  }
  if (c.kind === "dispatch") {
    const campaign = getCampaign(c.id);
    if (
      campaign.status !== "scheduled" ||
      !campaign.scheduledFor ||
      Date.parse(campaign.scheduledFor) > Date.parse(now)
    )
      throw Error("Only a due scheduled item can enter the local queue.");
    queue(campaign, audiencePlan(s, campaign));
    reference = campaign.id;
  }
  if (c.kind === "simulate" || c.kind === "retry") {
    const campaign = getCampaign(c.id);
    if (!["queued", "simulated"].includes(campaign.status))
      throw Error("No queued delivery set exists for this campaign.");
    const rows = s.deliveries.filter((d) => d.campaignId === c.id);
    if (c.kind === "retry") {
      const failed = rows.filter((d) => d.status === "failed");
      if (!failed.length) throw Error("No failed deliveries to retry.");
      for (const d of failed) {
        const contact = s.contacts.find((x) => x.id === d.contactId)!;
        if (
          !s.channelConfig[d.channel].enabled ||
          !contact.consent[d.channel] ||
          ["inactive", "suspended"].includes(contact.status)
        )
          throw Error(
            "Retry blocked by current channel consent, adapter or account eligibility.",
          );
        d.status = "queued_demo";
        d.failure = null;
        d.attempts++;
      }
    } else if (c.outcome === "engage") {
      const delivered = rows.filter((d) => d.status === "delivered");
      if (!delivered.length)
        throw Error(
          "Deliver the simulated queue before generating engagement.",
        );
      delivered.forEach((d, i) => {
        if (i % 5 !== 0) d.openedAt = now;
        if (i % 5 !== 0 && i % 4 === 0) d.clickedAt = now;
        if (d.channel === "in_app" && i % 3 === 0) d.repliedAt = now;
      });
    } else {
      const queued = rows.filter((d) => d.status === "queued_demo");
      if (!queued.length) throw Error("No queued demo deliveries remain.");
      queued.forEach((d) => {
        const contact = s.contacts.find((x) => x.id === d.contactId)!;
        const allowed =
          contact.consent[d.channel] &&
          s.channelConfig[d.channel].enabled &&
          !["inactive", "suspended"].includes(contact.status);
        d.status = c.outcome === "deliver" && allowed ? "delivered" : "failed";
        d.deliveredAt = d.status === "delivered" ? now : null;
        d.failure =
          d.status === "failed"
            ? allowed
              ? "simulated_provider_failure"
              : "eligibility_changed"
            : null;
      });
    }
    campaign.status = "simulated";
    reference = campaign.id;
  }
  if (c.kind === "preferences") {
    const contact = s.contacts.find((x) => x.id === c.id);
    if (!contact) throw Error("Contact not found.");
    contact.consent = c.consent;
    reference = contact.id;
    detail =
      "Synthetic consent preference changed locally; production requires investor-authorized evidence.";
  }
  if (c.kind === "channels") {
    channels.forEach(
      (channel) => (s.channelConfig[channel].enabled = c.enabled[channel]),
    );
    detail =
      "Demo adapter flags changed only. No credentials, webhook or provider connection configured.";
  }
  s.audit.unshift({
    id: `comms_audit_${s.revision + 1}`,
    time: now,
    action: c.kind,
    reference,
    detail,
    revision: s.revision + 1,
  });
  s.revision++;
  assertCommsInvariant(s);
  return s;
}
