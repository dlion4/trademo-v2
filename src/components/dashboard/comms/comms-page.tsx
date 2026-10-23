"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  OperatorShell,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon, type IconName } from "@/components/icons";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import { useComms } from "@/lib/comms/use-comms";
import {
  analytics,
  audiencePlan,
  campaignStats,
  contentIssues,
  messageSchema,
  type CommsCommand,
} from "@/lib/comms/model";
import {
  channels,
  type Campaign,
  type CommsBundle,
  type CommsThread,
  type MessageContent,
} from "@/lib/comms/types";
import {
  AudiencePicker,
  ContentEditor,
  MessageComposer,
  MessagePreview,
  RichText,
  type ComposeAction,
} from "./composer";
const time = (s: string) => s.replace("T", " ").slice(0, 16);
const human = (s: string) => s.replaceAll("_", " ");
const percent = (n: number | null) => (n === null ? "N/A" : `${n.toFixed(1)}%`);
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const inboxCol = createDeskColumnHelper<CommsThread>(),
  logCol = createDeskColumnHelper<Campaign>();
type Kind =
  | "compose"
  | "announcement"
  | "preview"
  | "templateEdit"
  | "templatePreview"
  | "test"
  | "duplicate"
  | "templateStats"
  | "announcementDetail"
  | "resend"
  | "deliveryDetail"
  | "retry"
  | "simulate"
  | "reply"
  | "thread"
  | "archive"
  | "contact"
  | "preferences"
  | "channels"
  | "drafts"
  | "schedule"
  | "scheduled"
  | "cancel"
  | "export"
  | "analytics"
  | "audit"
  | "reset";
