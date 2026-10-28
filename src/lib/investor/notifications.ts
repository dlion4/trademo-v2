/**
 * I-9 · Notifications & Activity — the investor's inbox and audit surface.
 *
 * One `NotificationWorkspace` holds the notification feed, the four event
 * ledgers the page reads from (trade activity, pool updates, payment alerts,
 * system & security), the delivery preferences, the filter state and the local
 * command log. Every count on the page (unread badge, category tallies, trade
 * win rate, payment totals, security posture) is derived from those rows, never
 * typed twice, so the hero, the tabs and the tables cannot disagree.
 *
 * Nothing here talks to a mail, push or SMS provider: `applyNotificationCommand`
 * is the reducer a backend replaces (PATCH /api/notifications/:id/read,
 * POST /api/notifications/mark-all-read, PATCH /api/settings/notifications), and
 * it validates every command against zod before returning an immutable clone.
 */

import { z } from "zod";

import {
  clockOf,
  dateOf,
  money,
  round2,
  shortDateOf,
  signedMoney,
} from "./investments";

export const NOTIFICATIONS_AS_OF = "2026-10-23T10:00:00Z";
export const PAGE_SIZE = 8;
export const MAX_RULES = 8;
export const MAX_EXPORTS = 10;
export const MAX_SUPPORT_DRAFTS = 12;

export type NotificationCategory = "trade" | "pool" | "payment" | "security";
export type NotificationLevel = "info" | "success" | "warning" | "critical";
export type DeliveryChannel = "inApp" | "email" | "push" | "sms";
export type DigestCadence = "realtime" | "hourly" | "daily" | "weekly";
export type TradeResultKind = "win" | "loss";
export type PoolUpdateKind =
  | "trading_started"
  | "guardian_paused"
  | "guardian_watch"
  | "guardian_cleared"
  | "completed"
  | "booking_confirmed"
  | "announced"
  | "closing_soon"
  | "opened";
export type PaymentAlertKind =
  | "deposit_verified"
  | "deposit_pending"
  | "payout_requested"
  | "payout_completed"
  | "payout_failed"
  | "fee_charged"
  | "refund";
export type SecurityKind =
  | "login"
  | "twofa"
  | "password"
  | "profile"
  | "kyc"
  | "device"
  | "session";
export type ExportScope =
  | "inbox"
  | "trade"
  | "pool"
  | "payment"
  | "security"
  | "digest";
export type ExportFormat = "pdf" | "csv" | "json";
export type SupportTopic = "delivery" | "missing" | "security" | "mute" | "other";
export type MuteDuration = "1h" | "8h" | "24h" | "forever";
export type InboxSort = "newest" | "oldest" | "unread";
export type CategoryTab = "all" | NotificationCategory;

/* ── Inbox rows ── */

export interface InvestorNotification {
  id: string;
  at: string;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  detail: string;
  /** Signed amount when the notification carries money (trade win, payout…). */
  amount: number | null;
  read: boolean;
  pinned: boolean;
  snoozedUntil: string | null;
  poolId: string | null;
  poolCode: string | null;
  /** Where "View" goes. Never empty: every row resolves to a real surface. */
  href: string;
  /** Short label for the row's secondary action. */
  openLabel: string;
  /** Which channels actually delivered this row (the log the desk kept). */
  delivered: DeliveryChannel[];
  source: string;
}

export interface TradeActivityRow {
  id: string;
  at: string;
  tradeId: string;
  poolId: string;
  poolCode: string;
  poolName: string;
  symbol: string;
  contractLabel: string;
  result: TradeResultKind;
  stake: number;
  poolProfit: number;
  yourSharePct: number;
  yourShareNet: number;
  botName: string;
  durationSeconds: number;
  href: string;
}

export interface PoolUpdateRow {
  id: string;
  at: string;
  kind: PoolUpdateKind;
  level: NotificationLevel;
  poolId: string | null;
  poolCode: string | null;
  title: string;
  detail: string;
  amount: number | null;
  status: string;
  href: string;
}

export interface PaymentAlertRow {
  id: string;
  at: string;
  kind: PaymentAlertKind;
  level: NotificationLevel;
  methodLabel: string;
  rail: string;
  reference: string;
  gross: number;
  fee: number;
  net: number;
  status: string;
  poolCode: string | null;
  detail: string;
  href: string;
}

export interface SecurityRow {
  id: string;
  at: string;
  kind: SecurityKind;
  level: NotificationLevel;
  title: string;
  detail: string;
  device: string;
  location: string;
  ip: string;
  status: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastSeenAt: string;
  current: boolean;
  trusted: boolean;
}

