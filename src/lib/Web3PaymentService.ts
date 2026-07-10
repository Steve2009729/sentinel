// Web3PaymentService.ts — HSK micro-transaction payment gateway
// HSK is the NATIVE gas token on HashKey Chain (like ETH on Ethereum)
// Payments go directly to the treasury EOA wallet — no contract call needed.
// gasLimit is hardcoded to 21000 to skip estimateGas (which fails on some RPCs).

import { ethers } from "ethers";
import { RPC_URL } from "./wagmi";
import { PAYMENT_TIERS, type TierLevel, type TxRecord } from "./types";

// ─── TREASURY ─────────────────────────────────────────────────────────────────
// This is the EOA wallet derived from the PRIVATE_KEY in .env.
// All tier payments (0.1 HSK) are sent here as plain native transfers.
const TREASURY_WALLET = "0x1BFAe4EE12c8f2bF17B8EEb8Ea0BcB32AdbB240B";

// Plain native HSK transfer always costs 21 000 gas.
// Hardcoding this skips the estimateGas RPC call which fails on HashKey Chain.
const NATIVE_TRANSFER_GAS = BigInt(21000);

const SIGNAL_SETTLEMENT_ABI = [
  "function payForSignal(string tokenSymbol) payable returns (uint256)",
  "function logDecision(string tokenSymbol, uint256 score, string action, string reasoning) returns (uint256)",
  "function signalFee() view returns (uint256)",
  "function totalSignalsPaid() view returns (uint256)",
  "function totalDecisions() view returns (uint256)",
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getProviderOrThrow(): any {
  if (typeof window === "undefined") throw new Error("Cannot use wallet in server context");
  const { getActiveProvider } = require("./contracts-client");
  const provider = getActiveProvider();
  if (!provider) throw new Error("No wallet connected. Please connect a wallet first.");
  return provider;
}

async function getSignerAsync(): Promise<ethers.JsonRpcSigner> {
  const provider = getProviderOrThrow();
  const bp = new ethers.BrowserProvider(provider);
  return bp.getSigner();
}

/**
 * Send a plain native HSK transfer with explicit gasLimit so ethers v6
 * never calls estimateGas (which fails on HashKey Chain RPC).
 */
async function sendHsk(signer: ethers.JsonRpcSigner, amountHsk: number): Promise<ethers.TransactionReceipt> {
  const to = ethers.getAddress(TREASURY_WALLET); // checksum
  const value = ethers.parseEther(amountHsk.toString());

  console.log(`[Payment] Sending ${amountHsk} HSK → ${to}`);

  const tx = await signer.sendTransaction({
    to,
    value,
    gasLimit: NATIVE_TRANSFER_GAS, // skip estimateGas — plain transfer is always 21 000
  });

  console.log(`[Payment] tx sent: ${tx.hash}`);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transaction failed: ${tx.hash}`);
  }

  console.log(`[Payment] ✅ confirmed in block ${receipt.blockNumber}`);
  return receipt;
}

// ─── TIER UNLOCK ──────────────────────────────────────────────────────────────

export async function payForTierUnlock(tier: TierLevel): Promise<TxRecord> {
  const tierConfig = PAYMENT_TIERS[tier];
  console.log(`[Payment] Tier ${tier} unlock — ${tierConfig.costHsk} HSK`);

  const signer = await getSignerAsync();
  const receipt = await sendHsk(signer, tierConfig.costHsk);

  return {
    hash: receipt.hash,
    type: "tier_unlock",
    tier,
    amount: tierConfig.costHsk.toString(),
    timestamp: Date.now(),
  };
}

// ─── DEEP ANALYTICS ───────────────────────────────────────────────────────────

export async function payForDeepAnalytics(tokenSymbol: string): Promise<TxRecord> {
  const cost = PAYMENT_TIERS[3].costHsk;
  console.log(`[Payment] Deep analytics for ${tokenSymbol} — ${cost} HSK`);

  const signer = await getSignerAsync();
  const receipt = await sendHsk(signer, cost);

  return {
    hash: receipt.hash,
    type: "tier_unlock",
    tier: 3,
    amount: cost.toString(),
    symbol: tokenSymbol,
    timestamp: Date.now(),
  };
}

// ─── SIGNAL PAYMENT ───────────────────────────────────────────────────────────

export async function payForSignal(
  _contractAddress: string,
  tokenSymbol: string
): Promise<TxRecord> {
  console.log(`[Payment] Signal payment for ${tokenSymbol}`);

  const signer = await getSignerAsync();
  const receipt = await sendHsk(signer, 0.1);

  return {
    hash: receipt.hash,
    type: "signal_payment",
    amount: "0.1",
    symbol: tokenSymbol,
    timestamp: Date.now(),
  };
}

// ─── DECISION LOG ─────────────────────────────────────────────────────────────

export async function logDecision(
  contractAddress: string,
  tokenSymbol: string,
  score: number,
  action: string,
  reasoning: string
): Promise<TxRecord> {
  console.log(`[Payment] Logging decision: ${tokenSymbol} → ${action} (${score}/100)`);

  const signer = await getSignerAsync();
  const contract = new ethers.Contract(contractAddress, SIGNAL_SETTLEMENT_ABI, signer);
  const tx = await contract.logDecision(tokenSymbol, score, action, reasoning);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Decision log transaction failed");

  return {
    hash: receipt.hash,
    type: "decision_log",
    amount: "0",
    symbol: tokenSymbol,
    timestamp: Date.now(),
  };
}

// ─── READ-ONLY STATS ──────────────────────────────────────────────────────────

export async function getContractStats(contractAddress: string) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(contractAddress, SIGNAL_SETTLEMENT_ABI, provider);

  const [fee, signals, decisions] = await Promise.all([
    contract.signalFee(),
    contract.totalSignalsPaid(),
    contract.totalDecisions(),
  ]);

  return {
    signalFeeWei: fee.toString(),
    signalFeeHsk: ethers.formatEther(fee),
    totalSignalsPaid: Number(signals),
    totalDecisions: Number(decisions),
  };
}