const titles: Record<Kind, string> = {
  compose: "Review personalized message",
  announcement: "New investor announcement",
  preview: "Personalized content preview",
  templateEdit: "Edit communication template",
  templatePreview: "Template personalization preview",
  test: "Render test email artifact",
  duplicate: "Duplicate template",
  templateStats: "Template engagement evidence",
  announcementDetail: "Announcement audience & read report",
  resend: "Follow up with unread recipients",
  deliveryDetail: "Notification delivery evidence",
  retry: "Retry failed demo deliveries",
  simulate: "Simulate delivery & engagement",
  reply: "Reply to investor",
  thread: "Investor conversation",
  archive: "Conversation archive review",
  contact: "Investor communication context",
  preferences: "Synthetic channel consent",
  channels: "Demo channel configuration",
  drafts: "Saved message drafts",
  schedule: "Schedule communication request",
  scheduled: "Scheduled communication outbox",
  cancel: "Cancel unsent communication",
  export: "Export communications report",
  analytics: "Communication metrics & methodology",
  audit: "Communications session audit",
  reset: "Reset communications workspace",
};
const wizardSteps: Partial<Record<Kind, string[]>> = {
  compose: ["Audience", "Content", "Review & consent"],
  announcement: ["Audience", "Content", "Review & consent"],
  schedule: ["Audience", "UTC schedule", "Review & consent"],
  test: ["Preview contact", "Rendered test", "Consent & download"],
  resend: ["Unread audience", "Eligibility", "Confirm follow-up"],
  retry: ["Failed evidence", "Consent gates", "Confirm retry"],
  simulate: ["Local scenario", "Delivery scope", "Confirm simulation"],
  export: ["Format", "Record scope", "Download"],
};
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Status({ value }: { value: string }) {
  return (
    <span className={`co-status co-status-${value}`}>
      {["unread", "queued_demo", "scheduled"].includes(value) ? "○ " : "· "}
      {human(value)}
    </span>
  );
}
function Metric({
  label,
  value,
  rate,
  detail,
  icon,
  onClick,
}: {
  label: string;
  value: number | null;
  rate?: boolean;
  detail: string;
  icon: IconName;
  onClick: () => void;
}) {
  const n = useLiveCountUp(value ?? 0);
  return (
    <button className="co-metric" onClick={onClick}>
      <div>
        <span>{label}</span>
        <Icon name={icon} size={16} />
      </div>
      <strong className="mono">
        {value === null
          ? "N/A"
          : rate
            ? `${n.toFixed(1)}%`
            : Math.round(n).toLocaleString()}
      </strong>
      <small>{detail} ↗</small>
    </button>
  );
}
function CommunicationsDesk({ initial }: { initial: CommsBundle }) {
  const { pushToast } = useOperatorUI();
  const { data, mutation, reset } = useComms(initial);
  const [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState("conversation");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState(30);
  const [clock, setClock] = useState(() => Date.now());
  const metrics = analytics(data, period);
  const baseDay = data.asOf.slice(0, 10),
    baseFrom = new Date(Date.parse(baseDay) - 29 * 86400000)
      .toISOString()
      .slice(0, 10);
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxStatus, setInboxStatus] = useState("all");
  const [inboxPool, setInboxPool] = useState("all");
  const [inboxFrom, setInboxFrom] = useState(baseFrom);
  const [inboxTo, setInboxTo] = useState(baseDay);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxSort, setInboxSort] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [logType, setLogType] = useState("all");
  const [logChannel, setLogChannel] = useState("all");
  const [logStatus, setLogStatus] = useState("all");
  const [logFrom, setLogFrom] = useState(baseFrom);
  const [logTo, setLogTo] = useState(baseDay);
  const [logPage, setLogPage] = useState(1);
  const [logSort, setLogSort] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [composerEpoch, setComposerEpoch] = useState(0);
  const [queueType, setQueueType] = useState<
    "message" | "announcement" | "report"
  >("message");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MessageContent>({
    subject: data.templates[3].subject,
    body: data.templates[3].body,
    audience: { type: "all", ids: [], packages: [] },
    channels: ["in_app", "email"],
    templateId: data.templates[3].id,
    saveTemplate: false,
    templateName: "",
  });
  const [previewContact, setPreviewContact] = useState(data.contacts[0].id);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("Custom");
  const [replyBody, setReplyBody] = useState("");
  const [testTarget, setTestTarget] = useState("operator@example.test");
  const [scheduleUTC, setScheduleUTC] = useState(
    new Date(Date.parse(initial.asOf) + 3600000).toISOString().slice(0, 16),
  );
  const [scenario, setScenario] = useState<"deliver" | "fail" | "engage">(
    "deliver",
  );
  const [prefDraft, setPrefDraft] = useState(data.contacts[0].consent);
  const [channelDraft, setChannelDraft] = useState(
    Object.fromEntries(
      channels.map((c) => [c, data.channelConfig[c].enabled]),
    ) as Record<(typeof channels)[number], boolean>,
  );
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportScope, setExportScope] = useState("filtered");
  const thread =
    data.threads.find((t) => t.id === (modal?.id ?? selectedThread)) ??
    data.threads[0];
  const contact =
    data.contacts.find(
      (c) =>
        c.id ===
        (modal?.kind === "contact" || modal?.kind === "preferences"
          ? modal.id
          : thread.contactId),
    ) ?? data.contacts[0];
  const campaign =
    data.campaigns.find((c) => c.id === modal?.id) ?? data.campaigns[0];
  const template =
    data.templates.find((t) => t.id === modal?.id) ?? data.templates[0];
  const campStats = campaignStats(data, campaign.id);
  const inspected = data.threads.find((t) => t.id === drawer);
  const plan = audiencePlan(data, draft);
  const templateMetrics = metrics.byTemplate.find((t) => t.id === template.id);
  const announcements = data.campaigns.filter(
    (c) =>
      c.type === "announcement" && !["cancelled", "draft"].includes(c.status),
  );
  const drafts = data.campaigns.filter((c) => c.status === "draft"),
    scheduled = data.campaigns.filter((c) => c.status === "scheduled");
  const unread = data.threads.filter((t) => t.status === "unread").length;
  const inboxColumns = useMemo(
    () =>
      inboxCol.columns([
        inboxCol.accessor("updatedAt", { header: "Latest / UTC" }),
        inboxCol.accessor("subject", { header: "Conversation" }),
        inboxCol.accessor("status", { header: "Status" }),
      ]),
    [],
  );
  const logColumns = useMemo(
    () =>
      logCol.columns([
        logCol.accessor("createdAt", { header: "Date / UTC" }),
        logCol.accessor("type", { header: "Type" }),
        logCol.accessor("subject", { header: "Subject" }),
        logCol.accessor((r) => r.contactIds.length, {
          id: "count",
          header: "Recipients",
        }),
        logCol.accessor("channels", { header: "Channels" }),
        logCol.accessor("status", { header: "State" }),
      ]),
    [],
  );
  const inboxInvalid = inboxFrom > inboxTo || !inboxFrom || !inboxTo;
  const inboxRows = data.threads.filter(
    (t) =>
      !inboxInvalid &&
      (inboxStatus === "all" || t.status === inboxStatus) &&
      (inboxPool === "all" || t.pool === inboxPool) &&
      t.updatedAt.slice(0, 10) >= inboxFrom &&
      t.updatedAt.slice(0, 10) <= inboxTo &&
      `${t.subject} ${data.contacts.find((c) => c.id === t.contactId)?.name} ${t.id}`
        .toLowerCase()
        .includes(inboxSearch.toLowerCase()),
  );
  const logInvalid = logFrom > logTo || !logFrom || !logTo;
  const logRows = data.campaigns.filter(
    (c) =>
      !logInvalid &&
      (logType === "all" || c.type === logType) &&
      (logChannel === "all" ||
        c.channels.includes(logChannel as (typeof channels)[number])) &&
      (logStatus === "all" || c.status === logStatus) &&
      c.createdAt.slice(0, 10) >= logFrom &&
      c.createdAt.slice(0, 10) <= logTo &&
      `${c.subject} ${c.id}`.toLowerCase().includes(logSearch.toLowerCase()),
  );
  const inboxTable = useDeskTable({
    data: inboxRows,
    columns: inboxColumns,
    state: { sorting: inboxSort },
    onSortingChange: (u) => {
      setInboxSort(typeof u === "function" ? u(inboxSort) : u);
      setInboxPage(1);
    },
  });
  const logTable = useDeskTable({
    data: logRows,
    columns: logColumns,
    state: { sorting: logSort },
    onSortingChange: (u) => {
      setLogSort(typeof u === "function" ? u(logSort) : u);
      setLogPage(1);
    },
  });
  const inboxPages = Math.max(1, Math.ceil(inboxRows.length / 5)),
    safeInbox = Math.min(inboxPage, inboxPages),
    logPages = Math.max(1, Math.ceil(logRows.length / 6)),
    safeLog = Math.min(logPage, logPages);
  const visibleInbox = inboxTable
      .getRowModel()
      .rows.slice((safeInbox - 1) * 5, safeInbox * 5),
    visibleLogs = logTable
      .getRowModel()
      .rows.slice((safeLog - 1) * 6, safeLog * 6);
  const overlayOpen = !!modal || !!drawer;
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!overlayOpen) return;
    const before = document.activeElement as HTMLElement | null;
    const layer = document.querySelector<HTMLElement>(
      ".page-dashboard-comms .co-local-layer",
    );
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const list = () =>
      Array.from(
        layer?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
    list()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !mutation.isPending) {
        setModal(null);
        setDrawer(null);
      }
      if (e.key === "Tab") {
        const nodes = list();
        if (!nodes.length) return;
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
          e.preventDefault();
          nodes[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [overlayOpen, modal?.kind, drawer, busy, mutation.isPending]);
  function open(kind: Kind, id?: string) {
    if (kind === "schedule")
      setScheduleUTC(new Date(clock + 3600000).toISOString().slice(0, 16));
    setDrawer(null);
    setStep(0);
    setError("");
    setConfirmed(false);
    if (kind === "reply") setReplyBody("");
    if (kind === "templateEdit" || kind === "duplicate") {
      const t = data.templates.find((t) => t.id === id);
      setEditName(
        kind === "duplicate"
          ? `${t?.name ?? "Template"} copy`.slice(0, 60)
          : (t?.name ?? "Custom investor update"),
      );
      setEditSubject(t?.subject ?? draft.subject);
      setEditBody(t?.body ?? draft.body);
      setEditCategory(t?.category ?? "Custom");
    }
    if (kind === "preferences")
      setPrefDraft(
        data.contacts.find((c) => c.id === id)?.consent ?? contact.consent,
      );
    if (kind === "channels")
      setChannelDraft(
        Object.fromEntries(
          channels.map((c) => [c, data.channelConfig[c].enabled]),
        ) as typeof channelDraft,
      );
    if (kind === "simulate") setScenario("deliver");
    setModal({ kind, id });
  }
  function close() {
    if (!busy && !mutation.isPending) {
      setModal(null);
      setDrawer(null);
    }
  }
  async function run(
    command: CommsCommand,
    message: string,
    after?: (next: CommsBundle) => void,
  ) {
    setError("");
    try {
      const next = await mutation.mutateAsync(command);
      setModal(null);
      if (command.kind === "compose") setDraftId(null);
      after?.(next);
      pushToast({ tone: "success", title: message });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to change the local workspace.",
      );
    }
  }
  async function selectConversation(id: string, inspector = false) {
    setError("");
    try {
      await mutation.mutateAsync({ kind: "threadState", id, action: "read" });
      setSelectedThread(id);
      if (inspector) {
        setModal(null);
        setDrawerTab("conversation");
        setDrawer(id);
      } else if (window.matchMedia("(max-width: 991px)").matches)
        open("thread", id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open conversation.");
    }
  }
  function launch(
    content: MessageContent,
    type: "message" | "announcement" | "report" = "message",
    kind: Kind = "compose",
    existing: string | null = null,
  ) {
    setDraft(content);
    setDraftId(existing);
    setQueueType(type);
    open(kind);
  }
  function loadTemplate(id: string) {
    const t = data.templates.find((t) => t.id === id)!;
    setDraft({
      ...draft,
      subject: t.subject,
      body: t.body,
      templateId: t.id,
      saveTemplate: false,
      templateName: "",
    });
    setDraftId(null);
    setComposerEpoch(composerEpoch + 1);
    setModal(null);
    document
      .getElementById("comms-compose")
      ?.scrollIntoView({ behavior: "smooth" });
    pushToast({ tone: "info", title: "Template loaded into composer" });
  }
  function loadDraft(c: Campaign) {
    setDraft({
      subject: c.subject,
      body: c.body,
      audience: c.audience,
      channels: c.channels,
      templateId: c.templateId,
      saveTemplate: false,
      templateName: "",
    });
    setDraftId(c.status === "draft" ? c.id : null);
    setQueueType(
      c.type === "announcement"
        ? "announcement"
        : c.type === "report"
          ? "report"
          : "message",
    );
    setComposerEpoch(composerEpoch + 1);
    setModal(null);
    document
      .getElementById("comms-compose")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  function onCompose(content: MessageContent, action: ComposeAction) {
    setDraft(content);
    if (action === "draft")
      void run(
        {
          kind: "compose",
          content,
          mode: "draft",
          campaignType: queueType,
          scheduledFor: null,
          draftId,
        },
        "Draft saved locally; no message queued",
      );
    else {
      open(
        action === "template"
          ? "templateEdit"
          : action === "schedule"
            ? "schedule"
            : action === "preview"
              ? "preview"
              : "compose",
      );
      if (action === "template") {
        setEditSubject(content.subject);
        setEditBody(content.body);
      }
    }
  }
  function consent(
    text = "I understand this creates local demo state only. No real email, notification, SMS, Telegram message or backend job is sent.",
  ) {
    return (
      <label className="co-check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {text}
      </label>
    );
  }
  function previewSelector() {
    return (
      <label className="co-field mb-3">
        Preview investor
        <select
          className="form-select"
          value={previewContact}
          onChange={(e) => setPreviewContact(e.target.value)}
        >
          {data.contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function audienceReview() {
    return (
      <>
        <div className="co-review-totals">
          <div>
            <small>Unique contacts</small>
            <b className="mono">
              {new Set(plan.rows.map((r) => r.contactId)).size}
            </b>
          </div>
          <div>
            <small>Contact/channel pairs</small>
            <b className="mono">{plan.rows.length}</b>
          </div>
          <div>
            <small>Excluded pairs</small>
            <b className="mono">{plan.excluded.length}</b>
          </div>
        </div>
        <div className="co-audience-evidence">
          {plan.rows.map((r, i) => (
            <span key={i}>
              {data.contacts.find((c) => c.id === r.contactId)?.name}
              <b>{human(r.channel)}</b>
            </span>
          ))}
        </div>
        {plan.excluded.length > 0 && (
          <details className="co-exclusions">
            <summary>
              Review {plan.excluded.length} consent / adapter / account
              exclusions
            </summary>
            {plan.excluded.map((r, i) => (
              <p key={i}>
                {data.contacts.find((c) => c.id === r.contactId)?.name} ·{" "}
                {human(r.channel)} — {r.reason}
              </p>
            ))}
          </details>
        )}
      </>
    );
  }
  function threadView(t: CommsThread) {
    const c = data.contacts.find((c) => c.id === t.contactId)!;
    return (
      <div className="co-thread">
        <div className="co-thread-heading">
          <div>
            <span className="co-tag mono">{t.pool}</span>
            <h3>{t.subject}</h3>
            <button className="co-link" onClick={() => open("contact", c.id)}>
              {c.name} ↗
            </button>
          </div>
          <Status value={t.status} />
        </div>
        <div className="co-thread-posts">
          {t.posts.map((p) => (
            <article
              key={p.id}
              className={p.direction === "outgoing" ? "outgoing" : ""}
            >
              <header>
                <b>
                  {p.direction === "incoming"
                    ? c.name
                    : "Operator · queued demo reply"}
                </b>
                <time className="mono">{time(p.time)} UTC</time>
              </header>
              <RichText text={p.body} />
            </article>
          ))}
        </div>
        <div className="co-actions">
          <button
            className="co-btn co-primary"
            disabled={t.status === "archived"}
            onClick={() => open("reply", t.id)}
          >
            <Icon name="mail" size={13} />
            Reply to investor
          </button>
          <button className="co-btn" onClick={() => open("archive", t.id)}>
            {t.status === "archived"
              ? "Restore conversation"
              : "Archive conversation"}
          </button>
          <button
            className="co-link"
            disabled={t.status === "archived"}
            onClick={() =>
              void run(
                { kind: "threadState", id: t.id, action: "unread" },
                "Conversation marked unread locally",
              )
            }
          >
            Mark unread
          </button>
        </div>
      </div>
    );
  }
  function pager(kind: "inbox" | "log") {
    const page = kind === "inbox" ? safeInbox : safeLog,
      total = kind === "inbox" ? inboxPages : logPages,
      set = kind === "inbox" ? setInboxPage : setLogPage;
    return (
      <div className="co-pagination">
        <button
          aria-label={`Previous ${kind} page`}
          disabled={page === 1}
          onClick={() => set(page - 1)}
        >
          ←
        </button>
        <span>
          {page} / {total}
        </span>
        <button
          aria-label={`Next ${kind} page`}
          disabled={page === total}
          onClick={() => set(page + 1)}
        >
          →
        </button>
      </div>
    );
  }
  function resetInbox() {
    setInboxSearch("");
    setInboxStatus("all");
    setInboxPool("all");
    setInboxFrom(baseFrom);
    setInboxTo(baseDay);
    setInboxPage(1);
  }
  function resetLog() {
    setLogSearch("");
    setLogType("all");
    setLogChannel("all");
    setLogStatus("all");
    setLogFrom(baseFrom);
    setLogTo(baseDay);
    setLogPage(1);
  }
  async function exportReport() {
    setBusy(true);
    try {
      const rows = exportScope === "all" ? data.campaigns : logRows;
      if (exportFormat === "json")
        download(
          JSON.stringify(
            {
              mode: "demo",
              asOf: data.asOf,
              revision: data.revision,
              scope: exportScope,
              metrics,
              rows,
              deliveries: data.deliveries.filter((d) =>
                rows.some((r) => r.id === d.campaignId),
              ),
              audit: data.audit,
            },
            null,
            2,
          ),
          "application/json",
          "trademo-communications.json",
        );
      else if (exportFormat === "csv") {
        const quote = (v: unknown) => {
          let s = String(v ?? "");
          if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        };
        download(
          [
            [
              "id",
              "date_utc",
              "type",
              "subject",
              "unique_contacts",
              "channels",
              "state",
              "delivered_demo",
              "queued_demo",
              "failed_demo",
            ],
            ...rows.map((c) => {
              const st = campaignStats(data, c.id);
              return [
                c.id,
                c.createdAt,
                c.type,
                c.subject,
                st.contacts,
                c.channels.join("+"),
                c.status,
                st.delivered,
                st.queued,
                st.failed,
              ];
            }),
          ]
            .map((r) => r.map(quote).join(","))
            .join("\r\n"),
          "text/csv;charset=utf-8",
          "trademo-notifications.csv",
        );
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        let y = 22;
        const line = (text: string) => {
          doc.setFontSize(10);
          for (const textLine of doc.splitTextToSize(text, 175)) {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.text(textLine, 18, y);
            y += 7;
          }
          y += 2;
        };
        line("tradeMO / Communications / DEMO ONLY");
        line(`Base ${time(data.asOf)} UTC / revision ${data.revision}`);
        line(
          `${metrics.attempts} delivery rows; ${metrics.delivered} simulated delivered; ${metrics.queued} queued; ${metrics.failed} failed.`,
        );
        line(
          `Open ${percent(metrics.openRate)} / click ${percent(metrics.clickRate)} / response ${percent(metrics.responseRate)}; denominator: delivered contact/channel rows.`,
        );
        rows.forEach((c) =>
          line(`${c.id} / ${c.type} / ${c.status} / ${c.subject}`),
        );
        line(
          "Synthetic operational evidence only. No real messages delivered, no tracking provider connected. This is not a live communications audit.",
        );
        doc.save("trademo-communications-report.pdf");
      }
      setModal(null);
      pushToast({ tone: "success", title: "Communications report downloaded" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || mutation.isPending;
  const validMessage =
    messageSchema.safeParse(draft).success && plan.rows.length > 0;
  const activeTemplateContent = {
    subject: template.subject,
    body: template.body,
    audience: draft.audience,
  };
  function footer() {
    if (!modal) return null;
    const k = modal.kind;
    const back = (
      <button
        className="co-btn"
        disabled={disabled}
        onClick={() => (step ? setStep(step - 1) : close())}
      >
        {step ? "Back" : "Cancel"}
      </button>
    );
    const next = (fn: () => void, label = "Continue →", blocked = false) => (
      <button
        className="co-btn co-primary"
        disabled={disabled || blocked}
        onClick={fn}
      >
        {disabled ? "Working…" : label}
      </button>
    );
    if (k === "compose" || k === "announcement" || k === "schedule")
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void run(
                    {
                      kind: "compose",
                      content: draft,
                      mode: k === "schedule" ? "schedule" : "queue",
                      campaignType:
                        k === "announcement" ? "announcement" : queueType,
                      scheduledFor:
                        k === "schedule"
                          ? new Date(scheduleUTC + "Z").toISOString()
                          : null,
                      draftId,
                    },
                    k === "schedule"
                      ? "Scheduling request saved locally; no backend job created"
                      : "Demo outbox queued; no message delivered",
                  ),
            step < 2
              ? "Continue →"
              : k === "schedule"
                ? "Save local schedule"
                : "Queue demo messages",
            !validMessage ||
              (step === 2 && !confirmed) ||
              (k === "schedule" &&
                step > 0 &&
                (!scheduleUTC || Date.parse(scheduleUTC + "Z") <= clock)),
          )}
        </>
      );
    if (k === "templateEdit")
      return (
        <>
          {back}
          {next(
            () =>
              void run(
                {
                  kind: "template",
                  id: modal.id ?? null,
                  name: editName,
                  subject: editSubject,
                  body: editBody,
                  category: editCategory,
                },
                "Template saved in the local workspace",
              ),
            "Save template",
            editName.trim().length < 3 ||
              editSubject.trim().length < 3 ||
              editBody.trim().length < 10 ||
              !!contentIssues(editSubject, editBody).length,
          )}
        </>
      );
    if (k === "duplicate")
      return (
        <>
          {back}
          {next(
            () =>
              void run(
                { kind: "duplicate", id: template.id, name: editName },
                "Independent template copy created",
              ),
            "Create template copy",
            editName.trim().length < 3,
          )}
        </>
      );
    if (k === "test")
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void run(
                    {
                      kind: "test",
                      templateId: template.id,
                      contactId: previewContact,
                      target: testTarget,
                    },
                    "Test rendered locally; no email sent",
                    (next) =>
                      download(
                        JSON.stringify(next.tests[0], null, 2),
                        "application/json",
                        "communications-test-render.json",
                      ),
                  ),
            step < 2 ? "Continue →" : "Render & download test",
            !/^\S+@\S+\.\S+$/.test(testTarget) || (step === 2 && !confirmed),
          )}
        </>
      );
    if (k === "resend" || k === "retry")
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void run(
                    k === "resend"
                      ? { kind: "resend", id: campaign.id }
                      : { kind: "retry", id: campaign.id },
                    k === "resend"
                      ? "Unread follow-up queued locally; no delivery made"
                      : "Failed delivery rows requeued locally",
                  ),
            step < 2
              ? "Continue →"
              : k === "resend"
                ? "Queue unread follow-up"
                : "Retry demo deliveries",
            (k === "resend" && !campStats.unreadIds.length) ||
              (k === "retry" && !campStats.failed) ||
              (step === 2 && !confirmed),
          )}
        </>
      );
    if (k === "simulate")
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void run(
                    { kind: "simulate", id: campaign.id, outcome: scenario },
                    "Synthetic delivery evidence updated; no provider contacted",
                  ),
            step < 2 ? "Continue →" : "Apply local scenario",
            (scenario === "engage"
              ? !campStats.delivered
              : !campStats.queued) ||
              (step === 2 && !confirmed),
          )}
        </>
      );
    if (k === "reply")
      return (
        <>
          {back}
          {next(
            () =>
              void run(
                { kind: "reply", id: thread.id, body: replyBody },
                "Reply queued in demo outbox; no notification delivered",
              ),
            "Queue local reply",
            replyBody.trim().length < 10 ||
              !!contentIssues(thread.subject, replyBody).length ||
              !confirmed,
          )}
        </>
      );
    if (k === "archive")
      return (
        <>
          {back}
          {next(
            () =>
              void run(
                {
                  kind: "threadState",
                  id: thread.id,
                  action: thread.status === "archived" ? "restore" : "archive",
                },
                "Conversation state updated locally",
              ),
            thread.status === "archived" ? "Restore thread" : "Archive thread",
            !confirmed,
          )}
        </>
      );
    if (k === "preferences")
      return (
        <>
          {back}
          {next(
            () =>
              void run(
                { kind: "preferences", id: contact.id, consent: prefDraft },
                "Synthetic contact preferences saved locally",
              ),
            "Save demo preferences",
            !confirmed,
          )}
        </>
      );
    if (k === "channels")
      return (
        <>
          {back}
          {next(
            () =>
              void run(
                { kind: "channels", enabled: channelDraft },
                "Demo adapter flags saved; no provider connected",
              ),
            "Save demo channel flags",
            !confirmed,
          )}
        </>
      );
    if (k === "cancel")
      return (
        <>
          {back}
          {next(
            () =>
              void run(
                { kind: "cancel", id: campaign.id },
                "Unsent local item cancelled",
              ),
            "Cancel unsent item",
            !confirmed,
          )}
        </>
      );
    if (k === "export")
      return (
        <>
          {back}
          {next(
            () => (step < 2 ? setStep(step + 1) : void exportReport()),
            step < 2 ? "Continue →" : "Download report",
            step === 2 && !confirmed,
          )}
        </>
      );
    if (k === "reset")
      return (
        <>
          {back}
          {next(
            () => {
              reset();
              setDraft({
                subject: initial.templates[3].subject,
                body: initial.templates[3].body,
                audience: { type: "all", ids: [], packages: [] },
                channels: ["in_app", "email"],
                templateId: initial.templates[3].id,
                saveTemplate: false,
                templateName: "",
              });
              setQueueType("message");
              setComposerEpoch(composerEpoch + 1);
              setTemplateSearch("");
              setSelectedThread(null);
              setDraftId(null);
              resetInbox();
              resetLog();
              setModal(null);
              pushToast({
                tone: "info",
                title: "Communications restored to its base snapshot",
              });
            },
            "Reset local communications",
            !confirmed,
          )}
        </>
      );
    return (
      <button className="co-btn" onClick={close}>
        Close
      </button>
    );
  }
  return (
    <div className="co-canvas">
      <header className="co-header">
        <div>
          <div className="co-eyebrow">
            <span className="co-tag mono">D-10</span>OPERATOR CONSOLE / INVESTOR
            RELATIONS
          </div>
          <h1>Communications</h1>
          <p>
            Keep the conversation clear. Personalize investor updates, review
            every audience, and trace each delivery attempt.
          </p>
        </div>
        <div className="co-actions">
          <button className="co-btn" onClick={() => open("drafts")}>
            <Icon name="file" size={14} />
            Drafts ({drafts.length})
          </button>
          <button className="co-btn" onClick={() => open("scheduled")}>
            <Icon name="calendar" size={14} />
            Scheduled ({scheduled.length})
          </button>
          <button
            className="co-btn co-primary"
            onClick={() =>
              launch(
                { ...draft, audience: { type: "all", ids: [], packages: [] } },
                "announcement",
                "announcement",
              )
            }
          >
            <Icon name="mail" size={14} />
            New announcement
          </button>
        </div>
      </header>
      <div className="co-demo">
        <span className="co-demo-tag">DEMO COMMUNICATIONS</span>
        <span>
          Seeded engagement · local outbox only · no real messages or provider
          tracking
        </span>
        <span className="mono">
          BASE {time(data.asOf)} UTC · REV {data.revision}
        </span>
        <button className="co-link" onClick={() => open("channels")}>
          Channel controls ↗
        </button>
      </div>
      {error && !modal && (
        <div role="alert" className="co-error">
          {error}
        </div>
      )}
      <section className="co-metrics" aria-label="Communications overview">
        <Metric
          label="Unread conversations"
          value={unread}
          detail={`${data.threads.length} investor threads`}
          icon="mail"
          onClick={() => {
            setInboxStatus("unread");
            setInboxPage(1);
            document
              .getElementById("comms-inbox")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <Metric
          label="Delivery attempts"
          value={metrics.attempts}
          detail={`${metrics.queued} queued · ${period}-day window`}
          icon="activity"
          onClick={() => open("analytics")}
        />
        <Metric
          label="Email open rate"
          value={
            metrics.byChannel.find((c) => c.channel === "email")?.openRate ??
            null
          }
          rate
          detail="Unique opened / delivered email rows"
          icon="eye"
          onClick={() => open("analytics")}
        />
        <Metric
          label="Email click rate"
          value={
            metrics.byChannel.find((c) => c.channel === "email")?.clickRate ??
            null
          }
          rate
          detail="Unique clicked / delivered email rows"
          icon="target"
          onClick={() => open("analytics")}
        />
        <Metric
          label="In-app response rate"
          value={
            metrics.byChannel.find((c) => c.channel === "in_app")
              ?.responseRate ?? null
          }
          rate
          detail="Investor replies / delivered in-app rows"
          icon="users"
          onClick={() => open("analytics")}
        />
      </section>
      <section className="co-panel" id="comms-inbox">
        <div className="co-panel-head">
          <div>
            <span className="co-section-code">01 / CONVERSATIONS</span>
            <h2>Investor inbox</h2>
            <p>
              Select a conversation to mark it read locally. Replies enter a
              demo outbox, not a real delivery channel.
            </p>
          </div>
          <div className="co-actions">
            <span className="co-tag mono">{unread} UNREAD</span>
            <button
              className="co-btn"
              onClick={() => open("contact", data.contacts[0].id)}
            >
              Investor directory ↗
            </button>
          </div>
        </div>
        <div className="co-filterbar">
          <label className="co-search">
            <Icon name="search" size={14} />
            <input
              aria-label="Search conversations"
              placeholder="Investor, subject or thread ID…"
              value={inboxSearch}
              onChange={(e) => {
                setInboxSearch(e.target.value);
                setInboxPage(1);
              }}
            />
          </label>
          <select
            className="co-select"
            aria-label="Inbox status filter"
            value={inboxStatus}
            onChange={(e) => {
              setInboxStatus(e.target.value);
              setInboxPage(1);
            }}
          >
            <option value="all">All states</option>
            {["unread", "read", "replied", "archived"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="co-select"
            aria-label="Inbox package filter"
            value={inboxPool}
            onChange={(e) => {
              setInboxPool(e.target.value);
              setInboxPage(1);
            }}
          >
            <option value="all">All packages</option>
            {data.pools.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}
              </option>
            ))}
          </select>
          <label className="co-date">
            From / UTC
            <input
              type="date"
              aria-label="Inbox from date"
              value={inboxFrom}
              max={baseDay}
              onChange={(e) => {
                setInboxFrom(e.target.value);
                setInboxPage(1);
              }}
            />
          </label>
          <label className="co-date">
            To / UTC
            <input
              type="date"
              aria-label="Inbox to date"
              value={inboxTo}
              max={baseDay}
              onChange={(e) => {
                setInboxTo(e.target.value);
                setInboxPage(1);
              }}
            />
          </label>
          <button className="co-link" onClick={resetInbox}>
            Reset inbox filters
          </button>
        </div>
        {inboxInvalid && (
          <div className="co-error mx-3 mt-3" role="alert">
            Choose an ordered UTC date range.
          </div>
        )}
        <div className="co-inbox-layout">
          <div className="co-inbox-list">
            <div className="co-list-sort">
              <span>{inboxRows.length} conversations</span>
              <select
                className="co-select"
                aria-label="Inbox sort"
                value={`${inboxSort[0]?.id}: ${inboxSort[0]?.desc ? "desc" : "asc"}`}
                onChange={(e) => {
                  const [id, dir] = e.target.value.split(": ");
                  setInboxSort([{ id, desc: dir === "desc" }]);
                  setInboxPage(1);
                }}
              >
                {inboxTable.getAllLeafColumns().flatMap((c) => [
                  <option key={c.id + "d"} value={`${c.id}: desc`}>
                    {String(c.columnDef.header)} ↓
                  </option>,
                  <option key={c.id + "a"} value={`${c.id}: asc`}>
                    {String(c.columnDef.header)} ↑
                  </option>,
                ])}
              </select>
            </div>
            {visibleInbox.map(({ original: t }, i) => {
              const c = data.contacts.find((c) => c.id === t.contactId)!;
              return (
                <article
                  key={t.id}
                  className={`co-inbox-row ${t.status === "unread" ? "unread" : ""} ${selectedThread === t.id ? "selected" : ""}`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  <button
                    className="co-thread-select"
                    onClick={() => void selectConversation(t.id)}
                  >
                    <div>
                      <b>{c.name}</b>
                      <time className="mono">
                        {t.updatedAt.slice(11, 16)} UTC
                      </time>
                    </div>
                    <strong>{t.subject}</strong>
                    <p>{t.posts.at(-1)?.body}</p>
                    <span>
                      <Status value={t.status} />
                      <small className="mono">{t.pool}</small>
                    </span>
                  </button>
                  <button
                    className="co-inbox-inspect"
                    aria-label={`Inspect ${t.id}`}
                    onClick={() => void selectConversation(t.id, true)}
                  >
                    <Icon name="panelRight" size={14} />
                  </button>
                </article>
              );
            })}
            {!visibleInbox.length && (
              <div className="co-empty">
                <h3>No matching conversations</h3>
                <p>Try another investor, status or period.</p>
                <button className="co-btn" onClick={resetInbox}>
                  Restore inbox view
                </button>
              </div>
            )}
            <div className="co-panel-foot">
              <span>Inbox states are operator review flags</span>
              {pager("inbox")}
            </div>
          </div>
          <div className="co-thread-pane">
            <div className="co-pane-label">
              {selectedThread
                ? "SELECTED CONVERSATION"
                : "LATEST CONVERSATION PREVIEW"}
              <button
                className="co-link"
                onClick={() =>
                  void selectConversation(
                    (
                      data.threads.find((t) => t.id === selectedThread) ??
                      data.threads[0]
                    ).id,
                    true,
                  )
                }
              >
                Right inspector ↗
              </button>
            </div>
            {threadView(
              data.threads.find((t) => t.id === selectedThread) ??
                data.threads[0],
            )}
          </div>
        </div>
      </section>
      <section className="co-panel">
        <div className="co-panel-head">
          <div>
            <span className="co-section-code">02 / ANNOUNCEMENTS</span>
            <h2>Investor announcements</h2>
            <p>
              Read counts deduplicate contacts across channels. An email open is
              not proof of comprehension.
            </p>
          </div>
          <button
            className="co-btn"
            onClick={() => launch(draft, "announcement", "announcement")}
          >
            New announcement ↗
          </button>
        </div>
        <div className="co-announcement-grid">
          {announcements.slice(0, 6).map((c) => {
            const st = campaignStats(data, c.id);
            const followed = data.campaigns.some(
              (x) => x.parentId === c.id && x.status !== "cancelled",
            );
            return (
              <article className="co-announcement" key={c.id}>
                <div>
                  <span className="co-tag">
                    {c.parentId ? "FOLLOW-UP" : "ANNOUNCEMENT"}
                  </span>
                  <time className="mono">{c.createdAt.slice(0, 10)}</time>
                </div>
                <button
                  className="co-announcement-title"
                  onClick={() => open("announcementDetail", c.id)}
                >
                  {c.subject}
                </button>
                <div className="co-read-count">
                  <b className="mono">
                    {st.read}/{st.contacts}
                  </b>
                  <span>contacts with a seeded/simulated open</span>
                  <strong className="mono">
                    {st.contacts ? `${st.readPercent.toFixed(0)}%` : "N/A"}
                  </strong>
                </div>
                <div className="co-read-progress">
                  <span style={{ width: `${st.readPercent}%` }} />
                </div>
                <div className="co-announcement-footer">
                  <button
                    className="co-link"
                    onClick={() => open("announcementDetail", c.id)}
                  >
                    Read report ↗
                  </button>
                  <button
                    className="co-btn"
                    disabled={!st.unreadIds.length || followed}
                    title={
                      followed
                        ? "An unread follow-up already exists"
                        : "Recheck current consent before follow-up"
                    }
                    onClick={() => open("resend", c.id)}
                  >
                    {followed ? "Follow-up queued" : "Resend to unread"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {announcements.length > 6 && (
          <div className="co-panel-foot">
            <span>{announcements.length} announcements in full history</span>
            <button
              className="co-link"
              onClick={() => {
                setLogType("announcement");
                document
                  .getElementById("comms-log")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View every announcement in log ↗
            </button>
          </div>
        )}
      </section>
      <section className="co-panel" id="comms-compose">
        <div className="co-panel-head">
          <div>
            <span className="co-section-code">03 / COMPOSER</span>
            <h2>Compose investor update</h2>
            <p>
              Explicit recipient scope, consent-aware channels, safe formatting
              and personalized previews.
            </p>
          </div>
          <div className="co-actions">
            {draftId && <span className="co-tag mono">EDITING {draftId}</span>}
            <span className="co-tag">PREVIEW AVAILABLE BELOW EDITOR</span>
          </div>
        </div>
        <MessageComposer
          key={composerEpoch}
          data={data}
          defaults={draft}
          onAction={onCompose}
        />
      </section>
      <section className="co-panel">
        <div className="co-panel-head">
          <div>
            <span className="co-section-code">04 / TEMPLATE LIBRARY</span>
            <h2>Reusable message templates</h2>
            <p>
              Versioned content snapshots. Editing a template never rewrites
              previously queued communications.
            </p>
          </div>
          <div className="co-actions">
            <label className="co-search">
              <Icon name="search" size={13} />
              <input
                aria-label="Search templates"
                placeholder="Name or category…"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </label>
            <button className="co-btn" onClick={() => open("templateEdit")}>
              New template
            </button>
          </div>
        </div>
        <div className="co-template-grid">
          {data.templates
            .filter((t) =>
              `${t.name} ${t.category}`
                .toLowerCase()
                .includes(templateSearch.toLowerCase()),
            )
            .map((t) => (
              <article className="co-template" key={t.id}>
                <div>
                  <span className="co-tag">{t.category}</span>
                  <span className="mono">v{t.version}</span>
                </div>
                <h3>{t.name}</h3>
                <p>{t.subject}</p>
                <button
                  className="co-template-use"
                  onClick={() => loadTemplate(t.id)}
                >
                  Use in composer <Icon name="arrowRight" size={13} />
                </button>
                <div className="co-row-actions">
                  <button onClick={() => open("templateEdit", t.id)}>
                    Edit
                  </button>
                  <button onClick={() => open("templatePreview", t.id)}>
                    Preview
                  </button>
                  <button onClick={() => open("test", t.id)}>
                    Send test · demo
                  </button>
                  <button onClick={() => open("duplicate", t.id)}>
                    Duplicate
                  </button>
                  <button onClick={() => open("templateStats", t.id)}>
                    Stats
                  </button>
                </div>
              </article>
            ))}
        </div>
        {!data.templates.some((t) =>
          `${t.name} ${t.category}`
            .toLowerCase()
            .includes(templateSearch.toLowerCase()),
        ) && (
          <div className="co-empty">
            <h3>No matching templates</h3>
            <button className="co-btn" onClick={() => setTemplateSearch("")}>
              Clear template search
            </button>
          </div>
        )}
      </section>
      <section className="co-panel" id="comms-log">
        <div className="co-panel-head">
          <div>
            <span className="co-section-code">05 / NOTIFICATION EVIDENCE</span>
            <h2>Notification & outbox log</h2>
            <p>
              Each campaign retains recipient/channel rows. “Queued demo” is not
              delivered, and test renders are excluded.
            </p>
          </div>
          <button
            className="co-btn"
            onClick={() => {
              setExportFormat("csv");
              setExportScope("filtered");
              open("export");
            }}
          >
            Export log CSV ↗
          </button>
        </div>
        <div className="co-filterbar">
          <label className="co-search">
            <Icon name="search" size={13} />
            <input
              aria-label="Search notification log"
              placeholder="Subject or campaign ID…"
              value={logSearch}
              onChange={(e) => {
                setLogSearch(e.target.value);
                setLogPage(1);
              }}
            />
          </label>
          <select
            className="co-select"
            aria-label="Log type filter"
            value={logType}
            onChange={(e) => {
              setLogType(e.target.value);
              setLogPage(1);
            }}
          >
            <option value="all">All types</option>
            {[
              "announcement",
              "message",
              "report",
              "trade_result",
              "guardian",
            ].map((t) => (
              <option key={t} value={t}>
                {human(t)}
              </option>
            ))}
          </select>
          <select
            className="co-select"
            aria-label="Log channel filter"
            value={logChannel}
            onChange={(e) => {
              setLogChannel(e.target.value);
              setLogPage(1);
            }}
          >
            <option value="all">All channels</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {human(c)}
              </option>
            ))}
          </select>
          <select
            className="co-select"
            aria-label="Log state filter"
            value={logStatus}
            onChange={(e) => {
              setLogStatus(e.target.value);
              setLogPage(1);
            }}
          >
            <option value="all">All states</option>
            {["draft", "scheduled", "queued", "simulated", "cancelled"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
          <label className="co-date">
            From / UTC
            <input
              aria-label="Log from date"
              type="date"
              max={baseDay}
              value={logFrom}
              onChange={(e) => {
                setLogFrom(e.target.value);
                setLogPage(1);
              }}
            />
          </label>
          <label className="co-date">
            To / UTC
            <input
              aria-label="Log to date"
              type="date"
              max={baseDay}
              value={logTo}
              onChange={(e) => {
                setLogTo(e.target.value);
                setLogPage(1);
              }}
            />
          </label>
          <button className="co-link" onClick={resetLog}>
            Reset log filters
          </button>
        </div>
        {logInvalid && (
          <div role="alert" className="co-error mx-3">
            Choose an ordered date range.
          </div>
        )}
        <div className="table-responsive">
          <table className="table co-table co-responsive">
            <thead>
              <tr>
                {logTable.getHeaderGroups()[0]?.headers.map((h) => (
                  <th key={h.id}>
                    <button onClick={h.column.getToggleSortingHandler()}>
                      {String(h.column.columnDef.header)}{" "}
                      {h.column.getIsSorted() === "desc"
                        ? "↓"
                        : h.column.getIsSorted() === "asc"
                          ? "↑"
                          : "↕"}
                    </button>
                  </th>
                ))}
                <th>Delivery / actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map(({ original: c }) => {
                const st = campaignStats(data, c.id);
                return (
                  <tr key={c.id}>
                    <td data-label="Date / UTC" className="mono">
                      {time(c.createdAt)}
                    </td>
                    <td data-label="Type">{human(c.type)}</td>
                    <td data-label="Subject">
                      <button
                        className="co-link co-log-subject"
                        onClick={() => open("deliveryDetail", c.id)}
                      >
                        {c.subject}
                      </button>
                      <small className="co-cell-sub mono">{c.id}</small>
                    </td>
                    <td data-label="Recipients" className="mono">
                      {st.contacts} contacts
                      <small className="co-cell-sub">
                        {st.attempts} channel rows
                      </small>
                    </td>
                    <td data-label="Channels">
                      {c.channels.map(human).join(" + ")}
                    </td>
                    <td data-label="State">
                      <Status value={c.status} />
                    </td>
                    <td data-label="Delivery / actions">
                      <span className="co-delivery-counts mono">
                        D {st.delivered} · Q {st.queued} · F {st.failed}
                      </span>
                      <div className="co-row-actions">
                        <button onClick={() => open("deliveryDetail", c.id)}>
                          Inspect
                        </button>
                        {["queued", "simulated"].includes(c.status) && (
                          <button onClick={() => open("simulate", c.id)}>
                            Simulate
                          </button>
                        )}
                        {st.failed > 0 && (
                          <button onClick={() => open("retry", c.id)}>
                            Retry
                          </button>
                        )}
                        {["draft", "scheduled"].includes(c.status) && (
                          <button onClick={() => open("cancel", c.id)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleLogs.length && (
          <div className="co-empty">
            <h3>No notifications in this scope</h3>
            <button className="co-btn" onClick={resetLog}>
              Restore notification log
            </button>
          </div>
        )}
        <div className="co-panel-foot">
          <span>
            {logRows.length} campaigns · D/Q/F = simulated delivered / queued /
            failed · full UTC date scope
          </span>
          {pager("log")}
        </div>
      </section>
      <section>
        <div className="co-section-head">
          <h2>Communication workbench</h2>
          <span className="co-muted">06 / FOCUSED BULK WORKFLOWS</span>
        </div>
        <div className="co-workbench">
          <button
            onClick={() =>
              launch(
                { ...draft, audience: { type: "all", ids: [], packages: [] } },
                "message",
              )
            }
          >
            <Icon name="users" size={16} />
            Send to all investors
            <Icon name="arrowRight" size={13} />
          </button>
          <button
            onClick={() =>
              launch(
                {
                  ...draft,
                  audience: {
                    type: "packages",
                    ids: [],
                    packages: [data.pools[0].code],
                  },
                },
                "message",
              )
            }
          >
            <Icon name="package" size={16} />
            Send to package investors
            <Icon name="arrowRight" size={13} />
          </button>
          <button
            onClick={() => open("announcementDetail", announcements[0]?.id)}
          >
            <Icon name="refresh" size={16} />
            Review unread follow-ups
            <Icon name="arrowRight" size={13} />
          </button>
          <button
            onClick={() =>
              launch(
                {
                  ...draft,
                  subject: "Daily account review for {name}",
                  body: "Hi {name},\n\nYour recorded investment is {investment}; earnings are {earnings}. Available wallet: {wallet}. Review the live ledger before taking action. Returns and settlement timing are not guaranteed.",
                  templateId: null,
                },
                "report",
              )
            }
          >
            <Icon name="calendar" size={16} />
            Daily summary review
            <Icon name="arrowRight" size={13} />
          </button>
          <button
            onClick={() =>
              launch(
                {
                  ...draft,
                  subject: data.templates[3].subject,
                  body: data.templates[3].body,
                  templateId: data.templates[3].id,
                },
                "report",
              )
            }
          >
            <Icon name="chart" size={16} />
            Weekly report review
            <Icon name="arrowRight" size={13} />
          </button>
          <button onClick={() => open("channels")}>
            <Icon name="sliders" size={16} />
            Channel configuration
            <Icon name="arrowRight" size={13} />
          </button>
        </div>
      </section>
      <section className="co-panel">
        <div className="co-panel-head">
          <div>
            <span className="co-section-code">
              07 / COMMUNICATIONS ANALYTICS
            </span>
            <h2>Engagement & channel performance</h2>
            <p>
              Unique engagement flags per delivered contact/channel row, not
              page loads or total pixel events.
            </p>
          </div>
          <div className="co-actions">
            <select
              className="co-select"
              aria-label="Communications analytics period"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
            <button className="co-btn" onClick={() => open("analytics")}>
              Metric definitions ↗
            </button>
          </div>
        </div>
        <div className="co-channel-performance">
          {metrics.byChannel.map((c) => (
            <button
              key={c.channel}
              onClick={() => open("analytics", c.channel)}
            >
              <div>
                <b>{human(c.channel)}</b>
                <span className="mono">{c.delivered} delivered demo rows</span>
              </div>
              <div className="co-performance-track">
                <span style={{ width: `${c.openRate ?? 0}%` }} />
              </div>
              <dl>
                <div>
                  <dt>Open</dt>
                  <dd>{percent(c.openRate)}</dd>
                </div>
                <div>
                  <dt>Click</dt>
                  <dd>{percent(c.clickRate)}</dd>
                </div>
                <div>
                  <dt>Response</dt>
                  <dd>{percent(c.responseRate)}</dd>
                </div>
              </dl>
              {!c.delivered && (
                <small>No simulated delivered traffic in this window</small>
              )}
            </button>
          ))}
        </div>
        <div className="table-responsive">
          <table className="table co-table co-responsive">
            <thead>
              <tr>
                <th>Template</th>
                <th>Delivered</th>
                <th>Open rate</th>
                <th>Click rate</th>
                <th>Response rate</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byTemplate.map((t) => (
                <tr key={t.id}>
                  <td data-label="Template">{t.name}</td>
                  <td data-label="Delivered" className="mono">
                    {t.delivered}
                  </td>
                  <td data-label="Open rate" className="mono">
                    {percent(t.openRate)}
                  </td>
                  <td data-label="Click rate" className="mono">
                    {percent(t.clickRate)}
                  </td>
                  <td data-label="Response rate" className="mono">
                    {percent(t.responseRate)}
                  </td>
                  <td data-label="Evidence">
                    <button
                      className="co-link"
                      onClick={() => open("templateStats", t.id)}
                    >
                      Inspect ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <footer className="co-footer">
        <span>
          FRONTEND DEMO / no email provider, push service, Telegram bot or SMS
          gateway connected
        </span>
        <Link href="/dashboard/investors">Investor roster ↗</Link>
        <Link href="/dashboard/analytics">Performance analytics ↗</Link>
        <button className="co-link" onClick={() => open("audit")}>
          Session audit ↗
        </button>
        <button className="co-link" onClick={() => open("export")}>
          Export report ↗
        </button>
        <button className="co-link" onClick={() => open("reset")}>
          Reset workspace ↗
        </button>
      </footer>
      {modal && (
        <div className="co-local-layer">
          <DeskModalShell
            code="D10"
            eyebrow="COMMUNICATIONS / LOCAL DEMO"
            title={titles[modal.kind]}
            subtitle="Browser-session state only. Production requires authenticated write APIs, provider adapters and verified consent evidence."
            size="xl"
            onClose={close}
            steps={wizardSteps[modal.kind]}
            currentStep={step}
            footer={footer()}
          >
            {error && (
              <div role="alert" className="co-error mb-3">
                {error}
              </div>
            )}
            {(["compose", "announcement", "schedule"] as Kind[]).includes(
              modal.kind,
            ) && (
              <>
                {step === 0 && (
                  <>
                    <AudiencePicker
                      data={data}
                      value={draft.audience}
                      onChange={(audience) => setDraft({ ...draft, audience })}
                    />
                    <div className="co-channel-picker co-channel-inline">
                      {channels.map((c) => (
                        <label key={c} className="co-check">
                          <input
                            type="checkbox"
                            checked={draft.channels.includes(c)}
                            onChange={() =>
                              setDraft({
                                ...draft,
                                channels: draft.channels.includes(c)
                                  ? draft.channels.filter((x) => x !== c)
                                  : [...draft.channels, c],
                              })
                            }
                          />
                          {human(c)} ·{" "}
                          {data.channelConfig[c].enabled
                            ? "demo enabled"
                            : "disabled"}
                        </label>
                      ))}
                    </div>
                    {audienceReview()}
                  </>
                )}
                {step === 1 && (
                  <>
                    {modal.kind === "schedule" && (
                      <label className="co-field mb-3">
                        Requested execution time / UTC
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={scheduleUTC}
                          onChange={(e) => setScheduleUTC(e.target.value)}
                        />
                        <small>
                          Must be in the future and within 365 days. No
                          background scheduler runs here; a due item requires
                          explicit local dispatch.
                        </small>
                      </label>
                    )}
                    <ContentEditor
                      subject={draft.subject}
                      body={draft.body}
                      onChange={(p) => setDraft({ ...draft, ...p })}
                    />
                    {contentIssues(draft.subject, draft.body).map((s, i) => (
                      <p className="text-loss" key={i}>
                        {s}
                      </p>
                    ))}
                  </>
                )}
                {step === 2 && (
                  <>
                    {previewSelector()}
                    <MessagePreview
                      data={data}
                      content={draft}
                      contactId={previewContact}
                    />
                    {audienceReview()}
                    {modal.kind === "schedule" && (
                      <div className="co-note">
                        Requested UTC schedule:{" "}
                        <b>{scheduleUTC.replace("T", " ")}</b>. Existing consent
                        is rechecked when manually dispatching due items.
                      </div>
                    )}
                    {draft.saveTemplate && (
                      <p>
                        Also create template <b>{draft.templateName}</b>{" "}
                        atomically with this campaign.
                      </p>
                    )}
                    {consent()}
                  </>
                )}
                {!validMessage && (
                  <p className="co-error mt-3">
                    A valid subject (3–120), body (10–10,000), allowed
                    variables/links and at least one eligible recipient/channel
                    pair are required. Review audience and channel controls.
                  </p>
                )}
              </>
            )}
            {modal.kind === "preview" && (
              <>
                {previewSelector()}
                <MessagePreview
                  data={data}
                  content={draft}
                  contactId={previewContact}
                />
                <p className="co-note">
                  Rendered from your current submitted composer content. Subject
                  length and variable names are checked before queuing.
                </p>
              </>
            )}
            {modal.kind === "templateEdit" && (
              <>
                <label className="co-field mb-3">
                  Template name
                  <input
                    className="form-control"
                    maxLength={60}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </label>
                <label className="co-field mb-3">
                  Category
                  <input
                    className="form-control"
                    maxLength={40}
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                  />
                </label>
                <ContentEditor
                  subject={editSubject}
                  body={editBody}
                  onChange={(p) => {
                    if (p.subject !== undefined) setEditSubject(p.subject);
                    if (p.body !== undefined) setEditBody(p.body);
                  }}
                />
                {contentIssues(editSubject, editBody).map((s, i) => (
                  <p className="text-loss" key={i}>
                    {s}
                  </p>
                ))}
                <p className="co-note">
                  {modal.id
                    ? `Saving creates version ${template.version + 1}. Prior campaigns retain their subject/body snapshots.`
                    : "Create a reusable content template; this does not queue a message."}
                </p>
              </>
            )}
            {modal.kind === "duplicate" && (
              <>
                <p>
                  Create an independent version-1 copy of <b>{template.name}</b>
                  . Original content and existing delivery rows are unchanged.
                </p>
                <label className="co-field">
                  Unique name
                  <input
                    className="form-control"
                    value={editName}
                    maxLength={60}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </label>
              </>
            )}
            {modal.kind === "templatePreview" && (
              <>
                {previewSelector()}
                <MessagePreview
                  data={data}
                  content={activeTemplateContent}
                  contactId={previewContact}
                />
                <div className="co-actions mt-3">
                  <button
                    className="co-btn"
                    onClick={() => loadTemplate(template.id)}
                  >
                    Use in composer
                  </button>
                  <button
                    className="co-btn"
                    onClick={() => open("test", template.id)}
                  >
                    Test render wizard
                  </button>
                </div>
              </>
            )}
            {modal.kind === "test" && (
              <>
                {step === 0 && (
                  <>
                    {previewSelector()}
                    <label className="co-field">
                      Test destination label (no email is sent)
                      <input
                        type="email"
                        className="form-control"
                        value={testTarget}
                        onChange={(e) => setTestTarget(e.target.value)}
                      />
                    </label>
                    <p className="co-note">
                      Template: {template.name} v{template.version}. Destination
                      is retained in a local rendered-only JSON artifact; it
                      does not prove mailbox ownership or delivery.
                    </p>
                  </>
                )}
                {step === 1 && (
                  <MessagePreview
                    data={data}
                    content={activeTemplateContent}
                    contactId={previewContact}
                  />
                )}
                {step === 2 && (
                  <>
                    <p>
                      <b>Render an artifact addressed to {testTarget}</b>
                    </p>
                    <p>
                      The downloaded JSON contains the personalized
                      subject/body, synthetic investor ID, template ID and
                      render time. It is not a sent message and never enters
                      delivery analytics.
                    </p>
                    {consent(
                      "I understand this renders and downloads a local test artifact; no test email will be delivered.",
                    )}
                  </>
                )}
              </>
            )}
            {modal.kind === "templateStats" && (
              <>
                <h3 className="co-modal-heading">
                  {template.name} · {period}-day evidence
                </h3>
                <div className="co-review-totals">
                  <div>
                    <small>Delivered demo rows</small>
                    <b>{templateMetrics?.delivered ?? 0}</b>
                  </div>
                  <div>
                    <small>Open rate</small>
                    <b>{percent(templateMetrics?.openRate ?? null)}</b>
                  </div>
                  <div>
                    <small>Click rate</small>
                    <b>{percent(templateMetrics?.clickRate ?? null)}</b>
                  </div>
                </div>
                <p>
                  Response rate:{" "}
                  <b>{percent(templateMetrics?.responseRate ?? null)}</b>.
                  Engagement is per delivered contact/channel row; no provider
                  tracking is connected.
                </p>
                <h4 className="co-modal-heading">
                  Versioned campaign snapshots
                </h4>
                {data.campaigns
                  .filter((c) => c.templateId === template.id)
                  .map((c) => (
                    <div className="co-record" key={c.id}>
                      <div>
                        <b>{c.subject}</b>
                        <small>
                          {c.id} · {time(c.createdAt)} UTC
                        </small>
                      </div>
                      <Status value={c.status} />
                      <button
                        className="co-btn"
                        onClick={() => open("deliveryDetail", c.id)}
                      >
                        Delivery evidence
                      </button>
                    </div>
                  ))}
                {!data.campaigns.some((c) => c.templateId === template.id) && (
                  <p>
                    No queued campaign has used this template yet. Use it in the
                    composer to prepare a reviewed message.
                  </p>
                )}
                <div className="co-actions mt-3">
                  <button
                    className="co-btn"
                    onClick={() => loadTemplate(template.id)}
                  >
                    Use this template
                  </button>
                  <button
                    className="co-btn"
                    onClick={() => open("test", template.id)}
                  >
                    Render test
                  </button>
                </div>
                <h4 className="co-modal-heading mt-4">
                  Local test artifacts · excluded from analytics
                </h4>
                {data.tests
                  .filter((t) => t.templateId === template.id)
                  .map((t) => (
                    <div key={t.id} className="co-record">
                      <div>
                        <b>{t.target}</b>
                        <small>
                          {t.state} · {time(t.time)} UTC
                        </small>
                      </div>
                      <button
                        className="co-btn"
                        onClick={() =>
                          download(
                            JSON.stringify(t, null, 2),
                            "application/json",
                            `${t.id}.json`,
                          )
                        }
                      >
                        Download JSON
                      </button>
                    </div>
                  ))}
                {!data.tests.some((t) => t.templateId === template.id) && (
                  <p className="co-muted">
                    No local test artifacts have been rendered for this
                    template.
                  </p>
                )}
              </>
            )}
            {modal.kind === "announcementDetail" && (
              <>
                <h3 className="co-modal-heading">{campaign.subject}</h3>
                <div className="co-review-totals">
                  <div>
                    <small>Targeted distinct contacts</small>
                    <b>{campStats.contacts}</b>
                  </div>
                  <div>
                    <small>Any-channel opened</small>
                    <b>{campStats.read}</b>
                  </div>
                  <div>
                    <small>No observed open</small>
                    <b>{campStats.unreadIds.length}</b>
                  </div>
                </div>
                <RichText text={campaign.body} />
                <h4 className="co-modal-heading">
                  Deduplicated recipient evidence
                </h4>
                <div className="co-evidence-list">
                  {campaign.contactIds.map((id) => (
                    <div className="co-record" key={id}>
                      <b>{data.contacts.find((c) => c.id === id)?.name}</b>
                      <Status
                        value={
                          campStats.unreadIds.includes(id) ? "unread" : "read"
                        }
                      />
                      <button
                        className="co-link"
                        onClick={() => open("contact", id)}
                      >
                        Context ↗
                      </button>
                    </div>
                  ))}
                </div>
                <div className="co-actions mt-3">
                  <button
                    className="co-btn"
                    onClick={() => open("deliveryDetail", campaign.id)}
                  >
                    Channel delivery detail
                  </button>
                  <button
                    className="co-btn co-primary"
                    disabled={
                      !campStats.unreadIds.length ||
                      data.campaigns.some(
                        (c) =>
                          c.parentId === campaign.id &&
                          c.status !== "cancelled",
                      )
                    }
                    onClick={() => open("resend", campaign.id)}
                  >
                    Review unread follow-up
                  </button>
                </div>
              </>
            )}
            {(modal.kind === "resend" || modal.kind === "retry") && (
              <>
                {step === 0 && (
                  <>
                    <h3 className="co-modal-heading">{campaign.subject}</h3>
                    <p>
                      {modal.kind === "resend"
                        ? `${campStats.unreadIds.length} distinct contacts have no observed open on any channel. This includes undelivered targets; a missing open is not proof the message was unread.`
                        : `${campStats.failed} contact/channel rows failed. Retry retains the original delivery ID and increments attempts, without duplicating rows.`}
                    </p>
                    <div className="co-evidence-list">
                      {data.contacts
                        .filter((c) =>
                          modal.kind === "resend"
                            ? campStats.unreadIds.includes(c.id)
                            : data.deliveries.some(
                                (d) =>
                                  d.campaignId === campaign.id &&
                                  d.contactId === c.id &&
                                  d.status === "failed",
                              ),
                        )
                        .map((c) => (
                          <div className="co-record" key={c.id}>
                            <b>{c.name}</b>
                            <span>{c.status}</span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <h3 className="co-modal-heading">
                      Current eligibility is authoritative
                    </h3>
                    <p>
                      Current investor status, channel consent and demo adapter
                      flags are rechecked atomically.{" "}
                      {modal.kind === "retry"
                        ? "If any failed row is no longer eligible, the entire retry is blocked with a reason; change the synthetic flags only through the explicit controls."
                        : "Only eligible pairs from the unread contact subset are queued. At most one active follow-up per original announcement is allowed."}
                    </p>
                    <div className="co-evidence-list">
                      {audiencePlan(
                        data,
                        campaign,
                        modal.kind === "resend"
                          ? campStats.unreadIds
                          : undefined,
                      ).excluded.map((r, i) => (
                        <p key={i}>
                          {
                            data.contacts.find((c) => c.id === r.contactId)
                              ?.name
                          }{" "}
                          / {human(r.channel)} — {r.reason}
                        </p>
                      ))}
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <h3 className="co-modal-heading">
                      {modal.kind === "resend"
                        ? "Queue an unread follow-up"
                        : "Requeue failed local rows"}
                    </h3>
                    <p>
                      No message is delivered by this action. The resulting
                      queue must be separately simulated; production requires
                      idempotent write endpoints and provider evidence.
                    </p>
                    {consent()}
                  </>
                )}
              </>
            )}
            {modal.kind === "deliveryDetail" && (
              <>
                <h3 className="co-modal-heading">{campaign.subject}</h3>
                <div className="co-review-totals">
                  <div>
                    <small>Delivered demo</small>
                    <b>{campStats.delivered}</b>
                  </div>
                  <div>
                    <small>Queued demo</small>
                    <b>{campStats.queued}</b>
                  </div>
                  <div>
                    <small>Failed demo</small>
                    <b>{campStats.failed}</b>
                  </div>
                </div>
                <p className="co-muted mono">
                  {campaign.id} · {campaign.type} · {campaign.status} ·{" "}
                  {time(campaign.createdAt)} UTC
                </p>
                <details className="co-exclusions mb-3">
                  <summary>Stored subject/body snapshot and audience</summary>
                  <RichText text={campaign.body} />
                  <pre>
                    {JSON.stringify(
                      {
                        audience: campaign.audience,
                        channels: campaign.channels,
                        templateId: campaign.templateId,
                        parentId: campaign.parentId,
                        scheduledFor: campaign.scheduledFor,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
                <div className="table-responsive co-evidence-list">
                  <table className="table co-table">
                    <thead>
                      <tr>
                        <th>Investor / channel</th>
                        <th>State / attempts</th>
                        <th>Delivery / UTC</th>
                        <th>Engagement evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deliveries
                        .filter((d) => d.campaignId === campaign.id)
                        .map((d) => (
                          <tr key={d.id}>
                            <td>
                              <b>
                                {
                                  data.contacts.find(
                                    (c) => c.id === d.contactId,
                                  )?.name
                                }
                              </b>
                              <small className="co-cell-sub">
                                {human(d.channel)} · {d.id}
                              </small>
                            </td>
                            <td>
                              <Status value={d.status} />
                              <small className="co-cell-sub">
                                {d.attempts} attempt(s)
                                {d.failure ? ` · ${human(d.failure)}` : ""}
                              </small>
                            </td>
                            <td className="mono">
                              {d.deliveredAt
                                ? time(d.deliveredAt)
                                : "Not delivered"}
                            </td>
                            <td>
                              {d.openedAt ? "Opened" : "No open"} ·{" "}
                              {d.clickedAt ? "Clicked" : "No click"} ·{" "}
                              {d.repliedAt ? "Investor replied" : "No reply"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!campStats.attempts && (
                  <p className="co-note">
                    This unsent/cancelled item has no delivery rows. Drafts and
                    schedules are excluded from engagement denominators.
                  </p>
                )}
                <div className="co-actions mt-3">
                  {["queued", "simulated"].includes(campaign.status) && (
                    <button
                      className="co-btn"
                      onClick={() => open("simulate", campaign.id)}
                    >
                      Delivery simulator
                    </button>
                  )}
                  {campStats.failed > 0 && (
                    <button
                      className="co-btn"
                      onClick={() => open("retry", campaign.id)}
                    >
                      Retry failed rows
                    </button>
                  )}
                  {["draft", "scheduled"].includes(campaign.status) && (
                    <button
                      className="co-btn"
                      onClick={() => open("cancel", campaign.id)}
                    >
                      Cancel unsent item
                    </button>
                  )}
                  <button
                    className="co-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(
                          {
                            campaign,
                            deliveries: data.deliveries.filter(
                              (d) => d.campaignId === campaign.id,
                            ),
                          },
                          null,
                          2,
                        ),
                        "application/json",
                        `${campaign.id}-evidence.json`,
                      )
                    }
                  >
                    Download evidence JSON
                  </button>
                </div>
              </>
            )}
            {modal.kind === "simulate" && (
              <>
                {step === 0 && (
                  <>
                    <h3 className="co-modal-heading">
                      Synthetic scenario, not a live send
                    </h3>
                    <label className="co-field">
                      Scenario
                      <select
                        className="form-select"
                        value={scenario}
                        onChange={(e) =>
                          setScenario(e.target.value as typeof scenario)
                        }
                      >
                        <option value="deliver">
                          Deliver eligible queued demo rows
                        </option>
                        <option value="fail">Fail queued demo rows</option>
                        <option value="engage">
                          Generate synthetic engagement on delivered rows
                        </option>
                      </select>
                    </label>
                    <p className="co-note">
                      A local exercise to inspect state transitions. No network
                      call to a messaging provider is made.
                    </p>
                  </>
                )}
                {step === 1 && (
                  <>
                    <h3 className="co-modal-heading">{campaign.subject}</h3>
                    <div className="co-review-totals">
                      <div>
                        <small>Queued</small>
                        <b>{campStats.queued}</b>
                      </div>
                      <div>
                        <small>Delivered</small>
                        <b>{campStats.delivered}</b>
                      </div>
                      <div>
                        <small>Failed</small>
                        <b>{campStats.failed}</b>
                      </div>
                    </div>
                    <p>
                      {scenario === "engage"
                        ? "Only delivered rows can be opened, clicked or replied to. Clicks require an open; reply evidence is restricted to in-app rows. This does not fabricate a real inbound thread message."
                        : "Only queued rows are processed. Delivery rechecks account status, enabled adapter and channel consent; newly ineligible pairs fail with eligibility_changed."}
                    </p>
                  </>
                )}
                {step === 2 && (
                  <>
                    <p>
                      You are applying <b>{scenario}</b> to <b>{campaign.id}</b>
                      . Analytics will include these explicitly synthetic
                      observations.
                    </p>
                    {consent(
                      "I understand this generates synthetic evidence only and does not prove real delivery or engagement.",
                    )}
                  </>
                )}
              </>
            )}
            {modal.kind === "reply" && (
              <>
                <h3 className="co-modal-heading">Re: {thread.subject}</h3>
                <p>
                  To{" "}
                  {data.contacts.find((c) => c.id === thread.contactId)?.name} ·
                  in-app demo channel
                </p>
                <label className="co-field mb-3">
                  Reply body
                  <textarea
                    className="form-control"
                    rows={6}
                    minLength={10}
                    maxLength={10000}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />
                </label>
                {contentIssues(thread.subject, replyBody).map((m, i) => (
                  <p className="text-loss" key={i}>
                    {m}
                  </p>
                ))}
                {consent(
                  "Queue this reply locally. “Replied” is an operator inbox flag, not proof of investor receipt or an investor response.",
                )}
              </>
            )}
            {modal.kind === "thread" && threadView(thread)}
            {modal.kind === "archive" && (
              <>
                <h3 className="co-modal-heading">{thread.subject}</h3>
                <p>
                  {thread.status === "archived"
                    ? "Restore this conversation to the read inbox. Existing incoming messages and queued replies are retained."
                    : "Archive hides the conversation from active review. All messages and delivery evidence remain available under the archived filter."}
                </p>
                {consent(
                  "I confirm this local inbox-state change; it does not delete messages or cancel queued replies.",
                )}
              </>
            )}
            {modal.kind === "contact" && (
              <>
                <label className="co-field mb-3">
                  Investor directory
                  <select
                    className="form-select"
                    value={contact.id}
                    onChange={(e) => open("contact", e.target.value)}
                  >
                    {data.contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.id}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="co-dossier">
                  <div>
                    <small>Investor / synthetic source</small>
                    <b>{contact.name}</b>
                    <span>{contact.email}</span>
                    <Status value={contact.status} />
                  </div>
                  <div>
                    <small>Package context</small>
                    <b>{contact.packages.join(" + ") || "No active package"}</b>
                    <span>Start: {contact.packageStartDate}</span>
                  </div>
                  <div>
                    <small>Recorded investment / earnings</small>
                    <b>
                      {money(contact.investment)} / {money(contact.earnings)}
                    </b>
                    <span>Available wallet {money(contact.wallet)}</span>
                  </div>
                </div>
                <div className="co-channel-inline co-channel-picker">
                  {channels.map((c) => (
                    <div className="co-record" key={c}>
                      <b>{human(c)}</b>
                      <span>
                        {contact.consent[c]
                          ? "Synthetic consent present"
                          : "No consent"}{" "}
                        ·{" "}
                        {data.channelConfig[c].enabled
                          ? "demo enabled"
                          : "disabled"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="co-actions mt-3">
                  <button
                    className="co-btn"
                    onClick={() => open("preferences", contact.id)}
                  >
                    Edit synthetic preferences
                  </button>
                  <button
                    className="co-btn co-primary"
                    onClick={() =>
                      launch({
                        ...draft,
                        audience: {
                          type: "individual",
                          ids: [contact.id],
                          packages: [],
                        },
                      })
                    }
                  >
                    Compose individual message
                  </button>
                  <Link className="co-btn" href="/dashboard/investors">
                    Investor management ↗
                  </Link>
                </div>
                <p className="co-note">
                  Earnings are not settled wallet cash. ROI variables are
                  earnings/investment; no-investment contacts receive N/A.
                  Figures come from the independent D-6 demo roster.
                </p>
              </>
            )}
            {modal.kind === "preferences" && (
              <>
                <h3 className="co-modal-heading">{contact.name}</h3>
                <p>
                  These toggles change synthetic local consent flags for
                  workflow testing. They are not evidence of investor
                  authorization.
                </p>
                <div className="co-channel-picker">
                  {channels.map((c) => (
                    <label className="co-check" key={c}>
                      <input
                        type="checkbox"
                        checked={prefDraft[c]}
                        onChange={(e) =>
                          setPrefDraft({ ...prefDraft, [c]: e.target.checked })
                        }
                      />
                      {human(c)}
                    </label>
                  ))}
                </div>
                {consent(
                  "I understand production consent must be investor-authorized, timestamped and auditable; an operator cannot grant it on an investor’s behalf.",
                )}
              </>
            )}
            {modal.kind === "channels" && (
              <>
                <h3 className="co-modal-heading">
                  Provider-free adapter controls
                </h3>
                <p>
                  Enable only a local simulator path. No API keys, phone
                  numbers, Telegram bot tokens or provider credentials are
                  requested or stored.
                </p>
                <div className="co-channel-picker">
                  {channels.map((c) => (
                    <label className="co-check" key={c}>
                      <input
                        type="checkbox"
                        checked={channelDraft[c]}
                        onChange={(e) =>
                          setChannelDraft({
                            ...channelDraft,
                            [c]: e.target.checked,
                          })
                        }
                      />
                      <span>
                        {human(c)}
                        <small>{data.channelConfig[c].label}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {consent(
                  "I understand these are demo flags, not connected services; per-investor consent is still enforced.",
                )}
              </>
            )}
            {modal.kind === "drafts" && (
              <>
                <p>
                  Saved subject/body/audience snapshots. Loading a draft edits
                  it in the main composer; saving updates that same draft
                  instead of duplicating it.
                </p>
                {drafts.map((c) => (
                  <div className="co-record" key={c.id}>
                    <div>
                      <b>{c.subject}</b>
                      <small>
                        {c.id} · {time(c.createdAt)} UTC ·{" "}
                        {c.channels.map(human).join(" + ")}
                      </small>
                    </div>
                    <button className="co-btn" onClick={() => loadDraft(c)}>
                      Load draft
                    </button>
                    <button
                      className="co-link"
                      onClick={() => open("cancel", c.id)}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
                {!drafts.length && (
                  <div className="co-empty">
                    <h3>No saved drafts</h3>
                    <p>
                      Prepare content in the composer, then choose Save draft.
                    </p>
                    <button
                      className="co-btn"
                      onClick={() => {
                        close();
                        document
                          .getElementById("comms-compose")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Open composer
                    </button>
                  </div>
                )}
              </>
            )}
            {modal.kind === "scheduled" && (
              <>
                <p>
                  There is no background job here. A due request can be
                  explicitly moved into the demo outbox after current audience
                  consent is revalidated.
                </p>
                {scheduled.map((c) => (
                  <div className="co-record" key={c.id}>
                    <div>
                      <b>{c.subject}</b>
                      <small>
                        {c.scheduledFor
                          ? time(c.scheduledFor)
                          : "Not scheduled"}{" "}
                        UTC · {c.id}
                      </small>
                    </div>
                    <button
                      className="co-btn"
                      onClick={() => open("deliveryDetail", c.id)}
                    >
                      Inspect
                    </button>
                    <button
                      className="co-btn"
                      disabled={
                        !c.scheduledFor || Date.parse(c.scheduledFor) > clock
                      }
                      onClick={() => {
                        setDraft({ ...c });
                        setQueueType(
                          c.type === "announcement"
                            ? "announcement"
                            : "message",
                        );
                        setModal({ kind: "deliveryDetail", id: c.id });
                        setError("");
                      }}
                    >
                      Review due item
                    </button>
                    <button
                      className="co-link"
                      onClick={() => open("cancel", c.id)}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
                {!scheduled.length && (
                  <div className="co-empty">
                    <h3>No pending schedules</h3>
                    <button
                      className="co-btn"
                      onClick={() => launch(draft, "message", "schedule")}
                    >
                      Prepare scheduled message
                    </button>
                  </div>
                )}
              </>
            )}
            {modal.kind === "deliveryDetail" &&
              campaign.status === "scheduled" && (
                <div className="co-note">
                  <p>
                    Dispatch is available only for a due UTC request. It creates
                    local queued rows, never a provider send.
                  </p>
                  <button
                    className="co-btn co-primary"
                    disabled={
                      !campaign.scheduledFor ||
                      Date.parse(campaign.scheduledFor) > clock
                    }
                    onClick={() =>
                      void run(
                        { kind: "dispatch", id: campaign.id },
                        "Due item queued locally after consent revalidation",
                      )
                    }
                  >
                    Dispatch due request into demo queue
                  </button>
                </div>
              )}
            {modal.kind === "cancel" && (
              <>
                <h3 className="co-modal-heading">{campaign.subject}</h3>
                <p>
                  This {campaign.status} has not entered delivery processing.
                  Cancellation retains an audit record and does not delete its
                  snapshot. Queued or delivered messages cannot be recalled by
                  this workflow.
                </p>
                {consent("I confirm cancelling this unsent local item.")}
              </>
            )}
            {modal.kind === "export" && (
              <>
                {step === 0 && (
                  <label className="co-field">
                    Report format
                    <select
                      className="form-select"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                    >
                      <option value="csv">
                        Campaign CSV — formula-safe cells
                      </option>
                      <option value="json">
                        JSON — campaigns, evidence, metrics and local audit
                      </option>
                      <option value="pdf">
                        PDF — readable communication summary
                      </option>
                    </select>
                  </label>
                )}
                {step === 1 && (
                  <>
                    <label className="co-field">
                      Campaign scope
                      <select
                        className="form-select"
                        value={exportScope}
                        onChange={(e) => setExportScope(e.target.value)}
                      >
                        <option value="filtered">
                          Current log filters ({logRows.length} campaigns)
                        </option>
                        <option value="all">
                          All campaign history ({data.campaigns.length}{" "}
                          campaigns)
                        </option>
                      </select>
                    </label>
                    <p className="co-note">
                      All filtered rows are exported, not just the visible page.
                      Engagement metrics use the selected {period}-day analytics
                      window regardless of campaign scope. Drafts/schedules have
                      no delivery rows.
                    </p>
                  </>
                )}
                {step === 2 && (
                  <>
                    <h3 className="co-modal-heading">
                      {exportFormat.toUpperCase()} ·{" "}
                      {exportScope === "all"
                        ? data.campaigns.length
                        : logRows.length}{" "}
                      campaigns
                    </h3>
                    <p>
                      This is a local synthetic operational report, not a
                      provider delivery certificate. JSON may contain synthetic
                      personal context; do not use this export design for live
                      personal data without authorization and retention
                      controls.
                    </p>
                    {consent(
                      "I understand the export contains demo data and will download to my browser.",
                    )}
                  </>
                )}
              </>
            )}
            {modal.kind === "analytics" && (
              <>
                <h3 className="co-modal-heading">
                  {period}-day observation window · anchored {baseDay} UTC
                </h3>
                <div className="co-review-totals">
                  <div>
                    <small>Delivered demo rows</small>
                    <b>{metrics.delivered}</b>
                  </div>
                  <div>
                    <small>Opened rows</small>
                    <b>{metrics.opens}</b>
                  </div>
                  <div>
                    <small>Clicked / replied rows</small>
                    <b>
                      {metrics.clicks} / {metrics.replies}
                    </b>
                  </div>
                </div>
                <ul className="co-methodology">
                  <li>
                    <b>Attempt unit:</b> one unique campaign / investor /
                    channel row. Retries increase its attempt counter, not its
                    row count.
                  </li>
                  <li>
                    <b>Open rate:</b> delivered rows with one or more opens ÷
                    delivered rows.
                  </li>
                  <li>
                    <b>Click rate:</b> delivered rows with one or more clicks ÷
                    delivered rows. A click requires an open.
                  </li>
                  <li>
                    <b>Response rate:</b> delivered rows with an investor reply
                    ÷ delivered rows. An operator’s outbound reply never counts
                    as investor engagement.
                  </li>
                  <li>
                    <b>Announcement read rate:</b> contacts with an observed
                    open on any channel ÷ targeted contacts represented in
                    delivery rows. Contacts are deduplicated across channels.
                  </li>
                  <li>
                    <b>No observations:</b> N/A, not zero percent. Drafts, tests
                    and unprocessed schedules never enter delivery denominators.
                  </li>
                  <li>
                    <b>Window:</b> inclusive UTC calendar days ending on the
                    source snapshot date; delivery-row creation time determines
                    inclusion.
                  </li>
                  <li>
                    <b>Evidence limitation:</b> all delivery and engagement
                    observations are seeded or explicitly simulated. There is no
                    provider or tracking service connected.
                  </li>
                </ul>
                <div className="co-actions">
                  <button className="co-btn" onClick={() => open("export")}>
                    Export evidence
                  </button>
                  <button className="co-btn" onClick={() => open("audit")}>
                    Inspect local audit
                  </button>
                </div>
              </>
            )}
            {modal.kind === "audit" && (
              <>
                <p>
                  Append-only session evidence for local commands.
                  Reloading/resetting returns this feature to its base snapshot.
                  No production audit or cross-page state is mutated.
                </p>
                <div className="co-evidence-list">
                  {data.audit.map((a) => (
                    <div className="co-record" key={a.id}>
                      <div>
                        <b>
                          {human(a.action)} · {a.reference}
                        </b>
                        <small className="mono">
                          {time(a.time)} UTC · revision {a.revision}
                        </small>
                        <p>{a.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="co-btn mt-3"
                  onClick={() =>
                    download(
                      JSON.stringify(data.audit, null, 2),
                      "application/json",
                      "comms-session-audit.json",
                    )
                  }
                >
                  Download session audit
                </button>
              </>
            )}
            {modal.kind === "reset" && (
              <>
                <p>
                  Discard this session’s communications drafts, template edits,
                  adapter flags, synthetic consent, outbox transitions and
                  simulation evidence, then restore the original seeded
                  workspace. Other dashboard modules are not affected.
                </p>
                {consent(
                  "I confirm discarding local communications changes; there is no undo.",
                )}
              </>
            )}
          </DeskModalShell>
        </div>
      )}
      {drawer && inspected && (
        <div
          className="co-local-layer co-drawer-layer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <aside
            className="co-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Communication right inspector"
          >
            <header>
              <div>
                <span className="co-section-code">
                  D10 / COMMUNICATION INSPECTOR
                </span>
                <h2>
                  {
                    data.contacts.find((c) => c.id === inspected.contactId)
                      ?.name
                  }
                </h2>
              </div>
              <button
                className="co-icon-button"
                aria-label="Close communications inspector"
                onClick={close}
              >
                <Icon name="close" size={17} />
              </button>
            </header>
            <nav aria-label="Inspector tabs">
              {["conversation", "context", "evidence"].map((t) => (
                <button
                  key={t}
                  aria-pressed={drawerTab === t}
                  className={drawerTab === t ? "active" : ""}
                  onClick={() => setDrawerTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="co-drawer-body">
              {drawerTab === "conversation" && threadView(inspected)}
              {drawerTab === "context" &&
                (() => {
                  const c = data.contacts.find(
                    (c) => c.id === inspected.contactId,
                  )!;
                  return (
                    <>
                      <div className="co-dossier">
                        <div>
                          <small>Contact</small>
                          <b>{c.email}</b>
                          <Status value={c.status} />
                        </div>
                        <div>
                          <small>Package context</small>
                          <b>{c.packages.join(" + ") || "No active package"}</b>
                          <span>Start {c.packageStartDate}</span>
                        </div>
                        <div>
                          <small>Capital / earnings / available wallet</small>
                          <b>
                            {money(c.investment)} / {money(c.earnings)} /{" "}
                            {money(c.wallet)}
                          </b>
                        </div>
                      </div>
                      <button
                        className="co-btn mt-3"
                        onClick={() => open("preferences", c.id)}
                      >
                        Review synthetic preferences
                      </button>
                      <Link className="co-btn mt-3" href="/dashboard/investors">
                        Open investor management ↗
                      </Link>
                    </>
                  );
                })()}
              {drawerTab === "evidence" && (
                <>
                  <p>
                    Queued/delivered evidence involving this investor. Inbound
                    inbox messages are independent of synthetic outbound
                    engagement.
                  </p>
                  {data.campaigns
                    .filter((c) => c.contactIds.includes(inspected.contactId))
                    .map((c) => (
                      <div className="co-record" key={c.id}>
                        <div>
                          <b>{c.subject}</b>
                          <small>
                            {c.id} · {c.status}
                          </small>
                        </div>
                        <button
                          className="co-link"
                          onClick={() => open("deliveryDetail", c.id)}
                        >
                          Inspect ↗
                        </button>
                      </div>
                    ))}
                </>
              )}
            </div>
            <footer>
              <button
                className="co-btn"
                onClick={() => open("contact", inspected.contactId)}
              >
                Investor context
              </button>
              <button
                className="co-btn co-primary"
                onClick={() => open("reply", inspected.id)}
              >
                Reply review
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
export function CommsPage({
  operatorBundle,
  initial,
}: {
  operatorBundle: OperatorBundleProps;
  initial: CommsBundle;
}) {
  return (
    <OperatorShell bundle={operatorBundle} rootClass="page-dashboard-comms">
      {() => <CommunicationsDesk initial={initial} />}
    </OperatorShell>
  );
}
