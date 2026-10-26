import {
  BOOKING_HANDLE,
  POOL_BOOKING_AS_OF,
  RESERVATION_WINDOW_HOURS,
  round2,
  type BookingExisting,
  type BookingHistoryRow,
  type BookingPool,
  type BookingRecord,
  type BookingTerm,
  type EscrowAccount,
  type PaymentFieldSpec,
  type PaymentMethodDef,
  type PoolBookingWorkspace,
  type SavedMethod,
} from "@/lib/investor/pool-booking";

import { getPoolDetailWorkspace } from "./investor-pool-detail-service";
import { getPoolsWorkspace } from "./investor-pools-service";

/**
 * I-4 fixture source. Pool facts come from the same pool book as I-2/I-3 so the
 * register, the detail workspace and the booking page never disagree. Payment
 * rails, escrow coordinates, saved instruments and prior bookings are authored
 * here; every value is a source snapshot (`asOf`) and no rail is contacted.
 */

const money = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const addHours = (iso: string, hours: number) =>
  new Date(Date.parse(iso) + hours * 3_600_000).toISOString();

const daysBetween = (from: string, to: string) =>
  Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));

const atLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

/* ── Payment rails ── */

const bankFields: PaymentFieldSpec[] = [
  {
    name: "bankName",
    label: "Bank name",
    kind: "text",
    placeholder: "Bank of Africa",
    autoComplete: "organization",
    maxLength: 60,
  },
  {
    name: "accountNumber",
    label: "Account number",
    kind: "text",
    placeholder: "0011223344",
    autoComplete: "off",
    hint: "Digits only, 6–18 characters",
    maxLength: 24,
  },
  {
    name: "routingNumber",
    label: "Routing / SWIFT",
    kind: "text",
    placeholder: "021000021",
    autoComplete: "off",
    hint: "6–11 digits for ACH, or the SWIFT/BIC code",
    maxLength: 14,
  },
  {
    name: "accountHolder",
    label: "Account holder",
    kind: "text",
    placeholder: "Jane Investor",
    autoComplete: "name",
    maxLength: 60,
  },
];

const mobileFields: PaymentFieldSpec[] = [
  {
    name: "provider",
    label: "Provider",
    kind: "select",
    options: [
      { value: "mtn", label: "MTN Mobile Money" },
      { value: "vodafone", label: "Vodafone Cash" },
      { value: "mpesa", label: "M-Pesa" },
      { value: "airtel", label: "Airtel Money" },
    ],
  },
  {
    name: "phone",
    label: "Phone number",
    kind: "tel",
    placeholder: "+254 712 000 111",
    autoComplete: "tel",
    hint: "Full number with country code",
    maxLength: 20,
  },
  {
    name: "confirmSms",
    label: "I can confirm this booking from the provider's SMS prompt",
    kind: "check",
  },
];

const cardFields: PaymentFieldSpec[] = [
  {
    name: "cardNumber",
    label: "Card number",
    kind: "text",
    placeholder: "4242 4242 4242 4242",
    autoComplete: "cc-number",
    hint: "Visa or Mastercard · 15–16 digits",
    maxLength: 23,
  },
  {
    name: "expiry",
    label: "Expiry",
    kind: "text",
    placeholder: "MM/YY",
    autoComplete: "cc-exp",
    maxLength: 5,
  },
  {
    name: "cvc",
    label: "CVC",
    kind: "text",
    placeholder: "123",
    autoComplete: "cc-csc",
    maxLength: 4,
  },
  {
    name: "cardName",
    label: "Name on card",
    kind: "text",
    placeholder: "Jane Investor",
    autoComplete: "cc-name",
    maxLength: 60,
  },
  {
    name: "zip",
    label: "Postal code",
    kind: "text",
    placeholder: "20100",
    autoComplete: "postal-code",
    maxLength: 10,
  },
];

