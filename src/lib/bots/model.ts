import { z } from "zod";
export const botStrategies = [
  "Martingale",
  "Even/Odd",
  "DCA",
  "Oscar's Grind",
  "Fibonacci",
  "Custom script",
] as const;
export const symbols = ["R_10", "R_25", "R_50", "R_75", "R_100"] as const;
export const configSchema = z.object({
  symbol: z.enum(symbols),
  contract: z.enum([
    "CALL",
    "PUT",
    "DIGITEVEN",
    "DIGITODD",
    "DIGITOVER",
    "DIGITUNDER",
  ]),
  strategy: z.enum(botStrategies),
  scriptId: z.string().nullable(),
  initialStake: z.number().min(0.35).max(1000).multipleOf(0.01),
  currentStake: z.number().min(0.35).max(1000).multipleOf(0.01),
  maxStake: z.number().min(0.35).max(1000).multipleOf(0.01),
  duration: z.number().int().min(1).max(3600),
  unit: z.enum(["ticks", "seconds"]),
  params: z.record(z.string(), z.unknown()),
  capitalBudget: z.number().min(1).max(50000),
  allocations: z
    .array(
      z.object({ pool: z.string(), percent: z.number().min(0.01).max(100) }),
    )
    .max(3),
  takeProfit: z.number().min(1).max(50000),
  stopLoss: z.number().min(1).max(50000),
  maxDailyLoss: z.number().min(1).max(50000),
  maxDailyTrades: z.number().int().min(1).max(1000),
  cooldownLosses: z.number().int().min(1).max(10),
  cooldownMinutes: z.number().int().min(1).max(60),
  maxConcurrent: z.number().int().min(1).max(2),
  guardian: z.literal(true),
  lossThreshold: z.number().int().min(1).max(10),
  drawdown: z.number().min(0.1).max(5),
  rotation: z.boolean(),
  rotationMinutes: z.number().int().min(5).max(120),
});
export type BotConfig = z.infer<typeof configSchema>;
export const guardianSchema = z.object({
  enabled: z.literal(true),
  oddEvenLosses: z.number().int().min(1).max(8),
  digitLosses: z.number().int().min(1).max(10),
  bulkRuns: z.number().int().min(1).max(2),
  drawdown: z.number().min(0.1).max(5),
  rotation: z.boolean(),
  rotationMinutes: z.number().int().min(5).max(120),
});
export const ruleSchema = z.object({
  name: z.string().trim().min(3).max(80),
  metric: z.enum([
    "consecutive_losses",
    "deposit",
    "package_completed",
    "weekday_time",
    "drawdown",
  ]),
  operator: z.enum([">=", ">", "equals"]),
  threshold: z.number().min(0).max(1000000),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  action: z.enum([
    "pause_bot",
    "notify_operator",
    "review_distribution",
    "pause_all",
  ]),
  botId: z.string(),
  minutes: z.number().int().min(1).max(60),
  enabled: z.boolean(),
});
export type AutomationRule = z.infer<typeof ruleSchema> & {
  id: string;
  lastTriggered: string | null;
  triggerCount: number;
};
export const notificationSchema = z.object({
  trade: z.boolean(),
  guardian: z.literal(true),
  deposit: z.boolean(),
  depositThreshold: z.number().min(1).max(1000000),
  kyc: z.boolean(),
  payout: z.boolean(),
  sound: z.boolean(),
  telegram: z.boolean(),
});
export interface Bot {
  id: string;
  name: string;
  status: "running" | "paused" | "stopped" | "idle";
  runtimeMinutes: number;
  cooldownUntil: string | null;
  reason: string;
  config: BotConfig;
}
export interface BotWorkspace {
  mode: "demo";
  asOf: string;
  revision: number;
  bots: Bot[];
  pools: { code: string; name: string; available: number }[];
  receipts: {
    id: string;
    botId: string;
    executedAt: string;
    symbol: string;
    stake: number;
    profit: number;
    isWin: boolean;
    packageCode: string;
  }[];
  guardian: z.infer<typeof guardianSchema>;
  triggers: {
    id: string;
    time: string;
    pool: string;
    condition: string;
    action: string;
    resumeAt: string | null;
    resolved: boolean;
  }[];
  rules: AutomationRule[];
  notifications: {
    id: string;
    time: string;
    category: "trade" | "guardian" | "deposit" | "payout" | "kyc";
    title: string;
    detail: string;
    read: boolean;
    botId: string | null;
  }[];
  preferences: z.infer<typeof notificationSchema>;
  scripts: {
    id: string;
    name: string;
    code: string;
    language: "javascript";
    updatedAt: string;
    runs: number;
    wins: number;
  }[];
  audit: { time: string; action: string; detail: string }[];
  dryRuns: {
    id: string;
    botId: string;
    time: string;
    symbol: string;
    stake: number;
    contract: string;
    result: "plan_only";
  }[];
}
export const paramsDefaults: Record<
  (typeof botStrategies)[number],
  Record<string, unknown>
