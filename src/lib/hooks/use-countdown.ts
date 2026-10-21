"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Second-resolution countdown. `restart(seconds)` re-arms it — used for
 * "Resend in 60s", 2FA code windows and auto-redirect timers.
 */
export function useCountdown(initialSeconds: number, autoStart = true) {
  const [remaining, setRemaining] = useState(autoStart ? initialSeconds : 0);
  const [total, setTotal] = useState(initialSeconds);
  const endRef = useRef<number | null>(null);

  const restart = useCallback((seconds: number) => {
    setTotal(seconds);
    setRemaining(seconds);
    endRef.current = Date.now() + seconds * 1000;
  }, []);

  useEffect(() => {
    if (autoStart && endRef.current === null) endRef.current = Date.now() + initialSeconds * 1000;
  }, [autoStart, initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      const end = endRef.current ?? Date.now();
      const next = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return { remaining, total, done: remaining <= 0, restart, progress: total ? remaining / total : 0 };
}
