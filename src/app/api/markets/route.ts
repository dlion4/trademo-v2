import { NextResponse } from "next/server";
import { z } from "zod";
import { getMarketsBundle } from "@/server/services/markets-service";
import {
  groups,
  marketSession,
  performance,
  tickStats,
} from "@/lib/markets/model";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const p = z
    .object({
      section: z
        .enum([
          "workspace",
          "symbols",
          "ticks",
          "schedule",
          "assignments",
          "performance",
        ])
        .default("symbols"),
      symbol: z.string().optional(),
      group: z.enum(groups).optional(),
      search: z.string().max(100).default(""),
    })
    .strict()
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const json = (v: unknown, status = 200) =>
    NextResponse.json(v, { status, headers: { "Cache-Control": "no-store" } });
  if (!p.success) return json({ error: p.error.issues[0].message }, 400);
  const s = getMarketsBundle(),
    q = p.data;
  if (q.section === "workspace") return json(s);
  if (q.section === "performance") return json(performance(s));
  if (q.section === "assignments") return json(s.pools);
  if (q.section === "schedule")
    return json(
      s.symbols.map((symbol) => ({
        symbol: symbol.code,
        ...marketSession(symbol, s.asOf),
      })),
    );
  if (q.section === "ticks") {
    const symbol = s.symbols.find((x) => x.code === q.symbol);
    return symbol
      ? json({
          mode: s.mode,
          asOf: s.asOf,
          symbol: symbol.code,
          ticks: symbol.ticks,
          stats: tickStats(symbol),
        })
      : json({ error: "Symbol not found" }, 404);
  }
  return json({
    mode: s.mode,
    asOf: s.asOf,
    items: s.symbols.filter(
      (x) =>
        (!q.group || x.group === q.group) &&
        `${x.code} ${x.name}`.toLowerCase().includes(q.search.toLowerCase()),
    ),
  });
}
