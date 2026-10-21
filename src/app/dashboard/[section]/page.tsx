import type { Metadata } from "next";

import { OperatorSubModuleView } from "@/components/dashboard/sub-module-view";
import { OPERATOR_NAV } from "@/lib/dashboard/nav";
import { getCommandCenterBundle } from "@/server/services/dashboard-mock-service";

export const dynamic = "force-dynamic";

type Params = Promise<{ section: string }>;
type Search = Promise<{ schedule?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { section } = await params;
  const item = OPERATOR_NAV.find((n) => n.key === section);
  return {
    title: item ? `${item.label} (${item.code}) · Operator Console · tradeMO` : "Operator Console · tradeMO",
  };
}

export default async function DashboardSectionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { section } = await params;
  const sp = await searchParams;
  const bundle = getCommandCenterBundle();
  return (
    <OperatorSubModuleView
      section={section}
      bundle={bundle}
      scheduleFilter={sp.schedule}
    />
  );
}
