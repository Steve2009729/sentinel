"use client";

import { useEffect, useRef, useState } from "react";
import { Signal } from "@/lib/types";
import { theme, actionColor } from "@/lib/theme";

function money(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + Math.round(n).toLocaleString();
}

function LaunchpadBadge({ isClanker, isZyno }: { isClanker?: boolean; isZyno?: boolean }) {
  if (isClanker) return (
    <span className="neon-badge neon-badge-purple" style={{ padding: "2px 7px", fontSize: 9, marginLeft: 4 }}>
      CLANKER
    </span>
  );
  if (isZyno) return (
    <span className="neon-badge neon-badge-blue" style={{ padding: "2px 7px", fontSize: 9, marginLeft: 4 }}>
      ZYNO
    </span>
  );
  return null;
}

function ActionBadge({ action }: { action: string }) {
  const c = actionColor(action);
  return (
    <span style={{ color: c, border: `1px solid ${c}40`, background: `${c}10`, borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, boxShadow: `0 0 12px ${c}15` }}>
      {action}
    </span>
  );
}

function ScoreRing({ score, color, size = 38 }: { score: number; color: string; size?: number }) {
  const radius = (size - 6) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.border} strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease", filter: `drop-shadow(0 0 4px ${color}60)` }} />
      </svg>
      <span style={{ position: "absolute", fontSize: 10, fontWeight: 800, color, fontFamily: "var(--font-geist-mono), monospace" }}>{score}</span>
    </div>
  );
}

