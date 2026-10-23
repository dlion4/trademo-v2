"use client";
import { useForm } from "@tanstack/react-form";
import {
  requestSchema,
  settingsSchema,
  feeFor,
  type RequestDraft,
} from "@/lib/payouts/model";
import type { PayoutBundle, PayoutSettings } from "@/lib/payouts/types";
const errors = (list: unknown[]) =>
  list.flat().map((e, i) => (
    <small className="text-loss" key={i}>
      {typeof e === "object" && e && "message" in e
        ? String(e.message)
        : String(e)}
    </small>
  ));
export function PayoutRequestForm({
  data,
  defaults,
  onContinue,
}: {
  data: PayoutBundle;
  defaults: RequestDraft;
  onContinue: (v: RequestDraft) => void;
}) {
  const form = useForm({
    defaultValues: defaults,
    validators: { onSubmit: requestSchema },
    onSubmit: ({ value }) => onContinue(value),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="wd-form-grid">
        <form.Field name="investorId">
          {(f) => (
            <label className="wd-field">
              Investor
              <select
                className="form-select"
                value={f.state.value}
                onChange={(e) => {
                  f.handleChange(e.target.value);
                  const i = data.investors.find(
                    (i) => i.id === e.target.value,
                  )!;
                  form.setFieldValue("pool", i.pools[0] ?? "");
                  form.setFieldValue("method", i.defaultMethod);
                }}
              >
                {data.investors
                  .filter((i) => i.pools.length)
                  .map((i) => (
                    <option value={i.id} key={i.id}>
                      {i.name} · {i.wallet.available.toFixed(2)} USD available
                    </option>
                  ))}
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="pool">
          {(f) => (
            <form.Subscribe selector={(s) => s.values.investorId}>
              {(id) => (
                <label className="wd-field">
                  Package
                  <select
                    className="form-select"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  >
                    {data.investors
                      .find((i) => i.id === id)
                      ?.pools.map((p) => (
                        <option value={p} key={p}>
                          {p}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </form.Subscribe>
          )}
        </form.Field>
        <form.Field name="amount">
          {(f) => (
            <label className="wd-field">
              Gross request / USD
              <input
                className="form-control"
                type="number"
                min={data.settings.minimum}
                max={data.settings.maximum}
                step="0.01"
                required
                value={f.state.value || ""}
                onBlur={f.handleBlur}
                onChange={(e) => f.handleChange(Number(e.target.value))}
              />
              {errors(f.state.meta.errors)}
            </label>
          )}
        </form.Field>
        <form.Field name="method">
          {(f) => (
            <label className="wd-field">
              Payout method
              <select
                className="form-select"
                value={f.state.value}
                onChange={(e) =>
                  f.handleChange(e.target.value as RequestDraft["method"])
                }
              >
                {["bank_transfer", "mobile_money", "crypto_usdt", "card"].map(
                  (m) => (
                    <option key={m} value={m}>
                      {m.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="reason">
          {(f) => (
            <label className="wd-field wd-span">
              Reason
              <select
                className="form-select"
                value={f.state.value}
                onChange={(e) =>
                  f.handleChange(e.target.value as RequestDraft["reason"])
                }
              >
                <option value="partial_payout">Partial payout</option>
                <option value="full_payout">Full payout</option>
              </select>
              <small>
                “Full payout” is a request reason, not a position-close
                instruction or automatic liquidation.
              </small>
            </label>
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(s) => s.values}>
        {(v) => (
          <div className="wd-note mt-3">
            Fee estimate ${feeFor(v.amount, v.method, data.settings).toFixed(2)}{" "}
            · expected recipient amount $
            {(v.amount - feeFor(v.amount, v.method, data.settings)).toFixed(2)}.
            Gross amount is reserved from the investor’s local wallet, not paid
            automatically.
          </div>
        )}
      </form.Subscribe>
      <button className="wd-btn wd-primary mt-3" type="submit">
        Review request →
      </button>
    </form>
  );
}
export function PayoutSettingsForm({
  settings,
  onReview,
}: {
  settings: PayoutSettings;
  onReview: (v: PayoutSettings) => void;
}) {
  const form = useForm({
    defaultValues: settings,
    validators: { onSubmit: settingsSchema },
    onSubmit: ({ value }) => onReview(value),
  });
  const fields: [
    keyof Omit<PayoutSettings, "autoEnabled" | "batchTime">,
    string,
    string,
  ][] = [
    [
      "minimum",
      "Minimum gross payout / USD",
      "Applies to new requests and approvals",
    ],
    [
      "maximum",
      "Maximum per request / USD",
      "Also bounded by wallet and treasury liquidity",
    ],
    [
      "autoThreshold",
      "Auto-rule threshold / USD",
      "Only KYC level 2+ and verified beneficiaries",
    ],
    ["mobilePercent", "Mobile money fee / %", "Deducted from gross amount"],
    ["cardPercent", "Card fee / %", "Percentage plus the fixed card fee"],
    ["cardFixed", "Card fixed fee / USD", "Added to the percentage card fee"],
    [
      "cryptoFee",
      "Crypto fee estimate / USD",
      "Illustrative network estimate, not a live gas quote",
    ],
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="wd-form-grid">
        {fields.map(([name, label, hint]) => (
          <form.Field name={name} key={name}>
            {(f) => (
              <label className="wd-field">
                {label}
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max={
                    name.includes("Percent")
                      ? 20
                      : name === "cryptoFee" || name === "cardFixed"
                        ? 100
                        : 1000000
                  }
                  step="0.01"
                  required
                  value={f.state.value}
                  onBlur={f.handleBlur}
                  onChange={(e) => f.handleChange(Number(e.target.value))}
                />
                <small>{hint}</small>
                {errors(f.state.meta.errors)}
              </label>
            )}
          </form.Field>
        ))}
        <form.Field name="batchTime">
          {(f) => (
            <label className="wd-field">
              Daily batch time / UTC
              <input
                className="form-control"
                type="time"
                required
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
              <small>
                Schedule policy only. No worker or cron job is created here.
              </small>
            </label>
          )}
        </form.Field>
        <form.Field name="autoEnabled">
          {(f) => (
            <label className="wd-check wd-span">
              <input
                type="checkbox"
                checked={f.state.value}
                onChange={(e) => f.handleChange(e.target.checked)}
              />
              Enable the eligibility rule (preview and explicit approval only in
              this demo)
            </label>
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(s) => s.errors}>
        {(list) => (
          <div className="wd-validation" role="status">
            {errors(list)}
          </div>
        )}
      </form.Subscribe>
      <button className="wd-btn wd-primary" type="submit">
        Review settings →
      </button>
    </form>
  );
}
