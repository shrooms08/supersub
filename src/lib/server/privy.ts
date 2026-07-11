// Server-side Privy verification. The claim and resume endpoints NEVER
// trust a client-sent user id or wallet: they take the Privy access
// token from the Authorization header, verify it here, and read the
// authoritative account details (Solana wallet, email) straight from
// Privy's API. Nothing about the identity comes from the request body.
//
// Configuration (server-side only, never NEXT_PUBLIC_ for the secret):
//   PRIVY_APP_ID      the app id (falls back to NEXT_PUBLIC_PRIVY_APP_ID)
//   PRIVY_APP_SECRET  the app secret, required to verify and to read users
// The feature ships dark behind NEXT_PUBLIC_CLAIM_ENABLED, so a missing
// secret is not a runtime hazard for anonymous play; the claim endpoints
// simply return a clear "not configured" error until it is set.

import { PrivyClient } from "@privy-io/server-auth";

export interface VerifiedIdentity {
  privyUserId: string;
  walletAddress: string | null;
  email: string | null;
}

let cached: PrivyClient | null | undefined;

function client(): PrivyClient | null {
  if (cached !== undefined) return cached;
  const appId = process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  cached = appId && appSecret ? new PrivyClient(appId, appSecret) : null;
  return cached;
}

export function privyConfigured(): boolean {
  return client() !== null;
}

// Read the Solana wallet address and email off a Privy user's linked
// accounts. Prefers an embedded/linked Solana wallet; falls back to any
// wallet if none is flagged solana.
function extractAccounts(user: {
  linkedAccounts?: Array<Record<string, unknown>>;
}): { walletAddress: string | null; email: string | null } {
  const accounts = user.linkedAccounts ?? [];
  let walletAddress: string | null = null;
  let email: string | null = null;
  for (const acct of accounts) {
    if (acct.type === "wallet" && acct.chainType === "solana" && !walletAddress) {
      walletAddress = typeof acct.address === "string" ? acct.address : null;
    }
    if (acct.type === "email" && !email) {
      email = typeof acct.address === "string" ? acct.address : null;
    }
  }
  if (!walletAddress) {
    for (const acct of accounts) {
      if (acct.type === "wallet" && typeof acct.address === "string") {
        walletAddress = acct.address;
        break;
      }
    }
  }
  return { walletAddress, email };
}

// Verify a Privy access token and return the authoritative identity, or
// null if the token is invalid or expired. Throws only when Privy is not
// configured on the server (a deploy-time problem, not a client one).
export async function verifyPrivyToken(token: string): Promise<VerifiedIdentity | null> {
  const privy = client();
  if (!privy) {
    throw new Error(
      "Privy is not configured on the server. Set PRIVY_APP_ID and PRIVY_APP_SECRET."
    );
  }

  let userId: string;
  try {
    const claims = await privy.verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return null;
  }
  if (!userId) return null;

  const user = (await privy.getUser(userId)) as unknown as {
    linkedAccounts?: Array<Record<string, unknown>>;
  };
  const { walletAddress, email } = extractAccounts(user);
  return { privyUserId: userId, walletAddress, email };
}

// The Bearer token from an Authorization header, or null.
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
