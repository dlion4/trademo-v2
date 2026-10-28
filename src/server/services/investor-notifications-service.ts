/**
 * I-9 · Notifications & Activity — the demo snapshot.
 *
 * Nothing on `/investor/notifications` is authored twice. The trade ledger is
 * the I-5 feed, the pool ledger is the I-6 timeline plus the I-5 Guardian
 * alerts, the payment ledger is the I-7 cash statement, and the security ledger
 * is this account's own sign-in record. The inbox then *cites* those rows, so
 * "Trade won +$8.40 on PKG-01" opens a trade that really exists on the live
 * tracker and the payout shown here is the payout the wallet is still holding.
 */

import { getInvestmentsWorkspace } from "./investor-investments-service";
import { getLiveTradeWorkspace } from "./investor-live-service";
import { getPoolsWorkspace } from "./investor-pools-service";
import { getWalletWorkspace } from "./investor-wallet-service";
import {
  NOTIFICATIONS_AS_OF,
  emptyPreferences,
  round2,
  type ActiveSession,
  type DeliveryRow,
  type InboxRule,
  type InvestorNotification,
  type NotificationWorkspace,
  type PaymentAlertRow,
  type PaymentAlertKind,
  type PoolUpdateKind,
  type PoolUpdateRow,
  type SecurityRow,
  type TradeActivityRow,
} from "@/lib/investor/notifications";

const clk = (iso: string) => iso.slice(11, 16);

