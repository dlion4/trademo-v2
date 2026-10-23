export type InvestorStatus = "active" | "pending_kyc" | "suspended" | "inactive";
export type KycReview = "verified" | "pending" | "rejected";
export type InvestorTab = "overview" | "investments" | "trades" | "wallet" | "comms" | "activity";
export interface InvestorHolding { packageCode:string; name:string; slots:number; capital:number; profit:number }
export interface InvestorTrade { id:string; time:string; symbol:string; contract:string; packageCode:string; attributedProfit:number; stake:number; result:"won"|"lost" }
export interface InvestorMessage { id:string; time:string; direction:"sent"|"received"; subject:string; body:string; read:boolean; channel:"in_app"|"email"; delivery:"demo" }
export interface InvestorActivity { id:string; time:string; action:string; detail:string }
export interface WalletEntry { id:string; time:string; kind:"deposit"|"profit"|"payout"|"adjustment"; amount:number; note:string }
export interface KycDocument { id:string; label:string; kind:"image"|"liveness"; url:string }
export interface ManagedInvestor {
 id:string; name:string; email:string; phone:string; joinedAt:string; status:InvestorStatus;
 kyc:{level:0|1|2;review:KycReview;documentType:"passport"|"national_id";submittedAt:string;sourceOfFunds:string;notes:string;documents:KycDocument[]};
 holdings:InvestorHolding[]; trades:InvestorTrade[]; wallet:{available:number;locked:number;entries:WalletEntry[]};
 messages:InvestorMessage[]; activity:InvestorActivity[]; engagement:{lastLogin:string;lastAction:string;sessions:number;averageSeconds:number}; tags:string[]; notes:string[];
}
export interface InvestorPool {code:string;name:string;target:number}
export interface InvestorBundle {mode:"demo";asOf:string;investors:ManagedInvestor[];pools:InvestorPool[]}
export interface InvestorFilters {search:string;status:string;kyc:string;pool:string;engagement:string}
export type InvestorCommand =
 | {kind:"approve";ids:string[];notes:string;level:1|2}
 | {kind:"reject";ids:string[];notes:string;reason:string}
 | {kind:"suspend"|"reactivate";ids:string[];reason:string}
 | {kind:"message";ids:string[];subject:string;body:string;channel:"in_app"|"email"}
 | {kind:"payout";id:string;amount:number;reason:string}
 | {kind:"adjust";id:string;amount:number;reason:string}
 | {kind:"note";id:string;text:string}
 | {kind:"tags";id:string;tags:string[]};
export const defaultInvestorFilters:InvestorFilters={search:"",status:"all",kyc:"all",pool:"all",engagement:"all"};
export const invested=(i:ManagedInvestor)=>i.holdings.reduce((n,h)=>n+h.capital,0);
export const earned=(i:ManagedInvestor)=>i.holdings.reduce((n,h)=>n+h.profit,0);
export const roi=(i:ManagedInvestor)=>invested(i)?earned(i)/invested(i)*100:0;
export const daysInactive=(i:ManagedInvestor,asOf:string)=>Math.max(0,Math.floor((Date.parse(asOf)-Date.parse(i.engagement.lastLogin))/86400000));
