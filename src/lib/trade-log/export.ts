import type { LedgerTrade } from "./types";
export type ExportFormat = "csv" | "pdf" | "xlsx";
const headers = ["Trade #", "Executed at (UTC)", "Symbol", "Contract", "Stake USD", "Payout USD", "Profit USD", "Pool", "Bot", "Strategy", "Result", "Contract ID"];
const cells = (t: LedgerTrade) => [t.tradeNumber, t.executedAt, t.symbol, t.contractLabel, t.stake, t.payout, t.profit, t.packageCode, t.botName, t.strategy, t.isWin ? "Won" : "Lost", t.derivContractId];
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
export async function exportLedger(rows: LedgerTrade[], format: ExportFormat) {
  const name = `trademo-trade-ledger-${new Date().toISOString().slice(0,10)}`;
  if (format === "csv") {
    const escape = (v: string | number) => `"${(typeof v === "string" ? v.replace(/^[=+@\-]/, "'$&") : String(v)).replaceAll('"','""')}"`;
    download(new Blob(["\uFEFF", [headers, ...rows.map(cells)].map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
  } else if (format === "xlsx") {
    const { Workbook } = await import("exceljs");
    const book = new Workbook(); book.creator = "tradeMO";
    const sheet = book.addWorksheet("Demo trade ledger"); sheet.addRow(headers);
    rows.forEach(t => sheet.addRow(cells(t)));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheet.columns.forEach((c, i) => { c.width = i === 1 ? 27 : 18; });
    sheet.autoFilter = { from: "A1", to: "L1" }; sheet.views = [{ state: "frozen", ySplit: 1 }];
    for (let i = 5; i <= 7; i++) sheet.getColumn(i).numFmt = '$#,##0.00;[Red]-$#,##0.00';
    const buffer = await book.xlsx.writeBuffer();
    download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
  } else {
    const { jsPDF } = await import("jspdf"); const doc = new jsPDF({ orientation: "landscape" });
    let y = 30;
    const heading = () => { doc.setFontSize(16); doc.text("tradeMO / Trade log & records", 14, 14); doc.setFontSize(8); doc.text(`DEMO DATA - ${rows.length} settled contracts - All times UTC - Page ${doc.getNumberOfPages()}`, 14, 21); doc.text("TRADE       DATE / UTC                            SYMBOL       POOL             STAKE                PAYOUT                 NET P&L          RESULT", 14, 29); y = 37; };
    heading(); doc.setFont("courier", "normal"); doc.setFontSize(8);
    rows.forEach(t => { if (y > 190) { doc.addPage(); heading(); doc.setFontSize(8); } const values = [String(t.tradeNumber), t.executedAt.replace("T"," ").slice(0,19), t.symbol, t.packageCode, t.stake.toFixed(2), t.payout.toFixed(2), t.profit.toFixed(2), t.isWin ? "WON" : "LOST"]; [14,36,91,116,145,177,211,247].forEach((x,i) => doc.text(values[i], x, y)); y += 6; });
    doc.save(`${name}.pdf`);
  }
}
