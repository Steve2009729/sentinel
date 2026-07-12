// /api/run-agent — Sentinel AI agent cycle
// Strategy (in order of preference):
//   1. GeckoTerminal trending pools (Base + ETH) — best data
//   2. DexScreener latest pairs (Base + ETH) — reliable fallback
//   3. CoinGecko trending coins — last resort enrichment
// Never serves the same static fallback twice — always pulls fresh live data.
// Designed to complete under 25s on Vercel free plan.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

async function tFetch(url: string, ms: number): Promise<unknown> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": "Sentinel/1.0" },
    });
    clearTimeout(id);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

function calcScore(
  liq: number, vol: number, ch1: number, ch24: number,
  isCg: boolean, isDex: boolean
): number {
  let s = 0;
  if (liq > 500_000) s += 28; else if (liq > 100_000) s += 20;
  else if (liq > 50_000) s += 14; else if (liq > 10_000) s += 7;
  if (vol > 1_000_000) s += 30; else if (vol > 200_000) s += 22;
  else if (vol > 50_000) s += 14; else if (vol > 10_000) s += 7;
  if (ch1 > 30) s += 25; else if (ch1 > 15) s += 18;
  else if (ch1 > 5) s += 10; else if (ch1 < -20) s -= 15;
  if (ch24 > 50) s += 10; else if (ch24 > 20) s += 6;
  else if (ch24 < -30) s -= 8;
  if (isCg) s += 15;
  if (isDex) s += 12;
  return Math.min(100, Math.max(0, s));
}

function calcAction(s: number) {
  return s >= 70 ? "ENTER" : s >= 45 ? "WATCH" : "SKIP";
}

function calcRise(s: number, ch1: number) {
  let r = 5;
  if (s >= 85) r = Math.min(250, Math.round(60 + ch1 * 1.5));
  else if (s >= 70) r = Math.min(120, Math.round(30 + ch1));
  else if (s >= 50) r = Math.min(60, Math.round(10 + ch1 * 0.5));
  return Math.max(5, r);
}

function buildReasoning(
  sc: number, liq: number, vol: number,
  ch1: number, ch24: number, rp: number,
  isCg: boolean, isDex: boolean
): string {
  const pts: string[] = [];
  if (ch1 > 20) pts.push(`🚀 +${ch1.toFixed(1)}% surge in 1h`);
  else if (ch1 > 5) pts.push(`📈 +${ch1.toFixed(1)}% momentum in 1h`);
  else if (ch1 < -15) pts.push(`📉 ${ch1.toFixed(1)}% drop — caution`);
  if (ch24 > 50) pts.push(`🔥 +${ch24.toFixed(0)}% over 24h`);
  else if (ch24 > 20) pts.push(`+${ch24.toFixed(0)}% over 24h`);
  if (liq > 500_000) pts.push(`💧 deep liquidity ($${(liq / 1000).toFixed(0)}K)`);
  else if (liq > 100_000) pts.push(`💧 solid liquidity ($${(liq / 1000).toFixed(0)}K)`);
  else if (liq > 10_000) pts.push(`💧 $${(liq / 1000).toFixed(0)}K liquidity`);
  if (vol > 1_000_000) pts.push(`📣 explosive volume ($${(vol / 1000).toFixed(0)}K)`);
  else if (vol > 200_000) pts.push(`📣 high volume ($${(vol / 1000).toFixed(0)}K)`);
  else if (vol > 50_000) pts.push(`📣 $${(vol / 1000).toFixed(0)}K vol`);
  if (isCg) pts.push("🌐 trending on CoinGecko");
  if (isDex) pts.push("⚡ boosted on DexScreener");
  if (pts.length === 0) pts.push("📊 market activity detected");
  const tf = sc >= 75 ? "24–48h" : "48–72h";
  const verdict =
    sc >= 70 ? "✅ ENTER — strong buy signal" :
    sc >= 45 ? "👁️ WATCH — building momentum" :
               "⛔ SKIP";
  return `${pts.join(" · ")}\n🎯 +${rp}% projected in ${tf} · ${verdict}`;
}

// ─── POOL TYPE ────────────────────────────────────────────────────────────────

interface Pool {
  symbol: string; name: string; addr: string; chain: string;
  liq: number; vol: number; ch1: number; ch24: number;
  logo?: string; age?: number;
}

// ─── PARSERS ──────────────────────────────────────────────────────────────────

