"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  OperatorShell,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon, type IconName } from "@/components/icons";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import { useAnalytics } from "@/lib/analytics/use-analytics";
import { analyticsFilterSchema } from "@/lib/analytics/model";
import {
  analyticsColors,
  initialAnalyticsFilters,
  type AnalyticsBundle,
  type AnalyticsFilters,
  type AnalyticsGroup,
  type InvestorRanking,
} from "@/lib/analytics/types";
import {
  AnalyticsLineChart,
  ContributionBars,
  DistributionDonut,
} from "./charts";
const cash = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const pct = (n: number) => `${n.toFixed(2)}%`;
const pnl = (n: number) => (
  <span className={`mono ${n >= 0 ? "text-win" : "text-loss"}`}>
    {n > 0 ? "+" : ""}
    {cash(n)}
  </span>
);
const column = createDeskColumnHelper<InvestorRanking>();
type ModalKind =
  | "methodology"
  | "range"
  | "pool"
  | "impact"
  | "investor"
  | "market"
  | "strategy"
  | "revenue"
  | "settlement"
  | "drawdown"
  | "guardian"
  | "comparison"
  | "export"
  | "schedule"
  | "saved"
  | "annotation"
  | "scenario"
  | "quality"
  | "payload"
  | "day";
interface Overlay {
  kind: ModalKind;
  key?: string;
}
const titles: Record<ModalKind, string> = {
  methodology: "Metric methodology",
  range: "Custom analytics period",
  pool: "Package performance dossier",
  impact: "Package investor impact",
  investor: "Investor attribution report",
  market: "Market contribution detail",
  strategy: "Strategy contribution detail",
  revenue: "Revenue attribution ledger",
  settlement: "Prepare settlement request",
  drawdown: "Drawdown & recovery analysis",
  guardian: "Guardian event correlation",
  comparison: "Comparison studio",
  export: "Analytics report export",
  schedule: "Recurring report request",
  saved: "Saved analytics views",
  annotation: "Add review annotation",
  scenario: "Sensitivity scenario lab",
  quality: "Data integrity checks",
  payload: "Analytics API payload",
  day: "Daily observation detail",
};
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Metric({
  label,
  value,
  format,
  detail,
  icon,
  onClick,
}: {
  label: string;
  value: number | null;
  format: "money" | "percent" | "ratio" | "seconds";
  detail: string;
  icon: IconName;
  onClick: () => void;
}) {
  const n = useLiveCountUp(value ?? 0);
  return (
    <button className="an-metric" onClick={onClick}>
      <div>
        <span>{label}</span>
        <Icon name={icon} size={15} />
      </div>
      <strong
        className={`mono ${format === "money" ? ((value ?? 0) >= 0 ? "text-win" : "text-loss") : ""}`}
      >
        {value === null
          ? "N/A"
          : format === "money"
            ? cash(n)
            : format === "percent"
              ? pct(n)
              : format === "seconds"
                ? `${n.toFixed(1)}s`
                : n.toFixed(2)}
      </strong>
      <small>{detail} ↗</small>
    </button>
  );
}
function Breakdown({
  label,
  rows,
  onSelect,
}: {
  label: string;
  rows: AnalyticsGroup[];
  onSelect: (key: string) => void;
}) {
  return (
    <section className="an-panel">
      <div className="an-panel-head">
        <div>
          <h2>{label}</h2>
          <p>
            Net contribution · select a category to inspect execution
            statistics.
          </p>
        </div>
        <span className="an-tag mono">{rows.length} GROUPS</span>
      </div>
      <ContributionBars rows={rows} onSelect={onSelect} />
      <div className="table-responsive">
        <table className="table an-responsive-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Trades / wins</th>
              <th>Win rate</th>
              <th>Net P&L</th>
              <th>Avg. {label.startsWith("Market") ? "duration" : "stake"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td data-label="Category">
                  <button className="an-link" onClick={() => onSelect(r.key)}>
                    {r.key} ↗
                  </button>
                </td>
                <td data-label="Trades / wins" className="mono">
                  {r.trades} / {r.wins}
                </td>
                <td data-label="Win rate" className="mono">
                  {pct(r.winRate)}
                </td>
                <td data-label="Net P&L">{pnl(r.profit)}</td>
                <td data-label="Average" className="mono">
                  {label.startsWith("Market")
                    ? `${r.averageDuration.toFixed(1)}s`
                    : cash(r.averageStake)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="an-empty">No executions in this filtered period.</div>
      )}
    </section>
  );
}
function AnalyticsDesk({ initial }: { initial: AnalyticsBundle }) {
  const { pushToast, openOverlay } = useOperatorUI();
  const [filters, setFilters] = useState(initialAnalyticsFilters);
  const query = useAnalytics(filters, initial);
  const data = query.data ?? initial;
  const [modal, setModal] = useState<Overlay | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState("performance");
  const [drawdownPool, setDrawdownPool] = useState(initial.pools[0].code);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "earned", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [rankPage, setRankPage] = useState(1);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState("csv");
  const [rangeFrom, setRangeFrom] = useState(filters.from);
  const [rangeTo, setRangeTo] = useState(filters.to);
  const [compareCodes, setCompareCodes] = useState(
    initial.pools.map((p) => p.code),
  );
  const [compareMode, setCompareMode] = useState("normalized");
  const [draftCodes, setDraftCodes] = useState(compareCodes);
  const [draftMode, setDraftMode] = useState(compareMode);
  const [reportEmail, setReportEmail] = useState("");
  const [reportFrequency, setReportFrequency] = useState("weekly");
  const [viewName, setViewName] = useState("");
  const [savedViews, setSavedViews] = useState<
    { name: string; filters: AnalyticsFilters }[]
  >([]);
  const [note, setNote] = useState("");
  const [noteDay, setNoteDay] = useState(filters.to);
  const [notes, setNotes] = useState<
    { day: string; pool: string; note: string }[]
  >([]);
  const [haircut, setHaircut] = useState(10);
  const activePool =
    data.pools.find((p) => p.code === (modal?.key ?? drawdownPool)) ??
    data.pools[0];
  const riskPool =
    data.pools.find((p) => p.code === drawdownPool) ?? data.pools[0];
  const inspected = data.pools.find((p) => p.code === drawer);
  const investor =
    data.investors.find((i) => i.id === modal?.key) ?? data.investors[0];
  const rankColumns = useMemo(
    () =>
      column.columns([
        column.accessor("name", { header: "Investor" }),
        column.accessor("capital", { header: "Invested" }),
        column.accessor("earned", { header: "Investor P&L" }),
        column.accessor("roi", { header: "ROI" }),
        column.accessor("pools", { header: "Pools" }),
        column.accessor("lastActive", { header: "Last active" }),
      ]),
    [],
  );
  const ranking = useDeskTable({
    data: data.investors.filter((i) =>
      `${i.id} ${i.name}`.toLowerCase().includes(search.toLowerCase()),
    ),
    columns: rankColumns,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(typeof updater === "function" ? updater(sorting) : updater);
      setRankPage(1);
    },
  });
  const rankRows = ranking.getRowModel().rows;
  const rankPages = Math.max(1, Math.ceil(rankRows.length / 5));
  const safeRankPage = Math.min(rankPage, rankPages);
  const revenue = {
    operator: data.pools.reduce((n, p) => n + p.operator, 0),
    investor: data.pools.reduce((n, p) => n + p.investor, 0),
    paid: data.pools.reduce((n, p) => n + p.distributed, 0),
    pending: data.pools.reduce((n, p) => n + p.pending, 0),
  };
  const currentComparison = data.comparison.filter((row) =>
    data.pools.some((p) => row.values[p.code] !== null),
  );
  const comparisonPools = data.pools.some((p) => compareCodes.includes(p.code))
    ? data.pools.filter((p) => compareCodes.includes(p.code))
    : data.pools;
  const group =
    modal?.kind === "market"
      ? data.markets.find((r) => r.key === modal.key)
      : data.strategies.find((r) => r.key === modal?.key);
  const observation =
    data.equity.find((p) => p.day === modal?.key) ?? data.equity.at(-1);
  const local = Boolean(modal || drawer);
  useEffect(() => {
    if (!local) return;
    const prior = document.activeElement as HTMLElement | null;
    const element = document.querySelector<HTMLElement>(
      ".page-dashboard-analytics .an-local-layer",
    );
    if (!element) return;
    const all = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ),
      );
    all()[0]?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setDrawer(null);
      }
      if (e.key === "Tab") {
        const list = all();
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
      document.body.style.overflow = old;
      prior?.focus();
    };
  }, [local, modal?.kind, drawer]);
  function toast(title: string, bad = false) {
    pushToast({ tone: bad ? "error" : "success", title });
  }
  function open(kind: ModalKind, key?: string) {
    setDrawer(null);
    setModal({ kind, key });
    setStep(0);
    setError("");
    setConfirmed(false);
    setRangeFrom(filters.from);
    setRangeTo(filters.to);
    setDraftCodes(compareCodes);
    setDraftMode(compareMode);
    setNoteDay(filters.to);
    setNote("");
  }
  function apply(next: AnalyticsFilters) {
    const parsed = analyticsFilterSchema.safeParse(next);
    if (!parsed.success || next.to > data.asOf.slice(0, 10)) {
      setError(
        parsed.success
          ? "The range cannot extend beyond the demo snapshot date."
          : parsed.error.issues[0].message,
      );
      return;
    }
    setFilters(next);
    setRankPage(1);
    setModal(null);
    setError("");
  }
  function preset(days: number) {
    const to = data.asOf.slice(0, 10);
    const from = new Date(Date.parse(to + "T00:00:00Z") - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    apply({ ...filters, from, to });
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied to clipboard");
    } catch {
      toast("Clipboard unavailable. Use Download JSON instead.", true);
    }
  }
  async function exportReport() {
    setBusy(true);
    try {
      if (format === "json")
        download(
          JSON.stringify(data, null, 2),
          "application/json",
          "trademo-analytics.json",
        );
      else if (format === "csv") {
        const rows = [
          [
            "Package",
            "Capital USD",
            "Trades",
            "Win rate %",
            "Net P&L USD",
            "Operator USD",
            "Investor USD",
            "Modeled paid USD",
            "Pending USD",
          ],
          ...data.pools.map((p) => [
            p.code,
            p.capital,
            p.trades,
            p.trades ? (p.wins / p.trades) * 100 : 0,
            p.profit,
            p.operator,
            p.investor,
            p.distributed,
            p.pending,
          ]),
        ];
        download(
          rows
            .map((r) =>
              r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
            )
            .join("\r\n"),
          "text/csv;charset=utf-8",
          "trademo-analytics.csv",
        );
      } else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF();
        pdf.setFontSize(19);
        pdf.text("tradeMO / Performance analytics", 16, 22);
        pdf.setFontSize(10);
        const lines = [
          "DEMO ANALYTICS - NOT AN AUDITED STATEMENT",
          `Period: ${data.filters.from} to ${data.filters.to} | ${data.filters.pool}`,
          `Realized P&L: ${cash(data.summary.profit)}`,
          `ROI: ${pct(data.summary.roi)} | capital: ${cash(data.summary.capital)}`,
          `Trades: ${data.summary.trades} | profit factor: ${data.summary.profitFactor?.toFixed(2) ?? "N/A"}`,
          `Sharpe (daily, not annualized): ${data.summary.sharpe?.toFixed(2) ?? "N/A"}`,
          `Daily-close drawdown: ${pct(data.summary.maxDrawdown)}`,
          "",
          ...data.pools.flatMap((p) => [
            `${p.code} / ${p.name}`,
            `Capital ${cash(p.capital)} | P&L ${cash(p.profit)} | ROI ${pct(p.roi)}`,
            `Investor allocation ${cash(p.investor)} | pending ${cash(p.pending)}`,
            "",
          ]),
          "Paid/pending portions are modeled, not confirmed transfers.",
          "Positive profit split: investor 80% / operator 20%.",
          "No HWM, management fees or tax computation included.",
        ];
        pdf.text(lines, 16, 38, { maxWidth: 180, lineHeightFactor: 1.8 });
        pdf.save("trademo-analytics.pdf");
      }
      toast("Analytics report downloaded");
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  function distributionTable() {
    return (
      <div className="table-responsive">
        <table className="table an-responsive-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Net P&L</th>
              <th>Operator</th>
              <th>Investor</th>
              <th>Modeled paid</th>
              <th>Pending</th>
            </tr>
          </thead>
          <tbody>
            {data.pools.map((p) => (
              <tr key={p.code}>
                <td data-label="Package">
                  <button
                    className="an-link mono"
                    onClick={() => open("pool", p.code)}
                  >
                    {p.code} ↗
                  </button>
                </td>
                <td data-label="Net P&L">{pnl(p.profit)}</td>
                <td data-label="Operator" className="mono">
                  {cash(p.operator)}
                </td>
                <td data-label="Investor" className="mono">
                  {cash(p.investor)}
                </td>
                <td data-label="Modeled paid" className="mono">
                  {cash(p.distributed)}
                </td>
                <td data-label="Pending" className="mono">
                  {cash(p.pending)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const quality = [
    {
      label: "Pool P&L → overview",
      a: data.pools.reduce((n, p) => n + p.profit, 0),
      b: data.summary.profit,
    },
    {
      label: "Market attribution → overview",
      a: data.markets.reduce((n, g) => n + g.profit, 0),
      b: data.summary.profit,
    },
    {
      label: "Strategy attribution → overview",
      a: data.strategies.reduce((n, g) => n + g.profit, 0),
      b: data.summary.profit,
    },
    {
      label: "Investor cents → investor waterfall",
      a: data.investors.reduce((n, i) => n + i.earned, 0),
      b: revenue.investor,
    },
    {
      label: "Revenue split → net P&L",
      a: revenue.operator + revenue.investor,
      b: data.summary.profit,
    },
  ];
  const actions: { kind: ModalKind; label: string; icon: IconName }[] = [
    { kind: "methodology", label: "Metric definitions", icon: "file" },
    { kind: "comparison", label: "Comparison studio", icon: "layers" },
    { kind: "scenario", label: "Sensitivity lab", icon: "sliders" },
    { kind: "guardian", label: "Guardian events", icon: "shield" },
    { kind: "annotation", label: "Review annotation", icon: "script" },
    { kind: "schedule", label: "Report request", icon: "calendar" },
    { kind: "quality", label: "Reconcile metrics", icon: "check" },
    { kind: "payload", label: "API payload", icon: "code" },
  ];
  return (
    <div className="an-canvas">
      <header className="an-header">
        <div>
          <div className="an-eyebrow">
            <span className="an-tag">D–7</span> OPERATOR CONSOLE · PERFORMANCE &
            ATTRIBUTION
          </div>
          <h1>Performance Analytics</h1>
          <p>
            Understand the return. Trace the risk. See how every pool
            contributes to investor outcomes.
          </p>
        </div>
        <div className="an-actions">
          <button className="an-btn" onClick={() => open("saved")}>
            <Icon name="layers" size={14} /> Saved views
          </button>
          <button className="an-btn" onClick={() => open("schedule")}>
            <Icon name="clock" size={14} /> Report request
          </button>
          <button
            className="an-btn an-primary"
            disabled={query.isFetching || query.isError}
            onClick={() => open("export")}
          >
            <Icon name="download" size={14} /> Export report
          </button>
        </div>
      </header>
      <div className="an-demo">
        <span className="live-dot" />
        <b>DEMO ANALYTICS</b>
        <span>
          Reconciled seeded executions & holdings · no live broker connection
        </span>
        <span className="mono ms-auto">
          AS OF {data.asOf.replace("T", " ").slice(0, 16)} UTC
        </span>
      </div>
      <section className="an-filter-strip">
        <div className="an-periods">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              className={
                Math.round(
                  (Date.parse(filters.to) - Date.parse(filters.from)) /
                    86400000,
                ) +
                  1 ===
                d
                  ? "active"
                  : ""
              }
              onClick={() => preset(d)}
            >
              {d}D
            </button>
          ))}
          <button onClick={() => open("range")}>
            <Icon name="calendar" size={12} /> Custom
          </button>
        </div>
        <span className="mono">
          {filters.from} → {filters.to}
        </span>
        <select
          aria-label="Analytics package filter"
          className="an-select"
          value={filters.pool}
          onChange={(e) => apply({ ...filters, pool: e.target.value })}
        >
          <option value="all">All packages</option>
          {initial.pools.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
        <button className="an-link" onClick={() => open("methodology")}>
          USD · daily observations · methodology ↗
        </button>
        {query.isFetching && <span className="an-tag">Updating…</span>}
        {query.isPlaceholderData && (
          <span className="an-tag">
            Showing last acknowledged snapshot: {data.filters.from} →{" "}
            {data.filters.to} · {data.filters.pool}
          </span>
        )}
      </section>
      {query.isError && (
        <div className="an-error" role="alert">
          {query.error.message}
          <button className="an-btn" onClick={() => query.refetch()}>
            Retry analytics
          </button>
        </div>
      )}
      <section className="an-metrics" aria-label="Analytics overview">
        <Metric
          label="Total realized P&L"
          value={data.summary.profit}
          format="money"
          detail="Gross, before performance split"
          icon="wallet"
          onClick={() => open("revenue")}
        />
        <Metric
          label="Overall ROI"
          value={data.summary.roi}
          format="percent"
          detail={`On ${cash(data.summary.capital)} funded`}
          icon="trendUp"
          onClick={() => open("methodology")}
        />
        <Metric
          label="Profit factor"
          value={data.summary.profitFactor}
          format="ratio"
          detail={
            data.summary.grossLosses
              ? "Gross wins ÷ absolute losses"
              : "No losses · ratio undefined"
          }
          icon="gauge"
          onClick={() => open("methodology")}
        />
        <Metric
          label="Sharpe ratio"
          value={data.summary.sharpe}
          format="ratio"
          detail="Daily sample · not annualized"
          icon="chart"
          onClick={() => open("methodology")}
        />
        <Metric
          label="Max drawdown"
          value={data.summary.maxDrawdown}
          format="percent"
          detail="Portfolio · daily-close equity"
          icon="shield"
          onClick={() => open("drawdown", riskPool.code)}
        />
        <Metric
          label="Avg. trade duration"
          value={data.summary.averageDuration}
          format="seconds"
          detail={`${data.summary.trades.toLocaleString()} settled contracts`}
          icon="clock"
          onClick={() => open("quality")}
        />
      </section>
      {!data.summary.trades && (
        <div className="an-panel an-empty">
          <h3>No executions in this period</h3>
          <p>
            The selected capital remains visible; profit/risk observations are
            empty. Try the full demo period.
          </p>
          <button
            className="an-btn"
            onClick={() => apply(initialAnalyticsFilters)}
          >
            Reset analytics filters
          </button>
        </div>
      )}
      <section className="an-panel">
        <div className="an-panel-head">
          <div>
            <h2>Portfolio equity</h2>
            <p>
              Funded starting capital + selected-period realized profit ·
              zero-execution calendar days retained.
            </p>
          </div>
          <div className="an-actions">
            <span className="an-tag mono">
              {data.summary.trades} TRADES · {data.summary.wins} WINS
            </span>
            <button className="an-btn" onClick={() => open("annotation")}>
              + Annotation
            </button>
          </div>
        </div>
        <AnalyticsLineChart
          labels={data.equity.map((p) => p.day)}
          series={[
            {
              name: "Portfolio equity",
              color: analyticsColors[0],
              values: data.equity.map((p) => p.equity),
            },
          ]}
          label="Portfolio equity chart"
          includeZero={false}
          format={(n) => `$${(n / 1000).toFixed(1)}k`}
          onPoint={(i) => open("day", data.equity[i].day)}
        />
        <div className="an-panel-foot">
          <span>
            Window-reset equity basis · no deposits/withdrawals modeled in this
            range
          </span>
          <button className="an-link" onClick={() => open("quality")}>
            Check attribution integrity ↗
          </button>
        </div>
      </section>
      <section>
        <div className="an-section-head">
          <div>
            <h2>Package performance</h2>
            <p>
              Different trading periods. One comparable, capital-aware view.
            </p>
          </div>
          <button className="an-link" onClick={() => open("comparison")}>
            Open comparison studio ↗
          </button>
        </div>
        <div className="an-pool-grid">
          {data.pools.map((p, i) => {
            const elapsed = Math.max(
              0,
              Math.min(
                100,
                ((Date.parse(data.asOf) - Date.parse(p.startsAt)) /
                  (Date.parse(p.endsAt) - Date.parse(p.startsAt))) *
                  100,
              ),
            );
            const remaining = Math.max(
              0,
              Math.ceil(
                (Date.parse(p.endsAt) - Date.parse(data.asOf)) / 86400000,
              ),
            );
            return (
              <article className="an-panel an-pool-card" key={p.code}>
                <div className="an-pool-heading">
                  <span className="an-tag mono">{p.code}</span>
                  <span className="an-status">
                    ● {remaining ? "TRADING" : "CYCLE ENDED"}
                  </span>
                  <button
                    className="an-icon"
                    aria-label={`Inspect ${p.code}`}
                    onClick={() => {
                      setModal(null);
                      setDrawer(p.code);
                      setDrawerTab("performance");
                    }}
                  >
                    <Icon name="panelRight" size={14} />
                  </button>
                </div>
                <h3>{p.name}</h3>
                <p className="an-muted">
                  {p.days}-day mandate · {remaining}d remaining · snapshot clock
                </p>
                <div className="an-pool-profit">
                  <strong
                    className={`mono ${p.profit >= 0 ? "text-win" : "text-loss"}`}
                  >
                    {p.profit > 0 ? "+" : ""}
                    {cash(p.profit)}
                  </strong>
                  <span className="mono">{pct(p.roi)} ROI</span>
                </div>
                <div className="an-pool-figures">
                  <div>
                    <small>Funded capital</small>
                    <b className="mono">{cash(p.capital)}</b>
                  </div>
                  <div>
                    <small>Trades</small>
                    <b className="mono">{p.trades}</b>
                  </div>
                  <div>
                    <small>Win rate</small>
                    <b className="mono">
                      {p.trades ? pct((p.wins / p.trades) * 100) : "N/A"}
                    </b>
                  </div>
                </div>
                <div className="an-pool-chips">
                  {p.markets.map((m) => (
                    <button key={m} onClick={() => open("market", m)}>
                      {m}
                    </button>
                  ))}
                </div>
                <div className="an-pool-strategies">
                  {p.strategies.join(" · ")}
                </div>
                <div className="an-cycle-label">
                  <span>Cycle elapsed</span>
                  <b className="mono">{elapsed.toFixed(0)}%</b>
                </div>
                <div className="an-progress">
                  <span
                    style={{
                      width: `${elapsed}%`,
                      background: analyticsColors[i % 3],
                    }}
                  />
                </div>
                <div className="an-investor-impact">
                  <button onClick={() => open("impact", p.code)}>
                    {p.investors} investors ↗
                  </button>
                  <span className="mono">
                    Avg. capital{" "}
                    {cash(p.investors ? p.capital / p.investors : 0)}
                  </span>
                  <span>
                    Avg. investor share{" "}
                    {cash(p.investors ? p.investor / p.investors : 0)}
                  </span>
                  <span>Modeled distributed {cash(p.distributed)}</span>
                </div>
                <div className="an-pool-actions">
                  <button onClick={() => open("pool", p.code)}>Details</button>
                  <button onClick={() => open("drawdown", p.code)}>
                    Drawdown
                  </button>
                  <button onClick={() => open("impact", p.code)}>
                    Investor impact
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="an-panel">
        <div className="an-panel-head">
          <div>
            <h2>Investor performance ranking</h2>
            <p>
              Pro-rata investor share after the 20% positive-profit operator
              allocation. Period-specific, not lifetime earnings.
            </p>
          </div>
          <div className="an-actions">
            <div className="an-search">
              <Icon name="search" size={13} />
              <input
                aria-label="Search investor ranking"
                placeholder="Investor name or ID…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setRankPage(1);
                }}
              />
            </div>
            <select
              className="an-select"
              aria-label="Sort investor ranking"
              value={sorting[0]?.id ?? "earned"}
              onChange={(e) => {
                setSorting([{ id: e.target.value, desc: true }]);
                setRankPage(1);
              }}
            >
              <option value="earned">Highest earned</option>
              <option value="capital">Most invested</option>
              <option value="roi">Highest ROI</option>
              <option value="name">Investor name</option>
              <option value="pools">Most pools</option>
              <option value="lastActive">Last active</option>
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table an-responsive-table">
            <thead>
              <tr>
                <th>Rank</th>
                {ranking.getHeaderGroups()[0]?.headers.map((h) => (
                  <th key={h.id}>
                    <button onClick={h.column.getToggleSortingHandler()}>
                      {String(h.column.columnDef.header)}{" "}
                      {h.column.getIsSorted() === "desc"
                        ? "↓"
                        : h.column.getIsSorted() === "asc"
                          ? "↑"
                          : "↕"}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rankRows
                .slice((safeRankPage - 1) * 5, safeRankPage * 5)
                .map((r, i) => {
                  const p = r.original;
                  return (
                    <tr key={p.id}>
                      <td data-label="Rank" className="mono">
                        {(safeRankPage - 1) * 5 + i + 1}
                      </td>
                      <td data-label="Investor">
                        <button
                          className="an-link"
                          onClick={() => open("investor", p.id)}
                        >
                          {p.name} ↗
                        </button>
                        <small className="an-cell-sub mono">{p.id}</small>
                      </td>
                      <td data-label="Invested" className="mono">
                        {cash(p.capital)}
                      </td>
                      <td data-label="Investor P&L">{pnl(p.earned)}</td>
                      <td data-label="ROI" className="mono">
                        {pct(p.roi)}
                      </td>
                      <td data-label="Pools" className="mono">
                        {p.pools}
                      </td>
                      <td data-label="Last active" className="mono">
                        {p.lastActive.replace("T", " ").slice(0, 16)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!rankRows.length && (
          <div className="an-empty">
            No matching investor.{" "}
            <button className="an-link" onClick={() => setSearch("")}>
              Clear search
            </button>
          </div>
        )}
        <div className="an-panel-foot">
          <span>
            {rankRows.length} funded investors · latest activity is UTC
          </span>
          <div className="an-pagination">
            <button
              aria-label="Previous ranking page"
              disabled={safeRankPage === 1}
              onClick={() => setRankPage(safeRankPage - 1)}
            >
              ←
            </button>
            <span>
              {safeRankPage} / {rankPages}
            </span>
            <button
              aria-label="Next ranking page"
              disabled={safeRankPage === rankPages}
              onClick={() => setRankPage(safeRankPage + 1)}
            >
              →
            </button>
          </div>
        </div>
      </section>
      <div className="an-two-col">
        <Breakdown
          label="Market attribution"
          rows={data.markets}
          onSelect={(key) => open("market", key)}
        />
        <Breakdown
          label="Strategy attribution"
          rows={data.strategies}
          onSelect={(key) => open("strategy", key)}
        />
      </div>
      <section className="an-panel">
        <div className="an-panel-head">
          <div>
            <h2>Revenue & distribution</h2>
            <p>
              Positive pool profit: 80% investors / 20% operator. Losses stay
              with investor P&L; no fee on loss.
            </p>
          </div>
          <button
            className="an-btn"
            disabled={query.isFetching || query.isError}
            onClick={() => open("settlement")}
          >
            Prepare settlement request ↗
          </button>
        </div>
        <div className="an-revenue-layout">
          <DistributionDonut
            paid={revenue.paid}
            pending={revenue.pending}
            operator={revenue.operator}
          />
          <div className="an-revenue-totals">
            {[
              ["Total pool P&L", data.summary.profit],
              ["Investor net attribution", revenue.investor],
              ["Modeled paid portion", revenue.paid],
              ["Pending positive investor share", revenue.pending],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong className="mono">{cash(Number(value))}</strong>
              </div>
            ))}
          </div>
        </div>
        {distributionTable()}
        <div className="an-panel-foot">
          <span>
            Paid/pending is an illustrative allocation model, not a confirmed
            payout ledger.
          </span>
          <button className="an-link" onClick={() => open("revenue")}>
            Inspect waterfall basis ↗
          </button>
        </div>
      </section>
      <section className="an-panel">
        <div className="an-panel-head">
          <div>
            <h2>Drawdown & recovery</h2>
            <p>
              Daily-close equity below its running peak. Event markers show
              temporal overlap, not cause.
            </p>
          </div>
          <div className="an-actions">
            <select
              className="an-select"
              aria-label="Drawdown package"
              value={riskPool.code}
              onChange={(e) => setDrawdownPool(e.target.value)}
            >
              {data.pools.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
            <button
              className="an-btn"
              onClick={() => open("guardian", riskPool.code)}
            >
              Guardian events
            </button>
          </div>
        </div>
        <AnalyticsLineChart
          labels={riskPool.points.map((p) => p.day)}
          series={[
            {
              name: `${riskPool.code} drawdown`,
              color: analyticsColors[0],
              values: riskPool.points.map((p) => p.drawdown),
            },
          ]}
          label="Drawdown chart"
          format={pct}
          markers={[
            ...data.guardian
              .filter((g) => g.pool === riskPool.code)
              .map((g) => ({
                index: riskPool.points.findIndex((p) => p.day === g.day),
                text: g.trigger,
              })),
            ...notes
              .filter((n) => n.pool === riskPool.code || n.pool === "all")
              .map((n) => ({
                index: riskPool.points.findIndex((p) => p.day === n.day),
                text: n.note,
              })),
          ]}
          onPoint={(i) => open("day", riskPool.points[i].day)}
        />
        <div className="an-risk-metrics">
          <div>
            <span>Maximum drawdown</span>
            <b className="mono">−{pct(riskPool.maxDrawdown)}</b>
          </div>
          <div>
            <span>Trough-to-recovery</span>
            <b className="mono">
              {riskPool.recoveryDays === null
                ? "Not recovered"
                : `${riskPool.recoveryDays} daily observations`}
            </b>
          </div>
          <div>
            <span>Underwater days</span>
            <b className="mono">{riskPool.underwaterDays}</b>
          </div>
          <div>
            <span>Drawdown / peak gain</span>
            <b className="mono">
              {riskPool.drawdownToProfit?.toFixed(2) ?? "N/A"}
            </b>
          </div>
        </div>
        <div className="an-panel-foot">
          <span>
            Intraday/tick drawdown may be larger than daily-close drawdown.
          </span>
          <button
            className="an-link"
            onClick={() => open("drawdown", riskPool.code)}
          >
            Inspect risk observations ↗
          </button>
        </div>
      </section>
      <section className="an-panel">
        <div className="an-panel-head">
          <div>
            <h2>Trading-period comparison</h2>
            <p>
              Aligned by elapsed mandate day · normalized to each pool’s funded
              capital by default.
            </p>
          </div>
          <div className="an-actions">
            <select
              className="an-select"
              aria-label="Comparison units"
              value={compareMode}
              onChange={(e) => setCompareMode(e.target.value)}
            >
              <option value="normalized">Daily return / % capital</option>
              <option value="usd">Daily P&L / USD</option>
            </select>
            <button className="an-btn" onClick={() => open("comparison")}>
              Comparison studio ↗
            </button>
          </div>
        </div>
        <AnalyticsLineChart
          labels={currentComparison.map((r) => `Day ${r.day}`)}
          series={comparisonPools.map((p, i) => ({
            name: `${p.code} · ${p.days}d`,
            color: analyticsColors[i % 3],
            values: currentComparison.map((r) =>
              r.values[p.code] === null
                ? null
                : compareMode === "normalized"
                  ? r.values[p.code]
                  : ((r.values[p.code] ?? 0) / 100) * p.capital,
            ),
          }))}
          label="Normalized period comparison"
          format={
            compareMode === "normalized" ? pct : (n) => `$${n.toFixed(0)}`
          }
        />
        <div className="an-panel-foot">
          <span>
            Missing/out-of-window and future mandate days are gaps, not zero
            returns.
          </span>
          <button className="an-link" onClick={() => open("comparison")}>
            Inspect comparison table ↗
          </button>
        </div>
      </section>
      <section>
        <div className="an-section-head">
          <h2>Analytics workbench</h2>
          <span className="an-muted">
            Focused tools, explicit assumptions, exportable results
          </span>
        </div>
        <div className="an-workflows">
          {actions.map((a) => (
            <button key={a.kind} onClick={() => open(a.kind)}>
              <Icon name={a.icon} size={17} />
              {a.label}
              <Icon name="arrowRight" size={13} />
            </button>
          ))}
        </div>
      </section>
      <footer className="an-footer">
        <span className="live-dot" /> FRONTEND DEMO{" "}
        <span>
          Historical examples, not financial advice. No real settlement,
          reporting job or broker connection is created.
        </span>
        <Link href="/dashboard/trades">Execution ledger ↗</Link>
        <button
          className="an-link"
          onClick={() => openOverlay({ type: "risk-guardrails" })}
        >
          Desk guardrails ↗
        </button>
      </footer>
      {modal && (
        <div className="an-local-layer">
          <DeskModalShell
            code={`AN-${modal.kind.toUpperCase()}`}
            eyebrow={`${data.filters.from} → ${data.filters.to} · ${data.filters.pool}`}
            title={titles[modal.kind]}
            subtitle="Demo analytics · derived observations, explicit assumptions"
            size={
              [
                "payload",
                "pool",
                "drawdown",
                "comparison",
                "revenue",
                "quality",
                "impact",
              ].includes(modal.kind)
                ? "xl"
                : "lg"
            }
            onClose={() => {
              if (!busy) setModal(null);
            }}
            steps={
              ["export", "settlement", "comparison", "schedule"].includes(
                modal.kind,
              )
                ? modal.kind === "export"
                  ? ["Format", "Review scope", "Download"]
                  : modal.kind === "settlement"
                    ? ["Review waterfall", "Prepare request", "Confirm"]
                    : modal.kind === "comparison"
                      ? ["Select pools", "Set units", "Review"]
                      : ["Delivery request", "Frequency", "Review"]
                : undefined
            }
            currentStep={step}
            footer={
              modal.kind === "range" ? (
                <>
                  <button className="an-btn" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button
                    className="an-btn an-primary"
                    onClick={() =>
                      apply({ ...filters, from: rangeFrom, to: rangeTo })
                    }
                  >
                    Apply period
                  </button>
                </>
              ) : modal.kind === "export" ? (
                <>
                  <button
                    className="an-btn"
                    disabled={busy}
                    onClick={() => (step ? setStep(step - 1) : setModal(null))}
                  >
                    {step ? "Back" : "Cancel"}
                  </button>
                  <button
                    className="an-btn an-primary"
                    disabled={
                      busy ||
                      query.isFetching ||
                      query.isError ||
                      (step === 2 && !confirmed)
                    }
                    onClick={() =>
                      step < 2 ? setStep(step + 1) : exportReport()
                    }
                  >
                    {busy
                      ? "Preparing…"
                      : step < 2
                        ? "Continue →"
                        : "Download report"}
                  </button>
                </>
              ) : modal.kind === "comparison" ? (
                <>
                  <button
                    className="an-btn"
                    onClick={() => (step ? setStep(step - 1) : setModal(null))}
                  >
                    {step ? "Back" : "Cancel"}
                  </button>
                  <button
                    className="an-btn an-primary"
                    disabled={
                      !data.pools.some((p) => draftCodes.includes(p.code))
                    }
                    onClick={() => {
                      if (step < 2) setStep(step + 1);
                      else {
                        setCompareCodes(draftCodes);
                        setCompareMode(draftMode);
                        setModal(null);
                        toast("Comparison updated");
                      }
                    }}
                  >
                    {step < 2 ? "Continue →" : "Apply comparison"}
                  </button>
                </>
              ) : modal.kind === "settlement" ? (
                <>
                  <button
                    className="an-btn"
                    onClick={() => (step ? setStep(step - 1) : setModal(null))}
                  >
                    {step ? "Back" : "Cancel"}
                  </button>
                  <button
                    className="an-btn an-primary"
                    disabled={
                      !revenue.pending ||
                      (step === 2 && !confirmed) ||
                      query.isFetching ||
                      query.isError
                    }
                    onClick={() => {
                      if (step < 2) setStep(step + 1);
                      else {
                        download(
                          JSON.stringify(
                            {
                              type: "settlement_review_request",
                              mode: "demo",
                              period: data.filters,
                              basis: "modeled_positive_profit_split",
                              pools: data.pools
                                .filter((p) => p.pending > 0)
                                .map((p) => ({
                                  packageCode: p.code,
                                  pendingInvestorAmount: p.pending,
                                  operatorAmount: p.operator,
                                })),
                              requiresBackendReconciliation: true,
                            },
                            null,
                            2,
                          ),
                          "application/json",
                          "analytics-settlement-request.json",
                        );
                        toast(
                          "Settlement review request downloaded; no transfer was made",
                        );
                        setModal(null);
                      }
                    }}
                  >
                    {step < 2 ? "Continue →" : "Download review request"}
                  </button>
                </>
              ) : modal.kind === "schedule" ? (
                <>
                  <button
                    className="an-btn"
                    onClick={() => (step ? setStep(step - 1) : setModal(null))}
                  >
                    {step ? "Back" : "Cancel"}
                  </button>
                  <button
                    className="an-btn an-primary"
                    disabled={
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportEmail) ||
                      (step === 2 && !confirmed)
                    }
                    onClick={() => {
                      if (step < 2) setStep(step + 1);
                      else {
                        download(
                          JSON.stringify(
                            {
                              type: "recurring_analytics_report_request",
                              email: reportEmail,
                              frequency: reportFrequency,
                              cronUTC:
                                reportFrequency === "daily"
                                  ? "0 9 * * *"
                                  : reportFrequency === "weekly"
                                    ? "0 9 * * 1"
                                    : "0 9 1 * *",
                              timezone: "UTC",
                              filters,
                              mode: "demo",
                              deliveryConfigured: false,
                            },
                            null,
                            2,
                          ),
                          "application/json",
                          "analytics-report-request.json",
                        );
                        toast(
                          "Report request downloaded; no job was scheduled",
                        );
                        setModal(null);
                      }
                    }}
                  >
                    {step < 2 ? "Continue →" : "Download scheduling request"}
                  </button>
                </>
              ) : modal.kind === "annotation" ? (
                <>
                  <button className="an-btn" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button
                    className="an-btn an-primary"
                    disabled={
                      note.trim().length < 10 ||
                      !noteDay ||
                      noteDay < filters.from ||
                      noteDay > filters.to
                    }
                    onClick={() => {
                      setNotes([
                        ...notes,
                        { day: noteDay, pool: filters.pool, note: note.trim() },
                      ]);
                      toast("Session annotation added to the drawdown chart");
                      setModal(null);
                    }}
                  >
                    Save session annotation
                  </button>
                </>
              ) : undefined
            }
          >
            {error && (
              <div className="an-error" role="alert">
                {error}
              </div>
            )}
            {modal.kind === "range" && (
              <>
                <div className="an-form-grid">
                  <label className="an-field">
                    From / UTC
                    <input
                      className="form-control"
                      type="date"
                      value={rangeFrom}
                      max={data.asOf.slice(0, 10)}
                      onChange={(e) => setRangeFrom(e.target.value)}
                    />
                  </label>
                  <label className="an-field">
                    To / UTC
                    <input
                      className="form-control"
                      type="date"
                      value={rangeTo}
                      max={data.asOf.slice(0, 10)}
                      onChange={(e) => setRangeTo(e.target.value)}
                    />
                  </label>
                </div>
                <p className="an-muted mt-3">
                  Maximum 366 calendar days. Dates after the snapshot are not
                  accepted. The fixture contains current mandate executions
                  through October 21, 2026.
                </p>
              </>
            )}
            {modal.kind === "methodology" && (
              <div className="an-methodology">
                {[
                  [
                    "Realized P&L",
                    "Sum of settled contract profits in the selected period and package. Gross of the investor/operator performance split.",
                  ],
                  [
                    "ROI denominator",
                    `Selected P&L / funded pool capital (${cash(data.summary.capital)}). Constant-capital assumption; no cash-flow timing adjustment or annualization.`,
                  ],
                  [
                    "Profit factor",
                    `Gross winning profit (${cash(data.summary.grossWins)}) / absolute gross losses (${cash(data.summary.grossLosses)}). Undefined when no losses exist.`,
                  ],
                  [
                    "Sharpe ratio",
                    "Mean daily return / sample standard deviation of daily returns. Risk-free rate = 0. Calendar days with no executions are zero observations. Not annualized; N/A for fewer than two observations or zero variance.",
                  ],
                  [
                    "Drawdown",
                    "Daily-close equity vs running daily-close peak, reset at the selected window start. No intraday/tick mark-to-market or cash flows; real drawdown can be larger.",
                  ],
                  [
                    "Investor returns",
                    "Each pool's positive profit is split 80/20. Negative profit generates no operator share. Investor amounts are assigned by funded capital, with exact cent residual allocation.",
                  ],
                  [
                    "Paid / pending",
                    "Illustrative attribution: 60% of the positive investor share modeled paid for PKG-01/03; 0% for PKG-02. Not an actual payout ledger or proof of settlement.",
                  ],
                  [
                    "Source / limitations",
                    "D-4 seeded receipts restricted to each current mandate window, joined with D-6 seeded holdings. No live broker data, full HWM, management-fee, tax or time-weighted-return engine. Historical examples do not forecast returns.",
                  ],
                ].map(([label, body]) => (
                  <section key={label}>
                    <h3>{label}</h3>
                    <p>{body}</p>
                  </section>
                ))}
              </div>
            )}
            {(modal.kind === "pool" || modal.kind === "impact") && (
              <>
                <div className="an-dossier-summary">
                  <span className="an-tag mono">{activePool.code}</span>
                  <h3>{activePool.name}</h3>
                  <strong className="mono">{cash(activePool.profit)}</strong>
                </div>
                <dl className="an-facts">
                  <div>
                    <dt>Funded capital / ROI</dt>
                    <dd>
                      {cash(activePool.capital)} / {pct(activePool.roi)}
                    </dd>
                  </div>
                  <div>
                    <dt>Trading mandate</dt>
                    <dd>
                      {activePool.startsAt.slice(0, 10)} →{" "}
                      {activePool.endsAt.slice(0, 10)} ({activePool.days}d)
                    </dd>
                  </div>
                  <div>
                    <dt>Selected-period contracts / wins</dt>
                    <dd>
                      {activePool.trades} / {activePool.wins}
                    </dd>
                  </div>
                  <div>
                    <dt>Investor attribution / operator</dt>
                    <dd>
                      {cash(activePool.investor)} / {cash(activePool.operator)}
                    </dd>
                  </div>
                  <div>
                    <dt>Funded investor relationships</dt>
                    <dd>{activePool.investors}</dd>
                  </div>
                  <div>
                    <dt>Daily-close max drawdown</dt>
                    <dd>{pct(activePool.maxDrawdown)}</dd>
                  </div>
                </dl>
                <div className="table-responsive">
                  <table className="table an-responsive-table">
                    <thead>
                      <tr>
                        <th>Investor</th>
                        <th>Capital in pool</th>
                        <th>Capital share</th>
                        <th>Investor-earned share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.investors
                        .filter((i) =>
                          i.allocation.some((h) => h.pool === activePool.code),
                        )
                        .map((i) => {
                          const h = i.allocation.find(
                            (h) => h.pool === activePool.code,
                          )!;
                          return (
                            <tr key={i.id}>
                              <td data-label="Investor">
                                <button
                                  className="an-link"
                                  onClick={() => open("investor", i.id)}
                                >
                                  {i.name} ↗
                                </button>
                              </td>
                              <td data-label="Capital" className="mono">
                                {cash(h.capital)}
                              </td>
                              <td data-label="Capital share" className="mono">
                                {pct((h.capital / activePool.capital) * 100)}
                              </td>
                              <td data-label="Investor share">
                                {pnl(h.earned)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <div className="an-actions mt-3">
                  <button
                    className="an-btn"
                    onClick={() => {
                      setModal(null);
                      setDrawer(activePool.code);
                      setDrawerTab("performance");
                    }}
                  >
                    Open right inspector ↗
                  </button>
                  <button
                    className="an-btn"
                    onClick={() => open("drawdown", activePool.code)}
                  >
                    Risk observations
                  </button>
                  <button
                    className="an-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(activePool, null, 2),
                        "application/json",
                        `${activePool.code}-analytics.json`,
                      )
                    }
                  >
                    Download package JSON
                  </button>
                </div>
              </>
            )}
            {modal.kind === "investor" && investor && (
              <>
                <div className="an-dossier-summary">
                  <span className="an-tag mono">{investor.id}</span>
                  <h3>{investor.name}</h3>
                </div>
                <dl className="an-facts">
                  <div>
                    <dt>Selected funded capital</dt>
                    <dd>{cash(investor.capital)}</dd>
                  </div>
                  <div>
                    <dt>Period investor P&L</dt>
                    <dd>{cash(investor.earned)}</dd>
                  </div>
                  <div>
                    <dt>Selected-period ROI</dt>
                    <dd>{pct(investor.roi)}</dd>
                  </div>
                  <div>
                    <dt>Last activity / UTC</dt>
                    <dd>
                      {investor.lastActive.replace("T", " ").slice(0, 16)}
                    </dd>
                  </div>
                </dl>
                <div className="an-investor-breakdown">
                  {investor.allocation.map((h) => (
                    <button key={h.pool} onClick={() => open("impact", h.pool)}>
                      <span className="an-tag mono">{h.pool}</span>
                      <span>{cash(h.capital)} capital</span>
                      <b className="mono">{cash(h.earned)} earned</b>
                      <Icon name="arrowRight" size={14} />
                    </button>
                  ))}
                </div>
                <p className="an-muted mt-3">
                  This is period-specific investor-share attribution, not the
                  lifetime earnings shown in other independent demo snapshots.
                  It is not a confirmed wallet credit.
                </p>
                <button
                  className="an-btn"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        { filters: data.filters, investor },
                        null,
                        2,
                      ),
                      "application/json",
                      `${investor.id}-analytics.json`,
                    )
                  }
                >
                  Download attribution report
                </button>
              </>
            )}
            {(modal.kind === "market" || modal.kind === "strategy") &&
              group && (
                <>
                  <div className="an-dossier-summary">
                    <span className="an-tag">{modal.kind.toUpperCase()}</span>
                    <h3>{group.key}</h3>
                  </div>
                  <dl className="an-facts">
                    {Object.entries({
                      "Net profit": cash(group.profit),
                      "Trades / wins": `${group.trades} / ${group.wins}`,
                      "Win rate": pct(group.winRate),
                      "Average stake": cash(group.averageStake),
                      "Average duration": `${group.averageDuration.toFixed(1)} seconds`,
                      "Share of signed net P&L": data.summary.profit
                        ? pct((group.profit / data.summary.profit) * 100)
                        : "N/A",
                    }).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="an-muted">
                    Contribution is aggregated from the selected execution set;
                    signed contribution can exceed 100% when other groups lose.
                    This is not a recommendation to deploy a strategy or trade a
                    market.
                  </p>
                  <button
                    className="an-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(
                          { filters: data.filters, ...group },
                          null,
                          2,
                        ),
                        "application/json",
                        `${modal.kind}-contribution.json`,
                      )
                    }
                  >
                    Download contribution JSON
                  </button>
                </>
              )}
            {modal.kind === "revenue" && (
              <>
                {distributionTable()}
                <div className="an-form-note mt-3">
                  <Icon name="info" size={18} />
                  <span>
                    Operator share applies only to positive pool profits, not
                    positive portfolio netting. Investor P&L retains losses in
                    full. Paid fractions are a clearly labeled demonstration
                    model, not payout records. A production backend must account
                    for HWM, fees, taxes and settlement eligibility.
                  </span>
                </div>
                <div className="an-actions mt-3">
                  <button className="an-btn" onClick={() => open("settlement")}>
                    Prepare settlement request
                  </button>
                  <button className="an-btn" onClick={() => open("quality")}>
                    Reconcile allocation totals
                  </button>
                </div>
              </>
            )}
            {modal.kind === "settlement" && (
              <>
                {step === 0 ? (
                  <>
                    {distributionTable()}
                    <p className="an-muted mt-3">
                      Prepare a review request for the pending modeled investor
                      share of {cash(revenue.pending)}. No payment will be
                      executed or marked paid by this workflow.
                    </p>
                  </>
                ) : step === 1 ? (
                  <>
                    <div className="an-form-note">
                      <Icon name="shield" size={22} />
                      <span>
                        Required backend checks: authoritative payout ledger,
                        investor eligibility, HWM/fees, approved beneficiary,
                        account roles, liquidity and idempotent transaction
                        execution.
                      </span>
                    </div>
                    <pre className="an-code">
                      {JSON.stringify(
                        {
                          period: data.filters,
                          pending: Math.round(revenue.pending * 100) / 100,
                          eligiblePools: data.pools
                            .filter((p) => p.pending > 0)
                            .map((p) => p.code),
                          requiresReview: true,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </>
                ) : (
                  <>
                    <h3>Download a structured review request.</h3>
                    <p className="an-muted">
                      The request is a handoff artifact only. It creates no
                      backend job, distribution ledger entry or funds transfer.
                    </p>
                    <label className="an-check">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      I understand this is a demo request, not a settlement
                      approval or transfer.
                    </label>
                  </>
                )}
                {!revenue.pending && (
                  <p className="an-muted">
                    No positive pending share in this period. Choose another
                    period or close this review.
                  </p>
                )}
              </>
            )}
            {modal.kind === "drawdown" && (
              <>
                <div className="an-dossier-summary">
                  <span className="an-tag mono">{activePool.code}</span>
                  <h3>{activePool.name}</h3>
                  <b className="mono">
                    Max daily-close drawdown: {pct(activePool.maxDrawdown)}
                  </b>
                </div>
                <p className="an-muted">
                  Recovery is measured from the deepest daily-close trough to
                  the first subsequent observation at or above its prior peak.
                  Unrecovered periods display “Not recovered”, not a fabricated
                  duration.
                </p>
                <div className="table-responsive">
                  <table className="table an-responsive-table">
                    <thead>
                      <tr>
                        <th>UTC day</th>
                        <th>Net P&L</th>
                        <th>Closing equity</th>
                        <th>Running peak</th>
                        <th>Drawdown</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePool.points.map((p) => (
                        <tr key={p.day}>
                          <td data-label="Day" className="mono">
                            {p.day}
                          </td>
                          <td data-label="Net P&L">{pnl(p.profit)}</td>
                          <td data-label="Equity" className="mono">
                            {cash(p.equity)}
                          </td>
                          <td data-label="Peak" className="mono">
                            {cash(p.peak)}
                          </td>
                          <td data-label="Drawdown" className="mono">
                            {pct(p.drawdown)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="an-actions mt-3">
                  <button
                    className="an-btn"
                    onClick={() => open("guardian", activePool.code)}
                  >
                    Correlated events
                  </button>
                  <button
                    className="an-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(activePool.points, null, 2),
                        "application/json",
                        `${activePool.code}-drawdown.json`,
                      )
                    }
                  >
                    Download observations
                  </button>
                </div>
              </>
            )}
            {modal.kind === "guardian" && (
              <>
                <p className="an-muted">
                  Illustrative event records within the selected period. Their
                  appearance near a drawdown does not establish causation or
                  prove live protection was enforced.
                </p>
                <div className="an-event-list">
                  {data.guardian
                    .filter((g) => !modal.key || g.pool === modal.key)
                    .map((g) => (
                      <article key={g.id}>
                        <span className="an-tag mono">
                          {g.pool} · {g.day}
                        </span>
                        <h3>{g.trigger}</h3>
                        <p>{g.action}</p>
                        <button
                          className="an-link"
                          onClick={() => open("drawdown", g.pool)}
                        >
                          Inspect package drawdown ↗
                        </button>
                      </article>
                    ))}
                </div>
                {!data.guardian.some(
                  (g) => !modal.key || g.pool === modal.key,
                ) && (
                  <div className="an-empty">
                    No seeded Guardian events match this pool and period.
                  </div>
                )}
              </>
            )}
            {modal.kind === "comparison" && (
              <>
                {step === 0 ? (
                  <div className="an-form-fields">
                    <p className="an-muted">
                      Choose at least one pool from the active analytics scope.
                    </p>
                    {data.pools.map((p) => (
                      <label className="an-check" key={p.code}>
                        <input
                          type="checkbox"
                          checked={draftCodes.includes(p.code)}
                          onChange={() =>
                            setDraftCodes(
                              draftCodes.includes(p.code)
                                ? draftCodes.filter((c) => c !== p.code)
                                : [...draftCodes, p.code],
                            )
                          }
                        />
                        {p.code} · {p.name} · {p.days} days
                      </label>
                    ))}
                  </div>
                ) : step === 1 ? (
                  <div className="an-choice-grid">
                    {[
                      [
                        "normalized",
                        "Capital-normalized",
                        "Daily P&L ÷ funded capital (%)",
                      ],
                      [
                        "usd",
                        "Absolute dollars",
                        "Raw daily P&L (USD), not capital normalized",
                      ],
                    ].map(([key, label, desc]) => (
                      <button
                        className={draftMode === key ? "selected" : ""}
                        onClick={() => setDraftMode(key)}
                        key={key}
                      >
                        <Icon name="chart" size={24} />
                        <b>{label}</b>
                        <small>{desc}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="an-muted">
                      Aligned by mandate day, not calendar date. Dates outside
                      the selected range or future execution window are missing
                      observations (“—”), not zero returns.
                    </p>
                    <div className="table-responsive">
                      <table className="table an-responsive-table">
                        <thead>
                          <tr>
                            <th>Mandate day</th>
                            {data.pools
                              .filter((p) => draftCodes.includes(p.code))
                              .map((p) => (
                                <th key={p.code}>
                                  {p.code} ({p.days}d)
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentComparison.map((r) => (
                            <tr key={r.day}>
                              <td data-label="Mandate day" className="mono">
                                Day {r.day}
                              </td>
                              {data.pools
                                .filter((p) => draftCodes.includes(p.code))
                                .map((p) => (
                                  <td
                                    key={p.code}
                                    data-label={p.code}
                                    className="mono"
                                  >
                                    {r.values[p.code] === null
                                      ? "—"
                                      : draftMode === "normalized"
                                        ? pct(r.values[p.code]!)
                                        : cash(
                                            (r.values[p.code]! / 100) *
                                              p.capital,
                                          )}
                                  </td>
                                ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
            {modal.kind === "export" && (
              <>
                {step === 0 ? (
                  <div className="an-choice-grid">
                    {[
                      ["csv", "CSV", "Pool revenue and return summary"],
                      [
                        "json",
                        "JSON",
                        "Complete filtered bundle and observations",
                      ],
                      [
                        "pdf",
                        "PDF",
                        "Printable analytics summary with assumptions",
                      ],
                    ].map(([key, label, desc]) => (
                      <button
                        key={key}
                        className={format === key ? "selected" : ""}
                        onClick={() => setFormat(key)}
                      >
                        <Icon name="file" size={24} />
                        <b>{label}</b>
                        <small>{desc}</small>
                      </button>
                    ))}
                  </div>
                ) : step === 1 ? (
                  <>
                    <dl className="an-facts">
                      <div>
                        <dt>Period</dt>
                        <dd>
                          {data.filters.from} → {data.filters.to}
                        </dd>
                      </div>
                      <div>
                        <dt>Package scope</dt>
                        <dd>{data.filters.pool}</dd>
                      </div>
                      <div>
                        <dt>Execution count</dt>
                        <dd>{data.summary.trades}</dd>
                      </div>
                      <div>
                        <dt>Funded investors</dt>
                        <dd>{data.investors.length}</dd>
                      </div>
                    </dl>
                    <p className="an-muted">
                      Reports use the current acknowledged Query snapshot, not a
                      hidden alternate period. Exports are demo artifacts, not
                      audited financial statements.
                    </p>
                  </>
                ) : (
                  <>
                    <h3>Ready to download {format.toUpperCase()}.</h3>
                    <p className="an-muted">
                      JSON includes synthetic investor names and identifiers.
                      Production exports require authorization, privacy controls
                      and an audit record.
                    </p>
                    <label className="an-check">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      I understand the reporting basis and that all data is
                      simulated.
                    </label>
                  </>
                )}
              </>
            )}
            {modal.kind === "schedule" && (
              <>
                {step === 0 ? (
                  <label className="an-field">
                    Delivery email request
                    <input
                      className="form-control"
                      type="email"
                      value={reportEmail}
                      maxLength={150}
                      onChange={(e) => setReportEmail(e.target.value)}
                    />
                    <small>No message is sent by this form.</small>
                  </label>
                ) : step === 1 ? (
                  <>
                    <label className="an-field">
                      Requested frequency / UTC
                      <select
                        className="form-select"
                        value={reportFrequency}
                        onChange={(e) => setReportFrequency(e.target.value)}
                      >
                        <option value="daily">Daily at 09:00 UTC</option>
                        <option value="weekly">Monday at 09:00 UTC</option>
                        <option value="monthly">
                          First day of month at 09:00 UTC
                        </option>
                      </select>
                    </label>
                    <p className="an-muted mt-3">
                      The integration request contains the current explicit date
                      range. A production scheduler must define rolling-window
                      semantics and secure delivery permissions.
                    </p>
                  </>
                ) : (
                  <>
                    <dl className="an-facts">
                      <div>
                        <dt>Email</dt>
                        <dd>{reportEmail}</dd>
                      </div>
                      <div>
                        <dt>Frequency</dt>
                        <dd>{reportFrequency} · UTC</dd>
                      </div>
                      <div>
                        <dt>Scope</dt>
                        <dd>
                          {filters.pool} · {filters.from} → {filters.to}
                        </dd>
                      </div>
                    </dl>
                    <label className="an-check">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      This downloads a backend scheduling request only. No
                      recurring job is created.
                    </label>
                  </>
                )}
              </>
            )}
            {modal.kind === "saved" && (
              <>
                <div className="an-form-fields">
                  <label className="an-field">
                    View name
                    <input
                      className="form-control"
                      maxLength={60}
                      value={viewName}
                      onChange={(e) => setViewName(e.target.value)}
                    />
                  </label>
                  <div className="an-actions">
                    <button
                      className="an-btn an-primary"
                      disabled={viewName.trim().length < 3}
                      onClick={() => {
                        try {
                          const next = [
                            ...savedViews.filter(
                              (v) => v.name !== viewName.trim(),
                            ),
                            { name: viewName.trim(), filters },
                          ].slice(-10);
                          localStorage.setItem(
                            "trademo.analytics.views",
                            JSON.stringify(next),
                          );
                          setSavedViews(next);
                          setViewName("");
                          toast("Analytics view saved in this browser");
                        } catch {
                          setError("Browser storage is unavailable.");
                        }
                      }}
                    >
                      Save current filters
                    </button>
                    <button
                      className="an-btn"
                      onClick={() => {
                        try {
                          const raw: unknown = JSON.parse(
                            localStorage.getItem("trademo.analytics.views") ??
                              "[]",
                          );
                          if (!Array.isArray(raw)) throw new Error();
                          const valid = raw.filter(
                            (
                              v,
                            ): v is {
                              name: string;
                              filters: AnalyticsFilters;
                            } =>
                              typeof v?.name === "string" &&
                              analyticsFilterSchema.safeParse(v.filters)
                                .success,
                          );
                          setSavedViews(valid.slice(-10));
                          toast("Browser views loaded");
                        } catch {
                          setError("Unable to read stored views.");
                        }
                      }}
                    >
                      Load browser views
                    </button>
                  </div>
                </div>
                {!savedViews.length && (
                  <p className="an-muted mt-3">
                    No views loaded. Save your applied filter set or load views
                    saved earlier in this browser.
                  </p>
                )}
                {savedViews.map((v, i) => (
                  <div className="an-saved-row" key={`${v.name}-${i}`}>
                    <div>
                      <b>{v.name}</b>
                      <small>
                        {v.filters.from} → {v.filters.to} · {v.filters.pool}
                      </small>
                    </div>
                    <button className="an-btn" onClick={() => apply(v.filters)}>
                      Apply
                    </button>
                    <button
                      className="an-btn"
                      onClick={() => {
                        try {
                          const next = savedViews.filter((_, ix) => ix !== i);
                          localStorage.setItem(
                            "trademo.analytics.views",
                            JSON.stringify(next),
                          );
                          setSavedViews(next);
                        } catch {
                          setError("Unable to delete view.");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </>
            )}
            {modal.kind === "annotation" && (
              <div className="an-form-fields">
                <label className="an-field">
                  Observation day / UTC
                  <input
                    className="form-control"
                    type="date"
                    min={filters.from}
                    max={filters.to}
                    value={noteDay}
                    onChange={(e) => setNoteDay(e.target.value)}
                  />
                </label>
                <label className="an-field">
                  Review note
                  <textarea
                    className="form-control"
                    rows={5}
                    minLength={10}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <small>
                    10–1,000 characters. Adds a session marker to the drawdown
                    chart in the selected package scope, not an immutable audit
                    record.
                  </small>
                </label>
              </div>
            )}
            {modal.kind === "scenario" && (
              <>
                <label className="an-field">
                  Illustrative haircut on positive winning profit / %
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    max="100"
                    value={haircut}
                    onChange={(e) =>
                      setHaircut(
                        Math.min(100, Math.max(0, Number(e.target.value))),
                      )
                    }
                  />
                  <input
                    aria-label="Profit haircut slider"
                    type="range"
                    min="0"
                    max="100"
                    value={haircut}
                    onChange={(e) => setHaircut(Number(e.target.value))}
                  />
                </label>
                <dl className="an-facts mt-3">
                  <div>
                    <dt>Observed gross wins</dt>
                    <dd>{cash(data.summary.grossWins)}</dd>
                  </div>
                  <div>
                    <dt>Observed absolute losses</dt>
                    <dd>{cash(data.summary.grossLosses)}</dd>
                  </div>
                  <div>
                    <dt>Hypothetical net P&L</dt>
                    <dd>
                      {cash(
                        data.summary.grossWins * (1 - haircut / 100) -
                          data.summary.grossLosses,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Hypothetical funded ROI</dt>
                    <dd>
                      {pct(
                        data.summary.capital
                          ? ((data.summary.grossWins * (1 - haircut / 100) -
                              data.summary.grossLosses) /
                              data.summary.capital) *
                              100
                          : 0,
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="an-muted">
                  A static sensitivity calculation, not a backtest, forecast,
                  slippage model or guarantee. It does not change the actual
                  analytics dataset or recompute fees.
                </p>
                <button
                  className="an-btn"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        {
                          basis: data.filters,
                          winningProfitHaircutPercent: haircut,
                          hypotheticalNetProfit:
                            data.summary.grossWins * (1 - haircut / 100) -
                            data.summary.grossLosses,
                          notForecast: true,
                        },
                        null,
                        2,
                      ),
                      "application/json",
                      "analytics-sensitivity.json",
                    )
                  }
                >
                  Download scenario JSON
                </button>
              </>
            )}
            {modal.kind === "quality" && (
              <>
                <div className="an-quality-list">
                  {quality.map((q) => (
                    <div key={q.label}>
                      <span>{q.label}</span>
                      <strong
                        className={
                          Math.abs(q.a - q.b) < 0.011 ? "text-win" : "text-loss"
                        }
                      >
                        {Math.abs(q.a - q.b) < 0.011 ? "✓ Matched" : "Mismatch"}
                      </strong>
                      <small className="mono">
                        {q.a.toFixed(2)} / {q.b.toFixed(2)}
                      </small>
                    </div>
                  ))}
                </div>
                <p className="an-muted mt-3">
                  Arithmetic agreement is not broker reconciliation or an
                  independent audit. These checks share one fixture source.
                  Production requires authoritative balances, verified source
                  data and account-level audit evidence.
                </p>
                <button
                  className="an-btn"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        { period: data.filters, checks: quality },
                        null,
                        2,
                      ),
                      "application/json",
                      "analytics-integrity-checks.json",
                    )
                  }
                >
                  Download checks JSON
                </button>
              </>
            )}
            {modal.kind === "payload" && (
              <>
                <div className="an-form-note">
                  <Icon name="code" size={18} />
                  <span>
                    GET /api/analytics?from={data.filters.from}&to=
                    {data.filters.to}&pool={data.filters.pool} · Typed
                    AnalyticsBundle response. This is a read-only fixture
                    endpoint.
                  </span>
                </div>
                <pre className="an-code">{JSON.stringify(data, null, 2)}</pre>
                <div className="an-actions">
                  <button
                    className="an-btn"
                    onClick={() => copy(JSON.stringify(data, null, 2))}
                  >
                    Copy JSON
                  </button>
                  <button
                    className="an-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(data, null, 2),
                        "application/json",
                        "analytics-payload.json",
                      )
                    }
                  >
                    Download JSON
                  </button>
                </div>
              </>
            )}
            {modal.kind === "day" && observation && (
              <>
                <div className="an-dossier-summary">
                  <span className="an-tag mono">{observation.day} UTC</span>
                  <h3>Portfolio daily observation</h3>
                </div>
                <dl className="an-facts">
                  <div>
                    <dt>Portfolio daily P&L</dt>
                    <dd>{cash(observation.profit)}</dd>
                  </div>
                  <div>
                    <dt>Closing equity</dt>
                    <dd>{cash(observation.equity)}</dd>
                  </div>
                  <div>
                    <dt>Running daily-close peak</dt>
                    <dd>{cash(observation.peak)}</dd>
                  </div>
                  <div>
                    <dt>Portfolio drawdown</dt>
                    <dd>{pct(observation.drawdown)}</dd>
                  </div>
                </dl>
                <div className="an-investor-breakdown">
                  {data.pools.map((p) => {
                    const day = p.points.find(
                      (row) => row.day === observation.day,
                    );
                    return (
                      <button
                        key={p.code}
                        onClick={() => open("drawdown", p.code)}
                      >
                        <span className="an-tag mono">{p.code}</span>
                        <span>{cash(day?.profit ?? 0)} day P&L</span>
                        <b className="mono">{pct(day?.drawdown ?? 0)} DD</b>
                      </button>
                    );
                  })}
                </div>
                <button
                  className="an-btn mt-3"
                  onClick={() => {
                    setNoteDay(observation.day);
                    setNote("");
                    setModal({ kind: "annotation" });
                  }}
                >
                  Annotate this day
                </button>
              </>
            )}
          </DeskModalShell>
        </div>
      )}
      {inspected && (
        <div
          className="an-drawer-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawer(null);
          }}
        >
          <aside
            className="an-drawer an-local-layer"
            role="dialog"
            aria-modal="true"
            aria-label={`${inspected.code} analytics inspector`}
          >
            <div className="an-drawer-head">
              <div>
                <span className="an-eyebrow">PACKAGE ANALYTICS INSPECTOR</span>
                <h2>
                  {inspected.code} · {inspected.name}
                </h2>
              </div>
              <button
                className="an-icon"
                aria-label="Close analytics inspector"
                onClick={() => setDrawer(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav
              className="an-drawer-tabs"
              aria-label="Analytics inspector tabs"
            >
              {["performance", "allocation", "risk"].map((t) => (
                <button
                  key={t}
                  className={drawerTab === t ? "active" : ""}
                  onClick={() => setDrawerTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="an-drawer-body">
              {drawerTab === "performance" ? (
                <>
                  <div className="an-drawer-profit">
                    {pnl(inspected.profit)}
                  </div>
                  <dl className="an-facts">
                    <div>
                      <dt>Funded capital</dt>
                      <dd>{cash(inspected.capital)}</dd>
                    </div>
                    <div>
                      <dt>Selected ROI</dt>
                      <dd>{pct(inspected.roi)}</dd>
                    </div>
                    <div>
                      <dt>Trades / wins</dt>
                      <dd>
                        {inspected.trades} / {inspected.wins}
                      </dd>
                    </div>
                    <div>
                      <dt>Mandate length</dt>
                      <dd>{inspected.days} days</dd>
                    </div>
                  </dl>
                  <p className="an-muted">{inspected.markets.join(" · ")}</p>
                  <p className="an-muted">{inspected.strategies.join(" · ")}</p>
                </>
              ) : drawerTab === "allocation" ? (
                <dl className="an-facts">
                  <div>
                    <dt>Funded investors</dt>
                    <dd>{inspected.investors}</dd>
                  </div>
                  <div>
                    <dt>Investor P&L</dt>
                    <dd>{cash(inspected.investor)}</dd>
                  </div>
                  <div>
                    <dt>Operator share</dt>
                    <dd>{cash(inspected.operator)}</dd>
                  </div>
                  <div>
                    <dt>Modeled pending</dt>
                    <dd>{cash(inspected.pending)}</dd>
                  </div>
                </dl>
              ) : (
                <>
                  <dl className="an-facts">
                    <div>
                      <dt>Maximum daily-close DD</dt>
                      <dd>{pct(inspected.maxDrawdown)}</dd>
                    </div>
                    <div>
                      <dt>Underwater days</dt>
                      <dd>{inspected.underwaterDays}</dd>
                    </div>
                    <div>
                      <dt>Trough-to-recovery</dt>
                      <dd>
                        {inspected.recoveryDays === null
                          ? "Not recovered"
                          : `${inspected.recoveryDays} observations`}
                      </dd>
                    </div>
                    <div>
                      <dt>DD / peak gain</dt>
                      <dd>{inspected.drawdownToProfit?.toFixed(2) ?? "N/A"}</dd>
                    </div>
                  </dl>
                  <p className="an-muted">
                    Period-reset daily-close measures only; does not show
                    maximum intraday risk.
                  </p>
                </>
              )}
            </div>
            <div className="an-drawer-foot">
              <button
                className="an-btn"
                onClick={() => open("pool", inspected.code)}
              >
                Full dossier
              </button>
              <button
                className="an-btn an-primary"
                onClick={() => open("impact", inspected.code)}
              >
                Investor impact
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
export function AnalyticsPage({
  operatorBundle,
  initial,
}: {
  operatorBundle: OperatorBundleProps;
  initial: AnalyticsBundle;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-analytics" bundle={operatorBundle}>
      {() => <AnalyticsDesk initial={initial} />}
    </OperatorShell>
  );
}
