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
  atStamp,
  botStatusLabel,
  clockOf,
  durationLabel,
  filterFeed,
  guardianLabel,
  money,
  nextSyntheticTrade,
  nextTicks,
  poolLabel,
  round2,
  signedMoney,
  signedPct,
  type BotStatus,
  type GuardianLevel,
  type LiveBot,
  type LivePool,
  type LiveTrade,
  type LiveTradeWorkspace,
} from "@/lib/investor/live-trades";
import { useLiveTrades } from "@/lib/investor/use-live-trades";
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
const hourLabel = (iso: string) => `${clockOf(iso)} UTC`;
const tone = (value: number) =>
  value > 0 ? "is-pos" : value < 0 ? "is-neg" : "is-flat";
const levelTone = (level: GuardianLevel) =>
  level === "ok" ? "is-ok" : level === "watch" ? "is-watch" : "is-alert";
const botTone = (status: BotStatus) =>
  status === "running"
    ? "is-running"
    : status === "paused"
      ? "is-paused"
      : "is-cooldown";
/** Long-form elapsed time: 383 minutes reads as "6h 23m", not "383m 35s". */
const spanLabel = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m ${seconds % 60}s`;
};
const cooldownLabel = (seconds: number) =>
  seconds <= 0 ? "—" : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

/* ── Dialog registry ── */

type Kind =
  | "tradeDetail"
  | "tickerDetail"
  | "botDetail"
  | "poolDetail"
  | "pauseBot"
  | "preferences"
  | "alertRules"
  | "exportFeed"
  | "support"
  | "filters"
  | "journal"
  | "streamInfo"
  | "sessionReport"
  | "guardrails"
  | "alerts"
  | "shortcuts"
  | "help"
  | "share"
  | "earnings";

const titles: Record<Kind, string> = {
  tradeDetail: "Trade detail",
  tickerDetail: "Symbol ticker",
  botDetail: "Bot execution",
  poolDetail: "Pool in your live book",
  pauseBot: "Pause a bot",
  preferences: "Stream preferences",
  alertRules: "Alert threshold",
  exportFeed: "Export the feed",
  support: "Message the trade desk",
  filters: "Filter the live feed",
  journal: "Session journal",
  streamInfo: "Stream diagnostics",
  sessionReport: "Session report",
  guardrails: "Guardian guardrails",
  alerts: "Guardian alerts",
  shortcuts: "Keyboard shortcuts",
  help: "Workspace boundaries",
  share: "Share this session",
  earnings: "How your share is paid",
};

const wizardSteps: Partial<Record<Kind, readonly string[]>> = {
  pauseBot: ["Bot & window", "Reason", "Confirm"],
  preferences: ["Stream behaviour", "Confirm"],
  alertRules: ["Threshold", "Delivery", "Confirm"],
  exportFeed: ["Scope", "Format", "Confirm"],
  support: ["Topic", "Message", "Confirm"],
  filters: ["Pools & results", "Refine", "Apply"],
};

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  tradeDetail: "lg",
  tickerDetail: "md",
  botDetail: "lg",
  poolDetail: "md",
  pauseBot: "md",
  preferences: "md",
  alertRules: "md",
  exportFeed: "md",
  support: "md",
  filters: "lg",
  journal: "xl",
  streamInfo: "lg",
  sessionReport: "xl",
  guardrails: "lg",
  alerts: "lg",
  shortcuts: "md",
  help: "lg",
  share: "md",
  earnings: "lg",
};

const quickActions: InvestorQuickAction[] = [
  {
    key: "pause",
    label: "Pause or resume the stream",
    short: "Pause",
    icon: "pause",
  },
  {
    key: "filters",
    label: "Filter the live feed",
    short: "Filter",
    icon: "filter",
  },
  {
    key: "export",
    label: "Export this session",
    short: "Export",
    icon: "download",
  },
  { key: "alerts", label: "Guardian alerts", short: "Alerts", icon: "shield" },
  {
    key: "journal",
    label: "Open the session journal",
    short: "Journal",
    icon: "file",
  },
  {
    key: "pools",
    label: "All crowdfunding pools",
    short: "Pools",
    icon: "pool",
  },
];

const sections = [
  { key: "totals", label: "Running totals", id: "lt-totals" },
  { key: "feed", label: "Live trades", id: "lt-feed" },
  { key: "tickers", label: "Tickers", id: "lt-tickers" },
  { key: "session", label: "Session", id: "lt-session" },
  { key: "bots", label: "Bots", id: "lt-bots" },
] as const;

const FEED_WINDOW = 16;
const FEED_STEP = 12;

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
    <header className="lt-section-head">
      <div>
        <span className="lt-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="lt-section-aside">{aside}</div> : null}
    </header>
  );
}

function Kpi({
  label,
  value,
  hint,
  note,
  className,
  pulse,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  label: string;
  value: number;
  hint: string;
  note?: string;
  className?: string;
  pulse?: boolean;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const shown = useLiveCountUp(value);
  return (
    <article className={`lt-kpi ${className ?? ""}`.trim()}>
      <span className="lt-kpi__label">{label}</span>
      <b className="lt-kpi__value mono">
        {prefix}
        {num(shown, decimals)}
        {suffix}
      </b>
      <span className="lt-kpi__hint">{hint}</span>
      {note ? <span className="lt-kpi__note">{note}</span> : null}
      {pulse ? <span className="lt-kpi__pulse" aria-hidden="true" /> : null}
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
  return <span className={`lt-tag ${tagTone}`.trim()}>{children}</span>;
}

function Stat({
  label,
  value,
  hint,
  tone: statTone = "",
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="lt-stat">
      <span>{label}</span>
      <b className={`mono ${statTone}`.trim()}>{value}</b>
      <small>{hint}</small>
    </div>
  );
}

function TradeRow({
  trade,
  fresh,
  onOpen,
}: {
  trade: LiveTrade;
  fresh: boolean;
  onOpen: () => void;
}) {
  return (
    <li
      className={`lt-feed__row ${trade.isWin ? "is-win" : "is-loss"} ${
        fresh ? "is-fresh" : ""
      }`}
      data-trade={trade.tradeId}
    >
      <span className="lt-feed__tag" aria-label={trade.isWin ? "Win" : "Loss"}>
        <Icon name={trade.isWin ? "check" : "close"} size={11} />
        {trade.isWin ? "WIN" : "LOSS"}
      </span>
      <button type="button" className="lt-feed__body" onClick={onOpen}>
        <span className="lt-feed__line">
          <b className="lt-feed__symbol">{trade.symbol}</b>
          <span className="lt-feed__contract">{trade.contractLabel}</span>
          <span className="lt-feed__stake mono">
            {money(trade.stake)} → {trade.isWin ? money(trade.payout) : "—"}
          </span>
          <b
            className={`lt-feed__profit mono ${trade.profit >= 0 ? "is-pos" : "is-neg"}`}
          >
            {signedMoney(trade.profit)}
          </b>
          <span className="lt-feed__share">
            your share:{" "}
            <b
              className={`mono ${trade.yourShareNet >= 0 ? "is-pos" : "is-neg"}`}
            >
              {signedMoney(trade.yourShareNet, 2)}
            </b>
          </span>
          <time className="lt-feed__time mono">{clockOf(trade.soldAt)}</time>
        </span>
        <span className="lt-feed__meta">
          {trade.botName} · {trade.poolCode} · entry{" "}
          <span className="mono">{num(trade.entrySpot, 2)}</span> → exit{" "}
          <span className="mono">{num(trade.exitSpot, 2)}</span> ·{" "}
          {durationLabel(trade.durationSeconds)} hold · {trade.yourSharePct}%
          share · <span className="mono">{trade.tradeId}</span>
        </span>
      </button>
    </li>
  );
}

/* ── Page ── */

export function InvestorLiveTradePage({
  initial,
  initialAction,
}: {
  initial: LiveTradeWorkspace;
  initialAction?: string;
}) {
  const router = useRouter();
  const { data, command, push } = useLiveTrades(initial);
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

  const dataRef = useRef(data);
  dataRef.current = data;

  const actionMap: Record<string, Kind> = {
    totals: "sessionReport",
    feed: "journal",
    journal: "journal",
    tickers: "streamInfo",
    session: "sessionReport",
    bots: "botDetail",
    alerts: "alerts",
    guardian: "alerts",
    guardrails: "guardrails",
    filters: "filters",
    export: "exportFeed",
    preferences: "preferences",
    rules: "alertRules",
    support: "support",
    share: "share",
    help: "help",
    shortcuts: "shortcuts",
    earnings: "earnings",
    stream: "streamInfo",
  };

  const [modal, setModal] = useState<{ kind: Kind } | null>(() => {
    const kind = initialAction ? actionMap[initialAction] : undefined;
    return kind ? { kind } : null;
  });
  const [wizardStep, setWizardStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<"overview" | "feed" | "bots" | null>(
    null,
  );
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("live");
  const [clock, setClock] = useState(initial.asOf);
  const [freshTrade, setFreshTrade] = useState("");
  const [feedWindow, setFeedWindow] = useState(FEED_WINDOW);
  const [seq, setSeq] = useState(0);
  const [selectedTrade, setSelectedTrade] = useState<string | null>(
    initial.feed[0]?.tradeId ?? null,
  );
  const [selectedTicker, setSelectedTicker] = useState(
    initial.ticks[0]?.symbol ?? "",
  );
  const [selectedBot, setSelectedBot] = useState(initial.bots[0]?.id ?? "");
  const [selectedPool, setSelectedPool] = useState(
    initial.pools[0]?.poolId ?? "",
  );
  const [selectedAlert, setSelectedAlert] = useState(
    initial.alerts[0]?.id ?? "",
  );
  const [snapshotNote, setSnapshotNote] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<"pool" | "symbol" | "hour">(
    "pool",
  );
  const [journalQuery, setJournalQuery] = useState("");
  const [journalSorting, setJournalSorting] = useState<SortingState>([]);

  /* wizard fields */
  const [pauseMinutes, setPauseMinutes] = useState<5 | 15 | 60 | 240>(15);
  const [pauseReason, setPauseReason] = useState<
    "travel" | "review" | "volatility" | "other"
  >("review");
  const [prefAutoScroll, setPrefAutoScroll] = useState(
    initial.preferences.autoScroll,
  );
  const [prefFlash, setPrefFlash] = useState(initial.preferences.rowFlash);
  const [prefDensity, setPrefDensity] = useState<"comfortable" | "compact">(
    initial.preferences.density,
  );
  const [prefSound, setPrefSound] = useState(initial.preferences.soundCue);
  const [ruleThreshold, setRuleThreshold] = useState(50);
  const [ruleChannel, setRuleChannel] = useState<"email" | "in_app">("in_app");
  const [ruleMatches, setRuleMatches] = useState<"your-pools" | "all-pools">(
    "your-pools",
  );
  const [exportScope, setExportScope] = useState<
    "trade-feed" | "session-stats" | "bot-report" | "guardian-log"
  >("trade-feed");
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "pdf">(
    "csv",
  );
  const [supportTopic, setSupportTopic] = useState<
    "trade" | "bot" | "payout" | "guardian" | "other"
  >("trade");
  const [supportMessage, setSupportMessage] = useState("");
  const closeRef = useRef<() => void>(() => {});

  const filterForm = useForm({
    defaultValues: {
      pools: data.filters.pools,
      results: data.filters.results,
      minStake: data.filters.minStake,
      query: data.filters.query,
    },
    onSubmit: ({ value }) => {
      void run(
        {
          kind: "saveFilters",
          pools: value.pools,
          results: value.results as ("win" | "loss")[],
          symbols: data.filters.symbols,
          minStake: Number(value.minStake) || 0,
          query: value.query,
        },
        { title: "Feed filter stored locally" },
      );
    },
  });

  /* ── Derived ── */

  const feed = useMemo(
    () => filterFeed(data.feed, data.filters),
    [data.feed, data.filters],
  );
  const visibleFeed = feed.slice(0, Math.max(FEED_WINDOW, feedWindow));
  const totals = data.totals;
  const stats = data.stats;
  const openAlerts = data.alerts.filter((alert) => !alert.acknowledged);
  const trade =
    data.feed.find((row) => row.tradeId === selectedTrade) ??
    data.feed[0] ??
    null;
  const ticker =
    data.ticks.find((row) => row.symbol === selectedTicker) ?? data.ticks[0];
  const bot = data.bots.find((row) => row.id === selectedBot) ?? data.bots[0];
  const pool =
    data.pools.find((row) => row.poolId === selectedPool) ?? data.pools[0];
  const alert =
    data.alerts.find((row) => row.id === selectedAlert) ?? data.alerts[0];
  const uptime = Math.max(
    0,
    Math.floor(
      (Date.parse(clock) - Date.parse(data.stream.connectedAt)) / 1000,
    ),
  );
  const paused = data.preferences.streamPaused;

  const breakdownRows = useMemo(
    () =>
      breakdown === "pool"
        ? stats.byPool
        : breakdown === "symbol"
          ? stats.bySymbol
          : stats.byHour,
    [breakdown, stats],
  );

  /* ── Stream simulation ── */

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = dataRef.current;
      if (!current || current.preferences.streamPaused) return;
      setClock((prev) => new Date(Date.parse(prev) + 1000).toISOString());
      setSeq((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (seq === 0) return;
    const current = dataRef.current;
    if (!current || current.preferences.streamPaused) return;
    const at = new Date(Date.parse(current.asOf) + seq * 1000).toISOString();
    push({ kind: "tick_update", ticks: nextTicks(current.ticks, seq, at) });
  }, [seq, push]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = dataRef.current;
      if (!current || current.preferences.streamPaused) return;
      const at = new Date(
        Date.parse(current.asOf) + 60_000 + current.feed.length * 5000,
      ).toISOString();
      const next = nextSyntheticTrade(
        current,
        current.feed.length + current.revision,
        at,
      );
      push({ kind: "trade_result", trade: next });
    }, 9000);
    return () => window.clearInterval(timer);
  }, [push]);

  const topTrade = data.feed[0]?.tradeId ?? "";
  useEffect(() => {
    if (!topTrade) return;
    setFreshTrade(topTrade);
    const timer = window.setTimeout(() => setFreshTrade(""), 900);
    return () => window.clearTimeout(timer);
  }, [topTrade]);

  /* ── Journal table ── */

  const journalColumn = useMemo(() => createDeskColumnHelper<LiveTrade>(), []);
  const journalColumns = useMemo(
    () =>
      journalColumn.columns([
        journalColumn.accessor("soldAt", {
          header: "Time",
          cell: (info) => (
            <span className="mono">{clockOf(info.getValue())}</span>
          ),
        }),
        journalColumn.accessor("symbol", { header: "Symbol" }),
        journalColumn.accessor("contractLabel", { header: "Contract" }),
        journalColumn.accessor("poolCode", { header: "Pool" }),
        journalColumn.accessor("botName", { header: "Bot" }),
        journalColumn.accessor("stake", {
          header: "Stake",
          cell: (info) => (
            <span className="mono">{money(info.getValue())}</span>
          ),
        }),
        journalColumn.accessor("isWin", {
          header: "Result",
          cell: (info) => (
            <Tag tone={info.getValue() ? "is-win" : "is-loss"}>
              {info.getValue() ? "Win" : "Loss"}
            </Tag>
          ),
        }),
        journalColumn.accessor("profit", {
          header: "P&L",
          cell: (info) => (
            <span
              className={`mono ${info.getValue() >= 0 ? "is-pos" : "is-neg"}`}
            >
              {signedMoney(info.getValue())}
            </span>
          ),
        }),
        journalColumn.accessor("yourShareNet", {
          header: "Your share",
          cell: (info) => (
            <span
              className={`mono ${info.getValue() >= 0 ? "is-pos" : "is-neg"}`}
            >
              {signedMoney(info.getValue(), 2)}
            </span>
          ),
        }),
        journalColumn.accessor("durationSeconds", {
          header: "Hold",
          cell: (info) => (
            <span className="mono">{durationLabel(info.getValue())}</span>
          ),
        }),
      ]),
    [journalColumn],
  );
  const journalRows = useMemo(() => {
    const query = journalQuery.trim().toLowerCase();
    if (!query) return data.feed;
    return data.feed.filter((row) =>
      `${row.symbol} ${row.contractLabel} ${row.poolCode} ${row.botName} ${row.tradeId}`
        .toLowerCase()
        .includes(query),
    );
  }, [data.feed, journalQuery]);
  const journalTable = useDeskTable({
    data: journalRows,
    columns: journalColumns,
    state: { sorting: journalSorting },
    onSortingChange: setJournalSorting,
  });

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
    if (!modal && !drawer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal, drawer]);

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
    if (kind === "pauseBot" && bot) setSelectedBot(bot.id);
    if (kind === "exportFeed") setExportScope("trade-feed");
  }

  function openTrade(id: string) {
    setSelectedTrade(id);
    open("tradeDetail");
  }

  function openTicker(symbol: string) {
    setSelectedTicker(symbol);
    open("tickerDetail");
  }

  function openBot(id: string, kind: Kind = "botDetail") {
    setSelectedBot(id);
    open(kind);
  }

  function openPool(id: string) {
    setSelectedPool(id);
    open("poolDetail");
  }

  function openAlert(id: string) {
    setSelectedAlert(id);
    open("alerts");
  }

  function scrollTo(id: string) {
    if (typeof document === "undefined") return;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function run(
    input: Parameters<typeof command.mutateAsync>[0],
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
          "Held in this browser session. No order was routed, no bot changed on the desk and no message was sent.",
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

  function toggleStream() {
    void run(
      { kind: "setStreamPaused", paused: !paused },
      {
        keep: true,
        title: paused
          ? "Stream resumed in this browser"
          : "Stream paused in this browser",
        detail: paused
          ? "Values continue from the desk snapshot. Ticks are simulated locally."
          : "Updates are held. The desk keeps trading; queued events are dropped.",
      },
    );
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

  function refresh() {
    const current = dataRef.current;
    if (!current) return;
    if (current.preferences.streamPaused) {
      pushToast({
        tone: "warning",
        title: "The stream is paused",
        detail:
          "Resume it before refreshing, otherwise the snapshot will not move.",
      });
      return;
    }
    const next = nextSyntheticTrade(
      current,
      current.feed.length + current.revision + 1,
    );
    push({ kind: "trade_result", trade: next });
    setSnapshotNote(
      `Manual pull at ${clockOf(clock)} UTC · 1 trade and ${data.ticks.length} ticks re-read`,
    );
    pushToast({
      tone: "info",
      title: "Feed re-read",
      detail:
        "One trade and the five tickers were pulled from the session buffer.",
    });
  }

  const wizardFor = modal ? wizardSteps[modal.kind] : undefined;
  const wizard = wizardFor ? [...wizardFor] : undefined;
  const lastStep = wizard ? wizard.length - 1 : 0;

  const modalBlock = (() => {
    if (!modal) return "";
    if (modal.kind === "pauseBot") {
      if (!bot) return "Choose a bot first";
      if (bot.status !== "running")
        return `${bot.name} is already ${botStatusLabel(bot.status).toLowerCase()}`;
      return "";
    }
    if (modal.kind === "support" && supportMessage.trim().length < 12)
      return "Add at least 12 characters so the desk can act on it";
    if (modal.kind === "alertRules") {
      if (data.rules.some((rule) => rule.threshold === ruleThreshold))
        return "A rule already exists at that threshold";
      if (ruleThreshold < 1 || ruleThreshold > 100000)
        return "Thresholds run from $1 to $100,000";
    }
    if (modal.kind === "exportFeed" && !feed.length)
      return "Nothing matches the current filter — widen it before exporting";
    return "";
  })();

  async function finishWizard() {
    if (!modal) return;
    if (modal.kind === "pauseBot" && bot)
      await run({
        kind: "pauseBot",
        botId: bot.id,
        minutes: pauseMinutes,
        reason: pauseReason,
      });
    if (modal.kind === "preferences")
      await run({
        kind: "savePreferences",
        autoScroll: prefAutoScroll,
        rowFlash: prefFlash,
        density: prefDensity,
        soundCue: prefSound,
      });
    if (modal.kind === "alertRules")
      await run({
        kind: "saveAlertRule",
        threshold: ruleThreshold,
        channel: ruleChannel,
        matches: ruleMatches,
      });
    if (modal.kind === "exportFeed") {
      const counts = {
        "trade-feed": feed.length,
        "session-stats": stats.byPool.length + stats.bySymbol.length,
        "bot-report": data.bots.length,
        "guardian-log": data.alerts.length,
      } as const;
      await run({
        kind: "exportFeed",
        scope: exportScope,
        format: exportFormat,
        count: counts[exportScope],
      });
    }
    if (modal.kind === "support")
      await run({
        kind: "support",
        topic: supportTopic,
        message: supportMessage.trim(),
      });
    if (modal.kind === "filters") await filterForm.handleSubmit();
  }

  const modalFooter = (
    <>
      {wizard && wizardStep === lastStep ? (
        <label className="lt-check lt-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-label="Acknowledge local preview"
          />
          I have reviewed this local preview and understand it changes nothing
          on the trading desk.
        </label>
      ) : null}
      <button
        type="button"
        className="lt-btn"
        disabled={busy}
        onClick={() => (wizardStep ? setWizardStep(wizardStep - 1) : close())}
      >
        {wizardStep ? "Back" : "Close"}
      </button>
      <span className="lt-foot-note">Session-only · no order is routed</span>
      {wizard ? (
        <button
          type="button"
          className="lt-btn lt-btn--primary"
          disabled={
            busy ||
            (!!modalBlock && (!wizard || wizardStep === lastStep)) ||
            (wizardStep === lastStep && !confirmed)
          }
          onClick={() => {
            if (wizardStep < lastStep) {
              if (modalBlock && modalBlock.startsWith("A rule")) return;
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
              : "Apply local change"}
        </button>
      ) : null}
    </>
  );

  /* ── Render ── */

  return (
    <InvestorShell
      rootClass="page-investor-live"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={data.profile.committed}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.profile.wallet}
      unread={data.profile.unread}
      activeNav={activeNav}
      detailHref="/investor/pools/pkg_01"
      bookHref={initial.pools[0] ? "/investor/pools/pkg_01/book" : undefined}
      quickActions={quickActions}
      onNavigate={(key) => {
        setActiveNav(key);
        if (key === "overview") return router.push("/investor");
        if (key === "pools" || key === "detail")
          return router.push("/investor/pools");
        if (key === "book") return router.push("/investor/pools/pkg_01/book");
        if (key === "wallet") return router.push("/investor/wallet");
        if (key === "calculator") return router.push("/investor/calculator");
        if (key === "notifications")
          return router.push("/investor/notifications");
        if (key === "earnings") return router.push("/investor/earnings");
        if (key === "settings") return router.push("/investor?action=profile");
        if (key === "portfolio") return setDrawer("overview");
        if (key === "activity") return setDrawer("feed");
        if (key === "upcoming") return router.push("/investor/pools");
        scrollTo("lt-totals");
      }}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(
          tab === "portfolio"
            ? "overview"
            : tab === "activity"
              ? "feed"
              : "bots",
        )
      }
      onQuickAction={(key) => {
        if (key === "pause") return toggleStream();
        if (key === "filters") return open("filters");
        if (key === "export") return open("exportFeed");
        if (key === "alerts") return open("alerts");
        if (key === "journal") return open("journal");
        if (key === "pools") return router.push("/investor/pools");
        if (key === "bots") return setDrawer("bots");
        if (key === "rules") return open("alertRules");
        if (key === "earnings") return open("earnings");
        scrollTo("lt-feed");
      }}
      onOpenNotifications={() => open("alerts")}
      onChromeReady={(api) => {
        chrome.current = api;
      }}
    >
      <div className="lt-page">
        <header className="lt-hero">
          <div className="lt-hero__lead">
            <div className="lt-hero__status">
              <span className={`lt-live ${paused ? "is-paused" : ""}`}>
                <span className="lt-live__dot" aria-hidden="true" />
                {paused ? "Stream paused" : "Live"}
              </span>
              <span className="lt-hero__meta mono">
                stream {data.stream.id} · {data.stream.region} ·{" "}
                {data.stream.latencyMs} ms · {data.stream.eventsPerMinute}{" "}
                events/min
              </span>
            </div>
            <h1>Live trade tracker</h1>
            <p>
              Every closed trade across your crowdfunding pools, the running
              totals it moves and the bots executing it — no charts, just the
              numbers that settle.
            </p>
            <nav className="lt-jump" aria-label="Jump to section">
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
          <div className="lt-hero__side">
            <div className="lt-hero__clock">
              <span>Session clock</span>
              <b className="mono">{clockOf(clock)}</b>
              <small className="mono">
                uptime {spanLabel(uptime)} · snapshot {hourLabel(data.asOf)}
              </small>
            </div>
            <div className="lt-hero__actions">
              <button
                type="button"
                className={`lt-btn ${paused ? "lt-btn--primary" : ""}`}
                onClick={toggleStream}
                data-action="toggle-stream"
              >
                <Icon name={paused ? "play" : "pause"} size={14} />
                {paused ? "Resume stream" : "Pause stream"}
              </button>
              <button type="button" className="lt-btn" onClick={refresh}>
                <Icon name="refresh" size={14} /> Pull now
              </button>
              <button
                type="button"
                className="lt-btn"
                onClick={() => open("streamInfo")}
              >
                <Icon name="activity" size={14} /> Diagnostics
              </button>
              <button
                type="button"
                className="lt-btn"
                onClick={() => setDrawer("overview")}
                aria-label="Open session inspector"
              >
                <Icon name="panelRight" size={14} /> Inspector
              </button>
            </div>
            <p className="lt-hero__note">
              {snapshotNote ??
                `Last trade ${data.feed[0] ? clockOf(data.feed[0].soldAt) : "—"} UTC · ${
                  data.stream.reconnects
                } reconnect in 8h · feed window capped at 200 trades`}
            </p>
          </div>
        </header>

        {/* ── Running totals ── */}
        <section id="lt-totals" className="lt-section">
          <SectionHead
            code="I-5 / 01"
            title="Running totals"
            hint="Capital committed, pool result and your share, recalculated on every closed trade."
            aside={
              <button
                type="button"
                className="lt-btn"
                onClick={() => open("sessionReport")}
              >
                Session report
              </button>
            }
          />
          <div className="lt-kpis">
            <Kpi
              label="Running capital"
              value={totals.runningCapital}
              hint="2 pools · 6 slots"
              note={`${money(data.profile.committed)} committed this quarter`}
              prefix="$"
            />
            <Kpi
              label="Pool P&L"
              value={totals.currentPnl}
              hint="both pools, since funding"
              note="paid to the pool ledger, before investor split"
              prefix="+$"
            />
            <Kpi
              label="Pool ROI"
              value={totals.poolRoiPct}
              decimals={1}
              hint="your share ÷ capital"
              note="target band 9–14% per cycle"
              prefix="+"
              suffix="%"
            />
            <Kpi
              label="Your share P&L"
              value={totals.yourSharePnl}
              hint="net of the 20% platform cut"
              note="30% of PKG-01 · 10% of PKG-03"
              className="is-accent"
              prefix="+$"
            />
            <Kpi
              label="Trades executed"
              value={totals.tradesExecuted}
              hint={`${stats.wins} wins · ${stats.losses} losses`}
              note={`${num(stats.volume)} staked today`}
            />
            <article className="lt-kpi is-clock">
              <span className="lt-kpi__label">Last trade</span>
              <b className="lt-kpi__value mono lt-kpi__clock">
                {data.feed[0] ? clockOf(data.feed[0].soldAt) : "—"}
                <span className="lt-kpi__pulse" aria-hidden="true">
                  <Icon name="activity" size={14} />
                </span>
              </b>
              <span className="lt-kpi__hint">
                {data.feed[0]
                  ? `${data.feed[0].symbol} · ${data.feed[0].isWin ? "win" : "loss"} · ${data.feed[0].botName}`
                  : "waiting for the first close"}
              </span>
              <span className="lt-kpi__note">
                {data.feed[0]
                  ? `${durationLabel(data.feed[0].durationSeconds)} hold · ${atStamp(data.feed[0].soldAt)}`
                  : ""}
              </span>
            </article>
          </div>
        </section>

        {/* ── Live feed ── */}
        <section id="lt-feed" className="lt-section">
          <SectionHead
            code="I-5 / 02"
            title="Live trade feed"
            hint="Newest first, windowed to keep the page light. Every row carries the trade, its stake and your share."
            aside={
              <div className="lt-head-actions">
                <Tag tone={paused ? "is-warn" : "is-live"}>
                  {paused ? "Held" : "Streaming"}
                </Tag>
                <button
                  type="button"
                  className="lt-btn"
                  onClick={() => open("filters")}
                >
                  <Icon name="filter" size={13} /> Filters
                  {data.filters.pools.length || data.filters.results.length ? (
                    <span className="lt-count">
                      {data.filters.pools.length + data.filters.results.length}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="lt-btn"
                  onClick={() => open("journal")}
                >
                  <Icon name="file" size={13} /> Journal
                </button>
              </div>
            }
          />

          {data.filters.pools.length ||
          data.filters.results.length ||
          data.filters.query ? (
            <div className="lt-filter-summary">
              <span className="lt-filter-summary__label">Showing</span>
              {data.filters.pools.map((code) => (
                <Tag key={code} tone="is-soft">
                  {code}
                </Tag>
              ))}
              {data.filters.results.map((result) => (
                <Tag
                  key={result}
                  tone={result === "win" ? "is-win" : "is-loss"}
                >
                  {result === "win" ? "Wins" : "Losses"}
                </Tag>
              ))}
              {data.filters.query ? (
                <Tag tone="is-soft">“{data.filters.query}”</Tag>
              ) : null}
              <button
                type="button"
                className="lt-link"
                onClick={() =>
                  void run(
                    {
                      kind: "saveFilters",
                      pools: [],
                      results: [],
                      symbols: [],
                      minStake: 0,
                      query: "",
                    },
                    { keep: true, title: "Filters cleared" },
                  )
                }
              >
                Clear all
              </button>
              <span className="lt-muted">
                {feed.length} of {data.feed.length} trades
              </span>
            </div>
          ) : null}

          <div className="lt-feed" data-density={data.preferences.density}>
            <div className="lt-feed__head">
              <span>Result</span>
              <span>Trade</span>
            </div>
            <ul className="lt-feed__list">
              {visibleFeed.map((row) => (
                <TradeRow
                  key={row.tradeId}
                  trade={row}
                  fresh={
                    data.preferences.rowFlash && row.tradeId === freshTrade
                  }
                  onOpen={() => openTrade(row.tradeId)}
                />
              ))}
              {visibleFeed.length === 0 ? (
                <li className="lt-feed__empty">
                  <b>No trades match this filter</b>
                  <span>
                    Widen the pool or result filter, or clear the search text.
                  </span>
                  <button
                    type="button"
                    className="lt-btn"
                    onClick={() => open("filters")}
                  >
                    Adjust filters
                  </button>
                </li>
              ) : null}
            </ul>
            <div className="lt-feed__foot">
              <span className="lt-muted">
                Showing {visibleFeed.length} of {feed.length} matched trades ·
                the feed keeps the newest 200
              </span>
              {feed.length > visibleFeed.length ? (
                <button
                  type="button"
                  className="lt-btn"
                  onClick={() =>
                    setFeedWindow((prev) =>
                      Math.min(prev + FEED_STEP, feed.length),
                    )
                  }
                >
                  Load {Math.min(FEED_STEP, feed.length - visibleFeed.length)}{" "}
                  more
                </button>
              ) : null}
              {visibleFeed.length > FEED_WINDOW ? (
                <button
                  type="button"
                  className="lt-link"
                  onClick={() => setFeedWindow(FEED_WINDOW)}
                >
                  Collapse window
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Tickers ── */}
        <section id="lt-tickers" className="lt-section">
          <SectionHead
            code="I-5 / 03"
            title="Symbol tickers"
            hint="One tick per second on the synthetic indices your pools trade. Prices are a local simulation of the desk stream."
            aside={
              <button
                type="button"
                className="lt-btn"
                onClick={() => open("streamInfo")}
              >
                Tick cadence
              </button>
            }
          />
          <div className="lt-tickers">
            {data.ticks.map((row) => (
              <button
                key={row.symbol}
                type="button"
                className={`lt-ticker is-${row.direction}`}
                onClick={() => openTicker(row.symbol)}
                data-ticker={row.symbol}
              >
                <span className="lt-ticker__top">
                  <b>{row.symbol}</b>
                  {data.watchlist.includes(row.symbol) ? (
                    <span
                      className="lt-ticker__watch"
                      title="On your watchlist"
                    >
                      <Icon name="eye" size={13} />
                    </span>
                  ) : null}
                </span>
                <span className="lt-ticker__price mono">
                  {num(row.price, row.decimals)}
                </span>
                <span
                  className={`lt-ticker__delta mono ${row.direction === "down" ? "is-neg" : row.direction === "up" ? "is-pos" : ""}`}
                >
                  <Icon
                    name={row.direction === "down" ? "trendDown" : "trendUp"}
                    size={13}
                  />
                  {signedPct(row.changePct)}
                </span>
                <span className="lt-ticker__range mono">
                  H {num(row.sessionHigh, row.decimals)} · L{" "}
                  {num(row.sessionLow, row.decimals)}
                </span>
                <span className="lt-ticker__foot">
                  <span>{row.tickSeconds} tick/s</span>
                  <span>{row.pools.join(", ")}</span>
                </span>
              </button>
            ))}
            <div className="lt-ticker lt-ticker--watch">
              <span className="lt-ticker__top">
                <b>Watchlist</b>
                <Icon name="eye" size={13} />
              </span>
              <span className="lt-watchlist">
                {data.watchlist.length
                  ? data.watchlist.map((symbol) => (
                      <Tag key={symbol} tone="is-soft">
                        {symbol}
                      </Tag>
                    ))
                  : "No symbols watched"}
              </span>
              <span className="lt-ticker__foot">
                <span>{data.ticks.length} symbols streaming</span>
                <span>
                  {num(
                    data.ticks.reduce((sum, row) => sum + row.ticksObserved, 0),
                  )}{" "}
                  ticks
                </span>
              </span>
              <button
                type="button"
                className="lt-link"
                onClick={() => openTicker(data.ticks[0]?.symbol ?? "R_10")}
              >
                Manage watchlist
              </button>
            </div>
          </div>
        </section>

        {/* ── Session statistics ── */}
        <section id="lt-session" className="lt-section">
          <SectionHead
            code="I-5 / 04"
            title="Session statistics"
            hint="Today's closed trades in your pools: hit rate, streaks, extremes and the average hold."
            aside={
              <div className="lt-head-actions">
                <button
                  type="button"
                  className="lt-btn"
                  onClick={() => open("sessionReport")}
                >
                  Report
                </button>
                <button
                  type="button"
                  className="lt-btn"
                  onClick={() => open("exportFeed")}
                >
                  <Icon name="download" size={13} /> Export
                </button>
              </div>
            }
          />
          <div className="lt-stats">
            <Stat
              label="Trades today"
              value={stats.trades}
              hint={`${money(stats.volume)} total stake`}
            />
            <div className="lt-stat lt-stat--rate">
              <span>Win rate</span>
              <b className="mono">{num(stats.winRatePct, 1)}%</b>
              <div
                className="lt-rate"
                role="img"
                aria-label={`${stats.wins} wins and ${stats.losses} losses`}
              >
                <span
                  className="lt-rate__win"
                  style={{
                    width: `${(stats.wins / Math.max(stats.trades, 1)) * 100}%`,
                  }}
                />
              </div>
              <small>
                {stats.wins} wins · {stats.losses} losses
              </small>
            </div>
            <Stat
              label="Net P&L"
              value={signedMoney(stats.pnl)}
              hint="pool profit on this session"
              tone={tone(stats.pnl)}
            />
            <Stat
              label="Your share"
              value={signedMoney(stats.yourShare, 2)}
              hint="after platform cut"
              tone={tone(stats.yourShare)}
            />
            <Stat
              label="Best trade"
              value={stats.best ? signedMoney(stats.best.amount, 2) : "—"}
              hint={stats.best?.note ?? "no closed trades"}
              tone="is-pos"
            />
            <Stat
              label="Worst trade"
              value={stats.worst ? signedMoney(stats.worst.amount, 2) : "—"}
              hint={stats.worst?.note ?? "no closed trades"}
              tone="is-neg"
            />
            <Stat
              label="Longest win streak"
              value={`${stats.longestWinStreak} in a row`}
              hint={`current ${stats.currentStreak.kind === "none" ? "—" : `${stats.currentStreak.kind} ${stats.currentStreak.count}`}`}
            />
            <Stat
              label="Average hold"
              value={durationLabel(stats.avgDurationSeconds)}
              hint={`${stats.longestLossStreak} loss streak at worst`}
            />
          </div>

          <div className="lt-breakdown">
            <div
              className="lt-breakdown__tabs"
              role="tablist"
              aria-label="Session breakdown"
            >
              {(["pool", "symbol", "hour"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={breakdown === key}
                  className={breakdown === key ? "is-active" : ""}
                  onClick={() => setBreakdown(key)}
                >
                  By {key}
                </button>
              ))}
            </div>
            <div className="table-responsive">
              <table className="table lt-table">
                <thead>
                  <tr>
                    <th>
                      {breakdown === "pool"
                        ? "Pool"
                        : breakdown === "symbol"
                          ? "Symbol"
                          : "Hour"}
                    </th>
                    <th>Trades</th>
                    <th>P&L</th>
                    <th>Your share</th>
                    <th className="d-none d-md-table-cell">Share of session</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row) => (
                    <tr key={row.label}>
                      <td>
                        <b className="mono">{row.label}</b>
                      </td>
                      <td className="mono">{row.trades}</td>
                      <td
                        className={`mono ${row.pnl >= 0 ? "is-pos" : "is-neg"}`}
                      >
                        {signedMoney(row.pnl)}
                      </td>
                      <td
                        className={`mono ${row.yourShare >= 0 ? "is-pos" : "is-neg"}`}
                      >
                        {signedMoney(row.yourShare, 2)}
                      </td>
                      <td className="d-none d-md-table-cell">
                        <div className="lt-bar">
                          <span
                            style={{
                              width: `${(row.trades / Math.max(stats.trades, 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="lt-foot-note">
              {stats.trades} trades · recomputed from the feed window, so the
              table and the tiles above can never disagree.
            </p>
          </div>
        </section>

        {/* ── Bots & Guardian ── */}
        <section id="lt-bots" className="lt-section">
          <SectionHead
            code="I-5 / 05"
            title="Bots in your pools"
            hint="Execution state, stake size and today's result per bot. Pausing here is a local preview — the desk keeps running."
            aside={
              <div className="lt-head-actions">
                <Tag tone={openAlerts.length ? "is-warn" : "is-ok"}>
                  {openAlerts.length} Guardian alert
                  {openAlerts.length === 1 ? "" : "s"}
                </Tag>
                <button
                  type="button"
                  className="lt-btn"
                  onClick={() => open("alerts")}
                >
                  <Icon name="shield" size={13} /> Guardian
                </button>
              </div>
            }
          />
          <div className="lt-bots">
            {data.bots.map((row) => (
              <article
                key={row.id}
                className={`lt-bot ${botTone(row.status)}`}
                data-bot={row.id}
              >
                <header>
                  <span className="lt-bot__dot" aria-hidden="true" />
                  <b>{row.name}</b>
                  <Tag tone="is-soft">{row.poolCode}</Tag>
                  <span className="lt-bot__symbol mono">{row.symbol}</span>
                </header>
                <p className="lt-bot__state">
                  <span className={`lt-bot__status ${botTone(row.status)}`}>
                    {botStatusLabel(row.status)}
                  </span>
                  {row.status !== "running" ? (
                    <span className="mono">
                      {row.cooldownSeconds
                        ? ` · ${cooldownLabel(row.cooldownSeconds)} left`
                        : ""}
                    </span>
                  ) : (
                    <span className="mono"> · next trade queued</span>
                  )}
                </p>
                <dl className="lt-bot__grid">
                  <div>
                    <dt>Trades</dt>
                    <dd className="mono">{row.trades}</dd>
                  </div>
                  <div>
                    <dt>Win rate</dt>
                    <dd className="mono">{num(row.winRatePct, 1)}%</dd>
                  </div>
                  <div>
                    <dt>Stake</dt>
                    <dd className="mono">{money(row.stake)}</dd>
                  </div>
                  <div>
                    <dt>Today</dt>
                    <dd
                      className={`mono ${row.pnl >= 0 ? "is-pos" : "is-neg"}`}
                    >
                      {signedMoney(row.pnl)}
                    </dd>
                  </div>
                </dl>
                <p
                  className={`lt-bot__guardian ${levelTone(row.guardianLevel)}`}
                >
                  <Icon name="shield" size={12} /> Guardian{" "}
                  {guardianLabel(row.guardianLevel).toLowerCase()}
                </p>
                <p className="lt-bot__note">{row.note}</p>
                <footer>
                  <button
                    type="button"
                    className="lt-btn lt-btn--sm"
                    onClick={() => openBot(row.id, "botDetail")}
                  >
                    Details
                  </button>
                  {row.status === "running" ? (
                    <button
                      type="button"
                      className="lt-btn lt-btn--sm"
                      onClick={() => openBot(row.id, "pauseBot")}
                    >
                      <Icon name="pause" size={12} /> Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="lt-btn lt-btn--sm"
                      onClick={() =>
                        void run(
                          { kind: "resumeBot", botId: row.id },
                          { keep: true, title: `${row.name} resumed locally` },
                        )
                      }
                    >
                      <Icon name="play" size={12} /> Resume
                    </button>
                  )}
                  <button
                    type="button"
                    className="lt-link"
                    onClick={() => openPool(row.poolId)}
                  >
                    Pool
                  </button>
                </footer>
              </article>
            ))}
          </div>

          <div className="lt-guardian">
            <div className="lt-guardian__head">
              <div>
                <span className="lt-section-code">AI GUARDIAN</span>
                <h3>Alerts in this session</h3>
              </div>
              <button
                type="button"
                className="lt-btn"
                onClick={() => open("guardrails")}
              >
                Guardrails
              </button>
            </div>
            <ul className="lt-alerts">
              {data.alerts.slice(0, 4).map((row) => (
                <li key={row.id} className={`lt-alert ${levelTone(row.level)}`}>
                  <span className={`lt-alert__level ${levelTone(row.level)}`}>
                    {guardianLabel(row.level)}
                  </span>
                  <div className="lt-alert__body">
                    <b>{row.title}</b>
                    <p>{row.detail}</p>
                    <span className="lt-alert__action mono">
                      {row.action} · {clockOf(row.at)} UTC · {row.poolCode}
                    </span>
                  </div>
                  <div className="lt-alert__side">
                    {row.acknowledged ? (
                      <Tag tone="is-ok">Acknowledged</Tag>
                    ) : (
                      <button
                        type="button"
                        className="lt-btn lt-btn--sm"
                        onClick={() =>
                          void run(
                            { kind: "acknowledgeAlert", alertId: row.id },
                            { keep: true, title: "Alert acknowledged locally" },
                          )
                        }
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      className="lt-link"
                      onClick={() => openAlert(row.id)}
                    >
                      Open
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="lt-guardrails">
              {data.guardrails.map((row) => (
                <div key={row.id} className="lt-guardrail">
                  <span className="mono">{row.limit}</span>
                  <b>{row.label}</b>
                  <p>{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="lt-foot">
          <div className="lt-foot__col">
            <b>How this page is wired</b>
            <p>
              Stream events <span className="mono">investor:trade_result</span>,{" "}
              <span className="mono">investor:tick_update</span>,{" "}
              <span className="mono">investor:ai_guardian</span> and{" "}
              <span className="mono">investor:earnings_update</span> all reduce
              into one workspace DTO, so the KPIs, feed, tickers, session stats
              and bot cards move together.
            </p>
          </div>
          <div className="lt-foot__col">
            <b>Boundaries</b>
            <p>
              No socket is opened and no order, pause or payout is transmitted.
              Pausing a bot, acknowledging an alert and exporting a report
              change this browser session only.
            </p>
            <div className="lt-foot__links">
              <button
                type="button"
                className="lt-link"
                onClick={() => open("help")}
              >
                Workspace boundaries
              </button>
              <button
                type="button"
                className="lt-link"
                onClick={() => open("shortcuts")}
              >
                Keyboard shortcuts
              </button>
              <button
                type="button"
                className="lt-link"
                onClick={() => open("earnings")}
              >
                How your share is paid
              </button>
              <Link className="lt-link" href="/investor/pools">
                Crowdfunding pools
              </Link>
            </div>
          </div>
          <p className="lt-foot__meta">
            Revision r{data.revision} · snapshot {atStamp(data.asOf)} · stream
            latency {data.stream.latencyMs} ms · {data.stream.droppedEvents}{" "}
            dropped events · {data.audit.length} local change
            {data.audit.length === 1 ? "" : "s"}
          </p>
        </footer>

        {/* ── Inspector drawer ── */}
        {drawer ? (
          <div
            className="op-drawer-backdrop lt-drawer-layer"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <aside
              className="op-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Session inspector"
            >
              <div className="op-drawer__head">
                <div>
                  <span className="lt-section-code">
                    I-5 / SESSION INSPECTOR
                  </span>
                  <h2 className="op-drawer__title">Live session</h2>
                  <p className="lt-muted">
                    {paused ? "Stream held" : "Streaming"} · {clockOf(clock)}{" "}
                    UTC · {data.feed.length} trades buffered
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
                className="lt-drawer-tabs"
                role="tablist"
                aria-label="Inspector views"
              >
                {(["overview", "feed", "bots"] as const).map((tab) => (
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
                      : tab === "feed"
                        ? "Feed"
                        : "Bots"}
                  </button>
                ))}
              </div>
              <div className="op-drawer__body">
                {drawer === "overview" ? (
                  <>
                    <div className="lt-drawer-grid">
                      <div>
                        <span>CAPITAL</span>
                        <b className="mono">{money(totals.runningCapital)}</b>
                      </div>
                      <div>
                        <span>POOL P&L</span>
                        <b className="mono is-pos">
                          {signedMoney(totals.currentPnl)}
                        </b>
                      </div>
                      <div>
                        <span>YOUR SHARE</span>
                        <b className="mono is-pos">
                          {signedMoney(totals.yourSharePnl, 2)}
                        </b>
                      </div>
                    </div>
                    <dl className="lt-kv">
                      <div>
                        <dt>Session clock</dt>
                        <dd className="mono">{clockOf(clock)} UTC</dd>
                      </div>
                      <div>
                        <dt>Uptime</dt>
                        <dd className="mono">{spanLabel(uptime)}</dd>
                      </div>
                      <div>
                        <dt>Events</dt>
                        <dd className="mono">
                          {data.stream.eventsPerMinute}/min
                        </dd>
                      </div>
                      <div>
                        <dt>Open alerts</dt>
                        <dd className="mono">{openAlerts.length}</dd>
                      </div>
                    </dl>
                    <div className="lt-drawer-pools">
                      {data.pools.map((row) => (
                        <button
                          key={row.poolId}
                          type="button"
                          className="lt-drawer-pool"
                          onClick={() => openPool(row.poolId)}
                        >
                          <span>
                            <b className="mono">{row.code}</b>
                            <small>{row.name}</small>
                          </span>
                          <span className="mono">
                            {poolLabel(row.status)} ·{" "}
                            {signedMoney(row.yourSharePnl, 2)}
                          </span>
                        </button>
                      ))}
                    </div>
                    <h4 className="lt-subhead">Recent closes</h4>
                    <ul className="lt-drawer-feed">
                      {data.feed.slice(0, 3).map((row) => (
                        <li key={row.tradeId}>
                          <button
                            type="button"
                            onClick={() => openTrade(row.tradeId)}
                          >
                            <span
                              className={`lt-drawer-feed__dot ${row.isWin ? "is-win" : "is-loss"}`}
                            />
                            <span>
                              <b className="mono">{row.symbol}</b>{" "}
                              {row.contractLabel}
                              <small>
                                {row.poolCode} · {row.botName} ·{" "}
                                {clockOf(row.soldAt)}
                              </small>
                            </span>
                            <b
                              className={`mono ${row.isWin ? "is-pos" : "is-neg"}`}
                            >
                              {signedMoney(row.yourShareNet, 2)}
                            </b>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <h4 className="lt-subhead">
                      Guardian · {openAlerts.length} open
                    </h4>
                    <ul className="lt-drawer-alerts">
                      {openAlerts.length ? (
                        openAlerts.slice(0, 3).map((row) => (
                          <li key={row.id} className={levelTone(row.level)}>
                            <span
                              className={`lt-alert__level ${levelTone(row.level)}`}
                            >
                              {guardianLabel(row.level)}
                            </span>
                            <div>
                              <b>{row.title}</b>
                              <small className="mono">
                                {row.poolCode} · {clockOf(row.at)} UTC
                              </small>
                            </div>
                            <button
                              type="button"
                              className="lt-link"
                              onClick={() => openAlert(row.id)}
                            >
                              Open
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="lt-drawer-alerts__empty">
                          Nothing open — Guardian has not paused anything since
                          the last batch.
                        </li>
                      )}
                    </ul>
                    <div className="lt-drawer-actions">
                      <button
                        type="button"
                        className="lt-btn"
                        onClick={() => open("preferences")}
                      >
                        Preferences
                      </button>
                      <button
                        type="button"
                        className="lt-btn"
                        onClick={() => open("exportFeed")}
                      >
                        Export
                      </button>
                      <button
                        type="button"
                        className="lt-btn"
                        onClick={() => open("guardrails")}
                      >
                        Guardrails
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "feed" ? (
                  <>
                    <p className="lt-muted">
                      Latest {Math.min(6, data.feed.length)} closes. The full
                      list lives on the page and in the journal.
                    </p>
                    <ul className="lt-drawer-feed">
                      {data.feed.slice(0, 6).map((row) => (
                        <li key={row.tradeId}>
                          <button
                            type="button"
                            onClick={() => openTrade(row.tradeId)}
                          >
                            <span
                              className={`lt-drawer-feed__dot ${row.isWin ? "is-win" : "is-loss"}`}
                            />
                            <span>
                              <b className="mono">{row.symbol}</b>{" "}
                              {row.contractLabel}
                              <small>
                                {row.poolCode} · {row.botName} ·{" "}
                                {clockOf(row.soldAt)}
                              </small>
                            </span>
                            <b
                              className={`mono ${row.isWin ? "is-pos" : "is-neg"}`}
                            >
                              {signedMoney(row.yourShareNet, 2)}
                            </b>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="lt-drawer-actions">
                      <button
                        type="button"
                        className="lt-btn"
                        onClick={() => open("journal")}
                      >
                        Open journal
                      </button>
                      <button
                        type="button"
                        className="lt-btn"
                        onClick={() => open("filters")}
                      >
                        Filters
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "bots" ? (
                  <>
                    {data.bots.map((row) => (
                      <div
                        key={row.id}
                        className={`lt-drawer-bot ${botTone(row.status)}`}
                      >
                        <div>
                          <b>{row.name}</b>
                          <small>
                            {row.poolCode} · {botStatusLabel(row.status)} ·{" "}
                            {row.trades} trades
                          </small>
                        </div>
                        <div className="lt-drawer-bot__actions">
                          <b
                            className={`mono ${row.pnl >= 0 ? "is-pos" : "is-neg"}`}
                          >
                            {signedMoney(row.pnl)}
                          </b>
                          <button
                            type="button"
                            className="lt-btn lt-btn--sm"
                            onClick={() => openBot(row.id, "botDetail")}
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="lt-drawer-actions">
                      <button
                        type="button"
                        className="lt-btn"
                        onClick={() => open("alerts")}
                      >
                        Guardian alerts
                      </button>
                      <button
                        type="button"
                        className="lt-btn"
                        onClick={() => open("alerts")}
                      >
                        Alert rules
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        {/* ── Modals ── */}
        {modal ? (
          <div className="lt-modal-layer">
            <DeskModalShell
              code="I-5"
              eyebrow="INVESTOR WORKSPACE / LOCAL PREVIEW"
              title={titles[modal.kind]}
              subtitle="Structured session state. Socket delivery, order routing, bot control and report delivery require authenticated backend integration."
              size={modalSize[modal.kind] ?? "md"}
              onClose={close}
              steps={wizard}
              currentStep={wizardStep}
              footer={modalFooter}
            >
              {error ? (
                <p className="lt-error" role="alert">
                  {error}
                </p>
              ) : null}

              {modal.kind === "tradeDetail" && trade ? (
                <>
                  <div className="lt-modal-headline">
                    <Tag tone={trade.isWin ? "is-win" : "is-loss"}>
                      {trade.isWin ? "Win" : "Loss"}
                    </Tag>
                    <b className="mono">{trade.tradeId}</b>
                    <span className="lt-muted">
                      {trade.poolCode} · {clockOf(trade.soldAt)} UTC
                    </span>
                  </div>
                  <dl className="lt-kv lt-kv--rows">
                    <div>
                      <dt>Symbol &amp; contract</dt>
                      <dd className="mono">
                        {trade.symbol} · {trade.contractLabel}
                      </dd>
                    </div>
                    <div>
                      <dt>Entry → exit</dt>
                      <dd className="mono">
                        {num(trade.entrySpot, 2)} → {num(trade.exitSpot, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Stake → payout</dt>
                      <dd className="mono">
                        {money(trade.stake)} →{" "}
                        {trade.isWin ? money(trade.payout) : "$0"}
                      </dd>
                    </div>
                    <div>
                      <dt>Trade P&L</dt>
                      <dd
                        className={`mono ${trade.profit >= 0 ? "is-pos" : "is-neg"}`}
                      >
                        {signedMoney(trade.profit)}
                      </dd>
                    </div>
                    <div>
                      <dt>Your share ({trade.yourSharePct}%)</dt>
                      <dd className="mono">
                        gross {signedMoney(trade.yourShareGross, 2)} · cut{" "}
                        {signedMoney(-trade.platformCut, 2)} · net{" "}
                        <b
                          className={
                            trade.yourShareNet >= 0 ? "is-pos" : "is-neg"
                          }
                        >
                          {signedMoney(trade.yourShareNet, 2)}
                        </b>
                      </dd>
                    </div>
                    <div>
                      <dt>Bought / sold</dt>
                      <dd className="mono">
                        {atStamp(trade.boughtAt)} → {clockOf(trade.soldAt)}
                      </dd>
                    </div>
                    <div>
                      <dt>Hold</dt>
                      <dd className="mono">
                        {durationLabel(trade.durationSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt>Bot</dt>
                      <dd>
                        <button
                          type="button"
                          className="lt-link"
                          onClick={() => openBot(trade.botId)}
                        >
                          {trade.botName}
                        </button>
                      </dd>
                    </div>
                  </dl>
                  <div className="lt-modal-actions">
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => void copy(trade.tradeId, "Trade id")}
                    >
                      <Icon name="copy" size={13} /> Copy id
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => openPool(trade.poolId)}
                    >
                      Pool detail
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("earnings")}
                    >
                      How the share is paid
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "tickerDetail" && ticker ? (
                <>
                  <div className="lt-modal-headline">
                    <b className="mono">{ticker.symbol}</b>
                    <Tag
                      tone={ticker.direction === "down" ? "is-loss" : "is-win"}
                    >
                      {signedPct(ticker.changePct)}
                    </Tag>
                    <span className="lt-muted">
                      {ticker.tickSeconds} tick/s · {num(ticker.ticksObserved)}{" "}
                      ticks observed
                    </span>
                  </div>
                  <dl className="lt-kv">
                    <div>
                      <dt>Last price</dt>
                      <dd className="mono">
                        {num(ticker.price, ticker.decimals)}
                      </dd>
                    </div>
                    <div>
                      <dt>Previous tick</dt>
                      <dd className="mono">
                        {num(ticker.previous, ticker.decimals)}
                      </dd>
                    </div>
                    <div>
                      <dt>Session high</dt>
                      <dd className="mono">
                        {num(ticker.sessionHigh, ticker.decimals)}
                      </dd>
                    </div>
                    <div>
                      <dt>Session low</dt>
                      <dd className="mono">
                        {num(ticker.sessionLow, ticker.decimals)}
                      </dd>
                    </div>
                    <div>
                      <dt>Last tick</dt>
                      <dd className="mono">{atStamp(ticker.lastTickAt)}</dd>
                    </div>
                    <div>
                      <dt>Traded in</dt>
                      <dd className="mono">{ticker.pools.join(", ")}</dd>
                    </div>
                  </dl>
                  <p className="lt-note">
                    {ticker.symbol} carries{" "}
                    {
                      data.feed.filter((row) => row.symbol === ticker.symbol)
                        .length
                    }{" "}
                    of today's {data.feed.length} trades. Prices in this
                    workspace are simulated at one tick per second; the desk
                    stream is the only real source.
                  </p>
                  <div className="lt-modal-actions">
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() =>
                        void run(
                          { kind: "toggleWatch", symbol: ticker.symbol },
                          {
                            keep: true,
                            title: data.watchlist.includes(ticker.symbol)
                              ? `${ticker.symbol} removed from watchlist`
                              : `${ticker.symbol} added to watchlist`,
                          },
                        )
                      }
                    >
                      <Icon name="eye" size={13} />
                      {data.watchlist.includes(ticker.symbol)
                        ? "Unwatch"
                        : "Watch"}
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("streamInfo")}
                    >
                      Stream diagnostics
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "botDetail" && bot ? (
                <>
                  <div className="lt-modal-headline">
                    <span className={`lt-bot__dot ${botTone(bot.status)}`} />
                    <b>{bot.name}</b>
                    <Tag tone="is-soft">{bot.poolCode}</Tag>
                    <Tag tone={bot.status === "running" ? "is-ok" : "is-warn"}>
                      {botStatusLabel(bot.status)}
                    </Tag>
                  </div>
                  <dl className="lt-kv">
                    <div>
                      <dt>Trades today</dt>
                      <dd className="mono">{bot.trades}</dd>
                    </div>
                    <div>
                      <dt>Wins</dt>
                      <dd className="mono">
                        {bot.wins} · {num(bot.winRatePct, 1)}%
                      </dd>
                    </div>
                    <div>
                      <dt>Stake size</dt>
                      <dd className="mono">{money(bot.stake)}</dd>
                    </div>
                    <div>
                      <dt>Today&apos;s P&L</dt>
                      <dd
                        className={`mono ${bot.pnl >= 0 ? "is-pos" : "is-neg"}`}
                      >
                        {signedMoney(bot.pnl)}
                      </dd>
                    </div>
                    <div>
                      <dt>Loss streak</dt>
                      <dd className="mono">{bot.lossStreak}</dd>
                    </div>
                    <div>
                      <dt>Cooldown</dt>
                      <dd className="mono">
                        {bot.cooldownSeconds
                          ? cooldownLabel(bot.cooldownSeconds)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Last action</dt>
                      <dd className="mono">{atStamp(bot.lastActionAt)}</dd>
                    </div>
                  </dl>
                  <p className="lt-note">{bot.note}</p>
                  <div className="lt-modal-actions">
                    {bot.status === "running" ? (
                      <button
                        type="button"
                        className="lt-btn"
                        onClick={() => openBot(bot.id, "pauseBot")}
                      >
                        <Icon name="pause" size={13} /> Pause bot
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="lt-btn"
                        disabled={bot.guardianLevel === "alert"}
                        onClick={() =>
                          void run(
                            { kind: "resumeBot", botId: bot.id },
                            {
                              keep: true,
                              title: `${bot.name} resumed locally`,
                            },
                          )
                        }
                      >
                        <Icon name="play" size={13} /> Resume bot
                      </button>
                    )}
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => openPool(bot.poolId)}
                    >
                      Pool
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("alerts")}
                    >
                      Guardian history
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "poolDetail" && pool ? (
                <>
                  <div className="lt-modal-headline">
                    <b className="mono">{pool.code}</b>
                    <span>{pool.name}</span>
                    <Tag tone={pool.status === "trading" ? "is-ok" : "is-warn"}>
                      {poolLabel(pool.status)}
                    </Tag>
                  </div>
                  <dl className="lt-kv">
                    <div>
                      <dt>Your capital</dt>
                      <dd className="mono">{money(pool.yourInvestment)}</dd>
                    </div>
                    <div>
                      <dt>Slots · share</dt>
                      <dd className="mono">
                        {pool.yourSlots} · {pool.yourSharePct}%
                      </dd>
                    </div>
                    <div>
                      <dt>Pool P&L</dt>
                      <dd
                        className={`mono ${pool.poolPnl >= 0 ? "is-pos" : "is-neg"}`}
                      >
                        {signedMoney(pool.poolPnl)}
                      </dd>
                    </div>
                    <div>
                      <dt>Your share P&L</dt>
                      <dd
                        className={`mono ${pool.yourSharePnl >= 0 ? "is-pos" : "is-neg"}`}
                      >
                        {signedMoney(pool.yourSharePnl, 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Pool trades</dt>
                      <dd className="mono">
                        {pool.poolTrades} · {num(pool.poolWinRatePct, 1)}% win
                      </dd>
                    </div>
                    <div>
                      <dt>Risk band</dt>
                      <dd>{pool.riskBand}</dd>
                    </div>
                    <div>
                      <dt>Ends</dt>
                      <dd className="mono">{atStamp(pool.endsAt)}</dd>
                    </div>
                  </dl>
                  <p className="lt-note">{pool.guardianNote}</p>
                  <div className="lt-modal-actions">
                    <Link
                      className="lt-btn"
                      href={`/investor/pools/${pool.poolId}`}
                    >
                      Pool detail page
                    </Link>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() =>
                        void run(
                          pool.status === "paused"
                            ? { kind: "resumePool", poolId: pool.poolId }
                            : {
                                kind: "pausePool",
                                poolId: pool.poolId,
                                reason: "review",
                              },
                          {
                            keep: true,
                            title:
                              pool.status === "paused"
                                ? `${pool.code} resumed locally`
                                : `${pool.code} paused locally`,
                          },
                        )
                      }
                    >
                      {pool.status === "paused"
                        ? "Resume locally"
                        : "Pause locally"}
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => {
                        filterForm.setFieldValue("pools", [pool.code]);
                        open("filters");
                      }}
                    >
                      Filter feed to {pool.code}
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "pauseBot" && bot ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <p className="lt-note">
                        {bot.name} runs in {bot.poolCode} at {money(bot.stake)}{" "}
                        per trade. A pause here changes this browser session
                        only — it is the shape of the request the desk would
                        receive, not a routed instruction.
                      </p>
                      <fieldset className="lt-fieldset">
                        <legend>Pause window</legend>
                        {([5, 15, 60, 240] as const).map((minutes) => (
                          <label key={minutes} className="lt-radio">
                            <input
                              type="radio"
                              name="pause-minutes"
                              checked={pauseMinutes === minutes}
                              onChange={() => setPauseMinutes(minutes)}
                            />
                            <span>
                              <b>
                                {minutes < 60
                                  ? `${minutes} minutes`
                                  : `${minutes / 60} hours`}
                              </b>
                              <small>
                                {minutes <= 15
                                  ? "Short hold; bot keeps its place in the queue."
                                  : "Long hold; the desk rebalances stake size on resume."}
                              </small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <dl className="lt-kv">
                        <div>
                          <dt>Current state</dt>
                          <dd className="mono">{botStatusLabel(bot.status)}</dd>
                        </div>
                        <div>
                          <dt>Trades today</dt>
                          <dd className="mono">{bot.trades}</dd>
                        </div>
                        <div>
                          <dt>Today&apos;s P&L</dt>
                          <dd className="mono">{signedMoney(bot.pnl)}</dd>
                        </div>
                      </dl>
                    </>
                  ) : null}
                  {wizardStep === 1 ? (
                    <fieldset className="lt-fieldset">
                      <legend>Reason</legend>
                      {(
                        [
                          [
                            "review",
                            "Reviewing performance",
                            "You want to read the feed before it trades again.",
                          ],
                          [
                            "travel",
                            "Away from the desk",
                            "No monitoring window; stop until you are back.",
                          ],
                          [
                            "volatility",
                            "Volatility",
                            "The symbol is moving outside its usual band.",
                          ],
                          [
                            "other",
                            "Something else",
                            "Note it for your own audit trail.",
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label key={value} className="lt-radio">
                          <input
                            type="radio"
                            name="pause-reason"
                            checked={pauseReason === value}
                            onChange={() => setPauseReason(value)}
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
                    <div className="lt-review">
                      <div>
                        <span>Bot</span>
                        <b>{bot.name}</b>
                      </div>
                      <div>
                        <span>Pool</span>
                        <b className="mono">{bot.poolCode}</b>
                      </div>
                      <div>
                        <span>Hold</span>
                        <b className="mono">{pauseMinutes} min</b>
                      </div>
                      <div>
                        <span>Reason</span>
                        <b>{pauseReason}</b>
                      </div>
                      <p>
                        The bot&apos;s open positions stay untouched; only new
                        entries are blocked. Guardian cooldowns still apply when
                        the window ends.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "preferences" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <label className="lt-toggle">
                        <input
                          type="checkbox"
                          checked={prefAutoScroll}
                          onChange={(event) =>
                            setPrefAutoScroll(event.target.checked)
                          }
                        />
                        <span>
                          <b>Auto-scroll new trades</b>
                          <small>
                            Keep the newest row in view as the window grows.
                          </small>
                        </span>
                      </label>
                      <label className="lt-toggle">
                        <input
                          type="checkbox"
                          checked={prefFlash}
                          onChange={(event) =>
                            setPrefFlash(event.target.checked)
                          }
                        />
                        <span>
                          <b>Flash arriving rows</b>
                          <small>
                            800 ms win/loss flash on each new close.
                          </small>
                        </span>
                      </label>
                      <label className="lt-toggle">
                        <input
                          type="checkbox"
                          checked={prefSound}
                          onChange={(event) =>
                            setPrefSound(event.target.checked)
                          }
                        />
                        <span>
                          <b>Sound cue</b>
                          <small>
                            Reserved for the desktop client; silent in the
                            browser.
                          </small>
                        </span>
                      </label>
                      <fieldset className="lt-fieldset">
                        <legend>Row density</legend>
                        {(["comfortable", "compact"] as const).map(
                          (density) => (
                            <label key={density} className="lt-radio">
                              <input
                                type="radio"
                                name="density"
                                checked={prefDensity === density}
                                onChange={() => setPrefDensity(density)}
                              />
                              <span>
                                <b>
                                  {density === "comfortable"
                                    ? "Comfortable"
                                    : "Compact"}
                                </b>
                                <small>
                                  {density === "comfortable"
                                    ? "Two lines per trade with full detail."
                                    : "Single line, more trades on screen."}
                                </small>
                              </span>
                            </label>
                          ),
                        )}
                      </fieldset>
                    </>
                  ) : (
                    <div className="lt-review">
                      <div>
                        <span>Auto-scroll</span>
                        <b>{prefAutoScroll ? "On" : "Off"}</b>
                      </div>
                      <div>
                        <span>Row flash</span>
                        <b>{prefFlash ? "On" : "Off"}</b>
                      </div>
                      <div>
                        <span>Sound</span>
                        <b>{prefSound ? "On" : "Off"}</b>
                      </div>
                      <div>
                        <span>Density</span>
                        <b>{prefDensity}</b>
                      </div>
                      <p>
                        Stored in this session only; the desk keeps its own
                        defaults.
                      </p>
                    </div>
                  )}
                </>
              ) : null}

              {modal.kind === "alertRules" ? (
                <>
                  {wizardStep === 0 ? (
                    <>
                      <p className="lt-note">
                        Alert when a single trade moves more than the threshold
                        in your share. Existing rules fire on the same window.
                      </p>
                      <label className="lt-field">
                        <span>Threshold (USD)</span>
                        <input
                          type="number"
                          min={1}
                          max={100000}
                          step={5}
                          value={ruleThreshold}
                          onChange={(event) =>
                            setRuleThreshold(Number(event.target.value))
                          }
                        />
                      </label>
                      <ul className="lt-rule-list">
                        {data.rules.map((rule) => (
                          <li key={rule.id}>
                            <b className="mono">${rule.threshold}</b>
                            <span>{rule.note}</span>
                            <small className="mono">
                              {atStamp(rule.createdAt)}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {wizardStep === 1 ? (
                    <>
                      <fieldset className="lt-fieldset">
                        <legend>Channel</legend>
                        {(
                          [
                            [
                              "in_app",
                              "In-app only",
                              "Banner and bell inside this workspace.",
                            ],
                            [
                              "email",
                              "Email",
                              "Sent by the desk once delivery is wired.",
                            ],
                          ] as const
                        ).map(([value, label, hint]) => (
                          <label key={value} className="lt-radio">
                            <input
                              type="radio"
                              name="rule-channel"
                              checked={ruleChannel === value}
                              onChange={() => setRuleChannel(value)}
                            />
                            <span>
                              <b>{label}</b>
                              <small>{hint}</small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <fieldset className="lt-fieldset">
                        <legend>Scope</legend>
                        {(
                          [
                            [
                              "your-pools",
                              "Your pools only",
                              "PKG-01 and PKG-03 today.",
                            ],
                            [
                              "all-pools",
                              "Every pool you can see",
                              "Broader, noisier.",
                            ],
                          ] as const
                        ).map(([value, label, hint]) => (
                          <label key={value} className="lt-radio">
                            <input
                              type="radio"
                              name="rule-matches"
                              checked={ruleMatches === value}
                              onChange={() => setRuleMatches(value)}
                            />
                            <span>
                              <b>{label}</b>
                              <small>{hint}</small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    </>
                  ) : null}
                  {wizardStep === 2 ? (
                    <div className="lt-review">
                      <div>
                        <span>Threshold</span>
                        <b className="mono">${ruleThreshold}</b>
                      </div>
                      <div>
                        <span>Channel</span>
                        <b>{ruleChannel === "email" ? "Email" : "In-app"}</b>
                      </div>
                      <div>
                        <span>Scope</span>
                        <b>
                          {ruleMatches === "your-pools"
                            ? "Your pools"
                            : "All pools"}
                        </b>
                      </div>
                      <p>
                        Nothing is sent today. The rule is stored in this
                        browser session.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "exportFeed" ? (
                <>
                  {wizardStep === 0 ? (
                    <fieldset className="lt-fieldset">
                      <legend>What to export</legend>
                      {(
                        [
                          [
                            "trade-feed",
                            "Trade feed",
                            `${feed.length} trades in the current window`,
                          ],
                          [
                            "session-stats",
                            "Session statistics",
                            `${stats.trades} trades · ${num(stats.winRatePct, 1)}% win`,
                          ],
                          [
                            "bot-report",
                            "Bot report",
                            `${data.bots.length} bots with stake and P&L`,
                          ],
                          [
                            "guardian-log",
                            "Guardian log",
                            `${data.alerts.length} alerts`,
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label key={value} className="lt-radio">
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
                  ) : null}
                  {wizardStep === 1 ? (
                    <fieldset className="lt-fieldset">
                      <legend>Format</legend>
                      {(
                        [
                          [
                            "csv",
                            "CSV",
                            "Spreadsheet-ready, one row per record.",
                          ],
                          [
                            "json",
                            "JSON",
                            "Structured DTO for your own tooling.",
                          ],
                          [
                            "pdf",
                            "PDF",
                            "Statement-style summary for your records.",
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label key={value} className="lt-radio">
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
                    <div className="lt-review">
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
                          {exportScope === "trade-feed"
                            ? feed.length
                            : exportScope === "bot-report"
                              ? data.bots.length
                              : exportScope === "guardian-log"
                                ? data.alerts.length
                                : stats.byPool.length + stats.bySymbol.length}
                        </b>
                      </div>
                      <p>
                        Nothing leaves your browser: the file is described here
                        and would be generated client-side in production too.
                      </p>
                    </div>
                  ) : null}
                  {data.exports.length ? (
                    <p className="lt-foot-note">
                      Last export: {data.exports[0].scope} ·{" "}
                      {data.exports[0].format.toUpperCase()} ·{" "}
                      {data.exports[0].count} row(s) ·{" "}
                      {clockOf(data.exports[0].createdAt)} UTC
                    </p>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "support" ? (
                <>
                  {wizardStep === 0 ? (
                    <fieldset className="lt-fieldset">
                      <legend>Topic</legend>
                      {(
                        [
                          [
                            "trade",
                            "A specific trade",
                            "Prices, payout or your share on one close.",
                          ],
                          [
                            "bot",
                            "Bot behaviour",
                            "Stake size, cooldown or why a bot paused.",
                          ],
                          [
                            "payout",
                            "Payout timing",
                            "When a share reaches your wallet.",
                          ],
                          [
                            "guardian",
                            "Guardian decision",
                            "A pause you want reviewed.",
                          ],
                          [
                            "other",
                            "Something else",
                            "Anything not covered above.",
                          ],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <label key={value} className="lt-radio">
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
                    <label className="lt-field">
                      <span>Message</span>
                      <textarea
                        rows={5}
                        value={supportMessage}
                        onChange={(event) =>
                          setSupportMessage(event.target.value)
                        }
                        placeholder="What should the desk look at? Include a trade id if you have one."
                      />
                      <small className="lt-muted">
                        {supportMessage.trim().length}/1000 characters · at
                        least 12
                      </small>
                    </label>
                  ) : null}
                  {wizardStep === 2 ? (
                    <div className="lt-review">
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
                </>
              ) : null}

              {modal.kind === "filters" ? (
                <>
                  {wizardStep === 0 ? (
                    <filterForm.Subscribe selector={(state) => state.values}>
                      {(values) => (
                        <>
                          <fieldset className="lt-fieldset">
                            <legend>Pools</legend>
                            {data.pools.map((row) => (
                              <label key={row.poolId} className="lt-check">
                                <input
                                  type="checkbox"
                                  checked={values.pools.includes(row.code)}
                                  onChange={(event) =>
                                    filterForm.setFieldValue(
                                      "pools",
                                      event.target.checked
                                        ? [...values.pools, row.code]
                                        : values.pools.filter(
                                            (code) => code !== row.code,
                                          ),
                                    )
                                  }
                                />
                                <span>
                                  {row.code} · {row.name}
                                </span>
                              </label>
                            ))}
                          </fieldset>
                          <fieldset className="lt-fieldset">
                            <legend>Result</legend>
                            {(["win", "loss"] as const).map((result) => (
                              <label key={result} className="lt-check">
                                <input
                                  type="checkbox"
                                  checked={values.results.includes(result)}
                                  onChange={(event) =>
                                    filterForm.setFieldValue(
                                      "results",
                                      event.target.checked
                                        ? [...values.results, result]
                                        : values.results.filter(
                                            (row) => row !== result,
                                          ),
                                    )
                                  }
                                />
                                <span>
                                  {result === "win" ? "Wins" : "Losses"}
                                </span>
                              </label>
                            ))}
                          </fieldset>
                        </>
                      )}
                    </filterForm.Subscribe>
                  ) : null}
                  {wizardStep === 1 ? (
                    <filterForm.Subscribe selector={(state) => state.values}>
                      {(values) => (
                        <label className="lt-field">
                          <span>Search trades</span>
                          <input
                            value={values.query}
                            onChange={(event) =>
                              filterForm.setFieldValue(
                                "query",
                                event.target.value,
                              )
                            }
                            placeholder="R_10, Rise, Bot-Alpha, PKG-01, trade id"
                          />
                          <small className="lt-muted">
                            Matches symbol, contract, bot, pool code and trade
                            id.
                          </small>
                        </label>
                      )}
                    </filterForm.Subscribe>
                  ) : null}
                  {wizardStep === 2 ? (
                    <div className="lt-review">
                      <div>
                        <span>Pools</span>
                        <b>
                          {data.filters.pools.length
                            ? data.filters.pools.join(", ")
                            : "All"}
                        </b>
                      </div>
                      <div>
                        <span>Results</span>
                        <b>
                          {filterForm.state.values.results.length
                            ? filterForm.state.values.results.join(", ")
                            : "All"}
                        </b>
                      </div>
                      <div>
                        <span>Search</span>
                        <b>{filterForm.state.values.query || "—"}</b>
                      </div>
                      <p>
                        Applied to this browser session. The feed window resets
                        to the newest trades that match.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {modal.kind === "journal" ? (
                <>
                  <div className="lt-toolbar">
                    <label className="lt-search">
                      <Icon name="search" size={14} />
                      <input
                        value={journalQuery}
                        onChange={(event) =>
                          setJournalQuery(event.target.value)
                        }
                        placeholder="Search the session"
                        aria-label="Search the session journal"
                      />
                    </label>
                    <span className="lt-muted">
                      {journalRows.length} of {data.feed.length} trades
                    </span>
                  </div>
                  <div className="table-responsive lt-table-wrap">
                    <table className="table lt-table">
                      <thead>
                        {journalTable.getHeaderGroups().map((group) => (
                          <tr key={group.id}>
                            {group.headers.map((header) => (
                              <th key={header.id}>
                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  disabled={!header.column.getCanSort()}
                                >
                                  <journalTable.FlexRender header={header} />
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
                        {journalTable.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            className="is-clickable"
                            onClick={() => openTrade(row.original.tradeId)}
                          >
                            {row.getAllCells().map((cell) => (
                              <td key={cell.id}>
                                <journalTable.FlexRender cell={cell} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {journalTable.getRowModel().rows.length ? null : (
                    <p className="lt-empty-line">
                      No trades match “{journalQuery}”. Clear the search to see
                      the session.
                    </p>
                  )}
                  <p className="lt-foot-note">
                    {stats.trades} closed trades · {money(stats.volume)} staked
                    · {signedMoney(stats.pnl)} net ·{" "}
                    {signedMoney(stats.yourShare, 2)} your share
                  </p>
                </>
              ) : null}

              {modal.kind === "streamInfo" ? (
                <>
                  <dl className="lt-kv">
                    <div>
                      <dt>Stream id</dt>
                      <dd className="mono">{data.stream.id}</dd>
                    </div>
                    <div>
                      <dt>Region</dt>
                      <dd className="mono">{data.stream.region}</dd>
                    </div>
                    <div>
                      <dt>Latency</dt>
                      <dd className="mono">{data.stream.latencyMs} ms</dd>
                    </div>
                    <div>
                      <dt>Connected</dt>
                      <dd className="mono">
                        {atStamp(data.stream.connectedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt>Uptime</dt>
                      <dd className="mono">{spanLabel(uptime)}</dd>
                    </div>
                    <div>
                      <dt>Events</dt>
                      <dd className="mono">
                        {data.stream.eventsPerMinute}/min
                      </dd>
                    </div>
                    <div>
                      <dt>Reconnects</dt>
                      <dd className="mono">{data.stream.reconnects}</dd>
                    </div>
                    <div>
                      <dt>Dropped</dt>
                      <dd className="mono">{data.stream.droppedEvents}</dd>
                    </div>
                  </dl>
                  <div className="lt-table-wrap table-responsive">
                    <table className="table lt-table">
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Payload</th>
                          <th>Reduced into</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="mono">investor:trade_result</td>
                          <td>
                            tradeId, poolId, symbol, contractType, stake,
                            payout, profit, isWin, entrySpot, exitSpot,
                            boughtAt, soldAt, botName, yourShareImpact,
                            yourShareGross, platformCut, yourShareNet
                          </td>
                          <td>Feed, KPIs, session stats, bot cards</td>
                        </tr>
                        <tr>
                          <td className="mono">investor:tick_update</td>
                          <td>
                            symbol, price, changePct, direction, lastTickAt
                          </td>
                          <td>Ticker grid, trade entry prices</td>
                        </tr>
                        <tr>
                          <td className="mono">investor:ai_guardian</td>
                          <td>
                            alertId, level, poolId, botId, title, detail, action
                          </td>
                          <td>Guardian list, bot state</td>
                        </tr>
                        <tr>
                          <td className="mono">investor:earnings_update</td>
                          <td>yourSharePnl, settledAt</td>
                          <td>Share KPI, pool ledger</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="lt-modal-actions">
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() =>
                        void copy(
                          `wss://stream.trademo.local/investor/${data.stream.id}`,
                          "Stream endpoint",
                        )
                      }
                    >
                      <Icon name="copy" size={13} /> Copy endpoint
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => {
                        refresh();
                        pushToast({
                          tone: "info",
                          title: "Ping sent to the local buffer",
                          detail: `Round trip ${data.stream.latencyMs} ms (simulated).`,
                        });
                      }}
                    >
                      Ping buffer
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "sessionReport" ? (
                <>
                  <div className="lt-report">
                    <div>
                      <span>Trades</span>
                      <b className="mono">{stats.trades}</b>
                    </div>
                    <div>
                      <span>Win rate</span>
                      <b className="mono">{num(stats.winRatePct, 1)}%</b>
                    </div>
                    <div>
                      <span>Net P&L</span>
                      <b
                        className={`mono ${stats.pnl >= 0 ? "is-pos" : "is-neg"}`}
                      >
                        {signedMoney(stats.pnl)}
                      </b>
                    </div>
                    <div>
                      <span>Your share</span>
                      <b
                        className={`mono ${stats.yourShare >= 0 ? "is-pos" : "is-neg"}`}
                      >
                        {signedMoney(stats.yourShare, 2)}
                      </b>
                    </div>
                    <div>
                      <span>Volume</span>
                      <b className="mono">{money(stats.volume)}</b>
                    </div>
                    <div>
                      <span>Average hold</span>
                      <b className="mono">
                        {durationLabel(stats.avgDurationSeconds)}
                      </b>
                    </div>
                  </div>
                  <div className="table-responsive lt-table-wrap">
                    <table className="table lt-table">
                      <thead>
                        <tr>
                          <th>Pool</th>
                          <th>Trades</th>
                          <th>P&L</th>
                          <th>Your share</th>
                          <th className="d-none d-sm-table-cell">
                            Cash per trade
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.byPool.map((row) => (
                          <tr key={row.label}>
                            <td className="mono">{row.label}</td>
                            <td className="mono">{row.trades}</td>
                            <td
                              className={`mono ${row.pnl >= 0 ? "is-pos" : "is-neg"}`}
                            >
                              {signedMoney(row.pnl)}
                            </td>
                            <td className="mono">
                              {signedMoney(row.yourShare, 2)}
                            </td>
                            <td className="mono">
                              {row.trades
                                ? signedMoney(round2(row.pnl / row.trades), 2)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="lt-note">
                    Best trade{" "}
                    {stats.best
                      ? `${signedMoney(stats.best.amount, 2)} (${stats.best.note})`
                      : "—"}{" "}
                    · worst{" "}
                    {stats.worst
                      ? `${signedMoney(stats.worst.amount, 2)} (${stats.worst.note})`
                      : "—"}{" "}
                    · longest win streak {stats.longestWinStreak} · longest loss
                    streak {stats.longestLossStreak}.
                  </p>
                  <div className="lt-modal-actions">
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => {
                        setExportScope("session-stats");
                        open("exportFeed");
                      }}
                    >
                      <Icon name="download" size={13} /> Export stats
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("journal")}
                    >
                      Open journal
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("earnings")}
                    >
                      How shares pay out
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "guardrails" ? (
                <>
                  <p className="lt-note">
                    Four rules run with every settlement batch. They belong to
                    the desk; this page only mirrors them and lets you
                    acknowledge what already happened.
                  </p>
                  <ul className="lt-guardrail-list">
                    {data.guardrails.map((row) => (
                      <li key={row.id}>
                        <span className="mono">{row.limit}</span>
                        <div>
                          <b>{row.label}</b>
                          <p>{row.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="lt-modal-actions">
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("alerts")}
                    >
                      Guardian alerts
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("alertRules")}
                    >
                      Add alert rule
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "alerts" ? (
                <>
                  <div className="lt-toolbar">
                    <span className="lt-muted">
                      {openAlerts.length} open ·{" "}
                      {data.alerts.length - openAlerts.length} acknowledged
                    </span>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("alertRules")}
                    >
                      <Icon name="plus" size={13} /> Rule
                    </button>
                  </div>
                  <ul className="lt-alert-list">
                    {data.alerts.map((row) => (
                      <li
                        key={row.id}
                        className={`${levelTone(row.level)} ${row.id === alert?.id ? "is-selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="lt-alert-list__body"
                          onClick={() => setSelectedAlert(row.id)}
                        >
                          <span
                            className={`lt-alert__level ${levelTone(row.level)}`}
                          >
                            {guardianLabel(row.level)}
                          </span>
                          <span>
                            <b>{row.title}</b>
                            <small className="mono">
                              {row.poolCode} · {clockOf(row.at)} UTC ·{" "}
                              {row.action}
                            </small>
                          </span>
                        </button>
                        {row.acknowledged ? (
                          <Tag tone="is-ok">Ack</Tag>
                        ) : (
                          <button
                            type="button"
                            className="lt-btn lt-btn--sm"
                            onClick={() =>
                              void run(
                                { kind: "acknowledgeAlert", alertId: row.id },
                                {
                                  keep: true,
                                  title: "Alert acknowledged locally",
                                },
                              )
                            }
                          >
                            Acknowledge
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {alert ? (
                    <div className="lt-alert-detail">
                      <b>{alert.title}</b>
                      <p>{alert.detail}</p>
                      <span className="mono">{alert.action}</span>
                    </div>
                  ) : null}
                  <h4 className="lt-subhead">Alert rules</h4>
                  <ul className="lt-rule-list">
                    {data.rules.map((rule) => (
                      <li key={rule.id}>
                        <b className="mono">${rule.threshold}</b>
                        <span>{rule.note}</span>
                        <small className="mono">
                          {atStamp(rule.createdAt)}
                        </small>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {modal.kind === "shortcuts" ? (
                <dl className="lt-shortcuts">
                  {[
                    ["⌘ / Ctrl + K", "Command palette"],
                    ["P", "Pause or resume the stream"],
                    ["F", "Filter the feed"],
                    ["J", "Open the session journal"],
                    ["E", "Export the session"],
                    ["G", "Jump to Guardian alerts"],
                    ["Esc", "Close this dialog"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <dt className="mono">{key}</dt>
                      <dd>{label}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {modal.kind === "help" ? (
                <>
                  <p className="lt-note">
                    This page is a full-fidelity preview of the live tracker.
                    Everything you can click works, and nothing leaves the
                    browser.
                  </p>
                  <ul className="lt-list">
                    <li>
                      <b>Reads.</b> Totals, feed, tickers, session stats and
                      bots come from one workspace DTO served by{" "}
                      <span className="mono">/api/investor/live</span>.
                    </li>
                    <li>
                      <b>Stream.</b> Ticks and trades are simulated on a timer
                      and reduced through the same handler a socket message
                      would call.
                    </li>
                    <li>
                      <b>Writes.</b> Pausing a bot or pool, acknowledging
                      alerts, saving preferences, filters, rules, exports and
                      support drafts are local to this session. The API has no
                      write handler, so mutations return 405.
                    </li>
                    <li>
                      <b>Money.</b> Your share applies the pool percentage, then
                      the 20% platform cut. Paid earnings land in the pool
                      ledger before your wallet.
                    </li>
                  </ul>
                  <div className="lt-modal-actions">
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("earnings")}
                    >
                      Share maths
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("support")}
                    >
                      Contact the desk
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "share" ? (
                <>
                  <p className="lt-note">
                    A read-only session link carries the stream id and the
                    current snapshot time. It never exposes wallet details.
                  </p>
                  <label className="lt-field">
                    <span>Session link</span>
                    <input
                      readOnly
                      value={`https://trademo.app/investor/live?session=${data.stream.id}&at=${data.asOf}`}
                    />
                  </label>
                  <div className="lt-modal-actions">
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() =>
                        void copy(
                          `https://trademo.app/investor/live?session=${data.stream.id}&at=${data.asOf}`,
                          "Session link",
                        )
                      }
                    >
                      <Icon name="copy" size={13} /> Copy link
                    </button>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("exportFeed")}
                    >
                      Export instead
                    </button>
                  </div>
                </>
              ) : null}

              {modal.kind === "earnings" ? (
                <>
                  <p className="lt-note">
                    A trade closes, the pool profit is split by your share
                    percentage, the 20% platform cut comes off that share, and
                    the net amount is credited to the pool ledger. Earnings move
                    to your wallet on the settlement batch.
                  </p>
                  <div className="table-responsive lt-table-wrap">
                    <table className="table lt-table">
                      <thead>
                        <tr>
                          <th>Step</th>
                          <th>Figure</th>
                          <th>Where it lands</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["Trade P&L", signedMoney(stats.pnl), "Pool ledger"],
                          [
                            "Your share (weighted)",
                            signedMoney(stats.yourShare, 2),
                            "Pool ledger → earnings",
                          ],
                          [
                            "Platform cut",
                            signedMoney(
                              round2(
                                data.feed.reduce(
                                  (sum, row) => sum + row.platformCut,
                                  0,
                                ),
                              ),
                              2,
                            ),
                            "Operator",
                          ],
                          [
                            "Paid to date",
                            signedMoney(totals.yourSharePnl, 2),
                            "Pool ledger (all cycles)",
                          ],
                        ].map(([step, figure, where]) => (
                          <tr key={step}>
                            <td>{step}</td>
                            <td className="mono">{figure}</td>
                            <td>{where}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <dl className="lt-kv">
                    {data.pools.map((row) => (
                      <div key={row.poolId}>
                        <dt>
                          {row.code} share · {row.yourSharePct}% of{" "}
                          {money(row.yourInvestment)}
                        </dt>
                        <dd className="mono">
                          {signedMoney(row.yourSharePnl, 2)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="lt-modal-actions">
                    <Link className="lt-btn" href="/investor/earnings">
                      Earnings statement
                    </Link>
                    <button
                      type="button"
                      className="lt-btn"
                      onClick={() => open("sessionReport")}
                    >
                      Session report
                    </button>
                  </div>
                </>
              ) : null}

              {modalBlock ? (
                <p className="lt-modal-note" role="status">
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
