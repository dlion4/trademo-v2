import { NextResponse } from "next/server";

import { money, streakClaimError } from "@/lib/investor/referrals";
import {
  applyReferralMutation,
  getReferralWorkspace,
} from "@/server/services/investor-referrals-service";

export const dynamic = "force-dynamic";

/**
 * `POST /api/referrals/claim-daily` — the write behind `useClaimDailyBonus()`.
 *
 * The daily $2 only lands once the seven-day floor is cleared, the account has
 * been active today and today has not been claimed. Those three rules live in
 * `streakClaimError()` so the button state and the route cannot disagree.
 */
export function POST() {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

  const workspace = getReferralWorkspace();
  const error = streakClaimError(workspace.streak, workspace.asOf);
  if (error) return json({ error }, 409);

  try {
    const next = applyReferralMutation({ kind: "claimDaily" });
    return json({
      ok: true,
      message: `${money(workspace.streak.bonusPerDay, 2)} claimed · streak day ${workspace.streak.current}`,
      workspace: next,
    });
  } catch (caught) {
    return json({ error: caught instanceof Error ? caught.message : "Command rejected" }, 409);
  }
}

export function GET() {
  const workspace = getReferralWorkspace();
  return NextResponse.json(
    {
      streak: workspace.streak,
      error: streakClaimError(workspace.streak, workspace.asOf) || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
