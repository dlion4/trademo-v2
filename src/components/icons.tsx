import type { SVGProps } from "react";

export type IconName =
  | "users"
  | "vault"
  | "chart"
  | "shield"
  | "lock"
  | "clock"
  | "bolt"
  | "check"
  | "arrowRight"
  | "bot"
  | "pool"
  | "script"
  | "plug"
  | "package"
  | "split"
  | "trendUp"
  | "trendDown"
  | "menu"
  | "close"
  | "calendar"
  | "sliders"
  | "gauge"
  | "layers"
  | "globe"
  | "activity"
  | "terminal"
  | "code"
  | "target"
  | "chevronDown"
  | "minus"
  | "play"
  | "pause"
  | "wallet";

const PATHS: Record<IconName, string> = {
  users:
    "M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-1.5a4 4 0 0 0-3-3.87M16 3.63a4 4 0 0 1 0 7.75",
  vault:
    "M3 5.5h18v13H3zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6ZM12 12h.01M7 18.5V21M17 18.5V21",
  chart: "M4 20V9M10 20V4M16 20v-7M22 20H2",
  shield: "M12 21s7-3.2 7-9V5.6L12 3 5 5.6V12c0 5.8 7 9 7 9ZM9.2 12l2 2 3.6-3.8",
  lock: "M6.5 10.5V8a5.5 5.5 0 1 1 11 0v2.5M5.5 10.5h13V21h-13zM12 14.5v2.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  bolt: "M13.5 2 4 14h6l-1 8 9.5-12h-6z",
  check: "M4.5 12.5 9 17 19.5 6.5",
  arrowRight: "M4 12h15M13 6l6 6-6 6",
  bot: "M7.5 8.5h9a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17v-6a2.5 2.5 0 0 1 2.5-2.5ZM12 8.5V4M9.5 4h5M9 14h.01M15 14h.01M9 17.5h6M2.5 12.5v3M21.5 12.5v3",
  pool: "M12 3 3 7.5 12 12l9-4.5zM3 12.5 12 17l9-4.5M3 17 12 21.5 21 17",
  script: "M9 8l-4 4 4 4M15 8l4 4-4 4M13.5 5.5l-3 13",
  plug: "M9 3.5v5M15 3.5v5M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0zM12 17v3.5",
  package:
    "M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5zM3.5 7.5 12 12m0 0 8.5-4.5M12 12v9",
  split:
    "M6 3.5v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v5M6 3.5 3.5 6M6 3.5 8.5 6M18 20.5 15.5 18M18 20.5l2.5-2.5",
  trendUp: "M3 17 9.5 10.5l4 4L21 7M21 12V7h-5",
  trendDown: "M3 7l6.5 6.5 4-4L21 17M21 12v5h-5",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  calendar:
    "M4.5 6.5h15v13h-15zM8 3.5v5M16 3.5v5M4.5 11h15M9 14.5h2M14 14.5h2",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5",
  gauge: "M4 18a8 8 0 1 1 16 0M12 18l4.5-6",
  layers: "M12 3.5 3.5 8 12 12.5 20.5 8zM3.5 12.5 12 17l8.5-4.5M3.5 17 12 21.5l8.5-4.5",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.2 9h17.6M3.2 15h17.6M12 3c-2.5 2.4-3.8 5.4-3.8 9s1.3 6.6 3.8 9c2.5-2.4 3.8-5.4 3.8-9S14.5 5.4 12 3Z",
  activity: "M3 12.5h4l3-8 4 15 3-7h4",
  terminal: "M3.5 5h17v14h-17zM7 10l2.5 2.5L7 15M12.5 15h4",
  code: "M9 8l-4 4 4 4M15 8l4 4-4 4",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z",
  chevronDown: "M6 9.5l6 6 6-6",
  minus: "M6 12h12",
  play: "M7.5 4.5v15l12-7.5z",
  pause: "M8.5 5v14M15.5 5v14",
  wallet: "M3.5 7.5h17v12h-17zM3.5 7.5 15 3.5M16.5 13.5h2",
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Feature glyphs intentionally use the emoji art-direction from the spec. */
export function featureGlyph(icon: string): string {
  const map: Record<string, string> = { bot: "🤖", pool: "💎", script: "📜" };
  return map[icon] ?? "⚡";
}

export function stepGlyph(icon: string): string {
  const map: Record<string, string> = {
    plug: "🔌",
    package: "📦",
    clock: "🕒",
    split: "🌿",
  };
  return map[icon] ?? "•";
}

export default Icon;
