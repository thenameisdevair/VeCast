import React from "react";
import { useAppKit } from "@reown/appkit/react";
import { formatEther } from "viem";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { defaultChain, walletConnectProjectId } from "./config.js";

function truncateAddress(value) {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatBalance(value) {
  if (value === undefined) return "-";
  const number = Number(formatEther(value));
  if (!Number.isFinite(number)) return "-";
  return number.toFixed(4);
}

export function useWalletSummary() {
  const account = useAccount();
  const balance = useBalance({ address: account.address, chainId: defaultChain.id });

  return {
    address: account.address,
    isConnected: account.isConnected,
    isConnecting: account.isConnecting,
    chainId: account.chainId,
    isBase: account.chainId === defaultChain.id,
    balanceEth: balance.data?.value,
    balanceLabel: formatBalance(balance.data?.value),
  };
}

export function ConnectWalletButton() {
  const { open } = useAppKit();
  const { address, isConnected, isConnecting, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const isWrongChain = isConnected && chainId !== defaultChain.id;

  const connectInjected = () => {
    const injected = connectors.find((connector) => connector.type === "injected") || connectors[0];
    if (injected) connect({ connector: injected, chainId: defaultChain.id });
  };

  if (isConnected) {
    return (
      <div className="wallet-actions">
        {isWrongChain ? (
          <button
            className="wallet-button is-warning"
            type="button"
            onClick={() => switchChain({ chainId: defaultChain.id })}
            disabled={isSwitching}
          >
            {isSwitching ? "Switching" : "Switch to Base"}
          </button>
        ) : (
          <span className="wallet-pill">{truncateAddress(address)}</span>
        )}
        <button className="wallet-button" type="button" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      className="wallet-button is-primary"
      type="button"
      onClick={() => (walletConnectProjectId ? open() : connectInjected())}
      disabled={isConnecting || isPending}
    >
      {isConnecting || isPending ? "Connecting" : "Connect Wallet"}
    </button>
  );
}
