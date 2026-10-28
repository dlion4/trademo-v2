const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (id) =>
    id.startsWith("@/")
      ? load("src/" + id.slice(2) + ".ts")
      : id.startsWith("./")
        ? load(path.join(path.dirname(file), id) + ".ts")
        : require(id);
  new Function("exports", "require", "module", output)(mod.exports, req, mod);
  cache.set(file, mod.exports);
  return mod.exports;
}

const { getPoolBookingWorkspace, listBookingPoolIds } = load(
  "src/server/services/investor-pool-booking-service.ts",
);
const booking = load("src/lib/investor/pool-booking.ts");
const {
  applyBookingCommand: apply,
  bookingAmount,
  bookingDraftError,
  bookingReference,
  bookingStageRows,
  bookingTotals,
  buildBookingPayload,
  feeFor,
  feeTableRows,
  methodAvailable,
  methodByKey,
  paymentFieldError,
  reservationWindow,
  round2,
  slotLabel,
  slotsForYou,
  slotsRemainingCapital,
  slotsRemainingInPool,
  tokensFor,
  totalDue,
  walletShortfall,
} = booking;

const read = (file) =>
  fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const open = getPoolBookingWorkspace("pkg_02");
const card = methodByKey(open.methods, "card");
const bank = methodByKey(open.methods, "bank_transfer");
const wallet = methodByKey(open.methods, "wallet");

const validDetails = (key) =>
  key === "card"
    ? {
        cardNumber: "4242424242424242",
        expiry: "03/29",
        cvc: "123",
        cardName: "Jane Investor",
        zip: "20100",
      }
    : key === "mobile_money"
      ? { provider: "mpesa", phone: "+254712000111", confirmSms: "yes" }
      : key === "crypto"
        ? {
            currency: "usdt",
            walletAddress: "TQ5NMqJjRDNNf9rMk2nU9gPzP3rWn4Y8hK",
            network: "trc20",
          }
        : key === "bank_transfer"
          ? {
              bankName: "Bank of Africa",
              accountNumber: "0011223344",
              routingNumber: "021000021",
              accountHolder: "Jane Investor",
            }
          : {};

const draft = (overrides = {}) => ({
  pool: open.pool,
  methods: open.methods,
  slots: 3,
  method: "bank_transfer",
  details: validDetails("bank_transfer"),
  terms: { terms: true, lockup: true, funds: true },
  wallet: open.profile.wallet,
  bookable: true,
  blockedReason: null,
  existing: open.existing,
  ...overrides,
});

/* ── Fixture contract ── */

test("every pool in the register has a booking context", () => {
  const ids = listBookingPoolIds();
  assert.equal(ids.length, 9);
  for (const id of ids) {
    const workspace = getPoolBookingWorkspace(id);
    assert.ok(workspace, id);
    assert.equal(workspace.pool.id, id);
    assert.equal(workspace.methods.length, 5);
    assert.equal(workspace.terms.length, 3);
    assert.equal(workspace.asOf, "2026-10-23T10:00:00Z");
  }
  assert.equal(getPoolBookingWorkspace("nope"), null);
});

test("the pool code resolves to the same booking context as the id", () => {
  const byId = getPoolBookingWorkspace("pkg_02");
  const byCode = getPoolBookingWorkspace("PKG-02");
  assert.equal(byCode.poolId, byId.poolId);
  assert.deepEqual(byCode.pool, byId.pool);
});

test("the headline figures match the I-4 specification sample", () => {
  const w = getPoolBookingWorkspace("pkg_02");
  assert.equal(w.pool.code, "PKG-02");
  assert.equal(w.pool.name, "Premium Yield");
  assert.equal(w.pool.lifecycle, "open");
  assert.equal(w.pool.slotPrice, 5000);
  assert.equal(w.pool.maxSlotsPerUser, 10);
  assert.equal(w.pool.goal, 80000);
  assert.equal(w.pool.raised, 28000);
  assert.equal(w.pool.expectedRoiPct, 18);
  assert.equal(w.pool.durationDays, 21);
  assert.equal(w.existing.slots, 2);
  assert.equal(w.existing.amount, 10000);
  assert.equal(w.existing.payment, "verified");
  assert.equal(slotsForYou(w.pool, w.existing), 8);
});

