"use client";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
  timezones,
  profileSchema,
  platformSchema,
  type ProfileInput,
  type PlatformInput,
  type SettingsWorkspace,
} from "@/lib/settings/model";
export function ProfileForm({
  profile,
  onReview,
  onEmail,
  onRole,
}: {
  profile: SettingsWorkspace["profile"];
  onReview: (v: ProfileInput) => void;
  onEmail: () => void;
  onRole: () => void;
}) {
  const codes = ["+254", "+1", "+44", "+234", "+27", "+971"],
    initialCode = codes.find((c) => profile.phone.startsWith(c)) ?? "+254";
  const [callingCode, setCallingCode] = useState(initialCode);
  const form = useForm({
    defaultValues: {
      fullName: profile.fullName,
      timezone: profile.timezone,
      phone: profile.phone,
      bio: profile.bio,
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = profileSchema.safeParse(value);
        return r.success ? undefined : r.error.issues[0].message;
      },
    },
    onSubmit: ({ value }) => onReview(profileSchema.parse(value)),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(s) => s.values}>
        {(v) => (
          <>
            <div className="st-form-grid">
              <label className="st-field">
                Full name
                <input
                  className="form-control"
                  aria-label="Profile full name"
                  value={v.fullName}
                  maxLength={80}
                  onChange={(e) =>
                    form.setFieldValue("fullName", e.target.value)
                  }
                />
              </label>
              <label className="st-field">
                Timezone
                <select
                  className="form-select"
                  aria-label="Profile timezone"
                  value={v.timezone}
                  onChange={(e) =>
                    form.setFieldValue(
                      "timezone",
                      e.target.value as ProfileInput["timezone"],
                    )
                  }
                >
                  {timezones.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="st-field">
                Email · verification required
                <input
                  className="form-control"
                  aria-label="Profile email"
                  value={profile.email}
                  readOnly
                />
                <button type="button" className="st-link" onClick={onEmail}>
                  Review email change ↗
                </button>
              </label>
              <label className="st-field">
                Username · set at signup
                <input
                  className="form-control"
                  aria-label="Profile username"
                  value={profile.username}
                  readOnly
                />
                <span className="st-muted">
                  Role: {profile.role} /{" "}
                  <button
                    type="button"
                    className="st-link"
                    disabled={profile.role === "both"}
                    onClick={onRole}
                  >
                    {profile.role === "both"
                      ? "Investor preview enabled"
                      : "Become an investor"}
                  </button>
                </span>
              </label>
              <label className="st-field st-full">
                Phone · country code + national number
                <div className="st-phone">
                  <select
                    className="form-select"
                    aria-label="Phone country code"
                    value={callingCode}
                    onChange={(e) => {
                      const digits = v.phone.startsWith(callingCode)
                        ? v.phone.slice(callingCode.length)
                        : v.phone.replace(/^\+/, "");
                      setCallingCode(e.target.value);
                      form.setFieldValue("phone", e.target.value + digits);
                    }}
                  >
                    {codes.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    className="form-control"
                    aria-label="Profile national phone"
                    inputMode="tel"
                    value={
                      v.phone.startsWith(callingCode)
                        ? v.phone.slice(callingCode.length)
                        : v.phone
                    }
                    onChange={(e) =>
                      form.setFieldValue(
                        "phone",
                        callingCode + e.target.value.replace(/[\s()-]/g, ""),
                      )
                    }
                  />
                </div>
                <span className="st-muted">
                  Contact preference only; no SMS or real two-factor change is
                  made.
                </span>
              </label>
              <label className="st-field st-full">
                Public bio
                <textarea
                  className="form-control"
                  aria-label="Profile bio"
                  rows={5}
                  maxLength={500}
                  value={v.bio}
                  onChange={(e) => form.setFieldValue("bio", e.target.value)}
                />
                <span className="st-muted">
                  {v.bio.length}/500 characters · public-facing profile copy
                </span>
              </label>
            </div>
          </>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.errors}>
        {(errors) => (
          <p className="text-loss" role="status">
            {errors.map(String).join("; ")}
          </p>
        )}
      </form.Subscribe>
      <div className="st-form-footer">
        <span className="st-muted">
          Changes remain in this browser session.
        </span>
        <button type="submit" className="st-btn st-primary">
          Review profile changes
        </button>
      </div>
    </form>
  );
}
export function PlatformForm({
  value,
  onReview,
}: {
  value: PlatformInput;
  onReview: (v: PlatformInput) => void;
}) {
  const form = useForm({
    defaultValues: value,
    validators: {
      onSubmit: ({ value }) => {
        const r = platformSchema.safeParse(value);
        return r.success ? undefined : r.error.issues[0].message;
      },
    },
    onSubmit: ({ value }) => onReview(platformSchema.parse(value)),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(s) => s.values}>
        {(v) => (
          <>
            <div className="st-split">
              <div>
                <span className="st-section-code">
                  DEFAULT PROFIT DISTRIBUTION
                </span>
                <h3>
                  {v.operatorSplit}% operator / {100 - v.operatorSplit}%
                  investors
                </h3>
                <p>
                  Defaults apply to future configuration previews, never to
                  existing package agreements.
                </p>
              </div>
              <label className="st-field">
                Operator share · 0–40%
                <input
                  className="form-range"
                  aria-label="Operator split"
                  type="range"
                  min={0}
                  max={40}
                  value={v.operatorSplit}
                  onChange={(e) =>
                    form.setFieldValue("operatorSplit", Number(e.target.value))
                  }
                />
              </label>
            </div>
            <div className="st-form-grid mt-4">
              {(
                [
                  "minInvestment",
                  "autoApprove",
                  "maxInvestors",
                  "guardianLosses",
                  "drawdown",
                ] as const
              ).map((k) => {
                const cfg = {
                  minInvestment: {
                    label: "Minimum investment / USD",
                    min: 100,
                    max: 50000,
                    step: 100,
                  },
                  autoApprove: {
                    label: "Payout auto-approval threshold / USD",
                    min: 0,
                    max: 1000,
                    step: 10,
                  },
                  maxInvestors: {
                    label: "Maximum investors per package",
                    min: 1,
                    max: 500,
                    step: 1,
                  },
                  guardianLosses: {
                    label: "Default Guardian loss threshold",
                    min: 3,
                    max: 15,
                    step: 1,
                  },
                  drawdown: {
                    label: "Default package drawdown / %",
                    min: 1,
                    max: 15,
                    step: 0.1,
                  },
                }[k];
                return (
                  <label className="st-field" key={k}>
                    {cfg.label}
                    <div className="st-range-value">
                      <input
                        className="form-range"
                        aria-label={`Platform ${k} slider`}
                        type="range"
                        min={cfg.min}
                        max={cfg.max}
                        step={cfg.step}
                        value={v[k]}
                        onChange={(e) =>
                          form.setFieldValue(k, Number(e.target.value))
                        }
                      />
                      <input
                        className="form-control"
                        aria-label={`Platform ${k}`}
                        type="number"
                        step={cfg.step}
                        value={v[k]}
                        onChange={(e) =>
                          form.setFieldValue(k, Number(e.target.value))
                        }
                      />
                    </div>
                  </label>
                );
              })}
              <label className="st-field">
                Payout batch time / UTC
                <input
                  type="time"
                  className="form-control"
                  aria-label="Platform batch time"
                  value={v.batchTime}
                  onChange={(e) =>
                    form.setFieldValue("batchTime", e.target.value)
                  }
                />
                <span className="mono st-muted">
                  Cron: {Number(v.batchTime.slice(3))}{" "}
                  {Number(v.batchTime.slice(0, 2))} * * *
                </span>
              </label>
              <label className="st-field">
                Earnings calculation frequency
                <select
                  className="form-select"
                  aria-label="Platform earnings frequency"
                  value={v.earningsMinutes}
                  onChange={(e) =>
                    form.setFieldValue(
                      "earningsMinutes",
                      Number(
                        e.target.value,
                      ) as PlatformInput["earningsMinutes"],
                    )
                  }
                >
                  {[1, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      Every {n} minute{n === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="st-check mt-4">
              <input
                type="checkbox"
                checked={v.autoVerify}
                onChange={(e) =>
                  form.setFieldValue("autoVerify", e.target.checked)
                }
              />
              Auto-verification preference for future deposit integration
            </label>
            <div className="st-note mt-3">
              No deposit is verified, payout approved, timer started or D-14
              risk policy changed by these defaults. Limits above D-14’s harder
              8/10-loss and 5% drawdown caps require independent production
              reconciliation, not silent propagation.
            </div>
          </>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.errors}>
        {(errors) => (
          <p className="text-loss" role="status">
            {errors.map(String).join("; ")}
          </p>
        )}
      </form.Subscribe>
      <div className="st-form-footer">
        <span className="st-muted">
          Existing packages, funds and bots are not changed.
        </span>
        <button type="submit" className="st-btn st-primary">
          Review platform configuration
        </button>
      </div>
    </form>
  );
}
