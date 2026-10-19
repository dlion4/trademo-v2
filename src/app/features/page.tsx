import type { Metadata } from "next";

import { FeaturesPage } from "@/components/features/features-page";
import { getFeaturesContent } from "@/server/services/features-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Platform Features & Capabilities — tradeMO",
  description:
    "Quantitative execution engine, sandboxed strategy sandbox, crowdfunded trade pools, AI Guardian capital protection, and multi-asset market coverage.",
};

/** Page H-2 — Features. Content resolved server-side, hydrated into TanStack Query. */
export default async function Page() {
  const { content } = await getFeaturesContent();
  return <FeaturesPage initialContent={content} />;
}
