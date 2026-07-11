"use client";

import { useState } from "react";
import { theme, tierColor, tierLabel } from "@/lib/theme";
import { PAYMENT_TIERS, type TierLevel } from "@/lib/types";
import { payForTierUnlock, payForDeepAnalytics } from "@/lib/Web3PaymentService";
import { useStore } from "@/lib/store";

interface PaymentTierGateProps {
  tier: TierLevel;
  assetAddress?: string;
  children: React.ReactNode;
}

export default function PaymentTierGate({ tier, assetAddress, children }: PaymentTierGateProps) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const { isTierUnlocked, isAssetUnlocked, unlockTier, unlockAsset, addPayment, isDemoMode } = useStore();

  const color = tierColor(tier);

  // Already unlocked — just show the content
  const isUnlocked = tier === 3 && assetAddress
    ? isAssetUnlocked(assetAddress)
    : isTierUnlocked(tier);

  if (isUnlocked) {
    return <div className="content-unlocked">{children}</div>;
  }

  // ─── DEMO MODE — instant free unlock, no wallet needed ─────────────────────
  if (isDemoMode) {
    function handleDemoUnlock() {
      if (tier === 3 && assetAddress) {
        unlockAsset(assetAddress);
      } else {
        unlockTier(tier);
      }
      addPayment({
        hash: `0xdemo${Date.now().toString(16)}`,
        type: "tier_unlock",
        tier,
        amount: "0",
        symbol: assetAddress,
        timestamp: Date.now(),
      });
    }

    return (
      <div style={{ position: "relative" }}>
        <div className="content-locked">{children}</div>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(6,7,13,0.65)", backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)", borderRadius: 16, zIndex: 10, padding: 24,
        }}>
          <div style={{
            background: theme.panel, border: `1px solid ${color}30`, borderRadius: 16,
            padding: "28px 32px", textAlign: "center", maxWidth: 340,
            boxShadow: `0 0 30px ${color}10`,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🎮</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 12px",
              borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
              color: theme.accent, border: `1px solid ${theme.accent}30`,
              background: `${theme.accent}10`, marginBottom: 14,
            }}>
              Demo Mode · Free Access
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: theme.text, margin: "0 0 8px" }}>
              {tierLabel(tier)}
            </h3>
            <p style={{ fontSize: 12, color: theme.muted, margin: "0 0 20px", lineHeight: 1.5 }}>
              {PAYMENT_TIERS[tier].description}
            </p>
            <button
              onClick={handleDemoUnlock}
              style={{
                width: "100%",
                background: `linear-gradient(135deg, ${theme.accent}, #5B8DEF)`,
                color: "#06070D", padding: "12px 20px", borderRadius: 10,
                fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
                boxShadow: `0 2px 16px ${theme.accent}25`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span>🎮</span> Unlock Free — Demo Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIVE MODE — real HSK payment ───────────────────────────────────────────
  const tierConfig = PAYMENT_TIERS[tier];

  async function handleUnlock() {
    setPaying(true);
    setError("");
    try {
      let tx;
      if (tier === 3 && assetAddress) {
        tx = await payForDeepAnalytics(assetAddress);
        unlockAsset(assetAddress);
      } else {
        tx = await payForTierUnlock(tier);
        unlockTier(tier);
      }
      addPayment(tx);
    } catch (e: any) {
      console.error(`[PaymentTierGate] Tier ${tier} unlock failed:`, e);
      if (e.code === 4001 || e.code === "ACTION_REJECTED") {
        setError("Transaction cancelled");
      } else if (e.message?.includes("insufficient")) {
        setError("Insufficient HSK balance");
      } else if (e.message?.includes("session expired") || e.message?.includes("reconnect")) {
        setError("Wallet session expired — please disconnect and reconnect your wallet");
      } else {
        setError(e.message || "Payment failed");
      }
    } finally {
      setPaying(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <div className="content-locked">{children}</div>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "rgba(6,7,13,0.65)", backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)", borderRadius: 16, zIndex: 10, padding: 24,
      }}>
        <div style={{
          background: theme.panel, border: `1px solid ${color}30`, borderRadius: 16,
          padding: "28px 32px", textAlign: "center", maxWidth: 340,
          boxShadow: `0 0 30px ${color}10`,
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px",
            borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            textTransform: "uppercase" as const, color,
            border: `1px solid ${color}40`, background: `${color}10`, marginBottom: 16,
          }}>
            {tier === 1 ? "🔓" : tier === 2 ? "⭐" : "🔬"} Tier {tier}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: theme.text, margin: "0 0 8px" }}>
            {tierLabel(tier)}
          </h3>
          <p style={{ fontSize: 13, color: theme.muted, margin: "0 0 20px", lineHeight: 1.5 }}>
            {tierConfig.description}
          </p>
          <button
            onClick={handleUnlock}
            disabled={paying}
            style={{
              width: "100%",
              background: paying ? theme.panel : `linear-gradient(135deg, ${color}, ${color}CC)`,
              color: paying ? theme.muted : "#06070D",
              padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14,
              border: paying ? `1px solid ${theme.border}` : "none",
              cursor: paying ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: paying ? "none" : `0 2px 16px ${color}30`,
            }}
          >
            {paying ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span className="animate-blink">●</span> Processing…
              </span>
            ) : (
              `Unlock for ${tierConfig.costHsk} HSK`
            )}
          </button>
          {error && (
            <div style={{
              marginTop: 12, color: theme.danger, fontSize: 12,
              padding: "8px 12px", background: `${theme.danger}10`,
              borderRadius: 8, border: `1px solid ${theme.danger}20`,
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
