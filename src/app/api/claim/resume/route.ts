// Resume Your Career: a signed-in visitor on a fresh browser (no cookie,
// or a cookie for a different anonymous player) recovers the career they
// already claimed. One account, one career, any browser.
//
// The identity comes only from the verified Privy token. We look up the
// player bound to that Privy user id and, if found, mint the same signed
// HMAC cookie the anonymous flow uses, so from here on the browser plays
// that career exactly as before.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { setPlayerCookie } from "@/lib/server/playerAuth";
import { bearerToken, verifyPrivyToken } from "@/lib/server/privy";
import { claimStateFor, type PlayerRow } from "@/lib/player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = bearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Missing sign-in token." }, { status: 401 });
  }

  let identity;
  try {
    identity = await verifyPrivyToken(token);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sign-in is unavailable." },
      { status: 503 }
    );
  }
  if (!identity) {
    return NextResponse.json({ error: "That sign-in could not be verified." }, { status: 401 });
  }

  const { data: player, error } = await supabase()
    .from("players")
    .select()
    .eq("privy_user_id", identity.privyUserId)
    .maybeSingle<PlayerRow>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!player) {
    // Signed in, but nothing claimed yet. They play anonymously first,
    // then claim; there is no career to resume.
    return NextResponse.json(
      { error: "No claimed career on this account yet. Play a match, then claim it." },
      { status: 404 }
    );
  }

  setPlayerCookie(player.id);
  return NextResponse.json({
    player,
    claim: claimStateFor(player),
    email: identity.email,
  });
}
