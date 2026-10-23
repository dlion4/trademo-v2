"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon } from "@/components/icons";
import {
  categories,
  type AuditEvent,
  type Category,
  type Filters,
  type LogsBundle,
  type Retention,
} from "@/lib/logs/types";
import {
  applyLogCommand,
  defaultLogFilters,
  eventsCSV,
  exportRows,
  filterLogs,
  logCommandSchema,
  logSummary,
  taxSummary,
  type LogCommand,
} from "@/lib/logs/model";
const human = (s: string) => s.replaceAll("_", " "),
  time = (s: string) => s.replace("T", " ").slice(0, 19),
  cash = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
export type DialogKind =
  | "detail"
  | "acknowledge"
  | "escalate"
  | "resolve"
  | "note"
  | "raw"
  | "correlation"
  | "actor"
  | "actors"
  | "investor"
  | "security"
  | "sessions"
  | "session"
  | "retry"
  | "retryOutcome"
  | "job"
  | "backup"
  | "reconciliation"
  | "systemHistory"
  | "retention"
  | "hold"
  | "holds"
  | "releaseHold"
  | "archive"
  | "archives"
  | "archiveDetail"
  | "export"
  | "compliance"
  | "tax"
  | "savedView"
  | "savedViews"
  | "simulate"
  | "access"
  | "reviews"
  | "methodology"
  | "reset";
