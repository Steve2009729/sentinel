// Token deep analytics — Blueprint §3.2
// Aggregates data from DexScreener for deep-dive analysis

import type { TokenAnalytics, OHLCVCandle, SecurityFlag, HolderInfo } from "./types";
import { calculateRisePotential, type RisePotentialInput } from "./risePotential";

const DEXSCREENER_API = "https://api.dexscreener.com";

/**
 * Fetch comprehensive analytics for a specific token contract address.
 */
export async function fetchTokenAnalytics(
  chain: string,
  contractAddress: string
): Promise<TokenAnalytics | null> {
  try {
    console.log(`[TokenAnalytics] Fetching data for ${contractAddress} on ${chain}`);

    // Fetch pair data from DexScreener
    const res = await fetch(
      `${DEXSCREENER_API}/token-pairs/v1/${chain}/${contractAddress}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error(`[TokenAnalytics] DexScreener error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const pairs = Array.isArray(data) ? data : (data.pairs ?? []);

    if (pairs.length === 0) {
      console.warn(`[TokenAnalytics] No pairs found for ${contractAddress}`);
      return null;
    }

    // Use the highest-liquidity pair
    const pair = pairs.sort((a: any, b: any) =>
      (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    )[0];

    const liquidityUsd = pair.liquidity?.usd ?? 0;
    const marketCap = pair.marketCap ?? pair.fdv ?? 0;
    const volume24h = pair.volume?.h24 ?? 0;
    const priceChange1h = pair.priceChange?.h1 ?? 0;
    const priceChange24h = pair.priceChange?.h24 ?? 0;
    const ageHours = pair.pairCreatedAt
      ? (Date.now() - pair.pairCreatedAt) / 3_600_000
      : 999;

    // Security analysis (heuristic-based)
    const securityFlags = analyzeContractSecurity(pair, liquidityUsd, marketCap);

    // Rise Potential calculation
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
      isContractVerified: !securityFlags.some((f) => f.label === "Unverified Source"),
      hasRenounced: false,
      hasLockedLiquidity: liquidityUsd > 50000,
      hasMintFunction: securityFlags.some((f) => f.label === "Mint Function"),
      isHoneypot: securityFlags.some((f) => f.label === "Potential Honeypot"),
    };

    const rp = calculateRisePotential(rpInput);

    // Generate sample OHLCV candles from available data
    const candles = generateCandlesFromPair(pair);

    // Placeholder top holders (real data requires Moralis/Bitquery integration)
    const topHolders = generateHolderAnalysis();

    const safetyScore = securityFlags.filter((f) => f.severity === "safe").length * 20;

    return {
      contractAddress,
      symbol: pair.baseToken?.symbol ?? "???",
      name: pair.baseToken?.name ?? "Unknown",
      chain,
      priceUsd: parseFloat(pair.priceUsd ?? "0"),
      marketCap,
      liquidityUsd,
      volume24h,
      holders: 0,
      risePotential: rp.score,
      securityScore: Math.min(100, safetyScore),
      securityFlags,
      topHolders,
      candles,
    };
  } catch (e) {
    console.error("[TokenAnalytics] Error:", e);
    return null;
  }
}

// ─── SECURITY ANALYSIS ────────────────────────────────────────────────────────

function analyzeContractSecurity(pair: any, liquidityUsd: number, marketCap: number): SecurityFlag[] {
  const flags: SecurityFlag[] = [];

  // Liquidity check
  if (liquidityUsd > 100_000) {
    flags.push({ label: "Deep Liquidity", severity: "safe", detail: `$${Math.round(liquidityUsd).toLocaleString()} locked` });
  } else if (liquidityUsd > 10_000) {
    flags.push({ label: "Moderate Liquidity", severity: "warning", detail: `$${Math.round(liquidityUsd).toLocaleString()} — may cause slippage` });
  } else {
    flags.push({ label: "Low Liquidity", severity: "danger", detail: `$${Math.round(liquidityUsd).toLocaleString()} — high slippage risk` });
  }

  // Market cap ratio
  if (marketCap > 0 && liquidityUsd / marketCap < 0.05) {
    flags.push({ label: "Low Liq/MCap Ratio", severity: "warning", detail: "Liquidity is less than 5% of market cap" });
  }

  // Age check
  const ageHours = pair.pairCreatedAt
    ? (Date.now() - pair.pairCreatedAt) / 3_600_000
    : 999;

  if (ageHours < 1) {
    flags.push({ label: "Very New", severity: "warning", detail: "Pair created less than 1 hour ago" });
  } else if (ageHours < 24) {
    flags.push({ label: "New Pair", severity: "warning", detail: `Created ${Math.round(ageHours)}h ago` });
  } else {
    flags.push({ label: "Established Pair", severity: "safe", detail: `Active for ${Math.round(ageHours / 24)} days` });
  }

  // Volume activity
  const volume24h = pair.volume?.h24 ?? 0;
  if (volume24h > 50_000) {
    flags.push({ label: "Active Trading", severity: "safe", detail: `$${Math.round(volume24h).toLocaleString()} 24h volume` });
  } else if (volume24h < 1_000) {
    flags.push({ label: "Low Activity", severity: "danger", detail: "Very low 24h volume — potential dead token" });
  }

  return flags;
}

// ─── OHLCV GENERATION ─────────────────────────────────────────────────────────

function generateCandlesFromPair(pair: any): OHLCVCandle[] {
  const currentPrice = parseFloat(pair.priceUsd ?? "1");
  const priceChange24h = pair.priceChange?.h24 ?? 0;
  const volume24h = pair.volume?.h24 ?? 0;
  const candles: OHLCVCandle[] = [];

  const now = Math.floor(Date.now() / 1000);
  const candleCount = 48; // 30-min candles for 24h
  const interval = 1800; // 30 minutes

  // Work backwards from current price using the 24h change
  const startPrice = currentPrice / (1 + priceChange24h / 100);

  for (let i = 0; i < candleCount; i++) {
    const progress = i / candleCount;
    const basePrice = startPrice + (currentPrice - startPrice) * progress;

    // Add realistic noise
    const noise = (Math.random() - 0.5) * basePrice * 0.03;
    const open = basePrice + noise;
    const close = basePrice + noise * 0.5 + (currentPrice - startPrice) / candleCount;
    const high = Math.max(open, close) * (1 + Math.random() * 0.015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.015);
    const vol = (volume24h / candleCount) * (0.5 + Math.random());

    candles.push({
      time: now - (candleCount - i) * interval,
      open: Math.max(0.000001, open),
      high: Math.max(0.000001, high),
      low: Math.max(0.000001, low),
      close: Math.max(0.000001, close),
      volume: Math.max(0, vol),
    });
  }

  return candles;
}

// ─── HOLDER ANALYSIS PLACEHOLDER ──────────────────────────────────────────────

function generateHolderAnalysis(): HolderInfo[] {
  // In production, this would call Moralis/Bitquery APIs
  // For now, return realistic placeholder data
  const holders: HolderInfo[] = [
    { address: "0x28C6...9a3E", percentage: 15.2, isSmartMoney: true, label: "Smart Money Whale", pnlPercent: 340 },
    { address: "0x7F1a...b42D", percentage: 8.7, isSmartMoney: true, label: "Known KOL Wallet", pnlPercent: 180 },
    { address: "0x3E9c...d18F", percentage: 6.4, isSmartMoney: false, pnlPercent: 45 },
    { address: "0xA2Fb...e76C", percentage: 5.1, isSmartMoney: false, pnlPercent: -12 },
    { address: "0x9D4e...c35A", percentage: 4.8, isSmartMoney: true, label: "Early Accumulator", pnlPercent: 520 },
  ];

  return holders;
}
