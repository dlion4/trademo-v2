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
import { Icon, type IconName } from "@/components/icons";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import {
  POOL_BOOKING_AS_OF,
  bookingAmount,
  bookingDraftError,
  bookingStageRows,
  bookingTotals,
  buildBookingPayload,
  cancelReasonLabel,
  feeFor,
  feeTableRows,
  lifecycleLabel,
  methodAvailable,
  methodByKey,
  paymentFieldError,
  reservationWindow,
  round2,
  slotLabel,
  slotsForYou,
  stageLabels,
  statusLabels,
  tokensFor,
  totalDue,
  walletShortfall,
  type BookingCommand,
  type BookingHistoryRow,
  type BookingRecord,
  type CancelReason,
  type PaymentFieldSpec,
  type PaymentMethodDef,
  type PaymentMethodKey,
  type PoolBookingWorkspace,
} from "@/lib/investor/pool-booking";
import { usePoolBooking } from "@/lib/investor/use-pool-booking";
import {
  InvestorShell,
  type InvestorDrawerTab,
  type InvestorNavKey,
  type InvestorQuickAction,
} from "./investor-shell";

/* ── Formatting ── */

const money = (value: number, decimals = 0) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
const plainPercent = (value: number, decimals = 0) =>
  `${Math.abs(value).toFixed(decimals)}%`;
const atDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const atTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
const atDateTime = (iso: string) => `${atDate(iso)} · ${atTime(iso)} UTC`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
const isoDay = (iso: string) => iso.slice(0, 10);
const titleCase = (value: string) =>
  value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
const statusTone = (status: BookingRecord["status"]) =>
  status === "confirmed" || status === "verified"
    ? "is-confirmed"
    : status === "received"
      ? "is-received"
      : status === "cancelled"
        ? "is-cancelled"
        : "is-pending";

/* ── Dialog registry ── */

type Kind =
  | "terms"
  | "lockup"
  | "risk"
  | "fees"
  | "reservation"
  | "paymentHelp"
  | "escrow"
  | "kyc"
  | "orderSummary"
  | "afterPayment"
  | "support"
  | "cancel"
  | "saved"
  | "topUp"
  | "projection"
  | "referral"
  | "history"
  | "receipt"
  | "share"
  | "help"
  | "statusDetail";

const titles: Record<Kind, string> = {
  terms: "Pool terms",
  lockup: "Lock-up & early exit",
  risk: "Risk disclosure",
  fees: "Fees by payment rail",
  reservation: "72-hour reservation policy",
  paymentHelp: "Payment rails & limits",
  escrow: "Escrow account & wire details",
  kyc: "KYC & funds source",
  orderSummary: "Order summary",
  afterPayment: "What happens after payment",
  support: "Contact the funding desk",
  cancel: "Cancel this reservation",
  saved: "Saved accounts & cards",
  topUp: "Top up your wallet",
  projection: "Project this booking",
  referral: "Invite an investor",
  history: "Booking history",
  receipt: "Payment receipt",
  share: "Share booking instructions",
  help: "Workspace boundaries",
  statusDetail: "Reservation timeline",
};

const wizardKinds: Kind[] = [
  "support",
  "cancel",
  "topUp",
  "projection",
  "referral",
  "risk",
];

const steps = ["Prepare", "Review order", "Acknowledge"] as const;

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  terms: "lg",
  risk: "lg",
  fees: "lg",
  paymentHelp: "xl",
  escrow: "md",
  kyc: "lg",
  orderSummary: "lg",
  afterPayment: "lg",
  cancel: "md",
  saved: "md",
  topUp: "md",
  projection: "md",
  referral: "md",
  history: "xl",
  receipt: "lg",
  share: "md",
  help: "lg",
  statusDetail: "lg",
  reservation: "md",
  lockup: "md",
};

const quickActions: InvestorQuickAction[] = [
  { key: "slots", label: "Select slots", short: "Slots", icon: "plus" },
  { key: "method", label: "Payment method", short: "Method", icon: "wallet" },
  { key: "summary", label: "Order summary", short: "Order", icon: "file" },
  {
    key: "receipt",
    label: "Payment receipt",
    short: "Receipt",
    icon: "download",
  },
  { key: "support", label: "Contact the desk", short: "Support", icon: "mail" },
  { key: "pools", label: "All pools", short: "Pools", icon: "pool" },
];

const pageSteps = [
  {
    key: "details",
    label: "Pool details",
    hint: "Window, limits, holdings",
    id: "pb-details",
  },
  {
    key: "slots",
    label: "Select slots",
    hint: "Quantity and allocation",
    id: "pb-slots",
  },
  {
    key: "method",
    label: "Payment method",
    hint: "Rail, fees, instructions",
    id: "pb-method",
  },
  {
    key: "review",
    label: "Review & confirm",
    hint: "Order summary and terms",
    id: "pb-review",
  },
  {
    key: "status",
    label: "Payment status",
    hint: "Reservation tracker",
    id: "pb-status",
  },
] as const;

