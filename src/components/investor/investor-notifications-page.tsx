"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon } from "@/components/icons";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import {
  DEFAULT_FILTERS,
  MAX_EXPORTS,
  MAX_RULES,
  PAGE_SIZE,
  categoryLabel,
  categoryShort,
  categoryCounts,
  channelLabel,
  clockShort,
  csvOf,
  dayLabel,
  exportMatrix,
  filterInbox,
  groupByDay,
  inboxSummary,
  isSnoozed,
  levelLabel,
  levelTone,
  money,
  muteDraftError,
  paginate,
  paymentAlertLabel,
  paymentTotals,
  pct,
  poolUpdateLabel,
  preferencesDraftError,
  relativeTo,
  round2,
  securityKindLabel,
  securityPosture,
  shortDateOf,
  signedMoney,
  supportDraftError,
  tradeStats,
  type ActiveSession,
  type CategoryTab,
  type DeliveryChannel,
  type ExportFormat,
  type ExportScope,
  type InboxRule,
  type InvestorNotification,
  type MuteDuration,
  type NotificationCategory,
  type NotificationCommand,
  type NotificationExport,
  type NotificationFilters,
  type NotificationPreferences,
  type NotificationWorkspace,
  type PaymentAlertRow,
  type PoolUpdateRow,
  type SecurityRow,
  type SupportTopic,
  type TradeActivityRow,
} from "@/lib/investor/notifications";
import { useNotifications } from "@/lib/investor/use-notifications";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  InvestorShell,
  type InvestorDrawerTab,
  type InvestorNavKey,
  type InvestorQuickAction,
} from "./investor-shell";

/* ── Dialog registry ── */

type Kind =
  | "markReadWizard"
  | "markAllWizard"
  | "preferencesWizard"
  | "ruleWizard"
  | "exportWizard"
  | "supportWizard"
  | "snoozeWizard"
  | "notificationDetail"
  | "tradeDetail"
  | "poolUpdateDetail"
  | "paymentDetail"
  | "securityDetail"
  | "sessions"
  | "revokeSession"
  | "deliveryLog"
  | "rulesList"
  | "preferencesSummary"
  | "quietHours"
  | "channelMatrix"
  | "digestPreview"
  | "pinnedList"
  | "snoozedList"
  | "exportHistory"
  | "securityPosture"
  | "auditTrail"
  | "resetInbox"
  | "badgeSettings"
  | "boundaries";

const titles: Record<Kind, string> = {
  markReadWizard: "Mark notifications read",
  markAllWizard: "Clear the unread queue",
  preferencesWizard: "Notification preferences",
  ruleWizard: "New inbox rule",
  exportWizard: "Export the log",
  supportWizard: "Ask the desk",
  snoozeWizard: "Snooze notifications",
  notificationDetail: "Notification detail",
  tradeDetail: "Trade notification",
  poolUpdateDetail: "Pool update",
  paymentDetail: "Payment alert",
  securityDetail: "Security event",
  sessions: "Where you are signed in",
  revokeSession: "Revoke this session",
  deliveryLog: "Delivery log",
  rulesList: "Inbox rules",
  preferencesSummary: "Preferences in force",
  quietHours: "Quiet hours",
  channelMatrix: "Channel matrix",
  digestPreview: "Digest preview",
  pinnedList: "Pinned notifications",
  snoozedList: "Snoozed notifications",
  exportHistory: "Export history",
  securityPosture: "Security posture",
  auditTrail: "Desk audit trail",
  resetInbox: "Reset the inbox",
  badgeSettings: "Badge & sound",
  boundaries: "What this desk can and cannot do",
};

const wizardSteps: Partial<Record<Kind, readonly string[]>> = {
  markReadWizard: ["Select", "Confirm"],
  markAllWizard: ["Scope", "Confirm"],
  preferencesWizard: ["Channels", "Digest & quiet", "Confirm"],
  ruleWizard: ["Rule", "Confirm"],
  exportWizard: ["Scope", "Format", "Confirm"],
  supportWizard: ["Topic", "Message", "Confirm"],
  snoozeWizard: ["Duration", "Confirm"],
};

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  markReadWizard: "lg",
  markAllWizard: "md",
  preferencesWizard: "lg",
  ruleWizard: "md",
  exportWizard: "md",
  supportWizard: "md",
  snoozeWizard: "sm",
  notificationDetail: "lg",
  tradeDetail: "md",
  poolUpdateDetail: "md",
  paymentDetail: "md",
  securityDetail: "md",
  sessions: "lg",
  revokeSession: "sm",
  deliveryLog: "lg",
  rulesList: "lg",
  preferencesSummary: "md",
  quietHours: "sm",
  channelMatrix: "lg",
  digestPreview: "md",
  pinnedList: "md",
  snoozedList: "md",
  exportHistory: "md",
  securityPosture: "lg",
  auditTrail: "lg",
  resetInbox: "sm",
  badgeSettings: "sm",
  boundaries: "lg",
};

const quickActions: InvestorQuickAction[] = [
  { key: "markall", label: "Mark all read", short: "Mark all", icon: "check" },
  { key: "rules", label: "Inbox rules", short: "Rules", icon: "filter" },
  { key: "prefs", label: "Preferences", short: "Prefs", icon: "sliders" },
  { key: "export", label: "Export log", short: "Export", icon: "download" },
  { key: "sessions", label: "Signed-in devices", short: "Devices", icon: "shield" },
  { key: "support", label: "Ask the desk", short: "Support", icon: "send" },
];

const sections = [
  { key: "inbox", label: "Unread", id: "wa-inbox" },
  { key: "trades", label: "Trade activity", id: "wa-trades" },
  { key: "pools", label: "Pool updates", id: "wa-pools" },
  { key: "payments", label: "Payments", id: "wa-payments" },
  { key: "security", label: "Security", id: "wa-security" },
  { key: "delivery", label: "Delivery", id: "wa-delivery" },
] as const;

const categories: CategoryTab[] = ["all", "trade", "pool", "payment", "security"];

const categoryIcon: Record<string, "activity" | "pool" | "wallet" | "shield"> = {
  trade: "activity",
  pool: "pool",
  payment: "wallet",
  security: "shield",
};

const levelIcon: Record<string, "check" | "alert" | "info"> = {
  success: "check",
  warning: "alert",
  critical: "alert",
  info: "info",
};

const ranges: { key: NotificationFilters["range"]; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

const sorts: { key: NotificationFilters["sort"]; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "unread", label: "Unread first" },
];

const muteDurations: MuteDuration[] = ["1h", "8h", "24h", "forever"];

const muteLabel = (duration: MuteDuration) =>
  duration === "1h"
    ? "1 hour"
    : duration === "8h"
      ? "8 hours"
      : duration === "24h"
        ? "24 hours"
        : "until further notice";

const channels: DeliveryChannel[] = ["inApp", "email", "push", "sms"];

const exportScopes: { key: ExportScope; label: string; hint: string }[] = [
  { key: "inbox", label: "Inbox", hint: "Every notification, read and unread" },
  { key: "trade", label: "Trade activity", hint: "Closed trades with your share" },
  { key: "pool", label: "Pool updates", hint: "Guardian events and lifecycle" },
  { key: "payment", label: "Payment alerts", hint: "Deposits, payouts, fees" },
  { key: "security", label: "System & security", hint: "Sign-ins, devices, KYC" },
  { key: "digest", label: "Channel digest", hint: "The preference matrix as rows" },
];

const exportFormats: { key: ExportFormat; label: string; hint: string }[] = [
  { key: "csv", label: "CSV", hint: "Opens in any spreadsheet" },
  { key: "json", label: "JSON", hint: "Structured, one object per row" },
  { key: "pdf", label: "PDF", hint: "Print-ready statement" },
];

const supportTopics: { key: SupportTopic; label: string; hint: string }[] = [
  { key: "delivery", label: "Delivery problem", hint: "A channel did not arrive" },
  { key: "missing", label: "Missing notification", hint: "An event never showed up" },
  { key: "security", label: "Security concern", hint: "A sign-in or device looks wrong" },
  { key: "mute", label: "Muting", hint: "Change what is silenced" },
  { key: "other", label: "Something else", hint: "Anything the desk should know" },
];

/* ── Primitives ── */

function SectionHead({
  code,
  title,
  hint,
  aside,
}: {
  code: string;
  title: string;
  hint: string;
  aside?: ReactNode;
}) {
  return (
    <header className="nt-section-head">
      <div>
        <span className="nt-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="nt-section-aside">{aside}</div> : null}
    </header>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
  decimals = 0,
  prefix = "",
  suffix = "",
  big = false,
  delay = 0,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "is-pos" | "is-neg" | "is-accent" | "is-cut";
  decimals?: number;
  prefix?: string;
  suffix?: string;
  big?: boolean;
  delay?: number;
}) {
  const shown = useLiveCountUp(value);
  return (
    <div
      className={`nt-figure ${big ? "is-big" : ""}`}
      style={{ "--nt-delay": `${delay}ms` } as CSSProperties}
    >
      <span className="nt-figure__label">{label}</span>
      <b className={`nt-figure__value mono ${tone ?? ""}`}>
        {prefix}
        {shown.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix}
      </b>
      {hint ? <span className="nt-figure__hint">{hint}</span> : null}
    </div>
  );
}

function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="nt-kv">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tag({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`nt-tag ${tone}`.trim()}>{children}</span>;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`nt-toggle ${checked ? "is-on" : ""} ${disabled ? "is-locked" : ""}`}>
      <span className="nt-toggle__text">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="nt-toggle__track" aria-hidden="true">
        <span className="nt-toggle__thumb" />
      </span>
    </label>
  );
}

/* ── Page ── */

