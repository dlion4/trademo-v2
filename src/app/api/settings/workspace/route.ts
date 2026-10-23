import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsWorkspace } from "@/server/services/settings-service";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const p = z
    .object({
      section: z
        .enum([
          "workspace",
          "profile",
          "connections",
          "platform",
          "security",
          "notifications",
          "integrations",
          "billing",
          "api-access",
        ])
        .default("workspace"),
    })
    .strict()
    .safeParse(Object.fromEntries(params));
  const json = (v: unknown, status = 200) =>
    NextResponse.json(v, { status, headers: { "Cache-Control": "no-store" } });
  if (new Set(params.keys()).size !== Array.from(params.keys()).length)
    return json({ error: "Duplicate query parameters are not accepted" }, 400);
  if (!p.success) return json({ error: p.error.issues[0].message }, 400);
  const s = getSettingsWorkspace(),
    section = p.data.section;
  if (section === "workspace") return json(s);
  if (section === "api-access")
    return json({ keys: s.apiKeys, integrations: s.integrations });
  return json(s[section]);
}
