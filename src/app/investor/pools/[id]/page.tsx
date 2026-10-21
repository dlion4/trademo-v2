import Link from "next/link";

import { MarketingShell } from "@/components/layout/marketing-shell";
import { formatCurrency } from "@/lib/format";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function InvestorPoolDetailBridge({ params }: { params: Params }) {
  const { id } = await params;
  const { funds } = getCommandCenterBundle();
  const pkg = funds.packages.find((p) => p.id === id) ?? funds.packages[0];

  return (
    <MarketingShell rootClass="page-pool-bridge">
      <div className="container-xl py-5">
        <Link href="/investor" className="small fw-semibold d-inline-block mb-3">
          ← All Crowdfunding Pools
        </Link>
        <div className="surface-card p-4">
          <span className="pill mono mb-2">{pkg.code}</span>
          <h1 className="h3">{pkg.name}</h1>
          <p>
            Slot Price: <strong className="mono">{formatCurrency(pkg.slotPrice, "USD", 0)}</strong> · Filled:{" "}
            <strong className="mono">{pkg.filledSlots}/{pkg.totalSlots}</strong> · Investor Profit Share:{" "}
            <strong className="mono">{pkg.investorSharePercent}%</strong>
          </p>
          <div className="d-flex gap-2 mt-3">
            <Link href="/pricing" className="btn-brand">
              Calculate Expected Return →
            </Link>
            <Link href="/dashboard" className="btn-ghost">
              Operator Console (D-1)
            </Link>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
