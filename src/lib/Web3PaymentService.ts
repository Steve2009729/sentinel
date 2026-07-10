// Web3PaymentService.ts
// Sends native HSK to the treasury wallet using whatever wallet the user
// explicitly connected with — never falls back to window.ethereum.

import { ethers } from "ethers";
import { RPC_URL } from "./wagmi";
import { PAYMENT_TIERS, type TierLevel, type TxRecord } from "./types";

const TREASURY_WALLET = "0x1BFAe4EE12c8f2bF17B8EEb8Ea0BcB32AdbB240B";
const GAS_LIMIT = BigInt(21000);

const SIGNAL_SETTLEMENT_ABI = [
  "function logDecision(string tokenSymbol, uint256 score, string action, string reasoning) returns (uint256)",
  "function signalFee() view returns (uint256)",
  "function totalSignalsPaid() view returns (uint256)",
  "function totalDecisions() view returns (uint256)",
];

// ─── GET THE PROVIDER THE USER ACTUALLY CONNECTED WITH ───────────────────────
// We NEVER fall back to window.ethereum here because that may be a different
// wallet (e.g. Trust Wallet) than what the user chose in the EIP-6963 picker.

function getConnectedProvider(): any {
  if (typeof window === "undefined") {
    throw new Error("Cannot use wallet outside browser");
  }

  // 1. Use the provider that was explicitly set by WalletConnect when user connected
  const { getActiveProvider } = require("./contracts-client");
  const active = getActiveProvider();
  if (active) return active;

  // 2. activeProvider is null (page was reloaded). Try to re-find the right provider
  //    by checking which EIP-6963 provider has the stored connected address.
  const win = window as any;
  let storedAddress = "";
  try {
    const raw = localStorage.getItem("sentinel-store");
    if (raw) storedAddress = JSON.parse(raw)?.state?.walletAddress?.toLowerCase() || "";
  } catch {}

  if (!storedAddress) {
    throw new Error("No wallet connected. Please disconnect and reconnect your wallet.");
  }

  // Check providers array (multi-wallet environments like MetaMask + Coinbase)
  const providers: any[] = win.ethereum?.providers || [];
  for (const p of providers) {
    try {
      // Check selectedAddress first (synchronous, no popup)
      const addr = (p.selectedAddress || "").toLowerCase();
      if (addr && addr === storedAddress) return p;
    } catch {}
  }

  // Single provider environment
  if (win.ethereum) {
    const addr = (win.ethereum.selectedAddress || "").toLowerCase();
    if (addr === storedAddress) return win.ethereum;
  }

  // Could not find matching provider — force user to reconnect
  throw new Error(
    "Your wallet session expired. Please click Disconnect then reconnect your wallet before paying."
  );
}

async function getSigner(): Promise<ethers.JsonRpcSigner> {
  const provider = getConnectedProvider();
  const bp = new ethers.BrowserProvider(provider);

  // Request accounts silently (no popup if already connected)
  try {
    await provider.request({ method: "eth_accounts" });
  } catch {}

  return bp.getSigner();
}

async function sendHsk(amountHsk: number): Promise<ethers.TransactionReceipt> {
  const signer = await getSigner();
  const to = ethers.getAddress(TREASURY_WALLET);
  const value = ethers.parseEther(String(amountHsk));

  console.log(`[Payment] ${amountHsk} HSK → ${to}`);

  const tx = await signer.sendTransaction({ to, value, gasLimit: GAS_LIMIT });
  console.log(`[Payment] sent: ${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`TX failed: ${tx.hash}`);
  console.log(`[Payment] ✅ block ${receipt.blockNumber}`);
  return receipt;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function payForTierUnlock(tier: TierLevel): Promise<TxRecord> {
  const cfg = PAYMENT_TIERS[tier];
  const receipt = await sendHsk(cfg.costHsk);
  return { hash: receipt.hash, type: "tier_unlock", tier, amount: String(cfg.costHsk), timestamp: Date.now() };
}

export async function payForDeepAnalytics(tokenSymbol: string): Promise<TxRecord> {
  const cost = PAYMENT_TIERS[3].costHsk;
  const receipt = await sendHsk(cost);
  return { hash: receipt.hash, type: "tier_unlock", tier: 3, amount: String(cost), symbol: tokenSymbol, timestamp: Date.now() };
}

export async function payForSignal(_contractAddress: string, tokenSymbol: string): Promise<TxRecord> {
  const receipt = await sendHsk(0.1);
  return { hash: receipt.hash, type: "signal_payment", amount: "0.1", symbol: tokenSymbol, timestamp: Date.now() };
}

export async function logDecision(contractAddress: string, tokenSymbol: string, score: number, action: string, reasoning: string): Promise<TxRecord> {
  const signer = await getSigner();
  const contract = new ethers.Contract(contractAddress, SIGNAL_SETTLEMENT_ABI, signer);
  const tx = await contract.logDecision(tokenSymbol, score, action, reasoning);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("logDecision failed");
  return { hash: receipt.hash, type: "decision_log", amount: "0", symbol: tokenSymbol, timestamp: Date.now() };
}

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
