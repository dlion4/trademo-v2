"use client";

import { useEffect, useState } from "react";

/** Reactive prefers-reduced-motion (spec: animations snap / disable). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return reduced;
}

/** True once the element has scrolled into view (fires a single time). */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, inView, threshold]);

  return { ref: setNode, inView } as const;
}

/**
 * Count-up animation, easeOutQuart over 1.2s.
 * Pauses when the tab is hidden, snaps instantly under reduced motion.
 */
export function useCountUp(target: number, options?: { duration?: number; enabled?: boolean }) {
  const duration = options?.duration ?? 1200;
  const enabled = options?.enabled ?? true;
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState(enabled && !reducedMotion ? 0 : target);

  useEffect(() => {
    if (!enabled || reducedMotion) {
      setValue(target);
      return;
    }

    let frame = 0;
    let start: number | null = null;
    let pausedAt: number | null = null;

    const tick = (time: number) => {
      if (start === null) start = time;
      if (pausedAt !== null) {
        start += time - pausedAt;
        pausedAt = null;
      }
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setValue(target);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (start !== null && pausedAt === null) pausedAt = performance.now();
        cancelAnimationFrame(frame);
      } else {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [target, duration, enabled, reducedMotion]);

  return reducedMotion ? target : value;
}
