import { handle } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";

export const dynamic = "force-dynamic";

/** GET /api/auth/deriv/authorize — builds the Deriv OAuth URL + CSRF state */
export async function GET() {
  return handle(() => auth.derivAuthorizeUrl());
}