test("open windows are bookable, other lifecycles are blocked with a reason", () => {
  for (const id of ["pkg_02", "pkg_09"]) {
    const w = getPoolBookingWorkspace(id);
    assert.equal(w.bookable, true, id);
    assert.equal(w.blockedReason, null, id);
  }
  for (const id of ["pkg_01", "pkg_04", "pkg_00"]) {
    const w = getPoolBookingWorkspace(id);
    assert.equal(w.bookable, false, id);
    assert.match(w.blockedReason, /trading|Booking opens|settled/, id);
    assert.ok(
      bookingDraftError(
        draft({
          pool: w.pool,
          methods: w.methods,
          bookable: false,
          blockedReason: w.blockedReason,
          existing: w.existing,
        }),
      ),
      `${id} refuses a booking`,
    );
  }
});

test("participant counts agree with the I-3 detail workspace", () => {
  const detail = load("src/server/services/investor-pool-detail-service.ts");
  for (const id of ["pkg_01", "pkg_02", "pkg_09"]) {
    assert.equal(
      getPoolBookingWorkspace(id).pool.investors,
      detail.getPoolDetailWorkspace(id).overview.investors,
      id,
    );
  }
});

/* ── Payment rails ── */

test("payment rails carry their published fees and required fields", () => {
  assert.deepEqual(
    open.methods.map((method) => method.key),
    ["wallet", "bank_transfer", "mobile_money", "card", "crypto"],
  );
  assert.equal(wallet.fields.length, 0);
  assert.equal(bank.fields.length, 4);
  assert.equal(methodByKey(open.methods, "mobile_money").fields.length, 3);
  assert.equal(card.fields.length, 5);
  assert.equal(methodByKey(open.methods, "crypto").fields.length, 3);
  assert.equal(card.feePct, 2.9);
  assert.equal(card.feeFlat, 0.3);
  assert.equal(methodByKey(open.methods, "mobile_money").feePct, 1.5);
  assert.equal(bank.feePct, 0);
  assert.equal(feeFor(card, 15000), 435.3);
  assert.equal(feeFor(bank, 15000), 0);
  assert.equal(totalDue(card, 15000), 15435.3);
});

test("the wallet rail is only available when it covers the whole order", () => {
  assert.equal(methodAvailable(wallet, 2000, 2892), true);
  assert.equal(methodAvailable(wallet, 15000, 2892), false);
  assert.equal(walletShortfall(wallet, 15000, 2892), 12108);
  assert.equal(walletShortfall(bank, 15000, 0), 0);
});

test("fee table covers every rail with a settled total", () => {
  const rows = feeTableRows(open.methods, 15000, 2892);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].available, false);
  assert.equal(rows[1].total, 15000);
  assert.equal(rows[3].total, 15435.3);
});

/* ── Slot maths ── */

test("slot availability respects the per-user limit, stock and target", () => {
  const pool = open.pool;
  assert.equal(slotsRemainingInPool(pool), pool.slotsTotal - pool.slotsFilled);
  assert.equal(
    slotsRemainingCapital(pool),
    Math.floor((pool.goal - pool.raised) / pool.slotPrice),
  );
  assert.equal(slotsForYou(pool, null), 10);
  assert.equal(slotsForYou(pool, { ...open.existing, slots: 9 }), 1);
  assert.equal(slotsForYou({ ...pool, slotsFilled: pool.slotsTotal }, null), 0);
});

test("live allocation totals reproduce the specification sample", () => {
  const totals = bookingTotals(open.pool, 3, bank, open.existing);
  assert.equal(totals.amount, 15000);
  assert.equal(totals.tokens, 15000);
  assert.equal(totals.sharePct, 34.88);
  assert.equal(totals.fee, 0);
  assert.equal(totals.total, 15000);
  assert.equal(totals.combinedSlots, 5);
  assert.equal(totals.combinedAmount, 25000);
  assert.equal(bookingAmount(open.pool, 3), 3 * 5000);
  assert.equal(tokensFor(open.pool, 3), 15000);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(slotLabel(1), "1 slot");
  assert.equal(slotLabel(4), "4 slots");
});

/* ── Validation ── */

