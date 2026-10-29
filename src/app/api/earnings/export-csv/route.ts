import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EARNINGS_PERIODS,
  csvOf,
  earningsCommandSchema,
  exportFileStem,
  exportMatrix,
  type EarningsPeriod,
} from "@/lib/investor/earnings";
import {
  applyEarningsMutation,
  getEarningsWorkspace,
} from "@/server/services/investor-earnings-service";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    scope: z
      .enum(["overview", "by-pool", "timeline", "tax", "fees", "payouts"])
      .default("overview"),
    period: z.enum(EARNINGS_PERIODS as [EarningsPeriod, ...EarningsPeriod[]]).default("14d"),
  })
  .strict();

/** `useExportCSV()` → POST /api/earnings/export-csv */
export async function POST(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid export request", issues: parsed.error.issues }, 400);

  const command = earningsCommandSchema.parse({
    kind: "exportReport",
    scope: parsed.data.scope,
    format: "csv",
    period: parsed.data.period,
  });

  const workspace = applyEarningsMutation(command);
  const matrix = exportMatrix(workspace, parsed.data.scope, parsed.data.period);

  return json({
    ok: true,
    workspace,
    format: "csv",
    filename: `${exportFileStem(workspace, parsed.data.scope)}.csv`,
    matrix,
    csv: csvOf(matrix),
    rows: matrix.rows.length,
  });
}
