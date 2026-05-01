import { getDecisions } from "./_store.js";

export default async function handler(req, res) {
  const walletAddress = typeof req.query?.walletAddress === "string" ? req.query.walletAddress : null;
  const limit = req.query?.limit;
  res.status(200).json(await getDecisions({ walletAddress, limit }));
}
