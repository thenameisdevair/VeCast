/**
 * agent.js — VeCast Core Agent Loop
 *
 * Orchestrates: scan → score → decide → execute → log
 * No human in the loop. Agent decides and acts autonomously.
 */

import { scan }                    from "./scanner.js";
import { score }                   from "./scorer.js";
import { executeBuy, checkBalance } from "./executor.js";
import { logDecision }             from "./logger.js";
import chalk                       from "chalk";
import ora                         from "ora";

export async function runScan(tokenAddress) {
  const spinner = ora(`Scanning ${tokenAddress}...`).start();

  try {
    spinner.text = "Pulling Nansen intelligence...";
    const rawData = await scan(tokenAddress);

    spinner.text = "Running scoring engine...";
    const scoreResult = score(rawData.raw);

    spinner.succeed("Scan complete");

    const decision = {
      token:     tokenAddress,
      score:     scoreResult.score,
      decision:  scoreResult.decision,
      reasons:   scoreResult.reasons,
      breakdown: scoreResult.breakdown,
      timestamp: rawData.timestamp,
      credits:   rawData.credits,
    };

    logDecision(decision);
    return decision;

  } catch (err) {
    spinner.fail("Scan failed");
    console.error(chalk.red(`[agent] Scan error: ${err.message}`));
    throw err;
  }
}

export async function runTrade(tokenAddress) {
  console.log(chalk.bold("\n[agent] Initiating autonomous trade evaluation...\n"));

  const decision = await runScan(tokenAddress);

  if (decision.decision !== "BUY") {
    console.log(chalk.yellow(
      `[agent] Decision is ${decision.decision} (score: ${decision.score}). No trade executed.`
    ));
    return decision;
  }

  console.log(chalk.green.bold(
    `[agent] BUY signal confirmed (score: ${decision.score}). Executing autonomously...`
  ));

  const txData = await executeBuy(tokenAddress, decision.score);

  return {
    ...decision,
    txHash: txData.hash,
    block:  txData.block,
  };
}

export async function watchLoop(tokens, interval = 60_000) {
  if (!tokens || tokens.length === 0) {
    console.log(chalk.red("[agent] No tokens to watch. Pass at least one token address."));
    return;
  }

  console.log(chalk.bold.cyan("\n[agent] VeCast Watch Mode ACTIVE"));
  console.log(`[agent] Watching : ${tokens.join(", ")}`);
  console.log(`[agent] Interval : ${interval / 1000}s\n`);

  try {
    const { address, balanceEth } = await checkBalance();
    console.log(`[agent] Wallet  : ${address}`);
    console.log(`[agent] Balance : ${balanceEth} ETH\n`);
  } catch (err) {
    console.log(chalk.yellow(`[agent] Balance check failed: ${err.message}`));
  }

  let iteration = 0;

  const loop = async () => {
    iteration++;
    const token = tokens[iteration % tokens.length];
    console.log(chalk.dim(`\n[agent] Iteration ${iteration} — evaluating ${token}`));
    try {
      await runTrade(token);
    } catch (err) {
      console.error(chalk.red(`[agent] Iteration error: ${err.message}`));
    }
    setTimeout(loop, interval);
  };

  await loop();
}
