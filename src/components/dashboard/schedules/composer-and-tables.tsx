"use client";

import { useForm, useStore } from "@tanstack/react-form";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import type {
  DerivSymbol,
  FundsFlowDTO,
  OperatorWorkspaceDTO,
  StrategyName,
} from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";
import {
  useBulkScheduleUpdate,
  useCreateScheduleSequence,
  usePatchScheduleSequence,
  useResolveScheduleConflict,
} from "@/lib/queries/use-schedules";
import {
  CRON_PRESETS,
  describeCronExpression,
  SCHEDULE_STRATEGIES,
  SCHEDULE_SYMBOLS,
  suggestScheduleName,
  timeToMinutes,
} from "@/lib/schedules/schemas";
import type {
  PackageScheduleMappingDTO,
  ScheduleHistoryRunDTO,
  ScheduleRecurrence,
  ScheduleSequenceDTO,
  TradeSchedulerBundleDTO,
} from "@/lib/schedules/types";

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 7 · PRE-FLIGHT CONFLICTS & GUARDRAIL WARNINGS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
export function ScheduleConflictsPanel({ bundle }: { bundle: TradeSchedulerBundleDTO }) {
  const { openSchedulerModal, inspectEntity, pushToast } = useOperatorUI();
  const resolveMut = useResolveScheduleConflict();
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const unacknowledged = bundle.conflicts.filter((c) => !c.acknowledged);
  const visible = showAcknowledged ? bundle.conflicts : unacknowledged;

  return (
    <section className="sch-section" aria-label="Schedule conflicts and pre-flight warnings">
      <div className="sch-panel">
        <div className="sch-panel__head">
          <div>
            <span className="eyebrow-label">
              Section 7 · Automated Pre-Flight &amp; Overlap Verification
            </span>
            <h2 className="sch-panel__title">
              Schedule Conflicts &amp; Market Guardrail Checks ({unacknowledged.length} Active)
            </h2>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="sch-seg">
              <button
                type="button"
                className={cn("sch-seg__btn", !showAcknowledged && "is-active")}
                onClick={() => setShowAcknowledged(false)}
              >
                Active ({unacknowledged.length})
              </button>
              <button
                type="button"
                className={cn("sch-seg__btn", showAcknowledged && "is-active")}
                onClick={() => setShowAcknowledged(true)}
              >
                All ({bundle.conflicts.length})
              </button>
            </div>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "conflict-resolver-wizard" })}
            >
              <Icon name="sliders" size={14} /> Open 3-Step Conflict Wizard
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="p-3 px-4 d-flex justify-content-between align-items-center small">
            <span className="text-win fw-semibold">
              All scheduled execution windows clear — zero pool overlaps, FX weekend mismatches, or
              margin reserve breaches.
            </span>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "guardrail-cooldown-policy" })}
            >
              Review Cooldown Rules
            </button>
          </div>
        ) : (
          <div className="sch-conflict-list">
            {visible.map((cnf) => (
              <div
                key={cnf.id}
                className={cn("sch-conflict-row", cnf.acknowledged && "is-ack")}
              >
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "sch-conflict-badge mono",
                        cnf.severity === "critical" && "is-critical",
                        cnf.severity === "warning" && "is-warning",
                        cnf.severity === "advisory" && "is-advisory",
                      )}
                    >
                      {cnf.severity}
                    </span>
                    <span className="desk-code-tag mono">{cnf.scheduleCode}</span>
                    <span className="mono small text-secondary">{cnf.windowLabel}</span>
                    <span className="mono small text-muted">Pool {cnf.packageCode}</span>
                  </div>
                  <div className="fw-semibold small">{cnf.headline}</div>
                  <div className="small text-secondary">{cnf.detail}</div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-1">
                  <button
                    type="button"
                    className="btn-brand py-1 px-2 small"
                    disabled={resolveMut.isPending}
                    onClick={async () => {
                      await resolveMut.mutateAsync({
                        conflictId: cnf.id,
                        mode: "auto_fix",
                      });
                      pushToast({
                        tone: "success",
                        title: `Applied fix: ${cnf.recommendedFixLabel}`,
                        detail: cnf.scheduleName,
                      });
                    }}
                  >
                    {cnf.recommendedFixLabel}
                  </button>
                  {!cnf.acknowledged ? (
                    <button
                      type="button"
                      className="sch-row-btn"
                      disabled={resolveMut.isPending}
                      onClick={() =>
                        resolveMut.mutate({ conflictId: cnf.id, mode: "acknowledge" })
                      }
                    >
                      Continue Anyway
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="sch-row-btn"
                    onClick={() =>
                      inspectEntity({ kind: "schedule-sequence", id: cnf.scheduleId })
                    }
                  >
                    Inspect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3 · SCHEDULED TRADE LIST (`@tanstack/react-table` v9)
   ═══════════════════════════════════════════════════════════════════════════ */
const seqCol = createDeskColumnHelper<ScheduleSequenceDTO>();

export function ScheduledTradesTableSection({
  bundle,
  selectedCalendarDate,
}: {
  bundle: TradeSchedulerBundleDTO;
  selectedCalendarDate: string;
}) {
  const {
    openSchedulerModal,
    inspectEntity,
    flashScheduleId,
    markFlashedSchedule,
    pushToast,
  } = useOperatorUI();
  const patchSeq = usePatchScheduleSequence();
  const bulkMut = useBulkScheduleUpdate();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [dateScope, setDateScope] = useState<"all" | "selected_day" | "weekdays" | "weekends">(
    "all",
  );
  const [poolFilter, setPoolFilter] = useState<string>("ALL");
  const [strategyFilter, setStrategyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(25);
  const [pageIndex, setPageIndex] = useState(0);

  const selectedDayObj = bundle.calendarDays.find((d) => d.date === selectedCalendarDate);

  const filteredData = useMemo(() => {
    return bundle.sequences.filter((seq) => {
      if (dateScope === "selected_day" && !selectedDayObj?.scheduleIds.includes(seq.id)) {
        return false;
      }
      if (
        dateScope === "weekdays" &&
        seq.recurrence !== "weekdays" &&
        seq.recurrence !== "daily"
      ) {
        return false;
      }
      if (
        dateScope === "weekends" &&
        seq.recurrence !== "weekends_synthetics" &&
        seq.recurrence !== "daily"
      ) {
        return false;
      }
      if (poolFilter !== "ALL" && !seq.packageCodes.includes(poolFilter)) return false;
      if (strategyFilter !== "ALL" && seq.strategy !== strategyFilter) return false;
      if (statusFilter !== "ALL" && seq.status !== statusFilter) return false;
      return true;
    });
  }, [
    bundle.sequences,
    dateScope,
    poolFilter,
    strategyFilter,
    statusFilter,
    selectedDayObj,
  ]);

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map((r) => r.id));
    }
  };

  const columns = useMemo(
    () =>
      seqCol.columns([
        seqCol.display({
          id: "select",
          header: () => (
            <input
              type="checkbox"
              className="form-check-input"
              aria-label="Select all visible schedules"
              checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
              onChange={toggleSelectAll}
            />
          ),
          cell: (info) => (
            <input
              type="checkbox"
              className="form-check-input"
              aria-label={`Select ${info.row.original.name}`}
              checked={selectedIds.includes(info.row.original.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleSelectRow(info.row.original.id)}
            />
          ),
        }),
        seqCol.accessor("startTime", {
          header: "Time (UTC)",
          cell: (info) => (
            <div>
              <span className="mono fw-semibold d-block">
                {info.getValue()}–{info.row.original.endTime}
              </span>
              <span className="sch-cell-sub mono">
                {info.row.original.recurrence.replace("_", " ")}
              </span>
            </div>
          ),
        }),
        seqCol.accessor("symbol", {
          header: "Symbol & Sequence",
          cell: (info) => (
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="desk-code-tag mono">{info.getValue()}</span>
                <span className="fw-semibold">{info.row.original.name}</span>
              </div>
              <span className="sch-cell-sub mono">
                {info.row.original.code} · {info.row.original.contractLabel} ·{" "}
                {info.row.original.assignedBotCode}
              </span>
            </div>
          ),
        }),
        seqCol.accessor("strategy", {
          header: "Strategy",
          cell: (info) => (
            <div>
              <span className="pill">{info.getValue()}</span>
              {info.row.original.cronExpression ? (
                <span className="sch-cell-sub mono mt-1">{info.row.original.cronExpression}</span>
              ) : null}
            </div>
          ),
        }),
        seqCol.display({
          id: "packages",
          header: "Package Split",
          cell: (info) => (
            <div className="d-flex flex-wrap gap-1">
              {info.row.original.packageCodes.map((code) => (
                <span key={code} className="desk-code-tag mono">
                  {code} {info.row.original.packageAllocation[code] ?? 0}%
                </span>
              ))}
            </div>
          ),
        }),
        seqCol.accessor("initialStake", {
          header: "Stake",
          cell: (info) => (
            <span className="mono fw-semibold">{formatCurrency(info.getValue(), "USD", 2)}</span>
          ),
        }),
        seqCol.accessor("maxTrades", {
          header: "Count",
          cell: (info) => (
            <span className="mono">
              {info.row.original.completedTrades}/{info.getValue()}
            </span>
          ),
        }),
        seqCol.accessor("status", {
          header: "Status",
          cell: (info) => {
            const st = info.getValue();
            return (
              <span
                className={cn(
                  "sch-status-pill mono",
                  st === "running" && "is-running",
                  st === "completed" && "is-completed",
                  st === "paused" && "is-paused",
                  st === "skipped" && "is-skipped",
                )}
              >
                {st}
              </span>
            );
          },
        }),
        seqCol.display({
          id: "actions",
          header: "Actions",
          cell: (info) => {
            const row = info.row.original;
            return (
              <div
                className="d-flex flex-wrap justify-content-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="sch-row-btn"
                  disabled={patchSeq.isPending}
                  onClick={async () => {
                    await patchSeq.mutateAsync({ id: row.id, action: "run_now" });
                    markFlashedSchedule(row.id);
                    pushToast({
                      tone: "success",
                      title: `Executed ${row.name} (${row.symbol})`,
                    });
                  }}
                >
                  Run Now
                </button>
                <button
                  type="button"
                  className="sch-row-btn"
                  onClick={() => openSchedulerModal({ type: "edit-schedule", scheduleId: row.id })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="sch-row-btn"
                  onClick={() =>
                    openSchedulerModal({ type: "skip-blackout-guard", scheduleId: row.id })
                  }
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="sch-row-btn"
                  onClick={() =>
                    openSchedulerModal({ type: "duplicate-schedule", scheduleId: row.id })
                  }
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="sch-row-btn"
                  onClick={() =>
                    openSchedulerModal({ type: "delete-schedule-confirm", scheduleId: row.id })
                  }
                  aria-label={`Remove ${row.name}`}
                >
                  ×
                </button>
              </div>
            );
          },
        }),
      ]),
    [
      filteredData,
      markFlashedSchedule,
      openSchedulerModal,
      patchSeq,
      pushToast,
      selectedIds,
    ],
  );

  const table = useDeskTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
  });

  const allSortedRows = table.getRowModel().rows;
  const totalPages = Math.max(1, Math.ceil(allSortedRows.length / pageSize));
  const safePage = Math.min(pageIndex, totalPages - 1);
  const pagedRows = allSortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const exportCsv = () => {
    const headers = ["Code", "Name", "StartUTC", "EndUTC", "Symbol", "Strategy", "Stake", "MaxTrades", "Pools", "Status"];
    const lines = filteredData.map((s) =>
      [
        s.code,
        `"${s.name}"`,
        s.startTime,
        s.endTime,
        s.symbol,
        `"${s.strategy}"`,
        s.initialStake,
        s.maxTrades,
        `"${s.packageCodes.join(";")}"`,
        s.status,
      ].join(","),
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trademo-schedules-${bundle.kpis.anchorDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ tone: "success", title: `Exported ${filteredData.length} schedules to CSV` });
  };

  const colLabels = [
    "Select",
    "Time (UTC)",
    "Sequence",
    "Strategy",
    "Pools",
    "Stake",
    "Trades",
    "Status",
    "Actions",
  ];

  return (
    <section className="sch-section" aria-label="Scheduled trades table">
      <div className="sch-panel">
        <div className="sch-panel__head">
          <div>
            <span className="eyebrow-label">
              Section 3 · Scheduled Trade Sequence Blotter (TanStack Table)
            </span>
            <h2 className="sch-panel__title">
              Scheduled Trade List ({allSortedRows.length} Sequences)
            </h2>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={exportCsv}
            >
              <Icon name="download" size={14} /> Export CSV
            </button>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "api-payload-inspector" })}
            >
              <Icon name="code" size={14} /> JSON DTO
            </button>
            <button
              type="button"
              className="btn-brand"
              onClick={() => openSchedulerModal({ type: "master-schedule-wizard" })}
            >
              <Icon name="plus" size={14} /> New Schedule Wizard
            </button>
          </div>
        </div>

        {/* Multi-Dimensional Filter Bar */}
        <div className="sch-filter-bar">
          <input
            className="form-control form-control-sm"
            style={{ maxWidth: 260 }}
            placeholder="Search name, R_10, R_75, cron, BOT-01…"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPageIndex(0);
            }}
          />

          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={dateScope}
            onChange={(e) => {
              setDateScope(e.target.value as typeof dateScope);
              setPageIndex(0);
            }}
          >
            <option value="all">Date: All Windows</option>
            <option value="selected_day">Selected Day ({selectedCalendarDate})</option>
            <option value="weekdays">Weekdays Only</option>
            <option value="weekends">Weekends / 24-7</option>
          </select>

          <select
            className="form-select form-select-sm mono"
            style={{ width: "auto" }}
            value={poolFilter}
            onChange={(e) => {
              setPoolFilter(e.target.value);
              setPageIndex(0);
            }}
          >
            <option value="ALL">Pool: All Packages</option>
            <option value="PKG-01">PKG-01 (40%)</option>
            <option value="PKG-02">PKG-02 (35%)</option>
            <option value="PKG-03">PKG-03 (25%)</option>
          </select>

          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={strategyFilter}
            onChange={(e) => {
              setStrategyFilter(e.target.value);
              setPageIndex(0);
            }}
          >
            <option value="ALL">Strategy: All 7</option>
            {SCHEDULE_STRATEGIES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPageIndex(0);
            }}
          >
            <option value="ALL">Status: All</option>
            <option value="running">Running</option>
            <option value="queued">Queued / Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>

        {/* Bulk Operations Toolbar */}
        <div className="sch-bulk-bar">
          <span className="small fw-semibold mono">
            {selectedIds.length > 0
              ? `${selectedIds.length} sequence(s) selected for batch control`
              : "Select checkboxes on rows for bulk execution or window skipping"}
          </span>
          <div className="d-flex flex-wrap gap-1">
            <button
              type="button"
              className="sch-row-btn"
              disabled={selectedIds.length === 0 || bulkMut.isPending}
              onClick={async () => {
                await bulkMut.mutateAsync({ ids: selectedIds, action: "run_now" });
                pushToast({
                  tone: "success",
                  title: `Executed ${selectedIds.length} selected sequences`,
                });
                setSelectedIds([]);
              }}
            >
              Run Selected Now
            </button>
            <button
              type="button"
              className="sch-row-btn"
              disabled={selectedIds.length === 0 || bulkMut.isPending}
              onClick={async () => {
                await bulkMut.mutateAsync({ ids: selectedIds, action: "skip" });
                pushToast({
                  tone: "info",
                  title: `Skipped ${selectedIds.length} selected sequences`,
                });
                setSelectedIds([]);
              }}
            >
              Skip Selected
            </button>
            <button
              type="button"
              className="sch-row-btn"
              onClick={() => openSchedulerModal({ type: "bulk-schedule-ops", selectedIds })}
            >
              More Batch Actions…
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table desk-table sch-responsive-table mb-0">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(header.column.getCanSort() && "is-sortable")}
                    >
                      <span className="d-inline-flex align-items-center gap-1">
                        <table.FlexRender header={header} />
                        {header.column.getIsSorted() === "asc"
                          ? "↑"
                          : header.column.getIsSorted() === "desc"
                            ? "↓"
                            : null}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                const flashed = flashScheduleId === row.original.id;
                const selected = selectedIds.includes(row.original.id);
                return (
                  <tr
                    key={row.id}
                    onClick={() =>
                      inspectEntity({ kind: "schedule-sequence", id: row.original.id })
                    }
                    className={cn(
                      "sch-clickable-row",
                      selected && "is-selected",
                      flashed && "row-flash-win",
                    )}
                  >
                    {row.getAllCells().map((cell, cIdx) => (
                      <td key={cell.id} data-label={colLabels[cIdx] ?? ""}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="sch-panel__foot mono small">
          <div className="d-flex align-items-center gap-2">
            <span>Rows per page:</span>
            {([10, 25, 50] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                className={cn("sch-row-btn", pageSize === sz && "fw-bold")}
                onClick={() => {
                  setPageSize(sz);
                  setPageIndex(0);
                }}
              >
                {sz}
              </button>
            ))}
          </div>
          <div className="d-flex align-items-center gap-2">
            <span>
              Page {safePage + 1} of {totalPages} ({allSortedRows.length} total)
            </span>
            <button
              type="button"
              className="sch-row-btn"
              disabled={safePage === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              ← Prev
            </button>
            <button
              type="button"
              className="sch-row-btn"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 4 · INLINE NEW SCHEDULE FORM (`@tanstack/react-form` + `zod`)
   ═══════════════════════════════════════════════════════════════════════════ */
export function InlineNewScheduleComposer({
  bundle,
  funds,
  workspace,
  presetOverride,
}: {
  bundle: TradeSchedulerBundleDTO;
  funds: FundsFlowDTO;
  workspace: OperatorWorkspaceDTO;
  presetOverride: { strategy: StrategyName; symbol: DerivSymbol; nonce: number } | null;
}) {
  const { openSchedulerModal, pushToast, markFlashedSchedule } = useOperatorUI();
  const createSeq = useCreateScheduleSequence();

  const [symbolSearch, setSymbolSearch] = useState("");
  const [dateRangeMode, setDateRangeMode] = useState(false);
  const [runNowFlag, setRunNowFlag] = useState(false);
  const [customNamed, setCustomNamed] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "Martingale-R10-Evening",
      date: bundle.kpis.anchorDate,
      endDate: "2026-10-30",
      startTime: "15:00",
      endTime: "16:00",
      symbol: "R_10" as DerivSymbol,
      strategy: "Martingale" as StrategyName,
      initialStake: 35,
      maxTrades: 8,
      packageCodes: ["PKG-01", "PKG-02"] as string[],
      packageAllocation: {
        "PKG-01": 40,
        "PKG-02": 35,
        "PKG-03": 25,
        "PKG-04": 0,
      } as Record<string, number>,
      recurrence: "weekdays" as ScheduleRecurrence,
      cronExpression: "0 9 * * 1-5",
      stopLoss: 500,
      takeProfit: 1000,
      maxDrawdown: 5.0,
      cooldownLosses: 3,
      cooldownMinutes: 5,
    },
    onSubmit: async ({ value }) => {
      setFormErr(null);
      if (timeToMinutes(value.endTime) <= timeToMinutes(value.startTime)) {
        setFormErr("End time must be strictly after Start time (UTC).");
        return;
      }
      if (value.packageCodes.length === 0) {
        setFormErr("Select at least one crowdfunding package.");
        return;
      }
      const allocMap: Record<string, number> = {};
      let rawSum = 0;
      for (const code of value.packageCodes) {
        const pct = Number(value.packageAllocation[code] ?? 0);
        allocMap[code] = pct;
        rawSum += pct;
      }
      if (rawSum <= 0) {
        setFormErr("Assigned package allocation must be greater than 0%.");
        return;
      }
      // Normalize to exact 100% if needed
      if (rawSum !== 100) {
        let acc = 0;
        value.packageCodes.forEach((c, idx) => {
          if (idx === value.packageCodes.length - 1) {
            allocMap[c] = Math.max(0, 100 - acc);
          } else {
            const norm = Math.round((allocMap[c] / rawSum) * 100);
            allocMap[c] = norm;
            acc += norm;
          }
        });
      }

      const created = await createSeq.mutateAsync({
        name: value.name.trim() || suggestScheduleName(value.strategy, value.symbol, value.startTime),
        date: value.date,
        endDate: dateRangeMode ? value.endDate : null,
        startTime: value.startTime,
        endTime: value.endTime,
        symbol: value.symbol,
        strategy: value.strategy,
        initialStake: Number(value.initialStake),
        maxTrades: Number(value.maxTrades),
        packageCodes: value.packageCodes,
        packageAllocation: allocMap,
        recurrence: value.recurrence,
        cronExpression: value.recurrence === "custom_cron" ? value.cronExpression : null,
        stopLoss: Number(value.stopLoss),
        takeProfit: Number(value.takeProfit),
        maxDrawdown: Number(value.maxDrawdown),
        cooldownLosses: Number(value.cooldownLosses),
        cooldownDurationSec: Number(value.cooldownMinutes) * 60,
        runImmediately: runNowFlag,
      });

      markFlashedSchedule(created.id);
      pushToast({
        tone: "success",
        title: runNowFlag
          ? `Saved & started ${created.name} (${created.code})`
          : `Saved schedule ${created.name} (${created.code})`,
        detail: `${created.startTime}–${created.endTime} UTC · $${created.initialStake} × ${created.maxTrades} trades`,
      });
    },
  });

  // Sync preset selected from Strategy Library modal
  useEffect(() => {
    if (!presetOverride) return;
    form.setFieldValue("strategy", presetOverride.strategy);
    form.setFieldValue("symbol", presetOverride.symbol);
    const currentStart = form.state.values.startTime;
    form.setFieldValue(
      "name",
      suggestScheduleName(presetOverride.strategy, presetOverride.symbol, currentStart),
    );
  }, [presetOverride, form]);

  const values = useStore(form.store, (s) => s.values);
  const activeQuote =
    workspace.markets.find((m) => m.symbol === values.symbol) ?? workspace.markets[0];

  const matchingMarkets = workspace.markets.filter(
    (m) =>
      m.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) ||
      m.label.toLowerCase().includes(symbolSearch.toLowerCase()),
  );

  const inlineOverlap = bundle.sequences.find(
    (seq) =>
      seq.packageCodes.some((p) => values.packageCodes.includes(p)) &&
      timeToMinutes(values.startTime) < timeToMinutes(seq.endTime) &&
      timeToMinutes(seq.startTime) < timeToMinutes(values.endTime),
  );

  return (
    <section className="sch-section" aria-label="Create new trade schedule">
      <div className="sch-panel">
        <div className="sch-panel__head">
          <div>
            <span className="eyebrow-label">
              Section 4 · Inline New Schedule Composer (TanStack Form)
            </span>
            <h2 className="sch-panel__title">Configure &amp; Queue New Scheduled Trade Window</h2>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "strategy-library" })}
            >
              <Icon name="script" size={14} /> Strategy Presets (7)
            </button>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "cron-recurrence-wizard" })}
            >
              <Icon name="clock" size={14} /> Cron Studio
            </button>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "master-schedule-wizard" })}
            >
              <Icon name="layers" size={14} /> Open 4-Step Guided Wizard
            </button>
          </div>
        </div>

        <form
          className="sch-form-section"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          {formErr ? <div className="alert alert-danger py-2 small mb-3">{formErr}</div> : null}

          <div className="row g-3">
            {/* Row 1: Name, Date / Range, Start / End Time */}
            <div className="col-md-5">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small fw-semibold mb-0">Schedule Name</label>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-decoration-none mono"
                  onClick={() => {
                    setCustomNamed(false);
                    form.setFieldValue(
                      "name",
                      suggestScheduleName(values.strategy, values.symbol, values.startTime),
                    );
                  }}
                >
                  Auto-suggest
                </button>
              </div>
              <input
                className="form-control"
                value={values.name}
                onChange={(e) => {
                  setCustomNamed(true);
                  form.setFieldValue("name", e.target.value);
                }}
              />
            </div>

            <div className="col-sm-6 col-md-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small fw-semibold mb-0">
                  {dateRangeMode ? "Start Date" : "Execution Date"}
                </label>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-decoration-none"
                  onClick={() => setDateRangeMode((v) => !v)}
                >
                  {dateRangeMode ? "Single date" : "+ Range"}
                </button>
              </div>
              <div className="d-flex gap-1">
                <input
                  type="date"
                  className="form-control mono"
                  value={values.date}
                  onChange={(e) => form.setFieldValue("date", e.target.value)}
                />
                {dateRangeMode ? (
                  <input
                    type="date"
                    className="form-control mono"
                    value={values.endDate}
                    onChange={(e) => form.setFieldValue("endDate", e.target.value)}
                  />
                ) : null}
              </div>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold mb-1">Start UTC</label>
              <input
                type="time"
                className="form-control mono"
                value={values.startTime}
                onChange={(e) => {
                  form.setFieldValue("startTime", e.target.value);
                  if (!customNamed) {
                    form.setFieldValue(
                      "name",
                      suggestScheduleName(values.strategy, values.symbol, e.target.value),
                    );
                  }
                }}
              />
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold mb-1">End UTC</label>
              <input
                type="time"
                className="form-control mono"
                value={values.endTime}
                onChange={(e) => form.setFieldValue("endTime", e.target.value)}
              />
            </div>

            {/* Row 2: Searchable Symbol + Strategy + Stake Quick Chips + Max Trades */}
            <div className="col-md-5">
              <label className="form-label small fw-semibold mb-1">
                Deriv Symbol (Searchable + Live Quote)
              </label>
              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Filter symbol (e.g. R_75, EURUSD, Gold)…"
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value)}
                />
                <select
                  className="form-select form-select-sm mono"
                  style={{ maxWidth: 165 }}
                  value={values.symbol}
                  onChange={(e) => {
                    const sym = e.target.value as DerivSymbol;
                    form.setFieldValue("symbol", sym);
                    if (!customNamed) {
                      form.setFieldValue(
                        "name",
                        suggestScheduleName(values.strategy, sym, values.startTime),
                      );
                    }
                  }}
                >
                  {(matchingMarkets.length > 0
                    ? matchingMarkets.map((m) => m.symbol)
                    : SCHEDULE_SYMBOLS
                  ).map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sch-quote-strip mono">
                <span>
                  <strong>{activeQuote.symbol}</strong> · {activeQuote.label}
                </span>
                <span>
                  Spot <strong>{activeQuote.spot}</strong> · Payout{" "}
                  <strong className="text-win">{activeQuote.payoutPercent}%</strong>
                </span>
              </div>
            </div>

            <div className="col-md-3">
              <label className="form-label small fw-semibold mb-1">Execution Strategy</label>
              <select
                className="form-select"
                value={values.strategy}
                onChange={(e) => {
                  const st = e.target.value as StrategyName;
                  form.setFieldValue("strategy", st);
                  if (!customNamed) {
                    form.setFieldValue(
                      "name",
                      suggestScheduleName(st, values.symbol, values.startTime),
                    );
                  }
                }}
              >
                {SCHEDULE_STRATEGIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="sch-cell-sub mt-1">
                Sandboxed runner on active Deriv WebSocket session
              </span>
            </div>

            <div className="col-sm-8 col-md-2">
              <label className="form-label small fw-semibold mb-1">Initial Stake ($)</label>
              <input
                type="number"
                step="0.05"
                min={0.35}
                className="form-control mono"
                value={values.initialStake}
                onChange={(e) => form.setFieldValue("initialStake", Number(e.target.value))}
              />
              <div className="d-flex flex-wrap gap-1 mt-1">
                {[0.35, 1, 5, 35, 70].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className={cn(
                      "sch-stake-chip mono",
                      values.initialStake === val && "is-active",
                    )}
                    onClick={() => form.setFieldValue("initialStake", val)}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-sm-4 col-md-2">
              <label className="form-label small fw-semibold mb-1">Max Trades (1–500)</label>
              <input
                type="number"
                min={1}
                max={500}
                className="form-control mono"
                value={values.maxTrades}
                onChange={(e) => form.setFieldValue("maxTrades", Number(e.target.value))}
              />
              <span className="sch-cell-sub mono mt-1">
                Notional ${Math.round(values.initialStake * values.maxTrades)}
              </span>
            </div>

            {/* Row 3: Assign to Packages + Recurrence / Cron + Risk Guardrails */}
            <div className="col-lg-6">
              <label className="form-label small fw-semibold mb-2">
                Assign to Crowdfunding Packages (% Allocation Split)
              </label>
              <div className="d-flex flex-column gap-2">
                {funds.packages.slice(0, 3).map((pkg) => {
                  const checked = values.packageCodes.includes(pkg.code);
                  const pct = checked ? values.packageAllocation[pkg.code] ?? 0 : 0;
                  return (
                    <div
                      key={pkg.code}
                      className={cn("sch-pool-alloc-row", checked && "is-checked")}
                    >
                      <label className="d-flex align-items-center gap-2 mb-0">
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          checked={checked}
                          onChange={() => {
                            const nextCodes = checked
                              ? values.packageCodes.filter((c) => c !== pkg.code)
                              : [...values.packageCodes, pkg.code];
                            if (nextCodes.length === 0) return;
                            form.setFieldValue("packageCodes", nextCodes);
                          }}
                        />
                        <span className="mono fw-semibold">{pkg.code}</span>
                        <span className="small text-secondary">{pkg.name}</span>
                      </label>
                      <div className="d-flex align-items-center gap-2 mono small">
                        <span className="text-muted">
                          {formatCurrency(pkg.totalCapital, "USD", 0)}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          disabled={!checked}
                          className="form-control form-control-sm mono text-end"
                          style={{ width: 68 }}
                          value={pct}
                          onChange={(e) =>
                            form.setFieldValue("packageAllocation", {
                              ...values.packageAllocation,
                              [pkg.code]: Number(e.target.value),
                            })
                          }
                        />
                        <span>%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="col-lg-6">
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Recurrence Rule</label>
                  <select
                    className="form-select form-select-sm"
                    value={values.recurrence}
                    onChange={(e) =>
                      form.setFieldValue("recurrence", e.target.value as ScheduleRecurrence)
                    }
                  >
                    <option value="one_time">One-Time Window</option>
                    <option value="daily">Daily (Mon–Sun)</option>
                    <option value="weekdays">Weekdays (Mon–Fri)</option>
                    <option value="weekends_synthetics">Weekends (24/7 Synthetics)</option>
                    <option value="custom_cron">Custom Cron</option>
                  </select>
                </div>

                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Cron Expression</label>
                  <input
                    className="form-control form-control-sm mono"
                    value={values.cronExpression}
                    onChange={(e) => {
                      form.setFieldValue("recurrence", "custom_cron");
                      form.setFieldValue("cronExpression", e.target.value);
                    }}
                  />
                </div>

                <div className="col-12 d-flex flex-wrap gap-1 align-items-center">
                  {CRON_PRESETS.slice(0, 3).map((p) => (
                    <button
                      key={p.cron}
                      type="button"
                      className="sch-stake-chip mono"
                      onClick={() => {
                        form.setFieldValue("recurrence", p.recurrence);
                        form.setFieldValue("cronExpression", p.cron);
                      }}
                    >
                      {p.cron}
                    </button>
                  ))}
                  <span className="small text-muted ms-1">
                    {describeCronExpression(values.cronExpression, values.recurrence)}
                  </span>
                </div>

                <div className="col-6 col-sm-3 mt-2">
                  <label className="form-label small fw-semibold mb-1">Stop Loss ($)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm mono"
                    value={values.stopLoss}
                    onChange={(e) => form.setFieldValue("stopLoss", Number(e.target.value))}
                  />
                </div>
                <div className="col-6 col-sm-3 mt-2">
                  <label className="form-label small fw-semibold mb-1">Take Profit ($)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm mono"
                    value={values.takeProfit}
                    onChange={(e) => form.setFieldValue("takeProfit", Number(e.target.value))}
                  />
                </div>
                <div className="col-6 col-sm-3 mt-2">
                  <label className="form-label small fw-semibold mb-1">Max DD (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-control form-control-sm mono"
                    value={values.maxDrawdown}
                    onChange={(e) => form.setFieldValue("maxDrawdown", Number(e.target.value))}
                  />
                </div>
                <div className="col-6 col-sm-3 mt-2">
                  <label className="form-label small fw-semibold mb-1">Cooldown (Losses)</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    className="form-control form-control-sm mono"
                    value={values.cooldownLosses}
                    onChange={(e) => form.setFieldValue("cooldownLosses", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3 pt-3 border-top">
            <div className="small">
              {inlineOverlap ? (
                <span className="text-warning-ink fw-semibold">
                  Pre-Flight Note: Window overlaps {inlineOverlap.name} ({inlineOverlap.startTime}–
                  {inlineOverlap.endTime} UTC) on shared pool.
                </span>
              ) : (
                <span className="text-win fw-semibold">
                  Pre-Flight Check Green · Window clear across {values.packageCodes.join(", ")}
                </span>
              )}
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn-ghost btn-ghost--sm"
                disabled={createSeq.isPending}
                onClick={() => setRunNowFlag(true)}
              >
                <Icon name="bolt" size={14} /> Save &amp; Run Now
              </button>
              <button
                type="submit"
                className="btn-brand"
                disabled={createSeq.isPending}
                onClick={() => setRunNowFlag(false)}
              >
                <Icon name="check" size={15} /> Save Schedule
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 5 · PACKAGE-TRADE MAPPING (`@tanstack/react-table` v9)
   ═══════════════════════════════════════════════════════════════════════════ */
const mapCol = createDeskColumnHelper<PackageScheduleMappingDTO>();

export function PackageTradeMappingSection({ bundle }: { bundle: TradeSchedulerBundleDTO }) {
  const { openSchedulerModal, openOverlay, inspectEntity } = useOperatorUI();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () =>
      mapCol.columns([
        mapCol.accessor("packageCode", {
          header: "Package",
          cell: (info) => (
            <div>
              <span className="desk-code-tag mono me-2">{info.getValue()}</span>
              <span className="fw-semibold">{info.row.original.packageName}</span>
            </div>
          ),
        }),
        mapCol.accessor("schedulesCount", {
          header: "Schedules Count",
          cell: (info) => <span className="mono fw-semibold">{info.getValue()} schedules</span>,
        }),
        mapCol.accessor("totalCapital", {
          header: "Pooled Capital",
          cell: (info) => (
            <span className="mono">{formatCurrency(info.getValue(), "USD", 0)}</span>
          ),
        }),
        mapCol.accessor("capitalSharePercent", {
          header: "% Share",
          cell: (info) => <span className="mono fw-semibold">{info.getValue()}%</span>,
        }),
        mapCol.accessor("avgStake", {
          header: "Avg Stake",
          cell: (info) => (
            <span className="mono">
              {info.getValue() > 0 ? formatCurrency(info.getValue(), "USD", 0) : "—"}
            </span>
          ),
        }),
        mapCol.accessor("dailyCommittedExposure", {
          header: "Daily Exposure",
          cell: (info) => (
            <span className="mono">{formatCurrency(info.getValue(), "USD", 0)}</span>
          ),
        }),
        mapCol.accessor("scheduleRealizedPnL", {
          header: "Schedule P&L",
          cell: (info) => (
            <span className="mono text-win">
              +{formatCurrency(Math.max(0, info.getValue()))}
            </span>
          ),
        }),
        mapCol.display({
          id: "actions",
          header: "",
          cell: (info) => (
            <div className="d-flex justify-content-end gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="sch-row-btn"
                onClick={() =>
                  openSchedulerModal({
                    type: "pool-prorata-wizard",
                    focusPackageCode: info.row.original.packageCode,
                  })
                }
              >
                Adjust Split
              </button>
            </div>
          ),
        }),
      ]),
    [openSchedulerModal],
  );

  const table = useDeskTable({
    data: bundle.packageMappings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <section className="sch-section" aria-label="Package to trade mapping">
      <div className="sch-panel">
        <div className="sch-panel__head">
          <div>
            <span className="eyebrow-label">
              Section 5 · Crowdfunding Capital Attribution Ledger
            </span>
            <h2 className="sch-panel__title">Package-to-Schedule Capital Mapping</h2>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openOverlay({ type: "new-package-wizard" })}
            >
              <Icon name="package" size={14} /> Launch New Pool
            </button>
            <button
              type="button"
              className="btn-brand"
              onClick={() => openSchedulerModal({ type: "pool-prorata-wizard" })}
            >
              <Icon name="split" size={14} /> Rebalance Allocations
            </button>
          </div>
        </div>

        <div className="px-3 py-3 border-bottom bg-light">
          <div className="d-flex justify-content-between small text-secondary mb-2">
            <span>Pro-Rata Investor Deposit Weight Across Active Trading Packages</span>
            <span className="mono">
              Total Active Pool Capital {formatCurrency(bundle.kpis.pooledCapitalCovered, "USD", 0)}
            </span>
          </div>
          <div className="sch-share-bar chart-draw">
            {bundle.packageMappings
              .filter((m) => m.capitalSharePercent > 0)
              .map((m, i) => (
                <span
                  key={m.packageCode}
                  className={`bar-${i}`}
                  style={{ width: `${m.capitalSharePercent}%` }}
                  title={`${m.packageCode}: ${m.capitalSharePercent}%`}
                />
              ))}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table desk-table mb-0">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(header.column.getCanSort() && "is-sortable")}
                    >
                      <table.FlexRender header={header} />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="sch-clickable-row"
                  onClick={() =>
                    inspectEntity({ kind: "package", code: row.original.packageCode })
                  }
                >
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
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 6 · 30-DAY SCHEDULE PERFORMANCE HISTORY (`@tanstack/react-table`)
   ═══════════════════════════════════════════════════════════════════════════ */
const histCol = createDeskColumnHelper<ScheduleHistoryRunDTO>();

export function SchedulePerformanceHistorySection({
  bundle,
}: {
  bundle: TradeSchedulerBundleDTO;
}) {
  const { openSchedulerModal, inspectEntity } = useOperatorUI();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "profit" | "loss">("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    if (outcomeFilter === "profit") return bundle.historyRuns.filter((r) => r.netPnL >= 0);
    if (outcomeFilter === "loss") return bundle.historyRuns.filter((r) => r.netPnL < 0);
    return bundle.historyRuns;
  }, [bundle.historyRuns, outcomeFilter]);

  const columns = useMemo(
    () =>
      histCol.columns([
        histCol.accessor("scheduleName", {
          header: "Schedule Name",
          cell: (info) => (
            <div>
              <span className="fw-semibold d-block">{info.getValue()}</span>
              <span className="sch-cell-sub mono">
                {info.row.original.scheduleCode} · {info.row.original.symbol} ·{" "}
                {info.row.original.strategy} · {info.row.original.packageCodes.join(", ")}
              </span>
            </div>
          ),
        }),
        histCol.accessor("runDateLabel", {
          header: "Last Run",
          cell: (info) => <span className="mono">{info.getValue()}</span>,
        }),
        histCol.accessor("tradesCount", {
          header: "Trades",
          cell: (info) => (
            <span className="mono">
              {info.getValue()} ({info.row.original.winsCount}W/{info.row.original.lossesCount}L)
            </span>
          ),
        }),
        histCol.accessor("winRatePercent", {
          header: "Win Rate",
          cell: (info) => <span className="mono fw-semibold">{info.getValue()}%</span>,
        }),
        histCol.accessor("netPnL", {
          header: "Net P&L",
          cell: (info) => {
            const v = info.getValue();
            return (
              <span className={cn("mono fw-semibold", v >= 0 ? "text-win" : "text-loss")}>
                {v >= 0 ? `+${formatCurrency(v)}` : formatCurrency(v)}
              </span>
            );
          },
        }),
        histCol.accessor("roiPercent", {
          header: "Window ROI",
          cell: (info) => {
            const v = info.getValue();
            return (
              <span className={cn("mono", v >= 0 ? "text-win" : "text-loss")}>
                {v >= 0 ? `+${v}%` : `${v}%`}
              </span>
            );
          },
        }),
        histCol.display({
          id: "drilldown",
          header: "Audit",
          cell: (info) => (
            <div className="d-flex justify-content-end gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="sch-row-btn"
                onClick={() =>
                  openSchedulerModal({
                    type: "history-run-drilldown",
                    runId: info.row.original.id,
                  })
                }
              >
                Contracts
              </button>
              <Link
                href={`/dashboard/trades?schedule=${info.row.original.scheduleCode}`}
                className="sch-row-btn text-decoration-none"
              >
                Trade Log →
              </Link>
            </div>
          ),
        }),
      ]),
    [openSchedulerModal],
  );

  const table = useDeskTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
  });

  const labels = ["Schedule Name", "Last Run", "Trades", "Win Rate", "P&L", "ROI", "Audit"];

  return (
    <section className="sch-section" aria-label="Schedule performance history">
      <div className="sch-panel">
        <div className="sch-panel__head">
          <div>
            <span className="eyebrow-label">
              Section 6 · Past 30 Days Completed Windows (TanStack Table)
            </span>
            <h2 className="sch-panel__title">Schedule Performance History &amp; Attribution</h2>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <input
              className="form-control form-control-sm"
              style={{ width: 210 }}
              placeholder="Filter history by symbol/name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="sch-seg">
              {(
                [
                  ["all", "All Runs"],
                  ["profit", "Net Positive"],
                  ["loss", "Stop-Loss Guard"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={cn("sch-seg__btn", outcomeFilter === k && "is-active")}
                  onClick={() => setOutcomeFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => openSchedulerModal({ type: "backtest-stress-wizard" })}
            >
              <Icon name="gauge" size={14} /> Stress Simulator
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table desk-table sch-responsive-table mb-0">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(header.column.getCanSort() && "is-sortable")}
                    >
                      <span className="d-inline-flex align-items-center gap-1">
                        <table.FlexRender header={header} />
                        {header.column.getIsSorted() === "asc"
                          ? "↑"
                          : header.column.getIsSorted() === "desc"
                            ? "↓"
                            : null}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="sch-clickable-row"
                  onClick={() => inspectEntity({ kind: "history-run", runId: row.original.id })}
                >
                  {row.getAllCells().map((cell, cIdx) => (
                    <td key={cell.id} data-label={labels[cIdx] ?? ""}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sch-panel__foot mono small">
          <span>
            30-Day Realized Net:{" "}
            <strong className="text-win">
              +{formatCurrency(bundle.kpis.thirtyDayNetPnL)}
            </strong>{" "}
            across {bundle.kpis.thirtyDayRunsCount} completed runs ({bundle.kpis.thirtyDayWinRate}%
            win rate)
          </span>
          <Link href="/dashboard/trades" className="fw-semibold">
            View Full Settled Trade Blotter (D-4) →
          </Link>
        </div>
      </div>
    </section>
  );
}