> = {
  Martingale: { multiplier: 2.1, maxSteps: 5, resetOnWin: true },
  "Even/Odd": { defaultSide: "even", switchOnLoss: true },
  DCA: { stakeSchedule: [35, 35, 70, 105] },
  "Oscar's Grind": { increment: 1, maxSteps: 5 },
  Fibonacci: { maxSteps: 5 },
  "Custom script": { maxSteps: 1 },
};
export function paramsIssues(c: BotConfig) {
  const schemas = {
    Martingale: z
      .object({
        multiplier: z.number().min(1).max(3),
        maxSteps: z.number().int().min(1).max(10),
        resetOnWin: z.boolean(),
      })
      .strict(),
    "Even/Odd": z
      .object({
        defaultSide: z.enum(["even", "odd"]),
        switchOnLoss: z.boolean(),
      })
      .strict(),
    DCA: z
      .object({
        stakeSchedule: z
          .array(z.number().min(0.35).max(1000).multipleOf(0.01))
          .min(1)
          .max(20),
      })
      .strict(),
    "Oscar's Grind": z
      .object({
        increment: z.number().min(0.01).max(100),
        maxSteps: z.number().int().min(1).max(10),
      })
      .strict(),
    Fibonacci: z.object({ maxSteps: z.number().int().min(1).max(10) }).strict(),
    "Custom script": z.object({ maxSteps: z.literal(1) }).strict(),
  };
  const r = schemas[c.strategy].safeParse(c.params);
  return r.success
    ? []
    : r.error.issues.map(
        (i) => `Strategy parameters: ${i.path.join(".")} ${i.message}`,
      );
}
export function sequenceExposure(c: BotConfig) {
  if (paramsIssues(c).length) return NaN;
  const n = Number(c.params.maxSteps ?? 1);
  let a = 1,
    b = 1,
    total = 0;
  if (c.strategy === "DCA")
    return (c.params.stakeSchedule as number[]).reduce((n, v) => n + v, 0);
  for (let i = 0; i < n; i++) {
    const stake =
      c.strategy === "Martingale"
        ? c.initialStake * Number(c.params.multiplier) ** i
        : c.strategy === "Fibonacci"
          ? c.initialStake * a
          : c.strategy === "Oscar's Grind"
            ? c.initialStake + i * Number(c.params.increment)
            : c.initialStake;
    total += Math.min(c.maxStake, stake);
    const next = a + b;
    a = b;
    b = next;
  }
  return Math.round(total * 100) / 100;
}
export function configIssues(
  s: BotWorkspace,
  botId: string,
  c: BotConfig,
  requireAllocation = false,
) {
  const p = configSchema.safeParse(c);
  if (!p.success)
    return p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const issues = paramsIssues(c);
  if (issues.length) return issues;
  if (c.initialStake > c.maxStake || c.currentStake > c.maxStake)
    issues.push("Initial/current stake must not exceed maximum stake");
  if (c.maxConcurrent > c.maxDailyTrades)
    issues.push("Concurrency cannot exceed the daily trade limit");
  if (c.maxDailyLoss > c.stopLoss)
    issues.push("Daily loss limit must not exceed stop loss");
  if (c.maxStake > c.maxDailyLoss)
    issues.push("Maximum single stake must fit the daily loss cap");
  if (
    (c.unit === "ticks" && c.duration > 10) ||
    (c.unit === "seconds" && c.duration < 60)
  )
    issues.push("Use 1–10 ticks or at least 60 seconds");
  if (
    c.strategy === "Even/Odd" &&
    !["DIGITEVEN", "DIGITODD"].includes(c.contract)
  )
    issues.push("Even/Odd requires DIGITEVEN or DIGITODD");
  if (
    c.strategy === "DCA" &&
    (c.params.stakeSchedule as number[] | undefined)?.some(
      (v) => v > c.maxStake,
    )
  )
    issues.push("DCA stakes cannot exceed maximum stake");
  if (c.strategy !== "Custom script" && c.scriptId !== null)
    issues.push("Built-in strategies must not retain script attachments");
  if (
    c.strategy === "Custom script" &&
    !s.scripts.some((x) => x.id === c.scriptId)
  )
    issues.push("Select an existing script");
  if (
    c.drawdown > s.guardian.drawdown ||
    c.lossThreshold >
      (c.contract === "DIGITEVEN" || c.contract === "DIGITODD"
        ? s.guardian.oddEvenLosses
        : s.guardian.digitLosses) ||
    c.maxConcurrent > s.guardian.bulkRuns
  )
    issues.push("Bot limits cannot be looser than global Guardian policy");
  if (sequenceExposure(c) * c.maxConcurrent > c.capitalBudget)
    issues.push(
      "Capital budget must cover the full modeled stake sequence and concurrency",
    );
  if (
    (requireAllocation || c.allocations.length > 0) &&
    Math.abs(c.allocations.reduce((n, a) => n + a.percent, 0) - 100) > 0.001
  )
    issues.push("Package percentages must total 100%");
  if (requireAllocation && !c.allocations.length)
    issues.push("Assign at least one package before starting or testing");
  if (new Set(c.allocations.map((a) => a.pool)).size !== c.allocations.length)
    issues.push("Each package can be selected once");
  for (const a of c.allocations) {
    const p = s.pools.find((p) => p.code === a.pool);
    if (!p) {
      issues.push("Unknown package");
      continue;
    }
    const reserved = s.bots
      .filter((b) => b.id !== botId && ["running", "paused"].includes(b.status))
      .reduce(
        (n, b) =>
          n +
          (b.config.capitalBudget *
            (b.config.allocations.find((x) => x.pool === a.pool)?.percent ??
              0)) /
            100,
        0,
      );
    if ((c.capitalBudget * a.percent) / 100 > p.available - reserved + 0.001)
      issues.push(`${a.pool}: insufficient unreserved demo capital`);
  }
  return issues;
}
export function botStats(s: BotWorkspace, id: string) {
  const rs = s.receipts.filter((r) => r.botId === id);
  return {
    count: rs.length,
    wins: rs.length ? (rs.filter((r) => r.isWin).length / rs.length) * 100 : 0,
    net: rs.reduce((n, r) => n + r.profit, 0),
    average: rs.length ? rs.reduce((n, r) => n + r.stake, 0) / rs.length : 0,
    best: rs.length ? Math.max(...rs.map((r) => r.profit)) : 0,
    worst: rs.length ? Math.min(...rs.map((r) => r.profit)) : 0,
  };
}
export const commandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("control"),
    id: z.string(),
    action: z.enum(["start", "pause", "stop", "restart"]),
  }),
  z.object({ kind: z.literal("config"), id: z.string(), config: configSchema }),
  z.object({
    kind: z.literal("create"),
    name: z.string().trim().min(3).max(50),
    config: configSchema,
  }),
  z.object({ kind: z.literal("deleteBot"), id: z.string() }),
  z.object({ kind: z.literal("guardian"), value: guardianSchema }),
  z.object({
    kind: z.literal("rule"),
    id: z.string().nullable(),
    value: ruleSchema,
  }),
  z.object({ kind: z.literal("toggleRule"), id: z.string() }),
  z.object({ kind: z.literal("deleteRule"), id: z.string() }),
  z.object({
    kind: z.literal("script"),
    id: z.string().nullable(),
    name: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[\w .-]+\.js$/),
    code: z.string().min(20).max(50000),
  }),
  z.object({ kind: z.literal("duplicateScript"), id: z.string() }),
  z.object({ kind: z.literal("deleteScript"), id: z.string() }),
  z.object({ kind: z.literal("attach"), id: z.string(), botId: z.string() }),
  z.object({ kind: z.literal("read"), id: z.string().nullable() }),
  z.object({ kind: z.literal("preferences"), value: notificationSchema }),
  z.object({ kind: z.literal("dryRun"), id: z.string() }),
  z.object({ kind: z.literal("halt") }),
]);
export type BotCommand = z.infer<typeof commandSchema>;
export function applyBotCommand(
  current: BotWorkspace,
  input: BotCommand,
  now = new Date().toISOString(),
) {
  const c = commandSchema.parse(input),
    s = structuredClone(current);
  const bot = (id: string) => {
    const b = s.bots.find((b) => b.id === id);
    if (!b) throw Error("Bot not found");
    return b;
  };
  const script = (id: string) => {
    const x = s.scripts.find((x) => x.id === id);
    if (!x) throw Error("Script not found");
    return x;
  };
  const valid = (id: string, v: BotConfig, required = false) => {
    const issues = configIssues(s, id, v, required);
    if (issues.length) throw Error(issues.join("; "));
  };
  if (c.kind === "control") {
    const b = bot(c.id);
    const allowed = {
      start: ["idle", "stopped", "paused"],
      pause: ["running"],
      stop: ["running", "paused", "idle"],
      restart: ["running", "paused", "stopped", "idle"],
    };
    if (!allowed[c.action].includes(b.status))
      throw Error("Invalid bot state transition");
    if (c.action === "start" || c.action === "restart") {
      if (b.cooldownUntil && Date.parse(b.cooldownUntil) > Date.parse(now))
        throw Error("Cooldown is still active; restart cannot bypass it");
      valid(b.id, b.config, true);
      b.status = "running";
      b.cooldownUntil = null;
    } else b.status = c.action === "pause" ? "paused" : "stopped";
    b.reason = `${c.action} requested locally; no worker or provider action`;
  }
  if (c.kind === "config") {
    const b = bot(c.id);
    if (b.status === "running")
      throw Error("Pause or stop the bot before editing its configuration");
    valid(b.id, c.config, b.status === "paused");
    b.config = c.config;
  }
  if (c.kind === "create") {
    if (s.bots.length >= 20)
      throw Error("Demo workspace supports at most 20 bots");
    if (s.bots.some((b) => b.name.toLowerCase() === c.name.toLowerCase()))
      throw Error("Bot name already exists");
    valid("new", c.config);
    s.bots.push({
      id: `bot_local_${s.revision + 1}`,
      name: c.name,
      status: "idle",
      runtimeMinutes: 0,
      cooldownUntil: null,
      reason: "Created locally; no worker",
      config: c.config,
    });
  }
  if (c.kind === "deleteBot") {
    const b = bot(c.id);
    if (["running", "paused"].includes(b.status))
      throw Error("Stop the bot before removing it");
    if (s.rules.some((r) => r.botId === c.id))
      throw Error("Remove or retarget referencing automation rules first");
    s.bots = s.bots.filter((b) => b.id !== c.id);
  }
  if (c.kind === "guardian") {
    const old = s.guardian;
    s.guardian = c.value;
    for (const b of s.bots.filter((b) =>
      ["running", "paused"].includes(b.status),
    )) {
      const issues = configIssues(s, b.id, b.config, true);
      if (issues.length) {
        s.guardian = old;
        throw Error(
          "Align active bot limits before tightening global Guardian policy: " +
            b.name,
        );
      }
    }
  }
  if (c.kind === "rule") {
    if (
      c.value.action === "pause_bot" &&
      !s.bots.some((b) => b.id === c.value.botId)
    )
      throw Error("Select a known target bot");
    if (
      c.value.metric === "package_completed" &&
      c.value.action !== "review_distribution"
    )
      throw Error("Package completion must request human distribution review");
    if (c.value.metric === "weekday_time" && c.value.action !== "pause_all")
      throw Error("Weekday time rules must use pause all");
    if (c.value.metric === "deposit" && c.value.action !== "notify_operator")
      throw Error("Deposit rules must notify the operator");
    if (c.id) {
      const r = s.rules.find((r) => r.id === c.id);
      if (!r) throw Error("Rule not found");
      Object.assign(r, c.value);
    } else
      s.rules.unshift({
        ...c.value,
        id: `rule_${s.revision + 1}`,
        lastTriggered: null,
        triggerCount: 0,
      });
  }
  if (c.kind === "toggleRule" || c.kind === "deleteRule") {
    const r = s.rules.find((r) => r.id === c.id);
    if (!r) throw Error("Rule not found");
    if (c.kind === "toggleRule") r.enabled = !r.enabled;
    else s.rules = s.rules.filter((r) => r.id !== c.id);
  }
  if (c.kind === "script") {
    if (
      s.scripts.some(
        (x) => x.id !== c.id && x.name.toLowerCase() === c.name.toLowerCase(),
      )
    )
      throw Error("Script name already exists");
    if (c.id) {
      const x = script(c.id);
      if (
        s.bots.some(
          (b) =>
            b.config.scriptId === c.id &&
            ["running", "paused"].includes(b.status),
        )
      )
        throw Error("Stop attached bots before editing their script");
      Object.assign(x, { name: c.name, code: c.code, updatedAt: now });
    } else
      s.scripts.unshift({
        id: `script_${s.revision + 1}`,
        name: c.name,
        code: c.code,
        language: "javascript",
        updatedAt: now,
        runs: 0,
        wins: 0,
      });
  }
  if (c.kind === "duplicateScript") {
    const x = script(c.id);
    s.scripts.unshift({
      ...x,
      id: `script_${s.revision + 1}`,
      name: x.name.replace(/\.js$/, `-copy-${s.revision + 1}.js`),
      runs: 0,
      wins: 0,
      updatedAt: now,
    });
  }
  if (c.kind === "deleteScript") {
    script(c.id);
    if (s.bots.some((b) => b.config.scriptId === c.id))
      throw Error("Detach this script from all bots before deleting it");
    s.scripts = s.scripts.filter((x) => x.id !== c.id);
  }
  if (c.kind === "attach") {
    script(c.id);
    const b = bot(c.botId);
    if (["running", "paused"].includes(b.status))
      throw Error("Stop the bot before attaching a custom script");
    b.config = {
      ...b.config,
      strategy: "Custom script",
      scriptId: c.id,
      params: { maxSteps: 1 },
    };
    valid(b.id, b.config);
  }
  if (c.kind === "read") {
    if (c.id && !s.notifications.some((n) => n.id === c.id))
      throw Error("Notification not found");
    s.notifications.forEach((n) => {
      if (!c.id || n.id === c.id) n.read = true;
    });
  }
  if (c.kind === "preferences") s.preferences = c.value;
  if (c.kind === "dryRun") {
    const b = bot(c.id);
    valid(b.id, b.config, true);
    if (b.cooldownUntil && Date.parse(b.cooldownUntil) > Date.parse(now))
      throw Error("Cooldown is still active");
    s.dryRuns.unshift({
      id: `plan_${s.revision + 1}`,
      time: now,
      botId: b.id,
      symbol: b.config.symbol,
      stake: b.config.initialStake,
      contract: b.config.contract,
      result: "plan_only",
    });
  }
  if (c.kind === "halt")
    for (const b of s.bots) {
      if (["running", "paused"].includes(b.status)) {
        b.status = "stopped";
        b.reason = "Local emergency halt; no provider cancellation";
      }
    }
  s.revision++;
  s.audit.unshift({
    time: now,
    action: c.kind,
    detail: "id" in c ? String(c.id ?? "new") : "Local workspace policy update",
  });
  return s;
}
export function evaluateRule(
  r: AutomationRule,
  value: number,
  time: string,
  weekday: boolean,
) {
  const met =
    r.metric === "weekday_time"
      ? weekday && time === r.time
      : r.operator === ">="
        ? value >= r.threshold
        : r.operator === ">"
          ? value > r.threshold
          : value === r.threshold;
  return {
    matches: r.enabled && met,
    action: r.action,
    delivery: "preview_only" as const,
  };
}
