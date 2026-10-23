"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  OperatorShell,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon } from "@/components/icons";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import { useMarkets } from "@/lib/markets/use-markets";
import {
  groups,
  strategies,
  budgetFor,
  marketSession,
  performance,
  scheduleIssues,
  scheduleSchema,
  tickStats,
  type MarketBundle,
  type MarketCommand,
  type ScheduleInput,
  type SymbolDTO,
} from "@/lib/markets/model";
const cash = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n),
  stamp = (s: string) => s.replace("T", " ").slice(0, 19);
const col = createDeskColumnHelper<ReturnType<typeof performance>[number]>();
type Kind =
  | "symbol"
  | "schedule"
  | "assignment"
  | "risk"
  | "ticks"
  | "statistics"
  | "history"
  | "performance"
  | "recommendation"
  | "calendar"
  | "session"
  | "favorites"
  | "queue"
  | "cancel"
  | "budget"
  | "compatibility"
  | "export"
  | "audit"
  | "methodology"
  | "drafts"
  | "restore";
const titles: Record<Kind, string> = {
  symbol: "Symbol contract & market context",
  schedule: "Review local schedule request",
  assignment: "Edit package market mandate",
  risk: "Review package risk controls",
  ticks: "Synthetic tick evidence",
  statistics: "Digit & volatility methodology",
  history: "Historical receipt evidence",
  performance: "Strategy-symbol performance",
  recommendation: "Review historical opportunity",
  calendar: "Illustrative market calendar",
  session: "Symbol session boundary",
  favorites: "Operator-local favorite symbols",
  queue: "Local scheduling outbox",
  cancel: "Cancel queued demo schedule",
  budget: "Capital exposure worksheet",
  compatibility: "Contract compatibility",
  export: "Export market workspace",
  audit: "Market session audit",
  methodology: "Data & execution boundaries",
  drafts: "Prepared schedule drafts",
  restore: "Restore default favorite list",
};
const wizards: Kind[] = [
  "schedule",
  "assignment",
  "risk",
  "recommendation",
  "cancel",
  "export",
  "restore",
];
function Price({ symbol }: { symbol: SymbolDTO }) {
  const last = symbol.ticks.at(-1)!.quote,
    n = useLiveCountUp(last);
  return (
    <strong className="mk-price mono">{n.toFixed(symbol.decimals)}</strong>
  );
}
function download(text: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ScheduleForm({
  data,
  defaults,
  onReview,
  onDraft,
}: {
  data: MarketBundle;
  defaults: ScheduleInput;
  onReview: (v: ScheduleInput) => void;
  onDraft: (v: ScheduleInput) => void;
}) {
  const action = useRef("review");
  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const r = scheduleSchema.safeParse(value);
        return r.success ? undefined : r.error.issues[0].message;
      },
    },
    onSubmit: ({ value }) =>
      action.current === "draft" ? onDraft(value) : onReview(value),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(s) => s.values}>
        {(v) => (
          <>
            <div className="mk-form-grid">
              {(["strategy", "contract", "unit", "mode"] as const).map((k) => (
                <label key={k} className="mk-field">
                  {k === "mode" ? "Execution intent" : k}
                  <select
                    className="form-select"
                    aria-label={`Schedule ${k}`}
                    value={v[k]}
                    onChange={(e) =>
                      form.setFieldValue(k, e.target.value as never)
                    }
                  >
                    {(k === "strategy"
                      ? strategies
                      : k === "contract"
                        ? data.symbols.find((s) => s.code === v.symbol)!
                            .contracts
                        : k === "unit"
                          ? ["ticks", "seconds"]
                          : ["now", "later"]
                    ).map((x) => (
                      <option key={x} value={x}>
                        {x === "now"
                          ? "Queue for immediate demo review"
                          : x === "later"
                            ? "Future UTC request"
                            : x}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {(["stake", "duration", "maxTrades"] as const).map((k) => (
                <label key={k} className="mk-field">
                  {k === "stake"
                    ? "Stake / USD"
                    : k === "duration"
                      ? "Contract duration"
                      : "Maximum trades"}
                  <input
                    className="form-control"
                    aria-label={`Schedule ${k}`}
                    required
                    type="number"
                    min={k === "stake" ? 0.35 : 1}
                    step={k === "stake" ? 0.01 : 1}
                    max={k === "stake" ? 1000 : k === "maxTrades" ? 20 : 3600}
                    value={v[k]}
                    onChange={(e) =>
                      form.setFieldValue(k, Number(e.target.value))
                    }
                  />
                </label>
              ))}
              {v.mode === "later" && (
                <label className="mk-field">
                  Requested UTC time
                  <input
                    className="form-control"
                    aria-label="Requested UTC time"
                    type="datetime-local"
                    required
                    value={v.time.slice(0, 16)}
                    onChange={(e) =>
                      form.setFieldValue("time", e.target.value + ":00Z")
                    }
                  />
                </label>
              )}
            </div>
            <div className="mk-package-options">
              {data.pools.map((p) => (
                <label className="mk-check" key={p.code}>
                  <input
                    type="checkbox"
                    checked={v.pools.includes(p.code)}
                    onChange={() =>
                      form.setFieldValue(
                        "pools",
                        v.pools.includes(p.code)
                          ? v.pools.filter((c) => c !== p.code)
                          : [...v.pools, p.code],
                      )
                    }
                  />
                  {p.code} ·{" "}
                  {p.symbols.includes(v.symbol)
                    ? "Assigned"
                    : "Not assigned — mandate review needed"}
                </label>
              ))}
            </div>
            <div className="mk-note">
              <b>Maximum modeled sequence exposure: {cash(budgetFor(v))}</b>
              <p>
                {v.strategy === "Martingale"
                  ? "Doubles stakes after each modeled loss."
                  : v.strategy === "Fibonacci"
                    ? "Uses the full modeled Fibonacci stake sequence."
                    : "Uses a fixed per-trade stake for this demo."}{" "}
                This is not expected profit. Split equally over selected
                packages; no cash is moved.
              </p>
            </div>
          </>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.errors}>
        {(e) => (
          <p role="status" className="text-loss">
            {e.map(String).join("; ")}
          </p>
        )}
      </form.Subscribe>
      <div className="mk-actions">
        <button
          type="submit"
          className="mk-btn"
          onClick={() => (action.current = "draft")}
        >
          Save prepared draft
        </button>
        <button
          type="submit"
          className="mk-btn mk-primary"
          onClick={() => (action.current = "review")}
        >
          Review schedule request
        </button>
      </div>
    </form>
  );
}
function MarketsDesk({ initial }: { initial: MarketBundle }) {
  const { data, mutation, storageNotice } = useMarkets(initial),
    { pushToast } = useOperatorUI();
  const [group, setGroup] = useState("Synthetics"),
    [search, setSearch] = useState(""),
    [favoriteOnly, setFavoriteOnly] = useState(false),
    [assignedOnly, setAssignedOnly] = useState(false),
    [selected, setSelected] = useState("R_10"),
    [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(null),
    [drawer, setDrawer] = useState<string | null>(null),
    [drawerTab, setDrawerTab] = useState("context"),
    [step, setStep] = useState(0),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(initial.asOf),
    [now, setNow] = useState(initial.asOf),
    [poolCode, setPoolCode] = useState(data.pools[0].code),
    [assignment, setAssignment] = useState<string[]>([]),
    [risk, setRisk] = useState(5),
    [format, setFormat] = useState("json"),
    [sort, setSort] = useState<SortingState>([{ id: "net", desc: true }]),
    [formKey, setFormKey] = useState(0),
    [drafts, setDrafts] = useState<ScheduleInput[]>([]),
    [draft, setDraft] = useState<ScheduleInput>({
      symbol: "R_10",
      strategy: "Fixed stake",
      stake: 35,
      maxTrades: 8,
      duration: 5,
      unit: "ticks",
      contract: "CALL",
      pools: ["PKG-01"],
      mode: "now",
      time: initial.asOf,
    });
  const overlay = !!modal || !!drawer;
  const symbol =
      data.symbols.find(
        (s) =>
          s.code ===
          (modal?.kind === "symbol" ||
          modal?.kind === "session" ||
          modal?.kind === "compatibility"
            ? modal.id
            : (drawer ?? selected)),
      ) ?? data.symbols[0],
    pool = data.pools.find((p) => p.code === poolCode)!,
    stats = tickStats(data.symbols.find((s) => s.code === selected)!),
    selectedSymbol = data.symbols.find((s) => s.code === selected)!;
  const rows = data.symbols.filter(
    (s) =>
      (group === "Favorites"
        ? data.favorites.includes(s.code)
        : s.group === group) &&
      `${s.code} ${s.name}`.toLowerCase().includes(search.toLowerCase()) &&
      (!favoriteOnly || data.favorites.includes(s.code)) &&
      (!assignedOnly || data.pools.some((p) => p.symbols.includes(s.code))),
  );
  const matrix = performance(data),
    columns = useMemo(
      () =>
        col.columns([
          col.accessor("symbol", { header: "Symbol" }),
          col.accessor("strategy", { header: "Strategy" }),
          col.accessor("count", { header: "Receipts" }),
          col.accessor("net", { header: "Net P/L" }),
          col.accessor("wins", { header: "Win rate" }),
        ]),
      [],
    );
  const table = useDeskTable({
    data: matrix,
    columns,
    state: { sorting: sort },
    onSortingChange: (u) => setSort(typeof u === "function" ? u(sort) : u),
  });
  const issues = scheduleIssues(data, draft, now);
  const callback = useRef(() => {});
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    callback.current = () => {
      if (!busy && !mutation.isPending) {
        setModal(null);
        setDrawer(null);
      }
    };
  }, [busy, mutation.isPending]);
  useEffect(() => {
    if (!overlay) return;
    const prior = document.activeElement as HTMLElement | null,
      old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const layer = document.querySelector(
      ".page-dashboard-markets .mk-local-layer",
    );
    const list = () =>
      Array.from(
        layer?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) ?? [],
      ).filter((n) => n.getClientRects().length);
    list()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") callback.current();
      if (e.key === "Tab") {
        const nodes = list();
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [overlay, modal?.kind, drawer]);
  function open(kind: Kind, id?: string) {
    setDrawer(null);
    setError("");
    setStep(0);
    setConfirmed(false);
    setNow(new Date().toISOString());
    if (kind === "assignment" || kind === "risk") {
      const p = data.pools.find((p) => p.code === id) ?? data.pools[0];
      setPoolCode(p.code);
      setAssignment(p.symbols);
      setRisk(p.drawdown);
    }
    setModal({ kind, id });
  }
  async function run(c: MarketCommand, keepOpen = false) {
    setError("");
    try {
      await mutation.mutateAsync(c);
      if (!keepOpen) setModal(null);
      pushToast({
        tone: "success",
        title:
          c.kind === "schedule"
            ? "Local schedule queued; no trade or backend job created"
            : "Market workspace updated locally",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to change workspace");
    }
  }
  function choose(code: string, strategy?: string) {
    const s = data.symbols.find((s) => s.code === code)!;
    setSelected(code);
    setDraft({
      symbol: code,
      strategy: strategies.includes(strategy as never)
        ? (strategy as ScheduleInput["strategy"])
        : "Fixed stake",
      stake: 35,
      maxTrades: 8,
      duration: s.group === "Synthetics" ? 5 : 60,
      unit: s.group === "Synthetics" ? "ticks" : "seconds",
      contract: strategy === "Even/Odd" ? "DIGITEVEN" : "CALL",
      pools: data.pools
        .filter((p) => p.symbols.includes(code))
        .map((p) => p.code),
      mode: "now",
      time: new Date(Date.now() + 3600000).toISOString(),
    });
    setFormKey((k) => k + 1);
    setModal(null);
    document
      .getElementById("market-scheduler")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  function detail(s: SymbolDTO) {
    const session = marketSession(s, clock),
      last = s.ticks.at(-1)!.quote;
    return (
      <>
        <div className="mk-dossier">
          <div>
            <small>Symbol</small>
            <b>{s.code}</b>
            <span>{s.name}</span>
          </div>
          <div>
            <small>Demo quote</small>
            <b className="mono">{last.toFixed(s.decimals)}</b>
            <span>
              {s.decimals} decimal places · {s.tickSeconds}s nominal ticks
            </span>
          </div>
          <div>
            <small>Illustrative session</small>
            <b>{session.open ? "Open" : "Closed"}</b>
            <span>{session.label}</span>
          </div>
        </div>
        <div className="mk-note">
          Snapshot quote, not a live or executable price. Product codes and
          session availability require provider discovery before production.
        </div>
      </>
    );
  }
  function facts() {
    return (
      <div className="mk-note">
        <b>
          {draft.symbol} · {draft.strategy} · {draft.contract}
        </b>
        <p>
          {cash(draft.stake)} starting stake · {draft.maxTrades} trades ·{" "}
          {draft.duration} {draft.unit} ·{" "}
          {draft.pools.join(" + ") || "No packages selected"}
        </p>
        Mode{" "}
        {draft.mode === "now"
          ? "Immediate local review"
          : stamp(draft.time) + " UTC"}{" "}
        · modeled exposure {cash(budgetFor(draft))}
      </div>
    );
  }
  async function exportData() {
    setBusy(true);
    try {
      if (format === "csv") {
        const quote = (s: unknown) =>
          '"' + String(s).replaceAll('"', '""') + '"';
        download(
          [
            ["code", "name", "group", "demo_quote", "decimals", "source_utc"],
            ...data.symbols.map((s) => [
              s.code,
              s.name,
              s.group,
              s.ticks.at(-1)!.quote,
              s.decimals,
              data.asOf,
            ]),
          ]
            .map((r) => r.map(quote).join(","))
            .join("\r\n"),
          "market-quotes.csv",
          "text/csv",
        );
      } else if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        let y = 20;
        const line = (text: string) => {
          for (const l of doc.splitTextToSize(text, 175)) {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.setFontSize(10);
            doc.text(l, 18, y);
            y += 7;
          }
        };
        line("tradeMO / Markets / SYNTHETIC WORKSPACE");
        line(`Base ${stamp(data.asOf)} UTC / revision ${data.revision}`);
        data.symbols.forEach((s) =>
          line(
            `${s.code} / ${s.name} / ${s.ticks.at(-1)!.quote.toFixed(s.decimals)} / demo only`,
          ),
        );
        line(
          "No live pricing, exchange calendar, execution, profit forecast or financial recommendation.",
        );
        doc.save("market-workspace.pdf");
      } else download(JSON.stringify(data, null, 2), "market-workspace.json");
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  function confirm() {
    return (
      <label className="mk-check mt-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I understand this uses synthetic data and local state only. No order,
        backend schedule, provider subscription or financial transfer is
        created.
      </label>
    );
  }
  function submit() {
    if (!modal) return;
    if (modal.kind === "schedule") void run({ kind: "schedule", input: draft });
    if (modal.kind === "assignment")
      void run({ kind: "assign", pool: poolCode, symbols: assignment });
    if (modal.kind === "risk")
      void run({
        kind: "risk",
        pool: poolCode,
        guardian: true,
        drawdown: risk,
      });
    if (modal.kind === "cancel") void run({ kind: "cancel", id: modal.id! });
    if (modal.kind === "restore")
      void run({ kind: "favorites", symbols: initial.favorites });
    if (modal.kind === "recommendation") {
      choose(
        modal.id ?? matrix[0].symbol,
        matrix.find((r) => r.symbol === modal.id)?.strategy,
      );
      return;
    }
    if (modal.kind === "export") void exportData();
  }
  const disabled = busy || mutation.isPending;
  const footer = (
    <>
      <button
        className="mk-btn"
        disabled={disabled}
        onClick={() => (step ? setStep(step - 1) : callback.current())}
      >
        {step ? "Back" : "Close"}
      </button>
      {modal && wizards.includes(modal.kind) && (
        <button
          className="mk-btn mk-primary"
          disabled={
            disabled ||
            (step === 2 && !confirmed) ||
            (modal.kind === "schedule" && issues.length > 0)
          }
          onClick={() => (step < 2 ? setStep(step + 1) : submit())}
        >
          {disabled
            ? "Working…"
            : step < 2
              ? "Continue →"
              : modal.kind === "export"
                ? "Download report"
                : modal.kind === "recommendation"
                  ? "Prepare editable schedule"
                  : "Confirm local action"}
        </button>
      )}
    </>
  );
  return (
    <div className="mk-canvas">
      <header className="mk-header">
        <div>
          <div className="mk-eyebrow">
            <span className="mk-tag mono">D-13</span>OPERATOR CONSOLE / MARKET
            DISCOVERY
          </div>
          <h1>Markets & symbols</h1>
          <p>
            Explore market context, inspect tick evidence, and align every
            schedule with its package mandate.
          </p>
        </div>
        <div className="mk-actions">
          <button className="mk-btn" onClick={() => open("favorites")}>
            <Icon name="target" size={14} />
            Favorites ({data.favorites.length})
          </button>
          <button className="mk-btn" onClick={() => open("queue")}>
            Local outbox (
            {data.schedules.filter((s) => s.state === "queued_demo").length})
          </button>
          <button className="mk-btn mk-primary" onClick={() => open("export")}>
            Export workspace
          </button>
        </div>
      </header>
      <div className="mk-demo">
        <span className="mk-demo-tag">DEMO MARKET EXPLORER</span>
        <span>
          Seeded quotes · illustrative calendars · no provider subscription or
          execution
        </span>
        <span className="mono">
          BASE {stamp(data.asOf)} UTC · REV {data.revision}
        </span>
        <button className="mk-link" onClick={() => open("methodology")}>
          Data boundaries ↗
        </button>
      </div>
      {storageNotice && <div className="mk-note">{storageNotice}</div>}
      {error && !modal && (
        <div className="mk-error" role="alert">
          {error}
        </div>
      )}
      <section className="mk-panel">
        <div className="mk-panel-head">
          <div>
            <span className="mk-section-code">01–02 / MARKET DIRECTORY</span>
            <h2>Find your market</h2>
            <p>
              Reference symbols for frontend workflow testing. Availability is
              not a verified provider product catalog.
            </p>
          </div>
          <span className="mk-tag mono">
            {rows.length} MATCHES / {data.symbols.length} SYMBOLS
          </span>
        </div>
        <nav className="mk-tabs" aria-label="Market groups">
          {[...groups, "Favorites"].map((g) => (
            <button
              className={group === g ? "active" : ""}
              key={g}
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </nav>
        <div className="mk-filterbar">
          <label className="mk-search">
            <Icon name="search" size={14} />
            <input
              aria-label="Search markets"
              placeholder="Symbol code or market name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="mk-check">
            <input
              type="checkbox"
              checked={favoriteOnly}
              onChange={(e) => setFavoriteOnly(e.target.checked)}
            />
            Favorites only
          </label>
          <label className="mk-check">
            <input
              type="checkbox"
              checked={assignedOnly}
              onChange={(e) => setAssignedOnly(e.target.checked)}
            />
            Assigned to packages
          </label>
          <button
            className="mk-link"
            onClick={() => {
              setSearch("");
              setFavoriteOnly(false);
              setAssignedOnly(false);
            }}
          >
            Reset market filters
          </button>
        </div>
        <div className="mk-symbol-grid">
          {rows.map((s, i) => {
            const last = s.ticks.at(-1)!.quote,
              change = ((last - s.previous) / s.previous) * 100,
              session = marketSession(s, clock);
            return (
              <article
                className={`mk-symbol ${selected === s.code ? "selected" : ""}`}
                key={s.code}
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <div className="mk-symbol-top">
                  <button
                    className="mk-link mono"
                    onClick={() => {
                      setSelected(s.code);
                      open("symbol", s.code);
                    }}
                  >
                    {s.code}
                  </button>
                  <button
                    className={`mk-star ${data.favorites.includes(s.code) ? "active" : ""}`}
                    aria-label={`Favorite ${s.code}`}
                    aria-pressed={data.favorites.includes(s.code)}
                    onClick={() =>
                      void run({ kind: "favorite", symbol: s.code })
                    }
                  >
                    {data.favorites.includes(s.code) ? "★" : "☆"}
                  </button>
                </div>
                <h3>{s.name}</h3>
                <Price symbol={s} />
                <span className={change >= 0 ? "text-win" : "text-loss"}>
                  {change >= 0 ? "▲ +" : "▼ "}
                  {change.toFixed(3)}% vs demo baseline
                </span>
                <div className="mk-symbol-state">
                  <span
                    className={`mk-status ${session.open ? "mk-open" : "mk-closed"}`}
                  >
                    {session.open ? "Open" : "Closed"}
                  </span>
                  <small>{s.tickSeconds}s nominal ticks</small>
                </div>
                <div className="mk-assignment-tags">
                  {data.pools
                    .filter((p) => p.symbols.includes(s.code))
                    .map((p) => (
                      <span key={p.code} className="mk-tag mono">
                        {p.code}
                      </span>
                    ))}
                  {!data.pools.some((p) => p.symbols.includes(s.code)) && (
                    <small>Not assigned</small>
                  )}
                </div>
                <div className="mk-symbol-actions">
                  <button className="mk-btn" onClick={() => choose(s.code)}>
                    Schedule
                  </button>
                  <button
                    className="mk-icon-button"
                    aria-label={`Inspect ${s.code}`}
                    onClick={() => {
                      setModal(null);
                      setSelected(s.code);
                      setDrawer(s.code);
                      setDrawerTab("context");
                    }}
                  >
                    <Icon name="panelRight" size={14} />
                  </button>
                  <button
                    className="mk-link"
                    onClick={() => {
                      setSelected(s.code);
                      document
                        .getElementById("market-ticks")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Ticks ↗
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {!rows.length && (
          <div className="mk-empty">
            <h3>No markets match this scope</h3>
            <button
              className="mk-btn"
              onClick={() => {
                setGroup("Synthetics");
                setSearch("");
                setFavoriteOnly(false);
                setAssignedOnly(false);
              }}
            >
              Restore market directory
            </button>
          </div>
        )}
      </section>
      <section className="mk-panel">
        <div className="mk-panel-head">
          <div>
            <span className="mk-section-code">03 / SESSION CALENDAR</span>
            <h2>Illustrative market sessions</h2>
            <p>
              Clock {stamp(clock)} UTC · weekday rules only; no holidays,
              maintenance breaks or verified exchange feeds.
            </p>
          </div>
          <button className="mk-btn" onClick={() => open("calendar")}>
            Calendar assumptions
          </button>
        </div>
        <div className="mk-session-grid">
          {groups.map((g) => {
            const s = data.symbols.find((s) => s.group === g)!,
              session = marketSession(s, clock),
              seconds = session.next
                ? Math.max(
                    0,
                    Math.floor(
                      (Date.parse(session.next) - Date.parse(clock)) / 1000,
                    ),
                  )
                : null;
            return (
              <button
                key={g}
                className="mk-session"
                onClick={() => open("session", s.code)}
              >
                <div>
                  <b>{g}</b>
                  <span
                    className={`mk-status ${session.open ? "mk-open" : "mk-closed"}`}
                  >
                    {session.open ? "Open" : "Closed"}
                  </span>
                </div>
                <p>{session.label}</p>
                <strong className="mono">
                  {seconds === null
                    ? "Continuous"
                    : `${session.open ? "Closes" : "Opens"} in ${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`}
                </strong>
              </button>
            );
          })}
        </div>
      </section>
      <section className="mk-panel">
        <div className="mk-panel-head">
          <div>
            <span className="mk-section-code">04 / PACKAGE MANDATES</span>
            <h2>Package market assignments</h2>
            <p>
              Independent D-13 reservations use the D-8 opening
              undeployed-capital snapshot; existing financial ledgers are never
              changed.
            </p>
          </div>
          <Link className="mk-btn" href="/dashboard/packages">
            Package desk ↗
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table mk-table mk-responsive">
            <thead>
              <tr>
                {[
                  "Package",
                  "Assigned symbols",
                  "Demo strategies",
                  "Risk guard",
                  "Drawdown cap",
                  "Unreserved demo capital",
                  "Actions",
                ].map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pools.map((p) => (
                <tr key={p.code}>
                  <td data-label="Package">
                    <b className="mono">{p.code}</b>
                    <small className="mk-cell-sub">{p.name}</small>
                  </td>
                  <td data-label="Assigned symbols">{p.symbols.join(", ")}</td>
                  <td data-label="Demo strategies">
                    {p.strategies.join(" · ")}
                  </td>
                  <td data-label="Risk guard">Enabled</td>
                  <td data-label="Drawdown cap">{p.drawdown}%</td>
                  <td data-label="Unreserved capital" className="mono">
                    {cash(
                      p.available -
                        data.schedules
                          .filter(
                            (q) =>
                              q.state === "queued_demo" &&
                              q.pools.includes(p.code),
                          )
                          .reduce((n, q) => n + q.budget / q.pools.length, 0),
                    )}
                  </td>
                  <td data-label="Actions">
                    <div className="mk-row-actions">
                      <button onClick={() => open("assignment", p.code)}>
                        Edit assignments
                      </button>
                      <button onClick={() => open("risk", p.code)}>
                        Risk controls
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mk-panel" id="market-scheduler">
        <div className="mk-panel-head">
          <div>
            <span className="mk-section-code">05 / PREPARE A SCHEDULE</span>
            <h2>Quick schedule · {draft.symbol}</h2>
            <p>
              Validate contract, session, package mandate and full modeled
              loss-sequence exposure before queuing a local request.
            </p>
          </div>
          <div className="mk-actions">
            <button
              className="mk-btn"
              onClick={() => open("compatibility", draft.symbol)}
            >
              Contract compatibility
            </button>
            <button className="mk-btn" onClick={() => open("drafts")}>
              Prepared drafts ({drafts.length})
            </button>
          </div>
        </div>
        <div className="mk-form-wrap">
          <ScheduleForm
            key={formKey}
            data={data}
            defaults={draft}
            onReview={(v) => {
              setDraft(v);
              open("schedule");
            }}
            onDraft={(v) => {
              setDrafts((list) => [...list, v]);
              pushToast({
                tone: "info",
                title:
                  "Prepared draft saved in-session; no reservation created",
              });
            }}
          />
        </div>
      </section>
      <section className="mk-panel" id="market-ticks">
        <div className="mk-panel-head">
          <div>
            <span className="mk-section-code">06 / TICK EVIDENCE</span>
            <h2>Tick preview · {selected}</h2>
            <p>
              Last 50 formatted last digits and 100-tick statistics. Descriptive
              observations do not predict a next digit or profitable contract.
              Generated timestamps use an advancing logical demo clock, not a
              live feed. Latest demo tick:{" "}
              {stamp(selectedSymbol.ticks.at(-1)!.time)} UTC.
            </p>
          </div>
          <div className="mk-actions">
            <select
              className="mk-select"
              aria-label="Tick preview symbol"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {data.symbols.map((s) => (
                <option key={s.code}>{s.code}</option>
              ))}
            </select>
            <button
              className="mk-btn"
              onClick={() => void run({ kind: "ticks", symbol: selected })}
            >
              Generate 5 demo ticks
            </button>
            <button className="mk-link" onClick={() => open("statistics")}>
              Methodology ↗
            </button>
          </div>
        </div>
        <div className="mk-tick-chart">
          <svg
            viewBox="0 0 800 150"
            role="img"
            aria-label={`${selected} synthetic 100-tick quote trace`}
            preserveAspectRatio="none"
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              points={selectedSymbol.ticks
                .map((t, i) => {
                  const values = selectedSymbol.ticks.map((t) => t.quote),
                    min = Math.min(...values),
                    span = Math.max(...values) - min;
                  return `${(i * 800) / 99},${130 - ((t.quote - min) / Math.max(0.000001, span)) * 110}`;
                })
                .join(" ")}
            />
          </svg>
        </div>
        <div className="mk-digit-strip" aria-label="Last 50 tick digits">
          {stats.digits.map((digit, i) => (
            <span key={i} className={digit % 2 ? "odd" : "even"}>
              {digit}
            </span>
          ))}
        </div>
        <div className="mk-tick-summary">
          <span>
            Even (50): <b>{stats.even.toFixed(1)}%</b>
          </span>
          <span>
            Odd (50): <b>{stats.odd.toFixed(1)}%</b>
          </span>
          <span>
            Quote σ (100):{" "}
            <b className="mono">
              {stats.std.toFixed(selectedSymbol.decimals + 2)}
            </b>
          </span>
          <span>Digits use {selectedSymbol.decimals} decimal places</span>
        </div>
        <div className="mk-histogram">
          {stats.histogram.map((count, i) => (
            <div key={i}>
              <b>{count}</b>
              <div>
                <span
                  style={{
                    height: `${(count / Math.max(1, ...stats.histogram)) * 100}%`,
                  }}
                />
              </div>
              <small>{i}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="mk-panel">
        <div className="mk-panel-head">
          <div>
            <span className="mk-section-code">07 / HISTORICAL PERFORMANCE</span>
            <h2>Strategy-symbol evidence</h2>
            <p>
              30-day source window ending {data.asOf.slice(0, 10)} UTC.
              Historical receipts, not AI predictions, forecasts or instructions
              to trade.
            </p>
          </div>
          <button className="mk-btn" onClick={() => open("performance")}>
            Receipt methodology
          </button>
        </div>
        <div className="mk-opportunities">
          {[matrix[0], matrix.at(-1)!].map((r, i) => (
            <article key={i}>
              <span className="mk-tag">
                {i === 0 ? "HIGHEST OBSERVED NET" : "LOWEST OBSERVED NET"}
              </span>
              <h3>
                {r.symbol} · {r.strategy}
              </h3>
              <strong
                className={`mono ${r.net >= 0 ? "text-win" : "text-loss"}`}
              >
                {cash(r.net)}
              </strong>
              <p>
                {r.count} receipts · {r.wins.toFixed(1)}% wins. No guarantee of
                future results.
              </p>
              <button
                className="mk-btn"
                onClick={() => open("recommendation", r.symbol)}
              >
                Review editable setup
              </button>
              <button
                className="mk-link"
                onClick={() => {
                  setSelected(r.symbol);
                  open("history");
                }}
              >
                Receipt evidence ↗
              </button>
            </article>
          ))}
        </div>
        <div className="table-responsive">
          <table className="table mk-table">
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
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map(({ original: r }) => (
                <tr key={r.symbol + r.strategy}>
                  <td className="mono">{r.symbol}</td>
                  <td>{r.strategy}</td>
                  <td>{r.count}</td>
                  <td
                    className={`mono ${r.net >= 0 ? "text-win" : "text-loss"}`}
                  >
                    {cash(r.net)}
                  </td>
                  <td>{r.wins.toFixed(1)}%</td>
                  <td>
                    <button
                      className="mk-link"
                      onClick={() => choose(r.symbol, r.strategy)}
                    >
                      Prepare setup ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <div className="mk-section-head">
          <h2>Market operations workbench</h2>
          <span className="mk-muted">DISCOVER / VALIDATE / PREPARE</span>
        </div>
        <div className="mk-workbench">
          {(
            [
              ["favorites", "Favorite symbol list"],
              ["queue", "Review local schedule outbox"],
              ["calendar", "Inspect session calendar"],
              ["budget", "Model capital exposure"],
              ["export", "Export market evidence"],
              ["audit", "Review local decisions"],
            ] as [Kind, string][]
          ).map(([kind, label]) => (
            <button key={kind} onClick={() => open(kind)}>
              <Icon name="layers" size={15} />
              {label}
              <Icon name="arrowRight" size={13} />
            </button>
          ))}
        </div>
      </section>
      <footer className="mk-footer">
        <span>
          FRONTEND MARKET DEMO / no real quotes, provider subscription, order
          submission or background schedule
        </span>
        <Link href="/dashboard/schedules">Trade scheduler ↗</Link>
        <Link href="/dashboard/trades">Trade receipts ↗</Link>
        <Link href="/dashboard/logs">Audit workspace ↗</Link>
        <button className="mk-link" onClick={() => open("restore")}>
          Restore default favorites ↗
        </button>
      </footer>
      {modal && (
        <div className="mk-local-layer">
          <DeskModalShell
            code="D13"
            eyebrow="MARKET OPERATIONS / DEMO WORKSPACE"
            title={titles[modal.kind]}
            subtitle="Validate against structured synthetic data. Production requires provider product discovery, authenticated scheduling and independently verified risk/capital controls."
            size="xl"
            onClose={() => callback.current()}
            steps={
              wizards.includes(modal.kind)
                ? [
                    "Scope & context",
                    "Review safeguards",
                    "Confirm local action",
                  ]
                : undefined
            }
            currentStep={step}
            footer={footer}
          >
            {error && (
              <div className="mk-error mb-3" role="alert">
                {error}
              </div>
            )}
            {modal.kind === "symbol" && (
              <>
                {detail(symbol)}
                <div className="mk-actions">
                  <button
                    className="mk-btn"
                    onClick={() => choose(symbol.code)}
                  >
                    Prepare schedule
                  </button>
                  <button
                    className="mk-btn"
                    onClick={() => open("session", symbol.code)}
                  >
                    Session boundary
                  </button>
                  <button
                    className="mk-btn"
                    onClick={() => open("compatibility", symbol.code)}
                  >
                    Contract rules
                  </button>
                  <button
                    className="mk-btn"
                    onClick={() => {
                      setSelected(symbol.code);
                      open("ticks");
                    }}
                  >
                    Tick evidence
                  </button>
                </div>
              </>
            )}
            {modal.kind === "schedule" && (
              <>
                {facts()}
                {step === 0 && (
                  <p>
                    Every selected package must explicitly allow the symbol.
                    Model validation checks contract/duration compatibility,
                    session timing, enabled risk controls and unreserved
                    capital. An unknown or unassigned symbol cannot be silently
                    traded.
                  </p>
                )}
                {step === 1 && (
                  <>
                    <h3>Modeled sequence, not expected profit</h3>
                    <p>
                      Maximum starting-sequence stake sum:{" "}
                      <b>{cash(budgetFor(draft))}</b>. Equal split:{" "}
                      {cash(budgetFor(draft) / Math.max(1, draft.pools.length))}{" "}
                      per selected package. Martingale/Fibonacci exposure
                      includes all modeled losses; no loss recovery or return is
                      guaranteed.
                    </p>
                    <p>
                      The request is queued locally only. “Immediate” does not
                      execute an order. A future request has no worker, durable
                      job or provider timer.
                    </p>
                  </>
                )}
                {issues.length > 0 && (
                  <div className="mk-error" role="alert">
                    {issues.map((s, i) => (
                      <p key={i}>{s}</p>
                    ))}
                    <button
                      className="mk-btn"
                      onClick={() => {
                        setModal(null);
                        document
                          .getElementById("market-scheduler")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Return to editable form
                    </button>
                  </div>
                )}
                {step === 2 && confirm()}
              </>
            )}
            {modal.kind === "assignment" && (
              <>
                {step === 0 && (
                  <>
                    <h3>
                      {pool.code} · {pool.name}
                    </h3>
                    <div className="mk-assignment-list">
                      {data.symbols.map((s) => (
                        <label className="mk-check" key={s.code}>
                          <input
                            type="checkbox"
                            checked={assignment.includes(s.code)}
                            onChange={() =>
                              setAssignment(
                                assignment.includes(s.code)
                                  ? assignment.filter((c) => c !== s.code)
                                  : [...assignment, s.code],
                              )
                            }
                          />
                          <span>
                            <b className="mono">{s.code}</b> · {s.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <p>
                      Keep at least one known market. Removing a symbol
                      referenced by a queued local schedule is blocked; cancel
                      the request first. Existing D-5/D-8 package data and real
                      mandates are not changed.
                    </p>
                    <div className="mk-note">
                      New mandate:{" "}
                      {assignment.join(", ") || "No symbols selected"}
                    </div>
                  </>
                )}
                {step === 2 && confirm()}
              </>
            )}
            {modal.kind === "risk" && (
              <>
                {step === 0 && (
                  <>
                    <h3>{pool.code}</h3>
                    <label className="mk-check">
                      <input type="checkbox" checked disabled />
                      Risk guard required (cannot disable)
                    </label>
                    <label className="mk-field mt-3">
                      Maximum drawdown / percent
                      <input
                        aria-label="Maximum drawdown percent"
                        className="form-control"
                        type="number"
                        min={1}
                        max={5}
                        step={0.1}
                        value={risk}
                        onChange={(e) => setRisk(Number(e.target.value))}
                      />
                    </label>
                  </>
                )}
                {step === 1 && (
                  <div className="mk-note">
                    Local cap {risk}% · no live equity feed, drawdown monitor or
                    automatic stop exists. Production must enforce controls on
                    the execution server; a UI toggle cannot protect real
                    capital.
                  </div>
                )}
                {step === 2 && confirm()}
              </>
            )}
            {["ticks", "statistics"].includes(modal.kind) && (
              <>
                <h3>
                  {selected} · {stats.count} synthetic observations
                </h3>
                <div className="mk-note">
                  Last digits come from each quote formatted to its declared pip
                  precision. Even/odd percentages use the last 50 observations;
                  frequencies and population standard deviation use the last
                  100. Quote σ is in price units, not annualized financial
                  volatility or a next-digit probability.
                </div>
                <p>
                  Even {stats.even.toFixed(1)}% · Odd {stats.odd.toFixed(1)}% ·
                  σ {stats.std.toFixed(selectedSymbol.decimals + 2)}
                </p>
                <pre className="mk-json">{JSON.stringify(stats, null, 2)}</pre>
                <button
                  className="mk-btn"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        {
                          mode: "demo",
                          symbol: selected,
                          ticks: selectedSymbol.ticks,
                          statistics: stats,
                        },
                        null,
                        2,
                      ),
                      `${selected}-tick-evidence.json`,
                    )
                  }
                >
                  Download tick evidence
                </button>
                <button className="mk-btn ms-2" onClick={() => open("history")}>
                  Historical trade receipts
                </button>
              </>
            )}
            {["history", "performance"].includes(modal.kind) && (
              <>
                <h3>
                  {modal.kind === "history"
                    ? selected
                    : "30-day strategy-symbol observations"}
                </h3>
                <p>
                  Receipts come from the existing D-4 synthetic ledger. P/L and
                  win rates are descriptive; they do not imply suitability,
                  future returns, or an optimal trading strategy. Sequence risk
                  and variance can dominate a win percentage.
                </p>
                <div className="mk-evidence-list">
                  {matrix
                    .filter(
                      (r) => modal.kind !== "history" || r.symbol === selected,
                    )
                    .map((r) => (
                      <div className="mk-record" key={r.symbol + r.strategy}>
                        <div>
                          <b>
                            {r.symbol} · {r.strategy}
                          </b>
                          <small>
                            {r.count} receipts · {r.wins.toFixed(1)}% win rate
                          </small>
                        </div>
                        <span className="mono">{cash(r.net)}</span>
                        <button
                          className="mk-link"
                          onClick={() => choose(r.symbol, r.strategy)}
                        >
                          Editable setup ↗
                        </button>
                      </div>
                    ))}
                </div>
                {modal.kind === "history" &&
                  !matrix.some((r) => r.symbol === selected) && (
                    <div className="mk-note">
                      No trade receipts for this reference symbol. No
                      performance is fabricated.
                    </div>
                  )}
                <Link className="mk-btn mt-3" href="/dashboard/trades">
                  Full trade ledger ↗
                </Link>
              </>
            )}
            {modal.kind === "recommendation" && (
              <>
                {step < 2 && (
                  <>
                    <h3>{modal.id} · historical context</h3>
                    {matrix
                      .filter((r) => r.symbol === modal.id)
                      .map((r) => (
                        <p key={r.strategy}>
                          {r.strategy}: {cash(r.net)} over {r.count} receipts ·{" "}
                          {r.wins.toFixed(1)}% wins
                        </p>
                      ))}
                    <div className="mk-note">
                      This is a historical setup review, not an AI
                      recommendation or promise of profitability. The editable
                      form may require reducing trade count/stake, changing
                      contracts or assigning a package before it becomes
                      eligible.
                    </div>
                  </>
                )}
                {step === 1 && (
                  <p>
                    No automatic trade is scheduled by this flow. You will
                    return to a prefilled form and must complete a separate
                    schedule review.
                  </p>
                )}
                {step === 2 && confirm()}
              </>
            )}
            {["calendar", "session"].includes(modal.kind) && (
              <>
                {modal.kind === "session" && detail(symbol)}
                <div className="mk-note">
                  This illustrative calendar uses UTC weekdays and
                  America/New_York civil time for US reference indices,
                  including timezone daylight-saving offsets. Holidays, early
                  closes, provider maintenance, intraday halts and
                  product-specific availability are not modeled. Obtain a
                  verified provider/exchange calendar before live scheduling.
                </div>
                {groups.map((g) => (
                  <p key={g}>
                    <b>{g}</b> ·{" "}
                    {
                      marketSession(
                        data.symbols.find((s) => s.group === g)!,
                        clock,
                      ).label
                    }
                  </p>
                ))}
                <p className="mono">Calendar clock: {stamp(clock)} UTC</p>
              </>
            )}
            {modal.kind === "favorites" && (
              <>
                <p>
                  Saved in this browser under the demo operator identity.
                  Production must use the authenticated operator’s account and
                  authorized preference API. No data is shared across operators
                  by this demo.
                </p>
                <div className="mk-assignment-list">
                  {data.symbols.map((s) => (
                    <label className="mk-check" key={s.code}>
                      <input
                        type="checkbox"
                        checked={data.favorites.includes(s.code)}
                        onChange={() =>
                          void run({ kind: "favorite", symbol: s.code }, true)
                        }
                      />
                      {s.code} · {s.name}
                    </label>
                  ))}
                </div>
                <button
                  className="mk-btn mt-3"
                  onClick={() => {
                    setGroup("Favorites");
                    setSearch("");
                    setFavoriteOnly(false);
                    setAssignedOnly(false);
                    setModal(null);
                  }}
                >
                  Show favorite directory
                </button>
              </>
            )}
            {modal.kind === "queue" && (
              <>
                <p>
                  Local queued requests reserve only D-13 modeled capital. They
                  never create a D-2 schedule, provider order or real wallet
                  hold.
                </p>
                {data.schedules.map((q) => (
                  <div key={q.id} className="mk-record">
                    <div>
                      <b>
                        {q.symbol} · {q.strategy}
                      </b>
                      <small>
                        {q.id} · {q.state} · {stamp(q.time)} UTC
                      </small>
                      <p>
                        {cash(q.budget)} modeled exposure · {q.pools.join(", ")}
                      </p>
                    </div>
                    <button
                      className="mk-btn"
                      disabled={q.state !== "queued_demo"}
                      onClick={() => open("cancel", q.id)}
                    >
                      Review cancellation
                    </button>
                    <button
                      className="mk-link"
                      onClick={() =>
                        download(JSON.stringify(q, null, 2), `${q.id}.json`)
                      }
                    >
                      Export request ↗
                    </button>
                  </div>
                ))}
                {!data.schedules.length && (
                  <div className="mk-note">
                    No local requests have been queued. Prepare and review a
                    schedule in the inline form.
                  </div>
                )}
                <Link className="mk-btn mt-3" href="/dashboard/schedules">
                  Open independent scheduler ↗
                </Link>
              </>
            )}
            {modal.kind === "cancel" && (
              <>
                {step < 2 && (
                  <>
                    <h3>
                      {data.schedules.find((q) => q.id === modal.id)?.symbol}
                    </h3>
                    <p>
                      Cancellation retains this request’s record and releases
                      its modeled reservation exactly once. It does not recall
                      an order or modify the independent scheduler.
                    </p>
                    <pre className="mk-json">
                      {JSON.stringify(
                        data.schedules.find((q) => q.id === modal.id),
                        null,
                        2,
                      )}
                    </pre>
                  </>
                )}
                {step === 2 && confirm()}
              </>
            )}
            {modal.kind === "budget" && (
              <>
                {facts()}
                <p>
                  Fixed stake, Even/Odd and DCA use stake × max trades in this
                  simplified model. Martingale uses stake × (2^n − 1); Fibonacci
                  sums its complete modeled stake sequence. Real execution may
                  also require fees, currency conversion, slippage and margin
                  buffers, none of which this demo estimates.
                </p>
                <div className="mk-note">
                  A package’s opening available capital is reduced by all queued
                  local reservations using equal package shares. Cancelled
                  requests no longer reserve capital. Real capital is not
                  mutated or synchronized.
                </div>
                <Link className="mk-btn" href="/dashboard/funds">
                  Treasury source context ↗
                </Link>
              </>
            )}
            {modal.kind === "compatibility" && (
              <>
                {detail(
                  data.symbols.find((s) => s.code === modal.id) ?? symbol,
                )}
                <h3>Supported demo contracts</h3>
                <p>
                  {(
                    data.symbols.find((s) => s.code === modal.id) ?? symbol
                  ).contracts.join(" · ")}
                </p>
                <div className="mk-note">
                  Synthetic markets permit tick durations 1–10 and time
                  durations ≥60 seconds; nonsynthetic symbols require time
                  durations ≥60 seconds. Even/Odd strategies require synthetic
                  digit contracts. This simplified capability matrix is not a
                  verified broker contract specification.
                </div>
              </>
            )}
            {modal.kind === "export" && (
              <>
                {step === 0 && (
                  <label className="mk-field">
                    Workspace report format
                    <select
                      className="form-select"
                      aria-label="Workspace report format"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                    >
                      <option value="json">
                        JSON — structured workspace and tick evidence
                      </option>
                      <option value="csv">
                        CSV — all reference symbols and snapshot quotes
                      </option>
                      <option value="pdf">PDF — readable symbol summary</option>
                    </select>
                  </label>
                )}
                {step === 1 && (
                  <p>
                    Includes the full {data.symbols.length}-symbol workspace,
                    not only visible filters. All quotes, requests and mandate
                    changes are demo state. JSON includes schedule/audit
                    context; it is not provider-signed evidence.
                  </p>
                )}
                {step === 2 && confirm()}
              </>
            )}
            {modal.kind === "audit" && (
              <>
                <p>
                  Session changes are local only. Reload resets
                  assignments/reservations/ticks; only operator-local favorites
                  persist in browser storage.
                </p>
                {data.audit.map((a, i) => (
                  <div key={i} className="mk-record">
                    <div>
                      <b>{a.action}</b>
                      <small>{stamp(a.time)} UTC</small>
                      <p>{a.detail}</p>
                    </div>
                  </div>
                ))}
                {!data.audit.length && (
                  <div className="mk-note">
                    No local actions recorded in this session yet.
                  </div>
                )}
                <button
                  className="mk-btn mt-3"
                  onClick={() =>
                    download(
                      JSON.stringify(data.audit, null, 2),
                      "market-audit.json",
                    )
                  }
                >
                  Download session audit
                </button>
              </>
            )}
            {modal.kind === "drafts" && (
              <>
                <p>
                  Prepared form snapshots only, without capital reservation or
                  execution.
                </p>
                {drafts.map((v, i) => (
                  <div className="mk-record" key={i}>
                    <div>
                      <b>
                        {v.symbol} · {v.strategy}
                      </b>
                      <small>{cash(budgetFor(v))} modeled exposure</small>
                    </div>
                    <button
                      className="mk-btn"
                      onClick={() => {
                        setDraft(v);
                        setSelected(v.symbol);
                        setFormKey((k) => k + 1);
                        setModal(null);
                        document
                          .getElementById("market-scheduler")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Load editable draft
                    </button>
                  </div>
                ))}
                {!drafts.length && (
                  <div className="mk-note">
                    Use “Save prepared draft” in the inline form to retain an
                    editable setup for this session.
                  </div>
                )}
              </>
            )}
            {modal.kind === "methodology" && (
              <ul className="mk-methodology">
                <li>
                  All 28 catalog entries and their quotes are deterministic
                  reference fixtures. Product codes, tick cadence and
                  availability must come from authenticated provider discovery
                  in production.
                </li>
                <li>
                  Quote changes compare the last synthetic tick with a declared
                  demo baseline, not a verified daily close. Tick generation is
                  explicit, never represented as a live feed.
                </li>
                <li>
                  Session countdowns use a browser clock and illustrative
                  weekday rules; they are not reliable exchange-open signals.
                  New York civil-time offsets include DST, but holidays and
                  special sessions are absent.
                </li>
                <li>
                  Historical P/L uses existing D-4 trade receipts and a 30-day
                  UTC window anchored to the source snapshot. No
                  machine-learning prediction or guaranteed-return
                  recommendation is generated.
                </li>
                <li>
                  Local scheduling enforces compatibility, package assignment,
                  session timing and modeled stake-sequence capital. It does not
                  submit to existing scheduling POST endpoints or mutate real
                  cash.
                </li>
                <li>
                  Favorites persist in a demo-operator browser-storage
                  namespace. Authenticated preference storage, account switching
                  and revocation require backend implementation.
                </li>
              </ul>
            )}
            {modal.kind === "restore" && (
              <>
                {step < 2 && (
                  <p>
                    Replace this browser’s demo-operator favorite list with
                    R_10, R_75 and R_100. Other local assignments, drafts, tick
                    evidence and queued requests are retained.
                  </p>
                )}
                {step === 2 && confirm()}
              </>
            )}
          </DeskModalShell>
        </div>
      )}
      {drawer && (
        <div
          className="mk-local-layer mk-drawer-layer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) callback.current();
          }}
        >
          <aside
            className="mk-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Market right inspector"
          >
            <header>
              <div>
                <span className="mk-section-code">D13 / SYMBOL INSPECTOR</span>
                <h2>{symbol.code}</h2>
              </div>
              <button
                className="mk-icon-button"
                aria-label="Close market inspector"
                onClick={() => callback.current()}
              >
                <Icon name="close" size={17} />
              </button>
            </header>
            <nav>
              {["context", "contracts", "assignments"].map((t) => (
                <button
                  key={t}
                  className={drawerTab === t ? "active" : ""}
                  aria-pressed={drawerTab === t}
                  onClick={() => setDrawerTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="mk-drawer-body">
              {drawerTab === "context" && detail(symbol)}
              {drawerTab === "contracts" && (
                <>
                  <h3>{symbol.contracts.join(" · ")}</h3>
                  <p>
                    Capabilities are illustrative. Verify live contracts, legal
                    eligibility, duration limits and minimum stake server-side
                    before execution.
                  </p>
                  <button
                    className="mk-btn"
                    onClick={() => open("compatibility", symbol.code)}
                  >
                    Full compatibility review
                  </button>
                </>
              )}
              {drawerTab === "assignments" &&
                data.pools.map((p) => (
                  <div className="mk-record" key={p.code}>
                    <div>
                      <b>{p.code}</b>
                      <small>
                        {p.symbols.includes(symbol.code)
                          ? "Assigned"
                          : "Not assigned"}{" "}
                        · guard enabled · {p.drawdown}% cap
                      </small>
                    </div>
                    <button
                      className="mk-link"
                      onClick={() => open("assignment", p.code)}
                    >
                      Edit mandate ↗
                    </button>
                  </div>
                ))}
            </div>
            <footer>
              <button
                className="mk-btn"
                onClick={() => open("symbol", symbol.code)}
              >
                Full context
              </button>
              <button
                className="mk-btn mk-primary"
                onClick={() => {
                  setDrawer(null);
                  choose(symbol.code);
                }}
              >
                Prepare schedule
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
export function MarketsPage({
  operatorBundle,
  initial,
}: {
  operatorBundle: OperatorBundleProps;
  initial: MarketBundle;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-markets" bundle={operatorBundle}>
      {() => <MarketsDesk initial={initial} />}
    </OperatorShell>
  );
}
