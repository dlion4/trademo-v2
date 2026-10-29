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
import { Icon, type IconName } from "@/components/icons";
import { createDeskColumnHelper, useDeskTable, type SortingState } from "@/lib/dashboard/table";
import {
  EARNINGS_AS_OF,
  EARNINGS_PERIODS,
  FISCAL_YEAR,
  MAX_EXPORTS,
  MAX_SUPPORT_DRAFTS,
  PLATFORM_CUT_PCT,
  clockShort,
  csvOf,
  dayLabel,
  earningsSection,
  exportMatrix,
  formatLabel,
  jurisdictionLabel,
  money,
  monthProgress,
  pct,
  periodLabel,
  poolTotals,
  reportKindLabel,
  reportStatusTone,
  round2,
  scopeLabel,
  shortDateOf,
  signed,
  timelineTone,
  timelineView,
  topicLabel,
  type EarningsCommand,
  type EarningsPeriod,
  type EarningsWorkspace,
  type ExportFormat,
  type ExportScope,
  type FormulaSample,
  type JurisdictionCode,
  type PayoutRow,
  type PoolEarnings,
  type ReportKind,
  type ReportRow,
  type StatementPreferences,
  type SupportTopic,
  type TimelineDay,
} from "@/lib/investor/earnings";
import { useEarnings } from "@/lib/investor/use-earnings";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  InvestorShell,
  type InvestorDrawerTab,
  type InvestorNavKey,
  type InvestorQuickAction,
} from "./investor-shell";

/* ── Dialog registry ── */

type Kind =
  | "exportWizard"
  | "reportWizard"
  | "taxWizard"
  | "preferencesWizard"
  | "emailWizard"
  | "reconcileWizard"
  | "supportWizard"
  | "kpiDetail"
  | "methodology"
  | "poolDetail"
  | "poolStatement"
  | "formulaDetail"
  | "samplePicker"
  | "reconcileLog"
  | "timelineDetail"
  | "timelineRules"
  | "forecast"
  | "forecastAssumptions"
  | "monthProgress"
  | "lifetimeBreakdown"
  | "taxNotes"
  | "taxJurisdiction"
  | "taxChecklist"
  | "taxDocuments"
  | "reportsLibrary"
  | "reportDetail"
  | "payoutLedger"
  | "exportShelf"
  | "auditTrail"
  | "boundaries"
  | "resetDesk";

const titles: Record<Kind, string> = {
  exportWizard: "Export earnings data",
  reportWizard: "Generate a report",
  taxWizard: "Build the tax pack",
  preferencesWizard: "Statement preferences",
  emailWizard: "Email this statement",
  reconcileWizard: "Reconcile a position",
  supportWizard: "Ask the earnings desk",
  kpiDetail: "How this figure is built",
  methodology: "How every figure is derived",
  poolDetail: "Position detail",
  poolStatement: "Position statement",
  formulaDetail: "Profit-sharing formula",
  samplePicker: "Trace another pool",
  reconcileLog: "Reconciliation log",
  timelineDetail: "Timeline day",
  timelineRules: "How the timeline is built",
  forecast: "Earnings forecast",
  forecastAssumptions: "Forecast assumptions",
  monthProgress: "October progress",
  lifetimeBreakdown: "Lifetime build-up",
  taxNotes: "Tax lines, line by line",
  taxJurisdiction: "Jurisdiction requirements",
  taxChecklist: "Filing checklist",
  taxDocuments: "Tax documents on file",
  reportsLibrary: "Report library",
  reportDetail: "Report detail",
  payoutLedger: "Payout ledger",
  exportShelf: "Export shelf",
  auditTrail: "Earnings desk audit",
  boundaries: "What this desk can and cannot do",
  resetDesk: "Reset the demo desk",
};

const wizardSteps: Partial<Record<Kind, readonly string[]>> = {
  exportWizard: ["Scope", "Format", "Confirm"],
  reportWizard: ["Report", "Period", "Confirm"],
  taxWizard: ["Year", "Jurisdiction", "Confirm"],
  preferencesWizard: ["Cadence", "Delivery", "Confirm"],
  emailWizard: ["Recipient", "Attach", "Confirm"],
  reconcileWizard: ["Position", "Checks", "Confirm"],
  supportWizard: ["Topic", "Message", "Confirm"],
};

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  exportWizard: "lg",
  reportWizard: "md",
  taxWizard: "md",
  preferencesWizard: "lg",
  emailWizard: "md",
  reconcileWizard: "md",
  supportWizard: "md",
  kpiDetail: "md",
  methodology: "lg",
  poolDetail: "lg",
  poolStatement: "xl",
  formulaDetail: "lg",
  samplePicker: "md",
  reconcileLog: "lg",
  timelineDetail: "md",
  timelineRules: "md",
  forecast: "lg",
  forecastAssumptions: "md",
  monthProgress: "md",
  lifetimeBreakdown: "md",
  taxNotes: "lg",
  taxJurisdiction: "md",
  taxChecklist: "md",
  taxDocuments: "md",
  reportsLibrary: "xl",
  reportDetail: "md",
  payoutLedger: "lg",
  exportShelf: "md",
  auditTrail: "lg",
  boundaries: "lg",
  resetDesk: "sm",
};

const quickActions: InvestorQuickAction[] = [
  { key: "export", label: "Export earnings data", short: "Export", icon: "download" },
  { key: "report", label: "Generate a report", short: "Report", icon: "file" },
  { key: "tax", label: "Build the tax pack", short: "Tax pack", icon: "shield" },
  { key: "forecast", label: "Earnings forecast", short: "Forecast", icon: "trendUp" },
  { key: "reconcile", label: "Reconcile a position", short: "Reconcile", icon: "check" },
  { key: "preferences", label: "Statement preferences", short: "Settings", icon: "sliders" },
  { key: "support", label: "Ask the earnings desk", short: "Support", icon: "mail" },
];

const sections = [
  { key: "overview", label: "Overview", id: "ea-overview" },
  { key: "pools", label: "By pool", id: "ea-pools" },
  { key: "timeline", label: "Timeline", id: "ea-timeline" },
  { key: "tax", label: "Tax", id: "ea-tax" },
  { key: "formula", label: "Formula", id: "ea-formula" },
] as const;

const exportScopes: { key: ExportScope; label: string; hint: string }[] = [
  { key: "overview", label: "Overview figures", hint: "The six KPIs with their derivations" },
  { key: "by-pool", label: "Per-pool breakdown", hint: "Invested, gross, cut, net and ROI per cycle" },
  { key: "timeline", label: "Daily timeline", hint: "Every accrual and settlement day in the window" },
  { key: "tax", label: "Tax workbook", hint: "Gross, cut, net, withdrawn and locked lines" },
  { key: "fees", label: "Fee ledger", hint: "What the platform took, per pool" },
  { key: "payouts", label: "Payout ledger", hint: "Every withdrawal with its fee and reference" },
];

const exportFormats: { key: ExportFormat; label: string; hint: string }[] = [
  { key: "csv", label: "CSV", hint: "Downloads immediately — opens in any spreadsheet" },
  { key: "json", label: "JSON", hint: "Structured rows, one object per line" },
  { key: "pdf", label: "PDF", hint: "Print-ready matrix of the same rows" },
];

const supportTopics: { key: SupportTopic; label: string; hint: string }[] = [
  { key: "earnings", label: "An earnings figure", hint: "A number here does not match the pool page" },
  { key: "tax", label: "A tax question", hint: "Forms, resident status, filing windows" },
  { key: "payout", label: "A payout", hint: "Timing, fees or a returned transfer" },
  { key: "report", label: "A report or export", hint: "A file is missing, stale or wrong" },
  { key: "other", label: "Something else", hint: "Anything the earnings desk should know" },
];

const reportKinds: { key: ReportKind; label: string; hint: string }[] = [
  { key: "monthly", label: "Monthly statement", hint: "One page per month of accruals and settlements" },
  { key: "cycle", label: "Cycle settlement", hint: "Final pool P&L with your share and the cut" },
  { key: "annual", label: "Annual summary", hint: "Year-to-date, the filing companion" },
  { key: "tax", label: "Tax pack", hint: "The nine tax lines plus jurisdiction notes" },
  { key: "accrual", label: "Accrual register", hint: "Every unsettled day, for auditors" },
  { key: "payout", label: "Payout ledger", hint: "Withdrawals, fees and bank references" },
];

const jurisdictions: JurisdictionCode[] = ["US", "UK", "KE", "ZA"];

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
    <header className="ea-section-head">
      <div>
        <span className="ea-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="ea-section-aside">{aside}</div> : null}
    </header>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
  decimals = 2,
  prefix = "$",
  suffix = "",
  delay = 0,
  onDetail,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "is-pos" | "is-accent" | "is-cut" | "";
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  onDetail?: () => void;
}) {
  const shown = useLiveCountUp(value);
  return (
    <div className="ea-figure" style={{ "--ea-delay": `${delay}ms` } as CSSProperties}>
      <span className="ea-figure__label">{label}</span>
      <b className={`ea-figure__value mono ${tone ?? ""}`}>
        {prefix}
        {shown.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix}
      </b>
      {hint ? <span className="ea-figure__hint">{hint}</span> : null}
      {onDetail ? (
        <button type="button" className="ea-figure__more" onClick={onDetail}>
          How it is built <Icon name="arrowRight" size={11} />
        </button>
      ) : null}
    </div>
  );
}

function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="ea-kv">
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
  return <span className={`ea-tag ${tone}`.trim()}>{children}</span>;
}

function Bar({ value, target, tone = "" }: { value: number; target: number; tone?: string }) {
  const width = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <span className={`ea-bar ${tone}`} aria-hidden="true">
      <span className="ea-bar__fill" style={{ width: `${width}%` }} />
    </span>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={`ea-toggle ${checked ? "is-on" : ""}`}>
      <span className="ea-toggle__text">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="ea-toggle__track" aria-hidden="true">
        <span className="ea-toggle__thumb" />
      </span>
    </label>
  );
}

const poolTone = (pool: PoolEarnings) => (pool.status === "live" ? "is-live" : "is-done");

/* ── Page ── */

