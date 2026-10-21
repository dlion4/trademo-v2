import type { Metadata } from "next";
import Link from "next/link";

import { MarketingShell } from "@/components/layout/marketing-shell";
import { formatCurrency } from "@/lib/format";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Overview · tradeMO",
};

export default function InvestorOverviewBridgePage() {
  const { funds, kpis } = getCommandCenterBundle();
  return (
    <MarketingShell rootClass="page-investor-bridge">
      <div className="container-xl py-5">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <span className="eyebrow-label">Investor Workspace · I-1</span>
            <h1 className="mt-1 mb-1">Crowdfunding Pool Allocations</h1>
            <p className="mb-0">
              Live syndicate pools operated on Deriv with proportional net profit distributions.
            </p>
          </div>
          <div className="d-flex gap-2">
            <Link href="/dashboard" className="btn-ghost">
              ← Operator Console (D-1)
            </Link>
            <Link href="/auth/onboarding/investor" className="btn-brand">
              Investor Onboarding →
            </Link>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="surface-card p-4">
              <span className="eyebrow-label">Total Pooled Capital</span>
              <div className="fs-3 fw-semibold mono mt-1">{formatCurrency(kpis.totalCapital, "USD", 0)}</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="surface-card p-4">
              <span className="eyebrow-label">Cumulative Net Disbursed</span>
              <div className="fs-3 fw-semibold mono mt-1 text-accent">{formatCurrency(kpis.distributed)}</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="surface-card p-4">
              <span className="eyebrow-label">Active Pool Backers</span>
              <div className="fs-3 fw-semibold mono mt-1">{kpis.activeInvestors}</div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          {funds.packages.map((p) => (
            <div className="col-md-6" key={p.id}>
              <div className="surface-card p-4 h-100 d-flex flex-column justify-content-between gap-3">
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="pill mono">{p.code}</span>
                    <span className="pill pill-live">{p.status.toUpperCase()}</span>
                  </div>
                  <h2 className="h5 mb-1">{p.name}</h2>
                  <p className="small mb-0">
                    Slot price <span className="mono">{formatCurrency(p.slotPrice, "USD", 0)}</span> ·{" "}
                    {p.filledSlots}/{p.totalSlots} slots filled · Target ROI +{p.expectedROI}%
                  </p>
                </div>
                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span className="mono small">
                    Pool Capital: <strong>{formatCurrency(p.totalCapital, "USD", 0)}</strong>
                  </span>
                  <Link href={`/investor/pools/${p.id}`} className="btn-ghost btn-ghost--sm">
                    View Pool →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MarketingShell>
  );
}
