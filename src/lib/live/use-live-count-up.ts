"use client";
import { useEffect, useRef, useState } from "react";
/** Animate from the previous displayed value, never reset totals to zero on a tick. */
export function useLiveCountUp(target: number) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = current.current;
    let start: number | undefined;
    let frame: number;
    function tick(now: number) {
      start ??= now;
      const progress = reduced ? 1 : Math.min(1, (now - start) / 600);
      current.current = from + (target - from) * (1 - (1 - progress) ** 4);
      setValue(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}
