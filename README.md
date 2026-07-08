# Sentinel — Web3 Token Signal Terminal

Sentinel is an autonomous, self-optimizing AI token rating terminal built for **HashKey Chain**, **Base**, and **Ethereum**. It utilizes advanced data feeds, on-chain analytics, and Google Gemini AI to provide real-time token signals, momentum scores, and deep security audits.

## 🚀 Features

- **Live Token Launches**: Aggregates top boosted and active liquidity pools across Base and Ethereum using the DexScreener API.
- **Google Gemini AI Copilot**: Fully integrated AI agent that synthesizes market metrics, momentum trajectories, and writes natural language reasoning for trading candidate tokens. It can also act as a specialized Web3 & DeFi assistant.
- **Deep Token Analytics**: 
  - Real-time **TradingView OHLCV Charts** powered by GeckoTerminal.
  - Automated **Smart Contract Security Audits** (Honeypot, Mintable, Pausable) via GoPlus Security.
  - RPC-based log parsing to calculate true top token holder distribution and smart money tracking.
- **Secure Web3 Authentication**: Implements EIP-6963 multi-wallet connection alongside cryptographic message signing (`personal_sign`) to authenticate and protect user sessions.
- **Native HSK Micro-Settlements**: Handles transparent, native gas token (HSK) transfers for premium tier unlocks directly to the developer treasury.
- **Interactive UI**: Responsive, highly stylized terminal interface built with modern React.

## 🛠 Tech Stack

- **Framework**: [Next.js 14+ (App Router)](https://nextjs.org/)
- **Language**: TypeScript
- **Styling**: Vanilla CSS with modern Glassmorphism & Neon design aesthetics
- **Web3 / Blockchain**: `ethers.js`, HashKey Chain (Layer-2 EVM), Base, Ethereum
- **State Management**: `zustand`
- **APIs**: 
  - DexScreener (Live Pools & Boosts)
  - GeckoTerminal (Historical Candle Data)
  - GoPlus Security (Contract Auditing)
  - Google Gemini 2.5 Flash (AI Reasoning)

## 📦 Getting Started

First, make sure you have your environment variables set up (see `.env.example`):
- `GEMINI_API_KEY`: Your Google Gemini API Key

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the terminal.

## 🔐 Authentication & Payments
The platform features a 3-tier payment gate:
- **Tier 1 (Basic)**: Free access to the live token signal feed.
- **Tier 2 (Premium)**: Unlocks AI Agent reasoning cycles for 1.5 HSK.
- **Tier 3 (Deep Analytics)**: Unlocks full chart analysis, security audits, and top holder metrics for 0.01 HSK per asset.

*(A Demo Mode is included in the dashboard to bypass live payments for testing purposes).*
