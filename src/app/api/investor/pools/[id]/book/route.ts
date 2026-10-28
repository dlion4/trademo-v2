import { NextResponse } from "next/server";
import { z } from "zod";

import { getPoolBookingWorkspace } from "@/server/services/investor-pool-booking-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "pool",
  "profile",
  "existing",
  "methods",
  "escrow",
  "terms",
  "records",
  "history",
  "savedMethods",
] as const;

const schema = z
  .object({ section: z.enum(sections).default("workspace") })
  .strict();

/**
 * Read-only projection for the I-4 booking page. Creating a reservation
 * (`POST /api/investments`) and cancelling one (`DELETE /api/investments/:id`)
 * stay explicit backend integrations: this route has no write handler, so
 * mutations return 405 and every booking on the page is a local preview.
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

    const workspace = getPoolBookingWorkspace(id);
    if (!workspace) return json({ error: "Pool not found" }, 404);

    const section = parsed.data.section;
    if (section === "workspace") return json(workspace);
    return json(workspace[section]);
  });
}
