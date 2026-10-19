import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import type { FeeComparisonRowDTO } from "@/lib/api/types";

interface FeeMatrixProps {
  comparisonRows: FeeComparisonRowDTO[];
}

export function FeeMatrix({ comparisonRows }: FeeMatrixProps) {
  return (
    <section className="section-shell" id="matrix">
      <div className="container-xl">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow-label">Comprehensive Fee Breakdown</span>
            <h2 className="section-head__title">Side-by-side tier comparison</h2>
            <p className="section-head__subtitle">
              Every fee is strictly defined upfront. We charge zero entry or exit fees, apply high-water mark
              loss protection on every cycle, and lower rates as capital increases.
            </p>
          </div>
        </Reveal>

        {/* High Water Mark Banner */}
        <Reveal delay={60}>
          <div className="hwm-banner">
            <div className="hwm-banner__icon">
              <Icon name="shield" size={22} />
            </div>
            <div>
              <h3 className="hwm-banner__title">Guaranteed High-Water Mark Protection</h3>
              <p className="hwm-banner__desc">
                If a market session or trading cycle incurs any drawdown, zero performance fee is taken on
                subsequent gains until the prior peak equity is completely recovered. We only share in true net
                new profit.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="fee-matrix">
            <div className="fee-matrix__scroll">
              <table className="fee-matrix__table">
                <thead>
                  <tr>
                    <th style={{ width: "28%" }}>Account &amp; Management Metric</th>
                    <th style={{ width: "24%" }}>Starter (&lt; $10k)</th>
                    <th style={{ width: "24%" }} className="th--popular">
                      Prime Growth ($10k–$100k) ★
                    </th>
                    <th style={{ width: "24%" }}>Institutional (&gt; $100k)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, index) => (
                    <tr key={index}>
                      <td className="td--feature">{row.feature}</td>
                      <td>{row.tierStarter}</td>
                      <td className="td--popular">{row.tierGrowth}</td>
                      <td>{row.tierInstitutional}</td>
                    </tr>
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