/* ── Preferences, rules, delivery log ── */

export interface ChannelMatrix {
  inApp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface NotificationPreferences {
  channels: Record<NotificationCategory, ChannelMatrix>;
  digest: DigestCadence;
  digestHour: number;
  quietHours: { enabled: boolean; from: string; to: string };
  /** Only alert on trades whose share impact clears this amount. */
  minTradeAmount: number;
  guardianAlerts: boolean;
  poolStatusAlerts: boolean;
  sound: boolean;
  desktopPush: boolean;
  weeklySummary: boolean;
}

export interface InboxRule {
  id: string;
  label: string;
  detail: string;
  category: NotificationCategory;
  action: "mute" | "digest" | "pin" | "alert";
  enabled: boolean;
}

export interface DeliveryRow {
  id: string;
  channel: DeliveryChannel;
  address: string;
  verified: boolean;
  sent: number;
  failed: number;
  lastAt: string;
  note: string;
}

/* ── Filters, exports, support, audit ── */

export interface NotificationFilters {
  category: CategoryTab;
  unreadOnly: boolean;
  pinnedOnly: boolean;
  range: "today" | "7d" | "30d" | "all";
  query: string;
  sort: InboxSort;
}

export interface NotificationExport {
  id: string;
  scope: ExportScope;
  format: ExportFormat;
  count: number;
  createdAt: string;
}

export interface NotificationSupport {
  id: string;
  topic: SupportTopic;
  message: string;
  status: "local_draft";
  createdAt: string;
}

export interface NotificationAudit {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface NotificationWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  profile: {
    id: string;
    displayName: string;
    investorSince: string;
    tier: string;
    kycLevel: string;
    country: string;
    currency: string;
    email: string;
    phone: string;
    wallet: number;
    monthRoiPct: number;
    committed: number;
  };
  notifications: InvestorNotification[];
  tradeActivity: TradeActivityRow[];
  poolUpdates: PoolUpdateRow[];
  paymentAlerts: PaymentAlertRow[];
  securityEvents: SecurityRow[];
  sessions: ActiveSession[];
  preferences: NotificationPreferences;
  rules: InboxRule[];
  deliveries: DeliveryRow[];
  filters: NotificationFilters;
  exports: NotificationExport[];
  support: NotificationSupport[];
  audit: NotificationAudit[];
}

/* ── Formatting ── */

export const pct = (value: number, decimals = 0) => `${value.toFixed(decimals)}%`;
export const clockShort = (iso: string) => clockOf(iso).slice(0, 5);
export const dayKey = (iso: string) => iso.slice(0, 10);
export { money, signedMoney, round2, shortDateOf, dateOf, clockOf };

export const dayLabel = (iso: string, asOf: string) => {
  if (dayKey(iso) === dayKey(asOf)) return "Today";
  const previous = new Date(asOf);
  previous.setUTCDate(previous.getUTCDate() - 1);
  if (dayKey(iso) === previous.toISOString().slice(0, 10)) return "Yesterday";
  return dateOf(iso);
};

/** "12 min ago" / "3 h ago" / "2 d ago" — always relative to the snapshot. */
export const relativeTo = (iso: string, asOf: string) => {
  const deltaMs = new Date(asOf).getTime() - new Date(iso).getTime();
  if (Number.isNaN(deltaMs) || deltaMs < 0) return "just now";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 d ago" : `${days} d ago`;
};

export const categoryLabel = (category: NotificationCategory) =>
  category === "trade"
    ? "Trade activity"
    : category === "pool"
      ? "Pool updates"
      : category === "payment"
        ? "Payment alerts"
        : "System & security";

export const categoryShort = (category: NotificationCategory) =>
  category === "trade"
    ? "Trades"
    : category === "pool"
      ? "Pools"
      : category === "payment"
        ? "Payments"
        : "Security";

export const levelTone = (level: NotificationLevel) =>
  level === "success"
    ? "is-ok"
    : level === "warning"
      ? "is-warn"
      : level === "critical"
        ? "is-critical"
        : "is-info";

export const levelLabel = (level: NotificationLevel) =>
  level === "success"
    ? "Settled"
    : level === "warning"
      ? "Attention"
      : level === "critical"
        ? "Critical"
        : "Info";

export const channelLabel = (channel: DeliveryChannel) =>
  channel === "inApp"
    ? "In-app"
    : channel === "email"
      ? "Email"
      : channel === "push"
        ? "Push"
        : "SMS";

export const poolUpdateLabel = (kind: PoolUpdateKind) =>
  kind === "trading_started"
    ? "Trading started"
    : kind === "guardian_paused"
      ? "Guardian paused"
      : kind === "guardian_watch"
        ? "Guardian watch"
        : kind === "guardian_cleared"
          ? "Guardian cleared"
          : kind === "completed"
            ? "Cycle completed"
            : kind === "booking_confirmed"
              ? "Booking confirmed"
              : kind === "announced"
                ? "Announced"
                : kind === "closing_soon"
                  ? "Closing soon"
                  : "Window opened";

export const paymentAlertLabel = (kind: PaymentAlertKind) =>
  kind === "deposit_verified"
    ? "Deposit verified"
    : kind === "deposit_pending"
      ? "Deposit pending"
      : kind === "payout_requested"
        ? "Payout requested"
        : kind === "payout_completed"
          ? "Payout completed"
          : kind === "payout_failed"
            ? "Payout failed"
            : kind === "fee_charged"
              ? "Fee charged"
              : "Refund";

export const securityKindLabel = (kind: SecurityKind) =>
  kind === "login"
    ? "Sign-in"
    : kind === "twofa"
      ? "2FA"
      : kind === "password"
        ? "Password"
        : kind === "profile"
          ? "Profile"
          : kind === "kyc"
            ? "KYC"
            : kind === "device"
              ? "New device"
              : "Session";

/* ── Derived views ── */

export const unreadOf = (list: readonly InvestorNotification[]) =>
  list.filter((row) => !row.read);

export const isSnoozed = (row: InvestorNotification, asOf: string) =>
  Boolean(row.snoozedUntil && row.snoozedUntil > asOf);

export const categoryCounts = (list: readonly InvestorNotification[]) => {
  const counts: Record<NotificationCategory, { total: number; unread: number }> =
    {
      trade: { total: 0, unread: 0 },
      pool: { total: 0, unread: 0 },
      payment: { total: 0, unread: 0 },
      security: { total: 0, unread: 0 },
    };
  for (const row of list) {
    counts[row.category].total += 1;
    if (!row.read) counts[row.category].unread += 1;
  }
  return counts;
};

export interface InboxSummary {
  total: number;
  unread: number;
  today: number;
  week: number;
  pinned: number;
  snoozed: number;
  critical: number;
  counts: ReturnType<typeof categoryCounts>;
}

export const inboxSummary = (
  workspace: NotificationWorkspace,
): InboxSummary => {
  const { notifications, asOf } = workspace;
  const todayKey = dayKey(asOf);
  const weekFloor = new Date(asOf).getTime() - 7 * 24 * 3600_000;
  return {
    total: notifications.length,
    unread: notifications.filter((row) => !row.read).length,
    today: notifications.filter((row) => dayKey(row.at) === todayKey).length,
    week: notifications.filter(
      (row) => new Date(row.at).getTime() >= weekFloor,
    ).length,
    pinned: notifications.filter((row) => row.pinned).length,
    snoozed: notifications.filter((row) => isSnoozed(row, asOf)).length,
    critical: notifications.filter((row) => row.level === "critical").length,
    counts: categoryCounts(notifications),
  };
};

const rangeFloor = (range: NotificationFilters["range"], asOf: string) => {
  if (range === "all" || range === "today") return 0;
  const days = range === "7d" ? 7 : 30;
  return new Date(asOf).getTime() - days * 86_400_000;
};

export const filterInbox = (
  list: readonly InvestorNotification[],
  filters: NotificationFilters,
  asOf: string,
) => {
  const floor = rangeFloor(filters.range, asOf);
  const todayKey = dayKey(asOf);
  const query = filters.query.trim().toLowerCase();
  const rows = list.filter((row) => {
    if (filters.category !== "all" && row.category !== filters.category) return false;
    if (filters.unreadOnly && row.read) return false;
    if (filters.pinnedOnly && !row.pinned) return false;
    if (filters.range === "today" && dayKey(row.at) !== todayKey) return false;
    if (floor && new Date(row.at).getTime() < floor) return false;
    if (!query) return true;
    return `${row.title} ${row.detail} ${row.poolCode ?? ""} ${row.source}`
      .toLowerCase()
      .includes(query);
  });
  const sorted = rows.slice().sort((a, b) => b.at.localeCompare(a.at));
  if (filters.sort === "oldest") sorted.reverse();
  if (filters.sort === "unread") {
    sorted.sort((a, b) => Number(a.read) - Number(b.read) || b.at.localeCompare(a.at));
  }
  // Pinned rows always float, whatever the sort says.
  return sorted.sort((a, b) => Number(b.pinned) - Number(a.pinned));
};

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

export function groupByDay<T extends { at: string }>(
  rows: readonly T[],
  asOf: string,
): DayGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = dayKey(row.at);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      key,
      label: dayLabel(`${key}T00:00:00Z`, asOf),
      items,
    }));
}

