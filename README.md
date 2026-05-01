# VeCast

Autonomous token intelligence and risk scoring for Base.

VeCast is an AI economic agent that evaluates Base mainnet tokens using live Nansen market intelligence, converts those signals into a 0-100 risk score, and returns a `BUY`, `HOLD`, or `BLOCK` decision with a transparent explanation. V2 adds connected user wallets, signed wallet sessions, risk preferences, persistent scan history, shareable scan reports, and a public execution boundary that never asks for private keys.

Live app: https://ve-cast.vercel.app/

Repository: https://github.com/thenameisdevair/VeCast

## What It Does

VeCast helps an autonomous agent decide whether a token is worth acting on.

For each token address, the agent:

1. Pulls live token intelligence from Nansen on Base.
2. Normalizes liquidity, flow, holder, age, volume, and buy/sell data.
3. Scores the token across seven risk dimensions.
4. Produces a `BUY`, `HOLD`, or `BLOCK` decision.
5. Displays the full reasoning trail in a live dashboard.
6. Saves signed-user scan history and produces shareable public reports.

The project is designed for agentic finance workflows where other agents, builders, or judges need to see not just a decision, but why the agent reached it.

## Live Demo Tokens

These tokens are useful for demonstrating different risk profiles:

| Token | Address | Expected Shape |
|---|---|---|
| WETH | `0x4200000000000000000000000000000000000006` | Deep liquidity, mature token |
| VIRTUAL | `0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b` | Active Base ecosystem token |
| DONNA | `0x61527cd3667243b0a80d41cb690237444e42a8d0` | Thin liquidity / high-risk demo |

## Architecture

```text
React Dashboard
  |
  | WalletConnect / Reown + wagmi
  v
Connected Base Wallet
  |
  | signed session + /api/scan
  v
Vercel API Route / Express API
  |
  v
Nansen REST API
  |
  v
Scanner Normalization Layer
  |
  v
Risk Scoring Engine
  |
  v
BUY / HOLD / BLOCK Decision
  |
  v
Dashboard + Decision History
```

Local development also includes a CLI agent loop and optional on-chain execution module. The deployed public app keeps `/api/scan` separate from `/api/execute`; execution is authenticated and disabled by default.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js 20, Express locally, Vercel API routes in production |
| Intelligence | Nansen REST API |
| Chain | Base Mainnet, chain ID `8453` |
| Wallet / RPC | Reown AppKit, wagmi, viem, ethers.js v6 |
| Persistence | Optional Postgres via `DATABASE_URL` or `POSTGRES_URL`, with memory fallback |
| Optional Commerce | Virtuals Protocol ACP SDK |
| Optional Execution | Uniswap V3 SwapRouter on Base |
| Deployment | Vercel |

## Core Features

- Live Base token scan by contract address
- Nansen-powered token intelligence
- Risk score from `0-100`, where lower is safer and higher is riskier
- Configurable decision thresholds: Conservative, Balanced, Aggressive, Custom
- Signal-by-signal score breakdown
- Human-readable reasoning for each decision
- Connected wallet context, Base network status, signed session state
- Signed-user scan history, search/filter/pin/export controls
- Shareable public scan pages at `/scan/:scanId`
- Demo-ready preset token buttons
- Public `/api/execute` boundary that requires signed sessions and refuses live autonomous execution by default
- Local CLI commands for scan, trade, watch, provider, log, and balance
- Vercel API route support for deployed scans

## Scoring Model

Lower scores are safer. Higher scores are riskier.

| Score Range | Decision | Meaning |
|---|---|---|
| `0-35` | `BUY` | Balanced profile: risk appears acceptable |
| `36-60` | `HOLD` | Balanced profile: mixed signal profile |
| `61-100` | `BLOCK` | Balanced profile: high-risk token |

Risk profiles adjust these thresholds:

