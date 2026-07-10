"use client";

import { useState, useEffect } from "react";
import { theme } from "@/lib/theme";
import type { TokenAnalytics } from "@/lib/types";
import TradingViewChart from "./TradingViewChart";
import PaymentTierGate from "./PaymentTierGate";
import { useStore } from "@/lib/store";

function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: theme.panelAlt, borderRadius: 10, padding: "12px 14px", border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 11, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || theme.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: theme.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function TokenChecker({ prefillAddress, prefillChain }: { prefillAddress?: string; prefillChain?: string } = {}) {
  const [address, setAddress] = useState(prefillAddress ?? "");
  const [chain, setChain] = useState(prefillChain ?? "base");
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [error, setError] = useState("");
  const { isAssetUnlocked } = useStore();

  // Auto-analyze when a prefill address is injected
  useEffect(() => {
    if (prefillAddress && prefillAddress.length > 10) {
      setAddress(prefillAddress);
      setChain(prefillChain ?? "hashkey");
      // Trigger analysis automatically
      setTimeout(() => {
        const btn = document.getElementById("token-checker-analyze-btn");
        if (btn) btn.click();
      }, 100);
    }
  }, [prefillAddress, prefillChain]);

  async function handleSearch() {
    const trimmed = address.trim();
    if (!trimmed || trimmed.length < 10) {
      setError("Enter a valid contract address (0x...)");
      return;
    }
    setLoading(true);
    setError("");
    setAnalytics(null);
    try {
      const res = await fetch(`/api/token/${trimmed}?chain=${chain}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.data);
      } else {
        setError(data.error || "Token not found on this chain");
      }
    } catch (e: any) {
      setError(e.message?.includes("HTTP") ? "Could not fetch token data. Check the address and chain." : (e.message || "Network error"));
    } finally {
      setLoading(false);
    }
  }

  const riseColor = analytics
    ? analytics.risePotential >= 70 ? theme.enter : analytics.risePotential >= 40 ? theme.warning : theme.danger
    : theme.muted;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.8, margin: 0, fontWeight: 700 }}>
          🔍 Deep Analytics
        </h2>
        <span className="neon-badge neon-badge-orange" style={{ fontSize: 9 }}>1 HSK/asset</span>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          style={{ background: theme.panel, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
        >
          <option value="base">⚡ Base</option>
          <option value="ethereum">Ξ Ethereum</option>
          <option value="hashkey">🔑 HashKey</option>
        </select>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Paste contract address (0x…)"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ flex: 1, background: theme.panel, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontFamily: "var(--font-geist-mono), monospace", outline: "none" }}
        />
        <button id="token-checker-analyze-btn" onClick={handleSearch} disabled={loading} className="btn-primary" style={{ padding: "8px 18px", fontSize: 13, whiteSpace: "nowrap" }}>
          {loading ? "…" : "Analyze"}
        </button>
      </div>

      {error && (
        <div style={{ color: theme.danger, fontSize: 12, padding: "10px 14px", background: `${theme.danger}10`, border: `1px solid ${theme.danger}20`, borderRadius: 10, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div style={{ display: "grid", gap: 12 }}>
          {[160, 120, 80].map((h, i) => (
            <div key={i} className="animate-shimmer" style={{ height: h, background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 14 }} />
          ))}
        </div>
      )}

      {analytics && !loading && (
        <div className="animate-fadeIn" style={{ display: "grid", gap: 14 }}>
          {/* Token header */}
          <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: theme.text }}>{analytics.symbol}</div>
                <div style={{ fontSize: 13, color: theme.muted }}>{analytics.name} · {analytics.chain.toUpperCase()}</div>
                <div style={{ fontSize: 11, color: theme.muted, marginTop: 4, fontFamily: "var(--font-geist-mono), monospace" }}>
                  {analytics.contractAddress.slice(0, 10)}…{analytics.contractAddress.slice(-6)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>
                  ${analytics.priceUsd < 0.001 ? analytics.priceUsd.toExponential(3) : analytics.priceUsd.toFixed(4)}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: riseColor, border: `1px solid ${riseColor}40`, background: `${riseColor}10`, marginTop: 4 }}>
                  Rise Potential: {analytics.risePotential}%
                </div>
                <div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                  Security Score: <span style={{ color: analytics.securityScore >= 70 ? theme.enter : analytics.securityScore >= 40 ? theme.warning : theme.danger }}>{analytics.securityScore}/100</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 14 }}>
              <StatCard label="Market Cap" value={`$${fmt(analytics.marketCap)}`} />
              <StatCard label="Liquidity" value={`$${fmt(analytics.liquidityUsd)}`} />
              <StatCard label="24h Volume" value={`$${fmt(analytics.volume24h)}`} />
              <StatCard label="Holders" value={analytics.holders > 0 ? analytics.holders.toLocaleString() : "N/A"} />
            </div>

            {/* Quick links */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <a href={analytics.chain === "hashkey" ? `https://dexscreener.com/hashkey/${analytics.contractAddress}` : `https://dexscreener.com/${analytics.chain}/${analytics.contractAddress}`} target="_blank" rel="noreferrer"
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: theme.textSecondary, background: theme.panelAlt, border: `1px solid ${theme.border}`, textDecoration: "none" }}>
                📊 DexScreener
              </a>
              <a href={analytics.chain === "hashkey" ? `https://hskswap.com/#/swap?chain=hashkey&outputCurrency=${analytics.contractAddress}` : `https://app.uniswap.org/swap?chain=${analytics.chain === "base" ? "base" : "mainnet"}&outputCurrency=${analytics.contractAddress}`} target="_blank" rel="noreferrer"
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "#06070D", background: `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`, border: "none", textDecoration: "none" }}>
                ↗ Trade {analytics.chain === "hashkey" ? "on HSKSwap" : "on Uniswap"}
              </a>
              <a href={analytics.chain === "hashkey" ? `https://hashkey.blockscout.com/token/${analytics.contractAddress}` : analytics.chain === "base" ? `https://basescan.org/token/${analytics.contractAddress}` : `https://etherscan.io/token/${analytics.contractAddress}`} target="_blank" rel="noreferrer"
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: theme.textSecondary, background: theme.panelAlt, border: `1px solid ${theme.border}`, textDecoration: "none" }}>
                🔗 Explorer
              </a>
            </div>
          </div>

          {/* Tier 3 gated content */}
          <PaymentTierGate tier={3} assetAddress={analytics.contractAddress}>
            {/* Price Chart (line) */}
            <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16 }}>
              <TradingViewChart candles={analytics.candles} symbol={analytics.symbol} />
            </div>

            {/* Security Analysis */}
            <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, marginBottom: 12 }}>
                🛡️ Security Analysis
              </div>
              {analytics.securityFlags.length === 0 ? (
                <div style={{ color: theme.muted, fontSize: 12 }}>No security data available</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {analytics.securityFlags.map((flag, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: theme.panelAlt, borderRadius: 8, border: `1px solid ${flag.severity === "safe" ? theme.enter + "20" : flag.severity === "warning" ? theme.warning + "20" : theme.danger + "20"}` }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: flag.severity === "safe" ? theme.enter : flag.severity === "warning" ? theme.warning : theme.danger, flexShrink: 0 }} />
                      <span style={{ color: theme.text, fontWeight: 600, fontSize: 13 }}>{flag.label}</span>
                      <span style={{ color: theme.muted, fontSize: 11, marginLeft: "auto" }}>{flag.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Token Metrics */}
            <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, marginBottom: 12 }}>
                📊 Advanced Metrics
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                <StatCard label="Liq / MCap" value={analytics.marketCap > 0 ? ((analytics.liquidityUsd / analytics.marketCap) * 100).toFixed(1) + "%" : "N/A"}
                  color={(analytics.liquidityUsd / Math.max(analytics.marketCap, 1)) > 0.05 ? theme.enter : theme.warning} />
                <StatCard label="Vol / Liq" value={analytics.liquidityUsd > 0 ? ((analytics.volume24h / analytics.liquidityUsd)).toFixed(2) + "x" : "N/A"} />
                <StatCard label="Fully Diluted Val" value={`$${fmt(analytics.marketCap)}`} />
                <StatCard label="Security Score" value={`${analytics.securityScore}/100`} color={analytics.securityScore >= 70 ? theme.enter : analytics.securityScore >= 40 ? theme.warning : theme.danger} />
              </div>
            </div>

            {/* Smart Money / Top Holders */}
            <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, marginBottom: 12 }}>
                🐋 Smart Money & Top Holders
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {analytics.topHolders.map((holder, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, padding: "10px 12px", background: theme.panelAlt, borderRadius: 8, border: `1px solid ${holder.isSmartMoney ? theme.accent + "20" : theme.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: theme.muted, fontFamily: "var(--font-geist-mono), monospace" }}>#{i + 1}</span>
                      <span style={{ fontFamily: "var(--font-geist-mono), monospace", color: theme.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {holder.address}
                      </span>
                      {holder.isSmartMoney && (
                        <span className="neon-badge neon-badge-purple" style={{ padding: "1px 6px", fontSize: 9, flexShrink: 0 }}>
                          {holder.label || "Smart $"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span style={{ color: theme.muted, fontSize: 12 }}>{holder.percentage.toFixed(1)}%</span>
                      {holder.pnlPercent !== undefined && (
                        <span style={{ color: holder.pnlPercent >= 0 ? theme.enter : theme.danger, fontWeight: 700, fontSize: 12 }}>
                          {holder.pnlPercent >= 0 ? "+" : ""}{holder.pnlPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contract address */}
            <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 14, marginTop: 12 }}>
              <div style={{ fontSize: 11, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, fontWeight: 700 }}>Contract Address</div>
              <div style={{ fontSize: 13, color: theme.accent, fontFamily: "var(--font-geist-mono), monospace", wordBreak: "break-all" }}>
                {analytics.contractAddress}
              </div>
            </div>
          </PaymentTierGate>
        </div>
      )}
    </div>
  );
}
