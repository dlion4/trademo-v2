import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface AuthShellProps {
  /** Page root class — matches src/styles/pages/auth-*.css scope. */
  rootClass: string;
  /** Optional right-side top bar action, e.g. "No account? Sign up". */
  aside?: { prompt: string; label: string; href: string };
  /** Centered card width variant. "none" = page renders its own layout. */
  width?: "sm" | "md" | "lg" | "none";
  children: ReactNode;
}

/**
 * Minimal auth chrome: brand + contextual switch link, centered content,
 * compliance footer. Deliberately quieter than the marketing navbar.
 */
export function AuthShell({ rootClass, aside, width = "sm", children }: AuthShellProps) {
  return (
    <div className={cn(rootClass, "auth-shell")}>
      <header className="auth-topbar">
        <div className="container-xl auth-topbar__inner">
          <Link href="/" className="brand-mark" aria-label="tradeMO home">
            <span className="brand-mark__glyph">tM</span>
            <span>
              tradeMO
              <span className="brand-mark__sub">Crowdfunded Trade Pools</span>
            </span>
          </Link>
          <div className="auth-topbar__aside">
            {aside ? (
              <>
                <span className="d-none d-sm-inline">{aside.prompt}</span>
                <Link href={aside.href} className="btn-ghost btn-ghost--sm">
                  {aside.label}
                </Link>
              </>
            ) : (
              <Link href="/" className="auth-topbar__back">
                <Icon name="arrowLeft" size={15} />
                Back to site
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="auth-main">
        {width === "none" ? children : <div className={cn("auth-frame", `auth-frame--${width}`)}>{children}</div>}
      </main>

      <footer className="auth-footer">
        <div className="container-xl auth-footer__inner">
          <span>© 2026 tradeMO Ltd.</span>
          <nav aria-label="Legal" className="auth-footer__links">
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/risk">Risk disclosure</Link>
            <a href="mailto:support@trademo.io">Support</a>
          </nav>
          <span className="auth-footer__secure">
            <Icon name="lock" size={13} /> TLS 1.3 · AES-256
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Card header used by the centered pages. */
export function AuthHeading({
  eyebrow,
  title,
  subtitle,
  mark,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  mark?: ReactNode;
}) {
  return (
    <div className="auth-heading">
      {mark}
      {eyebrow ? <span className="eyebrow-label">{eyebrow}</span> : null}
      <h1 className="auth-heading__title">{title}</h1>
      {subtitle ? <p className="auth-heading__subtitle">{subtitle}</p> : null}
    </div>
  );
}
