import { getStartedAt } from "./_memory.js";

export default function handler(req, res) {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor((Date.now() - getStartedAt()) / 1000),
  });
}
