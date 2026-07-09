// agentResearch.ts
// Multi-source real-time market intelligence for the AI Agent cycle.
// Pulls from DexScreener trending, GeckoTerminal top gainers/new pools,
// and CoinGecko trending — then cross-references to find the strongest signals.

import type { Signal } from "./types";

const T = 7000; // request timeout ms

async function safeFetch(url: string): Promise<any> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), T);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: { Accept: "application/json" } });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

// ─── SOURCE 1: DexScreener — trending pairs (Base + ETH) ─────────────────────
async function fetchDexScreenerTrending(): Promise<any[]> {
  const [base, eth] = await Promise.allSettled([
    safeFetch("https://api.dexscreener.com/token-boosts/top/v1"),
    safeFetch("https://api.dexscreener.com/token-boosts/latest/v1"),
  ]);

  const combined: any[] = [];
  for (const r of [base, eth]) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      r.value
        .filter((t: any) => t.chainId === "base" || t.chainId === "ethereum")
        .forEach((t: any) => combined.push(t));
    }
  }
  return combined;
}

// ─── SOURCE 2: GeckoTerminal — top gainers Base + ETH ────────────────────────
async function fetchGeckoTopGainers(): Promise<any[]> {
  const [base, eth] = await Promise.allSettled([
    safeFetch("https://api.geckoterminal.com/api/v2/networks/base/trending_pools?include=base_token&page=1"),
    safeFetch("https://api.geckoterminal.com/api/v2/networks/eth/trending_pools?include=base_token&page=1"),
  ]);

  const pools: any[] = [];
  const tokens: Record<string, any> = {};

  for (const [r, chain] of [[base, "base"], [eth, "ethereum"]] as const) {
    if (r.status !== "fulfilled" || !r.value?.data) continue;
    for (const pool of r.value.data) {
      (pool as any)._chain = chain;
      pools.push(pool);
    }
    for (const inc of r.value.included ?? []) {
      if (inc.type === "token") tokens[inc.id] = inc;
    }
  }

  return pools.map((p: any) => {
    const tokenId = p.relationships?.base_token?.data?.id;
    const token = tokens[tokenId];
    return {
      symbol: token?.attributes?.symbol ?? "???",
      name: token?.attributes?.name ?? "Unknown",
      contractAddress: token?.attributes?.address ?? "",
      chain: (p as any)._chain,
      priceUsd: parseFloat(p.attributes?.base_token_price_usd ?? "0") || 0,
      liquidityUsd: parseFloat(p.attributes?.reserve_in_usd ?? "0") || 0,
      volume24h: parseFloat(p.attributes?.volume_usd?.h24 ?? "0") || 0,
      priceChange1h: parseFloat(p.attributes?.price_change_percentage?.h1 ?? "0") || 0,
      priceChange24h: parseFloat(p.attributes?.price_change_percentage?.h24 ?? "0") || 0,
      marketCap: parseFloat(p.attributes?.fdv_usd ?? "0") || 0,
      pairAddress: p.attributes?.address ?? "",
      poolCreatedAt: p.attributes?.pool_created_at ?? null,
      logoUrl: token?.attributes?.image_url ?? null,
      source: "gecko_trending",
    };
  }).filter((t: any) => t.contractAddress?.startsWith("0x"));
}

// ─── SOURCE 3: GeckoTerminal — new pools (fresh launches) ────────────────────
async function fetchGeckoNewPools(): Promise<any[]> {
  const [base, eth] = await Promise.allSettled([
    safeFetch("https://api.geckoterminal.com/api/v2/networks/base/new_pools?include=base_token&sort=pool_created_at&page=1"),
    safeFetch("https://api.geckoterminal.com/api/v2/networks/eth/new_pools?include=base_token&sort=pool_created_at&page=1"),
  ]);

  const pools: any[] = [];
  const tokens: Record<string, any> = {};

  for (const [r, chain] of [[base, "base"], [eth, "ethereum"]] as const) {
    if (r.status !== "fulfilled" || !r.value?.data) continue;
    for (const pool of r.value.data) {
      (pool as any)._chain = chain;
      pools.push(pool);
    }
    for (const inc of r.value.included ?? []) {
      if (inc.type === "token") tokens[inc.id] = inc;
    }
  }

  return pools.map((p: any) => {
    const tokenId = p.relationships?.base_token?.data?.id;
    const token = tokens[tokenId];
    return {
      symbol: token?.attributes?.symbol ?? "???",
      name: token?.attributes?.name ?? "Unknown",
      contractAddress: token?.attributes?.address ?? "",
      chain: (p as any)._chain,
      priceUsd: parseFloat(p.attributes?.base_token_price_usd ?? "0") || 0,
      liquidityUsd: parseFloat(p.attributes?.reserve_in_usd ?? "0") || 0,
      volume24h: parseFloat(p.attributes?.volume_usd?.h24 ?? "0") || 0,
      priceChange1h: parseFloat(p.attributes?.price_change_percentage?.h1 ?? "0") || 0,
      priceChange24h: parseFloat(p.attributes?.price_change_percentage?.h24 ?? "0") || 0,
      marketCap: parseFloat(p.attributes?.fdv_usd ?? "0") || 0,
      pairAddress: p.attributes?.address ?? "",
      poolCreatedAt: p.attributes?.pool_created_at ?? null,
      logoUrl: token?.attributes?.image_url ?? null,
      source: "gecko_new",
    };
  }).filter((t: any) => t.contractAddress?.startsWith("0x"));
}

