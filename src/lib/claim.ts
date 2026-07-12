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
// Public Solana RPCs for the read-only wallet balance, tried in order
// until one answers. The official api.mainnet-beta endpoint rate-limits
// hard and often blocks browser CORS (which showed as "Unavailable"), so
// a CORS-friendly free endpoint leads and the official one is the
// fallback. NEXT_PUBLIC_SOLANA_RPC, if set, is tried first.
const FALLBACK_SOLANA_RPCS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];
export const SOLANA_RPCS = process.env.NEXT_PUBLIC_SOLANA_RPC
  ? [process.env.NEXT_PUBLIC_SOLANA_RPC, ...FALLBACK_SOLANA_RPCS]
  : FALLBACK_SOLANA_RPCS;
// Backwards-compatible single endpoint (the primary of the list).
export const SOLANA_RPC = SOLANA_RPCS[0];
