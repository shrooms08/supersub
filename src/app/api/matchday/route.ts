// The matchday hub's read-only data, one endpoint (Phase 4 design pass):
//   table      every player in the instance ranked by Impact Rating
//   legendary  the three highest-multiplier WINNING entries, any player
//   you        the viewer's form, per-fixture results for the bench
//              cards, and the nearest locked badge to tease
// Read-only social proof; nothing here mutates and nothing here is
// authoritative for scoring.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { currentPlayer } from "@/lib/server/playerAuth";
import { careerRecord } from "@/lib/career/stats";
import { windowResult, type WindowResult } from "@/lib/career/window";
import { BADGES, type BadgeKey } from "@/lib/career/badges";
import { tierForMultiplier } from "@/lib/config/scoring";
import type { EntryRow } from "@/lib/entry";
import type { PlayerRow } from "@/lib/player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface TableRow {
  rank: number;
  name: string;
  shirtNumber: number;
  apps: number;
  rating: number | null;
  isYou: boolean;
}

export interface LegendaryRow {
  playerName: string;
  shirtNumber: number;
  teamName: string;
  opponentName: string;
  entryMinute: number;
  multiplier: number;
  tierName: string;
  finalPoints: number;
}

export interface FixtureResult {
  points: number;
  multiplier: number;
  tierName: string;
  wdl: WindowResult;
}

export interface MatchdayPayload {
  table: TableRow[];
  legendary: LegendaryRow[];
  you: {
    form: WindowResult[];
    results: Record<number, FixtureResult>;
    nextBadge: { name: string; hint: string } | null;
  } | null;
}

function nextBadgeTease(earned: Set<string>, apps: number): { name: string; hint: string } | null {
  const hints: Record<BadgeKey, string> = {
    first_whistle: "Your debut awaits",
    ever_present: `${Math.max(1, 5 - apps)} app${5 - apps === 1 ? "" : "s"} from Ever Present`,
    miracle_worker: "Win one priced 10 in 100 or worse",
    iron_nerve: "Come on after the 85th",
    comeback_king: "Salvage one from behind",
    wounded: "Concede three. Wear it.",
  };
  const priority: BadgeKey[] =
    apps === 0
      ? ["first_whistle"]
      : ["ever_present", "miracle_worker", "iron_nerve", "comeback_king", "wounded"];
  for (const key of priority) {
    if (!earned.has(key)) {
      const def = BADGES.find((b) => b.key === key)!;
      return { name: def.name, hint: hints[key] };
    }
  }
  return null;
}

export async function GET() {
  const viewer = await currentPlayer();

  const [{ data: players }, { data: entries }] = await Promise.all([
    supabase().from("players").select().returns<PlayerRow[]>(),
    supabase().from("entries").select().not("resolved_at", "is", null).returns<EntryRow[]>(),
  ]);

  const byPlayer = new Map<string, EntryRow[]>();
  for (const e of entries ?? []) {
    const list = byPlayer.get((e as EntryRow & { player_id: string }).player_id) ?? [];
    list.push(e);
    byPlayer.set((e as EntryRow & { player_id: string }).player_id, list);
  }

  // The Table: rated players by Impact Rating, the unrated below, viewer
  // always visible even outside the cut.
  const CUT = 15;
  const ranked = (players ?? [])
    .map((p) => {
      const record = careerRecord(byPlayer.get(p.id) ?? []);
      return {
        id: p.id,
        name: p.name,
        shirtNumber: p.shirt_number,
        apps: record.appearances,
        rating: record.impactRating,
        isYou: viewer !== null && p.id === viewer.id,
      };
    })
    .sort((a, b) => {
      if (a.rating === null && b.rating === null) return a.name.localeCompare(b.name);
      if (a.rating === null) return 1;
      if (b.rating === null) return -1;
      return b.rating - a.rating;
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));
  const table: TableRow[] = ranked
    .filter((row, i) => i < CUT || row.isYou)
    .map(({ id: _id, ...row }) => row);

  // Legendary Entries: highest multiplier among won windows.
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));
  const legendary: LegendaryRow[] = (entries ?? [])
    .filter((e) => windowResult(e.breakdown) === "W")
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 3)
    .map((e) => {
      const p = playerById.get((e as EntryRow & { player_id: string }).player_id);
      return {
        playerName: p?.name ?? "Unknown",
        shirtNumber: p?.shirt_number ?? 0,
        teamName: e.team_name,
        opponentName: e.opponent_name,
        entryMinute: e.entry_minute,
        multiplier: e.multiplier,
        tierName: tierForMultiplier(e.multiplier).name,
        finalPoints: e.final_points ?? 0,
      };
    });

  // The viewer's slice.
  let you: MatchdayPayload["you"] = null;
  if (viewer) {
    const mine = byPlayer.get(viewer.id) ?? [];
    const record = careerRecord(mine);
    const results: Record<number, FixtureResult> = {};
    for (const e of mine) {
      results[e.fixture_id] = {
        points: e.final_points ?? 0,
        multiplier: e.multiplier,
        tierName: tierForMultiplier(e.multiplier).name,
        wdl: windowResult(e.breakdown),
      };
    }
    const { data: badgeRows } = await supabase()
      .from("player_badges")
      .select("badge")
      .eq("player_id", viewer.id)
      .returns<{ badge: string }[]>();
    const earned = new Set((badgeRows ?? []).map((b) => b.badge));
    you = {
      form: record.form,
      results,
      nextBadge: nextBadgeTease(earned, record.appearances),
    };
  }

  const payload: MatchdayPayload = { table, legendary, you };
  return NextResponse.json(payload);
}
