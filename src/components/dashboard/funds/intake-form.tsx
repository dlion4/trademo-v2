"use client";
import { useForm } from "@tanstack/react-form";
import { intakeSchema, type DepositIntake } from "@/lib/funds/model";
import type { FundsBundle } from "@/lib/funds/types";
export function DepositIntakeForm({
  data,
  defaults,
  onContinue,
}: {
  data: FundsBundle;
  defaults: DepositIntake;
  onContinue: (value: DepositIntake) => void;
}) {
  const form = useForm({
    defaultValues: defaults,
    validators: { onSubmit: intakeSchema },
    onSubmit: ({ value }) => onContinue(value),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="fd-form-grid">
        <form.Field name="investorId">
          {(field) => (
            <label className="fd-field">
              Investor
              <select
                className="form-select"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              >
                {data.investors.map((i) => (
                  <option value={i.id} key={i.id}>
                    {i.name} ·{" "}
                    {i.kycVerified ? "KYC verified" : "KYC outstanding"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="pool">
          {(field) => (
            <label className="fd-field">
              Package
              <select
                className="form-select"
                value={field.state.value}
                onChange={(e) =>
                  field.handleChange(e.target.value as DepositIntake["pool"])
                }
              >
                {data.allocations.map((p) => (
                  <option value={p.code} key={p.code}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="amount">
          {(field) => (
            <label className="fd-field">
              Amount / USD
              <input
                className="form-control"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={field.state.value || ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              />
              {field.state.meta.errors.map((error, i) => (
                <small className="text-loss" key={i}>
                  {typeof error === "object" && error
                    ? error.message
                    : String(error)}
                </small>
              ))}
            </label>
          )}
        </form.Field>
        <form.Field name="method">
          {(field) => (
            <label className="fd-field">
              Payment method
              <select
                className="form-select"
                value={field.state.value}
                onChange={(e) =>
                  field.handleChange(e.target.value as DepositIntake["method"])
                }
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_money">Mobile money</option>
                <option value="crypto_usdt">Crypto / USDT</option>
                <option value="card">Card</option>
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="reference">
          {(field) => (
            <label className="fd-field fd-span">
              Provider reference
              <input
                className="form-control"
                maxLength={100}
                minLength={6}
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <small>
                Use a unique reference. Recording an intake does not prove
                settlement.
              </small>
              {field.state.meta.errors.map((error, i) => (
                <small className="text-loss" key={i}>
                  {typeof error === "object" && error
                    ? error.message
                    : String(error)}
                </small>
              ))}
            </label>
          )}
        </form.Field>
      </div>
      <button className="fd-btn fd-primary mt-4" type="submit">
        Review deposit →
      </button>
    </form>
  );
}
