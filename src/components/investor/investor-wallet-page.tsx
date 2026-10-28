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
import { useWallet } from "@/lib/investor/use-wallet";
import {
  DAILY_DEPOSIT_LIMIT,
  MAX_DEPOSIT,
  MAX_PAYOUT,
  MIN_DEPOSIT,
  MIN_PAYOUT,
  TRANSACTIONS_PER_PAGE,
  atStamp,
  balanceSplit,
  clockOf,
  dateOf,
  defaultMethod,
  depositDraftError,
  depositFee,
  depositTotal,
  depositedToday,
  filterTransactions,
  flowTotals,
  methodKindLabel,
  money,
  newestFirst,
  payoutDraftError,
  payoutFee,
  payoutNet,
  payoutRailFor,
  payoutStatusLabel,
  round2,
  shortDateOf,
  signedMoney,
  suggestedPayout,
  txnStatusLabel,
  txnTypeLabel,
  txnTypes,
  type DepositRail,
  type DepositRailKey,
  type PaymentMethod,
  type PayoutRailKey,
  type WalletCommand,
  type WalletMethodKind,
  type WalletPayout,
  type WalletTransaction,
  type WalletTxnType,
  type WalletWorkspace,
} from "@/lib/investor/wallet";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  InvestorShell,
  type InvestorDrawerTab,
  type InvestorNavKey,
  type InvestorQuickAction,
} from "./investor-shell";

/* ── Formatters ── */

const num = (value: number, decimals = 0) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const tone = (value: number) =>
  value > 0 ? "is-pos" : value < 0 ? "is-neg" : "is-flat";
const txnTone = (type: WalletTxnType) =>
  type === "deposit" || type === "earning" || type === "refund"
    ? "is-credit"
    : type === "fee"
      ? "is-fee"
      : type === "payout"
        ? "is-debit"
        : "is-fund";
const statusTone = (status: string) =>
  status === "completed"
    ? "is-ok"
    : status === "processing"
      ? "is-processing"
      : status === "failed"
        ? "is-failed"
        : status === "refunded"
          ? "is-refunded"
          : "is-pending";
const methodIcon = (kind: WalletMethodKind) =>
  kind === "bank"
    ? ("vault" as const)
    : kind === "mobile"
      ? ("smartphone" as const)
      : kind === "card"
        ? ("wallet" as const)
        : ("globe" as const);

const txnColumnLabels: Record<string, string> = {
  at: "Date",
  type: "Type",
  amount: "Amount",
  methodLabel: "Method",
  status: "Status",
  reference: "Reference",
  balanceAfter: "Balance after",
};

const payoutColumnLabels: Record<string, string> = {
  requestedAt: "Requested",
  gross: "Amount",
  fee: "Fee",
  net: "Net paid",
  rail: "Route",
  destination: "Destination",
  status: "Status",
  reference: "Reference",
};

/* ── Dialog registry ── */

type Kind =
  | "depositWizard"
  | "depositRails"
  | "depositReceipt"
  | "payoutWizard"
  | "payoutPolicy"
  | "payoutHistory"
  | "payoutDetail"
  | "cancelPayout"
  | "retryPayout"
  | "txnDetail"
  | "txnFilters"
  | "statementExport"
  | "addMethod"
  | "removeMethod"
  | "setDefaultMethod"
  | "methodDetail"
  | "verification"
  | "limits"
  | "feeSchedule"
  | "preferences"
  | "reconciliation"
  | "risk"
  | "support"
  | "help";

const titles: Record<Kind, string> = {
  depositWizard: "Add funds to your wallet",
  depositRails: "Funding rails compared",
  depositReceipt: "Deposit receipt",
  payoutWizard: "Request a payout",
  payoutPolicy: "Payout rules & timing",
  payoutHistory: "Payout history",
  payoutDetail: "Payout detail",
  cancelPayout: "Cancel this payout",
  retryPayout: "Retry this payout",
  txnDetail: "Transaction detail",
  txnFilters: "Filter the statement",
  statementExport: "Statement & export",
  addMethod: "Add a payment method",
  removeMethod: "Remove this method",
  setDefaultMethod: "Make this the default",
  methodDetail: "Saved method",
  verification: "Verification & limits",
  limits: "Wallet limits",
  feeSchedule: "Fee schedule",
  preferences: "Wallet preferences",
  reconciliation: "How this balance is built",
  risk: "Wallet risk disclosure",
  support: "Message the treasury desk",
  help: "Workspace boundaries",
};

const wizardSteps: Partial<Record<Kind, readonly string[]>> = {
  depositWizard: ["Amount & rail", "Review", "Confirm"],
  payoutWizard: ["Amount & destination", "Review", "Confirm"],
  statementExport: ["Scope", "Format", "Confirm"],
  addMethod: ["Type", "Details", "Verify"],
  cancelPayout: ["Reason", "Confirm"],
  preferences: ["Wallet rules", "Confirm"],
  support: ["Topic", "Message", "Confirm"],
};

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  depositWizard: "lg",
  depositRails: "xl",
  depositReceipt: "md",
  payoutWizard: "lg",
  payoutPolicy: "md",
  payoutHistory: "xl",
  payoutDetail: "md",
  cancelPayout: "sm",
  retryPayout: "sm",
  txnDetail: "md",
  txnFilters: "md",
  statementExport: "md",
  addMethod: "md",
  removeMethod: "sm",
  setDefaultMethod: "sm",
  methodDetail: "md",
  verification: "lg",
  limits: "md",
  feeSchedule: "lg",
  preferences: "md",
  reconciliation: "lg",
  risk: "lg",
  support: "md",
  help: "lg",
};

const quickActions: InvestorQuickAction[] = [
  { key: "deposit", label: "Add funds", short: "Deposit", icon: "plus" },
  { key: "payout", label: "Request a payout", short: "Payout", icon: "download" },
  { key: "statement", label: "Statement & export", short: "Statement", icon: "file" },
  { key: "history", label: "Filter the statement", short: "History", icon: "filter" },
  { key: "methods", label: "Payment methods", short: "Methods", icon: "wallet" },
  { key: "pools", label: "Crowdfunding pools", short: "Pools", icon: "pool" },
];

const sections = [
  { key: "overview", label: "Overview", id: "wa-overview" },
  { key: "deposit", label: "Deposit", id: "wa-deposit" },
  { key: "payout", label: "Payout", id: "wa-payout" },
  { key: "history", label: "History", id: "wa-history" },
  { key: "methods", label: "Methods", id: "wa-methods" },
] as const;

const quickAmounts = [1_000, 3_000, 5_000, 10_000];
const payoutQuick = [250, 500, 1_000];

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
    <header className="wa-section-head">
      <div>
        <span className="wa-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="wa-section-aside">{aside}</div> : null}
    </header>
  );
}

