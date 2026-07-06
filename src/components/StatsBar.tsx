"use client";

import { theme, tierColor } from "@/lib/theme";
import { useStore } from "@/lib/store";

interface Props {
  signalsEvaluated: number;
  paymentsMade: number;
  decisionsLogged: number;
  hskSpent: number;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        flex: "1 1 160px",
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: accent || theme.text,
          lineHeight: 1.1,
          fontFamily: "var(--font-geist-mono), monospace",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: theme.muted,
          marginTop: 6,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TierBadge({ tier, unlocked }: { tier: number; unlocked: boolean }) {
  const color = tierColor(tier);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: unlocked ? color : theme.muted,
        border: `1px solid ${unlocked ? color + "40" : theme.border}`,
        background: unlocked ? color + "10" : "transparent",
        opacity: unlocked ? 1 : 0.5,
      }}
    >
      {unlocked ? "✓" : "🔒"} T{tier}
    </div>
  );
}

export default function StatsBar({ signalsEvaluated, paymentsMade, decisionsLogged, hskSpent }: Props) {
  const { unlockedTiers } = useStore();

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Stat label="Signals" value={String(signalsEvaluated)} accent={theme.accent} />
        <Stat label="Payments" value={String(paymentsMade)} />
        <Stat label="Decisions" value={String(decisionsLogged)} />
        <Stat label="HSK Spent" value={hskSpent.toFixed(4)} accent={theme.warning} />
      </div>

      {/* Tier status */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Access:
        </span>
        <TierBadge tier={1} unlocked={unlockedTiers.includes(1)} />
        <TierBadge tier={2} unlocked={unlockedTiers.includes(2)} />
        <TierBadge tier={3} unlocked={unlockedTiers.includes(3)} />
      </div>
    </div>
  );
}
