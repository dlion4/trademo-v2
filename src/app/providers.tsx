"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createQueryClient } from "@/lib/queries/query-client";

/**
 * TanStack Query provider. Every page-level data need flows through the
 * query hooks in `src/lib/queries`, so wiring a real backend later means
 * changing fetchers — not components.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
