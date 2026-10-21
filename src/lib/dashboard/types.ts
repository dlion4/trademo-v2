/**
 * ─────────────────────────────────────────────────────────────────────────────
 * tradeMO · Operator Dashboard Data Contracts & Backend DTOs (Page D-1 & Shell)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every DTO below maps 1-to-1 to the entities and endpoints in tradeMO.md §6,
 * §9.2, §10, and §17.2. Components never hardcode backend payloads — swapping to
 * the live Express + PostgreSQL + Deriv WS backend only changes fetchers in
 * `src/lib/api/dashboard.ts`.
 */

export type DerivSymbol =
  | "R_10"
  | "R_25"
  | "R_50"
  | "R_75"
  | "R_100"
  | "1HZ10V"
  | "frxEURUSD"
  | "frxXAUUSD"
  | "cryBTCUSD";

export type ContractTypeCode =
  | "CALL"
  | "PUT"
  | "DIGITEVEN"
  | "DIGITODD"
  | "DIGITOVER"
  | "DIGITUNDER";

export type StrategyName =
  | "Martingale"
  | "Even/Odd"
  | "DCA"
  | "Oscar's Grind"
  | "Fixed Stake"
  | "Anti-Martingale"
  | "Fibonacci";

export type PackageStatus =
  | "draft"
  | "scheduled"
  | "open"
  | "closed"
  | "trading"
  | "profit_sharing"
  | "completed";

/* ── Section 1: KPI Summary (["dashboard", "kpi-summary"]) ── */
export interface OperatorKpiSummaryDTO {
  totalCapital: number;
  capitalDeltaToday: number;
  capitalInTrades: number;
  availableCapital: number;
  activeInvestors: number;
  totalInvestors: number;
  newInvestorsToday: number;
  pendingKYC: number;
  totalProfit: number;
  profitPercent: number;
  scheduledToday: number;
  schedulesCompletedToday: number;
  tradesToday: number;
  winsToday: number;
  lossesToday: number;
  sessionPnL: number;
  pendingPayouts: {
    count: number;
    totalAmount: number;
  };
  pendingDeposits: {
    count: number;
    totalAmount: number;
  };
  operatorShare: number;
  distributed: number;
  pendingDistribution: number;
  distributionPercent: number;
  updatedAt: string;
}

/* ── Section 2: Trade Records (["dashboard", "last-trades", limit]) ── */
export interface TradeRecordDTO {
  id: string;
  tradeNumber: number;
  derivContractId: string;
  symbol: DerivSymbol;
  symbolLabel: string;
  contractType: ContractTypeCode;
  contractLabel: string;
  strategy: StrategyName;
  stake: number;
  duration: number;
  durationUnit: "t" | "s" | "m";
  entrySpot: number;
  exitSpot: number;
  payout: number;
  profit: number;
  isWin: boolean;
  packageCode: string;
  botName: string;
  executedAt: string; // HH:MM
  timestampIso: string;
}

export interface LastTradesFeedDTO {
  trades: TradeRecordDTO[];
  sessionSummary: {
    pnl: number;
    winCount: number;
    totalCount: number;
    winRatePercent: number;
    grossStake: number;
  };
}

/* ── Section 3: Upcoming Scheduled Trades (["dashboard", "upcoming-schedules"]) ── */
export interface ScheduledTradeDTO {
  id: string;
  name: string;
  executeAt: string; // HH:MM UTC
  windowEnd: string;
  symbol: DerivSymbol;
  strategy: StrategyName;
  stake: number;
  maxTrades: number;
  stopLoss: number;
  takeProfit: number;
  recurrence: "one_time" | "daily" | "weekdays" | "session_overlap";
  packageCodes: string[];
  allocationSplit: Record<string, number>;
  status: "queued" | "running" | "paused" | "completed";
}

export interface UpcomingSchedulesDTO {
  schedules: ScheduledTradeDTO[];
  nextInSeconds: number;
  completedToday: number;
  totalToday: number;
}

/* ── Section 4A: Funds Flow & Equity Curve (["dashboard", "funds-flow"]) ── */
export interface EquityPointDTO {
  date: string;
  equity: number;
  dailyPnL: number;
  winRate: number;
  trades: number;
}

