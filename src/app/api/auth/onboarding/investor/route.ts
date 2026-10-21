import { handle } from "@/server/http/auth-route";
import { INVESTOR_ONBOARDING_CONTENT } from "@/lib/content/auth-content";

export const dynamic = "force-dynamic";

/** GET /api/auth/onboarding/investor — A-3 content */
export async function GET() {
  return handle(() => INVESTOR_ONBOARDING_CONTENT);
}
