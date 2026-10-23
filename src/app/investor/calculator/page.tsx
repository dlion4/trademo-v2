import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Return calculator · Investor · tradeMO",
};

/** Calculator deep link opens the three-step projection workflow. */
export default function InvestorCalculatorPage() {
  redirect("/investor?action=calculator");
}
