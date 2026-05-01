import React from "react";

export default function AgentStatus({ agent }) {
  return (
    <div className="border border-green-900 bg-zinc-950 p-4 rounded">
      <div className="text-xs text-green-600 mb-3 tracking-widest">
        ── AGENT STATUS
      </div>
      {agent ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-green-700">address</span>
            <span className="text-green-300 truncate ml-4 max-w-xs">
              {agent.address}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">balance</span>
            <span className="text-green-400 font-bold">
              {parseFloat(agent.balanceEth).toFixed(6)} ETH
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">network</span>
            <span className="text-green-400">{agent.network}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">uptime</span>
            <span className="text-green-400">{agent.uptime}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">status</span>
            <span className="text-green-400">
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse" />
              LIVE
            </span>
          </div>
        </div>
      ) : (
        <div className="text-green-800 text-sm animate-pulse">
          connecting to agent...
        </div>
      )}
    </div>
  );
}
