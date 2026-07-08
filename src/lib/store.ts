// Zustand global state store with localStorage persistence
// Per blueprint §4.2: wallet signature verification + session tier persistence

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Signal, AgentResult, TxRecord, TierLevel } from "./types";

interface SentinelState {
  // Wallet
  walletAddress: string;
  balance: string;
  chainId: number;
  isConnected: boolean;



  // Tiers (persisted per session per wallet)
  unlockedTiers: number[]; // [1, 2, 3]
  unlockedAssets: string[]; // contract addresses unlocked for tier 3

  // Authentication
  signedAddresses: string[]; // Wallets that have signed the auth message

  // Data
  signals: Signal[];
  agentResults: AgentResult[];
  paymentHistory: TxRecord[];

  // UI
  isLoading: boolean;
  activeTab: "signals" | "ai-signals" | "checker";

  // Actions
  setWallet: (address: string, balance: string, chainId: number) => void;
  disconnectWallet: () => void;
  updateBalance: (balance: string) => void;

  unlockTier: (tier: TierLevel) => void;
  unlockAsset: (contractAddress: string) => void;
  isTierUnlocked: (tier: TierLevel) => boolean;
  isAssetUnlocked: (contractAddress: string) => boolean;
  addSignedAddress: (address: string) => void;
  isAddressSigned: (address: string) => boolean;
  setSignals: (signals: Signal[]) => void;
  addAgentResults: (results: AgentResult[]) => void;
  addPayment: (tx: TxRecord) => void;
  setLoading: (loading: boolean) => void;
  setActiveTab: (tab: "signals" | "ai-signals" | "checker") => void;
  reset: () => void;
}

const initialState = {
  walletAddress: "",
  balance: "0",
  chainId: 0,
  isConnected: false,

  unlockedTiers: [] as number[],
  unlockedAssets: [] as string[],
  signedAddresses: [] as string[],
  signals: [] as Signal[],
  agentResults: [] as AgentResult[],
  paymentHistory: [] as TxRecord[],
  isLoading: false,
  activeTab: "signals" as const,
};

export const useStore = create<SentinelState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setWallet: (address, balance, chainId) =>
        set({
          walletAddress: address,
          balance,
          chainId,
          isConnected: true,

        }),

      disconnectWallet: () =>
        set({
          ...initialState,
        }),

      updateBalance: (balance) => set({ balance }),



      unlockTier: (tier) => {
        const current = get().unlockedTiers;
        if (!current.includes(tier)) {
          console.log(`[Sentinel] Tier ${tier} unlocked`);
          set({ unlockedTiers: [...current, tier] });
        }
      },

      unlockAsset: (contractAddress) => {
        const current = get().unlockedAssets;
        if (!current.includes(contractAddress.toLowerCase())) {
          console.log(`[Sentinel] Asset ${contractAddress} unlocked for deep analytics`);
          set({ unlockedAssets: [...current, contractAddress.toLowerCase()] });
        }
      },

      isTierUnlocked: (tier) => {
        // Tier 1 (Live Launches Feed) is always free
        if (tier === 1) return true;

        return get().unlockedTiers.includes(tier);
      },

      isAssetUnlocked: (contractAddress) =>
        get().unlockedAssets.includes(contractAddress.toLowerCase()),

      addSignedAddress: (address) => {
        const current = get().signedAddresses;
        if (!current.includes(address.toLowerCase())) {
          console.log(`[Sentinel] Wallet authenticated: ${address}`);
          set({ signedAddresses: [...current, address.toLowerCase()] });
        }
      },

      isAddressSigned: (address) =>
        get().signedAddresses.includes(address.toLowerCase()),

      setSignals: (signals) => set({ signals }),

      addAgentResults: (results) =>
        set((state) => ({
          agentResults: [...results, ...state.agentResults].slice(0, 50),
        })),

      addPayment: (tx) =>
        set((state) => ({
          paymentHistory: [tx, ...state.paymentHistory].slice(0, 100),
        })),

      setLoading: (isLoading) => set({ isLoading }),

      setActiveTab: (activeTab) => set({ activeTab }),

      reset: () => set(initialState),
    }),
    {
      name: "sentinel-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist wallet-specific and tier data, not transient UI state
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        unlockedTiers: state.unlockedTiers,
        unlockedAssets: state.unlockedAssets,
        signedAddresses: state.signedAddresses,
        paymentHistory: state.paymentHistory,

      }),
    }
  )
);
