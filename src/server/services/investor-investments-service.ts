import {
  INVESTMENTS_AS_OF,
  PAYOUT_LOCK_DAYS,
  computeSummary,
  grossOfNet,
  payoutEligibility,
  round2,
  type ActiveInvestment,
  type BookedSlot,
  type CompletedInvestment,
  type InvestmentAllocation,
  type InvestmentDocument,
  type InvestmentsWorkspace,
  type PayoutRecord,
  type TimelineEvent,
} from "@/lib/investor/investments";

import { getPoolsWorkspace } from "./investor-pools-service";

/**
 * I-6 fixture source.
 *
 * Every position is read out of the shared pool book, so slot counts, slot
 * prices, investor shares and net P&L match I-2 / I-3 / I-4 / I-5 exactly:
 *   active    PKG-01 $15,000 · 30% · net +$1,260   PKG-03 $10,000 · 10% · net +$1,350
 *   settled   PKG-00 $9,000 · PKG-02 $4,000 · PKG-06 $8,000
 *   booked    PKG-02 $10,000 verified · PKG-09 $2,500 pending · PKG-04 $6,000 interest
 *
 * Gross is derived from the net figure with the platform's 20% cut, which is
 * why the net share in this page is the same number I-5 reports per trade.
 */

const METHOD_BY_POOL: Record<
  string,
  { method: string; paidAt: string; ref: string }
> = {
  pkg_01: {
    method: "Bank transfer ·•••• 8842",
    paidAt: "2026-10-02T14:20:00Z",
    ref: "PAY-2026-10-02-4471",
  },
  pkg_03: {
    method: "Crypto · USDT (ERC-20)",
    paidAt: "2026-10-05T11:08:00Z",
    ref: "PAY-2026-10-05-8820",
  },
};

const COMPLETED_SHARE: Record<string, number> = {
  pkg_00: 15.5,
  pkg_02c: 12,
  pkg_06c: 18,
};

const BOOKED_META: Record<string, { bookedAt: string; paymentMethod: string }> =
  {
    pkg_02: {
      bookedAt: "2026-10-19T00:40:00Z",
      paymentMethod: "Bank transfer ·•••• 8842",
    },
    pkg_09: {
      bookedAt: "2026-10-22T11:12:00Z",
      paymentMethod: "Card ·•••• 3319",
    },
  };

function activePositions(): ActiveInvestment[] {
  const book = getPoolsWorkspace();
  return book.trading.map((pool) => {
    const netEarned = round2(pool.sharePnl);
    const grossEarned = grossOfNet(netEarned);
    const platformCut = round2(grossEarned - netEarned);
    const meta = METHOD_BY_POOL[pool.id];
    const requestedPayout = pool.id === "pkg_01" ? 120 : 0;
    const eligibility = payoutEligibility({
      startedAt: pool.startedAt,
      netEarned,
      requestedPayout,
    });
    return {
      id: `inv_${pool.id}`,
      poolId: pool.id,
      code: pool.code,
      name: pool.name,
      stage: "active",
      lifecycle: "trading",
      strategy: pool.strategy,
      riskBand: pool.riskBand,
      slots: pool.userSlots,
      slotPrice: pool.slotPrice,
      investment: pool.investment,
      sharePct: pool.profitSharePct,
      paymentStatus: "verified",
      paymentMethod: meta.method,
      paymentRef: meta.ref,
      paidAt: meta.paidAt,
      currentValue: round2(pool.investment + netEarned),
      netEarned,
      grossEarned,
      platformCut,
      roiPct: Number(((netEarned / pool.investment) * 100).toFixed(2)),
      poolPnl: pool.pnl,
      poolRoiPct: pool.roiPct,
      poolTrades: pool.trades,
      poolWinRatePct: pool.winRatePct,
      startedAt: pool.startedAt,
      endsAt: pool.endsAt,
      settlementBatch: pool.settlementBatch,
      guardianLevel: pool.guardian.drawdownPct > 2 ? "watch" : "ok",
      guardianNote: pool.guardian.note,
      requestedPayout,
      availablePayout: eligibility.available,
      payoutEligibleAt: eligibility.unlockAt,
      payoutEligible: eligibility.eligible,
      poolHref: `/investor/pools/${pool.id}`,
      liveHref: "/investor/live",
      bookHref: `/investor/pools/${pool.id}/book`,
    } satisfies ActiveInvestment;
  });
}

