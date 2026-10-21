"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { PoolAssetClassDTO, PricingTierDTO } from "@/lib/api/types";

interface InvestmentCalculatorProps {
  tiers: PricingTierDTO[];
  assetClasses: PoolAssetClassDTO[];
}

const DURATIONS = [15, 30, 45, 60, 90, 180];
const AMOUNT_PRESETS = [1000, 5000, 10000, 25000, 50000, 100000, 250000];

export function InvestmentCalculator({ tiers, assetClasses }: InvestmentCalculatorProps) {
  const [amount, setAmount] = useState<number>(15000);
  const [selectedAssetSlug, setSelectedAssetSlug] = useState<string>(assetClasses[0]?.slug ?? "global-equities");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [riskMultiplier, setRiskMultiplier] = useState<number>(1.0); // 0.8 = Conservative, 1.0 = Standard, 1.25 = High Alpha

  const sliderId = useId();

  const selectedAsset = useMemo(() => {
    return assetClasses.find((asset) => asset.slug === selectedAssetSlug) ?? assetClasses[0];
  }, [assetClasses, selectedAssetSlug]);

  // Determine active tier based on capital amount
  const activeTier = useMemo(() => {
    if (amount < 10000) {
      return tiers.find((t) => t.slug === "starter") ?? tiers[0];
    }
    if (amount < 100000) {
      return tiers.find((t) => t.slug === "growth") ?? tiers[1];
    }
    return tiers.find((t) => t.slug === "institutional") ?? tiers[2] ?? tiers[0];
  }, [tiers, amount]);

  // Mathematical projections
  const math = useMemo(() => {
    const baseMonthlyReturn = (selectedAsset?.avgMonthlyReturnPercent ?? 10.0) * riskMultiplier;
    const durationMonths = durationDays / 30;
    const grossReturnPercent = baseMonthlyReturn * durationMonths;

    const grossProfitUsd = amount * (grossReturnPercent / 100);

    // Prorated annual management fee
    const annualMgmtRate = (activeTier?.managementFeePercent ?? 1.5) / 100;
    const mgmtFeeUsd = amount * annualMgmtRate * (durationDays / 365);

    // Performance fee charged only on positive gross profit after mgmt cost
    const profitBeforePerf = Math.max(0, grossProfitUsd - mgmtFeeUsd);
    const perfFeeRate = (activeTier?.performanceFeePercent ?? 20.0) / 100;
    const perfFeeUsd = profitBeforePerf * perfFeeRate;

    const netProfitUsd = profitBeforePerf - perfFeeUsd;
    const netRoiPercent = amount > 0 ? (netProfitUsd / amount) * 100 : 0;
    const totalMaturityUsd = amount + netProfitUsd;

    const annualizedNetRoi = durationDays > 0 ? netRoiPercent * (365 / durationDays) : 0;
    const dailyRunRateUsd = durationDays > 0 ? netProfitUsd / durationDays : 0;

    return {
      grossProfitUsd,
      mgmtFeeUsd,
      perfFeeUsd,
      netProfitUsd,
      netRoiPercent,
      totalMaturityUsd,
      annualizedNetRoi,
      dailyRunRateUsd,
      grossReturnPercent,
    };
  }, [amount, selectedAsset, durationDays, riskMultiplier, activeTier]);

  return (
    <section className="calc-section" id="calculator">
      <div className="container-xl">
        <Reveal>
          <div className="section-head section-head--center">
            <span className="eyebrow-label">
              <Icon name="sliders" size={14} />
              Interactive Return Estimator
            </span>
            <h2 className="section-head__title">Calculate your projected net return</h2>
            <p className="section-head__subtitle">
              Model potential yields based on your investment capital, chosen crowdfunding asset pool,
              trade duration, and active management fee tier.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="calc-panel">
            <div className="calc-grid">
              {/* Left Column: Interactive Inputs */}
              <div>
                {/* 1. Investment Amount */}
                <div className="calc-field">
                  <div className="calc-field__head">
                    <label htmlFor={sliderId} className="calc-field__label">
                      Investment Capital (USD)
                    </label>
                    <span className="calc-field__display">{formatCurrency(amount, "USD", 0)}</span>
                  </div>

                  <div className="calc-input-wrap">
                    <span className="calc-input-prefix">$</span>
                    <input
                      type="number"
                      min={250}
                      max={1000000}
                      step={250}
                      value={amount}
                      onChange={(e) => setAmount(Math.max(250, Number(e.target.value) || 0))}
                      className="calc-amount-input"
                      aria-label="Investment amount in USD"
                    />
                  </div>

                  <div className="calc-slider-track">
                    <input
                      id={sliderId}
                      type="range"
                      min={250}
                      max={250000}
                      step={250}
                      value={Math.min(250000, amount)}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      aria-label="Investment amount slider"
                    />
                  </div>

                  <div className="calc-presets">
                    {AMOUNT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`calc-preset-btn${amount === preset ? " is-active" : ""}`}
                        onClick={() => setAmount(preset)}
                      >
                        ${formatNumber(preset / 1000, 0)}k
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Crowdfunding Asset Class Pool */}
                <div className="calc-field">
                  <div className="calc-field__head">
                    <span className="calc-field__label">Crowdfunding Trade Pool / Asset Class</span>
                    <span className="text-muted mono" style={{ fontSize: "0.78rem" }}>
                      Avg. {selectedAsset?.avgMonthlyReturnPercent}% / mo
                    </span>
                  </div>

                  <div className="calc-pills-grid">
                    {assetClasses.map((asset) => (
                      <button
                        key={asset.slug}
                        type="button"
                        className={`calc-pill-card${selectedAssetSlug === asset.slug ? " is-active" : ""}`}
                        onClick={() => setSelectedAssetSlug(asset.slug)}
                      >
                        <div className="calc-pill-card__name">{asset.name}</div>
                        <div className="calc-pill-card__sub">{asset.category}</div>
                        <div className="calc-pill-card__yield">~{asset.avgMonthlyReturnPercent}% / mo target</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Trade Duration */}
                <div className="calc-field">
                  <div className="calc-field__head">
                    <span className="calc-field__label">Pool Holding Duration</span>
                    <span className="text-muted mono" style={{ fontSize: "0.8rem" }}>
                      {durationDays} Days ({formatNumber(durationDays / 30, 1)} Months)
                    </span>
                  </div>

                  <div className="calc-durations">
                    {DURATIONS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={`calc-dur-btn${durationDays === days ? " is-active" : ""}`}
                        onClick={() => setDurationDays(days)}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Strategy Risk Profile Multiplier */}
                <div className="calc-field mb-0">
                  <div className="calc-field__head">
                    <span className="calc-field__label">Strategy Execution Profile</span>
                  </div>
                  <div className="btn-group w-100" role="group" aria-label="Risk profile">
                    <button
                      type="button"
                      className={`btn btn-sm ${riskMultiplier === 0.8 ? "btn-dark" : "btn-outline-secondary"}`}
                      onClick={() => setRiskMultiplier(0.8)}
                    >
                      Conservative (Lower Vol)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${riskMultiplier === 1.0 ? "btn-dark" : "btn-outline-secondary"}`}
                      onClick={() => setRiskMultiplier(1.0)}
                    >
                      Balanced (Standard)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${riskMultiplier === 1.25 ? "btn-dark" : "btn-outline-secondary"}`}
                      onClick={() => setRiskMultiplier(1.25)}
                    >
                      High Alpha (Aggressive)
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Projection Card */}
              <div>
                <div className="calc-result-box">
                  <div className="calc-tier-badge">
                    <Icon name="shield" size={14} />
                    Active Tier: <strong>{activeTier?.name}</strong> (
                    {activeTier?.performanceFeePercent}% performance cut)
                  </div>

                  <div className="calc-summary-hero">
                    <span className="calc-summary-hero__label">Projected Net Investor Profit</span>
                    <div className="calc-summary-hero__val">
                      +{formatCurrency(math.netProfitUsd, "USD", 2)}
                    </div>
                    <div className="calc-summary-hero__roi">
                      <Icon name="trendUp" size={16} />
                      <strong>+{formatPercent(math.netRoiPercent)} Net Return</strong> in {durationDays} days
                    </div>
                  </div>

                  <div className="calc-breakdown-lines">
                    <div className="calc-line">
                      <span className="calc-line__k">Initial Capital</span>
                      <span className="calc-line__v">{formatCurrency(amount, "USD", 0)}</span>
                    </div>

                    <div className="calc-line">
                      <span className="calc-line__k">Gross Trading Return</span>
                      <span className="calc-line__v">+{formatCurrency(math.grossProfitUsd, "USD", 2)}</span>
                    </div>

                    <div className="calc-line">
                      <span className="calc-line__k">
                        Management Fee ({activeTier?.managementFeePercent}% p.a.)
                      </span>
                      <span className="calc-line__v calc-line__v--fee">
                        −{formatCurrency(math.mgmtFeeUsd, "USD", 2)}
                      </span>
                    </div>

                    <div className="calc-line">
                      <span className="calc-line__k">
                        Platform Performance Cut ({activeTier?.performanceFeePercent}%)
                      </span>
                      <span className="calc-line__v calc-line__v--fee">
                        −{formatCurrency(math.perfFeeUsd, "USD", 2)}
                      </span>
                    </div>

                    <div className="calc-line calc-line--highlight">
                      <span className="calc-line__k">Total Balance at Maturity</span>
                      <span className="calc-line__v">{formatCurrency(math.totalMaturityUsd, "USD", 2)}</span>
                    </div>

                    <div className="calc-line">
                      <span className="calc-line__k">Annualized Equivalent Run-Rate</span>
                      <span className="calc-line__v" style={{ color: "var(--accent)" }}>
                        ~{formatPercent(math.annualizedNetRoi)} / yr
                      </span>
                    </div>

                    <div className="calc-line">
                      <span className="calc-line__k">Average Daily Distribution Rate</span>
                      <span className="calc-line__v">+{formatCurrency(math.dailyRunRateUsd, "USD", 2)} / day</span>
                    </div>
                  </div>

                  <Link
                    href={`/auth/signup?role=investor&pool=${selectedAsset?.slug}&amount=${amount}&duration=${durationDays}`}
                    className="btn-brand calc-cta-btn"
                  >
                    Back This Pool Allocation
                    <Icon name="arrowRight" size={16} />
                  </Link>

                  <p className="text-muted text-center mb-0 mt-3" style={{ fontSize: "0.74rem" }}>
                    * Historical projections based on backtested quantitative models. Past performance does not
                    guarantee future results. High-Water Mark protections apply to all pools.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
