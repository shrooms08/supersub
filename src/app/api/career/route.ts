// The career payload: player, the record, the badge cabinet (earned and
// locked), and the match history with stored reports.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { currentPlayer } from "@/lib/server/playerAuth";
import { careerRecord } from "@/lib/career/stats";
import { BADGES } from "@/lib/career/badges";
import type { EntryRow } from "@/lib/entry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BadgeState {
  key: string;
  name: string;
  description: string;
  earnedAt: string | null;
}

export async function GET() {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ player: null }, { status: 401 });
  }

  const [{ data: entries }, { data: badgeRows }] = await Promise.all([
    supabase()
      .from("entries")
      .select()
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .returns<EntryRow[]>(),
    supabase()
      .from("player_badges")
      .select("badge, earned_at")
      .eq("player_id", player.id)
      .returns<{ badge: string; earned_at: string }[]>(),
  ]);

  const record = careerRecord(entries ?? []);
  const earnedByKey = new Map((badgeRows ?? []).map((b) => [b.badge, b.earned_at]));
  const badges: BadgeState[] = BADGES.map((def) => ({
    key: def.key,
    name: def.name,
    description: def.description,
    earnedAt: earnedByKey.get(def.key) ?? null,
  }));

  const history = (entries ?? []).filter((e) => e.resolved_at !== null);

  return NextResponse.json({ player, record, badges, history });
}
