import { NextResponse } from "next/server";
import { z } from "zod";

import {
  REFERRAL_SECTIONS,
  referralCommandSchema,
  referralSection,
  type ReferralSectionKey,
  type ReferralWorkspace,
} from "@/lib/investor/referrals";
import {
  applyReferralMutation,
  getReferralWorkspace,
} from "@/server/services/investor-referrals-service";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    section: z.enum(REFERRAL_SECTIONS as [ReferralSectionKey, ...ReferralSectionKey[]]).default("workspace"),
    page: z.coerce.number().int().min(1).max(25).optional(),
    period: z.enum(["month", "quarter", "all"]).optional(),
  })
  .strict();

/**
 * Read + write projection for the I-10 referrals desk.
 *
 * Every figure is derived in `src/lib/investor/referrals.ts`, so this route is a
 * thin adapter: the five spec query keys map one-to-one onto `section` values,
 * and a backend can serve them from persisted rows without touching the page.
 *
 * Writes are validated by the shared command union and answered with the new
 * workspace snapshot. The demo store lives in the service module, so a claim
 * made in the browser is visible to the next read — the same contract a real
 * `POST /api/rewards/:id/claim` would honour.
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
  const workspace = getReferralWorkspace();

  if (query.section === "workspace") {
    return json({ ...workspace, generatedAt: workspace.asOf });
  }

  return json(
    referralSection(workspace, query.section, {
      page: query.page,
      period: query.period,
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

  const parsed = referralCommandSchema.safeParse(body);
  if (!parsed.success)
    return json({ error: "Invalid command", issues: parsed.error.issues }, 400);

  try {
    const workspace: ReferralWorkspace = applyReferralMutation(parsed.data);
    return json({
      ok: true,
      workspace,
      message: `${parsed.data.kind} applied · revision ${workspace.revision}`,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Command rejected" },
      409,
    );
  }
}
