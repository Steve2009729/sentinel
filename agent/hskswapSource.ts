/**
 * agent/hskswapSource.ts
 *
 * HSKSwap signal source — HashKey Chain's native Uniswap V3 fork.
 *
 * All addresses confirmed from @hskswap/sdk-core@1.0.3 and
 * @hskswap/smart-order-router@1.0.1 package sources (see PHASE_9_PROGRESS.md).
 *
 * Chain ID: 177
 * Subgraph:  https://graphnode.hashkeychain.net/subgraphs/name/hskswap
 * Factory:   0x972cA9D1662F5e029cD18327D29026532E84c742
 * SwapRouter02: 0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3
 * WHSK:      0xB210D2120d57b758EE163cFfb43e73728c471Cf1
 */

import type { TokenSignal } from "./signalSource";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const HSKSWAP = {
  CHAIN_ID: 177,
  CHAIN_NAME: "hashkey",
  RPC_URL: "https://mainnet.hsk.xyz",
  SUBGRAPH_URL: "https://graphnode.hashkeychain.net/subgraphs/name/hskswap",
  FACTORY: "0x972cA9D1662F5e029cD18327D29026532E84c742",
  SWAP_ROUTER_02: "0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3",
  WHSK: "0xB210D2120d57b758EE163cFfb43e73728c471Cf1",
  EXPLORER: "https://hashkey.blockscout.com",
} as const;

const FETCH_TIMEOUT_MS = 8000;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function gqlFetch(url: string, query: string, variables = {}): Promise<any> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0]?.message ?? "GraphQL error");
    return json.data;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// ─── SUBGRAPH QUERIES ─────────────────────────────────────────────────────────

// Fetch top pools by TVL + high recent volume
const TOP_POOLS_QUERY = `
  query TopPools($skip: Int) {
    pools(
      first: 20
      skip: $skip
      orderBy: volumeUSD
      orderDirection: desc
      where: { volumeUSD_gt: "0", liquidity_gt: "0" }
    ) {
      id
      token0 { id symbol name decimals }
      token1 { id symbol name decimals }
      token0Price
      token1Price
      feeTier
      sqrtPrice
      liquidity
      totalValueLockedUSD
      volumeUSD
      poolHourData(first: 2, orderBy: periodStartUnix, orderDirection: desc) {
        periodStartUnix
        volumeUSD
        open
        close
        high
        low
      }
    }
  }
`;

// Fetch newest pools by creation time
const NEW_POOLS_QUERY = `
  query NewPools {
    pools(
      first: 15
      orderBy: createdAtTimestamp
      orderDirection: desc
      where: { liquidity_gt: "0" }
    ) {
      id
      createdAtTimestamp
      token0 { id symbol name }
      token1 { id symbol name }
      token0Price
      token1Price
      feeTier
      totalValueLockedUSD
      volumeUSD
      poolHourData(first: 2, orderBy: periodStartUnix, orderDirection: desc) {
        periodStartUnix
        volumeUSD
        open
        close
      }
    }
  }
`;

// ─── POOL → SIGNAL CONVERSION ─────────────────────────────────────────────────

function safeNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * For each Uniswap V3 pool we pick the "interesting" token — the one that is
 * NOT the wrapped native token (WHSK). If both are interesting (neither is
 * WHSK) we pick token0 by default.
 */
function pickInterestingToken(pool: any): { symbol: string; name: string; address: string } {
  const whsk = HSKSWAP.WHSK.toLowerCase();
  if (pool.token0.id.toLowerCase() === whsk) {
    return { symbol: pool.token1.symbol, name: pool.token1.name, address: pool.token1.id };
  }
  return { symbol: pool.token0.symbol, name: pool.token0.name, address: pool.token0.id };
}

