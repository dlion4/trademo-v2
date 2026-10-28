import { NextResponse } from "next/server";
import { z } from "zod";

import {
  feeBreakdown,
  historicalStats,
  compoundPlan,
  roiProjection,
  scenarioMatrix,
  type CalculatorWorkspace,
  type WalletMethodKind,
} from "@/lib/investor/calculator";
import { getCalculatorWorkspace } from "@/server/services/investor-calculator-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "roi",
  "compound",
  "fees",
  "scenarios",
  "historical",
  "pools",
  "presets",
  "preferences",
  "exports",
  "profile",
  "audit",
] as const;

const schema = z
  .object({
    section: z.enum(sections).default("workspace"),
    amount: z.coerce.number().min(0).max(1_000_000).optional(),
    roi: z.coerce.number().min(0).max(100).optional(),
    duration: z.coerce.number().int().min(1).max(365).optional(),
    pools: z.coerce.number().int().min(1).max(24).optional(),
    reinvest: z.enum(["true", "false"]).optional(),
    deposit: z.string().max(30).optional(),
    payout: z.string().max(40).optional(),
    waived: z.enum(["true", "false"]).optional(),
    poolId: z.string().max(40).optional(),
  })
  .strict();

/**
 * Read-only projection for the I-8 calculator.
 *
 * The maths lives in `src/lib/investor/calculator.ts`, so this route is a thin
 * adapter: a backend can serve the same shapes from persisted assumptions while
 * the page keeps its client-side live update. Writes answer 405 — saved
 * scenarios, presets and exports are a local, audited preview.
 *
 * Eventual writes: `POST /api/investor/calculator/scenarios`,
 * `DELETE /api/investor/calculator/scenarios/:id`,
 * `POST /api/investor/calculator/presets`,
 * `POST /api/investor/calculator/exports`.
 */
export function GET(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });

  const url = new URL(request.url);
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key))
      return json({ error: `Duplicate query parameter: ${key}` }, 400);
    seen.add(key);
  }

  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return json({ error: "Invalid query", issues: parsed.error.issues }, 400);

  const query = parsed.data;
  const workspace: CalculatorWorkspace = getCalculatorWorkspace();
  const amount = query.amount ?? workspace.defaults.amount;
  const roiPct = query.roi ?? workspace.defaults.roiPct;
  const durationDays = query.duration ?? workspace.defaults.durationDays;
  const slotPrice = workspace.slotPrice;

  switch (query.section) {
    case "roi":
      return json(
        roiProjection({
          amount,
          roiPct,
          durationDays,
          platformCutPct: workspace.platformCutPct,
          slotPrice,
        }),
      );
    case "compound":
      return json(
        compoundPlan({
          principal: amount,
          roiPct,
          pools: query.pools ?? workspace.preferences.compoundPools,
          platformCutPct: workspace.platformCutPct,
          reinvest:
            query.reinvest === undefined
              ? workspace.preferences.reinvest
              : query.reinvest === "true",
        }),
      );
    case "fees": {
      const rail =
        workspace.depositRails.find((row) => row.key === query.deposit) ??
        workspace.depositRails[0];
      const method =
        workspace.payoutMethods.find((row) => row.id === query.payout) ??
        workspace.payoutMethods[0];
      return json({
        rail,
        method,
        breakdown: feeBreakdown({
          amount,
          roiPct,
          platformCutPct: workspace.platformCutPct,
          depositFeePct: rail.feePct,
          depositFeeFlat: rail.feeFlat,
          payoutKind: method.kind as WalletMethodKind,
          payoutFeeWaived:
            query.waived === undefined
              ? workspace.preferences.payoutFeeWaived
              : query.waived === "true",
        }),
      });
    }
    case "scenarios": {
      const pool =
        workspace.pools.find((row) => row.id === query.poolId) ??
        workspace.pools.find((row) => row.id === workspace.defaultPoolId) ??
        workspace.pools[0];
      return json({
        pool,
        rows: scenarioMatrix({
          slotPrice: pool.slotPrice,
          platformCutPct: workspace.platformCutPct,
          bands: workspace.bands,
          slots: workspace.scenarioSlots,
        }),
      });
    }
    case "historical":
      return json({
        pools: workspace.historical,
        stats: historicalStats(workspace.historical),
      });
    case "pools":
      return json(workspace.pools);
    case "presets":
      return json(workspace.presets);
    case "preferences":
      return json(workspace.preferences);
    case "exports":
      return json(workspace.exports);
    case "profile":
      return json(workspace.profile);
    case "audit":
      return json(workspace.audit);
    default:
      return json(workspace);
  }
}
