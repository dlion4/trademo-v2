import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EARNINGS_PERIODS,
  earningsCommandSchema,
  earningsSection,
  type EarningsPeriod,
  type EarningsSectionKey,
  type EarningsWorkspace,
} from "@/lib/investor/earnings";
import {
  applyEarningsMutation,
  getEarningsWorkspace,
} from "@/server/services/investor-earnings-service";

export const dynamic = "force-dynamic";

const sections: EarningsSectionKey[] = [
  "workspace",
  "overview",
  "by-pool",
  "timeline",
  "tax-report",
  "formula",
  "library",
];

const schema = z
  .object({
    section: z.enum(sections as [EarningsSectionKey, ...EarningsSectionKey[]]).default("workspace"),
    period: z.enum(EARNINGS_PERIODS as [EarningsPeriod, ...EarningsPeriod[]]).optional(),
    year: z.coerce.number().int().min(2024).max(2026).optional(),
  })
  .strict();

/**
 * Read + write projection for the I-11 earnings desk.
 *
 * The spec's four query keys map onto `section` values:
 *   ["earnings","overview"]                  → ?section=overview
 *   ["earnings","by-pool"]                   → ?section=by-pool
 *   ["earnings","timeline",{period}]         → ?section=timeline&period=14d
 *   ["earnings","tax-report",{year}]         → ?section=tax-report&year=2026
 *
 * Every figure is derived in `src/lib/investor/earnings.ts` from the I-6
 * position book, so a backend can serve the same slices from persisted rows.
 * Writes are validated by one command union and answered with the new snapshot.
 */
export function GET(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

  const url = new URL(request.url);
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key)) return json({ error: `Duplicate query parameter: ${key}` }, 400);
    seen.add(key);
  }

  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: "Invalid query", issues: parsed.error.issues }, 400);

  const query = parsed.data;
  const workspace = getEarningsWorkspace();

  if (query.section === "workspace") {
    return json({ ...workspace, generatedAt: workspace.asOf });
  }

  return json(
    earningsSection(workspace, query.section, {
      period: query.period,
      year: query.year,
    }),
  );
}

export async function POST(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected a JSON command body" }, 400);
  }

  const parsed = earningsCommandSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid command", issues: parsed.error.issues }, 400);

  try {
    const workspace: EarningsWorkspace = applyEarningsMutation(parsed.data);
    return json({
      ok: true,
      workspace,
      message: `${parsed.data.kind} applied · revision ${workspace.revision}`,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Command rejected" }, 409);
  }
}
