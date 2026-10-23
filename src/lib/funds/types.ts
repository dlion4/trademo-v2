export type DepositStatus =
  | "pending"
  | "submitted"
  | "verified"
  | "rejected"
  | "information_requested";
export type PaymentMethod =
  | "mobile_money"
  | "bank_transfer"
  | "crypto_usdt"
  | "card";
export interface FundsInvestor {
  id: string;
  name: string;
  kycVerified: boolean;
}
export interface Deposit {
  id: string;
  date: string;
  investorId: string;
  investorName: string;
  amount: number;
  currency: "USD";
  method: PaymentMethod;
  pool: string;
  status: DepositStatus;
  verifiedBy: string | null;
  reference: string;
  providerSettled: boolean;
  kycVerified: boolean;
  notes: string[];
}
export interface FundAllocation {
  code: string;
  name: string;
  capital: number;
  deployed: number;
  trades: number;
  averageStake: number;
  status: "trading" | "paused";
}
export interface FundMovement {
  id: string;
  time: string;
  kind:
    | "deposit_in"
    | "trade_out"
    | "trade_in"
    | "payout_out"
    | "fee_out"
    | "allocation"
    | "reserve";
  amount: number;
  from: string;
  to: string;
  reference: string;
  status: "posted" | "pending";
  note: string;
}
export interface FundProvider {
  id: string;
  name: string;
  state: "healthy" | "delayed";
  latency: number;
  lastChecked: string;
  detail: string;
  channel: string;
}
export interface ReconciliationCheck {
  key: string;
  label: string;
  expected: number;
  actual: number;
  difference: number;
}
export interface ReconciliationRun {
  sourceRevision: number;
  id: string;
  time: string;
  status: "balanced" | "review" | "alert";
  difference: number;
  checks: ReconciliationCheck[];
  note: string;
}
export interface FundsAudit {
  id: string;
  time: string;
  action: string;
  reference: string;
  notes: string;
}
export interface FundsBundle {
  mode: "demo";
  asOf: string;
  revision: number;
  ledgerCapital: number;
  custody: { brokerCash: number; positions: number; escrow: number };
  reserve: { balance: number; targetPercent: number };
  allocations: FundAllocation[];
  investors: FundsInvestor[];
  deposits: Deposit[];
  movements: FundMovement[];
  providers: FundProvider[];
  runs: ReconciliationRun[];
  audit: FundsAudit[];
}
export interface FundsOverview {
  capital: number;
  deployed: number;
  available: number;
  pending: number;
  pendingCount: number;
  brokerCash: number;
  escrow: number;
  reserve: number;
  spendable: number;
  utilization: number;
  reserveTarget: number;
  reserveGap: number;
}
export const fundsQueryKeys = {
  workspace: ["funds", "workspace"] as const,
  overview: ["funds", "overview"] as const,
  deposits: (page: number, filters: Record<string, string>) =>
    ["funds", "deposits", { page, filters }] as const,
  allocation: ["funds", "allocation"] as const,
  flow: (page: number) => ["funds", "flow-timeline", { page }] as const,
  reconciliation: ["funds", "reconciliation", "last-5"] as const,
  providers: ["funds", "provider-status"] as const,
  reserve: ["funds", "reserve"] as const,
};
