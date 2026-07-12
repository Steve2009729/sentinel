"use client";

/**
 * EmailLoginButton.tsx — Phase 10, Part 2
 *
 * Email/Google sign-in button via Privy — additive only.
 * Sits ABOVE the existing WalletConnect. WalletConnect is NOT touched.
 *
 * When NEXT_PUBLIC_PRIVY_APP_ID is not set, renders null — landing page
 * is completely unaffected.
 *
 * When Privy IS configured, renders "Sign in with Email / Google" above
 * the existing wallet connect button with an "or use wallet" divider.
 */

import { useRouter } from "next/navigation";
import { theme } from "@/lib/theme";
import { PRIVY_APP_ID } from "@/lib/privyConfig";

// Safe hook that returns a no-op when Privy isn't installed
function usePrivySafe() {
  try {
    // Only attempted when package is installed — ts-ignore because the
    // package may not be present at build time on machines without npm install
    // @ts-ignore
    return require("@privy-io/react-auth").usePrivy(); // eslint-disable-line
  } catch {
    return { login: () => {}, authenticated: false, ready: false, user: null };
  }
}

// Inner component — only mounted when Privy is configured
function EmailLoginInner() {
  const router = useRouter();
  const privy = usePrivySafe() as {
    login: () => void;
    authenticated: boolean;
    ready: boolean;
    user: { email?: { address: string } | null; google?: { email: string } | null } | null;
  };

  const userEmail = privy.user?.email?.address || privy.user?.google?.email || "";

  // Auto-redirect if already logged in via Privy
  if (privy.authenticated && privy.ready) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
      <button
        onClick={privy.login}
        disabled={!privy.ready}
        style={{
          padding: "13px 32px", fontSize: 14, fontWeight: 800,
          background: privy.ready ? "linear-gradient(135deg, #5B8DEF, #A855F7)" : theme.panelAlt,
          color: privy.ready ? "#fff" : theme.muted,
          border: privy.ready ? "none" : `1px solid ${theme.border}`,
          borderRadius: 14,
          cursor: privy.ready ? "pointer" : "not-allowed",
          boxShadow: privy.ready ? "0 4px 20px rgba(91,141,239,0.3)" : "none",
          transition: "all 0.25s ease",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          width: "100%", maxWidth: 320,
        }}
        onMouseEnter={(e) => {
          if (privy.ready) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 8px 28px rgba(91,141,239,0.4)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = privy.ready ? "0 4px 20px rgba(91,141,239,0.3)" : "none";
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        {privy.authenticated ? `Continue as ${userEmail || "User"} →` : "Sign in with Email / Google"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 320 }}>
        <div style={{ flex: 1, height: 1, background: theme.border }} />
        <span style={{ fontSize: 11, color: theme.muted }}>or use wallet</span>
        <div style={{ flex: 1, height: 1, background: theme.border }} />
      </div>
    </div>
  );
}

// Outer component — renders null if Privy is not configured
export default function EmailLoginButton() {
  const configured = Boolean(PRIVY_APP_ID) && !PRIVY_APP_ID.startsWith("clz00000");
  if (!configured) return null;
  return <EmailLoginInner />;
}