function AgeLabel({ ageHours }: { ageHours: number }) {
  const isNew = ageHours < 1;
  const isFresh = ageHours < 24;
  const label = ageHours < 1 ? "<1h" : ageHours < 24 ? `${Math.round(ageHours)}h` : `${Math.round(ageHours / 24)}d`;
  return (
    <span style={{ color: isNew ? "#FF6B35" : isFresh ? theme.warning : theme.muted, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
      {isNew ? "🔥" : isFresh ? "🆕" : "🕒"} {label}
    </span>
  );
}

function SignalCard({ s, index }: { s: Signal; index: number }) {
  const c = actionColor(s.action);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(s.contractAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className="holo-card animate-fadeIn"
      style={{ background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 16, transition: "all 0.25s ease", animationDelay: `${index * 0.04}s`, animationFillMode: "backwards", position: "relative", overflow: "hidden" }}
    >
      <div className="scan-line-overlay" />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              {s.logoUrl && (
                <img src={s.logoUrl} alt={s.symbol} width={20} height={20} style={{ borderRadius: "50%", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <span style={{ fontWeight: 800, color: theme.text, fontSize: 16, letterSpacing: "-0.3px" }}>{s.symbol}</span>
              <LaunchpadBadge isClanker={s.isClanker} isZyno={s.isZyno} />
              <span style={{ fontSize: 10, color: theme.muted, textTransform: "uppercase", padding: "1px 6px", background: theme.panel, borderRadius: 4, border: `1px solid ${theme.border}` }}>{s.chain}</span>
            </div>
            <div style={{ fontSize: 11, color: theme.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.name}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <ScoreRing score={s.score} color={c} />
            <ActionBadge action={s.action} />
          </div>
        </div>

        {/* Rise potential bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: theme.muted, marginBottom: 5 }}>
            <span style={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Rise Potential</span>
            <span style={{ color: c, fontWeight: 800, fontFamily: "var(--font-geist-mono), monospace" }}>
              {s.risePct !== undefined ? `+${s.risePct}% est.` : `${s.score}/100`}
            </span>
          </div>
          <div style={{ height: 4, background: theme.border, borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${s.score}%`, height: "100%", background: `linear-gradient(90deg, ${c}, ${c}AA)`, borderRadius: 999, transition: "width 0.8s ease", boxShadow: `0 0 12px ${c}50` }} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 12, color: theme.muted, flexWrap: "wrap", alignItems: "center" }}>
          <span>💧 {money(s.liquidityUsd)}</span>
          <span>📊 {money(s.volume24h)}</span>
          <span style={{ color: s.priceChange1h >= 0 ? theme.enter : theme.danger, fontWeight: 600, fontFamily: "var(--font-geist-mono), monospace" }}>
            1h {s.priceChange1h >= 0 ? "+" : ""}{s.priceChange1h.toFixed(1)}%
          </span>
          <span style={{ color: s.priceChange24h >= 0 ? theme.enter : theme.danger, fontWeight: 600, fontFamily: "var(--font-geist-mono), monospace" }}>
            24h {s.priceChange24h >= 0 ? "+" : ""}{s.priceChange24h.toFixed(1)}%
          </span>
          <AgeLabel ageHours={s.ageHours} />
        </div>

        {/* AI reasoning snippet */}
        <div style={{ marginTop: 10, padding: "8px 10px", background: `${c}08`, borderRadius: 8, border: `1px solid ${c}20`, fontSize: 11, color: theme.textSecondary, lineHeight: 1.5 }}>
          {s.reasoning}
        </div>

        {/* Bottom row: CA + action buttons */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.border}40`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <span style={{ color: theme.muted, fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
              {s.contractAddress.slice(0, 6)}…{s.contractAddress.slice(-4)}
            </span>
            <button onClick={copy} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.border}`, color: copied ? theme.accent : theme.muted, cursor: "pointer", padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
              {copied ? "✓" : "COPY"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* DexScreener chart */}
            <a
              href={s.dexscreenerUrl || `https://dexscreener.com/${s.chain}/${s.contractAddress}`}
              target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, background: theme.panel, border: `1px solid ${theme.border}`, color: theme.textSecondary, textDecoration: "none", fontSize: 11, fontWeight: 600 }}
            >
              📈 Chart
            </a>
            {/* Trade button */}
            <a
              href={s.tradeUrl || `https://app.uniswap.org/swap?chain=${s.chain === "base" ? "base" : "mainnet"}&outputCurrency=${s.contractAddress}`}
              target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 6, background: s.action === "ENTER" ? `linear-gradient(135deg, ${c}, ${c}CC)` : theme.panel, border: `1px solid ${s.action === "ENTER" ? c + "40" : theme.border}`, color: s.action === "ENTER" ? "#06070D" : theme.textSecondary, textDecoration: "none", fontSize: 11, fontWeight: 700 }}
            >
              ↗ Trade
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface SignalFeedProps {
  signals: Signal[];
  loading: boolean;
  onRefresh?: () => void;
  lastUpdated?: Date | null;
}

export default function SignalFeed({ signals, loading, onRefresh, lastUpdated }: SignalFeedProps) {
  const [filter, setFilter] = useState<"all" | "base" | "ethereum">("all");
  const [actionFilter, setActionFilter] = useState<"all" | "ENTER" | "WATCH">("all");
  const [countdown, setCountdown] = useState(60);

  // Countdown to next refresh
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const filtered = signals.filter((s) => {
    if (filter !== "all" && s.chain !== filter) return false;
    if (actionFilter !== "all" && s.action !== actionFilter) return false;
    return true;
  });

  const enterCount = signals.filter((s) => s.action === "ENTER").length;
  const watchCount = signals.filter((s) => s.action === "WATCH").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontSize: 13, color: theme.muted, textTransform: "uppercase", letterSpacing: 1, margin: 0, fontWeight: 700 }}>
            Live Token Launches
          </h2>
          <div className="live-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontSize: 11, color: theme.muted }}>{signals.length} tokens</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: theme.muted, fontFamily: "var(--font-geist-mono), monospace" }}>
            🔄 {countdown}s
          </span>
          {onRefresh && (
            <button onClick={onRefresh} disabled={loading} style={{ background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Source badges */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <span className="neon-badge neon-badge-green" style={{ fontSize: 10 }}>DexScreener</span>
        <span className="neon-badge neon-badge-purple" style={{ fontSize: 10 }}>Clanker</span>
        <span className="neon-badge neon-badge-blue" style={{ fontSize: 10 }}>GeckoTerminal</span>
        <span className="neon-badge neon-badge-orange" style={{ fontSize: 10 }}>Zyno</span>
        <span style={{ fontSize: 11, color: theme.muted, marginLeft: 4 }}>· {enterCount} ENTER · {watchCount} WATCH</span>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {(["all", "base", "ethereum"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${filter === f ? theme.accent + "60" : theme.border}`, background: filter === f ? `${theme.accent}15` : "transparent", color: filter === f ? theme.accent : theme.muted, cursor: "pointer", textTransform: "capitalize" }}>
            {f === "all" ? "All Chains" : f === "base" ? "⚡ Base" : "Ξ Ethereum"}
          </button>
        ))}
        <div style={{ width: 1, background: theme.border, margin: "0 4px" }} />
        {(["all", "ENTER", "WATCH"] as const).map((a) => (
          <button key={a} onClick={() => setActionFilter(a)}
            style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${actionFilter === a ? theme.accent + "60" : theme.border}`, background: actionFilter === a ? `${theme.accent}15` : "transparent", color: actionFilter === a ? theme.accent : theme.muted, cursor: "pointer" }}>
            {a === "all" ? "All Signals" : a}
          </button>
        ))}
      </div>

      {/* Signal list */}
      {loading && filtered.length === 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-shimmer" style={{ height: 160, background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 16 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ color: theme.muted, fontSize: 13, padding: 32, textAlign: "center", background: theme.panelAlt, borderRadius: 16, border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
          No signals match the current filters. Try changing chain or signal type.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((s, i) => (
            <SignalCard key={`${s.contractAddress}-${i}`} s={s} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
