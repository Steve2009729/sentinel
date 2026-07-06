// Rise Potential Algorithm — Blueprint §3.3
// Weighted scoring function (0-100%) abstracted for future AI/ML injection
//
// Factors:
//   1. Liquidity to Market Cap ratio (30% weight)
//   2. Smart Money accumulation volume in first hour (35% weight)
//   3. Contract safety score (35% weight)

export interface RisePotentialInput {
  liquidityUsd: number;
  marketCap: number;
  volume24h: number;
  volumeFirstHour: number;    // approximate from age + volume trajectory
  priceChange1h: number;
  priceChange24h: number;
  ageHours: number;
  holderCount: number;
  topHolderPercent: number;   // % held by top 10 holders
  isContractVerified: boolean;
  hasRenounced: boolean;      // ownership renounced
  hasLockedLiquidity: boolean;
  hasMintFunction: boolean;
  isHoneypot: boolean;
}

export interface RisePotentialResult {
  score: number;         // 0-100
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  liquidityRatio: number;
  smartMoneyScore: number;
  safetyScore: number;
  factors: string[];
}

// Abstracted scoring interface for future AI/ML model injection
export interface ScoringModel {
  score(input: RisePotentialInput): RisePotentialResult;
}

// ─── DEFAULT RULE-BASED MODEL ─────────────────────────────────────────────────

export class DefaultScoringModel implements ScoringModel {
  score(input: RisePotentialInput): RisePotentialResult {
    const factors: string[] = [];
    let liquidityRatio = 0;
    let smartMoneyScore = 0;
    let safetyScore = 0;

    // ── Factor 1: Liquidity to Market Cap Ratio (30% weight, max 30 pts) ──
    if (input.marketCap > 0) {
      const ratio = input.liquidityUsd / input.marketCap;
      if (ratio > 0.5) {
        liquidityRatio = 30;
        factors.push("Excellent liquidity depth (>50% of mcap)");
      } else if (ratio > 0.2) {
        liquidityRatio = 22;
        factors.push("Strong liquidity depth (>20% of mcap)");
      } else if (ratio > 0.1) {
        liquidityRatio = 15;
        factors.push("Moderate liquidity depth");
      } else if (ratio > 0.05) {
        liquidityRatio = 8;
        factors.push("Thin liquidity relative to mcap");
      } else {
        liquidityRatio = 2;
        factors.push("⚠ Very thin liquidity — high slippage risk");
      }
    } else {
      factors.push("Market cap unavailable");
    }

    // ── Factor 2: Smart Money / Accumulation Volume (35% weight, max 35 pts) ──
    // Approximation: high volume in first hours + positive price action = accumulation
    const volumeToLiqRatio = input.liquidityUsd > 0 ? input.volume24h / input.liquidityUsd : 0;

    if (input.ageHours < 2 && volumeToLiqRatio > 3) {
      smartMoneyScore += 20;
      factors.push("🔥 Massive volume surge in first 2 hours");
    } else if (input.ageHours < 6 && volumeToLiqRatio > 2) {
      smartMoneyScore += 15;
      factors.push("Strong early accumulation pattern");
    } else if (volumeToLiqRatio > 1.5) {
      smartMoneyScore += 10;
      factors.push("Above-average volume/liquidity ratio");
    } else if (volumeToLiqRatio > 0.5) {
      smartMoneyScore += 5;
      factors.push("Normal volume activity");
    }

    // Positive momentum bonus
    if (input.priceChange1h > 15) {
      smartMoneyScore += 10;
      factors.push("Strong 1h momentum (>15%)");
    } else if (input.priceChange1h > 5) {
      smartMoneyScore += 6;
      factors.push("Positive 1h momentum");
    } else if (input.priceChange1h < -20) {
      smartMoneyScore -= 5;
      factors.push("⚠ Sharp 1h decline — possible dump");
    }

    // Holder distribution bonus
    if (input.topHolderPercent < 30 && input.holderCount > 100) {
      smartMoneyScore += 5;
      factors.push("Well-distributed holder base");
    } else if (input.topHolderPercent > 70) {
      smartMoneyScore -= 3;
      factors.push("⚠ Top holders own >70% — concentration risk");
    }

    smartMoneyScore = Math.max(0, Math.min(35, smartMoneyScore));

    // ── Factor 3: Contract Safety Score (35% weight, max 35 pts) ──
    if (input.isHoneypot) {
      safetyScore = 0;
      factors.push("🚫 Honeypot detected — DO NOT ENTER");
    } else {
      safetyScore = 15; // Base score for non-honeypot

      if (input.isContractVerified) {
        safetyScore += 5;
        factors.push("Contract source verified");
      } else {
        factors.push("⚠ Unverified contract source");
      }

      if (input.hasLockedLiquidity) {
        safetyScore += 8;
        factors.push("Liquidity locked");
      } else {
        factors.push("⚠ Liquidity not locked");
      }

      if (input.hasRenounced) {
        safetyScore += 5;
        factors.push("Ownership renounced");
      }

      if (input.hasMintFunction) {
        safetyScore -= 5;
        factors.push("⚠ Mint function detected — supply inflation risk");
      }

      safetyScore = Math.max(0, Math.min(35, safetyScore));
    }

    // ── Total Score ──
    const score = Math.min(100, Math.max(0, Math.round(liquidityRatio + smartMoneyScore + safetyScore)));

    const grade =
      score >= 85 ? "S" :
      score >= 70 ? "A" :
      score >= 55 ? "B" :
      score >= 40 ? "C" :
      score >= 25 ? "D" : "F";

    return {
      score,
      grade,
      liquidityRatio,
      smartMoneyScore,
      safetyScore,
      factors,
    };
  }
}

// Default singleton instance
export const risePotentialModel = new DefaultScoringModel();

/**
 * Quick-score function using the default model.
 * This can be swapped for an AI/ML model via the ScoringModel interface.
 */
export function calculateRisePotential(input: RisePotentialInput): RisePotentialResult {
  return risePotentialModel.score(input);
}
