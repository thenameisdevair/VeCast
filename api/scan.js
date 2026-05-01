import { getAddress, isAddress } from "ethers";
import { scan } from "../src/scanner.js";
import { score } from "../src/scorer.js";
import { checkRateLimit, getClientIp } from "./_rateLimit.js";
import { addDecision, getSession, logRequest } from "./_store.js";

const RISK_PROFILES = new Set(["conservative", "balanced", "aggressive", "custom"]);

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

function normalizeAddress(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw Object.assign(new Error(`${fieldName} required`), { statusCode: 400 });
  }

  const trimmed = value.trim();
  if (!isAddress(trimmed)) {
    throw Object.assign(new Error(`${fieldName} must be a valid EVM address`), { statusCode: 400 });
  }

  return getAddress(trimmed);
}

function normalizeRiskProfile(value) {
  if (value === undefined || value === null || value === "") return "balanced";
  if (typeof value !== "string") {
    throw Object.assign(new Error("riskProfile must be a string"), { statusCode: 400 });
  }

  const normalized = value.trim().toLowerCase();
  if (!RISK_PROFILES.has(normalized)) {
    throw Object.assign(new Error("riskProfile must be conservative, balanced, aggressive, or custom"), {
      statusCode: 400,
    });
  }

  return normalized;
}

function normalizeRiskSettings(value) {
  if (!value || typeof value !== "object") return null;

  const maxScoreForBuy = Number(value.maxScoreForBuy);
  const maxScoreForHold = Number(value.maxScoreForHold);

  if (
    !Number.isFinite(maxScoreForBuy) ||
    !Number.isFinite(maxScoreForHold) ||
    maxScoreForBuy < 0 ||
    maxScoreForBuy > maxScoreForHold ||
    maxScoreForHold > 100
  ) {
    throw Object.assign(new Error("riskSettings must include valid maxScoreForBuy and maxScoreForHold values"), {
      statusCode: 400,
    });
  }

  return {
    maxScoreForBuy,
    maxScoreForHold,
  };
}

function pickNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function extractToken(raw, tokenAddress) {
  const info = raw?.info || {};
  const details = info.token_details || {};
  const spot = info.spot_metrics || {};
  const deployedAt =
    info.deployedAt ?? info.deployed_at ?? info.createdAt ?? details.token_deployment_date ?? details.deployed_at ?? null;

  return {
    address: tokenAddress,
    name: details.name ?? info.name ?? null,
    symbol: details.symbol ?? info.symbol ?? null,
    logo: details.logo_url ?? details.logo ?? info.logo_url ?? info.logo ?? null,
    priceUsd: pickNumber(spot.price_usd, spot.token_price_usd, details.price_usd),
    marketCapUsd: pickNumber(details.market_cap_usd, spot.market_cap_usd),
    fdvUsd: pickNumber(details.fdv_usd, spot.fdv_usd),
    liquidityUsd: pickNumber(spot.liquidity_usd, details.liquidity_usd),
    holders: pickNumber(spot.total_holders, details.total_holders),
    volumeUsd24h: pickNumber(spot.volume_total_usd, spot.volume_usd, details.volume_usd),
    buyVolumeUsd24h: pickNumber(spot.buy_volume_usd, spot.volume_buy_usd),
    sellVolumeUsd24h: pickNumber(spot.sell_volume_usd, spot.volume_sell_usd),
    buys24h: pickNumber(spot.total_buys, spot.buys),
    sells24h: pickNumber(spot.total_sells, spot.sells),
    age: deployedAt,
    deployedAt,
  };
}

async function getSessionFromRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return getSession(token);
}

function getAuthenticatedWallet(session, walletAddress) {
  if (!walletAddress) return null;
  if (!session) return null;
  return session.walletAddress === walletAddress.toLowerCase() ? walletAddress : null;
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  const ipAddress = getClientIp(req);
  let statusCode = 200;
  let logWalletAddress = null;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    statusCode = 405;
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tokenAddress, walletAddress, riskProfile, riskSettings } = parseBody(req);
    const normalizedTokenAddress = normalizeAddress(tokenAddress, "tokenAddress");
    const normalizedWalletAddress = walletAddress ? normalizeAddress(walletAddress, "walletAddress") : null;
    const session = await getSessionFromRequest(req);
    const authenticatedWalletAddress = getAuthenticatedWallet(session, normalizedWalletAddress);
    logWalletAddress = authenticatedWalletAddress || session?.walletAddress || null;

    const rate = checkRateLimit({
      key: session?.walletAddress || ipAddress,
      authenticated: Boolean(session),
    });
    res.setHeader("X-RateLimit-Limit", String(rate.limit));
    res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(rate.resetAt / 1000)));
    if (!rate.allowed) {
      statusCode = 429;
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    const normalizedRiskProfile = normalizeRiskProfile(riskProfile);
    const normalizedRiskSettings = normalizeRiskSettings(riskSettings);

    const rawData = await scan(normalizedTokenAddress);
    const scoreResult = score(rawData.raw, {
      riskProfile: normalizedRiskProfile,
      riskSettings: normalizedRiskSettings,
    });
    const token = extractToken(rawData.raw, normalizedTokenAddress);
    const decision = {
      id: crypto.randomUUID(),
      token: normalizedTokenAddress,
      tokenAddress: normalizedTokenAddress,
      tokenInfo: token,
      walletAddress: authenticatedWalletAddress,
      userContextAuthenticated: Boolean(authenticatedWalletAddress),
      riskProfile: normalizedRiskProfile,
      riskSettings: normalizedRiskSettings,
      thresholds: scoreResult.thresholds,
      score: scoreResult.score,
      riskScore: scoreResult.score,
      decision: scoreResult.decision,
      reasons: scoreResult.reasons,
      breakdown: scoreResult.breakdown,
      timestamp: rawData.timestamp,
      credits: rawData.credits,
    };

    const storedDecision = await addDecision(decision);
    statusCode = 200;
    res.status(200).json(storedDecision);
  } catch (err) {
    statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message || "Scan failed" });
  } finally {
    logRequest({
      path: "/api/scan",
      method: req.method,
      ipAddress,
      walletAddress: logWalletAddress,
      statusCode,
      durationMs: Date.now() - startedAt,
      metadata: {
        rateLimited: statusCode === 429,
      },
    }).catch(() => {});
  }
}
