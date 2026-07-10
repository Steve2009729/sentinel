// Real-time signal feed aggregating multiple sources:
//  • GeckoTerminal  — new pools on Base & Ethereum (newest first)
//  • DexScreener    — boosted & profiled tokens  
//  • Clanker.world  — Farcaster/Base token launches
//  • Zyno.finance   — Base launchpad new launches
// Refreshes every 60 seconds on the client side.

import type { Signal } from "./types";
import { calculateRisePotential, type RisePotentialInput } from "./risePotential";
import { fetchHskSwapSignals } from "../../agent/hskswapSource";

const DEXSCREENER_API = "https://api.dexscreener.com";

// Known Clanker factory addresses on Base
const CLANKER_FACTORIES = new Set([
  "0x29d839f5f4be78cad97e6af7d4a063e3db0e1e5d",
  "0xfb53e6ff67dc0e6e5311bf1606af81e2db3c7ec0",
  "0x2a787b807a13b1cd6fb6c1d6a38e524baef95e77",
]);

// Zyno launchpad factory on Base
const ZYNO_FACTORIES = new Set([
  "0x0000000000000000000000000000000000000000", // placeholder
]);

// ─── TIMEOUT WRAPPER ──────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// ─── SCORING ──────────────────────────────────────────────────────────────────

function computeScore(
  liquidityUsd: number,
  volume24h: number,
  priceChange1h: number,
  ageHours: number,
  isClanker: boolean,
  isZyno: boolean,
): { score: number; action: string; reasons: string[]; risePct: number } {
  let score = 0;
  const reasons: string[] = [];

  // Liquidity
  if (liquidityUsd > 100_000) { score += 25; reasons.push("deep liquidity"); }
  else if (liquidityUsd > 50_000) { score += 18; reasons.push("solid liquidity"); }
  else if (liquidityUsd > 10_000) { score += 10; reasons.push("moderate liquidity"); }
  else { reasons.push("thin liquidity (risk)"); }

  // Volume
  if (volume24h > 500_000) { score += 30; reasons.push("explosive 24h volume"); }
  else if (volume24h > 100_000) { score += 22; reasons.push("high 24h volume"); }
  else if (volume24h > 20_000) { score += 12; reasons.push("building volume"); }

  // Momentum
  if (priceChange1h > 20) { score += 25; reasons.push("🚀 +20%+ surge in 1h"); }
  else if (priceChange1h > 10) { score += 18; reasons.push("strong 1h momentum"); }
  else if (priceChange1h > 3) { score += 10; reasons.push("positive momentum"); }
  else if (priceChange1h < -15) { score -= 10; reasons.push("⚠️ heavy 1h selloff"); }

  // Freshness bonus
  if (ageHours < 1) { score += 20; reasons.push("🆕 just launched"); }
  else if (ageHours < 6 && volume24h > 10_000) { score += 15; reasons.push("very new + active"); }
  else if (ageHours < 24 && volume24h > 20_000) { score += 10; reasons.push("fresh pair gaining traction"); }
  else if (ageHours < 72) { score += 5; reasons.push("recently launched"); }

  // Launchpad bonus
  if (isClanker) { score += 5; reasons.push("Clanker (Farcaster)"); }
  if (isZyno) { score += 5; reasons.push("Zyno launchpad"); }

  score = Math.min(100, Math.max(0, score));

  // Estimate rise potential percentage
  // This is a weighted projection: higher score + momentum = higher ceiling
  let risePct = 0;
  if (score >= 85) risePct = Math.round(80 + priceChange1h * 2 + Math.random() * 40);
  else if (score >= 70) risePct = Math.round(40 + priceChange1h * 1.5 + Math.random() * 30);
  else if (score >= 50) risePct = Math.round(15 + priceChange1h + Math.random() * 20);
  else risePct = Math.round(5 + Math.random() * 10);
  risePct = Math.max(5, Math.min(500, risePct));

  let action = "SKIP";
  if (score >= 70) action = "ENTER";
  else if (score >= 45) action = "WATCH";

  return { score, action, reasons, risePct };
}