export const paginate = <T>(rows: readonly T[], page: number, size = PAGE_SIZE) => {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const safe = Math.min(Math.max(1, page), pages);
  return {
    page: safe,
    pages,
    total: rows.length,
    rows: rows.slice((safe - 1) * size, safe * size),
  };
};

export interface TradeStats {
  trades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  net: number;
  grossWins: number;
  grossLosses: number;
  best: TradeActivityRow | null;
  worst: TradeActivityRow | null;
  volume: number;
  avgShare: number;
  pools: { code: string; trades: number; net: number }[];
}

export function tradeStats(rows: readonly TradeActivityRow[]): TradeStats {
  const wins = rows.filter((row) => row.result === "win");
  const losses = rows.filter((row) => row.result === "loss");
  const net = round2(rows.reduce((sum, row) => sum + row.yourShareNet, 0));
  const sorted = rows.slice().sort((a, b) => b.yourShareNet - a.yourShareNet);
  const byPool = new Map<string, { trades: number; net: number }>();
  for (const row of rows) {
    const bucket = byPool.get(row.poolCode) ?? { trades: 0, net: 0 };
    bucket.trades += 1;
    bucket.net = round2(bucket.net + row.yourShareNet);
    byPool.set(row.poolCode, bucket);
  }
  return {
    trades: rows.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: rows.length ? round2((wins.length / rows.length) * 100) : 0,
    net,
    grossWins: round2(wins.reduce((sum, row) => sum + row.yourShareNet, 0)),
    grossLosses: round2(losses.reduce((sum, row) => sum + row.yourShareNet, 0)),
    best: sorted[0] ?? null,
    worst: sorted[sorted.length - 1] ?? null,
    volume: round2(rows.reduce((sum, row) => sum + row.stake, 0)),
    avgShare: rows.length ? round2(net / rows.length) : 0,
    pools: [...byPool.entries()]
      .map(([code, bucket]) => ({ code, ...bucket }))
      .sort((a, b) => b.net - a.net),
  };
}

