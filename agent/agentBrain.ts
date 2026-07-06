import { TokenSignal } from "./signalSource";

// Turns a scored signal into a human-readable agent thought.
export function reason(signal: TokenSignal): string {
  const parts: string[] = [];
  parts.push(`Evaluating ${signal.symbol} on ${signal.chain}.`);
  parts.push(`Liquidity $${Math.round(signal.liquidityUsd).toLocaleString()}, 24h volume $${Math.round(signal.volume24h).toLocaleString()}, 1h change ${signal.priceChange1h.toFixed(1)}%.`);
  parts.push(`Signals: ${signal.reasoning}.`);
  if (signal.action === "ENTER") parts.push(`Confidence ${signal.score}/100 — this clears my entry threshold. Recommending ENTER.`);
  else if (signal.action === "WATCH") parts.push(`Confidence ${signal.score}/100 — promising but not decisive. Recommending WATCH.`);
  else parts.push(`Confidence ${signal.score}/100 — does not meet my bar. SKIP.`);
  return parts.join(" ");
}
