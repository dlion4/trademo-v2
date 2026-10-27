"use client";

import { useForm } from "@tanstack/react-form";
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
  MIN_PAYOUT,
  PAYOUT_LOCK_DAYS,
  atStamp,
  clockOf,
  computeSummary,
  countdown,
  dateOf,
  dayStamp,
  daysBetween,
  filterTimeline,
  groupTimeline,
  money,
  paymentLabel,
  payoutDraftError,
  payoutFee,
  payoutLabel,
  round2,
  shortDateOf,
  signedMoney,
  signedPct,
  stageLabel,
  suggestedPayout,
  timelineKinds,
  timelineLabel,
  type ActiveInvestment,
  type BookedSlot,
  type CompletedInvestment,
  type InvestmentsCommand,
  type InvestmentsWorkspace,
  type PayoutMethod,
  type PayoutRecord,
  type TimelineEvent,
  type TimelineKind,
} from "@/lib/investor/investments";
import { useInvestments } from "@/lib/investor/use-investments";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  InvestorShell,
  type InvestorDrawerTab,
  type InvestorNavKey,
  type InvestorQuickAction,
} from "./investor-shell";

/* ── Small formatters ── */

const num = (value: number, decimals = 0) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const pct = (value: number, decimals = 2) =>
  `${Math.abs(value).toFixed(decimals)}%`;
const tone = (value: number) =>
  value > 0 ? "is-pos" : value < 0 ? "is-neg" : "is-flat";
const stageTone = (stage: string) =>
  stage === "active"
    ? "is-trading"
    : stage === "completed"
      ? "is-completed"
      : stage === "booked"
        ? "is-booked"
        : "is-interest";
const payoutTone = (status: string) =>
  status === "paid"
    ? "is-paid"
    : status === "processing"
      ? "is-processing"
      : status === "scheduled"
        ? "is-scheduled"
        : "is-cancelled";
const kindTone = (kind: TimelineKind) =>
  kind === "trade"
    ? "is-trade"
    : kind === "payout"
      ? "is-payout"
      : kind === "pool"
        ? "is-pool"
        : kind === "booking"
          ? "is-booking"
          : kind === "interest"
            ? "is-interest"
            : kind === "kyc"
              ? "is-kyc"
              : kind === "account"
                ? "is-account"
                : "is-milestone";

/* ── Dialog registry ── */

type Kind =
  | "activeDetail"
  | "earnings"
  | "payoutRequest"
  | "payoutPolicy"
  | "payoutHistory"
  | "payoutDetails"
  | "completedDetail"
  | "statementExport"
  | "bookingDetail"
  | "addSlots"
  | "cancelInterest"
  | "reminder"
  | "cancelPayout"
  | "retryPayout"
  | "preferences"
  | "risk"
  | "settlement"
  | "kyc"
  | "documents"
  | "notes"
  | "support"
  | "allocation"
  | "milestone"
  | "help";

const titles: Record<Kind, string> = {
  activeDetail: "Position detail",
  earnings: "How this position earned",
  payoutRequest: "Request a payout",
  payoutPolicy: "Payout policy",
  payoutHistory: "Payout history",
  payoutDetails: "Payout advice",
  completedDetail: "Settled cycle",
  statementExport: "Statement & export",
  bookingDetail: "Booked slot",
  addSlots: "Add more slots",
  cancelInterest: "Cancel registered interest",
  reminder: "Booking reminder",
  cancelPayout: "Cancel this payout",
  retryPayout: "Retry this payout",
  preferences: "Holding preferences",
  risk: "Risk disclosure",
  settlement: "Settlement terms",
  kyc: "Verification status",
  documents: "Statements & documents",
  notes: "Investment journal",
  support: "Message the investor desk",
  allocation: "Capital allocation",
  milestone: "Upcoming pool",
  help: "Workspace boundaries",
};

const wizardSteps: Partial<Record<Kind, readonly string[]>> = {
  payoutRequest: ["Amount & destination", "Review", "Acknowledge"],
  addSlots: ["Slots", "Quote", "Confirm"],
  cancelInterest: ["Reason", "Confirm"],
  reminder: ["Timing", "Confirm"],
  cancelPayout: ["Reason", "Confirm"],
  statementExport: ["Scope", "Format", "Confirm"],
  preferences: ["Holding rules", "Confirm"],
  support: ["Topic", "Message", "Confirm"],
};

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  activeDetail: "lg",
  earnings: "md",
  payoutRequest: "md",
  payoutPolicy: "md",
  payoutHistory: "xl",
  payoutDetails: "md",
  completedDetail: "lg",
  statementExport: "md",
  bookingDetail: "md",
  addSlots: "md",
  cancelInterest: "sm",
  reminder: "sm",
  cancelPayout: "sm",
  retryPayout: "sm",
  preferences: "md",
  risk: "lg",
  settlement: "lg",
  kyc: "lg",
  documents: "xl",
  notes: "lg",
  support: "md",
  allocation: "lg",
  milestone: "md",
  help: "lg",
};

const quickActions: InvestorQuickAction[] = [
  {
    key: "payout",
    label: "Request a payout",
    short: "Payout",
    icon: "download",
  },
  {
    key: "statement",
    label: "Statements & exports",
    short: "Statement",
    icon: "file",
  },
  {
    key: "timeline",
    label: "Investment timeline",
    short: "Timeline",
    icon: "activity",
  },
  { key: "slots", label: "Add more slots", short: "Slots", icon: "plus" },
  { key: "payouts", label: "Payout history", short: "Payouts", icon: "wallet" },
  {
    key: "pools",
    label: "All crowdfunding pools",
    short: "Pools",
    icon: "pool",
  },
];

const sections = [
  { key: "summary", label: "Summary", id: "im-summary" },
  { key: "active", label: "Active", id: "im-active" },
  { key: "completed", label: "Completed", id: "im-completed" },
  { key: "booked", label: "Booked", id: "im-booked" },
  { key: "timeline", label: "Timeline", id: "im-timeline" },
] as const;

const TIMELINE_PAGE = 8;

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
    <header className="im-section-head">
      <div>
        <span className="im-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="im-section-aside">{aside}</div> : null}
    </header>
  );
}

function Kpi({
  label,
  value,
  hint,
  note,
  footnote,
  className,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  label: string;
  value: number;
  hint: string;
  note?: string;
  footnote?: string;
  className?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const shown = useLiveCountUp(value);
  return (
    <article className={`im-kpi ${className ?? ""}`.trim()}>
      <span className="im-kpi__label">{label}</span>
      <b className="im-kpi__value mono">
        {prefix}
        {num(shown, decimals)}
        {suffix}
      </b>
      <span className="im-kpi__hint">{hint}</span>
      {note ? <span className="im-kpi__note">{note}</span> : null}
      {footnote ? <span className="im-kpi__foot mono">{footnote}</span> : null}
    </article>
  );
}

function Tag({
  children,
  tone: tagTone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`im-tag ${tagTone}`.trim()}>{children}</span>;
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="im-fact">
      <span>{label}</span>
      <b className="mono">{value}</b>
    </div>
  );
}

/* ── Page ── */

