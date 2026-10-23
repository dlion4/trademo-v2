import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultFilters, ledgerContracts, ledgerMarkets, ledgerPools, ledgerStrategies } from "@/lib/trade-log/types";
import { getLedgerBundle } from "@/server/services/trade-log-service";
export const dynamic = "force-dynamic";
const date = z.iso.date();
const schema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().refine(n => [25,50,100].includes(n)).default(50), sort: z.enum(["executedAt", "tradeNumber", "stake", "profit", "payout", "symbol", "packageCode", "botName", "isWin", "contractType"]).default("executedAt"), desc: z.enum(["true","false"]).default("true"), from: date.default(defaultFilters.from), to: date.default(defaultFilters.to), symbol: z.enum(["all", ...ledgerMarkets]).default("all"), pool: z.enum(["all", ...ledgerPools]).default("all"), contract: z.enum(["all", ...ledgerContracts]).default("all"), strategy: z.enum(["all", ...ledgerStrategies]).default("all"), result: z.enum(["all","win","loss"]).default("all"), schedule: z.string().max(80).default(""), search: z.string().max(120).default(""), export: z.enum(["true","false"]).default("false") });
export function GET(request: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ledger filters or pagination." }, { status: 400 });
  const { page, pageSize, sort, desc, export: all, ...filters } = parsed.data;
  if (filters.from > filters.to) return NextResponse.json({ error: "Start date must be on or before end date." }, { status: 400 });
  return NextResponse.json(getLedgerBundle({ page, pageSize, sort, desc: desc === "true", filters }, all === "true"));
}
