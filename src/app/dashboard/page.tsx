"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

export default function Dashboard() {
  const router = useRouter();
  const {
    isConnected, walletAddress,
    signals, setSignals,
    agentResults, addAgentResults,
    isTierUnlocked, activeTab, setActiveTab,
  } = useStore();

  const [walletReady, setWalletReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localSignals, setLocalSignals] = useState<Signal[]>([]);
  const [localResults, setLocalResults] = useState<AgentResult[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState({ signalsPaid: 0, decisions: 0, hskSpent: 0 });
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInitialized = useRef(false);

  // ─── INIT ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initDashboard();
  }, []);

  async function initDashboard() {
    // Check persisted connection first (fast path)
    const store = useStore.getState();
    if (store.isConnected && store.walletAddress) {
      setWalletReady(true);
      setLoading(false);
      loadSignals();
      loadStats();
      return;
    }

    // Fallback: check live wallet
    if (!isWalletAvailable()) {
      router.replace("/");
      return;
    }
    const addr = await getUserAddress();
    if (!addr) {
      router.replace("/");
      return;
    }
    setWalletReady(true);
    setLoading(false);
    loadSignals();
    loadStats();
  }

  // Redirect on disconnect — but debounce so single-page navigation doesn't false-trigger
  useEffect(() => {
    if (!walletReady) return;
    if (!isConnected) {
      router.replace("/");
    }
  }, [isConnected, walletReady]);

  // ─── SIGNAL REFRESH (60 seconds) ────────────────────────────────────────────

  useEffect(() => {
    if (!walletReady) return;
    // Refresh signals every 60 seconds
    refreshTimer.current = setInterval(() => {
      loadSignals();
      loadStats();
    }, 60_000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [walletReady]);

  // ─── DATA LOADERS ────────────────────────────────────────────────────────────

  const loadSignals = useCallback(async () => {
    setSignalsLoading(true);
    try {
      const res = await fetch("/api/signals", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (j.success) {
        setLocalSignals(j.signals ?? []);
        setSignals(j.signals ?? []);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error("[Dashboard] Signal fetch error:", e);
    } finally {
      setSignalsLoading(false);
    }
  }, [setSignals]);

  async function loadStats() {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const j = await res.json();
      if (j.success) {
        const feeHsk = Number(j.data.signalFeeWei) / 1e18;
        setStats({
          signalsPaid: j.data.totalSignalsPaid,
          decisions: j.data.totalDecisions,
          hskSpent: j.data.totalSignalsPaid * feeHsk,
        });
      }
    } catch {}
  }

  // ─── AI AGENT CYCLE ──────────────────────────────────────────────────────────

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
      }
    } catch (e) {
      console.error("[Dashboard] Run cycle error:", e);
    } finally {
      setRunning(false);
    }
  }

  // ─── LOADING SCREEN ──────────────────────────────────────────────────────────

  if (loading || !walletReady) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text }}>
        <div className="animate-fadeIn" style={{ textAlign: "center" }}>
          <div className="gradient-text-large" style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>Sentinel</div>
          <div style={{ color: theme.muted, fontSize: 13 }}>
            <span className="animate-blink" style={{ marginRight: 6 }}>●</span>
            Initializing terminal…
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", position: "relative" }}>
      <div className="scan-line-overlay" style={{ position: "fixed", zIndex: 0, pointerEvents: "none" }} />

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <header
        className="glass-panel-premium dashboard-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", margin: "10px 14px 0", borderRadius: 14, position: "sticky", top: 10, zIndex: 40 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div className="gradient-text-large" style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px" }}>Sentinel</div>
            <div style={{ fontSize: 10, color: theme.muted }}>AI Signal Terminal · HashKey Chain</div>
          </div>
          <div className="neon-badge neon-badge-green animate-border-glow" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div className="live-dot" style={{ width: 5, height: 5 }} />
            {chainMeta().name}
          </div>
        </div>

        <div className="dashboard-header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/cli" className="btn-secondary" style={{ padding: "5px 12px", fontSize: 11 }}>CLI ↗</a>
          <a href={chainMeta().explorer} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: "5px 12px", fontSize: 11 }}>Explorer ↗</a>
          {isTierUnlocked(2) && (
            <button onClick={runCycle} disabled={running} className="btn-primary"
              style={{ padding: "7px 16px", fontSize: 12, opacity: running ? 0.7 : 1, cursor: running ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {running ? <><span className="animate-blink">●</span> Thinking…</> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg> Run Agent</>}
            </button>
          )}
          <WalletConnect onDisconnected={() => router.replace("/")} />
        </div>
      </header>

      {/* ─── MAIN ───────────────────────────────────────────────────────── */}
      <main style={{ padding: "16px 14px 40px", maxWidth: 1600, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Stats */}
        <div className="animate-fadeIn" style={{ marginBottom: 16 }}>
          <StatsBar
            signalsEvaluated={localSignals.length}
            paymentsMade={stats.signalsPaid}
            decisionsLogged={stats.decisions}
            hskSpent={stats.hskSpent}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
          <TabButton label="📡 Live Launches" active={activeTab === "signals"} onClick={() => setActiveTab("signals")} />
          <TabButton label="🤖 AI Signals" active={activeTab === "ai-signals"} onClick={() => setActiveTab("ai-signals")} />
          <TabButton label="🔍 Deep Analytics" active={activeTab === "checker"} onClick={() => setActiveTab("checker")} />
        </div>

        {/* Content grid */}
        <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 16, alignItems: "start" }}>

          {/* Left */}
          <section style={{ display: "grid", gap: 16, minWidth: 0 }}>
            {activeTab === "signals" && (
              <SignalFeed
                signals={localSignals}
                loading={signalsLoading}
                onRefresh={loadSignals}
                lastUpdated={lastUpdated}
              />
            )}
            {activeTab === "ai-signals" && (
              <PaymentTierGate tier={2}>
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>🤖 Sentinel AI Trading Agent</h3>
                    <p style={{ fontSize: 13, color: theme.muted, margin: "0 0 16px", lineHeight: 1.5 }}>
                      Autonomous AI agent scans new launches on Base & Ethereum, scores technical momentum, uses Google Gemini to generate trade signals with rise % predictions and entry reasoning — logged on HashKey Chain.
                    </p>
                    <button onClick={runCycle} disabled={running} className="btn-primary"
                      style={{ padding: "10px 20px", fontSize: 13, opacity: running ? 0.7 : 1, cursor: running ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {running
                        ? <><span className="animate-blink">●</span> Agent executing…</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg> Trigger AI Analysis Cycle</>}
                    </button>
                  </div>
                  <AgentReasoning results={localResults} steps={steps} running={running} />
                </div>
              </PaymentTierGate>
            )}
            {activeTab === "checker" && <TokenChecker />}
          </section>

          {/* Right sidebar */}
          <aside style={{ display: "grid", gap: 16 }}>
            <AICopilot />
            <PaymentHistory results={localResults} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none",
        cursor: "pointer", transition: "all 0.2s ease",
        background: active ? theme.panel : "transparent",
        color: active ? theme.text : theme.muted,
        borderBottom: active ? `2px solid ${theme.accent}` : "2px solid transparent",
      }}
    >
      {label}
    </button>
  );
}
