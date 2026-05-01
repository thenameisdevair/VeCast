import { getStartedAt } from "./_store.js";

export default function handler(req, res) {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor((Date.now() - getStartedAt()) / 1000),
  });
}