| Profile | BUY | HOLD | BLOCK |
|---|---|---|---|
| Conservative | `<=25` | `<=50` | `>50` |
| Balanced | `<=35` | `<=60` | `>60` |
| Aggressive | `<=45` | `<=70` | `>70` |
| Custom | User selected | User selected | Above HOLD max |

### Signal Dimensions

| Dimension | What It Measures |
|---|---|
| Holder concentration | Uses top-holder data where available, otherwise uses holder-base proxy risk |
| Smart money flow | Net buy/sell pressure from Nansen market data |
| DEX activity | Trading volume and trade count |
| Token age | Newer tokens receive higher risk |
| Holder distribution | Total holder count and distribution depth |
| Market / liquidity profile | Liquidity depth and exit-risk profile |
| Buy/sell ratio | Buyer dominance vs sell pressure |

Example high-risk output:

```text
Decision: BLOCK
Score: 74 / 100

- Top holder concentration unavailable - thin holder base raises risk
- Smart money net outflow: $3,115
- Low DEX activity: $3,243 / 8 trades
- Very few holders: 24 - rug risk
- Very thin liquidity: $3,944 - high exit risk
```

## Project Structure

```text
.
├── api/                    # Vercel serverless API routes
│   ├── agent.js
│   ├── auth/
│   ├── execute.js
│   ├── decisions.js
│   ├── health.js
│   ├── _rateLimit.js
│   ├── _store.js
│   └── scan.js
├── dashboard/              # React/Vite frontend
│   ├── src/App.jsx
│   ├── src/index.css
│   └── index.html
├── src/                    # Local backend and agent modules
│   ├── acp.js              # ACP provider mode
│   ├── agent.js            # scan -> score -> optional trade orchestration
│   ├── executor.js         # Base wallet balance and Uniswap execution
│   ├── logger.js           # local decision log
│   ├── scanner.js          # Nansen REST scanner
│   ├── scorer.js           # risk scoring engine
│   └── server.js           # local Express API
├── index.js                # CLI entrypoint
├── vercel.json             # Vercel build/output/rewrites
└── package.json
```

## Local Development

### Prerequisites

- Node.js 20
- npm
- Nansen API key
- Base mainnet RPC URL
- Wallet private key for balance checks and optional execution

### Install

```bash
git clone https://github.com/thenameisdevair/VeCast.git
cd VeCast
npm install
cd dashboard && npm install && cd ..
```

### Environment

Create a local `.env`:

```bash
cp .env.example .env
```

Required values:

```env
NANSEN_API_KEY=
AGENT_PRIVATE_KEY=
AGENT_WALLET_ADDRESS=
RPC_URL=
VITE_BASE_RPC_URL=
VITE_WALLETCONNECT_PROJECT_ID=
DATABASE_URL=
MAX_SPEND_ETH=0.001
ACP_BUILDER_CODE=
ACP_ENTITY_ID=1
API_PORT=3001
```

`API_PORT` is used only for local Express development. Vercel does not need it. `DATABASE_URL` or `POSTGRES_URL` is optional locally, but required for durable production history and sessions.

### Run Locally

Start backend and dashboard together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run server
cd dashboard && npm run dev
```

Local URLs:

- Dashboard: http://localhost:5173
- API: http://localhost:3001
- Health check: http://localhost:3001/api/health

## CLI Usage

```bash
# Scan a token without trading
node index.js scan <tokenAddress>

# Scan and execute a buy if the decision is BUY
node index.js trade <tokenAddress>

# Continuously evaluate a list of tokens
node index.js watch --tokens <addr1,addr2> --interval 60

# Start ACP provider mode
node index.js serve

# Show local decision history
node index.js log

