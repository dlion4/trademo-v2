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
  | "wallet"
  | "eye"
  | "eyeOff"
  | "mail"
  | "key"
  | "alert"
  | "upload"
  | "camera"
  | "file"
  | "refresh"
  | "user"
  | "smartphone"
  | "arrowLeft"
  | "info"
  | "external"
  | "link"
  | "x"
  | "bell"
  | "search"
  | "download"
  | "filter"
  | "copy"
  | "sun"
  | "moon"
  | "panelRight"
  | "stop"
  | "plus"
  | "send"
  | "chevronRight";

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
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff:
    "M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  mail: "M3.5 5.5h17v13h-17zM3.5 6.5 12 13l8.5-6.5",
  key: "M14.5 9.5a4.5 4.5 0 1 1-1.3-3.2 4.5 4.5 0 0 1 1.3 3.2ZM13.2 12.7 21 20.5M17.5 17l2-2M19.5 19l1.5-1.5",
  alert: "M12 3.5 2.5 20h19zM12 10v4.5M12 17.5h.01",
  upload: "M12 15.5V4M7 8.5l5-5 5 5M4 15v4.5h16V15",
  camera: "M3.5 7.5h4l1.5-2.5h6l1.5 2.5h4v12h-17zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  file: "M14 3.5H6.5v17h11V7zM14 3.5V7h3.5M9 12h6M9 15.5h6",
  refresh: "M20 11a8 8 0 0 0-14.6-4.5M4 13a8 8 0 0 0 14.6 4.5M5 3v4h4M19 21v-4h-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0",
  smartphone: "M7 2.5h10v19H7zM11 18.5h2",
  arrowLeft: "M20 12H5M11 6l-6 6 6 6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.5h.01",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  link: "M10 14a4.5 4.5 0 0 0 6.4 0l3-3A4.5 4.5 0 0 0 13 4.6l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2",
  x: "M7 7l10 10M17 7 7 17",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 8.5-3 8.5h18S18 15 18 8ZM10.3 20a2 2 0 0 0 3.4 0",
  search: "M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16.5 16.5 21 21",
  download: "M12 4v11.5M7 11l5 5 5-5M4 19.5h16",
  filter: "M3.5 5.5h17l-6.5 7.5v5.5l-4 1.5V13z",
  copy: "M9 9h10.5v11.5H9zM5 15H4V4h10.5v1",
  sun: "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z",
  panelRight: "M3.5 4.5h17v15h-17zM15 4.5v15",
  stop: "M6.5 6.5h11v11h-11z",
  plus: "M12 5v14M5 12h14",
  send: "M21 3 3 10.5l7.5 3L13.5 21 21 3ZM10.5 13.5 21 3",
  chevronRight: "M9.5 6l6 6-6 6",
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