export function InvestorInvestmentsPage({
  initial,
  initialAction,
}: {
  initial: InvestmentsWorkspace;
  initialAction?: string;
}) {
  const router = useRouter();
  const { data, command } = useInvestments(initial);
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
    summary: "allocation",
    allocation: "allocation",
    active: "activeDetail",
    earnings: "earnings",
    payout: "payoutRequest",
    payouts: "payoutHistory",
    history: "payoutHistory",
    policy: "payoutPolicy",
    completed: "completedDetail",
    statement: "statementExport",
    statements: "statementExport",
    documents: "documents",
    booked: "bookingDetail",
    slots: "addSlots",
    interest: "cancelInterest",
    reminder: "reminder",
    timeline: "notes",
    journal: "notes",
    kyc: "kyc",
    risk: "risk",
    settlement: "settlement",
    preferences: "preferences",
    support: "support",
    milestone: "milestone",
    help: "help",
  };

  const [modal, setModal] = useState<{ kind: Kind } | null>(() => {
    const kind = initialAction ? actionMap[initialAction] : undefined;
    return kind ? { kind } : null;
  });
  const [wizardStep, setWizardStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<
    "overview" | "payouts" | "timeline" | null
  >(null);
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("portfolio");
  const [clock, setClock] = useState(initial.asOf);
  const [timelineWindow, setTimelineWindow] = useState(TIMELINE_PAGE);
  const [selectedActive, setSelectedActive] = useState(
    initial.active[0]?.id ?? "",
  );
  const [selectedCompleted, setSelectedCompleted] = useState(
    initial.completed[0]?.id ?? "",
  );
  const [selectedBooked, setSelectedBooked] = useState(
    initial.booked[0]?.id ?? "",
  );
  const [selectedPayout, setSelectedPayout] = useState(
    initial.payouts[0]?.id ?? "",
  );
  const [selectedDoc, setSelectedDoc] = useState(
    initial.documents[0]?.id ?? "",
  );
  const [selectedMilestone, setSelectedMilestone] = useState(
    initial.milestones[0]?.id ?? "",
  );
  const [historySorting, setHistorySorting] = useState<SortingState>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv" | "json">(
    "pdf",
  );
  const [exportScope, setExportScope] = useState<
    "statement" | "portfolio" | "timeline" | "payouts"
  >("statement");
  const [payoutAmount, setPayoutAmount] = useState(
    suggestedPayout(initial.active[0]?.availablePayout ?? 0),
  );
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("bank");
  const [payoutNote, setPayoutNote] = useState("");
  const [cancelReason, setCancelReason] = useState<
    "changed_plan" | "wrong_method" | "faster_route" | "other"
  >("changed_plan");
  const [interestReason, setInterestReason] = useState<
    "changed_plan" | "capacity" | "timing" | "other"
  >("timing");
  const [extraSlots, setExtraSlots] = useState(1);
  const [reminderLead, setReminderLead] = useState<1 | 2 | 3 | 7>(2);
  const [reminderChannel, setReminderChannel] = useState<"email" | "in_app">(
    "email",
  );
  const [prefEmail, setPrefEmail] = useState(
    initial.preferences.emailStatements,
  );
  const [prefReinvest, setPrefReinvest] = useState(
    initial.preferences.autoReinvest,
  );
  const [prefHide, setPrefHide] = useState(initial.preferences.hideCompleted);
  const [prefLead, setPrefLead] = useState<1 | 2 | 3 | 7>(
    initial.preferences.payoutLeadDays,
  );
  const [noteBody, setNoteBody] = useState("");
  const [supportTopic, setSupportTopic] = useState<
    "payout" | "statement" | "booking" | "kyc" | "other"
  >("payout");
  const [supportMessage, setSupportMessage] = useState("");
  const closeRef = useRef<() => void>(() => {});

  const filterForm = useForm({
    defaultValues: {
      kinds: data.filters.kinds as TimelineKind[],
      query: data.filters.query,
    },
    onSubmit: ({ value }) => {
      void run(
        { kind: "saveFilters", kinds: value.kinds, query: value.query },
        { keep: true, title: "Timeline filter stored locally" },
      );
    },
  });

  /* ── Derived ── */

  const summary = useMemo(
    () =>
      computeSummary({
        active: data.active,
        completed: data.completed,
        booked: data.booked,
        payouts: data.payouts,
      }),
    [data.active, data.completed, data.booked, data.payouts],
  );
  /** Money still committed to the book: capital at work + capital awaiting
   *  trading + accrued net earnings on the live positions. Settled cycles sit
   *  in the wallet, so they are deliberatey excluded from this figure. */
  const accruedActive = useMemo(
    () => round2(summary.totalEarned - summary.completedNet),
    [summary.totalEarned, summary.completedNet],
  );
  const holdingsValue = round2(
    summary.activeCapital + summary.bookedCapital + accruedActive,
  );

  const activeRow =
    data.active.find((row) => row.id === selectedActive) ??
    data.active[0] ??
    null;
  const completedRow =
    data.completed.find((row) => row.id === selectedCompleted) ??
    data.completed[0] ??
    null;
  const bookedRow =
    data.booked.find((row) => row.id === selectedBooked) ??
    data.booked[0] ??
    null;
  const payoutRow =
    data.payouts.find((row) => row.id === selectedPayout) ??
    data.payouts[0] ??
    null;
  const documentRow =
    data.documents.find((row) => row.id === selectedDoc) ??
    data.documents[0] ??
    null;
  const milestoneRow =
    data.milestones.find((row) => row.id === selectedMilestone) ??
    data.milestones[0] ??
    null;

  const timeline = useMemo(
    () => filterTimeline(data.timeline, data.filters),
    [data.timeline, data.filters],
  );
  const visibleTimeline = timeline.slice(0, timelineWindow);
  const groups = useMemo(
    () => groupTimeline(visibleTimeline),
    [visibleTimeline],
  );

  const payable = data.active.filter((row) => row.payoutEligible);
  const pendingPayouts = data.payouts.filter(
    (row) => row.status === "processing" || row.status === "scheduled",
  );
  const completedVisible = data.preferences.hideCompleted
    ? data.completed.slice(0, 1)
    : data.completed;

  const allocationTotal = summary.totalInvested || 1;

  /* ── Clock ── */

  useEffect(() => {
    const timer = window.setInterval(
      () => setClock((prev) => new Date(Date.parse(prev) + 1000).toISOString()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  /* ── Overlay behaviour ── */

  const overlay = Boolean(modal || drawer);
  useEffect(() => {
    if (!overlay) return;
    const prior = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      if (prior && document.contains(prior)) prior.focus();
    };
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlay]);

  useEffect(() => {
    closeRef.current = close;
  });

  /* ── Actions ── */

  function close() {
    setModal(null);
    setDrawer(null);
    setWizardStep(0);
    setConfirmed(false);
    setError("");
  }

  function open(kind: Kind) {
    setModal({ kind });
    setWizardStep(0);
    setConfirmed(false);
    setError("");
    setDrawer(null);
    if (kind === "payoutRequest" && activeRow) {
      setPayoutAmount(suggestedPayout(activeRow.availablePayout));
      setPayoutMethod("bank");
      setPayoutNote("");
    }
    if (kind === "addSlots") {
      setExtraSlots(1);
      setSelectedBooked(
        data.booked.find((row) => row.stage === "booked")?.id ?? selectedBooked,
      );
    }
  }

  function openActive(id: string, kind: Kind = "activeDetail") {
    setSelectedActive(id);
    open(kind);
  }

  function openCompleted(id: string, kind: Kind = "completedDetail") {
    setSelectedCompleted(id);
    open(kind);
  }

  function openBooked(id: string, kind: Kind = "bookingDetail") {
    setSelectedBooked(id);
    open(kind);
  }

  function openPayout(id: string, kind: Kind = "payoutDetails") {
    setSelectedPayout(id);
    open(kind);
  }

  function scrollTo(id: string) {
    if (typeof document === "undefined") return;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function run(
    input: InvestmentsCommand,
    opts?: { keep?: boolean; title?: string; detail?: string },
  ) {
    setError("");
    setBusy(true);
    try {
      await command.mutateAsync(input);
      pushToast({
        tone: "success",
        title: opts?.title ?? "Local preview updated",
        detail:
          opts?.detail ??
          "Held in this browser session. No payout was queued with a provider and no money moved.",
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

  const download = (value: BlobPart, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const csvOf = (rows: Record<string, unknown>[]) => {
    const keys = Object.keys(rows[0] ?? { note: "" });
    return [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
  };

  function scopeRows(scope: typeof exportScope, investmentId: string | null) {
    if (scope === "portfolio") {
      return [
        ...data.active.map((row) => ({
          pool: row.code,
          stage: "active",
          slots: row.slots,
          invested: row.investment,
          earned: row.netEarned,
          current_value: row.currentValue,
          roi_pct: row.roiPct,
        })),
        ...data.completed.map((row) => ({
          pool: row.code,
          stage: "completed",
          slots: row.slots,
          invested: row.investment,
          earned: row.netEarnings,
          current_value: 0,
          roi_pct: row.userRoiPct,
        })),
      ];
    }
    if (scope === "timeline") {
      return timeline.map((event) => ({
        at: event.at,
        kind: event.kind,
        title: event.title,
        pool: event.poolCode ?? "",
        amount: event.amount ?? "",
        status: event.status,
      }));
    }
    if (scope === "payouts") {
      return data.payouts.map((row) => ({
        reference: row.reference,
        pool: row.poolCode,
        amount: row.amount,
        fee: row.fee,
        net: row.net,
        status: row.status,
        method: row.method,
        requested_at: row.requestedAt,
        paid_at: row.processedAt ?? "",
      }));
    }
    const row =
      data.completed.find((entry) => entry.id === investmentId) ??
      data.active.find((entry) => entry.id === investmentId) ??
      completedRow;
    if (!row) return [{ note: "Nothing to export" }];
    if (row.stage === "completed") {
      const settled = row as CompletedInvestment;
      return [
        { field: "Pool", value: `${settled.code} · ${settled.name}` },
        { field: "Statement", value: settled.statementRef },
        { field: "Slots", value: String(settled.slots) },
        { field: "Invested", value: money(settled.investment, 2) },
        { field: "Share of pool", value: `${settled.sharePct}%` },
        {
          field: "Trading period",
          value: `${settled.startedAt.slice(0, 10)} → ${settled.completedAt.slice(0, 10)}`,
        },
        { field: "Gross earnings", value: money(settled.grossEarnings, 2) },
        { field: "Platform cut (20%)", value: money(-settled.platformCut, 2) },
        { field: "Net paid", value: money(settled.netEarnings, 2) },
        { field: "Final ROI", value: `${settled.userRoiPct.toFixed(2)}%` },
        { field: "Payout reference", value: settled.payoutRef },
        {
          field: "Paid at",
          value: settled.paidAt ? atStamp(settled.paidAt) : "—",
        },
      ];
    }
    const live = row as ActiveInvestment;
    return [
      { field: "Pool", value: `${live.code} · ${live.name}` },
      { field: "Stage", value: "Trading" },
      { field: "Slots", value: `${live.slots} × ${money(live.slotPrice)}` },
      { field: "Invested", value: money(live.investment, 2) },
      { field: "Investor share", value: `${live.sharePct}%` },
      { field: "Payment", value: `${live.paymentMethod} · ${live.paymentRef}` },
      { field: "Current value", value: money(live.currentValue, 2) },
      { field: "Net earnings", value: signedMoney(live.netEarned, 2) },
      { field: "Gross earnings", value: signedMoney(live.grossEarned, 2) },
      { field: "Platform cut", value: signedMoney(-live.platformCut, 2) },
      { field: "ROI", value: signedPct(live.roiPct) },
      { field: "Ends", value: atStamp(live.endsAt) },
    ];
  }

  async function exportRows(
    scope: typeof exportScope,
    investmentId: string | null,
    heading: string,
  ) {
    setBusy(true);
    try {
      const rows = scopeRows(scope, investmentId);
      const stamp = data.asOf.slice(0, 10);
      const fileBase = `trademo-${scope === "statement" ? "statement" : scope}`;
      if (exportFormat === "json") {
        download(
          JSON.stringify(
            {
              mode: "demo",
              asOf: data.asOf,
              scope,
              investor: data.profile.id,
              rows,
            },
            null,
            2,
          ),
          `${fileBase}-${stamp}.json`,
          "application/json",
        );
      } else if (exportFormat === "csv") {
        download(csvOf(rows), `${fileBase}-${stamp}.csv`, "text/csv");
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setFontSize(15);
        doc.text(`tradeMO / ${heading}`, 18, 22);
        doc.setFontSize(9);
        doc.text(
          `Investor ${data.profile.displayName} · ${data.profile.kycLevel} verified`,
          18,
          30,
        );
        doc.text(
          `Source snapshot ${data.asOf} · demo export · not a payment confirmation`,
          18,
          36,
        );
        let y = 48;
        doc.setFontSize(8);
        rows.forEach((row) => {
          if (y > 276) {
            doc.addPage();
            y = 20;
          }
          const line =
            "field" in row
              ? `${String(row.field)}: ${String(row.value).slice(0, 120)}`
              : Object.entries(row)
                  .map(([key, value]) => `${key}=${String(value)}`)
                  .join(" · ")
                  .slice(0, 150);
          doc.text(line, 18, y);
          y += 6;
        });
        doc.save(`${fileBase}-${stamp}.pdf`);
      }
      await run(
        {
          kind: "exportReport",
          scope,
          format: exportFormat,
          count: rows.length,
          investmentId,
        },
        {
          keep: true,
          title: `${heading} generated in-browser`,
          detail: `${rows.length} line(s) · ${exportFormat.toUpperCase()} · demo export only.`,
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  /* ── Payout wizard helpers ── */

  const payoutTarget = activeRow;
  const payoutLimit = payoutTarget?.availablePayout ?? 0;
  const payoutError =
    payoutTarget && modal?.kind === "payoutRequest"
      ? payoutDraftError({
          amount: payoutAmount,
          available: payoutLimit,
          unlocked: payoutTarget.payoutEligible,
          method: payoutMethod,
          bankAccount: data.profile.bankAccount,
          terms: true,
        })
      : "";

  /* ── Payout history table ── */

  const historyColumn = useMemo(
    () => createDeskColumnHelper<PayoutRecord>(),
    [],
  );
  const historyColumns = useMemo(
    () =>
      historyColumn.columns([
        historyColumn.accessor("reference", {
          header: "Reference",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        historyColumn.accessor("poolCode", { header: "Pool" }),
        historyColumn.accessor("amount", {
          header: "Requested",
          cell: (info) => (
            <span className="mono">{money(info.getValue(), 2)}</span>
          ),
        }),
        historyColumn.accessor("fee", {
          header: "Fee",
          cell: (info) => (
            <span className="mono">
              {info.getValue() ? money(info.getValue(), 2) : "—"}
            </span>
          ),
        }),
        historyColumn.accessor("net", {
          header: "Net",
          cell: (info) => (
            <span className="mono is-pos">{money(info.getValue(), 2)}</span>
          ),
        }),
        historyColumn.accessor("method", {
          header: "Route",
          cell: (info) => (info.getValue() === "bank" ? "Bank" : "Wallet"),
        }),
        historyColumn.accessor("status", {
          header: "Status",
          cell: (info) => (
            <Tag tone={payoutTone(info.getValue())}>
              {payoutLabel(info.getValue())}
            </Tag>
          ),
        }),
        historyColumn.accessor("requestedAt", {
          header: "Requested",
          cell: (info) => (
            <span className="mono">{shortDateOf(info.getValue())}</span>
          ),
        }),
        historyColumn.accessor("processedAt", {
          header: "Paid",
          cell: (info) => (
            <span className="mono">
              {info.getValue() ? shortDateOf(info.getValue() as string) : "—"}
            </span>
          ),
        }),
      ]),
    [historyColumn],
  );
  const historyRows = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return data.payouts;
    return data.payouts.filter((row) =>
      `${row.reference} ${row.poolCode} ${row.status} ${row.method}`
        .toLowerCase()
        .includes(query),
    );
  }, [data.payouts, historyQuery]);
  const historyTable = useDeskTable({
    data: historyRows,
    columns: historyColumns,
    state: { sorting: historySorting },
    onSortingChange: setHistorySorting,
  });

  /* ── Wizard footer ── */

  const wizardFor = modal ? wizardSteps[modal.kind] : undefined;
  const wizard = wizardFor ? [...wizardFor] : undefined;
  const lastStep = wizard ? wizard.length - 1 : 0;

  const modalBlock = (() => {
    if (!modal) return "";
    if (modal.kind === "payoutRequest") {
      if (!payoutTarget) return "Choose a position first";
      const lock = countdown(payoutTarget.payoutEligibleAt, clock);
      if (!payoutTarget.payoutEligible)
        return `This position unlocks ${dateOf(payoutTarget.payoutEligibleAt)} — ${lock.label} to go (${PAYOUT_LOCK_DAYS}-day lock)`;
      return payoutError;
    }
    if (modal.kind === "cancelInterest" && bookedRow?.stage !== "interest")
      return "Only a registered interest can be cancelled here";
    if (modal.kind === "cancelPayout" && payoutRow?.status !== "processing")
      return "Only a payout that is still processing can be cancelled";
    if (modal.kind === "retryPayout" && payoutRow?.status !== "cancelled")
      return "Only a cancelled payout can be retried";
    if (modal.kind === "addSlots") {
      const target = data.booked.find((row) => row.stage === "booked");
      if (!target) return "There is no open booking to add slots to";
      if (extraSlots < 1 || extraSlots > target.slotsRemaining)
        return `Choose between 1 and ${target.slotsRemaining} slot(s)`;
    }
    if (modal.kind === "support" && supportMessage.trim().length < 12)
      return "Add at least 12 characters so the desk can act on it";
    if (modal.kind === "notes" && noteBody.trim().length < 8)
      return "Write at least 8 characters before saving the note";
    return "";
  })();

  async function finishWizard() {
    if (!modal) return;
    if (modal.kind === "payoutRequest" && payoutTarget) {
      await run({
        kind: "requestPayout",
        investmentId: payoutTarget.id,
        amount: payoutAmount,
        method: payoutMethod,
        note: payoutNote,
      });
      return;
    }
    if (modal.kind === "addSlots") {
      const target = data.booked.find((row) => row.stage === "booked");
      if (!target) return;
      close();
      router.push(`/investor/pools/${target.poolId}/book`);
      return;
    }
    if (modal.kind === "cancelInterest" && bookedRow) {
      await run({
        kind: "cancelInterest",
        bookedId: bookedRow.id,
        reason: interestReason,
      });
      return;
    }
    if (modal.kind === "reminder" && bookedRow) {
      await run({
        kind: "saveReminder",
        bookedId: bookedRow.id,
        leadDays: reminderLead,
        channel: reminderChannel,
      });
      return;
    }
    if (modal.kind === "cancelPayout" && payoutRow) {
      await run({
        kind: "cancelPayout",
        payoutId: payoutRow.id,
        reason: cancelReason,
      });
      return;
    }
    if (modal.kind === "statementExport") {
      await exportRows(
        exportScope,
        modal.kind === "statementExport" ? (completedRow?.id ?? null) : null,
        "Portfolio statement",
      );
      return;
    }
    if (modal.kind === "preferences") {
      await run({
        kind: "savePreferences",
        emailStatements: prefEmail,
        autoReinvest: prefReinvest,
        payoutLeadDays: prefLead,
        reminderChannel: reminderChannel,
        hideCompleted: prefHide,
      });
      return;
    }
    if (modal.kind === "support") {
      await run({
        kind: "support",
        topic: supportTopic,
        message: supportMessage.trim(),
      });
      return;
    }
    if (modal.kind === "risk" || modal.kind === "settlement")
      await run(
        {
          kind: "acknowledge",
          scope: modal.kind === "risk" ? "risk" : "settlement",
        },
        { title: "Acknowledgement recorded locally" },
      );
  }

  const modalFooter = (
    <>
      {wizard && wizardStep === lastStep ? (
        <label className="im-check im-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-label="Acknowledge local preview"
          />
          I have reviewed this local preview and understand nothing is sent to a
          bank, a payment provider or the trading desk.
        </label>
      ) : null}
      <button
        type="button"
        className="im-btn"
        disabled={busy}
        onClick={() => (wizardStep ? setWizardStep(wizardStep - 1) : close())}
      >
        {wizardStep ? "Back" : "Close"}
      </button>
      <span className="im-foot-note">
        Session-only preview · no money moves
      </span>
      {wizard ? (
        <button
          type="button"
          className="im-btn im-btn--primary"
          disabled={
            busy ||
            (!!modalBlock && wizardStep === lastStep) ||
            (wizardStep === lastStep && !confirmed)
          }
          onClick={() => {
            if (wizardStep < lastStep) {
              if (
                modal?.kind === "payoutRequest" &&
                modalBlock &&
                wizardStep === 0
              )
                return;
              setWizardStep(wizardStep + 1);
              return;
            }
            void finishWizard();
          }}
        >
          {busy
            ? "Working…"
            : wizardStep < lastStep
              ? "Continue →"
              : modal?.kind === "addSlots"
                ? "Open booking"
                : "Confirm local preview"}
        </button>
      ) : null}
    </>
  );

  /* ── Render ── */

  return (
    <InvestorShell
      rootClass="page-investor-investments"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={data.profile.committed}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.profile.wallet}
      unread={data.profile.unread}
      activeNav={activeNav}
      detailHref="/investor/pools/pkg_01"
      bookHref="/investor/pools/pkg_02/book"
      quickActions={quickActions}
      onNavigate={(key) => {
        setActiveNav(key);
        if (key === "overview") return router.push("/investor");
        if (key === "pools" || key === "detail")
          return router.push("/investor/pools");
        if (key === "book") return router.push("/investor/pools/pkg_02/book");
        if (key === "live") return router.push("/investor/live");
        if (key === "wallet") return router.push("/investor/wallet");
        if (key === "calculator") return router.push("/investor/calculator");
        if (key === "notifications")
          return router.push("/investor/notifications");
        if (key === "earnings") return router.push("/investor/earnings");
        if (key === "activity") return router.push("/investor/activity");
        if (key === "settings") return router.push("/investor?action=profile");
        if (key === "upcoming") return router.push("/investor/pools");
        setDrawer("overview");
      }}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(
          tab === "portfolio"
            ? "overview"
            : tab === "activity"
              ? "timeline"
              : "payouts",
        )
      }
      onQuickAction={(key) => {
        if (key === "payout") return open("payoutRequest");
        if (key === "statement") return open("statementExport");
        if (key === "timeline") return scrollTo("im-timeline");
        if (key === "slots") return open("addSlots");
        if (key === "payouts") return open("payoutHistory");
        if (key === "pools") return router.push("/investor/pools");
        scrollTo("im-active");
      }}
      onOpenNotifications={() => open("payoutPolicy")}
      onChromeReady={(api) => {
        chrome.current = api;
      }}
    >
      <div className="im-page">
        <header className="im-hero">
          <div className="im-hero__lead">
            <div className="im-hero__eyebrow">
              <span className="im-code">I-6</span>
              <Tag tone={`is-${data.profile.kycLevel.toLowerCase()}`}>
                {data.profile.kycLevel} verified
              </Tag>
              <span className="im-muted mono">
                snapshot {atStamp(data.asOf)} · {summary.positionCount}{" "}
                positions
              </span>
            </div>
            <h1>My investments</h1>
            <p>
              Every position you hold across the crowdfunding pools — capital,
              current value, net earnings, settled cycles, booked slots and the
              payouts they have produced.
            </p>
            <nav className="im-jump" aria-label="Jump to section">
              {sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => scrollTo(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="im-hero__side">
            <div className="im-hero__value">
              <span>Holdings value</span>
              <b className="mono">{money(holdingsValue, 0)}</b>
              <small>
                {money(summary.activeCapital)} at work ·{" "}
                {money(summary.bookedCapital)} booked ·{" "}
                <span className="is-pos">{signedMoney(accruedActive, 0)}</span>{" "}
                accrued
              </small>
            </div>
            <div className="im-hero__actions">
              <button
                type="button"
                className="im-btn im-btn--primary"
                onClick={() => open("payoutRequest")}
                disabled={!payable.length}
                data-action="request-payout"
              >
                <Icon name="download" size={14} /> Request payout
              </button>
              <button
                type="button"
                className="im-btn"
                onClick={() => open("statementExport")}
              >
                <Icon name="file" size={14} /> Statement
              </button>
              <button
                type="button"
                className="im-btn"
                onClick={() => open("payoutHistory")}
              >
                <Icon name="wallet" size={14} /> Payouts
              </button>
              <button
                type="button"
                className="im-btn"
                onClick={() => setDrawer("overview")}
                aria-label="Open holdings inspector"
              >
                <Icon name="panelRight" size={14} /> Inspector
              </button>
            </div>
            <p className="im-hero__note">
              {pendingPayouts.length
                ? `${money(summary.pendingPayoutAmount, 2)} in ${pendingPayouts.length} pending payout · lands ${shortDateOf(pendingPayouts[0].expectedAt)}`
                : "No payouts pending · settlement runs daily at 17:00 UTC"}
            </p>
          </div>
        </header>

        {/* ── 01 summary ── */}
        <section id="im-summary" className="im-section">
          <SectionHead
            code="I-6 / 01"
            title="Investment summary"
            hint="Capital, earnings and payouts across every pool, counted from the positions below."
            aside={
              <div className="im-head-actions">
                <button
                  type="button"
                  className="im-btn"
                  onClick={() => open("allocation")}
                >
                  <Icon name="chart" size={13} /> Allocation
                </button>
                <button
                  type="button"
                  className="im-btn"
                  onClick={() => open("statementExport")}
                >
                  <Icon name="download" size={13} /> Export
                </button>
              </div>
            }
          />
          <div className="im-kpis">
            <Kpi
              label="Total invested"
              value={summary.totalInvested}
              prefix="$"
              hint={`${summary.positionCount} positions · ${summary.activePools} active`}
              note={`${money(summary.completedCapital)} settled · ${money(summary.bookedCapital)} booked`}
            />
            <Kpi
              label="Active investments"
              value={summary.activeCapital}
              prefix="$"
              hint={`${summary.activePools} pools trading now`}
              note={`${money(summary.bookedCapital)} waiting to start`}
            />
            <Kpi
              label="Total earned"
              value={summary.totalEarned}
              decimals={2}
              prefix="+$"
              hint="net of the 20% platform cut"
              note={`${money(summary.completedNet, 2)} paid · ${money(round2(summary.totalEarned - summary.completedNet), 2)} accrued`}
              className="is-accent"
            />
            <Kpi
              label="Completed"
              value={summary.completedCount}
              hint={`${money(summary.completedCapital)} deployed`}
              note={`net ${money(summary.completedNet, 2)} paid out`}
            />
            <Kpi
              label="Pending payouts"
              value={summary.pendingPayoutAmount}
              decimals={2}
              prefix="$"
              hint={`${summary.pendingPayoutCount} processing`}
              note={
                pendingPayouts[0]
                  ? `gross ${money(pendingPayouts[0].amount, 2)} · fee ${money(pendingPayouts[0].fee, 2)}`
                  : "nothing queued"
              }
            />
            <Kpi
              label="Overall ROI"
              value={summary.overallRoiPct}
              decimals={2}
              prefix="+"
              suffix="%"
              hint={`on ${money(summary.deployedCapital)} deployed`}
              note={`month ${data.profile.monthRoiPct}% · wallet ${money(data.profile.wallet)}`}
            />
          </div>
          <p className="im-foot-note">
            Counted, never typed: every figure above is recomputed from the
            positions listed below — {summary.activePools} trading,{" "}
            {summary.completedCount} settled, {summary.bookedCount} booked and{" "}
            {summary.interestCount} registered interest — so the ledger, the
            pool pages and the live tracker always agree. Settled capital (
            {money(summary.completedCapital)}) has already returned to the
            wallet and is counted in “Total invested” but not in “Holdings
            value”.
          </p>
        </section>

        {/* ── 02 active ── */}
        <section id="im-active" className="im-section">
          <SectionHead
            code="I-6 / 02"
            title="Active investments"
            hint="Pools trading right now. Current value is capital plus your net share of pool profit; interim payouts unlock after ten trading days."
            aside={
              <div className="im-head-actions">
                <Tag tone="is-trading">{data.active.length} trading</Tag>
                <button
                  type="button"
                  className="im-btn"
                  onClick={() => open("earnings")}
                >
                  Earnings maths
                </button>
              </div>
            }
          />
          <div className="im-active">
            {data.active.map((row, index) => {
              const remain = countdown(row.endsAt, clock);
              return (
                <article
                  key={row.id}
                  className="im-position"
                  data-pool={row.code}
                  style={{ "--im-delay": `${index * 70}ms` } as CSSProperties}
                >
                  <header className="im-position__head">
                    <div>
                      <span className="im-code mono">{row.code}</span>
                      <h3>{row.name}</h3>
                      <p>
                        {row.strategy} · {row.riskBand} band
                      </p>
                    </div>
                    <div className="im-position__badges">
                      <Tag tone="is-trading">{stageLabel(row.stage)}</Tag>
                      <Tag
                        tone={row.guardianLevel === "ok" ? "is-ok" : "is-warn"}
                      >
                        Guardian {row.guardianLevel}
                      </Tag>
                    </div>
                  </header>

                  <dl className="im-position__facts">
                    <Fact
                      label="Slots"
                      value={`${row.slots} × ${money(row.slotPrice)}`}
                    />
                    <Fact label="Invested" value={money(row.investment)} />
                    <Fact label="Your share" value={`${row.sharePct}%`} />
                    <Fact
                      label="Payment"
                      value={
                        <span className="im-pay">
                          <Icon name="check" size={11} />{" "}
                          {paymentLabel(row.paymentStatus)}
                        </span>
                      }
                    />
                  </dl>
                  <p className="im-position__pay">
                    {row.paymentMethod} · {row.paymentRef} ·{" "}
                    {dateOf(row.paidAt)}
                  </p>

                  <div className="im-position__money">
                    <div className="im-position__value">
                      <span>Current value</span>
                      <b className="mono">{money(row.currentValue, 2)}</b>
                      <small>
                        your share {signedMoney(row.netEarned, 2)} net
                      </small>
                    </div>
                    <div className="im-position__roi">
                      <span className="im-roi-title">ROI</span>
                      <b className={`im-roi ${tone(row.roiPct)}`} tabIndex={0}>
                        {signedPct(row.roiPct)}
                      </b>
                      <small>pool {signedPct(row.poolRoiPct, 1)}</small>
                    </div>
                  </div>

                  <dl className="im-position__earn">
                    <div>
                      <dt>Gross earnings</dt>
                      <dd className="mono is-pos">
                        {signedMoney(row.grossEarned, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Platform cut</dt>
                      <dd className="mono is-neg">
                        {signedMoney(-row.platformCut, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Net</dt>
                      <dd className={`mono ${tone(row.netEarned)}`}>
                        {signedMoney(row.netEarned, 2)}
                      </dd>
                    </div>
                  </dl>

                  <p className="im-position__remain">
                    <Icon name="clock" size={12} />
                    <span>
                      {remain.total > 0
                        ? `${remain.label} left · ends ${dateOf(row.endsAt)}`
                        : "Cycle finished — settling"}
                    </span>
                    <span className="mono im-countdown">{remain.clock}</span>
                  </p>

                  <footer className="im-position__foot">
                    <Link className="im-btn im-btn--sm" href={row.poolHref}>
                      View pool
                    </Link>
                    <Link className="im-btn im-btn--sm" href={row.liveHref}>
                      <Icon name="activity" size={12} /> Live trades
                    </Link>
                    {row.payoutEligible ? (
                      <button
                        type="button"
                        className="im-btn im-btn--sm im-btn--primary"
                        onClick={() => openActive(row.id, "payoutRequest")}
                      >
                        Request payout
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="im-btn im-btn--sm"
                        disabled
                        title={`Unlocks ${dateOf(row.payoutEligibleAt)}`}
                      >
                        <Icon name="lock" size={11} /> Payout locked
                      </button>
                    )}
                    <button
                      type="button"
                      className="im-link"
                      onClick={() => openActive(row.id, "earnings")}
                    >
                      Breakdown
                    </button>
                  </footer>
                  <p className="im-position__guardian">{row.guardianNote}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── 03 completed ── */}
        <section id="im-completed" className="im-section">
          <SectionHead
            code="I-6 / 03"
            title="Completed investments"
            hint="Settled cycles with their final numbers and payout references. Statements download in PDF, CSV or JSON."
            aside={
              <div className="im-head-actions">
                <Tag tone="is-completed">{summary.completedCount} settled</Tag>
                <button
                  type="button"
                  className="im-btn"
                  onClick={() =>
                    void run(
                      {
                        kind: "savePreferences",
                        emailStatements: prefEmail,
                        autoReinvest: prefReinvest,
                        payoutLeadDays: prefLead,
                        reminderChannel: reminderChannel,
                        hideCompleted: !data.preferences.hideCompleted,
                      },
                      {
                        keep: true,
                        title: data.preferences.hideCompleted
                          ? "Showing every settled cycle"
                          : "Showing the latest settled cycle",
                      },
                    )
                  }
                >
                  <Icon
                    name={data.preferences.hideCompleted ? "layers" : "filter"}
                    size={13}
                  />
                  {data.preferences.hideCompleted ? "Show all" : "Compact"}
                </button>
              </div>
            }
          />
          <ul className="im-completed">
            {completedVisible.map((row, index) => (
              <li
                key={row.id}
                className="im-settled"
                data-pool={row.code}
                style={{ "--im-delay": `${index * 60}ms` } as CSSProperties}
              >
                <span className="im-settled__check" aria-hidden="true">
                  <Icon name="check" size={13} />
                </span>
                <div className="im-settled__id">
                  <b className="mono">{row.code}</b>
                  <span>{row.name}</span>
                  <small>
                    Completed {dateOf(row.completedAt)} · {row.daysHeld} days ·{" "}
                    {row.slots} slots
                  </small>
                </div>
                <div className="im-settled__nums">
                  <div>
                    <span>Invested</span>
                    <b className="mono">{money(row.investment)}</b>
                  </div>
                  <div>
                    <span>Gross</span>
                    <b className="mono is-pos">
                      {signedMoney(row.grossEarnings, 2)}
                    </b>
                  </div>
                  <div>
                    <span>Cut</span>
                    <b className="mono is-neg">
                      {signedMoney(-row.platformCut, 2)}
                    </b>
                  </div>
                  <div>
                    <span>Net paid</span>
                    <b className="mono is-pos">
                      {signedMoney(row.netEarnings, 2)}
                    </b>
                  </div>
                  <div>
                    <span>Final ROI</span>
                    <b className="mono is-pos">{signedPct(row.userRoiPct)}</b>
                  </div>
                </div>
                <div className="im-settled__payout">
                  <Tag tone={payoutTone(row.payoutStatus)}>
                    {payoutLabel(row.payoutStatus)}
                  </Tag>
                  <small className="mono">
                    {row.paidAt ? dateOf(row.paidAt) : "—"} · {row.payoutRef}
                  </small>
                </div>
                <div className="im-settled__actions">
                  <button
                    type="button"
                    className="im-btn im-btn--sm"
                    onClick={() => openCompleted(row.id, "statementExport")}
                  >
                    <Icon name="download" size={12} /> Statement
                  </button>
                  <button
                    type="button"
                    className="im-btn im-btn--sm"
                    onClick={() => openCompleted(row.id, "completedDetail")}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className="im-link"
                    onClick={() => {
                      const match = data.payouts.find(
                        (payout) => payout.reference === row.payoutRef,
                      );
                      if (match) openPayout(match.id, "payoutDetails");
                      else open("payoutHistory");
                    }}
                  >
                    Payout
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="im-foot-note">
            {data.completed.length} settled cycle(s) ·{" "}
            {money(summary.completedNet, 2)} net paid ·{" "}
            {money(summary.completedCapital)} original capital returned in each
            payout
          </p>
        </section>

        {/* ── 04 booked ── */}
        <section id="im-booked" className="im-section">
          <SectionHead
            code="I-6 / 04"
            title="Booked slots"
            hint="Booked but not yet trading. Payment status decides whether the slots confirm when the window closes; registered interest reserves nothing."
            aside={
              <div className="im-head-actions">
                <button
                  type="button"
                  className="im-btn"
                  onClick={() => open("addSlots")}
                >
                  <Icon name="plus" size={13} /> Add slots
                </button>
                <Link className="im-btn" href="/investor/pools">
                  Open pools
                </Link>
              </div>
            }
          />
          <div className="im-booked">
            {data.booked.map((row) => {
              const closing = countdown(row.closesAt, clock);
              const trading = countdown(row.tradingStartsAt, clock);
              return (
                <article
                  key={row.id}
                  className="im-booking"
                  data-pool={row.code}
                >
                  <header>
                    <div>
                      <b className="mono">{row.code}</b>
                      <h3>{row.name}</h3>
                    </div>
                    <Tag tone={stageTone(row.stage)}>
                      {stageLabel(row.stage)}
                    </Tag>
                  </header>
                  <dl className="im-booking__facts">
                    <div>
                      <dt>Slots</dt>
                      <dd className="mono">{row.slots}</dd>
                    </div>
                    <div>
                      <dt>Amount</dt>
                      <dd className="mono">{money(row.amount)}</dd>
                    </div>
                    <div>
                      <dt>Slot price</dt>
                      <dd className="mono">{money(row.slotPrice)}</dd>
                    </div>
                    <div>
                      <dt>Payment</dt>
                      <dd
                        className={`mono ${row.paymentStatus === "verified" ? "is-pos" : row.paymentStatus === "pending" ? "is-warn" : ""}`}
                      >
                        {paymentLabel(row.paymentStatus)}
                      </dd>
                    </div>
                  </dl>
                  <p className="im-booking__line">
                    <Icon name="calendar" size={12} />
                    {row.stage === "booked"
                      ? `Trading starts ${dateOf(row.tradingStartsAt)} · window closes in ${closing.label}`
                      : `Booking opens ${dateOf(row.closesAt)} · ${closing.label} to go`}
                  </p>
                  <p className="im-booking__note">{row.note}</p>
                  {row.reminder ? (
                    <p className="im-booking__reminder mono">
                      <Icon name="bell" size={11} /> Reminder{" "}
                      {row.reminder.leadDays} day(s) before ·{" "}
                      {row.reminder.channel === "email" ? "email" : "in-app"}
                    </p>
                  ) : null}
                  <footer>
                    {row.stage === "booked" ? (
                      <>
                        <button
                          type="button"
                          className="im-btn im-btn--sm"
                          onClick={() => openBooked(row.id, "addSlots")}
                        >
                          Add more slots
                        </button>
                        <button
                          type="button"
                          className="im-btn im-btn--sm"
                          onClick={() => openBooked(row.id, "bookingDetail")}
                        >
                          View booking
                        </button>
                        <button
                          type="button"
                          className="im-link"
                          onClick={() => openBooked(row.id, "reminder")}
                        >
                          Reminder
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="im-btn im-btn--sm"
                          onClick={() => openBooked(row.id, "cancelInterest")}
                        >
                          Cancel interest
                        </button>
                        <button
                          type="button"
                          className="im-btn im-btn--sm"
                          onClick={() =>
                            row.reminder
                              ? void run(
                                  { kind: "clearReminder", bookedId: row.id },
                                  {
                                    keep: true,
                                    title: `${row.code} reminder cleared`,
                                  },
                                )
                              : openBooked(row.id, "reminder")
                          }
                        >
                          <Icon name="bell" size={12} />
                          {row.reminder ? "Clear reminder" : "Set reminder"}
                        </button>
                        <Link
                          className="im-link"
                          href={`/investor/pools/${row.poolId}`}
                        >
                          Pool
                        </Link>
                      </>
                    )}
                  </footer>
                </article>
              );
            })}
            {data.booked.length === 0 ? (
              <div className="im-empty">
                <b>Nothing booked right now</b>
                <span>
                  Every settled cycle is paid and no slot is waiting to start.
                </span>
                <Link className="im-btn" href="/investor/pools">
                  Browse open pools
                </Link>
              </div>
            ) : null}
          </div>
          <p className="im-foot-note">
            {summary.bookedCount} booking(s) worth{" "}
            {money(summary.bookedCapital)} · {summary.interestCount} registered
            interest worth {money(summary.interestCapital)} (no payment taken) ·
            slots remaining shown inside each pool
          </p>
        </section>

        {/* ── 05 timeline ── */}
        <section id="im-timeline" className="im-section">
          <SectionHead
            code="I-6 / 05"
            title="Investment timeline"
            hint="One chronological record of deposits, bookings, trades, payouts and pool events. Filter by kind or search the record."
            aside={
              <div className="im-head-actions">
                <button
                  type="button"
                  className="im-btn"
                  onClick={() => open("notes")}
                >
                  <Icon name="file" size={13} /> Journal
                </button>
                <button
                  type="button"
                  className="im-btn"
                  onClick={() => open("statementExport")}
                >
                  <Icon name="download" size={13} /> Export
                </button>
              </div>
            }
          />

          <div className="im-timeline-filter">
            <div
              className="im-chips"
              role="group"
              aria-label="Filter timeline by kind"
            >
              {timelineKinds.map((kind) => {
                const active = data.filters.kinds.includes(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    className={`im-chip ${active ? "is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() =>
                      void run(
                        {
                          kind: "saveFilters",
                          kinds: active
                            ? data.filters.kinds.filter((row) => row !== kind)
                            : [...data.filters.kinds, kind],
                          query: data.filters.query,
                        },
                        { keep: true, title: "Timeline filter applied" },
                      )
                    }
                  >
                    {timelineLabel(kind)}
                  </button>
                );
              })}
              {data.filters.kinds.length ? (
                <button
                  type="button"
                  className="im-link"
                  onClick={() =>
                    void run(
                      {
                        kind: "saveFilters",
                        kinds: [],
                        query: data.filters.query,
                      },
                      { keep: true, title: "Timeline filter cleared" },
                    )
                  }
                >
                  Clear
                </button>
              ) : null}
            </div>
            <span className="im-muted">
              {timeline.length} of {data.timeline.length} events
            </span>
          </div>

          {groups.length ? (
            <ol className="im-timeline">
              {groups.map((group) => (
                <li key={group.day} className="im-timeline__day">
                  <span className="im-timeline__date mono">{group.label}</span>
                  <ul>
                    {group.events.map((event, index) => (
                      <li
                        key={event.id}
                        className={`im-event ${kindTone(event.kind)}`}
                        style={
                          { "--im-delay": `${index * 45}ms` } as CSSProperties
                        }
                      >
                        <span className="im-event__dot" aria-hidden="true" />
                        <div className="im-event__body">
                          <div className="im-event__head">
                            <Tag tone={`is-${event.kind}`}>
                              {timelineLabel(event.kind)}
                            </Tag>
                            <b>{event.title}</b>
                            <time className="mono">{clockOf(event.at)}</time>
                          </div>
                          <p>{event.detail}</p>
                          <div className="im-event__meta">
                            {event.poolCode ? (
                              <span className="mono">{event.poolCode}</span>
                            ) : null}
                            <span
                              className={`im-event__status is-${event.status}`}
                            >
                              {event.status}
                            </span>
                            {event.investmentId ? (
                              <button
                                type="button"
                                className="im-link"
                                onClick={() => {
                                  const active = data.active.find(
                                    (row) => row.id === event.investmentId,
                                  );
                                  if (active) return openActive(active.id);
                                  const settled = data.completed.find(
                                    (row) => row.id === event.investmentId,
                                  );
                                  if (settled) return openCompleted(settled.id);
                                  const booking = data.booked.find(
                                    (row) => row.id === event.investmentId,
                                  );
                                  if (booking) return openBooked(booking.id);
                                  open("notes");
                                }}
                              >
                                Open position
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {event.amount !== null ? (
                          <b
                            className={`im-event__amount mono ${
                              event.kind === "payout" &&
                              event.status !== "processing"
                                ? "is-pos"
                                : event.amount >= 0
                                  ? "is-flat"
                                  : "is-neg"
                            }`}
                          >
                            {event.kind === "payout" || event.kind === "trade"
                              ? signedMoney(event.amount, 2)
                              : money(event.amount)}
                          </b>
                        ) : (
                          <span className="im-event__amount im-muted">—</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : (
            <div className="im-empty">
              <b>No events match this filter</b>
              <span>
                Clear the kind filters or open the journal for the full record.
              </span>
              <button
                type="button"
                className="im-btn"
                onClick={() =>
                  void run(
                    { kind: "saveFilters", kinds: [], query: "" },
                    { keep: true, title: "Timeline filter cleared" },
                  )
                }
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="im-timeline__foot">
            <span className="im-muted">
              Showing {visibleTimeline.length} of {timeline.length} matched
              events · the record keeps the newest 50
            </span>
            {timeline.length > visibleTimeline.length ? (
              <button
                type="button"
                className="im-btn"
                onClick={() =>
                  setTimelineWindow((prev) =>
                    Math.min(prev + TIMELINE_PAGE, timeline.length),
                  )
                }
              >
                Load{" "}
                {Math.min(
                  TIMELINE_PAGE,
                  timeline.length - visibleTimeline.length,
                )}{" "}
                more
              </button>
            ) : null}
            {visibleTimeline.length > TIMELINE_PAGE ? (
              <button
                type="button"
                className="im-link"
                onClick={() => setTimelineWindow(TIMELINE_PAGE)}
              >
                Collapse
              </button>
            ) : null}
          </div>
        </section>

        {/* ── supporting records ── */}
        <section className="im-records" aria-label="Payouts and documents">
          <div className="im-records__col">
            <header>
              <div>
                <span className="im-section-code">PAYOUTS</span>
                <h3>Payouts</h3>
              </div>
              <button
                type="button"
                className="im-btn im-btn--sm"
                onClick={() => open("payoutHistory")}
              >
                All payouts
              </button>
            </header>
            <ul className="im-payout-list">
              {data.payouts.slice(0, 4).map((row) => (
                <li key={row.id} className={payoutTone(row.status)}>
                  <span className="im-payout-list__dot" aria-hidden="true" />
                  <button type="button" onClick={() => openPayout(row.id)}>
                    <span>
                      <b className="mono">{row.reference}</b>
                      <small>
                        {row.poolCode} ·{" "}
                        {row.method === "bank" ? row.destination : "Wallet"} ·{" "}
                        {dateOf(row.requestedAt)}
                      </small>
                    </span>
                    <b className="mono">{money(row.net, 2)}</b>
                    <Tag tone={payoutTone(row.status)}>
                      {payoutLabel(row.status)}
                    </Tag>
                  </button>
                </li>
              ))}
            </ul>
            <div className="im-records__foot">
              <button
                type="button"
                className="im-btn im-btn--sm"
                onClick={() => open("payoutRequest")}
              >
                Request payout
              </button>
              <button
                type="button"
                className="im-btn im-btn--sm"
                onClick={() => open("payoutPolicy")}
              >
                Payout policy
              </button>
              <span className="im-muted mono">
                {money(summary.paidPayoutAmount, 2)} paid lifetime
              </span>
            </div>
          </div>

          <div className="im-records__col">
            <header>
              <div>
                <span className="im-section-code">DOCUMENTS</span>
                <h3>Statements & documents</h3>
              </div>
              <button
                type="button"
                className="im-btn im-btn--sm"
                onClick={() => open("documents")}
              >
                Open library
              </button>
            </header>
            <ul className="im-docs">
              {data.documents.slice(0, 4).map((row) => (
                <li key={row.id}>
                  <span className="im-docs__icon" aria-hidden="true">
                    <Icon
                      name={
                        row.kind === "payout"
                          ? "wallet"
                          : row.kind === "kyc"
                            ? "shield"
                            : "file"
                      }
                      size={14}
                    />
                  </span>
                  <div>
                    <b>{row.title}</b>
                    <small className="mono">
                      {row.poolCode} · {row.period} · {row.sizeKb} kB
                    </small>
                  </div>
                  <button
                    type="button"
                    className="im-link"
                    onClick={() => {
                      setSelectedDoc(row.id);
                      open("documents");
                    }}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
            <div className="im-records__foot">
              <button
                type="button"
                className="im-btn im-btn--sm"
                onClick={() => open("statementExport")}
              >
                Export statement
              </button>
              <button
                type="button"
                className="im-btn im-btn--sm"
                onClick={() => open("kyc")}
              >
                Verification
              </button>
              <span className="im-muted mono">
                {data.documents.length} documents
              </span>
            </div>
          </div>
        </section>

        <footer className="im-foot">
          <div>
            <b>How this page is wired</b>
            <p>
              Positions, payouts and the timeline all reduce into one workspace
              DTO served by{" "}
              <span className="mono">/api/investor/investments</span>. Payout
              requests, reminder settings, exports and acknowledgements are
              validated commands that return an audited clone — the shape the
              backend will accept.
            </p>
          </div>
          <div>
            <b>Boundaries</b>
            <p>
              No payout provider is called and no bank instruction is created. A
              request shown here is a local preview; settlement payouts and
              statement delivery stay with the desk.
            </p>
            <div className="im-foot__links">
              <button
                type="button"
                className="im-link"
                onClick={() => open("help")}
              >
                Workspace boundaries
              </button>
              <button
                type="button"
                className="im-link"
                onClick={() => open("risk")}
              >
                Risk disclosure
              </button>
              <button
                type="button"
                className="im-link"
                onClick={() => open("settlement")}
              >
                Settlement terms
              </button>
              <Link className="im-link" href="/investor/live">
                Live trade tracker
              </Link>
            </div>
          </div>
          <p className="im-foot__meta">
            Revision r{data.revision} · snapshot {atStamp(data.asOf)} ·{" "}
            {summary.positionCount} positions · {data.audit.length} local change
            {data.audit.length === 1 ? "" : "s"} · {data.exports.length} export
            {data.exports.length === 1 ? "" : "s"}
          </p>
        </footer>

        {/* ── drawer ── */}
        {drawer ? (
          <div
            className="op-drawer-backdrop im-drawer-layer"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <aside
              className="op-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Holdings inspector"
            >
              <div className="op-drawer__head">
                <div>
                  <span className="im-section-code">
                    I-6 / HOLDINGS INSPECTOR
                  </span>
                  <h2 className="op-drawer__title">My investments</h2>
                  <p className="im-muted">
                    {money(summary.totalInvested)} across{" "}
                    {summary.positionCount} positions · {clockOf(clock)} UTC
                  </p>
                </div>
                <button
                  type="button"
                  className="desk-icon-btn"
                  onClick={close}
                  aria-label="Close inspector"
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
              <div
                className="im-drawer-tabs"
                role="tablist"
                aria-label="Inspector views"
              >
                {(["overview", "payouts", "timeline"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={drawer === tab}
                    className={drawer === tab ? "is-active" : ""}
                    onClick={() => setDrawer(tab)}
                  >
                    {tab === "overview"
                      ? "Overview"
                      : tab === "payouts"
                        ? "Payouts"
                        : "Timeline"}
                  </button>
                ))}
              </div>
              <div className="op-drawer__body">
                {drawer === "overview" ? (
                  <>
                    <div className="im-drawer-grid">
                      <div>
                        <span>INVESTED</span>
                        <b className="mono">{money(summary.totalInvested)}</b>
                      </div>
                      <div>
                        <span>EARNED</span>
                        <b className="mono is-pos">
                          {signedMoney(summary.totalEarned, 2)}
                        </b>
                      </div>
                      <div>
                        <span>ROI</span>
                        <b className="mono is-pos">
                          {signedPct(summary.overallRoiPct)}
                        </b>
                      </div>
                    </div>
                    <h4 className="im-subhead">Allocation</h4>
                    <ul className="im-alloc">
                      {data.allocations.map((row) => (
                        <li key={`${row.poolCode}-${row.stage}`}>
                          <span className="im-alloc__label">
                            <b className="mono">{row.poolCode}</b>
                            <small>{stageLabel(row.stage)}</small>
                          </span>
                          <span className="im-alloc__bar">
                            <span
                              className={`im-alloc__fill is-${row.stage}`}
                              style={{
                                width: `${Math.max(2, (row.amount / allocationTotal) * 100)}%`,
                              }}
                            />
                          </span>
                          <b className="mono">{money(row.amount)}</b>
                        </li>
                      ))}
                    </ul>
                    <h4 className="im-subhead">Positions</h4>
                    <ul className="im-drawer-positions">
                      {data.active.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => openActive(row.id)}
                          >
                            <span>
                              <b className="mono">{row.code}</b>
                              <small>
                                {row.slots} slots · {row.sharePct}% ·{" "}
                                {money(row.investment)}
                              </small>
                            </span>
                            <span className="is-pos mono">
                              {signedMoney(row.netEarned, 2)}
                            </span>
                          </button>
                        </li>
                      ))}
                      {data.completed.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => openCompleted(row.id)}
                          >
                            <span>
                              <b className="mono">{row.code}</b>
                              <small>
                                settled {dateOf(row.completedAt)} · {row.slots}{" "}
                                slots
                              </small>
                            </span>
                            <span className="is-pos mono">
                              {signedMoney(row.netEarnings, 2)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="im-drawer-actions">
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => open("preferences")}
                      >
                        Preferences
                      </button>
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => open("allocation")}
                      >
                        Allocation
                      </button>
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => open("kyc")}
                      >
                        Verification
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "payouts" ? (
                  <>
                    <p className="im-muted">
                      {pendingPayouts.length} pending ·{" "}
                      {
                        data.payouts.filter((row) => row.status === "paid")
                          .length
                      }{" "}
                      paid · {money(summary.paidPayoutAmount, 2)} lifetime
                    </p>
                    <ul className="im-drawer-payouts">
                      {data.payouts.map((row) => (
                        <li key={row.id} className={payoutTone(row.status)}>
                          <button
                            type="button"
                            onClick={() => openPayout(row.id)}
                          >
                            <span>
                              <b className="mono">{row.reference}</b>
                              <small>
                                {row.poolCode} · {dateOf(row.requestedAt)}
                              </small>
                            </span>
                            <b className="mono">{money(row.net, 2)}</b>
                            <Tag tone={payoutTone(row.status)}>
                              {payoutLabel(row.status)}
                            </Tag>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="im-drawer-actions">
                      <button
                        type="button"
                        className="im-btn im-btn--primary"
                        onClick={() => open("payoutRequest")}
                      >
                        Request payout
                      </button>
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => open("payoutPolicy")}
                      >
                        Policy
                      </button>
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => open("payoutHistory")}
                      >
                        History
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "timeline" ? (
                  <>
                    <p className="im-muted">
                      Latest {Math.min(6, data.timeline.length)} events
                    </p>
                    <ul className="im-drawer-timeline">
                      {data.timeline.slice(0, 6).map((event) => (
                        <li key={event.id} className={kindTone(event.kind)}>
                          <span
                            className="im-drawer-timeline__dot"
                            aria-hidden="true"
                          />
                          <div>
                            <b>{event.title}</b>
                            <small className="mono">
                              {shortDateOf(event.at)} ·{" "}
                              {event.poolCode ?? "account"}
                            </small>
                          </div>
                          <span className="mono">
                            {event.amount !== null
                              ? event.kind === "payout" ||
                                event.kind === "trade"
                                ? signedMoney(event.amount, 2)
                                : money(event.amount)
                              : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="im-drawer-actions">
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => open("notes")}
                      >
                        Journal
                      </button>
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => open("statementExport")}
                      >
                        Export timeline
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
          <div className="im-modal-layer">
            <DeskModalShell
              code="I-6"
              eyebrow="INVESTOR WORKSPACE / LOCAL PREVIEW"
              title={titles[modal.kind]}
              subtitle="Structured session state. Payout execution, statement delivery and settlement posting require authenticated backend integration."
              size={modalSize[modal.kind] ?? "md"}
              onClose={close}
              steps={wizard}
              currentStep={wizardStep}
              footer={modalFooter}
            >
              {error ? (
                <p className="im-error" role="alert">
                  {error}
                </p>
              ) : null}

              {modal.kind === "activeDetail" && activeRow ? (
                <>
                  <div className="im-modal-head">
                    <Tag tone="is-trading">Trading</Tag>
                    <b className="mono">{activeRow.code}</b>
                    <span>{activeRow.name}</span>
                    <span className="im-muted">
                      {activeRow.slots} slots · {activeRow.sharePct}% share
                    </span>
                  </div>
                  <dl className="im-kv im-kv--rows">
                    <div>
                      <dt>Capital invested</dt>
                      <dd className="mono">
                        {money(activeRow.investment)} ({activeRow.slots} ×{" "}
                        {money(activeRow.slotPrice)})
                      </dd>
                    </div>
                    <div>
                      <dt>Current value</dt>
                      <dd className="mono">
                        {money(activeRow.currentValue, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Net earnings</dt>
                      <dd className={`mono ${tone(activeRow.netEarned)}`}>
                        {signedMoney(activeRow.netEarned, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Gross → cut → net</dt>
                      <dd className="mono">
                        {signedMoney(activeRow.grossEarned, 2)} →{" "}
                        {signedMoney(-activeRow.platformCut, 2)} →{" "}
                        {signedMoney(activeRow.netEarned, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>ROI</dt>
                      <dd className="mono is-pos">
                        {signedPct(activeRow.roiPct)} · pool{" "}
                        {signedPct(activeRow.poolRoiPct, 1)}
                      </dd>
                    </div>
                    <div>
                      <dt>Payment</dt>
                      <dd className="mono">
                        {activeRow.paymentMethod} · {activeRow.paymentRef} ·{" "}
                        {dateOf(activeRow.paidAt)}
                      </dd>
                    </div>
                    <div>
                      <dt>Trading period</dt>
                      <dd className="mono">
                        {dateOf(activeRow.startedAt)} →{" "}
                        {dateOf(activeRow.endsAt)}
                      </dd>
                    </div>
                    <div>
                      <dt>Pool activity</dt>
                      <dd className="mono">
                        {activeRow.poolTrades} trades ·{" "}
                        {num(activeRow.poolWinRatePct, 1)}% win
                      </dd>
                    </div>
                    <div>
                      <dt>Settlement batch</dt>
                      <dd className="mono">{activeRow.settlementBatch}</dd>
                    </div>
                    <div>
                      <dt>Payout</dt>
                      <dd className="mono">
                        {activeRow.payoutEligible
                          ? `${money(activeRow.availablePayout, 2)} available now`
                          : `unlocks ${dateOf(activeRow.payoutEligibleAt)}`}
                      </dd>
                    </div>
                  </dl>
                  <p className="im-note">{activeRow.guardianNote}</p>
                  <div className="im-modal-actions">
                    <Link className="im-btn" href={activeRow.poolHref}>
                      Pool detail
                    </Link>
                    <Link className="im-btn" href={activeRow.liveHref}>
                      Live trades
                    </Link>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => openActive(activeRow.id, "earnings")}
                    >
                      Earnings maths
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      disabled={!activeRow.payoutEligible}
                      onClick={() => openActive(activeRow.id, "payoutRequest")}
                    >
                      Request payout
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => {
                        setNoteBody("");
                        open("notes");
                      }}
                    >
                      Add note
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "earnings" && activeRow ? (
                <>
                  <p className="im-note">
                    A trade closes, the pool profit is split by your share
                    percentage, the 20% platform cut comes off that share, and
                    the net amount is credited to this position. Earnings reach
                    your wallet when you request a payout or when the cycle
                    settles.
                  </p>
                  <div className="im-maths">
                    <div>
                      <span>Pool profit share</span>
                      <b className="mono">{activeRow.sharePct}%</b>
                    </div>
                    <div>
                      <span>Your gross earnings</span>
                      <b className="mono is-pos">
                        {signedMoney(activeRow.grossEarned, 2)}
                      </b>
                    </div>
                    <div>
                      <span>Platform cut (20%)</span>
                      <b className="mono is-neg">
                        {signedMoney(-activeRow.platformCut, 2)}
                      </b>
                    </div>
                    <div className="im-maths__total">
                      <span>Net credited</span>
                      <b className="mono is-pos">
                        {signedMoney(activeRow.netEarned, 2)}
                      </b>
                    </div>
                  </div>
                  <dl className="im-kv">
                    <div>
                      <dt>Already requested</dt>
                      <dd className="mono">
                        {money(activeRow.requestedPayout, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Available to request</dt>
                      <dd className="mono">
                        {money(activeRow.availablePayout, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>ROI on capital</dt>
                      <dd className="mono is-pos">
                        {signedPct(activeRow.roiPct)}
                      </dd>
                    </div>
                    <div>
                      <dt>Current value</dt>
                      <dd className="mono">
                        {money(activeRow.currentValue, 2)}
                      </dd>
                    </div>
                  </dl>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("payoutPolicy")}
                    >
                      Payout policy
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => openActive(activeRow.id, "payoutRequest")}
                      disabled={!activeRow.payoutEligible}
                    >
                      Request payout
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "payoutRequest" && payoutTarget ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <div className="im-modal-head">
                        <Tag tone="is-trading">{payoutTarget.code}</Tag>
                        <b className="mono">
                          {money(payoutTarget.availablePayout, 2)}
                        </b>
                        <span className="im-muted">
                          available on this position
                        </span>
                      </div>
                      <label className="im-field">
                        <span>Amount (USD)</span>
                        <input
                          type="number"
                          min={MIN_PAYOUT}
                          max={payoutTarget.availablePayout}
                          step={10}
                          value={payoutAmount}
                          onChange={(event) =>
                            setPayoutAmount(Number(event.target.value))
                          }
                          data-field="payout-amount"
                        />
                        <small className="im-muted">
                          Minimum {money(MIN_PAYOUT)} · maximum{" "}
                          {money(payoutTarget.availablePayout, 2)} · payout lock{" "}
                          {PAYOUT_LOCK_DAYS} days
                        </small>
                      </label>
                      <div className="im-quick-amounts">
                        {[25, 50, 100].map((fraction) => {
                          const amount = suggestedPayout(
                            (payoutTarget.availablePayout * fraction) / 100,
                          );
                          if (amount < MIN_PAYOUT) return null;
                          return (
                            <button
                              key={fraction}
                              type="button"
                              className="im-btn im-btn--sm"
                              onClick={() => setPayoutAmount(amount)}
                            >
                              {fraction}% · {money(amount, 2)}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          className="im-btn im-btn--sm"
                          onClick={() =>
                            setPayoutAmount(
                              suggestedPayout(payoutTarget.availablePayout),
                            )
                          }
                        >
                          Max
                        </button>
                      </div>
                      <fieldset className="im-fieldset">
                        <legend>Destination</legend>
                        {(
                          [
                            [
                              "bank",
                              "Bank transfer",
                              data.profile.bankAccount,
                              "0.6% fee, capped at $12 · 1–2 business days",
                            ],
                            [
                              "wallet",
                              "Investor wallet",
                              "Instant inside the platform",
                              "No fee · available for reinvesting straight away",
                            ],
                          ] as const
                        ).map(([value, label, hint, note]) => (
                          <label key={value} className="im-radio">
                            <input
                              type="radio"
                              name="payout-method"
                              checked={payoutMethod === value}
                              onChange={() => setPayoutMethod(value)}
                            />
                            <span>
                              <b>{label}</b>
                              <small>
                                {hint} · {note}
                              </small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <label className="im-field">
                        <span>Note for the desk (optional)</span>
                        <input
                          value={payoutNote}
                          onChange={(event) =>
                            setPayoutNote(event.target.value)
                          }
                          placeholder="Anything the settlements team should know"
                          maxLength={200}
                        />
                      </label>
                    </>
                  ) : null}
                  {wizardStep === 1 ? (
                    <div className="im-review">
                      <div>
                        <span>Position</span>
                        <b className="mono">
                          {payoutTarget.code} · {payoutTarget.name}
                        </b>
                      </div>
                      <div>
                        <span>Amount</span>
                        <b className="mono">{money(payoutAmount, 2)}</b>
                      </div>
                      <div>
                        <span>Fee</span>
                        <b className="mono">
                          {money(payoutFee(payoutAmount, payoutMethod), 2)}
                        </b>
                      </div>
                      <div>
                        <span>You receive</span>
                        <b className="mono is-pos">
                          {money(
                            payoutAmount -
                              payoutFee(payoutAmount, payoutMethod),
                            2,
                          )}
                        </b>
                      </div>
                      <div>
                        <span>Destination</span>
                        <b>
                          {payoutMethod === "bank"
                            ? data.profile.bankAccount
                            : "Investor wallet"}
                        </b>
                      </div>
                      <div>
                        <span>Remaining balance</span>
                        <b className="mono">
                          {money(
                            round2(payoutTarget.netEarned - payoutAmount),
                            2,
                          )}
                        </b>
                      </div>
                      <p>
                        Clears on the next 17:00 UTC batch. Nothing is
                        transmitted from this preview — the request is stored in
                        this browser session.
                      </p>
                    </div>
                  ) : null}
                  {wizardStep === 2 ? (
                    <div className="im-review im-review--ack">
                      <p>
                        You are asking for {money(payoutAmount, 2)} from{" "}
                        {payoutTarget.code} to{" "}
                        {payoutMethod === "bank"
                          ? data.profile.bankAccount
                          : "your wallet"}
                        . The fee is{" "}
                        {money(payoutFee(payoutAmount, payoutMethod), 2)} and
                        the balance stays on the pool ledger until the batch
                        runs.
                      </p>
                      <ul className="im-list">
                        <li>Payouts are final once the batch clears.</li>
                        <li>
                          Remaining accrued earnings stay available for later
                          requests.
                        </li>
                        <li>
                          Settlement payout at cycle end pays whatever is left
                          automatically.
                        </li>
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "payoutPolicy" ? (
                <>
                  <p className="im-note">
                    Four rules govern when and how earnings leave a pool. They
                    are set by the desk; this page mirrors them.
                  </p>
                  <ul className="im-policy">
                    {data.payoutPolicy.map((row) => (
                      <li key={row.id}>
                        <span className="mono">{row.label}</span>
                        <p>{row.detail}</p>
                      </li>
                    ))}
                  </ul>
                  <dl className="im-kv">
                    <div>
                      <dt>Minimum request</dt>
                      <dd className="mono">{money(MIN_PAYOUT)}</dd>
                    </div>
                    <div>
                      <dt>Payout lock</dt>
                      <dd className="mono">{PAYOUT_LOCK_DAYS} days</dd>
                    </div>
                    <div>
                      <dt>Bank fee</dt>
                      <dd className="mono">0.6% · max $12</dd>
                    </div>
                    <div>
                      <dt>Wallet fee</dt>
                      <dd className="mono">$0</dd>
                    </div>
                  </dl>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("payoutRequest")}
                    >
                      Request payout
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("payoutHistory")}
                    >
                      Payout history
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "payoutHistory" ? (
                <>
                  <div className="im-toolbar">
                    <label className="im-search">
                      <Icon name="search" size={14} />
                      <input
                        value={historyQuery}
                        onChange={(event) =>
                          setHistoryQuery(event.target.value)
                        }
                        placeholder="Search reference, pool or status"
                        aria-label="Search payouts"
                      />
                    </label>
                    <span className="im-muted">
                      {historyRows.length} of {data.payouts.length} payouts
                    </span>
                  </div>
                  <div className="table-responsive im-table-wrap">
                    <table className="table im-table">
                      <thead>
                        {historyTable.getHeaderGroups().map((group) => (
                          <tr key={group.id}>
                            {group.headers.map((header) => (
                              <th key={header.id}>
                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  disabled={!header.column.getCanSort()}
                                >
                                  <historyTable.FlexRender header={header} />
                                  {header.column.getIsSorted() === "asc"
                                    ? " ↑"
                                    : header.column.getIsSorted() === "desc"
                                      ? " ↓"
                                      : ""}
                                </button>
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {historyTable.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            className="is-clickable"
                            onClick={() => openPayout(row.original.id)}
                          >
                            {row.getAllCells().map((cell) => (
                              <td key={cell.id}>
                                <historyTable.FlexRender cell={cell} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {historyTable.getRowModel().rows.length ? null : (
                    <p className="im-empty-line">
                      No payouts match “{historyQuery}”. Clear the search to see
                      them all.
                    </p>
                  )}
                  <p className="im-foot-note">
                    {money(summary.paidPayoutAmount, 2)} paid lifetime ·{" "}
                    {money(summary.pendingPayoutAmount, 2)} in flight ·{" "}
                    {data.payouts.length} records
                  </p>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("payoutRequest")}
                    >
                      New request
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => {
                        setExportScope("payouts");
                        open("statementExport");
                      }}
                    >
                      Export payouts
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "payoutDetails" && payoutRow ? (
                <>
                  <div className="im-modal-head">
                    <Tag tone={payoutTone(payoutRow.status)}>
                      {payoutLabel(payoutRow.status)}
                    </Tag>
                    <b className="mono">{payoutRow.reference}</b>
                    <span className="im-muted">{payoutRow.poolCode}</span>
                  </div>
                  <dl className="im-kv im-kv--rows">
                    <div>
                      <dt>Requested</dt>
                      <dd className="mono">{money(payoutRow.amount, 2)}</dd>
                    </div>
                    <div>
                      <dt>Fee</dt>
                      <dd className="mono">{money(payoutRow.fee, 2)}</dd>
                    </div>
                    <div>
                      <dt>Net paid</dt>
                      <dd className="mono is-pos">{money(payoutRow.net, 2)}</dd>
                    </div>
                    <div>
                      <dt>Route</dt>
                      <dd className="mono">
                        {payoutRow.method === "bank"
                          ? payoutRow.destination
                          : "Investor wallet"}
                      </dd>
                    </div>
                    <div>
                      <dt>Requested at</dt>
                      <dd className="mono">{atStamp(payoutRow.requestedAt)}</dd>
                    </div>
                    <div>
                      <dt>Expected</dt>
                      <dd className="mono">{atStamp(payoutRow.expectedAt)}</dd>
                    </div>
                    <div>
                      <dt>Processed</dt>
                      <dd className="mono">
                        {payoutRow.processedAt
                          ? atStamp(payoutRow.processedAt)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <p className="im-note">{payoutRow.note}</p>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() =>
                        void copy(payoutRow.reference, "Reference")
                      }
                    >
                      <Icon name="copy" size={13} /> Copy reference
                    </button>
                    {payoutRow.status === "processing" ? (
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => openPayout(payoutRow.id, "cancelPayout")}
                      >
                        Cancel payout
                      </button>
                    ) : null}
                    {payoutRow.status === "cancelled" ? (
                      <button
                        type="button"
                        className="im-btn"
                        onClick={() => openPayout(payoutRow.id, "retryPayout")}
                      >
                        Retry payout
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => {
                        setExportScope("payouts");
                        open("statementExport");
                      }}
                    >
                      Download advice
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "completedDetail" && completedRow ? (
                <>
                  <div className="im-modal-head">
                    <Tag tone="is-completed">Completed</Tag>
                    <b className="mono">{completedRow.code}</b>
                    <span>{completedRow.name}</span>
                    <span className="im-muted">
                      {completedRow.statementRef}
                    </span>
                  </div>
                  <dl className="im-kv im-kv--rows">
                    <div>
                      <dt>Capital</dt>
                      <dd className="mono">
                        {money(completedRow.investment)} · {completedRow.slots}{" "}
                        slots
                      </dd>
                    </div>
                    <div>
                      <dt>Share of pool</dt>
                      <dd className="mono">{completedRow.sharePct}%</dd>
                    </div>
                    <div>
                      <dt>Trading period</dt>
                      <dd className="mono">
                        {dateOf(completedRow.startedAt)} →{" "}
                        {dateOf(completedRow.completedAt)} (
                        {completedRow.daysHeld} days)
                      </dd>
                    </div>
                    <div>
                      <dt>Gross earnings</dt>
                      <dd className="mono is-pos">
                        {signedMoney(completedRow.grossEarnings, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Platform cut</dt>
                      <dd className="mono is-neg">
                        {signedMoney(-completedRow.platformCut, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Net paid</dt>
                      <dd className="mono is-pos">
                        {signedMoney(completedRow.netEarnings, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Final ROI</dt>
                      <dd className="mono is-pos">
                        {signedPct(completedRow.userRoiPct)}
                      </dd>
                    </div>
                    <div>
                      <dt>Settlement</dt>
                      <dd className="mono">
                        {completedRow.settlement} · {completedRow.payoutRef}
                      </dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd className="mono">
                        {completedRow.paidAt
                          ? atStamp(completedRow.paidAt)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() =>
                        openCompleted(completedRow.id, "statementExport")
                      }
                    >
                      <Icon name="download" size={13} /> Statement
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => {
                        const match = data.payouts.find(
                          (payout) =>
                            payout.reference === completedRow.payoutRef,
                        );
                        if (match) openPayout(match.id, "payoutDetails");
                        else open("payoutHistory");
                      }}
                    >
                      Payout details
                    </button>
                    <Link
                      className="im-btn"
                      href={`/investor/pools/${completedRow.poolId}`}
                    >
                      Pool page
                    </Link>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("settlement")}
                    >
                      Settlement terms
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "statementExport" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <fieldset className="im-fieldset">
                        <legend>What to export</legend>
                        {(
                          [
                            [
                              "statement",
                              "Position statement",
                              completedRow
                                ? `${completedRow.code} · final numbers`
                                : "latest settled cycle",
                            ],
                            [
                              "portfolio",
                              "Portfolio summary",
                              `${data.active.length + data.completed.length} positions with capital and earnings`,
                            ],
                            [
                              "timeline",
                              "Investment timeline",
                              `${timeline.length} events, newest first`,
                            ],
                            [
                              "payouts",
                              "Payout ledger",
                              `${data.payouts.length} payout records`,
                            ],
                          ] as const
                        ).map(([value, label, hint]) => (
                          <label key={value} className="im-radio">
                            <input
                              type="radio"
                              name="export-scope"
                              checked={exportScope === value}
                              onChange={() => setExportScope(value)}
                            />
                            <span>
                              <b>{label}</b>
                              <small>{hint}</small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <p className="im-foot-note">
                        Documents in the library ({data.documents.length}) are
                        the desk-issued copies; an export is generated in your
                        browser from this snapshot.
                      </p>
                    </>
                  ) : null}
                  {wizardStep === 1 ? (
                    <fieldset className="im-fieldset">
                      <legend>Format</legend>
                      {(
                        [
                          ["pdf", "PDF", "Statement layout for your records."],
                          [
                            "csv",
                            "CSV",
                            "Spreadsheet-ready, one row per record.",
                          ],
                          [
                            "json",
                            "JSON",
                            "Structured payload for your own tooling.",
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label key={value} className="im-radio">
                          <input
                            type="radio"
                            name="export-format"
                            checked={exportFormat === value}
                            onChange={() => setExportFormat(value)}
                          />
                          <span>
                            <b>{label}</b>
                            <small>{hint}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  {wizardStep === 2 ? (
                    <div className="im-review">
                      <div>
                        <span>Scope</span>
                        <b>{exportScope}</b>
                      </div>
                      <div>
                        <span>Format</span>
                        <b className="mono">{exportFormat.toUpperCase()}</b>
                      </div>
                      <div>
                        <span>Rows</span>
                        <b className="mono">
                          {
                            scopeRows(exportScope, completedRow?.id ?? null)
                              .length
                          }
                        </b>
                      </div>
                      <div>
                        <span>Investor</span>
                        <b>{data.profile.displayName}</b>
                      </div>
                      <p>
                        The file downloads straight away. Nothing is emailed and
                        nothing is posted to the desk.
                      </p>
                    </div>
                  ) : null}
                  {data.exports.length ? (
                    <p className="im-foot-note">
                      Last export: {data.exports[0].scope} ·{" "}
                      {data.exports[0].format.toUpperCase()} ·{" "}
                      {data.exports[0].count} row(s) ·{" "}
                      {clockOf(data.exports[0].createdAt)} UTC
                    </p>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "bookingDetail" && bookedRow ? (
                <>
                  <div className="im-modal-head">
                    <Tag tone={stageTone(bookedRow.stage)}>
                      {stageLabel(bookedRow.stage)}
                    </Tag>
                    <b className="mono">{bookedRow.code}</b>
                    <span>{bookedRow.name}</span>
                  </div>
                  <dl className="im-kv im-kv--rows">
                    <div>
                      <dt>Slots</dt>
                      <dd className="mono">
                        {bookedRow.slots} × {money(bookedRow.slotPrice)}
                      </dd>
                    </div>
                    <div>
                      <dt>Amount</dt>
                      <dd className="mono">{money(bookedRow.amount)}</dd>
                    </div>
                    <div>
                      <dt>Payment</dt>
                      <dd className="mono">
                        {paymentLabel(bookedRow.paymentStatus)} ·{" "}
                        {bookedRow.paymentRef ?? "no reference"}
                      </dd>
                    </div>
                    <div>
                      <dt>Route</dt>
                      <dd className="mono">{bookedRow.paymentMethod}</dd>
                    </div>
                    <div>
                      <dt>Booked</dt>
                      <dd className="mono">{atStamp(bookedRow.bookedAt)}</dd>
                    </div>
                    <div>
                      <dt>Window closes</dt>
                      <dd className="mono">
                        {atStamp(bookedRow.closesAt)} ·{" "}
                        {countdown(bookedRow.closesAt, clock).label} left
                      </dd>
                    </div>
                    <div>
                      <dt>Trading starts</dt>
                      <dd className="mono">
                        {atStamp(bookedRow.tradingStartsAt)}
                      </dd>
                    </div>
                    <div>
                      <dt>Slots left for you</dt>
                      <dd className="mono">{bookedRow.slotsRemaining}</dd>
                    </div>
                  </dl>
                  <p className="im-note">{bookedRow.note}</p>
                  <div className="im-modal-actions">
                    <Link
                      className="im-btn"
                      href={`/investor/pools/${bookedRow.poolId}/book`}
                    >
                      Booking page
                    </Link>
                    <Link
                      className="im-btn"
                      href={`/investor/pools/${bookedRow.poolId}`}
                    >
                      Pool detail
                    </Link>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => openBooked(bookedRow.id, "addSlots")}
                    >
                      Add more slots
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => openBooked(bookedRow.id, "reminder")}
                    >
                      Reminder
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "addSlots" && bookedRow ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <p className="im-note">
                        {bookedRow.code} · {bookedRow.name}. You already hold{" "}
                        {bookedRow.slots} slot(s) at{" "}
                        {money(bookedRow.slotPrice)} each;{" "}
                        {bookedRow.slotsRemaining} more are available to you
                        before the window closes.
                      </p>
                      <div className="im-stepper">
                        <button
                          type="button"
                          className="im-btn"
                          onClick={() =>
                            setExtraSlots((prev) => Math.max(1, prev - 1))
                          }
                          aria-label="One fewer slot"
                        >
                          <Icon name="minus" size={14} />
                        </button>
                        <b className="mono">{extraSlots}</b>
                        <button
                          type="button"
                          className="im-btn"
                          onClick={() =>
                            setExtraSlots((prev) =>
                              Math.min(bookedRow.slotsRemaining, prev + 1),
                            )
                          }
                          aria-label="One more slot"
                        >
                          <Icon name="plus" size={14} />
                        </button>
                        <span className="im-muted">
                          {extraSlots} × {money(bookedRow.slotPrice)} ={" "}
                          <b className="mono">
                            {money(extraSlots * bookedRow.slotPrice)}
                          </b>
                        </span>
                      </div>
                      <p className="im-foot-note">
                        Adding slots continues on the booking page, where
                        payment is captured or an instruction is issued. Nothing
                        is charged here.
                      </p>
                    </>
                  ) : null}
                  {wizardStep === 1 ? (
                    <div className="im-review">
                      <div>
                        <span>Pool</span>
                        <b className="mono">
                          {bookedRow.code} · {bookedRow.name}
                        </b>
                      </div>
                      <div>
                        <span>Extra slots</span>
                        <b className="mono">{extraSlots}</b>
                      </div>
                      <div>
                        <span>Slot price</span>
                        <b className="mono">{money(bookedRow.slotPrice)}</b>
                      </div>
                      <div>
                        <span>Additional capital</span>
                        <b className="mono">
                          {money(extraSlots * bookedRow.slotPrice)}
                        </b>
                      </div>
                      <div>
                        <span>Holding after</span>
                        <b className="mono">
                          {bookedRow.slots + extraSlots} slots ·{" "}
                          {money(
                            (bookedRow.slots + extraSlots) *
                              bookedRow.slotPrice,
                          )}
                        </b>
                      </div>
                      <div>
                        <span>Window closes</span>
                        <b className="mono">{dateOf(bookedRow.closesAt)}</b>
                      </div>
                      <p>
                        The booking page carries the payment rails, terms and
                        escrow instructions. This wizard only carries your
                        quantity across.
                      </p>
                    </div>
                  ) : null}
                  {wizardStep === 2 ? (
                    <div className="im-review im-review--ack">
                      <p>
                        Continue to the booking page with {extraSlots} extra
                        slot(s) for {bookedRow.code} selected. Payment still has
                        to be completed there.
                      </p>
                      <ul className="im-list">
                        <li>
                          Existing slots keep their original confirmation order.
                        </li>
                        <li>
                          Extra slots confirm once their payment verifies.
                        </li>
                        <li>
                          Closing the booking page leaves this position
                          unchanged.
                        </li>
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "cancelInterest" && bookedRow ? (
                <>
                  {wizardStep === 0 ? (
                    <fieldset className="im-fieldset">
                      <legend>Why cancel?</legend>
                      {(
                        [
                          [
                            "timing",
                            "Timing",
                            "The window no longer suits my cash flow.",
                          ],
                          [
                            "changed_plan",
                            "Changed plan",
                            "I am putting this capital elsewhere.",
                          ],
                          [
                            "capacity",
                            "Capacity",
                            "The pool size is too large for my allocation.",
                          ],
                          [
                            "other",
                            "Something else",
                            "No further detail needed.",
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label key={value} className="im-radio">
                          <input
                            type="radio"
                            name="interest-reason"
                            checked={interestReason === value}
                            onChange={() => setInterestReason(value)}
                          />
                          <span>
                            <b>{label}</b>
                            <small>{hint}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  {wizardStep === 1 ? (
                    <div className="im-review">
                      <div>
                        <span>Pool</span>
                        <b className="mono">
                          {bookedRow.code} · {bookedRow.name}
                        </b>
                      </div>
                      <div>
                        <span>Registered slots</span>
                        <b className="mono">
                          {bookedRow.slots} · {money(bookedRow.amount)}
                        </b>
                      </div>
                      <div>
                        <span>Payment</span>
                        <b>None taken — nothing to refund</b>
                      </div>
                      <div>
                        <span>Reason</span>
                        <b>{interestReason}</b>
                      </div>
                      <p>
                        The pool keeps its other bookings. You can register
                        interest again any time before the window opens.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "reminder" && bookedRow ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <p className="im-note">
                        Set a reminder for {bookedRow.code} so the opening
                        window does not pass you. Delivery is a local preview
                        until email delivery is wired.
                      </p>
                      <fieldset className="im-fieldset">
                        <legend>Lead time</legend>
                        {([1, 2, 3, 7] as const).map((days) => (
                          <label key={days} className="im-radio">
                            <input
                              type="radio"
                              name="reminder-lead"
                              checked={reminderLead === days}
                              onChange={() => setReminderLead(days)}
                            />
                            <span>
                              <b>
                                {days} day{days === 1 ? "" : "s"} before
                              </b>
                              <small>
                                {days === 1
                                  ? "Day-of nudge, 24 hours ahead."
                                  : `Nudge on ${dateOf(new Date(Date.parse(bookedRow.closesAt) - days * 86_400_000).toISOString())}.`}
                              </small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <fieldset className="im-fieldset">
                        <legend>Channel</legend>
                        {(
                          [
                            [
                              "email",
                              "Email",
                              "Sent to the address on your account.",
                            ],
                            [
                              "in_app",
                              "In-app only",
                              "Banner and bell inside this workspace.",
                            ],
                          ] as const
                        ).map(([value, label, hint]) => (
                          <label key={value} className="im-radio">
                            <input
                              type="radio"
                              name="reminder-channel"
                              checked={reminderChannel === value}
                              onChange={() => setReminderChannel(value)}
                            />
                            <span>
                              <b>{label}</b>
                              <small>{hint}</small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    </>
                  ) : (
                    <div className="im-review">
                      <div>
                        <span>Pool</span>
                        <b className="mono">{bookedRow.code}</b>
                      </div>
                      <div>
                        <span>Reminder</span>
                        <b>{reminderLead} day(s) before</b>
                      </div>
                      <div>
                        <span>Channel</span>
                        <b>
                          {reminderChannel === "email" ? "Email" : "In-app"}
                        </b>
                      </div>
                      <div>
                        <span>Window</span>
                        <b className="mono">{dateOf(bookedRow.closesAt)}</b>
                      </div>
                      <p>
                        Stored in this session. Nothing is scheduled on the
                        server.
                      </p>
                    </div>
                  )}
                </>
              ) : null}

              {modal.kind === "cancelPayout" && payoutRow ? (
                <>
                  {wizardStep === 0 ? (
                    <fieldset className="im-fieldset">
                      <legend>Why cancel {payoutRow.reference}?</legend>
                      {(
                        [
                          [
                            "changed_plan",
                            "Changed plan",
                            "Keep the balance on the pool ledger.",
                          ],
                          [
                            "wrong_method",
                            "Wrong destination",
                            "The saved route is out of date.",
                          ],
                          [
                            "faster_route",
                            "Faster route",
                            "I want the wallet instead of the bank.",
                          ],
                          [
                            "other",
                            "Something else",
                            "No further detail needed.",
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label key={value} className="im-radio">
                          <input
                            type="radio"
                            name="cancel-payout-reason"
                            checked={cancelReason === value}
                            onChange={() => setCancelReason(value)}
                          />
                          <span>
                            <b>{label}</b>
                            <small>{hint}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <div className="im-review">
                      <div>
                        <span>Reference</span>
                        <b className="mono">{payoutRow.reference}</b>
                      </div>
                      <div>
                        <span>Amount</span>
                        <b className="mono">{money(payoutRow.amount, 2)}</b>
                      </div>
                      <div>
                        <span>Reason</span>
                        <b>{cancelReason}</b>
                      </div>
                      <div>
                        <span>Balance after</span>
                        <b className="mono is-pos">
                          {money(
                            (activeRow?.availablePayout ?? 0) +
                              payoutRow.amount,
                            2,
                          )}{" "}
                          on {payoutRow.poolCode}
                        </b>
                      </div>
                      <p>
                        The amount returns to your accrued balance and can be
                        requested again at any time.
                      </p>
                    </div>
                  )}
                </>
              ) : null}

              {modal.kind === "retryPayout" && payoutRow ? (
                <div className="im-review im-review--ack">
                  <p>
                    Re-queue {payoutRow.reference} for {money(payoutRow.net, 2)}{" "}
                    to {payoutRow.destination}? The original request was
                    cancelled, so nothing is currently in flight.
                  </p>
                  <p className="im-foot-note">
                    Local preview only — no provider is contacted and no batch
                    is scheduled.
                  </p>
                </div>
              ) : null}

              {modal.kind === "preferences" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <label className="im-toggle">
                        <input
                          type="checkbox"
                          checked={prefEmail}
                          onChange={(event) =>
                            setPrefEmail(event.target.checked)
                          }
                        />
                        <span>
                          <b>Email me statements</b>
                          <small>
                            Final statements and payout advices on the day they
                            settle.
                          </small>
                        </span>
                      </label>
                      <label className="im-toggle">
                        <input
                          type="checkbox"
                          checked={prefReinvest}
                          onChange={(event) =>
                            setPrefReinvest(event.target.checked)
                          }
                        />
                        <span>
                          <b>Auto-reinvest settled payouts</b>
                          <small>
                            Offer the next matching pool instead of paying out
                            at cycle end.
                          </small>
                        </span>
                      </label>
                      <label className="im-toggle">
                        <input
                          type="checkbox"
                          checked={prefHide}
                          onChange={(event) =>
                            setPrefHide(event.target.checked)
                          }
                        />
                        <span>
                          <b>Compact completed list</b>
                          <small>
                            Show only the latest settled cycle on the page.
                          </small>
                        </span>
                      </label>
                      <fieldset className="im-fieldset">
                        <legend>Reminder lead time</legend>
                        {([1, 2, 3, 7] as const).map((days) => (
                          <label key={days} className="im-radio">
                            <input
                              type="radio"
                              name="pref-lead"
                              checked={prefLead === days}
                              onChange={() => setPrefLead(days)}
                            />
                            <span>
                              <b>{days} day(s) before</b>
                              <small>Applies to every booking reminder.</small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    </>
                  ) : (
                    <div className="im-review">
                      <div>
                        <span>Statements</span>
                        <b>{prefEmail ? "Email + in-app" : "In-app only"}</b>
                      </div>
                      <div>
                        <span>Auto-reinvest</span>
                        <b>{prefReinvest ? "On" : "Off"}</b>
                      </div>
                      <div>
                        <span>Completed list</span>
                        <b>{prefHide ? "Compact" : "Full"}</b>
                      </div>
                      <div>
                        <span>Reminder lead</span>
                        <b>{prefLead} day(s)</b>
                      </div>
                      <p>
                        Stored in this session; the desk keeps its own defaults.
                      </p>
                    </div>
                  )}
                </>
              ) : null}

              {modal.kind === "risk" ? (
                <>
                  <p className="im-note">
                    Crowdfunding pools trade synthetic indices. Capital is at
                    risk and past cycles do not guarantee the next one.
                  </p>
                  <ul className="im-list">
                    <li>
                      <b>Capital risk.</b> Drawdown stops pool execution at 5%,
                      but a losing cycle can still return less than you put in.
                    </li>
                    <li>
                      <b>Lock-up.</b> Interim payouts unlock after{" "}
                      {PAYOUT_LOCK_DAYS} trading days; the rest settles when the
                      cycle completes.
                    </li>
                    <li>
                      <b>Platform cut.</b> 20% of your gross share is retained
                      by the platform before net earnings are credited.
                    </li>
                    <li>
                      <b>No guarantee.</b> Expected ROI on a pool page is a
                      planning figure, not a promise.
                    </li>
                  </ul>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("settlement")}
                    >
                      Settlement terms
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("help")}
                    >
                      Boundaries
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "settlement" ? (
                <>
                  <p className="im-note">
                    Settlement is the point where a pool's profit becomes your
                    earnings, and where your earnings become cash.
                  </p>
                  <ol className="im-steps">
                    <li>
                      <b>Batch close.</b> The desk closes every trade at 17:00
                      UTC and posts the pool result.
                    </li>
                    <li>
                      <b>Share split.</b> Your pool share applies to the result,
                      then the 20% platform cut comes off.
                    </li>
                    <li>
                      <b>Accrual.</b> The net amount lands on the position as
                      accrued earnings.
                    </li>
                    <li>
                      <b>Payout.</b> Interim requests pay out on the next batch;
                      a completed cycle pays its full balance automatically.
                    </li>
                  </ol>
                  <dl className="im-kv">
                    <div>
                      <dt>Batch time</dt>
                      <dd className="mono">Daily 17:00 UTC</dd>
                    </div>
                    <div>
                      <dt>Bank settlement</dt>
                      <dd className="mono">1–2 business days</dd>
                    </div>
                    <div>
                      <dt>Wallet credit</dt>
                      <dd className="mono">Instant</dd>
                    </div>
                    <div>
                      <dt>Statement</dt>
                      <dd className="mono">Issued same day</dd>
                    </div>
                  </dl>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("payoutPolicy")}
                    >
                      Payout policy
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("documents")}
                    >
                      Documents
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "kyc" ? (
                <>
                  <div className="im-modal-head">
                    <Tag tone="is-l2">{data.kyc.level} verified</Tag>
                    <b className="mono">{dateOf(data.kyc.verifiedAt)}</b>
                    <span className="im-muted">compliance desk approved</span>
                  </div>
                  <dl className="im-kv">
                    {data.kyc.limits.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd className="mono">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="im-note">
                    <b>{data.kyc.nextLevel}.</b> {data.kyc.nextLevelRequirement}
                  </p>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("documents")}
                    >
                      Certificate
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("support")}
                    >
                      Ask compliance
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "documents" ? (
                <>
                  <div className="im-doc-grid">
                    <ul className="im-doc-list">
                      {data.documents.map((row) => (
                        <li
                          key={row.id}
                          className={
                            row.id === documentRow?.id ? "is-selected" : ""
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedDoc(row.id)}
                          >
                            <Icon
                              name={
                                row.kind === "payout"
                                  ? "wallet"
                                  : row.kind === "kyc"
                                    ? "shield"
                                    : "file"
                              }
                              size={14}
                            />
                            <span>
                              <b>{row.title}</b>
                              <small className="mono">
                                {row.poolCode} · {row.period}
                              </small>
                            </span>
                            <small className="mono">{row.sizeKb} kB</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {documentRow ? (
                      <div className="im-doc-preview">
                        <span className="im-section-code">
                          {documentRow.kind.toUpperCase()}
                        </span>
                        <h4>{documentRow.title}</h4>
                        <dl className="im-kv">
                          <div>
                            <dt>Pool</dt>
                            <dd className="mono">{documentRow.poolCode}</dd>
                          </div>
                          <div>
                            <dt>Period</dt>
                            <dd className="mono">{documentRow.period}</dd>
                          </div>
                          <div>
                            <dt>Issued</dt>
                            <dd className="mono">
                              {dateOf(documentRow.createdAt)}
                            </dd>
                          </div>
                          <div>
                            <dt>Size</dt>
                            <dd className="mono">{documentRow.sizeKb} kB</dd>
                          </div>
                        </dl>
                        <p className="im-muted">
                          Desk-issued copy. Regenerate it from the current
                          snapshot if you need a fresh version.
                        </p>
                        <div className="im-modal-actions">
                          <button
                            type="button"
                            className="im-btn im-btn--primary"
                            onClick={() => {
                              setExportScope("statement");
                              open("statementExport");
                            }}
                          >
                            <Icon name="download" size={13} /> Regenerate
                          </button>
                          <button
                            type="button"
                            className="im-btn"
                            onClick={() =>
                              void copy(
                                documentRow.id.toUpperCase(),
                                "Document id",
                              )
                            }
                          >
                            <Icon name="copy" size={13} /> Copy id
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <p className="im-foot-note">
                    {data.documents.length} documents · statements are issued
                    per settled cycle, receipts per booking, advices per payout.
                  </p>
                </>
              ) : null}

              {modal.kind === "notes" ? (
                <>
                  <div className="im-note-form">
                    <label className="im-field">
                      <span>New note</span>
                      <textarea
                        rows={3}
                        value={noteBody}
                        onChange={(event) => setNoteBody(event.target.value)}
                        placeholder="What do you want to remember about this position?"
                        maxLength={600}
                      />
                      <small className="im-muted">
                        {noteBody.trim().length}/600 · at least 8 characters
                      </small>
                    </label>
                    <div className="im-note-form__actions">
                      <label className="im-field im-field--inline">
                        <span>Position</span>
                        <select
                          value={selectedActive}
                          onChange={(event) => {
                            setSelectedActive(event.target.value);
                          }}
                        >
                          {data.active.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.code} · {row.name}
                            </option>
                          ))}
                          {data.completed.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.code} · {row.name} (settled)
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="im-btn im-btn--primary"
                        disabled={busy || noteBody.trim().length < 8}
                        onClick={() =>
                          void run(
                            {
                              kind: "addNote",
                              investmentId: selectedActive,
                              body: noteBody.trim(),
                            },
                            { keep: true, title: "Journal note saved locally" },
                          ).then((ok) => {
                            if (ok) setNoteBody("");
                          })
                        }
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                  <h4 className="im-subhead">
                    Journal · {data.notes.length} note(s)
                  </h4>
                  {data.notes.length ? (
                    <ul className="im-notes">
                      {data.notes.map((row) => (
                        <li key={row.id}>
                          <div>
                            <b className="mono">{row.poolCode}</b>
                            <span className="im-muted mono">
                              {atStamp(row.createdAt)}
                            </span>
                          </div>
                          <p>{row.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="im-empty-line">
                      No notes yet — the first one shows here.
                    </p>
                  )}
                  <h4 className="im-subhead">Recent events</h4>
                  <ul className="im-note-events">
                    {data.timeline.slice(0, 6).map((event) => (
                      <li key={event.id}>
                        <Tag tone={`is-${event.kind}`}>
                          {timelineLabel(event.kind)}
                        </Tag>
                        <span>{event.title}</span>
                        <span className="mono im-muted">
                          {shortDateOf(event.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {modal.kind === "support" ? (
                <>
                  {wizardStep === 0 ? (
                    <fieldset className="im-fieldset">
                      <legend>Topic</legend>
                      {(
                        [
                          [
                            "payout",
                            "A payout",
                            "Timing, fee or a cancelled request.",
                          ],
                          [
                            "statement",
                            "A statement",
                            "Numbers on a settled cycle or receipt.",
                          ],
                          [
                            "booking",
                            "A booking",
                            "Slots, payment verification or a window.",
                          ],
                          [
                            "kyc",
                            "Verification",
                            "Level 3 review or a document.",
                          ],
                          [
                            "other",
                            "Something else",
                            "Anything not covered above.",
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label key={value} className="im-radio">
                          <input
                            type="radio"
                            name="support-topic"
                            checked={supportTopic === value}
                            onChange={() => setSupportTopic(value)}
                          />
                          <span>
                            <b>{label}</b>
                            <small>{hint}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  {wizardStep === 1 ? (
                    <label className="im-field">
                      <span>Message</span>
                      <textarea
                        rows={5}
                        value={supportMessage}
                        onChange={(event) =>
                          setSupportMessage(event.target.value)
                        }
                        placeholder="Include a pool code or payout reference if you have one."
                      />
                      <small className="im-muted">
                        {supportMessage.trim().length}/1000 · at least 12
                      </small>
                    </label>
                  ) : null}
                  {wizardStep === 2 ? (
                    <div className="im-review">
                      <div>
                        <span>Topic</span>
                        <b>{supportTopic}</b>
                      </div>
                      <div>
                        <span>Message</span>
                        <b>
                          {supportMessage.trim().slice(0, 90)}
                          {supportMessage.trim().length > 90 ? "…" : ""}
                        </b>
                      </div>
                      <p>
                        Saved as a draft in this session; no message is
                        transmitted.
                      </p>
                    </div>
                  ) : null}
                  {data.support.length ? (
                    <p className="im-foot-note">
                      {data.support.length} draft(s) saved · last{" "}
                      {clockOf(data.support[0].createdAt)} UTC
                    </p>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "allocation" ? (
                <>
                  <p className="im-note">
                    How your capital splits across positions. Booked slots are
                    counted but not yet at work; registered interest is excluded
                    because no payment was taken.
                  </p>
                  <ul className="im-alloc im-alloc--lg">
                    {data.allocations.map((row) => (
                      <li key={`${row.poolCode}-${row.stage}`}>
                        <span className="im-alloc__label">
                          <b className="mono">{row.poolCode}</b>
                          <small>
                            {row.name} · {stageLabel(row.stage)}
                          </small>
                        </span>
                        <span className="im-alloc__bar">
                          <span
                            className={`im-alloc__fill is-${row.stage}`}
                            style={{
                              width: `${Math.max(2, (row.amount / allocationTotal) * 100)}%`,
                            }}
                          />
                        </span>
                        <b className="mono">{money(row.amount)}</b>
                        <span className="im-muted mono">
                          {((row.amount / allocationTotal) * 100).toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  <dl className="im-kv">
                    <div>
                      <dt>Total across positions</dt>
                      <dd className="mono">{money(summary.totalInvested)}</dd>
                    </div>
                    <div>
                      <dt>At work now</dt>
                      <dd className="mono">{money(summary.activeCapital)}</dd>
                    </div>
                    <div>
                      <dt>Awaiting trading</dt>
                      <dd className="mono">{money(summary.bookedCapital)}</dd>
                    </div>
                    <div>
                      <dt>Settled</dt>
                      <dd className="mono">
                        {money(summary.completedCapital)}
                      </dd>
                    </div>
                  </dl>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("preferences")}
                    >
                      Reinvestment rules
                    </button>
                    <Link className="im-btn" href="/investor/pools">
                      Open pools
                    </Link>
                  </div>
                </>
              ) : null}

              {modal.kind === "milestone" && milestoneRow ? (
                <>
                  <div className="im-modal-head">
                    <Tag tone="is-milestone">{milestoneRow.state}</Tag>
                    <b className="mono">{milestoneRow.code}</b>
                    <span>{milestoneRow.name}</span>
                  </div>
                  <dl className="im-kv">
                    <div>
                      <dt>Booking opens</dt>
                      <dd className="mono">{atStamp(milestoneRow.date)}</dd>
                    </div>
                    <div>
                      <dt>Expected ROI</dt>
                      <dd className="mono">{milestoneRow.expectedRoiPct}%</dd>
                    </div>
                    <div>
                      <dt>Countdown</dt>
                      <dd className="mono">
                        {countdown(milestoneRow.date, clock).label}
                      </dd>
                    </div>
                    <div>
                      <dt>Your capital ready</dt>
                      <dd className="mono">
                        {money(summary.pendingPayoutAmount, 2)}
                      </dd>
                    </div>
                  </dl>
                  <p className="im-note">
                    Book on the pool page when the window opens, or register
                    interest now so the desk knows your size. Nothing is
                    reserved either way.
                  </p>
                  <div className="im-modal-actions">
                    <Link
                      className="im-btn"
                      href={`/investor/pools/${milestoneRow.id}`}
                    >
                      Pool page
                    </Link>
                    <Link className="im-btn" href="/investor/pools">
                      All windows
                    </Link>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("reminder")}
                      disabled={!bookedRow}
                    >
                      Remind me
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "help" ? (
                <>
                  <p className="im-note">
                    This page is a full-fidelity preview of the investor
                    holdings ledger. Everything you can click works, and nothing
                    leaves the browser.
                  </p>
                  <ul className="im-list">
                    <li>
                      <b>Reads.</b> Positions, payouts, documents and the
                      timeline come from one DTO served by{" "}
                      <span className="mono">/api/investor/investments</span>.
                    </li>
                    <li>
                      <b>Writes.</b> Payout requests, cancellations, reminders,
                      preferences, notes and exports are local to this session.
                      The API has no write handler, so mutations return 405.
                    </li>
                    <li>
                      <b>Money.</b> Net earnings are gross minus the 20%
                      platform cut. Requests above the accrued balance or inside
                      the {PAYOUT_LOCK_DAYS}-day lock are refused with the
                      reason shown.
                    </li>
                    <li>
                      <b>Downloads.</b> Statements, portfolio summaries, the
                      timeline and the payout ledger export as real PDF, CSV or
                      JSON files generated here.
                    </li>
                  </ul>
                  <div className="im-modal-actions">
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("settlement")}
                    >
                      Settlement terms
                    </button>
                    <button
                      type="button"
                      className="im-btn"
                      onClick={() => open("support")}
                    >
                      Message the desk
                    </button>
                  </div>
                </>
              ) : null}

              {modalBlock ? (
                <p className="im-modal-note" role="status">
                  {modalBlock}
                </p>
              ) : null}
            </DeskModalShell>
          </div>
        ) : null}
      </div>
    </InvestorShell>
  );
}
