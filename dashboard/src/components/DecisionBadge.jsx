import React from "react";

export default function DecisionBadge({ decision }) {
  if (!decision) {
    return (
      <div className="border border-green-900 bg-zinc-950 p-4 rounded">
        <div className="text-xs text-green-600 mb-3 tracking-widest">
          ── DECISION
        </div>
        <div className="text-center py-8 text-green-900 text-sm">
          awaiting scan...
        </div>
      </div>
    );
  }

  const config = {
    BUY:   { bg: "bg-green-500",  text: "text-black", border: "border-green-500" },
    HOLD:  { bg: "bg-yellow-500", text: "text-black", border: "border-yellow-500" },
    BLOCK: { bg: "bg-red-600",    text: "text-white",  border: "border-red-600" },
  };

  const c = config[decision.decision] || config.HOLD;

  return (
    <div className={`border ${c.border} bg-zinc-950 p-4 rounded`}>
      <div className="text-xs text-green-600 mb-3 tracking-widest">
        ── DECISION
      </div>
      <div className={`${c.bg} ${c.text} text-center py-4 rounded text-3xl font-bold tracking-widest mb-3`}>
        {decision.decision}
      </div>
      <div className="text-center text-xs text-green-700 mb-1">
        score: <span className="text-green-400 font-bold text-lg">{decision.score}</span> / 100
      </div>
      <div className="text-center text-xs text-green-800 truncate">
        {decision.token}
      </div>
      {decision.txHash && (
        <a
          href={`https://basescan.org/tx/${decision.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block mt-3 text-center text-xs text-green-500 underline hover:text-green-300"
        >
          view tx on basescan ↗
        </a>
      )}
    </div>
  );
}
