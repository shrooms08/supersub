// Claim Your Legend: bind the authenticated Privy identity to the
// player the current cookie already owns. Anonymous play is untouched;
// this only ever runs when a signed-in visitor chooses to claim.
//
// Security: the identity comes exclusively from the verified Privy
// access token (Authorization: Bearer). The request body is not trusted
// for the user id or wallet. The binding itself goes through the
// claim_player SECURITY DEFINER function (migration 0007), which writes
// only privy_user_id and wallet_address and only when the player is
// still unclaimed, so name immutability and the no-cross-write posture
// from migration 0006 are preserved.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { currentPlayer } from "@/lib/server/playerAuth";
import { bearerToken, verifyPrivyToken } from "@/lib/server/privy";
import { claimStateFor, type PlayerRow } from "@/lib/player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json(
      { error: "No career on this device to claim. Sign in and resume instead." },
      { status: 401 }
    );
  }

  const token = bearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Missing sign-in token." }, { status: 401 });
  }

  let identity;
  try {
    identity = await verifyPrivyToken(token);
  } catch (err) {
    // Server misconfiguration (no Privy secret): a 503, not the user's fault.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sign-in is unavailable." },
      { status: 503 }
    );
  }
  if (!identity) {
    return NextResponse.json({ error: "That sign-in could not be verified." }, { status: 401 });
  }

  // Already claimed by this very player? Nothing to do, and a re-claim is
  // rejected in the broadcast voice.
  if (player.privy_user_id) {
    return NextResponse.json(
      { error: "This legend is already claimed. A career is claimed once, for good." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase()
    .rpc("claim_player", {
      p_player_id: player.id,
      p_privy_user_id: identity.privyUserId,
      p_wallet_address: identity.walletAddress,
    })
    .maybeSingle<PlayerRow>();

  if (error) {
    // Unique-index violation: this account or wallet is already bound to
    // another career. One account is one career, for good.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That account already holds a career. One account, one legend." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The function returns no row when the player was already claimed
  // between the read above and the write (the null-guard matched nothing).
  if (!data) {
    return NextResponse.json(
      { error: "This legend is already claimed. A career is claimed once, for good." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    player: data,
    claim: claimStateFor(data),
    email: identity.email,
  });
}
