const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const resolve = id => id === '@/lib/trade-log/types' ? load('src/lib/trade-log/types.ts') : require(id);
  new Function('exports', 'require', 'module', source)(mod.exports, resolve, mod);
  modules.set(path,mod.exports); return mod.exports;
}
const { defaultRequest } = load('src/lib/trade-log/types.ts');
const { getLedgerBundle, ledgerTrades } = load('src/server/services/trade-log-service.ts');
const request = filters => ({ ...defaultRequest, filters: { ...defaultRequest.filters, ...filters } });
test('seed contains 1,247 valid settled contracts and 789 wins', () => {
  const b = getLedgerBundle(); assert.equal(b.total,1247); assert.equal(b.summary.wins,789);
  ledgerTrades.forEach(t => { assert.equal(Math.round((t.payout-t.stake)*100),Math.round(t.profit*100)); assert.equal(t.isWin,t.profit>0); });
});
test('every grouped P&L and count reconciles to the filtered receipt summary', () => {
  for (const filter of [{}, { symbol: 'R_10' }, { pool: 'PKG-02', result: 'win' }, { from: '2026-10-15', to: '2026-10-21' }]) {
    const b = getLedgerBundle(request(filter));
    for (const groups of [b.daily,b.pools,b.markets,b.strategies]) {
      assert.equal(groups.reduce((n,g) => n+g.trades,0),b.total);
      assert.ok(Math.abs(groups.reduce((n,g) => n+g.profit,0)-b.summary.profit)<.01);
    }
  }
});
test('server pagination has no overlap and clamps an out-of-range page', () => {
  const a = getLedgerBundle(); const b = getLedgerBundle({ ...defaultRequest, page: 2 });
  assert.equal(a.rows.length,50); assert.equal(b.rows.length,50);
  assert.ok(!a.rows.some(t => b.rows.some(u => u.id===t.id)));
  const last = getLedgerBundle({ ...defaultRequest, page: 999 }); assert.equal(last.page,25); assert.equal(last.rows.length,47);
});
test('filter intersection, search and schedule drilldown are applied before pagination', () => {
  const req = request({ pool:'PKG-01', symbol:'R_10', result:'win', schedule:'SCH-001' });
  const b = getLedgerBundle(req,true); assert.ok(b.total > 0);
  b.rows.forEach(t => { assert.equal(t.packageCode,'PKG-01'); assert.equal(t.symbol,'R_10'); assert.equal(t.isWin,true); assert.equal(t.scheduleId,'SCH-001'); });
  assert.equal(getLedgerBundle(request({search:'1234567890'})).total,1);
});
test('profit and stake sort are numeric and exports include all matching pages', () => {
  const b = getLedgerBundle({ ...defaultRequest, sort:'profit', desc:true },true);
  assert.equal(b.rows.length,1247);
  for(let i=1;i<b.rows.length;i++) assert.ok(b.rows[i-1].profit>=b.rows[i].profit);
  const low = getLedgerBundle({ ...defaultRequest, sort:'stake', desc:false }); assert.equal(low.rows[0].stake,35);
});
test('empty range returns zero-safe summaries and no breakdown rows', () => {
  const b = getLedgerBundle(request({ from:'2020-01-01', to:'2020-01-02' }));
  assert.equal(b.total,0); assert.equal(b.summary.avgWin,0); assert.equal(b.summary.winRate,0); assert.deepEqual(b.daily,[]);
});
test('CSV exports actual records and preserves negative numeric values', async () => {
  const { exportLedger } = load('src/lib/trade-log/export.ts');
  let blob; let filename;
  const oldDocument = global.document; const oldWindow = global.window;
  const oldCreate = URL.createObjectURL; const oldRevoke = URL.revokeObjectURL;
  URL.createObjectURL = b => { blob=b; return 'blob:test'; }; URL.revokeObjectURL = () => {};
  global.document = { createElement: () => ({ set download(n) { filename=n; }, click() {} }) };
  global.window = { setTimeout: callback => callback() };
  try {
    const row = ledgerTrades.find(t => !t.isWin);
    await exportLedger([row],'csv'); const text = await blob.text();
    assert.ok(filename.endsWith('.csv')); assert.ok(text.includes(`"${row.profit}"`)); assert.ok(text.includes(row.derivContractId));
  } finally { URL.createObjectURL=oldCreate; URL.revokeObjectURL=oldRevoke; global.document=oldDocument; global.window=oldWindow; }
});
test('Excel export is a parseable workbook with numeric money cells', async () => {
  const { exportLedger } = load('src/lib/trade-log/export.ts');
  let blob;
  const oldDocument = global.document; const oldWindow = global.window;
  const oldCreate = URL.createObjectURL; const oldRevoke = URL.revokeObjectURL;
  URL.createObjectURL = b => { blob=b; return 'blob:test'; }; URL.revokeObjectURL = () => {};
  global.document = { createElement: () => ({ click() {} }) }; global.window = { setTimeout: callback => callback() };
  try {
    await exportLedger(ledgerTrades.slice(0,3),'xlsx');
    const { Workbook } = require('exceljs'); const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    assert.equal(workbook.worksheets[0].rowCount,4);
    assert.equal(workbook.worksheets[0].getCell('G2').value,ledgerTrades[0].profit);
    assert.equal(typeof workbook.worksheets[0].getCell('E2').value,'number');
  } finally { URL.createObjectURL=oldCreate; URL.revokeObjectURL=oldRevoke; global.document=oldDocument; global.window=oldWindow; }
});
