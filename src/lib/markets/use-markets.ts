"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/http";
import {
  applyMarketCommand,
  type MarketBundle,
  type MarketCommand,
} from "./model";
const key = ["markets", "workspace"] as const;
const storage = "trademo:markets:favorites:jane_operator:v1";
export function useMarkets(initial: MarketBundle) {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<MarketBundle>("/api/markets?section=workspace"),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(storage);
        if (raw) {
          const codes: unknown = JSON.parse(raw);
          if (
            !Array.isArray(codes) ||
            codes.some(
              (c) =>
                typeof c !== "string" ||
                !initial.symbols.some((s) => s.code === c),
            )
          )
            throw Error("Stored favorites were invalid; defaults retained.");
          const state = client.getQueryData<MarketBundle>(key) ?? initial;
          client.setQueryData(key, {
            ...state,
            favorites: [...new Set(codes)],
          });
        }
      } catch {
        setStorageNotice(
          "Browser storage unavailable or invalid; favorites remain available in this session.",
        );
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [client, initial]);
  const mutation = useMutation({
    mutationFn: async (c: MarketCommand) => {
      const state = client.getQueryData<MarketBundle>(key) ?? initial;
      const next = applyMarketCommand(state, c);
      client.setQueryData(key, next);
      if (c.kind === "favorite" || c.kind === "favorites")
        try {
          localStorage.setItem(storage, JSON.stringify(next.favorites));
        } catch {
          setStorageNotice(
            "Favorites saved in-session only; browser storage is unavailable.",
          );
        }
      return next;
    },
  });
  return { data: q.data, mutation, storageNotice };
}
