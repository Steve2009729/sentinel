/**
 * src/lib/hskswapSource.ts
 *
 * HSKSwap live signal source — HashKey Chain's native Uniswap V3 DEX.
 * Lives inside src/lib/ so Next.js API routes can import it correctly.
 *
 * All contract addresses sourced directly from @hskswap/sdk-core@1.0.3
 * and @hskswap/smart-order-router@1.0.1 npm packages (see PHASE_9_PROGRESS.md).
 *
 * Chain ID    : 177
 * Factory     : 0x972cA9D1662F5e029cD18327D29026532E84c742
 * SwapRouter02: 0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3
 * WHSK        : 0xB210D2120d57b758EE163cFfb43e73728c471Cf1
 * Subgraph    : https://graphnode.hashkeychain.net/subgraphs/name/hskswap
 */

export const HSKSWAP_CONSTANTS = {
  CHAIN_ID: 177,
  CHAIN_NAME: "hashkey",
  RPC_URL: "https://mainnet.hsk.xyz",
  SUBGRAPH_URL: "https://graphnode.hashkeychain.net/subgraphs/name/hskswap",
  FACTORY: "0x972cA9D1662F5e029cD18327D29026532E84c742",
  SWAP_ROUTER_02: "0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3",
  WHSK: "0xB210D2120d57b758EE163cFfb43e73728c471Cf1",
  EXPLORER: "https://hashkey.blockscout.com",
} as const;

// ─── RAW SIGNAL SHAPE returned from this module ──────────────────────────────

export interface HskSwapSignal {
  symbol: string;
  name: string;
  chain: "hashkey";
  contractAddress: string;
  pairAddress: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  priceChange1h: number;
  priceChange24h: number;
  marketCap: number;
  ageHours: number;
  score: number;
  action: string;
  reasoning: string;
  source: "hskswap";
  tradeUrl: string;
  explorerUrl: string;
  dexscreenerUrl: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 8000;

async function gqlFetch(url: string, query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);
    const json = await res.json() as { errors?: { message: string }[]; data?: unknown };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickToken(pool: {
  token0: { id: string; symbol: string; name: string };
  token1: { id: string; symbol: string; name: string };
}): { id: string; symbol: string; name: string } {
  const whsk = HSKSWAP_CONSTANTS.WHSK.toLowerCase();
  if (pool.token0.id.toLowerCase() === whsk) return pool.token1;
  return pool.token0;
}

function scorePool(liquidityUsd: number, volumeUsd: number, priceChange1h: number, ageHours: number, isNew: boolean): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (liquidityUsd > 200_000) { score += 32; reasons.push("strong TVL on HSKSwap"); }
  else if (liquidityUsd > 50_000) { score += 20; reasons.push("solid TVL"); }
  else if (liquidityUsd > 10_000) { score += 10; reasons.push("moderate TVL"); }

  if (volumeUsd > 500_000) { score += 35; reasons.push("🔥 explosive HSKSwap volume"); }
  else if (volumeUsd > 100_000) { score += 25; reasons.push("high native DEX volume"); }
  else if (volumeUsd > 20_000) { score += 14; reasons.push("building volume"); }

  if (priceChange1h > 20) { score += 25; reasons.push(`🚀 +${priceChange1h.toFixed(1)}% surge in 1h`); }
  else if (priceChange1h > 8) { score += 15; reasons.push("strong momentum"); }
  else if (priceChange1h > 2) { score += 7; reasons.push("positive momentum"); }
  else if (priceChange1h < -20) { score -= 12; reasons.push("heavy 1h drop"); }

  if (isNew && ageHours < 24 && volumeUsd > 5_000) { score += 18; reasons.push("🆕 new pool gaining traction"); }
  else if (ageHours < 72) { score += 5; reasons.push("recently launched"); }

