import { NextResponse } from "next/server";
import { z } from "zod";
import { getBotsWorkspace } from "@/server/services/bots-service";
import { botStats } from "@/lib/bots/model";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const p = z
    .object({
      section: z
        .enum([
          "workspace",
          "bots",
          "config",
          "trades",
          "performance",
          "guardian",
          "rules",
          "notifications",
          "scripts",
        ])
        .default("workspace"),
      id: z.string().optional(),
      page: z.coerce.number().int().min(1).max(1000).default(1),
    })
    .strict()
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const json = (v: unknown, status = 200) =>
    NextResponse.json(v, { status, headers: { "Cache-Control": "no-store" } });
  if (!p.success) return json({ error: p.error.issues[0].message }, 400);
  const s = getBotsWorkspace(),
    q = p.data;
  if (q.id && !s.bots.some((b) => b.id === q.id))
    return json({ error: "Bot not found" }, 404);
  if (["config", "trades"].includes(q.section) && !q.id)
    return json({ error: "A bot id is required" }, 400);
  switch (q.section) {
    case "bots":
      return json(s.bots);
    case "config":
      return json(s.bots.find((b) => b.id === q.id)!.config);
    case "trades": {
      const rows = s.receipts.filter((r) => r.botId === q.id);
      return json({
        items: rows.slice((q.page - 1) * 25, q.page * 25),
        page: q.page,
        total: rows.length,
        next: q.page * 25 < rows.length ? q.page + 1 : null,
      });
    }
    case "performance":
      return json(
        s.bots.map((b) => ({ id: b.id, name: b.name, ...botStats(s, b.id) })),
      );
    case "guardian":
      return json({ policy: s.guardian, triggers: s.triggers });
    case "rules":
      return json(s.rules);
    case "notifications":
      return json(s.notifications);
    case "scripts":
      return json(s.scripts);
    default:
      return json(s);
  }
}