const blankDetails = (): Record<string, string> => ({
  bankName: "",
  accountNumber: "",
  routingNumber: "",
  accountHolder: "",
  provider: "mpesa",
  phone: "",
  confirmSms: "",
  cardNumber: "",
  expiry: "",
  cvc: "",
  cardName: "",
  zip: "",
  currency: "usdt",
  walletAddress: "",
  network: "erc20",
});

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
    <header className="pb-section-head">
      <div>
        <span className="pb-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="pb-section-aside">{aside}</div> : null}
    </header>
  );
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="pb-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="pb-progress__fill"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="pb-fact">
      <span>{label}</span>
      <b className="mono">{value}</b>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function Tracker({ rows }: { rows: ReturnType<typeof bookingStageRows> }) {
  return (
    <ol className="pb-tracker">
      {rows.map((row, index) => (
        <li
          key={row.key}
          className={`pb-tracker__row is-${row.state}`}
          style={{ "--pb-delay": `${index * 60}ms` } as CSSProperties}
        >
          <span className="pb-tracker__mark" aria-hidden="true">
            {row.state === "done" ? (
              <Icon name="check" size={12} />
            ) : row.state === "current" ? (
              <span className="pb-spin" />
            ) : row.state === "blocked" ? (
              <Icon name="close" size={11} />
            ) : (
              <span className="pb-tracker__ring" />
            )}
          </span>
          <div className="pb-tracker__body">
            <div>
              <b>{row.label}</b>
              <span className="mono">
                {row.at ? `${atTime(row.at)} · ${shortDate(row.at)}` : "—"}
              </span>
            </div>
            <p>{row.note}</p>
          </div>
          <span className={`pb-tracker__state is-${row.state}`}>
            {row.state === "done"
              ? "Done"
              : row.state === "current"
                ? "Pending"
                : row.state === "blocked"
                  ? "Cancelled"
                  : "Queued"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ── Page ── */

export function InvestorPoolBookingPage({
  initial,
  initialStep,
  initialSlots,
  initialMethod,
  initialAction,
}: {
  initial: PoolBookingWorkspace;
  initialStep?: string;
  initialSlots?: string;
  initialMethod?: string;
  initialAction?: string;
}) {
  const router = useRouter();
  const { data, mutation } = usePoolBooking(initial);
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

  const availableOnLoad = slotsForYou(initial.pool, initial.existing);
  const parsedSlots = Number.parseInt(initialSlots ?? "", 10);
  const startSlots = Number.isFinite(parsedSlots)
    ? Math.min(Math.max(1, parsedSlots), Math.max(1, availableOnLoad))
    : Math.min(3, Math.max(1, availableOnLoad));
  const startMethod: PaymentMethodKey = initial.methods.some(
    (item) => item.key === initialMethod,
  )
    ? (initialMethod as PaymentMethodKey)
    : "bank_transfer";
  const parsedStep = Number.parseInt(initialStep ?? "", 10);
  const startStep =
    Number.isFinite(parsedStep) && parsedStep >= 1 && parsedStep <= 5
      ? parsedStep - 1
      : 0;

  const actionMap: Record<string, Kind> = {
    terms: "terms",
    lockup: "lockup",
    risk: "risk",
    fees: "fees",
    reservation: "reservation",
    payment: "paymentHelp",
    escrow: "escrow",
    kyc: "kyc",
    summary: "orderSummary",
    after: "afterPayment",
    support: "support",
    cancel: "cancel",
    saved: "saved",
    topup: "topUp",
    projection: "projection",
    referral: "referral",
    history: "history",
    receipt: "receipt",
    share: "share",
    help: "help",
    status: "statusDetail",
  };

  const [modal, setModal] = useState<{ kind: Kind } | null>(() => {
    const kind = initialAction ? actionMap[initialAction] : undefined;
    return kind ? { kind } : null;
  });
  const [wizardStep, setWizardStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(startStep);
  const [drawer, setDrawer] = useState<"summary" | "tracker" | "fees" | null>(
    null,
  );
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("book");
  const [clock, setClock] = useState(initial.asOf);
  const [lastRefresh, setLastRefresh] = useState(initial.asOf);
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv" | "json">(
    "pdf",
  );
  const [supportTopic, setSupportTopic] = useState<
    "payment" | "escrow" | "booking" | "kyc" | "other"
  >("payment");
  const [supportMessage, setSupportMessage] = useState("");
  const [cancelReason, setCancelReason] =
    useState<CancelReason>("changed_plan");
  const [topUpAmount, setTopUpAmount] = useState(5000);
  const [topUpMethod, setTopUpMethod] = useState<"bank_transfer" | "card">(
    "bank_transfer",
  );
  const [projectionSlots, setProjectionSlots] = useState(startSlots);
  const [projectionRoi, setProjectionRoi] = useState(
    initial.pool.expectedRoiPct,
  );
  const [referralEmail, setReferralEmail] = useState("");
  const [referralChannel, setReferralChannel] = useState<"email" | "link">(
    "email",
  );
  const [details, setDetails] = useState<Record<string, string>>(blankDetails);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(
    {},
  );
  const [historySorting, setHistorySorting] = useState<SortingState>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const closeRef = useRef<() => void>(() => {});

  const form = useForm({
    defaultValues: {
      slots: startSlots,
      method: startMethod,
      terms: { terms: false, lockup: false, funds: false },
      details: blankDetails(),
    },
    onSubmit: ({ value }) => {
      void createBooking(value);
    },
  });

  useEffect(() => {
    const timer = window.setInterval(
      () => setClock((prev) => new Date(Date.parse(prev) + 1000).toISOString()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const pool = data.pool;
  const existing = data.existing;
  const activeRecord = data.records[0] ?? null;
  const stages = bookingStageRows(activeRecord, data.escrow);
  const available = slotsForYou(pool, existing);
  const closesIn = (() => {
    const total = Math.max(
      0,
      Math.floor((Date.parse(pool.closesAt) - Date.parse(clock)) / 1000),
    );
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return {
      total,
      label: `${days}d ${hours}h ${minutes}m`,
      clock: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      urgent: total > 0 && total < 86400,
    };
  })();
  const reservation = reservationWindow(activeRecord, clock);
  const refreshAge = Math.max(
    0,
    Math.floor((Date.parse(clock) - Date.parse(lastRefresh)) / 1000),
  );

  /* ── Effects ── */

  const overlay = Boolean(modal || drawer);
  useEffect(() => {
    if (!overlay) return;
    const prior = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const layer = document.querySelector<HTMLElement>(
      ".page-investor-pool-booking [role=dialog]",
    );
    const first = layer?.querySelector<HTMLElement>(
      "button:not(:disabled), [href], input:not(:disabled), select, textarea",
    );
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !layer) return;
      const nodes = Array.from(
        layer.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((node) => node.offsetParent !== null);
      if (!nodes.length) return;
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      if (prior && document.contains(prior)) prior.focus();
    };
  }, [overlay]);

  useEffect(() => {
    if (!modal) return;
    const timer = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          ".page-investor-pool-booking .desk-modal__body input, .page-investor-pool-booking .desk-modal__body select, .page-investor-pool-booking .desk-modal__body textarea",
        )
        ?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [modal, wizardStep]);

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
    if (kind === "projection") {
      setProjectionSlots(form.state.values.slots);
      setProjectionRoi(pool.expectedRoiPct);
    }
    if (kind === "topUp") {
      const due = totalDue(
        methodByKey(data.methods, form.state.values.method),
        bookingAmount(pool, form.state.values.slots),
      );
      setTopUpAmount(
        Math.max(500, Math.ceil((due - data.profile.wallet) / 500) * 500),
      );
    }
  }

  function scrollToStep(index: number) {
    const target =
      pageSteps[Math.max(0, Math.min(pageSteps.length - 1, index))];
    setStep(index);
    if (typeof document === "undefined") return;
    document
      .getElementById(target.id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function jumpToStep(index: number) {
    if (index > 0 && index < 4 && !data.bookable) {
      pushToast({
        tone: "warning",
        title: "Booking is closed for this window",
        detail:
          data.blockedReason ??
          "Only the pool facts and the tracker are available here.",
      });
      return;
    }
    scrollToStep(index);
  }

  async function run(
    command: BookingCommand,
    opts?: { keep?: boolean; title?: string; detail?: string },
  ) {
    setError("");
    setBusy(true);
    try {
      await mutation.mutateAsync(command);
      pushToast({
        tone: "success",
        title: opts?.title ?? "Local booking context updated",
        detail:
          opts?.detail ??
          "Recorded in this browser session only — no payment was captured and capacity is not reserved with a provider.",
      });
      if (!opts?.keep) close();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command could not be applied");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function setDetail(name: string, value: string) {
    setDetails((prev) => ({ ...prev, [name]: value }));
  }

  async function createBooking(values: {
    slots: number;
    method: PaymentMethodKey;
    terms: { terms: boolean; lockup: boolean; funds: boolean };
  }) {
    const draft = {
      pool,
      methods: data.methods,
      slots: values.slots,
      method: values.method,
      details,
      terms: values.terms,
      wallet: data.profile.wallet,
      bookable: data.bookable,
      blockedReason: data.blockedReason,
      existing,
    };
    const message = bookingDraftError(draft);
    if (message) {
      setError(message);
      pushToast({
        tone: "error",
        title: "Booking needs attention",
        detail: message,
      });
      return;
    }
    const payload = buildBookingPayload(draft);
    const ok = await run(
      {
        kind: "createBooking",
        slots: values.slots,
        method: values.method,
        details,
        terms: values.terms,
      },
      {
        keep: true,
        title: "Reservation held locally",
        detail: `${slotLabel(payload.slots)} · ${money(payload.total, 2)} total · reference generated on this page only.`,
      },
    );
    if (!ok) return;
    setStep(4);
    window.setTimeout(
      () =>
        document
          .getElementById("pb-status")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  async function advancePayment() {
    if (!activeRecord) return;
    await run(
      { kind: "advanceBooking", bookingId: activeRecord.id },
      {
        keep: true,
        title: "Operator step simulated locally",
        detail: `${activeRecord.id} moved forward one stage. Nothing was verified with a bank or provider.`,
      },
    );
  }

  async function confirmCancel() {
    if (!activeRecord) return;
    await run(
      {
        kind: "cancelBooking",
        bookingId: activeRecord.id,
        reason: cancelReason,
      },
      {
        title: "Reservation cancelled locally",
        detail: `${slotLabel(activeRecord.slots)} released back to ${pool.code}.`,
      },
    );
  }

  async function refresh() {
    setBusy(true);
    try {
      await mutation.mutateAsync({ kind: "refreshBooking", source: "manual" });
      setLastRefresh(new Date().toISOString());
      pushToast({
        tone: "info",
        title: "Funding context re-read",
        detail: "Countdowns restarted; escrow coordinates are unchanged.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
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

  function summaryRows() {
    const method = methodByKey(data.methods, form.state.values.method);
    const slots = form.state.values.slots;
    const totals = bookingTotals(pool, slots, method, existing);
    return [
      { field: "Pool", value: `${pool.code} · ${pool.name}` },
      { field: "Window", value: lifecycleLabel(pool.lifecycle) },
      { field: "Closes", value: atDateTime(pool.closesAt) },
      { field: "Slots", value: String(slots) },
      { field: "Slot price", value: money(pool.slotPrice) },
      { field: "Investment", value: money(totals.amount) },
      {
        field: "Token allocation",
        value: `${totals.tokens.toLocaleString()} ${pool.tokenSymbol}`,
      },
      { field: "Share of pool", value: `${plainPercent(totals.sharePct, 2)}` },
      { field: "Payment method", value: method.label },
      { field: "Fee", value: `${method.feeLabel} · ${money(totals.fee, 2)}` },
      { field: "Total due", value: money(totals.total, 2) },
      {
        field: "Reservation window",
        value: `${data.escrow.windowHours} hours`,
      },
    ];
  }

  function instructionsRows() {
    return [
      { field: "Beneficiary", value: data.escrow.bankName },
      { field: "Account name", value: data.escrow.accountName },
      { field: "Account number", value: data.escrow.accountNumber },
      { field: "Routing", value: data.escrow.routingNumber },
      { field: "SWIFT", value: data.escrow.swift },
      {
        field: "Reference",
        value:
          activeRecord?.reference ??
          `${data.profile.bookingHandle} · generated when you confirm`,
      },
      {
        field: "Amount",
        value: money(bookingAmount(pool, form.state.values.slots), 2),
      },
      {
        field: "Hold",
        value: `${data.escrow.windowHours} hours from booking creation`,
      },
    ];
  }

  function receiptRows(record: BookingRecord) {
    return [
      { field: "Booking", value: record.id },
      { field: "Receipt", value: record.receiptNo },
      { field: "Pool", value: `${pool.code} · ${pool.name}` },
      { field: "Slots", value: String(record.slots) },
      { field: "Investment", value: money(record.amount, 2) },
      { field: "Fee", value: money(record.fee, 2) },
      { field: "Total", value: money(record.total, 2) },
      { field: "Rail", value: record.methodLabel },
      { field: "Reference", value: record.reference },
      { field: "Status", value: statusLabels[record.status] },
      { field: "Created", value: atDateTime(record.createdAt) },
      { field: "Updated", value: atDateTime(record.updatedAt) },
      {
        field: "Reservation expires",
        value: atDateTime(record.reservationExpiresAt),
      },
      { field: "Operator note", value: record.operatorNote },
    ];
  }

  async function exportRows(
    scope: "order-summary" | "payment-instructions" | "receipt" | "history",
    rows: Record<string, unknown>[],
    fileBase: string,
    heading: string,
  ) {
    setBusy(true);
    try {
      const stamp = isoDay(data.asOf);
      if (exportFormat === "json") {
        download(
          JSON.stringify(
            {
              mode: "demo",
              asOf: data.asOf,
              scope,
              pool: pool.code,
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
          `Pool ${pool.code} ${pool.name} · investor ${data.profile.displayName}`,
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
          doc.text(
            `${String(row.field ?? "line")}: ${String(row.value ?? "").slice(0, 120)}`,
            18,
            y,
          );
          y += 6;
        });
        doc.save(`${fileBase}-${stamp}.pdf`);
      }
      await mutation.mutateAsync({
        kind: "recordExport",
        scope,
        format: exportFormat,
        count: rows.length,
      });
      pushToast({
        tone: "success",
        title: `${heading} generated in-browser`,
        detail: `${rows.length} line(s) · ${exportFormat.toUpperCase()} · demo export only.`,
      });
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ tone: "info", title: `${label} copied`, detail: value });
    } catch {
      pushToast({
        tone: "warning",
        title: "Clipboard unavailable",
        detail: `Copy manually: ${value}`,
      });
    }
  }

  function useSaved(id: string) {
    const saved = data.savedMethods.find((item) => item.id === id);
    if (!saved) return;
    form.setFieldValue(
      "method",
      saved.kind === "card" ? "card" : "bank_transfer",
    );
    if (saved.kind === "card") {
      setDetails((prev) => ({
        ...prev,
        cardName: saved.holder,
        cardNumber: "4242424242424242",
        expiry: "03/29",
        cvc: "123",
        zip: "20100",
      }));
    } else {
      setDetails((prev) => ({
        ...prev,
        bankName: saved.label.split(" · ")[0],
        accountHolder: saved.holder,
        accountNumber: saved.id === "saved_equity" ? "77128844" : "0011223344",
        routingNumber: saved.id === "saved_equity" ? "EQBLKENA" : "021000021",
      }));
    }
    close();
    scrollToStep(2);
    pushToast({
      tone: "info",
      title: "Saved account selected",
      detail: `${saved.label} prefilled. No credentials were stored.`,
    });
  }

  /* ── History table ── */

  const historyColumn = useMemo(
    () => createDeskColumnHelper<BookingHistoryRow>(),
    [],
  );
  const historyColumns = useMemo(
    () =>
      historyColumn.columns([
        historyColumn.accessor("code", {
          header: "Pool",
          cell: (info) => (
            <span>
              <b className="mono">{info.getValue()}</b>
              <small className="pb-table-sub">{info.row.original.name}</small>
            </span>
          ),
        }),
        historyColumn.accessor("slots", {
          header: "Slots",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        historyColumn.accessor("amount", {
          header: "Committed",
          cell: (info) => (
            <span className="mono">{money(info.getValue())}</span>
          ),
        }),
        historyColumn.accessor("methodLabel", { header: "Rail" }),
        historyColumn.accessor("status", {
          header: "Status",
          cell: (info) => (
            <span
              className={`pb-tag ${
                info.getValue() === "Confirmed" || info.getValue() === "Settled"
                  ? "is-confirmed"
                  : info.getValue() === "Cancelled"
                    ? "is-cancelled"
                    : "is-pending"
              }`}
            >
              {info.getValue()}
            </span>
          ),
        }),
        historyColumn.accessor("createdAt", {
          header: "Created",
          cell: (info) => (
            <span className="mono">{shortDate(info.getValue())}</span>
          ),
        }),
        historyColumn.accessor("reference", {
          header: "Reference",
          cell: (info) => (
            <span className="mono pb-table-ref">{info.getValue()}</span>
          ),
        }),
      ]),
    [historyColumn],
  );
  const historyRows = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return data.history;
    return data.history.filter((row) =>
      `${row.code} ${row.name} ${row.status} ${row.reference}`
        .toLowerCase()
        .includes(query),
    );
  }, [data.history, historyQuery]);
  const historyTable = useDeskTable({
    data: historyRows,
    columns: historyColumns,
    state: { sorting: historySorting },
    onSortingChange: setHistorySorting,
  });

  /* ── Dialog state ── */

  const currentMethod = methodByKey(data.methods, form.state.values.method);
  const currentTotals = bookingTotals(
    pool,
    form.state.values.slots,
    currentMethod,
    existing,
  );
  const currentShortfall = walletShortfall(
    currentMethod,
    currentTotals.amount,
    data.profile.wallet,
  );
  const wizard = modal ? wizardKinds.includes(modal.kind) : false;
  const canCancel =
    !!activeRecord &&
    (activeRecord.status === "awaiting_payment" ||
      activeRecord.status === "received");
  const nextOperatorStep =
    activeRecord && activeRecord.status === "awaiting_payment"
      ? "Mark payment received"
      : activeRecord && activeRecord.status === "received"
        ? "Mark payment verified"
        : activeRecord && activeRecord.status === "verified"
          ? "Confirm investment"
          : "";

  const modalBlock = (() => {
    if (!modal) return "";
    if (modal.kind === "support" && supportMessage.trim().length < 12)
      return "Add at least 12 characters so the desk can act on it";
    if (modal.kind === "cancel" && !canCancel)
      return "Only reservations awaiting or holding payment can be cancelled here";
    if (modal.kind === "topUp" && (topUpAmount < 100 || topUpAmount > 100000))
      return "Top-ups run from $100 to $100,000";
    if (
      modal.kind === "projection" &&
      (projectionSlots < 1 || projectionSlots > 25)
    )
      return "Choose between 1 and 25 slots";
    if (
      modal.kind === "referral" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referralEmail.trim())
    )
      return "Enter a valid email address";
    return "";
  })();

  const modalFooter = (
    <>
      {wizard && wizardStep === 2 ? (
        <label className="pb-check pb-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            aria-label="Acknowledge session-only preview"
          />
          I have reviewed this {titles[modal?.kind ?? "help"].toLowerCase()}{" "}
          preview and understand it records session state only — no payment, no
          escrow movement and no provider request is sent.
        </label>
      ) : null}
      <button
        type="button"
        className="pb-btn"
        disabled={busy}
        onClick={() => (wizardStep ? setWizardStep(wizardStep - 1) : close())}
      >
        {wizardStep ? "Back" : "Close"}
      </button>
      <span className="pb-foot-note">Session-only preview · no funds move</span>
      {wizard ? (
        <button
          type="button"
          className="pb-btn pb-btn--primary"
          disabled={
            busy ||
            (wizardStep < 2 && !!modalBlock) ||
            (wizardStep === 2 && !confirmed)
          }
          onClick={() => {
            if (wizardStep < 2) {
              setWizardStep(wizardStep + 1);
              return;
            }
            if (!modal) return;
            if (modal.kind === "support")
              void run(
                {
                  kind: "support",
                  topic: supportTopic,
                  message: supportMessage,
                },
                { title: "Support draft saved locally" },
              );
            if (modal.kind === "cancel") void confirmCancel();
            if (modal.kind === "topUp")
              void run(
                {
                  kind: "topUpWallet",
                  amount: topUpAmount,
                  method: topUpMethod,
                },
                { title: "Top-up drafted locally" },
              );
            if (modal.kind === "projection")
              void run(
                {
                  kind: "saveProjection",
                  slots: projectionSlots,
                  roiPct: projectionRoi,
                },
                { title: "Projection saved locally" },
              );
            if (modal.kind === "referral")
              void run(
                {
                  kind: "saveReferral",
                  email: referralEmail.trim(),
                  channel: referralChannel,
                },
                { title: "Invitation drafted locally" },
              );
            if (modal.kind === "risk")
              void run(
                { kind: "acknowledge", scope: "risk" },
                { title: "Risk disclosure acknowledged" },
              );
          }}
        >
          {busy
            ? "Working…"
            : wizardStep < 2
              ? "Continue →"
              : modal?.kind === "cancel"
                ? "Cancel reservation"
                : "Confirm local preview"}
        </button>
      ) : null}
    </>
  );

  /* ── Render ── */

  return (
    <InvestorShell
      rootClass="page-investor-pool-booking"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={data.profile.committed}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.profile.wallet}
      unread={data.profile.unread}
      activeNav={activeNav}
      detailHref={`/investor/pools/${pool.id}`}
      bookHref={`/investor/pools/${pool.id}/book`}
      quickActions={quickActions}
      onNavigate={(key) => {
        setActiveNav(key);
        if (key === "overview" || key === "pools" || key === "upcoming") {
          router.push(key === "overview" ? "/investor" : "/investor/pools");
          return;
        }
        if (key === "detail") {
          router.push(`/investor/pools/${pool.id}`);
          return;
        }
        if (key === "wallet") {
          router.push("/investor/wallet");
          return;
        }
        if (key === "calculator") {
          router.push("/investor/calculator");
          return;
        }
        if (key === "notifications") {
          router.push("/investor/notifications");
          return;
        }
        if (key === "settings") {
          router.push("/investor?action=profile");
          return;
        }
        if (key === "earnings") {
          router.push("/investor/earnings");
          return;
        }
        if (key === "activity" || key === "portfolio") {
          setDrawer("tracker");
          return;
        }
        scrollToStep(0);
      }}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(
          tab === "portfolio"
            ? "summary"
            : tab === "activity"
              ? "tracker"
              : "fees",
        )
      }
      onQuickAction={(key) => {
        if (key === "slots") jumpToStep(1);
        if (key === "method") jumpToStep(2);
        if (key === "summary") open("orderSummary");
        if (key === "receipt") open(activeRecord ? "receipt" : "orderSummary");
        if (key === "support") open("support");
        if (key === "pools") router.push("/investor/pools");
      }}
      onOpenNotifications={() => open("statusDetail")}
      onChromeReady={(next) => {
        chrome.current = next;
      }}
    >
      <form.Subscribe selector={(state) => state.values}>
        {(values) => {
          const method = methodByKey(data.methods, values.method);
          const totals = bookingTotals(pool, values.slots, method, existing);
          const shortfall = walletShortfall(
            method,
            totals.amount,
            data.profile.wallet,
          );
          const draft = {
            pool,
            methods: data.methods,
            slots: values.slots,
            method: values.method,
            details,
            terms: values.terms,
            wallet: data.profile.wallet,
            bookable: data.bookable,
            blockedReason: data.blockedReason,
            existing,
          };
          const draftMessage = bookingDraftError(draft);
          const unsold = Math.max(0, pool.slotsTotal - pool.slotsFilled);
          const fillPct = Math.min(
            100,
            (pool.raised / Math.max(pool.goal, 1)) * 100,
          );

          return (
            <>
              <div className="pb-page" id="pb-top">
                <header className="pb-head">
                  <div>
                    <nav className="pb-crumbs" aria-label="Breadcrumb">
                      <Link href="/investor">Investor workspace</Link>
                      <span aria-hidden="true">/</span>
                      <Link href="/investor/pools">Crowdfunding pools</Link>
                      <span aria-hidden="true">/</span>
                      <Link href={`/investor/pools/${pool.id}`}>
                        {pool.code}
                      </Link>
                      <span aria-hidden="true">/</span>
                      <span className="mono">Book</span>
                    </nav>
                    <div className="pb-eyebrow">
                      <span className="pb-code">
                        I-4 / BOOKING &amp; PAYMENT
                      </span>
                      <span
                        className={`pb-tag ${data.bookable ? "is-open" : `is-${pool.lifecycle}`}`}
                      >
                        <span className="live-dot" aria-hidden="true" />
                        {lifecycleLabel(pool.lifecycle)}
                      </span>
                      <span className="pb-risk">{pool.riskBand} risk</span>
                    </div>
                    <h1>Book slots · {pool.name}</h1>
                    <p>{pool.strategy}</p>
                    <div className="pb-meta">
                      <span>
                        <Icon name="package" size={12} /> {pool.code} ·{" "}
                        {money(pool.slotPrice)} per slot
                      </span>
                      <span>
                        <Icon name="users" size={12} /> {pool.investors}{" "}
                        participants
                      </span>
                      <span>
                        <Icon name="calendar" size={12} /> Snapshot{" "}
                        {atDateTime(data.asOf)}
                      </span>
                      <span
                        className={closesIn.urgent ? "is-urgent" : undefined}
                      >
                        <Icon name="clock" size={12} />{" "}
                        {data.bookable
                          ? `closes in ${closesIn.label}`
                          : `window closed · ${lifecycleLabel(pool.lifecycle).toLowerCase()}`}
                      </span>
                    </div>
                  </div>
                  <div className="pb-actions">
                    <Link
                      className="pb-btn"
                      href={`/investor/pools/${pool.id}`}
                    >
                      <Icon name="arrowLeft" size={14} /> Pool detail
                    </Link>
                    <button
                      type="button"
                      className="pb-btn"
                      onClick={() => open("paymentHelp")}
                    >
                      <Icon name="wallet" size={14} /> Payment rails
                    </button>
                    <button
                      type="button"
                      className="pb-btn"
                      onClick={() => open("terms")}
                    >
                      <Icon name="file" size={14} /> Terms
                    </button>
                    <Link
                      className="pb-btn pb-btn--primary"
                      href="/investor/pools"
                    >
                      <Icon name="pool" size={14} /> All pools
                    </Link>
                  </div>
                </header>

                <div className="pb-banner">
                  <div>
                    <b>FRONTEND BOOKING</b>
                    <span>
                      source snapshot {atDateTime(data.asOf)} · structured DTO ·
                      no payment capture, escrow movement or slot-confirmation
                      authority
                    </span>
                  </div>
                  <div className="pb-banner__actions">
                    <span className="pb-sync">
                      <span className="live-dot" aria-hidden="true" /> read{" "}
                      {refreshAge}s ago
                    </span>
                    <button
                      type="button"
                      className="pb-link"
                      onClick={() => void refresh()}
                    >
                      <Icon name="refresh" size={12} /> Refresh
                    </button>
                    <button
                      type="button"
                      className="pb-link"
                      onClick={() => open("help")}
                    >
                      Integration boundaries ↗
                    </button>
                  </div>
                </div>

                <nav className="pb-steps" aria-label="Booking steps">
                  <ol
                    style={
                      {
                        "--pb-step": `${(step / (pageSteps.length - 1)) * 100}%`,
                      } as CSSProperties
                    }
                  >
                    {pageSteps.map((entry, index) => {
                      const state =
                        index < step
                          ? "done"
                          : index === step
                            ? "current"
                            : "next";
                      return (
                        <li key={entry.key} className={`is-${state}`}>
                          <button
                            type="button"
                            onClick={() => jumpToStep(index)}
                            aria-current={index === step ? "step" : undefined}
                            disabled={index > 0 && index < 4 && !data.bookable}
                          >
                            <span className="pb-steps__num mono">
                              {index < step ? (
                                <Icon name="check" size={11} />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span className="pb-steps__text">
                              <b>{entry.label}</b>
                              <small>{entry.hint}</small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="pb-steps__bar">
                    <span
                      style={{
                        width: `${(step / (pageSteps.length - 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="pb-steps__note">
                    Step {step + 1} of {pageSteps.length} ·{" "}
                    {data.bookable
                      ? "nothing is charged until the funding desk verifies receipt"
                      : (data.blockedReason ??
                        "this window is not accepting bookings")}
                  </p>
                </nav>

                {/* 01 · Pool details */}
                <section
                  id="pb-details"
                  className={`pb-card pb-block${step === 0 ? " is-current" : ""}`}
                >
                  <SectionHead
                    code="01 / POOL DETAILS"
                    title="What you are booking into"
                    hint="Every figure is the same snapshot the pool register and pool detail page read."
                    aside={
                      <div className="pb-block-actions">
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("fees")}
                        >
                          Fees ↗
                        </button>
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("escrow")}
                        >
                          Escrow account ↗
                        </button>
                      </div>
                    }
                  />
                  <div className="pb-facts">
                    <Fact label="Pool" value={pool.code} hint={pool.name} />
                    <Fact
                      label="Status"
                      value={
                        <span
                          className={`pb-tag ${data.bookable ? "is-open" : `is-${pool.lifecycle}`}`}
                        >
                          {lifecycleLabel(pool.lifecycle)}
                        </span>
                      }
                      hint={
                        data.bookable
                          ? `${unsold} slot(s) unsold`
                          : "not accepting bookings"
                      }
                    />
                    <Fact
                      label="Closes in"
                      value={
                        <span
                          className={`pb-countdown${closesIn.urgent ? " is-urgent" : ""}`}
                        >
                          <Icon name="clock" size={12} /> {closesIn.label}
                        </span>
                      }
                      hint={`${atDateTime(pool.closesAt)}`}
                    />
                    <Fact
                      label="Min per slot"
                      value={money(pool.slotPrice)}
                      hint="one slot = one allocation unit"
                    />
                    <Fact
                      label="Max slots / user"
                      value={pool.maxSlotsPerUser}
                      hint={`${existing?.slots ?? 0} already booked`}
                    />
                    <Fact
                      label="Available to you"
                      value={available}
                      hint={`${unsold} unsold · ${Math.max(0, Math.floor((pool.goal - pool.raised) / Math.max(pool.slotPrice, 1)))} fundable`}
                    />
                    <Fact
                      label="Target capital"
                      value={money(pool.goal)}
                      hint={`${money(pool.raised)} raised · ${plainPercent(fillPct, 0)}`}
                    />
                    <Fact
                      label="Expected ROI"
                      value={`+${pool.expectedRoiPct}%`}
                      hint={`${pool.durationDays} days · ${pool.profitSharePct}% profit share`}
                    />
                  </div>

                  <div className="pb-progress-block">
                    <div>
                      <span>Funding progress</span>
                      <b className="mono">
                        {money(pool.raised)} / {money(pool.goal)}
                      </b>
                    </div>
                    <Progress
                      value={fillPct}
                      label={`${pool.code} funding progress`}
                    />
                    <small>
                      {money(Math.max(0, pool.goal - pool.raised))} remaining to
                      target · your reservations count towards this figure
                    </small>
                  </div>

                  <div className="pb-split">
                    <div className="pb-panel">
                      <header>
                        <b>Your current bookings</b>
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("history")}
                        >
                          History ↗
                        </button>
                      </header>
                      {existing ? (
                        <div className="pb-booking-card">
                          <div>
                            <span>VERIFIED IN THIS POOL</span>
                            <b className="mono">{slotLabel(existing.slots)}</b>
                            <small>{money(existing.amount)} committed</small>
                          </div>
                          <span
                            className={`pb-tag ${statusTone(
                              existing.payment === "verified"
                                ? "confirmed"
                                : "awaiting_payment",
                            )}`}
                          >
                            {titleCase(existing.payment)}
                          </span>
                          <dl className="pb-kv">
                            <div>
                              <dt>Rail</dt>
                              <dd>{existing.methodLabel}</dd>
                            </div>
                            <div>
                              <dt>Reference</dt>
                              <dd className="mono">
                                {existing.reference ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt>Booked</dt>
                              <dd className="mono">
                                {atDateTime(existing.bookedAt)}
                              </dd>
                            </div>
                          </dl>
                          <p>{existing.note}</p>
                        </div>
                      ) : (
                        <div className="pb-empty pb-empty--inline">
                          <Icon name="info" size={15} />
                          <div>
                            <b>No verified booking in this window yet</b>
                            <p>
                              {data.bookable
                                ? "Pick slots below and the reservation will appear here and in the tracker."
                                : "This window is not taking bookings, so nothing can be held against it."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pb-panel">
                      <header>
                        <b>Window calendar</b>
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("afterPayment")}
                        >
                          After payment ↗
                        </button>
                      </header>
                      <ol className="pb-windows">
                        <li>
                          <span
                            className="pb-windows__dot"
                            aria-hidden="true"
                          />
                          <div>
                            <b>Booking opens</b>
                            <span className="mono">
                              {atDateTime(pool.opensAt)}
                            </span>
                          </div>
                          <em>closed</em>
                        </li>
                        <li className={data.bookable ? "is-current" : ""}>
                          <span
                            className="pb-windows__dot"
                            aria-hidden="true"
                          />
                          <div>
                            <b>Booking closes</b>
                            <span className="mono">
                              {atDateTime(pool.closesAt)}
                            </span>
                          </div>
                          <em>{data.bookable ? closesIn.label : "passed"}</em>
                        </li>
                        <li>
                          <span
                            className="pb-windows__dot"
                            aria-hidden="true"
                          />
                          <div>
                            <b>Trading ends</b>
                            <span className="mono">
                              {atDateTime(pool.tradingEndsAt)}
                            </span>
                          </div>
                          <em>{pool.durationDays}d cycle</em>
                        </li>
                      </ol>
                      <div className="pb-inline-note">
                        <Icon name="shield" size={13} /> {pool.guardianNote} ·
                        settlement {pool.settlementBatch}.
                      </div>
                    </div>
                  </div>

                  <footer className="pb-block-foot">
                    <span className="pb-foot-note">
                      Source snapshot {atDateTime(data.asOf)} · figures update
                      when a reservation is held in this session.
                    </span>
                    <button
                      type="button"
                      className="pb-btn pb-btn--primary"
                      onClick={() => jumpToStep(1)}
                      disabled={!data.bookable}
                    >
                      Choose slots <Icon name="arrowRight" size={14} />
                    </button>
                  </footer>
                </section>

                {/* 02 · Select slots */}
                <section
                  id="pb-slots"
                  className={`pb-card pb-block${step === 1 ? " is-current" : ""}`}
                >
                  <SectionHead
                    code="02 / SELECT SLOTS"
                    title="How many slots do you want?"
                    hint="Each slot is one allocation unit. Totals recalculate as you change the quantity."
                    aside={
                      <div className="pb-block-actions">
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("saved")}
                        >
                          Saved accounts ↗
                        </button>
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("projection")}
                        >
                          Project return ↗
                        </button>
                      </div>
                    }
                  />

                  {!data.bookable ? (
                    <div className="pb-blocked">
                      <Icon name="lock" size={18} />
                      <div>
                        <b>{lifecycleLabel(pool.lifecycle)}</b>
                        <p>{data.blockedReason}</p>
                        <div className="pb-blocked__actions">
                          <Link
                            className="pb-btn"
                            href={`/investor/pools/${pool.id}`}
                          >
                            Pool detail <Icon name="arrowRight" size={13} />
                          </Link>
                          <Link className="pb-btn" href="/investor/pools">
                            Browse open pools{" "}
                            <Icon name="arrowRight" size={13} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="pb-slots-grid">
                    <div className="pb-picker">
                      <div className="pb-picker__control">
                        <button
                          type="button"
                          className="pb-picker__step"
                          onClick={() =>
                            form.setFieldValue(
                              "slots",
                              Math.max(1, values.slots - 1),
                            )
                          }
                          disabled={values.slots <= 1 || !data.bookable}
                          aria-label="Remove one slot"
                        >
                          <Icon name="minus" size={16} />
                        </button>
                        <div className="pb-picker__value">
                          <span>Number of slots</span>
                          <b className="mono">{values.slots}</b>
                          <small>
                            max {available} · {money(pool.slotPrice)} per slot
                          </small>
                        </div>
                        <button
                          type="button"
                          className="pb-picker__step"
                          onClick={() =>
                            form.setFieldValue(
                              "slots",
                              Math.min(available, values.slots + 1),
                            )
                          }
                          disabled={values.slots >= available || !data.bookable}
                          aria-label="Add one slot"
                        >
                          <Icon name="plus" size={16} />
                        </button>
                      </div>
                      <div
                        className="pb-chips"
                        role="group"
                        aria-label="Quick slot counts"
                      >
                        {Array.from(
                          new Set(
                            [1, 2, 3, 5, available]
                              .filter(
                                (value) => value > 0 && value <= available,
                              )
                              .concat(available > 0 ? [available] : []),
                          ),
                        )
                          .sort((a, b) => a - b)
                          .map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={values.slots === value ? "is-on" : ""}
                              onClick={() => form.setFieldValue("slots", value)}
                              disabled={!data.bookable}
                            >
                              {value === available ? `Max ${value}` : value}
                            </button>
                          ))}
                      </div>
                      <div className="pb-picker__meta">
                        <span>
                          <Icon name="info" size={12} /> {unsold} slots unsold ·{" "}
                          {existing?.slots ?? 0} already yours
                        </span>
                        <span>
                          <Icon name="users" size={12} /> {pool.investors}{" "}
                          participants
                        </span>
                      </div>
                    </div>

                    <div className="pb-totals">
                      <div className="pb-totals__head">
                        <span>LIVE ALLOCATION</span>
                        <span className="mono">{pool.code}</span>
                      </div>
                      <div className="pb-totals__row">
                        <span>
                          {slotLabel(values.slots)} × {money(pool.slotPrice)}
                        </span>
                        <b className="mono">{money(totals.amount)}</b>
                      </div>
                      <div className="pb-totals__row">
                        <span>Token allocation</span>
                        <b className="mono">
                          {totals.tokens.toLocaleString()} {pool.tokenSymbol}
                        </b>
                      </div>
                      <div className="pb-totals__row">
                        <span>Your share of pool</span>
                        <b className="mono">
                          {plainPercent(totals.sharePct, 2)}
                        </b>
                      </div>
                      <div className="pb-totals__row">
                        <span>{method.label} fee</span>
                        <b className="mono">{money(totals.fee, 2)}</b>
                      </div>
                      <div className="pb-totals__row is-total">
                        <span>Total due</span>
                        <b className="mono">{money(totals.total, 2)}</b>
                      </div>
                      <p className="pb-totals__note">
                        Share = {money(totals.amount)} ÷ ({money(pool.raised)}{" "}
                        raised + {money(totals.amount)})
                      </p>
                      <button
                        type="button"
                        className="pb-btn pb-btn--primary pb-btn--wide"
                        onClick={() => jumpToStep(2)}
                        disabled={!data.bookable || available === 0}
                      >
                        Continue to payment <Icon name="arrowRight" size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="pb-split pb-split--three">
                    <div className="pb-panel">
                      <header>
                        <b>Current bookings</b>
                      </header>
                      <div className="pb-mini-stat">
                        <b className="mono">{existing?.slots ?? 0}</b>
                        <span>slots held</span>
                        <small>{money(existing?.amount ?? 0)} committed</small>
                      </div>
                    </div>
                    <div className="pb-panel">
                      <header>
                        <b>After this booking</b>
                      </header>
                      <div className="pb-mini-stat">
                        <b className="mono">{totals.combinedSlots}</b>
                        <span>slots combined</span>
                        <small>{money(totals.combinedAmount)} committed</small>
                      </div>
                    </div>
                    <div className="pb-panel">
                      <header>
                        <b>Window headroom</b>
                      </header>
                      <div className="pb-mini-stat">
                        <b className="mono">
                          {Math.max(0, available - values.slots)}
                        </b>
                        <span>slots left for you</span>
                        <small>
                          {money(
                            Math.max(
                              0,
                              pool.maxSlotsPerUser * pool.slotPrice -
                                totals.combinedAmount,
                            ),
                          )}{" "}
                          to your limit
                        </small>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 03 · Payment method */}
                <section
                  id="pb-method"
                  className={`pb-card pb-block${step === 2 ? " is-current" : ""}`}
                >
                  <SectionHead
                    code="03 / PAYMENT METHOD"
                    title="How will you fund this booking?"
                    hint="Five rails, each with its own settlement window and fee. The form below only collects what the chosen rail needs."
                    aside={
                      <div className="pb-block-actions">
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("paymentHelp")}
                        >
                          Rails &amp; limits ↗
                        </button>
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("saved")}
                        >
                          Saved accounts ↗
                        </button>
                      </div>
                    }
                  />

                  <div
                    className="pb-methods"
                    role="radiogroup"
                    aria-label="Payment method"
                  >
                    {data.methods.map((item, index) => {
                      const selected = item.key === values.method;
                      const coverable =
                        item.key === "wallet"
                          ? walletShortfall(
                              item,
                              totals.amount,
                              data.profile.wallet,
                            ) === 0
                          : true;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`pb-method${selected ? " is-on" : ""}${coverable ? "" : " is-short"}`}
                          style={
                            { "--pb-delay": `${index * 45}ms` } as CSSProperties
                          }
                          onClick={() => form.setFieldValue("method", item.key)}
                          disabled={!data.bookable}
                        >
                          <span className="pb-method__top">
                            <span className="pb-method__icon">
                              <Icon name={item.icon as IconName} size={16} />
                            </span>
                            <span className="pb-method__label">
                              <b>{item.label}</b>
                              <small>{item.tagline}</small>
                            </span>
                            <span
                              className="pb-method__radio"
                              aria-hidden="true"
                            />
                          </span>
                          <span className="pb-method__meta">
                            <span>
                              <Icon name="clock" size={11} /> {item.speed}
                            </span>
                            <span className="mono">{item.feeLabel}</span>
                          </span>
                          <span className="pb-method__status">
                            {item.key === "wallet"
                              ? `Balance ${money(data.profile.wallet)} · ${
                                  coverable
                                    ? "covers this order"
                                    : `short ${money(
                                        walletShortfall(
                                          item,
                                          totals.amount,
                                          data.profile.wallet,
                                        ),
                                        2,
                                      )}`
                                }`
                              : item.limits}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pb-method-panel">
                    <header>
                      <div>
                        <span className="pb-section-code">SELECTED RAIL</span>
                        <h3>
                          <Icon name={method.icon as IconName} size={15} />{" "}
                          {method.label}
                        </h3>
                        <p>{method.note}</p>
                      </div>
                      <span className="pb-method-panel__fee mono">
                        {method.feeLabel} · {money(totals.fee, 2)}
                      </span>
                    </header>

                    {method.key === "wallet" ? (
                      <div className="pb-wallet">
                        <div className="pb-wallet__row">
                          <div>
                            <span>WALLET BALANCE</span>
                            <b className="mono">
                              {money(data.profile.wallet, 2)}
                            </b>
                          </div>
                          <div>
                            <span>ORDER TOTAL</span>
                            <b className="mono">{money(totals.total, 2)}</b>
                          </div>
                          <div>
                            <span>
                              {shortfall > 0 ? "SHORTFALL" : "AFTER PAYMENT"}
                            </span>
                            <b
                              className={`mono${shortfall > 0 ? " text-loss" : ""}`}
                            >
                              {shortfall > 0
                                ? money(shortfall, 2)
                                : money(data.profile.wallet - totals.total, 2)}
                            </b>
                          </div>
                        </div>
                        <div className="pb-inline-note">
                          <Icon name="info" size={13} /> The wallet rail needs
                          the full order covered before booking. Top-ups are
                          drafted locally on this page and never credit a
                          balance.
                        </div>
                        <div className="pb-block-actions">
                          <button
                            type="button"
                            className="pb-btn"
                            onClick={() => open("topUp")}
                          >
                            <Icon name="plus" size={14} /> Top up wallet
                          </button>
                          <Link className="pb-btn" href="/investor/wallet">
                            Wallet &amp; payouts{" "}
                            <Icon name="external" size={12} />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="pb-form-grid">
                          {method.fields.map((field) => {
                            const value = details[field.name] ?? "";
                            const fieldError = touchedFields[field.name]
                              ? paymentFieldError(field, value)
                              : "";
                            if (field.kind === "check")
                              return (
                                <label
                                  className="pb-check pb-field-check"
                                  key={field.name}
                                >
                                  <input
                                    type="checkbox"
                                    checked={value === "yes"}
                                    onChange={(e) => {
                                      setDetail(
                                        field.name,
                                        e.target.checked ? "yes" : "",
                                      );
                                      setTouchedFields((prev) => ({
                                        ...prev,
                                        [field.name]: true,
                                      }));
                                    }}
                                    disabled={!data.bookable}
                                  />
                                  <span>{field.label}</span>
                                </label>
                              );
                            return (
                              <label className="pb-field" key={field.name}>
                                {field.label}
                                {field.kind === "select" ? (
                                  <select
                                    className="form-select"
                                    value={value}
                                    onChange={(e) => {
                                      setDetail(field.name, e.target.value);
                                      setTouchedFields((prev) => ({
                                        ...prev,
                                        [field.name]: true,
                                      }));
                                    }}
                                    disabled={!data.bookable}
                                  >
                                    {(field.options ?? []).map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    className={`form-control${fieldError ? " is-invalid" : ""}`}
                                    type={field.kind === "tel" ? "tel" : "text"}
                                    inputMode={
                                      field.kind === "tel" ||
                                      field.name === "accountNumber" ||
                                      field.name === "routingNumber" ||
                                      field.name === "cardNumber" ||
                                      field.name === "cvc" ||
                                      field.name === "zip"
                                        ? "numeric"
                                        : undefined
                                    }
                                    autoComplete={field.autoComplete}
                                    maxLength={field.maxLength}
                                    placeholder={field.placeholder}
                                    value={value}
                                    onChange={(e) =>
                                      setDetail(field.name, e.target.value)
                                    }
                                    onBlur={() =>
                                      setTouchedFields((prev) => ({
                                        ...prev,
                                        [field.name]: true,
                                      }))
                                    }
                                    disabled={!data.bookable}
                                  />
                                )}
                                <small className={fieldError ? "is-error" : ""}>
                                  {fieldError || field.hint || ""}
                                </small>
                              </label>
                            );
                          })}
                        </div>
                        <div className="pb-block-actions pb-form-actions">
                          <button
                            type="button"
                            className="pb-link"
                            onClick={() => open("saved")}
                          >
                            Use a saved account ↗
                          </button>
                          {method.key === "bank_transfer" ? (
                            <button
                              type="button"
                              className="pb-link"
                              onClick={() => open("escrow")}
                            >
                              Escrow coordinates ↗
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="pb-link"
                            onClick={() => open("kyc")}
                          >
                            Funds source declaration ↗
                          </button>
                        </div>
                      </>
                    )}

                    <footer className="pb-block-foot">
                      <span className="pb-foot-note">
                        {method.instructions[0]}
                      </span>
                      <button
                        type="button"
                        className="pb-btn pb-btn--primary"
                        onClick={() => jumpToStep(3)}
                        disabled={!data.bookable}
                      >
                        Review order <Icon name="arrowRight" size={14} />
                      </button>
                    </footer>
                  </div>
                </section>

                {/* 04 · Review & confirm */}
                <section
                  id="pb-review"
                  className={`pb-card pb-block${step === 3 ? " is-current" : ""}`}
                >
                  <SectionHead
                    code="04 / REVIEW & CONFIRM"
                    title="Check the order before it is held"
                    hint="Confirming creates a local reservation with a 72-hour payment window. No card is charged and no escrow transfer starts."
                    aside={
                      <div className="pb-block-actions">
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("orderSummary")}
                        >
                          Full summary ↗
                        </button>
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("afterPayment")}
                        >
                          What happens next ↗
                        </button>
                      </div>
                    }
                  />

                  <form
                    id="pb-review-form"
                    className="pb-review"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void form.handleSubmit();
                    }}
                  >
                    <div className="pb-review__left">
                      <div className="pb-panel">
                        <header>
                          <b>Order summary</b>
                          <span className="mono">{pool.code}</span>
                        </header>
                        <dl className="pb-kv pb-kv--rows">
                          <div>
                            <dt>Slots</dt>
                            <dd className="mono">{values.slots}</dd>
                          </div>
                          <div>
                            <dt>Investment</dt>
                            <dd className="mono">
                              {slotLabel(values.slots)} ×{" "}
                              {money(pool.slotPrice)} = {money(totals.amount)}
                            </dd>
                          </div>
                          <div>
                            <dt>Token allocation</dt>
                            <dd className="mono">
                              {values.slots} ×{" "}
                              {pool.tokensPerSlot.toLocaleString()} ={" "}
                              {totals.tokens.toLocaleString()}{" "}
                              {pool.tokenSymbol}
                            </dd>
                          </div>
                          <div>
                            <dt>Payment method</dt>
                            <dd>{method.label}</dd>
                          </div>
                          <div>
                            <dt>Fee</dt>
                            <dd className="mono">
                              {money(totals.fee, 2)}{" "}
                              <small>{method.feeLabel}</small>
                            </dd>
                          </div>
                          <div className="is-total">
                            <dt>Total due</dt>
                            <dd className="mono">{money(totals.total, 2)}</dd>
                          </div>
                        </dl>
                        <div className="pb-block-actions">
                          <button
                            type="button"
                            className="pb-link"
                            onClick={() => jumpToStep(1)}
                          >
                            Edit slots ↗
                          </button>
                          <button
                            type="button"
                            className="pb-link"
                            onClick={() => jumpToStep(2)}
                          >
                            Change rail ↗
                          </button>
                        </div>
                      </div>

                      <div className="pb-panel">
                        <header>
                          <b>
                            {method.key === "bank_transfer"
                              ? "Escrow transfer instructions"
                              : `${method.label} instructions`}
                          </b>
                          <button
                            type="button"
                            className="pb-link"
                            onClick={() => open("escrow")}
                          >
                            Copy details ↗
                          </button>
                        </header>
                        {method.key === "bank_transfer" ? (
                          <dl className="pb-kv pb-kv--rows">
                            <div>
                              <dt>Beneficiary</dt>
                              <dd className="mono">{data.escrow.bankName}</dd>
                            </div>
                            <div>
                              <dt>Account name</dt>
                              <dd className="mono">
                                {data.escrow.accountName}
                              </dd>
                            </div>
                            <div>
                              <dt>Account number</dt>
                              <dd className="mono">
                                {data.escrow.accountNumber}
                              </dd>
                            </div>
                            <div>
                              <dt>Routing</dt>
                              <dd className="mono">
                                {data.escrow.routingNumber}
                              </dd>
                            </div>
                            <div>
                              <dt>SWIFT</dt>
                              <dd className="mono">{data.escrow.swift}</dd>
                            </div>
                            <div>
                              <dt>Reference</dt>
                              <dd className="mono">
                                {activeRecord?.reference ??
                                  "generated when you confirm"}
                              </dd>
                            </div>
                            <div className="is-total">
                              <dt>Amount</dt>
                              <dd className="mono">{money(totals.total, 2)}</dd>
                            </div>
                          </dl>
                        ) : (
                          <ol className="pb-steps-list">
                            {method.instructions.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ol>
                        )}
                        <div className="pb-inline-note">
                          <Icon name="clock" size={13} /> Slots stay reserved
                          for {data.escrow.windowHours} hours. The desk verifies
                          receipt in {data.escrow.verifyLabel}.
                        </div>
                      </div>
                    </div>

                    <div className="pb-review__right">
                      <div className="pb-panel">
                        <header>
                          <b>Terms &amp; declarations</b>
                          <button
                            type="button"
                            className="pb-link"
                            onClick={() => open("lockup")}
                          >
                            Lock-up ↗
                          </button>
                        </header>
                        {data.terms.map((term) => (
                          <form.Field key={term.id} name={`terms.${term.id}`}>
                            {(field) => (
                              <label className="pb-terms">
                                <input
                                  type="checkbox"
                                  checked={field.state.value}
                                  onChange={(e) =>
                                    field.handleChange(e.target.checked)
                                  }
                                  disabled={!data.bookable}
                                />
                                <span>
                                  <b>{term.label}</b>
                                  <small>{term.detail}</small>
                                </span>
                              </label>
                            )}
                          </form.Field>
                        ))}
                        <div className="pb-block-actions">
                          <button
                            type="button"
                            className="pb-link"
                            onClick={() => open("terms")}
                          >
                            Read pool terms ↗
                          </button>
                          <button
                            type="button"
                            className="pb-link"
                            onClick={() => open("risk")}
                          >
                            Risk disclosure ↗
                          </button>
                        </div>
                      </div>

                      {error ? (
                        <p className="pb-error" role="alert">
                          {error}
                        </p>
                      ) : draftMessage ? (
                        <p className="pb-hint-block">
                          <Icon name="info" size={13} /> {draftMessage}
                        </p>
                      ) : (
                        <p className="pb-hint-block is-ok">
                          <Icon name="check" size={13} /> Ready to hold{" "}
                          {slotLabel(values.slots)} · {money(totals.total, 2)}{" "}
                          total.
                        </p>
                      )}

                      <button
                        type="submit"
                        className="pb-btn pb-btn--primary pb-btn--wide"
                        disabled={busy || !data.bookable || !!draftMessage}
                      >
                        {busy ? (
                          "Holding…"
                        ) : (
                          <>
                            <Icon name="lock" size={14} /> Confirm booking ·{" "}
                            {money(totals.total, 2)}
                          </>
                        )}
                      </button>
                      <span className="pb-foot-note">
                        Creates a reservation only · nothing is charged
                      </span>
                    </div>
                  </form>
                </section>

                {/* 05 · Payment status */}
                <section
                  id="pb-status"
                  className={`pb-card pb-block${step === 4 ? " is-current" : ""}`}
                >
                  <SectionHead
                    code="05 / PAYMENT STATUS"
                    title={
                      activeRecord
                        ? `Reservation ${activeRecord.id}`
                        : "Payment tracker"
                    }
                    hint="Created → instructions → received → verified → confirmed. Each stage is timestamped against this session's snapshot."
                    aside={
                      <div className="pb-block-actions">
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("statusDetail")}
                        >
                          Timeline detail ↗
                        </button>
                        <button
                          type="button"
                          className="pb-link"
                          onClick={() => open("reservation")}
                        >
                          Hold policy ↗
                        </button>
                      </div>
                    }
                  />

                  {activeRecord ? (
                    <div className="pb-status">
                      <div className="pb-status__main">
                        <div className="pb-status__head">
                          <div>
                            <span
                              className={`pb-tag ${statusTone(activeRecord.status)}`}
                            >
                              {statusLabels[activeRecord.status]}
                            </span>
                            <b className="mono">{activeRecord.reference}</b>
                            <small>
                              {slotLabel(activeRecord.slots)} ·{" "}
                              {money(activeRecord.amount)} ·{" "}
                              {activeRecord.methodLabel}
                            </small>
                          </div>
                          <div className="pb-status__actions">
                            {nextOperatorStep ? (
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => void advancePayment()}
                                disabled={busy}
                              >
                                <Icon name="refresh" size={13} />{" "}
                                {nextOperatorStep}
                              </button>
                            ) : null}
                            {canCancel ? (
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => open("cancel")}
                              >
                                <Icon name="close" size={13} /> Cancel
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("receipt")}
                            >
                              <Icon name="file" size={13} /> Receipt
                            </button>
                          </div>
                        </div>

                        <Tracker rows={stages} />

                        <div className="pb-inline-note">
                          <Icon name="info" size={13} /> “Operator” steps are
                          simulated in this browser session so the tracker can
                          be exercised end to end. A production booking polls{" "}
                          <code>GET /api/investments/{"{id}"}/status</code>{" "}
                          every 30 seconds instead.
                        </div>
                      </div>

                      <aside className="pb-status__side">
                        <div
                          className={`pb-reservation${
                            reservation.total > 0 &&
                            reservation.total < 24 * 3600
                              ? " is-urgent"
                              : ""
                          }`}
                        >
                          <span
                            className="pb-reservation__icon"
                            aria-hidden="true"
                          >
                            <Icon name="clock" size={15} />
                          </span>
                          <div>
                            <b>Reservation window</b>
                            <span className="mono">
                              {activeRecord.status === "confirmed"
                                ? "closed · confirmed"
                                : activeRecord.status === "cancelled"
                                  ? "released"
                                  : `${reservation.label} left`}
                            </span>
                            <small>
                              Payment must clear by{" "}
                              {atDateTime(activeRecord.reservationExpiresAt)}
                            </small>
                          </div>
                        </div>

                        <dl className="pb-kv pb-kv--rows">
                          <div>
                            <dt>Booking ID</dt>
                            <dd className="mono">{activeRecord.id}</dd>
                          </div>
                          <div>
                            <dt>Receipt</dt>
                            <dd className="mono">{activeRecord.receiptNo}</dd>
                          </div>
                          <div>
                            <dt>Investment</dt>
                            <dd className="mono">
                              {money(activeRecord.amount, 2)}
                            </dd>
                          </div>
                          <div>
                            <dt>Fee</dt>
                            <dd className="mono">
                              {money(activeRecord.fee, 2)}
                            </dd>
                          </div>
                          <div>
                            <dt>Total</dt>
                            <dd className="mono">
                              {money(activeRecord.total, 2)}
                            </dd>
                          </div>
                          <div>
                            <dt>Created</dt>
                            <dd className="mono">
                              {atDateTime(activeRecord.createdAt)}
                            </dd>
                          </div>
                        </dl>

                        <div className="pb-block-actions pb-block-actions--stack">
                          <button
                            type="button"
                            className="pb-btn"
                            onClick={() =>
                              void copy(
                                activeRecord.reference,
                                "Booking reference",
                              )
                            }
                          >
                            <Icon name="copy" size={13} /> Copy reference
                          </button>
                          <button
                            type="button"
                            className="pb-btn"
                            onClick={() => {
                              setExportFormat("pdf");
                              open("receipt");
                            }}
                          >
                            <Icon name="download" size={13} /> Download receipt
                          </button>
                          <Link
                            className="pb-btn"
                            href={`/investor/pools/${pool.id}`}
                          >
                            <Icon name="package" size={13} /> Pool detail
                          </Link>
                          <Link className="pb-btn" href="/investor/pools">
                            <Icon name="pool" size={13} /> Back to pools
                          </Link>
                        </div>
                      </aside>
                    </div>
                  ) : (
                    <div className="pb-empty">
                      <Icon name="file" size={20} />
                      <div>
                        <b>No reservation on this pool yet</b>
                        <p>
                          {data.bookable
                            ? "Confirm a booking in step 4 and the five-stage tracker fills in here with a 72-hour payment window."
                            : (data.blockedReason ??
                              "This window is not accepting bookings.")}
                        </p>
                        <div className="pb-block-actions">
                          {data.bookable ? (
                            <button
                              type="button"
                              className="pb-btn pb-btn--primary"
                              onClick={() => jumpToStep(1)}
                            >
                              Choose slots <Icon name="arrowRight" size={13} />
                            </button>
                          ) : (
                            <Link
                              className="pb-btn"
                              href={`/investor/pools/${pool.id}`}
                            >
                              Pool detail <Icon name="arrowRight" size={13} />
                            </Link>
                          )}
                          <button
                            type="button"
                            className="pb-btn"
                            onClick={() => open("history")}
                          >
                            Booking history
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <footer className="pb-foot">
                  <div className="pb-foot__links">
                    <Link href={`/investor/pools/${pool.id}`}>Pool detail</Link>
                    <Link href="/investor/pools">Pool register</Link>
                    <Link href="/investor/wallet">Wallet &amp; payouts</Link>
                    <Link href="/investor/calculator">Return calculator</Link>
                    <Link href="/investor/notifications">Notifications</Link>
                    <Link href="/dashboard">Operator console</Link>
                  </div>
                  <div className="pb-foot__audit">
                    <span className="pb-section-code">LOCAL COMMANDS</span>
                    {data.audit.length ? (
                      <ul>
                        {data.audit.slice(0, 4).map((entry) => (
                          <li key={entry.id}>
                            <span className="mono">{atTime(entry.at)}</span>
                            <b>{titleCase(entry.action)}</b>
                            <p>{entry.detail}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        Nothing recorded yet. Slot holds, acknowledgements,
                        projections, exports and cancellations appear here.
                      </p>
                    )}
                  </div>
                  <p className="pb-foot__meta">
                    Revision r{data.revision} · snapshot {atDateTime(data.asOf)}{" "}
                    · all figures derive from one structured booking context DTO
                  </p>
                </footer>
                {drawer ? (
                  <div
                    className="op-drawer-backdrop pb-drawer-layer"
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) close();
                    }}
                  >
                    <aside
                      className="op-drawer"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Booking inspector"
                    >
                      <div className="op-drawer__head">
                        <div>
                          <span className="pb-section-code">
                            I-4 / BOOKING INSPECTOR
                          </span>
                          <h2 className="op-drawer__title">{pool.name}</h2>
                          <p className="pb-muted">
                            {pool.code} · {lifecycleLabel(pool.lifecycle)} ·{" "}
                            {slotLabel(form.state.values.slots)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="desk-icon-btn"
                          onClick={close}
                          aria-label="Close booking inspector"
                        >
                          <Icon name="close" size={17} />
                        </button>
                      </div>
                      <div
                        className="pb-drawer-tabs"
                        role="tablist"
                        aria-label="Inspector views"
                      >
                        {(["summary", "tracker", "fees"] as const).map(
                          (tab) => (
                            <button
                              type="button"
                              key={tab}
                              role="tab"
                              aria-selected={drawer === tab}
                              className={drawer === tab ? "is-active" : ""}
                              onClick={() => setDrawer(tab)}
                            >
                              {tab === "summary"
                                ? "Summary"
                                : tab === "tracker"
                                  ? "Tracker"
                                  : "Fees"}
                            </button>
                          ),
                        )}
                      </div>
                      <div className="op-drawer__body">
                        {drawer === "summary" ? (
                          <>
                            <div className="pb-drawer-summary">
                              <div>
                                <span>SLOTS</span>
                                <b className="mono">
                                  {form.state.values.slots}
                                </b>
                              </div>
                              <div>
                                <span>INVESTMENT</span>
                                <b className="mono">
                                  {money(currentTotals.amount)}
                                </b>
                              </div>
                              <div>
                                <span>TOTAL</span>
                                <b className="mono">
                                  {money(currentTotals.total, 2)}
                                </b>
                              </div>
                            </div>
                            <dl className="pb-kv pb-kv--rows">
                              <div>
                                <dt>Pool</dt>
                                <dd>
                                  {pool.code} · {pool.name}
                                </dd>
                              </div>
                              <div>
                                <dt>Rail</dt>
                                <dd>{currentMethod.label}</dd>
                              </div>
                              <div>
                                <dt>Fee</dt>
                                <dd className="mono">
                                  {money(currentTotals.fee, 2)}
                                </dd>
                              </div>
                              <div>
                                <dt>Tokens</dt>
                                <dd className="mono">
                                  {currentTotals.tokens.toLocaleString()}{" "}
                                  {pool.tokenSymbol}
                                </dd>
                              </div>
                              <div>
                                <dt>Reference</dt>
                                <dd className="mono">
                                  {activeRecord?.reference ??
                                    "generated on confirm"}
                                </dd>
                              </div>
                            </dl>
                            <div className="pb-drawer-actions">
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => {
                                  close();
                                  jumpToStep(1);
                                }}
                              >
                                Edit slots
                              </button>
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => open("orderSummary")}
                              >
                                Order summary
                              </button>
                            </div>
                          </>
                        ) : drawer === "tracker" ? (
                          <>
                            <div className="pb-drawer-headline">
                              <span
                                className={`pb-tag ${statusTone(activeRecord?.status ?? "awaiting_payment")}`}
                              >
                                {activeRecord
                                  ? statusLabels[activeRecord.status]
                                  : "No reservation"}
                              </span>
                              <b className="mono">
                                {activeRecord?.reference ?? "—"}
                              </b>
                            </div>
                            <Tracker rows={stages} />
                            <div className="pb-inline-note">
                              <Icon name="clock" size={13} />{" "}
                              {activeRecord
                                ? `Reservation window ${reservation.label} left · clears ${atDateTime(activeRecord.reservationExpiresAt)}`
                                : "A 72-hour payment window starts when you confirm a booking."}
                            </div>
                            <div className="pb-drawer-actions">
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => open("reservation")}
                              >
                                Hold policy
                              </button>
                              {activeRecord ? (
                                <button
                                  type="button"
                                  className="pb-btn"
                                  onClick={() => open("receipt")}
                                >
                                  Receipt
                                </button>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="pb-drawer-headline">
                              <span className="mono">
                                {slotLabel(form.state.values.slots)} ·{" "}
                                {money(currentTotals.amount)}
                              </span>
                              <span className="mono">
                                {money(currentTotals.fee, 2)} fee
                              </span>
                            </div>
                            <ul className="pb-drawer-fees">
                              {feeTableRows(
                                data.methods,
                                currentTotals.amount,
                                data.profile.wallet,
                              ).map((row) => (
                                <li
                                  key={row.key}
                                  className={
                                    row.available ? undefined : "is-off"
                                  }
                                >
                                  <div>
                                    <b>{row.label}</b>
                                    <small>{row.speed}</small>
                                  </div>
                                  <div>
                                    <span className="mono">{row.feeLabel}</span>
                                    <small className="mono">
                                      {money(row.total, 2)} due
                                    </small>
                                  </div>
                                </li>
                              ))}
                            </ul>
                            <div className="pb-drawer-actions">
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => open("fees")}
                              >
                                Fee breakdown
                              </button>
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => open("paymentHelp")}
                              >
                                Rails &amp; limits
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </aside>
                  </div>
                ) : null}

                {modal ? (
                  <div className="pb-modal-layer">
                    <DeskModalShell
                      code="I-4"
                      eyebrow="INVESTOR WORKSPACE / LOCAL PREVIEW"
                      title={titles[modal.kind]}
                      subtitle="Structured session state. Payment capture, escrow movement, provider verification and slot confirmation require authenticated backend integration."
                      size={modalSize[modal.kind] ?? "md"}
                      onClose={close}
                      steps={wizard ? [...steps] : undefined}
                      currentStep={wizardStep}
                      footer={modalFooter}
                    >
                      {error ? (
                        <p className="pb-error" role="alert">
                          {error}
                        </p>
                      ) : null}

                      {modal.kind === "terms" ? (
                        <>
                          <p className="pb-note">
                            {pool.code} · {pool.name} — {pool.strategy}. Terms
                            are fixed for the funding window and cannot be
                            renegotiated after a slot confirms.
                          </p>
                          <ol className="pb-steps-list">
                            <li>
                              <b>Capital deployment.</b> Committed capital funds
                              the strategy from {atDate(pool.opensAt)} and
                              trades until {atDate(pool.tradingEndsAt)} (
                              {pool.durationDays} days).
                            </li>
                            <li>
                              <b>Profit share.</b> {pool.profitSharePct}% of net
                              pool profit is credited to investors pro-rata by
                              committed capital; the platform retains the
                              remainder.
                            </li>
                            <li>
                              <b>Guardian policy.</b> {pool.guardianNote}.
                              Guardian action can pause sizing but never returns
                              capital early.
                            </li>
                            <li>
                              <b>Settlement.</b> {pool.settlementBatch}.
                              Withdrawals are drafted after the profit-share
                              batch and verified by the funding desk.
                            </li>
                            <li>
                              <b>Payment.</b> Slots hold for{" "}
                              {data.escrow.windowHours} hours after booking.
                              Unverified reservations release capacity
                              automatically.
                            </li>
                            <li>
                              <b>Early exit.</b> Capital is locked for the full
                              cycle; an exit request carries a 10% penalty on
                              committed capital and needs desk approval.
                            </li>
                          </ol>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("risk")}
                            >
                              Risk disclosure
                            </button>
                            <button
                              type="button"
                              className="pb-btn pb-btn--primary"
                              onClick={() =>
                                void run(
                                  { kind: "acknowledge", scope: "terms" },
                                  { title: "Pool terms acknowledged" },
                                )
                              }
                              disabled={busy}
                            >
                              Acknowledge terms
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "lockup" ? (
                        <>
                          <dl className="pb-kv pb-kv--rows">
                            <div>
                              <dt>Lock starts</dt>
                              <dd className="mono">
                                {atDateTime(pool.opensAt)}
                              </dd>
                            </div>
                            <div>
                              <dt>Lock ends</dt>
                              <dd className="mono">
                                {atDateTime(pool.tradingEndsAt)}
                              </dd>
                            </div>
                            <div>
                              <dt>Duration</dt>
                              <dd className="mono">{pool.durationDays} days</dd>
                            </div>
                            <div>
                              <dt>Early-exit penalty</dt>
                              <dd className="mono">10% of committed capital</dd>
                            </div>
                            <div className="is-total">
                              <dt>Penalty at your order</dt>
                              <dd className="mono">
                                {money(
                                  bookingAmount(pool, form.state.values.slots) *
                                    0.1,
                                  2,
                                )}
                              </dd>
                            </div>
                          </dl>
                          <div className="pb-inline-note">
                            <Icon name="lock" size={13} /> Exits are
                            desk-reviewed and settle at the next daily batch.
                            Capacity released mid-cycle is not resold.
                          </div>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("risk")}
                            >
                              Risk disclosure
                            </button>
                            <button
                              type="button"
                              className="pb-btn pb-btn--primary"
                              onClick={() =>
                                void run(
                                  { kind: "acknowledge", scope: "lockup" },
                                  { title: "Lock-up acknowledged" },
                                )
                              }
                              disabled={busy}
                            >
                              Acknowledge lock-up
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "risk" && wizard ? (
                        wizardStep === 0 ? (
                          <>
                            <dl className="pb-kv pb-kv--rows">
                              <div>
                                <dt>Pool</dt>
                                <dd>
                                  {pool.code} · {pool.name}
                                </dd>
                              </div>
                              <div>
                                <dt>Risk band</dt>
                                <dd>{pool.riskBand}</dd>
                              </div>
                              <div>
                                <dt>Expected ROI</dt>
                                <dd className="mono">
                                  +{pool.expectedRoiPct}%
                                </dd>
                              </div>
                              <div>
                                <dt>Cycle</dt>
                                <dd className="mono">
                                  {pool.durationDays} days
                                </dd>
                              </div>
                            </dl>
                            <p className="pb-note">{pool.riskNote}</p>
                            <div className="pb-inline-note">
                              <Icon name="shield" size={13} /> Guardian bands
                              protect the pool, not an individual order: capital
                              can still be lost inside the band.
                            </div>
                          </>
                        ) : wizardStep === 1 ? (
                          <>
                            <table className="table pb-table">
                              <thead>
                                <tr>
                                  <th>Scenario</th>
                                  <th>Pool return</th>
                                  <th>
                                    Your{" "}
                                    {money(
                                      bookingAmount(
                                        pool,
                                        form.state.values.slots,
                                      ),
                                    )}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>Target case</td>
                                  <td className="mono">
                                    +{pool.expectedRoiPct}%
                                  </td>
                                  <td className="mono text-win">
                                    +
                                    {money(
                                      (bookingAmount(
                                        pool,
                                        form.state.values.slots,
                                      ) *
                                        pool.expectedRoiPct) /
                                        100,
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <td>Half target</td>
                                  <td className="mono">
                                    +{pool.expectedRoiPct / 2}%
                                  </td>
                                  <td className="mono text-win">
                                    +
                                    {money(
                                      (bookingAmount(
                                        pool,
                                        form.state.values.slots,
                                      ) *
                                        pool.expectedRoiPct) /
                                        200,
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <td>Guardian stop</td>
                                  <td className="mono">−5%</td>
                                  <td className="mono text-loss">
                                    −
                                    {money(
                                      bookingAmount(
                                        pool,
                                        form.state.values.slots,
                                      ) * 0.05,
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <td>Capital loss</td>
                                  <td className="mono">−100%</td>
                                  <td className="mono text-loss">
                                    −
                                    {money(
                                      bookingAmount(
                                        pool,
                                        form.state.values.slots,
                                      ),
                                    )}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            <p className="pb-note">
                              Expectation, not a guarantee. Synthetic indices
                              can gap through a stop, so the loss case is shown
                              explicitly.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="pb-review-final">
                              <Icon name="alert" size={16} />
                              <p>
                                I understand {pool.code} carries{" "}
                                {pool.riskBand.toLowerCase()} risk, that capital
                                is locked for {pool.durationDays} days, and that
                                the loss case is the entire committed amount.
                                This acknowledgement is stored in the local
                                workspace.
                              </p>
                            </div>
                            <div className="pb-block-actions">
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => open("terms")}
                              >
                                Read pool terms
                              </button>
                            </div>
                          </>
                        )
                      ) : null}

                      {modal.kind === "fees" ? (
                        <>
                          <p className="pb-note">
                            Fee is charged on top of the investment and is
                            calculated from the rail, not from the pool. Totals
                            use {slotLabel(form.state.values.slots)} (
                            {money(currentTotals.amount)}).
                          </p>
                          <div className="table-responsive">
                            <table className="table pb-table">
                              <thead>
                                <tr>
                                  <th>Rail</th>
                                  <th>Speed</th>
                                  <th>Fee rule</th>
                                  <th>Fee</th>
                                  <th>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {feeTableRows(
                                  data.methods,
                                  currentTotals.amount,
                                  data.profile.wallet,
                                ).map((row) => (
                                  <tr
                                    key={row.key}
                                    className={
                                      row.available ? undefined : "is-off"
                                    }
                                  >
                                    <td>
                                      <b>{row.label}</b>
                                      {row.available ? null : (
                                        <small> · needs top-up</small>
                                      )}
                                    </td>
                                    <td>{row.speed}</td>
                                    <td className="mono">{row.feeLabel}</td>
                                    <td className="mono">
                                      {money(row.fee, 2)}
                                    </td>
                                    <td className="mono">
                                      {money(row.total, 2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="pb-inline-note">
                            <Icon name="info" size={13} /> tradeMO charges no
                            booking fee. Rail fees are pass-through and shown
                            before you confirm.
                          </div>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-link"
                              onClick={() => open("paymentHelp")}
                            >
                              Rails &amp; limits ↗
                            </button>
                            <button
                              type="button"
                              className="pb-link"
                              onClick={() => open("orderSummary")}
                            >
                              Order summary ↗
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "reservation" ? (
                        <>
                          <p className="pb-note">
                            Confirming a booking holds capacity for{" "}
                            {data.escrow.windowHours} hours while the transfer
                            clears. The hold is visible in the pool register and
                            releases itself if the desk cannot match a payment.
                          </p>
                          <ol className="pb-steps-list">
                            <li>
                              <b>Capacity held.</b> Slots leave the unsold count
                              the moment the reservation is created.
                            </li>
                            <li>
                              <b>Reference matched.</b> The desk reconciles your
                              transfer against the booking reference, not the
                              sender name.
                            </li>
                            <li>
                              <b>Auto-release.</b> Unmatched reservations return
                              capacity after {data.escrow.windowHours} hours;
                              nothing is charged.
                            </li>
                            <li>
                              <b>Cancellation.</b> You can cancel free of charge
                              until the desk verifies receipt.
                            </li>
                          </ol>
                          <dl className="pb-kv pb-kv--rows">
                            <div>
                              <dt>Window</dt>
                              <dd className="mono">
                                {data.escrow.windowHours} hours
                              </dd>
                            </div>
                            <div>
                              <dt>Verification</dt>
                              <dd className="mono">
                                {data.escrow.verifyLabel}
                              </dd>
                            </div>
                            <div>
                              <dt>Your reservation</dt>
                              <dd className="mono">
                                {activeRecord
                                  ? `${activeRecord.id} · ${reservation.label} left`
                                  : "none yet"}
                              </dd>
                            </div>
                          </dl>
                          {canCancel ? (
                            <div className="pb-block-actions">
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => open("cancel")}
                              >
                                Cancel reservation
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {modal.kind === "paymentHelp" ? (
                        <>
                          <p className="pb-note">
                            Settlement, limits and required fields per rail.
                            Values are the desk's published rules for this
                            window.
                          </p>
                          <div className="table-responsive">
                            <table className="table pb-table">
                              <thead>
                                <tr>
                                  <th>Rail</th>
                                  <th>Speed</th>
                                  <th>Fee</th>
                                  <th>Limits</th>
                                  <th>Fields</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.methods.map((item) => (
                                  <tr key={item.key}>
                                    <td>
                                      <b>{item.label}</b>
                                      <small> · {item.tagline}</small>
                                    </td>
                                    <td>{item.speed}</td>
                                    <td className="mono">{item.feeLabel}</td>
                                    <td>{item.limits}</td>
                                    <td className="mono">
                                      {item.fields.length
                                        ? `${item.fields.length} required`
                                        : "none"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="pb-inline-note">
                            <Icon name="lock" size={13} /> Card fields are
                            tokenised by the payment provider in the browser;
                            tradeMO never stores a PAN.
                          </div>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-link"
                              onClick={() => open("saved")}
                            >
                              Saved accounts ↗
                            </button>
                            <button
                              type="button"
                              className="pb-link"
                              onClick={() => open("escrow")}
                            >
                              Escrow coordinates ↗
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "escrow" ? (
                        <>
                          <dl className="pb-kv pb-kv--rows">
                            <div>
                              <dt>Beneficiary</dt>
                              <dd className="mono">{data.escrow.bankName}</dd>
                            </div>
                            <div>
                              <dt>Account name</dt>
                              <dd className="mono">
                                {data.escrow.accountName}
                              </dd>
                            </div>
                            <div>
                              <dt>Account number</dt>
                              <dd className="mono">
                                <button
                                  type="button"
                                  className="pb-link mono"
                                  onClick={() =>
                                    void copy(
                                      data.escrow.accountNumber,
                                      "Account number",
                                    )
                                  }
                                >
                                  {data.escrow.accountNumber}{" "}
                                  <Icon name="copy" size={11} />
                                </button>
                              </dd>
                            </div>
                            <div>
                              <dt>Routing</dt>
                              <dd className="mono">
                                {data.escrow.routingNumber}
                              </dd>
                            </div>
                            <div>
                              <dt>SWIFT</dt>
                              <dd className="mono">{data.escrow.swift}</dd>
                            </div>
                            <div>
                              <dt>Reference</dt>
                              <dd className="mono">
                                {activeRecord?.reference ??
                                  "generated when you confirm"}
                              </dd>
                            </div>
                            <div className="is-total">
                              <dt>Amount due</dt>
                              <dd className="mono">
                                {money(currentTotals.total, 2)}
                              </dd>
                            </div>
                          </dl>
                          <p className="pb-note">{data.escrow.note}</p>
                          <div className="pb-field-row">
                            <label className="pb-field">
                              Format
                              <select
                                className="form-select"
                                value={exportFormat}
                                onChange={(e) =>
                                  setExportFormat(
                                    e.target.value as "pdf" | "csv" | "json",
                                  )
                                }
                              >
                                <option value="pdf">PDF</option>
                                <option value="csv">CSV</option>
                                <option value="json">JSON</option>
                              </select>
                            </label>
                          </div>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-btn"
                              disabled={busy}
                              onClick={() =>
                                void exportRows(
                                  "payment-instructions",
                                  instructionsRows(),
                                  `${pool.code}-payment-instructions`,
                                  "Payment instructions",
                                )
                              }
                            >
                              <Icon name="download" size={13} /> Download
                              instructions
                            </button>
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() =>
                                void copy(
                                  [
                                    data.escrow.bankName,
                                    `Account ${data.escrow.accountNumber}`,
                                    `Routing ${data.escrow.routingNumber}`,
                                    activeRecord?.reference ?? "",
                                  ]
                                    .filter(Boolean)
                                    .join(" · "),
                                  "Escrow details",
                                )
                              }
                            >
                              <Icon name="copy" size={13} /> Copy all
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "kyc" ? (
                        <>
                          <dl className="pb-kv pb-kv--rows">
                            <div>
                              <dt>Investor</dt>
                              <dd>
                                {data.profile.displayName} · {data.profile.id}
                              </dd>
                            </div>
                            <div>
                              <dt>Verification</dt>
                              <dd className="mono">{data.profile.kycLevel}</dd>
                            </div>
                            <div>
                              <dt>Declared funds source</dt>
                              <dd>{data.profile.fundsSource}</dd>
                            </div>
                            <div>
                              <dt>Declared on</dt>
                              <dd className="mono">
                                {atDateTime(data.profile.fundsDeclaredAt)}
                              </dd>
                            </div>
                            <div>
                              <dt>Country</dt>
                              <dd>{data.profile.country}</dd>
                            </div>
                            <div>
                              <dt>Tier</dt>
                              <dd>{data.profile.tier}</dd>
                            </div>
                          </dl>
                          <p className="pb-note">
                            This booking is funded from the declared source. A
                            different source needs a fresh declaration before
                            the desk can verify the transfer — otherwise the
                            reservation is returned.
                          </p>
                          <div className="pb-block-actions">
                            <Link
                              className="pb-btn"
                              href="/investor?action=profile"
                            >
                              Update in settings{" "}
                              <Icon name="external" size={12} />
                            </Link>
                            <button
                              type="button"
                              className="pb-btn pb-btn--primary"
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  { kind: "acknowledge", scope: "terms" },
                                  { title: "Funds source confirmed locally" },
                                )
                              }
                            >
                              Confirm funds source
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "orderSummary" ? (
                        <>
                          <p className="pb-note">
                            A reader-friendly copy of the order currently in the
                            review step. Downloading files it locally and logs
                            an export command.
                          </p>
                          <dl className="pb-kv pb-kv--rows">
                            {summaryRows().map((row) => (
                              <div key={row.field}>
                                <dt>{row.field}</dt>
                                <dd className="mono">{row.value}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="pb-field-row">
                            <label className="pb-field">
                              Format
                              <select
                                className="form-select"
                                value={exportFormat}
                                onChange={(e) =>
                                  setExportFormat(
                                    e.target.value as "pdf" | "csv" | "json",
                                  )
                                }
                              >
                                <option value="pdf">PDF</option>
                                <option value="csv">CSV</option>
                                <option value="json">JSON</option>
                              </select>
                            </label>
                          </div>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-btn pb-btn--primary"
                              disabled={busy}
                              onClick={() =>
                                void exportRows(
                                  "order-summary",
                                  summaryRows(),
                                  `${pool.code}-order-summary`,
                                  "Booking order summary",
                                )
                              }
                            >
                              <Icon name="download" size={13} /> Download
                              summary
                            </button>
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => {
                                close();
                                jumpToStep(3);
                              }}
                            >
                              Back to review
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "afterPayment" ? (
                        <>
                          <p className="pb-note">
                            What the desk does after you transfer, and when
                            capital starts working.
                          </p>
                          <ol className="pb-timeline">
                            <li>
                              <span className="mono">+0h</span>
                              <div>
                                <b>Reservation created</b>
                                <p>
                                  Capacity holds, reference issued, instructions
                                  displayed.
                                </p>
                              </div>
                            </li>
                            <li>
                              <span className="mono">
                                +{data.escrow.verifyLabel}
                              </span>
                              <div>
                                <b>Receipt verified</b>
                                <p>
                                  The desk matches your reference against the
                                  escrow statement and marks the booking
                                  received.
                                </p>
                              </div>
                            </li>
                            <li>
                              <span className="mono">+30m</span>
                              <div>
                                <b>Slot confirmed</b>
                                <p>
                                  Investment locks; the booking appears on the
                                  pool detail page and in the register.
                                </p>
                              </div>
                            </li>
                            <li>
                              <span className="mono">
                                {atDate(pool.opensAt)} →{" "}
                                {atDate(pool.tradingEndsAt)}
                              </span>
                              <div>
                                <b>Trading window</b>
                                <p>
                                  {pool.durationDays} days of{" "}
                                  {pool.strategy.toLowerCase()}.
                                </p>
                              </div>
                            </li>
                            <li>
                              <span className="mono">
                                {pool.settlementBatch}
                              </span>
                              <div>
                                <b>Profit share</b>
                                <p>
                                  {pool.profitSharePct}% of net profit credited
                                  pro-rata; withdrawal drafts unlock after the
                                  batch.
                                </p>
                              </div>
                            </li>
                          </ol>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => {
                                close();
                                jumpToStep(4);
                              }}
                            >
                              Open tracker
                            </button>
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("terms")}
                            >
                              Pool terms
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "support" && wizard ? (
                        wizardStep === 0 ? (
                          <>
                            <label className="pb-field">
                              Topic
                              <select
                                className="form-select"
                                value={supportTopic}
                                onChange={(e) =>
                                  setSupportTopic(
                                    e.target.value as typeof supportTopic,
                                  )
                                }
                              >
                                <option value="payment">
                                  Payment not showing
                                </option>
                                <option value="escrow">
                                  Escrow / wire question
                                </option>
                                <option value="booking">
                                  Booking or slot question
                                </option>
                                <option value="kyc">
                                  KYC &amp; funds source
                                </option>
                                <option value="other">Something else</option>
                              </select>
                            </label>
                            <label className="pb-field">
                              Message
                              <textarea
                                className="form-control"
                                rows={4}
                                maxLength={1000}
                                value={supportMessage}
                                placeholder={`Tell the desk what happened with ${pool.code}…`}
                                onChange={(e) =>
                                  setSupportMessage(e.target.value)
                                }
                              />
                              <small>
                                {supportMessage.trim().length}/1000 · at least
                                12 characters
                              </small>
                            </label>
                            <div className="pb-inline-note">
                              <Icon name="info" size={13} /> Drafts stay in this
                              browser session. Nothing is emailed or ticketed.
                            </div>
                          </>
                        ) : wizardStep === 1 ? (
                          <>
                            <dl className="pb-kv pb-kv--rows">
                              <div>
                                <dt>Topic</dt>
                                <dd>{titleCase(supportTopic)}</dd>
                              </div>
                              <div>
                                <dt>Pool</dt>
                                <dd>
                                  {pool.code} · {pool.name}
                                </dd>
                              </div>
                              <div>
                                <dt>Reservation</dt>
                                <dd className="mono">
                                  {activeRecord?.id ?? "none"}
                                </dd>
                              </div>
                            </dl>
                            <p className="pb-quote">{supportMessage.trim()}</p>
                          </>
                        ) : (
                          <div className="pb-review-final">
                            <Icon name="info" size={16} />
                            <p>
                              This saves the message as a local draft. To
                              actually reach the funding desk, email
                              support@trademo.example with the booking
                              reference.
                            </p>
                          </div>
                        )
                      ) : null}

                      {modal.kind === "cancel" && wizard ? (
                        wizardStep === 0 ? (
                          <>
                            <label className="pb-field">
                              Reason
                              <select
                                className="form-select"
                                value={cancelReason}
                                onChange={(e) =>
                                  setCancelReason(
                                    e.target.value as CancelReason,
                                  )
                                }
                              >
                                <option value="changed_plan">
                                  Plan changed
                                </option>
                                <option value="wrong_method">
                                  Wrong payment method
                                </option>
                                <option value="duplicate">
                                  Duplicate booking
                                </option>
                                <option value="other">Other</option>
                              </select>
                            </label>
                            <dl className="pb-kv pb-kv--rows">
                              <div>
                                <dt>Reservation</dt>
                                <dd className="mono">
                                  {activeRecord?.id ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt>Slots released</dt>
                                <dd className="mono">
                                  {activeRecord?.slots ?? 0}
                                </dd>
                              </div>
                              <div>
                                <dt>Amount released</dt>
                                <dd className="mono">
                                  {money(activeRecord?.amount ?? 0)}
                                </dd>
                              </div>
                              <div>
                                <dt>Fee</dt>
                                <dd className="mono">no cancellation fee</dd>
                              </div>
                            </dl>
                            <div className="pb-inline-note">
                              <Icon name="alert" size={13} /> Cancelling returns
                              capacity to the pool immediately. Verified
                              bookings cannot be cancelled here.
                            </div>
                          </>
                        ) : wizardStep === 1 ? (
                          <>
                            <p className="pb-note">
                              This is the last review step. The reservation is
                              marked cancelled in this session and its slots
                              become available to other investors again.
                            </p>
                            <dl className="pb-kv pb-kv--rows">
                              <div>
                                <dt>Reason</dt>
                                <dd>{cancelReasonLabel(cancelReason)}</dd>
                              </div>
                              <div>
                                <dt>Reference voided</dt>
                                <dd className="mono">
                                  {activeRecord?.reference ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt>Payment window</dt>
                                <dd className="mono">
                                  {activeRecord
                                    ? atDateTime(
                                        activeRecord.reservationExpiresAt,
                                      )
                                    : "—"}
                                </dd>
                              </div>
                            </dl>
                            <div className="pb-inline-note">
                              <Icon name="info" size={13} /> If you already sent
                              the transfer, contact the desk first — an
                              unmatched transfer is returned to the sender bank.
                            </div>
                          </>
                        ) : (
                          <div className="pb-review-final">
                            <Icon name="alert" size={16} />
                            <p>
                              Confirming cancels{" "}
                              {activeRecord?.id ?? "the reservation"} and
                              releases {slotLabel(activeRecord?.slots ?? 0)}{" "}
                              back to {pool.code}. No money moves and no
                              provider is contacted.
                            </p>
                          </div>
                        )
                      ) : null}

                      {modal.kind === "saved" ? (
                        <>
                          <p className="pb-note">
                            Instruments saved for this investor. Choosing one
                            prefills the rail and its fields; nothing is charged
                            automatically.
                          </p>
                          <ul className="pb-saved">
                            {data.savedMethods.map((item) => (
                              <li key={item.id}>
                                <span className="pb-saved__icon">
                                  <Icon
                                    name={
                                      item.kind === "card" ? "layers" : "vault"
                                    }
                                    size={15}
                                  />
                                </span>
                                <div>
                                  <b>
                                    {item.label}
                                    {item.primary ? <em>primary</em> : null}
                                  </b>
                                  <small>{item.detail}</small>
                                  <small>{item.holder}</small>
                                </div>
                                <button
                                  type="button"
                                  className="pb-btn"
                                  onClick={() => useSaved(item.id)}
                                  disabled={!data.bookable}
                                >
                                  Use
                                </button>
                              </li>
                            ))}
                          </ul>
                          <div className="pb-block-actions">
                            <Link className="pb-btn" href="/investor/wallet">
                              Manage in wallet{" "}
                              <Icon name="external" size={12} />
                            </Link>
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("paymentHelp")}
                            >
                              Rails &amp; limits
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "topUp" && wizard ? (
                        wizardStep === 0 ? (
                          <>
                            <div className="pb-inline-note">
                              <Icon name="info" size={13} /> Wallet balance{" "}
                              {money(data.profile.wallet, 2)} · order total{" "}
                              {money(currentTotals.total, 2)} · shortfall{" "}
                              {money(
                                Math.max(
                                  0,
                                  currentTotals.total - data.profile.wallet,
                                ),
                                2,
                              )}
                            </div>
                            <label className="pb-field">
                              Top-up amount
                              <input
                                className="form-control mono"
                                type="number"
                                min={100}
                                max={100000}
                                step={100}
                                value={topUpAmount}
                                onChange={(e) =>
                                  setTopUpAmount(Number(e.target.value))
                                }
                              />
                              <small>
                                $100 – $100,000 · credited after desk
                                verification
                              </small>
                            </label>
                            <div className="pb-chips">
                              {[1000, 2500, 5000, 10000, 25000].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={
                                    topUpAmount === value ? "is-on" : ""
                                  }
                                  onClick={() => setTopUpAmount(value)}
                                >
                                  {money(value)}
                                </button>
                              ))}
                            </div>
                            <label className="pb-field">
                              Funding rail
                              <select
                                className="form-select"
                                value={topUpMethod}
                                onChange={(e) =>
                                  setTopUpMethod(
                                    e.target.value as "bank_transfer" | "card",
                                  )
                                }
                              >
                                <option value="bank_transfer">
                                  Bank transfer · free
                                </option>
                                <option value="card">
                                  Card · 2.9% + $0.30
                                </option>
                              </select>
                            </label>
                          </>
                        ) : wizardStep === 1 ? (
                          <>
                            <dl className="pb-kv pb-kv--rows">
                              <div>
                                <dt>Amount</dt>
                                <dd className="mono">
                                  {money(topUpAmount, 2)}
                                </dd>
                              </div>
                              <div>
                                <dt>Rail</dt>
                                <dd>
                                  {topUpMethod === "card"
                                    ? "Card · 2.9% + $0.30"
                                    : "Bank transfer · free"}
                                </dd>
                              </div>
                              <div>
                                <dt>Balance after</dt>
                                <dd className="mono">
                                  {money(data.profile.wallet + topUpAmount, 2)}
                                </dd>
                              </div>
                              <div>
                                <dt>Order covered?</dt>
                                <dd>
                                  {data.profile.wallet + topUpAmount >=
                                  currentTotals.total
                                    ? "yes — wallet rail becomes available"
                                    : "no — still short"}
                                </dd>
                              </div>
                            </dl>
                            <p className="pb-note">
                              A top-up draft is stored locally; the balance does
                              not change in this preview, so the wallet card
                              keeps showing the real snapshot balance.
                            </p>
                          </>
                        ) : (
                          <div className="pb-review-final">
                            <Icon name="info" size={16} />
                            <p>
                              This drafts a {money(topUpAmount, 2)} top-up over{" "}
                              {topUpMethod === "card"
                                ? "card"
                                : "bank transfer"}
                              . Nothing is captured and no balance is credited.
                            </p>
                          </div>
                        )
                      ) : null}

                      {modal.kind === "projection" && wizard ? (
                        wizardStep === 0 ? (
                          <>
                            <label className="pb-field">
                              Slots
                              <input
                                className="form-control mono"
                                type="number"
                                min={1}
                                max={25}
                                value={projectionSlots}
                                onChange={(e) =>
                                  setProjectionSlots(Number(e.target.value))
                                }
                              />
                              <small>
                                {money(pool.slotPrice)} per slot ·{" "}
                                {pool.durationDays} day cycle
                              </small>
                            </label>
                            <label className="pb-field">
                              Assumed ROI
                              <input
                                className="form-control mono"
                                type="number"
                                min={1}
                                max={50}
                                step={0.5}
                                value={projectionRoi}
                                onChange={(e) =>
                                  setProjectionRoi(Number(e.target.value))
                                }
                              />
                              <small>
                                Pool target is +{pool.expectedRoiPct}% · not a
                                promise
                              </small>
                            </label>
                            <div className="pb-review">
                              <div className="pb-panel">
                                <header>
                                  <b>Principal</b>
                                </header>
                                <b className="mono pb-big">
                                  {money(projectionSlots * pool.slotPrice)}
                                </b>
                              </div>
                              <div className="pb-panel">
                                <header>
                                  <b>Projected profit</b>
                                </header>
                                <b className="mono pb-big">
                                  {money(
                                    (projectionSlots *
                                      pool.slotPrice *
                                      projectionRoi) /
                                      100,
                                  )}
                                </b>
                              </div>
                            </div>
                          </>
                        ) : wizardStep === 1 ? (
                          <>
                            <table className="table pb-table">
                              <thead>
                                <tr>
                                  <th>Line</th>
                                  <th>Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>Slots</td>
                                  <td className="mono">{projectionSlots}</td>
                                </tr>
                                <tr>
                                  <td>Principal</td>
                                  <td className="mono">
                                    {money(projectionSlots * pool.slotPrice)}
                                  </td>
                                </tr>
                                <tr>
                                  <td>Assumed ROI</td>
                                  <td className="mono">{projectionRoi}%</td>
                                </tr>
                                <tr>
                                  <td>Cycle</td>
                                  <td className="mono">
                                    {pool.durationDays} days
                                  </td>
                                </tr>
                                <tr>
                                  <td>Profit share to investor</td>
                                  <td className="mono">
                                    {money(
                                      (projectionSlots *
                                        pool.slotPrice *
                                        projectionRoi) /
                                        100,
                                      2,
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <td>Daily average</td>
                                  <td className="mono">
                                    {money(
                                      (projectionSlots *
                                        pool.slotPrice *
                                        projectionRoi) /
                                        100 /
                                        pool.durationDays,
                                      2,
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <td>Total at end</td>
                                  <td className="mono">
                                    {money(
                                      projectionSlots * pool.slotPrice +
                                        (projectionSlots *
                                          pool.slotPrice *
                                          projectionRoi) /
                                          100,
                                      2,
                                    )}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            <p className="pb-note">
                              Expectations only. Guarded sizing can reduce
                              exposure and therefore realised profit.
                            </p>
                          </>
                        ) : (
                          <div className="pb-review-final">
                            <Icon name="info" size={16} />
                            <p>
                              Saving stores this scenario in the local workspace
                              for comparison. It is not a forecast, an offer or
                              a commitment.
                            </p>
                          </div>
                        )
                      ) : null}

                      {modal.kind === "referral" && wizard ? (
                        wizardStep === 0 ? (
                          <>
                            <label className="pb-field">
                              Investor email
                              <input
                                className="form-control"
                                type="email"
                                placeholder="name@example.com"
                                value={referralEmail}
                                onChange={(e) =>
                                  setReferralEmail(e.target.value)
                                }
                              />
                              <small>Drafts only — nothing is emailed</small>
                            </label>
                            <label className="pb-field">
                              Channel
                              <select
                                className="form-select"
                                value={referralChannel}
                                onChange={(e) =>
                                  setReferralChannel(
                                    e.target.value as "email" | "link",
                                  )
                                }
                              >
                                <option value="email">Email draft</option>
                                <option value="link">Share link</option>
                              </select>
                            </label>
                            <div className="pb-inline-note">
                              <Icon name="users" size={13} /> Fee credit applies
                              to the inviter only after the invitee&apos;s
                              booking is verified.
                            </div>
                          </>
                        ) : wizardStep === 1 ? (
                          <>
                            <dl className="pb-kv pb-kv--rows">
                              <div>
                                <dt>Invitee</dt>
                                <dd className="mono">{referralEmail.trim()}</dd>
                              </div>
                              <div>
                                <dt>Channel</dt>
                                <dd>
                                  {referralChannel === "email"
                                    ? "Email draft"
                                    : "Share link"}
                                </dd>
                              </div>
                              <div>
                                <dt>Pool</dt>
                                <dd>
                                  {pool.code} · {pool.name}
                                </dd>
                              </div>
                            </dl>
                            <label className="pb-field">
                              Share link
                              <input
                                className="form-control mono"
                                readOnly
                                value={
                                  typeof window === "undefined"
                                    ? `/investor/pools/${pool.id}/book`
                                    : `${window.location.origin}/investor/pools/${pool.id}/book`
                                }
                                onFocus={(e) => e.currentTarget.select()}
                              />
                            </label>
                          </>
                        ) : (
                          <div className="pb-review-final">
                            <Icon name="info" size={16} />
                            <p>
                              The invitation is stored locally for review. No
                              email is sent and no referral credit is created.
                            </p>
                          </div>
                        )
                      ) : null}

                      {modal.kind === "history" ? (
                        <>
                          <div className="pb-history-bar">
                            <label className="pb-field">
                              Search
                              <input
                                className="form-control"
                                placeholder="Pool, status or reference…"
                                value={historyQuery}
                                onChange={(e) =>
                                  setHistoryQuery(e.target.value)
                                }
                              />
                            </label>
                            <label className="pb-field">
                              Format
                              <select
                                className="form-select"
                                value={exportFormat}
                                onChange={(e) =>
                                  setExportFormat(
                                    e.target.value as "pdf" | "csv" | "json",
                                  )
                                }
                              >
                                <option value="pdf">PDF</option>
                                <option value="csv">CSV</option>
                                <option value="json">JSON</option>
                              </select>
                            </label>
                            <button
                              type="button"
                              className="pb-btn"
                              disabled={busy || !historyRows.length}
                              onClick={() =>
                                void exportRows(
                                  "history",
                                  historyRows.map((row) => ({
                                    pool: row.code,
                                    name: row.name,
                                    slots: row.slots,
                                    amount: row.amount,
                                    rail: row.methodLabel,
                                    status: row.status,
                                    created: row.createdAt,
                                    reference: row.reference,
                                  })),
                                  `${pool.code}-booking-history`,
                                  "Booking history",
                                )
                              }
                            >
                              <Icon name="download" size={13} /> Export
                            </button>
                          </div>
                          <div className="table-responsive pb-table-wrap">
                            <table className="table pb-table">
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
                                          <historyTable.FlexRender
                                            header={header}
                                          />
                                          {header.column.getIsSorted() === "asc"
                                            ? " ↑"
                                            : header.column.getIsSorted() ===
                                                "desc"
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
                                  <tr key={row.id}>
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
                            <p className="pb-empty-line">
                              No bookings match “{historyQuery}”.
                            </p>
                          )}
                          <p className="pb-foot-note">
                            {historyRows.length} row(s) · current pool plus
                            settled and trading cycles from the pool book
                          </p>
                        </>
                      ) : null}

                      {modal.kind === "receipt" ? (
                        activeRecord ? (
                          <>
                            <dl className="pb-kv pb-kv--rows">
                              {receiptRows(activeRecord).map((row) => (
                                <div key={row.field}>
                                  <dt>{row.field}</dt>
                                  <dd className="mono">{row.value}</dd>
                                </div>
                              ))}
                            </dl>
                            <div className="pb-field-row">
                              <label className="pb-field">
                                Format
                                <select
                                  className="form-select"
                                  value={exportFormat}
                                  onChange={(e) =>
                                    setExportFormat(
                                      e.target.value as "pdf" | "csv" | "json",
                                    )
                                  }
                                >
                                  <option value="pdf">PDF</option>
                                  <option value="csv">CSV</option>
                                  <option value="json">JSON</option>
                                </select>
                              </label>
                            </div>
                            <div className="pb-block-actions">
                              <button
                                type="button"
                                className="pb-btn pb-btn--primary"
                                disabled={busy}
                                onClick={() =>
                                  void exportRows(
                                    "receipt",
                                    receiptRows(activeRecord),
                                    `${activeRecord.receiptNo}`,
                                    "Booking receipt",
                                  )
                                }
                              >
                                <Icon name="download" size={13} /> Download
                                receipt
                              </button>
                              <button
                                type="button"
                                className="pb-btn"
                                onClick={() => open("statusDetail")}
                              >
                                Full timeline
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="pb-empty">
                            <Icon name="file" size={18} />
                            <div>
                              <b>No reservation to receipt yet</b>
                              <p>
                                Confirm a booking and a receipt number,
                                reference and timeline are generated on this
                                page.
                              </p>
                              <button
                                type="button"
                                className="pb-btn pb-btn--primary"
                                onClick={() => {
                                  close();
                                  jumpToStep(1);
                                }}
                                disabled={!data.bookable}
                              >
                                Choose slots
                              </button>
                            </div>
                          </div>
                        )
                      ) : null}

                      {modal.kind === "share" ? (
                        <>
                          <p className="pb-note">
                            Share the booking page — the recipient sees the same
                            snapshot, not your payment details.
                          </p>
                          <label className="pb-field">
                            Booking link
                            <input
                              className="form-control mono"
                              readOnly
                              value={
                                typeof window === "undefined"
                                  ? `/investor/pools/${pool.id}/book`
                                  : `${window.location.origin}/investor/pools/${pool.id}/book`
                              }
                              onFocus={(e) => e.currentTarget.select()}
                            />
                          </label>
                          <label className="pb-field">
                            Reference
                            <input
                              className="form-control mono"
                              readOnly
                              value={
                                activeRecord?.reference ??
                                "generated on confirm"
                              }
                              onFocus={(e) => e.currentTarget.select()}
                            />
                          </label>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() =>
                                void copy(
                                  typeof window === "undefined"
                                    ? `/investor/pools/${pool.id}/book`
                                    : `${window.location.origin}/investor/pools/${pool.id}/book`,
                                  "Booking link",
                                )
                              }
                            >
                              <Icon name="link" size={13} /> Copy link
                            </button>
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("referral")}
                            >
                              Invite an investor
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "help" ? (
                        <>
                          <p className="pb-note">
                            This booking page is a front-end preview on
                            committed structured data. It is complete on
                            purpose: every total, instruction and tracker row
                            comes from one booking context DTO.
                          </p>
                          <ul className="pb-list">
                            <li>
                              <b>Source snapshot</b> — pool window, slot limits,
                              target capital, escrow coordinates, rails and
                              terms. Read-only here.
                            </li>
                            <li>
                              <b>Local commands</b> — slot holds, cancellations,
                              simulated operator steps, acknowledgements,
                              projections, referrals, support drafts and
                              exports. Stored in the session and listed in the
                              footer ledger.
                            </li>
                            <li>
                              <b>Not connected</b> — payment capture (
                              <code>POST /api/investments</code>), escrow
                              reconciliation, provider settlement, KYC
                              re-declaration and email delivery.
                            </li>
                            <li>
                              <b>Data shape</b> —{" "}
                              <code>GET /api/investor/pools/{"{id}"}/book</code>{" "}
                              returns the same DTO with a <code>section</code>{" "}
                              filter.
                            </li>
                          </ul>
                          <dl className="pb-kv pb-kv--rows">
                            <div>
                              <dt>Snapshot</dt>
                              <dd className="mono">{atDateTime(data.asOf)}</dd>
                            </div>
                            <div>
                              <dt>Revision</dt>
                              <dd className="mono">r{data.revision}</dd>
                            </div>
                            <div>
                              <dt>Local commands</dt>
                              <dd className="mono">{data.audit.length}</dd>
                            </div>
                            <div>
                              <dt>Reservations</dt>
                              <dd className="mono">{data.records.length}</dd>
                            </div>
                          </dl>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("history")}
                            >
                              Booking history
                            </button>
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("support")}
                            >
                              Contact the desk
                            </button>
                          </div>
                        </>
                      ) : null}

                      {modal.kind === "statusDetail" ? (
                        <>
                          <div className="pb-drawer-headline">
                            <span
                              className={`pb-tag ${statusTone(activeRecord?.status ?? "awaiting_payment")}`}
                            >
                              {activeRecord
                                ? statusLabels[activeRecord.status]
                                : "No reservation"}
                            </span>
                            <b className="mono">
                              {activeRecord?.reference ?? "—"}
                            </b>
                          </div>
                          <div className="table-responsive pb-table-wrap">
                            <table className="table pb-table">
                              <thead>
                                <tr>
                                  <th>Stage</th>
                                  <th>State</th>
                                  <th>Timestamp</th>
                                  <th>Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stages.map((row) => (
                                  <tr key={row.key}>
                                    <td>
                                      <b>{stageLabels[row.key]}</b>
                                    </td>
                                    <td>{row.state}</td>
                                    <td className="mono">
                                      {row.at ? atDateTime(row.at) : "—"}
                                    </td>
                                    <td>{row.note}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <dl className="pb-kv pb-kv--rows">
                            <div>
                              <dt>Reservation expires</dt>
                              <dd className="mono">
                                {activeRecord
                                  ? atDateTime(
                                      activeRecord.reservationExpiresAt,
                                    )
                                  : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt>Time remaining</dt>
                              <dd className="mono">
                                {activeRecord ? reservation.label : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt>Operator note</dt>
                              <dd>{activeRecord?.operatorNote ?? "—"}</dd>
                            </div>
                          </dl>
                          <div className="pb-block-actions">
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() =>
                                void copy(
                                  activeRecord?.reference ?? "",
                                  "Reference",
                                )
                              }
                              disabled={!activeRecord}
                            >
                              <Icon name="copy" size={13} /> Copy reference
                            </button>
                            <button
                              type="button"
                              className="pb-btn"
                              onClick={() => open("reservation")}
                            >
                              Hold policy
                            </button>
                          </div>
                        </>
                      ) : null}
                    </DeskModalShell>
                  </div>
                ) : null}
              </div>
            </>
          );
        }}
      </form.Subscribe>
    </InvestorShell>
  );
}