test("required payment fields are validated per rail", () => {
  const field = (name) => card.fields.find((item) => item.name === name);
  assert.equal(paymentFieldError(field("cardNumber"), "4242424242424242"), "");
  assert.match(paymentFieldError(field("cardNumber"), "12"), /15–16/);
  assert.equal(paymentFieldError(field("expiry"), "03/29"), "");
  assert.match(paymentFieldError(field("expiry"), "13/29"), /MM\/YY/);
  assert.match(paymentFieldError(field("cvc"), ""), /required/);
  const routing = bank.fields.find((item) => item.name === "routingNumber");
  assert.equal(paymentFieldError(routing, "021000021"), "");
  assert.equal(paymentFieldError(routing, "EQBLKENA"), "");
  assert.match(paymentFieldError(routing, "12"), /routing digits|SWIFT/);
  const phone = methodByKey(open.methods, "mobile_money").fields.find(
    (item) => item.name === "phone",
  );
  assert.equal(paymentFieldError(phone, "+254712000111"), "");
  assert.match(paymentFieldError(phone, "0712"), /country code/);
  const check = methodByKey(open.methods, "mobile_money").fields.find(
    (item) => item.name === "confirmSms",
  );
  assert.match(paymentFieldError(check, ""), /required/);
  assert.equal(paymentFieldError(check, "yes"), "");
});

test("the draft guard blocks every incomplete path in order", () => {
  assert.equal(bookingDraftError(draft()), "");
  assert.match(bookingDraftError(draft({ slots: 0 })), /at least one slot/);
  assert.match(bookingDraftError(draft({ slots: 9 })), /Only 8 slot/);
  assert.match(
    bookingDraftError(draft({ method: "card", details: {} })),
    /Card number is required/,
  );
  assert.match(
    bookingDraftError(draft({ method: "wallet", details: {} })),
    /short/,
  );
  assert.match(
    bookingDraftError(
      draft({ terms: { terms: false, lockup: true, funds: true } }),
    ),
    /pool terms/,
  );
  assert.match(
    bookingDraftError(
      draft({ terms: { terms: true, lockup: false, funds: true } }),
    ),
    /lock-up/,
  );
  assert.match(
    bookingDraftError(
      draft({ terms: { terms: true, lockup: true, funds: false } }),
    ),
    /funds source/,
  );
  assert.match(
    bookingDraftError(draft({ bookable: false, blockedReason: "Closed" })),
    /Closed/,
  );
});

test("the booking payload mirrors the POST /api/investments body", () => {
  const payload = buildBookingPayload(
    draft({
      method: "bank_transfer",
      details: validDetails("bank_transfer"),
    }),
  );
  assert.equal(payload.poolId, "pkg_02");
  assert.equal(payload.slots, 3);
  assert.equal(payload.paymentMethod, "bank_transfer");
  assert.deepEqual(payload.paymentDetails, {
    bankName: "Bank of Africa",
    accountNumber: "0011223344",
    routingNumber: "021000021",
    accountHolder: "Jane Investor",
  });
  assert.equal(payload.termsAccepted, true);
  assert.equal(payload.amount, 15000);
  assert.equal(payload.fee, 0);
  assert.equal(payload.total, 15000);
  const cardPayload = buildBookingPayload(
    draft({ method: "card", details: validDetails("card") }),
  );
  assert.equal(cardPayload.total, 15435.3);
  assert.equal(Object.keys(cardPayload.paymentDetails).length, 5);
});

/* ── Status tracker ── */

test("the tracker starts empty and fills in five stages", () => {
  const empty = bookingStageRows(null, open.escrow);
  assert.equal(empty.length, 5);
  assert.ok(empty.every((row) => row.state === "pending"));
  const seeded = bookingStageRows(open.records[0], open.escrow);
  assert.deepEqual(
    seeded.map((row) => row.key),
    ["created", "instructions", "received", "verified", "confirmed"],
  );
  assert.ok(seeded.every((row) => row.state === "done"));
  assert.match(seeded[0].note, /booking ID/);
});

test("pending and cancelled reservations expose the right stage states", () => {
  const pending = getPoolBookingWorkspace("pkg_09").records[0];
  const rows = bookingStageRows(pending, open.escrow);
  assert.equal(rows[2].state, "current");
  assert.equal(rows[3].state, "pending");
  const cancelled = apply(
    { ...getPoolBookingWorkspace("pkg_09"), records: [{ ...pending }] },
    { kind: "cancelBooking", bookingId: pending.id, reason: "changed_plan" },
  ).records[0];
  const cancelledRows = bookingStageRows(cancelled, open.escrow);
  assert.equal(cancelledRows[2].state, "blocked");
  assert.equal(cancelledRows[4].state, "blocked");
  assert.match(cancelledRows[4].note, /cancelled/i);
});

