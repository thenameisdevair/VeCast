/**
 * logger.js — VeCast structured logging
 * Writes all decisions + tx hashes to logs/decisions.json (append-only)
 * Formats terminal output with chalk
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.resolve(__dirname, "../logs/decisions.json");

function ensureLog() {
  if (!fs.existsSync(LOG_PATH)) {
    fs.writeFileSync(LOG_PATH, "[]", "utf8");
  }
}

function appendLog(entry) {
  ensureLog();
  const raw = fs.readFileSync(LOG_PATH, "utf8");
  const log = JSON.parse(raw);
  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

export function logNansenCall(command, status, credits = null) {
  const ts = new Date().toISOString();
  const creditStr = credits !== null ? chalk.yellow(` [${credits} credits]`) : "";
  const statusStr = status === 200 ? chalk.green(`[${status}]`) : chalk.red(`[${status}]`);
  console.log(chalk.dim(ts) + ` 📡 Nansen ${statusStr} ${chalk.cyan(command)}${creditStr}`);
}

export function logDecision(decision) {
  const entry = {
    ...decision,
    timestamp: decision.timestamp || new Date().toISOString(),
  };
  appendLog(entry);

  const badge =
    decision.decision === "BUY"
      ? chalk.bgGreen.black(" BUY ")
      : decision.decision === "HOLD"
      ? chalk.bgYellow.black(" HOLD ")
      : chalk.bgRed.white(" BLOCK ");

  console.log("\n" + chalk.bold("━━━ VeCast Decision ━━━"));
  console.log(`Token   : ${chalk.cyan(decision.token)}`);
  console.log(`Score   : ${chalk.bold(decision.score)} / 100`);
  console.log(`Decision: ${badge}`);
  console.log("Reasons :");
  (decision.reasons || []).forEach((r) => console.log(`  • ${r}`));
  if (decision.txHash) {
    console.log(`Tx Hash : ${chalk.green(decision.txHash)}`);
    console.log(`Basescan: ${chalk.underline(`https://basescan.org/tx/${decision.txHash}`)}`);
  }
  console.log(chalk.bold("━━━━━━━━━━━━━━━━━━━━━━") + "\n");
}

export function logTx(tx) {
  const entry = { type: "TX", ...tx, timestamp: tx.timestamp || new Date().toISOString() };
  appendLog(entry);
  console.log(chalk.green.bold(`\n✅ TX EXECUTED`));
  console.log(`Hash    : ${chalk.green(tx.hash)}`);
  console.log(`Token   : ${chalk.cyan(tx.token)}`);
  console.log(`Amount  : ${tx.amountEth} ETH`);
  console.log(`Score   : ${tx.score}`);
  console.log(`Basescan: ${chalk.underline(`https://basescan.org/tx/${tx.hash}`)}\n`);
}

export function logAcp(event, data = {}) {
  const ts = new Date().toISOString();
  console.log(chalk.magenta(`[ACP] ${ts} — ${event}`), data);
}

export function readLog() {
  ensureLog();
  const raw = fs.readFileSync(LOG_PATH, "utf8");
  return JSON.parse(raw);
}
