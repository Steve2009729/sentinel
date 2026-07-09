"use client";

import { useEffect, useState, useRef } from "react";
import { AgentResult } from "@/lib/types";
import { theme, actionColor } from "@/lib/theme";

interface AgentReasoningProps {
  results: AgentResult[];
  steps: string[];
  running: boolean;
}

function ScoreMeter({ score, action }: { score: number; action: string }) {
  const c = actionColor(action);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: theme.border, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: `linear-gradient(90deg, ${c}, ${c}AA)`, transition: "width 1s ease", boxShadow: `0 0 8px ${c}50` }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: c, fontFamily: "var(--font-geist-mono), monospace", minWidth: 36 }}>{score}/100</span>
    </div>
  );
}

export default function AgentReasoning({ results, steps, running }: AgentReasoningProps) {
  const [displayedSteps, setDisplayedSteps] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (running) {
      setShowResults(false);
      setDisplayedSteps(["[SYSTEM] Connecting to Sentinel agent cluster...", "[SYSTEM] Launching market intelligence scan..."]);
    }
  }, [running]);

  useEffect(() => {
    if (steps.length > 0) {
      let i = 0;
      setDisplayedSteps([]);
      const interval = setInterval(() => {
        if (i < steps.length) {
          setDisplayedSteps((prev) => [...prev, steps[i]]);
          i++;
          stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        } else {
          clearInterval(interval);
          if (results.length > 0) setShowResults(true);
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [steps, results.length]);

  useEffect(() => {
    if (results.length > 0 && !running && steps.length === 0) {
      setShowResults(true);
    }
  }, [results, running, steps.length]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* ─── TERMINAL LOG ─────────────────────────────────── */}
      <div className="terminal-chrome" style={{ background: "#07080F", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div className="scan-line-overlay" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${theme.border}`, background: "rgba(13,15,26,0.5)", position: "relative", zIndex: 1 }}>
          <div className="terminal-dots"><span /><span /><span /></div>
          <span style={{ fontSize: 11, color: theme.muted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>sentinel-agent@hashkey</span>
          <div style={{ width: 52 }} />
        </div>
        <div style={{ padding: 16, fontFamily: "var(--font-geist-mono), monospace", fontSize: 12, lineHeight: 1.7, minHeight: 120, maxHeight: 280, overflowY: "auto", position: "relative", zIndex: 1 }}>
          <div style={{ color: theme.muted, marginBottom: 8 }}>
            <span style={{ color: theme.accent }}>sentinel</span>@<span style={{ color: theme.tierBasic }}>hashkey</span> ~/agent ${" "}
            {running && <span className="animate-blink" style={{ color: theme.accent }}>● agent active</span>}
          </div>
          {displayedSteps.length === 0 && !running && results.length === 0 && (
            <div style={{ color: theme.muted }}>
              › Run an analysis cycle to see live market research and AI-generated trade signals from DexScreener, GeckoTerminal, and CoinGecko.
            </div>
          )}
          {displayedSteps.map((s, i) => {
            const isError = s.includes("❌") || s.includes("Fatal");
            const isSuccess = s.includes("✅") || s.includes("🏁") || s.includes("generated");
            const isInfo = s.startsWith("  ›");
            return (
              <div key={i} style={{ color: isError ? theme.danger : isSuccess ? theme.accent : isInfo ? theme.textSecondary : theme.muted }}>
                {s}
              </div>
            );
          })}
          <div ref={stepsEndRef} />
        </div>
      </div>

      {/* ─── SIGNAL CARDS ─────────────────────────────────── */}
      {showResults && results.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, marginBottom: 10 }}>
            📡 AI Research Signals — {results.length} tokens analyzed
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {results.map((r, i) => {
              const c = actionColor(r.action);
              const res = r as any; // extended fields from run-agent
              return (
                <div key={`${r.symbol}-${i}`} className="holo-card animate-fadeIn"
                  style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18, position: "relative", overflow: "hidden", animationDelay: `${i * 0.1}s`, animationFillMode: "backwards" }}>
                  <div className="scan-line-overlay" />
                  <div style={{ position: "relative", zIndex: 1 }}>

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {res.logoUrl && <img src={res.logoUrl} alt={r.symbol} width={18} height={18} style={{ borderRadius: "50%" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                          <span style={{ fontSize: 18, fontWeight: 800, color: theme.text }}>{r.symbol}</span>
                          <span style={{ fontSize: 10, color: theme.muted, padding: "1px 6px", background: theme.panelAlt, borderRadius: 4, border: `1px solid ${theme.border}` }}>
                            {r.chain?.toUpperCase()}
                          </span>
                          {res.isTrendingOnCoinGecko && <span className="neon-badge neon-badge-orange" style={{ fontSize: 9 }}>CoinGecko🔥</span>}
                          {res.isBoostedOnDexScreener && <span className="neon-badge neon-badge-blue" style={{ fontSize: 9 }}>DexScreener⚡</span>}
                        </div>
                        <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{r.name}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: c, border: `1px solid ${c}40`, background: `${c}12`, boxShadow: `0 0 12px ${c}15` }}>
                          {r.action}
                        </div>
                        {res.risePct !== undefined && (
                          <div style={{ fontSize: 13, fontWeight: 800, color: theme.enter, marginTop: 4, fontFamily: "var(--font-geist-mono), monospace" }}>
                            +{res.risePct}% est.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Score meter */}
                    <div style={{ marginTop: 12 }}>
                      <ScoreMeter score={r.score} action={r.action} />
                    </div>

                    {/* Stats row */}
                    <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: theme.muted, flexWrap: "wrap" }}>
                      <span>💧 ${(r.liquidityUsd / 1000).toFixed(0)}K liq</span>
                      <span>📊 ${(r.volume24h / 1000).toFixed(0)}K vol</span>
                      <span style={{ color: r.priceChange1h >= 0 ? theme.enter : theme.danger, fontFamily: "var(--font-geist-mono), monospace" }}>
                        1h {r.priceChange1h >= 0 ? "+" : ""}{r.priceChange1h.toFixed(1)}%
                      </span>
                      {(r as any).priceChange24h !== undefined && (
                        <span style={{ color: (r as any).priceChange24h >= 0 ? theme.enter : theme.danger, fontFamily: "var(--font-geist-mono), monospace" }}>
                          24h {(r as any).priceChange24h >= 0 ? "+" : ""}{(r as any).priceChange24h.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {/* AI Reasoning */}
                    <div style={{ marginTop: 12, padding: "10px 12px", background: `${c}07`, borderRadius: 10, border: `1px solid ${c}18` }}>
                      <div style={{ fontSize: 10, color: c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>🧠 AI Analysis</div>
                      <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.65, whiteSpace: "pre-line" }}>
                        {r.thought || r.reasoning}
                      </div>
                    </div>

                    {/* Source tags + Trade buttons */}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.border}40`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {(res.sources ?? []).map((src: string) => (
                          <span key={src} style={{ fontSize: 9, color: theme.muted, padding: "1px 6px", background: theme.panelAlt, borderRadius: 4, border: `1px solid ${theme.border}` }}>
                            {src.replace("gecko_", "")}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {res.dexscreenerUrl && (
                          <a href={res.dexscreenerUrl} target="_blank" rel="noreferrer"
                            style={{ padding: "4px 10px", borderRadius: 6, background: theme.panelAlt, border: `1px solid ${theme.border}`, color: theme.textSecondary, textDecoration: "none", fontSize: 11, fontWeight: 600 }}>
                            📈 Chart
                          </a>
                        )}
                        {res.tradeUrl && (
                          <a href={res.tradeUrl} target="_blank" rel="noreferrer"
                            style={{ padding: "4px 12px", borderRadius: 6, background: r.action === "ENTER" ? `linear-gradient(135deg, ${c}, ${c}CC)` : theme.panelAlt, border: `1px solid ${r.action === "ENTER" ? c + "40" : theme.border}`, color: r.action === "ENTER" ? "#06070D" : theme.textSecondary, textDecoration: "none", fontSize: 11, fontWeight: 700 }}>
                            ↗ Trade
                          </a>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
