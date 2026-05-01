import { addDecision as addMemoryDecision, getDecisions as getMemoryDecisions, getStartedAt } from "./_memory.js";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const hasDatabase = Boolean(databaseUrl);
const authStore = globalThis.__VECAST_AUTH_STORE__ ?? {
  nonces: new Map(),
  sessions: new Map(),
};

globalThis.__VECAST_AUTH_STORE__ = authStore;

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

      create table if not exists auth_nonces (
        nonce text primary key,
        wallet_address text not null,
        message text not null,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );

      create table if not exists auth_sessions (
        token text primary key,
        wallet_address text not null,
        expires_at timestamptz not null,
        created_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now()
      );

      create table if not exists request_logs (
        id text primary key default md5(random()::text || clock_timestamp()::text),
        path text not null,
        method text not null,
        ip_address text,
        wallet_address text,
        status_code integer not null,
        duration_ms integer not null,
        metadata_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists request_logs_created_idx
        on request_logs (created_at desc);
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

export async function createAuthChallenge(walletAddress) {
  const normalizedWallet = walletAddress.toLowerCase();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = [
    "VeCast wants you to sign in with your wallet.",
    "",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    "",
    "This signature proves wallet ownership. It will not trigger a transaction or cost gas.",
  ].join("\n");

  authStore.nonces.set(nonce, {
    walletAddress: normalizedWallet,
    message,
    expiresAt,
  });

  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      `
        insert into auth_nonces (nonce, wallet_address, message, expires_at)
        values ($1, $2, $3, $4)
        on conflict (nonce) do nothing
      `,
      [nonce, normalizedWallet, message, expiresAt]
    );
  }

  return {
    walletAddress,
    nonce,
    message,
    expiresAt,
  };
}

export async function consumeAuthChallenge({ walletAddress, nonce, message }) {
  const normalizedWallet = walletAddress.toLowerCase();
  const memoryChallenge = authStore.nonces.get(nonce);

  if (memoryChallenge) {
    authStore.nonces.delete(nonce);
    return (
      memoryChallenge.walletAddress === normalizedWallet &&
      memoryChallenge.message === message &&
      new Date(memoryChallenge.expiresAt).getTime() > Date.now()
    );
  }

  const pool = await ensureSchema();
  if (!pool) return false;

  const { rows } = await pool.query(
    `
      delete from auth_nonces
      where nonce = $1
      returning wallet_address, message, expires_at
    `,
    [nonce]
  );

  const row = rows[0];
  return (
    row?.wallet_address === normalizedWallet &&
    row?.message === message &&
    new Date(row.expires_at).getTime() > Date.now()
  );
}

export async function createSession(walletAddress) {
  const normalizedWallet = walletAddress.toLowerCase();
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  authStore.sessions.set(token, {
    walletAddress: normalizedWallet,
    expiresAt,
  });

  const pool = await ensureSchema();
  if (pool) {
    await touchUser(normalizedWallet);
    await pool.query(
      `
        insert into auth_sessions (token, wallet_address, expires_at)
        values ($1, $2, $3)
      `,
      [token, normalizedWallet, expiresAt]
    );
  }

  return {
    token,
    walletAddress,
    expiresAt,
  };
}

export async function getSession(token) {
  if (!token) return null;
  const memorySession = authStore.sessions.get(token);
  if (memorySession) {
    if (new Date(memorySession.expiresAt).getTime() <= Date.now()) {
      authStore.sessions.delete(token);
      return null;
    }
    return memorySession;
  }

  const pool = await ensureSchema();
  if (!pool) return null;

  const { rows } = await pool.query(
    `
      update auth_sessions
      set last_seen_at = now()
      where token = $1 and expires_at > now()
      returning wallet_address, expires_at
    `,
    [token]
  );

  const row = rows[0];
  if (!row) return null;
  return {
    walletAddress: row.wallet_address,
    expiresAt: row.expires_at,
  };
}

export async function logRequest(entry) {
  const pool = await ensureSchema();
  if (!pool) return;

  await pool.query(
    `
      insert into request_logs (
        path,
        method,
        ip_address,
        wallet_address,
        status_code,
        duration_ms,
        metadata_json
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      entry.path,
      entry.method,
      entry.ipAddress || null,
      entry.walletAddress?.toLowerCase() || null,
      entry.statusCode,
      entry.durationMs,
      JSON.stringify(entry.metadata || {}),
    ]
  );
}
