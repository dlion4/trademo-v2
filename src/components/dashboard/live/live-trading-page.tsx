"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { OperatorShell, type OperatorBundleProps } from "@/components/dashboard/shell/operator-shell";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon } from "@/components/icons";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import { createDeskColumnHelper, useDeskTable, type SortingState } from "@/lib/dashboard/table";
import type { LiveBot, LiveBundle, LiveTrade } from "@/lib/live/types";
import { useLiveSession } from "@/lib/live/use-live";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;
const time = (date: string) => date.slice(11, 19);
const col = createDeskColumnHelper<LiveTrade>();

function Total({ label, value, note, currency, positive }: { label: string; value: number; note: string; currency?: boolean; positive?: boolean }) {
  const count = useLiveCountUp(value);
  return <div className="lt-total"><span>{label}</span><strong className={`mono ${positive ? (value >= 0 ? "text-win" : "text-loss") : ""}`}>{currency ? (positive ? signed(count) : money(count)) : Math.round(count).toLocaleString("en-US")}</strong><small>{note}</small></div>;
}

function LiveDesk({ initial, halted }: { initial: LiveBundle; halted: boolean }) {
  const { data, streaming, setStreaming, command } = useLiveSession(initial, halted);
  const { openOverlay, openDrawerTab, inspectEntity, pushToast } = useOperatorUI();
  const [result, setResult] = useState("all");
  const [pool, setPool] = useState("all");
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [scroll, setScroll] = useState(0);
  const [receipt, setReceipt] = useState<LiveTrade | null>(null);
  const [config, setConfig] = useState<LiveBot | null>(null);
  const [step, setStep] = useState(0);
  const [stake, setStake] = useState("35");
  const [strategy, setStrategy] = useState("Martingale");
  const [bulk, setBulk] = useState<"running" | "paused" | "stopped" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const hasLocalModal = Boolean(receipt || config || bulk);
  useEffect(() => {
    if (!hasLocalModal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".page-dashboard-live-trading .desk-modal-backdrop");
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'));
    focusable()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog.addEventListener("keydown", trap);
    return () => { dialog.removeEventListener("keydown", trap); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [hasLocalModal]);
  const feedRef = useRef<HTMLDivElement>(null);
  const [feedHeld, setFeedHeld] = useState(false);
  const [heldTrades, setHeldTrades] = useState<LiveTrade[]>([]);
  const visibleTrades = feedHeld ? heldTrades : data.trades;
  const filtered = useMemo(() => visibleTrades.filter(t => (result === "all" || t.isWin === (result === "win")) && (pool === "all" || t.packageId === pool)), [visibleTrades, result, pool]);
  const columns = useMemo(() => col.columns([
    col.accessor("symbol", { header: "Market" }), col.accessor("profit", { header: "Net P&L" }), col.accessor("soldAt", { header: "Settled at" }),
  ]), []);
  const table = useDeskTable({ data: filtered, columns, state: { sorting, globalFilter: search }, onSortingChange: setSorting, onGlobalFilterChange: setSearch });
  const rows = table.getRowModel().rows;
  const rowHeight = 90;
  const start = Math.min(Math.floor(scroll / rowHeight), Math.max(0, rows.length - 1));
  const windowRows = rows.slice(start, start + 7);
  const wins = data.wins / data.totalTrades * 100;
  const elapsed = Math.floor((Date.parse(data.asOf) - Date.parse(data.startedAt)) / 60000);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setConfig(null); setReceipt(null); setBulk(null); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  function notify(title: string) { pushToast({ tone: "success", title, detail: "Applied to this simulated session only. No broker orders were sent." }); }
  function exportSession() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "trademo-live-session.json"; a.click(); URL.revokeObjectURL(url);
    notify("Session snapshot downloaded");
  }
  function changeFilters(action: () => void) { action(); setScroll(0); if (feedRef.current) feedRef.current.scrollTop = 0; }
  return <div className="lt-desk">
    <div className="lt-breadcrumb">OPERATOR CONSOLE <span>/</span> EXECUTION DESK <span>/</span> <b>LIVE TRADING</b><span className="ms-auto mono">D–03</span></div>
    <header className="lt-page-head">
      <div><div className="lt-eyebrow"><span className={streaming ? "live-dot" : "lt-paused-dot"} /> EXECUTION MONITOR <span className="lt-tag">SIMULATED SESSION</span></div><h1>Live trading<span>.</span></h1><p>Your execution desk, in motion. Every contract. Every pool. Every tick.</p></div>
      <div className="lt-actions"><button className="lt-btn" onClick={exportSession}><Icon name="download" size={14} /> Export session</button><button className="lt-btn lt-btn-primary" onClick={() => openOverlay({ type: "quick-trade" })}><Icon name="plus" size={15} /> New trade</button></div>
    </header>
    <div className="lt-session-bar"><div><span className={streaming ? "live-dot" : "lt-paused-dot"} /><strong>{halted ? "Emergency halt active · simulation stopped" : streaming ? "Simulation streaming" : "Simulation suspended"}</strong><span className="lt-separator" /> Demo capital only <span className="lt-separator" /><span className="mono">{time(data.asOf)} UTC</span></div><button onClick={() => setStreaming(!streaming)}>{streaming ? "Suspend simulation" : "Resume simulation"} <Icon name={streaming ? "pause" : "play"} size={12} /></button></div>
    <section className="lt-totals" aria-label="Running session totals">
      <Total label="Capital in market" value={data.capitalInMarket} currency note="Across all active allocations" />
      <Total label="Session net P&L" value={data.sessionProfit} currency positive note="Realized · before performance fees" />
      <Total label="Trades executed" value={data.totalTrades} note={`${data.bots.filter(b => b.status === "running").length} bot runners active`} />
      <div className="lt-total"><span>Win / loss</span><strong className="mono">{data.wins}<em> / {data.totalTrades - data.wins}</em></strong><small><b className="text-win">{wins.toFixed(1)}%</b> win rate</small></div>
      <Total label="Current streak" value={Math.abs(data.streak)} note={data.streak >= 0 ? "Consecutive winning contracts" : "Consecutive losing contracts"} />
      <button className="lt-total lt-total-button" onClick={() => openOverlay({ type: "risk-guardrails" })}><span>Guardian status <Icon name="shield" size={14} /></span><strong className="lt-all-clear"><span className={halted ? "lt-paused-dot" : "live-dot"} /> {halted ? "Halted" : "All clear"}</strong><small>Demo guardrails · View policy ↗</small></button>
    </section>

    <section className="lt-market-section" aria-labelledby="market-heading"><div className="lt-section-heading"><h2 id="market-heading">Market watch <span>06 subscribed symbols</span></h2><button onClick={() => openDrawerTab("feed")}>Open inspector <Icon name="arrowRight" size={13} /></button></div><div className="lt-ticks">{data.ticks.map(t => <button key={t.symbol} className="lt-tick" onClick={() => openOverlay({ type: "quick-trade", defaultSymbol: t.symbol })}><span className="lt-tick-label"><b className="mono">{t.symbol}</b><small>{t.cadence}</small></span><strong key={t.price} className="mono lt-price">{t.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong><span className={t.change >= 0 ? "text-win" : "text-loss"}>{t.change >= 0 ? "↗ +" : "↘ "}{t.change.toFixed(3)}% <small>{t.name}</small></span></button>)}</div></section>

    <div className="lt-main-grid">
      <section className="lt-panel lt-feed" aria-labelledby="feed-heading"><div className="lt-panel-head"><div><h2 id="feed-heading"><span className="live-dot" /> Live trade feed <span className="lt-count">{data.totalTrades}</span></h2><p>Settled contracts · newest first · last 50 retained</p></div><button className="lt-btn lt-btn-small" onClick={() => { if (!feedHeld) setHeldTrades(data.trades); setFeedHeld(!feedHeld); }}>{feedHeld ? "Resume feed" : "Hold feed"}</button></div>
        <div className="lt-feed-tools"><div className="lt-tabs">{["all", "win", "loss"].map(r => <button key={r} className={result === r ? "active" : ""} onClick={() => changeFilters(() => setResult(r))}>{r === "all" ? "All results" : r === "win" ? "Wins" : "Losses"}</button>)}</div><select aria-label="Filter feed by pool" value={pool} onChange={e => changeFilters(() => setPool(e.target.value))}><option value="all">All pools</option>{data.pools.map(p => <option key={p.id}>{p.id}</option>)}</select></div>
        <div className="lt-feed-search"><Icon name="search" size={13} /><input aria-label="Search trade feed" placeholder="Search symbol, contract or trade ID" value={search} onChange={e => changeFilters(() => setSearch(e.target.value))} /><select aria-label="Sort contracts" value={sorting[0]?.id === "profit" ? "profit" : "soldAt"} onChange={e => changeFilters(() => setSorting([{ id: e.target.value, desc: true }]))}><option value="soldAt">Newest first</option><option value="profit">Highest P&L</option></select></div>
        <div className="lt-feed-column-labels"><span>RESULT / CONTRACT</span><span>STAKE → PAYOUT</span><span>NET P&L</span></div>
        <div className="lt-feed-viewport" ref={feedRef} onScroll={e => setScroll(e.currentTarget.scrollTop)}>
          {rows.length === 0 ? <div className="lt-empty"><Icon name="search" size={24} /><h3>No matching contracts</h3><p>Try another symbol or reset your feed filters.</p><button className="lt-btn" onClick={() => changeFilters(() => { setResult("all"); setPool("all"); setSearch(""); })}>Reset filters</button></div> : <div style={{ height: rows.length * rowHeight, position: "relative" }}>{windowRows.map((r, index) => { const t = r.original; return <button className={`lt-feed-row ${t.isWin ? "is-win" : "is-loss"}`} style={{ top: (start + index) * rowHeight, height: rowHeight }} key={t.tradeId} onClick={() => setReceipt(t)}><span className="lt-contract"><span className={`lt-result-icon ${t.isWin ? "text-win" : "text-loss"}`}>{t.isWin ? "↗" : "↘"}</span><span><strong className="mono">{t.symbol} <i>{t.contractType}</i></strong><small className="mono">{time(t.soldAt)} <b>·</b> {t.packageId} <b>·</b> {t.botName}</small><small className="lt-spots mono">{t.entrySpot.toFixed(2)} → {t.exitSpot.toFixed(2)}</small></span></span><span className="mono lt-feed-payout">{money(t.stake)} <small>→ {money(t.payout)}</small></span><span className={`mono lt-feed-profit ${t.isWin ? "text-win" : "text-loss"}`}><strong>{signed(t.profit)}</strong><small>{t.isWin ? "WIN" : "LOSS"} <span>↗</span></small></span></button>; })}</div>}
        </div><div className="lt-panel-foot"><span className="mono">{rows.length} matching / {visibleTrades.length} retained</span><Link href="/dashboard/trades">Full trade ledger ↗</Link></div>
      </section>

      <aside className="lt-side-stack"><section className="lt-panel"><div className="lt-panel-head"><div><h2>Session statistics</h2><p>Rolling session · {elapsed} min runtime</p></div><span className="lt-tag">USD</span></div><div className="lt-stat-hero"><span>NET REALIZED PROFIT</span><strong className={`mono ${data.sessionProfit >= 0 ? "text-win" : "text-loss"}`}>{signed(data.sessionProfit)}</strong><div className="lt-win-bar"><span style={{ width: `${wins}%` }} /></div><div className="lt-win-labels"><span><b className="text-win">{data.wins} wins</b> · {wins.toFixed(1)}%</span><span>{data.totalTrades - data.wins} losses</span></div></div><dl className="lt-stat-list"><div><dt>Best contract</dt><dd className="text-win mono">{signed(data.bestTrade)}</dd></div><div><dt>Worst contract</dt><dd className="text-loss mono">{signed(data.worstTrade)}</dd></div><div><dt>Longest win streak</dt><dd className="mono">{data.longestStreak} contracts</dd></div><div><dt>Avg. trade duration</dt><dd className="mono">{data.averageDuration}s</dd></div><div><dt>Session started</dt><dd className="mono">{time(data.startedAt)} UTC</dd></div></dl><div className="lt-panel-foot"><span>21 OCT 2026</span><button onClick={exportSession}>Download snapshot ↗</button></div></section>
      <section className="lt-note"><Icon name="shield" size={20} /><div><h3>Capital protection is on.</h3><p>Review cooldowns, drawdown thresholds and loss limits before changing execution parameters.</p><button onClick={() => openOverlay({ type: "risk-guardrails" })}>Review risk policy →</button></div></section></aside>
    </div>

    <section className="lt-bots-section"><div className="lt-section-heading"><h2>Bot runners <span>{data.bots.filter(b => b.status === "running").length} running · {data.bots.length} configured</span></h2><div className="lt-actions">{([['paused', 'Pause all'], ['stopped', 'Stop all'], ['running', 'Restart all']] as const).map(([action, label]) => <button key={action} className="lt-btn lt-btn-small" onClick={() => { setBulk(action); setConfirmed(false); }}>{label}</button>)}<button className="lt-btn lt-btn-small" onClick={() => openOverlay({ type: "bot-deploy-wizard" })}>+ Deploy bot</button></div></div><div className="lt-bots-grid">{data.bots.map(b => <article className="lt-panel lt-bot" key={b.id}><div className="lt-bot-head"><span className="lt-bot-symbol"><Icon name="bot" size={20} /></span><div><h3>{b.name}</h3><span className="mono">{b.symbol} · {b.packageId}</span></div><span className={`lt-status is-${b.status}`}>{b.status === "running" ? "●" : "○"} {b.status}</span></div><div className="lt-bot-strategy">{b.strategy}<span className="mono">{money(b.stake)} base</span></div><div className="lt-bot-numbers"><div><small>Trades</small><b className="mono">{b.trades}</b></div><div><small>Win rate</small><b className="mono">{b.trades ? `${Math.round(b.wins / b.trades * 100)}%` : "—"}</b></div><div><small>Net P&L</small><b className={`mono ${b.profit >= 0 ? "text-win" : "text-loss"}`}>{signed(b.profit)}</b></div></div><div className="lt-bot-controls"><button onClick={() => { command({ botIds: [b.id], action: b.status === "running" ? "paused" : "running" }); notify(`${b.name} ${b.status === "running" ? "paused" : "started"}`); }}><Icon name={b.status === "running" ? "pause" : "play"} size={12} />{b.status === "running" ? "Pause" : "Start"}</button><button disabled={b.status === "stopped"} onClick={() => { command({ botIds: [b.id], action: "stopped" }); notify(`${b.name} stopped`); }}>Stop</button><button onClick={() => { setConfig(b); setStake(String(b.stake)); setStrategy(b.strategy); setStep(0); }}>Configure <Icon name="sliders" size={12} /></button></div></article>)}</div></section>

    <section><div className="lt-section-heading"><h2>Pool performance <span>Live capital attribution</span></h2><button onClick={() => openOverlay({ type: "capital-rebalance" })}>Rebalance allocations ↗</button></div><div className="lt-pools-grid">{data.pools.map(p => { const progress = Math.min(100, Math.max(0, p.profit / p.target * 100)); return <article className="lt-panel lt-pool" key={p.id}><div className="lt-pool-head"><span className="lt-tag mono">{p.id}</span><h3>{p.name}</h3><button aria-label={`Inspect ${p.id}`} onClick={() => inspectEntity({ kind: "package", code: p.id })}>↗</button></div><div className="lt-pool-profit"><strong className={`mono ${p.profit >= 0 ? "text-win" : "text-loss"}`}>{signed(p.profit)}</strong><span className="mono">{(p.profit / p.capital * 100).toFixed(2)}% ROI</span></div><div className="lt-pool-meta"><span>{money(p.capital)} capital</span><span>{p.trades} trades · {p.investors} investors</span></div><div className="lt-target-label"><span>Take-profit target</span><b className="mono">{progress.toFixed(0)}% <small>/ {money(p.target)}</small></b></div><div className="lt-target-track"><span style={{ width: `${progress}%` }} /></div><small className="lt-pool-foot">Pool profit allocated by capital share · 80/20 net split at settlement</small></article>; })}</div></section>

    <section className="lt-panel lt-guardian"><div className="lt-panel-head"><div><h2><Icon name="shield" size={16} /> Guardian event log</h2><p>Automated protection actions · last 24 hours · demo snapshot</p></div><Link href="/dashboard/logs?type=ai_guardian">View full history ↗</Link></div><div className="table-responsive"><table className="table mb-0"><thead><tr><th>TIME / UTC</th><th>POOL</th><th>TRIGGER</th><th>ACTION TAKEN</th><th>RESUMED</th></tr></thead><tbody>{data.guardian.map(g => <tr key={g.id}><td className="mono">{g.time}</td><td><button className="lt-tag mono" onClick={() => inspectEntity({ kind: "package", code: g.packageId })}>{g.packageId}</button></td><td>{g.trigger}</td><td>{g.action}</td><td className="text-win mono">✓ {g.resumedAt}</td></tr>)}</tbody></table></div></section>
    <section className="lt-workflows"><span>DESK WORKFLOWS</span><button onClick={() => openOverlay({ type: "schedule-wizard" })}><Icon name="calendar" size={17} /> Schedule execution ↗</button><button onClick={() => openOverlay({ type: "new-package-wizard" })}><Icon name="pool" size={17} /> Launch a pool ↗</button><button onClick={() => openOverlay({ type: "distribute-wizard" })}><Icon name="split" size={17} /> Settle profits ↗</button><button onClick={() => openDrawerTab("alerts")}><Icon name="shield" size={17} /> Inspect alerts ↗</button></section>
    <footer className="lt-disclaimer"><span className="live-dot" /> FRONTEND DEMO <span>Simulated prices and executions. No real funds or orders. Historical samples are not investment advice.</span><b className="mono">tradeMO / EXECUTION</b></footer>

    {receipt && <DeskModalShell code="LIVE-01" eyebrow="Simulated execution receipt" title={`${receipt.symbol} · ${receipt.isWin ? "Winning" : "Losing"} contract`} subtitle={receipt.tradeId} onClose={() => setReceipt(null)} footer={<><button className="lt-btn" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2)); notify("Receipt copied"); } catch { pushToast({ tone: "error", title: "Clipboard unavailable", detail: "Use Export session to download receipts instead." }); } }}>Copy JSON</button><button className="lt-btn lt-btn-primary" onClick={() => { setReceipt(null); openOverlay({ type: "quick-trade", defaultSymbol: receipt.symbol, defaultStake: receipt.stake }); }}>Repeat in ticket</button></>}><dl className="lt-stat-list">{Object.entries({ "Contract": receipt.contractType, "Pool": receipt.packageId, "Runner": receipt.botName, "Stake": money(receipt.stake), "Payout": money(receipt.payout), "Net profit": signed(receipt.profit), "Entry spot": receipt.entrySpot.toFixed(2), "Exit spot": receipt.exitSpot.toFixed(2), "Bought at": receipt.boughtAt, "Settled at": receipt.soldAt, "Schedule": receipt.scheduleId }).map(([k,v]) => <div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>)}</dl></DeskModalShell>}
    {config && <DeskModalShell code="LIVE-02" eyebrow="Runner configuration" title={`Configure ${config.name}`} subtitle="Changes affect simulated future contracts only." onClose={() => setConfig(null)} steps={["Parameters", "Risk review", "Confirm"]} currentStep={step} footer={<><button className="lt-btn" onClick={() => step ? setStep(step - 1) : setConfig(null)}>{step ? "Back" : "Cancel"}</button><button className="lt-btn lt-btn-primary" disabled={!Number.isFinite(Number(stake)) || Number(stake) < .35 || Number(stake) > 500} onClick={() => { if (step < 2) setStep(step + 1); else { command({ botIds: [config.id], action: config.status, stake: Number(stake), strategy }); notify(`${config.name} configuration saved`); setConfig(null); } }}>{step < 2 ? "Continue →" : "Apply configuration"}</button></>}>{step === 0 ? <div className="lt-config-fields"><label>Strategy<select className="form-select" value={strategy} onChange={e => setStrategy(e.target.value)}>{["Martingale", "Even / Odd", "DCA", "Oscar’s Grind", "Flat stake"].map(s => <option key={s}>{s}</option>)}</select></label><label>Base stake (USD)<input className="form-control" type="number" min="0.35" max="500" step="0.01" value={stake} onChange={e => setStake(e.target.value)} /></label><small>Permitted demo stake: $0.35–$500.00.</small></div> : <div className="lt-review"><Icon name="shield" size={28} /><h3>{step === 1 ? "Review exposure before applying" : "Ready to update the runner"}</h3><p>{config.name} · {config.symbol} · {config.packageId}</p><dl className="lt-stat-list"><div><dt>Strategy</dt><dd>{strategy}</dd></div><div><dt>Base stake</dt><dd className="mono">{money(Number(stake))}</dd></div><div><dt>Pool exposure per trade</dt><dd>{(Number(stake) / (data.pools.find(p => p.id === config.packageId)?.capital ?? 1) * 100).toFixed(2)}%</dd></div><div><dt>Runner after update</dt><dd>{config.status}</dd></div></dl><p>Progression strategies can increase subsequent stake sizes. This demo does not execute a broker risk check.</p></div>}</DeskModalShell>}
    {bulk && <DeskModalShell code="LIVE-03" eyebrow="Bulk runner control" title={`${bulk === "running" ? "Restart" : bulk === "paused" ? "Pause" : "Stop"} all bot runners?`} subtitle="This affects all four runners in the demo session." onClose={() => setBulk(null)} footer={<><button className="lt-btn" onClick={() => setBulk(null)}>Cancel</button><button className="lt-btn lt-btn-primary" disabled={!confirmed} onClick={() => { command({ botIds: data.bots.map(b => b.id), action: bulk }); notify(`All runners ${bulk}`); setBulk(null); }}>Confirm action</button></>}><p>Existing settled contracts remain in the ledger. {bulk === "running" ? "All runners, including stopped and paused runners, will begin generating simulated results." : "No new simulated contracts will be generated by affected runners."}</p><label className="d-flex gap-2 align-items-center"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I have reviewed the affected runners and pool exposure.</label></DeskModalShell>}
  </div>;
}
export function LiveTradingPage({ operatorBundle, initial }: { operatorBundle: OperatorBundleProps; initial: LiveBundle }) {
  return <OperatorShell rootClass="page-dashboard-live-trading" bundle={operatorBundle}>{live => <LiveDesk initial={initial} halted={live.workspace.risk.emergencyHalted} />}</OperatorShell>;
}
