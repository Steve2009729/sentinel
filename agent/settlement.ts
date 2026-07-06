import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const ABI = [
  "function payForSignal(string tokenSymbol) payable returns (uint256)",
  "function logDecision(string tokenSymbol, uint256 score, string action, string reasoning) returns (uint256)",
  "function signalFee() view returns (uint256)",
  "function totalSignalsPaid() view returns (uint256)",
  "function totalDecisions() view returns (uint256)",
];

// Pick RPC by chain id so the same code works on testnet (133) and mainnet (177).
// Phase 7: flipping NEXT_PUBLIC_CHAIN_ID to 177 points the agent at mainnet.
function getRpc(): string {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "133";
  if (chainId === "177") return process.env.HSK_MAINNET_RPC || "https://mainnet.hsk.xyz";
  return process.env.HSK_TESTNET_RPC || "https://testnet.hsk.xyz";
}

function getContract() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env");
  if (!process.env.CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS missing in .env (deploy first)");
  const provider = new ethers.JsonRpcProvider(getRpc());
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);
}

export async function payForSignal(tokenSymbol: string): Promise<string> {
  const contract = getContract();
  const fee = await contract.signalFee();
  const tx = await contract.payForSignal(tokenSymbol, { value: fee });
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function logDecision(
  tokenSymbol: string,
  score: number,
  action: string,
  reasoning: string
): Promise<string> {
  const contract = getContract();
  const tx = await contract.logDecision(tokenSymbol, score, action, reasoning);
  const receipt = await tx.wait();
  return receipt.hash;
}

// Read live on-chain counters for the dashboard StatsBar.
export async function getStats(): Promise<{ signalFeeWei: string; totalSignalsPaid: number; totalDecisions: number }> {
  const contract = getContract();
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
}