test("reservation countdown derives from the record expiry", () => {
  const fresh = apply(open, {
    kind: "createBooking",
    slots: 1,
    method: "bank_transfer",
    details: validDetails("bank_transfer"),
    terms: { terms: true, lockup: true, funds: true },
  }).records[0];
  const window = reservationWindow(fresh, open.asOf);
  assert.equal(window.total, 72 * 3600);
  assert.equal(window.days, 3);
  const elapsed = reservationWindow(open.records[0], open.asOf);
  assert.equal(elapsed.total, 0);
  assert.equal(reservationWindow(null, open.asOf).label, "—");
});

/* ── Commands ── */

test("the command schema rejects malformed payloads", () => {
  assert.throws(() => booking.bookingCommandSchema.parse({}), /Invalid/);
  assert.throws(
    () =>
      booking.bookingCommandSchema.parse({
        kind: "createBooking",
        slots: 0,
        method: "bank_transfer",
      }),
    /too_small/,
  );
  assert.throws(
    () =>
      booking.bookingCommandSchema.parse({
        kind: "createBooking",
        slots: 2,
        method: "cash",
      }),
    /Invalid/,
  );
  assert.throws(
    () =>
      booking.bookingCommandSchema.parse({
        kind: "saveReferral",
        email: "nope",
      }),
    /Invalid|email/,
  );
  assert.throws(
    () =>
      booking.bookingCommandSchema.parse({
        kind: "cancelBooking",
        bookingId: "x",
      }),
    /too_small/,
  );
});

test("commands never mutate the previous workspace object", () => {
  const before = JSON.stringify(open);
  const next = apply(open, { kind: "acknowledge", scope: "risk" });
  assert.equal(JSON.stringify(open), before);
  assert.notEqual(next, open);
  assert.equal(next.revision, open.revision + 1);
});

test("creating a booking holds capacity, issues references and stays unpaid", () => {
  const next = apply(open, {
    kind: "createBooking",
    slots: 3,
    method: "bank_transfer",
    details: validDetails("bank_transfer"),
    terms: { terms: true, lockup: true, funds: true },
  });
  const record = next.records[0];
  assert.equal(next.records.length, 2);
  assert.equal(record.slots, 3);
  assert.equal(record.amount, 15000);
  assert.equal(record.tokens, 15000);
  assert.equal(record.fee, 0);
  assert.equal(record.total, 15000);
  assert.equal(record.status, "awaiting_payment");
  assert.equal(record.stage, "instructions");
  assert.match(record.reference, /^BOOK-PKG02-user_8f2a-\d+$/);
  assert.match(record.receiptNo, /^RCPT-PKG02-\d+$/);
  assert.notEqual(record.reference, open.records[0].reference);
  assert.ok(
    Date.parse(record.reservationExpiresAt) > Date.parse(record.createdAt),
  );
  assert.equal(
    Math.round(
      (Date.parse(record.reservationExpiresAt) - Date.parse(record.createdAt)) /
        3_600_000,
    ),
    72,
  );
  assert.equal(next.pool.raised, 43000);
  assert.equal(next.pool.slotsFilled, open.pool.slotsFilled + 3);
  assert.equal(next.history[0].status, "Awaiting payment");
  assert.equal(next.audit.length, 1);
  assert.match(next.audit[0].detail, /payment not captured/);
});

test("a card booking adds the rail fee to the total", () => {
  const next = apply(open, {
    kind: "createBooking",
    slots: 3,
    method: "card",
    details: validDetails("card"),
    terms: { terms: true, lockup: true, funds: true },
  });
  const record = next.records[0];
  assert.equal(record.amount, 15000);
  assert.equal(record.fee, 435.3);
  assert.equal(record.total, 15435.3);
  assert.equal(record.methodLabel, "Card");
  assert.equal(record.details.cardName, "Jane Investor");
});

test("bookings are refused for over-allocation, missing fields and closed windows", () => {
  const base = {
    kind: "createBooking",
    slots: 3,
    method: "bank_transfer",
    details: validDetails("bank_transfer"),
    terms: { terms: true, lockup: true, funds: true },
  };
  assert.throws(() => apply(open, { ...base, slots: 9 }), /Only 8 slot/);
  assert.throws(
    () => apply(open, { ...base, details: {} }),
    /Bank name is required/,
  );
  assert.throws(
    () =>
      apply(open, {
        ...base,
        terms: { terms: true, lockup: true, funds: false },
      }),
    /funds source/,
  );
  assert.throws(() => apply(open, { ...base, method: "wallet" }), /short/);
  const trading = getPoolBookingWorkspace("pkg_01");
  assert.throws(
    () =>
      apply(trading, {
        ...base,
        details: validDetails("bank_transfer"),
      }),
    /already trading/,
  );
  const upcoming = getPoolBookingWorkspace("pkg_04");
  assert.throws(
    () => apply(upcoming, { ...base, details: validDetails("bank_transfer") }),
    /Booking opens/,
  );
});

