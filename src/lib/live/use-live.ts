"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { applyLiveEvent, type BotCommand, type LiveBundle, type LiveEvent } from "./types";
export const liveKey = ["live", "session"] as const;

/** Frontend-only adapter: replace simulation timer/command with authenticated socket + REST. */
export function useLiveSession(initial: LiveBundle, halted = false) {
  const client = useQueryClient();
  const [streaming, setStreaming] = useState(true);
  const query = useQuery({ queryKey: liveKey, queryFn: () => apiFetch<LiveBundle>("/api/live"), initialData: initial, staleTime: Infinity });
  const dispatch = (event: LiveEvent) => client.setQueryData<LiveBundle>(liveKey, previous => applyLiveEvent(previous ?? initial, event));
  useEffect(() => {
    if (!streaming || halted) return;
    let sequence = 0;
    const timer = window.setInterval(() => {
      client.setQueryData<LiveBundle>(liveKey, previous => {
        if (!previous) return previous;
        sequence++;
        const now = new Date(Date.parse(previous.asOf) + 1000).toISOString();
        let next = { ...previous, asOf: now };
        for (const tick of previous.ticks) {
          const delta = (Math.random() - .5) * .6;
          next = applyLiveEvent(next, { type: "operator:tick_update", tick: { ...tick, price: +(tick.price + delta).toFixed(2), change: +(tick.change + delta / tick.price * 100).toFixed(3), updatedAt: now } });
        }
        if (sequence % 8 === 0) {
          const running = next.bots.filter(b => b.status === "running");
          const bot = running[Math.floor(Math.random() * running.length)];
          if (bot) {
            const win = Math.random() > .34;
            const price = next.ticks.find(t => t.symbol === bot.symbol)?.price ?? 4532;
            next = applyLiveEvent(next, { type: "operator:trade_result", trade: {
              tradeId: `demo_${Date.now()}_${sequence}`, packageId: bot.packageId, symbol: bot.symbol, contractType: `${bot.strategy} · 5 ticks`, stake: bot.stake,
              payout: win ? bot.stake * 1.8 : 0, profit: win ? bot.stake * .8 : -bot.stake, isWin: win, entrySpot: price - .2, exitSpot: price,
              boughtAt: new Date(Date.parse(now) - 18000).toISOString(), soldAt: now, botName: bot.name, scheduleId: "SCH-001",
            } });
          }
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [streaming, halted, client]);
  function command(input: BotCommand) {
    const current = client.getQueryData<LiveBundle>(liveKey) ?? initial;
    input.botIds.forEach(id => {
      const bot = current.bots.find(b => b.id === id);
      if (bot) dispatch({ type: "operator:bot_status", bot: { ...bot, status: input.action, stake: input.stake ?? bot.stake, strategy: input.strategy ?? bot.strategy } });
    });
  }
  return { data: query.data, streaming, setStreaming, command };
}
