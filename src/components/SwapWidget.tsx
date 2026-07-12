"use client";

/**
 * SwapWidget.tsx
 *
 * In-app swap panel. Pre-fills the output token from whatever signal
 * the user clicked "Trade" on. Routes swaps to:
 *   HashKey chain → app.hskswap.com (HSKSwap V3 SwapRouter02)
 *   Base chain    → Uniswap V3 on Base
 *   Ethereum      → Uniswap V3 on mainnet
 *
 * We do NOT execute the transaction inside this widget — that would require
 * approvals, slippage management, and a full SDK integration. Instead we:
 *  1. Show the user a live price estimate (fetched from DexScreener/GeckoTerminal)
 *  2. Let them set an amount
 *  3. Open the correct DEX in a new tab pre-filled with the exact token + chain
 *
 * This is the correct UX for a signal terminal — users verify on the DEX UI
 * before confirming on-chain, which keeps them safe.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { theme, actionColor } from "@/lib/theme";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface SwapTarget {
  symbol: string;
  name: string;
  contractAddress: string;
  chain: string;          // "hashkey" | "base" | "ethereum"
  priceUsd: number;
  logoUrl?: string;
  score?: number;
  action?: string;
  risePct?: number;
}

interface SwapWidgetProps {
  target: SwapTarget | null;
  onClose: () => void;
}

// ─── CHAIN METADATA ───────────────────────────────────────────────────────────

const CHAIN_META: Record<string, { label: string; nativeSymbol: string; nativeName: string; color: string; icon: string; uniswapChain: string }> = {
  hashkey: { label: "HashKey Chain", nativeSymbol: "HSK", nativeName: "HashKey Token", color: "#00E5A0", icon: "🔑", uniswapChain: "" },
  base:    { label: "Base",          nativeSymbol: "ETH", nativeName: "Ethereum",       color: "#5B8DEF", icon: "⚡", uniswapChain: "base" },
  ethereum:{ label: "Ethereum",      nativeSymbol: "ETH", nativeName: "Ethereum",       color: "#A855F7", icon: "Ξ",  uniswapChain: "mainnet" },
};

// Network options user can swap on (independent of the signal's chain)
const SWAP_NETWORKS = [
  { id: "hashkey",  label: "HashKey",  icon: "🔑", color: "#00E5A0" },
  { id: "base",     label: "Base",     icon: "⚡", color: "#5B8DEF" },
  { id: "ethereum", label: "Ethereum", icon: "Ξ",  color: "#A855F7" },
];

// ─── DEX LINK BUILDER ─────────────────────────────────────────────────────────

function buildDexUrl(chain: string, tokenAddress: string, amountIn?: string): string {
  if (chain === "hashkey") {
    // Primary: HSKSwap (may be geo-restricted in some regions)
    const params = new URLSearchParams({
      outputCurrency: tokenAddress,
      ...(amountIn ? { exactAmount: amountIn } : {}),
    });
    return `https://app.hskswap.com/#/swap?${params.toString()}`;
  }
  if (chain === "base") {
    const params = new URLSearchParams({
      chain: "base",
      outputCurrency: tokenAddress,
      ...(amountIn ? { inputAmount: amountIn } : {}),
    });
    return `https://app.uniswap.org/swap?${params.toString()}`;
  }
  // Ethereum mainnet
  const params = new URLSearchParams({
    chain: "mainnet",
    outputCurrency: tokenAddress,
    ...(amountIn ? { inputAmount: amountIn } : {}),
  });
  return `https://app.uniswap.org/swap?${params.toString()}`;
}

// ─── PRICE ESTIMATE ───────────────────────────────────────────────────────────
// HashKey tokens: try HSKSwap QuoterV2 on-chain (Phase 9 confirmed addresses)
// Base/ETH tokens: GeckoTerminal API (already working)

// Confirmed from @hskswap/sdk-core@1.0.3 — PHASE_9_PROGRESS.md
const HSKSWAP_QUOTER_V2 = "0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD";
const WHSK = "0xB210D2120d57b758EE163cFfb43e73728c471Cf1";
const HSK_RPC = "https://mainnet.hsk.xyz";

const QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)",
];

async function fetchHskTokenPrice(contractAddress: string, amountHsk: number): Promise<number | null> {
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(HSK_RPC);
    const quoter = new ethers.Contract(HSKSWAP_QUOTER_V2, QUOTER_ABI, provider);
    const amountInWei = ethers.parseEther(String(amountHsk));

    // Try 0.3% fee (3000) first, then 1% (10000)
    for (const fee of [3000, 10000, 500]) {
      try {
        const amountOut: bigint = await quoter.quoteExactInputSingle(
          WHSK, contractAddress, fee, amountInWei, 0
        );
        if (amountOut > BigInt(0)) {
          const tokensOut = parseFloat(ethers.formatEther(amountOut));
          // Price = HSK input / tokens out → price per token in HSK
          return amountHsk / tokensOut;
        }
      } catch { /* try next fee tier */ }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchTokenPrice(chain: string, contractAddress: string): Promise<{ price: number | null; source: string }> {
  // HashKey chain: try QuoterV2 first for on-chain accuracy
  if (chain === "hashkey") {
    const hskPrice = await fetchHskTokenPrice(contractAddress, 1);
    if (hskPrice !== null && hskPrice > 0) {
      return { price: hskPrice, source: "HSKSwap QuoterV2 🔑" };
    }
  }
  // Base/Ethereum (or HSK fallback): GeckoTerminal
  try {
    const net = chain === "ethereum" ? "eth" : chain === "hashkey" ? "hashkey" : chain;
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${net}/tokens/${contractAddress}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { price: null, source: "gecko" };
    const json = await res.json();
    const p = parseFloat(json?.data?.attributes?.price_usd ?? "");
    return { price: isNaN(p) ? null : p, source: "GeckoTerminal" };
  } catch {
    return { price: null, source: "gecko" };
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(3);
}

function formatPrice(p: number): string {
  if (p === 0) return "—";
  if (p >= 1) return "$" + p.toFixed(4);
  if (p >= 0.0001) return "$" + p.toFixed(6);
  return "$" + p.toExponential(3);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const PRESET_AMOUNTS = ["10", "25", "50", "100", "250"];

export default function SwapWidget({ target, onClose }: SwapWidgetProps) {
  const [amount, setAmount] = useState("50");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceSource, setPriceSource] = useState<string>("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  // User can override which network to swap on — defaults to the signal's chain
  const [selectedNetwork, setSelectedNetwork] = useState<string>(target?.chain ?? "base");
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync network to token's chain on target change
  useEffect(() => {
    if (target?.chain) setSelectedNetwork(target.chain);
  }, [target?.chain]);

  const chain = selectedNetwork;
  const meta = CHAIN_META[chain] ?? CHAIN_META.base;
  const ac = target?.action ? actionColor(target.action) : theme.accent;

  // Fetch live price on mount and when target changes
  useEffect(() => {
    if (!target?.contractAddress) return;
    setLivePrice(target.priceUsd > 0 ? target.priceUsd : null);
    setPriceSource("");
    setPriceLoading(true);
    fetchTokenPrice(chain, target.contractAddress).then(({ price, source }) => {
      if (price !== null) { setLivePrice(price); setPriceSource(source); }
      setPriceLoading(false);
    });
  }, [target?.contractAddress, chain, target?.priceUsd]);

  // Close on backdrop click
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function copyAddress() {
    if (!target?.contractAddress) return;
    navigator.clipboard.writeText(target.contractAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function openDex() {
    if (!target?.contractAddress) return;
    const url = buildDexUrl(chain, target.contractAddress, amount);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Estimate: how many tokens you get for the entered amount
  const estimatedTokens = livePrice && livePrice > 0 && parseFloat(amount) > 0
    ? parseFloat(amount) / livePrice
    : null;

  if (!target) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        animation: "fadeIn 0.18s ease-out",
      }}
    >
      <div
        className="animate-fadeInScale"
        style={{
          background: "linear-gradient(180deg, #0D0F1A 0%, #080A14 100%)",
          border: `1px solid ${theme.border}`,
          borderRadius: 24,
          width: "100%", maxWidth: 420,
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 120px rgba(0,229,160,0.06)",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Scan-line texture */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none",
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,160,0.012) 2px, rgba(0,229,160,0.012) 4px)" }} />
        {/* Accent glow top */}
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 280, height: 120, borderRadius: "50%",
          background: `radial-gradient(circle, ${ac}15 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, padding: 24 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Token logo */}
              <div style={{ width: 44, height: 44, borderRadius: 14, background: `${ac}18`, border: `1px solid ${ac}30`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {target.logoUrl ? (
                  <img src={target.logoUrl} alt={target.symbol} width={30} height={30} style={{ borderRadius: 10 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : target.symbol.slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, letterSpacing: "-0.3px" }}>
                  Swap → {target.symbol}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: meta.color, fontWeight: 700 }}>{meta.icon} {meta.label}</span>
                  {target.action && (
                    <span style={{ fontSize: 10, color: ac, border: `1px solid ${ac}40`, background: `${ac}12`,
                      borderRadius: 999, padding: "1px 7px", fontWeight: 700 }}>
                      {target.action}
                    </span>
                  )}
                  {target.risePct && target.risePct > 0 && (
                    <span style={{ fontSize: 10, color: theme.enter, fontWeight: 700 }}>+{target.risePct}% est.</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.border}`, borderRadius: 8,
                color: theme.muted, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 16, flexShrink: 0 }}>
              ✕
            </button>
          </div>

          {/* Price info row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            <div style={{ background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Current Price</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, fontFamily: "var(--font-geist-mono), monospace" }}>
                {priceLoading ? <span className="animate-blink" style={{ color: theme.muted }}>…</span> : formatPrice(livePrice ?? 0)}
              </div>
              {priceSource && !priceLoading && (
                <div style={{ fontSize: 9, color: theme.muted, marginTop: 3 }}>{priceSource}</div>
              )}
            </div>
            <div style={{ background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>DEX Router</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>
                {chain === "hashkey" ? "HSKSwap V3" : "Uniswap V3"}
              </div>
            </div>
          </div>

          {/* Network selector — user picks which DEX/chain to swap on */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 700 }}>
              Swap Network
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {SWAP_NETWORKS.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNetwork(n.id)}
                  style={{
                    padding: "8px 6px", borderRadius: 10, border: `1px solid ${selectedNetwork === n.id ? n.color + "60" : theme.border}`,
                    background: selectedNetwork === n.id ? `${n.color}12` : theme.panelAlt,
                    color: selectedNetwork === n.id ? n.color : theme.muted,
                    cursor: "pointer", fontSize: 11, fontWeight: 700, transition: "all 0.15s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    boxShadow: selectedNetwork === n.id ? `0 0 12px ${n.color}15` : "none",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Swap panel */}
          <div style={{ background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>

            {/* Input: pay with native token */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: theme.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                You Pay ({meta.nativeSymbol})
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: theme.panel,
                  border: `1px solid ${theme.border}`, borderRadius: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{meta.nativeSymbol}</span>
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="any"
                  placeholder="0.00"
                  style={{ flex: 1, background: theme.panel, border: `1px solid ${theme.border}`, color: theme.text,
                    borderRadius: 10, padding: "8px 12px", fontSize: 16, fontWeight: 700, outline: "none",
                    fontFamily: "var(--font-geist-mono), monospace" }}
                  onFocus={(e) => { e.target.style.borderColor = `${ac}60`; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.border; }}
                />
              </div>
              {/* Preset amounts */}
              <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                {PRESET_AMOUNTS.map((a) => (
                  <button key={a} onClick={() => setAmount(a)}
                    style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      background: amount === a ? `${ac}20` : "transparent",
                      border: `1px solid ${amount === a ? ac + "50" : theme.border}`,
                      color: amount === a ? ac : theme.muted }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ textAlign: "center", margin: "10px 0", color: theme.muted, fontSize: 18 }}>↓</div>

            {/* Output: receive token */}
            <div>
              <div style={{ fontSize: 11, color: theme.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                You Receive ({target.symbol})
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: theme.panel,
                border: `1px solid ${ac}30`, borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, fontFamily: "var(--font-geist-mono), monospace" }}>
                    {estimatedTokens !== null
                      ? `≈ ${fmt(estimatedTokens)} ${target.symbol}`
                      : <span style={{ color: theme.muted, fontSize: 13 }}>Enter amount above</span>}
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>Estimate only — final price set on DEX</div>
                </div>
                {target.logoUrl && (
                  <img src={target.logoUrl} alt={target.symbol} width={28} height={28} style={{ borderRadius: 8 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>
            </div>
          </div>

          {/* Contract address */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: theme.panelAlt,
            border: `1px solid ${theme.border}`, borderRadius: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                Contract Address
              </div>
              <div style={{ fontSize: 12, color: theme.accent, fontFamily: "var(--font-geist-mono), monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {target.contractAddress}
              </div>
            </div>
            <button onClick={copyAddress}
              style={{ background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6,
                color: copied ? theme.accent : theme.muted, padding: "4px 10px", fontSize: 11,
                fontWeight: 700, cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          {/* Safety notice */}
          <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: "rgba(245,166,35,0.06)",
            border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: 11, color: theme.muted, lineHeight: 1.5 }}>
              Always verify the contract address on the DEX before confirming. Sentinel is a signal terminal — confirm all trades yourself.
            </span>
          </div>

          {/* Trade button(s) */}
          {chain === "hashkey" ? (
            // HashKey: show BOTH HSKSwap + Uniswap so judges/users always have an option
            <div style={{ display: "grid", gap: 8 }}>
              <a
                href={`https://app.hskswap.com/#/swap?outputCurrency=${target.contractAddress}${amount ? `&exactAmount=${amount}` : ""}`}
                target="_blank" rel="noreferrer"
                style={{
                  width: "100%", padding: "13px 20px", borderRadius: 14,
                  background: `linear-gradient(135deg, #00E5A0, #00C88A)`,
                  color: "#06070D", fontSize: 14, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  boxShadow: "0 4px 24px rgba(0,229,160,0.35)", textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: 16 }}>🔑</span>
                Swap on HSKSwap
                <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>(HashKey Native DEX)</span>
              </a>
              <a
                href={`https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${target.contractAddress}${amount ? `&inputAmount=${amount}` : ""}`}
                target="_blank" rel="noreferrer"
                style={{
                  width: "100%", padding: "11px 20px", borderRadius: 14,
                  background: theme.panelAlt,
                  border: `1px solid rgba(168,85,247,0.4)`,
                  color: "#A855F7", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  textDecoration: "none", transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: 15 }}>↗</span>
                Swap on Uniswap
                <span style={{ fontSize: 11, opacity: 0.75 }}>(if HSKSwap restricted)</span>
              </a>
            </div>
          ) : (
            <button
              onClick={openDex}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 14, border: "none",
                background: `linear-gradient(135deg, ${ac}, ${ac}CC)`,
                color: "#06070D", fontSize: 15, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: `0 4px 24px ${ac}35`, transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${ac}50`; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 4px 24px ${ac}35`; }}
            >
              <span style={{ fontSize: 18 }}>↗</span>
              Swap on Uniswap
              <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 600 }}>({meta.icon} {meta.label})</span>
            </button>
          )}

          {/* Quick links row */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
            <a
              href={chain === "hashkey"
                ? `https://hashkey.blockscout.com/token/${target.contractAddress}`
                : chain === "base"
                  ? `https://basescan.org/token/${target.contractAddress}`
                  : `https://etherscan.io/token/${target.contractAddress}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: theme.muted, textDecoration: "none", padding: "5px 12px",
                background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 8,
                display: "flex", alignItems: "center", gap: 5 }}>
              🔗 Explorer
            </a>
            <a
              href={`https://dexscreener.com/${chain === "ethereum" ? "ethereum" : chain}/${target.contractAddress}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: theme.muted, textDecoration: "none", padding: "5px 12px",
                background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 8,
                display: "flex", alignItems: "center", gap: 5 }}>
              📊 DexScreener
            </a>
            {chain === "hashkey" && (
              <a
                href={`https://app.hskswap.com/#/swap?outputCurrency=${target.contractAddress}`}
                target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: meta.color, textDecoration: "none", padding: "5px 12px",
                  background: `${meta.color}10`, border: `1px solid ${meta.color}30`, borderRadius: 8,
                  display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                🔑 HSKSwap
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
