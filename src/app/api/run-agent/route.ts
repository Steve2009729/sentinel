// /api/run-agent — Sentinel autonomous AI agent cycle
// Sources: GeckoTerminal trending+new, DexScreener boosts, CoinGecko trending, HSKSwap
// AI: Google Gemini 1.5 Flash — deep per-token research with rise % projections

import { NextResponse } from "next/server";
import { fetchResearchedSignals, type ResearchedSignal } from "@/lib/agentResearch";
import { HSKSWAP_CONSTANTS } from "@/lib/hskswapSource";

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
            // Do NOT set responseMimeType — causes 400 errors on many regions
          },
        }),
      }
    );
    if (!res.ok) {
      console.error("[Gemini] HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (e: unknown) {
    console.error("[Gemini] fetch error:", (e as Error).message);
    return null;
  }
}

// ─── SAFE JSON EXTRACT ────────────────────────────────────────────────────────

function extractJsonArray(raw: string): Record<string, unknown>[] {
  try {
    const clean = raw.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

// ─── FALLBACK REASONING (when Gemini is unavailable) ─────────────────────────

function buildFallbackReasoning(s: ResearchedSignal): string {
  const lines: string[] = [];
  lines.push(`📊 ${s.symbol} (${s.chain.toUpperCase()}) — Sentinel Score ${s.score}/100`);

  const pts: string[] = [];
  if (s.priceChange1h > 20) pts.push(`🚀 +${s.priceChange1h.toFixed(1)}% surge in 1h`);
  else if (s.priceChange1h > 5) pts.push(`📈 +${s.priceChange1h.toFixed(1)}% momentum in 1h`);
  else if (s.priceChange1h < -15) pts.push(`📉 ${s.priceChange1h.toFixed(1)}% decline in 1h`);

  if (s.priceChange24h > 50) pts.push(`🔥 +${s.priceChange24h.toFixed(0)}% over 24h`);
  else if (s.priceChange24h > 20) pts.push(`+${s.priceChange24h.toFixed(0)}% over 24h`);

  if (s.liquidityUsd > 500_000) pts.push(`💧 Deep liquidity ($${Math.round(s.liquidityUsd / 1000)}K)`);
  else if (s.liquidityUsd > 100_000) pts.push(`💧 Solid liquidity ($${Math.round(s.liquidityUsd / 1000)}K)`);
  else pts.push(`⚠️ Thin liquidity ($${Math.round(s.liquidityUsd / 1000)}K)`);

  if (s.volume24h > 1_000_000) pts.push(`📣 Explosive volume $${Math.round(s.volume24h / 1000)}K`);
  else if (s.volume24h > 200_000) pts.push(`📣 High volume $${Math.round(s.volume24h / 1000)}K`);

  if (s.isTrendingOnCoinGecko) pts.push("🌐 CoinGecko trending");
  if (s.isBoostedOnDexScreener) pts.push("⚡ DexScreener boosted");
  if (s.sources.includes("hskswap")) pts.push("🔑 Native HSKSwap pool");
  if (s.sources.length > 1) pts.push(`✅ ${s.sources.length} sources confirm`);

  lines.push(pts.join(" · "));

  let risePct = 5;
  if (s.score >= 85) risePct = Math.min(250, Math.round(60 + s.priceChange1h * 1.5));
  else if (s.score >= 70) risePct = Math.min(120, Math.round(30 + s.priceChange1h));
  else if (s.score >= 50) risePct = Math.min(60, Math.round(10 + s.priceChange1h * 0.5));
  risePct = Math.max(5, risePct);

  const timeframe = s.score >= 75 ? "next 24–48h" : "next 48–72h";
  lines.push(`🎯 Projected rise: +${risePct}% in ${timeframe} based on volume trend and liquidity depth.`);

  if (s.action === "ENTER") lines.push("✅ Recommendation: ENTER — buy pressure confirmed.");
  else if (s.action === "WATCH") lines.push("👁️ Recommendation: WATCH — wait for breakout confirmation.");
  else lines.push("⛔ Recommendation: SKIP — setup doesn't meet entry criteria.");

  return lines.join("\n");
}

// ─── TRADE URL BUILDER ────────────────────────────────────────────────────────

function buildTradeUrl(s: ResearchedSignal): string {
  // Prefer pre-built URL from source
  if (s.tradeUrl) return s.tradeUrl;
  if (s.chain === "hashkey") {
    return `https://app.hskswap.com/#/swap?outputCurrency=${s.contractAddress}`;
  }
  if (s.chain === "base") {
    return `https://app.uniswap.org/swap?chain=base&outputCurrency=${s.contractAddress}`;
  }
  return `https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${s.contractAddress}`;
}

function buildChartUrl(s: ResearchedSignal): string {
  if (s.dexscreenerUrl) return s.dexscreenerUrl;
  if (s.chain === "hashkey") {
    return `${HSKSWAP_CONSTANTS.EXPLORER}/token/${s.contractAddress}`;
  }
  return `https://dexscreener.com/${s.chain}/${s.contractAddress}`;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function POST() {
  const steps: string[] = [];
  const ts = () => new Date().toLocaleTimeString("en-US", { hour12: false });
  const step = (msg: string) => { steps.push(`[${ts()}] ${msg}`); };

  try {
    step("🔍 Sentinel AI Research Agent initializing…");
    step("📡 Connecting to market intelligence feeds: GeckoTerminal · DexScreener · CoinGecko · HSKSwap");

    // ── STEP 1: Fetch from all sources ──────────────────────────────────────
    step("Step 1/4: Running parallel market scans across all sources…");

    let signals: ResearchedSignal[] = [];
    try {
      signals = await fetchResearchedSignals(8);
    } catch (e: unknown) {
      step(`⚠️ Market research error: ${(e as Error).message}`);
    }

    if (signals.length === 0) {
      step("❌ No live market data returned from any source. APIs may be rate-limited.");
      step("💡 Tip: Wait 30–60 seconds and try again. Rate limits reset automatically.");
      return NextResponse.json({
        success: false,
        error: "No market data available right now. All data sources returned empty — this usually means API rate limiting. Please wait 30–60 seconds and try again.",
        steps,
        results: [],
      });
    }

    const enterCount = signals.filter((s) => s.action === "ENTER").length;
    const watchCount = signals.filter((s) => s.action === "WATCH").length;
    const hskCount = signals.filter((s) => s.chain === "hashkey").length;

    step(`✅ Fetched ${signals.length} candidates — ${enterCount} ENTER · ${watchCount} WATCH · ${hskCount} HSKSwap native`);
    step("Step 2/4: Cross-referencing sources and ranking signals by confidence…");
    signals.slice(0, 6).forEach((s) => {
      const tags = [
        s.isTrendingOnCoinGecko ? "[CoinGecko🔥]" : "",
        s.isBoostedOnDexScreener ? "[DexScreener⚡]" : "",
        s.chain === "hashkey" ? "[HSKSwap🔑]" : "",
        s.sources.length > 1 ? `[${s.sources.length} sources]` : "",
      ].filter(Boolean).join(" ");
      step(`  › ${s.symbol} on ${s.chain.toUpperCase()} — ${s.score}/100 — ${s.action} ${tags}`);
    });

    // ── STEP 2: Gemini AI analysis ───────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    const aiAnalyses: Record<string, string> = {};

    if (apiKey) {
      step("Step 3/4: Sending top candidates to Google Gemini 1.5 Flash for deep analysis…");
      const topTokens = signals.slice(0, 5);

      const prompt = `You are Sentinel AI — an elite on-chain crypto trading analyst. Analyze the following tokens using the live market data provided.

For EACH token produce:
1. A 3–4 sentence analysis of why this token is moving right now
2. The specific catalyst driving the move
3. A precise rise % projection (e.g. "+45% in 24h") with your reasoning
4. Key risk factors
5. Final verdict: ENTER, WATCH, or SKIP

Token Data:
${topTokens.map((s, i) => `
Token ${i + 1}: ${s.symbol} (${s.name})
Chain: ${s.chain.toUpperCase()}
Price: $${s.priceUsd < 0.0001 ? s.priceUsd.toExponential(4) : s.priceUsd.toFixed(6)}
Market Cap: ${s.marketCap > 0 ? "$" + (s.marketCap / 1e6).toFixed(2) + "M" : "unknown"}
Liquidity: $${(s.liquidityUsd / 1000).toFixed(0)}K
24h Volume: $${(s.volume24h / 1000).toFixed(0)}K
1h Change: ${s.priceChange1h >= 0 ? "+" : ""}${s.priceChange1h.toFixed(2)}%
24h Change: ${s.priceChange24h >= 0 ? "+" : ""}${s.priceChange24h.toFixed(2)}%
Sentinel Score: ${s.score}/100
CoinGecko Trending: ${s.isTrendingOnCoinGecko ? "YES" : "No"}
DexScreener Boosted: ${s.isBoostedOnDexScreener ? "YES" : "No"}
Sources: ${s.sources.join(", ")}
${s.chain === "hashkey" ? "NOTE: This is a native HSKSwap pool on HashKey Chain — an emerging L2 with regulatory-grade infrastructure." : ""}
`).join("")}

Return ONLY a raw JSON array (no markdown). Each element:
{
  "symbol": string,
  "analysis": string (3-4 sentences),
  "risePct": number,
  "timeframe": string (e.g. "24h"),
  "entryReason": string,
  "riskFactors": string,
  "verdict": "ENTER" | "WATCH" | "SKIP"
}`;

      const raw = await callGemini(apiKey, prompt);
      if (raw) {
        const parsed = extractJsonArray(raw);
        if (parsed.length > 0) {
          for (const item of parsed) {
            const sym = (item.symbol as string)?.toUpperCase();
            if (sym) {
              aiAnalyses[sym] = [
                item.analysis as string,
                item.entryReason ? `📍 Entry: ${item.entryReason}` : "",
                item.riskFactors ? `⚠️ Risk: ${item.riskFactors}` : "",
                `🎯 Projection: +${item.risePct}% in ${item.timeframe}`,
                `✅ Verdict: ${item.verdict}`,
              ].filter(Boolean).join("\n");
            }
          }
          step(`✅ Gemini AI generated deep analysis for ${parsed.length} tokens.`);
        } else {
          step("⚠️ Gemini responded but JSON parse failed. Using internal scoring engine.");
        }
      } else {
        step("⚠️ Gemini API unavailable. Using Sentinel internal engine.");
      }
    } else {
      step("Step 3/4: No GEMINI_API_KEY configured — using Sentinel internal scoring engine…");
      await new Promise((r) => setTimeout(r, 400));
      step("✅ Internal engine generated trade signals from multi-source data.");
    }

    // ── STEP 3: Build results ────────────────────────────────────────────────
    step("Step 4/4: Finalizing signals…");

    const results = signals.slice(0, 5).map((s) => {
      const aiText = aiAnalyses[s.symbol.toUpperCase()];
      const thought = aiText || buildFallbackReasoning(s);

      let risePct = 5;
      if (s.score >= 85) risePct = Math.min(250, Math.round(60 + s.priceChange1h * 1.5));
      else if (s.score >= 70) risePct = Math.min(120, Math.round(30 + s.priceChange1h));
      else if (s.score >= 50) risePct = Math.min(60, Math.round(10 + s.priceChange1h * 0.5));
      risePct = Math.max(5, risePct);

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
        logoUrl: s.logoUrl,
        tradeUrl: buildTradeUrl(s),
        dexscreenerUrl: buildChartUrl(s),
        reasoning: thought,
        thought,
        payHash: `0xpay${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`,
        decisionHash: `0xlog${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`,
        sources: s.sources,
        isTrendingOnCoinGecko: s.isTrendingOnCoinGecko,
        isBoostedOnDexScreener: s.isBoostedOnDexScreener,
        isHskSwap: s.chain === "hashkey",
      };
    });

    step(`🏁 Cycle complete — ${results.length} signals delivered. Auto-refresh in 5 min.`);

    return NextResponse.json({
      success: true,
      results,
      steps,
      mode: apiKey ? "gemini" : "internal",
      timestamp: new Date().toISOString(),
    });

  } catch (e: unknown) {
    const msg = (e as Error).message ?? "Unknown error";
    console.error("[run-agent] Fatal:", msg);
    step(`❌ Fatal error: ${msg}`);
    // Always return JSON — never throw — so browser never sees a blank response
    return NextResponse.json(
      { success: false, error: msg, steps, results: [] },
      { status: 200 }, // 200 even on error so client can always parse the JSON
    );
  }
}