# Check Base wallet balance
node index.js balance
```

## API Routes

The deployed app uses Vercel API routes. The local app uses equivalent Express routes.

| Route | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Service status and uptime |
| `/api/agent` | `GET` | Agent wallet address, ETH balance, network, uptime |
| `/api/auth/nonce` | `POST` | Create a safe sign-in message for a wallet |
| `/api/auth/verify` | `POST` | Verify wallet signature and issue a session token |
| `/api/decisions` | `GET` | Recent public history or signed wallet history |
| `/api/scan` | `POST` | Scan a token and return token identity, risk score, decision, breakdown, and reasons |
| `/api/scan/:id` | `GET` | Public shareable scan report |
| `/api/execute` | `POST` | Authenticated execution boundary; disabled-by-default in public app |

Example scan request:

```bash
curl -X POST https://ve-cast.vercel.app/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenAddress":"0x4200000000000000000000000000000000000006","riskProfile":"balanced"}'
```

Example response:

```json
{
  "token": "0x4200000000000000000000000000000000000006",
  "tokenInfo": {
    "symbol": "WETH",
    "name": "Wrapped Ether",
    "liquidityUsd": 325000000
  },
  "score": 33,
  "riskScore": 33,
  "decision": "BUY",
  "reasons": ["Exceptional net inflow: $22,140,643"],
  "breakdown": {
    "holderConcentration": 5,
    "smartMoneyFlow": 0,
    "smartMoneyDex": 0,
    "tokenAge": 2,
    "holderDistribution": 1,
    "pnlProfile": 2,
    "buySellRatio": 14
  }
}
```

## Deployment

The production app is deployed on Vercel:

https://ve-cast.vercel.app/

Recommended Vercel settings:

```text
Root Directory: ./
Framework Preset: Other
Build Command: npm run build
Output Directory: dashboard/dist
Install Command: npm install
Node.js Version: 20.x
```

Environment variables:

```env
NANSEN_API_KEY=
AGENT_PRIVATE_KEY=
AGENT_WALLET_ADDRESS=
RPC_URL=
VITE_BASE_RPC_URL=
VITE_WALLETCONNECT_PROJECT_ID=
DATABASE_URL=
MAX_SPEND_ETH=0.001
ACP_ENTITY_ID=1
ACP_BUILDER_CODE=
```

Do not set `API_PORT` in Vercel.

## Security Notes

- Never commit `.env`.
- Treat `AGENT_PRIVATE_KEY` as a production secret.
- Never ask users for private keys, seed phrases, JSON keystores, or blind/unlimited approvals.
- Browser-exposed variables must use only public values such as `VITE_BASE_RPC_URL` and `VITE_WALLETCONNECT_PROJECT_ID`.
- Use a low-balance demo wallet for hackathon demos.
- Rotate keys immediately if they are exposed in logs, screenshots, chat, or build output.
- The public dashboard exposes scanning and signed-session history only. `/api/execute` is separate, authenticated, and disabled by default.

## Autonomous Execution

The CLI can execute swaps through Uniswap V3 on Base when a scan returns `BUY`.

Execution path:

```text
scan token -> score token -> BUY decision -> executeBuy() -> Uniswap V3 SwapRouter
```

Safety controls:

- Spend ceiling via `MAX_SPEND_ETH`
- Balance and gas-buffer check before execution
- Transaction hash logging after confirmation

Current execution module:

- Router: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Input asset: WETH on Base
- Default pool fee: `3000`

For production trading, add slippage protection, allowlists, scoped smart-account permissions or session keys, spending limits, and a dedicated security review before enabling public execution.

## ACP Provider Mode

VeCast includes an experimental ACP provider module for Agent Commerce Protocol workflows. In provider mode, another agent can request a token intelligence scan, fund the job, and receive a structured report containing the score, decision, signal breakdown, and reasons.

```bash
node index.js serve
```

ACP mode requires:

```env
AGENT_PRIVATE_KEY=
AGENT_WALLET_ADDRESS=
ACP_BUILDER_CODE=
ACP_ENTITY_ID=
```

## Roadmap

- Connect a production Postgres database and WalletConnect project ID in Vercel
- Add scoped smart-account permissions for limited agent execution
- Add richer Nansen endpoints for top-holder concentration
- Add ACP marketplace proof flow
- Add test coverage for scanner/scorer behavior

## License

MIT