export interface PackageSummaryDTO {
  id: string;
  code: string;
  name: string;
  status: PackageStatus;
  slotPrice: number;
  filledSlots: number;
  totalSlots: number;
  totalCapital: number;
  targetCapital: number;
  capitalSharePercent: number;
  operatorSharePercent: number;
  investorSharePercent: number;
  expectedROI: number;
  maxDrawdown: number;
  maxDrawdownHit: number;
  currentPnL: number;
  distributedPnL: number;
  pendingPnL: number;
  totalTrades: number;
  winRatePercent: number;
  markets: DerivSymbol[];
  strategies: StrategyName[];
  tradingEndsAt: string;
  highWaterMarkOk: boolean;
}

export interface DepositRecordDTO {
  id: string;
  reference: string;
  investorHandle: string;
  investorName: string;
  packageCode: string;
  slots: number;
  amount: number;
  method: "Bank Wire" | "M-Pesa" | "USDT (TRC-20)" | "Stripe Card";
  status: "pending" | "verified" | "proof_requested";
  submittedAt: string;
}

export interface FundsFlowDTO {
  totalCapital: number;
  capitalInTrades: number;
  availableCapital: number;
  todayDeposits: number;
  reserveRatioPercent: number;
  equityCurve: EquityPointDTO[];
  packages: PackageSummaryDTO[];
  pendingDeposits: DepositRecordDTO[];
}

/* ── Section 4B: Investor Watch (["dashboard", "investor-watch"]) ── */
export interface InvestorRecordDTO {
  id: string;
  handle: string;
  fullName: string;
  emailMasked: string;
  country: string;
  tier: "Starter" | "Prime" | "Institutional";
  kycStatus: "approved" | "pending" | "reupload_requested";
  kycLevel: 1 | 2 | 3;
  docType: "Passport" | "National ID" | "Driver Licence";
  sourceOfFunds: string;
  totalInvested: number;
  totalSlots: number;
  activePackages: string[];
  netEarnings: number;
  currentROI: number;
  walletBalance: number;
  joinedToday: boolean;
  joinedAt: string;
}

export interface InvestorWatchDTO {
  totalInvestors: number;
  activeInvestors: number;
  newToday: number;
  pendingKYC: number;
  topInvestor: {
    handle: string;
    fullName: string;
    amount: number;
    slots: number;
    packageCode: string;
  };
  investors: InvestorRecordDTO[];
}

/* ── Section 5: Profit Distribution (["dashboard", "profit-distribution"]) ── */
export interface PackageDistributionRowDTO {
  packageId: string;
  packageCode: string;
  packageName: string;
  investorsCount: number;
  capitalSharePercent: number;
  grossPnL: number;
  operatorCut: number;
  investorNet: number;
  distributed: number;
  pending: number;
  status: "ready" | "settled" | "accruing";
}

export interface ProfitDistributionDTO {
  poolPnL: number;
  operatorShare: number;
  operatorSharePercent: number;
  distributed: number;
  pending: number;
  distributionPercent: number;
  lastRunAt: string;
  nextScheduledAt: string;
  breakdown: PackageDistributionRowDTO[];
}

/* ── Workspace / Shell Telemetry (["dashboard", "workspace"]) ── */
export interface DerivAccountConnDTO {
  id: string;
  derivLoginId: string;
  accountType: "real" | "demo";
  currency: "USD";
  balance: number;
  latencyMs: number;
  status: "active" | "standby";
  permissions: Array<"read" | "trade" | "payments" | "admin">;
  lastPingIso: string;
}

export interface BotRunnerDTO {
  id: string;
  code: string;
  name: string;
  symbol: DerivSymbol;
  strategy: StrategyName;
  stake: number;
  packageCode: string;
  status: "running" | "paused" | "halted";
  tradesToday: number;
  winRatePercent: number;
  pnlToday: number;
  maxConsecutiveLosses: number;
}

export interface PayoutRequestDTO {
  id: string;
  reference: string;
  investorHandle: string;
  investorName: string;
  amount: number;
  fee: number;
  method: "Bank ACH" | "M-Pesa" | "USDT (ERC-20)" | "SEPA Wire";
  destinationMasked: string;
  kycVerified: boolean;
  requestedAt: string;
  status: "pending" | "approved" | "held";
}

export interface RiskGuardrailConfigDTO {
  armed: boolean;
  emergencyHalted: boolean;
  maxConsecutiveLossesOddEven: number;
  maxConsecutiveLossesDigits: number;
  maxDailyLoss: number;
  currentDailyLoss: number;
  maxDailyTrades: number;
  packageDrawdownLimitPercent: number;
  randomSymbolRotation: boolean;
  cooldownSeconds: number;
}

