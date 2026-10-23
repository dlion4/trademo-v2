export const methods = [
  "bank_transfer",
  "mobile_money",
  "card",
  "crypto_usdt",
] as const;
export type Method = (typeof methods)[number];
export const statuses = [
  "submitted",
  "pending",
  "information_requested",
  "verified",
  "failed",
  "rejected",
  "refunded",
] as const;
export type Status = (typeof statuses)[number];
export interface Deposit {
  id: string;
  investorId: string;
  investorName: string;
  amount: number;
  currency: "USD";
  method: Method;
  methodDetails: {
    provider: string;
    maskedAccount: string;
    network: string | null;
  };
  investmentId: string | null;
  pool: string;
  reference: string;
  submittedAt: string;
  status: Status;
  verifiedAt: string | null;
  verifiedBy: string | null;
  kycVerified: boolean;
  provider: {
    outcome: "settled" | "unknown" | "failed";
    amount: number;
    reference: string;
    confirmations: number;
    webhookVerified: boolean;
  };
  proof: {
    id: string;
    kind: "receipt" | "transaction";
    receivedAt: string;
  } | null;
  notes: string[];
  attempts: number;
  failure: string | null;
  refundReference: string | null;
  credited: boolean;
}
export interface Rules {
  crypto: boolean;
  card: boolean;
  mobile: boolean;
  bank: boolean;
  crossCheck: boolean;
  flagMismatch: boolean;
  rejectExpired: boolean;
  confirmations: number;
  threshold: number;
}
export interface DepositBundle {
  mode: "demo";
  asOf: string;
  revision: number;
  deposits: Deposit[];
  pools: { code: string; name: string }[];
  investors: { id: string; name: string; kycVerified: boolean }[];
  rules: Rules;
  audit: {
    id: string;
    time: string;
    action: string;
    reference: string;
    notes: string;
  }[];
  openingCredit: number;
  localCredit: number;
}
export const depositKeys = {
  workspace: ["deposit-logs", "workspace"] as const,
  summary: ["deposits", "summary"] as const,
  queue: ["deposits", "verification-queue"] as const,
  rules: ["deposits", "automation-rules"] as const,
};
