import { apiFetch } from "@/lib/api/http";
import type { LedgerBundle, LedgerRequest } from "./types";
export function ledgerUrl(request: LedgerRequest, exportAll = false) {
  const params = new URLSearchParams({ page: String(request.page), pageSize: String(request.pageSize), sort: request.sort, desc: String(request.desc), ...request.filters });
  if (exportAll) params.set("export", "true");
  return `/api/trade-log?${params}`;
}
export const fetchLedger = (request: LedgerRequest, exportAll = false) => apiFetch<LedgerBundle>(ledgerUrl(request, exportAll));
