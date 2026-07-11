// /api/signals — Live token signal feed
// Same fast-fetch pattern as run-agent: parallel calls, 3s timeouts, instant fallback.
// Never imports from dexscreener.ts (which has long timeouts and many sequential calls).
// Must complete in <8s on Vercel free plan.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function tFetch(url: string, ms = 3000): Promise<unknown> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(id);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

function score(liq: number, vol: number, ch1: number, ch24: number): number {
  let s = 0;
  if (liq > 500_000) s += 28; else if (liq > 100_000) s += 20; else if (liq > 50_000) s += 14; else if (liq > 10_000) s += 7;
  if (vol > 1_000_000) s += 30; else if (vol > 200_000) s += 22; else if (vol > 50_000) s += 14; else if (vol > 10_000) s += 7;
  if (ch1 > 30) s += 25; else if (ch1 > 15) s += 18; else if (ch1 > 5) s += 10; else if (ch1 < -20) s -= 15;
  if (ch24 > 50) s += 10; else if (ch24 > 20) s += 6; else if (ch24 < -30) s -= 8;
  return Math.min(100, Math.max(0, s));
}

function parseGecko(raw: unknown, chain: string, seen: Set<string>): any[] {
  if (!(raw as any)?.data) return [];
  const tokenMap: Record<string, any> = {};
  for (const inc of (raw as any).included ?? []) {
    if (inc.type === "token") tokenMap[inc.id] = inc;
  }
  const out: any[] = [];
  for (const p of (raw as any).data) {
    try {
      const tok = tokenMap[p.relationships?.base_token?.data?.id ?? ""];
      if (!tok) continue;
      const addr: string = tok.attributes?.address ?? "";
      if (!addr.startsWith("0x") || seen.has(addr.toLowerCase())) continue;
      seen.add(addr.toLowerCase());
      const a = p.attributes ?? {};
      const liq = parseFloat(a.reserve_in_usd ?? "0") || 0;
      const vol = parseFloat(a.volume_usd?.h24 ?? "0") || 0;
      const ch1 = parseFloat(a.price_change_percentage?.h1 ?? "0") || 0;
      const ch24 = parseFloat(a.price_change_percentage?.h24 ?? "0") || 0;
      const sc = score(liq, vol, ch1, ch24);
      const action = sc >= 70 ? "ENTER" : sc >= 45 ? "WATCH" : "SKIP";
      let rp = 5;
      if (sc >= 85) rp = Math.min(250, Math.round(60 + ch1 * 1.5));
      else if (sc >= 70) rp = Math.min(120, Math.round(30 + ch1));
      else if (sc >= 50) rp = Math.min(60, Math.round(10 + ch1 * 0.5));
      const sym = tok.attributes?.symbol ?? "???";
      const tf = sc >= 75 ? "24–48h" : "48–72h";
      const pts: string[] = [];
      if (ch1 > 10) pts.push(`🚀 +${ch1.toFixed(1)}% in 1h`);
      else if (ch1 > 2) pts.push(`📈 +${ch1.toFixed(1)}% momentum`);
      if (ch24 > 20) pts.push(`🔥 +${ch24.toFixed(0)}% over 24h`);
      if (liq > 500_000) pts.push(`💧 $${(liq/1000).toFixed(0)}K liq`);
      if (vol > 200_000) pts.push(`📣 $${(vol/1000).toFixed(0)}K vol`);
      const verdict = action === "ENTER" ? "✅ ENTER" : action === "WATCH" ? "👁️ WATCH" : "⛔ SKIP";
      out.push({
        symbol: sym,
        name: tok.attributes?.name ?? "Unknown",
        chain,
        priceUsd: parseFloat(a.base_token_price_usd ?? "0") || 0,
        liquidityUsd: liq,
        marketCap: parseFloat(a.fdv_usd ?? "0") || 0,
        volume24h: vol,
        priceChange1h: ch1,
        priceChange24h: ch24,
        ageHours: p.attributes?.pool_created_at
          ? (Date.now() - new Date(p.attributes.pool_created_at).getTime()) / 3_600_000
          : 720,
        score: sc,
        action,
        risePct: Math.max(5, rp),
        reasoning: `${pts.join(" · ") || "Market activity detected"} → +${rp}% projected in ${tf} · ${verdict}`,
        pairAddress: p.attributes?.address ?? addr,
        contractAddress: addr,
        isClanker: false,
        isZyno: false,
        logoUrl: tok.attributes?.image_url ?? undefined,
        tradeUrl: chain === "base"
          ? `https://app.uniswap.org/swap?chain=base&outputCurrency=${addr}`
          : `https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${addr}`,
        explorerUrl: chain === "base"
          ? `https://basescan.org/token/${addr}`
          : `https://etherscan.io/token/${addr}`,
        dexscreenerUrl: `https://dexscreener.com/${chain}/${addr}`,
      });
    } catch {}
  }
  return out;
}

