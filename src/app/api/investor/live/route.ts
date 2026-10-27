import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deriveTotals,
  filterFeed,
  recomputeStats,
} from "@/lib/investor/live-trades";
import { getLiveTradeWorkspace } from "@/server/services/investor-live-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "totals",
  "feed",
  "ticks",
  "stats",
  "bots",
  "alerts",
  "pools",
  "profile",
  "stream",
] as const;

const schema = z
  .object({
    section: z.enum(sections).default("workspace"),
    pool: z.string().max(40).optional(),
    result: z.enum(["win", "loss"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

/**
 * Read-only projection for the I-5 live tracker. There is deliberately no
 * write handler: pausing a bot, acknowledging a Guardian alert, saving feed
 * preferences and exporting a report are all local previews, so mutations are
 * rejected with 405 and the socket is never opened from the server.
 *
 * Query keys the page uses, mirrored here for a future backend:
 *   ?section=feed&pool=PKG-01&result=win&limit=50
 *   ?section=totals | ticks | stats | bots | alerts
 */
export function GET(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });

  const query = new URL(request.url).searchParams;
  const keys = Array.from(query.keys());
  if (new Set(keys).size !== keys.length)
    return json({ error: "Duplicate query parameters are not accepted" }, 400);

  const parsed = schema.safeParse(Object.fromEntries(query));
  if (!parsed.success)
    return json({ error: parsed.error.issues[0].message }, 400);

  const workspace = getLiveTradeWorkspace();
  const { section, pool, result, limit } = parsed.data;

  if (section === "workspace") return json(workspace);

  if (section === "feed") {
    const filters = {
      ...workspace.filters,
      pools: pool ? [pool] : workspace.filters.pools,
      results: result ? [result] : workspace.filters.results,
    };
    return json(filterFeed(workspace.feed, filters).slice(0, limit ?? 50));
  }

  if (section === "totals")
    return json(
      deriveTotals(
        workspace.pools,
        workspace.feed,
        workspace.bots,
        workspace.alerts,
      ),
    );

  if (section === "stats")
    return json(recomputeStats(workspace.feed, workspace.pools));

  return json(workspace[section]);
}
