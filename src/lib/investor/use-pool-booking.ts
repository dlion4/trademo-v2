"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/http";
import {
  applyBookingCommand,
  type BookingCommand,
  type PoolBookingWorkspace,
} from "./pool-booking";

/**
 * I-4 query keys follow the specification:
 *   ["pools", poolId, "booking-context"]   → funding context + rails + terms
 *   ["investments", "my-bookings", poolId] → this investor's reservations
 *   ["investments", bookingId, "status"]   → payment tracker (30s poll)
 *
 * The first key owns the hydrated workspace today; the other two are kept so a
 * backend can split the read without touching the view layer.
 */
export const bookingContextKey = (poolId: string) =>
  ["pools", poolId, "booking-context"] as const;
export const myBookingsKey = (poolId: string) =>
  ["investments", "my-bookings", poolId] as const;
export const bookingStatusKey = (bookingId: string) =>
  ["investments", bookingId, "status"] as const;

export function usePoolBooking(initial: PoolBookingWorkspace) {
  const client = useQueryClient();
  const key = bookingContextKey(initial.poolId);
  const query = useQuery({
    queryKey: key,
    initialData: initial,
    queryFn: () =>
      apiFetch<PoolBookingWorkspace>(
        `/api/investor/pools/${initial.poolId}/book`,
      ),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: async (command: BookingCommand) => {
      const current = client.getQueryData<PoolBookingWorkspace>(key) ?? initial;
      const next = applyBookingCommand(current, command);
      client.setQueryData(key, next);
      if (command.kind === "createBooking" || command.kind === "cancelBooking")
        await client.invalidateQueries({
          queryKey: myBookingsKey(initial.poolId),
        });
      return next;
    },
  });

  return { data: query.data, mutation };
}
