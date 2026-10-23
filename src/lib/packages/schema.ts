import { z } from "zod";
import { packageMarkets, packageStrategies } from "./types";
const utcDate = z.string().refine(s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && Number.isFinite(Date.parse(s)), "Choose a valid UTC date and time.");
export const termsSchema = z.object({
  name: z.string().trim().min(3,"Name needs at least 3 characters.").max(80), description: z.string().trim().min(20,"Describe the strategy and risks in at least 20 characters.").max(2000), tokenName: z.string().trim().min(1).max(12),
  slotPrice: z.number().min(100).max(50000), maxSlotsPerUser: z.number().int().min(1).max(100), targetCapital: z.number().min(100).max(100000000), maxCapital: z.number().max(100000000).nullable(),
  bookingOpensAt: utcDate, bookingClosesAt: utcDate, tradingStartsAt: utcDate, tradingEndsAt: utcDate, profitShareDate: utcDate,
  conservativeROI: z.number().min(-100).max(100), expectedROI: z.number().min(-100).max(500), optimisticROI: z.number().min(-100).max(500), operatorSharePercent: z.number().min(0).max(40),
  markets: z.array(z.enum(packageMarkets)).min(1,"Select at least one market."), strategies: z.array(z.enum(packageStrategies)).min(1,"Select at least one strategy."), guardianEnabled: z.boolean(), maxConsecLosses: z.number().int().min(1).max(30), maxDrawdown: z.number().min(1).max(15),
  termsUrl: z.string().refine(s => { if (!s) return true; try { const u = new URL(s); return u.protocol === "https:" && /\.pdf$/i.test(u.pathname); } catch { return false; } },"Terms must be an HTTPS link ending in .pdf."), autoReinvestOption: z.boolean(), earlyExitPenalty: z.number().min(0).max(50),
}).superRefine((p,ctx) => {
  const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path:[path], message });
  if (p.maxCapital !== null && p.maxCapital < p.targetCapital) add("maxCapital","Maximum capital cannot be below the target.");
  if (p.targetCapital < p.slotPrice) add("targetCapital","Target must fund at least one slot.");
  const times = [p.bookingOpensAt,p.bookingClosesAt,p.tradingStartsAt,p.tradingEndsAt,p.profitShareDate].map(s => Date.parse(s.endsWith("Z") ? s : s+"Z"));
  if (!times.every((t,i) => i === 0 || t > times[i-1])) add("tradingStartsAt","Timeline must progress: booking opens → closes → trading starts → ends → profit share.");
  if (p.conservativeROI > p.expectedROI || p.expectedROI > p.optimisticROI) add("expectedROI","Return scenarios must be ordered conservative ≤ expected ≤ optimistic.");
});
export function packageErrors(value: unknown, publish = false): string[] {
  const result = termsSchema.safeParse(value);
  const errors = result.success ? [] : result.error.issues.map(i => i.message);
  if (publish && result.success && !result.data.termsUrl) errors.push("Add a public HTTPS terms PDF before publishing.");
  return errors;
}
