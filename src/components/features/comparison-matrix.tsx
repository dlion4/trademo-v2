import { Fragment } from "react";

import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import type { MatrixRowDTO, SupportLevel } from "@/lib/api/types";

const SUPPORT_LABEL: Record<SupportLevel, string> = {
  full: "Full",
  partial: "Partial",
  none: "—",
};

function SupportCell({ level }: { level: SupportLevel }) {
  if (level === "none") {
    return (
      <span className="support support--none">
        <Icon name="minus" size={13} />
        {SUPPORT_LABEL.none}
      </span>
    );
  }

  return (
    <span className={`support support--${level}`}>
      <Icon name={level === "full" ? "check" : "chevronDown"} size={13} />
      {SUPPORT_LABEL[level]}
    </span>
  );
}

/** Operator vs investor capability matrix. Collapses to stacked cards < md. */
export function ComparisonMatrix({ rows }: { rows: MatrixRowDTO[] }) {
  const groups = rows.reduce<Record<string, MatrixRowDTO[]>>((accumulator, row) => {
    accumulator[row.group] = accumulator[row.group] ?? [];
    accumulator[row.group].push(row);
    return accumulator;
  }, {});

  return (
    <section className="section-shell" id="matrix">
      <div className="container-xl">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow-label">Feature matrix</span>
            <h2 className="section-head__title">What operators get, what investors get</h2>
            <p className="section-head__subtitle">
              Both roles live in the same platform. Operators run the engine; investors fund the pools
              and get full visibility into everything that touches their capital.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="matrix">
            <div className="matrix__scroll">
              <table className="matrix__table">
                <thead>
                  <tr>
                    <th style={{ width: "38%" }}>Capability</th>
                    <th style={{ width: "17%" }}>Operator</th>
                    <th style={{ width: "17%" }}>Investor</th>
                    <th style={{ width: "28%" }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groups).map(([group, groupRows]) => (
                    <Fragment key={group}>
                      <tr className="matrix__group">
                        <td colSpan={4}>{group}</td>
                      </tr>
                      {groupRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className="matrix__cap">{row.capability}</span>
                          </td>
                          <td>
                            <SupportCell level={row.operator} />
                          </td>
                          <td>
                            <SupportCell level={row.investor} />
                          </td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
