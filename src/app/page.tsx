import { LandingPage } from "@/components/landing/landing-page";
import { getLandingContent } from "@/server/services/landing-service";

export const dynamic = "force-dynamic";

/** Page H-1 — Landing. Content is resolved server-side, then hydrated into TanStack Query. */
export default async function Page() {
  const { content } = await getLandingContent();
  return <LandingPage initialContent={content} />;
}