const cryptoFields: PaymentFieldSpec[] = [
  {
    name: "currency",
    label: "Currency",
    kind: "select",
    options: [
      { value: "btc", label: "BTC · Bitcoin" },
      { value: "eth", label: "ETH · Ethereum" },
      { value: "usdt", label: "USDT · Tether" },
      { value: "usdc", label: "USDC · USD Coin" },
    ],
  },
  {
    name: "walletAddress",
    label: "Wallet address",
    kind: "text",
    placeholder: "0x9f2a… or bc1q…",
    autoComplete: "off",
    hint: "20–64 characters, network-specific",
    maxLength: 64,
  },
  {
    name: "network",
    label: "Network",
    kind: "select",
    options: [
      { value: "erc20", label: "ERC20 · Ethereum" },
      { value: "trc20", label: "TRC20 · Tron" },
      { value: "bep20", label: "BEP20 · BNB Chain" },
    ],
  },
];

const escrow: EscrowAccount = {
  bankName: "DerivX Escrow Account",
  accountName: "tradeMO Funding Desk",
  accountNumber: "1234567890",
  routingNumber: "021000021",
  swift: "DERXUS33",
  windowHours: RESERVATION_WINDOW_HOURS,
  verifyLabel: "avg 2h 30m",
  note: "Escrow collects investor capital only. Slots confirm after the desk reconciles the reference; unverified reservations release capacity automatically.",
};

const methods = (pool: BookingPool): PaymentMethodDef[] => [
  {
    key: "wallet",
    label: "Wallet balance",
    icon: "wallet",
    tagline: "Instant internal transfer from your investor wallet",
    speed: "Instant",
    feePct: 0,
    feeFlat: 0,
    feeLabel: "No fee",
    limits: "Whole order only · no partial wallet payments",
    note: "Wallet capital stays inside tradeMO. Top up first if the balance cannot cover the full order.",
    fields: [],
    instructions: [
      "Wallet balance is debited when the desk verifies the booking.",
      "Slots reserve immediately once verification clears.",
    ],
  },
  {
    key: "bank_transfer",
    label: "Bank transfer",
    icon: "vault",
    tagline: "ACH, SEPA, SWIFT or domestic wire",
    speed: "1–3 business days",
    feePct: 0,
    feeFlat: 0,
    feeLabel: "No fee",
    limits: `Minimum ${money(pool.slotPrice)} · no maximum`,
    note: "Include the booking reference in the transfer memo; unmatched transfers are returned to the sender bank.",
    fields: bankFields,
    instructions: [
      `Transfer the exact total to ${escrow.bankName}.`,
      "Quote the booking reference in the memo field.",
      `The desk verifies receipt (${escrow.verifyLabel}) and locks the slots.`,
    ],
  },
  {
    key: "mobile_money",
    label: "Mobile money",
    icon: "smartphone",
    tagline: "MTN, Vodafone, M-Pesa and Airtel",
    speed: "Instant – 30 min",
    feePct: 1.5,
    feeFlat: 0,
    feeLabel: "1.5% of the order",
    limits: "Daily provider caps apply · confirm the SMS prompt",
    note: "Provider limits sometimes split large orders. A split booking still needs a single reference per transfer.",
    fields: mobileFields,
    instructions: [
      "Approve the provider prompt on the registered handset.",
      "The provider settles to the escrow collection wallet.",
      "Slots confirm after the desk reconciles the provider reference.",
    ],
  },
  {
    key: "card",
    label: "Card",
    icon: "layers",
    tagline: "Visa and Mastercard · 3-D Secure",
    speed: "Instant",
    feePct: 2.9,
    feeFlat: 0.3,
    feeLabel: "2.9% + $0.30",
    limits: `Cards up to ${money(25000)} per booking`,
    note: "Card data never touches tradeMO servers — a payment provider tokenises it in the browser.",
    fields: cardFields,
    instructions: [
      "Card is authorised by the payment provider, not captured here.",
      "3-D Secure completes in the provider window.",
      "Slots confirm on settlement (usually instant).",
    ],
  },
  {
    key: "crypto",
    label: "Crypto",
    icon: "bolt",
    tagline: "BTC, ETH, USDT and USDC",
    speed: "15–60 min",
    feePct: 0,
    feeFlat: 2.4,
    feeLabel: "$2.40 network fee",
    limits: "Network-specific address · one asset per transfer",
    note: "Send on the selected network only. Assets sent on the wrong network are unrecoverable.",
    fields: cryptoFields,
    instructions: [
      "Send the exact asset and amount to the escrow address.",
      "Wait for the required network confirmations.",
      "Slots confirm once the desk matches the on-chain reference.",
    ],
  },
];

