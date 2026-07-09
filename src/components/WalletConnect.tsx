"use client";

import { useEffect, useState, useRef } from "react";
import {
  isWalletAvailable,
  checkAndSwitchNetwork,
  getUserAddress,
  getUserBalance,
  setActiveProvider,
  getActiveProvider,
  signAuthMessage,
} from "@/lib/contracts-client";
import { theme } from "@/lib/theme";
import { useStore } from "@/lib/store";

// ─── EIP-6963 WALLET DISCOVERY ────────────────────────────────────────────────

interface DetectedWallet {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
  provider: any;
}

const KNOWN_WALLETS = {
  metamask: {
    name: "MetaMask",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect rx='8' width='40' height='40' fill='%23F6851B'/%3E%3Ctext x='20' y='26' text-anchor='middle' font-size='20' fill='white'%3E🦊%3C/text%3E%3C/svg%3E",
  },
  trust: {
    name: "Trust Wallet",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect rx='8' width='40' height='40' fill='%230500FF'/%3E%3Ctext x='20' y='26' text-anchor='middle' font-size='20' fill='white'%3E🛡%3C/text%3E%3C/svg%3E",
  },
  coinbase: {
    name: "Coinbase Wallet",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect rx='8' width='40' height='40' fill='%230052FF'/%3E%3Ctext x='20' y='26' text-anchor='middle' font-size='20' fill='white'%3EC%3C/text%3E%3C/svg%3E",
  },
  rabby: {
    name: "Rabby Wallet",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect rx='8' width='40' height='40' fill='%238697FF'/%3E%3Ctext x='20' y='26' text-anchor='middle' font-size='20' fill='white'%3E🐰%3C/text%3E%3C/svg%3E",
  },
};