export function getNotificationsWorkspace(): NotificationWorkspace {
  const live = getLiveTradeWorkspace();
  const investments = getInvestmentsWorkspace();
  const wallet = getWalletWorkspace();
  const pools = getPoolsWorkspace();

  const asOf = NOTIFICATIONS_AS_OF;

  const poolHref = (poolId: string | null) =>
    poolId ? `/investor/pools/${poolId}` : "/investor/pools";

  /* ── Ledger 1 · trade activity (I-5 feed) ── */

  // The whole session feed, so the table's net matches I-5's session total.
  const tradeActivity: TradeActivityRow[] = live.feed
    .slice()
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt))
    .map((trade) => ({
      id: `ta_${trade.tradeId}`,
      at: trade.soldAt,
      tradeId: trade.tradeId,
      poolId: trade.poolId,
      poolCode: trade.poolCode,
      poolName: trade.poolName,
      symbol: trade.symbol,
      contractLabel: trade.contractLabel,
      result: trade.isWin ? "win" : "loss",
      stake: trade.stake,
      poolProfit: trade.profit,
      yourSharePct: trade.yourSharePct,
      yourShareNet: trade.yourShareNet,
      botName: trade.botName,
      durationSeconds: trade.durationSeconds,
      href: "/investor/live",
    }));

  const trade = tradeActivity[0];
  const tradeLoss = tradeActivity.find((row) => row.result === "loss") ?? trade;

  /* ── Ledger 2 · pool updates (I-5 Guardian + I-6 timeline + pool book) ── */

  const poolUpdates: PoolUpdateRow[] = [];

  for (const alert of live.alerts) {
    const kind: PoolUpdateKind =
      alert.level === "alert"
        ? "guardian_paused"
        : alert.level === "watch"
          ? "guardian_watch"
          : "guardian_cleared";
    poolUpdates.push({
      id: `pu_${alert.id}`,
      at: alert.at,
      kind,
      level: alert.level === "watch" ? "warning" : alert.level === "alert" ? "critical" : "success",
      poolId: alert.poolId,
      poolCode: alert.poolCode,
      title: alert.title,
      detail: alert.detail,
      amount: null,
      status: alert.action,
      href: "/investor/live",
    });
  }

  const timelineKind = (kind: string, title: string): PoolUpdateKind | null => {
    if (kind === "booking") return "booking_confirmed";
    if (kind === "milestone") return "announced";
    if (kind === "interest") return "opened";
    if (kind === "pool")
      return title.toLowerCase().includes("trading started")
        ? "trading_started"
        : "completed";
    return null;
  };

  for (const entry of investments.timeline) {
    const kind = timelineKind(entry.kind, entry.title);
    if (!kind) continue;
    const poolId = entry.poolCode
      ? pools.trading.find((row) => row.code === entry.poolCode)?.id ??
        pools.open.find((row) => row.code === entry.poolCode)?.id ??
        pools.upcoming.find((row) => row.code === entry.poolCode)?.id ??
        pools.completed.find((row) => row.code === entry.poolCode)?.id ??
        null
      : null;
    poolUpdates.push({
      id: `pu_${entry.id}`,
      at: entry.at,
      kind,
      level:
        entry.status === "processing"
          ? "warning"
          : entry.status === "informational"
            ? "info"
            : "success",
      poolId,
      poolCode: entry.poolCode,
      title: entry.title,
      detail: entry.detail,
      amount: entry.amount,
      status: entry.status,
      href: poolId ? poolHref(poolId) : "/investor/investments",
    });
  }

  // Windows that close inside the next week get a closing-soon entry, derived
  // from the pool book rather than authored.
  for (const pool of pools.open) {
    const days = Math.round(
      (new Date(pool.closesAt).getTime() - new Date(asOf).getTime()) / 86_400_000,
    );
    if (days <= 7) {
      poolUpdates.push({
        id: `pu_closing_${pool.id}`,
        at: new Date(new Date(asOf).getTime() - 6 * 3600_000).toISOString(),
        kind: "closing_soon",
        level: days <= 3 ? "warning" : "info",
        poolId: pool.id,
        poolCode: pool.code,
        title: `${pool.code} closes in ${days} day${days === 1 ? "" : "s"}`,
        detail: `${pool.name} still has capacity — ${pool.bookedSlots} of ${pool.maxSlotsPerUser} of your slots are booked. Window closes ${pool.closesAt.slice(0, 10)} at ${clk(pool.closesAt)} UTC.`,
        amount: pool.minSlot,
        status: "open",
        href: poolHref(pool.id),
      });
    }
  }

  poolUpdates.sort((a, b) => b.at.localeCompare(a.at));

  /* ── Ledger 3 · payment & payout alerts (I-7 statement) ── */

  const paymentKind = (type: string, status: string): PaymentAlertKind => {
    if (type === "refund") return "refund";
    if (type === "fee") return "fee_charged";
    if (type === "deposit")
      return status === "pending" ? "deposit_pending" : "deposit_verified";
    if (status === "failed") return "payout_failed";
    if (status === "processing" || status === "pending") return "payout_requested";
    return "payout_completed";
  };

  const paymentAlerts: PaymentAlertRow[] = wallet.transactions
    .filter((row) =>
      ["deposit", "payout", "refund", "fee"].includes(row.type),
    )
    .map((row) => {
      const kind = paymentKind(row.type, row.status);
      const gross = Math.abs(row.amount);
      const fee = row.fee;
      return {
        id: `pa_${row.id}`,
        at: row.at,
        kind,
        level:
          kind === "payout_failed"
            ? "critical"
            : kind === "deposit_pending" || kind === "payout_requested"
              ? "warning"
              : "success",
        methodLabel: row.methodLabel,
        rail: row.method,
        reference: row.reference,
        gross: round2(gross),
        fee: round2(fee),
        net: round2(gross - fee),
        status: row.status,
        poolCode: row.poolCode,
        detail: row.description,
        href: "/investor/wallet",
      } satisfies PaymentAlertRow;
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  const processingPayout = wallet.payouts.find((row) => row.status === "processing");
  const lastPaid = wallet.payouts.find((row) => row.status === "completed");
  const lastDeposit = wallet.transactions
    .filter((row) => row.type === "deposit" && row.status === "completed")
    .slice(-1)[0];

  /* ── Ledger 4 · system & security ── */

  const securityEvents: SecurityRow[] = [
    {
      id: "sec_01",
      at: "2026-10-22T09:12:00Z",
      kind: "login",
      level: "info",
      title: "Sign-in from Nairobi, KE",
      detail: "Chrome 141 on macOS · 2FA passed with the authenticator app",
      device: "Chrome 141 · macOS 15",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      status: "verified",
    },
    {
      id: "sec_02",
      at: "2026-10-21T07:45:00Z",
      kind: "session",
      level: "info",
      title: "Session token rotated",
      detail: "The desk rotated the session after 24 hours, as scheduled",
      device: "Chrome 141 · macOS 15",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      status: "rotated",
    },
    {
      id: "sec_03",
      at: "2026-10-19T09:00:00Z",
      kind: "kyc",
      level: "success",
      title: "KYC Level 2 approved",
      detail:
        "Identity and address checks cleared by the compliance desk. Interim payout ceiling is now $10,000 per request.",
      device: "Compliance desk",
      location: "Nairobi, KE",
      ip: "—",
      status: "approved",
    },
    {
      id: "sec_04",
      at: "2026-10-18T13:55:00Z",
      kind: "login",
      level: "success",
      title: "Sign-in from Nairobi, KE",
      detail: "Chrome 141 on macOS · 2FA passed · device already trusted",
      device: "Chrome 141 · macOS 15",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      status: "verified",
    },
    {
      id: "sec_05",
      at: "2026-10-18T13:55:00Z",
      kind: "twofa",
      level: "success",
      title: "2FA challenge passed",
      detail: "One-time code accepted from the registered authenticator",
      device: "Authenticator app",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      status: "verified",
    },
    {
      id: "sec_06",
      at: "2026-10-18T13:54:00Z",
      kind: "device",
      level: "info",
      title: "New device trusted",
      detail: "This browser was added to the trusted list after a 2FA challenge",
      device: "Chrome 141 · macOS 15",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      status: "trusted",
    },
    {
      id: "sec_07",
      at: "2026-10-15T08:20:00Z",
      kind: "session",
      level: "warning",
      title: "Session revoked · Firefox on Windows",
      detail: "You revoked a session from Mombasa after it had been idle for six days",
      device: "Firefox 143 · Windows 11",
      location: "Mombasa, KE",
      ip: "197.232.•••.•••",
      status: "revoked",
    },
    {
      id: "sec_08",
      at: "2026-10-12T10:30:00Z",
      kind: "password",
      level: "success",
      title: "Password changed",
      detail: "Password rotated from the security settings · all other sessions kept",
      device: "Chrome 141 · macOS 15",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      status: "changed",
    },
    {
      id: "sec_09",
      at: "2026-10-12T10:30:00Z",
      kind: "profile",
      level: "info",
      title: "Profile updated · phone number",
      detail: "Contact number changed from +254 7•• ••• 118 to +254 7•• ••• 421",
      device: "Chrome 141 · macOS 15",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      status: "changed",
    },
    {
      id: "sec_10",
      at: "2026-09-16T11:19:00Z",
      kind: "login",
      level: "warning",
      title: "Sign-in attempt blocked",
      detail:
        "A password attempt from an unrecognised device was blocked before a 2FA challenge was issued",
      device: "Unknown device",
      location: "Lagos, NG",
      ip: "105.112.•••.•••",
      status: "blocked",
    },
    {
      id: "sec_11",
      at: "2026-09-12T14:00:00Z",
      kind: "kyc",
      level: "success",
      title: "Account opened · KYC Level 1",
      detail: "Identity accepted at onboarding; Level 2 followed on 19 Oct",
      device: "Compliance desk",
      location: "Nairobi, KE",
      ip: "—",
      status: "approved",
    },
  ];

  const sessions: ActiveSession[] = [
    {
      id: "ses_current",
      device: "MacBook Pro · Chrome 141",
      browser: "Chrome 141",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      lastSeenAt: asOf,
      current: true,
      trusted: true,
    },
    {
      id: "ses_phone",
      device: "iPhone 15 · Safari",
      browser: "Safari 18",
      location: "Nairobi, KE",
      ip: "41.90.•••.•••",
      lastSeenAt: "2026-10-23T06:40:00Z",
      current: false,
      trusted: true,
    },
    {
      id: "ses_old",
      device: "ThinkPad · Firefox 143",
      browser: "Firefox 143",
      location: "Mombasa, KE",
      ip: "197.232.•••.•••",
      lastSeenAt: "2026-10-09T18:05:00Z",
      current: false,
      trusted: false,
    },
  ];

  /* ── Inbox rows (cite the four ledgers) ── */

  const notifications: InvestorNotification[] = [
    {
      id: "ntf_trade_win",
      at: trade?.at ?? "2026-10-18T14:23:47Z",
      category: "trade",
      level: "success",
      title: `Trade won ${trade ? `+$${trade.yourShareNet.toFixed(2)}` : "+$8.40"} on ${trade?.poolCode ?? "PKG-01"}`,
      detail: trade
        ? `${trade.botName} · ${trade.symbol} · ${trade.contractLabel} · ${trade.yourSharePct}% of a ${trade.poolProfit >= 0 ? "+" : "−"}$${Math.abs(trade.poolProfit).toFixed(2)} pool result.`
        : "Bot-Alpha · R_10 · Rise · 5 ticks.",
      amount: trade?.yourShareNet ?? 8.4,
      read: false,
      pinned: true,
      snoozedUntil: null,
      poolId: trade?.poolId ?? null,
      poolCode: trade?.poolCode ?? null,
      href: "/investor/live",
      openLabel: "Live tracker",
      delivered: ["inApp", "email", "push"],
      source: "Trade feed",
    },
    {
      id: "ntf_guardian",
      at: live.alerts[0]?.at ?? "2026-10-18T14:19:52Z",
      category: "pool",
      level: "warning",
      title: live.alerts[0]?.title ?? "AI Guardian paused PKG-03",
      detail:
        live.alerts[0]?.detail ??
        "The Guardian paused execution while stake sizing resets.",
      amount: null,
      read: false,
      pinned: false,
      snoozedUntil: null,
      poolId: live.alerts[0]?.poolId ?? null,
      poolCode: live.alerts[0]?.poolCode ?? null,
      href: "/investor/live",
      openLabel: "View details",
      delivered: ["inApp", "email", "push", "sms"],
      source: "AI Guardian",
    },
    {
      id: "ntf_daily",
      at: "2026-10-18T09:00:00Z",
      category: "trade",
      level: "info",
      title: `Daily summary: your pools earned +$${live.stats.yourShare.toFixed(2)} today`,
      detail: `${live.stats.trades} trades closed · ${live.stats.wins} wins and ${live.stats.losses} losses · ${live.stats.winRatePct.toFixed(1)}% win rate across ${live.totals.poolCount} trading pools.`,
      amount: live.stats.yourShare,
      read: false,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: null,
      href: "/investor/investments",
      openLabel: "My investments",
      delivered: ["inApp", "email"],
      source: "Daily digest",
    },
    {
      id: "ntf_payout_processing",
      at: processingPayout?.requestedAt ?? "2026-10-17T22:00:00Z",
      category: "payment",
      level: "warning",
      title: `Payout processing: $${(processingPayout?.gross ?? 120).toFixed(2)} to ${processingPayout?.destination ?? "Equity Bank ·•••• 8842"}`,
      detail: `Reference ${processingPayout?.reference ?? "PO-2026-10-17-0052"} · fee $${(processingPayout?.fee ?? 1.5).toFixed(2)} · net $${(processingPayout?.net ?? 118.5).toFixed(2)}. Clears in the 17:00 UTC batch.`,
      amount: processingPayout?.gross ?? 120,
      read: false,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: processingPayout?.poolCode ?? "PKG-01",
      href: "/investor/wallet",
      openLabel: "Open wallet",
      delivered: ["inApp", "email", "push", "sms"],
      source: "Payout desk",
    },
    {
      id: "ntf_deposit_oct",
      at: "2026-10-19T00:40:00Z",
      category: "payment",
      level: "success",
      title: `Deposit confirmed: $${(lastDeposit?.amount ?? 5524).toLocaleString("en-US", { minimumFractionDigits: 0 })} by bank transfer`,
      detail: `Reference ${lastDeposit?.reference ?? "dep_b1c4"} · ${lastDeposit?.methodLabel ?? "Equity Bank ·•••• 8842"} · cleared and ready to book.`,
      amount: lastDeposit?.amount ?? 5524,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: null,
      href: "/investor/wallet",
      openLabel: "Open wallet",
      delivered: ["inApp", "email"],
      source: "Cash ledger",
    },
    {
      id: "ntf_login",
      at: "2026-10-18T13:55:00Z",
      category: "security",
      level: "success",
      title: "Sign-in from 41.90.•••.••• (Chrome, 2FA passed)",
      detail:
        "Nairobi, KE · Chrome 141 on macOS 15 · trusted device. If this was not you, revoke the session and rotate the password.",
      amount: null,
      read: false,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: null,
      href: "/investor/notifications?action=securityPosture",
      openLabel: "Security centre",
      delivered: ["inApp", "email"],
      source: "Account security",
    },
    {
      id: "ntf_guardian_watch",
      at: live.alerts[1]?.at ?? "2026-10-18T12:41:10Z",
      category: "pool",
      level: "warning",
      title: live.alerts[1]?.title ?? "Volatility band widened on R_75",
      detail: live.alerts[1]?.detail ?? "Stake size stays at the pool minimum.",
      amount: null,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: live.alerts[1]?.poolId ?? null,
      poolCode: live.alerts[1]?.poolCode ?? null,
      href: "/investor/live",
      openLabel: "Live tracker",
      delivered: ["inApp", "email"],
      source: "AI Guardian",
    },
    {
      id: "ntf_guardian_cleared",
      at: live.alerts[2]?.at ?? "2026-10-18T09:12:00Z",
      category: "pool",
      level: "success",
      title: live.alerts[2]?.title ?? "Loss streak cleared on Bot-Alpha",
      detail: live.alerts[2]?.detail ?? "Drawdown back inside the limit.",
      amount: null,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: live.alerts[2]?.poolId ?? null,
      poolCode: live.alerts[2]?.poolCode ?? null,
      href: "/investor/live",
      openLabel: "Live tracker",
      delivered: ["inApp"],
      source: "AI Guardian",
    },
    {
      id: "ntf_payout_paid",
      at: lastPaid?.requestedAt ?? "2026-10-22T08:05:00Z",
      category: "payment",
      level: "success",
      title: `Payout completed: $${(lastPaid?.gross ?? 849.6).toFixed(2)} (${lastPaid?.poolCode ?? "PKG-06"} settlement)`,
      detail: `Reference ${lastPaid?.reference ?? "PO-2026-10-22-0047"} · ${lastPaid?.destination ?? "Equity Bank ·•••• 8842"} · settlement payouts are fee-waived.`,
      amount: lastPaid?.gross ?? 849.6,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: lastPaid?.poolCode ?? "PKG-06",
      href: "/investor/wallet",
      openLabel: "Open wallet",
      delivered: ["inApp", "email", "sms"],
      source: "Payout desk",
    },
    {
      id: "ntf_closing_02",
      at: "2026-10-23T08:00:00Z",
      category: "pool",
      level: "warning",
      title: "PKG-02 Premium Yield closes in 2 days",
      detail:
        "$28,000 of the $80,000 goal is funded and the window shuts 25 Oct at 18:00 UTC. Two of your slots are already booked and funded.",
      amount: null,
      read: false,
      pinned: false,
      snoozedUntil: null,
      poolId: "pkg_02",
      poolCode: "PKG-02",
      href: "/investor/pools/pkg_02",
      openLabel: "View pool",
      delivered: ["inApp", "email", "push"],
      source: "Pool desk",
    },
    {
      id: "ntf_booking_09",
      at: "2026-10-22T11:12:00Z",
      category: "pool",
      level: "warning",
      title: "Booking confirmed on PKG-09 · payment verifying",
      detail:
        "1 slot · $2,500 · card •••• 3319. The slot is held while the card verification clears.",
      amount: 2500,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: "pkg_09",
      poolCode: "PKG-09",
      href: "/investor/pools/pkg_09",
      openLabel: "View pool",
      delivered: ["inApp", "email", "push"],
      source: "Pool desk",
    },
    {
      id: "ntf_pool_completed",
      at: "2026-10-21T17:00:00Z",
      category: "pool",
      level: "success",
      title: "PKG-06 Steady Income completed · net +$849.60",
      detail:
        "Cycle closed and reconciled · 4 slots · the earnings were credited to the wallet and paid out the next morning.",
      amount: 849.6,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: "PKG-06",
      href: "/investor/investments",
      openLabel: "My investments",
      delivered: ["inApp", "email"],
      source: "Pool desk",
    },
    {
      id: "ntf_pool_announced",
      at: "2026-10-21T12:15:00Z",
      category: "pool",
      level: "info",
      title: "PKG-05 Basic Growth v2 announced",
      detail:
        "Booking opens 28 Oct at 12:00 UTC · $3,000 per slot · 14-day window · expected 15%. Model it before the window opens.",
      amount: 3000,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: "pkg_05",
      poolCode: "PKG-05",
      href: "/investor/calculator",
      openLabel: "Model it",
      delivered: ["inApp", "email"],
      source: "Pool desk",
    },
    {
      id: "ntf_booking_02",
      at: "2026-10-19T00:40:00Z",
      category: "pool",
      level: "success",
      title: "Booking confirmed on PKG-02 · 2 slots funded",
      detail:
        "2 slots · $10,000 · bank transfer verified · trading starts when the window closes on 25 Oct.",
      amount: 10000,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: "pkg_02",
      poolCode: "PKG-02",
      href: "/investor/pools/pkg_02",
      openLabel: "View pool",
      delivered: ["inApp", "email", "sms"],
      source: "Pool desk",
    },
    {
      id: "ntf_kyc",
      at: "2026-10-19T09:00:00Z",
      category: "security",
      level: "success",
      title: "KYC Level 2 approved",
      detail:
        "Identity and address checks cleared · interim payout ceiling $10,000 · Level 3 unlocks institutional limits.",
      amount: null,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: null,
      href: "/investor/notifications?action=securityPosture",
      openLabel: "Security centre",
      delivered: ["inApp", "email"],
      source: "Compliance",
    },
    {
      id: "ntf_trading_started",
      at: "2026-10-15T09:00:00Z",
      category: "pool",
      level: "success",
      title: "PKG-01 Basic Growth trading started",
      detail:
        "The window closed at its goal and the bots opened their first positions. Live results land in the trade ledger.",
      amount: null,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: "pkg_01",
      poolCode: "PKG-01",
      href: "/investor/pools/pkg_01",
      openLabel: "View pool",
      delivered: ["inApp", "email"],
      source: "Pool desk",
    },
    {
      id: "ntf_payout_oct11",
      at: "2026-10-11T14:30:00Z",
      category: "payment",
      level: "success",
      title: "Payout completed: $1,180.80 (PKG-00 settlement)",
      detail:
        "Reference PO-2026-10-11-0031 · Equity Bank ·•••• 8842 · arrived the same afternoon.",
      amount: 1180.8,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: "PKG-00",
      href: "/investor/wallet",
      openLabel: "Open wallet",
      delivered: ["inApp", "email", "sms"],
      source: "Payout desk",
    },
    {
      id: "ntf_deposit_oct05",
      at: "2026-10-05T11:08:00Z",
      category: "payment",
      level: "success",
      title: "Deposit verified: $10,000.00 (USDT · TRC-20)",
      detail:
        "Reference dep_d4e2 · network fee $2.20 · credited instantly and booked into PKG-03 two minutes later.",
      amount: 10000,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: "PKG-03",
      href: "/investor/wallet",
      openLabel: "Open wallet",
      delivered: ["inApp", "email"],
      source: "Cash ledger",
    },
    {
      id: "ntf_profile",
      at: "2026-10-12T10:30:00Z",
      category: "security",
      level: "info",
      title: "Profile updated · phone number changed",
      detail:
        "Contact number changed from +254 7•• ••• 118 to +254 7•• ••• 421 · password rotated in the same session.",
      amount: null,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: null,
      href: "/investor/notifications?action=securityPosture",
      openLabel: "Security centre",
      delivered: ["inApp", "email", "sms"],
      source: "Account security",
    },
    {
      id: "ntf_deposit_oct02",
      at: "2026-10-02T14:20:00Z",
      category: "payment",
      level: "success",
      title: "Deposit verified: $15,000.00 (bank transfer)",
      detail:
        "Reference dep_8f2a · no platform fee · funded the PKG-01 booking two minutes later.",
      amount: 15000,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: "PKG-01",
      href: "/investor/wallet",
      openLabel: "Open wallet",
      delivered: ["inApp", "email"],
      source: "Cash ledger",
    },
    {
      id: "ntf_payout_failed",
      at: "2026-09-16T11:20:00Z",
      category: "payment",
      level: "critical",
      title: "Payout failed: $500.00 rejected by the bank",
      detail:
        "Account name mismatch · the money was returned to the wallet within two minutes and the bank charged a $12.00 return fee.",
      amount: 500,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: null,
      href: "/investor/wallet",
      openLabel: "Open wallet",
      delivered: ["inApp", "email", "sms"],
      source: "Payout desk",
    },
    {
      id: "ntf_trade_loss",
      at: tradeLoss?.at ?? "2026-10-18T14:18:00Z",
      category: "trade",
      level: "info",
      title: `Trade lost ${tradeLoss ? `−$${Math.abs(tradeLoss.yourShareNet).toFixed(2)}` : "−$10.50"} on ${tradeLoss?.poolCode ?? "PKG-01"}`,
      detail: tradeLoss
        ? `${tradeLoss.botName} · ${tradeLoss.symbol} · ${tradeLoss.contractLabel} · a single loss inside the pool's drawdown limit.`
        : "A single loss inside the pool's drawdown limit.",
      amount: tradeLoss?.yourShareNet ?? -10.5,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: tradeLoss?.poolId ?? null,
      poolCode: tradeLoss?.poolCode ?? null,
      href: "/investor/live",
      openLabel: "Live tracker",
      delivered: ["inApp"],
      source: "Trade feed",
    },
    {
      id: "ntf_blocked_login",
      at: "2026-09-16T11:19:00Z",
      category: "security",
      level: "critical",
      title: "Sign-in attempt blocked from Lagos, NG",
      detail:
        "An unrecognised device tried your password and was blocked before a 2FA challenge was issued. Nothing was accessed.",
      amount: null,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: null,
      href: "/investor/notifications?action=securityPosture",
      openLabel: "Security centre",
      delivered: ["inApp", "email", "sms"],
      source: "Account security",
    },
    {
      id: "ntf_welcome",
      at: "2026-09-12T14:00:00Z",
      category: "security",
      level: "info",
      title: "Welcome to the investor desk · account opened",
      detail:
        "KYC Level 1 accepted · bank destination verified · the wallet opened the next morning with a $2,500 top-up.",
      amount: null,
      read: true,
      pinned: false,
      snoozedUntil: null,
      poolId: null,
      poolCode: null,
      href: "/investor",
      openLabel: "Investor overview",
      delivered: ["inApp", "email"],
      source: "Account security",
    },
  ];

  notifications.sort((a, b) => b.at.localeCompare(a.at));

  /* ── Preferences, rules, delivery log ── */

  const preferences = emptyPreferences();
  preferences.channels.payment.sms = true;
  preferences.channels.security.sms = true;
  preferences.channels.trade.push = false;

  const rules: InboxRule[] = [
    {
      id: "rule_guardian",
      label: "Guardian events break the digest",
      detail: "Alerted immediately, even inside quiet hours",
      category: "pool",
      action: "alert",
      enabled: true,
    },
    {
      id: "rule_small_trades",
      label: "Ignore trades under $5.00",
      detail: "Muted below the threshold",
      category: "trade",
      action: "mute",
      enabled: true,
    },
    {
      id: "rule_quiet",
      label: "Quiet hours 22:00–07:00",
      detail: "Email only, no push or SMS overnight",
      category: "payment",
      action: "digest",
      enabled: true,
    },
    {
      id: "rule_payout_pin",
      label: "Pin payout status changes",
      detail: "Pinned to the top of the inbox",
      category: "payment",
      action: "pin",
      enabled: true,
    },
    {
      id: "rule_security_always",
      label: "Security alerts always deliver",
      detail: "Cannot be muted or snoozed",
      category: "security",
      action: "alert",
      enabled: true,
    },
  ];

  const deliveries: DeliveryRow[] = [
    {
      id: "dlv_in_app",
      channel: "inApp",
      address: "This session",
      verified: true,
      sent: notifications.length,
      failed: 0,
      lastAt: notifications[0]?.at ?? asOf,
      note: "Every notification lands here first; the badge reads the unread count.",
    },
    {
      id: "dlv_email",
      channel: "email",
      address: "jane.investor@trademo.example",
      verified: true,
      sent: 21,
      failed: 0,
      lastAt: notifications[0]?.at ?? asOf,
      note: "Verified mailbox · digests arrive at 09:00 UTC.",
    },
    {
      id: "dlv_push",
      channel: "push",
      address: "2 devices (MacBook, iPhone)",
      verified: true,
      sent: 14,
      failed: 1,
      lastAt: "2026-10-22T11:12:00Z",
      note: "One delivery failed on 22 Oct while the iPhone was offline; it retried and landed.",
    },
    {
      id: "dlv_sms",
      channel: "sms",
      address: "+254 7•• ••• 421",
      verified: false,
      sent: 6,
      failed: 0,
      lastAt: "2026-10-22T11:12:00Z",
      note: "Unverified number · only payment and security alerts use SMS. Verify it to keep the channel on.",
    },
  ];

  return {
    mode: "demo",
    asOf,
    revision: 0,
    profile: {
      id: investments.profile.id,
      displayName: investments.profile.displayName,
      investorSince: investments.profile.investorSince,
      tier: investments.profile.tier,
      kycLevel: investments.profile.kycLevel,
      country: investments.profile.country,
      currency: investments.profile.currency,
      email: "jane.investor@trademo.example",
      phone: "+254 7•• ••• 421",
      wallet: wallet.balance.available,
      monthRoiPct: investments.profile.monthRoiPct,
      committed: investments.profile.committed,
    },
    notifications,
    tradeActivity,
    poolUpdates,
    paymentAlerts,
    securityEvents,
    sessions,
    preferences,
    rules,
    deliveries,
    filters: {
      category: "all",
      unreadOnly: false,
      pinnedOnly: false,
      range: "all",
      query: "",
      sort: "newest",
    },
    exports: [],
    support: [],
    audit: [],
  };
}