export interface PaymentTotals {
  deposits: number;
  depositFees: number;
  payouts: number;
  payoutFees: number;
  refunds: number;
  inFlight: number;
  net: number;
  count: number;
}

export function paymentTotals(rows: readonly PaymentAlertRow[]): PaymentTotals {
  const deposits = rows.filter((row) => row.kind.startsWith("deposit"));
  const payouts = rows.filter((row) =>
    ["payout_requested", "payout_completed", "payout_failed"].includes(row.kind),
  );
  const refunds = rows.filter((row) => row.kind === "refund");
  return {
    deposits: round2(deposits.reduce((sum, row) => sum + row.gross, 0)),
    depositFees: round2(deposits.reduce((sum, row) => sum + row.fee, 0)),
    payouts: round2(payouts.reduce((sum, row) => sum + row.gross, 0)),
    payoutFees: round2(payouts.reduce((sum, row) => sum + row.fee, 0)),
    refunds: round2(refunds.reduce((sum, row) => sum + row.gross, 0)),
    inFlight: round2(
      rows
        .filter((row) => row.status === "processing" || row.status === "pending")
        .reduce((sum, row) => sum + row.net, 0),
    ),
    net: round2(
      deposits.reduce((sum, row) => sum + row.gross, 0) -
        payouts.reduce((sum, row) => sum + row.gross, 0),
    ),
    count: rows.length,
  };
}

export interface SecurityPosture {
  logins: number;
  failed: number;
  devices: number;
  trusted: number;
  twoFactorPct: number;
  lastLoginAt: string | null;
  passwordAgeDays: number;
  kycLevel: string;
  kycVerifiedAt: string | null;
  score: number;
  checks: { label: string; ok: boolean; detail: string }[];
}

