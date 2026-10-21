import Link from "next/link";

import { MarketingShell } from "@/components/layout/marketing-shell";

const LEGAL_COPY: Record<string, { title: string; updated: string; clauses: Array<{ h: string; p: string }> }> = {
  terms: {
    title: "Terms of Service",
    updated: "Effective October 2026",
    clauses: [
      { h: "1. Platform Architecture", p: "tradeMO provides operator execution tooling connected to Deriv WebSocket endpoints alongside structured crowdfunding pool accounting." },
      { h: "2. High-Water Mark Fee Governance", p: "Operator performance fees apply strictly to net positive cycle profits above the pool High-Water Mark." },
      { h: "3. Settlement & Withdrawals", p: "Pool distributions credit directly to verified investor wallets and settle across approved banking, card, mobile money, or digital asset rails." },
    ],
  },
  privacy: {
    title: "Privacy & Data Protection Policy",
    updated: "Effective October 2026",
    clauses: [
      { h: "1. Credential Encryption", p: "Deriv OAuth tokens are encrypted at rest with AES-256-GCM and never exposed to client bundles." },
      { h: "2. KYC & AML Records", p: "Identity verification documents are stored in access-controlled encrypted buckets solely for regulatory compliance." },
    ],
  },
  risk: {
    title: "Trading & Pool Risk Disclosure",
    updated: "Effective October 2026",
    clauses: [
      { h: "1. Market & Derivatives Risk", p: "Synthetic indices, FX, commodities, and digital asset contracts carry risk of partial or total loss of capital. Past pool returns do not guarantee future performance." },
      { h: "2. Circuit Breakers", p: "Automated drawdown guardrails pause execution when configured thresholds are reached, subject to market liquidity and network latency." },
    ],
  },
};

type Params = Promise<{ slug: string }>;

export default async function LegalDocPage({ params }: { params: Params }) {
  const { slug } = await params;
  const doc = LEGAL_COPY[slug] ?? LEGAL_COPY.terms;
  return (
    <MarketingShell rootClass="page-legal-doc">
      <div className="container-xl py-5" style={{ maxWidth: 820 }}>
        <span className="eyebrow-label">{doc.updated}</span>
        <h1 className="mt-2 mb-4">{doc.title}</h1>
        <div className="d-flex flex-column gap-3">
          {doc.clauses.map((c) => (
            <div key={c.h} className="surface-card p-4">
              <h2 className="h5 mb-2">{c.h}</h2>
              <p className="mb-0">{c.p}</p>
            </div>
          ))}
        </div>
        <div className="d-flex gap-2 mt-4">
          <Link href="/dashboard" className="btn-brand">Operator Console</Link>
          <Link href="/" className="btn-ghost">Home</Link>
        </div>
      </div>
    </MarketingShell>
  );
}
