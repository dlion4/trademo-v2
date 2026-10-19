"use client";

import { useState } from "react";

import { DemoLabel, DemoPanel } from "@/components/features/module-shell";
import type { GuardianEventDTO, GuardianFlowDTO, GuardianRuleDTO } from "@/lib/api/types";

function Rules({ rules, activeId, onSelect }: {
  rules: GuardianRuleDTO[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <DemoLabel>Trigger rules · utilisation against threshold</DemoLabel>
      <div className="rules">
        {rules.map((rule) => (
          <button
            type="button"
            className={`rule${rule.id === activeId ? " is-active" : ""}`}
            key={rule.id}
            onClick={() => onSelect(rule.id)}
          >
            <div className="rule__top">
              <span className="rule__name">{rule.name}</span>
              <span className="rule__threshold">{rule.threshold}</span>
            </div>
            <div className="rule__bar">
              <span
                className={`rule__fill${rule.hot ? " is-hot" : ""}`}
                style={{ width: `${Math.min(100, Math.round(rule.current * 100))}%` }}
              />
            </div>
            <div className="rule__meta">
              <span>{Math.round(rule.current * 100)}% of threshold</span>
              <span>{rule.action}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function EventLog({ events }: { events: GuardianEventDTO[] }) {
  return (
    <>
      <DemoLabel>Trigger event log</DemoLabel>
      <div className="events">
        {events.map((event) => (
          <div className="events__row" key={event.id}>
            <span className="events__time">{event.time}</span>
            <span className={`events__sev--${event.severity}`}>{event.severity.toUpperCase()}</span>
            <span>{event.message}</span>
            <span className="events__hide">{event.scope}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Flow({ steps }: { steps: GuardianFlowDTO[] }) {
  return (
    <>
      <DemoLabel>Auto-pause &amp; cooldown flow</DemoLabel>
      <div className="flow">
        {steps.map((step, index) => (
          <div className="flow__step" key={step.id}>
            <div className="flow__n">{String(index + 1).padStart(2, "0")}</div>
            <div className="flow__t">{step.title}</div>
            <div className="flow__d">{step.description}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function GuardianDemo({
  demo,
}: {
  demo: Extract<import("@/lib/api/types").FeatureDemoDTO, { kind: "guardian" }>;
}) {
  const [activeId, setActiveId] = useState(demo.rules[0]?.id ?? "");

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <DemoPanel title="capital-protection · rules" badge="armed">
          <Rules rules={demo.rules} activeId={activeId} onSelect={setActiveId} />
        </DemoPanel>
      </div>
      <div className="col-lg-6">
        <DemoPanel title="guardian · event log">
          <EventLog events={demo.events} />
          <div className="demo__section">
            <Flow steps={demo.flow} />
          </div>
        </DemoPanel>
      </div>
    </div>
  );
}
