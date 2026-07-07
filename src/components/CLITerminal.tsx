"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { theme } from "@/lib/theme";

interface TerminalLine {
  type: "input" | "output" | "error" | "system" | "success";
  text: string;
  timestamp?: string;
}

const HELP_TEXT = `
  ┌─────────────────────────────────────────────────────────────┐
  │  SENTINEL CLI — Available Commands                         │
  ├─────────────────────────────────────────────────────────────┤
  │  signals          Fetch live token signals (Base+Ethereum)  │
  │  run              Run agent analysis cycle                  │
  │  analyze <CA>     Deep analytics for a contract address     │
  │  stats            On-chain settlement statistics            │
  │  help             Show this help menu                       │
  │  clear            Clear terminal                            │
  │  version          Show CLI version                          │
  └─────────────────────────────────────────────────────────────┘`;

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export default function CLITerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "system", text: "╔═══════════════════════════════════════════════════════╗" },
    { type: "system", text: "║  SENTINEL CLI v1.0.0 — Token Signal Terminal          ║" },
    { type: "system", text: "║  HashKey Chain · Base · Ethereum                      ║" },
    { type: "system", text: "╚═══════════════════════════════════════════════════════╝" },
    { type: "system", text: "" },
    { type: "output", text: "  Type 'help' for available commands." },
    { type: "system", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input when clicking terminal
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  function addLine(type: TerminalLine["type"], text: string) {
    setLines((prev) => [...prev, { type, text, timestamp: timestamp() }]);
  }

  function addLines(newLines: TerminalLine[]) {
    setLines((prev) => [...prev, ...newLines.map((l) => ({ ...l, timestamp: timestamp() }))]);
  }

  async function handleCommand(cmd: string) {
    const trimmed = cmd.trim().toLowerCase();
    const parts = trimmed.split(/\s+/);
    const command = parts[0];

    // Add to history
    setHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);

    // Echo input
    addLine("input", `sentinel@hashkey ~$ ${cmd}`);

    if (!command) return;

    setIsProcessing(true);

    try {
      switch (command) {
        case "help":
          addLine("output", HELP_TEXT);
          break;

        case "clear":
          setLines([]);
          break;

        case "version":
          addLines([
            { type: "output", text: "  Sentinel CLI v1.0.0" },
            { type: "output", text: "  Runtime: Next.js API · HashKey Chain (ID: 177)" },
            { type: "output", text: "  Data: DexScreener API · Multi-chain" },
          ]);
          break;

        case "signals":
          addLine("system", "  ⏳ Fetching live signals from Base + Ethereum...");
          await handleSignals();
          break;

        case "run":
          addLine("system", "  ⏳ Running agent analysis cycle...");
          await handleRunAgent();
          break;

        case "analyze":
          if (!parts[1]) {
            addLine("error", "  ✗ Usage: analyze <contract_address> [chain]");
            addLine("output", "  Example: analyze 0x6982508145454Ce325dDbE47a25d4ec3d2311933 ethereum");
          } else {
            const chain = parts[2] || "base";
            addLine("system", `  ⏳ Analyzing ${parts[1].slice(0, 10)}... on ${chain}...`);
            await handleAnalyze(parts[1], chain);
          }
          break;

        case "stats":
          addLine("system", "  ⏳ Fetching on-chain stats...");
          await handleStats();
          break;

        default:
          addLine("error", `  ✗ Unknown command: '${command}'. Type 'help' for available commands.`);
      }
    } catch (e: any) {
      addLine("error", `  ✗ Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
      addLine("system", "");
    }
  }

  async function handleSignals() {
    try {
      const res = await fetch("/api/signals");
      const data = await res.json();

      if (!data.success || !data.signals?.length) {
        addLine("error", "  ✗ No signals returned");
        return;
      }

      const signals = data.signals.slice(0, 10);
      const resultLines: TerminalLine[] = [
        { type: "success", text: `  ✓ ${signals.length} signals loaded (source: ${data.source || "live"})` },
        { type: "system", text: "" },
        { type: "output", text: "  ┌──────────┬───────┬────────┬─────────────┬──────────────┬─────────┐" },
        { type: "output", text: "  │ Symbol   │ Score │ Action │ Liquidity   │ 24h Volume   │ 1h Δ    │" },
        { type: "output", text: "  ├──────────┼───────┼────────┼─────────────┼──────────────┼─────────┤" },
      ];

      for (const s of signals) {
        const sym = s.symbol.padEnd(8).slice(0, 8);
        const score = String(s.score).padStart(3);
        const action = s.action.padEnd(6);
        const liq = formatMoney(s.liquidityUsd).padStart(9);
        const vol = formatMoney(s.volume24h).padStart(10);
        const change = `${s.priceChange1h >= 0 ? "+" : ""}${s.priceChange1h.toFixed(1)}%`.padStart(7);

        resultLines.push({
          type: s.action === "ENTER" ? "success" : s.action === "WATCH" ? "output" : "system",
          text: `  │ ${sym} │ ${score} │ ${action} │ ${liq}   │ ${vol}   │ ${change} │`,
        });
      }

      resultLines.push({ type: "output", text: "  └──────────┴───────┴────────┴─────────────┴──────────────┴─────────┘" });
      addLines(resultLines);
    } catch (e: any) {
      addLine("error", `  ✗ Failed to fetch signals: ${e.message}`);
    }
  }

  async function handleRunAgent() {
    try {
      const res = await fetch("/api/run-agent", { method: "POST" });
      const data = await res.json();

      if (!data.success || !data.results?.length) {
        addLine("error", `  ✗ Agent error: ${data.error || "No results"}`);
        return;
      }

      addLine("success", `  ✓ Agent cycle complete — ${data.results.length} tokens analyzed (mode: ${data.mode || "live"})`);
      addLine("system", "");

      for (const r of data.results) {
        const actionColor = r.action === "ENTER" ? "success" : r.action === "WATCH" ? "output" : "system";
        addLines([
          { type: actionColor as TerminalLine["type"], text: `  ─── ${r.symbol} (${r.chain}) ─── [${r.action}] score: ${r.score}/100` },
          { type: "output", text: `  ${r.thought}` },
          { type: "system", text: "" },
        ]);
      }
    } catch (e: any) {
      addLine("error", `  ✗ Agent cycle failed: ${e.message}`);
    }
  }

  async function handleAnalyze(address: string, chain: string) {
    try {
      const res = await fetch(`/api/token/${address}?chain=${chain}`);
      const data = await res.json();

      if (!data.success || !data.data) {
        addLine("error", `  ✗ ${data.error || "Token not found"}`);
        return;
      }

      const t = data.data;
      addLines([
        { type: "success", text: `  ✓ Token data loaded for ${t.symbol}` },
        { type: "system", text: "" },
        { type: "output", text: `  ┌─ ${t.symbol} (${t.name}) ─ ${t.chain.toUpperCase()} ────────────────────┐` },
        { type: "output", text: `  │  Price:           $${t.priceUsd < 0.01 ? t.priceUsd.toExponential(2) : t.priceUsd.toFixed(6)}` },
        { type: "output", text: `  │  Market Cap:      ${formatMoney(t.marketCap)}` },
        { type: "output", text: `  │  Liquidity:       ${formatMoney(t.liquidityUsd)}` },
        { type: "output", text: `  │  24h Volume:      ${formatMoney(t.volume24h)}` },
        { type: "output", text: `  │  Rise Potential:  ${t.risePotential}/100` },
        { type: "output", text: `  │  Security Score:  ${t.securityScore}/100` },
        { type: "output", text: `  │  Contract:        ${t.contractAddress}` },
        { type: "output", text: `  └─────────────────────────────────────────────────┘` },
        { type: "system", text: "" },
        { type: "output", text: "  Security Flags:" },
      ]);

      for (const flag of t.securityFlags) {
        const icon = flag.severity === "safe" ? "✓" : flag.severity === "warning" ? "⚠" : "✗";
        const type: TerminalLine["type"] = flag.severity === "safe" ? "success" : flag.severity === "warning" ? "output" : "error";
        addLine(type, `    ${icon} ${flag.label} — ${flag.detail}`);
      }

      if (t.topHolders?.length) {
        addLine("system", "");
        addLine("output", "  Top Holders:");
        for (const h of t.topHolders) {
          const label = h.isSmartMoney ? ` [${h.label || "Smart Money"}]` : "";
          const pnl = h.pnlPercent !== undefined ? ` (PnL: ${h.pnlPercent >= 0 ? "+" : ""}${h.pnlPercent}%)` : "";
          addLine("output", `    ${h.address} — ${h.percentage.toFixed(1)}%${label}${pnl}`);
        }
      }
    } catch (e: any) {
      addLine("error", `  ✗ Analysis failed: ${e.message}`);
    }
  }

  async function handleStats() {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();

      if (!data.success) {
        addLine("error", "  ✗ Failed to fetch stats");
        return;
      }

      const d = data.data;
      const feeHsk = (Number(d.signalFeeWei) / 1e18).toFixed(4);
      addLines([
        { type: "success", text: "  ✓ On-chain stats loaded" },
        { type: "system", text: "" },
        { type: "output", text: `  Signal Fee:        ${feeHsk} HSK` },
        { type: "output", text: `  Total Signals Paid: ${d.totalSignalsPaid}` },
        { type: "output", text: `  Total Decisions:   ${d.totalDecisions}` },
      ]);
    } catch (e: any) {
      addLine("error", `  ✗ Stats failed: ${e.message}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim() && !isProcessing) {
      handleCommand(input.trim());
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  }

  return (
    <div
      className="terminal-chrome"
      style={{
        background: "#07080F",
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
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
          flexShrink: 0,
        }}
      >
        <div className="terminal-dots">
          <span />
          <span />
          <span />
        </div>
        <span
          style={{
            fontSize: 11,
            color: theme.muted,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          sentinel-cli@hashkey
        </span>
        <div style={{ width: 52 }} />
      </div>

      {/* Terminal body */}
      <div
        ref={terminalRef}
        onClick={focusInput}
        style={{
          padding: 18,
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 12.5,
          lineHeight: 1.7,
          flex: 1,
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
          cursor: "text",
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              color:
                line.type === "input"
                  ? theme.text
                  : line.type === "error"
                  ? theme.danger
                  : line.type === "success"
                  ? theme.accent
                  : line.type === "system"
                  ? theme.muted
                  : theme.textSecondary,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              fontWeight: line.type === "input" ? 600 : 400,
            }}
          >
            {line.text}
          </div>
        ))}

        {/* Input line */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <span style={{ color: theme.accent, fontWeight: 600 }}>sentinel</span>
          <span style={{ color: theme.muted }}>@</span>
          <span style={{ color: theme.tierBasic }}>hashkey</span>
          <span style={{ color: theme.muted }}> ~$ </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            autoFocus
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: theme.text,
              fontSize: 12.5,
              fontFamily: "var(--font-geist-mono), monospace",
              padding: 0,
              caretColor: theme.accent,
            }}
            spellCheck={false}
            autoComplete="off"
          />
          {isProcessing && (
            <span className="animate-blink" style={{ color: theme.accent, marginLeft: 4 }}>
              ▌
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + Math.round(n).toLocaleString();
}