function completedPositions(): CompletedInvestment[] {
  const book = getPoolsWorkspace();
  return book.completed.map((pool) => ({
    id: `inv_${pool.id}`,
    poolId: pool.id,
    code: pool.code,
    name: pool.name,
    stage: "completed",
    slots: pool.userSlots,
    investment: pool.investment,
    sharePct: COMPLETED_SHARE[pool.id] ?? 15,
    startedAt: pool.startedAt,
    completedAt: pool.completedAt,
    daysHeld: Math.max(
      1,
      Math.round(
        (Date.parse(pool.completedAt) - Date.parse(pool.startedAt)) /
          86_400_000,
      ),
    ),
    grossEarnings: pool.grossEarnings,
    platformCut: round2(pool.grossEarnings - pool.netEarnings),
    netEarnings: round2(pool.netEarnings),
    userRoiPct: Number(((pool.netEarnings / pool.investment) * 100).toFixed(2)),
    payoutStatus: "paid",
    paidAt: pool.paidAt,
    payoutRef: pool.payoutRef ?? "—",
    settlement: pool.settlement,
    statementRef: `STM-${pool.completedAt.slice(0, 10)}-${pool.code}`,
    riskBand: pool.riskBand,
  }));
}

function bookedPositions(): BookedSlot[] {
  const book = getPoolsWorkspace();
  const bookings = book.open
    .filter((pool) => pool.bookedSlots > 0)
    .map((pool) => {
      const meta = BOOKED_META[pool.id];
      return {
        id: `booked_${pool.id}`,
        poolId: pool.id,
        code: pool.code,
        name: pool.name,
        stage: "booked",
        lifecycle: "open",
        slots: pool.bookedSlots,
        slotPrice: pool.minSlot,
        amount: pool.investment,
        paymentStatus: pool.payment,
        paymentMethod: meta?.paymentMethod ?? "Bank transfer",
        paymentRef: pool.paymentRef,
        bookedAt: meta?.bookedAt ?? pool.opensAt,
        closesAt: pool.closesAt,
        tradingStartsAt: pool.closesAt,
        slotsRemaining: Math.max(0, pool.maxSlotsPerUser - pool.bookedSlots),
        reminder: null,
        note:
          pool.payment === "verified"
            ? `Payment verified ${pool.paymentRef}. Slots confirm automatically when the window closes and PKG-02 starts trading.`
            : "Payment is still being verified. Slots are held in booking order until the window closes.",
      } satisfies BookedSlot;
    });

  const interest = book.upcoming
    .filter((pool) => pool.id === "pkg_04")
    .map(
      (pool) =>
        ({
          id: `interest_${pool.id}`,
          poolId: pool.id,
          code: pool.code,
          name: pool.name,
          stage: "interest",
          lifecycle: "upcoming",
          slots: 3,
          slotPrice: pool.minSlot,
          amount: round2(pool.minSlot * 3),
          paymentStatus: "not_required",
          paymentMethod: "No payment taken",
          paymentRef: null,
          bookedAt: "2026-10-01T09:00:00Z",
          closesAt: pool.closesAt,
          tradingStartsAt: pool.closesAt,
          slotsRemaining: Math.max(0, pool.maxSlotsPerUser - 3),
          reminder: { leadDays: 2, channel: "email" },
          note: `Registered interest only — no payment, no reserved capacity. Booking opens ${pool.opensAt.slice(0, 10)} at 09:00 UTC.`,
        }) satisfies BookedSlot,
    );

  return [...bookings, ...interest];
}

function payoutRecords(completed: CompletedInvestment[]): PayoutRecord[] {
  const settled: PayoutRecord[] = completed.map((row, index) => ({
    id: `po_paid_${index + 1}`,
    poolId: row.poolId,
    poolCode: row.code,
    amount: row.netEarnings,
    fee: 0,
    net: row.netEarnings,
    method: "bank",
    destination: "Bank transfer ·•••• 8842",
    status: "paid",
    requestedAt: row.completedAt,
    expectedAt: row.paidAt ?? row.completedAt,
    processedAt: row.paidAt,
    reference: row.payoutRef,
    note: "Settlement payout for the completed cycle.",
  }));

  const processing: PayoutRecord = {
    id: "po_pending_01",
    poolId: "pkg_01",
    poolCode: "PKG-01",
    amount: 120,
    fee: 1.5,
    net: 118.5,
    method: "bank",
    destination: "Bank transfer ·•••• 8842",
    status: "processing",
    requestedAt: "2026-10-17T22:00:00Z",
    expectedAt: "2026-10-24T22:00:00Z",
    processedAt: null,
    reference: "PO-2026-10-17-0052",
    note: "Interim payout against PKG-01 accrued earnings. Clears on the 17:00 UTC batch.",
  };

  return [processing, ...settled].sort((a, b) =>
    b.requestedAt.localeCompare(a.requestedAt),
  );
}

function timelineEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "tl_01",
      at: "2026-10-22T11:12:00Z",
      kind: "booking",
      title: "Booking confirmed on PKG-09",
      detail:
        "1 slot · $2,500 · card •••• 3319 · payment verification in progress",
      amount: 2500,
      poolCode: "PKG-09",
      status: "processing",
      investmentId: "booked_pkg_09",
    },
    {
      id: "tl_02",
      at: "2026-10-22T08:05:00Z",
      kind: "payout",
      title: "Payout paid · PKG-06 Steady Income",
      detail:
        "Settlement payout to bank •••• 8842 · reference PO-2026-10-22-0047",
      amount: 849.6,
      poolCode: "PKG-06",
      status: "settled",
      investmentId: "inv_pkg_06c",
    },
    {
      id: "tl_03",
      at: "2026-10-21T17:00:00Z",
      kind: "pool",
      title: "PKG-06 Steady Income completed",
      detail: "Cycle closed and reconciled · 4 slots · net +$849.60",
      amount: 849.6,
      poolCode: "PKG-06",
      status: "settled",
      investmentId: "inv_pkg_06c",
    },
    {
      id: "tl_04",
      at: "2026-10-21T12:15:00Z",
      kind: "milestone",
      title: "PKG-05 Basic Growth v2 announced",
      detail: "Booking opens 2026-10-28 at 12:00 UTC · minimum $3,000 per slot",
      amount: null,
      poolCode: "PKG-05",
      status: "informational",
      investmentId: null,
    },
    {
      id: "tl_05",
      at: "2026-10-19T09:00:00Z",
      kind: "kyc",
      title: "Verification level 2 approved",
      detail: "Identity and address checks cleared by the compliance desk",
      amount: null,
      poolCode: null,
      status: "settled",
      investmentId: null,
    },
    {
      id: "tl_06",
      at: "2026-10-19T00:40:00Z",
      kind: "booking",
      title: "Booking confirmed on PKG-02",
      detail:
        "2 slots · $10,000 · bank transfer verified · trading starts when the window closes",
      amount: 10000,
      poolCode: "PKG-02",
      status: "settled",
      investmentId: "booked_pkg_02",
    },
    {
      id: "tl_07",
      at: "2026-10-18T14:23:47Z",
      kind: "trade",
      title: "Trade won +$8.40 (your share, PKG-01)",
      detail:
        "R_10 rise · 5 ticks · $35 pool stake · 30% share · net after platform cut",
      amount: 8.4,
      poolCode: "PKG-01",
      status: "settled",
      investmentId: "inv_pkg_01",
    },
    {
      id: "tl_08",
      at: "2026-10-18T11:03:00Z",
      kind: "account",
      title: "Wallet top-up confirmed",
      detail: "Bank transfer •••• 8842 · available balance updated",
      amount: 1000,
      poolCode: null,
      status: "settled",
      investmentId: null,
    },
    {
      id: "tl_09",
      at: "2026-10-17T22:00:00Z",
      kind: "payout",
      title: "Payout requested $118.50",
      detail:
        "PKG-01 accrued earnings · $120 gross, $1.50 fee · processing to bank •••• 8842",
      amount: 120,
      poolCode: "PKG-01",
      status: "processing",
      investmentId: "inv_pkg_01",
    },
    {
      id: "tl_10",
      at: "2026-10-14T18:14:00Z",
      kind: "pool",
      title: "Pool PKG-03 trading started",
      detail:
        "1 slot · $10,000 · 10% investor share · Guardian watch from day one",
      amount: 10000,
      poolCode: "PKG-03",
      status: "settled",
      investmentId: "inv_pkg_03",
    },
    {
      id: "tl_11",
      at: "2026-10-11T14:32:00Z",
      kind: "pool",
      title: "Pool PKG-01 trading started",
      detail:
        "5 slots · $15,000 · 30% investor share · daily 17:00 UTC settlement",
      amount: 15000,
      poolCode: "PKG-01",
      status: "settled",
      investmentId: "inv_pkg_01",
    },
    {
      id: "tl_12",
      at: "2026-10-11T09:20:00Z",
      kind: "payout",
      title: "Payout paid · PKG-00 Genesis",
      detail:
        "Settlement payout to bank •••• 8842 · reference PO-2026-10-11-0031",
      amount: 1180.8,
      poolCode: "PKG-00",
      status: "settled",
      investmentId: "inv_pkg_00",
    },
    {
      id: "tl_13",
      at: "2026-10-10T18:00:00Z",
      kind: "pool",
      title: "PKG-00 Genesis completed",
      detail: "3 slots · $9,000 · net +$1,180.80 after the 20% platform cut",
      amount: 1180.8,
      poolCode: "PKG-00",
      status: "settled",
      investmentId: "inv_pkg_00",
    },
    {
      id: "tl_14",
      at: "2026-10-05T11:08:00Z",
      kind: "booking",
      title: "Booking confirmed on PKG-03",
      detail:
        "1 slot · $10,000 · USDT (ERC-20) · reference PAY-2026-10-05-8820",
      amount: 10000,
      poolCode: "PKG-03",
      status: "settled",
      investmentId: "inv_pkg_03",
    },
    {
      id: "tl_15",
      at: "2026-10-02T14:20:00Z",
      kind: "booking",
      title: "Booking confirmed on PKG-01",
      detail:
        "5 slots · $15,000 · bank transfer · reference PAY-2026-10-02-4471",
      amount: 15000,
      poolCode: "PKG-01",
      status: "settled",
      investmentId: "inv_pkg_01",
    },
    {
      id: "tl_16",
      at: "2026-10-01T09:00:00Z",
      kind: "interest",
      title: "Interest registered on PKG-04",
      detail:
        "3 slots · $6,000 indicated · no payment taken · booking opens 2026-10-25",
      amount: 6000,
      poolCode: "PKG-04",
      status: "informational",
      investmentId: "interest_pkg_04",
    },
    {
      id: "tl_17",
      at: "2026-09-30T17:00:00Z",
      kind: "payout",
      title: "Payout paid · PKG-02 Premium Yield",
      detail:
        "Settlement payout to bank •••• 8842 · reference PO-2026-09-30-0018",
      amount: 388.8,
      poolCode: "PKG-02",
      status: "settled",
      investmentId: "inv_pkg_02c",
    },
    {
      id: "tl_18",
      at: "2026-09-30T00:00:00Z",
      kind: "pool",
      title: "PKG-02 Premium Yield · cycle 1 completed",
      detail: "2 slots · $4,000 · net +$388.80 after the 20% platform cut",
      amount: 388.8,
      poolCode: "PKG-02",
      status: "settled",
      investmentId: "inv_pkg_02c",
    },
    {
      id: "tl_19",
      at: "2026-09-29T09:00:00Z",
      kind: "pool",
      title: "PKG-01 Basic Growth opened for booking",
      detail: "$3,000 per slot · 25 slots · 14-day cycle",
      amount: null,
      poolCode: "PKG-01",
      status: "informational",
      investmentId: null,
    },
    {
      id: "tl_20",
      at: "2026-09-21T09:00:00Z",
      kind: "pool",
      title: "Pool PKG-06 Steady Income trading started",
      detail: "4 slots · $8,000 · conservative carry",
      amount: 8000,
      poolCode: "PKG-06",
      status: "settled",
      investmentId: "inv_pkg_06c",
    },
    {
      id: "tl_21",
      at: "2026-09-12T10:35:00Z",
      kind: "kyc",
      title: "KYC submitted",
      detail: "Identity, address and funds-source documents uploaded",
      amount: null,
      poolCode: null,
      status: "settled",
      investmentId: null,
    },
    {
      id: "tl_22",
      at: "2026-09-12T10:00:00Z",
      kind: "account",
      title: "Account created · role investor",
      detail: "Investor workspace opened · currency USD · country Kenya",
      amount: null,
      poolCode: null,
      status: "settled",
      investmentId: null,
    },
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

