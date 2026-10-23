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
import { useFunds } from "@/lib/funds/use-funds";
import {
  getFundsOverview,
  reconciliationChecks,
  money,
  type FundsCommand,
  type DepositIntake,
} from "@/lib/funds/model";
import type { Deposit, FundsBundle } from "@/lib/funds/types";
import { DepositIntakeForm } from "./intake-form";
const cash = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const pct = (n: number) => `${n.toFixed(1)}%`;
const human = (s: string) => s.replaceAll("_", " ");
const time = (s: string) => s.replace("T", " ").slice(0, 16);
const colors = ["#147d74", "#667a90", "#b58b53", "#c5d4d1"];
const col = createDeskColumnHelper<Deposit>();
type Kind =
  | "methodology"
  | "intake"
  | "deposit"
  | "verify"
  | "reject"
  | "info"
  | "proof"
  | "investor"
  | "allocation"
  | "rebalance"
  | "movement"
  | "reconcile"
  | "reconciliation"
  | "discrepancy"
  | "provider"
  | "diagnostics"
  | "policy"
  | "topup"
  | "export"
  | "audit"
  | "forecast"
  | "reset";
const titles: Record<Kind, string> = {
  methodology: "Treasury basis & controls",
  intake: "Register deposit intake",
  deposit: "Deposit review dossier",
  verify: "Verify deposit settlement",
  reject: "Reject deposit submission",
  info: "Request settlement information",
  proof: "Deposit proof viewer",
  investor: "Investor funding context",
  allocation: "Package capital detail",
  rebalance: "Rebalance capital allocations",
  movement: "Fund movement detail",
  reconcile: "Run full reconciliation",
  reconciliation: "Reconciliation evidence",
  discrepancy: "Discrepancy review",
  provider: "Payment provider detail",
  diagnostics: "Provider snapshot diagnostics",
  policy: "Reserve target policy",
  topup: "Reserve top-up planner",
  export: "Export treasury report",
  audit: "Treasury audit trail",
  forecast: "Liquidity runway lab",
  reset: "Reset local treasury workspace",
};
function download(content: string, type: string, name: string) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
const xml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function receiptSvg(d: Deposit) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440" viewBox="0 0 720 440"><rect width="720" height="440" fill="#f7f9fb"/><rect x="20" y="20" width="680" height="400" rx="12" fill="white" stroke="#d5dce5"/><text x="48" y="65" font-family="sans-serif" font-size="17" fill="#147d74">TRADEMO · SYNTHETIC RECEIPT EXAMPLE</text><text x="48" y="110" font-family="sans-serif" font-size="12" fill="#64748b">Generated from the demo DTO. Not an independent uploaded proof.</text><text x="48" y="175" font-family="sans-serif" font-size="34" fill="#152238">${xml(cash(d.amount))} USD</text><text x="48" y="224" font-family="sans-serif" font-size="16" fill="#334155">${xml(d.investorName)} · ${xml(d.pool)}</text><text x="48" y="264" textLength="${Math.min(624, d.reference.length * 7)}" lengthAdjust="spacingAndGlyphs" font-family="monospace" font-size="12" fill="#64748b">${xml(d.reference)}</text><text x="48" y="302" font-family="sans-serif" font-size="13" fill="#64748b">${xml(time(d.date))} UTC · ${xml(human(d.method))}</text><text x="48" y="374" font-family="sans-serif" font-size="20" fill="#b58b53">DEMO ONLY — NO PAYMENT EVIDENCE</text></svg>`;
}
function Proof({ deposit: d }: { deposit: Deposit }) {
  return (
    <div className="fd-proof">
      <svg
        viewBox="0 0 720 360"
        role="img"
        aria-label={`Synthetic receipt for ${d.id}; not real payment evidence`}
      >
        <rect
          x="1"
          y="1"
          width="718"
          height="358"
          rx="12"
          fill="var(--surface-inset)"
          stroke="var(--border)"
        />
        <text x="36" y="48" fill="var(--accent)" fontSize="15" fontWeight="600">
          TRADEMO / SYNTHETIC RECEIPT
        </text>
        <text x="36" y="86" fill="var(--text-muted)" fontSize="12">
          Generated demo record, not an independently uploaded proof.
        </text>
        <text
          x="36"
          y="147"
          fill="var(--text-primary)"
          fontSize="31"
          fontFamily="monospace"
        >
          {cash(d.amount)} USD
        </text>
        <text x="36" y="190" fill="var(--text-secondary)" fontSize="15">
          {d.investorName} · {d.pool}
        </text>
        <text
          x="36"
          y="228"
          fill="var(--text-muted)"
          fontSize="12"
          textLength={Math.min(648, d.reference.length * 7)}
          lengthAdjust="spacingAndGlyphs"
        >
          {d.reference}
        </text>
        <text x="36" y="266" fill="var(--text-muted)" fontSize="12">
          {time(d.date)} UTC · {human(d.method)}
        </text>
        <text x="36" y="320" fill="var(--warning)" fontSize="17">
          DEMO ONLY — NO PAYMENT EVIDENCE
        </text>
      </svg>
      <div className="fd-note">
        <Icon name="info" size={17} />
        Receipt rendering cannot establish authenticity. Production requires
        private proof storage, signed access and independently verified provider
        settlement.
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: IconName;
  onClick: () => void;
}) {
  const n = useLiveCountUp(value);
  return (
    <button className="fd-metric" onClick={onClick}>
      <div>
        <span>{label}</span>
        <Icon name={icon} size={16} />
      </div>
      <strong className="mono">{cash(n)}</strong>
      <small>
        {detail}
        <span>↗</span>
      </small>
    </button>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span className={`fd-status fd-status-${status}`}>
      {status === "verified" || status === "healthy" || status === "balanced"
        ? "● "
        : "○ "}
      {human(status)}
    </span>
  );
}
function TreasuryDesk({ initial }: { initial: FundsBundle }) {
  const { pushToast } = useOperatorUI();
  const { data, mutation, reset } = useFunds(initial);
  const o = getFundsOverview(data);
  const checks = reconciliationChecks(data);
  const liveDifference = Math.max(...checks.map((c) => Math.abs(c.difference)));
  const [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(null);
  const [drawer, setDrawer] = useState<{
    kind: "deposit" | "allocation" | "provider";
    id: string;
  } | null>(null);
  const [drawerTab, setDrawerTab] = useState("summary");
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [pool, setPool] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [flowFilter, setFlowFilter] = useState("all");
  const [flowPage, setFlowPage] = useState(1);
  const [deployDraft, setDeployDraft] = useState<Record<string, number>>({});
  const [targetPercent, setTargetPercent] = useState(
    data.reserve.targetPercent,
  );
  const [topUpSource, setTopUpSource] = useState<"cash" | "positions">("cash");
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportScope, setExportScope] = useState("filtered");
  const [dailyNeed, setDailyNeed] = useState(500);
  const [diagnosed, setDiagnosed] = useState(false);
  const [intake, setIntake] = useState<DepositIntake>({
    investorId: data.investors[0].id,
    pool: "PKG-01",
    amount: 1000,
    method: "bank_transfer",
    reference: "",
  });
  const deposit =
    data.deposits.find((d) => d.id === modal?.id) ?? data.deposits[0];
  const allocation =
    data.allocations.find((p) => p.code === modal?.id) ?? data.allocations[0];
  const provider =
    data.providers.find((p) => p.id === modal?.id) ?? data.providers[0];
  const movement =
    data.movements.find((f) => f.id === modal?.id) ?? data.movements[0];
  const run = data.runs.find((r) => r.id === modal?.id) ?? data.runs[0];
  const investor =
    data.investors.find((i) => i.id === (modal?.id ?? deposit.investorId)) ??
    data.investors[0];
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("id", { header: "ID" }),
        col.accessor("date", { header: "Date / UTC" }),
        col.accessor("investorName", { header: "Investor" }),
        col.accessor("amount", { header: "Amount" }),
        col.accessor("method", { header: "Method" }),
        col.accessor("pool", { header: "Package" }),
        col.accessor("status", { header: "Status" }),
        col.accessor("verifiedBy", { header: "Reviewer" }),
      ]),
    [],
  );
  const filtered = useMemo(
    () =>
      data.deposits.filter(
        (d) =>
          (status === "all" ||
            (status === "open"
              ? !["verified", "rejected"].includes(d.status)
              : d.status === status)) &&
          (method === "all" || d.method === method) &&
          (pool === "all" || d.pool === pool) &&
          `${d.id} ${d.investorName} ${d.reference}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data.deposits, status, method, pool, search],
  );
  const table = useDeskTable({
    data: filtered,
    columns,
    getRowId: (r) => r.id,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(typeof updater === "function" ? updater(sorting) : updater);
      setPage(1);
    },
  });
  const sorted = table.getRowModel().rows;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const flows = data.movements.filter(
    (f) => flowFilter === "all" || f.kind === flowFilter,
  );
  const flowPages = Math.max(1, Math.ceil(flows.length / 4));
  const safeFlowPage = Math.min(flowPage, flowPages);
  const flowRows = flows.slice((safeFlowPage - 1) * 4, safeFlowPage * 4);
  const draftTotal = money(
    data.allocations.reduce((n, p) => n + (deployDraft[p.code] ?? 0), 0),
  );
  const draftCash = money(o.capital - o.escrow - draftTotal);
  const draftIssue = data.allocations.some(
    (p) =>
      !Number.isFinite(deployDraft[p.code]) ||
      (deployDraft[p.code] ?? 0) < 0 ||
      (deployDraft[p.code] ?? 0) > p.capital,
  )
    ? "Each deployment must be between zero and its funded capital."
    : draftCash < data.reserve.balance
      ? "This plan would consume reserve or escrow."
      : "";
  const overlayOpen = !!modal || !!drawer;
  useEffect(() => {
    if (!overlayOpen) return;
    const before = document.activeElement as HTMLElement | null;
    const layer = document.querySelector<HTMLElement>(
      ".page-dashboard-funds .fd-local-layer",
    );
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        layer?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
    focusables()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mutation.isPending || busy) return;
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
  }, [overlayOpen, modal?.kind, drawer?.id, mutation.isPending, busy]);
  function open(kind: Kind, id?: string) {
    setDrawer(null);
    setStep(0);
    setNotes("");
    setError("");
    setConfirmed(false);
    setDiagnosed(false);
    if (kind === "rebalance")
      setDeployDraft(
        Object.fromEntries(data.allocations.map((p) => [p.code, p.deployed])),
      );
    if (kind === "policy") setTargetPercent(data.reserve.targetPercent);
    if (kind === "topup")
      setTopUpSource(o.spendable >= o.reserveGap ? "cash" : "positions");
    setModal({ kind, id });
  }
  function inspect(kind: "deposit" | "allocation" | "provider", id: string) {
    setModal(null);
    setDrawerTab("summary");
    setDrawer({ kind, id });
  }
  function close() {
    if (!busy && !mutation.isPending) {
      setModal(null);
      setDrawer(null);
    }
  }
  function clearFilters() {
    setSearch("");
    setStatus("all");
    setMethod("all");
    setPool("all");
    setPage(1);
  }
  async function commit(command: FundsCommand, message: string) {
    setError("");
    try {
      await mutation.mutateAsync(command);
      setModal(null);
      pushToast({ tone: "success", title: message });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update the local workspace.",
      );
    }
  }
  function notesField(label = "Review notes") {
    return (
      <label className="fd-field">
        {label}
        <textarea
          className="form-control"
          rows={4}
          minLength={10}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <small>
          10–1,000 characters. Recorded only in this local demo audit trail.
        </small>
      </label>
    );
  }
  function consent(
    text = "I understand this changes only the local demo workspace and performs no real financial action.",
  ) {
    return (
      <label className="fd-check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {text}
      </label>
    );
  }
  function checkTable(rows = checks) {
    return (
      <div className="fd-controls">
        {rows.map((c) => (
          <div key={c.key}>
            <div>
              <Icon
                name={Math.abs(c.difference) < 0.001 ? "check" : "shield"}
                size={16}
              />
              <b>{c.label}</b>
              <Status
                status={
                  Math.abs(c.difference) < 0.001
                    ? "balanced"
                    : Math.abs(c.difference) > 1
                      ? "alert"
                      : "review"
                }
              />
            </div>
            <dl>
              <div>
                <dt>Expected</dt>
                <dd className="mono">{cash(c.expected)}</dd>
              </div>
              <div>
                <dt>Observed control</dt>
                <dd className="mono">{cash(c.actual)}</dd>
              </div>
              <div>
                <dt>Difference</dt>
                <dd
                  className={`mono ${c.difference ? "text-loss" : "text-win"}`}
                >
                  {cash(c.difference)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    );
  }
  function depositFacts(d: Deposit) {
    return (
      <dl className="fd-facts">
        {[
          ["Deposit", d.id],
          ["Investor", d.investorName],
          ["Amount / currency", `${cash(d.amount)} USD`],
          ["Package", d.pool],
          ["Provider reference", d.reference],
          ["Received / UTC", time(d.date)],
          [
            "KYC gate",
            d.kycVerified ? "Verified (demo)" : "Outstanding — credit blocked",
          ],
          [
            "Provider gate",
            d.providerSettled
              ? "Settled (demo)"
              : "Settlement outstanding — credit blocked",
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  async function exportReport() {
    setBusy(true);
    setError("");
    try {
      const rows = exportScope === "all" ? data.deposits : filtered;
      if (exportFormat === "json")
        download(
          JSON.stringify(
            {
              mode: "demo",
              snapshot: data.asOf,
              revision: data.revision,
              overview: o,
              scope: exportScope,
              deposits: rows,
              allocations: data.allocations,
              custody: data.custody,
              reserve: data.reserve,
              checks,
              runs: data.runs,
              movements: data.movements,
              audit: data.audit,
            },
            null,
            2,
          ),
          "application/json",
          "trademo-treasury.json",
        );
      else if (exportFormat === "csv") {
        const safe = (v: unknown) => {
          let s = String(v ?? "");
          if (/^[=+\-@]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        };
        download(
          [
            [
              "id",
              "date_utc",
              "investor",
              "amount_usd",
              "method",
              "package",
              "status",
              "reviewer",
              "reference",
            ],
            ...rows.map((d) => [
              d.id,
              d.date,
              d.investorName,
              d.amount,
              d.method,
              d.pool,
              d.status,
              d.verifiedBy ?? "",
              d.reference,
            ]),
          ]
            .map((r) => r.map(safe).join(","))
            .join("\r\n"),
          "text/csv;charset=utf-8",
          "trademo-deposits.csv",
        );
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        let y = 22;
        const line = (text: string, bold = false) => {
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setFontSize(bold ? 13 : 10);
          for (const l of doc.splitTextToSize(text, 175)) {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.text(l, 18, y);
            y += 7;
          }
          y += 2;
        };
        line("tradeMO / Funds & Capital", true);
        line(
          `DEMO ONLY / snapshot ${time(data.asOf)} UTC / revision ${data.revision}`,
        );
        line(
          `Managed capital ${cash(o.capital)} | Deployed ${cash(o.deployed)} | Available ${cash(o.available)}`,
        );
        line(
          `Broker cash ${cash(o.brokerCash)} | Escrow ${cash(o.escrow)} | Protected reserve ${cash(o.reserve)}`,
        );
        line("Reconciliation controls", true);
        checks.forEach((c) =>
          line(
            `${c.key}: expected ${cash(c.expected)}, observed ${cash(c.actual)}, difference ${cash(c.difference)}`,
          ),
        );
        line("Package deployment", true);
        data.allocations.forEach((p) =>
          line(
            `${p.code} / funded ${cash(p.capital)} / deployed ${cash(p.deployed)}`,
          ),
        );
        line(`Deposit register (${exportScope}, ${rows.length} rows)`, true);
        rows.forEach((d) =>
          line(`${d.id} / ${d.investorName} / ${cash(d.amount)} / ${d.status}`),
        );
        line(
          "Synthetic records and local simulations. Not independent provider reconciliation, audited accounts or evidence of real transfers. Escrow and reserve are not additive to available capital.",
        );
        doc.save("trademo-treasury-audit.pdf");
      }
      setModal(null);
      pushToast({ tone: "success", title: "Treasury report downloaded" });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Report could not be generated.",
      );
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || mutation.isPending;
  const validNotes = notes.trim().length >= 10;
  const canVerify =
    !["verified", "rejected"].includes(deposit.status) &&
    deposit.kycVerified &&
    deposit.providerSettled;
  const steps: Partial<Record<Kind, string[]>> = {
    intake: ["Intake details", "Review reference", "Record intake"],
    verify: ["Review evidence", "Reviewer notes", "Confirm credit"],
    rebalance: ["Allocation plan", "Liquidity impact", "Confirm"],
    topup: ["Choose source", "Reserve impact", "Confirm"],
    reconcile: ["Source controls", "Check results", "Record run"],
    export: ["File format", "Report scope", "Download"],
  };
  function wizardFooter() {
    if (!modal) return null;
    const kind = modal.kind;
    const back = (
      <button
        className="fd-btn"
        disabled={disabled}
        onClick={() => (step ? setStep(step - 1) : close())}
      >
        {step ? "Back" : "Cancel"}
      </button>
    );
    const continueButton = (
      action: () => void,
      label = "Continue →",
      blocked = false,
    ) => (
      <button
        className="fd-btn fd-primary"
        disabled={disabled || blocked}
        onClick={action}
      >
        {disabled ? "Working…" : label}
      </button>
    );
    if (kind === "intake")
      return step === 0 ? (
        <button className="fd-btn" onClick={close}>
          Cancel
        </button>
      ) : (
        <>
          {back}
          {continueButton(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    {
                      kind: "register",
                      deposit: intake,
                      notes:
                        notes ||
                        "Manual intake recorded for external provider settlement review.",
                    },
                    "Deposit intake recorded locally; no funds credited",
                  ),
            step < 2 ? "Continue →" : "Record demo intake",
            step === 2 && !confirmed,
          )}
        </>
      );
    if (kind === "verify")
      return (
        <>
          {back}
          {continueButton(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    { kind: "verify", id: deposit.id, notes },
                    "Deposit credited in local demo; no real money moved",
                  ),
            step < 2 ? "Continue →" : "Simulate settled credit",
            !canVerify ||
              (step === 1 && !validNotes) ||
              (step === 2 && !confirmed),
          )}
        </>
      );
    if (kind === "reject" || kind === "info")
      return (
        <>
          {back}
          {continueButton(
            () =>
              void commit(
                {
                  kind: kind === "reject" ? "reject" : "requestInfo",
                  id: deposit.id,
                  notes,
                },
                kind === "reject"
                  ? "Submission rejected locally; no refund was sent"
                  : "Information request logged locally; no message sent",
              ),
            kind === "reject" ? "Reject submission" : "Log information request",
            !validNotes ||
              !confirmed ||
              ["verified", "rejected"].includes(deposit.status),
          )}
        </>
      );
    if (kind === "rebalance")
      return (
        <>
          {back}
          {continueButton(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    {
                      kind: "rebalance",
                      allocations: data.allocations.map((p) => ({
                        code: p.code,
                        deployed: deployDraft[p.code],
                      })),
                      notes,
                    },
                    "Capital rebalanced in the local simulation",
                  ),
            step < 2 ? "Continue →" : "Apply demo allocation",
            !!draftIssue ||
              (step === 1 && !validNotes) ||
              (step === 2 && !confirmed),
          )}
        </>
      );
    if (kind === "policy")
      return (
        <>
          {back}
          {continueButton(
            () =>
              void commit(
                { kind: "reservePolicy", percent: targetPercent, notes },
                "Reserve target policy updated locally",
              ),
            "Save reserve policy",
            !validNotes ||
              !confirmed ||
              !Number.isFinite(targetPercent) ||
              targetPercent < 1 ||
              targetPercent > 20,
          )}
        </>
      );
    if (kind === "topup")
      return (
        <>
          {back}
          {continueButton(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    { kind: "reserveTopUp", source: topUpSource, notes },
                    "Reserve earmarked locally; no external transfer",
                  ),
            step < 2 ? "Continue →" : "Apply reserve simulation",
            !o.reserveGap ||
              (topUpSource === "cash" && o.reserveGap > o.spendable) ||
              (topUpSource === "positions" && o.reserveGap > o.deployed) ||
              (step === 1 && !validNotes) ||
              (step === 2 && !confirmed),
          )}
        </>
      );
    if (kind === "reconcile")
      return (
        <>
          {back}
          {continueButton(
            () =>
              step < 2
                ? setStep(step + 1)
                : void commit(
                    {
                      kind: "reconcile",
                      notes:
                        "Manual local three-way control snapshot reconciliation; no live provider fetch.",
                    },
                    "Local reconciliation recorded; no provider API called",
                  ),
            step < 2 ? "Continue →" : "Record reconciliation",
            step === 2 && !confirmed,
          )}
        </>
      );
    if (kind === "export")
      return (
        <>
          {back}
          {continueButton(
            () => (step < 2 ? setStep(step + 1) : void exportReport()),
            step < 2 ? "Continue →" : "Download report",
            step === 2 && !confirmed,
          )}
        </>
      );
    if (kind === "discrepancy")
      return (
        <>
          {back}
          {continueButton(
            () =>
              void commit(
                { kind: "note", reference: run.id, notes },
                "Review note appended; control balances unchanged",
              ),
            "Append review note",
            !validNotes,
          )}
        </>
      );
    if (kind === "reset")
      return (
        <>
          {back}
          {continueButton(
            () => {
              reset();
              clearFilters();
              setModal(null);
              pushToast({
                tone: "info",
                title: "Local treasury restored to the opening snapshot",
              });
            },
            "Reset local workspace",
            !confirmed,
          )}
        </>
      );
    return (
      <>
        <button className="fd-btn" onClick={close}>
          Close
        </button>
      </>
    );
  }
  return (
    <div className="fd-canvas">
      <header className="fd-header">
        <div>
          <div className="fd-eyebrow">
            <span className="fd-tag mono">D-8</span> OPERATOR CONSOLE / TREASURY
            & CAPITAL
          </div>
          <h1>Funds & Capital</h1>
          <p>
            Follow the money. Verify incoming principal, protect liquidity, and
            keep every control account in balance.
          </p>
        </div>
        <div className="fd-actions">
          <button className="fd-btn" onClick={() => open("audit")}>
            <Icon name="activity" size={14} />
            Audit trail
          </button>
          <button className="fd-btn" onClick={() => open("export")}>
            <Icon name="download" size={14} />
            Export report
          </button>
          <button className="fd-btn fd-primary" onClick={() => open("intake")}>
            <Icon name="plus" size={14} />
            Register deposit
          </button>
        </div>
      </header>
      <div className="fd-demo">
        <span className="fd-status fd-status-demo">DEMO TREASURY</span>
        <span>
          Seeded control balances · local actions reset on reload · no live
          provider connection
        </span>
        <span className="mono">
          BASE SNAPSHOT {time(data.asOf)} UTC · LOCAL REV {data.revision}
        </span>
        <button className="fd-link" onClick={() => open("methodology")}>
          Balance basis ↗
        </button>
      </div>
      <section className="fd-metrics" aria-label="Capital overview">
        <Metric
          label="Capital under management"
          value={o.capital}
          detail="Net principal control · USD reporting"
          icon="vault"
          onClick={() => open("methodology")}
        />
        <Metric
          label="Deployed in trades"
          value={o.deployed}
          detail={`${pct(o.utilization)} utilization · three mandates`}
          icon="chart"
          onClick={() => open("rebalance")}
        />
        <Metric
          label="Available capital"
          value={o.available}
          detail="Includes reserve & in-transit escrow"
          icon="layers"
          onClick={() => open("forecast")}
        />
        <Metric
          label="Pending deposits"
          value={o.pending}
          detail={`${o.pendingCount} uncredited submissions · excluded from capital`}
          icon="clock"
          onClick={() => {
            setStatus("open");
            setPage(1);
            document
              .getElementById("funds-deposits")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <Metric
          label="Broker cash control"
          value={o.brokerCash}
          detail="Deriv demo · includes protected reserve"
          icon="plug"
          onClick={() => open("provider", "deriv")}
        />
        <Metric
          label="Escrow / in transit"
          value={o.escrow}
          detail="Owned principal · not yet deployable"
          icon="lock"
          onClick={() => open("methodology")}
        />
      </section>
      <section className="fd-liquidity">
        <div>
          <Icon name="shield" size={19} />
          <span>
            <b>{cash(o.spendable)} deployable now</b>
            <small>
              Available {cash(o.available)} − escrow {cash(o.escrow)} − reserve{" "}
              {cash(o.reserve)}
            </small>
          </span>
        </div>
        <div className="fd-liquidity-bar" aria-label="Capital composition">
          <i
            style={{
              width: `${(o.deployed / o.capital) * 100}%`,
              background: colors[0],
            }}
          />
          <i
            style={{
              width: `${(o.spendable / o.capital) * 100}%`,
              background: colors[1],
            }}
          />
          <i
            style={{
              width: `${(o.reserve / o.capital) * 100}%`,
              background: colors[2],
            }}
          />
          <i
            style={{
              width: `${(o.escrow / o.capital) * 100}%`,
              background: colors[3],
            }}
          />
        </div>
        <button className="fd-link" onClick={() => open("forecast")}>
          Liquidity runway ↗
        </button>
      </section>
      <section className="fd-panel" id="funds-deposits">
        <div className="fd-panel-head">
          <div>
            <span className="fd-section-code">01 / INBOUND CAPITAL</span>
            <h2>Deposit records</h2>
            <p>
              Evidence-led review. Only KYC-cleared, demo-settled submissions
              can be credited.
            </p>
          </div>
          <div className="fd-actions">
            <span className="fd-tag mono">
              {o.pendingCount} OPEN / {cash(o.pending)}
            </span>
            <button className="fd-btn" onClick={() => open("intake")}>
              New intake ↗
            </button>
          </div>
        </div>
        <div className="fd-filterbar">
          <label className="fd-search">
            <Icon name="search" size={14} />
            <input
              aria-label="Search deposits"
              placeholder="Investor, reference or ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Deposit status filter"
            className="fd-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="open">Open reviews</option>
            {[
              "pending",
              "submitted",
              "information_requested",
              "verified",
              "rejected",
            ].map((v) => (
              <option value={v} key={v}>
                {human(v)}
              </option>
            ))}
          </select>
          <select
            aria-label="Deposit method filter"
            className="fd-select"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All methods</option>
            {["mobile_money", "bank_transfer", "crypto_usdt", "card"].map(
              (v) => (
                <option value={v} key={v}>
                  {human(v)}
                </option>
              ),
            )}
          </select>
          <select
            aria-label="Deposit package filter"
            className="fd-select"
            value={pool}
            onChange={(e) => {
              setPool(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All packages</option>
            {data.allocations.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}
              </option>
            ))}
          </select>
          <select
            className="fd-select"
            aria-label="Sort deposits"
            value={`${sorting[0]?.id ?? "date"}:${sorting[0]?.desc ? "desc" : "asc"}`}
            onChange={(e) => {
              const [id, direction] = e.target.value.split(":");
              setSorting([{ id, desc: direction === "desc" }]);
            }}
          >
            {table.getAllLeafColumns().flatMap((c) => {
              const id = c.id;
              return [
                <option key={`${id}desc`} value={`${id}:desc`}>
                  {String(c.columnDef.header)} ↓
                </option>,
                <option key={`${id}asc`} value={`${id}:asc`}>
                  {String(c.columnDef.header)} ↑
                </option>,
              ];
            })}
          </select>
          <button className="fd-link" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
        <div className="table-responsive">
          <table className="table fd-table fd-responsive">
            <thead>
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((h) => (
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
                <th>Review actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ original: d }, i) => {
                const final = ["verified", "rejected"].includes(d.status);
                return (
                  <tr key={d.id} style={{ animationDelay: `${i * 35}ms` }}>
                    <td data-label="Deposit">
                      <button
                        className="fd-link mono"
                        onClick={() => open("deposit", d.id)}
                      >
                        {d.id} ↗
                      </button>
                    </td>
                    <td data-label="Date / UTC" className="mono">
                      {time(d.date)}
                    </td>
                    <td data-label="Investor">
                      <button
                        className="fd-link"
                        onClick={() => open("investor", d.investorId)}
                      >
                        {d.investorName}
                      </button>
                    </td>
                    <td data-label="Amount" className="mono fd-strong">
                      {cash(d.amount)}
                    </td>
                    <td data-label="Method">{human(d.method)}</td>
                    <td data-label="Package">
                      <button
                        className="fd-link mono"
                        onClick={() => open("allocation", d.pool)}
                      >
                        {d.pool}
                      </button>
                    </td>
                    <td data-label="Status">
                      <Status status={d.status} />
                    </td>
                    <td data-label="Reviewer" className="mono">
                      {d.verifiedBy ?? "Not reviewed"}
                    </td>
                    <td data-label="Actions">
                      <div className="fd-row-actions">
                        <button
                          disabled={
                            final || !d.kycVerified || !d.providerSettled
                          }
                          title={
                            final
                              ? "Review final"
                              : !d.kycVerified
                                ? "KYC outstanding"
                                : !d.providerSettled
                                  ? "Provider settlement outstanding"
                                  : "Review demo settlement"
                          }
                          onClick={() => open("verify", d.id)}
                        >
                          Verify
                        </button>
                        <button
                          disabled={final}
                          onClick={() => open("reject", d.id)}
                        >
                          Reject
                        </button>
                        <button
                          disabled={final}
                          onClick={() => open("info", d.id)}
                        >
                          More info
                        </button>
                        <button onClick={() => open("proof", d.id)}>
                          Proof
                        </button>
                        <button
                          aria-label={`Inspect ${d.id}`}
                          className="fd-row-icon"
                          onClick={() => inspect("deposit", d.id)}
                        >
                          <Icon name="panelRight" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleRows.length && (
          <div className="fd-empty">
            <Icon name="search" size={25} />
            <h3>No matching deposits</h3>
            <p>Try another investor, method or status.</p>
            <button className="fd-btn" onClick={clearFilters}>
              Reset deposit filters
            </button>
          </div>
        )}
        <div className="fd-panel-foot">
          <span>
            {filtered.length} of {data.deposits.length} sample records ·
            register is not lifetime funding history
          </span>
          <div className="fd-pagination">
            <label>
              Rows{" "}
              <select
                aria-label="Deposit rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[5, 10, 25].map((v) => (
                  <option value={v} key={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Previous deposit page"
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
            >
              ←
            </button>
            <span>
              {safePage} / {totalPages}
            </span>
            <button
              aria-label="Next deposit page"
              disabled={safePage === totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              →
            </button>
          </div>
        </div>
      </section>
      <section className="fd-panel">
        <div className="fd-panel-head">
          <div>
            <span className="fd-section-code">02 / DEPLOYMENT</span>
            <h2>Capital allocation</h2>
            <p>
              Funded ownership and deployed principal are separate controls.
              Escrow is never deployable.
            </p>
          </div>
          <button className="fd-btn" onClick={() => open("rebalance")}>
            <Icon name="split" size={14} />
            Rebalance allocations
          </button>
        </div>
        <div className="fd-allocation-layout">
          <div className="fd-donut">
            <svg
              viewBox="0 0 220 220"
              role="img"
              aria-label={`Capital allocation: ${cash(o.deployed)} deployed and ${cash(o.available)} available`}
            >
              <title>Principal allocation by package</title>
              <circle
                cx="110"
                cy="110"
                r="82"
                fill="none"
                stroke="var(--surface-sunken)"
                strokeWidth="20"
              />
              {[...data.allocations.map((p) => p.deployed), o.available].map(
                (amount, i, all) => (
                  <circle
                    key={i}
                    cx="110"
                    cy="110"
                    r="82"
                    fill="none"
                    stroke={colors[i]}
                    strokeWidth="20"
                    pathLength="100"
                    strokeDasharray={`${(amount / o.capital) * 100} ${100 - (amount / o.capital) * 100}`}
                    strokeDashoffset={
                      (-all.slice(0, i).reduce((n, v) => n + v, 0) /
                        o.capital) *
                      100
                    }
                    transform="rotate(-90 110 110)"
                  />
                ),
              )}
              <text
                x="110"
                y="102"
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="11"
              >
                CAPITAL UTILIZATION
              </text>
              <text
                x="110"
                y="130"
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize="27"
                fontFamily="monospace"
              >
                {pct(o.utilization)}
              </text>
            </svg>
            <div>
              {data.allocations.map((p, i) => (
                <button key={p.code} onClick={() => open("allocation", p.code)}>
                  <i style={{ background: colors[i] }} />
                  <span>{p.code}</span>
                  <b className="mono">{pct((p.deployed / o.capital) * 100)}</b>
                </button>
              ))}
              <button onClick={() => open("forecast")}>
                <i style={{ background: colors[3] }} />
                <span>Available</span>
                <b className="mono">{cash(o.available)}</b>
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table fd-table fd-responsive">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Funded capital</th>
                  <th>Deployed</th>
                  <th>% of total</th>
                  <th>Trades</th>
                  <th>Avg stake</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.allocations.map((p) => (
                  <tr key={p.code}>
                    <td data-label="Package">
                      <button
                        className="fd-link"
                        onClick={() => inspect("allocation", p.code)}
                      >
                        {p.code} ↗
                      </button>
                      <small className="fd-cell-sub">{p.name}</small>
                    </td>
                    <td data-label="Funded capital" className="mono">
                      {cash(p.capital)}
                    </td>
                    <td data-label="Deployed" className="mono">
                      {cash(p.deployed)}
                    </td>
                    <td data-label="Share of total" className="mono">
                      {pct((p.deployed / o.capital) * 100)}
                    </td>
                    <td data-label="Trades" className="mono">
                      {p.trades}
                    </td>
                    <td data-label="Avg stake" className="mono">
                      {cash(p.averageStake)}
                    </td>
                    <td data-label="Status">
                      <Status status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="fd-panel-foot">
          <span>
            Deployment {cash(o.deployed)} + available {cash(o.available)} ={" "}
            {cash(o.capital)}. Reserve is included in cash.
          </span>
          <button className="fd-link" onClick={() => open("methodology")}>
            Control definitions ↗
          </button>
        </div>
      </section>
      <section className="fd-panel">
        <div className="fd-panel-head">
          <div>
            <span className="fd-section-code">03 / MOVEMENTS</span>
            <h2>Fund flow timeline</h2>
            <p>
              Operational activity, newest first. A paginated feed is not a
              complete accounting journal.
            </p>
          </div>
          <select
            className="fd-select"
            aria-label="Fund flow filter"
            value={flowFilter}
            onChange={(e) => {
              setFlowFilter(e.target.value);
              setFlowPage(1);
            }}
          >
            <option value="all">All movements</option>
            {[
              "deposit_in",
              "trade_out",
              "trade_in",
              "payout_out",
              "fee_out",
              "allocation",
              "reserve",
            ].map((t) => (
              <option key={t} value={t}>
                {human(t)}
              </option>
            ))}
          </select>
        </div>
        <ol className="fd-timeline">
          {flowRows.map((f, i) => (
            <li key={f.id} style={{ animationDelay: `${i * 50}ms` }}>
              <button onClick={() => open("movement", f.id)}>
                <div className="fd-flow-top">
                  <span
                    className={`fd-flow-icon ${f.status === "pending" ? "fd-pending" : ""}`}
                  >
                    <Icon
                      name={
                        f.kind === "deposit_in"
                          ? "vault"
                          : f.kind === "reserve"
                            ? "shield"
                            : f.amount < 0
                              ? "trendDown"
                              : "trendUp"
                      }
                      size={16}
                    />
                  </span>
                  <time className="mono">{time(f.time)}</time>
                </div>
                <span className="fd-flow-kind">
                  {human(f.kind)}
                  {["allocation", "reserve"].includes(f.kind)
                    ? " · internal"
                    : ""}
                </span>
                <strong
                  className={`mono ${f.status === "pending" || ["allocation", "reserve"].includes(f.kind) ? "" : f.amount < 0 ? "text-loss" : "text-win"}`}
                >
                  {f.amount > 0 && !["allocation", "reserve"].includes(f.kind)
                    ? "+"
                    : ""}
                  {cash(f.amount)}
                </strong>
                <span className="fd-flow-route">
                  {f.from} → {f.to}
                </span>
                <small className="mono">{f.reference}</small>
                <Status status={f.status} />
              </button>
            </li>
          ))}
        </ol>
        {!flowRows.length && (
          <div className="fd-empty">
            No movements of this type.{" "}
            <button className="fd-link" onClick={() => setFlowFilter("all")}>
              Show all movements
            </button>
          </div>
        )}
        <div className="fd-panel-foot">
          <span>
            Historic posted activity is already reflected in the control
            snapshot; never add it twice.
          </span>
          <div className="fd-pagination">
            <button
              aria-label="Previous flow page"
              disabled={safeFlowPage === 1}
              onClick={() => setFlowPage(safeFlowPage - 1)}
            >
              ←
            </button>
            <span>
              {safeFlowPage} / {flowPages}
            </span>
            <button
              aria-label="Next flow page"
              disabled={safeFlowPage === flowPages}
              onClick={() => setFlowPage(safeFlowPage + 1)}
            >
              →
            </button>
          </div>
        </div>
      </section>
      <section className="fd-panel">
        <div className="fd-panel-head">
          <div>
            <span className="fd-section-code">04 / CONTROL ROOM</span>
            <h2>Reconciliation & audit</h2>
            <p>
              Ledger, deployment and custody-control comparisons. Differences
              above $1 require escalation.
            </p>
          </div>
          <div className="fd-actions">
            <span
              role="status"
              className={
                mutation.isPending && mutation.variables?.kind === "reconcile"
                  ? "fd-state-running"
                  : ""
              }
            >
              <Status
                status={
                  mutation.isPending && mutation.variables?.kind === "reconcile"
                    ? "running"
                    : liveDifference > 1
                      ? "alert"
                      : liveDifference
                        ? "review"
                        : "balanced"
                }
              />
            </span>
            <button
              className="fd-btn fd-primary"
              onClick={() => open("reconcile")}
            >
              <Icon name="check" size={14} />
              Run full reconciliation
            </button>
            <button
              className="fd-btn"
              onClick={() => {
                setExportFormat("pdf");
                open("export");
              }}
            >
              Audit PDF ↗
            </button>
          </div>
        </div>
        <div className="fd-recon-body">
          <div className="fd-custody-strip">
            <div>
              <small>Net capital ledger</small>
              <b className="mono">{cash(o.capital)}</b>
            </div>
            <span>=</span>
            <div>
              <small>Broker positions</small>
              <b className="mono">{cash(data.custody.positions)}</b>
            </div>
            <span>+</span>
            <div>
              <small>Broker cash</small>
              <b className="mono">{cash(o.brokerCash)}</b>
            </div>
            <span>+</span>
            <div>
              <small>Owned escrow</small>
              <b className="mono">{cash(o.escrow)}</b>
            </div>
          </div>
          {checkTable()}
        </div>
        <div className="fd-run-list">
          <div className="fd-subhead">
            <h3>Last five control runs</h3>
            <span className="fd-muted">
              Historical exceptions remain visible after resolution
            </span>
          </div>
          {data.runs.map((r) => (
            <button
              className="fd-run"
              key={r.id}
              onClick={() => open("reconciliation", r.id)}
            >
              <Icon
                name={r.status === "balanced" ? "check" : "shield"}
                size={15}
              />
              <time className="mono">{time(r.time)} UTC</time>
              <Status status={r.status} />
              <span className="mono">Diff {cash(r.difference)}</span>
              <Icon name="arrowRight" size={14} />
            </button>
          ))}
        </div>
      </section>
      <section className="fd-panel">
        <div className="fd-panel-head">
          <div>
            <span className="fd-section-code">05 / PAYMENT RAILS</span>
            <h2>Payment provider status</h2>
            <p>
              Illustrative provider snapshots, not live health monitoring or
              connected payment rails.
            </p>
          </div>
          <button className="fd-btn" onClick={() => open("diagnostics")}>
            <Icon name="activity" size={14} />
            Inspect diagnostics
          </button>
        </div>
        <div className="fd-provider-grid">
          {data.providers.map((p) => (
            <button key={p.id} onClick={() => inspect("provider", p.id)}>
              <div>
                <span
                  className={`fd-provider-dot ${p.state === "delayed" ? "fd-delayed" : ""}`}
                />
                <strong>{p.name}</strong>
                <Icon name="arrowRight" size={13} />
              </div>
              <Status status={p.state} />
              <small>{p.channel}</small>
              <span className="mono">DEMO · {p.latency} ms</span>
              {p.state === "delayed" && <em>Settlement batch +4h</em>}
            </button>
          ))}
        </div>
      </section>
      <section className="fd-panel">
        <div className="fd-panel-head">
          <div>
            <span className="fd-section-code">06 / LIQUIDITY GUARD</span>
            <h2>Fund reserve & safety margin</h2>
            <p>
              Cash-backed earmark inside broker cash. Not an additional account
              or additive asset.
            </p>
          </div>
          <Status status={o.reserveGap ? "review" : "balanced"} />
        </div>
        <div className="fd-reserve-layout">
          <div>
            <div className="fd-reserve-value">
              <strong className="mono">{cash(o.reserve)}</strong>
              <span>of {cash(o.reserveTarget)} target</span>
            </div>
            <div className="fd-reserve-progress">
              <span
                style={{
                  width: `${Math.min(100, o.reserveTarget ? (o.reserve / o.reserveTarget) * 100 : 0)}%`,
                }}
              />
            </div>
            <div className="fd-reserve-labels">
              <span>
                {pct(o.capital ? (o.reserve / o.capital) * 100 : 0)} currently
                protected
              </span>
              <span>{pct(data.reserve.targetPercent)} policy target</span>
            </div>
            <div className="fd-reserve-suggestion">
              <Icon name="shield" size={19} />
              <div>
                <b>
                  {o.reserveGap
                    ? `${cash(o.reserveGap)} reserve shortfall`
                    : "Reserve target is covered"}
                </b>
                <p>
                  {o.reserveGap
                    ? o.spendable >= o.reserveGap
                      ? `Earmark ${cash(o.reserveGap)} from existing unreserved cash. No position release is required.`
                      : `Unreserved cash is insufficient. Review a simulated position release before changing reserves.`
                    : "Keep the current earmark or update the reserve target after reviewing liquidity."}
                </p>
              </div>
            </div>
          </div>
          <div className="fd-reserve-actions">
            <button className="fd-btn" onClick={() => open("policy")}>
              <Icon name="sliders" size={15} />
              Adjust reserve target
            </button>
            <button
              className="fd-btn fd-primary"
              disabled={!o.reserveGap}
              onClick={() => open("topup")}
            >
              <Icon name="split" size={15} />
              Plan auto-rebalance
            </button>
            <button className="fd-link" onClick={() => open("forecast")}>
              Test liquidity runway ↗
            </button>
          </div>
        </div>
      </section>
      <section>
        <div className="fd-section-head">
          <h2>Treasury workbench</h2>
          <span className="fd-muted">
            Local decisions. Explicit evidence. Exportable handoffs.
          </span>
        </div>
        <div className="fd-workbench">
          {(
            [
              ["intake", "vault", "Register intake"],
              ["rebalance", "split", "Allocation planner"],
              ["reconcile", "check", "Control reconciliation"],
              ["topup", "shield", "Reserve planner"],
              ["forecast", "chart", "Liquidity runway"],
              ["audit", "activity", "Audit trail"],
              ["methodology", "info", "Balance definitions"],
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
      <footer className="fd-footer">
        <span>
          FRONTEND DEMO / no live money movement, provider fetch or wallet
          credit
        </span>
        <Link href="/dashboard/investors">Investor roster ↗</Link>
        <Link href="/dashboard/analytics">Performance analytics ↗</Link>
        <Link href="/dashboard/trades">Execution ledger ↗</Link>
        <button className="fd-link" onClick={() => open("export")}>
          Export treasury ↗
        </button>
      </footer>
      {modal && (
        <div className="fd-local-layer">
          <DeskModalShell
            code={`D8-${String(Object.keys(titles).indexOf(modal.kind) + 1).padStart(2, "0")}`}
            eyebrow="TREASURY WORKSPACE / LOCAL DEMO"
            title={titles[modal.kind]}
            subtitle="No real transfer, provider request or external message is executed."
            size={
              [
                "proof",
                "rebalance",
                "reconciliation",
                "audit",
                "deposit",
              ].includes(modal.kind)
                ? "xl"
                : "lg"
            }
            onClose={close}
            steps={steps[modal.kind]}
            currentStep={step}
            footer={wizardFooter()}
          >
            {error && (
              <div role="alert" className="fd-error">
                {error}
              </div>
            )}
            {modal.kind === "methodology" && (
              <div className="fd-methodology">
                {[
                  [
                    "One capital identity",
                    `Managed principal ${cash(o.capital)} = deployed ${cash(o.deployed)} + available ${cash(o.available)}. Available includes broker cash and owned escrow. Reserve is a subset of broker cash, not an extra asset.`,
                  ],
                  [
                    "Spendable is not available",
                    `Only ${cash(o.spendable)} is unreserved broker cash. Escrow ${cash(o.escrow)} and protected reserve ${cash(o.reserve)} cannot fund new deployment.`,
                  ],
                  [
                    "No fabricated provider connection",
                    "Amounts are coherent demo controls seeded against D-6 funded holdings. Broker/escrow observations are illustrative. This is not a bank, chain or broker reconciliation. The spec's conflicting sample balances have not been mixed into one accounting identity.",
                  ],
                  [
                    "Pending deposits are external",
                    "Unverified submissions are not in owned escrow, capital or broker cash. Local verification simulates a settled receipt only after KYC and provider gates. A deposit cannot be credited twice. Rejected submissions do not trigger refunds.",
                  ],
                  [
                    "Frontend state boundary",
                    "Actions use a typed, validated TanStack Query cache reducer and session audit trail. Reload resets all changes. Changes in this desk do not mutate other independently seeded demo pages. Production requires authorized commands, immutable journals, idempotency and shared source versions.",
                  ],
                  [
                    "Historical activity & USD reporting",
                    "The deposit register and movement feed are samples, not a complete journal. Historic posted entries are already reflected in the opening control balance. Amounts use USD reporting equivalents, not a live FX quote. Trading profits in D-7 are a separate analytical snapshot, not automatically settled into this principal-control view.",
                  ],
                ].map(([h, p]) => (
                  <section key={h}>
                    <h3>{h}</h3>
                    <p>{p}</p>
                  </section>
                ))}
                <button
                  className="fd-btn"
                  onClick={() =>
                    download(
                      JSON.stringify(data, null, 2),
                      "application/json",
                      "funds-source-snapshot.json",
                    )
                  }
                >
                  Download typed source snapshot
                </button>
              </div>
            )}
            {modal.kind === "intake" &&
              (step === 0 ? (
                <DepositIntakeForm
                  data={data}
                  defaults={intake}
                  onContinue={(value) => {
                    setIntake(value);
                    setStep(1);
                  }}
                />
              ) : step === 1 ? (
                <>
                  <dl className="fd-facts">
                    {[
                      [
                        "Investor",
                        data.investors.find((i) => i.id === intake.investorId)
                          ?.name ?? intake.investorId,
                      ],
                      ["Amount", cash(intake.amount)],
                      [
                        "Package / method",
                        `${intake.pool} / ${human(intake.method)}`,
                      ],
                      ["Provider reference", intake.reference],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="fd-note">
                    <Icon name="lock" size={18} />
                    This registers an uncredited submission with provider
                    settlement outstanding. A screenshot or a typed reference
                    never proves settlement.
                  </div>
                </>
              ) : (
                <>
                  {consent(
                    "Record a synthetic, uncredited intake only. No payment is initiated and no wallet receives money.",
                  )}
                  <p className="fd-muted mt-3">
                    The new row appears as submitted and cannot pass
                    verification until independent settlement evidence is
                    integrated.
                  </p>
                </>
              ))}
            {modal.kind === "deposit" && (
              <>
                {depositFacts(deposit)}
                <div className="fd-actions">
                  <Status status={deposit.status} />
                  <button
                    className="fd-btn"
                    onClick={() => open("proof", deposit.id)}
                  >
                    View synthetic proof
                  </button>
                  <button
                    className="fd-btn"
                    disabled={!canVerify}
                    onClick={() => open("verify", deposit.id)}
                  >
                    Review verification
                  </button>
                  <button
                    className="fd-btn"
                    onClick={() => inspect("deposit", deposit.id)}
                  >
                    Open right inspector ↗
                  </button>
                </div>
                <div className="fd-note mt-3">
                  <Icon name="info" size={17} />
                  {deposit.providerSettled && deposit.kycVerified
                    ? "Demo review gates are satisfied. Final review still requires notes and explicit consent."
                    : "Crediting is blocked until KYC and independent provider settlement gates are satisfied."}
                </div>
              </>
            )}
            {modal.kind === "verify" &&
              (step === 0 ? (
                <>
                  {depositFacts(deposit)}
                  <Proof deposit={deposit} />
                  {!canVerify && (
                    <div className="fd-error">
                      This submission cannot be credited. It is final or has an
                      unresolved evidence gate.
                    </div>
                  )}
                </>
              ) : step === 1 ? (
                <>
                  {notesField("Settlement reviewer notes")}
                  <p className="fd-muted mt-3">
                    Review investor identity, exact amount, reference uniqueness
                    and provider final settlement before approval.
                  </p>
                </>
              ) : (
                <>
                  <dl className="fd-facts">
                    <div>
                      <dt>Local credit</dt>
                      <dd>
                        {cash(deposit.amount)} to broker cash and {deposit.pool}{" "}
                        funded principal
                      </dd>
                    </div>
                    <div>
                      <dt>Managed capital after simulation</dt>
                      <dd>{cash(o.capital + deposit.amount)}</dd>
                    </div>
                    <div>
                      <dt>Deployment</dt>
                      <dd>Unchanged — no trade is opened</dd>
                    </div>
                    <div>
                      <dt>Reviewer notes</dt>
                      <dd>{notes}</dd>
                    </div>
                  </dl>
                  {consent()}
                </>
              ))}
            {(modal.kind === "reject" || modal.kind === "info") && (
              <>
                <div className="fd-summary">
                  <span className="fd-tag mono">{deposit.id}</span>
                  <strong>{deposit.investorName}</strong>
                  <b className="mono">{cash(deposit.amount)}</b>
                </div>
                {notesField(
                  modal.kind === "reject"
                    ? "Reason for rejection"
                    : "Information needed from investor / provider",
                )}
                {consent(
                  modal.kind === "reject"
                    ? "Reject the local submission only. No refund or external message will be sent."
                    : "Log this request in the local review history. No email, SMS or provider message is sent here.",
                )}
              </>
            )}
            {modal.kind === "proof" && (
              <>
                <Proof deposit={deposit} />
                <div className="fd-actions mt-3">
                  <button
                    className="fd-btn"
                    onClick={() =>
                      download(
                        receiptSvg(deposit),
                        "image/svg+xml",
                        `${deposit.id}-synthetic-receipt.svg`,
                      )
                    }
                  >
                    Download synthetic receipt
                  </button>
                  <button
                    className="fd-btn"
                    onClick={() => open("deposit", deposit.id)}
                  >
                    Review deposit dossier
                  </button>
                </div>
              </>
            )}
            {modal.kind === "investor" && (
              <>
                <div className="fd-summary">
                  <span className="fd-tag mono">{investor.id}</span>
                  <h3>{investor.name}</h3>
                  <Status
                    status={investor.kycVerified ? "verified" : "review"}
                  />
                </div>
                <p className="fd-muted">
                  Deposit-register context only; not the investor’s complete
                  wallet, lifetime funding or current KYC verification service.
                </p>
                <div className="fd-list">
                  {data.deposits
                    .filter((d) => d.investorId === investor.id)
                    .map((d) => (
                      <button key={d.id} onClick={() => open("deposit", d.id)}>
                        <span className="mono">{d.id}</span>
                        <Status status={d.status} />
                        <b className="mono">{cash(d.amount)}</b>
                        <Icon name="arrowRight" size={13} />
                      </button>
                    ))}
                </div>
                {!data.deposits.some((d) => d.investorId === investor.id) && (
                  <div className="fd-empty">
                    No sample deposit records for this investor.
                  </div>
                )}
                <Link className="fd-btn mt-3" href="/dashboard/investors">
                  Open full investor roster ↗
                </Link>
              </>
            )}
            {modal.kind === "allocation" && (
              <>
                <div className="fd-summary">
                  <span className="fd-tag mono">{allocation.code}</span>
                  <h3>{allocation.name}</h3>
                </div>
                <dl className="fd-facts">
                  {[
                    ["Funded principal", cash(allocation.capital)],
                    ["Deployed", cash(allocation.deployed)],
                    [
                      "Undeployed entitlement",
                      cash(allocation.capital - allocation.deployed),
                    ],
                    [
                      "Share of managed capital",
                      pct((allocation.deployed / o.capital) * 100),
                    ],
                    [
                      "Observed trades / average stake",
                      `${allocation.trades} / ${cash(allocation.averageStake)}`,
                    ],
                    ["Deployment state", allocation.status],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="fd-muted">
                  Undeployed entitlement is an accounting attribution, not a
                  separate wallet or immediately spendable package balance.
                </p>
                <div className="fd-actions">
                  <button className="fd-btn" onClick={() => open("rebalance")}>
                    Edit allocation plan
                  </button>
                  <button
                    className="fd-btn"
                    onClick={() => inspect("allocation", allocation.code)}
                  >
                    Open right inspector ↗
                  </button>
                  <Link className="fd-btn" href="/dashboard/packages">
                    Package manager ↗
                  </Link>
                </div>
              </>
            )}
            {modal.kind === "rebalance" &&
              (step === 0 ? (
                <>
                  <div className="fd-note mb-3">
                    <Icon name="info" size={17} />
                    Enter dollar deployments. Percentage shares update
                    automatically. Each package stays within funded principal;
                    reserve and escrow are protected.
                  </div>
                  <div className="fd-allocation-editor">
                    {data.allocations.map((p, i) => (
                      <label className="fd-field" key={p.code}>
                        <span>
                          <i style={{ background: colors[i] }} />
                          {p.code} · {p.name}
                        </span>
                        <input
                          className="form-control"
                          aria-label={`${p.code} deployment USD`}
                          type="number"
                          min="0"
                          max={p.capital}
                          step="0.01"
                          value={deployDraft[p.code] ?? 0}
                          onChange={(e) =>
                            setDeployDraft({
                              ...deployDraft,
                              [p.code]: Number(e.target.value),
                            })
                          }
                        />
                        <small>
                          Funded {cash(p.capital)} ·{" "}
                          {pct(
                            o.capital
                              ? ((deployDraft[p.code] ?? 0) / o.capital) * 100
                              : 0,
                          )}{" "}
                          of total
                        </small>
                      </label>
                    ))}
                  </div>
                  {draftIssue && (
                    <div className="fd-error mt-3">{draftIssue}</div>
                  )}
                  <div className="fd-summary mt-3">
                    <span>Planned deployment</span>
                    <strong className="mono">{cash(draftTotal)}</strong>
                    <span>Cash after {cash(draftCash)}</span>
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <dl className="fd-facts">
                    <div>
                      <dt>Deployment change</dt>
                      <dd>{cash(draftTotal - o.deployed)}</dd>
                    </div>
                    <div>
                      <dt>Broker cash after</dt>
                      <dd>{cash(draftCash)}</dd>
                    </div>
                    <div>
                      <dt>Spendable after reserve</dt>
                      <dd>{cash(draftCash - data.reserve.balance)}</dd>
                    </div>
                    <div>
                      <dt>Owned escrow / protected reserve</dt>
                      <dd>
                        {cash(o.escrow)} / {cash(o.reserve)} — unchanged
                      </dd>
                    </div>
                  </dl>
                  {notesField("Allocation rationale")}
                </>
              ) : (
                <>
                  <div className="fd-note mb-3">
                    <Icon name="shield" size={18} />
                    This models settled principal changes, not a trading order.
                    Real deployment/release requires execution permissions,
                    position eligibility and asynchronous broker confirmation.
                  </div>
                  {consent()}
                </>
              ))}
            {modal.kind === "movement" && (
              <>
                <dl className="fd-facts">
                  {[
                    ["Movement", movement.id],
                    ["UTC timestamp", time(movement.time)],
                    [
                      "Kind / status",
                      `${human(movement.kind)} / ${movement.status}`,
                    ],
                    ["Amount", cash(movement.amount)],
                    ["Route", `${movement.from} → ${movement.to}`],
                    ["Reference", movement.reference],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="fd-muted">{movement.note}</p>
                <div className="fd-actions">
                  <button
                    className="fd-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(movement, null, 2),
                        "application/json",
                        `${movement.id}.json`,
                      )
                    }
                  >
                    Download movement JSON
                  </button>
                  {data.deposits.some((d) => d.id === movement.reference) && (
                    <button
                      className="fd-btn"
                      onClick={() => open("deposit", movement.reference)}
                    >
                      Related deposit ↗
                    </button>
                  )}
                  <button className="fd-btn" onClick={() => open("audit")}>
                    View control audit trail
                  </button>
                </div>
              </>
            )}
            {modal.kind === "reconcile" &&
              (step === 0 ? (
                <>
                  <div className="fd-note">
                    <Icon name="shield" size={20} />
                    This checks the current local ledger, package allocations
                    and separate custody-control fields. It does not contact
                    Deriv, banks, card providers or chains.
                  </div>
                  <dl className="fd-facts mt-3">
                    <div>
                      <dt>Control snapshot</dt>
                      <dd>
                        {time(data.asOf)} UTC + local revision {data.revision}
                      </dd>
                    </div>
                    <div>
                      <dt>Alert threshold</dt>
                      <dd>Absolute difference above $1.00 in any control</dd>
                    </div>
                    <div>
                      <dt>Sources</dt>
                      <dd>
                        Net principal ledger, package principal/deployment,
                        broker cash/positions, owned escrow
                      </dd>
                    </div>
                    <div>
                      <dt>Persisted evidence</dt>
                      <dd>Last five local runs and session audit trail</dd>
                    </div>
                  </dl>
                </>
              ) : step === 1 ? (
                <>
                  {checkTable()}
                  <div className="fd-note mt-3">
                    <Icon name="info" size={18} />
                    Arithmetic agreement is not independent provider or bank
                    evidence. Do not label this an audited financial statement.
                  </div>
                </>
              ) : (
                <>
                  {consent(
                    "Record these synthetic control checks in local history. No provider data will be fetched or marked verified.",
                  )}
                  <p className="fd-muted mt-3">
                    Maximum absolute difference: {cash(liveDifference)}. All
                    three check rows and the current revision are included in
                    exports.
                  </p>
                </>
              ))}
            {modal.kind === "reconciliation" && (
              <>
                <div className="fd-summary">
                  <span className="fd-tag mono">{run.id}</span>
                  <span className="mono">{time(run.time)} UTC</span>
                  <Status status={run.status} />
                  <span className="fd-tag mono">
                    Control rev {run.sourceRevision}
                  </span>
                </div>
                {checkTable(run.checks)}
                <p className="fd-muted mt-3">{run.note}</p>
                <div className="fd-actions">
                  <button
                    className="fd-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(run, null, 2),
                        "application/json",
                        `${run.id}.json`,
                      )
                    }
                  >
                    Download reconciliation evidence
                  </button>
                  <button
                    className="fd-btn"
                    onClick={() => open("discrepancy", run.id)}
                  >
                    Review / annotate discrepancy
                  </button>
                </div>
              </>
            )}
            {modal.kind === "discrepancy" && (
              <>
                <div className="fd-note mb-3">
                  <Icon name="shield" size={18} />
                  {run.id} · recorded difference {cash(run.difference)}.
                  Historic exceptions cannot be erased or auto-marked resolved
                  by a note.
                </div>
                <p className="fd-muted">
                  Investigate timestamps, settlement finality, duplicate
                  references, rounding and missing journals. An alert requires
                  independent source evidence before any correcting entry.
                </p>
                {notesField("Control investigation note")}
              </>
            )}
            {modal.kind === "provider" && (
              <>
                <div className="fd-summary">
                  <h3>{provider.name}</h3>
                  <Status status={provider.state} />
                </div>
                <dl className="fd-facts">
                  <div>
                    <dt>Reporting rail</dt>
                    <dd>{provider.channel}</dd>
                  </div>
                  <div>
                    <dt>Example latency</dt>
                    <dd>{provider.latency} ms</dd>
                  </div>
                  <div>
                    <dt>Snapshot / UTC</dt>
                    <dd>{time(provider.lastChecked)}</dd>
                  </div>
                  <div>
                    <dt>Connection mode</dt>
                    <dd>
                      Demo data only — credentials and webhooks not configured
                    </dd>
                  </div>
                </dl>
                <p className="fd-muted">{provider.detail}</p>
                <div className="fd-actions">
                  <button
                    className="fd-btn"
                    onClick={() => open("diagnostics", provider.id)}
                  >
                    Inspect snapshot diagnostics
                  </button>
                  <button
                    className="fd-btn"
                    onClick={() =>
                      download(
                        JSON.stringify(provider, null, 2),
                        "application/json",
                        `${provider.id}-provider-snapshot.json`,
                      )
                    }
                  >
                    Download provider snapshot
                  </button>
                </div>
              </>
            )}
            {modal.kind === "diagnostics" && (
              <>
                <div className="fd-note mb-3">
                  <Icon name="plug" size={18} />
                  This local diagnostic checks DTO status and timestamps, not
                  provider connectivity. No external requests are made.
                </div>
                <button
                  className="fd-btn fd-primary"
                  onClick={() => setDiagnosed(true)}
                >
                  Evaluate snapshot diagnostics
                </button>
                {diagnosed && (
                  <div className="fd-diagnostics mt-3">
                    {data.providers
                      .filter((p) => !modal.id || p.id === modal.id)
                      .map((p) => (
                        <article key={p.id}>
                          <div>
                            <strong>{p.name}</strong>
                            <Status status={p.state} />
                          </div>
                          <p>{p.detail}</p>
                          <small className="mono">
                            Snapshot {time(p.lastChecked)} UTC / latency{" "}
                            {p.latency} ms / synthetic source
                          </small>
                          <button
                            className="fd-link"
                            onClick={() => open("provider", p.id)}
                          >
                            Open provider detail ↗
                          </button>
                        </article>
                      ))}
                  </div>
                )}
              </>
            )}
            {modal.kind === "policy" && (
              <>
                <label className="fd-field">
                  Reserve target / % of managed principal
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    max="20"
                    step="0.1"
                    value={targetPercent || ""}
                    onChange={(e) => setTargetPercent(Number(e.target.value))}
                  />
                  <small>
                    Allowed target 1–20%. Changing the policy does not
                    automatically move or earmark funds.
                  </small>
                </label>
                <dl className="fd-facts mt-3">
                  <div>
                    <dt>Proposed target</dt>
                    <dd>{cash(money((o.capital * targetPercent) / 100))}</dd>
                  </div>
                  <div>
                    <dt>Currently protected</dt>
                    <dd>{cash(o.reserve)}</dd>
                  </div>
                </dl>
                {notesField("Policy rationale")}
                {consent()}
              </>
            )}
            {modal.kind === "topup" &&
              (step === 0 ? (
                <>
                  <div className="fd-summary">
                    <span>Reserve target gap</span>
                    <strong className="mono">{cash(o.reserveGap)}</strong>
                  </div>
                  <div className="fd-choice-grid">
                    {(
                      [
                        [
                          "cash",
                          "Existing free cash",
                          `${cash(o.spendable)} unreserved, settled cash; no position release.`,
                        ],
                        [
                          "positions",
                          "Release deployed principal",
                          "Pro-rata, cent-exact position-release simulation. Not a broker close request.",
                        ],
                      ] as const
                    ).map(([key, label, detail]) => (
                      <button
                        className={topUpSource === key ? "selected" : ""}
                        key={key}
                        onClick={() => setTopUpSource(key)}
                      >
                        <Icon
                          name={key === "cash" ? "vault" : "split"}
                          size={22}
                        />
                        <b>{label}</b>
                        <small>{detail}</small>
                      </button>
                    ))}
                  </div>
                  {!o.reserveGap && (
                    <p className="fd-muted mt-3">
                      The target is already met. Update the policy first if a
                      higher reserve is required.
                    </p>
                  )}
                  {topUpSource === "cash" && o.reserveGap > o.spendable && (
                    <div className="fd-error mt-3">
                      Insufficient unreserved cash. Use the position-release
                      simulation or revise the target.
                    </div>
                  )}
                </>
              ) : step === 1 ? (
                <>
                  <dl className="fd-facts">
                    <div>
                      <dt>Protected reserve after</dt>
                      <dd>{cash(o.reserve + o.reserveGap)}</dd>
                    </div>
                    <div>
                      <dt>Deployment after</dt>
                      <dd>
                        {cash(
                          o.deployed -
                            (topUpSource === "positions" ? o.reserveGap : 0),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Broker cash after</dt>
                      <dd>
                        {cash(
                          o.brokerCash +
                            (topUpSource === "positions" ? o.reserveGap : 0),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Spendable after</dt>
                      <dd>
                        {cash(
                          o.spendable -
                            (topUpSource === "cash" ? o.reserveGap : 0),
                        )}
                      </dd>
                    </div>
                  </dl>
                  {notesField("Reserve funding rationale")}
                </>
              ) : (
                <>
                  <div className="fd-note mb-3">
                    <Icon name="lock" size={18} />
                    An earmark stays inside broker cash. Position-release
                    simulation assumes settlement at principal value and ignores
                    market losses and execution restrictions. Production must
                    wait for eligible broker settlement before reserving
                    proceeds.
                  </div>
                  {consent()}
                </>
              ))}
            {modal.kind === "export" &&
              (step === 0 ? (
                <div className="fd-choice-grid">
                  {[
                    [
                      "csv",
                      "CSV",
                      "Deposit register with current filter or full-register scope",
                    ],
                    [
                      "json",
                      "JSON",
                      "Complete controls, allocations, movements and audit evidence",
                    ],
                    [
                      "pdf",
                      "PDF",
                      "Printable treasury and reconciliation summary",
                    ],
                  ].map(([key, label, detail]) => (
                    <button
                      key={key}
                      className={exportFormat === key ? "selected" : ""}
                      onClick={() => setExportFormat(key)}
                    >
                      <Icon name="download" size={23} />
                      <b>{label}</b>
                      <small>{detail}</small>
                    </button>
                  ))}
                </div>
              ) : step === 1 ? (
                <>
                  <label className="fd-field">
                    Deposit report scope
                    <select
                      className="form-select"
                      value={exportScope}
                      onChange={(e) => setExportScope(e.target.value)}
                    >
                      <option value="filtered">
                        Current filters ({filtered.length} rows)
                      </option>
                      <option value="all">
                        Full sample register ({data.deposits.length} rows)
                      </option>
                    </select>
                  </label>
                  <dl className="fd-facts mt-3">
                    <div>
                      <dt>Control revision</dt>
                      <dd>{data.revision}</dd>
                    </div>
                    <div>
                      <dt>Format</dt>
                      <dd>{exportFormat.toUpperCase()}</dd>
                    </div>
                    <div>
                      <dt>Snapshot</dt>
                      <dd>{time(data.asOf)} UTC</dd>
                    </div>
                    <div>
                      <dt>Currency</dt>
                      <dd>USD reporting equivalents</dd>
                    </div>
                  </dl>
                  <p className="fd-muted">
                    Controls and allocations are portfolio-wide, even if the
                    deposit register is filtered.
                  </p>
                </>
              ) : (
                <>
                  {consent(
                    "Download a synthetic treasury report, not an audited financial statement or proof of real payments.",
                  )}
                  <p className="fd-muted mt-3">
                    Production exports require access control, private signed
                    storage and an immutable export audit event.
                  </p>
                </>
              ))}
            {modal.kind === "audit" && (
              <>
                <div className="fd-audit-list">
                  {data.audit.map((a) => (
                    <article key={a.id}>
                      <div>
                        <span className="fd-tag">{human(a.action)}</span>
                        <time className="mono">{time(a.time)} UTC</time>
                      </div>
                      <b className="mono">{a.reference}</b>
                      <p>{a.notes}</p>
                    </article>
                  ))}
                </div>
                <button
                  className="fd-btn mt-3"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        { revision: data.revision, audit: data.audit },
                        null,
                        2,
                      ),
                      "application/json",
                      "treasury-audit-trail.json",
                    )
                  }
                >
                  Download session audit JSON
                </button>
              </>
            )}
            {modal.kind === "forecast" && (
              <>
                <label className="fd-field">
                  Hypothetical daily cash need / USD
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    value={dailyNeed || ""}
                    onChange={(e) =>
                      setDailyNeed(
                        Math.min(1000000, Math.max(0, Number(e.target.value))),
                      )
                    }
                  />
                </label>
                <dl className="fd-facts mt-3">
                  <div>
                    <dt>Unreserved, settled cash</dt>
                    <dd>{cash(o.spendable)}</dd>
                  </div>
                  <div>
                    <dt>Static coverage</dt>
                    <dd>
                      {dailyNeed > 0
                        ? `${(o.spendable / dailyNeed).toFixed(1)} days`
                        : "Enter a positive daily need"}
                    </dd>
                  </div>
                  <div>
                    <dt>Protected / unavailable</dt>
                    <dd>
                      {cash(o.reserve)} reserve + {cash(o.escrow)} escrow
                    </dd>
                  </div>
                  <div>
                    <dt>Cash coverage after reserve target</dt>
                    <dd>
                      {dailyNeed > 0
                        ? `${(Math.max(0, o.spendable - o.reserveGap) / dailyNeed).toFixed(1)} days without position release`
                        : "Enter a positive daily need"}
                    </dd>
                  </div>
                  <div>
                    <dt>Inflows / position releases</dt>
                    <dd>Excluded from this scenario</dd>
                  </div>
                </dl>
                <div className="fd-note">
                  <Icon name="info" size={18} />A simple cash ÷ daily need
                  sensitivity, not a liquidity forecast, payout guarantee or
                  credit facility. It does not change observed balances.
                </div>
                <button
                  className="fd-btn mt-3"
                  disabled={!dailyNeed}
                  onClick={() =>
                    download(
                      JSON.stringify(
                        {
                          mode: "demo",
                          spendable: o.spendable,
                          dailyNeed,
                          coverageDays: o.spendable / dailyNeed,
                          notForecast: true,
                        },
                        null,
                        2,
                      ),
                      "application/json",
                      "treasury-liquidity-scenario.json",
                    )
                  }
                >
                  Download liquidity scenario
                </button>
              </>
            )}
            {modal.kind === "reset" && (
              <>
                <p className="fd-muted">
                  Discard local deposit reviews, allocations, reserve changes,
                  reconciliation runs and audit notes. Earlier pages are
                  unaffected. Download a report first if you need the local
                  evidence.
                </p>
                {consent(
                  "Discard this workspace’s local session changes and restore the opening demo snapshot.",
                )}
              </>
            )}
          </DeskModalShell>
        </div>
      )}
      {drawer && (
        <div
          className="fd-drawer-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <aside
            className="fd-drawer fd-local-layer"
            role="dialog"
            aria-modal="true"
            aria-label="Treasury right inspector"
          >
            <div className="fd-drawer-head">
              <div>
                <span className="fd-eyebrow">TREASURY INSPECTOR</span>
                <h2>{drawer.id}</h2>
              </div>
              <button
                className="fd-icon"
                aria-label="Close treasury inspector"
                onClick={close}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav
              className="fd-drawer-tabs"
              aria-label="Treasury inspector tabs"
            >
              {["summary", "evidence", "activity"].map((t) => (
                <button
                  key={t}
                  className={drawerTab === t ? "active" : ""}
                  onClick={() => setDrawerTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="fd-drawer-body">
              {drawer.kind === "deposit" &&
                (() => {
                  const d = data.deposits.find((d) => d.id === drawer.id)!;
                  return drawerTab === "summary" ? (
                    <>
                      <div className="fd-drawer-value mono">
                        {cash(d.amount)}
                      </div>
                      <Status status={d.status} />
                      {depositFacts(d)}
                    </>
                  ) : drawerTab === "evidence" ? (
                    <>
                      <Proof deposit={d} />
                      <dl className="fd-facts">
                        <div>
                          <dt>KYC gate</dt>
                          <dd>
                            {d.kycVerified ? "Demo verified" : "Outstanding"}
                          </dd>
                        </div>
                        <div>
                          <dt>Settlement gate</dt>
                          <dd>
                            {d.providerSettled ? "Demo settled" : "Outstanding"}
                          </dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <>
                      <h3>Review notes</h3>
                      {d.notes.length ? (
                        d.notes.map((n, i) => (
                          <p className="fd-note" key={i}>
                            {n}
                          </p>
                        ))
                      ) : (
                        <p className="fd-muted">
                          No reviewer notes in this snapshot.
                        </p>
                      )}
                      {data.audit
                        .filter((a) => a.reference === d.id)
                        .map((a) => (
                          <article className="fd-audit-item" key={a.id}>
                            <b>{human(a.action)}</b>
                            <small className="mono">{time(a.time)} UTC</small>
                            <p>{a.notes}</p>
                          </article>
                        ))}
                    </>
                  );
                })()}
              {drawer.kind === "allocation" &&
                (() => {
                  const p = data.allocations.find((p) => p.code === drawer.id)!;
                  return drawerTab === "summary" ? (
                    <>
                      <h3>{p.name}</h3>
                      <div className="fd-drawer-value mono">
                        {cash(p.deployed)}
                      </div>
                      <dl className="fd-facts">
                        <div>
                          <dt>Funded principal</dt>
                          <dd>{cash(p.capital)}</dd>
                        </div>
                        <div>
                          <dt>Undeployed attribution</dt>
                          <dd>{cash(p.capital - p.deployed)}</dd>
                        </div>
                        <div>
                          <dt>Trade count</dt>
                          <dd>{p.trades}</dd>
                        </div>
                        <div>
                          <dt>Average stake</dt>
                          <dd>{cash(p.averageStake)}</dd>
                        </div>
                      </dl>
                    </>
                  ) : drawerTab === "evidence" ? (
                    <>
                      <p className="fd-muted">
                        Allocation controls derive from the seeded
                        funded-principal model. Position-control balance is
                        independent and must reconcile before local capital
                        changes.
                      </p>
                      {checkTable()}
                    </>
                  ) : (
                    <div className="fd-audit-list">
                      {data.audit
                        .filter((a) =>
                          ["rebalance", "reserveTopUp", "snapshot"].includes(
                            a.action,
                          ),
                        )
                        .map((a) => (
                          <article key={a.id}>
                            <b>{human(a.action)}</b>
                            <p>{a.notes}</p>
                          </article>
                        ))}
                    </div>
                  );
                })()}
              {drawer.kind === "provider" &&
                (() => {
                  const p = data.providers.find((p) => p.id === drawer.id)!;
                  return drawerTab === "summary" ? (
                    <>
                      <h3>{p.name}</h3>
                      <Status status={p.state} />
                      <p className="fd-muted mt-3">{p.detail}</p>
                      <dl className="fd-facts">
                        <div>
                          <dt>Example latency</dt>
                          <dd>{p.latency} ms</dd>
                        </div>
                        <div>
                          <dt>Rail</dt>
                          <dd>{p.channel}</dd>
                        </div>
                      </dl>
                    </>
                  ) : drawerTab === "evidence" ? (
                    <>
                      <div className="fd-note">
                        This is a synthetic provider-status DTO, not a network
                        probe, authenticated session or settlement confirmation.
                      </div>
                      <pre className="fd-code">
                        {JSON.stringify(p, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <>
                      <p className="fd-muted">
                        Last recorded snapshot: {time(p.lastChecked)} UTC. Live
                        webhook and monitoring histories are not connected.
                      </p>
                      <button
                        className="fd-btn"
                        onClick={() => open("diagnostics", p.id)}
                      >
                        Evaluate snapshot diagnostics
                      </button>
                    </>
                  );
                })()}
            </div>
            <div className="fd-drawer-foot">
              <button
                className="fd-btn"
                onClick={() => open(drawer.kind, drawer.id)}
              >
                Full detail ↗
              </button>
              <button
                className="fd-btn fd-primary"
                onClick={() =>
                  open(
                    drawer.kind === "deposit"
                      ? "proof"
                      : drawer.kind === "allocation"
                        ? "rebalance"
                        : "diagnostics",
                    drawer.id,
                  )
                }
              >
                {drawer.kind === "deposit"
                  ? "View proof"
                  : drawer.kind === "allocation"
                    ? "Allocation planner"
                    : "Diagnostics"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
export function FundsPage({
  operatorBundle,
  initial,
}: {
  operatorBundle: OperatorBundleProps;
  initial: FundsBundle;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-funds" bundle={operatorBundle}>
      {() => <TreasuryDesk initial={initial} />}
    </OperatorShell>
  );
}
