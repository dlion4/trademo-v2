import { NextResponse } from "next/server";
import { z } from "zod";

import { getPoolDetailWorkspace } from "@/server/services/investor-pool-detail-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "overview",
  "investment",
  "performance",
  "guardian",
  "participants",
  "trades",
  "schedule",
  "documents",
  "events",
] as const;

const schema = z
  .object({ section: z.enum(sections).default("workspace") })
  .strict();

/**
 * Read-only projection for the I-3 pool detail page. Booking, payout, reminder,
 * interest and preference commands stay explicit backend integrations: this
 * route has no write handler, so mutation attempts return 405.
 */
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });

  return params.then(({ id }) => {
    const query = new URL(request.url).searchParams;
    const keys = Array.from(query.keys());
    if (new Set(keys).size !== keys.length)
      return json(
        { error: "Duplicate query parameters are not accepted" },
        400,
      );

    const parsed = schema.safeParse(Object.fromEntries(query));
    if (!parsed.success)
      return json({ error: parsed.error.issues[0].message }, 400);

    const workspace = getPoolDetailWorkspace(id);
    if (!workspace) return json({ error: "Pool not found" }, 404);

    const section = parsed.data.section;
    if (section === "workspace") return json(workspace);
    return json(workspace[section]);
  });
}
