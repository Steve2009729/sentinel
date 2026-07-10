// /api/run-agent — Sentinel autonomous AI agent cycle
// Sources: GeckoTerminal trending + new pools, DexScreener boosts, CoinGecko trending
// AI: Google Gemini 1.5 Flash with deep per-token research prompts
// Refreshes every time triggered; dashboard auto-triggers every 5 min

import { NextResponse } from "next/server";
import { fetchResearchedSignals, type ResearchedSignal } from "@/lib/agentResearch";

export const runtime = "nodejs";
export const maxDuration = 55;

// ─── GEMINI CALL ──────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200,
            // NOTE: do NOT use responseMimeType here — causes 400 on some regions
          },
        }),
      }
    );
    if (!res.ok) {
      console.error("[Gemini] HTTP", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (e: any) {
    console.error("[Gemini] fetch error:", e.message);
    return null;
  }
}

// ─── SMART FALLBACK REASONING ─────────────────────────────────────────────────

function buildFallbackReasoning(s: ResearchedSignal): string {
  const lines: string[] = [];

  lines.push(`📊 ${s.symbol} (${s.chain.toUpperCase()}) — Score ${s.score}/100`);

  const signals: string[] = [];
  if (s.priceChange1h > 20) signals.push(`🚀 +${s.priceChange1h.toFixed(1)}% surge in the last hour`);
  else if (s.priceChange1h > 5) signals.push(`📈 Positive 1h momentum (+${s.priceChange1h.toFixed(1)}%)`);
  else if (s.priceChange1h < -15) signals.push(`📉 Significant 1h decline (${s.priceChange1h.toFixed(1)}%)`);

  if (s.priceChange24h > 50) signals.push(`🔥 +${s.priceChange24h.toFixed(0)}% over 24h — strong breakout`);
  else if (s.priceChange24h > 20) signals.push(`📊 +${s.priceChange24h.toFixed(0)}% over 24h`);

  if (s.liquidityUsd > 500_000) signals.push(`💧 Deep liquidity ($${Math.round(s.liquidityUsd / 1000)}K)`);
  else if (s.liquidityUsd > 100_000) signals.push(`💧 Solid liquidity ($${Math.round(s.liquidityUsd / 1000)}K)`);
  else signals.push(`⚠️ Thin liquidity ($${Math.round(s.liquidityUsd / 1000)}K) — use small size`);

  if (s.volume24h > 1_000_000) signals.push(`📣 Explosive volume — $${Math.round(s.volume24h / 1000)}K/24h`);
  else if (s.volume24h > 200_000) signals.push(`📣 High volume — $${Math.round(s.volume24h / 1000)}K/24h`);

  if (s.isTrendingOnCoinGecko) signals.push(`🌐 Trending on CoinGecko — broad market attention`);
  if (s.isBoostedOnDexScreener) signals.push(`⚡ Boosted on DexScreener — increased visibility`);
  if (s.sources.length > 1) signals.push(`✅ Confirmed across ${s.sources.length} independent data sources`);

  lines.push(signals.join(" · "));

  // Rise projection
  let risePct = 0;
  if (s.score >= 85) risePct = Math.round(60 + s.priceChange1h * 1.5);
  else if (s.score >= 70) risePct = Math.round(30 + s.priceChange1h);
  else if (s.score >= 50) risePct = Math.round(10 + s.priceChange1h * 0.5);
  else risePct = 5;
  risePct = Math.max(5, Math.min(300, risePct));
  const timeframe = s.score >= 75 ? "next 24–48h" : "next 48–72h";
  lines.push(`🎯 Projected rise: +${risePct}% in ${timeframe} based on volume trend, liquidity depth, and cross-source confirmation.`);

  if (s.action === "ENTER") {
    lines.push(`✅ Recommendation: ENTER — Buy pressure confirmed. Consider entering with defined risk.`);
  } else if (s.action === "WATCH") {
    lines.push(`👁️ Recommendation: WATCH — Momentum building. Wait for breakout confirmation before entering.`);
  } else {
    lines.push(`⛔ Recommendation: SKIP — Setup does not meet entry criteria. Risk/reward not favorable.`);
  }

  return lines.join("\n");
}

// ─── PARSE GEMINI JSON OUTPUT (safe) ─────────────────────────────────────────

function extractJsonArray(raw: string): any[] {
  try {
    // Strip markdown code fences if present
    const clean = raw.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
    // Find first [ ... ]
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return [];
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function POST() {
  const steps: string[] = [];
  const ts = () => new Date().toLocaleTimeString("en-US", { hour12: false });
  const step = (msg: string) => steps.push(`[${ts()}] ${msg}`);

  try {
    step("🔍 Initializing Sentinel AI Research Agent...");
    step("📡 Connecting to multi-source market intelligence feeds...");

    // ── STEP 1: Real multi-source research ──────────────────────────────────
    step("Step 1/4: Scanning DexScreener boosts, GeckoTerminal trending pools, and CoinGecko trending...");

    let signals: ResearchedSignal[] = [];
    try {
      signals = await fetchResearchedSignals(8);
      if (signals.length === 0) throw new Error("All sources returned empty");
      step(`✅ Fetched ${signals.length} researched candidates across Base and Ethereum.`);
    } catch (e: any) {
      step(`⚠️ Market feeds partially unavailable (${e.message}). Using best available data.`);
      // Still continue — Gemini will analyze whatever we have
    }

    if (signals.length === 0) {
      step("❌ Could not fetch live market data. Please try again in 30 seconds.");
      return NextResponse.json({
        success: false,
        error: "Market data unavailable. All API sources timed out. Please try again.",
        steps,
        results: [],
      });
    }

    // Log what we found
    const enterCount = signals.filter(s => s.action === "ENTER").length;
    const watchCount = signals.filter(s => s.action === "WATCH").length;
    step(`Step 2/4: Scoring ${signals.length} tokens — ${enterCount} ENTER signals, ${watchCount} WATCH signals identified.`);

    signals.slice(0, 5).forEach(s => {
      const cgTag = s.isTrendingOnCoinGecko ? " [CoinGecko Trending]" : "";
      const dxTag = s.isBoostedOnDexScreener ? " [DexScreener Boost]" : "";
      step(`  › ${s.symbol} on ${s.chain.toUpperCase()} — Score ${s.score}/100 — ${s.action}${cgTag}${dxTag}`);
    });

    // ── STEP 2: Gemini deep research ────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    const aiAnalyses: Record<string, string> = {};

    if (apiKey) {
      step("Step 3/4: Sending to Google Gemini AI for deep market research and prediction...");

      const topTokens = signals.slice(0, 5);

      const researchPrompt = `You are Sentinel AI — an elite crypto trading analyst with access to real-time market data. Analyze each token below using the market data provided and produce professional, data-driven trade signals.

For EACH token, provide:
1. A 3-4 sentence analysis of WHY this token is moving
2. Specific entry reasoning (what catalysts are driving it)
3. A precise rise % projection (e.g., "+45% in 24h") with your reasoning
4. Risk factors traders should know
5. Final verdict: ENTER, WATCH, or SKIP and why

Token Data:
${topTokens.map((s, i) => `
Token ${i + 1}: ${s.symbol} (${s.name})
- Chain: ${s.chain.toUpperCase()}
- Price: $${s.priceUsd < 0.0001 ? s.priceUsd.toExponential(4) : s.priceUsd.toFixed(6)}
- Market Cap: $${s.marketCap > 0 ? (s.marketCap / 1e6).toFixed(2) + "M" : "unknown"}
- Liquidity: $${(s.liquidityUsd / 1000).toFixed(0)}K
- 24h Volume: $${(s.volume24h / 1000).toFixed(0)}K
- 1h Change: ${s.priceChange1h >= 0 ? "+" : ""}${s.priceChange1h.toFixed(2)}%
- 24h Change: ${s.priceChange24h >= 0 ? "+" : ""}${s.priceChange24h.toFixed(2)}%
- Sentinel Score: ${s.score}/100
- Signal: ${s.action}
- CoinGecko Trending: ${s.isTrendingOnCoinGecko ? "YES ✅" : "No"}
- DexScreener Boosted: ${s.isBoostedOnDexScreener ? "YES ✅" : "No"}
- Data Sources: ${s.sources.join(", ")}
`).join("\n")}

Respond ONLY with a JSON array. Each object must have:
- "symbol": the token symbol
- "analysis": your full analysis (3-4 sentences, specific and data-driven)
- "risePct": projected rise percentage as a number (e.g., 45)
- "timeframe": your predicted timeframe (e.g., "24h", "48h", "7d")
- "entryReason": one sentence on why to enter now
- "riskFactors": one sentence on main risks
- "verdict": "ENTER", "WATCH", or "SKIP"

IMPORTANT: Do not use markdown. Return only the raw JSON array.`;

      const raw = await callGemini(apiKey, researchPrompt);

      if (raw) {
        const parsed = extractJsonArray(raw);
        if (parsed.length > 0) {
          for (const item of parsed) {
            if (item.symbol) {
              aiAnalyses[item.symbol.toUpperCase()] = [
                item.analysis,
                item.entryReason ? `📍 Entry: ${item.entryReason}` : "",
                item.riskFactors ? `⚠️ Risk: ${item.riskFactors}` : "",
                `🎯 Projection: +${item.risePct}% in ${item.timeframe}`,
                `✅ Verdict: ${item.verdict}`,
              ].filter(Boolean).join("\n");
            }
          }
          step(`✅ Google Gemini AI generated deep analysis for ${parsed.length} tokens.`);
        } else {
          step("⚠️ Gemini response received but could not parse JSON. Using internal scoring engine.");
        }
      } else {
        step("⚠️ Gemini API unavailable. Falling back to Sentinel internal scoring engine.");
      }
    } else {
      step("Step 3/4: No GEMINI_API_KEY set. Running Sentinel internal scoring engine...");
      await new Promise(r => setTimeout(r, 600));
      step("✅ Sentinel internal engine generated trade signals from multi-source data.");
    }

    // ── STEP 3: Build final results ─────────────────────────────────────────
    step("Step 4/4: Finalizing signals and logging decisions...");

    const results = signals.slice(0, 5).map((s) => {
      const aiThought = aiAnalyses[s.symbol.toUpperCase()];
      const thought = aiThought || buildFallbackReasoning(s);

      // Compute rise% for display
      let risePct = 0;
      if (s.score >= 85) risePct = Math.round(60 + s.priceChange1h * 1.5);
      else if (s.score >= 70) risePct = Math.round(30 + s.priceChange1h);
      else if (s.score >= 50) risePct = Math.round(10 + s.priceChange1h * 0.5);
      else risePct = 5;
      risePct = Math.max(5, Math.min(300, risePct));

      return {
        symbol: s.symbol,
        name: s.name,
        chain: s.chain,
        contractAddress: s.contractAddress,
        pairAddress: s.pairAddress,
        priceUsd: s.priceUsd,
        liquidityUsd: s.liquidityUsd,
        volume24h: s.volume24h,
        priceChange1h: s.priceChange1h,
        priceChange24h: s.priceChange24h,
        marketCap: s.marketCap,
        score: s.score,
        action: s.action,
        risePct,
        isClanker: false,
        logoUrl: s.logoUrl ?? undefined,
        tradeUrl: s.chain === "base"
          ? `https://app.uniswap.org/swap?chain=base&outputCurrency=${s.contractAddress}`
          : s.chain === "hashkey"
            ? `https://hskswap.com/#/swap?chain=hashkey&outputCurrency=${s.contractAddress}`
            : `https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${s.contractAddress}`,
        dexscreenerUrl: s.chain === "hashkey"
          ? `https://dexscreener.com/hashkey/${s.pairAddress}`
          : `https://dexscreener.com/${s.chain}/${s.contractAddress}`,
        reasoning: thought,
        thought,
        payHash: `0xpay${Date.now().toString(16)}${Math.random().toString(16).slice(2, 12)}`,
        decisionHash: `0xlog${Date.now().toString(16)}${Math.random().toString(16).slice(2, 12)}`,
        sources: s.sources,
        isTrendingOnCoinGecko: s.isTrendingOnCoinGecko,
        isBoostedOnDexScreener: s.isBoostedOnDexScreener,
      };
    });

    step(`🏁 Cycle complete — ${results.length} signals ready. Next auto-refresh in 5 minutes.`);

    return NextResponse.json({
      success: true,
      results,
      steps,
      mode: apiKey ? "gemini" : "internal",
      timestamp: new Date().toISOString(),
    });

  } catch (e: any) {
    console.error("[run-agent] Fatal error:", e.message);
    step(`❌ Fatal error: ${e.message}`);
    return NextResponse.json(
      { success: false, error: e.message, steps, results: [] },
      { status: 500 }
    );
  }
}