export function securityPosture(
  rows: readonly SecurityRow[],
  sessions: readonly ActiveSession[],
  profile: NotificationWorkspace["profile"],
): SecurityPosture {
  const logins = rows.filter((row) => row.kind === "login");
  const failed = rows.filter((row) => row.status === "blocked").length;
  const password = rows.find((row) => row.kind === "password");
  const passwordAgeDays = password
    ? Math.floor(
        (new Date(NOTIFICATIONS_AS_OF).getTime() -
          new Date(password.at).getTime()) /
          86_400_000,
      )
    : 365;
  const trusted = sessions.filter((row) => row.trusted).length;
  const twoFactorPct = logins.length
    ? round2(
        (logins.filter((row) => row.detail.toLowerCase().includes("2fa")).length /
          logins.length) *
          100,
      )
    : 0;
  const checks = [
    {
      label: "Two-factor authentication",
      ok: twoFactorPct >= 100,
      detail: `${pct(twoFactorPct)} of recent sign-ins passed a second factor`,
    },
    {
      label: "Password rotation",
      ok: passwordAgeDays <= 90,
      detail:
        passwordAgeDays <= 90
          ? `Changed ${passwordAgeDays} days ago`
          : `Last changed ${passwordAgeDays} days ago`,
    },
    {
      label: "Trusted devices",
      ok: trusted >= sessions.length,
      detail: `${trusted} of ${sessions.length} sessions are trusted`,
    },
    {
      label: "Identity verification",
      ok: profile.kycLevel !== "L0",
      detail: `${profile.kycLevel} verified`,
    },
    {
      label: "Blocked sign-in attempts",
      ok: failed === 0,
      detail:
        failed === 0
          ? "None in the last 30 days"
          : `${failed} attempt(s) blocked · nothing was accessed`,
    },
  ];
  const passed = checks.filter((check) => check.ok).length;
  return {
    logins: logins.length,
    failed,
    devices: sessions.length,
    trusted,
    twoFactorPct,
    lastLoginAt: logins[0]?.at ?? null,
    passwordAgeDays,
    kycLevel: profile.kycLevel,
    kycVerifiedAt:
      rows.find((row) => row.kind === "kyc" && row.status === "approved")?.at ?? null,
    score: Math.round((passed / checks.length) * 100),
    checks,
  };
}

export const channelCount = (matrix: ChannelMatrix) =>
  [matrix.inApp, matrix.email, matrix.push, matrix.sms].filter(Boolean).length;

export const enabledCategories = (prefs: NotificationPreferences) =>
  (Object.keys(prefs.channels) as NotificationCategory[]).filter(
    (category) => channelCount(prefs.channels[category]) > 0,
  );

/* ── Export helpers ── */

export type ExportCell = string | number;

export function exportMatrix(
  workspace: NotificationWorkspace,
  scope: ExportScope,
): { title: string; header: string[]; rows: ExportCell[][] } {
  if (scope === "trade") {
    return {
      title: "Trade activity",
      header: ["Closed at", "Pool", "Symbol", "Result", "Stake", "Your share"],
      rows: workspace.tradeActivity.map((row) => [
        row.at,
        row.poolCode,
        row.symbol,
        row.result,
        row.stake,
        row.yourShareNet,
      ]),
    };
  }
  if (scope === "pool") {
    return {
      title: "Pool updates",
      header: ["At", "Pool", "Event", "Detail"],
      rows: workspace.poolUpdates.map((row) => [
        row.at,
        row.poolCode ?? "—",
        poolUpdateLabel(row.kind),
        row.detail,
      ]),
    };
  }
  if (scope === "payment") {
    return {
      title: "Payment alerts",
      header: ["At", "Type", "Reference", "Gross", "Fee", "Net", "Status"],
      rows: workspace.paymentAlerts.map((row) => [
        row.at,
        paymentAlertLabel(row.kind),
        row.reference,
        row.gross,
        row.fee,
        row.net,
        row.status,
      ]),
    };
  }
  if (scope === "security") {
    return {
      title: "System & security",
      header: ["At", "Event", "Device", "Location", "Status"],
      rows: workspace.securityEvents.map((row) => [
        row.at,
        securityKindLabel(row.kind),
        row.device,
        row.location,
        row.status,
      ]),
    };
  }
  if (scope === "digest") {
    const summary = inboxSummary(workspace);
    return {
      title: "Notification digest",
      header: ["Channel", "Category", "Enabled", "Digest"],
      rows: (
        Object.keys(workspace.preferences.channels) as NotificationCategory[]
      ).flatMap((category) =>
        (
          Object.keys(workspace.preferences.channels[category]) as DeliveryChannel[]
        ).map((channel) => [
          channelLabel(channel),
          categoryLabel(category),
          workspace.preferences.channels[category][channel] ? "yes" : "no",
          `${workspace.preferences.digest} · ${summary.unread} unread`,
        ]),
      ),
    };
  }
  return {
    title: "Inbox",
    header: ["At", "Category", "Level", "Title", "Read", "Pool"],
    rows: workspace.notifications.map((row) => [
      row.at,
      categoryLabel(row.category),
      row.level,
      row.title,
      row.read ? "read" : "unread",
      row.poolCode ?? "—",
    ]),
  };
}

export const csvOf = (matrix: { header: string[]; rows: ExportCell[][] }) =>
  [matrix.header, ...matrix.rows]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\n");

/* ── Draft validation ── */

