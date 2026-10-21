import { handle, readJson } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().min(1), state: z.string().min(1), acct1: z.string().nullable() });

/** POST /api/auth/deriv/connect — A-8 code → token exchange */
export async function POST(request: Request) {
  return handle(async () => auth.derivConnect(await readJson(request, schema)));
}
