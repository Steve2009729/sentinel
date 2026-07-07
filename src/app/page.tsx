"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/theme";
import WalletConnect from "@/components/WalletConnect";
import LiveToasts from "@/components/LiveToasts";

// Mock terminal data for the blurred background
const MOCK_SIGNALS = [
  { symbol: "PEPE", action: "ENTER", score: 87, change: "+42.3%" },
  { symbol: "BRETT", action: "WATCH", score: 62, change: "+8.1%" },
  { symbol: "DEGEN", action: "ENTER", score: 91, change: "+127.5%" },
  { symbol: "HIGHER", action: "SKIP", score: 34, change: "-3.2%" },
  { symbol: "MOCHI", action: "WATCH", score: 55, change: "+15.7%" },
  { symbol: "TOSHI", action: "ENTER", score: 78, change: "+31.4%" },
  { symbol: "AERODROME", action: "WATCH", score: 67, change: "+12.9%" },
  { symbol: "VIRTUAL", action: "ENTER", score: 84, change: "+56.2%" },
];

// Particles for the background effect
function ParticleField() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            bottom: `-${Math.random() * 20}px`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            background: i % 3 === 0
              ? "rgba(0, 229, 160, 0.4)"
              : i % 3 === 1
              ? "rgba(91, 141, 239, 0.3)"
              : "rgba(168, 85, 247, 0.3)",
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnected = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg }} />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0, 229, 160, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 160, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          animation: "grid-pan 8s linear infinite",
          zIndex: 0,
        }}
      />

      {/* Radial glow - primary */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0, 229, 160, 0.06) 0%, transparent 60%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Secondary glow - blue */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "25%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(91, 141, 239, 0.04) 0%, transparent 60%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Tertiary glow - purple */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "20%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.03) 0%, transparent 60%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Particle field */}
      <ParticleField />

      {/* Blurred terminal mockup in background */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "90%",
          maxWidth: 1200,
          zIndex: 1,
          filter: "blur(8px)",
          opacity: 0.2,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 20,
            padding: 28,
          }}
        >
          {/* Mock header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.accent }}>
              SENTINEL TERMINAL
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ width: 80, height: 12, background: theme.panelAlt, borderRadius: 4 }} />
              <div style={{ width: 60, height: 12, background: theme.panelAlt, borderRadius: 4 }} />
            </div>
          </div>

          {/* Mock stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {["245", "12", "8", "0.0854"].map((v, i) => (
              <div
                key={i}
                style={{
                  background: theme.panelAlt,
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{v}</div>
                <div style={{ height: 8, width: "60%", background: theme.border, borderRadius: 4, marginTop: 8 }} />
              </div>
            ))}
          </div>

          {/* Mock signal cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {MOCK_SIGNALS.map((s, i) => (
              <div
                key={i}
                style={{
                  background: theme.panelAlt,
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>{s.symbol}</div>
                  <div style={{ fontSize: 11, color: theme.muted }}>{s.change}</div>
                </div>
                <div
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    color: s.action === "ENTER" ? theme.enter : s.action === "WATCH" ? theme.warning : theme.skip,
                    border: `1px solid ${s.action === "ENTER" ? theme.enter : s.action === "WATCH" ? theme.warning : theme.skip}30`,
                  }}
                >
                  {s.score}/100
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live toast notifications */}
      <LiveToasts />

      {/* Main CTA content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div
          className="animate-fadeInUp"
          style={{
            textAlign: "center",
            maxWidth: 680,
          }}
        >
          {/* Badge */}
          <div
            className="neon-badge neon-badge-green animate-float"
            style={{ marginBottom: 28 }}
          >
            <div className="live-dot" style={{ width: 6, height: 6 }} />
            Live on HashKey Chain · Mainnet
          </div>

          {/* Decorative ring */}
          <div
            style={{
              position: "relative",
              display: "inline-block",
              marginBottom: 20,
            }}
          >
            <div
              className="animate-rotate-slow"
              style={{
                position: "absolute",
                inset: -30,
                borderRadius: "50%",
                border: "1px solid rgba(0, 229, 160, 0.06)",
                pointerEvents: "none",
              }}
            />
            <div
              className="animate-rotate-slow"
              style={{
                position: "absolute",
                inset: -50,
                borderRadius: "50%",
                border: "1px dashed rgba(91, 141, 239, 0.04)",
                pointerEvents: "none",
                animationDirection: "reverse",
                animationDuration: "30s",
              }}
            />

            {/* Title */}
            <h1
              style={{
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1.0,
                margin: 0,
                letterSpacing: "-3px",
              }}
            >
              <span className="gradient-text-large" style={{ animation: "gradient-shift 6s ease infinite, neon-breathe 3s ease-in-out infinite" }}>Sentinel</span>
            </h1>
          </div>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 18,
              color: theme.textSecondary,
              margin: "20px 0 0",
              lineHeight: 1.7,
              maxWidth: 520,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Autonomous AI token signal terminal.
            <br />
            <span style={{ color: theme.muted }}>Real-time analytics. On-chain settlements. HSK-powered.</span>
          </p>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginTop: 28,
              flexWrap: "wrap",
            }}
          >
            {[
              { text: "Base & Ethereum", icon: "⛓️" },
              { text: "Clanker Detection", icon: "🔍" },
              { text: "TradingView Charts", icon: "📈" },
              { text: "Smart Money Tracking", icon: "🐋" },
            ].map(
              (f, i) => (
                <span
                  key={i}
                  className="animate-fadeIn"
                  style={{
                    padding: "7px 16px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    color: theme.muted,
                    border: `1px solid ${theme.border}`,
                    background: "rgba(13, 15, 26, 0.6)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    animationDelay: `${0.3 + i * 0.1}s`,
                    animationFillMode: "backwards",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{f.icon}</span>
                  {f.text}
                </span>
              )
            )}
          </div>

          {/* CTA */}
          <div
            className="animate-fadeIn"
            style={{
              marginTop: 44,
              animationDelay: "0.5s",
              animationFillMode: "backwards",
            }}
          >
            <WalletConnect onConnected={handleConnected} />
          </div>

          {/* Tier preview */}
          <div
            className="animate-fadeIn"
            style={{
              marginTop: 44,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              animationDelay: "0.7s",
              animationFillMode: "backwards",
            }}
          >
            {[
              { tier: 1, emoji: "🔓", name: "Basic Signals", cost: "0.005 HSK", desc: "20 raw signals", color: theme.tierBasic },
              { tier: 2, emoji: "⭐", name: "Premium", cost: "1.5 HSK", desc: "80%+ Rise Potential", color: theme.tierPremium },
              { tier: 3, emoji: "🔬", name: "Deep Analytics", cost: "0.01/asset", desc: "Charts & KOL data", color: theme.tierDeep },
            ].map((t) => (
              <div
                key={t.tier}
                className="holo-card"
                style={{
                  background: theme.panel,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 16,
                  padding: "20px 16px",
                  textAlign: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div className="scan-line-overlay" />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{t.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: t.color, fontWeight: 700, margin: "6px 0" }}>
                    {t.cost}
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Supported wallets */}
          <div
            className="animate-fadeIn"
            style={{
              marginTop: 32,
              animationDelay: "0.9s",
              animationFillMode: "backwards",
            }}
          >
            <div style={{ fontSize: 11, color: theme.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>
              Supported Wallets
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              {["🦊 MetaMask", "🛡️ Trust Wallet", "🐰 Rabby", "🔵 Coinbase", "🟡 OKX"].map((w, i) => (
                <span key={i} style={{ fontSize: 12, color: theme.muted, opacity: 0.7 }}>
                  {w}
                </span>
              ))}
            </div>
          </div>

          {/* Explorer link */}
          <div
            style={{
              marginTop: 28,
              fontSize: 12,
              color: theme.muted,
            }}
          >
            <a
              href="https://hashkey.blockscout.com"
              target="_blank"
              rel="noreferrer"
              style={{
                color: theme.accent,
                textDecoration: "none",
                borderBottom: `1px solid ${theme.accent}30`,
                paddingBottom: 2,
              }}
            >
              View on HashKey Explorer ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
