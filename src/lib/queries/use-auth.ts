"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { AuthApiError, authApi } from "@/lib/api/auth";
import type { InvestorOnboardingContentDTO } from "@/lib/auth/types";

/**
 * TanStack Query bindings for every auth page (A-1 → A-8).
 * Query keys follow tradeMO.md §9.2 conventions.
 */
export const authKeys = {
  user: ["user"] as const,
  resetToken: (token: string) => ["auth", "reset-token", token] as const,
  verifyEmail: (token: string) => ["auth", "verify-email", token] as const,
  onboarding: ["auth", "onboarding", "investor"] as const,
};

const noRetryOnClientError = (count: number, error: unknown) =>
  !(error instanceof AuthApiError && error.status >= 400 && error.status < 500) && count < 1;

/* A-1 */
export const useRegister = () => useMutation({ mutationFn: authApi.register });

/* A-2 */
export const useLogin = () => useMutation({ mutationFn: authApi.login });

/* A-3 */
export function useInvestorOnboarding(initialData?: InvestorOnboardingContentDTO) {
  return useQuery({
    queryKey: authKeys.onboarding,
    queryFn: authApi.investorOnboarding,
    initialData,
    staleTime: 5 * 60_000,
  });
}
export const useKycUpload = () =>
  useMutation({ mutationFn: ({ file, slot }: { file: File; slot: string }) => authApi.kycUpload(file, slot) });
export const useKycSubmit = () => useMutation({ mutationFn: authApi.kycSubmit });

/* A-4 */
export const useForgotPassword = () => useMutation({ mutationFn: authApi.forgotPassword });

/* A-5 */
export function useResetTokenStatus(token: string) {
  return useQuery({
    queryKey: authKeys.resetToken(token),
    queryFn: () => authApi.checkResetToken(token),
    enabled: token.length > 0,
    retry: noRetryOnClientError,
    staleTime: Infinity,
  });
}
export const useResetPassword = () => useMutation({ mutationFn: authApi.resetPassword });

/* A-6 */
export function useVerifyEmailToken(token: string) {
  return useQuery({
    queryKey: authKeys.verifyEmail(token),
    queryFn: () => authApi.verifyEmail(token),
    enabled: token.length > 0,
    retry: noRetryOnClientError,
    staleTime: Infinity,
  });
}
export const useResendVerification = () => useMutation({ mutationFn: authApi.resendVerification });

/* A-7 */
export const useVerifyTwoFactor = () => useMutation({ mutationFn: authApi.verifyTwoFactor });
export const useResendTwoFactor = () => useMutation({ mutationFn: authApi.resendTwoFactor });

/* A-8 + SSO */
export const useDerivAuthorizeUrl = () => useMutation({ mutationFn: authApi.derivAuthorizeUrl });
export const useDerivConnect = () => useMutation({ mutationFn: authApi.derivConnect });
