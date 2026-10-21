/**
 * ─────────────────────────────────────────────────────────────────────────────
 * tradeMO · Auth data contracts (Pages A-1 → A-8)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every request / response shape below mirrors tradeMO.md §5 one-to-one.
 * The mock route handlers in `src/app/api/auth/*` return exactly these shapes,
 * so swapping in the real Express backend only means changing the base URL in
 * `src/lib/api/auth.ts` — components never touch transport details.
 */

/* ── Shared ─────────────────────────────────────────────────────────────── */

export type UserRole = "operator" | "investor" | "both";
export type PrimaryRole = Exclude<UserRole, "both">;

/** Canonical error body returned by every auth endpoint on non-2xx. */
export interface AuthErrorDTO {
  error: AuthErrorCode;
  message?: string;
  attemptsRemaining?: number;
  lockoutAt?: string | null;
  lockoutEndsAt?: string;
  retryAfterSeconds?: number;
  /** Field-level errors (server-side Zod), keyed by form field name. */
  fieldErrors?: Record<string, string>;
}

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_TOKEN"
  | "INVALID_2FA_CODE"
  | "2FA_LOCKED"
  | "CHALLENGE_EXPIRED"
  | "RATE_LIMITED"
  | DerivCallbackErrorCode
  | "UNKNOWN";

export interface AuthUserDTO {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  primaryRole: PrimaryRole;
  twoFactorEnabled: boolean;
  emailVerified?: boolean;
}

export interface AuthSessionDTO {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDTO;
  redirectTo: string | null;
}

/* ── A-1 Sign Up ─────────────────────────────────────────────────────────── */

export interface SignupRequestDTO {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: PrimaryRole;
  termsAccepted: true;
  referralCode?: string;
  newsletterOptIn: boolean;
}

export interface SignupResponseDTO {
  userId: string;
  email: string;
  role: PrimaryRole;
  emailVerified: boolean;
  redirectTo: string;
}

/* ── A-2 Sign In ─────────────────────────────────────────────────────────── */

export interface SigninRequestDTO {
  email: string;
  password: string;
  remember: boolean;
  twoFactorCode?: string;
}

export interface TwoFactorChallengeDTO {
  challengeId: string;
  channels: Array<"authenticator" | "sms" | "email">;
  backupAvailable: boolean;
  redirectTo: string;
}

/** Discriminated by presence of `challengeId`. */
export type SigninResponseDTO = AuthSessionDTO | TwoFactorChallengeDTO;

export function isTwoFactorChallenge(res: SigninResponseDTO): res is TwoFactorChallengeDTO {
  return "challengeId" in res;
}

/* ── A-3 Investor Onboarding ─────────────────────────────────────────────── */

export interface OnboardingStatDTO {
  key: string;
  label: string;
  value: number;
  format: "percent" | "currency" | "number";
  hint: string;
}

export interface PoolLifecycleStageDTO {
  key: "pool" | "trading" | "profit_sharing" | "payout";
  title: string;
  description: string;
  duration: string;
}

export interface SampleEarningsDTO {
  packageCode: string;
  investment: number;
  slots: number;
  poolRoiPercent: number;
  tradingDays: number;
  platformCutPercent: number;
}

export interface ComparisonRowDTO {
  label: string;
  pool: string;
  solo: string;
}

export interface RecommendedPoolDTO {
  id: string;
  code: string;
  name: string;
  market: string;
  slotPrice: number;
  slotsTotal: number;
  slotsFilled: number;
  targetRoiPercent: number;
  durationDays: number;
  status: "scheduled" | "open" | "closed" | "trading";
  closesAt: string;
  riskLevel: "low" | "medium" | "high";
}

export interface OnboardingChecklistItemDTO {
  key: "profile" | "kyc" | "wallet" | "first_deposit";
  label: string;
  description: string;
  status: "done" | "pending" | "todo";
}

