// agentResearch.ts
// Multi-source real-time market intelligence for the AI Agent cycle.
// Sources: DexScreener boosts, GeckoTerminal trending/new pools,
//          CoinGecko trending, HSKSwap (HashKey Chain native DEX).

// ⚠️ IMPORTANT: Only import from within src/ — agent/ directory is NOT
//               bundled by Next.js and cannot be imported in API routes.
import { fetchHskSwapSignals, type HskSwapSignal } from "./hskswapSource";

const TIMEOUT_MS = 7000;

async function safeFetch(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

// ─── SOURCE 1: DexScreener trending (Base + ETH) ─────────────────────────────

async function fetchDexScreenerTrending(): Promise<Record<string, unknown>[]> {
  const [top, latest] = await Promise.allSettled([
    safeFetch("https://api.dexscreener.com/token-boosts/top/v1"),
    safeFetch("https://api.dexscreener.com/token-boosts/latest/v1"),
  ]);
  const combined: Record<string, unknown>[] = [];
  for (const r of [top, latest]) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      (r.value as Record<string, unknown>[])
        .filter((t) => t.chainId === "base" || t.chainId === "ethereum")
        .forEach((t) => combined.push(t));
    }
  }
  return combined;
}

// ─── SOURCE 2: GeckoTerminal trending pools ───────────────────────────────────

async function fetchGeckoTrending(): Promise<Record<string, unknown>[]> {
  const [base, eth] = await Promise.allSettled([
    safeFetch("https://api.geckoterminal.com/api/v2/networks/base/trending_pools?include=base_token&page=1"),
    safeFetch("https://api.geckoterminal.com/api/v2/networks/eth/trending_pools?include=base_token&page=1"),
  ]);
  return buildGeckoTokenList([base, eth], ["base", "ethereum"]);
}

// ─── SOURCE 3: GeckoTerminal new pools ───────────────────────────────────────

async function fetchGeckoNew(): Promise<Record<string, unknown>[]> {
  const [base, eth] = await Promise.allSettled([
    safeFetch("https://api.geckoterminal.com/api/v2/networks/base/new_pools?include=base_token&sort=pool_created_at&page=1"),
    safeFetch("https://api.geckoterminal.com/api/v2/networks/eth/new_pools?include=base_token&sort=pool_created_at&page=1"),
  ]);
  return buildGeckoTokenList([base, eth], ["base", "ethereum"]);
}

function buildGeckoTokenList(
  results: PromiseSettledResult<unknown>[],
  chains: string[],
): Record<string, unknown>[] {
  const pools: Record<string, unknown>[] = [];
  const tokens: Record<string, Record<string, unknown>> = {};

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const chain = chains[i];
    if (r.status !== "fulfilled" || !(r.value as Record<string, unknown>)?.data) continue;
    const data = r.value as { data: Record<string, unknown>[]; included?: Record<string, unknown>[] };
    for (const pool of data.data ?? []) {
      (pool as Record<string, unknown>)._chain = chain;
      pools.push(pool);
    }
    for (const inc of data.included ?? []) {
      if (inc.type === "token") tokens[inc.id as string] = inc;
    }
  }

  return pools.map((p) => {
    const tokenId = (p.relationships as Record<string, unknown> | undefined)
      ?.base_token
      ? ((p.relationships as Record<string, Record<string, Record<string, string>>>)
          .base_token?.data?.id ?? "")
      : "";
    const token = tokens[tokenId];
    const attrs = (p.attributes as Record<string, unknown>) ?? {};
    const tAttrs = (token?.attributes as Record<string, unknown>) ?? {};
    return {
      symbol: tAttrs.symbol ?? "???",
      name: tAttrs.name ?? "Unknown",
      contractAddress: tAttrs.address ?? "",
      chain: p._chain,
      priceUsd: parseFloat((attrs.base_token_price_usd as string) ?? "0") || 0,
      liquidityUsd: parseFloat((attrs.reserve_in_usd as string) ?? "0") || 0,
      volume24h: parseFloat(((attrs.volume_usd as Record<string, string>)?.h24) ?? "0") || 0,
      priceChange1h: parseFloat(((attrs.price_change_percentage as Record<string, string>)?.h1) ?? "0") || 0,
      priceChange24h: parseFloat(((attrs.price_change_percentage as Record<string, string>)?.h24) ?? "0") || 0,
      marketCap: parseFloat((attrs.fdv_usd as string) ?? "0") || 0,
      pairAddress: attrs.address ?? "",
      poolCreatedAt: attrs.pool_created_at ?? null,
      logoUrl: tAttrs.image_url ?? null,
      source: "gecko",
    };
  }).filter((t) => typeof t.contractAddress === "string" && (t.contractAddress as string).startsWith("0x"));
}

// ─── SOURCE 4: CoinGecko trending ────────────────────────────────────────────

async function fetchCoinGeckoTrending(): Promise<string[]> {
  const data = await safeFetch("https://api.coingecko.com/api/v3/search/trending") as Record<string, unknown> | null;
  if (!data?.coins) return [];
  return (data.coins as { item: { symbol: string } }[])
    .slice(0, 10)
    .map((c) => c.item?.symbol?.toUpperCase() ?? "")
    .filter(Boolean);
}

// ─── SCORING ─────────────────────────────────────────────────────────────────