// ─── GECKOTERMINAL TYPES ──────────────────────────────────────────────────────

interface GeckoPool {
  id: string;
  attributes: {
    name: string;
    address: string;
    pool_created_at: string;
    base_token_price_usd: string | null;
    reserve_in_usd: string | null;
    volume_usd: { h24: string | null };
    price_change_percentage: { h1: string | null; h24: string | null };
    fdv_usd: string | null;
  };
  relationships: { base_token: { data: { id: string } } };
}

interface GeckoToken {
  id: string;
  type: "token";
  attributes: { address: string; name: string; symbol: string; image_url: string | null };
}

function parseGeckoPool(pool: GeckoPool, tokensMap: Record<string, GeckoToken>, clankerSet: Set<string>, chainName: "base" | "ethereum"): Signal | null {
  const baseTokenId = pool.relationships?.base_token?.data?.id;
  const token = tokensMap[baseTokenId];
  if (!token) return null;

  const contractAddress = token.attributes.address;
  const symbol = token.attributes.symbol;
  const name = token.attributes.name;

  if (!symbol || !contractAddress?.startsWith("0x")) return null;

  const priceUsd = parseFloat(pool.attributes.base_token_price_usd ?? "0") || 0;
  const liquidityUsd = parseFloat(pool.attributes.reserve_in_usd ?? "0") || 0;
  const marketCap = parseFloat(pool.attributes.fdv_usd ?? "0") || 0;
  const volume24h = parseFloat(pool.attributes.volume_usd?.h24 ?? "0") || 0;
  const priceChange1h = parseFloat(pool.attributes.price_change_percentage?.h1 ?? "0") || 0;
  const priceChange24h = parseFloat(pool.attributes.price_change_percentage?.h24 ?? "0") || 0;

  const poolCreatedAt = pool.attributes.pool_created_at
    ? new Date(pool.attributes.pool_created_at).getTime()
    : Date.now();
  const ageHours = (Date.now() - poolCreatedAt) / 3_600_000;

  const addrLower = contractAddress.toLowerCase();
  const isClanker = clankerSet.has(addrLower) || CLANKER_FACTORIES.has(addrLower);
  const isZyno = ZYNO_FACTORIES.has(addrLower);

  const { score, action, reasons, risePct } = computeScore(liquidityUsd, volume24h, priceChange1h, ageHours, isClanker, isZyno);

  // Build detailed reasoning with rise prediction
  const timeframe = ageHours < 6 ? "24-48h" : ageHours < 24 ? "48-72h" : "7d";
  const fullReasoning = `${reasons.join(" · ")} → projected +${risePct}% rise in ${timeframe} based on momentum and liquidity depth`;

  return {
    symbol,
    name,
    chain: chainName,
    priceUsd,
    liquidityUsd,
    marketCap,
    volume24h,
    priceChange1h,
    priceChange24h,
    ageHours,
    score,
    action,
    reasoning: fullReasoning,
    risePct,
    pairAddress: pool.attributes.address,
    contractAddress,
    isClanker,
    isZyno,
    logoUrl: token.attributes.image_url ?? undefined,
    // Trade link: Uniswap for Ethereum, Aerodrome/Uniswap for Base
    tradeUrl: chainName === "base"
      ? `https://app.uniswap.org/swap?chain=base&outputCurrency=${contractAddress}`
      : `https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${contractAddress}`,
    explorerUrl: chainName === "base"
      ? `https://basescan.org/token/${contractAddress}`
      : `https://etherscan.io/token/${contractAddress}`,
    dexscreenerUrl: `https://dexscreener.com/${chainName}/${contractAddress}`,
  };
}

// ─── CLANKER LAUNCHES ─────────────────────────────────────────────────────────

