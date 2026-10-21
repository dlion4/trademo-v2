import type {
  AuthErrorCode,
  AuthErrorDTO,
  AuthSessionDTO,
  DerivAuthorizeUrlDTO,
  DerivConnectRequestDTO,
  DerivConnectResponseDTO,
  ForgotPasswordRequestDTO,
  ForgotPasswordResponseDTO,
  InvestorOnboardingContentDTO,
  KycStatusDTO,
  KycSubmitRequestDTO,
  ResendVerificationRequestDTO,
  ResendVerificationResponseDTO,
  ResetPasswordRequestDTO,
  ResetPasswordResponseDTO,
  ResetTokenStatusDTO,
  SigninRequestDTO,
  SigninResponseDTO,
  SignupRequestDTO,
  SignupResponseDTO,
  TwoFactorResendResponseDTO,
  TwoFactorVerifyRequestDTO,
  UploadTicketDTO,
  VerifyEmailResponseDTO,
} from "@/lib/auth/types";

/**
 * Base URL for the auth backend. Empty = same-origin mock handlers under
 * /api/auth/*. Point NEXT_PUBLIC_API_BASE_URL at the Express gateway later.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** Endpoint map — mirrors tradeMO.md §17.2 AUTH + KYC routes. */
export const authEndpoints = {
  register: "/api/auth/register",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  forgotPassword: "/api/auth/forgot-password",
  resetPassword: "/api/auth/reset-password",
  verifyEmail: "/api/auth/verify-email",
  resendVerification: "/api/auth/verify-email/resend",
  twoFactorVerify: "/api/auth/2fa/verify",
  twoFactorResend: "/api/auth/2fa/resend",
  derivAuthorize: "/api/auth/deriv/authorize",
  derivConnect: "/api/auth/deriv/connect",
  onboardingInvestor: "/api/auth/onboarding/investor",
  kycUpload: "/api/kyc/upload",
  kycSubmit: "/api/kyc/submit",
} as const;

/** Typed error carrying the backend error code + extra fields (attempts, lockout…). */
export class AuthApiError extends Error {
  readonly status: number;
  readonly code: AuthErrorCode;
  readonly details: AuthErrorDTO;

  constructor(status: number, details: AuthErrorDTO) {
    super(details.message ?? details.error ?? `Request failed (${status})`);
    this.name = "AuthApiError";
    this.status = status;
    this.code = details.error ?? "UNKNOWN";
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new AuthApiError(0, { error: "NETWORK_ERROR", message: "Network unavailable. Check your connection." });
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const body = (payload ?? {}) as Partial<AuthErrorDTO>;
    throw new AuthApiError(response.status, {
      ...body,
      error: body.error ?? "UNKNOWN",
      message: body.message ?? "Something went wrong. Please try again.",
    });
  }

  // Accept both enveloped ({ data, meta }) and bare responses.
  if (payload && typeof payload === "object" && "data" in payload && "meta" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
const qs = (params: Record<string, string>) => `?${new URLSearchParams(params).toString()}`;

export const authApi = {
  register: (input: SignupRequestDTO) => post<SignupResponseDTO>(authEndpoints.register, input),
  login: (input: SigninRequestDTO) => post<SigninResponseDTO>(authEndpoints.login, input),
  forgotPassword: (input: ForgotPasswordRequestDTO) =>
    post<ForgotPasswordResponseDTO>(authEndpoints.forgotPassword, input),
  checkResetToken: (token: string) =>
    request<ResetTokenStatusDTO>(`${authEndpoints.resetPassword}${qs({ token })}`),
  resetPassword: (input: ResetPasswordRequestDTO) =>
    post<ResetPasswordResponseDTO>(authEndpoints.resetPassword, input),
  verifyEmail: (token: string) => request<VerifyEmailResponseDTO>(`${authEndpoints.verifyEmail}${qs({ token })}`),
  resendVerification: (input: ResendVerificationRequestDTO) =>
    post<ResendVerificationResponseDTO>(authEndpoints.resendVerification, input),
  verifyTwoFactor: (input: TwoFactorVerifyRequestDTO) => post<AuthSessionDTO>(authEndpoints.twoFactorVerify, input),
  resendTwoFactor: (challengeId: string) =>
    post<TwoFactorResendResponseDTO>(authEndpoints.twoFactorResend, { challengeId }),
  derivAuthorizeUrl: () => request<DerivAuthorizeUrlDTO>(authEndpoints.derivAuthorize),
  derivConnect: (input: DerivConnectRequestDTO) => post<DerivConnectResponseDTO>(authEndpoints.derivConnect, input),
  investorOnboarding: () => request<InvestorOnboardingContentDTO>(authEndpoints.onboardingInvestor),
  kycUpload: (file: File, slot: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("slot", slot);
    return request<UploadTicketDTO>(authEndpoints.kycUpload, { method: "POST", body: form });
  },
  kycSubmit: (input: KycSubmitRequestDTO) => post<KycStatusDTO>(authEndpoints.kycSubmit, input),
};
