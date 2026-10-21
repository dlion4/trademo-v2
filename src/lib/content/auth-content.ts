import type { InvestorOnboardingContentDTO } from "@/lib/auth/types";

/**
 * Auth-surface content. Today these are bundled fixtures; each block maps to a
 * future backend endpoint (noted per export) so swapping is mechanical.
 */

/** Side panel on A-1 — future: GET /api/packages?status=open&limit=4 */
export interface AuthPoolRowDTO {
  code: string;
  market: string;
  status: "open" | "trading" | "scheduled";
  filledPercent: number;
  pnlPercent: number;
}

export interface AuthPanelContentDTO {
  headline: string;
  subline: string;
  metrics: Array<{ label: string; value: string; delta?: string; direction?: "up" | "down" }>;
  pools: AuthPoolRowDTO[];
  points: string[];
  updatedAt: string;
}

export const AUTH_PANEL_CONTENT: AuthPanelContentDTO = {
  headline: "One desk. Pooled capital. Transparent splits.",
  subline:
    "Operators run scheduled strategies on Deriv. Investors book slots in packages and receive proportional net profit when the window closes.",
  metrics: [
    { label: "Capital in pools", value: "$4.82M", delta: "+3.1%", direction: "up" },
    { label: "Avg. net ROI / cycle", value: "9.6%", delta: "+0.4", direction: "up" },
    { label: "Active investors", value: "7,214" },
  ],
  pools: [
    { code: "PKG-01", market: "Volatility 75", status: "trading", filledPercent: 100, pnlPercent: 4.82 },
    { code: "PKG-02", market: "EUR/USD", status: "open", filledPercent: 72, pnlPercent: 0 },
    { code: "PKG-03", market: "Gold / XAU", status: "trading", filledPercent: 100, pnlPercent: -0.64 },
    { code: "PKG-04", market: "Volatility 25", status: "scheduled", filledPercent: 18, pnlPercent: 0 },
  ],
  points: [
    "Deriv OAuth — tokens AES-256 encrypted at rest",
    "AI Guardian halts packages at a 5% drawdown",
    "Net-of-fee earnings recalculated every 3 minutes",
  ],
  updatedAt: "2026-10-18T10:30:00Z",
};

/** Demo identities accepted by the mock /api/auth/login handler. */
export const DEMO_PASSWORD = "Demo1234!";
export const DEMO_ACCOUNTS = [
  { email: "operator@trademo.io", label: "Operator", note: "→ /dashboard" },
  { email: "investor@trademo.io", label: "Investor", note: "→ /investor" },
  { email: "both@trademo.io", label: "Dual role", note: "→ dashboard picker" },
  { email: "2fa@trademo.io", label: "2FA enabled", note: "code 482917" },
] as const;

/** A-3 — future: GET /api/auth/onboarding/investor */
export const INVESTOR_ONBOARDING_CONTENT: InvestorOnboardingContentDTO = {
  stats: [
    { key: "avg_roi", label: "Avg. pool ROI", value: 14.2, format: "percent", hint: "Gross, last 12 cycles" },
    { key: "disbursed", label: "Total disbursed", value: 1_400_000, format: "currency", hint: "Net to investors" },
    { key: "investors", label: "Investors", value: 7_200, format: "number", hint: "Across 38 packages" },
  ],
  comparison: [
    { label: "Deriv account needed", pool: "No", solo: "Yes" },
    { label: "Strategy & execution", pool: "Operator desk", solo: "You" },
    { label: "Minimum commitment", pool: "1 slot", solo: "Your full balance" },
    { label: "Drawdown protection", pool: "AI Guardian · 5%", solo: "Manual" },
    { label: "Time required", pool: "Minutes / cycle", solo: "Hours / day" },
  ],
  lifecycle: [
    { key: "pool", title: "Pool", description: "Book slots while the package is open. Capital is held, not traded.", duration: "3–7 days" },
    { key: "trading", title: "Trading", description: "Bots trade the pooled capital on the scheduled markets.", duration: "7–30 days" },
    { key: "profit_sharing", title: "Profit sharing", description: "Final P&L split pro-rata; platform cut deducted from gains only.", duration: "≤ 24 h" },
    { key: "payout", title: "Payout", description: "Net earnings + principal credited to your wallet. Withdraw anytime.", duration: "Instant" },
  ],
  sampleEarnings: {
    packageCode: "PKG-01",
    investment: 3000,
    slots: 1,
    poolRoiPercent: 12,
    tradingDays: 14,
    platformCutPercent: 20,
  },
  idDocTypes: [
    { value: "passport", label: "Passport", requiresBack: false },
    { value: "national_id", label: "National ID", requiresBack: true },
    { value: "drivers_license", label: "Driver licence", requiresBack: true },
  ],
  sourceOfFundsOptions: [
    { value: "employment", label: "Employment income" },
    { value: "business", label: "Business revenue" },
    { value: "investment", label: "Investment returns" },
    { value: "savings", label: "Personal savings" },
  ],
  reviewEstimate: "24–48 hours",
  checklist: [
    { key: "profile", label: "Profile created", description: "Name, email and role confirmed", status: "done" },
    { key: "kyc", label: "Identity verification", description: "Documents submitted for review", status: "pending" },
    { key: "wallet", label: "Wallet set up", description: "Add a payout method", status: "todo" },
    { key: "first_deposit", label: "First deposit", description: "Fund your wallet to book slots", status: "todo" },
  ],
  recommendedPools: [
    {
      id: "pkg_01",
      code: "PKG-02",
      name: "EUR/USD Momentum",
      market: "Forex",
      slotPrice: 500,
      slotsTotal: 120,
      slotsFilled: 86,
      targetRoiPercent: 8.5,
      durationDays: 14,
      status: "open",
      closesAt: "2026-10-22T18:00:00Z",
      riskLevel: "low",
    },
    {
      id: "pkg_05",
      code: "PKG-05",
      name: "Volatility 75 Grid",
      market: "Synthetics",
      slotPrice: 1000,
      slotsTotal: 60,
      slotsFilled: 41,
      targetRoiPercent: 14,
      durationDays: 21,
      status: "open",
      closesAt: "2026-10-24T12:00:00Z",
      riskLevel: "medium",
    },
    {
      id: "pkg_07",
      code: "PKG-07",
      name: "Gold Range Desk",
      market: "Commodities",
      slotPrice: 250,
      slotsTotal: 200,
      slotsFilled: 37,
      targetRoiPercent: 6.2,
      durationDays: 10,
      status: "scheduled",
      closesAt: "2026-10-28T09:00:00Z",
      riskLevel: "low",
    },
  ],
};
