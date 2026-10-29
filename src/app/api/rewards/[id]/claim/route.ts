import { NextResponse } from "next/server";

import { claimDraftError, money } from "@/lib/investor/referrals";
import {
  applyReferralMutation,
  getReferralWorkspace,
} from "@/server/services/investor-referrals-service";

export const dynamic = "force-dynamic";

/**
 * `POST /api/rewards/:id/claim` — the write behind `useClaimReward()`.
 *
 * The rule lives in `claimDraftError()`, so the button, the wizard and this
 * route all reject the same way: locked, already claimed, not yet unlocked or
 * expired. A successful claim appends a credit to the queue and a row to the
 * statement, then answers with the whole workspace.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

  const { id } = await context.params;
  const workspace = getReferralWorkspace();
  const reward = workspace.rewards.find((row) => row.id === id) ?? null;

  if (!reward) return json({ error: `No reward with id ${id}` }, 404);

  const error = claimDraftError(reward, workspace.asOf);
  if (error) return json({ error }, 409);

  try {
    const next = applyReferralMutation({ kind: "claimReward", id });
    return json({
      ok: true,
      claimed: { id: reward.id, amount: reward.amount, title: reward.title },
      message: `${money(reward.amount, 2)} queued for the next settlement batch`,
      workspace: next,
    });
  } catch (caught) {
    return json(
      { error: caught instanceof Error ? caught.message : "Command rejected" },
      409,
    );
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const workspace = getReferralWorkspace();
  const { id } = await context.params;
  const reward = workspace.rewards.find((row) => row.id === id) ?? null;
  if (!reward) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    { reward, error: claimDraftError(reward, workspace.asOf) || null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
