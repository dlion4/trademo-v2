export type PayoutMethod =
  | "bank_transfer"
  | "mobile_money"
  | "card"
  | "crypto_usdt";
export type PayoutStatus =
  | "pending"
  | "information_requested"
  | "approved"
  | "processing"
  | "completed"
  | "failed"
  | "rejected"
  | "refunded";
export type ProviderOutcome = "not_sent" | "unknown" | "settled" | "failed";
export interface PayoutSettings {
  minimum: number;
  maximum: number;
  autoEnabled: boolean;
  autoThreshold: number;
  batchTime: string;
  mobilePercent: number;
  cardPercent: number;
  cardFixed: number;
  cryptoFee: number;
}
export interface PayoutInvestor {
  id: string;
  name: string;
  kycLevel: 0 | 1 | 2;
  kycVerified: boolean;
  pools: string[];
  defaultMethod: PayoutMethod;
  wallet: {
    available: number;
    held: number;
    paid: number;
    openingBalance: number;
  };
}
export interface PayoutRequest {
  id: string;
  investorId: string;
  investorName: string;
  amount: number;
  fee: number;
  net: number;
  currency: "USD";
  method: PayoutMethod;
  pool: string;
  reason: "partial_payout" | "full_payout";
  status: PayoutStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  beneficiary: { masked: string; token: string; verified: boolean };
  providerReference: string | null;
  providerOutcome: ProviderOutcome;
  failureCode: string | null;
  attempts: number;
  notes: string[];
}
export interface PayoutEvidenceSnapshot {
  id: string;
  status: PayoutStatus;
  attempt: number;
  reference: string | null;
  outcome: ProviderOutcome;
  gross: number;
  fee: number;
  net: number;
}
export interface PayoutAudit {
  before?: PayoutEvidenceSnapshot[];
  after?: PayoutEvidenceSnapshot[];
  policyBefore?: PayoutSettings;
  policyAfter?: PayoutSettings;
  id: string;
  time: string;
  action: string;
  requestIds: string[];
  notes: string;
  revision: number;
}
export interface PayoutCashEntry {
  id: string;
  requestId: string;
  gross: number;
  fee: number;
  net: number;
  time: string;
}
export interface PayoutBundle {
  mode: "demo";
  asOf: string;
  revision: number;
  settings: PayoutSettings;
  investors: PayoutInvestor[];
  requests: PayoutRequest[];
  treasury: { openingCash: number; cash: number; reserve: number };
  cashLedger: PayoutCashEntry[];
  audit: PayoutAudit[];
}
export interface PayoutDay {
  day: string;
  gross: number;
  fee: number;
  net: number;
  count: number;
  average7: number;
}
export const payoutQueryKeys = {
  workspace: ["payouts", "workspace"] as const,
  summary: ["payouts", "queue-summary"] as const,
  queue: (status: string, page = 1) => ["payouts", { status, page }] as const,
  completed: (page: number, filters: Record<string, string>) =>
    ["payouts", { status: "completed", page, filters }] as const,
  settings: ["payouts", "settings"] as const,
  failed: ["payouts", "failed-queue"] as const,
  history: ["payouts", "history-chart", { days: 30 }] as const,
};
