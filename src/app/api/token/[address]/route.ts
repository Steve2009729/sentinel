import { NextResponse } from "next/server";
import { fetchTokenAnalytics } from "@/lib/tokenAnalytics";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const chain = new URL(request.url).searchParams.get("chain") ?? "base";

    if (!address || address.length < 10) {
      return NextResponse.json(
        { success: false, error: "Invalid contract address" },
        { status: 400 }
      );
    }

    const analytics = await fetchTokenAnalytics(chain, address);

    if (!analytics) {
      return NextResponse.json(
        { success: false, error: "Token not found or no pair data available" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: analytics });
  } catch (e: any) {
    console.error("[API /token] Error:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
