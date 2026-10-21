import { z } from "zod";

/**
 * tradeMO · Auth Zod schemas (tradeMO.md §5).
 * Shared between TanStack Form (client) and the route handlers (server), so the
 * real backend can import the exact same rules.
 */

export const passwordRule = z
  .string()
  .min(8, "Min 8 characters")
  .regex(/[A-Z]/, "Need 1 uppercase letter")
  .regex(/[0-9]/, "Need 1 number")
  .regex(/[^a-zA-Z0-9]/, "Need 1 symbol");

export const emailRule = z.string().trim().min(1, "Email is required").email("Invalid email");

/* ── A-1 Sign Up ── */
export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name too long"),
    email: emailRule,
    password: passwordRule,
    confirmPassword: z.string().min(1, "Confirm your password"),
    // Form starts with "" (no path picked yet) — refined to the strict enum.
    role: z
      .enum(["operator", "investor", ""])
      .refine((v) => v !== "", "Choose how you want to use tradeMO"),
    termsAccepted: z.boolean().refine((v) => v === true, "You must accept the Terms & Risk Disclosure"),
    referralCode: z
      .string()
      .refine((v) => !v || /^[a-z0-9]{8,12}$/i.test(v), "Invalid referral code format"),
    newsletterOptIn: z.boolean(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.input<typeof signupSchema>;

/* ── A-2 Sign In ── */
export const signinSchema = z.object({
  email: emailRule,
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

export type SigninFormValues = z.input<typeof signinSchema>;

/* ── A-4 Forgot password ── */
export const forgotPasswordSchema = z.object({ email: emailRule });
export type ForgotPasswordFormValues = z.input<typeof forgotPasswordSchema>;

/* ── A-5 Reset password ── */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "Reset token is malformed"),
    password: passwordRule,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.input<typeof resetPasswordSchema>;

/* ── A-6 Change email (verify page) ── */
export const changeEmailSchema = z.object({ email: emailRule });

/* ── A-7 Two-factor ── */
export const totpCodeSchema = z.string().regex(/^\d{6}$/, "Enter all 6 digits");
export const backupCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-7]{8}$/, "Backup codes are 8 characters (A–Z, 2–7)");

/* ── A-3 KYC ── */
export const kycSchema = z.object({
  idDocType: z.enum(["passport", "national_id", "drivers_license"]),
  idDocFrontUrl: z.string().min(1, "Upload the front of your document"),
  idDocBackUrl: z.string(),
  selfieUrl: z.string().min(1, "Capture or upload a selfie"),
  proofOfAddressUrl: z.string().min(1, "Upload a proof of address"),
  sourceOfFundsDeclaration: z.enum(["employment", "business", "investment", "savings", ""]).refine(
    (v) => v !== "",
    "Select your source of funds",
  ),
  attest: z.boolean().refine((v) => v === true, "Please confirm the declaration"),
});

export type KycFormValues = z.input<typeof kycSchema>;

/** Normalises TanStack Form / Standard Schema error entries into strings. */
export function errorText(errors: ReadonlyArray<unknown>): string | null {
  for (const error of errors) {
    if (!error) continue;
    if (typeof error === "string") return error;
    if (typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return null;
}
