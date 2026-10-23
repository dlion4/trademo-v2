import { z } from "zod";
import { daysInactive, type InvestorBundle, type InvestorCommand, type InvestorFilters, type ManagedInvestor } from "./types";
const ids=z.array(z.string().min(1)).min(1).max(100).refine(a=>new Set(a).size===a.length,"Duplicate investor selection.");
const note=z.string().trim().min(10,"Enter a clear reason or review note of at least 10 characters.").max(1000);
export const investorCommandSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("approve"),ids,notes:note,level:z.union([z.literal(1),z.literal(2)])}),
 z.object({kind:z.literal("reject"),ids,notes:note,reason:z.string().trim().min(3).max(100)}),
 z.object({kind:z.enum(["suspend","reactivate"]),ids,reason:note}),
 z.object({kind:z.literal("message"),ids,subject:z.string().trim().min(3).max(120),body:z.string().trim().min(10).max(4000),channel:z.enum(["in_app","email"])}),
 z.object({kind:z.literal("payout"),id:z.string(),amount:z.number().positive().max(1000000).refine(n=>Math.abs(n*100-Math.round(n*100))<.00001,"Use at most two decimal places."),reason:note}),
 z.object({kind:z.literal("adjust"),id:z.string(),amount:z.number().min(-10000).max(10000).refine(n=>n!==0&&Math.abs(n*100-Math.round(n*100))<.00001,"Use a non-zero amount with at most two decimal places."),reason:note}),
 z.object({kind:z.literal("note"),id:z.string(),text:note}),
 z.object({kind:z.literal("tags"),id:z.string(),tags:z.array(z.string().trim().min(1).max(30)).max(8)}),
]);
const round=(n:number)=>Math.round(n*100)/100;
/** Atomic, immutable demo command handler. No external money movement or message delivery. */
export function applyInvestorCommand(state:InvestorBundle,input:InvestorCommand):InvestorBundle{
 const parsed=investorCommandSchema.safeParse(input);if(!parsed.success)throw new Error(parsed.error.issues[0].message);
 const cmd=parsed.data;const selected="ids"in cmd?cmd.ids:[cmd.id];
 if(selected.some(id=>!state.investors.some(i=>i.id===id)))throw new Error("One or more investors could not be found.");
 // Preflight the entire batch before constructing any updates.
 for(const i of state.investors.filter(i=>selected.includes(i.id))){
  if(["approve","reject"].includes(cmd.kind)&&i.kyc.review!=="pending")throw new Error("Only pending KYC submissions can be reviewed.");
  if(cmd.kind==="suspend"&&i.status==="suspended")throw new Error("Investor is already suspended.");
  if(cmd.kind==="reactivate"&&i.status!=="suspended")throw new Error("Only suspended investors can be reactivated.");
  if(cmd.kind==="payout"&&(i.status!=="active"||i.kyc.review!=="verified"||i.kyc.level<2))throw new Error("Payout requires an active investor with verified level 2 KYC.");
  if(cmd.kind==="payout"&&cmd.amount>i.wallet.available)throw new Error("Payout exceeds available wallet balance. Locked capital cannot be withdrawn here.");
  if(cmd.kind==="adjust"&&round(i.wallet.available+cmd.amount)<0)throw new Error("Adjustment would make the available balance negative.");
 }
 return{...state,investors:state.investors.map(i=>{
  if(!selected.includes(i.id))return i;
  let next:ManagedInvestor={...i};let detail="";
  const eventId=`${cmd.kind}_${i.id}_${i.activity.length}`;
  if(cmd.kind==="approve"){next={...next,kyc:{...i.kyc,level:cmd.level,review:"verified",notes:cmd.notes},status:i.status==="suspended"?"suspended":"active"};detail=`Demo KYC L${cmd.level} approved. ${cmd.notes}`;}
  if(cmd.kind==="reject"){next={...next,kyc:{...i.kyc,review:"rejected",notes:`${cmd.reason}: ${cmd.notes}`},status:i.status==="suspended"?"suspended":"pending_kyc"};detail=`KYC rejected: ${cmd.reason}. ${cmd.notes}`;}
  if(cmd.kind==="suspend"){next={...next,status:"suspended"};detail=`Access suspended. ${cmd.reason}`;}
  if(cmd.kind==="reactivate"){next={...next,status:i.kyc.review==="verified"?"active":"pending_kyc"};detail=`Access reactivated. ${cmd.reason}`;}
  if(cmd.kind==="message"){next={...next,messages:[{id:eventId,time:state.asOf,direction:"sent",subject:cmd.subject,body:cmd.body,read:false,channel:cmd.channel,delivery:"demo"},...i.messages]};detail=`Demo ${cmd.channel} message recorded: ${cmd.subject}. No external delivery.`;}
  if(cmd.kind==="payout"||cmd.kind==="adjust"){const amount=cmd.kind==="payout"?-cmd.amount:cmd.amount;next={...next,wallet:{...i.wallet,available:round(i.wallet.available+amount),entries:[{id:eventId,time:state.asOf,kind:cmd.kind==="payout"?"payout":"adjustment",amount,note:cmd.reason},...i.wallet.entries]}};detail=`Demo ${cmd.kind}: ${amount.toFixed(2)} USD. ${cmd.reason}`;}
  if(cmd.kind==="note"){next={...next,notes:[cmd.text,...i.notes]};detail="Internal review note added.";}
  if(cmd.kind==="tags"){next={...next,tags:[...new Set(cmd.tags)]};detail=`Labels updated: ${cmd.tags.join(", ")||"none"}`;}
  return{...next,activity:[{id:eventId,time:state.asOf,action:cmd.kind,detail},...i.activity]};
 })};
}
export function filterInvestors(state:InvestorBundle,f:InvestorFilters){return state.investors.filter(i=>(!f.search||`${i.id} ${i.name} ${i.email} ${i.tags.join(" ")}`.toLowerCase().includes(f.search.toLowerCase()))&&(f.status==="all"||i.status===f.status)&&(f.kyc==="all"||f.kyc==="pending"&&i.kyc.review==="pending"||f.kyc==="rejected"&&i.kyc.review==="rejected"||f.kyc===`L${i.kyc.level}`)&&(f.pool==="all"||i.holdings.some(h=>h.packageCode===f.pool))&&(f.engagement==="all"||f.engagement==="at-risk"&&daysInactive(i,state.asOf)>=14||f.engagement==="recent"&&daysInactive(i,state.asOf)<14));}
