import Link from "next/link";

import type { ContentSource } from "@/lib/api/types";

const FOOTER_COLUMNS = [
  {
    heading: "Platform",
    links: [
      { label: "Bot engine", href: "/features#bot-engine" },
      { label: "Capital pools", href: "/features#crowdfunding" },
      { label: "Script engine", href: "/features#script-engine" },
      { label: "AI Guardian", href: "/features#ai-guardian" },
    ],
  },
  {
    heading: "For investors",
    links: [
      { label: "Browse pools", href: "/investor/pools" },
      { label: "Investment calculator", href: "/investor/calculator" },
      { label: "Earnings & reports", href: "/investor/earnings" },
      { label: "Wallet & payouts", href: "/investor/wallet" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Create account", href: "/auth/signup" },
      { label: "Log in", href: "/auth/signin" },
      { label: "Status", href: "/api/health" },
    ],
  },
];

interface SiteFooterProps {
  /** Shows where the rendered content came from (DB seed vs bundled fallback). */
  contentSource?: ContentSource;
}

export function SiteFooter({ contentSource = "fallback" }: SiteFooterProps) {
  return (
    <footer className="app-footer">
      <div className="container-xl">
        <div className="app-footer__grid">
          <div>
            <Link href="/" className="brand-mark mb-3">
              <span className="brand-mark__glyph">tM</span>
              <span>
                tradeMO
                <span className="brand-mark__sub">Crowdfunded Trade Pools</span>
              </span>
            </Link>
            <p className="app-footer__blurb">
              Institutional quantitative trading infrastructure for crowdfunded capital pools — back
              curated multi-asset trade strategies and receive auditable, proportional profit distributions.
            </p>
            <div className="d-flex flex-wrap gap-2 mt-3">
              <span className="pill pill-live">
                <span className="live-dot" /> DMA Liquidity Execution
              </span>
              <span className="pill">256-bit Capital Vault</span>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="app-footer__heading">{column.heading}</p>
              {column.links.map((link) => (
                <Link key={link.label} href={link.href} className="app-footer__link">
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="app-footer__bottom">
          <span>© {new Date().getFullYear()} tradeMO. Trading involves risk.</span>
          <span className="d-inline-flex align-items-center gap-2">
            <span className={`pill ${contentSource === "database" ? "pill-live" : "pill-amber"}`}>
              <span className="live-dot" />
              content · {contentSource}
            </span>
            Built for investors and quantitative backers · Not financial advice · All trading involves risk.
          </span>
        </div>
      </div>
    </footer>
  );
}
