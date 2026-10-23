"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  OperatorShell,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon, type IconName } from "@/components/icons";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import { useLogs, useLogStream } from "@/lib/logs/use-logs";
import {
  defaultLogFilters,
  filtersSchema,
  filterLogs,
  logSummary,
  type LogCommand,
} from "@/lib/logs/model";
import {
  categories,
  type AuditEvent,
  type Category,
  type Filters,
  type LogsBundle,
  type SystemKind,
} from "@/lib/logs/types";
import { LogsDialog, LogInspector, type DialogKind } from "./logs-overlays";
export const human = (s: string) => s.replaceAll("_", " ");
export const time = (s: string) => s.replace("T", " ").slice(0, 19);
export const cash = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const col = createDeskColumnHelper<AuditEvent>();
const categoryIcons: Record<Category, IconName> = {
  trade: "chart",
  deposit: "wallet",
  payout: "vault",
  system: "terminal",
  auth: "lock",
  comm: "mail",
  audit: "file",
};
export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className={`lg-category lg-category-${category}`}>
      <Icon name={categoryIcons[category]} size={11} />
      {category}
    </span>
  );
}
export function SeverityTag({ severity }: { severity: string }) {
  return (
    <span className={`lg-status lg-severity-${severity}`}>{severity}</span>
  );
}
function Stat({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
}) {
  const n = useLiveCountUp(value);
  return (
    <button className="lg-metric" onClick={onClick}>
      <div>
        <span>{label}</span>
        <Icon name="arrowRight" size={13} />
      </div>
      <strong className="mono">{Math.round(n).toLocaleString()}</strong>
      <small>{detail}</small>
    </button>
  );
}
function LogDesk({ initial }: { initial: LogsBundle }) {
  const { data, mutation, reset } = useLogs(initial),
    { pushToast } = useOperatorUI();
  const [filters, setFilters] = useState<Filters>(
      defaultLogFilters(initial.asOf),
    ),
    [tab, setTab] = useState<Category>("trade"),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState<SortingState>([{ id: "createdAt", desc: true }]),
    [investor, setInvestor] = useState(initial.investors[0].id),
    [systemType, setSystemType] = useState<SystemKind>("webhook_failure"),
    [authType, setAuthType] = useState("all"),
    [apiDirection, setApiDirection] = useState("all"),
    [apiStatus, setApiStatus] = useState("all"),
    [apiPage, setApiPage] = useState(1),
    [modal, setModal] = useState<{ kind: DialogKind; id?: string } | null>(
      null,
    ),
    [drawer, setDrawer] = useState<string | null>(null),
    [paused, setPaused] = useState(false),
    [frozen, setFrozen] = useState<LogsBundle | null>(null);
  const valid = filtersSchema.safeParse(filters),
    safe = valid.success ? filters : defaultLogFilters(data.asOf),
    filtered = valid.success ? filterLogs(data, filters) : [],
    metrics = logSummary(filtered),
    stream = useLogStream(paused && frozen ? frozen : data, safe),
    streamRows = valid.success ? stream.data.pages.flatMap((p) => p.items) : [],
    streamRef = useRef<HTMLDivElement>(null),
    // eslint-disable-next-line react-hooks/incompatible-library -- Keep the mutable virtualizer local to this non-memoized viewport.
    virtual = useVirtualizer({
      count: streamRows.length,
      getScrollElement: () => streamRef.current,
      estimateSize: () => 100,
      overscan: 4,
      initialRect: { width: 1000, height: 480 },
    });
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("createdAt", { header: "Timestamp / UTC" }),
        col.accessor("actorName", { header: "Actor" }),
        col.accessor("action", { header: "Action" }),
        col.accessor("target", { header: "Target" }),
        col.accessor("severity", { header: "Severity" }),
      ]),
    [],
  );
  const tableRows = valid.success
    ? filterLogs(data, { ...filters, category: tab })
    : [];
  const table = useDeskTable({
    data: tableRows,
    columns,
    state: { sorting: sort },
    onSortingChange: (u) => {
      setSort(typeof u === "function" ? u(sort) : u);
      setPage(1);
    },
  });
  const pages = Math.max(1, Math.ceil(tableRows.length / pageSize)),
    current = Math.min(page, pages),
    visible = table
      .getRowModel()
      .rows.slice((current - 1) * pageSize, current * pageSize);
  const within = (e: { createdAt: string }) =>
    valid.success &&
    e.createdAt.slice(0, 10) >= filters.from &&
    e.createdAt.slice(0, 10) <= filters.to;
  const investorEvents = data.events
    .filter((e) => e.investorId === investor && within(e))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const systems = data.events.filter(
    (e) => e.systemKind === systemType && within(e),
  );
  const security = data.events.filter(
    (e) =>
      e.category === "auth" &&
      within(e) &&
      (authType === "all" || e.action === authType),
  );
  const api = data.api.filter(
    (a) =>
      within(a) &&
      (apiDirection === "all" || a.direction === apiDirection) &&
      (apiStatus === "all" ||
        (apiStatus === "errors" && a.status >= 400) ||
        (apiStatus === "success" && a.status < 400)),
  );
  const apiPages = Math.max(1, Math.ceil(api.length / 8)),
    safeApi = Math.min(apiPage, apiPages),
    apis = api.slice((safeApi - 1) * 8, safeApi * 8);
  const actors = [
    ...new Map(
      data.events.map((e) => [e.actorId, { id: e.actorId, name: e.actorName }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const metadataFields =
    tab === "trade"
      ? ["symbol", "contractId", "stake", "profit", "bot", "schedule"]
      : tab === "deposit"
        ? ["amount", "method", "reference", "status"]
        : tab === "payout"
          ? ["amount", "fee", "method", "status", "providerOutcome"]
          : tab === "system"
            ? ["outcome", "durationMs", "status"]
            : ["outcome"];
  function open(kind: DialogKind, id?: string) {
    setDrawer(null);
    setModal({ kind, id });
  }
  function filter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters({ ...filters, [key]: value });
    setPage(1);
    streamRef.current?.scrollTo({ top: 0 });
  }
  function applyView(f: Filters) {
    setFilters(f);
    setPage(1);
    setModal(null);
    streamRef.current?.scrollTo({ top: 0 });
    pushToast({ tone: "info", title: "Saved scope applied to event explorer" });
  }
  async function command(c: LogCommand) {
    await mutation.mutateAsync(c);
    setModal(null);
    pushToast({
      tone: "success",
      title: "Local audit action recorded; no external system changed",
    });
  }
  function resetDesk() {
    reset();
    setFilters(defaultLogFilters(initial.asOf));
    setPaused(false);
    setFrozen(null);
    setPage(1);
    setApiPage(1);
    setModal(null);
  }
  function inspect(id: string) {
    setModal(null);
    setDrawer(id);
  }
  return (
    <div className="lg-canvas">
      <header className="lg-header">
        <div>
          <div className="lg-eyebrow">
            <span className="lg-tag mono">D-12</span>OPERATOR CONSOLE / EVIDENCE
            & OVERSIGHT
          </div>
          <h1>Activity & audit logs</h1>
          <p>
            Follow the event, not the assumption. Trace operational activity,
            review exceptions, and assemble evidence for accountable decisions.
          </p>
        </div>
        <div className="lg-actions">
          <button className="lg-btn" onClick={() => open("savedViews")}>
            <Icon name="sliders" size={14} />
            Saved views ({data.views.length})
          </button>
          <button className="lg-btn" onClick={() => open("compliance")}>
            <Icon name="file" size={14} />
            Compliance workpaper
          </button>
          <button className="lg-btn lg-primary" onClick={() => open("export")}>
            <Icon name="layers" size={14} />
            Export logs
          </button>
        </div>
      </header>
      <div className="lg-demo">
        <span className="lg-demo-tag">SYNTHETIC AUDIT WORKSPACE</span>
        <span>
          Seeded cross-module observations · local reviews append events · no
          real monitoring or access revocation
        </span>
        <span className="mono">
          BASE {time(data.asOf)} UTC · REV {data.revision}
        </span>
        <button className="lg-link" onClick={() => open("methodology")}>
          Evidence boundaries ↗
        </button>
      </div>
      <section className="lg-metrics" aria-label="Audit overview">
        <Stat
          label="Events in scope"
          value={metrics.total}
          detail={`${data.events.length} source + local records`}
          onClick={() =>
            document
              .getElementById("log-stream")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
        <Stat
          label="Critical observations"
          value={metrics.critical}
          detail="Seeded severity, not a live incident count"
          onClick={() => filter("severity", "critical")}
        />
        <Stat
          label="Distinct actors"
          value={metrics.actors}
          detail="Services, operators, bots and investors"
          onClick={() => open("actors")}
        />
        <Stat
          label="Open escalations"
          value={data.reviews.filter((r) => r.status === "escalated").length}
          detail="Workspace review state · original evidence retained"
          onClick={() => open("reviews")}
        />
      </section>
      <section className="lg-panel" id="log-stream">
        <div className="lg-panel-head">
          <div>
            <span className="lg-section-code">01 / EVENT EXPLORER</span>
            <h2>Activity stream</h2>
            <p>
              Newest first · 100-event query pages · virtualized viewport · at
              most 1,000 matching events in this stream.
            </p>
          </div>
          <div className="lg-actions">
            <span className={`lg-feed-indicator ${paused ? "paused" : ""}`}>
              <i />
              {paused ? "Stream paused" : "Demo feed active"}
            </span>
            <button
              className="lg-btn"
              onClick={() => {
                if (paused) {
                  setPaused(false);
                  setFrozen(null);
                } else {
                  setFrozen(data);
                  setPaused(true);
                }
              }}
            >
              {paused ? "Resume stream" : "Pause stream"}
            </button>
            <button className="lg-btn" onClick={() => open("simulate")}>
              Append demo observation
            </button>
          </div>
        </div>
        <div className="lg-filterbar">
          <label className="lg-search">
            <Icon name="search" size={14} />
            <input
              aria-label="Search audit events"
              placeholder="Actor, action, target or correlation…"
              value={filters.search}
              onChange={(e) => filter("search", e.target.value)}
            />
          </label>
          <select
            aria-label="Event category filter"
            className="lg-select"
            value={filters.category}
            onChange={(e) =>
              filter("category", e.target.value as Filters["category"])
            }
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Event severity filter"
            className="lg-select"
            value={filters.severity}
            onChange={(e) =>
              filter("severity", e.target.value as Filters["severity"])
            }
          >
            <option value="all">All severities</option>
            {["info", "warning", "critical"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            className="lg-select"
            aria-label="Event actor filter"
            value={filters.actor}
            onChange={(e) => filter("actor", e.target.value)}
          >
            <option value="all">All actors</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {(["from", "to"] as const).map((k) => (
            <label className="lg-date" key={k}>
              {k} / UTC
              <input
                type="date"
                aria-label={`Event ${k} date`}
                value={filters[k]}
                onChange={(e) => filter(k, e.target.value)}
              />
            </label>
          ))}
          <button
            className="lg-link"
            onClick={() => {
              setFilters(defaultLogFilters(data.asOf));
              setPage(1);
            }}
          >
            Reset event filters
          </button>
          <button
            className="lg-link"
            disabled={!valid.success}
            onClick={() => open("savedView")}
          >
            Save this view ↗
          </button>
        </div>
        {!valid.success && (
          <div role="alert" className="lg-error m-3">
            {valid.error.issues[0].message}
          </div>
        )}
        {paused && (
          <div className="lg-note mx-3">
            Stream frozen at revision {frozen?.revision};{" "}
            {data.events.length - (frozen?.events.length ?? data.events.length)}{" "}
            new workspace events buffered. Other panels remain current. Resume
            to reveal new observations.
          </div>
        )}
        <div className="lg-stream-legend">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() =>
                filter("category", filters.category === c ? "all" : c)
              }
              aria-pressed={filters.category === c}
            >
              <CategoryTag category={c} />
              <span className="mono">
                {metrics.byCategory.find((x) => x.category === c)?.count ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div
          className="lg-stream"
          ref={streamRef}
          role="list"
          aria-label="Virtualized event stream"
          tabIndex={0}
        >
          <div
            style={{
              height: `${virtual.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {virtual.getVirtualItems().map((item) => {
              const e = streamRows[item.index];
              return (
                <div
                  className="lg-stream-row"
                  key={e.id}
                  role="listitem"
                  aria-posinset={item.index + 1}
                  aria-setsize={Math.min(1000, filtered.length)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <button
                    className="lg-event-main"
                    onClick={() => open("detail", e.id)}
                  >
                    <div>
                      <time className="mono">{time(e.createdAt)} UTC</time>
                      <CategoryTag category={e.category} />
                      <SeverityTag severity={e.severity} />
                    </div>
                    <p>
                      <b>{e.actorName}</b>
                      <strong>{human(e.action)}</strong>
                      <span className="mono">{e.target}</span>
                    </p>
                    <small>
                      {e.details} · {e.ipAddress}
                    </small>
                  </button>
                  <button
                    className="lg-event-inspect"
                    aria-label={`Inspect ${e.id}`}
                    onClick={() => inspect(e.id)}
                  >
                    <Icon name="panelRight" size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          {!streamRows.length && (
            <div className="lg-empty">
              <h3>No observations in this scope</h3>
              <p>Try another category, actor or UTC date range.</p>
              <button
                className="lg-btn"
                onClick={() => setFilters(defaultLogFilters(data.asOf))}
              >
                Restore default view
              </button>
            </div>
          )}
        </div>
        <div className="lg-panel-foot">
          <span>
            {streamRows.length} loaded / {Math.min(1000, filtered.length)}{" "}
            stream limit · {filtered.length} matching overall · no websocket or
            live provider feed connected
          </span>
          <button
            className="lg-btn"
            disabled={
              !stream.hasNextPage || stream.isFetchingNextPage || !valid.success
            }
            onClick={() => void stream.fetchNextPage()}
          >
            {stream.isFetchingNextPage
              ? "Loading next page…"
              : stream.hasNextPage
                ? "Load next 100 events"
                : "All stream pages loaded"}
          </button>
        </div>
      </section>
      <section className="lg-panel" id="categorized-logs">
        <div className="lg-panel-head">
          <div>
            <span className="lg-section-code">02 / LIFECYCLE EVIDENCE</span>
            <h2>Categorized logs</h2>
            <p>
              Category tabs override the stream category only; text, actor,
              severity and UTC date filters still apply.
            </p>
          </div>
          <button className="lg-btn" onClick={() => open("export", tab)}>
            Export current scope ↗
          </button>
        </div>
        <nav className="lg-category-tabs" aria-label="Categorized log tabs">
          {categories.map((c) => (
            <button
              key={c}
              aria-pressed={tab === c}
              className={tab === c ? "active" : ""}
              onClick={() => {
                setTab(c);
                setPage(1);
              }}
            >
              <CategoryTag category={c} />
            </button>
          ))}
        </nav>
        <div className="table-responsive lg-category-table" key={tab}>
          <table className="table lg-table">
            <thead>
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((h) => (
                  <th key={h.id}>
                    <button onClick={h.column.getToggleSortingHandler()}>
                      {String(h.column.columnDef.header)}{" "}
                      {h.column.getIsSorted() === "desc" ? "↓" : "↕"}
                    </button>
                  </th>
                ))}
                {metadataFields.map((f) => (
                  <th key={f}>{human(f.replace(/([A-Z])/g, " $1"))}</th>
                ))}
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ original: e }) => (
                <tr key={e.id}>
                  <td className="mono">{time(e.createdAt)}</td>
                  <td>{e.actorName}</td>
                  <td>{human(e.action)}</td>
                  <td className="mono">{e.target}</td>
                  <td>
                    <SeverityTag severity={e.severity} />
                  </td>
                  {metadataFields.map((f) => (
                    <td className="mono" key={f}>
                      {e.metadata[f] === undefined || e.metadata[f] === null
                        ? "Not recorded"
                        : typeof e.metadata[f] === "number"
                          ? ["profit", "stake", "amount", "fee"].includes(f)
                            ? cash(e.metadata[f] as number)
                            : e.metadata[f]
                          : String(e.metadata[f])}
                    </td>
                  ))}
                  <td>
                    <button
                      className="lg-link"
                      onClick={() => open("detail", e.id)}
                    >
                      Inspect ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="lg-empty">
            <h3>No {tab} events match</h3>
            <button
              className="lg-btn"
              onClick={() => setFilters(defaultLogFilters(data.asOf))}
            >
              Reset explorer scope
            </button>
          </div>
        )}
        <div className="lg-panel-foot">
          <span>
            {tableRows.length} category events · source status observations, not
            invented lifecycle transitions
          </span>
          <div className="lg-actions">
            <select
              className="lg-select"
              aria-label="Category page size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <div className="lg-pagination">
              <button
                aria-label="Previous category page"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                ←
              </button>
              <span>
                {current} / {pages}
              </span>
              <button
                aria-label="Next category page"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </section>
      <div className="lg-context-grid">
        <section className="lg-panel">
          <div className="lg-panel-head">
            <div>
              <span className="lg-section-code">03 / INVESTOR ACTIVITY</span>
              <h2>Investor event trail</h2>
              <p>
                Selected UTC range, independent of stream text/category/actor
                filters.
              </p>
            </div>
            <select
              aria-label="Activity investor"
              className="lg-select"
              value={investor}
              onChange={(e) => setInvestor(e.target.value)}
            >
              {data.investors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="lg-investor-timeline">
            {investorEvents.slice(0, 6).map((e) => (
              <button key={e.id} onClick={() => open("detail", e.id)}>
                <i className={`lg-dot lg-dot-${e.category}`} />
                <time className="mono">{time(e.createdAt)}</time>
                <b>{human(e.action)}</b>
                <span>{e.details}</span>
              </button>
            ))}
            {!investorEvents.length && (
              <p className="lg-muted">
                No attributed observations for this investor in the selected
                range.
              </p>
            )}
          </div>
          <div className="lg-panel-foot">
            <span>{investorEvents.length} attributed observations</span>
            <button
              className="lg-link"
              onClick={() => open("investor", investor)}
            >
              Full investor timeline ↗
            </button>
          </div>
        </section>
        <section className="lg-panel">
          <div className="lg-panel-head">
            <div>
              <span className="lg-section-code">04 / SYSTEM OPERATIONS</span>
              <h2>System events</h2>
              <p>
                Recorded operational fixtures, not live job or backup health.
              </p>
            </div>
            <select
              className="lg-select"
              aria-label="System event kind"
              value={systemType}
              onChange={(e) => setSystemType(e.target.value as SystemKind)}
            >
              {(
                [
                  "guardian",
                  "reconciliation",
                  "backup_daily",
                  "backup_weekly",
                  "cron",
                  "webhook_failure",
                ] as SystemKind[]
              ).map((k) => (
                <option key={k} value={k}>
                  {human(k)}
                </option>
              ))}
            </select>
          </div>
          <div className="lg-system-list">
            {systems.slice(0, 5).map((e) => {
              const retry = data.retries
                .filter((r) => r.eventId === e.id)
                .at(-1);
              return (
                <article key={e.id}>
                  <div>
                    <time className="mono">{time(e.createdAt)} UTC</time>
                    <SeverityTag severity={e.severity} />
                  </div>
                  <button
                    className="lg-link lg-system-title"
                    onClick={() => open("detail", e.id)}
                  >
                    {e.target}
                  </button>
                  <p>{e.details}</p>
                  <div className="lg-actions">
                    <button
                      className="lg-link"
                      onClick={() => open("detail", e.id)}
                    >
                      Inspect ↗
                    </button>
                    {e.systemKind === "webhook_failure" && (
                      <button
                        className="lg-btn"
                        disabled={retry?.state === "succeeded_demo"}
                        onClick={() =>
                          open(
                            retry?.state === "queued_demo"
                              ? "retryOutcome"
                              : "retry",
                            retry?.state === "queued_demo" ? retry.id : e.id,
                          )
                        }
                      >
                        {retry?.state === "queued_demo"
                          ? "Simulate outcome"
                          : retry?.state === "succeeded_demo"
                            ? "Demo retry succeeded"
                            : "Review retry"}
                      </button>
                    )}
                    {e.systemKind?.startsWith("backup") && (
                      <button
                        className="lg-btn"
                        onClick={() => open("backup", e.id)}
                      >
                        Backup observation
                      </button>
                    )}
                    {e.systemKind === "cron" && (
                      <button
                        className="lg-btn"
                        onClick={() => open("job", e.id)}
                      >
                        Dry-run review
                      </button>
                    )}
                    {e.systemKind === "reconciliation" && (
                      <button
                        className="lg-btn"
                        onClick={() => open("reconciliation", e.id)}
                      >
                        Reconciliation evidence
                      </button>
                    )}
                  </div>
                  {retry && (
                    <small className="lg-muted">
                      Attempt {retry.attempt}: {human(retry.state)}
                    </small>
                  )}
                </article>
              );
            })}
            {!systems.length && (
              <div className="lg-empty">
                No matching system observations in the selected UTC range.
              </div>
            )}
          </div>
          <div className="lg-panel-foot">
            <span>
              {systems.length} {human(systemType)} observations
            </span>
            <button
              className="lg-link"
              onClick={() => open("systemHistory", systemType)}
            >
              View full system history ↗
            </button>
          </div>
        </section>
      </div>
      <section className="lg-panel">
        <div className="lg-panel-head">
          <div>
            <span className="lg-section-code">05 / SECURITY & ACCESS</span>
            <h2>Authentication & session evidence</h2>
            <p>
              Selected UTC range · masked IPs · a local session flag does not
              invalidate a real authentication token.
            </p>
          </div>
          <div className="lg-actions">
            <select
              className="lg-select"
              aria-label="Security event filter"
              value={authType}
              onChange={(e) => setAuthType(e.target.value)}
            >
              <option value="all">All auth observations</option>
              {[
                "login_success",
                "login_failed",
                "two_factor_passed",
                "password_reset_requested",
              ].map((t) => (
                <option key={t} value={t}>
                  {human(t)}
                </option>
              ))}
            </select>
            <button className="lg-btn" onClick={() => open("sessions")}>
              Review sessions (
              {data.sessions.filter((s) => s.state === "active").length})
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table lg-table">
            <thead>
              <tr>
                <th>Time / UTC</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Masked origin</th>
                <th>Evidence</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {security.slice(0, 8).map((e) => (
                <tr key={e.id}>
                  <td className="mono">{time(e.createdAt)}</td>
                  <td>{e.actorName}</td>
                  <td>{human(e.action)}</td>
                  <td className="mono">{e.ipAddress}</td>
                  <td>
                    <SeverityTag severity={e.severity} />
                  </td>
                  <td>
                    <button
                      className="lg-link"
                      onClick={() => open("security", e.id)}
                    >
                      Security review ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!security.length && (
          <div className="lg-empty">
            No authentication observations in this date/action scope.
          </div>
        )}
        <div className="lg-panel-foot">
          <span>Showing up to 8 / {security.length} observations</span>
          <button
            className="lg-link"
            onClick={() => {
              setTab("auth");
              setPage(1);
              document
                .getElementById("categorized-logs")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            All auth events in categorized table ↗
          </button>
        </div>
      </section>
      <section className="lg-panel">
        <div className="lg-panel-head">
          <div>
            <span className="lg-section-code">06 / TRANSPORT OBSERVATIONS</span>
            <h2>API & webhook access</h2>
            <p>
              100 internal and 50 external seeded request observations. Paths
              here are evidence labels, not executable controls.
            </p>
          </div>
          <div className="lg-actions">
            <select
              className="lg-select"
              aria-label="API direction filter"
              value={apiDirection}
              onChange={(e) => {
                setApiDirection(e.target.value);
                setApiPage(1);
              }}
            >
              <option value="all">All directions</option>
              <option value="internal">Internal API</option>
              <option value="webhook">External webhook</option>
            </select>
            <select
              className="lg-select"
              aria-label="API status filter"
              value={apiStatus}
              onChange={(e) => {
                setApiStatus(e.target.value);
                setApiPage(1);
              }}
            >
              <option value="all">All outcomes</option>
              <option value="success">2xx observed</option>
              <option value="errors">4xx / 5xx observed</option>
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table lg-table">
            <thead>
              <tr>
                <th>Time / UTC</th>
                <th>Method / route</th>
                <th>Observed status</th>
                <th>Latency</th>
                <th>Attribution</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {apis.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{time(a.createdAt)}</td>
                  <td className="mono">
                    {a.method} {a.path}
                  </td>
                  <td>
                    <span
                      className={`lg-status ${a.status >= 400 ? "lg-severity-warning" : ""}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="mono">{a.latencyMs} ms</td>
                  <td>
                    {a.actor}
                    <small className="lg-cell-sub">{a.direction}</small>
                  </td>
                  <td>
                    <button
                      className="lg-link"
                      onClick={() => open("access", a.id)}
                    >
                      Inspect request ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!apis.length && (
          <div className="lg-empty">
            No transport observations in this scope.
          </div>
        )}
        <div className="lg-panel-foot">
          <span>
            {api.length} recorded requests in the selected date/direction/status
            scope
          </span>
          <div className="lg-pagination">
            <button
              aria-label="Previous API page"
              disabled={safeApi === 1}
              onClick={() => setApiPage(safeApi - 1)}
            >
              ←
            </button>
            <span>
              {safeApi} / {apiPages}
            </span>
            <button
              aria-label="Next API page"
              disabled={safeApi === apiPages}
              onClick={() => setApiPage(safeApi + 1)}
            >
              →
            </button>
          </div>
        </div>
      </section>
      <section className="lg-panel">
        <div className="lg-panel-head">
          <div>
            <span className="lg-section-code">
              07 / EXPORT & COMPLIANCE WORKPAPERS
            </span>
            <h2>Evidence that travels with its limits</h2>
            <p>
              Exports are bounded to 30 inclusive UTC days and 10,000 rows.
              Retention values are proposed operational defaults, not
              jurisdiction-specific legal advice.
            </p>
          </div>
          <button className="lg-btn" onClick={() => open("retention")}>
            Review retention policy
          </button>
        </div>
        <div className="lg-retention-grid">
          {(
            [
              [
                "Trade / deposit / payout",
                `${data.retention.financialYears} years`,
              ],
              ["Authentication", `${data.retention.authYears} years`],
              ["System", `${data.retention.systemDays} days`],
              ["Audit decisions", `${data.retention.auditYears} years`],
              ["Communications", `${data.retention.commYears} years`],
              [
                "Legal holds",
                `${data.holds.filter((h) => h.active).length} active demo holds`,
              ],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b className="mono">{value}</b>
            </div>
          ))}
        </div>
        <div className="lg-panel-foot">
          <span>
            Last seeded archive manifest: 2026-10-01 · no cloud storage object
            or purge operation
          </span>
          <div className="lg-actions">
            <button className="lg-btn" onClick={() => open("archives")}>
              View archive list ({data.archives.length})
            </button>
            <button className="lg-btn" onClick={() => open("archive")}>
              Create archive manifest
            </button>
            <button className="lg-link" onClick={() => open("holds")}>
              Legal hold register ↗
            </button>
          </div>
        </div>
      </section>
      <section>
        <div className="lg-section-head">
          <h2>Audit workbench</h2>
          <span className="lg-muted">SCOPE / REVIEW / PRESERVE / REPORT</span>
        </div>
        <div className="lg-workbench">
          {(
            [
              ["export", "file", "Export filtered event CSV"],
              ["compliance", "shield", "Compliance PDF workpaper"],
              ["tax", "chart", "Accountant P/L worksheet"],
              ["archive", "layers", "Archive manifest review"],
              ["hold", "lock", "Place a local legal hold"],
              ["reviews", "activity", "Review decision register"],
            ] as [DialogKind, IconName, string][]
          ).map(([kind, icon, label]) => (
            <button key={kind} onClick={() => open(kind)}>
              <Icon name={icon} size={16} />
              {label}
              <Icon name="arrowRight" size={13} />
            </button>
          ))}
        </div>
      </section>
      <footer className="lg-footer">
        <span>
          FRONTEND AUDIT DEMO / read-only source evidence, separately appended
          local decisions · no certification, real archiving or tax filing
        </span>
        <Link href="/dashboard/trades">Trade receipts ↗</Link>
        <Link href="/dashboard/deposits">Deposit logs ↗</Link>
        <Link href="/dashboard/withdrawals">Payout review ↗</Link>
        <button className="lg-link" onClick={() => open("reset")}>
          Reset audit workspace ↗
        </button>
      </footer>
      {modal && (
        <LogsDialog
          key={`${modal.kind}:${modal.id ?? ""}`}
          modal={modal}
          data={data}
          filters={filters}
          onClose={() => setModal(null)}
          onOpen={open}
          onCommand={command}
          onFilters={applyView}
          onReset={resetDesk}
          onInspect={inspect}
        />
      )}
      {drawer && (
        <LogInspector
          data={data}
          id={drawer}
          onClose={() => setDrawer(null)}
          onOpen={open}
        />
      )}
    </div>
  );
}
export function LogsPage({
  operatorBundle,
  initial,
}: {
  operatorBundle: OperatorBundleProps;
  initial: LogsBundle;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-logs" bundle={operatorBundle}>
      {() => <LogDesk initial={initial} />}
    </OperatorShell>
  );
}
