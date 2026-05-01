import { getDecisionById } from "../_store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query?.id;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "scan id required" });
  }

  const decision = await getDecisionById(id);
  if (!decision) {
    return res.status(404).json({ error: "Scan not found" });
  }

  res.status(200).json(decision);
}
