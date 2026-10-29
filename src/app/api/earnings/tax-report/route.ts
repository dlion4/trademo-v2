import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FISCAL_YEAR,
  csvOf,
  earningsCommandSchema,
  exportMatrix,
} from "@/lib/investor/earnings";
import { applyEarningsMutation } from "@/server/services/investor-earnings-service";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    format: z.enum(["pdf", "csv"]).default("pdf"),
    year: z.number().int().min(2024).max(FISCAL_YEAR).default(FISCAL_YEAR),
  })
  .strict();

/** `useDownloadTaxReport()` → POST /api/earnings/tax-report */
export function POST(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

  return Promise.resolve(request.json().catch(() => ({}))).then((body) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return json({ error: "Invalid tax report request", issues: parsed.error.issues }, 400);

    let workspace;
    try {
      workspace = applyEarningsMutation(
        earningsCommandSchema.parse({
          kind: "downloadTax",
          format: parsed.data.format,
          year: parsed.data.year,
        }),
      );
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Command rejected" },
        409,
      );
    }

    const matrix = exportMatrix(workspace, "tax");
    return json({
      ok: true,
      workspace,
      format: parsed.data.format,
      year: parsed.data.year,
      reference: workspace.tax.documents[0]?.reference ?? workspace.tax.reference,
      filename: `trademo-tax-${parsed.data.year}-${parsed.data.format}.${parsed.data.format}`,
      matrix,
      csv: parsed.data.format === "csv" ? csvOf(matrix) : null,
      rows: matrix.rows.length,
    });
  });
}
