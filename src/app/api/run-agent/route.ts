import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Fallback signals when DexScreener is rate-limited or unreachable
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
    reasoning: "high 24h volume, solid liquidity, strong 1h momentum, fresh pair gaining traction",
    pairAddress: "0x6cDAcb3025E16865BeB8E9354F4Ea8f87111DC81",
    contractAddress: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    isClanker: false,
  },
  {
    symbol: "VIRTUAL", name: "Virtual Protocol", chain: "base",
    priceUsd: 1.82, liquidityUsd: 3200000, marketCap: 1180000000,
    volume24h: 567000, priceChange1h: 6.3, priceChange24h: 22.1,
    ageHours: 720, score: 82, action: "ENTER",
    reasoning: "solid liquidity, high 24h volume, positive momentum, recently launched",
    pairAddress: "0x9A19ceE7B5c4b7b1d41a0B7e1b7E0d1c4B8E7A2F",
    contractAddress: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
    isClanker: false,
  },
  {
    symbol: "AERO", name: "Aerodrome", chain: "base",
    priceUsd: 0.94, liquidityUsd: 5600000, marketCap: 680000000,
    volume24h: 234000, priceChange1h: -1.2, priceChange24h: 5.8,
    ageHours: 6480, score: 52, action: "WATCH",
    reasoning: "solid liquidity, high 24h volume, building volume",
    pairAddress: "0xBcF1e328455c4059EEb9e3f84b5543F74E24e7F1",
    contractAddress: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    isClanker: false,
  },
];

export async function POST() {
  try {
    // Attempt to fetch live signals from DexScreener
    let signals;
    try {
      const { fetchMultiChainSignals } = await import("@/lib/dexscreener");
      const liveSignals = await fetchMultiChainSignals(8);
      signals = liveSignals.length > 0 ? liveSignals : FALLBACK_SIGNALS;
    } catch {
      console.warn("[API /run-agent] DexScreener unavailable, using fallback signals");
      signals = FALLBACK_SIGNALS;
    }

    // Generate detailed agent reasoning for top signals
    const topSignals = signals.slice(0, 4);
    const now = new Date();
    const timestamp = now.toISOString().replace("T", " ").split(".")[0];

    const results = topSignals.map((s, idx) => {
      const parts: string[] = [];
      parts.push(`[${timestamp}] Cycle #${idx + 1}: Evaluating ${s.symbol} on ${s.chain.toUpperCase()}.`);
      parts.push(
        `Market data — Liquidity: $${Math.round(s.liquidityUsd).toLocaleString()}, ` +
        `24h Vol: $${Math.round(s.volume24h).toLocaleString()}, ` +
        `1h Δ: ${s.priceChange1h >= 0 ? "+" : ""}${s.priceChange1h.toFixed(1)}%.`
      );
      parts.push(`Signal analysis: ${s.reasoning}.`);

      if (s.action === "ENTER") {
        parts.push(
          `Confidence ${s.score}/100 — clears entry threshold. ` +
          `Risk/reward profile is favorable. Recommending ENTER with position sizing at 2% portfolio.`
        );
      } else if (s.action === "WATCH") {
        parts.push(
          `Confidence ${s.score}/100 — promising but not decisive. ` +
          `Adding to watchlist for next cycle re-evaluation. Recommending WATCH.`
        );
      } else {
        parts.push(
          `Confidence ${s.score}/100 — does not meet entry bar. ` +
          `Insufficient signal strength. SKIP.`
        );
      }

      return {
        ...s,
        thought: parts.join(" "),
        payHash: "",
        decisionHash: "",
      };
    });

    return NextResponse.json({ success: true, results, mode: "demo" });
  } catch (e: any) {
    console.error("[API /run-agent] Error:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
