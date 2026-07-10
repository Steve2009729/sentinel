"use client";

import { useEffect, useState } from "react";
import { theme } from "@/lib/theme";

interface Toast {
  id: number;
  message: string;
  type: "gain" | "accumulate" | "signal";
  exiting: boolean;
}

const TOAST_MESSAGES = [
  { message: '0x4F…3aB2 just secured 50x on a Base token', type: 'gain' as const },
  { message: 'Smart Money wallet accumulated Clanker token', type: 'accumulate' as const },
  { message: '0xA7…9eC1 unlocked Tier 2 Premium Ratings', type: 'signal' as const },
  { message: 'New token deployed via Clanker — scoring 87/100', type: 'signal' as const },
  { message: '0x3E…d18F made 12x on early Base entry', type: 'gain' as const },
  { message: 'KOL wallet 0x7F…b42D buying heavily', type: 'accumulate' as const },
  { message: 'Rise Potential alert: 92% score detected', type: 'signal' as const },
  { message: '0xB2…7fA5 paid 0.005 HSK for signal batch', type: 'signal' as const },
  { message: 'Smart Money accumulated $240K in new pair', type: 'accumulate' as const },
  { message: '0x9D…c35A realized 85x on early accumulation', type: 'gain' as const },
  { message: 'Liquidity locked — security score increased to 94', type: 'signal' as const },
  { message: '0x1C…e4F8 unlocked Deep Analytics for $PEPE', type: 'signal' as const },
];

function getToastColor(type: string): string {
  if (type === "gain") return theme.enter;
  if (type === "accumulate") return theme.tierPremium;
  return theme.tierBasic;
}

function getToastIcon(type: string): string {
  if (type === "gain") return "📈";
  if (type === "accumulate") return "🐋";
  return "⚡";
}

export default function LiveToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    // Show toasts at random intervals
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * TOAST_MESSAGES.length);
      const newToast: Toast = {
        id: Date.now(),
        ...TOAST_MESSAGES[idx],
        exiting: false,
      };

      setToasts((prev) => [...prev.slice(-1), newToast]); // Keep max 2 toasts
      setCounter((c) => c + 1);

      // Auto-remove after 4s
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === newToast.id ? { ...t, exiting: true } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, 400);
      }, 4000);
    }, 2500 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 340,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={toast.exiting ? "animate-slideOutRight" : "animate-slideInRight"}
          style={{
            background: "rgba(13, 15, 26, 0.9)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: `1px solid ${getToastColor(toast.type)}30`,
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4), 0 0 10px ${getToastColor(toast.type)}15`,
          }}
        >
          <span style={{ fontSize: 16 }}>{getToastIcon(toast.type)}</span>
          <span
            style={{
              fontSize: 12.5,
              color: theme.textSecondary,
              lineHeight: 1.4,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            {toast.message}
          </span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: getToastColor(toast.type),
              flexShrink: 0,
              boxShadow: `0 0 6px ${getToastColor(toast.type)}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
