"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFeaturesContent } from "@/lib/api/features";
import { fetchLandingContent, fetchTickerFeed } from "@/lib/api/landing";
import { fetchPricingContent } from "@/lib/api/pricing";
import type {
  FeaturesContentDTO,
  LandingContentDTO,
  PricingContentDTO,
  TickerFeedDTO,
} from "@/lib/api/types";

/** Backend refetches are disabled; pages render their bundled initial payload. */
export function useLandingContent(initialData?: LandingContentDTO) {
  return useQuery<LandingContentDTO>({
    queryKey: ["landing", "content"],
    queryFn: fetchLandingContent,
    initialData,
    enabled: false,
    staleTime: 60_000,
  });
}

/** Ticker content stays on its bundled initial data while backend integration is disabled. */
export function useTickerFeed(initialData?: TickerFeedDTO) {
  return useQuery<TickerFeedDTO>({
    queryKey: ["market", "ticker"],
    queryFn: fetchTickerFeed,
    initialData,
    enabled: false,
    staleTime: 3_000,
  });
}

/** Page H-2 feature modules — hydrated with the server-rendered payload. */
export function useFeaturesContent(initialData?: FeaturesContentDTO) {
  return useQuery<FeaturesContentDTO>({
    queryKey: ["features", "content"],
    queryFn: fetchFeaturesContent,
    initialData,
    enabled: false,
    staleTime: 60_000,
  });
}

/** Page H-3 pricing tiers & investment calculator — hydrated with server-rendered payload. */
export function usePricingContent(initialData?: PricingContentDTO) {
  return useQuery<PricingContentDTO>({
    queryKey: ["pricing", "content"],
    queryFn: fetchPricingContent,
    initialData,
    enabled: false,
    staleTime: 60_000,
  });
}