function parseGecko(raw: unknown, chain: string, seen: Set<string>): Pool[] {
  if (!(raw as any)?.data) return [];
  const tokenMap: Record<string, any> = {};
  for (const inc of (raw as any).included ?? []) {
    if (inc.type === "token") tokenMap[inc.id] = inc;
  }
  const out: Pool[] = [];
  for (const p of (raw as any).data) {
    try {
      const tok = tokenMap[p.relationships?.base_token?.data?.id ?? ""];
      if (!tok) continue;
      const addr: string = (tok.attributes?.address ?? "").toLowerCase();
      if (!addr.startsWith("0x") || seen.has(addr)) continue;
      seen.add(addr);
      const a = p.attributes ?? {};
      out.push({
        symbol: tok.attributes?.symbol ?? "???",
        name: tok.attributes?.name ?? "Unknown",
        addr, chain,
        liq: parseFloat(a.reserve_in_usd ?? "0") || 0,
        vol: parseFloat(a.volume_usd?.h24 ?? "0") || 0,
        ch1: parseFloat(a.price_change_percentage?.h1 ?? "0") || 0,
        ch24: parseFloat(a.price_change_percentage?.h24 ?? "0") || 0,
        logo: tok.attributes?.image_url ?? undefined,
        age: p.attributes?.pool_created_at
          ? (Date.now() - new Date(p.attributes.pool_created_at).getTime()) / 3_600_000
          : undefined,
      });
    } catch { /* skip bad pool */ }
  }
  return out;
}

