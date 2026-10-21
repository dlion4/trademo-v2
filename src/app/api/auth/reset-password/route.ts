import { handle, readJson } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";
import { resetPasswordSchema } from "@/lib/auth/schemas";

export const dynamic = "force-dynamic";

/** GET /api/auth/reset-password?token= — token pre-flight for A-5 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return handle(() => auth.checkResetToken(token));
}

/** POST /api/auth/reset-password — A-5 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request, resetPasswordSchema);
    return auth.resetPassword(body.token);
  });
}