function Kpi({
  label,
  value,
  hint,
  note,
  decimals = 0,
  prefix = "",
  suffix = "",
  accent = false,
  delay = 0,
}: {
  label: string;
  value: number;
  hint: string;
  note?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  accent?: boolean;
  delay?: number;
}) {
  const shown = useLiveCountUp(value);
  return (
    <article
      className={`wa-kpi ${accent ? "is-accent" : ""}`}
      style={{ "--wa-delay": `${delay}ms` } as CSSProperties}
    >
      <span className="wa-kpi__label">{label}</span>
      <b className="wa-kpi__value mono">
        {prefix}
        {num(shown, decimals)}
        {suffix}
      </b>
      <span className="wa-kpi__hint">{hint}</span>
      {note ? <span className="wa-kpi__note">{note}</span> : null}
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
  return <span className={`wa-tag ${tagTone}`.trim()}>{children}</span>;
}

function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="wa-kv">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Page ── */

export function InvestorWalletPage({
  initial,
  initialAction,
}: {
  initial: WalletWorkspace;
  initialAction?: string;
}) {
  const router = useRouter();
  const { data, command } = useWallet(initial);
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
    deposit: "depositWizard",
    rails: "depositRails",
    receipt: "depositReceipt",
    payout: "payoutWizard",
    policy: "payoutPolicy",
    payouts: "payoutHistory",
    "payout-detail": "payoutDetail",
    cancel: "cancelPayout",
    retry: "retryPayout",
    transaction: "txnDetail",
    filters: "txnFilters",
    statement: "statementExport",
    method: "addMethod",
    remove: "removeMethod",
    default: "setDefaultMethod",
    "method-detail": "methodDetail",
    verification: "verification",
    kyc: "verification",
    limits: "limits",
    fees: "feeSchedule",
    preferences: "preferences",
    reconcile: "reconciliation",
    risk: "risk",
    support: "support",
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
    "overview" | "statement" | "methods" | null
  >(null);
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("wallet");
  const clock = initial.asOf;
  const heroAvailable = useLiveCountUp(data.balance.available);

  /* deposit */
  const [depositAmount, setDepositAmount] = useState(3_000);
  const [depositRailKey, setDepositRailKey] =
    useState<DepositRailKey>("bank_transfer");
  const [depositFields, setDepositFields] = useState<Record<string, string>>({
    accountName: initial.profile.displayName,
    bankName: "Equity Bank",
    iban: "•••• 8842",
    reference: "INV-2026-0342",
  });

  /* payout */
  const [payoutAmount, setPayoutAmount] = useState(500);
  const [payoutMethodId, setPayoutMethodId] = useState(
    defaultMethod(initial)?.id ?? "",
  );
  const [payoutNote, setPayoutNote] = useState("");

  /* statement */
  const [txnQuery, setTxnQuery] = useState("");
  const [txnTypeFilter, setTxnTypeFilter] = useState<WalletTxnType[]>([]);
  const [txnMethodFilter, setTxnMethodFilter] = useState("");
  const [txnFrom, setTxnFrom] = useState("");
  const [txnTo, setTxnTo] = useState("");
  const [txnPage, setTxnPage] = useState(1);
  const [txnSorting, setTxnSorting] = useState<SortingState>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historySorting, setHistorySorting] = useState<SortingState>([]);

  /* selections */
  const [selectedTxn, setSelectedTxn] = useState(
    initial.transactions[0]?.id ?? "",
  );
  const [selectedPayout, setSelectedPayout] = useState(
    initial.payouts[0]?.id ?? "",
  );
  const [selectedMethod, setSelectedMethod] = useState(
    initial.methods[0]?.id ?? "",
  );
  const [selectedDeposit, setSelectedDeposit] = useState(
    initial.transactions.filter((row) => row.type === "deposit").at(-1)?.id ?? "",
  );

  /* export */
  const [exportScope, setExportScope] = useState<
    "statement" | "transactions" | "payouts" | "methods"
  >("statement");
  const [exportFormat, setExportFormat] =
    useState<"pdf" | "csv" | "json">("pdf");

  /* new method */
  const [newMethodKind, setNewMethodKind] = useState<WalletMethodKind>("bank");
  const [newMethod, setNewMethod] = useState({
    label: "",
    provider: "",
    detail: "",
    reference: "",
  });
  const [verifyCode, setVerifyCode] = useState("");

  /* misc */
  const [cancelReason, setCancelReason] = useState<
    "changed_plan" | "wrong_method" | "slower_than_expected" | "other"
  >("changed_plan");
  const [prefs, setPrefs] = useState(initial.preferences);
  const [supportTopic, setSupportTopic] = useState<
    "deposit" | "payout" | "method" | "fees" | "other"
  >("payout");
  const [supportMessage, setSupportMessage] = useState("");

  /* ── Derived ── */

  const depositRail: DepositRail =
    data.depositRails.find((row) => row.key === depositRailKey) ??
    data.depositRails[0];
  const payoutMethod: PaymentMethod | null =
    data.methods.find((row) => row.id === payoutMethodId) ?? defaultMethod(data);
  const pendingPayout = data.payouts.find((row) => row.status === "processing");
  const split = useMemo(() => balanceSplit(data.balance), [data.balance]);
  const dailyUsed = depositedToday(data.transactions, data.asOf);

  const filters = useMemo(
    () => ({
      types: txnTypeFilter,
      methods: txnMethodFilter ? [txnMethodFilter] : [],
      from: txnFrom,
      to: txnTo,
      query: txnQuery,
    }),
    [txnTypeFilter, txnMethodFilter, txnFrom, txnTo, txnQuery],
  );
  const filteredTxns = useMemo(
    () => newestFirst(filterTransactions(data.transactions, filters)),
    [data.transactions, filters],
  );
  const flow = useMemo(() => flowTotals(filteredTxns), [filteredTxns]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredTxns.length / TRANSACTIONS_PER_PAGE),
  );
  const safePage = Math.min(txnPage, pageCount);
  const pageRows = useMemo(
    () =>
      filteredTxns.slice(
        (safePage - 1) * TRANSACTIONS_PER_PAGE,
        safePage * TRANSACTIONS_PER_PAGE,
      ),
    [filteredTxns, safePage],
  );

  const txnRow =
    data.transactions.find((row) => row.id === selectedTxn) ??
    data.transactions[0] ??
    null;
  const payoutRow =
    data.payouts.find((row) => row.id === selectedPayout) ??
    data.payouts[0] ??
    null;
  const methodRow =
    data.methods.find((row) => row.id === selectedMethod) ??
    data.methods[0] ??
    null;
  const depositRow =
    data.transactions.find((row) => row.id === selectedDeposit) ??
    data.transactions.filter((row) => row.type === "deposit").at(-1) ??
    null;
  const pendingMethod = data.methods.find((row) => !row.verified) ?? null;

  const depositErrorText = depositDraftError({
    amount: depositAmount,
    rail: depositRail,
    fields: depositFields,
    terms: confirmed,
    dailyUsed,
  });
  const payoutErrorText = payoutDraftError({
    amount: payoutAmount,
    available: data.balance.available,
    method: payoutMethod,
    terms: confirmed,
  });

  /* ── Tables ── */

  const txnColumn = useMemo(
    () => createDeskColumnHelper<WalletTransaction>(),
    [],
  );
  const txnColumns = useMemo(
    () =>
      txnColumn.columns([
        txnColumn.accessor("at", {
          header: "Date",
          cell: (info) => (
            <span className="mono">{shortDateOf(info.getValue())}</span>
          ),
        }),
        txnColumn.accessor("type", {
          header: "Type",
          cell: (info) => (
            <Tag tone={txnTone(info.getValue())}>
              {txnTypeLabel(info.getValue())}
            </Tag>
          ),
        }),
        txnColumn.accessor("amount", {
          header: "Amount",
          cell: (info) => (
            <b className={`mono ${tone(info.getValue())}`}>
              {signedMoney(info.getValue(), 2)}
            </b>
          ),
        }),
        txnColumn.accessor("methodLabel", {
          header: "Method",
          cell: (info) => (
            <span className="wa-cell-method">{info.getValue()}</span>
          ),
        }),
        txnColumn.accessor("status", {
          header: "Status",
          cell: (info) => (
            <Tag tone={statusTone(info.getValue())}>
              {txnStatusLabel(info.getValue())}
            </Tag>
          ),
        }),
        txnColumn.accessor("reference", {
          header: "Reference",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        txnColumn.accessor("balanceAfter", {
          header: "Balance after",
          cell: (info) => (
            <span className="mono">{money(info.getValue(), 2)}</span>
          ),
        }),
      ]),
    [txnColumn],
  );
  const txnTable = useDeskTable({
    data: pageRows,
    columns: txnColumns,
    state: { sorting: txnSorting },
    onSortingChange: setTxnSorting,
  });

  const historyColumn = useMemo(
    () => createDeskColumnHelper<WalletPayout>(),
    [],
  );
  const historyColumns = useMemo(
    () =>
      historyColumn.columns([
        historyColumn.accessor("requestedAt", {
          header: "Requested",
          cell: (info) => (
            <span className="mono">{shortDateOf(info.getValue())}</span>
          ),
        }),
        historyColumn.accessor("gross", {
          header: "Amount",
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
          header: "Net paid",
          cell: (info) => (
            <span className="mono is-pos">{money(info.getValue(), 2)}</span>
          ),
        }),
        historyColumn.accessor("rail", {
          header: "Route",
          cell: (info) => <span>{railText(info.getValue())}</span>,
        }),
        historyColumn.accessor("destination", {
          header: "Destination",
          cell: (info) => (
            <span className="wa-cell-method">{info.getValue()}</span>
          ),
        }),
        historyColumn.accessor("status", {
          header: "Status",
          cell: (info) => (
            <Tag tone={statusTone(info.getValue())}>
              {payoutStatusLabel(info.getValue())}
            </Tag>
          ),
        }),
        historyColumn.accessor("reference", {
          header: "Reference",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
      ]),
    [historyColumn],
  );
  const historyRows = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return data.payouts;
    return data.payouts.filter((row) =>
      `${row.reference} ${row.providerRef} ${row.destination} ${row.status} ${row.rail}`
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

  /* ── Actions ── */

  function open(kind: Kind) {
    setError("");
    setWizardStep(0);
    setConfirmed(false);
    setModal({ kind });
  }

  function close() {
    setModal(null);
    setDrawer(null);
    setWizardStep(0);
    setConfirmed(false);
    setError("");
    setSupportMessage("");
    setVerifyCode("");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wizardFor = modal ? wizardSteps[modal.kind] : undefined;
  const wizard = wizardFor ? [...wizardFor] : undefined;
  const lastStep = wizard ? wizard.length - 1 : 0;

  function selectRail(key: DepositRailKey) {
    const rail = data.depositRails.find((row) => row.key === key);
    setDepositRailKey(key);
    if (!rail) return;
    const seeded: Record<string, string> = {};
    rail.fields.forEach((field) => {
      seeded[field.name] =
        field.kind === "select"
          ? (field.options?.[0] ?? "")
          : field.name === "accountName"
            ? data.profile.displayName
            : "";
    });
    setDepositFields(seeded);
  }

  function scrollTo(id: string) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function railText(rail: PayoutRailKey) {
    return rail === "bank_transfer"
      ? "Bank"
      : rail === "mobile_money"
        ? "Mobile money"
        : "Crypto";
  }

  async function run(
    input: WalletCommand,
    opts?: { title?: string; detail?: string; keep?: boolean },
  ) {
    setBusy(true);
    setError("");
    try {
      await command.mutateAsync(input);
      pushToast({
        tone: "success",
        title: opts?.title ?? "Wallet updated",
        detail:
          opts?.detail ??
          "Held in this browser session. No bank, card or wallet provider was called.",
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

  function download(value: BlobPart, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function csvOf(rows: Record<string, unknown>[]) {
    const keys = Object.keys(rows[0] ?? { note: "" });
    return [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
  }

  function scopeRows(scope: typeof exportScope) {
    if (scope === "payouts") {
      return data.payouts.map((row) => ({
        reference: row.reference,
        provider_ref: row.providerRef,
        requested: row.requestedAt,
        amount: row.gross,
        fee: row.fee,
        net: row.net,
        rail: row.rail,
        destination: row.destination,
        status: row.status,
        pool: row.poolCode ?? "",
      }));
    }
    if (scope === "methods") {
      return data.methods.map((row) => ({
        label: row.label,
        kind: row.kind,
        provider: row.provider,
        detail: row.detail,
        verified: row.verified,
        default: row.isDefault,
        payout_enabled: row.payoutEnabled,
        fee: row.feeNote,
        added: row.addedAt,
      }));
    }
    const rows =
      scope === "transactions" ? filteredTxns : newestFirst(data.transactions);
    return rows.map((row) => ({
      date: row.at,
      type: row.type,
      description: row.description,
      amount: row.amount,
      fee: row.fee,
      method: row.methodLabel,
      status: row.status,
      reference: row.reference,
      provider_ref: row.providerRef ?? "",
      pool: row.poolCode ?? "",
      balance_after: row.balanceAfter,
    }));
  }

  async function exportRows(scope: typeof exportScope, heading: string) {
    setBusy(true);
    try {
      const rows = scopeRows(scope);
      const stamp = data.asOf.slice(0, 10);
      const fileBase = `trademo-wallet-${scope}`;
      if (exportFormat === "json") {
        download(
          JSON.stringify(
            {
              mode: "demo",
              asOf: data.asOf,
              scope,
              investor: data.profile.id,
              balance: data.balance,
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
          `Ledger ${data.balance.statementFrom.slice(0, 10)} to ${data.balance.statementTo.slice(0, 10)} · closing ${money(data.balance.available, 2)}`,
          18,
          36,
        );
        doc.text(
          "Demo export · not a payment confirmation or a bank statement",
          18,
          42,
        );
        let y = 54;
        doc.setFontSize(8);
        rows.forEach((row) => {
          if (y > 276) {
            doc.addPage();
            y = 20;
          }
          doc.text(
            Object.entries(row)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(" · ")
              .slice(0, 170),
            18,
            y,
          );
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
        },
        {
          keep: true,
          title: `${heading} generated in-browser`,
          detail: `${rows.length} row(s) · ${exportFormat.toUpperCase()} · demo export only.`,
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  /** Inline reason that blocks the current wizard step. */
  const stepBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "depositWizard" && wizardStep === 0) {
      return depositDraftError({
        amount: depositAmount,
        rail: depositRail,
        fields: depositFields,
        terms: true,
        dailyUsed,
      });
    }
    if (modal.kind === "payoutWizard" && wizardStep === 0) {
      return payoutDraftError({
        amount: payoutAmount,
        available: data.balance.available,
        method: payoutMethod,
        terms: true,
      });
    }
    if (modal.kind === "addMethod" && wizardStep === 1) {
      return newMethod.label.trim().length >= 3 &&
        newMethod.provider.trim().length >= 2 &&
        newMethod.detail.trim().length >= 4 &&
        newMethod.reference.trim().length >= 3
        ? ""
        : "Fill in the label, provider, account details and reference";
    }
    if (modal.kind === "support" && wizardStep === 1) {
      return supportMessage.trim().length >= 12
        ? ""
        : "Write at least 12 characters so the desk can act on it";
    }
    return "";
  })();

  const submitBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "depositWizard") return depositErrorText;
    if (modal.kind === "payoutWizard") return payoutErrorText;
    if (modal.kind === "addMethod" && wizardStep === 2) {
      return /^\d{6}$/.test(verifyCode) ? "" : "Enter the six-digit code";
    }
    if (modal.kind === "support") {
      return supportMessage.trim().length >= 12 ? "" : "Add a message first";
    }
    if (modal.kind === "cancelPayout") {
      return confirmed ? "" : "Acknowledge the cancellation to continue";
    }
    return "";
  })();

  const needsAck =
    modal?.kind === "depositWizard" ||
    modal?.kind === "payoutWizard" ||
    modal?.kind === "cancelPayout";

  async function advance() {
    if (!modal) return;
    if (modal.kind === "addMethod" && wizardStep === 1) {
      const created = await run(
        {
          kind: "addMethod",
          methodKind: newMethodKind,
          label: newMethod.label,
          provider: newMethod.provider,
          detail: newMethod.detail,
          reference: newMethod.reference,
          note: "",
        },
        { keep: true, title: "Method saved — verification pending" },
      );
      if (created) setWizardStep(2);
      return;
    }
    setWizardStep((step) => step + 1);
  }

  async function submit() {
    if (!modal) return;
    if (modal.kind === "depositWizard") {
      const ok = await run({
        kind: "deposit",
        amount: round2(depositAmount),
        rail: depositRailKey,
        methodLabel: `${depositRail.label} · ${depositFields.reference || data.profile.displayName}`,
        providerRef: "",
        note: "",
      });
      if (!ok) setWizardStep(1);
      return;
    }
    if (modal.kind === "payoutWizard") {
      if (!payoutMethod) return;
      const ok = await run({
        kind: "requestPayout",
        amount: round2(payoutAmount),
        methodId: payoutMethod.id,
        note: payoutNote,
      });
      if (!ok) setWizardStep(1);
      return;
    }
    if (modal.kind === "statementExport") {
      await exportRows(exportScope, "Wallet statement");
      close();
      return;
    }
    if (modal.kind === "addMethod") {
      if (wizardStep === 2) {
        if (!pendingMethod) {
          setError("No method is waiting for verification");
          return;
        }
        await run({
          kind: "verifyMethod",
          methodId: pendingMethod.id,
          code: verifyCode,
        });
        return;
      }
      const created = await run(
        {
          kind: "addMethod",
          methodKind: newMethodKind,
          label: newMethod.label,
          provider: newMethod.provider,
          detail: newMethod.detail,
          reference: newMethod.reference,
          note: "",
        },
        { keep: true, title: "Method saved — verification pending" },
      );
      if (created) setWizardStep(2);
      return;
    }
    if (modal.kind === "cancelPayout") {
      if (!payoutRow || !confirmed) return;
      await run({
        kind: "cancelPayout",
        payoutId: payoutRow.id,
        reason: cancelReason,
      });
      return;
    }
    if (modal.kind === "preferences") {
      await run({
        kind: "savePreferences",
        emailReceipts: prefs.emailReceipts,
        autoPayout: prefs.autoPayout,
        payoutThreshold: prefs.payoutThreshold,
        lowBalanceAlert: prefs.lowBalanceAlert,
      });
      return;
    }
    if (modal.kind === "risk") {
      await run({ kind: "acknowledge", scope: "risk" });
      return;
    }
    if (modal.kind === "support") {
      await run({
        kind: "support",
        topic: supportTopic,
        message: supportMessage,
      });
    }
  }

  const submitLabel = !modal
    ? "Done"
    : modal.kind === "depositWizard"
      ? "Confirm deposit"
      : modal.kind === "payoutWizard"
        ? "Request payout"
        : modal.kind === "statementExport"
          ? "Generate file"
          : modal.kind === "addMethod"
            ? wizardStep === 2
              ? "Verify method"
              : "Save method"
            : modal.kind === "cancelPayout"
              ? "Cancel payout"
              : modal.kind === "preferences"
                ? "Save preferences"
                : modal.kind === "risk"
                  ? "Record acknowledgement"
                  : "Send to desk";

  const modalFooter = (
    <>
      {wizard && wizardStep === lastStep && needsAck ? (
        <label className="wa-check wa-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-label="Confirm this local preview"
          />
          I understand this is a local preview: no bank, card network or wallet
          provider is contacted and no money moves.
        </label>
      ) : null}
      {wizard ? (
        <span className="wa-muted">Session-only preview · no money moves</span>
      ) : null}
      <button type="button" className="wa-btn" onClick={close}>
        Close
      </button>
      {wizard && wizardStep > 0 ? (
        <button
          type="button"
          className="wa-btn"
          onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
        >
          <Icon name="arrowLeft" size={13} /> Back
        </button>
      ) : null}
      {wizard && wizardStep < lastStep ? (
        <button
          type="button"
          className="wa-btn wa-btn--primary"
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
          className="wa-btn wa-btn--primary"
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
      rootClass="page-investor-wallet"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={data.balance.lockedInPools}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.balance.available}
      unread={data.profile.unread}
      activeNav={activeNav}
      detailHref="/investor/pools/pkg_01"
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
        if (key === "calculator") return router.push("/investor/calculator");
        if (key === "notifications")
          return router.push("/investor/notifications");
        if (key === "earnings") return router.push("/investor/earnings");
        if (key === "activity") return router.push("/investor/activity");
        if (key === "settings") return router.push("/investor?action=profile");
        if (key === "wallet") return setDrawer("overview");
        setDrawer("overview");
      }}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(
          tab === "portfolio"
            ? "overview"
            : tab === "activity"
              ? "statement"
              : "methods",
        )
      }
      onQuickAction={(key) => {
        if (key === "deposit") return open("depositWizard");
        if (key === "payout") return open("payoutWizard");
        if (key === "statement") return open("statementExport");
        if (key === "history") return open("txnFilters");
        if (key === "methods") return open("addMethod");
        if (key === "pools") return router.push("/investor/pools");
      }}
      onChromeReady={(chromeApi) => {
        chrome.current = chromeApi;
      }}
      onOpenNotifications={() => router.push("/investor/notifications")}
    >
        <div className="wa-page">
          <header className="wa-hero">
            <div className="wa-hero__main">
              <span className="wa-eyebrow">
                I-7 · INVESTOR WORKSPACE / CASH &amp; SETTLEMENT
              </span>
              <h1>Wallet &amp; finances</h1>
              <p className="wa-lede">
                One ledger for every deposit, pool funding, earning credit, fee
                and payout. Cash here reconciles to the dollar with{" "}
                <Link href="/investor/investments">My investments</Link>, so the
                balance you see is the balance the desk books.
              </p>

              <div className="wa-hero__split">
                <div className="wa-hero__balance">
                  <span className="wa-hero__label">Available to withdraw</span>
                  <b className="wa-hero__amount mono">{money(heroAvailable, 2)}</b>
                  <span className="wa-hero__sub">
                    {data.balance.currency} · cleared and withdrawable ·{" "}
                    {money(data.balance.lockedInPools)} locked in pools
                  </span>
                </div>
                <div className="wa-actions">
                  <button
                    type="button"
                    className="wa-btn wa-btn--primary"
                    onClick={() => open("depositWizard")}
                  >
                    <Icon name="plus" size={14} /> Deposit funds
                  </button>
                  <button
                    type="button"
                    className="wa-btn"
                    onClick={() => open("payoutWizard")}
                  >
                    <Icon name="download" size={14} /> Request payout
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--ghost"
                    onClick={() => setDrawer("overview")}
                  >
                    <Icon name="panelRight" size={14} /> Wallet drawer
                  </button>
                </div>
              </div>

              <div
                className="wa-splitbar"
                role="img"
                aria-label={split
                  .map((bucket) => `${bucket.label} ${bucket.pct}%`)
                  .join(", ")}
              >
                {split.map((bucket) => (
                  <span
                    key={bucket.key}
                    className={`wa-splitbar__seg is-${bucket.key}`}
                    style={{ width: `${bucket.pct}%` }}
                    title={`${bucket.label} · ${money(bucket.value, 2)} · ${bucket.pct}%`}
                  />
                ))}
              </div>
              <ul className="wa-legend">
                {split.map((bucket) => (
                  <li key={bucket.key}>
                    <span className={`wa-dot is-${bucket.key}`} aria-hidden="true" />
                    <b className="mono">{money(bucket.value, 2)}</b>
                    <span>{bucket.label}</span>
                    <span className="mono wa-muted">{bucket.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="wa-hero__side">
              <div className="wa-hero__card">
                <div className="wa-hero__card-head">
                  <span className="wa-section-code">ACCOUNT</span>
                  <Tag tone="is-ok">{data.profile.kycLevel} verified</Tag>
                </div>
                <b>{data.profile.displayName}</b>
                <span className="wa-muted">{data.profile.email}</span>
                <Kv
                  rows={[
                    ["Tier", data.profile.tier],
                    ["Country", data.profile.country],
                    [
                      "Statement window",
                      `${shortDateOf(data.balance.statementFrom)} → ${shortDateOf(data.balance.statementTo)}`,
                    ],
                    [
                      "Ledger rows",
                      `${data.transactions.length} · rev r${data.revision}`,
                    ],
                  ]}
                />
                <div className="wa-hero__mix">
                  <span>
                    <b className="mono">{split[0].pct}%</b> withdrawable now
                  </span>
                  <span>
                    <b className="mono">{round2(100 - split[0].pct)}%</b> at work
                    or in flight
                  </span>
                </div>
                <div className="wa-hero__card-actions">
                  <button
                    type="button"
                    className="wa-link"
                    onClick={() => open("verification")}
                  >
                    Verification &amp; limits
                  </button>
                  <button
                    type="button"
                    className="wa-link"
                    onClick={() => open("reconciliation")}
                  >
                    How this balance is built
                  </button>
                  <button
                    type="button"
                    className="wa-link"
                    onClick={() => open("support")}
                  >
                    Message treasury
                  </button>
                </div>
              </div>
            </aside>
          </header>

          <nav className="wa-jump" aria-label="Wallet sections">
            <div className="wa-jump__links">
              {sections.map((section, index) => (
                <button
                  key={section.key}
                  type="button"
                  className="wa-jump__link"
                  onClick={() => scrollTo(section.id)}
                >
                  <span className="mono">{String(index + 1).padStart(2, "0")}</span>
                  {section.label}
                </button>
              ))}
            </div>
            <div className="wa-jump__meta">
              <button type="button" className="wa-link" onClick={() => open("limits")}>
                Limits
              </button>
              <button type="button" className="wa-link" onClick={() => open("feeSchedule")}>
                Fees
              </button>
              <button
                type="button"
                className="wa-link"
                onClick={() => open("preferences")}
              >
                Preferences
              </button>
              <button type="button" className="wa-link" onClick={() => open("help")}>
                Boundaries
              </button>
              <span className="mono wa-muted">
                {clockOf(clock)} UTC · {data.profile.currency}
              </span>
            </div>
          </nav>

          {error && !modal ? (
            <p className="wa-error" role="alert">
              {error}
            </p>
          ) : null}

          {/* ── 1. Overview ── */}
          <section id="wa-overview" className="wa-section">
            <SectionHead
              code="01 / OVERVIEW"
              title="What the account is worth today"
              hint="Cash, capital at work, and the payout already in flight — straight off the ledger."
              aside={
                <>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm"
                    onClick={() => open("reconciliation")}
                  >
                    Reconcile
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => setDrawer("overview")}
                  >
                    Open drawer
                  </button>
                </>
              }
            />

            <div className="wa-kpi-grid">
              <Kpi
                label="Available now"
                value={data.balance.available}
                decimals={2}
                prefix="$"
                hint="Cleared cash you can withdraw"
                note={`Statement closes ${shortDateOf(data.balance.statementTo)}`}
                accent
                delay={0}
              />
              <Kpi
                label="Locked in pools"
                value={data.balance.lockedInPools}
                prefix="$"
                hint={`${data.balance.bookedInPools ? "Active + booked" : "Active positions"} · ${money(data.balance.bookedInPools)} booked`}
                note={`${money(data.balance.accruedInPools, 2)} accrued, unpaid`}
                delay={70}
              />
              <Kpi
                label="Pending payout"
                value={data.balance.pendingPayoutGross}
                decimals={2}
                prefix="$"
                hint={`${data.balance.pendingPayoutCount} request${data.balance.pendingPayoutCount === 1 ? "" : "s"} processing`}
                note={`${money(data.balance.pendingPayoutNet, 2)} net after fee`}
                delay={140}
              />
              <Kpi
                label="Total account value"
                value={data.balance.totalAccountValue}
                decimals={2}
                prefix="$"
                hint="Cash + capital at work"
                note={`Opening balance ${money(data.balance.openingBalance, 2)}`}
                delay={210}
              />
            </div>

            <div className="wa-two-col">
              <div className="wa-panel">
                <div className="wa-panel__head">
                  <h3>Lifetime flows</h3>
                  <span className="wa-muted mono">
                    {shortDateOf(data.balance.statementFrom)} →{" "}
                    {shortDateOf(data.balance.statementTo)}
                  </span>
                </div>
                <ul className="wa-lifetime">
                  <li>
                    <span>Deposited</span>
                    <b className="mono is-pos">
                      {signedMoney(data.lifetime.deposited, 2)}
                    </b>
                    <small className="wa-muted">
                      {data.lifetime.depositCount} deposits
                    </small>
                  </li>
                  <li>
                    <span>Earned credited</span>
                    <b className="mono is-pos">
                      {signedMoney(data.lifetime.earnedCredited, 2)}
                    </b>
                    <small className="wa-muted">
                      {data.lifetime.earningCount} credits ·{" "}
                      {money(data.lifetime.accruedInPools, 2)} still accruing
                    </small>
                  </li>
                  <li>
                    <span>Withdrawn</span>
                    <b className="mono is-debit">
                      {signedMoney(-data.lifetime.withdrawn, 2)}
                    </b>
                    <small className="wa-muted">
                      {data.lifetime.payoutCount} payouts ·{" "}
                      {money(data.lifetime.feesPaid, 2)} fees
                    </small>
                  </li>
                  <li>
                    <span>Deployed into pools</span>
                    <b className="mono is-fund">
                      {signedMoney(-data.lifetime.investedFromWallet, 2)}
                    </b>
                    <small className="wa-muted">
                      {money(data.lifetime.refunded, 2)} refunded to the wallet
                    </small>
                  </li>
                </ul>
                <p className="wa-foot-note">
                  Earned credits are booked after the platform cut; pool accrual
                  stays inside the position until a window settles. Both are
                  reconciled with I-6, not restated here.
                </p>
              </div>

              <div className="wa-panel">
                <div className="wa-panel__head">
                  <h3>How the balance is built</h3>
                  <Tag tone="is-ok">Reconciled</Tag>
                </div>
                <Kv
                  rows={[
                    [
                      "Opening balance",
                      <span className="mono" key="open">
                        {money(data.balance.openingBalance, 2)}
                      </span>,
                    ],
                    [
                      "Net ledger movement",
                      <span className="mono is-pos" key="flow">
                        {signedMoney(data.balance.available, 2)}
                      </span>,
                    ],
                    [
                      "Available cash",
                      <span className="mono" key="avail">
                        {money(data.balance.available, 2)}
                      </span>,
                    ],
                    [
                      "Booked into pools",
                      <span className="mono" key="booked">
                        {money(data.balance.bookedInPools, 2)}
                      </span>,
                    ],
                    [
                      "Interest registered",
                      <span className="mono" key="interest">
                        {money(data.balance.interestRegistered, 2)}
                      </span>,
                    ],
                    [
                      "Pending payout",
                      <span className="mono" key="pending">
                        {money(data.balance.pendingPayoutGross, 2)}
                      </span>,
                    ],
                  ]}
                />
                <p className="wa-foot-note">
                  Opening {money(data.balance.openingBalance, 2)} +{" "}
                  {flowTotals(data.transactions).count} movements ={" "}
                  {money(data.balance.available, 2)} available.{" "}
                  {data.transactions.length} rows written to the statement.
                </p>
                <div className="wa-panel__actions">
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm"
                    onClick={() => open("statementExport")}
                  >
                    <Icon name="file" size={13} /> Statement
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => open("risk")}
                  >
                    Risk disclosure
                  </button>
                </div>
              </div>
            </div>

            <div className="wa-panel wa-panel--wide">
              <div className="wa-panel__head">
                <h3>Limits &amp; standing</h3>
                <button
                  type="button"
                  className="wa-link"
                  onClick={() => open("limits")}
                >
                  Full limit schedule
                </button>
              </div>
              <ul className="wa-limit-strip">
                {data.limits.map((limit) => (
                  <li key={limit.id} className={`is-${limit.state}`}>
                    <span className="wa-limit-strip__label">{limit.label}</span>
                    <b className="mono">{limit.value}</b>
                    <small className="wa-muted">{limit.detail}</small>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ── 2. Deposit ── */}
          <section id="wa-deposit" className="wa-section">
            <SectionHead
              code="02 / DEPOSIT"
              title="Add funds to the wallet"
              hint="Pick a rail, see the full charge before you commit, then confirm. The fee is quoted on top so the amount you typed is what lands."
              aside={
                <>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => open("depositRails")}
                  >
                    Compare rails
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => open("feeSchedule")}
                  >
                    Fee schedule
                  </button>
                </>
              }
            />

            <div className="wa-deposit">
              <div className="wa-panel">
                <div className="wa-panel__head">
                  <h3>Amount</h3>
                  <span className="wa-muted mono">
                    Min {money(MIN_DEPOSIT)} · max {money(MAX_DEPOSIT)} ·{" "}
                    {money(DAILY_DEPOSIT_LIMIT)}/day
                  </span>
                </div>
                <div className="wa-amount-field">
                  <span className="wa-amount-field__prefix mono">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={depositAmount ? num(depositAmount) : ""}
                    placeholder={num(1_000)}
                    aria-label="Deposit amount"
                    onChange={(event) =>
                      setDepositAmount(
                        Number(event.target.value.replace(/[^0-9.]/g, "")) || 0,
                      )
                    }
                  />
                  <span className="wa-amount-field__suffix mono">USD</span>
                </div>
                <div className="wa-quick">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`wa-quick__btn ${depositAmount === amount ? "is-active" : ""}`}
                      onClick={() => setDepositAmount(amount)}
                    >
                      {money(amount)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="wa-quick__btn"
                    onClick={() =>
                      setDepositAmount(
                        Math.min(
                          MAX_DEPOSIT,
                          Math.max(data.balance.available, suggestedPayout(MAX_DEPOSIT)),
                        ),
                      )
                    }
                  >
                    Custom
                  </button>
                </div>

                <h4 className="wa-subhead">Funding rail</h4>
                <div
                  className="wa-rails"
                  role="radiogroup"
                  aria-label="Deposit rail"
                >
                  {data.depositRails.map((rail, index) => (
                    <button
                      key={rail.key}
                      type="button"
                      role="radio"
                      aria-checked={rail.key === depositRailKey}
                      className={`wa-rail ${rail.key === depositRailKey ? "is-active" : ""}`}
                      style={{ "--wa-delay": `${index * 45}ms` } as CSSProperties}
                      onClick={() => selectRail(rail.key)}
                    >
                      <span className="wa-rail__icon">
                        <Icon name={rail.icon} size={16} />
                      </span>
                      <span className="wa-rail__body">
                        <b>{rail.label}</b>
                        <small>{rail.tagline}</small>
                        <span className="wa-rail__meta mono">
                          {rail.feeNote} · {rail.eta}
                        </span>
                      </span>
                      <span className="wa-rail__tick" aria-hidden="true">
                        {rail.key === depositRailKey ? (
                          <Icon name="check" size={13} />
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="wa-panel">
                <div className="wa-panel__head">
                  <h3>{depositRail.label} details</h3>
                  <Tag tone="is-pending">{depositRail.eta}</Tag>
                </div>
                <p className="wa-copy">{depositRail.detail}</p>
                <p className="wa-foot-note">
                  Settles to this wallet only. {depositRail.feeNote} ·{" "}
                  {money(depositRail.minAmount)}–{money(depositRail.maxAmount)} per
                  deposit.
                </p>
                <div className="wa-form">
                  {depositRail.fields.map((field, index) => (
                    <label
                      key={field.name}
                      className="wa-field"
                      style={{ "--wa-delay": `${index * 40}ms` } as CSSProperties}
                    >
                      <span>
                        {field.label}
                        {field.required ? (
                          <span className="wa-req" aria-hidden="true">
                            *
                          </span>
                        ) : null}
                      </span>
                      {field.kind === "select" ? (
                        <select
                          value={depositFields[field.name] ?? ""}
                          onChange={(event) =>
                            setDepositFields((prev) => ({
                              ...prev,
                              [field.name]: event.target.value,
                            }))
                          }
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.kind === "number" ? "number" : "text"}
                          inputMode={field.kind === "tel" ? "tel" : undefined}
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          value={depositFields[field.name] ?? ""}
                          onChange={(event) =>
                            setDepositFields((prev) => ({
                              ...prev,
                              [field.name]: event.target.value,
                            }))
                          }
                        />
                      )}
                      {field.hint ? (
                        <small className="wa-muted">{field.hint}</small>
                      ) : null}
                    </label>
                  ))}
                </div>

                <div className="wa-fee-preview">
                  <div>
                    <span>Deposit</span>
                    <b className="mono">{money(depositAmount, 2)}</b>
                  </div>
                  <div>
                    <span>
                      Fee · {depositRail.feePct}%
                      {depositRail.feeFlat ? ` + ${money(depositRail.feeFlat, 2)}` : ""}
                    </span>
                    <b className="mono">{money(depositFee(depositRail, depositAmount), 2)}</b>
                  </div>
                  <div className="is-total">
                    <span>Total charged</span>
                    <b className="mono">{money(depositTotal(depositRail, depositAmount), 2)}</b>
                  </div>
                </div>

                <div className="wa-panel__actions">
                  <button
                    type="button"
                    className="wa-btn wa-btn--primary"
                    onClick={() => open("depositWizard")}
                  >
                    <Icon name="plus" size={14} /> Continue to deposit
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--ghost"
                    onClick={() => {
                      setDepositAmount(3_000);
                      selectRail("bank_transfer");
                    }}
                  >
                    Reset
                  </button>
                </div>
                <p className="wa-foot-note">
                  Daily deposits used: {money(dailyUsed, 2)} of{" "}
                  {money(DAILY_DEPOSIT_LIMIT)}.{" "}
                  {dailyUsed > 0
                    ? "Counted from today's ledger rows."
                    : "Nothing deposited today yet."}
                </p>
              </div>
            </div>

            <div className="wa-panel wa-panel--wide">
              <div className="wa-panel__head">
                <h3>Recent deposits</h3>
                <button
                  type="button"
                  className="wa-link"
                  onClick={() => open("statementExport")}
                >
                  Download receipts
                </button>
              </div>
              <ul className="wa-mini-list">
                {newestFirst(data.transactions)
                  .filter((row) => row.type === "deposit")
                  .slice(0, 3)
                  .map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="wa-mini-list__row"
                        onClick={() => {
                          setSelectedDeposit(row.id);
                          open("depositReceipt");
                        }}
                      >
                        <span className="wa-mini-list__date mono">
                          {dateOf(row.at)}
                        </span>
                        <span>{row.methodLabel}</span>
                        <Tag tone={statusTone(row.status)}>
                          {txnStatusLabel(row.status)}
                        </Tag>
                        <b className="mono is-pos">{signedMoney(row.amount, 2)}</b>
                        <span className="mono wa-muted">{row.reference}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </section>

          {/* ── 3. Payout ── */}
          <section id="wa-payout" className="wa-section">
            <SectionHead
              code="03 / PAYOUT"
              title="Request a payout"
              hint="Withdraw available cash to a verified destination. Minimum $50, capped at $10,000 per request, fee shown before submission."
              aside={
                <>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => open("payoutPolicy")}
                  >
                    Payout rules
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => open("payoutHistory")}
                  >
                    Payout history
                  </button>
                </>
              }
            />

            <div className="wa-payout">
              <div className="wa-panel">
                <div className="wa-panel__head">
                  <h3>Available to withdraw</h3>
                  <b className="mono wa-panel__figure">
                    {money(data.balance.available, 2)}
                  </b>
                </div>
                <div className="wa-amount-field">
                  <span className="wa-amount-field__prefix mono">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={payoutAmount ? num(payoutAmount) : ""}
                    aria-label="Payout amount"
                    onChange={(event) =>
                      setPayoutAmount(
                        Number(event.target.value.replace(/[^0-9.]/g, "")) || 0,
                      )
                    }
                  />
                  <span className="wa-amount-field__suffix mono">USD</span>
                </div>
                <div className="wa-quick">
                  {payoutQuick.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`wa-quick__btn ${payoutAmount === amount ? "is-active" : ""}`}
                      onClick={() => setPayoutAmount(amount)}
                    >
                      {money(amount)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="wa-quick__btn"
                    onClick={() => setPayoutAmount(suggestedPayout(data.balance.available))}
                  >
                    Max {money(suggestedPayout(data.balance.available))}
                  </button>
                </div>

                <h4 className="wa-subhead">Destination</h4>
                <div className="wa-methods-pick" role="radiogroup" aria-label="Payout destination">
                  {data.methods
                    .filter((method) => method.payoutEnabled)
                    .map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        role="radio"
                        aria-checked={payoutMethod?.id === method.id}
                        className={`wa-method-pick ${payoutMethod?.id === method.id ? "is-active" : ""}`}
                        onClick={() => setPayoutMethodId(method.id)}
                      >
                        <Icon name={methodIcon(method.kind)} size={15} />
                        <span className="wa-method-pick__body">
                          <b>{method.label}</b>
                          <small>
                            {method.detail} · {method.feeNote}
                          </small>
                        </span>
                        {method.isDefault ? <Tag tone="is-ok">Default</Tag> : null}
                      </button>
                    ))}
                </div>
                {data.methods.some((method) => !method.payoutEnabled) ? (
                  <p className="wa-foot-note">
                    Deposit-only cards are excluded from payout destinations.
                  </p>
                ) : null}

                <label className="wa-field">
                  <span>Note for the treasury desk (optional)</span>
                  <input
                    type="text"
                    maxLength={160}
                    value={payoutNote}
                    placeholder="Rent top-up, no rush"
                    onChange={(event) => setPayoutNote(event.target.value)}
                  />
                </label>

                <div className="wa-fee-preview">
                  <div>
                    <span>Requested</span>
                    <b className="mono">{money(payoutAmount, 2)}</b>
                  </div>
                  <div>
                    <span>
                      Fee ·{" "}
                      {payoutMethod
                        ? methodKindLabel(payoutMethod.kind)
                        : "no destination"}
                    </span>
                    <b className="mono">
                      {payoutMethod
                        ? money(payoutFee(payoutAmount, payoutMethod.kind), 2)
                        : "—"}
                    </b>
                  </div>
                  <div className="is-total">
                    <span>Net to you</span>
                    <b className="mono">
                      {payoutMethod
                        ? money(payoutNet(payoutAmount, payoutMethod.kind), 2)
                        : "—"}
                    </b>
                  </div>
                </div>

                <div className="wa-panel__actions">
                  <button
                    type="button"
                    className="wa-btn wa-btn--primary"
                    onClick={() => open("payoutWizard")}
                  >
                    <Icon name="download" size={14} /> Continue to payout
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--ghost"
                    onClick={() => open("addMethod")}
                  >
                    <Icon name="plus" size={13} /> New destination
                  </button>
                </div>
              </div>

              <div className="wa-panel">
                <div className="wa-panel__head">
                  <h3>Recent payouts</h3>
                  <button
                    type="button"
                    className="wa-link"
                    onClick={() => open("payoutHistory")}
                  >
                    All {data.payouts.length}
                  </button>
                </div>
                <ul className="wa-payout-list">
                  {data.payouts.slice(0, 3).map((payout) => (
                    <li key={payout.id}>
                      <button
                        type="button"
                        className="wa-payout-row"
                        onClick={() => {
                          setSelectedPayout(payout.id);
                          open("payoutDetail");
                        }}
                      >
                        <span className="mono wa-muted">
                          {dateOf(payout.requestedAt)} ·{" "}
                          {clockOf(payout.requestedAt).slice(0, 5)}
                        </span>
                        <b className="mono">{money(payout.gross, 2)}</b>
                        <span>{railText(payout.rail)}</span>
                        <Tag tone={statusTone(payout.status)}>
                          {payoutStatusLabel(payout.status)}
                        </Tag>
                        <span className="mono wa-muted">{payout.reference}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                {pendingPayout ? (
                  <div className="wa-callout">
                    <span className="wa-callout__label">In flight</span>
                    <b className="mono">{money(pendingPayout.gross, 2)}</b>
                    <span className="wa-muted">
                      {money(pendingPayout.net, 2)} net · expected{" "}
                      {dateOf(pendingPayout.expectedAt)} · {pendingPayout.providerRef}
                    </span>
                    <div className="wa-callout__actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--sm"
                        onClick={() => {
                          setSelectedPayout(pendingPayout.id);
                          open("cancelPayout");
                        }}
                      >
                        Cancel request
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--sm wa-btn--ghost"
                        onClick={() => {
                          setSelectedPayout(pendingPayout.id);
                          open("payoutDetail");
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="wa-policy">
                  <h4 className="wa-subhead">Routing &amp; timing</h4>
                  <ul>
                    {data.payoutRails.map((rail) => (
                      <li key={rail.key}>
                        <b>{rail.label}</b>
                        <span className="mono">{rail.eta}</span>
                        <small className="wa-muted">
                          {rail.feeNote} · {money(rail.min)}–{money(rail.max)}
                        </small>
                      </li>
                    ))}
                  </ul>
                  <p className="wa-foot-note">
                    Payouts move from available cash only. Locked pool capital
                    cannot be withdrawn before its window closes.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 4. Statement ── */}
          <section id="wa-history" className="wa-section">
            <SectionHead
              code="04 / TRANSACTIONS"
              title="Transaction history"
              hint="Every movement on the ledger with the running balance after it. Filter, sort, then export exactly what you see."
              aside={
                <>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm"
                    onClick={() => void exportRows("transactions", "Transactions")}
                    disabled={busy}
                  >
                    <Icon name="download" size={13} /> CSV
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => {
                      setExportScope("statement");
                      open("statementExport");
                    }}
                  >
                    <Icon name="file" size={13} /> PDF
                  </button>
                </>
              }
            />

            <div className="wa-panel wa-panel--table">
              <div className="wa-toolbar">
                <label className="wa-search">
                  <Icon name="search" size={14} />
                  <input
                    type="search"
                    placeholder="Search reference or pool"
                    value={txnQuery}
                    aria-label="Search transactions"
                    onChange={(event) => {
                      setTxnQuery(event.target.value);
                      setTxnPage(1);
                    }}
                  />
                </label>
                <div className="wa-chip-row" role="group" aria-label="Filter by type">
                  {txnTypes.map((type) => {
                    const on = txnTypeFilter.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`wa-chip ${on ? "is-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => {
                          setTxnTypeFilter((prev) =>
                            prev.includes(type)
                              ? prev.filter((row) => row !== type)
                              : [...prev, type],
                          );
                          setTxnPage(1);
                        }}
                      >
                        {txnTypeLabel(type)}
                      </button>
                    );
                  })}
                </div>
                <div className="wa-toolbar__right">
                  <select
                    aria-label="Filter by method"
                    value={txnMethodFilter}
                    onChange={(event) => {
                      setTxnMethodFilter(event.target.value);
                      setTxnPage(1);
                    }}
                  >
                    <option value="">All methods</option>
                    {Array.from(
                      new Set(data.transactions.map((row) => row.method)),
                    ).map((method) => (
                      <option key={method} value={method}>
                        {methodKindLabel(method as WalletMethodKind)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => open("txnFilters")}
                  >
                    <Icon name="filter" size={13} /> More filters
                  </button>
                </div>
              </div>

              <div className="wa-table-wrap">
                <table className="wa-table wa-table--stack">
                  <thead>
                    {txnTable.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        {group.headers.map((header) => (
                          <th key={header.id}>
                            <button
                              type="button"
                              className="wa-th"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <txnTable.FlexRender header={header} />
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
                    {txnTable.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="is-clickable"
                        onClick={() => {
                          setSelectedTxn(row.original.id);
                          open("txnDetail");
                        }}
                      >
                        {row.getAllCells().map((cell) => (
                          <td
                            key={cell.id}
                            data-label={
                              txnColumnLabels[cell.column.id] ?? cell.column.id
                            }
                          >
                            <txnTable.FlexRender cell={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {txnTable.getRowModel().rows.length ? null : (
                  <p className="wa-empty">
                    No movements match this filter. Clear the chips or widen the
                    dates.
                  </p>
                )}
              </div>

              <div className="wa-table-foot">
                <span className="mono wa-muted">
                  {flow.count} rows · in {money(flow.inflow, 2)} · out{" "}
                  {money(flow.outflow, 2)} · net {signedMoney(flow.net, 2)}
                </span>
                <div className="wa-pager">
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    disabled={safePage <= 1}
                    onClick={() => setTxnPage((page) => Math.max(1, page - 1))}
                  >
                    <Icon name="arrowLeft" size={12} /> Prev
                  </button>
                  <span className="mono">
                    Page {safePage} / {pageCount}
                  </span>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    disabled={safePage >= pageCount}
                    onClick={() =>
                      setTxnPage((page) => Math.min(pageCount, page + 1))
                    }
                  >
                    Next <Icon name="arrowRight" size={12} />
                  </button>
                </div>
                <button
                  type="button"
                  className="wa-link"
                  onClick={() => {
                    setTxnQuery("");
                    setTxnTypeFilter([]);
                    setTxnMethodFilter("");
                    setTxnFrom("");
                    setTxnTo("");
                    setTxnPage(1);
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>
          </section>

          {/* ── 5. Methods ── */}
          <section id="wa-methods" className="wa-section">
            <SectionHead
              code="05 / SAVED METHODS"
              title="Payment methods"
              hint="Destinations the desk will pay to and rails it will collect from. One method is the default payout destination."
              aside={
                <>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--primary"
                    onClick={() => open("addMethod")}
                  >
                    <Icon name="plus" size={13} /> Add payment method
                  </button>
                  <button
                    type="button"
                    className="wa-btn wa-btn--sm wa-btn--ghost"
                    onClick={() => open("verification")}
                  >
                    Verification
                  </button>
                </>
              }
            />

            <div className="wa-method-grid">
              {data.methods.map((method, index) => (
                <article
                  key={method.id}
                  className={`wa-method-card ${method.isDefault ? "is-default" : ""}`}
                  style={{ "--wa-delay": `${index * 55}ms` } as CSSProperties}
                >
                  <header>
                    <span className="wa-method-card__icon">
                      <Icon name={methodIcon(method.kind)} size={16} />
                    </span>
                    <div>
                      <b>{method.label}</b>
                      <small className="wa-muted">{method.provider}</small>
                    </div>
                    {method.isDefault ? (
                      <span className="wa-star" title="Default payout destination">
                        <Icon name="target" size={14} />
                      </span>
                    ) : null}
                  </header>
                  <p className="wa-method-card__detail mono">{method.detail}</p>
                  <div className="wa-method-card__tags">
                    <Tag tone={method.verified ? "is-ok" : "is-pending"}>
                      {method.verified ? "Verified" : "Unverified"}
                    </Tag>
                    <Tag>{methodKindLabel(method.kind)}</Tag>
                    {method.payoutEnabled ? null : <Tag tone="is-muted">Deposit only</Tag>}
                  </div>
                  <Kv
                    rows={[
                      ["Reference", <span className="mono" key="ref">{method.reference}</span>],
                      ["Fee", method.feeNote],
                      [
                        "Limits",
                        `${money(method.limits.min)}–${money(method.limits.max)} · ${money(method.limits.daily)}/day`,
                      ],
                      ["Added", dateOf(method.addedAt)],
                    ]}
                  />
                  <div className="wa-method-card__actions">
                    {method.isDefault ? (
                      <Tag tone="is-ok">Default</Tag>
                    ) : (
                      <button
                        type="button"
                        className="wa-btn wa-btn--sm"
                        onClick={() => {
                          setSelectedMethod(method.id);
                          open("setDefaultMethod");
                        }}
                      >
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      className="wa-btn wa-btn--sm wa-btn--ghost"
                      onClick={() => {
                        setSelectedMethod(method.id);
                        open("methodDetail");
                      }}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="wa-btn wa-btn--sm wa-btn--ghost"
                      onClick={() => {
                        setSelectedMethod(method.id);
                        open("removeMethod");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}

              <button
                type="button"
                className="wa-method-add"
                onClick={() => open("addMethod")}
              >
                <Icon name="plus" size={18} />
                <b>Add payment method</b>
                <small>Bank, mobile money, card or crypto address</small>
              </button>
            </div>

            <p className="wa-foot-note">
              Cards are collection-only on this desk. Removing the default method
              promotes the next verified payout destination automatically.
            </p>
          </section>

          <footer className="wa-foot">
            <div className="wa-foot__links">
              <Link href="/investor">Investor overview</Link>
              <Link href="/investor/pools">Crowdfunding pools</Link>
              <Link href="/investor/investments">My investments</Link>
              <Link href="/investor/live">Live trade tracker</Link>
              <button type="button" className="wa-link" onClick={() => open("preferences")}>
                Wallet preferences
              </button>
              <button type="button" className="wa-link" onClick={() => open("help")}>
                Workspace boundaries
              </button>
            </div>
            <div className="wa-foot__audit">
              <h4>Local audit trail</h4>
              {data.audit.length ? (
                <ul>
                  {data.audit.slice(0, 4).map((entry) => (
                    <li key={entry.id}>
                      <span className="mono wa-muted">{atStamp(entry.at)}</span>
                      <b>{entry.action}</b>
                      <span>{entry.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="wa-muted">
                  No session changes yet. Every action you take here is logged
                  against revision r{data.revision}.
                </p>
              )}
            </div>
            <p className="wa-foot__meta">
              Revision r{data.revision} · snapshot {atStamp(data.asOf)} ·{" "}
              {data.exports.length} export{data.exports.length === 1 ? "" : "s"} ·{" "}
              {data.support.length} desk message{data.support.length === 1 ? "" : "s"} ·{" "}
              demo data, no payment provider contacted
            </p>
          </footer>

          {/* ── right drawer ── */}
          {drawer ? (
            <div
              className="op-drawer-backdrop wa-drawer-layer"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setDrawer(null);
              }}
            >
              <aside
                className="op-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Wallet inspector"
              >
                <div className="op-drawer__head">
                  <div>
                    <span className="wa-section-code">I-7 / WALLET INSPECTOR</span>
                    <h2 className="op-drawer__title">Cash &amp; settlement</h2>
                    <p className="wa-muted">
                      {money(data.balance.available, 2)} available ·{" "}
                      {clockOf(clock)} UTC
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
                <div className="wa-drawer-tabs" role="tablist" aria-label="Inspector views">
                  {(["overview", "statement", "methods"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={drawer === tab}
                      className={drawer === tab ? "is-active" : ""}
                      onClick={() => setDrawer(tab)}
                    >
                      {tab === "overview"
                        ? "Balance"
                        : tab === "statement"
                          ? "Statement"
                          : "Methods"}
                    </button>
                  ))}
                </div>
                <div className="op-drawer__body">
                  {drawer === "overview" ? (
                    <>
                      <div className="wa-drawer-balance">
                        <span className="wa-muted">Available cash</span>
                        <b className="mono">{money(data.balance.available, 2)}</b>
                        <span className="wa-muted mono">
                          {money(data.balance.totalAccountValue, 2)} total account
                          value
                        </span>
                      </div>
                      <Kv
                        rows={[
                          ["Locked in pools", money(data.balance.lockedInPools, 2)],
                          ["Booked capital", money(data.balance.bookedInPools, 2)],
                          ["Interest registered", money(data.balance.interestRegistered, 2)],
                          ["Accrued unpaid", money(data.balance.accruedInPools, 2)],
                          ["Pending payout", money(data.balance.pendingPayoutGross, 2)],
                          ["Pending net", money(data.balance.pendingPayoutNet, 2)],
                          ["Opening balance", money(data.balance.openingBalance, 2)],
                        ]}
                      />
                      <div className="wa-drawer-actions">
                        <button
                          type="button"
                          className="wa-btn wa-btn--primary"
                          onClick={() => {
                            setDrawer(null);
                            open("depositWizard");
                          }}
                        >
                          Deposit funds
                        </button>
                        <button
                          type="button"
                          className="wa-btn"
                          onClick={() => {
                            setDrawer(null);
                            open("payoutWizard");
                          }}
                        >
                          Request payout
                        </button>
                        <button
                          type="button"
                          className="wa-btn wa-btn--ghost"
                          onClick={() => {
                            setDrawer(null);
                            open("reconciliation");
                          }}
                        >
                          Reconcile
                        </button>
                      </div>
                    </>
                  ) : null}

                  {drawer === "statement" ? (
                    <>
                      <p className="wa-muted">
                        Last {Math.min(6, newestFirst(data.transactions).length)} of{" "}
                        {data.transactions.length} ledger rows. Full filters and
                        exports live in section 04.
                      </p>
                      <ul className="wa-drawer-rows">
                        {newestFirst(data.transactions)
                          .slice(0, 6)
                          .map((row) => (
                            <li key={row.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTxn(row.id);
                                  setDrawer(null);
                                  open("txnDetail");
                                }}
                              >
                                <span className="mono wa-muted">
                                  {shortDateOf(row.at)}
                                </span>
                                <span>{txnTypeLabel(row.type)}</span>
                                <b className={`mono ${tone(row.amount)}`}>
                                  {signedMoney(row.amount, 2)}
                                </b>
                                <span className="mono wa-muted">
                                  {money(row.balanceAfter, 2)}
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                      <div className="wa-drawer-actions">
                        <button
                          type="button"
                          className="wa-btn wa-btn--primary"
                          onClick={() => {
                            setDrawer(null);
                            open("statementExport");
                          }}
                        >
                          Export statement
                        </button>
                        <button
                          type="button"
                          className="wa-btn wa-btn--ghost"
                          onClick={() => {
                            setDrawer(null);
                            open("txnFilters");
                          }}
                        >
                          Filter statement
                        </button>
                      </div>
                    </>
                  ) : null}

                  {drawer === "methods" ? (
                    <>
                      <ul className="wa-drawer-methods">
                        {data.methods.map((method) => (
                          <li key={method.id}>
                            <Icon name={methodIcon(method.kind)} size={15} />
                            <div>
                              <b>{method.label}</b>
                              <small className="wa-muted mono">{method.detail}</small>
                            </div>
                            {method.isDefault ? (
                              <Tag tone="is-ok">Default</Tag>
                            ) : (
                              <Tag tone={method.verified ? "" : "is-pending"}>
                                {method.verified ? "Verified" : "Pending"}
                              </Tag>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="wa-drawer-actions">
                        <button
                          type="button"
                          className="wa-btn wa-btn--primary"
                          onClick={() => {
                            setDrawer(null);
                            open("addMethod");
                          }}
                        >
                          Add payment method
                        </button>
                        <button
                          type="button"
                          className="wa-btn wa-btn--ghost"
                          onClick={() => {
                            setDrawer(null);
                            open("verification");
                          }}
                        >
                          Verification
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
            <div className="wa-modal-layer">
              <DeskModalShell
                code="I-7"
                eyebrow="INVESTOR WORKSPACE / LOCAL PREVIEW"
                title={titles[modal.kind]}
                subtitle="Structured session state. Deposit capture, payout execution and statement delivery require authenticated backend integration."
                size={modalSize[modal.kind] ?? "md"}
                onClose={close}
                steps={wizard}
                currentStep={wizardStep}
                footer={modalFooter}
              >
                {error ? (
                  <p className="wa-error" role="alert">
                    {error}
                  </p>
                ) : null}

                {modal.kind === "depositWizard" ? (
                  <>
                    {wizardStep === 0 ? (
                      <>
                        <div className="wa-amount-field">
                          <span className="wa-amount-field__prefix mono">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={depositAmount ? num(depositAmount) : ""}
                            aria-label="Deposit amount"
                            onChange={(event) =>
                              setDepositAmount(
                                Number(event.target.value.replace(/[^0-9.]/g, "")) || 0,
                              )
                            }
                          />
                          <span className="wa-amount-field__suffix mono">USD</span>
                        </div>
                        <div className="wa-quick">
                          {quickAmounts.map((amount) => (
                            <button
                              key={amount}
                              type="button"
                              className={`wa-quick__btn ${depositAmount === amount ? "is-active" : ""}`}
                              onClick={() => setDepositAmount(amount)}
                            >
                              {money(amount)}
                            </button>
                          ))}
                        </div>
                        <div className="wa-rails wa-rails--compact" role="radiogroup" aria-label="Deposit rail">
                          {data.depositRails.map((rail) => (
                            <button
                              key={rail.key}
                              type="button"
                              role="radio"
                              aria-checked={rail.key === depositRailKey}
                              className={`wa-rail ${rail.key === depositRailKey ? "is-active" : ""}`}
                              onClick={() => selectRail(rail.key)}
                            >
                              <span className="wa-rail__icon">
                                <Icon name={rail.icon} size={15} />
                              </span>
                              <span className="wa-rail__body">
                                <b>{rail.label}</b>
                                <span className="wa-rail__meta mono">
                                  {rail.feeNote} · {rail.eta}
                                </span>
                              </span>
                              <span className="wa-rail__tick" aria-hidden="true">
                                {rail.key === depositRailKey ? (
                                  <Icon name="check" size={12} />
                                ) : null}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="wa-form">
                          {depositRail.fields.map((field) => (
                            <label key={field.name} className="wa-field">
                              <span>
                                {field.label}
                                {field.required ? (
                                  <span className="wa-req" aria-hidden="true">
                                    *
                                  </span>
                                ) : null}
                              </span>
                              {field.kind === "select" ? (
                                <select
                                  value={depositFields[field.name] ?? ""}
                                  onChange={(event) =>
                                    setDepositFields((prev) => ({
                                      ...prev,
                                      [field.name]: event.target.value,
                                    }))
                                  }
                                >
                                  {(field.options ?? []).map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={field.kind === "number" ? "number" : "text"}
                                  inputMode={field.kind === "tel" ? "tel" : undefined}
                                  placeholder={field.placeholder}
                                  maxLength={field.maxLength}
                                  value={depositFields[field.name] ?? ""}
                                  onChange={(event) =>
                                    setDepositFields((prev) => ({
                                      ...prev,
                                      [field.name]: event.target.value,
                                    }))
                                  }
                                />
                              )}
                            </label>
                          ))}
                        </div>
                        {stepBlockingError ? (
                          <p className="wa-hint-error">{stepBlockingError}</p>
                        ) : null}
                      </>
                    ) : null}

                    {wizardStep === 1 ? (
                      <>
                        <Kv
                          rows={[
                            ["Rail", depositRail.label],
                            ["Amount", <span className="mono" key="amt">{money(depositAmount, 2)}</span>],
                            [
                              "Fee",
                              <span className="mono" key="fee">
                                {money(depositFee(depositRail, depositAmount), 2)}
                              </span>,
                            ],
                            [
                              "Total charged",
                              <b className="mono" key="total">
                                {money(depositTotal(depositRail, depositAmount), 2)}
                              </b>,
                            ],
                            ["Settlement", depositRail.eta],
                            [
                              "Reference",
                              <span className="mono" key="ref">
                                {depositFields.reference || data.profile.id}
                              </span>,
                            ],
                          ]}
                        />
                        <p className="wa-copy">{depositRail.detail}</p>
                        <p className="wa-foot-note">
                          The fee is charged on top, so the wallet is credited the
                          full {money(depositAmount, 2)} once the rail settles.
                        </p>
                      </>
                    ) : null}

                    {wizardStep === 2 ? (
                      <>
                        <Kv
                          rows={[
                            ["Depositing", <b className="mono" key="amt">{money(depositAmount, 2)}</b>],
                            ["Via", `${depositRail.label} · ${depositRail.eta}`],
                            ["Charged", <span className="mono" key="tot">{money(depositTotal(depositRail, depositAmount), 2)}</span>],
                            ["New available balance", <span className="mono is-pos" key="new">{money(data.balance.available + depositAmount, 2)}</span>],
                          ]}
                        />
                        <p className="wa-copy">
                          Nothing leaves your bank in this preview. Confirming
                          writes one ledger row, updates the running balance and
                          records an audit entry you can see in the drawer.
                        </p>
                      </>
                    ) : null}
                  </>
                ) : null}

                {modal.kind === "depositRails" ? (
                  <>
                    <div className="wa-table-wrap">
                      <table className="wa-table">
                        <thead>
                          <tr>
                            <th>Rail</th>
                            <th>Fee</th>
                            <th>Arrival</th>
                            <th>Range</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.depositRails.map((rail) => (
                            <tr key={rail.key}>
                              <td><b>{rail.label}</b></td>
                              <td className="mono">{rail.feeNote}</td>
                              <td>{rail.eta}</td>
                              <td className="mono">
                                {money(rail.minAmount)}–{money(rail.maxAmount)}
                              </td>
                              <td className="wa-muted">{rail.tagline}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="wa-foot-note">
                      Fees are illustrative in this preview and are added on top of
                      the amount, never deducted from it.
                    </p>
                  </>
                ) : null}

                {modal.kind === "depositReceipt" && depositRow ? (
                  <>
                    <div className="wa-modal-head">
                      <Tag tone={statusTone(depositRow.status)}>
                        {txnStatusLabel(depositRow.status)}
                      </Tag>
                      <b className="mono">{money(depositRow.amount, 2)}</b>
                      <span>{depositRow.description}</span>
                    </div>
                    <Kv
                      rows={[
                        ["Booked", atStamp(depositRow.at)],
                        ["Method", depositRow.methodLabel],
                        ["Reference", <span className="mono" key="ref">{depositRow.reference}</span>],
                        ["Provider ref", <span className="mono" key="prov">{depositRow.providerRef ?? "—"}</span>],
                        ["Fee", <span className="mono" key="fee">{money(depositRow.fee, 2)}</span>],
                        ["Balance after", <span className="mono" key="bal">{money(depositRow.balanceAfter, 2)}</span>],
                      ]}
                    />
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn"
                        onClick={() => void copy(depositRow.reference, "Reference")}
                      >
                        <Icon name="copy" size={13} /> Copy reference
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("depositWizard")}
                      >
                        Deposit again
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "payoutWizard" ? (
                  <>
                    {wizardStep === 0 ? (
                      <>
                        <div className="wa-modal-head">
                          <span className="wa-muted">Available</span>
                          <b className="mono">{money(data.balance.available, 2)}</b>
                          <Tag>Min {money(MIN_PAYOUT)}</Tag>
                          <Tag>Max {money(MAX_PAYOUT)}</Tag>
                        </div>
                        <div className="wa-amount-field">
                          <span className="wa-amount-field__prefix mono">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={payoutAmount ? num(payoutAmount) : ""}
                            aria-label="Payout amount"
                            onChange={(event) =>
                              setPayoutAmount(
                                Number(event.target.value.replace(/[^0-9.]/g, "")) || 0,
                              )
                            }
                          />
                          <span className="wa-amount-field__suffix mono">USD</span>
                        </div>
                        <div className="wa-quick">
                          {payoutQuick.map((amount) => (
                            <button
                              key={amount}
                              type="button"
                              className={`wa-quick__btn ${payoutAmount === amount ? "is-active" : ""}`}
                              onClick={() => setPayoutAmount(amount)}
                            >
                              {money(amount)}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="wa-quick__btn"
                            onClick={() => setPayoutAmount(suggestedPayout(data.balance.available))}
                          >
                            Max {money(suggestedPayout(data.balance.available))}
                          </button>
                        </div>
                        <div className="wa-methods-pick" role="radiogroup" aria-label="Payout destination">
                          {data.methods
                            .filter((method) => method.payoutEnabled)
                            .map((method) => (
                              <button
                                key={method.id}
                                type="button"
                                role="radio"
                                aria-checked={payoutMethod?.id === method.id}
                                className={`wa-method-pick ${payoutMethod?.id === method.id ? "is-active" : ""}`}
                                onClick={() => setPayoutMethodId(method.id)}
                              >
                                <Icon name={methodIcon(method.kind)} size={15} />
                                <span className="wa-method-pick__body">
                                  <b>{method.label}</b>
                                  <small>{method.detail} · {method.feeNote}</small>
                                </span>
                                {method.isDefault ? <Tag tone="is-ok">Default</Tag> : null}
                              </button>
                            ))}
                        </div>
                        {stepBlockingError ? (
                          <p className="wa-hint-error">{stepBlockingError}</p>
                        ) : null}
                      </>
                    ) : null}

                    {wizardStep === 1 ? (
                      <>
                        <Kv
                          rows={[
                            ["Requested", <span className="mono" key="amt">{money(payoutAmount, 2)}</span>],
                            ["Destination", payoutMethod ? `${payoutMethod.label} · ${payoutMethod.detail}` : "—"],
                            ["Route", payoutMethod ? railText(payoutRailFor(payoutMethod)) : "—"],
                            [
                              "Fee",
                              <span className="mono" key="fee">
                                {payoutMethod
                                  ? money(payoutFee(payoutAmount, payoutMethod.kind), 2)
                                  : "—"}
                              </span>,
                            ],
                            [
                              "Net to you",
                              <b className="mono" key="net">
                                {payoutMethod
                                  ? money(payoutNet(payoutAmount, payoutMethod.kind), 2)
                                  : "—"}
                              </b>,
                            ],
                            [
                              "Expected",
                              data.payoutRails.find(
                                (rail) => rail.key === payoutRailFor(payoutMethod),
                              )?.eta ?? "—",
                            ],
                          ]}
                        />
                        <label className="wa-field">
                          <span>Note for the treasury desk (optional)</span>
                          <input
                            type="text"
                            maxLength={160}
                            value={payoutNote}
                            onChange={(event) => setPayoutNote(event.target.value)}
                          />
                        </label>
                      </>
                    ) : null}

                    {wizardStep === 2 ? (
                      <>
                        <Kv
                          rows={[
                            ["Payout", <b className="mono" key="amt">{money(payoutAmount, 2)}</b>],
                            ["To", payoutMethod?.label ?? "—"],
                            ["Fee", <span className="mono" key="fee">{payoutMethod ? money(payoutFee(payoutAmount, payoutMethod.kind), 2) : "—"}</span>],
                            ["Net", <span className="mono is-pos" key="net">{payoutMethod ? money(payoutNet(payoutAmount, payoutMethod.kind), 2) : "—"}</span>],
                            ["Available after", <span className="mono" key="after">{money(data.balance.available - payoutAmount, 2)}</span>],
                          ]}
                        />
                        <p className="wa-copy">
                          Confirming moves this amount out of available cash into a
                          pending payout. You can cancel while it is still
                          processing.
                        </p>
                      </>
                    ) : null}
                  </>
                ) : null}

                {modal.kind === "payoutPolicy" ? (
                  <>
                    <ul className="wa-policy-list">
                      <li>
                        <b>Eligibility</b>
                        <span>
                          Only cleared cash can be withdrawn. Pool capital stays
                          locked until its trading window closes.
                        </span>
                      </li>
                      <li>
                        <b>Minimum &amp; maximum</b>
                        <span className="mono">
                          {money(MIN_PAYOUT)} per request · {money(MAX_PAYOUT)} cap
                        </span>
                      </li>
                      {data.payoutRails.map((rail) => (
                        <li key={rail.key}>
                          <b>{rail.label}</b>
                          <span>
                            {rail.eta} · {rail.feeNote} · {rail.destination}
                          </span>
                        </li>
                      ))}
                      <li>
                        <b>Cancellation</b>
                        <span>
                          A processing request can be cancelled and returns to
                          available cash immediately.
                        </span>
                      </li>
                    </ul>
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("feeSchedule")}
                      >
                        Fee schedule
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "payoutHistory" ? (
                  <>
                    <label className="wa-search">
                      <Icon name="search" size={14} />
                      <input
                        type="search"
                        placeholder="Search reference, destination or status"
                        value={historyQuery}
                        aria-label="Search payouts"
                        onChange={(event) => setHistoryQuery(event.target.value)}
                      />
                    </label>
                    <div className="wa-table-wrap">
                      <table className="wa-table">
                        <thead>
                          {historyTable.getHeaderGroups().map((group) => (
                            <tr key={group.id}>
                              {group.headers.map((header) => (
                                <th key={header.id}>
                                  <button
                                    type="button"
                                    className="wa-th"
                                    onClick={header.column.getToggleSortingHandler()}
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
                              onClick={() => {
                                setSelectedPayout(row.original.id);
                                open("payoutDetail");
                              }}
                            >
                              {row.getAllCells().map((cell) => (
                                <td
                                  key={cell.id}
                                  data-label={
                                    payoutColumnLabels[cell.column.id] ??
                                    cell.column.id
                                  }
                                >
                                  <historyTable.FlexRender cell={cell} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {historyTable.getRowModel().rows.length ? null : (
                      <p className="wa-empty">
                        No payout matches “{historyQuery}”.
                      </p>
                    )}
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn"
                        onClick={() => void exportRows("payouts", "Payout history")}
                        disabled={busy}
                      >
                        <Icon name="download" size={13} /> Export payouts
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--primary"
                        onClick={() => open("payoutWizard")}
                      >
                        New payout
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "payoutDetail" && payoutRow ? (
                  <>
                    <div className="wa-modal-head">
                      <Tag tone={statusTone(payoutRow.status)}>
                        {payoutStatusLabel(payoutRow.status)}
                      </Tag>
                      <b className="mono">{money(payoutRow.gross, 2)}</b>
                      <span>{payoutRow.destination}</span>
                    </div>
                    <Kv
                      rows={[
                        ["Reference", <span className="mono" key="ref">{payoutRow.reference}</span>],
                        ["Provider ref", <span className="mono" key="prov">{payoutRow.providerRef}</span>],
                        ["Requested", atStamp(payoutRow.requestedAt)],
                        ["Expected", dateOf(payoutRow.expectedAt)],
                        ["Processed", payoutRow.processedAt ? atStamp(payoutRow.processedAt) : "—"],
                        ["Route", railText(payoutRow.rail)],
                        ["Fee", <span className="mono" key="fee">{money(payoutRow.fee, 2)}</span>],
                        ["Net paid", <b className="mono is-pos" key="net">{money(payoutRow.net, 2)}</b>],
                        ["Pool", payoutRow.poolCode ?? "Wallet cash"],
                        ["Note", payoutRow.note || "—"],
                      ]}
                    />
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn"
                        onClick={() => void copy(payoutRow.providerRef, "Provider reference")}
                      >
                        <Icon name="copy" size={13} /> Copy provider ref
                      </button>
                      {payoutRow.status === "processing" ? (
                        <button
                          type="button"
                          className="wa-btn wa-btn--danger"
                          onClick={() => open("cancelPayout")}
                        >
                          Cancel request
                        </button>
                      ) : null}
                      {payoutRow.status === "failed" ? (
                        <button
                          type="button"
                          className="wa-btn wa-btn--primary"
                          onClick={() => open("retryPayout")}
                        >
                          Retry payout
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("support")}
                      >
                        Ask the desk
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "cancelPayout" ? (
                  <>
                    {payoutRow ? (
                      <Kv
                        rows={[
                          ["Payout", <span className="mono" key="amt">{money(payoutRow.gross, 2)}</span>],
                          ["Reference", <span className="mono" key="ref">{payoutRow.reference}</span>],
                          ["Status", payoutStatusLabel(payoutRow.status)],
                          ["Returns to available", <span className="mono is-pos" key="back">{money(payoutRow.gross, 2)}</span>],
                        ]}
                      />
                    ) : null}
                    <h4 className="wa-subhead">Why are you cancelling?</h4>
                    <div className="wa-chip-row" role="radiogroup" aria-label="Cancellation reason">
                      {(
                        [
                          ["changed_plan", "Changed my plan"],
                          ["wrong_method", "Wrong destination"],
                          ["slower_than_expected", "Slower than expected"],
                          ["other", "Other"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={cancelReason === key}
                          className={`wa-chip ${cancelReason === key ? "is-on" : ""}`}
                          onClick={() => setCancelReason(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {wizardStep === 1 && !confirmed ? (
                      <p className="wa-hint-error">
                        Acknowledge the cancellation to continue.
                      </p>
                    ) : null}
                  </>
                ) : null}

                {modal.kind === "retryPayout" && payoutRow ? (
                  <>
                    <Tag tone="is-failed">Failed</Tag>
                    <Kv
                      rows={[
                        ["Original", <span className="mono" key="ref">{payoutRow.reference}</span>],
                        ["Amount", <span className="mono" key="amt">{money(payoutRow.gross, 2)}</span>],
                        ["Destination", payoutRow.destination],
                        ["Failure note", payoutRow.note || "Provider declined the transfer"],
                      ]}
                    />
                    <p className="wa-copy">
                      Retrying re-opens the request against the same destination
                      with a fresh provider reference. Nothing leaves the wallet
                      until the desk confirms the new transfer.
                    </p>
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--primary"
                        disabled={busy}
                        onClick={() =>
                          void run({ kind: "retryPayout", payoutId: payoutRow.id })
                        }
                      >
                        {busy ? "Working…" : "Retry this payout"}
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("addMethod")}
                      >
                        Use a different destination
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "txnDetail" && txnRow ? (
                  <>
                    <div className="wa-modal-head">
                      <Tag tone={txnTone(txnRow.type)}>{txnTypeLabel(txnRow.type)}</Tag>
                      <b className={`mono ${tone(txnRow.amount)}`}>
                        {signedMoney(txnRow.amount, 2)}
                      </b>
                      <Tag tone={statusTone(txnRow.status)}>
                        {txnStatusLabel(txnRow.status)}
                      </Tag>
                    </div>
                    <p className="wa-copy">{txnRow.description}</p>
                    <Kv
                      rows={[
                        ["Posted", atStamp(txnRow.at)],
                        ["Method", txnRow.methodLabel],
                        ["Reference", <span className="mono" key="ref">{txnRow.reference}</span>],
                        ["Provider ref", <span className="mono" key="prov">{txnRow.providerRef ?? "—"}</span>],
                        ["Fee inside movement", <span className="mono" key="fee">{money(txnRow.fee, 2)}</span>],
                        ["Pool", txnRow.poolCode ?? "—"],
                        ["Balance after", <b className="mono" key="bal">{money(txnRow.balanceAfter, 2)}</b>],
                      ]}
                    />
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn"
                        onClick={() => void copy(txnRow.reference, "Reference")}
                      >
                        <Icon name="copy" size={13} /> Copy reference
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => {
                          setTxnQuery(txnRow.reference);
                          setTxnPage(1);
                        }}
                      >
                        Show only this reference
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "txnFilters" ? (
                  <>
                    <div className="wa-form">
                      <label className="wa-field">
                        <span>From</span>
                        <input
                          type="date"
                          value={txnFrom}
                          onChange={(event) => {
                            setTxnFrom(event.target.value);
                            setTxnPage(1);
                          }}
                        />
                      </label>
                      <label className="wa-field">
                        <span>To</span>
                        <input
                          type="date"
                          value={txnTo}
                          onChange={(event) => {
                            setTxnTo(event.target.value);
                            setTxnPage(1);
                          }}
                        />
                      </label>
                      <label className="wa-field">
                        <span>Method</span>
                        <select
                          value={txnMethodFilter}
                          onChange={(event) => {
                            setTxnMethodFilter(event.target.value);
                            setTxnPage(1);
                          }}
                        >
                          <option value="">All methods</option>
                          {Array.from(new Set(data.transactions.map((row) => row.method))).map(
                            (method) => (
                              <option key={method} value={method}>
                                {methodKindLabel(method as WalletMethodKind)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label className="wa-field">
                        <span>Search</span>
                        <input
                          type="search"
                          value={txnQuery}
                          placeholder="Reference, pool or description"
                          onChange={(event) => {
                            setTxnQuery(event.target.value);
                            setTxnPage(1);
                          }}
                        />
                      </label>
                    </div>
                    <h4 className="wa-subhead">Movement types</h4>
                    <div className="wa-chip-row" role="group" aria-label="Filter by type">
                      {txnTypes.map((type) => {
                        const on = txnTypeFilter.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            className={`wa-chip ${on ? "is-on" : ""}`}
                            aria-pressed={on}
                            onClick={() => {
                              setTxnTypeFilter((prev) =>
                                prev.includes(type)
                                  ? prev.filter((row) => row !== type)
                                  : [...prev, type],
                              );
                              setTxnPage(1);
                            }}
                          >
                            {txnTypeLabel(type)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="wa-foot-note">
                      {filteredTxns.length} of {data.transactions.length} rows match.
                      Filters stay on this page until you clear them.
                    </p>
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--primary"
                        disabled={busy}
                        onClick={() =>
                          void run({
                            kind: "saveFilters",
                            types: txnTypeFilter,
                            methods: txnMethodFilter ? [txnMethodFilter] : [],
                            from: txnFrom,
                            to: txnTo,
                            query: txnQuery,
                          }).then((ok) => {
                            if (ok) scrollTo("wa-history");
                          })
                        }
                      >
                        Apply &amp; save filter
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => {
                          setTxnQuery("");
                          setTxnTypeFilter([]);
                          setTxnMethodFilter("");
                          setTxnFrom("");
                          setTxnTo("");
                          setTxnPage(1);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "statementExport" ? (
                  <>
                    {wizardStep === 0 ? (
                      <>
                        <h4 className="wa-subhead">What to include</h4>
                        <div className="wa-choice-grid">
                          {(
                            [
                              ["statement", "Full statement", `All ${data.transactions.length} ledger rows plus balances`],
                              ["transactions", "Filtered rows", `${filteredTxns.length} rows matching the current filters`],
                              ["payouts", "Payout history", `${data.payouts.length} payout requests with provider refs`],
                              ["methods", "Payment methods", `${data.methods.length} saved destinations`],
                            ] as const
                          ).map(([key, label, detail]) => (
                            <button
                              key={key}
                              type="button"
                              role="radio"
                              aria-checked={exportScope === key}
                              className={`wa-choice ${exportScope === key ? "is-active" : ""}`}
                              onClick={() => setExportScope(key)}
                            >
                              <b>{label}</b>
                              <small>{detail}</small>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {wizardStep === 1 ? (
                      <>
                        <h4 className="wa-subhead">Format</h4>
                        <div className="wa-choice-grid wa-choice-grid--three">
                          {(
                            [
                              ["pdf", "PDF statement", "Branded, paginated, audit header"],
                              ["csv", "CSV", "One row per movement, Excel-ready"],
                              ["json", "JSON", "Structured payload for your accountant"],
                            ] as const
                          ).map(([key, label, detail]) => (
                            <button
                              key={key}
                              type="button"
                              role="radio"
                              aria-checked={exportFormat === key}
                              className={`wa-choice ${exportFormat === key ? "is-active" : ""}`}
                              onClick={() => setExportFormat(key)}
                            >
                              <b>{label}</b>
                              <small>{detail}</small>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {wizardStep === 2 ? (
                      <>
                        <Kv
                          rows={[
                            ["Scope", exportScope],
                            ["Format", exportFormat.toUpperCase()],
                            ["Rows", String(scopeRows(exportScope).length)],
                            ["Window", `${dateOf(data.balance.statementFrom)} → ${dateOf(data.balance.statementTo)}`],
                            ["Investor", `${data.profile.displayName} · ${data.profile.id}`],
                          ]}
                        />
                        <p className="wa-foot-note">
                          Generated in this browser from session state — no email
                          is sent and no file is stored on a server.
                        </p>
                      </>
                    ) : null}
                  </>
                ) : null}

                {modal.kind === "addMethod" ? (
                  <>
                    {wizardStep === 0 ? (
                      <div className="wa-choice-grid">
                        {(
                          [
                            ["bank", "Bank account", "ACH / SEPA, 1–3 business days"],
                            ["mobile", "Mobile money", "MTN, M-Pesa, Airtel — minutes"],
                            ["card", "Card", "Collection only, instant"],
                            ["crypto", "Crypto address", "USDT on Tron, network fee"],
                          ] as const
                        ).map(([key, label, detail]) => (
                          <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={newMethodKind === key}
                            className={`wa-choice ${newMethodKind === key ? "is-active" : ""}`}
                            onClick={() => {
                              setNewMethodKind(key);
                              setNewMethod((prev) => ({
                                ...prev,
                                label: key === "bank" ? "Bank account" : key === "mobile" ? "Mobile money" : key === "card" ? "Card" : "Crypto wallet",
                              }));
                            }}
                          >
                            <b>{label}</b>
                            <small>{detail}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {wizardStep === 1 ? (
                      <div className="wa-form">
                        <label className="wa-field">
                          <span>Label *</span>
                          <input
                            type="text"
                            maxLength={40}
                            value={newMethod.label}
                            placeholder="Operating account"
                            onChange={(event) =>
                              setNewMethod((prev) => ({ ...prev, label: event.target.value }))
                            }
                          />
                        </label>
                        <label className="wa-field">
                          <span>Provider *</span>
                          <input
                            type="text"
                            maxLength={40}
                            value={newMethod.provider}
                            placeholder={newMethodKind === "bank" ? "Equity Bank" : newMethodKind === "mobile" ? "M-Pesa" : newMethodKind === "card" ? "Visa" : "Tron"}
                            onChange={(event) =>
                              setNewMethod((prev) => ({ ...prev, provider: event.target.value }))
                            }
                          />
                        </label>
                        <label className="wa-field">
                          <span>Account details *</span>
                          <input
                            type="text"
                            maxLength={60}
                            value={newMethod.detail}
                            placeholder="•••• 8842"
                            onChange={(event) =>
                              setNewMethod((prev) => ({ ...prev, detail: event.target.value }))
                            }
                          />
                        </label>
                        <label className="wa-field">
                          <span>Reference / holder name *</span>
                          <input
                            type="text"
                            maxLength={60}
                            value={newMethod.reference}
                            placeholder={data.profile.displayName}
                            onChange={(event) =>
                              setNewMethod((prev) => ({ ...prev, reference: event.target.value }))
                            }
                          />
                        </label>
                        {stepBlockingError ? (
                          <p className="wa-hint-error">{stepBlockingError}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {wizardStep === 2 ? (
                      <>
                        <Kv
                          rows={[
                            ["Type", methodKindLabel(newMethodKind)],
                            ["Label", newMethod.label],
                            ["Provider", newMethod.provider],
                            ["Details", <span className="mono" key="detail">{newMethod.detail}</span>],
                            ["Holder", newMethod.reference],
                            ["Payout enabled", pendingMethod?.payoutEnabled ? "Yes" : "After verification"],
                          ]}
                        />
                        <label className="wa-field">
                          <span>Six-digit verification code *</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={verifyCode}
                            placeholder="000000"
                            onChange={(event) =>
                              setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                          />
                          <small className="wa-muted">
                            Demo code: any six digits. A live desk would text or
                            email a one-time code.
                          </small>
                        </label>
                        {submitBlockingError ? (
                          <p className="wa-hint-error">{submitBlockingError}</p>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}

                {modal.kind === "removeMethod" && methodRow ? (
                  <>
                    <p className="wa-copy">
                      Remove <b>{methodRow.label}</b> ({methodRow.detail})? Future
                      payouts cannot use it, and its verification is discarded.
                    </p>
                    {methodRow.isDefault ? (
                      <p className="wa-hint-error">
                        This is your default destination — the next verified
                        payout method becomes the default automatically.
                      </p>
                    ) : null}
                    {data.methods.length <= 1 ? (
                      <p className="wa-hint-error">
                        Keep at least one payment method on file.
                      </p>
                    ) : null}
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--danger"
                        disabled={busy || data.methods.length <= 1}
                        onClick={() =>
                          void run(
                            { kind: "removeMethod", methodId: methodRow.id },
                            { title: "Payment method removed" },
                          )
                        }
                      >
                        {busy ? "Working…" : "Remove method"}
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("methodDetail")}
                      >
                        Keep it
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "setDefaultMethod" && methodRow ? (
                  <>
                    <p className="wa-copy">
                      Make <b>{methodRow.label}</b> ({methodRow.detail}) the default
                      payout destination? New payout requests will pre-select it.
                    </p>
                    <Kv
                      rows={[
                        ["Provider", methodRow.provider],
                        ["Fee", methodRow.feeNote],
                        ["Verified", methodRow.verified ? "Yes" : "No"],
                        ["Current default", defaultMethod(data)?.label ?? "None"],
                      ]}
                    />
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--primary"
                        disabled={busy}
                        onClick={() => {
                          setPayoutMethodId(methodRow.id);
                          void run(
                            { kind: "setDefaultMethod", methodId: methodRow.id },
                            { title: `${methodRow.label} is now the default` },
                          );
                        }}
                      >
                        Make default
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={close}
                      >
                        Keep current
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "methodDetail" && methodRow ? (
                  <>
                    <div className="wa-modal-head">
                      <Icon name={methodIcon(methodRow.kind)} size={16} />
                      <b>{methodRow.label}</b>
                      <Tag tone={methodRow.verified ? "is-ok" : "is-pending"}>
                        {methodRow.verified ? "Verified" : "Unverified"}
                      </Tag>
                      {methodRow.isDefault ? <Tag tone="is-ok">Default</Tag> : null}
                    </div>
                    <Kv
                      rows={[
                        ["Type", methodKindLabel(methodRow.kind)],
                        ["Provider", methodRow.provider],
                        ["Details", <span className="mono" key="detail">{methodRow.detail}</span>],
                        ["Reference", <span className="mono" key="ref">{methodRow.reference}</span>],
                        ["Payout enabled", methodRow.payoutEnabled ? "Yes" : "Deposit only"],
                        ["Fee", methodRow.feeNote],
                        ["Added", atStamp(methodRow.addedAt)],
                        ["Per request", `${money(methodRow.limits.min)}–${money(methodRow.limits.max)}`],
                        ["Daily cap", money(methodRow.limits.daily)],
                        ["Note", methodRow.note || "—"],
                      ]}
                    />
                    <div className="wa-modal-actions">
                      {methodRow.isDefault ? null : (
                        <button
                          type="button"
                          className="wa-btn"
                          onClick={() => open("setDefaultMethod")}
                        >
                          Set as default
                        </button>
                      )}
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("removeMethod")}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("support")}
                      >
                        Report an issue
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "verification" ? (
                  <>
                    <Kv
                      rows={[
                        ["KYC level", <Tag tone="is-ok" key="kyc">{data.profile.kycLevel} verified</Tag>],
                        ["Verified on", dateOf(data.profile.kycVerifiedAt)],
                        ["Investor", `${data.profile.displayName} · ${data.profile.id}`],
                        ["Country", data.profile.country],
                        ["Tier", data.profile.tier],
                        ["Investor since", dateOf(data.profile.investorSince)],
                      ]}
                    />
                    <h4 className="wa-subhead">What your level unlocks</h4>
                    <ul className="wa-policy-list">
                      <li>
                        <b>Deposits</b>
                        <span>
                          Up to {money(MAX_DEPOSIT)} per deposit,{" "}
                          {money(DAILY_DEPOSIT_LIMIT)} per day.
                        </span>
                      </li>
                      <li>
                        <b>Payouts</b>
                        <span>
                          {money(MIN_PAYOUT)}–{money(MAX_PAYOUT)} per request to any
                          verified destination.
                        </span>
                      </li>
                      <li>
                        <b>Pools</b>
                        <span>Full access to open crowdfunding windows.</span>
                      </li>
                      <li>
                        <b>To raise a limit</b>
                        <span>
                          Message the treasury desk; the demo preview cannot
                          change KYC state.
                        </span>
                      </li>
                    </ul>
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--primary"
                        onClick={() => open("support")}
                      >
                        Request a higher limit
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("limits")}
                      >
                        See limits
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "limits" ? (
                  <>
                    <ul className="wa-limit-list">
                      {data.limits.map((limit) => (
                        <li key={limit.id} className={`is-${limit.state}`}>
                          <div>
                            <b>{limit.label}</b>
                            <small className="wa-muted">{limit.detail}</small>
                          </div>
                          <b className="mono">{limit.value}</b>
                        </li>
                      ))}
                    </ul>
                    <p className="wa-foot-note">
                      Daily figures are computed from the ledger, not stored
                      counters. State is recomputed after every command.
                    </p>
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            { kind: "acknowledge", scope: "limits" },
                            { title: "Limit schedule acknowledged" },
                          )
                        }
                      >
                        Acknowledge limits
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("verification")}
                      >
                        Verification
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "feeSchedule" ? (
                  <>
                    <h4 className="wa-subhead">Deposits</h4>
                    <div className="wa-table-wrap">
                      <table className="wa-table">
                        <thead>
                          <tr>
                            <th>Rail</th>
                            <th>Fee</th>
                            <th>Arrival</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.depositRails.map((rail) => (
                            <tr key={rail.key}>
                              <td>{rail.label}</td>
                              <td className="mono">{rail.feeNote}</td>
                              <td>{rail.eta}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <h4 className="wa-subhead">Payouts</h4>
                    <div className="wa-table-wrap">
                      <table className="wa-table">
                        <thead>
                          <tr>
                            <th>Destination</th>
                            <th>Fee</th>
                            <th>Timing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.methods
                            .filter((method) => method.payoutEnabled)
                            .map((method) => (
                              <tr key={method.id}>
                                <td>{methodKindLabel(method.kind)}</td>
                                <td className="mono">
                                  {money(payoutFee(1_000, method.kind), 2)} on $1,000
                                </td>
                                <td>{method.feeNote}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="wa-foot-note">
                      Bank fees are 0.6% clamped to $1.50–$12. Mobile money is 1.5%.
                      Crypto is a flat $2.20 network fee.
                    </p>
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            { kind: "acknowledge", scope: "fees" },
                            { title: "Fee schedule acknowledged" },
                          )
                        }
                      >
                        Acknowledge fees
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "preferences" ? (
                  <>
                    <ul className="wa-toggle-list">
                      {(
                        [
                          ["emailReceipts", "Email receipts", "Send a receipt after every deposit, payout and fee"],
                          ["autoPayout", "Auto-payout at maturity", "Queue a payout when a pool window closes"],
                          ["lowBalanceAlert", "Low balance alert", "Warn me when available cash falls under $100"],
                        ] as const
                      ).map(([key, label, detail]) => (
                        <li key={key}>
                          <div>
                            <b>{label}</b>
                            <small className="wa-muted">{detail}</small>
                          </div>
                          <input
                            type="checkbox"
                            checked={prefs[key]}
                            aria-label={label}
                            onChange={(event) =>
                              setPrefs((prev) => ({ ...prev, [key]: event.target.checked }))
                            }
                          />
                        </li>
                      ))}
                    </ul>
                    <label className="wa-field">
                      <span>Auto-payout threshold</span>
                      <input
                        type="number"
                        min={MIN_PAYOUT}
                        max={MAX_PAYOUT}
                        step={10}
                        value={prefs.payoutThreshold}
                        onChange={(event) =>
                          setPrefs((prev) => ({
                            ...prev,
                            payoutThreshold: Number(event.target.value) || MIN_PAYOUT,
                          }))
                        }
                      />
                      <small className="wa-muted">
                        Minimum {money(MIN_PAYOUT)}, maximum {money(MAX_PAYOUT)}.
                      </small>
                    </label>
                    {wizardStep === 1 ? (
                      <Kv
                        rows={[
                          ["Receipts", prefs.emailReceipts ? "On" : "Off"],
                          ["Auto-payout", prefs.autoPayout ? "On" : "Off"],
                          ["Threshold", money(prefs.payoutThreshold)],
                          ["Low balance alert", prefs.lowBalanceAlert ? "On" : "Off"],
                        ]}
                      />
                    ) : null}
                  </>
                ) : null}

                {modal.kind === "reconciliation" ? (
                  <>
                    <p className="wa-copy">
                      The statement is a single ledger. Opening balance plus every
                      signed movement equals available cash — the same arithmetic
                      the desk books at close.
                    </p>
                    <div className="wa-recon">
                      <div>
                        <span>Opening balance</span>
                        <b className="mono">{money(data.balance.openingBalance, 2)}</b>
                      </div>
                      <div>
                        <span>Deposits</span>
                        <b className="mono is-pos">
                          {signedMoney(data.lifetime.deposited, 2)}
                        </b>
                      </div>
                      <div>
                        <span>Pool funding</span>
                        <b className="mono is-fund">
                          {signedMoney(-data.lifetime.investedFromWallet, 2)}
                        </b>
                      </div>
                      <div>
                        <span>Earnings credited</span>
                        <b className="mono is-pos">
                          {signedMoney(data.lifetime.earnedCredited, 2)}
                        </b>
                      </div>
                      <div>
                        <span>Payouts &amp; fees</span>
                        <b className="mono is-debit">
                          {signedMoney(-(data.lifetime.withdrawn + data.lifetime.feesPaid), 2)}
                        </b>
                      </div>
                      <div>
                        <span>Refunds</span>
                        <b className="mono is-pos">
                          {signedMoney(data.lifetime.refunded, 2)}
                        </b>
                      </div>
                      <div className="is-total">
                        <span>Available cash</span>
                        <b className="mono">{money(data.balance.available, 2)}</b>
                      </div>
                    </div>
                    <Kv
                      rows={[
                        ["Rows in the ledger", String(data.transactions.length)],
                        ["First movement", data.transactions[0] ? atStamp(data.transactions[0].at) : "—"],
                        ["Last movement", data.transactions.at(-1) ? atStamp(data.transactions.at(-1)!.at) : "—"],
                        ["Reconciled at", atStamp(data.asOf)],
                        ["Revision", `r${data.revision}`],
                      ]}
                    />
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--primary"
                        onClick={() => open("statementExport")}
                      >
                        Export the reconciliation
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => setDrawer("statement")}
                      >
                        Open statement drawer
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "risk" ? (
                  <>
                    <ul className="wa-policy-list">
                      <li>
                        <b>Capital at risk</b>
                        <span>
                          Pool capital is deployed into live trades. Returns are
                          variable and losses can reduce the amount returned.
                        </span>
                      </li>
                      <li>
                        <b>Locked until close</b>
                        <span>
                          Booked capital cannot be withdrawn before the window
                          closes; only available cash can be paid out.
                        </span>
                      </li>
                      <li>
                        <b>Accrual is not cash</b>
                        <span>
                          Accrued pool earnings stay inside the position and are
                          only credited on settlement.
                        </span>
                      </li>
                      <li>
                        <b>Rails can fail</b>
                        <span>
                          A payout can be declined by the destination bank or
                          wallet; the amount then returns to available cash.
                        </span>
                      </li>
                    </ul>
                    <div className="wa-modal-actions">
                      <button
                        type="button"
                        className="wa-btn wa-btn--primary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            { kind: "acknowledge", scope: "risk" },
                            { title: "Risk disclosure acknowledged" },
                          )
                        }
                      >
                        Acknowledge disclosure
                      </button>
                      <button
                        type="button"
                        className="wa-btn wa-btn--ghost"
                        onClick={() => open("help")}
                      >
                        Boundaries
                      </button>
                    </div>
                  </>
                ) : null}

                {modal.kind === "support" ? (
                  <>
                    {wizardStep === 0 ? (
                      <>
                        <h4 className="wa-subhead">Topic</h4>
                        <div className="wa-chip-row" role="radiogroup" aria-label="Support topic">
                          {(
                            [
                              ["payout", "Payout"],
                              ["deposit", "Deposit"],
                              ["method", "Payment method"],
                              ["fees", "Fees"],
                              ["other", "Something else"],
                            ] as const
                          ).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              role="radio"
                              aria-checked={supportTopic === key}
                              className={`wa-chip ${supportTopic === key ? "is-on" : ""}`}
                              onClick={() => setSupportTopic(key)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {wizardStep === 1 ? (
                      <label className="wa-field">
                        <span>Message *</span>
                        <textarea
                          rows={6}
                          maxLength={1000}
                          value={supportMessage}
                          placeholder="Tell the treasury desk what you need and include a reference if you have one."
                          onChange={(event) => setSupportMessage(event.target.value)}
                        />
                        <small className="wa-muted">
                          {supportMessage.trim().length}/1000 · stored as a local
                          draft in this preview.
                        </small>
                      </label>
                    ) : null}
                    {wizardStep === 2 ? (
                      <>
                        <Kv
                          rows={[
                            ["Topic", supportTopic],
                            ["From", `${data.profile.displayName} · ${data.profile.email}`],
                            ["Reference", pendingPayout?.reference ?? "—"],
                            ["Message", supportMessage || "—"],
                          ]}
                        />
                        <p className="wa-foot-note">
                          No email is sent. The message is appended to the local
                          workspace audit so the flow stays inspectable.
                        </p>
                      </>
                    ) : null}
                    {stepBlockingError ? (
                      <p className="wa-hint-error">{stepBlockingError}</p>
                    ) : null}
                  </>
                ) : null}

                {modal.kind === "help" ? (
                  <>
                    <p className="wa-copy">
                      This is the I-7 wallet surface. It owns cash, payouts,
                      payment methods and the statement — nothing else. Positions,
                      booking and live tracking live on their own pages.
                    </p>
                    <ul className="wa-policy-list">
                      <li>
                        <b>What works here</b>
                        <span>
                          Deposit drafts, payout requests and cancellations, method
                          add/verify/default/remove, filters, exports, preferences
                          and acknowledgements — all against session state.
                        </span>
                      </li>
                      <li>
                        <b>What is deliberately local</b>
                        <span>
                          No bank, card network, mobile-money or chain provider is
                          contacted; no money moves; exports are generated in the
                          browser.
                        </span>
                      </li>
                      <li>
                        <b>Where the numbers come from</b>
                        <span>
                          One ledger in the wallet service, reconciled with the
                          I-6 investments workspace for locked capital and accrual.
                        </span>
                      </li>
                    </ul>
                    <div className="wa-modal-actions">
                      <Link className="wa-btn wa-btn--primary" href="/investor/investments">
                        My investments
                      </Link>
                      <Link className="wa-btn wa-btn--ghost" href="/investor/pools">
                        Crowdfunding pools
                      </Link>
                      <Link className="wa-btn wa-btn--ghost" href="/investor/live">
                        Live trade tracker
                      </Link>
                    </div>
                  </>
                ) : null}
              </DeskModalShell>
            </div>
          ) : null}
        </div>
    </InvestorShell>
  );
}
