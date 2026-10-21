import { handle, readJson } from "@/server/http/auth-route";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** POST /api/auth/2fa/resend — refresh challenge window (A-7) */
export async function POST(request: Request) {
  return handle(async () => {
    const { challengeId } = await readJson(request, z.object({ challengeId: z.string().min(1) }));
    return { challengeId, expiresInSeconds: 30 };
  });
}
