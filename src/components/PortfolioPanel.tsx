"use client";

/**
 * PortfolioPanel.tsx
 *
 * Shows the connected wallet's token holdings on HashKey Chain (HSK native +
 * ERC-20 tokens from Transfer event history) with live prices, +/- % changes,
 * and sparkline-style trend indicators.
 *
 * Tapping any holding opens the Deep Analytics panel for that token
 * (Tier 3 payment gate is handled inside TokenChecker / PaymentTierGate).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { theme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { getActiveProvider } from "@/lib/contracts-client";
import { ethers } from "ethers";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface Holding {
  symbol: string;
  name: string;
  contractAddress: string | null; // null = native HSK
  chain: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
  priceChange24h: number;
  priceChange1h: number;
  logoUrl?: string;
}

interface PortfolioPanelProps {
  onAnalyze: (contractAddress: string, chain: string, symbol: string) => void;
}

// ─── KNOWN TOKENS TO CHECK (HashKey Chain ERC-20s to probe) ──────────────────
// We can't enumerate all ERC-20s without an indexer, so we track:
// 1. Native HSK (always shown)
// 2. WHSK
// 3. Any token the user has received signals for (from the store)
// 4. Any unlocked assets (tier 3 unlocks)

const WHSK = "0xB210D2120d57b758EE163cFfb43e73728c471Cf1";
const HSK_RPC = "https://mainnet.hsk.xyz";

const ERC20_ABI_MIN = [
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
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
  return "$" + n.toExponential(2);
}

async function getERC20Balance(
  provider: ethers.JsonRpcProvider,
  address: string,
  walletAddress: string
): Promise<{ balance: number; symbol: string; name: string; decimals: number } | null> {
  try {
    const contract = new ethers.Contract(address, ERC20_ABI_MIN, provider);
    const [rawBalance, symbol, name, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.symbol(),
      contract.name(),
      contract.decimals(),
    ]);
    const balance = parseFloat(ethers.formatUnits(rawBalance, decimals));
    if (balance <= 0) return null;
    return { balance, symbol, name, decimals: Number(decimals) };
  } catch {
    return null;
  }
}

async function getTokenPrice(
  chain: string,
  contractAddress: string
): Promise<{ priceUsd: number; change24h: number; change1h: number } | null> {
  try {
    const net = chain === "ethereum" ? "eth" : chain;
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${net}/tokens/${contractAddress}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const attrs = json?.data?.attributes;
    if (!attrs) return null;
    return {
      priceUsd: parseFloat(attrs.price_usd ?? "0") || 0,
      change24h: parseFloat(attrs.price_change_percentage?.h24 ?? "0") || 0,
      change1h: parseFloat(attrs.price_change_percentage?.h1 ?? "0") || 0,
    };
  } catch {
    return null;
  }
}

// ─── MINI SPARKLINE ───────────────────────────────────────────────────────────

function Sparkline({ positive, width = 60, height = 24 }: { positive: boolean; width?: number; height?: number }) {
  // Generate a simple pseudo-random trend line based on direction
  const seed = positive ? [0.3, 0.5, 0.4, 0.6, 0.55, 0.7, 0.65, 0.8] : [0.7, 0.6, 0.65, 0.5, 0.55, 0.4, 0.45, 0.3];
  const pts = seed.map((v, i) => `${(i / (seed.length - 1)) * width},${height - v * height}`).join(" ");
  const color = positive ? theme.enter : theme.danger;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function PortfolioPanel({ onAnalyze }: PortfolioPanelProps) {
  const { walletAddress, balance, signals, unlockedAssets } = useStore();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [totalValueUsd, setTotalValueUsd] = useState(0);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const loadPortfolio = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);

    try {
      const provider = new ethers.JsonRpcProvider(HSK_RPC);
      const results: Holding[] = [];

      // ── 1. Native HSK balance ────────────────────────────────────────────
      try {
        const rawBal = await provider.getBalance(walletAddress);
        const hskBalance = parseFloat(ethers.formatEther(rawBal));

        // Get HSK price from GeckoTerminal via WHSK
        const hskPrice = await getTokenPrice("hashkey", WHSK);
        const hskVal = hskBalance * (hskPrice?.priceUsd ?? 0);

        results.push({
          symbol: "HSK",
          name: "HashKey Token",
          contractAddress: null,
          chain: "hashkey",
          balance: hskBalance,
          priceUsd: hskPrice?.priceUsd ?? 0,
          valueUsd: hskVal,
          priceChange24h: hskPrice?.change24h ?? 0,
          priceChange1h: hskPrice?.change1h ?? 0,
        });
      } catch (e) {
        console.error("[Portfolio] Native HSK error:", e);
      }

      // ── 2. Known ERC-20s: WHSK + signal tokens + unlocked assets ────────
      const tokenAddrs = new Set<string>();
      tokenAddrs.add(WHSK);

      // Add tokens from recent signals
      for (const s of signals.slice(0, 20)) {
        if (s.chain === "hashkey" && s.contractAddress?.startsWith("0x")) {
          tokenAddrs.add(s.contractAddress.toLowerCase());
        }
      }
      // Add unlocked analytics assets
      for (const a of unlockedAssets) {
        tokenAddrs.add(a.toLowerCase());
      }

      // Check balance of each token in parallel
      const tokenChecks = await Promise.allSettled(
        Array.from(tokenAddrs).map(async (addr) => {
          const tokenData = await getERC20Balance(provider, addr, walletAddress);
          if (!tokenData) return null;

          const priceData = await getTokenPrice("hashkey", addr);
          const val = tokenData.balance * (priceData?.priceUsd ?? 0);

          return {
            symbol: tokenData.symbol,
            name: tokenData.name,
            contractAddress: addr,
            chain: "hashkey",
            balance: tokenData.balance,
            priceUsd: priceData?.priceUsd ?? 0,
            valueUsd: val,
            priceChange24h: priceData?.change24h ?? 0,
            priceChange1h: priceData?.change1h ?? 0,
          } as Holding;
        })
      );

      for (const r of tokenChecks) {
        if (r.status === "fulfilled" && r.value) {
          results.push(r.value);
        }
      }

      // Sort by USD value descending
      results.sort((a, b) => b.valueUsd - a.valueUsd);

      if (!isMounted.current) return;
      setHoldings(results);
      setTotalValueUsd(results.reduce((sum, h) => sum + h.valueUsd, 0));
      setLastRefresh(new Date());
    } catch (e) {
      console.error("[Portfolio] Load error:", e);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [walletAddress, signals, unlockedAssets]);

  // Load on mount and whenever wallet changes
  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  if (!walletAddress) {
    return (
      <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 13, color: theme.muted, textAlign: "center" }}>Connect wallet to view portfolio</div>
      </div>
    );
  }

  return (
    <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 6 }}>
            💼 My Portfolio
            {loading && <span className="animate-blink" style={{ color: theme.accent, fontSize: 10 }}>●</span>}
          </div>
          {totalValueUsd > 0 && (
            <div style={{ fontSize: 11, color: theme.muted, marginTop: 2, fontFamily: "var(--font-geist-mono), monospace" }}>
              Total: <span style={{ color: theme.accent, fontWeight: 700 }}>{fmtUsd(totalValueUsd)}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: theme.muted }}>
              {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={loadPortfolio}
            disabled={loading}
            style={{ background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: 6, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Holdings list */}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {loading && holdings.length === 0 ? (
          // Skeleton
          <div style={{ padding: 12, display: "grid", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-shimmer" style={{ height: 58, background: theme.panelAlt, borderRadius: 10 }} />
            ))}
          </div>
        ) : holdings.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: theme.muted, fontSize: 12 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
            <div>No tokens found on HashKey Chain.</div>
            <div style={{ marginTop: 4, fontSize: 11 }}>Tokens from your signal feed will appear here automatically.</div>
          </div>
        ) : (
          <div style={{ padding: "8px 0" }}>
            {holdings.map((h, i) => {
              const isPositive24h = h.priceChange24h >= 0;
              const isExpanded = expandedToken === (h.contractAddress ?? "hsk");
              const canAnalyze = h.contractAddress !== null;

              return (
                <div key={h.contractAddress ?? "hsk"}>
                  {/* Row */}
                  <div
                    onClick={() => {
                      const key = h.contractAddress ?? "hsk";
                      setExpandedToken(isExpanded ? null : key);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", transition: "background 0.15s", borderBottom: `1px solid ${theme.border}30` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${theme.accent}05`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Token icon */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${theme.accent}12`, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {h.logoUrl
                        ? <img src={h.logoUrl} alt={h.symbol} width={24} height={24} style={{ borderRadius: 6 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : h.symbol.slice(0, 2)}
                    </div>

                    {/* Token info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, color: theme.text, fontSize: 13 }}>{h.symbol}</span>
                        <span style={{ fontSize: 9, color: theme.muted, padding: "1px 5px", background: theme.panelAlt, borderRadius: 4, border: `1px solid ${theme.border}` }}>
                          {h.chain === "hashkey" ? "🔑" : h.chain === "base" ? "⚡" : "Ξ"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: theme.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {fmt(h.balance)} {h.symbol}
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div style={{ flexShrink: 0 }}>
                      <Sparkline positive={isPositive24h} width={50} height={20} />
                    </div>

                    {/* Price + change */}
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, fontFamily: "var(--font-geist-mono), monospace" }}>
                        {h.priceUsd > 0 ? (h.priceUsd >= 0.01 ? "$" + h.priceUsd.toFixed(4) : "$" + h.priceUsd.toExponential(3)) : "—"}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isPositive24h ? theme.enter : theme.danger, fontFamily: "var(--font-geist-mono), monospace" }}>
                        {isPositive24h ? "+" : ""}{h.priceChange24h.toFixed(2)}%
                      </div>
                    </div>

                    {/* Expand arrow */}
                    <div style={{ color: theme.muted, fontSize: 12, flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="animate-fadeIn" style={{ padding: "10px 16px 14px", background: `${theme.accent}04`, borderBottom: `1px solid ${theme.border}30` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                        <div style={{ background: theme.panelAlt, borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Value</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{fmtUsd(h.valueUsd)}</div>
                        </div>
                        <div style={{ background: theme.panelAlt, borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>1h Change</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: h.priceChange1h >= 0 ? theme.enter : theme.danger }}>
                            {h.priceChange1h >= 0 ? "+" : ""}{h.priceChange1h.toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ background: theme.panelAlt, borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>24h Change</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isPositive24h ? theme.enter : theme.danger }}>
                            {isPositive24h ? "+" : ""}{h.priceChange24h.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        {/* Deep Analytics button — requires Tier 3 */}
                        {canAnalyze ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnalyze(h.contractAddress!, h.chain, h.symbol);
                            }}
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: `linear-gradient(135deg, ${theme.tierDeep}, ${theme.tierPremium})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                          >
                            🔍 Deep Analytics
                            <span style={{ fontSize: 9, opacity: 0.8 }}>(0.1 HSK)</span>
                          </button>
                        ) : (
                          <div style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: theme.panelAlt, border: `1px solid ${theme.border}`, fontSize: 11, color: theme.muted, textAlign: "center" }}>
                            Native token — no contract analytics
                          </div>
                        )}

                        {/* Explorer link */}
                        {h.contractAddress && (
                          <a
                            href={`https://hashkey.blockscout.com/token/${h.contractAddress}`}
                            target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: "8px 12px", borderRadius: 8, background: theme.panelAlt, border: `1px solid ${theme.border}`, color: theme.muted, textDecoration: "none", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
                          >
                            🔗 Explorer
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 6 }}>
        <div className="live-dot" style={{ width: 5, height: 5 }} />
        <span style={{ fontSize: 10, color: theme.muted }}>
          HashKey Chain · {holdings.length} asset{holdings.length !== 1 ? "s" : ""} · Tap any holding for details
        </span>
      </div>
    </div>
  );
}
