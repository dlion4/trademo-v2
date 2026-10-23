"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  OperatorShell,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon } from "@/components/icons";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import { useBots } from "@/lib/bots/use-bots";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import {
  botStats,
  botStrategies,
  symbols,
  configIssues,
  paramsDefaults,
  guardianSchema,
  ruleSchema,
  notificationSchema,
  evaluateRule,
  type BotWorkspace,
  type BotConfig,
  type BotCommand,
  type AutomationRule,
  type Bot,
} from "@/lib/bots/model";
import { BotConfigForm } from "./bot-config-form";
import { ScriptEditor } from "./script-editor";
const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v,
  );
const date = (s: string) => s.replace("T", " ").slice(0, 19) + " UTC";
type Kind =
  | "create"
  | "control"
  | "config"
  | "test"
  | "guardian"
  | "triggers"
  | "rule"
  | "deleteRule"
  | "simulate"
  | "script"
  | "deleteScript"
  | "attach"
  | "preferences"
  | "notification"
  | "performance"
  | "receipts"
  | "allocations"
  | "risk"
  | "audit"
  | "export"
  | "halt"
  | "help"
  | "deleteBot";
const titles: Record<Kind, string> = {
  create: "Create operator bot",
  control: "Review bot lifecycle action",
  config: "Review saved configuration",
  test: "One-trade dry-run plan",
  guardian: "Edit global Guardian policy",
  triggers: "Guardian trigger history",
  rule: "Automation rule builder",
  deleteRule: "Remove automation rule",
  simulate: "Evaluate a rule scenario",
  script: "JavaScript strategy workspace",
  deleteScript: "Delete strategy source",
  attach: "Attach script to operator bot",
  preferences: "Operator notification preferences",
  notification: "Notification evidence & action",
  performance: "Bot performance methodology",
  receipts: "Bot trade receipt evidence",
  allocations: "Package capital reservation ledger",
  risk: "Risk limit methodology",
  audit: "Local automation decisions",
  export: "Export automation workspace",
  halt: "Emergency local halt",
  help: "Execution & integration boundaries",
  deleteBot: "Remove operator bot",
};
const wizards: Kind[] = [
  "create",
  "control",
  "config",
  "test",
  "guardian",
  "rule",
  "deleteRule",
  "deleteScript",
  "attach",
  "preferences",
  "export",
  "halt",
  "deleteBot",
];
type PerformanceRow = {
  id: string;
  name: string;
  runtime: number;
  count: number;
  wins: number;
  net: number;
  average: number;
  best: number;
  worst: number;
};
const col = createDeskColumnHelper<PerformanceRow>();
function Section({
  number,
  title,
  description,
  actions,
  children,
  id,
}: {
  number: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="bt-panel" id={id}>
      <div className="bt-panel-head">
        <div>
          <span className="bt-section-code">{number}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
function BotDesk({ initial }: { initial: BotWorkspace }) {
  const { data, mutation } = useBots(initial),
    { pushToast } = useOperatorUI();
  const [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(null),
    [drawer, setDrawer] = useState<string | null>(null),
    [drawerTab, setDrawerTab] = useState("overview"),
    [expanded, setExpanded] = useState<string | null>(null),
    [step, setStep] = useState(0),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState<SortingState>([{ id: "net", desc: true }]),
    [action, setAction] = useState<"start" | "pause" | "stop" | "restart">(
      "pause",
    ),
    [draft, setDraft] = useState<BotConfig>(initial.bots[0].config),
    [name, setName] = useState("Bot-Foxtrot"),
    [policy, setPolicy] = useState(initial.guardian),
    [preferences, setPreferences] = useState(initial.preferences),
    [rule, setRule] = useState<
      Omit<AutomationRule, "id" | "lastTriggered" | "triggerCount">
    >({ ...initial.rules[0], name: "New loss safeguard" }),
    [scriptName, setScriptName] = useState("New-Strategy.js"),
    [code, setCode] = useState(initial.scripts[0].code),
    [attachBot, setAttachBot] = useState("bot_5"),
    [format, setFormat] = useState("json"),
    [scenarioValue, setScenarioValue] = useState(3),
    [scenarioTime, setScenarioTime] = useState("17:00"),
    [scenarioWeekday, setScenarioWeekday] = useState(true),
    [scenarioResult, setScenarioResult] = useState<ReturnType<
      typeof evaluateRule
    > | null>(null),
    [notificationCategory, setNotificationCategory] = useState("all"),
    [unreadOnly, setUnreadOnly] = useState(false),
    [receiptPage, setReceiptPage] = useState(1);
  const activeId = modal?.id ?? drawer ?? data.bots[0]?.id;
  const bot = data.bots.find((b) => b.id === activeId) ?? data.bots[0];
  const script = data.scripts.find((s) => s.id === modal?.id);
  const selectedRule = data.rules.find((r) => r.id === modal?.id);
  const overlay = !!modal || !!drawer;
  const disabled = busy || mutation.isPending;
  const unread = data.notifications.filter((n) => !n.read).length;
  const unreadCount = useLiveCountUp(unread);
  const callback = useRef(() => {});
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
    const root = document.querySelector(".page-dashboard-bots .bt-local-layer");
    const nodes = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((e) => e.getClientRects().length);
    nodes()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (
          (e.target as HTMLElement).closest(".monaco-editor") &&
          document.querySelector(".suggest-widget.visible")
        )
          return;
        callback.current();
      }
      if (e.key === "Tab") {
        const ns = nodes();
        if (e.shiftKey && document.activeElement === ns[0]) {
          e.preventDefault();
          ns.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === ns.at(-1)) {
          e.preventDefault();
          ns[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      prior?.focus();
    };
  }, [overlay, modal?.kind, drawer]);
  useEffect(() => {
    if (!modal || step === 0) return;
    document
      .querySelector<HTMLElement>(
        ".page-dashboard-bots .bt-local-layer button:not(:disabled)",
      )
      ?.focus();
  }, [step, modal]);
  const rows = data.bots.filter(
    (b) =>
      (status === "all" || b.status === status) &&
      `${b.name} ${b.config.symbol} ${b.config.strategy}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const comparison = data.bots.map((b) => ({
    id: b.id,
    name: b.name,
    runtime: b.runtimeMinutes,
    ...botStats(data, b.id),
  }));
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("name", { header: "Bot" }),
        col.accessor("count", { header: "Trades" }),
        col.accessor("wins", { header: "Win %" }),
        col.accessor("net", { header: "Net P/L" }),
        col.accessor("average", { header: "Avg stake" }),
        col.accessor("best", { header: "Best" }),
        col.accessor("worst", { header: "Worst" }),
        col.accessor("runtime", { header: "Runtime / min" }),
      ]),
    [],
  );
  const table = useDeskTable({
    data: comparison,
    columns,
    state: { sorting: sort },
    onSortingChange: (u) => setSort(typeof u === "function" ? u(sort) : u),
  });
  function open(kind: Kind, id?: string) {
    setDrawer(null);
    setStep(0);
    setConfirmed(false);
    setError("");
    setReceiptPage(1);
    setScenarioResult(null);
    if (kind === "guardian") setPolicy(data.guardian);
    if (kind === "preferences") setPreferences(data.preferences);
    if (kind === "create") {
      setName("Bot-Foxtrot");
      setDraft({
        ...structuredClone(initial.bots[0].config),
        allocations: [{ pool: data.pools[0].code, percent: 100 }],
        capitalBudget: 1000,
      });
    }
    if (kind === "rule")
      setRule(
        id
          ? { ...data.rules.find((r) => r.id === id)! }
          : {
              name: "New loss safeguard",
              metric: "consecutive_losses",
              operator: ">=",
              threshold: 3,
              time: "17:00",
              action: "pause_bot",
              botId: data.bots[0]?.id ?? "",
              minutes: 5,
              enabled: true,
            },
      );
    if (kind === "script") {
      const source = data.scripts.find((s) => s.id === id);
      setScriptName(source?.name ?? "New-Strategy.js");
      setCode(source?.code ?? initial.scripts[0].code);
    }
    if (kind === "attach")
      setAttachBot(
        data.bots.find((b) => ["idle", "stopped"].includes(b.status))?.id ??
          data.bots[0]?.id ??
          "",
      );
    setModal({ kind, id });
  }
  async function run(command: BotCommand, keepOpen = false) {
    setError("");
    try {
      await mutation.mutateAsync(command);
      if (!keepOpen) setModal(null);
      pushToast({
        tone: "success",
        title:
          command.kind === "dryRun"
            ? "Validated trade plan recorded; no script or trade executed"
            : "Automation workspace updated locally",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Local action failed");
    }
  }
  function control(b: Bot, a: typeof action) {
    setAction(a);
    open("control", b.id);
  }
  function download(
    value: string,
    filename: string,
    type = "application/json",
  ) {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportData() {
    setBusy(true);
    try {
      if (format === "json")
        download(
          JSON.stringify(data, null, 2),
          "bot-automation-workspace.json",
        );
      else if (format === "csv") {
        const escape = (v: unknown) =>
          '"' + String(v).replaceAll('"', '""') + '"';
        download(
          [
            [
              "bot",
              "status",
              "symbol",
              "strategy",
              "receipts",
              "net_pl",
              "source_utc",
            ],
            ...data.bots.map((b) => [
              b.name,
              b.status,
              b.config.symbol,
              b.config.strategy,
              botStats(data, b.id).count,
              botStats(data, b.id).net,
              data.asOf,
            ]),
          ]
            .map((r) => r.map(escape).join(","))
            .join("\r\n"),
          "bot-performance.csv",
          "text/csv",
        );
      } else {
        const { jsPDF } = await import("jspdf"),
          doc = new jsPDF();
        let y = 20;
        for (const line of [
          "tradeMO / Bot & Automation / DEMO",
          `Source ${data.asOf} / revision ${data.revision}`,
          "Historical D-4 receipts, not live bot output.",
          ...comparison.map(
            (b) =>
              `${b.name}: ${b.count} receipts / net ${money(b.net)} / ${b.wins.toFixed(1)}% wins`,
          ),
          "Local policy only. No provider execution, delivery or capital movement.",
        ]) {
          for (const text of doc.splitTextToSize(line, 170)) {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.setFontSize(10);
            doc.text(text, 18, y);
            y += 8;
          }
        }
        doc.save("bot-automation-summary.pdf");
      }
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  const configErrors =
    modal?.kind === "config" || modal?.kind === "create"
      ? configIssues(
          data,
          modal.id ?? "new",
          draft,
          bot?.status === "paused" && modal.kind === "config",
        )
      : [];
  let blocking = "";
  if (modal?.kind === "guardian") {
    const p = guardianSchema.safeParse(policy);
    if (!p.success) blocking = p.error.issues[0].message;
  }
  if (modal?.kind === "rule") {
    const p = ruleSchema.safeParse(rule);
    if (!p.success) blocking = p.error.issues[0].message;
  }
  if (modal?.kind === "preferences") {
    const p = notificationSchema.safeParse(preferences);
    if (!p.success) blocking = p.error.issues[0].message;
  }
  if (modal?.kind === "create" && name.trim().length < 3)
    blocking = "Name must contain at least three characters";
  if (configErrors.length) blocking = configErrors[0];
  const confirm = (
    <label className="bt-check mt-3">
      <input
        type="checkbox"
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
      />
      I understand this changes local demo state only. No Deriv order, worker,
      message delivery, financial transfer or background automation is created.
    </label>
  );
  function submit() {
    if (!modal) return;
    switch (modal.kind) {
      case "control":
        return void run({ kind: "control", id: modal.id!, action });
      case "config":
        return void run({ kind: "config", id: modal.id!, config: draft });
      case "create":
        return void run({ kind: "create", name, config: draft });
      case "test":
        return void run({ kind: "dryRun", id: modal.id! });
      case "guardian":
        return void run({ kind: "guardian", value: policy });
      case "rule":
        return void run({ kind: "rule", id: modal.id ?? null, value: rule });
      case "deleteRule":
        return void run({ kind: "deleteRule", id: modal.id! });
      case "deleteScript":
        return void run({ kind: "deleteScript", id: modal.id! });
      case "attach":
        return void run({ kind: "attach", id: modal.id!, botId: attachBot });
      case "preferences":
        return void run({ kind: "preferences", value: preferences });
      case "halt":
        return void run({ kind: "halt" });
      case "deleteBot":
        return void run({ kind: "deleteBot", id: modal.id! });
      case "export":
        return void exportData();
    }
  }
  const modalFooter = (
    <>
      <button
        className="bt-btn"
        disabled={disabled}
        onClick={() => (step ? setStep(step - 1) : callback.current())}
      >
        {step ? "Back" : "Close"}
      </button>
      {modal && wizards.includes(modal.kind) && (
        <button
          className="bt-btn bt-primary"
          disabled={disabled || !!blocking || (step === 2 && !confirmed)}
          onClick={() => (step < 2 ? setStep(step + 1) : submit())}
        >
          {disabled
            ? "Working…"
            : step < 2
              ? "Continue →"
              : modal.kind === "export"
                ? "Download report"
                : modal.kind === "test"
                  ? "Record validated plan"
                  : "Confirm local action"}
        </button>
      )}
      {modal?.kind === "script" && (
        <button
          className="bt-btn bt-primary"
          disabled={
            disabled ||
            scriptName.length < 3 ||
            code.length < 20 ||
            code.length > 50000
          }
          onClick={() =>
            void run({
              kind: "script",
              id: modal.id ?? null,
              name: scriptName,
              code,
            })
          }
        >
          Save source locally
        </button>
      )}
    </>
  );
  function overview(b: Bot) {
    const stats = botStats(data, b.id);
    return (
      <>
        <div className="bt-dossier">
          <div>
            <small>CONFIGURED INSTRUMENT</small>
            <b className="mono">
              {b.config.symbol} / {b.config.contract}
            </b>
            <p>{b.config.strategy}</p>
          </div>
          <div>
            <small>LOCAL STATE</small>
            <b>
              <span className={`bt-dot ${b.status}`} />
              {b.status}
            </b>
            <p>{b.reason}</p>
          </div>
          <div>
            <small>HISTORICAL RECEIPTS</small>
            <b>
              {stats.count} trades · {money(stats.net)}
            </b>
            <p>D-4 ledger totals; not this runtime’s output</p>
          </div>
          <div>
            <small>CAPITAL BUDGET</small>
            <b className="mono">{money(b.config.capitalBudget)}</b>
            <p>
              {b.config.allocations
                .map((a) => `${a.pool} ${a.percent}%`)
                .join(" · ") || "No packages assigned"}
            </p>
          </div>
        </div>
        {b.cooldownUntil && (
          <div className="bt-note">
            Source cooldown until {date(b.cooldownUntil)}. A passed timestamp
            never automatically resumes a bot; manual validation is required.
          </div>
        )}
      </>
    );
  }
  function receiptEvidence(id: string) {
    const receipts = data.receipts.filter((r) => r.botId === id),
      pages = Math.max(1, Math.ceil(receipts.length / 20));
    return (
      <>
        <p className="bt-muted">
          Existing D-4 historical receipts linked by bot ID; no trades are
          manufactured by control actions or dry runs.
        </p>
        <div className="table-responsive">
          <table className="table bt-table">
            <thead>
              <tr>
                {["Receipt / UTC", "Symbol", "Package", "Stake", "Net P/L"].map(
                  (t) => (
                    <th key={t}>{t}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {receipts
                .slice((receiptPage - 1) * 20, receiptPage * 20)
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b className="mono">{r.id}</b>
                      <small className="bt-cell-sub">
                        {date(r.executedAt)}
                      </small>
                    </td>
                    <td>{r.symbol}</td>
                    <td>{r.packageCode}</td>
                    <td>{money(r.stake)}</td>
                    <td className={r.profit >= 0 ? "text-win" : "text-loss"}>
                      {money(r.profit)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!receipts.length && (
          <div className="bt-note">
            No historical receipts exist for this bot.
          </div>
        )}
        <div className="bt-actions">
          <button
            className="bt-btn"
            disabled={receiptPage === 1}
            onClick={() => setReceiptPage((p) => p - 1)}
          >
            Previous receipts
          </button>
          <span className="bt-muted">
            Page {receiptPage} / {pages} · {receipts.length} receipts
          </span>
          <button
            className="bt-btn"
            disabled={receiptPage >= pages}
            onClick={() => setReceiptPage((p) => p + 1)}
          >
            Next receipts
          </button>
          <button
            className="bt-link"
            onClick={() =>
              download(JSON.stringify(receipts, null, 2), `${id}-receipts.json`)
            }
          >
            Export bot receipts
          </button>
        </div>
      </>
    );
  }
  return (
    <div className="bt-canvas">
      <header className="bt-header">
        <div>
          <div className="bt-eyebrow">
            <span className="bt-tag mono">D-14</span>OPERATOR CONSOLE /
            EXECUTION POLICY
          </div>
          <h1>Bots & automation</h1>
          <p>
            Configure the execution desk. Define the boundaries before you
            automate the next move.
          </p>
        </div>
        <div className="bt-actions">
          <button className="bt-btn" onClick={() => open("allocations")}>
            Capital ledger
          </button>
          <button className="bt-btn" onClick={() => open("halt")}>
            Halt the desk
          </button>
          <button className="bt-btn bt-primary" onClick={() => open("create")}>
            <Icon name="plus" size={13} />
            New operator bot
          </button>
        </div>
      </header>
      <div className="bt-mode-banner">
        <div>
          <b>FRONTEND AUTOMATION WORKSPACE</b>
          <span>
            Seeded states · no provider worker connected · no scripts executed
          </span>
        </div>
        <div className="bt-actions">
          <span className="mono">
            BASE {date(data.asOf)} · REV {data.revision}
          </span>
          <button className="bt-link" onClick={() => open("help")}>
            Execution boundaries ↗
          </button>
        </div>
      </div>
      <div className="bt-kpis">
        {[
          [
            "RUNNING SNAPSHOT",
            data.bots.filter((b) => b.status === "running").length,
            "bots",
          ],
          [
            "GUARDIAN REVIEW",
            data.triggers.filter((t) => !t.resolved).length,
            "source alerts",
          ],
          [
            "ENABLED RULES",
            data.rules.filter((r) => r.enabled).length,
            "local definitions",
          ],
          ["UNREAD IN-APP", Math.round(unreadCount), "seeded observations"],
        ].map(([label, value, sub]) => (
          <div key={label}>
            <span>{label}</span>
            <strong className="mono">{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <Section
        number="01 / OPERATOR BOT FLEET"
        title="Execution runners"
        description="Status and runtime are source observations. Controls update this workspace only; receipt totals reconcile to the historical ledger."
        actions={
          <div className="bt-actions">
            <label className="bt-search">
              <Icon name="search" size={14} />
              <input
                aria-label="Search bots"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Bot, symbol or strategy…"
              />
            </label>
            <select
              className="bt-select"
              aria-label="Bot status filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["all", "running", "paused", "stopped", "idle"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All states" : s}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="bt-bot-grid">
          {rows.map((b, i) => {
            const stats = botStats(data, b.id);
            return (
              <article
                className="bt-bot"
                style={{ animationDelay: `${i * 60}ms` }}
                key={b.id}
              >
                <div className="bt-bot-top">
                  <button
                    className="bt-link bt-bot-name"
                    onClick={() => {
                      setDrawer(b.id);
                      setDrawerTab("overview");
                      setReceiptPage(1);
                    }}
                  >
                    {b.name}
                  </button>
                  <span className={`bt-status ${b.status}`}>
                    <span className={`bt-dot ${b.status}`} />
                    {b.status}
                  </span>
                </div>
                <div className="bt-instrument">
                  <strong className="mono">{b.config.symbol}</strong>
                  <span>{b.config.strategy}</span>
                </div>
                <div className="bt-package-tags">
                  {b.config.allocations.length ? (
                    b.config.allocations.map((a) => (
                      <span className="bt-tag mono" key={a.pool}>
                        {a.pool} / {a.percent}%
                      </span>
                    ))
                  ) : (
                    <span className="bt-muted">No package assignment</span>
                  )}
                </div>
                <div className="bt-bot-metrics">
                  <div>
                    <small>Receipt net P/L</small>
                    <strong
                      className={`mono ${stats.net >= 0 ? "text-win" : "text-loss"}`}
                    >
                      {money(stats.net)}
                    </strong>
                  </div>
                  <div>
                    <small>Trades / wins</small>
                    <b>
                      {stats.count} /{" "}
                      {stats.count ? stats.wins.toFixed(1) + "%" : "—"}
                    </b>
                  </div>
                  <div>
                    <small>Source runtime</small>
                    <b className="mono">
                      {Math.floor(b.runtimeMinutes / 60)}h{" "}
                      {b.runtimeMinutes % 60}m
                    </b>
                  </div>
                </div>
                <p className="bt-bot-reason">{b.reason}</p>
                {b.cooldownUntil && (
                  <small className="bt-muted">
                    Cooldown timestamp: {date(b.cooldownUntil)}
                  </small>
                )}
                <div className="bt-bot-actions">
                  {b.status === "running" ? (
                    <button
                      className="bt-btn"
                      onClick={() => control(b, "pause")}
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      className="bt-btn"
                      onClick={() => control(b, "start")}
                    >
                      {b.status === "paused" ? "Resume" : "Start"}
                    </button>
                  )}
                  <button
                    className="bt-btn"
                    disabled={b.status === "stopped"}
                    onClick={() => control(b, "stop")}
                  >
                    Stop
                  </button>
                  <button
                    className="bt-btn"
                    onClick={() => control(b, "restart")}
                  >
                    Restart
                  </button>
                  <button
                    className={`bt-btn ${expanded === b.id ? "active" : ""}`}
                    aria-expanded={expanded === b.id}
                    onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                  >
                    Config
                  </button>
                  <button
                    className="bt-link"
                    onClick={() => open("receipts", b.id)}
                  >
                    View trades ↗
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {!rows.length && (
          <div className="bt-empty">
            <h3>No bots match this scope</h3>
            <button
              className="bt-btn"
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              Reset bot filters
            </button>
          </div>
        )}
      </Section>
      <Section
        number="02 / CONFIGURATION STATION"
        title={
          expanded
            ? `Configure ${data.bots.find((b) => b.id === expanded)?.name ?? "bot"}`
            : "Runner configuration"
        }
        description="Instrument, stake progression, package shares and risk controls. Pause or stop before applying changes."
        actions={
          <div className="bt-actions">
            <button className="bt-btn" onClick={() => open("risk")}>
              Risk methodology
            </button>
            <select
              aria-label="Select bot configuration"
              className="bt-select"
              value={expanded ?? ""}
              onChange={(e) => setExpanded(e.target.value || null)}
            >
              <option value="">Select a runner</option>
              {data.bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        }
        id="bot-config"
      >
        {expanded && data.bots.some((b) => b.id === expanded) ? (
          <div className="bt-config-expand">
            <BotConfigForm
              key={`${expanded}-${JSON.stringify(data.bots.find((b) => b.id === expanded)!.config)}`}
              data={data}
              botId={expanded}
              defaults={data.bots.find((b) => b.id === expanded)!.config}
              onReview={(c) => {
                setDraft(c);
                open("config", expanded);
              }}
              onTest={() => open("test", expanded)}
            />
          </div>
        ) : (
          <div className="bt-config-intro">
            <Icon name="sliders" size={22} />
            <div>
              <h3>A clear mandate for every runner</h3>
              <p>
                Choose a bot to edit its saved configuration. Full allocation
                percentages and modeled capital checks are reviewed before a
                change is applied.
              </p>
            </div>
            <button
              className="bt-btn"
              onClick={() => setExpanded(data.bots[0]?.id ?? null)}
            >
              Configure first runner
            </button>
          </div>
        )}
      </Section>
      <Section
        number="03 / AI GUARDIAN · RULE-BASED POLICY"
        title="Guardian control room"
        description="Deterministic policy settings, not an AI prediction. There is no live equity monitor or automatic enforcement in this frontend."
        actions={
          <div className="bt-actions">
            <button className="bt-btn" onClick={() => open("triggers")}>
              Full trigger history
            </button>
            <button
              className="bt-btn bt-primary"
              onClick={() => open("guardian")}
            >
              Edit Guardian rules
            </button>
          </div>
        }
      >
        <div className="bt-guardian">
          <div className="bt-guardian-state">
            <span className="bt-status paused">
              <span className="bt-dot paused" />
              SOURCE ALERT
            </span>
            <h3>Policy enabled · review outstanding</h3>
            <p>
              {data.triggers.filter((t) => !t.resolved).length} unresolved
              source observation. Timestamps passing does not clear a trigger or
              resume a bot.
            </p>
            <button className="bt-link" onClick={() => open("triggers")}>
              Review evidence ↗
            </button>
          </div>
          <dl className="bt-policy">
            <div>
              <dt>Odd/even loss threshold</dt>
              <dd>{data.guardian.oddEvenLosses}</dd>
            </div>
            <div>
              <dt>Other contract losses</dt>
              <dd>{data.guardian.digitLosses}</dd>
            </div>
            <div>
              <dt>Maximum bulk runs</dt>
              <dd>{data.guardian.bulkRuns}</dd>
            </div>
            <div>
              <dt>Package drawdown limit</dt>
              <dd>{data.guardian.drawdown}%</dd>
            </div>
            <div>
              <dt>Market rotation</dt>
              <dd>
                {data.guardian.rotation
                  ? `${data.guardian.rotationMinutes} min`
                  : "Off"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="bt-trigger-list">
          {data.triggers.map((t) => (
            <div className="bt-trigger" key={t.id}>
              <span className="mono">{t.time.slice(11, 16)}</span>
              <b className="mono">{t.pool}</b>
              <div>
                <b>{t.condition}</b>
                <small>{t.action}</small>
              </div>
              <span className="bt-tag">
                {t.resolved ? "HISTORICAL / RESOLVED" : "SOURCE REVIEW"}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section
        number="04 / CONDITIONAL AUTOMATION"
        title="Rules with explicit outcomes"
        description="Saved rule definitions do not run in the background. Financial completion always routes to a human distribution review."
        actions={
          <button className="bt-btn bt-primary" onClick={() => open("rule")}>
            + New rule
          </button>
        }
      >
        <div className="bt-rule-grid">
          {data.rules.map((r, i) => (
            <article
              className="bt-rule"
              key={r.id}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="bt-bot-top">
                <h3>{r.name}</h3>
                <button
                  className={`bt-toggle ${r.enabled ? "on" : ""}`}
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`Enable ${r.name}`}
                  disabled={disabled}
                  onClick={() => void run({ kind: "toggleRule", id: r.id })}
                >
                  <span />
                </button>
              </div>
              <p className="bt-rule-expression">
                <span>IF</span>{" "}
                {r.metric === "weekday_time"
                  ? `weekday at ${r.time} UTC`
                  : `${r.metric} ${r.operator} ${r.threshold}`}{" "}
                <span>THEN</span> {r.action.replaceAll("_", " ")}
                {r.action === "pause_bot" ? ` / ${r.minutes}min` : ""}
              </p>
              <small className="bt-muted">
                Source count {r.triggerCount} · last{" "}
                {r.lastTriggered ? date(r.lastTriggered) : "never observed"}
              </small>
              <div className="bt-actions mt-3">
                <button className="bt-link" onClick={() => open("rule", r.id)}>
                  Edit definition
                </button>
                <button
                  className="bt-link"
                  onClick={() => open("simulate", r.id)}
                >
                  Evaluate scenario
                </button>
                <button
                  className="bt-link"
                  onClick={() => open("deleteRule", r.id)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
        {!data.rules.length && (
          <div className="bt-note">
            No rules remain. Use New rule to define a local conditional policy.
          </div>
        )}
      </Section>
      <Section
        number="05 / HISTORICAL COMPARISON"
        title="Runner performance evidence"
        description="Full existing D-4 receipts grouped by bot ID, across all source dates. These figures are not returns generated by the runtime shown above."
        actions={
          <button className="bt-btn" onClick={() => open("performance")}>
            Calculation methodology
          </button>
        }
      >
        <div className="table-responsive">
          <table className="table bt-table bt-performance">
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
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map(({ original: r }) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="bt-link"
                      onClick={() => open("receipts", r.id)}
                    >
                      {r.name}
                    </button>
                  </td>
                  <td>{r.count}</td>
                  <td>{r.count ? r.wins.toFixed(1) + "%" : "—"}</td>
                  <td
                    className={`mono ${r.net >= 0 ? "text-win" : "text-loss"}`}
                  >
                    {money(r.net)}
                  </td>
                  <td>{money(r.average)}</td>
                  <td>{money(r.best)}</td>
                  <td>{money(r.worst)}</td>
                  <td>{r.runtime}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section
        number="06 / OPERATOR INBOX"
        title="Notifications & desk alerts"
        description="Seeded in-app observations, not a live push subscription. Read status and channel preferences stay in this session."
        actions={
          <div className="bt-actions">
            <span className="bt-tag">{Math.round(unreadCount)} UNREAD</span>
            <button
              className="bt-btn"
              disabled={!unread || disabled}
              onClick={() => void run({ kind: "read", id: null })}
            >
              Mark all read
            </button>
            <button className="bt-btn" onClick={() => open("preferences")}>
              Notification settings
            </button>
          </div>
        }
      >
        <div className="bt-filterbar">
          <select
            className="bt-select"
            aria-label="Notification category"
            value={notificationCategory}
            onChange={(e) => setNotificationCategory(e.target.value)}
          >
            {["all", "trade", "guardian", "deposit", "payout", "kyc"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
          <label className="bt-check">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>
          <span className="bt-muted">Delivery offline · in-app demo only</span>
        </div>
        <div className="bt-notices">
          {data.notifications
            .filter(
              (n) =>
                (notificationCategory === "all" ||
                  n.category === notificationCategory) &&
                (!unreadOnly || !n.read),
            )
            .map((n) => (
              <article
                className={`bt-notice ${n.read ? "" : "unread"}`}
                key={n.id}
              >
                <span className={`bt-notice-dot ${n.read ? "read" : ""}`} />
                <div>
                  <div className="bt-actions">
                    <span className="bt-tag">{n.category.toUpperCase()}</span>
                    <small className="mono bt-muted">{date(n.time)}</small>
                  </div>
                  <button
                    className="bt-link"
                    onClick={() => open("notification", n.id)}
                  >
                    {n.title}
                  </button>
                  <p>{n.detail}</p>
                </div>
                <button
                  className="bt-link"
                  disabled={n.read || disabled}
                  onClick={() => void run({ kind: "read", id: n.id })}
                >
                  {n.read ? "Read" : "Mark read"}
                </button>
              </article>
            ))}
          {!data.notifications.some(
            (n) =>
              (notificationCategory === "all" ||
                n.category === notificationCategory) &&
              (!unreadOnly || !n.read),
          ) && (
            <div className="bt-note">
              No notifications match this scope.
              <button
                className="bt-link ms-2"
                onClick={() => {
                  setNotificationCategory("all");
                  setUnreadOnly(false);
                }}
              >
                Show all observations
              </button>
            </div>
          )}
        </div>
      </Section>
      <Section
        number="07 / STRATEGY SOURCE LIBRARY"
        title="Custom JavaScript strategies"
        description="Version-ready source records and local attachments. Monaco edits source only; scripts are never executed by this page."
        actions={
          <button className="bt-btn bt-primary" onClick={() => open("script")}>
            + New script
          </button>
        }
      >
        <div className="table-responsive">
          <table className="table bt-table bt-script-table">
            <thead>
              <tr>
                {[
                  "Strategy source",
                  "Language",
                  "Historical runs",
                  "Win rate",
                  "Last edited / UTC",
                  "Actions",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.scripts.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button
                      className="bt-link mono"
                      onClick={() => open("script", s.id)}
                    >
                      {s.name}
                    </button>
                    <small className="bt-cell-sub">
                      {
                        data.bots.filter((b) => b.config.scriptId === s.id)
                          .length
                      }{" "}
                      local attachments
                    </small>
                  </td>
                  <td>JS</td>
                  <td>{s.runs}</td>
                  <td>
                    {s.runs ? ((100 * s.wins) / s.runs).toFixed(1) + "%" : "—"}
                  </td>
                  <td className="mono">{s.updatedAt.slice(0, 10)}</td>
                  <td>
                    <div className="bt-actions">
                      <button
                        className="bt-link"
                        onClick={() => open("script", s.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="bt-link"
                        onClick={() =>
                          void run({ kind: "duplicateScript", id: s.id })
                        }
                      >
                        Duplicate
                      </button>
                      <button
                        className="bt-link"
                        onClick={() => open("attach", s.id)}
                      >
                        Attach to bot
                      </button>
                      <button
                        className="bt-link"
                        onClick={() => open("deleteScript", s.id)}
                      >
                        Delete
                      </button>
                      <button
                        className="bt-link"
                        onClick={() =>
                          download(s.code, s.name, "text/javascript")
                        }
                      >
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.scripts.length && (
          <div className="bt-note">
            No strategy sources remain. Create a script to begin a local draft.
          </div>
        )}
        <div className="bt-library-foot">
          Historical script run counts are illustrative metadata, separate from
          D-4 bot receipts. Saving, attaching and dry-running never increments
          these counts.
        </div>
      </Section>
      <section>
        <div className="bt-section-head">
          <h2>Automation workbench</h2>
          <span className="bt-muted">CONFIGURE / VALIDATE / REVIEW</span>
        </div>
        <div className="bt-workbench">
          {(
            [
              ["create", "Create operator bot"],
              ["guardian", "Review Guardian policy"],
              ["rule", "Build an automation rule"],
              ["allocations", "Inspect capital reservations"],
              ["export", "Export workspace evidence"],
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
      <footer className="bt-footer">
        <span>
          LOCAL DEMO / no execution · no automatic transfers · no push delivery
        </span>
        <Link href="/dashboard/schedules">Schedule desk ↗</Link>
        <Link href="/dashboard/markets">Market discovery ↗</Link>
        <Link href="/dashboard/trades">Trade ledger ↗</Link>
        <Link href="/dashboard/logs">Audit workspace ↗</Link>
      </footer>
      {modal && (
        <div className="bt-local-layer">
          <DeskModalShell
            code="D14"
            eyebrow="OPERATOR AUTOMATION / LOCAL DEMO"
            title={titles[modal.kind]}
            subtitle="Review structured policy and source observations. Production requires authenticated server-side risk enforcement and provider integration."
            size="xl"
            onClose={() => callback.current()}
            steps={
              wizards.includes(modal.kind)
                ? ["Configure", "Review impact", "Acknowledge"]
                : undefined
            }
            currentStep={step}
            footer={modalFooter}
          >
            {error && (
              <div className="bt-error mb-3" role="alert">
                {error}
              </div>
            )}
            {blocking && (
              <div className="bt-error mb-3" role="alert">
                {blocking}
              </div>
            )}
            {modal.kind === "create" && step < 2 && (
              <>
                <div className="bt-form-grid">
                  <label className="bt-field">
                    Bot name
                    <input
                      className="form-control"
                      aria-label="New bot name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="bt-field">
                    Instrument
                    <select
                      className="form-select"
                      aria-label="New bot symbol"
                      value={draft.symbol}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          symbol: e.target.value as BotConfig["symbol"],
                        })
                      }
                    >
                      {symbols.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Strategy
                    <select
                      aria-label="New bot strategy"
                      className="form-select"
                      value={draft.strategy}
                      onChange={(e) => {
                        const strategy = e.target
                          .value as BotConfig["strategy"];
                        setDraft({
                          ...draft,
                          strategy,
                          params: structuredClone(paramsDefaults[strategy]),
                          maxStake:
                            strategy === "DCA"
                              ? Math.max(draft.maxStake, 105)
                              : draft.maxStake,
                          contract:
                            strategy === "Even/Odd" ? "DIGITEVEN" : "CALL",
                          scriptId:
                            strategy === "Custom script"
                              ? (data.scripts[0]?.id ?? null)
                              : null,
                        });
                      }}
                    >
                      {botStrategies.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Initial stake / USD
                    <input
                      className="form-control"
                      aria-label="New bot stake"
                      type="number"
                      step={0.01}
                      value={draft.initialStake}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          initialStake: Number(e.target.value),
                          currentStake: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="bt-field">
                    Opening package
                    <select
                      aria-label="New bot package"
                      className="form-select"
                      value={draft.allocations[0]?.pool ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          allocations: [{ pool: e.target.value, percent: 100 }],
                        })
                      }
                    >
                      {data.pools.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} / {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Capital budget / USD
                    <input
                      aria-label="New bot capital budget"
                      className="form-control"
                      type="number"
                      value={draft.capitalBudget}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          capitalBudget: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="bt-note mt-3">
                  Created in idle state with the visible template risk limits.{" "}
                  {step === 1 &&
                    "100% of this modeled budget is assigned to the selected package; nothing is reserved until started. Configure full parameters in the runner station before execution integration."}
                </div>
                {step === 1 && (
                  <pre className="bt-json">
                    {JSON.stringify(draft, null, 2)}
                  </pre>
                )}
              </>
            )}
            {modal.kind === "control" && bot && step < 2 && (
              <>
                {overview(bot)}
                <h3 className="mt-3">
                  Request {action} for {bot.name}
                </h3>
                <div className="bt-note">
                  {action === "stop"
                    ? "Stopping releases the local capital reservation but cannot cancel an open provider contract."
                    : action === "pause"
                      ? "Pausing retains the modeled reservation. It does not suspend an external worker or close a real position."
                      : "Starting/restarting revalidates saved configuration, package capacity and cooldown. It creates no actual execution worker."}{" "}
                  Restart never bypasses a future cooldown. Source runtime and
                  trade receipts are not rewritten.
                </div>
                <div className="bt-actions mt-3">
                  <button
                    className="bt-link"
                    onClick={() => {
                      setModal(null);
                      setExpanded(bot.id);
                    }}
                  >
                    Inspect saved configuration
                  </button>
                  <button
                    className="bt-link"
                    onClick={() => open("deleteBot", bot.id)}
                  >
                    Remove this bot
                  </button>
                </div>
              </>
            )}
            {modal.kind === "config" && bot && step < 2 && (
              <>
                <h3>{bot.name} · saved policy review</h3>
                {bot.status === "running" && (
                  <div className="bt-error">
                    Pause or stop the bot before saving configuration.
                    <button
                      className="bt-link ms-2"
                      onClick={() => control(bot, "pause")}
                    >
                      Review pause
                    </button>
                  </div>
                )}
                <p>
                  The update replaces the saved policy only in this workspace.
                  Active/paused allocations must fit available modeled capital.
                  Other dashboards are not mutated.
                </p>
                <pre className="bt-json">{JSON.stringify(draft, null, 2)}</pre>
              </>
            )}
            {modal.kind === "test" && bot && step < 2 && (
              <>
                {overview(bot)}
                <h3>One-trade plan · no order submission</h3>
                <dl className="bt-policy">
                  <div>
                    <dt>Instrument / contract</dt>
                    <dd>
                      {bot.config.symbol} / {bot.config.contract}
                    </dd>
                  </div>
                  <div>
                    <dt>Initial stake</dt>
                    <dd>{money(bot.config.initialStake)}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>
                      {bot.config.duration} {bot.config.unit}
                    </dd>
                  </div>
                </dl>
                <div className="bt-note">
                  This validates the saved configuration and records a{" "}
                  <b>plan_only</b> observation. It does not run custom
                  JavaScript, execute a trade, consume capital, add a receipt,
                  infer a win/loss or increment strategy runs. Unsaved form
                  edits are excluded.
                </div>
                {data.dryRuns
                  .filter((d) => d.botId === bot.id)
                  .map((d) => (
                    <div className="bt-record" key={d.id}>
                      <b>
                        {d.id} / {d.result}
                      </b>
                      <small>{date(d.time)}</small>
                    </div>
                  ))}
              </>
            )}
            {modal.kind === "guardian" && step < 2 && (
              <>
                <label className="bt-check mb-3">
                  <input type="checkbox" checked disabled />
                  Global Guardian policy is required
                </label>
                <div className="bt-form-grid">
                  {(
                    [
                      "oddEvenLosses",
                      "digitLosses",
                      "bulkRuns",
                      "drawdown",
                      "rotationMinutes",
                    ] as const
                  ).map((k) => (
                    <label className="bt-field" key={k}>
                      {
                        {
                          oddEvenLosses: "Odd/even consecutive losses",
                          digitLosses: "Other contract consecutive losses",
                          bulkRuns: "Maximum concurrent bulk runs",
                          drawdown: "Maximum package drawdown / %",
                          rotationMinutes: "Rotation interval / minutes",
                        }[k]
                      }
                      <input
                        aria-label={`Guardian ${k}`}
                        className="form-control"
                        type="number"
                        step={k === "drawdown" ? 0.1 : 1}
                        value={policy[k]}
                        onChange={(e) =>
                          setPolicy({ ...policy, [k]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="bt-check mt-3">
                  <input
                    type="checkbox"
                    checked={policy.rotation}
                    onChange={(e) =>
                      setPolicy({ ...policy, rotation: e.target.checked })
                    }
                  />
                  Reference market rotation
                </label>
                <div className="bt-note mt-3">
                  Hard limits: odd/even ≤8 losses; other contracts ≤10;
                  concurrency ≤2; drawdown ≤5%. Tightening beyond any
                  active/paused bot’s policy is blocked until those
                  configurations align. No historical source alerts are cleared
                  by policy edits.
                </div>
              </>
            )}
            {modal.kind === "triggers" && (
              <>
                <p>
                  Seeded trigger observations at {date(data.asOf)}. “Resolved”
                  describes source history, not a live execution
                  acknowledgement.
                </p>
                {data.triggers.map((t) => (
                  <div className="bt-record" key={t.id}>
                    <div>
                      <b>
                        {t.pool} / {t.condition}
                      </b>
                      <small>{date(t.time)}</small>
                      <p>{t.action}</p>
                      <small>
                        {t.resumeAt
                          ? `Resume timestamp ${date(t.resumeAt)}`
                          : "No resume required"}
                      </small>
                    </div>
                    <span className="bt-tag">
                      {t.resolved ? "HISTORICAL" : "UNRESOLVED SOURCE"}
                    </span>
                  </div>
                ))}
                <Link
                  className="bt-btn mt-3"
                  href="/dashboard/logs?category=system&type=ai_guardian"
                >
                  Open full system audit ↗
                </Link>
              </>
            )}
            {modal.kind === "rule" && step < 2 && (
              <>
                <div className="bt-form-grid">
                  <label className="bt-field">
                    Rule name
                    <input
                      className="form-control"
                      aria-label="Rule name"
                      value={rule.name}
                      onChange={(e) =>
                        setRule({ ...rule, name: e.target.value })
                      }
                    />
                  </label>
                  <label className="bt-field">
                    Condition metric
                    <select
                      className="form-select"
                      aria-label="Rule metric"
                      value={rule.metric}
                      onChange={(e) => {
                        const metric = e.target
                          .value as AutomationRule["metric"];
                        setRule({
                          ...rule,
                          metric,
                          action:
                            metric === "package_completed"
                              ? "review_distribution"
                              : metric === "weekday_time"
                                ? "pause_all"
                                : metric === "deposit"
                                  ? "notify_operator"
                                  : "pause_bot",
                          operator:
                            metric === "package_completed" ? "equals" : ">=",
                          threshold:
                            metric === "package_completed"
                              ? 1
                              : metric === "deposit"
                                ? 5000
                                : 3,
                        });
                      }}
                    >
                      {[
                        "consecutive_losses",
                        "deposit",
                        "package_completed",
                        "weekday_time",
                        "drawdown",
                      ].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Comparison
                    <select
                      className="form-select"
                      aria-label="Rule operator"
                      value={rule.operator}
                      onChange={(e) =>
                        setRule({
                          ...rule,
                          operator: e.target
                            .value as AutomationRule["operator"],
                        })
                      }
                    >
                      {[">=", ">", "equals"].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Threshold
                    <input
                      className="form-control"
                      aria-label="Rule threshold"
                      type="number"
                      value={rule.threshold}
                      onChange={(e) =>
                        setRule({ ...rule, threshold: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="bt-field">
                    Weekday time / UTC
                    <input
                      className="form-control"
                      aria-label="Rule UTC time"
                      type="time"
                      value={rule.time}
                      onChange={(e) =>
                        setRule({ ...rule, time: e.target.value })
                      }
                    />
                  </label>
                  <label className="bt-field">
                    Requested action
                    <select
                      className="form-select"
                      aria-label="Rule action"
                      value={rule.action}
                      onChange={(e) =>
                        setRule({
                          ...rule,
                          action: e.target.value as AutomationRule["action"],
                        })
                      }
                    >
                      {[
                        "pause_bot",
                        "notify_operator",
                        "review_distribution",
                        "pause_all",
                      ].map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Target bot
                    <select
                      className="form-select"
                      aria-label="Rule target bot"
                      value={rule.botId}
                      onChange={(e) =>
                        setRule({ ...rule, botId: e.target.value })
                      }
                    >
                      <option value="">Not bot-specific</option>
                      {data.bots.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Pause duration / minutes
                    <input
                      className="form-control"
                      aria-label="Rule pause minutes"
                      type="number"
                      value={rule.minutes}
                      onChange={(e) =>
                        setRule({ ...rule, minutes: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <label className="bt-check mt-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) =>
                      setRule({ ...rule, enabled: e.target.checked })
                    }
                  />
                  Enable this local definition
                </label>
                <div className="bt-note mt-3">
                  Definition only. There is no rule engine, timer, webhook
                  delivery or financial automation behind this toggle. Completed
                  packages can only request a human distribution review. UTC
                  time rules are weekday-only.
                </div>
                {step === 1 && (
                  <pre className="bt-json">{JSON.stringify(rule, null, 2)}</pre>
                )}
              </>
            )}
            {modal.kind === "deleteRule" && step < 2 && (
              <>
                <h3>{selectedRule?.name}</h3>
                <p>
                  Remove this local definition. Recorded trigger counts are
                  illustrative history, not active backend jobs; removing it
                  does not revoke a production automation.
                </p>
              </>
            )}
            {modal.kind === "simulate" && selectedRule && (
              <>
                <h3>{selectedRule.name}</h3>
                <div className="bt-form-grid">
                  <label className="bt-field">
                    Observed metric value
                    <input
                      className="form-control"
                      aria-label="Scenario observed value"
                      type="number"
                      value={scenarioValue}
                      onChange={(e) => {
                        setScenarioValue(Number(e.target.value));
                        setScenarioResult(null);
                      }}
                    />
                  </label>
                  <label className="bt-field">
                    Observed time / UTC
                    <input
                      className="form-control"
                      aria-label="Scenario UTC time"
                      type="time"
                      value={scenarioTime}
                      onChange={(e) => {
                        setScenarioTime(e.target.value);
                        setScenarioResult(null);
                      }}
                    />
                  </label>
                </div>
                <label className="bt-check mt-3">
                  <input
                    type="checkbox"
                    checked={scenarioWeekday}
                    onChange={(e) => {
                      setScenarioWeekday(e.target.checked);
                      setScenarioResult(null);
                    }}
                  />
                  Scenario falls on a weekday
                </label>
                <button
                  className="bt-btn bt-primary mt-3"
                  onClick={() =>
                    setScenarioResult(
                      evaluateRule(
                        selectedRule,
                        scenarioValue,
                        scenarioTime,
                        scenarioWeekday,
                      ),
                    )
                  }
                >
                  Evaluate without executing
                </button>
                {scenarioResult && (
                  <div className="bt-note mt-3" role="status">
                    <b>
                      {scenarioResult.matches
                        ? "Condition matched"
                        : "Condition did not match"}
                    </b>
                    <p>
                      Action would be{" "}
                      {scenarioResult.action.replaceAll("_", " ")}. Preview
                      only: no bot state, trigger count, delivery or funds
                      changed.
                    </p>
                  </div>
                )}
              </>
            )}
            {modal.kind === "script" && (
              <>
                <div className="bt-actions mb-3">
                  <label className="bt-field flex-grow-1">
                    JavaScript filename
                    <input
                      className="form-control"
                      aria-label="Script filename"
                      value={scriptName}
                      maxLength={80}
                      onChange={(e) => setScriptName(e.target.value)}
                    />
                  </label>
                  <span className="bt-tag">JS / SOURCE ONLY</span>
                </div>
                <ScriptEditor
                  key={modal.id ?? "new"}
                  code={code}
                  onChange={setCode}
                />
                <div className="bt-note mt-3">
                  Save stores text, not executable approval. No eval, Function
                  constructor, provider token or execution service is used. Stop
                  attached bots before editing source. Production must version,
                  review and isolate untrusted code in a resource-limited
                  sandbox.
                </div>
                <div className="bt-actions mt-3">
                  <button
                    className="bt-btn"
                    onClick={() =>
                      download(
                        code,
                        scriptName.endsWith(".js")
                          ? scriptName
                          : scriptName + ".js",
                        "text/javascript",
                      )
                    }
                  >
                    Download current source
                  </button>
                  {script && (
                    <button
                      className="bt-btn"
                      onClick={() => open("attach", script.id)}
                    >
                      Attach saved version
                    </button>
                  )}
                </div>
              </>
            )}
            {modal.kind === "deleteScript" && step < 2 && (
              <>
                <h3>{script?.name}</h3>
                <p>
                  Delete local strategy source. Any bot attachment blocks
                  deletion, including idle bots. Choose a built-in strategy in
                  the saved bot configuration to detach it first. This does not
                  delete a production strategy version.
                </p>
              </>
            )}
            {modal.kind === "attach" && step < 2 && (
              <>
                <h3>{script?.name}</h3>
                <label className="bt-field">
                  Attach saved source to
                  <select
                    className="form-select"
                    aria-label="Attach target bot"
                    value={attachBot}
                    onChange={(e) => setAttachBot(e.target.value)}
                  >
                    {data.bots.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} / {b.status}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="bt-note mt-3">
                  Target must be stopped or idle. The saved strategy becomes
                  Custom script with this source ID and a bounded one-step plan.
                  Its code is never executed here; existing configuration, risk
                  limits and allocation checks still apply.
                </div>
              </>
            )}
            {modal.kind === "preferences" && step < 2 && (
              <>
                <div className="bt-preference-list">
                  {(
                    [
                      "trade",
                      "guardian",
                      "deposit",
                      "kyc",
                      "payout",
                      "sound",
                      "telegram",
                    ] as const
                  ).map((k) => (
                    <label className="bt-check" key={k}>
                      <input
                        type="checkbox"
                        checked={preferences[k]}
                        disabled={k === "guardian"}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            [k]: e.target.checked,
                          })
                        }
                      />
                      <span>
                        {
                          {
                            trade: "Trade result observations / in-app",
                            guardian: "Guardian alerts / required in-app",
                            deposit: "Large deposit observations / in-app",
                            kyc: "KYC submissions / in-app",
                            payout: "Payout review observations / in-app",
                            sound:
                              "Sound preference (no audio delivery configured)",
                            telegram:
                              "Telegram preference (no delivery connected)",
                          }[k]
                        }
                      </span>
                    </label>
                  ))}
                </div>
                <label className="bt-field mt-3">
                  Large deposit threshold / USD
                  <input
                    className="form-control"
                    aria-label="Notification deposit threshold"
                    type="number"
                    value={preferences.depositThreshold}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        depositThreshold: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <p className="bt-muted mt-3">
                  Preferences describe future subscriptions and do not hide
                  existing evidence. No browser push permission, sound, Telegram
                  token or external delivery is activated.
                </p>
              </>
            )}
            {modal.kind === "notification" &&
              (() => {
                const n = data.notifications.find((n) => n.id === modal.id);
                return n ? (
                  <>
                    <span className="bt-tag">{n.category.toUpperCase()}</span>
                    <h3 className="mt-3">{n.title}</h3>
                    <p>{n.detail}</p>
                    <p className="mono bt-muted">
                      {date(n.time)} / {n.read ? "read" : "unread"}
                    </p>
                    <div className="bt-actions">
                      <button
                        className="bt-btn"
                        disabled={n.read || disabled}
                        onClick={() =>
                          void run({ kind: "read", id: n.id }, true)
                        }
                      >
                        {n.read ? "Already read" : "Mark observation read"}
                      </button>
                      {n.botId && (
                        <button
                          className="bt-btn"
                          onClick={() => {
                            setModal(null);
                            setDrawer(n.botId);
                            setDrawerTab("overview");
                          }}
                        >
                          Inspect related runner
                        </button>
                      )}
                      <Link
                        className="bt-btn"
                        href={
                          n.category === "deposit"
                            ? "/dashboard/deposits"
                            : n.category === "payout"
                              ? "/dashboard/withdrawals"
                              : n.category === "kyc"
                                ? "/dashboard/investors"
                                : "/dashboard/logs"
                        }
                      >
                        Open source workspace ↗
                      </Link>
                    </div>
                  </>
                ) : null;
              })()}
            {modal.kind === "performance" && (
              <>
                <p>
                  Counts, win percentage, net P/L, mean stake and best/worst are
                  computed from the existing D-4 receipt DTOs grouped by bot ID.
                  All {data.receipts.length} receipts are included, not a
                  selected live runtime. New or unobserved bots show zero trades
                  with no inferred win rate.
                </p>
                <div className="bt-note">
                  Runtime and current configuration are independent fixture
                  observations. Their symbol/strategy need not match every
                  historical receipt. Control, configuration, script and dry-run
                  actions never rewrite ledger provenance or manufacture
                  returns.
                </div>
                <Link className="bt-btn mt-3" href="/dashboard/trades">
                  Inspect independent trade ledger ↗
                </Link>
              </>
            )}
            {modal.kind === "receipts" && bot && (
              <>
                <h3>{bot.name}</h3>
                {receiptEvidence(bot.id)}
              </>
            )}
            {modal.kind === "allocations" && (
              <>
                <p>
                  Opening available capital comes from D-8 undeployed funds.
                  Running and paused bots reserve their full modeled capital
                  budgets; stopping releases a local reservation. This does not
                  move money or reserve funds outside D-14.
                </p>
                {data.pools.map((p) => {
                  const assignments = data.bots
                    .filter((b) => ["running", "paused"].includes(b.status))
                    .map((b) => ({
                      bot: b.name,
                      amount:
                        (b.config.capitalBudget *
                          (b.config.allocations.find((a) => a.pool === p.code)
                            ?.percent ?? 0)) /
                        100,
                    }))
                    .filter((a) => a.amount > 0);
                  const used = assignments.reduce((n, a) => n + a.amount, 0);
                  return (
                    <div className="bt-record" key={p.code}>
                      <div>
                        <b>
                          {p.code} / {p.name}
                        </b>
                        <p>
                          Opening {money(p.available)} · reserved {money(used)}{" "}
                          · unreserved {money(p.available - used)}
                        </p>
                        <small>
                          {assignments
                            .map((a) => `${a.bot} ${money(a.amount)}`)
                            .join(" · ") || "No local reservations"}
                        </small>
                      </div>
                    </div>
                  );
                })}
                <Link className="bt-btn mt-3" href="/dashboard/funds">
                  Treasury source context ↗
                </Link>
              </>
            )}
            {modal.kind === "risk" && (
              <ul className="bt-methodology">
                <li>
                  Guardian limits are deterministic policy, not a prediction
                  model. No live equity, consecutive-loss monitor or
                  loss-prevention guarantee exists here.
                </li>
                <li>
                  Bot drawdown, concurrency and consecutive-loss thresholds
                  cannot exceed global Guardian caps. Configuration edits
                  require a paused or stopped runner.
                </li>
                <li>
                  Stake progressions include all modeled steps and cap each
                  stake at the maximum. Concurrency multiplies full-sequence
                  exposure. The budget must fit both modeled exposure and
                  package capacity.
                </li>
                <li>
                  Loss limits, cooldown and take-profit are saved settings, not
                  automatic execution. Daily loss must fit stop loss and contain
                  maximum single stake. Fees, slippage, currency conversion and
                  gap risk require production enforcement.
                </li>
                <li>
                  Future cooldown timestamps block starts and dry runs. Reaching
                  a resume timestamp does not automatically resume, clear source
                  alerts or guarantee execution eligibility.
                </li>
                <li>
                  Custom scripts are untrusted text. Production must validate
                  their output and enforce capital/risk independently of the
                  script.
                </li>
              </ul>
            )}
            {modal.kind === "audit" && (
              <>
                <p>
                  Local append-only decisions for this session. Reload resets
                  all state; the independent D-12 audit workspace is not
                  mutated.
                </p>
                {data.audit.map((a, i) => (
                  <div className="bt-record" key={i}>
                    <div>
                      <b>{a.action}</b>
                      <small>{date(a.time)}</small>
                      <p>{a.detail}</p>
                    </div>
                  </div>
                ))}
                {!data.audit.length && (
                  <div className="bt-note">
                    No local decisions have been recorded. Configure or review a
                    runner to begin.
                  </div>
                )}
                <h3 className="mt-3">
                  Validated plans / {data.dryRuns.length}
                </h3>
                {data.dryRuns.map((d) => (
                  <div className="bt-record" key={d.id}>
                    <b>
                      {d.id} / {d.result}
                    </b>
                    <small>
                      {d.symbol} / {money(d.stake)} / {date(d.time)}
                    </small>
                  </div>
                ))}
                <button
                  className="bt-btn mt-3"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        { audit: data.audit, plans: data.dryRuns },
                        null,
                        2,
                      ),
                      "bot-local-audit.json",
                    )
                  }
                >
                  Download local audit & plans
                </button>
              </>
            )}
            {modal.kind === "export" && step < 2 && (
              <>
                <label className="bt-field">
                  Workspace export format
                  <select
                    className="form-select"
                    aria-label="Automation export format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <option value="json">
                      JSON / full workspace, configuration & source
                    </option>
                    <option value="csv">
                      CSV / all bot performance observations
                    </option>
                    <option value="pdf">PDF / readable runner summary</option>
                  </select>
                </label>
                <div className="bt-note mt-3">
                  Exports cover the entire workspace, not visible filters. JSON
                  includes all script text and source receipt context; handle
                  future real data as sensitive. Files are synthetic, unsigned
                  evidence, not provider-certified execution reports.
                </div>
              </>
            )}
            {modal.kind === "halt" && step < 2 && (
              <>
                <h3>Stop all locally active runners</h3>
                <p>
                  {
                    data.bots.filter((b) =>
                      ["running", "paused"].includes(b.status),
                    ).length
                  }{" "}
                  running/paused bots will become stopped and release modeled
                  reservations. Source cooldown timestamps and receipts remain
                  unchanged.
                </p>
                <div className="bt-error">
                  This is a local desk halt only. It cannot pause external
                  workers, cancel open contracts or prevent real trading losses.
                  Production emergency controls require server-side execution
                  acknowledgement.
                </div>
              </>
            )}
            {modal.kind === "deleteBot" && bot && step < 2 && (
              <>
                <h3>{bot.name}</h3>
                <p>
                  Stop this runner before removal. Any automation rule
                  referencing it must be removed or retargeted first. Historical
                  receipt evidence remains in the source workspace and exports;
                  deletion is not data erasure or a provider shutdown.
                </p>
              </>
            )}
            {modal.kind === "help" && (
              <ul className="bt-methodology">
                <li>
                  Five initial runners are seeded status/configuration
                  observations. No websocket, provider token, worker or
                  automatic rule execution is present.
                </li>
                <li>
                  All changes are validated immutable commands in a TanStack
                  Query workspace. They reset on reload and never call the
                  existing legacy bot write endpoint.
                </li>
                <li>
                  Package opening capacity projects D-8; bot receipt totals
                  project D-4 by bot ID. They are independent historical
                  sources, not contemporaneous live state.
                </li>
                <li>
                  Rule scenarios only compare supplied values. Distribution
                  rules request a human review, never an automatic transfer.
                  Notification preferences do not deliver push, sound or
                  Telegram messages.
                </li>
                <li>
                  Monaco assets are served locally from the installed
                  dependency. JavaScript source is never evaluated. Script run
                  statistics are illustrative metadata, not results of this
                  editor or dry runs.
                </li>
                <li>
                  Before production, add authenticated account-scoped
                  reads/writes, durable jobs, idempotent commands, execution
                  acknowledgements, secure sandboxed strategies, provider
                  sessions and independently enforced risk.
                </li>
              </ul>
            )}
            {wizards.includes(modal.kind) && step === 2 && (
              <>
                <div className="bt-note">
                  Review complete. This confirmation applies only to the local
                  frontend workspace. Invalid state transitions, policy
                  conflicts and capacity limits are rechecked atomically before
                  any local update.
                </div>
                {confirm}
              </>
            )}
          </DeskModalShell>
        </div>
      )}
      {drawer && bot && (
        <div
          className="bt-local-layer bt-drawer-layer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) callback.current();
          }}
        >
          <aside
            className="bt-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Bot right inspector"
          >
            <header>
              <div>
                <span className="bt-section-code">D14 / RUNNER INSPECTOR</span>
                <h2>{bot.name}</h2>
              </div>
              <button
                className="bt-icon-button"
                aria-label="Close bot inspector"
                onClick={() => callback.current()}
              >
                <Icon name="close" size={17} />
              </button>
            </header>
            <nav>
              {["overview", "policy", "receipts"].map((t) => (
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
            <div className="bt-drawer-body">
              {drawerTab === "overview" && overview(bot)}
              {drawerTab === "policy" && (
                <>
                  <dl className="bt-policy">
                    <div>
                      <dt>Max stake</dt>
                      <dd>{money(bot.config.maxStake)}</dd>
                    </div>
                    <div>
                      <dt>Daily loss cap</dt>
                      <dd>{money(bot.config.maxDailyLoss)}</dd>
                    </div>
                    <div>
                      <dt>Drawdown threshold</dt>
                      <dd>{bot.config.drawdown}%</dd>
                    </div>
                    <div>
                      <dt>Max concurrency</dt>
                      <dd>{bot.config.maxConcurrent}</dd>
                    </div>
                  </dl>
                  <button className="bt-btn mt-3" onClick={() => open("risk")}>
                    Full risk methodology
                  </button>
                  <pre className="bt-json mt-3">
                    {JSON.stringify(bot.config.params, null, 2)}
                  </pre>
                </>
              )}
              {drawerTab === "receipts" && receiptEvidence(bot.id)}
            </div>
            <footer>
              <button
                className="bt-btn"
                onClick={() => {
                  setDrawer(null);
                  setExpanded(bot.id);
                  document
                    .getElementById("bot-config")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Configure runner
              </button>
              <button
                className="bt-btn bt-primary"
                onClick={() =>
                  control(bot, bot.status === "running" ? "pause" : "restart")
                }
              >
                {bot.status === "running" ? "Review pause" : "Review restart"}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
export function BotsPage({
  operatorBundle,
  initial,
}: {
  operatorBundle: OperatorBundleProps;
  initial: BotWorkspace;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-bots" bundle={operatorBundle}>
      {() => <BotDesk initial={initial} />}
    </OperatorShell>
  );
}
