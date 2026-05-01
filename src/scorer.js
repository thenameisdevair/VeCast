/**
 * scorer.js — VeCast Token Scoring Engine
 *
 * Scores a token 0-100 across 7 risk dimensions.
 * Lower = safer. Higher = more dangerous.
 *
 * Thresholds:
 *   0-35   → BUY
 *   36-60  → HOLD
 *   61-100 → BLOCK
 */

const PROFILE_THRESHOLDS = {
  conservative: { buy: 25, hold: 50 },
  balanced: { buy: 35, hold: 60 },
  aggressive: { buy: 45, hold: 70 },
};

function resolveThresholds(options = {}) {
  if (options.riskProfile === "custom" && options.riskSettings) {
    const buy = Number(options.riskSettings.maxScoreForBuy);
    const hold = Number(options.riskSettings.maxScoreForHold);
    if (Number.isFinite(buy) && Number.isFinite(hold) && buy >= 0 && buy <= hold && hold <= 100) {
      return { buy, hold };
    }
  }

  return PROFILE_THRESHOLDS[options.riskProfile] || PROFILE_THRESHOLDS.balanced;
}

export function score(raw, options = {}) {
  const reasons = [];
  let totalScore = 0;

  const holderScore      = scoreHolderConcentration(raw.holders, raw.info, reasons);
  const flowScore        = scoreSmartMoneyFlows(raw.flows, reasons);
  const dexScore         = scoreSmartMoneyDex(raw.smartMoneyDex, reasons);
  const ageScore         = scoreTokenAge(raw.info, reasons);
  const distributionScore = scoreHolderDistribution(raw.holders, raw.info, reasons);
  const pnlScore         = scoreMarketProfile(raw.market, reasons);
  const buySellScore     = scoreBuySellRatio(raw.whoBoughtSold, reasons);

  totalScore = holderScore + flowScore + dexScore + ageScore +
               distributionScore + pnlScore + buySellScore;

  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));
  const thresholds = resolveThresholds(options);
  const decision = finalScore <= thresholds.buy ? "BUY" : finalScore <= thresholds.hold ? "HOLD" : "BLOCK";

  return {
    score: finalScore,
    decision,
    thresholds,
    reasons,
    breakdown: {
      holderConcentration: holderScore,
      smartMoneyFlow:      flowScore,
      smartMoneyDex:       dexScore,
      tokenAge:            ageScore,
      holderDistribution:  distributionScore,
      pnlProfile:          pnlScore,
      buySellRatio:        buySellScore,
    },
  };
}

function scoreHolderConcentration(holders, info, reasons) {
  const totalHolders = parseInt(info?.spot_metrics?.total_holders ?? 0);
  if (!holders || !Array.isArray(holders)) {
    if (totalHolders > 100000) {
      reasons.push("Top holder concentration unavailable — broad holder base lowers risk");
      return 5;
    }
    if (totalHolders > 1000) {
      reasons.push("Top holder concentration unavailable — using moderate concentration risk");
      return 10;
    }
    reasons.push("Top holder concentration unavailable — thin holder base raises risk");
    return 15;
  }
  const topHolder = holders[0];
  if (!topHolder) {
    if (totalHolders > 100000) {
      reasons.push("Top holder concentration unavailable — broad holder base lowers risk");
      return 5;
    }
    if (totalHolders > 1000) {
      reasons.push("Top holder concentration unavailable — using moderate concentration risk");
      return 10;
    }
    reasons.push("Top holder concentration unavailable — thin holder base raises risk");
    return 15;
  }
  let pct = parseFloat(
    topHolder.percentage ??
    topHolder.pct ??
    topHolder.ownership_percentage ??
    0
  );
  if (pct > 0 && pct <= 1) pct *= 100;
  if (pct >= 50) {
    reasons.push(`⚠️  Top holder owns ${pct.toFixed(1)}% — extreme concentration (floor 65)`);
    return 65;
  }
  if (pct >= 30) { reasons.push(`⚠️  Top holder owns ${pct.toFixed(1)}% — high concentration`); return 18; }
  if (pct >= 15) { reasons.push(`Top holder owns ${pct.toFixed(1)}% — moderate concentration`); return 10; }
  reasons.push(`Top holder owns ${pct.toFixed(1)}% — healthy distribution`);
  return 3;
}