function documents(
  active: ActiveInvestment[],
  completed: CompletedInvestment[],
): InvestmentDocument[] {
  const rows: InvestmentDocument[] = [
    ...completed.map((row, index) => ({
      id: `doc_stmt_${index + 1}`,
      title: `${row.code} final statement`,
      kind: "statement" as const,
      poolCode: row.code,
      period: `${row.startedAt.slice(0, 10)} → ${row.completedAt.slice(0, 10)}`,
      sizeKb: 142 + index * 11,
      createdAt: row.completedAt,
    })),
    ...active.map((row, index) => ({
      id: `doc_receipt_${index + 1}`,
      title: `${row.code} booking receipt`,
      kind: "receipt" as const,
      poolCode: row.code,
      period: row.paidAt.slice(0, 10),
      sizeKb: 96 + index * 7,
      createdAt: row.paidAt,
    })),
    {
      id: "doc_payout_01",
      title: "Payout advice · PO-2026-10-17-0052",
      kind: "payout",
      poolCode: "PKG-01",
      period: "2026-10-17",
      sizeKb: 74,
      createdAt: "2026-10-17T22:00:00Z",
    },
    {
      id: "doc_kyc_01",
      title: "Verification certificate · level 2",
      kind: "kyc",
      poolCode: "—",
      period: "2026-10-19",
      sizeKb: 58,
      createdAt: "2026-10-19T09:00:00Z",
    },
    {
      id: "doc_portfolio_01",
      title: "Portfolio statement · Q3 2026",
      kind: "statement",
      poolCode: "All pools",
      period: "2026-07-01 → 2026-09-30",
      sizeKb: 208,
      createdAt: "2026-10-01T06:00:00Z",
    },
  ];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getInvestmentsWorkspace(): InvestmentsWorkspace {
  const book = getPoolsWorkspace();
  const active = activePositions();
  const completed = completedPositions();
  const booked = bookedPositions();
  const payouts = payoutRecords(completed);

  const allocations: InvestmentAllocation[] = [
    ...active.map((row) => ({
      poolCode: row.code,
      name: row.name,
      stage: "active" as const,
      amount: row.investment,
      sharePct: row.sharePct,
    })),
    ...completed.map((row) => ({
      poolCode: row.code,
      name: row.name,
      stage: "completed" as const,
      amount: row.investment,
      sharePct: row.sharePct,
    })),
    ...booked.map((row) => ({
      poolCode: row.code,
      name: row.name,
      stage: row.stage,
      amount: row.amount,
      sharePct: 0,
    })),
  ];

  const workspace: InvestmentsWorkspace = {
    mode: "demo",
    asOf: INVESTMENTS_AS_OF,
    revision: 0,
    profile: {
      id: book.profile.id,
      displayName: book.profile.displayName,
      investorSince: book.profile.investorSince,
      kycLevel: "L2",
      kycVerifiedAt: "2026-10-19T09:00:00Z",
      country: book.profile.country,
      currency: book.profile.currency,
      tier: book.profile.tier,
      wallet: book.summary.wallet,
      unread: book.summary.unread,
      monthRoiPct: book.summary.monthRoiPct,
      committed: book.summary.committed,
      bankAccount: "Bank transfer ·•••• 8842",
    },
    summary: computeSummary({ active, completed, booked, payouts }),
    active,
    completed,
    booked,
    payouts,
    timeline: timelineEvents(),
    documents: documents(active, completed),
    notes: [
      {
        id: "note_seed_1",
        investmentId: "inv_pkg_01",
        poolCode: "PKG-01",
        body: "Holding PKG-01 through the full cycle; the daily batch covers the R_10 volatility I asked about.",
        createdAt: "2026-10-12T08:40:00Z",
      },
    ],
    allocations,
    kyc: {
      level: "L2",
      verifiedAt: "2026-10-19T09:00:00Z",
      nextLevel: "Level 3 · institutional limits",
      nextLevelRequirement:
        "Level 3 unlocks pools above $100,000 and raises the interim payout ceiling to $25,000. It needs a source-of-funds review and a signed mandate.",
      limits: [
        { label: "Interim payout ceiling", value: "$10,000 per request" },
        { label: "Open positions", value: "Up to 6 pools at once" },
        { label: "Booking window", value: "72 h hold after reservation" },
        { label: "Settlement", value: "Daily 17:00 UTC batch" },
      ],
    },
    payoutPolicy: [
      {
        id: "pp_lock",
        label: `${PAYOUT_LOCK_DAYS}-day lock`,
        detail:
          "Accrued earnings unlock for interim payout once a pool has traded for ten days. Until then the balance stays on the pool ledger.",
      },
      {
        id: "pp_minimum",
        label: "$50 minimum",
        detail:
          "Interim payouts start at $50. Smaller balances roll into the next request or the settlement payout.",
      },
      {
        id: "pp_fee",
        label: "Bank fee 0.6% (max $12)",
        detail:
          "Bank payouts carry a 0.6% fee capped at $12. Wallet transfers are free and instant inside the platform.",
      },
      {
        id: "pp_settlement",
        label: "Settlement payout",
        detail:
          "When a pool completes, the whole net balance is paid automatically to your saved destination — no request needed.",
      },
    ],
    milestones: book.roadmap
      .filter((row) => row.state !== "token")
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        date: row.date,
        expectedRoiPct: row.expectedRoiPct,
        state: row.state === "confirmed" ? "confirmed" : "planned",
      })),
    filters: { kinds: [], query: "" },
    preferences: {
      emailStatements: true,
      autoReinvest: false,
      payoutLeadDays: 2,
      reminderChannel: "email",
      hideCompleted: false,
    },
    exports: [],
    support: [],
    audit: [],
  };

  workspace.summary = computeSummary(workspace);
  return structuredClone(workspace);
}
