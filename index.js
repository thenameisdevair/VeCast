#!/usr/bin/env node
/**
 * index.js — VeCast CLI
 * Autonomous AI Economic Agent on Base mainnet
 */

import "dotenv/config";
import yargs       from "yargs";
import { hideBin } from "yargs/helpers";
import chalk       from "chalk";
import { runScan, runTrade, watchLoop } from "./src/agent.js";
import { startAcpProvider }            from "./src/acp.js";
import { readLog }                     from "./src/logger.js";
import { checkBalance }                from "./src/executor.js";

console.log(chalk.bold.cyan("\n  ██╗   ██╗███████╗ ██████╗ █████╗ ███████╗████████╗"));
console.log(chalk.bold.cyan("  ██║   ██║██╔════╝██╔════╝██╔══██╗██╔════╝╚══██╔══╝"));
console.log(chalk.bold.cyan("  ██║   ██║█████╗  ██║     ███████║███████╗   ██║   "));
console.log(chalk.bold.cyan("  ╚██╗ ██╔╝██╔══╝  ██║     ██╔══██║╚════██║   ██║   "));
console.log(chalk.bold.cyan("   ╚████╔╝ ███████╗╚██████╗██║  ██║███████║   ██║   "));
console.log(chalk.bold.cyan("    ╚═══╝  ╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝  "));
console.log(chalk.dim("  Autonomous AI Economic Agent — Base Mainnet\n"));

yargs(hideBin(process.argv))
  .scriptName("vecast")
  .usage("Usage: $0 <command> [options]")

  // vecast scan <tokenAddress>
  .command(
    "scan <tokenAddress>",
    "Run Nansen intelligence scan on a token. Returns decision. No trade.",
    (yargs) => yargs.positional("tokenAddress", {
      describe: "EVM token contract address",
      type: "string",
    }),
    async ({ tokenAddress }) => {
      try {
        await runScan(tokenAddress);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
  )

  // vecast trade <tokenAddress>
  .command(
    "trade <tokenAddress>",
    "Run scan + execute swap autonomously if decision is BUY.",
    (yargs) => yargs.positional("tokenAddress", {
      describe: "EVM token contract address",
      type: "string",
    }),
    async ({ tokenAddress }) => {
      try {
        const result = await runTrade(tokenAddress);
        if (result.txHash) {
          console.log(chalk.green.bold(`\n✅ Tx: ${result.txHash}`));
          console.log(chalk.underline(`https://basescan.org/tx/${result.txHash}`));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
  )

  // vecast watch --tokens <a,b,c> [--interval 60]
  .command(
    "watch",
    "Run the autonomous agent loop continuously.",
    (yargs) => yargs
      .option("tokens", {
        alias: "t",
        describe: "Comma-separated token addresses to watch",
        type: "string",
        demandOption: true,
      })
      .option("interval", {
        alias: "i",
        describe: "Poll interval in seconds",
        type: "number",
        default: 60,
      }),
    async ({ tokens, interval }) => {
      const tokenList = tokens.split(",").map((t) => t.trim());
      try {
        await watchLoop(tokenList, interval * 1000);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
  )

  // vecast serve
  .command(
    "serve",
    "Start VeCast as an ACP provider — accepts jobs, delivers scans, earns USDC.",
    () => {},
    async () => {
      try {
        await startAcpProvider();
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
  )

  // vecast log [--tail 20]
  .command(
    "log",
    "Display VeCast decision and transaction history.",
    (yargs) => yargs.option("tail", {
      alias: "n",
      describe: "Show last N entries",
      type: "number",
      default: 20,
    }),
    ({ tail }) => {
      const entries = readLog();
      const slice   = entries.slice(-tail);

      if (slice.length === 0) {
        console.log(chalk.dim("No decisions logged yet."));
        return;
      }

      console.log(chalk.bold(`\nLast ${slice.length} decisions:\n`));
      slice.forEach((entry, i) => {
        const badge =
          entry.decision === "BUY"   ? chalk.bgGreen.black(" BUY ")   :
          entry.decision === "HOLD"  ? chalk.bgYellow.black(" HOLD ")  :
          entry.decision === "BLOCK" ? chalk.bgRed.white(" BLOCK ")    :
          chalk.bgBlue.white(` ${entry.type || "EVENT"} `);

        console.log(
          `${chalk.dim(i + 1 + ".")} ${badge} ` +
          `${chalk.cyan(entry.token || "-")} ` +
          `score:${chalk.bold(entry.score || "-")} ` +
          `${chalk.dim(entry.timestamp)}`
        );
        if (entry.txHash) {
          console.log(`   ${chalk.green("↳ tx:")} ${chalk.underline("https://basescan.org/tx/" + entry.txHash)}`);
        }
      });
      console.log("");
    }
  )

  // vecast balance
  .command(
    "balance",
    "Check agent wallet ETH balance on Base.",
    () => {},
    async () => {
      try {
        const { address, balanceEth } = await checkBalance();
        console.log(`Address : ${chalk.cyan(address)}`);
        console.log(`Balance : ${chalk.green(balanceEth)} ETH`);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
  )

  .demandCommand(1, chalk.red("Please provide a command. Run vecast --help for usage."))
  .help()
  .alias("h", "help")
  .version("1.0.0")
  .parse();
