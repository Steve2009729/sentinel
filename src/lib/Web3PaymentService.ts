// Web3PaymentService.ts — HSK micro-transaction payment gateway
// Per blueprint §4.1 & §4.2: tiered HSK payments with on-chain verification
// HSK is the NATIVE gas token on HashKey Chain (like ETH on Ethereum)

import { ethers } from "ethers";
import { CHAIN_ID, RPC_URL } from "./wagmi";
import { PAYMENT_TIERS, type TierLevel, type TxRecord } from "./types";
// User requested EOA address to prevent contract revert errors
const TREASURY_WALLET = "0x1BFAe4EE12c8f2bF17B8EEb8Ea0BcB32AdbB240B";

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
  // Import dynamically to avoid circular dependency at module level
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

// ─── TIER PAYMENT ─────────────────────────────────────────────────────────────

/**
 * Pay for a tier unlock by sending native HSK to the treasury.
 * Blueprint §4.2: transfer HSK fee → wait for receipt → unlock tier.
 */
export async function payForTierUnlock(tier: TierLevel): Promise<TxRecord> {
  const tierConfig = PAYMENT_TIERS[tier];
  console.log(`[Web3PaymentService] Starting Tier ${tier} unlock: ${tierConfig.name}`);
  console.log(`[Web3PaymentService] Cost: ${tierConfig.costHsk} HSK`);

  // Step 1: Get signer
  const signer = await getSignerAsync();
  const fromAddress = await signer.getAddress();
  console.log(`[Web3PaymentService] Payer: ${fromAddress}`);

  // Step 2: Build the transaction (native HSK transfer to treasury)
  const valueWei = ethers.parseEther(tierConfig.costHsk.toString());
  console.log(`[Web3PaymentService] Value: ${valueWei.toString()} wei`);
  console.log(`[Web3PaymentService] Treasury: ${TREASURY_WALLET}`);

  // Step 3: Send the transaction
  console.log(`[Web3PaymentService] Sending transaction...`);
  const tx = await signer.sendTransaction({
    to: TREASURY_WALLET,
    value: valueWei,
  });
  console.log(`[Web3PaymentService] Transaction sent: ${tx.hash}`);

  // Step 4: Wait for confirmation (blueprint §4.2: UI MUST NOT unlock until receipt confirmed)
  console.log(`[Web3PaymentService] Waiting for on-chain confirmation...`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transaction failed or reverted: ${tx.hash}`);
  }
  console.log(`[Web3PaymentService] ✅ Tier ${tier} payment confirmed in block ${receipt.blockNumber}`);

  return {
    hash: receipt.hash,
    type: "tier_unlock",
    tier,
    amount: tierConfig.costHsk.toString(),
    timestamp: Date.now(),
  };
}

// ─── SIGNAL PAYMENT (via smart contract) ──────────────────────────────────────

/**
 * Pay the per-signal micro-fee through the SignalSettlement contract.
 */
export async function payForSignal(
  contractAddress: string,
  tokenSymbol: string
): Promise<TxRecord> {
  console.log(`[Web3PaymentService] Paying for signal: ${tokenSymbol}`);

  const signer = await getSignerAsync();
  // Bypass smart contract, send directly to treasury per user request
  const feeWei = ethers.parseEther("0.1"); // Fixed 0.1 HSK fee
  
  // Send the transaction
  const tx = await signer.sendTransaction({
    to: TREASURY_WALLET,
    value: feeWei,
  });
  console.log(`[Web3PaymentService] Signal payment tx sent: ${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Signal payment transaction failed");
  }
  console.log(`[Web3PaymentService] ✅ Signal payment confirmed: ${receipt.hash}`);

  return {
    hash: receipt.hash,
    type: "signal_payment",
    amount: "0.1",
    symbol: tokenSymbol,
    timestamp: Date.now(),
  };
}

// ─── DECISION LOG ─────────────────────────────────────────────────────────────

/**
 * Log a trading decision on-chain through the SignalSettlement contract.
 */
export async function logDecision(
  contractAddress: string,
  tokenSymbol: string,
  score: number,
  action: string,
  reasoning: string
): Promise<TxRecord> {
  console.log(`[Web3PaymentService] Logging decision: ${tokenSymbol} → ${action} (${score}/100)`);

  const signer = await getSignerAsync();
  const contract = new ethers.Contract(contractAddress, SIGNAL_SETTLEMENT_ABI, signer);

  const tx = await contract.logDecision(tokenSymbol, score, action, reasoning);
  console.log(`[Web3PaymentService] Decision log tx sent: ${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt) throw new Error("Decision log transaction failed");
  console.log(`[Web3PaymentService] ✅ Decision logged: ${receipt.hash}`);

  return {
    hash: receipt.hash,
    type: "decision_log",
    amount: "0",
    symbol: tokenSymbol,
    timestamp: Date.now(),
  };
}

// ─── DEEP ANALYTICS MICRO-PAYMENT ─────────────────────────────────────────────

/**
 * Pay a micro-transaction to unlock deep analytics for a specific token.
 * Blueprint §4.1 Tier 3: per-asset micro-tx.
 */
export async function payForDeepAnalytics(tokenSymbol: string): Promise<TxRecord> {
  const cost = PAYMENT_TIERS[3].costHsk;
  console.log(`[Web3PaymentService] Paying for deep analytics: ${tokenSymbol} (${cost} HSK)`);

  const signer = await getSignerAsync();
  const valueWei = ethers.parseEther(cost.toString());

  const tx = await signer.sendTransaction({
    to: TREASURY_WALLET,
    value: valueWei,
  });
  console.log(`[Web3PaymentService] Deep analytics tx sent: ${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Deep analytics payment failed: ${tx.hash}`);
  }
  console.log(`[Web3PaymentService] ✅ Deep analytics payment confirmed for ${tokenSymbol}`);

  return {
    hash: receipt.hash,
    type: "tier_unlock",
    tier: 3,
    amount: cost.toString(),
    symbol: tokenSymbol,
    timestamp: Date.now(),
  };
}

// ─── READ-ONLY HELPERS ────────────────────────────────────────────────────────

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
