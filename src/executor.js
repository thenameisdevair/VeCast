/**
 * executor.js — VeCast On-Chain Execution Layer
 *
 * Executes autonomous ETH → token swaps from the agent's
 * EconomyOS wallet on Base mainnet via Uniswap V3.
 * Hard ceiling: never exceeds MAX_SPEND_ETH per trade.
 * No human approval. Agent decides and executes autonomously.
 */

import { ethers } from "ethers";
import { logTx } from "./logger.js";

const UNISWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
const WETH_BASE      = "0x4200000000000000000000000000000000000006";

const ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",           type: "address" },
          { name: "tokenOut",          type: "address" },
          { name: "fee",               type: "uint24"  },
          { name: "recipient",         type: "address" },
          { name: "amountIn",          type: "uint256" },
          { name: "amountOutMinimum",  type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
];

export async function executeBuy(tokenAddress, score) {
  const privateKey  = process.env.AGENT_PRIVATE_KEY;
  const rpcUrl      = process.env.RPC_URL;
  const maxSpendEth = process.env.MAX_SPEND_ETH || "0.001";
  const agentWallet = process.env.AGENT_WALLET_ADDRESS;

  if (!privateKey || !rpcUrl || !agentWallet) {
    throw new Error(
      "[executor] Missing AGENT_PRIVATE_KEY, RPC_URL, or AGENT_WALLET_ADDRESS in .env"
    );
  }

  const provider  = new ethers.JsonRpcProvider(rpcUrl);
  const signer    = new ethers.Wallet(privateKey, provider);
  const balance   = await provider.getBalance(signer.address);
  const spendWei  = ethers.parseEther(maxSpendEth);
  const gasBuffer = ethers.parseEther("0.0005");

  if (balance < spendWei + gasBuffer) {
    throw new Error(
      `[executor] Insufficient balance. Have: ${ethers.formatEther(balance)} ETH, ` +
      `need: ${(parseFloat(maxSpendEth) + 0.0005).toFixed(4)} ETH`
    );
  }

  const router = new ethers.Contract(UNISWAP_ROUTER, ROUTER_ABI, signer);

  const params = {
    tokenIn:           WETH_BASE,
    tokenOut:          tokenAddress,
    fee:               3000,
    recipient:         signer.address,
    amountIn:          spendWei,
    amountOutMinimum:  0n,
    sqrtPriceLimitX96: 0n,
  };

  console.log(`\n[executor] Swapping ${maxSpendEth} ETH → ${tokenAddress}`);
  console.log(`[executor] Wallet: ${signer.address}`);

  const tx      = await router.exactInputSingle(params, { value: spendWei, gasLimit: 300_000n });
  console.log(`[executor] Tx submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[executor] Confirmed — block ${receipt.blockNumber}`);

  const txData = {
    hash:      tx.hash,
    token:     tokenAddress,
    amountEth: maxSpendEth,
    score,
    timestamp: new Date().toISOString(),
    block:     receipt.blockNumber,
  };

  logTx(txData);
  return txData;
}

export async function checkBalance() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  const rpcUrl     = process.env.RPC_URL;

  if (!privateKey || !rpcUrl) {
    throw new Error("[executor] Missing AGENT_PRIVATE_KEY or RPC_URL in .env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(privateKey, provider);
  const balance  = await provider.getBalance(signer.address);

  return {
    address:    signer.address,
    balanceEth: ethers.formatEther(balance),
  };
}