function scoreGeckoToken(
  t: Record<string, unknown>,
  cgSymbols: Set<string>,
  boostedAddrs: Set<string>,
): number {
  let score = 0;
  const liq = t.liquidityUsd as number;
  const vol = t.volume24h as number;
  const ch1 = t.priceChange1h as number;
  const ch24 = t.priceChange24h as number;

  if (liq > 500_000) score += 28;
  else if (liq > 100_000) score += 20;
  else if (liq > 50_000) score += 14;
  else if (liq > 10_000) score += 7;

  if (vol > 1_000_000) score += 30;
  else if (vol > 200_000) score += 22;
  else if (vol > 50_000) score += 14;
  else if (vol > 10_000) score += 7;

  if (ch1 > 30) score += 25;
  else if (ch1 > 15) score += 18;
  else if (ch1 > 5) score += 10;
  else if (ch1 < -20) score -= 15;
  else if (ch1 < -10) score -= 8;

  if (ch24 > 50) score += 10;
  else if (ch24 > 20) score += 6;
  else if (ch24 < -30) score -= 8;

  const sym = (t.symbol as string)?.toUpperCase() ?? "";
  const addr = (t.contractAddress as string)?.toLowerCase() ?? "";
  if (cgSymbols.has(sym)) score += 15;
  if (boostedAddrs.has(addr)) score += 12;
  if (t.source === "gecko_trending") score += 8;

  if (t.poolCreatedAt) {
    const ageH = (Date.now() - new Date(t.poolCreatedAt as string).getTime()) / 3_600_000;
    if (ageH < 2 && vol > 20_000) score += 20;
    else if (ageH < 12 && vol > 50_000) score += 14;
    else if (ageH < 48) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

// ─── PUBLIC EXPORT ────────────────────────────────────────────────────────────

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
  // For HSKSwap signals
  tradeUrl?: string;
  dexscreenerUrl?: string;
  explorerUrl?: string;
}

export async function fetchResearchedSignals(limit = 8): Promise<ResearchedSignal[]> {
  // Run all sources in parallel — no source can block others
  const [trendingR, newR, dexR, cgR, hskR] = await Promise.allSettled([
    fetchGeckoTrending(),
    fetchGeckoNew(),
    fetchDexScreenerTrending(),
    fetchCoinGeckoTrending(),
    fetchHskSwapSignals(),
  ]);

  // Build lookup sets
  const cgSymbols = new Set<string>(cgR.status === "fulfilled" ? cgR.value : []);
  const boostedAddrs = new Set<string>();
  if (dexR.status === "fulfilled") {
    for (const t of dexR.value) {
      if (t.tokenAddress) boostedAddrs.add((t.tokenAddress as string).toLowerCase());
    }
  }

  // Merge Gecko tokens, dedup by contractAddress
  const geckoMap: Record<string, Record<string, unknown>> = {};
  function addGecko(list: Record<string, unknown>[], source: string) {
    if (!Array.isArray(list)) return;
    for (const t of list) {
      const addr = (t.contractAddress as string)?.toLowerCase();
      if (!addr?.startsWith("0x")) continue;
      if (geckoMap[addr]) {
        (geckoMap[addr].sources as string[]).push(source);
      } else {
        geckoMap[addr] = { ...t, sources: [source] };
      }
    }
  }
  if (trendingR.status === "fulfilled") addGecko(trendingR.value, "gecko_trending");
  if (newR.status === "fulfilled") addGecko(newR.value, "gecko_new");

  // Score Gecko tokens
  const geckoScored: ResearchedSignal[] = Object.values(geckoMap).map((t) => {
    const score = scoreGeckoToken(t, cgSymbols, boostedAddrs);
    const action = score >= 70 ? "ENTER" : score >= 45 ? "WATCH" : "SKIP";
    return {
      symbol: t.symbol as string,
      name: t.name as string,
      chain: t.chain as string,
      contractAddress: t.contractAddress as string,
      pairAddress: (t.pairAddress as string) ?? "",
      priceUsd: t.priceUsd as number,
      liquidityUsd: t.liquidityUsd as number,
      volume24h: t.volume24h as number,
      priceChange1h: t.priceChange1h as number,
      priceChange24h: t.priceChange24h as number,
      marketCap: t.marketCap as number,
      score,
      action,
      sources: t.sources as string[],
      isTrendingOnCoinGecko: cgSymbols.has((t.symbol as string)?.toUpperCase()),
      isBoostedOnDexScreener: boostedAddrs.has((t.contractAddress as string)?.toLowerCase()),
      logoUrl: (t.logoUrl as string) ?? undefined,
    };
  });

  // Convert HSKSwap signals
  const hskScored: ResearchedSignal[] = [];
  if (hskR.status === "fulfilled") {
    for (const s of hskR.value as HskSwapSignal[]) {
      // Skip WHSK itself — not interesting as a trade target
      if (s.symbol === "WHSK") continue;
      hskScored.push({
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
        sources: ["hskswap"],
        isTrendingOnCoinGecko: false,
        isBoostedOnDexScreener: false,
        logoUrl: undefined,
        tradeUrl: s.tradeUrl,
        explorerUrl: s.explorerUrl,
        dexscreenerUrl: s.dexscreenerUrl,
      });
    }
  }

  // Combine + sort: ENTER first, then score
  const all = [...geckoScored, ...hskScored];
  all.sort((a, b) => {
    if (a.action === "ENTER" && b.action !== "ENTER") return -1;
    if (b.action === "ENTER" && a.action !== "ENTER") return 1;
    return b.score - a.score;
  });

  const final = all.slice(0, limit);

  // Safety net: if all sources failed, return empty (API route handles fallback)
  return final;
}
