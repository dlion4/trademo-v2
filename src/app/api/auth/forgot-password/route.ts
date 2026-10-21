import { handle, readJson } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";
import { forgotPasswordSchema } from "@/lib/auth/schemas";

export const dynamic = "force-dynamic";

/** POST /api/auth/forgot-password — A-4 (always 200 to prevent enumeration) */
export async function POST(request: Request) {
  return handle(async () => {
    await readJson(request, forgotPasswordSchema);
    return auth.forgotPassword();
  });
}
