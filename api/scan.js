import { scan } from "../src/scanner.js";
import { score } from "../src/scorer.js";
import { addDecision } from "./_memory.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tokenAddress } = parseBody(req);
  if (!tokenAddress) {
    return res.status(400).json({ error: "tokenAddress required" });
  }

  try {
    const rawData = await scan(tokenAddress);
    const scoreResult = score(rawData.raw);
    const decision = {
      token: tokenAddress,
      score: scoreResult.score,
      decision: scoreResult.decision,
      reasons: scoreResult.reasons,
      breakdown: scoreResult.breakdown,
      timestamp: rawData.timestamp,
      credits: rawData.credits,
    };

    addDecision(decision);
    res.status(200).json(decision);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
