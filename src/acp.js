/**
 * acp.js — VeCast ACP Provider Mode
 *
 * Registers VeCast as a Token Intelligence Scan provider on ACP.
 * Accepts jobs from other agents, delivers scan reports, earns USDC.
 *
 * Ref: https://os.virtuals.io/acp/sdk/provider-agent
 */

import {
  AcpAgent,
  AlchemyEvmProviderAdapter,
  AssetToken,
} from "@virtuals-protocol/acp-node-v2";
import { base } from "@account-kit/infra";
import { scan }        from "./scanner.js";
import { score }       from "./scorer.js";
import { logAcp, logDecision } from "./logger.js";

const SCAN_PRICE_USDC = 0.5;

export async function startAcpProvider() {
  const privateKey    = process.env.AGENT_PRIVATE_KEY;
  const walletAddress = process.env.AGENT_WALLET_ADDRESS;
  const builderCode   = process.env.ACP_BUILDER_CODE;
  const entityId      = parseInt(process.env.ACP_ENTITY_ID || "1");

  if (!privateKey || !walletAddress) {
    throw new Error("[acp] Missing AGENT_PRIVATE_KEY or AGENT_WALLET_ADDRESS in .env");
  }

  const provider = await AcpAgent.create({
    provider: await AlchemyEvmProviderAdapter.create({
      walletAddress,
      privateKey,
      entityId,
      chains: [base],
    }),
    builderCode: builderCode || undefined,
  });

  logAcp("ACP Provider initializing", { walletAddress, service: "Token Intelligence Scan" });

  provider.on("entry", async (session, entry) => {
    try {
      // Step 1: New job — read requirement and set budget
      if (
        entry.kind === "message" &&
        entry.contentType === "requirement" &&
        session.status === "open"
      ) {
        logAcp("Job received", { jobId: session.jobId, content: entry.content });

        let requirement;
        try { requirement = JSON.parse(entry.content); }
        catch (_) { requirement = { tokenAddress: entry.content }; }

        const tokenAddress = requirement.tokenAddress || requirement.token;

        if (!tokenAddress) {
          await session.sendMessage(
            JSON.stringify({ error: "Missing tokenAddress in requirement" }), "text"
          );
          return;
        }

        await session.sendMessage(
          `VeCast received scan request for ${tokenAddress}. Setting price...`, "text"
        );
        await session.setBudget(AssetToken.usdc(SCAN_PRICE_USDC, session.chainId));
        logAcp("Budget set", { jobId: session.jobId, usdc: SCAN_PRICE_USDC });
      }

      // Step 2: System events
      if (entry.kind === "system") {
        switch (entry.event.type) {

          case "job.funded": {
            logAcp("Job funded — running scan", { jobId: session.jobId });
            const tokenAddress = extractTokenFromSession(session);

            if (!tokenAddress) {
              await session.sendMessage("Could not determine token address.", "text");
              return;
            }

            await session.sendMessage(`Running Nansen scan on ${tokenAddress}...`, "text");

            const rawData     = await scan(tokenAddress);
            const scoreResult = score(rawData.raw);

            logDecision({
              token:    tokenAddress,
              score:    scoreResult.score,
              decision: scoreResult.decision,
              reasons:  scoreResult.reasons,
              source:   "ACP_JOB",
              jobId:    session.jobId,
            });

            const deliverable = JSON.stringify({
              token:     tokenAddress,
              score:     scoreResult.score,
              decision:  scoreResult.decision,
              breakdown: scoreResult.breakdown,
              reasons:   scoreResult.reasons,
              timestamp: rawData.timestamp,
              credits:   rawData.credits,
              provider:  "VeCast — Token Intelligence",
            }, null, 2);

            await session.submit(deliverable);
            logAcp("Deliverable submitted", { jobId: session.jobId, score: scoreResult.score });
            break;
          }

          case "job.completed": {
            logAcp("✅ Job completed — payment released", { jobId: session.jobId });
            console.log(`\n[acp] Payment received for job ${session.jobId}\n`);
            break;
          }

          case "job.rejected": {
            logAcp("❌ Job rejected", { jobId: session.jobId });
            break;
          }

          case "job.expired": {
            logAcp("⏰ Job expired", { jobId: session.jobId });
            break;
          }
        }
      }
    } catch (err) {
      logAcp("Error in entry handler", { error: err.message, jobId: session.jobId });
      console.error("[acp] Handler error:", err);
    }
  });

  await provider.start(() => {
    console.log("\n[acp] VeCast is LIVE as an ACP provider");
    console.log(`[acp] Wallet  : ${walletAddress}`);
    console.log(`[acp] Service : Token Intelligence Scan`);
    console.log(`[acp] Price   : $${SCAN_PRICE_USDC} USDC per scan`);
    console.log(`[acp] Listening for jobs...\n`);
  });
}

function extractTokenFromSession(session) {
  const history = session.history || session.messages || [];
  for (const msg of history) {
    if (msg.contentType === "requirement" || msg.kind === "message") {
      try {
        const parsed = JSON.parse(msg.content);
        if (parsed.tokenAddress) return parsed.tokenAddress;
        if (parsed.token)        return parsed.token;
      } catch (_) {
        const content = msg.content || "";
        if (content.startsWith("0x") && content.length === 42) return content;
      }
    }
  }
  return null;
}
