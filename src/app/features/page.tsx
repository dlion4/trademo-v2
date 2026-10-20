import type { Metadata } from "next";

import { FeaturesPage } from "@/components/features/features-page";
import { FEATURES_FALLBACK } from "@/lib/content/features-content";

export const metadata: Metadata = {
  title: "Platform Features & Capabilities — tradeMO",
  description:
    "Quantitative execution engine, sandboxed strategy sandbox, crowdfunded trade pools, AI Guardian capital protection, and multi-asset market coverage.",
};

/** Page H-2 — Features. Uses bundled content while backend integration is disabled. */
export default function Page() {
  return <FeaturesPage initialContent={FEATURES_FALLBACK} />;
}
