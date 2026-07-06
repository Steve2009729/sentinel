"use client";

import { Signal } from "@/lib/types";
import { theme, actionColor } from "@/lib/theme";
import PaymentTierGate from "./PaymentTierGate";

function money(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + Math.round(n).toLocaleString();
}

function ActionBadge({ action }: { action: string }) {
  const c = actionColor(action);
  return (
    <span
      style={{
        color: c,
        border: `1px solid ${c}40`,
        background: `${c}10`,
        borderRadius: 999,
        padding: "4px 14px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        boxShadow: `0 0 12px ${c}15`,
      }}
    >
      {action}
    </span>
  );
}

function ClankerBadge() {
  return (
    <span className="neon-badge neon-badge-purple" style={{ padding: "2px 8px", fontSize: 10 }}>
      Clanker
    </span>
  );
}

// ─── SCORE RING INDICATOR ─────────────────────────────────────────────────────

function ScoreRing({ score, color, size = 38 }: { score: number; color: string; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.border}
          strokeWidth="3"
        />
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.8s ease",
            filter: `drop-shadow(0 0 4px ${color}60)`,
          }}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          fontSize: 10,
          fontWeight: 800,
          color,
          fontFamily: "var(--font-geist-mono), monospace",
        }}
      >
        {score}
      </span>
    </div>
  );
}

// ─── SIGNAL CARD ──────────────────────────────────────────────────────────────

function SignalCard({ s, index }: { s: Signal; index: number }) {
  const c = actionColor(s.action);
  return (
    <div
      className="holo-card animate-fadeIn"
      style={{
        background: theme.panelAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 18,
        transition: "all 0.25s ease",
        animationDelay: `${index * 0.05}s`,
        animationFillMode: "backwards",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Scan line overlay */}
      <div className="scan-line-overlay" />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, color: theme.text, fontSize: 16, letterSpacing: "-0.3px" }}>
                {s.symbol}
              </span>
              {s.isClanker && <ClankerBadge />}
            </div>
            <div
              style={{
                fontSize: 12,
                color: theme.muted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 3,
              }}
            >
              {s.name} · {s.chain.toUpperCase()}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ScoreRing score={s.score} color={c} />
            <ActionBadge action={s.action} />
          </div>
        </div>

        {/* Score bar */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: theme.muted,
              marginBottom: 6,
            }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Rise Potential</span>
            <span style={{ color: c, fontWeight: 700, fontFamily: "var(--font-geist-mono), monospace" }}>
              {s.score}/100
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: theme.border,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${s.score}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${c}, ${c}AA)`,
                borderRadius: 999,
                transition: "width 0.8s ease",
                boxShadow: `0 0 12px ${c}50`,
              }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 14,
            marginTop: 14,
            fontSize: 12,
            color: theme.muted,
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, opacity: 0.6 }}>💧</span>
            Liq {money(s.liquidityUsd)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, opacity: 0.6 }}>📊</span>
            Vol {money(s.volume24h)}
          </span>
          <span
            style={{
              color: s.priceChange1h >= 0 ? theme.enter : theme.danger,
              fontWeight: 600,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            1h {s.priceChange1h >= 0 ? "+" : ""}
            {s.priceChange1h.toFixed(1)}%
          </span>
          {s.ageHours < 24 && (
            <span style={{ color: theme.warning, fontWeight: 600 }}>
              🆕 {s.ageHours < 1 ? "<1h" : `${Math.round(s.ageHours)}h`} old
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SIGNAL FEED ──────────────────────────────────────────────────────────────

interface SignalFeedProps {
  signals: Signal[];
  loading: boolean;
  gated?: boolean;
}

export default function SignalFeed({ signals, loading, gated = false }: SignalFeedProps) {
  const content = (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 13,
            color: theme.muted,
            textTransform: "uppercase",
            letterSpacing: 1,
            margin: 0,
            fontWeight: 700,
          }}
        >
          Signal Feed
        </h2>
        <div className="live-dot" style={{ width: 6, height: 6 }} />
        <span style={{ fontSize: 11, color: theme.muted }}>
          {signals.length} signals · Base & Ethereum
        </span>
      </div>

      {loading && signals.length === 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-shimmer"
              style={{
                height: 140,
                background: theme.panelAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
              }}
            />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div
          style={{
            color: theme.muted,
            fontSize: 13,
            padding: 32,
            textAlign: "center",
            background: theme.panelAlt,
            borderRadius: 16,
            border: `1px solid ${theme.border}`,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
          No signals returned. DexScreener may be rate-limiting.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {signals.map((s, i) => (
            <SignalCard key={`${s.symbol}-${s.pairAddress}-${i}`} s={s} index={i} />
          ))}
        </div>
      )}
    </div>
  );

  if (gated) {
    return <PaymentTierGate tier={1}>{content}</PaymentTierGate>;
  }

  return content;
}
