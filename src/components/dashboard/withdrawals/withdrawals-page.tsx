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
import { usePayouts } from "@/lib/payouts/use-payouts";
import {
  approvalBlockers,
  autoEligible,
  feeFor,
  getPayoutSummary,
  money,
  payoutHistory,
  payoutDateRangeSchema,
  queueStatuses,
  type PayoutCommand,
  type RequestDraft,
} from "@/lib/payouts/model";
import type {
  PayoutBundle,
  PayoutRequest,
  PayoutSettings,
  ProviderOutcome,
} from "@/lib/payouts/types";
import { PayoutRequestForm, PayoutSettingsForm } from "./forms";
import { PayoutHistoryChart } from "./history-chart";
const cash = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const human = (s: string) => s.replaceAll("_", " ");
const time = (s: string | null) =>
  s ? s.replace("T", " ").slice(0, 16) : "Not recorded";
const col = createDeskColumnHelper<PayoutRequest>();
const methods = ["bank_transfer", "mobile_money", "crypto_usdt", "card"];
type Kind =
  | "request"
  | "approve"
  | "bulkApprove"
  | "reject"
  | "bulkReject"
  | "info"
  | "detail"
  | "investor"
  | "beneficiary"
  | "batch"
  | "evidence"
  | "callback"
  | "complete"
  | "fail"
  | "retry"
  | "refund"
  | "contact"
  | "policy"
  | "export"
  | "day"
  | "method"
  | "audit"
  | "auto"
  | "reset";
