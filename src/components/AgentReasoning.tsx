"use client";

import { AgentResult } from "@/lib/types";
import { theme, actionColor } from "@/lib/theme";

export default function AgentReasoning({ results, running }: { results: AgentResult[]; running: boolean }) {
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
          🧠 Agent Reasoning
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
            minHeight: 140,
            maxHeight: 420,
            overflowY: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Terminal prompt */}
          <div style={{ color: theme.muted, marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: theme.accent }}>sentinel</span>
            <span style={{ color: theme.muted }}>@</span>
            <span style={{ color: theme.tierBasic }}>hashkey</span>
            <span style={{ color: theme.muted }}> ~/agent $</span>
            {running && (
              <span
                style={{
                  color: theme.accent,
                  marginLeft: 4,
                  animation: "typewriter-cursor 0.8s step-end infinite",
                  display: "inline-block",
                }}
              >
                ▌
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <div style={{ color: theme.muted }}>
              {running ? (
                <span>
                  <span style={{ color: theme.accent }}>›</span> Evaluating signals, scoring tokens, preparing decisions
                  <span className="animate-blink" style={{ marginLeft: 2 }}>...</span>
                </span>
              ) : (
                <span>
                  <span style={{ color: theme.muted }}>›</span> Run a cycle to see the agent reason about each signal.
                </span>
              )}
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.symbol}-${i}`}
                className="animate-fadeIn"
                style={{
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: i < results.length - 1 ? `1px solid ${theme.border}` : "none",
                  animationDelay: `${i * 0.15}s`,
                  animationFillMode: "backwards",
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
                  <span
                    style={{
                      color: theme.muted,
                      fontSize: 11,
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
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
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      marginTop: 8,
                      paddingLeft: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {r.payHash && (
                      <span style={{ fontSize: 10, color: theme.muted }}>
                        pay: <span style={{ color: theme.accent }}>{r.payHash.slice(0, 10)}…</span>
                      </span>
                    )}
                    {r.decisionHash && (
                      <span style={{ fontSize: 10, color: theme.muted }}>
                        log: <span style={{ color: theme.tierBasic }}>{r.decisionHash.slice(0, 10)}…</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