const titles: Record<DialogKind, string> = {
  detail: "Event evidence & attribution",
  acknowledge: "Acknowledge audit observation",
  escalate: "Escalate observation for review",
  resolve: "Resolve a local escalation",
  note: "Append reviewer evidence",
  raw: "Read-only event JSON",
  correlation: "Correlation trail",
  actor: "Actor evidence dossier",
  actors: "Actor directory",
  investor: "Investor activity timeline",
  security: "Security observation review",
  sessions: "Synthetic session register",
  session: "Simulate session revocation",
  retry: "Review webhook retry request",
  retryOutcome: "Simulate retry outcome",
  job: "Cron dry-run review",
  backup: "Backup observation manifest",
  reconciliation: "Reconciliation observation",
  systemHistory: "System event history",
  retention: "Proposed retention controls",
  hold: "Place a local preservation hold",
  holds: "Preservation hold register",
  releaseHold: "Release local preservation hold",
  archive: "Prepare archive manifest",
  archives: "Archive manifest register",
  archiveDetail: "Archive manifest evidence",
  export: "Export scoped audit events",
  compliance: "Generate compliance workpaper",
  tax: "Generate accountant worksheet",
  savedView: "Save event explorer view",
  savedViews: "Saved audit views",
  simulate: "Append a synthetic observation",
  access: "API request observation",
  reviews: "Local review decision register",
  methodology: "Evidence boundaries & methodology",
  reset: "Reset local audit workspace",
};
const wizardKinds: DialogKind[] = [
  "acknowledge",
  "escalate",
  "resolve",
  "session",
  "retry",
  "retryOutcome",
  "job",
  "retention",
  "hold",
  "releaseHold",
  "archive",
  "export",
  "compliance",
  "tax",
  "simulate",
  "reset",
];
function useOverlay(onClose: () => void) {
  const callback = useRef(onClose);
  useEffect(() => {
    callback.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = document.querySelector<HTMLElement>(
      ".page-dashboard-logs .lg-local-layer",
    );
    const list = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
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
      previous?.focus();
    };
  }, []);
}
function save(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function digest(content: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function EventFacts({ event }: { event: AuditEvent }) {
  return (
    <>
      <div className="lg-dossier">
        <div>
          <small>Attributed actor</small>
          <b>{event.actorName}</b>
          <span>
            {event.actorType} · {event.actorId}
          </span>
        </div>
        <div>
          <small>Event / UTC</small>
          <b>{human(event.action)}</b>
          <span className="mono">{time(event.createdAt)}</span>
        </div>
        <div>
          <small>Target / severity</small>
          <b>{event.target}</b>
          <span>
            {event.category} · {event.severity}
          </span>
        </div>
      </div>
      <p className="lg-note">{event.details}</p>
    </>
  );
}
function SavedViewForm({
  filters,
  onSubmit,
}: {
  filters: Filters;
  onSubmit: (c: LogCommand) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const f = useForm({
    defaultValues: { name: "", reason: "" },
    validators: {
      onSubmit: ({ value }) => {
        const result = logCommandSchema.safeParse({
          kind: "view",
          ...value,
          filters,
        });
        return result.success ? undefined : result.error.issues[0].message;
      },
    },
    onSubmit: async ({ value }) => {
      try {
        setError("");
        await onSubmit({ kind: "view", ...value, filters });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to save view");
      }
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void f.handleSubmit();
      }}
    >
      {(["name", "reason"] as const).map((k) => (
        <f.Field key={k} name={k}>
          {(field) => (
            <label className="lg-field mb-3">
              {k === "name" ? "Unique view name" : "Reason for saved scope"}
              <input
                className="form-control"
                aria-label={
                  k === "name" ? "Unique view name" : "Reason for saved scope"
                }
                required
                minLength={k === "name" ? 3 : 10}
                maxLength={k === "name" ? 50 : 1200}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </f.Field>
      ))}
      <pre className="lg-json">{JSON.stringify(filters, null, 2)}</pre>
      <f.Subscribe selector={(s) => s.errors}>
        {(errors) => (
          <div className="text-loss" role="status">
            {errors.map(String).join("; ")}
          </div>
        )}
      </f.Subscribe>
      {error && (
        <p className="lg-error" role="alert">
          {error}
        </p>
      )}
      <f.Subscribe selector={(s) => s.isSubmitting}>
        {(submitting) => (
          <button
            className="lg-btn lg-primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save scoped view"}
          </button>
        )}
      </f.Subscribe>
    </form>
  );
}
interface Props {
  modal: { kind: DialogKind; id?: string };
  data: LogsBundle;
  filters: Filters;
  onClose: () => void;
  onOpen: (kind: DialogKind, id?: string) => void;
  onCommand: (command: LogCommand) => Promise<void>;
  onFilters: (filters: Filters) => void;
  onReset: () => void;
  onInspect: (id: string) => void;
}
export function LogsDialog({
  modal,
  data,
  filters,
  onClose,
  onOpen,
  onCommand,
  onFilters,
  onReset,
  onInspect,
}: Props) {
  const [step, setStep] = useState(0),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [policy, setPolicy] = useState<Retention>(data.retention),
    [category, setCategory] = useState<Category | "all">(filters.category),
    [format, setFormat] = useState<"csv" | "json">("csv"),
    [from, setFrom] = useState(filters.from),
    [to, setTo] = useState(filters.to),
    [minimized, setMinimized] = useState(true),
    [reportYear, setReportYear] = useState(Number(data.asOf.slice(0, 4))),
    [outcome, setOutcome] = useState<"failed_demo" | "succeeded_demo">(
      "succeeded_demo",
    );
  const selectedCategory =
    modal.id && categories.includes(modal.id as Category)
      ? (modal.id as Category)
      : filters.category;
  const scope: Filters = {
    ...filters,
    from,
    to,
    category: modal.kind === "export" ? selectedCategory : filters.category,
  };
  let rows: AuditEvent[] = [],
    scopeError = "";
  try {
    rows = exportRows(data, scope);
  } catch (e) {
    scopeError = e instanceof Error ? e.message : "Invalid scope";
  }
  const e = data.events.find((e) => e.id === modal.id) ?? data.events[0],
    review = data.reviews.find((r) => r.eventId === e.id),
    session = data.sessions.find((s) => s.id === modal.id) ?? data.sessions[0],
    retry = data.retries.find((r) => r.id === modal.id),
    archive = data.archives.find((a) => a.id === modal.id) ?? data.archives[0],
    access = data.api.find((a) => a.id === modal.id) ?? data.api[0];
  const isWizard = wizardKinds.includes(modal.kind);
  const financial =
    reportYear >= 2000 && reportYear <= Number(data.asOf.slice(0, 4))
      ? taxSummary(data, reportYear)
      : null;
  function close() {
    if (!busy) onClose();
  }
  useOverlay(close);
  const eventList = (list: AuditEvent[]) => (
    <div className="lg-evidence-list">
      {list.map((event) => (
        <div className="lg-record" key={event.id}>
          <div>
            <small className="mono">
              {time(event.createdAt)} UTC · {event.category}
            </small>
            <b>
              {event.actorName} · {human(event.action)}
            </b>
            <p>{event.details}</p>
          </div>
          <button
            className="lg-link"
            onClick={() => onOpen("detail", event.id)}
          >
            Inspect ↗
          </button>
        </div>
      ))}
      {!list.length && (
        <p className="lg-note">
          No observations are attributed to this scope. No activity is inferred
          from missing evidence.
        </p>
      )}
    </div>
  );
  async function run(c: LogCommand) {
    setError("");
    setBusy(true);
    try {
      await onCommand(c);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to record local action.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function report() {
    setBusy(true);
    setError("");
    try {
      const tax = modal.kind === "tax",
        payload = tax ? financial : rows;
      if (!payload) throw Error("Choose an available report year.");
      const hash = await digest(JSON.stringify(payload)),
        count = tax ? financial!.count : rows.length;
      const type = tax
        ? "tax"
        : modal.kind === "compliance"
          ? "compliance"
          : format;
      if (type === "csv")
        save(
          eventsCSV(rows, minimized),
          "text/csv;charset=utf-8",
          "trademo-audit-events.csv",
        );
      else if (type === "json")
        save(
          JSON.stringify(
            {
              mode: "demo",
              asOf: data.asOf,
              scope,
              hashAlgorithm: "SHA-256",
              hashScope: "JSON.stringify(events) in this file",
              sha256: hash,
              events: rows,
            },
            null,
            2,
          ),
          "application/json",
          "trademo-audit-evidence.json",
        );
      else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        let y = 22;
        const line = (text: string) => {
          doc.setFontSize(10);
          for (const l of doc.splitTextToSize(text, 175)) {
            if (y > 275) {
              doc.addPage();
              y = 22;
            }
            doc.text(l, 18, y);
            y += 7;
          }
          y += 2;
        };
        line(
          `tradeMO / ${tax ? "Accountant P/L worksheet" : "Compliance workpaper"} / DEMO ONLY`,
        );
        line(`Source base ${time(data.asOf)} UTC / revision ${data.revision}`);
        if (tax) {
          line(
            `Selected year ${financial!.year}: ${financial!.count} recorded trade receipts`,
          );
          line(
            `Recorded gains ${cash(financial!.gains)} / losses ${cash(financial!.losses)} / net ${cash(financial!.net)}`,
          );
          line(
            "Source coverage is the existing demo trade ledger, not a complete annual account. Fees, cost basis adjustments, tax residency and tax due are not determined.",
          );
          financial!.months.forEach((m) =>
            line(`${m.month} / ${m.count} receipts / net ${cash(m.net)}`),
          );
        } else {
          const m = logSummary(rows);
          line(
            `Scope ${scope.from} to ${scope.to} UTC / category ${scope.category} / ${m.total} observations / ${m.critical} critical`,
          );
          m.byCategory.forEach((c) => line(`${c.category}: ${c.count}`));
          line(
            `Local reviews ${data.reviews.length} / active demo holds ${data.holds.filter((h) => h.active).length}`,
          );
          line(
            "Selected critical/warning evidence (up to 40; export JSON for full row evidence):",
          );
          rows
            .filter((e) => e.severity !== "info")
            .slice(0, 40)
            .forEach((e) =>
              line(
                `${time(e.createdAt)} / ${e.id} / ${e.action} / ${minimized ? e.actorType : e.actorName}`,
              ),
            );
        }
        line(`SHA-256 of canonical JSON report payload: ${hash}`);
        line(
          "Synthetic workpaper only. Not a compliance certification, production audit, tax calculation or filed return. Proposed retention controls require jurisdiction-specific review.",
        );
        doc.save(
          tax
            ? "trademo-accountant-worksheet.pdf"
            : "trademo-compliance-workpaper.pdf",
        );
      }
      await onCommand({
        kind: "report",
        reportType: type,
        digest: hash,
        recordCount: count,
        reason,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare report.");
    } finally {
      setBusy(false);
    }
  }
  function command(): LogCommand | null {
    const k = modal.kind;
    if (
      k === "acknowledge" ||
      k === "escalate" ||
      k === "resolve" ||
      k === "note"
    )
      return {
        kind: "review",
        id: e.id,
        action:
          k === "acknowledge"
            ? "acknowledged"
            : k === "escalate"
              ? "escalated"
              : k === "resolve"
                ? "resolved"
                : "note",
        reason,
      };
    if (k === "retry") return { kind: "retry", id: e.id, reason };
    if (k === "retryOutcome")
      return {
        kind: "retryOutcome",
        id: modal.id ?? "",
        state: outcome,
        reason,
      };
    if (k === "session") return { kind: "session", id: session.id, reason };
    if (k === "retention") return { kind: "retention", policy, reason };
    if (k === "hold") return { kind: "hold", category, reason };
    if (k === "releaseHold")
      return { kind: "releaseHold", id: modal.id ?? "", reason };
    if (k === "archive") return { kind: "archive", filters: scope, reason };
    if (k === "simulate")
      return {
        kind: "simulate",
        category: category === "all" ? "system" : category,
        reason,
      };
    if (k === "job") return { kind: "job", id: e.id, reason };
    return null;
  }
  function submit() {
    if (["export", "compliance", "tax"].includes(modal.kind)) {
      void report();
      return;
    }
    if (modal.kind === "reset") {
      onReset();
      return;
    }
    const c = command();
    if (c) void run(c);
  }
  const reportKind = ["archive", "export", "compliance"].includes(modal.kind);
  const draft = command();
  // Preview immutable eligibility once per command/data change, not once per typed reason character.
  const previewKey = JSON.stringify(
    draft
      ? { ...draft, reason: "Preview of an explicit local audit action." }
      : null,
  );
  let gate = useMemo(() => {
    if (previewKey === "null") return "";
    try {
      applyLogCommand(data, JSON.parse(previewKey) as LogCommand);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "Action unavailable";
    }
  }, [data, previewKey]);
  if (reportKind && scopeError) gate = scopeError;
  if (modal.kind === "tax" && !financial)
    gate = "Choose an available report year.";
  const confirmStep = (
    <>
      <label className="lg-field my-3">
        Reviewer reason
        <textarea
          className="form-control"
          aria-label="Reviewer reason"
          required
          rows={3}
          minLength={10}
          maxLength={1200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <label className="lg-check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I understand this is a local demo action or synthetic workpaper. No real
        session, provider, scheduled job, cloud archive, retention job or tax
        filing is changed.
      </label>
    </>
  );
  const actionable = isWizard || modal.kind === "note";
  const footer = (
    <>
      <button
        className="lg-btn"
        disabled={busy}
        onClick={() => (step ? setStep(step - 1) : close())}
      >
        {step ? "Back" : "Close"}
      </button>
      {actionable && (
        <button
          className="lg-btn lg-primary"
          disabled={
            busy ||
            !!gate ||
            ((!isWizard || step === 2) &&
              (!confirmed || reason.trim().length < 10))
          }
          onClick={() => (isWizard && step < 2 ? setStep(step + 1) : submit())}
        >
          {busy
            ? "Preparing…"
            : isWizard && step < 2
              ? "Continue →"
              : ["export", "compliance", "tax"].includes(modal.kind)
                ? "Prepare & download"
                : "Confirm local action"}
        </button>
      )}
    </>
  );
  return (
    <div className="lg-local-layer">
      <DeskModalShell
        code="D12"
        eyebrow="AUDIT OPERATIONS / SYNTHETIC EVIDENCE"
        title={titles[modal.kind]}
        subtitle="Read-only source observations and separately appended local decisions. Production requires authorized, durable and independently verifiable evidence."
        size="xl"
        onClose={close}
        steps={
          isWizard
            ? ["Scope & evidence", "Review limitations", "Confirm & record"]
            : undefined
        }
        currentStep={step}
        footer={footer}
      >
        {error && (
          <div className="lg-error mb-3" role="alert">
            {error}
          </div>
        )}
        {gate && (
          <div className="lg-error mb-3" role="alert">
            {gate}
          </div>
        )}
        {["detail", "security"].includes(modal.kind) && (
          <>
            <EventFacts event={e} />
            <div className="lg-actions">
              <button
                className="lg-btn"
                disabled={!!review}
                onClick={() => onOpen("acknowledge", e.id)}
              >
                Acknowledge
              </button>
              <button
                className="lg-btn"
                disabled={review?.status === "resolved"}
                onClick={() => onOpen("escalate", e.id)}
              >
                Escalate
              </button>
              <button
                className="lg-btn"
                disabled={review?.status !== "escalated"}
                onClick={() => onOpen("resolve", e.id)}
              >
                Resolve escalation
              </button>
              <button className="lg-btn" onClick={() => onOpen("note", e.id)}>
                Add reviewer note
              </button>
              <button className="lg-btn" onClick={() => onOpen("raw", e.id)}>
                Raw event JSON
              </button>
              <button
                className="lg-btn"
                onClick={() => onOpen("correlation", e.id)}
              >
                Correlation trail
              </button>
              <button className="lg-btn" onClick={() => onOpen("actor", e.id)}>
                Actor dossier
              </button>
              <button className="lg-link" onClick={() => onInspect(e.id)}>
                Right inspector ↗
              </button>
            </div>
            <dl className="lg-facts">
              <div>
                <dt>Event ID</dt>
                <dd className="mono">{e.id}</dd>
              </div>
              <div>
                <dt>Correlation ID</dt>
                <dd className="mono">{e.correlationId}</dd>
              </div>
              <div>
                <dt>Masked origin</dt>
                <dd>{e.ipAddress}</dd>
              </div>
              <div>
                <dt>User agent</dt>
                <dd>{e.userAgent}</dd>
              </div>
              <div>
                <dt>Observation provenance</dt>
                <dd>{e.source}</dd>
              </div>
            </dl>
            <pre className="lg-json">{JSON.stringify(e.metadata, null, 2)}</pre>
            <h3>Reviewer evidence · {review?.status ?? "Not reviewed"}</h3>
            {review?.notes.map((n, i) => (
              <p key={i} className="lg-note">
                {n.text}
                <small>
                  {time(n.time)} UTC · {n.actor}
                </small>
              </p>
            ))}
            {e.category === "auth" && (
              <button
                className="lg-btn"
                disabled={!data.sessions.some((s) => s.id === e.target)}
                onClick={() => onOpen("session", e.target)}
              >
                Review attributed session
              </button>
            )}
            {e.systemKind === "webhook_failure" && (
              <button className="lg-btn" onClick={() => onOpen("retry", e.id)}>
                Review webhook retry
              </button>
            )}
          </>
        )}
        {modal.kind === "raw" && (
          <>
            <p className="lg-note">
              Exact structured event DTO. Review annotations are separate
              records and never overwrite these source fields.
            </p>
            <pre className="lg-json">{JSON.stringify(e, null, 2)}</pre>
            <button
              className="lg-btn"
              onClick={() =>
                save(
                  JSON.stringify(e, null, 2),
                  "application/json",
                  `${e.id}.json`,
                )
              }
            >
              Download exact event JSON
            </button>
          </>
        )}
        {modal.kind === "correlation" && (
          <>
            <h3 className="mono">{e.correlationId}</h3>
            <p>
              Only explicitly matching correlation IDs appear. Temporal
              proximity does not prove causality, and source snapshots may be
              incomplete.
            </p>
            {eventList(
              data.events.filter((x) => x.correlationId === e.correlationId),
            )}
          </>
        )}
        {["actor", "actors"].includes(modal.kind) && (
          <>
            {modal.kind === "actors" ? (
              <>
                {[
                  ...new Map(data.events.map((x) => [x.actorId, x])).values(),
                ].map((actor) => (
                  <div key={actor.actorId} className="lg-record">
                    <div>
                      <b>{actor.actorName}</b>
                      <small>
                        {actor.actorId} · {actor.actorType}
                      </small>
                    </div>
                    <button
                      className="lg-link"
                      onClick={() => onOpen("actor", actor.id)}
                    >
                      Actor dossier ↗
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <>
                <h3>
                  {e.actorName} · {e.actorType}
                </h3>
                <p className="mono">{e.actorId}</p>
                <button
                  className="lg-btn mb-3"
                  onClick={() =>
                    onFilters({
                      ...defaultLogFilters(data.asOf),
                      actor: e.actorId,
                    })
                  }
                >
                  Apply actor to explorer
                </button>
                {e.investorId && (
                  <button
                    className="lg-btn mb-3 ms-2"
                    onClick={() => onOpen("investor", e.investorId!)}
                  >
                    Investor activity
                  </button>
                )}
                {eventList(data.events.filter((x) => x.actorId === e.actorId))}
              </>
            )}
          </>
        )}
        {modal.kind === "investor" && (
          <>
            <label className="lg-field mb-3">
              Investor
              <select
                className="form-select"
                value={modal.id ?? data.investors[0].id}
                onChange={(event) => onOpen("investor", event.target.value)}
              >
                {data.investors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Explicit investor attribution only; no cross-investor activity is
              inferred. Uses the explorer’s UTC date range.
            </p>
            {eventList(
              data.events.filter(
                (x) =>
                  x.investorId === (modal.id ?? data.investors[0].id) &&
                  x.createdAt.slice(0, 10) >= filters.from &&
                  x.createdAt.slice(0, 10) <= filters.to,
              ),
            )}
            <Link className="lg-btn mt-3" href="/dashboard/investors">
              Investor management ↗
            </Link>
          </>
        )}
        {["acknowledge", "escalate", "resolve", "note"].includes(
          modal.kind,
        ) && (
          <>
            {(step < 2 || modal.kind === "note") && (
              <>
                <EventFacts event={e} />
                <div className="lg-note">
                  {modal.kind === "acknowledge"
                    ? "Acknowledgement marks the observation as seen, not fixed or independently verified."
                    : modal.kind === "escalate"
                      ? "Record an escalation with clear evidence and ownership notes. No incident notification is sent."
                      : modal.kind === "resolve"
                        ? "Resolution closes only the local review. Explain the outcome; it does not remediate the source system or alter original event fields."
                        : "Append a reviewer annotation. Existing notes and original event payloads remain unchanged. An initial note opens an acknowledged review."}
                </div>
              </>
            )}
            {step === 1 && (
              <p>
                Current review state: <b>{review?.status ?? "unreviewed"}</b>.
                Reviewer notes are append-only. A resolved escalation cannot
                silently be reopened.
              </p>
            )}
            {(step === 2 || modal.kind === "note") && confirmStep}
          </>
        )}
        {modal.kind === "sessions" && (
          <>
            <p>
              Synthetic session inventory. Local revocation changes a demo flag
              only, not actual browser/auth sessions or tokens.
            </p>
            {data.sessions.map((s) => (
              <div key={s.id} className="lg-record">
                <div>
                  <b>{s.actorName}</b>
                  <small>
                    {s.id} · {time(s.lastSeen)} UTC · {s.ipAddress}
                  </small>
                </div>
                <span className="lg-status">{human(s.state)}</span>
                <button
                  className="lg-btn"
                  disabled={s.state !== "active"}
                  onClick={() => onOpen("session", s.id)}
                >
                  Revoke · demo
                </button>
              </div>
            ))}
          </>
        )}
        {modal.kind === "session" && (
          <>
            {step < 2 && (
              <>
                <h3>
                  {session.actorName} · {session.id}
                </h3>
                <div className="lg-note">
                  State {human(session.state)} · created{" "}
                  {time(session.createdAt)} UTC · last observed{" "}
                  {time(session.lastSeen)} UTC.
                  <p>
                    This marks the synthetic inventory entry revoked_demo and
                    appends an audit event. Production must invalidate actual
                    server-side tokens, refresh credentials and related sessions
                    with appropriate authorization.
                  </p>
                </div>
              </>
            )}
            {step === 1 && (
              <p>
                Other module sessions and your current operator browser remain
                unaffected. No IP-whitelist or access-control change is
                executed.
              </p>
            )}
            {step === 2 && confirmStep}
          </>
        )}
        {["retry", "retryOutcome", "job"].includes(modal.kind) && (
          <>
            {step < 2 && (
              <>
                <EventFacts
                  event={
                    modal.kind === "retryOutcome"
                      ? (data.events.find((e) => e.id === retry?.eventId) ?? e)
                      : e
                  }
                />
                <div className="lg-note">
                  {modal.kind === "retry"
                    ? "Queue a local retry request for this webhook failure. At most three attempts; one queued attempt at a time. A succeeded demo attempt blocks further retry. No webhook is replayed."
                    : modal.kind === "retryOutcome"
                      ? "Explicitly assign a synthetic result to the queued demo attempt. Original failure evidence is retained. This does not establish external delivery, ledger settlement or provider idempotency."
                      : "Record a dry-run request referencing this cron execution. It does not execute the job, distribute funds, send communications or create a background task. One dry-run request per recorded execution."}
                </div>
              </>
            )}
            {step === 0 && modal.kind === "retryOutcome" && (
              <label className="lg-field">
                Synthetic outcome
                <select
                  className="form-select"
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(event.target.value as typeof outcome)
                  }
                >
                  <option value="succeeded_demo">Succeeded · simulated</option>
                  <option value="failed_demo">Failed · simulated</option>
                </select>
              </label>
            )}
            {step === 1 && (
              <>
                <h3>Recovery evidence</h3>
                {data.retries
                  .filter((r) => r.eventId === (retry?.eventId ?? e.id))
                  .map((r) => (
                    <p key={r.id}>
                      Attempt {r.attempt}: {human(r.state)} ·{" "}
                      {time(r.createdAt)} UTC
                    </p>
                  ))}
                <p>
                  Production recovery requires independently verified outcomes,
                  replay limits, signature validation and durable idempotency
                  keys.
                </p>
              </>
            )}
            {step === 2 && confirmStep}
          </>
        )}
        {["backup", "reconciliation"].includes(modal.kind) && (
          <>
            <EventFacts event={e} />
            <pre className="lg-json">{JSON.stringify(e.metadata, null, 2)}</pre>
            <p className="lg-note">
              {modal.kind === "backup"
                ? "This seeded observation is not an accessible backup object, restore certificate or integrity guarantee. No private storage link is fabricated. Download the observation manifest for inspection; production needs authorized object access, checksums and restore tests."
                : "A recorded zero difference is an observation from an independent demo source, not a reconciliation of current wallets, treasury or provider statements. Production must compare durable ledger entries against independently acquired provider balances."}
            </p>
            <button
              className="lg-btn"
              onClick={() =>
                save(
                  JSON.stringify(
                    {
                      mode: "demo",
                      event: e,
                      limitations:
                        "Observation only; no cloud object, restore test or external balance verified.",
                    },
                    null,
                    2,
                  ),
                  "application/json",
                  `${e.id}-manifest.json`,
                )
              }
            >
              Download observation manifest
            </button>
            <Link className="lg-btn ms-2" href="/dashboard/funds">
              Treasury evidence ↗
            </Link>
          </>
        )}
        {modal.kind === "systemHistory" && (
          <>
            <h3>{human(modal.id ?? "system")} observations</h3>
            {eventList(
              data.events.filter(
                (e) =>
                  e.systemKind === (modal.id ?? "webhook_failure") &&
                  e.createdAt.slice(0, 10) >= filters.from &&
                  e.createdAt.slice(0, 10) <= filters.to,
              ),
            )}
          </>
        )}
        {modal.kind === "retention" && (
          <>
            {step === 0 && (
              <div className="lg-form-grid">
                {(Object.keys(policy) as (keyof Retention)[]).map((k) => (
                  <label className="lg-field" key={k}>
                    {human(k.replace(/([A-Z])/g, " $1").toLowerCase())}
                    <input
                      className="form-control"
                      type="number"
                      aria-label={`Retention ${k}`}
                      value={policy[k]}
                      min={
                        k === "systemDays"
                          ? 90
                          : k === "financialYears" || k === "auditYears"
                            ? 7
                            : 1
                      }
                      max={k === "systemDays" ? 3650 : 20}
                      onChange={(e) =>
                        setPolicy({ ...policy, [k]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            {step === 1 && (
              <>
                <h3>Proposed policy, not legal certification</h3>
                <p>
                  Financial/audit baselines cannot fall below seven years in
                  this demo; authentication below one year or system
                  observations below 90 days are blocked. Actual legal
                  obligations vary by jurisdiction, record type and legal hold.
                </p>
                <p>
                  No deletion or archive job runs. Active holds must override
                  any future deletion policy; copying evidence into an archive
                  manifest does not release a hold.
                </p>
                <pre className="lg-json">{JSON.stringify(policy, null, 2)}</pre>
              </>
            )}
            {step === 2 && confirmStep}
          </>
        )}
        {modal.kind === "hold" && (
          <>
            {step === 0 && (
              <label className="lg-field">
                Preservation scope
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as Category | "all")
                  }
                >
                  <option value="all">All event categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            {step < 2 && (
              <div className="lg-note">
                A hold is a local preservation instruction with a reviewer
                reason. It never deletes, hides or modifies source observations.
                Production requires authorized hold placement, case identifiers,
                immutable evidence and an actual retention service that enforces
                it.
              </div>
            )}
            {step === 1 && (
              <p>
                Scope: <b>{category}</b>. An active identical hold is blocked.
                Exporting or creating a copy manifest does not release the hold.
              </p>
            )}
            {step === 2 && confirmStep}
          </>
        )}
        {modal.kind === "holds" && (
          <>
            <p>
              Local preservation instructions. No deletion capability is exposed
              on this page.
            </p>
            {data.holds.map((h) => (
              <div className="lg-record" key={h.id}>
                <div>
                  <b>
                    {h.category} · {h.active ? "active" : "released"}
                  </b>
                  <small>
                    {time(h.createdAt)} UTC · {h.id}
                  </small>
                  <p>{h.reason}</p>
                </div>
                <button
                  className="lg-btn"
                  disabled={!h.active}
                  onClick={() => onOpen("releaseHold", h.id)}
                >
                  Review release
                </button>
              </div>
            ))}
            {!data.holds.length && (
              <div className="lg-note">
                No holds have been placed in this browser session.
              </div>
            )}
            <button className="lg-btn mt-3" onClick={() => onOpen("hold")}>
              Place preservation hold
            </button>
          </>
        )}
        {modal.kind === "releaseHold" && (
          <>
            {step < 2 && (
              <>
                <h3>
                  {data.holds.find((h) => h.id === modal.id)?.category} hold
                </h3>
                <p>{data.holds.find((h) => h.id === modal.id)?.reason}</p>
                <div className="lg-note">
                  Release changes only the local hold register and appends
                  evidence. It does not authorize deletion, change original
                  observations or release a real legal preservation obligation.
                </div>
              </>
            )}
            {step === 2 && confirmStep}
          </>
        )}
        {["archive", "export", "compliance"].includes(modal.kind) && (
          <>
            {step === 0 && (
              <>
                <div className="lg-form-grid">
                  {(["from", "to"] as const).map((k) => (
                    <label className="lg-field" key={k}>
                      {k} / UTC
                      <input
                        className="form-control"
                        type="date"
                        aria-label={`Report ${k} date`}
                        value={k === "from" ? from : to}
                        onChange={(e) =>
                          (k === "from" ? setFrom : setTo)(e.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="lg-note">
                  Current scope: category <b>{scope.category}</b>, actor{" "}
                  <b>{scope.actor}</b>, severity <b>{scope.severity}</b>, search
                  “{scope.search || "none"}”. Maximum 30 inclusive UTC days and
                  10,000 matching rows.
                </p>
                {modal.kind === "export" && (
                  <label className="lg-field">
                    Artifact format
                    <select
                      className="form-select"
                      value={format}
                      onChange={(e) =>
                        setFormat(e.target.value as typeof format)
                      }
                    >
                      <option value="csv">Formula-safe CSV</option>
                      <option value="json">
                        JSON with SHA-256 payload manifest
                      </option>
                    </select>
                  </label>
                )}
                {modal.kind !== "archive" && (
                  <label className="lg-check mt-3">
                    <input
                      type="checkbox"
                      checked={minimized}
                      onChange={(e) => setMinimized(e.target.checked)}
                    />
                    Minimize actor identity and free-text details in CSV/PDF
                    presentation. JSON intentionally retains full synthetic row
                    evidence.
                  </label>
                )}
              </>
            )}
            {step === 1 && (
              <>
                <div className="lg-review-totals">
                  <div>
                    <small>Matching events</small>
                    <b>{rows.length}</b>
                  </div>
                  <div>
                    <small>Critical observations</small>
                    <b>{logSummary(rows).critical}</b>
                  </div>
                  <div>
                    <small>Active local holds</small>
                    <b>{data.holds.filter((h) => h.active).length}</b>
                  </div>
                </div>
                <p>
                  {modal.kind === "archive"
                    ? "Creates a manifest listing exact event IDs. It does not move bytes to S3, delete records, purge logs or establish immutable storage. Existing source events remain in the explorer."
                    : modal.kind === "compliance"
                      ? "The PDF includes an executive count summary, retention/hold context, up to 40 critical/warning references and a payload digest. It is a synthetic workpaper, not a certified compliance audit."
                      : "Exports all scoped rows, not just loaded stream pages or the current category table page. CSV may be minimized; full JSON intentionally includes synthetic actor/context fields. Access control and PII redaction must be enforced server-side for real data."}
                </p>
                <p>
                  SHA-256 identifies a canonical JSON payload, not a provider
                  signature, independent timestamp or proof of authenticity.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <h3>
                  {rows.length} observations · {scope.from} through {scope.to}{" "}
                  UTC
                </h3>
                <p>
                  {modal.kind === "archive"
                    ? "Source observations are retained. The archive is manifest-only and has no external storage destination."
                    : "A local export-preparation event will be appended after the download is requested, with payload digest, report type and record count. It does not attest that a file was stored or received."}
                </p>
                {confirmStep}
              </>
            )}
          </>
        )}
        {modal.kind === "archives" && (
          <>
            <p>
              Seeded and locally prepared manifests only; there are no
              accessible cloud storage objects or data deletion operations.
            </p>
            {data.archives.map((a) => (
              <div key={a.id} className="lg-record">
                <div>
                  <b>
                    {a.from} → {a.to} UTC
                  </b>
                  <small>
                    {a.eventIds.length} event IDs · {time(a.createdAt)} UTC ·{" "}
                    {a.state}
                  </small>
                  <p>{a.reason}</p>
                </div>
                <button
                  className="lg-link"
                  onClick={() => onOpen("archiveDetail", a.id)}
                >
                  Inspect manifest ↗
                </button>
              </div>
            ))}
            <button className="lg-btn mt-3" onClick={() => onOpen("archive")}>
              Prepare scoped archive manifest
            </button>
          </>
        )}
        {modal.kind === "archiveDetail" && (
          <>
            <h3>{archive.id}</h3>
            <p className="lg-note">
              {archive.reason}
              <br />
              {archive.from} → {archive.to} UTC · {archive.eventIds.length}{" "}
              event IDs · {archive.state}. Source evidence remains present.
            </p>
            <button
              className="lg-btn mb-3"
              onClick={() =>
                save(
                  JSON.stringify(archive, null, 2),
                  "application/json",
                  `${archive.id}.json`,
                )
              }
            >
              Download archive manifest
            </button>
            {eventList(
              data.events.filter((e) => archive.eventIds.includes(e.id)),
            )}
          </>
        )}
        {modal.kind === "tax" && (
          <>
            {step === 0 && (
              <>
                <label className="lg-field">
                  Report year / UTC
                  <input
                    className="form-control"
                    type="number"
                    aria-label="Report year"
                    min={2000}
                    max={Number(data.asOf.slice(0, 4))}
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                  />
                </label>
                <p className="lg-note">
                  Uses the actual D-4 synthetic trade receipt dataset, not
                  audit-event counts, deposits or payouts. Source coverage:{" "}
                  {
                    data.financialReceipts
                      .map((r) => r.executedAt.slice(0, 10))
                      .sort()[0]
                  }{" "}
                  through{" "}
                  {data.financialReceipts
                    .map((r) => r.executedAt.slice(0, 10))
                    .sort()
                    .at(-1)}{" "}
                  UTC. This is not complete annual history.
                </p>
              </>
            )}
            {step === 1 && financial && (
              <>
                <div className="lg-review-totals">
                  <div>
                    <small>Receipts in selected year</small>
                    <b>{financial.count}</b>
                  </div>
                  <div>
                    <small>Recorded gains</small>
                    <b className="lg-money-total">{cash(financial.gains)}</b>
                  </div>
                  <div>
                    <small>Recorded net P/L</small>
                    <b className="lg-money-total">{cash(financial.net)}</b>
                  </div>
                </div>
                <p>
                  Recorded losses {cash(financial.losses)}. Fees, tax residency,
                  cost-basis adjustments and tax due are <b>not determined</b>.
                  Empty years yield an explicit zero-observation worksheet, not
                  a claim of no taxable activity.
                </p>
                {financial.months.map((m) => (
                  <div className="lg-record" key={m.month}>
                    <b>{m.month}</b>
                    <span>{m.count} receipts</span>
                    <span className="mono">{cash(m.net)}</span>
                  </div>
                ))}
              </>
            )}
            {step === 2 && (
              <>
                <h3>Accountant worksheet · {reportYear}</h3>
                <p>
                  The PDF is a source-limited synthetic P/L workpaper for
                  review, not a filed tax return, tax advice or a full-year
                  certification.
                </p>
                {confirmStep}
              </>
            )}
          </>
        )}
        {modal.kind === "savedView" && (
          <SavedViewForm filters={filters} onSubmit={onCommand} />
        )}
        {modal.kind === "savedViews" && (
          <>
            <p>
              Saved browser-session scopes retain search, category, severity,
              actor and UTC dates. Reload/reset restores the base workspace.
            </p>
            {data.views.map((v) => (
              <div className="lg-record" key={v.id}>
                <div>
                  <b>{v.name}</b>
                  <small>
                    {v.filters.from} → {v.filters.to} · {v.filters.category} ·{" "}
                    {v.filters.severity}
                  </small>
                </div>
                <button className="lg-btn" onClick={() => onFilters(v.filters)}>
                  Apply saved view
                </button>
              </div>
            ))}
            {!data.views.length && (
              <p className="lg-note">
                No saved views yet. Set the explorer filters, then save a named
                view.
              </p>
            )}
            <button className="lg-btn mt-3" onClick={() => onOpen("savedView")}>
              Save current explorer scope
            </button>
          </>
        )}
        {modal.kind === "simulate" && (
          <>
            {step === 0 && (
              <label className="lg-field">
                Synthetic observation category
                <select
                  className="form-select"
                  value={category === "all" ? "system" : category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            {step < 2 && (
              <div className="lg-note">
                Appends one explicitly local_demo observation with the
                operator’s reason. It is not a trade, deposit, payout, login or
                provider event and never changes financial totals or
                authenticates access.
              </div>
            )}
            {step === 1 && (
              <p>
                The live-looking indicator means the local demo view is active;
                there is no websocket, production stream or scheduled event
                generator. A paused stream buffers this new workspace
                observation until resumed.
              </p>
            )}
            {step === 2 && confirmStep}
          </>
        )}
        {modal.kind === "access" && (
          <>
            <div className="lg-dossier">
              <div>
                <small>Observed route</small>
                <b className="mono">
                  {access.method} {access.path}
                </b>
                <span>{access.direction}</span>
              </div>
              <div>
                <small>Observed result</small>
                <b>{access.status}</b>
                <span>{access.latencyMs} ms</span>
              </div>
              <div>
                <small>Attribution</small>
                <b>{access.actor}</b>
                <span>{time(access.createdAt)} UTC</span>
              </div>
            </div>
            <p className="lg-note">
              This is a seeded request observation, not a button that executes
              the path. Status/latency are recorded fixture values, not present
              service health.
            </p>
            <button
              className="lg-btn"
              onClick={() => onOpen("detail", access.eventId)}
            >
              Linked event evidence
            </button>
            <button
              className="lg-btn ms-2"
              onClick={() => onOpen("correlation", access.eventId)}
            >
              Correlation trail
            </button>
            <pre className="lg-json mt-3">
              {JSON.stringify(access, null, 2)}
            </pre>
          </>
        )}
        {modal.kind === "reviews" && (
          <>
            <p>
              Local decision state is separate from original observations.
              Acknowledgement is not remediation; resolution requires a prior
              escalation.
            </p>
            {data.reviews.map((r) => (
              <div key={r.eventId} className="lg-record">
                <div>
                  <b>
                    {r.eventId} · {r.status}
                  </b>
                  {r.notes.map((n, i) => (
                    <p key={i}>
                      {n.text} · {time(n.time)} UTC
                    </p>
                  ))}
                </div>
                <button
                  className="lg-link"
                  onClick={() => onOpen("detail", r.eventId)}
                >
                  Evidence ↗
                </button>
              </div>
            ))}
            {!data.reviews.length && (
              <p className="lg-note">
                No local reviews yet. Open any event to acknowledge, escalate or
                append a note.
              </p>
            )}
            <button
              className="lg-btn mt-3"
              onClick={() => onOpen("detail", data.events[0].id)}
            >
              Review latest observation
            </button>
          </>
        )}
        {modal.kind === "methodology" && (
          <ul className="lg-methodology">
            <li>
              Source observations join independent D-4 trade receipts, D-9
              payouts, D-10 communications and D-11 deposits with synthetic
              security, API and system fixtures. They are not a synchronized
              production audit trail.
            </li>
            <li>
              Original observations are never edited by this feature. Commands
              append local_demo audit events and separate
              review/session/retry/policy records. Reset discards
              browser-session changes.
            </li>
            <li>
              The source snapshot date anchors default filters; all event dates
              and export boundaries use inclusive UTC calendar days.
              Investor/system/security/API panels use the chosen UTC range but
              ignore stream category/text/actor filters; their local selectors
              remain authoritative.
            </li>
            <li>
              Category tables override the stream category. Their export button
              explicitly uses the selected category tab. All filtered exports
              are bounded to 30 days / 10,000 rows and include rows beyond the
              visible page.
            </li>
            <li>
              The virtualized stream caps matching events at 1,000 with
              100-event infinite-query pages. The categorized table and reports
              can inspect the rest of the scoped source history.
            </li>
            <li>
              SHA-256 payload digests detect a change relative to the same
              payload representation, not authenticity or independent custody.
              This demo has no signed event chain, immutable storage or provider
              timestamp authority.
            </li>
            <li>
              Minimized CSV/PDF reports omit actor names and free-text details
              in their presentation. Full JSON and event metadata remain
              synthetic personal/context data; production needs authorization
              and explicit redaction.
            </li>
            <li>
              Retention defaults are proposed safeguards, not a universal legal
              requirement. No purge action is exposed. A local hold cannot
              enforce preservation in an external storage system.
            </li>
            <li>
              Tax workpapers use source-limited trade P/L, not deposits as
              income or payouts as gains. Tax residency, fees and liability are
              not inferred.
            </li>
          </ul>
        )}
        {modal.kind === "reset" && (
          <>
            {step < 2 && (
              <>
                <h3>Restore the initial audit snapshot</h3>
                <p>
                  Discard local review notes/escalations, session flags,
                  retries, reports-prepared events, preservation holds, policy
                  edits, archive manifests and saved views. Source fixtures and
                  other dashboard modules remain unchanged.
                </p>
                <div className="lg-note">
                  This is a frontend reset, not deletion from a production audit
                  store. It is not an audit-log erasure workflow.
                </div>
              </>
            )}
            {step === 2 && confirmStep}
          </>
        )}
      </DeskModalShell>
    </div>
  );
}
export function LogInspector({
  data,
  id,
  onClose,
  onOpen,
}: {
  data: LogsBundle;
  id: string;
  onClose: () => void;
  onOpen: (kind: DialogKind, id?: string) => void;
}) {
  const [tab, setTab] = useState("context");
  useOverlay(onClose);
  const e = data.events.find((e) => e.id === id) ?? data.events[0],
    review = data.reviews.find((r) => r.eventId === e.id);
  return (
    <div
      className="lg-local-layer lg-drawer-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="lg-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Audit right inspector"
      >
        <header>
          <div>
            <span className="lg-section-code">D12 / EVENT INSPECTOR</span>
            <h2>{human(e.action)}</h2>
          </div>
          <button
            className="lg-icon-button"
            aria-label="Close audit inspector"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </header>
        <nav aria-label="Audit inspector tabs">
          {["context", "metadata", "review"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="lg-drawer-body">
          {tab === "context" && (
            <>
              <EventFacts event={e} />
              <p className="mono">{e.id}</p>
              <p className="lg-muted">
                Origin {e.ipAddress}
                <br />
                Provenance {e.source}
              </p>
              <button
                className="lg-btn"
                onClick={() => onOpen("correlation", e.id)}
              >
                Open correlation trail
              </button>
              <button
                className="lg-btn mt-3"
                onClick={() => onOpen("actor", e.id)}
              >
                Actor dossier
              </button>
            </>
          )}
          {tab === "metadata" && (
            <>
              <pre className="lg-json">
                {JSON.stringify(e.metadata, null, 2)}
              </pre>
              <p className="mono lg-muted">{e.correlationId}</p>
              <button className="lg-btn" onClick={() => onOpen("raw", e.id)}>
                Full raw event
              </button>
            </>
          )}
          {tab === "review" && (
            <>
              <h3>{review?.status ?? "Not reviewed"}</h3>
              {review?.notes.map((n, i) => (
                <p className="lg-note" key={i}>
                  {n.text}
                  <small>
                    {time(n.time)} UTC · {n.actor}
                  </small>
                </p>
              ))}
              <button className="lg-btn" onClick={() => onOpen("note", e.id)}>
                Append review note
              </button>
            </>
          )}
        </div>
        <footer>
          <button className="lg-btn" onClick={() => onOpen("detail", e.id)}>
            Full evidence
          </button>
          <button
            className="lg-btn lg-primary"
            disabled={review?.status === "resolved"}
            onClick={() => onOpen("escalate", e.id)}
          >
            Escalation review
          </button>
        </footer>
      </aside>
    </div>
  );
}
