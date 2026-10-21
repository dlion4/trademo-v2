"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import type { LastTradesFeedDTO, TradeRecordDTO } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";

const col = createDeskColumnHelper<TradeRecordDTO>();

/**
 * Section 2 · Settled Trades Blotter built on TanStack Table v9.
 * Supports sorting, search filtering, Last-5 / Show-10 toggle, row flash,
 * Right-Drawer telemetry inspection on click, and mobile card collapse (< md).
 */
export function LastTradesTableCard({ feed }: { feed: LastTradesFeedDTO }) {
  const { openOverlay, inspectEntity, flashTradeId } = useOperatorUI();
  const [showCount, setShowCount] = useState<5 | 10>(5);
  const [outcome, setOutcome] = useState<"all" | "win" | "loss">("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const filteredByOutcome = useMemo(() => {
    const base = feed.trades.slice(0, showCount);
    if (outcome === "win") return base.filter((t) => t.isWin);
    if (outcome === "loss") return base.filter((t) => !t.isWin);
    return base;
  }, [feed.trades, showCount, outcome]);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("tradeNumber", {
        header: "#",
        cell: (info) => <span className="mono fw-semibold">#{info.getValue()}</span>,
      }),
      col.accessor("symbol", {
        header: "Symbol",
        cell: (info) => (
          <div>
            <span className="mono fw-semibold d-block">{info.getValue()}</span>
            <span className="cc-cell-sub">{info.row.original.strategy}</span>
          </div>
        ),
      }),
      col.accessor("contractLabel", {
        header: "Contract",
        cell: (info) => <span className="mono">{info.getValue()}</span>,
      }),
      col.accessor("packageCode", {
        header: "Pool",
        cell: (info) => <span className="desk-code-tag mono">{info.getValue()}</span>,
      }),
      col.accessor("stake", {
        header: "Stake",
        cell: (info) => <span className="mono">{formatCurrency(info.getValue(), "USD", 0)}</span>,
      }),
      col.accessor("profit", {
        header: "P&L",
        cell: (info) => {
          const val = info.getValue();
          return (
            <span className={cn("mono fw-semibold", val >= 0 ? "text-win" : "text-loss")}>
              {val >= 0 ? "+" : ""}
              {formatCurrency(val, "USD", 0)}
            </span>
          );
        },
      }),
      col.accessor("executedAt", {
        header: "Time",
        cell: (info) => <span className="mono text-secondary">{info.getValue()}</span>,
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="d-flex justify-content-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="cc-row-btn"
              title="Open settlement receipt"
              onClick={() => openOverlay({ type: "trade-detail", tradeId: info.row.original.id })}
            >
              Receipt
            </button>
          </div>
        ),
      }),
    ]),
    [openOverlay],
  );

  const table = useDeskTable({
    data: filteredByOutcome,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
  });

  const columnLabels = ["#", "Symbol", "Contract", "Pool", "Stake", "P&L", "Time", "Receipt"];

  return (
    <div className="cc-panel h-100 d-flex flex-column">
      <div className="cc-panel__head">
        <div>
          <span className="eyebrow-label">Section 2 · Execution Blotter (TanStack Table)</span>
          <h2 className="cc-panel__title">Last {showCount} Settled Trades</h2>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="cc-seg">
            {(
              [
                ["all", "All"],
                ["win", "Wins"],
                ["loss", "Losses"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={cn("cc-seg__btn", outcome === k && "is-active")}
                onClick={() => setOutcome(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost btn-ghost--sm"
            onClick={() => setShowCount((c) => (c === 5 ? 10 : 5))}
          >
            {showCount === 5 ? "Show 10" : "Last 5"}
          </button>
          <button
            type="button"
            className="btn-brand py-1 px-2 small"
            onClick={() => openOverlay({ type: "quick-trade" })}
          >
            <Icon name="plus" size={14} /> Trade
          </button>
        </div>
      </div>

      <div className="px-3 pt-2 pb-2 border-bottom">
        <input
          className="form-control form-control-sm"
          placeholder="Filter blotter by symbol (R_10, R_75, R_100), pool (PKG-01), or strategy…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      </div>

      <div className="table-responsive flex-grow-1">
        <table className="table desk-table cc-responsive-table mb-0">
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
            {table.getRowModel().rows.map((row, idx) => {
              const flashed = flashTradeId === row.original.id;
              return (
                <tr
                  key={row.id}
                  onClick={() => inspectEntity({ kind: "trade", id: row.original.id })}
                  style={{ animationDelay: `${Math.min(idx, 8) * 60}ms` }}
                  className={cn(
                    "cc-clickable-row cc-stagger-row",
                    flashed && (row.original.isWin ? "row-flash-win" : "row-flash-loss"),
                  )}
                >
                  {row.getAllCells().map((cell, cIdx) => (
                    <td key={cell.id} data-label={columnLabels[cIdx] ?? ""}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cc-blotter-foot">
        <div className="d-flex flex-wrap align-items-center gap-3 mono small">
          <span>
            Session (Last 5):{" "}
            <strong className={feed.sessionSummary.pnl >= 0 ? "text-win" : "text-loss"}>
              {feed.sessionSummary.pnl >= 0 ? "+" : ""}
              {formatCurrency(feed.sessionSummary.pnl)}
            </strong>
          </span>
          <span>·</span>
          <span>
            Win:{" "}
            <strong>
              {feed.sessionSummary.winCount}/{feed.sessionSummary.totalCount}
            </strong>{" "}
            ({feed.sessionSummary.winRatePercent}%)
          </span>
          <span className="d-none d-sm-inline">·</span>
          <span className="d-none d-sm-inline text-secondary">
            Click any row to open Right Drawer telemetry
          </span>
        </div>
        <Link href="/dashboard/trades" className="small fw-semibold">
          Full Trade Log →
        </Link>
      </div>
    </div>
  );
}
