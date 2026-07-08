// Client-side contract interaction using user's connected wallet
// Supports EIP-6963 multi-wallet discovery — provider is passed explicitly

import { ethers } from "ethers";
import { CHAIN_ID, RPC_URL } from "./wagmi";

const SIGNAL_SETTLEMENT_ABI = [
  "function payForSignal(string tokenSymbol) payable returns (uint256)",
  "function logDecision(string tokenSymbol, uint256 score, string action, string reasoning) returns (uint256)",
  "function signalFee() view returns (uint256)",
  "function totalSignalsPaid() view returns (uint256)",
  "function totalDecisions() view returns (uint256)",
];

// ─── PROVIDER MANAGEMENT ──────────────────────────────────────────────────────

// Store the currently active provider (set by WalletConnect component)
let activeProvider: any = null;

export function setActiveProvider(provider: any) {
  activeProvider = provider;
}

export function getActiveProvider(): any {
  return activeProvider || (typeof window !== "undefined" ? window.ethereum : null);
}

// Check if any wallet provider is available
export function isWalletAvailable(): boolean {
  if (typeof window !== "undefined") {
    try {
      const state = JSON.parse(localStorage.getItem("sentinel-store") || "{}");
      if (state?.state?.demoMode || state?.state?.isConnected) {
        return true;
      }
    } catch {}
  }
  return typeof window !== "undefined" && getActiveProvider() !== null;
}

// ─── SIGNER & ADDRESS ─────────────────────────────────────────────────────────

export async function getUserSigner(): Promise<ethers.Signer | null> {
  const provider = getActiveProvider();
  if (!provider) return null;
  try {
    const bp = new ethers.BrowserProvider(provider);
    return bp.getSigner();
  } catch (e) {
    console.error("Failed to get signer:", e);
    return null;
  }
}

export async function getUserAddress(): Promise<string> {
  const provider = getActiveProvider();
  if (!provider) {
    if (typeof window !== "undefined") {
      try {
        const state = JSON.parse(localStorage.getItem("sentinel-store") || "{}");
        return state?.state?.walletAddress || "";
      } catch {}
    }
    return "";
  }
  try {
    const bp = new ethers.BrowserProvider(provider);
    const signer = await bp.getSigner();
    return await signer.getAddress();
  } catch (e) {
    console.error("Failed to get address:", e);
    return "";
  }
}

export async function getUserBalance(): Promise<string> {
  const provider = getActiveProvider();
  if (!provider) {
    if (typeof window !== "undefined") {
      try {
        const state = JSON.parse(localStorage.getItem("sentinel-store") || "{}");
        return state?.state?.balance || "100.0000";
      } catch {}
    }
    return "0";
  }
  try {
    const bp = new ethers.BrowserProvider(provider);
    const signer = await bp.getSigner();
    const address = await signer.getAddress();
    const balance = await bp.getBalance(address);
    return ethers.formatEther(balance);
  } catch (e) {
    console.error("Failed to get balance:", e);
    return "0";
  }
}

export async function signAuthMessage(): Promise<boolean> {
  try {
    const signer = await getUserSigner();
    if (!signer) return false;
    const address = await signer.getAddress();
    const message = `Welcome to Sentinel!\n\nPlease sign this message to authenticate your wallet.\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
    const signature = await signer.signMessage(message);
    return !!signature;
  } catch (error) {
    console.error("Signature rejected:", error);
    return false;
  }
}

// ─── NETWORK SWITCHING ────────────────────────────────────────────────────────

export async function checkAndSwitchNetwork(): Promise<boolean> {
  const provider = getActiveProvider();
  if (!provider) return false;
  try {
    let networkChainId: number | null = null;
    try {
      const chainIdHex = await provider.request({ method: "eth_chainId" });
      if (typeof chainIdHex === "string") {
        networkChainId = chainIdHex.startsWith("0x") ? parseInt(chainIdHex, 16) : Number(chainIdHex);
      } else {
        networkChainId = Number(chainIdHex);
      }
    } catch {
      const bp = new ethers.BrowserProvider(provider);
      const network = await bp.getNetwork();
      const cid: any = network.chainId;
      if (typeof cid === "bigint") networkChainId = Number(cid);
      else if (typeof cid === "number") networkChainId = cid;
      else if (typeof cid === "string" && cid.startsWith("0x")) networkChainId = parseInt(cid, 16);
      else networkChainId = Number(cid ?? 0);
    }

    if (networkChainId === CHAIN_ID) return true;

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
    return true;
  } catch (error: any) {
    if (error?.code === -32002) {
      console.warn("Request already pending in wallet UI (code -32002)");
      return false;
    }
    if (error?.code === 4902) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${CHAIN_ID.toString(16)}`,
              chainName: "HashKey Chain",
              rpcUrls: [RPC_URL],
              blockExplorerUrls: ["https://hashkey.blockscout.com"],
              nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error("Failed to add HashKey Chain:", addError);
        return false;
      }
    }
    console.error("Failed to switch network:", error);
    return false;
  }
}

// ─── CONTRACT INTERACTIONS ────────────────────────────────────────────────────

export async function payForSignalWithUserWallet(
  contractAddress: string,
  tokenSymbol: string
): Promise<string> {
  const signer = await getUserSigner();
  if (!signer) throw new Error("No signer available");
  
  const contract = new ethers.Contract(
    contractAddress,
    SIGNAL_SETTLEMENT_ABI,
    signer
  );
  
  const fee = await contract.signalFee();
  const tx = await contract.payForSignal(tokenSymbol, { value: fee });
  const receipt = await tx.wait();
  
  if (!receipt) throw new Error("Transaction failed");
  return receipt.hash;
}

export async function logDecisionWithUserWallet(
  contractAddress: string,
  tokenSymbol: string,
  score: number,
  action: string,
  reasoning: string
): Promise<string> {
  const signer = await getUserSigner();
  if (!signer) throw new Error("No signer available");
  
  const contract = new ethers.Contract(
    contractAddress,
    SIGNAL_SETTLEMENT_ABI,
    signer
  );
  
  const tx = await contract.logDecision(tokenSymbol, score, action, reasoning);
  const receipt = await tx.wait();
  
  if (!receipt) throw new Error("Transaction failed");
  return receipt.hash;
}
