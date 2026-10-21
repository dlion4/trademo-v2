import { count } from "drizzle-orm";

import { db } from "@/db";
import { waitlistSignups } from "@/db/schema";
import type { WaitlistSignupRequestDTO, WaitlistSignupResponseDTO } from "@/lib/api/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class WaitlistValidationError extends Error {}

export async function joinWaitlist(
  input: WaitlistSignupRequestDTO,
): Promise<WaitlistSignupResponseDTO> {
  const email = input.email?.trim().toLowerCase() ?? "";

  if (!EMAIL_PATTERN.test(email)) {
    throw new WaitlistValidationError("Enter a valid email address.");
  }

  const role = input.role === "operator" ? "operator" : "investor";
  const source = input.source?.slice(0, 64) || "landing-cta";

  const inserted = await db
    .insert(waitlistSignups)
    .values({ email, role, source, note: input.note?.slice(0, 280) })
    .onConflictDoNothing({ target: waitlistSignups.email })
    .returning({ id: waitlistSignups.id });

  const [totals] = await db.select({ value: count() }).from(waitlistSignups);
  const position = Number(totals?.value ?? 1);

  return {
    id: inserted[0]?.id ?? "already-registered",
    email,
    role,
    position,
    message:
      inserted.length > 0
        ? "You're on the list. Watch your inbox for the early-access brief."
        : "You're already on the list — we'll be in touch shortly.",
  };
}
