import React from "react";

export default function TxFeed({ decisions }) {
  const txOnly = decisions.filter((d) => d.txHash || d.type === "TX");

  return (
    <div className="border border-green-900 bg-zinc-950 p-4 rounded">
      <div className="text-xs text-green-600 mb-3 tracking-widest">
        ── TX FEED
      </div>
      {txOnly.length === 0 ? (
        <div className="text-green-900 text-xs text-center py-6">
          no transactions yet
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {txOnly.map((d, i) => (
            <div key={i} className="border-b border-green-950 pb-2 text-xs">
              <div className="flex justify-between mb-1">
                <span className={`font-bold ${
                  d.decision === "BUY" ? "text-green-400" : "text-green-600"
                }`}>
                  {d.decision || "TX"}
                </span>
                <span className="text-green-800">
                  score: {d.score || "-"}
                </span>
              </div>
              <div className="text-green-700 truncate mb-1">
                {d.token || d.tokenAddress || "-"}
              </div>
              {d.txHash && (
                <a
                  href={`https://basescan.org/tx/${d.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-600 underline hover:text-green-400 truncate block"
                >
                  {d.txHash.slice(0, 20)}...
                </a>
              )}
              <div className="text-green-900 mt-1">
                {new Date(d.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
