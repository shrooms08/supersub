"use client";

// App-wide client providers. The Privy provider is mounted ONLY when the
// claim feature is both flagged on and configured; otherwise children
// pass straight through, so anonymous play carries no Privy runtime at
// all and the deployed loop is byte-for-byte the dark build.

import { PrivyProvider } from "@privy-io/react-auth";
import { claimActive, PRIVY_APP_ID } from "@/lib/claim";

export function Providers({ children }: { children: React.ReactNode }) {
  if (!claimActive) return <>{children}</>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Login by email or an external wallet; an embedded Solana wallet
        // is created for anyone who signs in without one.
        loginMethods: ["email", "wallet"],
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "dark",
          accentColor: "#c8ff00",
          walletChainType: "solana-only",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
