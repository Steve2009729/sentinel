"use client";

import { useEffect, useState, useRef } from "react";
import { AgentResult } from "@/lib/types";
import { theme, actionColor } from "@/lib/theme";

interface AgentReasoningProps {
  results: AgentResult[];
  steps: string[];
  running: boolean;
}

export default function AgentReasoning({ results, steps, running }: AgentReasoningProps) {
  const [displayedSteps, setDisplayedSteps] = useState<string[]>([]);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  // Animate terminal step logging when cycle runs
  useEffect(() => {
    if (running) {
      setDisplayedSteps(["[SYSTEM] Connecting to Sentinel agent cluster...", "[SYSTEM] Waiting for cycle launch command..."]);
    }
  }, [running]);

  useEffect(() => {
    if (steps.length > 0) {
      // Stream steps out with small delays to look authentic and readable
      let i = 0;
      setDisplayedSteps([]);
      const interval = setInterval(() => {
        if (i < steps.length) {
          setDisplayedSteps((prev) => [...prev, steps[i]]);
          i++;
          // Scroll terminal down
          stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        } else {
          clearInterval(interval);
        }
      }, 350);
      return () => clearInterval(interval);
    }
  }, [steps]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
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
          🧠 Autonomous Agent Terminal
        </h2>
        {running && <div className="live-dot" />}
      </div>

      <div
        className="terminal-chrome"
        style={{
          background: "#07080F",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Scan line */}
        <div className="scan-line-overlay" />

        {/* Terminal title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: `1px solid ${theme.border}`,
            background: "rgba(13, 15, 26, 0.5)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div className="terminal-dots">
            <span />
            <span />
            <span />
          </div>
          <span style={{ fontSize: 11, color: theme.muted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
            sentinel-agent@hashkey
          </span>
          <div style={{ width: 52 }} />
        </div>

        {/* Terminal body */}
        <div
          style={{
            padding: 18,
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 12.5,
            lineHeight: 1.7,
            minHeight: 200,
            maxHeight: 450,
            overflowY: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Prompt */}
          <div style={{ color: theme.muted, marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: theme.accent }}>sentinel</span>
            <span style={{ color: theme.muted }}>@</span>
            <span style={{ color: theme.tierBasic }}>hashkey</span>
            <span style={{ color: theme.muted }}> ~/agent $ </span>
            {running && <span className="animate-blink" style={{ color: theme.accent }}>● agent active</span>}
          </div>

          {/* Running Step Logs */}
          <div style={{ marginBottom: 14 }}>
            {displayedSteps.map((step, idx) => (
              <div key={idx} style={{ color: step.includes("✗") || step.includes("error") ? theme.danger : step.includes("✓") || step.includes("Successfully") ? theme.accent : theme.muted, fontSize: 12 }}>
                {step}
              </div>
            ))}
            <div ref={stepsEndRef} />
          </div>

          {/* Finished agent decisions */}
          {!running && results.length === 0 && displayedSteps.length === 0 && (
            <div style={{ color: theme.muted }}>
              <span>
                <span style={{ color: theme.muted }}>›</span> Run an Agent Cycle to view live autonomous execution logs, Google Gemini AI analysis, and on-chain logs.
              </span>
            </div>
          )}

          {results.length > 0 && !running && (
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 11, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, fontWeight: 700 }}>
                📡 Trading Decisions Logged:
              </div>
              {results.map((r, i) => (
                <div
                  key={`${r.symbol}-${i}`}
                  className="animate-fadeIn"
                  style={{
                    marginBottom: 16,
                    paddingBottom: 16,
                    borderBottom: i < results.length - 1 ? `1px solid ${theme.border}` : "none",
                  }}
                >
                  {/* Decision header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span
                      style={{
                        color: actionColor(r.action),
                        fontWeight: 700,
                        background: `${actionColor(r.action)}15`,
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        letterSpacing: 0.5,
                        boxShadow: `0 0 8px ${actionColor(r.action)}10`,
                      }}
                    >
                      [{r.action}]
                    </span>
                    <span style={{ color: theme.text, fontWeight: 700, fontSize: 13 }}>{r.symbol}</span>
                    <span style={{ color: theme.muted, fontSize: 11 }}>
                      score {r.score}/100
                    </span>
                  </div>

                  {/* Reasoning text */}
                  <div style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 1.6, paddingLeft: 4 }}>
                    <span style={{ color: theme.accent, marginRight: 6 }}>›</span>
                    {r.thought}
                  </div>

                  {/* Transaction hashes */}
                  {(r.payHash || r.decisionHash) && (
                    <div style={{ display: "flex", gap: 12, marginTop: 8, paddingLeft: 4, flexWrap: "wrap" }}>
                      {r.payHash && (
                        <span style={{ fontSize: 10, color: theme.muted }}>
                          pay_tx: <span style={{ color: theme.accent }}>{r.payHash.slice(0, 14)}…</span>
                        </span>
                      )}
                      {r.decisionHash && (
                        <span style={{ fontSize: 10, color: theme.muted }}>
                          log_tx: <span style={{ color: theme.tierBasic }}>{r.decisionHash.slice(0, 14)}…</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
