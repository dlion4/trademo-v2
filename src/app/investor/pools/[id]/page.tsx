import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pool detail · Investor · tradeMO" };

/**
 * Replaces the earlier marketing bridge. Pool ids are validated against the
 * investor book, then routed to the overview pool section so the deep link
 * never 404s; I-2 will own the dedicated detail route.
 */
export default async function InvestorPoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/investor?focus=pools&pool=${encodeURIComponent(id)}`);
}