function scoreSmartMoneyFlows(flows, reasons) {
  if (!flows) { reasons.push("Flow data unavailable — defaulting to 8"); return 8; }
  const rows = Array.isArray(flows) ? flows : [flows];
  const netFlow = rows.reduce((sum, row) => {
    const direct = row.netFlow ?? row.net_flow ?? row.net_flow_usd;
    if (direct !== undefined) return sum + parseFloat(direct || 0);

    const inflow = parseFloat(
      row.inflow ??
      row.inflow_usd ??
      row.total_inflows_usd ??
      row.total_inflows_count ??
      0
    );
    const outflow = parseFloat(
      row.outflow ??
      row.outflow_usd ??
      row.total_outflows_usd ??
      row.total_outflows_count ??
      0
    );
    return sum + inflow + outflow;
  }, 0);
  if (netFlow > 10000000) { reasons.push(`✅ Exceptional net inflow: $${netFlow.toLocaleString()}`); return 0; }
  if (netFlow > 1000000)  { reasons.push(`✅ Very strong net inflow: $${netFlow.toLocaleString()}`); return 1; }
  if (netFlow > 50000)    { reasons.push(`✅ Strong net inflow: $${netFlow.toLocaleString()}`); return 2; }
  if (netFlow > 0)        { reasons.push(`Smart money net inflow: $${netFlow.toLocaleString()}`); return 5; }
  if (netFlow < -1000000) { reasons.push(`🚨 Severe net outflow: $${Math.abs(netFlow).toLocaleString()}`); return 22; }
  if (netFlow < -50000)   { reasons.push(`🚨 Heavy net outflow: $${Math.abs(netFlow).toLocaleString()}`); return 20; }
  reasons.push(`Smart money net outflow: $${Math.abs(netFlow).toLocaleString()}`);
  return 12;
}

function scoreSmartMoneyDex(dex, reasons) {
  if (!dex) { reasons.push("DEX data unavailable — defaulting to 8"); return 8; }
  const rows = Array.isArray(dex) ? dex : [dex];
  const volume = rows.reduce((sum, row) => sum + parseFloat(
    row.volume ??
    row.total_volume ??
    row.totalVolume ??
    row.trade_volume_usd ??
    row.value_usd ??
    0
  ), 0);
  const tradeCount = parseInt(dex.count ?? dex.tradeCount ?? dex.trades ?? rows.length);
  if (volume > 100000000 || tradeCount > 100000) {
    reasons.push(`✅ Exceptional DEX activity — $${volume.toLocaleString()} / ${tradeCount} trades`); return 0;
  }
  if (volume > 10000000 || tradeCount > 10000) {
    reasons.push(`✅ Very high DEX activity — $${volume.toLocaleString()} / ${tradeCount} trades`); return 1;
  }
  if (volume > 500000 || tradeCount > 100) {
    reasons.push(`✅ High DEX activity — $${volume.toLocaleString()} / ${tradeCount} trades`); return 2;
  }
  if (volume > 100000 || tradeCount > 20) {
    reasons.push(`Moderate SM DEX activity — $${volume.toLocaleString()} / ${tradeCount} trades`); return 6;
  }
  reasons.push(`Low SM DEX activity — $${volume.toLocaleString()} / ${tradeCount} trades`);
  return 12;
}

