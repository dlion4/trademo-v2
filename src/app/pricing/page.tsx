import type { Metadata } from "next";

import { PricingPage } from "@/components/pricing/pricing-page";
import { getPricingContent } from "@/server/services/pricing-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing & Investor Fee Tiers — tradeMO",
  description:
    "Transparent performance-aligned pricing for crowdfunding trade pools. Starter (<$10k), Prime Growth ($10k-$100k), and Institutional (>$100k) management tiers with High-Water Mark protection.",
};

/** Page H-3 — Pricing & Investor Fee Tiers. SSR resolved & TanStack Query hydrated. */
export default async function Page() {
  const { content } = await getPricingContent();
  return <PricingPage initialContent={content} />;
}
