import { handle } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";

export const dynamic = "force-dynamic";

/** GET /api/auth/verify-email?token= — A-6 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return handle(() => auth.verifyEmail(token));
}
