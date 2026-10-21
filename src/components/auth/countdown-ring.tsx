import { formatClock } from "@/lib/auth/utils";

/** SVG progress ring driven by stroke-dashoffset (spec A-6 resend countdown). */
export function CountdownRing({ remaining, total, size = 44 }: { remaining: number; total: number; size?: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const progress = total > 0 ? remaining / total : 0;
  return (
    <span className="countdown-ring" style={{ width: size, height: size }} aria-label={`${remaining} seconds remaining`}>
      <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true">
        <circle cx="22" cy="22" r={r} className="countdown-ring__track" />
        <circle
          cx="22"
          cy="22"
          r={r}
          className="countdown-ring__value"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
        />
      </svg>
      <span className="countdown-ring__label mono">{remaining > 0 ? formatClock(remaining) : "0:00"}</span>
    </span>
  );
}
