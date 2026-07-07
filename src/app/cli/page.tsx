"use client";

import { useState } from "react";
import { theme } from "@/lib/theme";
import CLITerminal from "@/components/CLITerminal";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "";

const CODE_SNIPPETS = {
  curl: {
    label: "cURL",
    signals: `curl -s ${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/signals | jq '.signals[:5]'`,
    run: `curl -s -X POST ${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/run-agent | jq '.results'`,
    analyze: `curl -s "${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/token/0x6982508145454Ce325dDbE47a25d4ec3d2311933?chain=ethereum" | jq '.data'`,
    stats: `curl -s ${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/stats | jq '.data'`,
  },
  javascript: {
    label: "JavaScript",
    signals: `const res = await fetch("${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/signals");
const { signals } = await res.json();
console.log(signals.map(s => \`\${s.symbol}: \${s.score}/100 [\${s.action}]\`));`,
    run: `const res = await fetch("${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/run-agent", {
  method: "POST"
});
const { results } = await res.json();
results.forEach(r => console.log(\`[\${r.action}] \${r.symbol} — \${r.thought}\`));`,
    analyze: `const address = "0x6982508145454Ce325dDbE47a25d4ec3d2311933";
const res = await fetch(\`${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/token/\${address}?chain=ethereum\`);
const { data } = await res.json();
console.log(\`\${data.symbol}: Rise \${data.risePotential}% | Security \${data.securityScore}/100\`);`,
    stats: `const res = await fetch("${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/stats");
const { data } = await res.json();
console.log(\`Signals: \${data.totalSignalsPaid} | Decisions: \${data.totalDecisions}\`);`,
  },
  python: {
    label: "Python",
    signals: `import requests

res = requests.get("${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/signals")
signals = res.json()["signals"]
for s in signals[:5]:
    print(f'{s["symbol"]}: {s["score"]}/100 [{s["action"]}]')`,
    run: `import requests

res = requests.post("${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/run-agent")
results = res.json()["results"]
for r in results:
    print(f'[{r["action"]}] {r["symbol"]} — {r["thought"]}')`,
    analyze: `import requests

addr = "0x6982508145454Ce325dDbE47a25d4ec3d2311933"
res = requests.get(f"${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/token/{addr}?chain=ethereum")
data = res.json()["data"]
print(f'{data["symbol"]}: Rise {data["risePotential"]}% | Security {data["securityScore"]}/100')`,
    stats: `import requests

res = requests.get("${API_BASE || "https://sentinel-three-alpha.vercel.app"}/api/stats")
data = res.json()["data"]
print(f'Signals: {data["totalSignalsPaid"]} | Decisions: {data["totalDecisions"]}')`,
  },
};

type Lang = keyof typeof CODE_SNIPPETS;
type Endpoint = "signals" | "run" | "analyze" | "stats";

