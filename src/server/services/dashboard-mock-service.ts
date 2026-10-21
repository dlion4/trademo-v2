import {
  INITIAL_ANNOUNCEMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_BOTS,
  INITIAL_CONNECTIONS,
  INITIAL_DEPOSITS,
  INITIAL_DISTRIBUTION,
  INITIAL_EQUITY_CURVE,
  INITIAL_INVESTORS,
  INITIAL_MARKETS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PACKAGES,
  INITIAL_PAYOUTS,
  INITIAL_RISK_CONFIG,
  INITIAL_SCHEDULES,
  INITIAL_TRADES,
} from "@/lib/content/dashboard-content";
import type {
  CreatePackageInput,
  CreateScheduleInput,
  ExecuteQuickTradeInput,
  FundsFlowDTO,
  InvestorWatchDTO,
  LastTradesFeedDTO,
  OperatorKpiSummaryDTO,
  OperatorWorkspaceDTO,
  ProfitDistributionDTO,
  RiskGuardrailConfigDTO,
  SendAnnouncementInput,
  TradeRecordDTO,
  UpcomingSchedulesDTO,
} from "@/lib/dashboard/types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * tradeMO · In-Memory Operator Desk Service (Backend-Ready Mock Layer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Preserves state across API calls in the running server process so every
 * trade, schedule, package, payout approval, KYC decision, deposit check, and
 * profit distribution immediately updates every query on Page D-1.
 */

interface DeskState {
  totalCapital: number;
  capitalInTrades: number;
  availableCapital: number;
  capitalDeltaToday: number;
  tradesToday: number;
  winsToday: number;
  lossesToday: number;
  totalProfit: number;
  operatorShare: number;
  distributed: number;
  pendingDistribution: number;
  scheduledToday: number;
  schedulesCompletedToday: number;
  trades: TradeRecordDTO[];
  schedules: typeof INITIAL_SCHEDULES;
  equityCurve: typeof INITIAL_EQUITY_CURVE;
  packages: typeof INITIAL_PACKAGES;
  deposits: typeof INITIAL_DEPOSITS;
  investors: typeof INITIAL_INVESTORS;
  distribution: typeof INITIAL_DISTRIBUTION;
  payouts: typeof INITIAL_PAYOUTS;
  connections: typeof INITIAL_CONNECTIONS;
  activeConnectionId: string;
  bots: typeof INITIAL_BOTS;
  risk: RiskGuardrailConfigDTO;
  markets: typeof INITIAL_MARKETS;
  notifications: typeof INITIAL_NOTIFICATIONS;
  auditLogs: typeof INITIAL_AUDIT_LOGS;
  announcements: typeof INITIAL_ANNOUNCEMENTS;
}

const g = globalThis as unknown as { __trademoDesk?: DeskState };

