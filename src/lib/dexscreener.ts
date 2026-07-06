// Real-time signal feed from DexScreener API
// Fetches actual live token data from Base and Ethereum chains
// Includes Clanker-deployed token filtering per blueprint §3.1

import type { Signal } from "./types";
import { calculateRisePotential, type RisePotentialInput } from "./risePotential";

const DEXSCREENER_API = "https://api.dexscreener.com";

// Known Clanker factory addresses on Base
const CLANKER_FACTORIES = [
  "0x29d839f5f4be78cad97e6af7d4a063e3db0e1e5d",
  "0xfb53e6ff67dc0e6e5311bf1606af81e2db3c7ec0",
].map((a) => a.toLowerCase());

// ─── SCORING LOGIC ────────────────────────────────────────────────────────────

function scoreToken(pair: any): Signal {
  const liquidityUsd = pair.liquidity?.usd ?? 0;
  const marketCap = pair.marketCap ?? pair.fdv ?? 0;
  const volume24h = pair.volume?.h24 ?? 0;
  const priceChange1h = pair.priceChange?.h1 ?? 0;
  const priceChange24h = pair.priceChange?.h24 ?? 0;
  const pairCreatedAt = pair.pairCreatedAt ?? Date.now();
  const ageHours = (Date.now() - pairCreatedAt) / 3_600_000;

  // Check if this is a Clanker-deployed token on Base
  const deployer = (pair.info?.deployer ?? pair.baseToken?.address ?? "").toLowerCase();
  const isClanker = CLANKER_FACTORIES.some(
    (factory) => deployer === factory || pair.labels?.includes("clanker")
  );

  // Rise Potential score
  const rpInput: RisePotentialInput = {
    liquidityUsd,
    marketCap,
    volume24h,
    volumeFirstHour: ageHours < 1 ? volume24h : volume24h * 0.3,
    priceChange1h,
    priceChange24h,
    ageHours,
    holderCount: 0,
    topHolderPercent: 50,
    isContractVerified: true,
    hasRenounced: false,
    hasLockedLiquidity: liquidityUsd > 50000,
    hasMintFunction: false,
    isHoneypot: false,
  };

  const rp = calculateRisePotential(rpInput);

  // Additional scoring on top of rise potential
  let score = 0;
  const reasons: string[] = [];

  // Liquidity gate
  if (liquidityUsd > 50_000) {
    score += 25;
    reasons.push("solid liquidity");
  } else if (liquidityUsd > 10_000) {
    score += 12;
    reasons.push("moderate liquidity");
  } else {
    reasons.push("thin liquidity (risk)");
  }

  // Volume signal
  if (volume24h > 100_000) {
    score += 30;
    reasons.push("high 24h volume");
  } else if (volume24h > 20_000) {
    score += 15;
    reasons.push("building volume");
  }

  // Momentum
  if (priceChange1h > 10) {
    score += 25;
    reasons.push("strong 1h momentum");
  } else if (priceChange1h > 3) {
    score += 12;
    reasons.push("positive momentum");
  } else if (priceChange1h < -10) {
    reasons.push("dropping hard (caution)");
  }

  // Freshness
  if (ageHours < 24 && volume24h > 20_000) {
    score += 20;
    reasons.push("fresh pair gaining traction");
  } else if (ageHours < 72) {
    score += 8;
    reasons.push("recently launched");
  }

  // Clanker bonus
  if (isClanker) {
    score += 5;
    reasons.push("Clanker-deployed (Farcaster)");
  }

  score = Math.min(100, score);

  let action = "SKIP";
  if (score >= 70) action = "ENTER";
  else if (score >= 45) action = "WATCH";

  return {
    symbol: pair.baseToken?.symbol ?? "???",
    name: pair.baseToken?.name ?? "Unknown",
    chain: pair.chainId ?? "base",
    priceUsd: parseFloat(pair.priceUsd ?? "0"),
    liquidityUsd,
    marketCap,
    volume24h,
    priceChange1h,
    priceChange24h,
    ageHours,
    score,
    action,
    reasoning: reasons.join(", "),
    pairAddress: pair.pairAddress ?? "",
    contractAddress: pair.baseToken?.address ?? "",
    isClanker,
  };
}

// ─── API FETCHERS ─────────────────────────────────────────────────────────────

/**
 * Fetch live signals from DexScreener.
 * Uses `/latest/dex/search` which returns active pairs.
 */
export async function fetchLiveSignals(
  chain: string = "base",
  limit: number = 20
): Promise<Signal[]> {
  try {
    console.log(`[DexScreener] Fetching signals for chain: ${chain}`);

    // Abort after 8 seconds to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `${DEXSCREENER_API}/latest/dex/search?q=${chain}`,
      { cache: "no-store", signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[DexScreener] API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();

    // Validate response shape
    if (!data || typeof data !== "object") {
      console.warn("[DexScreener] Invalid response shape");
      return [];
    }

    const pairs = data.pairs ?? [];

    if (!Array.isArray(pairs) || pairs.length === 0) {
      console.warn("[DexScreener] No pairs returned from search");
      return [];
    }

    const signals = pairs
      .filter((p: any) => p.chainId === chain)
      .map(scoreToken)
      .sort((a: Signal, b: Signal) => b.score - a.score)
      .slice(0, limit);

    console.log(`[DexScreener] Returned ${signals.length} signals for ${chain}`);
    return signals;
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.error("[DexScreener] Request timed out after 8s");
    } else {
      console.error("[DexScreener] fetchLiveSignals error:", e);
    }
    return [];
  }
}

/**
 * Fetch signals from both Base and Ethereum chains.
 */
export async function fetchMultiChainSignals(limit: number = 20): Promise<Signal[]> {
  const [baseSignals, ethSignals] = await Promise.all([
    fetchLiveSignals("base", limit),
    fetchLiveSignals("ethereum", Math.floor(limit / 2)),
  ]);

  return [...baseSignals, ...ethSignals]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Fetch detailed pair data for a specific token contract address.
 */
export async function fetchTokenPairs(
  chain: string,
  tokenAddress: string
): Promise<any[]> {
  try {
    const res = await fetch(
      `${DEXSCREENER_API}/token-pairs/v1/${chain}/${tokenAddress}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error(`[DexScreener] Token pairs error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    return data.pairs ?? data ?? [];
  } catch (e) {
    console.error("[DexScreener] fetchTokenPairs error:", e);
    return [];
  }
}

// ─── LIVE FEED CLASS ──────────────────────────────────────────────────────────

export class LiveSignalFeed {
  private signals: Signal[] = [];
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private updateCallback: ((signals: Signal[]) => void) | null = null;
  private readonly POLL_INTERVAL_MS = 30_000; // 30s safe for rate limits

  start(chain: string = "base", onUpdate: (signals: Signal[]) => void): void {
    this.updateCallback = onUpdate;
    this.fetchAndUpdate(chain);
    this.pollingInterval = setInterval(() => {
      this.fetchAndUpdate(chain);
    }, this.POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async fetchAndUpdate(chain: string): Promise<void> {
    const newSignals = await fetchLiveSignals(chain, 20);
    if (newSignals.length > 0 && this.updateCallback) {
      this.signals = newSignals;
      this.updateCallback(newSignals);
    }
  }

  getSignals(): Signal[] {
    return this.signals;
  }
}
