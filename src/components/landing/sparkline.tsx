"use client";

import { useId } from "react";

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  rising?: boolean;
  className?: string;
}

/** Tiny inline trend line for ticker rows (no chart dependency). */
export function Sparkline({
  points,
  width = 84,
  height = 24,
  rising = true,
  className,
}: SparklineProps) {
  const gradientId = useId();
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);

  const coords = points.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const stroke = rising ? "var(--win)" : "var(--loss)";

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${coords.join(" ")} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline points={coords.join(" ")} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
