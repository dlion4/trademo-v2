import { handle, readJson } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";
import { changeEmailSchema } from "@/lib/auth/schemas";

export const dynamic = "force-dynamic";

/** POST /api/auth/verify-email/resend — A-6 resend / change email */
export async function POST(request: Request) {
  return handle(async () => auth.resendVerification((await readJson(request, changeEmailSchema)).email));
}
