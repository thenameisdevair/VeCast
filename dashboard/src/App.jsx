import React, { useState, useEffect } from "react";
import AgentStatus from "./components/AgentStatus.jsx";
import ScanPanel from "./components/ScanPanel.jsx";
import DecisionBadge from "./components/DecisionBadge.jsx";
import TxFeed from "./components/TxFeed.jsx";

const API = "";

export default function App() {
  const [agent, setAgent]         = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [lastDecision, setLastDecision] = useState(null);
  const [scanning, setScanning]   = useState(false);

  // Poll decisions every 5 seconds
  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        const res  = await fetch(`${API}/api/decisions`);
        const data = await res.json();
        setDecisions(data);
        if (data.length > 0) setLastDecision(data[0]);
      } catch (_) {}
    };

    fetchDecisions();
    const interval = setInterval(fetchDecisions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch agent status once on mount
  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res  = await fetch(`${API}/api/agent`);
        const data = await res.json();
        setAgent(data);
      } catch (_) {}
    };
    fetchAgent();
    const interval = setInterval(fetchAgent, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = async (tokenAddress) => {
    setScanning(true);
    try {
      const res  = await fetch(`${API}/api/scan`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tokenAddress }),
      });
      const data = await res.json();
      setLastDecision(data);
      setDecisions((prev) => [data, ...prev]);
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 font-mono">
      {/* Header */}
      <div className="mb-8 border-b border-green-900 pb-4">
        <h1 className="text-2xl font-bold text-green-400 tracking-widest">
          ▶ VECAST
        </h1>
        <p className="text-xs text-green-700 mt-1">
          Autonomous AI Economic Agent — Base Mainnet
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <AgentStatus agent={agent} />
          <ScanPanel onScan={handleScan} scanning={scanning} lastDecision={lastDecision} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <DecisionBadge decision={lastDecision} />
          <TxFeed decisions={decisions} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 border-t border-green-900 pt-4 text-xs text-green-800">
        VeCast v1.0.0 — EconomyOS × Nansen × Base
      </div>
    </div>
  );
}
