import type { ReactNode } from "react";

import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNavbar } from "@/components/landing/site-navbar";
import type { ContentSource } from "@/lib/api/types";

interface MarketingShellProps {
  /** Page root class — must match the page stylesheet scope (e.g. .page-features). */
  rootClass: string;
  contentSource?: ContentSource;
  children: ReactNode;
}

/** Shared marketing shell: sticky navbar, page root, footer. */
export function MarketingShell({ rootClass, contentSource, children }: MarketingShellProps) {
  return (
    <div className={`${rootClass} app-shell`}>
      <SiteNavbar />
      <main className="app-shell__main">{children}</main>
      <SiteFooter contentSource={contentSource} />
    </div>
  );
}
