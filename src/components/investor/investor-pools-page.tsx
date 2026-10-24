"use client";

import { useForm } from "@tanstack/react-form";
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
  bookableSlots,
  countdown,
  daysBetween,
  endingSoon,
  fillPct,
  hoursUntil,
  netOfCut,
  relativeFrom,
  type CompletedPool,
  type OpenPool,
  type PoolsCommand,
  type PoolsWorkspace,
  type PoolTrade,
  type RoadmapMilestone,
  type TradingPool,
  type UpcomingPool,
} from "@/lib/investor/pools";
import { usePools } from "@/lib/investor/use-pools";
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
const riskTone = (risk: string) =>
  risk === "Aggressive"
    ? "is-aggressive"
    : risk === "Growth"
      ? "is-growth"
      : risk === "Balanced"
        ? "is-balanced"
        : "is-low";

/* ── Dialog registry ── */

type Kind =
  | "poolDetail"
  | "liveTrades"
  | "tradeDetail"
  | "guardianDetail"
  | "bookMore"
  | "openDetail"
  | "payment"
  | "upcomingDetail"
  | "reminder"
  | "reminders"
  | "prebook"
  | "completedDetail"
  | "payoutDetail"
  | "statement"
  | "roadmapDetail"
  | "roadmapInfo"
  | "compare"
  | "filters"
  | "calculator"
  | "fees"
  | "riskProfile"
  | "alertPrefs"
  | "ledger"
  | "help"
  | "support";

const titles: Record<Kind, string> = {
  poolDetail: "Trading pool detail",
  liveTrades: "Live & recent pool trades",
  tradeDetail: "Trade settlement record",
  guardianDetail: "Guardian risk controls",
  bookMore: "Book more slots",
  openDetail: "Open pool detail",
  payment: "Payment verification",
  upcomingDetail: "Upcoming pool brief",
  reminder: "Set an opening reminder",
  reminders: "Manage opening reminders",
  prebook: "Pre-book interest",
  completedDetail: "Completed cycle detail",
  payoutDetail: "Payout record",
  statement: "Download pool statement",
  roadmapDetail: "Roadmap milestone",
  roadmapInfo: "How the roadmap is built",
  compare: "Compare pools",
  filters: "Filter pools",
  calculator: "Project a pool return",
  fees: "Fees & profit share",
  riskProfile: "Risk profile & disclosure",
  alertPrefs: "Pool alert preferences",
  ledger: "Pool activity & notifications",
  help: "Workspace boundaries",
  support: "Contact the funding desk",
};

const wizardKinds: Kind[] = [
  "bookMore",
  "reminder",
  "prebook",
  "statement",
  "calculator",
  "riskProfile",
  "alertPrefs",
  "support",
];
const steps = ["Prepare", "Review impact", "Acknowledge"] as const;

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  liveTrades: "xl",
  compare: "xl",
  statement: "lg",
  bookMore: "lg",
  openDetail: "lg",
  poolDetail: "lg",
  completedDetail: "md",
  payoutDetail: "md",
  roadmapInfo: "md",
  help: "lg",
  fees: "md",
  ledger: "lg",
};

const quickActions: InvestorQuickAction[] = [
  { key: "bookMore", label: "Book more slots", short: "Book", icon: "plus" },
  { key: "compare", label: "Compare pools", short: "Compare", icon: "layers" },
  {
    key: "statement",
    label: "Download statement",
    short: "Statement",
    icon: "download",
  },
  {
    key: "reminder",
    label: "Set opening reminder",
    short: "Remind",
    icon: "bell",
  },
  { key: "roadmap", label: "Pool roadmap", short: "Roadmap", icon: "calendar" },
  { key: "fees", label: "Fees & economics", short: "Fees", icon: "info" },
];

/* ── Shared primitives ── */

const statusChips: {
  key: "all" | "trading" | "open" | "upcoming" | "completed";
  label: string;
}[] = [
  { key: "all", label: "All pools" },
  { key: "trading", label: "Trading" },
  { key: "open", label: "Open for booking" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

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
    <div className="ip-section-head">
      <div>
        <span className="ip-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="ip-section-aside">{aside}</div> : null}
    </div>
  );
}

