import { handle, readJson } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";
import { signinSchema } from "@/lib/auth/schemas";

export const dynamic = "force-dynamic";

/** POST /api/auth/login — A-2 (returns session OR 2FA challenge) */
export async function POST(request: Request) {
  return handle(async () => auth.login(await readJson(request, signinSchema)));
}