export function InvestorEarningsPage({
  initial,
  initialAction,
}: {
  initial: EarningsWorkspace;
  initialAction?: string;
}) {
  const router = useRouter();
  const desk = useEarnings(initial);

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
    export: "exportWizard",
    download: "exportWizard",
    report: "reportWizard",
    generate: "reportWizard",
    tax: "taxWizard",
    "tax-pack": "taxWizard",
    preferences: "preferencesWizard",
    settings: "preferencesWizard",
    email: "emailWizard",
    reconcile: "reconcileWizard",
    support: "supportWizard",
    help: "supportWizard",
    kpi: "kpiDetail",
    methodology: "methodology",
    rules: "methodology",
    pool: "poolDetail",
    statement: "poolStatement",
    formula: "formulaDetail",
    sample: "samplePicker",
    "reconcile-log": "reconcileLog",
    day: "timelineDetail",
    timeline: "timelineRules",
    forecast: "forecast",
    assumptions: "forecastAssumptions",
    month: "monthProgress",
    lifetime: "lifetimeBreakdown",
    lines: "taxNotes",
    jurisdiction: "taxJurisdiction",
    checklist: "taxChecklist",
    documents: "taxDocuments",
    library: "reportsLibrary",
    file: "reportDetail",
    payouts: "payoutLedger",
    exports: "exportShelf",
    audit: "auditTrail",
    boundaries: "boundaries",
    reset: "resetDesk",
  };

  const [modal, setModal] = useState<{ kind: Kind } | null>(() => {
    const kind = initialAction ? actionMap[initialAction] : undefined;
    return kind ? { kind } : null;
  });
  const [wizardStep, setWizardStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<"overview" | "pools" | "tax" | null>(null);
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("earnings");
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [copied, setCopied] = useState(false);

  /* Selections */
  const [selectedPoolId, setSelectedPoolId] = useState(initial.pools[0]?.id ?? "");
  const [selectedDayId, setSelectedDayId] = useState(initial.timeline[0]?.id ?? "");
  const [selectedReportId, setSelectedReportId] = useState(initial.reports[0]?.id ?? "");
  const [selectedPayoutId, setSelectedPayoutId] = useState(initial.payouts[0]?.id ?? "");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<JurisdictionCode>(
    initial.profile.jurisdiction,
  );
  const [selectedKpi, setSelectedKpi] = useState(initial.overview[0]?.key ?? "lifetime");

  /* Drafts */
  const [exportScope, setExportScope] = useState<ExportScope>("overview");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [reportKind, setReportKind] = useState<ReportKind>("monthly");
  const [draftPrefs, setDraftPrefs] = useState<StatementPreferences>(initial.preferences);
  const [taxYear, setTaxYear] = useState(FISCAL_YEAR);
  const [taxFormat, setTaxFormat] = useState<"pdf" | "csv">("pdf");
  const [emailTo, setEmailTo] = useState(initial.preferences.deliveryEmail);
  const [supportTopic, setSupportTopic] = useState<SupportTopic>("earnings");
  const [supportMessage, setSupportMessage] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [payoutSorting, setPayoutSorting] = useState<SortingState>([]);

  /* ── Derived ── */

  const data = desk.workspace;
  const asOf = data.asOf;
  const pools = desk.byPool.data?.pools ?? data.pools;
  const totals = desk.byPool.data?.totals ?? poolTotals(pools);
  const month = monthProgress(data);
  const view = desk.timeline.data ?? timelineView(data.timeline, desk.period, asOf);
  const tax = desk.taxReport.data ?? earningsSection(data, "tax-report");
  const formulaData = desk.formula.data ?? data.formula;
  const library = desk.library.data ?? earningsSection(data, "library");
  const prefs = data.preferences;
  const kpis = desk.overview.data?.kpis ?? data.overview;

  const selectedPool = pools.find((row) => row.id === selectedPoolId) ?? pools[0];
  const selectedDay =
    data.timeline.find((row) => row.id === selectedDayId) ?? view.rows[view.rows.length - 1];
  const selectedReport = library.reports.find((row) => row.id === selectedReportId) ?? library.reports[0];
  const selectedPayout = library.payouts.find((row) => row.id === selectedPayoutId) ?? library.payouts[0];
  const selectedSample =
    formulaData.samples.find((row) => row.poolCode === selectedPool?.code) ??
    formulaData.samples[0] ??
    null;
  const kpi = kpis.find((row) => row.key === selectedKpi) ?? kpis[0];
  const jurisdictionRow =
    tax.jurisdictions.find((entry) => entry.code === selectedJurisdiction) ?? tax.jurisdictions[0];
  const preview = useMemo(() => exportMatrix(data, exportScope, desk.period), [data, exportScope, desk.period]);
  const periodSummary = view;

  const supportError =
    supportMessage.trim().length >= 12
      ? ""
      : "Tell the desk what happened in at least 12 characters";
  const emailError = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTo.trim())
    ? ""
    : "Enter a valid email address";
  const prefsError =
    draftPrefs.deliveryEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draftPrefs.deliveryEmail.trim())
      ? "Delivery email is not a valid address"
      : "";
  const reconcileError = selectedPool ? "" : "Pick a position first";

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
    command: EarningsCommand,
    opts?: {
      title?: string;
      detail?: string;
      keep?: boolean;
      tone?: "success" | "info" | "warning" | "error";
    },
  ) {
    setBusy(true);
    setError("");
    try {
      await desk.command.mutateAsync(command);
      pushToast({
        tone: opts?.tone ?? "success",
        title: opts?.title ?? "Earnings desk updated",
        detail:
          opts?.detail ??
          "Held in this demo snapshot. Nothing left the building and no payout was triggered.",
      });
      if (!opts?.keep) close();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change could not be applied");
      return false;
    } finally {
      setBusy(false);
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

  async function copyStatement() {
    const text = csvOf(preview);
    try {
      await navigator.clipboard.writeText(text);
      pushToast({ tone: "success", title: "Statement copied", detail: `${preview.rows.length} rows on the clipboard` });
    } catch {
      pushToast({
        tone: "info",
        title: "Clipboard blocked",
        detail: "Download the CSV instead — the same rows are in it.",
      });
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function downloadCsv(scope: ExportScope = exportScope) {
    setBusy(true);
    setError("");
    try {
      const envelope = await desk.exportCSV.mutateAsync({ scope, period: desk.period });
      download(envelope.csv ?? "", envelope.filename, "text/csv");
      pushToast({
        tone: "success",
        title: `${scopeLabel(scope)} · CSV`,
        detail: `${envelope.rows} rows · ${envelope.filename}`,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The export failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(scope: ExportScope = exportScope) {
    setBusy(true);
    setError("");
    try {
      const envelope = await desk.exportPDF.mutateAsync({ scope, period: desk.period });
      download(
        JSON.stringify(
          { scope, generatedAt: envelope.generatedAt ?? asOf, ...envelope.matrix },
          null,
          2,
        ),
        envelope.filename,
        "application/json",
      );
      pushToast({
        tone: "success",
        title: `${scopeLabel(scope)} · PDF`,
        detail: `${envelope.rows} rows · ${envelope.pages ?? 1} page${(envelope.pages ?? 1) === 1 ? "" : "s"} · ${envelope.filename}`,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The export failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadTax(format: "pdf" | "csv", year = taxYear) {
    setBusy(true);
    setError("");
    try {
      const envelope = await desk.downloadTaxReport.mutateAsync({ format, year });
      if (format === "csv") {
        download(envelope.csv ?? "", envelope.filename, "text/csv");
      } else {
        download(
          JSON.stringify(
            { year, generatedAt: asOf, ...envelope.matrix },
            null,
            2,
          ),
          envelope.filename,
          "application/json",
        );
      }
      pushToast({
        tone: "success",
        title: `Tax pack ${year} · ${format.toUpperCase()}`,
        detail: `${envelope.reference} · ${envelope.rows} lines · stored in Tax documents on file`,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The tax pack could not be generated");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    await run(
      { kind: "refresh" },
      {
        title: "Accruals recomputed",
        detail: `${data.pools.length} positions re-derived at ${clockShort(asOf)} UTC · next pass in ${formulaData.refreshSeconds / 60} minutes`,
        keep: true,
        tone: "info",
      },
    );
  }

  function advance() {
    setWizardStep((step) => Math.min(lastStep, step + 1));
  }

  const stepBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "supportWizard" && wizardStep === 1) return supportError;
    if (modal.kind === "emailWizard" && wizardStep === 0) return emailError;
    if (modal.kind === "preferencesWizard" && wizardStep === 2) return prefsError;
    if (modal.kind === "exportWizard" && wizardStep === 0)
      return preview.rows.length ? "" : "That scope has no rows to export";
    if (modal.kind === "reconcileWizard" && wizardStep === 0) return reconcileError;
    return "";
  })();

  const needsAck = modal?.kind === "resetDesk";

  const submitBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "supportWizard") return supportError;
    if (modal.kind === "emailWizard") return emailError;
    if (modal.kind === "preferencesWizard") return prefsError;
    if (modal.kind === "reconcileWizard") return reconcileError;
    return "";
  })();

  const submitLabel = !modal
    ? "Done"
    : modal.kind === "exportWizard"
      ? `Export ${formatLabel(exportFormat)}`
      : modal.kind === "reportWizard"
        ? "Generate report"
        : modal.kind === "taxWizard"
          ? `Build ${taxFormat.toUpperCase()} pack`
          : modal.kind === "preferencesWizard"
            ? "Save preferences"
            : modal.kind === "emailWizard"
              ? "Email the statement"
              : modal.kind === "reconcileWizard"
                ? "Reconcile position"
                : modal.kind === "supportWizard"
                  ? "Send to desk"
                  : modal.kind === "resetDesk"
                    ? "Reset the desk"
                    : "Close";

  async function submit() {
    if (!modal) return;

    if (modal.kind === "exportWizard") {
      if (exportFormat === "csv") {
        await downloadCsv(exportScope);
        return;
      }
      if (exportFormat === "pdf") {
        await downloadPdf(exportScope);
        return;
      }
      const ok = await run(
        { kind: "exportReport", scope: exportScope, format: "json", period: desk.period },
        {
          title: `${scopeLabel(exportScope)} · JSON`,
          detail: `${preview.rows.length} rows kept on the export shelf`,
          keep: true,
        },
      );
      if (!ok) return;
      download(
        JSON.stringify({ scope: exportScope, generatedAt: asOf, ...preview }, null, 2),
        `trademo-${exportScope}-${asOf.slice(0, 10)}.json`,
        "application/json",
      );
      close();
      return;
    }

    if (modal.kind === "reportWizard") {
      await run(
        { kind: "generateReport", reportKind, period: desk.period, format: "pdf" },
        {
          title: `${reportKindLabel(reportKind)} generated`,
          detail: `${periodLabel(desk.period)} · stored in the report library`,
        },
      );
      return;
    }

    if (modal.kind === "taxWizard") {
      const ok = await run(
        {
          kind: "savePreferences",
          defaultPeriod: prefs.defaultPeriod,
          jurisdiction: selectedJurisdiction,
          includeLosses: prefs.includeLosses,
          includeAccrual: prefs.includeAccrual,
          rounding: prefs.rounding,
          deliveryEmail: prefs.deliveryEmail,
          autoMonthly: prefs.autoMonthly,
        },
        { title: "Jurisdiction pinned", detail: jurisdictionLabel(selectedJurisdiction), keep: true, tone: "info" },
      );
      if (!ok) return;
      await downloadTax(taxFormat, taxYear);
      return;
    }

    if (modal.kind === "preferencesWizard") {
      try {
        await desk.saveStatement({ ...draftPrefs, jurisdiction: draftPrefs.jurisdiction });
        pushToast({
          tone: "success",
          title: "Statement preferences saved",
          detail: `${periodLabel(draftPrefs.defaultPeriod)} default · ${jurisdictionLabel(draftPrefs.jurisdiction)} · ${draftPrefs.autoMonthly ? "auto monthly" : "manual"}`,
        });
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Preferences could not be saved");
      }
      return;
    }

    if (modal.kind === "emailWizard") {
      await run(
        { kind: "emailStatement", year: taxYear, email: emailTo.trim() },
        {
          title: `Statement queued for ${emailTo.trim()}`,
          detail: `Fiscal year ${taxYear} · ${taxFormat.toUpperCase()} attachment · nothing is actually emailed in this demo`,
          tone: "info",
        },
      );
      return;
    }

    if (modal.kind === "reconcileWizard") {
      if (!selectedPool) {
        setError("Pick a position first");
        return;
      }
      try {
        await desk.reconcile.mutateAsync(selectedPool.id);
        pushToast({
          tone: "success",
          title: `${selectedPool.code} reconciled`,
          detail: `${money(selectedPool.net, 2)} net against the pool ledger — matched on gross, cut and payout reference`,
        });
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "The position could not be reconciled");
      }
      return;
    }

    if (modal.kind === "supportWizard") {
      const ok = await run(
        { kind: "support", topic: supportTopic, message: supportMessage.trim() },
        {
          title: "Draft logged for the desk",
          detail: `${topicLabel(supportTopic)} · ${supportMessage.trim().length} characters`,
        },
      );
      if (ok) setSupportMessage("");
      return;
    }

    if (modal.kind === "resetDesk") {
      await run(
        { kind: "clearExports" },
        {
          title: "Export shelf cleared",
          detail: "Every local export was removed — the workspace itself is untouched.",
          tone: "info",
        },
      );
      return;
    }

    close();
  }

  const modalFooter = (
    <>
      {wizard && wizardStep === lastStep && needsAck ? (
        <label className="ea-check ea-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-label="Confirm this local preview"
          />
          Clear every export and local preference draft in this session.
        </label>
      ) : null}
      {wizard ? (
        <span className="ea-muted">Demo desk · figures stay local</span>
      ) : null}
      <button type="button" className="ea-btn" onClick={close}>
        Close
      </button>
      {wizard && wizardStep > 0 ? (
        <button
          type="button"
          className="ea-btn"
          onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
        >
          <Icon name="arrowLeft" size={13} /> Back
        </button>
      ) : null}
      {wizard && wizardStep < lastStep ? (
        <button
          type="button"
          className="ea-btn ea-btn--primary"
          onClick={advance}
          disabled={busy || Boolean(stepBlockingError)}
          data-action="wizard-next"
        >
          Continue <Icon name="arrowRight" size={13} />
        </button>
      ) : null}
      {wizard && wizardStep === lastStep ? (
        <button
          type="button"
          className="ea-btn ea-btn--primary"
          disabled={busy || (needsAck && !confirmed) || Boolean(submitBlockingError)}
          onClick={() => void submit()}
          data-action="wizard-submit"
        >
          {busy ? "Working…" : submitLabel}
        </button>
      ) : null}
      {!wizard && modal && ["reportDetail", "exportShelf"].includes(modal.kind) ? (
        <button
          type="button"
          className="ea-btn ea-btn--primary"
          disabled={busy}
          onClick={() => void submit()}
          data-action="dialog-submit"
        >
          {busy ? "Working…" : "Keep it"}
        </button>
      ) : null}
    </>
  );

  /* ── Desk tables (TanStack) ── */

  const reportColumn = useMemo(() => createDeskColumnHelper<ReportRow>(), []);
  const reportColumns = useMemo(
    () =>
      reportColumn.columns([
        reportColumn.accessor("title", { header: "Report" }),
        reportColumn.accessor("kind", { header: "Kind" }),
        reportColumn.accessor("period", { header: "Period" }),
        reportColumn.accessor("format", { header: "Format" }),
        reportColumn.accessor("status", { header: "Status" }),
      ]),
    [reportColumn],
  );

  const reportsTable = useDeskTable({
    data: library.reports,
    columns: reportColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
  });

  const payoutColumn = useMemo(() => createDeskColumnHelper<PayoutRow>(), []);
  const payoutColumns = useMemo(
    () =>
      payoutColumn.columns([
        payoutColumn.accessor("reference", { header: "Reference" }),
        payoutColumn.accessor("poolCode", { header: "Pool" }),
        payoutColumn.accessor("net", { header: "Net to you" }),
        payoutColumn.accessor("status", { header: "Status" }),
        payoutColumn.accessor("paidAt", { header: "Paid" }),
      ]),
    [payoutColumn],
  );

  const payoutsTable = useDeskTable({
    data: library.payouts,
    columns: payoutColumns,
    state: { sorting: payoutSorting },
    onSortingChange: setPayoutSorting,
    getRowId: (row) => row.id,
  });

  /* ── Render ── */

  return (
    <InvestorShell
      rootClass="page-investor-earnings"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.joinedAt}`}
      poolBookValue={data.profile.committed}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.profile.wallet}
      unread={data.profile.unread}
      activeNav={activeNav}
      detailHref={selectedPool?.poolHref ?? "/investor/pools"}
      bookHref="/investor/pools/pkg_02/book"
      quickActions={quickActions}
      onNavigate={(key) => {
        setActiveNav(key);
        if (key === "overview") return router.push("/investor");
        if (key === "pools" || key === "detail" || key === "upcoming") return router.push("/investor/pools");
        if (key === "book") return router.push("/investor/pools/pkg_02/book");
        if (key === "live") return router.push("/investor/live");
        if (key === "portfolio") return router.push("/investor/investments");
        if (key === "earnings") return jumpTo("overview", "ea-overview");
        if (key === "wallet") return router.push("/investor/wallet");
        if (key === "calculator") return router.push("/investor/calculator");
        if (key === "notifications") return router.push("/investor/notifications");
        if (key === "referrals") return router.push("/investor/referrals");
        if (key === "activity") return jumpTo("timeline", "ea-timeline");
        if (key === "settings") return open("preferencesWizard");
        return setDrawer("overview");
      }}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(tab === "portfolio" ? "pools" : tab === "activity" ? "overview" : "tax")
      }
      onQuickAction={(key) => {
        if (key === "export") return open("exportWizard");
        if (key === "report") return open("reportWizard");
        if (key === "tax") return open("taxWizard");
        if (key === "forecast") return open("forecast");
        if (key === "reconcile") return open("reconcileWizard");
        if (key === "preferences") return open("preferencesWizard");
        if (key === "support") return open("supportWizard");
      }}
      onChromeReady={(chromeApi) => {
        chrome.current = chromeApi;
      }}
      onOpenNotifications={() => router.push("/investor/notifications")}
    >
      <div className="ea-page">
        <header className="ea-hero">
          <div className="ea-hero__main">
            <span className="ea-eyebrow">I-11 · INVESTOR WORKSPACE / EARNINGS &amp; REPORTS</span>
            <h1>Earnings &amp; reports</h1>
            <p className="ea-lede">
              Every dollar here is arithmetic over the position book, not a typed
              number: gross minus the {PLATFORM_CUT_PCT}% platform cut is net, the
              five positions add to {money(totals.net, 2)}, and the daily timeline
              lands on exactly that figure. Use the desk to trace a position, read
              the tax picture, or export the same rows your accountant would ask
              for.
            </p>

            <div className="ea-stamp">
              <span className="ea-stamp__dot" aria-hidden="true" />
              <span className="mono">
                Snapshot {dayLabel(asOf.slice(0, 10))} · {clockShort(asOf)} UTC · revision {data.revision}
              </span>
              <span className="ea-stamp__sep" aria-hidden="true">
                /
              </span>
              <span>
                Accruals recompute every {formulaData.refreshSeconds / 60} minutes —{" "}
                <b className="mono">{money(totals.live, 2)}</b> is still accruing
              </span>
              <div className="ea-stamp__actions">
                <button type="button" className="ea-btn ea-btn--sm" onClick={() => void refresh()}>
                  <Icon name="refresh" size={12} /> Refresh accruals
                </button>
                <button type="button" className="ea-btn ea-btn--sm" onClick={() => open("exportWizard")}>
                  <Icon name="download" size={12} /> Export
                </button>
              </div>
            </div>

            <div className="ea-hero__figures">
              <Figure
                label="Lifetime net"
                value={totals.net}
                tone="is-pos"
                hint={`${totals.positions} positions · ${totals.livePositions} live`}
                delay={40}
                onDetail={() => open("lifetimeBreakdown")}
              />
              <Figure
                label="Accruing now"
                value={totals.live}
                tone="is-accent"
                hint="PKG-01 · PKG-03, unsettled"
                delay={90}
              />
              <Figure
                label="Settled & paid"
                value={totals.completed}
                hint="Three cycles, three payouts"
                delay={140}
              />
              <Figure
                label="Platform fees paid"
                value={totals.cut}
                tone="is-cut"
                hint={`${PLATFORM_CUT_PCT}% of ${money(totals.gross, 0)} gross`}
                delay={190}
              />
              <Figure
                label="October ROI"
                value={data.profile.monthRoiPct}
                prefix="+"
                suffix="%"
                tone="is-accent"
                hint={`On ${money(data.profile.committed, 0)} committed`}
                delay={240}
              />
            </div>
          </div>

          <aside className="ea-hero__side">
            <div className="ea-hero__panel">
              <span className="ea-panel-label">The statement at a glance</span>
              <ul className="ea-today">
                <li>
                  <span className="ea-today__icon is-live">
                    <Icon name="trendUp" size={14} />
                  </span>
                  <span className="ea-today__text">
                    <strong>{money(month.net, 2)} earned in October</strong>
                    <small className="mono">
                      {month.sharePct.toFixed(1)}% of lifetime · {month.daysElapsed}/{month.daysInMonth} days
                    </small>
                  </span>
                  <button
                    type="button"
                    className="ea-icon-btn"
                    aria-label="October progress"
                    onClick={() => open("monthProgress")}
                  >
                    <Icon name="arrowRight" size={13} />
                  </button>
                </li>
                <li>
                  <span className="ea-today__icon is-fee">
                    <Icon name="split" size={14} />
                  </span>
                  <span className="ea-today__text">
                    <strong>{money(totals.avgNet, 2)} average per position</strong>
                    <small className="mono">
                      best {totals.best?.code} {signed(totals.best?.net ?? 0, 2)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="ea-icon-btn"
                    aria-label="Lifetime build-up"
                    onClick={() => open("lifetimeBreakdown")}
                  >
                    <Icon name="arrowRight" size={13} />
                  </button>
                </li>
                <li>
                  <span className="ea-today__icon is-tax">
                    <Icon name="shield" size={14} />
                  </span>
                  <span className="ea-today__text">
                    <strong>{jurisdictionLabel(selectedJurisdiction)} · {tax.filingWindow}</strong>
                    <small className="mono">{tax.reference} · readied 19 Oct</small>
                  </span>
                  <button
                    type="button"
                    className="ea-icon-btn"
                    aria-label="Tax checklist"
                    onClick={() => open("taxChecklist")}
                  >
                    <Icon name="arrowRight" size={13} />
                  </button>
                </li>
              </ul>
              <div className="ea-hero__panel-actions">
                <button type="button" className="ea-btn ea-btn--primary" onClick={() => open("exportWizard")}>
                  <Icon name="download" size={13} /> Export data
                </button>
                <button type="button" className="ea-btn" onClick={() => open("taxWizard")}>
                  <Icon name="file" size={13} /> Tax pack
                </button>
              </div>
              <p className="ea-note">
                <Icon name="info" size={12} /> Figures are pinned to the position
                book at {clockShort(asOf)} UTC on {shortDateOf(asOf)}. The wallet
                balance lives on I-7; this desk only reads it.
              </p>
            </div>
          </aside>
        </header>

        {/* ── 1 · earnings overview ── */}
        <section className="ea-section" id="ea-overview">
          <SectionHead
            code="1 / Earnings overview"
            title="Six figures, one ledger"
            hint="Lifetime, this month, the average, the best and lowest pool, and the return on deployed capital. Each cell opens the arithmetic behind it."
            aside={
              <>
                <button type="button" className="ea-btn" onClick={() => open("methodology")}>
                  <Icon name="script" size={13} /> Methodology
                </button>
                <button type="button" className="ea-btn" onClick={() => open("lifetimeBreakdown")}>
                  <Icon name="chart" size={13} /> Build-up
                </button>
              </>
            }
          />

          <div className="ea-kpis">
            {kpis.map((row, index) => (
              <button
                key={row.key}
                type="button"
                className={`ea-kpi ${row.tone}`}
                style={{ "--ea-delay": `${index * 60}ms` } as CSSProperties}
                onClick={() =>
                  open("kpiDetail", () => {
                    setSelectedKpi(row.key);
                  })
                }
              >
                <span className="ea-kpi__label">{row.label}</span>
                <b className="ea-kpi__value mono">
                  {row.prefix}
                  {row.value.toLocaleString("en-US", {
                    minimumFractionDigits: row.decimals,
                    maximumFractionDigits: row.decimals,
                  })}
                  {row.suffix ?? ""}
                </b>
                <span className="ea-kpi__hint">{row.hint}</span>
                <span className="ea-kpi__more">
                  <Icon name="info" size={11} /> Detail
                </span>
              </button>
            ))}
          </div>

          <div className="ea-overview-strip">
            <div className="ea-mini">
              <div className="ea-mini__head">
                <span className="ea-panel-label">October progress</span>
                <b className="mono">{money(month.net, 2)}</b>
              </div>
              <Bar value={month.net} target={totals.net} tone="is-accent" />
              <p>
                {month.sharePct.toFixed(1)}% of the lifetime total, {month.daysElapsed} of{" "}
                {month.daysInMonth} days in. {month.settled > 0
                  ? `${money(month.settled, 2)} settled, `
                  : ""}
                {money(month.accrued, 2)} accrued and unsettled.
              </p>
              <button type="button" className="ea-link" onClick={() => open("monthProgress")}>
                Open October <Icon name="arrowRight" size={11} />
              </button>
            </div>

            <div className="ea-mini">
              <div className="ea-mini__head">
                <span className="ea-panel-label">Settlement pace</span>
                <b className="mono">{money(month.accrued / Math.max(1, month.daysElapsed), 2)}/day</b>
              </div>
              <Bar value={month.accrued} target={Math.max(1, totals.live)} tone="is-live" />
              <p>
                {money(totals.live, 2)} is still accruing across two live cycles;{" "}
                {money(totals.completed, 2)} has already settled and been paid out.
              </p>
              <button type="button" className="ea-link" onClick={() => open("timelineRules")}>
                How accrual works <Icon name="arrowRight" size={11} />
              </button>
            </div>

            <div className="ea-mini">
              <div className="ea-mini__head">
                <span className="ea-panel-label">Best day this month</span>
                <b className="mono is-pos">{signed(month.bestDay?.amount ?? 0, 2)}</b>
              </div>
              <Bar
                value={month.bestDay?.amount ?? 0}
                target={Math.max(1, month.bestDay?.amount ?? 1)}
                tone="is-pos"
              />
              <p>
                {month.bestDay
                  ? `${month.bestDay.label} · ${month.bestDay.detail}`
                  : "No earnings day in the window yet."}
              </p>
              <button
                type="button"
                className="ea-link"
                onClick={() =>
                  open("timelineDetail", () => {
                    if (month.bestDay) setSelectedDayId(month.bestDay.id);
                  })
                }
              >
                Open the day <Icon name="arrowRight" size={11} />
              </button>
            </div>

            <div className="ea-mini">
              <div className="ea-mini__head">
                <span className="ea-panel-label">Data health</span>
                <b className="mono">{pools.filter((row) => row.reconciledAt).length}/{pools.length}</b>
              </div>
              <Bar
                value={pools.filter((row) => row.reconciledAt).length}
                target={pools.length}
                tone="is-done"
              />
              <p>
                Positions matched against the pool ledger. Unreconciled rows are still
                accruing, so their figures can move until the cycle closes.
              </p>
              <button type="button" className="ea-link" onClick={() => open("reconcileLog")}>
                Reconciliation log <Icon name="arrowRight" size={11} />
              </button>
            </div>
          </div>
        </section>

        {/* ── 2 · earnings by pool ── */}
        <section className="ea-section" id="ea-pools">
          <SectionHead
            code="2 / Earnings by pool"
            title="Where the money came from"
            hint={`Every position priced on the same four lines — gross share, ${PLATFORM_CUT_PCT}% platform cut, net to wallet and return on the capital you committed.`}
            aside={
              <>
                <button type="button" className="ea-btn" onClick={() => open("reconcileLog")}>
                  <Icon name="check" size={13} /> Reconciliations
                </button>
                <button
                  type="button"
                  className="ea-btn"
                  onClick={() => {
                    open("exportWizard", () => setExportScope("by-pool"));
                  }}
                >
                  <Icon name="download" size={13} /> Export
                </button>
              </>
            }
          />

          <div className="ea-pool-summary">
            <div>
              <span className="ea-panel-label">Gross earnings</span>
              <b className="mono">{money(totals.gross, 2)}</b>
            </div>
            <div>
              <span className="ea-panel-label">Platform cut</span>
              <b className="mono is-cut">−{money(totals.cut, 2)}</b>
            </div>
            <div>
              <span className="ea-panel-label">Net to wallet</span>
              <b className="mono is-pos">{money(totals.net, 2)}</b>
            </div>
            <div>
              <span className="ea-panel-label">Weighted ROI</span>
              <b className="mono is-accent">+{pct(totals.avgRoi, 2)}</b>
            </div>
            <p className="ea-pool-summary__note">
              <Icon name="refresh" size={12} /> Re-read every{" "}
              {formulaData.refreshSeconds / 60} minutes from the pool book
            </p>
          </div>

          <div className="ea-pools">
            {pools.map((pool, index) => (
              <article
                key={pool.id}
                className={`ea-pool ${poolTone(pool)}`}
                style={{ "--ea-delay": `${index * 70}ms` } as CSSProperties}
              >
                <header className="ea-pool__head">
                  <div>
                    <span className="ea-pool__code mono">{pool.code}</span>
                    <h3>{pool.name}</h3>
                    <span className="ea-pool__strategy">
                      {pool.strategy} · {pool.riskBand} risk
                    </span>
                  </div>
                  <div className="ea-pool__badges">
                    <Tag tone={pool.status === "live" ? "is-live" : "is-done"}>
                      {pool.status === "live" ? "In progress" : "Completed"}
                    </Tag>
                    {pool.reconciledAt ? <Tag tone="is-pos">Reconciled</Tag> : null}
                  </div>
                </header>

                <dl className="ea-pool__figures">
                  <div>
                    <dt>Invested</dt>
                    <dd className="mono">{money(pool.investment, 0)}</dd>
                  </div>
                  <div>
                    <dt>Your share</dt>
                    <dd className="mono">{pool.sharePct.toFixed(2)}%</dd>
                  </div>
                  <div>
                    <dt>Pool capital</dt>
                    <dd className="mono">{money(pool.poolCapital, 0)}</dd>
                  </div>
                  <div>
                    <dt>ROI</dt>
                    <dd className="mono is-pos">+{pool.roiPct.toFixed(2)}%</dd>
                  </div>
                </dl>

                <div className="ea-pool__lines">
                  <div className="ea-pool__line">
                    <span>Gross earnings</span>
                    <b className="mono">{signed(pool.gross, 2)}</b>
                  </div>
                  <div className="ea-pool__line is-cut">
                    <span>Platform cut ({pool.cutPct}%)</span>
                    <b className="mono">−{money(pool.cut, 2)}</b>
                  </div>
                  <div className="ea-pool__line is-net">
                    <span>Net to wallet</span>
                    <b className="mono">{signed(pool.net, 2)}</b>
                  </div>
                </div>

                <div className="ea-pool__progress">
                  <div className="ea-pool__progress-head">
                    <span>
                      {pool.daysElapsed} of {pool.daysTotal} days
                    </span>
                    <span className="mono">
                      {pool.status === "live"
                        ? `${money(pool.dailyAvg, 2)}/day · ${pool.daysRemaining} days left`
                        : `closed ${shortDateOf(pool.endedAt ?? pool.startedAt)}`}
                    </span>
                  </div>
                  <Bar value={pool.daysElapsed} target={pool.daysTotal} tone={pool.status === "live" ? "is-live" : "is-done"} />
                  <p className="ea-pool__note">{pool.note}</p>
                </div>

                <footer className="ea-pool__actions">
                  <button
                    type="button"
                    className="ea-btn ea-btn--sm"
                    onClick={() =>
                      open("poolDetail", () => {
                        setSelectedPoolId(pool.id);
                      })
                    }
                  >
                    Position
                  </button>
                  <button
                    type="button"
                    className="ea-btn ea-btn--sm"
                    onClick={() =>
                      open("poolStatement", () => {
                        setSelectedPoolId(pool.id);
                      })
                    }
                  >
                    Statement
                  </button>
                  <button
                    type="button"
                    className="ea-btn ea-btn--sm"
                    onClick={() =>
                      open("formulaDetail", () => {
                        setSelectedPoolId(pool.id);
                      })
                    }
                  >
                    Formula
                  </button>
                  <button
                    type="button"
                    className="ea-btn ea-btn--sm ea-btn--primary"
                    onClick={() =>
                      open("reconcileWizard", () => {
                        setSelectedPoolId(pool.id);
                      })
                    }
                  >
                    {pool.reconciledAt ? "Re-check" : "Reconcile"}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>

        {/* ── 3 · earnings timeline ── */}
        <section className="ea-section" id="ea-timeline">
          <SectionHead
            code="3 / Earnings timeline"
            title="Day by day, running total"
            hint="Settlements land on the day a cycle closes; accruals are spread across the days a live cycle has run. The running column always ends on the lifetime figure."
            aside={
              <>
                <div className="ea-chip-row">
                  {EARNINGS_PERIODS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className={`ea-chip ${desk.period === chip ? "is-active" : ""}`}
                      onClick={() => desk.setPeriod(chip)}
                    >
                      {periodLabel(chip)}
                    </button>
                  ))}
                </div>
                <button type="button" className="ea-btn" onClick={() => void downloadCsv("timeline")}>
                  <Icon name="download" size={13} /> Export CSV
                </button>
                <button type="button" className="ea-btn" onClick={() => void downloadPdf("timeline")}>
                  <Icon name="file" size={13} /> Export PDF
                </button>
              </>
            }
          />

          <div className="ea-timeline">
            <div className="ea-timeline__list">
              <header className="ea-timeline__head">
                <span className="ea-panel-label">
                  {periodLabel(view.period)} · {view.days} day{view.days === 1 ? "" : "s"}
                </span>
                <span className="mono">
                  {money(view.settled, 2)} settled · {money(view.accrued, 2)} accrued
                </span>
              </header>

              {view.rows.length ? (
                <ol className="ea-days">
                  {view.rows.map((day, index) => (
                    <li key={day.id}>
                      <button
                        type="button"
                        className={`ea-day ${timelineTone(day.kind)}`}
                        style={{ "--ea-delay": `${index * 35}ms` } as CSSProperties}
                        onClick={() =>
                          open("timelineDetail", () => {
                            setSelectedDayId(day.id);
                          })
                        }
                      >
                        <span className="ea-day__date">
                          <b className="mono">{day.date.slice(8, 10)}</b>
                          <small>{day.label.slice(4)}</small>
                        </span>
                        <span className="ea-day__body">
                          <span className="ea-day__top">
                            <b className="mono">{signed(day.amount, 2)}</b>
                            <Tag tone={day.kind === "settlement" ? "is-pos" : day.kind === "mixed" ? "is-mixed" : "is-live"}>
                              {day.kind === "settlement" ? "Settled" : day.kind === "mixed" ? "Mixed" : "Accrual"}
                            </Tag>
                          </span>
                          <span className="ea-day__pools">
                            {day.pools.map((line) => (
                              <span key={line.code} className="ea-pool-chip mono">
                                {line.code} {signed(line.amount, 2)}
                              </span>
                            ))}
                          </span>
                          <span className="ea-day__detail">{day.detail}</span>
                        </span>
                        <span className="ea-day__running">
                          <small>Running</small>
                          <b className="mono">{money(day.running, 2)}</b>
                        </span>
                        <span className="ea-day__chev">
                          <Icon name="chevronRight" size={14} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="ea-empty">
                  <span className="ea-empty__icon">
                    <Icon name="calendar" size={20} />
                  </span>
                  <h3>No earnings in this window</h3>
                  <p>
                    Nothing settled and nothing accrued inside {periodLabel(view.period).toLowerCase()}.
                    Widen the window — all time holds {money(data.timeline[data.timeline.length - 1]?.running ?? 0, 2)}.
                  </p>
                  <button type="button" className="ea-btn" onClick={() => desk.setPeriod("all")}>
                    Show all time
                  </button>
                </div>
              )}

              <footer className="ea-timeline__foot">
                <span className="ea-muted">
                  Showing {view.rows.length} of {data.timeline.length} days on record · window total{" "}
                  <b className="mono">{money(view.net, 2)}</b>
                </span>
                <button type="button" className="ea-link" onClick={() => open("timelineRules")}>
                  <Icon name="info" size={12} /> How a day is built
                </button>
              </footer>
            </div>

            <aside className="ea-timeline__rail">
              <div className="ea-rail-card">
                <span className="ea-panel-label">Window summary</span>
                <dl className="ea-rail-kv">
                  <div>
                    <dt>Net in window</dt>
                    <dd className="mono is-pos">{money(view.net, 2)}</dd>
                  </div>
                  <div>
                    <dt>Settled</dt>
                    <dd className="mono">{money(view.settled, 2)}</dd>
                  </div>
                  <div>
                    <dt>Accrued</dt>
                    <dd className="mono">{money(view.accrued, 2)}</dd>
                  </div>
                  <div>
                    <dt>Average day</dt>
                    <dd className="mono">{money(view.average, 2)}</dd>
                  </div>
                  <div>
                    <dt>Best day</dt>
                    <dd className="mono">
                      {view.best ? `${view.best.label} · ${signed(view.best.amount, 2)}` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Lifetime to date</dt>
                    <dd className="mono">{money(data.timeline[data.timeline.length - 1]?.running ?? 0, 2)}</dd>
                  </div>
                </dl>
              </div>

              <div className="ea-rail-card">
                <span className="ea-panel-label">14-day forecast</span>
                <div className="ea-spark">
                  {data.forecast.map((point) => {
                    const max = Math.max(...data.forecast.map((row) => row.live));
                    const min = Math.min(...data.forecast.map((row) => row.settled));
                    const span = Math.max(1, max - min);
                    return (
                      <span
                        key={point.day}
                        className="ea-spark__bar"
                        title={`${shortDateOf(point.date)} · ${money(point.live, 2)} live · ${money(point.conservative, 2)} conservative`}
                      >
                        <span
                          className="ea-spark__live"
                          style={{ height: `${Math.max(8, ((point.live - min) / span) * 100)}%` }}
                        />
                        <span
                          className="ea-spark__cons"
                          style={{ height: `${Math.max(6, ((point.conservative - min) / span) * 100)}%` }}
                        />
                      </span>
                    );
                  })}
                </div>
                <p className="ea-rail-note">
                  {money(data.forecast[data.forecast.length - 1]?.live ?? 0, 0)} if both live
                  cycles keep their current pace;{" "}
                  {money(data.forecast[data.forecast.length - 1]?.conservative ?? 0, 0)} if the
                  next two weeks run 28% slower.
                </p>
                <div className="ea-rail-actions">
                  <button type="button" className="ea-btn ea-btn--sm" onClick={() => open("forecast")}>
                    Open forecast
                  </button>
                  <button type="button" className="ea-btn ea-btn--sm" onClick={() => open("forecastAssumptions")}>
                    Assumptions
                  </button>
                </div>
              </div>

              <div className="ea-rail-card">
                <span className="ea-panel-label">Take the rows with you</span>
                <p className="ea-rail-note">
                  {preview.rows.length} rows in the current export scope ·{" "}
                  {formatLabel(exportFormat)} selected
                </p>
                <div className="ea-rail-actions">
                  <button type="button" className="ea-btn ea-btn--sm" onClick={() => void downloadCsv("timeline")}>
                    <Icon name="download" size={12} /> CSV
                  </button>
                  <button type="button" className="ea-btn ea-btn--sm" onClick={() => void downloadPdf("timeline")}>
                    <Icon name="file" size={12} /> PDF
                  </button>
                  <button type="button" className="ea-btn ea-btn--sm" onClick={() => open("exportShelf")}>
                    Shelf
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* ── 4 · tax report information ── */}
        <section className="ea-section" id="ea-tax">
          <SectionHead
            code="4 / Tax report information"
            title="What a filing pack needs"
            hint={`${jurisdictionLabel(selectedJurisdiction)} is the pinned jurisdiction. The nine lines below reconcile to the lifetime figure, and every line names the row it came from.`}
            aside={
              <>
                <div className="ea-chip-row">
                  {jurisdictions.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={`ea-chip ${selectedJurisdiction === code ? "is-active" : ""}`}
                      onClick={() => {
                        setSelectedJurisdiction(code);
                        open("taxJurisdiction");
                      }}
                    >
                      {code}
                    </button>
                  ))}
                </div>
                <button type="button" className="ea-btn" onClick={() => open("taxChecklist")}>
                  <Icon name="check" size={13} /> Checklist
                </button>
              </>
            }
          />

          <div className="ea-tax">
            <div className="ea-tax__main">
              <div className="ea-tax__table">
                <header className="ea-tax__head">
                  <span className="ea-panel-label">Fiscal year {tax.year} · {tax.reference}</span>
                  <span className="mono">{tax.notes.length} lines</span>
                </header>
                <ul className="ea-tax__lines">
                  {tax.notes.map((note, index) => (
                    <li
                      key={note.label}
                      className={note.tone}
                      style={{ "--ea-delay": `${index * 40}ms` } as CSSProperties}
                    >
                      <span className="ea-tax__label">
                        <b>{note.label}</b>
                        <small>{note.hint}</small>
                      </span>
                      <b className="mono ea-tax__value">{signed(note.value, 2)}</b>
                    </li>
                  ))}
                </ul>
                <footer className="ea-tax__foot">
                  <span>
                    <b className="mono">{money(tax.totals.gross, 2)}</b> gross −{" "}
                    <b className="mono">{money(tax.totals.cut, 2)}</b> cut ={" "}
                    <b className="mono">{money(tax.totals.net, 2)}</b> net ={" "}
                    <b className="mono">{money(tax.totals.withdrawn, 2)}</b> withdrawn +{" "}
                    <b className="mono">{money(tax.totals.locked, 2)}</b> locked
                  </span>
                  <button type="button" className="ea-link" onClick={() => open("taxNotes")}>
                    Line notes <Icon name="arrowRight" size={11} />
                  </button>
                </footer>
              </div>

              <div className="ea-tax__actions">
                <button
                  type="button"
                  className="ea-btn ea-btn--primary"
                  onClick={() => void downloadTax("pdf", tax.year)}
                  data-action="tax-pdf"
                >
                  <Icon name="file" size={13} /> Download PDF Tax Report
                </button>
                <button
                  type="button"
                  className="ea-btn"
                  onClick={() => void downloadTax("csv", tax.year)}
                  data-action="tax-csv"
                >
                  <Icon name="download" size={13} /> Download CSV Tax Data
                </button>
                <button type="button" className="ea-btn" onClick={() => open("emailWizard")}>
                  <Icon name="mail" size={13} /> Email it
                </button>
                <button type="button" className="ea-btn" onClick={() => open("taxDocuments")}>
                  <Icon name="layers" size={13} /> On file ({tax.documents.length})
                </button>
              </div>

              <p className="ea-disclaimer">
                <Icon name="alert" size={13} /> {tax.disclaimer}
              </p>
            </div>

            <aside className="ea-tax__side">
              <div className="ea-rail-card">
                <span className="ea-panel-label">Readiness</span>
                <ul className="ea-jurisdictions">
                  {tax.jurisdictions.map((row) => (
                    <li key={row.code} className={row.current ? "is-current" : ""}>
                      <span className="ea-jurisdiction__code mono">{row.code}</span>
                      <span className="ea-jurisdiction__body">
                        <b>{row.label}</b>
                        <small className="mono">{row.form}</small>
                      </span>
                      <Tag tone={row.status === "ready" ? "is-pos" : "is-plain"}>
                        {row.status === "ready" ? "Ready" : "Partial"}
                      </Tag>
                      <button
                        type="button"
                        className="ea-icon-btn"
                        aria-label={`${row.label} requirements`}
                        onClick={() =>
                          open("taxJurisdiction", () => {
                            setSelectedJurisdiction(row.code);
                          })
                        }
                      >
                        <Icon name="chevronRight" size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="ea-rail-note">
                  Filing window {tax.filingWindow}. Partial means one document is
                  missing — open the jurisdiction to see which.
                </p>
              </div>

              <div className="ea-rail-card">
                <span className="ea-panel-label">Documents on file</span>
                <ul className="ea-docs">
                  {tax.documents.slice(0, 3).map((doc) => (
                    <li key={doc.id}>
                      <span className={`ea-doc-icon is-${doc.format}`}>
                        <Icon name={doc.format === "pdf" ? "file" : "download"} size={13} />
                      </span>
                      <span className="ea-doc-body">
                        <b>{doc.name}</b>
                        <small className="mono">
                          {doc.kind} · {doc.sizeKb} KB · {doc.reference}
                        </small>
                      </span>
                      <button
                        type="button"
                        className="ea-btn ea-btn--sm"
                        onClick={() => void downloadTax(doc.format === "csv" ? "csv" : "pdf", tax.year)}
                      >
                        Get
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="ea-link" onClick={() => open("taxDocuments")}>
                  All documents <Icon name="arrowRight" size={11} />
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* ── 5 · profit sharing breakdown ── */}
        <section className="ea-section" id="ea-formula">
          <SectionHead
            code="5 / Profit sharing breakdown"
            title="Pool P&L → your share → the cut → your wallet"
            hint={`The formula runs on every position, every ${formulaData.refreshSeconds / 60} minutes. Pick a cycle to watch the same five steps with its own numbers.`}
            aside={
              <>
                <div className="ea-chip-row">
                  {formulaData.samples.map((sample) => (
                    <button
                      key={sample.poolCode}
                      type="button"
                      className={`ea-chip ${selectedSample?.poolCode === sample.poolCode ? "is-active" : ""}`}
                      onClick={() => {
                        setSelectedPoolId(
                          pools.find((row) => row.code === sample.poolCode)?.id ?? selectedPoolId,
                        );
                      }}
                    >
                      {sample.poolCode}
                    </button>
                  ))}
                </div>
                <button type="button" className="ea-btn" onClick={() => void refresh()}>
                  <Icon name="refresh" size={13} /> Recalculate
                </button>
              </>
            }
          />

          <div className="ea-formula">
            <ol className="ea-flow">
              {(selectedSample?.steps ?? formulaData.steps).map((step, index) => (
                <li
                  key={step.key}
                  className={`ea-flow__step ${step.unit === "pct" ? "is-pct" : ""}`}
                  style={{ "--ea-delay": `${index * 60}ms` } as CSSProperties}
                >
                  <span className="ea-flow__index mono">{String(index + 1).padStart(2, "0")}</span>
                  <span className="ea-flow__label">{step.label}</span>
                  <b className="ea-flow__value mono">
                    {step.unit === "pct"
                      ? `+${step.value.toFixed(2)}%`
                      : `${step.value < 0 ? "−" : ""}${money(Math.abs(step.value), 2)}`}
                  </b>
                  <span className="ea-flow__expr mono">{step.expression}</span>
                  <span className="ea-flow__note">{step.note}</span>
                </li>
              ))}
            </ol>

            <div className="ea-formula__side">
              <div className="ea-worked">
                <span className="ea-panel-label">Worked example</span>
                <h3>
                  {selectedSample?.poolCode} {selectedSample?.poolName}
                </h3>
                <Kv
                  rows={[
                    ["Pool P&L", money(selectedSample?.poolPnl ?? 0, 2)],
                    ["Your share", `${(selectedSample?.sharePct ?? 0).toFixed(2)}%`],
                    ["Gross share", money(selectedSample?.gross ?? 0, 2)],
                    [`Platform cut (${selectedSample?.cutPct ?? PLATFORM_CUT_PCT}%)`, `−${money(selectedSample?.cut ?? 0, 2)}`],
                    ["Net to wallet", money(selectedSample?.net ?? 0, 2)],
                    ["ROI", `+${(selectedSample?.roiPct ?? 0).toFixed(2)}%`],
                  ]}
                />
                <div className="ea-worked__actions">
                  <button
                    type="button"
                    className="ea-btn ea-btn--sm"
                    onClick={() => open("formulaDetail")}
                  >
                    Full derivation
                  </button>
                  <button type="button" className="ea-btn ea-btn--sm" onClick={() => open("samplePicker")}>
                    Trace another pool
                  </button>
                </div>
              </div>

              <div className="ea-formula__notes">
                <span className="ea-panel-label">Rules of the formula</span>
                <ul>
                  {formulaData.notes.map((note) => (
                    <li key={note}>
                      <Icon name="check" size={12} />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
                <div className="ea-formula__stamp">
                  <Icon name="clock" size={12} />
                  <span className="mono">
                    Auto-calc every {formulaData.refreshSeconds / 60} min · last pass{" "}
                    {clockShort(asOf)} UTC
                  </span>
                  <button type="button" className="ea-icon-btn" aria-label="Recalculate now" onClick={() => void refresh()}>
                    <Icon name="refresh" size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── shortcuts ── */}
        <section className="ea-shortcuts">
          <header>
            <span className="ea-panel-label">Everything else on this desk</span>
            <p>
              Every figure has an audit trail, a source row and a file you can take
              with you. These open the same dialogs as the dock below.
            </p>
          </header>
          <div className="ea-shortcuts__grid">
            <button type="button" onClick={() => open("methodology")}>
              <Icon name="script" size={15} />
              <b>Methodology</b>
              <small>How each of the six figures is derived</small>
            </button>
            <button type="button" onClick={() => open("reportsLibrary")}>
              <Icon name="layers" size={15} />
              <b>Report library</b>
              <small>{library.reports.length} statements, one stale</small>
            </button>
            <button type="button" onClick={() => open("payoutLedger")}>
              <Icon name="wallet" size={15} />
              <b>Payout ledger</b>
              <small>{money(library.payoutTotals.paid, 2)} paid, {money(library.payoutTotals.processing, 2)} processing</small>
            </button>
            <button type="button" onClick={() => open("exportShelf")}>
              <Icon name="download" size={15} />
              <b>Export shelf</b>
              <small>{library.exports.length} of {MAX_EXPORTS} slots used</small>
            </button>
            <button type="button" onClick={() => open("auditTrail")}>
              <Icon name="activity" size={15} />
              <b>Audit trail</b>
              <small>{data.audit.length} desk events</small>
            </button>
            <button type="button" onClick={() => open("boundaries")}>
              <Icon name="shield" size={15} />
              <b>Desk boundaries</b>
              <small>What is real and what is a preview</small>
            </button>
          </div>
        </section>

        {/* ── drawer ── */}
        {drawer ? (
          <div className="ea-drawer-layer" role="presentation" onClick={() => setDrawer(null)}>
            <aside
              className="ea-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Earnings desk drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="ea-drawer__head">
                <div>
                  <span className="ea-panel-label">Earnings desk</span>
                  <h2>
                    {drawer === "overview"
                      ? "This statement"
                      : drawer === "pools"
                        ? "Positions"
                        : "Tax & documents"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="ea-icon-btn"
                  aria-label="Close drawer"
                  onClick={() => setDrawer(null)}
                >
                  <Icon name="close" size={15} />
                </button>
              </header>

              <div className="ea-drawer__tabs" role="tablist">
                {(["overview", "pools", "tax"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={drawer === tab}
                    className={drawer === tab ? "is-active" : ""}
                    onClick={() => setDrawer(tab)}
                  >
                    {tab === "overview" ? "Overview" : tab === "pools" ? "Positions" : "Tax"}
                  </button>
                ))}
              </div>

              <div className="ea-drawer__body">
                {drawer === "overview" ? (
                  <>
                    <div className="ea-drawer__totals">
                      <span className="ea-panel-label">Lifetime net</span>
                      <b className="mono">{money(totals.net, 2)}</b>
                      <Bar value={month.net} target={totals.net} tone="is-accent" />
                      <small className="mono">
                        {money(month.net, 2)} of it landed in {month.label.split(" ")[0]}
                      </small>
                    </div>
                    <dl className="ea-rail-kv">
                      <div>
                        <dt>Accruing</dt>
                        <dd className="mono is-accent">{money(totals.live, 2)}</dd>
                      </div>
                      <div>
                        <dt>Settled</dt>
                        <dd className="mono is-pos">{money(totals.completed, 2)}</dd>
                      </div>
                      <div>
                        <dt>Platform cut</dt>
                        <dd className="mono is-cut">−{money(totals.cut, 2)}</dd>
                      </div>
                      <div>
                        <dt>Wallet cash</dt>
                        <dd className="mono">{money(data.profile.wallet, 2)}</dd>
                      </div>
                      <div>
                        <dt>Next settlement</dt>
                        <dd className="mono">
                          {money(totals.live, 2)} · {shortDateOf(pools[0]?.endedAt ?? pools[0]?.startedAt ?? asOf)}
                        </dd>
                      </div>
                    </dl>
                    <div className="ea-drawer__list">
                      <button type="button" className="ea-drawer__row" onClick={() => void refresh()}>
                        <Icon name="refresh" size={14} />
                        <span>
                          <strong>Recompute accruals</strong>
                          <small className="ea-muted">Runs the 3-minute pass now</small>
                        </span>
                        <Icon name="chevronRight" size={13} />
                      </button>
                      <button type="button" className="ea-drawer__row" onClick={() => open("timelineRules")}>
                        <Icon name="script" size={14} />
                        <span>
                          <strong>How a day is built</strong>
                          <small className="ea-muted">Settlements and accruals</small>
                        </span>
                        <Icon name="chevronRight" size={13} />
                      </button>
                      <button type="button" className="ea-drawer__row" onClick={() => open("auditTrail")}>
                        <Icon name="activity" size={14} />
                        <span>
                          <strong>Audit trail</strong>
                          <small className="ea-muted">{data.audit.length} events</small>
                        </span>
                        <Icon name="chevronRight" size={13} />
                      </button>
                    </div>
                    <div className="ea-drawer-actions">
                      <button type="button" className="ea-btn ea-btn--primary" onClick={() => open("exportWizard")}>
                        <Icon name="download" size={13} /> Export
                      </button>
                      <button type="button" className="ea-btn" onClick={() => open("preferencesWizard")}>
                        Preferences
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "pools" ? (
                  <>
                    <div className="ea-drawer__list">
                      {pools.map((pool) => (
                        <button
                          key={pool.id}
                          type="button"
                          className="ea-drawer__row"
                          onClick={() =>
                            open("poolDetail", () => {
                              setSelectedPoolId(pool.id);
                            })
                          }
                        >
                          <span className={`ea-status-dot ${pool.status === "live" ? "is-ok" : "is-wait"}`} />
                          <span>
                            <strong>
                              {pool.code} {pool.name}
                            </strong>
                            <small className="ea-muted mono">
                              {money(pool.net, 2)} net · {pool.roiPct.toFixed(2)}% ·{" "}
                              {pool.daysElapsed}/{pool.daysTotal} days
                            </small>
                          </span>
                          <Icon name="chevronRight" size={13} />
                        </button>
                      ))}
                    </div>
                    <div className="ea-drawer-actions">
                      <button type="button" className="ea-btn ea-btn--primary" onClick={() => open("reconcileWizard")}>
                        Reconcile a position
                      </button>
                      <button type="button" className="ea-btn" onClick={() => void downloadCsv("by-pool")}>
                        Export breakdown
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "tax" ? (
                  <>
                    <div className="ea-drawer__totals">
                      <span className="ea-panel-label">Fiscal year {tax.year}</span>
                      <b className="mono">{money(tax.totals.net, 2)}</b>
                      <small className="mono">
                        {tax.notes.length} lines · {jurisdictionLabel(selectedJurisdiction)} ·{" "}
                        {tax.reference}
                      </small>
                    </div>
                    <ul className="ea-docs">
                      {tax.documents.map((doc) => (
                        <li key={doc.id}>
                          <span className={`ea-doc-icon is-${doc.format}`}>
                            <Icon name={doc.format === "pdf" ? "file" : "download"} size={13} />
                          </span>
                          <span className="ea-doc-body">
                            <b>{doc.name}</b>
                            <small className="mono">
                              {doc.sizeKb} KB · {doc.generatedAt ? shortDateOf(doc.generatedAt) : "not generated"}
                            </small>
                          </span>
                          <button
                            type="button"
                            className="ea-btn ea-btn--sm"
                            onClick={() => void downloadTax(doc.format === "csv" ? "csv" : "pdf", tax.year)}
                          >
                            Get
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="ea-drawer-actions">
                      <button
                        type="button"
                        className="ea-btn ea-btn--primary"
                        onClick={() => void downloadTax("pdf", tax.year)}
                      >
                        <Icon name="file" size={13} /> Tax PDF
                      </button>
                      <button type="button" className="ea-btn" onClick={() => open("taxChecklist")}>
                        Checklist
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        {/* ── dialogs ── */}
        {modal ? (
          <div className="ea-modal-layer">
            <DeskModalShell
              code="I-11"
              eyebrow="INVESTOR WORKSPACE / EARNINGS & REPORTS"
              title={titles[modal.kind]}
              subtitle="Exports, reports and statement writes run through the same command contract the earnings API exposes — every write is validated before it touches the snapshot."
              size={modalSize[modal.kind] ?? "md"}
              onClose={close}
              steps={wizard}
              currentStep={wizardStep}
              footer={modalFooter}
            >
              {error ? (
                <p className="ea-error" role="alert">
                  {error}
                </p>
              ) : null}

              {/* export wizard */}
              {modal.kind === "exportWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="ea-modal-lede">
                      Pick the rows. Each scope is a real matrix built from the
                      position book — the row count below is what the file will hold.
                    </p>
                    <div className="ea-option-grid is-two">
                      {exportScopes.map((scope) => (
                        <button
                          key={scope.key}
                          type="button"
                          className={`ea-option ${exportScope === scope.key ? "is-active" : ""}`}
                          onClick={() => setExportScope(scope.key)}
                        >
                          <strong>{scope.label}</strong>
                          <small>{scope.hint}</small>
                          <span className="mono ea-option__count">
                            {exportMatrix(data, scope.key, desk.period).rows.length} rows
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="ea-modal-lede">
                      CSV downloads straight away; JSON and PDF keep a copy on the
                      export shelf as well.
                    </p>
                    <div className="ea-option-grid">
                      {exportFormats.map((format) => (
                        <button
                          key={format.key}
                          type="button"
                          className={`ea-option ${exportFormat === format.key ? "is-active" : ""}`}
                          onClick={() => setExportFormat(format.key)}
                        >
                          <Icon name={format.key === "pdf" ? "file" : "download"} size={15} />
                          <strong>{format.label}</strong>
                          <small>{format.hint}</small>
                        </button>
                      ))}
                    </div>
                    <div className="ea-export-preview">
                      <span className="ea-panel-label">File preview</span>
                      <b className="mono">
                        trademo-{exportScope}-{asOf.slice(0, 10)}.{exportFormat}
                      </b>
                      <small className="mono">
                        {preview.rows.length} rows · {preview.header.length} columns ·{" "}
                        {periodLabel(desk.period)}
                      </small>
                      <div className="ea-export-preview__head">
                        {preview.header.slice(0, 5).map((head) => (
                          <span key={head}>{head}</span>
                        ))}
                      </div>
                      <div className="ea-export-preview__row">
                        {(preview.rows[0] ?? []).slice(0, 5).map((cell, index) => (
                          <span key={index}>{String(cell)}</span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="ea-modal-lede">
                      Confirm and the file is built from these rows. Nothing is
                      uploaded anywhere.
                    </p>
                    <Kv
                      rows={[
                        ["Scope", scopeLabel(exportScope)],
                        ["Format", formatLabel(exportFormat)],
                        ["Period", periodLabel(desk.period)],
                        ["Rows", `${preview.rows.length}`],
                        ["File", `trademo-${exportScope}-${asOf.slice(0, 10)}.${exportFormat}`],
                      ]}
                    />
                    <p className="ea-modal-note">
                      <Icon name="info" size={12} /> The same matrix powers the
                      timeline buttons and the tax workbook — one derivation, four
                      files.
                    </p>
                  </>
                )
              ) : null}

              {/* report wizard */}
              {modal.kind === "reportWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="ea-modal-lede">
                      Six statement types are available. Each is assembled from the
                      rows you can see on this page.
                    </p>
                    <div className="ea-option-grid is-two">
                      {reportKinds.map((kind) => (
                        <button
                          key={kind.key}
                          type="button"
                          className={`ea-option ${reportKind === kind.key ? "is-active" : ""}`}
                          onClick={() => setReportKind(kind.key)}
                        >
                          <strong>{kind.label}</strong>
                          <small>{kind.hint}</small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="ea-modal-lede">Which window should the report cover?</p>
                    <div className="ea-chip-row is-wrap">
                      {EARNINGS_PERIODS.map((period) => (
                        <button
                          key={period}
                          type="button"
                          className={`ea-chip ${desk.period === period ? "is-active" : ""}`}
                          onClick={() => desk.setPeriod(period)}
                        >
                          {periodLabel(period)}
                        </button>
                      ))}
                    </div>
                    <div className="ea-export-preview">
                      <span className="ea-panel-label">Included</span>
                      <ul className="ea-rule-list">
                        <li>
                          <Icon name="check" size={12} /> {pools.length} positions with gross, cut and net
                        </li>
                        <li>
                          <Icon name="check" size={12} /> {view.days} timeline days, running total
                        </li>
                        <li>
                          <Icon name="check" size={12} /> the nine tax lines and the fee ledger
                        </li>
                        <li>
                          <Icon name="check" size={12} /> payout references and bank destinations
                        </li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <Kv
                      rows={[
                        ["Report", reportKindLabel(reportKind)],
                        ["Period", periodLabel(desk.period)],
                        ["Format", "PDF"],
                        ["Positions", `${pools.length}`],
                        ["Timeline rows", `${view.days}`],
                      ]}
                    />
                    <p className="ea-modal-note">
                      <Icon name="layers" size={12} /> Generated reports land in the
                      report library with their own reference — open it from the
                      shortcut grid.
                    </p>
                  </>
                )
              ) : null}

              {/* tax wizard */}
              {modal.kind === "taxWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="ea-modal-lede">
                      The pack is built for a fiscal year and a jurisdiction. Only{" "}
                      {FISCAL_YEAR} has movements; prior years are kept for the
                      five-year record.
                    </p>
                    <div className="ea-chip-row is-wrap">
                      {[FISCAL_YEAR - 1, FISCAL_YEAR].map((year) => (
                        <button
                          key={year}
                          type="button"
                          className={`ea-chip ${taxYear === year ? "is-active" : ""}`}
                          onClick={() => setTaxYear(year)}
                          disabled={year < FISCAL_YEAR}
                        >
                          {year}
                          {year < FISCAL_YEAR ? " (no movements)" : ""}
                        </button>
                      ))}
                    </div>
                    <Kv
                      rows={[
                        ["Gross earnings", money(tax.totals.gross, 2)],
                        ["Platform fee", `−${money(tax.totals.cut, 2)}`],
                        ["Net earnings", money(tax.totals.net, 2)],
                        ["Withdrawn", money(tax.totals.withdrawn, 2)],
                        ["Locked in live cycles", money(tax.totals.locked, 2)],
                      ]}
                    />
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="ea-modal-lede">
                      Pin the jurisdiction that files this pack. Readiness is shown
                      per form.
                    </p>
                    <div className="ea-option-stack">
                      {tax.jurisdictions.map((row) => (
                        <button
                          key={row.code}
                          type="button"
                          className={`ea-option-row ${selectedJurisdiction === row.code ? "is-active" : ""}`}
                          onClick={() => setSelectedJurisdiction(row.code)}
                        >
                          <span className="ea-jurisdiction__code mono">{row.code}</span>
                          <span className="ea-option-row__body">
                            <strong>{row.label}</strong>
                            <small className="mono">{row.form}</small>
                          </span>
                          <Tag tone={row.status === "ready" ? "is-pos" : "is-plain"}>
                            {row.status === "ready" ? "Ready" : "Partial"}
                          </Tag>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="ea-modal-lede">Pick the format that leaves the building.</p>
                    <div className="ea-option-grid">
                      {(["pdf", "csv"] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          className={`ea-option ${taxFormat === format ? "is-active" : ""}`}
                          onClick={() => setTaxFormat(format)}
                        >
                          <Icon name={format === "pdf" ? "file" : "download"} size={15} />
                          <strong>{format.toUpperCase()}</strong>
                          <small>
                            {format === "pdf" ? "Filing summary for the accountant" : "Workbook data, line by line"}
                          </small>
                        </button>
                      ))}
                    </div>
                    <Kv
                      rows={[
                        ["Fiscal year", `${taxYear}`],
                        ["Jurisdiction", jurisdictionLabel(selectedJurisdiction)],
                        ["Format", taxFormat.toUpperCase()],
                        ["Lines", `${tax.notes.length}`],
                        ["Filing window", tax.filingWindow],
                      ]}
                    />
                    <p className="ea-disclaimer">
                      <Icon name="alert" size={12} /> {tax.disclaimer}
                    </p>
                  </>
                )
              ) : null}

              {/* preferences wizard */}
              {modal.kind === "preferencesWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="ea-modal-lede">
                      How often this statement re-derives itself, and which rows it
                      includes.
                    </p>
                    <div className="ea-chip-row is-wrap">
                      {EARNINGS_PERIODS.map((period) => (
                        <button
                          key={period}
                          type="button"
                          className={`ea-chip ${draftPrefs.defaultPeriod === period ? "is-active" : ""}`}
                          onClick={() => setDraftPrefs((prev) => ({ ...prev, defaultPeriod: period }))}
                        >
                          {periodLabel(period)}
                        </button>
                      ))}
                    </div>
                    <div className="ea-toggle-stack">
                      <Toggle
                        label="Include accruals"
                        hint="Show unsettled days as well as settled lines"
                        checked={draftPrefs.includeAccrual}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, includeAccrual: next }))}
                      />
                      <Toggle
                        label="Include losses and fees"
                        hint="Bank return fees and losing trades, netted once"
                        checked={draftPrefs.includeLosses}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, includeLosses: next }))}
                      />
                      <Toggle
                        label="Auto-generate monthly"
                        hint={`A statement on the 1st for ${jurisdictionLabel(draftPrefs.jurisdiction)}`}
                        checked={draftPrefs.autoMonthly}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, autoMonthly: next }))}
                      />
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="ea-modal-lede">Where it is delivered, and how it rounds.</p>
                    <label className="ea-field">
                      <span>Delivery email</span>
                      <input
                        type="email"
                        value={draftPrefs.deliveryEmail}
                        onChange={(event) =>
                          setDraftPrefs((prev) => ({ ...prev, deliveryEmail: event.target.value }))
                        }
                      />
                    </label>
                    <div className="ea-chip-row is-wrap">
                      {(["cent", "dollar"] as const).map((rounding) => (
                        <button
                          key={rounding}
                          type="button"
                          className={`ea-chip ${draftPrefs.rounding === rounding ? "is-active" : ""}`}
                          onClick={() => setDraftPrefs((prev) => ({ ...prev, rounding }))}
                        >
                          Round to {rounding === "cent" ? "cents" : "dollars"}
                        </button>
                      ))}
                    </div>
                    <div className="ea-toggle-stack">
                      {jurisdictions.map((code) => (
                        <Toggle
                          key={code}
                          label={jurisdictionLabel(code)}
                          hint={tax.jurisdictions.find((row) => row.code === code)?.form ?? ""}
                          checked={draftPrefs.jurisdiction === code}
                          onChange={() => setDraftPrefs((prev) => ({ ...prev, jurisdiction: code }))}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {prefsError ? <p className="ea-error">{prefsError}</p> : null}
                    <Kv
                      rows={[
                        ["Default period", periodLabel(draftPrefs.defaultPeriod)],
                        ["Jurisdiction", jurisdictionLabel(draftPrefs.jurisdiction)],
                        ["Delivery", draftPrefs.deliveryEmail || "—"],
                        ["Rounding", draftPrefs.rounding === "cent" ? "Cents" : "Whole dollars"],
                        ["Accruals", draftPrefs.includeAccrual ? "Included" : "Settled only"],
                        ["Auto monthly", draftPrefs.autoMonthly ? "On" : "Manual"],
                      ]}
                    />
                  </>
                )
              ) : null}

              {/* email wizard */}
              {modal.kind === "emailWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="ea-modal-lede">
                      Send the pack to yourself or an accountant. This demo queues the
                      message; nothing leaves the browser.
                    </p>
                    <label className="ea-field">
                      <span>Recipient</span>
                      <input
                        type="email"
                        value={emailTo}
                        onChange={(event) => setEmailTo(event.target.value)}
                        placeholder="accountant@example.com"
                      />
                    </label>
                    {emailError ? <p className="ea-error">{emailError}</p> : null}
                    <p className="ea-modal-note">
                      <Icon name="mail" size={12} /> Delivery address on file:{" "}
                      {prefs.deliveryEmail}
                    </p>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="ea-modal-lede">What travels with the email?</p>
                    <div className="ea-option-grid">
                      {(["pdf", "csv"] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          className={`ea-option ${taxFormat === format ? "is-active" : ""}`}
                          onClick={() => setTaxFormat(format)}
                        >
                          <Icon name={format === "pdf" ? "file" : "download"} size={15} />
                          <strong>{format.toUpperCase()}</strong>
                          <small>{tax.notes.length} lines · fiscal year {taxYear}</small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <Kv
                    rows={[
                      ["To", emailTo],
                      ["Attachment", `${taxFormat.toUpperCase()} · ${tax.notes.length} lines`],
                      ["Fiscal year", `${taxYear}`],
                      ["Jurisdiction", jurisdictionLabel(selectedJurisdiction)],
                      ["Reference", tax.reference],
                    ]}
                  />
                )
              ) : null}

              {/* reconcile wizard */}
              {modal.kind === "reconcileWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="ea-modal-lede">
                      Choose the position to match against the pool ledger.
                    </p>
                    <div className="ea-option-stack">
                      {pools.map((pool) => (
                        <button
                          key={pool.id}
                          type="button"
                          className={`ea-option-row ${selectedPool?.id === pool.id ? "is-active" : ""}`}
                          onClick={() => setSelectedPoolId(pool.id)}
                        >
                          <span className={`ea-status-dot ${pool.status === "live" ? "is-ok" : "is-wait"}`} />
                          <span className="ea-option-row__body">
                            <strong>
                              {pool.code} {pool.name}
                            </strong>
                            <small className="mono">
                              {money(pool.net, 2)} net · {pool.daysElapsed}/{pool.daysTotal} days
                            </small>
                          </span>
                          {pool.reconciledAt ? <Tag tone="is-pos">Done</Tag> : null}
                        </button>
                      ))}
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="ea-modal-lede">
                      Three checks run on every position: gross recovers from the cut,
                      the cut is exactly {PLATFORM_CUT_PCT}%, and the net matches the
                      payout or accrual.
                    </p>
                    <ul className="ea-check-list">
                      <li>
                        <Icon name="check" size={13} /> Gross {money(selectedPool?.gross ?? 0, 2)} − cut{" "}
                        {money(selectedPool?.cut ?? 0, 2)} = {money(selectedPool?.net ?? 0, 2)}
                      </li>
                      <li>
                        <Icon name="check" size={13} /> Cut is{" "}
                        {(((selectedPool?.cut ?? 0) / Math.max(1, selectedPool?.gross ?? 1)) * 100).toFixed(2)}%
                        of gross
                      </li>
                      <li>
                        <Icon name="check" size={13} /> Net is{" "}
                        {selectedPool?.status === "live" ? "accrued, not yet paid" : "settled and paid out"}
                      </li>
                    </ul>
                    <Kv
                      rows={[
                        ["Pool P&L", money(selectedPool?.poolPnl ?? 0, 2)],
                        ["Pool capital", money(selectedPool?.poolCapital ?? 0, 0)],
                        ["Your investment", money(selectedPool?.investment ?? 0, 0)],
                        ["Share", `${(selectedPool?.sharePct ?? 0).toFixed(2)}%`],
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <Kv
                      rows={[
                        ["Position", `${selectedPool?.code} ${selectedPool?.name}`],
                        ["Net", money(selectedPool?.net ?? 0, 2)],
                        ["Status", selectedPool?.status === "live" ? "Accruing" : "Settled"],
                        ["Last reconciled", selectedPool?.reconciledAt ? shortDateOf(selectedPool.reconciledAt) : "Never"],
                      ]}
                    />
                    <p className="ea-modal-note">
                      <Icon name="info" size={12} /> Reconciling records the check on
                      the position and in the desk audit — it never moves money.
                    </p>
                  </>
                )
              ) : null}

              {/* support wizard */}
              {modal.kind === "supportWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="ea-modal-lede">
                      What should the earnings desk look at first?
                    </p>
                    <div className="ea-option-stack">
                      {supportTopics.map((topic) => (
                        <button
                          key={topic.key}
                          type="button"
                          className={`ea-option-row ${supportTopic === topic.key ? "is-active" : ""}`}
                          onClick={() => setSupportTopic(topic.key)}
                        >
                          <Icon name="mail" size={14} />
                          <span className="ea-option-row__body">
                            <strong>{topic.label}</strong>
                            <small>{topic.hint}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="ea-modal-lede">
                      The more specific the better — name the pool and the figure.
                    </p>
                    <label className="ea-field">
                      <span>Message ({supportMessage.trim().length}/1000)</span>
                      <textarea
                        rows={5}
                        value={supportMessage}
                        maxLength={1000}
                        onChange={(event) => setSupportMessage(event.target.value)}
                        placeholder="PKG-01 shows $1,260 net here but the pool page shows…"
                      />
                    </label>
                    {supportMessage.trim().length < 12 ? (
                      <p className="ea-modal-note">{supportError}</p>
                    ) : null}
                    <p className="ea-modal-note">
                      <Icon name="info" size={12} /> {data.support.length} of{" "}
                      {MAX_SUPPORT_DRAFTS} drafts are held on this desk.
                    </p>
                  </>
                ) : (
                  <Kv
                    rows={[
                      ["Topic", topicLabel(supportTopic)],
                      ["Message", supportMessage.trim().slice(0, 120) + (supportMessage.trim().length > 120 ? "…" : "")],
                      ["Positions in scope", `${pools.length}`],
                      ["Snapshot", `${shortDateOf(asOf)} ${clockShort(asOf)} UTC`],
                    ]}
                  />
                )
              ) : null}

              {/* kpi detail */}
              {modal.kind === "kpiDetail" && kpi ? (
                <>
                  <div className="ea-kpi-head">
                    <span className="ea-panel-label">{kpi.label}</span>
                    <b className={`mono ${kpi.tone}`}>
                      {kpi.prefix}
                      {kpi.value.toLocaleString("en-US", {
                        minimumFractionDigits: kpi.decimals,
                        maximumFractionDigits: kpi.decimals,
                      })}
                      {kpi.suffix ?? ""}
                    </b>
                    <small>{kpi.hint}</small>
                  </div>
                  <p className="ea-modal-lede">{kpi.detail}</p>
                  <ul className="ea-check-list">
                    <li>
                      <Icon name="check" size={13} /> Gross {money(totals.gross, 2)} − platform cut{" "}
                      {money(totals.cut, 2)} = net {money(totals.net, 2)}
                    </li>
                    <li>
                      <Icon name="check" size={13} /> {totals.positions} positions ·{" "}
                      {totals.livePositions} live, {totals.completedPositions} settled
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Recomputed at {clockShort(asOf)} UTC · revision{" "}
                      {data.revision}
                    </li>
                  </ul>
                  {kpi.key === "month" ? (
                    <div className="ea-export-preview">
                      <span className="ea-panel-label">{month.label}</span>
                      <Kv
                        rows={[
                          ["Settled", money(month.settled, 2)],
                          ["Accrued", money(month.accrued, 2)],
                          ["Days elapsed", `${month.daysElapsed} of ${month.daysInMonth}`],
                          ["Best day", month.bestDay ? `${month.bestDay.label} · ${signed(month.bestDay.amount, 2)}` : "—"],
                        ]}
                      />
                    </div>
                  ) : null}
                  {kpi.key === "lifetime" ? (
                    <div className="ea-export-preview">
                      <span className="ea-panel-label">Split</span>
                      <Kv
                        rows={[
                          ["Settled and paid", money(totals.completed, 2)],
                          ["Still accruing", money(totals.live, 2)],
                          ["Timeline total", money(data.timeline[data.timeline.length - 1]?.running ?? 0, 2)],
                        ]}
                      />
                    </div>
                  ) : null}
                  <div className="ea-modal-actions">
                    <button type="button" className="ea-btn" onClick={() => open("methodology")}>
                      Methodology
                    </button>
                    <button type="button" className="ea-btn" onClick={() => open("lifetimeBreakdown")}>
                      Build-up
                    </button>
                    <button type="button" className="ea-btn" onClick={() => open("exportWizard")}>
                      Export the rows
                    </button>
                  </div>
                </>
              ) : null}

              {/* methodology */}
              {modal.kind === "methodology" ? (
                <>
                  <p className="ea-modal-lede">
                    Nine identities hold across the whole desk. Every figure on the
                    page is a slice of one of them.
                  </p>
                  <ol className="ea-method">
                    <li>
                      <b>Position gross</b>
                      <span className="mono">net ÷ (1 − 20%)</span>
                      <small>The pool books P&amp;L after its cut, so gross is recovered by dividing by 0.8.</small>
                    </li>
                    <li>
                      <b>Platform cut</b>
                      <span className="mono">gross × 20%</span>
                      <small>Ops, custody and settlement. Fixed at booking, never re-priced.</small>
                    </li>
                    <li>
                      <b>Net to wallet</b>
                      <span className="mono">gross − cut</span>
                      <small>Accrued while a cycle runs, paid when it settles.</small>
                    </li>
                    <li>
                      <b>Lifetime</b>
                      <span className="mono">Σ net across 5 positions</span>
                      <small>{money(totals.net, 2)} — identical to the investments page total earned.</small>
                    </li>
                    <li>
                      <b>Daily accrual</b>
                      <span className="mono">net ÷ days elapsed</span>
                      <small>Spread across every UTC day the cycle has run; the last day absorbs rounding.</small>
                    </li>
                  </ol>
                  <div className="ea-identity">
                    <span className="ea-panel-label">The identity that must hold</span>
                    <p className="mono">
                      {money(totals.gross, 2)} − {money(totals.cut, 2)} = {money(totals.net, 2)} ={" "}
                      {money(totals.completed, 2)} paid + {money(totals.live, 2)} accruing
                    </p>
                  </div>
                  <p className="ea-modal-note">
                    <Icon name="shield" size={12} /> Tested in{" "}
                    <span className="mono">tests/investor-earnings.test.cjs</span> — the
                    suite fails if any identity drifts by a cent.
                  </p>
                </>
              ) : null}

              {/* pool detail */}
              {modal.kind === "poolDetail" && selectedPool ? (
                <>
                  <div className="ea-kpi-head">
                    <span className="ea-panel-label">
                      {selectedPool.code} · {selectedPool.status === "live" ? "in progress" : "completed"}
                    </span>
                    <b className="mono is-pos">{money(selectedPool.net, 2)} net</b>
                    <small>
                      {selectedPool.strategy} · {selectedPool.riskBand} risk ·{" "}
                      {selectedPool.sharePct.toFixed(2)}% share
                    </small>
                  </div>
                  <Kv
                    rows={[
                      ["Invested", money(selectedPool.investment, 0)],
                      ["Pool capital", money(selectedPool.poolCapital, 0)],
                      ["Pool P&L", money(selectedPool.poolPnl, 2)],
                      ["Gross share", money(selectedPool.gross, 2)],
                      [`Platform cut (${selectedPool.cutPct}%)`, `−${money(selectedPool.cut, 2)}`],
                      ["Net to wallet", money(selectedPool.net, 2)],
                      ["ROI", `+${selectedPool.roiPct.toFixed(2)}%`],
                      ["Position value", money(selectedPool.currentValue, 2)],
                    ]}
                  />
                  <div className="ea-progress-block">
                    <div className="ea-pool__progress-head">
                      <span>
                        {selectedPool.daysElapsed} of {selectedPool.daysTotal} days
                      </span>
                      <span className="mono">
                        {selectedPool.status === "live"
                          ? `${money(selectedPool.dailyAvg, 2)}/day · ${selectedPool.daysRemaining} days left`
                          : `closed ${shortDateOf(selectedPool.endedAt ?? selectedPool.startedAt)}`}
                      </span>
                    </div>
                    <Bar
                      value={selectedPool.daysElapsed}
                      target={selectedPool.daysTotal}
                      tone={selectedPool.status === "live" ? "is-live" : "is-done"}
                    />
                    <p className="ea-muted">{selectedPool.note}</p>
                  </div>
                  <div className="ea-modal-actions">
                    <Link className="ea-btn" href={selectedPool.poolHref}>
                      <Icon name="external" size={12} /> Pool page
                    </Link>
                    {selectedPool.liveHref ? (
                      <Link className="ea-btn" href={selectedPool.liveHref}>
                        <Icon name="activity" size={12} /> Live feed
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="ea-btn"
                      onClick={() =>
                        open("formulaDetail", () => {
                          setSelectedPoolId(selectedPool.id);
                        })
                      }
                    >
                      Formula
                    </button>
                    <button
                      type="button"
                      className="ea-btn ea-btn--primary"
                      onClick={() =>
                        open("reconcileWizard", () => {
                          setSelectedPoolId(selectedPool.id);
                        })
                      }
                    >
                      Reconcile
                    </button>
                  </div>
                </>
              ) : null}

              {/* pool statement */}
              {modal.kind === "poolStatement" && selectedPool ? (
                <>
                  <p className="ea-modal-lede">
                    Every day this position has moved money, with the running total
                    for the position alone.
                  </p>
                  <div className="ea-statement">
                    <header>
                      <span className="ea-panel-label">
                        {selectedPool.code} · {selectedPool.name}
                      </span>
                      <span className="mono">
                        {money(selectedPool.net, 2)} net · {selectedPool.daysTotal} days
                      </span>
                    </header>
                    <div className="ea-table-wrap">
                      <table className="ea-table">
                        <thead>
                          <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Kind</th>
                            <th scope="col">Amount</th>
                            <th scope="col">Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.timeline
                            .filter((row) => row.pools.some((line) => line.code === selectedPool.code))
                            .map((row) => {
                              const line = row.pools.find((entry) => entry.code === selectedPool.code);
                              return (
                                <tr key={row.id}>
                                  <td data-label="Date">{row.date}</td>
                                  <td data-label="Kind">{row.kind}</td>
                                  <td data-label="Amount" className="mono">
                                    {signed(line?.amount ?? 0, 2)}
                                  </td>
                                  <td data-label="Detail">{row.detail}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2}>Total</td>
                            <td className="mono">{money(selectedPool.net, 2)}</td>
                            <td>{selectedPool.note}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                  <div className="ea-modal-actions">
                    <button
                      type="button"
                      className="ea-btn ea-btn--primary"
                      onClick={() => {
                        const rows = data.timeline
                          .filter((row) => row.pools.some((line) => line.code === selectedPool.code))
                          .map((row) => {
                            const line = row.pools.find((entry) => entry.code === selectedPool.code);
                            return [row.date, row.kind, line?.amount ?? 0, row.running, row.detail];
                          });
                        download(
                          csvOf({
                            title: `${selectedPool.code} statement`,
                            header: ["Date", "Kind", "Amount", "Running", "Detail"],
                            rows,
                          }),
                          `trademo-${selectedPool.code}-statement-${asOf.slice(0, 10)}.csv`,
                          "text/csv",
                        );
                        pushToast({
                          tone: "success",
                          title: `${selectedPool.code} statement downloaded`,
                          detail: `${rows.length} rows · ${money(selectedPool.net, 2)} net`,
                        });
                      }}
                    >
                      <Icon name="download" size={13} /> Download statement
                    </button>
                    <button type="button" className="ea-btn" onClick={() => open("formulaDetail")}>
                      Show the formula
                    </button>
                  </div>
                </>
              ) : null}

              {/* formula detail */}
              {modal.kind === "formulaDetail" && selectedSample ? (
                <>
                  <p className="ea-modal-lede">
                    {selectedSample.poolCode} {selectedSample.poolName}: the five steps
                    from pool result to the figure in your wallet.
                  </p>
                  <ol className="ea-method">
                    {selectedSample.steps.map((step) => (
                      <li key={step.key}>
                        <b>{step.label}</b>
                        <span className="mono">
                          {step.expression} ={" "}
                          {step.unit === "pct"
                            ? `+${step.value.toFixed(2)}%`
                            : `${step.value < 0 ? "−" : ""}${money(Math.abs(step.value), 2)}`}
                        </span>
                        <small>{step.note}</small>
                      </li>
                    ))}
                  </ol>
                  <div className="ea-identity">
                    <span className="ea-panel-label">Check</span>
                    <p className="mono">
                      {money(selectedSample.gross, 2)} gross − {money(selectedSample.cut, 2)} cut ={" "}
                      {money(selectedSample.net, 2)} net · ROI +{selectedSample.roiPct.toFixed(2)}%
                    </p>
                  </div>
                  <div className="ea-modal-actions">
                    <button type="button" className="ea-btn" onClick={() => open("samplePicker")}>
                      Trace another pool
                    </button>
                    <button type="button" className="ea-btn" onClick={() => void refresh()}>
                      <Icon name="refresh" size={12} /> Recalculate now
                    </button>
                  </div>
                </>
              ) : null}

              {/* sample picker */}
              {modal.kind === "samplePicker" ? (
                <>
                  <p className="ea-modal-lede">
                    Each cycle keeps its own working. Pick one to load it into the
                    formula card.
                  </p>
                  <div className="ea-option-stack">
                    {formulaData.samples.map((sample) => (
                      <button
                        key={sample.poolCode}
                        type="button"
                        className={`ea-option-row ${selectedSample?.poolCode === sample.poolCode ? "is-active" : ""}`}
                        onClick={() => {
                          setSelectedPoolId(
                            pools.find((row) => row.code === sample.poolCode)?.id ?? selectedPoolId,
                          );
                          close();
                        }}
                      >
                        <span className="ea-jurisdiction__code mono">{sample.poolCode}</span>
                        <span className="ea-option-row__body">
                          <strong>{sample.poolName}</strong>
                          <small className="mono">
                            {money(sample.poolPnl, 0)} P&amp;L · {sample.sharePct.toFixed(2)}% share
                          </small>
                        </span>
                        <b className="mono is-pos">{signed(sample.net, 2)}</b>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {/* reconcile log */}
              {modal.kind === "reconcileLog" ? (
                <>
                  <p className="ea-modal-lede">
                    Which positions have been checked against the pool ledger, and when.
                  </p>
                  <div className="ea-table-wrap">
                    <table className="ea-table">
                      <thead>
                        <tr>
                          <th scope="col">Position</th>
                          <th scope="col">Status</th>
                          <th scope="col">Net</th>
                          <th scope="col">Last checked</th>
                          <th scope="col" aria-label="Action" />
                        </tr>
                      </thead>
                      <tbody>
                        {pools.map((pool) => (
                          <tr key={pool.id}>
                            <td data-label="Position">
                              {pool.code} {pool.name}
                            </td>
                            <td data-label="Status">{pool.status === "live" ? "Accruing" : "Settled"}</td>
                            <td data-label="Net" className="mono">
                              {money(pool.net, 2)}
                            </td>
                            <td data-label="Last checked">
                              {pool.reconciledAt ? shortDateOf(pool.reconciledAt) : "Not yet"}
                            </td>
                            <td className="ea-table__action" data-label="Action">
                              <button
                                type="button"
                                className="ea-btn ea-btn--sm"
                                onClick={() =>
                                  open("reconcileWizard", () => {
                                    setSelectedPoolId(pool.id);
                                  })
                                }
                              >
                                Check
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="ea-export-preview">
                    <span className="ea-panel-label">Desk events</span>
                    <ul className="ea-rule-list">
                      {data.audit.slice(0, 4).map((row) => (
                        <li key={row.id}>
                          <Icon name="activity" size={12} />{" "}
                          <span className="mono">
                            {shortDateOf(row.at)} {clockShort(row.at)}
                          </span>{" "}
                          {row.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}

              {/* timeline detail */}
              {modal.kind === "timelineDetail" && selectedDay ? (
                <>
                  <div className="ea-kpi-head">
                    <span className="ea-panel-label">{selectedDay.label}</span>
                    <b className="mono is-pos">{signed(selectedDay.amount, 2)}</b>
                    <small>
                      {selectedDay.kind} · running {money(selectedDay.running, 2)}
                    </small>
                  </div>
                  <Kv
                    rows={[
                      ["Date", selectedDay.date],
                      ["Settled", money(selectedDay.settled, 2)],
                      ["Accrued", money(selectedDay.accrued, 2)],
                      ["Running total", money(selectedDay.running, 2)],
                      ["Positions", `${selectedDay.rows}`],
                    ]}
                  />
                  <ul className="ea-check-list">
                    {selectedDay.pools.map((line) => (
                      <li key={line.code}>
                        <Icon name="check" size={13} /> {line.code} contributed{" "}
                        <b className="mono">{signed(line.amount, 2)}</b>
                      </li>
                    ))}
                  </ul>
                  <p className="ea-modal-note">
                    <Icon name="info" size={12} /> {selectedDay.detail}
                  </p>
                  <div className="ea-modal-actions">
                    <button type="button" className="ea-btn" onClick={() => open("timelineRules")}>
                      How a day is built
                    </button>
                    <button type="button" className="ea-btn" onClick={() => void downloadCsv("timeline")}>
                      <Icon name="download" size={12} /> Export the window
                    </button>
                  </div>
                </>
              ) : null}

              {/* timeline rules */}
              {modal.kind === "timelineRules" ? (
                <>
                  <p className="ea-modal-lede">
                    One row per UTC day that moved earnings. Two kinds of movement,
                    never both counted twice.
                  </p>
                  <ol className="ea-method">
                    <li>
                      <b>Settlement</b>
                      <span className="mono">cycle closes → net lands</span>
                      <small>
                        PKG-00 posted {money(1180.8, 2)} on 10 Oct and PKG-06 posted{" "}
                        {money(849.6, 2)} on 21 Oct.
                      </small>
                    </li>
                    <li>
                      <b>Accrual</b>
                      <span className="mono">net ÷ days run</span>
                      <small>
                        PKG-01 spreads {money(1260, 2)} across 13 days, PKG-03{" "}
                        {money(1350, 2)} across 10 — the last day absorbs rounding.
                      </small>
                    </li>
                    <li>
                      <b>Running total</b>
                      <span className="mono">Σ amount to date</span>
                      <small>
                        The final row on “all time” is the lifetime KPI: {money(totals.net, 2)}.
                      </small>
                    </li>
                  </ol>
                  <p className="ea-modal-note">
                    <Icon name="clock" size={12} /> Windows are inclusive of today and
                    measured back from {shortDateOf(asOf)}.
                  </p>
                </>
              ) : null}

              {/* forecast */}
              {modal.kind === "forecast" ? (
                <>
                  <p className="ea-modal-lede">
                    Two scenarios for the next fourteen days, driven by the current
                    daily accrual of the live cycles.
                  </p>
                  <div className="ea-forecast">
                    <div className="ea-forecast__legend">
                      <span>
                        <i className="is-live" /> Current pace
                      </span>
                      <span>
                        <i className="is-cons" /> 28% slower
                      </span>
                      <span>
                        <i className="is-banked" /> Already banked
                      </span>
                    </div>
                    <div className="ea-forecast__bars">
                      {data.forecast.map((point) => {
                        const max = Math.max(...data.forecast.map((row) => row.live));
                        return (
                          <div key={point.day} className="ea-forecast__col">
                            <span
                              className="ea-forecast__live"
                              style={{ height: `${Math.max(6, (point.live / max) * 100)}%` }}
                              title={`${money(point.live, 2)} at current pace`}
                            />
                            <span
                              className="ea-forecast__cons"
                              style={{ height: `${Math.max(4, (point.conservative / max) * 100)}%` }}
                              title={`${money(point.conservative, 2)} if slower`}
                            />
                            <small className="mono">{point.day === 0 ? "now" : `+${point.day}d`}</small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="ea-table-wrap">
                    <table className="ea-table">
                      <thead>
                        <tr>
                          <th scope="col">Day</th>
                          <th scope="col">Date</th>
                          <th scope="col">Current pace</th>
                          <th scope="col">Slow scenario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.forecast.filter((point) => point.day % 2 === 0).map((point) => (
                          <tr key={point.day}>
                            <td data-label="Day">{point.day === 0 ? "Now" : `+${point.day}`}</td>
                            <td data-label="Date">{shortDateOf(point.date)}</td>
                            <td data-label="Current pace" className="mono">
                              {money(point.live, 2)}
                            </td>
                            <td data-label="Slow scenario" className="mono">
                              {money(point.conservative, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="ea-modal-actions">
                    <button type="button" className="ea-btn" onClick={() => open("forecastAssumptions")}>
                      Assumptions
                    </button>
                    <button type="button" className="ea-btn" onClick={() => void downloadCsv("timeline")}>
                      Export the basis
                    </button>
                  </div>
                </>
              ) : null}

              {/* forecast assumptions */}
              {modal.kind === "forecastAssumptions" ? (
                <>
                  <p className="ea-modal-lede">
                    A projection, not a promise. Three assumptions move every bar.
                  </p>
                  <ul className="ea-check-list">
                    <li>
                      <Icon name="check" size={13} /> Both live cycles keep accruing at{" "}
                      <b className="mono">
                        {money(pools.filter((row) => row.status === "live").reduce((sum, row) => sum + row.dailyAvg, 0), 2)}
                        /day
                      </b>
                    </li>
                    <li>
                      <Icon name="check" size={13} /> The slow scenario shaves 28% off that pace
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Nothing new is booked inside the window
                    </li>
                    <li>
                      <Icon name="alert" size={13} /> A guardian pause or a losing cycle breaks all three
                    </li>
                  </ul>
                  <p className="ea-disclaimer">
                    <Icon name="alert" size={12} /> Projections are arithmetic, not
                    advice. Past cycles do not guarantee the next one.
                  </p>
                </>
              ) : null}

              {/* month progress */}
              {modal.kind === "monthProgress" ? (
                <>
                  <div className="ea-kpi-head">
                    <span className="ea-panel-label">{month.label}</span>
                    <b className="mono is-pos">{money(month.net, 2)}</b>
                    <small>
                      {month.sharePct.toFixed(1)}% of lifetime · {month.daysElapsed} of{" "}
                      {month.daysInMonth} days
                    </small>
                  </div>
                  <Bar value={month.net} target={totals.net} tone="is-accent" />
                  <Kv
                    rows={[
                      ["Settled this month", money(month.settled, 2)],
                      ["Accrued and unsettled", money(month.accrued, 2)],
                      ["Average per day", money(month.net / Math.max(1, month.daysElapsed), 2)],
                      ["Days left", `${month.daysInMonth - month.daysElapsed}`],
                      [
                        "Best day",
                        month.bestDay ? `${month.bestDay.label} · ${signed(month.bestDay.amount, 2)}` : "—",
                      ],
                    ]}
                  />
                  <div className="ea-export-preview">
                    <span className="ea-panel-label">Days in the window</span>
                    <ul className="ea-rule-list">
                      {data.timeline
                        .filter((row) => row.date.startsWith(asOf.slice(0, 7)))
                        .map((row) => (
                          <li key={row.id}>
                            <span className="mono">{row.label}</span> · {row.detail} ·{" "}
                            <b className="mono">{signed(row.amount, 2)}</b>
                          </li>
                        ))}
                    </ul>
                  </div>
                </>
              ) : null}

              {/* lifetime breakdown */}
              {modal.kind === "lifetimeBreakdown" ? (
                <>
                  <p className="ea-modal-lede">
                    Five positions, one sum. The table is the same matrix the export
                    writes.
                  </p>
                  <div className="ea-table-wrap">
                    <table className="ea-table">
                      <thead>
                        <tr>
                          <th scope="col">Pool</th>
                          <th scope="col">Status</th>
                          <th scope="col">Invested</th>
                          <th scope="col">Gross</th>
                          <th scope="col">Cut</th>
                          <th scope="col">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pools.map((pool) => (
                          <tr key={pool.id}>
                            <td data-label="Pool">
                              {pool.code} {pool.name}
                            </td>
                            <td data-label="Status">{pool.status === "live" ? "Accruing" : "Settled"}</td>
                            <td data-label="Invested" className="mono">
                              {money(pool.investment, 0)}
                            </td>
                            <td data-label="Gross" className="mono">
                              {money(pool.gross, 2)}
                            </td>
                            <td data-label="Cut" className="mono is-cut">
                              −{money(pool.cut, 2)}
                            </td>
                            <td data-label="Net" className="mono is-pos">
                              {money(pool.net, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>Total</td>
                          <td className="mono">{money(totals.investment, 0)}</td>
                          <td className="mono">{money(totals.gross, 2)}</td>
                          <td className="mono is-cut">−{money(totals.cut, 2)}</td>
                          <td className="mono is-pos">{money(totals.net, 2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="ea-modal-note">
                    <Icon name="info" size={12} /> Weighted ROI +{pct(totals.avgRoi, 2)} on{" "}
                    {money(totals.investment, 0)} of committed capital.
                  </p>
                </>
              ) : null}

              {/* tax notes */}
              {modal.kind === "taxNotes" ? (
                <>
                  <p className="ea-modal-lede">
                    Every line, with the row it came from. Fees are deductible; the
                    wallet balance is not earnings.
                  </p>
                  <div className="ea-table-wrap">
                    <table className="ea-table">
                      <thead>
                        <tr>
                          <th scope="col">Line</th>
                          <th scope="col">Amount</th>
                          <th scope="col">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tax.notes.map((note) => (
                          <tr key={note.label}>
                            <td data-label="Line">{note.label}</td>
                            <td data-label="Amount" className={`mono ${note.tone}`}>
                              {signed(note.value, 2)}
                            </td>
                            <td data-label="Source">{note.hint}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="ea-identity">
                    <span className="ea-panel-label">Identity</span>
                    <p className="mono">
                      {money(tax.totals.gross, 2)} gross − {money(tax.totals.cut, 2)} fee ={" "}
                      {money(tax.totals.net, 2)} net = {money(tax.totals.withdrawn, 2)} withdrawn +{" "}
                      {money(tax.totals.locked, 2)} locked
                    </p>
                  </div>
                </>
              ) : null}

              {/* tax jurisdiction */}
              {modal.kind === "taxJurisdiction" && jurisdictionRow ? (
                <>
                  <div className="ea-kpi-head">
                    <span className="ea-panel-label">
                      {jurisdictionRow.label} · {jurisdictionRow.form}
                    </span>
                    <b className="mono">{jurisdictionRow.current ? "Pinned" : "Available"}</b>
                    <small>
                      {jurisdictionRow.status === "ready"
                        ? "All documents present"
                        : "One document missing"}
                    </small>
                  </div>
                  <p className="ea-modal-lede">{jurisdictionRow.note}</p>
                  <ul className="ea-check-list">
                    <li>
                      <Icon name={jurisdictionRow.status === "ready" ? "check" : "alert"} size={13} />{" "}
                      {jurisdictionRow.status === "ready"
                        ? "Form supported today"
                        : "Needs a profile field before pre-fill"}
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Fiscal year {tax.year} · filing window{" "}
                      {tax.filingWindow}
                    </li>
                    <li>
                      <Icon name="check" size={13} /> {tax.notes.length} lines ready, gross and fee
                      separated
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Withdrawals carry bank references for the
                      statement
                    </li>
                  </ul>
                  <div className="ea-modal-actions">
                    <button
                      type="button"
                      className="ea-btn ea-btn--primary"
                      onClick={() =>
                        void run(
                          { kind: "pinJurisdiction", code: jurisdictionRow.code },
                          {
                            title: `${jurisdictionRow.label} pinned`,
                            detail: `${jurisdictionRow.form} · ${
                              jurisdictionRow.status === "ready"
                                ? "ready to file"
                                : "partial — one document missing"
                            }`,
                            tone: jurisdictionRow.status === "ready" ? "success" : "warning",
                          },
                        )
                      }
                    >
                      Pin this jurisdiction
                    </button>
                    <button
                      type="button"
                      className="ea-btn"
                      onClick={() => void downloadTax("pdf", tax.year)}
                    >
                      Download PDF pack
                    </button>
                  </div>
                </>
              ) : null}

              {/* tax checklist */}
              {modal.kind === "taxChecklist" ? (
                <>
                  <p className="ea-modal-lede">
                    The desk can assemble six of the seven items below; the seventh
                    is yours to confirm.
                  </p>
                  <ul className="ea-check-list is-tall">
                    <li>
                      <Icon name="check" size={13} /> Gross earnings and platform fee split — {money(tax.totals.gross, 2)} / {money(tax.totals.cut, 2)}
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Net earnings reconciled to the wallet — {money(tax.totals.net, 2)}
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Withdrawals with bank references — {money(tax.totals.withdrawn, 2)}
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Amounts still locked in cycles — {money(tax.totals.locked, 2)}
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Bank return fee recorded — $12.00 on 16 Sep
                    </li>
                    <li>
                      <Icon name="check" size={13} /> Jurisdiction form mapped — {jurisdictionLabel(selectedJurisdiction)}
                    </li>
                    <li>
                      <Icon name="alert" size={13} /> Your tax residency and any foreign-income relief
                    </li>
                  </ul>
                  <div className="ea-modal-actions">
                    <button
                      type="button"
                      className="ea-btn ea-btn--primary"
                      onClick={() => void downloadTax("pdf", tax.year)}
                    >
                      <Icon name="file" size={13} /> Download the pack
                    </button>
                    <button
                      type="button"
                      className="ea-btn"
                      onClick={() =>
                        void run(
                          { kind: "acknowledge", scope: "tax" },
                          {
                            title: "Checklist acknowledged",
                            detail: "The tax disclaimer is on the page and in every pack.",
                            tone: "info",
                          },
                        )
                      }
                    >
                      Acknowledge disclaimer
                    </button>
                  </div>
                </>
              ) : null}

              {/* tax documents */}
              {modal.kind === "taxDocuments" ? (
                <>
                  <p className="ea-modal-lede">
                    {tax.documents.length} documents on file for fiscal {tax.year}. Older
                    years are kept for the five-year record.
                  </p>
                  <ul className="ea-docs is-tall">
                    {tax.documents.map((doc) => (
                      <li key={doc.id}>
                        <span className={`ea-doc-icon is-${doc.format}`}>
                          <Icon name={doc.format === "pdf" ? "file" : "download"} size={13} />
                        </span>
                        <span className="ea-doc-body">
                          <b>{doc.name}</b>
                          <small className="mono">
                            {doc.kind} · {doc.sizeKb} KB · {doc.reference}
                          </small>
                          <small className="ea-muted">{doc.note}</small>
                        </span>
                        <button
                          type="button"
                          className="ea-btn ea-btn--sm"
                          onClick={() => void downloadTax(doc.format === "csv" ? "csv" : "pdf", tax.year)}
                        >
                          Get
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="ea-modal-actions">
                    <button
                      type="button"
                      className="ea-btn ea-btn--primary"
                      onClick={() => void downloadTax("csv", tax.year)}
                    >
                      <Icon name="download" size={13} /> New workbook
                    </button>
                    <button type="button" className="ea-btn" onClick={() => open("taxWizard")}>
                      Build a pack
                    </button>
                  </div>
                </>
              ) : null}

              {/* reports library */}
              {modal.kind === "reportsLibrary" ? (
                <>
                  <p className="ea-modal-lede">
                    Sorted and filterable, generated from the rows on this page. A stale
                    report means the book moved after it was written.
                  </p>
                  <div className="ea-table-wrap">
                    <table className="ea-table">
                      <thead>
                        {reportsTable.getHeaderGroups().map((group) => (
                          <tr key={group.id}>
                            {group.headers.map((header) => (
                              <th key={header.id} scope="col">
                                {header.isPlaceholder ? null : (
                                  <button
                                    type="button"
                                    className="ea-sort"
                                    onClick={header.column.getToggleSortingHandler()}
                                    disabled={!header.column.getCanSort()}
                                  >
                                    {header.column.columnDef.header as string}
                                    {header.column.getIsSorted() ? (
                                      <Icon name="chevronDown" size={11} />
                                    ) : null}
                                  </button>
                                )}
                              </th>
                            ))}
                            <th scope="col" aria-label="Detail" />
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {reportsTable.getRowModel().rows.map(({ original: row }) => (
                          <tr key={row.id}>
                            <td data-label="Report">
                              <b>{row.title}</b>
                              <small className="ea-muted mono">{row.reference}</small>
                            </td>
                            <td data-label="Kind">{reportKindLabel(row.kind)}</td>
                            <td data-label="Period">{periodLabel(row.period as EarningsPeriod)}</td>
                            <td data-label="Format">{formatLabel(row.format)}</td>
                            <td data-label="Status">
                              <Tag tone={reportStatusTone(row.status)}>{row.status}</Tag>
                            </td>
                            <td className="ea-table__action" data-label="Detail">
                              <button
                                type="button"
                                className="ea-btn ea-btn--sm"
                                onClick={() =>
                                  open("reportDetail", () => {
                                    setSelectedReportId(row.id);
                                  })
                                }
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="ea-modal-actions">
                    <button type="button" className="ea-btn ea-btn--primary" onClick={() => open("reportWizard")}>
                      Generate a report
                    </button>
                    <button type="button" className="ea-btn" onClick={() => open("exportShelf")}>
                      Export shelf ({library.exports.length})
                    </button>
                  </div>
                </>
              ) : null}

              {/* report detail */}
              {modal.kind === "reportDetail" && selectedReport ? (
                <>
                  <div className="ea-kpi-head">
                    <span className="ea-panel-label">
                      {reportKindLabel(selectedReport.kind)} · {selectedReport.reference}
                    </span>
                    <b className="mono">{selectedReport.title}</b>
                    <small>
                      {formatLabel(selectedReport.format)} · {selectedReport.sizeKb} KB ·{" "}
                      {selectedReport.generatedAt ? shortDateOf(selectedReport.generatedAt) : "not generated"}
                    </small>
                  </div>
                  <Kv
                    rows={[
                      ["Period", periodLabel(selectedReport.period as EarningsPeriod)],
                      ["Scope", selectedReport.scope],
                      ["Status", selectedReport.status],
                      ["Positions covered", `${pools.length}`],
                      ["Timeline rows", `${data.timeline.length}`],
                    ]}
                  />
                  <div className="ea-modal-actions">
                    <button
                      type="button"
                      className="ea-btn ea-btn--primary"
                      onClick={() => void downloadCsv("by-pool")}
                    >
                      <Icon name="download" size={12} /> Download rows
                    </button>
                    <button
                      type="button"
                      className="ea-btn"
                      onClick={() =>
                        void run(
                          { kind: "downloadReport", id: selectedReport.id },
                          {
                            title: `${selectedReport.title} refreshed`,
                            detail: `${selectedReport.reference} re-stamped at ${clockShort(asOf)} UTC`,
                          },
                        )
                      }
                    >
                      <Icon name="refresh" size={12} /> Regenerate
                    </button>
                    <button type="button" className="ea-btn" onClick={() => open("reportsLibrary")}>
                      Library
                    </button>
                  </div>
                </>
              ) : null}

              {/* payout ledger */}
              {modal.kind === "payoutLedger" ? (
                <>
                  <p className="ea-modal-lede">
                    What left the platform, with the fee and the bank reference. Paid and
                    processing are the only two states.
                  </p>
                  <div className="ea-table-wrap">
                    <table className="ea-table">
                      <thead>
                        {payoutsTable.getHeaderGroups().map((group) => (
                          <tr key={group.id}>
                            {group.headers.map((header) => (
                              <th key={header.id} scope="col">
                                {header.isPlaceholder ? null : (
                                  <button
                                    type="button"
                                    className="ea-sort"
                                    onClick={header.column.getToggleSortingHandler()}
                                    disabled={!header.column.getCanSort()}
                                  >
                                    {header.column.columnDef.header as string}
                                    {header.column.getIsSorted() ? (
                                      <Icon name="chevronDown" size={11} />
                                    ) : null}
                                  </button>
                                )}
                              </th>
                            ))}
                            <th scope="col" aria-label="Detail" />
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {payoutsTable.getRowModel().rows.map(({ original: row }) => (
                          <tr key={row.id}>
                            <td data-label="Reference" className="mono">
                              {row.reference}
                            </td>
                            <td data-label="Pool">{row.poolCode}</td>
                            <td data-label="Net to you" className="mono">
                              {money(row.net, 2)}
                            </td>
                            <td data-label="Status">
                              <Tag tone={row.status === "paid" ? "is-pos" : "is-live"}>
                                {row.status === "paid" ? "Paid" : "Processing"}
                              </Tag>
                            </td>
                            <td data-label="Paid">{row.paidAt ? shortDateOf(row.paidAt) : "—"}</td>
                            <td className="ea-table__action" data-label="Detail">
                              <button
                                type="button"
                                className="ea-btn ea-btn--sm"
                                onClick={() =>
                                  open("exportWizard", () => setExportScope("payouts"))
                                }
                              >
                                Export
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="ea-payout-totals">
                    <span>
                      Paid <b className="mono is-pos">{money(library.payoutTotals.paid, 2)}</b>
                    </span>
                    <span>
                      Processing <b className="mono">{money(library.payoutTotals.processing, 2)}</b>
                    </span>
                    <span>
                      Fees <b className="mono is-cut">{money(library.payoutTotals.fees, 2)}</b>
                    </span>
                  </div>
                </>
              ) : null}

              {/* export shelf */}
              {modal.kind === "exportShelf" ? (
                <>
                  <p className="ea-modal-lede">
                    {library.exports.length} of {MAX_EXPORTS} local slots used. Clearing
                    the shelf removes the records, never the underlying rows.
                  </p>
                  {library.exports.length ? (
                    <ul className="ea-shelf">
                      {library.exports.map((row) => (
                        <li key={row.id}>
                          <span className={`ea-doc-icon is-${row.format}`}>
                            <Icon name={row.format === "csv" ? "download" : "file"} size={13} />
                          </span>
                          <span className="ea-doc-body">
                            <b>
                              {scopeLabel(row.scope)} · {formatLabel(row.format)}
                            </b>
                            <small className="mono">
                              {row.rows} rows · {(row.bytes / 1024).toFixed(1)} KB ·{" "}
                              {shortDateOf(row.createdAt)} {clockShort(row.createdAt)}
                            </small>
                          </span>
                          <span className="mono ea-muted">{row.reference}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ea-empty">
                      <span className="ea-empty__icon">
                        <Icon name="download" size={20} />
                      </span>
                      <h3>The shelf is empty</h3>
                      <p>Export any scope and it lands here with its own reference.</p>
                      <button type="button" className="ea-btn" onClick={() => open("exportWizard")}>
                        Export something
                      </button>
                    </div>
                  )}
                  <div className="ea-modal-actions">
                    <button type="button" className="ea-btn" onClick={() => open("exportWizard")}>
                      New export
                    </button>
                    <button
                      type="button"
                      className="ea-btn"
                      onClick={() =>
                        void run(
                          { kind: "clearExports" },
                          {
                            title: "Export shelf cleared",
                            detail: `${library.exports.length} records removed from this session`,
                            tone: "warning",
                          },
                        )
                      }
                    >
                      Clear the shelf
                    </button>
                  </div>
                </>
              ) : null}

              {/* audit trail */}
              {modal.kind === "auditTrail" ? (
                <>
                  <p className="ea-modal-lede">
                    Every write on this desk, newest first. Reads are not logged.
                  </p>
                  <ul className="ea-audit">
                    {data.audit.map((row) => (
                      <li key={row.id}>
                        <span className="ea-audit__dot" aria-hidden="true" />
                        <span className="ea-audit__body">
                          <b className="mono">{row.action.replace(/_/g, " ")}</b>
                          <small>{row.detail}</small>
                        </span>
                        <span className="mono ea-muted">
                          {shortDateOf(row.at)} {clockShort(row.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="ea-export-preview">
                    <span className="ea-panel-label">Support drafts</span>
                    {data.support.length ? (
                      <ul className="ea-rule-list">
                        {data.support.map((row) => (
                          <li key={row.id}>
                            <Icon name="mail" size={12} /> {topicLabel(row.topic)} ·{" "}
                            {row.message.slice(0, 70)}…
                            <button
                              type="button"
                              className="ea-link"
                              onClick={() => void run({ kind: "deleteDraft", id: row.id })}
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ea-muted">No drafts held.</p>
                    )}
                  </div>
                  <button type="button" className="ea-btn" onClick={() => open("resetDesk")}>
                    Reset the demo desk
                  </button>
                </>
              ) : null}

              {/* boundaries */}
              {modal.kind === "boundaries" ? (
                <>
                  <p className="ea-modal-lede">
                    This is a front-end build with backend-shaped data. Here is exactly
                    where the line sits.
                  </p>
                  <div className="ea-boundaries">
                    <div>
                      <span className="ea-panel-label is-pos">Real in this build</span>
                      <ul>
                        <li>Every figure is computed from the position book — no typed-in totals</li>
                        <li>Exports build a real CSV/JSON from the same matrix</li>
                        <li>Writes are validated by one command union and audited</li>
                        <li>Queries re-read their own slice every 3 minutes</li>
                      </ul>
                    </div>
                    <div>
                      <span className="ea-panel-label is-cut">Preview only</span>
                      <ul>
                        <li>Nothing is emailed — delivery is queued locally</li>
                        <li>The PDF button downloads the print matrix as JSON</li>
                        <li>Fiscal figures are a demo year, not a filed return</li>
                        <li>Reconciliation records a check; it moves no money</li>
                      </ul>
                    </div>
                  </div>
                  <p className="ea-disclaimer">
                    <Icon name="alert" size={12} /> {tax.disclaimer}
                  </p>
                  <button type="button" className="ea-btn" onClick={() => open("methodology")}>
                    Methodology
                  </button>
                </>
              ) : null}

              {/* reset */}
              {modal.kind === "resetDesk" ? (
                <>
                  <p className="ea-modal-lede">
                    Clears the export shelf and every local preference draft made in this
                    session. The workspace snapshot itself is untouched.
                  </p>
                  <Kv
                    rows={[
                      ["Exports held", `${library.exports.length}`],
                      ["Support drafts", `${data.support.length}`],
                      ["Statement preferences", `${periodLabel(prefs.defaultPeriod)} · ${jurisdictionLabel(prefs.jurisdiction)}`],
                      ["Positions", `${pools.length} (never touched)`],
                    ]}
                  />
                  <label className="ea-check ea-ack">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      aria-label="Confirm clearing the shelf"
                    />
                    I understand this clears the local export records.
                  </label>
                </>
              ) : null}
            </DeskModalShell>
          </div>
        ) : null}
      </div>
    </InvestorShell>
  );
}
