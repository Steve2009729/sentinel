# PHASE 9 PROGRESS — HSKSwap Integration

## Step 1 — Contract Research ✅ COMPLETE

### Sources used
- Extracted `@hskswap/sdk-core@1.0.3` npm tarball and read `dist/sdk-core.cjs.development.js` directly
- Extracted `@hskswap/smart-order-router@1.0.1` npm tarball and read `build/main/providers/v3/subgraph-provider.js` and `build/main/util/addresses.js`

### Confirmed: Uniswap V3 Fork ✅
(was pre-confirmed in blueprint — verified again: both packages depend on `@uniswap/v3-sdk` and `@uniswap/v3-periphery`)

### HashKey Mainnet (Chain ID: 177) — CONFIRMED addresses

| Contract | Address |
|---|---|
| **V3 Factory** | `0x972cA9D1662F5e029cD18327D29026532E84c742` |
| **SwapRouter02** | `0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3` |
| **QuoterV2** | `0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD` |
| **NonfungiblePositionManager** | `0xDF0A9b833Db0E4CeEa103A4408f3B68e7FC0cad5` |
| **Multicall** | `0x7D0CBa43EbDD69ec2CE3B5AeAD3b0FbC796c565B` |
| **TickLens** | `0x0BA7274A183d9f91a0387d45853613B2d626A590` |
| **V3Migrator** | `0x4DaA3DaD4fe453767C5aeEFf2e2A15b0e85Fe62D` |
| **WHSK (wrapped native)** | `0xB210D2120d57b758EE163cFfb43e73728c471Cf1` |

### HashKey Testnet (Chain ID: 133) — also confirmed
| Contract | Address |
|---|---|
| V3 Factory | `0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0` |
| WHSK | `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` |

### Subgraph endpoint — CONFIRMED
| Network | URL |
|---|---|
| **HSKSwap Mainnet** | `https://graphnode.hashkeychain.net/subgraphs/name/hskswap` |
| HSKSwap Testnet | `https://graphnode-testnet.hashkeychain.net/subgraphs/name/uniswap-v3/hsk-test` |

### Other leads
- `https://github.com/HashKeyChain/dex-v3-core` — HTTP 404 (does not exist publicly)
- The Graph official docs — network not reachable from current machine
- WHSK address `0xB210D2120d57b758EE163cFfb43e73728c471Cf1` — **CONFIRMED** from sdk-core WETH9 map

---

## Step 2 — hskswapSource.ts data layer ✅ COMPLETE
Created `agent/hskswapSource.ts` — uses subgraph GraphQL endpoint to fetch top pools.
Uses Factory address as fallback verification.

---

## Step 3 — Merged into signal feed ✅ COMPLETE
- Updated `agent/signalSource.ts` to return HSKSwap signals when `chain === "hashkey"`.
- Updated `src/lib/dexscreener.ts` to fetch HSKSwap signals in parallel via the subgraph in `fetchMultiChainSignals`.
- Updated `src/lib/agentResearch.ts` to include HSKSwap signals in the parallel AI agent research phase.

---

## Step 4 — UI source badges ✅ COMPLETE
- Updated `src/components/SignalFeed.tsx` to include `hashkey` filters, HSKSwap badge in source row, and trade link mapping.
- Updated `src/components/TokenChecker.tsx` to include `hashkey` dropdown choice, and correctly format deep analytics links.
- Updated `src/lib/tokenAnalytics.ts` to query HSKSwap pools directly for `hashkey` tokens and configure RPC and GoPlus parameters for HashKey.

---

## Step 5 — Final verification ✅ COMPLETE
- Ran `npm run build` and verified the build succeeds without compilation or type-checking issues.
- Tested signal aggregation and token analytics using a TS-Node script, proving HSKSwap queries return valid metrics and candles for HashKey tokens (e.g. TSLA).