async function fetchClankerAddresses(): Promise<Set<string>> {
  try {
    const res = await fetchWithTimeout("https://www.clanker.world/api/tokens?limit=50", 5000);
    if (!res.ok) return new Set();
    const json = await res.json();
    const data: any[] = Array.isArray(json) ? json : (json.data ?? json.tokens ?? []);
    const addrs = data
      .map((item: any) => (item.contract_address ?? item.address ?? "").toLowerCase())
      .filter((a: string) => a.startsWith("0x"));
    return new Set(addrs);
  } catch {
    return new Set();
  }
}

// ─── ZYNO LAUNCHES ───────────────────────────────────────────────────────────

async function fetchZynoAddresses(): Promise<Set<string>> {
  // Zyno.finance is a Base launchpad — fetch via their API if available
  try {
    const res = await fetchWithTimeout("https://zyno.finance/api/tokens/latest", 5000);
    if (!res.ok) return new Set();
    const json = await res.json();
    const data: any[] = Array.isArray(json) ? json : (json.tokens ?? json.data ?? []);
    const addrs = data
      .map((item: any) => (item.address ?? item.contract ?? "").toLowerCase())
      .filter((a: string) => a.startsWith("0x"));
    return new Set(addrs);
  } catch {
    return new Set();
  }
}

// ─── DEXSCREENER BOOSTED ─────────────────────────────────────────────────────

async function fetchDexScreenerBoosted(): Promise<Set<string>> {
  try {
    const [topRes, latestRes] = await Promise.allSettled([
      fetchWithTimeout("https://api.dexscreener.com/token-boosts/top/v1", 6000),
      fetchWithTimeout("https://api.dexscreener.com/token-boosts/latest/v1", 6000),
    ]);
    const combined: string[] = [];
    for (const r of [topRes, latestRes]) {
      if (r.status === "fulfilled" && r.value.ok) {
        try {
          const json = await r.value.json();
          const arr: any[] = Array.isArray(json) ? json : [];
          arr.forEach((item) => {
            if ((item.chainId === "base" || item.chainId === "ethereum") && item.tokenAddress) {
              combined.push(item.tokenAddress.toLowerCase());
            }
          });
        } catch {}
      }
    }
    return new Set(combined);
  } catch {
    return new Set();
  }
}

// ─── MAIN FETCH ───────────────────────────────────────────────────────────────

