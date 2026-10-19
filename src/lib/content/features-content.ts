import type {
  FeatureModuleDTO,
  FeaturesContentDTO,
  MatrixRowDTO,
} from "@/lib/api/types";
import { CTA_SECTION } from "@/lib/content/landing-content";

/**
 * Canonical content for Page H-2 (Features).
 * Completely free of brand-specific broker mentions.
 * Highlights the multi-asset quantitative trading engine, crowdfunding pools,
 * and automated profit sharing.
 */

export const FEATURES_HERO = {
  key: "features-hero",
  eyebrow: "Platform Capabilities & Architecture",
  title: "A complete institutional crowdfunding trade engine.",
  subtitle:
    "Explore the five core pillars powering our platform: the quantitative execution engine, sandboxed algorithmic models, crowdfunded trade pools, automated capital protection, and multi-asset market coverage.",
  payload: {
    headlineHighlight: "crowdfunding trade engine.",
    chips: [
      "DMA Institutional Liquidity",
      "Isolated Quantitative Strategy Sandbox",
      "Automated High-Water Mark Logic",
      "Proportional P&L Distribution Engine",
      "Multi-Asset Risk Envelopes",
    ],
    kpis: [
      { key: "instruments", value: "100+", label: "Tradable assets" },
      { key: "asset-classes", value: "6", label: "Asset classes" },
      { key: "models", value: "24", label: "Quant models" },
      { key: "calc", value: "3 min", label: "Real-time P&L sync" },
    ],
    primaryCta: { label: "Explore Fee Tiers", href: "/pricing" },
    secondaryCta: { label: "Launch Return Calculator", href: "/pricing#calculator" },
  },
};

const BOT_ENGINE_CODE = `// strategy: multi-asset volatility breakout · S&P 500 & FX
const SYMBOL = "SPX500";
const RISK_PER_TRADE = 0.015; // 1.5% max risk per trade

onTick((tick) => {
  if (getOpenContracts().length >= 2) return null;   // enforce concurrent limits
  if (isDrawdownTriggered()) return null;            // AI Guardian safety check

  const rsi = getRSI(14);
  const emaFast = getEMA(9);
  const emaSlow = getEMA(21);

  // Bullish breakout condition
  if (tick.quote > emaFast && emaFast > emaSlow && rsi > 58) {
    const stake = calculateOptimalStake(RISK_PER_TRADE);
    return { contract: "BUY", stake, duration: 30, durationUnit: "m", tp: 1.8, sl: 0.9 };
  }

  // Mean-reversion hedge
  if (tick.quote < emaSlow && rsi < 32) {
    const stake = calculateOptimalStake(RISK_PER_TRADE * 0.75);
    return { contract: "SELL", stake, duration: 15, durationUnit: "m", tp: 1.2, sl: 0.6 };
  }

  return null;
});

onResult((result) => {
  log(result.symbol + " " + result.contract + " | Net: $" + result.pnl.toFixed(2));
});

onComplete((summary) => {
  log("Session closed | Pool P&L: $" + summary.netProfit.toFixed(2) + " (" + summary.winRate + "% win rate)");
});`;

