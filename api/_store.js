import { addDecision as addMemoryDecision, getDecisions as getMemoryDecisions, getStartedAt } from "./_memory.js";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const hasDatabase = Boolean(databaseUrl);

let poolPromise;
let schemaReady;

function getPool() {
  if (!hasDatabase) return null;
  if (!poolPromise) {
    poolPromise = import("pg").then(({ Pool }) => {
      const needsSsl = /supabase|neon|render|railway|vercel/i.test(databaseUrl) || process.env.NODE_ENV === "production";
      return new Pool({
        connectionString: databaseUrl,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      });
    });
  }
  return poolPromise;
}

async function ensureSchema() {
  const pool = await getPool();
  if (!pool) return null;
  if (!schemaReady) {
    schemaReady = pool.query(`
      create table if not exists users (
        id text primary key default md5(random()::text || clock_timestamp()::text),
        wallet_address text unique not null,
        created_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now()
      );

      create table if not exists scan_history (
        id text primary key,
        wallet_address text,
        token_address text not null,
        token_symbol text,
        token_name text,
        score integer not null,
        decision text not null,
        risk_profile text not null default 'balanced',
        reasons_json jsonb not null default '[]'::jsonb,
        breakdown_json jsonb not null default '{}'::jsonb,
        token_info_json jsonb not null default '{}'::jsonb,
        raw_summary_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists scan_history_wallet_created_idx
        on scan_history (wallet_address, created_at desc);

      create table if not exists risk_profiles (
        id text primary key default md5(random()::text || clock_timestamp()::text),
        wallet_address text not null,
        profile_name text not null default 'balanced',
        max_score_for_buy integer not null default 35,
        max_score_for_hold integer not null default 60,
        max_spend_eth numeric not null default 0,
        require_manual_confirmation boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (wallet_address, profile_name)
      );
    `);
  }
  await schemaReady;
  return pool;
}

function toHistoryRow(row) {
  return {
    id: row.id,
    token: row.token_address,
    tokenAddress: row.token_address,
    tokenInfo: row.token_info_json || {},
    walletAddress: row.wallet_address,
    score: row.score,
    riskScore: row.score,
    decision: row.decision,
    riskProfile: row.risk_profile,
    reasons: row.reasons_json || [],
    breakdown: row.breakdown_json || {},
    timestamp: row.created_at,
  };
}

async function touchUser(walletAddress) {
  if (!walletAddress) return;
  const pool = await ensureSchema();
  if (!pool) return;
  await pool.query(
    `
      insert into users (wallet_address)
      values ($1)
      on conflict (wallet_address)
      do update set last_seen_at = now()
    `,
    [walletAddress.toLowerCase()]
  );
}

export { getStartedAt };

export async function addDecision(decision) {
  const id = decision.id || crypto.randomUUID();
  const nextDecision = { ...decision, id };
  addMemoryDecision(nextDecision);

  const pool = await ensureSchema();
  if (!pool) return nextDecision;

  const walletAddress = nextDecision.walletAddress?.toLowerCase() || null;
  await touchUser(walletAddress);

  await pool.query(
    `
      insert into scan_history (
        id,
        wallet_address,
        token_address,
        token_symbol,
        token_name,
        score,
        decision,
        risk_profile,
        reasons_json,
        breakdown_json,
        token_info_json,
        raw_summary_json,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13)
      on conflict (id) do nothing
    `,
    [
      id,
      walletAddress,
      nextDecision.tokenAddress || nextDecision.token,
      nextDecision.tokenInfo?.symbol || null,
      nextDecision.tokenInfo?.name || null,
      nextDecision.riskScore ?? nextDecision.score,
      nextDecision.decision,
      nextDecision.riskProfile || "balanced",
      JSON.stringify(nextDecision.reasons || []),
      JSON.stringify(nextDecision.breakdown || {}),
      JSON.stringify(nextDecision.tokenInfo || {}),
      JSON.stringify({
        credits: nextDecision.credits ?? null,
        thresholds: nextDecision.thresholds ?? null,
      }),
      nextDecision.timestamp || new Date().toISOString(),
    ]
  );

  return nextDecision;
}

export async function getDecisions({ walletAddress, limit = 50 } = {}) {
  const pool = await ensureSchema();
  if (!pool) {
    const decisions = getMemoryDecisions();
    if (!walletAddress) return decisions;
    return decisions.filter((decision) => decision.walletAddress?.toLowerCase() === walletAddress.toLowerCase());
  }

  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const params = walletAddress ? [walletAddress.toLowerCase(), cappedLimit] : [cappedLimit];
  const where = walletAddress ? "where wallet_address = $1" : "";
  const limitParam = walletAddress ? "$2" : "$1";
  const { rows } = await pool.query(
    `
      select *
      from scan_history
      ${where}
      order by created_at desc
      limit ${limitParam}
    `,
    params
  );

  return rows.map(toHistoryRow);
}

export async function getDecisionById(id) {
  const memoryMatch = getMemoryDecisions().find((decision) => decision.id === id);
  if (memoryMatch) return memoryMatch;

  const pool = await ensureSchema();
  if (!pool) return null;

  const { rows } = await pool.query("select * from scan_history where id = $1 limit 1", [id]);
  return rows[0] ? toHistoryRow(rows[0]) : null;
}

export async function saveRiskProfile(walletAddress, profile) {
  const pool = await ensureSchema();
  if (!pool || !walletAddress) return null;
  await touchUser(walletAddress);

  const { rows } = await pool.query(
    `
      insert into risk_profiles (
        wallet_address,
        profile_name,
        max_score_for_buy,
        max_score_for_hold,
        max_spend_eth,
        require_manual_confirmation
      )
      values ($1, $2, $3, $4, $5, $6)
      on conflict (wallet_address, profile_name)
      do update set
        max_score_for_buy = excluded.max_score_for_buy,
        max_score_for_hold = excluded.max_score_for_hold,
        max_spend_eth = excluded.max_spend_eth,
        require_manual_confirmation = excluded.require_manual_confirmation,
        updated_at = now()
      returning *
    `,
    [
      walletAddress.toLowerCase(),
      profile.profileName || "balanced",
      profile.maxScoreForBuy ?? 35,
      profile.maxScoreForHold ?? 60,
      profile.maxSpendEth ?? 0,
      profile.requireManualConfirmation ?? true,
    ]
  );

  return rows[0] || null;
}
