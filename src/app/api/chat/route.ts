import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENTINEL_SYSTEM_PROMPT = `You are Sentinel Copilot — an expert AI DeFi analyst and the built-in assistant of the Sentinel AI Token Signal Terminal. You have deep knowledge of:

ABOUT SENTINEL PLATFORM:
- Sentinel is a real-time AI-powered token signal terminal built on HashKey Chain
- It aggregates token launches from Base and Ethereum via DexScreener, GeckoTerminal, Clanker (Farcaster), and Zyno launchpad
- Signals auto-refresh every 60 seconds showing newest token launches with scoring
- Built with Next.js 15, ethers.js, Zustand, lightweight-charts, Google Gemini AI

PAYMENT TIERS:
- Tier 1 (Free): Live token launches — real-time new pool discoveries from Base & Ethereum, no payment required
- Tier 2 (2 HSK): AI Trading Signals — Google Gemini analyzes top tokens, gives entry/exit reasoning, projected rise % and timeframes
- Tier 3 (1 HSK per asset): Deep Analytics — line price charts, security audit (GoPlus), smart money / top holder tracking, advanced metrics

HASHKEY CHAIN:
- HashKey Chain is an EVM-compatible Layer-2 blockchain built for regulated digital assets
- Chain ID: 177, native token: HSK
- HSK is used for all payments inside Sentinel
- Explorer: hashkey.blockscout.com, RPC: https://mainnet.hsk.xyz

SIGNAL SCORING:
- Signals are scored 0–100 based on: liquidity depth, 24h volume, 1h momentum, token age, and launchpad source
- ENTER = score ≥ 70 (strong buy signal), WATCH = 45–69 (monitor closely), SKIP = <45 (avoid)
- Rise Potential % is a projected estimate based on momentum, liquidity depth, and historical patterns of similar launches

LAUNCHPADS TRACKED:
- Clanker: Farcaster-native token factory on Base — social tokens from Warpcast creators
- Zyno.finance: Base launchpad for new project launches
- DexScreener: Boosted and profiled tokens across Base and Ethereum
- GeckoTerminal: New pool discoveries updated in real time

DEFI & TRADING KNOWLEDGE:
- Deep knowledge of Uniswap V2/V3/V4, Aerodrome (Base AMM), PancakeSwap, Curve, Balancer
- Liquidity pools, impermanent loss, slippage, MEV, sandwich attacks
- ERC-20 tokenomics, vesting schedules, token burns
- On-chain analytics: whale tracking, smart money, holder concentration
- Security: honeypots, rugpulls, mintable tokens, pausable transfers, ownership renouncement
- Base ecosystem: BRETT, DEGEN, VIRTUAL, TOSHI, MOCHI, HIGHER, AERODROME, CBBTC
- Ethereum ecosystem: PEPE, SHIB, UNI, LINK, AAVE, MKR, ENS
- DeFi protocols: Aave, Compound, MakerDAO, Uniswap, Lido, Rocket Pool, Convex

RULES:
- Answer ALL crypto, DeFi, Web3, blockchain, and Sentinel-related questions thoroughly
- For questions about Sentinel specifically, give detailed accurate answers about the platform features
- Be analytical, direct, and actionable — give real insights, not generic advice
- Format responses clearly — use bullet points for lists, bold key terms when helpful
- If a question is completely unrelated to crypto/DeFi/Web3 (e.g., cooking, politics, history), politely redirect: "I'm specialized in crypto and DeFi — ask me about tokens, trading, or the Sentinel platform!"
- Keep responses concise but informative — aim for 2-4 paragraphs max unless detail is needed`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ success: false, error: "Invalid messages format" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Smart fallback without API key
      const lastMsg = messages[messages.length - 1]?.text?.toLowerCase() || "";
      const response = generateFallbackResponse(lastMsg);
      return NextResponse.json({ success: true, response });
    }

    // Build Gemini contents array — must alternate user/model and start with user
    const rawContents = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    // Ensure it starts with user and there's at least one turn
    const userContents = rawContents.filter((c: any) => c.role === "user");
    if (userContents.length === 0) {
      return NextResponse.json({ success: true, response: "Please ask a question!" });
    }

    // Build proper alternating sequence
    const contents: any[] = [];
    let lastRole = "";
    for (const c of rawContents) {
      if (c.role === lastRole) {
        // Merge consecutive same-role messages
        contents[contents.length - 1].parts[0].text += "\n" + c.parts[0].text;
      } else {
        contents.push({ ...c });
        lastRole = c.role;
      }
    }

    // Must start with user
    while (contents.length > 0 && contents[0].role === "model") {
      contents.shift();
    }

    if (contents.length === 0) {
      return NextResponse.json({ success: true, response: "Please ask a question!" });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SENTINEL_SYSTEM_PROMPT }],
          },
          contents,
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 400,
            topP: 0.95,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[API/chat] Gemini error:", geminiRes.status, errText);
      // Fall through to fallback
      const lastMsg = messages[messages.length - 1]?.text?.toLowerCase() || "";
      const fallback = generateFallbackResponse(lastMsg);
      return NextResponse.json({ success: true, response: fallback });
    }

    const data = await geminiRes.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm analyzing the data. Please try rephrasing your question.";

    return NextResponse.json({ success: true, response: reply });
  } catch (e: any) {
    console.error("[API/chat] Unexpected error:", e);
    return NextResponse.json({ success: false, error: "Internal error", response: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// ─── OFFLINE FALLBACK ─────────────────────────────────────────────────────────

function generateFallbackResponse(q: string): string {
  if (q.includes("tier") || q.includes("unlock") || q.includes("price") || q.includes("cost") || q.includes("pay")) {
    return "Sentinel has 3 tiers:\n\n• **Tier 1 (Free)**: Live token launches — real-time Base & Ethereum pool discoveries\n• **Tier 2 (2 HSK)**: AI Signals — Gemini AI analysis with rise % predictions and reasoning\n• **Tier 3 (1 HSK/asset)**: Deep Analytics — price charts, security audit, whale tracking";
  }
  if (q.includes("hashkey") || q.includes("hsk")) {
    return "HashKey Chain is an EVM-compatible Layer-2 blockchain (Chain ID: 177). HSK is its native gas token. Sentinel uses HSK for all tier payments — transfers go directly on-chain for full transparency. You can get HSK from HashKey Exchange.";
  }
  if (q.includes("signal") || q.includes("enter") || q.includes("watch") || q.includes("score")) {
    return "Signals are scored 0–100 based on liquidity depth, 24h volume, 1h price momentum, and token age.\n\n• **ENTER (70–100)**: Strong momentum — consider entry\n• **WATCH (45–69)**: Monitor closely — building traction\n• **SKIP (<45)**: Weak setup — avoid\n\nThe Rise Potential % is a projected estimate for the next 24–72h.";
  }
  if (q.includes("clanker")) {
    return "Clanker is a Farcaster-native token factory on Base. Creators on Warpcast (the Farcaster client) can deploy their own tokens via Clanker. These tokens often have strong social communities and can see rapid launches. Sentinel automatically detects and tags Clanker tokens in the signal feed.";
  }
  if (q.includes("base") && !q.includes("database")) {
    return "Base is an Ethereum Layer-2 built by Coinbase using the OP Stack. It has very low gas fees (~$0.001/tx) and a growing DeFi ecosystem including Aerodrome (the main AMM), Uniswap V3/V4, and many new token launches. Sentinel's signal feed focuses heavily on Base due to its active launch scene.";
  }
  if (q.includes("rug") || q.includes("scam") || q.includes("honeypot") || q.includes("safe")) {
    return "Sentinel's Deep Analytics tier includes automated security checks:\n\n• **Honeypot detection** — can the token be sold?\n• **Mint function** — can the owner print more tokens?\n• **Pausable transfers** — can trading be halted?\n• **Ownership renouncement** — is the contract decentralized?\n\nAlways check security flags before trading any new launch.";
  }
  if (q.includes("uniswap") || q.includes("trade") || q.includes("swap") || q.includes("buy")) {
    return "Each signal card has a **Trade ↗** button that links directly to Uniswap with the token pre-filled:\n• Base tokens → Uniswap V3 on Base\n• Ethereum tokens → Uniswap V3 on mainnet\n\nAlways verify the contract address before trading. Use small position sizes on new launches.";
  }
  if (q.includes("chart")) {
    return "Sentinel's Deep Analytics section shows line price charts powered by lightweight-charts using GeckoTerminal OHLCV data. Charts show 30-minute candles over 24 hours. Unlock Deep Analytics for 1 HSK to see a specific token's chart.";
  }
  if (q.includes("wallet") || q.includes("connect") || q.includes("metamask")) {
    return "Sentinel supports any EIP-6963 compatible wallet including MetaMask, Trust Wallet, Coinbase Wallet, and Rabby. Connect your wallet, sign the auth message, and it automatically switches you to HashKey Chain (ID: 177) for payments.";
  }
  return "I'm Sentinel Copilot — your DeFi AI analyst. I can help with:\n\n• Token signal interpretation and trading strategies\n• Sentinel platform features and payment tiers\n• HashKey Chain, Base, and Ethereum ecosystem\n• DeFi protocols, security analysis, and on-chain analytics\n\nWhat would you like to know?";
}
