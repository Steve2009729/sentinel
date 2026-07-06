import { fetchSignals } from "./signalSource";
import { reason } from "./agentBrain";
import { payForSignal, logDecision } from "./settlement";

// One full agent cycle: fetch -> for top signals, pay -> decide -> log on-chain
export async function runCycle(chain = "base") {
  const signals = await fetchSignals(chain);
  const results = [];

  // Only act on the top 3 to keep gas/time sane in a demo
  for (const s of signals.slice(0, 3)) {
    const thought = reason(s);
    let payHash = "", decisionHash = "";
    try {
      payHash = await payForSignal(s.symbol);        // pay for the intelligence
      decisionHash = await logDecision(s.symbol, s.score, s.action, thought); // record decision
    } catch (e: any) {
      console.error("on-chain error:", e.message);
    }
    results.push({ ...s, thought, payHash, decisionHash });
  }
  return results;
}

// Allow running directly
if (require.main === module) {
  runCycle().then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); });
}
