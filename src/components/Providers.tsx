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
        // Email only: no external wallet login. Every signed-in user gets
        // an embedded Solana wallet, which is what populates
        // wallet_address on claim.
        loginMethods: ["email"],
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
