import { handle, readJson } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";
import { signupSchema } from "@/lib/auth/schemas";

export const dynamic = "force-dynamic";

/** POST /api/auth/register — A-1 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request, signupSchema);
    return auth.register({ ...body, role: body.role as "operator" | "investor" });
  }, 201);
}