const titles: Record<Kind, string> = {
  request: "Create local payout request",
  approve: "Review payout approval",
  bulkApprove: "Bulk approval review",
  reject: "Reject payout request",
  bulkReject: "Bulk rejection review",
  info: "Request payout information",
  detail: "Payout request dossier",
  investor: "Investor wallet context",
  beneficiary: "Demo beneficiary verification",
  batch: "Batch processing review",
  evidence: "Provider evidence record",
  callback: "Simulate provider callback",
  complete: "Confirm settled payout",
  fail: "Record failed transfer",
  retry: "Retry payout attempt",
  refund: "Release failed payout to wallet",
  contact: "Contact investor draft",
  policy: "Review payout policy",
  export: "Export payout report",
  day: "Daily payout settlements",
  method: "Payout rail & fee guide",
  audit: "Payout audit trail",
  auto: "Auto-approval rule preview",
  reset: "Reset local payout workspace",
};
const steps: Partial<Record<Kind, string[]>> = {
  request: ["Request details", "Wallet reservation", "Confirm"],
  approve: ["Eligibility", "Execution choice", "Confirm"],
  bulkApprove: ["Selected requests", "Execution choice", "Confirm"],
  bulkReject: ["Selected requests", "Rejection reason", "Confirm"],
  beneficiary: ["Route details", "Review evidence", "Confirm"],
  batch: ["Scheduled requests", "Liquidity check", "Confirm"],
  callback: ["Provider scenario", "Attempt binding", "Confirm"],
  complete: ["Settlement evidence", "Ledger impact", "Confirm"],
  retry: ["Previous attempt", "New attempt", "Confirm"],
  refund: ["Failure evidence", "Wallet release", "Confirm"],
  export: ["Format", "Report scope", "Download"],
  auto: ["Eligibility preview", "Scheduled approvals", "Confirm"],
};
function download(content: string, type: string, name: string) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function Status({ value }: { value: string }) {
  return (
    <span className={`wd-status wd-status-${value}`}>
      {["completed", "settled"].includes(value)
        ? "✓ "
        : ["processing", "unknown"].includes(value)
          ? "◌ "
          : "○ "}
      {human(value)}
    </span>
  );
}
function Metric({
  label,
  value,
  count,
  detail,
  minutes,
  onClick,
  icon,
}: {
  label: string;
  value: number | null;
  count?: number;
  detail: string;
  minutes?: boolean;
  onClick: () => void;
  icon: IconName;
}) {
  const n = useLiveCountUp(value ?? 0);
  return (
    <button className="wd-metric" onClick={onClick}>
      <div>
        <span>{label}</span>
        <Icon name={icon} size={16} />
      </div>
      <strong className="mono">
        {value === null ? "N/A" : minutes ? `${n.toFixed(0)}m` : cash(n)}
      </strong>
      <small>
        {count !== undefined && <b className="mono">{count} requests</b>}
        <span>{detail} ↗</span>
      </small>
    </button>
  );
}
function PayoutFacts({ r }: { r: PayoutRequest }) {
  return (
    <dl className="wd-facts">
      {[
        ["Investor", r.investorName],
        ["Package / reason", `${r.pool} / ${human(r.reason)}`],
        ["Gross reservation", cash(r.amount)],
        ["Recipient net / fee", `${cash(r.net)} / ${cash(r.fee)}`],
        ["Payment rail", human(r.method)],
        ["Destination", r.beneficiary.masked],
        ["Requested / UTC", time(r.requestedAt)],
        ["Attempt / status", `${r.attempts} / ${human(r.status)}`],
      ].map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
function Evidence({ r }: { r: PayoutRequest }) {
  return (
    <>
      <div className="wd-evidence-state">
        <Icon name="shield" size={22} />
        <div>
          <b>Provider outcome</b>
          <Status value={r.providerOutcome} />
          <small>
            Typed synthetic evidence, not a live authenticated provider response
          </small>
        </div>
      </div>
      <dl className="wd-facts">
        <div>
          <dt>Provider reference</dt>
          <dd className="mono">{r.providerReference ?? "Not submitted"}</dd>
        </div>
        <div>
          <dt>Attempt</dt>
          <dd>{r.attempts}</dd>
        </div>
        <div>
          <dt>Started / UTC</dt>
          <dd>{time(r.startedAt)}</dd>
        </div>
        <div>
          <dt>Failure code</dt>
          <dd>{r.failureCode ? human(r.failureCode) : "None recorded"}</dd>
        </div>
      </dl>
      <div className="wd-note">
        <Icon name="info" size={17} />
        Unknown outcomes must be investigated, not retried or refunded.
        Completion requires settled evidence; retry/release requires confirmed
        not-paid evidence.
      </div>
    </>
  );
}
function WithdrawalsDesk({ initial }: { initial: PayoutBundle }) {
  const { pushToast } = useOperatorUI();
  const { data, mutation, reset } = usePayouts(initial);
  const summary = getPayoutSummary(data);
  const [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState("summary");
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processNow, setProcessNow] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [queueFilter, setQueueFilter] = useState("all");
  const [queuePage, setQueuePage] = useState(1);
  const [queueSort, setQueueSort] = useState<SortingState>([
    { id: "requestedAt", desc: true },
  ]);
  const [completedSort, setCompletedSort] = useState<SortingState>([
    { id: "completedAt", desc: true },
  ]);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedMethod, setCompletedMethod] = useState("all");
  const [completedSearch, setCompletedSearch] = useState("");
  const endDay = data.asOf.slice(0, 10),
    defaultFrom = new Date(Date.parse(endDay) - 29 * 86400000)
      .toISOString()
      .slice(0, 10);
  const [period, setPeriod] = useState({ from: defaultFrom, to: endDay });
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(endDay);
  const [dateError, setDateError] = useState("");
  const [historyDays, setHistoryDays] = useState(30);
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportScope, setExportScope] = useState("filtered");
  const [subject, setSubject] = useState("");
  const [callbackOutcome, setCallbackOutcome] =
    useState<Exclude<ProviderOutcome, "not_sent">>("unknown");
  const [beneficiaryMasked, setBeneficiaryMasked] = useState("");
  const [beneficiaryToken, setBeneficiaryToken] = useState("");
  const [policyDraft, setPolicyDraft] = useState<PayoutSettings>(data.settings);
  const [requestDraft, setRequestDraft] = useState<RequestDraft>({
    investorId: data.investors.find((i) => i.pools.length)!.id,
    pool: data.investors.find((i) => i.pools.length)!.pools[0],
    amount: 100,
    method: "bank_transfer",
    reason: "partial_payout",
  });
  const request =
    data.requests.find((r) => r.id === modal?.id) ?? data.requests[0];
  const owner =
    data.investors.find(
      (i) =>
        i.id === (modal?.kind === "investor" ? modal.id : request.investorId),
    ) ?? data.investors[0];
  const inspected = data.requests.find((r) => r.id === drawer);
  const reviewed = reviewIds
    .map((id) => data.requests.find((r) => r.id === id))
    .filter((r): r is PayoutRequest => !!r);
  const reviewTotal = money(reviewed.reduce((n, r) => n + r.amount, 0));
  const blockers = reviewed.flatMap((r) =>
    approvalBlockers(data, r).map((b) => `${r.id}: ${b}`),
  );
  const pending = data.requests.filter((r) => queueStatuses.includes(r.status));
  const processing = data.requests.filter((r) => r.status === "processing");
  const failed = data.requests.filter((r) => r.status === "failed");
  const history = payoutHistory(data, historyDays);
  const dayRows = data.requests.filter(
    (r) =>
      r.status === "completed" && r.completedAt?.slice(0, 10) === modal?.id,
  );
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("requestedAt", { header: "Requested / UTC" }),
        col.accessor("investorName", { header: "Investor" }),
        col.accessor("amount", { header: "Gross amount" }),
        col.accessor("method", { header: "Method" }),
        col.accessor("reason", { header: "Reason" }),
        col.accessor("pool", { header: "Package" }),
      ]),
    [],
  );
  const completedColumns = useMemo(
    () =>
      col.columns([
        col.accessor("completedAt", { header: "Completed / UTC" }),
        col.accessor("investorName", { header: "Investor" }),
        col.accessor("amount", { header: "Gross" }),
        col.accessor("net", { header: "Net to investor" }),
        col.accessor("fee", { header: "Fee" }),
        col.accessor("method", { header: "Method" }),
        col.accessor("providerReference", { header: "Reference" }),
      ]),
    [],
  );
  const queueRows = pending.filter(
    (r) =>
      (method === "all" || r.method === method) &&
      (queueFilter === "all" || r.status === queueFilter) &&
      `${r.id} ${r.investorName} ${r.pool}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const completedRows = data.requests.filter(
    (r) =>
      r.status === "completed" &&
      r.completedAt!.slice(0, 10) >= period.from &&
      r.completedAt!.slice(0, 10) <= period.to &&
      (completedMethod === "all" || r.method === completedMethod) &&
      `${r.id} ${r.investorName} ${r.providerReference}`
        .toLowerCase()
        .includes(completedSearch.toLowerCase()),
  );
  const queueTable = useDeskTable({
    data: queueRows,
    columns,
    state: { sorting: queueSort },
    onSortingChange: (u) => {
      setQueueSort(typeof u === "function" ? u(queueSort) : u);
      setQueuePage(1);
    },
  });
  const doneTable = useDeskTable({
    data: completedRows,
    columns: completedColumns,
    state: { sorting: completedSort },
    onSortingChange: (u) => {
      setCompletedSort(typeof u === "function" ? u(completedSort) : u);
      setCompletedPage(1);
    },
  });
  const queuePages = Math.max(1, Math.ceil(queueRows.length / 5)),
    safeQueuePage = Math.min(queuePage, queuePages);
  const donePages = Math.max(1, Math.ceil(completedRows.length / 8)),
    safeDonePage = Math.min(completedPage, donePages);
  const visibleQueue = queueTable
    .getRowModel()
    .rows.slice((safeQueuePage - 1) * 5, safeQueuePage * 5);
  const visibleDone = doneTable
    .getRowModel()
    .rows.slice((safeDonePage - 1) * 8, safeDonePage * 8);
  const overlayOpen = !!modal || !!drawer;
  useEffect(() => {
    if (!overlayOpen) return;
    const before = document.activeElement as HTMLElement | null;
    const layer = document.querySelector<HTMLElement>(
      ".page-dashboard-withdrawals .wd-local-layer",
    );
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        layer?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((e) => e.getClientRects().length);
    focusables()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !mutation.isPending) {
        setModal(null);
        setDrawer(null);
      }
      if (e.key === "Tab") {
        const nodes = focusables();
        if (!nodes.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
      before?.focus();
    };
  }, [overlayOpen, modal?.kind, drawer, busy, mutation.isPending]);
  function open(kind: Kind, id?: string) {
    setDrawer(null);
    setStep(0);
    setNotes("");
    setError("");
    setConfirmed(false);
    setProcessNow(false);
    setSubject("");
    if (kind === "auto") setReviewIds(autoEligible(data).map((r) => r.id));
    else if (kind === "batch")
      setReviewIds(
        data.requests.filter((r) => r.status === "approved").map((r) => r.id),
      );
    else setReviewIds(id ? [id] : selection);
    if (kind === "beneficiary") {
      const r = data.requests.find((r) => r.id === id)!;
      setBeneficiaryMasked(r.beneficiary.masked);
      setBeneficiaryToken(r.beneficiary.token);
    }
    if (kind === "callback") {
      const outcome = data.requests.find((r) => r.id === id)?.providerOutcome;
      setCallbackOutcome(
        outcome && outcome !== "not_sent" ? outcome : "unknown",
      );
    }
    setModal({ kind, id });
  }
  function inspect(id: string) {
    setModal(null);
    setDrawerTab("summary");
    setDrawer(id);
  }
  function close() {
    if (!busy && !mutation.isPending) {
      setModal(null);
      setDrawer(null);
    }
  }
  async function commit(command: PayoutCommand, message: string) {
    setError("");
    try {
      await mutation.mutateAsync(command);
      setSelection([]);
      setModal(null);
      pushToast({ tone: "success", title: message });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to change the local payout workspace.",
      );
    }
  }
  function clearQueue() {
    setSearch("");
    setMethod("all");
    setQueueFilter("all");
    setQueuePage(1);
    setSelection([]);
  }
  function consent(
    text = "I understand this is a local demo transition. No real transfer, provider request, email or wallet mutation is executed.",
  ) {
    return (
      <label className="wd-check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {text}
      </label>
    );
  }
  function notesField(label = "Reviewer notes") {
    return (
      <label className="wd-field">
        {label}
        <textarea
          className="form-control"
          rows={4}
          maxLength={1000}
          minLength={10}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <small>
          10–1,000 characters. Stored in the local session audit trail.
        </small>
      </label>
    );
  }
  function reviewList() {
    return (
      <>
        <div className="wd-review-list">
          {reviewed.map((r) => (
            <div key={r.id}>
              <span className="mono">{r.id}</span>
              <b>{r.investorName}</b>
              <span>{cash(r.amount)}</span>
              <Status value={r.status} />
              {approvalBlockers(data, r).length > 0 && (
                <small className="text-loss">
                  {approvalBlockers(data, r).join(" ")}
                </small>
              )}
            </div>
          ))}
        </div>
        <div className="wd-review-total">
          <span>{reviewed.length} requests</span>
          <b className="mono">{cash(reviewTotal)} gross</b>
        </div>
        {!reviewed.length && (
          <p className="wd-muted">
            No eligible requests in this scope. Review the queue or payout
            policy before starting a batch.
          </p>
        )}
      </>
    );
  }
  function paginate(kind: "queue" | "done") {
    const current = kind === "queue" ? safeQueuePage : safeDonePage,
      total = kind === "queue" ? queuePages : donePages,
      set = kind === "queue" ? setQueuePage : setCompletedPage;
    return (
      <div className="wd-pagination">
        <button
          aria-label={`Previous ${kind} page`}
          disabled={current === 1}
          onClick={() => set(current - 1)}
        >
          ←
        </button>
        <span>
          {current} / {total}
        </span>
        <button
          aria-label={`Next ${kind} page`}
          disabled={current === total}
          onClick={() => set(current + 1)}
        >
          →
        </button>
      </div>
    );
  }
  function dateApply() {
    if (!payoutDateRangeSchema.safeParse({ from, to }).success || to > endDay) {
      setDateError(
        "Choose a valid ordered UTC range no later than the snapshot day.",
      );
      return;
    }
    setPeriod({ from, to });
    setCompletedPage(1);
    setDateError("");
  }
  async function exportReport() {
    setBusy(true);
    setError("");
    try {
      const rows =
        exportScope === "filtered"
          ? completedRows
          : exportScope === "all"
            ? data.requests
            : selection
                .map((id) => data.requests.find((r) => r.id === id))
                .filter((r): r is PayoutRequest => !!r);
      if (exportFormat === "json")
        download(
          JSON.stringify(
            {
              mode: "demo",
              baseSnapshot: data.asOf,
              revision: data.revision,
              scope: exportScope,
              summary,
              requests: rows,
              settings: data.settings,
              cashLedger: data.cashLedger,
              audit: data.audit,
            },
            null,
            2,
          ),
          "application/json",
          "trademo-payouts.json",
        );
      else if (exportFormat === "csv") {
        const quote = (v: unknown) => {
          let s = String(v ?? "");
          if (/^[=+\-@]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        };
        download(
          [
            [
              "id",
              "requested_utc",
              "completed_utc",
              "investor",
              "gross_usd",
              "fee_usd",
              "net_usd",
              "method",
              "package",
              "status",
              "provider_reference",
            ],
            ...rows.map((r) => [
              r.id,
              r.requestedAt,
              r.completedAt ?? "",
              r.investorName,
              r.amount,
              r.fee,
              r.net,
              r.method,
              r.pool,
              r.status,
              r.providerReference ?? "",
            ]),
          ]
            .map((r) => r.map(quote).join(","))
            .join("\r\n"),
          "text/csv;charset=utf-8",
          "trademo-payouts.csv",
        );
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        let y = 22;
        const line = (text: string, bold = false) => {
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setFontSize(bold ? 13 : 10);
          for (const part of doc.splitTextToSize(text, 175)) {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.text(part, 18, y);
            y += 7;
          }
          y += 2;
        };
        line("tradeMO / Payout operations", true);
        line(`DEMO ONLY / ${time(data.asOf)} UTC / revision ${data.revision}`);
        line(
          `Pending ${cash(summary.pending)} / Processing ${cash(summary.processing)} / Completed ${cash(summary.completed)}`,
        );
        line(
          `Report scope: ${exportScope}; ${rows.length} rows. Gross = recipient net + fee.`,
        );
        rows.forEach((r) =>
          line(
            `${r.id} / ${r.investorName} / ${cash(r.amount)} gross / ${cash(r.fee)} fee / ${r.status}`,
          ),
        );
        line(
          "Synthetic records, not bank receipts, executed transfers or audited financial statements. Local actions reset on reload.",
        );
        doc.save("trademo-payout-operations.pdf");
      }
      setModal(null);
      pushToast({ tone: "success", title: "Payout report downloaded" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate report.");
    } finally {
      setBusy(false);
    }
  }
  const validNotes = notes.trim().length >= 10,
    disabled = busy || mutation.isPending;
  const noMoneyConsent = step === 2 && !confirmed;
  const currentBlocks = approvalBlockers(data, request);
  const eligibleSelection = reviewed.length > 0 && !blockers.length;
  function footer() {
    if (!modal) return null;
    const k = modal.kind;
    const back = (
      <button
        className="wd-btn"
        disabled={disabled}
        onClick={() => (step ? setStep(step - 1) : close())}
      >
        {step ? "Back" : "Cancel"}
      </button>
    );
    const next = (
      action: () => void,
      label = "Continue →",
      blocked = false,
    ) => (
      <button
        className="wd-btn wd-primary"
        disabled={disabled || blocked}
        onClick={action}
      >
        {disabled ? "Working…" : label}
      </button>
    );
    if (k === "request")
      return step === 0 ? (
        back
      ) : (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    {
                      kind: "request",
                      request: requestDraft,
                      notes:
                        "Operator recorded a synthetic payout request; settlement and beneficiary approval are not implied.",
                    },
                    "Request reserved in local wallet; no transfer sent",
                  ),
            step < 2 ? "Continue →" : "Reserve demo request",
            noMoneyConsent,
          )}
        </>
      );
    if (["approve", "bulkApprove", "auto"].includes(k))
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    {
                      kind: "approve",
                      ids: reviewIds,
                      processNow: k === "auto" ? false : processNow,
                      notes,
                    },
                    "Payout approval recorded locally; no provider call",
                  ),
            step < 2 ? "Continue →" : "Apply local approval",
            !eligibleSelection ||
              reviewTotal > summary.available ||
              (step === 1 && !validNotes) ||
              noMoneyConsent,
          )}
        </>
      );
    if (k === "bulkReject")
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    { kind: "reject", ids: reviewIds, notes },
                    "Requests rejected; local wallet holds released",
                  ),
            step < 2 ? "Continue →" : "Reject selected locally",
            !reviewed.length || (step === 1 && !validNotes) || noMoneyConsent,
          )}
        </>
      );
    if (k === "reject" || k === "info" || k === "fail" || k === "contact")
      return (
        <>
          {back}
          {next(
            () =>
              void commit(
                k === "reject"
                  ? { kind: "reject", ids: [request.id], notes }
                  : k === "info"
                    ? { kind: "info", id: request.id, notes }
                    : k === "fail"
                      ? { kind: "fail", id: request.id, notes }
                      : { kind: "contact", id: request.id, subject, notes },
                k === "contact"
                  ? "Contact draft logged locally; no message delivered"
                  : "Local payout review updated",
              ),
            k === "reject"
              ? "Reject locally"
              : k === "info"
                ? "Log information request"
                : k === "fail"
                  ? "Record confirmed failure"
                  : "Save contact draft",
            !validNotes ||
              !confirmed ||
              (k === "contact" && subject.trim().length < 5) ||
              (k === "fail" && request.providerOutcome !== "failed"),
          )}
        </>
      );
    if (k === "batch")
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    { kind: "batch", ids: reviewIds, notes },
                    "Batch started in local simulation; no jobs queued",
                  ),
            step < 2 ? "Continue →" : "Simulate batch start",
            !eligibleSelection || (step === 1 && !validNotes) || noMoneyConsent,
          )}
        </>
      );
    if (k === "callback")
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    {
                      kind: "callback",
                      id: request.id,
                      attempt: request.attempts,
                      reference: request.providerReference ?? "",
                      outcome: callbackOutcome,
                      notes,
                    },
                    "Synthetic callback recorded; no provider was contacted",
                  ),
            step < 2 ? "Continue →" : "Record demo callback",
            (step === 1 && !validNotes) || noMoneyConsent,
          )}
        </>
      );
    if (["complete", "retry", "refund"].includes(k))
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    k === "complete"
                      ? { kind: "complete", id: request.id, notes }
                      : k === "retry"
                        ? { kind: "retry", id: request.id, notes }
                        : { kind: "refund", id: request.id, notes },
                    k === "complete"
                      ? "Settlement completed in local ledger only"
                      : k === "retry"
                        ? "New local attempt started; no transfer submitted"
                        : "Local wallet reservation released; no external refund",
                  ),
            step < 2
              ? "Continue →"
              : k === "complete"
                ? "Complete demo settlement"
                : k === "retry"
                  ? "Start demo retry"
                  : "Release local wallet hold",
            (k === "complete" && request.providerOutcome !== "settled") ||
              (k !== "complete" && request.providerOutcome !== "failed") ||
              (k === "retry" &&
                (!!currentBlocks.length ||
                  request.amount > summary.available)) ||
              (step === 1 && !validNotes) ||
              noMoneyConsent,
          )}
        </>
      );
    if (k === "beneficiary")
      return (
        <>
          {back}
          {next(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    {
                      kind: "beneficiary",
                      id: request.id,
                      masked: beneficiaryMasked,
                      token: beneficiaryToken,
                      notes,
                    },
                    "Synthetic beneficiary route verified locally",
                  ),
            step < 2 ? "Continue →" : "Verify demo route",
            beneficiaryMasked.trim().length < 6 ||
              beneficiaryToken.trim().length < 8 ||
              (step === 1 && !validNotes) ||
              noMoneyConsent,
          )}
        </>
      );
    if (k === "policy")
      return (
        <>
          {back}
          {next(
            () =>
              void commit(
                { kind: "settings", settings: policyDraft, notes },
                "Payout policy updated locally; no scheduler created",
              ),
            "Save local settings",
            !validNotes || !confirmed,
          )}
        </>
      );
    if (k === "export")
      return (
        <>
          {back}
          {next(
            () => (step < 2 ? setStep(step + 1) : void exportReport()),
            step < 2 ? "Continue →" : "Download report",
            noMoneyConsent ||
              (exportScope === "selected" && !selection.length && step > 0),
          )}
        </>
      );
    if (k === "reset")
      return (
        <>
          {back}
          {next(
            () => {
              reset();
              clearQueue();
              setModal(null);
              pushToast({
                tone: "info",
                title: "Payout workspace restored to its opening snapshot",
              });
            },
            "Reset local payouts",
            !confirmed,
          )}
        </>
      );
    return (
      <button className="wd-btn" onClick={close}>
        Close
      </button>
    );
  }
  return (
    <div className="wd-canvas">
      <header className="wd-header">
        <div>
          <div className="wd-eyebrow">
            <span className="wd-tag mono">D-9</span>OPERATOR CONSOLE / PAYOUT
            OPERATIONS
          </div>
          <h1>Withdrawal Requests</h1>
          <p>
            Review with context. Process with control. Track every attempt from
            wallet hold to final settlement.
          </p>
        </div>
        <div className="wd-actions">
          <button className="wd-btn" onClick={() => open("audit")}>
            <Icon name="activity" size={14} />
            Audit trail
          </button>
          <button className="wd-btn" onClick={() => open("export")}>
            <Icon name="download" size={14} />
            Export payouts
          </button>
          <button className="wd-btn wd-primary" onClick={() => open("request")}>
            <Icon name="plus" size={14} />
            New request
          </button>
        </div>
      </header>
      <div className="wd-demo">
        <span className="wd-tag wd-demo-tag">DEMO PAYOUT DESK</span>
        <span>
          Local wallet reservations & synthetic provider evidence · no real
          money moves
        </span>
        <span className="mono">
          BASE {time(data.asOf)} UTC · REV {data.revision}
        </span>
        <button
          className="wd-link"
          onClick={() =>
            open("evidence", processing[0]?.id ?? data.requests[0].id)
          }
        >
          Evidence rules ↗
        </button>
      </div>
      <section className="wd-metrics" aria-label="Payout queue summary">
        <Metric
          label="Pending review & scheduled"
          value={summary.pending}
          count={summary.pendingCount}
          detail="Wallet-held gross"
          icon="clock"
          onClick={() => {
            clearQueue();
            document
              .getElementById("payout-queue")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <Metric
          label="Processing"
          value={summary.processing}
          count={summary.processingCount}
          detail="Provider evidence queue"
          icon="activity"
          onClick={() =>
            document
              .getElementById("payout-processing")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
        <Metric
          label="Completed · snapshot day"
          value={summary.today}
          count={summary.todayCount}
          detail={endDay}
          icon="check"
          onClick={() => {
            setPeriod({ from: endDay, to: endDay });
            setFrom(endDay);
            setTo(endDay);
            setCompletedPage(1);
            setDateError("");
            document
              .getElementById("payout-completed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <Metric
          label="Completed · lifetime"
          value={summary.completed}
          count={summary.completedCount}
          detail="Full synthetic ledger"
          icon="vault"
          onClick={() => {
            const earliest = data.requests
              .filter((r) => r.completedAt)
              .map((r) => r.completedAt!.slice(0, 10))
              .sort()[0];
            setPeriod({ from: earliest, to: endDay });
            setFrom(earliest);
            setTo(endDay);
            setCompletedPage(1);
            setDateError("");
            document
              .getElementById("payout-completed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <Metric
          label="Average processing"
          value={summary.averageMinutes}
          minutes
          detail="Started → completed"
          icon="gauge"
          onClick={() => open("day", endDay)}
        />
      </section>
      <section className="wd-capacity">
        <div>
          <Icon name="shield" size={19} />
          <span>
            <b>{cash(summary.available)} uncommitted payout capacity</b>
            <small>
              Broker cash {cash(data.treasury.cash)} − protected reserve{" "}
              {cash(data.treasury.reserve)} − scheduled/in-flight{" "}
              {cash(summary.committed)}
            </small>
          </span>
        </div>
        <button className="wd-link" onClick={() => open("batch")}>
          Review scheduled batch ↗
        </button>
        <Link href="/dashboard/funds">Treasury controls ↗</Link>
      </section>
      <section className="wd-panel" id="payout-queue">
        <div className="wd-panel-head">
          <div>
            <span className="wd-section-code">01 / REVIEW QUEUE</span>
            <h2>Pending withdrawal requests</h2>
            <p>
              Gross amounts are already held in local wallets. Approval does not
              debit the wallet twice.
            </p>
          </div>
          <div className="wd-actions">
            <button className="wd-btn" onClick={() => open("auto")}>
              <Icon name="bolt" size={14} />
              Auto-rule preview
            </button>
            <button className="wd-btn" onClick={() => open("batch")}>
              <Icon name="layers" size={14} />
              Process scheduled batch
            </button>
          </div>
        </div>
        <div className="wd-filterbar">
          <label className="wd-search">
            <Icon name="search" size={14} />
            <input
              aria-label="Search payout queue"
              placeholder="Investor, package or request ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setQueuePage(1);
                setSelection([]);
              }}
            />
          </label>
          <select
            className="wd-select"
            aria-label="Queue method filter"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setQueuePage(1);
              setSelection([]);
            }}
          >
            <option value="all">All methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {human(m)}
              </option>
            ))}
          </select>
          <select
            className="wd-select"
            aria-label="Queue status filter"
            value={queueFilter}
            onChange={(e) => {
              setQueueFilter(e.target.value);
              setQueuePage(1);
              setSelection([]);
            }}
          >
            <option value="all">All open states</option>
            {queueStatuses.map((s) => (
              <option key={s} value={s}>
                {human(s)}
              </option>
            ))}
          </select>
          <select
            className="wd-select"
            aria-label="Sort payout queue"
            value={`${queueSort[0]?.id ?? "requestedAt"}:${queueSort[0]?.desc ? "desc" : "asc"}`}
            onChange={(e) => {
              const [id, dir] = e.target.value.split(":");
              setQueueSort([{ id, desc: dir === "desc" }]);
              setQueuePage(1);
            }}
          >
            {queueTable.getAllLeafColumns().flatMap((c) => [
              <option key={c.id + "d"} value={`${c.id}:desc`}>
                {String(c.columnDef.header)} ↓
              </option>,
              <option key={c.id + "a"} value={`${c.id}:asc`}>
                {String(c.columnDef.header)} ↑
              </option>,
            ])}
          </select>
          <button className="wd-link" onClick={clearQueue}>
            Clear filters
          </button>
        </div>
        <div className="wd-bulkbar">
          <label className="wd-check">
            <input
              type="checkbox"
              aria-label="Select visible payout requests"
              checked={
                !!visibleQueue.length &&
                visibleQueue.every(({ original: r }) =>
                  selection.includes(r.id),
                )
              }
              onChange={(e) =>
                setSelection(
                  e.target.checked
                    ? [
                        ...new Set([
                          ...selection,
                          ...visibleQueue.map(({ original: r }) => r.id),
                        ]),
                      ]
                    : selection.filter(
                        (id) =>
                          !visibleQueue.some(({ original: r }) => r.id === id),
                      ),
                )
              }
            />
            Select visible
          </label>
          <span>{selection.length} selected across pages</span>
          <button
            className="wd-btn"
            disabled={!selection.length}
            onClick={() => open("bulkApprove")}
          >
            Approve selected
          </button>
          <button
            className="wd-btn"
            disabled={!selection.length}
            onClick={() => open("bulkReject")}
          >
            Reject selected
          </button>
          <button
            className="wd-link"
            disabled={!selection.length}
            onClick={() => setSelection([])}
          >
            Clear selection
          </button>
        </div>
        <div className="table-responsive">
          <table className="table wd-table wd-responsive wd-queue-table">
            <thead>
              <tr>
                <th>Select</th>
                {queueTable.getHeaderGroups()[0]?.headers.map((h) => (
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
                <th>Review / actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleQueue.map(({ original: r }, i) => (
                <tr key={r.id} style={{ animationDelay: `${i * 40}ms` }}>
                  <td data-label="Select">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.id}`}
                      checked={selection.includes(r.id)}
                      onChange={(e) =>
                        setSelection(
                          e.target.checked
                            ? [...selection, r.id]
                            : selection.filter((id) => id !== r.id),
                        )
                      }
                    />
                  </td>
                  <td data-label="Requested / UTC">
                    <button
                      className="wd-link mono"
                      onClick={() => open("detail", r.id)}
                    >
                      {time(r.requestedAt)}
                    </button>
                    <small className="wd-cell-sub mono">{r.id}</small>
                  </td>
                  <td data-label="Investor">
                    <button
                      className="wd-link"
                      onClick={() => open("investor", r.investorId)}
                    >
                      {r.investorName}
                    </button>
                    <small className="wd-cell-sub">
                      {r.beneficiary.masked}
                    </small>
                  </td>
                  <td data-label="Gross amount">
                    <b className="mono">{cash(r.amount)}</b>
                    <small className="wd-cell-sub">
                      Net {cash(r.net)} · fee {cash(r.fee)}
                    </small>
                  </td>
                  <td data-label="Method">{human(r.method)}</td>
                  <td data-label="Reason">{human(r.reason)}</td>
                  <td data-label="Package" className="mono">
                    {r.pool}
                  </td>
                  <td data-label="Actions">
                    <div className="wd-row-state">
                      <Status value={r.status} />
                      {approvalBlockers(data, r).length > 0 && (
                        <span className="wd-gate">Evidence gate</span>
                      )}
                    </div>
                    <div className="wd-row-actions">
                      <button
                        disabled={
                          r.status === "approved" ||
                          !!approvalBlockers(data, r).length
                        }
                        title={
                          approvalBlockers(data, r).join(" ") ||
                          "Review eligibility"
                        }
                        onClick={() => open("approve", r.id)}
                      >
                        Approve
                      </button>
                      <button onClick={() => open("reject", r.id)}>
                        Reject
                      </button>
                      <button
                        disabled={r.status === "approved"}
                        onClick={() => open("info", r.id)}
                      >
                        Request info
                      </button>
                      <button
                        aria-label={`Inspect ${r.id}`}
                        onClick={() => inspect(r.id)}
                      >
                        <Icon name="panelRight" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleQueue.length && (
          <div className="wd-empty">
            <h3>
              {pending.length
                ? "No matching requests"
                : "Review queue is clear"}
            </h3>
            <p>
              {pending.length
                ? "Adjust your method, status or search filters."
                : "New requests will appear here for review."}
            </p>
            <button
              className="wd-btn"
              onClick={pending.length ? clearQueue : () => open("request")}
            >
              {pending.length ? "Reset queue filters" : "Create demo request"}
            </button>
          </div>
        )}
        <div className="wd-panel-foot">
          <span>
            {queueRows.length} open requests · selected batches are validated
            atomically
          </span>
          {paginate("queue")}
        </div>
      </section>
      <section className="wd-panel" id="payout-processing">
        <div className="wd-panel-head">
          <div>
            <span className="wd-section-code">02 / IN FLIGHT</span>
            <h2>Processing transfers</h2>
            <p>
              Each attempt has its own reference. Unknown outcomes cannot be
              safely retried or refunded.
            </p>
          </div>
          <span className="wd-tag mono">
            {processing.length} ACTIVE / {cash(summary.processing)}
          </span>
        </div>
        <div className="wd-processing-grid">
          {processing.map((r) => (
            <article className="wd-transfer" key={r.id}>
              <div className="wd-transfer-head">
                <span className="wd-processing-mark">
                  <Icon name="activity" size={17} />
                </span>
                <div>
                  <button
                    className="wd-link"
                    onClick={() => open("detail", r.id)}
                  >
                    {r.investorName} ↗
                  </button>
                  <small className="mono">{r.id}</small>
                </div>
                <button
                  className="wd-icon"
                  aria-label={`Inspect ${r.id}`}
                  onClick={() => inspect(r.id)}
                >
                  <Icon name="panelRight" size={14} />
                </button>
              </div>
              <div className="wd-transfer-value">
                <strong className="mono">{cash(r.amount)}</strong>
                <Status value={r.providerOutcome} />
              </div>
              <dl className="wd-transfer-facts">
                <div>
                  <dt>Recipient net / fee</dt>
                  <dd>
                    {cash(r.net)} / {cash(r.fee)}
                  </dd>
                </div>
                <div>
                  <dt>Rail / attempt</dt>
                  <dd>
                    {human(r.method)} · #{r.attempts}
                  </dd>
                </div>
              </dl>
              <button
                className="wd-reference mono"
                onClick={() => open("evidence", r.id)}
              >
                {r.providerReference} ↗
              </button>
              <div className="wd-row-actions">
                <button
                  disabled={r.providerOutcome !== "settled"}
                  title="Requires settled provider evidence"
                  onClick={() => open("complete", r.id)}
                >
                  Mark complete
                </button>
                <button
                  disabled={r.providerOutcome !== "failed"}
                  title="Requires confirmed not-paid evidence"
                  onClick={() => open("fail", r.id)}
                >
                  Mark failed
                </button>
                <button onClick={() => open("contact", r.id)}>
                  Contact investor
                </button>
                <button onClick={() => open("callback", r.id)}>
                  Simulate callback
                </button>
              </div>
              <p className="wd-transfer-hint">
                {r.providerOutcome === "unknown"
                  ? "Awaiting a final provider outcome. Investigate before any recovery action."
                  : r.providerOutcome === "settled"
                    ? "Synthetic settled evidence is present. Review the ledger impact before completion."
                    : "Synthetic not-paid evidence is present. Record failure before retry or release."}
              </p>
            </article>
          ))}
        </div>
        {!processing.length && (
          <div className="wd-empty">
            No in-flight transfers.{" "}
            <button className="wd-link" onClick={() => open("batch")}>
              Review scheduled approvals
            </button>
          </div>
        )}
      </section>
      <section className="wd-panel" id="payout-completed">
        <div className="wd-panel-head">
          <div>
            <span className="wd-section-code">03 / SETTLEMENT REGISTER</span>
            <h2>Completed payouts</h2>
            <p>
              Gross = recipient net + fee. Historical fees are locked to each
              settlement, never repriced by new policy.
            </p>
          </div>
          <button
            className="wd-btn"
            onClick={() => {
              setExportFormat("csv");
              setExportScope("filtered");
              open("export");
            }}
          >
            <Icon name="download" size={14} />
            Export completed CSV
          </button>
        </div>
        <div className="wd-filterbar">
          <label className="wd-date">
            From / UTC
            <input
              type="date"
              max={endDay}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="wd-date">
            To / UTC
            <input
              type="date"
              max={endDay}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button className="wd-btn" onClick={dateApply}>
            Apply period
          </button>
          <select
            className="wd-select"
            aria-label="Completed payout method filter"
            value={completedMethod}
            onChange={(e) => {
              setCompletedMethod(e.target.value);
              setCompletedPage(1);
            }}
          >
            <option value="all">All methods</option>
            {methods.map((m) => (
              <option value={m} key={m}>
                {human(m)}
              </option>
            ))}
          </select>
          <label className="wd-search">
            <Icon name="search" size={13} />
            <input
              aria-label="Search completed payouts"
              placeholder="Investor, reference or ID…"
              value={completedSearch}
              onChange={(e) => {
                setCompletedSearch(e.target.value);
                setCompletedPage(1);
              }}
            />
          </label>
          <select
            className="wd-select"
            aria-label="Sort completed payouts"
            value={`${completedSort[0]?.id ?? "completedAt"}:${completedSort[0]?.desc ? "desc" : "asc"}`}
            onChange={(e) => {
              const [id, dir] = e.target.value.split(":");
              setCompletedSort([{ id, desc: dir === "desc" }]);
              setCompletedPage(1);
            }}
          >
            {doneTable.getAllLeafColumns().flatMap((c) => [
              <option key={c.id + "d"} value={`${c.id}:desc`}>
                {String(c.columnDef.header)} ↓
              </option>,
              <option key={c.id + "a"} value={`${c.id}:asc`}>
                {String(c.columnDef.header)} ↑
              </option>,
            ])}
          </select>
          <button
            className="wd-link"
            onClick={() => {
              setPeriod({ from: defaultFrom, to: endDay });
              setFrom(defaultFrom);
              setTo(endDay);
              setCompletedMethod("all");
              setCompletedSearch("");
              setDateError("");
              setCompletedPage(1);
            }}
          >
            Reset period
          </button>
        </div>
        {dateError && (
          <div className="wd-error mx-3 mt-3" role="alert">
            {dateError}
          </div>
        )}
        <div className="table-responsive">
          <table className="table wd-table wd-responsive">
            <thead>
              <tr>
                {doneTable.getHeaderGroups()[0]?.headers.map((h) => (
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
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleDone.map(({ original: r }) => (
                <tr key={r.id}>
                  <td data-label="Completed / UTC" className="mono">
                    {time(r.completedAt)}
                  </td>
                  <td data-label="Investor">
                    <button
                      className="wd-link"
                      onClick={() => open("investor", r.investorId)}
                    >
                      {r.investorName}
                    </button>
                  </td>
                  <td data-label="Gross" className="mono">
                    {cash(r.amount)}
                  </td>
                  <td data-label="Recipient net" className="mono text-win">
                    {cash(r.net)}
                  </td>
                  <td data-label="Fee" className="mono">
                    {cash(r.fee)}
                  </td>
                  <td data-label="Method">{human(r.method)}</td>
                  <td data-label="Reference">
                    <button
                      className="wd-link wd-short-ref mono"
                      onClick={() => open("evidence", r.id)}
                      title={r.providerReference ?? ""}
                    >
                      {r.providerReference}
                    </button>
                  </td>
                  <td data-label="Details">
                    <button
                      className="wd-row-detail"
                      aria-label={`Inspect ${r.id}`}
                      onClick={() => inspect(r.id)}
                    >
                      <Icon name="panelRight" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleDone.length && (
          <div className="wd-empty">
            <h3>No settlements in this scope</h3>
            <p>Try another method, investor or period.</p>
            <button
              className="wd-btn"
              onClick={() => {
                setCompletedSearch("");
                setCompletedMethod("all");
                setPeriod({ from: defaultFrom, to: endDay });
                setFrom(defaultFrom);
                setTo(endDay);
              }}
            >
              Restore 30-day view
            </button>
          </div>
        )}
        <div className="wd-panel-foot">
          <span>
            {completedRows.length} settlements · {period.from} → {period.to} ·
            gross {cash(completedRows.reduce((n, r) => n + r.amount, 0))}
          </span>
          {paginate("done")}
        </div>
      </section>
      <section className="wd-panel">
        <div className="wd-panel-head">
          <div>
            <span className="wd-section-code">04 / PAYOUT POLICY</span>
            <h2>Settings & rules</h2>
            <p>
              Editable policy with explicit review. No background worker
              auto-approves or schedules transfers in this demo.
            </p>
          </div>
          <span className="wd-tag mono">
            DAILY {data.settings.batchTime} UTC
          </span>
        </div>
        <div className="wd-settings-layout">
          <PayoutSettingsForm
            key={JSON.stringify(data.settings)}
            settings={data.settings}
            onReview={(value) => {
              setPolicyDraft(value);
              open("policy");
            }}
          />
          <aside className="wd-rail-guide">
            <h3>Payment rail guide</h3>
            {methods.map((m) => (
              <button key={m} onClick={() => open("method", m)}>
                <span>{human(m)}</span>
                <b>
                  {m === "bank_transfer"
                    ? "Free · 1–3 business days"
                    : m === "mobile_money"
                      ? `${data.settings.mobilePercent}% · instant–30m`
                      : m === "card"
                        ? `${data.settings.cardPercent}% + ${cash(data.settings.cardFixed)}`
                        : `Network estimate ${cash(data.settings.cryptoFee)}`}
                </b>
                <Icon name="arrowRight" size={13} />
              </button>
            ))}
            <div className="wd-note">
              <Icon name="shield" size={18} />
              <span>
                Auto-rule eligibility requires KYC L2+, verified beneficiary,
                policy limits and liquidity. A threshold is not blanket
                authorization.
              </span>
            </div>
            <Link href="/dashboard/investors">
              Manage investor preferences ↗
            </Link>
          </aside>
        </div>
      </section>
      <section className="wd-panel">
        <div className="wd-panel-head">
          <div>
            <span className="wd-section-code">05 / RECOVERY DESK</span>
            <h2>Failed & retry queue</h2>
            <p>
              Confirm a transfer was not paid before retrying or releasing its
              wallet hold. Never do both.
            </p>
          </div>
          <span className="wd-tag mono">{failed.length} FAILED ATTEMPTS</span>
        </div>
        <div className="wd-failed-list">
          {failed.map((r) => (
            <article key={r.id}>
              <div className="wd-failure-icon">
                <Icon name="shield" size={18} />
              </div>
              <div className="wd-failure-main">
                <button
                  className="wd-link"
                  onClick={() => open("detail", r.id)}
                >
                  {r.investorName} · {r.id} ↗
                </button>
                <span>
                  {human(r.failureCode ?? "provider_failure")} ·{" "}
                  {human(r.method)}
                </span>
                <small>
                  {r.beneficiary.verified
                    ? "Beneficiary verified · confirmed not paid"
                    : "Beneficiary update required before retry"}
                </small>
              </div>
              <strong className="mono">{cash(r.amount)}</strong>
              <div className="wd-row-actions">
                <button
                  disabled={!!approvalBlockers(data, r).length}
                  title={approvalBlockers(data, r).join(" ")}
                  onClick={() => open("retry", r.id)}
                >
                  Retry
                </button>
                <button onClick={() => open("refund", r.id)}>
                  Release to wallet
                </button>
                <button onClick={() => open("beneficiary", r.id)}>
                  Review beneficiary
                </button>
                <button onClick={() => open("contact", r.id)}>
                  Contact investor
                </button>
                <button
                  aria-label={`Inspect ${r.id}`}
                  onClick={() => inspect(r.id)}
                >
                  <Icon name="panelRight" size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!failed.length && (
          <div className="wd-empty">
            No failed requests remain. Recoveries and wallet releases are
            retained in the{" "}
            <button className="wd-link" onClick={() => open("audit")}>
              session audit trail
            </button>
            .
          </div>
        )}
      </section>
      <section className="wd-panel">
        <div className="wd-panel-head">
          <div>
            <span className="wd-section-code">06 / SETTLEMENT VELOCITY</span>
            <h2>Payout history</h2>
            <p>
              Daily gross settled volume, derived from completed records.
              Rolling averages include zero-activity calendar days.
            </p>
          </div>
          <select
            className="wd-select"
            aria-label="Payout chart period"
            value={historyDays}
            onChange={(e) => setHistoryDays(Number(e.target.value))}
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
        <PayoutHistoryChart
          key={historyDays}
          points={history}
          onDay={(day) => open("day", day)}
        />
        <div className="wd-panel-foot">
          <span>
            Through {endDay} UTC ·{" "}
            {cash(history.reduce((n, d) => n + d.gross, 0))} gross in selected
            chart window
          </span>
          <button
            className="wd-link"
            onClick={() =>
              download(
                JSON.stringify(history, null, 2),
                "application/json",
                "payout-history-series.json",
              )
            }
          >
            Download chart data ↗
          </button>
        </div>
      </section>
      <section>
        <div className="wd-section-head">
          <h2>Payout workbench</h2>
          <span className="wd-muted">
            Review, reserve, reconcile. Every transition has an evidence gate.
          </span>
        </div>
        <div className="wd-workbench">
          {(
            [
              ["request", "vault", "New payout request"],
              ["auto", "bolt", "Auto-rule preview"],
              ["batch", "layers", "Scheduled batch"],
              ["export", "download", "Export payout ledger"],
              ["audit", "activity", "Review audit trail"],
              ["reset", "clock", "Reset workspace"],
            ] as [Kind, IconName, string][]
          ).map(([kind, icon, label]) => (
            <button key={kind} onClick={() => open(kind)}>
              <Icon name={icon} size={16} />
              {label}
              <Icon name="arrowRight" size={13} />
            </button>
          ))}
        </div>
      </section>
      <footer className="wd-footer">
        <span>
          FRONTEND DEMO / local simulations only; no bank, blockchain or broker
          transfer
        </span>
        <Link href="/dashboard/funds">Treasury & reserves ↗</Link>
        <Link href="/dashboard/investors">Investor roster ↗</Link>
        <Link href="/dashboard/analytics">Performance analytics ↗</Link>
        <button className="wd-link" onClick={() => open("export")}>
          Export operations report ↗
        </button>
      </footer>
      {modal && (
        <div className="wd-local-layer">
          <DeskModalShell
            title={titles[modal.kind]}
            code={`D9-${String(Object.keys(titles).indexOf(modal.kind) + 1).padStart(2, "0")}`}
            eyebrow="PAYOUT OPERATIONS / LOCAL DEMO"
            subtitle="No real transfer, external message, queue job or provider callback is created."
            size={
              ["detail", "bulkApprove", "bulkReject", "audit", "day"].includes(
                modal.kind,
              )
                ? "xl"
                : "lg"
            }
            onClose={close}
            steps={steps[modal.kind]}
            currentStep={step}
            footer={footer()}
          >
            {error && (
              <div className="wd-error" role="alert">
                {error}
              </div>
            )}
            {modal.kind === "request" &&
              (step === 0 ? (
                <PayoutRequestForm
                  data={data}
                  defaults={requestDraft}
                  onContinue={(v) => {
                    setRequestDraft(v);
                    setStep(1);
                  }}
                />
              ) : step === 1 ? (
                <>
                  <dl className="wd-facts">
                    <div>
                      <dt>Investor</dt>
                      <dd>
                        {
                          data.investors.find(
                            (i) => i.id === requestDraft.investorId,
                          )?.name
                        }
                      </dd>
                    </div>
                    <div>
                      <dt>Gross wallet hold</dt>
                      <dd>{cash(requestDraft.amount)}</dd>
                    </div>
                    <div>
                      <dt>Fee / recipient net</dt>
                      <dd>
                        {cash(
                          feeFor(
                            requestDraft.amount,
                            requestDraft.method,
                            data.settings,
                          ),
                        )}{" "}
                        /{" "}
                        {cash(
                          requestDraft.amount -
                            feeFor(
                              requestDraft.amount,
                              requestDraft.method,
                              data.settings,
                            ),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Rail / package</dt>
                      <dd>
                        {human(requestDraft.method)} / {requestDraft.pool}
                      </dd>
                    </div>
                  </dl>
                  <div className="wd-note">
                    <Icon name="lock" size={18} />A new request reserves wallet
                    funds only. Its synthetic destination must be independently
                    reviewed in the beneficiary workflow before approval.
                  </div>
                </>
              ) : (
                consent(
                  "Reserve the gross amount in a local demo wallet only. This does not close positions, submit a transfer or verify a beneficiary.",
                )
              ))}
            {["approve", "bulkApprove", "auto"].includes(modal.kind) &&
              (step === 0 ? (
                <>
                  {reviewList()}
                  {blockers.length > 0 && (
                    <div className="wd-error">{blockers.join(" ")}</div>
                  )}
                  {reviewTotal > summary.available && (
                    <div className="wd-error">
                      Insufficient uncommitted payout capacity.
                    </div>
                  )}
                  {modal.kind === "auto" && (
                    <div className="wd-note">
                      <Icon name="bolt" size={17} />
                      Rule preview: amount ≤ {cash(data.settings.autoThreshold)}
                      , KYC L2+, beneficiary verified, limits and liquidity. No
                      background rule is executed.
                    </div>
                  )}
                </>
              ) : step === 1 ? (
                <>
                  {modal.kind !== "auto" && (
                    <div className="wd-choice-grid">
                      <button
                        className={!processNow ? "selected" : ""}
                        onClick={() => setProcessNow(false)}
                      >
                        <Icon name="calendar" size={22} />
                        <b>Schedule for batch</b>
                        <small>
                          Approved locally for the {data.settings.batchTime} UTC
                          policy. No job is scheduled.
                        </small>
                      </button>
                      <button
                        className={processNow ? "selected" : ""}
                        onClick={() => setProcessNow(true)}
                      >
                        <Icon name="activity" size={22} />
                        <b>Process now · demo</b>
                        <small>
                          Create a local in-flight attempt with an unknown
                          outcome. No provider call.
                        </small>
                      </button>
                    </div>
                  )}
                  {notesField("Approval reviewer notes")}
                </>
              ) : (
                <>
                  {reviewList()}
                  <p className="wd-muted">
                    Wallet holds remain reserved. Treasury is committed, not
                    debited, until settled completion is recorded.
                  </p>
                  {consent()}
                </>
              ))}
            {modal.kind === "bulkReject" &&
              (step === 0 ? (
                reviewList()
              ) : step === 1 ? (
                notesField("Bulk rejection reason")
              ) : (
                <>
                  {reviewList()}
                  <p className="wd-muted">
                    All selected wallet holds are released atomically. No
                    external refund is issued.
                  </p>
                  {consent()}
                </>
              ))}
            {(modal.kind === "reject" ||
              modal.kind === "info" ||
              modal.kind === "fail" ||
              modal.kind === "contact") && (
              <>
                <div className="wd-summary">
                  <span className="wd-tag mono">{request.id}</span>
                  <h3>{request.investorName}</h3>
                  <b className="mono">{cash(request.amount)}</b>
                </div>
                {modal.kind === "fail" && <Evidence r={request} />}
                {modal.kind === "contact" && (
                  <label className="wd-field">
                    Message subject
                    <input
                      className="form-control"
                      minLength={5}
                      maxLength={120}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </label>
                )}
                {notesField(
                  modal.kind === "reject"
                    ? "Rejection reason"
                    : modal.kind === "info"
                      ? "Information required"
                      : modal.kind === "contact"
                        ? "Contact message draft"
                        : "Failure investigation notes",
                )}
                {consent(
                  modal.kind === "contact" || modal.kind === "info"
                    ? "Save this request/message in local notes only. No email, SMS or in-app message is delivered."
                    : undefined,
                )}
              </>
            )}
            {modal.kind === "detail" && (
              <>
                <div className="wd-summary">
                  <span className="wd-tag mono">{request.id}</span>
                  <Status value={request.status} />
                  <b className="mono">{cash(request.amount)}</b>
                </div>
                <PayoutFacts r={request} />
                <div className="wd-actions">
                  <button
                    className="wd-btn"
                    onClick={() => inspect(request.id)}
                  >
                    Open right inspector ↗
                  </button>
                  <button
                    className="wd-btn"
                    onClick={() => open("evidence", request.id)}
                  >
                    Provider evidence
                  </button>
                  {["pending", "information_requested", "failed"].includes(
                    request.status,
                  ) && (
                    <button
                      className="wd-btn"
                      onClick={() => open("beneficiary", request.id)}
                    >
                      Review beneficiary
                    </button>
                  )}
                  <button
                    className="wd-btn"
                    onClick={() =>
                      download(
                        JSON.stringify({ mode: "demo", request }, null, 2),
                        "application/json",
                        `${request.id}-payout-record.json`,
                      )
                    }
                  >
                    Download payout record
                  </button>
                </div>
                {approvalBlockers(data, request).length > 0 && (
                  <div className="wd-note mt-3">
                    <Icon name="shield" size={17} />
                    {approvalBlockers(data, request).join(" ")}
                  </div>
                )}
              </>
            )}
            {modal.kind === "investor" && (
              <>
                <div className="wd-summary">
                  <span className="wd-tag mono">{owner.id}</span>
                  <h3>{owner.name}</h3>
                </div>
                <dl className="wd-facts">
                  <div>
                    <dt>Local wallet available</dt>
                    <dd>{cash(owner.wallet.available)}</dd>
                  </div>
                  <div>
                    <dt>Reserved payout holds</dt>
                    <dd>{cash(owner.wallet.held)}</dd>
                  </div>
                  <div>
                    <dt>Paid since opening snapshot</dt>
                    <dd>{cash(owner.wallet.paid)}</dd>
                  </div>
                  <div>
                    <dt>KYC / default rail</dt>
                    <dd>
                      L{owner.kycLevel}{" "}
                      {owner.kycVerified ? "verified" : "outstanding"} /{" "}
                      {human(owner.defaultMethod)}
                    </dd>
                  </div>
                </dl>
                <p className="wd-muted">
                  Available + held + paid-since-opening = opening wallet
                  control. These synthetic payout wallets do not mutate the
                  independent D-6 roster cache.
                </p>
                <Link className="wd-btn" href="/dashboard/investors">
                  Open investor roster ↗
                </Link>
              </>
            )}
            {modal.kind === "beneficiary" &&
              (step === 0 ? (
                <>
                  <div className="wd-note mb-3">
                    <Icon name="lock" size={17} />
                    Use masked demo details and a synthetic verification token
                    only. Do not enter real account numbers, wallet private keys
                    or payment credentials.
                  </div>
                  <label className="wd-field">
                    Masked destination label
                    <input
                      className="form-control"
                      maxLength={60}
                      minLength={6}
                      value={beneficiaryMasked}
                      onChange={(e) => setBeneficiaryMasked(e.target.value)}
                    />
                  </label>
                  <label className="wd-field mt-3">
                    Synthetic verification token
                    <input
                      className="form-control"
                      maxLength={100}
                      minLength={8}
                      value={beneficiaryToken}
                      onChange={(e) => setBeneficiaryToken(e.target.value)}
                    />
                  </label>
                </>
              ) : step === 1 ? (
                <>
                  <p className="wd-muted">
                    Production verification must use authenticated provider
                    tokens, ownership matching and account permissions. Typing a
                    label cannot establish ownership.
                  </p>
                  {notesField("Beneficiary review notes")}
                </>
              ) : (
                <>
                  <dl className="wd-facts">
                    <div>
                      <dt>New masked route</dt>
                      <dd>{beneficiaryMasked}</dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>
                        This request only. In-flight destinations cannot be
                        edited.
                      </dd>
                    </div>
                  </dl>
                  {consent(
                    "Mark only this synthetic route verified in the local demo. This is not real account verification.",
                  )}
                </>
              ))}
            {modal.kind === "batch" &&
              (step === 0 ? (
                reviewList()
              ) : step === 1 ? (
                <>
                  <dl className="wd-facts">
                    <div>
                      <dt>Gross already committed</dt>
                      <dd>{cash(reviewTotal)}</dd>
                    </div>
                    <div>
                      <dt>Batch time policy / UTC</dt>
                      <dd>{data.settings.batchTime}</dd>
                    </div>
                    <div>
                      <dt>Worker handoff cron</dt>
                      <dd className="mono">{`${Number(data.settings.batchTime.split(":")[1])} ${Number(data.settings.batchTime.split(":")[0])} * * *`}</dd>
                    </div>
                    <div>
                      <dt>Actual backend jobs</dt>
                      <dd>None — local transition only</dd>
                    </div>
                  </dl>
                  {notesField("Batch review notes")}
                </>
              ) : (
                <>
                  {reviewList()}
                  {consent(
                    "Simulate in-flight attempts for these already approved requests. No BullMQ job or provider transfer is submitted.",
                  )}
                </>
              ))}
            {modal.kind === "evidence" && (
              <>
                <Evidence r={request} />
                <div className="wd-actions mt-3">
                  <button
                    className="wd-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(
                          {
                            mode: "demo",
                            requestId: request.id,
                            attempt: request.attempts,
                            providerReference: request.providerReference,
                            outcome: request.providerOutcome,
                            failure: request.failureCode,
                            notBankEvidence: true,
                          },
                          null,
                          2,
                        ),
                        "application/json",
                        `${request.id}-synthetic-evidence.json`,
                      )
                    }
                  >
                    Download evidence JSON
                  </button>
                  {request.status === "processing" && (
                    <button
                      className="wd-btn"
                      onClick={() => open("callback", request.id)}
                    >
                      Simulate provider callback
                    </button>
                  )}
                  <button
                    className="wd-btn"
                    onClick={() => inspect(request.id)}
                  >
                    Inspect timeline ↗
                  </button>
                </div>
              </>
            )}
            {modal.kind === "callback" &&
              (step === 0 ? (
                <>
                  <div className="wd-note mb-3">
                    <Icon name="info" size={17} />
                    This is a frontend testing scenario, not a refresh of real
                    provider data. Choose an explicitly synthetic outcome for
                    the current attempt.
                  </div>
                  <div className="wd-choice-grid">
                    {(["unknown", "settled", "failed"] as const).map((v) => (
                      <button
                        className={callbackOutcome === v ? "selected" : ""}
                        disabled={
                          ["settled", "failed"].includes(
                            request.providerOutcome,
                          ) && v !== request.providerOutcome
                        }
                        title="Final provider evidence cannot be overwritten"
                        key={v}
                        onClick={() => setCallbackOutcome(v)}
                      >
                        <Icon
                          name={
                            v === "settled"
                              ? "check"
                              : v === "failed"
                                ? "shield"
                                : "clock"
                          }
                          size={22}
                        />
                        <b>{human(v)}</b>
                        <small>
                          {v === "unknown"
                            ? "No final outcome; recovery remains blocked"
                            : v === "settled"
                              ? "Allow a separate completion review"
                              : "Confirmed not paid; allow failure review"}
                        </small>
                      </button>
                    ))}
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <dl className="wd-facts">
                    <div>
                      <dt>Bound provider reference</dt>
                      <dd className="mono">{request.providerReference}</dd>
                    </div>
                    <div>
                      <dt>Bound attempt</dt>
                      <dd>{request.attempts}</dd>
                    </div>
                  </dl>
                  {notesField("Synthetic evidence notes")}
                </>
              ) : (
                <>
                  <p className="wd-muted">
                    Outcome changes do not debit or release wallet funds. A
                    separate, guarded settlement/recovery action is required.
                  </p>
                  {consent(
                    "Inject synthetic evidence for this attempt only. No authenticated provider event is claimed.",
                  )}
                </>
              ))}
            {["complete", "retry", "refund"].includes(modal.kind) &&
              (step === 0 ? (
                <>
                  <Evidence r={request} />
                  {modal.kind === "retry" && currentBlocks.length > 0 && (
                    <div className="wd-error mt-3">
                      {currentBlocks.join(" ")}
                    </div>
                  )}
                </>
              ) : step === 1 ? (
                <>
                  <dl className="wd-facts">
                    <div>
                      <dt>Gross / fee / recipient net</dt>
                      <dd>
                        {cash(request.amount)} / {cash(request.fee)} /{" "}
                        {cash(request.net)}
                      </dd>
                    </div>
                    <div>
                      <dt>Wallet impact</dt>
                      <dd>
                        {modal.kind === "complete"
                          ? "Held decreases; paid-since-opening increases"
                          : modal.kind === "refund"
                            ? "Held decreases; available increases"
                            : "Existing hold retained; never reserved twice"}
                      </dd>
                    </div>
                    <div>
                      <dt>Treasury cash impact</dt>
                      <dd>
                        {modal.kind === "complete"
                          ? `−${cash(request.amount)} gross`
                          : "No cash debit at this step"}
                      </dd>
                    </div>
                    <div>
                      <dt>Attempt policy</dt>
                      <dd>
                        {modal.kind === "retry"
                          ? `New attempt #${request.attempts + 1}; previous evidence retained in audit`
                          : "Duplicate transitions are rejected"}
                      </dd>
                    </div>
                  </dl>
                  {notesField("Settlement / recovery reviewer notes")}
                </>
              ) : (
                consent(
                  modal.kind === "refund"
                    ? "Release this confirmed-not-paid hold in the local wallet only. No external refund is sent."
                    : undefined,
                )
              ))}
            {modal.kind === "policy" && (
              <>
                <dl className="wd-facts">
                  <div>
                    <dt>Gross limits</dt>
                    <dd>
                      {cash(policyDraft.minimum)} → {cash(policyDraft.maximum)}
                    </dd>
                  </div>
                  <div>
                    <dt>Auto-rule policy</dt>
                    <dd>
                      {policyDraft.autoEnabled
                        ? `Enabled up to ${cash(policyDraft.autoThreshold)}, KYC L2+`
                        : "Disabled"}
                    </dd>
                  </div>
                  <div>
                    <dt>Daily batch / UTC</dt>
                    <dd>{policyDraft.batchTime}</dd>
                  </div>
                  <div>
                    <dt>Historic settlements</dt>
                    <dd>Retain their original fees and timestamps</dd>
                  </div>
                </dl>
                {notesField("Policy change rationale")}
                {consent(
                  "Save these local policy values only. No scheduled job, auto-approval or existing fee repricing occurs.",
                )}
              </>
            )}
            {modal.kind === "export" &&
              (step === 0 ? (
                <div className="wd-choice-grid">
                  {[
                    [
                      "csv",
                      "CSV",
                      "Scoped payout register, spreadsheet-safe fields",
                    ],
                    [
                      "json",
                      "JSON",
                      "Typed records, policy, controls and session audit",
                    ],
                    [
                      "pdf",
                      "PDF",
                      "Paginated printable payout operations report",
                    ],
                  ].map(([v, h, p]) => (
                    <button
                      className={exportFormat === v ? "selected" : ""}
                      onClick={() => setExportFormat(v)}
                      key={v}
                    >
                      <Icon name="download" size={22} />
                      <b>{h}</b>
                      <small>{p}</small>
                    </button>
                  ))}
                </div>
              ) : step === 1 ? (
                <>
                  <label className="wd-field">
                    Report record scope
                    <select
                      className="form-select"
                      value={exportScope}
                      onChange={(e) => setExportScope(e.target.value)}
                    >
                      <option value="filtered">
                        Current completed filters ({completedRows.length})
                      </option>
                      <option value="all">
                        All synthetic requests ({data.requests.length})
                      </option>
                      <option value="selected">
                        Selected queue requests ({selection.length})
                      </option>
                    </select>
                  </label>
                  <p className="wd-muted mt-3">
                    Portfolio controls remain full-scope. Selected records never
                    change what is approved or paid.
                  </p>
                </>
              ) : (
                consent(
                  "Download synthetic operational records only. This is not an audited statement, bank receipt or evidence of real transfers.",
                )
              ))}
            {modal.kind === "day" && (
              <>
                <div className="wd-summary">
                  <span className="wd-tag mono">{modal.id} UTC</span>
                  <strong>
                    {cash(dayRows.reduce((n, r) => n + r.amount, 0))} gross
                  </strong>
                  <span>{dayRows.length} settlements</span>
                </div>
                <div className="wd-day-list">
                  {dayRows.map((r) => (
                    <button key={r.id} onClick={() => open("detail", r.id)}>
                      <span>{r.investorName}</span>
                      <span>
                        {cash(r.amount)} gross · {cash(r.fee)} fee
                      </span>
                      <Icon name="arrowRight" size={13} />
                    </button>
                  ))}
                </div>
                {!dayRows.length && (
                  <p className="wd-muted">
                    No completed payouts on this day. Zero volume is an observed
                    empty day, not missing data.
                  </p>
                )}
                <button
                  className="wd-btn mt-3"
                  onClick={() => {
                    setPeriod({ from: modal.id!, to: modal.id! });
                    setFrom(modal.id!);
                    setTo(modal.id!);
                    setCompletedMethod("all");
                    setCompletedSearch("");
                    setCompletedPage(1);
                    setModal(null);
                    document
                      .getElementById("payout-completed")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Show day in settlement register ↗
                </button>
              </>
            )}
            {modal.kind === "method" && (
              <>
                <h3>{human(modal.id ?? "bank_transfer")}</h3>
                <dl className="wd-facts">
                  <div>
                    <dt>Fee on a $100 gross request</dt>
                    <dd>
                      {cash(
                        feeFor(
                          100,
                          (modal.id ??
                            "bank_transfer") as PayoutRequest["method"],
                          data.settings,
                        ),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Fee bearer</dt>
                    <dd>Deducted from gross; net + fee = wallet reservation</dd>
                  </div>
                  <div>
                    <dt>Typical illustrative timing</dt>
                    <dd>
                      {modal.id === "bank_transfer"
                        ? "1–3 business days"
                        : modal.id === "mobile_money"
                          ? "Instant–30 minutes"
                          : modal.id === "crypto_usdt"
                            ? "15–60 minutes"
                            : "Instant, subject to provider eligibility"}
                    </dd>
                  </div>
                  <div>
                    <dt>Final settlement proof</dt>
                    <dd>
                      Authenticated provider reference and definitive outcome
                      required
                    </dd>
                  </div>
                </dl>
                <p className="wd-muted">
                  These are USD reporting examples, not live FX/network quotes
                  or guaranteed delivery times. Real provider fees and
                  jurisdictional permissions must be verified server-side.
                </p>
              </>
            )}
            {modal.kind === "audit" && (
              <>
                <div className="wd-audit-list">
                  {data.audit.map((a) => (
                    <article key={a.id}>
                      <div>
                        <span className="wd-tag">{human(a.action)}</span>
                        <small className="mono">
                          {time(a.time)} UTC · REV {a.revision}
                        </small>
                      </div>
                      <b className="mono">
                        {a.requestIds.join(", ") || "Opening control snapshot"}
                      </b>
                      <p>{a.notes}</p>
                      {(a.before || a.policyBefore) && (
                        <details className="wd-transition-evidence">
                          <summary>Transition evidence</summary>
                          <pre className="wd-code">
                            {JSON.stringify(
                              {
                                before: a.before,
                                after: a.after,
                                policyBefore: a.policyBefore,
                                policyAfter: a.policyAfter,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
                <button
                  className="wd-btn mt-3"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        {
                          mode: "demo",
                          audit: data.audit,
                          cashLedger: data.cashLedger,
                        },
                        null,
                        2,
                      ),
                      "application/json",
                      "payout-session-audit.json",
                    )
                  }
                >
                  Download session audit JSON
                </button>
              </>
            )}
            {modal.kind === "reset" && (
              <>
                <p className="wd-muted">
                  Discard local requests, approvals, beneficiary changes,
                  simulated callbacks, wallet holds/releases, policy edits and
                  audit entries. Earlier dashboard pages are unaffected.
                  Download a report first if needed.
                </p>
                {consent(
                  "Restore the opening synthetic payout snapshot. This does not reverse any real payment because none was executed.",
                )}
              </>
            )}
          </DeskModalShell>
        </div>
      )}
      {inspected && (
        <div
          className="wd-drawer-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <aside
            className="wd-drawer wd-local-layer"
            role="dialog"
            aria-modal="true"
            aria-label="Payout right inspector"
          >
            <div className="wd-drawer-head">
              <div>
                <span className="wd-eyebrow">PAYOUT INSPECTOR</span>
                <h2>{inspected.id}</h2>
              </div>
              <button
                className="wd-icon"
                aria-label="Close payout inspector"
                onClick={close}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav className="wd-drawer-tabs" aria-label="Payout inspector tabs">
              {["summary", "evidence", "timeline", "wallet"].map((t) => (
                <button
                  key={t}
                  className={drawerTab === t ? "active" : ""}
                  onClick={() => setDrawerTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="wd-drawer-body">
              {drawerTab === "summary" ? (
                <>
                  <div className="wd-drawer-value mono">
                    {cash(inspected.amount)}
                  </div>
                  <Status value={inspected.status} />
                  <PayoutFacts r={inspected} />
                  {approvalBlockers(data, inspected).length > 0 && (
                    <div className="wd-note">
                      {approvalBlockers(data, inspected).join(" ")}
                    </div>
                  )}
                </>
              ) : drawerTab === "evidence" ? (
                <Evidence r={inspected} />
              ) : drawerTab === "timeline" ? (
                <>
                  <ol className="wd-inspector-timeline">
                    <li>
                      <b>Requested</b>
                      <span className="mono">
                        {time(inspected.requestedAt)} UTC
                      </span>
                    </li>
                    <li>
                      <b>Current attempt #{inspected.attempts}</b>
                      <span>{time(inspected.startedAt)}</span>
                    </li>
                    <li>
                      <b>Completion</b>
                      <span>{time(inspected.completedAt)}</span>
                    </li>
                  </ol>
                  {inspected.notes.map((n, i) => (
                    <p className="wd-note" key={i}>
                      {n}
                    </p>
                  ))}
                  {!inspected.notes.length && (
                    <p className="wd-muted">
                      No local reviewer notes on this seed record.
                    </p>
                  )}
                </>
              ) : (
                <>
                  {(() => {
                    const i = data.investors.find(
                      (i) => i.id === inspected.investorId,
                    )!;
                    return (
                      <>
                        <h3>{i.name}</h3>
                        <dl className="wd-facts">
                          <div>
                            <dt>Wallet available</dt>
                            <dd>{cash(i.wallet.available)}</dd>
                          </div>
                          <div>
                            <dt>Reserved holds</dt>
                            <dd>{cash(i.wallet.held)}</dd>
                          </div>
                          <div>
                            <dt>Paid since opening</dt>
                            <dd>{cash(i.wallet.paid)}</dd>
                          </div>
                          <div>
                            <dt>Opening wallet control</dt>
                            <dd>{cash(i.wallet.openingBalance)}</dd>
                          </div>
                        </dl>
                        <div className="wd-note">
                          Gross payout, including fees, is reserved once.
                          Completion consumes the hold; rejection or
                          confirmed-not-paid release restores available funds.
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
            <div className="wd-drawer-foot">
              <button
                className="wd-btn"
                onClick={() => open("detail", inspected.id)}
              >
                Full dossier ↗
              </button>
              <button
                className="wd-btn wd-primary"
                onClick={() => open("evidence", inspected.id)}
              >
                Provider evidence
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
export function WithdrawalsPage({
  operatorBundle,
  initial,
}: {
  operatorBundle: OperatorBundleProps;
  initial: PayoutBundle;
}) {
  return (
    <OperatorShell
      rootClass="page-dashboard-withdrawals"
      bundle={operatorBundle}
    >
      {() => <WithdrawalsDesk initial={initial} />}
    </OperatorShell>
  );
}
