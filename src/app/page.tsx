"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import WalletConnect from "@/components/WalletConnect";
import LiveToasts from "@/components/LiveToasts";

function ParticleField() {
  const items = useRef(Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 17 + 5) % 100}%`,
    delay: `${(i * 0.41) % 8}s`,
    dur: `${6 + (i * 0.37) % 6}s`,
    w: `${2 + (i * 0.19) % 3}px`,
    color: i % 3 === 0 ? "rgba(0,229,160,0.4)" : i % 3 === 1 ? "rgba(91,141,239,0.3)" : "rgba(168,85,247,0.3)",
  })));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {items.current.map((p, i) => (
        <div key={i} className="particle" style={{ left: p.left, bottom: 0, animationDelay: p.delay, animationDuration: p.dur, width: p.w, height: p.w, background: p.color }} />
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { enterDemoMode } = useStore();
  const [mounted, setMounted] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [email, setEmail] = useState(""); const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle"|"sending"|"success"|"error">("idle"); const [feedbackMsg, setFeedbackMsg] = useState("");
  const [showDemoTerms, setShowDemoTerms] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleConnected = useCallback(() => { router.push("/dashboard"); }, [router]);

  function handleDemoAccept() {
    setShowDemoTerms(false);
    enterDemoMode();
    router.push("/dashboard");
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !message) { setStatus("error"); setFeedbackMsg("Please fill out all required fields."); return; }
    setStatus("sending");
    await new Promise((r) => setTimeout(r, 900));
    if (typeof window !== "undefined") window.location.href = `mailto:stephenokunlola59@gmail.com?subject=${encodeURIComponent(subject||"Sentinel Inquiry")}&body=${encodeURIComponent(`From: ${email}\n\n${message}`)}`;
    setStatus("success"); setFeedbackMsg("Redirecting to your email client…"); setEmail(""); setSubject(""); setMessage("");
  }

  if (!mounted) return <div style={{ minHeight: "100vh", background: theme.bg }} />;

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, position: "relative", overflowX: "hidden" }}>
      {/* Grid BG */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(rgba(0,229,160,0.025) 1px, transparent 1px),linear-gradient(90deg, rgba(0,229,160,0.025) 1px, transparent 1px)`, backgroundSize: "40px 40px", animation: "grid-pan 12s linear infinite", zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: "5%", left: "50%", transform: "translateX(-50%)", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,229,160,0.05) 0%, transparent 60%)", zIndex: 0, pointerEvents: "none" }} />
      <ParticleField />

      {/* ─── NAV ─── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: navScrolled ? "rgba(6,7,13,0.92)" : "transparent", backdropFilter: navScrolled ? "blur(16px)" : "none", borderBottom: navScrolled ? `1px solid ${theme.border}` : "none", transition: "all 0.3s ease" }}>
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <span className="gradient-text-large" style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px" }}>Sentinel</span>
          </div>
          <div className="landing-nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
            {["#features","#how-it-works","#pricing","#faq"].map((href, i) => (
              <a key={href} href={href} style={{ color: theme.textSecondary, fontSize: 14, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.accent} onMouseLeave={(e) => e.currentTarget.style.color = theme.textSecondary}>
                {["Features","How It Works","Pricing","FAQ"][i]}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ position: "relative", zIndex: 10, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 20px 80px", textAlign: "center" }}>
        <LiveToasts />
        <div className="animate-fadeInUp" style={{ maxWidth: 700, position: "relative", zIndex: 10 }}>
          <div className="neon-badge neon-badge-green animate-float" style={{ marginBottom: 28, display: "inline-flex" }}>
            <div className="live-dot" style={{ width: 6, height: 6 }} />
            Live on HashKey Chain · Mainnet
          </div>
          <h1 style={{ fontSize: "clamp(52px, 9vw, 80px)", fontWeight: 900, lineHeight: 1.0, margin: "0 0 20px", letterSpacing: "-3px" }}>
            <span className="gradient-text-large" style={{ animation: "gradient-shift 6s ease infinite, neon-breathe 3s ease-in-out infinite" }}>Sentinel</span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: theme.textSecondary, margin: "0 0 12px", lineHeight: 1.7, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
            Autonomous AI token signal terminal for Base & Ethereum.
          </p>
          <p style={{ fontSize: 14, color: theme.muted, marginBottom: 36 }}>Real-time launches · Google Gemini AI · HSK-powered · On-chain settlements</p>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 36, flexWrap: "wrap" }}>
            {[{t:"Base & Ethereum",i:"⛓️"},{t:"Gemini 2.5 Flash",i:"🧠"},{t:"60s Live Feed",i:"📡"},{t:"Smart Money",i:"🐋"}].map((f,i) => (
              <span key={i} className="animate-fadeIn" style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: theme.muted, border: `1px solid ${theme.border}`, background: "rgba(13,15,26,0.6)", backdropFilter: "blur(8px)", animationDelay: `${0.2+i*0.1}s`, animationFillMode: "backwards", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span>{f.i}</span>{f.t}
              </span>
            ))}
          </div>

          <WalletConnect onConnected={handleConnected} />

          {/* Demo mode button */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => setShowDemoTerms(true)}
              style={{
                background: "transparent",
                border: `1px solid ${theme.border}`,
                color: theme.textSecondary,
                padding: "10px 28px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${theme.accent}50`; e.currentTarget.style.color = theme.text; e.currentTarget.style.background = `${theme.accent}08`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textSecondary; e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 16 }}>🎮</span>
              Try Live Demo — No Wallet Needed
            </button>
          </div>
          <p style={{ color: theme.muted, fontSize: 12, marginTop: 10 }}>Connect your wallet to access the full AI-powered trading terminal</p>

          <div style={{ marginTop: 44, display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
            {[{v:"60s",l:"Signal Refresh"},{v:"AI",l:"Gemini 2.5"},{v:"Multi",l:"Chain"},{v:"On-Chain",l:"Settlements"}].map((s,i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: theme.accent }}>{s.v}</div>
                <div style={{ fontSize: 11, color: theme.muted, marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" style={{ position: "relative", zIndex: 10, maxWidth: 1200, margin: "0 auto 100px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{ fontSize: "clamp(26px,4vw,36px)", fontWeight: 900, letterSpacing: "-1px", margin: "0 0 14px" }}>Why Choose <span className="gradient-text-large">Sentinel</span>?</h2>
          <p style={{ color: theme.textSecondary, fontSize: 15, maxWidth: 640, margin: "0 auto", lineHeight: 1.7 }}>The most advanced AI-powered token signal platform. Real-time data from multiple launchpads, Gemini AI analysis, and transparent on-chain settlements.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="features-grid">
          {[
            {i:"🚀",t:"Real-Time Token Discovery",d:"Instant alerts for new launches on Base and Ethereum from Clanker, Zyno, GeckoTerminal, and DexScreener — auto-refreshed every 60 seconds.",g:"linear-gradient(135deg,#00E5A0,#00C896)"},
            {i:"🤖",t:"Google Gemini AI Engine",d:"Advanced AI analysis with projected rise %, timeframe estimates, entry reasoning, and on-chain decision logging — all powered by Gemini 2.5 Flash.",g:"linear-gradient(135deg,#5B8DEF,#4A7FDB)"},
            {i:"📊",t:"Deep Market Analytics",d:"Line price charts, smart contract security audits via GoPlus, whale/KOL holder tracking, and full token metrics for any Base or Ethereum token.",g:"linear-gradient(135deg,#A855F7,#9333EA)"},
            {i:"⛓️",t:"Multi-Chain Coverage",d:"Full coverage of Base and Ethereum with live launchpad integrations. Clanker Farcaster tokens, Zyno launches, DexScreener boosted tokens all in one feed.",g:"linear-gradient(135deg,#F59E0B,#D97706)"},
            {i:"🔒",t:"Security First",d:"Automated honeypot detection, mintable/pausable checks, liquidity analysis, and GoPlus security integration. See exactly what you're trading before you buy.",g:"linear-gradient(135deg,#EF4444,#DC2626)"},
            {i:"↗",t:"One-Click Trading",d:"Every signal has a Trade button that opens Uniswap with the token pre-filled — Base or Ethereum, always pointing to the right chain and pool.",g:"linear-gradient(135deg,#8B5CF6,#7C3AED)"},
          ].map((f,i) => (
            <div key={i} className="holo-card animate-fadeIn" style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 26, position: "relative", overflow: "hidden", animationDelay: `${i*0.08}s`, animationFillMode: "backwards" }}>
              <div className="scan-line-overlay" />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: f.g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 18 }}>{f.i}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: theme.text, marginBottom: 10, lineHeight: 1.3 }}>{f.t}</h3>
                <p style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.65, margin: 0 }}>{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" style={{ position: "relative", zIndex: 10, background: "rgba(13,15,26,0.4)", borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, padding: "80px 20px", marginBottom: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(26px,4vw,34px)", fontWeight: 900, letterSpacing: "-1px", margin: "0 0 14px" }}>How <span className="gradient-text-large">Sentinel</span> Works</h2>
            <p style={{ color: theme.textSecondary, fontSize: 15, maxWidth: 560, margin: "0 auto" }}>Four simple steps from wallet connection to live AI signals</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 32 }}>
            {[
              {n:"01",i:"🔗",t:"Connect Wallet",d:"Link MetaMask, Trust Wallet, Coinbase, or Rabby via EIP-6963. Your session is authenticated with a one-time signature."},
              {n:"02",i:"⚡",t:"Switch to HashKey",d:"Sentinel auto-switches you to HashKey Chain (ID: 177) for low-cost, transparent on-chain payments and decision logs."},
              {n:"03",i:"🎯",t:"Choose Your Tier",d:"Free live launches, or unlock AI signals (0.1 HSK) and deep analytics (0.1 HSK/asset) to see the full intelligence layer."},
              {n:"04",i:"🚀",t:"Trade & Profit",d:"See live signals, read AI reasoning with rise % projections, and click Trade to swap instantly on Uniswap with one click."},
            ].map((s,i) => (
              <div key={i} className="animate-fadeIn" style={{ animationDelay: `${i*0.12}s`, animationFillMode: "backwards" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>{s.i}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: theme.accent, opacity: 0.25, marginBottom: 6 }}>{s.n}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginBottom: 10 }}>{s.t}</h3>
                <p style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.65 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" style={{ position: "relative", zIndex: 10, maxWidth: 900, margin: "0 auto 100px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(26px,4vw,34px)", fontWeight: 900, letterSpacing: "-1px", margin: "0 0 14px" }}>Simple, Transparent <span className="gradient-text-large">Pricing</span></h2>
          <p style={{ color: theme.textSecondary, fontSize: 15 }}>Pay only for what you need. All payments go on-chain.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
          {[
            {e:"🔓",n:"Basic Signals",c:"Free",t:"Tier 1",d:"Live token launches, real-time Base & Ethereum pool discoveries, 60s auto-refresh, chain and action filters",col:theme.tierBasic},
            {e:"⭐",n:"AI Signals",c:"0.1 HSK",t:"Tier 2",d:"Google Gemini AI analysis, projected rise %, timeframe predictions, entry reasoning, on-chain decision logs",col:theme.tierPremium,badge:"Popular"},
            {e:"🔬",n:"Deep Analytics",c:"0.1 HSK/asset",t:"Tier 3",d:"Line price charts, GoPlus security audit, whale/KOL holder tracking, liquidity metrics, contract address reveal",col:theme.tierDeep},
          ].map((p,i) => (
            <div key={i} className="holo-card" style={{ background: theme.panel, border: `1px solid ${p.badge ? p.col+"40" : theme.border}`, borderRadius: 20, padding: "26px 22px", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: p.badge ? `0 0 30px ${p.col}15` : "none" }}>
              <div className="scan-line-overlay" />
              {p.badge && <div style={{ position: "absolute", top: 14, right: 14, background: p.col, color: "#06070D", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 999, zIndex: 1 }}>{p.badge}</div>}
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 34, marginBottom: 14 }}>{p.e}</div>
                <div style={{ fontSize: 11, color: p.col, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{p.t}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: theme.text, marginBottom: 4 }}>{p.n}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.col, margin: "10px 0" }}>{p.c}</div>
                <p style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.6, margin: 0 }}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ABOUT ─── */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 1100, margin: "0 auto 100px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px,4vw,32px)", fontWeight: 900, letterSpacing: "-1px", margin: "0 0 10px" }}>What is <span className="gradient-text-large">Sentinel</span>?</h2>
          <p style={{ color: theme.textSecondary, fontSize: 15, maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>An autonomous AI token rating agent built on HashKey Chain.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
          {[
            {i:"🔄",t:"Autonomous Agent Cycles",d:"Sentinel runs self-contained analysis cycles every 60 seconds. It scans Base & Ethereum liquidity pools, parses volume changes, and logs trading recommendations directly to HashKey smart contracts."},
            {i:"🧠",t:"Google Gemini AI Integration",d:"Utilizes Google Gemini 2.5 Flash to synthesize raw market metrics. The agent models momentum trajectories and writes natural language reasoning with rise % projections for each candidate token."},
            {i:"🛡️",t:"On-Chain Micro-Settlements",d:"Employs native HSK token transfers on HashKey Chain. It registers autonomous trading decisions on-chain, proving execution transparency and creating an auditable ledger of all recommendations."},
          ].map((item,idx) => (
            <div key={idx} className="holo-card" style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
              <div className="scan-line-overlay" />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 34, marginBottom: 14 }}>{item.i}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: theme.text, marginBottom: 10 }}>{item.t}</h3>
                <p style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.6, margin: 0 }}>{item.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" style={{ position: "relative", zIndex: 10, maxWidth: 900, margin: "0 auto 100px", padding: "0 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
          <div>
            <h2 style={{ fontSize: "clamp(22px,3vw,28px)", fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 22 }}>Frequently Asked Questions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {q:"How does the AI signal analysis work?",a:"Sentinel scans liquidity pools from DexScreener, GeckoTerminal, Clanker, and Zyno. It calculates a weighted Rise Potential score (0–100) then streams the token metrics to Google Gemini AI to produce entry reasoning and projected rise % estimates. Everything is logged to HashKey Chain for transparency."},
                {q:"What is HSK and where do I get it?",a:"HSK is the native gas token of HashKey Chain (Chain ID: 177). You can get HSK from HashKey Exchange (hsk.com) or bridge from Ethereum. Sentinel requires only 0.1 HSK for AI signals and 0.1 HSK per asset for deep analytics."},
                {q:"Why are signals refreshed every 60 seconds?",a:"New tokens launch on Base and Ethereum constantly — some gain massive momentum within the first hour. A 60-second refresh ensures you see the freshest launches as they appear without overwhelming the API rate limits."},
                {q:"How do I trade a token I see in the feed?",a:"Every signal card has a 'Trade ↗' button that links directly to Uniswap with the token's contract address pre-filled for the correct chain (Base or Ethereum). Just connect your wallet on Uniswap and swap."},
                {q:"What does the security audit check?",a:"The Deep Analytics tier runs automated security checks via GoPlus Security: honeypot detection (can the token be sold?), mintable supply (can owner print more tokens?), pausable transfers, ownership renouncement status, and liquidity lock analysis."},
              ].map((faq,i) => (
                <div key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden", cursor: "pointer" }} onClick={() => setActiveFaq(activeFaq===i?null:i)}>
                  <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{faq.q}</span>
                    <span style={{ fontSize: 16, color: theme.accent, transform: activeFaq===i?"rotate(180deg)":"none", transition: "transform 0.3s", flexShrink: 0 }}>{activeFaq===i?"−":"+"}</span>
                  </div>
                  <div style={{ maxHeight: activeFaq===i?300:0, opacity: activeFaq===i?1:0, overflow: "hidden", transition: "all 0.3s ease-in-out" }}>
                    <div style={{ padding: "0 18px 14px", fontSize: 13, color: theme.textSecondary, lineHeight: 1.6, borderTop: `1px solid ${theme.border}30`, paddingTop: 12 }}>{faq.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONTACT ─── */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 600, margin: "0 auto 100px", padding: "0 20px" }}>
        <div className="holo-card" style={{ background: "rgba(13,15,26,0.85)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: 36, position: "relative", overflow: "hidden" }}>
          <div className="scan-line-overlay" />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ display: "inline-flex", padding: 12, background: "rgba(0,229,160,0.08)", borderRadius: 12, border: "1px solid rgba(0,229,160,0.2)", marginBottom: 12 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Contact & Support</h2>
              <p style={{ fontSize: 12, color: theme.muted, marginTop: 6 }}>Sent to <span style={{ color: theme.accent }}>stephenokunlola59@gmail.com</span></p>
            </div>
            <form onSubmit={handleContactSubmit} style={{ display: "grid", gap: 14 }}>
              {[
                {l:"Email *",t:"email",v:email,s:setEmail,p:"your@email.com",req:true},
                {l:"Subject",t:"text",v:subject,s:setSubject,p:"Question about Sentinel…",req:false},
              ].map(({l,t,v,s,p,req}) => (
                <div key={l}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: theme.muted, textTransform: "uppercase", marginBottom: 5 }}>{l}</label>
                  <input type={t} value={v} onChange={(e) => s(e.target.value)} placeholder={p} required={req}
                    style={{ width: "100%", background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 9, padding: "9px 13px", fontSize: 13, color: theme.text, outline: "none" }} />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: theme.muted, textTransform: "uppercase", marginBottom: 5 }}>Message *</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your question…" rows={4} required
                  style={{ width: "100%", background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 9, padding: "9px 13px", fontSize: 13, color: theme.text, outline: "none", resize: "none", fontFamily: "inherit" }} />
              </div>
              {status==="success" && <div style={{ color: theme.success, fontSize: 12, padding: "7px 11px", background: `${theme.success}10`, border: `1px solid ${theme.success}20`, borderRadius: 7 }}>{feedbackMsg}</div>}
              {status==="error" && <div style={{ color: theme.danger, fontSize: 12, padding: "7px 11px", background: `${theme.danger}10`, border: `1px solid ${theme.danger}20`, borderRadius: 7 }}>{feedbackMsg}</div>}
              <button type="submit" disabled={status==="sending"} style={{ width: "100%", background: `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`, color: "#06070D", border: "none", borderRadius: 9, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: status==="sending"?0.7:1 }}>
                {status==="sending"?"Sending…":"Send Message"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: `1px solid ${theme.border}`, padding: "32px 20px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Top row — branding + links */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <span className="gradient-text-large" style={{ fontWeight: 900, fontSize: 18 }}>Sentinel</span>
              <span style={{ fontSize: 11, color: theme.muted, marginLeft: 4 }}>AI Signal Terminal</span>
            </div>
            {/* Footer links */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <a href="#features" style={{ fontSize: 12, color: theme.muted, textDecoration: "none" }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.text} onMouseLeave={(e) => e.currentTarget.style.color = theme.muted}>Features</a>
              <a href="#pricing" style={{ fontSize: 12, color: theme.muted, textDecoration: "none" }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.text} onMouseLeave={(e) => e.currentTarget.style.color = theme.muted}>Pricing</a>
              <a href="#faq" style={{ fontSize: 12, color: theme.muted, textDecoration: "none" }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.text} onMouseLeave={(e) => e.currentTarget.style.color = theme.muted}>FAQ</a>
              <a href="https://hashkey.blockscout.com" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: theme.muted, textDecoration: "none" }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.text} onMouseLeave={(e) => e.currentTarget.style.color = theme.muted}>HashKey Explorer</a>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: theme.border, marginBottom: 20 }} />

          {/* Bottom row — copyright + GitHub + T&C */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 12, color: theme.muted }}>
              © {new Date().getFullYear()} Sentinel AI Terminal. All rights reserved. Built on HashKey Chain.
            </span>

            {/* GitHub + T&C grouped together so they don't look alone */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Terms & Conditions */}
              <button
                onClick={() => setShowDemoTerms(true)}
                style={{ background: "transparent", border: "none", color: theme.muted, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
                onMouseLeave={(e) => e.currentTarget.style.color = theme.muted}
              >
                Terms & Conditions
              </button>
              <span style={{ color: theme.border }}>·</span>
              {/* GitHub icon */}
              <a
                href="https://github.com/Steve2009729/sentinel"
                target="_blank"
                rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, color: theme.muted, textDecoration: "none", fontSize: 12, transition: "color 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
                onMouseLeave={(e) => e.currentTarget.style.color = theme.muted}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="GitHub">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── DEMO TERMS MODAL ─── */}
      {showDemoTerms && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20, animation: "fadeIn 0.2s ease-out" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDemoTerms(false); }}
        >
          <div className="animate-fadeInScale" style={{ background: "linear-gradient(180deg, #0D0F1A 0%, #080A14 100%)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: 32, maxWidth: 480, width: "100%", position: "relative", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,160,0.012) 2px, rgba(0,229,160,0.012) 4px)" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ display: "inline-flex", padding: 12, background: "rgba(0,229,160,0.08)", borderRadius: 14, border: "1px solid rgba(0,229,160,0.2)", marginBottom: 14, fontSize: 28 }}>🎮</div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: theme.text, margin: "0 0 8px" }}>Demo Mode</h2>
                <p style={{ fontSize: 13, color: theme.muted, margin: 0 }}>Free access to all Sentinel features — no wallet required</p>
              </div>

              {/* What you get */}
              <div style={{ background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>What you get in Demo Mode</div>
                {[
                  { i: "📡", t: "Live token launches feed — Base & Ethereum" },
                  { i: "🤖", t: "AI signal analysis with rise % projections" },
                  { i: "🔍", t: "Deep analytics — charts, security audits, holder data" },
                  { i: "💬", t: "AI Copilot — DeFi research assistant" },
                  { i: "↗", t: "Trade buttons linking to Uniswap/HSKSwap" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>{item.i}</span>
                    <span>{item.t}</span>
                  </div>
                ))}
              </div>

              {/* T&C text */}
              <div style={{ fontSize: 11, color: theme.muted, lineHeight: 1.6, marginBottom: 24, padding: "12px 14px", background: `${theme.warning}06`, border: `1px solid ${theme.warning}20`, borderRadius: 10 }}>
                <strong style={{ color: theme.warning }}>Terms & Conditions:</strong> Demo mode is for evaluation purposes only.
                No real wallet is connected and no on-chain transactions will be executed.
                Signals and analytics shown are live market data for informational purposes only.
                This is not financial advice. Always do your own research before trading.
                Demo sessions are not saved — tier unlocks will reset when you close the browser.
                By continuing, you confirm you are at least 18 years old and understand the risks of crypto trading.
              </div>

              {/* Buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={() => setShowDemoTerms(false)}
                  style={{ padding: "11px 20px", borderRadius: 10, background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${theme.accent}30`; e.currentTarget.style.color = theme.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.muted; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDemoAccept}
                  style={{ padding: "11px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`, border: "none", color: "#06070D", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 4px 20px ${theme.accent}30` }}
                >
                  <span>🎮</span> I Agree — Enter Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
