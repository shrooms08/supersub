// Player identity endpoints.
//   GET    current player + career-at-a-glance for the bench chip
//   POST   first-run creation; sets the signed identity cookie
//   PATCH  always 403: the player row, name included, is immutable

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { currentPlayer, setPlayerCookie } from "@/lib/server/playerAuth";
import { careerRecord } from "@/lib/career/stats";
import { POSITIONS, validateSurname, type PlayerRow, type Position } from "@/lib/player";
import type { EntryRow } from "@/lib/entry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ player: null, appearances: 0, impactRating: null, played: {} });
  }
  const { data: entries } = await supabase()
    .from("entries")
    .select()
    .eq("player_id", player.id)
    .returns<EntryRow[]>();
  const record = careerRecord(entries ?? []);
  const played: Record<number, number> = {};
  for (const e of entries ?? []) {
    if (e.resolved_at !== null && e.final_points !== null) {
      played[e.fixture_id] = e.final_points;
    }
  }
  return NextResponse.json({
    player,
    appearances: record.appearances,
    impactRating: record.impactRating,
    played,
  });
}

interface CreateBody {
  name?: string;
  position?: string;
  shirtNumber?: number;
}

// Contract rule for NEW signings (Phase 2): surname 2 to 12 characters,
// A-Z plus hyphen, normalized to uppercase. Rows signed under the old
// rule are untouched and keep working; only the write is gated.

export async function POST(req: NextRequest) {
  // The player row is created once; an existing identity keeps it.
  const existing = await currentPlayer();
  if (existing) {
    return NextResponse.json(
      { error: "You have already signed. One player per shirt.", player: existing },
      { status: 409 }
    );
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = validateSurname(body.name);
  if (!name) {
    return NextResponse.json(
      { error: "Surname on the shirt: 2 to 12 letters, A to Z, hyphens allowed inside." },
      { status: 400 }
    );
  }
  if (!POSITIONS.includes(body.position as Position)) {
    return NextResponse.json({ error: "Position must be one of ST, AM, CM, DM, CB." }, { status: 400 });
  }
  const shirtNumber = Number(body.shirtNumber);
  if (!Number.isInteger(shirtNumber) || shirtNumber < 1 || shirtNumber > 99) {
    return NextResponse.json({ error: "Shirt number must be 1 to 99." }, { status: 400 });
  }

  const { data, error } = await supabase()
    .from("players")
    .insert({ name, position: body.position, shirt_number: shirtNumber })
    .select()
    .single<PlayerRow>();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "could not sign the forms" }, { status: 500 });
  }

  setPlayerCookie(data.id);
  return NextResponse.json({ player: data }, { status: 201 });
}

// The player row is immutable, name included. The name on the shirt is
// the name in every match report ever written about it; changing it would
// retroactively falsify the record. Rejected unconditionally so a direct
// API call gets the same answer as the UI (which has no edit path).
export async function PATCH() {
  return NextResponse.json(
    { error: "The name on the shirt is permanent. No changes, ever." },
    { status: 403 }
  );
}
