// Feature flag for Claim Your Legend. Ships dark: with the flag unset
// (or no Privy app id at build time) the whole feature is inert and the
// bench shows the same static Solana tease it always has. Both values
// are NEXT_PUBLIC_ and inlined at build time, so this is safe to import
// from client components.

export const CLAIM_ENABLED =
  process.env.NEXT_PUBLIC_CLAIM_ENABLED === "1" ||
  process.env.NEXT_PUBLIC_CLAIM_ENABLED === "true";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

// The feature is live only when it is both flagged on and configured.
export const claimActive = CLAIM_ENABLED && PRIVY_APP_ID.length > 0;

// Public Solana RPC for the read-only wallet balance. Overridable; a
// public mainnet endpoint by default. Display only, no transactions.
export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
