import { NextResponse } from "next/server";
import { z } from "zod";

import { getPoolsWorkspace } from "@/server/services/investor-pools-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "summary",
  "trading",
  "open",
  "upcoming",
  "completed",
  "roadmap",
  "trades",
  "reminders",
] as const;

const schema = z
  .object({ section: z.enum(sections).default("workspace") })
  .strict();

/**
 * Strict read-only projections for the I-2 pool browser. Booking, reminder,
 * interest and payout commands stay explicit backend integrations: this route
 * has no write handler, so mutation attempts return 405.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });

  const keys = Array.from(params.keys());
  if (new Set(keys).size !== keys.length)
    return json({ error: "Duplicate query parameters are not accepted" }, 400);

  const parsed = schema.safeParse(Object.fromEntries(params));
  if (!parsed.success)
    return json({ error: parsed.error.issues[0].message }, 400);

  const workspace = getPoolsWorkspace();
  const section = parsed.data.section;
  if (section === "workspace") return json(workspace);
  return json(workspace[section]);
}