// ─── SOURCE 4: CoinGecko trending coins ──────────────────────────────────────
async function fetchCoinGeckoTrending(): Promise<string[]> {
  const data = await safeFetch("https://api.coingecko.com/api/v3/search/trending");
  if (!data?.coins) return [];
  return data.coins.slice(0, 10).map((c: any) => c.item?.symbol?.toUpperCase() ?? "");
}

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────

function scoreToken(t: any, trendingSymbols: Set<string>, boostedAddrs: Set<string>): number {
  let score = 0;

  // Liquidity
  if (t.liquidityUsd > 500_000) score += 28;
  else if (t.liquidityUsd > 100_000) score += 20;
  else if (t.liquidityUsd > 50_000) score += 14;
  else if (t.liquidityUsd > 10_000) score += 7;

  // Volume
  if (t.volume24h > 1_000_000) score += 30;
  else if (t.volume24h > 200_000) score += 22;
  else if (t.volume24h > 50_000) score += 14;
  else if (t.volume24h > 10_000) score += 7;

  // Momentum (1h)
  if (t.priceChange1h > 30) score += 25;
  else if (t.priceChange1h > 15) score += 18;
  else if (t.priceChange1h > 5) score += 10;
  else if (t.priceChange1h < -20) score -= 15;
  else if (t.priceChange1h < -10) score -= 8;

  // 24h trend
  if (t.priceChange24h > 50) score += 10;
  else if (t.priceChange24h > 20) score += 6;
  else if (t.priceChange24h < -30) score -= 8;

  // Cross-source signals
  if (trendingSymbols.has(t.symbol?.toUpperCase())) score += 15; // CoinGecko trending
  if (boostedAddrs.has(t.contractAddress?.toLowerCase())) score += 12; // DexScreener boosted
  if (t.source === "gecko_trending") score += 8;

  // Freshness (new pool with activity = very bullish)
  if (t.poolCreatedAt) {
    const ageH = (Date.now() - new Date(t.poolCreatedAt).getTime()) / 3_600_000;
    if (ageH < 2 && t.volume24h > 20_000) score += 20;
    else if (ageH < 12 && t.volume24h > 50_000) score += 14;
    else if (ageH < 48) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

// ─── PUBLIC: fetchResearchedSignals ──────────────────────────────────────────

export interface ResearchedSignal {
  symbol: string;
  name: string;
  chain: string;
  contractAddress: string;
  pairAddress: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  priceChange1h: number;
  priceChange24h: number;
  marketCap: number;
  score: number;
  action: string;
  sources: string[];
  isTrendingOnCoinGecko: boolean;
  isBoostedOnDexScreener: boolean;
  logoUrl?: string;
}

export async function fetchResearchedSignals(limit = 8): Promise<ResearchedSignal[]> {
  const [trending, newPools, dexBoosted, cgTrending] = await Promise.allSettled([
    fetchGeckoTopGainers(),
    fetchGeckoNewPools(),
    fetchDexScreenerTrending(),
    fetchCoinGeckoTrending(),
  ]);

  const cgSymbols = new Set<string>(cgTrending.status === "fulfilled" ? cgTrending.value : []);

  const boostedAddrs = new Set<string>();
  if (dexBoosted.status === "fulfilled") {
    dexBoosted.value.forEach((t: any) => {
      if (t.tokenAddress) boostedAddrs.add(t.tokenAddress.toLowerCase());
    });
  }

  // Merge all tokens, deduping by contractAddress
  const allTokens: Record<string, any> = {};

  const addTokens = (list: any[], source: string) => {
    if (!Array.isArray(list)) return;
    for (const t of list) {
      if (!t.contractAddress?.startsWith("0x")) continue;
      const key = t.contractAddress.toLowerCase();
      if (allTokens[key]) {
        allTokens[key].sources.push(source);
      } else {
        allTokens[key] = { ...t, sources: [source] };
      }
    }
  };

  if (trending.status === "fulfilled") addTokens(trending.value, "gecko_trending");
  if (newPools.status === "fulfilled") addTokens(newPools.value, "gecko_new");

  // Score and rank
  const scored = Object.values(allTokens).map((t: any) => {
    const score = scoreToken(t, cgSymbols, boostedAddrs);
    const action = score >= 70 ? "ENTER" : score >= 45 ? "WATCH" : "SKIP";
    return {
      ...t,
      score,
      action,
      isTrendingOnCoinGecko: cgSymbols.has(t.symbol?.toUpperCase()),
      isBoostedOnDexScreener: boostedAddrs.has(t.contractAddress?.toLowerCase()),
    } as ResearchedSignal;
  });

  // Sort: ENTER first, then by score
  scored.sort((a, b) => {
    if (a.action === "ENTER" && b.action !== "ENTER") return -1;
    if (b.action === "ENTER" && a.action !== "ENTER") return 1;
    return b.score - a.score;
  });

  return scored.slice(0, limit);
}
