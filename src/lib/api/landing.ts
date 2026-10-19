import { apiFetch, postJson } from "./http";
import type {
  LandingContentDTO,
  TickerFeedDTO,
  WaitlistSignupRequestDTO,
  WaitlistSignupResponseDTO,
} from "./types";

/** Endpoint map — kept in one place for the backend swap. */
export const endpoints = {
  landingContent: "/api/landing",
  ticker: "/api/market/ticker",
  waitlist: "/api/waitlist",
} as const;

export function fetchLandingContent(): Promise<LandingContentDTO> {
  return apiFetch<LandingContentDTO>(endpoints.landingContent);
}

export function fetchTickerFeed(): Promise<TickerFeedDTO> {
  return apiFetch<TickerFeedDTO>(endpoints.ticker);
}

export function submitWaitlistSignup(
  input: WaitlistSignupRequestDTO,
): Promise<WaitlistSignupResponseDTO> {
  return postJson<WaitlistSignupResponseDTO>(endpoints.waitlist, input);
}
