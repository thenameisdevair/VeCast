import React, { useEffect, useMemo, useState } from "react";
import { ConnectWalletButton, useWalletSummary } from "./wallet/ConnectWalletButton.jsx";

const API = "";

const SIGNAL_LABELS = {
  holderConcentration: "Holder Concentration",
  smartMoneyFlow: "Smart Money Flow",
  smartMoneyDex: "DEX Activity",
  tokenAge: "Token Age",
  holderDistribution: "Holder Distribution",
  pnlProfile: "Market / Liquidity",
  buySellRatio: "Buy / Sell Ratio",
};

const DEMO_TOKENS = [
  { label: "WETH", address: "0x4200000000000000000000000000000000000006" },
  { label: "VIRTUAL", address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b" },
  { label: "DONNA", address: "0x61527cd3667243b0a80d41cb690237444e42a8d0" },
];

const TICKER_ITEMS = [
  "BASE MAINNET",
  "NANSEN REST",
  "RISK ENGINE",
  "BUY / HOLD / BLOCK",
  "AGENT WALLET",
  "LIVE TOKEN SCAN",
];

const DEFAULT_RISK_PROFILE = "balanced";

function truncate(value, start = 6, end = 4) {
  if (!value) return "-";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatUptime(seconds = 0) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function formatEth(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(6);
}

function formatTime(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCompactNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: options.fractionDigits ?? 2,
  }).format(number);
}

function formatUsd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `$${formatCompactNumber(number)}`;
}

function formatAge(timestamp) {
  if (!timestamp) return "-";
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "-";
  const days = Math.max(0, Math.floor((Date.now() - then) / 86400000));
  if (days < 1) return "<1d";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function displayToken(decision) {
  const symbol = decision?.tokenInfo?.symbol;
  const address = decision?.tokenAddress || decision?.token;
  if (symbol && address) return `${symbol} · ${truncate(address, 10, 6)}`;
  return address ? truncate(address, 12, 8) : null;
}

function decisionMeta(decision) {
  if (decision === "BUY") return { className: "decision-buy", label: "BUY" };
  if (decision === "BLOCK") return { className: "decision-block", label: "BLOCK" };
  if (decision === "HOLD") return { className: "decision-hold", label: "HOLD" };
  return { className: "decision-empty", label: "WAIT" };
}

function signalClass(score) {
  if (score <= 5) return "signal-low";
  if (score <= 11) return "signal-mid";
  return "signal-high";
}

function VecastMark() {
  return (
    <div className="vecast-mark" aria-hidden="true">
      <svg viewBox="0 0 28 28" role="img">
        <rect width="28" height="28" rx="6" />
        <path d="M7 8h3.7L14 14.5 17.4 8H21l-7 12L7 8Z" />
        <rect x="10" y="17" width="8" height="2" rx="1" />
      </svg>
    </div>
  );
}

function PulseDot() {
  return (
    <span className="pulse-dot">
      <span />
      <span />
    </span>
  );
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button className="theme-toggle" type="button" onClick={onToggle} aria-label="Toggle theme">
      <span>{isDark ? "Light" : "Dark"}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
          </>
        ) : (
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8Z" />
        )}
      </svg>
    </button>
  );
}

function Header({ agent, theme, onToggleTheme, wallet }) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <VecastMark />
        <div>
          <div className="brand-name">VeCast</div>
          <div className="brand-subtitle">Autonomous AI Economic Agent on Base</div>
        </div>
      </div>

      <div className="agent-strip">
        <div className="status-chip">
          <PulseDot />
          <span>{wallet.isConnected ? (wallet.isBase ? "Base" : "Wrong Chain") : "Demo Mode"}</span>
        </div>
        <Metric label="Wallet" value={wallet.address ? truncate(wallet.address, 7, 5) : "Not connected"} mono />
        <Metric label="ETH" value={wallet.isConnected ? wallet.balanceLabel : "-"} accent />
        <Metric label="Agent" value={agent ? "Online" : "Offline"} mono />
        <ConnectWalletButton />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}

function Metric({ label, value, accent = false, mono = false }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={`${accent ? "metric-accent" : ""} ${mono ? "mono" : ""}`}>{value}</strong>
    </div>
  );
}

