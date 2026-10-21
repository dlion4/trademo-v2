import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import { AppProviders } from "./providers";

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
    <html lang="en" data-bs-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