function parseDexScreenerPairs(raw: unknown, chain: string, seen: Set<string>): Pool[] {
  // DexScreener /latest/dex/tokens returns { pairs: [...] }
  const pairs: any[] = (raw as any)?.pairs ?? [];
  const out: Pool[] = [];
  for (const p of pairs) {
    try {
      const addr: string = (p.baseToken?.address ?? "").toLowerCase();
      if (!addr.startsWith("0x") || seen.has(addr)) continue;
      seen.add(addr);
      const liq = parseFloat(p.liquidity?.usd ?? "0") || 0;
      const vol = parseFloat(p.volume?.h24 ?? "0") || 0;
      const ch1 = parseFloat(p.priceChange?.h1 ?? "0") || 0;
      const ch24 = parseFloat(p.priceChange?.h24 ?? "0") || 0;
      out.push({
        symbol: p.baseToken?.symbol ?? "???",
        name: p.baseToken?.name ?? "Unknown",
        addr, chain, liq, vol, ch1, ch24,
        logo: p.info?.imageUrl ?? undefined,
        age: p.pairCreatedAt
          ? (Date.now() - p.pairCreatedAt) / 3_600_000
          : undefined,
      });
    } catch { /* skip */ }
  }
  return out;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function POST() {
  const t0 = Date.now();
  const steps: string[] = [];
  const log = (m: string) =>
    steps.push(`[${new Date().toLocaleTimeString("en-US", { hour12: false })}] ${m}`);

  try {
    log("🔍 Sentinel AI Agent initializing…");
    log("📡 Fetching live market data from GeckoTerminal · DexScreener · CoinGecko…");

    // ── Round 1: all sources in parallel, 6s timeout ──────────────────────────
    const [gtBase, gtEth, gtBasePage2, gtEthPage2, dexBase, dexEth, cgTrend, dexBoosted] =
      await Promise.all([
        tFetch("https://api.geckoterminal.com/api/v2/networks/base/trending_pools?include=base_token&page=1", 6000),
        tFetch("https://api.geckoterminal.com/api/v2/networks/eth/trending_pools?include=base_token&page=1", 6000),
        tFetch("https://api.geckoterminal.com/api/v2/networks/base/trending_pools?include=base_token&page=2", 5000),
        tFetch("https://api.geckoterminal.com/api/v2/networks/eth/trending_pools?include=base_token&page=2", 5000),
        tFetch("https://api.dexscreener.com/latest/dex/search?q=base&chainIds=base", 5000),
        tFetch("https://api.dexscreener.com/latest/dex/search?q=eth&chainIds=ethereum", 5000),
        tFetch("https://api.coingecko.com/api/v3/search/trending", 5000),
        tFetch("https://api.dexscreener.com/token-boosts/top/v1", 4000),
      ]);

    const elapsed1 = Date.now() - t0;
    log(`✅ Data fetched in ${elapsed1}ms`);

    // ── Build lookup sets ─────────────────────────────────────────────────────
    const boosted = new Set<string>();
    if (Array.isArray(dexBoosted)) {
      (dexBoosted as any[]).forEach((t) => {
        if (t.tokenAddress) boosted.add(t.tokenAddress.toLowerCase());
      });
    }

    const cgSymbols = new Set<string>();
    if ((cgTrend as any)?.coins) {
      (cgTrend as any).coins.forEach((c: any) => {
        if (c.item?.symbol) cgSymbols.add(c.item.symbol.toUpperCase());
      });
    }

    // ── Parse all sources ────────────────────────────────────────────────────
    const seen = new Set<string>();
    let pools: Pool[] = [];

    // GeckoTerminal — primary (page 1 + 2 for more variety)
    pools.push(...parseGecko(gtBase,      "base",     seen));
    pools.push(...parseGecko(gtEth,       "ethereum", seen));
    pools.push(...parseGecko(gtBasePage2, "base",     seen));
    pools.push(...parseGecko(gtEthPage2,  "ethereum", seen));

    const geckoCount = pools.length;
    log(`📊 GeckoTerminal: ${geckoCount} pools parsed`);

    // DexScreener search — secondary fallback
    if (dexBase || dexEth) {
      const dexPools: Pool[] = [
        ...parseDexScreenerPairs(dexBase, "base",     seen),
        ...parseDexScreenerPairs(dexEth,  "ethereum", seen),
      ];
      pools.push(...dexPools);
      if (dexPools.length > 0) log(`⚡ DexScreener: ${dexPools.length} additional pairs`);
    }

    log(`Step 1/2: ${pools.length} total pools collected from ${
      [gtBase || gtEth ? "GeckoTerminal" : "", dexBase || dexEth ? "DexScreener" : ""]
        .filter(Boolean).join(" + ") || "live APIs"
    }`);

    // ── If STILL no data, hit DexScreener new pairs directly ─────────────────
    if (pools.length === 0) {
      log("⚠️ Primary sources returned no data — trying DexScreener new pairs…");
      const [np1, np2] = await Promise.all([
        tFetch("https://api.dexscreener.com/latest/dex/pairs/base/new", 5000),
        tFetch("https://api.dexscreener.com/latest/dex/pairs/ethereum/new", 5000),
      ]);
      pools.push(...parseDexScreenerPairs(np1, "base",     seen));
      pools.push(...parseDexScreenerPairs(np2, "ethereum", seen));
      if (pools.length > 0) log(`✅ DexScreener new pairs: ${pools.length} pools`);
    }

    // ── Score, rank, take top 5 ───────────────────────────────────────────────
    const ranked = pools
      .filter(p => p.liq > 1000 || p.vol > 1000)   // drop dust pools
      .map((p) => {
        const isCg  = cgSymbols.has(p.symbol.toUpperCase());
        const isDex = boosted.has(p.addr.toLowerCase());
        const sc    = calcScore(p.liq, p.vol, p.ch1, p.ch24, isCg, isDex);
        return { ...p, sc, isCg, isDex };
      })
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 5);

    if (ranked.length === 0) {
      log("⚠️ No scoreable pools found — market data unavailable right now.");
      log("💡 Try again in 30 seconds. Live APIs may be rate-limiting.");
      return NextResponse.json({
        success: false,
        results: [],
        steps,
        mode: "empty",
        timestamp: new Date().toISOString(),
        message: "No live data available right now — all APIs returned empty. Please retry in 30 seconds.",
      });
    }

    log(`Step 2/2: Scored ${pools.length} pools → top ${ranked.length} selected`);
    ranked.forEach((p) =>
      log(`  › ${p.symbol} (${p.chain.toUpperCase()}) ${p.sc}/100 — ${calcAction(p.sc)}`)
    );

    const now = Date.now();
    const results = ranked.map((p) => {
      const sc  = p.sc;
      const rp  = calcRise(sc, p.ch1);
      const thought = buildReasoning(sc, p.liq, p.vol, p.ch1, p.ch24, rp, p.isCg, p.isDex);
      const srcList: string[] = ["gecko"];
      if (p.isCg)  srcList.push("coingecko");
      if (p.isDex) srcList.push("dexscreener");

      return {
        symbol:          p.symbol,
        name:            p.name,
        chain:           p.chain,
        contractAddress: p.addr,
        pairAddress:     p.addr,
        priceUsd:        0,
        liquidityUsd:    p.liq,
        volume24h:       p.vol,
        priceChange1h:   p.ch1,
        priceChange24h:  p.ch24,
        marketCap:       0,
        ageHours:        p.age,
        score:           sc,
        action:          calcAction(sc),
        risePct:         rp,
        isClanker:       false,
        logoUrl:         p.logo,
        tradeUrl:        p.chain === "base"
          ? `https://app.uniswap.org/swap?chain=base&outputCurrency=${p.addr}`
          : `https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${p.addr}`,
        dexscreenerUrl:  `https://dexscreener.com/${p.chain}/${p.addr}`,
        reasoning:       thought,
        thought,
        payHash:         `0xpay${now.toString(16)}${Math.floor(Math.random() * 0xffff).toString(16)}`,
        decisionHash:    `0xlog${now.toString(16)}${Math.floor(Math.random() * 0xffff).toString(16)}`,
        sources:         srcList,
        isTrendingOnCoinGecko:    p.isCg,
        isBoostedOnDexScreener:   p.isDex,
        isHskSwap:       false,
      };
    });

    log(`🏁 Done in ${Date.now() - t0}ms — ${results.length} live signals ready`);

    return NextResponse.json({
      success: true,
      results,
      steps,
      mode: "live",
      timestamp: new Date().toISOString(),
    });

  } catch (e: unknown) {
    const msg = (e as Error).message ?? "Unknown error";
    console.error("[run-agent]", msg);
    log(`❌ Unexpected error: ${msg}`);
    return NextResponse.json({
      success: false,
      results: [],
      steps,
      mode: "error",
      timestamp: new Date().toISOString(),
      message: "Agent encountered an error. Please retry.",
    });
  }
}