export function InvestorNotificationsPage({
  initial,
  initialAction,
}: {
  initial: NotificationWorkspace;
  initialAction?: string;
}) {
  const router = useRouter();
  const { data, markRead, markAllRead, updatePreferences, command } =
    useNotifications(initial);

  const chrome = useRef<{
    pushToast: (toast: {
      tone: "success" | "info" | "warning" | "error";
      title: string;
      detail?: string;
    }) => void;
  } | null>(null);
  const pushToast = useCallback(
    (toast: {
      tone: "success" | "info" | "warning" | "error";
      title: string;
      detail?: string;
    }) => chrome.current?.pushToast(toast),
    [],
  );

  const actionMap: Record<string, Kind> = {
    markread: "markReadWizard",
    read: "markReadWizard",
    markall: "markAllWizard",
    all: "markAllWizard",
    preferences: "preferencesWizard",
    settings: "preferencesWizard",
    rule: "ruleWizard",
    rules: "rulesList",
    export: "exportWizard",
    exports: "exportHistory",
    support: "supportWizard",
    snooze: "snoozeWizard",
    snoozed: "snoozedList",
    detail: "notificationDetail",
    trade: "tradeDetail",
    pool: "poolUpdateDetail",
    payment: "paymentDetail",
    security: "securityDetail",
    sessions: "sessions",
    revoke: "revokeSession",
    delivery: "deliveryLog",
    quiet: "quietHours",
    channels: "channelMatrix",
    digest: "digestPreview",
    pinned: "pinnedList",
    summary: "preferencesSummary",
    presummary: "preferencesSummary",
    posture: "securityPosture",
    audit: "auditTrail",
    reset: "resetInbox",
    badges: "badgeSettings",
    help: "boundaries",
  };

  const [modal, setModal] = useState<{ kind: Kind } | null>(() => {
    const kind = initialAction ? actionMap[initialAction] : undefined;
    return kind ? { kind } : null;
  });
  const [wizardStep, setWizardStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<"signal" | "delivery" | "security" | null>(
    null,
  );
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("notifications");
  const [activeSection, setActiveSection] = useState<string>("inbox");

  /* Inbox filters */
  const [filters, setFilters] = useState<NotificationFilters>({
    ...DEFAULT_FILTERS,
  });

  /* Selections */
  const [selectedId, setSelectedId] = useState(
    initial.notifications[0]?.id ?? "",
  );
  const [selectedTradeId, setSelectedTradeId] = useState(
    initial.tradeActivity[0]?.id ?? "",
  );
  const [selectedPoolUpdateId, setSelectedPoolUpdateId] = useState(
    initial.poolUpdates[0]?.id ?? "",
  );
  const [selectedPaymentId, setSelectedPaymentId] = useState(
    initial.paymentAlerts[0]?.id ?? "",
  );
  const [selectedSecurityId, setSelectedSecurityId] = useState(
    initial.securityEvents[0]?.id ?? "",
  );
  const [selectedSessionId, setSelectedSessionId] = useState(
    initial.sessions[1]?.id ?? initial.sessions[0]?.id ?? "",
  );
  const [selectedRuleId, setSelectedRuleId] = useState(
    initial.rules[0]?.id ?? "",
  );
  const [selectedExportId, setSelectedExportId] = useState("");

  /* Ledger paging + filters */
  const [tradePage, setTradePage] = useState(1);
  const [tradePool, setTradePool] = useState("all");
  const [tradeResult, setTradeResult] = useState<"all" | "win" | "loss">("all");
  const [tradeRange, setTradeRange] = useState<"all" | "today" | "7d">("all");
  const [tradeSorting, setTradeSorting] = useState<SortingState>([]);
  const [poolPage, setPoolPage] = useState(1);
  const [poolKind, setPoolKind] = useState<"all" | "guardian" | "lifecycle">("all");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentKind, setPaymentKind] = useState<"all" | "deposit" | "payout">("all");
  const [securityPage, setSecurityPage] = useState(1);

  /* Drafts */
  const [selectedMarkIds, setSelectedMarkIds] = useState<string[]>([]);
  const [markAllCategory, setMarkAllCategory] = useState<CategoryTab>("all");
  const [snoozeTargetId, setSnoozeTargetId] = useState<string>("");
  const [snoozeDuration, setSnoozeDuration] = useState<MuteDuration>("8h");
  const [draftPrefs, setDraftPrefs] = useState<NotificationPreferences>(
    initial.preferences,
  );
  const [ruleLabel, setRuleLabel] = useState("");
  const [ruleCategory, setRuleCategory] =
    useState<NotificationCategory>("trade");
  const [ruleAction, setRuleAction] = useState<InboxRule["action"]>("mute");
  const [exportScope, setExportScope] = useState<ExportScope>("inbox");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [supportTopic, setSupportTopic] = useState<SupportTopic>("delivery");
  const [supportMessage, setSupportMessage] = useState("");

  /* ── Derived ── */

  const summary = useMemo(() => inboxSummary(data), [data]);
  const counts = useMemo(() => categoryCounts(data.notifications), [data]);
  const inboxRows = useMemo(
    () => filterInbox(data.notifications, filters, data.asOf),
    [data, filters],
  );
  const inboxGroups = useMemo(
    () => groupByDay(inboxRows, data.asOf),
    [inboxRows, data.asOf],
  );
  const unreadRows = useMemo(
    () => data.notifications.filter((row) => !row.read),
    [data.notifications],
  );
  const latestUnread = unreadRows.slice(0, 5);
  const pinnedRows = data.notifications.filter((row) => row.pinned);
  const snoozedRows = data.notifications.filter((row) =>
    isSnoozed(row, data.asOf),
  );
  const stats = useMemo(() => tradeStats(data.tradeActivity), [data.tradeActivity]);
  const totals = useMemo(() => paymentTotals(data.paymentAlerts), [data.paymentAlerts]);
  const posture = useMemo(
    () => securityPosture(data.securityEvents, data.sessions, data.profile),
    [data.securityEvents, data.sessions, data.profile],
  );

  const tradePools = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of data.tradeActivity) seen.set(row.poolCode, row.poolName);
    return [...seen.entries()];
  }, [data.tradeActivity]);

  const tradeRows = useMemo(() => {
    const floor =
      tradeRange === "all"
        ? 0
        : new Date(data.asOf).getTime() - (tradeRange === "today" ? 1 : 7) * 86_400_000;
    return data.tradeActivity.filter((row) => {
      if (tradePool !== "all" && row.poolCode !== tradePool) return false;
      if (tradeResult !== "all" && row.result !== tradeResult) return false;
      if (tradeRange === "today" && row.at.slice(0, 10) !== data.asOf.slice(0, 10))
        return false;
      if (floor && new Date(row.at).getTime() < floor) return false;
      return true;
    });
  }, [data.tradeActivity, data.asOf, tradePool, tradeResult, tradeRange]);

  const tradePageRows = useMemo(
    () => paginate(tradeRows, tradePage, PAGE_SIZE),
    [tradeRows, tradePage],
  );

  const poolRows = useMemo(
    () =>
      data.poolUpdates.filter((row) =>
        poolKind === "all"
          ? true
          : poolKind === "guardian"
            ? row.kind.startsWith("guardian")
            : !row.kind.startsWith("guardian"),
      ),
    [data.poolUpdates, poolKind],
  );
  const poolPageRows = useMemo(
    () => paginate(poolRows, poolPage, 6),
    [poolRows, poolPage],
  );

  const paymentRows = useMemo(
    () =>
      data.paymentAlerts.filter((row) =>
        paymentKind === "all"
          ? true
          : paymentKind === "deposit"
            ? row.kind.startsWith("deposit")
            : !row.kind.startsWith("deposit"),
      ),
    [data.paymentAlerts, paymentKind],
  );
  const paymentPageRows = useMemo(
    () => paginate(paymentRows, paymentPage, 6),
    [paymentRows, paymentPage],
  );

  const securityPageRows = useMemo(
    () => paginate(data.securityEvents, securityPage, 6),
    [data.securityEvents, securityPage],
  );

  const selectedNotification =
    data.notifications.find((row) => row.id === selectedId) ?? data.notifications[0];
  const selectedTrade =
    data.tradeActivity.find((row) => row.id === selectedTradeId) ??
    data.tradeActivity[0];
  const selectedPoolUpdate =
    data.poolUpdates.find((row) => row.id === selectedPoolUpdateId) ??
    data.poolUpdates[0];
  const selectedPayment =
    data.paymentAlerts.find((row) => row.id === selectedPaymentId) ??
    data.paymentAlerts[0];
  const selectedSecurity =
    data.securityEvents.find((row) => row.id === selectedSecurityId) ??
    data.securityEvents[0];
  const selectedSession =
    data.sessions.find((row) => row.id === selectedSessionId) ?? data.sessions[0];
  const selectedRule = data.rules.find((row) => row.id === selectedRuleId);
  const selectedExport = data.exports.find((row) => row.id === selectedExportId);
  const snoozeTarget =
    data.notifications.find((row) => row.id === snoozeTargetId) ?? null;

  const markCandidates = unreadRows;
  const markSelection = selectedMarkIds.length
    ? selectedMarkIds
    : latestUnread.map((row) => row.id);

  const exportPreview = useMemo(
    () => exportMatrix(data, exportScope),
    [data, exportScope],
  );

  const heroUnread = useLiveCountUp(summary.unread);

  const prefsError = preferencesDraftError({
    preferences: draftPrefs,
    silentCategories: (
      Object.keys(draftPrefs.channels) as (keyof NotificationPreferences["channels"])[]
    ).filter((category) => channels.every((channel) => !draftPrefs.channels[category][channel])),
  });

  /* ── Step gating ── */

  const stepBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "markReadWizard" && wizardStep === 0)
      return markSelection.length ? "" : "Pick at least one notification";
    if (modal.kind === "preferencesWizard" && wizardStep === 2) return prefsError;
    if (modal.kind === "ruleWizard" && wizardStep === 0) {
      if (data.rules.length >= MAX_RULES)
        return `${MAX_RULES} rules is the limit — delete one first`;
      return ruleLabel.trim().length >= 4
        ? ""
        : "Give the rule a label of at least four characters";
    }
    if (modal.kind === "supportWizard" && wizardStep === 1)
      return supportDraftError({ topic: supportTopic, message: supportMessage });
    if (modal.kind === "snoozeWizard" && wizardStep === 0)
      return muteDraftError({
        category: snoozeTarget?.category ?? "trade",
        duration: snoozeDuration,
      });
    return "";
  })();

  const needsAck =
    modal?.kind === "markAllWizard" || modal?.kind === "resetInbox";

  const submitBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "preferencesWizard") return prefsError;
    if (modal.kind === "supportWizard")
      return supportDraftError({ topic: supportTopic, message: supportMessage });
    if (modal.kind === "ruleWizard")
      return ruleLabel.trim().length >= 4 ? "" : "Add a label first";
    if (modal.kind === "snoozeWizard")
      return muteDraftError({
        category: snoozeTarget?.category ?? "trade",
        duration: snoozeDuration,
      });
    return "";
  })();

  /* ── Trade table ── */

  const tradeColumn = useMemo(() => createDeskColumnHelper<TradeActivityRow>(), []);
  const tradeColumns = useMemo(
    () =>
      tradeColumn.columns([
        tradeColumn.accessor("at", {
          header: "Date",
          cell: (info) => (
            <span className="mono nt-muted">
              {shortDateOf(info.getValue())}
            </span>
          ),
        }),
        tradeColumn.accessor("poolCode", {
          header: "Pool",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        tradeColumn.accessor("symbol", {
          header: "Symbol",
          cell: (info) => (
            <span className="nt-cell-stack">
              <b className="mono">{info.getValue()}</b>
              <small className="nt-muted">{info.row.original.contractLabel}</small>
            </span>
          ),
        }),
        tradeColumn.accessor("result", {
          header: "Result",
          cell: (info) => (
            <Tag tone={info.getValue() === "win" ? "is-win" : "is-loss"}>
              {info.getValue() === "win" ? "Win" : "Loss"}
            </Tag>
          ),
        }),
        tradeColumn.accessor("yourShareNet", {
          header: "Your share impact",
          cell: (info) => (
            <b
              className={`mono ${info.getValue() >= 0 ? "is-pos" : "is-neg"}`}
            >
              {signedMoney(info.getValue(), 2)}
            </b>
          ),
        }),
        tradeColumn.accessor("at", {
          id: "time",
          header: "Time",
          cell: (info) => (
            <span className="mono nt-muted">{clockShort(info.getValue())} UTC</span>
          ),
        }),
      ]),
    [tradeColumn],
  );

  const tradeTable = useDeskTable({
    data: tradePageRows.rows,
    columns: tradeColumns,
    state: { sorting: tradeSorting },
    onSortingChange: setTradeSorting,
  });

  /* ── Chrome, dialogs, mutations ── */

  function open(kind: Kind, patch?: () => void) {
    setError("");
    setWizardStep(0);
    setConfirmed(false);
    patch?.();
    setModal({ kind });
  }

  function close() {
    setModal(null);
    setWizardStep(0);
    setConfirmed(false);
    setError("");
    setSupportMessage("");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        setDrawer(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wizardFor = modal ? wizardSteps[modal.kind] : undefined;
  const wizard = wizardFor ? [...wizardFor] : undefined;
  const lastStep = wizard ? wizard.length - 1 : 0;

  function scrollTo(id: string) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function jumpTo(key: string, id: string) {
    setActiveSection(key);
    scrollTo(id);
  }

  async function run(
    input: NotificationCommand,
    opts?: { title?: string; detail?: string; keep?: boolean },
  ) {
    setBusy(true);
    setError("");
    try {
      await command.mutateAsync(input);
      pushToast({
        tone: "success",
        title: opts?.title ?? "Inbox updated",
        detail:
          opts?.detail ??
          "Held in this browser session. Nothing was sent and no money moved.",
      });
      if (!opts?.keep) close();
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That change could not be applied",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function readOne(row: InvestorNotification) {
    try {
      await markRead.mutateAsync(row.id);
      pushToast({
        tone: "success",
        title: "Marked read",
        detail: `${row.title} · ${clockShort(row.at)} UTC`,
      });
    } catch (e) {
      pushToast({
        tone: "error",
        title: "Could not mark it read",
        detail: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function readAll(scope: CategoryTab) {
    try {
      await markAllRead.mutateAsync(scope);
      pushToast({
        tone: "success",
        title: scope === "all" ? "Inbox cleared" : `${categoryLabel(scope)} cleared`,
        detail: "The badge and the unread list updated together.",
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nothing to clear");
    }
  }

  function download(value: BlobPart, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ tone: "success", title: `${label} copied`, detail: value });
    } catch {
      pushToast({
        tone: "info",
        title: `${label}: ${value}`,
        detail: "Clipboard access was blocked — copy the value above.",
      });
    }
  }

  async function advance() {
    if (!modal) return;
    setWizardStep((step) => step + 1);
  }

  const submitLabel = !modal
    ? "Done"
    : modal.kind === "markReadWizard"
      ? "Mark selected read"
      : modal.kind === "markAllWizard"
        ? "Clear the queue"
        : modal.kind === "preferencesWizard"
          ? "Save preferences"
          : modal.kind === "ruleWizard"
            ? "Save rule"
            : modal.kind === "exportWizard"
              ? "Generate file"
              : modal.kind === "snoozeWizard"
                ? "Snooze"
                : modal.kind === "resetInbox"
                  ? "Reset the inbox"
                  : "Send to desk";

  async function submit() {
    if (!modal) return;

    if (modal.kind === "markReadWizard") {
      setBusy(true);
      setError("");
      try {
        for (const id of markSelection) {
          const row = data.notifications.find((item) => item.id === id);
          if (row && !row.read) await markRead.mutateAsync(id);
        }
        pushToast({
          tone: "success",
          title: `${markSelection.length} notification${markSelection.length === 1 ? "" : "s"} marked read`,
          detail: "The badge, the unread list and the inbox rows all agree.",
        });
        setSelectedMarkIds([]);
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nothing to mark");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (modal.kind === "markAllWizard") {
      await readAll(markAllCategory);
      return;
    }

    if (modal.kind === "preferencesWizard") {
      setBusy(true);
      setError("");
      try {
        await updatePreferences.mutateAsync({
          channels: draftPrefs.channels,
          digest: draftPrefs.digest,
          digestHour: draftPrefs.digestHour,
          quietHours: draftPrefs.quietHours,
          minTradeAmount: draftPrefs.minTradeAmount,
          guardianAlerts: draftPrefs.guardianAlerts,
          poolStatusAlerts: draftPrefs.poolStatusAlerts,
          sound: draftPrefs.sound,
          desktopPush: draftPrefs.desktopPush,
          weeklySummary: draftPrefs.weeklySummary,
        });
        pushToast({
          tone: "success",
          title: "Preferences saved",
          detail: `${draftPrefs.digest} digest at ${String(draftPrefs.digestHour).padStart(2, "0")}:00 UTC · trade floor ${money(draftPrefs.minTradeAmount)}`,
        });
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Preferences were rejected");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (modal.kind === "ruleWizard") {
      await run(
        { kind: "addRule", label: ruleLabel.trim(), category: ruleCategory, action: ruleAction },
        {
          title: "Rule added",
          detail: `${ruleLabel.trim()} · ${categoryLabel(ruleCategory)} · ${ruleAction}`,
        },
      );
      setRuleLabel("");
      return;
    }

    if (modal.kind === "exportWizard") {
      const ok = await run(
        {
          kind: "exportReport",
          scope: exportScope,
          format: exportFormat,
          count: exportPreview.rows.length,
        },
        {
          title: `${exportPreview.title} · ${exportFormat.toUpperCase()}`,
          detail: `${exportPreview.rows.length} rows queued in this session.`,
          keep: true,
        },
      );
      if (!ok) return;
      if (exportFormat === "csv") {
        download(csvOf(exportPreview), `trademo-${exportScope}-${data.asOf.slice(0, 10)}.csv`, "text/csv");
      } else if (exportFormat === "json") {
        download(
          JSON.stringify({ scope: exportScope, generatedAt: data.asOf, ...exportPreview }, null, 2),
          `trademo-${exportScope}-${data.asOf.slice(0, 10)}.json`,
          "application/json",
        );
      }
      close();
      return;
    }

    if (modal.kind === "snoozeWizard" && snoozeTarget) {
      await run(
        { kind: "snooze", id: snoozeTarget.id, duration: snoozeDuration },
        {
          title:
            snoozeDuration === "forever"
              ? "Muted until further notice"
              : `Snoozed for ${muteLabel(snoozeDuration)}`,
          detail: snoozeTarget.title,
        },
      );
      return;
    }

    if (modal.kind === "supportWizard") {
      const ok = await run(
        { kind: "support", topic: supportTopic, message: supportMessage.trim() },
        {
          title: "Draft logged for the desk",
          detail: `${supportTopic} · ${supportMessage.trim().length} characters`,
        },
      );
      if (ok) setSupportMessage("");
      return;
    }

    if (modal.kind === "resetInbox") {
      await run(
        { kind: "resetInbox" },
        {
          title: "Inbox reset",
          detail: "Read state, pins and snoozes cleared — nothing was deleted.",
        },
      );
      return;
    }

    close();
  }

  const modalFooter = (
    <>
      {wizard && wizardStep === lastStep && needsAck ? (
        <label className="nt-check nt-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-label="Confirm this local preview"
          />
          {modal?.kind === "resetInbox"
            ? "Reset read state, pins and snoozes for every notification."
            : "Mark every unread notification in this scope as read."}
        </label>
      ) : null}
      {wizard ? (
        <span className="nt-muted">Local preview · nothing is emailed or texted</span>
      ) : null}
      <button type="button" className="nt-btn" onClick={close}>
        Close
      </button>
      {wizard && wizardStep > 0 ? (
        <button
          type="button"
          className="nt-btn"
          onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
        >
          <Icon name="arrowLeft" size={13} /> Back
        </button>
      ) : null}
      {wizard && wizardStep < lastStep ? (
        <button
          type="button"
          className="nt-btn nt-btn--primary"
          onClick={() => void advance()}
          disabled={busy || Boolean(stepBlockingError)}
          data-action="wizard-next"
        >
          Continue <Icon name="arrowRight" size={13} />
        </button>
      ) : null}
      {wizard && wizardStep === lastStep ? (
        <button
          type="button"
          className="nt-btn nt-btn--primary"
          disabled={busy || (needsAck && !confirmed) || Boolean(submitBlockingError)}
          onClick={() => void submit()}
          data-action="wizard-submit"
        >
          {busy ? "Working…" : submitLabel}
        </button>
      ) : null}
    </>
  );

  /* ── Render ── */

  return (
    <InvestorShell
      rootClass="page-investor-notifications"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={data.profile.committed}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.profile.wallet}
      unread={summary.unread}
      activeNav={activeNav}
      detailHref="/investor/pools/pkg_05"
      bookHref="/investor/pools/pkg_02/book"
      quickActions={quickActions}
      onNavigate={(key) => {
        setActiveNav(key);
        if (key === "overview") return router.push("/investor");
        if (key === "pools" || key === "detail" || key === "upcoming")
          return router.push("/investor/pools");
        if (key === "book") return router.push("/investor/pools/pkg_02/book");
        if (key === "live") return router.push("/investor/live");
        if (key === "portfolio") return router.push("/investor/investments");
        if (key === "wallet") return router.push("/investor/wallet");
        if (key === "calculator") return router.push("/investor/calculator");
        if (key === "notifications") return setDrawer("signal");
        if (key === "earnings") return router.push("/investor/investments");
        if (key === "activity") return jumpTo("trades", "wa-trades");
        if (key === "settings") return open("preferencesWizard");
        setDrawer("signal");
      }}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(
          tab === "portfolio" ? "delivery" : tab === "activity" ? "signal" : "security",
        )
      }
      onQuickAction={(key) => {
        if (key === "markall") return open("markAllWizard");
        if (key === "rules") return open("rulesList");
        if (key === "prefs") return open("preferencesWizard");
        if (key === "export") return open("exportWizard");
        if (key === "sessions") return open("sessions");
        if (key === "support") return open("supportWizard");
      }}
      onChromeReady={(chromeApi) => {
        chrome.current = chromeApi;
      }}
      onOpenNotifications={() => setDrawer("signal")}
    >
      <div className="nt-page">
        <header className="nt-hero">
          <div className="nt-hero__main">
            <span className="nt-eyebrow">
              I-9 · INVESTOR WORKSPACE / SIGNAL DESK
            </span>
            <h1>Notifications &amp; activity</h1>
            <p className="nt-lede">
              Everything the desk told you, in the order it happened. The badge,
              the inbox, the trade ledger, the Guardian log, the cash alerts and
              the security record all read from one snapshot — so a deposit that
              settled in the wallet is the same deposit announced here.
            </p>

            <div className="nt-hero__badge">
              <span className={`nt-badge ${summary.unread ? "is-live" : ""}`}>
                <Icon name="bell" size={18} />
                <b className="mono">{heroUnread}</b>
                {summary.unread ? (
                  <span className="nt-badge__pulse" aria-hidden="true" />
                ) : null}
              </span>
              <span className="nt-hero__badge-text">
                <strong>
                  {summary.unread
                    ? `${summary.unread} unread notification${summary.unread === 1 ? "" : "s"}`
                    : "Inbox clear"}
                </strong>
                <small>
                  {summary.critical} critical · {summary.pinned} pinned ·{" "}
                  {summary.snoozed} snoozed · as of{" "}
                  {clockShort(data.asOf)} UTC, {dayLabel(data.asOf, data.asOf)}
                </small>
              </span>
              <button
                type="button"
                className="nt-btn nt-btn--primary"
                onClick={() =>
                  open("markAllWizard", () => setMarkAllCategory("all"))
                }
              >
                <Icon name="check" size={14} /> Mark all read
              </button>
            </div>

            <div className="nt-hero__figures">
              <Figure
                label="Unread"
                value={summary.unread}
                hint={`${summary.total} in the inbox`}
                tone="is-accent"
                delay={40}
              />
              <Figure
                label="Today"
                value={summary.today}
                hint={`${summary.week} in the last 7 days`}
                delay={90}
              />
              <Figure
                label="Trade net"
                value={stats.net}
                hint={`${stats.trades} closed · ${pct(stats.winRatePct, 1)} win rate`}
                tone={stats.net >= 0 ? "is-pos" : "is-neg"}
                decimals={2}
                prefix="$"
                delay={140}
              />
              <Figure
                label="In flight"
                value={totals.inFlight}
                hint="Payouts still clearing"
                decimals={2}
                prefix="$"
                delay={190}
              />
              <Figure
                label="Posture"
                value={posture.score}
                hint={`${posture.trusted}/${posture.devices} sessions trusted`}
                suffix=""
                tone={posture.score >= 80 ? "is-pos" : "is-cut"}
                delay={240}
              />
            </div>
          </div>

          <aside className="nt-hero__side">
            <div className="nt-hero__panel">
              <span className="nt-panel-label">Delivery health</span>
              <ul className="nt-delivery-mini">
                {data.deliveries.map((row) => (
                  <li key={row.id}>
                    <span className="nt-delivery-mini__icon">
                      <Icon
                        name={
                          row.channel === "email"
                            ? "mail"
                            : row.channel === "sms"
                              ? "smartphone"
                              : row.channel === "push"
                                ? "bolt"
                                : "bell"
                        }
                        size={13}
                      />
                    </span>
                    <span className="nt-delivery-mini__text">
                      <strong>{channelLabel(row.channel)}</strong>
                      <small className="mono">{row.address}</small>
                    </span>
                    <span
                      className={`nt-dot ${row.verified ? "is-ok" : "is-warn"}`}
                      title={row.verified ? "Verified" : "Unverified"}
                    />
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="nt-link-btn"
                onClick={() => open("deliveryLog")}
              >
                Delivery log <Icon name="arrowRight" size={12} />
              </button>
            </div>

            <div className="nt-hero__panel">
              <span className="nt-panel-label">Quick desk actions</span>
              <div className="nt-mini-actions">
                <button type="button" onClick={() => open("markReadWizard")}>
                  <Icon name="check" size={14} /> Mark read
                </button>
                <button type="button" onClick={() => open("rulesList")}>
                  <Icon name="filter" size={14} /> Rules
                </button>
                <button
                  type="button"
                  onClick={() => open("securityPosture")}
                >
                  <Icon name="shield" size={14} /> Posture
                </button>
                <button type="button" onClick={() => open("exportHistory")}>
                  <Icon name="download" size={14} /> Exports
                </button>
              </div>
            </div>
          </aside>
        </header>

        {/* ── section jump bar ── */}
        <nav className="nt-jump" aria-label="Notification sections">
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              className={activeSection === section.key ? "is-active" : ""}
              aria-current={activeSection === section.key ? "true" : undefined}
              onClick={() => jumpTo(section.key, section.id)}
            >
              {section.label}
              <span className="nt-jump__count mono">
                {section.key === "inbox"
                  ? summary.unread
                  : section.key === "trades"
                    ? stats.trades
                    : section.key === "pools"
                      ? data.poolUpdates.length
                      : section.key === "payments"
                        ? data.paymentAlerts.length
                        : section.key === "security"
                          ? data.securityEvents.length
                          : data.deliveries.length}
              </span>
            </button>
          ))}
        </nav>

        {/* ── 1 · unread notifications ── */}
        <section className="nt-section" id="wa-inbox">
          <SectionHead
            code="1 / Unread"
            title="Unread notifications"
            hint="The five most recent unread rows, then the full inbox by day. Mark one read, open the pool, or clear the queue."
            aside={
              <>
                <button
                  type="button"
                  className="nt-btn"
                  onClick={() => open("pinnedList")}
                >
                  <Icon name="target" size={13} /> Pinned {summary.pinned}
                </button>
                <button
                  type="button"
                  className="nt-btn"
                  onClick={() => open("snoozedList")}
                >
                  <Icon name="clock" size={13} /> Snoozed {summary.snoozed}
                </button>
                <button
                  type="button"
                  className="nt-btn nt-btn--primary"
                  onClick={() => open("markAllWizard")}
                  disabled={!summary.unread}
                >
                  <Icon name="check" size={13} /> Mark all read
                </button>
              </>
            }
          />

          <div className="nt-unread">
            {latestUnread.length ? (
              latestUnread.map((row, index) => (
                <article
                  key={row.id}
                  className={`nt-unread-row ${levelTone(row.level)}`}
                  style={{ "--nt-delay": `${index * 60}ms` } as CSSProperties}
                >
                  <span className="nt-unread-row__icon">
                    <Icon name={categoryIcon[row.category]} size={15} />
                  </span>
                  <div className="nt-unread-row__body">
                    <div className="nt-unread-row__top">
                      <strong>{row.title}</strong>
                      <span className="nt-unread-row__meta mono">
                        {relativeTo(row.at, data.asOf)} · {clockShort(row.at)} UTC
                      </span>
                    </div>
                    <p>{row.detail}</p>
                    <div className="nt-unread-row__tags">
                      <Tag tone="is-plain">{categoryShort(row.category)}</Tag>
                      <Tag tone={levelTone(row.level)}>{levelLabel(row.level)}</Tag>
                      {row.poolCode ? <Tag tone="is-plain">{row.poolCode}</Tag> : null}
                      {row.amount !== null ? (
                        <Tag tone={row.amount >= 0 ? "is-win" : "is-loss"}>
                          {signedMoney(row.amount, 2)}
                        </Tag>
                      ) : null}
                    </div>
                  </div>
                  <div className="nt-unread-row__actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--sm"
                      onClick={() => void readOne(row)}
                      disabled={markRead.isPending}
                    >
                      <Icon name="check" size={12} /> Mark read
                    </button>
                    {row.poolCode && row.href.startsWith("/investor/pools/") ? (
                      <Link className="nt-btn nt-btn--sm" href={row.href}>
                        <Icon name="pool" size={12} /> View pool
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="nt-btn nt-btn--sm nt-btn--ghost"
                      onClick={() =>
                        open("notificationDetail", () => setSelectedId(row.id))
                      }
                    >
                      <Icon name="info" size={12} /> View details
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="nt-empty">
                <span className="nt-empty__art" aria-hidden="true">
                  <Icon name="check" size={26} />
                </span>
                <strong>Everything has been read</strong>
                <p>
                  The badge is clear. New trades, Guardian events, cash movements
                  and security notices will land here first.
                </p>
                <button
                  type="button"
                  className="nt-btn"
                  onClick={() => open("digestPreview")}
                >
                  <Icon name="mail" size={13} /> Preview the digest
                </button>
              </div>
            )}
          </div>

          <div className="nt-inbox">
            <div className="nt-inbox__bar">
              <div className="nt-tabs" role="tablist" aria-label="Notification categories">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={filters.category === category}
                    className={filters.category === category ? "is-active" : ""}
                    onClick={() => setFilters((prev) => ({ ...prev, category }))}
                  >
                    {category === "all" ? "All" : categoryShort(category)}
                    <span className="mono">
                      {category === "all"
                        ? summary.total
                        : counts[category].total}
                    </span>
                    {category !== "all" && counts[category].unread ? (
                      <i className="nt-tabs__dot" aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="nt-inbox__tools">
                <label className="nt-search">
                  <Icon name="search" size={14} />
                  <input
                    type="search"
                    placeholder="Search titles, pools, sources…"
                    aria-label="Search notifications"
                    value={filters.query}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, query: event.target.value }))
                    }
                  />
                </label>
                <select
                  className="nt-select"
                  aria-label="Date range"
                  value={filters.range}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      range: event.target.value as NotificationFilters["range"],
                    }))
                  }
                >
                  {ranges.map((row) => (
                    <option key={row.key} value={row.key}>
                      {row.label}
                    </option>
                  ))}
                </select>
                <select
                  className="nt-select"
                  aria-label="Sort order"
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      sort: event.target.value as NotificationFilters["sort"],
                    }))
                  }
                >
                  {sorts.map((row) => (
                    <option key={row.key} value={row.key}>
                      {row.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`nt-chip ${filters.unreadOnly ? "is-on" : ""}`}
                  aria-pressed={filters.unreadOnly}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, unreadOnly: !prev.unreadOnly }))
                  }
                >
                  <Icon name="bell" size={12} /> Unread
                </button>
                <button
                  type="button"
                  className={`nt-chip ${filters.pinnedOnly ? "is-on" : ""}`}
                  aria-pressed={filters.pinnedOnly}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, pinnedOnly: !prev.pinnedOnly }))
                  }
                >
                  <Icon name="target" size={12} /> Pinned
                </button>
                <button
                  type="button"
                  className="nt-btn nt-btn--sm nt-btn--ghost"
                  onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                >
                  <Icon name="refresh" size={12} /> Reset
                </button>
              </div>
            </div>

            <div className="nt-inbox__meta">
              <span className="mono">
                {inboxRows.length} of {summary.total} notifications
              </span>
              <span className="nt-muted">
                {filters.category === "all" ? "All categories" : categoryLabel(filters.category)} ·{" "}
                {ranges.find((row) => row.key === filters.range)?.label} ·{" "}
                {sorts.find((row) => row.key === filters.sort)?.label}
              </span>
            </div>

            <div className="nt-groups">
              {inboxGroups.length ? (
                inboxGroups.map((group) => (
                  <div key={group.key} className="nt-group">
                    <div className="nt-group__head">
                      <span className="mono">{group.label}</span>
                      <span className="nt-muted mono">
                        {group.items.length} item
                        {group.items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul className="nt-list">
                      {group.items.map((row, index) => (
                        <li
                          key={row.id}
                          className={`nt-item ${row.read ? "is-read" : "is-unread"} ${levelTone(row.level)}`}
                          style={{ "--nt-delay": `${index * 45}ms` } as CSSProperties}
                        >
                          <button
                            type="button"
                            className="nt-item__main"
                            onClick={() =>
                              open("notificationDetail", () => setSelectedId(row.id))
                            }
                            aria-label={`Open ${row.title}`}
                          >
                            <span className="nt-item__dot" aria-hidden="true" />
                            <span className="nt-item__icon">
                              <Icon name={categoryIcon[row.category]} size={14} />
                            </span>
                            <span className="nt-item__text">
                              <strong>{row.title}</strong>
                              <small>{row.detail}</small>
                            </span>
                            <span className="nt-item__side">
                              {row.pinned ? (
                                <Icon name="target" size={12} />
                              ) : null}
                              <span className="mono">{clockShort(row.at)}</span>
                              {row.amount !== null ? (
                                <b
                                  className={`mono ${row.amount >= 0 ? "is-pos" : "is-neg"}`}
                                >
                                  {signedMoney(row.amount, 2)}
                                </b>
                              ) : null}
                            </span>
                          </button>
                          <div className="nt-item__actions">
                            <button
                              type="button"
                              title={row.read ? "Mark unread" : "Mark read"}
                              aria-label={row.read ? "Mark unread" : "Mark read"}
                              onClick={() => {
                                if (row.read) {
                                  void run(
                                    { kind: "markUnread", id: row.id },
                                    { title: "Marked unread", detail: row.title },
                                  );
                                } else {
                                  void readOne(row);
                                }
                              }}
                            >
                              <Icon name="check" size={13} />
                            </button>
                            <button
                              type="button"
                              title={row.pinned ? "Unpin" : "Pin"}
                              aria-label={row.pinned ? "Unpin" : "Pin"}
                              onClick={() =>
                                void run(
                                  { kind: "togglePin", id: row.id },
                                  {
                                    title: row.pinned ? "Unpinned" : "Pinned",
                                    detail: row.title,
                                  },
                                )
                              }
                            >
                              <Icon name="target" size={13} />
                            </button>
                            <button
                              type="button"
                              title="Snooze"
                              aria-label="Snooze"
                              onClick={() =>
                                open("snoozeWizard", () => setSnoozeTargetId(row.id))
                              }
                            >
                              <Icon name="clock" size={13} />
                            </button>
                            <button
                              type="button"
                              title="Delete from the inbox"
                              aria-label="Delete from the inbox"
                              onClick={() =>
                                void run(
                                  { kind: "deleteNotification", id: row.id },
                                  { title: "Removed from the inbox", detail: row.title },
                                )
                              }
                            >
                              <Icon name="close" size={13} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div className="nt-empty">
                  <span className="nt-empty__art" aria-hidden="true">
                    <Icon name="filter" size={24} />
                  </span>
                  <strong>No notification matches those filters</strong>
                  <p>
                    Widen the range or clear the search. The desk keeps{" "}
                    {summary.total} notifications in this demo snapshot.
                  </p>
                  <button
                    type="button"
                    className="nt-btn"
                    onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                  >
                    <Icon name="refresh" size={13} /> Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 2 · trade activity ── */}
        <section className="nt-section" id="wa-trades">
          <SectionHead
            code="2 / Trade activity"
            title="Every closed trade, with your share"
            hint="This is the same feed the live tracker streams: stake, result and your percentage of the pool's net. Filter by pool, result or window."
            aside={
              <>
                <button
                  type="button"
                  className="nt-btn"
                  onClick={() => open("exportWizard", () => setExportScope("trade"))}
                >
                  <Icon name="download" size={13} /> Export
                </button>
                <Link className="nt-btn nt-btn--primary" href="/investor/live">
                  <Icon name="activity" size={13} /> Open live tracker
                </Link>
              </>
            }
          />

          <div className="nt-trade-stats">
            <Figure
              label="Closed trades"
              value={stats.trades}
              hint={`${stats.wins} wins · ${stats.losses} losses`}
              delay={20}
            />
            <Figure
              label="Win rate"
              value={stats.winRatePct}
              suffix="%"
              decimals={1}
              hint="Across both trading pools"
              delay={60}
            />
            <Figure
              label="Your net"
              value={stats.net}
              decimals={2}
              prefix="$"
              tone={stats.net >= 0 ? "is-pos" : "is-neg"}
              hint={`${money(stats.volume)} staked in total`}
              delay={100}
            />
            <Figure
              label="Best trade"
              value={stats.best ? stats.best.yourShareNet : 0}
              decimals={2}
              prefix="$"
              tone="is-pos"
              hint={
                stats.best
                  ? `${stats.best.poolCode} · ${stats.best.symbol}`
                  : "—"
              }
              delay={140}
            />
            <Figure
              label="Worst trade"
              value={stats.worst ? stats.worst.yourShareNet : 0}
              decimals={2}
              prefix="$"
              tone="is-neg"
              hint={
                stats.worst
                  ? `${stats.worst.poolCode} · ${stats.worst.symbol}`
                  : "—"
              }
              delay={180}
            />
          </div>

          <div className="nt-toolbar">
            <div className="nt-chip-row" role="group" aria-label="Trade filters">
              <button
                type="button"
                className={`nt-chip ${tradeResult === "all" ? "is-on" : ""}`}
                onClick={() => {
                  setTradeResult("all");
                  setTradePage(1);
                }}
              >
                All results
              </button>
              <button
                type="button"
                className={`nt-chip ${tradeResult === "win" ? "is-on" : ""}`}
                onClick={() => {
                  setTradeResult("win");
                  setTradePage(1);
                }}
              >
                Wins <span className="mono">{stats.wins}</span>
              </button>
              <button
                type="button"
                className={`nt-chip ${tradeResult === "loss" ? "is-on" : ""}`}
                onClick={() => {
                  setTradeResult("loss");
                  setTradePage(1);
                }}
              >
                Losses <span className="mono">{stats.losses}</span>
              </button>
              <span className="nt-chip-row__sep" aria-hidden="true" />
              {(["all", "today", "7d"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  className={`nt-chip ${tradeRange === range ? "is-on" : ""}`}
                  onClick={() => {
                    setTradeRange(range);
                    setTradePage(1);
                  }}
                >
                  {range === "all" ? "All time" : range === "today" ? "Today" : "7 days"}
                </button>
              ))}
            </div>
            <label className="nt-field nt-field--inline">
              <span>Pool</span>
              <select
                value={tradePool}
                onChange={(event) => {
                  setTradePool(event.target.value);
                  setTradePage(1);
                }}
                aria-label="Filter trades by pool"
              >
                <option value="all">All pools</option>
                {tradePools.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} · {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="nt-table-wrap">
            <table className="nt-table" aria-label="Trade activity">
              <thead>
                {tradeTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} scope="col">
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            className="nt-sort"
                            onClick={header.column.getToggleSortingHandler()}
                            disabled={!header.column.getCanSort()}
                          >
                            {header.column.columnDef.header as string}
                            {header.column.getIsSorted() ? (
                              <Icon
                                name={
                                  header.column.getIsSorted() === "asc"
                                    ? "chevronDown"
                                    : "chevronDown"
                                }
                                size={11}
                              />
                            ) : null}
                          </button>
                        )}
                      </th>
                    ))}
                    <th scope="col">
                      <span className="nt-muted">Detail</span>
                    </th>
                  </tr>
                ))}
              </thead>
              <tbody>
                {tradeTable.getRowModel().rows.map(({ original: row }, index) => (
                  <tr
                    key={row.id}
                    className={row.result === "loss" ? "is-loss" : ""}
                    style={{ "--nt-delay": `${index * 30}ms` } as CSSProperties}
                  >
                    <td data-label="Date">
                      <span className="mono nt-muted">{shortDateOf(row.at)}</span>
                    </td>
                    <td data-label="Pool">
                      <span className="mono">{row.poolCode}</span>
                    </td>
                    <td data-label="Symbol">
                      <span className="nt-cell-stack">
                        <b className="mono">{row.symbol}</b>
                        <small className="nt-muted">{row.contractLabel}</small>
                      </span>
                    </td>
                    <td data-label="Result">
                      <Tag tone={row.result === "win" ? "is-win" : "is-loss"}>
                        {row.result === "win" ? "Win" : "Loss"}
                      </Tag>
                    </td>
                    <td data-label="Your share impact">
                      <b className={`mono ${row.yourShareNet >= 0 ? "is-pos" : "is-neg"}`}>
                        {signedMoney(row.yourShareNet, 2)}
                      </b>
                    </td>
                    <td data-label="Time">
                      <span className="mono nt-muted">{clockShort(row.at)} UTC</span>
                    </td>
                    <td data-label="Detail">
                      <button
                        type="button"
                        className="nt-btn nt-btn--sm nt-btn--ghost"
                        onClick={() => open("tradeDetail", () => setSelectedTradeId(row.id))}
                      >
                        <Icon name="info" size={12} /> Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tradePageRows.rows.length ? (
              <div className="nt-empty nt-empty--inline">
                <span className="nt-empty__art" aria-hidden="true">
                  <Icon name="activity" size={22} />
                </span>
                <strong>No trade matches those filters</strong>
                <p>Reset the result filter or widen the window.</p>
                <button
                  type="button"
                  className="nt-btn"
                  onClick={() => {
                    setTradeResult("all");
                    setTradePool("all");
                    setTradeRange("all");
                    setTradePage(1);
                  }}
                >
                  <Icon name="refresh" size={13} /> Reset filters
                </button>
              </div>
            ) : null}
          </div>

          <div className="nt-pager">
            <span className="mono nt-muted">
              {tradePageRows.total
                ? `${(tradePageRows.page - 1) * PAGE_SIZE + 1}–${Math.min(
                    tradePageRows.page * PAGE_SIZE,
                    tradePageRows.total,
                  )} of ${tradePageRows.total}`
                : "0 trades"}
            </span>
            <div>
              <button
                type="button"
                className="nt-btn nt-btn--sm"
                disabled={tradePageRows.page <= 1}
                onClick={() => setTradePage((page) => Math.max(1, page - 1))}
              >
                <Icon name="arrowLeft" size={12} /> Prev
              </button>
              <span className="mono nt-pager__count">
                {tradePageRows.page} / {tradePageRows.pages}
              </span>
              <button
                type="button"
                className="nt-btn nt-btn--sm"
                disabled={tradePageRows.page >= tradePageRows.pages}
                onClick={() =>
                  setTradePage((page) => Math.min(tradePageRows.pages, page + 1))
                }
              >
                Next <Icon name="arrowRight" size={12} />
              </button>
            </div>
          </div>
        </section>

        {/* ── 3 · pool updates ── */}
        <section className="nt-section" id="wa-pools">
          <SectionHead
            code="3 / Pool updates"
            title="Guardian events and pool lifecycle"
            hint="Pauses, watches, cleared streaks, bookings, windows opening and cycles closing — read straight off the pool book and the Guardian log."
            aside={
              <>
                <div className="nt-chip-row">
                  {(["all", "guardian", "lifecycle"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={`nt-chip ${poolKind === kind ? "is-on" : ""}`}
                      onClick={() => {
                        setPoolKind(kind);
                        setPoolPage(1);
                      }}
                    >
                      {kind === "all" ? "All" : kind === "guardian" ? "Guardian" : "Lifecycle"}
                    </button>
                  ))}
                </div>
              </>
            }
          />

          <ol className="nt-timeline nt-timeline--pools">
            {poolPageRows.rows.map((row, index) => (
              <li
                key={row.id}
                className={`nt-timeline__row ${levelTone(row.level)}`}
                style={{ "--nt-delay": `${index * 55}ms` } as CSSProperties}
              >
                <span className="nt-timeline__marker" aria-hidden="true">
                  <Icon
                    name={
                      row.kind.startsWith("guardian")
                        ? "shield"
                        : row.kind === "completed"
                          ? "check"
                          : row.kind === "closing_soon"
                            ? "clock"
                            : "pool"
                    }
                    size={13}
                  />
                </span>
                <div className="nt-timeline__card">
                  <div className="nt-timeline__head">
                    <span className="nt-timeline__kind mono">
                      {poolUpdateLabel(row.kind)}
                    </span>
                    {row.poolCode ? (
                      <Tag tone="is-plain">{row.poolCode}</Tag>
                    ) : null}
                    <span className="nt-timeline__when mono">
                      {shortDateOf(row.at)} · {clockShort(row.at)} UTC
                    </span>
                  </div>
                  <strong className="nt-timeline__title">{row.title}</strong>
                  <p>{row.detail}</p>
                  <div className="nt-timeline__foot">
                    <span className="nt-muted mono">status: {row.status}</span>
                    <div className="nt-timeline__actions">
                      <button
                        type="button"
                        className="nt-btn nt-btn--sm"
                        onClick={() =>
                          open("poolUpdateDetail", () =>
                            setSelectedPoolUpdateId(row.id),
                          )
                        }
                      >
                        <Icon name="info" size={12} /> Detail
                      </button>
                      {row.poolId ? (
                        <Link className="nt-btn nt-btn--sm nt-btn--ghost" href={row.href}>
                          <Icon name="pool" size={12} /> View pool
                        </Link>
                      ) : (
                        <Link className="nt-btn nt-btn--sm nt-btn--ghost" href={row.href}>
                          <Icon name="layers" size={12} /> My investments
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="nt-pager">
            <span className="mono nt-muted">
              {poolPageRows.total} pool update{poolPageRows.total === 1 ? "" : "s"}
            </span>
            <div>
              <button
                type="button"
                className="nt-btn nt-btn--sm"
                disabled={poolPageRows.page <= 1}
                onClick={() => setPoolPage((page) => Math.max(1, page - 1))}
              >
                <Icon name="arrowLeft" size={12} /> Prev
              </button>
              <span className="mono nt-pager__count">
                {poolPageRows.page} / {poolPageRows.pages}
              </span>
              <button
                type="button"
                className="nt-btn nt-btn--sm"
                disabled={poolPageRows.page >= poolPageRows.pages}
                onClick={() =>
                  setPoolPage((page) => Math.min(poolPageRows.pages, page + 1))
                }
              >
                Next <Icon name="arrowRight" size={12} />
              </button>
            </div>
          </div>
        </section>

        {/* ── 4 · payment & payout alerts ── */}
        <section className="nt-section" id="wa-payments">
          <SectionHead
            code="4 / Payments"
            title="Payment &amp; payout alerts"
            hint="Every deposit, payout request, settlement, refund and fee on the wallet statement — with the rail it used and the reference the bank will quote."
            aside={
              <>
                <button
                  type="button"
                  className="nt-btn"
                  onClick={() => open("exportWizard", () => setExportScope("payment"))}
                >
                  <Icon name="download" size={13} /> Export
                </button>
                <Link className="nt-btn nt-btn--primary" href="/investor/wallet">
                  <Icon name="wallet" size={13} /> Open wallet
                </Link>
              </>
            }
          />

          <div className="nt-pay-strip">
            <div className="nt-pay-strip__cell">
              <span>Deposits</span>
              <b className="mono is-pos">{money(totals.deposits, 2)}</b>
              <small className="mono">{money(totals.depositFees, 2)} in fees</small>
            </div>
            <div className="nt-pay-strip__cell">
              <span>Payouts</span>
              <b className="mono">{money(totals.payouts, 2)}</b>
              <small className="mono">{money(totals.payoutFees, 2)} in fees</small>
            </div>
            <div className="nt-pay-strip__cell">
              <span>Refunds</span>
              <b className="mono">{money(totals.refunds, 2)}</b>
              <small className="mono">returned to the wallet</small>
            </div>
            <div className="nt-pay-strip__cell">
              <span>In flight</span>
              <b className="mono is-cut">{money(totals.inFlight, 2)}</b>
              <small className="mono">clearing in the next batch</small>
            </div>
            <div className="nt-pay-strip__cell">
              <span>Net movement</span>
              <b className="mono">{money(totals.net, 2)}</b>
              <small className="mono">{totals.count} alerts</small>
            </div>
          </div>

          <div className="nt-toolbar">
            <div className="nt-chip-row">
              {(["all", "deposit", "payout"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`nt-chip ${paymentKind === kind ? "is-on" : ""}`}
                  onClick={() => {
                    setPaymentKind(kind);
                    setPaymentPage(1);
                  }}
                >
                  {kind === "all" ? "Every alert" : kind === "deposit" ? "Deposits" : "Payouts"}
                </button>
              ))}
            </div>
            <span className="nt-muted mono">
              {paymentPageRows.total} row{paymentPageRows.total === 1 ? "" : "s"} · statement basis
            </span>
          </div>

          <ul className="nt-list nt-list--payments">
            {paymentPageRows.rows.map((row, index) => (
              <li
                key={row.id}
                className={`nt-item nt-item--payment ${levelTone(row.level)}`}
                style={{ "--nt-delay": `${index * 45}ms` } as CSSProperties}
              >
                <button
                  type="button"
                  className="nt-item__main"
                  onClick={() =>
                    open("paymentDetail", () => setSelectedPaymentId(row.id))
                  }
                  aria-label={`Open ${paymentAlertLabel(row.kind)} ${row.reference}`}
                >
                  <span className="nt-item__icon">
                    <Icon
                      name={row.kind.startsWith("deposit") ? "plus" : "upload"}
                      size={14}
                    />
                  </span>
                  <span className="nt-item__text">
                    <strong>
                      {paymentAlertLabel(row.kind)} · {money(row.gross, 2)}
                      {row.poolCode ? ` · ${row.poolCode}` : ""}
                    </strong>
                    <small>
                      {row.methodLabel} · {row.reference} · {row.detail}
                    </small>
                  </span>
                  <span className="nt-item__side">
                    <Tag tone={levelTone(row.level)}>{row.status}</Tag>
                    <span className="mono">
                      {shortDateOf(row.at)} {clockShort(row.at)}
                    </span>
                    <b className="mono">{money(row.net, 2)} net</b>
                  </span>
                </button>
                <div className="nt-item__actions">
                  <Link
                    className="nt-btn nt-btn--sm nt-btn--ghost"
                    href="/investor/wallet"
                  >
                    <Icon name="wallet" size={12} /> Wallet
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="nt-pager">
            <span className="mono nt-muted">
              {totals.count} alerts across the statement
            </span>
            <div>
              <button
                type="button"
                className="nt-btn nt-btn--sm"
                disabled={paymentPageRows.page <= 1}
                onClick={() => setPaymentPage((page) => Math.max(1, page - 1))}
              >
                <Icon name="arrowLeft" size={12} /> Prev
              </button>
              <span className="mono nt-pager__count">
                {paymentPageRows.page} / {paymentPageRows.pages}
              </span>
              <button
                type="button"
                className="nt-btn nt-btn--sm"
                disabled={paymentPageRows.page >= paymentPageRows.pages}
                onClick={() =>
                  setPaymentPage((page) => Math.min(paymentPageRows.pages, page + 1))
                }
              >
                Next <Icon name="arrowRight" size={12} />
              </button>
            </div>
          </div>
        </section>

        {/* ── 5 · system & security ── */}
        <section className="nt-section" id="wa-security">
          <SectionHead
            code="5 / Security"
            title="System &amp; security"
            hint="Sign-ins, second factors, device changes, KYC and blocked attempts. Security alerts are the account's audit trail — they cannot be muted or snoozed."
            aside={
              <>
                <button
                  type="button"
                  className="nt-btn"
                  onClick={() => open("securityPosture")}
                >
                  <Icon name="shield" size={13} /> Posture {posture.score}
                </button>
                <button
                  type="button"
                  className="nt-btn nt-btn--primary"
                  onClick={() => open("sessions")}
                >
                  <Icon name="key" size={13} /> Signed-in devices
                </button>
              </>
            }
          />

          <div className="nt-security">
            <div className="nt-posture">
              <div className="nt-posture__head">
                <span className="nt-panel-label">Posture score</span>
                <b className="mono nt-posture__score">{posture.score}</b>
                <span className="nt-posture__band mono">
                  {posture.score >= 80
                    ? "strong"
                    : posture.score >= 60
                      ? "watch"
                      : "action needed"}
                </span>
              </div>
              <div className="nt-posture__bar" aria-hidden="true">
                <span style={{ width: `${posture.score}%` }} />
              </div>
              <ul className="nt-posture__checks">
                {posture.checks.map((check) => (
                  <li key={check.label} className={check.ok ? "is-ok" : "is-warn"}>
                    <Icon name={check.ok ? "check" : "alert"} size={13} />
                    <span>
                      <strong>{check.label}</strong>
                      <small>{check.detail}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="nt-posture__foot">
                <span className="mono nt-muted">
                  Last sign-in {posture.lastLoginAt ? shortDateOf(posture.lastLoginAt) : "—"} ·{" "}
                  {posture.twoFactorPct.toFixed(0)}% 2FA coverage
                </span>
                <button
                  type="button"
                  className="nt-link-btn"
                  onClick={() => open("securityPosture")}
                >
                  Full report <Icon name="arrowRight" size={12} />
                </button>
              </div>
            </div>

            <div className="nt-sessions-mini">
              <span className="nt-panel-label">Active sessions</span>
              <ul>
                {data.sessions.map((session) => (
                  <li key={session.id}>
                    <Icon
                      name={session.current ? "smartphone" : "globe"}
                      size={13}
                    />
                    <span className="nt-sessions-mini__text">
                      <strong>
                        {session.device}
                        {session.current ? " · this device" : ""}
                      </strong>
                      <small className="mono">
                        {session.location} · {relativeTo(session.lastSeenAt, data.asOf)}
                      </small>
                    </span>
                    {session.current ? (
                      <Tag tone="is-plain">current</Tag>
                    ) : (
                      <button
                        type="button"
                        className="nt-btn nt-btn--sm"
                        onClick={() =>
                          open("revokeSession", () =>
                            setSelectedSessionId(session.id),
                          )
                        }
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="nt-link-btn"
                onClick={() => open("sessions")}
              >
                Manage devices <Icon name="arrowRight" size={12} />
              </button>
            </div>
          </div>

          <ul className="nt-list nt-list--security">
            {securityPageRows.rows.map((row, index) => (
              <li
                key={row.id}
                className={`nt-item nt-item--security ${levelTone(row.level)}`}
                style={{ "--nt-delay": `${index * 45}ms` } as CSSProperties}
              >
                <button
                  type="button"
                  className="nt-item__main"
                  onClick={() =>
                    open("securityDetail", () => setSelectedSecurityId(row.id))
                  }
                  aria-label={`Open ${row.title}`}
                >
                  <span className="nt-item__icon">
                    <Icon
                      name={
                        row.kind === "login" || row.kind === "twofa"
                          ? "key"
                          : row.kind === "device"
                            ? "smartphone"
                            : row.kind === "kyc"
                              ? "file"
                              : "shield"
                      }
                      size={14}
                    />
                  </span>
                  <span className="nt-item__text">
                    <strong>{row.title}</strong>
                    <small>
                      {row.detail} · {row.ip}
                    </small>
                  </span>
                  <span className="nt-item__side">
                    <Tag tone={levelTone(row.level)}>{securityKindLabel(row.kind)}</Tag>
                    <span className="mono">
                      {shortDateOf(row.at)} {clockShort(row.at)}
                    </span>
                    <span className="mono nt-muted">{row.location}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="nt-pager">
            <span className="mono nt-muted">
              {data.securityEvents.length} recorded events
            </span>
            <div>
              <button
                type="button"
                className="nt-btn nt-btn--sm"
                disabled={securityPageRows.page <= 1}
                onClick={() => setSecurityPage((page) => Math.max(1, page - 1))}
              >
                <Icon name="arrowLeft" size={12} /> Prev
              </button>
              <span className="mono nt-pager__count">
                {securityPageRows.page} / {securityPageRows.pages}
              </span>
              <button
                type="button"
                className="nt-btn nt-btn--sm"
                disabled={securityPageRows.page >= securityPageRows.pages}
                onClick={() =>
                  setSecurityPage((page) =>
                    Math.min(securityPageRows.pages, page + 1),
                  )
                }
              >
                Next <Icon name="arrowRight" size={12} />
              </button>
            </div>
          </div>
        </section>

        {/* ── 6 · delivery & preferences ── */}
        <section className="nt-section" id="wa-delivery">
          <SectionHead
            code="6 / Delivery"
            title="How the desk reaches you"
            hint="Four channels, one matrix of categories, and the rules that decide what breaks through. Security alerts always stay on in-app."
            aside={
              <>
                <button
                  type="button"
                  className="nt-btn"
                  onClick={() => open("channelMatrix")}
                >
                  <Icon name="sliders" size={13} /> Matrix
                </button>
                <button
                  type="button"
                  className="nt-btn nt-btn--primary"
                  onClick={() =>
                    open("preferencesWizard", () => setDraftPrefs(data.preferences))
                  }
                >
                  <Icon name="check" size={13} /> Edit preferences
                </button>
              </>
            }
          />

          <div className="nt-delivery-grid">
            <div className="nt-channel-table">
              <table className="nt-table nt-table--matrix" aria-label="Channel matrix">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    {channels.map((channel) => (
                      <th key={channel} scope="col">
                        {channelLabel(channel)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(data.preferences.channels) as NotificationCategory[]).map(
                    (category) => (
                      <tr key={category}>
                        <th scope="row">
                          <Icon name={categoryIcon[category]} size={13} />{" "}
                          {categoryLabel(category)}
                        </th>
                        {channels.map((channel) => {
                          const on = data.preferences.channels[category][channel];
                          return (
                            <td key={channel}>
                              <span className={`nt-mark ${on ? "is-on" : ""}`}>
                                {on ? (
                                  <Icon name="check" size={12} />
                                ) : (
                                  <Icon name="minus" size={12} />
                                )}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <p className="nt-matric-note">
                <Icon name="info" size={13} /> Digest{" "}
                <b>{data.preferences.digest}</b> at{" "}
                <b className="mono">
                  {String(data.preferences.digestHour).padStart(2, "0")}:00 UTC
                </b>
                {data.preferences.quietHours.enabled ? (
                  <>
                    {" "}
                    · quiet <b className="mono">{data.preferences.quietHours.from}–
                    {data.preferences.quietHours.to}</b>
                  </>
                ) : (
                  " · quiet hours off"
                )}
                {" "}· trade floor <b className="mono">{money(data.preferences.minTradeAmount)}</b>
              </p>
            </div>

            <div className="nt-rules-panel">
              <div className="nt-rules-panel__head">
                <span className="nt-panel-label">
                  Inbox rules · {data.rules.length}/{MAX_RULES}
                </span>
                <button
                  type="button"
                  className="nt-btn nt-btn--sm"
                  onClick={() => open("ruleWizard")}
                >
                  <Icon name="plus" size={12} /> New rule
                </button>
              </div>
              <ul className="nt-rules">
                {data.rules.map((rule) => (
                  <li key={rule.id} className={rule.enabled ? "is-on" : ""}>
                    <span className="nt-rules__dot" aria-hidden="true" />
                    <div className="nt-rules__text">
                      <strong>{rule.label}</strong>
                      <small>
                        {categoryLabel(rule.category)} · {rule.detail}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={`nt-switch ${rule.enabled ? "is-on" : ""}`}
                      role="switch"
                      aria-checked={rule.enabled}
                      aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.label}`}
                      onClick={() =>
                        void run(
                          { kind: "toggleRule", ruleId: rule.id },
                          {
                            title: rule.enabled ? "Rule disabled" : "Rule enabled",
                            detail: rule.label,
                          },
                        )
                      }
                    >
                      <span />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="nt-rules-panel__foot">
                <button
                  type="button"
                  className="nt-link-btn"
                  onClick={() => open("rulesList")}
                >
                  Manage rules <Icon name="arrowRight" size={12} />
                </button>
                <button
                  type="button"
                  className="nt-link-btn"
                  onClick={() => open("quietHours")}
                >
                  Quiet hours <Icon name="arrowRight" size={12} />
                </button>
              </div>
            </div>
          </div>

          <div className="nt-delivery-rows">
            {data.deliveries.map((row, index) => (
              <article
                key={row.id}
                className="nt-delivery-card"
                style={{ "--nt-delay": `${index * 55}ms` } as CSSProperties}
              >
                <header>
                  <span className="nt-delivery-card__icon">
                    <Icon
                      name={
                        row.channel === "email"
                          ? "mail"
                          : row.channel === "sms"
                            ? "smartphone"
                            : row.channel === "push"
                              ? "bolt"
                              : "bell"
                      }
                      size={15}
                    />
                  </span>
                  <div>
                    <strong>{channelLabel(row.channel)}</strong>
                    <small className="mono">{row.address}</small>
                  </div>
                  <Tag tone={row.verified ? "is-win" : "is-warn"}>
                    {row.verified ? "verified" : "unverified"}
                  </Tag>
                </header>
                <div className="nt-delivery-card__stats">
                  <span>
                    <b className="mono">{row.sent}</b> sent
                  </span>
                  <span>
                    <b className="mono">{row.failed}</b> failed
                  </span>
                  <span className="mono nt-muted">{relativeTo(row.lastAt, data.asOf)}</span>
                </div>
                <p>{row.note}</p>
              </article>
            ))}
          </div>

          <div className="nt-delivery-actions">
            <button
              type="button"
              className="nt-btn"
              onClick={() => open("deliveryLog")}
            >
              <Icon name="file" size={13} /> Delivery log
            </button>
            <button
              type="button"
              className="nt-btn"
              onClick={() => open("digestPreview")}
            >
              <Icon name="mail" size={13} /> Preview digest
            </button>
            <button
              type="button"
              className="nt-btn"
              onClick={() => open("badgeSettings")}
            >
              <Icon name="bell" size={13} /> Badge &amp; sound
            </button>
            <button
              type="button"
              className="nt-btn"
              onClick={() => open("exportHistory")}
            >
              <Icon name="download" size={13} /> Export history
            </button>
            <button
              type="button"
              className="nt-btn"
              onClick={() => open("auditTrail")}
            >
              <Icon name="terminal" size={13} /> Audit trail
            </button>
            <button
              type="button"
              className="nt-btn"
              onClick={() => open("supportWizard")}
            >
              <Icon name="send" size={13} /> Ask the desk
            </button>
          </div>
        </section>

        {/* ── right drawer ── */}
        {drawer ? (
          <div
            className="op-drawer-backdrop nt-drawer-layer"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDrawer(null);
            }}
          >
            <aside
              className="op-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Notification inspector"
            >
              <div className="op-drawer__head">
                <div>
                  <span className="nt-section-code">I-9 / SIGNAL INSPECTOR</span>
                  <h2 className="op-drawer__title">
                    {drawer === "signal"
                      ? "Unread queue"
                      : drawer === "delivery"
                        ? "Delivery & rules"
                        : "Security posture"}
                  </h2>
                  <p className="nt-muted">
                    {summary.unread} unread · {summary.total} in the inbox · as of{" "}
                    {clockShort(data.asOf)} UTC
                  </p>
                </div>
                <button
                  type="button"
                  className="desk-icon-btn"
                  onClick={() => setDrawer(null)}
                  aria-label="Close inspector"
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
              <div className="nt-drawer-tabs" role="tablist" aria-label="Inspector views">
                {(["signal", "delivery", "security"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={drawer === tab}
                    className={drawer === tab ? "is-active" : ""}
                    onClick={() => setDrawer(tab)}
                  >
                    {tab === "signal"
                      ? "Queue"
                      : tab === "delivery"
                        ? "Delivery"
                        : "Security"}
                  </button>
                ))}
              </div>
              <div className="op-drawer__body">
                {drawer === "signal" ? (
                  <>
                    <div className="nt-drawer-hero">
                      <span className="nt-muted">Unread</span>
                      <b className="mono is-accent">{summary.unread}</b>
                      <span className="nt-muted mono">
                        {summary.today} arrived today · {summary.critical} critical
                      </span>
                    </div>
                    <ul className="nt-drawer-list">
                      {unreadRows.map((row) => (
                        <li key={row.id}>
                          <span className="nt-drawer-list__icon">
                            <Icon name={categoryIcon[row.category]} size={13} />
                          </span>
                          <span className="nt-drawer-list__text">
                            <strong>{row.title}</strong>
                            <small className="mono">
                              {relativeTo(row.at, data.asOf)} · {categoryShort(row.category)}
                            </small>
                          </span>
                          <button
                            type="button"
                            className="nt-icon-btn"
                            aria-label={`Mark ${row.title} read`}
                            onClick={() => void readOne(row)}
                          >
                            <Icon name="check" size={13} />
                          </button>
                        </li>
                      ))}
                      {!unreadRows.length ? (
                        <li className="nt-drawer-empty">The queue is clear.</li>
                      ) : null}
                    </ul>
                    <div className="nt-drawer-actions">
                      <button
                        type="button"
                        className="nt-btn nt-btn--primary"
                        disabled={!summary.unread}
                        onClick={() => open("markAllWizard")}
                      >
                        <Icon name="check" size={13} /> Mark all read
                      </button>
                      <button
                        type="button"
                        className="nt-btn"
                        onClick={() => open("markReadWizard")}
                      >
                        Pick rows
                      </button>
                    </div>
                    <Kv
                      rows={[
                        ["Unread", `${summary.unread} of ${summary.total}`],
                        ["Pinned", String(summary.pinned)],
                        ["Snoozed", String(summary.snoozed)],
                        ["Critical", String(summary.critical)],
                        ["Latest", latestUnread[0] ? clockShort(latestUnread[0].at) : "—"],
                      ]}
                    />
                  </>
                ) : null}

                {drawer === "delivery" ? (
                  <>
                    <div className="nt-drawer-hero">
                      <span className="nt-muted">Digest</span>
                      <b className="mono">{data.preferences.digest}</b>
                      <span className="nt-muted mono">
                        {String(data.preferences.digestHour).padStart(2, "0")}:00 UTC ·{" "}
                        {data.rules.filter((rule) => rule.enabled).length}/{data.rules.length} rules on
                      </span>
                    </div>
                    <ul className="nt-drawer-list">
                      {data.deliveries.map((row) => (
                        <li key={row.id}>
                          <span className="nt-drawer-list__icon">
                            <Icon
                              name={
                                row.channel === "email"
                                  ? "mail"
                                  : row.channel === "sms"
                                    ? "smartphone"
                                    : row.channel === "push"
                                      ? "bolt"
                                      : "bell"
                              }
                              size={13}
                            />
                          </span>
                          <span className="nt-drawer-list__text">
                            <strong>{channelLabel(row.channel)}</strong>
                            <small className="mono">
                              {row.sent} sent · {row.failed} failed
                            </small>
                          </span>
                          <span className={`nt-dot ${row.verified ? "is-ok" : "is-warn"}`} />
                        </li>
                      ))}
                    </ul>
                    <h3 className="nt-drawer-sub">Rules</h3>
                    <ul className="nt-drawer-list">
                      {data.rules.map((rule) => (
                        <li key={rule.id}>
                          <span className={`nt-dot ${rule.enabled ? "is-ok" : "is-off"}`} />
                          <span className="nt-drawer-list__text">
                            <strong>{rule.label}</strong>
                            <small>{rule.detail}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="nt-drawer-actions">
                      <button
                        type="button"
                        className="nt-btn nt-btn--primary"
                        onClick={() => open("preferencesWizard")}
                      >
                        <Icon name="sliders" size={13} /> Preferences
                      </button>
                      <button
                        type="button"
                        className="nt-btn"
                        onClick={() => open("ruleWizard")}
                      >
                        <Icon name="plus" size={13} /> New rule
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "security" ? (
                  <>
                    <div className="nt-drawer-hero">
                      <span className="nt-muted">Posture</span>
                      <b className={`mono ${posture.score >= 80 ? "is-pos" : "is-cut"}`}>
                        {posture.score}
                      </b>
                      <span className="nt-muted mono">
                        {posture.trusted}/{posture.devices} trusted ·{" "}
                        {posture.failed} blocked attempt(s)
                      </span>
                    </div>
                    <ul className="nt-posture__checks">
                      {posture.checks.map((check) => (
                        <li key={check.label} className={check.ok ? "is-ok" : "is-warn"}>
                          <Icon name={check.ok ? "check" : "alert"} size={13} />
                          <span>
                            <strong>{check.label}</strong>
                            <small>{check.detail}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <h3 className="nt-drawer-sub">Sessions</h3>
                    <ul className="nt-drawer-list">
                      {data.sessions.map((session: ActiveSession) => (
                        <li key={session.id}>
                          <span className="nt-drawer-list__icon">
                            <Icon name={session.current ? "smartphone" : "globe"} size={13} />
                          </span>
                          <span className="nt-drawer-list__text">
                            <strong>{session.device}</strong>
                            <small className="mono">
                              {session.location} · {session.ip}
                            </small>
                          </span>
                          {session.current ? (
                            <Tag tone="is-plain">here</Tag>
                          ) : (
                            <button
                              type="button"
                              className="nt-icon-btn"
                              aria-label={`Revoke ${session.device}`}
                              onClick={() =>
                                open("revokeSession", () =>
                                  setSelectedSessionId(session.id),
                                )
                              }
                            >
                              <Icon name="minus" size={13} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="nt-drawer-actions">
                      <button
                        type="button"
                        className="nt-btn nt-btn--primary"
                        onClick={() => open("securityPosture")}
                      >
                        <Icon name="shield" size={13} /> Full report
                      </button>
                      <button
                        type="button"
                        className="nt-btn"
                        onClick={() => open("sessions")}
                      >
                        Manage devices
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        {/* ── modals ── */}
        {modal ? (
          <div className="nt-modal-layer">
            <DeskModalShell
              code="I-9"
              eyebrow="INVESTOR WORKSPACE / SIGNAL DESK"
              title={titles[modal.kind]}
              subtitle="Read, pin, snooze and preferences run through the same command contract the API will expose — held as an audited local preview until the notification service is wired."
              size={modalSize[modal.kind] ?? "md"}
              onClose={close}
              steps={wizard}
              currentStep={wizardStep}
              footer={modalFooter}
            >
              {error ? (
                <p className="nt-error" role="alert">
                  {error}
                </p>
              ) : null}

              {/* ── mark read wizard ── */}
              {modal.kind === "markReadWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="nt-modal-lede">
                      {markCandidates.length} unread notification
                      {markCandidates.length === 1 ? "" : "s"}. Tick the ones you
                      have read; the badge and the unread list update together.
                    </p>
                    <div className="nt-check-list">
                      {markCandidates.map((row) => (
                        <label key={row.id} className="nt-check nt-check--row">
                          <input
                            type="checkbox"
                            checked={markSelection.includes(row.id)}
                            onChange={(event) =>
                              setSelectedMarkIds(
                                event.target.checked
                                  ? [...new Set([...markSelection, row.id])]
                                  : markSelection.filter((id) => id !== row.id),
                              )
                            }
                          />
                          <span className="nt-check__body">
                            <strong>{row.title}</strong>
                            <small>
                              {categoryShort(row.category)} · {clockShort(row.at)} UTC ·{" "}
                              {relativeTo(row.at, data.asOf)}
                            </small>
                          </span>
                        </label>
                      ))}
                      {!markCandidates.length ? (
                        <p className="nt-muted">Nothing is unread — the queue is clear.</p>
                      ) : null}
                    </div>
                    <div className="nt-modal-actions">
                      <button
                        type="button"
                        className="nt-btn nt-btn--sm"
                        onClick={() =>
                          setSelectedMarkIds(markCandidates.map((row) => row.id))
                        }
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="nt-btn nt-btn--sm"
                        onClick={() => setSelectedMarkIds([])}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Kv
                      rows={[
                        ["Selected", `${markSelection.length} notification(s)`],
                        [
                          "Categories",
                          [
                            ...new Set(
                              data.notifications
                                .filter((row) => markSelection.includes(row.id))
                                .map((row) => categoryShort(row.category)),
                            ),
                          ].join(", ") || "—",
                        ],
                        [
                          "Unread after",
                          String(Math.max(0, summary.unread - markSelection.length)),
                        ],
                      ]}
                    />
                    <p className="nt-modal-note">
                      <Icon name="info" size={13} /> Marking read is reversible: any
                      row can be switched back to unread from the inbox.
                    </p>
                  </>
                )
              ) : null}

              {/* ── mark all wizard ── */}
              {modal.kind === "markAllWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="nt-modal-lede">
                      Choose how much of the queue to clear. Security rows stay in
                      the record either way.
                    </p>
                    <div className="nt-option-grid">
                      {categories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          className={`nt-option ${markAllCategory === category ? "is-active" : ""}`}
                          onClick={() => setMarkAllCategory(category)}
                        >
                          <strong>
                            {category === "all" ? "The whole inbox" : categoryLabel(category)}
                          </strong>
                          <span className="mono">
                            {category === "all" ? summary.unread : counts[category].unread} unread
                            of{" "}
                            {category === "all" ? summary.total : counts[category].total}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <Kv
                    rows={[
                      [
                        "Scope",
                        markAllCategory === "all"
                          ? "Every category"
                          : categoryLabel(markAllCategory),
                      ],
                      [
                        "Rows affected",
                        String(
                          markAllCategory === "all"
                            ? summary.unread
                            : counts[markAllCategory].unread,
                        ),
                      ],
                      ["Badge after", "0 in this scope"],
                      ["Reversible", "Yes — switch any row back to unread"],
                    ]}
                  />
                )
              ) : null}

              {/* ── preferences wizard ── */}
              {modal.kind === "preferencesWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="nt-modal-lede">
                      One row per category, one column per channel. Security alerts
                      must keep in-app on — that is the account&apos;s audit trail.
                    </p>
                    <div className="nt-pref-matrix">
                      {(Object.keys(draftPrefs.channels) as NotificationCategory[]).map(
                        (category) => (
                          <div key={category} className="nt-pref-matrix__row">
                            <span className="nt-pref-matrix__label">
                              <Icon name={categoryIcon[category]} size={14} />
                              {categoryLabel(category)}
                            </span>
                            {channels.map((channel) => {
                              const on = draftPrefs.channels[category][channel];
                              const locked = category === "security" && channel === "inApp";
                              return (
                                <label
                                  key={channel}
                                  className={`nt-pref-cell ${on ? "is-on" : ""} ${locked ? "is-locked" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={locked}
                                    onChange={(event) =>
                                      setDraftPrefs((prev) => ({
                                        ...prev,
                                        channels: {
                                          ...prev.channels,
                                          [category]: {
                                            ...prev.channels[category],
                                            [channel]: event.target.checked,
                                          },
                                        },
                                      }))
                                    }
                                    aria-label={`${categoryLabel(category)} on ${channelLabel(channel)}`}
                                  />
                                  <span>{channelLabel(channel)}</span>
                                  <Icon name={on ? "check" : "minus"} size={12} />
                                </label>
                              );
                            })}
                          </div>
                        ),
                      )}
                    </div>
                    {prefsError ? <p className="nt-error">{prefsError}</p> : null}
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <div className="nt-form-grid">
                      <label className="nt-field">
                        <span>Digest cadence</span>
                        <select
                          value={draftPrefs.digest}
                          onChange={(event) =>
                            setDraftPrefs((prev) => ({
                              ...prev,
                              digest: event.target
                                .value as NotificationPreferences["digest"],
                            }))
                          }
                        >
                          {(["realtime", "hourly", "daily", "weekly"] as const).map((key) => (
                            <option key={key} value={key}>
                              {key === "realtime"
                                ? "Real time — every event"
                                : key === "hourly"
                                  ? "Hourly roll-up"
                                  : key === "daily"
                                    ? "Daily at a set hour"
                                    : "Weekly on Monday"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="nt-field">
                        <span>Digest hour (UTC)</span>
                        <select
                          value={draftPrefs.digestHour}
                          onChange={(event) =>
                            setDraftPrefs((prev) => ({
                              ...prev,
                              digestHour: Number(event.target.value),
                            }))
                          }
                        >
                          {Array.from({ length: 24 }, (_, hour) => (
                            <option key={hour} value={hour}>
                              {String(hour).padStart(2, "0")}:00
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="nt-field">
                        <span>Quiet from</span>
                        <input
                          type="time"
                          value={draftPrefs.quietHours.from}
                          onChange={(event) =>
                            setDraftPrefs((prev) => ({
                              ...prev,
                              quietHours: { ...prev.quietHours, from: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="nt-field">
                        <span>Quiet to</span>
                        <input
                          type="time"
                          value={draftPrefs.quietHours.to}
                          onChange={(event) =>
                            setDraftPrefs((prev) => ({
                              ...prev,
                              quietHours: { ...prev.quietHours, to: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="nt-field">
                        <span>Trade alert floor</span>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          step={1}
                          value={draftPrefs.minTradeAmount}
                          onChange={(event) =>
                            setDraftPrefs((prev) => ({
                              ...prev,
                              minTradeAmount: Number(event.target.value),
                            }))
                          }
                        />
                        <small className="nt-muted">
                          Trades below {money(draftPrefs.minTradeAmount)} stay quiet
                        </small>
                      </label>
                      <label className="nt-field">
                        <span>Floor slider</span>
                        <span className="nt-range-value mono">
                          {money(draftPrefs.minTradeAmount)}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={Math.min(50, draftPrefs.minTradeAmount)}
                          aria-label="Trade alert floor slider"
                          onChange={(event) =>
                            setDraftPrefs((prev) => ({
                              ...prev,
                              minTradeAmount: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="nt-toggle-stack">
                      <Toggle
                        label="Quiet hours"
                        hint={`Silence push and SMS between ${draftPrefs.quietHours.from} and ${draftPrefs.quietHours.to} UTC`}
                        checked={draftPrefs.quietHours.enabled}
                        onChange={(next) =>
                          setDraftPrefs((prev) => ({
                            ...prev,
                            quietHours: { ...prev.quietHours, enabled: next },
                          }))
                        }
                      />
                      <Toggle
                        label="Guardian alert overrides"
                        hint="Pool pauses and drawdown events break the digest"
                        checked={draftPrefs.guardianAlerts}
                        onChange={(next) =>
                          setDraftPrefs((prev) => ({ ...prev, guardianAlerts: next }))
                        }
                      />
                      <Toggle
                        label="Pool status changes"
                        hint="Windows opening, bookings confirmed, cycles closing"
                        checked={draftPrefs.poolStatusAlerts}
                        onChange={(next) =>
                          setDraftPrefs((prev) => ({ ...prev, poolStatusAlerts: next }))
                        }
                      />
                      <Toggle
                        label="Weekly performance summary"
                        hint="Sunday 18:00 UTC across every pool"
                        checked={draftPrefs.weeklySummary}
                        onChange={(next) =>
                          setDraftPrefs((prev) => ({ ...prev, weeklySummary: next }))
                        }
                      />
                      <Toggle
                        label="Desktop notifications"
                        hint="Browser push while the desk is open"
                        checked={draftPrefs.desktopPush}
                        onChange={(next) =>
                          setDraftPrefs((prev) => ({ ...prev, desktopPush: next }))
                        }
                      />
                      <Toggle
                        label="Alert sound"
                        hint="A single chime for critical rows only"
                        checked={draftPrefs.sound}
                        onChange={(next) =>
                          setDraftPrefs((prev) => ({ ...prev, sound: next }))
                        }
                      />
                    </div>
                    {prefsError ? <p className="nt-error">{prefsError}</p> : null}
                  </>
                ) : (
                  <>
                    <Kv
                      rows={[
                        [
                          "Digest",
                          `${draftPrefs.digest} at ${String(draftPrefs.digestHour).padStart(2, "0")}:00 UTC`,
                        ],
                        [
                          "Quiet hours",
                          draftPrefs.quietHours.enabled
                            ? `${draftPrefs.quietHours.from}–${draftPrefs.quietHours.to} UTC`
                            : "Off",
                        ],
                        ["Trade floor", money(draftPrefs.minTradeAmount)],
                        [
                          "Channels on",
                          `${channels.filter((channel) => draftPrefs.channels.security[channel]).length} on security · ${channels.filter((channel) => draftPrefs.channels.payment[channel]).length} on payments`,
                        ],
                        ["Guardian overrides", draftPrefs.guardianAlerts ? "On" : "Off"],
                        ["Weekly summary", draftPrefs.weeklySummary ? "On" : "Off"],
                        ["Sound", draftPrefs.sound ? "On" : "Off"],
                      ]}
                    />
                    <p className="nt-modal-note">
                      <Icon name="info" size={13} /> Security alerts stay in-app
                      regardless of these settings — the desk never hides its own
                      audit trail.
                    </p>
                  </>
                )
              ) : null}

              {/* ── rule wizard ── */}
              {modal.kind === "ruleWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <label className="nt-field">
                      <span>Rule label</span>
                      <input
                        type="text"
                        value={ruleLabel}
                        maxLength={60}
                        placeholder="e.g. Mute trades under $2"
                        onChange={(event) => setRuleLabel(event.target.value)}
                      />
                      <small className="nt-muted">
                        {ruleLabel.trim().length}/60 · at least 4 characters
                      </small>
                    </label>
                    <div className="nt-field">
                      <span>Category</span>
                      <div className="nt-chip-row">
                        {(Object.keys(data.preferences.channels) as NotificationCategory[]).map(
                          (category) => (
                            <button
                              key={category}
                              type="button"
                              className={`nt-chip ${ruleCategory === category ? "is-on" : ""}`}
                              onClick={() => setRuleCategory(category)}
                            >
                              {categoryShort(category)}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="nt-field">
                      <span>Action</span>
                      <div className="nt-option-grid nt-option-grid--tight">
                        {(["alert", "pin", "digest", "mute"] as const).map((action) => (
                          <button
                            key={action}
                            type="button"
                            className={`nt-option ${ruleAction === action ? "is-active" : ""}`}
                            onClick={() => setRuleAction(action)}
                          >
                            <strong>
                              {action === "alert"
                                ? "Alert immediately"
                                : action === "pin"
                                  ? "Pin to the top"
                                  : action === "digest"
                                    ? "Roll into digest"
                                    : "Mute"}
                            </strong>
                            <span>
                              {action === "alert"
                                ? "Breaks quiet hours and the digest"
                                : action === "pin"
                                  ? "Floats above the newest row"
                                  : action === "digest"
                                    ? "One line in the daily email"
                                    : "Stays in the record, never alerts"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="nt-modal-note">
                      <Icon name="info" size={13} /> {data.rules.length} of {MAX_RULES}{" "}
                      rule slots used on this account.
                    </p>
                  </>
                ) : (
                  <Kv
                    rows={[
                      ["Label", ruleLabel.trim() || "—"],
                      ["Category", categoryLabel(ruleCategory)],
                      ["Action", ruleAction],
                      ["Status", "Enabled on save"],
                      ["Scope", "This investor account only"],
                    ]}
                  />
                )
              ) : null}

              {/* ── export wizard ── */}
              {modal.kind === "exportWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="nt-modal-lede">
                      Pick the ledger to export. Every scope is built from this
                      snapshot, so the row count is exact before you commit.
                    </p>
                    <div className="nt-option-grid">
                      {exportScopes.map((scope) => (
                        <button
                          key={scope.key}
                          type="button"
                          className={`nt-option ${exportScope === scope.key ? "is-active" : ""}`}
                          onClick={() => setExportScope(scope.key)}
                        >
                          <strong>{scope.label}</strong>
                          <span>{scope.hint}</span>
                          <b className="mono">
                            {exportMatrix(data, scope.key).rows.length} rows
                          </b>
                        </button>
                      ))}
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <div className="nt-option-grid nt-option-grid--tight">
                      {exportFormats.map((format) => (
                        <button
                          key={format.key}
                          type="button"
                          className={`nt-option ${exportFormat === format.key ? "is-active" : ""}`}
                          onClick={() => setExportFormat(format.key)}
                        >
                          <strong>{format.label}</strong>
                          <span>{format.hint}</span>
                          <b className="mono">
                            {exportMatrix(data, exportScope).rows.length} rows
                          </b>
                        </button>
                      ))}
                    </div>
                    <p className="nt-modal-note">
                      <Icon name="info" size={13} /> {data.exports.length} of{" "}
                      {MAX_EXPORTS} export slots used. Older exports fall off the list
                      first.
                    </p>
                  </>
                ) : (
                  <>
                    <Kv
                      rows={[
                        [
                          "Scope",
                          exportScopes.find((row) => row.key === exportScope)?.label ?? "—",
                        ],
                        ["Format", exportFormat.toUpperCase()],
                        ["Rows", String(exportPreview.rows.length)],
                        ["Columns", exportPreview.header.join(" · ")],
                        [
                          "Generated",
                          `${shortDateOf(data.asOf)} ${clockShort(data.asOf)} UTC`,
                        ],
                      ]}
                    />
                    <pre className="nt-code">
                      {csvOf({
                        header: exportPreview.header,
                        rows: exportPreview.rows.slice(0, 3),
                      })}
                    </pre>
                    <p className="nt-muted">First three rows of the file.</p>
                  </>
                )
              ) : null}

              {/* ── support wizard ── */}
              {modal.kind === "supportWizard" ? (
                wizardStep === 0 ? (
                  <div className="nt-option-grid">
                    {supportTopics.map((topic) => (
                      <button
                        key={topic.key}
                        type="button"
                        className={`nt-option ${supportTopic === topic.key ? "is-active" : ""}`}
                        onClick={() => setSupportTopic(topic.key)}
                      >
                        <strong>{topic.label}</strong>
                        <span>{topic.hint}</span>
                      </button>
                    ))}
                  </div>
                ) : wizardStep === 1 ? (
                  <>
                    <label className="nt-field">
                      <span>What should the desk know?</span>
                      <textarea
                        rows={6}
                        value={supportMessage}
                        maxLength={1000}
                        placeholder="Include the pool code, the date and the reference if you have them."
                        onChange={(event) => setSupportMessage(event.target.value)}
                      />
                      <small className="nt-muted">
                        {supportMessage.trim().length}/1000 · at least 12 characters
                      </small>
                    </label>
                    <div className="nt-context">
                      <span className="nt-context__label">Attached automatically</span>
                      <ul>
                        <li className="mono">account: {data.profile.id}</li>
                        <li className="mono">
                          unread: {summary.unread} · inbox: {summary.total}
                        </li>
                        <li className="mono">digest: {data.preferences.digest}</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <Kv
                    rows={[
                      [
                        "Topic",
                        supportTopics.find((row) => row.key === supportTopic)?.label ?? "—",
                      ],
                      ["Message", supportMessage.trim().slice(0, 160) || "—"],
                      ["Status", "Draft logged locally — nothing sent"],
                      ["Reply channel", "In-app first, then email"],
                      ["Drafts kept", `${data.support.length} of 12`],
                    ]}
                  />
                )
              ) : null}

              {/* ── snooze wizard ── */}
              {modal.kind === "snoozeWizard" ? (
                wizardStep === 0 ? (
                  <>
                    {snoozeTarget ? (
                      <div className="nt-pick">
                        <span className="nt-pick__label">Snoozing</span>
                        <strong>{snoozeTarget.title}</strong>
                        <small className="mono">
                          {categoryLabel(snoozeTarget.category)} ·{" "}
                          {relativeTo(snoozeTarget.at, data.asOf)}
                        </small>
                      </div>
                    ) : (
                      <p className="nt-modal-lede">
                        Pick a notification from the inbox first.
                      </p>
                    )}
                    <div className="nt-option-grid nt-option-grid--tight">
                      {muteDurations.map((duration) => (
                        <button
                          key={duration}
                          type="button"
                          className={`nt-option ${snoozeDuration === duration ? "is-active" : ""}`}
                          disabled={snoozeTarget?.category === "security"}
                          onClick={() => setSnoozeDuration(duration)}
                        >
                          <strong>{muteLabel(duration)}</strong>
                          <span>
                            {duration === "forever"
                              ? "Stays muted until you wake it"
                              : "Resumes automatically after"}
                          </span>
                        </button>
                      ))}
                    </div>
                    {snoozeTarget?.category === "security" ? (
                      <p className="nt-error">
                        Security alerts cannot be snoozed — they are the account&apos;s
                        audit trail.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <Kv
                    rows={[
                      ["Notification", snoozeTarget?.title ?? "—"],
                      [
                        "Category",
                        snoozeTarget ? categoryLabel(snoozeTarget.category) : "—",
                      ],
                      ["Duration", muteLabel(snoozeDuration)],
                      ["Stays in the record", "Yes — snoozing only silences the alert"],
                    ]}
                  />
                )
              ) : null}

              {/* ── notification detail ── */}
              {modal.kind === "notificationDetail" && selectedNotification ? (
                <>
                  <div className="nt-detail-head">
                    <span
                      className={`nt-detail-icon ${levelTone(selectedNotification.level)}`}
                    >
                      <Icon name={categoryIcon[selectedNotification.category]} size={18} />
                    </span>
                    <div>
                      <h3>{selectedNotification.title}</h3>
                      <p>{selectedNotification.detail}</p>
                    </div>
                  </div>
                  <Kv
                    rows={[
                      ["Category", categoryLabel(selectedNotification.category)],
                      ["Level", levelLabel(selectedNotification.level)],
                      ["Source", selectedNotification.source],
                      [
                        "Raised",
                        `${shortDateOf(selectedNotification.at)} ${clockShort(selectedNotification.at)} UTC`,
                      ],
                      ["Relative", relativeTo(selectedNotification.at, data.asOf)],
                      ["Pool", selectedNotification.poolCode ?? "—"],
                      [
                        "Amount",
                        selectedNotification.amount === null
                          ? "—"
                          : signedMoney(selectedNotification.amount, 2),
                      ],
                      ["State", selectedNotification.read ? "Read" : "Unread"],
                      [
                        "Delivered by",
                        selectedNotification.delivered.map(channelLabel).join(" · "),
                      ],
                      [
                        "Snoozed until",
                        selectedNotification.snoozedUntil &&
                        isSnoozed(selectedNotification, data.asOf)
                          ? `${shortDateOf(selectedNotification.snoozedUntil)} ${clockShort(selectedNotification.snoozedUntil)} UTC`
                          : "Not snoozed",
                      ],
                    ]}
                  />
                  <div className="nt-modal-actions">
                    {!selectedNotification.read ? (
                      <button
                        type="button"
                        className="nt-btn nt-btn--primary"
                        onClick={() => void readOne(selectedNotification)}
                      >
                        <Icon name="check" size={13} /> Mark read
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="nt-btn"
                        onClick={() =>
                          void run(
                            { kind: "markUnread", id: selectedNotification.id },
                            {
                              title: "Marked unread",
                              detail: selectedNotification.title,
                            },
                          )
                        }
                      >
                        <Icon name="bell" size={13} /> Mark unread
                      </button>
                    )}
                    <button
                      type="button"
                      className="nt-btn"
                      onClick={() =>
                        void run(
                          { kind: "togglePin", id: selectedNotification.id },
                          {
                            title: selectedNotification.pinned ? "Unpinned" : "Pinned",
                            detail: selectedNotification.title,
                          },
                        )
                      }
                    >
                      <Icon name="target" size={13} />{" "}
                      {selectedNotification.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      className="nt-btn"
                      onClick={() =>
                        open("snoozeWizard", () =>
                          setSnoozeTargetId(selectedNotification.id),
                        )
                      }
                    >
                      <Icon name="clock" size={13} /> Snooze
                    </button>
                    <Link className="nt-btn nt-btn--ghost" href={selectedNotification.href}>
                      {selectedNotification.openLabel}{" "}
                      <Icon name="arrowRight" size={12} />
                    </Link>
                  </div>
                </>
              ) : null}

              {/* ── trade detail ── */}
              {modal.kind === "tradeDetail" && selectedTrade ? (
                <>
                  <div className="nt-detail-head">
                    <span
                      className={`nt-detail-icon ${selectedTrade.result === "win" ? "is-ok" : "is-critical"}`}
                    >
                      <Icon name="activity" size={18} />
                    </span>
                    <div>
                      <h3>
                        {selectedTrade.poolCode} · {selectedTrade.symbol} ·{" "}
                        {selectedTrade.result === "win" ? "Win" : "Loss"}
                      </h3>
                      <p>
                        {selectedTrade.botName} · {selectedTrade.contractLabel} ·{" "}
                        {selectedTrade.durationSeconds}s
                      </p>
                    </div>
                  </div>
                  <Kv
                    rows={[
                      ["Trade", selectedTrade.tradeId],
                      [
                        "Closed",
                        `${shortDateOf(selectedTrade.at)} ${clockShort(selectedTrade.at)} UTC`,
                      ],
                      ["Pool", `${selectedTrade.poolCode} · ${selectedTrade.poolName}`],
                      ["Stake", money(selectedTrade.stake, 2)],
                      ["Pool result", signedMoney(selectedTrade.poolProfit, 2)],
                      ["Your share", pct(selectedTrade.yourSharePct, 1)],
                      ["Your impact", signedMoney(selectedTrade.yourShareNet, 2)],
                    ]}
                  />
                  <div className="nt-modal-actions">
                    <Link className="nt-btn nt-btn--primary" href="/investor/live">
                      <Icon name="activity" size={13} /> Live tracker
                    </Link>
                    <Link className="nt-btn" href={`/investor/pools/${selectedTrade.poolId}`}>
                      <Icon name="pool" size={13} /> Pool page
                    </Link>
                  </div>
                </>
              ) : null}

              {/* ── pool update detail ── */}
              {modal.kind === "poolUpdateDetail" && selectedPoolUpdate ? (
                <>
                  <div className="nt-detail-head">
                    <span className={`nt-detail-icon ${levelTone(selectedPoolUpdate.level)}`}>
                      <Icon name="pool" size={18} />
                    </span>
                    <div>
                      <h3>{selectedPoolUpdate.title}</h3>
                      <p>{selectedPoolUpdate.detail}</p>
                    </div>
                  </div>
                  <Kv
                    rows={[
                      ["Event", poolUpdateLabel(selectedPoolUpdate.kind)],
                      ["Pool", selectedPoolUpdate.poolCode ?? "Portfolio-wide"],
                      [
                        "Raised",
                        `${shortDateOf(selectedPoolUpdate.at)} ${clockShort(selectedPoolUpdate.at)} UTC`,
                      ],
                      ["Status", selectedPoolUpdate.status],
                      [
                        "Amount",
                        selectedPoolUpdate.amount === null
                          ? "—"
                          : money(selectedPoolUpdate.amount, 2),
                      ],
                      [
                        "Guardian",
                        selectedPoolUpdate.kind.startsWith("guardian") ? "Yes" : "No",
                      ],
                    ]}
                  />
                  <div className="nt-modal-actions">
                    <Link className="nt-btn nt-btn--primary" href={selectedPoolUpdate.href}>
                      <Icon name="arrowRight" size={13} /> Open
                    </Link>
                    <Link className="nt-btn" href="/investor/live">
                      <Icon name="shield" size={13} /> Guardian log
                    </Link>
                  </div>
                </>
              ) : null}

              {/* ── payment detail ── */}
              {modal.kind === "paymentDetail" && selectedPayment ? (
                <>
                  <div className="nt-detail-head">
                    <span className={`nt-detail-icon ${levelTone(selectedPayment.level)}`}>
                      <Icon name="wallet" size={18} />
                    </span>
                    <div>
                      <h3>
                        {paymentAlertLabel(selectedPayment.kind)} ·{" "}
                        {money(selectedPayment.gross, 2)}
                      </h3>
                      <p>{selectedPayment.detail}</p>
                    </div>
                  </div>
                  <Kv
                    rows={[
                      ["Reference", selectedPayment.reference],
                      ["Rail", `${selectedPayment.methodLabel} (${selectedPayment.rail})`],
                      ["Gross", money(selectedPayment.gross, 2)],
                      ["Fee", money(selectedPayment.fee, 2)],
                      ["Net", money(selectedPayment.net, 2)],
                      ["Status", selectedPayment.status],
                      ["Pool", selectedPayment.poolCode ?? "—"],
                      [
                        "Raised",
                        `${shortDateOf(selectedPayment.at)} ${clockShort(selectedPayment.at)} UTC`,
                      ],
                    ]}
                  />
                  <div className="nt-modal-actions">
                    <Link className="nt-btn nt-btn--primary" href="/investor/wallet">
                      <Icon name="wallet" size={13} /> Wallet statement
                    </Link>
                    <button
                      type="button"
                      className="nt-btn"
                      onClick={() => void copy(selectedPayment.reference, "Reference")}
                    >
                      <Icon name="copy" size={13} /> Copy reference
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── security detail ── */}
              {modal.kind === "securityDetail" && selectedSecurity ? (
                <>
                  <div className="nt-detail-head">
                    <span className={`nt-detail-icon ${levelTone(selectedSecurity.level)}`}>
                      <Icon name="shield" size={18} />
                    </span>
                    <div>
                      <h3>{selectedSecurity.title}</h3>
                      <p>{selectedSecurity.detail}</p>
                    </div>
                  </div>
                  <Kv
                    rows={[
                      ["Event", securityKindLabel(selectedSecurity.kind)],
                      ["Device", selectedSecurity.device],
                      ["Location", selectedSecurity.location],
                      ["IP", selectedSecurity.ip],
                      ["Status", selectedSecurity.status],
                      [
                        "Recorded",
                        `${shortDateOf(selectedSecurity.at)} ${clockShort(selectedSecurity.at)} UTC`,
                      ],
                    ]}
                  />
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary"
                      onClick={() => open("sessions")}
                    >
                      <Icon name="key" size={13} /> Review sessions
                    </button>
                    <button
                      type="button"
                      className="nt-btn"
                      onClick={() =>
                        open("supportWizard", () => setSupportTopic("security"))
                      }
                    >
                      <Icon name="send" size={13} /> Report to the desk
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── sessions ── */}
              {modal.kind === "sessions" ? (
                <>
                  <p className="nt-modal-lede">
                    {data.sessions.length} open session
                    {data.sessions.length === 1 ? "" : "s"}. The session you are using
                    cannot be revoked from here — sign out instead.
                  </p>
                  <ul className="nt-session-list">
                    {data.sessions.map((session: ActiveSession) => (
                      <li key={session.id} className={session.current ? "is-current" : ""}>
                        <span className="nt-session-list__icon">
                          <Icon name={session.current ? "smartphone" : "globe"} size={15} />
                        </span>
                        <span className="nt-session-list__text">
                          <strong>
                            {session.device} · {session.browser}
                          </strong>
                          <small className="mono">
                            {session.location} · {session.ip} · last seen{" "}
                            {relativeTo(session.lastSeenAt, data.asOf)}
                          </small>
                        </span>
                        <Tag
                          tone={
                            session.current
                              ? "is-plain"
                              : session.trusted
                                ? "is-win"
                                : "is-warn"
                          }
                        >
                          {session.current
                            ? "this device"
                            : session.trusted
                              ? "trusted"
                              : "untrusted"}
                        </Tag>
                        {session.current ? (
                          <button type="button" className="nt-btn nt-btn--sm" disabled>
                            Current
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="nt-btn nt-btn--sm nt-btn--danger"
                            onClick={() =>
                              open("revokeSession", () =>
                                setSelectedSessionId(session.id),
                              )
                            }
                          >
                            Revoke
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="nt-modal-note">
                    <Icon name="info" size={13} /> Revoking closes the session on the
                    server the next time it touches the API; the row stays in the
                    security log.
                  </p>
                </>
              ) : null}

              {/* ── revoke session ── */}
              {modal.kind === "revokeSession" && selectedSession ? (
                <>
                  <div className="nt-pick">
                    <span className="nt-pick__label">Revoking</span>
                    <strong>{selectedSession.device}</strong>
                    <small className="mono">
                      {selectedSession.location} · {selectedSession.ip} · last seen{" "}
                      {relativeTo(selectedSession.lastSeenAt, data.asOf)}
                    </small>
                  </div>
                  <p className="nt-modal-note">
                    <Icon name="alert" size={13} /> The device will need a password and
                    a 2FA challenge before it can read this account again.
                  </p>
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--danger"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          { kind: "revokeSession", sessionId: selectedSession.id },
                          {
                            title: "Session revoked",
                            detail: `${selectedSession.device} · ${selectedSession.location}`,
                          },
                        )
                      }
                    >
                      <Icon name="shield" size={13} /> Revoke session
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── delivery log ── */}
              {modal.kind === "deliveryLog" ? (
                <>
                  <p className="nt-modal-lede">
                    Every channel the desk used, with the address on file and the
                    failures it recorded.
                  </p>
                  <div className="nt-delivery-table">
                    <table className="nt-table">
                      <thead>
                        <tr>
                          <th scope="col">Channel</th>
                          <th scope="col">Address</th>
                          <th scope="col">Verified</th>
                          <th scope="col">Sent</th>
                          <th scope="col">Failed</th>
                          <th scope="col">Last</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.deliveries.map((row) => (
                          <tr key={row.id}>
                            <td data-label="Channel">
                              <b>{channelLabel(row.channel)}</b>
                            </td>
                            <td data-label="Address" className="mono">
                              {row.address}
                            </td>
                            <td data-label="Verified">
                              <Tag tone={row.verified ? "is-win" : "is-warn"}>
                                {row.verified ? "yes" : "no"}
                              </Tag>
                            </td>
                            <td data-label="Sent" className="mono">
                              {row.sent}
                            </td>
                            <td data-label="Failed" className="mono">
                              {row.failed}
                            </td>
                            <td data-label="Last" className="mono">
                              {shortDateOf(row.lastAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="nt-note-list">
                    {data.deliveries.map((row) => (
                      <li key={`note-${row.id}`}>
                        <Icon name={row.verified ? "check" : "alert"} size={13} />
                        <span>
                          <b>{channelLabel(row.channel)}</b> — {row.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {/* ── rules list ── */}
              {modal.kind === "rulesList" ? (
                <>
                  <div className="nt-modal-toolbar">
                    <span className="nt-muted mono">
                      {data.rules.length}/{MAX_RULES} used ·{" "}
                      {data.rules.filter((rule) => rule.enabled).length} active
                    </span>
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary nt-btn--sm"
                      onClick={() => open("ruleWizard")}
                    >
                      <Icon name="plus" size={12} /> New rule
                    </button>
                  </div>
                  <ul className="nt-rule-list">
                    {data.rules.map((rule) => (
                      <li key={rule.id} className={rule.enabled ? "is-on" : ""}>
                        <div className="nt-rule-list__text">
                          <strong>{rule.label}</strong>
                          <small>
                            {categoryLabel(rule.category)} · {rule.action} · {rule.detail}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={`nt-switch ${rule.enabled ? "is-on" : ""}`}
                          role="switch"
                          aria-checked={rule.enabled}
                          aria-label={`Toggle ${rule.label}`}
                          onClick={() =>
                            void run(
                              { kind: "toggleRule", ruleId: rule.id },
                              {
                                title: rule.enabled ? "Rule disabled" : "Rule enabled",
                                detail: rule.label,
                              },
                            )
                          }
                        >
                          <span />
                        </button>
                        <button
                          type="button"
                          className="nt-btn nt-btn--sm nt-btn--danger"
                          aria-label={`Delete ${rule.label}`}
                          onClick={() =>
                            void run(
                              { kind: "deleteRule", ruleId: rule.id },
                              { title: "Rule deleted", detail: rule.label },
                            )
                          }
                        >
                          <Icon name="minus" size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {/* ── preferences summary ── */}
              {modal.kind === "preferencesSummary" ? (
                <>
                  <Kv
                    rows={[
                      [
                        "Digest",
                        `${data.preferences.digest} · ${String(data.preferences.digestHour).padStart(2, "0")}:00 UTC`,
                      ],
                      [
                        "Quiet hours",
                        data.preferences.quietHours.enabled
                          ? `${data.preferences.quietHours.from}–${data.preferences.quietHours.to} UTC`
                          : "Off",
                      ],
                      ["Trade floor", money(data.preferences.minTradeAmount)],
                      [
                        "Guardian overrides",
                        data.preferences.guardianAlerts ? "On" : "Off",
                      ],
                      ["Pool status", data.preferences.poolStatusAlerts ? "On" : "Off"],
                      ["Weekly summary", data.preferences.weeklySummary ? "On" : "Off"],
                      ["Desktop push", data.preferences.desktopPush ? "On" : "Off"],
                      ["Sound", data.preferences.sound ? "On" : "Off"],
                      [
                        "Channels on (trades)",
                        channels
                          .map(
                            (channel) =>
                              `${channelLabel(channel)} ${data.preferences.channels.trade[channel] ? "yes" : "no"}`,
                          )
                          .join(" · "),
                      ],
                    ]}
                  />
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary"
                      onClick={() => open("preferencesWizard")}
                    >
                      <Icon name="sliders" size={13} /> Edit
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── quiet hours ── */}
              {modal.kind === "quietHours" ? (
                <>
                  <div className="nt-quiet">
                    <span className="nt-quiet__from mono">
                      {data.preferences.quietHours.from}
                    </span>
                    <span className="nt-quiet__line" aria-hidden="true" />
                    <span className="nt-quiet__to mono">
                      {data.preferences.quietHours.to}
                    </span>
                  </div>
                  <p className="nt-modal-lede">
                    {data.preferences.quietHours.enabled
                      ? "Push and SMS are silenced inside this window. Email still queues and lands with the digest; Guardian and security alerts still break through."
                      : "Quiet hours are off — every enabled channel delivers as soon as an event lands."}
                  </p>
                  <ul className="nt-note-list">
                    <li>
                      <Icon name="check" size={13} />
                      <span>Trade and pool alerts roll into the next digest.</span>
                    </li>
                    <li>
                      <Icon name="check" size={13} />
                      <span>Payment alerts use email only overnight.</span>
                    </li>
                    <li>
                      <Icon name="alert" size={13} />
                      <span>Security alerts ignore quiet hours entirely.</span>
                    </li>
                  </ul>
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary"
                      onClick={() => open("preferencesWizard")}
                    >
                      <Icon name="sliders" size={13} /> Change the window
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── channel matrix ── */}
              {modal.kind === "channelMatrix" ? (
                <>
                  <div className="nt-channel-table">
                    <table className="nt-table nt-table--matrix">
                      <thead>
                        <tr>
                          <th scope="col">Category</th>
                          {channels.map((channel) => (
                            <th key={channel} scope="col">
                              {channelLabel(channel)}
                            </th>
                          ))}
                          <th scope="col">Unread</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          Object.keys(data.preferences.channels) as NotificationCategory[]
                        ).map((category) => (
                          <tr key={category}>
                            <th scope="row">
                              <Icon name={categoryIcon[category]} size={13} />{" "}
                              {categoryLabel(category)}
                            </th>
                            {channels.map((channel) => (
                              <td key={channel}>
                                <span
                                  className={`nt-mark ${data.preferences.channels[category][channel] ? "is-on" : ""}`}
                                >
                                  <Icon
                                    name={
                                      data.preferences.channels[category][channel]
                                        ? "check"
                                        : "minus"
                                    }
                                    size={12}
                                  />
                                </span>
                              </td>
                            ))}
                            <td className="mono">{counts[category].unread}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="nt-matric-note">
                    <Icon name="info" size={13} /> Security keeps in-app on at all
                    times. That cell is locked in the editor.
                  </p>
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary"
                      onClick={() => open("preferencesWizard")}
                    >
                      <Icon name="sliders" size={13} /> Edit the matrix
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── digest preview ── */}
              {modal.kind === "digestPreview" ? (
                <>
                  <div className="nt-digest">
                    <header>
                      <span className="nt-eyebrow">tradeMO · investor digest</span>
                      <strong>
                        {data.profile.displayName} · {shortDateOf(data.asOf)}
                      </strong>
                      <small className="mono">
                        {data.preferences.digest} ·{" "}
                        {String(data.preferences.digestHour).padStart(2, "0")}:00 UTC ·{" "}
                        {summary.unread} unread at send time
                      </small>
                    </header>
                    <ul>
                      <li>
                        <b>Trade activity</b>
                        <span className="mono">
                          {stats.trades} closed · {signedMoney(stats.net, 2)} net ·{" "}
                          {pct(stats.winRatePct, 1)} win rate
                        </span>
                      </li>
                      <li>
                        <b>Pool updates</b>
                        <span className="mono">
                          {
                            data.poolUpdates.filter((row) =>
                              row.kind.startsWith("guardian"),
                            ).length
                          }{" "}
                          Guardian events ·{" "}
                          {
                            data.poolUpdates.filter((row) => row.kind === "closing_soon")
                              .length
                          }{" "}
                          windows closing
                        </span>
                      </li>
                      <li>
                        <b>Payments</b>
                        <span className="mono">
                          {money(totals.deposits, 2)} in · {money(totals.payouts, 2)} out ·{" "}
                          {money(totals.inFlight, 2)} in flight
                        </span>
                      </li>
                      <li>
                        <b>Security</b>
                        <span className="mono">
                          {posture.logins} sign-ins · {posture.devices} sessions ·{" "}
                          {posture.failed} blocked
                        </span>
                      </li>
                    </ul>
                    <footer className="mono">
                      Sent to {data.profile.email} · manage in preferences
                    </footer>
                  </div>
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary"
                      onClick={() => open("preferencesWizard")}
                    >
                      <Icon name="sliders" size={13} /> Change cadence
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── pinned list ── */}
              {modal.kind === "pinnedList" ? (
                pinnedRows.length ? (
                  <ul className="nt-list">
                    {pinnedRows.map((row) => (
                      <li
                        key={row.id}
                        className={`nt-item is-unread ${levelTone(row.level)}`}
                      >
                        <button
                          type="button"
                          className="nt-item__main"
                          onClick={() =>
                            open("notificationDetail", () => setSelectedId(row.id))
                          }
                        >
                          <span className="nt-item__icon">
                            <Icon name="target" size={14} />
                          </span>
                          <span className="nt-item__text">
                            <strong>{row.title}</strong>
                            <small>{row.detail}</small>
                          </span>
                          <span className="nt-item__side mono">
                            {shortDateOf(row.at)} {clockShort(row.at)}
                          </span>
                        </button>
                        <div className="nt-item__actions">
                          <button
                            type="button"
                            aria-label={`Unpin ${row.title}`}
                            onClick={() =>
                              void run(
                                { kind: "togglePin", id: row.id },
                                { title: "Unpinned", detail: row.title },
                              )
                            }
                          >
                            <Icon name="close" size={13} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="nt-empty">
                    <span className="nt-empty__art" aria-hidden="true">
                      <Icon name="target" size={22} />
                    </span>
                    <strong>Nothing is pinned</strong>
                    <p>Pin a notification to float it above the newest row.</p>
                  </div>
                )
              ) : null}

              {/* ── snoozed list ── */}
              {modal.kind === "snoozedList" ? (
                snoozedRows.length ? (
                  <ul className="nt-list">
                    {snoozedRows.map((row) => (
                      <li key={row.id} className={`nt-item is-read ${levelTone(row.level)}`}>
                        <button
                          type="button"
                          className="nt-item__main"
                          onClick={() =>
                            open("notificationDetail", () => setSelectedId(row.id))
                          }
                        >
                          <span className="nt-item__icon">
                            <Icon name="clock" size={14} />
                          </span>
                          <span className="nt-item__text">
                            <strong>{row.title}</strong>
                            <small>
                              Snoozed until{" "}
                              {row.snoozedUntil
                                ? `${shortDateOf(row.snoozedUntil)} ${clockShort(row.snoozedUntil)} UTC`
                                : "further notice"}
                            </small>
                          </span>
                        </button>
                        <div className="nt-item__actions">
                          <button
                            type="button"
                            className="nt-btn nt-btn--sm"
                            onClick={() =>
                              void run(
                                { kind: "unsnooze", id: row.id },
                                { title: "Woken up", detail: row.title },
                              )
                            }
                          >
                            <Icon name="bell" size={12} /> Wake
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="nt-empty">
                    <span className="nt-empty__art" aria-hidden="true">
                      <Icon name="clock" size={22} />
                    </span>
                    <strong>Nothing is snoozed</strong>
                    <p>
                      Snoozing silences the alert without removing the row from the
                      record.
                    </p>
                  </div>
                )
              ) : null}

              {/* ── export history ── */}
              {modal.kind === "exportHistory" ? (
                <>
                  {data.exports.length ? (
                    <ul className="nt-export-list">
                      {data.exports.map((row: NotificationExport) => (
                        <li key={row.id}>
                          <span className="nt-export-list__icon">
                            <Icon name="file" size={14} />
                          </span>
                          <span className="nt-export-list__text">
                            <strong>
                              {exportScopes.find((scope) => scope.key === row.scope)?.label ??
                                row.scope}{" "}
                              · {row.format.toUpperCase()}
                            </strong>
                            <small className="mono">
                              {row.count} rows · {shortDateOf(row.createdAt)}{" "}
                              {clockShort(row.createdAt)} UTC
                            </small>
                          </span>
                          <button
                            type="button"
                            className="nt-btn nt-btn--sm"
                            onClick={() => {
                              const matrix = exportMatrix(data, row.scope);
                              if (row.format === "json") {
                                download(
                                  JSON.stringify(matrix, null, 2),
                                  `trademo-${row.scope}.json`,
                                  "application/json",
                                );
                              } else {
                                download(
                                  csvOf(matrix),
                                  `trademo-${row.scope}.csv`,
                                  "text/csv",
                                );
                              }
                            }}
                          >
                            <Icon name="download" size={12} /> Download
                          </button>
                          <button
                            type="button"
                            className="nt-icon-btn"
                            aria-label="Select export"
                            onClick={() => setSelectedExportId(row.id)}
                          >
                            <Icon
                              name={selectedExport?.id === row.id ? "check" : "info"}
                              size={13}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="nt-empty">
                      <span className="nt-empty__art" aria-hidden="true">
                        <Icon name="download" size={22} />
                      </span>
                      <strong>No exports yet</strong>
                      <p>
                        Every export is kept for this session so the same file can be
                        pulled twice.
                      </p>
                      <button
                        type="button"
                        className="nt-btn nt-btn--primary"
                        onClick={() => open("exportWizard")}
                      >
                        <Icon name="download" size={13} /> Build the first one
                      </button>
                    </div>
                  )}
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary"
                      onClick={() => open("exportWizard")}
                    >
                      <Icon name="download" size={13} /> New export
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── security posture ── */}
              {modal.kind === "securityPosture" ? (
                <>
                  <div className="nt-posture nt-posture--modal">
                    <div className="nt-posture__head">
                      <span className="nt-panel-label">Posture score</span>
                      <b className="mono nt-posture__score">{posture.score}</b>
                      <span className="nt-posture__band mono">
                        {posture.score >= 80
                          ? "strong"
                          : posture.score >= 60
                            ? "watch"
                            : "action needed"}
                      </span>
                    </div>
                    <div className="nt-posture__bar" aria-hidden="true">
                      <span style={{ width: `${posture.score}%` }} />
                    </div>
                    <ul className="nt-posture__checks">
                      {posture.checks.map((check) => (
                        <li key={check.label} className={check.ok ? "is-ok" : "is-warn"}>
                          <Icon name={check.ok ? "check" : "alert"} size={13} />
                          <span>
                            <strong>{check.label}</strong>
                            <small>{check.detail}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Kv
                    rows={[
                      ["Sign-ins recorded", String(posture.logins)],
                      ["Blocked attempts", String(posture.failed)],
                      ["Open sessions", `${posture.devices} (${posture.trusted} trusted)`],
                      ["2FA coverage", pct(posture.twoFactorPct, 0)],
                      ["Password age", `${posture.passwordAgeDays} days`],
                      [
                        "KYC",
                        `${posture.kycLevel} · verified ${
                          posture.kycVerifiedAt ? shortDateOf(posture.kycVerifiedAt) : "—"
                        }`,
                      ],
                      [
                        "Last sign-in",
                        posture.lastLoginAt
                          ? `${shortDateOf(posture.lastLoginAt)} ${clockShort(posture.lastLoginAt)} UTC`
                          : "—",
                      ],
                    ]}
                  />
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary"
                      onClick={() => open("sessions")}
                    >
                      <Icon name="key" size={13} /> Manage sessions
                    </button>
                    <button
                      type="button"
                      className="nt-btn"
                      onClick={() =>
                        open("exportWizard", () => setExportScope("security"))
                      }
                    >
                      <Icon name="download" size={13} /> Export the log
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── audit trail ── */}
              {modal.kind === "auditTrail" ? (
                <>
                  <p className="nt-modal-lede">
                    Every change made on this page in this session, newest first. The
                    desk never edits the inbox silently.
                  </p>
                  {data.audit.length ? (
                    <ul className="nt-audit">
                      {data.audit.map((row) => (
                        <li key={row.id}>
                          <span className="mono nt-audit__at">{clockShort(row.at)}</span>
                          <span className="nt-audit__action mono">{row.action}</span>
                          <span className="nt-audit__detail">{row.detail}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="nt-empty">
                      <span className="nt-empty__art" aria-hidden="true">
                        <Icon name="terminal" size={22} />
                      </span>
                      <strong>Nothing changed yet</strong>
                      <p>
                        Mark a row read, pin one or save preferences and the audit trail
                        fills in here.
                      </p>
                    </div>
                  )}
                  <Kv
                    rows={[
                      ["Revision", String(data.revision)],
                      ["Entries kept", `${data.audit.length} of 24`],
                      ["Exports", `${data.exports.length} of ${MAX_EXPORTS}`],
                      ["Support drafts", `${data.support.length} of 12`],
                    ]}
                  />
                </>
              ) : null}

              {/* ── reset inbox ── */}
              {modal.kind === "resetInbox" ? (
                <>
                  <p className="nt-modal-lede">
                    This puts every notification back to unread, clears pins and wakes
                    anything snoozed. Nothing is deleted and no delivery is re-sent.
                  </p>
                  <Kv
                    rows={[
                      ["Notifications", String(summary.total)],
                      ["Unread after", String(summary.total)],
                      ["Pins cleared", String(summary.pinned)],
                      ["Snoozes cleared", String(summary.snoozed)],
                    ]}
                  />
                </>
              ) : null}

              {/* ── badge settings ── */}
              {modal.kind === "badgeSettings" ? (
                <>
                  <div className="nt-toggle-stack">
                    <Toggle
                      label="Desktop notifications"
                      hint="Browser push while the desk is open"
                      checked={draftPrefs.desktopPush}
                      onChange={(next) =>
                        setDraftPrefs((prev) => ({ ...prev, desktopPush: next }))
                      }
                    />
                    <Toggle
                      label="Alert sound"
                      hint="One chime for critical rows only"
                      checked={draftPrefs.sound}
                      onChange={(next) =>
                        setDraftPrefs((prev) => ({ ...prev, sound: next }))
                      }
                    />
                    <Toggle
                      label="Weekly summary"
                      hint="Sunday 18:00 UTC"
                      checked={draftPrefs.weeklySummary}
                      onChange={(next) =>
                        setDraftPrefs((prev) => ({ ...prev, weeklySummary: next }))
                      }
                    />
                  </div>
                  <Kv
                    rows={[
                      ["Badge shows", `${summary.unread} unread`],
                      ["Polling", "Every 30 seconds while open"],
                      ["Critical rows", String(summary.critical)],
                    ]}
                  />
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn nt-btn--primary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await updatePreferences.mutateAsync({
                            channels: draftPrefs.channels,
                            digest: draftPrefs.digest,
                            digestHour: draftPrefs.digestHour,
                            quietHours: draftPrefs.quietHours,
                            minTradeAmount: draftPrefs.minTradeAmount,
                            guardianAlerts: draftPrefs.guardianAlerts,
                            poolStatusAlerts: draftPrefs.poolStatusAlerts,
                            sound: draftPrefs.sound,
                            desktopPush: draftPrefs.desktopPush,
                            weeklySummary: draftPrefs.weeklySummary,
                          });
                          pushToast({
                            tone: "success",
                            title: "Badge settings saved",
                            detail: "Sound, desktop push and weekly summary updated.",
                          });
                          close();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Could not save");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Icon name="check" size={13} /> Save
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── boundaries ── */}
              {modal.kind === "boundaries" ? (
                <>
                  <p className="nt-modal-lede">
                    This desk is a frontend-first demo on a single structured snapshot.
                    Here is exactly what is real and what is previewed.
                  </p>
                  <ul className="nt-note-list">
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Real reads</b> — the trade ledger, pool book, Guardian log,
                        wallet statement and sign-in record all come from the same
                        services the other investor pages use.
                      </span>
                    </li>
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Validated writes</b> — read state, pins, snoozes, rules,
                        preferences and exports run through the shared command schema
                        before they touch the snapshot.
                      </span>
                    </li>
                    <li>
                      <Icon name="alert" size={13} />
                      <span>
                        <b>Not wired</b> — nothing is emailed, texted or pushed, and no
                        payout is triggered from this page. Writes answer 405 on the
                        route on purpose.
                      </span>
                    </li>
                    <li>
                      <Icon name="info" size={13} />
                      <span>
                        <b>Contract</b> — <code>PATCH /api/notifications/:id/read</code>,{" "}
                        <code>POST /api/notifications/mark-all-read</code> and{" "}
                        <code>PATCH /api/settings/notifications</code> are the eventual
                        endpoints.
                      </span>
                    </li>
                  </ul>
                  <div className="nt-modal-actions">
                    <button
                      type="button"
                      className="nt-btn"
                      onClick={() => open("auditTrail")}
                    >
                      <Icon name="terminal" size={13} /> Audit trail
                    </button>
                    <button
                      type="button"
                      className="nt-btn"
                      onClick={() => open("deliveryLog")}
                    >
                      <Icon name="file" size={13} /> Delivery log
                    </button>
                  </div>
                </>
              ) : null}
            </DeskModalShell>
          </div>
        ) : null}

        {/* ── desk-level shortcuts ── */}
        <div className="nt-shortcuts">
          <button type="button" onClick={() => open("preferencesSummary")}>
            <Icon name="sliders" size={14} /> Preferences in force
          </button>
          <button type="button" onClick={() => open("badgeSettings")}>
            <Icon name="bell" size={14} /> Badge &amp; sound
          </button>
          <button type="button" onClick={() => open("exportHistory")}>
            <Icon name="download" size={14} /> Exports {data.exports.length}/{MAX_EXPORTS}
          </button>
          <button type="button" onClick={() => open("sessions")}>
            <Icon name="key" size={14} /> Sessions {data.sessions.length}
          </button>
          <button type="button" onClick={() => open("auditTrail")}>
            <Icon name="terminal" size={14} /> Audit {data.audit.length}
          </button>
          <button type="button" onClick={() => open("resetInbox")}>
            <Icon name="refresh" size={14} /> Reset inbox
          </button>
          <button type="button" onClick={() => open("boundaries")}>
            <Icon name="info" size={14} /> What is real here
          </button>
        </div>
      </div>
    </InvestorShell>
  );
}