function Progress({
  value,
  tone = "accent",
  label,
}: {
  value: number;
  tone?: "accent" | "win" | "muted";
  label?: string;
}) {
  return (
    <div
      className="ip-progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Funding progress"}
    >
      <span
        className={`ip-progress__fill is-${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function LifecycleTag({
  lifecycle,
}: {
  lifecycle: "trading" | "open" | "upcoming" | "completed";
}) {
  return (
    <span className={`ip-tag is-${lifecycle}`}>
      {lifecycle === "trading"
        ? "TRADING"
        : lifecycle === "open"
          ? "OPEN"
          : lifecycle === "upcoming"
            ? "UPCOMING"
            : "COMPLETED"}
    </span>
  );
}

function Stat({
  label,
  value,
  foot,
  note,
  tone,
  icon,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  foot: ReactNode;
  note: string;
  tone?: "win" | "accent";
  icon: IconName;
  delay?: number;
}) {
  return (
    <div
      className="ip-stat"
      style={{ "--ip-delay": `${delay}ms` } as CSSProperties}
    >
      <div className="ip-stat__top">
        <span>{label}</span>
        <Icon name={icon} size={15} />
      </div>
      <div className={`ip-stat__value${tone ? ` is-${tone}` : ""}`}>
        {value}
      </div>
      <div className="ip-stat__foot">{foot}</div>
      <div className="ip-stat__note">{note}</div>
    </div>
  );
}

function CompareToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="ip-compare-toggle" title="Add to comparison">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={`Compare ${label}`}
      />
      <span>Compare</span>
    </label>
  );
}

/* ── Trading card ── */

function TradingCard({
  pool,
  clock,
  delay,
  onDetail,
  onTrades,
  onGuardian,
  compare,
  onCompare,
}: {
  pool: TradingPool;
  clock: string;
  delay: number;
  onDetail: () => void;
  onTrades: () => void;
  onGuardian: () => void;
  compare: boolean;
  onCompare: () => void;
}) {
  const cd = countdown(pool.endsAt, clock);
  const soon = endingSoon(pool.endsAt, clock, 72);
  const pnl = useLiveCountUp(pool.sharePnl);
  return (
    <article
      className={`ip-card ip-card--trading hover-lift${soon ? " is-ending-soon" : ""}`}
      style={{ "--ip-delay": `${delay}ms` } as CSSProperties}
    >
      <div className="ip-card__top">
        <div className="ip-card__id">
          <span className="ip-code mono">{pool.code}</span>
          <LifecycleTag lifecycle="trading" />
          <span className="ip-risk-pill">{pool.riskBand}</span>
        </div>
        <CompareToggle
          checked={compare}
          onChange={onCompare}
          label={pool.code}
        />
      </div>

      <div className="ip-card__title">
        <div>
          <h3>
            <button
              type="button"
              className="ip-title-button"
              onClick={onDetail}
            >
              {pool.name}
            </button>
          </h3>
          <p>{pool.strategy}</p>
        </div>
        <span className={`ip-guardian is-${pool.guardian.status}`}>
          <span className="live-dot" /> Guardian {pool.guardian.status}
        </span>
      </div>

      <div className="ip-funding">
        <div className="ip-funding__head">
          <span>FUNDING</span>
          <span className="mono">
            {plainPercent(fillPct(pool.raised, pool.goal))}
          </span>
        </div>
        <Progress
          value={fillPct(pool.raised, pool.goal)}
          label={`${pool.code} funding progress`}
        />
        <div className="ip-funding__foot">
          <span>
            Raised <b className="mono">{money(pool.raised)}</b> of{" "}
            <b className="mono">{money(pool.goal)}</b>
          </span>
          <span className="mono">
            {pool.slotsFilled}/{pool.slotsTotal} slots
          </span>
        </div>
      </div>

      <div className="ip-metrics">
        <div>
          <span>YOUR ALLOCATION</span>
          <b className="mono">{money(pool.investment)}</b>
          <small>
            {pool.userSlots} slot{pool.userSlots === 1 ? "" : "s"} ·{" "}
            {pool.profitSharePct}% share
          </small>
        </div>
        <div>
          <span>TRADING ENDS</span>
          <b className="mono">{cd.label}</b>
          <small className={soon ? "text-warning" : undefined}>
            {atDateTime(pool.endsAt)}
          </small>
        </div>
        <div>
          <span>POOL P&amp;L</span>
          <b className={`mono ${pool.pnl >= 0 ? "text-win" : "text-loss"}`}>
            {signedMoney(pool.pnl)}
          </b>
          <small>
            {pool.trades} trades · {pool.winRatePct.toFixed(1)}% win
          </small>
        </div>
        <div>
          <span>YOUR EARNINGS</span>
          <b
            className={`mono ${pool.sharePnl >= 0 ? "text-win" : "text-loss"}`}
          >
            {signedMoney(pnl)}
          </b>
          <small className="text-win">
            {percent(pool.roiPct)} on allocation
          </small>
        </div>
      </div>

      <div className="ip-card__foot">
        <button type="button" className="ip-guardian-btn" onClick={onGuardian}>
          <Icon name="shield" size={13} /> Drawdown {pool.guardian.drawdownPct}%
          / {pool.guardian.drawdownLimitPct}% · losses{" "}
          {pool.guardian.consecutiveLosses}/{pool.guardian.maxConsecutiveLosses}
        </button>
        <div className="ip-actions">
          <button type="button" className="ip-btn" onClick={onTrades}>
            Live trades
          </button>
          <button
            type="button"
            className="ip-btn ip-btn--primary"
            onClick={onDetail}
          >
            View details
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Open pool card ── */

function OpenCard({
  pool,
  clock,
  delay,
  onDetail,
  onBook,
  onPayment,
  compare,
  onCompare,
}: {
  pool: OpenPool;
  clock: string;
  delay: number;
  onDetail: () => void;
  onBook: () => void;
  onPayment: () => void;
  compare: boolean;
  onCompare: () => void;
}) {
  const cd = countdown(pool.closesAt, clock);
  const soon = hoursUntil(pool.closesAt, clock) <= 48;
  const available = bookableSlots(pool);
  return (
    <article
      className={`ip-card ip-card--open hover-lift${soon ? " is-closing-soon" : ""}`}
      style={{ "--ip-delay": `${delay}ms` } as CSSProperties}
    >
      <div className="ip-card__top">
        <div className="ip-card__id">
          <span className="ip-code mono">{pool.code}</span>
          <LifecycleTag lifecycle="open" />
          <span className={`ip-risk-pill ${riskTone(pool.riskBand)}`}>
            {pool.riskBand}
          </span>
        </div>
        <CompareToggle
          checked={compare}
          onChange={onCompare}
          label={pool.code}
        />
      </div>

      <div className="ip-card__title">
        <div>
          <h3>
            <button
              type="button"
              className="ip-title-button"
              onClick={onDetail}
            >
              {pool.name}
            </button>
          </h3>
          <p>{pool.strategy}</p>
        </div>
        <span className="ip-countdown">
          <Icon name="clock" size={13} /> closes in {cd.label}
        </span>
      </div>

      <dl className="ip-specs">
        <div>
          <dt>MIN SLOT</dt>
          <dd className="mono">{money(pool.minSlot)}</dd>
        </div>
        <div>
          <dt>MAX / INVESTOR</dt>
          <dd className="mono">{pool.maxSlotsPerUser} slots</dd>
        </div>
        <div>
          <dt>DURATION</dt>
          <dd>{pool.durationDays} days</dd>
        </div>
        <div>
          <dt>EXPECTED ROI</dt>
          <dd className="mono text-win">+{pool.expectedRoiPct}%</dd>
        </div>
      </dl>

      <div className="ip-funding">
        <div className="ip-funding__head">
          <span>TARGET CAPITAL</span>
          <span className="mono">
            {plainPercent(fillPct(pool.raised, pool.goal))}
          </span>
        </div>
        <Progress
          value={fillPct(pool.raised, pool.goal)}
          label={`${pool.code} funding progress`}
        />
        <div className="ip-funding__foot">
          <span>
            Raised <b className="mono">{money(pool.raised)}</b> of{" "}
            <b className="mono">{money(pool.goal)}</b>
          </span>
          <span className="mono">{pool.investors} investors</span>
        </div>
      </div>

      <div className="ip-position">
        <div>
          <span>YOUR BOOKED SLOTS</span>
          <b className="mono">{pool.bookedSlots}</b>
        </div>
        <div>
          <span>INVESTMENT</span>
          <b className="mono">{money(pool.investment)}</b>
        </div>
        <div>
          <span>PAYMENT</span>
          <button
            type="button"
            className={`ip-pay is-${pool.payment}`}
            onClick={onPayment}
          >
            <Icon
              name={pool.payment === "verified" ? "check" : "clock"}
              size={12}
            />
            {pool.payment === "verified"
              ? "Verified"
              : pool.payment === "pending"
                ? "Awaiting verification"
                : "Partially paid"}
          </button>
        </div>
        <div>
          <span>STILL BOOKABLE</span>
          <b className="mono">{available} slots</b>
        </div>
      </div>

      <div className="ip-card__foot">
        <span className="ip-muted">
          {available === 0
            ? "Your per-investor limit is reached for this pool."
            : `Up to ${available} more slot${available === 1 ? "" : "s"} within your limit.`}
        </span>
        <div className="ip-actions">
          <button type="button" className="ip-btn" onClick={onDetail}>
            View details
          </button>
          <button
            type="button"
            className="ip-btn ip-btn--primary"
            onClick={onBook}
            disabled={available === 0}
          >
            Book more slots
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Upcoming card ── */

function UpcomingCard({
  pool,
  clock,
  delay,
  interest,
  reminded,
  onDetail,
  onRemind,
  onPrebook,
}: {
  pool: UpcomingPool;
  clock: string;
  delay: number;
  interest: number;
  reminded: boolean;
  onDetail: () => void;
  onRemind: () => void;
  onPrebook: () => void;
}) {
  const cd = countdown(pool.opensAt, clock);
  return (
    <article
      className="ip-card ip-card--upcoming hover-lift"
      style={{ "--ip-delay": `${delay}ms` } as CSSProperties}
    >
      <div className="ip-card__top">
        <div className="ip-card__id">
          <span className="ip-code mono">{pool.code}</span>
          <LifecycleTag lifecycle="upcoming" />
          <span className={`ip-risk-pill ${riskTone(pool.riskBand)}`}>
            {pool.riskBand}
          </span>
        </div>
        <span className="ip-countdown">
          <Icon name="calendar" size={13} /> opens {atDate(pool.opensAt)}
        </span>
      </div>

      <div className="ip-card__title">
        <div>
          <h3>
            <button
              type="button"
              className="ip-title-button"
              onClick={onDetail}
            >
              {pool.name}
            </button>
          </h3>
          <p>{pool.strategy}</p>
        </div>
      </div>

      <dl className="ip-specs ip-specs--three">
        <div>
          <dt>OPENS IN</dt>
          <dd className="mono">{cd.label}</dd>
        </div>
        <div>
          <dt>MIN SLOT</dt>
          <dd className="mono">{money(pool.minSlot)}</dd>
        </div>
        <div>
          <dt>EXP ROI</dt>
          <dd className="mono text-win">+{pool.expectedRoiPct}%</dd>
        </div>
        <div>
          <dt>DURATION</dt>
          <dd>{pool.durationDays} days</dd>
        </div>
        <div>
          <dt>MAX / INVESTOR</dt>
          <dd>{pool.maxSlotsPerUser} slots</dd>
        </div>
        <div>
          <dt>OPENS</dt>
          <dd>{atTime(pool.opensAt)} UTC</dd>
        </div>
      </dl>

      <div className="ip-interest">
        <span>
          Expressed interest <b className="mono">{money(pool.expressed)}</b>{" "}
          toward <b className="mono">{money(pool.goal)}</b>
        </span>
        <div className="ip-interest__badges">
          {interest ? (
            <span className="ip-tag is-interest">
              <Icon name="check" size={11} /> {interest} slot
              {interest === 1 ? "" : "s"} registered
            </span>
          ) : null}
          {reminded ? (
            <span className="ip-tag is-interest">
              <Icon name="bell" size={11} /> Reminder set
            </span>
          ) : null}
        </div>
      </div>

      <div className="ip-card__foot">
        <span className="ip-muted">
          No capital is reserved until the pool opens.
        </span>
        <div className="ip-actions">
          <button type="button" className="ip-btn" onClick={onRemind}>
            {reminded ? "Edit reminder" : "Set reminder"}
          </button>
          <button
            type="button"
            className="ip-btn ip-btn--primary"
            onClick={onPrebook}
          >
            {interest ? "Update interest" : "Pre-book interest"}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Completed row ── */

function CompletedRow({
  pool,
  delay,
  onDetail,
  onPayout,
  onStatement,
}: {
  pool: CompletedPool;
  delay: number;
  onDetail: () => void;
  onPayout: () => void;
  onStatement: () => void;
}) {
  return (
    <article
      className="ip-completed hover-lift"
      style={{ "--ip-delay": `${delay}ms` } as CSSProperties}
    >
      <div className="ip-completed__mark">
        <span className="ip-check" aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
      </div>
      <div className="ip-completed__main">
        <div className="ip-completed__title">
          <span className="ip-code mono">{pool.code}</span>
          <button type="button" className="ip-title-button" onClick={onDetail}>
            <b>{pool.name}</b>
          </button>
          <LifecycleTag lifecycle="completed" />
        </div>
        <span className="ip-muted">
          Completed {atDate(pool.completedAt)} ·{" "}
          {relativeFrom(pool.completedAt)} · {pool.userSlots} slots ·{" "}
          {money(pool.investment)} invested
        </span>
      </div>
      <div className="ip-completed__figures">
        <div>
          <span>FINAL ROI</span>
          <b
            className={`mono ${pool.finalRoiPct >= 0 ? "text-win" : "text-loss"}`}
          >
            {percent(pool.finalRoiPct)}
          </b>
        </div>
        <div>
          <span>GROSS</span>
          <b className="mono text-win">{signedMoney(pool.grossEarnings)}</b>
        </div>
        <div>
          <span>NET AFTER {pool.platformCutPct}%</span>
          <b className="mono text-win">{signedMoney(pool.netEarnings)}</b>
        </div>
        <div>
          <span>PAYOUT</span>
          <button
            type="button"
            className="ip-pay is-verified"
            onClick={onPayout}
          >
            <Icon name="check" size={12} />
            {pool.payout === "completed"
              ? "Completed"
              : pool.payout === "processing"
                ? "Processing"
                : "Scheduled"}
          </button>
        </div>
      </div>
      <div className="ip-completed__actions">
        <button type="button" className="ip-btn" onClick={onPayout}>
          Payout details
        </button>
        <button type="button" className="ip-btn" onClick={onStatement}>
          Statement PDF
        </button>
      </div>
    </article>
  );
}

/* ── Roadmap timeline ── */

function RoadmapItem({
  milestone,
  clock,
  delay,
  onDetail,
}: {
  milestone: RoadmapMilestone;
  clock: string;
  delay: number;
  onDetail: () => void;
}) {
  const token = milestone.state === "token";
  const cd = countdown(milestone.date, clock);
  return (
    <li
      className={`ip-roadmap__item is-${milestone.state}`}
      style={{ "--ip-delay": `${delay}ms` } as CSSProperties}
    >
      <span className="ip-roadmap__dot" aria-hidden="true" />
      <div className="ip-roadmap__date mono">{atDate(milestone.date)}</div>
      <div className="ip-roadmap__body">
        <div className="ip-roadmap__title">
          <span className="ip-code mono">{milestone.code}</span>
          <b>{milestone.name}</b>
          <span className={`ip-tag is-${milestone.state}`}>
            {token ? "ANNOUNCED" : milestone.state.toUpperCase()}
          </span>
        </div>
        {token ? (
          <p>{milestone.note}</p>
        ) : (
          <p>
            Target capital{" "}
            <b className="mono">{money(milestone.targetCapital)}</b> · expected
            ROI <b className="mono text-win">+{milestone.expectedRoiPct}%</b> ·
            opens in <span className="mono">{cd.label}</span>
          </p>
        )}
      </div>
      <button type="button" className="ip-link" onClick={onDetail}>
        {token ? "Details" : "Milestone brief"} ↗
      </button>
    </li>
  );
}

/* ── Comparison table (TanStack) ── */

type CompareRow = {
  id: string;
  code: string;
  name: string;
  lifecycle: "trading" | "open" | "upcoming" | "completed";
  risk: string;
  target: number;
  raised: number;
  fill: number;
  yourSlots: number;
  investment: number;
  roi: number;
  roiLabel: string;
  nextDate: string;
};

const compareColumn = createDeskColumnHelper<CompareRow>();

function CompareTable({
  rows,
  onPick,
}: {
  rows: CompareRow[];
  onPick: (id: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo(
    () =>
      compareColumn.columns([
        compareColumn.accessor("code", {
          header: "Pool",
          cell: (info) => (
            <span>
              <b className="mono">{info.getValue()}</b>
              <small>{info.row.original.name}</small>
            </span>
          ),
        }),
        compareColumn.accessor("lifecycle", {
          header: "Status",
          cell: (info) => <LifecycleTag lifecycle={info.getValue()} />,
        }),
        compareColumn.accessor("risk", { header: "Risk" }),
        compareColumn.accessor("target", {
          header: "Target",
          cell: (info) => (
            <span className="mono">{money(info.getValue())}</span>
          ),
        }),
        compareColumn.accessor("raised", {
          header: "Raised",
          cell: (info) => (
            <span className="mono">
              {money(info.getValue())}
              <small>{plainPercent(info.row.original.fill)} funded</small>
            </span>
          ),
        }),
        compareColumn.accessor("yourSlots", { header: "Your slots" }),
        compareColumn.accessor("investment", {
          header: "Your allocation",
          cell: (info) => (
            <span className="mono">{money(info.getValue())}</span>
          ),
        }),
        compareColumn.accessor("roi", {
          header: "Return",
          cell: (info) => (
            <span
              className={`mono ${info.getValue() >= 0 ? "text-win" : "text-loss"}`}
            >
              {info.row.original.roiLabel}
            </span>
          ),
        }),
        compareColumn.accessor("id", {
          header: "",
          enableSorting: false,
          cell: (info) => (
            <button
              type="button"
              className="ip-link"
              onClick={() => onPick(info.getValue())}
            >
              Inspect ↗
            </button>
          ),
        }),
      ]),
    [onPick],
  );
  const table = useDeskTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });
  return (
    <div className="table-responsive">
      <table className="table ip-table">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id}>
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    disabled={!header.column.getCanSort()}
                  >
                    <table.FlexRender header={header} />
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Wizard forms ── */

function BookingFields({
  pool,
  available,
  initialSlots,
  onValid,
}: {
  pool: OpenPool;
  available: number;
  initialSlots: number;
  onValid: (value: { slots: number }) => void;
}) {
  const form = useForm({
    defaultValues: {
      slots: available > 0 ? Math.min(initialSlots, available) : 1,
    },
    validators: {
      onSubmit: ({ value }) => {
        if (!Number.isInteger(value.slots) || value.slots < 1)
          return "Enter at least one slot";
        if (value.slots > available)
          return `Only ${available} slot(s) remain within your per-investor limit`;
        return undefined;
      },
    },
    onSubmit: ({ value }) => onValid({ slots: value.slots }),
  });
  return (
    <form
      id="ip-booking-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(s) => s.values}>
        {(v) => (
          <div className="ip-form-grid">
            <label className="ip-field">
              Slots to book
              <input
                className="form-control"
                aria-label="Slots to book"
                type="number"
                min={1}
                max={Math.max(available, 1)}
                value={v.slots}
                onChange={(e) =>
                  form.setFieldValue("slots", Number(e.target.value))
                }
              />
              <small>
                Min {money(pool.minSlot)} per slot · {available} bookable within
                your limit
              </small>
            </label>
            <div className="ip-calculation">
              <span>ALLOCATION</span>
              <b className="mono">{money(pool.minSlot * (v.slots || 0))}</b>
              <small>
                Booking total after this change:{" "}
                {money(pool.investment + pool.minSlot * (v.slots || 0))}
              </small>
            </div>
          </div>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.errors}>
        {(errors) =>
          errors.length ? (
            <p className="ip-error" role="alert">
              {errors.map(String).join("; ")}
            </p>
          ) : null
        }
      </form.Subscribe>
      <div className="ip-field-grid">
        <div>
          <span>BOOKING WINDOW</span>
          <b>{atDateTime(pool.closesAt)}</b>
        </div>
        <div>
          <span>PAYMENT STATUS</span>
          <b>
            {pool.payment === "verified" ? "Verified" : "Awaiting verification"}
          </b>
        </div>
      </div>
      <p className="ip-note">
        A booking is a reservation intent. Funds are not captured here and the
        slot is only confirmed after payment verification by the funding desk.
      </p>
    </form>
  );
}

function ScenarioFields({
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
      id="ip-scenario-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(s) => s.values}>
        {(v) => (
          <div className="ip-form-grid">
            <label className="ip-field">
              Principal allocation / USD
              <input
                className="form-control"
                aria-label="Scenario principal"
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
            <label className="ip-field">
              Target ROI / %
              <input
                className="form-control"
                aria-label="Scenario ROI"
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
            <label className="ip-field">
              Duration / days
              <input
                className="form-control"
                aria-label="Scenario duration"
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
            <p className="ip-error" role="alert">
              {errors.map(String).join("; ")}
            </p>
          ) : null
        }
      </form.Subscribe>
      <p className="ip-note">
        Projection maths only. It ignores fees, drawdown, early termination and
        variable pool performance; it is not a forecast or advice.
      </p>
    </form>
  );
}

/* ── Page ── */

export function InvestorPoolsPage({
  initial,
  initialPool,
  initialAction,
}: {
  initial: PoolsWorkspace;
  initialPool?: string;
  initialAction?: string;
}) {
  const router = useRouter();
  const { data, mutation } = usePools(initial);
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

  const initialModal = ((): { kind: Kind; id?: string } | null => {
    if (initialPool) {
      /* A permalink can point at any lifecycle; resolve it to the detail dialog
         that actually renders that pool instead of the trading template. */
      const matches = (p: { id: string; code: string }) =>
        p.id === initialPool || p.code === initialPool.toUpperCase();
      const find = <T extends { id: string; code: string }>(rows: T[]) =>
        rows.find(matches);
      const trading = find(initial.trading);
      if (trading) return { kind: "poolDetail", id: trading.id };
      const open = find(initial.open);
      if (open) return { kind: "openDetail", id: open.id };
      const upcoming = find(initial.upcoming);
      if (upcoming) return { kind: "upcomingDetail", id: upcoming.id };
      const completed = find(initial.completed);
      if (completed) return { kind: "completedDetail", id: completed.id };
    }
    const byAction: Record<string, Kind> = {
      book: "bookMore",
      reminder: "reminder",
      prebook: "prebook",
      statement: "statement",
      compare: "compare",
      calculator: "calculator",
      risk: "riskProfile",
      support: "support",
      fees: "fees",
      roadmap: "roadmapInfo",
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
    "allocation" | "capital" | "timeline" | null
  >(null);
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("pools");
  const [clock, setClock] = useState(initial.asOf);
  const [status, setStatus] = useState<
    "all" | "trading" | "open" | "upcoming" | "completed"
  >("all");
  const [risk, setRisk] = useState<
    "all" | "Low" | "Balanced" | "Growth" | "Aggressive"
  >("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"date" | "roi" | "fill" | "name">("date");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [minRoi, setMinRoi] = useState(0);
  const [maxDuration, setMaxDuration] = useState(0);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [bookPoolId, setBookPoolId] = useState(initial.open[0]?.id ?? "");
  const [bookSlots, setBookSlots] = useState(1);
  const [remindPoolId, setRemindPoolId] = useState(
    initial.upcoming[0]?.id ?? "",
  );
  const [remindLead, setRemindLead] = useState<1 | 2 | 3 | 7>(1);
  const [remindChannel, setRemindChannel] = useState<"email" | "in_app">(
    "email",
  );
  const [prebookPoolId, setPrebookPoolId] = useState(
    initial.upcoming[0]?.id ?? "",
  );
  const [prebookSlots, setPrebookSlots] = useState(1);
  const [statementScope, setStatementScope] = useState<
    "pool-summary" | "completed-history" | "roadmap"
  >("pool-summary");
  const [statementFormat, setStatementFormat] = useState<
    "json" | "csv" | "pdf"
  >("pdf");
  const [scenario, setScenario] = useState({
    principal: 10000,
    roiPct: 12,
    days: 30,
  });
  const [alerts, setAlerts] = useState(initial.preferences);
  const [supportTopic, setSupportTopic] = useState<
    "pool" | "payment" | "payout" | "kyc" | "other"
  >("pool");
  const [supportMessage, setSupportMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState(initial.asOf);
  const [tradeFilter, setTradeFilter] = useState("all");
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

  const matches = useCallback(
    (pool: {
      code: string;
      name: string;
      strategy: string;
      riskBand: string;
    }) => {
      if (risk !== "all" && pool.riskBand !== risk) return false;
      if (query.trim()) {
        const hay =
          `${pool.code} ${pool.name} ${pool.strategy} ${pool.riskBand}`.toLowerCase();
        if (!hay.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    },
    [query, risk],
  );

  const sortTrading = useCallback(
    (rows: TradingPool[]) => {
      const copy = [...rows];
      if (sort === "roi") copy.sort((a, b) => b.roiPct - a.roiPct);
      else if (sort === "fill")
        copy.sort(
          (a, b) => fillPct(b.raised, b.goal) - fillPct(a.raised, a.goal),
        );
      else if (sort === "name")
        copy.sort((a, b) => a.name.localeCompare(b.name));
      else copy.sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
      return copy;
    },
    [sort],
  );

  const tradingRows = useMemo(
    () =>
      sortTrading(
        data.trading.filter((pool) => matches(pool) && pool.roiPct >= minRoi),
      ),
    [data.trading, matches, minRoi, sortTrading],
  );

  const openRows = useMemo(
    () =>
      data.open.filter(
        (pool) =>
          matches(pool) &&
          pool.expectedRoiPct >= minRoi &&
          (maxDuration === 0 || pool.durationDays <= maxDuration) &&
          (!onlyAvailable || bookableSlots(pool) > 0),
      ),
    [data.open, matches, minRoi, maxDuration, onlyAvailable],
  );

  const upcomingRows = useMemo(
    () =>
      data.upcoming.filter(
        (pool) =>
          matches(pool) &&
          pool.expectedRoiPct >= minRoi &&
          (maxDuration === 0 || pool.durationDays <= maxDuration),
      ),
    [data.upcoming, matches, minRoi, maxDuration],
  );

  const completedRows = useMemo(
    () =>
      data.completed.filter(
        (pool) => matches(pool) && pool.finalRoiPct >= minRoi,
      ),
    [data.completed, matches, minRoi],
  );

  const showTrading = status === "all" || status === "trading";
  const showOpen = status === "all" || status === "open";
  const showUpcoming = status === "all" || status === "upcoming";
  const showCompleted = status === "all" || status === "completed";
  const showRoadmap = status === "all" || status === "upcoming";

  const poolBook = Number(
    data.trading.reduce((sum, p) => sum + p.investment, 0).toFixed(2),
  );
  const openBook = Number(
    data.open.reduce((sum, p) => sum + p.investment, 0).toFixed(2),
  );
  const committed = useLiveCountUp(poolBook);
  const lifetime = useLiveCountUp(data.summary.lifetimeNet);
  const nextOpen = [...data.upcoming].sort(
    (a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt),
  )[0];
  const nextRoadmap = [...data.roadmap]
    .filter((m) => m.state !== "token")
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
  const openAvailable = data.open.reduce((sum, p) => sum + bookableSlots(p), 0);
  const endingSoonCount = data.trading.filter((p) =>
    endingSoon(p.endsAt, clock, 72),
  ).length;

  const modalTrading =
    data.trading.find((p) => p.id === modal?.id) ?? data.trading[0];
  const modalOpen = data.open.find((p) => p.id === modal?.id) ?? data.open[0];
  const modalUpcoming =
    data.upcoming.find((p) => p.id === modal?.id) ?? data.upcoming[0];
  const modalCompleted =
    data.completed.find((p) => p.id === modal?.id) ?? data.completed[0];
  const modalTrade = data.trades.find((t) => t.id === modal?.id);
  const modalMilestone =
    data.roadmap.find((m) => m.id === modal?.id) ?? nextRoadmap;

  const bookPool = data.open.find((p) => p.id === bookPoolId) ?? data.open[0];
  const bookAvailable = bookPool ? bookableSlots(bookPool) : 0;
  const remindPool =
    data.upcoming.find((p) => p.id === remindPoolId) ?? data.upcoming[0];
  const prebookPool =
    data.upcoming.find((p) => p.id === prebookPoolId) ?? data.upcoming[0];
  const prebookExisting = data.interests.find(
    (i) => i.poolId === prebookPool?.id,
  );

  const tradeRows = useMemo(
    () =>
      data.trades.filter(
        (trade) => tradeFilter === "all" || trade.poolId === tradeFilter,
      ),
    [data.trades, tradeFilter],
  );

  const allPoolRows: CompareRow[] = useMemo(() => {
    const rows: CompareRow[] = [
      ...data.trading.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        lifecycle: "trading" as const,
        risk: p.riskBand,
        target: p.goal,
        raised: p.raised,
        fill: fillPct(p.raised, p.goal),
        yourSlots: p.userSlots,
        investment: p.investment,
        roi: p.roiPct,
        roiLabel: percent(p.roiPct),
        nextDate: p.endsAt,
      })),
      ...data.open.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        lifecycle: "open" as const,
        risk: p.riskBand,
        target: p.goal,
        raised: p.raised,
        fill: fillPct(p.raised, p.goal),
        yourSlots: p.bookedSlots,
        investment: p.investment,
        roi: p.expectedRoiPct,
        roiLabel: `+${p.expectedRoiPct}% target`,
        nextDate: p.closesAt,
      })),
      ...data.upcoming.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        lifecycle: "upcoming" as const,
        risk: p.riskBand,
        target: p.goal,
        raised: p.expressed,
        fill: fillPct(p.expressed, p.goal),
        yourSlots: data.interests.find((i) => i.poolId === p.id)?.slots ?? 0,
        investment: data.interests.find((i) => i.poolId === p.id)?.slots
          ? (data.interests.find((i) => i.poolId === p.id)?.slots ?? 0) *
            p.minSlot
          : 0,
        roi: p.expectedRoiPct,
        roiLabel: `+${p.expectedRoiPct}% target`,
        nextDate: p.opensAt,
      })),
      ...data.completed.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        lifecycle: "completed" as const,
        risk: p.riskBand,
        target: p.investment,
        raised: p.investment + p.netEarnings,
        fill: 100,
        yourSlots: p.userSlots,
        investment: p.investment,
        roi: p.finalRoiPct,
        roiLabel: percent(p.finalRoiPct),
        nextDate: p.completedAt,
      })),
    ];
    return rows;
  }, [data.completed, data.interests, data.open, data.trading, data.upcoming]);

  const compareRows = useMemo(
    () =>
      compare.length
        ? allPoolRows.filter((row) => compare.includes(row.id))
        : allPoolRows.slice(0, 6),
    [allPoolRows, compare],
  );

  const tableRows = useMemo(
    () =>
      allPoolRows.filter((row) => {
        if (status !== "all" && row.lifecycle !== status) return false;
        if (risk !== "all" && row.risk !== risk) return false;
        if (!query.trim()) return true;
        const hay = `${row.code} ${row.name} ${row.risk}`.toLowerCase();
        return hay.includes(query.trim().toLowerCase());
      }),
    [allPoolRows, query, risk, status],
  );

  const ledger = useMemo(() => {
    const local = data.audit.map((entry) => ({
      id: entry.id,
      at: entry.at,
      scope: "Local workspace" as const,
      title: entry.action.replaceAll("_", " "),
      detail: entry.detail,
    }));
    const source = [
      ...data.trading.map((p) => ({
        id: `src_${p.id}`,
        at: p.guardian.lastCheckedAt,
        scope: "Source snapshot" as const,
        title: `${p.code} Guardian check`,
        detail: p.guardian.note,
      })),
      ...data.completed.map((p) => ({
        id: `src_pay_${p.id}`,
        at: p.paidAt ?? p.completedAt,
        scope: "Source snapshot" as const,
        title: `${p.code} payout ${p.payout}`,
        detail: `${money(p.netEarnings, 2)} net after a ${p.platformCutPct}% platform share · ${p.payoutRef ?? "no reference"}`,
      })),
    ];
    const rows = [...local, ...source].sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at),
    );
    return ledgerOnlyLocal
      ? rows.filter((row) => row.scope === "Local workspace")
      : rows;
  }, [data.audit, data.completed, data.trading, ledgerOnlyLocal]);

  /* ── Effects ── */

  const overlay = Boolean(modal || drawer);
  useEffect(() => {
    if (!overlay) return;
    const prior = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const layer = document.querySelector<HTMLElement>(
      ".page-investor-pools [role=dialog]",
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
          ".page-investor-pools .desk-modal__body input, .page-investor-pools .desk-modal__body select, .page-investor-pools .desk-modal__body textarea",
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
    if (kind === "bookMore") {
      const pool =
        data.open.find((p) => p.id === id) ??
        data.open.find((p) => bookableSlots(p) > 0) ??
        data.open[0];
      if (pool) {
        setBookPoolId(pool.id);
        setBookSlots(Math.min(1, bookableSlots(pool)));
      }
    }
    if (kind === "reminder" || kind === "prebook") {
      const pool = data.upcoming.find((p) => p.id === id) ?? data.upcoming[0];
      if (pool) {
        setRemindPoolId(pool.id);
        setPrebookPoolId(pool.id);
        const reminder = data.reminders.find((r) => r.poolId === pool.id);
        if (reminder) setRemindLead(reminder.leadDays);
        const interest = data.interests.find((i) => i.poolId === pool.id);
        setPrebookSlots(interest?.slots ?? 1);
      }
    }
    if (kind === "riskProfile") setConfirmed(false);
  }

  function scrollTo(key: InvestorNavKey) {
    setActiveNav(key);
    const map: Partial<Record<InvestorNavKey, string>> = {
      pools: "ip-top",
      upcoming: "ip-upcoming",
      earnings: "ip-completed",
    };
    if (key === "overview") {
      router.push("/investor");
      return;
    }
    if (key === "pools") {
      document
        .getElementById("ip-top")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (key === "portfolio") {
      setDrawer("allocation");
      return;
    }
    if (key === "wallet") {
      router.push("/investor?action=payout");
      return;
    }
    if (key === "calculator") {
      router.push("/investor/calculator");
      return;
    }
    if (key === "notifications") {
      open("ledger");
      return;
    }
    if (key === "settings") {
      router.push("/investor?action=profile");
      return;
    }
    if (key === "activity") {
      router.push("/investor?focus=activity");
      return;
    }
    const id = map[key];
    if (id === "ip-completed") {
      router.push("/investor/earnings");
      return;
    }
    if (id)
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function run(
    command: PoolsCommand,
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

  const statementRows = (scope: typeof statementScope) => {
    if (scope === "completed-history")
      return data.completed.map((p) => ({
        pool: p.code,
        name: p.name,
        completed: isoDay(p.completedAt),
        slots: p.userSlots,
        invested: p.investment,
        finalRoiPct: p.finalRoiPct,
        gross: p.grossEarnings,
        platformCutPct: p.platformCutPct,
        net: p.netEarnings,
        payout: p.payout,
        payoutRef: p.payoutRef,
      }));
    if (scope === "roadmap")
      return data.roadmap.map((m) => ({
        code: m.code,
        name: m.name,
        date: isoDay(m.date),
        targetCapital: m.targetCapital,
        expectedRoiPct: m.expectedRoiPct,
        state: m.state,
      }));
    return [
      ...data.trading.map((p) => ({
        pool: p.code,
        name: p.name,
        lifecycle: "trading",
        goal: p.goal,
        raised: p.raised,
        yourSlots: p.userSlots,
        investment: p.investment,
        profitSharePct: p.profitSharePct,
        roiPct: p.roiPct,
        endsAt: isoDay(p.endsAt),
      })),
      ...data.open.map((p) => ({
        pool: p.code,
        name: p.name,
        lifecycle: "open",
        goal: p.goal,
        raised: p.raised,
        yourSlots: p.bookedSlots,
        investment: p.investment,
        profitSharePct: null,
        roiPct: p.expectedRoiPct,
        endsAt: isoDay(p.closesAt),
      })),
      ...data.upcoming.map((p) => ({
        pool: p.code,
        name: p.name,
        lifecycle: "upcoming",
        goal: p.goal,
        raised: p.expressed,
        yourSlots: data.interests.find((i) => i.poolId === p.id)?.slots ?? 0,
        investment: 0,
        profitSharePct: null,
        roiPct: p.expectedRoiPct,
        endsAt: isoDay(p.opensAt),
      })),
    ];
  };

  async function performStatement() {
    setBusy(true);
    try {
      const rows = statementRows(statementScope);
      const stamp = isoDay(data.asOf);
      if (statementFormat === "json") {
        download(
          JSON.stringify(
            { mode: "demo", asOf: data.asOf, scope: statementScope, rows },
            null,
            2,
          ),
          `pools-${statementScope}-${stamp}.json`,
          "application/json",
        );
      } else if (statementFormat === "csv") {
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
        download(csv, `pools-${statementScope}-${stamp}.csv`, "text/csv");
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(
          `tradeMO / ${statementScope.replaceAll("-", " ")} statement`,
          18,
          22,
        );
        doc.setFontSize(9);
        doc.text(
          `Source snapshot ${data.asOf} · demo export · no provider or settlement authority`,
          18,
          32,
        );
        doc.text(
          `Investor: ${data.profile.displayName} (${data.profile.id})`,
          18,
          38,
        );
        let y = 50;
        doc.setFontSize(8);
        rows.forEach((row) => {
          if (y > 274) {
            doc.addPage();
            y = 20;
          }
          doc.text(
            Object.entries(row as Record<string, unknown>)
              .map(([k, v]) => `${k}: ${v ?? "—"}`)
              .join(" · ")
              .slice(0, 150),
            18,
            y,
          );
          y += 6;
        });
        doc.save(`pools-${statementScope}-${stamp}.pdf`);
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

  async function downloadPayout(pool: CompletedPool) {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      doc.setFontSize(15);
      doc.text("tradeMO / pool payout record", 18, 22);
      doc.setFontSize(9);
      doc.text(
        `Reference ${pool.payoutRef ?? "—"} · ${pool.code} ${pool.name}`,
        18,
        32,
      );
      doc.text(
        `Paid ${pool.paidAt ? atDate(pool.paidAt) : "not paid"} · demo document`,
        18,
        38,
      );
      let y = 52;
      const rows: [string, string][] = [
        ["Invested", money(pool.investment, 2)],
        ["Final ROI", percent(pool.finalRoiPct)],
        ["Gross earnings", signedMoney(pool.grossEarnings, 2)],
        [
          `Platform share (${pool.platformCutPct}%)`,
          `−${money(pool.grossEarnings - pool.netEarnings, 2)}`,
        ],
        ["Net paid to investor", signedMoney(pool.netEarnings, 2)],
        ["Payout status", pool.payout],
        ["Payout reference", pool.payoutRef ?? "—"],
      ];
      rows.forEach(([label, value]) => {
        doc.text(label, 18, y);
        doc.text(value, 82, y);
        y += 8;
      });
      doc.setFontSize(8);
      doc.text(
        "Generated locally for review. Settlement records, tax documents and provider receipts must come from the backend.",
        18,
        y + 10,
      );
      doc.save(`${pool.code}-${pool.payoutRef ?? "payout"}-demo.pdf`);
      await mutation.mutateAsync({
        kind: "recordExport",
        scope: "completed-history",
        format: "pdf",
        count: 1,
      });
      pushToast({
        tone: "success",
        title: `${pool.code} payout record downloaded`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payout document failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!modal) return;
    switch (modal.kind) {
      case "bookMore":
        if (!bookPool) return;
        return void run(
          { kind: "bookSlots", poolId: bookPool.id, slots: bookSlots },
          { title: "Slot hold prepared locally" },
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
          { title: "Opening reminder prepared locally" },
        );
      case "prebook":
        if (!prebookPool) return;
        return void run(
          {
            kind: "prebookInterest",
            poolId: prebookPool.id,
            slots: prebookSlots,
          },
          { title: "Interest registered locally" },
        );
      case "statement":
        return void performStatement();
      case "calculator":
        return void run(
          {
            kind: "saveScenario",
            principal: scenario.principal,
            roiPct: scenario.roiPct,
            days: scenario.days,
          },
          { title: "Projection saved locally" },
        );
      case "riskProfile":
        return void run(
          { kind: "refreshPools", source: "manual" },
          { title: "Risk acknowledgement recorded locally" },
        );
      case "alertPrefs":
        return void run(
          { kind: "refreshPools", source: "manual" },
          { title: "Alert preferences saved locally" },
        );
      case "support":
        return void run(
          { kind: "support", topic: supportTopic, message: supportMessage },
          { title: "Support draft saved locally" },
        );
      default:
        return;
    }
  }

  async function manualRefresh() {
    setBusy(true);
    try {
      await mutation.mutateAsync({ kind: "refreshPools", source: "manual" });
      setLastRefresh(new Date().toISOString());
      setClock(data.asOf);
      pushToast({
        tone: "info",
        title: "Pool snapshot re-read",
        detail: "Local countdowns restarted; provider data is unchanged.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  const wizard = modal ? wizardKinds.includes(modal.kind) : false;
  const scenarioProfit = Number(
    ((scenario.principal * scenario.roiPct) / 100).toFixed(2),
  );
  const bookAmount = bookPool ? bookPool.minSlot * bookSlots : 0;
  const modalBlock = (() => {
    if (!modal) return "";
    if (modal.kind === "bookMore") {
      if (!bookPool) return "Choose an open pool";
      if (bookSlots < 1) return "Enter at least one slot";
      if (bookSlots > bookAvailable)
        return `Only ${bookAvailable} slot(s) remain within your limit`;
      return "";
    }
    if (modal.kind === "reminder" && !remindPool)
      return "Choose an upcoming pool";
    if (modal.kind === "prebook" && !prebookPool)
      return "Choose an upcoming pool";
    if (modal.kind === "support" && supportMessage.trim().length < 12)
      return "Add at least 12 characters so the desk can act on it";
    return "";
  })();

  const modalFooter = (
    <>
      {wizard && step === 2 ? (
        <label className="ip-check ip-ack">
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
        className="ip-btn"
        disabled={busy}
        onClick={() => (step ? setStep(step - 1) : close())}
      >
        {step ? "Back" : "Close"}
      </button>
      <span className="ip-foot-note">Session-only preview · no funds move</span>
      {wizard ? (
        <button
          type={
            (modal?.kind === "calculator" || modal?.kind === "bookMore") &&
            step === 0
              ? "submit"
              : "button"
          }
          form={
            modal?.kind === "calculator" && step === 0
              ? "ip-scenario-form"
              : modal?.kind === "bookMore" && step === 0
                ? "ip-booking-form"
                : undefined
          }
          className="ip-btn ip-btn--primary"
          disabled={
            busy || (step < 2 && !!modalBlock) || (step === 2 && !confirmed)
          }
          onClick={() => {
            if (
              (modal?.kind === "calculator" || modal?.kind === "bookMore") &&
              step === 0
            )
              return;
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

  return (
    <InvestorShell
      rootClass="page-investor-pools"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.investorSince.slice(0, 10)}`}
      poolBookValue={poolBook}
      monthRoi={data.summary.monthRoiPct}
      walletBalance={data.summary.wallet}
      unread={data.summary.unread}
      activeNav={activeNav}
      detailHref={`/investor/pools/${
        (modal?.kind === "poolDetail" ? modal.id : undefined) ??
        data.trading[0]?.id ??
        data.open[0]?.id ??
        data.upcoming[0]?.id ??
        data.completed[0]?.id ??
        "pkg_01"
      }`}
      quickActions={quickActions}
      onNavigate={scrollTo}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(
          tab === "portfolio"
            ? "allocation"
            : tab === "activity"
              ? "capital"
              : tab === "guardian"
                ? "timeline"
                : tab,
        )
      }
      onQuickAction={(key) => {
        if (key === "bookMore") open("bookMore");
        if (key === "compare") open("compare");
        if (key === "statement") open("statement");
        if (key === "reminder") open("reminder");
        if (key === "fees") open("fees");
        if (key === "roadmap")
          document
            .getElementById("ip-roadmap")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      onOpenNotifications={() => open("ledger")}
      onChromeReady={onChromeReady}
    >
      <div className="ip-page" id="ip-top">
        <header className="ip-head">
          <div>
            <div className="ip-eyebrow">
              <span className="ip-code mono">I-2</span>
              <span>INVESTOR WORKSPACE / CROWDFUNDING POOLS</span>
            </div>
            <h1>Crowdfunding pools</h1>
            <p>
              Every cycle in one register — trading, open for booking, upcoming
              and settled — with your allocation, funding progress and
              settlement status.
            </p>
            <div className="ip-meta">
              <span>
                <Icon name="calendar" size={13} /> Snapshot {atDateTime(clock)}
              </span>
              <span>
                <Icon name="layers" size={13} /> {data.trading.length} trading ·{" "}
                {data.open.length} open · {data.upcoming.length} upcoming ·{" "}
                {data.completed.length} completed
              </span>
              <span>
                <Icon name="clock" size={13} /> Next open{" "}
                {nextOpen ? countdown(nextOpen.opensAt, clock).label : "—"}
              </span>
            </div>
          </div>
          <div className="ip-actions">
            <button
              type="button"
              className="ip-btn"
              onClick={() => open("compare")}
            >
              <Icon name="layers" size={14} /> Compare pools
            </button>
            <button
              type="button"
              className="ip-btn ip-btn--primary"
              onClick={() => open("statement")}
            >
              <Icon name="download" size={14} /> Statement
            </button>
          </div>
        </header>

        <div className="ip-banner">
          <div>
            <b>FRONTEND POOL REGISTER</b>
            <span>
              Source as of {atDateTime(data.asOf)} · structured DTO · no
              provider fill, payment capture or settlement authority
            </span>
          </div>
          <div className="ip-banner__actions">
            <span className="ip-sync">
              <span className="live-dot" /> {relativeFrom(lastRefresh, clock)}
            </span>
            <button
              type="button"
              className="ip-link"
              onClick={() => void manualRefresh()}
              disabled={busy}
            >
              <Icon name="refresh" size={13} /> Refresh
            </button>
            <button
              type="button"
              className="ip-link"
              onClick={() => open("help")}
            >
              Integration boundaries ↗
            </button>
          </div>
        </div>

        <section className="ip-stats" aria-label="Pool book summary">
          <Stat
            label="COMMITTED CAPITAL"
            value={<span className="mono">{money(committed)}</span>}
            foot={`${money(openBook)} awaiting confirmation`}
            note={`${data.trading.length} trading + ${data.open.length} open positions`}
            icon="layers"
            delay={0}
          />
          <Stat
            label="NEXT ALLOCATION WINDOW"
            value={
              <span className="mono">
                {nextOpen ? countdown(nextOpen.opensAt, clock).label : "—"}
              </span>
            }
            foot={
              nextOpen
                ? `${nextOpen.code} · ${nextOpen.name}`
                : "No upcoming pool"
            }
            note={
              nextOpen
                ? `Opens ${atDateTime(nextOpen.opensAt)} · min ${money(nextOpen.minSlot)} per slot`
                : "The roadmap below lists future cycles."
            }
            icon="calendar"
            delay={60}
          />
          <Stat
            label="LIFETIME NET"
            value={
              <span className="mono text-win">{signedMoney(lifetime)}</span>
            }
            foot={`${data.completed.length} completed cycles`}
            note="Net of the platform share, before tax and transfer fees"
            tone="win"
            icon="trendUp"
            delay={120}
          />
          <Stat
            label="BOOKABLE SLOTS"
            value={<span className="mono">{openAvailable}</span>}
            foot={`${data.open.length} pools accepting bookings`}
            note={
              endingSoonCount > 0
                ? `${endingSoonCount} trading pool${endingSoonCount === 1 ? "" : "s"} end within 72 hours`
                : "No trading pool ends within 72 hours"
            }
            icon="pool"
            delay={180}
          />
        </section>

        <section className="ip-toolbar" aria-label="Filter pools">
          <div
            className="ip-chips"
            role="group"
            aria-label="Pool status filter"
          >
            {statusChips.map((chip) => {
              const count =
                chip.key === "all"
                  ? data.trading.length +
                    data.open.length +
                    data.upcoming.length +
                    data.completed.length
                  : chip.key === "trading"
                    ? data.trading.length
                    : chip.key === "open"
                      ? data.open.length
                      : chip.key === "upcoming"
                        ? data.upcoming.length
                        : data.completed.length;
              return (
                <button
                  key={chip.key}
                  type="button"
                  className={
                    status === chip.key ? "ip-chip is-active" : "ip-chip"
                  }
                  aria-pressed={status === chip.key}
                  onClick={() => setStatus(chip.key)}
                >
                  {chip.label}
                  <span className="mono">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="ip-toolbar__controls">
            <label className="ip-search">
              <Icon name="search" size={14} />
              <input
                type="search"
                aria-label="Search pools"
                placeholder="Search code, name, strategy…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="ip-select">
              <span>RISK</span>
              <select
                aria-label="Filter by risk band"
                value={risk}
                onChange={(e) => setRisk(e.target.value as typeof risk)}
              >
                <option value="all">All bands</option>
                <option value="Low">Low</option>
                <option value="Balanced">Balanced</option>
                <option value="Growth">Growth</option>
                <option value="Aggressive">Aggressive</option>
              </select>
            </label>
            <label className="ip-select">
              <span>SORT</span>
              <select
                aria-label="Sort pools"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="date">Next key date</option>
                <option value="roi">Highest return</option>
                <option value="fill">Funding fill</option>
                <option value="name">Pool name</option>
              </select>
            </label>
            <div className="ip-view" role="group" aria-label="Layout">
              <button
                type="button"
                className={view === "cards" ? "is-active" : ""}
                aria-pressed={view === "cards"}
                onClick={() => setView("cards")}
              >
                <Icon name="layers" size={14} /> Cards
              </button>
              <button
                type="button"
                className={view === "table" ? "is-active" : ""}
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
              >
                <Icon name="sliders" size={14} /> Table
              </button>
            </div>
            <button
              type="button"
              className="ip-btn ip-btn--quiet"
              onClick={() => open("filters")}
            >
              <Icon name="filter" size={14} /> Filters
              {minRoi > 0 || maxDuration > 0 || onlyAvailable ? (
                <span className="ip-filter-count">
                  {
                    [minRoi > 0, maxDuration > 0, onlyAvailable].filter(Boolean)
                      .length
                  }
                </span>
              ) : null}
            </button>
          </div>
        </section>

        {view === "table" ? (
          <section className="ip-section">
            <SectionHead
              code="00 / REGISTER"
              title="Pool register"
              hint={`${tableRows.length} pool${tableRows.length === 1 ? "" : "s"} matching the current filters. Sort any column; the card view carries the full workflow actions.`}
              aside={
                <button
                  type="button"
                  className="ip-btn"
                  onClick={() => open("compare")}
                >
                  Compare selected
                </button>
              }
            />
            {tableRows.length ? (
              <CompareTable
                rows={tableRows}
                onPick={(id) => {
                  const pool =
                    data.trading.find((p) => p.id === id) ??
                    data.open.find((p) => p.id === id) ??
                    data.upcoming.find((p) => p.id === id) ??
                    data.completed.find((p) => p.id === id);
                  if (!pool) return;
                  open(
                    pool.lifecycle === "trading"
                      ? "poolDetail"
                      : pool.lifecycle === "open"
                        ? "openDetail"
                        : pool.lifecycle === "upcoming"
                          ? "upcomingDetail"
                          : "completedDetail",
                    pool.id,
                  );
                }}
              />
            ) : (
              <div className="ip-empty">
                No pool matches these filters. Clear the search or open Filters
                to widen the range.
              </div>
            )}
          </section>
        ) : (
          <>
            {showTrading ? (
              <section id="ip-trading" className="ip-section">
                <SectionHead
                  code="01 / ACTIVE POOLS"
                  title="Capital in the market"
                  hint="Funding, your allocation and Guardian posture for every pool currently trading."
                  aside={
                    <div className="ip-head-stats">
                      <span>
                        Pool P&amp;L{" "}
                        <b
                          className={`mono ${
                            data.trading.reduce((s, p) => s + p.pnl, 0) >= 0
                              ? "text-win"
                              : "text-loss"
                          }`}
                        >
                          {signedMoney(
                            data.trading.reduce((s, p) => s + p.pnl, 0),
                          )}
                        </b>
                      </span>
                      <span>
                        Your share{" "}
                        <b
                          className={`mono ${
                            data.trading.reduce((s, p) => s + p.sharePnl, 0) >=
                            0
                              ? "text-win"
                              : "text-loss"
                          }`}
                        >
                          {signedMoney(
                            data.trading.reduce((s, p) => s + p.sharePnl, 0),
                          )}
                        </b>
                      </span>
                    </div>
                  }
                />
                {tradingRows.length ? (
                  <div className="ip-grid ip-grid--three">
                    {tradingRows.map((pool, index) => (
                      <TradingCard
                        key={pool.id}
                        pool={pool}
                        clock={clock}
                        delay={index * 60}
                        compare={compare.includes(pool.id)}
                        onCompare={() =>
                          setCompare((prev) =>
                            prev.includes(pool.id)
                              ? prev.filter((id) => id !== pool.id)
                              : [...prev, pool.id].slice(0, 4),
                          )
                        }
                        onDetail={() => open("poolDetail", pool.id)}
                        onTrades={() => {
                          setTradeFilter(pool.id);
                          open("liveTrades", pool.id);
                        }}
                        onGuardian={() => open("guardianDetail", pool.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="ip-empty">
                    No trading pool matches these filters. Widen the risk band
                    or clear the search to see the live book.
                  </div>
                )}
              </section>
            ) : null}

            {showOpen ? (
              <section id="ip-open" className="ip-section">
                <SectionHead
                  code="02 / OPEN FOR BOOKING"
                  title="Accepting allocations"
                  hint="Slots are reserved on booking and confirmed only after payment verification by the funding desk."
                  aside={
                    <div className="ip-head-stats">
                      <span>
                        Bookable now{" "}
                        <b className="mono">{openAvailable} slots</b>
                      </span>
                    </div>
                  }
                />
                {openRows.length ? (
                  <div className="ip-grid ip-grid--two">
                    {openRows.map((pool, index) => (
                      <OpenCard
                        key={pool.id}
                        pool={pool}
                        clock={clock}
                        delay={index * 60}
                        compare={compare.includes(pool.id)}
                        onCompare={() =>
                          setCompare((prev) =>
                            prev.includes(pool.id)
                              ? prev.filter((id) => id !== pool.id)
                              : [...prev, pool.id].slice(0, 4),
                          )
                        }
                        onDetail={() => open("openDetail", pool.id)}
                        onBook={() => open("bookMore", pool.id)}
                        onPayment={() => open("payment", pool.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="ip-empty">
                    No open pool matches these filters.{" "}
                    {onlyAvailable
                      ? "Turn off “only bookable” to include full pools."
                      : "Clear the search to see both funding windows."}
                  </div>
                )}
              </section>
            ) : null}

            {showUpcoming ? (
              <section id="ip-upcoming" className="ip-section">
                <SectionHead
                  code="03 / UPCOMING"
                  title="Next allocation windows"
                  hint="Register interest or set a reminder — no capital is reserved until the pool opens and payment clears."
                  aside={
                    <button
                      type="button"
                      className="ip-btn"
                      onClick={() => open("reminders")}
                    >
                      <Icon name="bell" size={14} /> Manage reminders
                      {data.reminders.length ? (
                        <span className="ip-filter-count">
                          {data.reminders.length}
                        </span>
                      ) : null}
                    </button>
                  }
                />
                {upcomingRows.length ? (
                  <div className="ip-grid ip-grid--two">
                    {upcomingRows.map((pool, index) => (
                      <UpcomingCard
                        key={pool.id}
                        pool={pool}
                        clock={clock}
                        delay={index * 60}
                        interest={
                          data.interests.find((i) => i.poolId === pool.id)
                            ?.slots ?? 0
                        }
                        reminded={data.reminders.some(
                          (r) => r.poolId === pool.id,
                        )}
                        onDetail={() => open("upcomingDetail", pool.id)}
                        onRemind={() => open("reminder", pool.id)}
                        onPrebook={() => open("prebook", pool.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="ip-empty">
                    No upcoming pool matches these filters.
                  </div>
                )}
              </section>
            ) : null}

            {showCompleted ? (
              <section id="ip-completed" className="ip-section">
                <SectionHead
                  code="04 / COMPLETED"
                  title="Closed cycles & payouts"
                  hint="Final pool performance, your net earnings after the platform share and the payout record for each cycle."
                  aside={
                    <div className="ip-head-stats">
                      <span>
                        Net paid{" "}
                        <b className="mono text-win">{signedMoney(lifetime)}</b>
                      </span>
                    </div>
                  }
                />
                {completedRows.length ? (
                  <div className="ip-completed-list">
                    {completedRows.map((pool, index) => (
                      <CompletedRow
                        key={pool.id}
                        pool={pool}
                        delay={index * 60}
                        onDetail={() => open("completedDetail", pool.id)}
                        onPayout={() => open("payoutDetail", pool.id)}
                        onStatement={() => {
                          open("payoutDetail", pool.id);
                          void downloadPayout(pool);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="ip-empty">
                    No completed cycle matches these filters.
                  </div>
                )}
              </section>
            ) : null}

            {showRoadmap ? (
              <section id="ip-roadmap" className="ip-section">
                <SectionHead
                  code="05 / ROADMAP"
                  title="Planned cycles · next 90 days"
                  hint="Target dates, capital and expected returns published by the funding desk. Targets are planning figures, not commitments."
                  aside={
                    <div className="ip-actions">
                      <button
                        type="button"
                        className="ip-btn"
                        onClick={() => open("roadmapInfo")}
                      >
                        How this is built
                      </button>
                      <button
                        type="button"
                        className="ip-btn"
                        onClick={() => open("statement")}
                      >
                        <Icon name="download" size={14} /> Export roadmap
                      </button>
                    </div>
                  }
                />
                <ol className="ip-roadmap">
                  {data.roadmap.map((milestone, index) => (
                    <RoadmapItem
                      key={milestone.id}
                      milestone={milestone}
                      clock={clock}
                      delay={index * 60}
                      onDetail={() => open("roadmapDetail", milestone.id)}
                    />
                  ))}
                </ol>
                <p className="ip-note">
                  Roadmap depth {daysBetween(data.asOf, "2026-12-31")} days ·
                  token launch is an announcement only and is not offered,
                  priced or distributed in this workspace.
                </p>
              </section>
            ) : null}
          </>
        )}

        <section className="ip-section ip-quick-section">
          <SectionHead
            code="06 / QUICK ACTIONS"
            title="Pool workflows"
            hint="Every action opens a complete local workflow — nothing is charged, confirmed or transmitted."
          />
          <div className="ip-quick">
            {[
              {
                title: "Book more slots",
                text: "Reserve additional slots in an open funding window.",
                icon: "plus" as IconName,
                run: () => open("bookMore"),
              },
              {
                title: "Compare pools",
                text: "Put up to four pools side by side on funding, risk and return.",
                icon: "layers" as IconName,
                run: () => open("compare"),
              },
              {
                title: "Download statement",
                text: "Export the pool register, completed history or the roadmap.",
                icon: "download" as IconName,
                run: () => open("statement"),
              },
              {
                title: "Set opening reminder",
                text: "Get alerted before an upcoming window opens.",
                icon: "bell" as IconName,
                run: () => open("reminder"),
              },
            ].map((action) => (
              <button
                type="button"
                className="ip-quick-card"
                key={action.title}
                onClick={action.run}
              >
                <span className="ip-quick-icon">
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
          <div className="ip-quick-links">
            <Link className="ip-link" href="/investor/earnings">
              Earnings report ↗
            </Link>
            <button
              type="button"
              className="ip-link"
              onClick={() => open("calculator")}
            >
              Return calculator
            </button>
            <Link className="ip-link" href="/investor?action=payout">
              Withdraw available balance ↗
            </Link>
            <button
              type="button"
              className="ip-link"
              onClick={() => open("riskProfile")}
            >
              Risk profile ↗
            </button>
            <button
              type="button"
              className="ip-link"
              onClick={() => open("fees")}
            >
              Fees &amp; economics ↗
            </button>
            <button
              type="button"
              className="ip-link"
              onClick={() => open("alertPrefs")}
            >
              Alert preferences
            </button>
          </div>
        </section>

        <footer className="ip-page-foot">
          <span>
            LOCAL INVESTOR DEMO · source snapshot {atDateTime(data.asOf)} · no
            settlement authority · revision {data.revision}
          </span>
          <div>
            <button
              type="button"
              className="ip-link"
              onClick={() => open("help")}
            >
              Workspace boundaries
            </button>
            <button
              type="button"
              className="ip-link"
              onClick={() => open("support")}
            >
              Contact desk
            </button>
            <button
              type="button"
              className="ip-link"
              onClick={() => open("ledger")}
            >
              Pool activity
            </button>
            <Link className="ip-link" href="/dashboard">
              Operator console ↗
            </Link>
          </div>
        </footer>
      </div>

      {drawer ? (
        <div
          className="op-drawer-backdrop ip-drawer-layer"
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
                <span className="ip-section-code">I-2 / POOL INSPECTOR</span>
                <h2 className="op-drawer__title">{data.profile.displayName}</h2>
                <p className="ip-muted">
                  {data.profile.tier} · {data.profile.country} ·{" "}
                  {data.profile.currency}
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
              className="ip-drawer-tabs"
              role="tablist"
              aria-label="Inspector views"
            >
              {(["allocation", "capital", "timeline"] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  role="tab"
                  aria-selected={drawer === tab}
                  className={drawer === tab ? "is-active" : ""}
                  onClick={() => setDrawer(tab)}
                >
                  {tab === "allocation"
                    ? "Allocation"
                    : tab === "capital"
                      ? "Capital"
                      : "Timeline"}
                </button>
              ))}
            </div>
            <div className="op-drawer__body">
              {drawer === "allocation" ? (
                <>
                  <div className="ip-drawer-summary">
                    <div>
                      <span>COMMITTED</span>
                      <b className="mono">{money(poolBook)}</b>
                    </div>
                    <div>
                      <span>UNREALIZED</span>
                      <b className="mono text-win">
                        {signedMoney(
                          data.trading.reduce((s, p) => s + p.sharePnl, 0),
                        )}
                      </b>
                    </div>
                    <div>
                      <span>MONTH ROI</span>
                      <b className="mono text-win">
                        {percent(data.summary.monthRoiPct)}
                      </b>
                    </div>
                  </div>
                  <div className="ip-drawer-block">
                    <div className="ip-section-code">ALLOCATION BY POOL</div>
                    {data.trading.map((pool) => (
                      <div className="ip-mix-row" key={pool.id}>
                        <span>
                          {pool.code}
                          <small>{pool.name}</small>
                        </span>
                        <Progress
                          value={
                            (pool.investment / Math.max(poolBook, 1)) * 100
                          }
                          label={`${pool.code} allocation share`}
                        />
                        <b className="mono">
                          {plainPercent(
                            (pool.investment / Math.max(poolBook, 1)) * 100,
                          )}
                        </b>
                      </div>
                    ))}
                    {data.open.map((pool) => (
                      <div className="ip-mix-row" key={pool.id}>
                        <span>
                          {pool.code}
                          <small>
                            {pool.name} · {pool.payment}
                          </small>
                        </span>
                        <Progress
                          value={
                            (pool.investment /
                              Math.max(poolBook + openBook, 1)) *
                            100
                          }
                          tone="muted"
                          label={`${pool.code} allocation share`}
                        />
                        <b className="mono">
                          {plainPercent(
                            (pool.investment /
                              Math.max(poolBook + openBook, 1)) *
                              100,
                          )}
                        </b>
                      </div>
                    ))}
                    <div className="ip-drawer-note">
                      <Icon name="info" size={13} /> Open positions are pending
                      payment verification and are not part of committed capital
                      until confirmed.
                    </div>
                  </div>
                  <div className="ip-drawer-list">
                    {[
                      ...data.trading.map((p) => ({
                        id: p.id,
                        title: `${p.code} · ${p.name}`,
                        detail: `trading · ${p.profitSharePct}% share`,
                        value: money(p.investment),
                        tone: "text-win",
                        kind: "poolDetail" as Kind,
                      })),
                      ...data.open.map((p) => ({
                        id: p.id,
                        title: `${p.code} · ${p.name}`,
                        detail: `open · ${p.bookedSlots} slots booked`,
                        value: money(p.investment),
                        tone: "",
                        kind: "openDetail" as Kind,
                      })),
                      ...data.completed.map((p) => ({
                        id: p.id,
                        title: `${p.code} · ${p.name}`,
                        detail: `completed · net paid`,
                        value: signedMoney(p.netEarnings),
                        tone: "text-win",
                        kind: "completedDetail" as Kind,
                      })),
                    ].map((row) => (
                      <button
                        type="button"
                        key={`${row.kind}_${row.id}`}
                        onClick={() => open(row.kind, row.id)}
                      >
                        <div>
                          <b>{row.title}</b>
                          <small>{row.detail}</small>
                        </div>
                        <div>
                          <b className={`mono ${row.tone}`}>{row.value}</b>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="ip-drawer-actions">
                    <button
                      type="button"
                      className="ip-btn"
                      onClick={() => open("statement")}
                    >
                      Statement
                    </button>
                    <button
                      type="button"
                      className="ip-btn ip-btn--primary"
                      onClick={() => open("bookMore")}
                    >
                      Book slots
                    </button>
                  </div>
                </>
              ) : drawer === "capital" ? (
                <>
                  <div className="ip-drawer-summary">
                    <div>
                      <span>RAISED</span>
                      <b className="mono">
                        {money(data.open.reduce((s, p) => s + p.raised, 0))}
                      </b>
                    </div>
                    <div>
                      <span>REMAINING</span>
                      <b className="mono">
                        {money(
                          data.open.reduce(
                            (s, p) => s + Math.max(0, p.goal - p.raised),
                            0,
                          ),
                        )}
                      </b>
                    </div>
                    <div>
                      <span>INVESTORS</span>
                      <b className="mono">
                        {data.open.reduce((s, p) => s + p.investors, 0)}
                      </b>
                    </div>
                  </div>
                  {data.open.map((pool) => (
                    <div className="ip-capital-block" key={pool.id}>
                      <div className="ip-capital-head">
                        <b>
                          {pool.code} · {pool.name}
                        </b>
                        <span className="mono">
                          {plainPercent(fillPct(pool.raised, pool.goal))}
                        </span>
                      </div>
                      <Progress
                        value={fillPct(pool.raised, pool.goal)}
                        label={`${pool.code} funding`}
                      />
                      <div className="ip-capital-grid">
                        <div>
                          <span>GOAL</span>
                          <b className="mono">{money(pool.goal)}</b>
                        </div>
                        <div>
                          <span>RAISED</span>
                          <b className="mono">{money(pool.raised)}</b>
                        </div>
                        <div>
                          <span>BOOKABLE</span>
                          <b className="mono">{bookableSlots(pool)} slots</b>
                        </div>
                        <div>
                          <span>CLOSES</span>
                          <b>{atDate(pool.closesAt)}</b>
                        </div>
                      </div>
                      <div className="ip-drawer-note">
                        <Icon name="clock" size={13} />{" "}
                        {countdown(pool.closesAt, clock).label} left ·{" "}
                        {pool.investors} investors · payment {pool.payment}
                      </div>
                    </div>
                  ))}
                  <div className="ip-drawer-actions">
                    <button
                      type="button"
                      className="ip-btn"
                      onClick={() => open("compare")}
                    >
                      Compare
                    </button>
                    <button
                      type="button"
                      className="ip-btn ip-btn--primary"
                      onClick={() => open("bookMore")}
                    >
                      Book slots
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="ip-drawer-headline">
                    <span>Key dates from the source snapshot</span>
                    <button
                      type="button"
                      className="ip-link"
                      onClick={() => open("roadmapInfo")}
                    >
                      Method ↗
                    </button>
                  </div>
                  <div className="ip-drawer-list">
                    {[
                      ...data.trading.map((p) => ({
                        id: `tl_${p.id}`,
                        at: p.endsAt,
                        title: `${p.code} trading ends`,
                        detail: `${countdown(p.endsAt, clock).label} · ${atDate(p.endsAt)}`,
                        run: () => open("poolDetail", p.id),
                      })),
                      ...data.open.map((p) => ({
                        id: `tl_open_${p.id}`,
                        at: p.closesAt,
                        title: `${p.code} booking closes`,
                        detail: `${countdown(p.closesAt, clock).label} · ${atDate(p.closesAt)}`,
                        run: () => open("openDetail", p.id),
                      })),
                      ...data.upcoming.map((p) => ({
                        id: `tl_up_${p.id}`,
                        at: p.opensAt,
                        title: `${p.code} opens`,
                        detail: `${countdown(p.opensAt, clock).label} · ${atDate(p.opensAt)}`,
                        run: () => open("upcomingDetail", p.id),
                      })),
                      ...data.roadmap.map((m) => ({
                        id: `tl_rm_${m.id}`,
                        at: m.date,
                        title: `${m.code} milestone`,
                        detail: `${m.name} · ${money(m.targetCapital)} target`,
                        run: () => open("roadmapDetail", m.id),
                      })),
                    ]
                      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
                      .slice(0, 9)
                      .map((row) => (
                        <button type="button" key={row.id} onClick={row.run}>
                          <div>
                            <b>{row.title}</b>
                            <small>{row.detail}</small>
                          </div>
                          <span className="mono ip-muted">
                            {atDate(row.at)}
                          </span>
                        </button>
                      ))}
                  </div>
                  <div className="ip-drawer-actions">
                    <button
                      type="button"
                      className="ip-btn"
                      onClick={() => open("reminder")}
                    >
                      Reminder
                    </button>
                    <button
                      type="button"
                      className="ip-btn ip-btn--primary"
                      onClick={() =>
                        document.getElementById("ip-roadmap")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                      }
                    >
                      Open roadmap
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {modal ? (
        <div className="ip-modal-layer">
          <DeskModalShell
            code="I-2"
            eyebrow="INVESTOR WORKSPACE / LOCAL PREVIEW"
            title={titles[modal.kind]}
            subtitle="Structured session state. Payments, slot confirmation, provider data and messaging require authenticated backend integration."
            size={modalSize[modal.kind] ?? "md"}
            onClose={close}
            steps={wizard ? [...steps] : undefined}
            currentStep={step}
            footer={modalFooter}
          >
            {error ? (
              <p className="ip-error" role="alert">
                {error}
              </p>
            ) : null}

            {wizard && modal.kind === "bookMore" ? (
              step === 0 ? (
                <>
                  <label className="ip-field">
                    Funding window
                    <select
                      className="form-select"
                      aria-label="Open pool"
                      value={bookPoolId}
                      onChange={(e) => {
                        setBookPoolId(e.target.value);
                        setBookSlots(1);
                      }}
                    >
                      {data.open.map((pool) => (
                        <option key={pool.id} value={pool.id}>
                          {pool.code} · {pool.name} ({bookableSlots(pool)}{" "}
                          bookable)
                        </option>
                      ))}
                    </select>
                  </label>
                  {bookPool ? (
                    <BookingFields
                      key={bookPool.id}
                      pool={bookPool}
                      available={bookAvailable}
                      initialSlots={bookSlots}
                      onValid={(value) => {
                        setBookSlots(value.slots);
                        setStep(1);
                      }}
                    />
                  ) : null}
                </>
              ) : step === 1 ? (
                <>
                  <div className="ip-breakdown">
                    <div>
                      <span>SLOTS</span>
                      <b className="mono">{bookSlots}</b>
                      <small>
                        {bookPool ? bookPool.code : "—"} at{" "}
                        {bookPool ? money(bookPool.minSlot) : "—"}
                      </small>
                    </div>
                    <div>
                      <span>ALLOCATION</span>
                      <b className="mono">{money(bookAmount)}</b>
                      <small>nothing captured</small>
                    </div>
                    <div>
                      <span>POSITION AFTER</span>
                      <b className="mono">
                        {bookPool
                          ? money(bookPool.investment + bookAmount)
                          : "—"}
                      </b>
                      <small>pending verification</small>
                    </div>
                  </div>
                  <div className="ip-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {bookPool ? `${bookPool.code} · ${bookPool.name}` : "—"}
                      </b>
                    </div>
                    <div>
                      <span>Slots booked today</span>
                      <b className="mono">
                        {bookPool ? bookPool.bookedSlots : 0}
                      </b>
                    </div>
                    <div>
                      <span>Per-investor limit</span>
                      <b className="mono">
                        {bookPool ? bookPool.maxSlotsPerUser : 0} slots
                      </b>
                    </div>
                    <div>
                      <span>Remaining in window</span>
                      <b className="mono">{bookAvailable} slot(s)</b>
                    </div>
                    <div>
                      <span>Booking closes</span>
                      <b>{bookPool ? atDateTime(bookPool.closesAt) : "—"}</b>
                    </div>
                  </div>
                  <div className="ip-inline-note is-warn">
                    <Icon name="alert" size={13} /> Payment verification is
                    required before the funding desk confirms the slot.
                    Unverified bookings may be released when the window closes.
                  </div>
                </>
              ) : (
                <div className="ip-review-final">
                  <Icon name="plus" size={20} />
                  <p>
                    Confirm to record a local slot hold of {money(bookAmount)}.
                    No payment is captured, no capacity is reserved with the
                    provider and the pool totals in this workspace are updated
                    for review only.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "reminder" ? (
              step === 0 ? (
                <>
                  <label className="ip-field">
                    Upcoming pool
                    <select
                      className="form-select"
                      aria-label="Reminder pool"
                      value={remindPoolId}
                      onChange={(e) => setRemindPoolId(e.target.value)}
                    >
                      {data.upcoming.map((pool) => (
                        <option key={pool.id} value={pool.id}>
                          {pool.code} · {pool.name} — opens{" "}
                          {atDate(pool.opensAt)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ip-form-grid">
                    <label className="ip-field">
                      Lead time
                      <select
                        className="form-select"
                        aria-label="Reminder lead time"
                        value={remindLead}
                        onChange={(e) =>
                          setRemindLead(Number(e.target.value) as 1 | 2 | 3 | 7)
                        }
                      >
                        {[1, 2, 3, 7].map((day) => (
                          <option key={day} value={day}>
                            {day} day{day === 1 ? "" : "s"} before opening
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ip-field">
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
                  </div>
                  <p className="ip-note">
                    Reminders are stored locally. Delivery requires a verified
                    channel, consent and a messaging provider.
                  </p>
                </>
              ) : step === 1 ? (
                <>
                  <div className="ip-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {remindPool
                          ? `${remindPool.code} · ${remindPool.name}`
                          : "—"}
                      </b>
                    </div>
                    <div>
                      <span>Opens</span>
                      <b>{remindPool ? atDateTime(remindPool.opensAt) : "—"}</b>
                    </div>
                    <div>
                      <span>Lead time</span>
                      <b>
                        {remindLead} day{remindLead === 1 ? "" : "s"} before
                      </b>
                    </div>
                    <div>
                      <span>Channel</span>
                      <b>{remindChannel === "email" ? "Email" : "In-app"}</b>
                    </div>
                    <div>
                      <span>Existing reminders</span>
                      <b className="mono">{data.reminders.length}</b>
                    </div>
                  </div>
                  <div className="ip-inline-note">
                    <Icon name="info" size={13} /> No message is queued by this
                    preview. Production delivery must honour quiet hours and
                    unsubscribe settings.
                  </div>
                </>
              ) : (
                <div className="ip-review-final">
                  <Icon name="bell" size={20} />
                  <p>
                    Confirm the local reminder. You can edit or remove it from
                    Manage reminders at any time before the pool opens.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "prebook" ? (
              step === 0 ? (
                <>
                  <label className="ip-field">
                    Upcoming pool
                    <select
                      className="form-select"
                      aria-label="Interest pool"
                      value={prebookPoolId}
                      onChange={(e) => {
                        setPrebookPoolId(e.target.value);
                        setPrebookSlots(1);
                      }}
                    >
                      {data.upcoming.map((pool) => (
                        <option key={pool.id} value={pool.id}>
                          {pool.code} · {pool.name} — min {money(pool.minSlot)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ip-form-grid">
                    <label className="ip-field">
                      Slots of interest
                      <input
                        className="form-control"
                        type="number"
                        aria-label="Interest slots"
                        min={1}
                        max={prebookPool ? prebookPool.maxSlotsPerUser : 1}
                        value={prebookSlots}
                        onChange={(e) =>
                          setPrebookSlots(Number(e.target.value))
                        }
                      />
                      <small>
                        Max {prebookPool ? prebookPool.maxSlotsPerUser : 0} per
                        investor
                      </small>
                    </label>
                    <div className="ip-calculation">
                      <span>INDICATIVE ALLOCATION</span>
                      <b className="mono">
                        {money((prebookPool?.minSlot ?? 0) * prebookSlots)}
                      </b>
                      <small>No capital reserved until the pool opens</small>
                    </div>
                  </div>
                  <p className="ip-note">
                    Registering interest tells the funding desk how much
                    capacity to expect. It does not create a booking, charge a
                    payment method or guarantee a slot.
                  </p>
                </>
              ) : step === 1 ? (
                <>
                  <div className="ip-review">
                    <div>
                      <span>Pool</span>
                      <b>
                        {prebookPool
                          ? `${prebookPool.code} · ${prebookPool.name}`
                          : "—"}
                      </b>
                    </div>
                    <div>
                      <span>Opens</span>
                      <b>
                        {prebookPool ? atDateTime(prebookPool.opensAt) : "—"}
                      </b>
                    </div>
                    <div>
                      <span>Slots</span>
                      <b className="mono">{prebookSlots}</b>
                    </div>
                    <div>
                      <span>Indicative allocation</span>
                      <b className="mono">
                        {money((prebookPool?.minSlot ?? 0) * prebookSlots)}
                      </b>
                    </div>
                    <div>
                      <span>Existing registration</span>
                      <b>
                        {prebookExisting
                          ? `${prebookExisting.slots} slot(s)`
                          : "None"}
                      </b>
                    </div>
                  </div>
                  <div className="ip-inline-note is-warn">
                    <Icon name="alert" size={13} /> Interest is not a
                    reservation and does not protect a price, slot or return.
                  </div>
                </>
              ) : (
                <div className="ip-review-final">
                  <Icon name="target" size={20} />
                  <p>
                    Confirm to register {prebookSlots} slot(s) of interest
                    locally for{" "}
                    {prebookPool ? prebookPool.code : "the selected pool"}.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "statement" ? (
              step === 0 ? (
                <>
                  <div className="ip-form-grid">
                    <label className="ip-field">
                      Scope
                      <select
                        className="form-select"
                        aria-label="Statement scope"
                        value={statementScope}
                        onChange={(e) =>
                          setStatementScope(
                            e.target.value as typeof statementScope,
                          )
                        }
                      >
                        <option value="pool-summary">
                          Pool register · trading, open, upcoming
                        </option>
                        <option value="completed-history">
                          Completed cycles & payouts
                        </option>
                        <option value="roadmap">90-day roadmap</option>
                      </select>
                    </label>
                    <label className="ip-field">
                      Format
                      <select
                        className="form-select"
                        aria-label="Statement format"
                        value={statementFormat}
                        onChange={(e) =>
                          setStatementFormat(
                            e.target.value as typeof statementFormat,
                          )
                        }
                      >
                        <option value="pdf">PDF · readable statement</option>
                        <option value="csv">CSV · spreadsheet</option>
                        <option value="json">JSON · structured</option>
                      </select>
                    </label>
                  </div>
                  <div className="ip-kv-grid">
                    <div>
                      <span>RECORDS</span>
                      <b className="mono">
                        {statementRows(statementScope).length}
                      </b>
                    </div>
                    <div>
                      <span>SOURCE AS OF</span>
                      <b>{atDateTime(data.asOf)}</b>
                    </div>
                    <div>
                      <span>INVESTOR</span>
                      <b>{data.profile.displayName}</b>
                    </div>
                    <div>
                      <span>REVISION</span>
                      <b className="mono">#{data.revision}</b>
                    </div>
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="ip-review">
                    <div>
                      <span>Scope</span>
                      <b>{statementScope.replaceAll("-", " ")}</b>
                    </div>
                    <div>
                      <span>Format</span>
                      <b>{statementFormat.toUpperCase()}</b>
                    </div>
                    <div>
                      <span>Records</span>
                      <b className="mono">
                        {statementRows(statementScope).length}
                      </b>
                    </div>
                    <div>
                      <span>Contains</span>
                      <b>Source figures + local session records</b>
                    </div>
                  </div>
                  <p className="ip-note">
                    Exports exclude credentials, payment instruments, provider
                    tokens and internal identifiers. They are not certified
                    statements or tax documents.
                  </p>
                </>
              ) : (
                <div className="ip-review-final">
                  <Icon name="download" size={20} />
                  <p>
                    Confirm to generate the file in your browser. The export is
                    recorded in the local workspace audit so the provenance
                    stays visible.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "calculator" ? (
              step === 0 ? (
                <>
                  <ScenarioFields
                    initial={scenario}
                    onValid={(value) => {
                      setScenario(value);
                      setStep(1);
                    }}
                  />
                  <p className="ip-note">
                    Simple interest projection. The result is shown for review
                    only and is not applied to any pool.
                  </p>
                </>
              ) : step === 1 ? (
                <>
                  <div className="ip-breakdown">
                    <div>
                      <span>PRINCIPAL</span>
                      <b className="mono">{money(scenario.principal)}</b>
                      <small>{scenario.days} day horizon</small>
                    </div>
                    <div>
                      <span>PROJECTED PROFIT</span>
                      <b className="mono text-win">
                        {signedMoney(scenarioProfit)}
                      </b>
                      <small>at {scenario.roiPct}% target ROI</small>
                    </div>
                    <div>
                      <span>PROJECTED TOTAL</span>
                      <b className="mono">
                        {money(scenario.principal + scenarioProfit)}
                      </b>
                      <small>before fees or tax</small>
                    </div>
                  </div>
                  <div className="ip-review">
                    <div>
                      <span>Simple daily rate</span>
                      <b className="mono">
                        {(scenario.roiPct / Math.max(scenario.days, 1)).toFixed(
                          3,
                        )}
                        %
                      </b>
                    </div>
                    <div>
                      <span>Platform share</span>
                      <b>Applied to gross profit at settlement</b>
                    </div>
                    <div>
                      <span>Saved scenarios</span>
                      <b className="mono">{data.scenarios.length}</b>
                    </div>
                  </div>
                  <div className="ip-inline-note is-warn">
                    <Icon name="alert" size={13} /> A projection is not a
                    guaranteed return. Pool performance may be negative and
                    capital is at risk.
                  </div>
                </>
              ) : (
                <div className="ip-review-final">
                  <Icon name="chart" size={20} />
                  <p>
                    Confirm to save this scenario in the local workspace. No
                    allocation, expected-return promise or payment is created.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "riskProfile" ? (
              step === 0 ? (
                <>
                  <div className="ip-risk-table">
                    {[
                      {
                        band: "Low",
                        text: "Conservative carry with small stake sizing and a 3% Guardian drawdown limit.",
                      },
                      {
                        band: "Balanced",
                        text: "Mixed rise/fall with a 5% drawdown limit and a loss-streak pause.",
                      },
                      {
                        band: "Growth",
                        text: "Trend continuation with a 5% limit and wider stake range.",
                      },
                      {
                        band: "Aggressive",
                        text: "High-frequency rotation with a 5% limit and the largest stake range.",
                      },
                    ].map((row) => (
                      <div className="ip-risk-row" key={row.band}>
                        <span className={`ip-risk-pill ${riskTone(row.band)}`}>
                          {row.band}
                        </span>
                        <p>{row.text}</p>
                        <span className="mono ip-muted">
                          {
                            allPoolRows.filter((pool) => pool.risk === row.band)
                              .length
                          }{" "}
                          pool(s)
                        </span>
                      </div>
                    ))}
                  </div>
                  <label className="ip-field">
                    Declared experience
                    <select
                      className="form-select"
                      aria-label="Declared experience"
                    >
                      <option>New to synthetic indices</option>
                      <option>Some experience with Deriv contracts</option>
                      <option>Experienced trader</option>
                    </select>
                  </label>
                  <p className="ip-note">
                    The platform records your acknowledgement locally. A
                    production onboarding must apply jurisdictional eligibility
                    and suitability checks server-side.
                  </p>
                </>
              ) : step === 1 ? (
                <>
                  <div className="ip-review">
                    <div>
                      <span>Pools in scope</span>
                      <b className="mono">{allPoolRows.length}</b>
                    </div>
                    <div>
                      <span>Highest band</span>
                      <b>Aggressive · 5% drawdown limit</b>
                    </div>
                    <div>
                      <span>Capital at risk</span>
                      <b>All committed capital</b>
                    </div>
                    <div>
                      <span>Protection</span>
                      <b>Guardian pause + loss-streak check</b>
                    </div>
                  </div>
                  <div className="ip-inline-note is-warn">
                    <Icon name="alert" size={13} /> Synthetic indices are
                    leveraged products. Past performance, target ROI and
                    projections do not predict future results.
                  </div>
                </>
              ) : (
                <div className="ip-review-final">
                  <Icon name="shield" size={20} />
                  <p>
                    Confirm that you have read the risk bands and understand
                    that capital can be lost. This acknowledgement is stored in
                    the local workspace.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "alertPrefs" ? (
              step === 0 ? (
                <>
                  <div className="ip-form-grid">
                    <label className="ip-field">
                      Ending-soon window
                      <select
                        className="form-select"
                        aria-label="Ending soon window"
                        value={alerts.endingSoonHours}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            endingSoonHours: Number(e.target.value),
                          })
                        }
                      >
                        {[24, 48, 72, 120].map((hours) => (
                          <option key={hours} value={hours}>
                            {hours} hours before trading ends
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ip-field">
                      Automatic refresh
                      <select
                        className="form-select"
                        aria-label="Automatic refresh"
                        value={alerts.autoRefresh ? "on" : "off"}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            autoRefresh: e.target.value === "on",
                          })
                        }
                      >
                        <option value="on">
                          Refresh snapshots automatically
                        </option>
                        <option value="off">Manual refresh only</option>
                      </select>
                    </label>
                  </div>
                  <div className="ip-channel-row">
                    <label className="ip-check">
                      <input
                        type="checkbox"
                        aria-label="Email pool alerts"
                        checked={alerts.alertChannels.email}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            alertChannels: {
                              ...alerts.alertChannels,
                              email: e.target.checked,
                            },
                          })
                        }
                      />
                      Email
                    </label>
                    <label className="ip-check">
                      <input
                        type="checkbox"
                        aria-label="In-app pool alerts"
                        checked={alerts.alertChannels.in_app}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            alertChannels: {
                              ...alerts.alertChannels,
                              in_app: e.target.checked,
                            },
                          })
                        }
                      />
                      In-app
                    </label>
                  </div>
                  <p className="ip-note">
                    Preferences are local metadata. No delivery channel is
                    configured by this preview.
                  </p>
                </>
              ) : step === 1 ? (
                <div className="ip-review">
                  <div>
                    <span>Ending soon</span>
                    <b>{alerts.endingSoonHours} hours</b>
                  </div>
                  <div>
                    <span>Channels</span>
                    <b>
                      {[
                        alerts.alertChannels.email ? "Email" : null,
                        alerts.alertChannels.in_app ? "In-app" : null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "None"}
                    </b>
                  </div>
                  <div>
                    <span>Auto refresh</span>
                    <b>{alerts.autoRefresh ? "On" : "Off"}</b>
                  </div>
                  <div>
                    <span>Scope</span>
                    <b>Pool status, ending soon, roadmap changes</b>
                  </div>
                </div>
              ) : (
                <div className="ip-review-final">
                  <Icon name="bell" size={20} />
                  <p>
                    Confirm the preview. Production delivery must verify channel
                    ownership and respect quiet hours.
                  </p>
                </div>
              )
            ) : null}

            {wizard && modal.kind === "support" ? (
              step === 0 ? (
                <>
                  <div className="ip-form-grid">
                    <label className="ip-field">
                      Topic
                      <select
                        className="form-select"
                        aria-label="Support topic"
                        value={supportTopic}
                        onChange={(e) =>
                          setSupportTopic(e.target.value as typeof supportTopic)
                        }
                      >
                        <option value="pool">Pool allocation</option>
                        <option value="payment">Payment verification</option>
                        <option value="payout">Payout or withdrawal</option>
                        <option value="kyc">Verification</option>
                        <option value="other">Something else</option>
                      </select>
                    </label>
                  </div>
                  <label className="ip-field">
                    Message
                    <textarea
                      className="form-control"
                      aria-label="Support message"
                      rows={5}
                      maxLength={1000}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Describe the question without including passwords, codes, card numbers or bank details."
                    />
                    <small>
                      {supportMessage.length}/1000 · never include credentials
                    </small>
                  </label>
                </>
              ) : step === 1 ? (
                <div className="ip-review">
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
                <div className="ip-review-final">
                  <Icon name="mail" size={20} />
                  <p>
                    Confirm to save this message as a local support draft. It is
                    not transmitted; production must use an authenticated
                    support channel.
                  </p>
                </div>
              )
            ) : null}

            {modal.kind === "poolDetail" && modalTrading ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">{modalTrading.code}</span>
                    <h3>{modalTrading.name}</h3>
                    <p>{modalTrading.strategy}</p>
                  </div>
                  <span
                    className={`ip-guardian is-${modalTrading.guardian.status}`}
                  >
                    <span className="live-dot" /> Guardian{" "}
                    {modalTrading.guardian.status}
                  </span>
                </div>
                <div className="ip-kv-grid">
                  <div>
                    <span>GOAL / RAISED</span>
                    <b className="mono">
                      {money(modalTrading.goal)} / {money(modalTrading.raised)}
                    </b>
                  </div>
                  <div>
                    <span>SLOTS FILLED</span>
                    <b className="mono">
                      {modalTrading.slotsFilled}/{modalTrading.slotsTotal}
                    </b>
                  </div>
                  <div>
                    <span>YOUR ALLOCATION</span>
                    <b className="mono">
                      {money(modalTrading.investment)} ·{" "}
                      {modalTrading.userSlots} slot(s)
                    </b>
                  </div>
                  <div>
                    <span>PROFIT SHARE</span>
                    <b className="mono">{modalTrading.profitSharePct}%</b>
                  </div>
                  <div>
                    <span>STARTED</span>
                    <b>{atDateTime(modalTrading.startedAt)}</b>
                  </div>
                  <div>
                    <span>TRADING ENDS</span>
                    <b>{atDateTime(modalTrading.endsAt)}</b>
                  </div>
                  <div>
                    <span>SETTLEMENT BATCH</span>
                    <b>{modalTrading.settlementBatch}</b>
                  </div>
                  <div>
                    <span>MARKETS</span>
                    <b className="mono">{modalTrading.markets.join(" · ")}</b>
                  </div>
                </div>
                <div className="ip-progress-block">
                  <div>
                    <span>FUNDING PROGRESS</span>
                    <span className="mono">
                      {plainPercent(
                        fillPct(modalTrading.raised, modalTrading.goal),
                      )}
                    </span>
                  </div>
                  <Progress
                    value={fillPct(modalTrading.raised, modalTrading.goal)}
                    label={`${modalTrading.code} funding`}
                  />
                  <small>
                    {money(modalTrading.goal - modalTrading.raised)} remaining
                    to target · closes in{" "}
                    {countdown(modalTrading.endsAt, clock).label}
                  </small>
                </div>
                <div className="ip-breakdown">
                  <div>
                    <span>POOL P&amp;L</span>
                    <b
                      className={`mono ${modalTrading.pnl >= 0 ? "text-win" : "text-loss"}`}
                    >
                      {signedMoney(modalTrading.pnl)}
                    </b>
                    <small>
                      {modalTrading.trades} trades ·{" "}
                      {modalTrading.winRatePct.toFixed(1)}% win
                    </small>
                  </div>
                  <div>
                    <span>YOUR SHARE</span>
                    <b
                      className={`mono ${modalTrading.sharePnl >= 0 ? "text-win" : "text-loss"}`}
                    >
                      {signedMoney(modalTrading.sharePnl)}
                    </b>
                    <small>
                      at {modalTrading.profitSharePct}% of pool profit
                    </small>
                  </div>
                  <div>
                    <span>ROI ON ALLOCATION</span>
                    <b className="mono text-win">
                      {percent(modalTrading.roiPct)}
                    </b>
                    <small>unrealized until settlement</small>
                  </div>
                </div>
                <div className="ip-guardian-card">
                  <div>
                    <Icon name="shield" size={15} />
                    <b>Guardian policy</b>
                    <span className="ip-tag is-active">ACTIVE</span>
                  </div>
                  <p>{modalTrading.guardian.note}</p>
                  <div className="ip-guardian-line">
                    <span>
                      Drawdown {modalTrading.guardian.drawdownPct}% /{" "}
                      {modalTrading.guardian.drawdownLimitPct}%
                    </span>
                    <span>
                      Loss streak {modalTrading.guardian.consecutiveLosses} /{" "}
                      {modalTrading.guardian.maxConsecutiveLosses}
                    </span>
                    <span>
                      Checked {atDateTime(modalTrading.guardian.lastCheckedAt)}
                    </span>
                  </div>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <Link
                    className="ip-btn ip-btn--primary"
                    href={`/investor/pools/${modalTrading.id}`}
                  >
                    Full workspace <Icon name="arrowRight" size={13} />
                  </Link>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => {
                      setTradeFilter(modalTrading.id);
                      open("liveTrades", modalTrading.id);
                    }}
                  >
                    Live trades
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("guardianDetail", modalTrading.id)}
                  >
                    Guardian log
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("reminder")}
                  >
                    Reminder for next cycle
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("fees")}
                  >
                    Fee economics
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "liveTrades" ? (
              <>
                <div className="ip-filter-row">
                  <label className="ip-field">
                    Pool
                    <select
                      className="form-select"
                      aria-label="Trade pool filter"
                      value={tradeFilter}
                      onChange={(e) => setTradeFilter(e.target.value)}
                    >
                      <option value="all">All pools</option>
                      {data.trading.map((pool) => (
                        <option key={pool.id} value={pool.id}>
                          {pool.code} · {pool.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ip-filter-stats">
                    <span>Matched trades</span>
                    <b className="mono">{tradeRows.length}</b>
                    <span>Your share</span>
                    <b className="mono text-win">
                      {signedMoney(
                        tradeRows.reduce((sum, t) => sum + t.investorShare, 0),
                        2,
                      )}
                    </b>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table ip-table">
                    <thead>
                      <tr>
                        {[
                          "Trade",
                          "Pool",
                          "Market",
                          "Stake",
                          "Pool P&L",
                          "Your share",
                          "Result",
                          "Closed",
                        ].map((head) => (
                          <th key={head}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tradeRows.map((trade) => (
                        <tr key={trade.id}>
                          <td>
                            <button
                              type="button"
                              className="ip-link mono"
                              onClick={() => open("tradeDetail", trade.id)}
                            >
                              {trade.id}
                            </button>
                          </td>
                          <td className="mono">
                            {data.trading.find((p) => p.id === trade.poolId)
                              ?.code ?? "—"}
                          </td>
                          <td>
                            {trade.symbol}
                            <small>{trade.contract}</small>
                          </td>
                          <td className="mono">{money(trade.stake)}</td>
                          <td
                            className={`mono ${(trade.poolPnl ?? 0) >= 0 ? "text-win" : "text-loss"}`}
                          >
                            {trade.poolPnl === null
                              ? "open"
                              : signedMoney(trade.poolPnl, 2)}
                          </td>
                          <td
                            className={`mono ${trade.investorShare >= 0 ? "text-win" : "text-loss"}`}
                          >
                            {signedMoney(trade.investorShare, 2)}
                          </td>
                          <td>
                            <span className={`ip-tag is-${trade.result}`}>
                              {trade.result.toUpperCase()}
                            </span>
                          </td>
                          <td className="mono">
                            {trade.closedAt ? atTime(trade.closedAt) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="ip-note">
                  Trades are source observations. Your share applies the pool
                  profit share to the realized pool P&amp;L of each closed
                  contract.
                </p>
              </>
            ) : null}

            {modal.kind === "tradeDetail" && modalTrade ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">{modalTrade.id}</span>
                    <h3>
                      {modalTrade.symbol} · {modalTrade.contract}
                    </h3>
                    <p>
                      {data.trading.find((p) => p.id === modalTrade.poolId)
                        ?.code ?? "—"}{" "}
                      · {modalTrade.result}
                    </p>
                  </div>
                  <span className={`ip-tag is-${modalTrade.result}`}>
                    {modalTrade.result.toUpperCase()}
                  </span>
                </div>
                <div className="ip-kv-grid">
                  <div>
                    <span>STAKE</span>
                    <b className="mono">{money(modalTrade.stake)}</b>
                  </div>
                  <div>
                    <span>POOL P&amp;L</span>
                    <b className="mono">
                      {modalTrade.poolPnl === null
                        ? "open"
                        : signedMoney(modalTrade.poolPnl, 2)}
                    </b>
                  </div>
                  <div>
                    <span>YOUR SHARE</span>
                    <b className="mono text-win">
                      {signedMoney(modalTrade.investorShare, 2)}
                    </b>
                  </div>
                  <div>
                    <span>OPENED</span>
                    <b>{atDateTime(modalTrade.openedAt)}</b>
                  </div>
                  <div>
                    <span>CLOSED</span>
                    <b>
                      {modalTrade.closedAt
                        ? atDateTime(modalTrade.closedAt)
                        : "still open"}
                    </b>
                  </div>
                  <div>
                    <span>PROFIT SHARE</span>
                    <b className="mono">
                      {data.trading.find((p) => p.id === modalTrade.poolId)
                        ?.profitSharePct ?? 0}
                      %
                    </b>
                  </div>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("poolDetail", modalTrade.poolId)}
                  >
                    Pool detail
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("liveTrades")}
                  >
                    All trades
                  </button>
                </div>
                <p className="ip-note">
                  Executions, tickets and provider identifiers must come from
                  the trading backend; this record is a display snapshot.
                </p>
              </>
            ) : null}

            {modal.kind === "guardianDetail" && modalTrading ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">{modalTrading.code}</span>
                    <h3>Guardian risk controls</h3>
                    <p>
                      {modalTrading.name} · checked{" "}
                      {atDateTime(modalTrading.guardian.lastCheckedAt)}
                    </p>
                  </div>
                  <span className="ip-tag is-active">ACTIVE</span>
                </div>
                <div className="ip-kv-grid">
                  <div>
                    <span>CONSECUTIVE LOSSES</span>
                    <b className="mono">
                      {modalTrading.guardian.consecutiveLosses} /{" "}
                      {modalTrading.guardian.maxConsecutiveLosses}
                    </b>
                  </div>
                  <div>
                    <span>DRAWDOWN</span>
                    <b className="mono">
                      {modalTrading.guardian.drawdownPct}% /{" "}
                      {modalTrading.guardian.drawdownLimitPct}%
                    </b>
                  </div>
                  <div>
                    <span>POLICY RESULT</span>
                    <b>Within limits</b>
                  </div>
                  <div>
                    <span>NEXT CHECK</span>
                    <b>Next settlement batch</b>
                  </div>
                </div>
                <div className="ip-meter">
                  <span
                    style={{
                      width: `${Math.min(100, (modalTrading.guardian.drawdownPct / Math.max(modalTrading.guardian.drawdownLimitPct, 0.01)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="ip-note">{modalTrading.guardian.note}</p>
                <div className="ip-section-code">RISK EVENT LOG</div>
                <div className="ip-drawer-list">
                  {data.guardianLog
                    .filter((event) => event.poolId === modalTrading.id)
                    .map((event) => (
                      <div className="ip-drawer-row" key={event.id}>
                        <div>
                          <b>{event.event}</b>
                          <small>
                            {atDateTime(event.at)} · {event.action}
                          </small>
                        </div>
                        <span className="ip-tag">
                          {event.result.toUpperCase()}
                        </span>
                      </div>
                    ))}
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("liveTrades", modalTrading.id)}
                  >
                    Inspect trades
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("riskProfile")}
                  >
                    Risk bands
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "openDetail" && modalOpen ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">{modalOpen.code}</span>
                    <h3>{modalOpen.name}</h3>
                    <p>{modalOpen.strategy}</p>
                  </div>
                  <LifecycleTag lifecycle="open" />
                </div>
                <div className="ip-kv-grid">
                  <div>
                    <span>BOOKING WINDOW</span>
                    <b>
                      {atDateTime(modalOpen.opensAt)} →{" "}
                      {atDateTime(modalOpen.closesAt)}
                    </b>
                  </div>
                  <div>
                    <span>CLOSES IN</span>
                    <b className="mono">
                      {countdown(modalOpen.closesAt, clock).label}
                    </b>
                  </div>
                  <div>
                    <span>MIN PER SLOT</span>
                    <b className="mono">{money(modalOpen.minSlot)}</b>
                  </div>
                  <div>
                    <span>MAX SLOTS / INVESTOR</span>
                    <b className="mono">{modalOpen.maxSlotsPerUser}</b>
                  </div>
                  <div>
                    <span>DURATION</span>
                    <b>{modalOpen.durationDays} days</b>
                  </div>
                  <div>
                    <span>EXPECTED ROI</span>
                    <b className="mono text-win">
                      +{modalOpen.expectedRoiPct}%
                    </b>
                  </div>
                  <div>
                    <span>TARGET CAPITAL</span>
                    <b className="mono">{money(modalOpen.goal)}</b>
                  </div>
                  <div>
                    <span>TRADING ENDS</span>
                    <b>{atDate(modalOpen.tradingEndsAt)}</b>
                  </div>
                </div>
                <div className="ip-progress-block">
                  <div>
                    <span>FUNDING</span>
                    <span className="mono">
                      {plainPercent(fillPct(modalOpen.raised, modalOpen.goal))}
                    </span>
                  </div>
                  <Progress
                    value={fillPct(modalOpen.raised, modalOpen.goal)}
                    label={`${modalOpen.code} funding`}
                  />
                  <small>
                    {money(modalOpen.raised)} raised of {money(modalOpen.goal)}{" "}
                    · {modalOpen.investors} investors ·{" "}
                    {bookableSlots(modalOpen)} slot(s) bookable for you
                  </small>
                </div>
                <div className="ip-review">
                  <div>
                    <span>Your booked slots</span>
                    <b className="mono">{modalOpen.bookedSlots}</b>
                  </div>
                  <div>
                    <span>Your investment</span>
                    <b className="mono">{money(modalOpen.investment)}</b>
                  </div>
                  <div>
                    <span>Payment</span>
                    <b>
                      {modalOpen.payment === "verified"
                        ? "Verified"
                        : "Awaiting verification"}
                    </b>
                  </div>
                  <div>
                    <span>Payment reference</span>
                    <b className="mono">{modalOpen.paymentRef ?? "—"}</b>
                  </div>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("payment", modalOpen.id)}
                  >
                    Payment status
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("fees")}
                  >
                    Fee economics
                  </button>
                  <button
                    type="button"
                    className="ip-btn ip-btn--primary"
                    onClick={() => open("bookMore", modalOpen.id)}
                    disabled={bookableSlots(modalOpen) === 0}
                  >
                    Book more slots
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "payment" && modalOpen ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">{modalOpen.code}</span>
                    <h3>Payment verification</h3>
                    <p>
                      {modalOpen.payment === "verified"
                        ? "Verified by the funding desk"
                        : "Awaiting verification"}
                    </p>
                  </div>
                  <span className={`ip-pay is-${modalOpen.payment}`}>
                    <Icon
                      name={
                        modalOpen.payment === "verified" ? "check" : "clock"
                      }
                      size={12}
                    />
                    {modalOpen.payment === "verified" ? "Verified" : "Pending"}
                  </span>
                </div>
                <div className="ip-kv-grid">
                  <div>
                    <span>REFERENCE</span>
                    <b className="mono">{modalOpen.paymentRef ?? "—"}</b>
                  </div>
                  <div>
                    <span>AMOUNT</span>
                    <b className="mono">{money(modalOpen.investment)}</b>
                  </div>
                  <div>
                    <span>SLOTS</span>
                    <b className="mono">{modalOpen.bookedSlots}</b>
                  </div>
                  <div>
                    <span>METHOD</span>
                    <b>Bank transfer · USD</b>
                  </div>
                </div>
                <div className="ip-section-code">VERIFICATION STEPS</div>
                <div className="ip-drawer-list">
                  {[
                    {
                      title: "Booking registered",
                      detail: atDateTime(modalOpen.opensAt),
                      state: "done",
                    },
                    {
                      title: "Transfer received",
                      detail:
                        modalOpen.payment === "verified"
                          ? "Reconciled against the ledger"
                          : "Awaiting provider confirmation",
                      state:
                        modalOpen.payment === "verified" ? "done" : "pending",
                    },
                    {
                      title: "Desk verification",
                      detail:
                        modalOpen.payment === "verified"
                          ? "Approved before the funding close"
                          : "Queued for review",
                      state:
                        modalOpen.payment === "verified" ? "done" : "pending",
                    },
                    {
                      title: "Slot confirmed",
                      detail:
                        modalOpen.payment === "verified"
                          ? "Included in the trading book"
                          : "Not yet confirmed",
                      state:
                        modalOpen.payment === "verified" ? "done" : "pending",
                    },
                  ].map((row) => (
                    <div className="ip-drawer-row" key={row.title}>
                      <div>
                        <b>{row.title}</b>
                        <small>{row.detail}</small>
                      </div>
                      <span
                        className={`ip-tag ${row.state === "done" ? "is-active" : ""}`}
                      >
                        {row.state === "done" ? "DONE" : "PENDING"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("support")}
                  >
                    Ask about this payment
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("openDetail", modalOpen.id)}
                  >
                    Pool detail
                  </button>
                </div>
                <p className="ip-note">
                  Payment capture, reconciliation and refunds must be executed
                  by the back office. This workspace never stores instruments or
                  card data.
                </p>
              </>
            ) : null}

            {modal.kind === "upcomingDetail" && modalUpcoming ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">{modalUpcoming.code}</span>
                    <h3>{modalUpcoming.name}</h3>
                    <p>{modalUpcoming.strategy}</p>
                  </div>
                  <LifecycleTag lifecycle="upcoming" />
                </div>
                <div className="ip-kv-grid">
                  <div>
                    <span>OPENS</span>
                    <b>{atDateTime(modalUpcoming.opensAt)}</b>
                  </div>
                  <div>
                    <span>CLOSES</span>
                    <b>{atDateTime(modalUpcoming.closesAt)}</b>
                  </div>
                  <div>
                    <span>OPENS IN</span>
                    <b className="mono">
                      {countdown(modalUpcoming.opensAt, clock).label}
                    </b>
                  </div>
                  <div>
                    <span>DURATION</span>
                    <b>{modalUpcoming.durationDays} days</b>
                  </div>
                  <div>
                    <span>MIN PER SLOT</span>
                    <b className="mono">{money(modalUpcoming.minSlot)}</b>
                  </div>
                  <div>
                    <span>MAX SLOTS / INVESTOR</span>
                    <b className="mono">{modalUpcoming.maxSlotsPerUser}</b>
                  </div>
                  <div>
                    <span>TARGET CAPITAL</span>
                    <b className="mono">{money(modalUpcoming.goal)}</b>
                  </div>
                  <div>
                    <span>EXPECTED ROI</span>
                    <b className="mono text-win">
                      +{modalUpcoming.expectedRoiPct}%
                    </b>
                  </div>
                </div>
                <div className="ip-progress-block">
                  <div>
                    <span>EXPRESSED INTEREST</span>
                    <span className="mono">
                      {plainPercent(
                        fillPct(modalUpcoming.expressed, modalUpcoming.goal),
                      )}
                    </span>
                  </div>
                  <Progress
                    value={fillPct(modalUpcoming.expressed, modalUpcoming.goal)}
                    label="Expressed interest"
                  />
                  <small>
                    {money(modalUpcoming.expressed)} of{" "}
                    {money(modalUpcoming.goal)} · this is soft interest, not
                    committed capital
                  </small>
                </div>
                <p className="ip-note">{modalUpcoming.note}</p>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("reminder", modalUpcoming.id)}
                  >
                    {data.reminders.some((r) => r.poolId === modalUpcoming.id)
                      ? "Edit reminder"
                      : "Set reminder"}
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("fees")}
                  >
                    Fee economics
                  </button>
                  <button
                    type="button"
                    className="ip-btn ip-btn--primary"
                    onClick={() => open("prebook", modalUpcoming.id)}
                  >
                    Pre-book interest
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "reminders" ? (
              <>
                <div className="ip-section-code">UPCOMING WINDOWS</div>
                {data.upcoming.map((pool) => {
                  const reminder = data.reminders.find(
                    (r) => r.poolId === pool.id,
                  );
                  return (
                    <div className="ip-reminder-row" key={pool.id}>
                      <div>
                        <b>
                          {pool.code} · {pool.name}
                        </b>
                        <small>
                          Opens {atDateTime(pool.opensAt)} · min{" "}
                          {money(pool.minSlot)}
                        </small>
                      </div>
                      {reminder ? (
                        <div className="ip-reminder-actions">
                          <span className="ip-tag is-interest">
                            <Icon name="bell" size={11} />
                            {reminder.leadDays}d ·{" "}
                            {reminder.channel === "email" ? "Email" : "In-app"}
                          </span>
                          <button
                            type="button"
                            className="ip-btn"
                            onClick={() =>
                              void run(
                                { kind: "removeReminder", poolId: pool.id },
                                {
                                  keep: true,
                                  title: "Reminder removed locally",
                                },
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="ip-btn"
                          onClick={() => open("reminder", pool.id)}
                        >
                          Set reminder
                        </button>
                      )}
                    </div>
                  );
                })}
                {!data.upcoming.length ? (
                  <div className="ip-empty">
                    No upcoming pool is published yet.
                  </div>
                ) : null}
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("alertPrefs")}
                  >
                    Alert preferences
                  </button>
                  <button
                    type="button"
                    className="ip-btn ip-btn--primary"
                    onClick={() => open("reminder")}
                  >
                    New reminder
                  </button>
                </div>
                <p className="ip-note">
                  {data.reminders.length} reminder(s) stored locally. Delivery
                  requires a verified channel and messaging provider.
                </p>
              </>
            ) : null}

            {modal.kind === "completedDetail" && modalCompleted ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">{modalCompleted.code}</span>
                    <h3>{modalCompleted.name}</h3>
                    <p>
                      {atDate(modalCompleted.startedAt)} →{" "}
                      {atDate(modalCompleted.completedAt)} ·{" "}
                      {relativeFrom(modalCompleted.completedAt)}
                    </p>
                  </div>
                  <LifecycleTag lifecycle="completed" />
                </div>
                <div className="ip-breakdown">
                  <div>
                    <span>FINAL ROI</span>
                    <b className="mono text-win">
                      {percent(modalCompleted.finalRoiPct)}
                    </b>
                    <small>
                      {modalCompleted.userSlots} slots ·{" "}
                      {money(modalCompleted.investment)}
                    </small>
                  </div>
                  <div>
                    <span>GROSS EARNINGS</span>
                    <b className="mono text-win">
                      {signedMoney(modalCompleted.grossEarnings, 2)}
                    </b>
                    <small>before the platform share</small>
                  </div>
                  <div>
                    <span>NET PAID</span>
                    <b className="mono text-win">
                      {signedMoney(modalCompleted.netEarnings, 2)}
                    </b>
                    <small>
                      after {modalCompleted.platformCutPct}% platform share
                    </small>
                  </div>
                </div>
                <div className="ip-review">
                  <div>
                    <span>Payout status</span>
                    <b>{modalCompleted.payout}</b>
                  </div>
                  <div>
                    <span>Paid on</span>
                    <b>
                      {modalCompleted.paidAt
                        ? atDateTime(modalCompleted.paidAt)
                        : "—"}
                    </b>
                  </div>
                  <div>
                    <span>Reference</span>
                    <b className="mono">{modalCompleted.payoutRef ?? "—"}</b>
                  </div>
                  <div>
                    <span>Settlement</span>
                    <b>{modalCompleted.settlement}</b>
                  </div>
                  <div>
                    <span>Strategy</span>
                    <b>{modalCompleted.strategy}</b>
                  </div>
                  <div>
                    <span>Risk band</span>
                    <b>{modalCompleted.riskBand}</b>
                  </div>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("payoutDetail", modalCompleted.id)}
                  >
                    Payout record
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => void downloadPayout(modalCompleted)}
                  >
                    <Icon name="download" size={13} /> Statement PDF
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("fees")}
                  >
                    Fee economics
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "payoutDetail" && modalCompleted ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">
                      {modalCompleted.payoutRef ?? "NO-REF"}
                    </span>
                    <h3>Payout record</h3>
                    <p>
                      {modalCompleted.code} · {modalCompleted.name}
                    </p>
                  </div>
                  <span className="ip-pay is-verified">
                    <Icon name="check" size={12} />{" "}
                    {modalCompleted.payout.toUpperCase()}
                  </span>
                </div>
                <div className="ip-kv-grid">
                  <div>
                    <span>NET PAID</span>
                    <b className="mono text-win">
                      {money(modalCompleted.netEarnings, 2)}
                    </b>
                  </div>
                  <div>
                    <span>PAID ON</span>
                    <b>
                      {modalCompleted.paidAt
                        ? atDateTime(modalCompleted.paidAt)
                        : "—"}
                    </b>
                  </div>
                  <div>
                    <span>GROSS</span>
                    <b className="mono">
                      {money(modalCompleted.grossEarnings, 2)}
                    </b>
                  </div>
                  <div>
                    <span>PLATFORM SHARE</span>
                    <b className="mono">
                      {modalCompleted.platformCutPct}% · −
                      {money(
                        modalCompleted.grossEarnings -
                          modalCompleted.netEarnings,
                        2,
                      )}
                    </b>
                  </div>
                </div>
                <div className="ip-review">
                  <div>
                    <span>Destination</span>
                    <b>Bank transfer · Equity Bank •••• 8842 · USD</b>
                  </div>
                  <div>
                    <span>Transfer fee</span>
                    <b className="mono">$1.50</b>
                  </div>
                  <div>
                    <span>Settlement reference</span>
                    <b className="mono">{modalCompleted.payoutRef ?? "—"}</b>
                  </div>
                  <div>
                    <span>Reconciliation</span>
                    <b>{modalCompleted.settlement}</b>
                  </div>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => void downloadPayout(modalCompleted)}
                  >
                    <Icon name="download" size={13} /> Download receipt PDF
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("completedDetail", modalCompleted.id)}
                  >
                    Cycle detail
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("support")}
                  >
                    Query this payout
                  </button>
                </div>
                <p className="ip-note">
                  Settlement evidence and provider receipts must be attached by
                  the back office before this record is authoritative.
                </p>
              </>
            ) : null}

            {modal.kind === "roadmapDetail" && modalMilestone ? (
              <>
                <div className="ip-modal-title">
                  <div>
                    <span className="ip-code mono">{modalMilestone.code}</span>
                    <h3>{modalMilestone.name}</h3>
                    <p>
                      {modalMilestone.state === "token"
                        ? "Announcement only"
                        : `${modalMilestone.state} · opens ${atDate(modalMilestone.date)}`}
                    </p>
                  </div>
                  <span className={`ip-tag is-${modalMilestone.state}`}>
                    {modalMilestone.state.toUpperCase()}
                  </span>
                </div>
                <div className="ip-kv-grid">
                  <div>
                    <span>TARGET DATE</span>
                    <b>{atDateTime(modalMilestone.date)}</b>
                  </div>
                  <div>
                    <span>COUNTDOWN</span>
                    <b className="mono">
                      {countdown(modalMilestone.date, clock).label}
                    </b>
                  </div>
                  <div>
                    <span>TARGET CAPITAL</span>
                    <b className="mono">
                      {modalMilestone.targetCapital
                        ? money(modalMilestone.targetCapital)
                        : "—"}
                    </b>
                  </div>
                  <div>
                    <span>EXPECTED ROI</span>
                    <b className="mono text-win">
                      {modalMilestone.expectedRoiPct
                        ? `+${modalMilestone.expectedRoiPct}%`
                        : "—"}
                    </b>
                  </div>
                </div>
                <p className="ip-note">{modalMilestone.note}</p>
                <div className="ip-actions ip-modal-actions">
                  {data.upcoming.some((p) => p.id === modalMilestone.id) ? (
                    <button
                      type="button"
                      className="ip-btn"
                      onClick={() => open("upcomingDetail", modalMilestone.id)}
                    >
                      Open pool brief
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ip-btn"
                      onClick={() => open("reminder")}
                    >
                      Set reminder
                    </button>
                  )}
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("roadmapInfo")}
                  >
                    Roadmap method
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("statement")}
                  >
                    Export roadmap
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "roadmapInfo" ? (
              <>
                <div className="ip-section-code">HOW THE ROADMAP IS BUILT</div>
                <ul className="ip-list">
                  <li>
                    Confirmed cycles are published by the funding desk with a
                    target open date, capital range and expected ROI band.
                  </li>
                  <li>
                    Planned cycles are directional and can move when an earlier
                    pool settles late or Guardian limits change.
                  </li>
                  <li>
                    Target capital is the syndicate ceiling, not a commitment
                    from any investor. Soft interest is tracked separately from
                    booked capital.
                  </li>
                  <li>
                    Expected ROI is a planning band. It is not a promise, a
                    floor or a forward-looking guarantee.
                  </li>
                </ul>
                <div className="ip-section-code">TOKEN LAUNCH</div>
                <p className="ip-note">
                  The 2026-12-15 token announcement is informational. This
                  workspace does not offer, price, allocate or distribute
                  tokens, and nothing on this page should be read as a
                  securities offering.
                </p>
                <div className="ip-kv-grid">
                  <div>
                    <span>MILESTONES</span>
                    <b className="mono">{data.roadmap.length}</b>
                  </div>
                  <div>
                    <span>CONFIRMED</span>
                    <b className="mono">
                      {
                        data.roadmap.filter((m) => m.state === "confirmed")
                          .length
                      }
                    </b>
                  </div>
                  <div>
                    <span>TARGET CAPITAL</span>
                    <b className="mono">
                      {money(
                        data.roadmap.reduce(
                          (sum, m) => sum + m.targetCapital,
                          0,
                        ),
                      )}
                    </b>
                  </div>
                  <div>
                    <span>WINDOW</span>
                    <b>Next 90 days</b>
                  </div>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("statement")}
                  >
                    Export the roadmap
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("riskProfile")}
                  >
                    Risk bands
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "compare" ? (
              <>
                <div className="ip-compare-picker">
                  {allPoolRows.map((row) => (
                    <label className="ip-check" key={row.id}>
                      <input
                        type="checkbox"
                        checked={compare.includes(row.id)}
                        onChange={() =>
                          setCompare((prev) =>
                            prev.includes(row.id)
                              ? prev.filter((id) => id !== row.id)
                              : [...prev, row.id].slice(0, 4),
                          )
                        }
                        aria-label={`Compare ${row.code}`}
                      />
                      <span className="mono">{row.code}</span> {row.name}
                    </label>
                  ))}
                </div>
                <div className="ip-compare-head">
                  <span>
                    {compare.length
                      ? `${compare.length} selected (max 4)`
                      : "No selection — showing the first six pools"}
                  </span>
                  <button
                    type="button"
                    className="ip-link"
                    onClick={() => setCompare([])}
                    disabled={!compare.length}
                  >
                    Clear selection
                  </button>
                </div>
                <CompareTable
                  rows={compareRows}
                  onPick={(id) => {
                    const pool =
                      data.trading.find((p) => p.id === id) ??
                      data.open.find((p) => p.id === id) ??
                      data.upcoming.find((p) => p.id === id) ??
                      data.completed.find((p) => p.id === id);
                    if (!pool) return;
                    open(
                      pool.lifecycle === "trading"
                        ? "poolDetail"
                        : pool.lifecycle === "open"
                          ? "openDetail"
                          : pool.lifecycle === "upcoming"
                            ? "upcomingDetail"
                            : "completedDetail",
                      pool.id,
                    );
                  }}
                />
                <p className="ip-note">
                  Comparable figures use each pool&apos;s own basis: realized
                  ROI for trading and completed cycles, expected ROI for open
                  and upcoming windows. Cross-pool comparison is indicative
                  only.
                </p>
              </>
            ) : null}

            {modal.kind === "filters" ? (
              <>
                <div className="ip-form-grid">
                  <label className="ip-field">
                    Minimum return / %
                    <input
                      className="form-control"
                      aria-label="Minimum return"
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={minRoi}
                      onChange={(e) => setMinRoi(Number(e.target.value))}
                    />
                    <small>
                      Applies to realized or expected ROI depending on the pool
                    </small>
                  </label>
                  <label className="ip-field">
                    Maximum duration / days
                    <input
                      className="form-control"
                      aria-label="Maximum duration"
                      type="number"
                      min={0}
                      max={365}
                      value={maxDuration}
                      onChange={(e) => setMaxDuration(Number(e.target.value))}
                    />
                    <small>0 means no limit</small>
                  </label>
                </div>
                <label className="ip-check">
                  <input
                    type="checkbox"
                    aria-label="Only bookable pools"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                  />
                  Only show open pools with slots left in my limit
                </label>
                <div className="ip-filter-summary">
                  <span>
                    Trading <b className="mono">{tradingRows.length}</b>
                  </span>
                  <span>
                    Open <b className="mono">{openRows.length}</b>
                  </span>
                  <span>
                    Upcoming <b className="mono">{upcomingRows.length}</b>
                  </span>
                  <span>
                    Completed <b className="mono">{completedRows.length}</b>
                  </span>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => {
                      setMinRoi(0);
                      setMaxDuration(0);
                      setOnlyAvailable(false);
                      setRisk("all");
                      setQuery("");
                      pushToast({ tone: "info", title: "Filters cleared" });
                    }}
                  >
                    Reset all filters
                  </button>
                  <button
                    type="button"
                    className="ip-btn ip-btn--primary"
                    onClick={close}
                  >
                    Apply
                  </button>
                </div>
                <p className="ip-note">
                  Filters are applied instantly in the browser. Nothing is sent
                  to the server, so a production build should push the same
                  predicate into the pool query.
                </p>
              </>
            ) : null}

            {modal.kind === "fees" ? (
              <>
                <div className="ip-section-code">POOL ECONOMICS</div>
                <div className="ip-review">
                  <div>
                    <span>Investor profit share</span>
                    <b>Per pool (10%–30% in the current book)</b>
                  </div>
                  <div>
                    <span>Platform share</span>
                    <b>Deducted from gross pool profit before distribution</b>
                  </div>
                  <div>
                    <span>Completed-cycle example</span>
                    <b className="mono">
                      {signedMoney(1476)} gross → {signedMoney(1180.8)} net at
                      20%
                    </b>
                  </div>
                  <div>
                    <span>Booking</span>
                    <b>No booking fee modeled</b>
                  </div>
                  <div>
                    <span>Bank payout</span>
                    <b className="mono">$1.50 per transfer</b>
                  </div>
                  <div>
                    <span>USDT payout</span>
                    <b>Network fee at the provider</b>
                  </div>
                  <div>
                    <span>Deposit</span>
                    <b>No platform deposit fee modeled</b>
                  </div>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(
                          {
                            asOf: data.asOf,
                            investorProfitShare: "pool-specific",
                            platformShare: "deducted from gross pool profit",
                            bankPayoutFee: 1.5,
                            usdt: "provider network fee",
                          },
                          null,
                          2,
                        ),
                        "pool-fee-schedule.json",
                        "application/json",
                      )
                    }
                  >
                    <Icon name="download" size={13} /> Download fee schedule
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("riskProfile")}
                  >
                    Risk profile
                  </button>
                </div>
                <p className="ip-note">
                  Demonstration source fields. A production build must show the
                  contractual schedule and record accepted terms per investor.
                </p>
              </>
            ) : null}

            {modal.kind === "ledger" ? (
              <>
                <div className="ip-filter-row">
                  <label className="ip-check">
                    <input
                      type="checkbox"
                      aria-label="Only local workspace entries"
                      checked={ledgerOnlyLocal}
                      onChange={(e) => setLedgerOnlyLocal(e.target.checked)}
                    />
                    Only local workspace changes
                  </label>
                  <div className="ip-filter-stats">
                    <span>Entries</span>
                    <b className="mono">{ledger.length}</b>
                    <span>Local changes</span>
                    <b className="mono">{data.audit.length}</b>
                  </div>
                </div>
                <div className="ip-activity ip-activity--modal">
                  {ledger.map((row) => (
                    <div className="ip-activity-row" key={row.id}>
                      <span
                        className={`ip-activity-icon is-${row.scope === "Local workspace" ? "local" : "source"}`}
                      >
                        <Icon
                          name={
                            row.scope === "Local workspace"
                              ? "terminal"
                              : "file"
                          }
                          size={14}
                        />
                      </span>
                      <span className="ip-activity-main">
                        <span className="ip-activity-title">{row.title}</span>
                        <span className="ip-activity-detail">{row.detail}</span>
                      </span>
                      <span className="ip-activity-amount">
                        <small>{atDateTime(row.at)}</small>
                      </span>
                      <span
                        className={`ip-tag ${row.scope === "Local workspace" ? "is-interest" : ""}`}
                      >
                        {row.scope === "Local workspace" ? "LOCAL" : "SOURCE"}
                      </span>
                    </div>
                  ))}
                  {!ledger.length ? (
                    <div className="ip-empty">
                      No local changes yet. Bookings, reminders and exports
                      appear here with their timestamps.
                    </div>
                  ) : null}
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("statement")}
                  >
                    Export evidence
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("alertPrefs")}
                  >
                    Alert preferences
                  </button>
                </div>
                <p className="ip-note">
                  Source rows are read-only observations from the snapshot.
                  Local rows record what this session attempted and never imply
                  settlement.
                </p>
              </>
            ) : null}

            {modal.kind === "help" ? (
              <>
                <div className="ip-section-code">WHAT THIS PAGE DOES</div>
                <ul className="ip-list">
                  <li>
                    Reads one structured pool DTO and renders it with TanStack
                    Query, TanStack Table and TanStack Form. Session changes
                    reset on reload.
                  </li>
                  <li>
                    Separates the five pool states — trading, open, upcoming,
                    completed and roadmap — and derives fill, countdowns,
                    bookable slots and net payouts from source fields.
                  </li>
                  <li>
                    Writes only to the in-browser workspace: slot holds,
                    reminders, interest registrations, projections, support
                    drafts and export records.
                  </li>
                  <li>
                    Exports the register, completed history and roadmap to JSON,
                    CSV and PDF, and payout records to PDF.
                  </li>
                </ul>
                <div className="ip-section-code">WHAT REQUIRES A BACKEND</div>
                <ul className="ip-list">
                  <li>
                    Authenticated investor identity, KYC and account-scoped
                    authorisation.
                  </li>
                  <li>
                    Slot capacity and booking concurrency, payment capture,
                    reconciliation and refunds.
                  </li>
                  <li>
                    Provider trade feed, authoritative pool valuation, fee
                    computation and settlement ledger.
                  </li>
                  <li>
                    Reminder, interest and notification delivery with consent
                    and quiet hours.
                  </li>
                  <li>Immutable statements, receipts and audit retention.</li>
                </ul>
                <div className="ip-path-row">
                  <span>Read contract</span>
                  <code>GET /api/investor/pools?section=…</code>
                  <span>Query key</span>
                  <code>[&quot;investor&quot;,&quot;pools-overview&quot;]</code>
                </div>
                <div className="ip-actions ip-modal-actions">
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("statement")}
                  >
                    Export workspace
                  </button>
                  <button
                    type="button"
                    className="ip-btn"
                    onClick={() => open("support")}
                  >
                    Contact desk
                  </button>
                  <Link className="ip-btn" href="/investor">
                    Investor overview ↗
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
