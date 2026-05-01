/**
 * scanner.js — VeCast Nansen Intelligence Layer
 *
 * Executes all 7 required nansen-cli calls for a token scan.
 * CRITICAL: Nansen wraps responses as { data: { data: X } }
 * Always unwrap two levels: parsed?.data?.data
 */

import { execSync } from "child_process";
import { logNansenCall } from "./logger.js";

function runNansen(command) {
  const fullCmd = `${command} --output json`;
  try {
    const stdout = execSync(fullCmd, {
      env: { ...process.env, NANSEN_API_KEY: process.env.NANSEN_API_KEY },
      timeout: 30000,
      encoding: "utf8",
    });
    const parsed = JSON.parse(stdout.trim());
    const innerData = parsed?.data?.data ?? parsed?.data ?? parsed;
    const credits = parsed?.meta?.credits ?? parsed?.credits ?? null;
    logNansenCall(command, 200, credits);
    return { data: innerData, credits, status: 200 };
  } catch (err) {
    const stderr = err.stderr?.toString() || "";
    let parsed = null;
    try { parsed = JSON.parse(err.stdout?.toString() || "{}"); } catch (_) {}
    const innerData = parsed?.data?.data ?? parsed?.data ?? null;
    const credits = parsed?.meta?.credits ?? null;
    logNansenCall(command, err.status || 1, credits);
    console.error(`[scanner] Error on: ${command}\n${stderr}`);
    return { data: innerData, credits, status: err.status || 1, error: stderr };
  }
}

export async function scan(tokenAddress) {
  console.log(`\n[scanner] Starting scan: ${tokenAddress}\n`);
  const addr = tokenAddress.toLowerCase();

  const infoRes         = runNansen(`nansen-cli token info --token ${addr}`);
  const holdersRes      = runNansen(`nansen-cli token holders --token ${addr}`);
  const flowsRes        = runNansen(`nansen-cli token flows --token ${addr}`);
  const whoBoughtSoldRes = runNansen(`nansen-cli token who-bought-sold --token ${addr}`);
  const smartMoneyDexRes = runNansen(`nansen-cli smart-money dex-trades --token ${addr}`);
  const pnlRes          = runNansen(`nansen-cli profiler pnl-summary ${addr}`);
  const txHistoryRes    = runNansen(`nansen-cli profiler transactions ${addr}`);

  return {
    tokenAddress: addr,
    timestamp: new Date().toISOString(),
    raw: {
      info:          infoRes.data,
      holders:       holdersRes.data,
      flows:         flowsRes.data,
      whoBoughtSold: whoBoughtSoldRes.data,
      smartMoneyDex: smartMoneyDexRes.data,
      pnl:           pnlRes.data,
      txHistory:     txHistoryRes.data,
    },
    credits: [
      infoRes.credits,
      holdersRes.credits,
      flowsRes.credits,
      whoBoughtSoldRes.credits,
      smartMoneyDexRes.credits,
      pnlRes.credits,
      txHistoryRes.credits,
    ].filter(Boolean).reduce((a, b) => a + b, 0),
    errors: [
      infoRes.error,
      holdersRes.error,
      flowsRes.error,
      whoBoughtSoldRes.error,
      smartMoneyDexRes.error,
      pnlRes.error,
      txHistoryRes.error,
    ].filter(Boolean),
  };
}
