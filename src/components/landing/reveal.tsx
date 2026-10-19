"use client";

import type { CSSProperties, ReactNode } from "react";

import { useInView } from "@/lib/hooks/use-motion";
import { cn } from "@/lib/cn";

interface RevealProps {
  children: ReactNode;
  /** Stagger offset in ms (spec: 60–80ms per item). */
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Mount-lifecycle entrance animation: fades + slides a block in when it
 * scrolls into view. Driven by the `[data-reveal]` rules in each page
 * stylesheet, so per-page timing stays scoped.
 */
export function Reveal({ children, delay = 0, className, style }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>(0.12);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={cn(inView && "is-inview", className)}
      style={{ ["--reveal-delay" as string]: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  );
}
