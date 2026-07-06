import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    // Check if PRIVATE_KEY is available for on-chain operations
    if (!process.env.PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
      // Demo mode: return signal analysis without on-chain settlement
      const { fetchMultiChainSignals } = await import("@/lib/dexscreener");
      const signals = await fetchMultiChainSignals(5);

      const results = signals.slice(0, 3).map((s) => {
        const parts: string[] = [];
        parts.push(`Evaluating ${s.symbol} on ${s.chain}.`);
        parts.push(
          `Liquidity $${Math.round(s.liquidityUsd).toLocaleString()}, 24h volume $${Math.round(s.volume24h).toLocaleString()}, 1h change ${s.priceChange1h.toFixed(1)}%.`
        );
        parts.push(`Signals: ${s.reasoning}.`);
        if (s.action === "ENTER")
          parts.push(`Confidence ${s.score}/100 — clears entry threshold. Recommending ENTER.`);
        else if (s.action === "WATCH")
          parts.push(`Confidence ${s.score}/100 — promising but not decisive. Recommending WATCH.`);
        else parts.push(`Confidence ${s.score}/100 — does not meet bar. SKIP.`);

        return {
          ...s,
          thought: parts.join(" "),
          payHash: "",
          decisionHash: "",
        };
      });

      return NextResponse.json({ success: true, results, mode: "demo" });
    }

    // Full mode with on-chain settlement
    const { runCycle } = await import("@/../agent/runAgent");
    const results = await runCycle("base");
    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    console.error("[API /run-agent] Error:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
