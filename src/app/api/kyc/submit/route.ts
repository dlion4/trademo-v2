import { handle, readJson } from "@/server/http/auth-route";
import * as auth from "@/server/services/auth-mock-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  idDocType: z.enum(["passport", "national_id", "drivers_license"]),
  idDocFrontUrl: z.string().min(1),
  idDocBackUrl: z.string().nullable(),
  selfieUrl: z.string().min(1),
  proofOfAddressUrl: z.string().min(1),
  sourceOfFundsDeclaration: z.enum(["employment", "business", "investment", "savings"]),
  enhancedDueDiligence: z.string().nullable(),
});

/** POST /api/kyc/submit — A-3 step 3 */
export async function POST(request: Request) {
  return handle(async () => {
    await readJson(request, schema);
    return auth.kycSubmit();
  }, 201);
}
