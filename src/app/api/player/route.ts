// Player identity endpoints.
//   GET    current player + career-at-a-glance for the bench chip
//   POST   first-run creation; sets the signed identity cookie
//   PATCH  rename (the player row is immutable in v1 except name)

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { currentPlayer, setPlayerCookie } from "@/lib/server/playerAuth";
import { careerRecord } from "@/lib/career/stats";
import { POSITIONS, type PlayerRow, type Position } from "@/lib/player";
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

function validName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 20) return null;
  return trimmed;
}

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

  const name = validName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Name is required, 20 characters or fewer." }, { status: 400 });
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

export async function PATCH(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ error: "No player on the books." }, { status: 401 });
  }
  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const name = validName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Name is required, 20 characters or fewer." }, { status: 400 });
  }
  const { data, error } = await supabase()
    .from("players")
    .update({ name })
    .eq("id", player.id)
    .select()
    .single<PlayerRow>();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "rename failed" }, { status: 500 });
  }
  return NextResponse.json({ player: data });
}
