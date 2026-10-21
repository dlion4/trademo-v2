import { cn } from "@/lib/cn";

type MarkKind = "success" | "error" | "envelope" | "lock" | "warning" | "link";

const PATHS: Record<MarkKind, string[]> = {
  success: ["M7.5 12.5 10.5 15.5 16.5 9"],
  error: ["M9 9l6 6", "M15 9l-6 6"],
  envelope: ["M6 8.5h12v8H6z", "M6 9l6 4.5L18 9"],
  lock: ["M8.5 11V9.5a3.5 3.5 0 1 1 7 0V11", "M7.5 11h9v6.5h-9z"],
  warning: ["M12 8v5", "M12 15.8v.2"],
  link: ["M10.5 13.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8", "M13.5 10.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8"],
};

/**
 * Circular status glyph with SVG stroke draw-in (spec: "icon-draw").
 * All paths use pathLength=1 so the dash animation is size-independent.
 */
export function StatusMark({ kind, size = 56, className }: { kind: MarkKind; size?: number; className?: string }) {
  return (
    <span className={cn("status-mark", `status-mark--${kind}`, className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true" className="icon-draw">
        <circle cx="12" cy="12" r="11" className="status-mark__ring" />
        {PATHS[kind].map((d, i) => (
          <path
            key={d}
            d={d}
            pathLength={1}
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animationDelay: `${180 + i * 120}ms` }}
          />
        ))}
      </svg>
    </span>
  );
}