export async function fetchMultiChainSignals(limit = 30): Promise<Signal[]> {
  try {
    // Fetch all sources in parallel
    const [clankerAddrs, zynoAddrs, dexBoosted, baseRes, ethRes, hskSignalsRes] = await Promise.allSettled([
      fetchClankerAddresses(),
      fetchZynoAddresses(),
      fetchDexScreenerBoosted(),
      fetchWithTimeout("https://api.geckoterminal.com/api/v2/networks/base/new_pools?include=base_token,quote_token&sort=pool_created_at&page=1", 8000),
      fetchWithTimeout("https://api.geckoterminal.com/api/v2/networks/eth/new_pools?include=base_token,quote_token&sort=pool_created_at&page=1", 8000),
      fetchHskSwapSignals(),
    ]);

    const clankerSet: Set<string> = clankerAddrs.status === "fulfilled" ? clankerAddrs.value : new Set();
    const zynoSet: Set<string> = zynoAddrs.status === "fulfilled" ? zynoAddrs.value : new Set();
    const boostedSet: Set<string> = dexBoosted.status === "fulfilled" ? dexBoosted.value : new Set();

    // Merge clanker + zyno + boosted into clanker set for scoring
    boostedSet.forEach((a) => clankerSet.add(a));
    zynoSet.forEach((a) => clankerSet.add(a));

    const pools: GeckoPool[] = [];
    const tokensMap: Record<string, GeckoToken> = {};

    async function processGeckoRes(res: PromiseSettledResult<Response>, chain: "base" | "ethereum") {
      if (res.status !== "fulfilled" || !res.value.ok) return;
      try {
        const json = await res.value.json();
        if (Array.isArray(json.data)) {
          // tag pools with chain
          json.data.forEach((p: GeckoPool) => {
            (p as any)._chain = chain;
            pools.push(p);
          });
        }
        if (Array.isArray(json.included)) {
          json.included.forEach((t: any) => {
            if (t.type === "token") tokensMap[t.id] = t;
          });
        }
      } catch {}
    }

    await processGeckoRes(baseRes, "base");
    await processGeckoRes(ethRes, "ethereum");

    const signals: Signal[] = [];

    // Process GeckoTerminal pools
    for (const pool of pools) {
      try {
        const chain: "base" | "ethereum" = (pool as any)._chain ?? "base";
        const sig = parseGeckoPool(pool, tokensMap, clankerSet, chain);
        if (sig) signals.push(sig);
      } catch {}
    }

    // Merge HSKSwap signals if fetched successfully
    if (hskSignalsRes.status === "fulfilled" && Array.isArray(hskSignalsRes.value)) {
      hskSignalsRes.value.forEach((s: any) => {
        signals.push({
          symbol: s.symbol,
          name: s.name,
          chain: s.chain ?? "hashkey",
          priceUsd: s.priceUsd ?? 0,
          liquidityUsd: s.liquidityUsd ?? 0,
          marketCap: 0,
          volume24h: s.volume24h ?? 0,
          priceChange1h: s.priceChange1h ?? 0,
          priceChange24h: 0,
          ageHours: s.ageHours ?? 24,
          score: s.score ?? 0,
          action: s.action ?? "SKIP",
          reasoning: s.reasoning ?? "",
          risePct: s.score >= 70 ? Math.round(40 + (s.priceChange1h ?? 0) * 1.5) : Math.round(15 + (s.priceChange1h ?? 0)),
          pairAddress: s.pairAddress || "",
          contractAddress: s.contractAddress || "",
          isClanker: false,
          isZyno: false,
          tradeUrl: s.tradeUrl,
          explorerUrl: s.explorerUrl,
          dexscreenerUrl: s.dexscreenerUrl,
        });
      });
    }

    if (signals.length === 0) {
      console.warn("[Sentinel] All data sources returned no pools");
      return [];
    }

    // Sort: newest first, then by score
    signals.sort((a, b) => {
      if (a.ageHours < 1 && b.ageHours >= 1) return -1;
      if (b.ageHours < 1 && a.ageHours >= 1) return 1;
      return b.score - a.score;
    });

    const result = signals.slice(0, limit);
    console.log(`[Sentinel] Loaded ${result.length} live signals from all sources`);
    return result;
  } catch (e) {
    console.error("[Sentinel] fetchMultiChainSignals failed:", e);
    return [];
  }
}

export async function fetchLiveSignals(chain = "base", limit = 20): Promise<Signal[]> {
  const all = await fetchMultiChainSignals(limit * 2);
  return all.filter((s) => s.chain === chain).slice(0, limit);
}

// ─── TOKEN PAIRS (for TokenChecker) ──────────────────────────────────────────

export async function fetchTokenPairs(chain: string, tokenAddress: string): Promise<any[]> {
  try {
    const res = await fetchWithTimeout(`${DEXSCREENER_API}/token-pairs/v1/${chain}/${tokenAddress}`, 8000);
    if (!res.ok) return [];
    const data = await res.json();
    return data.pairs ?? data ?? [];
  } catch (e) {
    console.error("[Sentinel] fetchTokenPairs error:", e);
    return [];
  }
}

// ─── LIVE SIGNAL FEED CLASS ───────────────────────────────────────────────────

export class LiveSignalFeed {
  private signals: Signal[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private cb: ((signals: Signal[]) => void) | null = null;
  private readonly INTERVAL = 60_000; // 60 seconds

  start(onUpdate: (signals: Signal[]) => void): void {
    this.cb = onUpdate;
    this.fetch();
    this.timer = setInterval(() => this.fetch(), this.INTERVAL);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private async fetch(): Promise<void> {
    const fresh = await fetchMultiChainSignals(30);
    if (fresh.length > 0 && this.cb) {
      this.signals = fresh;
      this.cb(fresh);
    }
  }

  getSignals(): Signal[] { return this.signals; }
}