export interface MarketInstrumentQuoteDTO {
  symbol: DerivSymbol;
  label: string;
  market: "Synthetics" | "Forex" | "Commodities" | "Crypto";
  spot: number;
  changePercent: number;
  spread: number;
  payoutPercent: number;
  volatilityState: "calm" | "normal" | "elevated";
}

export interface OperatorNotificationDTO {
  id: string;
  category: "trade" | "deposit" | "payout" | "risk" | "kyc" | "system";
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  targetRoute?: string;
}

export interface AuditEventDTO {
  id: string;
  actor: string;
  category: "EXECUTION" | "TREASURY" | "POOL" | "COMPLIANCE" | "RISK" | "SESSION";
  action: string;
  detail: string;
  ip: string;
  timestamp: string;
}

export interface AnnouncementRecordDTO {
  id: string;
  subject: string;
  audience: string;
  channels: string[];
  recipientsCount: number;
  sentAt: string;
}

export interface OperatorWorkspaceDTO {
  operator: {
    id: string;
    fullName: string;
    email: string;
    code: string;
    role: "operator" | "both";
    twoFactorEnabled: boolean;
    timezone: string;
  };
  activeConnectionId: string;
  connections: DerivAccountConnDTO[];
  bots: BotRunnerDTO[];
  payoutQueue: PayoutRequestDTO[];
  risk: RiskGuardrailConfigDTO;
  markets: MarketInstrumentQuoteDTO[];
  notifications: OperatorNotificationDTO[];
  auditLogs: AuditEventDTO[];
  announcements: AnnouncementRecordDTO[];
}

/* ── Request Payloads for Mutations ── */
export interface ExecuteQuickTradeInput {
  symbol: DerivSymbol;
  contractType: ContractTypeCode;
  strategy: StrategyName;
  stake: number;
  duration: number;
  durationUnit: "t" | "s" | "m";
  packageCode: string;
}

export interface CreateScheduleInput {
  name: string;
  executeAt: string;
  windowEnd: string;
  symbol: DerivSymbol;
  strategy: StrategyName;
  stake: number;
  maxTrades: number;
  stopLoss: number;
  takeProfit: number;
  recurrence: ScheduledTradeDTO["recurrence"];
  packageCodes: string[];
  allocationSplit: Record<string, number>;
}

export interface CreatePackageInput {
  code: string;
  name: string;
  slotPrice: number;
  totalSlots: number;
  expectedROI: number;
  operatorSharePercent: number;
  maxDrawdown: number;
  tradingDays: number;
  markets: DerivSymbol[];
  strategies: StrategyName[];
}

export interface SendAnnouncementInput {
  audience: "all" | "PKG-01" | "PKG-02" | "PKG-03" | "pending_kyc";
  channels: Array<"in_app" | "email" | "telegram">;
  subject: string;
  body: string;
}

/* ── Unified Overlay / Drawer Discriminated Union (18 Modals/Wizards + 5 Drawer Views) ── */
export type OverlayKind =
  | { type: "quick-trade"; defaultSymbol?: DerivSymbol; defaultPackage?: string; defaultStake?: number }
  | { type: "new-package-wizard" }
  | { type: "schedule-wizard"; defaultSymbol?: DerivSymbol }
  | { type: "distribute-wizard" }
  | { type: "payout-batch-wizard" }
  | { type: "bot-deploy-wizard"; defaultSymbol?: DerivSymbol }
  | { type: "deriv-connection" }
  | { type: "announce-broadcast"; defaultAudience?: SendAnnouncementInput["audience"] }
  | { type: "kyc-review"; investorId?: string }
  | { type: "deposit-verify"; depositId?: string }
  | { type: "capital-rebalance" }
  | { type: "risk-guardrails" }
  | { type: "emergency-halt" }
  | { type: "trade-detail"; tradeId: string }
  | { type: "investor-ledger"; investorId: string }
  | { type: "export-reports"; defaultScope?: "trades" | "distributions" | "treasury" | "audit" }
  | { type: "command-palette" }
  | { type: "operator-session" };

export type RightDrawerState =
  | { open: false }
  | {
      open: true;
      tab: "feed" | "bots" | "queue" | "alerts";
      entity?:
        | { kind: "trade"; id: string }
        | { kind: "schedule"; id: string }
        | { kind: "schedule-sequence"; id: string }
        | { kind: "calendar-day"; date: string }
        | { kind: "history-run"; runId: string }
        | { kind: "package"; code: string }
        | { kind: "investor"; id: string }
        | { kind: "bot"; id: string };
    };
