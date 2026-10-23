"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  OperatorShell,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon } from "@/components/icons";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import { useDeposits } from "@/lib/deposits/use-deposits";
import {
  blockers,
  reviewable,
  summary,
  methodBreakdown,
  timeline,
  filterDeposits,
  filterSchema,
  commandSchema,
  depositCSV,
  type Command,
  type Filters,
} from "@/lib/deposits/model";
import {
  methods,
  statuses,
  type Deposit,
  type DepositBundle,
  type Method,
  type Rules,
} from "@/lib/deposits/types";
const cash = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n),
  human = (s: string) => s.replaceAll("_", " "),
  time = (s: string) => s.replace("T", " ").slice(0, 16);
const col = createDeskColumnHelper<Deposit>();
type Kind =
  | "detail"
  | "verify"
  | "batch"
  | "reject"
  | "proof"
  | "proofView"
  | "retry"
  | "refund"
  | "contact"
  | "evidence"
  | "record"
  | "rules"
  | "automation"
  | "reconcile"
  | "mismatch"
  | "method"
  | "timeline"
  | "export"
  | "audit"
  | "note"
  | "reset";
const titles: Record<Kind, string> = {
  detail: "Deposit detail & review",
  verify: "Verify deposit locally",
  batch: "Batch verification review",
  reject: "Reject unsettled deposit claim",
  proof: "Request payment proof",
  proofView: "Payment evidence viewer",
  retry: "Retry failed payment review",
  refund: "Simulate deposit refund",
  contact: "Investor contact context",
  evidence: "Simulate provider evidence",
  record: "Record a deposit claim",
  rules: "Deposit automation safeguards",
  automation: "Run local automation preview",
  reconcile: "Reconciliation workbench",
  mismatch: "Amount mismatch review",
  method: "Payment method analysis",
  timeline: "UTC deposit timeline",
  export: "Export deposit report",
  audit: "Deposit session audit",
  note: "Append reviewer note",
  reset: "Reset deposit workspace",
};
const wizards: Kind[] = [
  "verify",
  "batch",
  "reject",
  "proof",
  "retry",
  "refund",
  "evidence",
  "record",
  "automation",
  "export",
];
function Badge({ status }: { status: string }) {
  return (
    <span className={`dp-status dp-status-${status}`}>{human(status)}</span>
  );
}
function Metric({
  label,
  value,
  minutes,
  onClick,
  detail,
}: {
  label: string;
  value: number | null;
  minutes?: boolean;
  onClick: () => void;
  detail: string;
}) {
  const n = useLiveCountUp(value ?? 0);
  return (
    <button className="dp-metric" onClick={onClick}>
      <div>
        <span>{label}</span>
        <Icon name="arrowRight" size={13} />
      </div>
      <strong className="mono">
        {value === null ? "N/A" : minutes ? `${Math.round(n)} min` : cash(n)}
      </strong>
      <small>{detail}</small>
    </button>
  );
}
function save(text: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function RecordForm({
  data,
  onReview,
}: {
  data: DepositBundle;
  onReview: (v: Extract<Command, { kind: "record" }>) => void;
}) {
  const f = useForm({
    defaultValues: {
      kind: "record" as const,
      investorId: data.investors[0].id,
      amount: 1000,
      method: "bank_transfer" as Method,
      pool: data.pools[0].code,
      reference: "",
      notes: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = commandSchema.safeParse(value);
        return r.success ? undefined : r.error.issues[0].message;
      },
    },
    onSubmit: ({ value }) => onReview(value),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void f.handleSubmit();
      }}
    >
      <div className="dp-form-grid">
        <f.Field name="investorId">
          {(field) => (
            <label className="dp-field">
              Investor
              <select
                className="form-select"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              >
                {data.investors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </f.Field>
        <f.Field name="amount">
          {(field) => (
            <label className="dp-field">
              Claimed amount / USD
              <input
                className="form-control"
                type="number"
                min={10}
                max={100000}
                step="0.01"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              />
            </label>
          )}
        </f.Field>
        <f.Field name="method">
          {(field) => (
            <label className="dp-field">
              Payment method
              <select
                className="form-select"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as Method)}
              >
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {human(m)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </f.Field>
        <f.Field name="pool">
          {(field) => (
            <label className="dp-field">
              Package
              <select
                className="form-select"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              >
                {data.pools.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </f.Field>
        <f.Field name="reference">
          {(field) => (
            <label className="dp-field">
              Unique reference
              <input
                className="form-control"
                required
                minLength={6}
                maxLength={100}
                pattern="[a-zA-Z0-9_-]+"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </f.Field>
        <f.Field name="notes">
          {(field) => (
            <label className="dp-field">
              Claim context
              <input
                className="form-control"
                required
                minLength={10}
                maxLength={1200}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </f.Field>
      </div>
      <f.Subscribe selector={(s) => s.errors}>
        {(errors) => (
          <p role="alert" className="text-loss">
            {errors.map(String).join("; ")}
          </p>
        )}
      </f.Subscribe>
      <button type="submit" className="dp-btn dp-primary">
        Review new claim →
      </button>
    </form>
  );
}
function DepositDesk({ initial }: { initial: DepositBundle }) {
  const { data, mutation, reset } = useDeposits(initial),
    { pushToast } = useOperatorUI();
  const base: Filters = {
    search: "",
    status: "all",
    method: "all",
    pool: "all",
    investor: "all",
    from: "2026-09-24",
    to: data.asOf.slice(0, 10),
  };
  const [filters, setFilters] = useState<Filters>(base),
    [sorting, setSorting] = useState<SortingState>([
      { id: "submittedAt", desc: true },
    ]),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(50),
    [selected, setSelected] = useState<string[]>([]),
    [expanded, setExpanded] = useState<string | null>(null),
    [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(null),
    [drawer, setDrawer] = useState<string | null>(null),
    [tab, setTab] = useState("context"),
    [step, setStep] = useState(0),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [rules, setRules] = useState<Rules>(data.rules),
    [outcome, setOutcome] = useState<Deposit["provider"]["outcome"]>("settled"),
    [evidenceAmount, setEvidenceAmount] = useState(1000),
    [confirmations, setConfirmations] = useState(6),
    [format, setFormat] = useState("csv"),
    [scope, setScope] = useState("filtered"),
    [method, setMethod] = useState<Method>("bank_transfer"),
    [timelineDate, setTimelineDate] = useState(data.asOf.slice(0, 10)),
    [record, setRecord] = useState<Extract<Command, { kind: "record" }> | null>(
      null,
    );
  const validFilters = filterSchema.safeParse(filters),
    rows = validFilters.success ? filterDeposits(data, filters) : [],
    totals = summary(rows, data.asOf.slice(0, 10)),
    breakdown = methodBreakdown(rows),
    buckets = timeline(data.deposits, timelineDate),
    peak = Math.max(0, ...buckets.map((b) => b.total)),
    queue = data.deposits.filter(reviewable),
    failures = data.deposits.filter(
      (d) => d.status === "failed" || d.status === "refunded",
    ),
    deposit =
      data.deposits.find((d) => d.id === (modal?.id ?? drawer)) ??
      data.deposits[0];
  const reasons = blockers(deposit, data.rules);
  const eligible = queue.filter((d) => !blockers(d, data.rules).length),
    batchIds = selected.length
      ? selected
      : eligible.map((d) => d.id).slice(0, 50);
  const batchReasons = batchIds.flatMap((id) => {
    const d = data.deposits.find((d) => d.id === id);
    return d
      ? blockers(d, data.rules).map((s) => `${id}: ${s}`)
      : [`${id}: not found`];
  });
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("id", { header: "Deposit" }),
        col.accessor("submittedAt", { header: "Date / UTC" }),
        col.accessor("investorName", { header: "Investor" }),
        col.accessor("amount", { header: "Amount / USD" }),
        col.accessor("method", { header: "Method" }),
        col.accessor("pool", { header: "Package" }),
        col.accessor("status", { header: "Status" }),
        col.accessor("reference", { header: "Reference" }),
        col.accessor("verifiedBy", { header: "Verified by" }),
      ]),
    [],
  );
  const table = useDeskTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: (u) => {
      setSorting(typeof u === "function" ? u(sorting) : u);
      setPage(1);
    },
  });
  const pages = Math.max(1, Math.ceil(rows.length / pageSize)),
    current = Math.min(page, pages),
    visible = table
      .getRowModel()
      .rows.slice((current - 1) * pageSize, current * pageSize);
  const overlay = !!modal || !!drawer,
    disabled = busy || mutation.isPending;
  useEffect(() => {
    if (!overlay) return;
    const previous = document.activeElement as HTMLElement | null,
      old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = document.querySelector<HTMLElement>(
      ".page-dashboard-deposits .dp-local-layer",
    );
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) ?? [],
      ).filter((n) => n.getClientRects().length);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled) {
        setModal(null);
        setDrawer(null);
      }
      if (e.key === "Tab") {
        const list = focusable();
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
          e.preventDefault();
          list[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [overlay, modal?.kind, drawer, disabled]);
  function open(kind: Kind, id?: string) {
    setDrawer(null);
    setError("");
    setNotes("");
    setConfirmed(false);
    setStep(0);
    if (kind === "rules") setRules(data.rules);
    if (kind === "evidence") {
      const d = data.deposits.find((d) => d.id === id)!;
      setOutcome(d.provider.outcome);
      setEvidenceAmount(d.amount);
      setConfirmations(d.provider.confirmations);
    }
    if (kind === "record") setRecord(null);
    setModal({ kind, id });
  }
  function close() {
    if (!disabled) {
      setModal(null);
      setDrawer(null);
    }
  }
  async function run(command: Command, message: string) {
    try {
      setError("");
      await mutation.mutateAsync(command);
      setSelected([]);
      setModal(null);
      pushToast({ tone: "success", title: message });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Local operation failed.");
    }
  }
  function change<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters({ ...filters, [key]: value });
    setPage(1);
    setSelected([]);
  }
  function confirmBox() {
    return (
      <>
        <label className="dp-field my-3">
          Reviewer reason (10–1,200 characters)
          <textarea
            className="form-control"
            aria-label="Reviewer reason"
            rows={3}
            minLength={10}
            maxLength={1200}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="dp-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I understand this changes local demo state only. No real deposit,
          wallet credit, message, refund or provider request is executed.
        </label>
      </>
    );
  }
  function facts(d = deposit) {
    return (
      <div className="dp-dossier">
        <div>
          <small>Investor / claim</small>
          <b>{d.investorName}</b>
          <span>
            {d.id} · {d.pool}
          </span>
        </div>
        <div>
          <small>Claimed / provider amount</small>
          <b>
            {cash(d.amount)} / {cash(d.provider.amount)}
          </b>
          <span>
            {human(d.method)} · {d.methodDetails.provider}
          </span>
          <span>{d.methodDetails.maskedAccount}</span>
        </div>
        <div>
          <small>Review / provider outcome</small>
          <Badge status={d.status} />
          <span>
            {d.provider.outcome} · KYC{" "}
            {d.kycVerified ? "verified" : "unverified"}
          </span>
        </div>
      </div>
    );
  }
  async function receiptPDF(d: Deposit) {
    setBusy(true);
    setError("");
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("SYNTHETIC PAYMENT EVIDENCE", 18, 22);
      doc.setFontSize(10);
      const lines = [
        "DEMO ONLY — NOT A PAYMENT OR SETTLEMENT CERTIFICATE",
        `Deposit: ${d.id}`,
        `Investor: ${d.investorName}`,
        `Claim: ${cash(d.amount)} / provider observation: ${cash(d.provider.amount)}`,
        `Method: ${human(d.method)} / ${d.methodDetails.provider}`,
        `Reference: ${d.reference}`,
        `Provider outcome: ${d.provider.outcome}`,
        `Artifact: ${d.proof?.id ?? "None"}`,
        `Confirmations: ${d.provider.confirmations}`,
        `Submitted: ${time(d.submittedAt)} UTC`,
        "No real provider connection or money movement.",
      ];
      let y = 40;
      for (const line of lines) {
        doc.text(doc.splitTextToSize(line, 175), 18, y);
        y += 14;
      }
      doc.save(`${d.id}-synthetic-evidence.pdf`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to render evidence PDF",
      );
    } finally {
      setBusy(false);
    }
  }
  function evidence(d = deposit) {
    return (
      <>
        <div className="dp-note">
          <b>SIMULATED PAYMENT EVIDENCE — NOT A BANK RECEIPT</b>
          <p>
            Reference: {d.reference}
            <br />
            Provider reference: {d.provider.reference}
            <br />
            Amount observed: {cash(d.provider.amount)} · outcome:{" "}
            {d.provider.outcome}
            <br />
            Confirmations: {d.provider.confirmations} · demo authenticated
            webhook: {d.provider.webhookVerified ? "yes" : "no"}
          </p>
          {d.proof ? (
            <span>
              Artifact {d.proof.id} · received {time(d.proof.receivedAt)} UTC.
              This structured synthetic receipt is rendered locally; no external
              image/PDF or private storage link is fabricated.
            </span>
          ) : (
            <span>
              No proof attached. Request evidence before verification.
            </span>
          )}
        </div>
        <div className="dp-actions">
          <button
            className="dp-btn"
            disabled={!d.proof}
            onClick={() =>
              save(
                JSON.stringify(
                  {
                    mode: "demo",
                    depositId: d.id,
                    proof: d.proof,
                    provider: d.provider,
                  },
                  null,
                  2,
                ),
                "application/json",
                `${d.id}-proof.json`,
              )
            }
          >
            Download evidence JSON
          </button>
          <button
            className="dp-btn"
            disabled={!d.proof || disabled}
            onClick={() => void receiptPDF(d)}
          >
            Download synthetic receipt PDF
          </button>
          <button
            className="dp-btn"
            disabled={!reviewable(d)}
            onClick={() => open("proof", d.id)}
          >
            Request proof review
          </button>
        </div>
      </>
    );
  }
  async function exportReport() {
    setBusy(true);
    try {
      const list = scope === "all" ? data.deposits : rows;
      if (format === "csv")
        save(
          depositCSV(list),
          "text/csv;charset=utf-8",
          "trademo-deposits.csv",
        );
      else if (format === "json")
        save(
          JSON.stringify(
            {
              mode: "demo",
              asOf: data.asOf,
              revision: data.revision,
              scope,
              summary: summary(list, data.asOf.slice(0, 10)),
              deposits: list,
              audit: data.audit,
            },
            null,
            2,
          ),
          "application/json",
          "trademo-deposits.json",
        );
      else {
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
        line("tradeMO / Deposit Logs / SYNTHETIC DEMO ONLY");
        line(`${list.length} claims / snapshot ${time(data.asOf)} UTC`);
        list.forEach((d) =>
          line(
            `${d.id} / ${d.investorName} / ${cash(d.amount)} / ${d.status} / ${d.reference}`,
          ),
        );
        line(
          "Not a payment certificate. No provider transfer or investor wallet mutation occurred.",
        );
        doc.save("trademo-deposit-report.pdf");
      }
      setModal(null);
      pushToast({ tone: "success", title: "Deposit report downloaded" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  function submit() {
    if (!modal) return;
    const kind = modal.kind;
    if (kind === "export") {
      void exportReport();
      return;
    }
    if (kind === "reset") {
      reset();
      setSelected([]);
      setFilters(base);
      setPage(1);
      setModal(null);
      return;
    }
    if (kind === "rules") {
      void run(
        { kind: "rules", rules, notes },
        "Local automation safeguards saved",
      );
      return;
    }
    if (kind === "record" && record) {
      void run(
        { ...record, notes },
        "Deposit claim recorded locally, unverified and uncredited",
      );
      return;
    }
    if (kind === "verify" || kind === "batch") {
      void run(
        {
          kind: "verify",
          ids: kind === "batch" ? batchIds : [deposit.id],
          notes,
        },
        "Local verification completed; independent demo credits updated",
      );
      return;
    }
    if (kind === "automation") {
      void run(
        { kind: "automation", notes },
        "Automation simulation completed; no provider contacted",
      );
      return;
    }
    if (kind === "evidence") {
      void run(
        {
          kind: "evidence",
          id: deposit.id,
          outcome,
          amount: evidenceAmount,
          confirmations,
          notes,
        },
        "Synthetic evidence recorded, not real provider confirmation",
      );
      return;
    }
    if (["reject", "proof", "retry", "refund", "note"].includes(kind))
      void run(
        {
          kind: kind as "reject" | "proof" | "retry" | "refund" | "note",
          id: deposit.id,
          notes,
        },
        kind === "proof"
          ? "Proof request draft saved locally; no message sent"
          : `Local ${kind} review recorded`,
      );
  }
  const isWizard = modal && wizards.includes(modal.kind),
    mutating =
      modal && [...wizards, "rules", "note", "reset"].includes(modal.kind),
    blocked =
      modal?.kind === "verify"
        ? reasons.length > 0
        : modal?.kind === "batch"
          ? !batchIds.length || batchReasons.length > 0
          : false;
  const footer = (
    <>
      <button
        className="dp-btn"
        disabled={disabled}
        onClick={() => (step ? setStep(step - 1) : close())}
      >
        {step ? "Back" : "Close"}
      </button>
      {mutating && !(modal?.kind === "record" && step === 0) && (
        <button
          className="dp-btn dp-primary"
          disabled={
            disabled ||
            blocked ||
            ((!isWizard || step === 2) &&
              (!confirmed || notes.trim().length < 10))
          }
          onClick={() => (isWizard && step < 2 ? setStep(step + 1) : submit())}
        >
          {disabled
            ? "Working…"
            : isWizard && step < 2
              ? "Continue →"
              : modal?.kind === "export"
                ? "Download report"
                : "Confirm local action"}
        </button>
      )}
    </>
  );
  return (
    <div className="dp-canvas">
      <header className="dp-header">
        <div>
          <div className="dp-eyebrow">
            <span className="dp-tag mono">D-11</span>OPERATOR CONSOLE / PAYMENT
            OPERATIONS
          </div>
          <h1>Deposit logs</h1>
          <p>
            A clear trail from payment claim to verification. Review evidence,
            reconcile exceptions, and keep every decision accountable.
          </p>
        </div>
        <div className="dp-actions">
          <button className="dp-btn" onClick={() => open("reconcile")}>
            <Icon name="split" size={14} />
            Reconcile
          </button>
          <button className="dp-btn" onClick={() => open("export")}>
            <Icon name="file" size={14} />
            Export report
          </button>
          <button className="dp-btn dp-primary" onClick={() => open("record")}>
            <Icon name="wallet" size={14} />
            Record deposit claim
          </button>
        </div>
      </header>
      <div className="dp-demo">
        <span className="dp-demo-tag">DEMO DEPOSIT LEDGER</span>
        <span>
          Independent synthetic records · no provider connection · no real
          wallet credits or refunds
        </span>
        <span className="mono">
          {time(data.asOf)} UTC · REV {data.revision}
        </span>
        <button className="dp-link" onClick={() => open("audit")}>
          Session evidence ↗
        </button>
      </div>
      {error && !modal && (
        <div className="dp-error" role="alert">
          {error}
        </div>
      )}
      <section className="dp-metrics" aria-label="Deposit summary">
        {(
          [
            [
              "Total received",
              totals.received,
              "Verified plus refunded historical receipts",
            ],
            [
              "Verified",
              totals.verified,
              "Currently verified, independent demo credits",
            ],
            [
              "Awaiting review",
              totals.pending,
              `${rows.filter(reviewable).length} claims in current filters`,
            ],
            [
              "Failed claims",
              totals.failed,
              "Unsettled failures; not received funds",
            ],
            [
              "Refunded",
              totals.refunded,
              "Seeded or simulated refund confirmations",
            ],
            [
              "Today's claims",
              totals.today,
              "All claim states, UTC source date",
            ],
            [
              "Avg. verification time",
              totals.avgMinutes,
              "Includes completed verification before refunds",
            ],
          ] as [string, number | null, string][]
        ).map(([label, value, detail], i) => (
          <Metric
            key={label}
            label={label}
            value={value}
            minutes={i === 6}
            detail={detail}
            onClick={() => {
              if (i === 6) {
                open("method");
                return;
              }
              if (i === 2) {
                document
                  .getElementById("deposit-queue")
                  ?.scrollIntoView({ behavior: "smooth" });
                return;
              }
              if (i === 5) {
                setFilters({
                  ...filters,
                  status: "all",
                  from: data.asOf.slice(0, 10),
                  to: data.asOf.slice(0, 10),
                });
                setPage(1);
                setSelected([]);
              } else
                change(
                  "status",
                  i === 1
                    ? "verified"
                    : i === 3
                      ? "failed"
                      : i === 4
                        ? "refunded"
                        : "all",
                );
              document
                .getElementById("deposit-ledger")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        ))}
      </section>
      <section className="dp-panel" id="deposit-ledger">
        <div className="dp-panel-head">
          <div>
            <span className="dp-section-code">01–02 / RECEIPTS & CLAIMS</span>
            <h2>Deposit ledger</h2>
            <p>
              Summary cards reflect these filters. All amounts are USD;
              “received” excludes failed and unverified claims.
            </p>
          </div>
          <div className="dp-actions">
            <button className="dp-btn" onClick={() => open("batch")}>
              Verify selected ({selected.length})
            </button>
            <button
              className="dp-link"
              onClick={() => {
                setFormat("csv");
                open("export");
              }}
            >
              CSV export ↗
            </button>
            <button
              className="dp-link"
              onClick={() => {
                setFormat("pdf");
                open("export");
              }}
            >
              PDF report ↗
            </button>
          </div>
        </div>
        <div className="dp-filterbar">
          <label className="dp-search">
            <Icon name="search" size={14} />
            <input
              aria-label="Search deposits"
              placeholder="Investor, deposit or reference…"
              value={filters.search}
              onChange={(e) => change("search", e.target.value)}
            />
          </label>
          {(["status", "method", "pool", "investor"] as const).map((key) => (
            <select
              className="dp-select"
              key={key}
              aria-label={`Deposit ${key} filter`}
              value={filters[key]}
              onChange={(e) => change(key, e.target.value as never)}
            >
              <option value="all">
                All{" "}
                {key === "pool"
                  ? "packages"
                  : key === "investor"
                    ? "investors"
                    : key + "s"}
              </option>
              {(key === "status"
                ? statuses.map((s) => ({ id: s, name: human(s) }))
                : key === "method"
                  ? methods.map((s) => ({ id: s, name: human(s) }))
                  : key === "pool"
                    ? data.pools.map((p) => ({ id: p.code, name: p.code }))
                    : data.investors
              ).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          ))}
          {(["from", "to"] as const).map((k) => (
            <label key={k} className="dp-date">
              {k} / UTC
              <input
                type="date"
                aria-label={`Deposit ${k} date`}
                value={filters[k]}
                onChange={(e) => change(k, e.target.value)}
              />
            </label>
          ))}
          <button
            className="dp-link"
            onClick={() => {
              setFilters(base);
              setSelected([]);
              setPage(1);
            }}
          >
            Reset filters
          </button>
        </div>
        {!validFilters.success && (
          <div role="alert" className="dp-error m-3">
            {validFilters.error.issues[0].message}
          </div>
        )}
        <div className="table-responsive">
          <table className="table dp-table dp-responsive">
            <thead>
              <tr>
                <th>Select</th>
                {table.getHeaderGroups()[0]?.headers.map((h) => (
                  <th key={h.id}>
                    <button onClick={h.column.getToggleSortingHandler()}>
                      {String(h.column.columnDef.header)}{" "}
                      {h.column.getIsSorted() === "desc" ? "↓" : "↕"}
                    </button>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ original: d }, index) => (
                <DepositRow
                  key={d.id}
                  d={d}
                  index={index}
                  selected={selected.includes(d.id)}
                  expanded={expanded === d.id}
                  onSelect={() =>
                    setSelected(
                      selected.includes(d.id)
                        ? selected.filter((id) => id !== d.id)
                        : [...selected, d.id],
                    )
                  }
                  onExpand={() => setExpanded(expanded === d.id ? null : d.id)}
                  onOpen={open}
                  onInspect={() => {
                    setModal(null);
                    setTab("context");
                    setDrawer(d.id);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="dp-empty">
            <h3>No matching deposits</h3>
            <p>
              Adjust the date, method or investor filters to restore the ledger.
            </p>
            <button className="dp-btn" onClick={() => setFilters(base)}>
              Restore full scope
            </button>
          </div>
        )}
        <div className="dp-panel-foot">
          <span>
            {rows.length} claims · {selected.length} selected ·
            sorting/filtering currently local; paginated read API available
          </span>
          <div className="dp-actions">
            <select
              className="dp-select"
              aria-label="Deposit page size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <div className="dp-pagination">
              <button
                aria-label="Previous deposit page"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                ←
              </button>
              <span>
                {current} / {pages}
              </span>
              <button
                aria-label="Next deposit page"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="dp-panel" id="deposit-queue">
        <div className="dp-panel-head">
          <div>
            <span className="dp-section-code">03 / VERIFICATION QUEUE</span>
            <h2>Evidence before approval</h2>
            <p>
              Full workspace queue, independent of ledger filters. KYC, exact
              amount matching and settlement evidence are mandatory.
            </p>
          </div>
          <button
            className="dp-btn"
            onClick={() => {
              setSelected([]);
              open("batch");
            }}
          >
            Review {eligible.length} eligible claims
          </button>
        </div>
        <div className="dp-queue-grid">
          {queue.map((d) => (
            <article className="dp-queue-card" key={d.id}>
              <div className="dp-queue-head">
                <span className="dp-tag mono">{d.id}</span>
                <Badge status={d.status} />
              </div>
              <h3>
                {d.investorName}
                <strong className="mono">{cash(d.amount)}</strong>
              </h3>
              <p>
                {human(d.method)} · {d.pool} · claimed {time(d.submittedAt)} UTC
              </p>
              <div className="dp-evidence-flags">
                <span>{d.proof ? "Proof attached" : "No proof"}</span>
                <span>
                  {blockers(d, data.rules).length
                    ? `${blockers(d, data.rules).length} review gates`
                    : "Eligible for local verification"}
                </span>
              </div>
              <div className="dp-actions">
                <button
                  className="dp-btn dp-primary"
                  onClick={() => open("verify", d.id)}
                >
                  Verify
                </button>
                <button className="dp-btn" onClick={() => open("reject", d.id)}>
                  Reject
                </button>
                <button className="dp-link" onClick={() => open("proof", d.id)}>
                  Request proof
                </button>
                <button
                  className="dp-link"
                  onClick={() => open("proofView", d.id)}
                >
                  View evidence ↗
                </button>
              </div>
            </article>
          ))}
        </div>
        {!queue.length && (
          <div className="dp-empty">
            <h3>Verification queue is clear</h3>
            <button className="dp-btn" onClick={() => open("record")}>
              Record a new claim
            </button>
          </div>
        )}
      </section>
      <section className="dp-panel">
        <div className="dp-panel-head">
          <div>
            <span className="dp-section-code">04 / PAYMENT METHODS</span>
            <h2>Method breakdown</h2>
            <p>
              Current ledger filters · fee terms are illustrative, not a fee
              charged to these receipts.
            </p>
          </div>
          <button className="dp-link" onClick={() => open("method")}>
            Review method evidence ↗
          </button>
        </div>
        <div className="dp-method-bars">
          {breakdown.map((m) => (
            <button
              key={m.method}
              onClick={() => {
                setMethod(m.method);
                open("method");
              }}
            >
              <span>
                {human(m.method)}
                <b className="mono">{cash(m.total)}</b>
              </span>
              <div className="dp-performance-track">
                <span
                  style={{
                    width: `${(m.total / Math.max(1, ...breakdown.map((x) => x.total))) * 100}%`,
                  }}
                />
              </div>
            </button>
          ))}
        </div>
        <div className="table-responsive">
          <table className="table dp-table dp-responsive">
            <thead>
              <tr>
                {[
                  "Method",
                  "Count",
                  "Claimed total",
                  "Verified %",
                  "Avg verification",
                  "Illustrative fees",
                ].map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdown.map((m) => (
                <tr key={m.method}>
                  <td data-label="Method">{human(m.method)}</td>
                  <td data-label="Count">{m.count}</td>
                  <td data-label="Claimed total" className="mono">
                    {cash(m.total)}
                  </td>
                  <td data-label="Verified %">
                    {m.verifiedRate === null
                      ? "N/A"
                      : `${m.verifiedRate.toFixed(1)}%`}
                  </td>
                  <td data-label="Avg verification">
                    {m.minutes === null
                      ? "N/A"
                      : `${Math.round(m.minutes)} min`}
                  </td>
                  <td data-label="Illustrative fees">{m.fees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="dp-panel">
        <div className="dp-panel-head">
          <div>
            <span className="dp-section-code">05 / EXCEPTION MANAGEMENT</span>
            <h2>Failed & refunded</h2>
            <p>
              Retry a failed review attempt or inspect a refund confirmation.
              Neither action moves real money.
            </p>
          </div>
          <button className="dp-link" onClick={() => open("reconcile")}>
            Open reconciliation ↗
          </button>
        </div>
        <div className="dp-queue-grid">
          {failures.map((d) => (
            <article className="dp-queue-card dp-exception" key={d.id}>
              <div className="dp-queue-head">
                <span className="mono">{d.id}</span>
                <Badge status={d.status} />
              </div>
              <h3>
                {d.investorName}
                <strong className="mono">{cash(d.amount)}</strong>
              </h3>
              <p>
                {d.failure
                  ? human(d.failure)
                  : `Confirmation: ${d.refundReference}`}{" "}
                · {human(d.method)}
              </p>
              <div className="dp-actions">
                {d.status === "failed" && (
                  <button
                    className="dp-btn"
                    onClick={() => open("retry", d.id)}
                  >
                    Retry review
                  </button>
                )}
                <button className="dp-btn" onClick={() => open("detail", d.id)}>
                  Inspect record
                </button>
                <button
                  className="dp-link"
                  onClick={() => open("contact", d.id)}
                >
                  Contact investor ↗
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="dp-panel">
        <div className="dp-panel-head">
          <div>
            <span className="dp-section-code">06 / UTC ACTIVITY</span>
            <h2>Deposit timeline · 24 hours</h2>
            <p>
              All submitted claims by four-hour UTC interval, including failed
              or refunded claims. Not a settlement-volume chart.
            </p>
          </div>
          <input
            aria-label="Timeline date"
            className="dp-select"
            type="date"
            max={data.asOf.slice(0, 10)}
            value={timelineDate}
            onChange={(e) => setTimelineDate(e.target.value)}
          />
        </div>
        <div className="dp-timeline">
          {buckets.map((b) => (
            <button
              key={b.hour}
              onClick={() => open("timeline", String(b.hour))}
            >
              <span>{b.label}</span>
              <div className="dp-timeline-track">
                <span
                  style={{ height: `${(b.total / Math.max(1, peak)) * 100}%` }}
                />
              </div>
              <b>{cash(b.total)}</b>
              <small>
                {b.count} claims {peak > 0 && b.total === peak ? "· peak" : ""}
              </small>
            </button>
          ))}
        </div>
      </section>
      <section className="dp-panel">
        <div className="dp-panel-head">
          <div>
            <span className="dp-section-code">07 / AUTOMATION SAFEGUARDS</span>
            <h2>Rules that protect the review desk</h2>
            <p>
              Local flags only. No background verification, signed webhook
              receiver or provider poller is running.
            </p>
          </div>
          <div className="dp-actions">
            <button className="dp-btn" onClick={() => open("rules")}>
              Edit & save rules
            </button>
            <button
              className="dp-btn dp-primary"
              onClick={() => open("automation")}
            >
              Preview automation run
            </button>
          </div>
        </div>
        <div className="dp-rules-summary">
          {Object.entries(data.rules).map(([key, value]) => (
            <div key={key}>
              <span>{human(key.replace(/([A-Z])/g, " $1").toLowerCase())}</span>
              <b>
                {typeof value === "boolean"
                  ? value
                    ? "Enabled"
                    : "Disabled"
                  : value}
              </b>
            </div>
          ))}
        </div>
        <div className="dp-note m-3">
          Amounts must match exactly to credit; the configurable ≤$1 threshold
          only controls escalation classification. Bank transfers remain manual,
          KYC cannot be bypassed, and expired claims with known settlement are
          never auto-rejected.
        </div>
      </section>
      <section>
        <div className="dp-section-head">
          <h2>Payment operations workbench</h2>
          <span className="dp-muted">REVIEW / RECONCILE / TRACE</span>
        </div>
        <div className="dp-workbench">
          {(
            [
              ["record", "wallet", "Record deposit claim"],
              ["batch", "check", "Batch verification"],
              ["reconcile", "split", "Reconcile provider evidence"],
              ["automation", "bolt", "Simulate automation"],
              ["export", "file", "Export deposit report"],
              ["audit", "activity", "Inspect session audit"],
            ] as const
          ).map(([kind, icon, label]) => (
            <button key={kind} onClick={() => open(kind)}>
              <Icon name={icon} size={16} />
              {label}
              <Icon name="arrowRight" size={13} />
            </button>
          ))}
        </div>
      </section>
      <footer className="dp-footer">
        <span>
          SYNTHETIC D-11 LEDGER / independent from D-8 treasury, D-9 payouts and
          investor wallets
        </span>
        <Link href="/dashboard/funds">Funds & treasury ↗</Link>
        <Link href="/dashboard/investors">Investor roster ↗</Link>
        <Link href="/dashboard/comms">Communications ↗</Link>
        <button className="dp-link" onClick={() => open("reset")}>
          Reset deposit workspace ↗
        </button>
      </footer>
      {modal && (
        <div className="dp-local-layer">
          <DeskModalShell
            code="D11"
            eyebrow="PAYMENT OPERATIONS / LOCAL DEMO"
            title={titles[modal.kind]}
            subtitle="Synthetic evidence only. Production verification requires authenticated provider records, reviewer authorization and an idempotent ledger transaction."
            size="xl"
            onClose={close}
            steps={
              isWizard
                ? [
                    "Scope & evidence",
                    "Review safeguards",
                    "Confirm local action",
                  ]
                : undefined
            }
            currentStep={step}
            footer={footer}
          >
            {error && (
              <div className="dp-error mb-3" role="alert">
                {error}
              </div>
            )}
            {modal.kind === "record" && step === 0 && (
              <RecordForm
                data={data}
                onReview={(v) => {
                  setRecord(v);
                  setStep(1);
                }}
              />
            )}
            {modal.kind === "record" && step === 1 && (
              <>
                <h3>New unverified claim</h3>
                <div className="dp-note">
                  {
                    data.investors.find((i) => i.id === record?.investorId)
                      ?.name
                  }{" "}
                  · {cash(record?.amount ?? 0)} · {human(record?.method ?? "")}{" "}
                  · {record?.pool}
                  <p>Reference: {record?.reference}</p>
                  {record?.notes}
                </div>
                <p>
                  This records a claim, not received funds. Provider outcome
                  starts unknown; no evidence artifact, verification or wallet
                  credit is created. Duplicate references are rejected.
                </p>
              </>
            )}
            {["verify", "batch"].includes(modal.kind) && step < 2 && (
              <>
                {modal.kind === "verify" ? (
                  facts()
                ) : (
                  <>
                    <h3>{batchIds.length} selected claims</h3>
                    <p>
                      {selected.length
                        ? "Explicit selection is checked atomically; any blocked record rejects the entire batch."
                        : "No selection: this scope includes only currently eligible workspace claims, up to 50."}
                    </p>
                    {batchIds.map((id) => (
                      <div className="dp-record" key={id}>
                        <b>{id}</b>
                        <span>
                          {data.deposits.find((d) => d.id === id)?.investorName}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                <h3 className="mt-3">
                  {step === 0
                    ? "Evidence gates"
                    : "Credit & duplicate safeguards"}
                </h3>
                {(modal.kind === "batch" ? batchReasons : reasons).length ? (
                  <div className="dp-error">
                    {(modal.kind === "batch" ? batchReasons : reasons).map(
                      (s, i) => (
                        <p key={i}>{s}</p>
                      ),
                    )}
                    <button
                      className="dp-btn"
                      onClick={() =>
                        open(
                          modal.kind === "batch" ? "reconcile" : "evidence",
                          modal.kind === "batch" ? undefined : deposit.id,
                        )
                      }
                    >
                      Review missing evidence
                    </button>
                  </div>
                ) : (
                  <div className="dp-note">
                    All current gates pass: KYC, proof, settled synthetic
                    evidence, exact amount, required confirmations/webhook and
                    no prior credit.
                  </div>
                )}
                <p>
                  Credit is added once to this independent local ledger. This
                  never updates real investor wallets, D-8 treasury or an
                  external accounting system.
                </p>
              </>
            )}
            {["reject", "proof", "retry", "refund"].includes(modal.kind) &&
              step < 2 && (
                <>
                  {facts()}
                  <div className="dp-note">
                    {modal.kind === "reject"
                      ? "Reject only an unresolved claim without known settlement. Settled money must be reconciled, not silently rejected."
                      : modal.kind === "proof"
                        ? "Save a local request draft asking for a redacted receipt, matching amount, reference and payment date. Do not request passwords, full bank credentials or private keys. No email or notification is sent."
                        : modal.kind === "retry"
                          ? "Retry only a failed, unsettled attempt. The reference and deposit identity stay unchanged, attempt count increments and status returns to pending. A retry never establishes settlement."
                          : "Refund only a verified, credited record. This simulation removes its credit from the independent demo ledger and generates a demo refund reference. No bank/card/crypto transfer is executed."}
                  </div>
                  {step === 1 && (
                    <>
                      <h3>Decision evidence</h3>
                      <p>
                        Current provider outcome:{" "}
                        <b>{deposit.provider.outcome}</b>. Attempts:{" "}
                        {deposit.attempts}. Local credited amount:{" "}
                        {cash(deposit.credited ? deposit.amount : 0)}.
                      </p>
                      {modal.kind === "refund" &&
                        deposit.status !== "verified" && (
                          <div className="dp-error">
                            Only a verified credited deposit can be refunded.
                          </div>
                        )}
                      {modal.kind === "reject" &&
                        deposit.provider.outcome === "settled" && (
                          <div className="dp-error">
                            Known settlement blocks rejection. Use
                            reconciliation to resolve this claim.
                          </div>
                        )}
                    </>
                  )}
                </>
              )}
            {modal.kind === "evidence" && step < 2 && (
              <>
                {facts()}
                {step === 0 ? (
                  <div className="dp-form-grid mt-3">
                    <label className="dp-field">
                      Simulated provider outcome
                      <select
                        className="form-select"
                        value={outcome}
                        onChange={(e) =>
                          setOutcome(e.target.value as typeof outcome)
                        }
                      >
                        {["settled", "unknown", "failed"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className="dp-field">
                      Provider amount / USD
                      <input
                        className="form-control"
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={evidenceAmount}
                        onChange={(e) =>
                          setEvidenceAmount(Number(e.target.value))
                        }
                      />
                    </label>
                    <label className="dp-field">
                      Crypto confirmations
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        max={100}
                        value={confirmations}
                        onChange={(e) =>
                          setConfirmations(Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="dp-note">
                    <b>Generating a synthetic fixture</b>
                    <p>
                      Creates a labeled local receipt/transaction artifact and
                      simulated webhook evidence, not an uploaded bank receipt
                      or authenticated provider response. KYC and amount gates
                      remain independently enforced.
                    </p>
                    {cash(evidenceAmount)} · {outcome} · {confirmations}{" "}
                    confirmations
                  </div>
                )}
              </>
            )}
            {modal.kind === "automation" && step < 2 && (
              <>
                <h3>
                  {step === 0
                    ? "Eligible automation candidates"
                    : "Automation safety policy"}
                </h3>
                <p>
                  {
                    eligible.filter(
                      (d) =>
                        d.method !== "bank_transfer" &&
                        (d.method === "crypto_usdt"
                          ? data.rules.crypto
                          : d.method === "card"
                            ? data.rules.card
                            : data.rules.mobile),
                    ).length
                  }{" "}
                  enabled-method claims currently meet every verification gate.
                </p>
                {queue.map((d) => (
                  <div className="dp-record" key={d.id}>
                    <b>
                      {d.id} · {d.investorName}
                    </b>
                    <span>
                      {blockers(d, data.rules).join("; ") ||
                      d.method === "bank_transfer"
                        ? d.method === "bank_transfer"
                          ? "Bank transfer: manual review"
                          : blockers(d, data.rules).join("; ")
                        : "Evidence gates pass"}
                    </span>
                  </div>
                ))}
                <div className="dp-note">
                  The local run rechecks the entire workspace atomically. Bank
                  transfers are never auto-verified. Missing-proof expiry
                  applies only to claims older than 24 hours without known
                  settlement, and only when explicitly enabled. No daemon or
                  provider webhook service runs.
                </div>
              </>
            )}
            {modal.kind === "export" && step < 2 && (
              <>
                {step === 0 ? (
                  <label className="dp-field">
                    Export format
                    <select
                      className="form-select"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                    >
                      <option value="csv">
                        CSV — formula-safe deposit cells
                      </option>
                      <option value="pdf">PDF — human-readable ledger</option>
                      <option value="json">
                        JSON — full synthetic evidence
                      </option>
                    </select>
                  </label>
                ) : (
                  <label className="dp-field">
                    Export scope
                    <select
                      className="form-select"
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                    >
                      <option value="filtered">
                        All {rows.length} matching filtered deposits
                      </option>
                      <option value="all">
                        Entire {data.deposits.length}-record workspace
                      </option>
                    </select>
                  </label>
                )}
                <p className="dp-note">
                  Exports include every matching row, not just the visible page.
                  Reports contain synthetic operational data, not proof of real
                  payment or provider settlement.
                </p>
              </>
            )}
            {isWizard && step === 2 && (
              <>
                <h3>{titles[modal.kind]} · final review</h3>
                <p>
                  Review the decision and record a meaningful reviewer reason.
                  The model rechecks all gates at confirmation; failures leave
                  the prior workspace unchanged.
                </p>
                {modal.kind !== "batch" &&
                  modal.kind !== "record" &&
                  modal.kind !== "export" &&
                  modal.kind !== "automation" &&
                  facts()}
                {confirmBox()}
              </>
            )}
            {modal.kind === "detail" && (
              <>
                {facts()}
                <div className="dp-actions my-3">
                  <button
                    className="dp-btn"
                    onClick={() => open("proofView", deposit.id)}
                  >
                    Payment proof
                  </button>
                  <button
                    className="dp-btn"
                    disabled={!reviewable(deposit)}
                    onClick={() => open("verify", deposit.id)}
                  >
                    Verify review
                  </button>
                  <button
                    className="dp-btn"
                    disabled={deposit.status !== "verified"}
                    onClick={() => open("refund", deposit.id)}
                  >
                    Refund simulation
                  </button>
                  <button
                    className="dp-btn"
                    onClick={() => open("note", deposit.id)}
                  >
                    Add note
                  </button>
                  <button
                    className="dp-btn"
                    onClick={() => open("contact", deposit.id)}
                  >
                    Investor context
                  </button>
                </div>
                {evidence()}
                <h3 className="mt-4">Reviewer notes</h3>
                {deposit.notes.map((n, i) => (
                  <p className="dp-note" key={i}>
                    {n}
                  </p>
                ))}
                <p className="mono dp-muted">
                  Submitted {time(deposit.submittedAt)} UTC · verified{" "}
                  {deposit.verifiedAt
                    ? time(deposit.verifiedAt)
                    : "not verified"}{" "}
                  · by {deposit.verifiedBy ?? "no reviewer"}
                </p>
                {deposit.refundReference && (
                  <div className="dp-note">
                    Refund confirmation: {deposit.refundReference} · synthetic
                    only
                  </div>
                )}
              </>
            )}
            {modal.kind === "proofView" && (
              <>
                {facts()}
                {evidence()}
                <button
                  className="dp-btn mt-3"
                  disabled={!reviewable(deposit) && deposit.status !== "failed"}
                  onClick={() => open("evidence", deposit.id)}
                >
                  Open explicit evidence simulator
                </button>
              </>
            )}
            {modal.kind === "contact" && (
              <>
                {facts()}
                <div className="dp-note">
                  Contact workflow: prepare a factual payment-reference query
                  through Communications. Do not promise verification or share
                  unredacted payment details. This page sends no messages.
                </div>
                <Link className="dp-btn dp-primary" href="/dashboard/comms">
                  Open communications composer ↗
                </Link>
                <Link className="dp-btn ms-2" href="/dashboard/investors">
                  Open investor roster ↗
                </Link>
                <button
                  className="dp-btn mt-3"
                  onClick={() =>
                    save(
                      `SYNTHETIC CONTACT BRIEF\nInvestor: ${deposit.investorName}\nDeposit: ${deposit.id}\nReference: ${deposit.reference}\nClaim: ${cash(deposit.amount)}\nStatus: ${deposit.status}\nPlease provide a redacted receipt and confirm payment date/reference. No credentials or private keys.`,
                      "text/plain",
                      `${deposit.id}-contact-brief.txt`,
                    )
                  }
                >
                  Download contact brief
                </button>
              </>
            )}
            {modal.kind === "rules" && (
              <>
                <div className="dp-rule-editor">
                  {(
                    [
                      "crypto",
                      "card",
                      "mobile",
                      "bank",
                      "crossCheck",
                      "flagMismatch",
                      "rejectExpired",
                    ] as const
                  ).map((k) => (
                    <label className="dp-check" key={k}>
                      <input
                        type="checkbox"
                        disabled={[
                          "bank",
                          "crossCheck",
                          "flagMismatch",
                        ].includes(k)}
                        checked={rules[k]}
                        onChange={(e) =>
                          setRules({ ...rules, [k]: e.target.checked })
                        }
                      />
                      {k === "crypto"
                        ? "Auto-verify crypto after confirmation threshold"
                        : k === "card"
                          ? "Auto-verify card after simulated authenticated webhook"
                          : k === "mobile"
                            ? "Auto-verify mobile money after simulated authenticated webhook"
                            : k === "bank"
                              ? "Auto-verify bank transfers (disabled: manual required)"
                              : k === "crossCheck"
                                ? "Cross-check claimed and provider amounts (required)"
                                : k === "flagMismatch"
                                  ? "Flag amount mismatches (required)"
                                  : "Reject proofless, unsettled claims after 24 hours"}
                    </label>
                  ))}
                </div>
                <div className="dp-form-grid my-3">
                  <label className="dp-field">
                    Required crypto confirmations (6–100)
                    <input
                      type="number"
                      className="form-control"
                      min={6}
                      max={100}
                      value={rules.confirmations}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          confirmations: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="dp-field">
                    Escalation threshold / USD (0–1)
                    <input
                      type="number"
                      className="form-control"
                      min={0}
                      max={1}
                      step="0.01"
                      value={rules.threshold}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          threshold: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                {confirmBox()}
              </>
            )}
            {["reconcile", "mismatch"].includes(modal.kind) && (
              <>
                <h3>Amount & evidence exceptions</h3>
                <button
                  className="dp-btn mb-3"
                  onClick={() =>
                    open(modal.kind === "mismatch" ? "reconcile" : "mismatch")
                  }
                >
                  {modal.kind === "mismatch"
                    ? "All reconciliation gates"
                    : "Show amount mismatches only"}
                </button>
                <p>
                  Exact matching is required for credit; differences above{" "}
                  {cash(data.rules.threshold)} are classified as escalations.
                  Resolve known settlements instead of rejecting them.
                </p>
                {queue
                  .filter(
                    (d) =>
                      modal.kind !== "mismatch" ||
                      Math.abs(d.amount - d.provider.amount) > 0.005,
                  )
                  .map((d) => (
                    <div className="dp-record" key={d.id}>
                      <div>
                        <b>
                          {d.id} · {d.investorName}
                        </b>
                        <small>
                          Claim {cash(d.amount)} / provider{" "}
                          {cash(d.provider.amount)} ·{" "}
                          {Math.abs(d.amount - d.provider.amount) >
                          data.rules.threshold
                            ? "Escalate mismatch"
                            : Math.abs(d.amount - d.provider.amount) > 0.005
                              ? "Mismatch: review"
                              : "Amount matches"}
                        </small>
                        <p>
                          {blockers(d, data.rules).join("; ") ||
                            "Eligible for manual verification"}
                        </p>
                      </div>
                      <button
                        className="dp-btn"
                        onClick={() => open("evidence", d.id)}
                      >
                        Evidence simulator
                      </button>
                      <button
                        className="dp-link"
                        onClick={() => open("verify", d.id)}
                      >
                        Verification gates ↗
                      </button>
                    </div>
                  ))}
                {!queue.length && <p>No unresolved claims in the workspace.</p>}
              </>
            )}
            {modal.kind === "method" && (
              <>
                <label className="dp-field mb-3">
                  Payment method
                  <select
                    className="form-select"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as Method)}
                  >
                    {methods.map((m) => (
                      <option key={m} value={m}>
                        {human(m)}
                      </option>
                    ))}
                  </select>
                </label>
                {breakdown
                  .filter((m) => m.method === method)
                  .map((m) => (
                    <div className="dp-note" key={m.method}>
                      {m.count} claims · {cash(m.total)} · verified{" "}
                      {m.verifiedRate === null
                        ? "N/A"
                        : m.verifiedRate.toFixed(1) + "%"}{" "}
                      · illustrative fee {m.fees}
                      <p>
                        Verification average uses records that reached
                        verification, including later refunds. Current verified
                        percentage uses currently verified records / all claims,
                        not settled volume.
                      </p>
                    </div>
                  ))}
                <button
                  className="dp-btn"
                  onClick={() => {
                    change("method", method);
                    close();
                    document
                      .getElementById("deposit-ledger")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Apply method to ledger
                </button>
              </>
            )}
            {modal.kind === "timeline" && (
              <>
                <h3>
                  {timelineDate} ·{" "}
                  {modal.id
                    ? `${modal.id}:00 UTC interval`
                    : "all four-hour intervals"}
                </h3>
                {data.deposits
                  .filter(
                    (d) =>
                      d.submittedAt.startsWith(timelineDate) &&
                      (!modal.id ||
                        Math.floor(Number(d.submittedAt.slice(11, 13)) / 4) *
                          4 ===
                          Number(modal.id)),
                  )
                  .map((d) => (
                    <div className="dp-record" key={d.id}>
                      <div>
                        <b>
                          {d.investorName} · {cash(d.amount)}
                        </b>
                        <small>
                          {time(d.submittedAt)} UTC · {d.id}
                        </small>
                      </div>
                      <Badge status={d.status} />
                      <button
                        className="dp-link"
                        onClick={() => open("detail", d.id)}
                      >
                        Inspect ↗
                      </button>
                    </div>
                  ))}
                {!data.deposits.some(
                  (d) =>
                    d.submittedAt.startsWith(timelineDate) &&
                    (!modal.id ||
                      Math.floor(Number(d.submittedAt.slice(11, 13)) / 4) *
                        4 ===
                        Number(modal.id)),
                ) && (
                  <div className="dp-note">
                    No deposit claims in this interval. Empty intervals are
                    observations, not missing data.
                  </div>
                )}
              </>
            )}
            {modal.kind === "audit" && (
              <>
                <p>
                  Append-only local decisions with reasons. Reset/reload
                  restores the initial snapshot. This is not a production audit
                  service.
                </p>
                {data.audit.map((a) => (
                  <div className="dp-record" key={a.id}>
                    <div>
                      <b>
                        {human(a.action)} · {a.reference}
                      </b>
                      <small>{time(a.time)} UTC</small>
                      <p>{a.notes}</p>
                    </div>
                  </div>
                ))}
                <button
                  className="dp-btn mt-3"
                  onClick={() =>
                    save(
                      JSON.stringify(data.audit, null, 2),
                      "application/json",
                      "deposit-session-audit.json",
                    )
                  }
                >
                  Download local audit
                </button>
                <div className="dp-note">
                  Opening credits {cash(data.openingCredit)} + local net changes{" "}
                  {cash(data.localCredit)} ={" "}
                  {cash(data.openingCredit + data.localCredit)}. This invariant
                  reconciles this demo only.
                </div>
              </>
            )}
            {modal.kind === "note" && (
              <>
                {facts()}
                <p className="dp-note">
                  Append a reviewer observation without changing payment status
                  or provider evidence. Existing notes are retained.
                </p>
                {confirmBox()}
              </>
            )}
            {modal.kind === "reset" && (
              <>
                <p>
                  Discard local deposit claims, evidence simulations,
                  credit/refund transitions, notes and rule edits. Restore the
                  synthetic source snapshot. Other dashboard modules are
                  unaffected.
                </p>
                {confirmBox()}
              </>
            )}
          </DeskModalShell>
        </div>
      )}
      {drawer && (
        <div
          className="dp-local-layer dp-drawer-layer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <aside
            className="dp-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Deposit right inspector"
          >
            <header>
              <div>
                <span className="dp-section-code">D11 / PAYMENT INSPECTOR</span>
                <h2>{deposit.id}</h2>
              </div>
              <button
                className="dp-icon-button"
                aria-label="Close deposit inspector"
                onClick={close}
              >
                <Icon name="close" size={17} />
              </button>
            </header>
            <nav>
              {["context", "evidence", "history"].map((t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="dp-drawer-body">
              {tab === "context" && (
                <>
                  {facts()}
                  <p className="dp-note">
                    {reasons.join("; ") || "All verification gates pass."}
                  </p>
                  <Link href="/dashboard/investors" className="dp-btn">
                    Investor roster ↗
                  </Link>
                </>
              )}
              {tab === "evidence" && evidence()}
              {tab === "history" && (
                <>
                  {deposit.notes.map((n, i) => (
                    <p key={i} className="dp-note">
                      {n}
                    </p>
                  ))}
                  <p>
                    Attempts: {deposit.attempts} · verified by:{" "}
                    {deposit.verifiedBy ?? "no reviewer"}
                  </p>
                  {deposit.refundReference && (
                    <p>Refund reference: {deposit.refundReference}</p>
                  )}
                </>
              )}
            </div>
            <footer>
              <button
                className="dp-btn"
                onClick={() => open("detail", deposit.id)}
              >
                Full detail
              </button>
              <button
                className="dp-btn dp-primary"
                disabled={!reviewable(deposit)}
                onClick={() => open("verify", deposit.id)}
              >
                Review verification
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
function DepositRow({
  d,
  index,
  selected,
  expanded,
  onSelect,
  onExpand,
  onOpen,
  onInspect,
}: {
  d: Deposit;
  index: number;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onExpand: () => void;
  onOpen: (kind: Kind, id?: string) => void;
  onInspect: () => void;
}) {
  return (
    <>
      <tr
        className="dp-ledger-row"
        style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
      >
        <td data-label="Select">
          <input
            type="checkbox"
            aria-label={`Select ${d.id}`}
            disabled={!reviewable(d)}
            checked={selected}
            onChange={onSelect}
          />
        </td>
        <td data-label="Deposit">
          <button
            className="dp-link mono"
            aria-expanded={expanded}
            onClick={onExpand}
          >
            {expanded ? "−" : "+"} {d.id}
          </button>
        </td>
        <td data-label="Date / UTC" className="mono">
          {time(d.submittedAt)}
        </td>
        <td data-label="Investor">
          <button className="dp-link" onClick={() => onOpen("contact", d.id)}>
            {d.investorName}
          </button>
        </td>
        <td data-label="Amount / USD" className="mono">
          {cash(d.amount)}
        </td>
        <td data-label="Method">{human(d.method)}</td>
        <td data-label="Package" className="mono">
          {d.pool}
        </td>
        <td data-label="Status">
          <Badge status={d.status} />
        </td>
        <td data-label="Reference" className="mono dp-reference">
          {d.reference}
        </td>
        <td data-label="Verified by">{d.verifiedBy ?? "Not verified"}</td>
        <td data-label="Actions">
          <div className="dp-row-actions">
            <button onClick={() => onOpen("detail", d.id)}>Detail</button>
            <button aria-label={`Inspect ${d.id}`} onClick={onInspect}>
              Inspector ↗
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="dp-expanded">
          <td colSpan={11}>
            <div className="dp-expanded-content">
              <b>Full payment reference: {d.reference}</b>
              <span>
                Provider: {d.provider.reference} · {d.provider.outcome} ·{" "}
                {cash(d.provider.amount)} · proof{" "}
                {d.proof?.id ?? "not attached"}
              </span>
              <span>Notes: {d.notes.join(" / ")}</span>
              <button
                className="dp-link"
                onClick={() => onOpen("proofView", d.id)}
              >
                Open proof viewer ↗
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
export function DepositsPage({
  operatorBundle,
  initial,
}: {
  operatorBundle: OperatorBundleProps;
  initial: DepositBundle;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-deposits" bundle={operatorBundle}>
      {() => <DepositDesk initial={initial} />}
    </OperatorShell>
  );
}
