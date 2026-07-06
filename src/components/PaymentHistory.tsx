"use client";

import { AgentResult } from "@/lib/types";
import { theme, actionColor } from "@/lib/theme";
import { txUrl } from "@/lib/contract";
import { useStore } from "@/lib/store";

function short(hash: string): string {
  return hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : "";
}

function HashLink({ label, hash }: { label: string; hash: string }) {
  if (!hash) {
    return (
      <span style={{ fontSize: 12, color: theme.skip }}>
        {label}: — (pending)
      </span>
    );
  }
  return (
    <a
      href={txUrl(hash)}
      target="_blank"
      rel="noreferrer"
      style={{
        fontSize: 12,
        color: theme.accent,
        textDecoration: "none",
        fontFamily: "var(--font-geist-mono), monospace",
        borderBottom: `1px solid ${theme.accent}20`,
        paddingBottom: 1,
      }}
    >
      {label}: {short(hash)} ↗
    </a>
  );
}

export default function PaymentHistory({ results }: { results: AgentResult[] }) {
  const { paymentHistory } = useStore();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h2
          style={{
            fontSize: 14,
            color: theme.muted,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            margin: 0,
            fontWeight: 700,
          }}
        >
          📋 Payment & Decision Log
        </h2>
      </div>

      {results.length === 0 && paymentHistory.length === 0 ? (
        <div
          style={{
            color: theme.muted,
            fontSize: 13,
            padding: 24,
            textAlign: "center",
            background: theme.panel,
            borderRadius: 14,
            border: `1px solid ${theme.border}`,
          }}
        >
          No on-chain activity yet.
          <br />
          <span style={{ fontSize: 11 }}>Run an agent cycle or unlock a tier to see transactions.</span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, maxHeight: 600, overflowY: "auto" }}>
          {/* Tier unlock payments from Zustand */}
          {paymentHistory.map((tx, i) => (
            <div
              key={`payment-${tx.hash}-${i}`}
              className="animate-fadeIn"
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
                padding: 14,
                animationDelay: `${i * 0.05}s`,
                animationFillMode: "backwards",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>
                    {tx.type === "tier_unlock" ? "🔓" : tx.type === "signal_payment" ? "⚡" : "📝"}
                  </span>
                  <span style={{ fontWeight: 700, color: theme.text, fontSize: 13 }}>
                    {tx.type === "tier_unlock"
                      ? `Tier ${tx.tier} Unlock`
                      : tx.type === "signal_payment"
                      ? `Signal: ${tx.symbol}`
                      : `Decision: ${tx.symbol}`}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: theme.accent, fontWeight: 700 }}>
                  {tx.amount} HSK
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <a
                  href={txUrl(tx.hash)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 11,
                    color: theme.muted,
                    textDecoration: "none",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {short(tx.hash)} ↗
                </a>
              </div>
            </div>
          ))}

          {/* Agent cycle results */}
          {results.map((r, i) => (
            <div
              key={`result-${r.symbol}-${i}`}
              className="animate-fadeIn"
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
                padding: 14,
                animationDelay: `${(i + paymentHistory.length) * 0.05}s`,
                animationFillMode: "backwards",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      color: actionColor(r.action),
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    ●
                  </span>
                  <span style={{ fontWeight: 700, color: theme.text, fontSize: 13 }}>
                    {r.symbol}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: theme.muted }}>
                  {r.score}/100 · {r.action}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                <HashLink label="Signal paid" hash={r.payHash} />
                <HashLink label="Decision logged" hash={r.decisionHash} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
