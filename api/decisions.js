import { getDecisions } from "./_memory.js";

export default function handler(req, res) {
  res.status(200).json(getDecisions());
}
