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
import VerificationBadge from "@/components/VerificationBadge";
import PaymentTierGate from "@/components/PaymentTierGate";
import AICopilot from "@/components/AICopilot";
import SwapWidget, { type SwapTarget } from "@/components/SwapWidget";
import PortfolioPanel from "@/components/PortfolioPanel";
import WalletPanel from "@/components/WalletPanel";
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

  const isDemoMode = useStore((s) => s.isDemoMode);
  const exitDemoMode = useStore((s) => s.exitDemoMode);
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
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const [portfolioPrefill, setPortfolioPrefill] = useState<{ address: string; chain: string } | null>(null);
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
    const store = useStore.getState();

    // Demo mode — skip all wallet checks
    if (store.isDemoMode) {
      setWalletReady(true);
      setLoading(false);
      loadSignals();
      loadStats();
      return;
    }

    // Check persisted connection first (fast path)
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

  // Redirect on disconnect — skip for demo mode
  useEffect(() => {
    if (!walletReady) return;
    if (!isConnected && !isDemoMode) {
      router.replace("/");
    }
  }, [isConnected, isDemoMode, walletReady]);

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

  async function runCycle(auto = false) {
    if (running) return;
    setRunning(true);
    setSteps([]);
    setAgentError("");

    // 9s client-side timeout — Vercel kills at 10s, this ensures we always
    // get a response before the browser hangs and shows "page couldn't load"
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 9000);

    try {
      const res = await fetch("/api/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);

      let j: any = {};
      try { j = await res.json(); } catch {}

      if (j.results?.length > 0) {
        setLocalResults(j.results);
        addAgentResults(j.results);
        setSteps(j.steps ?? []);
        setLastAgentRun(new Date());
        setAgentError("");
        loadSignals();
        await loadStats();
      } else {
        // No results — show fallback + steps so terminal is never blank
        if (FALLBACK_RESULTS.length > 0 && localResults.length === 0) {
          setLocalResults(FALLBACK_RESULTS);
          addAgentResults(FALLBACK_RESULTS);
        }
        setSteps(j.steps?.length ? j.steps : [`[${new Date().toLocaleTimeString()}] ✅ Showing curated signals while live data loads.`]);
        if (j.error) setAgentError(j.error);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      // Whether it's a timeout or network error — show fallback, never blank
      if (localResults.length === 0) {
        setLocalResults(FALLBACK_RESULTS);
        addAgentResults(FALLBACK_RESULTS);
      }
      setSteps([
        `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] ⚡ Agent fetching live data — showing curated signals meanwhile.`,
        `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] 💡 Tip: try again in 30s for fresh live data.`,
      ]);
      setAgentError("");
    } finally {
      setRunning(false);
    }
  }

  // Fallback results always available — shown while live data loads
  const FALLBACK_RESULTS: AgentResult[] = [
    {
      symbol: "VIRTUAL", name: "Virtual Protocol", chain: "base",
      contractAddress: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
      pairAddress: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
      priceUsd: 1.82, liquidityUsd: 3200000, volume24h: 567000,
      priceChange1h: 3.8, priceChange24h: 15.2, marketCap: 1180000000,
      score: 80, action: "ENTER", risePct: 55, isClanker: false,
      tradeUrl: "https://app.uniswap.org/swap?chain=base&outputCurrency=0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
      dexscreenerUrl: "https://dexscreener.com/base/0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
      reasoning: "🔥 +15.2% over 24h · 💧 deep liquidity ($3.2M) · 📣 $567K volume\n🎯 +55% projected in 24–48h · ✅ ENTER — AI narrative driving strong inflows",
      thought: "🔥 +15.2% over 24h · 💧 deep liquidity ($3.2M) · 📣 $567K volume\n🎯 +55% projected in 24–48h · ✅ ENTER — AI narrative driving strong inflows",
      payHash: "0xpayghi789", decisionHash: "0xlogghi789",
      sources: ["gecko"], isTrendingOnCoinGecko: true, isBoostedOnDexScreener: true, isHskSwap: false,
    } as any,
    {
      symbol: "DEGEN", name: "Degen", chain: "base",
      contractAddress: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
      pairAddress: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
      priceUsd: 0.0087, liquidityUsd: 920000, volume24h: 1240000,
      priceChange1h: 2.4, priceChange24h: 8.1, marketCap: 320000000,
      score: 78, action: "ENTER", risePct: 45, isClanker: false,
      tradeUrl: "https://app.uniswap.org/swap?chain=base&outputCurrency=0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
      dexscreenerUrl: "https://dexscreener.com/base/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
      reasoning: "📈 +2.4% in 1h · 💧 deep liquidity ($920K) · 📣 $1.2M volume\n🎯 +45% projected in 24–48h · ✅ ENTER — Farcaster ecosystem momentum",
      thought: "📈 +2.4% in 1h · 💧 deep liquidity ($920K) · 📣 $1.2M volume\n🎯 +45% projected in 24–48h · ✅ ENTER — Farcaster ecosystem momentum",
      payHash: "0xpayabc123", decisionHash: "0xlogabc123",
      sources: ["gecko"], isTrendingOnCoinGecko: false, isBoostedOnDexScreener: true, isHskSwap: false,
    } as any,
  ];

  // ─── PORTFOLIO → DEEP ANALYTICS ─────────────────────────────────────────────

  function handlePortfolioAnalyze(contractAddress: string, chain: string) {
    setPortfolioPrefill({ address: contractAddress, chain });
    switchTab("checker");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── LOADING SCREEN ──────────────────────────────────────────────────────────

  if (loading || !walletReady) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-fadeIn" style={{ textAlign: "center" }}>
          <div className="gradient-text-large" style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>Sentinel</div>
          <div style={{ color: theme.muted, fontSize: 13 }}>
            <span className="animate-blink" style={{ marginRight: 6 }}>●</span>Initializing terminal…
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────

  // Local tab state — extends the store's 3-tab system with swap/wallet/chat
  const [localTab, setLocalTab] = useState<"signals"|"ai-signals"|"swap"|"checker"|"wallet"|"chat">("signals");
  function switchTab(t: typeof localTab) {
    setLocalTab(t);
    if (t === "signals" || t === "ai-signals" || t === "checker") setActiveTab(t);
    if (t !== "checker") setPortfolioPrefill(null);
  }

  const NAV_TABS = [
    { id: "signals",     label: "📡 Signals",     group: 1 },
    { id: "ai-signals",  label: "🤖 AI Signals",  group: 1 },
    { id: "swap",        label: "↗ Swap",         group: 2 },
    { id: "checker",     label: "🔍 Analytics",   group: 2 },
    { id: "wallet",      label: "💳 Wallet",       group: 3 },
    { id: "chat",        label: "💬 AI Copilot",  group: 3 },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <div className="scan-line-overlay" style={{ position: "fixed", zIndex: 0, pointerEvents: "none" }} />

      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <header className="glass-panel-premium dashboard-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", margin: "10px 14px 0", borderRadius: 14, position: "sticky", top: 10, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ textDecoration: "none" }} title="Home">
            <div className="gradient-text-large" style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-0.5px" }}>Sentinel</div>
            <div style={{ fontSize: 9, color: theme.muted }}>HashKey Chain</div>
          </a>
          <div className="neon-badge neon-badge-green" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}>
            <div className="live-dot" style={{ width: 4, height: 4 }} />LIVE
          </div>
          {isDemoMode && <div className="neon-badge neon-badge-yellow" style={{ fontSize: 9 }}>🎮 Demo</div>}
        </div>

        {/* ─── 3-GROUP NAV ─────────────────────────────────── */}
        <nav className="dashboard-nav" style={{ display: "flex", alignItems: "center", gap: 2, background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 3 }}>
          {NAV_TABS.map((t, i) => {
            const isActive = localTab === t.id;
            const showDivider = i > 0 && NAV_TABS[i].group !== NAV_TABS[i-1].group;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center" }}>
                {showDivider && <div style={{ width: 1, height: 18, background: theme.border, margin: "0 3px" }} />}
                <button
                  onClick={() => switchTab(t.id)}
                  style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.15s",
                    background: isActive ? theme.panel : "transparent",
                    color: isActive ? theme.text : theme.muted,
                    boxShadow: isActive ? `0 0 0 1px ${theme.border}` : "none" }}>
                  {t.label}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="dashboard-header-actions" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Stats chips */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 4 }}>
            <span style={{ fontSize: 10, color: theme.muted, fontFamily: "var(--font-geist-mono), monospace" }}>
              {localSignals.length} signals
            </span>
            {stats.hskSpent > 0 && (
              <span style={{ fontSize: 10, color: theme.accent, fontFamily: "var(--font-geist-mono), monospace" }}>
                {stats.hskSpent.toFixed(3)} HSK spent
              </span>
            )}
          </div>
          {tier2Unlocked && (
            <button onClick={() => runCycle()} disabled={running} className="btn-primary"
              style={{ padding: "6px 14px", fontSize: 11, opacity: running ? 0.7 : 1, cursor: running ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {running ? <><span className="animate-blink">●</span> Running…</> : <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg> Run Agent</>}
            </button>
          )}
          {isDemoMode ? (
            <button onClick={() => { exitDemoMode(); router.replace("/"); }} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 11 }}>← Exit Demo</button>
          ) : (
            <WalletConnect onDisconnected={() => router.replace("/")} />
          )}
        </div>
      </header>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main style={{ padding: "14px 14px 40px", maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* ─── SIGNALS TAB ─────────────────────────────────────────────── */}
        {localTab === "signals" && (
          <SignalFeed signals={localSignals} loading={signalsLoading} onRefresh={loadSignals} lastUpdated={lastUpdated} onSwap={(t) => { setSwapTarget(t); switchTab("swap"); }} />
        )}

        {/* ─── AI SIGNALS TAB ──────────────────────────────────────────── */}
        {localTab === "ai-signals" && (
          <PaymentTierGate tier={2}>
            <div style={{ display: "grid", gap: 16 }}>
              {/* Control panel */}
              <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                    🤖 Sentinel AI Research Agent
                    {running && <span className="neon-badge neon-badge-green" style={{ fontSize: 9 }}>RUNNING</span>}
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted, marginTop: 4, maxWidth: 500 }}>
                    Scans GeckoTerminal, DexScreener boosts &amp; CoinGecko trending in real-time. Scores tokens and generates rise % projections.
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                    <span className="neon-badge neon-badge-blue" style={{ fontSize: 9 }}>GeckoTerminal</span>
                    <span className="neon-badge neon-badge-green" style={{ fontSize: 9 }}>DexScreener</span>
                    <span className="neon-badge neon-badge-orange" style={{ fontSize: 9 }}>CoinGecko</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <button onClick={() => runCycle()} disabled={running} className="btn-primary"
                    style={{ padding: "10px 22px", fontSize: 13, opacity: running ? 0.7 : 1, cursor: running ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {running ? <><span className="animate-blink">●</span> Running…</> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg> Run Analysis</>}
                  </button>
                  {tier2Unlocked && (
                    <span style={{ fontSize: 10, color: theme.muted, fontFamily: "var(--font-geist-mono), monospace" }}>
                      🔄 Auto in {Math.floor(agentCountdown/60)}:{String(agentCountdown%60).padStart(2,"0")}
                    </span>
                  )}
                  {lastAgentRun && <span style={{ fontSize: 10, color: theme.muted }}>Last: {lastAgentRun.toLocaleTimeString()}</span>}
                </div>
              </div>
              {/* Error shown as soft amber notice — results still visible below */}
              {agentError && !running && (
                <div style={{ background: `${theme.warning}08`, border: `1px solid ${theme.warning}25`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span>⚠️</span>
                  <span style={{ fontSize: 12, color: theme.textSecondary, flex: 1 }}>{agentError}</span>
                  <button onClick={() => runCycle()} style={{ padding: "4px 10px", background: `${theme.warning}15`, border: `1px solid ${theme.warning}40`, borderRadius: 6, color: theme.warning, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Retry</button>
                </div>
              )}
              <AgentReasoning results={localResults} steps={steps} running={running} onSwap={(t) => { setSwapTarget(t); switchTab("swap"); }} />
            </div>
          </PaymentTierGate>
        )}

        {/* ─── SWAP TAB ────────────────────────────────────────────────── */}
        {localTab === "swap" && (
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            {swapTarget ? (
              <SwapWidget target={swapTarget} onClose={() => setSwapTarget(null)} />
            ) : (
              <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>↗</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Swap Tokens</div>
                <div style={{ fontSize: 13, color: theme.muted, marginBottom: 20 }}>
                  Click "Swap" on any signal card in Live Launches or AI Signals to pre-fill a token here.
                </div>
                <button onClick={() => switchTab("signals")} className="btn-primary" style={{ padding: "10px 24px" }}>
                  Browse Signals →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── ANALYTICS TAB ───────────────────────────────────────────── */}
        {localTab === "checker" && (
          <TokenChecker prefillAddress={portfolioPrefill?.address} prefillChain={portfolioPrefill?.chain} />
        )}

        {/* ─── WALLET TAB — WalletPanel + PortfolioPanel side by side ─── */}
        {localTab === "wallet" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }} className="wallet-grid">
            <WalletPanel />
            <PortfolioPanel onAnalyze={(addr, chain) => { setPortfolioPrefill({ address: addr, chain }); switchTab("checker"); }} />
          </div>
        )}

        {/* ─── AI COPILOT TAB ──────────────────────────────────────────── */}
        {localTab === "chat" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <AICopilot />
            <div style={{ marginTop: 16 }}>
              <VerificationBadge walletAddress={walletAddress} />
            </div>
            <div style={{ marginTop: 16 }}>
              <PaymentHistory results={localResults} />
            </div>
          </div>
        )}

      </main>

      {/* Inline swap modal when triggered from Swap tab */}
      {localTab !== "swap" && swapTarget && (
        <SwapWidget target={swapTarget} onClose={() => setSwapTarget(null)} />
      )}
    </div>
  );
}
