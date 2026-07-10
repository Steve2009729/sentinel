// Pulls token data from DexScreener (free, no key) and scores it.

import { fetchHskSwapSignals } from "./hskswapSource";

export interface TokenSignal {
  symbol: string;
  name: string;
  chain: string;           // "base" | "ethereum" | "hashkey"
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  priceChange1h: number;
  pairCreatedAt: number;
  ageHours: number;
  score: number;           // 0-100
  action: string;          // ENTER / WATCH / SKIP
  reasoning: string;
  // Optional enriched fields (present on HSKSwap and enriched DexScreener signals)
  source?: string;           // "dexscreener" | "hskswap"
  contractAddress?: string;
  pairAddress?: string;
  tradeUrl?: string;
  dexscreenerUrl?: string;
  explorerUrl?: string;
}

const DEXSCREENER = "https://api.dexscreener.com";

// Score logic: fresh + liquid + volume spiking + price rising = higher score
function safeNum(val: any, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function scoreToken(p: any): TokenSignal {
  const liquidityUsd = safeNum(p.liquidity?.usd);
  const volume24h = safeNum(p.volume?.h24);
  const priceChange1h = safeNum(p.priceChange?.h1);
  const now = Date.now();
  const pairCreatedAt = safeNum(p.pairCreatedAt, now);
  // Clamp to prevent negative/insane ages
  const ageHours = Math.max(0, (now - pairCreatedAt) / 3_600_000);

  let score = 0;
  const reasons: string[] = [];

  // Liquidity gate
  if (liquidityUsd > 50_000) { score += 25; reasons.push("solid liquidity"); }
  else if (liquidityUsd > 10_000) { score += 12; reasons.push("moderate liquidity"); }
  else { reasons.push("thin liquidity (risk)"); }

  // Volume signal
  if (volume24h > 100_000) { score += 30; reasons.push("high 24h volume"); }
  else if (volume24h > 20_000) { score += 15; reasons.push("building volume"); }

  // Momentum
  if (priceChange1h > 10) { score += 25; reasons.push("strong 1h momentum"); }
  else if (priceChange1h > 3) { score += 12; reasons.push("positive momentum"); }
  else if (priceChange1h < -10) { reasons.push("dropping hard (caution)"); }

  // Freshness — new pairs with traction score higher
  if (ageHours < 24 && volume24h > 20_000) { score += 20; reasons.push("fresh pair gaining traction"); }
  else if (ageHours < 72) { score += 8; reasons.push("recently launched"); }

  score = Math.min(100, score);

  let action = "SKIP";
  if (score >= 70) action = "ENTER";
  else if (score >= 45) action = "WATCH";

  return {
    symbol: p.baseToken?.symbol ?? "???",
    name: p.baseToken?.name ?? "Unknown",
    chain: p.chainId ?? "unknown",
    priceUsd: parseFloat(p.priceUsd ?? "0"),
    liquidityUsd,
    volume24h,
    priceChange1h,
    pairCreatedAt,
    ageHours,
    score,
    action,
    reasoning: reasons.join(", "),
  };
}

// Pull trending/active pairs on an EVM chain (default: base)
export async function fetchSignals(chain = "base"): Promise<TokenSignal[]> {
  if (chain === "hashkey") {
    try {
      return await fetchHskSwapSignals();
    } catch (e) {
      console.error("fetchSignals (hashkey) error:", e);
      return [];
    }
  }
  try {
    // Search returns active pairs; we filter to the requested chain
    const res = await fetch(`${DEXSCREENER}/latest/dex/search?q=${chain}`);
    if (!res.ok) throw new Error(`DexScreener ${res.status}`);
    const data = await res.json();
    const pairs = (data.pairs ?? [])
      .filter((p: any) => p.chainId === chain)
      .slice(0, 15);
    return pairs.map(scoreToken).sort((a: TokenSignal, b: TokenSignal) => b.score - a.score);
  } catch (e) {
    console.error("fetchSignals error:", e);
    return [];
  }
}
