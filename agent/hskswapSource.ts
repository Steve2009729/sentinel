/**
 * agent/hskswapSource.ts
 *
 * Thin re-export so CLI scripts (agent/runAgent.ts etc.) can still use
 * fetchHskSwapSignals(). The canonical implementation lives in src/lib/
 * where Next.js API routes can import it directly.
 *
 * Do NOT add logic here — keep this as a passthrough only.
 */

export {
  fetchHskSwapSignals,
  checkHskSwapSubgraph,
  HSKSWAP_CONSTANTS,
  type HskSwapSignal,
} from "../src/lib/hskswapSource";