const termsFor = (pool: BookingPool): BookingTerm[] => [
  {
    id: "terms",
    label: "Pool terms",
    detail: `I have read the ${pool.code} pool terms: ${pool.profitSharePct}% profit share on net earnings, ${pool.guardianNote} and settlement on ${pool.settlementBatch}.`,
  },
  {
    id: "lockup",
    label: "Lock-up",
    detail: `I understand capital is locked for ${pool.durationDays} days (${pool.opensAt.slice(0, 10)} → ${pool.tradingEndsAt.slice(0, 10)}); an early exit carries a 10% penalty on committed capital.`,
  },
  {
    id: "funds",
    label: "Funds source",
    detail:
      "I confirm the funds used for this booking match the source declared in KYC (salary and savings), and I will re-declare if that changes.",
  },
];

/** Participant totals stay identical to the I-3 detail workspace. */
function participantCount(poolId: string) {
  return getPoolDetailWorkspace(poolId)?.overview.investors ?? 0;
}

/* ── Pool projection ── */

function poolFor(idOrCode: string): {
  pool: BookingPool;
  lifecycle: BookingPool["lifecycle"];
  existing: BookingExisting | null;
  blockedReason: string | null;
} | null {
  const book = getPoolsWorkspace();
  const key = idOrCode.trim();
  const lower = key.toLowerCase();
  const match = <T extends { id: string; code: string }>(rows: T[]) =>
    rows.find((row) => row.id === key || row.code.toLowerCase() === lower) ??
    null;

  const trading = match(book.trading);
  const open = match(book.open);
  const upcoming = match(book.upcoming);
  const completed = match(book.completed);
  const base = trading ?? open ?? upcoming ?? completed;
  if (!base) return null;

  const guardianNote = trading
    ? `Guardian drawdown ${trading.guardian.drawdownPct}% against a ${trading.guardian.drawdownLimitPct}% limit`
    : "Guardian drawdown band enforced at 5% of pool equity";

  if (trading) {
    const pool: BookingPool = {
      id: trading.id,
      code: trading.code,
      name: trading.name,
      lifecycle: "trading",
      strategy: trading.strategy,
      riskBand: trading.riskBand,
      manager: "tradeMO funding desk",
      opensAt: trading.startedAt,
      closesAt: trading.startedAt,
      tradingEndsAt: trading.endsAt,
      durationDays: daysBetween(trading.startedAt, trading.endsAt),
      expectedRoiPct: trading.roiPct,
      slotPrice: trading.slotPrice,
      minSlot: trading.slotPrice,
      maxSlotsPerUser: trading.slotsTotal,
      slotsTotal: trading.slotsTotal,
      slotsFilled: trading.slotsFilled,
      goal: trading.goal,
      raised: trading.raised,
      investors: participantCount(trading.id),
      profitSharePct: trading.profitSharePct,
      settlementBatch: trading.settlementBatch,
      tokenSymbol: "bmX",
      tokensPerSlot: trading.slotPrice,
      guardianNote,
      riskNote: `${trading.riskBand} risk band. Guardian drawdown ${trading.guardian.drawdownPct}% against a ${trading.guardian.drawdownLimitPct}% policy limit.`,
    };
    return {
      pool,
      lifecycle: "trading",
      existing: {
        slots: trading.userSlots,
        amount: trading.investment,
        payment: "verified",
        reference: null,
        bookedAt: trading.startedAt,
        methodLabel: "Bank transfer",
        note: "Allocation is live in the trading window.",
      },
      blockedReason: `${trading.code} is already trading. Additional slots open with the next cycle in the register.`,
    };
  }

  if (open) {
    const slotsTotal = Math.max(1, Math.ceil(open.goal / open.minSlot));
    const slotsFilled = Math.min(
      slotsTotal,
      Math.max(1, Math.ceil(open.raised / open.minSlot)),
    );
    const pool: BookingPool = {
      id: open.id,
      code: open.code,
      name: open.name,
      lifecycle: "open",
      strategy: open.strategy,
      riskBand: open.riskBand,
      manager: "tradeMO funding desk",
      opensAt: open.opensAt,
      closesAt: open.closesAt,
      tradingEndsAt: open.tradingEndsAt,
      durationDays: open.durationDays,
      expectedRoiPct: open.expectedRoiPct,
      slotPrice: open.minSlot,
      minSlot: open.minSlot,
      maxSlotsPerUser: open.maxSlotsPerUser,
      slotsTotal,
      slotsFilled,
      goal: open.goal,
      raised: open.raised,
      investors: open.investors,
      profitSharePct: 25,
      settlementBatch: "Daily 17:00 UTC",
      tokenSymbol: "bmX",
      tokensPerSlot: open.minSlot,
      guardianNote,
      riskNote: `${open.riskBand} risk band. Guardian reacts after consecutive losses and caps drawdown at 5% of pool equity before sizing down.`,
    };
    const existing: BookingExisting | null =
      open.bookedSlots > 0
        ? {
            slots: open.bookedSlots,
            amount: open.investment,
            payment: open.payment,
            reference: open.paymentRef,
            bookedAt: open.opensAt,
            methodLabel:
              open.payment === "verified" ? "Bank transfer" : "Mobile money",
            note:
              open.payment === "verified"
                ? "Verified by the funding desk inside the current window."
                : "Awaiting provider settlement — reservation still holds capacity.",
          }
        : null;
    return {
      pool,
      lifecycle: "open",
      existing,
      blockedReason: null,
    };
  }

  if (upcoming) {
    const slotsTotal = Math.max(1, Math.ceil(upcoming.goal / upcoming.minSlot));
    return {
      pool: {
        id: upcoming.id,
        code: upcoming.code,
        name: upcoming.name,
        lifecycle: "upcoming",
        strategy: upcoming.strategy,
        riskBand: upcoming.riskBand,
        manager: "tradeMO funding desk",
        opensAt: upcoming.opensAt,
        closesAt: upcoming.closesAt,
        tradingEndsAt: upcoming.closesAt,
        durationDays: upcoming.durationDays,
        expectedRoiPct: upcoming.expectedRoiPct,
        slotPrice: upcoming.minSlot,
        minSlot: upcoming.minSlot,
        maxSlotsPerUser: upcoming.maxSlotsPerUser,
        slotsTotal,
        slotsFilled: 0,
        goal: upcoming.goal,
        raised: upcoming.expressed,
        investors: 0,
        profitSharePct: 25,
        settlementBatch: "Daily 17:00 UTC",
        tokenSymbol: "bmX",
        tokensPerSlot: upcoming.minSlot,
        guardianNote,
        riskNote: `${upcoming.riskBand} risk band. Guardian policy is fixed when the funding window opens.`,
      },
      lifecycle: "upcoming",
      existing: null,
      blockedReason: `Booking opens ${atLabel(upcoming.opensAt)} UTC. Register interest on the pool page and the desk will hold your place in the queue.`,
    };
  }

  if (!completed) return null;
  const slotPrice = round2(
    completed.investment / Math.max(completed.userSlots, 1),
  );
  const slotsTotal = Math.max(completed.userSlots, 12);
  return {
    pool: {
      id: completed.id,
      code: completed.code,
      name: completed.name,
      lifecycle: "completed",
      strategy: completed.strategy,
      riskBand: completed.riskBand,
      manager: "tradeMO funding desk",
      opensAt: completed.startedAt,
      closesAt: completed.startedAt,
      tradingEndsAt: completed.completedAt,
      durationDays: daysBetween(completed.startedAt, completed.completedAt),
      expectedRoiPct: completed.finalRoiPct,
      slotPrice,
      minSlot: slotPrice,
      maxSlotsPerUser: 10,
      slotsTotal,
      slotsFilled: slotsTotal,
      goal: round2(slotPrice * slotsTotal),
      raised: round2(slotPrice * slotsTotal),
      investors: 6,
      profitSharePct: completed.platformCutPct,
      settlementBatch: "Settled",
      tokenSymbol: "bmX",
      tokensPerSlot: slotPrice,
      guardianNote,
      riskNote: `${completed.riskBand} risk band. This cycle settled at ${completed.finalRoiPct}% net of the platform cut.`,
    },
    lifecycle: "completed",
    existing: null,
    blockedReason: `${completed.code} settled on ${completed.completedAt.slice(0, 10)}. Statements and the payout record stay on the pool page.`,
  };
}

