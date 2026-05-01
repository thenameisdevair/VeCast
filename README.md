# VeCast ⚡

> Autonomous AI Economic Agent on Base Mainnet

VeCast is a fully autonomous economic agent that lives its own on-chain life.
It pulls token intelligence from Nansen, scores risk across 7 signal dimensions,
makes autonomous BUY / HOLD / BLOCK decisions, and executes real swaps from
its own EconomyOS wallet on Base — with no human in the loop.

Built for the **Virtuals Protocol / EconomyOS "Agents Day"** hackathon.

---

## Architecture
Nansen CLI (7 signals)
↓
Scoring Engine (0–100 risk score)
↓
Autonomous Decision: BUY | HOLD | BLOCK
↓ (if BUY)
EconomyOS Wallet → Uniswap V3 Swap on Base
↓
ACP Provider Listing → other agents hire VeCast → USDC earned
↓
React Dashboard → live signal breakdown + tx feed

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 18, ESM |
| Chain | Base Mainnet (chain-id 8453) |
| Intelligence | Nansen CLI v1.24.0 |
| Agent Identity | EconomyOS (Virtuals Protocol) |
| Commerce | ACP SDK (@virtuals-protocol/acp-node-v2) |
| Execution | ethers.js v6 + Uniswap V3 SwapRouter |
| Dashboard | React + Vite + Tailwind CSS |
| API | Express.js |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/thenameisdevair/VeCast.git
cd VeCast
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in all values in `.env`:

```env
NANSEN_API_KEY=        # from nansen.ai
AGENT_PRIVATE_KEY=     # from: acp agent whoami
AGENT_WALLET_ADDRESS=  # from: acp wallet address --json
MAX_SPEND_ETH=0.001    # hard ceiling per trade
RPC_URL=               # Base mainnet RPC (Alchemy / Infura)
ACP_BUILDER_CODE=      # from app.virtuals.io/acp/new
ACP_ENTITY_ID=1
API_PORT=3001
```

### 3. Set up EconomyOS agent identity

```bash
# Install ACP CLI
npm install -g acp-cli

# Authenticate (opens browser)
acp configure

# Create agent + wallet on Base
acp agent create
acp agent add-signer

# Verify wallet
acp wallet address --json
acp wallet balance --chain-id 8453

# Fund wallet (Base mainnet ETH)
acp wallet topup --chain-id 8453
```

### 4. Verify Nansen CLI

```bash
nansen-cli token info --token 0x4200000000000000000000000000000000000006 --output json
```

---

## Commands

```bash
# Intelligence scan only — no trade
node index.js scan <tokenAddress>

# Scan + execute autonomously if BUY
node index.js trade <tokenAddress>

# Autonomous watch loop (evaluates every 60s)
node index.js watch --tokens <addr1,addr2> --interval 60

# Start as ACP provider (accept jobs from other agents)
node index.js serve

# View decision + tx history
node index.js log

# Check agent wallet balance
node index.js balance
```

---

## Dashboard

Start the full dev environment (API + dashboard):

```bash
npm run dev
```

- API server: http://localhost:3001
- Dashboard: http://localhost:5173

The dashboard shows:
- Agent wallet address and live ETH balance
- Token scan panel with signal breakdown (one row per Nansen signal)
- BUY / HOLD / BLOCK decision badge (green / yellow / red)
- Live tx feed with Basescan links

---

## Scoring Engine

Tokens are scored 0–100 across 7 Nansen signal dimensions.
**Lower score = safer to buy.**

| Factor | Signal |
|---|---|
| Holder concentration | >50% single holder = auto BLOCK |
| Smart money net flow | Inflow = bullish, outflow = bearish |
| Smart money DEX volume | High SM activity = conviction |
| Token age | <1 day old = extreme risk |
| Holder distribution | <50 holders = rug risk |
| PnL profile | Top wallet profitability |
| Buy/sell ratio | Buyer dominance = bullish |

**Decision thresholds:**

| Score | Decision |
|---|---|
| 0–35 | ✅ BUY |
| 36–60 | ⏸ HOLD |
| 61–100 | 🚫 BLOCK |

---

## Autonomous Execution

VeCast executes swaps via Uniswap V3 SwapRouter on Base mainnet:
- Contract: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Route: ETH → WETH → target token (0.3% fee pool)
- Hard ceiling: `MAX_SPEND_ETH` from `.env` — never exceeded
- Every tx is logged to `logs/decisions.json` with hash, score, timestamp

---

## ACP Provider Mode

VeCast lists itself on the Agent Commerce Protocol as a
**Token Intelligence Scan** provider at $0.50 USDC per scan.

Other agents can hire VeCast, submit a token address as a requirement,
and receive a structured scan report with score, decision, and full
signal breakdown. Payment is released to the agent's own wallet on completion.

```bash
# Start provider mode
node index.js serve
```

---

## Live Proof

### Autonomous Transaction

> Paste live tx hash here after demo execution

| Field | Value |
|---|---|
| Tx Hash | `PASTE_TX_HASH_HERE` |
| Basescan | `https://basescan.org/tx/PASTE_TX_HASH_HERE` |
| Token | `PASTE_TOKEN_ADDRESS_HERE` |
| Amount | 0.001 ETH |
| Score | PASTE_SCORE_HERE |
| Decision | BUY |
| Timestamp | PASTE_TIMESTAMP_HERE |

### ACP Job Proof

> Paste ACP job ID and payment tx here after demo

| Field | Value |
|---|---|
| Job ID | `PASTE_JOB_ID_HERE` |
| Payment Tx | `PASTE_PAYMENT_TX_HERE` |
| Service | Token Intelligence Scan |
| Price | $0.50 USDC |

---

## Commit History

| Commit | Module |
|---|---|
| feat: scaffold project structure | package.json, .env.example, .gitignore |
| feat: add logger module | src/logger.js |
| feat: add scanner module | src/scanner.js |
| feat: add scorer module | src/scorer.js |
| feat: add executor module | src/executor.js |
| feat: add ACP provider module | src/acp.js |
| feat: add agent core loop | src/agent.js |
| feat: add CLI entrypoint | index.js |
| feat: add Express API server | src/server.js |
| feat: add React dashboard | dashboard/ |
| docs: add README | README.md |

---

## License

MIT