export default function CLIPage() {
  const [activeLang, setActiveLang] = useState<Lang>("javascript");
  const [activeEndpoint, setActiveEndpoint] = useState<Endpoint>("signals");
  const [copied, setCopied] = useState(false);

  function copyCode() {
    const code = CODE_SNIPPETS[activeLang][activeEndpoint];
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="scan-line-overlay" style={{ position: "fixed", zIndex: 0 }} />

      {/* ─── HEADER ─────────────────────────────────────────── */}
      <header
        className="glass-panel-premium"
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
          <a href="/" style={{ textDecoration: "none" }}>
            <div
              className="gradient-text-large"
              style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}
            >
              Sentinel
            </div>
          </a>
          <div className="neon-badge neon-badge-purple">
            <span style={{ fontSize: 12 }}>⌘</span> CLI Terminal
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            href="/dashboard"
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: 12, textDecoration: "none" }}
          >
            ← Dashboard
          </a>
        </div>
      </header>

      {/* ─── MAIN CONTENT ───────────────────────────────────── */}
      <main
        style={{
          padding: "18px 16px 32px",
          maxWidth: 1400,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Hero */}
        <div className="animate-fadeIn" style={{ textAlign: "center", marginBottom: 36 }}>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              margin: "0 0 12px",
              letterSpacing: "-1px",
            }}
          >
            <span className="gradient-text-large">Integrate Sentinel</span>
          </h1>
          <p
            style={{
              fontSize: 15,
              color: theme.textSecondary,
              maxWidth: 560,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Add real-time token signals, agent analysis, and deep analytics to your dApp.
            Use our REST API endpoints or try the interactive terminal below.
          </p>
        </div>

        {/* Layout: Terminal + API Docs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            alignItems: "start",
          }}
          className="dashboard-grid"
        >
          {/* Left: Interactive Terminal */}
          <div style={{ minHeight: 520 }}>
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
                Interactive Terminal
              </h2>
              <div className="live-dot" style={{ width: 6, height: 6 }} />
            </div>
            <div style={{ height: 500 }}>
              <CLITerminal />
            </div>
          </div>

          {/* Right: API Documentation + Code Snippets */}
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
                API Reference
              </h2>
            </div>

            {/* API Endpoints */}
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                {([
                  { method: "GET", path: "/api/signals", desc: "Fetch live token signals", key: "signals" as Endpoint },
                  { method: "POST", path: "/api/run-agent", desc: "Run agent analysis cycle", key: "run" as Endpoint },
                  { method: "GET", path: "/api/token/[CA]", desc: "Deep analytics for a token", key: "analyze" as Endpoint },
                  { method: "GET", path: "/api/stats", desc: "On-chain settlement stats", key: "stats" as Endpoint },
                ] as const).map((ep) => (
                  <button
                    key={ep.key}
                    onClick={() => setActiveEndpoint(ep.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      background: activeEndpoint === ep.key ? `${theme.accent}08` : theme.panelAlt,
                      border: `1px solid ${activeEndpoint === ep.key ? theme.accent + "30" : theme.border}`,
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 4,
                        background:
                          ep.method === "GET" ? `${theme.accent}15` : `${theme.tierPremium}15`,
                        color: ep.method === "GET" ? theme.accent : theme.tierPremium,
                        fontFamily: "var(--font-geist-mono), monospace",
                        letterSpacing: 0.5,
                      }}
                    >
                      {ep.method}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: theme.text,
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      {ep.path}
                    </span>
                    <span style={{ fontSize: 11, color: theme.muted, marginLeft: "auto" }}>
                      {ep.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language tabs + Code */}
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {/* Language tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: `1px solid ${theme.border}`,
                  padding: "4px 4px 0",
                }}
              >
                {(Object.keys(CODE_SNIPPETS) as Lang[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    style={{
                      padding: "8px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      background: activeLang === lang ? theme.panelAlt : "transparent",
                      color: activeLang === lang ? theme.text : theme.muted,
                      borderBottom:
                        activeLang === lang ? `2px solid ${theme.accent}` : "2px solid transparent",
                      borderRadius: "8px 8px 0 0",
                    }}
                  >
                    {CODE_SNIPPETS[lang].label}
                  </button>
                ))}

                {/* Copy button */}
                <button
                  onClick={copyCode}
                  style={{
                    marginLeft: "auto",
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: copied ? `${theme.accent}15` : "transparent",
                    color: copied ? theme.accent : theme.muted,
                    transition: "all 0.2s",
                    marginRight: 4,
                    marginBottom: 4,
                  }}
                >
                  {copied ? "✓ Copied" : "📋 Copy"}
                </button>
              </div>

              {/* Code block */}
              <div
                style={{
                  padding: 18,
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: theme.textSecondary,
                  whiteSpace: "pre-wrap",
                  overflowX: "auto",
                  minHeight: 120,
                }}
              >
                {CODE_SNIPPETS[activeLang][activeEndpoint]}
              </div>
            </div>

            {/* Integration Guide */}
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
                padding: 18,
                marginTop: 18,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: theme.muted,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                🚀 Quick Integration
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {[
                  {
                    step: "1",
                    title: "Fetch Signals",
                    desc: "GET /api/signals returns scored tokens with action recommendations (ENTER/WATCH/SKIP).",
                  },
                  {
                    step: "2",
                    title: "Filter & Display",
                    desc: "Filter by score threshold (e.g. score >= 70 for ENTER signals) and render in your UI.",
                  },
                  {
                    step: "3",
                    title: "Deep Dive",
                    desc: "Use /api/token/[CA] for detailed analysis including security flags and smart money tracking.",
                  },
                  {
                    step: "4",
                    title: "Automate",
                    desc: "Call /api/run-agent via POST to trigger agent reasoning cycles for automated analysis.",
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        background: `${theme.accent}15`,
                        color: theme.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {s.step}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.5, marginTop: 2 }}>
                        {s.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
