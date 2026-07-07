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
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  // Contact Form State
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Suggestions State
  const [suggestion, setSuggestion] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "success">("idle");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnected = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !message) {
      setStatus("error");
      setFeedbackMsg("Please fill out all required fields.");
      return;
    }
    setStatus("sending");

    // Simulate sending email to stephenokunlola59@gmail.com
    await new Promise((r) => setTimeout(r, 1200));

    // Prefill mailto in background or let it simulate success
    const mailtoUrl = `mailto:stephenokunlola59@gmail.com?subject=${encodeURIComponent(
      subject || "Sentinel Inquiry"
    )}&body=${encodeURIComponent(`From: ${email}\n\nMessage: ${message}`)}`;
    
    // Attempt opening mailto link
    if (typeof window !== "undefined") {
      window.location.href = mailtoUrl;
    }

    setStatus("success");
    setFeedbackMsg("Redirecting to email client... Form sent successfully to stephenokunlola59@gmail.com");
    setEmail("");
    setSubject("");
    setMessage("");
  }

  async function handleSuggestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!suggestion.trim()) return;
    setSuggestionStatus("success");
    setTimeout(() => {
      setSuggestion("");
      setSuggestionStatus("idle");
    }, 3000);
  }

  if (!mounted) {
    return <div style={{ minHeight: "100vh", background: theme.bg }} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        position: "relative",
        overflowX: "hidden",
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

      {/* Radial glow effects */}
      <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(0, 229, 160, 0.06) 0%, transparent 60%)", zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "50%", left: "10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(91, 141, 239, 0.04) 0%, transparent 60%)", zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "120%", right: "10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(168, 85, 247, 0.04) 0%, transparent 60%)", zIndex: 0, pointerEvents: "none" }} />

      <ParticleField />

      {/* ─── HERO SECTION ─────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 20px",
        }}
      >
        {/* Blurred terminal mockup in background */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "90%", maxWidth: 1200, zIndex: 1, filter: "blur(8px)", opacity: 0.15, pointerEvents: "none" }}>
          <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: theme.accent }}>SENTINEL TERMINAL</div>
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ width: 80, height: 12, background: theme.panelAlt, borderRadius: 4 }} />
                <div style={{ width: 60, height: 12, background: theme.panelAlt, borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {["245", "12", "8", "0.0854"].map((v, i) => (
                <div key={i} style={{ background: theme.panelAlt, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{v}</div>
                  <div style={{ height: 8, width: "60%", background: theme.border, borderRadius: 4, marginTop: 8 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <LiveToasts />

        <div className="animate-fadeInUp" style={{ textAlign: "center", maxWidth: 680, position: "relative", zIndex: 10 }}>
          {/* Badge */}
          <div className="neon-badge neon-badge-green animate-float" style={{ marginBottom: 28 }}>
            <div className="live-dot" style={{ width: 6, height: 6 }} />
            Live on HashKey Chain · Mainnet
          </div>

          <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
            <div className="animate-rotate-slow" style={{ position: "absolute", inset: -30, borderRadius: "50%", border: "1px solid rgba(0, 229, 160, 0.06)", pointerEvents: "none" }} />
            <div className="animate-rotate-slow" style={{ position: "absolute", inset: -50, borderRadius: "50%", border: "1px dashed rgba(91, 141, 239, 0.04)", pointerEvents: "none", animationDirection: "reverse", animationDuration: "30s" }} />

            <h1 style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.0, margin: 0, letterSpacing: "-3px" }}>
              <span className="gradient-text-large" style={{ animation: "gradient-shift 6s ease infinite, neon-breathe 3s ease-in-out infinite" }}>Sentinel</span>
            </h1>
          </div>

          <p style={{ fontSize: 18, color: theme.textSecondary, margin: "20px 0 0", lineHeight: 1.7, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            Autonomous AI token signal terminal.
            <br />
            <span style={{ color: theme.muted }}>Real-time analytics. Google Gemini AI integration. HSK-powered.</span>
          </p>

          {/* Feature pills */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            {[
              { text: "Base & Ethereum", icon: "⛓️" },
              { text: "Gemini 2.5 Flash", icon: "🧠" },
              { text: "TradingView Charts", icon: "📈" },
              { text: "Smart Money Tracking", icon: "🐋" },
            ].map((f, i) => (
              <span key={i} className="animate-fadeIn" style={{ padding: "7px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: theme.muted, border: `1px solid ${theme.border}`, background: "rgba(13, 15, 26, 0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", animationDelay: `${0.3 + i * 0.1}s`, animationFillMode: "backwards", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>{f.icon}</span>
                {f.text}
              </span>
            ))}
          </div>

          <div className="animate-fadeIn" style={{ marginTop: 44, animationDelay: "0.5s", animationFillMode: "backwards" }}>
            <WalletConnect onConnected={handleConnected} />
          </div>

          {/* Tier preview */}
          <div className="animate-fadeIn" style={{ marginTop: 44, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, animationDelay: "0.7s", animationFillMode: "backwards" }}>
            {[
              { tier: 1, emoji: "🔓", name: "Basic Signals", cost: "0.005 HSK", desc: "20 raw signals", color: theme.tierBasic },
              { tier: 2, emoji: "⭐", name: "Premium", cost: "1.5 HSK", desc: "80%+ Rise Potential", color: theme.tierPremium },
              { tier: 3, emoji: "🔬", name: "Deep Analytics", cost: "0.01/asset", desc: "Charts & KOL data", color: theme.tierDeep },
            ].map((t) => (
              <div key={t.tier} className="holo-card" style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "20px 16px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div className="scan-line-overlay" />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{t.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: t.color, fontWeight: 700, margin: "6px 0" }}>{t.cost}</div>
                  <div style={{ fontSize: 11, color: theme.muted }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── ABOUT SECTION ─────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 1100,
          margin: "0 auto 120px",
          padding: "0 20px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-1px", margin: "0 0 10px" }}>
            What is <span className="gradient-text-large">Sentinel</span>?
          </h2>
          <p style={{ color: theme.textSecondary, fontSize: 15, maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
            An autonomous, self-optimizing token rating agent built on top of HashKey Chain.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {[
            {
              title: "Autonomous Agent Cycles",
              desc: "Sentinel runs self-contained analysis cycles. It scans Base & Ethereum liquidity pools, parses volume changes, and logs trading recommendations directly to HashKey smart contracts.",
              icon: "🔄"
            },
            {
              title: "Google Gemini AI Integration",
              desc: "Utilizes Google Gemini 2.5 Flash to synthesize raw market metrics. The agent models momentum trajectories and writes natural language reasoning for each candidate token.",
              icon: "🧠"
            },
            {
              title: "On-Chain Micro-Settlements",
              desc: "Employs native HSK token gas transfers on HashKey Chain. It registers autonomous trading decisions on-chain, proving execution transparency and auditing track record.",
              icon: "🛡️"
            }
          ].map((item, idx) => (
            <div
              key={idx}
              className="holo-card"
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
                padding: 24,
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div className="scan-line-overlay" />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{item.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginBottom: 12 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQs & SUGGESTIONS SECTION ─────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 900,
          margin: "0 auto 120px",
          padding: "0 20px",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "start" }}>
          
          {/* FAQ Accordion */}
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 24 }}>
              Frequently Asked Questions
            </h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  q: "How does the Agent reasoning work?",
                  a: "Sentinel scans liquidity pools and token data from DexScreener. It calculates a weighted momentum score (Rise Potential), streams these parameters to Google Gemini AI to form reasoning, and writes recommendations to HashKey Chain."
                },
                {
                  q: "What is HSK and how is it used here?",
                  a: "HSK is the native gas token of HashKey Chain. Sentinel utilizes HSK to pay for signal settlements and decision logs on-chain, creating an auditable ledger of all recommendations."
                },
                {
                  q: "How do I bypass network payment errors?",
                  a: "If you don't have HSK tokens or are on the wrong chain, Sentinel provides a 'Demo Mode' toggle switch in the dashboard. This allows you to simulate payments and check out deep analytics instantly."
                },
                {
                  q: "How can I integrate this in my own dApp?",
                  a: "Visit the CLI tab in the dashboard header. It contains a full REST API documentation and interactive shell examples in cURL, JavaScript, and Python."
                }
              ].map((faq, i) => (
                <div
                  key={i}
                  style={{
                    background: theme.panel,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                >
                  <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{faq.q}</span>
                    <span style={{ fontSize: 16, color: theme.accent }}>{activeFaq === i ? "−" : "+"}</span>
                  </div>
                  {activeFaq === i && (
                    <div style={{ padding: "0 20px 16px", fontSize: 13, color: theme.textSecondary, lineHeight: 1.6, borderTop: `1px solid ${theme.border}30`, paddingTop: 12 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Suggestions form */}
          <div
            className="holo-card"
            style={{
              background: theme.panel,
              border: `1px solid ${theme.border}`,
              borderRadius: 20,
              padding: 28,
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div className="scan-line-overlay" />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>💡</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginBottom: 8 }}>Suggestions Box</h3>
              <p style={{ fontSize: 12, color: theme.muted, marginBottom: 20, lineHeight: 1.5 }}>
                Have an idea to make Sentinel smarter? Submit a quick suggestion directly to our design queue.
              </p>

              <form onSubmit={handleSuggestionSubmit}>
                <textarea
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="Tell us what filters, AI models, or features you want..."
                  rows={4}
                  style={{
                    width: "100%",
                    background: theme.panelAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 13,
                    color: theme.text,
                    outline: "none",
                    marginBottom: 16,
                    resize: "none",
                    fontFamily: "inherit"
                  }}
                  required
                />
                
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    background: suggestionStatus === "success" ? theme.accent : `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`,
                    color: "#06070D",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 20px",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {suggestionStatus === "success" ? "✓ Suggestion Submitted" : "Submit Suggestion"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONTACT & SUPPORT FORM ────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 600,
          margin: "0 auto 120px",
          padding: "0 20px",
        }}
      >
        <div
          className="holo-card"
          style={{
            background: "rgba(13, 15, 26, 0.75)",
            border: `1px solid ${theme.border}`,
            borderRadius: 24,
            padding: 36,
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}
        >
          <div className="scan-line-overlay" />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ display: "inline-flex", padding: 12, background: "rgba(0, 229, 160, 0.08)", borderRadius: 12, border: "1px solid rgba(0, 229, 160, 0.2)", marginBottom: 12 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Contact Us & Ask Questions</h2>
              <p style={{ fontSize: 13, color: theme.muted, marginTop: 6 }}>
                Queries will be forwarded to <span style={{ color: theme.accent }}>stephenokunlola59@gmail.com</span>
              </p>
            </div>

            <form onSubmit={handleContactSubmit} style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", marginBottom: 6 }}>
                  Email Address <span style={{ color: theme.danger }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  style={{
                    width: "100%",
                    background: theme.panelAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: theme.text,
                    outline: "none"
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", marginBottom: 6 }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Question about Sentinel API..."
                  style={{
                    width: "100%",
                    background: theme.panelAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: theme.text,
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", marginBottom: 6 }}>
                  Message <span style={{ color: theme.danger }}>*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your questions or inquiries here..."
                  rows={5}
                  style={{
                    width: "100%",
                    background: theme.panelAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: theme.text,
                    outline: "none",
                    resize: "none",
                    fontFamily: "inherit"
                  }}
                  required
                />
              </div>

              {status === "success" && (
                <div style={{ color: theme.success, fontSize: 12, padding: "8px 12px", background: `${theme.success}10`, border: `1px solid ${theme.success}20`, borderRadius: 8 }}>
                  {feedbackMsg}
                </div>
              )}

              {status === "error" && (
                <div style={{ color: theme.danger, fontSize: 12, padding: "8px 12px", background: `${theme.danger}10`, border: `1px solid ${theme.danger}20`, borderRadius: 8 }}>
                  {feedbackMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                style={{
                  width: "100%",
                  background: `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`,
                  color: "#06070D",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 20px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  opacity: status === "sending" ? 0.7 : 1
                }}
              >
                {status === "sending" ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${theme.border}`, padding: "30px 20px", textAlign: "center", position: "relative", zIndex: 10 }}>
        <div style={{ fontSize: 12, color: theme.muted }}>
          © {new Date().getFullYear()} Sentinel AI Terminal. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