test("the operator steps advance received → verified → confirmed", () => {
  const created = apply(open, {
    kind: "createBooking",
    slots: 2,
    method: "bank_transfer",
    details: validDetails("bank_transfer"),
    terms: { terms: true, lockup: true, funds: true },
  });
  const id = created.records[0].id;
  const received = apply(created, { kind: "advanceBooking", bookingId: id });
  assert.equal(received.records[0].status, "received");
  assert.equal(received.records[0].stage, "received");
  const verified = apply(received, { kind: "advanceBooking", bookingId: id });
  assert.equal(verified.records[0].status, "verified");
  const confirmed = apply(verified, { kind: "advanceBooking", bookingId: id });
  assert.equal(confirmed.records[0].status, "confirmed");
  assert.equal(confirmed.existing.slots, open.existing.slots + 2);
  assert.equal(confirmed.existing.payment, "verified");
  assert.equal(confirmed.history[0].status, "Confirmed");
  assert.throws(
    () => apply(confirmed, { kind: "advanceBooking", bookingId: id }),
    /already confirmed/,
  );
  assert.throws(
    () =>
      apply(confirmed, { kind: "advanceBooking", bookingId: "inv_missing" }),
    /not found/,
  );
});

test("cancelling releases capacity and refuses verified bookings", () => {
  const created = apply(open, {
    kind: "createBooking",
    slots: 3,
    method: "bank_transfer",
    details: validDetails("bank_transfer"),
    terms: { terms: true, lockup: true, funds: true },
  });
  const id = created.records[0].id;
  const cancelled = apply(created, {
    kind: "cancelBooking",
    bookingId: id,
    reason: "duplicate",
  });
  assert.equal(cancelled.records[0].status, "cancelled");
  assert.equal(cancelled.records[0].cancelReason, "Duplicate booking");
  assert.equal(cancelled.pool.raised, open.pool.raised);
  assert.equal(cancelled.pool.slotsFilled, open.pool.slotsFilled);
  assert.throws(
    () =>
      apply(cancelled, {
        kind: "cancelBooking",
        bookingId: id,
        reason: "other",
      }),
    /already cancelled/,
  );
  const verified = apply(
    apply(created, { kind: "advanceBooking", bookingId: id }),
    { kind: "advanceBooking", bookingId: id },
  );
  assert.throws(
    () =>
      apply(verified, {
        kind: "cancelBooking",
        bookingId: id,
        reason: "other",
      }),
    /cannot be cancelled/,
  );
});

test("wallet top-ups, projections, referrals and support stay local drafts", () => {
  const topUp = apply(open, {
    kind: "topUpWallet",
    amount: 12000,
    method: "bank_transfer",
  });
  assert.equal(topUp.topUps[0].status, "draft");
  assert.equal(topUp.profile.wallet, open.profile.wallet);
  assert.throws(
    () => apply(open, { kind: "topUpWallet", amount: 50, method: "card" }),
    /too_small/,
  );

  const projection = apply(open, {
    kind: "saveProjection",
    slots: 3,
    roiPct: 18,
  });
  assert.equal(projection.projections[0].principal, 15000);
  assert.equal(projection.projections[0].projectedProfit, 2700);

  const referral = apply(open, {
    kind: "saveReferral",
    email: "Ada@Example.com",
    channel: "email",
  });
  assert.equal(referral.referrals[0].email, "ada@example.com");
  assert.throws(
    () =>
      apply(referral, {
        kind: "saveReferral",
        email: "ada@example.com",
        channel: "link",
      }),
    /already exists/,
  );

  const support = apply(open, {
    kind: "support",
    topic: "escrow",
    message: "Reference is missing from my transfer.",
  });
  assert.equal(support.support[0].status, "local_draft");
  assert.throws(
    () => apply(open, { kind: "support", topic: "escrow", message: "short" }),
    /too_small/,
  );
});