export async function GET() {
  try {
    // Parallel fetches — all with 3s timeout so total < 4s
    const [base, eth] = await Promise.all([
      tFetch("https://api.geckoterminal.com/api/v2/networks/base/trending_pools?include=base_token&page=1", 3000),
      tFetch("https://api.geckoterminal.com/api/v2/networks/eth/trending_pools?include=base_token&page=1", 3000),
    ]);

    const seen = new Set<string>();
    const signals = [
      ...parseGecko(base, "base", seen),
      ...parseGecko(eth, "ethereum", seen),
    ].sort((a, b) => b.score - a.score).slice(0, 30);

    if (signals.length > 0) {
      return NextResponse.json({ success: true, signals, source: "live", count: signals.length });
    }

    // Fallback — always returns something
    return NextResponse.json({ success: true, signals: FALLBACK, source: "fallback", count: FALLBACK.length });

  } catch (e: any) {
    console.error("[/api/signals]", e.message);
    return NextResponse.json({ success: true, signals: FALLBACK, source: "fallback", count: FALLBACK.length });
  }
}

// ─── CURATED FALLBACK ─────────────────────────────────────────────────────────

const FALLBACK = [
  {
    symbol: "DEGEN", name: "Degen", chain: "base",
    priceUsd: 0.0087, liquidityUsd: 920000, marketCap: 320000000,
    volume24h: 1240000, priceChange1h: 2.4, priceChange24h: 8.1, ageHours: 4320,
    score: 78, action: "ENTER", risePct: 45, isClanker: false, isZyno: false,
    reasoning: "📈 +2.4% in 1h · 💧 $920K liq · 📣 $1.2M vol → +45% projected in 24–48h · ✅ ENTER",
    pairAddress: "0x6cDAcb3025E16865BeB8E9354F4Ea8f87111DC81",
    contractAddress: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    tradeUrl: "https://app.uniswap.org/swap?chain=base&outputCurrency=0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    explorerUrl: "https://basescan.org/token/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    dexscreenerUrl: "https://dexscreener.com/base/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
  },
  {
    symbol: "VIRTUAL", name: "Virtual Protocol", chain: "base",
    priceUsd: 1.82, liquidityUsd: 3200000, marketCap: 1180000000,
    volume24h: 567000, priceChange1h: 3.8, priceChange24h: 15.2, ageHours: 720,
    score: 80, action: "ENTER", risePct: 55, isClanker: false, isZyno: false,
    reasoning: "🔥 +15.2% over 24h · 💧 $3.2M liq · 📣 $567K vol → +55% projected in 24–48h · ✅ ENTER",
    pairAddress: "0x9A19ceE7B5c4b7b1d41a0B7e1b7E0d1c4B8E7A2F",
    contractAddress: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
    tradeUrl: "https://app.uniswap.org/swap?chain=base&outputCurrency=0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
    explorerUrl: "https://basescan.org/token/0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
    dexscreenerUrl: "https://dexscreener.com/base/0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
  },
  {
    symbol: "PEPE", name: "Pepe", chain: "ethereum",
    priceUsd: 0.0000128, liquidityUsd: 2450000, marketCap: 5400000000,
    volume24h: 892000, priceChange1h: 4.2, priceChange24h: 12.8, ageHours: 8760,
    score: 72, action: "ENTER", risePct: 40, isClanker: false, isZyno: false,
    reasoning: "💧 $2.45M liq · 📣 $892K vol · +4.2% in 1h → +40% projected in 24–48h · ✅ ENTER",
    pairAddress: "0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f",
    contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    tradeUrl: "https://app.uniswap.org/swap?chain=mainnet&outputCurrency=0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    explorerUrl: "https://etherscan.io/token/0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    dexscreenerUrl: "https://dexscreener.com/ethereum/0x6982508145454Ce325dDbE47a25d4ec3d2311933",
  },
  {
    symbol: "BRETT", name: "Brett", chain: "base",
    priceUsd: 0.142, liquidityUsd: 1850000, marketCap: 1420000000,
    volume24h: 345000, priceChange1h: 1.2, priceChange24h: -3.4, ageHours: 2160,
    score: 58, action: "WATCH", risePct: 22, isClanker: false, isZyno: false,
    reasoning: "💧 $1.85M liq · 📊 $345K vol → +22% projected in 48–72h · 👁️ WATCH",
    pairAddress: "0x404E927b203375779a6aBd52a2049cE0ADf6609B",
    contractAddress: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
    tradeUrl: "https://app.uniswap.org/swap?chain=base&outputCurrency=0x532f27101965dd16442E59d40670FaF5eBB142E4",
    explorerUrl: "https://basescan.org/token/0x532f27101965dd16442E59d40670FaF5eBB142E4",
    dexscreenerUrl: "https://dexscreener.com/base/0x532f27101965dd16442E59d40670FaF5eBB142E4",
  },
  {
    symbol: "AERO", name: "Aerodrome Finance", chain: "base",
    priceUsd: 0.94, liquidityUsd: 5600000, marketCap: 680000000,
    volume24h: 234000, priceChange1h: -1.2, priceChange24h: 5.8, ageHours: 6480,
    score: 52, action: "WATCH", risePct: 18, isClanker: false, isZyno: false,
    reasoning: "💧 $5.6M liq · +5.8% over 24h → +18% projected in 48–72h · 👁️ WATCH",
    pairAddress: "0xBcF1e328455c4059EEb9e3f84b5543F74E24e7F1",
    contractAddress: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    tradeUrl: "https://app.uniswap.org/swap?chain=base&outputCurrency=0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    explorerUrl: "https://basescan.org/token/0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    dexscreenerUrl: "https://dexscreener.com/base/0x940181a94A35A4569E4529A3CDfB74e38FD98631",
  },
];
