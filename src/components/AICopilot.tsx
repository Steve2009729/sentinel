"use client";

import { useState, useRef, useEffect } from "react";
import { theme } from "@/lib/theme";

interface ChatMessage {
  sender: "user" | "copilot";
  text: string;
}

export default function AICopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: "copilot", text: "Hello! I am Sentinel AI Copilot, powered by Google Gemini. Ask me about any token signals, trading strategies, or how HashKey Chain works!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const newMsg: ChatMessage = { sender: "user", text };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, newMsg] })
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, { sender: "copilot", text: data.response }]);
      } else {
        setMessages((prev) => [...prev, { sender: "copilot", text: "Sorry, I encountered an error processing that query." }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { sender: "copilot", text: "Failed to connect to the Copilot service." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="holo-card"
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        height: 400,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="scan-line-overlay" />
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <h3 style={{ fontSize: 13, color: theme.text, textTransform: "uppercase", letterSpacing: 0.8, margin: 0, fontWeight: 700 }}>
          Sentinel AI Copilot
        </h3>
        <div className="live-dot" style={{ width: 6, height: 6, background: theme.accent }} />
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingRight: 4,
          marginBottom: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: m.sender === "user" ? `${theme.accent}15` : theme.panelAlt,
              border: `1px solid ${m.sender === "user" ? theme.accent + "30" : theme.border}`,
              padding: "8px 12px",
              borderRadius: m.sender === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              fontSize: 12,
              lineHeight: 1.5,
              color: m.sender === "user" ? theme.text : theme.textSecondary,
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div
            style={{
              alignSelf: "flex-start",
              background: theme.panelAlt,
              border: `1px solid ${theme.border}`,
              padding: "8px 12px",
              borderRadius: "12px 12px 12px 2px",
              fontSize: 12,
              color: theme.muted,
            }}
          >
            <span className="animate-blink">●</span> Copilot thinking...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, position: "relative", zIndex: 1 }}>
          {[
            "Explain HashKey Chain",
            "Suggest trade strategies",
            "Explain Payment Tiers"
          ].map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${theme.border}`,
                color: theme.textSecondary,
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.accent + "40";
                e.currentTarget.style.color = theme.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.border;
                e.currentTarget.style.color = theme.textSecondary;
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        style={{
          display: "flex",
          gap: 6,
          position: "relative",
          zIndex: 1,
          borderTop: `1px solid ${theme.border}`,
          paddingTop: 10,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI Copilot..."
          disabled={loading}
          style={{
            flex: 1,
            background: theme.panelAlt,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            background: `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`,
            color: "#06070D",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s",
            opacity: loading || !input.trim() ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
