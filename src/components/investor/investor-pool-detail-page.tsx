"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  POOL_DETAIL_AS_OF,
  capitalSharePct,
  countdownFrom,
  detailFillPct,
  drawdownHeadroom,
  durationLabel,
  relativeTo,
  roiOn,
  sumDaily,
  tradingElapsedPct,
  withdrawableNet,
  type DetailLifecycle,
  type PoolDetailCommand,
  type PoolDetailWorkspace,
  type ParticipantRow,
  type PoolTrade,
  type ScheduleStep,
} from "@/lib/investor/pool-detail";
import { usePoolDetail } from "@/lib/investor/use-pool-detail";
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
const signedMoney = (value: number, decimals = 0) =>
  `${value >= 0 ? "+" : "−"}${money(Math.abs(value), decimals)}`;
const percent = (value: number, decimals = 2) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(decimals)}%`;
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
const isoDay = (iso: string) => iso.slice(0, 10);
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
const riskTone = (risk: string) =>
  risk === "Aggressive"
    ? "is-aggressive"
    : risk === "Growth"
      ? "is-growth"
      : risk === "Balanced"
        ? "is-balanced"
        : "is-low";
const lifecycleLabel: Record<DetailLifecycle, string> = {
  trading: "Trading",
  open: "Open for booking",
  upcoming: "Upcoming",
  completed: "Completed",
};

/* ── Dialog registry ── */

type Kind =
  | "overviewInfo"
  | "schedule"
  | "bookSlots"
  | "payout"
  | "statement"
  | "reminder"
  | "alerts"
  | "projection"
  | "risk"
  | "support"
  | "earnings"
  | "performanceInfo"
  | "trades"
  | "tradeDetail"
  | "guardianHistory"
  | "guardianPolicy"
  | "participants"
  | "fees"
  | "payoutRecord"
  | "documents"
  | "activity"
  | "compare"
  | "share"
  | "help"
  | "interest";

const titles: Record<Kind, string> = {
  overviewInfo: "How this pool is measured",
  schedule: "Pool timeline",
  bookSlots: "Add slots to this pool",
  payout: "Request a pool payout",
  statement: "Download pool statement",
  reminder: "Set an opening reminder",
  alerts: "Pool alert preferences",
  projection: "Project this pool's return",
  risk: "Risk profile & disclosure",
  support: "Contact the funding desk",
  earnings: "Earnings attribution",
  performanceInfo: "Performance method",
  trades: "Pool trade ledger",
  tradeDetail: "Trade settlement record",
  guardianHistory: "Guardian trigger history",
  guardianPolicy: "Guardian policy",
  participants: "Pool participants",
  fees: "Fees & profit share",
  payoutRecord: "Payout record",
  documents: "Pool documents",
  activity: "Pool activity",
  compare: "Compare with similar pools",
  share: "Share this pool",
  help: "Workspace boundaries",
  interest: "Register interest",
};

const wizardKinds: Kind[] = [
  "bookSlots",
  "payout",
  "statement",
  "reminder",
  "alerts",
  "projection",
  "risk",
  "support",
  "interest",
];

const steps = ["Prepare", "Review impact", "Acknowledge"] as const;

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  trades: "xl",
  compare: "xl",
  participants: "lg",
  statement: "lg",
  bookSlots: "lg",
  earnings: "lg",
  documents: "md",
  activity: "lg",
  help: "lg",
  guardianHistory: "lg",
  fees: "md",
  schedule: "md",
};

const quickActions: InvestorQuickAction[] = [
  { key: "book", label: "Book slots", short: "Book", icon: "plus" },
  {
    key: "statement",
    label: "Pool statement",
    short: "Statement",
    icon: "download",
  },
  {
    key: "earnings",
    label: "Earnings detail",
    short: "Earnings",
    icon: "trendUp",
  },
  { key: "payout", label: "Request payout", short: "Payout", icon: "wallet" },
  { key: "reminder", label: "Set reminder", short: "Remind", icon: "bell" },
  { key: "pools", label: "All pools", short: "Pools", icon: "pool" },
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
    <header className="pd-section-head">
      <div>
        <span className="pd-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="pd-section-aside">{aside}</div> : null}
    </header>
  );
}

function Progress({
  value,
  tone = "",
  label,
}: {
  value: number;
  tone?: string;
  label: string;
}) {
  return (
    <div
      className="pd-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className={`pd-progress__fill ${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Fact({
  label,
  value,
  hint,
  mono = true,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="pd-fact">
      <span>{label}</span>
      <b className={mono ? "mono" : undefined}>{value}</b>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function LifecycleTag({ lifecycle }: { lifecycle: DetailLifecycle }) {
  return (
    <span className={`pd-tag is-${lifecycle}`}>
      <span className="live-dot" aria-hidden="true" />
      {lifecycleLabel[lifecycle]}
    </span>
  );
}

/** Equity sparkline: hairline path + solid area, no gradient fills. */
function EquityCurve({
  points,
  positive,
}: {
  points: { at: string; value: number }[];
  positive: boolean;
}) {
  const width = 640;
  const height = 168;
  const padding = 8;
  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const step =
    points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    x: padding + index * step,
    y: height - padding - ((point.value - min) / span) * (height - padding * 2),
  }));
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${coords[coords.length - 1]?.x ?? padding} ${height - padding} L${padding} ${height - padding} Z`;
  return (
    <svg
      className="pd-curve"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Cumulative pool profit curve"
      preserveAspectRatio="none"
    >
      <line
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
        className="pd-curve__axis"
      />
      <path
        d={area}
        className={positive ? "pd-curve__area" : "pd-curve__area is-loss"}
      />
      <path
        d={line}
        className={positive ? "pd-curve__line" : "pd-curve__line is-loss"}
      />
      {coords.map((c, index) =>
        index === coords.length - 1 ? (
          <circle
            key="last"
            cx={c.x}
            cy={c.y}
            r={3.2}
            className="pd-curve__dot"
          />
        ) : null,
      )}
    </svg>
  );
}

function DistributionBars({
  rows,
}: {
  rows: {
    label: string;
    investment: number;
    sharePct: number;
    count: number;
  }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.investment));
  return (
    <div className="pd-bars">
      {rows.map((row, index) => (
        <div
          className="pd-bar-row"
          key={row.label}
          style={{ "--pd-delay": `${index * 60}ms` } as CSSProperties}
        >
          <span className="pd-bar-label">
            {row.label}
            <small>
              {row.count} investor{row.count === 1 ? "" : "s"}
            </small>
          </span>
          <span className="pd-bar-track">
            <span
              className="pd-bar-fill"
              style={{ width: `${Math.max(4, (row.investment / max) * 100)}%` }}
            />
          </span>
          <span className="pd-bar-value mono">
            {money(row.investment)}
            <small>{plainPercent(row.sharePct, 1)}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function ScheduleList({ steps: rows }: { steps: ScheduleStep[] }) {
  return (
    <ol className="pd-schedule">
      {rows.map((step, index) => (
        <li
          key={step.id}
          className={`pd-schedule__item is-${step.state}`}
          style={{ "--pd-delay": `${index * 40}ms` } as CSSProperties}
        >
          <span className="pd-schedule__dot" aria-hidden="true" />
          <div>
            <b>{step.label}</b>
            <span className="mono">{atDateTime(step.at)}</span>
            <p>{step.note}</p>
          </div>
          <span
            className={`pd-tag is-${step.state === "done" ? "completed" : step.state === "current" ? "open" : "upcoming"}`}
          >
            {step.state === "done"
              ? "Done"
              : step.state === "current"
                ? "Now"
                : "Next"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ── Page ── */

export function InvestorPoolDetailPage({
  initial,
  initialAction,
}: {
  initial: PoolDetailWorkspace;
  initialAction?: string;
}) {
  const router = useRouter();
  const { data, mutation } = usePoolDetail(initial);
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

  const initialModal = ((): { kind: Kind; id?: string } | null => {
    const byAction: Record<string, Kind> = {
      book: "bookSlots",
      payout: "payout",
      statement: "statement",
      reminder: "reminder",
      alerts: "alerts",
      projection: "projection",
      risk: "risk",
      support: "support",
      trades: "trades",
      guardian: "guardianPolicy",
      participants: "participants",
      documents: "documents",
      activity: "activity",
      schedule: "schedule",
      compare: "compare",
      share: "share",
      interest: "interest",
      overview: "overviewInfo",
      performance: "performanceInfo",
      fees: "fees",
      payoutRecord: "payoutRecord",
      help: "help",
    };
    const kind = initialAction ? byAction[initialAction] : undefined;
    return kind ? { kind } : null;
  })();

  const [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(
    initialModal,
  );
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<
    "position" | "trades" | "guardian" | null
  >(null);
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("detail");
  const [clock, setClock] = useState(initial.asOf);
  const [lastRefresh, setLastRefresh] = useState(initial.asOf);
  const [bookSlots, setBookSlots] = useState(1);
  const [interestSlots, setInterestSlots] = useState(1);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [payoutMethod, setPayoutMethod] = useState<"bank" | "usdt">("bank");
  const [remindLead, setRemindLead] = useState<1 | 2 | 3 | 7>(1);
  const [remindChannel, setRemindChannel] = useState<"email" | "in_app">(
    "email",
  );
  const [alerts, setAlerts] = useState({
    email: initial.preferences.email,
    inApp: initial.preferences.in_app,
    hours: initial.preferences.endingSoonHours,
  });
  const [scenario, setScenario] = useState({
    principal: initial.investment?.investment ?? initial.overview.slotPrice,
    roiPct: initial.projection?.roiPct ?? 15,
    days: initial.projection?.days ?? 21,
  });
  const [supportTopic, setSupportTopic] = useState<
    "pool" | "payment" | "payout" | "kyc" | "other"
  >("pool");
  const [supportMessage, setSupportMessage] = useState("");
  const [statementScope, setStatementScope] = useState<
    "pool-statement" | "daily-earnings" | "trade-ledger" | "participants"
  >("pool-statement");
  const [statementFormat, setStatementFormat] = useState<
    "json" | "csv" | "pdf"
  >("pdf");
  const [tradeFilter, setTradeFilter] = useState<
    "all" | "won" | "lost" | "open"
  >("all");
  const [participantSorting, setParticipantSorting] = useState<SortingState>(
    [],
  );
  const [compareSorting, setCompareSorting] = useState<SortingState>([]);
  const [ledgerOnlyLocal, setLedgerOnlyLocal] = useState(false);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const timer = window.setInterval(
      () => setClock((prev) => new Date(Date.parse(prev) + 1000).toISOString()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  /* ── Derived data ── */

  const { overview, investment, performance, guardian, participants } = data;
  const bookableNow = data.booking?.available ?? 0;
  const availablePayout = withdrawableNet(investment);
  const bookingCountdown = countdownFrom(overview.bookingClosesAt, clock);
  const tradingCountdown = countdownFrom(overview.tradingEndsAt, clock);
  const opensCountdown = countdownFrom(overview.bookingOpensAt, clock);
  const profitShareCountdown = overview.profitShareAt
    ? countdownFrom(overview.profitShareAt, clock)
    : null;
  const fill = detailFillPct(overview.raised, overview.goal);
  const elapsed = tradingElapsedPct(
    overview.tradingStartsAt,
    overview.tradingEndsAt,
    clock,
  );
  const refreshAge = Math.max(
    0,
    Math.floor((Date.parse(clock) - Date.parse(lastRefresh)) / 1000),
  );
  const refreshIn = Math.max(
    0,
    (investment?.refreshSeconds ?? 180) - refreshAge,
  );
  const nextRefresh =
    refreshIn > 0
      ? `${Math.floor(refreshIn / 60)}m ${String(refreshIn % 60).padStart(2, "0")}s`
      : "due now";
  const liveEarnings = useLiveCountUp(investment?.netEarnings ?? 0);
  const dailyTotal = useMemo(
    () => (investment ? sumDaily(investment.daily) : 0),
    [investment],
  );
  const dailyMax = useMemo(
    () => Math.max(1, ...(investment?.daily.map((day) => day.gross) ?? [1])),
    [investment],
  );
  const headroom = drawdownHeadroom(
    guardian.drawdownPct,
    guardian.drawdownLimitPct,
  );
  const maxInterestSlots = Math.max(
    1,
    Math.floor(overview.slotsTotal / Math.max(overview.investors, 1)),
  );

  const dockActions = useMemo<InvestorQuickAction[]>(() => {
    const book: InvestorQuickAction =
      overview.lifecycle === "upcoming"
        ? {
            key: "book",
            label: "Register interest",
            short: "Interest",
            icon: "bell",
          }
        : overview.lifecycle === "open"
          ? { key: "book", label: "Book slots", short: "Book", icon: "plus" }
          : {
              key: "book",
              label: "Pools open now",
              short: "Open now",
              icon: "pool",
            };
    return [book, ...quickActions.slice(1)];
  }, [overview.lifecycle]);

  const trades = useMemo(
    () =>
      data.trades.filter((trade) =>
        tradeFilter === "all" ? true : trade.result === tradeFilter,
      ),
    [data.trades, tradeFilter],
  );
  const modalTrade =
    data.trades.find((trade) => trade.id === modal?.id) ?? null;

  const participantColumn = useMemo(
    () => createDeskColumnHelper<ParticipantRow>(),
    [],
  );
  const participantColumns = useMemo(
    () =>
      participantColumn.columns([
        participantColumn.accessor("rank", {
          header: "#",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        participantColumn.accessor("alias", {
          header: "Investor",
          cell: (info) => (
            <span className={info.row.original.isYou ? "pd-you" : undefined}>
              {info.getValue()}
              {info.row.original.isYou ? <em>you</em> : null}
            </span>
          ),
        }),
        participantColumn.accessor("slots", {
          header: "Slots",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        participantColumn.accessor("investment", {
          header: "Committed",
          cell: (info) => (
            <span className="mono">{money(info.getValue())}</span>
          ),
        }),
        participantColumn.accessor("sharePct", {
          header: "Share",
          cell: (info) => (
            <span className="mono">{plainPercent(info.getValue(), 1)}</span>
          ),
        }),
      ]),
    [participantColumn],
  );
  const participantTable = useDeskTable({
    data: participants.rows,
    columns: participantColumns,
    state: { sorting: participantSorting },
    onSortingChange: setParticipantSorting,
  });

  const compareRowHelper = useMemo(
    () =>
      createDeskColumnHelper<{
        id: string;
        code: string;
        name: string;
        lifecycle: DetailLifecycle;
        goal: number;
        roiPct: number;
        relation: string;
        you: number;
      }>(),
    [],
  );
  const compareRows = useMemo(
    () => [
      {
        id: overview.id,
        code: overview.code,
        name: overview.name,
        lifecycle: overview.lifecycle,
        goal: overview.goal,
        roiPct: performance?.winRatePct ?? 0,
        relation: "This pool",
        you: investment?.investment ?? data.booking?.amount ?? 0,
      },
      ...data.related.map((pool) => ({
        id: pool.id,
        code: pool.code,
        name: pool.name,
        lifecycle: pool.lifecycle,
        goal: pool.goal,
        roiPct: pool.expectedRoiPct,
        relation: pool.relation,
        you: 0,
      })),
    ],
    [
      data.booking?.amount,
      data.related,
      investment?.investment,
      overview.code,
      overview.goal,
      overview.id,
      overview.lifecycle,
      overview.name,
      performance?.winRatePct,
    ],
  );
  const compareColumns = useMemo(
    () =>
      compareRowHelper.columns([
        compareRowHelper.accessor("code", {
          header: "Pool",
          cell: (info) => (
            <span>
              <b className="mono">{info.getValue()}</b>
              <small>{info.row.original.name}</small>
            </span>
          ),
        }),
        compareRowHelper.accessor("relation", { header: "Relation" }),
        compareRowHelper.accessor("lifecycle", {
          header: "Status",
          cell: (info) => <LifecycleTag lifecycle={info.getValue()} />,
        }),
        compareRowHelper.accessor("goal", {
          header: "Target",
          cell: (info) => (
            <span className="mono">{money(info.getValue())}</span>
          ),
        }),
        compareRowHelper.accessor("roiPct", {
          header: "Return",
          cell: (info) => (
            <span className="mono">
              {info.row.original.relation === "This pool"
                ? `${plainPercent(info.getValue(), 1)} win`
                : `${percent(info.getValue())} target`}
            </span>
          ),
        }),
        compareRowHelper.accessor("you", {
          header: "Your allocation",
          cell: (info) => (
            <span className="mono">
              {info.getValue() ? money(info.getValue()) : "—"}
            </span>
          ),
        }),
        compareRowHelper.accessor("id", {
          header: "",
          enableSorting: false,
          cell: (info) =>
            info.getValue() === overview.id ? (
              <span className="pd-muted">current</span>
            ) : (
              <Link
                className="pd-link"
                href={`/investor/pools/${info.getValue()}`}
              >
                Open ↗
              </Link>
            ),
        }),
      ]),
    [compareRowHelper, overview.id],
  );
  const compareTable = useDeskTable({
    data: compareRows,
    columns: compareColumns,
    state: { sorting: compareSorting },
    onSortingChange: setCompareSorting,
  });

  const ledger = useMemo(() => {
    const local = data.audit.map((entry) => ({
      id: entry.id,
      at: entry.at,
      scope: "Local workspace" as const,
      title: entry.action.replaceAll("_", " "),
      detail: entry.detail,
    }));
    const source = data.events.map((event) => ({
      id: event.id,
      at: event.at,
      scope: "Source snapshot" as const,
      title: event.title,
      detail: event.detail,
    }));
    const rows = [...local, ...source].sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at),
    );
    return ledgerOnlyLocal
      ? rows.filter((row) => row.scope === "Local workspace")
      : rows;
  }, [data.audit, data.events, ledgerOnlyLocal]);

  const statementRecords = useMemo(() => {
    if (statementScope === "daily-earnings")
      return (
        investment?.daily.map((day) => ({
          date: day.date,
          gross: day.gross,
          net: day.net,
        })) ?? []
      );
    if (statementScope === "trade-ledger")
      return data.trades.map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        contract: trade.contract,
        result: trade.result,
        poolPnl: trade.poolPnl,
        investorShare: trade.investorShare,
        openedAt: trade.openedAt,
        closedAt: trade.closedAt,
      }));
    if (statementScope === "participants")
      return participants.rows.map((row) => ({
        rank: row.rank,
        investor: row.alias,
        slots: row.slots,
        committed: row.investment,
        sharePct: row.sharePct,
      }));
    return [
      {
        pool: overview.code,
        name: overview.name,
        lifecycle: overview.lifecycle,
        goal: overview.goal,
        raised: overview.raised,
        slots: `${overview.slotsFilled}/${overview.slotsTotal}`,
        yourSlots: investment?.slots ?? data.booking?.slots ?? 0,
        yourInvestment: investment?.investment ?? data.booking?.amount ?? 0,
        pnl: investment?.pnl ?? 0,
        grossEarnings: investment?.grossEarnings ?? 0,
        platformCut: investment?.platformCut ?? 0,
        netEarnings: investment?.netEarnings ?? 0,
        roiPct: investment?.roiPct ?? 0,
        tradingEndsAt: overview.tradingEndsAt,
      },
    ];
  }, [
    data.booking,
    data.trades,
    investment,
    overview,
    participants.rows,
    statementScope,
  ]);

  /* ── Effects ── */

  const overlay = Boolean(modal || drawer);
  useEffect(() => {
    if (!overlay) return;
    const prior = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const layer = document.querySelector<HTMLElement>(
      ".page-investor-pool-detail [role=dialog]",
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

  const payoutSeeded = useRef(false);
  useEffect(() => {
    if (modal?.kind === "payout") {
      if (!payoutSeeded.current) {
        payoutSeeded.current = true;
        if (payoutAmount <= 0 && availablePayout > 0)
          setPayoutAmount(availablePayout);
      }
    } else {
      payoutSeeded.current = false;
    }
  }, [modal?.kind, availablePayout, payoutAmount]);

  useEffect(() => {
    if (!modal) return;
    const timer = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          ".page-investor-pool-detail .desk-modal__body input, .page-investor-pool-detail .desk-modal__body select, .page-investor-pool-detail .desk-modal__body textarea",
        )
        ?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [modal, step]);

  /* ── Actions ── */

  useEffect(() => {
    closeRef.current = close;
  });

  function close() {
    setModal(null);
    setDrawer(null);
    setStep(0);
    setConfirmed(false);
    setError("");
  }

  function open(kind: Kind, id?: string) {
    setModal({ kind, id });
    setStep(0);
    setConfirmed(false);
    setError("");
    setDrawer(null);
    if (kind === "bookSlots") setBookSlots(Math.min(1, bookableNow));
    if (kind === "interest") setInterestSlots(1);
    if (kind === "payout") setPayoutAmount(availablePayout);
    if (kind === "statement") {
      setStatementScope("pool-statement");
      setStatementFormat(investment ? "pdf" : "json");
    }
  }

  function scrollTo(key: InvestorNavKey) {
    setActiveNav(key);
    const map: Partial<Record<InvestorNavKey, string>> = {
      pools: "pd-top",
      overview: "pd-top",
      earnings: "pd-position",
      activity: "pd-guardian",
      portfolio: "pd-participants",
    };
    if (key === "upcoming") {
      router.push("/investor/pools");
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
    document
      .getElementById(map[key] ?? "pd-top")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function run(
    command: PoolDetailCommand,
    opts?: { keep?: boolean; title?: string },
  ) {
    setError("");
    setBusy(true);
    try {
      await mutation.mutateAsync(command);
      pushToast({
        tone: "success",
        title: opts?.title ?? "Local pool workspace updated",
        detail:
          "No money moved, no payment was captured and no provider request was made.",
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

  const download = (value: string, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  async function downloadDocument(documentId: string) {
    const record = data.documents.find((item) => item.id === documentId);
    if (!record) return;
    setBusy(true);
    try {
      const rows =
        record.kind === "ledger"
          ? (data.investment?.daily ?? [])
          : record.kind === "statement"
            ? statementRecords
            : [
                {
                  pool: overview.code,
                  name: overview.name,
                  lifecycle: overview.lifecycle,
                  goal: overview.goal,
                  raised: overview.raised,
                  slotPrice: overview.slotPrice,
                  profitSharePct: overview.profitSharePct,
                  tradingStartsAt: overview.tradingStartsAt,
                  tradingEndsAt: overview.tradingEndsAt,
                  guardianDrawdownPct: guardian.drawdownPct,
                  guardianLimitPct: guardian.drawdownLimitPct,
                },
              ];
      const stamp = isoDay(data.asOf);
      if (record.format === "csv") {
        const keys = Object.keys(rows[0] ?? { date: "" });
        const csv = [
          keys.join(","),
          ...rows.map((row) =>
            keys
              .map(
                (key) =>
                  `"${String((row as Record<string, unknown>)[key] ?? "").replaceAll('"', '""')}"`,
              )
              .join(","),
          ),
        ].join("\n");
        download(
          csv,
          `${overview.code}-${record.kind}-${stamp}.csv`,
          "text/csv",
        );
      } else if (record.format === "json") {
        download(
          JSON.stringify(
            { pool: overview.code, kind: record.kind, rows },
            null,
            2,
          ),
          `${overview.code}-${record.kind}-${stamp}.json`,
          "application/json",
        );
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setFontSize(15);
        doc.text(`tradeMO / ${record.name}`, 18, 22);
        doc.setFontSize(9);
        doc.text(
          `${overview.code} ${overview.name} · source snapshot ${data.asOf}`,
          18,
          32,
        );
        doc.text(
          "Generated locally for review. Certified documents must come from the backend.",
          18,
          38,
        );
        let y = 52;
        doc.setFontSize(8);
        rows.forEach((row) => {
          if (y > 274) {
            doc.addPage();
            y = 20;
          }
          doc.text(
            Object.entries(row as Record<string, unknown>)
              .map(([key, value]) => `${key}: ${value ?? "—"}`)
              .join(" · ")
              .slice(0, 150),
            18,
            y,
          );
          y += 6;
        });
        doc.save(`${overview.code}-${record.kind}-${stamp}.pdf`);
      }
      await mutation.mutateAsync({
        kind: "recordExport",
        scope:
          record.kind === "ledger"
            ? "daily-earnings"
            : record.kind === "statement"
              ? "pool-statement"
              : "pool-statement",
        format: record.format,
        count: rows.length,
      });
      pushToast({
        tone: "success",
        title: `${record.name} downloaded`,
        detail: `${record.format.toUpperCase()} · generated in-browser.`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Document export failed");
    } finally {
      setBusy(false);
    }
  }

  async function performStatement() {
    setBusy(true);
    try {
      const rows = statementRecords;
      const stamp = isoDay(data.asOf);
      if (statementFormat === "json") {
        download(
          JSON.stringify(
            {
              mode: "demo",
              asOf: data.asOf,
              pool: overview.code,
              scope: statementScope,
              rows,
            },
            null,
            2,
          ),
          `${overview.code}-${statementScope}-${stamp}.json`,
          "application/json",
        );
      } else if (statementFormat === "csv") {
        const keys = Object.keys(rows[0] ?? {});
        const csv = [
          keys.join(","),
          ...rows.map((row) =>
            keys
              .map(
                (key) =>
                  `"${String((row as Record<string, unknown>)[key] ?? "").replaceAll('"', '""')}"`,
              )
              .join(","),
          ),
        ].join("\n");
        download(
          csv,
          `${overview.code}-${statementScope}-${stamp}.csv`,
          "text/csv",
        );
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(
          `tradeMO / ${overview.code} ${statementScope.replaceAll("-", " ")}`,
          18,
          22,
        );
        doc.setFontSize(9);
        doc.text(
          `Pool ${overview.code} ${overview.name} · ${lifecycleLabel[overview.lifecycle]}`,
          18,
          30,
        );
        doc.text(
          `Source snapshot ${data.asOf} · demo export · no provider or settlement authority`,
          18,
          36,
        );
        doc.text(
          `Investor: ${data.profile.displayName} (${data.profile.id})`,
          18,
          42,
        );
        let y = 54;
        doc.setFontSize(8);
        rows.forEach((row) => {
          if (y > 274) {
            doc.addPage();
            y = 20;
          }
          doc.text(
            Object.entries(row as Record<string, unknown>)
              .map(([key, value]) => `${key}: ${value ?? "—"}`)
              .join(" · ")
              .slice(0, 150),
            18,
            y,
          );
          y += 6;
        });
        doc.save(`${overview.code}-${statementScope}-${stamp}.pdf`);
      }
      await mutation.mutateAsync({
        kind: "recordExport",
        scope: statementScope,
        format: statementFormat,
        count: rows.length,
      });
      setLastRefresh(new Date().toISOString());
      pushToast({
        tone: "success",
        title: "Statement generated in-browser",
        detail: `${rows.length} record(s) · ${statementFormat.toUpperCase()} · not a certified statement.`,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPayoutRecord() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.text("tradeMO / pool payout record", 18, 22);
    doc.setFontSize(9);
    doc.text(`${overview.code} ${overview.name} · cycle settled`, 18, 32);
    let y = 48;
    const rows: [string, string][] = [
      ["Invested", money(investment?.investment ?? 0, 2)],
      ["Gross earnings", signedMoney(investment?.grossEarnings ?? 0, 2)],
      [
        `Platform share (${investment?.platformCutPct ?? 0}%)`,
        `−${money(investment?.platformCut ?? 0, 2)}`,
      ],
      ["Net paid", signedMoney(investment?.netEarnings ?? 0, 2)],
      ["ROI", percent(investment?.roiPct ?? 0)],
      [
        "Profit share date",
        overview.profitShareAt ? atDate(overview.profitShareAt) : "—",
      ],
    ];
    rows.forEach(([label, value]) => {
      doc.text(label, 18, y);
      doc.text(value, 84, y);
      y += 8;
    });
    doc.setFontSize(8);
    doc.text(
      "Generated locally for review. Settlement records, tax documents and provider receipts must come from the backend.",
      18,
      y + 10,
    );
    doc.save(`${overview.code}-payout-record-demo.pdf`);
    await mutation.mutateAsync({
      kind: "recordExport",
      scope: "pool-statement",
      format: "pdf",
      count: 1,
    });
    pushToast({
      tone: "success",
      title: `${overview.code} payout record downloaded`,
    });
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/investor/pools/${overview.id}`;
    try {
      await navigator.clipboard.writeText(url);
      pushToast({
        tone: "success",
        title: "Permalink copied",
        detail: url,
      });
    } catch {
      pushToast({
        tone: "info",
        title: "Permalink available in the field below",
        detail: url,
      });
    }
  }

  async function manualRefresh() {
    setBusy(true);
    try {
      await mutation.mutateAsync({ kind: "refreshDetail", source: "manual" });
      setLastRefresh(new Date().toISOString());
      setClock(data.asOf);
      pushToast({
        tone: "info",
        title: "Pool snapshot re-read",
        detail: "Countdowns restarted; provider data is unchanged.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  const wizard = modal
    ? wizardKinds.includes(modal.kind) &&
      !(modal.kind === "interest" && Boolean(data.interest))
    : false;

  const modalBlock = (() => {
    if (!modal) return "";
    if (modal.kind === "bookSlots") {
      if (overview.lifecycle !== "open")
        return "Bookings are closed for this cycle";
      if (bookSlots < 1) return "Enter at least one slot";
      if (bookSlots > bookableNow)
        return bookableNow
          ? `Only ${bookableNow} slot(s) remain for your allocation`
          : "No slots remain for your allocation";
      return "";
    }
    if (modal.kind === "payout") {
      if (availablePayout <= 0)
        return "This pool has no settled earnings to withdraw";
      if (payoutAmount < 100) return "Minimum payout is $100";
      if (payoutAmount > availablePayout)
        return `Only ${money(availablePayout, 2)} is available from this pool`;
      return "";
    }
    if (modal.kind === "interest") {
      if (data.interest) return "Interest is already registered for this pool";
      if (interestSlots < 1) return "Select at least one slot";
      if (interestSlots > maxInterestSlots)
        return `Maximum ${maxInterestSlots} slot(s) per investor for this pool`;
      return "";
    }
    if (modal.kind === "alerts" && !alerts.email && !alerts.inApp)
      return "Keep at least one channel enabled";
    if (modal.kind === "support" && supportMessage.trim().length < 12)
      return "Add at least 12 characters so the desk can act on it";
    if (modal.kind === "reminder" && overview.lifecycle === "completed")
      return "This cycle is closed; reminders apply to open windows";
    if (modal.kind === "reminder" && data.reminders.length >= 4)
      return "Four reminders are already queued for this pool";
    return "";
  })();

  const modalFooter = (
    <>
      {wizard && step === 2 ? (
        <label className="pd-check pd-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            aria-label="Acknowledge session-only preview"
          />
          I have reviewed this {titles[modal?.kind ?? "help"].toLowerCase()}{" "}
          preview and understand it records session state only — no payment,
          slot confirmation, message or provider change is sent.
        </label>
      ) : null}
      <button
        type="button"
        className="pd-btn"
        disabled={busy}
        onClick={() => (step ? setStep(step - 1) : close())}
      >
        {step ? "Back" : "Close"}
      </button>
      <span className="pd-foot-note">Session-only preview · no funds move</span>
      {wizard ? (
        <button
          type="button"
          className="pd-btn pd-btn--primary"
          disabled={
            busy || (step < 2 && !!modalBlock) || (step === 2 && !confirmed)
          }
          onClick={() => {
            if (step < 2) setStep(step + 1);
            else void submit();
          }}
        >
          {busy
            ? "Working…"
            : step < 2
              ? "Continue →"
              : modal?.kind === "statement"
                ? "Download statement"
                : "Confirm local preview"}
        </button>
      ) : null}
    </>
  );

  async function submit() {
    if (!modal) return;
    switch (modal.kind) {
      case "bookSlots":
        return void run(
          { kind: "bookSlots", slots: bookSlots },
          { title: "Slot hold prepared locally" },
        );
      case "payout":
        return void run(
          { kind: "draftPayout", amount: payoutAmount, method: payoutMethod },
          { title: "Payout draft saved locally" },
        );
      case "reminder":
        return void run(
          { kind: "setReminder", leadDays: remindLead, channel: remindChannel },
          { title: "Reminder prepared locally" },
        );
      case "alerts":
        return void run(
          {
            kind: "savePreferences",
            email: alerts.email,
            inApp: alerts.inApp,
            endingSoonHours: alerts.hours,
          },
          { title: "Alert preferences saved locally" },
        );
      case "projection":
        return void run(
          {
            kind: "saveProjection",
            principal: scenario.principal,
            roiPct: scenario.roiPct,
            days: scenario.days,
          },
          { title: "Projection saved locally" },
        );
      case "risk":
        return void run(
          { kind: "refreshDetail", source: "manual" },
          { title: "Risk acknowledgement recorded locally" },
        );
      case "support":
        return void run(
          { kind: "support", topic: supportTopic, message: supportMessage },
          { title: "Support draft saved locally" },
        );
      case "interest":
        return void run(
          { kind: "prebookInterest", slots: interestSlots },
          { title: "Interest registered locally" },
        );
      case "statement":
        return performStatement();
      default:
        return;
    }
  }

  return (
    <InvestorShell
      rootClass="page-investor-pool-detail"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={data.profile.committed}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.profile.wallet}
      unread={data.profile.unread}
      activeNav={activeNav}
      detailHref={`/investor/pools/${overview.id}`}
      quickActions={dockActions}
      onNavigate={scrollTo}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(
          tab === "portfolio"
            ? "position"
            : tab === "activity"
              ? "trades"
              : "guardian",
        )
      }
      onQuickAction={(key) => {
        if (key === "book") {
          if (overview.lifecycle === "upcoming") open("interest");
          else if (overview.lifecycle === "open") open("bookSlots");
          else router.push("/investor/pools");
        }
        if (key === "statement") open("statement");
        if (key === "earnings") open("earnings");
        if (key === "payout") open(investment ? "payout" : "projection");
        if (key === "reminder")
          open(overview.lifecycle === "completed" ? "schedule" : "reminder");
        if (key === "pools") router.push("/investor/pools");
      }}
      onOpenNotifications={() => open("activity")}
      onChromeReady={(next) => {
        chrome.current = next;
      }}
    >
      <div className="pd-page" id="pd-top">
        <header className="pd-head">
          <div>
            <nav className="pd-crumbs" aria-label="Breadcrumb">
              <Link href="/investor">Investor workspace</Link>
              <span aria-hidden="true">/</span>
              <Link href="/investor/pools">Crowdfunding pools</Link>
              <span aria-hidden="true">/</span>
              <span className="mono">{overview.code}</span>
            </nav>
            <div className="pd-eyebrow">
              <span className="pd-code">I-3 / POOL DETAIL</span>
              <LifecycleTag lifecycle={overview.lifecycle} />
              <span className={`pd-risk-pill ${riskTone(overview.riskBand)}`}>
                {overview.riskBand} risk
              </span>
            </div>
            <h1>{overview.name}</h1>
            <p>{overview.strategy}</p>
            <div className="pd-meta">
              <span>
                <Icon name="package" size={12} /> {overview.code} ·{" "}
                {overview.markets.join(" · ")}
              </span>
              <span>
                <Icon name="users" size={12} /> {overview.investors}{" "}
                participants
              </span>
              <span>
                <Icon name="calendar" size={12} /> Snapshot{" "}
                {atDateTime(data.asOf)}
              </span>
              <span>
                <Icon name="clock" size={12} />{" "}
                {overview.lifecycle === "upcoming"
                  ? `opens in ${opensCountdown.label}`
                  : overview.lifecycle === "completed"
                    ? `settled ${relativeTo(overview.profitShareAt ?? overview.tradingEndsAt)}`
                    : `trading ends in ${tradingCountdown.label}`}
              </span>
            </div>
          </div>
          <div className="pd-actions">
            <Link className="pd-btn" href="/investor/pools">
              <Icon name="arrowLeft" size={14} /> All pools
            </Link>
            <button
              type="button"
              className="pd-btn"
              onClick={() => open("share")}
            >
              <Icon name="link" size={14} /> Share
            </button>
            <button
              type="button"
              className={`pd-btn${data.watching ? " is-on" : ""}`}
              aria-pressed={data.watching}
              onClick={() =>
                void run(
                  { kind: "setWatch", watching: !data.watching },
                  {
                    keep: true,
                    title: data.watching
                      ? "Removed from your watchlist"
                      : "Added to your watchlist",
                  },
                )
              }
            >
              <Icon name="eye" size={14} />{" "}
              {data.watching ? "Watching" : "Watch"}
            </button>
            <button
              type="button"
              className="pd-btn"
              onClick={() => open("statement")}
            >
              <Icon name="download" size={14} /> Statement
            </button>
            {overview.lifecycle === "open" ? (
              <button
                type="button"
                className="pd-btn pd-btn--primary"
                onClick={() => open("bookSlots")}
              >
                <Icon name="plus" size={14} /> Book slots
              </button>
            ) : overview.lifecycle === "upcoming" ? (
              <button
                type="button"
                className="pd-btn pd-btn--primary"
                onClick={() => open("interest")}
              >
                <Icon name={data.interest ? "check" : "bell"} size={14} />{" "}
                {data.interest ? "Interest registered" : "Register interest"}
              </button>
            ) : overview.lifecycle === "trading" ? (
              <button
                type="button"
                className="pd-btn pd-btn--primary"
                onClick={() =>
                  open(availablePayout > 0 ? "payout" : "earnings")
                }
              >
                <Icon name="wallet" size={14} />{" "}
                {availablePayout > 0 ? "Request payout" : "Earnings detail"}
              </button>
            ) : (
              <button
                type="button"
                className="pd-btn pd-btn--primary"
                onClick={() => open("payoutRecord")}
              >
                <Icon name="download" size={14} /> Payout record
              </button>
            )}
          </div>
        </header>

        <div className="pd-banner">
          <div>
            <b>FRONTEND POOL DETAIL</b>
            <span>
              source snapshot {atDateTime(data.asOf)} · structured DTO · no
              provider fill, payment capture or settlement authority
            </span>
          </div>
          <div className="pd-banner__actions">
            <span className="pd-sync">
              <span className="live-dot" aria-hidden="true" />{" "}
              {investment
                ? `next refresh ${nextRefresh}`
                : `${refreshAge}s since refresh`}
            </span>
            <button
              type="button"
              className="pd-link"
              onClick={() => void manualRefresh()}
              disabled={busy}
            >
              <Icon name="refresh" size={13} /> Refresh
            </button>
            <button
              type="button"
              className="pd-link"
              onClick={() => open("help")}
            >
              Integration boundaries ↗
            </button>
          </div>
        </div>

        {/* 01 — Overview */}
        <section className="pd-section" id="pd-overview">
          <SectionHead
            code="01 / POOL OVERVIEW"
            title="What this cycle is and where it stands"
            hint={overview.thesis}
            aside={
              <button
                type="button"
                className="pd-btn"
                onClick={() => open("overviewInfo")}
              >
                <Icon name="info" size={14} /> How this is measured
              </button>
            }
          />

          <div className="pd-overview">
            <div className="pd-overview__main">
              <dl className="pd-facts">
                <Fact label="TARGET CAPITAL" value={money(overview.goal)} />
                <Fact
                  label="RAISED"
                  value={money(overview.raised)}
                  hint={`${plainPercent(fill, 0)} of target`}
                />
                <Fact
                  label="SLOTS"
                  value={`${overview.slotsFilled}/${overview.slotsTotal}`}
                  hint={`${overview.investors} participants`}
                />
                <Fact
                  label="SLOT PRICE"
                  value={money(overview.slotPrice)}
                  hint="minimum allocation"
                />
                <Fact
                  label="PROFIT SHARE"
                  value={`${overview.profitSharePct}%`}
                  hint="of pool profit, before the platform share"
                />
                <Fact
                  label="SETTLEMENT"
                  value={overview.settlementBatch}
                  hint="net after the 20% platform share"
                  mono={false}
                />
                <Fact
                  label="MARKETS"
                  value={overview.markets.join(" · ")}
                  mono
                />
                <Fact label="MANAGER" value={overview.manager} mono={false} />
              </dl>

              <div className="pd-funding">
                <div className="pd-funding__head">
                  <span>FUNDING PROGRESS</span>
                  <span className="mono">
                    {money(overview.raised)} / {money(overview.goal)}
                  </span>
                </div>
                <Progress value={fill} label="Funding progress" />
                <div className="pd-funding__foot">
                  <span>
                    <b>{money(Math.max(0, overview.goal - overview.raised))}</b>{" "}
                    remaining to target
                  </span>
                  <span>
                    {overview.lifecycle === "open"
                      ? `booking closes in ${bookingCountdown.label}`
                      : overview.lifecycle === "upcoming"
                        ? `opens in ${opensCountdown.label}`
                        : overview.lifecycle === "trading"
                          ? "funding window closed"
                          : "cycle settled"}
                  </span>
                </div>
              </div>

              <div className="pd-windows">
                <div className="pd-window">
                  <span className="pd-window__label">BOOKING WINDOW</span>
                  <b>
                    {atDate(overview.bookingOpensAt)} →{" "}
                    {atDate(overview.bookingClosesAt)}
                  </b>
                  <small>
                    {overview.lifecycle === "open"
                      ? `closes in ${bookingCountdown.days}d ${bookingCountdown.hours}h ${bookingCountdown.minutes}m`
                      : overview.lifecycle === "upcoming"
                        ? `opens in ${opensCountdown.days}d ${opensCountdown.hours}h`
                        : "window closed"}
                  </small>
                </div>
                <div className="pd-window">
                  <span className="pd-window__label">TRADING WINDOW</span>
                  <b>
                    {atDate(overview.tradingStartsAt)} →{" "}
                    {atDate(overview.tradingEndsAt)}
                  </b>
                  <small>
                    {overview.lifecycle === "completed"
                      ? "trading closed"
                      : overview.lifecycle === "upcoming"
                        ? "starts after booking closes"
                        : `${countdownFrom(overview.tradingEndsAt, clock).label} remaining`}
                  </small>
                </div>
                <div className="pd-window">
                  <span className="pd-window__label">PROFIT SHARE DATE</span>
                  <b>
                    {overview.profitShareAt
                      ? atDateTime(overview.profitShareAt)
                      : "—"}
                  </b>
                  <small>
                    {profitShareCountdown && profitShareCountdown.total > 0
                      ? `in ${profitShareCountdown.label}`
                      : "attributed after settlement"}
                  </small>
                </div>
              </div>

              <div className="pd-elapsed">
                <div className="pd-elapsed__head">
                  <span>TRADING ELAPSED</span>
                  <span className="mono">{plainPercent(elapsed, 0)}</span>
                </div>
                <Progress
                  value={elapsed}
                  tone={overview.lifecycle === "completed" ? "is-muted" : ""}
                  label="Trading window elapsed"
                />
                <div className="pd-elapsed__foot">
                  <span>
                    {overview.lifecycle === "completed"
                      ? `Closed ${atDate(overview.tradingEndsAt)}`
                      : `${countdownFrom(overview.tradingEndsAt, clock).label} remaining`}
                  </span>
                  <span>{overview.settlementBatch}</span>
                </div>
              </div>
            </div>

            <aside className="pd-overview__side">
              <div className={`pd-guardian-card is-${guardian.status}`}>
                <div className="pd-guardian-card__top">
                  <span className="pd-guardian-card__icon">
                    <Icon name="shield" size={16} />
                  </span>
                  <div>
                    <b>AI Guardian</b>
                    <span>
                      {guardian.status === "active"
                        ? "Active · all clear"
                        : guardian.status === "watch"
                          ? "Watch · stake reduced"
                          : "Standby until trading"}
                    </span>
                  </div>
                  <span
                    className={`pd-tag is-${guardian.status === "active" ? "trading" : "upcoming"}`}
                  >
                    {guardian.status}
                  </span>
                </div>
                <p>{guardian.note}</p>
                <div className="pd-guardian-line">
                  <span>
                    Drawdown{" "}
                    <b className="mono">
                      {guardian.drawdownPct}% / {guardian.drawdownLimitPct}%
                    </b>
                  </span>
                  <span>
                    Loss streak{" "}
                    <b className="mono">
                      {guardian.consecutiveLosses}/
                      {guardian.maxConsecutiveLosses}
                    </b>
                  </span>
                  <span>
                    Checked {relativeTo(guardian.lastCheckedAt, clock)}
                  </span>
                </div>
                <div className="pd-meter">
                  <span
                    style={{
                      width: `${Math.min(100, (guardian.drawdownPct / Math.max(guardian.drawdownLimitPct, 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="pd-guardian-card__actions">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("guardianPolicy")}
                  >
                    Policy
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("guardianHistory")}
                  >
                    Trigger history ({guardian.triggersTotal})
                  </button>
                </div>
              </div>

              <div className="pd-schedule-card">
                <div className="pd-schedule-card__head">
                  <b>Timeline</b>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("schedule")}
                  >
                    Full timeline ↗
                  </button>
                </div>
                <ScheduleList steps={data.schedule.slice(0, 3)} />
              </div>
            </aside>
          </div>
        </section>

        {/* 02 — Your position */}
        <section className="pd-section" id="pd-position">
          <SectionHead
            code="02 / YOUR INVESTMENT"
            title={
              investment ? "Your position in this pool" : "Your allocation"
            }
            hint={
              investment
                ? "Slot count, capital, token allocation and live earnings attribution for this cycle."
                : "Nothing is committed to this cycle yet. Funding-desk figures show what a minimum slot would take."
            }
            aside={
              <div className="pd-head-stats">
                <span>
                  Share{" "}
                  <b className="mono">
                    {investment ? plainPercent(investment.sharePct, 1) : "—"}
                  </b>
                </span>
                <span>
                  Tokens{" "}
                  <b className="mono">
                    {investment
                      ? `${investment.tokens.toLocaleString()} ${investment.tokenSymbol}`
                      : "—"}
                  </b>
                </span>
                <span>
                  ROI{" "}
                  <b className="mono">
                    {investment ? percent(investment.roiPct) : "—"}
                  </b>
                </span>
              </div>
            }
          />

          <div className="pd-position-grid">
            {investment ? (
              <article className="pd-card pd-position-card">
                <div className="pd-card__top">
                  <span className="pd-section-code">POSITION</span>
                  <span className="pd-muted">
                    updated {relativeTo(investment.lastUpdatedAt, clock)}
                  </span>
                </div>
                <div className="pd-position-hero">
                  <span>NET EARNINGS · AFTER PLATFORM SHARE</span>
                  <b className="mono">{signedMoney(liveEarnings, 2)}</b>
                  <small>
                    {signedMoney(investment.pnl, 2)} pool share ·{" "}
                    {percent(investment.roiPct)} on{" "}
                    {money(investment.investment)}
                  </small>
                </div>
                <dl className="pd-position-facts">
                  <div>
                    <dt>SLOTS</dt>
                    <dd className="mono">{investment.slots}</dd>
                  </div>
                  <div>
                    <dt>INVESTED</dt>
                    <dd className="mono">{money(investment.investment)}</dd>
                  </div>
                  <div>
                    <dt>CAPITAL SHARE</dt>
                    <dd className="mono">
                      {plainPercent(investment.sharePct, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt>TOKENS</dt>
                    <dd className="mono">
                      {investment.tokens.toLocaleString()}{" "}
                      {investment.tokenSymbol}
                    </dd>
                  </div>
                  <div>
                    <dt>GROSS EARNINGS</dt>
                    <dd className="mono text-win">
                      {signedMoney(investment.grossEarnings, 2)}
                    </dd>
                  </div>
                  <div>
                    <dt>PLATFORM CUT ({investment.platformCutPct}%)</dt>
                    <dd className="mono text-loss">
                      −{money(investment.platformCut, 2)}
                    </dd>
                  </div>
                </dl>
                <div className="pd-card__foot">
                  <button
                    type="button"
                    className="pd-btn"
                    onClick={() => open("earnings")}
                  >
                    <Icon name="trendUp" size={14} /> Full earnings
                  </button>
                  <button
                    type="button"
                    className="pd-btn pd-btn--primary"
                    onClick={() =>
                      open(availablePayout > 0 ? "payout" : "payoutRecord")
                    }
                  >
                    <Icon name="wallet" size={14} />{" "}
                    {availablePayout > 0
                      ? `Request ${money(availablePayout, 2)}`
                      : "Payout record"}
                  </button>
                </div>
              </article>
            ) : (
              <article className="pd-card pd-position-card">
                <div className="pd-card__top">
                  <span className="pd-section-code">
                    {data.booking ? "BOOKING" : "NO POSITION YET"}
                  </span>
                  <span className="pd-muted">
                    {data.booking
                      ? `booked ${relativeTo(data.booking.bookedAt, clock)}`
                      : "nothing committed"}
                  </span>
                </div>
                {data.booking ? (
                  <>
                    <div className="pd-position-hero">
                      <span>BOOKED ALLOCATION</span>
                      <b className="mono">{money(data.booking.amount)}</b>
                      <small>
                        {data.booking.slots} slot(s) at{" "}
                        {money(overview.slotPrice)} · {data.booking.available}{" "}
                        more available to you
                      </small>
                    </div>
                    <div className={`pd-pay is-${data.booking.payment}`}>
                      <Icon
                        name={
                          data.booking.payment === "verified"
                            ? "check"
                            : "clock"
                        }
                        size={13}
                      />
                      {data.booking.payment === "verified"
                        ? "Payment verified"
                        : "Awaiting payment verification"}
                      {data.booking.reference
                        ? ` · ${data.booking.reference}`
                        : ""}
                    </div>
                    <p className="pd-note">{data.booking.note}</p>
                  </>
                ) : (
                  <>
                    <div className="pd-position-hero">
                      <span>EXPECTED AT MINIMUM SLOT</span>
                      <b className="mono">
                        {data.projection
                          ? signedMoney(data.projection.projectedProfit, 2)
                          : "—"}
                      </b>
                      <small>
                        {money(overview.slotPrice)} at{" "}
                        {percent(data.projection?.roiPct ?? 0)} over{" "}
                        {data.projection?.days ?? "—"} days · not a forecast
                      </small>
                    </div>
                    <p className="pd-note">
                      {overview.lifecycle === "upcoming"
                        ? "Expressions of interest are non-binding. Slots are confirmed in booking order once the window opens and payment verifies."
                        : "Bookings are closed for this cycle. The next window opens with the following pool in the roadmap."}
                    </p>
                  </>
                )}
                <div className="pd-card__foot">
                  {overview.lifecycle === "open" ? (
                    <button
                      type="button"
                      className="pd-btn pd-btn--primary"
                      onClick={() => open("bookSlots")}
                    >
                      <Icon name="plus" size={14} /> Book slots
                    </button>
                  ) : overview.lifecycle === "upcoming" ? (
                    <button
                      type="button"
                      className="pd-btn pd-btn--primary"
                      onClick={() => open("interest")}
                    >
                      <Icon name={data.interest ? "check" : "bell"} size={14} />{" "}
                      {data.interest
                        ? "Interest registered"
                        : "Register interest"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pd-btn"
                      onClick={() => open("projection")}
                    >
                      <Icon name="chart" size={14} /> Project a return
                    </button>
                  )}
                  <button
                    type="button"
                    className="pd-btn"
                    onClick={() => open("schedule")}
                  >
                    <Icon name="calendar" size={14} /> Timeline
                  </button>
                </div>
              </article>
            )}

            <article className="pd-card pd-earnings-card">
              <div className="pd-card__top">
                <span className="pd-section-code">
                  LIVE EARNINGS · 3 MIN REFRESH
                </span>
                <button
                  type="button"
                  className="pd-link"
                  onClick={() => void manualRefresh()}
                  disabled={busy}
                >
                  <Icon name="refresh" size={12} /> Refresh
                </button>
              </div>
              <div className="pd-earnings-head">
                <div>
                  <span>LAST 14 DAYS · YOUR SHARE</span>
                  <b className="mono">{signedMoney(dailyTotal, 2)}</b>
                </div>
                <div className="pd-refresh">
                  <span>NEXT REFRESH</span>
                  <b className="mono">{nextRefresh}</b>
                  <small>updated {relativeTo(lastRefresh, clock)}</small>
                </div>
              </div>
              {investment ? (
                <div
                  className="pd-daily"
                  aria-label="Daily earnings, last 14 days"
                >
                  {investment.daily.map((day) => (
                    <div
                      className="pd-daily__col"
                      key={day.date}
                      title={`${day.date} · ${signedMoney(day.gross, 2)} gross`}
                    >
                      <span
                        className="pd-daily__bar"
                        style={{
                          height: `${Math.max(6, (day.gross / dailyMax) * 100)}%`,
                        }}
                      />
                      <small>{day.date.slice(8, 10)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pd-empty">
                  No earnings attribution yet — this cycle has not produced a
                  distribution.
                </div>
              )}
              <div className="pd-card__foot">
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("earnings")}
                >
                  Breakdown table
                </button>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("statement")}
                >
                  <Icon name="download" size={14} /> Statement
                </button>
              </div>
            </article>
          </div>
        </section>

        {/* 03 — Performance */}
        {performance ? (
          <section className="pd-section" id="pd-performance">
            <SectionHead
              code="03 / POOL PERFORMANCE"
              title="Numbers only"
              hint="Pool-level results before the profit share. Every figure is attributed to this cycle's settlement batch."
              aside={
                <div className="pd-head-stats">
                  <span>
                    Curve ends{" "}
                    <b className="mono">{signedMoney(performance.totalPnl)}</b>
                  </span>
                  <button
                    type="button"
                    className="pd-btn"
                    onClick={() => open("performanceInfo")}
                  >
                    <Icon name="info" size={14} /> Method
                  </button>
                </div>
              }
            />
            <div className="pd-kpis">
              {[
                {
                  label: "TOTAL P&L",
                  value: signedMoney(performance.totalPnl),
                  hint: `${performance.trades} closed trades`,
                  tone: "win",
                },
                {
                  label: "WIN RATE",
                  value: `${performance.winRatePct.toFixed(1)}%`,
                  hint: `${performance.wins} wins / ${performance.trades} trades`,
                  tone: "win",
                },
                {
                  label: "TOTAL TRADES",
                  value: performance.trades.toLocaleString(),
                  hint: `${performance.openTrades} open now`,
                  tone: "",
                },
                {
                  label: "MAX DRAWDOWN",
                  value: `−${performance.maxDrawdownPct.toFixed(1)}%`,
                  hint: `occurred ${atDate(performance.maxDrawdownAt)}`,
                  tone: "loss",
                },
                {
                  label: "GUARDIAN TRIGGERS",
                  value: String(performance.guardianTriggers),
                  hint:
                    performance.guardianTriggers > 0
                      ? `recovered in ${performance.recoveredInLabel}`
                      : "no intervention needed",
                  tone: "",
                },
                {
                  label: "AVG TRADE DURATION",
                  value: durationLabel(performance.avgTradeDurationSec),
                  hint: "entry to settlement",
                  tone: "",
                },
              ].map((kpi, index) => (
                <article
                  className="pd-kpi"
                  key={kpi.label}
                  style={{ "--pd-delay": `${index * 60}ms` } as CSSProperties}
                >
                  <span>{kpi.label}</span>
                  <b className={`mono${kpi.tone ? ` is-${kpi.tone}` : ""}`}>
                    {kpi.value}
                  </b>
                  <small>{kpi.hint}</small>
                </article>
              ))}
            </div>

            <div className="pd-perf-grid">
              <article className="pd-card pd-curve-card">
                <div className="pd-card__top">
                  <span className="pd-section-code">CUMULATIVE POOL P&L</span>
                  <span className="pd-muted">
                    {performance.curve.length} observations · snapshot{" "}
                    {atDate(data.asOf)}
                  </span>
                </div>
                <EquityCurve
                  points={performance.curve}
                  positive={performance.totalPnl >= 0}
                />
                <div className="pd-curve-foot">
                  {performance.benchmarks.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <b className="mono">{item.value}</b>
                      <small>{item.hint}</small>
                    </div>
                  ))}
                </div>
              </article>

              <article className="pd-card pd-extremes">
                <div className="pd-card__top">
                  <span className="pd-section-code">BEST & WORST</span>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("trades")}
                  >
                    Full ledger ↗
                  </button>
                </div>
                <div className="pd-extreme is-best">
                  <span>BEST TRADE</span>
                  <b className="mono">{signedMoney(performance.best.pnl, 2)}</b>
                  <small>
                    {performance.best.symbol} · {performance.best.id} ·{" "}
                    {atDate(performance.best.at)}
                  </small>
                  <em className="mono">
                    your share {signedMoney(performance.best.share, 2)}
                  </em>
                </div>
                <div className="pd-extreme is-worst">
                  <span>WORST TRADE</span>
                  <b className="mono">
                    {signedMoney(performance.worst.pnl, 2)}
                  </b>
                  <small>
                    {performance.worst.symbol} · {performance.worst.id} ·{" "}
                    {atDate(performance.worst.at)}
                  </small>
                  <em className="mono">
                    your share {signedMoney(performance.worst.share, 2)}
                  </em>
                </div>
                <div className="pd-card__foot">
                  <button
                    type="button"
                    className="pd-btn"
                    onClick={() => open("trades")}
                  >
                    <Icon name="activity" size={14} /> Trade ledger
                  </button>
                  <button
                    type="button"
                    className="pd-btn"
                    onClick={() => open("performanceInfo")}
                  >
                    Definitions
                  </button>
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {/* 04 — Guardian */}
        <section className="pd-section" id="pd-guardian">
          <SectionHead
            code="04 / AI GUARDIAN"
            title="How the policy is holding"
            hint="The Guardian pauses or de-risks the pool when a loss streak or drawdown threshold is reached. It never changes the strategy mid-cycle."
            aside={
              <div className="pd-head-stats">
                <span>
                  Triggers this cycle{" "}
                  <b className="mono">{guardian.triggersTotal}</b>
                </span>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("guardianHistory")}
                >
                  <Icon name="shield" size={14} /> Full history
                </button>
              </div>
            }
          />
          <div className="pd-guardian-grid">
            <article className="pd-card pd-guardian-status">
              <div className="pd-guardian-status__head">
                <span
                  className={`pd-guardian-status__icon is-${guardian.status}`}
                >
                  <Icon name="shield" size={20} />
                </span>
                <div>
                  <b>
                    {guardian.status === "active"
                      ? "Active · all clear"
                      : guardian.status === "watch"
                        ? "Watch · stake reduced"
                        : "Standby until trading"}
                  </b>
                  <span>
                    Last check {atDateTime(guardian.lastCheckedAt)} ·{" "}
                    {relativeTo(guardian.lastCheckedAt, clock)}
                  </span>
                </div>
                <span
                  className={`pd-tag is-${guardian.status === "active" ? "trading" : "upcoming"}`}
                >
                  {guardian.status}
                </span>
              </div>
              <p>{guardian.note}</p>
              <div className="pd-gauge">
                <div className="pd-gauge__head">
                  <span>DRAWDOWN VS POLICY</span>
                  <span className="mono">
                    {guardian.drawdownPct}% / {guardian.drawdownLimitPct}%
                  </span>
                </div>
                <Progress
                  value={
                    (guardian.drawdownPct /
                      Math.max(guardian.drawdownLimitPct, 1)) *
                    100
                  }
                  tone={
                    guardian.drawdownPct > guardian.drawdownLimitPct * 0.7
                      ? "is-warn"
                      : "is-win"
                  }
                  label="Drawdown against policy limit"
                />
                <small>
                  {headroom}% of headroom before the policy pauses the pool.
                </small>
              </div>
              <dl className="pd-settings">
                <div>
                  <dt>MAX CONSECUTIVE LOSSES</dt>
                  <dd className="mono">{guardian.maxConsecutiveLosses}</dd>
                </div>
                <div>
                  <dt>DRAWDOWN LIMIT</dt>
                  <dd className="mono">{guardian.drawdownLimitPct}%</dd>
                </div>
                <div>
                  <dt>MARKET ROTATION</dt>
                  <dd>{guardian.rotation ? "ON" : "OFF"}</dd>
                </div>
                <div>
                  <dt>LOSS STREAK NOW</dt>
                  <dd className="mono">
                    {guardian.consecutiveLosses}/{guardian.maxConsecutiveLosses}
                  </dd>
                </div>
              </dl>
              <div className="pd-card__foot">
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("guardianPolicy")}
                >
                  Policy detail
                </button>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("risk")}
                >
                  <Icon name="alert" size={14} /> Risk disclosure
                </button>
              </div>
            </article>

            <article className="pd-card pd-triggers">
              <div className="pd-card__top">
                <span className="pd-section-code">RECENT EVENTS</span>
                <span className="pd-muted">
                  lifetime {guardian.triggersTotal} trigger
                  {guardian.triggersTotal === 1 ? "" : "s"}
                </span>
              </div>
              {guardian.events.length ? (
                <ol className="pd-trigger-list">
                  {guardian.events.slice(0, 4).map((event) => (
                    <li key={event.id}>
                      <span
                        className={`pd-trigger-dot is-${event.kind}`}
                        aria-hidden="true"
                      />
                      <div>
                        <b>{event.title}</b>
                        <span className="mono">
                          {atDateTime(event.at)} · {event.outcome}
                          {event.durationMin
                            ? ` · ${durationLabel(event.durationMin * 60)}`
                            : ""}
                        </span>
                        <p>{event.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="pd-empty">
                  No Guardian events recorded for this cycle.
                </div>
              )}
              <div className="pd-card__foot">
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("guardianHistory")}
                >
                  All events
                </button>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("guardianPolicy")}
                >
                  Thresholds
                </button>
              </div>
            </article>
          </div>
        </section>

        {/* 05 — Participants */}
        <section className="pd-section" id="pd-participants">
          <SectionHead
            code="05 / POOL PARTICIPANTS"
            title="Who is in this cycle"
            hint={participants.note}
            aside={
              <div className="pd-head-stats">
                <span>
                  Average{" "}
                  <b className="mono">{money(participants.avgInvestment)}</b>
                </span>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("participants")}
                >
                  <Icon name="users" size={14} /> All participants
                </button>
              </div>
            }
          />
          <div className="pd-participants-stats">
            <div>
              <span>PARTICIPANTS</span>
              <b className="mono">{participants.totalParticipants}</b>
            </div>
            <div>
              <span>SLOTS FILLED</span>
              <b className="mono">
                {participants.slotsFilled}/{overview.slotsTotal}
              </b>
            </div>
            <div>
              <span>COMMITTED</span>
              <b className="mono">{money(participants.committed)}</b>
            </div>
            <div>
              <span>AVERAGE</span>
              <b className="mono">{money(participants.avgInvestment)}</b>
            </div>
            <div>
              <span>YOUR RANK</span>
              <b className="mono">
                {participants.rows.find((row) => row.isYou)?.rank
                  ? `#${participants.rows.find((row) => row.isYou)?.rank}`
                  : "—"}
              </b>
            </div>
          </div>
          <div className="pd-participants-grid">
            <article className="pd-card pd-bands">
              <div className="pd-card__top">
                <span className="pd-section-code">ALLOCATION DISTRIBUTION</span>
                <span className="pd-muted">share of committed capital</span>
              </div>
              <DistributionBars rows={participants.bands} />
              <div className="pd-card__foot">
                <span className="pd-muted">
                  Bars use committed capital, not slot counts.
                </span>
                <button
                  type="button"
                  className="pd-link"
                  onClick={() => open("participants")}
                >
                  Detail ↗
                </button>
              </div>
            </article>

            <article className="pd-card pd-participants-table">
              <div className="pd-card__top">
                <span className="pd-section-code">
                  {participants.showRows
                    ? "TOP ALLOCATIONS"
                    : "INVESTOR DETAIL"}
                </span>
                <span className="pd-muted">
                  {participants.showRows
                    ? `${participants.rows.length} of ${participants.totalParticipants} shown`
                    : "publishes at trading start"}
                </span>
              </div>
              {participants.showRows ? (
                <div className="table-responsive">
                  <table className="table pd-table">
                    <thead>
                      {participantTable.getHeaderGroups().map((group) => (
                        <tr key={group.id}>
                          {group.headers.map((header) => (
                            <th key={header.id}>
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                disabled={!header.column.getCanSort()}
                              >
                                <participantTable.FlexRender header={header} />
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
                      {participantTable.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                          {row.getAllCells().map((cell) => (
                            <td key={cell.id}>
                              <participantTable.FlexRender cell={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="pd-empty">
                  Investor-level allocations publish once the pool enters
                  trading and payments are verified. Aggregate distribution is
                  final for the funding desk's booking ledger.
                </div>
              )}
              <div className="pd-card__foot">
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("participants")}
                >
                  Open participant view
                </button>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("fees")}
                >
                  Profit share
                </button>
              </div>
            </article>
          </div>
        </section>

        {/* 06 — Documents */}
        <section className="pd-section" id="pd-documents">
          <SectionHead
            code="06 / DOCUMENTS"
            title="Pool paperwork"
            hint="Every file is generated from this snapshot inside your browser. Certified copies, receipts and tax documents come from the backend."
            aside={
              <div className="pd-head-stats">
                <span>
                  {data.documents.length} file(s){" "}
                  <b className="mono">{overview.code}</b>
                </span>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("documents")}
                >
                  <Icon name="file" size={14} /> Document centre
                </button>
              </div>
            }
          />
          <div className="pd-docs">
            {data.documents.map((doc) => (
              <article className="pd-doc" key={doc.id}>
                <span
                  className={`pd-doc__icon is-${doc.format}`}
                  aria-hidden="true"
                >
                  {doc.format.toUpperCase()}
                </span>
                <div className="pd-doc__body">
                  <b>{doc.name}</b>
                  <span>
                    {doc.scope === "pool" ? "Pool-wide" : "Your position"} ·{" "}
                    {doc.sizeLabel} · updated {atDate(doc.updatedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => void downloadDocument(doc.id)}
                  disabled={busy}
                >
                  <Icon name="download" size={13} /> Download
                </button>
              </article>
            ))}
          </div>
          {data.reminders.length || data.payouts.length ? (
            <div className="pd-doc-notes">
              {data.payouts.length ? (
                <button
                  type="button"
                  className="pd-doc-note"
                  onClick={() => open("payoutRecord", data.payouts[0]?.id)}
                >
                  <span className="pd-section-code">PAYOUT DRAFTS</span>
                  <b className="mono">{data.payouts.length}</b>
                  <span className="pd-muted">
                    Last {money(data.payouts[0]?.amount ?? 0, 2)} via{" "}
                    {data.payouts[0]?.method === "usdt"
                      ? "USDT"
                      : "bank transfer"}{" "}
                    ·{" "}
                    {relativeTo(data.payouts[0]?.createdAt ?? data.asOf, clock)}
                  </span>
                </button>
              ) : null}
              {data.reminders.length ? (
                <button
                  type="button"
                  className="pd-doc-note"
                  onClick={() => open("reminder")}
                >
                  <span className="pd-section-code">QUEUED REMINDERS</span>
                  <b className="mono">{data.reminders.length}</b>
                  <span className="pd-muted">
                    {data.reminders
                      .map(
                        (item) =>
                          `${item.leadDays}d · ${item.channel === "email" ? "email" : "in-app"}`,
                      )
                      .join(" · ")}
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* 07 — Activity ledger */}
        <section className="pd-section" id="pd-activity">
          <SectionHead
            code="07 / POOL ACTIVITY"
            title="What changed, and where it came from"
            hint="Source events come from the pool snapshot. Local entries are the commands you applied in this workspace during the session."
            aside={
              <div className="pd-head-stats">
                <span>
                  {ledger.length} entr{ledger.length === 1 ? "y" : "ies"}
                </span>
                <button
                  type="button"
                  className={`pd-btn${ledgerOnlyLocal ? " is-on" : ""}`}
                  aria-pressed={ledgerOnlyLocal}
                  onClick={() => setLedgerOnlyLocal((prev) => !prev)}
                >
                  {ledgerOnlyLocal ? "Showing local only" : "Local only"}
                </button>
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => open("activity")}
                >
                  <Icon name="activity" size={14} /> Full log
                </button>
              </div>
            }
          />
          <ol className="pd-ledger">
            {ledger.slice(0, 7).map((entry) => (
              <li
                className={`is-${entry.scope === "Local workspace" ? "local" : "source"}`}
                key={entry.id}
              >
                <span className="pd-ledger__dot" aria-hidden="true" />
                <div className="pd-ledger__body">
                  <div className="pd-ledger__head">
                    <b>
                      {entry.title.replace(/^./, (char) => char.toUpperCase())}
                    </b>
                    <span className="pd-ledger__scope">
                      {entry.scope === "Local workspace" ? "LOCAL" : "SOURCE"}
                    </span>
                    <span className="mono pd-muted">
                      {atDateTime(entry.at)}
                    </span>
                  </div>
                  <p>{entry.detail}</p>
                </div>
              </li>
            ))}
            {ledger.length === 0 ? (
              <li className="pd-ledger__empty">
                Nothing recorded yet. Commands you apply in this workspace
                appear here immediately.
              </li>
            ) : null}
          </ol>
          <div className="pd-ledger-foot">
            <span className="pd-muted">
              Only the {ledgerOnlyLocal ? "local" : "source and local"} entries
              shown · {data.audit.length} local command(s) this session
            </span>
            <div>
              <button
                type="button"
                className="pd-link"
                onClick={() => open("activity")}
              >
                Open full activity log ↗
              </button>
              <button
                type="button"
                className="pd-link"
                onClick={() => open("help")}
              >
                What is source vs local?
              </button>
            </div>
          </div>
        </section>

        {/* 08 — Related + quick actions */}
        <section className="pd-section pd-related" id="pd-related">
          <SectionHead
            code="08 / CONTINUE"
            title="Related cycles and next steps"
            hint="Every action below opens a working workflow — nothing here is a placeholder."
            aside={
              <div className="pd-head-stats">
                <span>
                  Pool book{" "}
                  <b className="mono">{money(data.profile.committed)}</b>
                </span>
                <Link className="pd-btn" href="/investor/pools">
                  Browse all pools <Icon name="chevronRight" size={14} />
                </Link>
              </div>
            }
          />
          <div className="pd-related-grid">
            {data.related.map((pool) => (
              <Link
                className="pd-related-card"
                key={pool.id}
                href={`/investor/pools/${pool.id}`}
              >
                <div className="pd-related-card__top">
                  <span className="pd-code mono">{pool.code}</span>
                  <LifecycleTag lifecycle={pool.lifecycle} />
                </div>
                <b>{pool.name}</b>
                <span className="pd-muted">{pool.relation}</span>
                <div className="pd-related-card__foot">
                  <span className="mono">{money(pool.goal)} target</span>
                  <span className="mono text-win">
                    {percent(pool.expectedRoiPct)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="pd-quick">
            <button
              type="button"
              className="pd-quick-card"
              onClick={() => open("statement")}
            >
              <span className="pd-quick-icon">
                <Icon name="download" size={17} />
              </span>
              <span>
                <b>Cycle statement</b>
                <small>
                  Pool, daily earnings, trade ledger or participants · PDF, CSV,
                  JSON.
                </small>
              </span>
              <Icon name="arrowRight" size={15} />
            </button>
            <button
              type="button"
              className="pd-quick-card"
              onClick={() => open("projection")}
            >
              <span className="pd-quick-icon">
                <Icon name="chart" size={17} />
              </span>
              <span>
                <b>Project a return</b>
                <small>
                  Model another allocation against this pool's expected return.
                </small>
              </span>
              <Icon name="arrowRight" size={15} />
            </button>
            <button
              type="button"
              className="pd-quick-card"
              onClick={() => open("fees")}
            >
              <span className="pd-quick-icon">
                <Icon name="split" size={17} />
              </span>
              <span>
                <b>Fees & profit share</b>
                <small>
                  How the platform share, transfer fees and payouts are
                  calculated.
                </small>
              </span>
              <Icon name="arrowRight" size={15} />
            </button>
            <button
              type="button"
              className="pd-quick-card"
              onClick={() => open("support")}
            >
              <span className="pd-quick-icon">
                <Icon name="mail" size={17} />
              </span>
              <span>
                <b>Contact the desk</b>
                <small>
                  Draft a question about this pool — nothing is transmitted.
                </small>
              </span>
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
          <div className="pd-quick-links">
            <button
              type="button"
              className="pd-link"
              onClick={() => open("earnings")}
            >
              Earnings attribution
            </button>
            <button
              type="button"
              className="pd-link"
              onClick={() => open("alerts")}
            >
              Alert preferences
            </button>
            <Link className="pd-link" href="/investor/calculator">
              Return calculator ↗
            </Link>
            <Link className="pd-link" href="/investor/wallet">
              Wallet & payouts ↗
            </Link>
            <button
              type="button"
              className="pd-link"
              onClick={() => open("documents")}
            >
              Pool documents
            </button>
            <button
              type="button"
              className="pd-link"
              onClick={() => open("activity")}
            >
              Pool activity
            </button>
          </div>
        </section>

        <footer className="pd-page-foot">
          <span>
            LOCAL INVESTOR DEMO · {overview.code} · source snapshot{" "}
            {atDateTime(data.asOf)} · revision {data.revision}
          </span>
          <div>
            <button
              type="button"
              className="pd-link"
              onClick={() => open("help")}
            >
              Workspace boundaries
            </button>
            <button
              type="button"
              className="pd-link"
              onClick={() => open("support")}
            >
              Contact desk
            </button>
            <button
              type="button"
              className="pd-link"
              onClick={() => open("activity")}
            >
              Pool activity
            </button>
            <Link className="pd-link" href="/dashboard">
              Operator console ↗
            </Link>
          </div>
        </footer>
      </div>

      {drawer ? (
        <div
          className="op-drawer-backdrop pd-drawer-layer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <aside
            className="op-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Pool inspector"
          >
            <div className="op-drawer__head">
              <div>
                <span className="pd-section-code">I-3 / POOL INSPECTOR</span>
                <h2 className="op-drawer__title">{overview.name}</h2>
                <p className="pd-muted">
                  {overview.code} · {lifecycleLabel[overview.lifecycle]} ·{" "}
                  {overview.riskBand} risk
                </p>
              </div>
              <button
                type="button"
                className="desk-icon-btn"
                onClick={close}
                aria-label="Close pool inspector"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <div
              className="pd-drawer-tabs"
              role="tablist"
              aria-label="Inspector views"
            >
              {(["position", "trades", "guardian"] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  role="tab"
                  aria-selected={drawer === tab}
                  className={drawer === tab ? "is-active" : ""}
                  onClick={() => setDrawer(tab)}
                >
                  {tab === "position"
                    ? "Position"
                    : tab === "trades"
                      ? "Trades"
                      : "Guardian"}
                </button>
              ))}
            </div>
            <div className="op-drawer__body">
              {drawer === "position" ? (
                <>
                  <div className="pd-drawer-summary">
                    <div>
                      <span>COMMITTED</span>
                      <b className="mono">
                        {money(
                          investment?.investment ?? data.booking?.amount ?? 0,
                        )}
                      </b>
                    </div>
                    <div>
                      <span>SHARE</span>
                      <b className="mono">
                        {investment
                          ? plainPercent(investment.sharePct, 1)
                          : "—"}
                      </b>
                    </div>
                    <div>
                      <span>NET</span>
                      <b className="mono">
                        {investment
                          ? signedMoney(investment.netEarnings, 2)
                          : "—"}
                      </b>
                    </div>
                  </div>
                  <div className="pd-drawer-block">
                    <span className="pd-section-code">FUNDING</span>
                    <Progress value={fill} label="Funding progress" />
                    <div className="pd-funding__foot">
                      <span>{money(overview.raised)} raised</span>
                      <span>
                        {plainPercent(fill, 0)} of {money(overview.goal)}
                      </span>
                    </div>
                  </div>
                  <div className="pd-drawer-block">
                    <span className="pd-section-code">THIS CYCLE</span>
                    <div className="pd-kv-row">
                      <span>Slots</span>
                      <b className="mono">
                        {investment?.slots ?? data.booking?.slots ?? 0}
                      </b>
                    </div>
                    <div className="pd-kv-row">
                      <span>Tokens</span>
                      <b className="mono">
                        {investment
                          ? `${investment.tokens.toLocaleString()} ${investment.tokenSymbol}`
                          : "—"}
                      </b>
                    </div>
                    <div className="pd-kv-row">
                      <span>Trading ends</span>
                      <b className="mono">{atDate(overview.tradingEndsAt)}</b>
                    </div>
                    <div className="pd-kv-row">
                      <span>Profit share</span>
                      <b className="mono">
                        {overview.profitShareAt
                          ? atDate(overview.profitShareAt)
                          : "—"}
                      </b>
                    </div>
                  </div>
                  <div className="pd-drawer-actions">
                    <button
                      type="button"
                      className="pd-btn"
                      onClick={() => open("statement")}
                    >
                      Statement
                    </button>
                    <button
                      type="button"
                      className="pd-btn pd-btn--primary"
                      onClick={() => open("earnings")}
                    >
                      Earnings
                    </button>
                  </div>
                </>
              ) : drawer === "trades" ? (
                <>
                  <div className="pd-drawer-headline">
                    <span>{data.trades.length} recent trades</span>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("trades")}
                    >
                      Full ledger ↗
                    </button>
                  </div>
                  <div className="pd-drawer-list">
                    {data.trades.slice(0, 6).map((trade) => (
                      <button
                        type="button"
                        key={trade.id}
                        onClick={() => open("tradeDetail", trade.id)}
                      >
                        <div>
                          <b>
                            {trade.symbol} · {trade.contract}
                          </b>
                          <small>
                            {trade.id} · {atTime(trade.openedAt)} ·{" "}
                            {trade.result}
                          </small>
                        </div>
                        <span
                          className={`mono pd-trade-share ${trade.investorShare >= 0 ? "text-win" : "text-loss"}`}
                        >
                          {trade.result === "open"
                            ? "open"
                            : signedMoney(trade.investorShare, 2)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="pd-drawer-actions">
                    <button
                      type="button"
                      className="pd-btn"
                      onClick={() => open("trades")}
                    >
                      Open ledger
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="pd-drawer-headline">
                    <span>Policy · {guardian.status}</span>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("guardianHistory")}
                    >
                      History ↗
                    </button>
                  </div>
                  <div className="pd-drawer-block">
                    <div className="pd-gauge">
                      <div className="pd-gauge__head">
                        <span>DRAWDOWN</span>
                        <span className="mono">
                          {guardian.drawdownPct}% / {guardian.drawdownLimitPct}%
                        </span>
                      </div>
                      <Progress
                        value={
                          (guardian.drawdownPct /
                            Math.max(guardian.drawdownLimitPct, 1)) *
                          100
                        }
                        tone="is-win"
                        label="Drawdown against policy"
                      />
                    </div>
                    <p className="pd-muted">{guardian.note}</p>
                  </div>
                  <div className="pd-drawer-list">
                    {guardian.events.slice(0, 4).map((event) => (
                      <div className="pd-drawer-row" key={event.id}>
                        <div>
                          <b>{event.title}</b>
                          <small>
                            {atDate(event.at)} · {event.outcome}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pd-drawer-actions">
                    <button
                      type="button"
                      className="pd-btn"
                      onClick={() => open("risk")}
                    >
                      Risk disclosure
                    </button>
                    <button
                      type="button"
                      className="pd-btn"
                      onClick={() => open("guardianPolicy")}
                    >
                      Policy
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {modal ? (
        <div className="pd-modal-layer">
          <DeskModalShell
            code="I-3"
            eyebrow="INVESTOR WORKSPACE / LOCAL PREVIEW"
            title={
              modal.kind === "interest" && data.interest
                ? "Interest registered"
                : titles[modal.kind]
            }
            subtitle="Structured session state. Payments, slot confirmation, provider data and messaging require authenticated backend integration."
            size={modalSize[modal.kind] ?? "md"}
            onClose={close}
            steps={wizard ? [...steps] : undefined}
            currentStep={step}
            footer={modalFooter}
          >
            {error ? (
              <p className="pd-error" role="alert">
                {error}
              </p>
            ) : null}

            {wizard && modal.kind === "bookSlots" ? (
              step === 0 ? (
                <>
                  <div className="pd-kv-grid">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Slot price</span>
                      <b className="mono">{money(overview.slotPrice)}</b>
                    </div>
                    <div>
                      <span>Available to you</span>
                      <b className="mono">{bookableNow} slot(s)</b>
                    </div>
                    <div>
                      <span>Booking closes</span>
                      <b className="mono">
                        {atDateTime(overview.bookingClosesAt)}
                      </b>
                    </div>
                  </div>
                  <label className="pd-field">
                    Slots to reserve
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      max={Math.max(1, bookableNow)}
                      value={bookSlots}
                      aria-label="Slots to reserve"
                      onChange={(e) =>
                        setBookSlots(
                          Math.max(
                            1,
                            Math.min(bookableNow || 1, Number(e.target.value)),
                          ),
                        )
                      }
                    />
                    <small>
                      {money(overview.slotPrice)} per slot ·{" "}
                      {money(bookSlots * overview.slotPrice)} total
                    </small>
                  </label>
                  <div className="pd-stepper">
                    {[1, 2, 3, 5].map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={`pd-btn${bookSlots === value ? " is-on" : ""}`}
                        disabled={value > bookableNow}
                        onClick={() =>
                          setBookSlots(Math.min(value, bookableNow))
                        }
                      >
                        {value} slot{value === 1 ? "" : "s"}
                      </button>
                    ))}
                  </div>
                  <div className="pd-inline-note is-warn">
                    <Icon name="alert" size={13} /> Payment verification is
                    required before the funding desk confirms the slot.
                    Unverified reservations may be released when the window
                    closes.
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="pd-breakdown">
                    <div>
                      <span>SLOTS</span>
                      <b className="mono">{bookSlots}</b>
                      <small>
                        {overview.code} at {money(overview.slotPrice)}
                      </small>
                    </div>
                    <div>
                      <span>ALLOCATION</span>
                      <b className="mono">
                        {money(bookSlots * overview.slotPrice)}
                      </b>
                      <small>nothing captured</small>
                    </div>
                    <div>
                      <span>POSITION AFTER</span>
                      <b className="mono">
                        {money(
                          (data.booking?.amount ?? 0) +
                            bookSlots * overview.slotPrice,
                        )}
                      </b>
                      <small>pending verification</small>
                    </div>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Current booking</span>
                      <b className="mono">
                        {data.booking
                          ? `${data.booking.slots} slot(s) · ${money(data.booking.amount)}`
                          : "no booking yet"}
                      </b>
                    </div>
                    <div>
                      <span>Booking closes</span>
                      <b className="mono">
                        {atDateTime(overview.bookingClosesAt)}
                      </b>
                    </div>
                    <div>
                      <span>Payment state after</span>
                      <b>pending verification</b>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="pd-review-final">
                    <Icon name="info" size={16} />
                    <p>
                      This reserves {bookSlots} slot(s) in the local workspace
                      only. No payment is captured, no capacity is reserved with
                      the provider, and the funding desk is not notified of this
                      preview.
                    </p>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Allocation previewed</span>
                      <b className="mono">
                        {money(bookSlots * overview.slotPrice)}
                      </b>
                    </div>
                    <div>
                      <span>Slots previewed</span>
                      <b className="mono">{bookSlots}</b>
                    </div>
                    <div>
                      <span>Available after</span>
                      <b className="mono">
                        {Math.max(0, bookableNow - bookSlots)} slot(s)
                      </b>
                    </div>
                  </div>
                </>
              )
            ) : null}

            {wizard && modal.kind === "payout" ? (
              step === 0 ? (
                <>
                  <div className="pd-kv-grid">
                    <div>
                      <span>Net earnings</span>
                      <b className="mono">
                        {signedMoney(investment?.netEarnings ?? 0, 2)}
                      </b>
                    </div>
                    <div>
                      <span>Already paid</span>
                      <b className="mono">
                        {money(investment?.paidOut ?? 0, 2)}
                      </b>
                    </div>
                    <div>
                      <span>Drafted</span>
                      <b className="mono">
                        {money(investment?.pendingPayout ?? 0, 2)}
                      </b>
                    </div>
                    <div>
                      <span>Available</span>
                      <b className="mono">{money(availablePayout, 2)}</b>
                    </div>
                  </div>
                  <label className="pd-field">
                    Amount / USD
                    <input
                      type="number"
                      className="form-control"
                      min={100}
                      max={availablePayout}
                      value={payoutAmount}
                      aria-label="Payout amount"
                      onChange={(e) => setPayoutAmount(Number(e.target.value))}
                    />
                    <small>
                      Minimum $100 · cannot exceed the settled net earnings.
                    </small>
                  </label>
                  <div
                    className="pd-radio-row"
                    role="radiogroup"
                    aria-label="Payout method"
                  >
                    {(
                      [
                        {
                          key: "bank",
                          label: "Bank transfer",
                          hint: "$1.50 fee · 1–2 business days",
                        },
                        {
                          key: "usdt",
                          label: "USDT",
                          hint: "network fee at the provider",
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        type="button"
                        key={option.key}
                        role="radio"
                        aria-checked={payoutMethod === option.key}
                        className={`pd-radio${payoutMethod === option.key ? " is-on" : ""}`}
                        onClick={() => setPayoutMethod(option.key)}
                      >
                        <b>{option.label}</b>
                        <small>{option.hint}</small>
                      </button>
                    ))}
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="pd-breakdown">
                    <div>
                      <span>REQUEST</span>
                      <b className="mono">{money(payoutAmount, 2)}</b>
                      <small>
                        {payoutMethod === "bank" ? "bank transfer" : "USDT"}
                      </small>
                    </div>
                    <div>
                      <span>FEE</span>
                      <b className="mono">
                        {payoutMethod === "bank" ? "$1.50" : "network"}
                      </b>
                      <small>deducted at processing</small>
                    </div>
                    <div>
                      <span>REMAINING</span>
                      <b className="mono">
                        {money(Math.max(0, availablePayout - payoutAmount), 2)}
                      </b>
                      <small>stays in the pool</small>
                    </div>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Source</span>
                      <b>
                        net earnings after the {investment?.platformCutPct ?? 0}
                        % platform share
                      </b>
                    </div>
                    <div>
                      <span>Profit share date</span>
                      <b className="mono">
                        {overview.profitShareAt
                          ? atDate(overview.profitShareAt)
                          : "—"}
                      </b>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="pd-review-final">
                    <Icon name="info" size={16} />
                    <p>
                      This drafts a {money(payoutAmount, 2)} payout against{" "}
                      {overview.code}. Funds are not moved, no bank or wallet
                      instruction is created and the balance is unchanged until
                      a backend settlement confirms it.
                    </p>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Draft amount</span>
                      <b className="mono">{money(payoutAmount, 2)}</b>
                    </div>
                    <div>
                      <span>Method</span>
                      <b>
                        {payoutMethod === "bank" ? "Bank transfer" : "USDT"}
                      </b>
                    </div>
                    <div>
                      <span>Status after</span>
                      <b>draft · awaiting settlement integration</b>
                    </div>
                  </div>
                </>
              )
            ) : null}

            {wizard && modal.kind === "statement" ? (
              step === 0 ? (
                <>
                  <label className="pd-field">
                    Scope
                    <select
                      className="form-select"
                      aria-label="Export scope"
                      value={statementScope}
                      onChange={(e) =>
                        setStatementScope(
                          e.target.value as typeof statementScope,
                        )
                      }
                    >
                      <option value="pool-statement">
                        Pool statement · facts, allocation, earnings
                      </option>
                      <option value="daily-earnings">
                        Daily earnings · last 14 days
                      </option>
                      <option value="trade-ledger">
                        Trade ledger · pool trades
                      </option>
                      <option value="participants">
                        Participants · anonymised allocations
                      </option>
                    </select>
                  </label>
                  <label className="pd-field">
                    Format
                    <select
                      className="form-select"
                      aria-label="Export format"
                      value={statementFormat}
                      onChange={(e) =>
                        setStatementFormat(
                          e.target.value as typeof statementFormat,
                        )
                      }
                    >
                      <option value="pdf">PDF · readable statement</option>
                      <option value="csv">CSV · spreadsheet</option>
                      <option value="json">
                        JSON · structured integration
                      </option>
                    </select>
                  </label>
                  <div className="pd-field-grid">
                    <div>
                      <span>RECORDS</span>
                      <b className="mono">{statementRecords.length}</b>
                    </div>
                    <div>
                      <span>SOURCE AS OF</span>
                      <b className="mono">{atDateTime(data.asOf)}</b>
                    </div>
                    <div>
                      <span>POOL</span>
                      <b className="mono">{overview.code}</b>
                    </div>
                    <div>
                      <span>INVESTOR</span>
                      <b>{data.profile.displayName}</b>
                    </div>
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="pd-breakdown">
                    <div>
                      <span>SCOPE</span>
                      <b>{statementScope.replaceAll("-", " ")}</b>
                      <small>{statementRecords.length} record(s)</small>
                    </div>
                    <div>
                      <span>FORMAT</span>
                      <b>{statementFormat.toUpperCase()}</b>
                      <small>generated in-browser</small>
                    </div>
                    <div>
                      <span>FILENAME</span>
                      <b className="mono pd-filename">
                        {overview.code}-{statementScope}-{isoDay(data.asOf)}.
                        {statementFormat}
                      </b>
                      <small>download starts on confirm</small>
                    </div>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Includes</span>
                      <b>
                        {statementScope === "pool-statement"
                          ? "pool facts, your allocation, earnings attribution"
                          : statementScope === "daily-earnings"
                            ? "14 daily rows with gross and net attribution"
                            : statementScope === "trade-ledger"
                              ? "pool trades with result and investor share"
                              : "anonymised participant allocations"}
                      </b>
                    </div>
                    <div>
                      <span>Excludes</span>
                      <b>certification, tax documents, provider receipts</b>
                    </div>
                  </div>
                </>
              ) : (
                <div className="pd-review-final">
                  <Icon name="info" size={16} />
                  <p>
                    The file is generated in your browser from this snapshot. It
                    is a review copy — not a certified statement, tax document
                    or provider receipt.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "reminder" ? (
              step === 0 ? (
                <>
                  <label className="pd-field">
                    Lead time
                    <select
                      className="form-select"
                      aria-label="Reminder lead time"
                      value={remindLead}
                      onChange={(e) =>
                        setRemindLead(Number(e.target.value) as 1 | 2 | 3 | 7)
                      }
                    >
                      <option value={1}>1 day before</option>
                      <option value={2}>2 days before</option>
                      <option value={3}>3 days before</option>
                      <option value={7}>7 days before</option>
                    </select>
                  </label>
                  <label className="pd-field">
                    Channel
                    <select
                      className="form-select"
                      aria-label="Reminder channel"
                      value={remindChannel}
                      onChange={(e) =>
                        setRemindChannel(e.target.value as "email" | "in_app")
                      }
                    >
                      <option value="email">Email</option>
                      <option value="in_app">In-app notification</option>
                    </select>
                  </label>
                  <div className="pd-inline-note">
                    <Icon name="info" size={13} /> Reminders are stored in the
                    local workspace. No email or push is delivered until the
                    notification provider is connected.
                  </div>
                </>
              ) : (
                <>
                  <div className="pd-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Target date</span>
                      <b className="mono">
                        {atDateTime(
                          overview.lifecycle === "upcoming"
                            ? overview.bookingOpensAt
                            : overview.bookingClosesAt,
                        )}
                      </b>
                    </div>
                    <div>
                      <span>Lead time</span>
                      <b>{remindLead} day(s) before</b>
                    </div>
                    <div>
                      <span>Channel</span>
                      <b>{remindChannel === "email" ? "Email" : "In-app"}</b>
                    </div>
                  </div>
                  {step === 2 ? (
                    <div className="pd-review-final">
                      <Icon name="info" size={16} />
                      <p>
                        This queues a local reminder only. Nothing is scheduled
                        with an email, SMS or push provider and no message is
                        sent.
                      </p>
                    </div>
                  ) : null}
                </>
              )
            ) : null}

            {wizard && modal.kind === "alerts" ? (
              step === 0 ? (
                <>
                  <div className="pd-toggle-row">
                    <label className="pd-check">
                      <input
                        type="checkbox"
                        checked={alerts.email}
                        aria-label="Email alerts"
                        onChange={(e) =>
                          setAlerts({ ...alerts, email: e.target.checked })
                        }
                      />
                      Email alerts
                    </label>
                    <label className="pd-check">
                      <input
                        type="checkbox"
                        checked={alerts.inApp}
                        aria-label="In-app alerts"
                        onChange={(e) =>
                          setAlerts({ ...alerts, inApp: e.target.checked })
                        }
                      />
                      In-app alerts
                    </label>
                  </div>
                  <label className="pd-field">
                    Ending-soon window
                    <select
                      className="form-select"
                      aria-label="Ending soon window"
                      value={alerts.hours}
                      onChange={(e) =>
                        setAlerts({
                          ...alerts,
                          hours: Number(e.target.value) as 24 | 48 | 72,
                        })
                      }
                    >
                      <option value={24}>24 hours before close</option>
                      <option value={48}>48 hours before close</option>
                      <option value={72}>72 hours before close</option>
                    </select>
                    <small>
                      Used for booking-window and trading-end warnings.
                    </small>
                  </label>
                </>
              ) : (
                <div className="pd-review">
                  <div>
                    <span>Email</span>
                    <b>{alerts.email ? "enabled" : "off"}</b>
                  </div>
                  <div>
                    <span>In-app</span>
                    <b>{alerts.inApp ? "enabled" : "off"}</b>
                  </div>
                  <div>
                    <span>Ending-soon window</span>
                    <b>{alerts.hours} hours</b>
                  </div>
                  <div>
                    <span>Applies to</span>
                    <b>{overview.code} only</b>
                  </div>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "projection" ? (
              step === 0 ? (
                <>
                  <div className="pd-form-grid">
                    <label className="pd-field">
                      Principal / USD
                      <input
                        type="number"
                        className="form-control"
                        min={500}
                        max={100000}
                        value={scenario.principal}
                        aria-label="Projection principal"
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            principal: Number(e.target.value),
                          })
                        }
                      />
                      <small>Between $500 and $100,000.</small>
                    </label>
                    <label className="pd-field">
                      Return / %
                      <input
                        type="number"
                        className="form-control"
                        min={1}
                        max={50}
                        step={0.5}
                        value={scenario.roiPct}
                        aria-label="Projection return"
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            roiPct: Number(e.target.value),
                          })
                        }
                      />
                      <small>
                        Pool expectation is{" "}
                        {percent(data.projection?.roiPct ?? 0)}.
                      </small>
                    </label>
                    <label className="pd-field">
                      Duration / days
                      <input
                        type="number"
                        className="form-control"
                        min={1}
                        max={365}
                        value={scenario.days}
                        aria-label="Projection duration"
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            days: Number(e.target.value),
                          })
                        }
                      />
                      <small>
                        This cycle runs {data.projection?.days ?? "—"} days.
                      </small>
                    </label>
                  </div>
                  <div className="pd-inline-note">
                    <Icon name="info" size={13} /> Projection maths only. It
                    ignores fees, drawdown, early termination and variable
                    performance.
                  </div>
                </>
              ) : (
                <>
                  <div className="pd-breakdown">
                    <div>
                      <span>GROSS PROJECTION</span>
                      <b className="mono">
                        {signedMoney(
                          (scenario.principal * scenario.roiPct) / 100,
                          2,
                        )}
                      </b>
                      <small>before platform share</small>
                    </div>
                    <div>
                      <span>NET AFTER 20%</span>
                      <b className="mono">
                        {signedMoney(
                          ((scenario.principal * scenario.roiPct) / 100) * 0.8,
                          2,
                        )}
                      </b>
                      <small>indicative</small>
                    </div>
                    <div>
                      <span>ROI ON CAPITAL</span>
                      <b className="mono">{percent(scenario.roiPct)}</b>
                      <small>over {scenario.days} days</small>
                    </div>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Principal</span>
                      <b className="mono">{money(scenario.principal)}</b>
                    </div>
                    <div>
                      <span>Pool reference</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Assumption</span>
                      <b>constant return, no drawdown, full term</b>
                    </div>
                  </div>
                </>
              )
            ) : null}

            {wizard && modal.kind === "risk" ? (
              step === 0 ? (
                <>
                  <div className="pd-kv-grid">
                    <div>
                      <span>Risk band</span>
                      <b>{overview.riskBand}</b>
                    </div>
                    <div>
                      <span>Drawdown limit</span>
                      <b className="mono">{guardian.drawdownLimitPct}%</b>
                    </div>
                    <div>
                      <span>Loss-streak pause</span>
                      <b className="mono">
                        {guardian.maxConsecutiveLosses} losses
                      </b>
                    </div>
                    <div>
                      <span>Headroom now</span>
                      <b className="mono">{headroom}%</b>
                    </div>
                  </div>
                  <p className="pd-note">
                    Pooled trading can lose capital. Slot capital is committed
                    for the trading window and is not withdrawable mid-cycle;
                    the Guardian reduces exposure, it does not guarantee a
                    return.
                  </p>
                </>
              ) : (
                <>
                  <div className="pd-review">
                    <div>
                      <span>Worst observed drawdown</span>
                      <b className="mono">
                        {performance ? `−${performance.maxDrawdownPct}%` : "—"}
                      </b>
                    </div>
                    <div>
                      <span>Policy pause triggers</span>
                      <b className="mono">{guardian.triggersTotal}</b>
                    </div>
                    <div>
                      <span>Expected return</span>
                      <b className="mono">
                        {percent(data.projection?.roiPct ?? 0)}
                      </b>
                    </div>
                    <div>
                      <span>Capital at risk</span>
                      <b className="mono">
                        {money(
                          investment?.investment ?? data.booking?.amount ?? 0,
                        )}
                      </b>
                    </div>
                  </div>
                  <div className="pd-inline-note is-warn">
                    <Icon name="alert" size={13} /> Expected return is not a
                    promise. Returns depend on market conditions and the
                    Guardian can close a cycle early to protect capital.
                  </div>
                </>
              )
            ) : null}

            {wizard && modal.kind === "support" ? (
              step === 0 ? (
                <>
                  <label className="pd-field">
                    Topic
                    <select
                      className="form-select"
                      aria-label="Support topic"
                      value={supportTopic}
                      onChange={(e) =>
                        setSupportTopic(e.target.value as typeof supportTopic)
                      }
                    >
                      <option value="pool">This pool</option>
                      <option value="payment">Payment verification</option>
                      <option value="payout">Payouts</option>
                      <option value="kyc">KYC</option>
                      <option value="other">Something else</option>
                    </select>
                  </label>
                  <label className="pd-field">
                    Message
                    <textarea
                      className="form-control"
                      rows={5}
                      value={supportMessage}
                      aria-label="Support message"
                      placeholder={`Include the pool code (${overview.code}) and what you need from the funding desk.`}
                      onChange={(e) => setSupportMessage(e.target.value)}
                    />
                    <small>
                      {supportMessage.trim().length}/1000 · minimum 12
                      characters.
                    </small>
                  </label>
                </>
              ) : (
                <>
                  <div className="pd-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Topic</span>
                      <b>{supportTopic}</b>
                    </div>
                    <div>
                      <span>Message</span>
                      <b>{supportMessage.trim()}</b>
                    </div>
                  </div>
                  <div className="pd-inline-note">
                    <Icon name="info" size={13} /> This saves a draft only. No
                    email or ticket is created until the support integration is
                    connected.
                  </div>
                </>
              )
            ) : null}

            {modal.kind === "overviewInfo" ? (
              <>
                <div className="pd-kv-grid">
                  <div>
                    <span>Snapshot</span>
                    <b className="mono">{atDateTime(data.asOf)}</b>
                  </div>
                  <div>
                    <span>Revision</span>
                    <b className="mono">r{data.revision}</b>
                  </div>
                  <div>
                    <span>Lifecycle</span>
                    <b>{lifecycleLabel[overview.lifecycle]}</b>
                  </div>
                  <div>
                    <span>Settlement batch</span>
                    <b className="mono">{overview.settlementBatch}</b>
                  </div>
                </div>
                <p className="pd-note">{overview.thesis}</p>
                <ul className="pd-list">
                  <li>
                    <b>Raised</b> counts verified and pending bookings against
                    the target capital, excluding released reservations.
                  </li>
                  <li>
                    <b>Slots</b> are the tradable units:{" "}
                    {money(overview.slotPrice)} each, {overview.slotsFilled} of{" "}
                    {overview.slotsTotal} taken.
                  </li>
                  <li>
                    <b>Profit share</b> is {overview.profitSharePct}% of pool
                    profit, then the {investment?.platformCutPct ?? 20}%
                    platform share is deducted from your gross attribution.
                  </li>
                  <li>
                    <b>Settlement</b> nets payouts into{" "}
                    {overview.settlementBatch} before the profit-share date.
                  </li>
                </ul>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("performanceInfo")}
                  >
                    Performance method ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("fees")}
                  >
                    Fee structure ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("risk")}
                  >
                    Risk profile ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "schedule" ? (
              <>
                <ol className="pd-timeline">
                  {data.schedule.map((step) => (
                    <li className={`is-${step.state}`} key={step.id}>
                      <span className="pd-timeline__dot" aria-hidden="true" />
                      <div>
                        <div className="pd-timeline__head">
                          <b>{step.label}</b>
                          <span
                            className={`pd-tag is-${step.state === "done" ? "completed" : step.state === "current" ? "trading" : "upcoming"}`}
                          >
                            {step.state}
                          </span>
                        </div>
                        <span className="mono pd-muted">
                          {atDateTime(step.at)}
                        </span>
                        <p>{step.note}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="pd-inline-note">
                  <Icon name="info" size={13} /> Dates come from the pool
                  snapshot. Trading can close early if the Guardian pauses the
                  cycle.
                </div>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("reminder")}
                  >
                    Remind me before the window ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("alerts")}
                  >
                    Alert preferences ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "earnings" ? (
              investment ? (
                <>
                  <div className="pd-breakdown">
                    <div>
                      <span>GROSS</span>
                      <b className="mono text-win">
                        {signedMoney(investment.grossEarnings, 2)}
                      </b>
                      <small>
                        pool profit × {plainPercent(investment.sharePct, 1)}
                      </small>
                    </div>
                    <div>
                      <span>PLATFORM {investment.platformCutPct}%</span>
                      <b className="mono text-loss">
                        −{money(investment.platformCut, 2)}
                      </b>
                      <small>deducted before payout</small>
                    </div>
                    <div>
                      <span>NET</span>
                      <b className="mono">
                        {signedMoney(investment.netEarnings, 2)}
                      </b>
                      <small>on {money(investment.investment)}</small>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table pd-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Gross</th>
                          <th>Share {plainPercent(investment.sharePct, 1)}</th>
                          <th>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investment.daily.map((day) => (
                          <tr key={day.date}>
                            <td className="mono">{day.date}</td>
                            <td className="mono">
                              {signedMoney(day.gross, 2)}
                            </td>
                            <td className="mono">
                              {signedMoney(
                                day.gross * (investment.sharePct / 100),
                                2,
                              )}
                            </td>
                            <td
                              className={`mono ${day.net >= 0 ? "text-win" : "text-loss"}`}
                            >
                              {signedMoney(day.net, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th>14 days</th>
                          <th className="mono">{signedMoney(dailyTotal, 2)}</th>
                          <th className="mono">
                            {signedMoney(
                              dailyTotal * (investment.sharePct / 100),
                              2,
                            )}
                          </th>
                          <th className="mono">
                            {signedMoney(investment.netEarnings, 2)}
                          </th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="pd-modal-links">
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("statement")}
                    >
                      Export earnings ↗
                    </button>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("fees")}
                    >
                      How the share works ↗
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="pd-empty">
                    No earnings attribution for this pool yet. Attribution
                    starts once trading begins and the first settlement batch
                    closes.
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Expected return</span>
                      <b className="mono">
                        {percent(data.projection?.roiPct ?? 0)}
                      </b>
                    </div>
                    <div>
                      <span>Minimum slot</span>
                      <b className="mono">{money(overview.slotPrice)}</b>
                    </div>
                    <div>
                      <span>Projected at minimum</span>
                      <b className="mono">
                        {signedMoney(data.projection?.projectedProfit ?? 0, 2)}
                      </b>
                    </div>
                  </div>
                  <div className="pd-modal-links">
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("projection")}
                    >
                      Project a return ↗
                    </button>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("fees")}
                    >
                      Fees & profit share ↗
                    </button>
                  </div>
                </>
              )
            ) : null}

            {modal.kind === "performanceInfo" ? (
              performance ? (
                <>
                  <div className="pd-review">
                    <div>
                      <span>Total P&amp;L</span>
                      <b className="mono">
                        {signedMoney(performance.totalPnl)}
                      </b>
                    </div>
                    <div>
                      <span>Closed trades</span>
                      <b className="mono">
                        {performance.trades} · {performance.openTrades} open
                      </b>
                    </div>
                    <div>
                      <span>Win rate</span>
                      <b className="mono">
                        {performance.winRatePct}% · {performance.wins}/
                        {performance.trades}
                      </b>
                    </div>
                    <div>
                      <span>Max drawdown</span>
                      <b className="mono">−{performance.maxDrawdownPct}%</b>
                    </div>
                  </div>
                  <ul className="pd-list">
                    <li>
                      <b>Total P&amp;L</b> is the sum of closed trade results in
                      this cycle, before the profit share.
                    </li>
                    <li>
                      <b>Win rate</b> counts winning closed trades only. Open
                      trades are excluded from both counts.
                    </li>
                    <li>
                      <b>Drawdown</b> is measured from the cycle's running peak
                      equity, not from the initial capital.
                    </li>
                    <li>
                      <b>Guardian triggers</b> count policy pauses, stake
                      reductions and market rotations.
                    </li>
                  </ul>
                  <div className="pd-curve-mini">
                    <EquityCurve
                      points={performance.curve}
                      positive={performance.totalPnl >= 0}
                    />
                  </div>
                  <div className="pd-modal-links">
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("trades")}
                    >
                      Trade ledger ↗
                    </button>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("guardianPolicy")}
                    >
                      Guardian policy ↗
                    </button>
                  </div>
                </>
              ) : (
                <div className="pd-empty">
                  This cycle has not traded yet — performance metrics start from
                  the first closed trade.
                </div>
              )
            ) : null}

            {modal.kind === "trades" ? (
              <>
                <div
                  className="pd-filter-row"
                  role="group"
                  aria-label="Trade filter"
                >
                  {(
                    [
                      { key: "all", label: `All ${data.trades.length}` },
                      { key: "won", label: "Won" },
                      { key: "lost", label: "Lost" },
                      { key: "open", label: "Open" },
                    ] as const
                  ).map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      className={`pd-chip${tradeFilter === item.key ? " is-on" : ""}`}
                      aria-pressed={tradeFilter === item.key}
                      onClick={() => setTradeFilter(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {trades.length ? (
                  <div className="pd-trade-list">
                    {trades.map((trade) => (
                      <button
                        type="button"
                        key={trade.id}
                        className="pd-trade-row"
                        onClick={() => open("tradeDetail", trade.id)}
                      >
                        <span
                          className={`pd-trade-dot is-${trade.result}`}
                          aria-hidden="true"
                        />
                        <div>
                          <b>
                            {trade.symbol} · {trade.contract}
                          </b>
                          <small>
                            {trade.id} · stake ${trade.stake.toLocaleString()} ·{" "}
                            {atDateTime(trade.closedAt ?? trade.openedAt)}
                          </small>
                        </div>
                        <span className="mono pd-trade-pnl">
                          {trade.poolPnl === null
                            ? "—"
                            : signedMoney(trade.poolPnl, 2)}
                        </span>
                        <span
                          className={`mono pd-trade-share ${trade.investorShare >= 0 ? "text-win" : "text-loss"}`}
                        >
                          {trade.result === "open"
                            ? "open"
                            : signedMoney(trade.investorShare, 2)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pd-empty">No trades match this filter.</div>
                )}
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("statement")}
                  >
                    Export trade ledger ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("performanceInfo")}
                  >
                    Method ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "tradeDetail" ? (
              modalTrade ? (
                <>
                  <div className="pd-breakdown">
                    <div>
                      <span>{modalTrade.result.toUpperCase()}</span>
                      <b
                        className={`mono ${(modalTrade.poolPnl ?? 0) >= 0 ? "text-win" : "text-loss"}`}
                      >
                        {modalTrade.poolPnl === null
                          ? "—"
                          : signedMoney(modalTrade.poolPnl, 2)}
                      </b>
                      <small>pool result</small>
                    </div>
                    <div>
                      <span>YOUR SHARE</span>
                      <b
                        className={`mono ${modalTrade.investorShare >= 0 ? "text-win" : "text-loss"}`}
                      >
                        {signedMoney(modalTrade.investorShare, 2)}
                      </b>
                      <small>
                        {modalTrade.poolPnl
                          ? plainPercent(
                              (modalTrade.investorShare / modalTrade.poolPnl) *
                                100,
                              2,
                            )
                          : "attributed on close"}{" "}
                        of the pool result
                      </small>
                    </div>
                    <div>
                      <span>HOLD</span>
                      <b className="mono">
                        {modalTrade.durationSec === null
                          ? "running"
                          : durationLabel(modalTrade.durationSec)}
                      </b>
                      <small>
                        {modalTrade.result === "open"
                          ? "open position"
                          : "settled"}
                      </small>
                    </div>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Trade</span>
                      <b className="mono">{modalTrade.id}</b>
                    </div>
                    <div>
                      <span>Instrument</span>
                      <b>
                        {modalTrade.symbol} · {modalTrade.contract}
                      </b>
                    </div>
                    <div>
                      <span>Stake</span>
                      <b className="mono">
                        ${modalTrade.stake.toLocaleString()}
                      </b>
                    </div>
                    <div>
                      <span>Opened</span>
                      <b className="mono">{atDateTime(modalTrade.openedAt)}</b>
                    </div>
                    <div>
                      <span>Closed</span>
                      <b className="mono">
                        {modalTrade.closedAt
                          ? atDateTime(modalTrade.closedAt)
                          : "still open"}
                      </b>
                    </div>
                    <div>
                      <span>Settlement batch</span>
                      <b className="mono">{overview.settlementBatch}</b>
                    </div>
                  </div>
                  <p className="pd-note">
                    Stake is the pool capital committed to this position.
                    Results are attributed to investors pro-rata by capital
                    share (
                    {investment ? plainPercent(investment.sharePct, 1) : "0%"}{" "}
                    for you), net of the {investment?.platformCutPct ?? 20}%
                    platform share.
                  </p>
                  <div className="pd-inline-note">
                    <Icon name="info" size={13} /> Trade records are read-only
                    in the investor workspace. Execution detail belongs to the
                    operator console.
                  </div>
                  <div className="pd-modal-links">
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("trades")}
                    >
                      Back to ledger ↗
                    </button>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("performanceInfo")}
                    >
                      How results are measured ↗
                    </button>
                  </div>
                </>
              ) : (
                <div className="pd-empty">
                  This trade is no longer in the snapshot.
                </div>
              )
            ) : null}

            {modal.kind === "guardianHistory" ? (
              <>
                <div className="pd-kv-grid">
                  <div>
                    <span>Triggers this cycle</span>
                    <b className="mono">{guardian.triggersTotal}</b>
                  </div>
                  <div>
                    <span>Recovery</span>
                    <b className="mono">{guardian.recoveredLabel}</b>
                  </div>
                  <div>
                    <span>Status</span>
                    <b>{guardian.status}</b>
                  </div>
                  <div>
                    <span>Last check</span>
                    <b className="mono">
                      {relativeTo(guardian.lastCheckedAt, clock)}
                    </b>
                  </div>
                </div>
                <ol className="pd-timeline">
                  {guardian.events.map((event) => (
                    <li
                      className={`is-${event.kind === "trigger" ? "current" : "done"}`}
                      key={event.id}
                    >
                      <span className="pd-timeline__dot" aria-hidden="true" />
                      <div>
                        <div className="pd-timeline__head">
                          <b>{event.title}</b>
                          <span className="pd-tag is-upcoming">
                            {event.kind}
                          </span>
                        </div>
                        <span className="mono pd-muted">
                          {atDateTime(event.at)} · {event.outcome}
                          {event.durationMin
                            ? ` · ${durationLabel(event.durationMin * 60)}`
                            : ""}
                        </span>
                        <p>{event.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="pd-inline-note">
                  <Icon name="info" size={13} /> Every trigger, resume and check
                  is logged by the guardian service. Thresholds are set by the
                  desk, not by investors.
                </div>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("guardianPolicy")}
                  >
                    Policy & thresholds ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("risk")}
                  >
                    Risk disclosure ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "guardianPolicy" ? (
              <>
                <div className="pd-kv-grid">
                  <div>
                    <span>Max consecutive losses</span>
                    <b className="mono">{guardian.maxConsecutiveLosses}</b>
                  </div>
                  <div>
                    <span>Drawdown limit</span>
                    <b className="mono">{guardian.drawdownLimitPct}%</b>
                  </div>
                  <div>
                    <span>Market rotation</span>
                    <b>{guardian.rotation ? "ON" : "OFF"}</b>
                  </div>
                  <div>
                    <span>Current streak</span>
                    <b className="mono">
                      {guardian.consecutiveLosses}/
                      {guardian.maxConsecutiveLosses}
                    </b>
                  </div>
                </div>
                <div className="pd-gauge">
                  <div className="pd-gauge__head">
                    <span>DRAWDOWN NOW</span>
                    <span className="mono">
                      {guardian.drawdownPct}% / {guardian.drawdownLimitPct}%
                    </span>
                  </div>
                  <Progress
                    value={
                      (guardian.drawdownPct /
                        Math.max(guardian.drawdownLimitPct, 1)) *
                      100
                    }
                    tone={
                      guardian.drawdownPct > guardian.drawdownLimitPct * 0.7
                        ? "is-warn"
                        : "is-win"
                    }
                    label="Drawdown against policy"
                  />
                  <small>{headroom}% headroom before the pool pauses.</small>
                </div>
                <ul className="pd-list">
                  <li>
                    <b>Loss streak</b> counts consecutive losing trades. At{" "}
                    {guardian.maxConsecutiveLosses}, the Guardian halves stake
                    until a winner closes.
                  </li>
                  <li>
                    <b>Drawdown limit</b> pauses new entries at{" "}
                    {guardian.drawdownLimitPct}% from the cycle peak; open
                    positions are managed to a safe close.
                  </li>
                  <li>
                    <b>Rotation</b>{" "}
                    {guardian.rotation ? "is enabled" : "is disabled"} — it
                    moves exposure between markets when correlation breaks down.
                  </li>
                  <li>
                    <b>No mid-cycle changes</b>: the policy is fixed for the
                    cycle so results stay comparable across pools.
                  </li>
                </ul>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("guardianHistory")}
                  >
                    Trigger history ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("risk")}
                  >
                    Risk profile ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "participants" ? (
              <>
                <div className="pd-kv-grid">
                  <div>
                    <span>Participants</span>
                    <b className="mono">{participants.totalParticipants}</b>
                  </div>
                  <div>
                    <span>Average</span>
                    <b className="mono">{money(participants.avgInvestment)}</b>
                  </div>
                  <div>
                    <span>Committed</span>
                    <b className="mono">{money(participants.committed)}</b>
                  </div>
                  <div>
                    <span>Slots</span>
                    <b className="mono">
                      {participants.slotsFilled}/{participants.slotsTotal}
                    </b>
                  </div>
                </div>
                <p className="pd-note">{participants.note}</p>
                {participants.showRows ? (
                  <>
                    <div className="table-responsive">
                      <table className="table pd-table">
                        <thead>
                          {participantTable.getHeaderGroups().map((group) => (
                            <tr key={group.id}>
                              {group.headers.map((header) => (
                                <th key={header.id}>
                                  <button
                                    type="button"
                                    onClick={header.column.getToggleSortingHandler()}
                                    disabled={!header.column.getCanSort()}
                                  >
                                    <participantTable.FlexRender
                                      header={header}
                                    />
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
                          {participantTable.getRowModel().rows.map((row) => (
                            <tr key={row.id}>
                              {row.getAllCells().map((cell) => (
                                <td key={cell.id}>
                                  <participantTable.FlexRender cell={cell} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {participants.tail ? (
                      <p className="pd-muted pd-tail-note">
                        + {participants.tail.count} participant(s) in smaller
                        bands · {participants.tail.slots} slot(s) ·{" "}
                        {money(participants.tail.investment)} committed
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="pd-empty">
                    Individual allocations are hidden until the pool starts
                    trading. You can still see the aggregate distribution below.
                  </div>
                )}
                <div className="pd-bands pd-bands--modal">
                  <DistributionBars rows={participants.bands} />
                </div>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("statement")}
                  >
                    Export participants ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("fees")}
                  >
                    Profit share ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "fees" ? (
              <>
                <div className="pd-review">
                  <div>
                    <span>Profit share</span>
                    <b className="mono">{overview.profitSharePct}%</b>
                  </div>
                  <div>
                    <span>Platform share</span>
                    <b className="mono">{investment?.platformCutPct ?? 20}%</b>
                  </div>
                  <div>
                    <span>Entry fee</span>
                    <b>none</b>
                  </div>
                  <div>
                    <span>Exit / bank fee</span>
                    <b>$1.50 per withdrawal</b>
                  </div>
                </div>
                <div className="pd-breakdown">
                  <div>
                    <span>POOL PROFIT</span>
                    <b className="mono">
                      {signedMoney(performance?.totalPnl ?? 0, 2)}
                    </b>
                    <small>closed trades this cycle</small>
                  </div>
                  <div>
                    <span>YOUR GROSS</span>
                    <b className="mono">
                      {signedMoney(investment?.grossEarnings ?? 0, 2)}
                    </b>
                    <small>pro-rata by capital share</small>
                  </div>
                  <div>
                    <span>YOU RECEIVE</span>
                    <b className="mono">
                      {signedMoney(investment?.netEarnings ?? 0, 2)}
                    </b>
                    <small>
                      after {investment?.platformCutPct ?? 20}% platform share
                    </small>
                  </div>
                </div>
                <ul className="pd-list">
                  <li>
                    <b>Profit share</b> is the pool's share of trading profit —
                    it is already deducted inside the pool result, not from your
                    payout.
                  </li>
                  <li>
                    <b>Platform share</b> of {investment?.platformCutPct ?? 20}%
                    applies to your attributed profit only. Losses are not
                    charged.
                  </li>
                  <li>
                    <b>Withdrawals</b> cost $1.50 by bank transfer; USDT pays
                    the network fee at the provider.
                  </li>
                </ul>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("earnings")}
                  >
                    Earnings attribution ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("payout")}
                  >
                    Request payout ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "payoutRecord" ? (
              <>
                <div className="pd-kv-grid">
                  <div>
                    <span>Pool</span>
                    <b>
                      {overview.code} · {overview.name}
                    </b>
                  </div>
                  <div>
                    <span>Profit share date</span>
                    <b className="mono">
                      {overview.profitShareAt
                        ? atDateTime(overview.profitShareAt)
                        : "—"}
                    </b>
                  </div>
                  <div>
                    <span>Settlement batch</span>
                    <b className="mono">{overview.settlementBatch}</b>
                  </div>
                  <div>
                    <span>Cycle state</span>
                    <b>{lifecycleLabel[overview.lifecycle]}</b>
                  </div>
                </div>
                {investment ? (
                  <div className="pd-breakdown">
                    <div>
                      <span>INVESTED</span>
                      <b className="mono">{money(investment.investment, 2)}</b>
                      <small>{investment.slots} slot(s)</small>
                    </div>
                    <div>
                      <span>GROSS</span>
                      <b className="mono text-win">
                        {signedMoney(investment.grossEarnings, 2)}
                      </b>
                      <small>before platform share</small>
                    </div>
                    <div>
                      <span>NET PAID</span>
                      <b className="mono">
                        {signedMoney(investment.netEarnings, 2)}
                      </b>
                      <small>{percent(investment.roiPct)} on capital</small>
                    </div>
                  </div>
                ) : (
                  <div className="pd-empty">
                    No settled position in this pool — there is no payout record
                    to download for this investor.
                  </div>
                )}
                {data.payouts.length ? (
                  <div className="pd-payout-list">
                    {data.payouts.map((payout) => (
                      <div className="pd-payout-row" key={payout.id}>
                        <div>
                          <b className="mono">{money(payout.amount, 2)}</b>
                          <small>
                            {payout.method === "usdt"
                              ? "USDT"
                              : "Bank transfer"}{" "}
                            · {atDateTime(payout.createdAt)}
                          </small>
                        </div>
                        <span className="pd-tag is-upcoming">draft</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="pd-inline-note">
                  <Icon name="info" size={13} /> Generated PDFs are review
                  copies. Certified settlement records, provider receipts and
                  tax documents must come from the backend.
                </div>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => void downloadPayoutRecord()}
                  >
                    Download payout record (PDF) ↗
                  </button>
                  {investment ? (
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("payout")}
                    >
                      Request another payout ↗
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            {modal.kind === "documents" ? (
              <>
                <div className="pd-doc-modal-list">
                  {data.documents.map((doc) => (
                    <div className="pd-doc" key={doc.id}>
                      <span
                        className={`pd-doc__icon is-${doc.format}`}
                        aria-hidden="true"
                      >
                        {doc.format.toUpperCase()}
                      </span>
                      <div className="pd-doc__body">
                        <b>{doc.name}</b>
                        <span>
                          {doc.kind} ·{" "}
                          {doc.scope === "pool" ? "pool-wide" : "your position"}{" "}
                          · {doc.sizeLabel} · {atDate(doc.updatedAt)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="pd-btn"
                        disabled={busy}
                        onClick={() => void downloadDocument(doc.id)}
                      >
                        <Icon name="download" size={13} /> Get
                      </button>
                    </div>
                  ))}
                </div>
                <div className="pd-inline-note">
                  <Icon name="info" size={13} /> Files are produced from this
                  snapshot in your browser. Downloading also records an export
                  command in the local audit trail.
                </div>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("statement")}
                  >
                    Build a custom statement ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("activity")}
                  >
                    Export history ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "activity" ? (
              <>
                <div
                  className="pd-filter-row"
                  role="group"
                  aria-label="Activity scope"
                >
                  <button
                    type="button"
                    className={`pd-chip${ledgerOnlyLocal ? "" : " is-on"}`}
                    aria-pressed={!ledgerOnlyLocal}
                    onClick={() => setLedgerOnlyLocal(false)}
                  >
                    All entries
                  </button>
                  <button
                    type="button"
                    className={`pd-chip${ledgerOnlyLocal ? " is-on" : ""}`}
                    aria-pressed={ledgerOnlyLocal}
                    onClick={() => setLedgerOnlyLocal(true)}
                  >
                    Local commands
                  </button>
                </div>
                <ol className="pd-timeline">
                  {ledger.map((entry) => (
                    <li
                      className={`is-${entry.scope === "Local workspace" ? "current" : "done"}`}
                      key={entry.id}
                    >
                      <span className="pd-timeline__dot" aria-hidden="true" />
                      <div>
                        <div className="pd-timeline__head">
                          <b>
                            {entry.title.replace(/^./, (char) =>
                              char.toUpperCase(),
                            )}
                          </b>
                          <span className="pd-tag is-upcoming">
                            {entry.scope === "Local workspace"
                              ? "local"
                              : "source"}
                          </span>
                        </div>
                        <span className="mono pd-muted">
                          {atDateTime(entry.at)}
                        </span>
                        <p>{entry.detail}</p>
                      </div>
                    </li>
                  ))}
                  {ledger.length === 0 ? (
                    <li className="pd-ledger__empty">
                      No entries in this scope yet.
                    </li>
                  ) : null}
                </ol>
                <div className="pd-inline-note">
                  <Icon name="info" size={13} /> Source events are read-only.
                  Local entries exist only in this browser session and are not
                  sent to a backend.
                </div>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("help")}
                  >
                    Source vs local ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("statement")}
                  >
                    Export activity ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "compare" ? (
              <>
                <p className="pd-note">
                  Same manager, adjacent risk band, or the next cycle in the
                  roadmap. Return is the target expectation for upcoming pools
                  and the realized win rate for the current one.
                </p>
                <div className="table-responsive">
                  <table className="table pd-table">
                    <thead>
                      {compareTable.getHeaderGroups().map((group) => (
                        <tr key={group.id}>
                          {group.headers.map((header) => (
                            <th key={header.id}>
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                disabled={!header.column.getCanSort()}
                              >
                                <compareTable.FlexRender header={header} />
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
                      {compareTable.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                          {row.getAllCells().map((cell) => (
                            <td key={cell.id}>
                              <compareTable.FlexRender cell={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pd-modal-links">
                  <Link className="pd-link" href="/investor/pools">
                    Browse the whole pool book ↗
                  </Link>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("projection")}
                  >
                    Project a return ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "share" ? (
              <>
                <p className="pd-note">
                  A permalink to this pool workspace. Nothing is posted, emailed
                  or tracked — the link is copied to your clipboard.
                </p>
                <label className="pd-field">
                  Permalink
                  <input
                    className="form-control mono"
                    readOnly
                    value={
                      typeof window === "undefined"
                        ? `/investor/pools/${overview.id}`
                        : `${window.location.origin}/investor/pools/${overview.id}`
                    }
                    aria-label="Pool permalink"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <small>
                    {overview.code} · {overview.name} · opens the same snapshot
                  </small>
                </label>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => void copyShareLink()}
                  >
                    Copy permalink ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("statement")}
                  >
                    Download a factsheet instead ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("support")}
                  >
                    Ask the desk for a summary ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "help" ? (
              <>
                <p className="pd-note">
                  This workspace is a front-end preview running on committed
                  structured data. It is intentionally complete: every figure,
                  table and file is derived from the same snapshot.
                </p>
                <ul className="pd-list">
                  <li>
                    <b>Source snapshot</b> — pool facts, trades, participants
                    and documents provided by the pool service. Read-only here.
                  </li>
                  <li>
                    <b>Local commands</b> — slot holds, payout drafts,
                    reminders, projections, alert preferences, support drafts,
                    watch state and exports. Stored in the browser session and
                    listed in the activity log.
                  </li>
                  <li>
                    <b>Not connected</b> — payment capture, slot confirmation,
                    provider execution data, email/push delivery, support
                    tickets and settlement. Those need authenticated backend
                    endpoints.
                  </li>
                  <li>
                    <b>Data shape</b> —{" "}
                    <code>GET /api/investor/pools/{"{id}"}</code> returns the
                    same workspace DTO with a <code>section</code> filter, so a
                    real backend can replace the seed without touching this UI.
                  </li>
                </ul>
                <div className="pd-kv-grid">
                  <div>
                    <span>Snapshot</span>
                    <b className="mono">{atDateTime(data.asOf)}</b>
                  </div>
                  <div>
                    <span>Revision</span>
                    <b className="mono">r{data.revision}</b>
                  </div>
                  <div>
                    <span>Local commands</span>
                    <b className="mono">{data.audit.length}</b>
                  </div>
                  <div>
                    <span>Pool</span>
                    <b className="mono">{overview.code}</b>
                  </div>
                </div>
                <div className="pd-modal-links">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("activity")}
                  >
                    Open activity log ↗
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => open("support")}
                  >
                    Contact the desk ↗
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "interest" ? (
              data.interest ? (
                <>
                  <div className="pd-kv-grid">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Registered</span>
                      <b className="mono">
                        {atDateTime(data.interest.registeredAt)}
                      </b>
                    </div>
                    <div>
                      <span>Slots</span>
                      <b className="mono">{data.interest.slots}</b>
                    </div>
                    <div>
                      <span>Intent value</span>
                      <b className="mono">{money(data.interest.amount)}</b>
                    </div>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Booking opens</span>
                      <b className="mono">
                        {atDateTime(overview.bookingOpensAt)} ·{" "}
                        {opensCountdown.label}
                      </b>
                    </div>
                    <div>
                      <span>Channel</span>
                      <b>
                        {data.interest.channel === "email"
                          ? "Email"
                          : "In-app alerts"}
                      </b>
                    </div>
                    <div>
                      <span>Binding?</span>
                      <b>no — expression of interest only</b>
                    </div>
                    <div>
                      <span>Status</span>
                      <b>registered in this local workspace</b>
                    </div>
                  </div>
                  <div className="pd-inline-note">
                    <Icon name="check" size={13} /> {data.interest.note}
                  </div>
                  <div className="pd-modal-links">
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("reminder")}
                    >
                      Adjust the opening reminder ↗
                    </button>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("alerts")}
                    >
                      Alert preferences ↗
                    </button>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => open("compare")}
                    >
                      Compare with other pools ↗
                    </button>
                    <Link className="pd-link" href="/investor/pools">
                      Browse upcoming pools ↗
                    </Link>
                  </div>
                </>
              ) : step === 0 ? (
                <>
                  <div className="pd-kv-grid">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Booking opens</span>
                      <b className="mono">
                        {atDateTime(overview.bookingOpensAt)}
                      </b>
                    </div>
                    <div>
                      <span>Opens in</span>
                      <b className="mono">{opensCountdown.label}</b>
                    </div>
                    <div>
                      <span>Slot price</span>
                      <b className="mono">{money(overview.slotPrice)}</b>
                    </div>
                  </div>
                  <label className="pd-field">
                    Slots you expect to reserve
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      max={maxInterestSlots}
                      value={interestSlots}
                      aria-label="Slots of interest"
                      onChange={(e) =>
                        setInterestSlots(
                          Math.max(
                            1,
                            Math.min(maxInterestSlots, Number(e.target.value)),
                          ),
                        )
                      }
                    />
                    <small>
                      Up to {maxInterestSlots} slot(s) per investor ·{" "}
                      {money(interestSlots * overview.slotPrice)} intent value
                    </small>
                  </label>
                  <div className="pd-stepper">
                    {[1, 2, 3, 5]
                      .filter((value) => value <= maxInterestSlots)
                      .map((value) => (
                        <button
                          type="button"
                          key={value}
                          className={`pd-btn${interestSlots === value ? " is-on" : ""}`}
                          onClick={() => setInterestSlots(value)}
                        >
                          {value} slot{value === 1 ? "" : "s"}
                        </button>
                      ))}
                  </div>
                  <div className="pd-inline-note">
                    <Icon name="info" size={13} /> An expression of interest is
                    non-binding: no slot is held, no capacity is reserved and no
                    payment is taken. Slots are confirmed in booking order once
                    the window opens.
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="pd-breakdown">
                    <div>
                      <span>SLOTS</span>
                      <b className="mono">{interestSlots}</b>
                      <small>at {money(overview.slotPrice)} each</small>
                    </div>
                    <div>
                      <span>INTENT VALUE</span>
                      <b className="mono">
                        {money(interestSlots * overview.slotPrice)}
                      </b>
                      <small>nothing captured</small>
                    </div>
                    <div>
                      <span>POOL AFTER</span>
                      <b className="mono">
                        {money(
                          overview.raised + interestSlots * overview.slotPrice,
                        )}
                      </b>
                      <small>
                        {plainPercent(
                          detailFillPct(
                            overview.raised +
                              interestSlots * overview.slotPrice,
                            overview.goal,
                          ),
                          0,
                        )}{" "}
                        of target
                      </small>
                    </div>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Booking opens</span>
                      <b className="mono">
                        {atDateTime(overview.bookingOpensAt)}
                      </b>
                    </div>
                    <div>
                      <span>Notification</span>
                      <b>
                        {remindLead} day(s) before opening ·{" "}
                        {remindChannel === "email" ? "email" : "in-app"}
                      </b>
                    </div>
                    <div>
                      <span>Status after</span>
                      <b>registered · non-binding</b>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="pd-review-final">
                    <Icon name="info" size={16} />
                    <p>
                      This registers interest in {interestSlots} slot(s) of{" "}
                      {overview.code} (
                      {money(interestSlots * overview.slotPrice)} intent value)
                      in the local workspace only. No slot is held, no payment
                      is taken and the funding desk is not notified.
                    </p>
                  </div>
                  <div className="pd-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {overview.code} · {overview.name}
                      </b>
                    </div>
                    <div>
                      <span>Slots</span>
                      <b className="mono">{interestSlots}</b>
                    </div>
                    <div>
                      <span>Binding?</span>
                      <b>no — expression of interest only</b>
                    </div>
                  </div>
                </>
              )
            ) : null}
          </DeskModalShell>
        </div>
      ) : null}
    </InvestorShell>
  );
}
