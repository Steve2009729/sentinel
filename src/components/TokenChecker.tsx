"use client";

import { useState } from "react";
import { theme, tierColor } from "@/lib/theme";
import type { TokenAnalytics } from "@/lib/types";
import TradingViewChart from "./TradingViewChart";
import PaymentTierGate from "./PaymentTierGate";
import { useStore } from "@/lib/store";

export default function TokenChecker() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("base");
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [error, setError] = useState("");
  const { isAssetUnlocked } = useStore();

  async function handleSearch() {
    if (!address || address.length < 10) {
      setError("Enter a valid contract address");
      return;
    }

    setLoading(true);
    setError("");
    setAnalytics(null);

    try {
      const res = await fetch(`/api/token/${address}?chain=${chain}`);
      const data = await res.json();

      if (data.success) {
        setAnalytics(data.data);
      } else {
        setError(data.error || "Token not found");
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch token data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 14,
            color: theme.muted,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            margin: 0,
            fontWeight: 700,
          }}
        >
          🔍 Token Checker
        </h2>
        <span className="neon-badge neon-badge-orange">Deep Analytics</span>
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          style={{
            background: theme.panel,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <option value="base">Base</option>
          <option value="ethereum">Ethereum</option>
        </select>

        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Paste contract address (CA)..."
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{
            flex: 1,
            background: theme.panel,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontFamily: "var(--font-geist-mono), monospace",
            outline: "none",
          }}
        />

        <button
          onClick={handleSearch}
          disabled={loading}
          className="btn-primary"
          style={{ padding: "8px 18px", fontSize: 13 }}
        >
          {loading ? "..." : "Analyze"}
        </button>
      </div>

      {error && (
        <div
          style={{
            color: theme.danger,
            fontSize: 12,
            padding: "10px 14px",
            background: `${theme.danger}10`,
            border: `1px solid ${theme.danger}20`,
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {analytics && (
        <div className="animate-fadeIn" style={{ display: "grid", gap: 16 }}>
          {/* Token header */}
          <div
            style={{
              background: theme.panel,
              border: `1px solid ${theme.border}`,
              borderRadius: 14,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>
                  {analytics.symbol}
                </div>
                <div style={{ fontSize: 13, color: theme.muted }}>
                  {analytics.name} · {analytics.chain.toUpperCase()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>
                  ${analytics.priceUsd < 0.01
                    ? analytics.priceUsd.toExponential(2)
                    : analytics.priceUsd.toFixed(4)}
                </div>
                <RisePotentialBadge score={analytics.risePotential} />
              </div>
            </div>

            {/* Quick stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginTop: 14,
              }}
            >
              <QuickStat label="Market Cap" value={`$${formatNum(analytics.marketCap)}`} />
              <QuickStat label="Liquidity" value={`$${formatNum(analytics.liquidityUsd)}`} />
              <QuickStat label="24h Volume" value={`$${formatNum(analytics.volume24h)}`} />
            </div>
          </div>

          {/* Tier 3 gated content: Chart, Security, Smart Money */}
          <PaymentTierGate tier={3} assetAddress={analytics.contractAddress}>
            {/* Contract address reveal */}
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 11, color: theme.muted, textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
                Contract Address
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: theme.accent,
                  fontFamily: "var(--font-geist-mono), monospace",
                  wordBreak: "break-all",
                }}
              >
                {analytics.contractAddress}
              </div>
            </div>

            {/* TradingView Chart */}
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 14,
                marginTop: 12,
              }}
            >
              <TradingViewChart candles={analytics.candles} symbol={analytics.symbol} />
            </div>

            {/* Security Rating */}
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 16,
                marginTop: 12,
              }}
            >
              <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>
                🛡️ Security Analysis
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {analytics.securityFlags.map((flag, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background:
                          flag.severity === "safe"
                            ? theme.success
                            : flag.severity === "warning"
                            ? theme.warning
                            : theme.danger,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: theme.text, fontWeight: 600 }}>
                      {flag.label}
                    </span>
                    <span style={{ color: theme.muted, fontSize: 12 }}>
                      — {flag.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Smart Money / KOL Holders */}
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 16,
                marginTop: 12,
              }}
            >
              <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>
                🐋 Smart Money & KOL Tracking
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {analytics.topHolders.map((holder, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 13,
                      padding: "8px 12px",
                      background: theme.panelAlt,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-geist-mono), monospace",
                          color: theme.text,
                          fontSize: 12,
                        }}
                      >
                        {holder.address}
                      </span>
                      {holder.isSmartMoney && (
                        <span className="neon-badge neon-badge-purple" style={{ padding: "2px 8px", fontSize: 10 }}>
                          {holder.label || "Smart Money"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: theme.muted, fontSize: 12 }}>
                        {holder.percentage.toFixed(1)}%
                      </span>
                      {holder.pnlPercent !== undefined && (
                        <span
                          style={{
                            color: holder.pnlPercent >= 0 ? theme.enter : theme.danger,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {holder.pnlPercent >= 0 ? "+" : ""}{holder.pnlPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PaymentTierGate>
        </div>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: theme.panelAlt,
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.muted, marginTop: 4, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function RisePotentialBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? theme.enter : score >= 50 ? theme.warning : theme.danger;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color,
        border: `1px solid ${color}40`,
        background: `${color}10`,
        marginTop: 4,
      }}
    >
      Rise {score}%
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}
