import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Activity · Investor · tradeMO" };

export default function InvestorActivityPage() {
  redirect("/investor?focus=activity");
}
