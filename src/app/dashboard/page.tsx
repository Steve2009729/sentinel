"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import SignalFeed from "@/components/SignalFeed";
import StatsBar from "@/components/StatsBar";
import AgentReasoning from "@/components/AgentReasoning";
import PaymentHistory from "@/components/PaymentHistory";
import TokenChecker from "@/components/TokenChecker";
import WalletConnect from "@/components/WalletConnect";
import PaymentTierGate from "@/components/PaymentTierGate";
import AICopilot from "@/components/AICopilot";
import { isWalletAvailable, getUserAddress } from "@/lib/contracts-client";
import { chainMeta } from "@/lib/contract";
import type { Signal, AgentResult } from "@/lib/types";

type Tab = "signals" | "ai-signals" | "checker";

export default function Dashboard() {
  const router = useRouter();
  const { isConnected, setWallet, signals, setSignals, agentResults, addAgentResults, demoMode, setDemoMode, isTierUnlocked, activeTab, setActiveTab } = useStore();
  const [walletReady, setWalletReady] = useState(false);
  const [localSignals, setLocalSignals] = useState<Signal[]>([]);
  const [localResults, setLocalResults] = useState<AgentResult[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [stats, setStats] = useState({ signalsPaid: 0, decisions: 0, hskSpent: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  async function checkWalletConnection() {
    if (!isWalletAvailable()) {
      router.push("/");
      return;
    }

    const addr = await getUserAddress();
    if (!addr) {
      router.push("/");
      return;
    }

    setWalletReady(true);
    setLoading(false);
    loadSignals();
    loadStats();
  }

  async function loadSignals() {
    setSignalsLoading(true);
    try {
      const res = await fetch("/api/signals");
      const j = await res.json();
      if (j.success) {
        setLocalSignals(j.signals ?? []);
        setSignals(j.signals ?? []);
      }
    } catch (e) {
      console.error("[Dashboard] Signal fetch error:", e);
    } finally {
      setSignalsLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch("/api/stats");
      const j = await res.json();
      if (j.success) {
        const feeHsk = Number(j.data.signalFeeWei) / 1e18;
        setStats({
          signalsPaid: j.data.totalSignalsPaid,
          decisions: j.data.totalDecisions,
          hskSpent: j.data.totalSignalsPaid * feeHsk,
        });
      }
    } catch (e) {
      console.error("[Dashboard] Stats fetch error:", e);
    }
  }

  // Auto-refresh signals and stats
  useEffect(() => {
    if (!walletReady) return;
    const iv = setInterval(() => {
      loadSignals();
      loadStats();
    }, 15_000);
    return () => clearInterval(iv);
  }, [walletReady]);

  async function runCycle() {
    setRunning(true);
    setSteps([]);
    try {
      const res = await fetch("/api/run-agent", { method: "POST" });
      const j = await res.json();
      if (j.success) {
        setLocalResults(j.results ?? []);
        addAgentResults(j.results ?? []);
        setSteps(j.steps ?? []);
        await loadStats();
      } else {
        console.error("[Dashboard] Agent error:", j.error);
        alert("Agent error: " + j.error);
      }
    } catch (e) {
      console.error("[Dashboard] Run cycle error:", e);
      alert("Failed to run agent cycle");
    } finally {
      setRunning(false);
    }
  }

  if (loading || !walletReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.text,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        <div className="animate-fadeIn" style={{ textAlign: "center" }}>
          <div className="gradient-text-large" style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>
            Sentinel
          </div>
          <div style={{ color: theme.muted, fontSize: 13 }}>
            <span className="animate-blink" style={{ marginRight: 6 }}>●</span>
            Initializing terminal…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Subtle scan lines across entire dashboard */}
      <div className="scan-line-overlay" style={{ position: "fixed", zIndex: 0 }} />

      {/* ─── HEADER ─────────────────────────────────────────── */}
      <header
        className="glass-panel-premium dashboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 24px",
          margin: "12px 16px 0",
          borderRadius: 16,
          position: "sticky",
          top: 12,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <div
              className="gradient-text-large"
              style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}
            >
              Sentinel
            </div>
            <div style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.3 }}>
              Autonomous EVM Signal Terminal · HashKey Chain
            </div>
          </div>

          {/* Network badge */}
          <div className="neon-badge neon-badge-green animate-border-glow">
            <div className="live-dot" style={{ width: 5, height: 5 }} />
            {chainMeta().name}
          </div>
        </div>

        <div className="dashboard-header-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Demo Mode Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${theme.border}`, padding: "6px 12px", borderRadius: 10 }}>
            <span style={{ fontSize: 10, color: demoMode ? theme.accent : theme.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {demoMode ? "Demo Mode" : "Live Mode"}
            </span>
            <button
              onClick={() => setDemoMode(!demoMode)}
              style={{
                width: 32,
                height: 18,
                borderRadius: 99,
                background: demoMode ? theme.accent : theme.border,
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.2s",
                padding: 0,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#06070D",
                  position: "absolute",
                  top: 2,
                  left: demoMode ? 16 : 2,
                  transition: "all 0.2s",
                }}
              />
            </button>
          </div>

          <a
            href="/cli"
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            CLI ↗
          </a>
          <a
            href={chainMeta().explorer}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            Explorer ↗
          </a>

          {isTierUnlocked(2) && (
            <button
              onClick={runCycle}
              disabled={running}
              className="btn-primary"
              style={{
                padding: "8px 18px",
                fontSize: 13,
                opacity: running ? 0.7 : 1,
                cursor: running ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {running ? (
                <>
                  <span className="animate-blink">●</span> Agent thinking…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  Run Agent Cycle
                </>
              )}
            </button>
          )}

          <WalletConnect onDisconnected={() => router.push("/")} />
        </div>
      </header>

      {/* ─── MAIN CONTENT ───────────────────────────────────── */}
      <main style={{ padding: "18px 16px 32px", maxWidth: 1600, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Stats Bar */}
        <div className="animate-fadeIn" style={{ marginBottom: 18 }}>
          <StatsBar
            signalsEvaluated={localSignals.length}
            paymentsMade={stats.signalsPaid}
            decisionsLogged={stats.decisions}
            hskSpent={stats.hskSpent}
          />
        </div>

        {/* Tab navigation */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
          <TabButton
            label="📡 Live Launches"
            active={activeTab === "signals"}
            onClick={() => setActiveTab("signals")}
          />
          <TabButton
            label="🤖 AI Signals"
            active={activeTab === "ai-signals"}
            onClick={() => setActiveTab("ai-signals")}
          />
          <TabButton
            label="🔍 Deep Analytics"
            active={activeTab === "checker"}
            onClick={() => setActiveTab("checker")}
          />
        </div>

        {/* Content grid */}
        <div
          className="dashboard-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 420px",
            gap: 18,
            alignItems: "start",
          }}
        >
          {/* Left column */}
          <section style={{ display: "grid", gap: 18 }}>
            {activeTab === "signals" ? (
              <SignalFeed signals={localSignals} loading={signalsLoading} gated={false} />
            ) : activeTab === "ai-signals" ? (
              <PaymentTierGate tier={2}>
                <div style={{ display: "grid", gap: 18 }}>
                  <div
                    style={{
                      background: theme.panel,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 16,
                      padding: 20,
                    }}
                  >
                    <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>🤖 Sentinel AI Trading Agent</h3>
                    <p style={{ fontSize: 13, color: theme.muted, margin: "0 0 16px", lineHeight: 1.5 }}>
                      Our autonomous AI agent scans new launches on Base & Ethereum, scores technical momentum, and uses Google Gemini to generate trade signals logged directly to HashKey Chain.
                    </p>
                    <button
                      onClick={runCycle}
                      disabled={running}
                      className="btn-primary"
                      style={{
                        padding: "10px 20px",
                        fontSize: 13,
                        opacity: running ? 0.7 : 1,
                        cursor: running ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {running ? (
                        <>
                          <span className="animate-blink">●</span> Agent executing cycle…
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5,3 19,12 5,21" />
                          </svg>
                          Trigger AI Analysis Cycle
                        </>
                      )}
                    </button>
                  </div>
                  
                  <AgentReasoning results={localResults} steps={steps} running={running} />
                </div>
              </PaymentTierGate>
            ) : (
              <TokenChecker />
            )}
          </section>

          {/* Right sidebar */}
          <aside style={{ display: "grid", gap: 18 }}>
            <AICopilot />
            <PaymentHistory results={localResults} />
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─── TAB BUTTON ───────────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 20px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        border: "none",
        cursor: "pointer",
        transition: "all 0.2s ease",
        background: active ? theme.panel : "transparent",
        color: active ? theme.text : theme.muted,
        borderBottom: active ? `2px solid ${theme.accent}` : "2px solid transparent",
        letterSpacing: 0.3,
      }}
    >
      {label}
    </button>
  );
}
