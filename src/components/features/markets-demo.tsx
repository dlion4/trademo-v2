"use client";

import { useState } from "react";

import { DemoLabel, DemoPanel } from "@/components/features/module-shell";
import { formatPercent, formatPrice } from "@/lib/format";
import type {
  ContractTypeGroupDTO,
  DurationOptionDTO,
  MarketGroupDTO,
} from "@/lib/api/types";

function MarketTabs({ markets }: { markets: MarketGroupDTO[] }) {
  const [activeKey, setActiveKey] = useState(markets[0]?.key ?? "");
  const active = markets.find((market) => market.key === activeKey) ?? markets[0];

  return (
    <>
      <DemoLabel>Markets &amp; symbols</DemoLabel>
      <div className="mk__tabs mb-3">
        {markets.map((market) => (
          <button
            type="button"
            key={market.key}
            className={`mk__tab${market.key === activeKey ? " is-active" : ""}`}
            onClick={() => setActiveKey(market.key)}
          >
            {market.name}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="mk__table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Instrument</th>
              <th>Price</th>
              <th>24h</th>
              <th>Contracts</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {(active?.symbols ?? []).map((symbol) => (
              <tr key={symbol.symbol}>
                <td className="mk__sym">{symbol.symbol}</td>
                <td>{symbol.name}</td>
                <td className="mk__num">{formatPrice(symbol.price, symbol.decimals)}</td>
                <td
                  className="mk__num"
                  style={{ color: symbol.changePercent >= 0 ? "var(--win)" : "var(--loss)" }}
                >
                  {formatPercent(symbol.changePercent)}
                </td>
                <td>{symbol.contracts}</td>
                <td>{symbol.open}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ContractBreakdown({ groups }: { groups: ContractTypeGroupDTO[] }) {
  const max = Math.max(...groups.map((group) => group.count), 1);

  return (
    <>
      <DemoLabel>Contract types breakdown</DemoLabel>
      <div className="bars">
        {groups.map((group) => (
          <div key={group.name}>
            <div className="bar__top">
              <span className="bar__name">{group.name}</span>
              <span className="bar__count">
                {group.count} · {group.examples}
              </span>
            </div>
            <div className="bar__track">
              <div
                className="bar__fill chart-draw"
                style={{ width: `${Math.max(6, Math.round((group.count / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function DurationPicker({ options }: { options: DurationOptionDTO[] }) {
  const [unit, setUnit] = useState(options[0]?.unit ?? "minutes");
  const option = options.find((item) => item.unit === unit) ?? options[0];
  const [value, setValue] = useState(option?.default ?? 1);

  const onUnitChange = (next: DurationOptionDTO["unit"]) => {
    const target = options.find((item) => item.unit === next);
    setUnit(next);
    setValue(target?.default ?? 1);
  };

  if (!option) return null;

  return (
    <>
      <DemoLabel>Duration picker</DemoLabel>
      <div className="dur">
        <div className="dur__units">
          {options.map((item) => (
            <button
              type="button"
              key={item.unit}
              className={`dur__unit${item.unit === unit ? " is-active" : ""}`}
              onClick={() => onUnitChange(item.unit)}
            >
              {item.unit}
            </button>
          ))}
        </div>

        <input
          type="range"
          min={option.min}
          max={option.max}
          step={option.step}
          value={Math.min(Math.max(value, option.min), option.max)}
          onChange={(event) => setValue(Number(event.target.value))}
          aria-label="Contract duration"
        />

        <div className="dur__readout">
          <span className="dur__value">
            {value} {option.unit === "ticks" ? "ticks" : option.unit.replace(/s$/, "")}
            {option.unit !== "ticks" && value !== 1 ? "s" : ""}
          </span>
          <span className="dur__range">
            {option.min}–{option.max} {option.unit}
          </span>
        </div>
        <p className="dur__note">{option.note}</p>
      </div>
    </>
  );
}

export function MarketsDemo({
  demo,
}: {
  demo: Extract<import("@/lib/api/types").FeatureDemoDTO, { kind: "markets" }>;
}) {
  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <DemoPanel title="markets · active_symbols">
          <MarketTabs markets={demo.markets} />
        </DemoPanel>
      </div>
      <div className="col-lg-5">
        <DemoPanel title="contracts · durations">
          <ContractBreakdown groups={demo.contractTypes} />
          <div className="demo__section">
            <DurationPicker options={demo.durations} />
          </div>
        </DemoPanel>
      </div>
    </div>
  );
}