  // Native chain bonus
  score += 5;
  reasons.push("native HSKSwap liquidity");

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

// ─── SUBGRAPH QUERIES ─────────────────────────────────────────────────────────

const TOP_POOLS_QUERY = `{
  pools(
    first: 20
    orderBy: volumeUSD
    orderDirection: desc
    where: { volumeUSD_gt: "0", liquidity_gt: "0" }
  ) {
    id
    token0 { id symbol name }
    token1 { id symbol name }
    token0Price
    totalValueLockedUSD
    volumeUSD
    createdAtTimestamp
    poolHourData(first: 2 orderBy: periodStartUnix orderDirection: desc) {
      open
      close
      volumeUSD
    }
  }
}`;

const NEW_POOLS_QUERY = `{
  pools(
    first: 15
    orderBy: createdAtTimestamp
    orderDirection: desc
    where: { liquidity_gt: "0" }
  ) {
    id
    token0 { id symbol name }
    token1 { id symbol name }
    token0Price
    totalValueLockedUSD
    volumeUSD
    createdAtTimestamp
    poolHourData(first: 2 orderBy: periodStartUnix orderDirection: desc) {
      open
      close
      volumeUSD
    }
  }
}`;

// ─── CONVERTER ────────────────────────────────────────────────────────────────

function poolToSignal(pool: Record<string, unknown>, isNew: boolean): HskSwapSignal | null {
  try {
    const token = pickToken(pool as Parameters<typeof pickToken>[0]);
    if (!token.symbol || !token.id?.startsWith("0x")) return null;

    const liquidityUsd = safeNum(pool.totalValueLockedUSD);
    const volumeUsd = safeNum(pool.volumeUSD);
    const hourData = (pool.poolHourData as Record<string, unknown>[] | undefined) ?? [];

    let priceChange1h = 0;
    if (hourData.length >= 2) {
      const close1 = safeNum((hourData[0] as Record<string, unknown>).close);
      const close2 = safeNum((hourData[1] as Record<string, unknown>).close);
      if (close2 > 0) priceChange1h = ((close1 - close2) / close2) * 100;
    }

    const ageHours = pool.createdAtTimestamp
      ? (Date.now() / 1000 - safeNum(pool.createdAtTimestamp)) / 3600
      : 8760;

    const { score, reasons } = scorePool(liquidityUsd, volumeUsd, priceChange1h, ageHours, isNew);
    const action = score >= 70 ? "ENTER" : score >= 45 ? "WATCH" : "SKIP";

    // Rise projection
    let risePct = 5;
    if (score >= 85) risePct = Math.min(250, Math.round(60 + priceChange1h * 1.5));
    else if (score >= 70) risePct = Math.min(120, Math.round(30 + priceChange1h));
    else if (score >= 50) risePct = Math.min(60, Math.round(10 + priceChange1h * 0.5));

    const timeframe = score >= 75 ? "24–48h" : "48–72h";

    return {
      symbol: token.symbol,
      name: token.name,
      chain: "hashkey",
      contractAddress: token.id,
      pairAddress: pool.id as string,
      priceUsd: safeNum(pool.token0Price),
      liquidityUsd,
      volume24h: volumeUsd,
      priceChange1h,
      priceChange24h: 0,
      marketCap: 0,
      ageHours,
      score,
      action,
      reasoning: `${reasons.join(" · ")} → +${risePct}% projected in ${timeframe}`,
      source: "hskswap",
      tradeUrl: `https://app.hskswap.com/#/swap?outputCurrency=${token.id}`,
      explorerUrl: `${HSKSWAP_CONSTANTS.EXPLORER}/token/${token.id}`,
      dexscreenerUrl: `https://dexscreener.com/hashkey/${pool.id as string}`,
    };
  } catch {
    return null;
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Fetch live HSKSwap pools from the official subgraph.
 * Merges top-volume pools + newest pools, deduped by contract address.
 * Returns empty array (not throws) on any failure — safe for use in
 * Promise.allSettled() chains.
 */
export async function fetchHskSwapSignals(): Promise<HskSwapSignal[]> {
  const seen = new Set<string>();
  const results: HskSwapSignal[] = [];

  function add(sig: HskSwapSignal | null) {
    if (!sig) return;
    const key = sig.contractAddress.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(sig);
    }
  }

  await Promise.allSettled([
    (async () => {
      const data = await gqlFetch(HSKSWAP_CONSTANTS.SUBGRAPH_URL, TOP_POOLS_QUERY) as { pools?: Record<string, unknown>[] } | null;
      for (const pool of data?.pools ?? []) add(poolToSignal(pool, false));
    })(),
    (async () => {
      const data = await gqlFetch(HSKSWAP_CONSTANTS.SUBGRAPH_URL, NEW_POOLS_QUERY) as { pools?: Record<string, unknown>[] } | null;
      for (const pool of data?.pools ?? []) add(poolToSignal(pool, true));
    })(),
  ]);

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Quick connectivity check — returns true if the subgraph is reachable.
 * Used by CLI scripts for diagnostics.
 */
export async function checkHskSwapSubgraph(): Promise<boolean> {
  try {
    const data = await gqlFetch(HSKSWAP_CONSTANTS.SUBGRAPH_URL, "{ pools(first: 1) { id } }") as { pools?: unknown[] } | null;
    return Array.isArray(data?.pools);
  } catch {
    return false;
  }
}