function ScanPanel({ onScan, scanning, lastDecision, error }) {
  const [value, setValue] = useState("");

  const submit = (token = value) => {
    const next = token.trim();
    if (!next || scanning) return;
    setValue(next);
    onScan(next);
  };

  return (
    <section className="panel scan-panel">
      <div className="panel-kicker">Token Scanner</div>
      <div className="scan-input-row">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="Token address (0x...)"
          disabled={scanning}
        />
        <button onClick={() => submit()} disabled={scanning || !value.trim()}>
          {scanning ? "Scanning" : "Scan"}
        </button>
      </div>

      <div className={`scan-progress ${scanning ? "is-active" : ""}`}>
        <span />
      </div>

      {error && <div className="error-line">{error}</div>}

      <div className="quick-tokens">
        {DEMO_TOKENS.map((token) => (
          <button key={token.address} type="button" onClick={() => submit(token.address)} disabled={scanning}>
            {token.label}
          </button>
        ))}
      </div>

      <div className="last-scanned">
        <span>Last scanned</span>
        <strong>{displayToken(lastDecision) || "Awaiting token"}</strong>
      </div>
    </section>
  );
}

function UserContextPanel({ wallet }) {
  const connectedOnBase = wallet.isConnected && wallet.isBase;

  return (
    <section className={`panel user-context-panel ${connectedOnBase ? "is-connected" : "is-demo"}`}>
      <div className="panel-kicker">User Context</div>
      <div className="context-head">
        <div>
          <strong>{connectedOnBase ? "Connected Wallet" : "Public Demo Mode"}</strong>
          <span>{connectedOnBase ? truncate(wallet.address, 10, 8) : "Connect a wallet for personal scan history"}</span>
        </div>
        <ConnectWalletButton />
      </div>
      <div className="context-grid">
        <Metric label="Network" value={wallet.isConnected ? (wallet.isBase ? "Base" : "Wrong chain") : "Base preview"} />
        <Metric label="Balance" value={connectedOnBase ? `${wallet.balanceLabel} ETH` : "-"} accent />
        <Metric label="Risk" value="Balanced" />
        <Metric label="Autonomy" value="Disabled" />
      </div>
    </section>
  );
}

function TokenIdentityPanel({ decision }) {
  const token = decision?.tokenInfo;
  const symbol = token?.symbol || "Token";
  const name = token?.name || "Awaiting scan";
  const address = token?.address || decision?.tokenAddress || decision?.token;
  const logoText = symbol.slice(0, 3).toUpperCase();

  return (
    <section className="panel token-identity-panel">
      <div className="panel-kicker">Token Identity</div>
      <div className="token-head">
        {token?.logo ? (
          <img src={token.logo} alt="" />
        ) : (
          <div className="token-logo-fallback">{logoText}</div>
        )}
        <div>
          <strong>{symbol}</strong>
          <span>{name}</span>
          <code>{address ? truncate(address, 12, 8) : "Scan a Base token"}</code>
        </div>
      </div>
      <div className="token-metrics">
        <Metric label="Price" value={formatUsd(token?.priceUsd)} />
        <Metric label="Liquidity" value={formatUsd(token?.liquidityUsd)} accent />
        <Metric label="Market Cap" value={formatUsd(token?.marketCapUsd)} />
        <Metric label="Holders" value={formatCompactNumber(token?.holders, { fractionDigits: 1 })} />
        <Metric label="Age" value={formatAge(token?.deployedAt || token?.age)} />
        <Metric label="24h Volume" value={formatUsd(token?.volumeUsd24h)} />
        <Metric label="Buy Vol" value={formatUsd(token?.buyVolumeUsd24h)} />
        <Metric label="Sell Vol" value={formatUsd(token?.sellVolumeUsd24h)} />
      </div>
    </section>
  );
}

