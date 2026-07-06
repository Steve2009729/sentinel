import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { getStats } = await import("@/lib/contracts-server");
    const data = await getStats();
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error("[API /stats] Error:", e.message);
    // Graceful fallback — return zero stats instead of 500
    return NextResponse.json({
      success: true,
      data: {
        signalFeeWei: "100000000000000",
        totalSignalsPaid: 0,
        totalDecisions: 0,
      },
    });
  }
}
