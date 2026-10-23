import { getFundsBundle } from "./funds-service";
import { ledgerTrades } from "./trade-log-service";
import {
  paramsDefaults,
  type BotConfig,
  type BotWorkspace,
  type AutomationRule,
} from "@/lib/bots/model";
export function defaultBotConfig(): BotConfig {
  return {
    symbol: "R_10",
    contract: "CALL",
    strategy: "Martingale",
    scriptId: null,
    initialStake: 35,
    currentStake: 35,
    maxStake: 100,
    duration: 5,
    unit: "ticks",
    params: structuredClone(paramsDefaults.Martingale),
    capitalBudget: 1400,
    allocations: [
      { pool: "PKG-01", percent: 40 },
      { pool: "PKG-02", percent: 35 },
      { pool: "PKG-03", percent: 25 },
    ],
    takeProfit: 500,
    stopLoss: 300,
    maxDailyLoss: 200,
    maxDailyTrades: 100,
    cooldownLosses: 3,
    cooldownMinutes: 5,
    maxConcurrent: 1,
    guardian: true,
    lossThreshold: 8,
    drawdown: 5,
    rotation: true,
    rotationMinutes: 30,
  };
}
export const defaultScript = `/** Source-only capped Martingale plan. Not executable approval. */
function decide(context) {
  const nextStake = context.previousOutcome === "loss"
    ? Math.min(context.maxStake, context.currentStake * 2.1)
    : context.initialStake;
  return {contract: "CALL", stake: nextStake, reason: "Capped progression; server risk review required"};
}
`;
const evenScript = `/** Source-only side rotation. No next-digit prediction. */
function decide(context) {
  const previous = context.previousSide || "even";
  const side = context.previousOutcome === "loss" ? (previous === "even" ? "odd" : "even") : previous;
  return {contract: side === "even" ? "DIGITEVEN" : "DIGITODD", stake: context.initialStake, reason: "Deterministic side rotation; review required"};
}
`;
const accumScript = `/** Source-only capped stake accumulation, not a broker accumulator. */
function decide(context) {
  const stake = context.previousOutcome === "win"
    ? Math.min(context.maxStake, context.currentStake + context.initialStake)
    : context.initialStake;
  return {contract: "CALL", stake, reason: "Capped accumulation; provider validation required"};
}
`;
export function getBotsWorkspace(): BotWorkspace {
  const asOf = "2026-10-23T10:00:00Z",
    config = defaultBotConfig();
  const rules: AutomationRule[] = [
    {
      id: "rule_losses",
      name: "Halt on 3 consecutive losses",
      metric: "consecutive_losses",
      operator: ">=",
      threshold: 3,
      time: "17:00",
      action: "pause_bot",
      botId: "bot_1",
      minutes: 5,
      enabled: true,
      lastTriggered: "2026-10-23T09:10:00Z",
      triggerCount: 5,
    },
    {
      id: "rule_deposit",
      name: "Notify on large deposit",
      metric: "deposit",
      operator: ">=",
      threshold: 5000,
      time: "17:00",
      action: "notify_operator",
      botId: "",
      minutes: 5,
      enabled: true,
      lastTriggered: "2026-10-23T08:15:00Z",
      triggerCount: 2,
    },
    {
      id: "rule_complete",
      name: "Review distribution on completion",
      metric: "package_completed",
      operator: "equals",
      threshold: 1,
      time: "17:00",
      action: "review_distribution",
      botId: "",
      minutes: 5,
      enabled: true,
      lastTriggered: "2026-10-10T10:00:00Z",
      triggerCount: 1,
    },
    {
      id: "rule_time",
      name: "Weekday desk close",
      metric: "weekday_time",
      operator: "equals",
      threshold: 0,
      time: "17:00",
      action: "pause_all",
      botId: "",
      minutes: 5,
      enabled: true,
      lastTriggered: "2026-10-22T17:00:00Z",
      triggerCount: 9,
    },
    {
      id: "rule_drawdown",
      name: "Recovery alert",
      metric: "drawdown",
      operator: ">",
      threshold: 8,
      time: "17:00",
      action: "notify_operator",
      botId: "",
      minutes: 5,
      enabled: false,
      lastTriggered: null,
      triggerCount: 0,
    },
  ];
  return {
    mode: "demo",
    asOf,
    revision: 0,
    bots: [
      {
        id: "bot_1",
        name: "Bot-Alpha",
        status: "running",
        runtimeMinutes: 134,
        cooldownUntil: null,
        reason: "Seeded running state; no worker connected",
        config,
      },
      {
        id: "bot_2",
        name: "Bot-Bravo",
        status: "running",
        runtimeMinutes: 134,
        cooldownUntil: null,
        reason: "Seeded running state; no worker connected",
        config: {
          ...structuredClone(config),
          symbol: "R_75",
          strategy: "Even/Odd",
          contract: "DIGITEVEN",
          params: structuredClone(paramsDefaults["Even/Odd"]),
          capitalBudget: 800,
          allocations: [{ pool: "PKG-02", percent: 100 }],
        },
      },
      {
        id: "bot_3",
        name: "Bot-Charlie",
        status: "paused",
        runtimeMinutes: 102,
        cooldownUntil: "2026-10-23T10:04:00Z",
        reason:
          "Snapshot loss cooldown; resume is never automatic in this demo",
        config: {
          ...structuredClone(config),
          symbol: "R_100",
          strategy: "DCA",
          initialStake: 35,
          currentStake: 70,
          maxStake: 150,
          params: structuredClone(paramsDefaults.DCA),
          capitalBudget: 700,
          allocations: [{ pool: "PKG-03", percent: 100 }],
        },
      },
      {
        id: "bot_4",
        name: "Bot-Delta",
        status: "stopped",
        runtimeMinutes: 0,
        cooldownUntil: null,
        reason: "Manual stop",
        config: {
          ...structuredClone(config),
          strategy: "Oscar's Grind",
          params: structuredClone(paramsDefaults["Oscar's Grind"]),
          allocations: [],
        },
      },
      {
        id: "bot_5",
        name: "Bot-Echo",
        status: "idle",
        runtimeMinutes: 0,
        cooldownUntil: null,
        reason: "No schedule assigned",
        config: {
          ...structuredClone(config),
          symbol: "R_25",
          strategy: "Fibonacci",
          params: structuredClone(paramsDefaults.Fibonacci),
          allocations: [],
        },
      },
    ],
    pools: getFundsBundle().allocations.map((p) => ({
      code: p.code,
      name: p.name,
      available: p.capital - p.deployed,
    })),
    receipts: ledgerTrades.map((t) => ({
      id: t.id,
      botId: t.botId,
      executedAt: t.executedAt,
      symbol: t.symbol,
      stake: t.stake,
      profit: t.profit,
      isWin: t.isWin,
      packageCode: t.packageCode,
    })),
    guardian: {
      enabled: true,
      oddEvenLosses: 8,
      digitLosses: 10,
      bulkRuns: 2,
      drawdown: 5,
      rotation: true,
      rotationMinutes: 30,
    },
    triggers: [
      {
        id: "trigger_1",
        time: "2026-10-23T09:59:00Z",
        pool: "PKG-03",
        condition: "3 consecutive losses",
        action: "Paused Bot-Charlie for 5 minutes",
        resumeAt: "2026-10-23T10:04:00Z",
        resolved: false,
      },
      {
        id: "trigger_2",
        time: "2026-10-23T08:42:00Z",
        pool: "PKG-03",
        condition: "5% drawdown observation",
        action: "Paused 10 minutes (historical fixture)",
        resumeAt: "2026-10-23T08:52:00Z",
        resolved: true,
      },
      {
        id: "trigger_3",
        time: "2026-10-23T08:08:00Z",
        pool: "PKG-01",
        condition: "Scheduled market rotation",
        action: "R_10 → R_25 (historical fixture)",
        resumeAt: null,
        resolved: true,
      },
    ],
    rules,
    notifications: [
      {
        id: "notice_1",
        time: "2026-10-23T10:00:00Z",
        category: "guardian",
        title: "Bot-Charlie cooldown review",
        detail:
          "Seeded Guardian alert for PKG-03. Review limits before requesting a manual restart.",
        read: false,
        botId: "bot_3",
      },
      {
        id: "notice_2",
        time: "2026-10-23T09:58:00Z",
        category: "deposit",
        title: "Deposit review observation",
        detail:
          "Synthetic deposit review, not a new verified transfer. Open deposits to review its independent source.",
        read: false,
        botId: null,
      },
      {
        id: "notice_3",
        time: "2026-10-23T09:54:00Z",
        category: "trade",
        title: "Receipt evidence available",
        detail:
          "D-4 historical ledger projection is available for Bot-Alpha. No new live trade is implied.",
        read: false,
        botId: "bot_1",
      },
      {
        id: "notice_4",
        time: "2026-10-23T09:50:00Z",
        category: "payout",
        title: "Payout review reminder",
        detail:
          "Open the independent payout desk to inspect pending decisions. No batch was approved by this alert.",
        read: true,
        botId: null,
      },
      {
        id: "notice_5",
        time: "2026-10-23T09:40:00Z",
        category: "kyc",
        title: "Investor verification review",
        detail:
          "Review investor KYC in the investor desk. This is a seeded in-app observation.",
        read: true,
        botId: null,
      },
    ],
    preferences: {
      trade: true,
      guardian: true,
      deposit: true,
      depositThreshold: 5000,
      kyc: false,
      payout: true,
      sound: false,
      telegram: false,
    },
    scripts: [
      {
        id: "script_martingale",
        name: "Martingale-V2.js",
        language: "javascript",
        code: defaultScript,
        updatedAt: "2026-10-15T10:00:00Z",
        runs: 3,
        wins: 2,
      },
      {
        id: "script_even",
        name: "Even-Odd-Anti.js",
        language: "javascript",
        code: evenScript,
        updatedAt: "2026-10-12T10:00:00Z",
        runs: 8,
        wins: 5,
      },
      {
        id: "script_accum",
        name: "Custom-Accum.js",
        language: "javascript",
        code: accumScript,
        updatedAt: "2026-10-10T10:00:00Z",
        runs: 2,
        wins: 1,
      },
    ],
    audit: [],
    dryRuns: [],
  };
}
