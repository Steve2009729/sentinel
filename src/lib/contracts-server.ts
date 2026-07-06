// Server-side contract interaction for read-only operations
// Does NOT use user's wallet - uses backend wallet from .env for server-side calls

import { ethers } from "ethers";

const ABI = [
  "function payForSignal(string tokenSymbol) payable returns (uint256)",
  "function logDecision(string tokenSymbol, uint256 score, string action, string reasoning) returns (uint256)",
  "function signalFee() view returns (uint256)",
  "function totalSignalsPaid() view returns (uint256)",
  "function totalDecisions() view returns (uint256)",
];

function getRpc(): string {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "177";
  if (chainId === "177") return process.env.HSK_MAINNET_RPC || "https://mainnet.hsk.xyz";
  return process.env.HSK_TESTNET_RPC || "https://testnet.hsk.xyz";
}

// Read-only contract connection (no signer needed)
function getReadOnlyContract() {
  if (!process.env.CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS missing in .env");
  const provider = new ethers.JsonRpcProvider(getRpc());
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, provider);
}

// Get stats directly from contract (read-only, no wallet needed)
export async function getStats(): Promise<{ signalFeeWei: string; totalSignalsPaid: number; totalDecisions: number }> {
  try {
    const contract = getReadOnlyContract();
    const [fee, signals, decisions] = await Promise.all([
      contract.signalFee(),
      contract.totalSignalsPaid(),
      contract.totalDecisions(),
    ]);
    return {
      signalFeeWei: fee.toString(),
      totalSignalsPaid: Number(signals),
      totalDecisions: Number(decisions),
    };
  } catch (e) {
    console.error("getStats error:", e);
    throw e;
  }
}
