import { handle, readJson } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(6).max(8),
  method: z.enum(["authenticator", "backup_code"]),
});

/** POST /api/auth/2fa/verify — A-7 */
export async function POST(request: Request) {
  return handle(async () => auth.verifyTwoFactor(await readJson(request, schema)));
}