function scoreTokenAge(info, reasons) {
  if (!info) { reasons.push("Token info unavailable — defaulting to 8"); return 8; }
  const deployedAt =
    info.deployedAt ??
    info.deployed_at ??
    info.createdAt ??
    info.token_details?.token_deployment_date ??
    null;
  if (!deployedAt) { reasons.push("Token age unknown — adding moderate risk"); return 10; }
  const ageDays = (Date.now() - new Date(deployedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 1)  { reasons.push(`🚨 Token is < 1 day old — extreme age risk`); return 18; }
  if (ageDays < 7)  { reasons.push(`⚠️  Token is ${ageDays.toFixed(0)} days old — high age risk`); return 13; }
  if (ageDays < 30) { reasons.push(`Token is ${ageDays.toFixed(0)} days old — moderate`); return 7; }
  reasons.push(`Token is ${ageDays.toFixed(0)} days old — established`);
  return 2;
}

function scoreHolderDistribution(holders, info, reasons) {
  if (!holders || !Array.isArray(holders)) {
    reasons.push("Holder distribution unavailable — defaulting to 8"); return 8;
  }
  const count = parseInt(info?.spot_metrics?.total_holders ?? holders.length);
  if (count < 50)     { reasons.push(`🚨 Very few holders: ${count} — rug risk`); return 15; }
  if (count < 200)    { reasons.push(`⚠️  Holder count: ${count} — limited distribution`); return 8; }
  if (count < 1000)   { reasons.push(`Holder count: ${count} — moderate distribution`); return 5; }
  if (count < 100000) { reasons.push(`✅ Holder count: ${count} — strong distribution`); return 2; }
  reasons.push(`✅ Holder count: ${count} — blue-chip distribution`);
  return 1;
}

function scoreMarketProfile(market, reasons) {
  if (!market) { reasons.push("Market profile unavailable — adding moderate risk"); return 8; }
  const liquidity = parseFloat(market.liquidityUsd ?? 0);
  const marketCap = parseFloat(market.marketCapUsd ?? 0);
  const ratio = marketCap > 0 ? liquidity / marketCap : 0;

  if (liquidity < 5000) {
    reasons.push(`🚨 Very thin liquidity: $${liquidity.toLocaleString()} — high exit risk`);
    return 16;
  }
  if (liquidity < 25000) {
    reasons.push(`⚠️ Thin liquidity: $${liquidity.toLocaleString()} — slippage risk`);
    return 12;
  }
  if (liquidity < 100000) {
    reasons.push(`Liquidity is modest: $${liquidity.toLocaleString()}`);
    return 8;
  }
  if (ratio > 0 && ratio < 0.02) {
    reasons.push(`⚠️ Liquidity is low versus market cap: ${(ratio * 100).toFixed(1)}%`);
    return 9;
  }
  reasons.push(`✅ Deep liquidity: $${liquidity.toLocaleString()}`);
  return 2;
}

function scoreBuySellRatio(whoBoughtSold, reasons) {
  if (!whoBoughtSold) { reasons.push("Buy/sell data unavailable — defaulting to 8"); return 8; }
  const rows = Array.isArray(whoBoughtSold) ? whoBoughtSold : [whoBoughtSold];
  const buyers = parseInt(
    whoBoughtSold.buyers ??
    whoBoughtSold.buyCount ??
    whoBoughtSold.bought ??
    rows.filter((row) => parseFloat(row.bought_volume_usd ?? row.bought_token_volume ?? 0) > 0).length
  );
  const sellers = parseInt(
    whoBoughtSold.sellers ??
    whoBoughtSold.sellCount ??
    whoBoughtSold.sold ??
    rows.filter((row) => parseFloat(row.sold_volume_usd ?? row.sold_token_volume ?? 0) > 0).length
  );
  if (buyers === 0 && sellers === 0) { reasons.push("No buy/sell activity detected"); return 10; }
  const ratio = sellers === 0 ? buyers : buyers / sellers;
  if (ratio >= 2)    { reasons.push(`✅ Strong buy pressure — ${buyers} buyers vs ${sellers} sellers`); return 2; }
  if (ratio >= 1.2)  { reasons.push(`✅ Clear buy pressure — ${buyers} buyers vs ${sellers} sellers`); return 4; }
  if (ratio >= 1)    { reasons.push(`Slight buy pressure — ${buyers} buyers vs ${sellers} sellers`); return 6; }
  if (ratio >= 0.75) { reasons.push(`Mild sell pressure — ${buyers} buyers vs ${sellers} sellers`); return 10; }
  reasons.push(`🚨 Sell pressure dominant — ${buyers} buyers vs ${sellers} sellers`);
  return 14;
}