test("acknowledgements, exports and refreshes are audited and capped", () => {
  const acked = apply(open, { kind: "acknowledge", scope: "lockup" });
  assert.match(acked.audit[0].detail, /Lock-up/);
  const exported = apply(open, {
    kind: "recordExport",
    scope: "receipt",
    format: "pdf",
    count: 12,
  });
  assert.match(exported.audit[0].detail, /PDF/);
  assert.throws(
    () => apply(open, { kind: "refreshBooking", source: "auto" }),
    /Automatic refresh/,
  );
  const refreshed = apply(open, { kind: "refreshBooking", source: "manual" });
  assert.equal(refreshed.audit.length, 1);

  let workspace = open;
  for (let i = 0; i < 45; i += 1)
    workspace = apply(workspace, { kind: "acknowledge", scope: "risk" });
  assert.equal(workspace.audit.length, 40);
});

test("booking references stay deterministic", () => {
  assert.equal(
    bookingReference("PKG-02", "user_8f2a", 1),
    "BOOK-PKG02-user_8f2a-1701",
  );
  assert.equal(
    bookingReference("PKG-09", "user_8f2a", 4),
    "BOOK-PKG09-user_8f2a-1704",
  );
});

/* ── Route, API & UI wiring ── */

test("the booking API route is read-only and validates the section filter", () => {
  const source = read("src/app/api/investor/pools/[id]/book/route.ts");
  assert.match(source, /export function GET/);
  assert.doesNotMatch(
    source,
    /export (async )?function (POST|PUT|PATCH|DELETE)/,
  );
  assert.match(source, /Cache-Control": "no-store"/);
  assert.match(source, /"workspace"/);
  [
    "pool",
    "methods",
    "escrow",
    "terms",
    "records",
    "history",
    "savedMethods",
  ].forEach((section) => assert.match(source, new RegExp(`"${section}"`)));
  assert.match(source, /getPoolBookingWorkspace/);
});

test("the booking page route wires the workspace and 404s unknown pools", () => {
  const source = read("src/app/investor/pools/[id]/book/page.tsx");
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /getPoolBookingWorkspace/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /InvestorPoolBookingPage/);
  assert.match(source, /initialStep/);
  assert.match(source, /initialMethod/);
});

test("the page mounts the shell, five sections, drawer and wizard set", () => {
  const source = read("src/components/investor/investor-pool-booking-page.tsx");
  assert.match(source, /<InvestorShell/);
  assert.match(source, /<DeskModalShell/);
  assert.match(source, /op-drawer-backdrop/);
  assert.match(source, /useDeskTable/);
  assert.match(source, /usePoolBooking/);
  assert.match(source, /useForm\(\{/);
  assert.ok(
    (source.match(/pb-card pb-block/g) ?? []).length >= 5,
    "five numbered sections",
  );
  assert.match(source, /id="pb-details"/);
  assert.match(source, /id="pb-slots"/);
  assert.match(source, /id="pb-method"/);
  assert.match(source, /id="pb-review"/);
  assert.match(source, /id="pb-status"/);
  assert.ok(
    (source.match(/modal\.kind === "/g) ?? []).length >= 20,
    "one body per modal kind",
  );
  const kinds = (source.match(/^  \| "[a-zA-Z]+"/gm) ?? []).length;
  assert.ok(kinds >= 20, `dialog registry has ${kinds} kinds`);
  assert.match(source, /const wizardKinds: Kind\[\] = \[/);
  assert.match(source, /quickActions: InvestorQuickAction\[\] = \[/);
  assert.match(source, /bookHref=/);
});

test("page CSS is scoped, gradient-free and responsive", () => {
  const css = read("src/styles/pages/investor-pool-booking.css");
  assert.match(css, /\.page-investor-pool-booking \.pb-page/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(css, /@media \(max-width: 575\.98px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@keyframes pbSpin/);
  assert.match(css, /@keyframes pbPulse/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  const globals = read("src/app/globals.css");
  assert.match(globals, /investor-pool-booking\.css/);
});

test("I-2 and I-3 hand off to the booking page", () => {
  const pools = read("src/components/investor/investor-pools-page.tsx");
  const detail = read("src/components/investor/investor-pool-detail-page.tsx");
  assert.match(pools, /\/book`\}/);
  assert.match(pools, /bookHref=/);
  assert.match(detail, /\/book`\}/);
  assert.match(detail, /bookHref=/);
  const shell = read("src/components/investor/investor-shell.tsx");
  assert.match(shell, /key: "book"/);
  assert.match(shell, /code: "I-4"/);
});
