import { getAddress, isAddress } from "ethers";
import { createAuthChallenge } from "../_store.js";

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

  const { walletAddress } = parseBody(req);
  if (!isAddress(walletAddress || "")) {
    return res.status(400).json({ error: "walletAddress must be a valid EVM address" });
  }

  const normalizedWallet = getAddress(walletAddress);
  res.status(200).json(await createAuthChallenge(normalizedWallet));
}
