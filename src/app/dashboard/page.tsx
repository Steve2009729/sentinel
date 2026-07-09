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

  const tier2Unlocked = isTierUnlocked(2);

  const [walletReady, setWalletReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localSignals, setLocalSignals] = useState<Signal[]>([]);
  const [localResults, setLocalResults] = useState<AgentResult[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [agentError, setAgentError] = useState<string>("");
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastAgentRun, setLastAgentRun] = useState<Date | null>(null);
  const [agentCountdown, setAgentCountdown] = useState(300);
  const [stats, setStats] = useState({ signalsPaid: 0, decisions: 0, hskSpent: 0 });
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentTimer = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // ─── AI AGENT AUTO-CYCLE (every 5 minutes) ────────────────────────────────

  useEffect(() => {
    if (!walletReady) return;
    if (!tier2Unlocked) return;

    // Countdown ticker
    const ticker = setInterval(() => {
      setAgentCountdown((c) => (c <= 1 ? 300 : c - 1));
    }, 1000);

    // Auto-run every 5 minutes
    agentTimer.current = setInterval(() => {
      runCycle(true); // auto = true
      setAgentCountdown(300);
    }, 5 * 60_000);

    return () => {
      clearInterval(ticker);
      if (agentTimer.current) clearInterval(agentTimer.current);
    };
  }, [walletReady, tier2Unlocked]);

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

  async function runCycle(auto = false) {
    if (running) return;
    setRunning(true);
    setSteps([]);
    setAgentError("");
    try {
      const res = await fetch("/api/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Always try to parse — even error responses may have useful info
      let j: any = {};
      try { j = await res.json(); } catch {}

      if (j.success && j.results?.length > 0) {
        setLocalResults(j.results ?? []);
        addAgentResults(j.results ?? []);
        setSteps(j.steps ?? []);
        setLastAgentRun(new Date());
        await loadStats();
      } else {
        // Show error in the terminal — not a blank page
        const errMsg = j.error || "Agent cycle returned no results. Markets may be quiet or APIs are rate-limited. Try again in a moment.";
        setAgentError(errMsg);
        setSteps(j.steps ?? [`[${new Date().toLocaleTimeString()}] ❌ ${errMsg}`]);
      }
    } catch (e: any) {
      const msg = `Network error: ${e.message || "Could not reach the server"}. Check your connection and try again.`;
      setAgentError(msg);
      setSteps([`[${new Date().toLocaleTimeString()}] ❌ ${msg}`]);
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
            <button onClick={() => runCycle()} disabled={running} className="btn-primary"
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
                  {/* Agent control panel */}
                  <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
                          🤖 Sentinel AI Research Agent
                          {running && <span className="neon-badge neon-badge-green" style={{ fontSize: 9 }}>RUNNING</span>}
                        </h3>
                        <p style={{ fontSize: 12, color: theme.muted, margin: 0, lineHeight: 1.5 }}>
                          Scans DexScreener boosts, GeckoTerminal trending pools, and CoinGecko trending in real-time.
                          Google Gemini AI analyzes each token with rise % projections, entry reasoning, and risk factors.
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                        <button onClick={() => runCycle()} disabled={running} className="btn-primary"
                          style={{ padding: "10px 20px", fontSize: 13, opacity: running ? 0.7 : 1, cursor: running ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                          {running
                            ? <><span className="animate-blink">●</span> Agent running…</>
                            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg> Run Analysis Now</>}
                        </button>
                        {isTierUnlocked(2) && (
                          <span style={{ fontSize: 10, color: theme.muted, fontFamily: "var(--font-geist-mono), monospace" }}>
                            🔄 Auto-refresh in {Math.floor(agentCountdown / 60)}:{String(agentCountdown % 60).padStart(2, "0")}
                          </span>
                        )}
                        {lastAgentRun && (
                          <span style={{ fontSize: 10, color: theme.muted }}>
                            Last run: {lastAgentRun.toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Data sources row */}
                    <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
                      <span className="neon-badge neon-badge-blue" style={{ fontSize: 9 }}>GeckoTerminal Trending</span>
                      <span className="neon-badge neon-badge-green" style={{ fontSize: 9 }}>DexScreener Boosts</span>
                      <span className="neon-badge neon-badge-orange" style={{ fontSize: 9 }}>CoinGecko Trending</span>
                      <span className="neon-badge neon-badge-purple" style={{ fontSize: 9 }}>Gemini 1.5 Flash AI</span>
                    </div>
                  </div>

                  {/* Error state — clear, not a blank page */}
                  {agentError && !running && localResults.length === 0 && (
                    <div style={{ background: `${theme.warning}08`, border: `1px solid ${theme.warning}30`, borderRadius: 14, padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                        <div>
                          <div style={{ fontWeight: 700, color: theme.text, marginBottom: 6 }}>Agent cycle encountered an issue</div>
                          <div style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.6 }}>{agentError}</div>
                          <button onClick={() => runCycle()} style={{ marginTop: 12, padding: "7px 16px", background: `${theme.warning}15`, border: `1px solid ${theme.warning}40`, borderRadius: 8, color: theme.warning, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

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
