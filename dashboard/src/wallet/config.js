import { createAppKit } from "@reown/appkit/react";
import { base } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

export const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
export const baseRpcUrl = import.meta.env.VITE_BASE_RPC_URL || "https://mainnet.base.org";
export const appNetworks = [base];
export const defaultChain = base;

const metadata = {
  name: "VeCast",
  description: "Autonomous token intelligence dashboard for Base users.",
  url: typeof window === "undefined" ? "https://ve-cast.vercel.app" : window.location.origin,
  icons: ["https://ve-cast.vercel.app/favicon.ico"],
};

const transports = {
  [base.id]: http(baseRpcUrl),
};

function createFallbackConfig() {
  const connectors = [
    injected(),
    coinbaseWallet({
      appName: metadata.name,
    }),
  ];

  if (walletConnectProjectId) {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
        metadata,
      })
    );
  }

  return createConfig({
    chains: appNetworks,
    connectors,
    transports,
  });
}

export const wagmiAdapter = walletConnectProjectId
  ? new WagmiAdapter({
      networks: appNetworks,
      projectId: walletConnectProjectId,
      transports,
    })
  : null;

export const wagmiConfig = wagmiAdapter?.wagmiConfig || createFallbackConfig();

export const appKit = walletConnectProjectId
  ? createAppKit({
      adapters: [wagmiAdapter],
      networks: appNetworks,
      defaultNetwork: base,
      projectId: walletConnectProjectId,
      metadata,
      features: {
        analytics: false,
        email: false,
        socials: false,
      },
      themeMode: "dark",
    })
  : null;
