"use client";

/**
 * VerificationBadge.tsx — Part 1 of Phase 10
 *
 * Adds a "Testnet Verification" card to the dashboard.
 * Uses the real HashKey Chain Testnet (chain ID 133):
 *   - RPC:      https://testnet.hsk.xyz
 *   - Explorer: https://testnet-explorer.hsk.xyz
 *   - Docs:     https://hashkeycloud.gitbook.io/hashkey-chain-docs/how-to-build/network-infos
 *
 * Because no programmatic KYC callback API is publicly available on the
 * testnet, this implements the honest fallback per the blueprint:
 *   - Links directly to the real HashKey testnet network info / faucet docs
 *   - Self-attested "I've completed testnet verification" toggle
 *   - Clearly labeled "Testnet Verification" (not "KYC Verified")
 *   - Reward: cosmetic ✓ VERIFIED badge stored per wallet address
 *
 * Verification state is stored in localStorage keyed by wallet address.
 * No contract changes, no fake on-chain writes.
 */

import { useState, useEffect } from "react";
import { theme } from "@/lib/theme";

interface VerificationBadgeProps {
  walletAddress: string;
  compact?: boolean; // true = inline badge only (for payment history)
}

const STORAGE_KEY = "sentinel-verified-wallets";

function getVerifiedWallets(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveVerifiedWallet(address: string) {
  try {
    const set = getVerifiedWallets();
    set.add(address.toLowerCase());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function isWalletVerified(address: string): boolean {
  if (!address) return false;
  return getVerifiedWallets().has(address.toLowerCase());
}

// ─── COMPACT BADGE (used in payment history rows) ────────────────────────────

export function VerifiedBadgeInline({ walletAddress }: { walletAddress: string }) {
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    setVerified(isWalletVerified(walletAddress));
  }, [walletAddress]);

  if (!verified) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700,
      color: "#00E5A0", border: "1px solid rgba(0,229,160,0.3)",
      background: "rgba(0,229,160,0.08)", letterSpacing: 0.3,
    }}>
      ✓ TESTNET VERIFIED
    </span>
  );
}

// ─── FULL VERIFICATION CARD (shown in dashboard sidebar) ─────────────────────

export default function VerificationBadge({ walletAddress }: VerificationBadgeProps) {
  const [verified, setVerified] = useState(false);
  const [selfAttested, setSelfAttested] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    setVerified(isWalletVerified(walletAddress));
  }, [walletAddress]);

  function handleSelfAttest() {
    if (!selfAttested) return;
    saveVerifiedWallet(walletAddress);
    setVerified(true);
    setShowConfirm(false);
  }

  if (!walletAddress) return null;

  return (
    <div
      className="holo-card"
      style={{
        background: theme.panel,
        border: `1px solid ${verified ? "rgba(0,229,160,0.25)" : theme.border}`,
        borderRadius: 16,
        padding: 16,
        position: "relative",
        overflow: "hidden",
        boxShadow: verified ? "0 0 20px rgba(0,229,160,0.06)" : "none",
      }}
    >
      <div className="scan-line-overlay" />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: verified ? "rgba(0,229,160,0.12)" : theme.panelAlt,
              border: `1px solid ${verified ? "rgba(0,229,160,0.3)" : theme.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>
              {verified ? "✓" : "🛂"}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>
                Testnet Verification
              </div>
              <div style={{ fontSize: 10, color: theme.muted }}>
                HashKey Chain Testnet · Chain ID 133
              </div>
            </div>
          </div>
          {verified && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: "#00E5A0",
              border: "1px solid rgba(0,229,160,0.3)", background: "rgba(0,229,160,0.08)",
              padding: "3px 9px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              ✓ Verified
            </span>
          )}
        </div>

        {verified ? (
          // ── Verified state ────────────────────────────────────────────────
          <div>
            <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.55, marginBottom: 10 }}>
              Your wallet is marked as testnet-verified. This badge appears in your
              payment history and qualifies you for priority signal access in future updates.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href="https://testnet-explorer.hsk.xyz"
                target="_blank" rel="noreferrer"
                style={{ flex: 1, padding: "7px 12px", borderRadius: 8, background: theme.panelAlt,
                  border: `1px solid ${theme.border}`, color: theme.muted, textDecoration: "none",
                  fontSize: 11, fontWeight: 600, textAlign: "center" }}
              >
                🔗 Testnet Explorer
              </a>
              <div style={{ flex: 2, padding: "7px 12px", borderRadius: 8, background: "rgba(0,229,160,0.06)",
                border: "1px solid rgba(0,229,160,0.2)", fontSize: 11, color: "#00E5A0",
                fontWeight: 700, textAlign: "center" }}>
                ✓ Testnet Verification Complete
              </div>
            </div>
          </div>
        ) : !showConfirm ? (
          // ── Unverified state ──────────────────────────────────────────────
          <div>
            <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.55, marginBottom: 12 }}>
              Complete HashKey's testnet verification to earn a{" "}
              <span style={{ color: "#00E5A0", fontWeight: 700 }}>✓ Verified</span> badge
              on your account and qualify for priority signal access in future updates.
            </div>
            <div style={{ padding: "10px 12px", background: theme.panelAlt, border: `1px solid ${theme.border}`,
              borderRadius: 10, marginBottom: 12, fontSize: 11, color: theme.muted, lineHeight: 1.5 }}>
              <strong style={{ color: theme.text }}>Note:</strong> This is a testnet verification
              for hackathon demonstration. No personal data is collected by Sentinel.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <a
                href="https://hashkeycloud.gitbook.io/hashkey-chain-docs/how-to-build/network-infos"
                target="_blank" rel="noreferrer"
                style={{ padding: "9px 14px", borderRadius: 10, background: theme.panelAlt,
                  border: `1px solid ${theme.border}`, color: theme.textSecondary,
                  textDecoration: "none", fontSize: 12, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <span>🔗</span> Testnet Info
              </a>
              <button
                onClick={() => setShowConfirm(true)}
                style={{ padding: "9px 14px", borderRadius: 10,
                  background: "linear-gradient(135deg, #00E5A0, #5B8DEF)",
                  border: "none", color: "#06070D", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <span>🛂</span> Verify Now
              </button>
            </div>
          </div>
        ) : (
          // ── Self-attestation form ─────────────────────────────────────────
          <div>
            <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.55, marginBottom: 14 }}>
              After completing verification on HashKey's testnet, confirm below to
              receive your badge. This is a self-attested testnet verification for
              hackathon purposes.
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={selfAttested}
                onChange={(e) => setSelfAttested(e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 1, accentColor: "#00E5A0", flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
                I confirm I have completed the HashKey testnet verification process
                and understand this is a self-attested testnet badge for demonstration purposes.
              </span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={() => { setShowConfirm(false); setSelfAttested(false); }}
                style={{ padding: "9px 14px", borderRadius: 10, background: "transparent",
                  border: `1px solid ${theme.border}`, color: theme.muted, fontSize: 12,
                  fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSelfAttest}
                disabled={!selfAttested}
                style={{ padding: "9px 14px", borderRadius: 10,
                  background: selfAttested ? "linear-gradient(135deg, #00E5A0, #5B8DEF)" : theme.panelAlt,
                  border: selfAttested ? "none" : `1px solid ${theme.border}`,
                  color: selfAttested ? "#06070D" : theme.muted,
                  fontSize: 12, fontWeight: 700, cursor: selfAttested ? "pointer" : "not-allowed" }}
              >
                ✓ Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
