import { LandingPage } from "@/components/landing/landing-page";
import { LANDING_FALLBACK } from "@/lib/content/landing-content";

/** Page H-1 — Landing. Uses bundled content while backend integration is disabled. */
export default function Page() {
  return <LandingPage initialContent={LANDING_FALLBACK} />;
}
