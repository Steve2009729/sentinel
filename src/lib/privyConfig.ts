/**
 * privyConfig.ts — Phase 10, Part 2
 * Privy configuration for HashKey Chain.
 * HashKey Chain is added as a custom EVM chain via viem's defineChain.
 * Existing MetaMask/EIP-6963 wallet connect is NOT replaced — Privy sits
 * alongside it as an additional email/social login entry point.
 */

// defineChain is a plain function from viem — no extra install needed,
// viem is already a transitive dep of ethers/Privy.
// We define it manually to avoid importing viem directly into the client bundle.
export const hashkeyChain = {
  id: 177,
  name: "HashKey Chain",
  network: "hashkeychain-mainnet",
  nativeCurrency: { name: "HashKey Token", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.hsk.xyz"] },
    public: { http: ["https://mainnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: { name: "HashKey Blockscout", url: "https://hashkey.blockscout.com" },
  },
} as const;

export const hashkeyTestnet = {
  id: 133,
  name: "HashKey Chain Testnet",
  network: "hashkeychain-testnet",
  nativeCurrency: { name: "HashKey Token", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hsk.xyz"] },
    public: { http: ["https://testnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: { name: "HashKey Testnet Explorer", url: "https://testnet-explorer.hsk.xyz" },
  },
  testnet: true,
} as const;

// Privy App ID — this needs to be set in .env as NEXT_PUBLIC_PRIVY_APP_ID
// Get one free at https://privy.io (create app → copy App ID)
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "clz0000000000000000000000";
