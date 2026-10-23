import { z } from "zod";
export const groups = [
  "Synthetics",
  "Forex",
  "Commodities",
  "Crypto",
  "Indices",
  "Stock Indices",
] as const;
export const strategies = [
  "Fixed stake",
  "Martingale",
  "Even/Odd",
  "DCA",
  "Fibonacci",
] as const;
export interface SymbolDTO {
  code: string;
  name: string;
  group: (typeof groups)[number];
  decimals: number;
  previous: number;
  ticks: { quote: number; time: string }[];
  contracts: string[];
  tickSeconds: number;
}
export interface MarketBundle {
  mode: "demo";
  asOf: string;
  revision: number;
  symbols: SymbolDTO[];
  favorites: string[];
  pools: {
    code: string;
    name: string;
    available: number;
    strategies: (typeof strategies)[number][];
    symbols: string[];
    guardian: boolean;
    drawdown: number;
  }[];
  schedules: {
    id: string;
    symbol: string;
    strategy: string;
    stake: number;
    maxTrades: number;
    duration: number;
    unit: "ticks" | "seconds";
    contract: string;
    pools: string[];
    mode: "now" | "later";
    time: string;
    budget: number;
    state: "queued_demo" | "cancelled";
  }[];
  receipts: {
    symbol: string;
    strategy: string;
    profit: number;
    isWin: boolean;
    executedAt: string;
  }[];
  audit: { time: string; action: string; detail: string }[];
}
export const scheduleSchema = z.object({
  symbol: z.string(),
  strategy: z.enum(strategies),
  stake: z.number().min(0.35).max(1000).multipleOf(0.01),
  maxTrades: z.number().int().min(1).max(20),
  duration: z.number().int().min(1).max(3600),
  unit: z.enum(["ticks", "seconds"]),
  contract: z.enum(["CALL", "PUT", "DIGITEVEN", "DIGITODD"]),
  pools: z.array(z.string()).min(1).max(3),
  mode: z.enum(["now", "later"]),
  time: z.string(),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export function marketSession(symbol: SymbolDTO, at: string) {
  const d = new Date(at),
    day = d.getUTCDay(),
    minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (["Synthetics", "Crypto"].includes(symbol.group))
    return {
      open: true,
      label: "24/7 demo calendar",
      next: null as string | null,
    };
  if (symbol.group === "Forex" || symbol.group === "Commodities") {
    const opening = symbol.group === "Forex" ? 0 : 60,
      closing = symbol.group === "Forex" ? 1320 : 1410;
    const open =
      day >= 1 &&
      day <= 5 &&
      !(day === 1 && minutes < opening) &&
      !(day === 5 && minutes >= closing);
    const delta = open ? 5 - day : (8 - day) % 7;
    const next = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + delta) +
        (open ? closing : opening) * 60000,
    ).toISOString();
    return {
      open,
      label:
        symbol.group === "Forex"
          ? "Mon 00:00 → Fri 22:00 UTC"
          : "Mon 01:00 → Fri 23:30 UTC",
      next,
    };
  }
  const dst = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(d);
  const offset = ((Number(dst) - d.getUTCHours() + 36) % 24) - 12;
  const start = 570 - offset * 60,
    end = 960 - offset * 60;
  const open = day > 0 && day < 6 && minutes >= start && minutes < end;
  let next: string | null = null;
  for (let n = 0; n < 8; n++) {
    const t = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n),
    );
    const wd = t.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const localHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(t),
    );
    const off = ((localHour - t.getUTCHours() + 36) % 24) - 12;
    const a = 570 - off * 60,
      b = 960 - off * 60;
    const stamp = t.getTime() + (open && n === 0 ? b : a) * 60000;
    if (stamp > d.getTime()) {
      next = new Date(stamp).toISOString();
      break;
    }
  }
  return {
    open,
    label: "Weekdays 09:30–16:00 America/New_York",
    next,
  };
}
export function budgetFor(
  v: Pick<ScheduleInput, "strategy" | "stake" | "maxTrades">,
) {
  let units = 0,
    a = 1,
    b = 1;
  for (let i = 0; i < v.maxTrades; i++) {
    units +=
      v.strategy === "Martingale" ? 2 ** i : v.strategy === "Fibonacci" ? a : 1;
    if (v.strategy === "Fibonacci") {
      const next = a + b;
      a = b;
      b = next;
    }
  }
  return Math.round(units * v.stake * 100) / 100;
}
export function scheduleIssues(
  s: MarketBundle,
  input: ScheduleInput,
  now: string,
) {
  const p = scheduleSchema.safeParse(input);
  if (!p.success) return p.error.issues.map((i) => i.message);
  const v = p.data,
    symbol = s.symbols.find((x) => x.code === v.symbol),
    issues: string[] = [];
  if (!symbol) return ["Unknown market symbol"];
  if (!symbol.contracts.includes(v.contract))
    issues.push("Contract is unavailable for this symbol");
  if (
    (v.strategy === "Even/Odd" || v.unit === "ticks") &&
    symbol.group !== "Synthetics"
  )
    issues.push(
      "Digit strategies and tick-duration contracts require a synthetic symbol",
    );
  if (
    v.strategy === "Even/Odd" &&
    !["DIGITEVEN", "DIGITODD"].includes(v.contract)
  )
    issues.push("Even/Odd requires a digit contract");
  if (v.unit === "ticks" && v.duration > 10)
    issues.push("Tick duration must be between 1 and 10");
  if (v.unit === "seconds" && v.duration < 60)
    issues.push("Time duration must be at least 60 seconds");
  const at = v.mode === "now" ? now : v.time;
  if (
    !Number.isFinite(Date.parse(at)) ||
    (v.mode === "later" &&
      (Date.parse(at) <= Date.parse(now) ||
        Date.parse(at) > Date.parse(now) + 30 * 86400000))
  )
    issues.push("Schedule must be a future UTC time within 30 days");
  else if (!marketSession(symbol, at).open)
    issues.push(
      "Market is closed at the requested time in the illustrative calendar",
    );
  if (new Set(v.pools).size !== v.pools.length)
    issues.push("Select each package only once");
  if (Number.isFinite(Date.parse(at))) {
    const session = marketSession(symbol, at);
    if (
      session.open &&
      session.next &&
      Date.parse(at) +
        v.duration *
          v.maxTrades *
          (v.unit === "ticks" ? symbol.tickSeconds : 1) *
          1000 >
        Date.parse(session.next)
    )
      issues.push("Modeled sequence crosses the illustrative market close");
  }
  const total = budgetFor(v);
  for (const code of v.pools) {
    const pool = s.pools.find((p) => p.code === code);
    if (!pool) {
      issues.push("Unknown package");
      continue;
    }
    if (!pool.strategies.includes(v.strategy))
      issues.push(`${code} does not permit ${v.strategy}`);
    if (!pool.symbols.includes(v.symbol))
      issues.push(`${code} is not assigned to ${v.symbol}`);
    if (!pool.guardian) issues.push(`${code} needs its risk guard enabled`);
    const used = s.schedules
      .filter((q) => q.state === "queued_demo" && q.pools.includes(code))
      .reduce((n, q) => n + q.budget / q.pools.length, 0);
    if (total / v.pools.length > pool.available - used + 0.001)
      issues.push(`${code} has insufficient unreserved demo capital`);
  }
  return issues;
}
export function tickStats(symbol: SymbolDTO) {
  const ticks = symbol.ticks.slice(-100),
    digits = ticks.map((t) =>
      Number(t.quote.toFixed(symbol.decimals).replace(".", "").at(-1)),
    ),
    last50 = digits.slice(-50);
  const mean = ticks.reduce((n, t) => n + t.quote, 0) / ticks.length;
  return {
    digits: last50,
    histogram: Array.from(
      { length: 10 },
      (_, d) => digits.filter((x) => x === d).length,
    ),
    even: (last50.filter((n) => n % 2 === 0).length / last50.length) * 100,
    odd: (last50.filter((n) => n % 2 !== 0).length / last50.length) * 100,
    std: Math.sqrt(
      ticks.reduce((n, t) => n + (t.quote - mean) ** 2, 0) / ticks.length,
    ),
    count: ticks.length,
  };
}
export function performance(s: MarketBundle) {
  const end = Date.parse(s.asOf.slice(0, 10)) + 86400000,
    start = end - 30 * 86400000;
  const grouped = new Map<string, MarketBundle["receipts"]>();
  for (const r of s.receipts.filter(
    (r) => Date.parse(r.executedAt) >= start && Date.parse(r.executedAt) < end,
  )) {
    const key = r.symbol + "|" + r.strategy;
    grouped.set(key, [...(grouped.get(key) ?? []), r]);
  }
  return [...grouped]
    .map(([key, rs]) => ({
      symbol: key.split("|")[0],
      strategy: key.split("|")[1],
      count: rs.length,
      net: rs.reduce((n, r) => n + r.profit, 0),
      wins: (rs.filter((r) => r.isWin).length / rs.length) * 100,
    }))
    .sort((a, b) => b.net - a.net);
}
export const marketCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("favorite"), symbol: z.string() }),
  z.object({ kind: z.literal("ticks"), symbol: z.string() }),
  z.object({
    kind: z.literal("favorites"),
    symbols: z.array(z.string()).max(100),
  }),
  z.object({
    kind: z.literal("assign"),
    pool: z.string(),
    symbols: z.array(z.string()).min(1).max(100),
  }),
  z.object({
    kind: z.literal("risk"),
    pool: z.string(),
    guardian: z.boolean(),
    drawdown: z.number().min(1).max(5),
  }),
  z.object({ kind: z.literal("schedule"), input: scheduleSchema }),
  z.object({ kind: z.literal("cancel"), id: z.string() }),
]);
export type MarketCommand = z.infer<typeof marketCommandSchema>;
export function applyMarketCommand(
  current: MarketBundle,
  input: MarketCommand,
  now = new Date().toISOString(),
) {
  const c = marketCommandSchema.parse(input);
  const s = structuredClone(current);
  let detail = "";
  if (c.kind === "favorite" || c.kind === "ticks") {
    const symbol = s.symbols.find((x) => x.code === c.symbol);
    if (!symbol) throw Error("Symbol not found");
    if (c.kind === "favorite")
      s.favorites = s.favorites.includes(c.symbol)
        ? s.favorites.filter((x) => x !== c.symbol)
        : [...s.favorites, c.symbol];
    else {
      for (let i = 0; i < 5; i++) {
        const last = symbol.ticks.at(-1)!;
        const quote = Number(
          (
            last.quote +
            Math.sin(symbol.ticks.length * 0.71 + s.revision + i) *
              10 ** -symbol.decimals *
              3
          ).toFixed(symbol.decimals),
        );
        symbol.ticks.push({
          quote: Math.max(10 ** -symbol.decimals, quote),
          time: new Date(
            Math.max(
              Date.parse(now),
              Date.parse(last.time) + symbol.tickSeconds * 1000,
            ),
          ).toISOString(),
        });
      }
      symbol.ticks = symbol.ticks.slice(-100);
    }
    detail = c.symbol;
  }
  if (c.kind === "favorites") {
    if (c.symbols.some((code) => !s.symbols.some((x) => x.code === code)))
      throw Error("Unknown favorite symbol");
    s.favorites = [...new Set(c.symbols)];
    detail = "Restored operator-local favorites";
  }
  if (c.kind === "assign") {
    const pool = s.pools.find((p) => p.code === c.pool);
    if (
      !pool ||
      !c.symbols.length ||
      c.symbols.some((x) => !s.symbols.some((m) => m.code === x))
    )
      throw Error("Choose known symbols and retain at least one market");
    if (
      s.schedules.some(
        (q) =>
          q.state === "queued_demo" &&
          q.pools.includes(c.pool) &&
          !c.symbols.includes(q.symbol),
      )
    )
      throw Error(
        "Cancel the queued demo schedule before removing its assignment",
      );
    pool.symbols = [...new Set(c.symbols)];
    detail = c.pool;
  }
  if (c.kind === "risk") {
    const pool = s.pools.find((p) => p.code === c.pool);
    if (
      !pool ||
      !Number.isFinite(c.drawdown) ||
      c.drawdown < 1 ||
      c.drawdown > 5 ||
      !c.guardian
    )
      throw Error(
        "Keep the risk guard enabled and drawdown between 1 and 5 percent",
      );
    pool.guardian = c.guardian;
    pool.drawdown = c.drawdown;
    detail = c.pool;
  }
  if (c.kind === "schedule") {
    const issues = scheduleIssues(s, c.input, now);
    if (issues.length) throw Error(issues.join("; "));
    const input = scheduleSchema.parse(c.input);
    s.schedules.unshift({
      ...input,
      id: `market_schedule_${s.revision + 1}`,
      time: input.mode === "now" ? now : input.time,
      budget: budgetFor(input),
      state: "queued_demo",
    });
    detail = `${input.symbol} · queued locally, no trade or background job`;
  }
  if (c.kind === "cancel") {
    const q = s.schedules.find((q) => q.id === c.id);
    if (!q || q.state !== "queued_demo")
      throw Error("Only queued local requests can be cancelled");
    q.state = "cancelled";
    detail = q.id;
  }
  s.revision++;
  s.audit.unshift({ time: now, action: c.kind, detail });
  return s;
}