/* ── Seeded reservations ── */

function seededRecord(
  pool: BookingPool,
  existing: BookingExisting,
  lifecycle: BookingPool["lifecycle"],
): BookingRecord | null {
  if (!existing) return null;
  const created =
    lifecycle === "open"
      ? existing.payment === "verified"
        ? "2026-10-19T14:20:00Z"
        : "2026-10-22T09:12:00Z"
      : existing.bookedAt;
  const updated =
    existing.payment === "verified"
      ? "2026-10-19T16:50:00Z"
      : "2026-10-22T09:12:00Z";
  const confirmed = existing.payment === "verified";
  const method = existing.methodLabel.toLowerCase().includes("mobile")
    ? "mobile_money"
    : "bank_transfer";
  const fee = method === "mobile_money" ? round2(existing.amount * 0.015) : 0;
  return {
    id:
      pool.id === "pkg_02"
        ? "inv_8f2a"
        : `inv_${pool.id.replace("pkg_", "4b").padEnd(6, "0")}`,
    poolId: pool.id,
    slots: existing.slots,
    amount: existing.amount,
    tokens: existing.slots * pool.tokensPerSlot,
    fee,
    total: round2(existing.amount + fee),
    method,
    methodLabel: existing.methodLabel,
    details:
      method === "mobile_money"
        ? { provider: "mpesa", phone: "+254 712 000 111", confirmSms: "yes" }
        : {
            bankName: "Bank of Africa",
            accountNumber: "0011223344",
            routingNumber: "021000021",
            accountHolder: "Jane Investor",
          },
    reference:
      existing.reference ??
      `BOOK-${pool.code.replaceAll("-", "")}-${BOOKING_HANDLE}-1701`,
    receiptNo: `RCPT-${pool.code.replaceAll("-", "")}-1701`,
    status: confirmed ? "confirmed" : "awaiting_payment",
    stage: confirmed ? "confirmed" : "instructions",
    createdAt: created,
    updatedAt: updated,
    reservationExpiresAt: addHours(created, escrow.windowHours),
    cancelReason: null,
    operatorNote: confirmed
      ? "Receipt reconciled against the escrow statement; slots locked into the trading window."
      : "Transfer sent from M-Pesa; awaiting the desk reconciliation run.",
    instructions: [
      confirmed
        ? "Escrow receipt verified by the funding desk."
        : "Approve the M-Pesa prompt on the registered handset.",
      confirmed
        ? "Investment locked; profit share accrues from the first settlement batch."
        : "Slots stay reserved until the 72-hour window closes.",
    ],
  };
}

