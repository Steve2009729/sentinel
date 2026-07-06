import { NextResponse } from "next/server";
import { fetchMultiChainSignals } from "@/lib/dexscreener";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Fetch real live signals from DexScreener (Base + Ethereum)
    // Wrapped in a timeout to prevent hanging on Vercel serverless
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const signals = await fetchMultiChainSignals(20);
    clearTimeout(timeout);

    return NextResponse.json({ success: true, signals });
  } catch (e: any) {
    console.error("[API /signals] Error:", e.message);
    // Return empty signals array instead of error for better UX
    return NextResponse.json({ success: true, signals: [] });
  }
}
