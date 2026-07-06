// Frontend helpers: contract address, chain metadata, explorer links.

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
export const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "177";

// Signal fee is fixed at deploy time (0.0001 HSK) — used for the "HSK spent" stat.
export const SIGNAL_FEE_HSK = 0.0001;

interface ChainMeta {
  name: string;
  explorer: string;
}

const CHAINS: Record<string, ChainMeta> = {
  "133": { name: "HashKey Testnet", explorer: "https://testnet-explorer.hsk.xyz" },
  "177": { name: "HashKey Mainnet", explorer: "https://hashkey.blockscout.com" },
};

export function chainMeta(): ChainMeta {
  return CHAINS[CHAIN_ID] ?? CHAINS["133"];
}

export function txUrl(hash: string): string {
  return `${chainMeta().explorer}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${chainMeta().explorer}/address/${address}`;
}
