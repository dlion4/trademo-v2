const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Type-only dependencies disappear at transpile; exercise the actual source reducer.
function load(path) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', source)(mod.exports, require, mod);
  return mod.exports;
}
const { applyLiveEvent } = load('src/lib/live/types.ts');
const { getLiveBundle } = load('src/server/services/live-mock-service.ts');
test('seed has six markets, four runners and exact pool/session profit attribution', () => {
  const state = getLiveBundle();
  assert.equal(state.ticks.length, 6);
  assert.equal(state.bots.length, 4);
  assert.equal(state.pools.reduce((n, p) => n + p.profit, 0), state.sessionProfit);
  assert.equal(state.wins + (state.totalTrades - state.wins), state.totalTrades);
});
test('settlement updates totals, pool and runner atomically and deduplicates replay', () => {
  const state = getLiveBundle();
  const trade = { ...state.trades[0], tradeId: 'test-settlement', profit: 28, isWin: true };
  const event = { type: 'operator:trade_result', trade };
  const next = applyLiveEvent(state, event);
  assert.equal(next.totalTrades, state.totalTrades + 1);
  assert.equal(next.wins, state.wins + 1);
  assert.equal(next.sessionProfit, state.sessionProfit + 28);
  assert.equal(next.pools[0].profit, state.pools[0].profit + 28);
  assert.equal(next.bots[0].profit, state.bots[0].profit + 28);
  assert.equal(next.streak, 4);
  assert.equal(applyLiveEvent(next, event), next);
  assert.equal(state.trades.length, 47);
});
test('loss resets winning streak and rolling feed never exceeds fifty rows', () => {
  let state = getLiveBundle();
  for (let i = 0; i < 10; i++) state = applyLiveEvent(state, { type: 'operator:trade_result', trade: { ...state.trades[0], tradeId: `loss-${i}`, isWin: false, profit: -35 } });
  assert.equal(state.trades.length, 50);
  assert.equal(state.streak, -10);
  assert.equal(state.wins, 31);
});
test('tick, runner and guardian events affect their own records', () => {
  const state = getLiveBundle();
  const tick = { ...state.ticks[0], price: 5000 };
  const updated = applyLiveEvent(state, { type: 'operator:tick_update', tick });
  assert.equal(updated.ticks[0].price, 5000);
  assert.equal(updated.sessionProfit, state.sessionProfit);
  const bot = { ...state.bots[0], status: 'paused' };
  const paused = applyLiveEvent(updated, { type: 'operator:bot_status', bot });
  assert.equal(paused.bots[0].status, 'paused');
  const event = { ...state.guardian[0], id: 'new-event' };
  assert.equal(applyLiveEvent(paused, { type: 'operator:ai_guardian', event }).guardian[0].id, 'new-event');
});
