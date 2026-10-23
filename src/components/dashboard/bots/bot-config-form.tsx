"use client";
import { useRef } from "react";
import { useForm } from "@tanstack/react-form";
import {
  botStrategies,
  symbols,
  paramsDefaults,
  configSchema,
  configIssues,
  sequenceExposure,
  type BotConfig,
  type BotWorkspace,
} from "@/lib/bots/model";
export function BotConfigForm({
  data,
  botId,
  defaults,
  onReview,
  onTest,
}: {
  data: BotWorkspace;
  botId: string;
  defaults: BotConfig;
  onReview: (c: BotConfig) => void;
  onTest: () => void;
}) {
  const action = useRef("save");
  const form = useForm({
    defaultValues: {
      ...defaults,
      paramsText: JSON.stringify(defaults.params, null, 2),
    },
    validators: {
      onSubmit: ({ value }) => {
        try {
          const params = JSON.parse(value.paramsText);
          const parsed = configSchema.safeParse({ ...value, params });
          return parsed.success ? undefined : parsed.error.issues[0].message;
        } catch {
          return "Strategy parameters must be valid JSON";
        }
      },
    },
    onSubmit: ({ value }) =>
      onReview(
        configSchema.parse({ ...value, params: JSON.parse(value.paramsText) }),
      ),
  });
  return (
    <form
      className="bt-config-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (action.current === "test") onTest();
        else void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(s) => s.values}>
        {(v) => {
          let parsed: BotConfig | undefined;
          try {
            parsed = { ...v, params: JSON.parse(v.paramsText) };
          } catch {}
          const issues = parsed
            ? configIssues(data, botId, parsed)
            : ["Enter valid JSON strategy parameters"];
          return (
            <>
              <div className="bt-form-section">
                <h3>Instrument & strategy</h3>
                <div className="bt-form-grid">
                  <label className="bt-field">
                    Symbol · type to search
                    <input
                      className="form-control"
                      aria-label="Config symbol"
                      list={`symbols-${botId}`}
                      value={v.symbol}
                      onChange={(e) =>
                        form.setFieldValue(
                          "symbol",
                          e.target.value as BotConfig["symbol"],
                        )
                      }
                    />
                    <datalist id={`symbols-${botId}`}>
                      {symbols.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </label>
                  <label className="bt-field">
                    Strategy
                    <select
                      className="form-select"
                      aria-label="Config strategy"
                      value={v.strategy}
                      onChange={(e) => {
                        const strategy = e.target
                          .value as BotConfig["strategy"];
                        form.setFieldValue("strategy", strategy);
                        if (strategy !== "Custom script")
                          form.setFieldValue("scriptId", null);
                        form.setFieldValue(
                          "paramsText",
                          JSON.stringify(paramsDefaults[strategy], null, 2),
                        );
                        if (strategy === "Even/Odd")
                          form.setFieldValue("contract", "DIGITEVEN");
                      }}
                    >
                      {botStrategies.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Contract
                    <select
                      className="form-select"
                      aria-label="Config contract"
                      value={v.contract}
                      onChange={(e) =>
                        form.setFieldValue(
                          "contract",
                          e.target.value as BotConfig["contract"],
                        )
                      }
                    >
                      {[
                        "CALL",
                        "PUT",
                        "DIGITEVEN",
                        "DIGITODD",
                        "DIGITOVER",
                        "DIGITUNDER",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bt-field">
                    Duration unit
                    <select
                      className="form-select"
                      aria-label="Config unit"
                      value={v.unit}
                      onChange={(e) =>
                        form.setFieldValue(
                          "unit",
                          e.target.value as BotConfig["unit"],
                        )
                      }
                    >
                      <option>ticks</option>
                      <option>seconds</option>
                    </select>
                  </label>
                  {(
                    [
                      "initialStake",
                      "currentStake",
                      "maxStake",
                      "duration",
                      "capitalBudget",
                    ] as const
                  ).map((k) => (
                    <label className="bt-field" key={k}>
                      {
                        {
                          initialStake: "Initial stake / USD",
                          currentStake: "Current stake / USD",
                          maxStake: "Maximum stake / USD",
                          duration: "Duration",
                          capitalBudget: "Capital budget / USD",
                        }[k]
                      }
                      <input
                        className="form-control"
                        aria-label={`Config ${k}`}
                        type="number"
                        step={k === "duration" ? 1 : 0.01}
                        value={v[k]}
                        onChange={(e) =>
                          form.setFieldValue(k, Number(e.target.value))
                        }
                      />
                    </label>
                  ))}
                </div>
                {v.strategy === "Custom script" && (
                  <label className="bt-field mt-3">
                    Attached strategy source
                    <select
                      aria-label="Config script"
                      className="form-select"
                      value={v.scriptId ?? ""}
                      onChange={(e) =>
                        form.setFieldValue("scriptId", e.target.value || null)
                      }
                    >
                      <option value="">Select a saved script</option>
                      {data.scripts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="bt-field mt-3">
                  Strategy parameters · JSON
                  <textarea
                    className="form-control bt-source"
                    aria-label="Strategy parameters JSON"
                    rows={5}
                    value={v.paramsText}
                    onChange={(e) =>
                      form.setFieldValue("paramsText", e.target.value)
                    }
                  />
                </label>
              </div>
              <div className="bt-form-section">
                <h3>Package capital allocation</h3>
                <p className="bt-muted">
                  Percentage shares of this bot’s capital budget; not an actual
                  transfer. Active/paused bots reserve modeled capital. Selected
                  shares must total 100%.
                </p>
                {data.pools.map((p) => {
                  const a = v.allocations.find((a) => a.pool === p.code);
                  return (
                    <div className="bt-allocation" key={p.code}>
                      <label className="bt-check">
                        <input
                          type="checkbox"
                          checked={!!a}
                          onChange={() =>
                            form.setFieldValue(
                              "allocations",
                              a
                                ? v.allocations.filter((x) => x.pool !== p.code)
                                : [
                                    ...v.allocations,
                                    { pool: p.code, percent: 100 },
                                  ],
                            )
                          }
                        />
                        <span>
                          <b className="mono">{p.code}</b>
                          <small>{p.name}</small>
                        </span>
                      </label>
                      <label className="bt-field">
                        Share / %
                        <input
                          className="form-control"
                          aria-label={`Allocation ${p.code}`}
                          type="number"
                          min={0.01}
                          max={100}
                          step={0.01}
                          disabled={!a}
                          value={a?.percent ?? 0}
                          onChange={(e) =>
                            form.setFieldValue(
                              "allocations",
                              v.allocations.map((x) =>
                                x.pool === p.code
                                  ? { ...x, percent: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <strong className="mono">
                        $
                        {((v.capitalBudget * (a?.percent ?? 0)) / 100).toFixed(
                          2,
                        )}
                      </strong>
                    </div>
                  );
                })}
              </div>
              <div className="bt-form-section">
                <h3>Risk limits & Guardian controls</h3>
                <div className="bt-form-grid">
                  {(
                    [
                      "takeProfit",
                      "stopLoss",
                      "maxDailyLoss",
                      "maxDailyTrades",
                      "cooldownLosses",
                      "cooldownMinutes",
                      "maxConcurrent",
                      "lossThreshold",
                      "drawdown",
                      "rotationMinutes",
                    ] as const
                  ).map((k) => (
                    <label className="bt-field" key={k}>
                      {
                        {
                          takeProfit: "Take profit / USD per day",
                          stopLoss: "Stop loss / USD",
                          maxDailyLoss: "Maximum daily loss / USD",
                          maxDailyTrades: "Maximum daily trades",
                          cooldownLosses: "Cooldown after losses",
                          cooldownMinutes: "Cooldown / minutes",
                          maxConcurrent: "Maximum concurrent trades",
                          lossThreshold: "Guardian loss threshold",
                          drawdown: "Drawdown cap / %",
                          rotationMinutes: "Rotation interval / minutes",
                        }[k]
                      }
                      <input
                        className="form-control"
                        type="number"
                        aria-label={`Config ${k}`}
                        step={k === "drawdown" ? 0.1 : 1}
                        value={v[k]}
                        onChange={(e) =>
                          form.setFieldValue(k, Number(e.target.value))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="bt-actions mt-3">
                  <label className="bt-check">
                    <input type="checkbox" checked disabled />
                    Guardian required
                  </label>
                  <label className="bt-check">
                    <input
                      type="checkbox"
                      checked={v.rotation}
                      onChange={(e) =>
                        form.setFieldValue("rotation", e.target.checked)
                      }
                    />
                    Rotate reference market
                  </label>
                </div>
              </div>
              <div className="bt-note">
                <b>
                  Full modeled sequence exposure:{" "}
                  {parsed && Number.isFinite(sequenceExposure(parsed))
                    ? `$${(sequenceExposure(parsed) * v.maxConcurrent).toFixed(2)}`
                    : "Check strategy parameters"}
                </b>
                <p>
                  Progressions are capped by maximum stake, multiplied by
                  configured concurrency. No profit, fees, slippage, loss
                  recovery or executable risk protection is implied.
                </p>
                {issues.length > 0 && (
                  <ul className="text-loss">
                    {issues.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          );
        }}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.errors}>
        {(errors) => (
          <p role="status" className="text-loss">
            {errors.map(String).join("; ")}
          </p>
        )}
      </form.Subscribe>
      <div className="bt-actions">
        <button
          className="bt-btn bt-primary"
          type="submit"
          onClick={() => (action.current = "save")}
        >
          Review config changes
        </button>
        <button className="bt-btn" type="button" onClick={onTest}>
          Test saved config · 1 trade plan
        </button>
      </div>
      <small className="bt-muted">
        Test uses the saved configuration, not unsaved edits. Pause/stop a
        running bot before saving changes.
      </small>
    </form>
  );
}
