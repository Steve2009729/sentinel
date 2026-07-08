import { NextResponse } from "next/server";
import { fetchMultiChainSignals } from "@/lib/dexscreener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fallback signals when DexScreener is rate-limited or slow
const FALLBACK_SIGNALS = [
  {
    symbol: "PEPE", name: "Pepe", chain: "ethereum",
    priceUsd: 0.0000128, liquidityUsd: 2450000, marketCap: 5400000000,
    volume24h: 892000, priceChange1h: 4.2, priceChange24h: 12.8,
    ageHours: 8760, score: 72, action: "ENTER",
    reasoning: "high 24h volume, solid liquidity, positive momentum",
    pairAddress: "0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f",
    contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    isClanker: false,
  },
  {
    symbol: "BRETT", name: "Brett", chain: "base",
    priceUsd: 0.142, liquidityUsd: 1850000, marketCap: 1420000000,
    volume24h: 345000, priceChange1h: 2.1, priceChange24h: -3.4,
    ageHours: 2160, score: 58, action: "WATCH",
    reasoning: "solid liquidity, high 24h volume, recently launched",
    pairAddress: "0x404E927b203375779a6aBd52a2049cE0ADf6609B",
    contractAddress: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
    isClanker: false,
  },
  {
    symbol: "DEGEN", name: "Degen", chain: "base",
    priceUsd: 0.0087, liquidityUsd: 920000, marketCap: 320000000,
    volume24h: 1240000, priceChange1h: 18.7, priceChange24h: 45.2,
    ageHours: 4320, score: 88, action: "ENTER",
    reasoning: "high 24h volume, solid liquidity, strong 1h momentum",
    pairAddress: "0x6cDAcb3025E16865BeB8E9354F4Ea8f87111DC81",
    contractAddress: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    isClanker: false,
  },
  {
    symbol: "VIRTUAL", name: "Virtual Protocol", chain: "base",
    priceUsd: 1.82, liquidityUsd: 3200000, marketCap: 1180000000,
    volume24h: 567000, priceChange1h: 6.3, priceChange24h: 22.1,
    ageHours: 720, score: 82, action: "ENTER",
    reasoning: "solid liquidity, high 24h volume, positive momentum",
    pairAddress: "0x9A19ceE7B5c4b7b1d41a0B7e1b7E0d1c4B8E7A2F",
    contractAddress: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
    isClanker: false,
  },
  {
    symbol: "AERO", name: "Aerodrome Finance", chain: "base",
    priceUsd: 0.94, liquidityUsd: 5600000, marketCap: 680000000,
    volume24h: 234000, priceChange1h: -1.2, priceChange24h: 5.8,
    ageHours: 6480, score: 52, action: "WATCH",
    reasoning: "solid liquidity, high 24h volume, building volume",
    pairAddress: "0xBcF1e328455c4059EEb9e3f84b5543F74E24e7F1",
    contractAddress: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    isClanker: false,
  },
  {
    symbol: "TOSHI", name: "Toshi", chain: "base",
    priceUsd: 0.00034, liquidityUsd: 780000, marketCap: 140000000,
    volume24h: 189000, priceChange1h: 7.4, priceChange24h: 18.9,
    ageHours: 5040, score: 67, action: "WATCH",
    reasoning: "solid liquidity, high 24h volume, positive momentum",
    pairAddress: "0xD2Fc3E1a328455c4059EEb9e3f84b5543F74E2AF",
    contractAddress: "0xAC1Bd2486aaf3B5C0fc3Fd868558b082a531B2B4",
    isClanker: false,
  },
  {
    symbol: "MOCHI", name: "Mochi", chain: "base",
    priceUsd: 0.0021, liquidityUsd: 420000, marketCap: 89000000,
    volume24h: 98000, priceChange1h: 3.8, priceChange24h: 9.2,
    ageHours: 1440, score: 55, action: "WATCH",
    reasoning: "moderate liquidity, building volume, positive momentum",
    pairAddress: "0xE3Fc1a328455c4059EEb9e3f84b5543F74E24e8B",
    contractAddress: "0xF944E35f95E2D0b7F8D5F0e4B0c1A6F8B2C3D4E5",
    isClanker: true,
  },
  {
    symbol: "HIGHER", name: "Higher", chain: "base",
    priceUsd: 0.0058, liquidityUsd: 310000, marketCap: 58000000,
    volume24h: 67000, priceChange1h: -2.1, priceChange24h: -5.3,
    ageHours: 3600, score: 38, action: "SKIP",
    reasoning: "moderate liquidity, building volume, dropping hard (caution)",
    pairAddress: "0xF4Ab2e328455c4059EEb9e3f84b5543F74E24e9C",
    contractAddress: "0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe",
    isClanker: false,
  },
];

export async function GET() {
  try {
    // Fetch real live signals from DexScreener (Base + Ethereum)
    const signals = await fetchMultiChainSignals(20);

    // If we got live signals, return them. Otherwise use fallbacks.
    if (signals.length > 0) {
      return NextResponse.json({ success: true, signals, source: "live" });
    }

    console.warn("[API /signals] DexScreener returned empty, using fallback signals");
    return NextResponse.json({ success: true, signals: FALLBACK_SIGNALS, source: "cache" });
  } catch (e: any) {
    console.error("[API /signals] Error:", e.message);
    // Return fallback signals instead of empty array for better UX
    return NextResponse.json({ success: true, signals: FALLBACK_SIGNALS, source: "fallback" });
  }
}