function DecisionPanel({ decision }) {
  const meta = decisionMeta(decision?.decision);
  const score = decision?.score ?? 0;

  return (
    <section className={`decision-panel panel ${meta.className}`}>
      <div className="decision-word">{decision ? meta.label : "READY"}</div>
      <div className="risk-score-label">Risk score</div>
      <div className="decision-score">
        <strong>{decision ? score : "--"}</strong>
        <span>/ 100 danger</span>
      </div>
      <div className="score-track">
        <span style={{ width: decision ? `${Math.min(100, score)}%` : "0%" }} />
      </div>
      <div className="risk-scale-labels">
        <span>lower risk</span>
        <span>higher risk</span>
      </div>
      <div className="decision-token mono">{displayToken(decision) || "Submit a Base token address to begin"}</div>
    </section>
  );
}

function SignalBreakdown({ breakdown }) {
  return (
    <section className="panel">
      <div className="panel-kicker">Signal Breakdown</div>
      <div className="signal-list">
        {Object.entries(SIGNAL_LABELS).map(([key, label]) => {
          const score = breakdown?.[key];
          const width = score === undefined ? 0 : Math.min(100, (score / 20) * 100);
          return (
            <div className="signal-row" key={key}>
              <span>{label}</span>
              <div className="signal-track">
                <i className={score === undefined ? "" : signalClass(score)} style={{ width: `${width}%` }} />
              </div>
              <strong>{score ?? "--"}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReasonsPanel({ reasons }) {
  return (
    <section className="panel reasons-panel">
      <div className="panel-kicker">Analysis</div>
      {!reasons?.length ? (
        <p className="empty-copy">Scan output will explain the agent decision here.</p>
      ) : (
        <div className="reason-list">
          {reasons.map((reason, index) => (
            <div className="reason-item" key={`${reason}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{reason}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryPanel({ decisions }) {
  const history = decisions.slice(0, 12);

  return (
    <section className="panel history-panel">
      <div className="panel-kicker">Scan History</div>
      {!history.length ? (
        <p className="empty-copy">No decisions logged yet.</p>
      ) : (
        <div className="history-list">
          {history.map((item, index) => {
            const meta = decisionMeta(item.decision);
            return (
              <div className="history-row" key={`${item.timestamp}-${item.token}-${index}`}>
                <span className="mono token-cell">{displayToken(item) || "-"}</span>
                <span className={`mini-badge ${meta.className}`}>{item.decision || item.type || "EVENT"}</span>
                <strong>{item.riskScore ?? item.score ?? "--"}</strong>
                <span className="mono time-cell">{formatTime(item.timestamp)}</span>
                {item.txHash && (
                  <a href={`https://basescan.org/tx/${item.txHash}`} target="_blank" rel="noreferrer">
                    tx
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AgentLog({ lastDecision, scanning }) {
  const lines = useMemo(() => {
    const base = [
      { type: "info", text: "Base RPC online" },
      { type: "info", text: "Nansen REST scanner ready" },
      { type: "info", text: "Risk engine loaded" },
    ];

    if (scanning) return [{ type: "warn", text: "Scan in progress" }, ...base];
    if (!lastDecision) return base;

    return [
      {
        type: lastDecision.decision?.toLowerCase() || "info",
        text: `Decision ${lastDecision.decision} (risk ${lastDecision.riskScore ?? lastDecision.score}/100)`,
      },
      { type: "info", text: `Token ${displayToken(lastDecision)}` },
      ...base,
    ];
  }, [lastDecision, scanning]);

  return (
    <section className="panel agent-log">
      <div className="panel-kicker with-dot">
        <PulseDot />
        Agent Log
      </div>
      <div className="log-list">
        {lines.map((line, index) => (
          <div className={`log-row log-${line.type}`} key={`${line.text}-${index}`}>
            <span className="mono">{formatTime(new Date().toISOString())}</span>
            <p>{line.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsPanel({ decisions }) {
  const stats = useMemo(() => {
    const buy = decisions.filter((item) => item.decision === "BUY").length;
    const hold = decisions.filter((item) => item.decision === "HOLD").length;
    const block = decisions.filter((item) => item.decision === "BLOCK").length;
    return [
      { label: "Scans", value: decisions.length },
      { label: "BUY", value: buy, className: "text-buy" },
      { label: "HOLD", value: hold, className: "text-hold" },
      { label: "BLOCK", value: block, className: "text-block" },
    ];
  }, [decisions]);

  return (
    <section className="panel stats-panel">
      {stats.map((stat) => (
        <div key={stat.label}>
          <span>{stat.label}</span>
          <strong className={stat.className || ""}>{stat.value}</strong>
        </div>
      ))}
    </section>
  );
}

function LandingPage({ theme, onToggleTheme, onEnter, onDemo }) {
  return (
    <div className="landing-shell">
      <header className="landing-topbar">
        <div className="brand-lockup">
          <VecastMark />
          <div>
            <div className="brand-name">VeCast</div>
            <div className="brand-subtitle">Autonomous AI Economic Agent on Base</div>
          </div>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <main className="landing-main">
        <div className="landing-mark">
          <VecastMark />
        </div>
        <h1>VeCast</h1>
        <p>Connect wallet, scan a Base token, understand risk, and keep agent actions under user-signed control.</p>
        <div className="landing-actions">
          <button type="button" onClick={onEnter}>
            Launch App
          </button>
          <button className="secondary-action" type="button" onClick={onDemo}>
            View Demo Scan
          </button>
        </div>
        <div className="landing-status">
          <PulseDot />
          <span>BASE MAINNET · CONNECTED</span>
        </div>
      </main>

      <div className="ticker-wrap" aria-hidden="true">
        <div className="ticker-inner">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const wallet = useWalletSummary();
  const [screen, setScreen] = useState("landing");
  const [theme, setTheme] = useState(() => localStorage.getItem("vecast-theme") || "dark");
  const [agent, setAgent] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [lastDecision, setLastDecision] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [queuedDemoScan, setQueuedDemoScan] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vecast-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        const res = await fetch(`${API}/api/decisions`);
        const data = await res.json();
        setDecisions(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setLastDecision(data[0]);
      } catch {
        setError("Decision history unavailable");
      }
    };

    fetchDecisions();
    const interval = setInterval(fetchDecisions, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await fetch(`${API}/api/agent`);
        const data = await res.json();
        setAgent(data.error ? null : data);
      } catch {
        setAgent(null);
      }
    };

    fetchAgent();
    const interval = setInterval(fetchAgent, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = async (tokenAddress) => {
    setScanning(true);
    setError("");

    try {
      const payload = {
        tokenAddress,
        riskProfile: DEFAULT_RISK_PROFILE,
      };

      if (wallet.isConnected && wallet.isBase && wallet.address) {
        payload.walletAddress = wallet.address;
      }

      const res = await fetch(`${API}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Scan failed");

      setLastDecision(data);
      setDecisions((prev) => [data, ...prev]);
    } catch (err) {
      setError(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (!queuedDemoScan || scanning) return;
    setQueuedDemoScan(false);
    handleScan(DEMO_TOKENS[0].address);
  }, [queuedDemoScan, scanning]);

  const openDashboard = () => setScreen("dashboard");
  const openDemoScan = () => {
    setScreen("dashboard");
    setQueuedDemoScan(true);
  };

  return (
    <div className="app-shell">
      {screen === "landing" ? (
        <LandingPage theme={theme} onToggleTheme={toggleTheme} onEnter={openDashboard} onDemo={openDemoScan} />
      ) : (
        <>
      <Header agent={agent} wallet={wallet} theme={theme} onToggleTheme={toggleTheme} />
      <main className="dashboard-grid">
        <div className="left-rail">
          <UserContextPanel wallet={wallet} />
          <ScanPanel onScan={handleScan} scanning={scanning} lastDecision={lastDecision} error={error} />
          <HistoryPanel decisions={decisions} />
        </div>

        <div className="center-stage">
          <TokenIdentityPanel decision={lastDecision} />
          <DecisionPanel decision={lastDecision} />
          <SignalBreakdown breakdown={lastDecision?.breakdown} />
          <ReasonsPanel reasons={lastDecision?.reasons} />
        </div>

        <div className="right-rail">
          <AgentLog lastDecision={lastDecision} scanning={scanning} />
          <StatsPanel decisions={decisions} />
        </div>
      </main>
        </>
      )}
    </div>
  );
}
