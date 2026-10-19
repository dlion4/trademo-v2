import { apiFetch } from "./http";
import type { FeaturesContentDTO } from "./types";

export const featuresEndpoints = {
  featuresContent: "/api/features",
} as const;

export function fetchFeaturesContent(): Promise<FeaturesContentDTO> {
  return apiFetch<FeaturesContentDTO>(featuresEndpoints.featuresContent);
}
