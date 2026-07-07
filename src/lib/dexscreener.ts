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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchClankerLaunches(): Promise<string[]> {
  try {
    console.log("[DexScreener] Fetching clanker.world new launches...");
    const res = await fetchWithTimeout("https://www.clanker.world/api/tokens", { cache: "no-store" }, 6000);
    if (!res.ok) {
      console.warn(`[DexScreener] Clanker API returned status ${res.status}`);
      return [];
    }
    const json = await res.json();
    const data = Array.isArray(json) ? json : (json.data ?? []);
    return data
      .map((item: any) => (item.contract_address ?? item.address ?? "").toLowerCase())
      .filter((addr: string) => addr.startsWith("0x"));
  } catch (e) {
    console.error("[DexScreener] Failed to fetch Clanker launches:", e);
    return [];
  }
}

async function fetchDexScreenerLatestProfiles(): Promise<{ address: string; chain: string }[]> {
  try {
    console.log("[DexScreener] Fetching DexScreener latest profiles...");
    const res = await fetchWithTimeout("https://api.dexscreener.com/token-profiles/latest/v1", { cache: "no-store" }, 6000);
    if (!res.ok) {
      console.warn(`[DexScreener] DexScreener profiles API returned status ${res.status}`);
      return [];
    }
    const json = await res.json();
    const data = Array.isArray(json) ? json : [];
    return data
      .filter((item: any) => item.chainId === "base" || item.chainId === "ethereum")
      .map((item: any) => ({
        address: (item.tokenAddress ?? "").toLowerCase(),
        chain: item.chainId
      }))
      .filter((item: any) => item.address.startsWith("0x"));
  } catch (e) {
    console.error("[DexScreener] Failed to fetch DexScreener profiles:", e);
    return [];
  }
}

/**
 * Fetch live signals from DexScreener for a specific chain.
 */
export async function fetchLiveSignals(
  chain: string = "base",
  limit: number = 20
): Promise<Signal[]> {
  const all = await fetchMultiChainSignals(limit * 2);
  return all.filter((s) => s.chain === chain).slice(0, limit);
}

/**
 * Fetch signals from both Base and Ethereum chains, prioritizing Clanker and new profiles.
 */
export async function fetchMultiChainSignals(limit: number = 20): Promise<Signal[]> {
  try {
    // 1. Fetch candidates in parallel
    const [clankerAddrs, dexProfiles] = await Promise.all([
      fetchClankerLaunches(),
      fetchDexScreenerLatestProfiles()
    ]);

    // 2. Build candidate lists by chain
    const baseAddresses = new Set<string>();
    const ethAddresses = new Set<string>();
    const clankerSet = new Set<string>(clankerAddrs);

    // Add all Clanker addresses (always Base)
    clankerAddrs.forEach(addr => baseAddresses.add(addr));

    // Add DexScreener profiles
    dexProfiles.forEach(item => {
      if (item.chain === "base") {
        baseAddresses.add(item.address);
      } else if (item.chain === "ethereum") {
        ethAddresses.add(item.address);
      }
    });

    const baseArr = Array.from(baseAddresses).slice(0, 30);
    const ethArr = Array.from(ethAddresses).slice(0, 30);

    if (baseArr.length === 0 && ethArr.length === 0) {
      console.warn("[DexScreener] No candidate tokens found.");
      return [];
    }

    // 3. Fetch detailed pair data in parallel from DexScreener v1 tokens endpoint
    const [baseRes, ethRes] = await Promise.allSettled([
      baseArr.length > 0
        ? fetchWithTimeout(`https://api.dexscreener.com/tokens/v1/base/${baseArr.join(",")}`, { cache: "no-store" })
        : Promise.resolve(null),
      ethArr.length > 0
        ? fetchWithTimeout(`https://api.dexscreener.com/tokens/v1/ethereum/${ethArr.join(",")}`, { cache: "no-store" })
        : Promise.resolve(null),
    ]);

    let rawPairs: any[] = [];

    if (baseRes.status === "fulfilled" && baseRes.value && baseRes.value.ok) {
      const json = await baseRes.value.json();
      const pairs = Array.isArray(json) ? json : (json.pairs ?? []);
      rawPairs = rawPairs.concat(pairs);
    } else if (baseRes.status === "rejected") {
      console.error("[DexScreener] Base multi-token request failed:", baseRes.reason);
    }

    if (ethRes.status === "fulfilled" && ethRes.value && ethRes.value.ok) {
      const json = await ethRes.value.json();
      const pairs = Array.isArray(json) ? json : (json.pairs ?? []);
      rawPairs = rawPairs.concat(pairs);
    } else if (ethRes.status === "rejected") {
      console.error("[DexScreener] Ethereum multi-token request failed:", ethRes.reason);
    }

    if (rawPairs.length === 0) {
      console.warn("[DexScreener] No pairs returned for candidates.");
      return [];
    }

    // 4. De-duplicate pairs per token address, keeping the one with highest liquidity
    const bestPairsByToken: Record<string, any> = {};
    for (const pair of rawPairs) {
      const tokenAddr = (pair.baseToken?.address ?? "").toLowerCase();
      if (!tokenAddr) continue;

      const liq = pair.liquidity?.usd ?? 0;
      const existing = bestPairsByToken[tokenAddr];

      if (!existing || liq > (existing.liquidity?.usd ?? 0)) {
        bestPairsByToken[tokenAddr] = pair;
      }
    }

    // 5. Score the best pairs and construct signals
    const signals: Signal[] = [];
    for (const tokenAddr of Object.keys(bestPairsByToken)) {
      const pair = bestPairsByToken[tokenAddr];
      
      // Inject override isClanker if we got it from clanker.world list
      if (clankerSet.has(tokenAddr)) {
        pair.isClankerOverride = true;
      }

      try {
        const signal = scoreToken(pair);
        signals.push(signal);
      } catch (err) {
        console.error(`[DexScreener] Error scoring token ${tokenAddr}:`, err);
      }
    }

    // 6. Sort by age (newest first, i.e. ageHours ascending)
    const sorted = signals
      .sort((a, b) => a.ageHours - b.ageHours)
      .slice(0, limit);

    console.log(`[DexScreener] Fetched ${sorted.length} live launches successfully.`);
    return sorted;

  } catch (e) {
    console.error("[DexScreener] fetchMultiChainSignals error:", e);
    return [];
  }
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
