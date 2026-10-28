"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

export type InvestorNavKey =
  | "overview"
  | "pools"
  | "detail"
  | "book"
  | "live"
  | "upcoming"
  | "earnings"
  | "activity"
  | "portfolio"
  | "wallet"
  | "calculator"
  | "notifications"
  | "settings";
export type InvestorDrawerTab = "portfolio" | "activity" | "guardian";
export interface InvestorQuickAction {
  key: string;
  label: string;
  icon: IconName;
  short?: string;
}
interface Toast {
  id: string;
  tone: "success" | "info" | "warning" | "error";
  title: string;
  detail?: string;
}
interface Chrome {
  pushToast: (toast: Omit<Toast, "id">) => void;
}
const THEME_KEY = "trademo.investor.theme";
const themeListeners = new Set<() => void>();
const themeStore = {
  subscribe(listener: () => void) {
    themeListeners.add(listener);
    return () => themeListeners.delete(listener);
  },
  read(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.sessionStorage.getItem(THEME_KEY) === "dark"
      ? "dark"
      : "light";
  },
  server(): "light" | "dark" {
    return "light";
  },
  write(next: "light" | "dark") {
    window.sessionStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-bs-theme", next);
    themeListeners.forEach((listener) => listener());
  },
};
const ChromeContext = createContext<Chrome | null>(null);
export function useInvestorChrome() {
  const ctx = useContext(ChromeContext);
  if (!ctx)
    throw new Error("useInvestorChrome must be used inside InvestorShell");
  return ctx;
}

const NAV: {
  group: string;
  items: {
    key: InvestorNavKey;
    label: string;
    icon: IconName;
    href?: string;
    code?: string;
  }[];
}[] = [
  {
    group: "Investor pages",
    items: [
      {
        key: "overview",
        label: "Investor overview",
        icon: "gauge",
        href: "/investor",
        code: "I-1",
      },
      {
        key: "pools",
        label: "Crowdfunding pools",
        icon: "pool",
        href: "/investor/pools",
        code: "I-2",
      },
      {
        key: "detail",
        label: "Pool detail",
        icon: "package",
        href: "/investor/pools",
        code: "I-3",
      },
      {
        key: "book",
        label: "Book & pay",
        icon: "lock",
        code: "I-4",
      },
      {
        key: "live",
        label: "Live trade tracker",
        icon: "activity",
        href: "/investor/live",
        code: "I-5",
      },
    ],
  },
  {
    group: "Portfolio",
    items: [
      { key: "upcoming", label: "Upcoming windows", icon: "calendar" },
      { key: "earnings", label: "Earnings", icon: "trendUp" },
      { key: "activity", label: "Activity", icon: "activity" },
      {
        key: "portfolio",
        label: "My investments",
        icon: "layers",
        href: "/investor/investments",
        code: "I-6",
      },
    ],
  },
  {
    group: "Account",
    items: [
      {
        key: "wallet",
        label: "Wallet & payouts",
        icon: "wallet",
        href: "/investor/wallet",
        code: "I-7",
      },
      { key: "calculator", label: "Return calculator", icon: "chart" },
      { key: "notifications", label: "Notifications", icon: "bell" },
      { key: "settings", label: "Investor settings", icon: "sliders" },
    ],
  },
];

