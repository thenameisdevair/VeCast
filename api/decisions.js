import { getDecisions, getSession } from "./_store.js";

export default async function handler(req, res) {
  const walletAddress = typeof req.query?.walletAddress === "string" ? req.query.walletAddress : null;
  const limit = req.query?.limit;

  if (walletAddress) {
    const header = req.headers?.authorization || req.headers?.Authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    const session = await getSession(token);
    if (!session || session.walletAddress !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: "Signed wallet session required" });
    }
  }

  res.status(200).json(await getDecisions({ walletAddress, limit }));
}
