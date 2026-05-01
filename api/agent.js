import { checkBalance } from "../src/executor.js";
import { getStartedAt } from "./_memory.js";

export default async function handler(req, res) {
  try {
    const { address, balanceEth } = await checkBalance();
    res.status(200).json({
      address,
      balanceEth,
      uptime: Math.floor((Date.now() - getStartedAt()) / 1000),
      network: "Base Mainnet",
      chainId: 8453,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