export function InvestorShell({
  rootClass,
  investorName,
  investorSinceLabel,
  poolBookValue,
  monthRoi,
  walletBalance,
  unread,
  activeNav,
  detailHref = "/investor/pools",
  bookHref,
  quickActions,
  onNavigate,
  onOpenDrawer,
  onQuickAction,
  onOpenNotifications,
  onChromeReady,
  children,
}: {
  rootClass: string;
  investorName: string;
  investorSinceLabel: string;
  poolBookValue: number;
  monthRoi: number;
  walletBalance: number;
  unread: number;
  activeNav: InvestorNavKey;
  detailHref?: string;
  /** Enables the I-4 “Book & pay” entry; only supplied when a window is open. */
  bookHref?: string;
  quickActions: InvestorQuickAction[];
  onNavigate: (key: InvestorNavKey) => void;
  onOpenDrawer: (tab: InvestorDrawerTab) => void;
  onQuickAction: (key: string) => void;
  onOpenNotifications: () => void;
  onChromeReady?: (chrome: Chrome) => void;
  children: ReactNode;
}) {
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.read,
    themeStore.server,
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast_${++toastId.current}`;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4600,
    );
  }, []);

  useEffect(() => {
    onChromeReady?.({ pushToast });
  }, [onChromeReady, pushToast]);

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    return () =>
      document.documentElement.setAttribute("data-bs-theme", "light");
  }, [theme]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const router = useRouter();
  const navGroups = useMemo(
    () =>
      NAV.map((group) => ({
        ...group,
        items: group.items
          .map((item) =>
            item.key === "detail"
              ? { ...item, href: detailHref }
              : item.key === "book"
                ? { ...item, href: bookHref }
                : item,
          )
          .filter((item) => item.key !== "book" || Boolean(item.href)),
      })),
    [detailHref, bookHref],
  );
  const toggleTheme = () => {
    themeStore.write(theme === "light" ? "dark" : "light");
  };
  const navigate = useCallback(
    (key: InvestorNavKey) => {
      setMobileOpen(false);
      onNavigate(key);
    },
    [onNavigate],
  );
  const actions = useMemo(
    () => [
      ...navGroups.flatMap((group) =>
        group.items.map((item) => ({
          label: item.label,
          hint: group.group,
          icon: item.icon,
          run: () => (item.href ? router.push(item.href) : navigate(item.key)),
        })),
      ),
      ...quickActions.map((a) => ({
        label: a.label,
        hint: "Quick action",
        icon: a.icon,
        run: () => onQuickAction(a.key),
      })),
      {
        label: "Open operator console",
        hint: "Workspace",
        icon: "terminal" as IconName,
        run: () => {
          window.location.href = "/dashboard";
        },
      },
    ],
    [navGroups, quickActions, navigate, onQuickAction, router],
  );
  const filtered = actions.filter((a) =>
    `${a.label} ${a.hint}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <ChromeContext.Provider value={{ pushToast }}>
      <div
        className={cn(
          rootClass,
          "op-shell",
          "iv-shell",
          railCollapsed && "is-rail",
        )}
      >
        {mobileOpen ? (
          <div
            className="op-mobile-backdrop d-lg-none"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        ) : null}
        <aside
          className={cn("op-sidebar iv-sidebar", mobileOpen && "is-open")}
          aria-label="Investor navigation"
        >
          <div className="op-sidebar__brand">
            <Link
              href="/investor"
              className="brand-mark"
              onClick={() => setMobileOpen(false)}
            >
              <span className="brand-mark__glyph">tM</span>
              <span className="op-sidebar__brand-text">
                tradeMO
                <span className="brand-mark__sub">Investor Desk</span>
              </span>
            </Link>
            <button
              type="button"
              className="desk-icon-btn d-none d-lg-inline-grid"
              onClick={() => setRailCollapsed((v) => !v)}
              aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon name="menu" size={16} />
            </button>
            <button
              type="button"
              className="desk-icon-btn d-lg-none"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <Icon name="close" size={17} />
            </button>
          </div>

          <div className="iv-account">
            <span className="iv-avatar">
              {investorName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{investorName}</strong>
              <span>{investorSinceLabel}</span>
            </div>
          </div>

          <nav className="op-sidebar__nav">
            {navGroups.map((group) => (
              <div key={group.group} className="op-nav-group">
                <span className="op-nav-group__label">{group.group}</span>
                {group.items.map((item) => {
                  const badge =
                    item.key === "notifications" && unread > 0 ? (
                      <span className="op-nav-badge mono">{unread}</span>
                    ) : item.code ? (
                      <span className="op-nav-code mono">{item.code}</span>
                    ) : null;
                  const content = (
                    <>
                      <Icon name={item.icon} size={17} />
                      <span className="op-nav-link__text">{item.label}</span>
                      {badge}
                    </>
                  );
                  return item.href ? (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cn(
                        "op-nav-link",
                        "op-nav-link--page",
                        activeNav === item.key && "is-active",
                      )}
                      onClick={() => setMobileOpen(false)}
                      aria-current={activeNav === item.key ? "page" : undefined}
                      title={`${item.label} · ${item.code ?? "page"}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={item.key}
                      type="button"
                      className={cn(
                        "op-nav-link",
                        activeNav === item.key && "is-active",
                      )}
                      onClick={() => navigate(item.key)}
                      aria-current={activeNav === item.key ? "page" : undefined}
                      title={item.label}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="op-sidebar__foot">
            <button
              type="button"
              className="iv-book-card"
              onClick={() => onNavigate("portfolio")}
            >
              <span>ACTIVE ALLOCATIONS</span>
              <strong className="mono">{money(poolBookValue)}</strong>
              <small>
                {monthRoi >= 0 ? "+" : ""}
                {monthRoi.toFixed(2)}% this month
              </small>
            </button>
            <div className="op-sidebar__foot-links">
              <Link href="/dashboard" className="op-foot-link">
                <Icon name="terminal" size={14} /> <span>Operator console</span>
              </Link>
              <Link href="/" className="op-foot-link">
                <Icon name="globe" size={14} /> <span>Public site</span>
              </Link>
            </div>
          </div>
        </aside>

        <div className="op-workspace">
          <header className="op-topbar iv-topbar">
            <div className="op-topbar__left">
              <button
                type="button"
                className="desk-icon-btn d-lg-none"
                onClick={() => setMobileOpen(true)}
                aria-label="Open investor navigation"
              >
                <Icon name="menu" size={18} />
              </button>
              <button
                type="button"
                className="op-cmd-search"
                onClick={() => {
                  setPaletteOpen(true);
                  setQuery("");
                }}
                aria-label="Search investor workspace"
              >
                <Icon name="search" size={15} />
                <span>Search pools, payouts, reports…</span>
                <kbd className="mono">⌘K</kbd>
              </button>
            </div>
            <div className="op-topbar__right">
              <div className="iv-topbar__metrics d-none d-xl-flex">
                <span>
                  Pool book{" "}
                  <strong className="mono">{money(poolBookValue)}</strong>
                </span>
                <span>
                  Wallet{" "}
                  <strong className="mono">{money(walletBalance)}</strong>
                </span>
              </div>
              <button
                type="button"
                className="desk-icon-btn iv-bell"
                onClick={onOpenNotifications}
                aria-label={`Open notifications, ${unread} unread`}
              >
                <Icon name="bell" size={17} />
                {unread > 0 ? (
                  <span className="op-count-dot">{unread}</span>
                ) : null}
              </button>
              <button
                type="button"
                className="desk-icon-btn"
                onClick={() => onOpenDrawer("portfolio")}
                aria-label="Open portfolio inspector"
              >
                <Icon name="panelRight" size={17} />
              </button>
              <button
                type="button"
                className="desk-icon-btn"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
                aria-pressed={theme === "dark"}
              >
                <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
              </button>
              <button
                type="button"
                className="op-profile-btn"
                onClick={() => navigate("settings")}
                aria-label="Open investor settings"
              >
                <span className="op-avatar">
                  {investorName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span className="d-none d-md-inline">
                  {investorName.split(" ")[0]}
                </span>
              </button>
            </div>
          </header>

          <main className="op-main iv-main">{children}</main>

          <div
            className="op-bottom-dock iv-bottom-dock"
            role="region"
            aria-label="Investor quick actions"
          >
            <div className="op-bottom-dock__inner">
              <div className="op-bottom-dock__telemetry">
                <span className="live-dot" />
                <span className="mono small">
                  Pool book <strong>{money(poolBookValue)}</strong>
                </span>
                <span className="op-bottom-dock__sep" aria-hidden="true">
                  ·
                </span>
                <span className="mono small text-secondary">
                  Month{" "}
                  <strong className={monthRoi >= 0 ? "text-win" : "text-loss"}>
                    {monthRoi >= 0 ? "+" : ""}
                    {monthRoi.toFixed(2)}%
                  </strong>
                </span>
              </div>
              <div className="op-bottom-dock__actions">
                {quickActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="btn-ghost op-dock-btn"
                    onClick={() => onQuickAction(action.key)}
                  >
                    <Icon name={action.icon} size={14} />{" "}
                    {action.short ?? action.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn-ghost op-dock-btn d-none d-xxl-inline-flex"
                  onClick={() => onOpenDrawer("guardian")}
                >
                  <Icon name="shield" size={14} /> Guardian
                </button>
              </div>
            </div>
          </div>
        </div>

        <nav
          className="iv-mobile-nav d-lg-none"
          aria-label="Investor mobile navigation"
        >
          {[
            {
              key: "overview" as const,
              label: "Overview",
              icon: "gauge" as IconName,
              href: "/investor",
            },
            {
              key: "pools" as const,
              label: "Pools",
              icon: "pool" as IconName,
              href: "/investor/pools",
            },
            {
              key: "detail" as const,
              label: "Detail",
              icon: "package" as IconName,
              href: detailHref,
            },
            {
              key: "portfolio" as const,
              label: "Portfolio",
              icon: "layers" as IconName,
              href: "/investor/investments",
            },
            {
              key: "wallet" as const,
              label: "Wallet",
              icon: "wallet" as IconName,
            },
          ].map((item) =>
            item.href ? (
              <Link
                key={item.key}
                href={item.href}
                className={activeNav === item.key ? "is-active" : ""}
                onClick={() => setMobileOpen(false)}
                aria-current={activeNav === item.key ? "page" : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                className={activeNav === item.key ? "is-active" : ""}
                onClick={() => navigate(item.key)}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </button>
            ),
          )}
          <button type="button" onClick={() => setMobileOpen(true)}>
            <Icon name="menu" size={18} />
            <span>More</span>
          </button>
        </nav>

        <div className="iv-toasts" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={cn("iv-toast", `is-${toast.tone}`)}>
              <Icon
                name={
                  toast.tone === "error"
                    ? "alert"
                    : toast.tone === "success"
                      ? "check"
                      : "info"
                }
                size={15}
              />
              <div>
                <strong>{toast.title}</strong>
                {toast.detail ? <span>{toast.detail}</span> : null}
              </div>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                aria-label="Dismiss message"
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {paletteOpen ? (
        <div className="iv-palette-layer">
          <DeskModalShell
            code="I-1"
            eyebrow="INVESTOR WORKSPACE / COMMAND"
            title="Search & jump"
            subtitle="Find a pool action, payout route, report or workspace tool."
            size="md"
            onClose={() => setPaletteOpen(false)}
            footer={
              <>
                <span className="iv-palette-hint mono">
                  ↑↓ to review · Enter to open · Esc to close
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPaletteOpen(false)}
                >
                  Close
                </button>
              </>
            }
          >
            <input
              className="form-control iv-palette-input"
              autoFocus
              aria-label="Search investor actions"
              placeholder="Type an action or destination…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered[0]) {
                  filtered[0].run();
                  setPaletteOpen(false);
                }
              }}
            />
            <div className="iv-palette-list">
              {filtered.map((action) => (
                <button
                  key={`${action.hint}-${action.label}`}
                  type="button"
                  onClick={() => {
                    action.run();
                    setPaletteOpen(false);
                  }}
                >
                  <Icon name={action.icon} size={15} />
                  <span>{action.label}</span>
                  <small>{action.hint}</small>
                  <Icon name="arrowRight" size={13} />
                </button>
              ))}
              {!filtered.length ? (
                <p className="iv-empty">No matching investor action.</p>
              ) : null}
            </div>
          </DeskModalShell>
        </div>
      ) : null}
    </ChromeContext.Provider>
  );
}
