import { packageErrors } from "./schema";
import type { ManagedPackage, PackageCommand, PoolInvestor } from "./types";
/** Allocate exact investor cents pro rata, with residual cents assigned by largest remainder. */
export function allocateProfits(p: ManagedPackage): PoolInvestor[] {
  const totalCents = Math.round(Math.max(0,p.profit) * (1-p.operatorSharePercent/100) * 100);
  const capital = p.investors.reduce((n,i)=>n+i.capital,0);
  if (!capital) return p.investors.map(i=>({...i,paidProfit:0}));
  const amounts = p.investors.map((i,index)=>{const raw=totalCents*i.capital/capital;return {index,cents:Math.floor(raw),remainder:raw-Math.floor(raw)};});
  let residual=totalCents-amounts.reduce((n,a)=>n+a.cents,0);
  const ranked=[...amounts].sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
  for(let i=0;residual>0;i++,residual--) ranked[i%ranked.length].cents++;
  return p.investors.map((investor,index)=>({...investor,paidProfit:amounts[index].cents/100}));
}
export function nextPackageCode(packages: ManagedPackage[]) { return `PKG-${String(Math.max(4,...packages.map(p=>Number(p.code.slice(4)) || 0))+1).padStart(2,"0")}`; }
export function applyPackageCommand(p: ManagedPackage, command: PackageCommand, asOf: string): ManagedPackage {
  const action = command.action;
  if (action === "pause" && p.status === "trading" && !p.paused) return { ...p,paused:true,updatedAt:asOf };
  if (action === "resume" && p.status === "trading" && p.paused) return { ...p,paused:false,updatedAt:asOf };
  if (action === "close" && p.status === "open") return { ...p,status:"closed",updatedAt:asOf };
  if (action === "start" && p.status === "closed" && p.raisedCapital > 0) return { ...p,status:"trading",updatedAt:asOf };
  if (action === "archive" && p.status === "draft" && !p.raisedCapital) return { ...p,status:"archived",updatedAt:asOf };
  if (action === "publish" && p.status === "draft") {
    const errors = packageErrors(p,true); if(errors.length) throw new Error(errors[0]);
    if (Date.parse(p.bookingClosesAt.endsWith("Z")?p.bookingClosesAt:p.bookingClosesAt+"Z") <= Date.parse(asOf)) throw new Error("Booking has already closed. Revise the draft timeline before publishing.");
    return { ...p,status:Date.parse(p.bookingOpensAt.endsWith("Z")?p.bookingOpensAt:p.bookingOpensAt+"Z") > Date.parse(asOf) ? "scheduled" : "open",updatedAt:asOf };
  }
  if (action === "distribute" && p.status === "profit_sharing" && !p.distributedAt && p.profit > 0) return { ...p,status:"completed",distributedAt:asOf,updatedAt:asOf,investors:allocateProfits(p) };
  throw new Error("That action is not available in this package state.");
}