const savedMethods: SavedMethod[] = [
  {
    id: "saved_bank_africa",
    kind: "bank",
    label: "Bank of Africa · current account",
    detail: "Account •••• 3344 · routing 021000021",
    holder: "Jane N. Investor",
    primary: true,
  },
  {
    id: "saved_equity",
    kind: "bank",
    label: "Equity Bank · savings",
    detail: "Account •••• 7712 · SWIFT EQBLKENA",
    holder: "Jane N. Investor",
    primary: false,
  },
  {
    id: "saved_visa",
    kind: "card",
    label: "Visa •••• 4242",
    detail: "Expires 03/29 · 3-D Secure enrolled",
    holder: "Jane N. Investor",
    primary: false,
  },
];

/* ── Workspace ── */

export function getPoolBookingWorkspace(
  idOrCode: string,
  asOf = POOL_BOOKING_AS_OF,
): PoolBookingWorkspace | null {
  const resolved = poolFor(idOrCode);
  if (!resolved) return null;
  const book = getPoolsWorkspace();
  const { pool, existing, blockedReason } = resolved;
  const bookable = pool.lifecycle === "open" && !blockedReason;

  const record = existing ? seededRecord(pool, existing, pool.lifecycle) : null;

  const history: BookingHistoryRow[] = [
    ...(record
      ? [
          {
            id: record.id,
            code: pool.code,
            name: pool.name,
            slots: record.slots,
            amount: record.amount,
            methodLabel: record.methodLabel,
            status:
              record.status === "confirmed" ? "Confirmed" : "Awaiting payment",
            createdAt: record.createdAt,
            reference: record.reference,
          } satisfies BookingHistoryRow,
        ]
      : []),
    ...book.trading
      .filter((item) => item.id !== pool.id)
      .map(
        (item) =>
          ({
            id: `inv_${item.id.replace("pkg_", "7c")}`,
            code: item.code,
            name: item.name,
            slots: item.userSlots,
            amount: item.investment,
            methodLabel: "Bank transfer",
            status: "Confirmed",
            createdAt: item.startedAt,
            reference: `BOOK-${item.code.replaceAll("-", "")}-${BOOKING_HANDLE}-1701`,
          }) satisfies BookingHistoryRow,
      ),
    ...book.completed.map(
      (item) =>
        ({
          id: `inv_${item.id.replace("pkg_", "2d")}`,
          code: item.code,
          name: item.name,
          slots: item.userSlots,
          amount: item.investment,
          methodLabel: "Bank transfer",
          status: "Settled",
          createdAt: item.startedAt,
          reference: item.payoutRef ?? "PAY-RECONCILED",
        }) satisfies BookingHistoryRow,
    ),
  ];

  return structuredClone({
    mode: "demo",
    asOf,
    revision: 0,
    poolId: pool.id,
    bookable,
    blockedReason,
    profile: {
      id: book.profile.id,
      displayName: book.profile.displayName,
      investorSince: book.profile.investorSince,
      tier: book.profile.tier,
      country: book.profile.country,
      currency: book.profile.currency,
      wallet: book.summary.wallet,
      unread: book.summary.unread,
      monthRoiPct: book.summary.monthRoiPct,
      committed: book.summary.committed,
      kycLevel: "L2 verified",
      fundsSource: "Salary & savings · Equity Bank Kenya",
      fundsDeclaredAt: "2026-09-12T10:00:00Z",
      bookingHandle: BOOKING_HANDLE,
    },
    pool,
    existing,
    methods: methods(pool),
    escrow,
    terms: termsFor(pool),
    records: record ? [record] : [],
    history,
    savedMethods,
    topUps: [],
    projections: [],
    support: [],
    referrals: [],
    audit: [],
  });
}

/** Every pool that has a booking page: the register's four lifecycles. */
export function listBookingPoolIds(): string[] {
  const book = getPoolsWorkspace();
  return [
    ...book.trading,
    ...book.open,
    ...book.upcoming,
    ...book.completed,
  ].map((pool) => pool.id);
}
