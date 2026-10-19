"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Markets", href: "/#markets" },
];

export function SiteNavbar() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    const base = href.split("#")[0];
    if (!base || base === "/") return pathname === "/";
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("app-navbar", stuck && "is-stuck")}>
      <div className="container-xl">
        <div className="app-navbar__inner">
          <Link href="/" className="brand-mark" aria-label="tradeMO home">
            <span className="brand-mark__glyph">tM</span>
            <span>
              tradeMO
              <span className="brand-mark__sub">Crowdfunded Trade Pools</span>
            </span>
          </Link>

          <nav className="app-navbar__links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn("app-navbar__link", isActive(link.href) && "is-active")}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="app-navbar__actions">
            <div className="app-navbar__desktop-only d-flex align-items-center gap-2">
              <Link href="/auth/signin" className="btn-ghost">
                Log in
              </Link>
              <Link href="/auth/signup" className="btn-brand">
                Sign up free
                <Icon name="arrowRight" size={16} />
              </Link>
            </div>
            <button
              type="button"
              className="app-navbar__toggle"
              aria-expanded={open}
              aria-label="Toggle navigation"
              onClick={() => setOpen((value) => !value)}
            >
              <Icon name={open ? "close" : "menu"} size={20} />
            </button>
          </div>
        </div>

        <div className={cn("app-navbar__mobile", open && "is-open")}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="app-navbar__mobile-link"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="d-grid gap-2 pt-3">
            <Link href="/auth/signin" className="btn-ghost w-100" onClick={() => setOpen(false)}>
              Log in
            </Link>
            <Link href="/auth/signup" className="btn-brand w-100" onClick={() => setOpen(false)}>
              Sign up free
              <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