export interface InvestorOnboardingContentDTO {
  stats: OnboardingStatDTO[];
  comparison: ComparisonRowDTO[];
  lifecycle: PoolLifecycleStageDTO[];
  sampleEarnings: SampleEarningsDTO;
  idDocTypes: Array<{ value: KycIdDocType; label: string; requiresBack: boolean }>;
  sourceOfFundsOptions: Array<{ value: SourceOfFunds; label: string }>;
  reviewEstimate: string;
  checklist: OnboardingChecklistItemDTO[];
  recommendedPools: RecommendedPoolDTO[];
}

export type KycIdDocType = "passport" | "national_id" | "drivers_license";
export type SourceOfFunds = "employment" | "business" | "investment" | "savings";

export interface KycSubmitRequestDTO {
  idDocType: KycIdDocType;
  idDocFrontUrl: string;
  idDocBackUrl: string | null;
  selfieUrl: string;
  proofOfAddressUrl: string;
  sourceOfFundsDeclaration: SourceOfFunds;
  enhancedDueDiligence: string | null;
}

export interface KycStatusDTO {
  kycId: string;
  userId: string;
  level: 1 | 2 | 3;
  reviewStatus: "pending" | "approved" | "rejected";
  depositLimitPerTx: number;
  depositLimitDaily: number;
  depositLimitMonthly: number;
  submittedAt: string;
}

/** Pre-signed upload ticket (S3-compatible). Mock returns a fake s3:// URL. */
export interface UploadTicketDTO {
  fileKey: string;
  url: string;
  sizeBytes: number;
  contentType: string;
}

/* ── A-4 / A-5 Password reset ────────────────────────────────────────────── */

export interface ForgotPasswordRequestDTO {
  email: string;
}

export interface ForgotPasswordResponseDTO {
  message: string;
  retryAfterSeconds: number;
}

export interface ResetTokenStatusDTO {
  valid: boolean;
  emailMasked: string | null;
  expiresAt: string | null;
  reason?: "expired" | "used" | "malformed";
}

export interface ResetPasswordRequestDTO {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ResetPasswordResponseDTO {
  message: string;
  redirectTo: string;
}

/* ── A-6 Email verification ──────────────────────────────────────────────── */

export type EmailVerificationStatus = "pending" | "verifying" | "verified" | "expired" | "invalid";

export interface VerifyEmailResponseDTO {
  status: Exclude<EmailVerificationStatus, "pending" | "verifying">;
  userId: string | null;
  email: string | null;
  verifiedAt: string | null;
}

export interface ResendVerificationRequestDTO {
  email: string;
}

export interface ResendVerificationResponseDTO {
  message: string;
  emailMasked: string;
  retryAfterSeconds: number;
}

/* ── A-7 Two-factor ──────────────────────────────────────────────────────── */

export interface TwoFactorVerifyRequestDTO {
  challengeId: string;
  code: string;
  method: "authenticator" | "backup_code";
}

export interface TwoFactorResendResponseDTO {
  challengeId: string;
  expiresInSeconds: number;
}

/* ── A-8 Deriv OAuth callback ────────────────────────────────────────────── */

export type DerivCallbackErrorCode =
  | "STATE_MISMATCH"
  | "CODE_EXPIRED"
  | "ALREADY_LINKED"
  | "PERMISSION_DENIED"
  | "NETWORK_ERROR";

export type DerivPermission = "read" | "trade" | "payments" | "admin";

export interface DerivAuthorizeUrlDTO {
  url: string;
  state: string;
  expiresAt: string;
}

export interface DerivConnectRequestDTO {
  code: string;
  state: string;
  acct1: string | null;
}

export interface DerivConnectionDTO {
  id: string;
  derivLoginId: string;
  accountType: "real" | "demo";
  currency: string;
  balance: number;
  permissions: DerivPermission[];
  status: "active" | "revoked";
  connectedAt: string;
}

export interface DerivConnectResponseDTO {
  connection: DerivConnectionDTO;
  redirectTo: string;
}

/** The six progress steps shown while the callback is processed. */
export type DerivCallbackStepKey =
  | "redirected"
  | "validate_state"
  | "exchange_code"
  | "store_connection"
  | "link_account"
  | "redirect";
