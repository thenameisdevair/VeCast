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

export function score(raw) {
  const reasons = [];
  let totalScore = 0;

  const holderScore      = scoreHolderConcentration(raw.holders, reasons);
  const flowScore        = scoreSmartMoneyFlows(raw.flows, reasons);
  const dexScore         = scoreSmartMoneyDex(raw.smartMoneyDex, reasons);
  const ageScore         = scoreTokenAge(raw.info, reasons);
  const distributionScore = scoreHolderDistribution(raw.holders, reasons);
  const pnlScore         = scorePnl(raw.pnl, reasons);
  const buySellScore     = scoreBuySellRatio(raw.whoBoughtSold, reasons);

  totalScore = holderScore + flowScore + dexScore + ageScore +
               distributionScore + pnlScore + buySellScore;

  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));
  const decision = finalScore <= 35 ? "BUY" : finalScore <= 60 ? "HOLD" : "BLOCK";

  return {
    score: finalScore,
    decision,
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

function scoreHolderConcentration(holders, reasons) {
  if (!holders || !Array.isArray(holders)) {
    reasons.push("Holder data unavailable — defaulting concentration risk to 10");
    return 10;
  }
  const topHolder = holders[0];
  if (!topHolder) { reasons.push("No holder data — defaulting to 10"); return 10; }
  const pct = parseFloat(topHolder.percentage ?? topHolder.pct ?? 0);
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
  const netFlow = parseFloat(flows.netFlow ?? flows.net_flow ?? flows.inflow ?? 0)
                - parseFloat(flows.outflow ?? 0);
  if (netFlow > 50000)  { reasons.push(`✅ Strong smart money inflow: $${netFlow.toLocaleString()}`); return 2; }
  if (netFlow > 0)      { reasons.push(`Smart money net inflow: $${netFlow.toLocaleString()}`); return 5; }
  if (netFlow < -50000) { reasons.push(`🚨 Heavy smart money outflow: $${Math.abs(netFlow).toLocaleString()}`); return 20; }
  reasons.push(`Smart money net outflow: $${Math.abs(netFlow).toLocaleString()}`);
  return 12;
}

function scoreSmartMoneyDex(dex, reasons) {
  if (!dex) { reasons.push("DEX data unavailable — defaulting to 8"); return 8; }
  const volume     = parseFloat(dex.volume ?? dex.total_volume ?? dex.totalVolume ?? 0);
  const tradeCount = parseInt(dex.count ?? dex.tradeCount ?? dex.trades ?? 0);
  if (volume > 500000 || tradeCount > 100) {
    reasons.push(`✅ High SM DEX activity — $${volume.toLocaleString()} / ${tradeCount} trades`); return 2;
  }
  if (volume > 100000 || tradeCount > 20) {
    reasons.push(`Moderate SM DEX activity — $${volume.toLocaleString()} / ${tradeCount} trades`); return 6;
  }
  reasons.push(`Low SM DEX activity — $${volume.toLocaleString()} / ${tradeCount} trades`);
  return 12;
}

function scoreTokenAge(info, reasons) {
  if (!info) { reasons.push("Token info unavailable — defaulting to 8"); return 8; }
  const deployedAt = info.deployedAt ?? info.deployed_at ?? info.createdAt ?? null;
  if (!deployedAt) { reasons.push("Token age unknown — adding moderate risk"); return 10; }
  const ageDays = (Date.now() - new Date(deployedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 1)  { reasons.push(`🚨 Token is < 1 day old — extreme age risk`); return 18; }
  if (ageDays < 7)  { reasons.push(`⚠️  Token is ${ageDays.toFixed(0)} days old — high age risk`); return 13; }
  if (ageDays < 30) { reasons.push(`Token is ${ageDays.toFixed(0)} days old — moderate`); return 7; }
  reasons.push(`Token is ${ageDays.toFixed(0)} days old — established`);
  return 2;
}

function scoreHolderDistribution(holders, reasons) {
  if (!holders || !Array.isArray(holders)) {
    reasons.push("Holder distribution unavailable — defaulting to 8"); return 8;
  }
  const count = holders.length;
  if (count < 50)   { reasons.push(`🚨 Very few holders: ${count} — rug risk`); return 15; }
  if (count < 200)  { reasons.push(`⚠️  Holder count: ${count} — limited distribution`); return 8; }
  if (count < 1000) { reasons.push(`Holder count: ${count} — moderate distribution`); return 5; }
  reasons.push(`✅ Holder count: ${count} — strong distribution`);
  return 1;
}

function scorePnl(pnl, reasons) {
  if (!pnl) { reasons.push("PnL data unavailable — defaulting to 6"); return 6; }
  const realized   = parseFloat(pnl.realizedPnl ?? pnl.realized_pnl ?? pnl.pnl ?? 0);
  const unrealized = parseFloat(pnl.unrealizedPnl ?? pnl.unrealized_pnl ?? 0);
  const totalPnl   = realized + unrealized;
  if (totalPnl > 0)      { reasons.push(`✅ Top wallet PnL positive: $${totalPnl.toLocaleString()}`); return 2; }
  if (totalPnl < -10000) { reasons.push(`⚠️  Top wallet PnL deeply negative: $${totalPnl.toLocaleString()}`); return 14; }
  reasons.push(`Top wallet PnL neutral: $${totalPnl.toLocaleString()}`);
  return 7;
}

function scoreBuySellRatio(whoBoughtSold, reasons) {
  if (!whoBoughtSold) { reasons.push("Buy/sell data unavailable — defaulting to 8"); return 8; }
  const buyers  = parseInt(whoBoughtSold.buyers ?? whoBoughtSold.buyCount ?? whoBoughtSold.bought ?? 0);
  const sellers = parseInt(whoBoughtSold.sellers ?? whoBoughtSold.sellCount ?? whoBoughtSold.sold ?? 0);
  if (buyers === 0 && sellers === 0) { reasons.push("No buy/sell activity detected"); return 10; }
  const ratio = sellers === 0 ? buyers : buyers / sellers;
  if (ratio >= 2) { reasons.push(`✅ Strong buy pressure — ${buyers} buyers vs ${sellers} sellers`); return 2; }
  if (ratio >= 1) { reasons.push(`Slight buy pressure — ${buyers} buyers vs ${sellers} sellers`); return 6; }
  reasons.push(`🚨 Sell pressure dominant — ${buyers} buyers vs ${sellers} sellers`);
  return 14;
}