export const FEATURE_MODULES: FeatureModuleDTO[] = [
  {
    id: "mod-bot-engine",
    slug: "bot-engine",
    number: "01",
    icon: "bot",
    eyebrow: "Algorithmic Execution",
    title: "Quantitative execution engine",
    summary:
      "Our automated trade engine operates across global market sessions. Each strategy runs inside strict risk envelopes with automated position sizing and market-aware execution windows.",
    bullets: [
      "Precision execution across Forex, Equities, Futures & Crypto",
      "Eight real-time risk checks evaluated before every single order",
      "Automated trade logs broadcast live to pool investors",
      "Dynamic take-profit and trailing stop-loss algorithms",
    ],
    specs: [
      { label: "Active market feeds", value: "100+ assets" },
      { label: "Execution speed", value: "< 25 ms" },
      { label: "Max daily drawdown", value: "5.0% floor" },
      { label: "Job orchestration", value: "BullMQ + Redis" },
    ],
    demo: {
      kind: "botEngine",
      equityLabel: "PKG-01 · Multi-Asset Quant Pool Equity",
      equity: [
        { label: "09:00", value: 100000 },
        { label: "10:00", value: 101240 },
        { label: "11:00", value: 100890 },
        { label: "12:00", value: 102450 },
        { label: "13:00", value: 103180 },
        { label: "14:00", value: 102940 },
        { label: "15:00", value: 104210 },
        { label: "16:00", value: 105640 },
      ],
      schedule: [
        { id: "w1", day: 0, startHour: 1, endHour: 5, botName: "FX London Breakout", state: "active" },
        { id: "w2", day: 0, startHour: 8, endHour: 11, botName: "US Equities Momentum", state: "active" },
        { id: "w3", day: 1, startHour: 2, endHour: 6, botName: "Futures Trend Following", state: "active" },
        { id: "w4", day: 1, startHour: 13, endHour: 16, botName: "Crypto Funding Arbitrage", state: "paused" },
        { id: "w5", day: 2, startHour: 1, endHour: 5, botName: "FX London Breakout", state: "active" },
        { id: "w6", day: 2, startHour: 9, endHour: 12, botName: "Gold Spot Trend", state: "active" },
        { id: "w7", day: 3, startHour: 3, endHour: 7, botName: "Index Mean Reversion", state: "active" },
        { id: "w8", day: 3, startHour: 14, endHour: 17, botName: "BTC Momentum Alpha", state: "active" },
        { id: "w9", day: 4, startHour: 1, endHour: 6, botName: "FX London Breakout", state: "active" },
        { id: "w10", day: 4, startHour: 12, endHour: 15, botName: "Crypto Funding Arbitrage", state: "active" },
        { id: "w11", day: 5, startHour: 10, endHour: 14, botName: "Multi-Asset Syndicate", state: "paused" },
        { id: "w12", day: 6, startHour: 10, endHour: 13, botName: "Multi-Asset Syndicate", state: "active" },
      ],
      feed: [
        { id: "f1", time: "14:32:08", symbol: "NQ100", contract: "BUY", stake: 450, pnl: 842.5, state: "won" },
        { id: "f2", time: "14:31:52", symbol: "EUR/USD", contract: "SELL", stake: 220, pnl: -220, state: "lost" },
        { id: "f3", time: "14:31:40", symbol: "XAU/USD", contract: "BUY", stake: 310, pnl: null, state: "open" },
        { id: "f4", time: "14:31:21", symbol: "SPX500", contract: "BUY", stake: 400, pnl: 720.0, state: "won" },
        { id: "f5", time: "14:31:02", symbol: "BTC/USDT", contract: "SELL", stake: 500, pnl: -500, state: "lost" },
        { id: "f6", time: "14:30:44", symbol: "WTI_OIL", contract: "BUY", stake: 280, pnl: 512.4, state: "won" },
      ],
      config: [
        { key: "symbol", label: "Primary Instrument", value: "Multi-Asset Syndicate" },
        { key: "contract", label: "Execution Model", value: "Direct Market Access" },
        { key: "stake", label: "Target Risk / Trade", value: "1.5% of Pool Equity" },
        { key: "maxStake", label: "Max Allocation", value: "5.0% Aggregate" },
        { key: "duration", label: "Target Holding", value: "Intraday & Swing" },
        { key: "concurrent", label: "Max Concurrent", value: "4 Positions" },
        { key: "tp", label: "Session Target", value: "2.5% Daily Target" },
        { key: "sl", label: "Session Stop", value: "1.2% Daily Floor" },
        { key: "cooldown", label: "Loss Cooldown", value: "15 min after 2 stops" },
        { key: "strategy", label: "Active Engine", value: "quant-breakout-v4.js" },
      ],
      riskChecks: [
        { id: "rc1", label: "Pool Capital >= Margin Required", detail: "Real-time collateral verification" },
        { id: "rc2", label: "Position Size <= Max Risk Cap", detail: "Per-trade risk envelope" },
        { id: "rc3", label: "Daily Drawdown < Max Daily Loss", detail: "Rolling session boundary" },
        { id: "rc4", label: "Max Daily Orders < Trade Ceiling", detail: "Overtrading prevention" },
        { id: "rc5", label: "Volatility Filter Passed", detail: "Spread & slippage check" },
        { id: "rc6", label: "Target TP / SL Enforced", detail: "Hard bracket orders" },
        { id: "rc7", label: "Correlation Risk Filter", detail: "Cross-asset exposure cap" },
        { id: "rc8", label: "Market Session Active", detail: "Liquidity window verified" },
      ],
    },
  },
  {
    id: "mod-script-engine",
    slug: "script-engine",
    number: "02",
    icon: "script",
    eyebrow: "Quantitative Strategy",
    title: "Sandboxed algorithmic strategy engine",
    summary:
      "Strategies are authored and backtested in a secure sandboxed environment. Built-in mathematical indicators and tick-by-tick market data feed every execution decision.",
    bullets: [
      "Precision lifecycle hooks: onTick, onResult, onComplete",
      "12 built-in quantitative indicators (EMA, RSI, MACD, Bollinger, Stochastic)",
      "Strict 128MB memory and 100ms per-tick latency budget",
      "Deterministic order execution and position sizing",
    ],
    specs: [
      { label: "Sandbox architecture", value: "isolated-vm" },
      { label: "Memory allocation", value: "128 MB" },
      { label: "Tick latency ceiling", value: "100 ms" },
      { label: "Indicator library", value: "12 quant models" },
    ],
    demo: {
      kind: "scriptEngine",
      fileName: "multi-asset-quant.js",
      code: BOT_ENGINE_CODE,
      api: [
        { signature: "onTick(tick)", description: "Evaluated on every incoming price tick. Returns trade decision or null." },
        { signature: "onResult(result)", description: "Executed upon trade settlement with realized P&L and execution fill details." },
        { signature: "onComplete(summary)", description: "Invoked upon trading session closure with aggregate performance metrics." },
        { signature: "getTicks(limit)", description: "Retrieves historical tick buffers for statistical analysis." },
        { signature: "getSMA(period) / getEMA(period)", description: "Calculates simple & exponential moving averages." },
        { signature: "getRSI(period)", description: "Relative Strength Index (0–100 momentum indicator)." },
        { signature: "getMACD(fast, slow, signal)", description: "Moving Average Convergence Divergence line and histogram." },
        { signature: "getBollingerBands(period, stdDev)", description: "Upper, middle, and lower volatility bands." },
        { signature: "getStochastic(k, d)", description: "Fast & slow stochastic momentum oscillator." },
        { signature: "getOpenContracts()", description: "Returns currently open market positions." },
        { signature: "getBalance()", description: "Live available pool capital balance." },
        { signature: "log(message)", description: "Outputs telemetry to the secure engine audit log." },
      ],
      limits: [
        { key: "memory", value: "128 MB", label: "Heap Memory" },
        { key: "timeout", value: "100 ms", label: "Per-Tick Budget" },
        { key: "trades", value: "1 / tick", label: "Max Order Rate" },
        { key: "isolation", value: "Zero I/O", label: "Sandbox Security" },
      ],
    },
  },
  {
    id: "mod-pools",
    slug: "crowdfunding",
    number: "03",
    icon: "pool",
    eyebrow: "Crowdfunding",
    title: "Multi-asset crowdfunding pools",
    summary:
      "A crowdfunding pool packages a target capital size, duration (15 to 180 days), and strategy mandate. Backers fund slots, capital trades collectively, and net profits are split proportionally.",
    bullets: [
      "Six-stage lifecycle with real-time countdown timers",
      "Investor Share = Backer Investment ÷ Total Pool Capital",
      "Automated platform cut deduction (10% to 20% performance fee)",
      "Instant multi-rail withdrawals: Bank, Mobile Money, Crypto",
    ],
    specs: [
      { label: "Starter performance fee", value: "20% cut" },
      { label: "Growth performance fee", value: "15% cut" },
      { label: "Institutional fee", value: "10% cut" },
      { label: "Settlement cycle", value: "Bi-weekly / Weekly" },
    ],
    demo: {
      kind: "pools",
      lifecycle: [
        {
          key: "scheduled",
          name: "Scheduled",
          title: "Pool announced & scheduled",
          description: "Target capital, lockup duration, and asset class parameters are published.",
          meta: ["Capital target defined", "Slot pricing set", "Dates scheduled"],
        },
        {
          key: "open",
          name: "Open",
          title: "Accepting backer reservations",
          description: "Investors reserve and fund pool slots. Countdown timer ticks down to close date.",
          meta: ["Slot booking active", "Multi-rail payment", "Reservation confirmed"],
        },
        {
          key: "closed",
          name: "Closed",
          title: "Bookings locked & verified",
          description: "Capacity reached. Deposits are reconciled and pool capital is locked for execution.",
          meta: ["Capital locked", "Ledger reconciled", "Ready for execution"],
        },
        {
          key: "trading",
          name: "Trading",
          title: "Active quantitative execution",
          description: "Algorithms execute trades on pooled capital. Backers track live trade feeds.",
          meta: ["Live trade stream", "Real-time P&L", "Drawdown floor active"],
        },
        {
          key: "profit-sharing",
          name: "Profit sharing",
          title: "Calculating proportional returns",
          description: "Gross profits are audited, tiered performance fee is deducted, and net profits calculated.",
          meta: ["Proportional math", "Tiered fee applied", "High-water check"],
        },
        {
          key: "completed",
          name: "Completed",
          title: "Maturity & wallet payout",
          description: "Initial principal and net profits are credited to investor wallets for withdrawal or rollover.",
          meta: ["Wallet credited", "Tax report generated", "Rollover optional"],
        },
      ],
      share: {
        invested: 5000,
        poolCapital: 50000,
        poolPnl: 6800,
        operatorSharePercent: 15,
        note: "Net profits credit directly to your investor wallet with zero withdrawal restrictions.",
      },
      timeline: [
        { id: "t1", when: "Day 1", what: "Pool opens for backing", note: "Slots open with $250 minimum", done: true },
        { id: "t2", when: "Day 3", what: "Investor funds allocation", note: "Payment verified via Bank/Crypto", done: true },
        { id: "t3", when: "Day 5", what: "Pool cap reached & closed", note: "Capital locked, execution starts", done: true },
        { id: "t4", when: "Day 30", what: "Trading cycle completes", note: "P&L audited with high-water mark", done: false },
        { id: "t5", when: "Day 31", what: "Profits credited to wallet", note: "Instant withdrawal available", done: false },
      ],
    },
  },
  {
    id: "mod-guardian",
    slug: "ai-guardian",
    number: "04",
    icon: "shield",
    eyebrow: "Capital Protection",
    title: "AI Guardian capital protection",
    summary:
      "An automated risk layer continuously monitors pool equity. If market conditions cross predefined thresholds, the engine immediately halts execution, alerts lead managers, and enforces a cooling period.",
    bullets: [
      "Strict consecutive loss caps and pool drawdown limits",
      "Dynamic market rotation to prevent single-asset exposure spikes",
      "Automated emergency halt with cooldown protection",
      "Every intervention logged with timestamps and affected orders",
    ],
    specs: [
      { label: "Max allowable drawdown", value: "5.0% floor" },
      { label: "Consecutive loss trigger", value: "6 trades" },
      { label: "Emergency halt latency", value: "< 50 ms" },
      { label: "Protection coverage", value: "100% of pools" },
    ],
    demo: {
      kind: "guardian",
      rules: [
        {
          id: "g1",
          name: "Consecutive loss streak cap",
          metric: "streak",
          threshold: "6 losses",
          current: 0.5,
          hot: false,
          action: "Pause strategy · 20 min cooldown",
        },
        {
          id: "g2",
          name: "Intraday pool drawdown floor",
          metric: "drawdown",
          threshold: "3.5% of capital",
          current: 0.35,
          hot: false,
          action: "Halt trading · reduce position sizes",
        },
        {
          id: "g3",
          name: "Emergency hard stop floor",
          metric: "drawdown",
          threshold: "5.0% maximum",
          current: 0.82,
          hot: true,
          action: "Close all open positions · require manual resume",
        },
        {
          id: "g4",
          name: "Dynamic market rotation",
          metric: "rotation",
          threshold: "Enabled",
          current: 1.0,
          hot: false,
          action: "Rotate capital to non-correlated instruments",
        },
      ],
      events: [
        { id: "e1", time: "14:22:04", severity: "halt", message: "Drawdown limit reached on PKG-03 — emergency halt triggered", scope: "PKG-03" },
        { id: "e2", time: "14:22:05", severity: "warn", message: "20 min cooling period active · 2 orders closed at break-even", scope: "PKG-03" },
        { id: "e3", time: "14:22:05", severity: "info", message: "Manager notification dispatched via Telegram and in-app alert", scope: "Admin" },
        { id: "e4", time: "13:58:41", severity: "warn", message: "Loss streak reached 4 of 6 on Equities Alpha pool", scope: "PKG-01" },
        { id: "e5", time: "13:41:19", severity: "info", message: "Market rotation executed: S&P 500 → Spot Gold", scope: "Engine" },
        { id: "e6", time: "13:02:55", severity: "info", message: "Cooldown elapsed successfully · execution resumed", scope: "PKG-02" },
      ],
      flow: [
        { id: "s1", title: "Threshold Trigger", description: "Real-time equity crosses defined risk limit." },
        { id: "s2", title: "Automated Halt", description: "Algorithms stop taking new orders instantly." },
        { id: "s3", title: "Manager Alert", description: "Direct Telegram and in-app alerts sent." },
        { id: "s4", title: "Cooling Period", description: "Market volatility is monitored during cooldown." },
        { id: "s5", title: "Orderly Resume", description: "System resumes with conservative position sizing." },
      ],
    },
  },
  {
    id: "mod-markets",
    slug: "markets",
    number: "05",
    icon: "globe",
    eyebrow: "Market Coverage",
    title: "Multi-asset market coverage",
    summary:
      "Trade pools span six global asset classes: Equities, Forex, Index Futures, Commodities, Crypto, and Multi-Asset Quant Syndicates across liquid global market sessions.",
    bullets: [
      "Real-time institutional liquidity feeds with tight spreads",
      "Multi-asset diversification across non-correlated markets",
      "Flexible holding horizons from 15 days to 180 days",
      "Transparent fee schedule and capital capacity limits",
    ],
    specs: [
      { label: "Global currencies (FX)", value: "30+ pairs" },
      { label: "Equities & Indices", value: "US & European" },
      { label: "Metals & Energy", value: "Gold, Silver, Oil" },
      { label: "Digital assets", value: "BTC, ETH, Majors" },
    ],
    demo: {
      kind: "markets",
      markets: [
        {
          key: "equities",
          name: "Equities & Stocks",
          symbols: [
            { symbol: "AAPL", name: "Apple Inc.", price: 182.4, decimals: 2, changePercent: 0.62, contracts: "Momentum", open: "US Session" },
            { symbol: "NVDA", name: "NVIDIA Corp.", price: 892.1, decimals: 2, changePercent: 2.14, contracts: "Breakout", open: "US Session" },
            { symbol: "MSFT", name: "Microsoft Corp.", price: 421.5, decimals: 2, changePercent: 0.45, contracts: "Trend", open: "US Session" },
            { symbol: "AMZN", name: "Amazon.com Inc.", price: 178.2, decimals: 2, changePercent: 0.88, contracts: "Trend", open: "US Session" },
            { symbol: "TSLA", name: "Tesla Inc.", price: 172.6, decimals: 2, changePercent: -1.24, contracts: "Volatility", open: "US Session" },
          ],
        },
        {
          key: "indices",
          name: "Index Futures",
          symbols: [
            { symbol: "SPX500", name: "S&P 500 Index", price: 5244.6, decimals: 1, changePercent: 0.58, contracts: "Trend & Grid", open: "24/5" },
            { symbol: "NQ100", name: "NASDAQ 100 Index", price: 18412.5, decimals: 1, changePercent: 0.92, contracts: "Breakout", open: "24/5" },
            { symbol: "DAX40", name: "German DAX 40", price: 18241.3, decimals: 1, changePercent: 0.12, contracts: "Session Grid", open: "EU Session" },
            { symbol: "DJI30", name: "Dow Jones 30", price: 39112.4, decimals: 1, changePercent: 0.21, contracts: "Trend", open: "US Session" },
          ],
        },
        {
          key: "forex",
          name: "Global FX",
          symbols: [
            { symbol: "EUR/USD", name: "Euro / US Dollar", price: 1.0842, decimals: 4, changePercent: 0.18, contracts: "Carry & Grid", open: "24/5" },
            { symbol: "GBP/USD", name: "British Pound / USD", price: 1.2718, decimals: 4, changePercent: 0.07, contracts: "Breakout", open: "24/5" },
            { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", price: 151.42, decimals: 3, changePercent: -0.22, contracts: "Carry", open: "24/5" },
            { symbol: "AUD/USD", name: "Australian Dollar / USD", price: 0.6584, decimals: 4, changePercent: 0.11, contracts: "Session Swing", open: "24/5" },
          ],
        },
        {
          key: "commodities",
          name: "Metals & Energy",
          symbols: [
            { symbol: "XAU/USD", name: "Spot Gold", price: 2384.35, decimals: 2, changePercent: -0.12, contracts: "Trend Alpha", open: "24/5" },
            { symbol: "XAG/USD", name: "Spot Silver", price: 28.41, decimals: 2, changePercent: 0.42, contracts: "Trend Alpha", open: "24/5" },
            { symbol: "WTI_OIL", name: "Crude Oil", price: 82.44, decimals: 2, changePercent: 0.88, contracts: "Breakout", open: "24/5" },
          ],
        },
        {
          key: "crypto",
          name: "Digital Assets",
          symbols: [
            { symbol: "BTC/USDT", name: "Bitcoin", price: 68421.9, decimals: 1, changePercent: 1.42, contracts: "Delta Neutral", open: "24/7" },
            { symbol: "ETH/USDT", name: "Ethereum", price: 3542.8, decimals: 1, changePercent: 0.94, contracts: "Funding Arb", open: "24/7" },
            { symbol: "SOL/USDT", name: "Solana", price: 148.6, decimals: 2, changePercent: 2.18, contracts: "Momentum", open: "24/7" },
          ],
        },
      ],
      contractTypes: [
        { name: "Directional Momentum", count: 8, examples: "Trend following breakout models" },
        { name: "Statistical Mean Reversion", count: 6, examples: "Bollinger & RSI channel fades" },
        { name: "Delta-Neutral Arbitrage", count: 4, examples: "Funding rate & spread capture" },
        { name: "Multi-Asset Syndicate", count: 6, examples: "Cross-correlation quant alpha" },
      ],
      durations: [
        { unit: "days", min: 15, max: 180, step: 15, default: 30, note: "Standard crowdfunding pool duration (15 to 180 days)." },
        { unit: "hours", min: 4, max: 72, step: 4, default: 24, note: "Intraday and flash execution cycles." },
        { unit: "minutes", min: 15, max: 240, step: 15, default: 60, note: "Short-horizon volatility momentum pools." },
      ],
    },
  },
];

export const FEATURE_MATRIX: MatrixRowDTO[] = [
  { id: "mx1", group: "Crowdfunding & Pools", capability: "Browse & back active trade pools", operator: "full", investor: "full", note: "Accessible from investor overview" },
  { id: "mx2", group: "Crowdfunding & Pools", capability: "Slot booking ($250 to $100k+)", operator: "none", investor: "full", note: "Instant multi-rail payments" },
  { id: "mx3", group: "Crowdfunding & Pools", capability: "Automated proportional profit split", operator: "full", investor: "full", note: "Audited ledger math every cycle" },
  { id: "mx4", group: "Crowdfunding & Pools", capability: "High-Water Mark protection", operator: "full", investor: "full", note: "Zero performance fee on recovery" },
  { id: "mx5", group: "Execution & Strategy", capability: "Algorithmic quant trade execution", operator: "full", investor: "none", note: "Executed by proprietary engines" },
  { id: "mx6", group: "Execution & Strategy", capability: "Multi-asset strategy authoring", operator: "full", investor: "none", note: "Sandboxed isolated-vm environment" },
  { id: "mx7", group: "Execution & Strategy", capability: "Strategy mandate transparency", operator: "full", investor: "full", note: "Investors see full strategy disclosure" },
  { id: "mx8", group: "Telemetry & Logs", capability: "Live trade tracker feed", operator: "full", investor: "full", note: "Real-time streaming trade telemetry" },
  { id: "mx9", group: "Telemetry & Logs", capability: "Detailed P&L breakdown (Gross / Cut / Net)", operator: "full", investor: "full", note: "Net shown by default with gross audit" },
  { id: "mx10", group: "Telemetry & Logs", capability: "Exportable tax & compliance statements", operator: "full", investor: "full", note: "CSV & PDF download available" },
  { id: "mx11", group: "Risk & Protection", capability: "AI Guardian drawdown floors", operator: "full", investor: "full", note: "Enforced across 100% of pools" },
  { id: "mx12", group: "Risk & Protection", capability: "Emergency halt & cooling period", operator: "full", investor: "full", note: "Real-time alert dispatch" },
  { id: "mx13", group: "Wallet & Settlement", capability: "Instant wallet profit crediting", operator: "full", investor: "full", note: "Automated upon cycle settlement" },
  { id: "mx14", group: "Wallet & Settlement", capability: "Multi-rail withdrawals (Bank/Crypto/Mobile)", operator: "partial", investor: "full", note: "Zero withdrawal fees on profits" },
  { id: "mx15", group: "Volume Tiers", capability: "Tiered fee discounts (<$10k, $10k-$100k, >$100k)", operator: "full", investor: "full", note: "Performance fee drops from 20% to 10%" },
  { id: "mx16", group: "Volume Tiers", capability: "Private syndicate pool access", operator: "full", investor: "partial", note: "Available for Institutional tier backers" },
  { id: "mx17", group: "Support & Comms", capability: "Telegram trade alerts & digests", operator: "full", investor: "full", note: "Real-time notification bot" },
  { id: "mx18", group: "Support & Comms", capability: "Dedicated account manager", operator: "full", investor: "partial", note: "Included on Growth & Institutional tiers" },
];

export const FEATURES_FALLBACK: FeaturesContentDTO = {
  hero: {
    key: FEATURES_HERO.key,
    eyebrow: FEATURES_HERO.eyebrow,
    title: FEATURES_HERO.title,
    subtitle: FEATURES_HERO.subtitle,
    payload: FEATURES_HERO.payload,
  },
  modules: FEATURE_MODULES,
  matrix: FEATURE_MATRIX,
  cta: {
    key: "features-cta",
    eyebrow: "Join Trade Pools",
    title: CTA_SECTION.title,
    subtitle: CTA_SECTION.subtitle,
    payload: CTA_SECTION.payload,
  },
  meta: { source: "fallback", generatedAt: new Date(0).toISOString(), version: 1 },
};
