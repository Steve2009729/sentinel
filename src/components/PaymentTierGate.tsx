"use client";

import { useState } from "react";
import { theme, tierColor, tierLabel } from "@/lib/theme";
import { PAYMENT_TIERS, type TierLevel } from "@/lib/types";
import { payForTierUnlock, payForDeepAnalytics } from "@/lib/Web3PaymentService";
import { useStore } from "@/lib/store";

interface PaymentTierGateProps {
  tier: TierLevel;
  assetAddress?: string; // For tier 3 per-asset unlocks
  children: React.ReactNode;
}

export default function PaymentTierGate({
  tier,
  assetAddress,
  children,
}: PaymentTierGateProps) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const { demoMode, isTierUnlocked, isAssetUnlocked, unlockTier, unlockAsset, addPayment, setDemoMode } =
    useStore();

  // Check if already unlocked
  const isUnlocked =
    tier === 3 && assetAddress
      ? isAssetUnlocked(assetAddress)
      : isTierUnlocked(tier);

  if (isUnlocked) {
    return <div className="content-unlocked">{children}</div>;
  }

  const tierConfig = PAYMENT_TIERS[tier];
  const color = tierColor(tier);

  async function handleUnlock() {
    setPaying(true);
    setError("");

    try {
      // In demo mode, simulate payment instantly
      if (demoMode) {
        await new Promise((r) => setTimeout(r, 800));

        const mockTx = {
          hash: `0xdemo${Date.now().toString(16).padStart(60, "0")}`,
          type: "tier_unlock" as const,
          tier,
          amount: tierConfig.costHsk.toString(),
          symbol: assetAddress ? "DEMO" : undefined,
          timestamp: Date.now(),
        };

        if (tier === 3 && assetAddress) {
          unlockAsset(assetAddress);
        } else {
          unlockTier(tier);
        }
        addPayment(mockTx);
        setPaying(false);
        return;
      }

      // Live payment mode
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
        setError("Transaction cancelled by user");
      } else if (e.message?.includes("insufficient")) {
        setError("Insufficient HSK balance");
      } else {
        setError(e.message || "Payment failed");
      }
    } finally {
      setPaying(false);
    }
  }

  // Force simulated unlock if users get errors or lack HSK
  async function forceDemoUnlock() {
    setError("");
    setPaying(true);
    try {
      setDemoMode(true);
      await new Promise((r) => setTimeout(r, 600));

      const mockTx = {
        hash: `0xdemo${Date.now().toString(16).padStart(60, "0")}`,
        type: "tier_unlock" as const,
        tier,
        amount: tierConfig.costHsk.toString(),
        symbol: assetAddress ? "DEMO" : undefined,
        timestamp: Date.now(),
      };

      if (tier === 3 && assetAddress) {
        unlockAsset(assetAddress);
      } else {
        unlockTier(tier);
      }
      addPayment(mockTx);
    } catch (err: any) {
      setError(err.message || "Bypass simulation failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Blurred content preview */}
      <div className="content-locked">{children}</div>

      {/* Unlock overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(6, 7, 13, 0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          borderRadius: 16,
          zIndex: 10,
          padding: 24,
        }}
      >
        <div
          style={{
            background: theme.panel,
            border: `1px solid ${color}30`,
            borderRadius: 16,
            padding: "28px 32px",
            textAlign: "center",
            maxWidth: 340,
            boxShadow: `0 0 30px ${color}10`,
          }}
        >
          {/* Tier badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 14px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              color,
              border: `1px solid ${color}40`,
              background: `${color}10`,
              marginBottom: 16,
            }}
          >
            {tier === 1 ? "🔓" : tier === 2 ? "⭐" : "🔬"} Tier {tier}
          </div>

          {/* Demo mode indicator */}
          {demoMode && (
            <div
              style={{
                fontSize: 10,
                color: theme.accent,
                background: `${theme.accent}10`,
                border: `1px solid ${theme.accent}20`,
                borderRadius: 6,
                padding: "3px 10px",
                marginBottom: 12,
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Demo Mode · No HSK Required
            </div>
          )}

          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: theme.text,
              margin: "0 0 8px",
            }}
          >
            {tierLabel(tier)}
          </h3>

          <p
            style={{
              fontSize: 13,
              color: theme.muted,
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            {tierConfig.description}
          </p>

          <button
            onClick={handleUnlock}
            disabled={paying}
            style={{
              width: "100%",
              background: paying
                ? theme.panel
                : `linear-gradient(135deg, ${color}, ${color}CC)`,
              color: paying ? theme.muted : "#06070D",
              padding: "12px 20px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              border: paying ? `1px solid ${theme.border}` : "none",
              cursor: paying ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: paying ? "none" : `0 2px 16px ${color}30`,
            }}
          >
            {paying ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span className="animate-blink">●</span> Processing...
              </span>
            ) : demoMode ? (
              `Unlock (Demo)`
            ) : (
              `Unlock for ${tierConfig.costHsk} HSK`
            )}
          </button>

          {error && (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <div
                style={{
                  color: theme.danger,
                  fontSize: 12,
                  padding: "8px 12px",
                  background: `${theme.danger}10`,
                  borderRadius: 8,
                  border: `1px solid ${theme.danger}20`,
                }}
              >
                {error}
              </div>
              <button
                onClick={forceDemoUnlock}
                style={{
                  background: `${theme.accent}12`,
                  color: theme.accent,
                  border: `1px solid ${theme.accent}30`,
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 700,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${theme.accent}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${theme.accent}12`;
                }}
              >
                Simulate with Demo Mode instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
