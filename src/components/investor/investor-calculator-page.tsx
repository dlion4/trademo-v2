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
  CALCULATOR_AS_OF,
  MAX_AMOUNT,
  MAX_DAYS,
  MAX_POOLS,
  MAX_ROI_PCT,
  MIN_AMOUNT,
  MIN_DAYS,
  MIN_POOLS,
  MIN_ROI_PCT,
  bookingDraftError,
  chartTicks,
  clamp,
  money,
  pct,
  round2,
  shortDateOf,
  signedMoney,
  signedPct,
  sparkline,
  slotCount,
  type CalculatorPool,
  type CalculatorPreset,
  type CalculatorWorkspace,
  type ExportFormat,
  type ExportScope,
  type HistoricalPool,
  type ScenarioRow,
  type ShareChannel,
  type SupportTopic,
} from "@/lib/investor/calculator";
import {
  projectCompound,
  projectFees,
  projectHistory,
  projectRoi,
  projectScenarios,
  useCalculator,
} from "@/lib/investor/use-calculator";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  InvestorShell,
  type InvestorDrawerTab,
  type InvestorNavKey,
  type InvestorQuickAction,
} from "./investor-shell";

/* ── Dialog registry ── */

type Kind =
  | "bookWizard"
  | "saveScenario"
  | "presetWizard"
  | "shareWizard"
  | "exportWizard"
  | "settingsWizard"
  | "supportWizard"
  | "methodology"
  | "assumptions"
  | "risk"
  | "feeSchedule"
  | "poolDetail"
  | "scenarioDetail"
  | "historicalDetail"
  | "compoundDetail"
  | "apyExplainer"
  | "slotMath"
  | "comparePools"
  | "savedScenarios"
  | "presetList"
  | "bookedQueue"
  | "shareLink"
  | "resetConfirm"
  | "boundaries";

const titles: Record<Kind, string> = {
  bookWizard: "Book this projection",
  saveScenario: "Save this scenario",
  presetWizard: "New calculator preset",
  shareWizard: "Share the projection",
  exportWizard: "Export the model",
  settingsWizard: "Calculator settings",
  supportWizard: "Ask the desk",
  methodology: "How the numbers are built",
  assumptions: "Assumptions & inputs",
  risk: "Risk disclosure",
  feeSchedule: "Fee schedule",
  poolDetail: "Pool reference",
  scenarioDetail: "Scenario breakdown",
  historicalDetail: "Past pool result",
  compoundDetail: "Compounding explained",
  apyExplainer: "Effective APY",
  slotMath: "How slots are counted",
  comparePools: "Pools you can model",
  savedScenarios: "Saved scenarios",
  presetList: "Your presets",
  bookedQueue: "Queued bookings",
  shareLink: "Shareable projection",
  resetConfirm: "Reset the calculator",
  boundaries: "Workspace boundaries",
};

const wizardSteps: Partial<Record<Kind, readonly string[]>> = {
  bookWizard: ["Slots & funding", "Review", "Confirm"],
  saveScenario: ["Label", "Confirm"],
  presetWizard: ["Name & inputs", "Confirm"],
  shareWizard: ["Channel", "Confirm"],
  exportWizard: ["Scope", "Format", "Confirm"],
  settingsWizard: ["Defaults", "Confirm"],
  supportWizard: ["Topic", "Message", "Confirm"],
};

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  bookWizard: "lg",
  saveScenario: "md",
  presetWizard: "md",
  shareWizard: "sm",
  exportWizard: "md",
  settingsWizard: "md",
  supportWizard: "md",
  methodology: "lg",
  assumptions: "lg",
  risk: "md",
  feeSchedule: "lg",
  poolDetail: "lg",
  scenarioDetail: "md",
  historicalDetail: "md",
  compoundDetail: "md",
  apyExplainer: "md",
  slotMath: "sm",
  comparePools: "xl",
  savedScenarios: "lg",
  presetList: "md",
  bookedQueue: "md",
  shareLink: "sm",
  resetConfirm: "sm",
  boundaries: "lg",
};

const quickActions: InvestorQuickAction[] = [
  { key: "save", label: "Save scenario", short: "Save", icon: "target" },
  { key: "book", label: "Book slots", short: "Book", icon: "lock" },
  { key: "export", label: "Export model", short: "Export", icon: "download" },
  { key: "presets", label: "Presets", short: "Presets", icon: "sliders" },
  { key: "compare", label: "Compare pools", short: "Compare", icon: "split" },
  { key: "pools", label: "Crowdfunding pools", short: "Pools", icon: "pool" },
];

const sections = [
  { key: "roi", label: "ROI", id: "wa-roi" },
  { key: "compound", label: "Compounding", id: "wa-compound" },
  { key: "fees", label: "Fees", id: "wa-fees" },
  { key: "scenarios", label: "Scenarios", id: "wa-scenarios" },
  { key: "history", label: "Track record", id: "wa-history" },
] as const;

const txnLabels: Record<string, string> = {
  slots: "Slots",
  investment: "Investment",
  conservative: "Conservative",
  expected: "Expected",
  optimistic: "Optimistic",
};

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
    <header className="ca-section-head">
      <div>
        <span className="ca-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="ca-section-aside">{aside}</div> : null}
    </header>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
  decimals = 2,
  prefix = "",
  suffix = "",
  big = false,
  delay = 0,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "is-pos" | "is-neg" | "is-cut" | "is-accent";
  decimals?: number;
  prefix?: string;
  suffix?: string;
  big?: boolean;
  delay?: number;
}) {
  const shown = useLiveCountUp(value);
  return (
    <div
      className={`ca-figure ${big ? "is-big" : ""}`}
      style={{ "--ca-delay": `${delay}ms` } as CSSProperties}
    >
      <span className="ca-figure__label">{label}</span>
      <b className={`ca-figure__value mono ${tone ?? ""}`}>
        {prefix}
        {shown.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix}
      </b>
      {hint ? <span className="ca-figure__hint">{hint}</span> : null}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="ca-slider">
      <span className="ca-slider__head">
        <span className="ca-slider__label">{label}</span>
        <b className="ca-slider__value mono">
          {suffix === "$"
            ? money(value)
            : suffix === "%"
              ? pct(value, Number.isInteger(value) ? 0 : 1)
              : `${value} ${suffix}`}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--ca-fill": `${fill}%` } as CSSProperties}
      />
      <span className="ca-slider__scale mono">
        <span>
          {suffix === "$" ? money(min) : suffix === "%" ? `${min}%` : `${min} ${suffix}`}
        </span>
        <span>
          {suffix === "$" ? money(max) : suffix === "%" ? `${max}%` : `${max} ${suffix}`}
        </span>
      </span>
      {hint ? <small className="ca-muted">{hint}</small> : null}
    </label>
  );
}

function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="ca-kv">
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
  return <span className={`ca-tag ${tone}`.trim()}>{children}</span>;
}

function poolTone(lifecycle: CalculatorPool["lifecycle"]) {
  return lifecycle === "open" ? "is-open" : lifecycle === "trading" ? "is-trading" : "is-upcoming";
}

function lifecycleLabel(lifecycle: CalculatorPool["lifecycle"]) {
  return lifecycle === "open" ? "Open" : lifecycle === "trading" ? "Trading" : "Upcoming";
}

/* ── Page ── */

