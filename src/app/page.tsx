"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/theme";
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
  const [mounted, setMounted] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [email, setEmail] = useState(""); const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle"|"sending"|"success"|"error">("idle"); const [feedbackMsg, setFeedbackMsg] = useState("");
  const [suggestion, setSuggestion] = useState(""); const [suggestionStatus, setSuggestionStatus] = useState<"idle"|"success">("idle");

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleConnected = useCallback(() => { router.push("/dashboard"); }, [router]);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !message) { setStatus("error"); setFeedbackMsg("Please fill out all required fields."); return; }
    setStatus("sending");
    await new Promise((r) => setTimeout(r, 900));
    if (typeof window !== "undefined") window.location.href = `mailto:stephenokunlola59@gmail.com?subject=${encodeURIComponent(subject||"Sentinel Inquiry")}&body=${encodeURIComponent(`From: ${email}\n\n${message}`)}`;
    setStatus("success"); setFeedbackMsg("Redirecting to your email client…"); setEmail(""); setSubject(""); setMessage("");
  }
  async function handleSuggestionSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!suggestion.trim()) return;
    setSuggestionStatus("success"); setTimeout(() => { setSuggestion(""); setSuggestionStatus("idle"); }, 3000);
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
          <p style={{ color: theme.muted, fontSize: 12, marginTop: 14 }}>Connect your wallet to access the full AI-powered trading terminal</p>

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
              {n:"03",i:"🎯",t:"Choose Your Tier",d:"Free live launches, or unlock AI signals (2 HSK) and deep analytics (1 HSK/asset) to see the full intelligence layer."},
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
            {e:"⭐",n:"AI Signals",c:"2 HSK",t:"Tier 2",d:"Google Gemini AI analysis, projected rise %, timeframe predictions, entry reasoning, on-chain decision logs",col:theme.tierPremium,badge:"Popular"},
            {e:"🔬",n:"Deep Analytics",c:"1 HSK/asset",t:"Tier 3",d:"Line price charts, GoPlus security audit, whale/KOL holder tracking, liquidity metrics, contract address reveal",col:theme.tierDeep},
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
                {q:"What is HSK and where do I get it?",a:"HSK is the native gas token of HashKey Chain (Chain ID: 177). You can get HSK from HashKey Exchange (hsk.com) or bridge from Ethereum. Sentinel requires 2 HSK for AI signals and 1 HSK per asset for deep analytics."},
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
      <footer style={{ borderTop: `1px solid ${theme.border}`, padding: "28px 20px", textAlign: "center", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="gradient-text-large" style={{ fontWeight: 900, fontSize: 16 }}>Sentinel</span>
          <span style={{ color: theme.border }}>·</span>
          <span style={{ fontSize: 12, color: theme.muted }}>© {new Date().getFullYear()} Sentinel AI Terminal. All rights reserved.</span>
          <span style={{ color: theme.border }}>·</span>
          <a href="https://hashkey.blockscout.com" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: theme.muted, textDecoration: "none" }}>HashKey Explorer</a>
        </div>
      </footer>
    </div>
  );
}
