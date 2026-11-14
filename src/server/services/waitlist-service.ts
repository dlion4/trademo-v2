import { mockDatabase } from "@/db";
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

  const { record, inserted } = mockDatabase.waitlist.add({
    email,
    role,
    source,
    note: input.note?.slice(0, 280),
  });
  const position = mockDatabase.waitlist.count();

  return {
    id: inserted ? record.id : "already-registered",
    email,
    role,
    position,
    message:
      inserted
        ? "You're on the demo waitlist. This entry is stored in memory only."
        : "This email is already on the demo waitlist.",
  };
}