function poolToSignal(pool: any, source: "hskswap_top" | "hskswap_new"): TokenSignal | null {
  try {
    const token = pickInterestingToken(pool);
    if (!token.symbol || token.symbol === "???" || !token.address) return null;

    const liquidityUsd = safeNum(pool.totalValueLockedUSD);
    const volumeUsd = safeNum(pool.volumeUSD);

    // Calculate 1h price change from pool hour data
    let priceChange1h = 0;
    const hourData = pool.poolHourData ?? [];
    if (hourData.length >= 2) {
      const latest = safeNum(hourData[0].close);
      const prev   = safeNum(hourData[1].close);
      if (prev > 0) priceChange1h = ((latest - prev) / prev) * 100;
    }

    // Current price — token0Price is how many token1 per token0
    const priceRaw = safeNum(pool.token0Price);
    const priceUsd = priceRaw; // We don't have USD oracle here — show raw ratio

    // Age
    const ageHours = pool.createdAtTimestamp
      ? (Date.now() / 1000 - safeNum(pool.createdAtTimestamp)) / 3600
      : 8760; // if unknown, assume old

    // Score
    let score = 0;
    const reasons: string[] = [];

    if (liquidityUsd > 100_000) { score += 30; reasons.push("strong TVL"); }
    else if (liquidityUsd > 20_000) { score += 18; reasons.push("moderate TVL"); }
    else if (liquidityUsd > 5_000)  { score += 8;  reasons.push("low TVL"); }

    if (volumeUsd > 500_000) { score += 35; reasons.push("explosive HSKSwap volume"); }
    else if (volumeUsd > 100_000) { score += 25; reasons.push("high HSKSwap volume"); }
    else if (volumeUsd > 20_000)  { score += 12; reasons.push("building volume on HSKSwap"); }

    if (priceChange1h > 15) { score += 25; reasons.push("strong 1h momentum"); }
    else if (priceChange1h > 5) { score += 12; reasons.push("positive momentum"); }
    else if (priceChange1h < -15) { score -= 10; reasons.push("heavy 1h drop (caution)"); }

    if (source === "hskswap_new" && ageHours < 24 && volumeUsd > 5_000) {
      score += 18; reasons.push("🆕 new pool with early volume");
    } else if (ageHours < 72) {
      score += 6; reasons.push("recently launched");
    }

    // Native chain bonus — HSKSwap is the primary DEX, activity here is real
    score += 5;
    reasons.push("native HSKSwap (HashKey Chain)");

    score = Math.min(100, Math.max(0, score));
    const action = score >= 70 ? "ENTER" : score >= 45 ? "WATCH" : "SKIP";

    return {
      symbol: token.symbol,
      name: token.name,
      chain: "hashkey",
      priceUsd,
      liquidityUsd,
      volume24h: volumeUsd,
      priceChange1h,
      pairCreatedAt: pool.createdAtTimestamp ? safeNum(pool.createdAtTimestamp) * 1000 : Date.now(),
      ageHours,
      score,
      action,
      reasoning: reasons.join(", "),
      // Extended fields for UI
      contractAddress: token.address,
      pairAddress: pool.id,
      source: "hskswap",
      tradeUrl: `https://hskswap.com/#/swap?chain=hashkey&outputCurrency=${token.address}`,
      dexscreenerUrl: `https://dexscreener.com/hashkey/${pool.id}`,
      explorerUrl: `${HSKSWAP.EXPLORER}/token/${token.address}`,
    } as any;
  } catch {
    return null;
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export interface HskSwapPool {
  id: string;
  token0: { id: string; symbol: string; name: string };
  token1: { id: string; symbol: string; name: string };
  totalValueLockedUSD: string;
  volumeUSD: string;
  feeTier: string;
  createdAtTimestamp?: string;
}

/**
 * Fetch live HSKSwap pools from the GraphQL subgraph.
 * Returns top pools by volume + newest pools, deduplicated.
 */
export async function fetchHskSwapSignals(): Promise<TokenSignal[]> {
  const results: TokenSignal[] = [];
  const seen = new Set<string>();

  const addSignal = (s: TokenSignal | null) => {
    if (!s) return;
    const key = `${(s as any).contractAddress?.toLowerCase() ?? s.symbol}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(s);
    }
  };

  // Try top-volume pools
  try {
    const data = await gqlFetch(HSKSWAP.SUBGRAPH_URL, TOP_POOLS_QUERY, { skip: 0 });
    for (const pool of data?.pools ?? []) {
      addSignal(poolToSignal(pool, "hskswap_top"));
    }
  } catch (e: any) {
    console.error("[HSKSwap] Top pools subgraph error:", e.message);
  }

  // Try newest pools (additive, deduped)
  try {
    const data = await gqlFetch(HSKSWAP.SUBGRAPH_URL, NEW_POOLS_QUERY);
    for (const pool of data?.pools ?? []) {
      addSignal(poolToSignal(pool, "hskswap_new"));
    }
  } catch (e: any) {
    console.error("[HSKSwap] New pools subgraph error:", e.message);
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Quick connectivity check — returns true if the subgraph responds.
 */
export async function checkHskSwapSubgraph(): Promise<boolean> {
  try {
    const data = await gqlFetch(HSKSWAP.SUBGRAPH_URL, `{ pools(first: 1) { id } }`);
    return Array.isArray(data?.pools);
  } catch {
    return false;
  }
}
