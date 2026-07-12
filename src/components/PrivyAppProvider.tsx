"use client";

/**
 * PrivyAppProvider.tsx — Phase 10, Part 2
 *
 * Wraps the app with PrivyProvider for email/social login.
 * Configured with HashKey Chain (177) as the primary chain.
 * Falls back to a plain Fragment when Privy is not installed or
 * NEXT_PUBLIC_PRIVY_APP_ID is not set — so existing functionality never breaks.
 */

import { ReactNode, useEffect, useState } from "react";
import { PRIVY_APP_ID, hashkeyChain, hashkeyTestnet } from "@/lib/privyConfig";

interface Props { children: ReactNode; }

export default function PrivyAppProvider({ children }: Props) {
  const [PrivyProvider, setPrivyProvider] = useState<React.ComponentType<any> | null>(null);
  const configured = PRIVY_APP_ID && !PRIVY_APP_ID.startsWith("clz00000");

  useEffect(() => {
    if (!configured) return;
    // @ts-ignore — package may not be installed; graceful fallback if missing
    import("@privy-io/react-auth").then((m: any) => {
      setPrivyProvider(() => m.PrivyProvider);
    }).catch(() => {});
  }, [configured]);

  // Privy not configured or not installed — just render children unchanged
  if (!configured || !PrivyProvider) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // HashKey Chain is the default chain
        defaultChain: hashkeyChain as any,
        supportedChains: [hashkeyChain, hashkeyTestnet] as any[],
        // Enable email + Google + external wallet login
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#00E5A0",
          logo: "/favicon.svg",
          landingHeader: "Sign in to Sentinel",
          loginMessage: "Access AI-powered token signals on HashKey Chain",
        },
        embeddedWallets: {
          // Create embedded wallet on login for email/social users
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
