import type { Metadata } from "next";

import { PricingPage } from "@/components/pricing/pricing-page";
import { PRICING_FALLBACK } from "@/lib/content/pricing-content";

export const metadata: Metadata = {
  title: "Pricing & Investor Fee Tiers — tradeMO",
  description:
    "Transparent performance-aligned pricing for crowdfunding trade pools. Starter (<$10k), Prime Growth ($10k-$100k), and Institutional (>$100k) management tiers with High-Water Mark protection.",
};

/** Page H-3 — Pricing. Uses bundled content while backend integration is disabled. */
export default function Page() {
  return <PricingPage initialContent={PRICING_FALLBACK} />;
}
