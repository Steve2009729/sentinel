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

  // Demo mode — auto-unlock tiers when not on HashKey Chain
  demoMode: boolean;

  // Tiers (persisted per session per wallet)
  unlockedTiers: number[]; // [1, 2, 3]
  unlockedAssets: string[]; // contract addresses unlocked for tier 3

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
  setDemoMode: (demo: boolean) => void;
  unlockTier: (tier: TierLevel) => void;
  unlockAsset: (contractAddress: string) => void;
  isTierUnlocked: (tier: TierLevel) => boolean;
  isAssetUnlocked: (contractAddress: string) => boolean;
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
  demoMode: true, // Default to demo mode — most users won't have HSK
  unlockedTiers: [] as number[],
  unlockedAssets: [] as string[],
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
          // Auto-detect demo mode: if not on HashKey Chain (177), enable demo
          demoMode: chainId !== 177,
        }),

      disconnectWallet: () =>
        set({
          ...initialState,
        }),

      updateBalance: (balance) => set({ balance }),

      setDemoMode: (demoMode) => set({ demoMode }),

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
        // Tier 2 (AI Signals) is unlocked in demo mode
        if (get().demoMode && tier === 2) return true;
        return get().unlockedTiers.includes(tier);
      },

      isAssetUnlocked: (contractAddress) =>
        get().unlockedAssets.includes(contractAddress.toLowerCase()),

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
        paymentHistory: state.paymentHistory,
        demoMode: state.demoMode,
      }),
    }
  )
);
