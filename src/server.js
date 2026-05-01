/**
 * server.js — VeCast Dashboard API Server
 *
 * Express server on port 3001.
 * Exposes agent state and scan triggers to the React dashboard.
 */

import "dotenv/config";
import express        from "express";
import cors           from "cors";
import { readLog }    from "./logger.js";
import { checkBalance } from "./executor.js";
import { runScan }    from "./agent.js";

const app   = express();
const PORT  = process.env.API_PORT || 3001;
const START = Date.now();

app.use(cors());
app.use(express.json());

// GET /api/agent — wallet address, balance, uptime
app.get("/api/agent", async (req, res) => {
  try {
    const { address, balanceEth } = await checkBalance();
    res.json({
      address,
      balanceEth,
      uptime:  Math.floor((Date.now() - START) / 1000),
      network: "Base Mainnet",
      chainId: 8453,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/decisions — full log, most recent first
app.get("/api/decisions", (req, res) => {
  try {
    const log = readLog();
    res.json([...log].reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scan — trigger a scan from the dashboard
app.post("/api/scan", async (req, res) => {
  const { tokenAddress } = req.body;
  if (!tokenAddress) {
    return res.status(400).json({ error: "tokenAddress required" });
  }
  try {
    const decision = await runScan(tokenAddress);
    res.json(decision);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: Math.floor((Date.now() - START) / 1000) });
});

app.listen(PORT, () => {
  console.log(`[server] VeCast API running on http://localhost:${PORT}`);
});
