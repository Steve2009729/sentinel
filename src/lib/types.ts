// A scored signal as returned by GET /api/signals (before any on-chain action).
export interface Signal {
  symbol: string;
  name: string;
  chain: string;
  priceUsd: number;
  liquidityUsd: number;
  marketCap: number;
  volume24h: number;
  priceChange1h: number;
  priceChange24h: number;
  ageHours: number;
  score: number;
  action: string;
  reasoning: string;
  risePct?: number;            // Projected rise % estimate
  pairAddress: string;
  contractAddress: string;
  isClanker: boolean;
  isZyno?: boolean;
  logoUrl?: string;
  tradeUrl?: string;           // Direct Uniswap/DEX swap link
  explorerUrl?: string;        // Basescan / Etherscan link
  dexscreenerUrl?: string;     // DexScreener chart link
}

export interface AgentResult {
  symbol: string;
  name: string;
  chain: string;
  score: number;
  action: string;
  reasoning: string;
  thought: string;
  liquidityUsd: number;
  volume24h: number;
  priceChange1h: number;
  priceChange24h?: number;
  marketCap?: number;
  priceUsd?: number;
  risePct?: number;
  payHash: string;
  decisionHash: string;
  logoUrl?: string;
  tradeUrl?: string;
  dexscreenerUrl?: string;
  contractAddress?: string;
  sources?: string[];
  isTrendingOnCoinGecko?: boolean;
  isBoostedOnDexScreener?: boolean;
}

export interface TxRecord {
  hash: string;
  type: "signal_payment" | "decision_log" | "tier_unlock";
  tier?: number;
  amount: string;
  symbol?: string;
  timestamp: number;
}

// OHLCV candle for TradingView Lightweight Charts
export interface OHLCVCandle {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Token deep analytics
export interface TokenAnalytics {
  contractAddress: string;
  symbol: string;
  name: string;
  chain: string;
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  volume24h: number;
  holders: number;
  risePotential: number;
  securityScore: number;
  securityFlags: SecurityFlag[];
  topHolders: HolderInfo[];
  candles: OHLCVCandle[];
}

export interface SecurityFlag {
  label: string;
  severity: "safe" | "warning" | "danger";
  detail: string;
}

export interface HolderInfo {
  address: string;
  percentage: number;
  isSmartMoney: boolean;
  label?: string;
  pnlPercent?: number;
}

// Payment tier definitions per blueprint §4.1
export const PAYMENT_TIERS = {
  1: { name: "Live Launches", costHsk: 0, description: "Real-time new token launches from Clanker, DexScreener & Zyno" },
  2: { name: "AI Trading Signals", costHsk: 2, description: "Gemini AI analyzed entry/exit signals with % rise predictions and reasoning" },
  3: { name: "Deep Analytics", costHsk: 1, description: "Line charts, security audit, KOL/whale holders, full token metrics (per asset)" },
} as const;

export type TierLevel = 1 | 2 | 3;
