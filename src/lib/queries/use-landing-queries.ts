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

/** Landing content query — hydrated with the server-rendered payload. */
export function useLandingContent(initialData?: LandingContentDTO) {
  return useQuery<LandingContentDTO>({
    queryKey: ["landing", "content"],
    queryFn: fetchLandingContent,
    initialData,
    staleTime: 60_000,
  });
}

/** Marquee quotes — short polling now, websocket upgrade later. */
export function useTickerFeed(initialData?: TickerFeedDTO, refetchInterval = 5_000) {
  return useQuery<TickerFeedDTO>({
    queryKey: ["market", "ticker"],
    queryFn: fetchTickerFeed,
    initialData,
    refetchInterval,
    staleTime: 3_000,
  });
}

/** Page H-2 feature modules — hydrated with the server-rendered payload. */
export function useFeaturesContent(initialData?: FeaturesContentDTO) {
  return useQuery<FeaturesContentDTO>({
    queryKey: ["features", "content"],
    queryFn: fetchFeaturesContent,
    initialData,
    staleTime: 60_000,
  });
}

/** Page H-3 pricing tiers & investment calculator — hydrated with server-rendered payload. */
export function usePricingContent(initialData?: PricingContentDTO) {
  return useQuery<PricingContentDTO>({
    queryKey: ["pricing", "content"],
    queryFn: fetchPricingContent,
    initialData,
    staleTime: 60_000,
  });
}
