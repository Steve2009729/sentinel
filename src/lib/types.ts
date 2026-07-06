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
  pairAddress: string;
  contractAddress: string;
  isClanker: boolean;
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
  payHash: string;
  decisionHash: string;
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
  1: { name: "Basic Signals", costHsk: 0.005, description: "20 unverified/raw token signals" },
  2: { name: "Premium Ratings", costHsk: 1.5, description: "Tokens with 80%+ Rise Potential" },
  3: { name: "Deep Analytics", costHsk: 0.01, description: "CA reveal, charts, KOL/smart money data (per asset)" },
} as const;

export type TierLevel = 1 | 2 | 3;