export function preferencesDraftError(input: {
  preferences: NotificationPreferences;
  silentCategories: NotificationCategory[];
}): string {
  const enabled = enabledCategories(input.preferences);
  if (!enabled.length)
    return "Keep at least one category on at least one channel — otherwise the desk cannot reach you";
  if (input.silentCategories.length >= 4)
    return "Every category is muted — unmute one to keep the inbox useful";
  if (!input.preferences.channels.security.inApp)
    return "Security alerts must stay on in-app; they cannot be muted";
  if (
    input.preferences.quietHours.enabled &&
    input.preferences.quietHours.from === input.preferences.quietHours.to
  )
    return "Quiet hours start and end at the same time";
  if (input.preferences.minTradeAmount < 0)
    return "The trade threshold cannot be negative";
  if (input.preferences.minTradeAmount > 500)
    return "Thresholds above $500 would hide most trade alerts";
  if (input.preferences.digestHour < 0 || input.preferences.digestHour > 23)
    return "Digest hour must be between 00:00 and 23:00";
  return "";
}

export function supportDraftError(input: {
  topic: SupportTopic;
  message: string;
}): string {
  if (input.message.trim().length < 12)
    return "Write at least 12 characters so the desk can act on it";
  if (input.message.length > 1000) return "Keep the message under 1000 characters";
  if (input.topic === "missing" && input.message.trim().length < 20)
    return "Tell us which notification is missing (pool, date or reference)";
  return "";
}

export function muteDraftError(input: {
  category: NotificationCategory;
  duration: MuteDuration;
}): string {
  if (input.category === "security")
    return "Security alerts cannot be muted — they are the account's audit trail";
  return "";
}

/* ── Commands ── */

const categoryEnum = z.enum(["trade", "pool", "payment", "security"]);
const channelEnum = z.enum(["inApp", "email", "push", "sms"]);

const channelMatrixSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean(),
});

export const notificationCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("markRead"), id: z.string().min(3).max(60) }),
  z.object({ kind: z.literal("markUnread"), id: z.string().min(3).max(60) }),
  z.object({
    kind: z.literal("markAllRead"),
    category: z.enum(["all", "trade", "pool", "payment", "security"]).default("all"),
  }),
  z.object({ kind: z.literal("togglePin"), id: z.string().min(3).max(60) }),
  z.object({
    kind: z.literal("snooze"),
    id: z.string().min(3).max(60),
    duration: z.enum(["1h", "8h", "24h", "forever"]),
  }),
  z.object({ kind: z.literal("unsnooze"), id: z.string().min(3).max(60) }),
  z.object({ kind: z.literal("deleteNotification"), id: z.string().min(3).max(60) }),
  z.object({
    kind: z.literal("savePreferences"),
    channels: z.record(categoryEnum, channelMatrixSchema),
    digest: z.enum(["realtime", "hourly", "daily", "weekly"]),
    digestHour: z.number().int().min(0).max(23),
    quietHours: z.object({
      enabled: z.boolean(),
      from: z.string().regex(/^\d{2}:\d{2}$/),
      to: z.string().regex(/^\d{2}:\d{2}$/),
    }),
    minTradeAmount: z.number().min(0).max(500),
    guardianAlerts: z.boolean(),
    poolStatusAlerts: z.boolean(),
    sound: z.boolean(),
    desktopPush: z.boolean(),
    weeklySummary: z.boolean(),
  }),
  z.object({ kind: z.literal("toggleRule"), ruleId: z.string().min(3).max(60) }),
  z.object({
    kind: z.literal("addRule"),
    label: z.string().trim().min(4).max(60),
    category: categoryEnum,
    action: z.enum(["mute", "digest", "pin", "alert"]),
  }),
  z.object({ kind: z.literal("deleteRule"), ruleId: z.string().min(3).max(60) }),
  z.object({ kind: z.literal("revokeSession"), sessionId: z.string().min(3).max(60) }),
  z.object({
    kind: z.literal("exportReport"),
    scope: z.enum(["inbox", "trade", "pool", "payment", "security", "digest"]),
    format: z.enum(["pdf", "csv", "json"]),
    count: z.number().int().min(0).max(500),
  }),
  z.object({
    kind: z.literal("acknowledge"),
    scope: z.enum(["delivery", "security", "quietHours"]),
  }),
  z.object({
    kind: z.literal("support"),
    topic: z.enum(["delivery", "missing", "security", "mute", "other"]),
    message: z.string().trim().min(12).max(1000),
  }),
  z.object({ kind: z.literal("resetInbox") }),
]);

export type NotificationCommand = z.infer<typeof notificationCommandSchema>;

