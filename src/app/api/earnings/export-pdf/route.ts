import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EARNINGS_PERIODS,
  earningsCommandSchema,
  exportFileStem,
  exportMatrix,
  type EarningsPeriod,
} from "@/lib/investor/earnings";
import { applyEarningsMutation } from "@/server/services/investor-earnings-service";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    scope: z
      .enum(["overview", "by-pool", "timeline", "tax", "fees", "payouts"])
      .default("overview"),
    period: z.enum(EARNINGS_PERIODS as [EarningsPeriod, ...EarningsPeriod[]]).default("14d"),
  })
  .strict();

/**
 * `useExportPDF()` → POST /api/earnings/export-pdf
 *
 * The demo returns the print-ready matrix the page lays out as a PDF; a real
 * backend would stream a rendered file with the same reference and byte count.
 */
export function POST(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

  return Promise.resolve(request.json().catch(() => ({}))).then((body) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return json({ error: "Invalid export request", issues: parsed.error.issues }, 400);

    let workspace;
    try {
      workspace = applyEarningsMutation(
        earningsCommandSchema.parse({
          kind: "exportReport",
          scope: parsed.data.scope,
          format: "pdf",
          period: parsed.data.period,
        }),
      );
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Command rejected" }, 409);
    }

    const matrix = exportMatrix(workspace, parsed.data.scope, parsed.data.period);
    return json({
      ok: true,
      workspace,
      format: "pdf",
      filename: `${exportFileStem(workspace, parsed.data.scope)}.pdf`,
      matrix,
      rows: matrix.rows.length,
      pages: Math.max(1, Math.ceil(matrix.rows.length / 14)),
      generatedAt: workspace.asOf,
    });
  });
}
