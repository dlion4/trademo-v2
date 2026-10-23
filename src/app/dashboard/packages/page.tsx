import type { Metadata } from "next";
import { PackagesPage } from "@/components/dashboard/packages/packages-page";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";
import { getPackageManagerBundle } from "@/server/services/package-manager-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Package Manager (D-5) · tradeMO",description:"Manage crowdfunded trading mandates, investor allocations, package lifecycles and settlement terms." };
export default function Page(){return <PackagesPage operatorBundle={getCommandCenterBundle()} initial={getPackageManagerBundle()}/>;}
