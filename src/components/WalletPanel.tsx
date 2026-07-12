"use client";

/**
 * WalletPanel.tsx
 *
 * Shows the connected wallet's balances across HashKey Chain, Base, and
 * Ethereum — no seed phrase, no key management. This is a READ-ONLY view
 * of the same address the user connected with. Users sign transactions
 * with their existing wallet; this panel just shows them their holdings.
 *
 * Fetches:
 *  - Native balances (HSK, ETH on Base, ETH on Ethereum) via public RPC
 *  - Known ERC-20 tokens on each chain (from signals + unlocked assets)
 *  - Live USD prices from GeckoTerminal
 *
 * All in parallel with 5s timeouts — never blocks the dashboard.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { theme } from "@/lib/theme";
import { useStore } from "@/lib/store";

// ─── CHAIN CONFIG ─────────────────────────────────────────────────────────────

const CHAINS = [
  {
    id: "hashkey",
    label: "HashKey Chain",
    icon: "🔑",
    color: "#00E5A0",
    rpc: "https://mainnet.hsk.xyz",
    nativeSymbol: "HSK",
    nativeName: "HashKey Token",
    explorerBase: "https://hashkey.blockscout.com",
    geckoNet: "hashkey",
  },
  {
    id: "base",
    label: "Base",
    icon: "⚡",
    color: "#5B8DEF",
    rpc: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    nativeName: "Ethereum",
    explorerBase: "https://basescan.org",
    geckoNet: "base",
  },
  {
    id: "ethereum",
    label: "Ethereum",
    icon: "Ξ",
    color: "#A855F7",
    rpc: "https://cloudflare-eth.com",
    nativeSymbol: "ETH",
    nativeName: "Ethereum",
    explorerBase: "https://etherscan.io",
    geckoNet: "eth",
  },
] as const;

const ERC20_MIN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
];

// Well-known tokens per chain to always check
const WELL_KNOWN: Record<string, { address: string; symbol: string; name: string }[]> = {
  hashkey: [
    { address: "0xB210D2120d57b758EE163cFfb43e73728c471Cf1", symbol: "WHSK", name: "Wrapped HSK" },
  ],
  base: [
    { address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", symbol: "DEGEN", name: "Degen" },
    { address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", symbol: "BRETT", name: "Brett" },
    { address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", symbol: "VIRTUAL", name: "Virtual Protocol" },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC",   name: "USD Coin" },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH",   name: "Wrapped Ether" },
  ],
  ethereum: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin" },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether" },
    { address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", symbol: "PEPE", name: "Pepe" },
  ],
};

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface TokenBalance {
  symbol: string;
  name: string;
  chain: string;
  chainLabel: string;
  chainIcon: string;
  chainColor: string;
  contractAddress: string | null; // null = native
  balance: number;
  priceUsd: number;
  valueUsd: number;
  change24h: number;
  explorerUrl: string;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(3);
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(2) + "K";
  if (n >= 0.01) return "$" + n.toFixed(2);
  if (n > 0) return "$" + n.toExponential(2);
  return "$0.00";
}

async function safeFetch(url: string, ms = 5000): Promise<unknown> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(id);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

async function getNativePrice(geckoNet: string, symbol: string): Promise<{ price: number; change24h: number }> {
  // Use CoinGecko for ETH and a simple mapping for HSK
  if (symbol === "ETH") {
    const data = await safeFetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true", 4000) as any;
    return {
      price: data?.ethereum?.usd ?? 0,
      change24h: data?.ethereum?.usd_24h_change ?? 0,
    };
  }
  if (symbol === "HSK") {
    // Try CoinGecko — HSK may be listed
    const data = await safeFetch("https://api.coingecko.com/api/v3/simple/price?ids=hashkey-token&vs_currencies=usd&include_24hr_change=true", 4000) as any;
    if (data?.["hashkey-token"]?.usd) {
      return {
        price: data["hashkey-token"].usd,
        change24h: data["hashkey-token"].usd_24h_change ?? 0,
      };
    }
  }
  return { price: 0, change24h: 0 };
}

async function getERC20Price(geckoNet: string, address: string): Promise<{ price: number; change24h: number }> {
  const data = await safeFetch(
    `https://api.geckoterminal.com/api/v2/networks/${geckoNet}/tokens/${address}`,
    4000
  ) as any;
  const attrs = data?.data?.attributes;
  return {
    price: parseFloat(attrs?.price_usd ?? "0") || 0,
    change24h: parseFloat(attrs?.price_change_percentage?.h24 ?? "0") || 0,
  };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function WalletPanel() {
  const { walletAddress, signals, unlockedAssets } = useStore();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUsd, setTotalUsd] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeChain, setActiveChain] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  const loadBalances = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    const results: TokenBalance[] = [];

    await Promise.allSettled(CHAINS.map(async (chain) => {
      try {
        const provider = new ethers.JsonRpcProvider(chain.rpc);

        // 1. Native balance
        const rawNative = await Promise.race([
          provider.getBalance(walletAddress),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
        ]).catch(() => null) as bigint | null;

        if (rawNative !== null) {
          const nativeBal = parseFloat(ethers.formatEther(rawNative));
          const { price, change24h } = await getNativePrice(chain.geckoNet, chain.nativeSymbol);
          results.push({
            symbol: chain.nativeSymbol,
            name: chain.nativeName,
            chain: chain.id,
            chainLabel: chain.label,
            chainIcon: chain.icon,
            chainColor: chain.color,
            contractAddress: null,
            balance: nativeBal,
            priceUsd: price,
            valueUsd: nativeBal * price,
            change24h,
            explorerUrl: `${chain.explorerBase}/address/${walletAddress}`,
          });
        }

        // 2. ERC-20 tokens — well-known + from signals + unlocked assets
        const addrs = new Set<string>();
        (WELL_KNOWN[chain.id] ?? []).forEach(t => addrs.add(t.address.toLowerCase()));
        signals.slice(0, 30).forEach(s => {
          if (s.chain === chain.id && s.contractAddress?.startsWith("0x")) {
            addrs.add(s.contractAddress.toLowerCase());
          }
        });
        unlockedAssets.forEach(a => addrs.add(a.toLowerCase()));

        await Promise.allSettled(Array.from(addrs).map(async (addr) => {
          try {
            const contract = new ethers.Contract(addr, ERC20_MIN_ABI, provider);
            const [rawBal, sym, name, dec] = await Promise.all([
              contract.balanceOf(walletAddress),
              contract.symbol().catch(() => "???"),
              contract.name().catch(() => "Unknown"),
              contract.decimals().catch(() => 18),
            ]);
            const bal = parseFloat(ethers.formatUnits(rawBal, dec));
            if (bal <= 0) return;
            const { price, change24h } = await getERC20Price(chain.geckoNet, addr);
            results.push({
              symbol: sym,
              name,
              chain: chain.id,
              chainLabel: chain.label,
              chainIcon: chain.icon,
              chainColor: chain.color,
              contractAddress: addr,
              balance: bal,
              priceUsd: price,
              valueUsd: bal * price,
              change24h,
              explorerUrl: `${chain.explorerBase}/token/${addr}?a=${walletAddress}`,
            });
          } catch {}
        }));
      } catch {}
    }));

    if (!isMounted.current) return;

    // Sort by USD value descending
    results.sort((a, b) => b.valueUsd - a.valueUsd);
    setBalances(results);
    setTotalUsd(results.reduce((s, r) => s + r.valueUsd, 0));
    setLastRefresh(new Date());
    setLoading(false);
  }, [walletAddress, signals, unlockedAssets]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  if (!walletAddress) {
    return (
      <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>💳</div>
        <div style={{ fontSize: 13, color: theme.muted }}>Connect wallet to view balances</div>
      </div>
    );
  }

  const filtered = activeChain === "all" ? balances : balances.filter(b => b.chain === activeChain);

  return (
    <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 6 }}>
              💳 My Wallet
              {loading && <span className="animate-blink" style={{ color: theme.accent, fontSize: 10 }}>●</span>}
            </div>
            {totalUsd > 0 && (
              <div style={{ fontSize: 18, fontWeight: 800, color: theme.accent, marginTop: 4, fontFamily: "var(--font-geist-mono), monospace" }}>
                {fmtUsd(totalUsd)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {lastRefresh && <span style={{ fontSize: 10, color: theme.muted }}>{lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            <button onClick={loadBalances} disabled={loading}
              style={{ background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>
              ↺
            </button>
          </div>
        </div>

        {/* Wallet address + copy */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: theme.panelAlt, borderRadius: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: theme.accent, fontFamily: "var(--font-geist-mono), monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {walletAddress}
          </span>
          <button
            onClick={() => { navigator.clipboard.writeText(walletAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            style={{ background: "transparent", border: "none", color: copied ? theme.accent : theme.muted, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            {copied ? "✓" : "Copy"}
          </button>
        </div>

        {/* Chain filter */}
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => setActiveChain("all")}
            style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", border: `1px solid ${activeChain === "all" ? theme.accent + "50" : theme.border}`, background: activeChain === "all" ? `${theme.accent}15` : "transparent", color: activeChain === "all" ? theme.accent : theme.muted }}>
            All
          </button>
          {CHAINS.map(c => (
            <button key={c.id} onClick={() => setActiveChain(c.id)}
              style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", border: `1px solid ${activeChain === c.id ? c.color + "50" : theme.border}`, background: activeChain === c.id ? `${c.color}12` : "transparent", color: activeChain === c.id ? c.color : theme.muted }}>
              {c.icon} {c.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Token list */}
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {loading && balances.length === 0 ? (
          <div style={{ padding: 12, display: "grid", gap: 6 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-shimmer" style={{ height: 52, background: theme.panelAlt, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: theme.muted, fontSize: 12 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
            {loading ? "Loading balances…" : "No tokens found on this chain"}
          </div>
        ) : (
          <div>
            {filtered.map((t, i) => (
              <div key={`${t.chain}-${t.symbol}-${i}`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${theme.border}20`, transition: "background 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${theme.accent}04`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Token icon */}
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${t.chainColor}15`, border: `1px solid ${t.chainColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, fontWeight: 800, color: t.chainColor }}>
                  {t.symbol.slice(0, 2)}
                </div>

                {/* Token info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontWeight: 700, color: theme.text, fontSize: 13 }}>{t.symbol}</span>
                    <span style={{ fontSize: 9, color: t.chainColor, padding: "1px 5px", background: `${t.chainColor}15`, borderRadius: 4, fontWeight: 700 }}>
                      {t.chainIcon} {t.chainLabel.split(" ")[0]}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>
                    {fmt(t.balance)} {t.symbol}
                  </div>
                </div>

                {/* Price + change */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, fontFamily: "var(--font-geist-mono), monospace" }}>
                    {t.valueUsd > 0 ? fmtUsd(t.valueUsd) : "—"}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.change24h >= 0 ? theme.enter : theme.danger, fontFamily: "var(--font-geist-mono), monospace" }}>
                    {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(2)}%
                  </div>
                </div>

                {/* Explorer link */}
                <a href={t.explorerUrl} target="_blank" rel="noreferrer"
                  style={{ color: theme.muted, fontSize: 12, textDecoration: "none", flexShrink: 0, opacity: 0.6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}>
                  ↗
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 6 }}>
        <div className="live-dot" style={{ width: 5, height: 5 }} />
        <span style={{ fontSize: 10, color: theme.muted }}>
          Multi-chain · {balances.length} asset{balances.length !== 1 ? "s" : ""} · Read-only view
        </span>
      </div>
    </div>
  );
}
