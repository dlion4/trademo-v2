import { apiFetch } from "./http";
import type { PricingContentDTO } from "./types";

export const pricingEndpoints = {
  pricingContent: "/api/pricing",
} as const;

export function fetchPricingContent(): Promise<PricingContentDTO> {
  return apiFetch<PricingContentDTO>(pricingEndpoints.pricingContent);
}
