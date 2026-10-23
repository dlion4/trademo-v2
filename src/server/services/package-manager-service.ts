import { allocateProfits } from "@/lib/packages/model";
import { initialTerms, type ManagedPackage, type PackageBundle, type PackageHistory } from "@/lib/packages/types";
export function getPackageManagerBundle(): PackageBundle {
  const asOf = "2026-10-21T14:47:00Z";
  const seeds = [
    { code:"PKG-01",name:"Basic Growth",status:"trading",slotPrice:3000,targetCapital:50000,maxSlotsPerUser:20,expectedROI:15,profit:4200,count:12,days:14,markets:["R_10","R_75"],end:"2026-10-27T19:19" },
    { code:"PKG-02",name:"Premium Yield",status:"open",slotPrice:5000,targetCapital:80000,maxSlotsPerUser:10,expectedROI:18,profit:0,count:6,days:21,markets:["R_10","R_100"],end:"2026-11-15T17:00" },
    { code:"PKG-03",name:"Aggressive Max",status:"trading",slotPrice:10000,targetCapital:100000,maxSlotsPerUser:5,expectedROI:25,profit:13500,count:9,days:30,markets:["R_10","R_75","R_100"],end:"2026-11-02T23:01" },
    { code:"PKG-04",name:"Quick Flip",status:"scheduled",slotPrice:2000,targetCapital:40000,maxSlotsPerUser:25,expectedROI:10,profit:0,count:0,days:7,markets:["R_10"],end:"2026-11-05T17:00" },
    { code:"PKG-05",name:"Balanced Reserve",status:"profit_sharing",slotPrice:2500,targetCapital:30000,maxSlotsPerUser:10,expectedROI:12,profit:2400,count:8,days:14,markets:["R_10","R_75"],end:"2026-10-20T17:00" },
    { code:"PKG-00",name:"Genesis",status:"completed",slotPrice:1000,targetCapital:50000,maxSlotsPerUser:20,expectedROI:15,profit:9545,count:18,days:14,markets:["R_10","R_75"],end:"2026-10-09T17:00" },
  ] as const;
  const packages: ManagedPackage[] = seeds.map((s,ix) => {
    const investors = Array.from({ length:s.count },(_,i) => { const slots = s.code === "PKG-00" ? (i<4?4:3) : s.code === "PKG-01" && i === 0 ? 3 : 1; return { id:`${s.code}-investor-${i+1}`,name:["Amina Mwangi","James Kariuki","Grace Wanjiku","David Otieno","Sarah Njeri"][i%5] + (i>=5 ? ` · ${i+1}` : ""), slots, capital:slots*s.slotPrice, joinedAt:"2026-10-05", kyc:"verified" as const, paidProfit:0 }; });
    const raisedCapital = investors.reduce((n,i)=>n+i.capital,0);
    const tradingStartsAt = new Date(Date.parse(s.end+"Z")-s.days*86400000).toISOString().slice(0,16);
    const end = s.end;
    const bookingClosesAt = new Date(Date.parse(tradingStartsAt+"Z")-86400000).toISOString().slice(0,16);
    const bookingOpensAt = new Date(Date.parse(bookingClosesAt+"Z")-4*86400000).toISOString().slice(0,16);
    return { ...initialTerms, ...s, markets:[...s.markets], id:`managed_${ix}`, code:s.code, status:s.status, maxCapital:s.targetCapital*1.5, raisedCapital, investors,
      description:`${s.name} is a diversified synthetic-index trading pool with defined execution windows and capital protection thresholds. Capital is at risk; projected returns are not guaranteed.`,
      paused:false, tradingStartsAt, tradingEndsAt:end, bookingOpensAt, bookingClosesAt, profitShareDate:new Date(Date.parse(end+"Z")+86400000).toISOString().slice(0,16),
      termsUrl:"", createdAt:"2026-10-01T09:00:00Z", updatedAt:asOf, distributedAt:s.status === "completed" ? "2026-10-10T12:00:00Z" : null,
    };
  });
  // The sample terms are bundled text in the UI; never link to fictional external PDFs.
  packages.forEach(p => { p.termsUrl = ""; if (p.distributedAt) p.investors = allocateProfits(p); });
  const history: PackageHistory[] = [21.8,15.2,14.5,13.9,13.5,13.1,12.7,8.5].map((roi,i) => ({ id:`history_${i}`,name:["Genesis Plus","Growth Cycle 07","Growth Cycle 06","Growth Cycle 05","Growth Cycle 04","Growth Cycle 03","Growth Cycle 02","Starter 2"][i],minSlot:3000,duration:14,markets:["R_10","R_75"],roi,completedAt:`2026-${String(9-Math.floor(i/3)).padStart(2,"0")}-${String(25-i%3*7).padStart(2,"0")}` }));
  return { mode:"demo", asOf, packages, history };
}