function getState(): DeskState {
  if (!g.__trademoDesk) {
    g.__trademoDesk = {
      totalCapital: 156000,
      capitalInTrades: 142000,
      availableCapital: 14000,
      capitalDeltaToday: 12000,
      tradesToday: 47,
      winsToday: 31,
      lossesToday: 16,
      totalProfit: 18240,
      operatorShare: 3648,
      distributed: 11675,
      pendingDistribution: 2917,
      scheduledToday: 8,
      schedulesCompletedToday: 3,
      trades: structuredClone(INITIAL_TRADES),
      schedules: structuredClone(INITIAL_SCHEDULES),
      equityCurve: structuredClone(INITIAL_EQUITY_CURVE),
      packages: structuredClone(INITIAL_PACKAGES),
      deposits: structuredClone(INITIAL_DEPOSITS),
      investors: structuredClone(INITIAL_INVESTORS),
      distribution: structuredClone(INITIAL_DISTRIBUTION),
      payouts: structuredClone(INITIAL_PAYOUTS),
      connections: structuredClone(INITIAL_CONNECTIONS),
      activeConnectionId: "dc_real_01",
      bots: structuredClone(INITIAL_BOTS),
      risk: structuredClone(INITIAL_RISK_CONFIG),
      markets: structuredClone(INITIAL_MARKETS),
      notifications: structuredClone(INITIAL_NOTIFICATIONS),
      auditLogs: structuredClone(INITIAL_AUDIT_LOGS),
      announcements: structuredClone(INITIAL_ANNOUNCEMENTS),
    };
  }
  return g.__trademoDesk;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function pushAudit(actor: string, category: DeskState["auditLogs"][number]["category"], action: string, detail: string) {
  const s = getState();
  s.auditLogs.unshift({
    id: `aud_${Date.now().toString(36)}`,
    actor,
    category,
    action,
    detail,
    ip: "185.21.44.10",
    timestamp: `${nowHHMM()}:00 UTC`,
  });
}

/* ── Queries ── */

export function getKpiSummary(): OperatorKpiSummaryDTO {
  const s = getState();
  const pendingPayoutRows = s.payouts.filter((p) => p.status === "pending");
  const pendingDepositRows = s.deposits.filter((d) => d.status === "pending");
  const pendingKycCount = s.investors.filter((i) => i.kycStatus === "pending").length;
  const last5 = s.trades.slice(0, 5);
  const sessionPnL = last5.reduce((sum, t) => sum + t.profit, 0);
  const investorPoolTotal = s.distributed + s.pendingDistribution;
  const distributionPercent =
    investorPoolTotal > 0 ? Math.round((s.distributed / investorPoolTotal) * 100) : 100;

  return {
    totalCapital: s.totalCapital,
    capitalDeltaToday: s.capitalDeltaToday,
    capitalInTrades: s.capitalInTrades,
    availableCapital: s.availableCapital,
    activeInvestors: 38,
    totalInvestors: 38,
    newInvestorsToday: s.investors.filter((i) => i.joinedToday).length,
    pendingKYC: pendingKycCount,
    totalProfit: Number(s.totalProfit.toFixed(2)),
    profitPercent: Number(((s.totalProfit / s.totalCapital) * 100).toFixed(1)),
    scheduledToday: s.scheduledToday,
    schedulesCompletedToday: s.schedulesCompletedToday,
    tradesToday: s.tradesToday,
    winsToday: s.winsToday,
    lossesToday: s.lossesToday,
    sessionPnL: Number(sessionPnL.toFixed(2)),
    pendingPayouts: {
      count: pendingPayoutRows.length,
      totalAmount: Number(pendingPayoutRows.reduce((a, b) => a + b.amount, 0).toFixed(2)),
    },
    pendingDeposits: {
      count: pendingDepositRows.length,
      totalAmount: Number(pendingDepositRows.reduce((a, b) => a + b.amount, 0).toFixed(2)),
    },
    operatorShare: Number(s.operatorShare.toFixed(2)),
    distributed: Number(s.distributed.toFixed(2)),
    pendingDistribution: Number(s.pendingDistribution.toFixed(2)),
    distributionPercent,
    updatedAt: new Date().toISOString(),
  };
}

export function getLastTrades(limit = 10): LastTradesFeedDTO {
  const s = getState();
  const last5 = s.trades.slice(0, 5);
  const wins = last5.filter((t) => t.isWin).length;
  return {
    trades: s.trades.slice(0, limit),
    sessionSummary: {
      pnl: Number(last5.reduce((sum, t) => sum + t.profit, 0).toFixed(2)),
      winCount: wins,
      totalCount: last5.length,
      winRatePercent: last5.length ? Math.round((wins / last5.length) * 100) : 0,
      grossStake: Number(last5.reduce((sum, t) => sum + t.stake, 0).toFixed(2)),
    },
  };
}

export function getUpcomingSchedules(): UpcomingSchedulesDTO {
  const s = getState();
  return {
    schedules: s.schedules,
    nextInSeconds: 23 * 60 + 14, // matches tradeMO.md spec "Next in: 23m 14s"
    completedToday: s.schedulesCompletedToday,
    totalToday: s.scheduledToday,
  };
}

export function getFundsFlow(): FundsFlowDTO {
  const s = getState();
  return {
    totalCapital: s.totalCapital,
    capitalInTrades: s.capitalInTrades,
    availableCapital: s.availableCapital,
    todayDeposits: s.capitalDeltaToday,
    reserveRatioPercent: Number(((s.availableCapital / s.totalCapital) * 100).toFixed(1)),
    equityCurve: s.equityCurve,
    packages: s.packages,
    pendingDeposits: s.deposits,
  };
}

export function getInvestorWatch(): InvestorWatchDTO {
  const s = getState();
  return {
    totalInvestors: 38,
    activeInvestors: 32,
    newToday: s.investors.filter((i) => i.joinedToday).length,
    pendingKYC: s.investors.filter((i) => i.kycStatus === "pending").length,
    topInvestor: {
      handle: "User_8f2a",
      fullName: "Kwame Mensah",
      amount: 15000,
      slots: 5,
      packageCode: "PKG-01",
    },
    investors: s.investors,
  };
}

export function getProfitDistribution(): ProfitDistributionDTO {
  const s = getState();
  const investorPoolTotal = s.distributed + s.pendingDistribution;
  return {
    poolPnL: Number(s.totalProfit.toFixed(2)),
    operatorShare: Number(s.operatorShare.toFixed(2)),
    operatorSharePercent: 20,
    distributed: Number(s.distributed.toFixed(2)),
    pending: Number(s.pendingDistribution.toFixed(2)),
    distributionPercent:
      investorPoolTotal > 0 ? Math.round((s.distributed / investorPoolTotal) * 100) : 100,
    lastRunAt: "Today · 12:00 UTC",
    nextScheduledAt: "Today · 18:00 UTC",
    breakdown: s.distribution,
  };
}

export function getWorkspace(): OperatorWorkspaceDTO {
  const s = getState();
  return {
    operator: {
      id: "user_op_01",
      fullName: "Jane Operator",
      email: "operator@trademo.io",
      code: "OP-01",
      role: "both",
      twoFactorEnabled: true,
      timezone: "UTC",
    },
    activeConnectionId: s.activeConnectionId,
    connections: s.connections,
    bots: s.bots,
    payoutQueue: s.payouts,
    risk: s.risk,
    markets: s.markets,
    notifications: s.notifications,
    auditLogs: s.auditLogs,
    announcements: s.announcements,
  };
}

/** Single SSR bundle so Page D-1 renders cleanly with zero waterfall. */
export function getCommandCenterBundle() {
  return {
    kpis: getKpiSummary(),
    lastTrades: getLastTrades(12),
    schedules: getUpcomingSchedules(),
    funds: getFundsFlow(),
    investors: getInvestorWatch(),
    distribution: getProfitDistribution(),
    workspace: getWorkspace(),
  };
}

/* ── Mutations ── */

const CONTRACT_NAMES: Record<ExecuteQuickTradeInput["contractType"], string> = {
  CALL: "Rise",
  PUT: "Fall",
  DIGITEVEN: "Even",
  DIGITODD: "Odd",
  DIGITOVER: "Over 3",
  DIGITUNDER: "Under 6",
};

export function executeQuickTrade(input: ExecuteQuickTradeInput): TradeRecordDTO {
  const s = getState();
  const market = s.markets.find((m) => m.symbol === input.symbol) ?? s.markets[0];
  const isWin = Math.random() < 0.72; // realistic positive expectancy for demo feedback
  const netRatio = (market.payoutPercent || 95) / 100;
  const profit = isWin ? Number((input.stake * netRatio).toFixed(2)) : -input.stake;
  const nextNum = (s.trades[0]?.tradeNumber ?? 247) + 1;
  const delta = Number(((Math.random() * 1.4 + 0.25) * (isWin ? 1 : -1)).toFixed(2));
  const entry = market.spot;
  const exit = Number((entry + delta).toFixed(entry < 10 ? 4 : 2));

  const record: TradeRecordDTO = {
    id: `trd_${nextNum}`,
    tradeNumber: nextNum,
    derivContractId: `24988${Math.floor(110000 + Math.random() * 880000)}`,
    symbol: input.symbol,
    symbolLabel: market.label,
    contractType: input.contractType,
    contractLabel: `${CONTRACT_NAMES[input.contractType]} · ${input.duration}${input.durationUnit}`,
    strategy: input.strategy,
    stake: input.stake,
    duration: input.duration,
    durationUnit: input.durationUnit,
    entrySpot: entry,
    exitSpot: exit,
    payout: isWin ? Number((input.stake + profit).toFixed(2)) : 0,
    profit,
    isWin,
    packageCode: input.packageCode,
    botName: "Manual Desk",
    executedAt: nowHHMM(),
    timestampIso: new Date().toISOString(),
  };

  s.trades.unshift(record);
  s.tradesToday += 1;
  if (isWin) s.winsToday += 1;
  else s.lossesToday += 1;

  s.totalProfit = Number((s.totalProfit + profit).toFixed(2));
  s.totalCapital = Number((s.totalCapital + profit).toFixed(2));
  s.availableCapital = Number((s.availableCapital + profit).toFixed(2));
  if (profit > 0) {
    s.operatorShare = Number((s.operatorShare + profit * 0.2).toFixed(2));
    s.pendingDistribution = Number((s.pendingDistribution + profit * 0.8).toFixed(2));
  }

  const pkg = s.packages.find((p) => p.code === input.packageCode);
  if (pkg) {
    pkg.currentPnL = Number((pkg.currentPnL + profit).toFixed(2));
    pkg.totalTrades += 1;
    if (profit > 0) pkg.pendingPnL = Number((pkg.pendingPnL + profit * 0.8).toFixed(2));
  }
  const distRow = s.distribution.find((d) => d.packageCode === input.packageCode);
  if (distRow && profit > 0) {
    distRow.grossPnL = Number((distRow.grossPnL + profit).toFixed(2));
    distRow.operatorCut = Number((distRow.operatorCut + profit * 0.2).toFixed(2));
    distRow.investorNet = Number((distRow.investorNet + profit * 0.8).toFixed(2));
    distRow.pending = Number((distRow.pending + profit * 0.8).toFixed(2));
    distRow.status = "ready";
  }

  s.notifications.unshift({
    id: `ntf_${Date.now().toString(36)}`,
    category: "trade",
    title: `Trade #${record.tradeNumber} ${isWin ? `won +$${profit.toFixed(2)}` : `settled -$${input.stake.toFixed(2)}`}`,
    detail: `${record.symbol} ${record.contractLabel} allocated to ${record.packageCode}`,
    time: "Just now",
    unread: true,
    targetRoute: "/dashboard/trades",
  });
  pushAudit("Jane Operator", "EXECUTION", "MANUAL_TRADE_SETTLED", `#${record.tradeNumber} ${record.symbol} ${record.contractLabel} (${profit >= 0 ? "+" : ""}$${profit})`);
  return record;
}

export function createSchedule(input: CreateScheduleInput) {
  const s = getState();
  const row = {
    id: `sch_${Date.now().toString(36)}`,
    ...input,
    status: "queued" as const,
  };
  s.schedules.unshift(row);
  s.scheduledToday += 1;
  pushAudit("Jane Operator", "EXECUTION", "SCHEDULE_CREATED", `${input.name} at ${input.executeAt} on ${input.symbol} ($${input.stake})`);
  return row;
}

export function toggleScheduleStatus(id: string, action: "toggle" | "run_now") {
  const s = getState();
  const row = s.schedules.find((item) => item.id === id);
  if (!row) return null;
  if (action === "run_now") {
    row.status = "completed";
    s.schedulesCompletedToday += 1;
    executeQuickTrade({
      symbol: row.symbol,
      contractType: "CALL",
      strategy: row.strategy,
      stake: row.stake,
      duration: 5,
      durationUnit: "t",
      packageCode: row.packageCodes[0] ?? "PKG-01",
    });
    return row;
  }
  row.status = row.status === "paused" ? "queued" : "paused";
  pushAudit("Jane Operator", "EXECUTION", "SCHEDULE_STATUS_CHANGED", `${row.name} → ${row.status}`);
  return row;
}

export function createPackage(input: CreatePackageInput) {
  const s = getState();
  const pkg = {
    id: `pkg_${Date.now().toString(36)}`,
    code: input.code.toUpperCase(),
    name: input.name,
    status: "open" as const,
    slotPrice: input.slotPrice,
    filledSlots: 0,
    totalSlots: input.totalSlots,
    totalCapital: 0,
    targetCapital: input.slotPrice * input.totalSlots,
    capitalSharePercent: 0,
    operatorSharePercent: input.operatorSharePercent,
    investorSharePercent: 100 - input.operatorSharePercent,
    expectedROI: input.expectedROI,
    maxDrawdown: input.maxDrawdown,
    maxDrawdownHit: 0,
    currentPnL: 0,
    distributedPnL: 0,
    pendingPnL: 0,
    totalTrades: 0,
    winRatePercent: 0,
    markets: input.markets,
    strategies: input.strategies,
    tradingEndsAt: new Date(Date.now() + input.tradingDays * 86_400_000).toISOString(),
    highWaterMarkOk: true,
  };
  s.packages.unshift(pkg);
  pushAudit("Jane Operator", "POOL", "PACKAGE_PUBLISHED", `Published ${pkg.code} (${pkg.name}) target $${pkg.targetCapital.toLocaleString()}`);
  return pkg;
}

export function distributePendingProfits(packageCodes?: string[]) {
  const s = getState();
  let totalReleased = 0;
  for (const row of s.distribution) {
    if (packageCodes && packageCodes.length > 0 && !packageCodes.includes(row.packageCode)) continue;
    if (row.pending > 0) {
      totalReleased += row.pending;
      row.distributed = Number((row.distributed + row.pending).toFixed(2));
      const pkg = s.packages.find((p) => p.code === row.packageCode);
      if (pkg) {
        pkg.distributedPnL = Number((pkg.distributedPnL + row.pending).toFixed(2));
        pkg.pendingPnL = 0;
      }
      row.pending = 0;
      row.status = "settled";
    }
  }
  totalReleased = Number(totalReleased.toFixed(2));
  s.distributed = Number((s.distributed + totalReleased).toFixed(2));
  s.pendingDistribution = Math.max(0, Number((s.pendingDistribution - totalReleased).toFixed(2)));

  s.notifications.unshift({
    id: `ntf_${Date.now().toString(36)}`,
    category: "payout",
    title: `Distributed $${totalReleased.toLocaleString()} to pool wallets`,
    detail: `Investor wallets credited pro-rata across ${packageCodes?.join(", ") || "all active packages"}`,
    time: "Just now",
    unread: true,
  });
  pushAudit("Jane Operator", "POOL", "BATCH_PROFIT_DISTRIBUTED", `Credited $${totalReleased.toFixed(2)} net earnings to investor wallets`);
  return { releasedAmount: totalReleased, distributedTotal: s.distributed, pendingRemaining: s.pendingDistribution };
}

export function processPayoutBatch(ids: string[], action: "approve" | "hold") {
  const s = getState();
  let processedAmount = 0;
  for (const p of s.payouts) {
    if (ids.includes(p.id) && p.status === "pending") {
      p.status = action === "approve" ? "approved" : "held";
      if (action === "approve") processedAmount += p.amount;
    }
  }
  if (processedAmount > 0) {
    s.availableCapital = Math.max(0, Number((s.availableCapital - processedAmount).toFixed(2)));
  }
  pushAudit("Jane Operator", "TREASURY", action === "approve" ? "PAYOUT_BATCH_RELEASED" : "PAYOUT_PLACED_ON_HOLD", `${ids.length} request(s) · $${processedAmount.toFixed(2)}`);
  return { count: ids.length, processedAmount };
}

export function reviewDeposit(id: string, action: "verify" | "request_proof") {
  const s = getState();
  const dep = s.deposits.find((d) => d.id === id);
  if (!dep) return null;
  dep.status = action === "verify" ? "verified" : "proof_requested";
  if (action === "verify") {
    s.totalCapital += dep.amount;
    s.availableCapital += dep.amount;
    s.capitalDeltaToday += dep.amount;
  }
  pushAudit("Jane Operator", "TREASURY", action === "verify" ? "DEPOSIT_VERIFIED" : "DEPOSIT_PROOF_REQUESTED", `${dep.reference} (${dep.investorHandle}) $${dep.amount.toLocaleString()}`);
  return dep;
}

export function reviewInvestorKyc(investorId: string, decision: "approved" | "reupload_requested") {
  const s = getState();
  const inv = s.investors.find((i) => i.id === investorId);
  if (!inv) return null;
  inv.kycStatus = decision;
  if (decision === "approved") inv.kycLevel = 2;
  pushAudit("Jane Operator", "COMPLIANCE", `KYC_${decision.toUpperCase()}`, `${inv.handle} (${inv.fullName})`);
  return inv;
}

export function sendAnnouncement(input: SendAnnouncementInput) {
  const s = getState();
  const recipients = input.audience === "all" ? 38 : input.audience === "pending_kyc" ? 2 : 14;
  const item = {
    id: `ann_${Date.now().toString(36)}`,
    subject: input.subject,
    audience: input.audience === "all" ? "All Active Investors (38)" : input.audience,
    channels: input.channels.map((c) => (c === "in_app" ? "In-App" : c === "email" ? "Email" : "Telegram")),
    recipientsCount: recipients,
    sentAt: `Just now · ${nowHHMM()} UTC`,
  };
  s.announcements.unshift(item);
  pushAudit("Jane Operator", "POOL", "ANNOUNCEMENT_DISPATCHED", `"${input.subject}" → ${recipients} recipients`);
  return item;
}

export function updateBotState(input: { action: "toggle" | "create" | "halt_all" | "resume_all"; botId?: string; name?: string; symbol?: ExecuteQuickTradeInput["symbol"]; strategy?: ExecuteQuickTradeInput["strategy"]; stake?: number; packageCode?: string }) {
  const s = getState();
  if (input.action === "halt_all") {
    s.risk.emergencyHalted = true;
    for (const b of s.bots) b.status = "halted";
    pushAudit("Jane Operator", "RISK", "EMERGENCY_HALT_ACTIVATED", "All running bots & automated schedules paused");
    return s.bots;
  }
  if (input.action === "resume_all") {
    s.risk.emergencyHalted = false;
    for (const b of s.bots) b.status = "running";
    pushAudit("Jane Operator", "RISK", "DESK_EXECUTION_RESUMED", "Automated bots restored to active state");
    return s.bots;
  }
  if (input.action === "create" && input.symbol && input.strategy) {
    const code = `BOT-0${s.bots.length + 1}`;
    s.bots.unshift({
      id: `bot_${Date.now().toString(36)}`,
      code,
      name: input.name || `${input.symbol} ${input.strategy}`,
      symbol: input.symbol,
      strategy: input.strategy,
      stake: input.stake ?? 35,
      packageCode: input.packageCode ?? "PKG-01",
      status: "running",
      tradesToday: 0,
      winRatePercent: 0,
      pnlToday: 0,
      maxConsecutiveLosses: 0,
    });
    pushAudit("Jane Operator", "EXECUTION", "BOT_DEPLOYED", `${code} on ${input.symbol} (${input.strategy})`);
    return s.bots;
  }
  const target = s.bots.find((b) => b.id === input.botId);
  if (target) {
    target.status = target.status === "running" ? "paused" : "running";
    pushAudit("Jane Operator", "EXECUTION", "BOT_TOGGLED", `${target.code} → ${target.status}`);
  }
  return s.bots;
}

export function switchDerivConnection(connectionId: string) {
  const s = getState();
  for (const c of s.connections) {
    c.status = c.id === connectionId ? "active" : "standby";
    c.latencyMs = Math.floor(29 + Math.random() * 18);
    c.lastPingIso = new Date().toISOString();
  }
  s.activeConnectionId = connectionId;
  pushAudit("Jane Operator", "SESSION", "DERIV_ACCOUNT_SWITCHED", `Active connection set to ${connectionId}`);
  return s.connections;
}

export function updateRiskConfig(patch: Partial<RiskGuardrailConfigDTO>) {
  const s = getState();
  s.risk = { ...s.risk, ...patch };
  pushAudit("Jane Operator", "RISK", "GUARDRAILS_UPDATED", `Max daily loss $${s.risk.maxDailyLoss} · DD cap ${s.risk.packageDrawdownLimitPercent}%`);
  return s.risk;
}

export function rebalanceCapital(input: { capitalInTrades: number; split: Record<string, number> }) {
  const s = getState();
  const clamped = Math.max(0, Math.min(s.totalCapital, input.capitalInTrades));
  s.capitalInTrades = clamped;
  s.availableCapital = Number((s.totalCapital - clamped).toFixed(2));
  for (const p of s.packages) {
    if (p.code in input.split) {
      p.capitalSharePercent = input.split[p.code];
      p.totalCapital = Math.round((clamped * input.split[p.code]) / 100);
    }
  }
  pushAudit("Jane Operator", "TREASURY", "CAPITAL_REBALANCED", `Deployed $${clamped.toLocaleString()} · Reserve $${s.availableCapital.toLocaleString()}`);
  return getFundsFlow();
}

export function markAllNotificationsRead() {
  const s = getState();
  for (const n of s.notifications) n.unread = false;
  return s.notifications;
}