const cloneWorkspace = (workspace: NotificationWorkspace): NotificationWorkspace =>
  JSON.parse(JSON.stringify(workspace)) as NotificationWorkspace;

const audit = (
  workspace: NotificationWorkspace,
  action: string,
  detail: string,
) => {
  workspace.audit = [
    {
      id: `ntf_audit_${workspace.revision + 1}_${workspace.audit.length + 1}`,
      at: workspace.asOf,
      action,
      detail,
    },
    ...workspace.audit,
  ].slice(0, 24);
};

const bump = (workspace: NotificationWorkspace) => {
  workspace.revision += 1;
  return workspace;
};

const snoozeUntil = (asOf: string, duration: MuteDuration) => {
  if (duration === "forever") return null;
  const hours = duration === "1h" ? 1 : duration === "8h" ? 8 : 24;
  return new Date(new Date(asOf).getTime() + hours * 3600_000).toISOString();
};

export function applyNotificationCommand(
  workspace: NotificationWorkspace,
  command: NotificationCommand,
): NotificationWorkspace {
  const parsed = notificationCommandSchema.parse(command);
  const next = cloneWorkspace(workspace);

  switch (parsed.kind) {
    case "markRead": {
      const row = next.notifications.find((item) => item.id === parsed.id);
      if (!row) throw new Error("That notification is no longer in the inbox");
      if (row.read) throw new Error("That notification is already read");
      row.read = true;
      audit(next, "notification_read", row.title);
      return bump(next);
    }
    case "markUnread": {
      const row = next.notifications.find((item) => item.id === parsed.id);
      if (!row) throw new Error("That notification is no longer in the inbox");
      if (!row.read) throw new Error("That notification is already unread");
      row.read = false;
      audit(next, "notification_unread", row.title);
      return bump(next);
    }
    case "markAllRead": {
      const scope =
        parsed.category === "all"
          ? next.notifications
          : next.notifications.filter((row) => row.category === parsed.category);
      const unread = scope.filter((row) => !row.read);
      if (!unread.length)
        throw new Error(
          parsed.category === "all"
            ? "Nothing left to read — the inbox is already clear"
            : `No unread ${categoryLabel(parsed.category).toLowerCase()} notifications`,
        );
      for (const row of unread) row.read = true;
      audit(
        next,
        "inbox_marked_read",
        `${unread.length} notification${unread.length === 1 ? "" : "s"} marked read${
          parsed.category === "all" ? "" : ` in ${categoryLabel(parsed.category)}`
        }`,
      );
      return bump(next);
    }
    case "togglePin": {
      const row = next.notifications.find((item) => item.id === parsed.id);
      if (!row) throw new Error("That notification is no longer in the inbox");
      row.pinned = !row.pinned;
      audit(next, row.pinned ? "notification_pinned" : "notification_unpinned", row.title);
      return bump(next);
    }
    case "snooze": {
      const row = next.notifications.find((item) => item.id === parsed.id);
      if (!row) throw new Error("That notification is no longer in the inbox");
      if (row.category === "security")
        throw new Error("Security alerts cannot be snoozed");
      const until = snoozeUntil(next.asOf, parsed.duration);
      row.snoozedUntil = until;
      audit(
        next,
        "notification_snoozed",
        `${row.title} · ${parsed.duration === "forever" ? "until further notice" : `until ${until ? clockOf(until).slice(0, 5) : ""} UTC`}`,
      );
      return bump(next);
    }
    case "unsnooze": {
      const row = next.notifications.find((item) => item.id === parsed.id);
      if (!row) throw new Error("That notification is no longer in the inbox");
      if (!row.snoozedUntil) throw new Error("That notification is not snoozed");
      row.snoozedUntil = null;
      audit(next, "notification_woken", row.title);
      return bump(next);
    }
    case "deleteNotification": {
      const before = next.notifications.length;
      next.notifications = next.notifications.filter((row) => row.id !== parsed.id);
      if (next.notifications.length === before)
        throw new Error("That notification is no longer in the inbox");
      audit(next, "notification_deleted", parsed.id);
      return bump(next);
    }
    case "savePreferences": {
      next.preferences = {
        channels: parsed.channels,
        digest: parsed.digest,
        digestHour: parsed.digestHour,
        quietHours: parsed.quietHours,
        minTradeAmount: parsed.minTradeAmount,
        guardianAlerts: parsed.guardianAlerts,
        poolStatusAlerts: parsed.poolStatusAlerts,
        sound: parsed.sound,
        desktopPush: parsed.desktopPush,
        weeklySummary: parsed.weeklySummary,
      };
      if (!next.preferences.channels.security.inApp)
        throw new Error("Security alerts must stay on in-app");
      audit(
        next,
        "preferences_saved",
        `${parsed.digest} digest · ${parsed.quietHours.enabled ? `quiet ${parsed.quietHours.from}–${parsed.quietHours.to}` : "no quiet hours"} · trade floor ${money(parsed.minTradeAmount)}`,
      );
      return bump(next);
    }
    case "toggleRule": {
      const rule = next.rules.find((item) => item.id === parsed.ruleId);
      if (!rule) throw new Error("That rule no longer exists");
      rule.enabled = !rule.enabled;
      audit(next, rule.enabled ? "rule_enabled" : "rule_disabled", rule.label);
      return bump(next);
    }
    case "addRule": {
      if (next.rules.length >= MAX_RULES)
        throw new Error(`${MAX_RULES} rules is the limit — delete one first`);
      next.rules = [
        ...next.rules,
        {
          id: `rule_${next.revision + 1}_${next.rules.length + 1}`,
          label: parsed.label,
          detail: `${categoryLabel(parsed.category)} · ${
            parsed.action === "mute"
              ? "muted"
              : parsed.action === "digest"
                ? "rolled into the digest"
                : parsed.action === "pin"
                  ? "pinned to the top"
                  : "alerted immediately"
          }`,
          category: parsed.category,
          action: parsed.action,
          enabled: true,
        },
      ];
      audit(next, "rule_added", parsed.label);
      return bump(next);
    }
    case "deleteRule": {
      const before = next.rules.length;
      next.rules = next.rules.filter((item) => item.id !== parsed.ruleId);
      if (next.rules.length === before) throw new Error("That rule no longer exists");
      audit(next, "rule_deleted", parsed.ruleId);
      return bump(next);
    }
    case "revokeSession": {
      const session = next.sessions.find((item) => item.id === parsed.sessionId);
      if (!session) throw new Error("That session is already closed");
      if (session.current)
        throw new Error("This is the session you are using — sign out instead");
      next.sessions = next.sessions.filter((item) => item.id !== parsed.sessionId);
      audit(next, "session_revoked", `${session.device} · ${session.location}`);
      return bump(next);
    }
    case "exportReport": {
      next.exports = [
        {
          id: `ntf_exp_${next.revision + 1}_${next.exports.length + 1}`,
          scope: parsed.scope,
          format: parsed.format,
          count: parsed.count,
          createdAt: next.asOf,
        },
        ...next.exports,
      ].slice(0, MAX_EXPORTS);
      audit(
        next,
        "export_generated",
        `${parsed.scope} · ${parsed.format.toUpperCase()} · ${parsed.count} rows`,
      );
      return bump(next);
    }
    case "acknowledge": {
      audit(next, "acknowledged", `Delivery disclosure acknowledged · ${parsed.scope}`);
      return bump(next);
    }
    case "support": {
      if (next.support.length >= MAX_SUPPORT_DRAFTS)
        throw new Error("That is a lot of drafts — the desk will reply to the last one first");
      next.support = [
        {
          id: `ntf_sup_${next.revision + 1}_${next.support.length + 1}`,
          topic: parsed.topic,
          message: parsed.message,
          status: "local_draft" as const,
          createdAt: next.asOf,
        },
        ...next.support,
      ].slice(0, MAX_SUPPORT_DRAFTS);
      audit(next, "support_drafted", `${parsed.topic} · ${parsed.message.slice(0, 60)}`);
      return bump(next);
    }
    case "resetInbox": {
      next.notifications = next.notifications.map((row) => ({
        ...row,
        read: false,
        pinned: false,
        snoozedUntil: null,
      }));
      audit(next, "inbox_reset", "Read state, pins and snoozes cleared");
      return bump(next);
    }
    default:
      return next;
  }
}

/* ── Fallback defaults (used when a snapshot is missing a field) ── */

export const DEFAULT_FILTERS: NotificationFilters = {
  category: "all",
  unreadOnly: false,
  pinnedOnly: false,
  range: "all",
  query: "",
  sort: "newest",
};

export function emptyPreferences(): NotificationPreferences {
  const all = { inApp: true, email: true, push: false, sms: false };
  return {
    channels: {
      trade: { ...all },
      pool: { ...all },
      payment: { ...all, push: true },
      security: { ...all, push: true },
    },
    digest: "daily",
    digestHour: 9,
    quietHours: { enabled: true, from: "22:00", to: "07:00" },
    minTradeAmount: 5,
    guardianAlerts: true,
    poolStatusAlerts: true,
    sound: false,
    desktopPush: true,
    weeklySummary: true,
  };
}
