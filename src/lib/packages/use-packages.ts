"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import { packageErrors } from "./schema";
import type { ManagedPackage, PackageBundle, PackageCommand, PackageTerms } from "./types";
export const packageManagerKey = ["packages","manager"] as const;
import { applyPackageCommand, nextPackageCode } from "./model";
export { nextPackageCode } from "./model";
/** Local demo adapter. Replace mutationFn with authorized REST commands at backend integration. */
export function usePackageManager(initial: PackageBundle) {
  const client = useQueryClient();
  const query = useQuery({ queryKey:packageManagerKey,queryFn:()=>apiFetch<PackageBundle>("/api/package-manager"),initialData:initial,staleTime:Infinity });
  const save = useMutation({ mutationFn:async ({ terms,id,publish }: { terms:PackageTerms;id?:string;publish:boolean }) => {
    const errors = packageErrors(terms,publish); if(errors.length) throw new Error(errors[0]);
    const state = client.getQueryData<PackageBundle>(packageManagerKey) ?? initial;
    const existing = state.packages.find(p=>p.id===id);
    if (existing && !["draft","scheduled","open"].includes(existing.status)) throw new Error("Financial terms are locked after booking closes.");
    if (existing && existing.raisedCapital > 0 && (terms.slotPrice!==existing.slotPrice || terms.operatorSharePercent!==existing.operatorSharePercent || existing.investors.some(i=>i.slots>terms.maxSlotsPerUser) || terms.targetCapital < existing.raisedCapital || (terms.maxCapital !== null && terms.maxCapital < existing.raisedCapital))) throw new Error("Funded packages cannot change slot price or fee split, or reduce capital limits below funded capital.");
    const asOf=state.asOf;
    const row: ManagedPackage = existing ? { ...existing,...terms,updatedAt:asOf } : { ...terms,id:`managed_${crypto.randomUUID()}`,code:nextPackageCode(state.packages),status:"draft",paused:false,raisedCapital:0,profit:0,investors:[],createdAt:asOf,updatedAt:asOf,distributedAt:null };
    const next = publish && row.status==="draft" ? applyPackageCommand(row,{ id:row.id,action:"publish" },asOf) : row;
    client.setQueryData<PackageBundle>(packageManagerKey,{ ...state,packages:existing?state.packages.map(p=>p.id===id?next:p):[...state.packages,next] });
    return next;
  } });
  const command = useMutation({ mutationFn:async (input:PackageCommand) => {
    const state = client.getQueryData<PackageBundle>(packageManagerKey) ?? initial;
    const row=state.packages.find(p=>p.id===input.id); if(!row) throw new Error("Package not found.");
    const next=applyPackageCommand(row,input,state.asOf);
    client.setQueryData<PackageBundle>(packageManagerKey,{ ...state,packages:state.packages.map(p=>p.id===next.id?next:p) }); return next;
  } });
  return { data:query.data,save,command };
}
