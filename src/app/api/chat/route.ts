import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const lastMessage = messages[messages.length - 1]?.text || "";

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        // Map history to Gemini format
        const contents = messages.map((m: any) => ({
          role: m.sender === "user" ? "user" : "model",
          parts: [{ text: m.text }]
        }));

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: "You are Sentinel Copilot, a highly knowledgeable DeFi AI Analyst built on HashKey Chain. You must answer questions related to Crypto, DeFi, Web3, and HashKey. If the user asks a question about ANY topic outside of crypto, DeFi, Web3, or HashKey (such as general knowledge, history, programming not related to Web3, cooking, etc.), you MUST politely decline to answer, stating that you are a specialized crypto AI and only answer questions related to the crypto market. Keep your responses brief, professional, and actionable."
                  }
                ]
              },
              contents: contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 250,
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "I am processing your request.";
          return NextResponse.json({ success: true, response: text });
        }
      } catch (err: any) {
        console.error("[API /chat] Gemini Error:", err);
      }
    } else {
      return NextResponse.json({
        text: "Please add your GEMINI_API_KEY in your Vercel environment variables to unlock my AI capabilities! I need it to connect to the Google server.",
      });
    }

    // High fidelity fallback conversation simulator
    let response = "I am ready to assist you. Ask me about any token signals or HashKey Chain analytics!";
    const query = lastMessage.toLowerCase();

    if (query.includes("pepe") || query.includes("brett") || query.includes("degen") || query.includes("virtual")) {
      response = "Based on our latest DexScreener momentum filters, Pepe and Degen show active volume surges over 20%. I recommend running a full Agent reasoning cycle to verify entry points.";
    } else if (query.includes("hashkey") || query.includes("hsk")) {
      response = "HashKey Chain is an EVM-compatible Layer-2 network powered by HSK as its native gas token. Sentinel uses HSK for on-chain logging and analytics settlements.";
    } else if (query.includes("tier") || query.includes("unlock")) {
      response = "Tier 1 grants raw signals, Tier 2 unlocks premium ratings (80%+ rise potential), and Tier 3 gives you full access to TradingView charts and smart money whales.";
    } else if (query.includes("strategy") || query.includes("trade") || query.includes("buy")) {
      response = "We recommend allocating no more than 2-3% of your portfolio per high-conviction ENTER signal. Always check the contract verification and liquidity lock status.";
    }

    return NextResponse.json({ success: true, response });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
