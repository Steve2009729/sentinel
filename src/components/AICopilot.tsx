"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { theme } from "@/lib/theme";

interface ChatMessage {
  sender: "user" | "copilot";
  text: string;
  timestamp?: number;
}

const SUGGESTIONS = [
  "What chains does Sentinel support?",
  "How do I unlock AI signals?",
  "What is the rise potential score?",
  "Explain the payment tiers",
  "How does Clanker work?",
  "What is HashKey Chain?",
];

export default function AICopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "copilot",
      text: "👋 I'm Sentinel Copilot — your AI DeFi analyst powered by Google Gemini. Ask me anything about Sentinel, token signals, Base/Ethereum, HashKey Chain, DeFi strategies, or specific tokens.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { sender: "user", text: trimmed, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Handle both response shapes
      const reply = data.response || data.text || "I couldn't process that request. Please try again.";
      setMessages((prev) => [...prev, { sender: "copilot", text: reply, timestamp: Date.now() }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "copilot",
          text: "⚠️ Connection error. Please check your internet and try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <div
      className="holo-card"
      style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", height: 440, position: "relative", overflow: "hidden" }}
    >
      <div className="scan-line-overlay" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, position: "relative", zIndex: 1, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🧠</div>
        <div>
          <div style={{ fontSize: 12, color: theme.text, fontWeight: 700, letterSpacing: 0.3 }}>Sentinel AI Copilot</div>
          <div style={{ fontSize: 10, color: theme.muted }}>Powered by Google Gemini</div>
        </div>
        <div className="live-dot" style={{ width: 6, height: 6, marginLeft: "auto" }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2, marginBottom: 10, position: "relative", zIndex: 1 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              background: m.sender === "user" ? `linear-gradient(135deg, ${theme.accent}20, #5B8DEF18)` : theme.panelAlt,
              border: `1px solid ${m.sender === "user" ? theme.accent + "30" : theme.border}`,
              padding: "8px 12px",
              borderRadius: m.sender === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
              fontSize: 12,
              lineHeight: 1.55,
              color: m.sender === "user" ? theme.text : theme.textSecondary,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", background: theme.panelAlt, border: `1px solid ${theme.border}`, padding: "8px 14px", borderRadius: "14px 14px 14px 2px", fontSize: 12, color: theme.muted, display: "flex", alignItems: "center", gap: 6 }}>
            <span className="animate-blink">●</span>
            <span className="animate-blink" style={{ animationDelay: "0.3s" }}>●</span>
            <span className="animate-blink" style={{ animationDelay: "0.6s" }}>●</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10, position: "relative", zIndex: 1 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              style={{ background: "rgba(0,229,160,0.05)", border: `1px solid ${theme.border}`, color: theme.textSecondary, borderRadius: 8, padding: "3px 9px", fontSize: 10, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.accent + "40"; e.currentTarget.style.color = theme.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textSecondary; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: 6, position: "relative", zIndex: 1, borderTop: `1px solid ${theme.border}`, paddingTop: 10, flexShrink: 0 }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about tokens, DeFi, Sentinel…"
          disabled={loading}
          style={{ flex: 1, background: theme.panelAlt, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, padding: "8px 12px", fontSize: 12, outline: "none" }}
          onFocus={(e) => { e.target.style.borderColor = theme.accent + "50"; }}
          onBlur={(e) => { e.target.style.borderColor = theme.border; }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{ background: loading || !input.trim() ? theme.panelAlt : `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`, color: loading || !input.trim() ? theme.muted : "#06070D", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: loading || !input.trim() ? "not-allowed" : "pointer", transition: "all 0.2s", flexShrink: 0 }}
        >
          ↑
        </button>
      </form>
    </div>
  );
}
