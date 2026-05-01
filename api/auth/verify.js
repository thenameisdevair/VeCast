import { getAddress, isAddress, verifyMessage } from "ethers";
import { consumeAuthChallenge, createSession } from "../_store.js";

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

  const { walletAddress, nonce, message, signature } = parseBody(req);
  if (!isAddress(walletAddress || "")) {
    return res.status(400).json({ error: "walletAddress must be a valid EVM address" });
  }
  if (!nonce || !message || !signature) {
    return res.status(400).json({ error: "nonce, message, and signature required" });
  }

  const normalizedWallet = getAddress(walletAddress);
  let recoveredAddress;
  try {
    recoveredAddress = getAddress(verifyMessage(message, signature));
  } catch {
    return res.status(401).json({ error: "Invalid signature" });
  }
  if (recoveredAddress !== normalizedWallet) {
    return res.status(401).json({ error: "Signature does not match wallet" });
  }

  if (!message.includes(`Wallet: ${normalizedWallet}`) || !message.includes(`Nonce: ${nonce}`)) {
    return res.status(400).json({ error: "Invalid sign-in message" });
  }

  const validChallenge = await consumeAuthChallenge({
    walletAddress: normalizedWallet,
    nonce,
    message,
  });

  if (!validChallenge) {
    return res.status(401).json({ error: "Sign-in challenge expired or already used" });
  }

  res.status(200).json(await createSession(normalizedWallet));
}
