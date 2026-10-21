import { handle } from "@/server/http/auth-route";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout */
export async function POST() {
  return handle(() => ({ ok: true }));
}
