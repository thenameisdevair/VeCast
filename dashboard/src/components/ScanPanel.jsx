import React, { useState } from "react";

export default function ScanPanel({ onScan, scanning, lastDecision }) {
  const [tokenAddress, setTokenAddress] = useState("");

  const handleSubmit = () => {
    if (!tokenAddress.trim()) return;
    onScan(tokenAddress.trim());
  };

  const breakdown = lastDecision?.breakdown;

  return (
    <div className="border border-green-900 bg-zinc-950 p-4 rounded">
      <div className="text-xs text-green-600 mb-3 tracking-widest">
        ── SCAN PANEL
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="0x token address..."
          className="flex-1 bg-black border border-green-900 text-green-400
                     placeholder-green-900 px-3 py-2 text-sm rounded
                     focus:outline-none focus:border-green-600"
        />
        <button
          onClick={handleSubmit}
          disabled={scanning}
          className="px-4 py-2 text-sm bg-green-900 text-green-300
                     hover:bg-green-800 disabled:opacity-40
                     disabled:cursor-not-allowed rounded transition-colors"
        >
          {scanning ? "scanning..." : "► scan"}
        </button>
      </div>

      {/* Signal breakdown */}
      {breakdown && (
        <div className="space-y-2">
          <div className="text-xs text-green-700 mb-2">signal breakdown</div>
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center text-xs">
              <span className="text-green-700 w-48">{key}</span>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1 bg-zinc-900 rounded h-1.5">
                  <div
                    className={`h-1.5 rounded transition-all ${
                      val <= 5  ? "bg-green-500" :
                      val <= 12 ? "bg-yellow-500" :
                                  "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, (val / 20) * 100)}%` }}
                  />
                </div>
                <span className={`w-6 text-right font-bold ${
                  val <= 5  ? "text-green-400" :
                  val <= 12 ? "text-yellow-400" :
                              "text-red-400"
                }`}>
                  {val}
                </span>
              </div>
            </div>
          ))}
          <div className="border-t border-green-900 mt-2 pt-2 flex justify-between text-xs">
            <span className="text-green-700">total score</span>
            <span className="text-green-300 font-bold text-base">
              {lastDecision.score} / 100
            </span>
          </div>
        </div>
      )}

      {/* Reasons */}
      {lastDecision?.reasons && (
        <div className="mt-4 space-y-1">
          <div className="text-xs text-green-700 mb-1">reasons</div>
          {lastDecision.reasons.map((r, i) => (
            <div key={i} className="text-xs text-green-600">
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
