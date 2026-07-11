import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sentinel — Web3 Token Signal Terminal | HashKey Chain",
  description:
    "Autonomous AI-powered token signal and analytics dashboard. Real-time DexScreener data, TradingView charts, Smart Money tracking, and on-chain settlements via HSK on HashKey Chain.",
  keywords: [
    "Sentinel", "HashKey Chain", "HSK", "token signals",
    "DeFi", "Web3", "DexScreener", "trading", "Base", "Ethereum",
    "token analytics", "on-chain settlement",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Sentinel — Web3 Token Signal Terminal",
    description: "AI-powered token analytics with on-chain HSK settlements on HashKey Chain.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body style={{ margin: 0, padding: 0 }} suppressHydrationWarning>{children}</body>
    </html>
  );
}
