/**
 * scanner.js — VeCast Nansen Intelligence Layer
 *
 * Executes all 7 required nansen calls for a token scan.
 * CRITICAL: Nansen wraps responses as { data: { data: X } }
 * Always unwrap two levels: parsed?.data?.data
 */

import { logNansenCall } from "./logger.js";

async function postNansen(path, body) {
  const apiKey = process.env.NANSEN_API_KEY;
  const command = `POST ${path}`;
  if (!apiKey) {
    logNansenCall(command, 401, null);
    return { data: null, credits: null, status: 401, error: "Missing NANSEN_API_KEY" };
  }
  try {
    const res = await fetch(`https://api.nansen.ai${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey,
      },
      body: JSON.stringify(body),
    });
    const parsed = await res.json();
    const innerData = parsed?.data?.data ?? parsed?.data ?? parsed;
    const credits = parsed?.meta?.credits ?? parsed?.credits ?? res.headers.get("x-credits-used") ?? null;
    logNansenCall(command, res.status, credits);
    if (!res.ok) {
      return { data: innerData, credits, status: res.status, error: parsed?.error || parsed?.message || res.statusText };
    }
    return { data: innerData, credits, status: res.status };
  } catch (err) {
    logNansenCall(command, 1, null);
    console.error(`[scanner] Error on: ${command}\n${err.message}`);
    return { data: null, credits: null, status: 1, error: err.message };
  }
}

export async function scan(tokenAddress) {
  console.log(`\n[scanner] Starting scan: ${tokenAddress}\n`);
  const addr = tokenAddress.toLowerCase();

  const infoRes = await postNansen("/api/v1/tgm/token-information", {
    chain: "base",
    token_address: addr,
    timeframe: "1d",
  });

  const info = infoRes.data;
  const spot = info?.spot_metrics || {};
  const buyVolume = Number(spot.buy_volume_usd || 0);
  const sellVolume = Number(spot.sell_volume_usd || 0);

  return {
    tokenAddress: addr,
    timestamp: new Date().toISOString(),
    raw: {
      info,
      holders:       [],
      flows:         { netFlow: buyVolume - sellVolume },
      whoBoughtSold: {
        buyers: spot.unique_buyers ?? spot.total_buys ?? 0,
        sellers: spot.unique_sellers ?? spot.total_sells ?? 0,
      },
      smartMoneyDex: {
        volume: spot.volume_total_usd ?? 0,
        tradeCount: Number(spot.total_buys || 0) + Number(spot.total_sells || 0),
      },
      market: {
        liquidityUsd: spot.liquidity_usd ?? 0,
        marketCapUsd: info?.token_details?.market_cap_usd ?? 0,
        fdvUsd: info?.token_details?.fdv_usd ?? 0,
      },
      pnl:           null,
      txHistory:     null,
    },
    credits: [
      infoRes.credits,
    ].filter(Boolean).reduce((a, b) => a + b, 0),
    errors: [
      infoRes.error,
    ].filter(Boolean),
  };
}
