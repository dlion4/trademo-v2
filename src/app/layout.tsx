import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import { AppProviders } from "./providers";

// Self-hosted via next/font — no render-blocking request to fonts.googleapis.com.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tradeMO — Crowdfunded Multi-Asset Trading Pools & Investor Profit Sharing",
  description:
    "Back high-performance quantitative trading pools across global equities, forex, index futures, and commodities. Transparent, proportional profit distributions with High-Water Mark protection.",
  keywords: [
    "crowdfunded trading",
    "investment pools",
    "profit sharing",
    "quantitative trading",
    "multi-asset syndicates",
    "forex crowdfunding",
  ],
  openGraph: {
    title: "tradeMO — Crowdfunded Multi-Asset Trading Pools",
    description: "Back High-Yield Trading Strategies. Pool Capital. Receive Proportional Profits.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-bs-theme="light"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
