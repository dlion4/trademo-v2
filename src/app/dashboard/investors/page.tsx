import type { Metadata } from "next";
import { InvestorsPage } from "@/components/dashboard/investors/investors-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getInvestorManagerBundle } from "@/server/services/investor-manager-service";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Investors Management (D-6) · tradeMO",description:"Investor relationships, pool allocations, KYC reviews, communication and engagement."};
export default function Page(){return <InvestorsPage operatorBundle={getCommandCenterBundle()} initial={getInvestorManagerBundle()}/>;}