function useEIP6963Wallets() {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const detected: DetectedWallet[] = [];

    function handleAnnounce(event: any) {
      const { info, provider } = event.detail || {};
      if (!info || !provider) return;
      if (detected.some((w) => w.uuid === info.uuid)) return;
      detected.push({ uuid: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns || "", provider });
      setWallets([...detected]);
    }

    window.addEventListener("eip6963:announceProvider", handleAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const fallbackTimer = setTimeout(() => {
      if (detected.length === 0 && (window as any).ethereum) {
        const eth = (window as any).ethereum;
        let name = "Browser Wallet";
        let icon = KNOWN_WALLETS.metamask.icon;
        if (eth.isMetaMask) { name = "MetaMask"; }
        else if (eth.isTrust) { name = "Trust Wallet"; icon = KNOWN_WALLETS.trust.icon; }
        else if (eth.isCoinbaseWallet) { name = "Coinbase Wallet"; icon = KNOWN_WALLETS.coinbase.icon; }
        else if (eth.isRabby) { name = "Rabby"; icon = KNOWN_WALLETS.rabby.icon; }
        detected.push({ uuid: "legacy-injected", name, icon, rdns: "legacy", provider: eth });
        setWallets([...detected]);
      }
    }, 600);

    return () => {
      window.removeEventListener("eip6963:announceProvider", handleAnnounce);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return wallets;
}

// ─── WALLET CONNECT COMPONENT ─────────────────────────────────────────────────

interface WalletConnectProps {
  onConnected?: (address: string) => void;
  onDisconnected?: () => void;
}

export default function WalletConnect({ onConnected, onDisconnected }: WalletConnectProps) {
  const [address, setAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [connecting, setConnecting] = useState(false);
  const [chainError, setChainError] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const { setWallet, disconnectWallet, updateBalance, isConnected, walletAddress } = useStore();
  const detectedWallets = useEIP6963Wallets();
  const modalRef = useRef<HTMLDivElement>(null);
  const initDone = useRef(false);

  // Close modal on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setShowModal(false);
      }
    }
    if (showModal) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showModal]);

  // On mount: restore session from persisted store or live provider
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    restoreSession();
  }, []);

  async function restoreSession() {
    // If store has a persisted connection, restore UI immediately
    const store = useStore.getState();
    if (store.isConnected && store.walletAddress) {
      setAddress(store.walletAddress);
      setBalance(store.balance || "0");

      // Try to silently re-attach to the provider
      const provider = getActiveProvider();
      if (provider) {
        try {
          const accounts: string[] = await provider.request({ method: "eth_accounts" });
          if (accounts?.length && accounts[0].toLowerCase() === store.walletAddress.toLowerCase()) {
            attachProviderListeners(provider);
            const freshBal = await getUserBalance();
            setBalance(freshBal);
            updateBalance(freshBal);
            onConnected?.(store.walletAddress);
            return;
          }
        } catch {}
      }
      // Provider unavailable but we have persisted state — still show as connected
      onConnected?.(store.walletAddress);
      return;
    }

    // No persisted state — check if provider already has accounts
    const provider = getActiveProvider();
    if (!provider) return;
    try {
      const accounts: string[] = await provider.request({ method: "eth_accounts" });
      if (accounts?.length) {
        const addr = accounts[0];
        if (store.isAddressSigned(addr)) {
          const bal = await getUserBalance();
          setAddress(addr);
          setBalance(bal);
          setWallet(addr, bal, 177);
          attachProviderListeners(provider);
          onConnected?.(addr);
        }
      }
    } catch {}
  }

  function attachProviderListeners(provider: any) {
    function onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) {
        setAddress("");
        setBalance("0");
        setActiveProvider(null);
        disconnectWallet();
        onDisconnected?.();
      } else {
        const newAddr = accounts[0];
        setAddress(newAddr);
        getUserBalance().then((b) => {
          setBalance(b);
          useStore.getState().setWallet(newAddr, b, 177);
        });
        onConnected?.(newAddr);
      }
    }

    function onChainChanged(chainHex: string) {
      const chainId = parseInt(chainHex, 16);
      if (chainId !== 177) {
        // Silently try to switch back — don't reload page
        checkAndSwitchNetwork().catch(() => {});
      }
    }

    try {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    } catch {}
    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
  }

  async function loadBalance() {
    const bal = await getUserBalance();
    setBalance(bal);
    updateBalance(bal);
  }

  async function connectWallet(wallet: DetectedWallet) {
    setConnecting(true);
    setChainError("");
    setShowModal(false);

    try {
      setActiveProvider(wallet.provider);

      // Request accounts — correct method, triggers wallet popup
      let accounts: string[];
      try {
        accounts = await wallet.provider.request({ method: "eth_requestAccounts" });
      } catch (e: any) {
        if (e.code === 4001) throw new Error("Connection rejected by user");
        throw e;
      }

      if (!accounts?.length) throw new Error("No accounts returned");
      const addr = accounts[0];

      // Sign auth message if not yet signed for this address
      const store = useStore.getState();
      if (!store.isAddressSigned(addr)) {
        const signed = await signAuthMessage();
        if (!signed) throw new Error("Signature required to access Sentinel");
        store.addSignedAddress(addr);
      }

      // Switch to HashKey Chain
      const switched = await checkAndSwitchNetwork();
      if (!switched) {
        setChainError("Could not switch to HashKey Chain. Please switch manually in your wallet.");
        setConnecting(false);
        return;
      }

      await new Promise((r) => setTimeout(r, 300));

      const bal = await getUserBalance();
      setAddress(addr);
      setBalance(bal);
      setWallet(addr, bal, 177);
      attachProviderListeners(wallet.provider);
      onConnected?.(addr);
    } catch (error: any) {
      console.error("[WalletConnect] Error:", error);
      if (error.code === 4001 || error.message?.includes("rejected") || error.message?.includes("Signature")) {
        setChainError(error.message || "Connection cancelled");
      } else {
        setChainError(error.message || "Failed to connect wallet");
      }
      setActiveProvider(null);
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    setAddress("");
    setBalance("0");
    setChainError("");
    setActiveProvider(null);
    disconnectWallet();
    onDisconnected?.();
  }

  // ─── CONNECTED STATE ─────────────────────────────────────────────────────────
  if (address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: theme.text, fontWeight: 700, fontFamily: "var(--font-geist-mono), monospace" }}>
            {parseFloat(balance).toFixed(4)} HSK
          </div>
          <div style={{ fontSize: 11, color: theme.muted, fontFamily: "var(--font-geist-mono), monospace" }}>
            {address.slice(0, 6)}…{address.slice(-4)}
          </div>
        </div>
        <button onClick={handleDisconnect} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
          Disconnect
        </button>
      </div>
    );
  }

  // ─── DISCONNECTED STATE ───────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowModal(true)}
        disabled={connecting}
        className="wallet-connect-btn"
        style={{
          padding: "14px 32px",
          fontSize: 15,
          fontWeight: 800,
          background: "linear-gradient(135deg, #00E5A0, #5B8DEF, #A855F7)",
          backgroundSize: "200% 200%",
          animation: "gradient-shift 4s ease infinite",
          color: "#06070D",
          border: "none",
          borderRadius: 14,
          cursor: connecting ? "not-allowed" : "pointer",
          opacity: connecting ? 0.7 : 1,
          boxShadow: "0 4px 24px rgba(0, 229, 160, 0.3), 0 0 60px rgba(0, 229, 160, 0.1)",
          transition: "all 0.3s ease",
          letterSpacing: "-0.3px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {connecting ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="animate-blink">●</span> Connecting…
          </span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="3" />
              <path d="M16 14h.01" /><path d="M2 10h20" />
            </svg>
            Connect Wallet
          </span>
        )}
      </button>

      {chainError && (
        <div style={{ color: theme.warning, fontSize: 12, marginTop: 8, textAlign: "center", maxWidth: 280 }}>
          {chainError}
        </div>
      )}

      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            ref={modalRef}
            className="animate-fadeInScale"
            style={{
              background: "linear-gradient(180deg, #0D0F1A 0%, #080A14 100%)",
              border: "1px solid rgba(0,229,160,0.15)",
              borderRadius: 24, padding: "32px 28px 28px",
              maxWidth: 420, width: "90%",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 120px rgba(0,229,160,0.06)",
              position: "relative", overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 300, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,229,160,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,160,0.015) 2px, rgba(0,229,160,0.015) 4px)", borderRadius: 24 }} />

            <button
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.muted, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, zIndex: 1 }}
            >✕</button>

            <div style={{ textAlign: "center", marginBottom: 28, position: "relative", zIndex: 1 }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", marginBottom: 16, boxShadow: "0 0 30px rgba(0,229,160,0.1)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="14" rx="3" /><path d="M16 14h.01" /><path d="M2 10h20" />
                </svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: theme.text, margin: 0, letterSpacing: "-0.5px" }}>Connect Wallet</h3>
              <p style={{ fontSize: 13, color: theme.muted, margin: "8px 0 0", lineHeight: 1.4 }}>
                Select your wallet to connect to HashKey Chain
              </p>
            </div>

            <div style={{ display: "grid", gap: 8, position: "relative", zIndex: 1 }}>
              {detectedWallets.length > 0 ? (
                detectedWallets.map((wallet) => (
                  <WalletOption key={wallet.uuid} wallet={wallet} onClick={() => connectWallet(wallet)} />
                ))
              ) : (
                <>
                  <div style={{ padding: "24px 16px", textAlign: "center", background: theme.panelAlt, borderRadius: 14, border: `1px solid ${theme.border}` }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔌</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 6 }}>No wallets detected</div>
                    <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.5 }}>Install a Web3 wallet extension to connect.</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { name: "MetaMask", url: "https://metamask.io/download/", emoji: "🦊" },
                      { name: "Trust Wallet", url: "https://trustwallet.com/browser-extension", emoji: "🛡️" },
                      { name: "Rabby", url: "https://rabby.io/", emoji: "🐰" },
                      { name: "Coinbase", url: "https://www.coinbase.com/wallet", emoji: "🔵" },
                    ].map((w) => (
                      <a key={w.name} href={w.url} target="_blank" rel="noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12, fontWeight: 600, color: theme.text, textDecoration: "none" }}>
                        <span style={{ fontSize: 18 }}>{w.emoji}</span><span>{w.name}</span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, position: "relative", zIndex: 1 }}>
              <div className="live-dot" style={{ width: 5, height: 5 }} />
              <span style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.3 }}>EVM Compatible · HashKey Chain (ID: 177)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WalletOption({ wallet, onClick }: { wallet: DetectedWallet; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 16px", background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 14, cursor: "pointer", transition: "all 0.2s ease", textAlign: "left" }}
      onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "rgba(0,229,160,0.3)"; el.style.background = "rgba(0,229,160,0.04)"; el.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = theme.border; el.style.background = theme.panelAlt; el.style.transform = "translateY(0)"; }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, overflow: "hidden", flexShrink: 0, border: `1px solid ${theme.border}`, background: theme.panel, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={wallet.icon} alt={wallet.name} width={28} height={28} style={{ borderRadius: 6 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{wallet.name}</div>
        <div style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{wallet.rdns === "legacy" ? "Injected Provider" : wallet.rdns}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: theme.accent, display: "flex", alignItems: "center", gap: 4, textTransform: "uppercase" }}>
        Connect
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </div>
    </button>
  );
}
