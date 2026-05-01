import { getAddress, isAddress } from "ethers";
import { getSession, logRequest } from "./_store.js";
import { getClientIp } from "./_rateLimit.js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

async function requireSession(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return getSession(token);
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  const ipAddress = getClientIp(req);
  let statusCode = 200;
  let walletAddress = null;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireSession(req);
    if (!session) {
      statusCode = 401;
      return res.status(401).json({ error: "Signed wallet session required" });
    }

    walletAddress = session.walletAddress;
    const { tokenAddress, action, maxSpendEth, requireManualConfirmation } = parseBody(req);

    if (!isAddress(tokenAddress || "")) {
      statusCode = 400;
      return res.status(400).json({ error: "tokenAddress must be a valid EVM address" });
    }

    if (action !== "BUY") {
      statusCode = 400;
      return res.status(400).json({ error: "Only explicit BUY authorization is currently supported" });
    }

    if (requireManualConfirmation !== true) {
      statusCode = 400;
      return res.status(400).json({ error: "Manual wallet confirmation is required" });
    }

    const spend = Number(maxSpendEth);
    if (!Number.isFinite(spend) || spend <= 0) {
      statusCode = 400;
      return res.status(400).json({ error: "maxSpendEth must be greater than 0" });
    }

    statusCode = 403;
    return res.status(403).json({
      error: "Autonomous execution is disabled in the public app",
      model: "manual_confirmation",
      walletAddress,
      tokenAddress: getAddress(tokenAddress),
    });
  } catch (err) {
    statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ error: err.message || "Execution request failed" });
  } finally {
    logRequest({
      path: "/api/execute",
      method: req.method,
      ipAddress,
      walletAddress,
      statusCode,
      durationMs: Date.now() - startedAt,
      metadata: {
        executionEnabled: false,
      },
    }).catch(() => {});
  }
}