export function InvestorCalculatorPage({
  initial,
  initialAction,
}: {
  initial: CalculatorWorkspace;
  initialAction?: string;
}) {
  const router = useRouter();
  const { data, command } = useCalculator(initial);
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
    book: "bookWizard",
    booking: "bookWizard",
    save: "saveScenario",
    scenario: "saveScenario",
    preset: "presetWizard",
    presets: "presetList",
    share: "shareWizard",
    link: "shareLink",
    export: "exportWizard",
    settings: "settingsWizard",
    support: "supportWizard",
    methodology: "methodology",
    assumptions: "assumptions",
    risk: "risk",
    fees: "feeSchedule",
    pool: "poolDetail",
    scenarios: "scenarioDetail",
    history: "historicalDetail",
    compound: "compoundDetail",
    apy: "apyExplainer",
    slots: "slotMath",
    compare: "comparePools",
    saved: "savedScenarios",
    queue: "bookedQueue",
    reset: "resetConfirm",
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
  const [drawer, setDrawer] = useState<
    "projection" | "compound" | "history" | null
  >(null);
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("calculator");
  const clock = initial.asOf;
  const [scenarioSorting, setScenarioSorting] = useState<SortingState>([]);
  const [historySorting, setHistorySorting] = useState<SortingState>([]);

  /* ROI inputs */
  const [amount, setAmount] = useState(initial.defaults.amount);
  const [roiPct, setRoiPct] = useState(initial.defaults.roiPct);
  const [durationDays, setDurationDays] = useState(initial.defaults.durationDays);
  const [poolId, setPoolId] = useState(initial.defaultPoolId);

  /* Compound inputs */
  const [cPrincipal, setCPrincipal] = useState(initial.defaults.amount);
  const [cRoi, setCRoi] = useState(initial.defaults.roiPct);
  const [cPools, setCPools] = useState(initial.preferences.compoundPools);
  const [cReinvest, setCReinvest] = useState(initial.preferences.reinvest);

  /* Fee inputs */
  const [feeAmount, setFeeAmount] = useState(initial.defaults.amount);
  const [feeRoi, setFeeRoi] = useState(initial.defaults.roiPct);
  const [railKey, setRailKey] = useState(
    initial.depositRails[0]?.key ?? "bank_transfer",
  );
  const [payoutId, setPayoutId] = useState(
    initial.payoutMethods.find((row) => row.payoutEnabled)?.id ??
      initial.payoutMethods[0]?.id ??
      "",
  );
  const [waived, setWaived] = useState(initial.preferences.payoutFeeWaived);

  /* Scenario inputs */
  const [scenarioPoolId, setScenarioPoolId] = useState(initial.defaultPoolId);
  const [selectedHistory, setSelectedHistory] = useState(
    initial.historical[initial.historical.length - 1]?.id ?? "",
  );

  /* Dialog-local state */
  const [presetName, setPresetName] = useState("");
  const [scenarioNote, setScenarioNote] = useState("");
  const [shareChannel, setShareChannel] = useState<ShareChannel>("copy");
  const [exportScope, setExportScope] = useState<ExportScope>("projection");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [prefs, setPrefs] = useState(initial.preferences);
  const [supportTopic, setSupportTopic] = useState<SupportTopic>("roi");
  const [supportMessage, setSupportMessage] = useState("");
  const [bookSlots, setBookSlots] = useState(1);
  const [bookNote, setBookNote] = useState("");
  const [bookPoolId, setBookPoolId] = useState(
    initial.pools.find((pool) => pool.bookable)?.id ?? initial.defaultPoolId,
  );

  /* ── Derived ── */

  const pool: CalculatorPool =
    data.pools.find((row) => row.id === poolId) ?? data.pools[0];
  const scenarioPool: CalculatorPool =
    data.pools.find((row) => row.id === scenarioPoolId) ?? pool;
  const bookPool: CalculatorPool =
    data.pools.find((row) => row.id === bookPoolId) ?? scenarioPool;

  const projection = projectRoi(data, amount, roiPct, durationDays);
  const compound = projectCompound(data, cPrincipal, cRoi, cPools, cReinvest);
  const rail = data.depositRails.find((row) => row.key === railKey) ?? data.depositRails[0];
  const payoutMethod =
    data.payoutMethods.find((row) => row.id === payoutId) ?? data.payoutMethods[0];
  const fees = projectFees(
    feeAmount,
    feeRoi,
    data.platformCutPct,
    rail,
    payoutMethod,
    waived,
  );
  const scenarios = projectScenarios(data, scenarioPool);
  const history = projectHistory(data);
  const historyPool: HistoricalPool | null =
    data.historical.find((row) => row.id === selectedHistory) ??
    data.historical[data.historical.length - 1] ??
    null;

  const chosenScenario =
    scenarios.find((row) => row.slots === bookSlots) ?? scenarios[0];
  // The booking wizard always prices slots at the destination pool's own slot
  // price, so switching pools inside the dialog re-prices the whole summary.
  const bookAmount = round2(bookSlots * bookPool.slotPrice);
  const bookGross = round2((bookAmount * projection.roiPct) / 100);
  const bookNet = round2(bookGross * (1 - data.platformCutPct / 100));

  const heroNet = useLiveCountUp(projection.netEarnings);
  const compoundChart = useMemo(() => {
    const series = [compound.principal, ...compound.rows.map((row) => row.end)];
    return { ...sparkline(series, 100, 38), series };
  }, [compound]);
  const compoundTicks = useMemo(
    () => chartTicks(compoundChart.series, 2),
    [compoundChart.series],
  );
  const historyBars = useMemo(() => {
    const max = Math.max(...data.historical.map((row) => row.roiPct), 1);
    return data.historical.map((row) => ({
      ...row,
      height: Math.max(6, round2((row.roiPct / max) * 100)),
    }));
  }, [data.historical]);
  const queued = data.savedScenarios.filter((row) => row.status === "queued");
  const savedOnly = data.savedScenarios.filter((row) => row.status === "saved");
  const compoundSignature = `${compound.principal}-${compound.roiPct}-${compound.pools}-${compound.reinvest}`;
  const scenarioSignature = scenarios.map((row) => row.investment).join("-");
  const historySignature = data.historical.map((row) => row.roiPct).join("-");

  const stepBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "presetWizard" && wizardStep === 0) {
      return presetName.trim().length >= 3
        ? ""
        : "Give the preset a name of at least three characters";
    }
    if (modal.kind === "saveScenario" && wizardStep === 0) {
      return scenarioNote.trim().length >= 3
        ? ""
        : "Add a short note so the scenario is recognisable later";
    }
    if (modal.kind === "supportWizard" && wizardStep === 1) {
      return supportMessage.trim().length >= 12
        ? ""
        : "Write at least 12 characters so the desk can act on it";
    }
    return "";
  })();

  const needsAck =
    modal?.kind === "bookWizard" || modal?.kind === "resetConfirm";

  const submitBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "bookWizard") {
      return bookingDraftError({
        amount: bookAmount,
        slots: bookSlots,
        maxSlots: bookPool.maxSlotsPerUser,
        available: data.profile.walletAvailable,
        terms: confirmed,
        requireFunds: false,
      });
    }
    if (modal.kind === "saveScenario") {
      return scenarioNote.trim().length >= 3 ? "" : "Add a note first";
    }
    if (modal.kind === "supportWizard") {
      return supportMessage.trim().length >= 12 ? "" : "Add a message first";
    }
    return "";
  })();

  /* ── Tables ── */

  const scenarioColumn = useMemo(() => createDeskColumnHelper<ScenarioRow>(), []);
  const scenarioColumns = useMemo(
    () =>
      scenarioColumn.columns([
        scenarioColumn.accessor("slots", {
          header: "Slots",
          cell: (info) => <b className="mono">{info.getValue()}</b>,
        }),
        scenarioColumn.accessor("investment", {
          header: "Investment",
          cell: (info) => <span className="mono">{money(info.getValue())}</span>,
        }),
        scenarioColumn.accessor("conservativeNet", {
          header: `Conservative · ${data.bands.conservative}%`,
          cell: (info) => (
            <span className="mono">{money(info.getValue(), 2)}</span>
          ),
        }),
        scenarioColumn.accessor("expectedNet", {
          header: `Expected · ${data.bands.expected}%`,
          cell: (info) => (
            <b className="mono is-pos">{money(info.getValue(), 2)}</b>
          ),
        }),
        scenarioColumn.accessor("optimisticNet", {
          header: `Optimistic · ${data.bands.optimistic}%`,
          cell: (info) => (
            <span className="mono">{money(info.getValue(), 2)}</span>
          ),
        }),
      ]),
    [scenarioColumn, data.bands],
  );
  const scenarioTable = useDeskTable({
    data: scenarios,
    columns: scenarioColumns,
    state: { sorting: scenarioSorting },
    onSortingChange: setScenarioSorting,
  });

  const historyColumn = useMemo(() => createDeskColumnHelper<HistoricalPool>(), []);
  const historyColumns = useMemo(
    () =>
      historyColumn.columns([
        historyColumn.accessor("code", {
          header: "Pool",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        historyColumn.accessor("completedAt", {
          header: "Closed",
          cell: (info) => (
            <span className="mono ca-muted">{shortDateOf(info.getValue())}</span>
          ),
        }),
        historyColumn.accessor("durationDays", {
          header: "Days",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        historyColumn.accessor("roiPct", {
          header: "ROI",
          cell: (info) => (
            <b className="mono is-pos">{signedPct(info.getValue(), 1)}</b>
          ),
        }),
        historyColumn.accessor("winRatePct", {
          header: "Win rate",
          cell: (info) => <span className="mono">{pct(info.getValue(), 1)}</span>,
        }),
        historyColumn.accessor("trades", {
          header: "Trades",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        historyColumn.accessor("capital", {
          header: "Capital",
          cell: (info) => <span className="mono">{money(info.getValue())}</span>,
        }),
      ]),
    [historyColumn],
  );
  const historyTable = useDeskTable({
    data: data.historical,
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

  function applyPool(next: CalculatorPool, target: "roi" | "scenario" = "roi") {
    if (target === "roi") {
      setPoolId(next.id);
      setAmount(
        clamp(
          slotCount(amount, next.slotPrice) * next.slotPrice,
          MIN_AMOUNT,
          MAX_AMOUNT,
        ),
      );
      setDurationDays(clamp(next.durationDays, MIN_DAYS, MAX_DAYS));
      setRoiPct(clamp(next.expectedRoiPct, MIN_ROI_PCT, MAX_ROI_PCT));
    } else {
      setScenarioPoolId(next.id);
    }
  }

  function applyPreset(preset: CalculatorPreset) {
    setAmount(preset.amount);
    setRoiPct(preset.roiPct);
    setDurationDays(preset.durationDays);
    setCPrincipal(preset.amount);
    setCRoi(preset.roiPct);
    setFeeAmount(preset.amount);
    setFeeRoi(preset.roiPct);
    pushToast({
      tone: "success",
      title: `${preset.name} loaded`,
      detail: `${money(preset.amount)} · ${pct(preset.roiPct)} · ${preset.durationDays} days`,
    });
    scrollTo("wa-roi");
  }

  async function run(
    input: Parameters<typeof command.mutateAsync>[0],
    opts?: { title?: string; detail?: string; keep?: boolean },
  ) {
    setBusy(true);
    setError("");
    try {
      await command.mutateAsync(input);
      pushToast({
        tone: "success",
        title: opts?.title ?? "Calculator updated",
        detail:
          opts?.detail ??
          "Held in this browser session. Nothing was reserved or charged.",
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

  function scopeRows(scope: ExportScope) {
    if (scope === "compound") {
      return compound.rows.map((row) => ({
        pool: row.index,
        start_balance: row.start,
        roi_pct: row.roiPct,
        gross: row.gross,
        platform_cut: row.cut,
        net: row.net,
        end_balance: row.end,
      }));
    }
    if (scope === "fees") {
      return [
        {
          investment: fees.amount,
          gross_earnings: fees.grossEarnings,
          deposit_fee: fees.depositFee,
          platform_share_pct: fees.platformSharePct,
          platform_share: fees.platformShare,
          payout_fee: fees.payoutFee,
          total_fees: fees.totalFees,
          net_earnings: fees.netEarnings,
          total_return: fees.totalReturn,
        },
      ];
    }
    if (scope === "scenarios") {
      return scenarios.map((row) => ({
        pool: scenarioPool.code,
        slots: row.slots,
        investment: row.investment,
        conservative_roi_pct: row.conservativeRoiPct,
        conservative_net: row.conservativeNet,
        expected_roi_pct: row.expectedRoiPct,
        expected_net: row.expectedNet,
        optimistic_roi_pct: row.optimisticRoiPct,
        optimistic_net: row.optimisticNet,
      }));
    }
    if (scope === "historical") {
      return data.historical.map((row) => ({
        code: row.code,
        name: row.name,
        closed: row.completedAt,
        days: row.durationDays,
        roi_pct: row.roiPct,
        win_rate_pct: row.winRatePct,
        trades: row.trades,
        capital: row.capital,
      }));
    }
    return [
      {
        amount: projection.amount,
        slots: projection.slots,
        slot_price: projection.slotPrice,
        roi_pct: projection.roiPct,
        duration_days: projection.durationDays,
        gross_earnings: projection.grossEarnings,
        platform_cut_pct: projection.platformCutPct,
        platform_cut: projection.platformCut,
        net_earnings: projection.netEarnings,
        total_return: projection.totalReturn,
        daily_net: projection.dailyNet,
        effective_apy_pct: projection.effectiveApy,
      },
    ];
  }

  async function exportModel(scope: ExportScope, heading: string) {
    setBusy(true);
    try {
      const rows = scopeRows(scope);
      const stamp = data.asOf.slice(0, 10);
      const base = `trademo-calculator-${scope}`;
      if (exportFormat === "json") {
        download(
          JSON.stringify(
            {
              mode: "demo",
              asOf: data.asOf,
              scope,
              inputs: { amount, roiPct, durationDays },
              platformCutPct: data.platformCutPct,
              rows,
            },
            null,
            2,
          ),
          `${base}-${stamp}.json`,
          "application/json",
        );
      } else if (exportFormat === "csv") {
        download(csvOf(rows), `${base}-${stamp}.csv`, "text/csv");
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setFontSize(15);
        doc.text(`tradeMO / ${heading}`, 18, 22);
        doc.setFontSize(9);
        doc.text(
          `Investor ${data.profile.displayName} · ${data.profile.kycLevel} verified · modelled ${stamp}`,
          18,
          30,
        );
        doc.text(
          `Inputs ${money(amount)} · ${pct(roiPct)} · ${durationDays} days · platform cut ${data.platformCutPct}%`,
          18,
          36,
        );
        doc.text(
          "Projection only — not an offer, a forecast or a payment confirmation.",
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
        doc.save(`${base}-${stamp}.pdf`);
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

  async function advance() {
    if (!modal) return;
    if (modal.kind === "shareWizard" && wizardStep === 0) {
      const link = `${typeof window === "undefined" ? "" : window.location.origin}/investor/calculator?action=compare`;
      if (shareChannel === "link" || shareChannel === "copy") {
        await copy(link, "Projection link");
      }
    }
    setWizardStep((step) => step + 1);
  }

  async function submit() {
    if (!modal) return;
    if (modal.kind === "bookWizard") {
      if (!chosenScenario) return;
      const ok = await run(
        {
          kind: "queueBooking",
          poolId: bookPool.id,
          poolCode: bookPool.code,
          slots: bookSlots,
          amount: bookAmount,
          roiPct: projection.roiPct,
          durationDays: durationDays,
          note: bookNote,
        },
        {
          keep: true,
          title: `${bookSlots} slot${bookSlots === 1 ? "" : "s"} handed to the booking flow`,
          detail: `${bookPool.code} · ${money(bookAmount)} · nothing reserved yet.`,
        },
      );
      if (!ok) return;
      close();
      router.push(
        bookPool.bookable
          ? `${bookPool.bookingHref}?slots=${bookSlots}`
          : bookPool.detailHref,
      );
      return;
    }
    if (modal.kind === "saveScenario") {
      if (!chosenScenario) return;
      await run({
        kind: "saveScenario",
        poolId: scenarioPool.id,
        poolCode: scenarioPool.code,
        slots: bookSlots,
        amount: bookAmount,
        roiPct: projection.roiPct,
        durationDays,
        band: "expected",
        note: scenarioNote,
      });
      return;
    }
    if (modal.kind === "presetWizard") {
      await run({
        kind: "savePreset",
        name: presetName,
        amount,
        roiPct,
        durationDays,
        note: `Saved from the ROI calculator at ${money(amount)}`,
      });
      return;
    }
    if (modal.kind === "shareWizard") {
      await run({
        kind: "shareProjection",
        amount,
        roiPct,
        durationDays,
        channel: shareChannel,
      });
      return;
    }
    if (modal.kind === "exportWizard") {
      await exportModel(exportScope, "Investment model");
      close();
      return;
    }
    if (modal.kind === "settingsWizard") {
      await run({
        kind: "savePreferences",
        reinvest: prefs.reinvest,
        compoundPools: prefs.compoundPools,
        showGross: prefs.showGross,
        includeFees: prefs.includeFees,
        payoutFeeWaived: prefs.payoutFeeWaived,
      });
      setCReinvest(prefs.reinvest);
      setCPools(prefs.compoundPools);
      setWaived(prefs.payoutFeeWaived);
      return;
    }
    if (modal.kind === "supportWizard") {
      await run({
        kind: "support",
        topic: supportTopic,
        message: supportMessage,
      });
      return;
    }
    if (modal.kind === "risk") {
      await run({ kind: "acknowledge", scope: "risk" });
      return;
    }
    if (modal.kind === "resetConfirm") {
      setAmount(data.defaults.amount);
      setRoiPct(data.defaults.roiPct);
      setDurationDays(data.defaults.durationDays);
      setCPrincipal(data.defaults.amount);
      setCRoi(data.defaults.roiPct);
      setCPools(data.preferences.compoundPools);
      setFeeAmount(data.defaults.amount);
      setFeeRoi(data.defaults.roiPct);
      setPoolId(data.defaultPoolId);
      setScenarioPoolId(data.defaultPoolId);
      await run(
        { kind: "resetCalculator", note: "" },
        { title: "Calculator reset to the brief's defaults" },
      );
    }
  }

  const submitLabel = !modal
    ? "Done"
    : modal.kind === "bookWizard"
      ? "Hand to booking"
      : modal.kind === "saveScenario"
        ? "Save scenario"
        : modal.kind === "presetWizard"
          ? "Save preset"
          : modal.kind === "shareWizard"
            ? "Record share"
            : modal.kind === "exportWizard"
              ? "Generate file"
              : modal.kind === "settingsWizard"
                ? "Save defaults"
                : modal.kind === "resetConfirm"
                  ? "Reset inputs"
                  : "Send to desk";

  const modalFooter = (
    <>
      {wizard && wizardStep === lastStep && needsAck ? (
        <label className="ca-check ca-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-label="Confirm this local preview"
          />
          {modal?.kind === "resetConfirm"
            ? "Reset every input on this calculator."
            : "I understand this is a projection, not a booking — no slot is reserved and no money moves."}
        </label>
      ) : null}
      {wizard ? (
        <span className="ca-muted">Projection only · no money moves</span>
      ) : null}
      <button type="button" className="ca-btn" onClick={close}>
        Close
      </button>
      {wizard && wizardStep > 0 ? (
        <button
          type="button"
          className="ca-btn"
          onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
        >
          <Icon name="arrowLeft" size={13} /> Back
        </button>
      ) : null}
      {wizard && wizardStep < lastStep ? (
        <button
          type="button"
          className="ca-btn ca-btn--primary"
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
          className="ca-btn ca-btn--primary"
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
      rootClass="page-investor-calculator"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={data.profile.walletAvailable}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.profile.walletAvailable}
      unread={data.profile.unread}
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
        if (key === "calculator") return setDrawer("projection");
        if (key === "notifications")
          return router.push("/investor/notifications");
        if (key === "earnings") return router.push("/investor/earnings");
        if (key === "activity") return router.push("/investor/activity");
        if (key === "settings") return router.push("/investor?action=profile");
        setDrawer("projection");
      }}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(
          tab === "portfolio"
            ? "compound"
            : tab === "activity"
              ? "history"
              : "projection",
        )
      }
      onQuickAction={(key) => {
        if (key === "save") return open("saveScenario");
        if (key === "book") return open("bookWizard");
        if (key === "export") return open("exportWizard");
        if (key === "presets") return open("presetList");
        if (key === "compare") return open("comparePools");
        if (key === "pools") return router.push("/investor/pools");
      }}
      onChromeReady={(chromeApi) => {
        chrome.current = chromeApi;
      }}
      onOpenNotifications={() => router.push("/investor/notifications")}
    >
      <div className="ca-page">
        <header className="ca-hero">
          <div className="ca-hero__main">
            <span className="ca-eyebrow">
              I-8 · INVESTOR WORKSPACE / RETURN MODELLING
            </span>
            <h1>Investment calculator</h1>
            <p className="ca-lede">
              Model a booking before you commit to one. Every figure below is
              derived from the same pool book, platform cut and payment rails the
              desk settles with — change an input and the numbers move with it.
            </p>

            <div className="ca-hero__model">
              <div className="ca-hero__figure">
                <span className="ca-hero__label">Projected net earnings</span>
                <b className="ca-hero__amount mono">
                  {money(heroNet, 2)}
                </b>
                <span className="ca-hero__sub">
                  {money(projection.amount)} at {pct(projection.roiPct)} over{" "}
                  {projection.durationDays} days ·{" "}
                  {signedPct(projection.netRoiPct, 2)} net after the{" "}
                  {data.platformCutPct}% platform cut
                </span>
              </div>
              <div className="ca-hero__chips">
                <span className="ca-chip mono">
                  total return {money(projection.totalReturn, 2)}
                </span>
                <span className="ca-chip mono">
                  ≈{Math.round(projection.effectiveApy)}% APY
                </span>
                <span className="ca-chip mono">
                  {projection.slots} slot{projection.slots === 1 ? "" : "s"}
                </span>
              </div>
              <button
                type="button"
                className="ca-disclaimer-dot"
                onClick={() => open("risk")}
              >
                Projections, not forecasts — read the risk disclosure
              </button>
              <div className="ca-actions">
                <button
                  type="button"
                  className="ca-btn ca-btn--primary"
                  onClick={() => open("bookWizard")}
                >
                  <Icon name="lock" size={14} /> Book this plan
                </button>
                <button
                  type="button"
                  className="ca-btn"
                  onClick={() => open("saveScenario")}
                >
                  <Icon name="target" size={14} /> Save scenario
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--ghost"
                  onClick={() => setDrawer("projection")}
                >
                  <Icon name="panelRight" size={14} /> Model drawer
                </button>
              </div>
            </div>
          </div>

          <aside className="ca-hero__side">
            <div className="ca-hero__card">
              <div className="ca-hero__card-head">
                <span className="ca-section-code">REFERENCE POOL</span>
                <Tag tone={poolTone(pool.lifecycle)}>
                  {lifecycleLabel(pool.lifecycle)}
                </Tag>
              </div>
              <b>{pool.code}</b>
              <span className="ca-muted">{pool.name}</span>
              <Kv
                rows={[
                  ["Slot price", <span className="mono" key="slot">{money(pool.slotPrice)}</span>],
                  ["Duration", `${pool.durationDays} days`],
                  ["Expected ROI", pct(pool.expectedRoiPct, 1)],
                  ["Risk band", pool.riskBand],
                  ["Closes", shortDateOf(pool.closesAt)],
                ]}
              />
              <div className="ca-hero__card-actions">
                <Link className="ca-btn ca-btn--sm" href={pool.detailHref}>
                  <Icon name="package" size={13} /> Pool page
                </Link>
                {pool.bookable ? (
                  <Link
                    className="ca-btn ca-btn--sm ca-btn--primary"
                    href={pool.bookingHref}
                  >
                    <Icon name="lock" size={13} /> Book
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="ca-btn ca-btn--sm"
                    onClick={() => open("comparePools")}
                  >
                    Compare pools
                  </button>
                )}
                <button
                  type="button"
                  className="ca-link"
                  onClick={() => open("assumptions")}
                >
                  Assumptions
                </button>
                <button
                  type="button"
                  className="ca-link"
                  onClick={() => open("methodology")}
                >
                  How this is built
                </button>
                <button
                  type="button"
                  className="ca-link"
                  onClick={() => open("risk")}
                >
                  Risk disclosure
                </button>
              </div>
            </div>
          </aside>
        </header>

        <nav className="ca-jump" aria-label="Calculator sections">
          <div className="ca-jump__links">
            {sections.map((section, index) => (
              <button
                key={section.key}
                type="button"
                className="ca-jump__link"
                onClick={() => scrollTo(section.id)}
              >
                <span className="mono">{String(index + 1).padStart(2, "0")}</span>
                {section.label}
              </button>
            ))}
          </div>
          <div className="ca-jump__meta">
            <button type="button" className="ca-link" onClick={() => open("methodology")}>
              Methodology
            </button>
            <button type="button" className="ca-link" onClick={() => open("feeSchedule")}>
              Fees
            </button>
            <button type="button" className="ca-link" onClick={() => open("presetList")}>
              Presets
            </button>
            <button type="button" className="ca-link" onClick={() => open("boundaries")}>
              Boundaries
            </button>
            <span className="mono ca-muted">
              {clock.slice(11, 16)} UTC · {data.profile.currency}
            </span>
          </div>
        </nav>

        {error && !modal ? (
          <p className="ca-error" role="alert">
            {error}
          </p>
        ) : null}

        {/* ── 1. ROI calculator ── */}
        <section id="wa-roi" className="ca-section">
          <SectionHead
            code="01 / ROI CALCULATOR"
            title="What this booking would pay"
            hint="Four inputs, live results. The platform cut comes off gross earnings, so net is what lands in the wallet after settlement."
            aside={
              <>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("slotMath")}
                >
                  Slot maths
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("apyExplainer")}
                >
                  APY basis
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm"
                  onClick={() => open("resetConfirm")}
                >
                  <Icon name="refresh" size={13} /> Reset
                </button>
              </>
            }
          />

          <div className="ca-split">
            <div className="ca-panel">
              <div className="ca-panel__head">
                <h3>Inputs</h3>
                <span className="ca-muted mono">
                  {money(projection.amount)} · {projection.slots} ×{" "}
                  {money(projection.slotPrice)}
                </span>
              </div>

              <Slider
                label="Investment amount"
                value={amount}
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={100}
                suffix="$"
                hint={`Slots are derived: ${money(amount)} ÷ ${money(pool.slotPrice)} = ${projection.slots}`}
                onChange={(next) => {
                  setAmount(next);
                  setCPrincipal(next);
                  setFeeAmount(next);
                }}
              />
              <Slider
                label="Expected ROI"
                value={roiPct}
                min={MIN_ROI_PCT}
                max={MAX_ROI_PCT}
                step={0.5}
                suffix="%"
                hint={`Pool expectation is ${pct(pool.expectedRoiPct, 1)} · band ${data.bands.conservative}–${data.bands.optimistic}%`}
                onChange={(next) => {
                  setRoiPct(next);
                  setCRoi(next);
                  setFeeRoi(next);
                }}
              />
              <Slider
                label="Duration"
                value={durationDays}
                min={MIN_DAYS}
                max={MAX_DAYS}
                step={1}
                suffix="days"
                hint={`${pool.code} runs ${pool.durationDays} days · a longer window annualises lower`}
                onChange={setDurationDays}
              />

              <div className="ca-inline-row">
                <span className="ca-muted">Snap to a pool</span>
                <div className="ca-chip-row">
                  {data.pools.slice(0, 6).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`ca-chip ca-chip--button ${row.id === pool.id ? "is-on" : ""}`}
                      onClick={() => applyPool(row)}
                    >
                      {row.code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ca-panel__actions">
                <button
                  type="button"
                  className="ca-btn ca-btn--sm"
                  onClick={() => open("presetWizard")}
                >
                  <Icon name="plus" size={13} /> Save as preset
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("presetList")}
                >
                  {data.presets.length} preset
                  {data.presets.length === 1 ? "" : "s"}
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("shareWizard")}
                >
                  <Icon name="link" size={13} /> Share
                </button>
              </div>
            </div>

            <div className="ca-panel ca-panel--results">
              <div className="ca-panel__head">
                <h3>Projected outcome</h3>
                <Tag tone="is-accent">
                  {projection.durationDays}-day cycle
                </Tag>
              </div>

              <div className="ca-result-hero">
                <span className="ca-muted">Net earnings</span>
                <b className="mono is-pos">{money(projection.netEarnings, 2)}</b>
                <span className="ca-muted mono">
                  {signedPct(projection.netRoiPct, 2)} on capital · after the{" "}
                  {data.platformCutPct}% cut
                </span>
              </div>

              <div className="ca-figure-grid">
                <Figure
                  label="Gross earnings"
                  value={projection.grossEarnings}
                  hint={`${money(projection.amount)} × ${pct(projection.roiPct, 1)}`}
                  delay={0}
                />
                <Figure
                  label={`Platform cut · ${data.platformCutPct}%`}
                  value={projection.platformCut}
                  tone="is-cut"
                  hint="Taken from gross, not from capital"
                  delay={60}
                />
                <Figure
                  label="Net earnings"
                  value={projection.netEarnings}
                  tone="is-pos"
                  hint="Credited to the wallet on settlement"
                  delay={120}
                />
                <Figure
                  label="Total return"
                  value={projection.totalReturn}
                  hint="Capital plus net earnings"
                  delay={180}
                />
                <Figure
                  label="Daily average net"
                  value={projection.dailyNet}
                  hint={`Over ${projection.durationDays} days`}
                  delay={240}
                />
                <Figure
                  label="Effective APY"
                  value={projection.effectiveApy}
                  decimals={0}
                  suffix="%"
                  hint="Annualised, not compounded"
                  tone="is-accent"
                  delay={300}
                />
              </div>

              <p className="ca-foot-note">
                {money(projection.grossEarnings, 2)} gross −{" "}
                {money(projection.platformCut, 2)} cut ={" "}
                {money(projection.netEarnings, 2)} net, paid with capital{" "}
                {projection.durationDays} days after the window closes. The APY
                figure simply scales this cycle to a year — it assumes you repeat
                the same result, which no desk can promise.
              </p>

              <div className="ca-panel__actions">
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--primary"
                  onClick={() => open("bookWizard")}
                >
                  <Icon name="lock" size={13} /> Book {projection.slots} slot
                  {projection.slots === 1 ? "" : "s"}
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm"
                  onClick={() => open("saveScenario")}
                >
                  Save scenario
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => setDrawer("projection")}
                >
                  Breakdown
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Compound growth ── */}
        <section id="wa-compound" className="ca-section">
          <SectionHead
            code="02 / COMPOUND GROWTH"
            title="Rolling the net forward"
            hint="Reinvesting each cycle compounds the net — the 20% cut is charged again on every new gross, so the curve is cooler than headline ROI suggests."
            aside={
              <>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("compoundDetail")}
                >
                  How it compounds
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("settingsWizard")}
                >
                  Defaults
                </button>
              </>
            }
          />

          <div className="ca-split ca-split--compound">
            <div className="ca-panel">
              <div className="ca-panel__head">
                <h3>Inputs</h3>
                <Tag tone={cReinvest ? "is-accent" : ""}>
                  {cReinvest ? "Compounding" : "Flat stake"}
                </Tag>
              </div>
              <Slider
                label="Initial investment"
                value={cPrincipal}
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={100}
                suffix="$"
                onChange={setCPrincipal}
              />
              <Slider
                label="Per-pool ROI"
                value={cRoi}
                min={MIN_ROI_PCT}
                max={MAX_ROI_PCT}
                step={0.5}
                suffix="%"
                onChange={setCRoi}
              />
              <Slider
                label="Number of pools"
                value={cPools}
                min={MIN_POOLS}
                max={MAX_POOLS}
                step={1}
                suffix="pools"
                onChange={setCPools}
              />
              <label className="ca-check">
                <input
                  type="checkbox"
                  checked={cReinvest}
                  onChange={(event) => setCReinvest(event.target.checked)}
                />
                Reinvest net earnings after each pool
              </label>
              <p className="ca-foot-note">
                With reinvesting off, every cycle is charged on the original{" "}
                {money(cPrincipal)} and the table simply repeats the same net.
              </p>
              <div className="ca-panel__actions">
                <button
                  type="button"
                  className="ca-btn ca-btn--sm"
                  onClick={() => open("compoundDetail")}
                >
                  Cycle maths
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => {
                    setCPools(data.preferences.compoundPools);
                    setCReinvest(data.preferences.reinvest);
                  }}
                >
                  Restore defaults
                </button>
              </div>
            </div>

            <div className="ca-panel ca-panel--chart">
              <div className="ca-panel__head">
                <h3>Growth curve</h3>
                <span className="ca-muted mono">
                  {money(compound.principal)} → {money(compound.finalBalance)}
                </span>
              </div>

              <div className="ca-chart" key={compoundSignature}>
                <svg
                  viewBox="0 0 100 38"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`Balance after ${compound.pools} pools, ending at ${money(compound.finalBalance)}`}
                >
                  {compoundTicks.map((tick) => {
                    const max = Math.max(...compoundChart.series, 1);
                    const y = 38 - (tick / max) * 38;
                    return (
                      <line
                        key={tick}
                        x1="0"
                        x2="100"
                        y1={y}
                        y2={y}
                        className="ca-chart__grid"
                      />
                    );
                  })}
                  <polygon
                    points={compoundChart.area}
                    className="ca-chart__area"
                  />
                  <polyline
                    points={compoundChart.points}
                    className="ca-chart__line"
                  />
                </svg>
              </div>

              <div className="ca-chart-legend">
                <span>
                  <b className="mono">{money(compound.finalBalance, 2)}</b> final
                  balance
                </span>
                <span>
                  <b className="mono is-pos">{signedMoney(compound.totalNet, 2)}</b>{" "}
                  net earned
                </span>
                <span>
                  <b className="mono is-cut">
                    {signedMoney(-compound.totalCut, 2)}
                  </b>{" "}
                  cut paid
                </span>
                <span>
                  <b className="mono">{signedPct(compound.growthPct, 1)}</b> growth
                </span>
              </div>

              <div className="ca-table-wrap">
                <table className="ca-table">
                  <thead>
                    <tr>
                      <th>Pool</th>
                      <th>Start balance</th>
                      <th>ROI</th>
                      <th>Net earnings</th>
                      <th>End balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compound.rows.map((row) => (
                      <tr key={row.index}>
                        <td data-label="Pool">
                          <b className="mono">#{row.index}</b>
                        </td>
                        <td data-label="Start balance" className="mono">
                          {money(row.start, 2)}
                        </td>
                        <td data-label="ROI" className="mono">
                          {pct(row.roiPct, 0)}
                        </td>
                        <td data-label="Net earnings" className="mono is-pos">
                          {money(row.net, 2)}
                        </td>
                        <td data-label="End balance" className="mono">
                          {money(row.end, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="ca-foot-note">
                Total {money(compound.finalBalance, 2)} (
                {signedPct(compound.growthPct, 1)}) across {compound.pools}{" "}
                cycles. Each row takes the 20% cut off that cycle&apos;s gross, so the
                net reinvested is 12% at a 15% ROI.
              </p>
            </div>
          </div>
        </section>

        {/* ── 3. Fees ── */}
        <section id="wa-fees" className="ca-section">
          <SectionHead
            code="03 / FEE CALCULATOR"
            title="What the desk keeps, and what the rails charge"
            hint="Funding and payout fees come from the wallet's own rail definitions, so this panel can never quote a fee the wallet does not charge."
            aside={
              <button
                type="button"
                className="ca-btn ca-btn--sm ca-btn--ghost"
                onClick={() => open("feeSchedule")}
              >
                Full schedule
              </button>
            }
          />

          <div className="ca-split">
            <div className="ca-panel">
              <div className="ca-panel__head">
                <h3>Inputs</h3>
                <span className="ca-muted mono">
                  cut {data.platformCutPct}% · {fees.amount > 0 ? pct(fees.costPct, 2) : "0%"} of
                  capital
                </span>
              </div>

              <Slider
                label="Investment amount"
                value={feeAmount}
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={100}
                suffix="$"
                onChange={setFeeAmount}
              />
              <Slider
                label="Expected ROI"
                value={feeRoi}
                min={MIN_ROI_PCT}
                max={MAX_ROI_PCT}
                step={0.5}
                suffix="%"
                onChange={setFeeRoi}
              />

              <label className="ca-field">
                <span>Deposit method</span>
                <select
                  value={rail.key}
                  onChange={(event) => setRailKey(event.target.value)}
                >
                  {data.depositRails.map((row) => (
                    <option key={row.key} value={row.key}>
                      {row.label} · {row.feeNote}
                    </option>
                  ))}
                </select>
                <small className="ca-muted">
                  {rail.eta} · fee is added on top of the deposit
                </small>
              </label>

              <label className="ca-field">
                <span>Payout method</span>
                <select
                  value={payoutMethod.id}
                  onChange={(event) => setPayoutId(event.target.value)}
                >
                  {data.payoutMethods.map((row) => (
                    <option key={row.id} value={row.id} disabled={!row.payoutEnabled}>
                      {row.label} · {row.payoutEnabled ? row.feeNote : "deposit only"}
                    </option>
                  ))}
                </select>
                <small className="ca-muted">
                  {payoutMethod.detail} · {payoutMethod.feeNote}
                </small>
              </label>

              <label className="ca-check">
                <input
                  type="checkbox"
                  checked={waived}
                  onChange={(event) => setWaived(event.target.checked)}
                />
                Settlement payout fee waived (cycle payouts are free)
              </label>

              <p className="ca-foot-note">
                The desk takes its {data.platformCutPct}% from gross earnings.
                Rails charge separately: the deposit fee is added to your top-up,
                the payout fee is deducted from a standalone withdrawal.
              </p>
            </div>

            <div className="ca-panel ca-panel--results">
              <div className="ca-panel__head">
                <h3>Fee breakdown</h3>
                <Tag tone={fees.totalFees === fees.platformShare ? "is-accent" : ""}>
                  {money(fees.totalFees, 2)} total
                </Tag>
              </div>

              <div className="ca-fee-bar" aria-hidden="true">
                <span
                  className="ca-fee-bar__seg is-deposit"
                  style={{ width: `${fees.totalFees ? (fees.depositFee / fees.totalFees) * 100 : 0}%` }}
                />
                <span
                  className="ca-fee-bar__seg is-platform"
                  style={{ width: `${fees.totalFees ? (fees.platformShare / fees.totalFees) * 100 : 0}%` }}
                />
                <span
                  className="ca-fee-bar__seg is-payout"
                  style={{ width: `${fees.totalFees ? (fees.payoutFee / fees.totalFees) * 100 : 0}%` }}
                />
              </div>

              <div className="ca-figure-grid">
                <Figure
                  label="Gross earnings"
                  value={fees.grossEarnings}
                  hint={`${money(fees.amount)} × ${pct(feeRoi, 1)}`}
                />
                <Figure
                  label="Deposit fee"
                  value={fees.depositFee}
                  hint={rail.label}
                  delay={60}
                />
                <Figure
                  label={`Platform share · ${data.platformCutPct}%`}
                  value={fees.platformShare}
                  tone="is-cut"
                  hint="Of gross, not of capital"
                  delay={120}
                />
                <Figure
                  label="Payout fee"
                  value={fees.payoutFee}
                  hint={fees.payoutFeeWaived ? "Waived on settlement" : payoutMethod.label}
                  delay={180}
                />
                <Figure
                  label="Total fees"
                  value={fees.totalFees}
                  tone="is-cut"
                  hint={`${pct(fees.costPct, 2)} of capital`}
                  delay={240}
                />
                <Figure
                  label="Net earnings"
                  value={fees.netEarnings}
                  tone="is-pos"
                  hint="After every fee above"
                  delay={300}
                />
              </div>

              <Kv
                rows={[
                  [
                    "Deposit",
                    <span className="mono" key="dep">
                      {money(fees.amount, 2)} + {money(fees.depositFee, 2)} fee
                    </span>,
                  ],
                  [
                    "Platform share",
                    <span className="mono" key="share">
                      {money(fees.grossEarnings, 2)} × {data.platformCutPct}% ={" "}
                      {money(fees.platformShare, 2)}
                    </span>,
                  ],
                  [
                    "Net after all fees",
                    <b className="mono is-pos" key="net">
                      {money(fees.netEarnings, 2)}
                    </b>,
                  ],
                  [
                    "Total return",
                    <span className="mono" key="ret">
                      {money(fees.totalReturn, 2)}
                    </span>,
                  ],
                ]}
              />

              <div className="ca-panel__actions">
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("feeSchedule")}
                >
                  Rail schedule
                </button>
                <Link className="ca-btn ca-btn--sm" href="/investor/wallet">
                  <Icon name="wallet" size={13} /> Wallet rails
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Scenario comparison ── */}
        <section id="wa-scenarios" className="ca-section">
          <SectionHead
            code="04 / SCENARIO COMPARISON"
            title="One, two or three slots — three outcomes each"
            hint="The same booking measured on the conservative, expected and optimistic band. Pick a pool to re-price the grid against its own slot and duration."
            aside={
              <>
                <label className="ca-inline-select">
                  <span className="ca-muted">Pool</span>
                  <select
                    value={scenarioPool.id}
                    onChange={(event) => {
                      const next = data.pools.find(
                        (row) => row.id === event.target.value,
                      );
                      if (next) applyPool(next, "scenario");
                    }}
                    aria-label="Scenario pool"
                  >
                    {data.pools.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.code} · {money(row.slotPrice)} · {row.durationDays}d
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("comparePools")}
                >
                  Compare all
                </button>
              </>
            }
          />

          <div
            className="ca-panel ca-panel--table ca-panel--scenario"
            key={scenarioSignature}
          >
            <div className="ca-toolbar">
              <span className="ca-muted">
                {scenarioPool.code} · {money(scenarioPool.slotPrice)} per slot ·{" "}
                {scenarioPool.durationDays} days · {data.platformCutPct}% cut
              </span>
              <div className="ca-toolbar__right">
                <Tag tone={poolTone(scenarioPool.lifecycle)}>
                  {lifecycleLabel(scenarioPool.lifecycle)}
                </Tag>
                {scenarioPool.bookable ? (
                  <Link
                    className="ca-btn ca-btn--sm ca-btn--primary"
                    href={scenarioPool.bookingHref}
                  >
                    Open window
                  </Link>
                ) : (
                  <Link className="ca-btn ca-btn--sm" href={scenarioPool.detailHref}>
                    Pool page
                  </Link>
                )}
              </div>
            </div>

            <div className="ca-table-wrap">
              <table className="ca-table ca-table--stack">
                <thead>
                  {scenarioTable.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => (
                        <th key={header.id}>
                          <button
                            type="button"
                            className="ca-th"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <scenarioTable.FlexRender header={header} />
                            {header.column.getIsSorted() === "asc"
                              ? " ↑"
                              : header.column.getIsSorted() === "desc"
                                ? " ↓"
                                : ""}
                          </button>
                        </th>
                      ))}
                      <th>
                        <span className="ca-th">Action</span>
                      </th>
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {scenarioTable.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="is-clickable">
                      {row.getAllCells().map((cell) => (
                        <td
                          key={cell.id}
                          data-label={txnLabels[cell.column.id] ?? cell.column.id}
                        >
                          <scenarioTable.FlexRender cell={cell} />
                        </td>
                      ))}
                      <td data-label="Action">
                        <div className="ca-row-actions">
                          <button
                            type="button"
                            className="ca-btn ca-btn--sm ca-btn--primary"
                            onClick={() => {
                              setBookSlots(row.original.slots);
                              setBookPoolId(scenarioPool.id);
                              open("bookWizard");
                            }}
                          >
                            Book {row.original.slots}
                          </button>
                          <button
                            type="button"
                            className="ca-btn ca-btn--sm ca-btn--ghost"
                            onClick={() => {
                              setBookSlots(row.original.slots);
                              setBookPoolId(scenarioPool.id);
                              open("scenarioDetail");
                            }}
                          >
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ca-table-foot">
              <span className="ca-muted">
                Conservative {data.bands.conservative}% · expected{" "}
                {data.bands.expected}% · optimistic {data.bands.optimistic}% · all
                net of the {data.platformCutPct}% cut
              </span>
              <button
                type="button"
                className="ca-link"
                onClick={() => open("methodology")}
              >
                Why these bands
              </button>
            </div>
          </div>

          <div className="ca-scenario-row">
            {scenarios.map((row) => (
              <article key={row.slots} className="ca-scenario-card">
                <header>
                  <b className="mono">{row.slots} slot{row.slots === 1 ? "" : "s"}</b>
                  <span className="mono">{money(row.investment)}</span>
                </header>
                <div className="ca-scenario-card__bands">
                  <span>
                    <small>Conservative</small>
                    <b className="mono">{money(row.conservativeNet, 2)}</b>
                  </span>
                  <span className="is-expected">
                    <small>Expected</small>
                    <b className="mono is-pos">{money(row.expectedNet, 2)}</b>
                  </span>
                  <span>
                    <small>Optimistic</small>
                    <b className="mono">{money(row.optimisticNet, 2)}</b>
                  </span>
                </div>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => {
                    setBookSlots(row.slots);
                    setBookPoolId(scenarioPool.id);
                    open("scenarioDetail");
                  }}
                >
                  Breakdown
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* ── 5. Historical performance ── */}
        <section id="wa-history" className="ca-section">
          <SectionHead
            code="05 / TRACK RECORD"
            title="The last ten Basic Growth cycles"
            hint="Platform-wide results for the 14-day Basic Growth family — not this account's own book, which lives on My investments."
            aside={
              <>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm ca-btn--ghost"
                  onClick={() => open("methodology")}
                >
                  Method
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn--sm"
                  onClick={() => setDrawer("history")}
                >
                  <Icon name="panelRight" size={13} /> Archive
                </button>
              </>
            }
          />

          <div className="ca-stat-row">
            <div className="ca-stat">
              <span>Average ROI</span>
              <b className="mono is-pos">{signedPct(history.average, 1)}</b>
              <small className="ca-muted">{history.count} completed pools</small>
            </div>
            <div className="ca-stat">
              <span>Median</span>
              <b className="mono">{signedPct(history.median, 1)}</b>
              <small className="ca-muted">half above, half below</small>
            </div>
            <div className="ca-stat">
              <span>Best</span>
              <b className="mono is-pos">{signedPct(history.best?.roiPct ?? 0, 1)}</b>
              <small className="ca-muted">
                {history.best?.code} ·{" "}
                {history.best ? shortDateOf(history.best.completedAt) : "—"}
              </small>
            </div>
            <div className="ca-stat">
              <span>Worst</span>
              <b
                className={`mono ${(history.worst?.roiPct ?? 0) < 0 ? "is-neg" : ""}`}
              >
                {signedPct(history.worst?.roiPct ?? 0, 1)}
              </b>
              <small className="ca-muted">
                {history.worst?.code} ·{" "}
                {history.worst ? shortDateOf(history.worst.completedAt) : "—"}
              </small>
            </div>
            <div className="ca-stat">
              <span>Win rate band</span>
              <b className="mono">
                {pct(history.winRateMin, 0)}–{pct(history.winRateMax, 0)}
              </b>
              <small className="ca-muted">{history.totalTrades} trades</small>
            </div>
          </div>

          <div className="ca-split ca-split--history">
            <div className="ca-panel ca-panel--chart">
              <div className="ca-panel__head">
                <h3>ROI by cycle</h3>
                <span className="ca-muted mono">
                  {money(history.totalCapital)} deployed
                </span>
              </div>
              <div className="ca-bars" key={historySignature}>
                {historyBars.map((row, index) => (
                  <button
                    key={row.id}
                    type="button"
                    className="ca-bar"
                    title={`${row.code} · ${signedPct(row.roiPct, 1)} · ${pct(row.winRatePct, 1)} win rate`}
                    onClick={() => {
                      setSelectedHistory(row.id);
                      open("historicalDetail");
                    }}
                  >
                    <span className="ca-bar__track">
                      <span
                        className="ca-bar__fill"
                        style={{
                          height: `${row.height}%`,
                          "--ca-delay": `${index * 55}ms`,
                        } as CSSProperties}
                      />
                    </span>
                    <span className="ca-bar__value mono">{row.roiPct}</span>
                    <span className="ca-bar__label mono">
                      {row.code.replace("PKG-", "")}
                    </span>
                  </button>
                ))}
              </div>
              <div className="ca-chart-legend">
                <span className="ca-muted">
                  {signedPct(history.average, 1)} average across{" "}
                  {data.historical.length} cycles · click a bar for the record
                </span>
              </div>
            </div>

            <div className="ca-panel ca-panel--table">
              <div className="ca-panel__head">
                <h3>Cycle record</h3>
                <button
                  type="button"
                  className="ca-link"
                  onClick={() => open("methodology")}
                >
                  Methodology
                </button>
              </div>
              <div className="ca-table-wrap">
                <table className="ca-table">
                  <thead>
                    {historyTable.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        {group.headers.map((header) => (
                          <th key={header.id}>
                            <button
                              type="button"
                              className="ca-th"
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
                          setSelectedHistory(row.original.id);
                          open("historicalDetail");
                        }}
                      >
                        {row.getAllCells().map((cell) => (
                          <td key={cell.id} data-label={cell.column.id}>
                            <historyTable.FlexRender cell={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ca-foot-note">
                Past performance is not indicative of future results. Trading
                involves risk — only invest what you can afford to lose.
              </p>
            </div>
          </div>
        </section>

        <footer className="ca-foot">
          <div className="ca-foot__links">
            <Link href="/investor">Investor overview</Link>
            <Link href="/investor/pools">Crowdfunding pools</Link>
            <Link href="/investor/investments">My investments</Link>
            <Link href="/investor/wallet">Wallet</Link>
            <button type="button" className="ca-link" onClick={() => open("presetList")}>
              Presets
            </button>
            <button type="button" className="ca-link" onClick={() => open("savedScenarios")}>
              Saved scenarios ({savedOnly.length})
            </button>
            <button type="button" className="ca-link" onClick={() => open("bookedQueue")}>
              Queued bookings ({queued.length})
            </button>
            <button type="button" className="ca-link" onClick={() => open("boundaries")}>
              Boundaries
            </button>
          </div>
          <div className="ca-foot__audit">
            <h4>Local audit trail</h4>
            {data.audit.length ? (
              <ul>
                {data.audit.slice(0, 4).map((entry) => (
                  <li key={entry.id}>
                    <span className="mono ca-muted">
                      {entry.at.slice(11, 16)} UTC
                    </span>
                    <b>{entry.action}</b>
                    <span>{entry.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ca-muted">
                No session changes yet. Saving a scenario, exporting a model or
                booking a plan is logged against revision r{data.revision}.
              </p>
            )}
          </div>
          <p className="ca-foot__meta">
            Revision r{data.revision} · snapshot {CALCULATOR_AS_OF.slice(0, 10)}{" "}
            {CALCULATOR_AS_OF.slice(11, 16)} UTC · {data.exports.length} export
            {data.exports.length === 1 ? "" : "s"} · {data.support.length} desk
            message{data.support.length === 1 ? "" : "s"} · demo data, no provider
            contacted
          </p>
        </footer>

        {/* ── right drawer ── */}
        {drawer ? (
          <div
            className="op-drawer-backdrop ca-drawer-layer"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDrawer(null);
            }}
          >
            <aside
              className="op-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Calculator inspector"
            >
              <div className="op-drawer__head">
                <div>
                  <span className="ca-section-code">I-8 / MODEL INSPECTOR</span>
                  <h2 className="op-drawer__title">Projection</h2>
                  <p className="ca-muted">
                    {money(projection.amount)} at {pct(projection.roiPct)} ·{" "}
                    {projection.durationDays} days · {clock.slice(11, 16)} UTC
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
              <div className="ca-drawer-tabs" role="tablist" aria-label="Inspector views">
                {(["projection", "compound", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={drawer === tab}
                    className={drawer === tab ? "is-active" : ""}
                    onClick={() => setDrawer(tab)}
                  >
                    {tab === "projection"
                      ? "Projection"
                      : tab === "compound"
                        ? "Compounding"
                        : "Track record"}
                  </button>
                ))}
              </div>
              <div className="op-drawer__body">
                {drawer === "projection" ? (
                  <>
                    <div className="ca-drawer-hero">
                      <span className="ca-muted">Net earnings</span>
                      <b className="mono is-pos">{money(projection.netEarnings, 2)}</b>
                      <span className="ca-muted mono">
                        {money(projection.totalReturn, 2)} total return
                      </span>
                    </div>
                    <Kv
                      rows={[
                        ["Amount", money(projection.amount, 2)],
                        ["Slots", `${projection.slots} × ${money(projection.slotPrice)}`],
                        ["Gross", money(projection.grossEarnings, 2)],
                        [`Cut ${data.platformCutPct}%`, money(projection.platformCut, 2)],
                        ["Net", money(projection.netEarnings, 2)],
                        ["Daily net", money(projection.dailyNet, 2)],
                        ["Net ROI", pct(projection.netRoiPct, 2)],
                        ["APY", `≈${Math.round(projection.effectiveApy)}%`],
                      ]}
                    />
                    <div className="ca-drawer-actions">
                      <button
                        type="button"
                        className="ca-btn ca-btn--primary"
                        onClick={() => {
                          setDrawer(null);
                          open("bookWizard");
                        }}
                      >
                        Book this plan
                      </button>
                      <button
                        type="button"
                        className="ca-btn"
                        onClick={() => {
                          setDrawer(null);
                          open("saveScenario");
                        }}
                      >
                        Save scenario
                      </button>
                      <button
                        type="button"
                        className="ca-btn ca-btn--ghost"
                        onClick={() => {
                          setDrawer(null);
                          open("methodology");
                        }}
                      >
                        Methodology
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "compound" ? (
                  <>
                    <p className="ca-muted">
                      {compound.pools} cycles from {money(compound.principal)} at{" "}
                      {pct(compound.roiPct)} ·{" "}
                      {compound.reinvest ? "compounding" : "flat stake"}.
                    </p>
                    <ul className="ca-drawer-rows">
                      {compound.rows.map((row) => (
                        <li key={row.index}>
                          <span className="mono ca-muted">#{row.index}</span>
                          <span className="mono">{money(row.start, 2)}</span>
                          <b className="mono is-pos">{money(row.net, 2)}</b>
                          <span className="mono">{money(row.end, 2)}</span>
                        </li>
                      ))}
                    </ul>
                    <Kv
                      rows={[
                        ["Final balance", money(compound.finalBalance, 2)],
                        ["Net earned", signedMoney(compound.totalNet, 2)],
                        ["Cut paid", signedMoney(-compound.totalCut, 2)],
                        ["Growth", signedPct(compound.growthPct, 1)],
                      ]}
                    />
                    <div className="ca-drawer-actions">
                      <button
                        type="button"
                        className="ca-btn ca-btn--primary"
                        onClick={() => {
                          setDrawer(null);
                          scrollTo("wa-compound");
                        }}
                      >
                        Open section
                      </button>
                      <button
                        type="button"
                        className="ca-btn ca-btn--ghost"
                        onClick={() => {
                          setDrawer(null);
                          open("compoundDetail");
                        }}
                      >
                        Cycle maths
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "history" ? (
                  <>
                    <div className="ca-drawer-hero">
                      <span className="ca-muted">Average ROI · {history.count} pools</span>
                      <b className="mono is-pos">{signedPct(history.average, 1)}</b>
                      <span className="ca-muted mono">
                        median {signedPct(history.median, 1)} · worst{" "}
                        {signedPct(history.worst?.roiPct ?? 0, 1)}
                      </span>
                    </div>
                    <ul className="ca-drawer-rows">
                      {data.historical
                        .slice()
                        .reverse()
                        .map((row) => (
                          <li key={row.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHistory(row.id);
                                setDrawer(null);
                                open("historicalDetail");
                              }}
                            >
                              <span className="mono">{row.code.replace("PKG-", "")}</span>
                              <span className="mono ca-muted">
                                {shortDateOf(row.completedAt)}
                              </span>
                              <b className="mono is-pos">{signedPct(row.roiPct, 1)}</b>
                              <span className="mono ca-muted">
                                {pct(row.winRatePct, 0)}
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                    <div className="ca-drawer-actions">
                      <button
                        type="button"
                        className="ca-btn ca-btn--primary"
                        onClick={() => {
                          setDrawer(null);
                          open("exportWizard");
                        }}
                      >
                        Export archive
                      </button>
                      <button
                        type="button"
                        className="ca-btn ca-btn--ghost"
                        onClick={() => {
                          setDrawer(null);
                          open("risk");
                        }}
                      >
                        Risk disclosure
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
          <div className="ca-modal-layer">
            <DeskModalShell
              code="I-8"
              eyebrow="INVESTOR WORKSPACE / PROJECTION ONLY"
              title={titles[modal.kind]}
              subtitle="Client-side model. Saving, exporting and booking are a structured local preview until the calculation service is wired to a backend."
              size={modalSize[modal.kind] ?? "md"}
              onClose={close}
              steps={wizard}
              currentStep={wizardStep}
              footer={modalFooter}
            >
              {error ? (
                <p className="ca-error" role="alert">
                  {error}
                </p>
              ) : null}

              {/* ── booking wizard ── */}
              {modal.kind === "bookWizard" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <label className="ca-field">
                        <span>Destination pool</span>
                        <select
                          value={bookPool.id}
                          onChange={(event) => setBookPoolId(event.target.value)}
                        >
                          {data.pools.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.code} · {money(row.slotPrice)}/slot ·{" "}
                              {row.durationDays}d · {row.bookable ? "open" : lifecycleLabel(row.lifecycle).toLowerCase()}
                            </option>
                          ))}
                        </select>
                        <small className="ca-muted">
                          {bookPool.strategy} · closes{" "}
                          {shortDateOf(bookPool.closesAt)}
                        </small>
                      </label>

                      <div className="ca-slot-picker">
                        {Array.from(
                          { length: Math.min(bookPool.maxSlotsPerUser, 6) },
                          (_, index) => index + 1,
                        ).map((count) => (
                          <button
                            key={count}
                            type="button"
                            role="radio"
                            aria-checked={bookSlots === count}
                            className={`ca-slot ${bookSlots === count ? "is-active" : ""}`}
                            onClick={() => setBookSlots(count)}
                          >
                            <b className="mono">{count}</b>
                            <span className="mono">
                              {money(count * bookPool.slotPrice)}
                            </span>
                          </button>
                        ))}
                      </div>

                      <Kv
                        rows={[
                          ["Pool", `${bookPool.code} · ${bookPool.name}`],
                          [
                            "Slots",
                            <span className="mono" key="slots">
                              {bookSlots} × {money(bookPool.slotPrice)}
                            </span>,
                          ],
                          [
                            "Amount",
                            <b className="mono" key="amt">
                              {money(bookAmount, 2)}
                            </b>,
                          ],
                          ["Wallet available", money(data.profile.walletAvailable, 2)],
                          [
                            "Funding needed",
                            <span
                              className={`mono ${bookAmount > data.profile.walletAvailable ? "is-neg" : "is-pos"}`}
                              key="fund"
                            >
                              {bookAmount > data.profile.walletAvailable
                                ? `${money(bookAmount - data.profile.walletAvailable, 2)} short`
                                : "Covered by wallet"}
                            </span>,
                          ],
                        ]}
                      />

                      <label className="ca-field">
                        <span>Note for the desk (optional)</span>
                        <input
                          type="text"
                          maxLength={160}
                          value={bookNote}
                          placeholder="Rolling the PKG-06 settlement into this window"
                          onChange={(event) => setBookNote(event.target.value)}
                        />
                      </label>

                      {bookAmount > data.profile.walletAvailable ? (
                        <p className="ca-hint-warn">
                          {money(bookAmount - data.profile.walletAvailable, 2)} short
                          of your wallet balance — the booking flow asks for a top-up
                          before it reserves anything.{" "}
                          <Link className="ca-link" href="/investor/wallet">
                            Top up the wallet
                          </Link>
                        </p>
                      ) : (
                        <p className="ca-hint-ok">
                          Covered by your wallet — no deposit needed for this
                          booking.
                        </p>
                      )}
                    </>
                  ) : null}

                  {wizardStep === 1 ? (
                    <>
                      <Kv
                        rows={[
                          ["Pool", `${bookPool.code} · ${bookPool.name}`],
                          ["Window", bookPool.bookable ? "Open now" : lifecycleLabel(bookPool.lifecycle)],
                          ["Closes", shortDateOf(bookPool.closesAt)],
                          [
                            "Slots",
                            <span className="mono" key="slots">
                              {bookSlots} × {money(bookPool.slotPrice)} ={" "}
                              {money(bookAmount, 2)}
                            </span>,
                          ],
                          [
                            "Modelled ROI",
                            <span className="mono" key="roi">
                              {pct(projection.roiPct, 1)} over {bookPool.durationDays} days
                            </span>,
                          ],
                          [
                            "Modelled net",
                            <b className="mono is-pos" key="net">
                              {money(bookNet, 2)}
                            </b>,
                          ],
                          ["Funding", `${money(bookAmount, 2)} from the wallet`],
                        ]}
                      />
                      <p className="ca-copy">
                        This hands {money(bookAmount, 2)} and {bookSlots} slot
                        {bookSlots === 1 ? "" : "s"} to the I-4 booking flow, which
                        owns payment, the funding reference and the confirmation.
                        Nothing is reserved by the calculator.
                      </p>
                    </>
                  ) : null}

                  {wizardStep === 2 ? (
                    <>
                      <Kv
                        rows={[
                          ["Booking", `${bookSlots} slot${bookSlots === 1 ? "" : "s"} of ${bookPool.code}`],
                          ["Amount", <b className="mono" key="amt">{money(bookAmount, 2)}</b>],
                          ["Modelled net", <span className="mono is-pos" key="net">{money(bookNet, 2)}</span>],
                          [
                            "Wallet after",
                            bookAmount > data.profile.walletAvailable ? (
                              <span className="mono is-cut" key="after">
                                {money(bookAmount - data.profile.walletAvailable, 2)} short
                              </span>
                            ) : (
                              <span className="mono" key="after">
                                {money(data.profile.walletAvailable - bookAmount, 2)}
                              </span>
                            ),
                          ],
                          ["Next step", bookPool.bookable ? "Payment in the booking flow" : "Pool page until the window opens"],
                        ]}
                      />
                      <p className="ca-copy">
                        Confirming records this hand-off in the local audit trail
                        and opens {bookPool.bookable ? "the booking flow" : "the pool page"}.
                        The projection stays a projection — the desk only books what
                        you confirm there.
                      </p>
                    </>
                  ) : null}
                </>
              ) : null}

              {/* ── save scenario ── */}
              {modal.kind === "saveScenario" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <Kv
                        rows={[
                          ["Pool", `${scenarioPool.code} · ${scenarioPool.name}`],
                          ["Slots", `${bookSlots} × ${money(scenarioPool.slotPrice)}`],
                          ["Amount", money(bookAmount, 2)],
                          ["Modelled net", money(bookNet, 2)],
                        ]}
                      />
                      <label className="ca-field">
                        <span>Label *</span>
                        <input
                          type="text"
                          maxLength={160}
                          value={scenarioNote}
                          placeholder="Two slots if PKG-05 opens under 15%"
                          onChange={(event) => setScenarioNote(event.target.value)}
                        />
                        <small className="ca-muted">
                          {scenarioNote.trim().length}/160 · saved scenarios stay on
                          this browser
                        </small>
                      </label>
                      {stepBlockingError ? (
                        <p className="ca-hint-error">{stepBlockingError}</p>
                      ) : null}
                    </>
                  ) : null}
                  {wizardStep === 1 ? (
                    <Kv
                      rows={[
                        ["Scenario", scenarioNote || "—"],
                        ["Pool", scenarioPool.code],
                        ["Slots", String(bookSlots)],
                        ["Amount", money(bookAmount, 2)],
                        ["Modelled net", money(bookNet, 2)],
                        ["Saves to", `${savedOnly.length + 1} of 20 scenario slots`],
                      ]}
                    />
                  ) : null}
                </>
              ) : null}

              {/* ── preset wizard ── */}
              {modal.kind === "presetWizard" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <label className="ca-field">
                        <span>Preset name *</span>
                        <input
                          type="text"
                          maxLength={40}
                          value={presetName}
                          placeholder="Conservative 14-day"
                          onChange={(event) => setPresetName(event.target.value)}
                        />
                        <small className="ca-muted">
                          {data.presets.length}/8 saved · captured from the current
                          inputs
                        </small>
                      </label>
                      <Kv
                        rows={[
                          ["Amount", money(amount)],
                          ["ROI", pct(roiPct, 1)],
                          ["Duration", `${durationDays} days`],
                        ]}
                      />
                      {stepBlockingError ? (
                        <p className="ca-hint-error">{stepBlockingError}</p>
                      ) : null}
                    </>
                  ) : null}
                  {wizardStep === 1 ? (
                    <>
                      <Kv
                        rows={[
                          ["Name", presetName || "—"],
                          ["Amount", money(amount)],
                          ["ROI", pct(roiPct, 1)],
                          ["Duration", `${durationDays} days`],
                          ["Net at this ROI", money(projection.netEarnings, 2)],
                        ]}
                      />
                      <p className="ca-foot-note">
                        Presets only store inputs — loading one never books
                        anything. They live in this browser session.
                      </p>
                    </>
                  ) : null}
                </>
              ) : null}

              {/* ── share wizard ── */}
              {modal.kind === "shareWizard" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <h4 className="ca-subhead">Channel</h4>
                      <div className="ca-choice-grid">
                        {(
                          [
                            ["copy", "Copy the summary", "Puts the figures on the clipboard"],
                            ["link", "Copy a link", "Opens the calculator for the reader"],
                            ["email", "Email it to myself", "Recorded locally, nothing sent"],
                            ["whatsapp", "WhatsApp", "Recorded locally, nothing sent"],
                          ] as const
                        ).map(([key, label, detail]) => (
                          <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={shareChannel === key}
                            className={`ca-choice ${shareChannel === key ? "is-active" : ""}`}
                            onClick={() => setShareChannel(key)}
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
                      <Kv
                        rows={[
                          ["Amount", money(amount)],
                          ["ROI", pct(roiPct, 1)],
                          ["Duration", `${durationDays} days`],
                          ["Net", money(projection.netEarnings, 2)],
                          ["Channel", shareChannel],
                        ]}
                      />
                      <p className="ca-foot-note">
                        Sharing records an audit entry. No message leaves the
                        browser — that needs a backend mail or messaging service.
                      </p>
                    </>
                  ) : null}
                </>
              ) : null}

              {/* ── export wizard ── */}
              {modal.kind === "exportWizard" ? (
                <>
                  {wizardStep === 0 ? (
                    <div className="ca-choice-grid">
                      {(
                        [
                          ["projection", "ROI projection", "One row: inputs, cut, net, APY"],
                          ["compound", "Compound schedule", `${compound.pools} rows of balances`],
                          ["fees", "Fee breakdown", "Deposit, platform share, payout"],
                          ["scenarios", "Scenario grid", `${scenarios.length} slot rows for ${scenarioPool.code}`],
                          ["historical", "Track record", `${data.historical.length} completed cycles`],
                        ] as const
                      ).map(([key, label, detail]) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={exportScope === key}
                          className={`ca-choice ${exportScope === key ? "is-active" : ""}`}
                          onClick={() => setExportScope(key)}
                        >
                          <b>{label}</b>
                          <small>{detail}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {wizardStep === 1 ? (
                    <div className="ca-choice-grid ca-choice-grid--three">
                      {(
                        [
                          ["pdf", "PDF", "Branded sheet with the assumptions"],
                          ["csv", "CSV", "One row per record"],
                          ["json", "JSON", "Structured for a workbook"],
                        ] as const
                      ).map(([key, label, detail]) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={exportFormat === key}
                          className={`ca-choice ${exportFormat === key ? "is-active" : ""}`}
                          onClick={() => setExportFormat(key)}
                        >
                          <b>{label}</b>
                          <small>{detail}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {wizardStep === 2 ? (
                    <>
                      <Kv
                        rows={[
                          ["Scope", exportScope],
                          ["Format", exportFormat.toUpperCase()],
                          ["Rows", String(scopeRows(exportScope).length)],
                          ["Inputs", `${money(amount)} · ${pct(roiPct, 1)} · ${durationDays}d`],
                          ["Generated", "In this browser"],
                        ]}
                      />
                      <p className="ca-foot-note">
                        Exports carry the assumptions so a reader can reproduce
                        every number. No file is stored on a server.
                      </p>
                    </>
                  ) : null}
                </>
              ) : null}

              {/* ── settings wizard ── */}
              {modal.kind === "settingsWizard" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <ul className="ca-toggle-list">
                        {(
                          [
                            ["reinvest", "Reinvest by default", "Start the compound section in compounding mode"],
                            ["showGross", "Show gross earnings", "Display gross next to net everywhere"],
                            ["includeFees", "Include rail fees", "Quote deposit and payout fees in the model"],
                            ["payoutFeeWaived", "Waive payout fee", "Treat payouts as settlement payouts"],
                          ] as const
                        ).map(([key, label, detail]) => (
                          <li key={key}>
                            <div>
                              <b>{label}</b>
                              <small className="ca-muted">{detail}</small>
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
                      <label className="ca-field">
                        <span>Compound cycles by default</span>
                        <input
                          type="number"
                          min={MIN_POOLS}
                          max={MAX_POOLS}
                          value={prefs.compoundPools}
                          onChange={(event) =>
                            setPrefs((prev) => ({
                              ...prev,
                              compoundPools: clamp(
                                Number(event.target.value) || MIN_POOLS,
                                MIN_POOLS,
                                MAX_POOLS,
                              ),
                            }))
                          }
                        />
                        <small className="ca-muted">
                          Between {MIN_POOLS} and {MAX_POOLS} cycles.
                        </small>
                      </label>
                    </>
                  ) : null}
                  {wizardStep === 1 ? (
                    <Kv
                      rows={[
                        ["Reinvest", prefs.reinvest ? "On" : "Off"],
                        ["Compound cycles", String(prefs.compoundPools)],
                        ["Show gross", prefs.showGross ? "On" : "Off"],
                        ["Include fees", prefs.includeFees ? "On" : "Off"],
                        ["Payout fee", prefs.payoutFeeWaived ? "Waived" : "Charged"],
                      ]}
                    />
                  ) : null}
                </>
              ) : null}

              {/* ── support wizard ── */}
              {modal.kind === "supportWizard" ? (
                <>
                  {wizardStep === 0 ? (
                    <div className="ca-chip-row">
                      {(
                        [
                          ["roi", "ROI maths"],
                          ["compound", "Compounding"],
                          ["fees", "Fees"],
                          ["scenario", "Scenarios"],
                          ["other", "Something else"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={supportTopic === key}
                          className={`ca-chip ca-chip--button ${supportTopic === key ? "is-on" : ""}`}
                          onClick={() => setSupportTopic(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {wizardStep === 1 ? (
                    <label className="ca-field">
                      <span>Message *</span>
                      <textarea
                        rows={6}
                        maxLength={1000}
                        value={supportMessage}
                        placeholder="Which assumption should I use for the 21-day window?"
                        onChange={(event) => setSupportMessage(event.target.value)}
                      />
                      <small className="ca-muted">
                        {supportMessage.trim().length}/1000 · stored as a local draft
                      </small>
                    </label>
                  ) : null}
                  {wizardStep === 2 ? (
                    <>
                      <Kv
                        rows={[
                          ["Topic", supportTopic],
                          ["From", `${data.profile.displayName} · ${data.profile.kycLevel} verified`],
                          ["Model", `${money(amount)} · ${pct(roiPct, 1)} · ${durationDays}d`],
                          ["Message", supportMessage || "—"],
                        ]}
                      />
                      <p className="ca-foot-note">
                        No email is sent. The draft is appended to the local audit
                        trail so the conversation stays inspectable.
                      </p>
                    </>
                  ) : null}
                  {stepBlockingError ? (
                    <p className="ca-hint-error">{stepBlockingError}</p>
                  ) : null}
                </>
              ) : null}

              {/* ── read-only dialogs ── */}
              {modal.kind === "methodology" ? (
                <>
                  <p className="ca-copy">
                    Every number in this page comes from four inputs and one cut.
                    Nothing is fetched from a marketing table.
                  </p>
                  <ol className="ca-steps">
                    <li>
                      <b>Gross</b> = capital × ROI. At {money(3000)} and 15% that
                      is {money(450, 2)}.
                    </li>
                    <li>
                      <b>Cut</b> = gross × {data.platformCutPct}% ={" "}
                      {money(90, 2)}. It is charged on earnings, never on capital.
                    </li>
                    <li>
                      <b>Net</b> = gross − cut = {money(360, 2)}. This is what
                      lands in the wallet.
                    </li>
                    <li>
                      <b>Compounding</b> rolls net forward and charges the cut
                      again on each new gross.
                    </li>
                    <li>
                      <b>APY</b> = net ROI × 365 ÷ days. It is a scaling, not a
                      promise.
                    </li>
                  </ol>
                  <Kv
                    rows={[
                      ["Platform cut", `${data.platformCutPct}% of gross`],
                      ["Slot price", money(data.slotPrice)],
                      ["Historical window", `${data.historical.length} cycles`],
                      ["Cut source", "Same 20% I-6 books on settled pools"],
                    ]}
                  />
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn"
                      onClick={() => open("assumptions")}
                    >
                      Assumptions
                    </button>
                    <button
                      type="button"
                      className="ca-btn ca-btn--ghost"
                      onClick={() => open("boundaries")}
                    >
                      Boundaries
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "assumptions" ? (
                <>
                  <Kv
                    rows={[
                      ["Reference pool", `${pool.code} · ${pool.name}`],
                      ["Slot price", money(pool.slotPrice)],
                      ["Pool duration", `${pool.durationDays} days`],
                      ["Pool expectation", pct(pool.expectedRoiPct, 1)],
                      ["Risk band", pool.riskBand],
                      ["Platform cut", `${data.platformCutPct}%`],
                      ["Scenario bands", `${data.bands.conservative}% / ${data.bands.expected}% / ${data.bands.optimistic}%`],
                      ["Wallet available", money(data.profile.walletAvailable, 2)],
                    ]}
                  />
                  <ul className="ca-policy-list">
                    <li>
                      <b>Capital</b>
                      <span>
                        Projections assume the full amount is deployed at the start
                        of the window.
                      </span>
                    </li>
                    <li>
                      <b>Fees</b>
                      <span>
                        Rail fees come from the wallet: {rail.label}{" "}
                        {rail.feeNote.toLowerCase()}.
                      </span>
                    </li>
                    <li>
                      <b>Not modelled</b>
                      <span>
                        Tax, FX conversion and any bank-side charge outside the
                        wallet&apos;s rail definitions.
                      </span>
                    </li>
                  </ul>
                </>
              ) : null}

              {modal.kind === "risk" ? (
                <>
                  <ul className="ca-policy-list">
                    <li>
                      <b>Capital at risk</b>
                      <span>
                        Pool capital is traded. A losing cycle returns less than it
                        took in; the ROI bands are scenarios, not floors.
                      </span>
                    </li>
                    <li>
                      <b>Projection ≠ forecast</b>
                      <span>
                        The calculator multiplies your input by a rate you chose.
                        It does not know the future.
                      </span>
                    </li>
                    <li>
                      <b>Past ≠ future</b>
                      <span>
                        The ten-cycle archive is real book history, but a good
                        average hides the {pct(history.worst?.roiPct ?? 0, 1)} worst
                        cycle.
                      </span>
                    </li>
                    <li>
                      <b>Liquidity</b>
                      <span>
                        Booked capital is locked until the window closes; only wallet
                        cash can be withdrawn before then.
                      </span>
                    </li>
                  </ul>
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn ca-btn--primary"
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
                      className="ca-btn ca-btn--ghost"
                      onClick={() => open("methodology")}
                    >
                      Methodology
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "feeSchedule" ? (
                <>
                  <h4 className="ca-subhead">Deposit rails</h4>
                  <div className="ca-table-wrap">
                    <table className="ca-table">
                      <thead>
                        <tr>
                          <th>Rail</th>
                          <th>Fee</th>
                          <th>Arrival</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.depositRails.map((row) => (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td className="mono">{row.feeNote}</td>
                            <td>{row.eta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h4 className="ca-subhead">Payout destinations</h4>
                  <div className="ca-table-wrap">
                    <table className="ca-table">
                      <thead>
                        <tr>
                          <th>Destination</th>
                          <th>Fee</th>
                          <th>State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payoutMethods.map((row) => (
                          <tr key={row.id}>
                            <td>{row.label}</td>
                            <td className="mono">{row.feeNote}</td>
                            <td>
                              {row.payoutEnabled
                                ? row.verified
                                  ? "Verified"
                                  : "Unverified"
                                : "Deposit only"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="ca-foot-note">
                    Settlement payouts are fee-waived; a standalone withdrawal is
                    charged per the destination above. The platform cut is separate
                    and always {data.platformCutPct}% of gross.
                  </p>
                  <div className="ca-modal-actions">
                    <Link className="ca-btn" href="/investor/wallet">
                      Wallet & payments
                    </Link>
                  </div>
                </>
              ) : null}

              {modal.kind === "poolDetail" ? (
                <>
                  <div className="ca-modal-head">
                    <Tag tone={poolTone(pool.lifecycle)}>
                      {lifecycleLabel(pool.lifecycle)}
                    </Tag>
                    <b className="mono">{pool.code}</b>
                    <span>{pool.name}</span>
                  </div>
                  <Kv
                    rows={[
                      ["Strategy", pool.strategy],
                      ["Markets", pool.markets.join(" · ")],
                      ["Risk band", pool.riskBand],
                      ["Slot price", money(pool.slotPrice)],
                      ["Duration", `${pool.durationDays} days`],
                      ["Expected ROI", pct(pool.expectedRoiPct, 1)],
                      ["Investor share", `${pool.profitSharePct}% of pool profit`],
                      ["Max slots per investor", String(pool.maxSlotsPerUser)],
                      ["Closes", shortDateOf(pool.closesAt)],
                    ]}
                  />
                  <div className="ca-modal-actions">
                    <Link className="ca-btn ca-btn--primary" href={pool.detailHref}>
                      Open pool page
                    </Link>
                    {pool.bookable ? (
                      <Link className="ca-btn" href={pool.bookingHref}>
                        Book slots
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="ca-btn ca-btn--ghost"
                      onClick={() => {
                        applyPool(pool);
                        close();
                      }}
                    >
                      Model this pool
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "scenarioDetail" ? (
                <>
                  <div className="ca-modal-head">
                    <b className="mono">{bookSlots} slot{bookSlots === 1 ? "" : "s"}</b>
                    <span>{money(bookAmount, 2)}</span>
                    <Tag>{scenarioPool.code}</Tag>
                  </div>
                  <Kv
                    rows={[
                      ["Slot price", money(scenarioPool.slotPrice)],
                      ["Duration", `${scenarioPool.durationDays} days`],
                      [
                        "Conservative",
                        <span className="mono" key="c">
                          {pct(data.bands.conservative, 0)} → {money(chosenScenario?.conservativeNet ?? 0, 2)}
                        </span>,
                      ],
                      [
                        "Expected",
                        <span className="mono is-pos" key="e">
                          {pct(data.bands.expected, 0)} → {money(chosenScenario?.expectedNet ?? 0, 2)}
                        </span>,
                      ],
                      [
                        "Optimistic",
                        <span className="mono" key="o">
                          {pct(data.bands.optimistic, 0)} → {money(chosenScenario?.optimisticNet ?? 0, 2)}
                        </span>,
                      ],
                      ["Gross at expected", money(chosenScenario?.grossExpected ?? 0, 2)],
                      [`Cut ${data.platformCutPct}%`, money((chosenScenario?.grossExpected ?? 0) - (chosenScenario?.expectedNet ?? 0), 2)],
                    ]}
                  />
                  <p className="ca-foot-note">
                    Each band runs the same 20% cut on gross, so net is 80% of the
                    quoted ROI. Capital returns with the net on settlement.
                  </p>
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn ca-btn--primary"
                      onClick={() => open("bookWizard")}
                    >
                      Book these slots
                    </button>
                    <Link className="ca-btn ca-btn--ghost" href={scenarioPool.detailHref}>
                      Pool page
                    </Link>
                  </div>
                </>
              ) : null}

              {modal.kind === "historicalDetail" && historyPool ? (
                <>
                  <div className="ca-modal-head">
                    <b className="mono">{historyPool.code}</b>
                    <span>{historyPool.name}</span>
                    <Tag tone="is-ok">{signedPct(historyPool.roiPct, 1)}</Tag>
                  </div>
                  <Kv
                    rows={[
                      ["Strategy", historyPool.strategy],
                      ["Markets", historyPool.markets.join(" · ")],
                      ["Window", `${shortDateOf(historyPool.startedAt)} → ${shortDateOf(historyPool.completedAt)}`],
                      ["Duration", `${historyPool.durationDays} days`],
                      ["Capital deployed", money(historyPool.capital)],
                      ["Investors", String(historyPool.investors)],
                      ["Slot price", money(historyPool.slotPrice)],
                      ["Trades", String(historyPool.trades)],
                      ["Win rate", pct(historyPool.winRatePct, 1)],
                      ["Final ROI", signedPct(historyPool.roiPct, 1)],
                    ]}
                  />
                  <p className="ca-copy">{historyPool.note}</p>
                  <p className="ca-foot-note">
                    At the same slot price, one {money(historyPool.slotPrice)} slot
                    in this cycle would have returned{" "}
                    {money(historyPool.slotPrice * (historyPool.roiPct / 100) * 0.8, 2)}{" "}
                    net after the cut.
                  </p>
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn ca-btn--primary"
                      onClick={() => {
                        setAmount(historyPool.slotPrice);
                        setRoiPct(clamp(historyPool.roiPct, MIN_ROI_PCT, MAX_ROI_PCT));
                        setDurationDays(clamp(historyPool.durationDays, MIN_DAYS, MAX_DAYS));
                        close();
                        scrollTo("wa-roi");
                      }}
                    >
                      Model this result
                    </button>
                    <button
                      type="button"
                      className="ca-btn ca-btn--ghost"
                      onClick={() => open("methodology")}
                    >
                      Methodology
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "compoundDetail" ? (
                <>
                  <p className="ca-copy">
                    Each cycle is its own booking. The desk takes{" "}
                    {data.platformCutPct}% of that cycle&apos;s gross, credits the net,
                    and — if you reinvest — the next cycle starts from the larger
                    balance.
                  </p>
                  <Kv
                    rows={[
                      ["Principal", money(compound.principal)],
                      ["Per-cycle ROI", pct(compound.roiPct, 1)],
                      ["Net rate per cycle", pct(compound.roiPct * (1 - data.platformCutPct / 100), 1)],
                      ["Cycles", String(compound.pools)],
                      ["Policy", compound.reinvest ? "Reinvest net" : "Flat stake"],
                      ["Final balance", money(compound.finalBalance, 2)],
                      ["Total net", signedMoney(compound.totalNet, 2)],
                      ["Total cut", signedMoney(-compound.totalCut, 2)],
                      ["Growth", signedPct(compound.growthPct, 1)],
                    ]}
                  />
                  <p className="ca-foot-note">
                    Compounding is not free money: it assumes every cycle earns the
                    same ROI back-to-back, ignores the gap between windows, and
                    assumes you never withdraw.
                  </p>
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn"
                      onClick={() => open("exportWizard")}
                    >
                      Export schedule
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "apyExplainer" ? (
                <>
                  <p className="ca-copy">
                    “Effective APY” scales one cycle to a year. It is arithmetic,
                    not a yield promise: it assumes you repeat the same net ROI
                    every {projection.durationDays} days, with no idle time between
                    windows.
                  </p>
                  <div className="ca-formula">
                    <span className="mono">
                      APY = net ROI × 365 ÷ days
                    </span>
                    <span className="mono">
                      {pct(projection.netRoiPct, 2)} × 365 ÷ {projection.durationDays} ={" "}
                      {pct(projection.effectiveApy, 2)}
                    </span>
                  </div>
                  <Kv
                    rows={[
                      ["Cycle ROI (gross)", pct(projection.roiPct, 1)],
                      ["Cycle ROI (net)", pct(projection.netRoiPct, 2)],
                      ["Cycle length", `${projection.durationDays} days`],
                      ["Cycles in a year", (365 / projection.durationDays).toFixed(1)],
                      ["Effective APY", `≈${Math.round(projection.effectiveApy)}%`],
                      ["Compound alternative", signedPct(compound.growthPct, 1) + ` over ${compound.pools} cycles`],
                    ]}
                  />
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn ca-btn--ghost"
                      onClick={() => open("compoundDetail")}
                    >
                      Compare with compounding
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "slotMath" ? (
                <>
                  <p className="ca-copy">
                    A slot is the smallest unit a pool sells. The calculator derives
                    slots from the amount and the pool&apos;s slot price.
                  </p>
                  <div className="ca-formula">
                    <span className="mono">
                      slots = round(amount ÷ slot price)
                    </span>
                    <span className="mono">
                      {money(amount)} ÷ {money(pool.slotPrice)} ={" "}
                      {projection.slots}
                    </span>
                  </div>
                  <Kv
                    rows={[
                      ["Amount", money(amount)],
                      ["Slot price", money(pool.slotPrice)],
                      ["Slots", String(projection.slots)],
                      ["Capital deployed", money(projection.slots * pool.slotPrice)],
                      ["Max per investor", String(pool.maxSlotsPerUser)],
                    ]}
                  />
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn ca-btn--ghost"
                      onClick={() => setAmount(projection.slots * pool.slotPrice)}
                    >
                      Round the amount to slots
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "comparePools" ? (
                <>
                  <div className="ca-table-wrap">
                    <table className="ca-table">
                      <thead>
                        <tr>
                          <th>Pool</th>
                          <th>Slot</th>
                          <th>Days</th>
                          <th>Expected</th>
                          <th>Max slots</th>
                          <th>State</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.pools.map((row) => (
                          <tr key={row.id}>
                            <td data-label="Pool">
                              <b className="mono">{row.code}</b>
                              <br />
                              <span className="ca-muted">{row.name}</span>
                            </td>
                            <td data-label="Slot" className="mono">
                              {money(row.slotPrice)}
                            </td>
                            <td data-label="Days" className="mono">
                              {row.durationDays}
                            </td>
                            <td data-label="Expected" className="mono is-pos">
                              {pct(row.expectedRoiPct, 1)}
                            </td>
                            <td data-label="Max slots" className="mono">
                              {row.maxSlotsPerUser}
                            </td>
                            <td data-label="State">
                              <Tag tone={poolTone(row.lifecycle)}>
                                {lifecycleLabel(row.lifecycle)}
                              </Tag>
                            </td>
                            <td data-label="Action">
                              <button
                                type="button"
                                className="ca-btn ca-btn--sm ca-btn--ghost"
                                onClick={() => {
                                  applyPool(row);
                                  close();
                                  scrollTo("wa-roi");
                                }}
                              >
                                Model
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="ca-foot-note">
                    Expected ROI is the pool&apos;s own target, not a guarantee. Open
                    pools are bookable today; trading and upcoming pools are listed
                    for reference.
                  </p>
                </>
              ) : null}

              {modal.kind === "savedScenarios" ? (
                <>
                  {data.savedScenarios.length ? (
                    <ul className="ca-record-list">
                      {data.savedScenarios.map((row) => (
                        <li key={row.id}>
                          <div>
                            <b className="mono">{row.poolCode}</b>
                            <span className="ca-muted">
                              {row.slots} slot{row.slots === 1 ? "" : "s"} ·{" "}
                              {money(row.amount)} · {pct(row.roiPct, 1)} ·{" "}
                              {row.durationDays}d
                            </span>
                            <small className="ca-muted">{row.note}</small>
                          </div>
                          <Tag tone={row.status === "queued" ? "is-open" : ""}>
                            {row.status}
                          </Tag>
                          <button
                            type="button"
                            className="ca-btn ca-btn--sm ca-btn--ghost"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                { kind: "deleteScenario", scenarioId: row.id },
                                { title: "Scenario deleted" },
                              )
                            }
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ca-copy">
                      No scenarios saved yet. Save the current projection to compare
                      it against a future window.
                    </p>
                  )}
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn ca-btn--primary"
                      onClick={() => open("saveScenario")}
                    >
                      Save current projection
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "presetList" ? (
                <>
                  <ul className="ca-record-list">
                    {data.presets.map((preset) => (
                      <li key={preset.id}>
                        <div>
                          <b>
                            {preset.name} {preset.pinned ? "★" : ""}
                          </b>
                          <span className="ca-muted mono">
                            {money(preset.amount)} · {pct(preset.roiPct, 1)} ·{" "}
                            {preset.durationDays}d
                          </span>
                          <small className="ca-muted">{preset.note}</small>
                        </div>
                        <button
                          type="button"
                          className="ca-btn ca-btn--sm ca-btn--primary"
                          onClick={() => {
                            applyPreset(preset);
                            close();
                          }}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="ca-btn ca-btn--sm ca-btn--ghost"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              { kind: "togglePinPreset", presetId: preset.id },
                              { title: preset.pinned ? "Preset unpinned" : "Preset pinned" },
                            )
                          }
                        >
                          {preset.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          type="button"
                          className="ca-btn ca-btn--sm ca-btn--ghost"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              { kind: "deletePreset", presetId: preset.id },
                              { title: "Preset deleted" },
                            )
                          }
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn ca-btn--primary"
                      onClick={() => open("presetWizard")}
                    >
                      New preset
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "bookedQueue" ? (
                <>
                  {queued.length ? (
                    <ul className="ca-record-list">
                      {queued.map((row) => (
                        <li key={row.id}>
                          <div>
                            <b className="mono">{row.poolCode}</b>
                            <span className="ca-muted">
                              {row.slots} slot{row.slots === 1 ? "" : "s"} ·{" "}
                              {money(row.amount)} ·{" "}
                              {shortDateOf(row.createdAt)}
                            </span>
                            <small className="ca-muted">{row.note || "No note"}</small>
                          </div>
                          <Link
                            className="ca-btn ca-btn--sm"
                            href={data.pools.find((pool) => pool.id === row.poolId)?.bookable
                              ? `${data.pools.find((pool) => pool.id === row.poolId)?.bookingHref}?slots=${row.slots}`
                              : (data.pools.find((pool) => pool.id === row.poolId)?.detailHref ?? "/investor/pools")}
                          >
                            Open
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ca-copy">
                      Nothing queued. Booking a plan from the ROI section records a
                      hand-off here and opens the booking flow.
                    </p>
                  )}
                  <p className="ca-foot-note">
                    A queued booking is not a reservation. The pool only counts the
                    slots once payment is confirmed in I-4.
                  </p>
                </>
              ) : null}

              {modal.kind === "shareLink" ? (
                <>
                  <p className="ca-copy">
                    This link reopens the calculator on the pool comparison view so
                    the reader can model from the same pool list.
                  </p>
                  <div className="ca-link-box mono">
                    /investor/calculator?action=compare
                  </div>
                  <div className="ca-modal-actions">
                    <button
                      type="button"
                      className="ca-btn ca-btn--primary"
                      onClick={() =>
                        void copy(
                          `${typeof window === "undefined" ? "" : window.location.origin}/investor/calculator?action=compare`,
                          "Projection link",
                        )
                      }
                    >
                      <Icon name="copy" size={13} /> Copy link
                    </button>
                    <button
                      type="button"
                      className="ca-btn ca-btn--ghost"
                      onClick={() => open("shareWizard")}
                    >
                      Share options
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "resetConfirm" ? (
                <>
                  <p className="ca-copy">
                    Reset every input to the brief&apos;s defaults:{" "}
                    {money(data.defaults.amount)} at {pct(data.defaults.roiPct, 0)}{" "}
                    over {data.defaults.durationDays} days, compounding at{" "}
                    {data.preferences.compoundPools} cycles.
                  </p>
                  <Kv
                    rows={[
                      ["Amount", `${money(amount)} → ${money(data.defaults.amount)}`],
                      ["ROI", `${pct(roiPct, 1)} → ${pct(data.defaults.roiPct, 0)}`],
                      ["Duration", `${durationDays}d → ${data.defaults.durationDays}d`],
                      ["Compound cycles", `${cPools} → ${data.preferences.compoundPools}`],
                      ["Pool", `${pool.code} → ${data.pools.find((row) => row.id === data.defaultPoolId)?.code ?? pool.code}`],
                    ]}
                  />
                  <p className="ca-foot-note">
                    Saved scenarios, presets and exports are untouched.
                  </p>
                </>
              ) : null}

              {modal.kind === "boundaries" ? (
                <>
                  <p className="ca-copy">
                    The calculator projects. It does not book, charge or settle —
                    those belong to I-4 (booking), I-7 (wallet) and I-6
                    (investments).
                  </p>
                  <ul className="ca-policy-list">
                    <li>
                      <b>What works here</b>
                      <span>
                        ROI, compounding, fees, scenario grid, track record,
                        presets, saved scenarios, exports and the booking hand-off.
                      </span>
                    </li>
                    <li>
                      <b>What is local</b>
                      <span>
                        Every saved artefact and export is session state; no file is
                        uploaded and no message is sent.
                      </span>
                    </li>
                    <li>
                      <b>Where the numbers come from</b>
                      <span>
                        Pool book for slot prices and durations, wallet for rails,
                        and a fixed {data.platformCutPct}% cut that matches I-6.
                      </span>
                    </li>
                  </ul>
                  <div className="ca-modal-actions">
                    <Link className="ca-btn ca-btn--primary" href="/investor/pools">
                      Crowdfunding pools
                    </Link>
                    <Link className="ca-btn" href="/investor/investments">
                      My investments
                    </Link>
                    <Link className="ca-btn ca-btn--ghost" href="/investor/wallet">
                      Wallet
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
