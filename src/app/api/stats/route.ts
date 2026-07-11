import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  // Try to get live stats with a strict 5s timeout
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 5000);

    const { getStats } = await import("@/lib/contracts-server");
    const statsPromise = getStats();
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );

    clearTimeout(id);
    const data = await Promise.race([statsPromise, timeoutPromise]);

    if (data) {
      return NextResponse.json({ success: true, data });
    }
  } catch {
    // Fall through to fallback
  }

  // Fast fallback — don't let slow RPC block the dashboard
  return NextResponse.json({
    success: true,
    data: {
      signalFeeWei: "100000000000000",
      totalSignalsPaid: 0,
      totalDecisions: 0,
    },
  });
}
