"use client";

import { useState } from "react";

import { DemoLabel, DemoPanel } from "@/components/features/module-shell";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type {
  PayoutMilestoneDTO,
  PoolStageDTO,
  ShareExampleDTO,
} from "@/lib/api/types";

/** 1 · Pool lifecycle rail — click a stage to read its detail. */
function Lifecycle({ stages }: { stages: PoolStageDTO[] }) {
  const [active, setActive] = useState(3); // default to TRADING
  const current = stages[active];

  return (
    <>
      <DemoLabel>Pool lifecycle · 6 stages</DemoLabel>
      <div className="lifecycle">
        <div className="lifecycle__rail">
          {stages.map((stage, index) => (
            <button
              type="button"
              className={`lifecycle__node${index === active ? " is-active" : ""}${
                index < active ? " is-done" : ""
              }`}
              key={stage.key}
              onClick={() => setActive(index)}
              aria-pressed={index === active}
            >
              <span className="lifecycle__dot">{index + 1}</span>
              <span className="lifecycle__name">{stage.name}</span>
            </button>
          ))}
        </div>

        {current ? (
          <div className="lifecycle__detail">
            <div className="lifecycle__detail-title">
              {current.title}
            </div>
            <p className="lifecycle__detail-text mb-0">{current.description}</p>
            <div className="lifecycle__detail-meta">
              {current.meta.map((item) => (
                <span className="pill" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** 2 · Investor share calculator — the profit-split maths, live. */
function ShareCalculator({ example }: { example: ShareExampleDTO }) {
  const [invested, setInvested] = useState(example.invested);
  const [poolCapital, setPoolCapital] = useState(example.poolCapital);
  const [poolPnl, setPoolPnl] = useState(example.poolPnl);
  const [operatorShare, setOperatorShare] = useState(example.operatorSharePercent);

  const share = poolCapital > 0 ? invested / poolCapital : 0;
  const gross = poolPnl * share;
  const cut = gross * (operatorShare / 100);
  const net = gross - cut;
  const roi = invested > 0 ? (net / invested) * 100 : 0;

  return (
    <>
      <DemoLabel>Investor share calculation</DemoLabel>
      <div className="calc">
        <div className="calc__grid">
          <div>
            <div className="calc__control">
              <div className="calc__control-top">
                <span className="calc__key">Your investment</span>
                <span className="calc__val">{formatCurrency(invested, "USD", 0)}</span>
              </div>
              <input
                type="range"
                min={100}
                max={20000}
                step={100}
                value={invested}
                onChange={(event) => setInvested(Number(event.target.value))}
                aria-label="Your investment"
              />
            </div>

            <div className="calc__control">
              <div className="calc__control-top">
                <span className="calc__key">Pool capital</span>
                <span className="calc__val">{formatCurrency(poolCapital, "USD", 0)}</span>
              </div>
              <input
                type="range"
                min={5000}
                max={100000}
                step={500}
                value={poolCapital}
                onChange={(event) => setPoolCapital(Number(event.target.value))}
                aria-label="Pool capital"
              />
            </div>

            <div className="calc__control">
              <div className="calc__control-top">
                <span className="calc__key">Pool P&amp;L</span>
                <span className="calc__val">{formatCurrency(poolPnl, "USD", 0)}</span>
              </div>
              <input
                type="range"
                min={-5000}
                max={10000}
                step={50}
                value={poolPnl}
                onChange={(event) => setPoolPnl(Number(event.target.value))}
                aria-label="Pool P&L"
              />
            </div>

            <div className="calc__control">
              <div className="calc__control-top">
                <span className="calc__key">Operator share</span>
                <span className="calc__val">{formatNumber(operatorShare)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={operatorShare}
                onChange={(event) => setOperatorShare(Number(event.target.value))}
                aria-label="Operator share"
              />
            </div>
          </div>

          <div className="calc__results">
            <div className="calc__line">
              <span className="calc__line-key">Your share of pool</span>
              <span className="calc__line-val">{(share * 100).toFixed(2)}%</span>
            </div>
            <div className="calc__line">
              <span className="calc__line-key">Gross earnings</span>
              <span className="calc__line-val">{formatCurrency(gross, "USD", 2)}</span>
            </div>
            <div className="calc__line">
              <span className="calc__line-key">Platform cut ({operatorShare}%)</span>
              <span className="calc__line-val">−{formatCurrency(cut, "USD", 2)}</span>
            </div>
            <div className="calc__line calc__line--total">
              <span className="calc__line-key">Net earnings</span>
              <span className="calc__line-val">{formatCurrency(net, "USD", 2)}</span>
            </div>
            <div className="calc__line">
              <span className="calc__line-key">Current ROI</span>
              <span className="calc__line-val">{formatPercent(roi)}</span>
            </div>
          </div>
        </div>
        <p className="demo__hint">{example.note}</p>
      </div>
    </>
  );
}

/** 3 · Payout timeline. */
function PayoutTimeline({ milestones }: { milestones: PayoutMilestoneDTO[] }) {
  return (
    <>
      <DemoLabel>Payout timeline</DemoLabel>
      <div className="timeline">
        {milestones.map((milestone) => (
          <div className={`timeline__item${milestone.done ? " is-done" : ""}`} key={milestone.id}>
            <span className="timeline__tick" />
            <div className="timeline__when">{milestone.when}</div>
            <div className="timeline__what">{milestone.what}</div>
            <div className="timeline__note">{milestone.note}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function PoolsDemo({
  demo,
}: {
  demo: Extract<import("@/lib/api/types").FeatureDemoDTO, { kind: "pools" }>;
}) {
  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <DemoPanel title="PKG-01 · lifecycle">
          <Lifecycle stages={demo.lifecycle} />
          <div className="demo__section">
            <PayoutTimeline milestones={demo.timeline} />
          </div>
        </DemoPanel>
      </div>
      <div className="col-lg-5">
        <DemoPanel title="share-calculator · live"> 
          <ShareCalculator example={demo.share} />
        </DemoPanel>
      </div>
    </div>
  );
}
