"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  countdownLabel,
  daysSince,
  monthEarned,
  monthRoi,
  payoutIssue,
  poolProgress,
  relativeLabel,
  unrealizedTotal,
  type ActivePool,
  type ActivityItem,
  type Investment,
  type InvestorCommand,
  type InvestorWorkspace,
  type UpcomingPool,
} from "@/lib/investor/model";
import { useInvestor } from "@/lib/investor/use-investor";
import {
  InvestorShell,
  type InvestorDrawerTab,
  type InvestorNavKey,
  type InvestorQuickAction,
} from "./investor-shell";

const money = (value: number, decimals = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
const signedMoney = (value: number, decimals = 2) =>
  `${value >= 0 ? "+" : "−"}${money(Math.abs(value), decimals)}`;
const percent = (value: number, decimals = 2) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(decimals)}%`;
const atTime = (iso: string) => `${iso.slice(11, 16)} UTC`;
const atDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
const atDateTime = (iso: string) =>
  `${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(iso))} · ${atTime(iso)}`;
const activityIcon: Record<ActivityItem["kind"], IconName> = {
  trade: "activity",
  deposit: "vault",
  guardian: "shield",
  payout: "wallet",
  announcement: "bell",
  distribution: "trendUp",
  kyc: "check",
  reminder: "calendar",
};

type Kind =
  | "poolDetail"
  | "liveTrades"
  | "tickerInfo"
  | "earningsDetail"
  | "bookSlot"
  | "reminder"
  | "reminders"
  | "upcomingDetail"
  | "payout"
  | "payoutMethods"
  | "calculator"
  | "export"
  | "notificationPrefs"
  | "activityDetail"
  | "activityLog"
  | "tradeDetail"
  | "guardianDetail"
  | "portfolioDetail"
  | "profileSettings"
  | "support"
  | "kycStatus"
  | "fees"
  | "referral"
  | "receipt"
  | "investmentDetail"
  | "help";
const titles: Record<Kind, string> = {
  poolDetail: "Active pool detail",
  liveTrades: "Live & recent pool trades",
  tickerInfo: "Earnings ticker methodology",
  earningsDetail: "Earnings & distributions",
  bookSlot: "Book an upcoming pool slot",
  reminder: "Set an opening reminder",
  reminders: "Manage opening reminders",
  upcomingDetail: "Upcoming pool brief",
  payout: "Request a payout",
  payoutMethods: "Payout methods",
  calculator: "Project a pool return",
  export: "Export investor evidence",
  notificationPrefs: "Notification preferences",
  activityDetail: "Activity record",
  activityLog: "All investor activity",
  tradeDetail: "Trade settlement record",
  guardianDetail: "Guardian risk controls",
  portfolioDetail: "Full investment portfolio",
  profileSettings: "Investor profile",
  support: "Contact the operations desk",
  kycStatus: "Verification status",
  fees: "Fees & profit share",
  referral: "Invite an investor",
  receipt: "Distribution receipt",
  investmentDetail: "Investment allocation",
  help: "Workspace boundaries",
};
const wizardKinds: Kind[] = [
  "bookSlot",
  "reminder",
  "payout",
  "calculator",
  "export",
  "notificationPrefs",
  "profileSettings",
  "support",
];
const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  liveTrades: "xl",
  earningsDetail: "xl",
  portfolioDetail: "xl",
  activityLog: "xl",
  help: "lg",
  fees: "lg",
  referral: "lg",
  bookSlot: "lg",
  payout: "lg",
  calculator: "lg",
  export: "lg",
  notificationPrefs: "lg",
  profileSettings: "lg",
  support: "lg",
  poolDetail: "lg",
  guardianDetail: "lg",
  upcomingDetail: "lg",
  tickerInfo: "lg",
};
const quickActions: InvestorQuickAction[] = [
  {
    key: "bookSlot",
    label: "Book a pool slot",
    short: "Book slot",
    icon: "pool",
  },
  { key: "payout", label: "Request a payout", short: "Payout", icon: "wallet" },
  {
    key: "earnings",
    label: "Earnings report",
    short: "Earnings",
    icon: "trendUp",
  },
  {
    key: "calculator",
    label: "Return calculator",
    short: "Calculator",
    icon: "chart",
  },
  {
    key: "invite",
    label: "Invite an investor",
    short: "Invite",
    icon: "users",
  },
  { key: "fees", label: "Fees & risk", short: "Fees", icon: "shield" },
];

function CountValue({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const live = useLiveCountUp(value);
  return <span className="mono">{money(live, decimals)}</span>;
}
function Kpi({
  label,
  value,
  foot,
  note,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  foot: ReactNode;
  note?: string;
  tone?: "win" | "loss";
  icon: IconName;
}) {
  return (
    <div className="iv-kpi">
      <div className="iv-kpi__top">
        <span>{label}</span>
        <Icon name={icon} size={16} />
      </div>
      <div className={`iv-kpi__value ${tone ? `is-${tone}` : ""}`}>{value}</div>
      <div className="iv-kpi__foot">{foot}</div>
      {note ? <div className="iv-kpi__note">{note}</div> : null}
    </div>
  );
}
function SectionHead({
  code,
  title,
  hint,
  action,
}: {
  code: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="iv-section-head">
      <div>
        <span className="iv-section-code">{code}</span>
        <h2>{title}</h2>
        {hint ? <p>{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
function Progress({ raised, goal }: { raised: number; goal: number }) {
  const pct = poolProgress(raised, goal);
  return (
    <div
      className="iv-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={`Funding progress ${Math.round(pct)} percent`}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
function PoolCard({
  pool,
  now,
  onOpen,
  onTrades,
  onGuardian,
}: {
  pool: ActivePool;
  now: string;
  onOpen: () => void;
  onTrades: () => void;
  onGuardian: () => void;
}) {
  return (
    <article className="iv-pool-card">
      <div className="iv-pool-top">
        <div className="iv-pool-id">
          <span className="iv-code mono">{pool.code}</span>
          <span className="iv-tag">TRADING</span>
          <span className="iv-guardian is-active">
            <span className="live-dot" /> Guardian active
          </span>
        </div>
        <span className="iv-muted mono">ENDS {pool.endsAt.slice(0, 10)}</span>
      </div>
      <div className="iv-pool-name">
        <div>
          <h3>{pool.name}</h3>
          <p>{pool.strategy}</p>
        </div>
        <button type="button" className="iv-link" onClick={onOpen}>
          View details ↗
        </button>
      </div>
      <div className="iv-pool-progress">
        <div>
          <span>FUNDING PROGRESS</span>
          <b className="mono">
            {Math.round(poolProgress(pool.raised, pool.goal))}%
          </b>
        </div>
        <Progress raised={pool.raised} goal={pool.goal} />
        <div className="iv-pool-progress__foot">
          <span>
            Raised <b className="mono">{money(pool.raised)}</b>
          </span>
          <span>
            Goal <b className="mono">{money(pool.goal)}</b>
          </span>
        </div>
      </div>
      <div className="iv-pool-metrics">
        <div>
          <span>YOUR ALLOCATION</span>
          <b className="mono">{money(pool.investment)}</b>
          <small>
            {pool.userSlots} slot{pool.userSlots === 1 ? "" : "s"} ·{" "}
            {pool.profitSharePct}% profit share
          </small>
        </div>
        <div>
          <span>TRADING ENDS</span>
          <b className="mono">{countdownLabel(pool.endsAt, now)}</b>
          <small>{atDateTime(pool.endsAt)}</small>
        </div>
        <div>
          <span>POOL P&amp;L</span>
          <b className="mono text-win">{signedMoney(pool.pnl)}</b>
          <small>
            {pool.trades} trades · {pool.winRatePct}% win rate
          </small>
        </div>
        <div className="is-highlight">
          <span>YOUR SHARE</span>
          <b className="mono text-win">{signedMoney(pool.sharePnl)}</b>
          <small>{percent(pool.roiPct)} on allocation</small>
        </div>
      </div>
      <div className="iv-pool-foot">
        <div className="iv-guardian-metrics">
          <span>
            <Icon name="shield" size={13} /> Drawdown{" "}
            {pool.guardian.drawdownPct}% / {pool.guardian.drawdownLimitPct}%
          </span>
          <span>
            Loss streak {pool.guardian.consecutiveLosses} /{" "}
            {pool.guardian.maxConsecutiveLosses}
          </span>
        </div>
        <div className="iv-actions">
          <button type="button" className="iv-btn" onClick={onTrades}>
            Live trades
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--primary"
            onClick={onOpen}
          >
            View details
          </button>
        </div>
      </div>
      <button
        type="button"
        className="iv-card-link"
        onClick={onGuardian}
        aria-label={`Open Guardian controls for ${pool.code}`}
      >
        Guardian last checked {atTime(pool.guardian.lastCheckedAt)} — inspect
        policy
      </button>
    </article>
  );
}
function UpcomingCard({
  pool,
  now,
  reminder,
  booking,
  onBook,
  onRemind,
  onDetail,
}: {
  pool: UpcomingPool;
  now: string;
  reminder: InvestorWorkspace["reminders"][number] | undefined;
  booking: InvestorWorkspace["bookings"][number] | undefined;
  onBook: () => void;
  onRemind: () => void;
  onDetail: () => void;
}) {
  return (
    <article className="iv-up-card">
      <div className="iv-up-top">
        <span className="iv-code mono">{pool.code}</span>
        <span className="iv-tag">{pool.riskBand.toUpperCase()}</span>
      </div>
      <h3>
        <button type="button" className="iv-title-button" onClick={onDetail}>
          {pool.name}
        </button>
      </h3>
      <p>{pool.focus}</p>
      <div className="iv-up-meta">
        <div>
          <span>OPENS</span>
          <b className="mono">{atDateTime(pool.opensAt)}</b>
        </div>
        <div>
          <span>STARTS IN</span>
          <b className="mono">{countdownLabel(pool.opensAt, now)}</b>
        </div>
        <div>
          <span>MINIMUM</span>
          <b className="mono">{money(pool.minInvestment)}</b>
        </div>
        <div>
          <span>DURATION</span>
          <b className="mono">{pool.durationDays} days</b>
        </div>
        <div>
          <span>TARGET ROI</span>
          <b className="mono text-win">{percent(pool.expectedRoiPct, 1)}</b>
        </div>
        <div>
          <span>CAPACITY</span>
          <b className="mono">{money(pool.capacity)}</b>
        </div>
      </div>
      {booking ? (
        <div className="iv-inline-note is-success">
          <Icon name="check" size={13} /> Booking hold prepared ·{" "}
          {booking.slots} slot{booking.slots === 1 ? "" : "s"} ·{" "}
          {money(booking.amount)} local only
        </div>
      ) : reminder ? (
        <div className="iv-inline-note">
          <Icon name="bell" size={13} /> Reminder set · {reminder.leadDays}d
          before open · {reminder.channel === "email" ? "email" : "in-app"}
        </div>
      ) : null}
      <div className="iv-actions">
        <button
          type="button"
          className="iv-btn"
          onClick={onRemind}
          disabled={!!booking}
        >
          {reminder ? "Edit reminder" : "Set reminder"}
        </button>
        <button
          type="button"
          className="iv-btn iv-btn--primary"
          onClick={onBook}
        >
          {booking ? "Booking prepared" : "Book slot"}
        </button>
      </div>
    </article>
  );
}
const portfolioCol = createDeskColumnHelper<Investment>();
function PortfolioTable({
  rows,
  onInspect,
}: {
  rows: Investment[];
  onInspect: (row: Investment) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "invested", desc: true },
  ]);
  const columns = useMemo(
    () =>
      portfolioCol.columns([
        portfolioCol.accessor("code", { header: "Pool" }),
        portfolioCol.accessor("status", { header: "Status" }),
        portfolioCol.accessor("invested", { header: "Invested" }),
        portfolioCol.accessor("currentValue", { header: "Current value" }),
        portfolioCol.accessor("profit", { header: "Profit" }),
        portfolioCol.accessor("roiPct", { header: "ROI" }),
        portfolioCol.accessor("sharePct", { header: "Profit share" }),
      ]),
    [],
  );
  const table = useDeskTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: (updater) =>
      setSorting((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      ),
  });
  return (
    <div className="table-responsive">
      <table className="table iv-table">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id}>
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {String(header.column.columnDef.header)}{" "}
                    {header.column.getIsSorted() === "desc"
                      ? "↓"
                      : header.column.getIsSorted() === "asc"
                        ? "↑"
                        : "↕"}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(({ original: item }) => (
            <tr key={item.id}>
              <td>
                <button
                  type="button"
                  className="iv-link"
                  onClick={() => onInspect(item)}
                >
                  {item.code} · {item.name}
                </button>
              </td>
              <td>
                <span className="iv-tag">{item.status.toUpperCase()}</span>
              </td>
              <td className="mono">{money(item.invested)}</td>
              <td className="mono">{money(item.currentValue)}</td>
              <td
                className={`mono ${item.profit >= 0 ? "text-win" : "text-loss"}`}
              >
                {signedMoney(item.profit)}
              </td>
              <td
                className={`mono ${item.roiPct >= 0 ? "text-win" : "text-loss"}`}
              >
                {percent(item.roiPct)}
              </td>
              <td className="mono">{item.sharePct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CalculatorFields({
  initial,
  onValid,
}: {
  initial: { principal: number; roiPct: number; days: number };
  onValid: (value: { principal: number; roiPct: number; days: number }) => void;
}) {
  const form = useForm({
    defaultValues: initial,
    validators: {
      onSubmit: ({ value }) => {
        if (
          !Number.isFinite(value.principal) ||
          value.principal < 500 ||
          value.principal > 100000
        )
          return "Principal must be between $500 and $100,000";
        if (
          !Number.isFinite(value.roiPct) ||
          value.roiPct < 1 ||
          value.roiPct > 50
        )
          return "Target ROI must be between 1% and 50%";
        if (!Number.isInteger(value.days) || value.days < 1 || value.days > 365)
          return "Duration must be a whole number between 1 and 365 days";
        return undefined;
      },
    },
    onSubmit: ({ value }) =>
      onValid({
        principal: value.principal,
        roiPct: value.roiPct,
        days: value.days,
      }),
  });
  return (
    <form
      id="iv-calculator-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(s) => s.values}>
        {(v) => (
          <div className="iv-form-grid">
            <label className="iv-field">
              Principal allocation / USD
              <input
                className="form-control"
                aria-label="Calculator principal"
                type="number"
                min={500}
                max={100000}
                step={100}
                value={v.principal}
                onChange={(e) =>
                  form.setFieldValue("principal", Number(e.target.value))
                }
              />
            </label>
            <label className="iv-field">
              Target ROI / %
              <input
                className="form-control"
                aria-label="Calculator target ROI"
                type="number"
                min={1}
                max={50}
                step={0.1}
                value={v.roiPct}
                onChange={(e) =>
                  form.setFieldValue("roiPct", Number(e.target.value))
                }
              />
            </label>
            <label className="iv-field">
              Duration / days
              <input
                className="form-control"
                aria-label="Calculator duration"
                type="number"
                min={1}
                max={365}
                value={v.days}
                onChange={(e) =>
                  form.setFieldValue("days", Number(e.target.value))
                }
              />
            </label>
          </div>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.errors}>
        {(errors) =>
          errors.length ? (
            <p className="iv-error" role="alert">
              {errors.map(String).join("; ")}
            </p>
          ) : null
        }
      </form.Subscribe>
    </form>
  );
}

export function InvestorOverviewPage({
  initial,
  initialAction,
  initialFocus,
  initialPool,
}: {
  initial: InvestorWorkspace;
  initialAction?: string;
  initialFocus?: string;
  initialPool?: string;
}) {
  const { data, mutation } = useInvestor(initial);
  const chrome = useRef<{
    pushToast: (toast: {
      tone: "success" | "info" | "warning" | "error";
      title: string;
      detail?: string;
    }) => void;
  } | null>(null);
  const onChromeReady = useCallback(
    (next: NonNullable<typeof chrome.current>) => {
      chrome.current = next;
    },
    [],
  );
  const pushToast = useCallback(
    (toast: {
      tone: "success" | "info" | "warning" | "error";
      title: string;
      detail?: string;
    }) => chrome.current?.pushToast(toast),
    [],
  );
  const [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(() => {
    if (initialPool) {
      const pool = initial.activePools.find(
        (item) => item.id === initialPool || item.code === initialPool,
      );
      if (pool) return { kind: "poolDetail", id: pool.id };
    }
    const byAction: Record<string, Kind> = {
      payout: "payout",
      calculator: "calculator",
      book: "bookSlot",
      export: "export",
      reminder: "reminder",
    };
    const kind = initialAction ? byAction[initialAction] : undefined;
    return kind ? { kind } : null;
  });
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<InvestorDrawerTab | null>(null);
  const [activeNav, setActiveNav] = useState<InvestorNavKey>(() => {
    const focusMap: Record<string, InvestorNavKey> = {
      overview: "overview",
      pools: "pools",
      upcoming: "upcoming",
      earnings: "earnings",
      activity: "activity",
      quick: "overview",
    };
    return (initialFocus && focusMap[initialFocus]) || "overview";
  });
  const [clock, setClock] = useState(initial.asOf);
  const [tick, setTick] = useState(initial.earnings.nextRefreshIn);
  const [bookPoolId, setBookPoolId] = useState(initial.upcoming[0]?.id ?? "");
  const [bookSlots, setBookSlots] = useState(1);
  const [remindPoolId, setRemindPoolId] = useState(
    initial.upcoming[0]?.id ?? "",
  );
  const [remindLead, setRemindLead] = useState<1 | 2 | 3 | 7>(1);
  const [remindChannel, setRemindChannel] = useState<"email" | "in_app">(
    "email",
  );
  const [payoutAmount, setPayoutAmount] = useState("500");
  const [payoutMethodId, setPayoutMethodId] = useState(
    initial.wallet.methods[0]?.id ?? "",
  );
  const [calc, setCalc] = useState({ principal: 10000, roiPct: 12, days: 30 });
  const [exportScope, setExportScope] = useState<
    "portfolio" | "activity" | "earnings" | "statement"
  >("portfolio");
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "pdf">(
    "json",
  );
  const [prefs, setPrefs] = useState(initial.preferences);
  const [displayName, setDisplayName] = useState(initial.profile.displayName);
  const [supportTopic, setSupportTopic] = useState<
    "payout" | "pool" | "kyc" | "account" | "other"
  >("payout");
  const [supportMessage, setSupportMessage] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [clipboardNote, setClipboardNote] = useState("");
  const overlay = !!modal || !!drawer;
  const closeRef = useRef<() => void>(() => {});
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const month = monthEarned(data);
  const roi = monthRoi(data);
  const unrealized = unrealizedTotal(data);
  const poolBook = data.summary.totalInvested + unrealized;
  const unread = data.notifications.filter((n) => !n.read).length;
  const days = daysSince(data.profile.investorSince, data.asOf);
  const modalPool = data.activePools.find((p) => p.id === modal?.id);
  const modalUpcoming = data.upcoming.find((p) => p.id === modal?.id);
  const modalTrade = data.trades.find((t) => t.id === modal?.id);
  const modalActivity = data.activity.find((a) => a.id === modal?.id);
  const modalReceipt = data.receipts.find((r) => r.id === modal?.id);
  const modalInvestment = data.portfolio.find((i) => i.id === modal?.id);
  const bookPool = data.upcoming.find((p) => p.id === bookPoolId);
  const remindPool = data.upcoming.find((p) => p.id === remindPoolId);
  const activeMethod = data.wallet.methods.find((m) => m.id === payoutMethodId);
  const payoutValue = Number(payoutAmount);
  const payoutProblem = payoutIssue(data, payoutValue, payoutMethodId);
  const projections = {
    profit: Number(((calc.principal * calc.roiPct) / 100).toFixed(2)),
    total: Number((calc.principal * (1 + calc.roiPct / 100)).toFixed(2)),
  };
  const tradeRows =
    tradeFilter === "all"
      ? data.trades
      : data.trades.filter((t) => t.poolId === tradeFilter);
  const filteredActivity = data.activity
    .filter((a) => activityFilter === "all" || a.kind === activityFilter)
    .filter((a) => !unreadOnly || !a.read);
  const wizard = modal ? wizardKinds.includes(modal.kind) : false;
  const modalBlock = blocking();

  function scrollTo(key: InvestorNavKey) {
    setActiveNav(key);
    const map: Partial<Record<InvestorNavKey, string>> = {
      overview: "iv-overview-top",
      pools: "iv-active-pools",
      upcoming: "iv-upcoming",
      earnings: "iv-earnings",
      activity: "iv-activity",
    };
    const id = map[key];
    if (id)
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (key === "portfolio") setDrawer("portfolio");
    else if (key === "wallet") open("payout");
    else if (key === "calculator") open("calculator");
    else if (key === "notifications") setDrawer("activity");
    else if (key === "settings") open("profileSettings");
  }
  function open(kind: Kind, id?: string) {
    setModal({ kind, id });
    setStep(0);
    setConfirmed(false);
    setError("");
    setDrawer(null);
    setClipboardNote("");
    if (kind === "bookSlot") {
      const pool =
        data.upcoming.find((p) => p.id === id) ??
        data.upcoming.find(
          (p) => !data.bookings.some((b) => b.poolId === p.id),
        ) ??
        data.upcoming[0];
      setBookPoolId(pool?.id ?? "");
      setBookSlots(1);
    }
    if (kind === "reminder") {
      const pool =
        data.upcoming.find((p) => p.id === id) ??
        data.upcoming.find(
          (p) => !data.reminders.some((r) => r.poolId === p.id),
        ) ??
        data.upcoming[0];
      setRemindPoolId(pool?.id ?? "");
      setRemindLead(1);
      setRemindChannel("email");
    }
    if (kind === "payout") {
      setPayoutAmount(
        String(Math.max(50, Math.min(500, data.wallet.available))),
      );
      setPayoutMethodId(data.wallet.methods.find((m) => m.active)?.id ?? "");
    }
    if (kind === "notificationPrefs") setPrefs(data.preferences);
    if (kind === "profileSettings") setDisplayName(data.profile.displayName);
    if (kind === "support") {
      setSupportTopic("payout");
      setSupportMessage("");
    }
    if (kind === "liveTrades") setTradeFilter(id ?? "all");
    if (kind === "activityLog") {
      setActivityFilter("all");
      setUnreadOnly(false);
    }
  }
  function close() {
    setModal(null);
    setDrawer(null);
    setStep(0);
    setConfirmed(false);
    setError("");
    setBusy(false);
  }
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    const timer = window.setInterval(
      () => setClock((prev) => new Date(Date.parse(prev) + 1000).toISOString()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!data.preferences.autoRefresh) return;
    if (tick > 0) {
      const timer = window.setTimeout(() => setTick((v) => v - 1), 1000);
      return () => window.clearTimeout(timer);
    }
    mutateRef.current({ kind: "refreshEarnings", source: "auto" });
    const reset = window.setTimeout(() => setTick(180), 0);
    return () => window.clearTimeout(reset);
  }, [tick, data.preferences.autoRefresh]);
  useEffect(() => {
    if (!overlay) return;
    const prior = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const layer = document.querySelector<HTMLElement>(
      ".page-investor-overview [role=dialog]",
    );
    const nodes = () =>
      Array.from(
        layer?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) ?? [],
      ).filter((n) => n.getClientRects().length > 0);
    nodes()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const list = nodes();
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
          e.preventDefault();
          list[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
      prior?.focus();
    };
  }, [overlay, modal?.kind, drawer]);
  useEffect(() => {
    if (modal && step > 0)
      document
        .querySelector<HTMLElement>(
          ".page-investor-overview .desk-modal__foot button:not(:disabled)",
        )
        ?.focus();
  }, [step, modal]);
  useEffect(() => {
    if (!initialFocus) return;
    const map: Record<string, string> = {
      overview: "iv-overview-top",
      pools: "iv-active-pools",
      upcoming: "iv-upcoming",
      earnings: "iv-earnings",
      activity: "iv-activity",
      quick: "iv-quick",
    };
    const target = map[initialFocus];
    if (!target) return;
    const scroll = window.setTimeout(() => {
      document
        .getElementById(target)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 220);
    return () => window.clearTimeout(scroll);
  }, [initialFocus]);

  async function run(
    command: InvestorCommand,
    opts?: { keep?: boolean; title?: string },
  ) {
    setError("");
    setBusy(true);
    try {
      await mutation.mutateAsync(command);
      pushToast({
        tone: "success",
        title: opts?.title ?? "Local investor preview updated",
        detail:
          "No money moved, no provider call was made, and the source snapshot is unchanged.",
      });
      if (!opts?.keep) close();
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The local action could not be completed",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function download(value: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  function exportRows() {
    if (exportScope === "portfolio")
      return data.portfolio.map((i) => ({
        pool: i.code,
        name: i.name,
        status: i.status,
        invested: i.invested,
        value: i.currentValue,
        profit: i.profit,
        roi: i.roiPct,
        share: i.sharePct,
      }));
    if (exportScope === "activity")
      return data.activity.map((a) => ({
        at: a.at,
        kind: a.kind,
        title: a.title,
        amount: a.amount,
        share: a.share,
        status: a.status,
      }));
    if (exportScope === "earnings")
      return data.earnings.rows.map((r) => ({
        pool: r.code,
        profit: r.profit,
        roi: r.roiPct,
        updatedAt: r.updatedAt,
      }));
    return data.receipts.map((r) => ({
      receipt: r.id,
      pool: r.code,
      paidAt: r.paidAt,
      amount: r.netAmount,
      status: r.status,
    }));
  }
  async function performExport() {
    setBusy(true);
    try {
      const rows = exportRows();
      const stamp = data.asOf.slice(0, 10);
      if (exportFormat === "json")
        download(
          JSON.stringify(
            { mode: "demo", asOf: data.asOf, scope: exportScope, rows },
            null,
            2,
          ),
          `investor-${exportScope}-${stamp}.json`,
          "application/json",
        );
      else if (exportFormat === "csv") {
        const keys = Object.keys(rows[0] ?? {});
        const csv = [
          keys.join(","),
          ...rows.map((row) =>
            keys
              .map(
                (k) =>
                  `"${String((row as Record<string, unknown>)[k] ?? "").replaceAll('"', '""')}"`,
              )
              .join(","),
          ),
        ].join("\n");
        download(csv, `investor-${exportScope}-${stamp}.csv`, "text/csv");
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`tradeMO / Investor ${exportScope} statement`, 18, 22);
        doc.setFontSize(9);
        doc.text(
          `Source snapshot ${data.asOf} · demo export · no provider or settlement authority`,
          18,
          32,
        );
        let y = 46;
        rows.forEach((row) => {
          if (y > 272) {
            doc.addPage();
            y = 20;
          }
          doc.text(
            Object.entries(row as Record<string, unknown>)
              .map(([k, v]) => `${k}: ${v ?? "—"}`)
              .join(" · "),
            18,
            y,
          );
          y += 8;
        });
        doc.save(`investor-${exportScope}-${stamp}.pdf`);
      }
      close();
      pushToast({
        tone: "success",
        title: "Export generated locally",
        detail: `${rows.length} structured records · demo evidence only`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  async function downloadReceipt(
    receipt: InvestorWorkspace["receipts"][number],
  ) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(17);
    doc.text("tradeMO / Distribution receipt", 18, 24);
    doc.setFontSize(9);
    [
      `Receipt: ${receipt.id}`,
      `Pool: ${receipt.code}`,
      `Paid: ${receipt.paidAt}`,
      `Net amount: ${money(receipt.netAmount, 2)}`,
      `Source status: ${receipt.status}`,
      `Investor: ${data.profile.displayName}`,
      `Source snapshot: ${data.asOf}`,
      "",
      "Synthetic demonstration evidence only. Not a bank statement, tax document or provider settlement proof.",
    ].forEach((line, index) => doc.text(line, 18, 42 + index * 9));
    doc.save(`${receipt.id}-demo.pdf`);
  }
  function blocking() {
    if (!modal) return "";
    if (modal.kind === "payout") return payoutProblem ?? "";
    if (modal.kind === "bookSlot") {
      if (!bookPool) return "Choose an upcoming pool";
      if (data.bookings.some((b) => b.poolId === bookPool.id))
        return "A local booking already exists for this pool";
      if (bookSlots < 1 || bookSlots > 10)
        return "Choose between 1 and 10 slots";
      if (bookSlots * bookPool.minInvestment > bookPool.capacity)
        return "Requested allocation exceeds remaining capacity";
    }
    if (modal.kind === "reminder") {
      if (!remindPool) return "Choose an upcoming pool";
      if (data.reminders.some((r) => r.poolId === remindPool.id))
        return "A reminder already exists; manage it from reminders";
      const available = Math.ceil(
        (Date.parse(remindPool.opensAt) - Date.parse(data.asOf)) / 86_400_000,
      );
      if (remindLead > available)
        return `Lead time exceeds the ${available} day(s) until opening`;
    }
    if (modal.kind === "notificationPrefs") {
      if (!prefs.channels.email && !prefs.channels.push && !prefs.channels.sms)
        return "Keep at least one notification channel enabled";
      if (prefs.quietStart === prefs.quietEnd)
        return "Quiet hours must have different start and end times";
      if (data.payoutRequests.length > 0 && !prefs.channels.email)
        return "Email is required while a payout draft is pending";
    }
    if (
      modal.kind === "profileSettings" &&
      (displayName.trim().length < 2 || displayName.trim().length > 60)
    )
      return "Display name must be 2–60 characters";
    if (modal.kind === "support" && supportMessage.trim().length < 20)
      return "Describe the request in at least 20 characters";
    return "";
  }
  async function submit() {
    if (!modal) return;
    switch (modal.kind) {
      case "bookSlot":
        if (!bookPool) return;
        return void run(
          {
            kind: "bookSlot",
            poolId: bookPool.id,
            slots: bookSlots,
            amount: Number((bookPool.minInvestment * bookSlots).toFixed(2)),
          },
          { title: "Booking hold prepared locally" },
        );
      case "reminder":
        if (!remindPool) return;
        return void run(
          {
            kind: "setReminder",
            poolId: remindPool.id,
            leadDays: remindLead,
            channel: remindChannel,
          },
          { title: "Reminder prepared locally" },
        );
      case "payout":
        return void run(
          {
            kind: "requestPayout",
            amount: payoutValue,
            methodId: payoutMethodId,
          },
          { title: "Payout draft recorded locally" },
        );
      case "calculator":
        return void run(
          {
            kind: "saveCalculator",
            principal: calc.principal,
            roiPct: calc.roiPct,
            days: calc.days,
          },
          { title: "Projection saved locally" },
        );
      case "export":
        return void performExport();
      case "notificationPrefs":
        return void run(
          { kind: "savePreferences", value: prefs },
          { title: "Notification preferences saved locally" },
        );
      case "profileSettings":
        return void run(
          { kind: "updateProfile", displayName: displayName.trim() },
          { title: "Display name updated locally" },
        );
      case "support":
        return void run(
          {
            kind: "support",
            topic: supportTopic,
            message: supportMessage.trim(),
          },
          { title: "Support draft saved locally" },
        );
      default:
        return;
    }
  }
  async function manualRefresh() {
    setBusy(true);
    try {
      await mutation.mutateAsync({ kind: "refreshEarnings", source: "manual" });
      setTick(180);
      pushToast({
        tone: "info",
        title: "Source snapshot re-read locally",
        detail:
          "Updated timestamps only; no provider or pool valuation changed.",
      });
    } catch (e) {
      pushToast({
        tone: "error",
        title: e instanceof Error ? e.message : "Refresh failed",
      });
    } finally {
      setBusy(false);
    }
  }
  const modalFooter = (
    <>
      {wizard && step === 2 ? (
        <label className="iv-check iv-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            aria-label="Acknowledge session-only preview"
          />
          I have reviewed this {titles[modal?.kind ?? "help"].toLowerCase()}{" "}
          preview and understand it records session state only — no payment,
          transfer, message or provider change is sent.
        </label>
      ) : null}
      <button
        type="button"
        className="iv-btn"
        disabled={busy}
        onClick={() => (step ? setStep(step - 1) : close())}
      >
        {step ? "Back" : "Close"}
      </button>
      <span className="iv-foot-note">Session-only preview · no funds move</span>
      {wizard ? (
        <button
          type={
            modal?.kind === "calculator" && step === 0 ? "submit" : "button"
          }
          form={
            modal?.kind === "calculator" && step === 0
              ? "iv-calculator-form"
              : undefined
          }
          className="iv-btn iv-btn--primary"
          disabled={
            busy || (step < 2 && !!modalBlock) || (step === 2 && !confirmed)
          }
          onClick={() => {
            if (modal?.kind === "calculator" && step === 0) return;
            if (step < 2) setStep(step + 1);
            else void submit();
          }}
        >
          {busy
            ? "Working…"
            : step < 2
              ? "Continue →"
              : modal?.kind === "export"
                ? "Download evidence"
                : "Confirm local preview"}
        </button>
      ) : null}
    </>
  );

  return (
    <InvestorShell
      rootClass="page-investor-overview"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={poolBook}
      monthRoi={roi}
      walletBalance={data.wallet.available}
      unread={unread}
      activeNav={activeNav}
      quickActions={quickActions}
      onNavigate={scrollTo}
      onOpenDrawer={(tab) => setDrawer(tab)}
      onQuickAction={(key) => {
        if (key === "bookSlot") open("bookSlot");
        if (key === "payout") open("payout");
        if (key === "earnings") open("earningsDetail");
        if (key === "calculator") open("calculator");
        if (key === "invite") open("referral");
        if (key === "fees") open("fees");
      }}
      onOpenNotifications={() => setDrawer("activity")}
      onChromeReady={onChromeReady}
    >
      <div className="iv-page" id="iv-overview-top">
        <header className="iv-page-head">
          <div>
            <div className="iv-eyebrow">
              <span className="iv-code mono">I-1</span>
              <span>INVESTOR WORKSPACE / PORTFOLIO OVERVIEW</span>
            </div>
            <h1>Welcome back, {data.profile.firstName}</h1>
            <p>
              Your pooled positions, earnings and settlement activity at a
              glance.
            </p>
            <div className="iv-meta">
              <span>
                <Icon name="calendar" size={13} /> Investor since{" "}
                {atDate(data.profile.investorSince)} · {days} days
              </span>
              <button
                type="button"
                className="iv-meta-link"
                onClick={() => open("kycStatus")}
              >
                <Icon name="shield" size={13} /> KYC {data.profile.kycLevel}{" "}
                verified
              </button>
              <span>
                <Icon name="globe" size={13} /> {data.profile.country} ·{" "}
                {data.profile.currency}
              </span>
            </div>
          </div>
          <div className="iv-actions">
            <button
              type="button"
              className="iv-btn"
              onClick={() => open("tickerInfo")}
            >
              <Icon name="info" size={14} /> How earnings work
            </button>
            <button
              type="button"
              className="iv-btn iv-btn--primary"
              onClick={() => open("export")}
            >
              <Icon name="download" size={14} /> Statement
            </button>
          </div>
        </header>

        <div className="iv-demo-banner">
          <div>
            <b>FRONTEND INVESTOR SNAPSHOT</b>
            <span>
              Source as of {atDateTime(data.asOf)} · structured DTO · no live
              provider feed
            </span>
          </div>
          <button
            type="button"
            className="iv-link"
            onClick={() => open("help")}
          >
            Integration boundaries ↗
          </button>
        </div>

        <section className="iv-kpis" aria-label="Investor summary">
          <Kpi
            label="TOTAL INVESTED"
            value={<CountValue value={data.summary.totalInvested} />}
            foot={`${data.summary.activePools} active pools`}
            note="Committed across PKG-01 and PKG-03"
            icon="layers"
          />
          <Kpi
            label="ACTIVE POOLS"
            value={<span className="mono">{data.summary.activePools}</span>}
            foot={data.activePools.map((p) => p.code).join(" · ")}
            note="Both pools are in a trading window"
            icon="pool"
          />
          <Kpi
            label="EARNED THIS MONTH"
            value={<span className="mono text-win">+{money(month)}</span>}
            foot={<span className="text-win">{percent(roi)} ROI</span>}
            note="Realized distributions plus unrealized pool profit"
            tone="win"
            icon="trendUp"
          />
          <Kpi
            label="WALLET BALANCE"
            value={<CountValue value={data.wallet.available} />}
            foot="Available for withdrawal"
            note={`${money(data.wallet.pendingPayout)} payout in processing`}
            icon="wallet"
          />
        </section>

        <section id="iv-active-pools" className="iv-section">
          <SectionHead
            code="02 / ACTIVE POOL STATUS"
            title="Two pools are trading"
            hint="Funding progress, your profit share, time remaining and Guardian risk posture."
            action={
              <button
                type="button"
                className="iv-btn"
                onClick={() => setDrawer("guardian")}
              >
                <Icon name="shield" size={14} /> Guardian overview
              </button>
            }
          />
          <div className="iv-pools">
            {data.activePools.map((pool) => (
              <PoolCard
                key={pool.id}
                pool={pool}
                now={clock}
                onOpen={() => open("poolDetail", pool.id)}
                onTrades={() => open("liveTrades", pool.id)}
                onGuardian={() => open("guardianDetail", pool.id)}
              />
            ))}
          </div>
        </section>

        <section id="iv-earnings" className="iv-section">
          <div className="iv-ticker">
            <div className="iv-ticker-head">
              <div>
                <span className="iv-section-code">03 / EARNINGS TICKER</span>
                <h2>Live earnings by pool</h2>
                <p>
                  Last source update{" "}
                  {relativeLabel(data.earnings.updatedAt, clock)} · marks are
                  unrealized until settlement.
                </p>
              </div>
              <div className="iv-ticker-controls">
                <div
                  className="iv-ring"
                  aria-label={`Next automatic refresh in ${tick} seconds`}
                >
                  <svg viewBox="0 0 44 44" aria-hidden="true">
                    <circle cx="22" cy="22" r="18" className="iv-ring-track" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      className="iv-ring-value"
                      style={{ strokeDashoffset: 113 - (113 * tick) / 180 }}
                    />
                  </svg>
                  <span className="mono">
                    {Math.floor(tick / 60)}:{String(tick % 60).padStart(2, "0")}
                  </span>
                </div>
                <button
                  type="button"
                  className="iv-btn"
                  onClick={() => void manualRefresh()}
                  disabled={busy}
                >
                  <Icon name="refresh" size={14} /> Refresh now
                </button>
              </div>
            </div>
            <div className="iv-ticker-table">
              <div className="iv-ticker-row is-head">
                <span>POOL</span>
                <span>UNREALIZED PROFIT</span>
                <span>ROI</span>
                <span>UPDATED</span>
                <span />
              </div>
              {data.earnings.rows.map((row) => {
                const pool = data.activePools.find((p) => p.id === row.poolId);
                return (
                  <div className="iv-ticker-row" key={row.poolId}>
                    <div>
                      <b className="mono">{row.code}</b>
                      <small>{pool?.name}</small>
                    </div>
                    <span className="mono text-win">
                      {signedMoney(row.profit)}
                    </span>
                    <span className="mono text-win">{percent(row.roiPct)}</span>
                    <span className="mono">{atTime(row.updatedAt)}</span>
                    <button
                      type="button"
                      className="iv-link"
                      onClick={() => open("earningsDetail")}
                    >
                      Breakdown ↗
                    </button>
                  </div>
                );
              })}
              <div className="iv-ticker-row is-total">
                <div>
                  <b>Total across {data.activePools.length} pools</b>
                  <small>Weighted by committed capital</small>
                </div>
                <span className="mono text-win">{signedMoney(unrealized)}</span>
                <span className="mono text-win">
                  {percent((unrealized / data.summary.totalInvested) * 100)}
                </span>
                <span className="mono">Month +{money(month)}</span>
                <button
                  type="button"
                  className="iv-link"
                  onClick={() => open("earningsDetail")}
                >
                  All earnings ↗
                </button>
              </div>
            </div>
            <div className="iv-ticker-foot">
              <span>
                <Icon name="info" size={13} /> Auto-refresh runs every 3 minutes
                while this workspace is open. Countdown is local; no provider
                poll is made.
              </span>
              <div className="iv-ticker-links">
                <button
                  type="button"
                  className="iv-link"
                  onClick={() => open("notificationPrefs")}
                >
                  Refresh &amp; alert settings ↗
                </button>
                <button
                  type="button"
                  className="iv-link"
                  onClick={() => open("tickerInfo")}
                >
                  Methodology ↗
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="iv-upcoming" className="iv-section">
          <SectionHead
            code="04 / UPCOMING POOLS"
            title="Next allocation windows"
            hint="Reserve your intent now; payment and slot confirmation remain with the funding desk."
            action={
              <button
                type="button"
                className="iv-btn"
                onClick={() => open("reminders")}
              >
                <Icon name="bell" size={14} /> Manage reminders
              </button>
            }
          />
          <div className="iv-upcoming">
            {data.upcoming.map((pool) => (
              <UpcomingCard
                key={pool.id}
                pool={pool}
                now={clock}
                reminder={data.reminders.find((r) => r.poolId === pool.id)}
                booking={data.bookings.find((b) => b.poolId === pool.id)}
                onBook={() => open("bookSlot", pool.id)}
                onRemind={() => open("reminder", pool.id)}
                onDetail={() => open("upcomingDetail", pool.id)}
              />
            ))}
          </div>
        </section>

        <section id="iv-activity" className="iv-section">
          <SectionHead
            code="05 / RECENT ACTIVITY"
            title="Portfolio ledger"
            hint="Latest ten observations across trades, funding, payouts and risk controls."
            action={
              <div className="iv-actions">
                <button
                  type="button"
                  className="iv-btn"
                  onClick={() =>
                    void run(
                      { kind: "markAllRead" },
                      {
                        keep: true,
                        title: "All observations marked read locally",
                      },
                    )
                  }
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  className="iv-btn"
                  onClick={() => open("activityLog")}
                >
                  View all {data.activity.length}
                </button>
              </div>
            }
          />
          <div className="iv-activity">
            {data.activity.slice(0, 10).map((item) => (
              <button
                type="button"
                className="iv-activity-row"
                key={item.id}
                onClick={() => open("activityDetail", item.id)}
              >
                <span className={`iv-activity-icon is-${item.kind}`}>
                  <Icon name={activityIcon[item.kind]} size={15} />
                </span>
                <span className="iv-activity-main">
                  <span className="iv-activity-title">
                    {!item.read ? (
                      <span className="iv-unread-dot" aria-label="Unread" />
                    ) : null}
                    {item.title}
                  </span>
                  <span className="iv-activity-detail">{item.detail}</span>
                </span>
                <span className="iv-activity-amount">
                  {item.share !== null ? (
                    <b className="mono text-win">{signedMoney(item.share)}</b>
                  ) : item.amount !== null ? (
                    <b className="mono">{money(item.amount, 2)}</b>
                  ) : (
                    <b className="iv-muted">—</b>
                  )}
                  <small>{atTime(item.at)}</small>
                </span>
                <span className={`iv-tag is-${item.status}`}>
                  {item.status.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
          {data.activity.length > 10 ? (
            <button
              type="button"
              className="iv-more"
              onClick={() => open("activityLog")}
            >
              Show {data.activity.length - 10} earlier observations →
            </button>
          ) : null}
        </section>

        <section id="iv-quick" className="iv-section">
          <SectionHead
            code="06 / QUICK ACTIONS"
            title="Move your portfolio forward"
            hint="Every action opens a complete local workflow; no payment, transfer or message is sent."
          />
          <div className="iv-quick">
            {[
              {
                kind: "bookSlot" as const,
                title: "Book a pool slot",
                text: "Reserve an upcoming allocation and review the hold before confirming.",
                icon: "pool" as IconName,
              },
              {
                kind: "earningsDetail" as const,
                title: "View earnings",
                text: "Inspect realized distributions, unrealized marks and pool-level ROI.",
                icon: "trendUp" as IconName,
              },
              {
                kind: "payout" as const,
                title: "Request a payout",
                text: "Prepare a withdrawal draft against your withdrawable wallet balance.",
                icon: "wallet" as IconName,
              },
              {
                kind: "calculator" as const,
                title: "Return calculator",
                text: "Project a pool outcome from principal, target ROI and duration.",
                icon: "chart" as IconName,
              },
            ].map((action) => (
              <button
                type="button"
                className="iv-quick-card"
                key={action.kind}
                onClick={() => open(action.kind)}
              >
                <span className="iv-quick-icon">
                  <Icon name={action.icon} size={17} />
                </span>
                <span>
                  <b>{action.title}</b>
                  <small>{action.text}</small>
                </span>
                <Icon name="arrowRight" size={15} />
              </button>
            ))}
          </div>
        </section>

        <footer className="iv-page-foot">
          <span>
            LOCAL INVESTOR DEMO / source snapshot · no settlement authority · no
            provider connection
          </span>
          <div>
            <button
              type="button"
              className="iv-link"
              onClick={() => open("help")}
            >
              Workspace boundaries
            </button>
            <button
              type="button"
              className="iv-link"
              onClick={() => open("support")}
            >
              Contact desk
            </button>
            <Link className="iv-link" href="/dashboard">
              Operator console ↗
            </Link>
          </div>
        </footer>
      </div>

      {drawer ? (
        <div
          className="op-drawer-backdrop iv-drawer-layer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <aside
            className="op-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Investor inspector"
          >
            <div className="op-drawer__head">
              <div>
                <span className="iv-section-code">
                  I-1 / INVESTOR INSPECTOR
                </span>
                <h2 className="op-drawer__title">{data.profile.displayName}</h2>
                <p className="iv-muted">
                  {data.profile.tier} · KYC {data.profile.kycLevel}
                </p>
              </div>
              <button
                type="button"
                className="desk-icon-btn"
                onClick={close}
                aria-label="Close investor inspector"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <div
              className="iv-drawer-tabs"
              role="tablist"
              aria-label="Inspector views"
            >
              {(["portfolio", "activity", "guardian"] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  role="tab"
                  aria-selected={drawer === tab}
                  className={drawer === tab ? "is-active" : ""}
                  onClick={() => setDrawer(tab)}
                >
                  {tab === "portfolio"
                    ? "Portfolio"
                    : tab === "activity"
                      ? "Activity"
                      : "Guardian"}
                </button>
              ))}
            </div>
            <div className="op-drawer__body">
              {drawer === "portfolio" ? (
                <>
                  <div className="iv-drawer-summary">
                    <div>
                      <span>POOL BOOK</span>
                      <b className="mono">{money(poolBook)}</b>
                    </div>
                    <div>
                      <span>UNREALIZED</span>
                      <b className="mono text-win">{signedMoney(unrealized)}</b>
                    </div>
                    <div>
                      <span>MONTH ROI</span>
                      <b className="mono text-win">{percent(roi)}</b>
                    </div>
                  </div>
                  <div className="iv-drawer-block">
                    <div className="iv-section-code">ALLOCATION MIX</div>
                    {data.activePools.map((pool) => (
                      <div className="iv-mix-row" key={pool.id}>
                        <span>
                          {pool.code}
                          <small>{pool.name}</small>
                        </span>
                        <div className="iv-progress">
                          <span
                            style={{
                              width: `${Math.round((pool.investment / Math.max(poolBook, 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <b className="mono">
                          {percent(
                            (pool.investment / Math.max(poolBook, 1)) * 100,
                          )}
                        </b>
                      </div>
                    ))}
                    <div className="iv-drawer-note">
                      <Icon name="clock" size={13} />{" "}
                      {data.activePools[0]?.code} settles in{" "}
                      {countdownLabel(
                        data.activePools[0]?.endsAt ?? clock,
                        clock,
                      )}{" "}
                      · distributions follow the settlement batch
                    </div>
                  </div>
                  <div className="iv-drawer-list">
                    {data.portfolio.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => open("investmentDetail", item.id)}
                      >
                        <div>
                          <b>
                            {item.code} · {item.name}
                          </b>
                          <small>
                            {item.status} · {item.sharePct}% profit share
                          </small>
                        </div>
                        <div>
                          <b className="mono">{money(item.currentValue)}</b>
                          <small
                            className={
                              item.profit >= 0 ? "text-win" : "text-loss"
                            }
                          >
                            {signedMoney(item.profit)}
                          </small>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="iv-drawer-actions">
                    <button
                      type="button"
                      className="iv-btn"
                      onClick={() => open("portfolioDetail")}
                    >
                      Open full portfolio
                    </button>
                    <button
                      type="button"
                      className="iv-btn iv-btn--primary"
                      onClick={() => open("payout")}
                    >
                      Request payout
                    </button>
                  </div>
                </>
              ) : drawer === "activity" ? (
                <>
                  <div className="iv-drawer-headline">
                    <span>
                      {unread} unread observation{unread === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      className="iv-link"
                      onClick={() =>
                        void run(
                          { kind: "markAllRead" },
                          {
                            keep: true,
                            title: "All observations marked read locally",
                          },
                        )
                      }
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="iv-drawer-list">
                    {data.notifications.map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() =>
                          void run(
                            { kind: "markRead", id: n.id },
                            {
                              keep: true,
                              title: "Notification marked read locally",
                            },
                          )
                        }
                      >
                        <div>
                          <b>{n.title}</b>
                          <small>
                            {relativeLabel(n.at, clock)} · {n.kind}
                          </small>
                        </div>
                        {!n.read ? (
                          <span className="iv-unread-dot" aria-label="Unread" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="iv-btn iv-drawer-wide"
                    onClick={() => open("activityLog")}
                  >
                    Open activity log
                  </button>
                </>
              ) : (
                <>
                  <div className="iv-drawer-headline">
                    <span>Two active pools under policy</span>
                    <button
                      type="button"
                      className="iv-link"
                      onClick={() =>
                        open("guardianDetail", data.activePools[0].id)
                      }
                    >
                      Open policy
                    </button>
                  </div>
                  {data.activePools.map((pool) => (
                    <div className="iv-guardian-block" key={pool.id}>
                      <div>
                        <b>
                          {pool.code} · {pool.name}
                        </b>
                        <span className="iv-tag">ACTIVE</span>
                      </div>
                      <p>{pool.guardian.note}</p>
                      <div className="iv-meter">
                        <span
                          style={{
                            width: `${Math.min(100, (pool.guardian.drawdownPct / pool.guardian.drawdownLimitPct) * 100)}%`,
                          }}
                        />
                      </div>
                      <small className="mono">
                        Drawdown {pool.guardian.drawdownPct}% of{" "}
                        {pool.guardian.drawdownLimitPct}% limit · losses{" "}
                        {pool.guardian.consecutiveLosses}/
                        {pool.guardian.maxConsecutiveLosses}
                      </small>
                    </div>
                  ))}
                  <div className="iv-drawer-headline">
                    <span>Recent risk events</span>
                  </div>
                  <div className="iv-drawer-list">
                    {data.guardianLog.slice(0, 4).map((event) => (
                      <div className="iv-drawer-row" key={event.id}>
                        <div>
                          <b>{event.event}</b>
                          <small>
                            {atDateTime(event.at)} · {event.result}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="op-drawer__foot">
              <button
                type="button"
                className="iv-btn"
                onClick={() => open("support")}
              >
                Contact desk
              </button>
              <button
                type="button"
                className="iv-btn iv-btn--primary"
                onClick={() => setDrawer("portfolio")}
              >
                Portfolio
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {modal ? (
        <div className="iv-modal-layer">
          <DeskModalShell
            code="I-1"
            eyebrow="INVESTOR WORKSPACE / LOCAL PREVIEW"
            title={titles[modal.kind]}
            subtitle="Structured session state. Payments, settlement, provider data and messaging require authenticated backend integration."
            size={modalSize[modal.kind] ?? "md"}
            onClose={close}
            steps={
              wizard ? ["Prepare", "Review impact", "Acknowledge"] : undefined
            }
            currentStep={step}
            footer={modalFooter}
          >
            {error ? (
              <div className="iv-error" role="alert">
                {error}
              </div>
            ) : null}
            {wizard && modalBlock && step < 2 ? (
              <div className="iv-inline-note is-warn" role="status">
                {modalBlock}
              </div>
            ) : null}

            {modal.kind === "poolDetail" && modalPool ? (
              <>
                <div className="iv-modal-title">
                  <div>
                    <span className="iv-code mono">{modalPool.code}</span>
                    <h3>{modalPool.name}</h3>
                    <p>{modalPool.strategy}</p>
                  </div>
                  <span className="iv-tag">
                    {modalPool.status.toUpperCase()}
                  </span>
                </div>
                <div className="iv-kv-grid">
                  <div>
                    <span>Your allocation</span>
                    <b className="mono">{money(modalPool.investment)}</b>
                  </div>
                  <div>
                    <span>Profit share</span>
                    <b className="mono">{modalPool.profitSharePct}%</b>
                  </div>
                  <div>
                    <span>Your share P&amp;L</span>
                    <b className="mono text-win">
                      {signedMoney(modalPool.sharePnl)}
                    </b>
                  </div>
                  <div>
                    <span>Return on allocation</span>
                    <b className="mono text-win">{percent(modalPool.roiPct)}</b>
                  </div>
                  <div>
                    <span>Pool P&amp;L</span>
                    <b className="mono text-win">
                      {signedMoney(modalPool.pnl)}
                    </b>
                  </div>
                  <div>
                    <span>Win rate</span>
                    <b className="mono">{modalPool.winRatePct}%</b>
                  </div>
                  <div>
                    <span>Trading ends</span>
                    <b className="mono">
                      {countdownLabel(modalPool.endsAt, clock)}
                    </b>
                  </div>
                  <div>
                    <span>Settled trades</span>
                    <b className="mono">{modalPool.trades}</b>
                  </div>
                </div>
                <div className="iv-progress-block">
                  <div>
                    <span>Funding progress</span>
                    <b className="mono">
                      {Math.round(
                        poolProgress(modalPool.raised, modalPool.goal),
                      )}
                      %
                    </b>
                  </div>
                  <Progress raised={modalPool.raised} goal={modalPool.goal} />
                  <small>
                    {money(modalPool.raised)} raised of {money(modalPool.goal)}{" "}
                    goal
                  </small>
                </div>
                <div className="iv-guardian-card">
                  <div>
                    <Icon name="shield" size={15} />
                    <b>Guardian risk controls</b>
                    <span className="iv-tag is-active">ACTIVE</span>
                  </div>
                  <p>{modalPool.guardian.note}</p>
                  <div className="iv-guardian-line">
                    <span>
                      Drawdown {modalPool.guardian.drawdownPct}% /{" "}
                      {modalPool.guardian.drawdownLimitPct}%
                    </span>
                    <span>
                      Loss streak {modalPool.guardian.consecutiveLosses} /{" "}
                      {modalPool.guardian.maxConsecutiveLosses}
                    </span>
                    <span>
                      Checked {atTime(modalPool.guardian.lastCheckedAt)}
                    </span>
                  </div>
                </div>
                <div className="iv-modal-grid">
                  <div>
                    <span>Markets in scope</span>
                    <b>{modalPool.markets.join(" · ")}</b>
                  </div>
                  <div>
                    <span>Pool started</span>
                    <b>{atDate(modalPool.startedAt)}</b>
                  </div>
                  <div>
                    <span>Your slots</span>
                    <b>
                      {modalPool.userSlots} × {money(modalPool.slotPrice)}
                    </b>
                  </div>
                  <div>
                    <span>Next opening</span>
                    <b>
                      {data.upcoming[0]?.code} ·{" "}
                      {atDate(data.upcoming[0]?.opensAt ?? data.asOf)}
                    </b>
                  </div>
                </div>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("liveTrades", modalPool.id)}
                  >
                    Live trades
                  </button>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("guardianDetail", modalPool.id)}
                  >
                    Guardian policy
                  </button>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("bookSlot")}
                  >
                    Book next cycle
                  </button>
                </div>
                <p className="iv-note">
                  Pool profit is marked to the source snapshot and can fall.
                  Past or target returns are not guarantees. Capital at risk.
                </p>
              </>
            ) : null}

            {modal.kind === "liveTrades" ? (
              <>
                <div className="iv-filter-row">
                  <label className="iv-field">
                    Pool
                    <select
                      className="form-select"
                      aria-label="Trade pool filter"
                      value={tradeFilter}
                      onChange={(e) => setTradeFilter(e.target.value)}
                    >
                      <option value="all">All active pools</option>
                      {data.activePools.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} · {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="iv-filter-stats">
                    <span>Matched trades</span>
                    <b className="mono">{tradeRows.length}</b>
                    <span>Your share</span>
                    <b className="mono text-win">
                      {signedMoney(tradeRows.reduce((s, t) => s + t.share, 0))}
                    </b>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table iv-table">
                    <thead>
                      <tr>
                        {[
                          "Trade",
                          "Pool",
                          "Market / contract",
                          "Stake",
                          "Pool P&L",
                          "Your share",
                          "Result",
                          "Closed",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tradeRows.map((trade) => (
                        <tr key={trade.id}>
                          <td>
                            <button
                              type="button"
                              className="iv-link"
                              onClick={() => open("tradeDetail", trade.id)}
                            >
                              {trade.id}
                            </button>
                          </td>
                          <td className="mono">{trade.poolCode}</td>
                          <td>
                            <b>{trade.symbol}</b>
                            <small>{trade.contract}</small>
                          </td>
                          <td className="mono">{money(trade.stake)}</td>
                          <td
                            className={`mono ${trade.profit >= 0 ? "text-win" : "text-loss"}`}
                          >
                            {signedMoney(trade.profit)}
                          </td>
                          <td
                            className={`mono ${trade.share >= 0 ? "text-win" : "text-loss"}`}
                          >
                            {signedMoney(trade.share)}
                          </td>
                          <td>
                            <span
                              className={`iv-tag ${trade.result === "win" ? "is-settled" : "is-attention"}`}
                            >
                              {trade.result.toUpperCase()}
                            </span>
                          </td>
                          <td className="mono">{atTime(trade.closedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="iv-note">
                  Source trade observations carried by the overview DTO. All
                  rows are read-only; your share is derived from the pool profit
                  share.
                </p>
              </>
            ) : null}

            {modal.kind === "tradeDetail" && modalTrade ? (
              <>
                <div className="iv-modal-title">
                  <div>
                    <span className="iv-code mono">{modalTrade.id}</span>
                    <h3>
                      {modalTrade.symbol} · {modalTrade.contract}
                    </h3>
                    <p>
                      {modalTrade.poolCode} settlement record ·{" "}
                      {atDateTime(modalTrade.closedAt)}
                    </p>
                  </div>
                  <span
                    className={`iv-tag ${modalTrade.result === "win" ? "is-settled" : "is-attention"}`}
                  >
                    {modalTrade.result.toUpperCase()}
                  </span>
                </div>
                <div className="iv-kv-grid">
                  <div>
                    <span>Pool stake</span>
                    <b className="mono">{money(modalTrade.stake)}</b>
                  </div>
                  <div>
                    <span>Pool P&amp;L</span>
                    <b
                      className={`mono ${modalTrade.profit >= 0 ? "text-win" : "text-loss"}`}
                    >
                      {signedMoney(modalTrade.profit)}
                    </b>
                  </div>
                  <div>
                    <span>Your profit share</span>
                    <b
                      className={`mono ${modalTrade.share >= 0 ? "text-win" : "text-loss"}`}
                    >
                      {signedMoney(modalTrade.share)}
                    </b>
                  </div>
                  <div>
                    <span>Contract</span>
                    <b>{modalTrade.contract}</b>
                  </div>
                </div>
                <div className="iv-note">
                  Synthetic source evidence. This is not a broker contract note,
                  tax statement or independently reconciled settlement record.
                </div>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("poolDetail", modalTrade.poolId)}
                  >
                    Open pool
                  </button>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("liveTrades", modalTrade.poolId)}
                  >
                    All pool trades
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "tickerInfo" ? (
              <>
                <div className="iv-kv-grid">
                  <div>
                    <span>Update cadence</span>
                    <b>Every 3 minutes while open</b>
                  </div>
                  <div>
                    <span>Last source mark</span>
                    <b>{atDateTime(data.earnings.updatedAt)}</b>
                  </div>
                  <div>
                    <span>Next local countdown</span>
                    <b>
                      {Math.floor(tick / 60)}m{" "}
                      {String(tick % 60).padStart(2, "0")}s
                    </b>
                  </div>
                  <div>
                    <span>Auto-refresh preference</span>
                    <b>
                      {data.preferences.autoRefresh ? "Enabled" : "Disabled"}
                    </b>
                  </div>
                </div>
                <div className="iv-section-code">HOW THE NUMBERS WORK</div>
                <ul className="iv-list">
                  <li>
                    Pool P&amp;L is an unrealized snapshot from the operator
                    desk; your share equals pool P&amp;L × your profit-share
                    percentage.
                  </li>
                  <li>
                    ROI is expressed against your committed allocation, not
                    total pool capital.
                  </li>
                  <li>
                    Month earnings combine realized distributions already paid
                    this month with unrealized active-pool marks.
                  </li>
                  <li>
                    Refreshing re-reads the structured snapshot. It does not
                    poll Deriv, recalculate trades or contact a payment
                    provider.
                  </li>
                </ul>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn iv-btn--primary"
                    onClick={() => void manualRefresh()}
                    disabled={busy}
                  >
                    Refresh source snapshot
                  </button>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("earningsDetail")}
                  >
                    Open earnings breakdown
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "earningsDetail" ? (
              <>
                <div className="iv-breakdown">
                  <div>
                    <span>UNREALIZED · ACTIVE POOLS</span>
                    <b className="mono text-win">{signedMoney(unrealized)}</b>
                    <small>
                      {data.activePools.length} pools marked to source
                    </small>
                  </div>
                  <div>
                    <span>REALIZED · THIS MONTH</span>
                    <b className="mono text-win">
                      {signedMoney(data.earnings.realizedThisMonth)}
                    </b>
                    <small>Paid distribution from PKG-06</small>
                  </div>
                  <div>
                    <span>TOTAL MONTH EARNINGS</span>
                    <b className="mono text-win">{signedMoney(month)}</b>
                    <small>
                      {percent(roi)} on {money(data.summary.totalInvested)}
                    </small>
                  </div>
                </div>
                <div className="iv-section-code">POOL-LEVEL POSITION</div>
                <div className="table-responsive">
                  <table className="table iv-table">
                    <thead>
                      <tr>
                        <th>Pool</th>
                        <th>Allocation</th>
                        <th>Profit share</th>
                        <th>Unrealized</th>
                        <th>ROI</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activePools.map((pool) => (
                        <tr key={pool.id}>
                          <td>
                            <b>{pool.code}</b>
                            <small>{pool.name}</small>
                          </td>
                          <td className="mono">{money(pool.investment)}</td>
                          <td className="mono">{pool.profitSharePct}%</td>
                          <td className="mono text-win">
                            {signedMoney(pool.sharePnl)}
                          </td>
                          <td className="mono text-win">
                            {percent(pool.roiPct)}
                          </td>
                          <td className="mono">
                            {atTime(data.earnings.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="iv-section-code">DISTRIBUTION RECEIPTS</div>
                <div className="iv-receipt-list">
                  {data.receipts.map((receipt) => (
                    <div key={receipt.id}>
                      <div>
                        <b>
                          {receipt.code} · {receipt.id}
                        </b>
                        <small>
                          {atDate(receipt.paidAt)} · {receipt.status}
                        </small>
                      </div>
                      <span className="mono">
                        {money(receipt.netAmount, 2)}
                      </span>
                      <button
                        type="button"
                        className="iv-link"
                        onClick={() => open("receipt", receipt.id)}
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("export")}
                  >
                    Export earnings
                  </button>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("tickerInfo")}
                  >
                    Read methodology
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "receipt" && modalReceipt ? (
              <>
                <div className="iv-modal-title">
                  <div>
                    <span className="iv-code mono">{modalReceipt.id}</span>
                    <h3>{modalReceipt.code} distribution</h3>
                    <p>Paid {atDateTime(modalReceipt.paidAt)}</p>
                  </div>
                  <span className="iv-tag is-settled">SETTLED</span>
                </div>
                <div className="iv-kv-grid">
                  <div>
                    <span>Net amount</span>
                    <b className="mono">{money(modalReceipt.netAmount, 2)}</b>
                  </div>
                  <div>
                    <span>Pool</span>
                    <b>{modalReceipt.code}</b>
                  </div>
                  <div>
                    <span>Source state</span>
                    <b>{modalReceipt.status}</b>
                  </div>
                  <div>
                    <span>Investor</span>
                    <b>{data.profile.displayName}</b>
                  </div>
                </div>
                <p className="iv-note">
                  Synthetic distribution evidence, not a bank statement or tax
                  document. A production receipt must be issued and reconciled
                  by the settlement ledger.
                </p>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn iv-btn--primary"
                    onClick={() => void downloadReceipt(modalReceipt)}
                  >
                    Download demo PDF
                  </button>
                </div>
              </>
            ) : null}

            {wizard && modal.kind === "bookSlot" ? (
              step === 0 ? (
                <>
                  <div className="iv-form-grid">
                    <label className="iv-field">
                      Upcoming pool
                      <select
                        className="form-select"
                        aria-label="Booking pool"
                        value={bookPoolId}
                        onChange={(e) => {
                          setBookPoolId(e.target.value);
                          setBookSlots(1);
                        }}
                      >
                        {data.upcoming.map((pool) => (
                          <option key={pool.id} value={pool.id}>
                            {pool.code} · {pool.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="iv-field">
                      Slots
                      <input
                        className="form-control"
                        aria-label="Booking slots"
                        type="number"
                        min={1}
                        max={10}
                        value={bookSlots}
                        onChange={(e) =>
                          setBookSlots(
                            Math.max(
                              1,
                              Math.min(10, Number(e.target.value) || 1),
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  {bookPool ? (
                    <>
                      <div className="iv-kv-grid">
                        <div>
                          <span>Allocation</span>
                          <b className="mono">
                            {money(bookPool.minInvestment * bookSlots)}
                          </b>
                        </div>
                        <div>
                          <span>Price per slot</span>
                          <b className="mono">
                            {money(bookPool.minInvestment)}
                          </b>
                        </div>
                        <div>
                          <span>Opens</span>
                          <b>{atDateTime(bookPool.opensAt)}</b>
                        </div>
                        <div>
                          <span>Remaining capacity</span>
                          <b className="mono">{money(bookPool.capacity)}</b>
                        </div>
                      </div>
                      <div className="iv-note">
                        This is a reservation intent only. No payment is
                        captured, no wallet funds are reserved, and the funding
                        desk must confirm the slot through a production booking
                        flow.
                      </div>
                    </>
                  ) : (
                    <p className="iv-empty">No upcoming pool is available.</p>
                  )}
                </>
              ) : step === 1 ? (
                <>
                  <div className="iv-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {bookPool?.code} · {bookPool?.name}
                      </b>
                    </div>
                    <div>
                      <span>Slots</span>
                      <b className="mono">{bookSlots}</b>
                    </div>
                    <div>
                      <span>Local hold amount</span>
                      <b className="mono">
                        {money((bookPool?.minInvestment ?? 0) * bookSlots)}
                      </b>
                    </div>
                    <div>
                      <span>Opening</span>
                      <b>{bookPool ? atDateTime(bookPool.opensAt) : "—"}</b>
                    </div>
                    <div>
                      <span>Target ROI</span>
                      <b className="mono">
                        {bookPool ? percent(bookPool.expectedRoiPct, 1) : "—"}
                      </b>
                    </div>
                    <div>
                      <span>Risk band</span>
                      <b>{bookPool?.riskBand}</b>
                    </div>
                  </div>
                  <div className="iv-inline-note is-warn">
                    <Icon name="info" size={13} /> A booking hold is not a
                    confirmed allocation and does not obligate either party.
                    Target returns are hypothetical.
                  </div>
                </>
              ) : (
                <div className="iv-review-final">
                  <Icon name="pool" size={20} />
                  <p>
                    Confirm that this local booking hold should be recorded in
                    the session workspace. It will appear on the upcoming pool
                    card and in the audit trail.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "reminder" ? (
              step === 0 ? (
                <>
                  <div className="iv-form-grid">
                    <label className="iv-field">
                      Upcoming pool
                      <select
                        className="form-select"
                        aria-label="Reminder pool"
                        value={remindPoolId}
                        onChange={(e) => setRemindPoolId(e.target.value)}
                      >
                        {data.upcoming.map((pool) => (
                          <option key={pool.id} value={pool.id}>
                            {pool.code} · {pool.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="iv-field">
                      Lead time
                      <select
                        className="form-select"
                        aria-label="Reminder lead time"
                        value={remindLead}
                        onChange={(e) =>
                          setRemindLead(Number(e.target.value) as 1 | 2 | 3 | 7)
                        }
                      >
                        {[1, 2, 3, 7].map((n) => (
                          <option key={n} value={n}>
                            {n} day{n === 1 ? "" : "s"} before opening
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="iv-field">
                      Channel preference
                      <select
                        className="form-select"
                        aria-label="Reminder channel"
                        value={remindChannel}
                        onChange={(e) =>
                          setRemindChannel(e.target.value as "email" | "in_app")
                        }
                      >
                        <option value="email">Email preference</option>
                        <option value="in_app">In-app only</option>
                      </select>
                    </label>
                  </div>
                  {remindPool ? (
                    <div className="iv-note">
                      {remindPool.code} opens {atDateTime(remindPool.opensAt)}.
                      Reminder metadata is stored locally; no email or push
                      message is scheduled or sent.
                    </div>
                  ) : null}
                </>
              ) : step === 1 ? (
                <div className="iv-review">
                  <div>
                    <span>Pool</span>
                    <b>
                      {remindPool?.code} · {remindPool?.name}
                    </b>
                  </div>
                  <div>
                    <span>Lead time</span>
                    <b>
                      {remindLead} day{remindLead === 1 ? "" : "s"}
                    </b>
                  </div>
                  <div>
                    <span>Preference</span>
                    <b>{remindChannel === "email" ? "Email" : "In-app"}</b>
                  </div>
                  <div>
                    <span>Opening</span>
                    <b>{remindPool ? atDateTime(remindPool.opensAt) : "—"}</b>
                  </div>
                </div>
              ) : (
                <div className="iv-review-final">
                  <Icon name="bell" size={20} />
                  <p>
                    Confirm a local reminder preference for this opening window.
                    Delivery remains a backend responsibility and is explicitly
                    not simulated.
                  </p>
                </div>
              )
            ) : null}

            {modal.kind === "reminders" ? (
              <>
                <div className="iv-drawer-headline">
                  <span>
                    {data.reminders.length} opening reminder
                    {data.reminders.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("reminder")}
                  >
                    Set reminder
                  </button>
                </div>
                {!data.reminders.length ? (
                  <div className="iv-empty">
                    No opening reminders yet. Choose an upcoming pool and set
                    one.
                  </div>
                ) : null}
                {data.reminders.map((reminder) => {
                  const pool = data.upcoming.find(
                    (p) => p.id === reminder.poolId,
                  );
                  return (
                    <div className="iv-reminder-row" key={reminder.poolId}>
                      <div>
                        <b>
                          {pool?.code} · {pool?.name}
                        </b>
                        <small>
                          {reminder.leadDays} day lead ·{" "}
                          {reminder.channel === "email" ? "email" : "in-app"} ·
                          created {atTime(reminder.createdAt)}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="iv-link"
                        onClick={() =>
                          void run(
                            { kind: "removeReminder", poolId: reminder.poolId },
                            { keep: true, title: "Reminder removed locally" },
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </>
            ) : null}

            {modal.kind === "upcomingDetail" && modalUpcoming ? (
              <>
                <div className="iv-modal-title">
                  <div>
                    <span className="iv-code mono">{modalUpcoming.code}</span>
                    <h3>{modalUpcoming.name}</h3>
                    <p>{modalUpcoming.focus}</p>
                  </div>
                  <span className="iv-tag">
                    {modalUpcoming.riskBand.toUpperCase()}
                  </span>
                </div>
                <div className="iv-kv-grid">
                  <div>
                    <span>Opens</span>
                    <b>{atDateTime(modalUpcoming.opensAt)}</b>
                  </div>
                  <div>
                    <span>Minimum per slot</span>
                    <b className="mono">{money(modalUpcoming.minInvestment)}</b>
                  </div>
                  <div>
                    <span>Duration</span>
                    <b>{modalUpcoming.durationDays} days</b>
                  </div>
                  <div>
                    <span>Target ROI</span>
                    <b className="mono text-win">
                      {percent(modalUpcoming.expectedRoiPct, 1)}
                    </b>
                  </div>
                  <div>
                    <span>Capacity</span>
                    <b className="mono">{money(modalUpcoming.capacity)}</b>
                  </div>
                  <div>
                    <span>Bookings</span>
                    <b>
                      {data.bookings.some((b) => b.poolId === modalUpcoming.id)
                        ? "Local hold prepared"
                        : "Not booked"}
                    </b>
                  </div>
                </div>
                <p className="iv-note">
                  Target ROI is an underwriting assumption, not a promise. Pool
                  capacity, slot price and duration are source fields that a
                  production API must validate at booking time.
                </p>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("reminder", modalUpcoming.id)}
                  >
                    Set reminder
                  </button>
                  <button
                    type="button"
                    className="iv-btn iv-btn--primary"
                    onClick={() => open("bookSlot", modalUpcoming.id)}
                  >
                    Book slot
                  </button>
                </div>
              </>
            ) : null}

            {wizard && modal.kind === "payout" ? (
              step === 0 ? (
                <>
                  <div className="iv-form-grid">
                    <label className="iv-field">
                      Amount / USD
                      <input
                        className="form-control"
                        aria-label="Payout amount"
                        type="number"
                        min={50}
                        max={data.wallet.available}
                        step={0.01}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                      />
                    </label>
                    <label className="iv-field">
                      Destination
                      <select
                        className="form-select"
                        aria-label="Payout method"
                        value={payoutMethodId}
                        onChange={(e) => setPayoutMethodId(e.target.value)}
                      >
                        {data.wallet.methods
                          .filter((m) => m.active)
                          .map((method) => (
                            <option key={method.id} value={method.id}>
                              {method.label} · {method.detail}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="iv-kv-grid">
                    <div>
                      <span>Withdrawable</span>
                      <b className="mono">{money(data.wallet.available, 2)}</b>
                    </div>
                    <div>
                      <span>Method fee</span>
                      <b className="mono">{money(activeMethod?.fee ?? 0, 2)}</b>
                    </div>
                    <div>
                      <span>Est. net received</span>
                      <b className="mono">
                        {money(
                          Math.max(0, payoutValue - (activeMethod?.fee ?? 0)),
                          2,
                        )}
                      </b>
                    </div>
                    <div>
                      <span>Minimum</span>
                      <b className="mono">
                        {money(activeMethod?.minAmount ?? 50)}
                      </b>
                    </div>
                  </div>
                  <div className="iv-note">
                    A payout draft is recorded locally. Withdrawable balance is
                    unchanged, and no transfer, provider request or settlement
                    action is made.
                  </div>
                </>
              ) : step === 1 ? (
                <div className="iv-review">
                  <div>
                    <span>Amount</span>
                    <b className="mono">{money(payoutValue, 2)}</b>
                  </div>
                  <div>
                    <span>Method</span>
                    <b>
                      {activeMethod?.label} · {activeMethod?.detail}
                    </b>
                  </div>
                  <div>
                    <span>Fee</span>
                    <b className="mono">{money(activeMethod?.fee ?? 0, 2)}</b>
                  </div>
                  <div>
                    <span>Est. net</span>
                    <b className="mono">
                      {money(
                        Math.max(0, payoutValue - (activeMethod?.fee ?? 0)),
                        2,
                      )}
                    </b>
                  </div>
                  <div>
                    <span>Source balance</span>
                    <b className="mono">
                      {money(data.wallet.available, 2)} (unchanged)
                    </b>
                  </div>
                </div>
              ) : (
                <div className="iv-review-final">
                  <Icon name="wallet" size={20} />
                  <p>
                    Confirm that this payout draft can be recorded locally for
                    later review. It will remain “preview waiting for source”
                    and does not move money.
                  </p>
                </div>
              )
            ) : null}

            {modal.kind === "payoutMethods" ? (
              <>
                {data.wallet.methods.map((method) => (
                  <div className="iv-method-row" key={method.id}>
                    <div>
                      <b>{method.label}</b>
                      <small>{method.detail}</small>
                    </div>
                    <div>
                      <span>Fee</span>
                      <b className="mono">{money(method.fee, 2)}</b>
                      <span>Minimum</span>
                      <b className="mono">{money(method.minAmount)}</b>
                    </div>
                    <button
                      type="button"
                      className="iv-btn"
                      onClick={() => {
                        setPayoutMethodId(method.id);
                        open("payout");
                      }}
                    >
                      Use method
                    </button>
                  </div>
                ))}
                <p className="iv-note">
                  Method metadata is a source snapshot. Production must verify
                  the beneficiary, run sanctions and ownership checks, and
                  perform payouts through an authorised provider.
                </p>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("support")}
                  >
                    Ask about a method
                  </button>
                  <button
                    type="button"
                    className="iv-btn iv-btn--primary"
                    onClick={() => open("payout")}
                  >
                    Request payout
                  </button>
                </div>
              </>
            ) : null}

            {wizard && modal.kind === "calculator" ? (
              step === 0 ? (
                <>
                  <CalculatorFields
                    initial={calc}
                    onValid={(value) => {
                      setCalc(value);
                      setStep(1);
                    }}
                  />
                  <div className="iv-note">
                    Projection math only. It ignores fees, drawdown, early
                    termination and variable pool performance; it is not a
                    forecast or advice.
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="iv-breakdown">
                    <div>
                      <span>PRINCIPAL</span>
                      <b className="mono">{money(calc.principal)}</b>
                      <small>{calc.days} day horizon</small>
                    </div>
                    <div>
                      <span>PROJECTED PROFIT</span>
                      <b className="mono text-win">
                        {signedMoney(projections.profit)}
                      </b>
                      <small>at {calc.roiPct}% target ROI</small>
                    </div>
                    <div>
                      <span>PROJECTED TOTAL</span>
                      <b className="mono">{money(projections.total)}</b>
                      <small>before fees or tax</small>
                    </div>
                  </div>
                  <div className="iv-review">
                    <div>
                      <span>Principal</span>
                      <b className="mono">{money(calc.principal)}</b>
                    </div>
                    <div>
                      <span>Target ROI</span>
                      <b className="mono">{calc.roiPct}%</b>
                    </div>
                    <div>
                      <span>Duration</span>
                      <b>{calc.days} days</b>
                    </div>
                    <div>
                      <span>Simple daily rate</span>
                      <b className="mono">
                        {(calc.roiPct / calc.days).toFixed(3)}%
                      </b>
                    </div>
                  </div>
                  <div className="iv-inline-note is-warn">
                    <Icon name="alert" size={13} /> A projection is not a
                    guaranteed return. Pool performance may be negative and
                    capital is at risk.
                  </div>
                </>
              ) : (
                <div className="iv-review-final">
                  <Icon name="chart" size={20} />
                  <p>
                    Save this scenario to your local workspace for review. No
                    pool allocation, expected-return promise or payment is
                    created.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "export" ? (
              step === 0 ? (
                <div className="iv-form-grid">
                  <label className="iv-field">
                    Scope
                    <select
                      className="form-select"
                      aria-label="Export scope"
                      value={exportScope}
                      onChange={(e) =>
                        setExportScope(e.target.value as typeof exportScope)
                      }
                    >
                      <option value="portfolio">Portfolio allocations</option>
                      <option value="activity">Activity ledger</option>
                      <option value="earnings">Earnings by pool</option>
                      <option value="statement">Distribution receipts</option>
                    </select>
                  </label>
                  <label className="iv-field">
                    Format
                    <select
                      className="form-select"
                      aria-label="Export format"
                      value={exportFormat}
                      onChange={(e) =>
                        setExportFormat(e.target.value as typeof exportFormat)
                      }
                    >
                      <option value="json">JSON · structured</option>
                      <option value="csv">CSV · spreadsheet</option>
                      <option value="pdf">PDF · readable statement</option>
                    </select>
                  </label>
                </div>
              ) : step === 1 ? (
                <>
                  <div className="iv-review">
                    <div>
                      <span>Scope</span>
                      <b>{exportScope}</b>
                    </div>
                    <div>
                      <span>Format</span>
                      <b>{exportFormat.toUpperCase()}</b>
                    </div>
                    <div>
                      <span>Records</span>
                      <b className="mono">{exportRows().length}</b>
                    </div>
                    <div>
                      <span>Source as of</span>
                      <b>{atDateTime(data.asOf)}</b>
                    </div>
                  </div>
                  <div className="iv-note">
                    Exports include source snapshot values and local session
                    records (including any booking holds or payout drafts). They
                    do not include credentials, full payment details or provider
                    tokens.
                  </div>
                </>
              ) : (
                <div className="iv-review-final">
                  <Icon name="download" size={20} />
                  <p>
                    Confirm to generate the file in your browser. This is demo
                    evidence, not a certified account statement.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "notificationPrefs" ? (
              step === 0 ? (
                <>
                  <div className="iv-channel-row">
                    {(["email", "push", "sms"] as const).map((channel) => (
                      <label className="iv-check" key={channel}>
                        <input
                          type="checkbox"
                          aria-label={`Enable ${channel} notifications`}
                          checked={prefs.channels[channel]}
                          onChange={(e) =>
                            setPrefs({
                              ...prefs,
                              channels: {
                                ...prefs.channels,
                                [channel]: e.target.checked,
                              },
                            })
                          }
                        />
                        {channel === "email"
                          ? "Email"
                          : channel === "push"
                            ? "In-app / push"
                            : "SMS"}
                      </label>
                    ))}
                  </div>
                  <label className="iv-field">
                    Digest frequency
                    <select
                      className="form-select"
                      aria-label="Notification digest"
                      value={prefs.digest}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          digest: e.target.value as typeof prefs.digest,
                        })
                      }
                    >
                      <option value="instant">Instant observations</option>
                      <option value="daily">Daily summary</option>
                      <option value="weekly">Weekly summary</option>
                    </select>
                  </label>
                  <div className="iv-note">
                    Preferences are local metadata. No email, push subscription
                    or SMS provider is configured here.
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="iv-form-grid">
                    <label className="iv-field">
                      Quiet hours start / UTC
                      <input
                        className="form-control"
                        aria-label="Quiet hours start"
                        type="time"
                        value={prefs.quietStart}
                        onChange={(e) =>
                          setPrefs({ ...prefs, quietStart: e.target.value })
                        }
                      />
                    </label>
                    <label className="iv-field">
                      Quiet hours end / UTC
                      <input
                        className="form-control"
                        aria-label="Quiet hours end"
                        type="time"
                        value={prefs.quietEnd}
                        onChange={(e) =>
                          setPrefs({ ...prefs, quietEnd: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="iv-check">
                    <input
                      type="checkbox"
                      aria-label="Automatic earnings refresh"
                      checked={prefs.autoRefresh}
                      onChange={(e) =>
                        setPrefs({ ...prefs, autoRefresh: e.target.checked })
                      }
                    />
                    Refresh the earnings countdown automatically while open
                  </label>
                  <div className="iv-note">
                    Production delivery must enforce quiet hours server-side,
                    verify channel ownership and support unsubscribe controls.
                  </div>
                </>
              ) : (
                <div className="iv-review">
                  <div>
                    <span>Channels</span>
                    <b>
                      {Object.entries(prefs.channels)
                        .filter(([, enabled]) => enabled)
                        .map(([key]) => key)
                        .join(", ") || "None"}
                    </b>
                  </div>
                  <div>
                    <span>Digest</span>
                    <b>{prefs.digest}</b>
                  </div>
                  <div>
                    <span>Quiet hours</span>
                    <b>
                      {prefs.quietStart}–{prefs.quietEnd} UTC
                    </b>
                  </div>
                  <div>
                    <span>Auto refresh</span>
                    <b>{prefs.autoRefresh ? "On" : "Off"}</b>
                  </div>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "profileSettings" ? (
              step === 0 ? (
                <>
                  <label className="iv-field">
                    Display name
                    <input
                      className="form-control"
                      aria-label="Investor display name"
                      maxLength={60}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </label>
                  <div className="iv-kv-grid">
                    <div>
                      <span>Email · read only</span>
                      <b>{data.profile.email}</b>
                    </div>
                    <div>
                      <span>Investor ID</span>
                      <b className="mono">{data.profile.id}</b>
                    </div>
                    <div>
                      <span>KYC level</span>
                      <b>
                        {data.profile.kycLevel} · verified{" "}
                        {atDate(data.profile.kycVerifiedAt)}
                      </b>
                    </div>
                    <div>
                      <span>Currency</span>
                      <b>{data.profile.currency}</b>
                    </div>
                  </div>
                  <div className="iv-note">
                    Only the display name is editable locally. Identity, email,
                    country, verification and role changes require authenticated
                    account workflows.
                  </div>
                </>
              ) : step === 1 ? (
                <div className="iv-review">
                  <div>
                    <span>Display name</span>
                    <b>{displayName.trim() || "—"}</b>
                  </div>
                  <div>
                    <span>Account email</span>
                    <b>{data.profile.email}</b>
                  </div>
                  <div>
                    <span>Verification</span>
                    <b>{data.profile.kycLevel} (unchanged)</b>
                  </div>
                  <div>
                    <span>Effect</span>
                    <b>Local workspace and shell only</b>
                  </div>
                </div>
              ) : (
                <div className="iv-review-final">
                  <Icon name="user" size={20} />
                  <p>
                    Confirm the display-name preview. This does not change your
                    verified legal identity or any account credential.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "support" ? (
              step === 0 ? (
                <>
                  <div className="iv-form-grid">
                    <label className="iv-field">
                      Topic
                      <select
                        className="form-select"
                        aria-label="Support topic"
                        value={supportTopic}
                        onChange={(e) =>
                          setSupportTopic(e.target.value as typeof supportTopic)
                        }
                      >
                        <option value="payout">Payout or withdrawal</option>
                        <option value="pool">Pool allocation</option>
                        <option value="kyc">Verification</option>
                        <option value="account">Account access</option>
                        <option value="other">Something else</option>
                      </select>
                    </label>
                  </div>
                  <label className="iv-field">
                    Message
                    <textarea
                      className="form-control"
                      aria-label="Support message"
                      rows={5}
                      maxLength={1000}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Describe the question without including passwords, codes, card numbers or full bank details."
                    />
                    <small>
                      {supportMessage.length}/1000 · never include credentials
                    </small>
                  </label>
                </>
              ) : step === 1 ? (
                <div className="iv-review">
                  <div>
                    <span>Topic</span>
                    <b>{supportTopic}</b>
                  </div>
                  <div>
                    <span>Message</span>
                    <b>{supportMessage.trim()}</b>
                  </div>
                  <div>
                    <span>Reference</span>
                    <b className="mono">Draft created on confirmation</b>
                  </div>
                </div>
              ) : (
                <div className="iv-review-final">
                  <Icon name="mail" size={20} />
                  <p>
                    Save this message as a local support draft. It is not
                    transmitted; production must use an authenticated support
                    channel and retention policy.
                  </p>
                </div>
              )
            ) : null}

            {modal.kind === "activityDetail" && modalActivity ? (
              <>
                <div className="iv-modal-title">
                  <div>
                    <span className="iv-code mono">
                      {modalActivity.kind.toUpperCase()}
                    </span>
                    <h3>{modalActivity.title}</h3>
                    <p>{atDateTime(modalActivity.at)}</p>
                  </div>
                  <span className={`iv-tag is-${modalActivity.status}`}>
                    {modalActivity.status.toUpperCase()}
                  </span>
                </div>
                <div className="iv-kv-grid">
                  <div>
                    <span>Detail</span>
                    <b>{modalActivity.detail}</b>
                  </div>
                  <div>
                    <span>Gross amount</span>
                    <b className="mono">
                      {modalActivity.amount === null
                        ? "—"
                        : money(modalActivity.amount, 2)}
                    </b>
                  </div>
                  <div>
                    <span>Your share</span>
                    <b className="mono">
                      {modalActivity.share === null
                        ? "—"
                        : signedMoney(modalActivity.share)}
                    </b>
                  </div>
                  <div>
                    <span>Pool</span>
                    <b>
                      {data.activePools.find(
                        (p) => p.id === modalActivity.poolId,
                      )?.code ??
                        modalActivity.poolId ??
                        "Wallet"}
                    </b>
                  </div>
                </div>
                <div className="iv-actions iv-modal-actions">
                  {!modalActivity.read ? (
                    <button
                      type="button"
                      className="iv-btn"
                      onClick={() =>
                        void run(
                          { kind: "markRead", id: modalActivity.id },
                          {
                            keep: true,
                            title: "Observation marked read locally",
                          },
                        )
                      }
                    >
                      Mark read
                    </button>
                  ) : null}
                  {modalActivity.poolId ? (
                    <button
                      type="button"
                      className="iv-btn"
                      onClick={() =>
                        open("poolDetail", modalActivity.poolId ?? undefined)
                      }
                    >
                      Open pool
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("activityLog")}
                  >
                    All activity
                  </button>
                </div>
                <p className="iv-note">
                  Activity is a source observation. No action from this dialog
                  changes a trade, transfer or provider state.
                </p>
              </>
            ) : null}

            {modal.kind === "activityLog" ? (
              <>
                <div className="iv-filter-row">
                  <label className="iv-field">
                    Type
                    <select
                      className="form-select"
                      aria-label="Activity type filter"
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                    >
                      <option value="all">All types</option>
                      {[
                        "trade",
                        "deposit",
                        "guardian",
                        "payout",
                        "announcement",
                        "distribution",
                        "kyc",
                        "reminder",
                      ].map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="iv-check">
                    <input
                      type="checkbox"
                      aria-label="Unread activity only"
                      checked={unreadOnly}
                      onChange={(e) => setUnreadOnly(e.target.checked)}
                    />
                    Unread only
                  </label>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() =>
                      void run(
                        { kind: "markAllRead" },
                        {
                          keep: true,
                          title: "All observations marked read locally",
                        },
                      )
                    }
                  >
                    Mark all read
                  </button>
                </div>
                <div className="iv-activity iv-activity--modal">
                  {filteredActivity.map((item) => (
                    <button
                      type="button"
                      className="iv-activity-row"
                      key={item.id}
                      onClick={() => open("activityDetail", item.id)}
                    >
                      <span className={`iv-activity-icon is-${item.kind}`}>
                        <Icon name={activityIcon[item.kind]} size={15} />
                      </span>
                      <span className="iv-activity-main">
                        <span className="iv-activity-title">
                          {!item.read ? (
                            <span className="iv-unread-dot" />
                          ) : null}
                          {item.title}
                        </span>
                        <span className="iv-activity-detail">
                          {item.detail}
                        </span>
                      </span>
                      <span className="iv-activity-amount">
                        {item.share !== null ? (
                          <b className="mono text-win">
                            {signedMoney(item.share)}
                          </b>
                        ) : item.amount !== null ? (
                          <b className="mono">{money(item.amount, 2)}</b>
                        ) : (
                          <b className="iv-muted">—</b>
                        )}
                        <small>{atTime(item.at)}</small>
                      </span>
                      <span className={`iv-tag is-${item.status}`}>
                        {item.status.toUpperCase()}
                      </span>
                    </button>
                  ))}
                  {!filteredActivity.length ? (
                    <div className="iv-empty">
                      No activity matches this filter.
                    </div>
                  ) : null}
                </div>
                <p className="iv-note">
                  {filteredActivity.length} of {data.activity.length}{" "}
                  observations shown. Mark-read actions are local only.
                </p>
              </>
            ) : null}

            {modal.kind === "guardianDetail" &&
            (modalPool ?? data.activePools[0])
              ? (() => {
                  const pool = modalPool ?? data.activePools[0];
                  return (
                    <>
                      <div className="iv-modal-title">
                        <div>
                          <span className="iv-code mono">{pool.code}</span>
                          <h3>Guardian risk controls</h3>
                          <p>
                            {pool.name} · checked{" "}
                            {atDateTime(pool.guardian.lastCheckedAt)}
                          </p>
                        </div>
                        <span className="iv-tag is-active">ACTIVE</span>
                      </div>
                      <div className="iv-kv-grid">
                        <div>
                          <span>Consecutive losses</span>
                          <b className="mono">
                            {pool.guardian.consecutiveLosses} /{" "}
                            {pool.guardian.maxConsecutiveLosses}
                          </b>
                        </div>
                        <div>
                          <span>Drawdown</span>
                          <b className="mono">
                            {pool.guardian.drawdownPct}% /{" "}
                            {pool.guardian.drawdownLimitPct}%
                          </b>
                        </div>
                        <div>
                          <span>Policy result</span>
                          <b>Within limits</b>
                        </div>
                        <div>
                          <span>Next check</span>
                          <b>Next settlement batch</b>
                        </div>
                      </div>
                      <div className="iv-meter">
                        <span
                          style={{
                            width: `${Math.min(100, (pool.guardian.drawdownPct / pool.guardian.drawdownLimitPct) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="iv-note">{pool.guardian.note}</p>
                      <div className="iv-section-code">RISK EVENT LOG</div>
                      <div className="iv-drawer-list">
                        {data.guardianLog
                          .filter((event) => event.poolId === pool.id)
                          .map((event) => (
                            <div className="iv-drawer-row" key={event.id}>
                              <div>
                                <b>{event.event}</b>
                                <small>
                                  {atDateTime(event.at)} · {event.action}
                                </small>
                              </div>
                              <span className="iv-tag">
                                {event.result.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        {!data.guardianLog.some(
                          (event) => event.poolId === pool.id,
                        ) ? (
                          <div className="iv-empty">
                            No recorded risk events for this pool.
                          </div>
                        ) : null}
                      </div>
                      <div className="iv-actions iv-modal-actions">
                        <button
                          type="button"
                          className="iv-btn"
                          onClick={() => open("liveTrades", pool.id)}
                        >
                          Inspect trades
                        </button>
                        <button
                          type="button"
                          className="iv-btn"
                          onClick={() => open("poolDetail", pool.id)}
                        >
                          Open pool
                        </button>
                      </div>
                    </>
                  );
                })()
              : null}

            {modal.kind === "portfolioDetail" ? (
              <>
                <div className="iv-breakdown">
                  <div>
                    <span>ACTIVE ALLOCATIONS</span>
                    <b className="mono">{money(data.summary.totalInvested)}</b>
                    <small>{data.summary.activePools} pools</small>
                  </div>
                  <div>
                    <span>LIFETIME EARNINGS</span>
                    <b className="mono text-win">
                      {signedMoney(data.wallet.lifetimeEarnings)}
                    </b>
                    <small>
                      {data.portfolio.length} completed and active positions
                    </small>
                  </div>
                  <div>
                    <span>MONTH ROI</span>
                    <b className="mono text-win">{percent(roi)}</b>
                    <small>{money(month)} earned this month</small>
                  </div>
                </div>
                <PortfolioTable
                  rows={data.portfolio}
                  onInspect={(row) => open("investmentDetail", row.id)}
                />
                <p className="iv-note">
                  Completed positions are retained for history; current value is
                  a source snapshot, not a redemption quote.
                </p>
              </>
            ) : null}

            {modal.kind === "investmentDetail" && modalInvestment ? (
              <>
                <div className="iv-modal-title">
                  <div>
                    <span className="iv-code mono">{modalInvestment.code}</span>
                    <h3>{modalInvestment.name}</h3>
                    <p>
                      {modalInvestment.status.toUpperCase()} ·{" "}
                      {modalInvestment.sharePct}% profit share
                    </p>
                  </div>
                  <span className="iv-tag">
                    {modalInvestment.status.toUpperCase()}
                  </span>
                </div>
                <div className="iv-kv-grid">
                  <div>
                    <span>Invested</span>
                    <b className="mono">{money(modalInvestment.invested)}</b>
                  </div>
                  <div>
                    <span>Current value</span>
                    <b className="mono">
                      {money(modalInvestment.currentValue)}
                    </b>
                  </div>
                  <div>
                    <span>Profit</span>
                    <b className="mono text-win">
                      {signedMoney(modalInvestment.profit)}
                    </b>
                  </div>
                  <div>
                    <span>ROI</span>
                    <b className="mono text-win">
                      {percent(modalInvestment.roiPct)}
                    </b>
                  </div>
                  <div>
                    <span>Started</span>
                    <b>{atDate(modalInvestment.startedAt)}</b>
                  </div>
                  <div>
                    <span>
                      {modalInvestment.status === "active" ? "Ends" : "Ended"}
                    </span>
                    <b>
                      {modalInvestment.endedAt
                        ? atDate(modalInvestment.endedAt)
                        : "—"}
                    </b>
                  </div>
                </div>
                <div className="iv-actions iv-modal-actions">
                  {data.activePools.some(
                    (p) => p.id === modalInvestment.poolId,
                  ) ? (
                    <button
                      type="button"
                      className="iv-btn"
                      onClick={() => open("poolDetail", modalInvestment.poolId)}
                    >
                      Open active pool
                    </button>
                  ) : null}
                  {modalInvestment.status === "completed" ? (
                    <button
                      type="button"
                      className="iv-btn"
                      onClick={() => {
                        const receipt = data.receipts.find(
                          (r) => r.poolId === modalInvestment.poolId,
                        );
                        if (receipt) open("receipt", receipt.id);
                      }}
                    >
                      Find receipt
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("portfolioDetail")}
                  >
                    All investments
                  </button>
                </div>
                <p className="iv-note">
                  Values are source observations. Completed pool history remains
                  available for review; no redemption or reallocation occurs
                  from this dialog.
                </p>
              </>
            ) : null}

            {modal.kind === "kycStatus" ? (
              <>
                <div className="iv-modal-title">
                  <div>
                    <span className="iv-code mono">KYC</span>
                    <h3>{data.profile.kycLevel} · verified</h3>
                    <p>Approved {atDate(data.profile.kycVerifiedAt)}</p>
                  </div>
                  <span className="iv-tag is-settled">CLEARED</span>
                </div>
                <div className="iv-kv-grid">
                  <div>
                    <span>Level 1 · identity</span>
                    <b className="text-win">Approved</b>
                  </div>
                  <div>
                    <span>Level 2 · address</span>
                    <b className="text-win">Approved</b>
                  </div>
                  <div>
                    <span>Level 3 · enhanced</span>
                    <b>Not requested</b>
                  </div>
                  <div>
                    <span>Currency</span>
                    <b>{data.profile.currency}</b>
                  </div>
                </div>
                <p className="iv-note">
                  Verification status is a display snapshot. Production identity
                  checks, document storage and re-screening belong in the
                  compliance service.
                </p>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => {
                      setSupportTopic("kyc");
                      setSupportMessage("");
                      open("support");
                    }}
                  >
                    Ask compliance
                  </button>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("profileSettings")}
                  >
                    Open profile
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "fees" ? (
              <>
                <div className="iv-section-code">POOL ECONOMICS</div>
                <div className="iv-review">
                  <div>
                    <span>Profit share to you</span>
                    <b>Per pool allocation (specified on each pool)</b>
                  </div>
                  <div>
                    <span>Platform share</span>
                    <b>Deducted from gross pool profit before distribution</b>
                  </div>
                  <div>
                    <span>Pool setup</span>
                    <b>No separate investor setup fee in this demo</b>
                  </div>
                  <div>
                    <span>Bank payout</span>
                    <b>{money(1.5, 2)} per transfer</b>
                  </div>
                  <div>
                    <span>USDT payout</span>
                    <b>Network fee applies at the provider</b>
                  </div>
                  <div>
                    <span>Deposit</span>
                    <b>No platform deposit fee modeled</b>
                  </div>
                </div>
                <p className="iv-note">
                  Fee values are demonstration source fields. Production must
                  show the contractual fee schedule before booking and record
                  accepted terms per investor.
                </p>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(
                          {
                            asOf: data.asOf,
                            bankPayoutFee: 1.5,
                            usdt: "provider network fee",
                            investorProfitShare: "pool-specific",
                          },
                          null,
                          2,
                        ),
                        "investor-fee-schedule.json",
                        "application/json",
                      )
                    }
                  >
                    Download fee schedule
                  </button>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("payoutMethods")}
                  >
                    Payout methods
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "referral" ? (
              <>
                <div className="iv-referral-code">
                  <span>YOUR INVITE CODE</span>
                  <b className="mono">{data.referral.code}</b>
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(data.referral.code);
                        setClipboardNote("Invite code copied.");
                        pushToast({
                          tone: "success",
                          title: "Invite code copied",
                        });
                      } catch {
                        setClipboardNote(
                          "Clipboard unavailable. Select the code manually.",
                        );
                      }
                    }}
                  >
                    Copy code
                  </button>
                </div>
                {clipboardNote ? (
                  <p className="iv-inline-note" role="status">
                    {clipboardNote}
                  </p>
                ) : null}
                <div className="iv-kv-grid">
                  <div>
                    <span>Invited</span>
                    <b className="mono">{data.referral.invited}</b>
                  </div>
                  <div>
                    <span>Active referred investors</span>
                    <b className="mono">{data.referral.active}</b>
                  </div>
                  <div>
                    <span>Reward earned</span>
                    <b className="mono">{money(data.referral.earned, 2)}</b>
                  </div>
                  <div>
                    <span>Reward rate</span>
                    <b className="mono">{data.referral.rewardPct}%</b>
                  </div>
                </div>
                <p className="iv-note">
                  {data.referral.terms} No email, link delivery or reward payout
                  is triggered here; referral credit must be computed and
                  settled by the backend.
                </p>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("support")}
                  >
                    Ask about referrals
                  </button>
                  <button
                    type="button"
                    className="iv-btn iv-btn--primary"
                    onClick={() =>
                      void navigator.clipboard
                        ?.writeText(data.referral.code)
                        .then(() =>
                          pushToast({
                            tone: "info",
                            title: "Invite code copied again",
                          }),
                        )
                        .catch(() =>
                          setClipboardNote(
                            "Clipboard unavailable. Select the code manually.",
                          ),
                        )
                    }
                  >
                    Copy again
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "help" ? (
              <>
                <div className="iv-section-code">WHAT THIS PAGE DOES</div>
                <ul className="iv-list">
                  <li>
                    Reads one structured investor overview DTO, rendered with
                    TanStack Query, Form and Table. Session changes are local
                    and reset on reload.
                  </li>
                  <li>
                    Uses a dedicated investor shell with its own navigation,
                    mobile actions, right inspector and persistent quick-action
                    bar.
                  </li>
                  <li>
                    Derives pool progress, profit share, ROI, countdowns, month
                    earnings and wallet summaries from source fields rather than
                    duplicating totals.
                  </li>
                  <li>
                    Writes only to the in-browser workspace: booking holds,
                    payout drafts, scenarios, reminders, notification
                    preferences, display name, support drafts and read markers.
                  </li>
                </ul>
                <div className="iv-section-code">WHAT REQUIRES A BACKEND</div>
                <ul className="iv-list">
                  <li>
                    Authenticated investor identity, KYC, account-scoped
                    authorisation and server-side session enforcement.
                  </li>
                  <li>
                    Provider market/trade feed, authoritative pool valuation,
                    fee calculation and settlement reconciliation.
                  </li>
                  <li>
                    Payment capture, beneficiary verification, sanctions
                    screening, payouts, refunds and tax documents.
                  </li>
                  <li>
                    Email, push and SMS delivery with consent, quiet hours and
                    unsubscribe handling.
                  </li>
                  <li>
                    Slot capacity and booking concurrency, plus immutable
                    distribution receipts and audit retention.
                  </li>
                </ul>
                <div className="iv-path-row">
                  <span>Read contract</span>
                  <code>GET /api/investor/overview</code>
                  <span>Query key</span>
                  <code>[&quot;investor&quot;,&quot;overview&quot;]</code>
                </div>
                <div className="iv-actions iv-modal-actions">
                  <button
                    type="button"
                    className="iv-btn"
                    onClick={() => open("export")}
                  >
                    Export workspace
                  </button>
                  <Link className="iv-btn" href="/dashboard">
                    Operator console ↗
                  </Link>
                </div>
              </>
            ) : null}
          </DeskModalShell>
        </div>
      ) : null}
    </InvestorShell>
  );
}
