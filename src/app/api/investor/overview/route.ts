import { NextResponse } from "next/server";
import { z } from "zod";

import { getInvestorOverview } from "@/server/services/investor-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "summary",
  "active-pools",
  "earnings",
  "upcoming",
  "activity",
  "portfolio",
  "wallet",
  "notifications",
  "trades",
] as const;
const schema = z
  .object({ section: z.enum(sections).default("workspace") })
  .strict();

/** Strict read-only overview projections. Writes remain explicit backend integrations. */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (new Set(params.keys()).size !== Array.from(params.keys()).length)
    return json({ error: "Duplicate query parameters are not accepted" }, 400);
  const parsed = schema.safeParse(Object.fromEntries(params));
  if (!parsed.success)
    return json({ error: parsed.error.issues[0].message }, 400);
  const workspace = getInvestorOverview();
  const section = parsed.data.section;
  if (section === "workspace") return json(workspace);
  if (section === "active-pools") return json(workspace.activePools);
  return json(workspace[section === "portfolio" ? "portfolio" : section]);
}
