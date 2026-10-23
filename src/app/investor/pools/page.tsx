import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Active pools · Investor · tradeMO",
};

/**
 * Deep-link target for the I-1 "Book a slot" quick action. I-1 owns the pool
 * book, so the canonical investor page renders it with the pool section in
 * view; the dedicated pool detail page ships with I-2.
 */
export default function InvestorPoolsPage() {
  redirect("/investor?focus=pools");
}
